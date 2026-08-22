package com.solrize

import android.Manifest
import android.content.pm.PackageManager
import android.hardware.camera2.CaptureRequest
import android.util.Log
import android.util.Size
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
        const val INTENSITY_THRESHOLD_MIN = 10.0
        const val INTENSITY_THRESHOLD_MAX = 180.0
        
        // Maximum allowed spatial variance across the frame ROI.
        // Finger pressed against lens scatters light evenly (low variance < 400).
        // Walls, floors, or waving hands produce textures/edges (high variance > 1000).
        const val MAX_SPATIAL_VARIANCE = 500.0 
        
        // Maximum allowed temporal variance over a 15-frame window.
        // Stable finger contact has tiny pulse fluctuations.
        // Moving the phone or waving hand causes massive frame-to-frame swings.
        const val MAX_TEMPORAL_VARIANCE = 150.0 
        
        // Hysteresis frames
        const val FRAMES_TO_CANDIDATE = 5
        const val FRAMES_TO_CONFIRM_DETECTED = 15 // 5+10
        const val FRAMES_TO_CONFIRM_LOST = 10
        
        // Durations
        const val WARMUP_DURATION_MS = 10_000L
        const val MEASURE_DURATION_MS = 60_000L
    }

    private var cameraProvider: ProcessCameraProvider? = null
    private val cameraExecutor: ExecutorService = Executors.newSingleThreadExecutor()

    @Volatile private var isRunning = false
    @Volatile private var previewSurfaceProvider: Preview.SurfaceProvider? = null
    
    private var lastFrameTs = 0L
    
    // Main scan state machine
    private enum class State { IDLE, WAITING, WARMUP, MEASURING }
    private var currentState = State.IDLE
    private var stateStartTime = 0L
    
    // Finger detection state machine
    private enum class FingerState { NOT_DETECTED, CANDIDATE, DETECTED }
    private var fingerState = FingerState.NOT_DETECTED
    private var validFrameCount = 0
    private var invalidFrameCount = 0
    private val recentMeans = LinkedList<Double>()
    
    private val signalData = mutableListOf<DataPoint>()
    private var lastProgressPct = -1

    override fun getName() = "PpgScanner"

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

        val future = ProcessCameraProvider.getInstance(reactContext)
        future.addListener({
            try {
                cameraProvider = future.get()
                rebindCamera(activity)
                
                isRunning = true
                currentState = State.WAITING
                
                fingerState = FingerState.NOT_DETECTED
                validFrameCount = 0
                invalidFrameCount = 0
                recentMeans.clear()
                signalData.clear()
                
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("E_CAMERA", e.localizedMessage)
            }
        }, ContextCompat.getMainExecutor(reactContext))
    }

    @ReactMethod
    fun stopScan(promise: Promise) {
        isRunning = false
        currentState = State.IDLE
        try { cameraProvider?.unbindAll() } catch (_: Exception) {}
        promise.resolve(null)
    }

    private fun rebindCamera(activity: android.app.Activity) {
        val analysisBuilder = ImageAnalysis.Builder()
            .setTargetResolution(Size(320, 240))
            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
            .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_YUV_420_888)
            
        // Lock AE, AWB, AF to prevent them from fighting the PPG signal.
        // AF_MODE_OFF additionally ensures the lens stays at a fixed physical focus distance, 
        // acting as a pseudo-proximity lock (Signal 4).
        val ext = Camera2Interop.Extender(analysisBuilder)
        ext.setCaptureRequestOption(CaptureRequest.CONTROL_AE_LOCK, true)
        ext.setCaptureRequestOption(CaptureRequest.CONTROL_AWB_LOCK, true)
        ext.setCaptureRequestOption(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_OFF)

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
        camera?.cameraControl?.enableTorch(true)
    }
    
    data class FrameStats(val mean: Double, val spatialVariance: Double)

    private fun processFrame(proxy: ImageProxy) {
        try {
            val now = System.currentTimeMillis()
            if (!isRunning) return
            
            if (now - lastFrameTs < FRAME_INTERVAL_MS - 5) return 
            lastFrameTs = now

            val stats = extractGreenChannelStats(proxy)
            
            recentMeans.add(stats.mean)
            if (recentMeans.size > 15) recentMeans.removeFirst()
            
            val tMean = recentMeans.average()
            val tVar = if (recentMeans.size > 1) {
                recentMeans.sumOf { (it - tMean).pow(2) } / (recentMeans.size - 1)
            } else 0.0

            // Multi-signal fusion detection logic
            val isIntensityOk = stats.mean in INTENSITY_THRESHOLD_MIN..INTENSITY_THRESHOLD_MAX
            val isSpatialOk = stats.spatialVariance <= MAX_SPATIAL_VARIANCE
            val isTemporalOk = fingerState == FingerState.NOT_DETECTED || tVar <= MAX_TEMPORAL_VARIANCE
            
            val isQualifying = isIntensityOk && isSpatialOk && isTemporalOk
            
            if (isQualifying) {
                invalidFrameCount = 0
                validFrameCount++
                
                if (fingerState == FingerState.NOT_DETECTED && validFrameCount >= FRAMES_TO_CANDIDATE) {
                    fingerState = FingerState.CANDIDATE
                    emitProgress("candidate", 0)
                } else if (fingerState == FingerState.CANDIDATE && validFrameCount >= FRAMES_TO_CONFIRM_DETECTED) {
                    fingerState = FingerState.DETECTED
                    
                    if (currentState == State.WAITING || currentState == State.IDLE) {
                        currentState = State.WARMUP
                        stateStartTime = now
                        signalData.clear()
                    }
                }
            } else {
                validFrameCount = 0
                invalidFrameCount++
                
                if (fingerState != FingerState.NOT_DETECTED && invalidFrameCount >= FRAMES_TO_CONFIRM_LOST) {
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

            // Only collect data if the finger is firmly DETECTED
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
            Log.e(TAG, "Frame error", e)
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

                    // G = Y - 0.344*U - 0.714*V
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
        isRunning = false
        cameraExecutor.shutdown()
        try { cameraProvider?.unbindAll() } catch (_: Exception) {}
    }
}
