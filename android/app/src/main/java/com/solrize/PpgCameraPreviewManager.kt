package com.solrize

import android.content.Context
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.camera.view.PreviewView
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext

/**
 * PpgCameraPreviewWrapper — FrameLayout wrapper around CameraX PreviewView.
 *
 * WHY THIS EXISTS:
 * PreviewView is a `final` class — cannot be subclassed.
 * React Native's Yoga layout engine bypasses the Android measure/layout tree
 * (it calls setLeft/Top/Right/Bottom directly) so PreviewView never gets a proper
 * onMeasure() call and remains at 0×0 — which prevents it from allocating a
 * SurfaceTexture, so CameraX binds to a zero-size surface → blank/black output.
 *
 * FIXES APPLIED:
 * 1. Force explicit pixel dimensions at CREATION TIME before Yoga runs, so the
 *    SurfaceProvider is already at a real size when handed to CameraX.
 * 2. Override onLayout / onSizeChanged to re-measure+layout the inner PreviewView
 *    every time Yoga updates the wrapper bounds.
 * 3. Override requestLayout() to post a deferred re-layout so dimensions from
 *    late Yoga passes also propagate.
 *
 * INITIAL SIZE: We use 220×205 dp (the heart bounding box dimensions from the JS
 * layout) so the surface is correctly sized before JS layout completes.
 */
class PpgCameraPreviewWrapper(context: Context) : FrameLayout(context) {

    val previewView: PreviewView = PreviewView(context).apply {
        // COMPATIBLE = TextureView mode. TextureView obeys Android z-ordering so
        // it renders behind the JS SVG overlay views correctly.
        implementationMode = PreviewView.ImplementationMode.COMPATIBLE
        scaleType = PreviewView.ScaleType.FILL_CENTER
    }

    init {
        // Force an immediate real size so the SurfaceProvider is non-zero at creation.
        // 220dp × 205dp matches the heartWrapper dimensions in StressScanner.tsx.
        val density = context.resources.displayMetrics.density
        val initW = (220 * density).toInt().coerceAtLeast(1)
        val initH = (205 * density).toInt().coerceAtLeast(1)

        layoutParams = ViewGroup.LayoutParams(initW, initH)

        addView(previewView, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))

        // Force the inner PreviewView to the same initial size so CameraX gets a
        // non-zero SurfaceRequest immediately.
        previewView.measure(
            View.MeasureSpec.makeMeasureSpec(initW, View.MeasureSpec.EXACTLY),
            View.MeasureSpec.makeMeasureSpec(initH, View.MeasureSpec.EXACTLY)
        )
        previewView.layout(0, 0, initW, initH)
    }

    private fun forcePreviewSize(w: Int, h: Int) {
        if (w <= 0 || h <= 0) return
        previewView.measure(
            View.MeasureSpec.makeMeasureSpec(w, View.MeasureSpec.EXACTLY),
            View.MeasureSpec.makeMeasureSpec(h, View.MeasureSpec.EXACTLY)
        )
        previewView.layout(0, 0, w, h)
    }

    override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
        super.onLayout(changed, left, top, right, bottom)
        forcePreviewSize(right - left, bottom - top)
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        forcePreviewSize(w, h)
    }

    private val applyLayout = Runnable {
        if (width > 0 && height > 0) {
            measure(
                View.MeasureSpec.makeMeasureSpec(width,  View.MeasureSpec.EXACTLY),
                View.MeasureSpec.makeMeasureSpec(height, View.MeasureSpec.EXACTLY)
            )
            layout(left, top, right, bottom)
        }
    }

    override fun requestLayout() {
        super.requestLayout()
        post(applyLayout)
    }
}

class PpgCameraPreviewManager(
    private val reactContext: ReactApplicationContext
) : SimpleViewManager<PpgCameraPreviewWrapper>() {

    override fun getName() = "PpgCameraPreview"

    override fun createViewInstance(context: ThemedReactContext): PpgCameraPreviewWrapper {
        val wrapper = PpgCameraPreviewWrapper(context)
        // Surface provider is already sized correctly (non-zero) in the wrapper's init{}.
        reactContext
            .getNativeModule(PpgScannerModule::class.java)
            ?.setPreviewSurfaceProvider(wrapper.previewView.surfaceProvider)
        return wrapper
    }

    override fun onDropViewInstance(view: PpgCameraPreviewWrapper) {
        reactContext
            .getNativeModule(PpgScannerModule::class.java)
            ?.setPreviewSurfaceProvider(null)
        super.onDropViewInstance(view)
    }
}
