// ─── Audio Features Hook ──────────────────────────────────────────────────────
// Maps the expo-av metering shared value (0..1 RMS scalar) to the richer
// AudioFeatures interface required by the morph engine.
//
// Since expo-av provides only RMS loudness (no FFT), we derive:
//   • centroid  — slow LFO sweep (0.23 Hz) simulating spectral brightness
//   • flux      — |Δrms| × 8, smoothed, as a proxy for spectral flux
//   • onset     — spike in flux above adaptive threshold, 120 ms refractory
//   • bands[8]  — rms modulated by 8 different LFO phases for per-band colour
//
// When a real-FFT source is connected in the future, only this file changes.

import React from 'react';
import { useSharedValue, useFrameCallback } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

export interface AudioFeatures {
  /** 0..1 smoothed RMS loudness */
  rms: SharedValue<number>;
  /** 0..1 simulated spectral brightness (slow LFO) */
  centroid: SharedValue<number>;
  /** 0..1 spectral-flux proxy (rate of loudness change) */
  flux: SharedValue<number>;
  /** Rising-edge onset trigger: shared value pulsing 0→1 and decaying to 0 */
  onsetDecay: SharedValue<number>;
  /** 8 log-band energies, approximated from rms + LFO */
  bands: SharedValue<number[]>;
}

/**
 * Derives richer audio features from a single metering shared value.
 *
 * @param meteringAnim  Reanimated shared value (0..1 RMS) updated by expo-av at ~50 ms
 * @param isPlaying     Whether audio is currently playing
 */
export function useAudioFeatures(
  meteringAnim: SharedValue<number>,
  isPlaying: boolean,
): AudioFeatures {
  // ── Derived smoothed values ────────────────────────────────────────────────
  const rms         = useSharedValue(0);
  const centroid    = useSharedValue(0.3);
  const flux        = useSharedValue(0);
  const onsetDecay  = useSharedValue(0);
  const bands       = useSharedValue<number[]>([0, 0, 0, 0, 0, 0, 0, 0]);

  // Internal tracking refs (plain shared values used as mutable refs in worklet)
  const prevRms         = useSharedValue(0);
  const lastOnsetTime   = useSharedValue(0);   // ms timestamp
  const fluxSmoothed    = useSharedValue(0);
  const adaptiveThresh  = useSharedValue(0.12); // adaptive onset threshold

  // Onset refractory period (ms)
  const REFRACTORY_MS = 120;
  // Flux smoothing: attack fast, release slow (one-pole)
  const FLUX_ATTACK  = 0.7;
  const FLUX_RELEASE = 0.12;
  // RMS one-pole smoothing: attack 40 ms @ 60 Hz ≈ α = 0.91
  const RMS_ATTACK   = 0.92;
  // Onset decay speed: decays to ~0 in ~500 ms at 60 fps
  const ONSET_DECAY_RATE = 0.04;

  // Per-isPlaying flag as shared value for worklet access
  const isPlayingSV = useSharedValue(isPlaying);

  // Sync isPlaying changes from React state into the shared value.
  // useDerivedValue can't read plain JS booleans; use useEffect instead.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => { isPlayingSV.value = isPlaying; }, [isPlaying]);

  useFrameCallback((frame) => {
    'worklet';
    const now = frame.timestamp; // ms
    const dt  = frame.timeSincePreviousFrame ?? 16.67; // ms

    // ── RMS smoothing ────────────────────────────────────────────────────────
    const rawRms = meteringAnim.value;
    // One-pole: fast attack, slower release
    const alpha = rawRms > rms.value ? RMS_ATTACK : 0.88;
    const smoothedRms = rms.value * alpha + rawRms * (1 - alpha);
    rms.value = smoothedRms;

    // ── Flux (rate of loudness change) ───────────────────────────────────────
    const delta = Math.abs(smoothedRms - prevRms.value) * 8.0;
    prevRms.value = smoothedRms;
    const fa = delta > fluxSmoothed.value ? FLUX_ATTACK : FLUX_RELEASE;
    fluxSmoothed.value = fluxSmoothed.value * fa + delta * (1 - fa);
    flux.value = Math.min(1, fluxSmoothed.value);

    // ── Adaptive onset detection ─────────────────────────────────────────────
    // Update threshold: slow median approximation (exponential average * 1.6)
    adaptiveThresh.value = adaptiveThresh.value * 0.995 + flux.value * 0.005 * 1.6;
    const thresh = Math.max(0.10, adaptiveThresh.value);
    const timeSinceOnset = now - lastOnsetTime.value;

    if (
      isPlayingSV.value &&
      flux.value > thresh &&
      flux.value > 0.2 &&
      timeSinceOnset > REFRACTORY_MS
    ) {
      onsetDecay.value = 1.0;
      lastOnsetTime.value = now;
    } else {
      // Exponential decay toward 0
      onsetDecay.value = Math.max(0, onsetDecay.value - ONSET_DECAY_RATE * (dt / 16.67));
    }

    // ── Centroid LFO sweep (0.23 Hz) ─────────────────────────────────────────
    // Simulates slow spectral brightness evolution: maps to [0.25..0.75] at rest,
    // boosted by energy for louder moments.
    const t = now * 0.001; // seconds
    const lfoBase = 0.5 + 0.25 * Math.sin(t * 0.23 * 2 * Math.PI);
    centroid.value = lfoBase * (0.6 + 0.4 * smoothedRms);

    // ── Per-band LFO approximation (8 bands) ─────────────────────────────────
    // Each band uses rms × a different phase / frequency multiplier so that
    // different pattern parameters vary independently.
    const b: number[] = [0, 0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 8; i++) {
      const phase = i * 0.785; // 45° spacing
      const freq  = 0.08 + i * 0.04;
      const lfo   = 0.5 + 0.5 * Math.sin(t * freq * 2 * Math.PI + phase);
      b[i] = Math.min(1, smoothedRms * (0.6 + 0.4 * lfo));
    }
    bands.value = b;
  });

  return { rms, centroid, flux, onsetDecay, bands };
}
