const fs = require('fs');
let code = fs.readFileSync('/Users/hotelnamastebharatinn/Desktop/Morning-App/android/app/src/main/java/com/solrize/PpgCameraPreviewManager.kt', 'utf8');

code = code.replace(
  /val view = PreviewView\(context\)\.apply \{/g,
  `val view = object : PreviewView(context) {
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
        }.apply {`
);

fs.writeFileSync('/Users/hotelnamastebharatinn/Desktop/Morning-App/android/app/src/main/java/com/solrize/PpgCameraPreviewManager.kt', code);
