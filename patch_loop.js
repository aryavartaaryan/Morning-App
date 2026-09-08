const fs = require('fs');
const file = '/Users/hotelnamastebharatinn/Desktop/Morning-App/app/(tabs)/sleep.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /\/\/ ── Ultra-Complex Volumetric Nebula Math[\s\S]*?const plasmaLoop = \(\) => {[\s\S]*?plasmaRing2Ref\.current\?\.setNativeProps[^}]+}[^}]+}[^}]+}[^}]+} catch/m;

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
        } else {
          plasmaPath1Ref.current?.setNativeProps({ d: WAVE_RESTING });
          plasmaPath2Ref.current?.setNativeProps({ d: WAVE_RESTING });
          plasmaPath3Ref.current?.setNativeProps({ d: WAVE_HIDDEN });
          plasmaPath4Ref.current?.setNativeProps({ d: WAVE_HIDDEN });
        }
      } catch`;

content = content.replace(regex, replacement);
fs.writeFileSync(file, content);
