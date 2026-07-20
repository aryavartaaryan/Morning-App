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
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, LinearGradient as SvgGrad, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
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
import { getSolarRingPalette } from '@/lib/solarRingPalette';

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
const RING_SIZE   = 230;
const RING_STROKE = 14;
const R_OUTER     = (RING_SIZE - RING_STROKE) / 2;
const CIRCUMF     = 2 * Math.PI * R_OUTER;

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtK(n: number): string { return n >= 1000 ? `${(n/1000).toFixed(1)}k` : String(n); }
function dayLabel(dateStr: string): string {
  const days = ['Su','Mo','Tu','We','Th','Fr','Sa'];
  return days[new Date(dateStr + 'T12:00:00').getDay()];
}

// ── Default stats ─────────────────────────────────────────────────────────────
const DEFAULT_STATS: TodayStats = {
  autoSteps: 0, manualSteps: 0, totalSteps: 0, goalSteps: 5000,
  distanceKm: 0, calories: 0, activeMinutes: 0, goalPercent: 0,
};

// ── Glassy Overlay (permanent peak frost) ────────────────────────────────────
function GlassPulseOverlay() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <BlurView intensity={3} tint="dark" style={StyleSheet.absoluteFillObject} />
      <LinearGradient
        colors={['rgba(0,0,0,0.4)', 'transparent', 'rgba(0,0,0,0.6)']}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
    </View>
  );
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
  const [summary, setSummary]           = useState<any>(null);

  const ringAnim    = useRef(new Animated.Value(0)).current;
  const pulseAnim   = useRef(new Animated.Value(1)).current;
  const glowAnim    = useRef(new Animated.Value(0)).current;
  const cardFade    = useRef(new Animated.Value(0)).current;
  const cardSlide   = useRef(new Animated.Value(30)).current;
  const btnShimmer  = useRef(new Animated.Value(0)).current;
  const walkScrollRef = useRef<ScrollView | null>(null);

  // Sci-fi ring rotations
  const rot1 = useRef(new Animated.Value(0)).current;
  const rot2 = useRef(new Animated.Value(0)).current;
  const rot3 = useRef(new Animated.Value(0)).current;

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

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.07, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.00, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    // Shimmer for walk button
    Animated.loop(
      Animated.timing(btnShimmer, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: true })
    ).start();

    Animated.loop(Animated.timing(rot1, { toValue: 1, duration: 25000, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(rot2, { toValue: 1, duration: 32000, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(rot3, { toValue: 1, duration: 16000, easing: Easing.linear, useNativeDriver: true })).start();
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

  // ── Launch session ──────────────────────────────────────────────────────────
  const launchSession = (type: 'morning' | 'evening' | 'postmeal') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.push({
      pathname: '/step-session',
      params: { sessionType: type },
    } as never);
  };

  // ── Derived values for ring ─────────────────────────────────────────────────
  const glowOpacity = glowAnim.interpolate({ inputRange: [0,1], outputRange: [0.3, 0.8] });
  const shimmerTranslate = btnShimmer.interpolate({ inputRange: [0, 1], outputRange: [-W, W] });

  // ────────────────────────────────────────────────────────────────────────────
  const { bgUri, accentColor, bgKey, solarTimes } = useBgContext();
  const now = new Date();
  const hour = now.getHours() + now.getMinutes() / 60;
  const isNightReal = solarTimes ? (hour < solarTimes.sunrise || hour >= solarTimes.sunset) : (hour < 6 || hour >= 18);
  const stepBgKey = isNightReal ? 'naad_step_night' : 'naad_step';
  
  const solarNoon = solarTimes?.solarNoon ?? 12.5;
  const gpsLat = weather?.lat ?? null;
  const gpsLon = weather?.lon ?? null;
  const palette = getSolarRingPalette(hour, solarNoon, solarTimes, gpsLat, gpsLon, false, weather?.temp);
  const ringHex = palette.ring;
  
  return (
    <ImageBackground
      source={{ uri: getBgSourceSync(stepBgKey as any) }}
      style={[{ flex: 1, backgroundColor: accentColor || BG_DARK }]}
      imageStyle={{ opacity: 1, resizeMode: 'cover' }}>
      <GlassPulseOverlay />
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      {/* Top green nature glow */}
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
        contentContainerStyle={{ paddingBottom: getTabBarClearance(insets.bottom, !!playingId) }}
      >
        {/* ── HEADER ────────────────────────────────────── */}
        <Animated.View style={{ opacity: cardFade, transform: [{ translateY: cardSlide }], marginBottom: 15 }}>
          <View style={{
            width: '100%',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingTop: (Platform.OS === 'android' ? Math.max(insets.top, StatusBar.currentHeight ?? 0) : (insets.top ?? 44)) + 12,
          }}>
            <Text style={{
              fontSize: 28,
              fontWeight: '700',
              color: '#FFF',
              letterSpacing: 0.8,
              fontFamily: 'DancingScript_600SemiBold',
              textShadowColor: 'rgba(96,165,250,0.6)',
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: 18,
              textAlign: 'center',
              marginBottom: 4,
            }}>
              Nada Steps
            </Text>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', letterSpacing: 1.5, fontWeight: '500', textTransform: 'uppercase' }}>
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
          </View>
        </Animated.View>

        {/* ── TAGLINE CARD ────────────────────────────────────── */}
        <Animated.View style={{ opacity: cardFade, transform: [{ translateY: cardSlide }], paddingHorizontal: 24, marginBottom: 20 }}>
          <View style={{
            backgroundColor: 'rgba(20, 30, 25, 0.45)', // Sleek nature tint
            borderRadius: 20,
            padding: 16,
            borderWidth: 1, borderColor: 'rgba(96,165,250,0.15)',
            alignItems: 'center',
            overflow: 'hidden',
          }}>
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
            <LinearGradient
              colors={['rgba(96,165,250,0.08)', 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#60a5fa', letterSpacing: 0.3, marginBottom: 6, textAlign: 'center' }}>
              Do not count calories.. just walk organically.
            </Text>
            <Text style={{ fontSize: 11, fontWeight: '400', color: 'rgba(255,255,255,0.65)', lineHeight: 16, textAlign: 'center' }}>
              Sync your body with nature by barefoot walking on natural clean surfaces if condition optimum, or just walk with shoes and take a nature bath...
            </Text>
          </View>
        </Animated.View>

        {/* View Analytics Button - sleek pill */}
        <Animated.View style={{ opacity: cardFade, transform: [{ translateY: cardSlide }], alignItems: 'center', marginBottom: 25 }}>
          <TouchableOpacity
            onPress={() => { Haptics.selectionAsync(); router.push('/step-analytics' as never); }}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              backgroundColor: 'rgba(255,255,255,0.08)',
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
              paddingHorizontal: 20, paddingVertical: 8,
              borderRadius: 24,
              overflow: 'hidden',
            }}
            activeOpacity={0.8}
          >
            <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFillObject} />
            <Ionicons name="bar-chart" size={13} color="#fff" />
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#fff', letterSpacing: 1.2, textTransform: 'uppercase' }}>View Analytics</Text>
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
        <Animated.View style={[st.ringWrapper, { opacity: cardFade, transform: [{ scale: pulseAnim }] }]}>
          <View style={{ width: RING_SIZE, height: RING_SIZE }}>

            {/* Inner zone - solid clean frosted glass */}
            <View style={{
              position: 'absolute', top: 0, left: 0, width: RING_SIZE, height: RING_SIZE, borderRadius: RING_SIZE / 2,
              overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)'
            }}>
              <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFillObject} />
              <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: pulseAnim.interpolate({ inputRange: [1, 1.07], outputRange: [0.3, 0.9] }) }]}>
                <LinearGradient
                  colors={[`${ringHex}50`, `${ringHex}00`]}
                  start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
                  style={StyleSheet.absoluteFillObject} />
              </Animated.View>
            </View>

            {/* ── CLEAN PREMIUM THIN RING ─────────────────────────────────── */}
            <View style={{ shadowColor: ringHex, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.25, shadowRadius: 15, elevation: 8 }}>
              <Svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
                {/* Track */}
                <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={R_OUTER} fill="none" stroke={ringHex} strokeOpacity={0.15} strokeWidth={3} />
                {/* Main crisp stroke */}
                <Circle
                  cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={R_OUTER}
                  fill="none" stroke={ringHex} strokeWidth={3} strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * R_OUTER} strokeDashoffset={2 * Math.PI * R_OUTER * (1 - (stats.goalPercent / 100))}
                  transform={`rotate(-90, ${RING_SIZE / 2}, ${RING_SIZE / 2})`} opacity={0.96}
                />
              </Svg>
            </View>

            {/* Centre content */}
            <View style={st.ringCentre}>
              
              {weather ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, opacity: 0.95 }}>
                  <Text style={{ fontSize: 16 }}>{weather.emoji}</Text>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#38bdf8', marginLeft: 6, textTransform: 'uppercase', letterSpacing: 0.8, textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }}>
                    {weather.temp}° • {weather.condition}
                  </Text>
                </View>
              ) : (
                <View style={{ height: 20, marginBottom: 10 }} />
              )}
              
              {/* Badge */}
              <View style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.12)', marginBottom: 6 }}>
                <Text style={{ fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 1.5 }}>STEPS TODAY</Text>
              </View>
              
              <Text style={st.ringSteps}>{fmtK(stats.totalSteps)}</Text>
              <Text style={st.ringLabel}>OF {fmtK(stats.goalSteps)} GOAL</Text>
              
              <View style={st.ringDivider} />
              
              <View style={{ flexDirection: 'row', gap: 16, marginTop: 4, alignItems: 'center' }}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#fff' }}>{stats.distanceKm.toFixed(1)}</Text>
                  <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', fontWeight: '600' }}>km</Text>
                </View>
                <View style={{ width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.2)' }} />
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#fff' }}>{stats.activeMinutes}</Text>
                  <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', fontWeight: '600' }}>min</Text>
                </View>
                <View style={{ width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.2)' }} />
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#fff' }}>{streak}</Text>
                  <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', fontWeight: '600' }}>days</Text>
                </View>
              </View>
              
              <View style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 99, backgroundColor: 'rgba(96,165,250,0.2)', borderWidth: 1, borderColor: 'rgba(96,165,250,0.4)', marginTop: 14 }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#93c5fd', letterSpacing: 0.6 }}>{stats.goalPercent}% complete</Text>
              </View>
              
              {/* Yesterday motivational display */}
              {stats.totalSteps === 0 && yesterdaySteps > 0 && (
                <View style={{ marginTop: 10, alignItems: 'center', opacity: 0.85 }}>
                  <Text style={{ fontSize: 8, fontWeight: '700', color: 'rgba(59,130,246,0.8)', letterSpacing: 1.2 }}>YESTERDAY</Text>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#60a5fa' }}>{fmtK(yesterdaySteps)} steps</Text>
                </View>
              )}
            </View>

          </View>
          
          {/* ── WEEKLY PROGRESS BAR ───────────────────────────────────────── */}
          {summary && summary.weeklyGoal > 0 && (
            <View style={{ width: '100%', paddingHorizontal: 32, marginTop: 30 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.7)', letterSpacing: 1.5, textTransform: 'uppercase' }}>Weekly Goal</Text>
                <Text style={{ fontSize: 13, fontWeight: '900', color: '#60a5fa' }}>{summary.weeklyGoalPercent}%</Text>
              </View>
              
              <View style={{ height: 10, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 5, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4 }}>
                <View style={{ 
                  position: 'absolute', left: 0, top: 0, bottom: 0, 
                  width: `${Math.min(100, summary.weeklyGoalPercent)}%`, 
                  backgroundColor: '#60a5fa', borderRadius: 5 
                }}>
                  <LinearGradient
                    colors={['rgba(255,255,255,0.3)', 'transparent']}
                    start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                  />
                </View>
              </View>
              
              <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 8, textAlign: 'center', fontWeight: '700', letterSpacing: 0.5 }}>
                {summary.weeklySteps.toLocaleString()} <Text style={{fontWeight: '400'}}>of</Text> {summary.weeklyGoal.toLocaleString()} <Text style={{fontWeight: '400'}}>steps</Text>
              </Text>
            </View>
          )}
        </Animated.View>

        {/* ── ULTRA-SMART BUTTONS ───────────────────────────────── */}
        <Animated.View style={{ opacity: cardFade, transform: [{ translateY: cardSlide }], paddingHorizontal: 32, gap: 14, marginTop: 15, marginBottom: 20 }}>
          
          {/* Start Nature Walk Button */}
          <TouchableOpacity
            onPress={() => launchSession(sessionType)}
            activeOpacity={0.82}
            style={{ borderRadius: 24, overflow: 'hidden', shadowColor: '#0ea5e9', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 18, elevation: 8 }}
          >
            <LinearGradient
              colors={['rgba(56,189,248,0.3)', 'rgba(14,165,233,0.15)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
            >
              <BlurView intensity={25} tint="light" style={StyleSheet.absoluteFillObject} />
              <View style={{ position: 'absolute', inset: 0, borderRadius: 24, borderWidth: 1.5, borderColor: 'rgba(56,189,248,0.4)' }} />
              
              {/* Top shine */}
              <LinearGradient
                colors={['rgba(255,255,255,0.15)', 'transparent']}
                start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.8 }}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 26, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
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
                  colors={['transparent', 'rgba(255,255,255,0.15)', 'transparent']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={{ flex: 1 }}
                />
              </Animated.View>
              
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.8, textShadowColor: 'rgba(14,165,233,0.6)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12 }}>
                {sessionTitle}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Adjust Target Button */}
          <TouchableOpacity
            style={{ borderRadius: 24, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 6 }}
            onPress={() => { Haptics.selectionAsync(); setShowGoalModal(true); }}
            activeOpacity={0.82}
          >
            <LinearGradient
              colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.04)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
            >
              <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFillObject} />
              <View style={{ position: 'absolute', inset: 0, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }} />
              
              <Text style={{ fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.95)', letterSpacing: 0.6 }}>
                {stats.goalSteps > 0 ? "Adjust Today's Intention" : "Set Today's Intention"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

        </Animated.View>

      </ScrollView>

      {/* ── GOAL MODAL ──────────────────────────────────────────────────────── */}
      <GoalModal
        visible={showGoalModal}
        current={stats.goalSteps}
        currentWeekly={summary?.weeklyGoal ?? 35000}
        onClose={() => setShowGoalModal(false)}
        onSave={async (d, w) => {
          await StepCounter.setDailyGoal(d);
          await StepCounter.setWeeklyGoal(w);
          setShowGoalModal(false);
          await refreshStats();
        }}
      />
    </ImageBackground>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Goal modal
// ─────────────────────────────────────────────────────────────────────────────
function GoalModal({
  visible, current, currentWeekly, onClose, onSave,
}: {
  visible: boolean; current: number; currentWeekly: number; onClose: () => void; onSave: (d: number, w: number) => void;
}) {
  const PRESETS_DAILY = [
    { value: 3000, label: 'Grounding' },
    { value: 5000, label: 'Harmony' },
    { value: 6000, label: 'Vitality' },
    { value: 8000, label: 'Ascension' },
    { value: 10000, label: 'Awakened' },
    { value: 12000, label: 'Limitless' }
  ];
  const PRESETS_WEEKLY = [
    { value: 21000, label: 'Foundation' },
    { value: 35000, label: 'Balance' },
    { value: 50000, label: 'Momentum' },
    { value: 70000, label: 'Mastery' }
  ];
  const [selected, setSelected] = useState(current);
  const [selectedWeekly, setSelectedWeekly] = useState(currentWeekly);
  const [tab, setTab] = useState<'daily'|'weekly'>('daily');

  useEffect(() => { 
    if (visible) {
      setSelected(current); 
      setSelectedWeekly(currentWeekly);
    }
  }, [visible, current, currentWeekly]);

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
            colors={['rgba(96,165,250,0.5)', 'rgba(59,130,246,0.3)', 'rgba(96,165,250,0.5)']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, borderTopLeftRadius: 28, borderTopRightRadius: 28 }}
          />
          <View style={gm.handle} />
          
          <Text style={gm.title}>Set Your Intentions</Text>
          
          <View style={gm.tabs}>
            <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setTab('daily'); }} style={[gm.tabBtn, tab === 'daily' && gm.tabBtnActive]}>
              <Text style={[gm.tabTxt, tab === 'daily' && gm.tabTxtActive]}>Daily Minimum</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setTab('weekly'); }} style={[gm.tabBtn, tab === 'weekly' && gm.tabBtnActive]}>
              <Text style={[gm.tabTxt, tab === 'weekly' && gm.tabTxtActive]}>Weekly Goal</Text>
            </TouchableOpacity>
          </View>

          <View style={gm.presets}>
            {(tab === 'daily' ? PRESETS_DAILY : PRESETS_WEEKLY).map(p => {
              const isSel = tab === 'daily' ? (selected === p.value) : (selectedWeekly === p.value);
              return (
                <TouchableOpacity
                  key={p.value}
                  onPress={() => { Haptics.selectionAsync(); tab === 'daily' ? setSelected(p.value) : setSelectedWeekly(p.value); }}
                  style={[gm.preset, tab === 'weekly' && { minWidth: '45%' }, isSel && { backgroundColor: 'rgba(96,165,250,0.2)', borderColor: ACCENT }]}
                >
                  {isSel && (
                    <LinearGradient
                      colors={['rgba(96,165,250,0.15)', 'transparent']}
                      style={StyleSheet.absoluteFillObject}
                    />
                  )}
                  <Text style={[gm.presetTxt, isSel && { color: ACCENT }]}>
                    {p.value.toLocaleString()}
                  </Text>
                  <Text style={[{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 4, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 }, isSel && { color: ACCENT + 'CC' }]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={{ borderRadius: 18, overflow: 'hidden', marginBottom: 10, shadowColor: ACCENT, shadowOpacity: 0.4, shadowRadius: 14, elevation: 6 }}
            onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); onSave(selected, selectedWeekly); }}
          >
            <LinearGradient
              colors={['#60a5fa', '#2563eb']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ paddingVertical: 16, alignItems: 'center' }}
            >
              <LinearGradient
                colors={['rgba(255,255,255,0.18)', 'transparent']}
                start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.5 }}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 24, borderTopLeftRadius: 18, borderTopRightRadius: 18 }}
              />
              <Text style={gm.saveTxt}>Save Targets</Text>
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
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.78)' },
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
    margin: 20, padding: 24, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.50)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center', gap: 8,
  },
  noSensorEmoji: { fontSize: 36 },
  noSensorTitle: { fontSize: 16, fontWeight: '800', color: '#fff' },
  noSensorSub:   { fontSize: 13, color: 'rgba(255,255,255,0.45)', textAlign: 'center', lineHeight: 18 },

  ringWrapper: {
    alignSelf: 'center',
    width:  RING_SIZE + 40,
    height: RING_SIZE + 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
    marginBottom: 5,
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
  ringSteps:   { fontSize: 44, fontWeight: '900', color: '#ffffff', letterSpacing: -1, textShadowColor: 'rgba(96,165,250,0.5)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 15 },
  ringLabel:   { fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: '800', letterSpacing: 2.2, marginTop: -2 },
  ringDivider: { width: 60, height: 1, backgroundColor: 'rgba(96,165,250,0.3)', marginVertical: 10 },
});
