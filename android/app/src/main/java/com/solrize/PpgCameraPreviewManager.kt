package com.solrize

import androidx.camera.view.PreviewView
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext

/**
 * PpgCameraPreviewManager
 *
 * Exposes a native Android CameraX PreviewView to React Native as 'PpgCameraPreview'.
 * When mounted, it registers its SurfaceProvider with PpgScannerModule so the camera
 * session includes a live preview alongside the silent ImageAnalysis stream.
 *
 * Lifecycle:
 *   Mount   → setPreviewSurfaceProvider(view.surfaceProvider)
 *   Unmount → setPreviewSurfaceProvider(null)
 */
class PpgCameraPreviewManager(
    private val reactContext: ReactApplicationContext
) : SimpleViewManager<PreviewView>() {

    override fun getName() = "PpgCameraPreview"

    override fun createViewInstance(context: ThemedReactContext): PreviewView {
        val view = object : PreviewView(context) {
            override fun requestLayout() {
                super.requestLayout()
                post(measureAndLayout)
            }
            private val measureAndLayout = Runnable {
                measure(
                    MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
                    MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY)
                )
                layout(left, top, right, bottom)
            }
        }.apply {
            // COMPATIBLE mode works with all Android GPU configs
            implementationMode = PreviewView.ImplementationMode.COMPATIBLE
            // FILL_CENTER: fills the view, centred, cropping edges
            scaleType = PreviewView.ScaleType.FILL_CENTER
        }
        // Register with the running scanner module
        reactContext
            .getNativeModule(PpgScannerModule::class.java)
            ?.setPreviewSurfaceProvider(view.surfaceProvider)

        return view
    }

    override fun onDropViewInstance(view: PreviewView) {
        reactContext
            .getNativeModule(PpgScannerModule::class.java)
            ?.setPreviewSurfaceProvider(null)
        super.onDropViewInstance(view)
    }
}
