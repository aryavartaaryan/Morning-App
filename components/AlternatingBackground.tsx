import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, Dimensions, Easing } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { CalmingAura } from './CalmingAura';

const { height: H, width: W } = Dimensions.get('window');

interface Props {
  imageUri: string;
}

export const AlternatingBackground = ({ imageUri }: Props) => {
  const breathAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, { 
          toValue: 1, 
          duration: 12000, 
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true 
        }),
        Animated.timing(breathAnim, { 
          toValue: 0, 
          duration: 12000, 
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true 
        })
      ])
    ).start();
  }, []);

  // When breathAnim = 0, translateY = 0. Mask top is transparent, bottom is black. (Hero visible, collections dark)
  // When breathAnim = 1, translateY = -H. Mask top is black, bottom is transparent. (Hero dark, collections visible)
  const translateY = breathAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -H] });

  return (
    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#030308' }]} pointerEvents="none">
      
      {/* 1. Full-screen Image */}
      <Image
        source={{ uri: imageUri }}
        style={[StyleSheet.absoluteFillObject, { opacity: 1.0 }]}
        contentFit="cover"
        blurRadius={3}
      />
      
      {/* 2. Full-screen CalmingAura */}
      <CalmingAura fullScreen={true} />

      {/* 3. The Alternating Mask Layer */}
      <Animated.View style={[{ position: 'absolute', top: 0, left: 0, width: W, height: H * 2, transform: [{ translateY }] }]}>
        <LinearGradient
          // Mask logic:
          // [0, 0.2]     : Transparent (Hero is lit)
          // [0.45, 0.55] : Solid Black (Divider / Dead space)
          // [0.8, 1]     : Transparent (Bottom is lit)
          colors={[
            'transparent', 
            'rgba(3,3,8,0.5)', 
            '#030308', 
            '#030308', 
            '#030308', 
            'rgba(3,3,8,0.5)', 
            'transparent'
          ]}
          locations={[0, 0.25, 0.45, 0.5, 0.55, 0.75, 1]}
          style={{ flex: 1 }}
        />
      </Animated.View>
      
    </View>
  );
};
