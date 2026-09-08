const fs = require('fs');
const file = '/Users/hotelnamastebharatinn/Desktop/Morning-App/app/(tabs)/sleep.tsx';
let content = fs.readFileSync(file, 'utf8');

const buildWaveformStr = `
// ── Neon Oscilloscope Waveform Math ──────────────────────────────────────
const buildWaveform = (vol, phase, numPoints = 120) => {
  const CX = 120, CY = 120, RADIUS = 110; 
  const startX = CX - RADIUS;
  const step = (RADIUS * 2) / numPoints;
  let path = "";
  for (let i = 0; i <= numPoints; i++) {
    const x = startX + i * step;
    const nx = (x - CX) / RADIUS; 
    let taper = Math.cos(nx * Math.PI / 2);
    taper = Math.pow(taper, 1.5);
    const w1 = Math.sin(nx * 30 + phase * 2.5);
    const w2 = Math.cos(nx * 45 - phase * 1.8);
    const w3 = Math.sin(nx * 85 + phase * 3.2);
    const noise = (w1 + w2 + w3) / 3;
    const sign = i % 2 === 0 ? 1 : -1;
    const baseAmp = 8;
    const dynamicAmp = 90 * vol; 
    const spike = Math.pow(Math.abs(noise), 1.2) * sign;
    const yOffset = spike * (baseAmp + dynamicAmp) * taper;
    const y = CY + yOffset;
    if (i === 0) path += \`M \${x.toFixed(2)} \${y.toFixed(2)} \`;
    else path += \`L \${x.toFixed(2)} \${y.toFixed(2)} \`;
  }
  return path;
};
const WAVE_RESTING = buildWaveform(0.01, 0);
const WAVE_HIDDEN = 'M 120 120 Z';
`;

content = content.replace("type DurationId = typeof REEL_DURATION_OPTIONS[number]['id'];", "type DurationId = typeof REEL_DURATION_OPTIONS[number]['id'];\n" + buildWaveformStr);

fs.writeFileSync(file, content);
