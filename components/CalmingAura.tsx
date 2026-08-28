import React from 'react';
import { Animated, View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';

const { height: H, width: W } = Dimensions.get('window');

export const CalmingAura = () => {
  const breathAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, { toValue: 1, duration: 10000, useNativeDriver: true }),
        Animated.timing(breathAnim, { toValue: 0, duration: 10000, useNativeDriver: true })
      ])
    ).start();
  }, []);

  const scale1 = breathAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] });
  const scale2 = breathAnim.interpolate({ inputRange: [0, 1], outputRange: [1.1, 0.95] });

  // Hero Section Opacities (Lighter & more vibrant)
  const heroOp1 = breathAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.8, 0.3, 0.8] });
  const heroOp2 = breathAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.3, 0.8, 0.3] });

  // Non-Hero Section Opacities (Much Darker and subtler)
  const baseOp1 = breathAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.15, 0.4, 0.15] });
  const baseOp2 = breathAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.3, 0.1, 0.3] });

  return (
    <View style={[StyleSheet.absoluteFillObject, { opacity: 0.7 }]} pointerEvents="none">
      
      {/* ── HERO SECTION ANIMATION (TOP - LIGHTER) ── */}
      <Animated.View style={{
        position: 'absolute', top: -100, left: -100,
        width: 600, height: 600, transform: [{ scale: scale1 }],
        alignItems: 'center', justifyContent: 'center'
      }}>
        <Animated.View style={{ position: 'absolute', opacity: heroOp1 }}>
          <Svg height="600" width="600">
            <Defs>
              <RadialGradient id="hero1" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor="#6366F1" stopOpacity="0.8" />
                <Stop offset="1" stopColor="#312E81" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="600" height="600" fill="url(#hero1)" />
          </Svg>
        </Animated.View>
        <Animated.View style={{ position: 'absolute', opacity: heroOp2 }}>
          <Svg height="600" width="600">
            <Defs>
              <RadialGradient id="hero2" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor="#A855F7" stopOpacity="0.7" />
                <Stop offset="1" stopColor="#4C1D95" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="600" height="600" fill="url(#hero2)" />
          </Svg>
        </Animated.View>
      </Animated.View>

      <Animated.View style={{
        position: 'absolute', top: 50, right: -150,
        width: 600, height: 600, transform: [{ scale: scale2 }],
        alignItems: 'center', justifyContent: 'center'
      }}>
        <Animated.View style={{ position: 'absolute', opacity: heroOp1 }}>
          <Svg height="600" width="600">
            <Defs>
              <RadialGradient id="hero3" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor="#F59E0B" stopOpacity="0.4" />
                <Stop offset="1" stopColor="#78350F" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="600" height="600" fill="url(#hero3)" />
          </Svg>
        </Animated.View>
      </Animated.View>


      {/* ── NON-HERO SECTION ANIMATION (BOTTOM - DARKER) ── */}
      <Animated.View style={{
        position: 'absolute', top: H * 0.45, left: -250,
        width: 900, height: 900, transform: [{ scale: scale1 }],
        alignItems: 'center', justifyContent: 'center'
      }}>
        <Animated.View style={{ position: 'absolute', opacity: baseOp1 }}>
          <Svg height="900" width="900">
            <Defs>
              <RadialGradient id="base1" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor="#064E3B" stopOpacity="0.7" />
                <Stop offset="1" stopColor="#022C22" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="900" height="900" fill="url(#base1)" />
          </Svg>
        </Animated.View>
        <Animated.View style={{ position: 'absolute', opacity: baseOp2 }}>
          <Svg height="900" width="900">
            <Defs>
              <RadialGradient id="base2" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor="#0F172A" stopOpacity="0.8" />
                <Stop offset="1" stopColor="#020617" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="900" height="900" fill="url(#base2)" />
          </Svg>
        </Animated.View>
      </Animated.View>

    </View>
  );
};
