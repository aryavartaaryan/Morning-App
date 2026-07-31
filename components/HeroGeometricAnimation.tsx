import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing } from 'react-native';
import Svg, {
  Circle as SvgCircle, Path as SvgPath, G as SvgG,
  Defs, RadialGradient as SvgRadialGradient, Stop, Ellipse,
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
// ─────────────────────────────────────────────────────────────────────────────
export function HeroGeometricAnimation({ size, theme = 'dark', speed = 'slow' }: { size: number, theme?: 'light' | 'dark', speed?: 'slow' | 'fast' }) {
  const cx = size / 2, cy = size / 2;

  // ── Rotation drivers ──────────────────────────────────────────────────────
  const rotA = useRef(new Animated.Value(0)).current; // slow forward
  const rotB = useRef(new Animated.Value(0)).current; // slower reverse
  const rotC = useRef(new Animated.Value(0)).current; // very slow forward

  // ── Per-shape opacity ─────────────────────────────────────────────────────
  const op0 = useRef(new Animated.Value(1)).current; // Seed of Life
  const op1 = useRef(new Animated.Value(0)).current; // Metatron's Cube
  const op2 = useRef(new Animated.Value(0)).current; // Sri Yantra
  const op3 = useRef(new Animated.Value(0)).current; // Shatkona / Star of David

  // ── Scale breath ──────────────────────────────────────────────────────────
  const breath = useRef(new Animated.Value(0)).current;
  const pulse  = useRef(new Animated.Value(0)).current; // faster pulse for bindu

  useEffect(() => {
    // Rotations — all native thread
    Animated.loop(Animated.timing(rotA, { toValue: 1, duration: 55000, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(rotB, { toValue: 1, duration: 80000, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(rotC, { toValue: 1, duration: 130000, easing: Easing.linear, useNativeDriver: true })).start();

    // Gentle breathe
    Animated.loop(Animated.sequence([
      Animated.timing(breath, { toValue: 1, duration: 6500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(breath, { toValue: 0, duration: 6500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();

    // Bindu pulse
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();

    // Cross-fade: 
    // Slow (Home): 9s hold, 2s fade (meditative)
    // Fast (Splash): 1s hold, 0.5s fade (quick cycle in ~6 seconds)
    const HOLD = speed === 'fast' ? 1000 : 9000;
    const FADE = speed === 'fast' ? 600 : 2000;
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
  const sc      = breath.interpolate({ inputRange: [0,1], outputRange: [0.93, 1.07] });
  const scSm    = breath.interpolate({ inputRange: [0,1], outputRange: [0.97, 1.03] });
  const bindOp  = pulse.interpolate({ inputRange: [0,1], outputRange: [0.55, 1] });
  const bindSc  = pulse.interpolate({ inputRange: [0,1], outputRange: [0.75, 1.5] });

  // ── Colour palette — True Golden Contrast ─────────────────────────────
  const isDark = theme === 'dark';
  
  // Real Golden Palette: strictly golden hues (no copper/bronze)
  // Dark theme uses Luminous Light Gold. Light theme uses Rich Dark Gold.
  const G1 = isDark ? '#FFD700' : '#B8860B'; // pure gold vs dark goldenrod
  const G2 = isDark ? '#FFDF00' : '#996515'; // golden yellow vs antique gold
  const G3 = isDark ? '#FFF8DC' : '#DAA520'; // cornsilk/white gold vs goldenrod highlight
  const G4 = isDark ? '#DAA520' : '#8B6508'; // goldenrod depth vs deepest gold
  const GA = isDark ? 'rgba(255,215,0,' : 'rgba(184,134,11,'; // true gold base rgb for fills

  const S = size;
  const hw = S * 0.5;

  return (
    <View pointerEvents="none" style={{ position: 'absolute', width: S, height: S, zIndex: 2, opacity: 0.82 }}>

      {/* ══════════════════════════════════════════════════════════════════════
          SHAPE 0 — FLOWER OF LIFE / SEED OF LIFE
          Overlapping circles creating sacred petal geometry.
          ══════════════════════════════════════════════════════════════════ */}
      <Animated.View style={{ position: 'absolute', width: S, height: S,
          opacity: op0, transform: [{ rotate: r2deg }, { scale: sc }] }}>
        <Svg width={S} height={S}>
          {/* Central circle */}
          <SvgCircle cx={hw} cy={hw} r={S*0.19} fill="none" stroke={G2} strokeWidth="1.2" opacity={0.7} />
          {/* 6 petal circles */}
          {pts(hw, hw, S*0.19, 6, 0).map((p, i) => (
            <SvgCircle key={`fol_inner_${i}`} cx={p.x} cy={p.y} r={S*0.19} fill={`${GA}0.04)`} stroke={G2} strokeWidth="1.0" opacity={0.65} />
          ))}
          {/* Second ring — 12 more petals */}
          {pts(hw, hw, S*0.38, 6, Math.PI/6).map((p, i) => (
            <SvgCircle key={`fol_outer_${i}`} cx={p.x} cy={p.y} r={S*0.19} fill="none" stroke={G4} strokeWidth="0.7" opacity={0.35} />
          ))}
          {/* Outer container ring */}
          <SvgCircle cx={hw} cy={hw} r={S*0.40} fill="none" stroke={G4} strokeWidth="0.8" opacity={0.40} />
          {/* Inner tight ring */}
          <SvgCircle cx={hw} cy={hw} r={S*0.07} fill={`${GA}0.15)`} stroke={G3} strokeWidth="1" opacity={0.80} />
          {/* Petal dot jewels */}
          {pts(hw, hw, S*0.19, 6, 0).map((p, i) => (
            <SvgCircle key={`fol_jewel_${i}`} cx={p.x} cy={p.y} r={2.8} fill={G3} opacity={0.85} />
          ))}
        </Svg>
      </Animated.View>

      {/* Counter-rotating outer halo for Flower of Life */}
      <Animated.View style={{ position: 'absolute', width: S, height: S,
          opacity: op0, transform: [{ rotate: r0degR }] }}>
        <Svg width={S} height={S}>
          {pts(hw, hw, S*0.43, 12, 0).map((p, i) => (
            <SvgCircle key={`fol_halo_${i}`} cx={p.x} cy={p.y} r={2} fill={G3} opacity={0.20 + (i % 2) * 0.15} />
          ))}
          <SvgCircle cx={hw} cy={hw} r={S*0.45} fill="none" stroke={G4} strokeWidth="0.5" opacity={0.25}
            strokeDasharray="4 8" />
        </Svg>
      </Animated.View>

      {/* ══════════════════════════════════════════════════════════════════════
          SHAPE 1 — METATRON'S CUBE (Full 13-circle pattern)
          ══════════════════════════════════════════════════════════════════ */}
      <Animated.View style={{ position: 'absolute', width: S, height: S,
          opacity: op1, transform: [{ rotate: r1degR }, { scale: sc }] }}>
        <Svg width={S} height={S}>
          {/* All 13 Metatron circles */}
          {[
            { x: hw, y: hw },
            ...pts(hw, hw, S*0.19, 6, 0),
            ...pts(hw, hw, S*0.38, 6, 0),
          ].map((p, i) => (
            <SvgCircle key={`mc_circ_${i}`} cx={p.x} cy={p.y} r={S*0.19}
              fill={`${GA}0.03)`} stroke={G2} strokeWidth="0.8" opacity={i === 0 ? 0.7 : 0.45} />
          ))}
          {/* Lines connecting all 13 centres (Metatron's Cube lines) */}
          {(() => {
            const centers = [{ x: hw, y: hw }, ...pts(hw, hw, S*0.19, 6, 0), ...pts(hw, hw, S*0.38, 6, 0)];
            const paths: any[] = [];
            centers.forEach((a, i) => centers.forEach((b, j) => {
              if (j <= i) return;
              paths.push(<SvgPath key={`mc_ln_${i}_${j}`} d={`M${a.x.toFixed(1)} ${a.y.toFixed(1)} L${b.x.toFixed(1)} ${b.y.toFixed(1)}`}
                stroke={G4} strokeWidth="0.5" opacity={0.25} />);
            }));
            return paths;
          })()}
          {/* Star tetrahedron overlay */}
          <SvgPath d={poly(pts(hw, hw, S*0.34, 3, -Math.PI/2))} fill={`${GA}0.06)`} stroke={G1} strokeWidth="1.8" opacity={0.8} />
          <SvgPath d={poly(pts(hw, hw, S*0.34, 3,  Math.PI/2))} fill={`${GA}0.06)`} stroke={G1} strokeWidth="1.8" opacity={0.8} />
          {/* Outer hexagon */}
          <SvgPath d={poly(pts(hw, hw, S*0.34, 6, 0))} fill="none" stroke={G3} strokeWidth="1" opacity={0.55} />
          {/* Dot jewels on hexagon vertices */}
          {pts(hw, hw, S*0.34, 6, 0).map((p, i) => (
            <SvgCircle key={`mc_vj_${i}`} cx={p.x} cy={p.y} r={3} fill={G3} opacity={0.80} />
          ))}
        </Svg>
      </Animated.View>

      {/* Slow forward counter-layer for Metatron */}
      <Animated.View style={{ position: 'absolute', width: S, height: S,
          opacity: op1, transform: [{ rotate: r0deg }] }}>
        <Svg width={S} height={S}>
          {/* 6-petal inner star */}
          {pts(hw, hw, S*0.38, 6, Math.PI/6).map((p, i, arr) => {
            const n = arr[(i+1)%arr.length];
            return <SvgPath key={`mc_sp_${i}`} d={`M${p.x.toFixed(1)} ${p.y.toFixed(1)} L${n.x.toFixed(1)} ${n.y.toFixed(1)}`}
              stroke={G2} strokeWidth="1" opacity={0.50} />;
          })}
          {pts(hw, hw, S*0.44, 12, 0).map((p, i) => (
            <SvgCircle key={`mc_halo_${i}`} cx={p.x} cy={p.y} r={1.8} fill={G3} opacity={0.22 + (i%3)*0.12} />
          ))}
        </Svg>
      </Animated.View>

      {/* ══════════════════════════════════════════════════════════════════════
          SHAPE 2 — SRI YANTRA (9 interlocked triangles + lotus rings)
          ══════════════════════════════════════════════════════════════════ */}
      <Animated.View style={{ position: 'absolute', width: S, height: S,
          opacity: op2, transform: [{ rotate: r2deg }, { scale: sc }] }}>
        <Svg width={S} height={S}>
          {/* Outer ring (Bhupura gate suggestion) */}
          <SvgCircle cx={hw} cy={hw} r={S*0.43} fill="none" stroke={G4} strokeWidth="0.8" opacity={0.40} strokeDasharray="6 6" />
          {/* 9-triangle Sri Yantra: 4 downward (Shakti) + 5 upward (Shiva) rings */}
          {/* Shakti (downward) — 4 sizes */}
          {[S*0.35, S*0.27, S*0.19, S*0.12].map((r, ti) => (
            <SvgPath key={`sy_d_${ti}`} d={poly(pts(hw, hw, r, 3, Math.PI/6))}
              fill={`${GA}${[0.04, 0.03, 0.02, 0.02][ti]})`}
              stroke={G2} strokeWidth={[1.8, 1.5, 1.3, 1.1][ti]}
              opacity={0.75 + ti * 0.06} />
          ))}
          {/* Shiva (upward) — 5 sizes */}
          {[S*0.38, S*0.30, S*0.22, S*0.15, S*0.08].map((r, ti) => (
            <SvgPath key={`sy_u_${ti}`} d={poly(pts(hw, hw, r, 3, -Math.PI/6))}
              fill={`${GA}${[0.03, 0.03, 0.02, 0.02, 0.01][ti]})`}
              stroke={G1} strokeWidth={[1.8, 1.5, 1.3, 1.1, 0.9][ti]}
              opacity={0.75 + ti * 0.06} />
          ))}
          {/* Innermost Bindu ring */}
          <SvgCircle cx={hw} cy={hw} r={S*0.035} fill={G1} opacity={0.90} />
          {/* 8-petal lotus ring */}
          {pts(hw, hw, S*0.41, 8, 0).map((p, i) => (
            <SvgCircle key={`sy_lotus_${i}`} cx={p.x} cy={p.y} r={S*0.05}
              fill={`${GA}0.06)`} stroke={G4} strokeWidth="0.7" opacity={0.45} />
          ))}
          {/* 16-petal lotus ring */}
          {pts(hw, hw, S*0.41, 16, Math.PI/16).map((p, i) => (
            <SvgCircle key={`sy_lotus16_${i}`} cx={p.x} cy={p.y} r={S*0.026}
              fill="none" stroke={G4} strokeWidth="0.5" opacity={0.25} />
          ))}
        </Svg>
      </Animated.View>

      {/* ══════════════════════════════════════════════════════════════════════
          SHAPE 3 — SHATKONA / STAR OF DAVID (as per your reference image)
          Two large bold golden triangles entangled, with fine ray web
          ══════════════════════════════════════════════════════════════════ */}
      <Animated.View style={{ position: 'absolute', width: S, height: S,
          opacity: op3, transform: [{ rotate: r0deg }, { scale: scSm }] }}>
        <Svg width={S} height={S}>
          {/* Fine radial web — exact like reference image */}
          {pts(hw, hw, S*0.46, 48, 0).map((p, i) => (
            <SvgPath key={`sh_ray_${i}`} d={`M${hw} ${hw} L${p.x.toFixed(1)} ${p.y.toFixed(1)}`}
              stroke={G3} strokeWidth="0.4" opacity={0.09} />
          ))}
          {/* Outer dashed circle */}
          <SvgCircle cx={hw} cy={hw} r={S*0.43} fill="none" stroke={G4} strokeWidth="0.8" opacity={0.40} strokeDasharray="3 5" />
          {/* Main upward triangle (filled golden glow — delicate center) */}
          <SvgPath d={poly(pts(hw, hw, S*0.38, 3, -Math.PI/2))}
            fill={`${GA}0.04)`} stroke={G1} strokeWidth="2.5" opacity={0.92} />
          {/* Main downward triangle (filled golden glow) */}
          <SvgPath d={poly(pts(hw, hw, S*0.38, 3, Math.PI/2))}
            fill={`${GA}0.04)`} stroke={G1} strokeWidth="2.5" opacity={0.92} />
          {/* Hexagram intersection inner highlight */}
          {pts(hw, hw, S*0.20, 6, 0).map((p, i, arr) => {
            const n = arr[(i+1)%arr.length];
            return <SvgPath key={`sh_h_${i}`} d={`M${p.x.toFixed(1)} ${p.y.toFixed(1)} L${n.x.toFixed(1)} ${n.y.toFixed(1)}`}
              stroke={G3} strokeWidth="1.2" opacity={0.70} />;
          })}
          {/* Vertex jewels on both triangles */}
          {pts(hw, hw, S*0.38, 3, -Math.PI/2).map((p, i) => (
            <SvgCircle key={`sh_vup_${i}`} cx={p.x} cy={p.y} r={4.5} fill={G3} opacity={0.90} />
          ))}
          {pts(hw, hw, S*0.38, 3, Math.PI/2).map((p, i) => (
            <SvgCircle key={`sh_vdn_${i}`} cx={p.x} cy={p.y} r={4.5} fill={G3} opacity={0.90} />
          ))}
          {/* Inner rings */}
          <SvgCircle cx={hw} cy={hw} r={S*0.12} fill="none" stroke={G2} strokeWidth="1.2" opacity={0.75} />
          <SvgCircle cx={hw} cy={hw} r={S*0.06} fill="none" stroke={G3} strokeWidth="1"   opacity={0.85} />
        </Svg>
      </Animated.View>

      {/* Counter-rotation ring for Shatkona */}
      <Animated.View style={{ position: 'absolute', width: S, height: S,
          opacity: op3, transform: [{ rotate: r1degR }] }}>
        <Svg width={S} height={S}>
          {pts(hw, hw, S*0.44, 12, Math.PI/12).map((p, i) => (
            <SvgCircle key={`sh_orbit_${i}`} cx={p.x} cy={p.y} r={2.2} fill={G3} opacity={0.18 + (i%3)*0.12} />
          ))}
        </Svg>
      </Animated.View>

      {/* ══════════════════════════════════════════════════════════════════════
          ALWAYS VISIBLE — Orbiting stardust + glowing Bindu
          ══════════════════════════════════════════════════════════════════ */}
      <Animated.View style={{ position: 'absolute', width: S, height: S,
          transform: [{ rotate: r1degR }], opacity: 0.60 }}>
        <Svg width={S} height={S}>
          {pts(hw, hw, S*0.44, 24, 0).map((p, i) => (
            <SvgCircle key={`dust_${i}`} cx={p.x} cy={p.y}
              r={i % 3 === 0 ? 2.2 : 1.3}
              fill={G3}
              opacity={0.15 + (i % 4) * 0.12} />
          ))}
        </Svg>
      </Animated.View>

      {/* Bindu — sacred glowing center dot */}
      <Animated.View style={{
        position: 'absolute', width: 9, height: 9, borderRadius: 4.5,
        backgroundColor: G3,
        shadowColor: G1, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 14,
        opacity: bindOp,
        transform: [{ scale: bindSc }],
      }} />

    </View>
  );
}

export { pts as sacredDots };
