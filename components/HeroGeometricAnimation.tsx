import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, Easing } from 'react-native';
import Svg, {
  Circle as SvgCircle, Path as SvgPath, G as SvgG,
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
// variant = 'home'   → Ultra-slow, deeply meditative sacred geometry.
//                      All calming shapes (Flower of Life, Metatron, Lotus,
//                      Shatkona). Colors 100% accent-driven. No harsh tones.
//                      Breath: 14s inhale / exhale. Rotation: 25s–60s.
//
// variant = 'sound'  → Resonance / acoustic deep environment.
//                      Concentric waveform rings, mandala breathing with sound.
//
// variant = 'splash' → Cosmic / galactic awakening.
//                      Golden palette, dramatic. Universe being born.
//
// variant = 'minimal' → Single static Flower of Life, pure breath.
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
  const rotD = useRef(new Animated.Value(0)).current;

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
    // ── HOME: ultra-slow meditative rotations ─────────────────────────────
    // Each axis rotates at a different, prime-number-spaced pace so they
    // never perfectly align — creating an ever-changing mandala pattern.
    const SPEED_A = variant === 'minimal' ? 900000 : variant === 'sound' ? 30000 : variant === 'splash' ? 14000 : 55000;
    const SPEED_B = variant === 'minimal' ? 900000 : variant === 'sound' ? 40000 : variant === 'splash' ? 20000 : 37000;
    const SPEED_C = variant === 'minimal' ? 900000 : variant === 'sound' ? 50000 : variant === 'splash' ? 28000 : 62000;
    const SPEED_D = variant === 'minimal' ? 900000 : variant === 'sound' ? 22000 : variant === 'splash' ? 10000 : 44000;

    Animated.loop(Animated.timing(rotA, { toValue: 1, duration: SPEED_A, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(rotB, { toValue: 1, duration: SPEED_B, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(rotC, { toValue: 1, duration: SPEED_C, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(rotD, { toValue: 1, duration: SPEED_D, easing: Easing.linear, useNativeDriver: true })).start();

    // ── HOME breath: deeply slow — 14s inhale, 14s exhale ────────────────
    const BREATH_RANGE = variant === 'home'    ? [0.97, 1.03]   // ultra-gentle sway
                       : variant === 'sound'   ? [0.88, 1.12]
                       : variant === 'minimal' ? [0.95, 1.05]
                       :                         [0.90, 1.10];  // splash
    const BREATH_DUR   = variant === 'home'    ? 14000
                       : variant === 'sound'   ? 8000
                       : variant === 'splash'  ? 6000
                       : variant === 'minimal' ? 12000
                       :                         10000;

    Animated.loop(Animated.sequence([
      Animated.timing(breath, { toValue: 1, duration: BREATH_DUR, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(breath, { toValue: 0, duration: BREATH_DUR, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();

    // ── Bindu pulse — slow, gentle ────────────────────────────────────────
    const PULSE_DUR = variant === 'home' ? 5000 : variant === 'sound' ? 3200 : 2200;
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: PULSE_DUR, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: PULSE_DUR, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();

    // ── Sound variant: concentric ripple rings from center ────────────────
    if (variant === 'sound') {
      if (!audioMetering) {
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

    // ── Shape cross-fade cycle ────────────────────────────────────────────
    // HOME: very long hold (16s) + slow crossfade (3s) = deeply meditative
    const HOLD = variant === 'sound'    ? 14000
               : variant === 'splash'  ? 3000
               : variant === 'home'    ? 16000
               : speed === 'fast'      ? 1000
               :                         9000;
    const FADE = variant === 'sound'   ? 3000
               : variant === 'splash'  ? 1500
               : variant === 'home'    ? 3500
               : speed === 'fast'      ? 600
               :                         2000;

    const ops = [op0, op1, op2, op3];

    // Minimal: single static Flower of Life, just breathes
    if (variant === 'minimal') {
      op0.setValue(1);
      op1.setValue(0);
      op2.setValue(0);
      op3.setValue(0);
      setActiveShape(0);
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

  const breathRange = variant === 'home'    ? [0.97, 1.03]
                    : variant === 'minimal'  ? [0.95, 1.05]
                    : variant === 'sound'    ? [0.88, 1.12]
                    :                          [0.90, 1.10];
  const sc    = breath.interpolate({ inputRange: [0,1], outputRange: [breathRange[0], breathRange[1]] });
  const scSm  = breath.interpolate({ inputRange: [0,1], outputRange: [0.97, 1.03] });
  const bindOp = pulse.interpolate({ inputRange: [0,1], outputRange: [0.35, 0.90] });
  const bindSc = pulse.interpolate({ inputRange: [0,1], outputRange: [0.65, 1.5] });

  // Sound ripple interpolations
  const rip1Scale = ripple1.interpolate({ inputRange: [0,1], outputRange: [0.05, 0.95] });
  const rip1Op = ripple1.interpolate({ inputRange: [0, 0.1, 0.6, 1], outputRange: [0, 0.70, 0.15, 0] });
  const rip2Scale = ripple2.interpolate({ inputRange: [0,1], outputRange: [0.05, 0.95] });
  const rip2Op = ripple2.interpolate({ inputRange: [0, 0.1, 0.6, 1], outputRange: [0, 0.60, 0.10, 0] });
  const rip3Scale = ripple3.interpolate({ inputRange: [0,1], outputRange: [0.05, 0.95] });
  const rip3Op = ripple3.interpolate({ inputRange: [0, 0.1, 0.6, 1], outputRange: [0, 0.50, 0.07, 0] });

  // ── Colour palettes per variant ───────────────────────────────────────────

  // HOME: 100% accent-driven. Soft, cool, meditative tones. No harsh golds or reds.
  const homeBase = accentColor ?? '#80FFFF';
  const homeG1 = homeBase;
  const homeG2 = homeBase + 'CC';          // slightly transparent
  const homeG3 = '#FFFFFF';                // pure white for jewel dots
  const homeG4 = homeBase + '55';          // very faint for subtle rings
  const homeGA = `rgba(${hexToRgbStr(homeBase)},`;

  // SOUND: Deep resonance. Teal-purple-bioluminescent.
  const soundBase = accentColor ?? '#38bdf8';
  const sG1 = soundBase;
  const sG2 = blendHex(soundBase, '#a78bfa', 0.4);
  const sG3 = '#e0f2fe';
  const sG4 = blendHex(soundBase, '#1e1b4b', 0.5);
  const sGA = `rgba(${hexToRgbStr(soundBase)},`;

  // SPLASH: Warm celestial gold.
  const spG1 = '#FFD700';
  const spG2 = '#FDB931';
  const spG3 = '#FFFFFF';
  const spG4 = '#B8860B';
  const spGA = 'rgba(255,215,0,';

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
          SOUND variant: acoustic ripple rings
          ════════════════════════════════════════════════════════════════════ */}
      {variant === 'sound' && (
        <>
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
          opacity: 0.15,
          transform: [{ rotate: r3deg }],
        }}>
          <Svg width={S * 1.1} height={S * 1.1}>
            {pts(S * 0.55, S * 0.55, S * 0.48, 24, 0).map((p, i) => (
              <SvgCircle key={`cosmos_${i}`}
                cx={p.x} cy={p.y}
                r={i % 5 === 0 ? 3.0 : i % 3 === 0 ? 2.0 : 1.2}
                fill={i % 7 === 0 ? spG1 : i % 4 === 0 ? spG2 : spG3}
                opacity={0.15 + (i % 6) * 0.10}
              />
            ))}
          </Svg>
        </Animated.View>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          SHAPE 0 — FLOWER OF LIFE
          Pure sacred geometry. Meditative, balanced, timeless.
          ════════════════════════════════════════════════════════════════════ */}
      {showShape(0) && (
      <Animated.View style={{
          position: 'absolute', width: S, height: S,
          opacity: op0,
          transform: [{ rotate: r2deg }, { scale: sc }],
      }}>
        <Svg width={S} height={S}>
          {/* Central circle */}
          <SvgCircle cx={hw} cy={hw} r={S*0.19} fill="none" stroke={G2} strokeWidth="1.5" opacity={0.90} />
          {/* 6 petal circles */}
          {pts(hw, hw, S*0.19, 6, 0).map((p, i) => (
            <SvgCircle key={`fol_inner_${i}`} cx={p.x} cy={p.y} r={S*0.19}
              fill={`${GA}0.06)`}
              stroke={G2} strokeWidth="1.2" opacity={0.80} />
          ))}
          {/* Second ring — 6 more petals, very faint */}
          {pts(hw, hw, S*0.38, 6, Math.PI/6).map((p, i) => (
            <SvgCircle key={`fol_outer_${i}`} cx={p.x} cy={p.y} r={S*0.19}
              fill="none" stroke={G4} strokeWidth="0.6" opacity={0.25} />
          ))}
          {/* Outer container ring */}
          <SvgCircle cx={hw} cy={hw} r={S*0.40} fill="none" stroke={G4}
            strokeWidth="0.7" opacity={0.35} />
          {/* Subtle innermost ring */}
          <SvgCircle cx={hw} cy={hw} r={S*0.06} fill={`${GA}0.15)`} stroke={G2} strokeWidth="0.8" opacity={0.70} />
          {/* Petal dot jewels — small, elegant */}
          {pts(hw, hw, S*0.19, 6, 0).map((p, i) => (
            <SvgCircle key={`fol_jewel_${i}`} cx={p.x} cy={p.y} r={2.5} fill={G3} opacity={0.75} />
          ))}
          {/* Outer halo dots — very subtle */}
          {pts(hw, hw, S*0.42, 12, 0).map((p, i) => (
            <SvgCircle key={`fol_halo_${i}`} cx={p.x} cy={p.y} r={1.8}
              fill={G3} opacity={0.12 + (i % 2) * 0.10} />
          ))}
          {/* Outermost breathable dashed ring */}
          <SvgCircle cx={hw} cy={hw} r={S*0.44} fill="none" stroke={G4}
            strokeWidth="0.4" opacity={0.18} strokeDasharray="4 8" />
        </Svg>
      </Animated.View>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          SHAPE 1 — METATRON'S CUBE
          The architect of the universe. All 5 Platonic solids within.
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
              fill={`${GA}0.04)`}
              stroke={G2} strokeWidth="1.0"
              opacity={i === 0 ? 0.85 : 0.55} />
          ))}
          {/* Lines connecting all 13 centres — elegant mesh */}
          {(() => {
            const centers = [{ x: hw, y: hw }, ...pts(hw, hw, S*0.19, 6, 0), ...pts(hw, hw, S*0.38, 6, 0)];
            const paths: any[] = [];
            centers.forEach((a, i) => centers.forEach((b, j) => {
              if (j <= i) return;
              paths.push(<SvgPath key={`mc_ln_${i}_${j}`}
                d={`M${a.x.toFixed(1)} ${a.y.toFixed(1)} L${b.x.toFixed(1)} ${b.y.toFixed(1)}`}
                stroke={G4} strokeWidth="0.4" opacity={0.20} />);
            }));
            return paths;
          })()}
          {/* Star tetrahedron — the heart of Metatron */}
          <SvgPath d={poly(pts(hw, hw, S*0.34, 3, -Math.PI/2))}
            fill={`${GA}0.08)`} stroke={G1} strokeWidth="1.8" opacity={0.90} />
          <SvgPath d={poly(pts(hw, hw, S*0.34, 3,  Math.PI/2))}
            fill={`${GA}0.08)`} stroke={G1} strokeWidth="1.8" opacity={0.90} />
          {/* Outer hexagon */}
          <SvgPath d={poly(pts(hw, hw, S*0.34, 6, 0))} fill="none" stroke={G3} strokeWidth="0.8" opacity={0.45} />
          {/* Dot jewels on hexagon vertices */}
          {pts(hw, hw, S*0.34, 6, 0).map((p, i) => (
            <SvgCircle key={`mc_vj_${i}`} cx={p.x} cy={p.y} r={2.8} fill={G3} opacity={0.75} />
          ))}
          {/* Subtle halo */}
          {pts(hw, hw, S*0.43, 12, 0).map((p, i) => (
            <SvgCircle key={`mc_halo_${i}`} cx={p.x} cy={p.y} r={1.8}
              fill={G3} opacity={0.14 + (i%3)*0.08} />
          ))}
        </Svg>
      </Animated.View>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          SHAPE 2 — LOTUS MANDALA (replaces Sri Yantra for home variant)
          Meditative 8-petal and 16-petal lotus.
          For sound/splash: keeps Sri Yantra.
          ════════════════════════════════════════════════════════════════════ */}
      {showShape(2) && (
      <Animated.View style={{
          position: 'absolute', width: S, height: S,
          opacity: op2,
          transform: [{ rotate: r0deg }, { scale: sc }],
      }}>
        <Svg width={S} height={S}>
          {variant === 'home' || variant === 'minimal' ? (
            // ── LOTUS MANDALA — calm, elegant, meditative ──
            <>
              {/* Outermost dashed halo ring */}
              <SvgCircle cx={hw} cy={hw} r={S*0.44} fill="none" stroke={G4}
                strokeWidth="0.5" opacity={0.20} strokeDasharray="3 7" />

              {/* 16-petal outer lotus */}
              {pts(hw, hw, S*0.38, 16, 0).map((p, i) => {
                const angle = (i * Math.PI * 2) / 16;
                const tipX  = hw + Math.cos(angle) * S * 0.44;
                const tipY  = hw + Math.sin(angle) * S * 0.44;
                return (
                  <SvgPath key={`lotus16_${i}`}
                    d={`M${hw} ${hw} Q${p.x.toFixed(1)} ${p.y.toFixed(1)} ${tipX.toFixed(1)} ${tipY.toFixed(1)} Q${p.x.toFixed(1)} ${p.y.toFixed(1)} ${hw} ${hw}`}
                    fill={`${GA}0.05)`} stroke={G4} strokeWidth="0.5" opacity={0.35} />
                );
              })}

              {/* 8-petal inner lotus — more defined */}
              {pts(hw, hw, S*0.26, 8, Math.PI/8).map((p, i) => {
                const angle = Math.PI/8 + (i * Math.PI * 2) / 8;
                const tipX  = hw + Math.cos(angle) * S * 0.34;
                const tipY  = hw + Math.sin(angle) * S * 0.34;
                return (
                  <SvgPath key={`lotus8_${i}`}
                    d={`M${hw} ${hw} Q${p.x.toFixed(1)} ${p.y.toFixed(1)} ${tipX.toFixed(1)} ${tipY.toFixed(1)} Q${p.x.toFixed(1)} ${p.y.toFixed(1)} ${hw} ${hw}`}
                    fill={`${GA}0.12)`} stroke={G2} strokeWidth="1.0" opacity={0.80} />
                );
              })}

              {/* Inner petal ring dots */}
              {pts(hw, hw, S*0.34, 8, Math.PI/8).map((p, i) => (
                <SvgCircle key={`lotus8_tip_${i}`} cx={p.x} cy={p.y} r={2.5} fill={G3} opacity={0.70} />
              ))}

              {/* Core circles */}
              <SvgCircle cx={hw} cy={hw} r={S*0.16} fill={`${GA}0.10)`} stroke={G2} strokeWidth="1.2" opacity={0.75} />
              <SvgCircle cx={hw} cy={hw} r={S*0.08} fill={`${GA}0.18)`} stroke={G2} strokeWidth="1.0" opacity={0.85} />

              {/* Outer ring of jewel dots */}
              {pts(hw, hw, S*0.42, 8, 0).map((p, i) => (
                <SvgCircle key={`lotus_jewel_${i}`} cx={p.x} cy={p.y} r={2.0} fill={G3} opacity={0.55} />
              ))}
            </>
          ) : (
            // ── SRI YANTRA for sound / splash variants ──
            <>
              <Defs>
                <LinearGradient id="syMetalG" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%"   stopColor={G1} />
                  <Stop offset="50%"  stopColor={G3} />
                  <Stop offset="100%" stopColor={G2} />
                </LinearGradient>
              </Defs>
              <SvgCircle cx={hw} cy={hw} r={S*0.43} fill="none" stroke={G4}
                strokeWidth="0.8" opacity={0.40} strokeDasharray="6 6" />
              {[S*0.35, S*0.27, S*0.19, S*0.12].map((r, ti) => (
                <SvgPath key={`sy_d_${ti}`} d={poly(pts(hw, hw, r, 3, Math.PI/6))}
                  fill={`${GA}0.05)`}
                  stroke="url(#syMetalG)" strokeWidth={[2.0, 1.6, 1.4, 1.2][ti]} strokeLinejoin="round"
                  opacity={0.80} />
              ))}
              {[S*0.38, S*0.30, S*0.22, S*0.15, S*0.08].map((r, ti) => (
                <SvgPath key={`sy_u_${ti}`} d={poly(pts(hw, hw, r, 3, -Math.PI/6))}
                  fill={`${GA}0.04)`}
                  stroke="url(#syMetalG)" strokeWidth={[2.0, 1.6, 1.4, 1.2, 1.0][ti]} strokeLinejoin="round"
                  opacity={0.80} />
              ))}
              <SvgCircle cx={hw} cy={hw} r={S*0.035} fill={G1} opacity={0.90} />
              {pts(hw, hw, S*0.41, 8, 0).map((p, i) => (
                <SvgCircle key={`sy_lotus_${i}`} cx={p.x} cy={p.y} r={S*0.05}
                  fill={`${GA}0.07)`} stroke={G4} strokeWidth="0.7" opacity={0.45} />
              ))}
            </>
          )}
        </Svg>
      </Animated.View>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          SHAPE 3 — SHATKONA (Star of David / Merkaba)
          Union of masculine and feminine, fire and water.
          ════════════════════════════════════════════════════════════════════ */}
      {showShape(3) && (
      <Animated.View style={{
          position: 'absolute', width: S, height: S,
          opacity: op3,
          transform: [{ rotate: r0deg }, { scale: scSm }],
      }}>
        <Svg width={S} height={S}>
          {/* Very fine radial web — barely visible */}
          {pts(hw, hw, S*0.44, 36, 0).map((p, i) => (
            <SvgPath key={`sh_ray_${i}`}
              d={`M${hw} ${hw} L${p.x.toFixed(1)} ${p.y.toFixed(1)}`}
              stroke={G3} strokeWidth="0.3"
              opacity={0.06} />
          ))}
          {/* Outer dashed circle */}
          <SvgCircle cx={hw} cy={hw} r={S*0.43} fill="none" stroke={G4}
            strokeWidth="0.7" opacity={0.30} strokeDasharray="3 5" />
          {/* Upward triangle */}
          <SvgPath d={poly(pts(hw, hw, S*0.36, 3, -Math.PI/2))}
            fill={`${GA}0.06)`} stroke={G1} strokeWidth="2.0" opacity={0.90} />
          {/* Downward triangle */}
          <SvgPath d={poly(pts(hw, hw, S*0.36, 3, Math.PI/2))}
            fill={`${GA}0.06)`} stroke={G1} strokeWidth="2.0" opacity={0.90} />
          {/* Hexagram inner hexagon */}
          {pts(hw, hw, S*0.19, 6, 0).map((p, i, arr) => {
            const n = arr[(i+1)%arr.length];
            return <SvgPath key={`sh_h_${i}`}
              d={`M${p.x.toFixed(1)} ${p.y.toFixed(1)} L${n.x.toFixed(1)} ${n.y.toFixed(1)}`}
              stroke={G3} strokeWidth="1.0" opacity={0.60} />;
          })}
          {/* Vertex jewels */}
          {pts(hw, hw, S*0.36, 3, -Math.PI/2).map((p, i) => (
            <SvgCircle key={`sh_vup_${i}`} cx={p.x} cy={p.y} r={4.5} fill={G3} opacity={0.85} />
          ))}
          {pts(hw, hw, S*0.36, 3, Math.PI/2).map((p, i) => (
            <SvgCircle key={`sh_vdn_${i}`} cx={p.x} cy={p.y} r={4.5} fill={G3} opacity={0.85} />
          ))}
          {/* Inner rings */}
          <SvgCircle cx={hw} cy={hw} r={S*0.11} fill="none" stroke={G2} strokeWidth="1.0" opacity={0.65} />
          <SvgCircle cx={hw} cy={hw} r={S*0.055} fill="none" stroke={G3} strokeWidth="0.8"   opacity={0.75} />
        </Svg>
      </Animated.View>
      )}

      {/* Counter-rotation ring for Shatkona — adds life */}
      {showShape(3) && (
      <Animated.View style={{
          position: 'absolute', width: S, height: S,
          opacity: op3,
          transform: [{ rotate: r1degR }],
      }}>
        <Svg width={S} height={S}>
          {pts(hw, hw, S*0.43, 12, Math.PI/12).map((p, i) => (
            <SvgCircle key={`sh_orbit_${i}`} cx={p.x} cy={p.y} r={2.0}
              fill={G3} opacity={0.12 + (i%3)*0.08} />
          ))}
        </Svg>
      </Animated.View>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          ALWAYS VISIBLE — Slow orbiting stardust ring
          Very subtle — just a whisper of movement at the outer edge.
          ════════════════════════════════════════════════════════════════════ */}
      <Animated.View style={{
          position: 'absolute', width: S, height: S,
          transform: [{ rotate: r1degR }],
          opacity: variant === 'sound' ? 0.40 : variant === 'splash' ? 0.55 : 0.45,
      }}>
        <Svg width={S} height={S}>
          {pts(hw, hw, S*0.44, 16, 0).map((p, i) => (
            <SvgCircle key={`dust_${i}`} cx={p.x} cy={p.y}
              r={i % 4 === 0 ? 2.2 : 1.3}
              fill={G3}
              opacity={0.10 + (i % 4) * 0.08} />
          ))}
        </Svg>
      </Animated.View>

      {/* Splash: second stardust ring */}
      {variant === 'splash' && (
        <Animated.View style={{
            position: 'absolute', width: S, height: S,
            transform: [{ rotate: r3deg }],
            opacity: 0.30,
        }}>
          <Svg width={S} height={S}>
            {pts(hw, hw, S*0.36, 12, Math.PI/12).map((p, i) => (
              <SvgCircle key={`dust2_${i}`} cx={p.x} cy={p.y}
                r={i % 4 === 0 ? 2.0 : 1.0}
                fill={spG2}
                opacity={0.12 + (i % 5) * 0.08} />
            ))}
          </Svg>
        </Animated.View>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          Bindu — the sacred glowing center point
          The primordial dot from which all creation emerges.
          For home: very soft, subtle, calming.
          ════════════════════════════════════════════════════════════════════ */}
      <Animated.View style={{
        position: 'absolute',
        width: variant === 'sound' ? 12 : variant === 'home' ? 7 : 9,
        height: variant === 'sound' ? 12 : variant === 'home' ? 7 : 9,
        borderRadius: variant === 'sound' ? 6 : variant === 'home' ? 3.5 : 4.5,
        backgroundColor: G3,
        shadowColor: G1,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: variant === 'home' ? 0.8 : 1,
        shadowRadius: variant === 'sound' ? 20 : variant === 'splash' ? 18 : 12,
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
