const fs = require('fs');
let code = fs.readFileSync('/Users/hotelnamastebharatinn/Desktop/Morning-App/android/app/src/main/java/com/solrize/PpgCameraPreviewManager.kt', 'utf8');

code = code.replace(
  /val view = object : PreviewView\(context\) \{[\s\S]*?\}\.apply \{/g,
  `val view = PreviewView(context).apply {`
);

fs.writeFileSync('/Users/hotelnamastebharatinn/Desktop/Morning-App/android/app/src/main/java/com/solrize/PpgCameraPreviewManager.kt', code);
