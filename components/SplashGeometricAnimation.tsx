import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  interpolate,
  withRepeat,
  withSequence,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  size: number;
  opacity?: number;
}

export function SplashGeometricAnimation({ size, opacity = 0.85 }: Props) {
  const hw = size / 2;
  const S = size;

  // -- Color Palette (Ultra Premium Sunrise Glow) --
  const GOLD_1 = '#FFD700';
  const GOLD_2 = '#FDB931';
  const GOLD_3 = '#FF8C00'; // Deep sunrise orange for the mist
  
  // -- Shared Values --
  const orbPulse = useSharedValue(0);
  const orbFadeIn = useSharedValue(0);
  const phaseTwoTransition = useSharedValue(0);
  const mistDriftX = useSharedValue(0);
  const mistDriftY = useSharedValue(0);
  const globalScale = useSharedValue(1);

  useEffect(() => {
    // Ultra-soft calming easing
    const gentleEase = Easing.bezier(0.25, 0.1, 0.25, 1);
    const deepBreathEase = Easing.inOut(Easing.sin);

    // 1. Orb fades in softly (0 - 1.0s)
    orbFadeIn.value = withTiming(1, { duration: 1000, easing: gentleEase });

    // 2. Continuous Glowing Pulse (In and Out breathing effect)
    orbPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2500, easing: deepBreathEase }),
        withTiming(0, { duration: 2500, easing: deepBreathEase })
      ),
      -1, // infinite
      false
    );

    // 3. Subtle continuous breath on the whole container
    globalScale.value = withRepeat(
      withSequence(
        withTiming(1.02, { duration: 3000, easing: deepBreathEase }),
        withTiming(0.98, { duration: 3000, easing: deepBreathEase })
      ),
      -1,
      true
    );

    // 4. Phase 2 Transition (4.2s) - Dissolves Orb into Ethereal Mist
    phaseTwoTransition.value = withDelay(
      4200, 
      withTiming(1, { duration: 1800, easing: gentleEase })
    );

    // 5. The Ethereal Mist drifts very slowly organically
    mistDriftX.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 8000, easing: deepBreathEase }),
        withTiming(0, { duration: 8000, easing: deepBreathEase })
      ),
      -1,
      true
    );
    mistDriftY.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 9000, easing: deepBreathEase }),
        withTiming(0, { duration: 9000, easing: deepBreathEase })
      ),
      -1,
      true
    );

  }, []);

  // -- Styles & Props --
  const globalStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: globalScale.value }
    ],
  }));

  // PHASE 1: The massive glowing orb animation
  const orbProps = useAnimatedProps(() => {
    // Scales beautifully to create the glowing in/out effect
    const currentScale = interpolate(orbPulse.value, [0, 1], [0.85, 1.05]);
    const radius = (S * 0.42) * currentScale; 
    
    // Fades in, pulses, then completely dissolves during Phase 2 transition
    const currentOpacity = interpolate(orbPulse.value, [0, 1], [0.7, 1.0]) 
                           * orbFadeIn.value 
                           * interpolate(phaseTwoTransition.value, [0, 1], [1, 0]);
                           
    return {
      r: radius,
      opacity: currentOpacity
    };
  });

  // PHASE 2: The Sunrise Mist / Ethereal Aura 
  // It fades in as Phase 2 starts, and scales up to fill the background
  const mist1Props = useAnimatedProps(() => {
    const mistOpacity = interpolate(phaseTwoTransition.value, [0, 1], [0, 0.6]);
    const driftX = interpolate(mistDriftX.value, [0, 1], [-S * 0.1, S * 0.1]);
    const driftY = interpolate(mistDriftY.value, [0, 1], [-S * 0.1, S * 0.1]);
    const scale = interpolate(phaseTwoTransition.value, [0, 1], [0.8, 1.3]);
    
    return {
      opacity: mistOpacity,
      cx: hw + driftX,
      cy: hw + driftY,
      r: S * 0.8 * scale // Massive radius, covers whole screen
    };
  });

  const mist2Props = useAnimatedProps(() => {
    const mistOpacity = interpolate(phaseTwoTransition.value, [0, 1], [0, 0.4]);
    const driftX = interpolate(mistDriftX.value, [0, 1], [S * 0.15, -S * 0.15]);
    const driftY = interpolate(mistDriftY.value, [0, 1], [S * 0.1, -S * 0.1]);
    const scale = interpolate(phaseTwoTransition.value, [0, 1], [0.9, 1.5]);
    
    return {
      opacity: mistOpacity,
      cx: hw + driftX,
      cy: hw + driftY,
      r: S * 0.9 * scale
    };
  });

  return (
    <View style={{ position: 'absolute', width: S, height: S, opacity, justifyContent: 'center', alignItems: 'center' }} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, globalStyle]}>
        <Svg width={S} height={S}>
          <Defs>
            {/* Ultra Premium Solid Glowing Light Source (Phase 1) */}
            <RadialGradient id="orbGlow" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0%" stopColor={GOLD_1} stopOpacity="1" />
              <Stop offset="75%" stopColor={GOLD_2} stopOpacity="0.8" />
              <Stop offset="100%" stopColor={GOLD_2} stopOpacity="0" />
            </RadialGradient>
            
            {/* Soft Sunrise Mist Core (Phase 2) */}
            <RadialGradient id="mist1" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0%" stopColor={GOLD_1} stopOpacity="0.8" />
              <Stop offset="40%" stopColor={GOLD_2} stopOpacity="0.5" />
              <Stop offset="100%" stopColor={GOLD_2} stopOpacity="0" />
            </RadialGradient>

            {/* Deep Warm Ethereal Aura (Phase 2) */}
            <RadialGradient id="mist2" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0%" stopColor={GOLD_2} stopOpacity="0.7" />
              <Stop offset="50%" stopColor={GOLD_3} stopOpacity="0.4" />
              <Stop offset="100%" stopColor={GOLD_3} stopOpacity="0" />
            </RadialGradient>
          </Defs>

          {/* ----- PHASE 2: The Ethereal Sunrise Mist (Aura) ----- */}
          {/* Rendered underneath the orb so it can cleanly take over */}
          <AnimatedCircle
            fill="url(#mist2)"
            animatedProps={mist2Props}
          />
          <AnimatedCircle
            fill="url(#mist1)"
            animatedProps={mist1Props}
          />

          {/* ----- PHASE 1: The Massive Premium Glowing Orb ----- */}
          <AnimatedCircle
            cx={hw} cy={hw}
            fill="url(#orbGlow)"
            animatedProps={orbProps}
          />

        </Svg>
      </Animated.View>
    </View>
  );
}
