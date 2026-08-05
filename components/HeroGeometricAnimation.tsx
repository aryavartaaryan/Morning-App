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
function arc(cx: number, cy: number, r: number, startA: number, endA: number) {
  const x1 = cx + r * Math.cos(startA), y1 = cy + r * Math.sin(startA);
  const x2 = cx + r * Math.cos(endA),   y2 = cy + r * Math.sin(endA);
  const large = endA - startA > Math.PI ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

// ── 6 Sacred shapes — mathematical labels ─────────────────────────────────────
export const SHAPE_MATH: Array<{ title: string; eq1: string; eq2: string; insight: string }> = [
  {
    title: 'Torus Yantra',
    eq1:   'r(θ) = R + a·cos(nθ)',
    eq2:   'Genus 1  ·  ∞ Flow',
    insight: 'Self-Sustaining Universe',
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
    eq1:   'd = r  ·  √3',
    eq2:   'Area = πr² / 2 − r²·√3/2',
    insight: 'Womb of Creation · Duality',
  },
  {
    title: '64 Tetrahedron',
    eq1:   'N = 64 = 2⁶ = 8²',
    eq2:   '∑ forces = 0  (Equilibrium)',
    insight: 'Isotropic Vector Matrix',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// HeroGeometricAnimation — 6 sacred shapes, zero-blink cross-fade
//
// KEY FIX: All 6 shapes are ALWAYS mounted. Only their opacity changes via
// Animated.Value. No React state transitions occur during crossfade,
// which was the root cause of blinking/breaking.
// ─────────────────────────────────────────────────────────────────────────────

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

const TOTAL_SHAPES = 6;

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

  // ── 6 independent rotation drivers ─────────────────────────────────────────
  const rotA = useRef(new Animated.Value(0)).current; // CW  22s
  const rotB = useRef(new Animated.Value(0)).current; // CCW 34s
  const rotC = useRef(new Animated.Value(0)).current; // CW  48s
  const rotD = useRef(new Animated.Value(0)).current; // CW  18s (fastest)
  const rotE = useRef(new Animated.Value(0)).current; // CW  42s
  const rotF = useRef(new Animated.Value(0)).current; // CCW 28s

  // ── Per-shape opacity — ALL shapes always mounted, only opacity changes ─────
  const ops = useRef(
    Array.from({ length: TOTAL_SHAPES }, (_, i) => new Animated.Value(i === 0 ? 1 : 0))
  ).current;

  // ── Breath + pulse ──────────────────────────────────────────────────────────
  const breath = useRef(new Animated.Value(0)).current;
  const pulse  = useRef(new Animated.Value(0)).current;

  // ── Sound ripples ────────────────────────────────────────────────────────────
  const ripple1 = useRef(new Animated.Value(0)).current;
  const ripple2 = useRef(new Animated.Value(0)).current;
  const ripple3 = useRef(new Animated.Value(0)).current;

  // ── Track current active shape index (for callbacks only) ───────────────────
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

    const BREATH_DUR = isHome ? 11000 : isSound ? 8000 : 6000;
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

    // ── Shape cycling — pure opacity cross-fade, zero React state changes ─────
    const HOLD = isHome ? 14000 : isSound ? 12000 : 9000;
    const FADE = isHome ? 2500  : isSound ? 2000  : 1800;

    let alive = true;
    function runCycle(current: number) {
      if (!alive) return;
      const timer = setTimeout(() => {
        if (!alive) return;
        const next = (current + 1) % TOTAL_SHAPES;
        // Cross-fade: fade out current, fade in next — purely via Animated, no setState
        Animated.parallel([
          Animated.timing(ops[current], { toValue: 0, duration: FADE, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(ops[next],    { toValue: 1, duration: FADE, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]).start(({ finished }) => {
          if (!finished || !alive) return;
          currentShapeRef.current = next;
          onShapeChange?.(next);
          runCycle(next);
        });
      }, HOLD);
      return () => clearTimeout(timer);
    }
    const cleanup = runCycle(0);
    return () => {
      alive = false;
      cleanup?.();
    };
  }, []);

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

  // ── Rotation interpolations ─────────────────────────────────────────────────
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

  // ── Colour palette ──────────────────────────────────────────────────────────
  const homeBase = accentColor ?? '#80FFFF';
  const G1 = variant === 'splash' ? '#FFD700' : variant === 'sound' ? (accentColor ?? '#38bdf8') : homeBase;
  const G2 = variant === 'splash' ? '#FDB931' : variant === 'sound' ? blendHex(G1,'#a78bfa',0.4) : G1+'CC';
  const G3 = '#FFFFFF';
  const G4 = variant === 'splash' ? '#B8860B80' : G1+'44';
  const GA = `rgba(${hexToRgbStr(G1)},`;

  // Rotating layer helper — purely presentational, no state
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
          SHAPE 0 — TORUS YANTRA (replaces old circles-only Flower of Life)
          A self-referential torus mandala: concentric petal rings forming
          the projection of a donut — the universe's natural energy flow.
          Formula: r(θ) = R + a·cos(nθ)
          ════════════════════════════════════════════════════════════════ */}
      <Animated.View style={{ position:'absolute', width:S, height:S, opacity:ops[0], transform:[{scale:sc}] }}>
        {/* Outer slow orbit ring — CW slowest */}
        <RL rot={cwE}>
          <Svg width={S} height={S}>
            <SvgCircle cx={hw} cy={hw} r={S*0.44} fill="none" stroke={G4} strokeWidth="0.5" opacity={0.25} strokeDasharray="3 9" />
            {pts(hw,hw,S*0.44,24,0).map((p,i)=>(
              <SvgCircle key={`ty_od_${i}`} cx={p.x} cy={p.y} r={i%3===0?2.5:1.4} fill={G3} opacity={0.08+(i%5)*0.05} />
            ))}
          </Svg>
        </RL>
        {/* Torus petal ring — 12 large arcs rotating CCW */}
        <RL rot={ccwF}>
          <Svg width={S} height={S}>
            {Array.from({ length: 12 }, (_, i) => {
              const a0 = (i * Math.PI * 2) / 12;
              const a1 = a0 + (Math.PI * 2) / 12;
              const rm = S * 0.34;
              const ri = S * 0.16;
              const px = hw + rm * Math.cos(a0 + Math.PI/12);
              const py = hw + rm * Math.sin(a0 + Math.PI/12);
              return (
                <SvgPath key={`ty_petal_${i}`}
                  d={`M${(hw + ri*Math.cos(a0)).toFixed(1)} ${(hw + ri*Math.sin(a0)).toFixed(1)}
                     Q${px.toFixed(1)} ${py.toFixed(1)}
                     ${(hw + ri*Math.cos(a1)).toFixed(1)} ${(hw + ri*Math.sin(a1)).toFixed(1)}`}
                  fill={`${GA}0.06)`}
                  stroke={G1}
                  strokeWidth="1.2"
                  opacity={0.80}
                />
              );
            })}
            {pts(hw,hw,S*0.34,12,0).map((p,i)=>(
              <SvgCircle key={`ty_pj_${i}`} cx={p.x} cy={p.y} r={2.8} fill={G3} opacity={0.75} />
            ))}
          </Svg>
        </RL>
        {/* Inner torus ring — CW medium */}
        <RL rot={cwA}>
          <Svg width={S} height={S}>
            <SvgCircle cx={hw} cy={hw} r={S*0.22} fill="none" stroke={G2} strokeWidth="1.6" opacity={0.85} />
            <SvgCircle cx={hw} cy={hw} r={S*0.26} fill="none" stroke={G4} strokeWidth="0.6" opacity={0.35} strokeDasharray="4 6" />
            {Array.from({ length: 8 }, (_, i) => {
              const a = (i * Math.PI * 2) / 8;
              const r1 = S * 0.22, r2 = S * 0.14;
              return (
                <SvgPath key={`ty_spoke_${i}`}
                  d={`M${(hw+r1*Math.cos(a)).toFixed(1)} ${(hw+r1*Math.sin(a)).toFixed(1)} L${(hw+r2*Math.cos(a)).toFixed(1)} ${(hw+r2*Math.sin(a)).toFixed(1)}`}
                  stroke={G2} strokeWidth="0.9" opacity={0.55}
                />
              );
            })}
            {pts(hw,hw,S*0.22,8,0).map((p,i)=>(
              <SvgCircle key={`ty_ij_${i}`} cx={p.x} cy={p.y} r={2.2} fill={G3} opacity={0.70} />
            ))}
          </Svg>
        </RL>
        {/* Central bindu ring — CW fast */}
        <RL rot={cwD}>
          <Svg width={S} height={S}>
            <SvgCircle cx={hw} cy={hw} r={S*0.08} fill="none" stroke={G1} strokeWidth="1.2" opacity={0.82} />
            <SvgCircle cx={hw} cy={hw} r={S*0.05} fill={`${GA}0.18)`} stroke={G2} strokeWidth="0.8" opacity={0.70} />
            {pts(hw,hw,S*0.08,6,0).map((p,i)=>(
              <SvgCircle key={`ty_cd_${i}`} cx={p.x} cy={p.y} r={2.0} fill={G3} opacity={0.68} />
            ))}
          </Svg>
        </RL>
      </Animated.View>

      {/* ════════════════════════════════════════════════════════════════════
          SHAPE 1 — METATRON'S CUBE
          Layers: outer orbit (CW slow), 13 circles (CCW med),
                  mesh lines (CW slow), star tetrahedron (CCW fast)
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
          9 interlocking triangles — the supreme yantra
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
          SHAPE 3 — SHATKONA (Star of David / Merkaba)
          Two counter-rotating equilateral triangles — Shiva & Shakti
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
          SHAPE 4 — VESICA PISCIS (NEW)
          The "Womb of Creation" — two interlocking circles forming the
          sacred lens. The root of all sacred geometry proportions.
          Radiating petals in 6-fold symmetry with orbiting jewels.
          Formula: d = r · √3
          ════════════════════════════════════════════════════════════════ */}
      <Animated.View style={{ position:'absolute', width:S, height:S, opacity:ops[4], transform:[{scale:sc}] }}>
        {/* Outer halo + stardust — CCW slowest */}
        <RL rot={ccwB}>
          <Svg width={S} height={S}>
            <SvgCircle cx={hw} cy={hw} r={S*0.44} fill="none" stroke={G4} strokeWidth="0.5" opacity={0.22} strokeDasharray="4 10" />
            {pts(hw,hw,S*0.44,30,0).map((p,i)=>(
              <SvgCircle key={`vp_od_${i}`} cx={p.x} cy={p.y} r={i%5===0?2.8:i%2===0?1.8:1.0} fill={G3} opacity={0.07+(i%5)*0.06} />
            ))}
          </Svg>
        </RL>
        {/* 6 Vesica circles (the Seed of Life base) — CW slow */}
        <RL rot={cwC}>
          <Svg width={S} height={S}>
            {/* The two primary interlocking circles of Vesica */}
            <SvgCircle cx={hw - S*0.18} cy={hw} r={S*0.30}
              fill={`${GA}0.04)`} stroke={G2} strokeWidth="1.4" opacity={0.85} />
            <SvgCircle cx={hw + S*0.18} cy={hw} r={S*0.30}
              fill={`${GA}0.04)`} stroke={G1} strokeWidth="1.4" opacity={0.85} />
            {/* Outer 6 vesica petals */}
            {pts(hw,hw,S*0.18,6,0).map((p,i)=>(
              <SvgCircle key={`vp_sp_${i}`} cx={p.x} cy={p.y} r={S*0.18}
                fill={`${GA}0.04)`} stroke={G4} strokeWidth="0.8" opacity={0.50} />
            ))}
          </Svg>
        </RL>
        {/* Sacred lens lines — vertical & horizontal axes — CCW fast */}
        <RL rot={ccwF}>
          <Svg width={S} height={S}>
            {/* Vesica lens vertical axis — the √3 proportion */}
            {[-1, 1].map(sign=>(
              <SvgPath key={`vp_ax_${sign}`}
                d={`M${hw} ${hw - S*0.30} L${hw} ${hw + S*0.30}`}
                stroke={G3} strokeWidth="0.7" opacity={0.40}
                strokeDasharray="5 6"
              />
            ))}
            {/* Horizontal connecting line */}
            <SvgPath
              d={`M${hw - S*0.36} ${hw} L${hw + S*0.36} ${hw}`}
              stroke={G4} strokeWidth="0.5" opacity={0.30}
              strokeDasharray="4 8"
            />
            {/* 12 orbit jewels at intersection ring */}
            {pts(hw,hw,S*0.30,12,Math.PI/12).map((p,i)=>(
              <SvgCircle key={`vp_oj_${i}`} cx={p.x} cy={p.y} r={i%3===0?2.8:1.4} fill={G3} opacity={0.20+(i%4)*0.10} />
            ))}
          </Svg>
        </RL>
        {/* Inner core ring + bindu — CW fast */}
        <RL rot={cwD}>
          <Svg width={S} height={S}>
            <SvgCircle cx={hw} cy={hw} r={S*0.12} fill="none" stroke={G2} strokeWidth="1.2" opacity={0.75} />
            <SvgCircle cx={hw} cy={hw} r={S*0.07} fill="none" stroke={G1} strokeWidth="0.9" opacity={0.60} strokeDasharray="3 4" />
            {pts(hw,hw,S*0.12,6,0).map((p,i)=>(
              <SvgCircle key={`vp_cj_${i}`} cx={p.x} cy={p.y} r={2.2} fill={G3} opacity={0.72} />
            ))}
          </Svg>
        </RL>
      </Animated.View>

      {/* ════════════════════════════════════════════════════════════════════
          SHAPE 5 — 64 TETRAHEDRON GRID (NEW)
          The Isotropic Vector Matrix — Buckminster Fuller's zero-point
          energy lattice. 64 tetrahedra in perfect equilibrium.
          Rendered as nested star polygons (8, 12, 16 points) with
          an inner Merkaba core and radial energy lines.
          Formula: N = 64 = 2⁶
          ════════════════════════════════════════════════════════════════ */}
      <Animated.View style={{ position:'absolute', width:S, height:S, opacity:ops[5], transform:[{scale:scSlow}] }}>
        {/* Outer 64-point lattice ring — CW slowest */}
        <RL rot={cwE}>
          <Svg width={S} height={S}>
            <SvgCircle cx={hw} cy={hw} r={S*0.44} fill="none" stroke={G4} strokeWidth="0.4" opacity={0.20} />
            {/* 64-point radial: every 4th ray is brighter */}
            {Array.from({ length: 32 }, (_,i) => {
              const a = (i * Math.PI * 2) / 32;
              const isMajor = i % 4 === 0;
              return (
                <SvgPath key={`tg_ray_${i}`}
                  d={`M${hw} ${hw} L${(hw + S*0.44*Math.cos(a)).toFixed(1)} ${(hw + S*0.44*Math.sin(a)).toFixed(1)}`}
                  stroke={isMajor ? G2 : G3}
                  strokeWidth={isMajor ? 0.5 : 0.2}
                  opacity={isMajor ? 0.28 : 0.08}
                />
              );
            })}
            {pts(hw,hw,S*0.44,16,0).map((p,i)=>(
              <SvgCircle key={`tg_od_${i}`} cx={p.x} cy={p.y} r={i%4===0?3:1.8} fill={G3} opacity={0.12+(i%4)*0.10} />
            ))}
          </Svg>
        </RL>
        {/* 8-pointed star (two squares) — CCW medium */}
        <RL rot={ccwB}>
          <Svg width={S} height={S}>
            <SvgPath d={poly(pts(hw,hw,S*0.38,4,-Math.PI/4))}
              fill={`${GA}0.06)`} stroke={G1} strokeWidth="2.0" opacity={0.90} />
            <SvgPath d={poly(pts(hw,hw,S*0.38,4,0))}
              fill={`${GA}0.06)`} stroke={G2} strokeWidth="2.0" opacity={0.90} />
            {pts(hw,hw,S*0.38,8,-Math.PI/8).map((p,i)=>(
              <SvgCircle key={`tg_vj_${i}`} cx={p.x} cy={p.y} r={4.5} fill={G3} opacity={0.85} />
            ))}
          </Svg>
        </RL>
        {/* 12-pointed star inner — CW medium */}
        <RL rot={cwA}>
          <Svg width={S} height={S}>
            {/* Three overlapping squares at 30° = 12-star */}
            {[0, Math.PI/6, Math.PI/3].map((offset, ti)=>(
              <SvgPath key={`tg_sq_${ti}`}
                d={poly(pts(hw,hw,S*0.26,4,offset))}
                fill={`${GA}0.04)`} stroke={ti===0?G1:ti===1?G2:G3}
                strokeWidth="1.4" opacity={0.70} />
            ))}
            {pts(hw,hw,S*0.26,12,0).map((p,i)=>(
              <SvgCircle key={`tg_ij_${i}`} cx={p.x} cy={p.y} r={2.0} fill={G3} opacity={0.55+(i%3)*0.10} />
            ))}
          </Svg>
        </RL>
        {/* Central Merkaba core — CCW fast */}
        <RL rot={ccwF}>
          <Svg width={S} height={S}>
            <SvgPath d={poly(pts(hw,hw,S*0.14,3,-Math.PI/2))}
              fill={`${GA}0.12)`} stroke={G1} strokeWidth="1.8" opacity={0.92} />
            <SvgPath d={poly(pts(hw,hw,S*0.14,3, Math.PI/2))}
              fill={`${GA}0.12)`} stroke={G2} strokeWidth="1.8" opacity={0.92} />
            <SvgCircle cx={hw} cy={hw} r={S*0.10} fill="none" stroke={G4} strokeWidth="0.8" opacity={0.55} strokeDasharray="2 5" />
            <SvgCircle cx={hw} cy={hw} r={S*0.05} fill={`${GA}0.20)`} stroke={G1} strokeWidth="1.0" opacity={0.80} />
            {pts(hw,hw,S*0.14,6,0).map((p,i)=>(
              <SvgCircle key={`tg_mj_${i}`} cx={p.x} cy={p.y} r={2.5} fill={G3} opacity={0.78} />
            ))}
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
