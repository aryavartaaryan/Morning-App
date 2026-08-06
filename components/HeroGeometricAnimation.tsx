import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, Easing } from 'react-native';
import Svg, {
  Circle as SvgCircle, Path as SvgPath, G as SvgG,
  Defs, LinearGradient, Stop, Line as SvgLine, Text as SvgText,
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

    if (variant === 'minimal') {
      op0.setValue(1); op1.setValue(0); op2.setValue(0); op3.setValue(0);
      setActiveShape(0);
      onShapeChange?.(0);
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
    if (!audioMetering || variant !== 'sound') return;
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
  }, [audioMetering, variant]);

  // ── Rotation interpolations ───────────────────────────────────────────────
  const CW  = (r: Animated.Value) => r.interpolate({ inputRange: [0,1], outputRange: ['0deg',   '360deg'] });
  const CCW = (r: Animated.Value) => r.interpolate({ inputRange: [0,1], outputRange: ['360deg', '0deg']   });

  const cwA = CW(rotA);  // 22s
  const cwC = CW(rotC);  // 48s — slowest forward
  const cwD = CW(rotD);  // 18s — fastest visible
  const cwE = CW(rotE);  // 42s
  const ccwB = CCW(rotB); // 34s
  const ccwF = CCW(rotF); // 28s

  const sc     = breath.interpolate({ inputRange: [0,1], outputRange: variant === 'home' ? [0.97,1.03] : [0.90,1.10] });
  const scSlow = breath.interpolate({ inputRange: [0,1], outputRange: [0.985,1.015] });
  const bindOp = pulse.interpolate({ inputRange: [0,1], outputRange: [0.28, 0.95] });
  const bindSc = pulse.interpolate({ inputRange: [0,1], outputRange: [0.55, 1.6] });

  const rip1Scale = ripple1.interpolate({ inputRange:[0,1], outputRange:[0.05,0.95] });
  const rip1Op    = ripple1.interpolate({ inputRange:[0,0.1,0.6,1], outputRange:[0,0.70,0.15,0] });
  const rip2Scale = ripple2.interpolate({ inputRange:[0,1], outputRange:[0.05,0.95] });
  const rip2Op    = ripple2.interpolate({ inputRange:[0,0.1,0.6,1], outputRange:[0,0.60,0.10,0] });
  const rip3Scale = ripple3.interpolate({ inputRange:[0,1], outputRange:[0.05,0.95] });
  const rip3Op    = ripple3.interpolate({ inputRange:[0,0.1,0.6,1], outputRange:[0,0.50,0.07,0] });

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

      {/* ── Splash nebula ── */}
      {variant === 'splash' && (
        <RL rot={cwC} extraStyle={{opacity:0.15}}>
          <Svg width={S} height={S}>
            {pts(S*0.5,S*0.5,S*0.47,28,0).map((p,i)=>(
              <SvgCircle key={`cosmos_${i}`} cx={p.x} cy={p.y}
                r={i%5===0?3:i%3===0?2:1.2}
                fill={i%7===0?'#FFD700':i%4===0?'#FDB931':'#FFF'}
                opacity={0.15+(i%6)*0.10} />
            ))}
          </Svg>
        </RL>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          SHAPE 0 — DEEP FOCUS YANTRA (Minimalist Sri Chakra)
          Layers: outer minimalist rings, 5 downward triangles, 4 upward triangles
          Formula: ∑ = 5▽ ∩ 4△
          ════════════════════════════════════════════════════════════════ */}
      {show(0) && (
        <Animated.View style={{ position:'absolute', width:S, height:S, opacity:op0, transform:[{scale:sc}] }}>
          {/* Outer focus rings — CW slowest */}
          <RL rot={cwE}>
            <Svg width={S} height={S}>
              <SvgCircle cx={hw} cy={hw} r={S*0.44} fill="none" stroke={G4} strokeWidth="0.5" opacity={0.30} strokeDasharray="3 12" />
              <SvgCircle cx={hw} cy={hw} r={S*0.41} fill="none" stroke={G2} strokeWidth="0.4" opacity={0.20} />
              {pts(hw,hw,S*0.44,12,0).map((p,i)=>(
                <SvgCircle key={`y0_oj_${i}`} cx={p.x} cy={p.y} r={1.5} fill={G3} opacity={0.15+(i%4)*0.07} />
              ))}
            </Svg>
          </RL>
          {/* 5 Downward Shakti Triangles — CCW medium */}
          <RL rot={ccwB}>
            <Svg width={S} height={S}>
              {[S*0.35, S*0.28, S*0.22, S*0.16, S*0.10].map((r,ti)=>(
                <SvgPath key={`y0_d_${ti}`} d={poly(pts(hw,hw,r,3,Math.PI/6))}
                  fill="none"
                  stroke={G2} strokeWidth="0.8" strokeLinejoin="round"
                  opacity={0.88} />
              ))}
              {pts(hw,hw,S*0.35,3,Math.PI/6).map((p,i)=>(
                <SvgCircle key={`y0_dvj_${i}`} cx={p.x} cy={p.y} r={2.0} fill={G3} opacity={0.78} />
              ))}
            </Svg>
          </RL>
          {/* 4 Upward Shiva Triangles — CW fast */}
          <RL rot={cwD}>
            <Svg width={S} height={S}>
              {[S*0.32, S*0.25, S*0.19, S*0.13].map((r,ti)=>(
                <SvgPath key={`y0_u_${ti}`} d={poly(pts(hw,hw,r,3,-Math.PI/6))}
                  fill="none"
                  stroke={G1} strokeWidth="0.8" strokeLinejoin="round"
                  opacity={0.92} />
              ))}
              {pts(hw,hw,S*0.32,3,-Math.PI/6).map((p,i)=>(
                <SvgCircle key={`y0_uvj_${i}`} cx={p.x} cy={p.y} r={2.5} fill={G3} opacity={0.80} />
              ))}
            </Svg>
          </RL>
          {/* Central Bindu & Tight rings — CCW fastest */}
          <RL rot={ccwF}>
            <Svg width={S} height={S}>
              <SvgCircle cx={hw} cy={hw} r={S*0.06} fill="none" stroke={G2} strokeWidth="0.6" opacity={0.4} strokeDasharray="2 4" />
              <SvgCircle cx={hw} cy={hw} r={S*0.03} fill={`${GA}0.1)`} stroke={G1} strokeWidth="0.5" opacity={0.8} />
              <SvgCircle cx={hw} cy={hw} r={S*0.015} fill={G3} opacity={0.95} />
            </Svg>
          </RL>
        </Animated.View>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          SHAPE 1 — METATRON'S CUBE
          Layers: outer orbit (CW slow), 13 circles (CCW med),
                  mesh lines (CW slow), star tetrahedron (CCW fast)
          Formula: V − E + F = 2
          ════════════════════════════════════════════════════════════════ */}
      {show(1) && (
        <Animated.View style={{ position:'absolute', width:S, height:S, opacity:op1, transform:[{scale:sc}] }}>
          {/* Outer orbit — CW slowest */}
          <RL rot={cwE}>
            <Svg width={S} height={S}>
              <SvgCircle cx={hw} cy={hw} r={S*0.44} fill="none" stroke={G4} strokeWidth="0.4" opacity={0.20} strokeDasharray="3 8" />
              {pts(hw,hw,S*0.44,18,0).map((p,i)=>(
                <SvgCircle key={`mc_o_${i}`} cx={p.x} cy={p.y} r={i%3===0?2.5:1.5} fill={G3} opacity={0.12+(i%4)*0.08} />
              ))}
            </Svg>
          </RL>
          
          {/* Star tetrahedron (Enlarged) + vertex jewels + Central Bindu — CCW fast */}
          <RL rot={ccwF}>
            <Svg width={S} height={S}>
              <SvgPath d={poly(pts(hw,hw,S*0.42,3,-Math.PI/2))}
                fill={`${GA}0.08)`} stroke={G1} strokeWidth="2.2" opacity={0.92} />
              <SvgPath d={poly(pts(hw,hw,S*0.42,3, Math.PI/2))}
                fill={`${GA}0.08)`} stroke={G1} strokeWidth="2.2" opacity={0.92} />
              {pts(hw,hw,S*0.42,6,0).map((p,i)=>(
                <SvgCircle key={`mc_vj_${i}`} cx={p.x} cy={p.y} r={3.2} fill={G3} opacity={0.82} />
              ))}
              
              {/* Elegant Central Dot (Bindu) */}
              <SvgCircle cx={hw} cy={hw} r={S*0.06} fill="none" stroke={G2} strokeWidth="0.6" opacity={0.3} strokeDasharray="2 4" />
              <SvgCircle cx={hw} cy={hw} r={6} fill={G1} opacity={0.95} />
              <SvgCircle cx={hw} cy={hw} r={2.5} fill={G3} opacity={1} />
            </Svg>
          </RL>
        </Animated.View>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          SHAPE 2 — ŚRĪ YANTRA (ENHANCED — multi-layer rotation)
          Classic: 9 interlocking triangles. Enhanced with:
          • Outer bhūpura (square ground) — CW slowest
          • Two full triangle sets counter-rotating independently
          • Inner bindu surrounded by 3 orbiting rings
          • 8-petal + 16-petal lotus rings (CCW)
          Formula: ∑ = 9△ ∩ 43 sub-△
          ════════════════════════════════════════════════════════════════ */}
      {show(2) && (
        <Animated.View style={{ position:'absolute', width:S, height:S, opacity:op2, transform:[{scale:sc}] }}>

          {/* Layer 1: outer rings + lotus 16 + 8 — CCW slowest */}
          <RL rot={ccwB}>
            <Svg width={S} height={S}>
              {/* Outer dashed circle */}
              <SvgCircle cx={hw} cy={hw} r={S*0.44} fill="none" stroke={G4} strokeWidth="0.5" opacity={0.28} strokeDasharray="5 8" />
              {/* 16-petal outer lotus */}
              {pts(hw,hw,S*0.41,16,0).map((p,i)=>(
                <SvgCircle key={`sy_l16_${i}`} cx={p.x} cy={p.y} r={S*0.05}
                  fill={`${GA}0.06)`} stroke={G4} strokeWidth="0.6" opacity={0.40} />
              ))}
              {/* 8-petal inner lotus */}
              {pts(hw,hw,S*0.41,8,Math.PI/8).map((p,i)=>(
                <SvgCircle key={`sy_l8_${i}`} cx={p.x} cy={p.y} r={S*0.04}
                  fill={`${GA}0.08)`} stroke={G2} strokeWidth="0.7" opacity={0.50} />
              ))}
              {/* 16 outer jewels */}
              {pts(hw,hw,S*0.44,16,Math.PI/16).map((p,i)=>(
                <SvgCircle key={`sy_oj_${i}`} cx={p.x} cy={p.y} r={1.8} fill={G3} opacity={0.15+(i%4)*0.08} />
              ))}
            </Svg>
          </RL>

          {/* Layer 2: Shakti (downward) triangles — CCW medium */}
          <RL rot={ccwF}>
            <Svg width={S} height={S}>
              {[S*0.35, S*0.27, S*0.19, S*0.12].map((r,ti)=>(
                <SvgPath key={`sy_d_${ti}`} d={poly(pts(hw,hw,r,3,Math.PI/6))}
                  fill={`${GA}${[0.07,0.06,0.05,0.04][ti]})`}
                  stroke={G2} strokeWidth={[2.2,1.8,1.5,1.2][ti]} strokeLinejoin="round"
                  opacity={0.88+ti*0.04} />
              ))}
              {/* Shakti vertex jewels */}
              {pts(hw,hw,S*0.35,3,Math.PI/6).map((p,i)=>(
                <SvgCircle key={`sy_dvj_${i}`} cx={p.x} cy={p.y} r={3.2} fill={G3} opacity={0.78} />
              ))}
            </Svg>
          </RL>

          {/* Layer 3: Shiva (upward) triangles — CW medium */}
          <RL rot={cwA}>
            <Svg width={S} height={S}>
              {[S*0.38, S*0.30, S*0.22, S*0.15, S*0.08].map((r,ti)=>(
                <SvgPath key={`sy_u_${ti}`} d={poly(pts(hw,hw,r,3,-Math.PI/6))}
                  fill={`${GA}${[0.06,0.05,0.04,0.03,0.02][ti]})`}
                  stroke={G1} strokeWidth={[2.2,1.8,1.5,1.2,1.0][ti]} strokeLinejoin="round"
                  opacity={0.88+ti*0.04} />
              ))}
              {/* Shiva vertex jewels */}
              {pts(hw,hw,S*0.38,3,-Math.PI/6).map((p,i)=>(
                <SvgCircle key={`sy_uvj_${i}`} cx={p.x} cy={p.y} r={3.5} fill={G3} opacity={0.80} />
              ))}
            </Svg>
          </RL>

          {/* Layer 4: inner bindu concentric rings + shadow — CW fast */}
          <RL rot={cwD}>
            <Svg width={S} height={S}>
              {/* Drop shadow offset */}
              <SvgG x="0" y="2" opacity="0.35">
                <SvgCircle cx={hw} cy={hw} r={S*0.036} fill="black" />
              </SvgG>
              {/* Three tight inner rings */}
              <SvgCircle cx={hw} cy={hw} r={S*0.10} fill="none" stroke={G2} strokeWidth="0.8" opacity={0.55} strokeDasharray="2 4" />
              <SvgCircle cx={hw} cy={hw} r={S*0.06} fill="none" stroke={G2} strokeWidth="0.9" opacity={0.65} />
              <SvgCircle cx={hw} cy={hw} r={S*0.036} fill={G1} opacity={0.95} />
              {/* 6 tight orbit dots */}
              {pts(hw,hw,S*0.08,6,0).map((p,i)=>(
                <SvgCircle key={`sy_id_${i}`} cx={p.x} cy={p.y} r={1.8} fill={G3} opacity={0.65} />
              ))}
            </Svg>
          </RL>

        </Animated.View>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          SHAPE 3 — SHATKONA (ENHANCED — 4 independently rotating layers)
          Two triangles counter-rotate against each other. Inner hexagon
          and radial web rotate on separate axes. Creates the Merkaba effect.
          Formula: e^(iπ) + 1 = 0
          ════════════════════════════════════════════════════════════════ */}
      {show(3) && (
        <Animated.View style={{ position:'absolute', width:S, height:S, opacity:op3, transform:[{scale:scSlow}] }}>

          {/* Layer 1: radial web + outer ring + orbit dots — CW slowest */}
          <RL rot={cwE}>
            <Svg width={S} height={S}>
              {pts(hw,hw,S*0.44,48,0).map((p,i)=>(
                <SvgPath key={`sh_r_${i}`}
                  d={`M${hw} ${hw} L${p.x.toFixed(1)} ${p.y.toFixed(1)}`}
                  stroke={G3} strokeWidth="0.3" opacity={0.055} />
              ))}
              <SvgCircle cx={hw} cy={hw} r={S*0.44} fill="none" stroke={G4} strokeWidth="0.6" opacity={0.28} strokeDasharray="3 7" />
              {pts(hw,hw,S*0.44,12,Math.PI/12).map((p,i)=>(
                <SvgCircle key={`sh_od_${i}`} cx={p.x} cy={p.y} r={i%3===0?2.5:1.6} fill={G3} opacity={0.12+(i%4)*0.09} />
              ))}
            </Svg>
          </RL>

          {/* Layer 2: UPWARD triangle — CCW medium — Shiva/fire/masculine */}
          <RL rot={ccwB}>
            <Svg width={S} height={S}>
              <SvgPath d={poly(pts(hw,hw,S*0.36,3,-Math.PI/2))}
                fill={`${GA}0.08)`} stroke={G1} strokeWidth="2.4" opacity={0.94} />
              {pts(hw,hw,S*0.36,3,-Math.PI/2).map((p,i)=>(
                <SvgCircle key={`sh_utj_${i}`} cx={p.x} cy={p.y} r={5.0} fill={G3} opacity={0.90} />
              ))}
            </Svg>
          </RL>

          {/* Layer 3: DOWNWARD triangle — CW fast — counter-rotates vs Layer 2 */}
          <RL rot={cwA}>
            <Svg width={S} height={S}>
              <SvgPath d={poly(pts(hw,hw,S*0.36,3, Math.PI/2))}
                fill={`${GA}0.08)`} stroke={G1} strokeWidth="2.4" opacity={0.94} />
              {pts(hw,hw,S*0.36,3, Math.PI/2).map((p,i)=>(
                <SvgCircle key={`sh_dtj_${i}`} cx={p.x} cy={p.y} r={5.0} fill={G3} opacity={0.90} />
              ))}
            </Svg>
          </RL>

          {/* Layer 4: inner hexagon + inner jewels + inner rings — CCW slowest */}
          <RL rot={ccwF}>
            <Svg width={S} height={S}>
              {pts(hw,hw,S*0.19,6,0).map((p,i,arr)=>{
                const n=arr[(i+1)%arr.length];
                return <SvgPath key={`sh_h_${i}`}
                  d={`M${p.x.toFixed(1)} ${p.y.toFixed(1)} L${n.x.toFixed(1)} ${n.y.toFixed(1)}`}
                  stroke={G3} strokeWidth="1.2" opacity={0.65} />;
              })}
              {pts(hw,hw,S*0.19,6,0).map((p,i)=>(
                <SvgCircle key={`sh_ij_${i}`} cx={p.x} cy={p.y} r={3.2} fill={G3} opacity={0.72} />
              ))}
              {/* Mid-orbit 12 dots */}
              {pts(hw,hw,S*0.28,12,0).map((p,i)=>(
                <SvgCircle key={`sh_mj_${i}`} cx={p.x} cy={p.y} r={1.5} fill={G3} opacity={0.18+(i%4)*0.08} />
              ))}
              <SvgCircle cx={hw} cy={hw} r={S*0.12} fill="none" stroke={G2} strokeWidth="1.0" opacity={0.68} />
              <SvgCircle cx={hw} cy={hw} r={S*0.06} fill="none" stroke={G3} strokeWidth="0.9" opacity={0.78} />
            </Svg>
          </RL>

        </Animated.View>
      )}

      {/* ── Always-visible dual counter-rotating stardust rings ── */}
      <Animated.View style={{ position:'absolute', width:S, height:S, opacity: variant==='sound'?0.35:0.45, transform:[{rotate:cwC}] }}>
        <Svg width={S} height={S}>
          {pts(hw,hw,S*0.44,20,0).map((p,i)=>(
            <SvgCircle key={`da_${i}`} cx={p.x} cy={p.y}
              r={i%5===0?2.5:i%3===0?1.8:1.2} fill={G3} opacity={0.07+(i%5)*0.06} />
          ))}
        </Svg>
      </Animated.View>
      <Animated.View style={{ position:'absolute', width:S, height:S, opacity: variant==='splash'?0.40:0.30, transform:[{rotate:ccwB}] }}>
        <Svg width={S} height={S}>
          {pts(hw,hw,S*0.34,16,Math.PI/16).map((p,i)=>(
            <SvgCircle key={`db_${i}`} cx={p.x} cy={p.y}
              r={i%4===0?2.0:1.0} fill={G3} opacity={0.06+(i%4)*0.05} />
          ))}
        </Svg>
      </Animated.View>

      {/* ── Bindu — the sacred center point ── */}
      <Animated.View style={{
        position:'absolute',
        width: variant==='sound' ? 13 : 8,
        height: variant==='sound' ? 13 : 8,
        borderRadius: 7,
        backgroundColor: G3,
        shadowColor: G1,
        shadowOffset: {width:0, height:0},
        shadowOpacity: 0.98,
        shadowRadius: variant==='sound' ? 22 : 14,
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
