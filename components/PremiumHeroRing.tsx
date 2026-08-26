import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';

interface PremiumHeroRingProps {
  title?: string;
  subtitle?: string;
  timeLeft?: string;
  intentionPrompt?: string;
  intentionAction?: string;
}

export default function PremiumHeroRing({
  title = 'BODY RHYTHM',
  subtitle = 'Creative Peak Hours',
  timeLeft = '41m left',
  intentionPrompt = 'Today I will...',
  intentionAction = 'set your intention here',
}: PremiumHeroRingProps) {
  // ─── Animation Values ────────────────────────────────────────────────────────
  // We use a slow, 8-second total breathing loop (4s in, 4s out) to mimic 
  // a deep, calming human breath. This triggers parasympathetic resonance.
  const breathAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, {
          toValue: 1,
          duration: 4000,
          easing: Easing.inOut(Easing.sine),
          useNativeDriver: true,
        }),
        Animated.timing(breathAnim, {
          toValue: 0,
          duration: 4000,
          easing: Easing.inOut(Easing.sine),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [breathAnim]);

  // ─── Interpolations ──────────────────────────────────────────────────────────
  // Outer aura expands and fades slightly as it breathes
  const outerScale = breathAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06],
  });
  
  const outerOpacity = breathAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.15, 0.35],
  });

  // Inner ring has a tighter expansion to create a parallax/layered depth effect
  const innerScale = breathAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.02],
  });

  return (
    <View style={styles.container}>
      {/* ─── Layer 1: Outer Ethereal Glow (Very Light, Transparent) ────────── */}
      <Animated.View
        style={[
          styles.outerGlow,
          {
            transform: [{ scale: outerScale }],
            opacity: outerOpacity,
          },
        ]}
      />

      {/* ─── Layer 2: Inner Breathing Ring ─────────────────────────────────── */}
      <Animated.View
        style={[
          styles.innerRing,
          {
            transform: [{ scale: innerScale }],
          },
        ]}
      />

      {/* ─── Layer 3: The Frosted Glass Core ───────────────────────────────── */}
      {/* 
        Using intensity={20} to keep it very light and transparent, 
        ensuring the beautiful nature background remains highly visible. 
        The 'light' tint gives it that premium Apple/Endel frosted glass aesthetic.
      */}
      <View style={styles.glassMask}>
        <BlurView intensity={25} tint="light" style={styles.glassCore}>
          
          <View style={styles.contentContainer}>
            {/* Top Indicator */}
            <View style={styles.badgeContainer}>
              <View style={styles.badgeDot} />
              <Text style={styles.titleText}>{title}</Text>
            </View>

            {/* Main Typographic Focus (Replaces Cursive) */}
            <Text style={styles.subtitleText}>{subtitle}</Text>
            
            {/* Subtle Divider */}
            <View style={styles.divider} />

            {/* Time Left */}
            <Text style={styles.timeText}>{timeLeft}</Text>

            {/* Intention Section */}
            <View style={styles.intentionContainer}>
              <Text style={styles.intentionPrompt}>{intentionPrompt}</Text>
              <Text style={styles.intentionAction}>{intentionAction}</Text>
            </View>
          </View>

        </BlurView>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
// We use 'rgba(255, 255, 255, x)' everywhere to guarantee the ring is 
// incredibly light, airy, and beautifully overlays any background image.

const RING_SIZE = 320;

const styles = StyleSheet.create({
  container: {
    width: RING_SIZE,
    height: RING_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginVertical: 40,
  },
  outerGlow: {
    position: 'absolute',
    width: RING_SIZE + 40,
    height: RING_SIZE + 40,
    borderRadius: (RING_SIZE + 40) / 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  innerRing: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  glassMask: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    overflow: 'hidden', // Forces the BlurView to remain perfectly circular
  },
  glassCore: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)', // Barely-there white tint to aid the blur
  },
  contentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  
  // Typography — Clean, Elegant, Premium
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)', // Subtle dark pill for contrast
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 24,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#e2e8f0', // Soft white/grey
    marginRight: 8,
  },
  titleText: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2, // High tracking for premium feel
    textTransform: 'uppercase',
  },
  subtitleText: {
    color: '#ffffff',
    fontSize: 32,
    // Using a premium serif stack where available, falling back to thin sans-serif
    fontFamily: Platform.OS === 'ios' ? 'Baskerville' : 'serif',
    fontWeight: '400',
    textAlign: 'center',
    marginBottom: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  divider: {
    width: 40,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginBottom: 16,
  },
  timeText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 1,
    marginBottom: 32,
  },
  intentionContainer: {
    alignItems: 'center',
  },
  intentionPrompt: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    fontWeight: '400',
    marginBottom: 4,
  },
  intentionAction: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
