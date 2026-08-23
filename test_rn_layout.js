const fs = require('fs');
let code = fs.readFileSync('/Users/hotelnamastebharatinn/Desktop/Morning-App/android/app/src/main/java/com/solrize/PpgCameraPreviewManager.kt', 'utf8');
code = code.replace(
    /private val measureAndLayout = Runnable \{[\s\S]*?override fun requestLayout\(\) \{[\s\S]*?\}/,
    `private val measureAndLayout = Runnable {
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
        previewView.layout(0, 0, right - left, bottom - top)
    }`
);
fs.writeFileSync('/Users/hotelnamastebharatinn/Desktop/Morning-App/android/app/src/main/java/com/solrize/PpgCameraPreviewManager.kt', code);
