const fs = require('fs');
const file = '/Users/hotelnamastebharatinn/Desktop/Morning-App/app/(tabs)/sleep.tsx';
let content = fs.readFileSync(file, 'utf8');

const sIdx = content.indexOf('const wakeUp = () => {');
const eIdx = content.indexOf('wavePhaseRef.current += 0.018;');

if (sIdx !== -1 && eIdx !== -1) {
  const replacement = `const wakeUp = () => {
        if (!isPlayingRef.current || isPausedRef.current) return;
        try {
          const ph3 = wavePhaseRef.current;
          const v3 = currentRenderVolRef.current;
          const activePath = buildWaveform(v3, ph3);
          plasmaPath1Ref.current?.setNativeProps({ d: activePath });
          plasmaPath2Ref.current?.setNativeProps({ d: activePath });
          plasmaPath3Ref.current?.setNativeProps({ d: WAVE_HIDDEN });
          plasmaPath4Ref.current?.setNativeProps({ d: WAVE_HIDDEN });
          plasmaRingRef.current?.setNativeProps({ strokeWidth: 1.5, strokeOpacity: 0.8, r: 116 });
          plasmaRing2Ref.current?.setNativeProps({ r: 0 }); // Hide dashed ring
          `;
  content = content.substring(0, sIdx) + replacement + content.substring(eIdx);
  fs.writeFileSync(file, content);
} else {
  console.log("Not found");
}
