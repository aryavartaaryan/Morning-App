const fs = require('fs');
let code = fs.readFileSync('/Users/hotelnamastebharatinn/Desktop/Morning-App/components/StressScanner.tsx', 'utf8');

// Update Modal animationType from "none" to "slide"
code = code.replace(
  /<Modal visible=\{visible\} transparent animationType="none" onRequestClose=\{handleClose\}>/,
  `<Modal visible={visible} transparent={false} animationType="slide" onRequestClose={handleClose}>`
);

// Remove the backdrop view
code = code.replace(
  /<Animated\.View style=\{\[S\.backdrop, \{ opacity: fadeAnim \}\]\} \/>/,
  ``
);

// Update StyleSheet
code = code.replace(
  /container: \{ flex: 1, justifyContent: 'flex-end' \},/,
  `container: { flex: 1, backgroundColor: '#000' },`
);

code = code.replace(
  /sheet: \{ backgroundColor: '#111', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, height: '90%' \},/,
  `sheet: { flex: 1, backgroundColor: '#000', paddingTop: 60, paddingHorizontal: 24, paddingBottom: 40 },`
);

fs.writeFileSync('/Users/hotelnamastebharatinn/Desktop/Morning-App/components/StressScanner.tsx', code);
