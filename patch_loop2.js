const fs = require('fs');
const file = '/Users/hotelnamastebharatinn/Desktop/Morning-App/app/(tabs)/sleep.tsx';
let content = fs.readFileSync(file, 'utf8');

const sIdx = content.indexOf('// ── Ultra-Complex Volumetric Nebula Math');
const eIdx = content.indexOf('// ── 6. SCHEDULE NEXT FRAME');

if (sIdx !== -1 && eIdx !== -1) {
  const replacement = `const plasmaLoop = () => {
      if (cancelled) return;
      try {
        if (isPlayingRef.current && !isPausedRef.current) {
          const v = currentRenderVolRef.current;
          const ph = wavePhaseRef.current;
          const activePath = buildWaveform(v, ph);
          plasmaPath1Ref.current?.setNativeProps({ d: activePath });
          plasmaPath2Ref.current?.setNativeProps({ d: activePath });
          plasmaPath3Ref.current?.setNativeProps({ d: WAVE_HIDDEN });
          plasmaPath4Ref.current?.setNativeProps({ d: WAVE_HIDDEN });
          wavePhaseRef.current += 0.018;
        } else {
          plasmaPath1Ref.current?.setNativeProps({ d: WAVE_RESTING });
          plasmaPath2Ref.current?.setNativeProps({ d: WAVE_RESTING });
          plasmaPath3Ref.current?.setNativeProps({ d: WAVE_HIDDEN });
          plasmaPath4Ref.current?.setNativeProps({ d: WAVE_HIDDEN });
        }
      } catch (_e) {
      }

      `;
  content = content.substring(0, sIdx) + replacement + content.substring(eIdx);
  fs.writeFileSync(file, content);
} else {
  console.log("Not found", sIdx, eIdx);
}
