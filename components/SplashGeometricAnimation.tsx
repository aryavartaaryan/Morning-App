import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  withDelay,
  Easing,
  interpolate,
  withRepeat,
} from 'react-native-reanimated';
import Svg, { Circle, Path, G, Defs, RadialGradient, Stop } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);

interface Props {
  size: number;
  opacity?: number;
}

export function SplashGeometricAnimation({ size, opacity = 0.85 }: Props) {
  const hw = size / 2;
  const S = size;

  // -- Constants --
  const GOLD_1 = '#FFD700';
  const GOLD_2 = '#FDB931';
  const WHITE = '#FFFFFF';
  
  // -- Shared Values --
  const binduScale = useSharedValue(0);
  const gyroTime = useSharedValue(0);
  const gyroFade = useSharedValue(0);
  const shatkonaProgress = useSharedValue(0);
  const breath = useSharedValue(0);
  const rot = useSharedValue(0);

  useEffect(() => {
    // 1. Bindu Drops in
    binduScale.value = withSequence(
      withDelay(100, withSpring(1, { damping: 12, stiffness: 100 })),
      withDelay(4000, withTiming(1.5, { duration: 2000, easing: Easing.inOut(Easing.ease) }))
    );

    // 2. Ultra-Premium 3D Gyroscope / Astrolabe spins and aligns
    // It takes 3.2 seconds to explode outward, spin wildly in 3D, and align perfectly flat.
    gyroTime.value = withDelay(
      300,
      withTiming(1, { duration: 3200, easing: Easing.out(Easing.cubic) })
    );

    // 3. Gyroscope Fades out smoothly once aligned
    gyroFade.value = withDelay(
      3400,
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.cubic) })
    );

    // 4. Intricate Stroked Shatkona Draws Itself (The part you loved)
    shatkonaProgress.value = withDelay(
      3500,
      withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.ease) })
    );

    // 5. Global breath
    breath.value = withDelay(
      6000,
      withRepeat(
        withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.sin) }),
        -1,
        true
      )
    );

    // 6. Global rotation
    rot.value = withRepeat(
      withTiming(1, { duration: 60000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  // -- Geometry Helpers --
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

  const R = S * 0.28;
  const path1 = poly(pts(hw, hw, R, 3, Math.PI / 6));
  const path2 = poly(pts(hw, hw, R, 3, -Math.PI / 6));
  const PATH_LEN = S * 1.5;

  // -- Animated Styles & Props --
  const binduStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: binduScale.value * interpolate(breath.value, [0, 1], [1, 1.1]) }
    ],
    opacity: interpolate(shatkonaProgress.value, [0, 1], [1, 0.8]),
  }));

  const globalStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${rot.value * 360}deg` },
      { scale: interpolate(breath.value, [0, 1], [1, 1.05]) }
    ],
  }));

  // Shatkona path props
  const shatkonaProps = useAnimatedProps(() => ({
    strokeDashoffset: interpolate(shatkonaProgress.value, [0, 1], [PATH_LEN, 0]),
    strokeOpacity: interpolate(shatkonaProgress.value, [0, 0.2, 1], [0, 1, 1]),
    fillOpacity: interpolate(shatkonaProgress.value, [0.8, 1], [0, 0.15]),
  }));

  // -- 3D Gyroscope Rings Configuration --
  // We define 5 rings that spin on different 3D axes and eventually align to 0deg.
  const gyroRings = [
    { r: S * 0.38, strokeWidth: 1, dash: [4, 8], xRot: 1080, yRot: -720, zRot: 1440, color: GOLD_1 },
    { r: S * 0.33, strokeWidth: 2, dash: [1, 0], xRot: -720, yRot: 1440, zRot: -1080, color: GOLD_2 },
    { r: S * 0.28, strokeWidth: 1.5, dash: [12, 6], xRot: 1440, yRot: 1080, zRot: 720, color: GOLD_1 },
    { r: S * 0.23, strokeWidth: 0.5, dash: [2, 4], xRot: -1440, yRot: -1080, zRot: -720, color: WHITE },
    { r: S * 0.18, strokeWidth: 2.5, dash: [20, 10], xRot: 720, yRot: -1440, zRot: 1080, color: GOLD_2 },
  ];

  return (
    <View style={{ position: 'absolute', width: S, height: S, opacity, justifyContent: 'center', alignItems: 'center' }} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, globalStyle]}>
        
        {/* Phase 1: Ultra Premium 3D Gyroscope Alignment */}
        <Animated.View style={[StyleSheet.absoluteFill, { position: 'absolute', zIndex: 1 }]} pointerEvents="none">
          {gyroRings.map((ring, i) => {
            const ringStyle = useAnimatedStyle(() => {
              // Spin from wild angles to exactly 0deg
              const rotX = interpolate(gyroTime.value, [0, 1], [ring.xRot, 0]) + 'deg';
              const rotY = interpolate(gyroTime.value, [0, 1], [ring.yRot, 0]) + 'deg';
              const rotZ = interpolate(gyroTime.value, [0, 1], [ring.zRot, 0]) + 'deg';
              // Explode scale from 0 to 1
              const scale = interpolate(gyroTime.value, [0, 0.4, 1], [0.1, 1.1, 1]);
              const fade = interpolate(gyroFade.value, [0, 1], [1, 0]);

              return {
                transform: [
                  { perspective: 800 },
                  { rotateX: rotX },
                  { rotateY: rotY },
                  { rotateZ: rotZ },
                  { scale: scale }
                ],
                opacity: fade,
              };
            });

            // Path draws itself while spinning
            const ringProps = useAnimatedProps(() => {
              const circumference = 2 * Math.PI * ring.r;
              return {
                strokeDashoffset: interpolate(gyroTime.value, [0, 0.8, 1], [circumference, 0, 0]),
                strokeDasharray: ring.dash[0] === 1 && ring.dash[1] === 0 ? [circumference, circumference] : ring.dash,
              };
            });

            return (
              <Animated.View key={`gyro_${i}`} style={[StyleSheet.absoluteFill, ringStyle, { justifyContent: 'center', alignItems: 'center' }]}>
                <Svg width={S} height={S}>
                  <AnimatedCircle
                    cx={hw} cy={hw} r={ring.r}
                    stroke={ring.color}
                    strokeWidth={ring.strokeWidth}
                    fill="none"
                    animatedProps={ringProps}
                  />
                  {/* Subtle node points on the rings */}
                  <Circle cx={hw} cy={hw - ring.r} r={ring.strokeWidth * 2} fill={WHITE} />
                  <Circle cx={hw} cy={hw + ring.r} r={ring.strokeWidth * 2} fill={WHITE} />
                </Svg>
              </Animated.View>
            );
          })}
        </Animated.View>

        {/* Phase 2: Intricate Stroked Shatkona (World Class) */}
        <Svg width={S} height={S} style={{ position: 'absolute', zIndex: 2 }}>
          <Defs>
            <RadialGradient id="glow" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0%" stopColor={GOLD_1} stopOpacity="0.5" />
              <Stop offset="100%" stopColor={GOLD_1} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          
          {/* Central Bindu Glow */}
          <AnimatedCircle
            cx={hw} cy={hw} r={S * 0.4}
            fill="url(#glow)"
            animatedProps={useAnimatedProps(() => ({
              opacity: interpolate(shatkonaProgress.value, [0.5, 1], [0, 1]),
            }))}
          />

          {/* Stroked Shatkona */}
          <AnimatedPath
            d={path1}
            stroke={GOLD_1}
            strokeWidth="2.5"
            fill={GOLD_1}
            strokeDasharray={PATH_LEN}
            strokeLinejoin="round"
            animatedProps={shatkonaProps}
          />
          <AnimatedPath
            d={path2}
            stroke={GOLD_2}
            strokeWidth="2.5"
            fill={GOLD_2}
            strokeDasharray={PATH_LEN}
            strokeLinejoin="round"
            animatedProps={shatkonaProps}
          />

          {/* Shatkona Nodes */}
          <AnimatedG animatedProps={useAnimatedProps(() => ({ opacity: shatkonaProgress.value }))}>
            {pts(hw, hw, R, 3, Math.PI / 6).map((p, i) => (
              <Circle key={`d_${i}`} cx={p.x} cy={p.y} r="3.5" fill={WHITE} />
            ))}
            {pts(hw, hw, R, 3, -Math.PI / 6).map((p, i) => (
              <Circle key={`u_${i}`} cx={p.x} cy={p.y} r="3.5" fill={WHITE} />
            ))}
          </AnimatedG>
        </Svg>
      </Animated.View>

      {/* Bindu (Center Dot) */}
      <Animated.View style={[{
        position: 'absolute',
        width: 12, height: 12,
        borderRadius: 6,
        backgroundColor: WHITE,
        shadowColor: GOLD_1,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 15,
        elevation: 5,
        zIndex: 3
      }, binduStyle]} />
    </View>
  );
}
