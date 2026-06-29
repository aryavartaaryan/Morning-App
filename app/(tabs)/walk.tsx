/**
 * walk.tsx — Step Counter Home Tab
 * ─────────────────────────────────────────────────────────────────────────────
 * Beautiful main hub for the Nada step-counter feature.
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

import StepCounter, { type TodayStats, type DailyData } from '@/src/modules/StepCounter';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useBgContext } from '@/lib/bgContext';
import { useSoundPlayer } from '@/lib/soundPlayerContext';
import { getTabBarClearance } from '@/lib/tabBarSpacing';

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
const RING_SIZE   = Math.min(W - 64, 240);
const RING_STROKE = 4;
const R_OUTER     = (RING_SIZE - RING_STROKE) / 2;
const CIRCUMF     = 2 * Math.PI * R_OUTER;

// ── Session config ────────────────────────────────────────────────────────────
function getDynamicSessions() {
  const hour = new Date().getHours();
  
  let mainWalk;
  if (hour >= 4 && hour < 12) {
    // 4 AM to 12 PM (Brahma Muhurta to Midday)
    mainWalk = { type: 'morning' as const, emoji: '🌅', label: 'Morning Walk', btnLabel: 'Start Morning Walk', sub: '3,000 step target', color: GREEN, goal: 3000 };
  } else if (hour >= 12 && hour < 17) {
    // 12 PM to 5 PM
    mainWalk = { type: 'morning' as const, emoji: '☀️', label: 'Walk', btnLabel: 'Start Walk', sub: '3,000 step target', color: GREEN, goal: 3000 };
  } else {
    // 5 PM onwards or before 4 AM
    mainWalk = { type: 'evening' as const, emoji: '🌆', label: 'Evening Walk', btnLabel: 'Start Evening Walk', sub: '3,000 step target', color: PINK, goal: 3000 };
  }

  return [
    mainWalk,
    { type: 'postmeal' as const, emoji: '🍽️', label: 'Post-meal Walk', btnLabel: 'Start Post-meal Walk', sub: '100 step target', color: ORANGE, goal: 100 },
  ];
}

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
  const [trackEnabled, setTrackEnabled] = useState(false);
  const [loading,      setLoading]      = useState(true);
  const [showGoalModal,setShowGoalModal]= useState(false);
  const [goalInput,    setGoalInput]    = useState('8000');
  const [streak,       setStreak]       = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
  // Drives SVG strokeDashoffset via listener (avoids createAnimatedComponent crash)
  const [ringDashOffset, setRingDashOffset] = useState(CIRCUMF);

  // ── Animations ─────────────────────────────────────────────────────────────
  const ringAnim    = useRef(new Animated.Value(0)).current;
  const pulseAnim   = useRef(new Animated.Value(1)).current;
  const glowAnim    = useRef(new Animated.Value(0)).current;
  const cardFade    = useRef(new Animated.Value(0)).current;
  const cardSlide   = useRef(new Animated.Value(30)).current;
  const walkScrollRef = useRef<ScrollView | null>(null);

  useFocusEffect(useCallback(() => {
    walkScrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []));

  // ── Boot ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const avail = await StepCounter.isAvailable();
      setIsAvailable(avail);
      if (avail) {
        const enabled = await StepCounter.isTrackingEnabled();
        setTrackEnabled(enabled);
        await refreshStats();
      }
      setLoading(false);

      // First-visit onboarding
      if (avail) {
        const onboarded = await AsyncStorage.getItem('step_onboarding_done');
        const isTracking = await StepCounter.isTrackingEnabled();
        if (!onboarded && !isTracking) setShowOnboarding(true);
      }

      // Entrance animation
      Animated.parallel([
        Animated.timing(cardFade,  { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(cardSlide, { toValue: 0, duration: 600, easing: Easing.out(Easing.exp), useNativeDriver: true }),
      ]).start();
    })();

    // Pulse loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.00, duration: 2000, useNativeDriver: true }),
      ])
    ).start();

    // Glow loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
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

  // ── Data refresh ────────────────────────────────────────────────────────────
  const refreshStats = useCallback(async () => {
    const [s, analytics] = await Promise.all([
      StepCounter.getTodayStats(),
      StepCounter.getThirtyDayAnalytics(),
    ]);
    setStats(s);
    setWeekData(analytics.dailyData.slice(-7));
    setStreak(analytics.summary.currentStreak);
  }, []);

  // ── Enable/disable background tracking ─────────────────────────────────────
  const toggleTracking = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (trackEnabled) {
      await StepCounter.stopBackgroundTracking();
      setTrackEnabled(false);
    } else {
      await StepCounter.startBackgroundTracking();
      setTrackEnabled(true);
      await refreshStats();
    }
  };

  // ── Onboarding handlers ──────────────────────────────────────────────────────
  const handleOnboardingEnable = async () => {
    await AsyncStorage.setItem('step_onboarding_done', '1');
    setShowOnboarding(false);
    await StepCounter.startBackgroundTracking();
    setTrackEnabled(true);
    await refreshStats();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleOnboardingSkip = async () => {
    await AsyncStorage.setItem('step_onboarding_done', '1');
    setShowOnboarding(false);
  };

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
                onPress={toggleTracking}
                style={[st.headerBtn, trackEnabled && { backgroundColor: ACCENT + '22', borderColor: ACCENT + '50' }]}
              >
                <Text style={{ fontSize: 13 }}>{trackEnabled ? '🏃' : '⏸'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { Haptics.selectionAsync(); router.push('/step-analytics' as never); }}
                style={st.headerBtn}
              >
                <Text style={{ fontSize: 13 }}>📊</Text>
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

        {/* ── TRACKING PILL ─────────────────────────────────────────────────── */}
        <Animated.View style={{ opacity: cardFade, alignItems: 'center', marginBottom: 0 }}>
          <TouchableOpacity
            onPress={toggleTracking}
            style={[st.trackPill, trackEnabled && st.trackPillOn]}
            activeOpacity={0.75}
          >
            <LinearGradient
              colors={trackEnabled ? [GREEN + '20', 'transparent'] : ['rgba(255,255,255,0.05)', 'transparent']}
              style={[StyleSheet.absoluteFillObject, { borderRadius: 20 }]}
            />
            <View style={[st.trackDot, { backgroundColor: trackEnabled ? GREEN : 'rgba(255,255,255,0.22)' }]} />
            <Text style={[st.trackPillTxt, { color: trackEnabled ? GREEN : 'rgba(255,255,255,0.45)' }]}>
              {trackEnabled ? '👣 All-Day Tracking  ·  Active' : '👣 All-Day Tracking  ·  Tap to Enable'}
            </Text>
            <Text style={{ fontSize: 11, color: trackEnabled ? GREEN + 'bb' : 'rgba(255,255,255,0.18)' }}>›</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* ── RING + CENTRE ────────────────────────────────────────────────── */}
        <Animated.View style={[st.ringWrapper, { opacity: cardFade }]}>
          {/* Inner container — exact ring dimensions; auras overflow via absolute negative offsets */}
          <View style={{ width: RING_SIZE, height: RING_SIZE }}>

            {/* === 5-layer pulsing aura (breathing glow around ring) === */}
            <Animated.View style={{ position: 'absolute', width: RING_SIZE + 32, height: RING_SIZE + 32, borderRadius: (RING_SIZE + 32) / 2, backgroundColor: 'rgba(167,139,250,0.025)', transform: [{ scale: pulseAnim }], top: -16, left: -16 }} />
            <Animated.View style={{ position: 'absolute', width: RING_SIZE + 22, height: RING_SIZE + 22, borderRadius: (RING_SIZE + 22) / 2, backgroundColor: 'rgba(167,139,250,0.05)', transform: [{ scale: pulseAnim }], top: -11, left: -11 }} />
            <Animated.View style={{ position: 'absolute', width: RING_SIZE + 14, height: RING_SIZE + 14, borderRadius: (RING_SIZE + 14) / 2, backgroundColor: 'rgba(167,139,250,0.10)', transform: [{ scale: pulseAnim }], top: -7, left: -7 }} />
            <Animated.View style={{ position: 'absolute', width: RING_SIZE + 7, height: RING_SIZE + 7, borderRadius: (RING_SIZE + 7) / 2, backgroundColor: 'rgba(167,139,250,0.17)', transform: [{ scale: pulseAnim }], top: -3, left: -3 }} />
            <Animated.View style={{ position: 'absolute', width: RING_SIZE + 2, height: RING_SIZE + 2, borderRadius: (RING_SIZE + 2) / 2, backgroundColor: 'rgba(167,139,250,0.22)', transform: [{ scale: pulseAnim }], top: -1, left: -1 }} />

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
                <SvgGrad id="ringGrad" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0"   stopColor={ACCENT}  stopOpacity="1" />
                  <Stop offset="0.5" stopColor="#EC4899" stopOpacity="1" />
                  <Stop offset="1"   stopColor={TEAL}    stopOpacity="1" />
                </SvgGrad>
              </Defs>
              {/* Track */}
              <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={R_OUTER} fill="none" stroke="rgba(167,139,250,0.13)" strokeWidth={RING_STROKE} />
              {/* Wide outer glow */}
              <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={R_OUTER} fill="none" stroke={ACCENT} strokeWidth={RING_STROKE + 14} strokeLinecap="butt" strokeDasharray={CIRCUMF} strokeDashoffset={ringDashOffset} opacity={0.16} />
              {/* Mid halo */}
              <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={R_OUTER} fill="none" stroke="#C4B5FD" strokeWidth={RING_STROKE + 7} strokeLinecap="butt" strokeDasharray={CIRCUMF} strokeDashoffset={ringDashOffset} opacity={0.32} />
              {/* Main crisp arc */}
              <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={R_OUTER} fill="none" stroke="url(#ringGrad)" strokeWidth={RING_STROKE} strokeLinecap="round" strokeDasharray={CIRCUMF} strokeDashoffset={ringDashOffset} opacity={1} />
              {/* Inner sliver highlight */}
              <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={R_OUTER} fill="none" stroke="#E9D5FF" strokeWidth={1.5} strokeLinecap="round" strokeDasharray={CIRCUMF} strokeDashoffset={ringDashOffset} opacity={0.45} />
            </Svg>

            {/* Centre content */}
            <View style={st.ringCentre}>
              {/* Sub-pill badge */}
              <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: 99, backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 0.8, borderColor: 'rgba(167,139,250,0.60)', marginBottom: 8 }}>
                <Text style={{ fontSize: 7, fontWeight: '900', color: '#fff', letterSpacing: 1.4 }}>👣  STEPS TODAY  ·  {trackEnabled ? 'ACTIVE' : 'ENABLE'}</Text>
              </View>
              <Text style={st.ringSteps}>{fmtK(stats.totalSteps)}</Text>
              <Text style={st.ringLabel}>OF {fmtK(stats.goalSteps)} GOAL</Text>
              <View style={st.ringDivider} />
              <View style={st.ringBreakRow}>
                <View style={st.ringBreakItem}>
                  <Text style={st.ringBreakNum}>{fmtK(stats.autoSteps)}</Text>
                  <Text style={st.ringBreakLbl}>Ambient</Text>
                </View>
                <Text style={st.ringPlus}>+</Text>
                <View style={st.ringBreakItem}>
                  <Text style={st.ringBreakNum}>{fmtK(stats.manualSteps)}</Text>
                  <Text style={st.ringBreakLbl}>🏃 Sessions</Text>
                </View>
              </View>
              <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, backgroundColor: ACCENT + '25', borderWidth: 1, borderColor: ACCENT + '55', marginTop: 4 }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: ACCENT, letterSpacing: 0.3 }}>{stats.goalPercent}% complete</Text>
              </View>
            </View>

          </View>
        </Animated.View>

        {/* ── METRIC CHIPS ─────────────────────────────────────────────────── */}
        <Animated.View
          style={[st.chipsRow, { opacity: cardFade, transform: [{ translateY: cardSlide }] }]}
        >
          {[
            { icon: '🏃', label: 'Distance', val: `${stats.distanceKm.toFixed(1)} km`, color: TEAL   },
            { icon: '🔥', label: 'Calories',  val: `${stats.calories} kcal`,           color: ORANGE  },
            { icon: '⏱',  label: 'Active',    val: `${stats.activeMinutes} min`,        color: GREEN   },
            { icon: '🔥', label: 'Streak',    val: `${streak} days`,                    color: GOLD    },
          ].map((chip, i) => (
            <View key={i} style={[st.chip, { borderColor: chip.color + '30' }]}>
              <LinearGradient
                colors={[chip.color + '12', 'transparent']}
                style={StyleSheet.absoluteFillObject}
              />
              <Text style={st.chipIcon}>{chip.icon}</Text>
              <Text style={[st.chipVal, { color: chip.color }]}>{chip.val}</Text>
              <Text style={st.chipLabel}>{chip.label}</Text>
            </View>
          ))}
        </Animated.View>

        {/* ── SESSION CARDS ─────────────────────────────────────────────────── */}
        <Animated.View style={{ opacity: cardFade, transform: [{ translateY: cardSlide }] }}>
          <View style={st.sectionHeader}>
            <Text style={st.sectionTitle}>Walk Sessions</Text>
            <Text style={st.sectionSub}>Tap to start a tracked session</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, gap: 16 }}>
            {getDynamicSessions().map(s => (
              <SessionCard
                key={s.type + s.label}
                emoji={s.emoji} label={s.label} sub={s.sub}
                color={s.color} goal={s.goal}
                btnLabel={s.btnLabel}
                onStart={() => launchSession(s.type)}
              />
            ))}</ScrollView>
        </Animated.View>

        {/* ── 7-DAY BAR CHART ──────────────────────────────────────────────── */}
        <Animated.View
          style={[st.chartCard, { opacity: cardFade, transform: [{ translateY: cardSlide }] }]}
        >
          <LinearGradient
            colors={['rgba(124,58,237,0.08)', 'transparent']}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={st.chartHeader}>
            <Text style={st.chartTitle}>7-Day Overview</Text>
            <TouchableOpacity
              onPress={() => { Haptics.selectionAsync(); router.push('/step-analytics' as never); }}
              style={st.chartMoreBtn}
            >
              <Text style={[st.chartMoreTxt, { color: ACCENT }]}>30 days →</Text>
            </TouchableOpacity>
          </View>
          <WeekBarChart data={weekData} goal={stats.goalSteps} accentColor={ACCENT} />
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
      <StepOnboardingModal
        visible={showOnboarding}
        onEnable={handleOnboardingEnable}
        onSkip={handleOnboardingSkip}
      />
    </ImageBackground>
  );
}



// ─────────────────────────────────────────────────────────────────────────────
// SessionCard component
// ─────────────────────────────────────────────────────────────────────────────
function SessionCard({
  emoji, label, sub, color, goal, btnLabel, onStart,
}: {
  emoji: string; label: string; sub: string; color: string; goal: number; btnLabel: string;
  onStart: () => void;
}) {
  const pressAnim = useRef(new Animated.Value(1)).current;
  const onPressIn  = () => Animated.spring(pressAnim, { toValue: 0.96, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(pressAnim, { toValue: 1, useNativeDriver: true }).start();

  return (
    <Animated.View style={[sCard.wrapper, { transform: [{ scale: pressAnim }] }]}>
      <TouchableOpacity
        onPress={onStart}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
        style={sCard.inner}
      >
        <LinearGradient
          colors={[color + '18', color + '06', 'transparent']}
          style={[StyleSheet.absoluteFillObject, { borderRadius: 20 }]}
        />
        {/* Top border glow */}
        <View style={[sCard.topBorder, { backgroundColor: color }]} />

        <Text style={sCard.emoji}>{emoji}</Text>
        <Text style={[sCard.label, { color }]}>{label}</Text>
        <Text style={sCard.sub}>{sub}</Text>

        {/* Goal pill */}
        <View style={[sCard.goalPill, { backgroundColor: color + '18', borderColor: color + '30' }]}>
          <Text style={[sCard.goalTxt, { color }]}>🎯 {goal.toLocaleString()} steps</Text>
        </View>

        {/* Start button */}
        <TouchableOpacity
          onPress={onStart}
          style={[sCard.startBtn, { backgroundColor: color }]}
        >
          <Text style={sCard.startTxt}>▶  {btnLabel.toUpperCase()}</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const sCard = StyleSheet.create({
  wrapper: { width: 160, borderRadius: 20, overflow: 'hidden' },
  inner: {
    backgroundColor: CARD,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    alignItems: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  topBorder: { position: 'absolute', top: 0, left: 16, right: 16, height: 2, borderRadius: 1, opacity: 0.8 },
  emoji:    { fontSize: 32, marginTop: 8 },
  label:    { fontSize: 13, fontWeight: '800', textAlign: 'center', letterSpacing: 0.2 },
  sub:      { fontSize: 10, color: 'rgba(255,255,255,0.45)', textAlign: 'center', fontWeight: '500' },
  goalPill: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, marginTop: 4 },
  goalTxt:  { fontSize: 10, fontWeight: '700' },
  startBtn: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 20, marginTop: 8, alignSelf: 'stretch', alignItems: 'center' },
  startTxt: { color: '#fff', fontWeight: '900', fontSize: 12, letterSpacing: 1.5 },
});

// ─────────────────────────────────────────────────────────────────────────────
// 7-Day Bar Chart (SVG — no WebView, no MPAndroidChart)
// ─────────────────────────────────────────────────────────────────────────────
function WeekBarChart({ data, goal, accentColor }: { data: DailyData[]; goal: number; accentColor: string }) {
  const chartW = W - 64;
  const chartH = 100;
  const barW   = (chartW - 48) / 7;
  const maxVal = Math.max(goal, ...data.map(d => d.steps), 1);

  // NOTE: barAnims removed — SVG Rects cannot be driven by Animated.Value directly
  // (createAnimatedComponent crashes on RN 0.73 New Architecture). Bars render statically.
  const goalY = chartH - (goal / maxVal) * chartH;

  return (
    <View style={{ height: chartH + 28 }}>
      <Svg width={chartW} height={chartH + 24} style={{ marginTop: 4 }}>
        {/* Goal dashed line */}
        <Path
          d={`M0,${goalY} L${chartW},${goalY}`}
          stroke={GOLD}
          strokeWidth={1}
          strokeDasharray="4 4"
          opacity={0.5}
        />
        <SvgText x={chartW - 2} y={goalY - 4} fontSize={8} fill={GOLD} opacity={0.7} textAnchor="end">
          GOAL
        </SvgText>

        {/* Bars */}
        {data.map((d, i) => {
          const x    = i * (barW + 6) + 4;
          const pct  = Math.min(d.steps / maxVal, 1);
          const bH   = Math.max(2, pct * chartH);
          const y    = chartH - bH;
          const fill = d.goalMet ? GREEN : (d.steps > 0 ? accentColor : 'rgba(255,255,255,0.08)');
          const label = dayLabel(d.date);

          return (
            <G key={d.date}>
              {/* Bar bg */}
              <Rect x={x} y={0} width={barW} height={chartH} rx={4} fill="rgba(255,255,255,0.03)" />
              {/* Bar fill */}
              <Rect x={x} y={y} width={barW} height={bH} rx={4} fill={fill} opacity={0.85} />
              {/* Day label */}
              <SvgText x={x + barW / 2} y={chartH + 14} fontSize={9} fill="rgba(255,255,255,0.4)" textAnchor="middle" fontWeight="600">
                {label}
              </SvgText>
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step Onboarding Modal
// ─────────────────────────────────────────────────────────────────────────────
function StepOnboardingModal({
  visible, onEnable, onSkip,
}: {
  visible: boolean; onEnable: () => void; onSkip: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(0.88)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
        Animated.timing(fadeAnim,  { toValue: 1, duration: 260, useNativeDriver: true }),
      ]).start();
    } else {
      scaleAnim.setValue(0.88);
      fadeAnim.setValue(0);
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onSkip}>
      <View style={ob.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onSkip} />
        <Animated.View style={[ob.card, { transform: [{ scale: scaleAnim }], opacity: fadeAnim }]}>
          <LinearGradient colors={['#1A0A3A', '#060D1F']} style={StyleSheet.absoluteFillObject} />
          <LinearGradient
            colors={[ACCENT + '28', 'transparent']}
            style={{ position: 'absolute', top: -50, left: -50, width: 220, height: 220, borderRadius: 110 }}
          />
          <Text style={ob.emoji}>👣</Text>
          <Text style={ob.title}>Track Your Steps,{'\n'}Every Single Day</Text>
          <Text style={ob.sub}>
            Enable background tracking to count your steps all day — even when the app is closed.
          </Text>
          <View style={ob.benefitsRow}>
            {[
              { icon: '🌅', txt: 'Dawn to dusk' },
              { icon: '🔋', txt: 'Battery-friendly' },
              { icon: '📊', txt: '30-day history' },
            ].map((b, i) => (
              <View key={i} style={ob.benefitItem}>
                <Text style={ob.benefitIcon}>{b.icon}</Text>
                <Text style={ob.benefitTxt}>{b.txt}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity style={ob.enableBtn} onPress={onEnable} activeOpacity={0.85}>
            <LinearGradient
              colors={[ACCENT, '#EC4899']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={[StyleSheet.absoluteFillObject, { borderRadius: 16 }]}
            />
            <Text style={ob.enableTxt}>Start Tracking Now  👣</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onSkip} style={{ paddingVertical: 14 }}>
            <Text style={ob.skipTxt}>Maybe later</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const ob = StyleSheet.create({
  overlay:     { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.78)', padding: 24 },
  card:        { width: '100%', maxWidth: 360, borderRadius: 28, padding: 28, alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  emoji:       { fontSize: 56, marginBottom: 16 },
  title:       { fontSize: 26, fontWeight: '900', color: '#fff', textAlign: 'center', letterSpacing: -0.5, lineHeight: 32, marginBottom: 12 },
  sub:         { fontSize: 14, color: 'rgba(255,255,255,0.45)', textAlign: 'center', lineHeight: 21, marginBottom: 24 },
  benefitsRow: { flexDirection: 'row', gap: 10, marginBottom: 28, width: '100%' },
  benefitItem: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 14, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  benefitIcon: { fontSize: 22 },
  benefitTxt:  { fontSize: 10, color: 'rgba(255,255,255,0.50)', fontWeight: '600', textAlign: 'center' },
  enableBtn:   { width: '100%', borderRadius: 16, paddingVertical: 17, alignItems: 'center', overflow: 'hidden', marginBottom: 4 },
  enableTxt:   { color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 0.3 },
  skipTxt:     { color: 'rgba(255,255,255,0.22)', fontSize: 13, fontWeight: '500' },
});

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
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
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
