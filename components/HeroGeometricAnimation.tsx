import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, Easing } from 'react-native';
import Svg, {
  Circle as SvgCircle, Path as SvgPath, G as SvgG,
  Defs, LinearGradient, RadialGradient, Stop, Line as SvgLine, Text as SvgText,
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

// ── Mathematical soul of each sacred shape ────────────────────────────────────
export const SHAPE_MATH: Array<{ title: string; eq1: string; eq2: string; insight: string }> = [
  {
    title: 'Deep Focus Yantra',
    eq1:   '∑ = 5▽ ∩ 4△',
    eq2:   'cos 30° = √3 / 2',
    insight: 'Absolute Stillness · Pure Geometry',
  },
  {
    title: "Metatron's Cube",
    eq1:   'V − E + F = 2',
    eq2:   '5 Platonic Solids Within',
    insight: "Euler's Polyhedron Formula",
  },
  {
    title: 'Śrī Yantra',
    eq1:   '∑ = 9△ ∩ 43 sub-△',
    eq2:   'sin 60° = √3 / 2',
    insight: 'Bindu  →  ∞',
  },
  {
    title: 'Shatkona',
    eq1:   'e^(iπ) + 1 = 0',
    eq2:   '6 × 60° = 360°',
    insight: "Euler's Identity · Perfect Symmetry",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// HeroGeometricAnimation
//
// 4 sacred shapes, each rendered as 3-4 independently rotating Animated.View
// layers using 6 prime-spaced rotation drivers (rotA–rotF at 18–48s).
// This creates genuine multi-axis mandala movement visible at meditative pace.
//
// onShapeChange: fires when the active shape transitions — used by the parent
// to display the matching mathematical equation.
// ─────────────────────────────────────────────────────────────────────────────

interface HeroGeometricAnimationProps {
  size: number;
  variant?: 'home' | 'sound' | 'splash' | 'minimal';
  theme?: 'light' | 'dark';
  speed?: 'slow' | 'fast';
  opacity?: number;
  accentColor?: string;
  audioMetering?: Animated.Value;
  /** Called with the new shape index (0-3) when shape transitions complete */
  onShapeChange?: (shapeIndex: number) => void;
  /** If provided, locks the animation to a specific shape index and disables cycling */
  shapeIndex?: number;
  /** External breath driver for dramatic inhale/exhale effects */
  externalBreath?: Animated.Value;
  /** If provided, restricts audio beat detector to only run when active */
  isActive?: boolean;
}

export function HeroGeometricAnimation({
  size,
  variant = 'home',
  theme = 'dark',
  speed = 'slow',
  opacity = 0.82,
  accentColor,
  audioMetering,
  onShapeChange,
  shapeIndex,
  externalBreath,
  isActive = true,
}: HeroGeometricAnimationProps) {
  const hw = size / 2;
  const S  = size;

  // ── Shape cycling ─────────────────────────────────────────────────────────
  const [activeShape, setActiveShape] = useState(0);
  const [nextShape,   setNextShape]   = useState<number | null>(null);

  // ── 6 independent rotation drivers ────────────────────────────────────────
  const rotA = useRef(new Animated.Value(0)).current; // CW  22s
  const rotB = useRef(new Animated.Value(0)).current; // CCW 34s
  const rotC = useRef(new Animated.Value(0)).current; // CW  48s
  const rotD = useRef(new Animated.Value(0)).current; // CW  18s (fastest)
  const rotE = useRef(new Animated.Value(0)).current; // CW  42s (slowest)
  const rotF = useRef(new Animated.Value(0)).current; // CCW 28s

  // ── Golden Shimmer (Independent Twinkling) ────────────────────────────────
  const shim1 = useRef(new Animated.Value(0)).current;
  const shim2 = useRef(new Animated.Value(0)).current;
  const shim3 = useRef(new Animated.Value(0)).current;
  const shim4 = useRef(new Animated.Value(0)).current;

  // ── Per-shape opacity ─────────────────────────────────────────────────────
  const op0 = useRef(new Animated.Value(1)).current;
  const op1 = useRef(new Animated.Value(0)).current;
  const op2 = useRef(new Animated.Value(0)).current;
  const op3 = useRef(new Animated.Value(0)).current;

  // ── Breath + pulse ────────────────────────────────────────────────────────
  const breath = useRef(new Animated.Value(0)).current;
  const pulse  = useRef(new Animated.Value(0)).current;

  // ── Sound ripples ─────────────────────────────────────────────────────────
  const ripple1 = useRef(new Animated.Value(0)).current;
  const ripple2 = useRef(new Animated.Value(0)).current;
  const ripple3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const isHome   = variant === 'home' || variant === 'minimal';
    const isSound  = variant === 'sound';
    const isSplash = variant === 'splash';

    // Meditative but clearly visible rotation speeds
    const SA = isHome ? 22000 : isSound ? 18000 : 22000;
    const SB = isHome ? 34000 : isSound ? 28000 : 34000;
    const SC = isHome ? 48000 : isSound ? 38000 : 48000;
    const SD = isHome ? 18000 : isSound ? 14000 : 18000;
    const SE = isHome ? 42000 : isSound ? 50000 : 42000;
    const SF = isHome ? 28000 : isSound ? 22000 : 28000;

    Animated.loop(Animated.timing(rotA, { toValue: 1, duration: SA, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(rotB, { toValue: 1, duration: SB, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(rotC, { toValue: 1, duration: SC, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(rotD, { toValue: 1, duration: SD, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(rotE, { toValue: 1, duration: SE, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(rotF, { toValue: 1, duration: SF, easing: Easing.linear, useNativeDriver: true })).start();

    // Shimmer loops
    const runShimmer = (anim: Animated.Value, dur: number) => {
      Animated.loop(Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: dur * 1.2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])).start();
    };
    runShimmer(shim1, 1400);
    runShimmer(shim2, 1900);
    runShimmer(shim3, 2300);
    runShimmer(shim4, 2800);

    // Breath
    const BREATH_DUR = isHome ? 11000 : isSound ? 8000 : 11000;
    Animated.loop(Animated.sequence([
      Animated.timing(breath, { toValue: 1, duration: BREATH_DUR, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(breath, { toValue: 0, duration: BREATH_DUR, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();

    // Bindu pulse
    const PULSE_DUR = isHome ? 4000 : 3200;
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: PULSE_DUR, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: PULSE_DUR, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();

    // Sound ripples
    if (isSound && !audioMetering) {
      const startRipple = (anim: Animated.Value, delay: number) => {
        Animated.sequence([
          Animated.delay(delay),
          Animated.loop(Animated.sequence([
            Animated.timing(anim, { toValue: 1, duration: 4500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
          ])),
        ]).start();
      };
      startRipple(ripple1, 0);
      startRipple(ripple2, 1500);
      startRipple(ripple3, 3000);
    }

    // Shape cycling
    const HOLD = isHome ? 14000 : isSound ? 12000 : isSplash ? 3000 : 9000;
    const FADE = isHome ? 3000  : isSound ? 3000  : isSplash ? 1200 : 2000;
    const ops  = [op0, op1, op2, op3];

    if (variant === 'minimal' || typeof shapeIndex === 'number') {
      const idx = typeof shapeIndex === 'number' ? shapeIndex : 0;
      op0.setValue(idx === 0 ? 1 : 0);
      op1.setValue(idx === 1 ? 1 : 0);
      op2.setValue(idx === 2 ? 1 : 0);
      op3.setValue(idx === 3 ? 1 : 0);
      setActiveShape(idx);
      onShapeChange?.(idx);
      return;
    }

    function runCycle(current: number) {
      const next = (current + 1) % 4;
      Animated.delay(HOLD).start(({ finished }) => {
        if (!finished) return;
        setNextShape(next);
        Animated.parallel([
          Animated.timing(ops[current], { toValue: 0, duration: FADE, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(ops[next],    { toValue: 1, duration: FADE, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]).start(({ finished }) => {
          if (!finished) return;
          setActiveShape(next);
          setNextShape(null);
          onShapeChange?.(next);
          runCycle(next);
        });
      });
    }
    runCycle(0);
  }, []);

  // Beat detector
  useEffect(() => {
    if (!audioMetering || variant !== 'sound' || !isActive) return;
    let lastLevel = 0, waveIndex = 0, lastWaveTime = 0;
    const waves = [ripple1, ripple2, ripple3];
    const listenerId = audioMetering.addListener(({ value }) => {
      const now = Date.now();
      if ((value - lastLevel > 0.03 && now - lastWaveTime > 250) || now - lastWaveTime > 2800) {
        lastWaveTime = now;
        const anim = waves[waveIndex]; waveIndex = (waveIndex + 1) % 3;
        anim.setValue(0);
        Animated.timing(anim, { toValue: 1, duration: 2500, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
      }
      lastLevel = value;
    });
    return () => audioMetering.removeListener(listenerId);
  }, [audioMetering, variant, isActive]);

  // ── Rotation interpolations ───────────────────────────────────────────────
  const CW  = (r: Animated.Value) => r.interpolate({ inputRange: [0,1], outputRange: ['0deg',   '360deg'] });
  const CCW = (r: Animated.Value) => r.interpolate({ inputRange: [0,1], outputRange: ['360deg', '0deg']   });

  const cwA = CW(rotA);  // 22s
  const cwC = CW(rotC);  // 48s — slowest forward
  const cwD = CW(rotD);  // 18s — fastest visible
  const cwE = CW(rotE);  // 42s
  const ccwB = CCW(rotB); // 34s
  const ccwF = CCW(rotF); // 28s

  const activeBreath = externalBreath || breath;

  // If driven by external breath, scale drastically from 35% (exhale) to 105% (inhale)
  const sc     = activeBreath.interpolate({ inputRange: [0,1], outputRange: externalBreath ? [0.35, 1.05] : (variant === 'home' ? [0.97,1.03] : [0.90,1.10]) });
  const scSlow = activeBreath.interpolate({ inputRange: [0,1], outputRange: externalBreath ? [0.38, 1.02] : [0.985,1.015] });
  
  // Dramatic opacity change for the geometry lines based on breath
  const geomOpacity = activeBreath.interpolate({ inputRange: [0,1], outputRange: externalBreath ? [0.15, 1] : [1, 1] });

  const bindOp = pulse.interpolate({ inputRange: [0,1], outputRange: [0.28, 0.95] });
  const bindSc = pulse.interpolate({ inputRange: [0,1], outputRange: [0.55, 1.6] });

  // ── Magnetic Liquid & Sand Mandala Drivers ──
  const liquidScale = activeBreath.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.05] });
  const particleSc  = activeBreath.interpolate({ inputRange: [0, 1], outputRange: [1.6, 0.40] });
  const particleOp  = activeBreath.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 0.9] });

  // ── Nebula Core (Galaxy center) drivers ──
  const nebulaCoreSc    = activeBreath.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.3] });
  const nebulaCoreOp    = activeBreath.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.2, 0.5, 1.0] });
  const galaxyArmSc     = activeBreath.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.1] });
  const galaxyEdgeSc    = activeBreath.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.15] });
  const galaxyEdgeOp    = activeBreath.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.15, 0.7] });

  // ── Shimmer Opacities ──
  const sOp1 = shim1.interpolate({ inputRange: [0, 1], outputRange: [0.1, 1] });
  const sOp2 = shim2.interpolate({ inputRange: [0, 1], outputRange: [0.1, 1] });
  const sOp3 = shim3.interpolate({ inputRange: [0, 1], outputRange: [0.1, 1] });
  const sOp4 = shim4.interpolate({ inputRange: [0, 1], outputRange: [0.1, 1] });

  // Circumference vibration waves
  const rip1Scale = ripple1.interpolate({ inputRange:[0,1], outputRange:[0.95,1.25] });
  const rip1Op    = ripple1.interpolate({ inputRange:[0,0.1,0.6,1], outputRange:[0,0.60,0.15,0] });
  const rip2Scale = ripple2.interpolate({ inputRange:[0,1], outputRange:[0.95,1.35] });
  const rip2Op    = ripple2.interpolate({ inputRange:[0,0.1,0.6,1], outputRange:[0,0.50,0.10,0] });
  const rip3Scale = ripple3.interpolate({ inputRange:[0,1], outputRange:[0.95,1.45] });
  const rip3Op    = ripple3.interpolate({ inputRange:[0,0.1,0.6,1], outputRange:[0,0.40,0.07,0] });

  // ── Colour palette ────────────────────────────────────────────────────────
  const homeBase = accentColor ?? '#80FFFF';
  const G1 = variant === 'splash' ? '#FFD700' : variant === 'sound' ? (accentColor ?? '#38bdf8') : homeBase;
  const G2 = variant === 'splash' ? '#FDB931' : variant === 'sound' ? blendHex(G1,'#a78bfa',0.4) : G1+'CC';
  const G3 = '#FFFFFF';
  const G4 = variant === 'splash' ? '#B8860B80' : G1+'44';
  const GA = `rgba(${hexToRgbStr(G1)},`;

  // Always true: keeps SVG mounted, relying purely on native opacity crossfade to fix the blinking/breaking bug
  const show = (idx: number) => true;

  // Rotating layer helper
  const RL = ({
    rot, children, op = op0, extraStyle = {},
  }: {
    rot: Animated.AnimatedInterpolation<string>;
    children: React.ReactNode;
    op?: Animated.Value;
    extraStyle?: object;
  }) => (
    <Animated.View
      style={[{ position:'absolute', width:S, height:S }, extraStyle, { transform:[{rotate:rot}] }]}
    >
      {children}
    </Animated.View>
  );

  return (
    <View
      pointerEvents="none"
      style={{ position:'absolute', width:S, height:S, zIndex:2, opacity, justifyContent:'center', alignItems:'center' }}
    >
      {/* ── Sound ripples ── */}
      {variant === 'sound' && (<>
        <Animated.View style={{ position:'absolute', width:S, height:S, borderRadius:S/2, borderWidth:1.5, borderColor:G1+'80', transform:[{scale:rip1Scale}], opacity:rip1Op }} />
        <Animated.View style={{ position:'absolute', width:S, height:S, borderRadius:S/2, borderWidth:1,   borderColor:G2+'60', transform:[{scale:rip2Scale}], opacity:rip2Op }} />
        <Animated.View style={{ position:'absolute', width:S, height:S, borderRadius:S/2, borderWidth:0.8, borderColor:G3+'40', transform:[{scale:rip3Scale}], opacity:rip3Op }} />
      </>)}


      {/* ══════════════════════════════════════════════════════════════════════
          SENTIENT GALAXY + NEBULA CORE (Universal for all variants)
          ══════════════════════════════════════════════════════════════════ */}
      {true && (
        <>
          {/* ── Nebula Core: Deep radiant glow at the galaxy center ── */}
          <Animated.View style={{ position: 'absolute', width: S, height: S, opacity: nebulaCoreOp, transform: [{ scale: nebulaCoreSc }] }}>
            <Svg width={S} height={S}>
              <Defs>
                {/* Hot stellar core — white-gold center bleeding to violet */}
                <RadialGradient id="nebulaCore" cx="50%" cy="50%" rx="50%" ry="50%" fx="50%" fy="50%">
                  <Stop offset="0%"   stopColor="#FFFFFF" stopOpacity="0.95" />
                  <Stop offset="8%"   stopColor="#FFF7C0" stopOpacity="0.80" />
                  <Stop offset="22%"  stopColor="#FFD700" stopOpacity="0.55" />
                  <Stop offset="50%"  stopColor="#f59e0b" stopOpacity="0.25" />
                  <Stop offset="75%"  stopColor="#7c3aed" stopOpacity="0.10" />
                  <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
                </RadialGradient>
                {/* Outer cosmic haze */}
                <RadialGradient id="nebulaHaze" cx="50%" cy="50%" rx="50%" ry="50%" fx="50%" fy="50%">
                  <Stop offset="0%"   stopColor="#7c3aed" stopOpacity="0" />
                  <Stop offset="40%"  stopColor="#4f46e5" stopOpacity="0.08" />
                  <Stop offset="80%"  stopColor="#1e3a8a" stopOpacity="0.18" />
                  <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
                </RadialGradient>
              </Defs>
              {/* Cosmic outer haze */}
              <SvgCircle cx={hw} cy={hw} r={S * 0.48} fill="url(#nebulaHaze)" />
              {/* Hot glowing core */}
              <SvgCircle cx={hw} cy={hw} r={S * 0.28} fill="url(#nebulaCore)" />
            </Svg>
          </Animated.View>

          {/* ── Galaxy Arm Layer A: CW slow (logarithmic spiral arm 1) ── */}
          <Animated.View style={{ position: 'absolute', width: S, height: S, opacity: sOp1, transform: [{ scale: galaxyArmSc }] }}>
            <RL rot={cwE} extraStyle={{ opacity: 0.9 }}>
              <Svg width={S} height={S}>
                {/* Inner arm: warm gold micro-stars */}
                {Array.from({ length: 160 }, (_, i) => {
                  const frac = i / 160;
                  // Logarithmic spiral: r grows with angle
                  const arms = 3;
                  const armIdx = i % arms;
                  const angle = (frac * Math.PI * 6) + (armIdx * (Math.PI * 2) / arms);
                  const radius = (S * 0.06) + (S * 0.38 * frac);
                  const x = hw + radius * Math.cos(angle);
                  const y = hw + radius * Math.sin(angle);
                  const r = frac < 0.2 ? 1.8 : frac < 0.5 ? 1.3 : 0.8;
                  const op = 0.9 - frac * 0.6;
                  const fill = frac < 0.15 ? '#FFFFFF' : frac < 0.4 ? '#FFF7C0' : frac < 0.7 ? '#FFD700' : '#fde68a';
                  return <SvgCircle key={`ga_${i}`} cx={x} cy={y} r={r} fill={fill} opacity={op} />;
                })}
              </Svg>
            </RL>
          </Animated.View>

          {/* ── Galaxy Arm Layer B: CCW medium (counter-spiral arm) ── */}
          <Animated.View style={{ position: 'absolute', width: S, height: S, opacity: sOp2, transform: [{ scale: galaxyArmSc }] }}>
            <RL rot={ccwB} extraStyle={{ opacity: 0.85 }}>
              <Svg width={S} height={S}>
                {Array.from({ length: 120 }, (_, i) => {
                  const frac = i / 120;
                  const arms = 2;
                  const armIdx = i % arms;
                  const angle = (frac * Math.PI * 4) + (armIdx * Math.PI) + Math.PI / 4;
                  const radius = (S * 0.08) + (S * 0.36 * frac);
                  const x = hw + radius * Math.cos(angle);
                  const y = hw + radius * Math.sin(angle);
                  const r = frac < 0.25 ? 1.6 : frac < 0.55 ? 1.1 : 0.7;
                  const op = 0.85 - frac * 0.55;
                  const fill = frac < 0.2 ? '#FFF7C0' : frac < 0.5 ? '#fde68a' : '#f59e0b';
                  return <SvgCircle key={`gb_${i}`} cx={x} cy={y} r={r} fill={fill} opacity={op} />;
                })}
              </Svg>
            </RL>
          </Animated.View>

          {/* ── Galaxy Arm Layer C: CW fast (dense inner arms) ── */}
          <Animated.View style={{ position: 'absolute', width: S, height: S, opacity: sOp3, transform: [{ scale: galaxyArmSc }] }}>
            <RL rot={cwD} extraStyle={{ opacity: 0.8 }}>
              <Svg width={S} height={S}>
                {Array.from({ length: 100 }, (_, i) => {
                  const frac = i / 100;
                  const arms = 4;
                  const armIdx = i % arms;
                  const angle = (frac * Math.PI * 3) + (armIdx * (Math.PI / 2));
                  const radius = S * 0.04 + S * 0.30 * frac;
                  const x = hw + radius * Math.cos(angle);
                  const y = hw + radius * Math.sin(angle);
                  const r = frac < 0.3 ? 2.0 : 1.2;
                  const op = 1.0 - frac * 0.7;
                  const fill = frac < 0.1 ? '#FFFFFF' : frac < 0.35 ? '#FFF7C0' : '#FFD700';
                  return <SvgCircle key={`gc_${i}`} cx={x} cy={y} r={r} fill={fill} opacity={op} />;
                })}
              </Svg>
            </RL>
          </Animated.View>

          {/* ── Galaxy Dust Cloud: CCW slow (volumetric scatter haze) ── */}
          <Animated.View style={{ position: 'absolute', width: S, height: S, opacity: sOp4, transform: [{ scale: galaxyEdgeSc }] }}>
            <RL rot={ccwF} extraStyle={{ opacity: 0.7 }}>
              <Svg width={S} height={S}>
                {/* Outer stardust scatter — not on a perfect ring */}
                {Array.from({ length: 200 }, (_, i) => {
                  // Volumetric distribution: more particles toward the edge, fading at boundary
                  const angle = (i / 200) * Math.PI * 2 * 3.7; // golden-angle-ish
                  const rFrac = Math.sqrt(i / 200); // square root for uniform area distribution
                  const radius = S * 0.05 + S * 0.42 * rFrac;
                  const x = hw + radius * Math.cos(angle);
                  const y = hw + radius * Math.sin(angle);
                  const r = rFrac < 0.3 ? 1.4 : rFrac < 0.6 ? 0.9 : 0.5;
                  const op = (1 - rFrac) * 0.7 + 0.05;
                  const fill = rFrac < 0.2 ? '#FFFDE7' : rFrac < 0.5 ? '#fde68a' : '#c084fc';
                  return <SvgCircle key={`gd_${i}`} cx={x} cy={y} r={r} fill={fill} opacity={op} />;
                })}
              </Svg>
            </RL>
          </Animated.View>

          {/* ── Outer Galaxy Edge Glimmer: scattered micro-stars ── */}
          <Animated.View style={{ position: 'absolute', width: S, height: S, opacity: galaxyEdgeOp }}>
            <RL rot={cwA} extraStyle={{ opacity: 0.6 }}>
              <Svg width={S} height={S}>
                {pts(hw, hw, S * 0.46, 64, 0).map((p, i) => (
                  <SvgCircle key={`ge_${i}`} cx={p.x} cy={p.y}
                    r={i % 7 === 0 ? 1.8 : i % 3 === 0 ? 1.0 : 0.5}
                    fill={i % 5 === 0 ? '#c084fc' : i % 3 === 0 ? '#fde68a' : '#FFFFFF'}
                    opacity={0.1 + (i % 8) * 0.07} />
                ))}
              </Svg>
            </RL>
          </Animated.View>

          {/* ── Galaxy Core Supernova Flash: bright pulsing center ── */}
          <Animated.View style={{ position: 'absolute', width: S * 0.12, height: S * 0.12, borderRadius: S * 0.06, backgroundColor: '#FFFFFF', opacity: Animated.multiply(nebulaCoreOp, 0.6 as any), transform: [{ scale: nebulaCoreSc }], shadowColor: '#FFD700', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: S * 0.1 }} />
        </>
      )}



      {/* ── Bindu — pulsing center ── */}
      <Animated.View style={{
        position:'absolute',
        width: variant==='sound' ? 13 : 8,
        height: variant==='sound' ? 13 : 8,
        borderRadius: 7,
        backgroundColor: '#FFD700',
        shadowColor: '#FFD700',
        shadowOffset: {width:0, height:0},
        shadowOpacity: 0.98,
        shadowRadius: variant==='sound' ? 22 : 28,
        opacity: bindOp,
        transform: [{scale: bindSc}],
      }} />

    </View>
  );
}

// ── Palette utilities ─────────────────────────────────────────────────────────
function hexToRgbStr(hex: string): string {
  const c = hex.replace('#','');
  if (c.length < 6) return '255,255,255';
  const r = parseInt(c.slice(0,2),16), g = parseInt(c.slice(2,4),16), b = parseInt(c.slice(4,6),16);
  if (isNaN(r)||isNaN(g)||isNaN(b)) return '255,255,255';
  return `${r},${g},${b}`;
}
function blendHex(c1: string, c2: string, t: number): string {
  const p1 = hexToRgbStr(c1).split(',').map(Number);
  const p2 = hexToRgbStr(c2).split(',').map(Number);
  return '#'+[0,1,2].map(i=>Math.round(p1[i]+(p2[i]-p1[i])*t).toString(16).padStart(2,'0')).join('');
}

export { pts as sacredDots };
