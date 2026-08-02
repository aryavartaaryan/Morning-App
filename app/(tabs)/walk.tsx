/**
 * walk.tsx — Naad Steps Tab
 * Ultra-premium frosted glass redesign.
 * - Deep glassmorphism on all cards (not transparent — rich frosted glass)
 * - Ultra-smart "Modify Today's Target" button
 * - Ultra-smart "Start Nature Walk" button with animated gradient
 * - Premium ring — solid frosted disc inner, not transparent
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  Dimensions,
  Animated,
  Platform,
  Easing,
  Modal,
  AppState,
  type AppStateStatus,
  ImageBackground,
  DeviceEventEmitter,
  TextInput,
  PanResponder,
  Alert,
  BackHandler,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Line, Text as SvgText, G, Path, Defs, LinearGradient as SvgLinearGradient, RadialGradient, Stop, Polygon } from 'react-native-svg';
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

import StepCounter, { type TodayStats, type DailyData } from '@/src/modules/StepCounter';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useBgContext } from '@/lib/bgContext';
import { useSoundPlayer } from '@/lib/soundPlayerContext';
import { ALL_SLEEP_SOUNDS } from '@/lib/sleepSoundsData';
import { getTabBarClearance } from '@/lib/tabBarSpacing';
import { getSolarTimes } from '@/lib/solar';
import { store, KEYS } from '@/lib/storage';
import { DARK_BG_KEYS } from '@/lib/cardTheme';
import { getBgSourceSync } from '@/lib/bgImages';
import { fetchWeather, type WeatherData } from '@/lib/weather';
import { getSacredHourInfo } from '@/lib/solarRingPalette';
import OrbitPulseGame from '@/components/OrbitPulseGame';

// ── Sensors (optional — gracefully degrade if unavailable) ────────────────────
let Gyroscope: any = null;
let Magnetometer: any = null;
try { 
  Gyroscope = require('expo-sensors').Gyroscope; 
  Magnetometer = require('expo-sensors').Magnetometer;
} catch (_) {}

const { width: W } = Dimensions.get('window');

// ── Design tokens ─────────────────────────────────────────────────────────────
const ACCENT   = '#60a5fa';
const GREEN    = '#3b82f6';
const TEAL     = '#2DD4BF';
const GOLD     = '#FCD34D';
const BG_DARK  = '#0A0A0F';
// Frosted glass tokens — rich, not transparent
const GLASS_BG     = 'rgba(15,15,30,0.72)';
const GLASS_BORDER = 'rgba(255,255,255,0.13)';
const GLASS_SHINE  = 'rgba(255,255,255,0.07)';

// ── Ring geometry ─────────────────────────────────────────────────────────────
const RING_SIZE   = 316;
const RING_STROKE = 6;
const R_OUTER     = (RING_SIZE - RING_STROKE) / 2;
const R_INNER     = R_OUTER - 18; // For weekly intention ring
const CIRCUMF     = 2 * Math.PI * R_OUTER;
const CIRCUMF_INNER = 2 * Math.PI * R_INNER;

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtK(n: number): string { return n >= 1000 ? `${(n/1000).toFixed(1)}k` : String(n); }
function dayLabel(dateStr: string): string {
  const days = ['Su','Mo','Tu','We','Th','Fr','Sa'];
  return days[new Date(dateStr + 'T12:00:00').getDay()];
}

// Returns compass cardinal label for a heading in degrees
function getCardinalLabel(deg: number): string {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

// ── Default stats ─────────────────────────────────────────────────────────────
const DEFAULT_STATS: TodayStats = {
  autoSteps: 0, manualSteps: 0, totalSteps: 0, goalSteps: 5000,
  distanceKm: 0, calories: 0, activeMinutes: 0, goalPercent: 0,
};

// ─── Vastu Yantra Scanner ──────────────────────────────────────────────────────
type VastuDir = { label: string; range: [number, number]; };

type VastuActivity = 'sleep' | 'eat' | 'meditate' | 'work' | 'exercise' | 'study' | 'relax';

const VASTU_DATA: Record<VastuActivity, { icon: string; label: string; dirs: VastuDir[]; targetColor: string; reason: string; searchingText: string }> = {
  sleep: { 
    icon: '🛏️', label: 'Sleep Architecture', 
    dirs: [ { label: 'South', range: [157.5, 202.5] }, { label: 'East', range: [67.5, 112.5] } ],
    targetColor: '#a78bfa', 
    reason: "Optimize your sleep architecture. Align your body with the Earth's geomagnetic lines to naturally lower cortisol, reduce sleep latency, and maximize deep REM sleep.",
    searchingText: "Put your head in the direction pointed by Vastu Scanner for deep sleep optimization"
  },
  eat: { 
    icon: '🍽️', label: 'Eat', 
    dirs: [ { label: 'East', range: [67.5, 112.5] }, { label: 'North', range: [337.5, 22.5] } ],
    targetColor: '#fcd34d', 
    reason: "Align with the solar axis to optimize your digestive fire and enhance metabolic rhythm.",
    searchingText: "Face the direction pointed by Vastu Scanner for mindful nourishment"
  },
  meditate: { 
    icon: '🧘', label: 'Meditate', 
    dirs: [ { label: 'North-East', range: [22.5, 67.5] }, { label: 'East', range: [67.5, 112.5] }, { label: 'North', range: [337.5, 22.5] } ],
    targetColor: '#e879f9', 
    reason: "Minimize electromagnetic interference and unlock deep nervous system rest for spiritual clarity.",
    searchingText: "Face the direction pointed by Vastu Scanner for profound inner peace"
  },
  work: { 
    icon: '💼', label: 'WFH Desk Optimizer', 
    dirs: [ { label: 'North', range: [337.5, 22.5] }, { label: 'East', range: [67.5, 112.5] } ],
    targetColor: '#60a5fa', 
    reason: "Biohack your workspace orientation. Align your desk to the magnetic North to optimize Alpha brainwaves, increase deep focus, and reduce workflow friction.",
    searchingText: "Face the direction pointed by Vastu Scanner to enter peak flow state"
  },
  exercise: { 
    icon: '🏃', label: 'Exercise', 
    dirs: [ { label: 'East', range: [67.5, 112.5] }, { label: 'North', range: [337.5, 22.5] } ],
    targetColor: '#f87171', 
    reason: "Sync with the solar alignment to boost vitality, energy flow, and your natural circadian rhythm.",
    searchingText: "Face the direction pointed by Vastu Scanner for dynamic energy"
  },
  study: { 
    icon: '💻', label: 'Study', 
    dirs: [ { label: 'East', range: [67.5, 112.5] }, { label: 'North', range: [337.5, 22.5] } ],
    targetColor: '#34d399', 
    reason: "Harness magnetic alignment to support mental retention and reduce spatial disorientation.",
    searchingText: "Face the direction pointed by Vastu Scanner for crystal clear focus"
  },
  relax: { 
    icon: '🛁', label: 'Relax', 
    dirs: [ { label: 'West', range: [247.5, 292.5] } ],
    targetColor: '#94a3b8', 
    reason: "Embrace the sunset energy to naturally trigger your parasympathetic rest and digest state.",
    searchingText: "Face the direction pointed by Vastu Scanner to unwind and release"
  }
};

function createOpacity(ranges: [number, number][], isSearching: boolean) {
  const inputRange = [];
  const outputRange = [];
  for (let i = 0; i <= 360; i++) {
    let fadeVal = 0;
    for (const [s, e] of ranges) {
      if (s > e) {
        if (i >= s || i <= e) { fadeVal = 1; break; }
        if (i >= s - 8 && i < s) fadeVal = Math.max(fadeVal, (i - (s - 8)) / 8);
        if (i > e && i <= e + 8) fadeVal = Math.max(fadeVal, 1 - (i - e) / 8);
      } else {
        if (i >= s && i <= e) { fadeVal = 1; break; }
        if (i >= s - 8 && i < s) fadeVal = Math.max(fadeVal, (i - (s - 8)) / 8);
        if (i > e && i <= e + 8) fadeVal = Math.max(fadeVal, 1 - (i - e) / 8);
      }
    }
    inputRange.push(i);
    outputRange.push(isSearching ? 1 - fadeVal : fadeVal);
  }
  return { inputRange, outputRange };
}

function VastuScanner({ heading, selectedActivity }: { heading: Animated.Value, selectedActivity: VastuActivity | null }) {
  const modHeading = Animated.modulo(Animated.add(heading, 36000), 360);

  if (!selectedActivity) {
    return (
      <View pointerEvents="none" style={{ position: 'absolute', top: -75, left: -100, right: -100, alignItems: 'center' }}>
        <Text style={{ fontSize: 11, fontWeight: '800', color: '#c084fc', letterSpacing: 3, textTransform: 'uppercase', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6, marginBottom: 4 }}>
          Vastu Energy Scanner
        </Text>
        <Text style={{ fontSize: 9, fontWeight: '500', color: 'rgba(255,255,255,0.6)', letterSpacing: 1.2, textTransform: 'uppercase' }}>
          Select an intention above
        </Text>
      </View>
    );
  }

  const data = VASTU_DATA[selectedActivity];
  const allRanges = data.dirs.map(d => d.range);
  const searchingConfig = createOpacity(allRanges, true);
  const searchingOpacity = modHeading.interpolate(searchingConfig);

  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: -85, left: -120, right: -120, alignItems: 'center' }}>
      {/* Aligned State */}
      {data.dirs.map((dir, idx) => {
        const dirConfig = createOpacity([dir.range], false);
        const opacity = modHeading.interpolate(dirConfig);
        return (
          <Animated.View key={idx} style={{ position: 'absolute', alignItems: 'center', opacity }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <View style={{ height: 1, width: 24, backgroundColor: data.targetColor, marginRight: 8, opacity: 0.8 }} />
              <Text style={{ fontSize: 11, fontWeight: '800', color: data.targetColor, letterSpacing: 2, textTransform: 'uppercase', textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 }}>
                Zone Pointed: {dir.label}
              </Text>
              <View style={{ height: 1, width: 24, backgroundColor: data.targetColor, marginLeft: 8, opacity: 0.8 }} />
            </View>
            <Text style={{ fontSize: 16, fontWeight: '900', color: '#fff', letterSpacing: 1, textTransform: 'uppercase', textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8, textAlign: 'center', paddingHorizontal: 10 }}>
              {selectedActivity === 'sleep' ? `Sleep by facing head in this direction` :
               selectedActivity === 'meditate' ? `Meditate facing this direction` :
               selectedActivity === 'eat' ? `Eat facing this direction` :
               selectedActivity === 'work' ? `Work facing this direction` :
               selectedActivity === 'exercise' ? `Exercise facing this direction` :
               `Aligned in this direction`}
            </Text>
            <Text style={{ fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.85)', marginTop: 8, textAlign: 'center', paddingHorizontal: 30, lineHeight: 14, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 }}>
              {data.reason}
            </Text>
          </Animated.View>
        );
      })}

      {/* Searching State */}
      <Animated.View style={{ 
        position: 'absolute', top: 10, alignItems: 'center', 
        opacity: searchingOpacity 
      }}>
        <Text style={{ fontSize: 12, fontWeight: '800', color: '#fcd34d', letterSpacing: 1.2, textTransform: 'uppercase', textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6, textAlign: 'center', paddingHorizontal: 20 }}>
          {selectedActivity === 'sleep' ? `Find ${data.dirs.map(d=>d.label).join(' or ')} to place your head` :
           selectedActivity === 'meditate' ? `Find ${data.dirs.map(d=>d.label).join(' or ')} to meditate` :
           selectedActivity === 'eat' ? `Find ${data.dirs.map(d=>d.label).join(' or ')} to eat` :
           selectedActivity === 'work' ? `Find ${data.dirs.map(d=>d.label).join(' or ')} to work` :
           `Find ${data.dirs.map(d=>d.label).join(' or ')}`}
        </Text>
        <Text style={{ fontSize: 9, fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginTop: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
          {data.searchingText}
        </Text>
      </Animated.View>
    </View>
  );
}

// ─── Modern HUD Navigator Compass ────────────────────────────────────────────
function CompassRose({ size, heading, selectedActivity }: { size: number; heading: Animated.Value; selectedActivity: VastuActivity | null }) {
  const cx = 50, cy = 50;

  // Continuous animation values
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const rotAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: true })
      ])
    ).start();

    Animated.loop(
      Animated.timing(rotAnim, { toValue: 1, duration: 45000, easing: Easing.linear, useNativeDriver: true })
    ).start();
  }, []);

  const spin1 = rotAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const spin2 = rotAnim.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });
  const pulseScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1.03] });
  const pulseOp = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  // Authentic Sri Yantra interlocking triangles
  const shivaTriangles = [
    "M 50,12 L 85,78 L 15,78 Z",
    "M 50,26 L 75,64 L 25,64 Z",
    "M 50,38 L 65,56 L 35,56 Z",
    "M 50,45 L 56,51 L 44,51 Z"
  ];
  const shaktiTriangles = [
    "M 50,88 L 15,22 L 85,22 Z",
    "M 50,74 L 25,36 L 75,36 Z",
    "M 50,62 L 35,44 L 65,44 Z",
    "M 50,55 L 44,49 L 56,49 Z"
  ];
  const bhupuraPath = "M 15,15 L 42,15 L 42,8 L 58,8 L 58,15 L 85,15 L 85,42 L 92,42 L 92,58 L 85,58 L 85,85 L 58,85 L 58,92 L 42,92 L 42,85 L 15,85 L 15,58 L 8,58 L 8,42 L 15,42 Z";

  return (
    <View pointerEvents="none" style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      
      {/* The main dial rotates with the phone's compass heading */}
      <Animated.View style={{
        position: 'absolute',
        transform: [{ rotate: heading.interpolate({ inputRange: [-360, 0, 360], outputRange: ['360deg', '0deg', '-360deg'] }) }],
        width: size, height: size,
      }}>
        {/* Base Background & Gradients */}
        <Svg width={size} height={size} viewBox="0 0 100 100" style={{ position: 'absolute' }}>
          <Defs>
            <RadialGradient id="goldGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#ffdf00" stopOpacity="0.5" />
              <Stop offset="50%" stopColor="#d4af37" stopOpacity="0.15" />
              <Stop offset="100%" stopColor="#996515" stopOpacity="0" />
            </RadialGradient>
            <SvgLinearGradient id="goldLine" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#ffdf00" />
              <Stop offset="50%" stopColor="#d4af37" />
              <Stop offset="100%" stopColor="#ffec8b" />
            </SvgLinearGradient>
            <SvgLinearGradient id="goldLineReverse" x1="100%" y1="100%" x2="0%" y2="0%">
              <Stop offset="0%" stopColor="#ffdf00" />
              <Stop offset="50%" stopColor="#d4af37" />
              <Stop offset="100%" stopColor="#996515" />
            </SvgLinearGradient>
            <RadialGradient id="bgGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="70%" stopColor="rgba(5, 8, 18, 0.9)" />
              <Stop offset="100%" stopColor="rgba(5, 8, 18, 0.4)" />
            </RadialGradient>
          </Defs>
          
          <Circle cx={cx} cy={cy} r={49} fill="url(#bgGlow)" />
          {/* Subtle outer grid lines */}
          <Circle cx={cx} cy={cy} r={47} fill="none" stroke="rgba(255,223,0,0.15)" strokeWidth={0.5} strokeDasharray="1 3" />
          <Circle cx={cx} cy={cy} r={44} fill="none" stroke="url(#goldLine)" strokeWidth={0.3} />
          <Circle cx={cx} cy={cy} r={43} fill="none" stroke="url(#goldLineReverse)" strokeWidth={0.1} />
        </Svg>

        {/* Slow rotating outer mandala ring (Clockwise) - Shodashadala (16 Petals) */}
        <Animated.View style={{ position: 'absolute', width: size, height: size, transform: [{ rotate: spin1 }] }}>
          <Svg width={size} height={size} viewBox="0 0 100 100">
            {/* Bhupura (Outer Square with gates) */}
            <Path d={bhupuraPath} fill="none" stroke="url(#goldLine)" strokeWidth={0.4} />
            <Path d={bhupuraPath} fill="none" stroke="url(#goldLineReverse)" strokeWidth={0.2} scale={0.96} origin={`${cx}, ${cy}`} />
            
            {Array.from({ length: 16 }).map((_, i) => {
              const a = (i * 360) / 16;
              return (
                <G key={i} rotation={a} origin={`${cx}, ${cy}`}>
                  <Path d={`M 50,8 Q 54,16 50,23 Q 46,16 50,8 Z`} fill="rgba(255,223,0,0.03)" stroke="url(#goldLine)" strokeWidth={0.3} />
                </G>
              );
            })}
          </Svg>
        </Animated.View>

        {/* Slow rotating inner mandala ring (Counter-clockwise) - Ashtadala (8 Petals) */}
        <Animated.View style={{ position: 'absolute', width: size, height: size, transform: [{ rotate: spin2 }] }}>
          <Svg width={size} height={size} viewBox="0 0 100 100">
            <Circle cx={cx} cy={cy} r={23} fill="none" stroke="url(#goldLine)" strokeWidth={0.5} />
            {Array.from({ length: 8 }).map((_, i) => {
              const a = (i * 360) / 8;
              return (
                <G key={i} rotation={a} origin={`${cx}, ${cy}`}>
                  <Path d={`M 50,23 Q 57,32 50,39 Q 43,32 50,23 Z`} fill="rgba(212,175,55,0.08)" stroke="url(#goldLineReverse)" strokeWidth={0.5} />
                </G>
              );
            })}
          </Svg>
        </Animated.View>

        {/* Pulsing Core Sri Yantra Triangles */}
        <Animated.View style={{ 
          position: 'absolute', width: size, height: size, 
          transform: [{ scale: pulseScale }],
          opacity: pulseOp
        }}>
          <Svg width={size} height={size} viewBox="0 0 100 100">
            <Circle cx={cx} cy={cy} r={39} fill="url(#goldGlow)" />
            {/* Shiva Triangles (Upward) */}
            {shivaTriangles.map((d, i) => (
              <Path key={`shiva-${i}`} d={d} fill="rgba(255,223,0,0.04)" stroke="url(#goldLine)" strokeWidth={0.4} />
            ))}
            {/* Shakti Triangles (Downward) */}
            {shaktiTriangles.map((d, i) => (
              <Path key={`shakti-${i}`} d={d} fill="rgba(255,223,0,0.04)" stroke="url(#goldLineReverse)" strokeWidth={0.4} />
            ))}
            <Circle cx={cx} cy={cy} r={1.5} fill="#ffdf00" />
            <Circle cx={cx} cy={cy} r={3.5} fill="none" stroke="url(#goldLine)" strokeWidth={0.6} />
          </Svg>
        </Animated.View>

        {/* Target Arc for Vastu Activity */}
        <Svg width={size} height={size} viewBox="0 0 100 100" style={{ position: 'absolute' }}>
          {selectedActivity && (() => {
            const data = VASTU_DATA[selectedActivity];
            const r = 48;
            return data.dirs.map((dir, i) => {
              let [startAngle, endAngle] = dir.range;
              if (startAngle > endAngle) endAngle += 360; 
              const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;
              const startX = cx + r * Math.sin(startAngle * Math.PI / 180);
              const startY = cy - r * Math.cos(startAngle * Math.PI / 180);
              const endX = cx + r * Math.sin(endAngle * Math.PI / 180);
              const endY = cy - r * Math.cos(endAngle * Math.PI / 180);
              
              return (
                <G key={i}>
                  <Path 
                    d={`M ${startX} ${startY} A ${r} ${r} 0 ${largeArcFlag} 1 ${endX} ${endY}`} 
                    fill="none" 
                    stroke={data.targetColor} 
                    strokeWidth={1.8} 
                    strokeLinecap="round" 
                  />
                  {/* Subtle glow layer for arc */}
                  <Path 
                    d={`M ${startX} ${startY} A ${r} ${r} 0 ${largeArcFlag} 1 ${endX} ${endY}`} 
                    fill="none" 
                    stroke={data.targetColor} 
                    strokeWidth={5}
                    strokeOpacity={0.35}
                    strokeLinecap="round" 
                  />
                </G>
              );
            });
          })()}
        </Svg>
      </Animated.View>

      {/* Fixed Alignment Indicator at top (Ultra-thin glowing diamond/triangle) */}
      <View style={{ position: 'absolute', width: size, height: size }}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Path d={`M${cx} ${cy-49} L${cx-2} ${cy-44} L${cx} ${cy-46} L${cx+2} ${cy-44} Z`} fill="url(#goldLine)" />
          <Path d={`M${cx} ${cy-49} L${cx-2} ${cy-44} L${cx} ${cy-46} L${cx+2} ${cy-44} Z`} fill="none" stroke="rgba(255,223,0,0.6)" strokeWidth={1} />
        </Svg>
      </View>
    </View>
  );
}

// ── iOS-style glass overlay — identical to sleep.tsx ─────────────────────────
function GlassPulseOverlay() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <BlurView
        tint="dark"
        intensity={65}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      {/* Premium iOS frosted-glass gradient overlay — same as sleep page */}
      <LinearGradient
        colors={[
          'rgba(4,6,14,0.15)',
          'rgba(4,6,14,0.30)',
          'rgba(4,6,14,0.45)',
          'rgba(4,6,14,0.65)',
        ]}
        locations={[0, 0.3, 0.7, 1]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
    </View>
  );
}

// ── DYNAMIC RING THEMES ────────────────────────────────────────────────────────
function getRingTheme(hour: number) {
  if (hour >= 5 && hour < 10) {
    return { // Morning (Gold/Amber)
      outer: '#fde68a', mid: '#fcd34d', inner: '#fbbf24', track: 'rgba(251,191,36,0.2)', glow: 'rgba(251,191,36,0.1)',
      liquid: ['#fbbf24', '#fcd34d', '#ffffff']
    };
  } else if (hour >= 10 && hour < 17) {
    return { // Midday (Cyan/Sky)
      outer: '#bae6fd', mid: '#7dd3fc', inner: '#38bdf8', track: 'rgba(56,189,248,0.2)', glow: 'rgba(56,189,248,0.1)',
      liquid: ['#38bdf8', '#7dd3fc', '#ffffff']
    };
  } else if (hour >= 17 && hour < 20) {
    return { // Sunset (Orange/Coral)
      outer: '#fed7aa', mid: '#fdba74', inner: '#fb923c', track: 'rgba(251,146,60,0.2)', glow: 'rgba(251,146,60,0.1)',
      liquid: ['#fb923c', '#fdba74', '#ffffff']
    };
  } else {
    return { // Night (Indigo/Violet)
      outer: '#c7d2fe', mid: '#a5b4fc', inner: '#818cf8', track: 'rgba(129,140,248,0.2)', glow: 'rgba(129,140,248,0.1)',
      liquid: ['#818cf8', '#a5b4fc', '#ffffff']
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function WalkTab() {
  const insets = useSafeAreaInsets();
  const { playingId, playSound, stopSound, setGlobalVolume } = useSoundPlayer();
  const router = useRouter();

  // ── State ──────────────────────────────────────────────────────────────────
  const [selectedActivity, setSelectedActivity] = useState<VastuActivity | null>(null);
  const selectedActivityRef = useRef<VastuActivity | null>(null);
  useEffect(() => { selectedActivityRef.current = selectedActivity; }, [selectedActivity]);
  const [energizeModalVisible, setEnergizeModalVisible] = useState(false);
  const [stats,        setStats]        = useState<TodayStats>(DEFAULT_STATS);
  const [weekData,     setWeekData]     = useState<DailyData[]>([]);
  const [isAvailable,  setIsAvailable]  = useState(true);
  const [loading,      setLoading]      = useState(true);
  const [showGoalModal,setShowGoalModal]= useState(false);
  const [showOrbitGame, setShowOrbitGame] = useState(false);
  const [goalInput,    setGoalInput]    = useState('8000');
  const [streak,       setStreak]       = useState(0);
  const [sessionTitle, setSessionTitle] = useState('Start Nature Walk');
  const [sessionType, setSessionType]   = useState<'morning' | 'evening'>('morning');
  const [ringDashOffset, setRingDashOffset] = useState(CIRCUMF);
  const [yesterdaySteps, setYesterdaySteps] = useState(0);
  const [weather, setWeather]           = useState<WeatherData | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [summary, setSummary]           = useState<any>(null);
  // Track compact step-session bar visibility for bottom padding
  const [stepBarActive, setStepBarActive] = useState(false);

  // ── Cosmic Bowl Game State ──
  const [isBowlMode, setIsBowlMode] = useState(false);
  const isBowlModeRef = useRef(false);
  const bowlTimerRef = useRef<any>(null);
  const bowlOpacity = useRef(new Animated.Value(1)).current; // Opacity of the main UI
  const omVolumeRef = useRef(0);
  const bowlGameSoundRef = useRef<any>(null); // to keep track of the sound if needed, but we use playSound via context.

  const OM_SOUND_ID = 'med_om_chanting_new';
  const ringAnim    = useRef(new Animated.Value(0)).current;
  const pulseAnim   = useRef(new Animated.Value(1)).current;
  const glowAnim    = useRef(new Animated.Value(0)).current;
  const cardFade    = useRef(new Animated.Value(0)).current;
  const cardSlide   = useRef(new Animated.Value(30)).current;
  const btnShimmer  = useRef(new Animated.Value(0)).current;
  // 0 = normal, 1 = compact (bar visible)
  const compactAnim = useRef(new Animated.Value(0)).current;
  const walkScrollRef = useRef<ScrollView | null>(null);

  // Sci-fi ring rotations
  const rot1 = useRef(new Animated.Value(0)).current;
  const rot2 = useRef(new Animated.Value(0)).current;
  const rot3 = useRef(new Animated.Value(0)).current;

  // ── Feature 1: Gyroscope parallax ──────────────────────────────────────────
  const gyroX = useRef(new Animated.Value(0)).current;
  const gyroY = useRef(new Animated.Value(0)).current;

  // ── Feature 2: Liquid leading-edge pulse ───────────────────────────────────
  const liquidPulse = useRef(new Animated.Value(1)).current;

  // ── Feature 3: Rain droplets (JS driver for opacity+translateY) ────────────
  const RAIN_COUNT = 5;
  const rainAnims = useRef(Array.from({ length: RAIN_COUNT }, () => ({
    y:  new Animated.Value(0),
    op: new Animated.Value(0),
    x:  Math.random() * 140 + 60,
  }))).current;

  // ── Compass (Sensors) ───────────────────────────────────────────────────
  const [compassActive, setCompassActive] = useState<boolean>(false);
  const compassAnim = useRef(new Animated.Value(0)).current;
  let lastHeading = 0;

  // ── Feature 4: Heartbeat press ─────────────────────────────────────────────
  const heartbeatScale = useRef(new Animated.Value(1)).current;
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rippleScaleHeart = useRef(new Animated.Value(0)).current;
  const rippleOpHeart    = useRef(new Animated.Value(0)).current;

  // ── Feature 5: Goal completion particles ──────────────────────────────────
  const goalFiredRef = useRef(false);
  const PARTICLE_COUNT = 20;
  const particleAnims = useRef(Array.from({ length: PARTICLE_COUNT }, () => ({
    x:   new Animated.Value(0),
    y:   new Animated.Value(0),
    op:  new Animated.Value(0),
    clr: ['#2DD4BF','#7dd3fc','#bae6fd','#ffffff','#38bdf8'][Math.floor(Math.random() * 5)],
    angle: (Math.PI * 2 * Math.random()),
    dist: 80 + Math.random() * 60,
  }))).current;

  // ── Feature 6: Quote cycling ───────────────────────────────────────────────
  const QUOTES = ['Finding your rhythm...', 'In sync with nature.', 'Every step, a breath.'];
  const [quoteIdx, setQuoteIdx]     = useState(0);
  const quoteOpacity                = useRef(new Animated.Value(1)).current;

  // ── Feature 7: Compass heading ─────────────────────────────────────────────
  const [compassTipVisible, setCompassTipVisible] = useState(false);
  const compassTipOpacity = useRef(new Animated.Value(0)).current;
  const compassRot = useRef(new Animated.Value(0)).current;

  // ── Dynamic Theme & Weather Flags ──────────────────────────────────────────
  const theme = getRingTheme(new Date().getHours());
  const isHot = weather?.temp ? weather.temp > 32 : false;
  const isCold = weather?.temp ? weather.temp < 10 : false;
  
  // Heat wave animation
  const heatAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (isHot) {
      Animated.loop(Animated.sequence([
        Animated.timing(heatAnim, { toValue: 1, duration: 4000, useNativeDriver: true }),
        Animated.timing(heatAnim, { toValue: 0, duration: 4000, useNativeDriver: true })
      ])).start();
    } else {
      heatAnim.setValue(0);
    }
  }, [isHot]);

  // ── Mandala Game ────────────────────────────────────────────────────────────
  const mandalaRot = useRef(new Animated.Value(0)).current;
  const mandalaScale = useRef(new Animated.Value(1)).current;
  const lastMandalaRot = useRef(0);
  
  // Stale closure fixes for PanResponder
  const playSoundRef = useRef(playSound);
  const stopSoundRef = useRef(stopSound);
  const setGlobalVolRef = useRef(setGlobalVolume);
  const setIsBowlModeStateRef = useRef(setIsBowlMode);
  useEffect(() => {
    playSoundRef.current = playSound;
    stopSoundRef.current = stopSound;
    setGlobalVolRef.current = setGlobalVolume;
    setIsBowlModeStateRef.current = setIsBowlMode;
  }, [playSound, stopSound, setGlobalVolume, setIsBowlMode]);

  // Memoize the PanResponder so it's not recreated on every single render frame!
  // Recreating it causes massive garbage collection and ruins 60fps animations.
  const mandalaPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      Animated.spring(mandalaScale, { toValue: 1.15, friction: 3, useNativeDriver: true }).start();

      // Start the long-press timer for Cosmic Bowl mode
      bowlTimerRef.current = setTimeout(() => {
        isBowlModeRef.current = true;
        setIsBowlModeStateRef.current(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        
        // Expand the Mandala fully and fade out the rest of the UI
        Animated.spring(mandalaScale, { toValue: 1.8, friction: 5, useNativeDriver: true }).start();
        Animated.timing(bowlOpacity, { toValue: 0, duration: 800, useNativeDriver: true }).start();
        
        // Start playing the cosmic OM sound at volume 0 (will ramp up with tracing)
        const omSound = ALL_SLEEP_SOUNDS.find(s => s.id === OM_SOUND_ID);
        if (omSound) {
          setGlobalVolRef.current(0);
          playSoundRef.current(omSound, 3600, undefined, 0, true);
        }
      }, 1000); // 1 second hold activates the game

      heartbeatIntervalRef.current = setInterval(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        rippleScaleHeart.setValue(0.6);
        rippleOpHeart.setValue(0.6);
        Animated.parallel([
          Animated.timing(rippleScaleHeart, { toValue: 1.6, duration: 700, useNativeDriver: true }),
          Animated.timing(rippleOpHeart,    { toValue: 0,   duration: 700, useNativeDriver: true }),
        ]).start();
      }, 800);
    },
    onPanResponderMove: (evt, gestureState) => {
      // If they move too much before the timer hits, cancel the bowl mode entry
      if (!isBowlModeRef.current && (Math.abs(gestureState.dx) > 20 || Math.abs(gestureState.dy) > 20)) {
        if (bowlTimerRef.current) clearTimeout(bowlTimerRef.current);
      }

      if (isBowlModeRef.current) {
        // --- COSMIC BOWL TRACING LOGIC ---
        // Calculate angular velocity (simplified by tracking overall movement magnitude)
        const speed = Math.sqrt(gestureState.vx * gestureState.vx + gestureState.vy * gestureState.vy);
        
        // Spin the mandala based on tracing speed
        const newRot = lastMandalaRot.current + (gestureState.dx + gestureState.dy) / 2;
        mandalaRot.setValue(newRot);
        
        // Ramp volume up based on speed, max out at 1.0
        let targetVol = Math.min(1, Math.max(0, speed / 3));
        // Exponential smoothing for the volume to feel natural
        omVolumeRef.current = omVolumeRef.current * 0.9 + targetVol * 0.1;
        
        // If they are moving fast enough, give them haptic friction!
        if (speed > 0.5) {
           Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        
        // Update the global volume (our Om sound is playing)
        setGlobalVolRef.current(omVolumeRef.current);

      } else {
        // Normal mandala spin
        const newRot = lastMandalaRot.current + (gestureState.dx / 2);
        mandalaRot.setValue(newRot);
      }
    },
    onPanResponderRelease: (evt, gestureState) => {
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      if (bowlTimerRef.current) clearTimeout(bowlTimerRef.current);

      if (isBowlModeRef.current) {
        // Exit Cosmic Bowl Mode
        isBowlModeRef.current = false;
        setIsBowlModeStateRef.current(false);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        
        // Restore UI and Mandala scale
        Animated.spring(mandalaScale, { toValue: 1, friction: 5, useNativeDriver: true }).start();
        Animated.timing(bowlOpacity, { toValue: 1, duration: 1000, useNativeDriver: true }).start();
        
        // Fade out and stop the OM sound
        setGlobalVolRef.current(0);
        setTimeout(() => {
          stopSoundRef.current();
          setGlobalVolRef.current(1); // Restore global volume for other sounds
        }, 100);

      } else {
        // Normal release
        Animated.spring(mandalaScale, { toValue: 1, friction: 5, useNativeDriver: true }).start();
        lastMandalaRot.current += (gestureState.dx / 2);
        
        if (Math.abs(gestureState.vx) > 0.5) {
           Animated.decay(mandalaRot, {
             velocity: gestureState.vx / 10,
             deceleration: 0.995,
             useNativeDriver: true
           }).start();
        }
      }
    },
    onPanResponderTerminate: (evt, gestureState) => {
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      if (bowlTimerRef.current) clearTimeout(bowlTimerRef.current);
      
      if (isBowlModeRef.current) {
         isBowlModeRef.current = false;
         setIsBowlModeStateRef.current(false);
         Animated.spring(mandalaScale, { toValue: 1, friction: 5, useNativeDriver: true }).start();
         Animated.timing(bowlOpacity, { toValue: 1, duration: 1000, useNativeDriver: true }).start();
         setGlobalVolRef.current(0);
         setTimeout(() => { stopSoundRef.current(); setGlobalVolRef.current(1); }, 100);
      } else {
        Animated.spring(mandalaScale, { toValue: 1, friction: 5, useNativeDriver: true }).start();
        lastMandalaRot.current += (gestureState.dx / 2);
      }
    },
  }), []);

  // ── Data refresh ────────────────────────────────────────────────────────────
  const refreshStats = useCallback(async () => {
    try {
      const [s, analytics] = await Promise.all([
        StepCounter.getTodayStats(),
        StepCounter.getThirtyDayAnalytics(),
      ]);
      setStats(s);
      setWeekData(analytics.dailyData.slice(-7));
      setStreak(analytics.summary.currentStreak);
      setSummary(analytics.summary);
    } catch (err) {
      console.warn("Failed to fetch step stats:", err);
    }
  }, []);

  useEffect(() => {
    // Listen to compact step-session bar appearing / disappearing so we
    // always add the right amount of bottom padding and nothing gets covered.
    const sub = DeviceEventEmitter.addListener('StepTracker.active', (visible: boolean) => {
      setStepBarActive(visible);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('SessionEnded', () => {
      refreshStats();
    });
    return () => sub.remove();
  }, [refreshStats]);

  useFocusEffect(useCallback(() => {
    walkScrollRef.current?.scrollTo({ y: 0, animated: false });
    // Run daily reset check every time the tab is focused
    StepCounter.maybeResetForNewDay().then(() => refreshStats());
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      router.navigate('/(tabs)');
      return true;
    });
    return () => sub.remove();
  }, [refreshStats, router]));

  // ── Boot ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    console.log('[WalkTab] mounted — all animations JS-driver only');
    (async () => {
      try {
        // Always reset for new day before loading data
        await StepCounter.maybeResetForNewDay();

        const loc = await store.getJSON<{lat: number, lon: number}>(KEYS.location);
      if (loc) {
        const solar = getSolarTimes(loc.lat, loc.lon);
        const hour = new Date().getHours() + new Date().getMinutes() / 60;
        
        if (hour >= solar.sunrise && hour < solar.solarNoon + 1) {
          setSessionTitle('Start Nature Walk');
          setSessionType('morning');
        } else if (hour >= solar.solarNoon + 1 && hour < solar.sunset + 1) {
          setSessionTitle('Start Nature Walk');
          setSessionType('evening');
        } else {
          setSessionTitle('Start Nature Walk');
          setSessionType('evening');
        }
      }

      const avail = await StepCounter.isAvailable();
      setIsAvailable(avail);
      if (avail) {
        await refreshStats();
      }
      
      try {
        const w = await fetchWeather();
        setWeather(w);
      } catch (err) {
        console.warn("Weather fetch error in walk.tsx:", err);
      }

      // Load yesterday's steps for motivational ring display
      const ySteps = await StepCounter.getYesterdaySteps();
      setYesterdaySteps(ySteps);

      } catch (err) {
        console.warn("Boot error in walk.tsx:", err);
      } finally {
        setLoading(false);
      }
    })();

    Animated.parallel([
      Animated.timing(cardFade,  { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(cardSlide, { toValue: 0, duration: 800, easing: Easing.out(Easing.exp), useNativeDriver: true }),
    ]).start();

    // pulseAnim uses JS driver to stay consistent with all other JS-driver props on the same views
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.02, duration: 4500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.00, duration: 4500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    // Shimmer for walk button — uses native driver (translateX only, no mixing)
    Animated.loop(
      Animated.timing(btnShimmer, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: true })
    ).start();

    Animated.loop(Animated.timing(rot1, { toValue: 1, duration: 25000, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(rot2, { toValue: 1, duration: 32000, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(rot3, { toValue: 1, duration: 16000, easing: Easing.linear, useNativeDriver: true })).start();

    // Feature 2: Liquid leading-edge pulse
    Animated.loop(Animated.sequence([
      Animated.timing(liquidPulse, { toValue: 1.6, duration: 800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(liquidPulse, { toValue: 1.0, duration: 800, easing: Easing.in(Easing.ease), useNativeDriver: true }),
    ])).start();

    // Feature 6: Quote crossfade every 8s
    const quoteCycle = setInterval(() => {
      Animated.timing(quoteOpacity, { toValue: 0, duration: 600, useNativeDriver: true }).start(() => {
        setQuoteIdx(i => (i + 1) % QUOTES.length);
        Animated.timing(quoteOpacity, { toValue: 1, duration: 800, useNativeDriver: true }).start();
      });
    }, 8000);

    // Feature 1: Gyroscope parallax
    let gyroSub: any = null;
    if (Gyroscope) {
      try {
        Gyroscope.setUpdateInterval(120);
        gyroSub = Gyroscope.addListener(({ x, y }: { x: number; y: number }) => {
          Animated.spring(gyroX, { toValue: Math.max(-8, Math.min(8, y * 40)), useNativeDriver: true, tension: 60, friction: 12 }).start();
          Animated.spring(gyroY, { toValue: Math.max(-8, Math.min(8, x * 40)), useNativeDriver: true, tension: 60, friction: 12 }).start();
        });
      } catch (_) {}
    }

    // Feature 7: Highly Accurate Sensor-based Compass
    let magSub: any = null;
    let firstReading = true;
    let lastHapticTime = 0;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          magSub = await Location.watchHeadingAsync((data) => {
            let angle = data.trueHeading >= 0 ? data.trueHeading : data.magHeading;
            if (angle < 0) return; // Invalid reading
            
            let diff = angle - lastHeading;
            if (diff > 180) diff -= 360;
            else if (diff < -180) diff += 360;
            
            let newHeading = lastHeading + diff;
            
            Animated.spring(compassAnim, {
              toValue: newHeading,
              useNativeDriver: true,
              tension: 40,
              friction: 8
            }).start();

            lastHeading = newHeading;

            // Lock-on Haptic Logic using ref to avoid stale closures and state updates
            const currentActivity = selectedActivityRef.current;
            if (currentActivity) {
              const data = VASTU_DATA[currentActivity];
              const modAngle = (newHeading % 360 + 360) % 360;
              let isAligned = false;
              
              for (const dir of data.dirs) {
                const [s, e] = dir.range;
                if (s > e) {
                  if (modAngle >= s || modAngle <= e) isAligned = true;
                } else {
                  if (modAngle >= s && modAngle <= e) isAligned = true;
                }
              }

              if (isAligned && !wasAlignedRef.current) {
                wasAlignedRef.current = true;
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              } else if (!isAligned) {
                wasAlignedRef.current = false;
              }
            }

            if (firstReading) {
              firstReading = false;
              // Show the "hold flat" tip briefly
              setCompassTipVisible(true);
              Animated.sequence([
                Animated.timing(compassTipOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
                Animated.delay(3500),
                Animated.timing(compassTipOpacity, { toValue: 0, duration: 600, useNativeDriver: true }),
              ]).start(() => setCompassTipVisible(false));
            }
          });
        }
      } catch (e) {
        console.log("Compass error in walk.tsx", e);
      }
    })();

    return () => {
      clearInterval(quoteCycle);
      if (gyroSub) try { gyroSub.remove(); } catch (_) {}
      if (magSub) magSub.remove();
    };
  }, []);

  // Haptic Lock-on logic moved inside watchHeadingAsync callback
  const wasAlignedRef = useRef(false);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') refreshStats();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const t = setInterval(async () => {
      await StepCounter.maybeResetForNewDay();
      await StepCounter.snapshotTodayToHistory();
      await refreshStats();
      const ySteps = await StepCounter.getYesterdaySteps();
      setYesterdaySteps(ySteps);
    }, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const sub = StepCounter.onDailyStepUpdate((_steps) => {
      refreshStats();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    Animated.timing(ringAnim, {
      toValue: stats.goalPercent / 100,
      duration: 1500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    const id = ringAnim.addListener(({ value }) => {
      setRingDashOffset(CIRCUMF - value * CIRCUMF);
    });
    return () => ringAnim.removeListener(id);
  }, [stats.goalPercent]);

  // Feature 3: Rain droplets animation
  const isRaining = !!(weather && weather.weatherCode >= 51 && weather.weatherCode <= 99);
  useEffect(() => {
    if (!isRaining) return;
    const anims = rainAnims.map((ra, i) => {
      ra.y.setValue(0);
      ra.op.setValue(0);
      return Animated.sequence([
        Animated.delay(i * 600),
        Animated.loop(Animated.sequence([
          Animated.parallel([
            Animated.timing(ra.y,  { toValue: 160, duration: 2200, easing: Easing.linear, useNativeDriver: true }),
            Animated.sequence([
              Animated.timing(ra.op, { toValue: 0.7, duration: 300, useNativeDriver: true }),
              Animated.timing(ra.op, { toValue: 0,   duration: 1900, useNativeDriver: true }),
            ]),
          ]),
          Animated.parallel([
            Animated.timing(ra.y,  { toValue: 0, duration: 0, useNativeDriver: true }),
            Animated.timing(ra.op, { toValue: 0, duration: 0, useNativeDriver: true }),
          ]),
        ])),
      ]);
    });
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, [isRaining]);

  // Feature 5: Goal completion particles
  useEffect(() => {
    if (stats.goalPercent >= 100 && !goalFiredRef.current) {
      goalFiredRef.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const panims = particleAnims.map(p => {
        p.x.setValue(0); p.y.setValue(0); p.op.setValue(1);
        return Animated.parallel([
          Animated.timing(p.x, { toValue: Math.cos(p.angle) * p.dist, duration: 2500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(p.y, { toValue: Math.sin(p.angle) * p.dist, duration: 2500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(p.op, { toValue: 0, duration: 2500, useNativeDriver: true }),
        ]);
      });
      Animated.parallel(panims).start();
    }
    if (stats.goalPercent < 100) goalFiredRef.current = false;
  }, [stats.goalPercent]);


  // ── Launch session ──────────────────────────────────────────────────────────
  const launchSession = (type: 'morning' | 'evening' | 'postmeal') => {
    if (!summary || summary.weeklyGoal === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setShowOnboarding(true);
      return;
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.push({
      pathname: '/step-session',
      params: { sessionType: type },
    } as never);
  };

  // ── Compact mode: smoothly shrink UI when a floating bar is visible ──────────
  // Disabled as per user request: there is enough free space at the bottom, so we don't need to push elements up.
  const compactMode = false;
  useEffect(() => {
    Animated.spring(compactAnim, {
      toValue: compactMode ? 1 : 0,
      useNativeDriver: true,
      friction: 8,
      tension: 50,
    }).start();
  }, [compactMode]);
  // ringAnim also uses JS driver consistently

  // Interpolated compact values
  // Ring: scale from 1.0 down to 0.95 (barely shrinks, preserves size)
  const ringScale      = compactAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.95] });
  // Tagline card: fade out and collapse vertically
  const taglineOpacity = compactAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const taglineHeight  = compactAnim.interpolate({ inputRange: [0, 1], outputRange: [88, 0] });
  // Header top padding shrink
  const headerTopPad   = compactAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  // Ring wrapper margin tighten
  const ringMarginTop  = compactAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -18] });
  // Weekly bar margin tighten
  const weeklyMargin   = compactAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 6] });
  // Button area margin tighten
  const btnMarginTop   = compactAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 4] });
  const btnMarginBot   = compactAnim.interpolate({ inputRange: [0, 1], outputRange: [15, 4] });
  // Button inner padding shrink
  const btnPadV        = compactAnim.interpolate({ inputRange: [0, 1], outputRange: [15, 10] });
  const btnPadV2       = compactAnim.interpolate({ inputRange: [0, 1], outputRange: [14, 10] });

  // ── Derived values for ring ─────────────────────────────────────────────────
  const glowOpacity = glowAnim.interpolate({ inputRange: [0,1], outputRange: [0.3, 0.8] });
  const shimmerTranslate = btnShimmer.interpolate({ inputRange: [0, 1], outputRange: [-W, W] });

  // ────────────────────────────────────────────────────────────────────────────
  const { bgUri, accentColor, bgKey, solarTimes } = useBgContext();
  const now = new Date();
  const hour = now.getHours() + now.getMinutes() / 60;
  const isNightReal = solarTimes ? (hour < solarTimes.sunrise || hour >= solarTimes.sunset) : (hour < 6 || hour >= 18);
  const stepBgKey = isNightReal ? 'naad_step_night' : 'naad_step';

  // Fixed premium ring colors — no time-based theme changes
  const ringHex = '#FFFFFF';
  const haloHex = '#FFFFFF';

  const sacred = getSacredHourInfo(hour, solarTimes);
  const isSunset = sacred.type === 'sunset';
  const isSunrise = sacred.type === 'sunrise';

  return (
    <ImageBackground
      source={{ uri: getBgSourceSync(stepBgKey as any) }}
      style={[{ flex: 1, backgroundColor: accentColor || BG_DARK }]}
      imageStyle={{ opacity: 1, resizeMode: 'cover' }}>
      <GlassPulseOverlay />
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />



      {/* Top nature glow */}
      <Animated.View
        style={[StyleSheet.absoluteFillObject, { opacity: glowOpacity, pointerEvents: 'none' }]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={['rgba(96,165,250,0.15)', 'transparent']}
          style={{ position: 'absolute', top: -80, left: -80, width: 380, height: 380, borderRadius: 190 }}
        />
        <LinearGradient
          colors={['rgba(59,130,246,0.12)', 'transparent']}
          style={{ position: 'absolute', top: 120, right: -60, width: 320, height: 320, borderRadius: 160 }}
        />
      </Animated.View>

      <ScrollView
        ref={walkScrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: getTabBarClearance(insets.bottom, !!playingId, stepBarActive),
        }}
      >
        {/* ── HEADER ────────────────────────────────────── */}
        <Animated.View style={{ opacity: cardFade, transform: [{ translateY: cardSlide }], marginBottom: 0 }}>
          <Animated.View style={{
            width: '100%',
            paddingHorizontal: 20,
            paddingTop: (Platform.OS === 'android' ? Math.max(insets.top, StatusBar.currentHeight ?? 0) : (insets.top ?? 44)),
            transform: [{ translateY: headerTopPad }],
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', width: '100%' }}>
              <View style={{ flex: 1 }} />
              <View style={{ alignItems: 'center' }}>
                <Text style={{
                  fontSize: 34,
                  fontWeight: '600',
                  color: '#FFF',
                  letterSpacing: 0.5,
                  fontFamily: 'DancingScript_600SemiBold',
                  textShadowColor: 'rgba(96,165,250,0.8)',
                  textShadowOffset: { width: 0, height: 2 },
                  textShadowRadius: 18,
                  textAlign: 'center',
                  marginBottom: 4,
                }}>
                  Vastu Yantra
                </Text>
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', letterSpacing: 1.5, fontWeight: '500', textTransform: 'uppercase' }}>
                  Sacred Space & Energy Scanner
                </Text>
              </View>
              <View style={{ flex: 1, alignItems: 'flex-end', paddingTop: 4 }}>
                <TouchableOpacity onPress={() => router.push('/garden' as never)} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                  <Ionicons name="leaf" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </Animated.View>


        {/* Vastu Scanner Toggle Button & Pills */}
        <Animated.View style={{ opacity: cardFade, transform: [{ translateY: cardSlide }], alignItems: 'center', marginBottom: 16, zIndex: 10 }}>
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setCompassActive(!compassActive); if(compassActive) setSelectedActivity(null); }}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 8,
              backgroundColor: compassActive ? 'rgba(192,132,252,0.15)' : 'rgba(0, 0, 0, 0.4)',
              borderWidth: 1, borderColor: compassActive ? 'rgba(192,132,252,0.4)' : 'rgba(255,255,255,0.2)',
              paddingHorizontal: 24, paddingVertical: 10,
              borderRadius: 30,
              overflow: 'hidden',
              shadowColor: compassActive ? '#c084fc' : '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 5,
            }}
            activeOpacity={0.7}
          >
            <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFillObject} />
            <Ionicons name={compassActive ? "scan-outline" : "finger-print-outline"} size={14} color={compassActive ? "#c084fc" : "#FFF"} />
            <Text style={{ fontSize: 11, fontWeight: '700', color: compassActive ? '#c084fc' : '#FFF', letterSpacing: 1.2, textTransform: 'uppercase' }}>
              {compassActive ? "Scanning Space..." : "Tap to Scan Space"}
            </Text>
          </TouchableOpacity>

          {compassActive && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 16, width: '100%' }} contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
              {(Object.keys(VASTU_DATA) as VastuActivity[]).map(act => (
                <TouchableOpacity
                  key={act}
                  onPress={() => { Haptics.selectionAsync(); setSelectedActivity(act); }}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    backgroundColor: selectedActivity === act ? `${VASTU_DATA[act].targetColor}30` : 'rgba(0,0,0,0.4)',
                    borderWidth: 1, borderColor: selectedActivity === act ? VASTU_DATA[act].targetColor : 'rgba(255,255,255,0.15)',
                    paddingHorizontal: 16, paddingVertical: 8,
                    borderRadius: 20,
                  }}
                >
                  <Text style={{ fontSize: 14 }}>{VASTU_DATA[act].icon}</Text>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: selectedActivity === act ? VASTU_DATA[act].targetColor : '#FFF', textTransform: 'uppercase', letterSpacing: 1 }}>{VASTU_DATA[act].label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </Animated.View>

        {/* ── NO SENSOR WARNING ───────────────────────────────────────────── */}
        {!isAvailable && (
          <View style={st.noSensorCard}>
            <Text style={st.noSensorEmoji}>📵</Text>
            <Text style={st.noSensorTitle}>No Step Sensor Found</Text>
            <Text style={st.noSensorSub}>This device doesn't have a hardware step counter. Step tracking is unavailable.</Text>
          </View>
        )}

        {/* ── RING + CENTRE ────────────────────────────────────────────────── */}
        {/* Ring wrapper: JS-driver opacity+margin outer, JS-driver scale inner — no mixing */}
        <Animated.View style={[st.ringWrapper, {
          opacity: cardFade,
          marginTop: ringMarginTop,
        }]}>
          <Animated.View style={{
            transform: [
              { scale: pulseAnim },
              { scale: ringScale },
            ],
          }}>
          <View style={{ width: RING_SIZE, height: RING_SIZE }}>

            {/* Inner zone - fixed premium frosted glass disc */}
            <View style={{
              position: 'absolute', top: 12, left: 12, width: RING_SIZE - 24, height: RING_SIZE - 24, borderRadius: (RING_SIZE - 24) / 2,
              overflow: 'hidden', borderWidth: 1, borderColor: `rgba(255,255,255,0.15)`
            }}>
              <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFillObject} />
              <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.3)' }]} />
              <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: pulseAnim.interpolate({ inputRange: [1, 1.02], outputRange: [0.3, 0.5] }) }]}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.05)', 'transparent']}
                  start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
                  style={StyleSheet.absoluteFillObject} />
              </Animated.View>
            </View>

            {/* ── ULTRA-PREMIUM SMART FITNESS RING — ALL FEATURES ──────────────── */}
            {/* Feature 4: Heartbeat long-press & Mandala touch PanResponder wrapper */}
            <View
              style={{ width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' }}
              {...mandalaPanResponder.panHandlers}
            >
              {/* Feature 4: Heartbeat ripple */}
              <Animated.View pointerEvents="none" style={{
                position: 'absolute', width: RING_SIZE, height: RING_SIZE,
                borderRadius: RING_SIZE / 2,
                borderWidth: 2, borderColor: 'rgba(56,189,248,0.7)',
                transform: [{ scale: rippleScaleHeart }],
                opacity: rippleOpHeart,
              }} />

              {/* Feature 5: Goal completion particles */}
              {particleAnims.map((p, i) => (
                <Animated.View key={i} pointerEvents="none" style={{
                  position: 'absolute',
                  width: 6, height: 6, borderRadius: 3,
                  backgroundColor: p.clr,
                  top: RING_SIZE / 2 - 3,
                  left: RING_SIZE / 2 - 3,
                  transform: [{ translateX: p.x }, { translateY: p.y }],
                  opacity: p.op,
                  shadowColor: p.clr, shadowOpacity: 0.8, shadowRadius: 4,
                }} />
              ))}

              {/* ── Layered aura — extremely slim and calming pulse glow ── */}
              {/* Feature 1: Gyroscope parallax on the inner glass disc */}
              <Animated.View style={{ position: 'absolute', width: RING_SIZE + 8, height: RING_SIZE + 8, borderRadius: (RING_SIZE + 8) / 2, backgroundColor: 'rgba(56,189,248,0.03)', transform: [{ scale: pulseAnim }], top: -4, left: -4 }} />
              <Animated.View style={{ position: 'absolute', width: RING_SIZE + 4, height: RING_SIZE + 4, borderRadius: (RING_SIZE + 4) / 2, backgroundColor: 'rgba(56,189,248,0.06)', transform: [{ scale: pulseAnim }], top: -2, left: -2 }} />
              <Animated.View style={{ position: 'absolute', width: RING_SIZE + 2, height: RING_SIZE + 2, borderRadius: (RING_SIZE + 2) / 2, backgroundColor: 'rgba(56,189,248,0.1)', transform: [{ scale: pulseAnim }], top: -1, left: -1 }} />

              {/* ── Inner zone — moonlit disk with gyro parallax ── */}
              {/* Outer stationary mask so it never breaks the ring boundary */}
              <View style={{
                position: 'absolute', width: RING_SIZE - RING_STROKE, height: RING_SIZE - RING_STROKE, borderRadius: (RING_SIZE - RING_STROKE) / 2,
                backgroundColor: 'rgba(56,189,248,0.08)',
                overflow: 'hidden',
              }}>
                {/* Inner animated content layer (slightly oversized to allow parallax without showing edges) */}
                <Animated.View style={{
                  position: 'absolute', top: -12, left: -12, right: -12, bottom: -12,
                  transform: [{ translateX: gyroX }, { translateY: gyroY }],
                }}>
                  {/* Feature 3: Environmental — golden hour tint */}
                  <LinearGradient
                    colors={(
                      isSunrise || isSunset
                        ? ['rgba(251,191,36,0.14)', 'rgba(251,146,60,0.08)', 'transparent']
                        : isRaining
                        ? ['rgba(147,197,253,0.18)', 'rgba(56,189,248,0.08)', 'transparent']
                        : ['rgba(186,230,253,0.15)', 'rgba(56,189,248,0.08)', 'transparent']
                    )}
                    start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
                    style={StyleSheet.absoluteFillObject} />

                  {/* Feature 3: Gentle inner breath glow (Theme based) */}
                  <Animated.View pointerEvents="none" style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: theme.glow,
                    opacity: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
                  }} />

                  {/* Hot weather: Heat wave shimmer overlay */}
                  {isHot && (
                    <Animated.View pointerEvents="none" style={{
                      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                      backgroundColor: 'rgba(239,68,68,0.1)', // Subtle red tint
                      opacity: heatAnim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.8] }),
                      transform: [{ scale: heatAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) }]
                    }} />
                  )}
                  
                  {/* Cold weather: Frost overlay */}
                  {isCold && (
                    <View pointerEvents="none" style={{
                      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                      borderWidth: 8, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 200,
                    }} />
                  )}

                  {/* ── Slim Compass — floats semi-transparently in the inner disc ── */}
                  {compassActive && (
                    <View pointerEvents="none" style={[
                      StyleSheet.absoluteFillObject,
                      { alignItems: 'center', justifyContent: 'center', opacity: 0.9 },
                    ]}>
                      <CompassRose size={RING_SIZE - RING_STROKE - 30} heading={compassAnim} selectedActivity={selectedActivity} />
                      <VastuScanner heading={compassAnim} selectedActivity={selectedActivity} />
                    </View>
                  )}

                  {/* Feature 3: Rain droplets inside the glass */}
                  {isRaining && rainAnims.map((ra: any, i: number) => (
                    <Animated.View key={i} pointerEvents="none" style={{
                      position: 'absolute',
                      left: ra.x, top: 0,
                      width: 1.5, height: 8,
                      borderRadius: 1,
                      backgroundColor: theme.outer, // Matches theme
                      opacity: ra.op,
                      transform: [{ translateY: ra.y }],
                    }} />
                  ))}

                </Animated.View>
              </View>

              {/* ── SVG Ring layers ── */}
              <Svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
                {/* Thin Track */}
                <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={R_OUTER} fill="none" stroke={theme.track} strokeWidth={0.5} />
                {/* Wide outer glow */}
                <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={R_OUTER} fill="none" stroke={theme.inner} strokeWidth={3} strokeLinecap="round" strokeDasharray={CIRCUMF} strokeDashoffset={CIRCUMF * (1 - (stats.goalPercent / 100))} transform={`rotate(-90, ${RING_SIZE / 2}, ${RING_SIZE / 2})`} opacity={0.2} />
                {/* Mid halo */}
                <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={R_OUTER} fill="none" stroke={theme.mid} strokeWidth={1.5} strokeLinecap="round" strokeDasharray={CIRCUMF} strokeDashoffset={CIRCUMF * (1 - (stats.goalPercent / 100))} transform={`rotate(-90, ${RING_SIZE / 2}, ${RING_SIZE / 2})`} opacity={0.5} />
                {/* Main crisp arc */}
                <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={R_OUTER} fill="none" stroke={theme.inner} strokeWidth={0.8} strokeLinecap="round" strokeDasharray={CIRCUMF} strokeDashoffset={CIRCUMF * (1 - (stats.goalPercent / 100))} transform={`rotate(-90, ${RING_SIZE / 2}, ${RING_SIZE / 2})`} opacity={1} />
                {/* Inner shimmer sliver */}
                <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={R_OUTER} fill="none" stroke={theme.outer} strokeWidth={0.5} strokeLinecap="round" strokeDasharray={CIRCUMF} strokeDashoffset={CIRCUMF * (1 - (stats.goalPercent / 100))} transform={`rotate(-90, ${RING_SIZE / 2}, ${RING_SIZE / 2})`} opacity={0.85} />

                {/* ── Feature 8: Inner Weekly Intention Ring ── */}
                {summary && summary.weeklyGoal > 0 && (
                  <>
                    <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={R_INNER} fill="none" stroke={theme.track} strokeWidth={2} />
                    <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={R_INNER} fill="none" stroke={theme.mid} strokeWidth={3} strokeLinecap="round" strokeDasharray={CIRCUMF_INNER} strokeDashoffset={CIRCUMF_INNER * (1 - (Math.min(100, summary.weeklyGoalPercent) / 100))} transform={`rotate(-90, ${RING_SIZE / 2}, ${RING_SIZE / 2})`} opacity={0.9} />
                  </>
                )}

                {/* Feature 2: Liquid leading-edge droplet */}
                {stats.goalPercent > 0 && stats.goalPercent < 100 && (() => {
                  const angle = (stats.goalPercent / 100) * 360 - 90;
                  const rad = angle * Math.PI / 180;
                  const cx = RING_SIZE / 2 + R_OUTER * Math.cos(rad);
                  const cy = RING_SIZE / 2 + R_OUTER * Math.sin(rad);
                  return (
                    <>
                      <Circle cx={cx} cy={cy} r={7} fill={theme.liquid[0]} opacity={0.25} />
                      <Circle cx={cx} cy={cy} r={4} fill={theme.liquid[1]} opacity={0.7} />
                      <Circle cx={cx} cy={cy} r={2} fill={theme.liquid[2]} opacity={0.95} />
                    </>
                  );
                })()}
              </Svg>
            </View>

            {/* Centre content — all data inside the ring */}
            <View style={st.ringCentre}>

              {(isSunset || isSunrise) ? (
                <View style={{ alignItems: 'center', paddingHorizontal: 4 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff', textAlign: 'center', letterSpacing: 0.5, marginBottom: 4, textTransform: 'uppercase' }}>
                    {isSunset ? 'Sunset · Meditate Now' : 'Sunrise · Meditate Now'}
                  </Text>
                  <Text style={{ fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>Connect with the divinity</Text>
                </View>
              ) : (
                <>
                  {/* ─ Top: Weather chip ─ */}
                  {weather ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.35)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, marginBottom: 4, borderWidth: 1, borderColor: 'rgba(56,189,248,0.25)' }}>
                      <Text style={{ fontSize: 13 }}>{weather.emoji}</Text>
                      <Text style={{ fontSize: 9, fontWeight: '800', color: 'rgba(255,255,255,0.9)', marginLeft: 5, textTransform: 'uppercase', letterSpacing: 0.7 }}>
                        {weather.temp}° {weather.condition}
                      </Text>
                    </View>
                  ) : <View style={{ height: 22, marginBottom: 4 }} />}

                  {/* Data hidden to focus on pure spirituality & rhythm */}

                  {/* ─ Mindful quote ─ */}
                  <Animated.Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', fontStyle: 'italic', marginTop: 4, letterSpacing: 0.5, textAlign: 'center', opacity: quoteOpacity, paddingHorizontal: 12 }}>
                    {QUOTES[quoteIdx]}
                  </Animated.Text>

                  {/* ─ Divider ─ */}
                  <View style={{ width: 60, height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginTop: 8, marginBottom: 12 }} />
                </>
              )}
            </View>

            {/* ── Living Mandala — always spinning sacred geometry ── */}
            {/* Layer 1: Slow outer rotation (24 petals dodecagram) */}
            <Animated.View pointerEvents="none" style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              alignItems: 'center', justifyContent: 'center',
              transform: [{ rotate: rot1.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
            }}>
              <Svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
                {/* Outer dashed ring */}
                <Circle cx={RING_SIZE/2} cy={RING_SIZE/2} r={96} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={1} strokeDasharray="3 9" />
                {/* 12-petal outer ring */}
                {[0,30,60,90,120,150,180,210,240,270,300,330].map(deg => {
                  const a = deg * Math.PI / 180;
                  const px = RING_SIZE/2 + 80 * Math.sin(a);
                  const py = RING_SIZE/2 - 80 * Math.cos(a);
                  return <Circle key={deg} cx={px} cy={py} r={3} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={0.8} />;
                })}
                {/* Outer star lines */}
                {[0,60,120].map(deg => {
                  const a1 = deg * Math.PI / 180;
                  const a2 = (deg + 180) * Math.PI / 180;
                  return <Line key={deg}
                    x1={RING_SIZE/2 + 88 * Math.sin(a1)} y1={RING_SIZE/2 - 88 * Math.cos(a1)}
                    x2={RING_SIZE/2 + 88 * Math.sin(a2)} y2={RING_SIZE/2 - 88 * Math.cos(a2)}
                    stroke="rgba(255,255,255,0.04)" strokeWidth={0.8} />;
                })}
              </Svg>
            </Animated.View>

            {/* Layer 2: Reverse medium rotation (Star of David + inner hex) */}
            <Animated.View pointerEvents="none" style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              alignItems: 'center', justifyContent: 'center',
              transform: [{ rotate: rot2.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] }) }],
            }}>
              <Svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
                <Circle cx={RING_SIZE/2} cy={RING_SIZE/2} r={66} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={0.8} />
                {/* Inner triangles Star of David */}
                <Path
                  d={`M${RING_SIZE/2} ${RING_SIZE/2-55} L${RING_SIZE/2+47.6} ${RING_SIZE/2+27.5} L${RING_SIZE/2-47.6} ${RING_SIZE/2+27.5} Z`}
                  fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth={0.9}
                />
                <Path
                  d={`M${RING_SIZE/2} ${RING_SIZE/2+55} L${RING_SIZE/2+47.6} ${RING_SIZE/2-27.5} L${RING_SIZE/2-47.6} ${RING_SIZE/2-27.5} Z`}
                  fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth={0.9}
                />
                {/* 6 dots at hexagon vertices */}
                {[0,60,120,180,240,300].map(deg => {
                  const a = deg * Math.PI / 180;
                  return <Circle key={deg}
                    cx={RING_SIZE/2 + 55 * Math.sin(a)}
                    cy={RING_SIZE/2 - 55 * Math.cos(a)}
                    r={2} fill="rgba(255,255,255,0.12)" />;
                })}
              </Svg>
            </Animated.View>

            {/* Layer 3: Fast inner rotation (inner sacred circle + dot ring) */}
            <Animated.View pointerEvents="none" style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              alignItems: 'center', justifyContent: 'center',
              transform: [{ rotate: rot3.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
            }}>
              <Svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
                <Circle cx={RING_SIZE/2} cy={RING_SIZE/2} r={34} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={0.7} strokeDasharray="2 6" />
                {/* 8 micro-dots inner ring */}
                {[0,45,90,135,180,225,270,315].map(deg => {
                  const a = deg * Math.PI / 180;
                  return <Circle key={deg}
                    cx={RING_SIZE/2 + 34 * Math.sin(a)}
                    cy={RING_SIZE/2 - 34 * Math.cos(a)}
                    r={1.5} fill="rgba(255,255,255,0.15)" />;
                })}
                {/* Innermost sacred dot */}
                <Circle cx={RING_SIZE/2} cy={RING_SIZE/2} r={4} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={0.8} />
              </Svg>
            </Animated.View>

            {/* Draggable rotation layer — user spins this */}
            <Animated.View pointerEvents="none" style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              alignItems: 'center', justifyContent: 'center',
              transform: [{ rotate: mandalaRot.interpolate({ inputRange: [-360, 360], outputRange: ['-360deg', '360deg'] }) }, { scale: mandalaScale }]
            }}>
              <Svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
                {stats.goalPercent >= 25 && (
                  <Path d={`M${RING_SIZE/2} ${RING_SIZE/2-50} L${RING_SIZE/2+43} ${RING_SIZE/2+25} L${RING_SIZE/2-43} ${RING_SIZE/2+25} Z`}
                    fill="none" stroke="rgba(255,255,255,0.13)" strokeWidth={1.2} />
                )}
                {stats.goalPercent >= 50 && (
                  <Path d={`M${RING_SIZE/2} ${RING_SIZE/2+50} L${RING_SIZE/2+43} ${RING_SIZE/2-25} L${RING_SIZE/2-43} ${RING_SIZE/2-25} Z`}
                    fill="none" stroke="rgba(255,255,255,0.13)" strokeWidth={1.2} />
                )}
                {stats.goalPercent >= 75 && (
                  <Circle cx={RING_SIZE/2} cy={RING_SIZE/2} r={22} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={0.8} />
                )}
                {stats.goalPercent >= 100 && (
                  <Circle cx={RING_SIZE/2} cy={RING_SIZE/2} r={6} fill="rgba(255,255,255,0.35)" />
                )}
              </Svg>
            </Animated.View>
          </View>
          </Animated.View>





        </Animated.View>

        {/* ── BOTTOM UI (HIDDEN IN BOWL MODE) ── */}
        <Animated.View style={{ opacity: bowlOpacity }} pointerEvents={isBowlMode ? 'none' : 'auto'}>
          {/* ── ULTRA-SMART BUTTONS ───────────────────────────────── */}
          <Animated.View style={{
            opacity: cardFade,
            transform: [{ translateY: cardSlide }],
            paddingHorizontal: 32,
            gap: 10,
            marginTop: btnMarginTop,
            marginBottom: btnMarginBot,
          }}>
            
            {/* Action Buttons Column */}
            <View style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10, width: '100%' }}>
              {/* Start Nature Walk Button */}
              <TouchableOpacity
                onPress={() => launchSession(sessionType)}
                activeOpacity={0.82}
                style={{ borderRadius: 99, overflow: 'hidden', shadowColor: '#38bdf8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 8, backgroundColor: 'rgba(255,255,255,0.75)' }}
              >
              <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFillObject} />
              <LinearGradient
                colors={['rgba(255, 255, 255, 0.9)', 'rgba(255, 255, 255, 0.6)']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
              >
                <View style={{ position: 'absolute', inset: 0, borderRadius: 99, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 1)' }} />
                
                {/* Top shine */}
                <LinearGradient
                  colors={['rgba(255,255,255,0.8)', 'transparent']}
                  start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.5 }}
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 16, borderTopLeftRadius: 99, borderTopRightRadius: 99 }}
                />
                
                {/* Animated shimmer sweep */}
                <Animated.View
                  style={{
                    position: 'absolute', top: 0, bottom: 0, width: 70,
                    transform: [{ translateX: shimmerTranslate }],
                  }}
                  pointerEvents="none"
                >
                  <LinearGradient
                    colors={['transparent', 'rgba(255,255,255,0.8)', 'transparent']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={{ flex: 1 }}
                  />
                </Animated.View>
                
                <View style={{ height: 40, justifyContent: 'center', paddingHorizontal: 4 }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#0369a1', letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center' }} numberOfLines={1} adjustsFontSizeToFit>
                    {sessionTitle}
                  </Text>
                </View>
              </LinearGradient>
              </TouchableOpacity>

              {/* Orbit Pulse Game Launch Button (Compact) */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setShowOrbitGame(true);
                }}
                style={{ overflow: 'hidden', borderRadius: 99, shadowColor: '#ea580c', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 8 }}
              >
                <LinearGradient
                  colors={['rgba(249,115,22,0.85)', 'rgba(194,65,12,0.8)']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={{
                    alignItems: 'center', justifyContent: 'center',
                    flexDirection: 'row', gap: 4,
                    paddingHorizontal: 12, height: 40,
                    borderRadius: 99,
                    borderWidth: 1, borderColor: 'rgba(251,146,60,0.5)',
                  }}
                >
                  <Text style={{ fontSize: 14 }}>🌀</Text>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#FFF', letterSpacing: 0.5 }} numberOfLines={1} adjustsFontSizeToFit>AURA FLOW</Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* Energize Launch Button */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setEnergizeModalVisible(true);
                }}
                style={{ overflow: 'hidden', borderRadius: 99, shadowColor: '#f472b6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 8 }}
              >
                <LinearGradient
                  colors={['rgba(244,114,182,0.85)', 'rgba(219,39,119,0.8)']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={{
                    alignItems: 'center', justifyContent: 'center',
                    flexDirection: 'row', gap: 4,
                    paddingHorizontal: 12, height: 40,
                    borderRadius: 99,
                    borderWidth: 1, borderColor: 'rgba(249,168,212,0.5)',
                  }}
                >
                  <Text style={{ fontSize: 14 }}>⚡</Text>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#FFF', letterSpacing: 0.5 }} numberOfLines={1} adjustsFontSizeToFit>ENERGIZE</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Intentions removed */}

        </Animated.View>

        </Animated.View>

      </ScrollView>

      {/* ── GOAL MODAL ──────────────────────────────────────────────────────── */}
      <GoalModal
        visible={showGoalModal}
        currentWeekly={summary?.weeklyGoal ?? 35000}
        onClose={() => setShowGoalModal(false)}
        accentColor={ringHex}
        onSave={async (w) => {
          await StepCounter.setWeeklyGoal(w);
          setShowGoalModal(false);
          await refreshStats();
        }}
      />

      <OnboardingModal 
        visible={showOnboarding}
        onContinue={() => {
          setShowOnboarding(false);
          setShowGoalModal(true);
        }}
      />

      {/* ── Orbit Pulse Sacred Rhythm Game ── */}
      <OrbitPulseGame
        visible={showOrbitGame}
        onClose={() => setShowOrbitGame(false)}
      />

      <EnergizeModal
        visible={energizeModalVisible}
        onClose={() => setEnergizeModalVisible(false)}
      />
    </ImageBackground>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Goal modal
// ─────────────────────────────────────────────────────────────────────────────
function GoalModal({
  visible, currentWeekly, onClose, onSave, accentColor
}: {
  visible: boolean; currentWeekly: number; onClose: () => void; onSave: (w: number) => void; accentColor: string;
}) {
  const PRESETS_WEEKLY = [
    { value: 21000, label: 'Foundation' },
    { value: 35000, label: 'Balance' },
    { value: 50000, label: 'Momentum' },
    { value: 70000, label: 'Mastery' }
  ];
  const [selectedWeekly, setSelectedWeekly] = useState(currentWeekly);

  useEffect(() => { 
    if (visible) setSelectedWeekly(currentWeekly);
  }, [visible, currentWeekly]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={gm.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View style={gm.sheet}>
          <LinearGradient colors={['rgba(20,10,50,0.98)', 'rgba(8,8,20,0.99)']} style={StyleSheet.absoluteFillObject} />
          <LinearGradient
            colors={['rgba(255,255,255,0.08)', 'transparent']}
            start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.4 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 60, borderTopLeftRadius: 28, borderTopRightRadius: 28 }}
          />
          <LinearGradient
            colors={[`${accentColor}80`, `${accentColor}30`, `${accentColor}80`]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, borderTopLeftRadius: 28, borderTopRightRadius: 28 }}
          />
          <View style={gm.handle} />
          
          <Text style={gm.title}>Prepare Your Walk</Text>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, textAlign: 'center', marginTop: 8, marginBottom: 24, paddingHorizontal: 20 }}>
            Just walk and watch the Sacred Mandala evolve on your screen as you hit your weekly habit goal.
          </Text>

          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12, textAlign: 'center' }}>Weekly Background Steps</Text>

          <View style={gm.presets}>
            {PRESETS_WEEKLY.map(p => {
              const isSel = (selectedWeekly === p.value);
              return (
                <TouchableOpacity
                  key={p.value}
                  onPress={() => { Haptics.selectionAsync(); setSelectedWeekly(p.value); }}
                  style={[gm.preset, { minWidth: '45%' }, isSel && { backgroundColor: `${accentColor}30`, borderColor: accentColor }]}
                >
                  {isSel && (
                    <LinearGradient
                      colors={[`${accentColor}25`, 'transparent']}
                      style={StyleSheet.absoluteFillObject}
                    />
                  )}
                  <Text style={[gm.presetTxt, isSel && { color: accentColor }]}>
                    {p.value.toLocaleString()}
                  </Text>
                  <Text style={[{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 4, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 }, isSel && { color: `${accentColor}CC` }]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={{ marginBottom: 28 }}>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, textAlign: 'center' }}>Or enter custom intention</Text>
            <TextInput
              style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 20, color: '#fff', fontSize: 24, fontWeight: '800', textAlign: 'center', borderWidth: 1, borderColor: `${accentColor}50` }}
              keyboardType="number-pad"
              value={String(selectedWeekly)}
              onChangeText={t => {
                const num = parseInt(t.replace(/[^0-9]/g, ''), 10) || 0;
                setSelectedWeekly(num);
              }}
              selectionColor={accentColor}
            />
          </View>

          <TouchableOpacity
            style={{ borderRadius: 24, overflow: 'hidden', marginBottom: 10, shadowColor: '#00F2FE', shadowOpacity: 0.5, shadowRadius: 15, elevation: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' }}
            onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); onSave(selectedWeekly); }}
          >
            <LinearGradient
              colors={['#0052D4', '#2AB0FE', '#00F2FE']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ paddingVertical: 18, alignItems: 'center' }}
            >
              <LinearGradient
                colors={['rgba(255,255,255,0.5)', 'transparent']}
                start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '50%', borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
              />
              <Text style={[gm.saveTxt, { textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }]}>SET INTENTION</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={{ paddingVertical: 12 }}>
            <Text style={{ color: 'rgba(255,255,255,0.35)', textAlign: 'center', fontSize: 14, fontWeight: '500' }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const BORDER_MOD = 'rgba(255,255,255,0.10)';
const CARD_MOD   = 'rgba(255,255,255,0.06)';

const gm = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(8,47,73,0.78)' },
  sheet:   { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 42, overflow: 'hidden' },
  handle:  { width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  title:   { fontSize: 20, fontWeight: '800', color: '#fff', textAlign: 'center' },
  tabs:    { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 4, marginVertical: 16, marginHorizontal: 20 },
  tabBtn:  { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabBtnActive: { backgroundColor: 'rgba(96,165,250,0.2)' },
  tabTxt:  { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
  tabTxtActive: { color: ACCENT, fontWeight: '800' },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28, justifyContent: 'center' },
  preset:  { flex: 1, minWidth: '28%', paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: BORDER_MOD, backgroundColor: CARD_MOD, alignItems: 'center', overflow: 'hidden' },
  presetTxt: { color: 'rgba(255,255,255,0.75)', fontWeight: '700', fontSize: 15 },
  saveBtn: { borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 8 },
  saveTxt: { color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 0.5 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  noSensorCard: {
    margin: 20, padding: 24, borderRadius: 20, backgroundColor: 'rgba(12,74,110,0.4)',
    borderWidth: 1, borderColor: 'rgba(56,189,248,0.2)', alignItems: 'center', gap: 8,
  },
  noSensorEmoji: { fontSize: 36 },
  noSensorTitle: { fontSize: 16, fontWeight: '800', color: '#fff' },
  noSensorSub:   { fontSize: 13, color: 'rgba(255,255,255,0.45)', textAlign: 'center', lineHeight: 18 },

  ringWrapper: {
    alignSelf: 'center',
    width:  RING_SIZE + 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  ringCentre: {
    position: 'absolute',
    top: 0, left: 0,
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  ringSteps:   { fontSize: 52, fontWeight: '200', fontVariant: ['tabular-nums'], color: '#ffffff', letterSpacing: -1.5, textShadowColor: 'rgba(255,255,255,0.4)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 15 },
  ringLabel:   { fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: '800', letterSpacing: 2.2, marginTop: -2 },
  ringDivider: { width: 60, height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 4 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Onboarding Modal
// ─────────────────────────────────────────────────────────────────────────────
function OnboardingModal({ visible, onContinue }: { visible: boolean; onContinue: () => void }) {
  if (!visible) return null;
  return (
    <Modal transparent visible={visible} animationType="fade">
      <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFillObject} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <View style={{ width: '100%', maxWidth: 360, backgroundColor: 'rgba(20,20,30,0.85)', borderRadius: 32, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.5, shadowRadius: 30, elevation: 15 }}>
          <LinearGradient colors={['rgba(255,255,255,0.12)', 'transparent']} start={{x:0.5, y:0}} end={{x:0.5, y:0.4}} style={StyleSheet.absoluteFillObject} />
          
          <View style={{ padding: 32, alignItems: 'center' }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(56,189,248,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 20, borderWidth: 1, borderColor: 'rgba(56,189,248,0.3)' }}>
              <Ionicons name="leaf" size={28} color="#38bdf8" />
            </View>
            
            <Text style={{ fontSize: 22, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 12, letterSpacing: 0.5 }}>Plant a Seed & Set Intentions</Text>
            <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 22, marginBottom: 32 }}>
              Before you start your nature walk, set your micro-goal by planting a seed, and establish your weekly habit intention.
            </Text>
            
            <TouchableOpacity onPress={onContinue} activeOpacity={0.8} style={{ width: '100%', borderRadius: 24, overflow: 'hidden', shadowColor: '#38bdf8', shadowOffset: {width:0, height:4}, shadowOpacity:0.3, shadowRadius: 8 }}>
              <LinearGradient colors={['#38bdf8', '#0284c7']} style={{ paddingVertical: 16, alignItems: 'center' }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: '#fff', textTransform: 'uppercase', letterSpacing: 1.2 }}>Set Intentions</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Energize Modal
// ─────────────────────────────────────────────────────────────────────────────
function EnergizeModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  const playEnergy = async (id: string, uri: string) => {
    try {
      if (playingId === id) {
        if (soundRef.current) {
          await soundRef.current.stopAsync();
          await soundRef.current.unloadAsync();
          soundRef.current = null;
        }
        setPlayingId(null);
        return;
      }
      
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      }
      
      const { sound } = await Audio.Sound.createAsync(
        { uri }, 
        { shouldPlay: true, positionMillis: id === 'male' ? 5000 : 0 }
      );
      soundRef.current = sound;
      setPlayingId(id);
      
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlayingId(null);
          soundRef.current = null;
        }
      });
    } catch (e) {
      console.log('Audio error:', e);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableOpacity activeOpacity={1} style={{ flex: 1, justifyContent: 'flex-end' }} onPress={onClose}>
        <TouchableOpacity activeOpacity={1}>
          <BlurView intensity={70} tint="dark" style={{ borderTopLeftRadius: 40, borderTopRightRadius: 40, padding: 32, paddingBottom: 50, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(5, 8, 18, 0.5)' }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', alignSelf: 'center', marginBottom: 24 }} />
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 24, fontWeight: '800', color: '#fff', letterSpacing: 1 }}>Energize</Text>
              <TouchableOpacity onPress={onClose} style={{ padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20 }}>
                <Ionicons name="close" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 32, lineHeight: 20 }}>
              Select a cosmic frequency to recharge. You can close this panel to meditate on the Yantra while listening.
            </Text>

            {/* Universal Male Energy */}
            <TouchableOpacity 
              activeOpacity={0.8}
              onPress={() => playEnergy('male', 'https://pub-0d083e39b57f47e8b2398292a67eef84.r2.dev/Meditations/YTMP3GG_YouTube_VISHNU-SAHASRANAMAM-Madhubanti-Bagchi-_-_Media_7uOgqaPhZ8g_009_128k.mp3')}
              style={{ 
                width: '100%', padding: 20, borderRadius: 24, marginBottom: 16,
                backgroundColor: playingId === 'male' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.05)', 
                borderWidth: 1, borderColor: playingId === 'male' ? '#38bdf8' : 'rgba(255, 255, 255, 0.1)',
                alignItems: 'center', flexDirection: 'row',
              }}
            >
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: playingId === 'male' ? '#0284c7' : 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                <Ionicons name={playingId === 'male' ? "pause" : "play"} size={22} color="#fff" style={{ marginLeft: playingId === 'male' ? 0 : 2 }} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: playingId === 'male' ? '#38bdf8' : '#fff', letterSpacing: 0.5, marginBottom: 4 }}>
                  Universal Male Energy
                </Text>
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: '500' }}>
                  Vishnu Sahasranama • Grounding
                </Text>
              </View>
            </TouchableOpacity>

            {/* Universal Female Energy */}
            <TouchableOpacity 
              activeOpacity={0.8}
              onPress={() => playEnergy('female', 'https://ik.imagekit.io/rcsesr4xf/Lalitha-Sahasranamam.mp3')}
              style={{ 
                width: '100%', padding: 20, borderRadius: 24, 
                backgroundColor: playingId === 'female' ? 'rgba(244, 114, 182, 0.15)' : 'rgba(255, 255, 255, 0.05)', 
                borderWidth: 1, borderColor: playingId === 'female' ? '#f472b6' : 'rgba(255, 255, 255, 0.1)',
                alignItems: 'center', flexDirection: 'row',
              }}
            >
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: playingId === 'female' ? '#be185d' : 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                <Ionicons name={playingId === 'female' ? "pause" : "play"} size={22} color="#fff" style={{ marginLeft: playingId === 'female' ? 0 : 2 }} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: playingId === 'female' ? '#f472b6' : '#fff', letterSpacing: 0.5, marginBottom: 4 }}>
                  Universal Female Energy
                </Text>
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: '500' }}>
                  Lalitha Sahasranama • Vitality
                </Text>
              </View>
            </TouchableOpacity>
          </BlurView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
