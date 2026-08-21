package com.solrize

import android.Manifest
import android.content.pm.PackageManager
import android.util.Log
import android.util.Size
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.core.UseCase
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * PpgScannerModule — CameraX ImageAnalysis + Preview
 *
 * ImageAnalysis streams raw frames silently:
 *   - NO MediaActionSound (zero shutter click)
 *   - NO preview freeze
 *   - 10 fps → brightness events → JS
 *
 * Preview use case is optional — attached when PpgCameraPreviewManager
 * creates a PreviewView and calls setPreviewSurfaceProvider().
 */
class PpgScannerModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val TAG = "PpgScanner"
        const val EVENT_FRAME = "ppgFrame"
        const val FRAME_INTERVAL_MS = 100L // 10 fps
    }

    private var cameraProvider: ProcessCameraProvider? = null
    private val cameraExecutor: ExecutorService = Executors.newSingleThreadExecutor()

    @Volatile private var isRunning = false
    @Volatile private var previewSurfaceProvider: Preview.SurfaceProvider? = null
    private var lastFrameTs = 0L

    override fun getName() = "PpgScanner"

    // Called by PpgCameraPreviewManager when native PreviewView mounts/unmounts
    fun setPreviewSurfaceProvider(provider: Preview.SurfaceProvider?) {
        previewSurfaceProvider = provider
        // If camera already running, restart to include/exclude preview
        if (isRunning) {
            val activity = reactContext.currentActivity ?: return
            ContextCompat.getMainExecutor(reactContext).execute {
                try { rebindCamera(activity) } catch (e: Exception) {
                    Log.w(TAG, "Rebind after preview attach failed", e)
                }
            }
        }
    }

    // ── Start ─────────────────────────────────────────────────────────────
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
                promise.resolve(null)
                Log.d(TAG, "PPG scanner started (preview=${previewSurfaceProvider != null})")
            } catch (e: Exception) {
                Log.e(TAG, "Start failed", e)
                promise.reject("E_CAMERA", e.localizedMessage)
            }
        }, ContextCompat.getMainExecutor(reactContext))
    }

    // ── Stop ──────────────────────────────────────────────────────────────
    @ReactMethod
    fun stopScan(promise: Promise) {
        isRunning = false
        try { cameraProvider?.unbindAll() } catch (_: Exception) {}
        promise.resolve(null)
        Log.d(TAG, "PPG scanner stopped")
    }

    // ── Bind camera use cases (Preview + ImageAnalysis) ───────────────────
    private fun rebindCamera(activity: android.app.Activity) {
        // Silent ImageAnalysis — no MediaActionSound ever
        val analysis = ImageAnalysis.Builder()
            .setTargetResolution(Size(320, 240))
            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
            .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_YUV_420_888)
            .build()
        analysis.setAnalyzer(cameraExecutor) { proxy -> processFrame(proxy) }

        val useCases = mutableListOf<UseCase>(analysis)

        // Attach Preview use case if a PreviewView surface is available
        previewSurfaceProvider?.let { provider ->
            val preview = Preview.Builder().build()
            preview.setSurfaceProvider(provider)
            useCases.add(0, preview) // Preview first
        }

        cameraProvider?.unbindAll()
        val camera = cameraProvider?.bindToLifecycle(
            activity as LifecycleOwner,
            CameraSelector.DEFAULT_BACK_CAMERA,
            *useCases.toTypedArray()
        )
        camera?.cameraControl?.enableTorch(true)
    }

    // ── Frame analysis ────────────────────────────────────────────────────
    private fun processFrame(proxy: ImageProxy) {
        try {
            val now = System.currentTimeMillis()
            if (!isRunning || now - lastFrameTs < FRAME_INTERVAL_MS) return
            lastFrameTs = now
            val brightness = avgCenterBrightness(proxy)
            emitFrame(brightness, now)
        } catch (e: Exception) {
            Log.w(TAG, "Frame analysis error", e)
        } finally {
            proxy.close()
        }
    }

    /**
     * Average Y (luminance) of centre 80×80 pixels, sampled every 2nd pixel.
     *
     * CORRECTED PHYSICS:
     *   Torch ON, no finger: torch light reflects straight off glass lens → sensor OVEREXPOSED → Y ≈ 220–255
     *   Torch ON, finger ON: tissue+blood absorbs & scatters light → Y drops to ≈ 60–155
     *   Heartbeat: extra blood volume in fingertip → brief extra absorption → Y dips slightly
     *
     * So: LOW Y = finger present. HIGH Y = no finger (bare lens overexposed).
     */
    private fun avgCenterBrightness(proxy: ImageProxy): Double {
        val plane     = proxy.planes[0]
        val rowStride = plane.rowStride
        val pixStride = plane.pixelStride
        val buf       = plane.buffer
        val bytes     = ByteArray(buf.remaining()).also { buf.get(it) }

        val cx = proxy.width  / 2
        val cy = proxy.height / 2
        val r  = 40  // 80×80 centre region → more pixels → better SNR

        var sum = 0L; var count = 0
        var y = maxOf(0, cy - r)
        while (y <= minOf(proxy.height - 1, cy + r)) {
            var x = maxOf(0, cx - r)
            while (x <= minOf(proxy.width - 1, cx + r)) {
                val idx = y * rowStride + x * pixStride
                if (idx < bytes.size) { sum += (bytes[idx].toInt() and 0xFF); count++ }
                x += 2
            }
            y += 2
        }
        return if (count > 0) sum.toDouble() / count else 0.0
    }

    private fun emitFrame(brightness: Double, timestamp: Long) {
        if (!reactContext.hasActiveReactInstance()) return
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(EVENT_FRAME, Arguments.createMap().apply {
                putDouble("brightness", brightness)
                putDouble("timestamp", timestamp.toDouble())
            })
    }

    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}

    override fun onCatalystInstanceDestroy() {
        isRunning = false
        cameraExecutor.shutdown()
        try { cameraProvider?.unbindAll() } catch (_: Exception) {}
    }
}
