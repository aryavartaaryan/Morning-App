import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, Easing } from 'react-native';
import Svg, {
  Circle as SvgCircle, Path as SvgPath, G as SvgG,
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

interface SplashGeometricAnimationProps {
  size: number;
  opacity?: number;
}

export function SplashGeometricAnimation({
  size,
  opacity = 0.85,
}: SplashGeometricAnimationProps) {
  const hw = size / 2;
  const S = size;

  // ── Animation Drivers ───────────────────────────────────────────────────────
  const rotA = useRef(new Animated.Value(0)).current; // CW  45s (ultra slow)
  const rotB = useRef(new Animated.Value(0)).current; // CCW 35s
  const rotC = useRef(new Animated.Value(0)).current; // CW  25s
  const rotD = useRef(new Animated.Value(0)).current; // CCW 20s
  
  const op0 = useRef(new Animated.Value(1)).current; // Shape 0 Opacity
  const op1 = useRef(new Animated.Value(0)).current; // Shape 1 Opacity
  
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loopLinear = (val: Animated.Value, dur: number) => {
      Animated.loop(
        Animated.timing(val, { toValue: 1, duration: dur, easing: Easing.linear, useNativeDriver: true })
      ).start();
    };

    loopLinear(rotA, 45000);
    loopLinear(rotB, 35000);
    loopLinear(rotC, 25000);
    loopLinear(rotD, 20000);

    // Subtle breathing pulse for the core
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();

    // ── Premium Shape Transition Cycle ──
    const HOLD = 3500; // Hold shape for 3.5s
    const FADE = 2000; // 2s premium smooth crossfade

    function runCycle(currentShape: number) {
      const nextShape = (currentShape + 1) % 2;
      const currentOp = currentShape === 0 ? op0 : op1;
      const nextOp = nextShape === 0 ? op0 : op1;

      Animated.sequence([
        Animated.delay(HOLD),
        Animated.parallel([
          Animated.timing(currentOp, { toValue: 0, duration: FADE, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(nextOp, { toValue: 1, duration: FADE, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ]).start(({ finished }) => {
        if (finished) {
          runCycle(nextShape);
        }
      });
    }
    runCycle(0);
  }, []);

  // ── Interpolations ──────────────────────────────────────────────────────────
  const cw = (r: Animated.Value) => r.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const ccw = (r: Animated.Value) => r.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });

  const cwA = cw(rotA);
  const ccwB = ccw(rotB);
  const cwC = cw(rotC);
  const ccwD = ccw(rotD);

  const bindSc = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.12] });
  const bindOp = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] });

  // ── Palette (Ultra Premium Gold/Ethereal) ───────────────────────────────────
  const GOLD_1 = '#FFD700';
  const GOLD_2 = '#FDB931';
  const WHITE = '#FFFFFF';
  const GOLD_MUTED = 'rgba(253, 185, 49, 0.4)';
  const GOLD_TRANSPARENT = 'rgba(255, 215, 0, 0.15)';
  const WHITE_TRANSPARENT = 'rgba(255, 255, 255, 0.2)';

  // Helper for rotating layers
  const Layer = ({ rot, children, style = {} }: { rot: any; children: React.ReactNode; style?: any }) => (
    <Animated.View style={[{ position: 'absolute', width: S, height: S, transform: [{ rotate: rot }] }, style]}>
      {children}
    </Animated.View>
  );

  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', width: S, height: S, zIndex: 2, opacity, justifyContent: 'center', alignItems: 'center' }}
    >
      {/* ── Always Visible Cosmic Dust Background ── */}
      <Layer rot={cwA} style={{ opacity: 0.6 }}>
        <Svg width={S} height={S}>
          {pts(hw, hw, S * 0.46, 48, 0).map((p, i) => (
            <SvgCircle key={`dust_${i}`} cx={p.x} cy={p.y} r={i % 3 === 0 ? 1.5 : 0.8} fill={WHITE} opacity={0.15 + (i % 5) * 0.05} />
          ))}
          <SvgCircle cx={hw} cy={hw} r={S * 0.44} fill="none" stroke={GOLD_MUTED} strokeWidth="0.5" opacity={0.3} strokeDasharray="2 8" />
        </Svg>
      </Layer>

      {/* ════════════════════════════════════════════════════════════════════
          SHAPE 1: THE SHATKONA LOTUS MANDALA (Elegance & Perfect Balance)
          ════════════════════════════════════════════════════════════════ */}
      <Animated.View style={{ position: 'absolute', width: S, height: S, opacity: op0 }}>
        {/* Outer 16-Petal Lotus */}
        <Layer rot={ccwB}>
          <Svg width={S} height={S}>
            {pts(hw, hw, S * 0.38, 16, 0).map((p, i) => (
              <SvgCircle key={`lotus16_${i}`} cx={p.x} cy={p.y} r={S * 0.06} fill={GOLD_TRANSPARENT} stroke={GOLD_MUTED} strokeWidth="0.8" opacity={0.6} />
            ))}
            {/* Outer Geometry Bounds */}
            {pts(hw, hw, S * 0.42, 16, Math.PI / 16).map((p, i, arr) => {
              const next = arr[(i + 1) % arr.length];
              return <SvgPath key={`bound_${i}`} d={`M${p.x} ${p.y} L${next.x} ${next.y}`} stroke={WHITE_TRANSPARENT} strokeWidth="0.5" opacity={0.3} />;
            })}
          </Svg>
        </Layer>

        {/* Shatkona - Downward Triangle */}
        <Layer rot={cwC}>
          <Svg width={S} height={S}>
            <SvgPath d={poly(pts(hw, hw, S * 0.28, 3, Math.PI / 6))} fill={GOLD_TRANSPARENT} stroke={GOLD_2} strokeWidth="1.5" strokeLinejoin="round" opacity={0.9} />
            {pts(hw, hw, S * 0.28, 3, Math.PI / 6).map((p, i) => (
              <SvgCircle key={`dvj_${i}`} cx={p.x} cy={p.y} r={3.5} fill={WHITE} opacity={0.95} />
            ))}
          </Svg>
        </Layer>

        {/* Shatkona - Upward Triangle */}
        <Layer rot={ccwD}>
          <Svg width={S} height={S}>
            <SvgPath d={poly(pts(hw, hw, S * 0.28, 3, -Math.PI / 6))} fill={GOLD_TRANSPARENT} stroke={GOLD_1} strokeWidth="1.5" strokeLinejoin="round" opacity={0.9} />
            {pts(hw, hw, S * 0.28, 3, -Math.PI / 6).map((p, i) => (
              <SvgCircle key={`uvj_${i}`} cx={p.x} cy={p.y} r={3.5} fill={WHITE} opacity={0.95} />
            ))}
            {/* Inner Hexagon Core */}
            <SvgPath d={poly(pts(hw, hw, S * 0.16, 6, 0))} fill="none" stroke={WHITE} strokeWidth="0.8" opacity={0.6} />
          </Svg>
        </Layer>
      </Animated.View>

      {/* ════════════════════════════════════════════════════════════════════
          SHAPE 2: THE SRI YANTRA SEED (Deep Focus & Infinite Layering)
          ════════════════════════════════════════════════════════════════ */}
      <Animated.View style={{ position: 'absolute', width: S, height: S, opacity: op1 }}>
        {/* Inner 8-Petal Lotus & Deep Focus Rings */}
        <Layer rot={cwA}>
          <Svg width={S} height={S}>
            <SvgCircle cx={hw} cy={hw} r={S * 0.36} fill="none" stroke={GOLD_MUTED} strokeWidth="0.8" opacity={0.5} strokeDasharray="4 6" />
            <SvgCircle cx={hw} cy={hw} r={S * 0.34} fill="none" stroke={GOLD_1} strokeWidth="0.4" opacity={0.3} />
            
            {pts(hw, hw, S * 0.3, 8, Math.PI / 8).map((p, i) => (
              <SvgCircle key={`lotus8_${i}`} cx={p.x} cy={p.y} r={S * 0.05} fill="none" stroke={GOLD_1} strokeWidth="1.2" opacity={0.6} />
            ))}
          </Svg>
        </Layer>

        {/* Sri Yantra Downward Base */}
        <Layer rot={ccwB}>
          <Svg width={S} height={S}>
            {[S * 0.26, S * 0.20].map((r, ti) => (
              <SvgPath key={`sy_d_${ti}`} d={poly(pts(hw, hw, r, 3, Math.PI / 6))} fill="none" stroke={GOLD_2} strokeWidth="1.2" strokeLinejoin="round" opacity={0.7 + ti * 0.15} />
            ))}
            {pts(hw, hw, S * 0.26, 3, Math.PI / 6).map((p, i) => (
              <SvgCircle key={`sy_dj_${i}`} cx={p.x} cy={p.y} r={3} fill={GOLD_1} opacity={0.8} />
            ))}
          </Svg>
        </Layer>

        {/* Sri Yantra Upward Core */}
        <Layer rot={cwC}>
          <Svg width={S} height={S}>
            {[S * 0.22, S * 0.15, S * 0.09].map((r, ti) => (
              <SvgPath key={`sy_u_${ti}`} d={poly(pts(hw, hw, r, 3, -Math.PI / 6))} fill="none" stroke={GOLD_1} strokeWidth="1.5" strokeLinejoin="round" opacity={0.8 + ti * 0.1} />
            ))}
            {/* Bindu Halo Rings */}
            <SvgCircle cx={hw} cy={hw} r={S * 0.05} fill="none" stroke={GOLD_2} strokeWidth="1.2" opacity={0.9} />
            <SvgCircle cx={hw} cy={hw} r={S * 0.025} fill="none" stroke={WHITE} strokeWidth="0.6" opacity={0.7} />
          </Svg>
        </Layer>
      </Animated.View>

      {/* ── 5. The Ultimate Bindu (Pulsing Center shared by both) ── */}
      <Animated.View style={{
        position: 'absolute',
        width: 12, height: 12,
        borderRadius: 6,
        backgroundColor: WHITE,
        shadowColor: GOLD_1,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 18,
        opacity: bindOp,
        transform: [{ scale: bindSc }],
      }} />
    </View>
  );
}
