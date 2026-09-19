// ─── Morph Engine ─────────────────────────────────────────────────────────────
// Manages two mode-sets A and B plus a cross-fade uMorph (0→1).
// Drives preset selection from audio features, with hysteresis and
// spring-damped smoothing so nothing pops.
//
// Preset switching rules:
//   • Compute target preset from (complexity, energy) using selectPreset().
//   • Only commit when the same target has been stable for ≥ 120 ms (hysteresis).
//   • Do not start a new morph while uMorph < 0.7, UNLESS a strong onset arrives.
//   • uMorph animates 0→1 with duration from the target preset's morphMs.
//   • After morph completes, copy B → A and reset uMorph=0 for the next transition.

import { useSharedValue, useFrameCallback, withTiming, Easing } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { PRESETS, selectPreset, type CymaticsPreset, type CymaticsMode } from './cymaticsPresets';
import type { AudioFeatures } from './useAudioFeatures';

// How many modes we support per set (A and B)
const MAX_MODES = 4;

// Padding mode for when a preset has fewer than MAX_MODES modes
const NULL_MODE: CymaticsMode = { m: 0, k: 1, amp: 0, phase: 0 };

function padModes(modes: CymaticsMode[]): CymaticsMode[] {
  const out = [...modes];
  while (out.length < MAX_MODES) out.push(NULL_MODE);
  return out.slice(0, MAX_MODES);
}

/** Add small random walk to a mode's phase and k to prevent freezing. */
function jitterMode(mode: CymaticsMode, frame: number): CymaticsMode {
  'worklet';
  const t = frame * 0.016; // seconds
  const phaseWalk = Math.sin(t * 0.3 * 2 * Math.PI + mode.m * 0.1) * 0.05;
  const kWalk = 1.0 + Math.sin(t * 0.31 * 2 * Math.PI + mode.k * 0.07) * 0.03;
  return { ...mode, phase: mode.phase + phaseWalk, k: mode.k * kWalk };
}

export interface MorphState {
  modesA: CymaticsMode[];
  modesB: CymaticsMode[];
  uMorph: number;
  complexity: number;
  ringWeight: number;
  ringM0: number;
  ringR0: number;
  ringWidth: number;
  uRot: number;
  currentPresetId: string;
}

export interface MorphEngine {
  /** Live morph state shared value — read each frame to drive the renderer */
  state: SharedValue<MorphState>;
  /** Manually force a preset (used by Visualizer Lab) */
  forcePreset: (id: string) => void;
  /** Current preset ID as a JS-readable shared value (for lab UI) */
  currentPresetId: SharedValue<string>;
}

export function useMorphEngine(
  features: AudioFeatures,
  isPlaying: boolean,
): MorphEngine {
  const REST = PRESETS['REST'];
  const initialModes = padModes(REST.modes);

  const state = useSharedValue<MorphState>({
    modesA: initialModes,
    modesB: initialModes,
    uMorph: 0,
    complexity: 0,
    ringWeight: 0,
    ringM0: 0,
    ringR0: REST.ringR0,
    ringWidth: REST.ringWidth,
    uRot: 0,
    currentPresetId: 'REST',
  });

  const currentPresetId = useSharedValue('REST');

  // Worklet-accessible tracking state
  const pendingPresetId       = useSharedValue('REST');
  const pendingStableMs       = useSharedValue(0);
  const lastPresetChangeTime  = useSharedValue(0);
  const frameCount            = useSharedValue(0);
  const isMorphing            = useSharedValue(false);
  const morphStartTime        = useSharedValue(0);
  const morphDurationMs       = useSharedValue(400);
  const isPlayingSV           = useSharedValue(isPlaying);
  const forcedPresetId        = useSharedValue('');

  // Sync isPlaying into shared value
  // isPlayingSV is updated in the render path (line near return statement).
  // This ensures the worklet sees the latest isPlaying value each render cycle.

  useFrameCallback((frame) => {
    'worklet';
    const now = frame.timestamp;
    const dt  = frame.timeSincePreviousFrame ?? 16.67;
    frameCount.value++;

    const fc = frameCount.value;
    const cur = state.value;

    // ── Energy and complexity from audio features ──────────────────────────
    const energy     = features.rms.value;
    const centroid   = features.centroid.value;
    const fluxVal    = features.flux.value;
    const onset      = features.onsetDecay.value > 0.8;

    // Complexity formula from spec 5.3:
    // C = clamp(0.5*centroid + 0.3*flux + 0.4*rms - 0.15, 0, 1)
    const rawC = 0.5 * centroid + 0.3 * fluxVal + 0.4 * energy - 0.15;
    const targetC = Math.max(0, Math.min(1, rawC));
    // Smooth complexity with one-pole (slower, 400 ms time constant at 60 fps ≈ α=0.96)
    const C = cur.complexity * 0.96 + targetC * 0.04;

    // Ring weight formula: (1-C)^1.5 * boosted at low energy
    const pitchedness = 0.6; // fixed (no real pitch detection)
    const targetRW = Math.pow(Math.max(0, 1 - C), 1.5) * pitchedness;
    const ringWeight = cur.ringWeight * 0.96 + targetRW * 0.04;

    // ── Rotation ──────────────────────────────────────────────────────────
    // uRot += dt * (0.02 + 0.06 * energy) rad/s
    const rotSpeed = (0.02 + 0.06 * energy) / 1000; // per ms
    const uRot = cur.uRot + rotSpeed * dt;

    // ── Preset selection with hysteresis ──────────────────────────────────
    const targetId = forcedPresetId.value
      ? forcedPresetId.value
      : selectPreset(C, energy, isPlayingSV.value);

    if (targetId !== pendingPresetId.value) {
      pendingPresetId.value   = targetId;
      pendingStableMs.value   = now;
    }
    const stableFor = now - pendingStableMs.value;

    // Only start a morph when:
    //   • Target has been stable ≥ 120 ms
    //   • We're not mid-morph (uMorph < 0.7), UNLESS a strong onset arrives
    const canMorph =
      stableFor >= 120 &&
      targetId !== cur.currentPresetId &&
      (!isMorphing.value || isMorphing.value && onset);

    // ── Morph progress ───────────────────────────────────────────────────
    let uMorph = cur.uMorph;
    let modesA = cur.modesA;
    let modesB = cur.modesB;
    let curPresetId = cur.currentPresetId;

    if (isMorphing.value) {
      const elapsed = now - morphStartTime.value;
      const progress = Math.min(1, elapsed / morphDurationMs.value);
      // easeInOutCubic
      uMorph = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      if (uMorph >= 1) {
        // Morph complete: promote B → A
        uMorph         = 0;
        modesA         = modesB;
        curPresetId    = pendingPresetId.value;
        isMorphing.value = false;
        currentPresetId.value = curPresetId;
      }
    }

    if (!isMorphing.value && canMorph) {
      // Start a new morph: current blended state → target
      const targetPreset: CymaticsPreset = PRESETS[targetId] ?? PRESETS['REST'];
      // A = current blended (freeze the blend at current uMorph)
      modesA = modesB; // B was the new target from last morph; promote to A
      modesB = padModes(targetPreset.modes);
      // Add random phase offsets to B for freshness
      const phaseOffset = (fc * 0.37) % (2 * Math.PI);
      modesB = modesB.map((m, idx) => ({
        ...m,
        phase: m.phase + phaseOffset * (idx + 1) * 0.5,
      }));
      uMorph = 0;
      isMorphing.value       = true;
      morphStartTime.value   = now;
      morphDurationMs.value  = onset ? 250 : (PRESETS[targetId]?.morphMs ?? 400);
    }

    // ── Lobe breathing shimmer (±10% lobe brightness via phase jitter) ────
    const shimmerA = modesA.map(m => jitterMode(m, fc));
    const shimmerB = modesB.map(m => jitterMode(m, fc));

    // ── Ring parameters from current preset A ─────────────────────────────
    const presetA: CymaticsPreset = PRESETS[curPresetId] ?? PRESETS['REST'];
    const ringM0   = presetA.modes[0]?.m ?? 24;
    const ringR0   = presetA.ringR0;
    const ringWidth = presetA.ringWidth;

    state.value = {
      modesA: shimmerA,
      modesB: shimmerB,
      uMorph,
      complexity: C,
      ringWeight,
      ringM0,
      ringR0,
      ringWidth,
      uRot,
      currentPresetId: curPresetId,
    };
  });

  const forcePreset = (id: string) => {
    forcedPresetId.value = id;
    // Clear after 10 s so auto-mode resumes
    setTimeout(() => { forcedPresetId.value = ''; }, 10_000);
  };

  // Expose isPlaying to the worklet via a sync mechanism
  // We update the shared value from React when isPlaying changes
  isPlayingSV.value = isPlaying;

  return { state, forcePreset, currentPresetId };
}
