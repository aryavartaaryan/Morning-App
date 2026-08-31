import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Animated, Easing, TouchableOpacity, Dimensions, Platform, ScrollView, Image
} from 'react-native';
import Svg, { Circle, Rect, Path, G, Defs, RadialGradient, LinearGradient as SvgLinearGradient, Stop, Line, Text as SvgText } from 'react-native-svg';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Gyroscope } from 'expo-sensors';

const { width: W, height: H } = Dimensions.get('window');
import { CalmingAura } from "@/components/CalmingAura";

import * as Location from 'expo-location';

// ── Design Tokens ──
const COLORS = {
  bg: '#0B0B14',
  gold: '#C9A24B',
  goldMuted: 'rgba(201,162,75,0.4)',
  goldFaint: 'rgba(201,162,75,0.15)',
  saffron: '#C1652F',
  ivory: '#EDE6D6',
  surface: 'rgba(255,255,255,0.04)',
};

const FONTS = {
  serif: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  sans: Platform.OS === 'ios' ? 'System' : 'sans-serif',
};

// ── Spatial Zone Data ──
type ZoneId = 'meditate' | 'deepwork' | 'wfh' | 'eat' | 'sleep' | 'gym' | 'media' | 'creator' | 'nook' | 'pet' | 'build_kitchen' | 'build_toilet' | 'build_bedroom' | 'build_entrance';

const ZONES: Record<ZoneId, {
  id: ZoneId;
  title: string;
  tip: string;
  why: string;
  zones: { direction: string; sanskrit: string; angle: number }[];
}> = {
  meditate: {
    id: 'meditate',
    title: 'Meditation & Mindfulness',
    tip: 'Face Northeast or East during meditation for maximum nervous system coherence.',
    why: 'These channels carry the most spiritually potent, clear energy, perfect for inner stillness.',
    zones: [
      { direction: 'Northeast', sanskrit: 'Ishaan', angle: 45 },
      { direction: 'East', sanskrit: 'Purva', angle: 90 },
      { direction: 'North', sanskrit: 'Uttar', angle: 0 },
    ]
  },
  deepwork: {
    id: 'deepwork',
    title: 'Deep Work & Focus',
    tip: 'Your Northeast or East corner carries the clearest energy — ideal for focused, deep work.',
    why: 'Considered the most spiritually potent axis; associated with clarity, wisdom, and calm energy.',
    zones: [
      { direction: 'Northeast', sanskrit: 'Ishaan', angle: 45 },
      { direction: 'East', sanskrit: 'Purva', angle: 90 },
      { direction: 'North', sanskrit: 'Uttar', angle: 0 },
    ]
  },
  wfh: {
    id: 'wfh',
    title: 'Career & WFH',
    tip: 'Face North or East while working to align with the direction of growth and wealth.',
    why: 'Direction of wealth and career growth (governed by Kubera).',
    zones: [
      { direction: 'North', sanskrit: 'Uttar', angle: 0 },
      { direction: 'East', sanskrit: 'Purva', angle: 90 },
    ]
  },
  eat: {
    id: 'eat',
    title: 'Eating & Dining',
    tip: 'Dining in the West or East supports stability and physical gains.',
    why: 'Supports gains and stability, perfect for the dining area.',
    zones: [
      { direction: 'West', sanskrit: 'Paschim', angle: 270 },
      { direction: 'East', sanskrit: 'Purva', angle: 90 },
      { direction: 'North', sanskrit: 'Uttar', angle: 0 },
    ]
  },
  sleep: {
    id: 'sleep',
    title: 'Sleeping & Relaxing',
    tip: 'Place your bed in the Southwest or South for deep, grounded rest.',
    why: 'Heaviest, most stable direction — ideal for the master bedroom and deep rest.',
    zones: [
      { direction: 'Southwest', sanskrit: 'Nairutya', angle: 225 },
      { direction: 'South', sanskrit: 'Dakshin', angle: 180 },
      { direction: 'East', sanskrit: 'Purva', angle: 90 },
    ]
  },
  gym: {
    id: 'gym',
    title: 'Home Gym & Yoga',
    tip: 'Face East for Yoga; keep heavy equipment in the South or Southwest.',
    why: 'South and West hold earth and fire energy, ideal for physical strength and endurance.',
    zones: [
      { direction: 'South', sanskrit: 'Dakshin', angle: 180 },
      { direction: 'West', sanskrit: 'Paschim', angle: 270 },
      { direction: 'Southwest', sanskrit: 'Nairutya', angle: 225 },
    ]
  },
  media: {
    id: 'media',
    title: 'Media & Entertainment',
    tip: 'Set up your entertainment and socializing areas in the Northwest or East.',
    why: 'Northwest is governed by the wind element, perfect for movement, socializing, and relaxation.',
    zones: [
      { direction: 'Northwest', sanskrit: 'Vayavya', angle: 315 },
      { direction: 'East', sanskrit: 'Purva', angle: 90 },
    ]
  },
  creator: {
    id: 'creator',
    title: 'Content & Podcasting',
    tip: 'Face North or East while streaming or recording content.',
    why: 'North is governed by Mercury, the planet of communication, networking, and digital growth.',
    zones: [
      { direction: 'North', sanskrit: 'Uttar', angle: 0 },
      { direction: 'East', sanskrit: 'Purva', angle: 90 },
    ]
  },
  nook: {
    id: 'nook',
    title: 'Coffee & Journaling Nook',
    tip: 'Create your morning corner in the East or Northeast.',
    why: 'Absorbs the morning sun\'s vital prana and sets a tone of mental clarity for the day.',
    zones: [
      { direction: 'East', sanskrit: 'Purva', angle: 90 },
      { direction: 'Northeast', sanskrit: 'Ishaan', angle: 45 },
    ]
  },
  pet: {
    id: 'pet',
    title: 'Pet Space',
    tip: 'Place dog beds or pet spaces in the Northwest or East.',
    why: 'These zones carry active, happy energy that keeps pets energetic and joyful.',
    zones: [
      { direction: 'Northwest', sanskrit: 'Vayavya', angle: 315 },
      { direction: 'East', sanskrit: 'Purva', angle: 90 },
    ]
  },
  build_kitchen: {
    id: 'build_kitchen',
    title: 'Build: Kitchen Space',
    tip: 'Plan your kitchen in the Southeast (Agneya) corner of the house.',
    why: 'Governed by the fire element (Agni), the Southeast ensures health and proper digestion.',
    zones: [
      { direction: 'Southeast', sanskrit: 'Agneya', angle: 135 },
      { direction: 'Northwest', sanskrit: 'Vayavya', angle: 315 },
    ]
  },
  build_toilet: {
    id: 'build_toilet',
    title: 'Build: Toilet Space',
    tip: 'Position toilets in the West-Northwest or South-Southwest, avoiding corners.',
    why: 'These zones handle waste effectively without draining the positive energy of the home.',
    zones: [
      { direction: 'Northwest', sanskrit: 'Vayavya', angle: 315 },
      { direction: 'West', sanskrit: 'Paschim', angle: 270 },
    ]
  },
  build_bedroom: {
    id: 'build_bedroom',
    title: 'Build: Master Bedroom',
    tip: 'Plan the master bedroom in the Southwest corner for the head of the family.',
    why: 'The Southwest is the heaviest, most stable zone, bringing groundedness and authority.',
    zones: [
      { direction: 'Southwest', sanskrit: 'Nairutya', angle: 225 },
    ]
  },
  build_entrance: {
    id: 'build_entrance',
    title: 'Build: Main Entrance',
    tip: 'Ensure the main entrance faces North, Northeast, or East.',
    why: 'These directions welcome positive solar energy, prosperity, and spiritual growth.',
    zones: [
      { direction: 'North', sanskrit: 'Uttar', angle: 0 },
      { direction: 'Northeast', sanskrit: 'Ishaan', angle: 45 },
      { direction: 'East', sanskrit: 'Purva', angle: 90 },
    ]
  }
};

const SECONDARY_ZONES = [
  { direction: 'E', sanskrit: 'Purva', angle: 90 },
  { direction: 'SE', sanskrit: 'Agneya', angle: 135 },
  { direction: 'S', sanskrit: 'Dakshin', angle: 180 },
  { direction: 'NW', sanskrit: 'Vayavya', angle: 315 },
];

// ── Sacred Geometry Yantra Component ──
const HarmonyCompassSVG = ({ size, activeZoneData, pulseAnim, compassRotAnim, compassInnerRotAnim, breathingScaleAnim, gyroX, gyroY }: any) => {
  const r = size / 2;
  const center = r;

  // 24-point intricate star
  const generateIntricateStar = (outerR: number, innerR: number, points: number = 24) => {
    let d = '';
    const angleStep = (Math.PI * 2) / points;
    for (let i = 0; i < points; i++) {
      const angle = i * angleStep - Math.PI / 2;
      const midAngle = (i + 0.5) * angleStep - Math.PI / 2;
      const nextAngle = (i + 1) * angleStep - Math.PI / 2;

      const x1 = center + innerR * Math.cos(angle);
      const y1 = center + innerR * Math.sin(angle);
      const x2 = center + outerR * Math.cos(midAngle);
      const y2 = center + outerR * Math.sin(midAngle);
      const x3 = center + innerR * Math.cos(nextAngle);
      const y3 = center + innerR * Math.sin(nextAngle);

      if (i === 0) d += `M ${x1} ${y1} `;
      d += `L ${x2} ${y2} L ${x3} ${y3} `;
    }
    return d + 'Z';
  };

  // Mandala Lotus Petals
  const generatePetals = (outerR: number, innerR: number, count: number = 8) => {
    let d = '';
    const angleStep = (Math.PI * 2) / count;
    for (let i = 0; i < count; i++) {
      const angle = i * angleStep;
      const nextAngle = (i + 1) * angleStep;
      const midAngle = angle + angleStep / 2;

      const x1 = center + innerR * Math.cos(angle);
      const y1 = center + innerR * Math.sin(angle);
      const x2 = center + outerR * Math.cos(midAngle);
      const y2 = center + outerR * Math.sin(midAngle);
      const x3 = center + innerR * Math.cos(nextAngle);
      const y3 = center + innerR * Math.sin(nextAngle);

      // Quadratic bezier for elegant petal curves
      const cp1x = center + outerR * 0.9 * Math.cos(angle + angleStep * 0.15);
      const cp1y = center + outerR * 0.9 * Math.sin(angle + angleStep * 0.15);
      const cp2x = center + outerR * 0.9 * Math.cos(angle + angleStep * 0.85);
      const cp2y = center + outerR * 0.9 * Math.sin(angle + angleStep * 0.85);

      if (i === 0) d += `M ${x1} ${y1} `;
      d += `Q ${cp1x} ${cp1y} ${x2} ${y2} Q ${cp2x} ${cp2y} ${x3} ${y3} `;
    }
    return d;
  };

  const AnimatedSvgCircle = Animated.createAnimatedComponent(Circle);
  const rotInterpolate = compassRotAnim.interpolate({ inputRange: [-36000, 36000], outputRange: ['-36000deg', '36000deg'] });
  // Make the inner ring rotate in the opposite direction for a cool mechanical effect
  const innerRotInterpolate = compassRotAnim.interpolate({ inputRange: [-36000, 36000], outputRange: ['18000deg', '-18000deg'] });

  const GOLD_PRIMARY = "#E6C27A";
  const GOLD_SECONDARY = "#C9A24B";
  const GLASS_BG = "rgba(255,255,255,0.02)";

  // 3D Parallax interpolation
  const rotX = gyroY ? gyroY.interpolate({ inputRange: [-15, 15], outputRange: ['-25deg', '25deg'], extrapolate: 'clamp' }) : '0deg';
  const rotY = gyroX ? gyroX.interpolate({ inputRange: [-15, 15], outputRange: [-25, 25] }).interpolate({ inputRange: [-25, 25], outputRange: ['-25deg', '25deg'], extrapolate: 'clamp' }) : '0deg';

  return (
    <Animated.View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', transform: [{ perspective: 1200 }, { rotateX: rotX }, { rotateY: rotY }] }}>
      
      {/* ── Background Aura (Breathing Animation Only Here) ── */}
      <Animated.View style={{ position: 'absolute', width: size, height: size, alignItems: 'center', justifyContent: 'center', transform: [{ scale: breathingScaleAnim }] }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Defs>
            <RadialGradient id="premiumAura" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={GOLD_SECONDARY} stopOpacity="0.25" />
              <Stop offset="50%" stopColor={GOLD_SECONDARY} stopOpacity="0.08" />
              <Stop offset="100%" stopColor={GOLD_SECONDARY} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <AnimatedSvgCircle cx={center} cy={center} r={r * 1.1} fill="url(#premiumAura)" opacity={pulseAnim as any} />
        </Svg>
      </Animated.View>

      {/* ── Outer Bezel (Rotates based on compass heading) ── */}
      <Animated.View style={{ position: 'absolute', width: size, height: size, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: rotInterpolate }] }}>
        <View style={{
          width: size * 0.98, height: size * 0.98, borderRadius: size / 2,
          borderWidth: 1, borderColor: "rgba(230,194,122,0.25)",
          shadowColor: "#000", shadowOffset: { width: 0, height: 15 }, shadowOpacity: 0.7, shadowRadius: 30,
          backgroundColor: COLORS.bg, elevation: 15
        }}>
          {/* Glass tint on top of solid background */}
          <View style={{ ...StyleSheet.absoluteFillObject, borderRadius: size / 2, backgroundColor: GLASS_BG, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }} />
        </View>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute' }}>
          <Defs>
            <SvgLinearGradient id="bezelGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={GOLD_PRIMARY} stopOpacity="0.9" />
              <Stop offset="25%" stopColor={GOLD_SECONDARY} stopOpacity="0.4" />
              <Stop offset="50%" stopColor={GOLD_PRIMARY} stopOpacity="0.7" />
              <Stop offset="75%" stopColor={GOLD_SECONDARY} stopOpacity="0.4" />
              <Stop offset="100%" stopColor={GOLD_PRIMARY} stopOpacity="0.9" />
            </SvgLinearGradient>
            
            <SvgLinearGradient id="innerBezel" x1="100%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#FFF" stopOpacity="0.3" />
              <Stop offset="50%" stopColor="#FFF" stopOpacity="0.05" />
              <Stop offset="100%" stopColor={GOLD_SECONDARY} stopOpacity="0.4" />
            </SvgLinearGradient>

            <RadialGradient id="glowShadow" cx="50%" cy="50%" r="50%">
              <Stop offset="80%" stopColor="#000" stopOpacity="0" />
              <Stop offset="100%" stopColor="#000" stopOpacity="0.5" />
            </RadialGradient>
          </Defs>

          {/* Thick Outer Ring */}
          <Circle cx={center} cy={center} r={r * 0.9} fill="none" stroke="url(#bezelGradient)" strokeWidth={3} />
          {/* Inner Bezel Accent */}
          <Circle cx={center} cy={center} r={r * 0.88} fill="none" stroke="url(#innerBezel)" strokeWidth={1.5} opacity={0.7} />
          {/* Shadow Ring for Depth */}
          <Circle cx={center} cy={center} r={r * 0.86} fill="none" stroke="url(#glowShadow)" strokeWidth={4} />
          {/* Fine Tick Marks */}
          <Circle cx={center} cy={center} r={r * 0.83} fill="none" stroke={GOLD_SECONDARY} strokeWidth={1} strokeDasharray="1, 4" opacity={0.6} />
          
          {/* 64-Point Micro Ticks */}
          <Circle cx={center} cy={center} r={r * 0.78} fill="none" stroke={GOLD_PRIMARY} strokeWidth={0.5} strokeDasharray="2, 6" opacity={0.3} />

          {/* 8-Point Compass Marks */}
          {[...Array(8)].map((_, i) => {
            const angle = (i * 45) * (Math.PI / 180);
            const x1 = center + (r * 0.9) * Math.cos(angle);
            const y1 = center + (r * 0.9) * Math.sin(angle);
            const x2 = center + (r * 0.79) * Math.cos(angle);
            const y2 = center + (r * 0.79) * Math.sin(angle);
            const isCardinal = i % 2 === 0;
            return (
              <Line key={`tick_${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={isCardinal ? GOLD_PRIMARY : GOLD_SECONDARY} strokeWidth={isCardinal ? 2.5 : 1} opacity={isCardinal ? 1 : 0.6} />
            );
          })}
        </Svg>
        
        {/* Direction Labels */}
        {['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'].map((dir, i) => {
          const rad = (i * 45 - 90) * (Math.PI / 180);
          const radius = r * 0.69;
          const x = radius * Math.cos(rad);
          const y = radius * Math.sin(rad);
          const isCardinal = i % 2 === 0;
          return (
            <View key={i} style={{ position: 'absolute', transform: [{ translateX: x }, { translateY: y }] }}>
              <Text style={{
                color: isCardinal ? '#FFF' : GOLD_PRIMARY,
                fontSize: isCardinal ? 15 : 11,
                fontWeight: isCardinal ? '900' : '700',
                fontFamily: FONTS.serif,
                letterSpacing: 1.5,
                opacity: isCardinal ? 1 : 0.8,
                textShadowColor: 'rgba(230,194,122,0.4)',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 6
              }}>{dir}</Text>
            </View>
          );
        })}
      </Animated.View>

      {/* ── Middle Intricate Yantra Layer (Counter-Rotation, No scale breathing) ── */}
      <Animated.View style={{ position: 'absolute', width: size, height: size, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: innerRotInterpolate }] }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Defs>
            <SvgLinearGradient id="yantraGold" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={GOLD_PRIMARY} stopOpacity="0.5" />
              <Stop offset="50%" stopColor={GOLD_SECONDARY} stopOpacity="0.2" />
              <Stop offset="100%" stopColor={GOLD_PRIMARY} stopOpacity="0.4" />
            </SvgLinearGradient>
            <SvgLinearGradient id="yantraGlow" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor={GOLD_PRIMARY} stopOpacity="0.8" />
              <Stop offset="100%" stopColor={GOLD_SECONDARY} stopOpacity="0.3" />
            </SvgLinearGradient>
            <SvgLinearGradient id="petalGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={GOLD_PRIMARY} stopOpacity="0.15" />
              <Stop offset="100%" stopColor={GOLD_SECONDARY} stopOpacity="0.05" />
            </SvgLinearGradient>
          </Defs>

          {/* 16-petal Outer Lotus (Vastu Mandala Motif) */}
          <Path d={generatePetals(r * 0.6, r * 0.45, 16)} fill="url(#petalGradient)" stroke="url(#yantraGlow)" strokeWidth={1} />
          {/* 8-petal Inner Lotus */}
          <Path d={generatePetals(r * 0.5, r * 0.35, 8)} fill="url(#petalGradient)" stroke={GOLD_PRIMARY} strokeWidth={1.5} opacity={0.9} />
          
          {/* 24-point Sri-Yantra Inspired Star */}
          <Path d={generateIntricateStar(r * 0.45, r * 0.38, 24)} fill="url(#yantraGold)" stroke="url(#yantraGlow)" strokeWidth={1.2} />
          <Path d={generateIntricateStar(r * 0.40, r * 0.32, 12)} fill="none" stroke="#FFF" strokeWidth={0.8} opacity={0.4} />
          
          {/* Concentric Inner Blueprint Circles */}
          <Circle cx={center} cy={center} r={r * 0.32} fill="none" stroke={GOLD_SECONDARY} strokeWidth={1.5} opacity={0.6} />
          <Circle cx={center} cy={center} r={r * 0.29} fill="none" stroke={GOLD_PRIMARY} strokeWidth={0.5} strokeDasharray="3, 3" opacity={0.8} />
          <Circle cx={center} cy={center} r={r * 0.26} fill="none" stroke={GOLD_SECONDARY} strokeWidth={1} opacity={0.4} />
        </Svg>
      </Animated.View>

      {/* ── Inner Brahmasthan & Core (No scale breathing) ── */}
      <Animated.View style={{ position: 'absolute', width: size, height: size, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: innerRotInterpolate }] }}>
        <View style={{
          width: r * 0.5, height: r * 0.5,
          backgroundColor: "rgba(10,10,15,0.9)",
          borderRadius: r * 0.25,
          borderWidth: 1.5, borderColor: "rgba(230,194,122,0.4)",
          alignItems: 'center', justifyContent: 'center',
          shadowColor: GOLD_PRIMARY, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 15,
        }}>
          <Svg width={r * 0.5} height={r * 0.5} viewBox={`0 0 ${r * 0.5} ${r * 0.5}`} style={{ position: 'absolute' }}>
             {/* Intersecting Squares for Vastu Purusha Mandala */}
             <Rect
                x={r * 0.125} y={r * 0.125} width={r * 0.25} height={r * 0.25}
                fill="none" stroke={GOLD_PRIMARY} strokeWidth={1.2} opacity={0.8}
             />
             <Rect
                x={r * 0.125} y={r * 0.125} width={r * 0.25} height={r * 0.25}
                fill="none" stroke={GOLD_PRIMARY} strokeWidth={1.2} opacity={0.8}
                transform={`rotate(45 ${r * 0.25} ${r * 0.25})`}
             />
             {/* Complex Center Jewel (Bindu) */}
             <Circle cx={r * 0.25} cy={r * 0.25} r={8} fill="url(#yantraGlow)" />
             <Circle cx={r * 0.25} cy={r * 0.25} r={4} fill="#FFF" />
             <Circle cx={r * 0.25} cy={r * 0.25} r={14} fill="none" stroke={GOLD_PRIMARY} strokeWidth={0.8} opacity={0.6} strokeDasharray="2, 2" />
          </Svg>
        </View>
      </Animated.View>


      {/* ── Active Highlight Overlay (Dynamic Vastu Energy Flow) ── */}
      {activeZoneData !== null && (
        <Animated.View style={{ position: 'absolute', width: size, height: size, transform: [{ rotate: rotInterpolate }, { scale: breathingScaleAnim }] }}>
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {activeZoneData.zones.map((zone: any, index: number) => {
              const angle = zone.angle;
              return (
                <G key={index} transform={`rotate(${angle - 90} ${center} ${center})`}>
                  <Defs>
                    <SvgLinearGradient id={`beamGlow-${index}`} x1="0%" y1="0%" x2="100%" y2="0%">
                      <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
                      <Stop offset="50%" stopColor={COLORS.saffron} stopOpacity="0.8" />
                      <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                    </SvgLinearGradient>
                  </Defs>
                  
                  {/* Energy Beam */}
                  <Path
                    d={`M ${center} ${center} L ${center + r * 0.95 * 0.92388} ${center - r * 0.95 * 0.38268} A ${r * 0.95} ${r * 0.95} 0 0 1 ${center + r * 0.95 * 0.92388} ${center + r * 0.95 * 0.38268} Z`}
                    fill={`url(#beamGlow-${index})`}
                    opacity={0.4}
                  />
                  
                  {/* Sharp Vector Line */}
                  <Line x1={center + r * 0.2} y1={center} x2={center + r * 0.92} y2={center} stroke={COLORS.saffron} strokeWidth={2.5} strokeLinecap="round" />
                  
                  {/* Glowing Node */}
                  <Circle cx={center + r * 0.92} cy={center} r={4} fill="#FFF" />
                  <Circle cx={center + r * 0.92} cy={center} r={8} fill="none" stroke={COLORS.saffron} strokeWidth={2} opacity={0.9} />
                  
                  {(() => {
                    const shouldFlip = angle > 180 && angle < 360;
                    const textY = shouldFlip ? center + 10 : center - 10;
                    return (
                      <SvgText
                        x={center + r * 0.75}
                        y={textY}
                        fill="#FFF"
                        fontSize={10}
                        fontFamily={FONTS.sans}
                        fontWeight="800"
                        textAnchor="middle"
                        transform={`rotate(${shouldFlip ? 180 : 0} ${center + r * 0.75} ${textY})`}
                      >
                        {`${zone.direction.toUpperCase()} • ${zone.sanskrit}`}
                      </SvgText>
                    );
                  })()}
                </G>
              );
            })}
          </Svg>
        </Animated.View>
      )}
    </Animated.View>
  );
}




// ── Main Screen Component ──
export default function HarmonyCompassScreen() {
  const insets = useSafeAreaInsets();
  const [selectedZone, setSelectedZone] = useState<ZoneId | null>(null);
  const [heading, setHeading] = useState(0); // For live compass
  const [isCompassActive, setIsCompassActive] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Animations
  const pulseAnim = useRef(new Animated.Value(0.1)).current;
  const compassRotAnim = useRef(new Animated.Value(0)).current;
  const compassInnerRotAnim = useRef(new Animated.Value(0)).current;
  const breathingScaleAnim = useRef(new Animated.Value(1)).current;
  const lastHapticZone = useRef(-1);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Reset state when screen loses focus
  useFocusEffect(
    useCallback(() => {
      return () => {
        setIsCompassActive(false);
        setSelectedZone(null);
        setDropdownOpen(false);
      };
    }, [])
  );


  // Stardust Parallax
  const gyroX = useRef(new Animated.Value(0)).current;
  const gyroY = useRef(new Animated.Value(0)).current;

  // Gyroscope Setup
  useEffect(() => {
    Gyroscope.setUpdateInterval(50);
    const subscription = Gyroscope.addListener((data) => {
      Animated.spring(gyroX, { toValue: -data.y * 15, friction: 7, tension: 40, useNativeDriver: true }).start();
      Animated.spring(gyroY, { toValue: -data.x * 15, friction: 7, tension: 40, useNativeDriver: true }).start();
    });
    return () => {
      subscription.remove();
    };
  }, []);

  // 4-7-8 Breathing Rhythm (Inhale 4s, Hold 7s, Exhale 8s)
  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 4000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 7000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0.1, duration: 8000, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
        ]),
        Animated.sequence([
          Animated.timing(breathingScaleAnim, { toValue: 1.05, duration: 4000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(breathingScaleAnim, { toValue: 1.05, duration: 7000, useNativeDriver: true }),
          Animated.timing(breathingScaleAnim, { toValue: 1, duration: 8000, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
        ])
      ])
    ).start();
  }, []);

  // Compass smoothing with parallax lag and Haptic Ticking
  useEffect(() => {
    if (!isCompassActive) return;

    // Fire Haptic Tick on 16 cardinal/sub-cardinal divisions (every 22.5 degrees)
    const currentZone = Math.round(heading / 22.5);
    if (currentZone !== lastHapticZone.current) {
      if (lastHapticZone.current !== -1) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      lastHapticZone.current = currentZone;
    }

    let target = -heading;
    let prev = compassRotAnim as any;
    let currentVal = prev._value || 0;
    
    // Normalize target to be closest to current value to prevent full-circle spinning
    while (target - currentVal > 180) target -= 360;
    while (target - currentVal < -180) target += 360;

    // Instant/smooth rotation for Outer Layer
    Animated.spring(compassRotAnim, {
      toValue: target,
      friction: 12,
      tension: 40,
      useNativeDriver: true,
    }).start();

    // Slower, delayed rotation for Inner Layer (Parallax Physics)
    Animated.spring(compassInnerRotAnim, {
      toValue: target,
      friction: 18,
      tension: 10,
      useNativeDriver: true,
    }).start();
  }, [heading, isCompassActive]);

  // Fluid Info Card Entry Animation
  useEffect(() => {
    if (selectedZone) {
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic)
      }).start();
    }
  }, [selectedZone]);

  // Live Compass (Phase 2 feature) - Using OS Sensor Fusion for True Heading
  useEffect(() => {
    let sub: any;
    if (isCompassActive) {
      (async () => {
        // Request permissions first
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.warn('Location permission to use the true compass was denied');
          return;
        }

        // Use watchHeadingAsync for OS-calibrated sensor fusion (True North)
        sub = await Location.watchHeadingAsync((data) => {
          let h = data.trueHeading !== -1 ? data.trueHeading : data.magHeading;
          if (h >= 0) {
            setHeading(Math.round(h));
          }
        });
      })();
    }
    return () => {
      if (sub && sub.remove) sub.remove();
    };
  }, [isCompassActive]);

  const handleZoneSelect = (zoneId: ZoneId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedZone(zoneId);
    setDropdownOpen(false);
    setIsCompassActive(true);
  };

  const clearSelection = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedZone(null);
  };

  const activeZoneData = selectedZone ? ZONES[selectedZone] : null;

  return (
    <View style={styles.container}>
      {/* ── Entire Top Zone Calming Animation ── */}
      <CalmingAura />

      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: Math.max(insets.bottom, 40) }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 40) }]}>
          <Text style={styles.headerTitle}>Harmony Compass</Text>
          <Text style={styles.headerSubtitle}>Sacred Space Intelligence</Text>
        </View>

        {/* Dropdown Menu */}
        <View style={{ zIndex: 10, marginHorizontal: 32, marginBottom: 20 }}>
          <TouchableOpacity 
            activeOpacity={0.8}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setDropdownOpen(!dropdownOpen);
            }}
          >
            <LinearGradient 
              colors={['#101018', '#0B0B14']} 
              style={[styles.dropdownButton, dropdownOpen && styles.dropdownButtonActive]}
            >
              <Text style={styles.dropdownButtonText}>
                {activeZoneData ? activeZoneData.title.toUpperCase() : 'SELECT SPATIAL PROTOCOL'}
              </Text>
              <Ionicons name={dropdownOpen ? "chevron-up" : "chevron-down"} size={16} color={COLORS.saffron} />
            </LinearGradient>
          </TouchableOpacity>
          
          {dropdownOpen && (
            <View style={styles.dropdownList}>
              {Object.values(ZONES).map((z, index) => (
                <TouchableOpacity
                  key={z.id}
                  style={[styles.dropdownItem, index !== Object.values(ZONES).length - 1 && styles.dropdownItemBorder]}
                  onPress={() => handleZoneSelect(z.id)}
                >
                  <Text style={[styles.dropdownItemText, selectedZone === z.id && { color: COLORS.saffron }]} >
                    {z.title.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={styles.yantraContainer}>
          

          <HarmonyCompassSVG 
            size={W * 0.85} 
            activeZoneData={activeZoneData} 
            pulseAnim={pulseAnim} 
            compassRotAnim={compassRotAnim}
            compassInnerRotAnim={compassInnerRotAnim}
            breathingScaleAnim={breathingScaleAnim}
            gyroX={gyroX}
            gyroY={gyroY}
          />
        </View>

        {/* Inline Info Card (Displays strictly below the Yantra) */}
        {activeZoneData && (
          <Animated.View style={{ 
            opacity: fadeAnim, 
            transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }] 
          }}>
            <LinearGradient colors={['#101018', '#0B0B14']} style={styles.infoCard}>
              <TouchableOpacity style={styles.closeButton} onPress={clearSelection}>
                <Ionicons name="close" size={24} color={'#3A3A4A'} />
              </TouchableOpacity>

              <Text style={styles.sheetSanskrit}>
                {activeZoneData.zones.map((z: any) => z.sanskrit).join(' / ')}
              </Text>
              <Text style={styles.sheetTitle}>
                {activeZoneData.zones.map((z: any) => z.direction).join(' / ')}
              </Text>
              
              <View style={styles.sheetDivider} />

              <Text style={styles.sheetTipTitle}>HARMONY TIP</Text>
              <Text style={styles.sheetTipText}>{activeZoneData.tip}</Text>

              <Text style={styles.sheetWhyTitle}>WHY IT WORKS</Text>
              <Text style={styles.sheetWhyText}>{activeZoneData.why}</Text>
            </LinearGradient>
          </Animated.View>
        )}

        {/* Footer Controls */}
        <View style={styles.footer}>
          <TouchableOpacity 
            style={[styles.compassToggle, isCompassActive && styles.compassToggleActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              setIsCompassActive(!isCompassActive);
            }}
          >
            <LinearGradient 
              colors={isCompassActive ? ['#1A150A', '#0B0B14'] : ['#101018', '#0B0B14']} 
              style={styles.compassToggleInner}
            >
              <Text style={[styles.compassToggleText, isCompassActive && { color: COLORS.saffron }]}>
                {isCompassActive ? 'LIVE ALIGNMENT ON' : 'ENABLE LIVE COMPASS'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
          <Text style={styles.footerNote}>
            Align your physical space with natural energetic currents.
          </Text>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontFamily: 'DancingScript_600SemiBold',
    fontSize: 28,
    color: '#FFF',
    marginBottom: 2,
    textShadowColor: 'rgba(201,162,75,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  headerSubtitle: {
    fontFamily: FONTS.sans,
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.gold,
    letterSpacing: 4,
    textTransform: 'uppercase',
    opacity: 0.8,
  },
  
  // Dropdown Styles
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#1F1F2E',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
  },
  dropdownButtonActive: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderColor: '#2A2A35',
  },
  dropdownButtonText: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(237,230,214,0.7)',
    letterSpacing: 2,
  },
  dropdownList: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#0B0B14',
    borderWidth: 1,
    borderColor: '#1F1F2E',
    borderTopWidth: 0,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  dropdownItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#101018',
  },
  dropdownItemText: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(237,230,214,0.5)',
    letterSpacing: 1,
  },

  yantraContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 40,
  },
  yantraWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabelWrapper: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {
    fontFamily: FONTS.sans,
    fontSize: 9,
    color: COLORS.goldMuted,
    fontWeight: '700',
    letterSpacing: 1,
  },
  
  infoCard: {
    marginHorizontal: 20,
    marginTop: 10,
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1F1F2E',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.8,
    shadowRadius: 24,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8,
    zIndex: 10,
  },
  sheetSanskrit: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.saffron,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  sheetTitle: {
    fontFamily: FONTS.serif,
    fontSize: 28,
    color: COLORS.ivory,
    marginBottom: 20,
  },
  sheetDivider: {
    height: 1,
    backgroundColor: '#1F1F2E',
    width: '100%',
    marginBottom: 24,
  },
  sheetTipTitle: {
    fontFamily: FONTS.sans,
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(237,230,214,0.4)',
    letterSpacing: 2,
    marginBottom: 8,
  },
  sheetTipText: {
    fontFamily: FONTS.serif,
    fontSize: 16,
    color: COLORS.ivory,
    lineHeight: 24,
    marginBottom: 24,
  },
  sheetWhyTitle: {
    fontFamily: FONTS.sans,
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(237,230,214,0.3)',
    letterSpacing: 2,
    marginBottom: 8,
  },
  sheetWhyText: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: 'rgba(237,230,214,0.7)',
    lineHeight: 20,
  },

  footer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 32,
  },
  compassToggle: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1F1F2E',
    marginBottom: 16,
    overflow: 'hidden',
  },
  compassToggleInner: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  compassToggleActive: {
    borderColor: COLORS.saffron,
    shadowColor: COLORS.saffron,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  compassToggleText: {
    fontFamily: FONTS.sans,
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(237,230,214,0.5)',
    letterSpacing: 2,
  },
  footerNote: {
    fontFamily: FONTS.serif,
    fontSize: 12,
    color: 'rgba(237,230,214,0.5)',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
