const fs = require('fs');
const file = '/Users/hotelnamastebharatinn/Desktop/Morning-App/app/(tabs)/sleep.tsx';
let content = fs.readFileSync(file, 'utf8');

const sIdx = content.indexOf('<Defs>');
const eIdx = content.indexOf('</Svg>');

if (sIdx !== -1 && eIdx !== -1) {
  const replacement = `<Defs>
                <SvgClipPath id="plasmaClip">
                  <SvgCircle cx={120} cy={120} r={118} />
                </SvgClipPath>

                {/* Neon Oscilloscope Gradient: Magenta -> Cyan */}
                <SvgLinearGradient id="neonGradient" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0%" stopColor="#ff00ff" />
                  <Stop offset="50%" stopColor="#a200ff" />
                  <Stop offset="100%" stopColor="#00ffff" />
                </SvgLinearGradient>
              </Defs>

              {/* ── Outer Static Glowing Ring ── */}
              <SvgCircle cx={120} cy={120} r={116} stroke="url(#neonGradient)" strokeWidth={1.5} fill="none" opacity={0.8} />
              <SvgCircle cx={120} cy={120} r={116} stroke="url(#neonGradient)" strokeWidth={6} fill="none" opacity={0.2} />

              {/* ── Center Baseline ── */}
              <G clipPath="url(#plasmaClip)">
                <Path d="M 4 120 L 236 120" stroke="url(#neonGradient)" strokeWidth={1} opacity={0.5} />
              </G>

              {/* ── Dynamic Waveform ── */}
              <Path 
                ref={plasmaPath1Ref} 
                d="M 120 120 Z" 
                stroke="url(#neonGradient)" 
                strokeWidth={2} 
                fill="none" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
              />
              <Path 
                ref={plasmaPath2Ref} 
                d="M 120 120 Z" 
                stroke="url(#neonGradient)" 
                strokeWidth={8} 
                fill="none" 
                opacity={0.3} 
                strokeLinecap="round" 
                strokeLinejoin="round" 
              />
              {/* Keep other refs hidden/empty to avoid crashing old logic */}
              <Path ref={plasmaPath3Ref} d="M 120 120 Z" fill="none" />
              <Path ref={plasmaPath4Ref} d="M 120 120 Z" fill="none" />
              <SvgCircle ref={plasmaRingRef} cx={120} cy={120} r={0} fill="none" />
              <SvgCircle ref={plasmaRing2Ref} cx={120} cy={120} r={0} fill="none" />
            `;
  content = content.substring(0, sIdx) + replacement + content.substring(eIdx);
  fs.writeFileSync(file, content);
  console.log("Replaced successfully!");
} else {
  console.log("Not found");
}
