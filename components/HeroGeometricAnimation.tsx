import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing } from 'react-native';
import Svg, {
  Circle as SvgCircle, Path as SvgPath, G as SvgG
} from 'react-native-svg';

// ── Utility: N points evenly spaced on a circle ──────────────────────────────
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
// 4 extraordinary sacred geometries cross-fade every ~10 seconds.
// 100% useNativeDriver — zero JS thread load, no setInterval, no setState.
// Now featuring Dynamic Contrast, Ultra-Subtle opacities, and a Fast-Forward Splash Mode.
// ─────────────────────────────────────────────────────────────────────────────
export function HeroGeometricAnimation({ size, theme = 'dark', splashMode = false }: { size: number, theme?: 'light' | 'dark', splashMode?: boolean }) {
  const cx = size / 2, cy = size / 2;

  // ── Rotation drivers ──────────────────────────────────────────────────────
  const rotA = useRef(new Animated.Value(0)).current;
  const rotB = useRef(new Animated.Value(0)).current;
  const rotC = useRef(new Animated.Value(0)).current;

  // ── Per-shape opacity ─────────────────────────────────────────────────────
  const op0 = useRef(new Animated.Value(1)).current;
  const op1 = useRef(new Animated.Value(0)).current;
  const op2 = useRef(new Animated.Value(0)).current;
  const op3 = useRef(new Animated.Value(0)).current;

  // ── Scale breath ──────────────────────────────────────────────────────────
  const breath = useRef(new Animated.Value(0)).current;
  const pulse  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Rotations — all native thread (faster in splash mode)
    const m = splashMode ? 0.35 : 1; // 3x faster in splash screen
    Animated.loop(Animated.timing(rotA, { toValue: 1, duration: 55000 * m, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(rotB, { toValue: 1, duration: 80000 * m, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(rotC, { toValue: 1, duration: 130000 * m, easing: Easing.linear, useNativeDriver: true })).start();

    // Gentle breathe
    Animated.loop(Animated.sequence([
      Animated.timing(breath, { toValue: 1, duration: 6500 * m, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(breath, { toValue: 0, duration: 6500 * m, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();

    // Bindu pulse
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 2200 * m, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 2200 * m, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();

    // In Splash Mode, we transition much faster to show all shapes in 7 seconds.
    const HOLD = splashMode ? 1200 : 9000;
    const FADE = splashMode ? 800 : 2000;
    const ops = [op0, op1, op2, op3];

    function runCycle(current: number) {
      const next = (current + 1) % 4;
      Animated.sequence([
        Animated.delay(HOLD),
        Animated.parallel([
          Animated.timing(ops[current], { toValue: 0, duration: FADE, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(ops[next],    { toValue: 1, duration: FADE, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ]).start(({ finished }) => { if (finished) runCycle(next); });
    }
    runCycle(0);
  }, []);

  // ── Interpolated transforms ───────────────────────────────────────────────
  const r0deg   = rotA.interpolate({ inputRange: [0,1], outputRange: ['0deg',   '360deg'] });
  const r0degR  = rotA.interpolate({ inputRange: [0,1], outputRange: ['360deg', '0deg']   });
  const r1deg   = rotB.interpolate({ inputRange: [0,1], outputRange: ['0deg',   '360deg'] });
  const r1degR  = rotB.interpolate({ inputRange: [0,1], outputRange: ['360deg', '0deg']   });
  const r2deg   = rotC.interpolate({ inputRange: [0,1], outputRange: ['0deg',   '360deg'] });
  const sc      = breath.interpolate({ inputRange: [0,1], outputRange: [0.95, 1.05] });
  const scSm    = breath.interpolate({ inputRange: [0,1], outputRange: [0.98, 1.02] });
  const bindOp  = pulse.interpolate({ inputRange: [0,1], outputRange: [0.2, 0.5] });
  const bindSc  = pulse.interpolate({ inputRange: [0,1], outputRange: [0.8, 1.2] });

  // ── Dynamic Colour Palette for balanced contrast ──────────────────────────
  // If the surrounding ring theme is DARK -> geometry should be lighter gold
  // If the surrounding ring theme is LIGHT -> geometry should be deeper dark bronze
  const G1 = theme === 'dark' ? '#FFD700' : '#8B6508'; // pure gold vs deep bronze
  const G2 = theme === 'dark' ? '#FDB931' : '#A0522D'; // warm amber vs sienna
  const G3 = theme === 'dark' ? '#FFFBE6' : '#5C3A21'; // bright highlight vs dark brown
  const G4 = theme === 'dark' ? '#B8860B' : '#8B4513'; // deep gold vs saddle brown
  const GA = theme === 'dark' ? 'rgba(253,185,49,' : 'rgba(139,69,19,'; 

  // OPACITY MASTER MULTIPLIER to prevent blocking text (reduces all geometry presence by 70%)
  const OPM = 0.28; 

  const S = size;
  const hw = S * 0.5;

  return (
    <View pointerEvents="none" style={{ position: 'absolute', width: S, height: S, zIndex: 0 }}>

      {/* ══════════════════════════════════════════════════════════════════════
          SHAPE 0 — FLOWER OF LIFE / SEED OF LIFE
          ══════════════════════════════════════════════════════════════════ */}
      <Animated.View style={{ position: 'absolute', width: S, height: S,
          opacity: op0, transform: [{ rotate: r2deg }, { scale: sc }] }}>
        <Svg width={S} height={S}>
          <SvgCircle cx={hw} cy={hw} r={S*0.19} fill="none" stroke={G2} strokeWidth="1" opacity={0.6 * OPM} />
          {pts(hw, hw, S*0.19, 6, 0).map((p, i) => (
            <SvgCircle key={`fol_inner_${i}`} cx={p.x} cy={p.y} r={S*0.19} fill={`${GA}0.02)`} stroke={G2} strokeWidth="0.8" opacity={0.5 * OPM} />
          ))}
          {pts(hw, hw, S*0.38, 6, Math.PI/6).map((p, i) => (
            <SvgCircle key={`fol_outer_${i}`} cx={p.x} cy={p.y} r={S*0.19} fill="none" stroke={G4} strokeWidth="0.6" opacity={0.3 * OPM} />
          ))}
          <SvgCircle cx={hw} cy={hw} r={S*0.40} fill="none" stroke={G4} strokeWidth="0.8" opacity={0.3 * OPM} />
          <SvgCircle cx={hw} cy={hw} r={S*0.07} fill={`${GA}0.05)`} stroke={G3} strokeWidth="0.8" opacity={0.5 * OPM} />
          {pts(hw, hw, S*0.19, 6, 0).map((p, i) => (
            <SvgCircle key={`fol_jewel_${i}`} cx={p.x} cy={p.y} r={2} fill={G3} opacity={0.7 * OPM} />
          ))}
        </Svg>
      </Animated.View>

      <Animated.View style={{ position: 'absolute', width: S, height: S,
          opacity: op0, transform: [{ rotate: r0degR }] }}>
        <Svg width={S} height={S}>
          {pts(hw, hw, S*0.43, 12, 0).map((p, i) => (
            <SvgCircle key={`fol_halo_${i}`} cx={p.x} cy={p.y} r={1.5} fill={G3} opacity={(0.20 + (i % 2) * 0.15) * OPM} />
          ))}
          <SvgCircle cx={hw} cy={hw} r={S*0.45} fill="none" stroke={G4} strokeWidth="0.5" opacity={0.25 * OPM} strokeDasharray="4 8" />
        </Svg>
      </Animated.View>

      {/* ══════════════════════════════════════════════════════════════════════
          SHAPE 1 — METATRON'S CUBE
          ══════════════════════════════════════════════════════════════════ */}
      <Animated.View style={{ position: 'absolute', width: S, height: S,
          opacity: op1, transform: [{ rotate: r1degR }, { scale: sc }] }}>
        <Svg width={S} height={S}>
          {[ { x: hw, y: hw }, ...pts(hw, hw, S*0.19, 6, 0), ...pts(hw, hw, S*0.38, 6, 0) ].map((p, i) => (
            <SvgCircle key={`mc_circ_${i}`} cx={p.x} cy={p.y} r={S*0.19} fill={`${GA}0.02)`} stroke={G2} strokeWidth="0.6" opacity={(i === 0 ? 0.6 : 0.35) * OPM} />
          ))}
          {(() => {
            const centers = [{ x: hw, y: hw }, ...pts(hw, hw, S*0.19, 6, 0), ...pts(hw, hw, S*0.38, 6, 0)];
            const paths: React.JSX.Element[] = [];
            centers.forEach((a, i) => centers.forEach((b, j) => {
              if (j <= i) return;
              paths.push(<SvgPath key={`mc_ln_${i}_${j}`} d={`M${a.x.toFixed(1)} ${a.y.toFixed(1)} L${b.x.toFixed(1)} ${b.y.toFixed(1)}`} stroke={G4} strokeWidth="0.4" opacity={0.2 * OPM} />);
            }));
            return paths;
          })()}
          <SvgPath d={poly(pts(hw, hw, S*0.34, 3, -Math.PI/2))} fill={`${GA}0.03)`} stroke={G1} strokeWidth="1.2" opacity={0.7 * OPM} />
          <SvgPath d={poly(pts(hw, hw, S*0.34, 3,  Math.PI/2))} fill={`${GA}0.03)`} stroke={G1} strokeWidth="1.2" opacity={0.7 * OPM} />
          <SvgPath d={poly(pts(hw, hw, S*0.34, 6, 0))} fill="none" stroke={G3} strokeWidth="0.8" opacity={0.45 * OPM} />
          {pts(hw, hw, S*0.34, 6, 0).map((p, i) => (
            <SvgCircle key={`mc_vj_${i}`} cx={p.x} cy={p.y} r={2.5} fill={G3} opacity={0.70 * OPM} />
          ))}
        </Svg>
      </Animated.View>

      <Animated.View style={{ position: 'absolute', width: S, height: S,
          opacity: op1, transform: [{ rotate: r0deg }] }}>
        <Svg width={S} height={S}>
          {pts(hw, hw, S*0.38, 6, Math.PI/6).map((p, i, arr) => {
            const n = arr[(i+1)%arr.length];
            return <SvgPath key={`mc_sp_${i}`} d={`M${p.x.toFixed(1)} ${p.y.toFixed(1)} L${n.x.toFixed(1)} ${n.y.toFixed(1)}`} stroke={G2} strokeWidth="0.8" opacity={0.40 * OPM} />;
          })}
          {pts(hw, hw, S*0.44, 12, 0).map((p, i) => (
            <SvgCircle key={`mc_halo_${i}`} cx={p.x} cy={p.y} r={1.5} fill={G3} opacity={(0.22 + (i%3)*0.12) * OPM} />
          ))}
        </Svg>
      </Animated.View>

      {/* ══════════════════════════════════════════════════════════════════════
          SHAPE 2 — SRI YANTRA
          ══════════════════════════════════════════════════════════════════ */}
      <Animated.View style={{ position: 'absolute', width: S, height: S,
          opacity: op2, transform: [{ rotate: r2deg }, { scale: sc }] }}>
        <Svg width={S} height={S}>
          <SvgCircle cx={hw} cy={hw} r={S*0.43} fill="none" stroke={G4} strokeWidth="0.6" opacity={0.30 * OPM} strokeDasharray="6 6" />
          {[S*0.35, S*0.27, S*0.19, S*0.12].map((r, ti) => (
            <SvgPath key={`sy_d_${ti}`} d={poly(pts(hw, hw, r, 3, Math.PI/6))} fill={`${GA}${[0.03, 0.03, 0.02, 0.02][ti]})`} stroke={G2} strokeWidth={[1.2, 1.0, 0.9, 0.8][ti]} opacity={(0.65 + ti * 0.06) * OPM} />
          ))}
          {[S*0.38, S*0.30, S*0.22, S*0.15, S*0.08].map((r, ti) => (
            <SvgPath key={`sy_u_${ti}`} d={poly(pts(hw, hw, r, 3, -Math.PI/6))} fill={`${GA}${[0.03, 0.02, 0.02, 0.02, 0.01][ti]})`} stroke={G1} strokeWidth={[1.2, 1.0, 0.9, 0.8, 0.6][ti]} opacity={(0.65 + ti * 0.06) * OPM} />
          ))}
          <SvgCircle cx={hw} cy={hw} r={S*0.035} fill={G1} opacity={0.70 * OPM} />
          {pts(hw, hw, S*0.41, 8, 0).map((p, i) => (
            <SvgCircle key={`sy_lotus_${i}`} cx={p.x} cy={p.y} r={S*0.05} fill={`${GA}0.02)`} stroke={G4} strokeWidth="0.6" opacity={0.35 * OPM} />
          ))}
          {pts(hw, hw, S*0.41, 16, Math.PI/16).map((p, i) => (
            <SvgCircle key={`sy_lotus16_${i}`} cx={p.x} cy={p.y} r={S*0.026} fill="none" stroke={G4} strokeWidth="0.4" opacity={0.20 * OPM} />
          ))}
        </Svg>
      </Animated.View>

      {/* ══════════════════════════════════════════════════════════════════════
          SHAPE 3 — SHATKONA / STAR OF DAVID
          ══════════════════════════════════════════════════════════════════ */}
      <Animated.View style={{ position: 'absolute', width: S, height: S,
          opacity: op3, transform: [{ rotate: r0deg }, { scale: scSm }] }}>
        <Svg width={S} height={S}>
          {pts(hw, hw, S*0.46, 48, 0).map((p, i) => (
            <SvgPath key={`sh_ray_${i}`} d={`M${hw} ${hw} L${p.x.toFixed(1)} ${p.y.toFixed(1)}`} stroke={G3} strokeWidth="0.3" opacity={0.08 * OPM} />
          ))}
          <SvgCircle cx={hw} cy={hw} r={S*0.43} fill="none" stroke={G4} strokeWidth="0.6" opacity={0.30 * OPM} strokeDasharray="3 5" />
          <SvgPath d={poly(pts(hw, hw, S*0.38, 3, -Math.PI/2))} fill={`${GA}0.03)`} stroke={G1} strokeWidth="1.5" opacity={0.80 * OPM} />
          <SvgPath d={poly(pts(hw, hw, S*0.38, 3, Math.PI/2))} fill={`${GA}0.03)`} stroke={G1} strokeWidth="1.5" opacity={0.80 * OPM} />
          {pts(hw, hw, S*0.20, 6, 0).map((p, i, arr) => {
            const n = arr[(i+1)%arr.length];
            return <SvgPath key={`sh_h_${i}`} d={`M${p.x.toFixed(1)} ${p.y.toFixed(1)} L${n.x.toFixed(1)} ${n.y.toFixed(1)}`} stroke={G3} strokeWidth="0.8" opacity={0.60 * OPM} />;
          })}
          {pts(hw, hw, S*0.38, 3, -Math.PI/2).map((p, i) => (
            <SvgCircle key={`sh_vup_${i}`} cx={p.x} cy={p.y} r={3} fill={G3} opacity={0.80 * OPM} />
          ))}
          {pts(hw, hw, S*0.38, 3, Math.PI/2).map((p, i) => (
            <SvgCircle key={`sh_vdn_${i}`} cx={p.x} cy={p.y} r={3} fill={G3} opacity={0.80 * OPM} />
          ))}
          <SvgCircle cx={hw} cy={hw} r={S*0.12} fill="none" stroke={G2} strokeWidth="0.8" opacity={0.60 * OPM} />
          <SvgCircle cx={hw} cy={hw} r={S*0.06} fill="none" stroke={G3} strokeWidth="0.8" opacity={0.70 * OPM} />
        </Svg>
      </Animated.View>

      <Animated.View style={{ position: 'absolute', width: S, height: S,
          opacity: op3, transform: [{ rotate: r1degR }] }}>
        <Svg width={S} height={S}>
          {pts(hw, hw, S*0.44, 12, Math.PI/12).map((p, i) => (
            <SvgCircle key={`sh_orbit_${i}`} cx={p.x} cy={p.y} r={1.5} fill={G3} opacity={(0.18 + (i%3)*0.12) * OPM} />
          ))}
        </Svg>
      </Animated.View>

      {/* ══════════════════════════════════════════════════════════════════════
          ALWAYS VISIBLE — Orbiting stardust + glowing Bindu
          ══════════════════════════════════════════════════════════════════ */}
      <Animated.View style={{ position: 'absolute', width: S, height: S,
          transform: [{ rotate: r1degR }], opacity: 0.60 * OPM }}>
        <Svg width={S} height={S}>
          {pts(hw, hw, S*0.44, 24, 0).map((p, i) => (
            <SvgCircle key={`dust_${i}`} cx={p.x} cy={p.y} r={i % 3 === 0 ? 1.8 : 1.0} fill={G3} opacity={0.15 + (i % 4) * 0.12} />
          ))}
        </Svg>
      </Animated.View>

      <Animated.View style={{
        position: 'absolute', width: 6, height: 6, borderRadius: 3,
        backgroundColor: G3,
        shadowColor: G1, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 8,
        opacity: bindOp,
        transform: [{ scale: bindSc }],
      }} />

    </View>
  );
}

export { pts as sacredDots };
