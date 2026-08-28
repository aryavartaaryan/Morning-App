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
import { VastuCosmicAura } from "@/components/VastuCosmicAura";

import * as Location from 'expo-location';

// ── Design Tokens (Billion-Dollar Luxury Vastu Horizon) ──
const COLORS = {
  bg: '#050509',
  gold: '#D4AF37',
  goldBright: '#FFE6A3',
  goldMuted: 'rgba(212,175,55,0.45)',
  goldFaint: 'rgba(212,175,55,0.15)',
  saffron: '#D4AF37',
  amberGlow: '#F59E0B',
  ivory: '#EDE6D6',
  surface: 'rgba(255,255,255,0.03)',
  cardBorder: 'rgba(212,175,55,0.22)',
};

const FONTS = {
  serif: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  sans: Platform.OS === 'ios' ? 'System' : 'sans-serif',
};

// ── Spatial Zone Data (Tailored for Western Wellness & Architecture) ──
type ZoneId = 'meditate' | 'deepwork' | 'wfh' | 'eat' | 'sleep';

const ZONES: Record<ZoneId, {
  id: ZoneId;
  title: string;
  subtitle: string;
  archetype: string;
  tip: string;
  why: string;
  zones: { direction: string; code: string; angle: number; archetype: string }[];
}> = {
  meditate: {
    id: 'meditate',
    title: 'Meditation & Mindfulness',
    subtitle: 'Northeast & East Sanctuary Axis',
    archetype: 'Clarity & Higher Consciousness',
    tip: 'Face Northeast or East during meditation for maximum nervous system coherence and mental clarity.',
    why: 'These channels align with natural geomagnetic currents that soothe the autonomic nervous system and deepen inner stillness.',
    zones: [
      { direction: 'Northeast', code: 'NE', angle: 45, archetype: 'Clarity' },
      { direction: 'East', code: 'E', angle: 90, archetype: 'Vitality' },
      { direction: 'North', code: 'N', angle: 0, archetype: 'Stillness' },
    ]
  },
  deepwork: {
    id: 'deepwork',
    title: 'Deep Work & Peak Focus',
    subtitle: 'Northeast & North Strategy Axis',
    archetype: 'Vision & Deep Focus',
    tip: 'Position your desk facing North or East in the Northeast sector to eliminate mental fatigue.',
    why: 'Considered the most energetically clear sector, promoting high-frequency alpha wave focus and sustained creative synthesis.',
    zones: [
      { direction: 'Northeast', code: 'NE', angle: 45, archetype: 'Clarity' },
      { direction: 'East', code: 'E', angle: 90, archetype: 'Insight' },
      { direction: 'North', code: 'N', angle: 0, archetype: 'Focus' },
    ]
  },
  wfh: {
    id: 'wfh',
    title: 'Career, Wealth & Leadership',
    subtitle: 'North & East Prosperity Axis',
    archetype: 'Abundance & Opportunity',
    tip: 'Work facing North to align your physical posture with the direction of expansive opportunity and financial growth.',
    why: 'Governed by the northern magnetic influx, stimulating strategic acumen, abundance mindset, and decisive leadership.',
    zones: [
      { direction: 'North', code: 'N', angle: 0, archetype: 'Abundance' },
      { direction: 'East', code: 'E', angle: 90, archetype: 'Growth' },
    ]
  },
  eat: {
    id: 'eat',
    title: 'Nourishment & Dining',
    subtitle: 'East & West Digestive Balance',
    archetype: 'Vital Assimilation & Balance',
    tip: 'Dining while facing East or West supports physical vitality, digestion, and metabolic balance.',
    why: 'Harmonizes metabolic digestion with the natural solar trajectory, enhancing cellular energy absorption and post-meal lightness.',
    zones: [
      { direction: 'East', code: 'E', angle: 90, archetype: 'Vitality' },
      { direction: 'West', code: 'W', angle: 270, archetype: 'Balance' },
      { direction: 'North', code: 'N', angle: 0, archetype: 'Harmony' },
    ]
  },
  sleep: {
    id: 'sleep',
    title: 'Restoration & Deep Sleep',
    subtitle: 'Southwest & South Grounding Axis',
    archetype: 'Grounding & Cellular Renewal',
    tip: 'Place the head of your bed toward the South or East within the Southwest chamber for deep, restorative rest.',
    why: 'The Earth’s southern polarity anchors human bio-magnetic currents, lowering nighttime cortisol and facilitating deep REM cycles.',
    zones: [
      { direction: 'Southwest', code: 'SW', angle: 225, archetype: 'Grounding' },
      { direction: 'South', code: 'S', angle: 180, archetype: 'Deep Rest' },
      { direction: 'East', code: 'E', angle: 90, archetype: 'Renewal' },
    ]
  },
};


// ── Sacred Geometry Yantra Component (Multi-Billion-Dollar Vastu Masterpiece) ──
const HarmonyCompassSVG = ({ size, activeZoneData, pulseAnim, compassRotAnim, compassInnerRotAnim, breathingScaleAnim, gyroX, gyroY }: any) => {
  const r = size / 2;
  const center = r;

  // 24-point faceted Sri Yantra crystalline star generator
  const generateFacetedStar = (outerR: number, innerR: number, points: number = 24) => {
    let lightD = '';
    let shadowD = '';
    let outlineD = '';
    const angleStep = (Math.PI * 2) / points;

    for (let i = 0; i < points; i++) {
      const angle1 = i * angleStep - Math.PI / 2;
      const angleMid = (i + 0.5) * angleStep - Math.PI / 2;
      const angle2 = (i + 1) * angleStep - Math.PI / 2;

      const x1 = center + innerR * Math.cos(angle1);
      const y1 = center + innerR * Math.sin(angle1);
      const xMid = center + outerR * Math.cos(angleMid);
      const yMid = center + outerR * Math.sin(angleMid);
      const x2 = center + innerR * Math.cos(angle2);
      const y2 = center + innerR * Math.sin(angle2);

      const xCore = center + (innerR * 0.74) * Math.cos(angleMid);
      const yCore = center + (innerR * 0.74) * Math.sin(angleMid);

      if (i === 0) outlineD += `M ${x1} ${y1} `;
      outlineD += `L ${xMid} ${yMid} L ${x2} ${y2} `;

      lightD += `M ${x1} ${y1} L ${xMid} ${yMid} L ${xCore} ${yCore} Z `;
      shadowD += `M ${xCore} ${yCore} L ${xMid} ${yMid} L ${x2} ${y2} Z `;
    }
    outlineD += 'Z';
    return { lightD, shadowD, outlineD };
  };

  // Simple star generator for inner 12-point harmonic star
  const generateSimpleStar = (outerR: number, innerR: number, points: number = 12) => {
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

  // Sacred Lotus Petals (Vastu Shodasha & Ashtadala Mandala)
  const generatePetals = (outerR: number, innerR: number, count: number = 16, rotOffset: number = 0) => {
    let d = '';
    let spineD = '';
    const angleStep = (Math.PI * 2) / count;
    for (let i = 0; i < count; i++) {
      const angle = i * angleStep + rotOffset;
      const nextAngle = (i + 1) * angleStep + rotOffset;
      const midAngle = angle + angleStep / 2;

      const x1 = center + innerR * Math.cos(angle);
      const y1 = center + innerR * Math.sin(angle);
      const xTip = center + outerR * Math.cos(midAngle);
      const yTip = center + outerR * Math.sin(midAngle);
      const x2 = center + innerR * Math.cos(nextAngle);
      const y2 = center + innerR * Math.sin(nextAngle);

      const cp1x = center + outerR * 0.88 * Math.cos(angle + angleStep * 0.18);
      const cp1y = center + outerR * 0.88 * Math.sin(angle + angleStep * 0.18);
      const cp2x = center + outerR * 0.88 * Math.cos(angle + angleStep * 0.82);
      const cp2y = center + outerR * 0.88 * Math.sin(angle + angleStep * 0.82);

      d += `M ${x1} ${y1} Q ${cp1x} ${cp1y} ${xTip} ${yTip} Q ${cp2x} ${cp2y} ${x2} ${y2} `;
      spineD += `M ${center + (innerR * 1.05) * Math.cos(midAngle)} ${center + (innerR * 1.05) * Math.sin(midAngle)} L ${center + (outerR * 0.94) * Math.cos(midAngle)} ${center + (outerR * 0.94) * Math.sin(midAngle)} `;
    }
    return { d, spineD };
  };

  // Sector Arc for active spatial zone highlight
  const generateSectorPath = (cx: number, cy: number, rIn: number, rOut: number, startDeg: number, endDeg: number) => {
    const sRad = (startDeg - 90) * (Math.PI / 180);
    const eRad = (endDeg - 90) * (Math.PI / 180);
    const x1 = cx + rIn * Math.cos(sRad);
    const y1 = cy + rIn * Math.sin(sRad);
    const x2 = cx + rOut * Math.cos(sRad);
    const y2 = cy + rOut * Math.sin(sRad);
    const x3 = cx + rOut * Math.cos(eRad);
    const y3 = cy + rOut * Math.sin(eRad);
    const x4 = cx + rIn * Math.cos(eRad);
    const y4 = cy + rIn * Math.sin(eRad);
    return `M ${x1} ${y1} L ${x2} ${y2} A ${rOut} ${rOut} 0 0 1 ${x3} ${y3} L ${x4} ${y4} A ${rIn} ${rIn} 0 0 0 ${x1} ${y1} Z`;
  };

  const AnimatedSvgCircle = Animated.createAnimatedComponent(Circle);
  const rotInterpolate = compassRotAnim.interpolate({ inputRange: [-36000, 36000], outputRange: ['-36000deg', '36000deg'] });

  const GOLD_LUXE = "#FFE299";
  const GOLD_PRIMARY = "#D4AF37";
  const GOLD_DEEP = "#8A6B22";

  // 3D Parallax interpolation
  const rotX = gyroY ? gyroY.interpolate({ inputRange: [-15, 15], outputRange: ['-18deg', '18deg'], extrapolate: 'clamp' }) : '0deg';
  const rotY = gyroX ? gyroX.interpolate({ inputRange: [-15, 15], outputRange: [-18, 18] }).interpolate({ inputRange: [-18, 18], outputRange: ['-18deg', '18deg'], extrapolate: 'clamp' }) : '0deg';

  // Geometry instances
  const star24 = generateFacetedStar(r * 0.58, r * 0.44, 24);
  const star12 = generateSimpleStar(r * 0.48, r * 0.38, 12);
  const lotus16 = generatePetals(r * 0.66, r * 0.38, 16, 0);
  const lotus8 = generatePetals(r * 0.35, r * 0.24, 8, Math.PI / 8);

  return (
    <Animated.View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', transform: [{ perspective: 1200 }, { rotateX: rotX }, { rotateY: rotY }] }}>
      
      {/* ── Background Subtle Golden Halo ── */}
      <Animated.View style={{ position: 'absolute', width: size, height: size, alignItems: 'center', justifyContent: 'center', transform: [{ scale: breathingScaleAnim }] }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Defs>
            <RadialGradient id="luxeCompassAura" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={GOLD_PRIMARY} stopOpacity="0.22" />
              <Stop offset="65%" stopColor={GOLD_DEEP} stopOpacity="0.06" />
              <Stop offset="100%" stopColor="#050509" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <AnimatedSvgCircle cx={center} cy={center} r={r * 1.06} fill="url(#luxeCompassAura)" opacity={pulseAnim as any} />
        </Svg>
      </Animated.View>

      {/* ── Main Compass Chassis & Dial Face (Rotates with True Heading when active) ── */}
      <Animated.View style={{ position: 'absolute', width: size, height: size, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: rotInterpolate }] }}>
        
        {/* Physical Dial Base with Drop Shadow */}
        <View style={{
          width: size * 0.98, height: size * 0.98, borderRadius: size / 2,
          borderWidth: 1.2, borderColor: "rgba(212,175,55,0.3)",
          shadowColor: "#000", shadowOffset: { width: 0, height: 18 }, shadowOpacity: 0.85, shadowRadius: 32,
          backgroundColor: "#07080E", elevation: 20
        }}>
          {/* Subtle Outer Glass Bevel Reflection */}
          <View style={{ ...StyleSheet.absoluteFillObject, borderRadius: size / 2, backgroundColor: 'rgba(255,255,255,0.015)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' }} />
        </View>

        {/* ── Sacred Yantra Vector Graphics ── */}
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute' }}>
          <Defs>
            {/* Metallic Gold Primary Gradient */}
            <SvgLinearGradient id="bezelMetallic" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#FFE8B5" stopOpacity="0.95" />
              <Stop offset="25%" stopColor="#D4AF37" stopOpacity="0.5" />
              <Stop offset="50%" stopColor="#8C6D23" stopOpacity="0.75" />
              <Stop offset="75%" stopColor="#D4AF37" stopOpacity="0.5" />
              <Stop offset="100%" stopColor="#FFE8B5" stopOpacity="0.95" />
            </SvgLinearGradient>

            {/* Faceted Star Highlight */}
            <SvgLinearGradient id="starFacetLight" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#FFEAA7" stopOpacity="0.65" />
              <Stop offset="60%" stopColor="#D4AF37" stopOpacity="0.35" />
              <Stop offset="100%" stopColor="#8A6B22" stopOpacity="0.1" />
            </SvgLinearGradient>

            {/* Faceted Star Shadow */}
            <SvgLinearGradient id="starFacetShadow" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#664E19" stopOpacity="0.75" />
              <Stop offset="60%" stopColor="#2A1F08" stopOpacity="0.85" />
              <Stop offset="100%" stopColor="#0B0903" stopOpacity="0.95" />
            </SvgLinearGradient>

            {/* Translucent Lotus Sheen */}
            <SvgLinearGradient id="petalGlow" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#D4AF37" stopOpacity="0.22" />
              <Stop offset="60%" stopColor="#8C6D23" stopOpacity="0.08" />
              <Stop offset="100%" stopColor="#07080E" stopOpacity="0" />
            </SvgLinearGradient>

            {/* Bindu Jewel Radial Glow */}
            <RadialGradient id="binduLuxe" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
              <Stop offset="35%" stopColor="#FFE5A3" stopOpacity="0.9" />
              <Stop offset="75%" stopColor="#D4AF37" stopOpacity="0.7" />
              <Stop offset="100%" stopColor="#4A370E" stopOpacity="0.4" />
            </RadialGradient>

            {/* Active Zone Radial Beam Gradient */}
            <RadialGradient id="activeZoneBeamGrad" cx="50%" cy="50%" r="50%">
              <Stop offset="10%" stopColor="#FFE8B5" stopOpacity="0.45" />
              <Stop offset="60%" stopColor="#D4AF37" stopOpacity="0.18" />
              <Stop offset="95%" stopColor="#D4AF37" stopOpacity="0.0" />
            </RadialGradient>
          </Defs>

          {/* Dial Face (Pitch Dark Velvet Obsidian) */}
          <Circle cx={center} cy={center} r={r * 0.94} fill="#07080E" />

          {/* Outer Bezel Rings */}
          <Circle cx={center} cy={center} r={r * 0.915} fill="none" stroke="url(#bezelMetallic)" strokeWidth={2.4} />
          <Circle cx={center} cy={center} r={r * 0.88} fill="none" stroke="rgba(212,175,55,0.3)" strokeWidth={1} />
          <Circle cx={center} cy={center} r={r * 0.86} fill="none" stroke="rgba(0,0,0,0.65)" strokeWidth={3} />

          {/* Dotted Azimuth Track */}
          <Circle cx={center} cy={center} r={r * 0.84} fill="none" stroke={GOLD_PRIMARY} strokeWidth={0.8} strokeDasharray="1, 4" opacity={0.65} />
          <Circle cx={center} cy={center} r={r * 0.77} fill="none" stroke="rgba(212,175,55,0.35)" strokeWidth={0.6} strokeDasharray="2, 6" />

          {/* ── 72-Point Precision Horology Azimuth Ticks (Every 5°) ── */}
          {[...Array(72)].map((_, i) => {
            const deg = i * 5;
            const rad = deg * (Math.PI / 180);
            const isCardinal = deg % 90 === 0;
            const isInterCardinal = deg % 45 === 0 && !isCardinal;
            const isFifteen = deg % 15 === 0 && !isCardinal && !isInterCardinal;

            const len = isCardinal ? r * 0.11 : isInterCardinal ? r * 0.08 : isFifteen ? r * 0.05 : r * 0.026;
            const strokeW = isCardinal ? 2.6 : isInterCardinal ? 1.8 : isFifteen ? 1.0 : 0.6;
            const strokeColor = isCardinal ? '#FFFFFF' : isInterCardinal ? '#FFE6A3' : isFifteen ? '#C9A24B' : 'rgba(212,175,55,0.45)';
            const opacityVal = isCardinal ? 1.0 : isInterCardinal ? 0.9 : isFifteen ? 0.7 : 0.4;

            const x1 = center + (r * 0.91) * Math.cos(rad);
            const y1 = center + (r * 0.91) * Math.sin(rad);
            const x2 = center + (r * 0.91 - len) * Math.cos(rad);
            const y2 = center + (r * 0.91 - len) * Math.sin(rad);

            return (
              <Line
                key={`azimuth_${i}`}
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={strokeColor}
                strokeWidth={strokeW}
                opacity={opacityVal}
                strokeLinecap="round"
              />
            );
          })}

          {/* North Apex Glyph (Sacred Golden Chevron) */}
          <Path
            d={`M ${center - 6} ${center - r * 0.81} L ${center} ${center - r * 0.865} L ${center + 6} ${center - r * 0.81} Z`}
            fill="#FFFFFF"
            stroke={GOLD_PRIMARY}
            strokeWidth={1}
          />

          {/* ── 16-Petal Sacred Lotus (Vastu Shodasha Mandala) ── */}
          <Path d={lotus16.d} fill="url(#petalGlow)" stroke="url(#bezelMetallic)" strokeWidth={1} />
          <Path d={lotus16.spineD} stroke={GOLD_LUXE} strokeWidth={0.8} opacity={0.55} />

          {/* ── 24-Point Faceted Sri Yantra Star (3D Gemstone Metal Relief) ── */}
          <Path d={star24.lightD} fill="url(#starFacetLight)" />
          <Path d={star24.shadowD} fill="url(#starFacetShadow)" />
          <Path d={star24.outlineD} fill="none" stroke="url(#bezelMetallic)" strokeWidth={1.2} />

          {/* ── 12-Point Secondary Harmonic Star ── */}
          <Path d={star12} fill="none" stroke="#FFE6A3" strokeWidth={0.9} opacity={0.65} />

          {/* ── Concentric Sacred Geometry Blueprint Tracks ── */}
          <Circle cx={center} cy={center} r={r * 0.38} fill="none" stroke={GOLD_PRIMARY} strokeWidth={1.2} strokeDasharray="4, 4" opacity={0.7} />
          <Circle cx={center} cy={center} r={r * 0.34} fill="none" stroke={GOLD_LUXE} strokeWidth={0.8} opacity={0.5} />
          <Circle cx={center} cy={center} r={r * 0.28} fill="none" stroke={GOLD_DEEP} strokeWidth={0.8} strokeDasharray="1, 4" opacity={0.6} />

          {/* ── 8-Petal Inner Lotus (Ashtadala) ── */}
          <Path d={lotus8.d} fill="url(#petalGlow)" stroke={GOLD_LUXE} strokeWidth={1} opacity={0.85} />

          {/* ── Ashtakona Sanctum: Interlocking Squares (Vastu Purusha Grid) ── */}
          <Rect
            x={center - r * 0.18} y={center - r * 0.18}
            width={r * 0.36} height={r * 0.36}
            fill="none" stroke={GOLD_LUXE} strokeWidth={1.2} opacity={0.8}
          />
          <Rect
            x={center - r * 0.18} y={center - r * 0.18}
            width={r * 0.36} height={r * 0.36}
            fill="none" stroke={GOLD_LUXE} strokeWidth={1.2} opacity={0.8}
            transform={`rotate(45 ${center} ${center})`}
          />
          {/* Subtle 3x3 Vastu Purusha Peetha Lines */}
          <Line x1={center - r * 0.06} y1={center - r * 0.18} x2={center - r * 0.06} y2={center + r * 0.18} stroke={GOLD_PRIMARY} strokeWidth={0.5} opacity={0.35} />
          <Line x1={center + r * 0.06} y1={center - r * 0.18} x2={center + r * 0.06} y2={center + r * 0.18} stroke={GOLD_PRIMARY} strokeWidth={0.5} opacity={0.35} />
          <Line x1={center - r * 0.18} y1={center - r * 0.06} x2={center + r * 0.18} y2={center - r * 0.06} stroke={GOLD_PRIMARY} strokeWidth={0.5} opacity={0.35} />
          <Line x1={center - r * 0.18} y1={center + r * 0.06} x2={center + r * 0.18} y2={center + r * 0.06} stroke={GOLD_PRIMARY} strokeWidth={0.5} opacity={0.35} />

          {/* ── Central Brahmasthan Sanctum & Bindu ── */}
          <Circle cx={center} cy={center} r={r * 0.13} fill="#07080E" stroke="url(#bezelMetallic)" strokeWidth={1.4} />
          <Line x1={center - r * 0.12} y1={center} x2={center + r * 0.12} y2={center} stroke={GOLD_PRIMARY} strokeWidth={0.8} opacity={0.6} />
          <Line x1={center} y1={center - r * 0.12} x2={center} y2={center + r * 0.12} stroke={GOLD_PRIMARY} strokeWidth={0.8} opacity={0.6} />
          <Circle cx={center} cy={center} r={r * 0.08} fill="none" stroke={GOLD_LUXE} strokeWidth={0.6} strokeDasharray="2, 2" opacity={0.7} />
          
          {/* Luminous Central Bindu Jewel */}
          <Circle cx={center} cy={center} r={7} fill="url(#binduLuxe)" />
          <Circle cx={center} cy={center} r={3} fill="#FFFFFF" />

          {/* ── ACTIVE SPATIAL PROTOCOL VISUALIZATION INSIDE THE RING ── */}
          {activeZoneData !== null && activeZoneData.zones.map((zone: any, index: number) => {
            const angle = zone.angle;
            const rad = (angle - 90) * (Math.PI / 180);

            // Sector beam (±14° width)
            const sectorPath = generateSectorPath(center, center, r * 0.15, r * 0.88, angle - 14, angle + 14);

            // Vector line coordinates
            const xInner = center + (r * 0.16) * Math.cos(rad);
            const yInner = center + (r * 0.16) * Math.sin(rad);
            const xOuter = center + (r * 0.88) * Math.cos(rad);
            const yOuter = center + (r * 0.88) * Math.sin(rad);

            // Pill badge placement along the ray
            const badgeRadius = r * 0.65;
            const badgeX = center + badgeRadius * Math.cos(rad);
            const badgeY = center + badgeRadius * Math.sin(rad);

            // Keep label upright for readability
            const isFlipped = angle > 90 && angle < 270;
            const textAngle = isFlipped ? angle + 180 : angle;

            return (
              <G key={`active_zone_${index}`}>
                {/* Luminous Golden Sector Beam */}
                <Path d={sectorPath} fill="url(#activeZoneBeamGrad)" />

                {/* Laser Vector Line */}
                <Line
                  x1={xInner} y1={yInner} x2={xOuter} y2={yOuter}
                  stroke="#FFFFFF"
                  strokeWidth={2}
                  strokeLinecap="round"
                />

                {/* Outer Reticle Beacon at Perimeter */}
                <Circle cx={xOuter} cy={yOuter} r={8.5} fill="none" stroke="#FFE5A3" strokeWidth={1.8} opacity={0.9} />
                <Circle cx={xOuter} cy={yOuter} r={4} fill="#FFFFFF" />

                {/* High-Contrast English Archetype Pill Inside the Ring */}
                <G transform={`translate(${badgeX}, ${badgeY}) rotate(${textAngle})`}>
                  <Rect
                    x={-42} y={-11} width={84} height={22} rx={11}
                    fill="rgba(6,7,12,0.94)"
                    stroke={GOLD_PRIMARY}
                    strokeWidth={1}
                  />
                  <SvgText
                    x={0} y={4}
                    fill="#FFFFFF"
                    fontSize={9.5}
                    fontWeight="900"
                    fontFamily={FONTS.sans}
                    textAnchor="middle"
                    letterSpacing={1.2}
                  >
                    {zone.code} • {zone.archetype.toUpperCase()}
                  </SvgText>
                </G>
              </G>
            );
          })}
        </Svg>
        
        {/* Direction Labels (Ultra-Luxury Typography in English) */}
        {[
          { dir: 'N', deg: 0, cardinal: true },
          { dir: 'NE', deg: 45, cardinal: false },
          { dir: 'E', deg: 90, cardinal: true },
          { dir: 'SE', deg: 135, cardinal: false },
          { dir: 'S', deg: 180, cardinal: true },
          { dir: 'SW', deg: 225, cardinal: false },
          { dir: 'W', deg: 270, cardinal: true },
          { dir: 'NW', deg: 315, cardinal: false }
        ].map((item, i) => {
          const rad = (item.deg - 90) * (Math.PI / 180);
          const radius = r * 0.69;
          const x = radius * Math.cos(rad);
          const y = radius * Math.sin(rad);

          return (
            <View key={`dir_${i}`} style={{ position: 'absolute', transform: [{ translateX: x }, { translateY: y }] }} pointerEvents="none">
              <Text style={{
                color: item.dir === 'N' ? '#FFFFFF' : item.cardinal ? '#FFE8B5' : GOLD_PRIMARY,
                fontSize: item.dir === 'N' ? 16 : item.cardinal ? 14 : 11,
                fontWeight: item.cardinal ? '900' : '700',
                fontFamily: FONTS.serif,
                letterSpacing: 1.5,
                opacity: item.cardinal ? 1.0 : 0.85,
                textShadowColor: 'rgba(212,175,55,0.5)',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 8
              }}>{item.dir}</Text>
            </View>
          );
        })}
      </Animated.View>
    </Animated.View>
  );
};





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
      {/* ── Ultra-Dark Velvet Cosmic Vastu Background Animation ── */}
      <VastuCosmicAura />

      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: Math.max(insets.bottom, 40) }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 40) }]}>
          <Text style={styles.headerTitle}>Harmony Compass</Text>
          <Text style={styles.headerSubtitle}>Sacred Space Intelligence</Text>
        </View>

        {/* Dropdown Menu */}
        <View style={{ zIndex: 10, marginHorizontal: 28, marginBottom: 16 }}>
          <TouchableOpacity 
            activeOpacity={0.85}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setDropdownOpen(!dropdownOpen);
            }}
          >
            <LinearGradient 
              colors={['#0E1018', '#07080E']} 
              style={[styles.dropdownButton, dropdownOpen && styles.dropdownButtonActive]}
            >
              <Text style={styles.dropdownButtonText}>
                {activeZoneData ? activeZoneData.title.toUpperCase() : 'SELECT SPATIAL PROTOCOL'}
              </Text>
              <Ionicons name={dropdownOpen ? "chevron-up" : "chevron-down"} size={16} color={COLORS.gold} />
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
                  <Text style={[styles.dropdownItemText, selectedZone === z.id && { color: COLORS.goldBright, fontWeight: '800' }]} >
                    {z.title.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* ── Grand Mandala Yantra Centerpiece ── */}
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

        {/* ── Inline Spatial Architecture Card (Displays strictly below the Yantra) ── */}
        {activeZoneData && (
          <Animated.View style={{ 
            opacity: fadeAnim, 
            transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }] 
          }}>
            <LinearGradient colors={['#0C0E16', '#06070B']} style={styles.infoCard}>
              <TouchableOpacity style={styles.closeButton} onPress={clearSelection}>
                <Ionicons name="close" size={22} color={'#5A5A6E'} />
              </TouchableOpacity>

              {/* English Archetype Tag */}
              <View style={styles.archetypeBadge}>
                <Text style={styles.archetypeBadgeText}>
                  {activeZoneData.archetype.toUpperCase()}
                </Text>
              </View>

              <Text style={styles.sheetTitle}>
                {activeZoneData.subtitle}
              </Text>

              {/* Directional Zone Pills */}
              <View style={styles.zonePillsRow}>
                {activeZoneData.zones.map((z, idx) => (
                  <View key={idx} style={styles.zonePill}>
                    <Text style={styles.zonePillText}>
                      {z.code} • {z.archetype.toUpperCase()}
                    </Text>
                  </View>
                ))}
              </View>
              
              <View style={styles.sheetDivider} />

              <Text style={styles.sheetTipTitle}>SPATIAL HARMONY TIP</Text>
              <Text style={styles.sheetTipText}>{activeZoneData.tip}</Text>

              <Text style={styles.sheetWhyTitle}>WHY THIS PROTOCOL WORKS</Text>
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
              colors={isCompassActive ? ['#241B08', '#0A0C14'] : ['#0E1018', '#07080E']} 
              style={styles.compassToggleInner}
            >
              <Text style={[styles.compassToggleText, isCompassActive && { color: COLORS.goldBright }]}>
                {isCompassActive ? 'LIVE SPATIAL ALIGNMENT ON' : 'ENABLE LIVE COMPASS'}
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
    marginBottom: 16,
  },
  headerTitle: {
    fontFamily: 'DancingScript_600SemiBold',
    fontSize: 30,
    color: '#FFF',
    marginBottom: 2,
    textShadowColor: 'rgba(212,175,55,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  headerSubtitle: {
    fontFamily: FONTS.sans,
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.goldBright,
    letterSpacing: 4,
    textTransform: 'uppercase',
    opacity: 0.85,
  },
  
  // Dropdown Styles
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.7,
    shadowRadius: 18,
  },
  dropdownButtonActive: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderColor: 'rgba(212,175,55,0.45)',
  },
  dropdownButtonText: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.ivory,
    letterSpacing: 2,
  },
  dropdownList: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#07080E',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
    borderTopWidth: 0,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
  },
  dropdownItem: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  dropdownItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  dropdownItemText: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(237,230,214,0.65)',
    letterSpacing: 1.2,
  },

  yantraContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 32,
  },
  
  infoCard: {
    marginHorizontal: 20,
    marginTop: 6,
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.85,
    shadowRadius: 28,
  },
  closeButton: {
    position: 'absolute',
    top: 18,
    right: 18,
    padding: 6,
    zIndex: 10,
  },
  archetypeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(212,175,55,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 0.8,
    borderColor: 'rgba(212,175,55,0.3)',
    marginBottom: 8,
  },
  archetypeBadgeText: {
    fontFamily: FONTS.sans,
    fontSize: 9.5,
    fontWeight: '800',
    color: COLORS.goldBright,
    letterSpacing: 2,
  },
  sheetTitle: {
    fontFamily: FONTS.serif,
    fontSize: 24,
    color: COLORS.ivory,
    marginBottom: 12,
  },
  zonePillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  zonePill: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 0.8,
    borderColor: 'rgba(212,175,55,0.2)',
  },
  zonePillText: {
    fontFamily: FONTS.sans,
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.ivory,
    letterSpacing: 1,
  },
  sheetDivider: {
    height: 1,
    backgroundColor: 'rgba(212,175,55,0.15)',
    width: '100%',
    marginBottom: 20,
  },
  sheetTipTitle: {
    fontFamily: FONTS.sans,
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.goldBright,
    letterSpacing: 2,
    marginBottom: 6,
    opacity: 0.9,
  },
  sheetTipText: {
    fontFamily: FONTS.serif,
    fontSize: 15,
    color: COLORS.ivory,
    lineHeight: 23,
    marginBottom: 20,
  },
  sheetWhyTitle: {
    fontFamily: FONTS.sans,
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(237,230,214,0.45)',
    letterSpacing: 2,
    marginBottom: 6,
  },
  sheetWhyText: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: 'rgba(237,230,214,0.75)',
    lineHeight: 20,
  },

  footer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 28,
  },
  compassToggle: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
    marginBottom: 14,
    overflow: 'hidden',
  },
  compassToggleInner: {
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  compassToggleActive: {
    borderColor: COLORS.gold,
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
  },
  compassToggleText: {
    fontFamily: FONTS.sans,
    fontSize: 10.5,
    fontWeight: '800',
    color: 'rgba(237,230,214,0.7)',
    letterSpacing: 2,
  },
  footerNote: {
    fontFamily: FONTS.serif,
    fontSize: 12,
    color: 'rgba(237,230,214,0.45)',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

