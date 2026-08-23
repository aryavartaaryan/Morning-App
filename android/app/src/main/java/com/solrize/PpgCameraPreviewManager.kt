package com.solrize

import android.content.Context
import android.widget.FrameLayout
import android.view.View.MeasureSpec
import androidx.camera.view.PreviewView
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext

class PpgCameraPreviewWrapper(context: Context) : FrameLayout(context) {
    val previewView = PreviewView(context).apply {
        implementationMode = PreviewView.ImplementationMode.COMPATIBLE
        scaleType = PreviewView.ScaleType.FILL_CENTER
    }

    init {
        val params = FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        )
        addView(previewView, params)
    }

    private val measureAndLayout = Runnable {
        measure(
            MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
            MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY)
        )
        layout(left, top, right, bottom)
    }

    override fun requestLayout() {
        super.requestLayout()
        post(measureAndLayout)
    }

    override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
        super.onLayout(changed, left, top, right, bottom)
        val w = right - left
        val h = bottom - top
        previewView.measure(
            MeasureSpec.makeMeasureSpec(w, MeasureSpec.EXACTLY),
            MeasureSpec.makeMeasureSpec(h, MeasureSpec.EXACTLY)
        )
        previewView.layout(0, 0, w, h)
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        previewView.measure(
            MeasureSpec.makeMeasureSpec(w, MeasureSpec.EXACTLY),
            MeasureSpec.makeMeasureSpec(h, MeasureSpec.EXACTLY)
        )
        previewView.layout(0, 0, w, h)
    }
}

class PpgCameraPreviewManager(
    private val reactContext: ReactApplicationContext
) : SimpleViewManager<PpgCameraPreviewWrapper>() {

    override fun getName() = "PpgCameraPreview"

    override fun createViewInstance(context: ThemedReactContext): PpgCameraPreviewWrapper {
        val wrapper = PpgCameraPreviewWrapper(context)
        
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
