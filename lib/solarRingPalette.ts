import { getSunElevation, type SolarTimes } from '@/lib/solar';

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function lerpColor(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const bv = Math.round(b1 + (b2 - b1) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bv.toString(16).padStart(2, '0')}`;
}

export type AyurvedicPalette = { ring: string; halo: string; accent: string };

export type SacredHourType = 'sunrise' | 'sunset' | 'zenith' | null;
export function getSacredHourInfo(nowH: number, solar?: SolarTimes | null): {
  type: SacredHourType;
  progress: number;
} {
  if (!solar) return { type: null, progress: 0 };
  const WIN = 15 / 60;
  const sr  = solar.sunrise;
  const ss  = solar.sunset;
  const sn  = solar.solarNoon;
  const dSr = nowH - sr;
  const dSs = nowH - ss;
  const dSn = nowH - sn;
  if (dSr >= -WIN && dSr <= WIN) {
    return { type: 'sunrise', progress: (dSr + WIN) / (2 * WIN) };
  }
  if (dSs >= -WIN && dSs <= WIN) {
    return { type: 'sunset',  progress: (dSs + WIN) / (2 * WIN) };
  }
  if (dSn >= -20/60 && dSn <= 2/60) {
    return { type: 'zenith',  progress: (dSn + 20/60) / (22/60) };
  }
  return { type: null, progress: 0 };
}

const COOLING_BLUE_PALETTE: AyurvedicPalette = { ring: '#00BFFF', halo: '#00E5FF', accent: '#80FFFF' };

function blendPalette(a: AyurvedicPalette, b: AyurvedicPalette, t: number): AyurvedicPalette {
  return {
    ring:   lerpColor(a.ring,   b.ring,   t),
    halo:   lerpColor(a.halo,   b.halo,   t),
    accent: lerpColor(a.accent, b.accent, t),
  };
}

const SUNRISE_PALETTES: Array<AyurvedicPalette> = [
  { ring: '#1E3A8A', halo: '#2563EB', accent: '#93C5FD' },
  { ring: '#DC2626', halo: '#EA580C', accent: '#FCA5A5' },
  { ring: '#D97706', halo: '#F59E0B', accent: '#FDE68A' },
];
const SUNSET_PALETTES: Array<AyurvedicPalette> = [
  { ring: '#D97706', halo: '#F59E0B', accent: '#FDE68A' },
  { ring: '#C2410C', halo: '#EA580C', accent: '#FCA5A5' },
  { ring: '#C2410C', halo: '#EA580C', accent: '#FCA5A5' },
];
const ZENITH_PALETTES: Array<AyurvedicPalette> = [
  { ring: '#FDE047', halo: '#FEF08A', accent: '#FEF9C3' },
  { ring: '#F59E0B', halo: '#FBBF24', accent: '#FDE68A' },
  { ring: '#FDE047', halo: '#FEF08A', accent: '#FEF9C3' },
];

function lerpPalette(palettes: Array<AyurvedicPalette>, t: number): AyurvedicPalette {
  const n = palettes.length - 1;
  const idx = Math.min(n - 1, Math.floor(t * n));
  const frac = (t * n) - idx;
  const a = palettes[idx];
  const b = palettes[idx + 1];
  return {
    ring:   lerpColor(a.ring,   b.ring,   frac),
    halo:   lerpColor(a.halo,   b.halo,   frac),
    accent: lerpColor(a.accent, b.accent, frac),
  };
}

const DAY_PALETTES: Array<AyurvedicPalette> = [
  { ring: '#92400E', halo: '#B45309', accent: '#FCD34D' },
  { ring: '#B45309', halo: '#D97706', accent: '#FDE68A' },
  { ring: '#D97706', halo: '#F59E0B', accent: '#FEF3C7' },
  { ring: '#F59E0B', halo: '#FBBF24', accent: '#FFFDE0' },
  { ring: '#FBBF24', halo: '#FDE68A', accent: '#FFFFFF' },
];

const TRUE_SILVER: AyurvedicPalette = { ring: '#E2E8F0', halo: '#F1F5F9', accent: '#FFFFFF' };
const BRAHMA_PALETTE: AyurvedicPalette = { ring: '#567898', halo: '#6A8CAC', accent: '#94B0C8' };

export function isAfterSunset(nowH: number, solar?: SolarTimes | null): boolean {
  if (!solar) return nowH >= 19 || nowH < 6;
  return nowH > solar.sunset || nowH < solar.sunrise;
}

export function getSolarRingPalette(
  nowH: number,
  solarNoon: number,
  solar?: SolarTimes | null,
  lat?: number | null,
  lon?: number | null,
  brahmaActive?: boolean,
  temp?: number | null,
): AyurvedicPalette {
  const sacred = getSacredHourInfo(nowH, solar);
  if (sacred.type === 'sunrise') return lerpPalette(SUNRISE_PALETTES, sacred.progress);
  if (sacred.type === 'sunset')  return lerpPalette(SUNSET_PALETTES,  sacred.progress);
  if (sacred.type === 'zenith')  return lerpPalette(ZENITH_PALETTES,  sacred.progress);

  let elevation: number;
  if (lat != null && lon != null) {
    elevation = getSunElevation(lat, lon);
  } else if (solar) {
    const sr = solar.sunrise;
    const ss = solar.sunset;
    const dayLen = ss - sr;
    if (nowH < sr || nowH > ss) {
      const distFromHorizon = nowH < sr ? sr - nowH : nowH - ss;
      elevation = -Math.min(18, distFromHorizon * 4);
    } else {
      const fracDay = (nowH - sr) / dayLen;
      elevation = Math.sin(fracDay * Math.PI) * 65;
    }
  } else {
    const fracDay = (nowH - 6) / 12;
    if (fracDay <= 0 || fracDay >= 1) {
      elevation = -10;
    } else {
      elevation = Math.sin(fracDay * Math.PI) * 60;
    }
  }

  let basePalette: AyurvedicPalette;
  if (elevation <= 0) {
    if (brahmaActive) {
      basePalette = BRAHMA_PALETTE;
    } else {
      basePalette = TRUE_SILVER;
    }
  } else {
    const height = Math.min(1, elevation / 55);
    basePalette = lerpPalette(DAY_PALETTES, height);
  }

  if (temp != null && temp > 20) {
    const blendFactor = Math.min(1, Math.max(0, (temp - 20) / 15));
    return blendPalette(basePalette, COOLING_BLUE_PALETTE, blendFactor);
  }

  return basePalette;
}
