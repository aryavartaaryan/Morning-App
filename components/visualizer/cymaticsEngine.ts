// ─── Cymatics Field Engine ────────────────────────────────────────────────────
// Pure TypeScript math for evaluating the Chladni standing-wave field.
// These functions are designed to be called from a Reanimated worklet OR from
// regular JS (they use no React state, no closures on external refs).
//
// The field model:
//   u(r, θ) = Σᵢ aᵢ · J_mᵢ(kᵢ · r) · cos(mᵢ · (θ + rot) + φᵢ)
// where J_m is the Bessel function of the first kind, approximated by bes().

import type { CymaticsMode } from './cymaticsPresets';

// ─── Bessel approximation (Section 3, Option B) ───────────────────────────────
// Accurate enough for visual Chladni patterns (m = 0..48, x = 0..90).
// For m=0 the formula reduces to a simple oscillating envelope.
'worklet';
export function bes(m: number, x: number): number {
  'worklet';
  const xs = Math.max(x, 0.001);
  const env = 1.0 / Math.sqrt(Math.max(xs, 1.0 + m));
  const ph = xs - m * 1.5707963 - 0.7853982;
  const fall = smoothstepW(0.0, m * 0.8 + 1.0, xs);
  return 1.25 * env * Math.cos(ph) * fall;
}

// Inline smoothstep for worklet contexts (no import overhead in worklet scope)
function smoothstepW(edge0: number, edge1: number, x: number): number {
  'worklet';
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// ─── Single-mode evaluation ────────────────────────────────────────────────────
export function evalMode(mode: CymaticsMode, r: number, theta: number, rot: number): number {
  'worklet';
  return mode.amp * bes(mode.m, mode.k * r) * Math.cos(mode.m * (theta + rot) + mode.phase);
}

// ─── Superposition of up to 4 modes ──────────────────────────────────────────
export function evalField(modes: CymaticsMode[], r: number, theta: number, rot: number): number {
  'worklet';
  let u = 0;
  for (let i = 0; i < modes.length; i++) {
    u += evalMode(modes[i], r, theta, rot);
  }
  return u;
}

// ─── Blend two mode sets A and B by morphFactor (0=A, 1=B) ───────────────────
export function evalBlendedField(
  modesA: CymaticsMode[],
  modesB: CymaticsMode[],
  r: number,
  theta: number,
  rot: number,
  morphFactor: number,
): number {
  'worklet';
  const uA = evalField(modesA, r, theta, rot);
  const uB = evalField(modesB, r, theta, rot);
  return uA + (uB - uA) * morphFactor;
}

// ─── Intensity from field value (Section 2.3) ─────────────────────────────────
// complexity 0 = soft fill blobs; complexity 1 = thin bright ridge lines.
export function fieldToIntensity(u: number, complexity: number, energy: number): number {
  'worklet';
  const gain = 0.9 + 1.6 * energy;
  const fill = Math.pow(Math.max(0, Math.min(1, u * u * gain)), 0.7);
  const w = 0.10 - 0.06 * complexity;  // ridge width: 0.10 at low C, 0.04 at high C
  const ridge = Math.exp(-Math.abs(u) / w);
  return fill + (0.75 * ridge + 0.35 * fill - fill) * complexity;
}

// ─── Beaded-ring override (Family 1) ─────────────────────────────────────────
// A Gaussian ring at radius r0 with cosine lobe modulation.
export function beadedRingIntensity(
  r: number,
  theta: number,
  rot: number,
  m0: number,        // angular order of the ring (number of lobes, e.g. 24)
  r0: number,        // ring center radius (fraction of dish radius R)
  width: number,     // Gaussian width (fraction of R)
  energy: number,
): number {
  'worklet';
  const dr = (r - r0) / width;
  const gauss = Math.exp(-(dr * dr));
  const lobes = 0.65 + 0.35 * Math.cos(m0 * (theta + rot));
  return gauss * lobes * (0.55 + 0.45 * energy);
}

// ─── Onset ripple pulse (expanding outward from center) ───────────────────────
export function onsetRipple(r: number, onsetDecay: number): number {
  'worklet';
  // As onsetDecay goes from 1→0 the ring travels from r=0.2 to r=0.9
  const rRing = 0.2 + 0.7 * (1.0 - onsetDecay);
  const dr = (r - rRing) / 0.06;
  return onsetDecay * Math.exp(-(dr * dr)) * 0.25;
}

// ─── Center rosette (always present) ──────────────────────────────────────────
// A transparent hole at r < 0.018, surrounded by 36 fine radial spokes.
export function rosetteIntensity(r: number, theta: number, energy: number): number {
  'worklet';
  // Smooth inner hole
  const innerFade = smoothstepW(0.018, 0.024, r);
  const outerFade = 1.0 - smoothstepW(0.050, 0.060, r);
  const spokes = 0.5 + 0.5 * Math.cos(36.0 * theta);
  return innerFade * outerFade * spokes * (0.4 + 0.6 * energy);
}

// ─── Outer falloff mask ───────────────────────────────────────────────────────
// Fades the pattern to 0 near the edge (r = 0.86..0.93).
export function outerFalloff(r: number): number {
  'worklet';
  return smoothstepW(0.93, 0.86, r);
}

// ─── Rim intensity (thin translucent ring at r ≈ 0.98–1.0) ──────────────────
// Returns [intensity, specularBoost] where specularBoost lifts the upper-left arc.
export function rimIntensity(r: number, px: number, py: number): number {
  'worklet';
  const inner = smoothstepW(0.975, 0.985, r);
  const outer = 1.0 - smoothstepW(0.995, 1.0, r);
  // Specular: dot product with upper-left direction
  const len = Math.sqrt(px * px + py * py) + 1e-5;
  const nx = px / len;
  const ny = py / len;
  const spec = 0.10 + 0.12 * smoothstepW(0.2, 0.9, -(nx - ny) * 0.7071);
  return inner * outer * spec;
}

// ─── Full pixel evaluation ────────────────────────────────────────────────────
// Combines all sub-formulas into the final intensity (0..1) for a single (r, theta) point.
export function evalPixelIntensity(params: {
  modesA: CymaticsMode[];
  modesB: CymaticsMode[];
  r: number;
  theta: number;
  rot: number;
  morphFactor: number;
  complexity: number;
  ringWeight: number;
  ringM0: number;
  ringR0: number;
  ringWidth: number;
  energy: number;
  onsetDecay: number;
  // px, py are normalised (-1..1) coordinates for rim specular
  px: number;
  py: number;
}): number {
  'worklet';
  const {
    modesA, modesB, r, theta, rot, morphFactor,
    complexity, ringWeight, ringM0, ringR0, ringWidth,
    energy, onsetDecay, px, py,
  } = params;

  if (r > 1.0) return 0;

  // 1. Blended Chladni field
  const u = evalBlendedField(modesA, modesB, r, theta, rot, morphFactor);

  // 2. Core intensity
  let I = fieldToIntensity(u, complexity, energy);

  // 3. Beaded-ring override
  if (ringWeight > 0.01) {
    const ringI = beadedRingIntensity(r, theta, rot, ringM0, ringR0, ringWidth, energy);
    I = I + (ringI - I) * ringWeight;
  }

  // 4. Onset ripple
  if (onsetDecay > 0.01) {
    I += onsetRipple(r, onsetDecay);
  }

  // 5. Center rosette (max blend — always at least as bright as rosette)
  const ros = rosetteIntensity(r, theta, energy);
  I = Math.max(I, ros);

  // 6. Outer falloff
  I *= outerFalloff(r);

  // 7. Clamp
  return Math.max(0, Math.min(1, I));
}

// ─── Polar grid cache ─────────────────────────────────────────────────────────
// Precomputed (r, theta, px, py) for each cell in an N×N grid.
// Build once per quality level; the grid is symmetric so we compute all cells.

export interface PolarCell {
  r: number;
  theta: number;
  px: number;   // normalised x (-1..1)
  py: number;   // normalised y (-1..1)
  inside: boolean;
}

export function buildPolarGrid(N: number): PolarCell[] {
  const cells: PolarCell[] = [];
  for (let row = 0; row < N; row++) {
    for (let col = 0; col < N; col++) {
      // Map cell centre to (-1..1) normalised coords
      const px = (col + 0.5) / N * 2 - 1;
      const py = (row + 0.5) / N * 2 - 1;
      const r = Math.sqrt(px * px + py * py);
      const theta = Math.atan2(py, px);
      cells.push({ r, theta, px, py, inside: r <= 1.0 });
    }
  }
  return cells;
}

// ─── RGBA buffer fill ─────────────────────────────────────────────────────────
// Fills a Uint8ClampedArray in RGBA order (each cell = 4 bytes).
// The PALETTE_LUT is passed in so this function stays pure and worklet-portable.
// Returns the same buffer for chaining / reuse.
export function fillPixelBuffer(
  buffer: Uint8ClampedArray,
  grid: PolarCell[],
  paletteLUT: Uint8Array,
  evalParams: {
    modesA: CymaticsMode[];
    modesB: CymaticsMode[];
    rot: number;
    morphFactor: number;
    complexity: number;
    ringWeight: number;
    ringM0: number;
    ringR0: number;
    ringWidth: number;
    energy: number;
    onsetDecay: number;
  },
  // dither seed (changes each frame to break OLED banding)
  ditherSeed: number,
): Uint8ClampedArray {
  const {
    modesA, modesB, rot, morphFactor,
    complexity, ringWeight, ringM0, ringR0, ringWidth,
    energy, onsetDecay,
  } = evalParams;

  for (let i = 0; i < grid.length; i++) {
    const cell = grid[i];
    const base = i * 4;

    if (!cell.inside) {
      buffer[base] = buffer[base + 1] = buffer[base + 2] = buffer[base + 3] = 0;
      continue;
    }

    const rawI = evalPixelIntensity({
      modesA, modesB,
      r: cell.r, theta: cell.theta,
      px: cell.px, py: cell.py,
      rot, morphFactor,
      complexity, ringWeight,
      ringM0, ringR0, ringWidth,
      energy, onsetDecay,
    });

    // Add ~1% dither noise to break OLED banding
    const noise = (((i * 2654435761 + ditherSeed) >>> 0) & 0xFF) / 255.0 - 0.5;
    const I = Math.max(0, Math.min(1, rawI + noise * 0.01));

    const lutIdx = Math.round(I * 255) * 4;
    buffer[base + 0] = paletteLUT[lutIdx + 0];
    buffer[base + 1] = paletteLUT[lutIdx + 1];
    buffer[base + 2] = paletteLUT[lutIdx + 2];
    buffer[base + 3] = paletteLUT[lutIdx + 3];
  }

  return buffer;
}

// ─── Base64 encoder for Uint8ClampedArray → PNG data URI ─────────────────────
// We build a raw RGBA PNG in JS using the simplest possible approach:
// use a Canvas (not available in RN) → instead we pre-create a minimal PNG header
// and encode with zlib-level-0 (no compression, fastest path in Hermes).
// This avoids any native module dependency.

// Minimal uncompressed PNG encoder.
// Produces a valid RGBA PNG for any N×N grid.
export function encodeRawPNG(data: Uint8ClampedArray, width: number, height: number): string {
  // PNG signature
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];

  // IHDR chunk
  function u32be(n: number): number[] {
    return [(n >>> 24) & 0xFF, (n >>> 16) & 0xFF, (n >>> 8) & 0xFF, n & 0xFF];
  }

  function crc32(buf: number[]): number {
    let c = 0xFFFFFFFF;
    const table = crc32Table();
    for (let i = 0; i < buf.length; i++) {
      c = table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    }
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  // Memoised CRC table
  let _crcTable: number[] | null = null;
  function crc32Table(): number[] {
    if (_crcTable) return _crcTable;
    _crcTable = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      _crcTable.push(c >>> 0);
    }
    return _crcTable;
  }

  function chunk(type: string, payload: number[]): number[] {
    const typeBytes = Array.from(type).map(c => c.charCodeAt(0));
    const body = typeBytes.concat(payload);
    const crc = crc32(body);
    return [...u32be(payload.length), ...typeBytes, ...payload, ...u32be(crc)];
  }

  const ihdr = chunk('IHDR', [
    ...u32be(width), ...u32be(height),
    8,  // bit depth
    6,  // colour type: RGBA
    0, 0, 0,  // compression, filter, interlace
  ]);

  // IDAT: build filter-byte-prefixed scanlines (filter type 0 = None)
  const bytesPerRow = width * 4;
  const rawRows: number[] = [];
  for (let y = 0; y < height; y++) {
    rawRows.push(0); // filter byte: None
    const rowStart = y * bytesPerRow;
    for (let x = 0; x < bytesPerRow; x++) {
      rawRows.push(data[rowStart + x]);
    }
  }

  // Wrap in zlib uncompressed stream (deflate stored blocks)
  // Each block can hold up to 65535 bytes.
  const BLOCK = 65535;
  const nBlocks = Math.ceil(rawRows.length / BLOCK);
  const zlib: number[] = [0x78, 0x01]; // zlib header: deflate, default compression
  for (let b = 0; b < nBlocks; b++) {
    const isFinal = b === nBlocks - 1;
    const start = b * BLOCK;
    const slice = rawRows.slice(start, start + BLOCK);
    const len = slice.length;
    zlib.push(isFinal ? 1 : 0); // BFINAL | BTYPE(00=stored)
    zlib.push(len & 0xFF, (len >>> 8) & 0xFF);
    zlib.push((~len) & 0xFF, ((~len) >>> 8) & 0xFF);
    for (let j = 0; j < slice.length; j++) zlib.push(slice[j]);
  }
  // Adler-32 checksum
  let s1 = 1, s2 = 0;
  for (let i = 0; i < rawRows.length; i++) {
    s1 = (s1 + rawRows[i]) % 65521;
    s2 = (s2 + s1) % 65521;
  }
  zlib.push((s2 >>> 8) & 0xFF, s2 & 0xFF, (s1 >>> 8) & 0xFF, s1 & 0xFF);

  const idat = chunk('IDAT', zlib);
  const iend = chunk('IEND', []);

  const all = [...sig, ...ihdr, ...idat, ...iend];

  // Encode to base64 using Hermes-available btoa
  let binary = '';
  for (let i = 0; i < all.length; i++) {
    binary += String.fromCharCode(all[i]);
  }
  return 'data:image/png;base64,' + btoa(binary);
}
