import React from 'react';
import { Animated, View, StyleSheet, Dimensions, Easing } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';

const { height: H, width: W } = Dimensions.get('window');

export const CalmingAura = ({ variant = 'default' }: { variant?: 'default' | 'yantra' }) => {
  const breathAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, { 
          toValue: 1, 
          duration: 7000, 
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true 
        }),
        Animated.timing(breathAnim, { 
          toValue: 0, 
          duration: 7000, 
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true 
        })
      ])
    ).start();
  }, []);

  const scale1 = breathAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] });
  const scale2 = breathAnim.interpolate({ inputRange: [0, 1], outputRange: [1.2, 0.8] });

  // ONLY HERO SECTION ANIMATIONS (Lighter, brighter, restricted to top)
  const isYantra = variant === 'yantra';
  const heroOp1 = breathAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: isYantra ? [0.8, 0.4, 0.8] : [0.85, 0.15, 0.85] });
  const heroOp2 = breathAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: isYantra ? [0.4, 0.7, 0.4] : [0.15, 0.85, 0.15] });

  return (
    <View style={[{ position: 'absolute', top: 0, left: 0, right: 0, height: 420, overflow: 'hidden', opacity: isYantra ? 1 : 0.85 }]} pointerEvents="none">
      
      {/* ── HERO SECTION ANIMATION (TOP - LIGHTER & CYAN/WHITE) ── */}
      <Animated.View style={{
        position: 'absolute', top: -100, left: -50,
        width: 600, height: 600, transform: [{ scale: scale1 }],
        alignItems: 'center', justifyContent: 'center'
      }}>
        <Animated.View style={{ position: 'absolute', opacity: heroOp1 }}>
          <Svg height="600" width="600">
            <Defs>
              <RadialGradient id="hero1" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={isYantra ? "#E2C376" : "#22D3EE"} stopOpacity={isYantra ? "0.35" : "0.7"} />
                <Stop offset="0.55" stopColor={isYantra ? "#C9A24B" : "#3B82F6"} stopOpacity={isYantra ? "0.2" : "0.3"} />
                <Stop offset="1" stopColor={isYantra ? "#0B0B14" : "#3B82F6"} stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="600" height="600" fill="url(#hero1)" />
          </Svg>
        </Animated.View>
        <Animated.View style={{ position: 'absolute', opacity: heroOp2 }}>
          <Svg height="600" width="600">
            <Defs>
              <RadialGradient id="hero2" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={isYantra ? "#F59E0B" : "#FFFFFF"} stopOpacity={isYantra ? "0.3" : "0.6"} />
                <Stop offset="0.55" stopColor={isYantra ? "#C1652F" : "#A78BFA"} stopOpacity={isYantra ? "0.18" : "0.3"} />
                <Stop offset="1" stopColor={isYantra ? "#000000" : "#A78BFA"} stopOpacity="0" />
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
                <Stop offset="0" stopColor={isYantra ? "#FDE68A" : "#FDE047"} stopOpacity={isYantra ? "0.3" : "0.5"} />
                <Stop offset="0.55" stopColor={isYantra ? "#E6C27A" : "#FBBF24"} stopOpacity={isYantra ? "0.15" : "0.2"} />
                <Stop offset="1" stopColor={isYantra ? "#0A0A0F" : "#F59E0B"} stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="600" height="600" fill="url(#hero3)" />
          </Svg>
        </Animated.View>
      </Animated.View>
    </View>
  );
};
