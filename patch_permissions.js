const fs = require('fs');
let code = fs.readFileSync('/Users/hotelnamastebharatinn/Desktop/Morning-App/components/StressScanner.tsx', 'utf8');

code = code.replace(
  /const beginScan = useCallback\(async \(\) => \{[\s\S]*?go\('waiting'\);\n    progListener\.current =/,
  `const beginScan = useCallback(async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          go('noperm');
          return;
        }
      } catch (err) {
        console.warn(err);
      }
    }
    go('waiting');
    progListener.current =`
);

if (!code.includes('PermissionsAndroid')) {
  code = code.replace(
    /import \{\s*View,\s*Text,/,
    `import { View, Text, PermissionsAndroid,`
  );
}

fs.writeFileSync('/Users/hotelnamastebharatinn/Desktop/Morning-App/components/StressScanner.tsx', code);
