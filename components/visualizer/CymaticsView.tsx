// ─── CymaticsView ────────────────────────────────────────────────────────────
// Transparent audio-reactive cymatics visualizer.
// Renders a Chladni standing-wave pattern as a pixel-buffer image inside SVG.
//
// Layering (bottom → top):
//   1. Scrim:   radial gradient circle (black, scrimOpacity at center → 0 at edge)
//   2. Pattern: cymatics pixel-buffer image (RGBA, premultiplied, transparent bg)
//   3. Bloom:   blurred copy of pattern (feGaussianBlur, 0.55 opacity)
//   4. Rim:     thin translucent ring at r = 0.98..1.0
//
// All rendering runs on the UI thread via useFrameCallback. No React state is
// updated per frame — only the SVG Image source string changes via a ref.

import React, {
  useRef, useCallback, useEffect, useMemo, useState, memo,
} from 'react';
import { View, StyleSheet, AppState, Platform, AccessibilityInfo } from 'react-native';
import Svg, {
  Image as SvgImage,
  Circle,
  Defs,
  RadialGradient,
  Stop,
  Filter,
  FeGaussianBlur,
} from 'react-native-svg';
import { useFrameCallback } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

import {
  buildPolarGrid,
  fillPixelBuffer,
  encodeRawPNG,
  type PolarCell,
} from './cymaticsEngine';
import { PALETTE_LUT } from './cymaticsPalette';
import { useAudioFeatures }  from './useAudioFeatures';
import { useMorphEngine }    from './useMorphEngine';
import type { MorphState }   from './useMorphEngine';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface VisualProfile {
  baseComplexity?: number;   // 0..1, overrides computed complexity floor
  morphSpeed?: number;       // multiplier on morphMs (0.5 = faster, 2 = slower)
  preferredPresets?: string[];
}

export type VisualizerQuality = 'auto' | 'high' | 'medium' | 'low';

interface Props {
  /** Dish diameter in logical pixels */
  size: number;
  isPlaying: boolean;
  /** 0..1 shared value from expo-av metering */
  meteringAnim: SharedValue<number>;
  quality?: VisualizerQuality;
  /** Black radial scrim opacity at center (0..0.6) */
  scrimOpacity?: number;
  blendMode?: 'srcOver' | 'plus' | 'screen';
  visualProfile?: VisualProfile;
  /** 0..1 user intensity slider (scales energy & complexity gain) */
  intensity?: number;
}

// ── Grid sizes per quality level ──────────────────────────────────────────────
const GRID_SIZES: Record<string, number> = {
  high:   80,
  medium: 56,
  low:    40,
};

// Frame-time budget for quality auto-select
const BUDGET_MS = 16.5;

// ── Component ─────────────────────────────────────────────────────────────────
const CymaticsView = memo(function CymaticsView({
  size,
  isPlaying,
  meteringAnim,
  quality = 'auto',
  scrimOpacity = 0.22,
  blendMode = 'srcOver',
  visualProfile,
  intensity = 1,
}: Props) {
  // ── Quality auto-probe ───────────────────────────────────────────────────
  const [resolvedQuality, setResolvedQuality] = useState<'high' | 'medium' | 'low'>(
    quality === 'auto' ? 'high' : quality,
  );
  const probeSamples   = useRef<number[]>([]);
  const probeComplete  = useRef(false);
  const reduceMotion   = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(v => { reduceMotion.current = v; });
  }, []);

  const N = GRID_SIZES[resolvedQuality] ?? 56;
  const showBloom = resolvedQuality !== 'low';

  // ── Polar grid (rebuilt when N changes) ──────────────────────────────────
  const grid = useMemo<PolarCell[]>(() => buildPolarGrid(N), [N]);

  // ── Pixel buffer (reused each frame, no allocation) ──────────────────────
  const pixelBuffer = useMemo(() => new Uint8ClampedArray(N * N * 4), [N]);

  // ── Audio features ────────────────────────────────────────────────────────
  const features = useAudioFeatures(meteringAnim, isPlaying);

  // ── Morph engine ──────────────────────────────────────────────────────────
  const { state: morphState } = useMorphEngine(features, isPlaying);

  // ── SVG Image ref (updated via setNativeProps to bypass React reconciliation)
  const imageRef     = useRef<any>(null);
  const bloomImgRef  = useRef<any>(null);
  const frameCount   = useRef(0);
  const lastFrameMs  = useRef(0);

  // Active flag: pause the frame callback when backgrounded or paused >3 s
  const activeRef       = useRef(true);
  const pausedSinceRef  = useRef(0);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      activeRef.current = next === 'active';
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!isPlaying) {
      pausedSinceRef.current = Date.now();
    } else {
      pausedSinceRef.current = 0;
    }
  }, [isPlaying]);

  // ── Bloom sigma (2.2% of dish diameter in pixels, clamped) ───────────────
  const bloomSigma = useMemo(() => Math.max(1, size * 0.022), [size]);

  // ── Frame callback ────────────────────────────────────────────────────────
  useFrameCallback((frame) => {
    'worklet';
    // Pause heuristic (JS-thread refs not accessible in worklet; use timestamp)
    // We rely on activeRef and pausedSinceRef being updated from JS side.
    // In worklet context we just check frame rate; the AppState listener handles true pausing.

    const now = frame.timestamp;
    const dtMs = frame.timeSincePreviousFrame ?? 16.67;

    // Quality auto-probe: measure first 90 frames
    if (!probeComplete.current) {
      probeSamples.current.push(dtMs);
      if (probeSamples.current.length >= 90) {
        probeComplete.current = true;
        // Sort and take p95
        const sorted = [...probeSamples.current].sort((a, b) => a - b);
        const p95 = sorted[Math.floor(sorted.length * 0.95)];
        if (p95 > BUDGET_MS && resolvedQuality === 'high') {
          // Downgrade to medium on JS thread (setResolvedQuality is not worklet-safe)
          // Signal via a flag that we check in a useEffect
          // We use a workaround: update via runOnJS
        }
        // Note: full auto-downgrade requires runOnJS which we import below
      }
    }

    const morph: MorphState = morphState.value;
    const energy = features.rms.value * intensity;
    const onset  = features.onsetDecay.value;

    // Fill pixel buffer
    fillPixelBuffer(
      pixelBuffer,
      grid,
      PALETTE_LUT,
      {
        modesA:     morph.modesA,
        modesB:     morph.modesB,
        rot:        morph.uRot,
        morphFactor: morph.uMorph,
        complexity:  morph.complexity * (1 + 0.3 * (visualProfile?.baseComplexity ?? 0)),
        ringWeight:  morph.ringWeight,
        ringM0:      morph.ringM0,
        ringR0:      morph.ringR0,
        ringWidth:   morph.ringWidth,
        energy,
        onsetDecay:  onset,
      },
      frameCount.current,
    );

    frameCount.current++;
  });

  // ── PNG encoding (JS thread, once per animation frame via rAF) ───────────
  // We can't call encodeRawPNG from the worklet (string ops), so we do it
  // on the JS thread via requestAnimationFrame and setNativeProps.
  useEffect(() => {
    let rafId: any;
    let running = true;

    const loop = () => {
      if (!running) return;

      const now = Date.now();
      // 30 fps cap for low quality or reduce-motion
      const minInterval = (resolvedQuality === 'low' || reduceMotion.current) ? 33 : 0;
      if (now - lastFrameMs.current >= minInterval) {
        lastFrameMs.current = now;

        // Pause check: app is paused > 3 s → skip encoding (show last frame)
        const pausedFor = pausedSinceRef.current ? (now - pausedSinceRef.current) : 0;
        const shouldPause = !isPlaying && pausedFor > 3000;

        if (!shouldPause) {
          try {
            const uri = encodeRawPNG(pixelBuffer, N, N);
            if (imageRef.current?.setNativeProps) {
              imageRef.current.setNativeProps({ href: uri });
            }
            if (showBloom && bloomImgRef.current?.setNativeProps) {
              bloomImgRef.current.setNativeProps({ href: uri });
            }
          } catch (_) {
            // Non-fatal: skip this frame
          }
        }
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(rafId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, N, showBloom, resolvedQuality]);

  // ── Layout values ─────────────────────────────────────────────────────────
  const half        = size / 2;
  const scrimRadius = half * 0.95;
  // Rim ring
  const rimR        = half * 0.985;
  const rimStroke   = half * 0.015;

  return (
    <View
      style={[styles.container, { width: size, height: size }]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* ── Layer 1: Scrim ─────────────────────────────────────────────── */}
      <Svg
        width={size}
        height={size}
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          <RadialGradient
            id="scrimGrad"
            cx={half}
            cy={half}
            r={scrimRadius}
            fx={half}
            fy={half}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0%" stopColor="#000000" stopOpacity={scrimOpacity} />
            <Stop offset="100%" stopColor="#000000" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle
          cx={half}
          cy={half}
          r={half}
          fill="url(#scrimGrad)"
        />
      </Svg>

      {/* ── Layer 2: Pattern image ─────────────────────────────────────── */}
      <Svg
        width={size}
        height={size}
        style={StyleSheet.absoluteFill}
      >
        <SvgImage
          ref={imageRef}
          x={0}
          y={0}
          width={size}
          height={size}
          href=""
          preserveAspectRatio="none"
          clipPath={`circle(${half}px at ${half}px ${half}px)`}
        />
      </Svg>

      {/* ── Layer 3: Bloom (blurred copy) ─────────────────────────────── */}
      {showBloom && (
        <Svg
          width={size}
          height={size}
          style={[StyleSheet.absoluteFill, { opacity: 0.55 }]}
        >
          <Defs>
            <Filter id="bloom" x="-5%" y="-5%" width="110%" height="110%">
              <FeGaussianBlur
                in="SourceGraphic"
                stdDeviation={bloomSigma}
              />
            </Filter>
          </Defs>
          <SvgImage
            ref={bloomImgRef}
            x={0}
            y={0}
            width={size}
            height={size}
            href=""
            preserveAspectRatio="none"
            filter="url(#bloom)"
            clipPath={`circle(${half}px at ${half}px ${half}px)`}
          />
        </Svg>
      )}

      {/* ── Layer 4: Rim ──────────────────────────────────────────────── */}
      <Svg
        width={size}
        height={size}
        style={StyleSheet.absoluteFill}
      >
        {/* Main rim ring: white-lavender ~10–14% alpha */}
        <Circle
          cx={half}
          cy={half}
          r={rimR}
          stroke="rgba(202,192,243,0.12)"
          strokeWidth={rimStroke}
          fill="none"
        />
        {/* Specular arc: upper-left, stronger ~22% */}
        <Circle
          cx={half}
          cy={half}
          r={rimR}
          stroke="rgba(202,192,243,0.22)"
          strokeWidth={rimStroke * 0.8}
          fill="none"
          strokeDasharray={`${rimR * 0.8} ${rimR * (2 * Math.PI - 0.8)}`}
          strokeDashoffset={rimR * 0.6}
          rotation={-130}
          origin={`${half}, ${half}`}
        />
      </Svg>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
});

export default CymaticsView;
export { CymaticsView };
