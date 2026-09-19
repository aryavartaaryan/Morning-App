// ─── Cymatics Mode Presets ────────────────────────────────────────────────────
// Pattern vocabulary for the cymatics visualizer (Section 4 of the spec).
// Each preset describes up to 4 Chladni standing-wave modes and rendering params.
//
// Mode: m = angular order (lobe count), k = radial wavenumber,
//        amp = weight, phase = angular offset (radians).

export interface CymaticsMode {
  m: number;      // Angular order: number of repeating units around the center
  k: number;      // Radial wavenumber: controls ring count
  amp: number;    // Amplitude weight (0..1)
  phase: number;  // Phase offset in radians (randomised per preset instance)
}

export interface CymaticsPreset {
  id: string;
  label: string;
  family: 1 | 2 | 3 | 4 | 5 | 0;  // 0 = idle/REST
  modes: CymaticsMode[];   // up to 4 modes
  ringWeight: number;       // 0..1, how strongly the beaded-ring override applies
  complexity: number;       // 0..1, 0=fill blobs, 1=thin ridge lines (filigree)
  ringR0: number;           // radial center of the beaded ring (fraction of R)
  ringWidth: number;        // Gaussian width of the ring (fraction of R)
  // Suggested morph speed in ms (use shorter for energetic transitions)
  morphMs: number;
}

// ── Section 4 presets (m, k, amp; phase is 0 here, randomised at runtime) ────

export const PRESETS: Record<string, CymaticsPreset> = {
  // ── Family 1: Beaded Ring ─────────────────────────────────────────────────
  BEADED_RING: {
    id: 'BEADED_RING',
    label: 'Beaded Ring',
    family: 1,
    modes: [{ m: 24, k: 18, amp: 1.0, phase: 0 }],
    ringWeight: 1.0,
    complexity: 0.10,
    ringR0: 0.56,
    ringWidth: 0.06,
    morphMs: 400,
  },
  BEADED_RING_WIDE: {
    id: 'BEADED_RING_WIDE',
    label: 'Beaded Ring Wide',
    family: 1,
    modes: [
      { m: 22, k: 16, amp: 1.0, phase: 0 },
      { m: 10, k:  9, amp: 0.35, phase: 0 },
    ],
    ringWeight: 0.85,
    complexity: 0.20,
    ringR0: 0.56,
    ringWidth: 0.09,
    morphMs: 450,
  },

  // ── Family 2: Concentric Ripples with Spokes ──────────────────────────────
  RIPPLES_SPOKES: {
    id: 'RIPPLES_SPOKES',
    label: 'Ripples & Spokes',
    family: 2,
    modes: [
      { m:  0, k: 28, amp: 0.9, phase: 0 },
      { m: 14, k: 22, amp: 0.3, phase: 0 },
      { m:  0, k: 14, amp: 0.5, phase: 0 },
    ],
    ringWeight: 0.0,
    complexity: 0.25,
    ringR0: 0.5,
    ringWidth: 0.06,
    morphMs: 500,
  },

  // ── Family 3: Filigree Mandala ────────────────────────────────────────────
  FILIGREE_24: {
    id: 'FILIGREE_24',
    label: 'Filigree 24',
    family: 3,
    modes: [
      { m: 24, k: 30, amp: 0.8, phase: 0 },
      { m: 12, k: 22, amp: 0.6, phase: 0 },
      { m: 36, k: 44, amp: 0.4, phase: 0 },
      { m:  0, k: 18, amp: 0.4, phase: 0 },
    ],
    ringWeight: 0.0,
    complexity: 0.90,
    ringR0: 0.5,
    ringWidth: 0.06,
    morphMs: 300,
  },
  FILIGREE_12: {
    id: 'FILIGREE_12',
    label: 'Filigree 12',
    family: 3,
    modes: [
      { m: 12, k: 26, amp: 0.9, phase: 0 },
      { m: 24, k: 40, amp: 0.5, phase: 0 },
      { m:  6, k: 16, amp: 0.5, phase: 0 },
      { m:  0, k: 24, amp: 0.4, phase: 0 },
    ],
    ringWeight: 0.0,
    complexity: 0.85,
    ringR0: 0.5,
    ringWidth: 0.06,
    morphMs: 300,
  },
  FILIGREE_18: {
    id: 'FILIGREE_18',
    label: 'Filigree 18',
    family: 3,
    modes: [
      { m: 18, k: 28, amp: 0.9, phase: 0 },
      { m: 36, k: 46, amp: 0.4, phase: 0 },
      { m:  9, k: 20, amp: 0.5, phase: 0 },
      { m:  0, k: 30, amp: 0.35, phase: 0 },
    ],
    ringWeight: 0.0,
    complexity: 0.80,
    ringR0: 0.5,
    ringWidth: 0.06,
    morphMs: 320,
  },

  // ── Family 4: Bright Full Disc with Fine Ripples ──────────────────────────
  BRIGHT_DISC: {
    id: 'BRIGHT_DISC',
    label: 'Bright Disc',
    family: 4,
    modes: [
      { m:  0, k: 34, amp: 0.8, phase: 0 },
      { m: 18, k: 26, amp: 0.35, phase: 0 },
      { m:  0, k: 12, amp: 0.5, phase: 0 },
    ],
    ringWeight: 0.0,
    complexity: 0.15,
    ringR0: 0.5,
    ringWidth: 0.06,
    morphMs: 500,
  },

  // ── Idle / REST ───────────────────────────────────────────────────────────
  REST: {
    id: 'REST',
    label: 'Rest',
    family: 0,
    modes: [{ m: 0, k: 6, amp: 0.15, phase: 0 }],
    ringWeight: 0.0,
    complexity: 0.0,
    ringR0: 0.5,
    ringWidth: 0.06,
    morphMs: 800,
  },
};

/** All preset IDs in a convenient ordered list for the Lab preset picker. */
export const PRESET_IDS: string[] = [
  'BEADED_RING',
  'BEADED_RING_WIDE',
  'RIPPLES_SPOKES',
  'BRIGHT_DISC',
  'FILIGREE_12',
  'FILIGREE_18',
  'FILIGREE_24',
  'REST',
];

/**
 * Select the best preset based on audio-derived complexity and energy.
 * Called from useMorphEngine when the target pattern should change.
 */
export function selectPreset(complexity: number, energy: number, isPlaying: boolean): string {
  if (!isPlaying || energy < 0.04) return 'REST';

  if (complexity < 0.18) {
    // Quiet, calm: beaded ring
    return energy < 0.3 ? 'BEADED_RING' : 'BEADED_RING_WIDE';
  }
  if (complexity < 0.35) {
    return 'RIPPLES_SPOKES';
  }
  if (complexity < 0.5) {
    return 'BRIGHT_DISC';
  }
  if (complexity < 0.65) {
    return 'FILIGREE_12';
  }
  if (complexity < 0.80) {
    return 'FILIGREE_18';
  }
  return 'FILIGREE_24';
}
