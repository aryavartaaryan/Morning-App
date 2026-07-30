/**
 * step-session.tsx — Live Walk Session Screen
 * ─────────────────────────────────────────────────────────────────────────────
 * Ultra-premium frosted glass live activity tracker.
 * - Full frosted glass design — feels like iOS Live Activity
 * - Premium solid frosted ring disc (not transparent)
 * - Live step count with spring animation
 * - Circular progress arc (multi-layer premium SVG)
 * - Live distance / time / pace metric cards (glassmorphic)
 * - Pause and End buttons (premium frosted)
 * - Exit modal and confetti celebration
 */

import React, {
  useState, useEffect, useRef, useCallback,
} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Dimensions,
  Animated,
  Easing,
  BackHandler,
  Alert,
  ToastAndroid,
  Platform,
  ImageBackground,
  Modal,
  PanResponder,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Line, G, Path, Text as SvgText } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { DeviceEventEmitter } from 'react-native';

import StepCounter, { type SessionType } from '@/src/modules/StepCounter';
import { useSoundPlayer } from '@/lib/soundPlayerContext';
import SoundLibraryModal from '@/components/SoundLibraryModal';
import { ALL_SOUNDS_LIST } from '@/app/(tabs)/sleep';
import { useBgContext } from '@/lib/bgContext';
import { getBgSourceSync } from '@/lib/bgImages';
import { DARK_BG_KEYS } from '@/lib/cardTheme';
import { getSolarRingPalette } from '@/lib/solarRingPalette';
import { fetchWeather } from '@/lib/weather';

// ── Sensors (optional — gracefully degrade if unavailable) ────────────────────
let Gyroscope: any = null;
let Accelerometer: any = null;
let Magnetometer: any = null;
try { Gyroscope = require('expo-sensors').Gyroscope; } catch (_) {}
try { Accelerometer = require('expo-sensors').Accelerometer; } catch (_) {}
try { Magnetometer = require('expo-sensors').Magnetometer; } catch (_) {}

const { width: W, height: H } = Dimensions.get('window');
const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ── Design tokens ─────────────────────────────────────────────────────────────
const BG = '#070710';

// ── Ring geometry ─────────────────────────────────────────────────────────────
const RING_SZ = 260; // Larger for live activity feel to fit everything inside
const STROKE  = 14;
const R       = (RING_SZ - STROKE) / 2;
const CIRCUM  = 2 * Math.PI * R;

// ── Session meta ──────────────────────────────────────────────────────────────
const SESSION_META: Record<
  SessionType,
  { label: string; emoji: string; color: string; goal: number; bgTop: string; gradA: string; gradB: string }
> = {
  morning:  { label: 'Morning Walk',   emoji: '🌅', color: '#38bdf8', goal: 3000, bgTop: '#081a29', gradA: '#38bdf8', gradB: '#0ea5e9' },
  evening:  { label: 'Evening Walk',   emoji: '🌆', color: '#F472B6', goal: 3000, bgTop: '#1A0A12', gradA: '#F472B6', gradB: '#A78BFA' },
  postmeal: { label: 'Post-meal Walk', emoji: '🍽️', color: '#FB923C', goal: 100,  bgTop: '#1A0E08', gradA: '#FB923C', gradB: '#FCD34D' },
};

const QUOTES = [
  "Breathe in the morning, exhale the past...",
  "Your rhythm is the rhythm of nature...",
  "Every step is a new beginning...",
  "Walk as if you are kissing the Earth with your feet...",
  "Quiet the mind, and the soul will speak...",
  "Let the sky reflect your limitless potential..."
];

function getSeedColors(type: string) {
  if (type === 'pebble') return { base: 'rgba(52,211,153,0.2)', solid: '#34d399', stroke: 'rgba(52,211,153,0.8)', leaf: 'rgba(52,211,153,0.6)', bloom: '#d1fae5' };
  if (type === 'epic') return { base: 'rgba(192,132,252,0.2)', solid: '#c084fc', stroke: 'rgba(192,132,252,0.8)', leaf: 'rgba(192,132,252,0.6)', bloom: '#f3e8ff' };
  if (type === 'calm') return { base: 'rgba(56,189,248,0.2)', solid: '#38bdf8', stroke: 'rgba(56,189,248,0.8)', leaf: 'rgba(56,189,248,0.6)', bloom: '#e0f2fe' };
  return { base: 'rgba(251,146,60,0.2)', solid: '#fb923c', stroke: 'rgba(251,146,60,0.8)', leaf: 'rgba(251,146,60,0.6)', bloom: '#ffedd5' };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// ─── Modern HUD Navigator Compass ────────────────────────────────────────────
function CompassRose({ size, heading }: { size: number; heading: Animated.Value }) {
  const cx = 50, cy = 50;

  // Smarter 72 ticks (navigation zone style)
  const ticks: React.JSX.Element[] = [];
  for (let i = 0; i < 72; i++) {
    const deg = i * 5;
    const angle = deg * Math.PI / 180;
    const isMajor  = deg % 90 === 0;
    const isMedium = deg % 45 === 0;
    
    // Make ticks subtle dots or short crisp lines
    const r1 = 48;
    const r2 = isMajor ? 41 : isMedium ? 44 : 46.5; // much shorter minor ticks
    const x1 = cx + r1 * Math.sin(angle);
    const y1 = cy - r1 * Math.cos(angle);
    const x2 = cx + r2 * Math.sin(angle);
    const y2 = cy - r2 * Math.cos(angle);
    ticks.push(
      <Line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={isMajor ? '#f87171' : isMedium ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.2)'}
        strokeWidth={isMajor ? 2 : isMedium ? 1.5 : 0.8}
        strokeLinecap="round" />
    );
  }

  const cardinals = [
    { label: 'N', deg: 0,   color: '#f87171', fs: '8' },
    { label: 'E', deg: 90,  color: 'rgba(255,255,255,0.8)', fs: '6' },
    { label: 'S', deg: 180, color: 'rgba(255,255,255,0.5)', fs: '6' },
    { label: 'W', deg: 270, color: 'rgba(255,255,255,0.8)', fs: '6' },
  ];
  const cardinalEls = cardinals.map(({ label, deg: d, color, fs }) => {
    const rad = d * Math.PI / 180;
    const x = cx + 33 * Math.sin(rad);
    const y = cy - 33 * Math.cos(rad);
    return (
      <SvgText key={label} x={x} y={y} fill={color} fontSize={fs}
        fontWeight="800" textAnchor="middle" alignmentBaseline="middle">
        {label}
      </SvgText>
    );
  });

  return (
    <View pointerEvents="none" style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* ── ROTATING RING ── */}
      <Animated.View style={{ position: 'absolute', transform: [{ rotate: heading.interpolate({ inputRange: [-360, 0, 360], outputRange: ['360deg', '0deg', '-360deg'] }) }], width: size, height: size }}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Circle cx={cx} cy={cy} r={49.5} fill="rgba(3,8,20,0.85)" />
          <Circle cx={cx} cy={cy} r={49} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={0.8} />
          {ticks}
          {/* Inner ring to contain the navigation zone */}
          <Circle cx={cx} cy={cy} r={28} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={0.5} strokeDasharray="2 4" />
          {cardinalEls}
          {/* N pointer tick (extra long) */}
          <Path d={`M${cx} ${cy-25} L${cx-3.5} ${cy+5} L${cx+3.5} ${cy+5} Z`} fill="rgba(248,113,113,0.85)" />
          {/* S needle */}
          <Path d={`M${cx} ${cy+25} L${cx-3.5} ${cy-5} L${cx+3.5} ${cy-5} Z`} fill="rgba(255,255,255,0.15)" />
          <Circle cx={cx} cy={cy} r={3} fill="rgba(255,255,255,0.8)" />
        </Svg>
      </Animated.View>

      {/* ── FIXED RETICLE ── */}
      <View style={{ position: 'absolute', width: size, height: size }}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Path d={`M${cx} ${cy-47} L${cx-3} ${cy-42} L${cx+3} ${cy-42} Z`} fill="rgba(248,113,113,1)" />
        </Svg>
      </View>
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

// MemoRing — fully featured with all 7 enhancements
const MemoRing = React.memo(({ RING_SZ, R, STROKE, CIRCUM, pct, progressAnim, pulseAnim, glowAnim, gyroX, gyroY, isRaining, isSunrise, isSunset, rainAnims, compassActive, compassAnim, liquidPulse, heartbeatIntervalRef, rippleScaleHeart, rippleOpHeart, theme, isHot, isCold }: any) => {
  
  // Heat wave animation
  const heatAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (isHot) {
      Animated.loop(Animated.sequence([
        Animated.timing(heatAnim, { toValue: 1, duration: 4000, useNativeDriver: true }),
        Animated.timing(heatAnim, { toValue: 0, duration: 4000, useNativeDriver: true })
      ])).start();
    }
  }, [isHot]);
  
  // Continuous Active Radar Spin
  const spinAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 12000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [spinAnim]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });
  return (
    <View
      style={{ width: RING_SZ, height: RING_SZ, alignItems: 'center', justifyContent: 'center' }}
      {...PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
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
        onPanResponderRelease:   () => { if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current); },
        onPanResponderTerminate: () => { if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current); },
      }).panHandlers}
    >
      {/* Feature 4: Heartbeat ripple */}
      <Animated.View pointerEvents="none" style={{
        position: 'absolute', width: RING_SZ, height: RING_SZ, borderRadius: RING_SZ / 2,
        borderWidth: 2, borderColor: 'rgba(56,189,248,0.7)',
        transform: [{ scale: rippleScaleHeart }], opacity: rippleOpHeart,
      }} />

      {/* Layered aura pulse glow */}
      <Animated.View style={{ position: 'absolute', width: RING_SZ + 24, height: RING_SZ + 24, borderRadius: (RING_SZ + 24) / 2, backgroundColor: 'rgba(56,189,248,0.06)', transform: [{ scale: pulseAnim }], top: -12, left: -12 }} />
      <Animated.View style={{ position: 'absolute', width: RING_SZ + 14, height: RING_SZ + 14, borderRadius: (RING_SZ + 14) / 2, backgroundColor: 'rgba(56,189,248,0.14)', transform: [{ scale: pulseAnim }], top: -7, left: -7 }} />
      <Animated.View style={{ position: 'absolute', width: RING_SZ + 6,  height: RING_SZ + 6,  borderRadius: (RING_SZ + 6)  / 2, backgroundColor: 'rgba(56,189,248,0.24)', transform: [{ scale: pulseAnim }], top: -3, left: -3 }} />

      {/* Feature 1: Gyroscope parallax on inner glass disc */}
      <View style={{
        position: 'absolute', width: RING_SZ - STROKE, height: RING_SZ - STROKE, borderRadius: (RING_SZ - STROKE) / 2,
        backgroundColor: 'rgba(56,189,248,0.08)', overflow: 'hidden',
      }}>
        <Animated.View style={{
          position: 'absolute', top: -12, left: -12, right: -12, bottom: -12,
          transform: [{ translateX: gyroX }, { translateY: gyroY }],
        }}>
          {/* Feature 3: Environmental tint */}
          <LinearGradient
            colors={(
              isSunrise || isSunset
                ? ['rgba(251,191,36,0.14)', 'rgba(251,146,60,0.08)', 'transparent']
                : isRaining
                ? ['rgba(147,197,253,0.18)', 'rgba(56,189,248,0.08)', 'transparent']
                : ['rgba(186,230,253,0.15)', 'rgba(56,189,248,0.08)', 'transparent']
            )}
            start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          {/* Breath glow (Theme based) */}
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

          {/* Feature 3: Rain droplets */}
          {isRaining && rainAnims.map((ra: any, i: number) => (
            <Animated.View key={i} pointerEvents="none" style={{
              position: 'absolute', left: ra.x, top: 0,
              width: 1.5, height: 8, borderRadius: 1,
              backgroundColor: theme.outer,
              opacity: ra.op, transform: [{ translateY: ra.y }],
            }} />
          ))}
          
          {/* ── Feature 7: Compass Rose inside inner disc ── */}
          {compassActive && (
            <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ position: 'absolute', bottom: 42, fontSize: 8, color: 'rgba(255,255,255,0.4)', fontWeight: '600', letterSpacing: 0.5 }}>HOLD FLAT FOR ACCURACY</Text>
              <CompassRose size={RING_SZ - STROKE - 20} heading={compassAnim} />
            </View>
          )}

          {/* Feature 8: Premium Gyroscope Glare */}
          <AnimatedLinearGradient
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.25)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              position: 'absolute',
              width: RING_SZ * 2,
              height: RING_SZ * 2,
              top: -RING_SZ / 2,
              left: -RING_SZ / 2,
              transform: [
                { translateX: gyroX.interpolate({ inputRange: [-6, 6], outputRange: [RING_SZ * 0.7, -RING_SZ * 0.7] }) },
                { translateY: gyroY.interpolate({ inputRange: [-6, 6], outputRange: [RING_SZ * 0.7, -RING_SZ * 0.7] }) }
              ],
            }}
          />



        </Animated.View>
      </View>

      {/* Continuous Active Tracking Radar */}
      <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
        <Animated.View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: spin }] }}>
          <Svg width={RING_SZ + 36} height={RING_SZ + 36} viewBox={`0 0 ${RING_SZ + 36} ${RING_SZ + 36}`}>
            <Circle cx={(RING_SZ + 36)/2} cy={(RING_SZ + 36)/2} r={R + 14} fill="none" stroke="rgba(56,189,248,0.25)" strokeWidth={1} strokeDasharray="2 6" />
            <Circle cx={(RING_SZ + 36)/2} cy={(RING_SZ + 36)/2} r={R + 14} fill="none" stroke="rgba(56,189,248,0.8)" strokeWidth={2} strokeDasharray="30 400" strokeLinecap="round" />
            <Circle cx={(RING_SZ + 36)/2} cy={(RING_SZ + 36)/2} r={R + 14} fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth={3} strokeDasharray="4 426" strokeLinecap="round" />
          </Svg>
        </Animated.View>
      </View>

      {/* SVG ring layers */}
      <Svg width={RING_SZ} height={RING_SZ} viewBox={`0 0 ${RING_SZ} ${RING_SZ}`}>
        {/* Track */}
        <Circle cx={RING_SZ/2} cy={RING_SZ/2} r={R} fill="none" stroke={theme.track} strokeWidth={1} />
        {/* Wide glow */}
        <AnimatedCircle cx={RING_SZ/2} cy={RING_SZ/2} r={R} fill="none" stroke={theme.inner} strokeWidth={15} strokeLinecap="round" strokeDasharray={CIRCUM} strokeDashoffset={progressAnim} transform={`rotate(-90, ${RING_SZ/2}, ${RING_SZ/2})`} opacity={0.2} />
        {/* Mid halo */}
        <AnimatedCircle cx={RING_SZ/2} cy={RING_SZ/2} r={R} fill="none" stroke={theme.mid} strokeWidth={7}  strokeLinecap="round" strokeDasharray={CIRCUM} strokeDashoffset={progressAnim} transform={`rotate(-90, ${RING_SZ/2}, ${RING_SZ/2})`} opacity={0.5} />
        {/* Main crisp arc */}
        <AnimatedCircle cx={RING_SZ/2} cy={RING_SZ/2} r={R} fill="none" stroke={theme.inner} strokeWidth={3}  strokeLinecap="round" strokeDasharray={CIRCUM} strokeDashoffset={progressAnim} transform={`rotate(-90, ${RING_SZ/2}, ${RING_SZ/2})`} opacity={1} />
        {/* Shimmer sliver */}
        <AnimatedCircle cx={RING_SZ/2} cy={RING_SZ/2} r={R} fill="none" stroke={theme.outer} strokeWidth={1.5} strokeLinecap="round" strokeDasharray={CIRCUM} strokeDashoffset={progressAnim} transform={`rotate(-90, ${RING_SZ/2}, ${RING_SZ/2})`} opacity={0.85} />
        {/* Feature 2: Liquid leading-edge droplet */}
        {pct > 0 && pct < 1 && (() => {
          const angle = pct * 360 - 90;
          const rad = angle * Math.PI / 180;
          const cx = RING_SZ / 2 + R * Math.cos(rad);
          const cy = RING_SZ / 2 + R * Math.sin(rad);
          return (
            <>
              <Circle cx={cx} cy={cy} r={6}   fill={theme.liquid[0]} opacity={0.25} />
              <Circle cx={cx} cy={cy} r={3.5} fill={theme.liquid[1]} opacity={0.7} />
              <Circle cx={cx} cy={cy} r={1.8} fill={theme.liquid[2]} opacity={0.95} />
            </>
          );
        })()}
      </Svg>
    </View>
  );
});

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

// ═══════════════════════════════════════════════════════════════════════════════
export default function StepSessionScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sessionType } = useLocalSearchParams<{ sessionType?: string }>();

  const type = (sessionType as SessionType | undefined) ?? 'morning';
  let meta = SESSION_META[type] ?? SESSION_META.morning;
  
  if (type === 'morning') {
    const hour = new Date().getHours();
    if (hour >= 12 && hour < 17) {
      meta = { ...meta, emoji: '☀️' };
    }
  }

  meta = { ...meta, label: type === 'postmeal' ? 'Shatapavalli (100 Steps)' : 'The Walk' };

  const { solarTimes } = useBgContext();
  const now = new Date();
  const hour = now.getHours() + now.getMinutes() / 60;
  const [done,     setDone]     = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [weather, setWeather] = useState<any>(null);

  // Fixed ultra-premium iOS style palette for the ring — neutral frosted glass
  const C  = '#FFFFFF';
  const GA = 'rgba(255,255,255,0.05)';
  const GB = 'transparent';

  const isNightReal = solarTimes ? (hour < solarTimes.sunrise || hour >= solarTimes.sunset) : (hour < 6 || hour >= 18);

  // ── State ──────────────────────────────────────────────────────────────────
  const [steps,    setSteps]    = useState(0);
  const [elapsed,  setElapsed]  = useState(0);
  const [paused,   setPaused]   = useState(false);

  // Sound Integration
  const { playingId, isPaused, togglePause, stopSound, playSound, setGlobalVolume } = useSoundPlayer();
  const [isSoundModalVisible, setIsSoundModalVisible] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const pausedRef    = useRef(false);
  const startMsRef   = useRef(Date.now());
  const pausedMsRef  = useRef(0);
  const pausedAtRef  = useRef(0);
  const doneRef      = useRef(false);
  const lastUpdateRef = useRef(0);
  const lastBounceRef = useRef(0);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Animations ─────────────────────────────────────────────────────────────
  const stepBounce   = useRef(new Animated.Value(1)).current;
  const pulseAnim    = useRef(new Animated.Value(1)).current;
  const rippleScale  = useRef(new Animated.Value(0)).current;
  const rippleOp     = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(CIRCUM)).current;
  const confettiOp   = useRef(new Animated.Value(0)).current;
  const fadeIn       = useRef(new Animated.Value(0)).current;
  const slideUp      = useRef(new Animated.Value(40)).current;
  const pauseScale   = useRef(new Animated.Value(1)).current;
  const glowAnim     = useRef(new Animated.Value(0)).current;
  
  // Sci-fi ring rotations
  const rot1 = useRef(new Animated.Value(0)).current;
  const rot2 = useRef(new Animated.Value(0)).current;
  const rot3 = useRef(new Animated.Value(0)).current;

  // Feature 1: Gyroscope parallax
  const gyroX = useRef(new Animated.Value(0)).current;
  const gyroY = useRef(new Animated.Value(0)).current;

  // Feature 2: Liquid leading-edge pulse
  const liquidPulse = useRef(new Animated.Value(1)).current;

  // Feature 3: Rain droplets
  const RAIN_COUNT = 5;
  const rainAnims = useRef(Array.from({ length: RAIN_COUNT }, () => ({
    y:  new Animated.Value(0),
    op: new Animated.Value(0),
    x:  Math.random() * 100 + 50,
  }))).current;

  // Feature 4: Heartbeat
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rippleScaleHeart = useRef(new Animated.Value(0)).current;
  const rippleOpHeart    = useRef(new Animated.Value(0)).current;

  // Feature 6: Quote cycling
  const [quoteIdx, setQuoteIdx] = useState(0);
  const quoteOpacity = useRef(new Animated.Value(1)).current;

  // Feature 7: Compass
  const [compassActive, setCompassActive] = useState<boolean>(false);
  const compassAnim = useRef(new Animated.Value(0)).current;
  let lastHeading = 0;
  
  // Feature 9: Posture Coach
  const [isLookingDown, setIsLookingDown] = useState(false);
  const lookDownAnim = useRef(new Animated.Value(0)).current;

  // Feature 10: Seed Planting


  // Confetti particles
  const PARTICLE_COUNT = 32;
  const particlesX   = useRef(Array.from({ length: PARTICLE_COUNT }, () => new Animated.Value(0))).current;
  const particlesY   = useRef(Array.from({ length: PARTICLE_COUNT }, () => new Animated.Value(0))).current;
  const particlesOp  = useRef(Array.from({ length: PARTICLE_COUNT }, () => new Animated.Value(0))).current;
  const particlesScl = useRef(Array.from({ length: PARTICLE_COUNT }, () => new Animated.Value(0))).current;
  const PARTICLE_COLORS = ['#34D399','#F472B6','#FB923C','#A78BFA','#FCD34D','#2DD4BF'];
  const PARTICLE_ANGLES = Array.from({ length: PARTICLE_COUNT }, (_, i) => (i / PARTICLE_COUNT) * Math.PI * 2);
  const PARTICLE_DISTS  = Array.from({ length: PARTICLE_COUNT }, (_, i) => 70 + (i % 5) * 28);

  // ── Boot ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Start animations IMMEDIATELY so content appears instantly
    Animated.parallel([
      Animated.timing(fadeIn,  { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 300, easing: Easing.out(Easing.exp), useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.10, duration: 4500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.00, duration: 4500, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(Animated.timing(rot1, { toValue: 1, duration: 20000, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(rot2, { toValue: 1, duration: 28000, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(rot3, { toValue: 1, duration: 12000, easing: Easing.linear, useNativeDriver: true })).start();

    // Feature 7: Sensor-based Compass (True Compass Heading)
    let headingSub: any = null;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          headingSub = await Location.watchHeadingAsync((data) => {
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
            
            if (!compassActive) setCompassActive(true);
          });
        }
      } catch (e) {
        console.log("Compass error", e);
      }
    })();

    Animated.loop(Animated.sequence([
      Animated.timing(liquidPulse, { toValue: 1.6, duration: 800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(liquidPulse, { toValue: 1.0, duration: 800, easing: Easing.in(Easing.ease),  useNativeDriver: true }),
    ])).start();

    // Feature 6: Quote crossfade every 8s
    const quoteCycle = setInterval(() => {
      Animated.timing(quoteOpacity, { toValue: 0, duration: 600, useNativeDriver: true }).start(() => {
        setQuoteIdx(i => (i + 1) % QUOTES.length);
        Animated.timing(quoteOpacity, { toValue: 1, duration: 800, useNativeDriver: true }).start();
      });
    }, 8000);

    // Feature 1: Gyroscope parallax — throttled to 300ms to free JS thread for audio
    let gyroSub: any = null;
    if (Gyroscope) {
      try {
        Gyroscope.setUpdateInterval(300);
        let lastGyroUpdate = 0;
        gyroSub = Gyroscope.addListener(({ x, y }: { x: number; y: number }) => {
          const now = Date.now();
          if (now - lastGyroUpdate < 300) return;
          lastGyroUpdate = now;
          Animated.spring(gyroX, { toValue: Math.max(-6, Math.min(6, y * 35)), useNativeDriver: true, tension: 40, friction: 15 }).start();
          Animated.spring(gyroY, { toValue: Math.max(-6, Math.min(6, x * 35)), useNativeDriver: true, tension: 40, friction: 15 }).start();
        });
      } catch (_) {}
    }

    // Posture coach removed completely to stop volume dipping issues


    // Start timer immediately
    timerRef.current = setInterval(() => {
      if (!pausedRef.current) {
        setElapsed(Math.round((Date.now() - startMsRef.current - pausedMsRef.current) / 1000));
      }
    }, 1000);

    // Async background operations (weather + session start)
    (async () => {
      try {
        const w = await fetchWeather();
        setWeather(w);
      } catch (err) {}

      try {
        const result = await StepCounter.startSession(type);
        startMsRef.current = result.startTime;
      } catch (e) {
        console.warn("Failed to start walk session: ", e);
      }
    })();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      quoteCycle && clearInterval(quoteCycle);
      if (gyroSub) try { gyroSub.remove(); } catch (_) {}
      if (headingSub)  try { headingSub.remove();  } catch (_) {}
      
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    };
  }, []);

  // Feature 3: Rain droplet animation
  const isRaining = !!(weather && weather.weatherCode >= 51 && weather.weatherCode <= 99);
  useEffect(() => {
    if (!isRaining) return;
    const anims = rainAnims.map((ra, i) => {
      ra.y.setValue(0); ra.op.setValue(0);
      return Animated.sequence([
        Animated.delay(i * 600),
        Animated.loop(Animated.sequence([
          Animated.parallel([
            Animated.timing(ra.y,  { toValue: 120, duration: 2200, easing: Easing.linear, useNativeDriver: true }),
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

  // Sacred hour check for environmental reflections
  const isSunrise = solarTimes ? (Math.abs(hour - solarTimes.sunrise) < 0.5) : false;
  const isSunset  = solarTimes ? (Math.abs(hour - solarTimes.sunset)  < 0.5) : false;

  // ── Step event subscription ────────────────────────────────────────────────
  useEffect(() => {
    const sub = StepCounter.onStep((total) => {
      if (pausedRef.current || doneRef.current) return;

      const now = Date.now();
      
      // Throttle bounce animation more aggressively when sound is playing
      // to free JS thread — at least 500ms apart when audio is active
      const bounceThrottle = 500;
      if (now - lastBounceRef.current > bounceThrottle) {
        lastBounceRef.current = now;
        Animated.sequence([
          Animated.spring(stepBounce, { toValue: 1.12, useNativeDriver: true, speed: 50, bounciness: 10 }),
          Animated.spring(stepBounce, { toValue: 1.00, useNativeDriver: true, speed: 30, bounciness: 3  }),
        ]).start();

        // Only show ripple if NOT playing sound — ripple is JS thread work
        if ((rippleOp as any)._value === 0) {
          rippleScale.setValue(0);
          rippleOp.setValue(0.5);
          Animated.parallel([
            Animated.timing(rippleScale, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            Animated.timing(rippleOp,   { toValue: 0, duration: 900, useNativeDriver: true }),
          ]).start();
        }
      }

      if (type === 'postmeal' && total >= meta.goal && !doneRef.current) {
        doneRef.current = true;
        launchConfetti();
        // Temporarily play a nice sound or haptic sequence
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 300);
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 600);
      }

      const syncState = () => {
        setSteps(total);
        // CRITICAL FIX: Use .setValue() instead of Animated.timing(..., { useNativeDriver: false })
        // Animating SVG props on the JS thread floods the React Native bridge and directly
        // causes the audio buffer to starve/stutter (the "stuck then play" bug).
        progressAnim.setValue(CIRCUM - Math.min(1, total / meta.goal) * CIRCUM);
        lastUpdateRef.current = Date.now();
        syncTimeoutRef.current = null;
      };

      // Throttle step state updates to max once per 2 seconds to free JS thread
      const now2 = Date.now();
      if (now2 - lastUpdateRef.current >= 2000) {
        if (syncTimeoutRef.current) { clearTimeout(syncTimeoutRef.current); syncTimeoutRef.current = null; }
        syncState();
      } else if (!syncTimeoutRef.current) {
        syncTimeoutRef.current = setTimeout(syncState, 2000 - (now2 - lastUpdateRef.current));
      }
    });

    return () => {
      sub.remove();
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, []);

  // ── Minimize Session ───────────────────────────────────────────────────────
  const minimizeSession = useCallback(() => {
    Haptics.selectionAsync();
    router.back();
  }, []);

  const promptExit = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowExitModal(true);
  }, []);

  // ── Hardware back button ───────────────────────────────────────────────────
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      promptExit();
      return true;
    });
    return () => handler.remove();
  }, [promptExit]);

  // ── Confetti ───────────────────────────────────────────────────────────────
  const launchConfetti = useCallback(() => {
    setConfetti(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 200);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 500);

    Animated.timing(confettiOp, { toValue: 1, duration: 300, useNativeDriver: true }).start();

    particlesX.forEach((_, i) => {
      const angle = PARTICLE_ANGLES[i];
      const dist  = PARTICLE_DISTS[i];
      particlesX[i].setValue(0);
      particlesY[i].setValue(0);
      particlesOp[i].setValue(1);
      particlesScl[i].setValue(0);

      Animated.parallel([
        Animated.timing(particlesX[i],  { toValue: Math.cos(angle) * dist, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(particlesY[i],  { toValue: Math.sin(angle) * dist, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(particlesOp[i], { toValue: 0, duration: 900, useNativeDriver: true }),
        Animated.spring(particlesScl[i], { toValue: 1.4, useNativeDriver: true, speed: 30 }),
      ]).start();
    });

    setTimeout(() => endSession(), 3000);
  }, []);

  // ── Pause / Resume ─────────────────────────────────────────────────────────
  const toggleSessionPause = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.spring(pauseScale, { toValue: 0.94, useNativeDriver: true, speed: 60 }).start(() => {
      Animated.spring(pauseScale, { toValue: 1.00, useNativeDriver: true, speed: 40 }).start();
    });

    if (!pausedRef.current) {
      pausedRef.current  = true;
      pausedAtRef.current = Date.now();
      setPaused(true);
    } else {
      pausedMsRef.current += Date.now() - pausedAtRef.current;
      pausedRef.current  = false;
      setPaused(false);
    }
  };

  // ── End session ────────────────────────────────────────────────────────────
  const endSession = useCallback(async () => {
    doneRef.current = true;
    setDone(true);
    if (timerRef.current) clearInterval(timerRef.current);
    await StepCounter.endSession();
    await StepCounter.snapshotTodayToHistory();
    DeviceEventEmitter.emit('SessionEnded');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  }, []);

  const confirmEnd = () => {
    if (doneRef.current) return;
    Alert.alert(
      'End Session?',
      'Your steps will be saved.',
      [
        { text: 'Keep Walking', style: 'cancel' },
        { text: 'End Session', style: 'destructive', onPress: endSession },
      ]
    );
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const pct      = Math.min(1, steps / meta.goal);
  const distKm   = StepCounter.stepsToKm(steps);
  const calories = StepCounter.stepsToCal(steps);
  const pace     = elapsed > 30 && distKm > 0.01
    ? (() => {
        const minsPerKm = (elapsed / 60) / distKm;
        const m = Math.floor(minsPerKm);
        const s = Math.round((minsPerKm - m) * 60);
        return `${m}'${String(s).padStart(2,'0')}"`;
      })()
    : '--';

  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });

  // ─────────────────────────────────────────────────────────────────────────────
  const { bgUri, accentColor, bgKey } = useBgContext();
  const sessionBgKey = isNightReal ? 'live_session_night' : 'live_session';

  return (
    <ImageBackground
      source={{ uri: getBgSourceSync(sessionBgKey as any) }}
      style={[{ flex: 1, backgroundColor: accentColor || BG }]}
      imageStyle={{ opacity: 1, resizeMode: 'cover' }}>
      <GlassPulseOverlay />
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />


      {/* Session-colour aurora aura */}
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: glowOpacity }]} pointerEvents="none">
        <LinearGradient
          colors={[GA + '22', 'transparent']}
          style={{ position: 'absolute', top: -100, left: -100, width: 420, height: 420, borderRadius: 210 }}
        />
        <LinearGradient
          colors={[GB + '14', 'transparent']}
          style={{ position: 'absolute', top: 80, right: -80, width: 320, height: 320, borderRadius: 160 }}
        />
        {/* Bottom glow */}
        <LinearGradient
          colors={['transparent', GA + '14']}
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 300 }}
        />
      </Animated.View>

      {/* ── HEADER — frosted glass live activity bar ──────────────────────────── */}
      <Animated.View
        style={[{ opacity: fadeIn, transform: [{ translateY: slideUp }] }]}
      >
        <View style={{
          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
          paddingTop: insets.top + 6,
          paddingBottom: 14,
          paddingHorizontal: 20,
          backgroundColor: 'transparent',
          overflow: 'hidden',
        }}>
          {/* Top shine */}
          <LinearGradient
            colors={['rgba(255,255,255,0.09)', 'transparent']}
            start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.8 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          {/* Bottom border glow */}
          <LinearGradient
            colors={[C + '50', C + '20', 'transparent', C + '35']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1.5 }}
            pointerEvents="none"
          />

          {/* Close / Exit */}
          <TouchableOpacity
            onPress={promptExit}
            style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={18} color="rgba(255,255,255,0.65)" />
          </TouchableOpacity>

          {/* Centre — session identity */}
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 18, marginBottom: 1 }}>{meta.emoji}</Text>
            <Text style={{ fontSize: 13, fontWeight: '600', color: C, letterSpacing: 0.6, textShadowColor: C + '80', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 }}>
              {meta.label}
            </Text>
          </View>

          {/* Live / Paused status */}
          <View style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}>
            {paused ? (
              <View style={{ paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(251,146,60,0.18)', borderWidth: 1, borderColor: 'rgba(251,146,60,0.4)' }}>
                <Text style={{ fontSize: 7, fontWeight: '900', color: '#FB923C', letterSpacing: 1.2 }}>PAUSE</Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10, backgroundColor: C + '20', borderWidth: 1, borderColor: C + '50' }}>
                <Animated.View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: C, opacity: pulseAnim.interpolate({ inputRange: [1, 1.10], outputRange: [0.6, 1] }) }} />
                <Text style={{ fontSize: 7, fontWeight: '900', color: C, letterSpacing: 1 }}>LIVE</Text>
              </View>
            )}
          </View>
        </View>
      </Animated.View>

      {/* ── BODY ────────────────────────────────────────────────────────────── */}
      <Animated.View style={[s.body, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>

        {/* ── PREMIUM SUGGESTION CARD ────────────────────────────────────── */}
        <View style={{ width: '100%', marginBottom: 16 }}>
          <View style={{
            backgroundColor: 'rgba(0, 0, 0, 0.3)', // iOS dark glass
            borderRadius: 20,
            padding: 16,
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
            alignItems: 'center',
            overflow: 'hidden',
          }}>
            <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFillObject} />
            <LinearGradient
              colors={['rgba(255,255,255,0.05)', 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.3, marginBottom: 6, textAlign: 'center' }}>
              Nature Connection
            </Text>
            <Text style={{ fontSize: 11, fontWeight: '400', color: 'rgba(255,255,255,0.65)', lineHeight: 16, textAlign: 'center', marginBottom: 10 }}>
              Walk barefoot if conditions permit, or simply wear shoes and take a mindful nature bath.
            </Text>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="headset" size={11} color="#FFFFFF" />
              <Text style={{ fontSize: 10, fontWeight: '600', color: '#FFFFFF', letterSpacing: 0.2 }}>Use headphones for Nada sound</Text>
            </View>
          </View>
        </View>

        {/* ── ULTRA-PREMIUM LIVE RING ───────────────────────────────────────── */}
        <View style={[s.ringWrapper, { marginTop: -15, marginBottom: 15 }]}>
          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            <MemoRing
              RING_SZ={RING_SZ} R={R} STROKE={STROKE} CIRCUM={CIRCUM}
              pct={pct}
              progressAnim={progressAnim}
              pulseAnim={pulseAnim} glowAnim={glowAnim}
              gyroX={gyroX} gyroY={gyroY}
              isRaining={isRaining} isSunrise={isSunrise} isSunset={isSunset}
              rainAnims={rainAnims}
              compassActive={compassActive}
              compassAnim={compassAnim}
              liquidPulse={liquidPulse}
              heartbeatIntervalRef={heartbeatIntervalRef}
              rippleScaleHeart={rippleScaleHeart}
              rippleOpHeart={rippleOpHeart}
              theme={getRingTheme(new Date().getHours())}
              isHot={weather?.tempC && weather.tempC > 32}
              isCold={weather?.tempC && weather.tempC < 10}
            />

            {/* Feature 6: Animated quote below ring */}
            <Animated.Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', fontStyle: 'italic', marginTop: 10, letterSpacing: 0.5, opacity: quoteOpacity }}>
              {QUOTES[quoteIdx]}
            </Animated.Text>
          
            {/* Inner Content overlay */}
          <View style={[s.centreBox, { gap: 8, justifyContent: 'center', paddingVertical: 0 }]}>
            
            {/* Badge & Steps */}
            <View style={{ alignItems: 'center' }}>
              {/* Dynamic Badge */}
              <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 99, backgroundColor: C + '15', borderWidth: 1, borderColor: C + '40', marginBottom: 2 }}>
                <Text style={{ fontSize: 9, fontWeight: '800', color: C, letterSpacing: 1.4 }}>
                  LIVE SESSION
                </Text>
              </View>
              
              <Animated.Text style={[s.bigSteps, { fontSize: 62, lineHeight: 62, color: C, transform: [{ scale: stepBounce }], textShadowColor: C + '60', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 16 }]}>
                {steps.toLocaleString()}
              </Animated.Text>
              {!playingId && (
                <Text style={{ fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.5)', letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 2 }}>
                  OF {meta.goal.toLocaleString()} GOAL
                </Text>
              )}
            </View>

            </View>
        </View>
        </View>

        {/* ── SLEEK STATS CARD ──────────────────────────────────── */}
        <Animated.View style={{
          paddingHorizontal: 32,
          marginTop: -5,
          marginBottom: 15,
        }}>
          <View style={{ borderRadius: 20, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingVertical: 14 }}>
            <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFillObject} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center' }}>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff' }}>{distKm.toFixed(2)}</Text>
                <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }}>km</Text>
              </View>
              <View style={{ width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.15)' }} />
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff' }}>{pace}</Text>
                <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }}>pace</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* ── TIMER — frosted glass pill ──────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', marginBottom: 20, overflow: 'hidden' }}>
          <LinearGradient
            colors={['rgba(255,255,255,0.07)', 'transparent']}
            start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.6 }}
            style={StyleSheet.absoluteFillObject}
          />
          <Text style={[s.timer, paused && { color: 'rgba(255,255,255,0.25)' }]}>
            {fmtTime(elapsed)}
          </Text>
        </View>

        {/* Post-meal progress bar */}
        {type === 'postmeal' && (
          <View style={s.shataBar}>
            <Text style={[s.shataLabel, { color: C }]}>
              Shatapavalli · {steps} / 100 steps
            </Text>
            <View style={s.shataTrack}>
              <View style={[s.shataFill, { backgroundColor: C, width: `${Math.min(100, pct * 100)}%` as any }]} />
            </View>
          </View>
        )}

        {/* ── ACTION BUTTONS — ultra smart frosted glass ─────────────────── */}
        <View style={[s.btnRow, { marginBottom: 24, paddingHorizontal: 12 }]}>
          {/* PAUSE button */}
          <Animated.View style={{ flex: 1, transform: [{ scale: pauseScale }] }}>
            <TouchableOpacity
              onPress={toggleSessionPause}
              activeOpacity={0.82}
              style={{ borderRadius: 99, overflow: 'hidden', shadowColor: '#38bdf8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 5, backgroundColor: 'rgba(12,74,110,0.3)' }}
            >
              <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFillObject} />
              <LinearGradient
                colors={paused ? ['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.05)'] : ['rgba(255,255,255,0.08)', 'transparent']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={{ paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <View style={{ position: 'absolute', inset: 0, borderRadius: 99, borderWidth: 1, borderColor: paused ? 'rgba(56,189,248,0.6)' : 'rgba(255,255,255,0.2)' }} />
                <Ionicons name={paused ? 'play-outline' : 'pause-outline'} size={18} color={paused ? '#38bdf8' : '#FFF'} style={paused ? { marginLeft: 2 } : {}} />
                <Text style={[s.pauseTxt, { color: paused ? '#38bdf8' : '#FFF', fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase' }]}>
                  {paused ? 'RESUME' : 'PAUSE'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* END button */}
          <View style={{ flex: 1 }}>
            <TouchableOpacity 
              onPress={promptExit}
              activeOpacity={0.82}
              style={{ borderRadius: 99, overflow: 'hidden', shadowColor: '#f43f5e', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 5, backgroundColor: 'rgba(12,74,110,0.3)' }}
            >
              <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFillObject} />
              <LinearGradient
                colors={['rgba(255,255,255,0.08)', 'transparent']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={{ paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <View style={{ position: 'absolute', inset: 0, borderRadius: 99, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }} />
                <Ionicons name="stop-outline" size={18} color="#FFF" />
                <Text style={[s.endTxt, { color: '#FFF', fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase' }]}>END</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── EXTERNAL NADA SOUND CONTROLS (Catchy & Premium) ── */}
        <View style={{ width: '100%', paddingHorizontal: 12, marginBottom: 20 }}>
          {!playingId ? (
            <TouchableOpacity 
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setIsSoundModalVisible(true); }}
              activeOpacity={0.8}
            >
              <View style={{ overflow: 'hidden', borderRadius: 99 }}>
                <LinearGradient
                  colors={['rgba(139,92,246,0.35)', 'rgba(56,189,248,0.2)']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
                    paddingHorizontal: 24, paddingVertical: 12,
                    borderRadius: 99,
                    borderWidth: 1, borderColor: 'rgba(192,132,252,0.4)',
                  }}
                >
                  <Ionicons name="headset-outline" size={18} color="#e9d5ff" />
                  <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' }}>Listen Naad Sound</Text>
                </LinearGradient>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={{ 
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', 
              backgroundColor: 'rgba(8,47,73,0.4)', borderWidth: 1, borderColor: 'rgba(56,189,248,0.3)', 
              paddingHorizontal: 16, paddingVertical: 10, borderRadius: 99, 
              overflow: 'hidden', shadowColor: '#38bdf8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 5 
            }}>
              <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFillObject} />
              
              <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); stopSound(); }} style={{ padding: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 99, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                <Ionicons name="stop" size={16} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); togglePause(); }} 
                style={{ width: 52, height: 52, borderRadius: 26, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', shadowColor: '#38bdf8', shadowOpacity: 0.4, shadowRadius: 10, elevation: 6 }}
              >
                <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFillObject} />
                <LinearGradient
                  colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.1)']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                />
                <View style={{ position: 'absolute', inset: 0, borderRadius: 26, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)' }} />
                <Ionicons name={isPaused ? "play" : "pause"} size={22} color="#FFF" style={isPaused ? { marginLeft: 3 } : {}} />
              </TouchableOpacity>
              
              <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setIsSoundModalVisible(true); }} style={{ padding: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 99, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                <Ionicons name="list" size={16} color="rgba(255,255,255,0.9)" />
              </TouchableOpacity>
            </View>
          )}
        </View>

      </Animated.View>

      {/* ── CONFETTI / CELEBRATION OVERLAY ──────────────────────────────────── */}
      {confetti && (
        <Animated.View
          style={[StyleSheet.absoluteFillObject, s.overlay, { opacity: confettiOp, zIndex: 100 }]}
          pointerEvents="none"
        >
          <LinearGradient
            colors={['rgba(0,0,0,0.92)', 'rgba(5,20,12,0.96)']}
            style={StyleSheet.absoluteFillObject}
          />
          {particlesX.map((px, i) => (
            <Animated.View
              key={i}
              style={[
                s.particle,
                {
                  backgroundColor: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
                  opacity:   particlesOp[i],
                  transform: [
                    { translateX: px },
                    { translateY: particlesY[i] },
                    { scale:      particlesScl[i] },
                  ],
                },
              ]}
            />
          ))}
          <View style={s.celebMsg}>
            <Text style={s.celebEmoji}>🎉</Text>
            <Text style={[s.celebTitle, { color: C }]}>
              Shatapavalli Complete!
            </Text>
            <Text style={s.celebBody}>
              100 steps walked. Agni is awakened.
            </Text>
            <Text style={[s.celebBody, { color: 'rgba(255,255,255,0.35)', marginTop: 4 }]}>
              Walk no more — rest and digest 🙏
            </Text>
          </View>
        </Animated.View>
      )}

      {/* Sound Library Modal */}
      <SoundLibraryModal
        visible={isSoundModalVisible}
        onClose={() => setIsSoundModalVisible(false)}
        sounds={ALL_SOUNDS_LIST}
        playingId={playingId}
        onPlaySound={(id) => {
          const meta = ALL_SOUNDS_LIST.find(s => s.id === id);
          if (meta) {
            playSound(meta, 43200, undefined, 0, true);
          }
          setIsSoundModalVisible(false);
        }}
      />
      <ExitModal 
        visible={showExitModal} 
        onClose={() => setShowExitModal(false)} 
        onMinimize={() => { setShowExitModal(false); minimizeSession(); }} 
        onEnd={() => { setShowExitModal(false); endSession(); }} 
        color={C}
        gradA={GA}
        gradB={GB}
      />

      {/* ── Feature 9: Posture Coach Overlay (Sleek Top Toast) ────────────────────────────────────── */}
      <Animated.View 
        pointerEvents="none" 
        style={{
          position: 'absolute',
          top: insets.top + 16,
          left: 20,
          right: 20,
          opacity: lookDownAnim,
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100, // ensure it's on top
        }}
      >
        <View style={{ width: '100%', borderRadius: 20, overflow: 'hidden', paddingVertical: 14, paddingHorizontal: 20, borderWidth: 1, borderColor: 'rgba(56,189,248,0.2)', flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(12,74,110,0.4)' }}>
          <BlurView intensity={45} tint="dark" style={StyleSheet.absoluteFillObject} />
          <Ionicons name="leaf-outline" size={24} color="rgba(255,255,255,0.9)" style={{ marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff', letterSpacing: 0.5, marginBottom: 2 }}>
              Eyes on the horizon.
            </Text>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '500', letterSpacing: 0.2 }}>
              Lift your gaze to open your breathing.
            </Text>
          </View>
        </View>
      </Animated.View>
    </ImageBackground>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Exit Modal — Ultra-Smart Sleek Minimalist Popup
// ─────────────────────────────────────────────────────────────────────────────
function ExitModal({
  visible, onClose, onMinimize, onEnd, color, gradA, gradB
}: {
  visible: boolean; onClose: () => void; onMinimize: () => void; onEnd: () => void; color: string; gradA: string; gradB: string;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[StyleSheet.absoluteFillObject, { justifyContent: 'center', alignItems: 'center' }]}>
        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFillObject} />
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(5,5,8,0.85)' }]} />
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onClose();
        }} />
        
        <Animated.View style={{ 
          width: '85%', 
          maxWidth: 340, 
          borderRadius: 32, 
          overflow: 'hidden', 
          backgroundColor: 'rgba(15,15,18,0.6)', 
          borderWidth: StyleSheet.hairlineWidth, 
          borderColor: 'rgba(255,255,255,0.25)', 
          shadowColor: '#000', 
          shadowOffset: { width: 0, height: 20 }, 
          shadowOpacity: 0.8, 
          shadowRadius: 40, 
          elevation: 24 
        }}>
          <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFillObject} />
          
          <View style={{ padding: 32, paddingBottom: 24, alignItems: 'center' }}>
            <View style={{ 
              marginBottom: 20, 
              padding: 16,
              borderRadius: 20,
              backgroundColor: 'rgba(255,255,255,0.03)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.08)'
            }}>
              <Ionicons name="walk" size={26} color="rgba(255,255,255,0.9)" style={{ marginLeft: 3 }} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#FFF', textAlign: 'center', letterSpacing: 1.5, marginBottom: 12, textTransform: 'uppercase' }}>Active Journey</Text>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 20, paddingHorizontal: 10, letterSpacing: 0.3 }}>Keep tracking your steps and audio seamlessly in the background, or conclude your walk.</Text>
          </View>
          
          <View style={{ paddingHorizontal: 24, paddingBottom: 32, gap: 12 }}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onMinimize();
              }}
            >
              <LinearGradient
                colors={['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.03)']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={{ paddingVertical: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.3)' }}
              >
                <Text style={{ fontSize: 12, color: '#FFF', fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' }}>Flow In Background</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onEnd();
              }}
              style={{ paddingVertical: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,60,60,0.1)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,60,60,0.3)' }}
            >
              <Text style={{ fontSize: 12, color: 'rgba(255,90,90,1)', fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' }}>Conclude Walk</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onClose();
              }}
              style={{ paddingVertical: 12, alignItems: 'center', marginTop: 4 }}
            >
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const CARD_BG  = 'rgba(12,12,30,0.72)';
const CARD_BDR = 'rgba(255,255,255,0.09)';

const s = StyleSheet.create({
  body: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, marginTop: -25,
  },

  ringWrapper: {
    width: RING_SZ + 40, height: RING_SZ + 40,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4, marginTop: 4,
  },
  centreBox: {
    position: 'absolute', alignItems: 'center', justifyContent: 'center',
  },
  bigSteps:     { fontSize: 58, fontWeight: '300', fontVariant: ['tabular-nums'], letterSpacing: -1.5, lineHeight: 64 },
  bigStepsUnit: { fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: '600', marginTop: -2, letterSpacing: 2 },
  goalChip: {
    borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, marginTop: 8,
  },
  goalChipTxt: { fontSize: 10, fontWeight: '700' },

  timer: {
    fontSize: 24, fontWeight: '300', fontVariant: ['tabular-nums'],
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 2,
  },

  metricRow: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
    borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 10, alignSelf: 'stretch', overflow: 'hidden',
  },
  metric:     { flex: 1, alignItems: 'center', paddingVertical: 8, gap: 2 },
  metricIcon: { fontSize: 16, marginBottom: 2 },
  metricVal:  { fontSize: 18, fontWeight: '500', fontVariant: ['tabular-nums'] },
  metricUnit: { fontSize: 10, color: 'rgba(255,255,255,0.38)', fontWeight: '600' },

  shataBar:   { alignSelf: 'stretch', gap: 8, marginBottom: 12 },
  shataLabel: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  shataTrack: { height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' },
  shataFill:  { height: 6, borderRadius: 3 },

  btnRow: { flexDirection: 'row', gap: 14, alignSelf: 'stretch', justifyContent: 'center' },
  pauseTxt: { fontSize: 13, fontWeight: '600', letterSpacing: 1 },
  endTxt:   { fontSize: 13, fontWeight: '600', color: '#0A0A0F', letterSpacing: 1 },

  overlay:   { alignItems: 'center', justifyContent: 'center' },
  particle:  { position: 'absolute', width: 10, height: 10, borderRadius: 5, alignSelf: 'center', top: '50%' },
  celebMsg:  { alignItems: 'center', gap: 8, paddingHorizontal: 32 },
  celebEmoji:{ fontSize: 56 },
  celebTitle:{ fontSize: 24, fontWeight: '600', textAlign: 'center', letterSpacing: 0.5 },
  celebBody: { fontSize: 14, color: 'rgba(255,255,255,0.58)', textAlign: 'center', lineHeight: 20 },
});
