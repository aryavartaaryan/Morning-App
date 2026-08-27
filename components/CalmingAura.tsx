import React from 'react';
import { Animated, View, StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';

export const CalmingAura = () => {
  const breathAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, { toValue: 1, duration: 8000, useNativeDriver: true }),
        Animated.timing(breathAnim, { toValue: 0, duration: 8000, useNativeDriver: true })
      ])
    ).start();
  }, []);

  const scale1 = breathAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] });
  const scale2 = breathAnim.interpolate({ inputRange: [0, 1], outputRange: [1.2, 0.95] });

  const purpleOp = breathAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.6, 0.1, 0.6] });
  const blueOp = breathAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.1, 0.5, 0.1] });
  const tealOp = breathAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.2, 0.5, 0.2] });

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      
      {/* Orb 1: Top Left (Purple -> Blue) */}
      <Animated.View style={{
        position: 'absolute', top: -100, left: -100,
        width: 600, height: 600,
        transform: [{ scale: scale1 }],
        alignItems: 'center', justifyContent: 'center'
      }}>
        <Animated.View style={{ position: 'absolute', opacity: purpleOp }}>
          <Svg height="600" width="600">
            <Defs>
              <RadialGradient id="purp" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor="#C084FC" stopOpacity="0.6" />
                <Stop offset="1" stopColor="#7E22CE" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="600" height="600" fill="url(#purp)" />
          </Svg>
        </Animated.View>
        <Animated.View style={{ position: 'absolute', opacity: blueOp }}>
          <Svg height="600" width="600">
            <Defs>
              <RadialGradient id="blue" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor="#60A5FA" stopOpacity="0.6" />
                <Stop offset="1" stopColor="#2563EB" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="600" height="600" fill="url(#blue)" />
          </Svg>
        </Animated.View>
      </Animated.View>

      {/* Orb 2: Middle Right (Teal -> Purple) */}
      <Animated.View style={{
        position: 'absolute', top: 200, right: -150,
        width: 700, height: 700,
        transform: [{ scale: scale2 }],
        alignItems: 'center', justifyContent: 'center'
      }}>
        <Animated.View style={{ position: 'absolute', opacity: tealOp }}>
          <Svg height="700" width="700">
            <Defs>
              <RadialGradient id="teal" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor="#2DD4BF" stopOpacity="0.5" />
                <Stop offset="1" stopColor="#0F766E" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="700" height="700" fill="url(#teal)" />
          </Svg>
        </Animated.View>
        <Animated.View style={{ position: 'absolute', opacity: purpleOp }}>
          <Svg height="700" width="700">
            <Defs>
              <RadialGradient id="purp2" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor="#A78BFA" stopOpacity="0.4" />
                <Stop offset="1" stopColor="#6D28D9" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="700" height="700" fill="url(#purp2)" />
          </Svg>
        </Animated.View>
      </Animated.View>

      {/* Orb 3: Bottom Left (Blue -> Teal) */}
      <Animated.View style={{
        position: 'absolute', bottom: -100, left: -200,
        width: 800, height: 800,
        transform: [{ scale: scale1 }],
        alignItems: 'center', justifyContent: 'center'
      }}>
        <Animated.View style={{ position: 'absolute', opacity: blueOp }}>
          <Svg height="800" width="800">
            <Defs>
              <RadialGradient id="blue3" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor="#3B82F6" stopOpacity="0.3" />
                <Stop offset="1" stopColor="#1D4ED8" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="800" height="800" fill="url(#blue3)" />
          </Svg>
        </Animated.View>
        <Animated.View style={{ position: 'absolute', opacity: tealOp }}>
          <Svg height="800" width="800">
            <Defs>
              <RadialGradient id="teal3" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor="#14B8A6" stopOpacity="0.3" />
                <Stop offset="1" stopColor="#0F766E" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="800" height="800" fill="url(#teal3)" />
          </Svg>
        </Animated.View>
      </Animated.View>

    </View>
  );
};
