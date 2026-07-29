/**
 * walk.tsx — Naad Steps Tab
 * Ultra-premium frosted glass redesign.
 * - Deep glassmorphism on all cards (not transparent — rich frosted glass)
 * - Ultra-smart "Modify Today's Target" button
 * - Ultra-smart "Start Nature Walk" button with animated gradient
 * - Premium ring — solid frosted disc inner, not transparent
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Line, Text as SvgText, G, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';

import StepCounter, { type TodayStats, type DailyData } from '@/src/modules/StepCounter';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useBgContext } from '@/lib/bgContext';
import { useSoundPlayer } from '@/lib/soundPlayerContext';
import { getTabBarClearance } from '@/lib/tabBarSpacing';
import { getSolarTimes } from '@/lib/solar';
import { store, KEYS } from '@/lib/storage';
import { DARK_BG_KEYS } from '@/lib/cardTheme';
import { getBgSourceSync } from '@/lib/bgImages';
import { fetchWeather, type WeatherData } from '@/lib/weather';
import { getSacredHourInfo } from '@/lib/solarRingPalette';

// ── Sensors (optional — gracefully degrade if unavailable) ────────────────────
let Gyroscope: any = null;
try { Gyroscope = require('expo-sensors').Gyroscope; } catch (_) {}

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
const RING_SIZE   = 290;
const RING_STROKE = 24;
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

// ─── Modern HUD Navigator Compass ────────────────────────────────────────────
// Ultra-modern tactical/digital compass inspired by aviation HUD systems.
// The outer degree ring rotates with the device heading.
// The inner reticle + heading readout remain fixed.
function CompassRose({ size, heading }: { size: number; heading: number }) {
  const cx = 50, cy = 50;

  // Build degree tick marks on the ROTATING ring
  const ticks: React.JSX.Element[] = [];
  for (let i = 0; i < 72; i++) {
    const deg = i * 5;
    const angle = deg * Math.PI / 180;
    const isMajor  = deg % 90 === 0;   // N/E/S/W
    const isMedium = deg % 45 === 0;   // NE/SE/SW/NW
    const isMinor5 = deg % 10 === 0;   // every 10°
    const r1 = 48;
    const r2 = isMajor ? 41 : isMedium ? 43 : isMinor5 ? 44.5 : 46;
    const x1 = cx + r1 * Math.sin(angle);
    const y1 = cy - r1 * Math.cos(angle);
    const x2 = cx + r2 * Math.sin(angle);
    const y2 = cy - r2 * Math.cos(angle);
    ticks.push(
      <Line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={isMajor ? '#38bdf8' : isMedium ? 'rgba(56,189,248,0.7)' : isMinor5 ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.18)'}
        strokeWidth={isMajor ? 1.8 : isMedium ? 1.2 : 0.7}
        strokeLinecap="round" />
    );
  }

  // Cardinal label positions on the rotating ring (r=38 from center)
  const cardinals = [
    { label: 'N', deg: 0,   color: '#f87171', weight: '900' as const },
    { label: 'E', deg: 90,  color: '#7dd3fc', weight: '800' as const },
    { label: 'S', deg: 180, color: 'rgba(255,255,255,0.8)', weight: '700' as const },
    { label: 'W', deg: 270, color: '#7dd3fc', weight: '800' as const },
  ];
  const cardinalEls: React.JSX.Element[] = cardinals.map(({ label, deg: d, color, weight }) => {
    const rad = d * Math.PI / 180;
    const x = cx + 37 * Math.sin(rad);
    const y = cy - 37 * Math.cos(rad);
    return (
      <SvgText key={label} x={x} y={y} fill={color} fontSize={label === 'N' ? '7.5' : '5.5'}
        fontWeight={weight} textAnchor="middle" alignmentBaseline="middle">
        {label}
      </SvgText>
    );
  });

  // Intercardinal labels
  const intercardinals = [
    { label: 'NE', deg: 45 }, { label: 'SE', deg: 135 },
    { label: 'SW', deg: 225 }, { label: 'NW', deg: 315 },
  ];
  const intercardinalEls: React.JSX.Element[] = intercardinals.map(({ label, deg: d }) => {
    const rad = d * Math.PI / 180;
    const x = cx + 36 * Math.sin(rad);
    const y = cy - 36 * Math.cos(rad);
    return (
      <SvgText key={label} x={x} y={y} fill="rgba(56,189,248,0.55)" fontSize="3.5"
        fontWeight="600" textAnchor="middle" alignmentBaseline="middle">
        {label}
      </SvgText>
    );
  });

  const cardinalName = (() => {
    const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
    return dirs[Math.round(heading / 22.5) % 16];
  })();

  return (
    <View pointerEvents="none" style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>

      {/* ── ROTATING RING (moves with device heading) ── */}
      <View style={{ position: 'absolute', transform: [{ rotate: `${-heading}deg` }], width: size, height: size }}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          {/* Outer bezel dark fill */}
          <Circle cx={cx} cy={cy} r={49.5} fill="rgba(4,14,32,0.92)" />
          {/* Outer glowing ring */}
          <Circle cx={cx} cy={cy} r={49} fill="none" stroke="rgba(56,189,248,0.6)" strokeWidth={1} />
          <Circle cx={cx} cy={cy} r={48.2} fill="none" stroke="rgba(56,189,248,0.15)" strokeWidth={0.4} />
          {/* Degree tick marks */}
          {ticks}
          {/* Inner bezel separator */}
          <Circle cx={cx} cy={cy} r={32} fill="rgba(4,14,32,0.6)" />
          <Circle cx={cx} cy={cy} r={32} fill="none" stroke="rgba(56,189,248,0.4)" strokeWidth={0.7} />
          <Circle cx={cx} cy={cy} r={29} fill="none" stroke="rgba(56,189,248,0.12)" strokeWidth={0.4} strokeDasharray="1.5 3" />
          {/* Cardinal & intercardinal labels (rotate with ring) */}
          {cardinalEls}
          {intercardinalEls}
          {/* N pointer tick (extra long, glowing cyan-red) */}
          <Line x1={cx} y1={cy - 48} x2={cx} y2={cy - 40} stroke="#f87171" strokeWidth={2.5} strokeLinecap="round" />
        </Svg>
      </View>

      {/* ── FIXED RETICLE LAYER (never rotates) ── */}
      <View style={{ position: 'absolute', width: size, height: size }}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          {/* Triangle North indicator at top (fixed — always points up) */}
          <Path d={`M${cx} ${cy-46} L${cx-2.5} ${cy-41} L${cx+2.5} ${cy-41} Z`} fill="rgba(248,113,113,0.9)" />
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
  const { playingId } = useSoundPlayer();
  const router = useRouter();

  // ── State ──────────────────────────────────────────────────────────────────
  const [stats,        setStats]        = useState<TodayStats>(DEFAULT_STATS);
  const [weekData,     setWeekData]     = useState<DailyData[]>([]);
  const [isAvailable,  setIsAvailable]  = useState(true);
  const [loading,      setLoading]      = useState(true);
  const [showGoalModal,setShowGoalModal]= useState(false);
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
  const [compassHeading, setCompassHeading] = useState<number | null>(null);
  const [compassTipVisible, setCompassTipVisible] = useState(false);
  const compassTipOpacity = useRef(new Animated.Value(0)).current;
  const compassRot = useRef(new Animated.Value(0)).current;

  // ── Seed Selection ────────────────────────────────────────────────────────
  const [selectedSeed, setSelectedSeed] = useState<'none'|'pebble'|'calm'|'epic'>('none');

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
  }, [refreshStats]));

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
      Animated.timing(cardFade,  { toValue: 1, duration: 800, useNativeDriver: false }),
      Animated.timing(cardSlide, { toValue: 0, duration: 800, easing: Easing.out(Easing.exp), useNativeDriver: false }),
    ]).start();

    // pulseAnim uses JS driver to stay consistent with all other JS-driver props on the same views
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.07, duration: 4500, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(pulseAnim, { toValue: 1.00, duration: 4500, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
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

    // Feature 7: Highly Accurate Location-based Compass
    let headingSub: Location.LocationSubscription | null = null;
    let firstReading = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          headingSub = await Location.watchHeadingAsync((data) => {
            setCompassHeading(Math.round(data.trueHeading !== -1 ? data.trueHeading : data.magHeading));
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
      } catch (err) {
        // Location compass failed, ignore.
      }
    })();

    return () => {
      clearInterval(quoteCycle);
      if (gyroSub) try { gyroSub.remove(); } catch (_) {}
      if (headingSub) headingSub.remove();
    };
  }, []);

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
      useNativeDriver: false,
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
            Animated.timing(ra.y,  { toValue: 160, duration: 2200, easing: Easing.linear, useNativeDriver: false }),
            Animated.sequence([
              Animated.timing(ra.op, { toValue: 0.7, duration: 300, useNativeDriver: false }),
              Animated.timing(ra.op, { toValue: 0,   duration: 1900, useNativeDriver: false }),
            ]),
          ]),
          Animated.parallel([
            Animated.timing(ra.y,  { toValue: 0, duration: 0, useNativeDriver: false }),
            Animated.timing(ra.op, { toValue: 0, duration: 0, useNativeDriver: false }),
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
      params: { sessionType: type, seedType: selectedSeed },
    } as never);
  };

  // ── Compact mode: smoothly shrink UI when a floating bar is visible ──────────
  const compactMode = stepBarActive || !!playingId;
  useEffect(() => {
    Animated.spring(compactAnim, {
      toValue: compactMode ? 1 : 0,
      useNativeDriver: false,
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
                  Align your Rhythm
                </Text>
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', letterSpacing: 1.5, fontWeight: '500', textTransform: 'uppercase' }}>
                  {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
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

        {/* ── TAGLINE CARD — hides smoothly in compact mode ────────────────── */}
        <Animated.View style={{
          opacity: taglineOpacity,
          height: taglineHeight,
          overflow: 'hidden',
          paddingHorizontal: 24,
          marginBottom: 4,
        }}>
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
              Do not count calories.. just walk organically.
            </Text>
            <Text style={{ fontSize: 11, fontWeight: '400', color: 'rgba(255,255,255,0.65)', lineHeight: 16, textAlign: 'center' }}>
              Sync your body with nature by barefoot walking on natural clean surfaces if condition optimum, or just walk with shoes and take a nature bath...
            </Text>
          </View>
        </Animated.View>

        {/* View Analytics Button - sleek premium iOS style */}
        <Animated.View style={{ opacity: cardFade, transform: [{ translateY: cardSlide }], alignItems: 'center', marginBottom: 16, zIndex: 10 }}>
          <TouchableOpacity
            onPress={() => { Haptics.selectionAsync(); router.push('/step-analytics' as never); }}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 8,
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
              paddingHorizontal: 24, paddingVertical: 10,
              borderRadius: 30,
              overflow: 'hidden',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 5,
            }}
            activeOpacity={0.7}
          >
            <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFillObject} />
            <Ionicons name="stats-chart" size={14} color="#FFF" />
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#FFF', letterSpacing: 1.2, textTransform: 'uppercase' }}>View Analytics</Text>
            <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.6)" style={{ marginLeft: 4 }} />
          </TouchableOpacity>
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
              <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: pulseAnim.interpolate({ inputRange: [1, 1.07], outputRange: [0.3, 0.6] }) }]}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.05)', 'transparent']}
                  start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
                  style={StyleSheet.absoluteFillObject} />
              </Animated.View>
            </View>

            {/* ── ULTRA-PREMIUM SMART FITNESS RING — ALL FEATURES ──────────────── */}
            {/* Feature 4: Heartbeat long-press PanResponder wrapper */}
            <View
              style={{ width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' }}
              {...PanResponder.create({
                onStartShouldSetPanResponder: () => true,
                onPanResponderGrant: () => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                  heartbeatIntervalRef.current = setInterval(() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                    // Ripple
                    rippleScaleHeart.setValue(0.6);
                    rippleOpHeart.setValue(0.6);
                    Animated.parallel([
                      Animated.timing(rippleScaleHeart, { toValue: 1.6, duration: 700, useNativeDriver: true }),
                      Animated.timing(rippleOpHeart,    { toValue: 0,   duration: 700, useNativeDriver: true }),
                    ]).start();
                  }, 800);
                },
                onPanResponderRelease: () => {
                  if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
                },
                onPanResponderTerminate: () => {
                  if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
                },
              }).panHandlers}
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

              {/* ── Layered aura — slim and elegant pulse glow ── */}
              {/* Feature 1: Gyroscope parallax on the inner glass disc */}
              <Animated.View style={{ position: 'absolute', width: RING_SIZE + 24, height: RING_SIZE + 24, borderRadius: (RING_SIZE + 24) / 2, backgroundColor: 'rgba(56,189,248,0.06)', transform: [{ scale: pulseAnim }], top: -12, left: -12 }} />
              <Animated.View style={{ position: 'absolute', width: RING_SIZE + 14, height: RING_SIZE + 14, borderRadius: (RING_SIZE + 14) / 2, backgroundColor: 'rgba(56,189,248,0.14)', transform: [{ scale: pulseAnim }], top: -7, left: -7 }} />
              <Animated.View style={{ position: 'absolute', width: RING_SIZE + 6, height: RING_SIZE + 6, borderRadius: (RING_SIZE + 6) / 2, backgroundColor: 'rgba(56,189,248,0.24)', transform: [{ scale: pulseAnim }], top: -3, left: -3 }} />

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

                  {/* ── Feature 7: Premium Compass Rose (inside inner disc, semi-transparent) ── */}
                  {compassHeading !== null && (
                    <View pointerEvents="none" style={[
                      StyleSheet.absoluteFillObject,
                      { alignItems: 'center', justifyContent: 'center', opacity: 0.55 },
                    ]}>
                      <Text style={{ position: 'absolute', bottom: 42, fontSize: 8, color: 'rgba(255,255,255,0.4)', fontWeight: '600', letterSpacing: 0.5 }}>HOLD FLAT FOR ACCURACY</Text>
                      <CompassRose size={RING_SIZE - RING_STROKE - 20} heading={compassHeading} />
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
                <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={R_OUTER} fill="none" stroke={theme.track} strokeWidth={3} />
                {/* Wide outer glow */}
                <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={R_OUTER} fill="none" stroke={theme.inner} strokeWidth={15} strokeLinecap="round" strokeDasharray={CIRCUMF} strokeDashoffset={CIRCUMF * (1 - (stats.goalPercent / 100))} transform={`rotate(-90, ${RING_SIZE / 2}, ${RING_SIZE / 2})`} opacity={0.2} />
                {/* Mid halo */}
                <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={R_OUTER} fill="none" stroke={theme.mid} strokeWidth={7} strokeLinecap="round" strokeDasharray={CIRCUMF} strokeDashoffset={CIRCUMF * (1 - (stats.goalPercent / 100))} transform={`rotate(-90, ${RING_SIZE / 2}, ${RING_SIZE / 2})`} opacity={0.5} />
                {/* Main crisp arc */}
                <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={R_OUTER} fill="none" stroke={theme.inner} strokeWidth={3} strokeLinecap="round" strokeDasharray={CIRCUMF} strokeDashoffset={CIRCUMF * (1 - (stats.goalPercent / 100))} transform={`rotate(-90, ${RING_SIZE / 2}, ${RING_SIZE / 2})`} opacity={1} />
                {/* Inner shimmer sliver */}
                <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={R_OUTER} fill="none" stroke={theme.outer} strokeWidth={1.5} strokeLinecap="round" strokeDasharray={CIRCUMF} strokeDashoffset={CIRCUMF * (1 - (stats.goalPercent / 100))} transform={`rotate(-90, ${RING_SIZE / 2}, ${RING_SIZE / 2})`} opacity={0.85} />

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

                  {/* ─ Steps Today badge ─ */}
                  <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.1)', marginBottom: 1 }}>
                    <Text style={{ fontSize: 8, fontWeight: '900', color: '#fff', letterSpacing: 1.6, textTransform: 'uppercase' }}>STEPS TODAY</Text>
                  </View>

                  {/* ─ Big step count ─ */}
                  <Text style={[st.ringSteps, { fontSize: 62 }]}>{fmtK(stats.totalSteps)}</Text>
                  <Text style={st.ringLabel}>OF {fmtK(stats.goalSteps)} GOAL</Text>

                  {/* ─ Mindful quote ─ */}
                  <Animated.Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', fontStyle: 'italic', marginTop: 4, letterSpacing: 0.5, textAlign: 'center', opacity: quoteOpacity, paddingHorizontal: 12 }}>
                    {QUOTES[quoteIdx]}
                  </Animated.Text>

                  {/* ─ Divider ─ */}
                  <View style={{ width: 60, height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 8 }} />

                  {/* ─ km / min / days row ─ */}
                  <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: '#fff' }}>{stats.distanceKm.toFixed(1)}</Text>
                      <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', fontWeight: '700' }}>km</Text>
                    </View>
                    <View style={{ width: 1, height: 22, backgroundColor: 'rgba(255,255,255,0.2)' }} />
                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: '#fff' }}>{stats.activeMinutes}</Text>
                      <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', fontWeight: '700' }}>min</Text>
                    </View>
                    <View style={{ width: 1, height: 22, backgroundColor: 'rgba(255,255,255,0.2)' }} />
                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: '#fff' }}>{streak}</Text>
                      <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', fontWeight: '700' }}>days</Text>
                    </View>
                  </View>

                  {/* ─ Weekly Intention Text inside ring (Arc is drawn in SVG now) ─ */}
                  {summary && summary.weeklyGoal > 0 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 4, opacity: 0.9 }}>
                      <Text style={{ fontSize: 9, fontWeight: '800', color: 'rgba(255,255,255,0.7)', letterSpacing: 1.2, textTransform: 'uppercase' }}>Weekly</Text>
                      <Text style={{ fontSize: 10, fontWeight: '900', color: '#7dd3fc' }}>{summary.weeklyGoalPercent}%</Text>
                    </View>
                  )}
                </>
              )}
            </View>
          </View>

          </Animated.View>


        </Animated.View>

        {/* ── ULTRA-SMART BUTTONS ───────────────────────────────── */}
        <Animated.View style={{
          opacity: cardFade,
          transform: [{ translateY: cardSlide }],
          paddingHorizontal: 32,
          gap: 10,
          marginTop: btnMarginTop,
          marginBottom: btnMarginBot,
        }}>
          
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
              
              <View style={{ paddingVertical: 12 }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#0369a1', letterSpacing: 1.5, textTransform: 'uppercase' }}>
                  {sessionTitle}
                </Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* Adjust Target Button */}
          <TouchableOpacity
            style={{ borderRadius: 99, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4, backgroundColor: 'rgba(255,255,255,0.08)' }}
            onPress={() => { Haptics.selectionAsync(); setShowGoalModal(true); }}
            activeOpacity={0.82}
          >
            <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFillObject} />
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.2)', 'rgba(255, 255, 255, 0.05)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
            >
              <View style={{ position: 'absolute', inset: 0, borderRadius: 99, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.3)' }} />
              
              {/* Top shine */}
              <LinearGradient
                colors={['rgba(255,255,255,0.15)', 'transparent']}
                start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.8 }}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 16, borderTopLeftRadius: 99, borderTopRightRadius: 99 }}
              />

              <View style={{ paddingVertical: 10, flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="leaf-outline" size={13} color="#ffffff" style={{ marginRight: 6, opacity: 0.9 }} />
                <Text style={{ fontSize: 12, fontWeight: '800', color: '#ffffff', letterSpacing: 1.5, textTransform: 'uppercase', textShadowColor: 'rgba(0,0,0,0.1)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }}>
                  Intentions
                </Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>

        </Animated.View>

      </ScrollView>

      {/* ── GOAL MODAL ──────────────────────────────────────────────────────── */}
      <GoalModal
        visible={showGoalModal}
        currentWeekly={summary?.weeklyGoal ?? 35000}
        selectedSeed={selectedSeed}
        onSeedSelect={(s) => setSelectedSeed(s as any)}
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
    </ImageBackground>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Goal modal
// ─────────────────────────────────────────────────────────────────────────────
function GoalModal({
  visible, currentWeekly, selectedSeed, onSeedSelect, onClose, onSave, accentColor
}: {
  visible: boolean; currentWeekly: number; selectedSeed: string; onSeedSelect: (s: string) => void; onClose: () => void; onSave: (w: number) => void; accentColor: string;
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
            Set a micro-goal for today's walk to earn generative art, and maintain a weekly habit goal in the background.
          </Text>

          <View style={{ marginBottom: 30, paddingHorizontal: 16 }}>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12, textAlign: 'center' }}>Today's Seed (Optional)</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {/* Pebble */}
              <TouchableOpacity 
                onPress={() => { Haptics.selectionAsync(); onSeedSelect(selectedSeed === 'pebble' ? 'none' : 'pebble'); }}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 20, backgroundColor: selectedSeed === 'pebble' ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: selectedSeed === 'pebble' ? 'rgba(52,211,153,0.4)' : 'rgba(255,255,255,0.08)' }}
                activeOpacity={0.7}
              >
                <Ionicons name="ellipse-outline" size={14} color={selectedSeed === 'pebble' ? '#34d399' : 'rgba(255,255,255,0.4)'} style={{ marginRight: 4 }} />
                <Text style={{ fontSize: 11, fontWeight: '600', color: selectedSeed === 'pebble' ? '#34d399' : 'rgba(255,255,255,0.7)' }}>Pebble</Text>
              </TouchableOpacity>
              
              {/* Calm */}
              <TouchableOpacity 
                onPress={() => { Haptics.selectionAsync(); onSeedSelect(selectedSeed === 'calm' ? 'none' : 'calm'); }}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 20, backgroundColor: selectedSeed === 'calm' ? 'rgba(56,189,248,0.15)' : 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: selectedSeed === 'calm' ? 'rgba(56,189,248,0.4)' : 'rgba(255,255,255,0.08)' }}
                activeOpacity={0.7}
              >
                <Ionicons name="water" size={14} color={selectedSeed === 'calm' ? '#38bdf8' : 'rgba(255,255,255,0.4)'} style={{ marginRight: 4 }} />
                <Text style={{ fontSize: 11, fontWeight: '600', color: selectedSeed === 'calm' ? '#38bdf8' : 'rgba(255,255,255,0.7)' }}>Calm</Text>
              </TouchableOpacity>
              
              {/* Epic */}
              <TouchableOpacity 
                onPress={() => { Haptics.selectionAsync(); onSeedSelect(selectedSeed === 'epic' ? 'none' : 'epic'); }}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 20, backgroundColor: selectedSeed === 'epic' ? 'rgba(192,132,252,0.15)' : 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: selectedSeed === 'epic' ? 'rgba(192,132,252,0.4)' : 'rgba(255,255,255,0.08)' }}
                activeOpacity={0.7}
              >
                <Ionicons name="rose" size={14} color={selectedSeed === 'epic' ? '#c084fc' : 'rgba(255,255,255,0.4)'} style={{ marginRight: 4 }} />
                <Text style={{ fontSize: 11, fontWeight: '600', color: selectedSeed === 'epic' ? '#c084fc' : 'rgba(255,255,255,0.7)' }}>Epic</Text>
              </TouchableOpacity>
            </View>
            <View style={{ height: 16, justifyContent: 'center', alignItems: 'center', marginTop: 8 }}>
              {selectedSeed === 'pebble' && <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontStyle: 'italic', fontWeight: '500' }}>1,500 steps for a quick break 🌱</Text>}
              {selectedSeed === 'calm' && <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontStyle: 'italic', fontWeight: '500' }}>3,000 steps to soothe the mind 🌸</Text>}
              {selectedSeed === 'epic' && <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontStyle: 'italic', fontWeight: '500' }}>8,000 steps to awaken the body 🌺</Text>}
              {selectedSeed === 'none' && <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }}>Planting a seed gives you a goal for today's walk.</Text>}
            </View>
          </View>

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
