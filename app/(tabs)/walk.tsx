/**
 * walk.tsx — Step Counter Home Tab
 * ─────────────────────────────────────────────────────────────────────────────
 * Beautiful main hub for the Naad step-counter feature.
 * Displays: circular progress ring, 4 metric chips, 3 session cards,
 * 7-day bar chart, and deep-link buttons to Analytics.
 *
 * All sensor work is inside StepCounterService.kt (foreground service).
 * This file is presentation-only — it reads from StepCounter.ts wrapper.
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
  Easing,
  Modal,
  AppState,
  type AppStateStatus,
  ImageBackground,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, LinearGradient as SvgGrad, Stop, Path, G, Text as SvgText, Rect } from 'react-native-svg';
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

const { width: W } = Dimensions.get('window');

// ── Design tokens ─────────────────────────────────────────────────────────────
const ACCENT   = '#A78BFA';   // violet-400
const GREEN    = '#34D399';
const ORANGE   = '#FB923C';
const PINK     = '#F472B6';
const TEAL     = '#2DD4BF';
const GOLD     = '#FCD34D';
const BG_DARK  = '#0A0A0F';
const CARD     = 'rgba(255,255,255,0.06)';
const BORDER   = 'rgba(255,255,255,0.10)';

// ── Ring geometry ─────────────────────────────────────────────────────────────
const RING_SIZE   = Math.min(W - 32, 280);
const RING_STROKE = 4;
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
  autoSteps: 0, manualSteps: 0, totalSteps: 0, goalSteps: 8000,
  distanceKm: 0, calories: 0, activeMinutes: 0, goalPercent: 0,
};

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
  const [sessionTitle, setSessionTitle] = useState('Start Morning walk with Naad sounds......');
  const [sessionType, setSessionType]   = useState<'morning' | 'evening'>('morning');
  // Drives SVG strokeDashoffset via listener (avoids createAnimatedComponent crash)
  const [ringDashOffset, setRingDashOffset] = useState(CIRCUMF);

  const ringAnim    = useRef(new Animated.Value(0)).current;
  const pulseAnim   = useRef(new Animated.Value(1)).current;
  const glowAnim    = useRef(new Animated.Value(0)).current;
  const cardFade    = useRef(new Animated.Value(0)).current;
  const cardSlide   = useRef(new Animated.Value(30)).current;
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
          setSessionTitle('Start Morning walk with Naad sounds......');
          setSessionType('morning');
        } else if (hour >= solar.solarNoon + 1 && hour < solar.sunset + 1) {
          setSessionTitle('Start Evening walk with Naad sounds......');
          setSessionType('evening');
        } else {
          setSessionTitle('Have a walk with Naad sounds......');
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

    // Entrance animation (always run, synchronously outside async)
    Animated.parallel([
      Animated.timing(cardFade,  { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(cardSlide, { toValue: 0, duration: 600, easing: Easing.out(Easing.exp), useNativeDriver: true }),
    ]).start();

    // Pulse loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 3000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.00, duration: 3000, useNativeDriver: true }),
      ])
    ).start();

    // Glow loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(Animated.timing(rot1, { toValue: 1, duration: 25000, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(rot2, { toValue: 1, duration: 32000, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(rot3, { toValue: 1, duration: 16000, easing: Easing.linear, useNativeDriver: true })).start();
  }, []);

  // ── App foreground → refresh ────────────────────────────────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') refreshStats();
    });
    return () => sub.remove();
  }, []);

  // ── Daily snapshot every 5 min ─────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => {
      StepCounter.snapshotTodayToHistory();
      refreshStats();
    }, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  // ── Live daily-step events ─────────────────────────────────────────────────
  useEffect(() => {
    const sub = StepCounter.onDailyStepUpdate((_steps) => {
      refreshStats();
    });
    return () => sub.remove();
  }, []);

  // ── Ring animation follows goalPercent ─────────────────────────────────────
  useEffect(() => {
    Animated.timing(ringAnim, {
      toValue: stats.goalPercent / 100,
      duration: 1200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    // Sync to state so plain SVG Circle gets the value (avoids createAnimatedComponent)
    const id = ringAnim.addListener(({ value }) => {
      setRingDashOffset(CIRCUMF - value * CIRCUMF);
    });
    return () => ringAnim.removeListener(id);
  }, [stats.goalPercent]);

  // ── Data refresh defined above ──────────────────────────────────────────────


  // ── Launch session ──────────────────────────────────────────────────────────
  const launchSession = (type: 'morning' | 'evening' | 'postmeal') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.push({
      pathname: '/step-session',
      params: { sessionType: type },
    } as never);
  };

  // ── Derived values for ring ─────────────────────────────────────────────────
  const glowOpacity = glowAnim.interpolate({ inputRange: [0,1], outputRange: [0.4, 1] });

  // ────────────────────────────────────────────────────────────────────────────
  const { bgUri, accentColor } = useBgContext();
  
  return (
    <ImageBackground
      source={bgUri ? { uri: bgUri } : undefined}
      style={[{ flex: 1, backgroundColor: accentColor || BG_DARK }]}
      imageStyle={{ opacity: 0.65, resizeMode: 'cover' }}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Smart gradient overlay — lighter at top to show image, darker at bottom for card readability */}
      <LinearGradient
        colors={['rgba(0,0,0,0.12)', 'rgba(0,0,0,0.20)', 'rgba(0,0,0,0.35)']}
        locations={[0, 0.40, 1]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      {/* Violet aura top-left */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          { opacity: glowOpacity, pointerEvents: 'none' },
        ]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={['rgba(124,58,237,0.08)', 'transparent']}
          style={{ position: 'absolute', top: -60, left: -60, width: 320, height: 320, borderRadius: 160 }}
        />
      </Animated.View>

      <ScrollView
        ref={walkScrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: getTabBarClearance(insets.bottom, !!playingId) }}
      >
        {/* ── HEADER — glassmorphism card matching sleep / alarm pages ──── */}
        <Animated.View style={{ opacity: cardFade, transform: [{ translateY: cardSlide }], marginBottom: 18 }}>
          <View style={{
            width: '100%',
            backgroundColor: 'rgba(0,0,0,0.26)',
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: 'rgba(255,255,255,0.14)',
            borderRadius: 0,
            overflow: 'hidden',
            paddingHorizontal: 20,
            paddingTop: 18,
            paddingBottom: 16,
            alignItems: 'center',
          }}>
            {/* Subtle top shimmer — identical to sleep/alarm hero */}
            <LinearGradient
              colors={['rgba(255,255,255,0.08)', 'transparent']}
              start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.6 }}
              style={StyleSheet.absoluteFillObject}
              pointerEvents="none"
            />
            {/* Action buttons — top right */}
            <View style={{ position: 'absolute', top: 14, right: 16, flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                onPress={() => { Haptics.selectionAsync(); router.push('/step-analytics' as never); }}
                style={st.headerBtn}
                activeOpacity={0.8}
              >
                <Ionicons name="sparkles" size={14} color="#38bdf8" />
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#38bdf8', letterSpacing: 0.5 }}>Journey</Text>
              </TouchableOpacity>
            </View>
            {/* Main title — DancingScript matching sleep/alarm hero font exactly */}
            <Text style={{
              fontSize: 20,
              fontWeight: '600',
              color: '#FFF8F0',
              letterSpacing: 0.5,
              fontFamily: 'DancingScript_600SemiBold',
              textShadowColor: 'rgba(20,40,20,0.75)',
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 12,
              textAlign: 'center',
              marginBottom: 6,
            }}>
              Step Counter
            </Text>
            {/* Subtitle — date */}
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.58)', marginTop: 2, letterSpacing: 0.1, fontWeight: '300', textAlign: 'center' }}>
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
            {/* Divider */}
            <View style={{ width: 32, height: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginVertical: 12 }} />
            {/* Tagline */}
            <Text style={{ fontSize: 10, fontWeight: '300', color: 'rgba(255,255,255,0.52)', letterSpacing: 0.3, textAlign: 'center', fontStyle: 'italic' }}>
              walk daily · track every step · stay active
            </Text>
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
          {/* Inner container — exact ring dimensions; auras overflow via absolute negative offsets */}
          <View style={{ width: RING_SIZE, height: RING_SIZE }}>

            {/* === 5-layer pulsing aura (breathing glow around ring) === */}
            <Animated.View style={{ position: 'absolute', width: RING_SIZE + 60, height: RING_SIZE + 60, borderRadius: (RING_SIZE + 60) / 2, backgroundColor: ACCENT, opacity: pulseAnim.interpolate({ inputRange: [1, 1.06], outputRange: [0.02, 0.06] }), transform: [{ scale: pulseAnim }], top: -10, left: -10 }} />
            <Animated.View style={{ position: 'absolute', width: RING_SIZE + 30, height: RING_SIZE + 30, borderRadius: (RING_SIZE + 30) / 2, backgroundColor: ACCENT, opacity: pulseAnim.interpolate({ inputRange: [1, 1.06], outputRange: [0.04, 0.10] }), transform: [{ scale: pulseAnim }], top: 5, left: 5 }} />

            {/* Inner zone — glassy violet moonlit disk */}
            <View style={{ position: 'absolute', top: 0, left: 0, width: RING_SIZE, height: RING_SIZE, borderRadius: RING_SIZE / 2, backgroundColor: 'rgba(167,139,250,0.07)', overflow: 'hidden' }}>
              <LinearGradient
                colors={['rgba(167,139,250,0.14)', 'rgba(45,212,191,0.05)', 'transparent', 'rgba(167,139,250,0.04)']}
                start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
            </View>

            {/* SVG ring — 4-layer glow stroke */}
            <Svg width={RING_SIZE} height={RING_SIZE} style={{ transform: [{ rotate: '-90deg' }] }}>
              <Defs>
                <SvgGrad id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0"   stopColor={ACCENT}  stopOpacity="1" />
                  <Stop offset="0.5" stopColor="#ffffff" stopOpacity="0.8" />
                  <Stop offset="1"   stopColor={TEAL}    stopOpacity="1" />
                </SvgGrad>
              </Defs>
              {/* Dark track */}
              <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={R_OUTER} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth={RING_STROKE} />
              
              {/* Main sci-fi arc */}
              <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={R_OUTER} fill="none" stroke="url(#ringGrad)" strokeWidth={RING_STROKE} strokeLinecap="round" strokeDasharray={CIRCUMF} strokeDashoffset={ringDashOffset} opacity={1} />
              
              {/* Core glow */}
              <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={R_OUTER} fill="none" stroke={ACCENT} strokeWidth={RING_STROKE + 8} strokeLinecap="butt" strokeDasharray={CIRCUMF} strokeDashoffset={ringDashOffset} opacity={0.3} />
            </Svg>

            {/* Rotating Outer Dashed HUD */}
            <Animated.View style={{ position: 'absolute', width: RING_SIZE, height: RING_SIZE, transform: [{ rotate: rot1.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
              <Svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
                <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={R_OUTER + 18} stroke={ACCENT} strokeWidth={1.5} fill="none" strokeDasharray="3 15" opacity={0.5} />
                <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={R_OUTER + 18} stroke={TEAL} strokeWidth={2} fill="none" strokeDasharray="1 30" opacity={0.7} />
              </Svg>
            </Animated.View>

            {/* Rotating Inner HUD 1 (Opposite) */}
            <Animated.View style={{ position: 'absolute', width: RING_SIZE, height: RING_SIZE, transform: [{ rotate: rot2.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] }) }] }}>
              <Svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
                <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={R_OUTER - 16} stroke={ACCENT} strokeWidth={1.5} fill="none" strokeDasharray="8 24" opacity={0.4} />
                <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={R_OUTER - 16} stroke="#ffffff" strokeWidth={2.5} fill="none" strokeDasharray="0.5 40" opacity={0.8} strokeLinecap="round" />
              </Svg>
            </Animated.View>

            {/* Rotating Inner HUD 2 (Fast scanning) */}
            <Animated.View style={{ position: 'absolute', width: RING_SIZE, height: RING_SIZE, transform: [{ rotate: rot3.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
              <Svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
                <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={R_OUTER - 26} stroke={TEAL} strokeWidth={1} fill="none" strokeDasharray="2 12" opacity={0.3} />
                <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={R_OUTER - 26} stroke="#ffffff" strokeWidth={1} fill="none" strokeDasharray="10 180" opacity={0.6} />
              </Svg>
            </Animated.View>

            {/* Centre content */}
            <View style={st.ringCentre}>
              {/* Sub-pill badge */}
              <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: 99, backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 0.8, borderColor: 'rgba(167,139,250,0.60)', marginBottom: 8 }}>
                <Text style={{ fontSize: 7, fontWeight: '900', color: '#fff', letterSpacing: 1.4 }}>👣  STEPS TODAY</Text>
              </View>
              <Text style={st.ringSteps}>{fmtK(stats.totalSteps)}</Text>
              <Text style={st.ringLabel}>OF {fmtK(stats.goalSteps)} GOAL</Text>
              <View style={st.ringDivider} />
              
              <View style={{ flexDirection: 'row', gap: 14, marginTop: 4, alignItems: 'center' }}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>{stats.distanceKm.toFixed(1)}</Text>
                  <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)' }}>km</Text>
                </View>
                <View style={{ width: 1, height: 16, backgroundColor: 'rgba(255,255,255,0.1)' }} />
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>{stats.activeMinutes}</Text>
                  <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)' }}>min</Text>
                </View>
                <View style={{ width: 1, height: 16, backgroundColor: 'rgba(255,255,255,0.1)' }} />
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>{streak}</Text>
                  <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)' }}>days</Text>
                </View>
              </View>
              
              <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, backgroundColor: ACCENT + '25', borderWidth: 1, borderColor: ACCENT + '55', marginTop: 12 }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: ACCENT, letterSpacing: 0.3 }}>{stats.goalPercent}% complete</Text>
              </View>
            </View>

          </View>
        </Animated.View>

        {/* ── NAAD SOUNDS BUTTON ───────────────────────────────────────────── */}
        <Animated.View style={{ opacity: cardFade, transform: [{ translateY: cardSlide }], marginHorizontal: 24, marginTop: 24, marginBottom: 8, height: 50 }}>
          <TouchableOpacity
            onPress={() => launchSession(sessionType)}
            activeOpacity={0.80}
            style={{ height: '100%' }}
          >
            <View style={{
              height: '100%', minHeight: 50,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              paddingHorizontal: 22,
              borderRadius: 28, overflow: 'hidden',
              backgroundColor: 'rgba(6,15,40,0.44)',
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.26)',
              shadowColor: '#22d3ee', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.20, shadowRadius: 22,
              elevation: 8,
            }}>
              <Animated.View pointerEvents="none" style={{
                position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
                borderRadius: 28,
                backgroundColor: 'rgba(0,212,184,0.26)',
                opacity: glowOpacity,
              }} />
              <LinearGradient
                colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.04)', 'transparent']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject} />
              <Svg width={18} height={18} viewBox="0 0 24 24" style={{ marginRight: 8 }}>
                <Path d="M4 12v0.01" stroke="#9BE8E0" strokeOpacity="0.85" strokeWidth="2" strokeLinecap="round" />
                <Path d="M7 10v4"   stroke="#7CE3D8" strokeOpacity="0.95" strokeWidth="2" strokeLinecap="round" />
                <Path d="M10 7v10"  stroke="#4FD1C5" strokeWidth="2.2" strokeLinecap="round" />
                <Path d="M13 9v6"   stroke="#7CE3D8" strokeOpacity="0.95" strokeWidth="2" strokeLinecap="round" />
                <Path d="M16 11v2"  stroke="#9BE8E0" strokeOpacity="0.85" strokeWidth="2" strokeLinecap="round" />
                <Path d="M19 12v0.01" stroke="#BAFAF0" strokeOpacity="0.75" strokeWidth="2" strokeLinecap="round" />
              </Svg>
              <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.35 }}>{sessionTitle}</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>


        {/* ── QUICK ACTIONS ────────────────────────────────────────────────── */}
        <Animated.View
          style={[st.quickRow, { opacity: cardFade, transform: [{ translateY: cardSlide }] }]}
        >
          <TouchableOpacity
            style={[st.quickBtn, { borderColor: ACCENT + '40' }]}
            onPress={() => { Haptics.selectionAsync(); router.push('/step-analytics' as never); }}
          >
            <LinearGradient colors={[ACCENT + '18', 'transparent']} style={StyleSheet.absoluteFillObject} />
            <Text style={{ fontSize: 22 }}>📈</Text>
            <Text style={[st.quickLabel, { color: ACCENT }]}>Analytics</Text>
            <Text style={st.quickSub}>30-day history</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[st.quickBtn, { borderColor: GREEN + '40' }]}
            onPress={() => { Haptics.selectionAsync(); setShowGoalModal(true); }}
          >
            <LinearGradient colors={[GREEN + '18', 'transparent']} style={StyleSheet.absoluteFillObject} />
            <Text style={{ fontSize: 22 }}>🎯</Text>
            <Text style={[st.quickLabel, { color: GREEN }]}>Set Goal</Text>
            <Text style={st.quickSub}>{fmtK(stats.goalSteps)} steps/day</Text>
          </TouchableOpacity>
        </Animated.View>

      </ScrollView>

      {/* ── GOAL MODAL ───────────────────────────────────────────────────────── */}
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
  const PRESETS = [3000, 5000, 6000, 8000, 10000, 12000];
  const [selected, setSelected] = useState(current);
  useEffect(() => { if (visible) setSelected(current); }, [visible, current]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={gm.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View style={gm.sheet}>
          <LinearGradient colors={['#1A0A3A', '#0A0A0F']} style={StyleSheet.absoluteFillObject} />
          <View style={gm.handle} />
          <Text style={gm.title}>Daily Step Goal</Text>
          <Text style={gm.sub}>Choose your target for today</Text>
          <View style={gm.presets}>
            {PRESETS.map(p => (
              <TouchableOpacity
                key={p}
                onPress={() => { Haptics.selectionAsync(); setSelected(p); }}
                style={[gm.preset, selected === p && { backgroundColor: ACCENT + '28', borderColor: ACCENT }]}
              >
                <Text style={[gm.presetTxt, selected === p && { color: ACCENT }]}>
                  {p.toLocaleString()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[gm.saveBtn, { backgroundColor: ACCENT }]}
            onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); onSave(selected); }}
          >
            <Text style={gm.saveTxt}>Save Goal</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={{ paddingVertical: 12 }}>
            <Text style={{ color: 'rgba(255,255,255,0.35)', textAlign: 'center', fontSize: 14 }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const gm = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  sheet:   { backgroundColor: '#0A0A0F', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40, overflow: 'hidden' },
  handle:  { width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  title:   { fontSize: 20, fontWeight: '800', color: '#fff', textAlign: 'center' },
  sub:     { fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 4, marginBottom: 24 },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 },
  preset:  { flex: 1, minWidth: '28%', paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: BORDER, backgroundColor: CARD, alignItems: 'center' },
  presetTxt: { color: 'rgba(255,255,255,0.6)', fontWeight: '700', fontSize: 15 },
  saveBtn: { borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 8 },
  saveTxt: { color: '#fff', fontWeight: '900', fontSize: 16 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, marginBottom: 24,
  },
  headerTitle: { fontSize: 26, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  headerSub:   { fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 2, fontWeight: '500' },
  headerBtn: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
    backgroundColor: 'rgba(56,189,248,0.12)', borderWidth: 1, borderColor: 'rgba(56,189,248,0.3)',
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },

  noSensorCard: {
    margin: 20, padding: 24, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.16)',
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
    marginBottom: 8,
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
  ringIcon:      { fontSize: 20, marginBottom: 2 },
  ringSteps:     { fontSize: 34, fontWeight: '900', color: '#fff', letterSpacing: -1, textShadowColor: 'rgba(0,0,0,0.90)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 8 },
  ringLabel:     { fontSize: 9, color: 'rgba(255,255,255,0.45)', fontWeight: '700', letterSpacing: 1.5, marginTop: -2 },
  ringGoal:      { fontSize: 11, fontWeight: '700', marginTop: 2 },
  ringDivider:   { width: 52, height: 1, backgroundColor: 'rgba(167,139,250,0.35)', marginVertical: 7 },
  ringBreakRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 3 },
  ringBreakItem: { alignItems: 'center', minWidth: 50 },
  ringBreakNum:  { fontSize: 17, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  ringBreakLbl:  { fontSize: 9, color: 'rgba(255,255,255,0.38)', fontWeight: '600', marginTop: 2 },
  ringPlus:      { fontSize: 15, color: 'rgba(255,255,255,0.20)', fontWeight: '300', paddingBottom: 13 },

  trackPill:    { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(0,0,0,0.22)', gap: 8, marginBottom: 14, overflow: 'hidden' },
  trackPillOn:  { borderColor: GREEN + '45' },
  trackDot:     { width: 6, height: 6, borderRadius: 3 },
  trackPillTxt: { fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },

  chipsRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 28,
  },
  chip: {
    flex: 1, borderRadius: 14, borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.12)', padding: 10, alignItems: 'center', gap: 2, overflow: 'hidden',
  },
  chipIcon:  { fontSize: 16 },
  chipVal:   { fontSize: 12, fontWeight: '800' },
  chipLabel: { fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: '600' },

  sectionHeader: { paddingHorizontal: 20, marginBottom: 12 },
  sectionTitle:  { fontSize: 16, fontWeight: '800', color: '#fff' },
  sectionSub:    { fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 },

  chartCard: {
    marginHorizontal: 16, marginBottom: 16, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    padding: 16, overflow: 'hidden',
  },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  chartTitle:  { fontSize: 14, fontWeight: '800', color: '#fff' },
  chartMoreBtn:{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: ACCENT + '18' },
  chartMoreTxt:{ fontSize: 11, fontWeight: '700' },

  quickRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginBottom: 16 },
  quickBtn: {
    flex: 1, borderRadius: 18, borderWidth: 1, backgroundColor: 'rgba(0,0,0,0.16)', borderColor: 'rgba(255,255,255,0.12)',
    padding: 18, alignItems: 'center', gap: 6, overflow: 'hidden',
  },
  quickLabel: { fontSize: 14, fontWeight: '800' },
  quickSub:   { fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: '500' },

  trackCard: {
    marginHorizontal: 16, marginBottom: 24, borderRadius: 18, borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.16)', borderColor: 'rgba(255,255,255,0.12)', padding: 16, flexDirection: 'row', alignItems: 'center',
    gap: 12, overflow: 'hidden',
  },
  trackTitle: { fontSize: 13, fontWeight: '800', color: '#fff' },
  trackSub:   { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 3, lineHeight: 16 },
  trackToggle: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, minWidth: 48, alignItems: 'center' },
  trackToggleTxt: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
});
