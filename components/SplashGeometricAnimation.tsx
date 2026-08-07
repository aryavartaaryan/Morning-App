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
  const torusProgress = useSharedValue(0);
  const torusCollapse = useSharedValue(0);
  const shatkonaProgress = useSharedValue(0);
  const breath = useSharedValue(0);
  const rot = useSharedValue(0);

  useEffect(() => {
    // 1. Bindu Drops in
    binduScale.value = withSequence(
      withDelay(100, withSpring(1, { damping: 12, stiffness: 100 })),
      withDelay(4000, withTiming(1.5, { duration: 2000, easing: Easing.inOut(Easing.ease) }))
    );

    // 2. Torus forms, orbits, and draws
    torusProgress.value = withDelay(
      500,
      withTiming(1, { duration: 2500, easing: Easing.out(Easing.cubic) })
    );

    // 3. Torus collapses
    torusCollapse.value = withDelay(
      3200,
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.cubic) })
    );

    // 4. Shatkona draws
    shatkonaProgress.value = withDelay(
      3800,
      withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.ease) })
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

  // Generate 12 Torus Circles
  const NUM_TORUS = 12;
  const torusCircles = Array.from({ length: NUM_TORUS }).map((_, i) => {
    const angle = (i * Math.PI * 2) / NUM_TORUS;
    
    const animatedProps = useAnimatedProps(() => {
      // Expand distance from center, then collapse
      const dist = interpolate(torusProgress.value, [0, 1], [0, S * 0.22]) * 
                   interpolate(torusCollapse.value, [0, 1], [1, 0]);
      
      const cx = hw + dist * Math.cos(angle + torusProgress.value * Math.PI);
      const cy = hw + dist * Math.sin(angle + torusProgress.value * Math.PI);
      
      const r = interpolate(torusProgress.value, [0, 1], [0, S * 0.18]) *
                interpolate(torusCollapse.value, [0, 1], [1, 0.2]);

      const dashOff = interpolate(torusProgress.value, [0, 1], [S * 2, 0]);
      const op = interpolate(torusCollapse.value, [0, 0.8, 1], [1, 0.5, 0]);

      return {
        cx,
        cy,
        r,
        strokeDashoffset: dashOff,
        opacity: op,
      };
    });

    return (
      <AnimatedCircle
        key={i}
        animatedProps={animatedProps}
        stroke={GOLD_2}
        strokeWidth="1.2"
        fill="none"
        strokeDasharray={S * 2}
      />
    );
  });

  return (
    <View style={{ position: 'absolute', width: S, height: S, opacity, justifyContent: 'center', alignItems: 'center' }} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, globalStyle]}>
        <Svg width={S} height={S}>
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

          {/* Torus Circles */}
          {torusCircles}

          {/* Shatkona */}
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
        elevation: 5
      }, binduStyle]} />
    </View>
  );
}
