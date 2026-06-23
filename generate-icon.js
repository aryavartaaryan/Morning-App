#!/usr/bin/env node
// Generates icon.png, adaptive-icon.png, splash-icon.png, favicon.png
// Pure Node.js — zero extra dependencies required.

const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

const SIZE = 1024;
const CX   = SIZE / 2;
const CY   = SIZE / 2;

// Float [0..1] per channel
const fR = new Float32Array(SIZE * SIZE);
const fG = new Float32Array(SIZE * SIZE);
const fB = new Float32Array(SIZE * SIZE);

// Fill background #0A0A0F
for (let i = 0; i < SIZE * SIZE; i++) {
  fR[i] = 10 / 255;
  fG[i] = 10 / 255;
  fB[i] = 15 / 255;
}

// Alpha-over composite onto opaque background
function over(i, sr, sg, sb, sa) {
  if (sa <= 0.0005) return;
  const ia = 1 - sa;
  fR[i] = fR[i] * ia + sr * sa;
  fG[i] = fG[i] * ia + sg * sa;
  fB[i] = fB[i] * ia + sb * sa;
}

// Radial glow from center
function radialGlow(cr, cg, cb, radius, peakAlpha) {
  const x0 = Math.max(0, Math.floor(CX - radius));
  const x1 = Math.min(SIZE - 1, Math.ceil(CX + radius));
  const y0 = Math.max(0, Math.floor(CY - radius));
  const y1 = Math.min(SIZE - 1, Math.ceil(CY + radius));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = Math.sqrt((x - CX) ** 2 + (y - CY) ** 2);
      if (d >= radius) continue;
      const t = 1 - d / radius;
      over(y * SIZE + x, cr, cg, cb, t * t * t * peakAlpha);
    }
  }
}

// Anti-aliased ring with outer glow
function ring(cr, cg, cb, radius, thickness, ringAlpha, glowR, glowPeak) {
  const pad = thickness / 2 + glowR + 2;
  const x0 = Math.max(0, Math.floor(CX - radius - pad));
  const x1 = Math.min(SIZE - 1, Math.ceil(CX + radius + pad));
  const y0 = Math.max(0, Math.floor(CY - radius - pad));
  const y1 = Math.min(SIZE - 1, Math.ceil(CY + radius + pad));

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d   = Math.sqrt((x - CX) ** 2 + (y - CY) ** 2);
      const dR  = Math.abs(d - radius);

      // Outer glow
      if (glowR > 0 && dR < glowR) {
        const t = 1 - dR / glowR;
        over(y * SIZE + x, cr, cg, cb, t * t * glowPeak);
      }

      // Ring body (anti-aliased edge)
      const half = thickness / 2;
      if (dR <= half + 1.0) {
        const aa = dR <= half ? 1.0 : 1.0 - (dR - half);
        over(y * SIZE + x, cr, cg, cb, aa * ringAlpha);
      }
    }
  }
}

// ─── Design ───────────────────────────────────────────────────────────────

// 1. Deep centre warm glow (amber breath)
radialGlow(251/255, 191/255,  36/255, 340, 0.22);
radialGlow(251/255, 191/255,  36/255, 170, 0.18);
radialGlow(255/255, 253/255, 220/255,  85, 0.22);

// 2. Concentric rings — outer → inner, dark amber → pale gold
//    ring(r, g, b,  radius, thickness, alpha,  glowRadius, glowPeak)
ring(120/255,  53/255, 15/255,  455, 3, 0.45,  20, 0.10); // dark rust outer accent
ring(180/255,  83/255,  9/255,  390, 5, 0.65,  28, 0.14); // dark amber
ring(217/255, 119/255,  6/255,  320, 7, 0.78,  34, 0.18); // amber
ring(245/255, 158/255, 11/255,  250, 9, 0.85,  40, 0.22); // golden amber
ring(251/255, 191/255, 36/255,  180,11, 0.92,  46, 0.26); // bright gold  #fbbf24
ring(252/255, 211/255, 77/255,  112,13, 0.96,  52, 0.30); // pale gold    #fcd34d
ring(254/255, 243/255,199/255,   48,36, 0.88,  54, 0.42); // cream centre #fef3c7

// 3. Tiny inner light dot
radialGlow(255/255, 255/255, 230/255, 28, 0.90);

// ─── PNG encoder (pure Node.js / zlib) ───────────────────────────────────

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++)
      crc = crc & 1 ? (crc >>> 1) ^ 0xEDB88320 : crc >>> 1;
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const len  = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t    = Buffer.from(type);
  const crcB = Buffer.alloc(4);
  crcB.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crcB]);
}

function buildPNG(w, h) {
  const sig  = Buffer.from([137,80,78,71,13,10,26,10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB

  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0; // filter: None
    for (let x = 0; x < w; x++) {
      const i   = y * w + x;
      const dst = y * (1 + w * 3) + 1 + x * 3;
      raw[dst]   = Math.min(255, Math.round(fR[i] * 255));
      raw[dst+1] = Math.min(255, Math.round(fG[i] * 255));
      raw[dst+2] = Math.min(255, Math.round(fB[i] * 255));
    }
  }

  const idat = zlib.deflateSync(raw, { level: 6 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ─── Write files ──────────────────────────────────────────────────────────

const png    = buildPNG(SIZE, SIZE);
const assets = path.join(__dirname, 'assets');

const targets = ['icon.png', 'adaptive-icon.png', 'splash-icon.png', 'favicon.png'];
targets.forEach(name => {
  fs.writeFileSync(path.join(assets, name), png);
  console.log(`✅  Written: assets/${name}`);
});

console.log('\n🎨  Icon: 1024×1024 · Dark #0A0A0F · Golden concentric rings');
console.log('🔁  Rebuild with: eas build -p android --profile preview-apk');
