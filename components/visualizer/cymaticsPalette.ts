// ─── Cymatics Color Palette ───────────────────────────────────────────────────
// Periwinkle → lavender-white color ramp from the spec (Section 1.2).
// Encodes a 256-entry LUT: index is intensity I * 255, value is [r, g, b, a]
// all in 0..255. Built once at module load; colorize() is then O(1).

// The 10 control stops from the spec:
// I      sRGB hex   alpha
// 0.00  #181439    0.00
// 0.12  #2A2870    0.25
// 0.25  #373873    0.45
// 0.38  #4A488D    0.60
// 0.50  #525B9E    0.72
// 0.62  #737CBF    0.82
// 0.74  #959DD2    0.90
// 0.86  #A7B5E0    0.95
// 0.95  #BBC2DC    1.00
// 1.00  #CAC0F3    1.00

type Stop = [r: number, g: number, b: number, a: number];

// Control stops [r,g,b 0..255, a 0..255]
const STOPS: Array<{ t: number; rgba: Stop }> = [
  { t: 0.00, rgba: [0x18, 0x14, 0x39, 0] },
  { t: 0.12, rgba: [0x2A, 0x28, 0x70, 64] },
  { t: 0.25, rgba: [0x37, 0x38, 0x73, 115] },
  { t: 0.38, rgba: [0x4A, 0x48, 0x8D, 153] },
  { t: 0.50, rgba: [0x52, 0x5B, 0x9E, 184] },
  { t: 0.62, rgba: [0x73, 0x7C, 0xBF, 209] },
  { t: 0.74, rgba: [0x95, 0x9D, 0xD2, 230] },
  { t: 0.86, rgba: [0xA7, 0xB5, 0xE0, 242] },
  { t: 0.95, rgba: [0xBB, 0xC2, 0xDC, 255] },
  { t: 1.00, rgba: [0xCA, 0xC0, 0xF3, 255] },
];

/** Smoothstep: 0 when t<=0, 1 when t>=1, smooth in between. */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Interpolate one channel between two stops using smoothstep. */
function lerpStop(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

/** Build the 256-entry LUT. */
function buildLUT(): Uint8Array {
  // 4 bytes per entry: R, G, B, A (premultiplied)
  const lut = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    const I = i / 255;
    // Find which segment this I falls in
    let lo = STOPS[0];
    let hi = STOPS[STOPS.length - 1];
    for (let s = 0; s < STOPS.length - 1; s++) {
      if (I >= STOPS[s].t && I <= STOPS[s + 1].t) {
        lo = STOPS[s];
        hi = STOPS[s + 1];
        break;
      }
    }
    const segLen = hi.t - lo.t;
    const raw = segLen < 1e-6 ? 0 : (I - lo.t) / segLen;
    const t = raw * raw * (3 - 2 * raw); // smoothstep within segment

    const r = lerpStop(lo.rgba[0], hi.rgba[0], t);
    const g = lerpStop(lo.rgba[1], hi.rgba[1], t);
    const b = lerpStop(lo.rgba[2], hi.rgba[2], t);
    const a = lerpStop(lo.rgba[3], hi.rgba[3], t);

    // Premultiply: rgb * (a/255)
    const af = a / 255;
    lut[i * 4 + 0] = Math.round(r * af);
    lut[i * 4 + 1] = Math.round(g * af);
    lut[i * 4 + 2] = Math.round(b * af);
    lut[i * 4 + 3] = a;
  }
  return lut;
}

export const PALETTE_LUT: Uint8Array = buildLUT();

/**
 * Sample the palette for intensity I (0..1).
 * Returns premultiplied [r, g, b, a] each in 0..255.
 * This function is NOT worklet-safe (it uses module-level state);
 * call it on the JS thread to build a color string, or pre-encode in the buffer.
 */
export function colorize(I: number): [number, number, number, number] {
  const idx = Math.max(0, Math.min(255, Math.round(I * 255)));
  const base = idx * 4;
  return [
    PALETTE_LUT[base],
    PALETTE_LUT[base + 1],
    PALETTE_LUT[base + 2],
    PALETTE_LUT[base + 3],
  ];
}

/**
 * Returns a CSS rgba() string for intensity I (0..1), NON-premultiplied,
 * suitable for SVG fill attributes.
 */
export function colorizeCSS(I: number): string {
  const idx = Math.max(0, Math.min(255, Math.round(I * 255)));
  const base = idx * 4;
  const a = PALETTE_LUT[base + 3] / 255;
  if (a < 0.004) return 'transparent';
  // Reverse premultiply for CSS display
  const af = a > 0 ? 1 / a : 0;
  const r = Math.min(255, Math.round(PALETTE_LUT[base + 0] * af));
  const g = Math.min(255, Math.round(PALETTE_LUT[base + 1] * af));
  const b = Math.min(255, Math.round(PALETTE_LUT[base + 2] * af));
  return `rgba(${r},${g},${b},${a.toFixed(3)})`;
}
