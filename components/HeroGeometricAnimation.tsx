import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing } from 'react-native';
import Svg, {
  Circle as SvgCircle, Path as SvgPath, G as SvgG,
  Defs, LinearGradient, Stop, Line as SvgLine,
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
    title: 'Trikona Mandala',
    eq1:   'sin 60° = √3 / 2',
    eq2:   '3 × 120° = 360°',
    insight: 'Trinity · Creation · Balance',
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
  {
    title: 'Vesica Piscis',
    eq1:   'r / d = 1 / √3',
    eq2:   '2 △ share one edge',
    insight: 'Womb of Creation · Genesis',
  },
  {
    title: 'Cosmic Merkaba',
    eq1:   '∑ = 2 Tetrahedra',
    eq2:   'φ² = φ + 1',
    insight: 'Light Body · Ascension Vehicle',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// HeroGeometricAnimation — 6 triangular sacred shapes, no blink/break
// All transitions use pure Animated.Value opacity crossfade — zero React
// state changes during animation so there is NO re-render blinking.
// ─────────────────────────────────────────────────────────────────────────────

const NUM_SHAPES = 6;

interface HeroGeometricAnimationProps {
  size: number;
  variant?: 'home' | 'sound' | 'splash' | 'minimal';
  theme?: 'light' | 'dark';
  speed?: 'slow' | 'fast';
  opacity?: number;
  accentColor?: string;
  audioMetering?: Animated.Value;
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

  // ── 6 independent rotation drivers ────────────────────────────────────────
  const rotA = useRef(new Animated.Value(0)).current; // CW  22s
  const rotB = useRef(new Animated.Value(0)).current; // CCW 34s
  const rotC = useRef(new Animated.Value(0)).current; // CW  48s
  const rotD = useRef(new Animated.Value(0)).current; // CW  18s
  const rotE = useRef(new Animated.Value(0)).current; // CW  42s
  const rotF = useRef(new Animated.Value(0)).current; // CCW 28s

  // ── Per-shape opacity — pure Animated.Value, NO state changes ─────────────
  const ops = useRef(
    Array.from({ length: NUM_SHAPES }, (_, i) => new Animated.Value(i === 0 ? 1 : 0))
  ).current;

  // ── Breath + pulse ────────────────────────────────────────────────────────
  const breath = useRef(new Animated.Value(0)).current;
  const pulse  = useRef(new Animated.Value(0)).current;

  // ── Sound ripples ─────────────────────────────────────────────────────────
  const ripple1 = useRef(new Animated.Value(0)).current;
  const ripple2 = useRef(new Animated.Value(0)).current;
  const ripple3 = useRef(new Animated.Value(0)).current;

  // Current shape index tracked in a ref — no re-render needed
  const currentShapeRef = useRef(0);

  useEffect(() => {
    const isHome   = variant === 'home' || variant === 'minimal';
    const isSound  = variant === 'sound';

    const SA = isHome ? 22000 : isSound ? 18000 : 8000;
    const SB = isHome ? 34000 : isSound ? 28000 : 12000;
    const SC = isHome ? 48000 : isSound ? 38000 : 18000;
    const SD = isHome ? 18000 : isSound ? 14000 : 6000;
    const SE = isHome ? 42000 : isSound ? 50000 : 22000;
    const SF = isHome ? 28000 : isSound ? 22000 : 10000;

    Animated.loop(Animated.timing(rotA, { toValue: 1, duration: SA, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(rotB, { toValue: 1, duration: SB, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(rotC, { toValue: 1, duration: SC, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(rotD, { toValue: 1, duration: SD, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(rotE, { toValue: 1, duration: SE, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(rotF, { toValue: 1, duration: SF, easing: Easing.linear, useNativeDriver: true })).start();

    const BREATH_DUR = isHome ? 11000 : 8000;
    Animated.loop(Animated.sequence([
      Animated.timing(breath, { toValue: 1, duration: BREATH_DUR, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(breath, { toValue: 0, duration: BREATH_DUR, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();

    const PULSE_DUR = isHome ? 4000 : 3200;
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: PULSE_DUR, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: PULSE_DUR, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();

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

    if (variant === 'minimal') {
      ops.forEach((op, i) => op.setValue(i === 0 ? 1 : 0));
      onShapeChange?.(0);
      return;
    }

    const isSplash = variant === 'splash';
    const HOLD = isHome ? 14000 : isSound ? 12000 : isSplash ? 2200 : 9000;
    const FADE = isHome ? 3000  : isSound ? 3000  : isSplash ? 1000 : 2000;

    // ── Pure Animated crossfade cycle — zero React state, zero blink ─────────
    function runCycle(current: number) {
      const next = (current + 1) % NUM_SHAPES;
      Animated.delay(HOLD).start(({ finished }) => {
        if (!finished) return;
        Animated.parallel([
          Animated.timing(ops[current], { toValue: 0, duration: FADE, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(ops[next],    { toValue: 1, duration: FADE, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]).start(({ finished }) => {
          if (!finished) return;
          currentShapeRef.current = next;
          onShapeChange?.(next);
          runCycle(next);
        });
      });
    }
    runCycle(0);
  }, []);

  // Beat detector for sound mode
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

  const cwA = CW(rotA);
  const cwC = CW(rotC);
  const cwD = CW(rotD);
  const cwE = CW(rotE);
  const ccwB = CCW(rotB);
  const ccwF = CCW(rotF);

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

  // Rotating layer helper
  const RL = ({
    rot, children, extraStyle = {},
  }: {
    rot: Animated.AnimatedInterpolation<string>;
    children: React.ReactNode;
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

      {/* ════════════════════════════════════════════════════════════════════
          SHAPE 0 — TRIKONA MANDALA
          A nested set of 7 counter-rotating equilateral triangles,
          creating a hypnotic, breathing mandala — pure triangle meditation.
          Formula: sin 60° = √3/2  |  Trinity · Creation · Balance
          ════════════════════════════════════════════════════════════════ */}
      <Animated.View style={{ position:'absolute', width:S, height:S, opacity:ops[0], transform:[{scale:sc}] }}>
        {/* Outermost dashed orbit — CCW slowest */}
        <RL rot={ccwB}>
          <Svg width={S} height={S}>
            <SvgCircle cx={hw} cy={hw} r={S*0.44} fill="none" stroke={G4} strokeWidth="0.5" opacity={0.25} strokeDasharray="5 10" />
            {/* 12 orbit jewels */}
            {pts(hw,hw,S*0.44,12,Math.PI/12).map((p,i)=>(
              <SvgCircle key={`tm_oj_${i}`} cx={p.x} cy={p.y} r={i%3===0?2.2:1.3} fill={G3} opacity={0.10+(i%4)*0.07} />
            ))}
          </Svg>
        </RL>
        {/* Outer triangle — CW slowest */}
        <RL rot={cwE}>
          <Svg width={S} height={S}>
            <SvgPath d={poly(pts(hw,hw,S*0.40,3,-Math.PI/2))}
              fill={`${GA}0.04)`} stroke={G1} strokeWidth="1.8" strokeLinejoin="round" opacity={0.70} />
            {pts(hw,hw,S*0.40,3,-Math.PI/2).map((p,i)=>(
              <SvgCircle key={`tm_ov_${i}`} cx={p.x} cy={p.y} r={3.5} fill={G3} opacity={0.75} />
            ))}
          </Svg>
        </RL>
        {/* Second triangle inverted — CCW medium */}
        <RL rot={ccwF}>
          <Svg width={S} height={S}>
            <SvgPath d={poly(pts(hw,hw,S*0.34,3, Math.PI/2))}
              fill={`${GA}0.06)`} stroke={G2} strokeWidth="2.0" strokeLinejoin="round" opacity={0.80} />
            {pts(hw,hw,S*0.34,3, Math.PI/2).map((p,i)=>(
              <SvgCircle key={`tm_inv_${i}`} cx={p.x} cy={p.y} r={3.0} fill={G3} opacity={0.80} />
            ))}
          </Svg>
        </RL>
        {/* Third triangle — CW medium */}
        <RL rot={cwA}>
          <Svg width={S} height={S}>
            <SvgPath d={poly(pts(hw,hw,S*0.27,3,-Math.PI/2))}
              fill={`${GA}0.08)`} stroke={G1} strokeWidth="1.8" strokeLinejoin="round" opacity={0.88} />
            {pts(hw,hw,S*0.27,3,-Math.PI/2).map((p,i)=>(
              <SvgCircle key={`tm_mv_${i}`} cx={p.x} cy={p.y} r={2.5} fill={G3} opacity={0.82} />
            ))}
          </Svg>
        </RL>
        {/* Fourth triangle inverted — CCW fast */}
        <RL rot={ccwB}>
          <Svg width={S} height={S}>
            <SvgPath d={poly(pts(hw,hw,S*0.20,3, Math.PI/2))}
              fill={`${GA}0.10)`} stroke={G2} strokeWidth="1.6" strokeLinejoin="round" opacity={0.90} />
            {pts(hw,hw,S*0.20,3, Math.PI/2).map((p,i)=>(
              <SvgCircle key={`tm_fv_${i}`} cx={p.x} cy={p.y} r={2.2} fill={G3} opacity={0.85} />
            ))}
          </Svg>
        </RL>
        {/* Fifth inner triangle — CW fast */}
        <RL rot={cwD}>
          <Svg width={S} height={S}>
            <SvgPath d={poly(pts(hw,hw,S*0.13,3,-Math.PI/2))}
              fill={`${GA}0.12)`} stroke={G1} strokeWidth="1.4" strokeLinejoin="round" opacity={0.92} />
            <SvgCircle cx={hw} cy={hw} r={S*0.10} fill="none" stroke={G4} strokeWidth="0.7" opacity={0.40} strokeDasharray="3 5" />
            <SvgCircle cx={hw} cy={hw} r={S*0.05} fill="none" stroke={G2} strokeWidth="0.9" opacity={0.55} />
          </Svg>
        </RL>
      </Animated.View>

      {/* ════════════════════════════════════════════════════════════════════
          SHAPE 1 — METATRON'S CUBE
          Layers: outer orbit (CW slow), 13 circles (CCW med),
                  mesh lines (CW slow), star tetrahedron (CCW fast)
          Formula: V − E + F = 2
          ════════════════════════════════════════════════════════════════ */}
      <Animated.View style={{ position:'absolute', width:S, height:S, opacity:ops[1], transform:[{scale:sc}] }}>
        <RL rot={cwE}>
          <Svg width={S} height={S}>
            <SvgCircle cx={hw} cy={hw} r={S*0.44} fill="none" stroke={G4} strokeWidth="0.4" opacity={0.20} strokeDasharray="3 8" />
            {pts(hw,hw,S*0.44,18,0).map((p,i)=>(
              <SvgCircle key={`mc_o_${i}`} cx={p.x} cy={p.y} r={i%3===0?2.5:1.5} fill={G3} opacity={0.12+(i%4)*0.08} />
            ))}
          </Svg>
        </RL>
        <RL rot={ccwB}>
          <Svg width={S} height={S}>
            {[{x:hw,y:hw},...pts(hw,hw,S*0.19,6,0),...pts(hw,hw,S*0.38,6,0)].map((p,i)=>(
              <SvgCircle key={`mc_c_${i}`} cx={p.x} cy={p.y} r={S*0.19}
                fill={`${GA}0.04)`} stroke={G2} strokeWidth="1.0" opacity={i===0?0.90:0.58} />
            ))}
            <SvgPath d={poly(pts(hw,hw,S*0.34,6,0))} fill="none" stroke={G3} strokeWidth="0.8" opacity={0.42} />
          </Svg>
        </RL>
        <RL rot={cwC}>
          <Svg width={S} height={S}>
            {(()=>{
              const c=[{x:hw,y:hw},...pts(hw,hw,S*0.19,6,0),...pts(hw,hw,S*0.38,6,0)];
              return c.flatMap((a,i)=>c.filter((_,j)=>j>i).map((b,j)=>(
                <SvgPath key={`mc_l_${i}_${j}`}
                  d={`M${a.x.toFixed(1)} ${a.y.toFixed(1)} L${b.x.toFixed(1)} ${b.y.toFixed(1)}`}
                  stroke={G4} strokeWidth="0.35" opacity={0.18} />
              )));
            })()}
          </Svg>
        </RL>
        <RL rot={ccwF}>
          <Svg width={S} height={S}>
            <SvgPath d={poly(pts(hw,hw,S*0.34,3,-Math.PI/2))}
              fill={`${GA}0.10)`} stroke={G1} strokeWidth="2.2" opacity={0.92} />
            <SvgPath d={poly(pts(hw,hw,S*0.34,3, Math.PI/2))}
              fill={`${GA}0.10)`} stroke={G1} strokeWidth="2.2" opacity={0.92} />
            {pts(hw,hw,S*0.34,6,0).map((p,i)=>(
              <SvgCircle key={`mc_vj_${i}`} cx={p.x} cy={p.y} r={3.2} fill={G3} opacity={0.82} />
            ))}
          </Svg>
        </RL>
      </Animated.View>

      {/* ════════════════════════════════════════════════════════════════════
          SHAPE 2 — ŚRĪ YANTRA
          Classic: 9 interlocking triangles.
          Formula: ∑ = 9△ ∩ 43 sub-△
          ════════════════════════════════════════════════════════════════ */}
      <Animated.View style={{ position:'absolute', width:S, height:S, opacity:ops[2], transform:[{scale:sc}] }}>
        <RL rot={ccwB}>
          <Svg width={S} height={S}>
            <SvgCircle cx={hw} cy={hw} r={S*0.44} fill="none" stroke={G4} strokeWidth="0.5" opacity={0.28} strokeDasharray="5 8" />
            {pts(hw,hw,S*0.41,16,0).map((p,i)=>(
              <SvgCircle key={`sy_l16_${i}`} cx={p.x} cy={p.y} r={S*0.05}
                fill={`${GA}0.06)`} stroke={G4} strokeWidth="0.6" opacity={0.40} />
            ))}
            {pts(hw,hw,S*0.41,8,Math.PI/8).map((p,i)=>(
              <SvgCircle key={`sy_l8_${i}`} cx={p.x} cy={p.y} r={S*0.04}
                fill={`${GA}0.08)`} stroke={G2} strokeWidth="0.7" opacity={0.50} />
            ))}
            {pts(hw,hw,S*0.44,16,Math.PI/16).map((p,i)=>(
              <SvgCircle key={`sy_oj_${i}`} cx={p.x} cy={p.y} r={1.8} fill={G3} opacity={0.15+(i%4)*0.08} />
            ))}
          </Svg>
        </RL>
        <RL rot={ccwF}>
          <Svg width={S} height={S}>
            {[S*0.35, S*0.27, S*0.19, S*0.12].map((r,ti)=>(
              <SvgPath key={`sy_d_${ti}`} d={poly(pts(hw,hw,r,3,Math.PI/6))}
                fill={`${GA}${[0.07,0.06,0.05,0.04][ti]})`}
                stroke={G2} strokeWidth={[2.2,1.8,1.5,1.2][ti]} strokeLinejoin="round"
                opacity={0.88+ti*0.04} />
            ))}
            {pts(hw,hw,S*0.35,3,Math.PI/6).map((p,i)=>(
              <SvgCircle key={`sy_dvj_${i}`} cx={p.x} cy={p.y} r={3.2} fill={G3} opacity={0.78} />
            ))}
          </Svg>
        </RL>
        <RL rot={cwA}>
          <Svg width={S} height={S}>
            {[S*0.38, S*0.30, S*0.22, S*0.15, S*0.08].map((r,ti)=>(
              <SvgPath key={`sy_u_${ti}`} d={poly(pts(hw,hw,r,3,-Math.PI/6))}
                fill={`${GA}${[0.06,0.05,0.04,0.03,0.02][ti]})`}
                stroke={G1} strokeWidth={[2.2,1.8,1.5,1.2,1.0][ti]} strokeLinejoin="round"
                opacity={0.88+ti*0.04} />
            ))}
            {pts(hw,hw,S*0.38,3,-Math.PI/6).map((p,i)=>(
              <SvgCircle key={`sy_uvj_${i}`} cx={p.x} cy={p.y} r={3.5} fill={G3} opacity={0.80} />
            ))}
          </Svg>
        </RL>
        <RL rot={cwD}>
          <Svg width={S} height={S}>
            <SvgCircle cx={hw} cy={hw} r={S*0.10} fill="none" stroke={G2} strokeWidth="0.8" opacity={0.55} strokeDasharray="2 4" />
            <SvgCircle cx={hw} cy={hw} r={S*0.06} fill="none" stroke={G2} strokeWidth="0.9" opacity={0.65} />
            <SvgCircle cx={hw} cy={hw} r={S*0.036} fill={G1} opacity={0.95} />
            {pts(hw,hw,S*0.08,6,0).map((p,i)=>(
              <SvgCircle key={`sy_id_${i}`} cx={p.x} cy={p.y} r={1.8} fill={G3} opacity={0.65} />
            ))}
          </Svg>
        </RL>
      </Animated.View>

      {/* ════════════════════════════════════════════════════════════════════
          SHAPE 3 — SHATKONA (Star of David / Merkaba ground)
          Two triangles counter-rotating. Merkaba effect.
          Formula: e^(iπ) + 1 = 0
          ════════════════════════════════════════════════════════════════ */}
      <Animated.View style={{ position:'absolute', width:S, height:S, opacity:ops[3], transform:[{scale:scSlow}] }}>
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
        <RL rot={ccwB}>
          <Svg width={S} height={S}>
            <SvgPath d={poly(pts(hw,hw,S*0.36,3,-Math.PI/2))}
              fill={`${GA}0.08)`} stroke={G1} strokeWidth="2.4" opacity={0.94} />
            {pts(hw,hw,S*0.36,3,-Math.PI/2).map((p,i)=>(
              <SvgCircle key={`sh_utj_${i}`} cx={p.x} cy={p.y} r={5.0} fill={G3} opacity={0.90} />
            ))}
          </Svg>
        </RL>
        <RL rot={cwA}>
          <Svg width={S} height={S}>
            <SvgPath d={poly(pts(hw,hw,S*0.36,3, Math.PI/2))}
              fill={`${GA}0.08)`} stroke={G1} strokeWidth="2.4" opacity={0.94} />
            {pts(hw,hw,S*0.36,3, Math.PI/2).map((p,i)=>(
              <SvgCircle key={`sh_dtj_${i}`} cx={p.x} cy={p.y} r={5.0} fill={G3} opacity={0.90} />
            ))}
          </Svg>
        </RL>
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
            {pts(hw,hw,S*0.28,12,0).map((p,i)=>(
              <SvgCircle key={`sh_mj_${i}`} cx={p.x} cy={p.y} r={1.5} fill={G3} opacity={0.18+(i%4)*0.08} />
            ))}
            <SvgCircle cx={hw} cy={hw} r={S*0.12} fill="none" stroke={G2} strokeWidth="1.0" opacity={0.68} />
            <SvgCircle cx={hw} cy={hw} r={S*0.06} fill="none" stroke={G3} strokeWidth="0.9" opacity={0.78} />
          </Svg>
        </RL>
      </Animated.View>

      {/* ════════════════════════════════════════════════════════════════════
          SHAPE 4 — VESICA PISCIS TRIKONA
          Two overlapping triangles sharing an edge, surrounded by 6
          nested inverted triangular gates — the womb of creation.
          Entirely triangle-based. Formula: r/d = 1/√3
          ════════════════════════════════════════════════════════════════ */}
      <Animated.View style={{ position:'absolute', width:S, height:S, opacity:ops[4], transform:[{scale:scSlow}] }}>
        {/* Outer dashed orbit — CW slowest */}
        <RL rot={cwE}>
          <Svg width={S} height={S}>
            <SvgCircle cx={hw} cy={hw} r={S*0.44} fill="none" stroke={G4} strokeWidth="0.5" opacity={0.22} strokeDasharray="6 10" />
            {pts(hw,hw,S*0.44,18,0).map((p,i)=>(
              <SvgCircle key={`vp_oj_${i}`} cx={p.x} cy={p.y} r={i%6===0?2.8:1.2} fill={G3} opacity={0.08+(i%3)*0.06} />
            ))}
          </Svg>
        </RL>
        {/* 6 outward "gateway" triangles pointing from center — CW medium */}
        <RL rot={cwA}>
          <Svg width={S} height={S}>
            {pts(hw,hw,S*0.25,6,Math.PI/6).map((p,i)=>{
              const angle = Math.PI/6 + (i * Math.PI * 2) / 6;
              const tip = { x: hw + S*0.42 * Math.cos(angle), y: hw + S*0.42 * Math.sin(angle) };
              const l = { x: hw + S*0.22 * Math.cos(angle + 0.5), y: hw + S*0.22 * Math.sin(angle + 0.5) };
              const r = { x: hw + S*0.22 * Math.cos(angle - 0.5), y: hw + S*0.22 * Math.sin(angle - 0.5) };
              return <SvgPath key={`vp_g_${i}`} d={`M${l.x.toFixed(1)} ${l.y.toFixed(1)} L${tip.x.toFixed(1)} ${tip.y.toFixed(1)} L${r.x.toFixed(1)} ${r.y.toFixed(1)} Z`}
                fill={`${GA}0.05)`} stroke={G2} strokeWidth="1.4" strokeLinejoin="round" opacity={0.72} />;
            })}
          </Svg>
        </RL>
        {/* Main upward triangle — CCW medium */}
        <RL rot={ccwF}>
          <Svg width={S} height={S}>
            <SvgPath d={poly(pts(hw,hw,S*0.35,3,-Math.PI/2))}
              fill={`${GA}0.10)`} stroke={G1} strokeWidth="2.4" strokeLinejoin="round" opacity={0.94} />
            {pts(hw,hw,S*0.35,3,-Math.PI/2).map((p,i)=>(
              <SvgCircle key={`vp_uv_${i}`} cx={p.x} cy={p.y} r={4.5} fill={G3} opacity={0.88} />
            ))}
          </Svg>
        </RL>
        {/* Main downward triangle — CW fast */}
        <RL rot={cwD}>
          <Svg width={S} height={S}>
            <SvgPath d={poly(pts(hw,hw,S*0.35,3, Math.PI/2))}
              fill={`${GA}0.10)`} stroke={G2} strokeWidth="2.4" strokeLinejoin="round" opacity={0.94} />
            {pts(hw,hw,S*0.35,3, Math.PI/2).map((p,i)=>(
              <SvgCircle key={`vp_dv_${i}`} cx={p.x} cy={p.y} r={4.5} fill={G3} opacity={0.88} />
            ))}
          </Svg>
        </RL>
        {/* Inner small nested triangles — CCW fast */}
        <RL rot={ccwB}>
          <Svg width={S} height={S}>
            {[S*0.22, S*0.14, S*0.07].map((r,ti)=>(
              <SvgPath key={`vp_i_${ti}`} d={poly(pts(hw,hw,r,3,ti%2===0?-Math.PI/2:Math.PI/2))}
                fill={`${GA}${[0.08,0.10,0.14][ti]})`}
                stroke={ti%2===0?G1:G2} strokeWidth={[1.8,1.4,1.0][ti]} strokeLinejoin="round"
                opacity={0.88} />
            ))}
            <SvgCircle cx={hw} cy={hw} r={S*0.05} fill="none" stroke={G2} strokeWidth="0.9" opacity={0.65} />
          </Svg>
        </RL>
      </Animated.View>

      {/* ════════════════════════════════════════════════════════════════════
          SHAPE 5 — COSMIC MERKABA
          3D star tetrahedron projected in 2D — two tetrahedra interlinked,
          with orbiting mini-triangles and an outer spinning frame.
          Formula: 2 Tetrahedra | φ² = φ + 1
          ════════════════════════════════════════════════════════════════ */}
      <Animated.View style={{ position:'absolute', width:S, height:S, opacity:ops[5], transform:[{scale:sc}] }}>
        {/* Outer rotating tri-frame — CW slowest */}
        <RL rot={cwC}>
          <Svg width={S} height={S}>
            <SvgPath d={poly(pts(hw,hw,S*0.44,3,-Math.PI/2))}
              fill="none" stroke={G4} strokeWidth="0.6" strokeLinejoin="round" opacity={0.35} />
            <SvgPath d={poly(pts(hw,hw,S*0.44,3, Math.PI/2))}
              fill="none" stroke={G4} strokeWidth="0.6" strokeLinejoin="round" opacity={0.35} />
          </Svg>
        </RL>
        {/* 3 orbiting mini-triangles — CCW medium */}
        <RL rot={ccwB}>
          <Svg width={S} height={S}>
            {pts(hw,hw,S*0.32,3,0).map((p,i)=>{
              const angle = (i * Math.PI * 2) / 3;
              const t1 = { x: p.x + S*0.07 * Math.cos(angle - Math.PI/2), y: p.y + S*0.07 * Math.sin(angle - Math.PI/2) };
              const t2 = { x: p.x + S*0.07 * Math.cos(angle + Math.PI*5/6), y: p.y + S*0.07 * Math.sin(angle + Math.PI*5/6) };
              const t3 = { x: p.x + S*0.07 * Math.cos(angle - Math.PI*5/6), y: p.y + S*0.07 * Math.sin(angle - Math.PI*5/6) };
              return <SvgPath key={`km_mt_${i}`} d={`M${t1.x.toFixed(1)} ${t1.y.toFixed(1)} L${t2.x.toFixed(1)} ${t2.y.toFixed(1)} L${t3.x.toFixed(1)} ${t3.y.toFixed(1)} Z`}
                fill={`${GA}0.12)`} stroke={G2} strokeWidth="1.4" strokeLinejoin="round" opacity={0.80} />;
            })}
          </Svg>
        </RL>
        {/* Main upper tetrahedron — CCW fast */}
        <RL rot={ccwF}>
          <Svg width={S} height={S}>
            <SvgPath d={poly(pts(hw,hw,S*0.36,3,-Math.PI/2))}
              fill={`${GA}0.10)`} stroke={G1} strokeWidth="2.6" strokeLinejoin="round" opacity={0.94} />
            {pts(hw,hw,S*0.36,3,-Math.PI/2).map((p,i)=>(
              <SvgCircle key={`km_uv_${i}`} cx={p.x} cy={p.y} r={4.5} fill={G3} opacity={0.90} />
            ))}
          </Svg>
        </RL>
        {/* Main lower tetrahedron — CW fast, counter-rotating */}
        <RL rot={cwA}>
          <Svg width={S} height={S}>
            <SvgPath d={poly(pts(hw,hw,S*0.36,3, Math.PI/2))}
              fill={`${GA}0.10)`} stroke={G1} strokeWidth="2.6" strokeLinejoin="round" opacity={0.94} />
            {pts(hw,hw,S*0.36,3, Math.PI/2).map((p,i)=>(
              <SvgCircle key={`km_dv_${i}`} cx={p.x} cy={p.y} r={4.5} fill={G3} opacity={0.90} />
            ))}
          </Svg>
        </RL>
        {/* Inner nested star — CW medium */}
        <RL rot={cwD}>
          <Svg width={S} height={S}>
            <SvgPath d={poly(pts(hw,hw,S*0.20,3,-Math.PI/2))}
              fill={`${GA}0.14)`} stroke={G2} strokeWidth="2.0" strokeLinejoin="round" opacity={0.90} />
            <SvgPath d={poly(pts(hw,hw,S*0.20,3, Math.PI/2))}
              fill={`${GA}0.14)`} stroke={G2} strokeWidth="2.0" strokeLinejoin="round" opacity={0.90} />
            <SvgCircle cx={hw} cy={hw} r={S*0.08} fill="none" stroke={G2} strokeWidth="1.0" opacity={0.70} />
            <SvgCircle cx={hw} cy={hw} r={S*0.05} fill="none" stroke={G3} strokeWidth="0.8" opacity={0.60} />
          </Svg>
        </RL>
      </Animated.View>

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
