import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing } from 'react-native';
import Svg, { Circle as SvgCircle, Path as SvgPath, G as SvgG } from 'react-native-svg';

export function sacredDots(cx: number, cy: number, r: number, count: number, offsetAngle = 0) {
  return Array.from({ length: count }).map((_, i) => {
    const a = offsetAngle + (i * Math.PI * 2) / count;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
}

export function HeroGeometricAnimation({ size }: { size: number }) {
  const rotAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const breathAnim = useRef(new Animated.Value(0)).current;
  const phaseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Highly performant native-driver animations (NO JS state interval to prevent UI lag)
    Animated.loop(Animated.timing(rotAnim, { toValue: 1, duration: 40000, easing: Easing.linear, useNativeDriver: true })).start();
    
    // Master timeline: 0 to 400 over 40 seconds (10 seconds per shape)
    Animated.loop(Animated.timing(phaseAnim, { toValue: 400, duration: 40000, easing: Easing.linear, useNativeDriver: true })).start();
    
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 0, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: true })
    ])).start();
    
    Animated.loop(Animated.sequence([
      Animated.timing(breathAnim, { toValue: 1, duration: 8000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(breathAnim, { toValue: 0, duration: 8000, easing: Easing.inOut(Easing.sin), useNativeDriver: true })
    ])).start();
  }, []);

  const cx = size / 2, cy = size / 2;
  // Ultra-premium golden palette independent of the dynamic ring color
  const goldPrimary = '#FDB931';
  const goldLight = '#FFF5E1';
  const goldDark = '#B8860B';

  return (
    <View pointerEvents="none" style={{ position: 'absolute', width: size, height: size, zIndex: 2, alignItems: 'center', justifyContent: 'center' }}>
      
      {/* 1. SEED OF LIFE / TORUS (Phase 0 - 10s) */}
      <Animated.View style={{
        position: 'absolute', width: size, height: size,
        transform: [
          { rotate: rotAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) },
          { scale: breathAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.05] }) }
        ],
        opacity: phaseAnim.interpolate({ inputRange: [0, 60, 100, 300, 360, 400], outputRange: [1, 1, 0, 0, 0, 1] })
      }}>
        <Svg width={size} height={size}>
          <SvgCircle cx={cx} cy={cy} r={size * 0.38} fill="none" stroke={goldDark} strokeWidth="1" opacity={0.6} />
          {sacredDots(cx, cy, size * 0.19, 6, 0).map((d, i) => (
             <SvgCircle key={`sol_${i}`} cx={d.x} cy={d.y} r={size * 0.19} fill="none" stroke={goldPrimary} strokeWidth="0.8" opacity={0.7} />
          ))}
        </Svg>
      </Animated.View>

      {/* 2. METATRON'S CUBE (Phase 10 - 20s) */}
      <Animated.View style={{
        position: 'absolute', width: size, height: size,
        transform: [
          { rotateX: '45deg' },
          { rotateY: '-20deg' },
          { rotate: rotAnim.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] }) }
        ],
        opacity: phaseAnim.interpolate({ inputRange: [0, 60, 100, 160, 200, 400], outputRange: [0, 0, 1, 1, 0, 0] })
      }}>
        <Svg width={size} height={size}>
          <SvgG opacity={0.7}>
            {/* Inner & Outer Hexagons */}
            {sacredDots(cx, cy, size * 0.30, 6, 0).map((d, i, arr) => {
              const next = arr[(i + 1) % arr.length];
              return <SvgPath key={`mc_hex1_${i}`} d={`M${d.x.toFixed(1)} ${d.y.toFixed(1)} L${next.x.toFixed(1)} ${next.y.toFixed(1)}`} stroke={goldLight} strokeWidth="1.2" />;
            })}
            {sacredDots(cx, cy, size * 0.15, 6, Math.PI / 6).map((d, i, arr) => {
              const next = arr[(i + 1) % arr.length];
              return <SvgPath key={`mc_hex2_${i}`} d={`M${d.x.toFixed(1)} ${d.y.toFixed(1)} L${next.x.toFixed(1)} ${next.y.toFixed(1)}`} stroke={goldPrimary} strokeWidth="1" />;
            })}
            {/* Star Tetrahedron Lines */}
            {sacredDots(cx, cy, size * 0.30, 3, Math.PI / 6).map((d, i, arr) => {
              const next = arr[(i + 1) % arr.length];
              return <SvgPath key={`mc_tri1_${i}`} d={`M${d.x.toFixed(1)} ${d.y.toFixed(1)} L${next.x.toFixed(1)} ${next.y.toFixed(1)}`} stroke={goldPrimary} strokeWidth="1" />;
            })}
            {sacredDots(cx, cy, size * 0.30, 3, -Math.PI / 6).map((d, i, arr) => {
              const next = arr[(i + 1) % arr.length];
              return <SvgPath key={`mc_tri2_${i}`} d={`M${d.x.toFixed(1)} ${d.y.toFixed(1)} L${next.x.toFixed(1)} ${next.y.toFixed(1)}`} stroke={goldPrimary} strokeWidth="1" />;
            })}
          </SvgG>
        </Svg>
      </Animated.View>

      {/* 3. SRI YANTRA ASCENSION (Phase 20 - 30s) */}
      <Animated.View style={{
        position: 'absolute', width: size, height: size,
        transform: [
          { rotate: rotAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) },
          { scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.05] }) }
        ],
        opacity: phaseAnim.interpolate({ inputRange: [0, 160, 200, 260, 300, 400], outputRange: [0, 0, 1, 1, 0, 0] })
      }}>
        <Svg width={size} height={size}>
          <SvgG opacity={0.8}>
            {/* Upward Triangles (Shiva) */}
            {sacredDots(cx, cy, size * 0.26, 3, -Math.PI / 6).map((d, i, arr) => {
              const next = arr[(i + 1) % arr.length];
              return <SvgPath key={`sy_u1_${i}`} d={`M${d.x.toFixed(1)} ${d.y.toFixed(1)} L${next.x.toFixed(1)} ${next.y.toFixed(1)}`} stroke={goldLight} strokeWidth="1.5" />;
            })}
            {sacredDots(cx, cy, size * 0.18, 3, -Math.PI / 6).map((d, i, arr) => {
              const next = arr[(i + 1) % arr.length];
              return <SvgPath key={`sy_u2_${i}`} d={`M${d.x.toFixed(1)} ${d.y.toFixed(1)} L${next.x.toFixed(1)} ${next.y.toFixed(1)}`} stroke={goldPrimary} strokeWidth="1.2" />;
            })}
            {/* Downward Triangles (Shakti) */}
            {sacredDots(cx, cy, size * 0.30, 3, Math.PI / 6).map((d, i, arr) => {
              const next = arr[(i + 1) % arr.length];
              return <SvgPath key={`sy_d1_${i}`} d={`M${d.x.toFixed(1)} ${d.y.toFixed(1)} L${next.x.toFixed(1)} ${next.y.toFixed(1)}`} stroke={goldLight} strokeWidth="1.5" />;
            })}
            {sacredDots(cx, cy, size * 0.14, 3, Math.PI / 6).map((d, i, arr) => {
              const next = arr[(i + 1) % arr.length];
              return <SvgPath key={`sy_d2_${i}`} d={`M${d.x.toFixed(1)} ${d.y.toFixed(1)} L${next.x.toFixed(1)} ${next.y.toFixed(1)}`} stroke={goldPrimary} strokeWidth="1.2" />;
            })}
          </SvgG>
        </Svg>
      </Animated.View>

      {/* 4. SHATKONA (Entangled Triangles - Phase 30 - 40s) */}
      <Animated.View style={{
        position: 'absolute', width: size, height: size,
        transform: [
          { rotate: rotAnim.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] }) },
          { scale: breathAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.05] }) }
        ],
        opacity: phaseAnim.interpolate({ inputRange: [0, 260, 300, 360, 400], outputRange: [0, 0, 1, 1, 0] })
      }}>
        <Svg width={size} height={size}>
          <SvgG opacity={0.9}>
            {/* Fine outer web / radiating lines */}
            {sacredDots(cx, cy, size * 0.45, 48, 0).map((d, i) => (
               <SvgPath key={`sh_ray_${i}`} d={`M${cx} ${cy} L${d.x.toFixed(1)} ${d.y.toFixed(1)}`} stroke={goldLight} strokeWidth="0.5" opacity={0.15} />
            ))}
            {/* Upward Triangle */}
            {(() => {
              const pts = sacredDots(cx, cy, size * 0.35, 3, -Math.PI / 2);
              return <SvgPath d={`M${pts[0].x} ${pts[0].y} L${pts[1].x} ${pts[1].y} L${pts[2].x} ${pts[2].y} Z`} fill="rgba(253,185,49,0.12)" stroke={goldPrimary} strokeWidth="2" />;
            })()}
            {/* Downward Triangle */}
            {(() => {
              const pts = sacredDots(cx, cy, size * 0.35, 3, Math.PI / 2);
              return <SvgPath d={`M${pts[0].x} ${pts[0].y} L${pts[1].x} ${pts[1].y} L${pts[2].x} ${pts[2].y} Z`} fill="rgba(253,185,49,0.12)" stroke={goldPrimary} strokeWidth="2" />;
            })()}
            {/* Inner rings */}
            <SvgCircle cx={cx} cy={cy} r={size * 0.18} fill="none" stroke={goldLight} strokeWidth="1" opacity={0.6} />
            <SvgCircle cx={cx} cy={cy} r={size * 0.09} fill="none" stroke={goldPrimary} strokeWidth="1" opacity={0.8} />
          </SvgG>
        </Svg>
      </Animated.View>

      {/* Center Bindu (Glowing Core) - Always visible */}
      <Animated.View style={{
        position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: goldLight,
        shadowColor: goldPrimary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 12,
        opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }),
        transform: [{ scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.4] }) }]
      }} />

      {/* Orbiting Stardust Particles - Always visible */}
      <Animated.View style={{
        position: 'absolute', width: size, height: size,
        transform: [{ rotate: rotAnim.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] }) }],
        opacity: 0.6
      }}>
        <Svg width={size} height={size}>
          {sacredDots(cx, cy, size * 0.42, 12, 0).map((d, i) => (
             <SvgCircle key={`dust_${i}`} cx={d.x} cy={d.y} r={1.5 + (i % 2)} fill={goldLight} opacity={0.3 + (i % 3) * 0.25} />
          ))}
        </Svg>
      </Animated.View>

    </View>
  );
}
