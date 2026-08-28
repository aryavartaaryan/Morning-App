import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect, Circle } from 'react-native-svg';

const { height: H, width: W } = Dimensions.get('window');

// 20 seeded star coordinates for subtle cosmic depth
const STARS = [
  { x: W * 0.12, y: H * 0.08, r: 1.2, baseOp: 0.5 },
  { x: W * 0.85, y: H * 0.11, r: 1.5, baseOp: 0.6 },
  { x: W * 0.25, y: H * 0.19, r: 0.9, baseOp: 0.4 },
  { x: W * 0.78, y: H * 0.22, r: 1.8, baseOp: 0.7 },
  { x: W * 0.08, y: H * 0.29, r: 1.1, baseOp: 0.35 },
  { x: W * 0.92, y: H * 0.34, r: 1.3, baseOp: 0.55 },
  { x: W * 0.15, y: H * 0.48, r: 1.0, baseOp: 0.4 },
  { x: W * 0.88, y: H * 0.52, r: 1.6, baseOp: 0.65 },
  { x: W * 0.05, y: H * 0.63, r: 1.4, baseOp: 0.45 },
  { x: W * 0.95, y: H * 0.68, r: 1.1, baseOp: 0.5 },
  { x: W * 0.22, y: H * 0.74, r: 1.7, baseOp: 0.6 },
  { x: W * 0.82, y: H * 0.79, r: 1.0, baseOp: 0.4 },
  { x: W * 0.14, y: H * 0.88, r: 1.3, baseOp: 0.5 },
  { x: W * 0.75, y: H * 0.91, r: 1.5, baseOp: 0.55 },
  { x: W * 0.45, y: H * 0.06, r: 1.0, baseOp: 0.35 },
  { x: W * 0.60, y: H * 0.15, r: 1.2, baseOp: 0.45 },
  { x: W * 0.38, y: H * 0.83, r: 1.4, baseOp: 0.5 },
  { x: W * 0.62, y: H * 0.86, r: 1.1, baseOp: 0.4 },
  { x: W * 0.18, y: H * 0.38, r: 0.8, baseOp: 0.3 },
  { x: W * 0.84, y: H * 0.42, r: 1.2, baseOp: 0.45 },
];

export const VastuCosmicAura = () => {
  const breathAnim = useRef(new Animated.Value(0)).current;
  const starTwinkle = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 12-second deep cosmic breathing cycle
    Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, { toValue: 1, duration: 6000, useNativeDriver: true }),
        Animated.timing(breathAnim, { toValue: 0, duration: 6000, useNativeDriver: true }),
      ])
    ).start();

    // Subtle star twinkle cycle
    Animated.loop(
      Animated.sequence([
        Animated.timing(starTwinkle, { toValue: 1, duration: 3500, useNativeDriver: true }),
        Animated.timing(starTwinkle, { toValue: 0, duration: 3500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const scale1 = breathAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const scale2 = breathAnim.interpolate({ inputRange: [0, 1], outputRange: [1.08, 0.96] });

  // Ultra-dark subtle opacities for the cosmic nebulae
  const opGoldNebula = breathAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.18, 0.32, 0.18] });
  const opDarkAura = breathAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.25, 0.45, 0.25] });
  const opStars = starTwinkle.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.5, 0.85, 0.5] });

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {/* ── Base Dark Obsidian Sheet ── */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#050509' }]} />

      {/* ── Top Subtle Dark Gold Celestial Nebula ── */}
      <Animated.View style={{
        position: 'absolute', top: -140, left: -100,
        width: W + 200, height: H * 0.55,
        transform: [{ scale: scale1 }],
        alignItems: 'center', justifyContent: 'center'
      }}>
        <Animated.View style={{ ...StyleSheet.absoluteFillObject, opacity: opGoldNebula }}>
          <Svg height="100%" width="100%">
            <Defs>
              <RadialGradient id="darkGoldNebula" cx="50%" cy="40%" r="60%">
                <Stop offset="0%" stopColor="#2E230B" stopOpacity="0.45" />
                <Stop offset="50%" stopColor="#140F05" stopOpacity="0.2" />
                <Stop offset="100%" stopColor="#050509" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#darkGoldNebula)" />
          </Svg>
        </Animated.View>
      </Animated.View>

      {/* ── Center Sacred Compass Aura (Ultra Dark Gold Resonance) ── */}
      <Animated.View style={{
        position: 'absolute',
        top: H * 0.24 - (W * 0.9) / 2,
        left: (W - W * 0.9) / 2,
        width: W * 0.9, height: W * 0.9,
        transform: [{ scale: scale2 }],
        alignItems: 'center', justifyContent: 'center'
      }}>
        <Animated.View style={{ ...StyleSheet.absoluteFillObject, opacity: opDarkAura }}>
          <Svg height="100%" width="100%">
            <Defs>
              <RadialGradient id="centerSacredGlow" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor="#3B2E10" stopOpacity="0.35" />
                <Stop offset="55%" stopColor="#1A1407" stopOpacity="0.15" />
                <Stop offset="100%" stopColor="#050509" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Circle cx={(W * 0.9) / 2} cy={(W * 0.9) / 2} r={(W * 0.9) / 2} fill="url(#centerSacredGlow)" />
          </Svg>
        </Animated.View>
      </Animated.View>

      {/* ── Bottom Midnight Astral Depth ── */}
      <Animated.View style={{
        position: 'absolute', bottom: -120, left: -100,
        width: W + 200, height: H * 0.5,
        transform: [{ scale: scale1 }],
        alignItems: 'center', justifyContent: 'center'
      }}>
        <Animated.View style={{ ...StyleSheet.absoluteFillObject, opacity: opGoldNebula }}>
          <Svg height="100%" width="100%">
            <Defs>
              <RadialGradient id="darkMidnightNebula" cx="50%" cy="60%" r="65%">
                <Stop offset="0%" stopColor="#0D101C" stopOpacity="0.4" />
                <Stop offset="60%" stopColor="#060810" stopOpacity="0.15" />
                <Stop offset="100%" stopColor="#050509" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#darkMidnightNebula)" />
          </Svg>
        </Animated.View>
      </Animated.View>

      {/* ── Micro Stardust Layer (Subtle Cosmic Sparkles) ── */}
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: opStars }]}>
        <Svg height={H} width={W}>
          {STARS.map((star, idx) => (
            <Circle
              key={`star_${idx}`}
              cx={star.x}
              cy={star.y}
              r={star.r}
              fill="#FFE8B2"
              opacity={star.baseOp}
            />
          ))}
        </Svg>
      </Animated.View>
    </View>
  );
};
