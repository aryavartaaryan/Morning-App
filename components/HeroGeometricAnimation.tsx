import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, Easing } from 'react-native';
import Svg, {
  Circle as SvgCircle, Path as SvgPath, G as SvgG, G,
  Defs, RadialGradient as SvgRadialGradient, LinearGradient, Stop, Ellipse, Line as SvgLine,
} from 'react-native-svg';

// ── Utility ───────────────────────────────────────────────────────────────────
function pts(cx: number, cy: number, r: number, n: number, offset = 0) {
  return Array.from({ length: n }, (_, i) => {
    const a = offset + (i * Math.PI * 2) / n;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
}
function poly(points: { x: number; y: number }[], close = true) {
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
  return close ? d + ' Z' : d;
}

// ─────────────────────────────────────────────────────────────────────────────
// HeroGeometricAnimation
//
// variant = 'home'   → palette-driven solar/dosha sacred geometry.
//                      Colors inherit from accentColor prop.
//                      Subtle breath (0.96→1.04). Fits inside the hero ring.
//
// variant = 'sound'  → Resonance / acoustic deep environment.
//                      Concentric waveform rings, mandala breathing with sound.
//                      Colors: deep teals, purples, bioluminescent — accent-matched.
//                      Ultra-slow, meditative. Dark surrounding zone.
//
// variant = 'splash' → Cosmic / galactic awakening.
//                      All shapes layered simultaneously (not just one at a time).
//                      Stardust spirals, deep indigo-white brand palette.
//                      Larger breath, dramatic rotations. Universe being born.
//
// 100% useNativeDriver — zero JS thread load.
// ─────────────────────────────────────────────────────────────────────────────

interface HeroGeometricAnimationProps {
  size: number;
  /** 'home' = hero ring (palette-driven), 'sound' = sound reel, 'splash' = splash screen, 'minimal' = static single geometry */
  variant?: 'home' | 'sound' | 'splash' | 'minimal';
  /** @deprecated use variant. kept for backward compat */
  theme?: 'light' | 'dark';
  /** @deprecated use variant. kept for backward compat */
  speed?: 'slow' | 'fast';
  opacity?: number;
  /** For 'home' variant: pass the solar palette ring color hex e.g. '#FFD700' */
  accentColor?: string;
  /** Live audio metering level [0-1] to sync animations to the beat */
  audioMetering?: Animated.Value;
}

export function HeroGeometricAnimation({
  size,
  variant = 'home',
  theme = 'dark',
  speed = 'slow',
  opacity = 0.82,
  accentColor,
  audioMetering,
}: HeroGeometricAnimationProps) {
  const cx = size / 2, cy = size / 2;
  const hw = size / 2;
  const S  = size;

  // ── Shape cycling state ───────────────────────────────────────────────────
  const [activeShape, setActiveShape] = useState(0);
  const [nextShape,   setNextShape]   = useState<number | null>(null);

  // ── Rotation drivers ───────────────────────────────────────────────────────
  const rotA = useRef(new Animated.Value(0)).current;
  const rotB = useRef(new Animated.Value(0)).current;
  const rotC = useRef(new Animated.Value(0)).current;
  const rotD = useRef(new Animated.Value(0)).current; // extra axis for splash/sound

  // ── Per-shape opacity ──────────────────────────────────────────────────────
  const op0 = useRef(new Animated.Value(1)).current;
  const op1 = useRef(new Animated.Value(0)).current;
  const op2 = useRef(new Animated.Value(0)).current;
  const op3 = useRef(new Animated.Value(0)).current;

  // ── Scale breath + pulse ───────────────────────────────────────────────────
  const breath  = useRef(new Animated.Value(0)).current;
  const pulse   = useRef(new Animated.Value(0)).current;
  const ripple1 = useRef(new Animated.Value(0)).current;
  const ripple2 = useRef(new Animated.Value(0)).current;
  const ripple3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // ── Rotation speeds per variant ──────────────────────────────────────────
    const SPEED_A = variant === 'minimal' ? 900000 : variant === 'sound' ? 30000 : variant === 'splash' ? 14000 : 9000;
    const SPEED_B = variant === 'minimal' ? 900000 : variant === 'sound' ? 40000 : variant === 'splash' ? 20000 : 12000;
    const SPEED_C = variant === 'minimal' ? 900000 : variant === 'sound' ? 50000 : variant === 'splash' ? 28000 : 16000;
    const SPEED_D = variant === 'minimal' ? 900000 : variant === 'sound' ? 22000 : variant === 'splash' ? 10000 : 13000;

    Animated.loop(Animated.timing(rotA, { toValue: 1, duration: SPEED_A, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(rotB, { toValue: 1, duration: SPEED_B, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(rotC, { toValue: 1, duration: SPEED_C, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(rotD, { toValue: 1, duration: SPEED_D, easing: Easing.linear, useNativeDriver: true })).start();

    // ── Breath scale per variant ─────────────────────────────────────────────
    const BREATH_RANGE = variant === 'home'   ? [0.96, 1.04]
                       : variant === 'sound'  ? [0.88, 1.12]
                       :                        [0.90, 1.10]; // splash
    const BREATH_DUR   = variant === 'sound'  ? 8000
                       : variant === 'splash' ? 6000
                       :                        10000;

    Animated.loop(Animated.sequence([
      Animated.timing(breath, { toValue: 1, duration: BREATH_DUR, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(breath, { toValue: 0, duration: BREATH_DUR, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();

    // ── Bindu pulse ─────────────────────────────────────────────────────────
    const PULSE_DUR = variant === 'sound' ? 3200 : 2200;
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: PULSE_DUR, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: PULSE_DUR, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();

    // ── Sound variant: concentric ripple rings from center ───────────────────
    if (variant === 'sound') {
      if (!audioMetering) {
        // Fallback: random continuous waves
        const startRipple = (anim: Animated.Value, delay: number) => {
          Animated.sequence([
            Animated.delay(delay),
            Animated.loop(Animated.sequence([
              Animated.timing(anim, { toValue: 1, duration: 4500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
              Animated.timing(anim, { toValue: 0, duration: 0,    useNativeDriver: true }),
            ])),
          ]).start();
        };
        startRipple(ripple1, 0);
        startRipple(ripple2, 1500);
        startRipple(ripple3, 3000);
      }
    }

    // ── Shape cross-fade cycle ───────────────────────────────────────────────
    // sound: very slow cycling (shapes hold longer for meditation)
    // home: slow meditative
    // splash: fast cycling during brief window (layered approach, all visible)
    const HOLD = variant === 'sound'  ? 14000
               : variant === 'splash' ? 1200
               : speed === 'fast'     ? 1000
               :                        9000;
    const FADE = variant === 'sound'  ? 3000
               : variant === 'splash' ? 800
               : speed === 'fast'     ? 600
               :                        2000;

    const ops = [op0, op1, op2, op3];

    // Splash shows all shapes simultaneously at partial opacity — don't cycle
    if (variant === 'splash') {
      // Cosmic interwoven breath: dynamic undulating opacity for each layer
      op0.setValue(0.85);
      op1.setValue(0.55);
      op2.setValue(0.75);
      op3.setValue(0.40);

      Animated.loop(Animated.sequence([
        Animated.timing(op0, { toValue: 0.45, duration: 4200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(op0, { toValue: 0.85, duration: 4200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])).start();

      Animated.loop(Animated.sequence([
        Animated.timing(op1, { toValue: 0.85, duration: 5500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(op1, { toValue: 0.55, duration: 5500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])).start();

      Animated.loop(Animated.sequence([
        Animated.timing(op2, { toValue: 0.45, duration: 6800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(op2, { toValue: 0.75, duration: 6800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])).start();

      Animated.loop(Animated.sequence([
        Animated.timing(op3, { toValue: 0.70, duration: 4800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(op3, { toValue: 0.40, duration: 4800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])).start();

      return;
    }

    // Minimal shows a single majestic static shape (Sri Yantra) that just breathes
    if (variant === 'minimal') {
      op0.setValue(0);
      op1.setValue(0);
      op2.setValue(1);
      op3.setValue(0);
      setActiveShape(2);
      return;
    }

    function runCycle(current: number) {
      const next = (current + 1) % 4;
      Animated.sequence([
        Animated.delay(HOLD),
      ]).start(({ finished }) => {
        if (!finished) return;
        setNextShape(next);
        Animated.parallel([
          Animated.timing(ops[current], { toValue: 0, duration: FADE, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(ops[next],    { toValue: 1, duration: FADE, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]).start(({ finished }) => {
          if (!finished) return;
          setActiveShape(next);
          setNextShape(null);
          runCycle(next);
        });
      });
    }
    runCycle(0);
  }, []);

  // ── High-Sensitivity Real-Time Beat Detector ───────────────────────────────
  useEffect(() => {
    if (!audioMetering || variant !== 'sound') return;
    
    let lastLevel = 0;
    let waveIndex = 0;
    let lastWaveTime = 0;
    const waves = [ripple1, ripple2, ripple3];
    
    const listenerId = audioMetering.addListener(({ value }) => {
      const now = Date.now();
      
      // Sensitive beat detection: sudden volume jump > 0.03, max 3 waves per second
      const isBeat = value - lastLevel > 0.03 && (now - lastWaveTime > 250);
      const isFallback = (now - lastWaveTime > 2800);

      if (isBeat || isFallback) {
        lastWaveTime = now;
        const anim = waves[waveIndex];
        waveIndex = (waveIndex + 1) % 3;
        anim.setValue(0);
        
        Animated.timing(anim, {
          toValue: 1,
          duration: isFallback ? 4000 : 2500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true
        }).start();
      }
      lastLevel = value;
    });
    
    return () => {
      audioMetering.removeListener(listenerId);
    };
  }, [audioMetering, variant, ripple1, ripple2, ripple3]);

  // ── Interpolated transforms ───────────────────────────────────────────────
  const r0deg  = rotA.interpolate({ inputRange: [0,1], outputRange: ['0deg',   '360deg'] });
  const r0degR = rotA.interpolate({ inputRange: [0,1], outputRange: ['360deg', '0deg']   });
  const r1deg  = rotB.interpolate({ inputRange: [0,1], outputRange: ['0deg',   '360deg'] });
  const r1degR = rotB.interpolate({ inputRange: [0,1], outputRange: ['360deg', '0deg']   });
  const r2deg  = rotC.interpolate({ inputRange: [0,1], outputRange: ['0deg',   '360deg'] });
  const r3deg  = rotD.interpolate({ inputRange: [0,1], outputRange: ['0deg',   '360deg'] });
  const r3degR = rotD.interpolate({ inputRange: [0,1], outputRange: ['360deg', '0deg']   });

  const breathRange = variant === 'home'   ? [0.96, 1.04]
                    : variant === 'sound'  ? [0.88, 1.12]
                    :                        [0.90, 1.10];
  const sc    = breath.interpolate({ inputRange: [0,1], outputRange: [breathRange[0], breathRange[1]] });
  const scSm  = breath.interpolate({ inputRange: [0,1], outputRange: [0.97, 1.03] });
  const bindOp = pulse.interpolate({ inputRange: [0,1], outputRange: [0.45, 1] });
  const bindSc = pulse.interpolate({ inputRange: [0,1], outputRange: [0.70, 1.6] });

  // Sound ripple interpolations - perfectly synced
  const rip1Scale = ripple1.interpolate({ inputRange: [0,1], outputRange: [0.05, 0.95] });
  const rip1Op = ripple1.interpolate({ inputRange: [0, 0.1, 0.6, 1], outputRange: [0, 0.70, 0.15, 0] });
  const rip2Scale = ripple2.interpolate({ inputRange: [0,1], outputRange: [0.05, 0.95] });
  const rip2Op = ripple2.interpolate({ inputRange: [0, 0.1, 0.6, 1], outputRange: [0, 0.60, 0.10, 0] });
  const rip3Scale = ripple3.interpolate({ inputRange: [0,1], outputRange: [0.05, 0.95] });
  const rip3Op = ripple3.interpolate({ inputRange: [0, 0.1, 0.6, 1], outputRange: [0, 0.50, 0.07, 0] });

  // ── Colour palettes per variant ───────────────────────────────────────────

  // HOME: Palette-driven. accentColor drives everything. Fallback: golden.
  const homeBase  = accentColor ?? (theme === 'dark' ? '#FFD700' : '#B8860B');
  const homeG1 = homeBase;
  const homeG2 = homeBase + 'EE';
  const homeG3 = '#FFFFFF';
  const homeG4 = homeBase + '88';
  const homeGA = `rgba(${hexToRgbStr(homeBase)},`;

  // SOUND: Deep resonance. Teal-purple-bioluminescent. accentColor tints.
  const soundBase = accentColor ?? '#38bdf8';
  const sR = soundBase;
  const sG1 = soundBase;
  const sG2 = blendHex(soundBase, '#a78bfa', 0.4);  // mix with violet
  const sG3 = '#e0f2fe';                               // pale ice glow
  const sG4 = blendHex(soundBase, '#1e1b4b', 0.5);   // deep dark tint
  const sGA = `rgba(${hexToRgbStr(soundBase)},`;

  // SPLASH: Golden celestial. Warm cosmic gold colors as requested.
  const spG1 = '#FFD700';   // bright gold
  const spG2 = '#FDB931';   // warmer golden orange
  const spG3 = '#FFFFFF';   // ice white / bright center
  const spG4 = '#B8860B';   // deep golden rod
  const spGA = 'rgba(255,215,0,'; // gold rgb

  // Pick active palette
  const G1 = variant === 'sound' ? sG1 : variant === 'splash' ? spG1 : homeG1;
  const G2 = variant === 'sound' ? sG2 : variant === 'splash' ? spG2 : homeG2;
  const G3 = variant === 'sound' ? sG3 : variant === 'splash' ? spG3 : homeG3;
  const G4 = variant === 'sound' ? sG4 : variant === 'splash' ? spG4 : homeG4;
  const GA = variant === 'sound' ? sGA : variant === 'splash' ? spGA : homeGA;

  // Shape visibility helpers
  const showShape = (idx: number) =>
    variant === 'splash' || activeShape === idx || nextShape === idx;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute', width: S, height: S, zIndex: 2,
        opacity: opacity,
        justifyContent: 'center', alignItems: 'center',
      }}
    >

      {/* ════════════════════════════════════════════════════════════════════════
          SOUND variant: waveform resonance rings behind everything
          ════════════════════════════════════════════════════════════════════ */}
      {variant === 'sound' && (
        <>
          {/* Expanding acoustic ripples from center */}
          <Animated.View style={{
            position: 'absolute', width: S, height: S,
            borderRadius: S / 2,
            borderWidth: 1.5,
            borderColor: G1 + '80',
            transform: [{ scale: rip1Scale }],
            opacity: rip1Op,
          }} />
          <Animated.View style={{
            position: 'absolute', width: S, height: S,
            borderRadius: S / 2,
            borderWidth: 1,
            borderColor: G2 + '60',
            transform: [{ scale: rip2Scale }],
            opacity: rip2Op,
          }} />
          <Animated.View style={{
            position: 'absolute', width: S, height: S,
            borderRadius: S / 2,
            borderWidth: 0.8,
            borderColor: G3 + '40',
            transform: [{ scale: rip3Scale }],
            opacity: rip3Op,
          }} />
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          SPLASH variant: cosmic nebula background layer
          ════════════════════════════════════════════════════════════════════ */}
      {variant === 'splash' && (
        <Animated.View style={{
          position: 'absolute', width: S * 1.1, height: S * 1.1,
          top: -S * 0.05, left: -S * 0.05,
          opacity: 0.18,
          transform: [{ rotate: r3deg }],
        }}>
          <Svg width={S * 1.1} height={S * 1.1}>
            {/* Stardust spiral arms */}
            {pts(S * 0.55, S * 0.55, S * 0.48, 72, 0).map((p, i) => (
              <SvgCircle key={`cosmos_${i}`}
                cx={p.x} cy={p.y}
                r={i % 5 === 0 ? 2.5 : i % 3 === 0 ? 1.6 : 0.9}
                fill={i % 7 === 0 ? spG1 : i % 4 === 0 ? spG2 : spG3}
                opacity={0.12 + (i % 6) * 0.08}
              />
            ))}
          </Svg>
        </Animated.View>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          SHAPE 0 — FLOWER OF LIFE / SEED OF LIFE
          ════════════════════════════════════════════════════════════════════ */}
      {showShape(0) && (
      <Animated.View style={{
          position: 'absolute', width: S, height: S,
          opacity: op0,
          transform: [{ rotate: r2deg }, { scale: sc }],
      }}>
        <Svg width={S} height={S}>
          {/* Central circle */}
          <SvgCircle cx={hw} cy={hw} r={S*0.19} fill="none" stroke={G2} strokeWidth="2.0" opacity={variant === 'sound' ? 0.55 : 0.90} />
          {/* 6 petal circles */}
          {pts(hw, hw, S*0.19, 6, 0).map((p, i) => (
            <SvgCircle key={`fol_inner_${i}`} cx={p.x} cy={p.y} r={S*0.19}
              fill={`${GA}${variant === 'sound' ? '0.06' : '0.10'})`}
              stroke={G2} strokeWidth="1.6" opacity={variant === 'sound' ? 0.50 : 0.85} />
          ))}
          {/* Second ring — 12 more petals */}
          {pts(hw, hw, S*0.38, 6, Math.PI/6).map((p, i) => (
            <SvgCircle key={`fol_outer_${i}`} cx={p.x} cy={p.y} r={S*0.19}
              fill="none" stroke={G4} strokeWidth="0.7" opacity={0.30} />
          ))}
          {/* Outer container ring */}
          <SvgCircle cx={hw} cy={hw} r={S*0.40} fill="none" stroke={G4}
            strokeWidth="0.8" opacity={0.40}
            strokeDasharray={variant === 'sound' ? '3 6' : undefined} />
          {/* Inner tight ring */}
          <SvgCircle cx={hw} cy={hw} r={S*0.07} fill={`${GA}0.18)`} stroke={G3} strokeWidth="1" opacity={0.80} />
          {/* Petal dot jewels */}
          {pts(hw, hw, S*0.19, 6, 0).map((p, i) => (
            <SvgCircle key={`fol_jewel_${i}`} cx={p.x} cy={p.y} r={3.0} fill={G3} opacity={0.85} />
          ))}
          {/* Outer halo dots */}
          {pts(hw, hw, S*0.43, 12, 0).map((p, i) => (
            <SvgCircle key={`fol_halo_${i}`} cx={p.x} cy={p.y} r={2.2}
              fill={G3} opacity={0.20 + (i % 2) * 0.15} />
          ))}
          <SvgCircle cx={hw} cy={hw} r={S*0.45} fill="none" stroke={G4}
            strokeWidth="0.5" opacity={0.25} strokeDasharray="4 8" />
          {/* Sound variant: extra frequency arcs */}
          {variant === 'sound' && [S*0.31, S*0.24, S*0.16].map((r, i) => (
            <SvgCircle key={`snd_arc_${i}`} cx={hw} cy={hw} r={r}
              fill="none" stroke={G1} strokeWidth="0.6"
              opacity={0.20 + i * 0.08}
              strokeDasharray={`${2 + i * 2} ${4 + i}`} />
          ))}
        </Svg>
      </Animated.View>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          SHAPE 1 — METATRON'S CUBE
          ════════════════════════════════════════════════════════════════════ */}
      {showShape(1) && (
      <Animated.View style={{
          position: 'absolute', width: S, height: S,
          opacity: op1,
          transform: [{ rotate: r1degR }, { scale: sc }],
      }}>
        <Svg width={S} height={S}>
          {/* All 13 Metatron circles */}
          {[
            { x: hw, y: hw },
            ...pts(hw, hw, S*0.19, 6, 0),
            ...pts(hw, hw, S*0.38, 6, 0),
          ].map((p, i) => (
            <SvgCircle key={`mc_circ_${i}`} cx={p.x} cy={p.y} r={S*0.19}
              fill={`${GA}${variant === 'sound' ? '0.05' : '0.08'})`}
              stroke={G2} strokeWidth="1.4"
              opacity={i === 0 ? 0.90 : 0.65} />
          ))}
          {/* Lines connecting all 13 centres */}
          {(() => {
            const centers = [{ x: hw, y: hw }, ...pts(hw, hw, S*0.19, 6, 0), ...pts(hw, hw, S*0.38, 6, 0)];
            let d = '';
            centers.forEach((a, i) => centers.forEach((b, j) => {
              if (j <= i) return;
              d += `M${a.x.toFixed(1)} ${a.y.toFixed(1)} L${b.x.toFixed(1)} ${b.y.toFixed(1)} `;
            }));
            return <SvgPath d={d} stroke={G4} strokeWidth="0.5" opacity={0.25} />;
          })()}
          {/* Star tetrahedron overlay */}
          <SvgPath d={poly(pts(hw, hw, S*0.34, 3, -Math.PI/2))}
            fill={`${GA}0.12)`} stroke={G1} strokeWidth="2.2" opacity={0.95} />
          <SvgPath d={poly(pts(hw, hw, S*0.34, 3,  Math.PI/2))}
            fill={`${GA}0.12)`} stroke={G1} strokeWidth="2.2" opacity={0.95} />
          {/* Outer hexagon */}
          <SvgPath d={poly(pts(hw, hw, S*0.34, 6, 0))} fill="none" stroke={G3} strokeWidth="1" opacity={0.55} />
          {/* Dot jewels on hexagon vertices */}
          {pts(hw, hw, S*0.34, 6, 0).map((p, i) => (
            <SvgCircle key={`mc_vj_${i}`} cx={p.x} cy={p.y} r={3.2} fill={G3} opacity={0.82} />
          ))}
          {/* Halo */}
          {pts(hw, hw, S*0.44, 12, 0).map((p, i) => (
            <SvgCircle key={`mc_halo_${i}`} cx={p.x} cy={p.y} r={2.0}
              fill={G3} opacity={0.22 + (i%3)*0.12} />
          ))}
          {/* Sound: waveform frequency lines crossing center */}
          {variant === 'sound' && Array.from({ length: 8 }, (_, i) => {
            const angle = (i * Math.PI) / 8;
            const x1 = hw + Math.cos(angle) * S * 0.42;
            const y1 = hw + Math.sin(angle) * S * 0.42;
            const x2 = hw - Math.cos(angle) * S * 0.42;
            const y2 = hw - Math.sin(angle) * S * 0.42;
            return <SvgLine key={`wl_${i}`} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={G1} strokeWidth="0.4" opacity={0.15} />;
          })}
        </Svg>
      </Animated.View>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          SHAPE 2 — SRI YANTRA (3D Ultra-Premium Carved Metal)
          ════════════════════════════════════════════════════════════════════ */}
      {showShape(2) && (
      <Animated.View style={{
          position: 'absolute', width: S, height: S,
          opacity: op2,
          transform: [{ rotate: r2deg }, { scale: sc }],
      }}>
        <Svg width={S} height={S}>
          <Defs>
            <LinearGradient id="syMetal" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#FFF7D6" />
              <Stop offset="20%" stopColor="#F9D423" />
              <Stop offset="50%" stopColor="#F83600" stopOpacity="0.8" />
              <Stop offset="80%" stopColor="#F9D423" />
              <Stop offset="100%" stopColor="#FFF7D6" />
            </LinearGradient>
            <LinearGradient id="syMetalG" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#FFDF00" />
              <Stop offset="50%" stopColor="#D4AF37" />
              <Stop offset="100%" stopColor="#996515" />
            </LinearGradient>
          </Defs>

          {/* ── 1. The Physical Drop Shadow Layer (Creates the 3D Depth) ── */}
          <G x="0" y="3" opacity="0.5">
            {(() => {
              let d = '';
              [S*0.35, S*0.27, S*0.19, S*0.12].forEach(r => d += poly(pts(hw, hw, r, 3, Math.PI/6), true) + ' ');
              [S*0.38, S*0.30, S*0.22, S*0.15, S*0.08].forEach(r => d += poly(pts(hw, hw, r, 3, -Math.PI/6), true) + ' ');
              return <SvgPath d={d} fill="none" stroke="#000000" strokeWidth="1.8" strokeLinejoin="round" />;
            })()}
            <SvgCircle cx={hw} cy={hw} r={S*0.035} fill="#000000" />
          </G>

          {/* ── 2. The Golden Metallic Foreground Layer ── */}
          {/* Outer ring */}
          <SvgCircle cx={hw} cy={hw} r={S*0.43} fill="none" stroke={G4}
            strokeWidth="0.8" opacity={0.40}
            strokeDasharray={variant === 'splash' ? '8 4' : '6 6'} />
          
          {/* Shakti (downward) — 4 sizes */}
          {[S*0.35, S*0.27, S*0.19, S*0.12].map((r, ti) => (
            <SvgPath key={`sy_d_${ti}`} d={poly(pts(hw, hw, r, 3, Math.PI/6))}
              fill={`${GA}${[0.06, 0.05, 0.04, 0.03][ti]})`}
              stroke="url(#syMetalG)" strokeWidth={[2.2, 1.8, 1.6, 1.4][ti]} strokeLinejoin="round"
              opacity={0.85 + ti * 0.05} />
          ))}
          
          {/* Shiva (upward) — 5 sizes */}
          {[S*0.38, S*0.30, S*0.22, S*0.15, S*0.08].map((r, ti) => (
            <SvgPath key={`sy_u_${ti}`} d={poly(pts(hw, hw, r, 3, -Math.PI/6))}
              fill={`${GA}${[0.05, 0.04, 0.03, 0.03, 0.02][ti]})`}
              stroke="url(#syMetalG)" strokeWidth={[2.2, 1.8, 1.6, 1.4, 1.1][ti]} strokeLinejoin="round"
              opacity={0.85 + ti * 0.05} />
          ))}
          
          {/* Innermost Bindu ring */}
          <SvgCircle cx={hw} cy={hw} r={S*0.035} fill="url(#syMetalG)" opacity={1} />
          
          {/* 8-petal lotus ring */}
          {pts(hw, hw, S*0.41, 8, 0).map((p, i) => (
            <SvgCircle key={`sy_lotus_${i}`} cx={p.x} cy={p.y} r={S*0.05}
              fill={`${GA}0.07)`} stroke={G4} strokeWidth="0.7" opacity={0.48} />
          ))}
          {/* 16-petal lotus ring */}
          {pts(hw, hw, S*0.41, 16, Math.PI/16).map((p, i) => (
            <SvgCircle key={`sy_lotus16_${i}`} cx={p.x} cy={p.y} r={S*0.026}
              fill="none" stroke={G4} strokeWidth="0.5" opacity={0.28} />
          ))}
          
          {/* Splash: extra cosmic ring */}
          {variant === 'splash' && (
            <SvgCircle cx={hw} cy={hw} r={S*0.46} fill="none" stroke={spG2}
              strokeWidth="0.6" opacity={0.30} strokeDasharray="2 6" />
          )}
        </Svg>
      </Animated.View>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          SHAPE 3 — SHATKONA / STAR OF DAVID
          ════════════════════════════════════════════════════════════════════ */}
      {showShape(3) && (
      <Animated.View style={{
          position: 'absolute', width: S, height: S,
          opacity: op3,
          transform: [{ rotate: r0deg }, { scale: scSm }],
      }}>
        <Svg width={S} height={S}>
          {/* Fine radial web */}
          {(() => {
            let d = '';
            pts(hw, hw, S*0.46, 48, 0).forEach(p => {
              d += `M${hw} ${hw} L${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
            });
            return <SvgPath d={d} stroke={G3} strokeWidth="0.4" opacity={variant === 'sound' ? 0.06 : 0.09} />;
          })()}
          {/* Outer dashed circle */}
          <SvgCircle cx={hw} cy={hw} r={S*0.43} fill="none" stroke={G4}
            strokeWidth="0.8" opacity={0.40} strokeDasharray="3 5" />
          {/* Main upward triangle */}
          <SvgPath d={poly(pts(hw, hw, S*0.38, 3, -Math.PI/2))}
            fill={`${GA}0.05)`} stroke={G1} strokeWidth="2.5" opacity={0.94} />
          {/* Main downward triangle */}
          <SvgPath d={poly(pts(hw, hw, S*0.38, 3, Math.PI/2))}
            fill={`${GA}0.05)`} stroke={G1} strokeWidth="2.5" opacity={0.94} />
          {/* Hexagram intersection inner highlight */}
          <SvgPath d={poly(pts(hw, hw, S*0.20, 6, 0))} fill="none" stroke={G3} strokeWidth="1.2" opacity={0.70} />
          {/* Vertex jewels */}
          {pts(hw, hw, S*0.38, 3, -Math.PI/2).map((p, i) => (
            <SvgCircle key={`sh_vup_${i}`} cx={p.x} cy={p.y} r={5} fill={G3} opacity={0.92} />
          ))}
          {pts(hw, hw, S*0.38, 3, Math.PI/2).map((p, i) => (
            <SvgCircle key={`sh_vdn_${i}`} cx={p.x} cy={p.y} r={5} fill={G3} opacity={0.92} />
          ))}
          {/* Inner rings */}
          <SvgCircle cx={hw} cy={hw} r={S*0.12} fill="none" stroke={G2} strokeWidth="1.2" opacity={0.75} />
          <SvgCircle cx={hw} cy={hw} r={S*0.06} fill="none" stroke={G3} strokeWidth="1"   opacity={0.85} />
        </Svg>
      </Animated.View>
      )}

      {/* Counter-rotation ring for Shatkona */}
      {showShape(3) && (
      <Animated.View style={{
          position: 'absolute', width: S, height: S,
          opacity: op3,
          transform: [{ rotate: r1degR }],
      }}>
        <Svg width={S} height={S}>
          {pts(hw, hw, S*0.44, 12, Math.PI/12).map((p, i) => (
            <SvgCircle key={`sh_orbit_${i}`} cx={p.x} cy={p.y} r={2.4}
              fill={G3} opacity={0.18 + (i%3)*0.12} />
          ))}
        </Svg>
      </Animated.View>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          ALWAYS VISIBLE — Orbiting stardust ring
          ════════════════════════════════════════════════════════════════════ */}
      <Animated.View style={{
          position: 'absolute', width: S, height: S,
          transform: [{ rotate: r1degR }],
          opacity: variant === 'sound' ? 0.45 : variant === 'splash' ? 0.70 : 0.60,
      }}>
        <Svg width={S} height={S}>
          {pts(hw, hw, S*0.44, variant === 'splash' ? 36 : 24, 0).map((p, i) => (
            <SvgCircle key={`dust_${i}`} cx={p.x} cy={p.y}
              r={i % 3 === 0 ? 2.4 : 1.4}
              fill={G3}
              opacity={0.12 + (i % 4) * 0.11} />
          ))}
        </Svg>
      </Animated.View>

      {/* Splash: second stardust ring — rotating opposite */}
      {variant === 'splash' && (
        <Animated.View style={{
            position: 'absolute', width: S, height: S,
            transform: [{ rotate: r3deg }],
            opacity: 0.40,
        }}>
          <Svg width={S} height={S}>
            {pts(hw, hw, S*0.36, 24, Math.PI/12).map((p, i) => (
              <SvgCircle key={`dust2_${i}`} cx={p.x} cy={p.y}
                r={i % 4 === 0 ? 2 : 1}
                fill={spG2}
                opacity={0.10 + (i % 5) * 0.09} />
            ))}
          </Svg>
        </Animated.View>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          Bindu — sacred glowing center dot
          ════════════════════════════════════════════════════════════════════ */}
      <Animated.View style={{
        position: 'absolute',
        width: variant === 'sound' ? 12 : 9,
        height: variant === 'sound' ? 12 : 9,
        borderRadius: variant === 'sound' ? 6 : 4.5,
        backgroundColor: variant === 'sound' ? sG3 : G3,
        shadowColor: G1,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: variant === 'sound' ? 20 : variant === 'splash' ? 18 : 14,
        opacity: bindOp,
        transform: [{ scale: bindSc }],
      }} />

    </View>
  );
}

// ── Palette utilities ─────────────────────────────────────────────────────────
/** Convert '#RRGGBB' → 'r,g,b' string for rgba() */
function hexToRgbStr(hex: string): string {
  const clean = hex.replace('#', '');
  if (clean.length < 6) return '255,255,255';
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return '255,255,255';
  return `${r},${g},${b}`;
}

/** Blend two hex colors. t=0 → c1, t=1 → c2 */
function blendHex(c1: string, c2: string, t: number): string {
  const p1 = hexToRgbStr(c1).split(',').map(Number);
  const p2 = hexToRgbStr(c2).split(',').map(Number);
  const r = Math.round(p1[0] + (p2[0] - p1[0]) * t);
  const g = Math.round(p1[1] + (p2[1] - p1[1]) * t);
  const b = Math.round(p1[2] + (p2[2] - p1[2]) * t);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

export { pts as sacredDots };
