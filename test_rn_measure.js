const fs = require('fs');
let code = fs.readFileSync('/Users/hotelnamastebharatinn/Desktop/Morning-App/android/app/src/main/java/com/solrize/PpgCameraPreviewManager.kt', 'utf8');
code = code.replace(
    /override fun onLayout\(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int\) \{[\s\S]*?previewView.layout\(0, 0, right - left, bottom - top\)[\s\S]*?\}/,
    `override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
        super.onLayout(changed, left, top, right, bottom)
        val w = right - left
        val h = bottom - top
        previewView.measure(
            MeasureSpec.makeMeasureSpec(w, MeasureSpec.EXACTLY),
            MeasureSpec.makeMeasureSpec(h, MeasureSpec.EXACTLY)
        )
        previewView.layout(0, 0, w, h)
    }`
);
fs.writeFileSync('/Users/hotelnamastebharatinn/Desktop/Morning-App/android/app/src/main/java/com/solrize/PpgCameraPreviewManager.kt', code);
