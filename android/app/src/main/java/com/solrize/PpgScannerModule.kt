package com.solrize

import android.Manifest
import android.content.pm.PackageManager
import android.hardware.camera2.CaptureRequest
import android.hardware.camera2.CameraManager
import android.content.Context
import android.util.Log
import android.util.Size
import android.view.WindowManager
import androidx.camera.camera2.interop.Camera2Interop
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.LinkedList
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import kotlin.math.pow
import android.os.Handler
import android.os.Looper

class PpgScannerModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val TAG = "PpgScanner"
        const val EVENT_PROGRESS = "ppgProgress"
        const val EVENT_RESULT = "ppgResult"
        const val EVENT_ERROR = "ppgError"
        const val TARGET_FPS = 30
        const val FRAME_INTERVAL_MS = 1000L / TARGET_FPS
        
        // --- TUNABLE CONSTANTS FOR FINGER DETECTION ---
        // Mean channel intensity expected from a finger absorbing flashlight.
        // We widen this slightly because different skin tones have different absolute reflectances.
        const val INTENSITY_THRESHOLD_MIN = 5.0
        const val INTENSITY_THRESHOLD_MAX = 220.0
        
        // Maximum allowed spatial variance across the frame ROI.
        const val MAX_SPATIAL_VARIANCE = 500.0 
        
        // Maximum allowed temporal variance over a 15-frame window.
        const val MAX_TEMPORAL_VARIANCE = 150.0 
        
        // Hysteresis wall-clock durations (agnostic to frame drops)
        const val TIME_TO_CANDIDATE_MS = 150L
        const val TIME_TO_CONFIRM_DETECTED_MS = 500L
        const val TIME_TO_CONFIRM_LOST_MS = 300L
        
        // Durations
        const val WARMUP_DURATION_MS = 10_000L
        const val MEASURE_DURATION_MS = 60_000L
        
        // Watchdog
        const val WATCHDOG_TIMEOUT_MS = 2500L
    }

    private var cameraProvider: ProcessCameraProvider? = null
    private val cameraExecutor: ExecutorService = Executors.newSingleThreadExecutor()
    private val mainHandler = Handler(Looper.getMainLooper())

    @Volatile private var isRunning = false
    @Volatile private var previewSurfaceProvider: Preview.SurfaceProvider? = null
    
    @Volatile private var lastFrameProcessedTs = 0L
    
    // Main scan state machine
    private enum class State { IDLE, WAITING, WARMUP, MEASURING }
    private var currentState = State.IDLE
    private var stateStartTime = 0L
    
    // Finger detection state machine
    private enum class FingerState { NOT_DETECTED, CANDIDATE, DETECTED }
    private var fingerState = FingerState.NOT_DETECTED
    private var qualifyingStartMs = 0L
    private var invalidStartMs = 0L
    private val recentMeans = LinkedList<Double>()
    private var lastBeatTs = 0L
    
    private val signalData = mutableListOf<DataPoint>()
    private var lastProgressPct = -1
    
    private var torchCallback: CameraManager.TorchCallback? = null

    override fun getName() = "PpgScanner"

    private var latestAfState: Int = -1

    private val watchdogRunnable = object : Runnable {
        override fun run() {
            if (!isRunning) return
            val now = System.currentTimeMillis()
            if (lastFrameProcessedTs > 0 && now - lastFrameProcessedTs > WATCHDOG_TIMEOUT_MS) {
                Log.e(TAG, "Watchdog triggered: no frames for ${now - lastFrameProcessedTs}ms")
                emitError("camera_interrupted", "The camera was interrupted or stopped unexpectedly.")
                stopScanInternal()
            } else {
                mainHandler.postDelayed(this, 1000)
            }
        }
    }

    fun setPreviewSurfaceProvider(provider: Preview.SurfaceProvider?) {
        previewSurfaceProvider = provider
        if (isRunning) {
            val activity = reactContext.currentActivity ?: return
            ContextCompat.getMainExecutor(reactContext).execute {
                try { rebindCamera(activity) } catch (e: Exception) {
                    Log.w(TAG, "Rebind failed", e)
                }
            }
        }
    }

    @ReactMethod
    fun startScan(promise: Promise) {
        if (isRunning) { promise.resolve(null); return }

        val activity = reactContext.currentActivity
        if (activity == null) {
            promise.reject("E_NO_ACTIVITY", "No foreground activity")
            return
        }
        if (ContextCompat.checkSelfPermission(reactContext, Manifest.permission.CAMERA)
            != PackageManager.PERMISSION_GRANTED) {
            promise.reject("E_NO_PERMISSION", "Camera permission required")
            return
        }
        
        // Prevent screen from sleeping/dozing mid-scan
        activity.runOnUiThread {
            activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
        
        setupTorchCallback()

        val future = ProcessCameraProvider.getInstance(reactContext)
        future.addListener({
            try {
                cameraProvider = future.get()
                rebindCamera(activity)
                
                isRunning = true
                currentState = State.WAITING
                lastFrameProcessedTs = System.currentTimeMillis()
                
                fingerState = FingerState.NOT_DETECTED
                qualifyingStartMs = 0L
                invalidStartMs = 0L
                recentMeans.clear()
                signalData.clear()
                
                mainHandler.postDelayed(watchdogRunnable, WATCHDOG_TIMEOUT_MS)
                
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("E_CAMERA", e.localizedMessage)
            }
        }, ContextCompat.getMainExecutor(reactContext))
    }

    @ReactMethod
    fun stopScan(promise: Promise) {
        stopScanInternal()
        promise.resolve(null)
    }
    
    private fun stopScanInternal() {
        isRunning = false
        currentState = State.IDLE
        mainHandler.removeCallbacks(watchdogRunnable)
        
        val activity = reactContext.currentActivity
        activity?.runOnUiThread {
            activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
        
        teardownTorchCallback()
        try { cameraProvider?.unbindAll() } catch (_: Exception) {}
    }
    
    private fun setupTorchCallback() {
        val manager = reactContext.getSystemService(Context.CAMERA_SERVICE) as? CameraManager
        if (manager == null) return
        
        torchCallback = object : CameraManager.TorchCallback() {
            override fun onTorchModeChanged(cameraId: String, enabled: Boolean) {
                if (isRunning && !enabled) {
                    // Torch was disabled mid-scan, likely due to thermal throttling
                    Log.w(TAG, "Torch was disabled mid-scan. Thermal throttling?")
                    emitError("torch_disabled", "Your phone paused the flash to prevent overheating. Please try again in a few minutes.")
                    stopScanInternal()
                }
            }
        }
        manager.registerTorchCallback(torchCallback!!, mainHandler)
    }
    
    private fun teardownTorchCallback() {
        if (torchCallback != null) {
            val manager = reactContext.getSystemService(Context.CAMERA_SERVICE) as? CameraManager
            manager?.unregisterTorchCallback(torchCallback!!)
            torchCallback = null
        }
    }

    private fun rebindCamera(activity: android.app.Activity) {
        val analysisBuilder = ImageAnalysis.Builder()
            // The image analyzer resolves resolution implicitly if omitted, but let's request 320x240 safely:
            .setTargetResolution(Size(320, 240))
            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
            .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_YUV_420_888)
            
        val ext = Camera2Interop.Extender(analysisBuilder)
        ext.setCaptureRequestOption(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_AUTO) // Try to focus so we can read failure state
        
        ext.setSessionCaptureCallback(object : android.hardware.camera2.CameraCaptureSession.CaptureCallback() {
            override fun onCaptureCompleted(session: android.hardware.camera2.CameraCaptureSession, request: android.hardware.camera2.CaptureRequest, result: android.hardware.camera2.TotalCaptureResult) {
                // We don't have direct access to write to the proxy tag bundle here, so we'll store the latest state
                latestAfState = result.get(android.hardware.camera2.CaptureResult.CONTROL_AF_STATE) ?: -1
            }
        })

        val analysis = analysisBuilder.build()
        analysis.setAnalyzer(cameraExecutor) { proxy -> processFrame(proxy) }

        val useCases = mutableListOf<UseCase>(analysis)

        previewSurfaceProvider?.let { provider ->
            val preview = Preview.Builder().build()
            preview.setSurfaceProvider(provider)
            useCases.add(0, preview)
        }

        cameraProvider?.unbindAll()
        val camera = cameraProvider?.bindToLifecycle(
            activity as LifecycleOwner,
            CameraSelector.DEFAULT_BACK_CAMERA,
            *useCases.toTypedArray()
        )
        
        val future = camera?.cameraControl?.enableTorch(true)
        future?.addListener({
            try {
                future.get() // Will throw if torch failed to turn on
                Log.d(TAG, "Torch successfully enabled via CameraX")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to enable torch via future", e)
                emitError("hardware_error", "Couldn't access your flash. Check that no other app is using the camera and try again.")
                stopScanInternal()
            }
        }, ContextCompat.getMainExecutor(reactContext))
    }
    
    data class FrameStats(val mean: Double, val spatialVariance: Double)

    private fun processFrame(proxy: ImageProxy) {
        try {
            val now = System.currentTimeMillis()
            if (!isRunning) return
            
            lastFrameProcessedTs = now
            
            val stats = extractGreenChannelStats(proxy)
            
            recentMeans.add(stats.mean)
            if (recentMeans.size > 15) recentMeans.removeFirst()
            
            val tMean = recentMeans.average()
            val tVar = if (recentMeans.size > 1) {
                recentMeans.sumOf { (it - tMean).pow(2) } / (recentMeans.size - 1)
            } else 0.0

            val isIntensityOk = stats.mean in INTENSITY_THRESHOLD_MIN..INTENSITY_THRESHOLD_MAX
            val isSpatialOk = stats.spatialVariance <= MAX_SPATIAL_VARIANCE
            val isTemporalOk = fingerState == FingerState.NOT_DETECTED || tVar <= MAX_TEMPORAL_VARIANCE
            
            // Treat the lens being physically unable to focus (CONTROL_AF_STATE_NOT_FOCUSED_LOCKED = 5) 
            // as a POSITIVE confidence booster, since a finger pressed flat on a lens is closer than the minimum macro distance
            val hasProximityConfidence = latestAfState == android.hardware.camera2.CaptureResult.CONTROL_AF_STATE_NOT_FOCUSED_LOCKED || latestAfState == android.hardware.camera2.CaptureResult.CONTROL_AF_STATE_INACTIVE
            
            // It remains a booster, not a hard gate, allowing graceful degradation
            val isQualifying = isIntensityOk && isSpatialOk && isTemporalOk
            
            val activeTimeToCandidateMs = if (hasProximityConfidence) TIME_TO_CANDIDATE_MS / 2 else TIME_TO_CANDIDATE_MS
            val activeTimeToConfirmMs = if (hasProximityConfidence) TIME_TO_CONFIRM_DETECTED_MS / 2 else TIME_TO_CONFIRM_DETECTED_MS
            
            // Very simple real-time beat detection strictly for UI animation.
            // A real heartbeat causes a sudden drop in green reflection (blood absorbs green light).
            if (isQualifying && recentMeans.size >= 5) {
                val pastMean = recentMeans[recentMeans.size - 5]
                val diff = stats.mean - pastMean
                if (diff < -1.0 && now - lastBeatTs > 350) {
                    lastBeatTs = now
                    emitEvent("ppgBeat", Arguments.createMap())
                }
            }
            
            // Log for structured telemetry
            if (BuildConfig.DEBUG) {
                Log.d(TAG, "Frame stats: mean=${String.format("%.2f", stats.mean)}, spatialVar=${String.format("%.2f", stats.spatialVariance)}, temporalVar=${String.format("%.2f", tVar)} | qualify=$isQualifying")
            }
            
            if (isQualifying) {
                invalidStartMs = 0L
                if (qualifyingStartMs == 0L) qualifyingStartMs = now
                
                val qualifyDuration = now - qualifyingStartMs
                
                if (fingerState == FingerState.NOT_DETECTED && qualifyDuration >= activeTimeToCandidateMs) {
                    fingerState = FingerState.CANDIDATE
                    emitProgress("candidate", 0)
                } else if (fingerState == FingerState.CANDIDATE && qualifyDuration >= activeTimeToConfirmMs) {
                    fingerState = FingerState.DETECTED
                    
                    if (currentState == State.WAITING || currentState == State.IDLE) {
                        currentState = State.WARMUP
                        stateStartTime = now
                        signalData.clear()
                    }
                }
            } else {
                qualifyingStartMs = 0L
                if (invalidStartMs == 0L) invalidStartMs = now
                
                val invalidDuration = now - invalidStartMs
                
                if (fingerState != FingerState.NOT_DETECTED && invalidDuration >= TIME_TO_CONFIRM_LOST_MS) {
                    fingerState = FingerState.NOT_DETECTED
                    
                    if (currentState == State.WARMUP || currentState == State.MEASURING) {
                        emitError("signal_lost", "Signal lost. Please keep your finger firmly on the camera.")
                        currentState = State.WAITING
                        signalData.clear()
                    } else {
                        emitProgress("waiting", 0)
                    }
                }
            }

            if (fingerState == FingerState.DETECTED) {
                when (currentState) {
                    State.WARMUP -> {
                        val elapsed = now - stateStartTime
                        val pct = ((elapsed.toDouble() / WARMUP_DURATION_MS) * 100).toInt()
                        emitProgress("warming_up", pct, stats.mean)
                        
                        if (elapsed >= WARMUP_DURATION_MS) {
                            currentState = State.MEASURING
                            stateStartTime = now
                            signalData.clear()
                        }
                    }
                    State.MEASURING -> {
                        signalData.add(DataPoint(now, stats.mean))
                        
                        val elapsed = now - stateStartTime
                        val pct = ((elapsed.toDouble() / MEASURE_DURATION_MS) * 100).toInt()
                        emitProgress("measuring", pct, stats.mean)
                        
                        if (elapsed >= MEASURE_DURATION_MS) {
                            currentState = State.IDLE
                            processSignalAndEmitResult()
                        }
                    }
                    else -> {}
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Unhandled exception in frame processing", e)
        } finally {
            proxy.close()
        }
    }

    private fun extractGreenChannelStats(proxy: ImageProxy): FrameStats {
        val yPlane = proxy.planes[0]
        val uPlane = proxy.planes[1]
        val vPlane = proxy.planes[2]

        val yBuffer = yPlane.buffer
        val uBuffer = uPlane.buffer
        val vBuffer = vPlane.buffer

        val cx = proxy.width / 2
        val cy = proxy.height / 2
        val r = 40

        var sumG = 0.0
        var sumSqG = 0.0
        var count = 0

        var y = maxOf(0, cy - r)
        val endY = minOf(proxy.height - 1, cy + r)
        
        while (y <= endY) {
            var x = maxOf(0, cx - r)
            val endX = minOf(proxy.width - 1, cx + r)
            
            while (x <= endX) {
                val yIdx = y * yPlane.rowStride + x * yPlane.pixelStride
                val uvX = x / 2
                val uvY = y / 2
                val uIdx = uvY * uPlane.rowStride + uvX * uPlane.pixelStride
                val vIdx = uvY * vPlane.rowStride + uvX * vPlane.pixelStride

                if (yIdx < yBuffer.remaining() && uIdx < uBuffer.remaining() && vIdx < vBuffer.remaining()) {
                    val yVal = (yBuffer[yIdx].toInt() and 0xFF).toDouble()
                    val uVal = (uBuffer[uIdx].toInt() and 0xFF).toDouble() - 128.0
                    val vVal = (vBuffer[vIdx].toInt() and 0xFF).toDouble() - 128.0

                    var gVal = yVal - 0.344 * uVal - 0.714 * vVal
                    if (gVal < 0) gVal = 0.0
                    if (gVal > 255) gVal = 255.0

                    sumG += gVal
                    sumSqG += gVal * gVal
                    count++
                }
                x += 2
            }
            y += 2
        }
        
        val mean = if (count > 0) sumG / count else 0.0
        val variance = if (count > 0) (sumSqG / count) - (mean * mean) else 0.0
        
        return FrameStats(mean, variance)
    }
    
    private fun processSignalAndEmitResult() {
        emitProgress("processing", 100)
        
        // BUG 2 FIX: Actually shut down the camera/torch so it stops processing frames and burning battery
        stopScanInternal()
        
        Thread {
            try {
                val processor = SignalProcessor()
                val invertedSignal = signalData.map { DataPoint(it.timestamp, 255.0 - it.value) }
                val result = processor.process(invertedSignal)
                
                if (result != null) {
                    val map = Arguments.createMap().apply {
                        putInt("heartRateBpm", result.heartRateBpm)
                        putInt("rmssd", result.rmssd)
                        putInt("sdnn", result.sdnn)
                        putInt("stressScore", result.stressScore)
                        putString("stressBand", result.stressBand)
                        putInt("confidence", result.confidence)
                    }
                    emitEvent(EVENT_RESULT, map)
                } else {
                    emitError("signal_noisy", "We couldn't get a clean reading. Please keep your finger still.")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Unhandled exception in signal processing thread", e)
                emitError("processing_error", "An error occurred while calculating your score.")
            }
        }.start()
    }

    private fun emitProgress(phase: String, pct: Int, liveValue: Double = 0.0) {
        if (pct == lastProgressPct && phase == "measuring" && liveValue == 0.0) return
        lastProgressPct = pct
        
        val map = Arguments.createMap().apply {
            putString("phase", phase)
            putInt("progress", pct)
            putDouble("liveValue", liveValue)
        }
        emitEvent(EVENT_PROGRESS, map)
    }
    
    private fun emitError(code: String, message: String) {
        val map = Arguments.createMap().apply {
            putString("code", code)
            putString("message", message)
        }
        emitEvent(EVENT_ERROR, map)
    }

    private fun emitEvent(name: String, params: WritableMap) {
        if (!reactContext.hasActiveReactInstance()) return
        reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(name, params)
    }

    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}

    override fun onCatalystInstanceDestroy() {
        stopScanInternal()
        cameraExecutor.shutdown()
    }
}
