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
} from 'react-native';
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

const { width: W } = Dimensions.get('window');

// ── Design tokens ─────────────────────────────────────────────────────────────
const ACCENT   = '#38BDF8';
const GREEN    = '#34D399';
const TEAL     = '#2DD4BF';
const GOLD     = '#FCD34D';
const BG_DARK  = '#0A0A0F';
// Frosted glass tokens — rich, not transparent
const GLASS_BG     = 'rgba(15,15,30,0.72)';
const GLASS_BORDER = 'rgba(255,255,255,0.13)';
const GLASS_SHINE  = 'rgba(255,255,255,0.07)';

// ── Ring geometry ─────────────────────────────────────────────────────────────
const RING_SIZE   = Math.min(W - 60, 210);
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

// ── Glassy Overlay ────────────────────────────────────────────────────────────
function GlassPulseOverlay() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <LinearGradient
        colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.11)', 'rgba(255,255,255,0.03)', 'transparent']}
        start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 1 }}
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
    } catch (err) {
      console.warn("Failed to fetch step stats:", err);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    walkScrollRef.current?.scrollTo({ y: 0, animated: false });
    refreshStats();
  }, [refreshStats]));

  // ── Boot ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
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

      } catch (err) {
        console.warn("Boot error in walk.tsx:", err);
      } finally {
        setLoading(false);
      }
    })();

    Animated.parallel([
      Animated.timing(cardFade,  { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(cardSlide, { toValue: 0, duration: 600, easing: Easing.out(Easing.exp), useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 3000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.00, duration: 3000, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
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
    const t = setInterval(() => {
      StepCounter.snapshotTodayToHistory();
      refreshStats();
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
      duration: 1200,
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
  const glowOpacity = glowAnim.interpolate({ inputRange: [0,1], outputRange: [0.5, 1] });
  const shimmerTranslate = btnShimmer.interpolate({ inputRange: [0, 1], outputRange: [-W, W] });

  // ────────────────────────────────────────────────────────────────────────────
  const { bgUri, accentColor, bgKey, solarTimes } = useBgContext();
  const hour = new Date().getHours() + new Date().getMinutes() / 60;
  const isNightReal = solarTimes ? (hour < solarTimes.sunrise || hour >= solarTimes.sunset) : (hour < 6 || hour >= 18);
  const stepBgKey = isNightReal ? 'naad_step_night' : 'naad_step';
  
  return (
    <ImageBackground
      source={{ uri: getBgSourceSync(stepBgKey as any) }}
      style={[{ flex: 1, backgroundColor: accentColor || BG_DARK }]}
      imageStyle={{ opacity: 1, resizeMode: 'cover' }}>
      {!isNightReal && <GlassPulseOverlay />}
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      {/* Top violet aurora glow */}
      <Animated.View
        style={[StyleSheet.absoluteFillObject, { opacity: glowOpacity, pointerEvents: 'none' }]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={['rgba(124,58,237,0.22)', 'transparent']}
          style={{ position: 'absolute', top: -80, left: -80, width: 380, height: 380, borderRadius: 190 }}
        />
        <LinearGradient
          colors={['rgba(45,212,191,0.10)', 'transparent']}
          style={{ position: 'absolute', top: 60, right: -60, width: 280, height: 280, borderRadius: 140 }}
        />
      </Animated.View>

      <ScrollView
        ref={walkScrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: getTabBarClearance(insets.bottom, !!playingId) }}
      >
        {/* ── HEADER — deep frosted glass ────────────────────────────────────── */}
        <Animated.View style={{ opacity: cardFade, transform: [{ translateY: cardSlide }], marginBottom: 10 }}>
          <View style={{
            width: '100%',
            overflow: 'hidden',
            paddingHorizontal: 20,
            paddingTop: (Platform.OS === 'android' ? Math.max(insets.top, StatusBar.currentHeight ?? 0) : (insets.top ?? 44)) + 4,
            paddingBottom: 16,
            alignItems: 'center',
            backgroundColor: 'transparent',
          }}>
            {/* Frosted shine shimmer at top */}
            <LinearGradient
              colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.03)', 'transparent']}
              start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.7 }}
              style={StyleSheet.absoluteFillObject}
              pointerEvents="none"
            />
            {/* Subtle violet bottom glow line */}
            <LinearGradient
              colors={['transparent', 'rgba(56,189,248,0.18)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1 }}
              pointerEvents="none"
            />

            {/* Title */}
            <Text style={{
              fontSize: 22,
              fontWeight: '700',
              color: '#FFF8F0',
              letterSpacing: 0.6,
              fontFamily: 'DancingScript_600SemiBold',
              textShadowColor: 'rgba(56,189,248,0.55)',
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: 14,
              textAlign: 'center',
              marginBottom: 4,
            }}>
              Nada Steps
            </Text>
            {/* Date */}
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.48)', letterSpacing: 0.4, fontWeight: '300', textAlign: 'center' }}>
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
            
            {/* Divider */}
            <View style={{ width: 40, height: 1, backgroundColor: 'rgba(56,189,248,0.28)', marginVertical: 10 }} />

            {/* Tagline card — frosted glass */}
            <View style={{
              width: '100%',
              paddingHorizontal: 14, paddingVertical: 10,
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderRadius: 16,
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
              overflow: 'hidden',
            }}>
              <LinearGradient
                colors={['rgba(52,211,153,0.10)', 'transparent']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#34D399', textAlign: 'center', marginBottom: 3, letterSpacing: 0.8 }}>
                Do not count calories.. just walk organically.
              </Text>
              <Text style={{ fontSize: 10, fontWeight: '400', color: 'rgba(255,255,255,0.68)', textAlign: 'center', lineHeight: 15 }}>
                Sync your body with nature by barefoot walking on natural clean surfaces if condition optimum, or just walk with shoes and take a nature bath....
              </Text>
            </View>

            {/* View Analytics button */}
            <View style={{ marginTop: 12 }}>
              <TouchableOpacity
                onPress={() => { Haptics.selectionAsync(); router.push('/step-analytics' as never); }}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
                  paddingHorizontal: 18, paddingVertical: 9,
                  borderRadius: 24,
                  shadowColor: '#38bdf8', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 4,
                  overflow: 'hidden',
                }}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['rgba(56,189,248,0.15)', 'transparent']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                />
                <Ionicons name="bar-chart" size={13} color="#c4b5fd" />
                <Text style={{ fontSize: 11, fontWeight: '800', color: '#e9d5ff', letterSpacing: 1.2, textTransform: 'uppercase' }}>View Analytics</Text>
              </TouchableOpacity>
            </View>
          </View>
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
        <Animated.View style={[st.ringWrapper, { opacity: cardFade }]}>
          <View style={{ width: RING_SIZE, height: RING_SIZE }}>

            {/* Outer breathing aura */}
            <Animated.View style={{ position: 'absolute', width: RING_SIZE + 60, height: RING_SIZE + 60, borderRadius: (RING_SIZE + 60) / 2, backgroundColor: ACCENT, opacity: pulseAnim.interpolate({ inputRange: [1, 1.06], outputRange: [0.03, 0.09] }), transform: [{ scale: pulseAnim }], top: -30, left: -30 }} />
            <Animated.View style={{ position: 'absolute', width: RING_SIZE + 28, height: RING_SIZE + 28, borderRadius: (RING_SIZE + 28) / 2, backgroundColor: TEAL, opacity: pulseAnim.interpolate({ inputRange: [1, 1.06], outputRange: [0.02, 0.06] }), transform: [{ scale: pulseAnim }], top: -14, left: -14 }} />

            {/* Inner disc removed for transparency */}

            {/* ── SLEEK PREMIUM FUSION RING ─────────────────────────────────── */}
            <View style={{ shadowColor: '#38bdf8', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 20, elevation: 10 }}>
              <Svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} style={{ transform: [{ rotate: '-90deg' }] }}>
                <Defs>
                  <SvgGrad id="sleekGlow" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0"   stopColor="#34D399" stopOpacity="1" />
                    <Stop offset="0.5" stopColor="#38bdf8" stopOpacity="1" />
                    <Stop offset="1"   stopColor="#38bdf8" stopOpacity="1" />
                  </SvgGrad>
                  <SvgGrad id="trackGrad" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor="#ffffff" stopOpacity="0.25" />
                    <Stop offset="1" stopColor="#ffffff" stopOpacity="0.10" />
                  </SvgGrad>
                </Defs>
                {/* Track */}
                <Circle cx={RING_SIZE/2} cy={RING_SIZE/2} r={R_OUTER - 4} fill="none" stroke="url(#trackGrad)" strokeWidth={RING_STROKE + 2} />
                {/* Ambient Glow */}
                <Circle cx={RING_SIZE/2} cy={RING_SIZE/2} r={R_OUTER - 4} fill="none" stroke="url(#sleekGlow)" strokeWidth={RING_STROKE + 14} strokeLinecap="round" strokeDasharray={2 * Math.PI * (R_OUTER - 4)} strokeDashoffset={2 * Math.PI * (R_OUTER - 4) * (1 - (stats.goalPercent / 100))} opacity={0.35} />
                {/* Mid Glow */}
                <Circle cx={RING_SIZE/2} cy={RING_SIZE/2} r={R_OUTER - 4} fill="none" stroke="url(#sleekGlow)" strokeWidth={RING_STROKE + 6} strokeLinecap="round" strokeDasharray={2 * Math.PI * (R_OUTER - 4)} strokeDashoffset={2 * Math.PI * (R_OUTER - 4) * (1 - (stats.goalPercent / 100))} opacity={0.7} />
                {/* Core Crisp Arc */}
                <Circle cx={RING_SIZE/2} cy={RING_SIZE/2} r={R_OUTER - 4} fill="none" stroke="url(#sleekGlow)" strokeWidth={RING_STROKE} strokeLinecap="round" strokeDasharray={2 * Math.PI * (R_OUTER - 4)} strokeDashoffset={2 * Math.PI * (R_OUTER - 4) * (1 - (stats.goalPercent / 100))} opacity={1} />
              </Svg>
            </View>

            {/* Rotating Outer HUD (Sleek) */}
            <Animated.View style={{ position: 'absolute', width: RING_SIZE, height: RING_SIZE, transform: [{ rotate: rot1.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }} pointerEvents="none">
              <Svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
                <Circle cx={RING_SIZE/2} cy={RING_SIZE/2} r={R_OUTER + 12} stroke="#38bdf8" strokeWidth={1} fill="none" strokeDasharray="2 12" opacity={0.5} />
                <Circle cx={RING_SIZE/2} cy={RING_SIZE/2} r={R_OUTER + 12} stroke="#bae6fd" strokeWidth={1.5} fill="none" strokeDasharray="1 24" opacity={0.7} />
              </Svg>
            </Animated.View>

            {/* Rotating Inner HUD (Sleek) */}
            <Animated.View style={{ position: 'absolute', width: RING_SIZE, height: RING_SIZE, transform: [{ rotate: rot2.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] }) }] }} pointerEvents="none">
              <Svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
                <Circle cx={RING_SIZE/2} cy={RING_SIZE/2} r={R_OUTER - 18} stroke="#38bdf8" strokeWidth={1} fill="none" strokeDasharray="5 20" opacity={0.4} />
                <Circle cx={RING_SIZE/2} cy={RING_SIZE/2} r={R_OUTER - 18} stroke="#ffffff" strokeWidth={1.5} fill="none" strokeDasharray="0.5 35" opacity={0.6} strokeLinecap="round" />
              </Svg>
            </Animated.View>

            {/* Centre content */}
            <View style={st.ringCentre}>
              {/* Badge */}
              <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 99, backgroundColor: 'rgba(56,189,248,0.18)', borderWidth: 1, borderColor: 'rgba(56,189,248,0.55)', marginBottom: 8 }}>
                <Text style={{ fontSize: 7, fontWeight: '900', color: '#e9d5ff', letterSpacing: 1.6 }}>👣  STEPS TODAY</Text>
              </View>
              <Text style={st.ringSteps}>{fmtK(stats.totalSteps)}</Text>
              <Text style={st.ringLabel}>OF {fmtK(stats.goalSteps)} GOAL</Text>
              <View style={st.ringDivider} />
              
              <View style={{ flexDirection: 'row', gap: 14, marginTop: 4, alignItems: 'center' }}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>{stats.distanceKm.toFixed(1)}</Text>
                  <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>km</Text>
                </View>
                <View style={{ width: 1, height: 18, backgroundColor: 'rgba(255,255,255,0.14)' }} />
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>{stats.activeMinutes}</Text>
                  <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>min</Text>
                </View>
                <View style={{ width: 1, height: 18, backgroundColor: 'rgba(255,255,255,0.14)' }} />
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>{streak}</Text>
                  <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>days</Text>
                </View>
              </View>
              
              <View style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 99, backgroundColor: 'rgba(56,189,248,0.20)', borderWidth: 1, borderColor: 'rgba(56,189,248,0.50)', marginTop: 12 }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: ACCENT, letterSpacing: 0.4 }}>{stats.goalPercent}% complete</Text>
              </View>
            </View>

          </View>
        </Animated.View>

        {/* ── ULTRA-SMART NATURE WALK BUTTON ───────────────────────────────── */}
        <Animated.View style={{ opacity: cardFade, transform: [{ translateY: cardSlide }], marginHorizontal: 20, marginTop: 8, marginBottom: 10 }}>
          <TouchableOpacity
            onPress={() => launchSession(sessionType)}
            activeOpacity={0.82}
            style={{ borderRadius: 20, overflow: 'hidden', shadowColor: '#2DD4BF', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8, alignSelf: 'center', width: '85%' }}
          >
            {/* Translucent button base */}
            <LinearGradient
              colors={['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.05)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ paddingVertical: 12, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
            >
              {/* Border overlay */}
              <View style={{ position: 'absolute', inset: 0, borderRadius: 20, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)' }} />
              {/* Top shine */}
              <LinearGradient
                colors={['rgba(255,255,255,0.12)', 'transparent']}
                start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.5 }}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 24, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}
              />
              {/* Animated shimmer sweep */}
              <Animated.View
                style={{
                  position: 'absolute', top: 0, bottom: 0, width: 60,
                  transform: [{ translateX: shimmerTranslate }],
                }}
                pointerEvents="none"
              >
                <LinearGradient
                  colors={['transparent', 'rgba(255,255,255,0.10)', 'transparent']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={{ flex: 1 }}
                />
              </Animated.View>
              {/* Animated glow pulse overlay */}
              <Animated.View
                pointerEvents="none"
                style={{
                  position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
                  backgroundColor: 'rgba(45,212,191,0.14)',
                  opacity: glowOpacity,
                  borderRadius: 20,
                }}
              />

              <Text style={{ fontSize: 13, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.6, textShadowColor: 'rgba(45,212,191,0.5)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 }}>
                {sessionTitle}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* ── ULTRA-SMART MODIFY TARGET BUTTON ─────────────────────────────── */}
        <Animated.View
          style={[{ opacity: cardFade, transform: [{ translateY: cardSlide }], marginHorizontal: 20, marginBottom: 16 }]}
        >
          <TouchableOpacity
            style={{ borderRadius: 20, overflow: 'hidden', shadowColor: '#34D399', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 14, elevation: 6, alignSelf: 'center', width: '85%' }}
            onPress={() => { Haptics.selectionAsync(); setShowGoalModal(true); }}
            activeOpacity={0.82}
          >
            <LinearGradient
              colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.04)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ paddingVertical: 12, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
            >
              {/* Border */}
              <View style={{ position: 'absolute', inset: 0, borderRadius: 20, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)' }} />
              {/* Top shine */}
              <LinearGradient
                colors={['rgba(255,255,255,0.09)', 'transparent']}
                start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.5 }}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 24, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}
              />
              
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff', letterSpacing: 0.6 }}>
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
        onClose={() => setShowGoalModal(false)}
        onSave={async (g) => {
          await StepCounter.setDailyGoal(g);
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
  visible, current, onClose, onSave,
}: {
  visible: boolean; current: number; onClose: () => void; onSave: (g: number) => void;
}) {
  const PRESETS = [
    { value: 3000, label: 'Grounding' },
    { value: 5000, label: 'Harmony' },
    { value: 6000, label: 'Vitality' },
    { value: 8000, label: 'Ascension' },
    { value: 10000, label: 'Awakened' },
    { value: 12000, label: 'Limitless' }
  ];
  const [selected, setSelected] = useState(current);
  useEffect(() => { if (visible) setSelected(current); }, [visible, current]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={gm.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View style={gm.sheet}>
          <LinearGradient colors={['rgba(20,10,50,0.98)', 'rgba(8,8,20,0.99)']} style={StyleSheet.absoluteFillObject} />
          {/* Top frost shine */}
          <LinearGradient
            colors={['rgba(255,255,255,0.08)', 'transparent']}
            start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.4 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 60, borderTopLeftRadius: 28, borderTopRightRadius: 28 }}
          />
          {/* Top border glow */}
          <LinearGradient
            colors={['rgba(56,189,248,0.5)', 'rgba(45,212,191,0.3)', 'rgba(56,189,248,0.5)']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, borderTopLeftRadius: 28, borderTopRightRadius: 28 }}
          />
          <View style={gm.handle} />
          <Text style={gm.title}>Today's Step Target</Text>
          <Text style={gm.sub}>Choose your sacred goal for today</Text>
          <View style={gm.presets}>
            {PRESETS.map(p => (
              <TouchableOpacity
                key={p.value}
                onPress={() => { Haptics.selectionAsync(); setSelected(p.value); }}
                style={[gm.preset, selected === p.value && { backgroundColor: 'rgba(56,189,248,0.22)', borderColor: ACCENT }]}
              >
                {selected === p.value && (
                  <LinearGradient
                    colors={['rgba(56,189,248,0.18)', 'transparent']}
                    style={StyleSheet.absoluteFillObject}
                  />
                )}
                <Text style={[gm.presetTxt, selected === p.value && { color: ACCENT }]}>
                  {p.value.toLocaleString()}
                </Text>
                <Text style={[{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 4, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 }, selected === p.value && { color: ACCENT + 'CC' }]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={{ borderRadius: 18, overflow: 'hidden', marginBottom: 10, shadowColor: ACCENT, shadowOpacity: 0.4, shadowRadius: 14, elevation: 6 }}
            onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); onSave(selected); }}
          >
            <LinearGradient
              colors={['#38bdf8', '#0284c7']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ paddingVertical: 16, alignItems: 'center' }}
            >
              <LinearGradient
                colors={['rgba(255,255,255,0.18)', 'transparent']}
                start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.5 }}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 24, borderTopLeftRadius: 18, borderTopRightRadius: 18 }}
              />
              <Text style={gm.saveTxt}>Save Target</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={{ paddingVertical: 12 }}>
            <Text style={{ color: 'rgba(255,255,255,0.30)', textAlign: 'center', fontSize: 14 }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const ACCENT_MOD = '#38BDF8';
const BORDER_MOD = 'rgba(255,255,255,0.10)';
const CARD_MOD   = 'rgba(255,255,255,0.06)';

const gm = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.78)' },
  sheet:   { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 42, overflow: 'hidden' },
  handle:  { width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  title:   { fontSize: 20, fontWeight: '800', color: '#fff', textAlign: 'center' },
  sub:     { fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 4, marginBottom: 24 },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 },
  preset:  { flex: 1, minWidth: '28%', paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: BORDER_MOD, backgroundColor: CARD_MOD, alignItems: 'center', overflow: 'hidden' },
  presetTxt: { color: 'rgba(255,255,255,0.65)', fontWeight: '700', fontSize: 15 },
  saveBtn: { borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 8 },
  saveTxt: { color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 0.5 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  noSensorCard: {
    margin: 20, padding: 24, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.40)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', gap: 8,
  },
  noSensorEmoji: { fontSize: 36 },
  noSensorTitle: { fontSize: 16, fontWeight: '800', color: '#fff' },
  noSensorSub:   { fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: 18 },

  ringWrapper: {
    alignSelf: 'center',
    width:  RING_SIZE + 40,
    height: RING_SIZE + 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 10,
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
  ringSteps:   { fontSize: 40, fontWeight: '900', color: '#ffffff', letterSpacing: -1.5, textShadowColor: 'rgba(56,189,248,0.7)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 18 },
  ringLabel:   { fontSize: 9, color: 'rgba(255,255,255,0.55)', fontWeight: '800', letterSpacing: 2.2, marginTop: -2 },
  ringDivider: { width: 52, height: 1, backgroundColor: 'rgba(56,189,248,0.40)', marginVertical: 8 },

  quickRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16 },
  quickBtn: {
    flex: 1, borderRadius: 20, borderWidth: 1, backgroundColor: 'rgba(0,0,0,0.35)', borderColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
  },
  quickLabel: { fontSize: 13, fontWeight: '800' },
  quickSub:   { fontSize: 9, color: 'rgba(255,255,255,0.45)', fontWeight: '600', marginTop: 1 },
});
