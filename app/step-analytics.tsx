/**
 * step-analytics.tsx — Premium Mindful Journey Analytics (Ultra-Premium Edition)
 */

import React, { useState, useEffect, useRef } from 'react';
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
  Platform,
  DeviceEventEmitter,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, {
  Circle, Defs, LinearGradient as SvgGrad, Stop,
  Line, Text as SvgText, G
} from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

import StepCounter, { type DailyData, type AnalyticsSummary } from '@/src/modules/StepCounter';

const { width: W } = Dimensions.get('window');

// ── Design tokens ─────────────────────────────────────────────────────────────
const BG = '#050B14';
// Frosted glass tokens — rich, deeper, and softer edges
const CARD = 'rgba(8,14,28,0.55)';
const BORDER = 'rgba(255,255,255,0.06)';
const SKY_BLUE = '#0ea5e9';
const CYAN = '#38bdf8';
const DEEP_CYAN = '#0284c7';
const BRIGHT_CYAN = '#bae6fd';
const GOLD = '#fde047';
const TEAL = '#2DD4BF';
const ORANGE = '#FB923C';
const MUTED = 'rgba(56,189,248,0.55)';
const ACCENT_VIOLET = '#A78BFA';

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtK(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
function shortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`;
}
function weekdayChar(dateStr: string): string {
  return ['S', 'M', 'T', 'W', 'T', 'F', 'S'][new Date(dateStr + 'T12:00:00').getDay()];
}

function heatColour(pct: number): string {
  if (pct <= 0) return 'rgba(56,189,248,0.04)';
  if (pct >= 1) return CYAN;
  const alpha = 0.2 + pct * 0.8;
  return `rgba(56,189,248,${alpha})`;
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function StepAnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // ── State ──────────────────────────────────────────────────────────────────
  const [allData, setAllData] = useState<DailyData[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<DailyData | null>(null);
  const [showSheet, setShowSheet] = useState(false);

  // ── Animations ─────────────────────────────────────────────────────────────
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const sheetAnim = useRef(new Animated.Value(0)).current;

  // Ultra-premium circle anims
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const rot1 = useRef(new Animated.Value(0)).current;
  const rot2 = useRef(new Animated.Value(0)).current;
  const rot3 = useRef(new Animated.Value(0)).current;

  // ── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const loadData = async () => {
      // Reset for new day and snapshot today before loading analytics
      await StepCounter.maybeResetForNewDay();
      await StepCounter.snapshotTodayToHistory();
      const analytics = await StepCounter.getThirtyDayAnalytics();
      setAllData(analytics.dailyData);
      setSummary(analytics.summary);
      setLoading(false);

      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 600, easing: Easing.out(Easing.exp), useNativeDriver: true }),
      ]).start();
    };
    
    loadData();
    
    const sub = DeviceEventEmitter.addListener('SessionEnded', () => {
      loadData();
    });

    Animated.loop(Animated.timing(rot1, { toValue: 1, duration: 28000, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(rot2, { toValue: 1, duration: 38000, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(rot3, { toValue: 1, duration: 18000, easing: Easing.linear, useNativeDriver: true })).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 3000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.00, duration: 3000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    return () => {
      sub.remove();
    };
  }, []);

  // ── Sheet open/close ────────────────────────────────────────────────────────
  const openSheet = (day: DailyData) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDay(day);
    setShowSheet(true);
    Animated.spring(sheetAnim, { toValue: 1, useNativeDriver: true, bounciness: 4 }).start();
  };
  const closeSheet = () => {
    Animated.timing(sheetAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => setShowSheet(false));
  };

  // ── Derived data ───────────────────────────────────────────────────────────
  // Last 7 days — allData is already sorted ascending (oldest→newest) by getThirtyDayAnalytics
  const realLast7 = allData.slice(-7);
  const emptyDays = Array(Math.max(0, 7 - realLast7.length)).fill(null).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (7 - realLast7.length - 1 + i));
    return {
      date: d.toISOString().split('T')[0], steps: 0, goal: 8000, distanceKm: 0, calories: 0, activeMinutes: 0, goalMet: false, goalPercent: 0
    } as DailyData;
  });
  const last7Days = [...emptyDays, ...realLast7].slice(-7); // always exactly 7
  const goal = last7Days[last7Days.length - 1]?.goal ?? 8000;

  // Hero Ring Math - Using Today's stats for the ring as requested
  const todayData = last7Days[last7Days.length - 1];
  const todaySteps = todayData?.steps ?? 0;
  const todayPct = Math.min(1, todaySteps / (goal || 1));

  // Sleek Premium Ring Geometry
  const SIZE = Math.min(W - 60, 220); // Slightly smaller, sleeker size
  const cx = SIZE / 2;

  // Thinner, more elegant track geometry
  const STROKE_WIDTH = 12;
  const rMain = SIZE / 2 - STROKE_WIDTH / 2;
  const cMain = 2 * Math.PI * rMain;
  const offsetMain = cMain * (1 - todayPct);

  // Bar Chart Math
  const chartW = W - 88;
  const chartH = 120;
  const maxBarSteps = Math.max(goal, ...last7Days.map(d => d.steps), 1);
  const barSpacing = chartW / 7;

  // Heatmap
  const CELL = Math.floor((W - 88 - 24) / 7);

  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.8] });

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient colors={['#050B14', '#081226', '#0A152D']} style={StyleSheet.absoluteFillObject} />

      {/* Deep frosted background overlays */}
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: glowOpacity }]} pointerEvents="none">
        <LinearGradient
          colors={['rgba(56,189,248,0.12)', 'transparent']}
          style={{ position: 'absolute', top: -100, left: -100, width: 350, height: 350, borderRadius: 175 }}
        />
        <LinearGradient
          colors={['rgba(167,139,250,0.08)', 'transparent']}
          style={{ position: 'absolute', top: 150, right: -150, width: 400, height: 400, borderRadius: 200 }}
        />
      </Animated.View>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <View style={[st.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }} onPress={() => router.back()} style={st.backBtn}>
          <LinearGradient
            colors={['rgba(255,255,255,0.08)', 'transparent']}
            start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.5 }}
            style={{ position: 'absolute', inset: 0, borderRadius: 20 }}
          />
          <Ionicons name="arrow-back" size={18} color={BRIGHT_CYAN} />
        </TouchableOpacity>
        {/* Sleeker, more elegant header text */}
        <Text style={st.title}>Your Journey</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 40 }}
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

          {/* ── TODAY'S HERO RING (Ultra-Smart Sleek Design) ───────────────────── */}
          <View style={{ alignItems: 'center', marginTop: 8, marginBottom: 24 }}>
            <Text style={st.heroTitle}>Today's Immersion</Text>

            <View style={{ width: SIZE + 40, height: SIZE + 40, alignItems: 'center', justifyContent: 'center', marginTop: 10, marginBottom: 12 }}>
              
              {/* Outer breathing aura */}
              <Animated.View style={{ position: 'absolute', width: SIZE + 40, height: SIZE + 40, borderRadius: (SIZE + 40) / 2, backgroundColor: CYAN, opacity: pulseAnim.interpolate({ inputRange: [1, 1.08], outputRange: [0.03, 0.08] }), transform: [{ scale: pulseAnim }] }} />

              {/* Solid Premium Frosted Inner Disc */}
              <View style={{
                position: 'absolute', width: SIZE, height: SIZE, borderRadius: SIZE / 2,
                overflow: 'hidden',
              }}>
                <LinearGradient
                  colors={['rgba(12,24,48,0.88)', 'rgba(8,16,36,0.92)', 'rgba(10,20,42,0.85)']}
                  start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                />
                <LinearGradient
                  colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)', 'transparent']}
                  start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.5 }}
                  style={StyleSheet.absoluteFillObject}
                />
                <LinearGradient
                  colors={['rgba(56,189,248,0.15)', 'transparent', 'rgba(167,139,250,0.10)']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                />
              </View>

              {/* Multi-layer Sleek SVG Ring */}
              <View style={{ shadowColor: CYAN, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 20, elevation: 10 }}>
                <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ transform: [{ rotate: '-90deg' }] }}>
                  <Defs>
                    <SvgGrad id="sleekGlow" x1="0" y1="0" x2="1" y2="1">
                      <Stop offset="0"   stopColor={CYAN} stopOpacity="1" />
                      <Stop offset="0.5" stopColor={BRIGHT_CYAN} stopOpacity="1" />
                      <Stop offset="1"   stopColor={ACCENT_VIOLET} stopOpacity="1" />
                    </SvgGrad>
                    <SvgGrad id="trackGrad" x1="0" y1="0" x2="1" y2="1">
                      <Stop offset="0" stopColor="#ffffff" stopOpacity="0.08" />
                      <Stop offset="1" stopColor="#ffffff" stopOpacity="0.03" />
                    </SvgGrad>
                  </Defs>
                  {/* Track */}
                  <Circle cx={cx} cy={cx} r={rMain} fill="none" stroke="url(#trackGrad)" strokeWidth={STROKE_WIDTH + 2} />
                  {/* Ambient Glow */}
                  <Circle cx={cx} cy={cx} r={rMain} fill="none" stroke="url(#sleekGlow)" strokeWidth={STROKE_WIDTH + 14} strokeLinecap="round" strokeDasharray={`${cMain}`} strokeDashoffset={`${offsetMain}`} opacity={0.15} />
                  {/* Mid Glow */}
                  <Circle cx={cx} cy={cx} r={rMain} fill="none" stroke="url(#sleekGlow)" strokeWidth={STROKE_WIDTH + 6} strokeLinecap="round" strokeDasharray={`${cMain}`} strokeDashoffset={`${offsetMain}`} opacity={0.4} />
                  {/* Core Crisp Arc */}
                  <Circle cx={cx} cy={cx} r={rMain} fill="none" stroke="url(#sleekGlow)" strokeWidth={STROKE_WIDTH} strokeLinecap="round" strokeDasharray={`${cMain}`} strokeDashoffset={`${offsetMain}`} opacity={1} />
                </Svg>
              </View>

              {/* Clean Inner Typography */}
              <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={[st.heroSteps, { fontSize: 44, fontWeight: '900', letterSpacing: -1.0, color: '#fff', textShadowColor: CYAN + '80', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12 }]}>
                  {fmtK(todaySteps)}
                </Text>
                <Text style={[st.heroStepsLbl, { color: 'rgba(255,255,255,0.5)', marginTop: 0, letterSpacing: 2, fontSize: 10 }]}>STEPS</Text>
                <View style={{ marginTop: 8, backgroundColor: 'rgba(56,189,248,0.18)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(56,189,248,0.4)' }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: BRIGHT_CYAN }}>{Math.round(todayPct * 100)}% of Intention</Text>
                </View>
              </View>
            </View>

            <Text style={st.heroSubtitle}>
              {todayPct >= 1
                ? 'Daily intention fulfilled. You are perfectly grounded today.'
                : `You are ${Math.round(todayPct * 100)}% to your daily grounding intention.`}
            </Text>
          </View>

          {/* ── WEEKLY JOURNEY (Frosted Glass Card) ─────────────────────────────── */}
          {summary && (
            <View style={[st.chartCard, { paddingVertical: 24 }]}>
              <LinearGradient colors={['rgba(255,255,255,0.06)', 'transparent']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.6 }} style={StyleSheet.absoluteFillObject} pointerEvents="none" />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <View>
                  <Text style={st.chartTitle}>Weekly Journey</Text>
                  <Text style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>Last 7 Days Progress</Text>
                </View>
                <View style={[st.goalBadge, { borderColor: ACCENT_VIOLET + '40', backgroundColor: ACCENT_VIOLET + '15' }]}>
                  <Text style={[st.goalBadgeTxt, { color: ACCENT_VIOLET }]}>Intention {fmtK(summary.weeklyGoal)}</Text>
                </View>
              </View>

              <View style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
                  <Text style={{ fontSize: 32, fontFamily: 'Nunito_800ExtraBold', color: '#fff', textShadowColor: ACCENT_VIOLET + '80', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 }}>
                    {summary.weeklySteps.toLocaleString()} <Text style={{ fontSize: 14, color: MUTED }}>steps</Text>
                  </Text>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: ACCENT_VIOLET }}>{summary.weeklyGoalPercent}%</Text>
                </View>
                {/* Progress Bar */}
                <View style={{ height: 12, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 6, overflow: 'hidden' }}>
                  <View style={{ 
                    position: 'absolute', top: 0, left: 0, bottom: 0, 
                    width: `${Math.min(100, summary.weeklyGoalPercent)}%`, 
                    backgroundColor: ACCENT_VIOLET,
                    borderRadius: 6 
                  }}>
                    <LinearGradient
                      colors={['rgba(255,255,255,0.4)', 'transparent']}
                      start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                      style={StyleSheet.absoluteFillObject}
                    />
                  </View>
                </View>
              </View>
              
              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 8, textAlign: 'center', fontWeight: '500' }}>
                {summary.weeklyGoalPercent >= 100 
                  ? 'Incredible! You have reached your weekly cosmic intention.' 
                  : `${(summary.weeklyGoal - summary.weeklySteps).toLocaleString()} steps remaining to complete your weekly journey.`}
              </Text>
            </View>
          )}

          {/* ── 7-DAY BAR CHART (Frosted Glass) ─────────────────────────────── */}
          <View style={st.chartCard}>
            <LinearGradient colors={['rgba(255,255,255,0.06)', 'transparent']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.6 }} style={StyleSheet.absoluteFillObject} pointerEvents="none" />
            <View style={st.chartTop}>
              <Text style={st.chartTitle}>Your Daily Rhythm</Text>
              <View style={[st.goalBadge, { borderColor: GOLD + '40', backgroundColor: GOLD + '15' }]}>
                <Text style={[st.goalBadgeTxt, { color: GOLD }]}>Intention {fmtK(goal)}</Text>
              </View>
            </View>

            <View style={{ height: chartH + 65, marginTop: 10 }}>
              <Svg width={chartW} height={chartH + 65}>
                <Defs>
                  <SvgGrad id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={BRIGHT_CYAN} stopOpacity="1" />
                    <Stop offset="0.5" stopColor={CYAN} stopOpacity="1" />
                    <Stop offset="1" stopColor={DEEP_CYAN} stopOpacity="0.8" />
                  </SvgGrad>
                  <SvgGrad id="hotGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={GOLD} stopOpacity="1" />
                    <Stop offset="0.5" stopColor={ORANGE} stopOpacity="1" />
                    <Stop offset="1" stopColor={ORANGE} stopOpacity="0.8" />
                  </SvgGrad>
                </Defs>

                {/* Goal dashed line */}
                <Line
                  x1={0} y1={chartH - (goal / maxBarSteps) * chartH + 20} x2={chartW} y2={chartH - (goal / maxBarSteps) * chartH + 20}
                  stroke={GOLD} strokeWidth={1.5} strokeDasharray="6 6" opacity={0.5}
                />

                {last7Days.map((d, i) => {
                  const x = (i + 0.5) * barSpacing;
                  const barH = Math.max(8, (d.steps / maxBarSteps) * chartH);
                  const y = chartH - barH + 20; // Shift down by 20 for top label space
                  const isMet = d.goalMet;
                  const isHot = d.steps >= goal * 1.5;
                  const strokeCol = isHot ? "url(#hotGrad)" : isMet ? "url(#barGrad)" : "rgba(56,189,248,0.25)";

                  return (
                    <G key={d.date} onPress={() => d.steps > 0 && openSheet(d)}>
                      {/* Invisible touch target for easy clicking */}
                      <Line x1={x} y1={0} x2={x} y2={chartH + 65} stroke="transparent" strokeWidth={barSpacing * 0.8} />
                      
                      {/* Bar Track Background */}
                      <Line x1={x} y1={20} x2={x} y2={chartH + 20} stroke="rgba(255,255,255,0.04)" strokeWidth={16} strokeLinecap="round" />
                      
                      {/* Actual Bar */}
                      <Line
                        x1={x} y1={chartH + 20} x2={x} y2={y}
                        stroke={strokeCol}
                        strokeWidth={16} strokeLinecap="round"
                      />
                      
                      {/* Top Step Count Label */}
                      {d.steps > 0 && (
                        <SvgText
                          x={x} y={y - 12}
                          fontSize={11} fill={isMet ? '#ffffff' : MUTED} textAnchor="middle" fontWeight="800"
                        >
                          {fmtK(d.steps)}
                        </SvgText>
                      )}

                      {/* Bottom Day Label */}
                      <SvgText
                        x={x} y={chartH + 42}
                        fontSize={11} fill={MUTED} textAnchor="middle" fontWeight="700"
                      >
                        {weekdayChar(d.date)}
                      </SvgText>
                      {/* Date Number */}
                      <SvgText
                        x={x} y={chartH + 56}
                        fontSize={9} fill={MUTED} textAnchor="middle" fontWeight="600" opacity={0.6}
                      >
                        {new Date(d.date + 'T12:00:00').getDate()}
                      </SvgText>
                    </G>
                  );
                })}
              </Svg>
            </View>
          </View>

          {/* ── 4 INSIGHT CARDS (Frosted 2x2) ─────────────────────────────── */}
          {summary && (
            <View style={st.statsGrid}>
              {[
                { label: 'Current Streak', val: `${summary.currentStreak} Days`, icon: '🔥', color: ORANGE },
                { label: 'Longest Streak', val: `${summary.longestStreak} Days`, icon: '👑', color: GOLD },
                { label: 'Best Day', val: fmtK(summary.bestDay), icon: '☀️', color: BRIGHT_CYAN },
                { label: 'Daily Average', val: fmtK(summary.avgPerDay), icon: '👟', color: CYAN },
              ].map((s, i) => (
                <View key={i} style={[st.statCard, { borderColor: 'rgba(255,255,255,0.12)' }]}>
                  <LinearGradient colors={['rgba(255,255,255,0.06)', 'transparent']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.5 }} style={StyleSheet.absoluteFillObject} pointerEvents="none" />
                  <LinearGradient colors={[s.color + '12', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} pointerEvents="none" />
                  <View style={[st.statIconBox, { backgroundColor: s.color + '15', borderColor: s.color + '30', borderWidth: 1 }]}>
                    <Text style={st.statIcon}>{s.icon}</Text>
                  </View>
                  <Text style={[st.statVal, { color: s.color, textShadowColor: s.color + '60', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 }]}>{s.val}</Text>
                  <Text style={st.statLabel}>{s.label}</Text>
                </View>
              ))}
            </View>
          )}

          {/* ── CONSISTENCY MOSAIC (Frosted Heatmap) ────────────────────────── */}
          <View style={st.heatCard}>
            <LinearGradient colors={['rgba(255,255,255,0.06)', 'transparent']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.5 }} style={StyleSheet.absoluteFillObject} pointerEvents="none" />
            <Text style={st.heatTitle}>7-Day Consistency</Text>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
              {last7Days.map((cell, di) => {
                const pct = Math.min(1, cell.steps / goal);
                const bg = heatColour(pct);
                const isActive = cell.steps > 0;
                return (
                  <View key={di} style={{ alignItems: 'center', gap: 6 }}>
                    <TouchableOpacity
                      onPress={() => isActive && openSheet(cell)}
                      disabled={!isActive}
                      style={[{ width: CELL, height: CELL, backgroundColor: bg, borderRadius: 10, borderWidth: 1, borderColor: isActive ? CYAN + '40' : 'rgba(255,255,255,0.05)' }]}
                    />
                    <Text style={st.heatHeaderTxt}>{weekdayChar(cell.date)}</Text>
                  </View>
                );
              })}
            </View>

            <View style={st.heatLegend}>
              <Text style={st.heatLegendTxt}>Rest</Text>
              {[0, 0.25, 0.5, 0.75, 1].map(p => (
                <View key={p} style={[st.heatLegendCell, { backgroundColor: heatColour(p), borderRadius: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }]} />
              ))}
              <Text style={st.heatLegendTxt}>Grounded</Text>
            </View>
          </View>

        </Animated.View>
      </ScrollView>

      {/* ── DAY DETAIL BOTTOM SHEET (Deep Glassmorphism) ───────────────────── */}
      {showSheet && selectedDay && (
        <Modal transparent animationType="fade" onRequestClose={closeSheet}>
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)' }}
            onPress={closeSheet}
            activeOpacity={1}
          />
          <Animated.View
            style={[
              st.sheet,
              {
                transform: [{
                  translateY: sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [500, 0] }),
                }],
              },
            ]}
          >
            <LinearGradient colors={['rgba(12,24,48,0.95)', 'rgba(6,12,24,0.98)']} style={StyleSheet.absoluteFillObject} />
            <LinearGradient colors={['rgba(255,255,255,0.12)', 'transparent']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.4 }} style={StyleSheet.absoluteFillObject} pointerEvents="none" />
            <LinearGradient colors={[CYAN + '60', 'transparent', CYAN + '60']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1.5 }} pointerEvents="none" />
            
            <View style={st.sheetHandle} />
            
            <Text style={st.sheetDate}>{shortDate(selectedDay.date)}</Text>
            
            <Text style={[st.sheetSteps, { color: selectedDay.goalMet ? CYAN : BRIGHT_CYAN }]}>
              {selectedDay.steps.toLocaleString()}
            </Text>
            <Text style={st.sheetStepsLbl}>STEPS</Text>

            <Text style={[st.sheetGoalTag, { color: selectedDay.goalMet ? GOLD : MUTED }]}>
              {selectedDay.goalMet ? '✨ Cosmic Goal Achieved' : `${Math.round((selectedDay.steps / goal) * 100)}% of daily intention`}
            </Text>

            <View style={st.sheetGrid}>
              {[
                { label: 'Distance', val: `${selectedDay.distanceKm.toFixed(2)} km`, color: CYAN },
              ].map((item, i) => (
                <View key={i} style={[st.sheetStat, { borderColor: 'rgba(255,255,255,0.12)' }]}>
                  <LinearGradient colors={['rgba(255,255,255,0.06)', 'transparent']} style={StyleSheet.absoluteFillObject} pointerEvents="none" />
                  <LinearGradient colors={[item.color + '15', 'transparent']} style={StyleSheet.absoluteFillObject} pointerEvents="none" />
                  <Text style={[st.sheetStatVal, { color: item.color, textShadowColor: item.color + '60', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 }]}>{item.val}</Text>
                  <Text style={st.sheetStatLabel}>{item.label}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity style={st.sheetClose} onPress={closeSheet} activeOpacity={0.8}>
              <LinearGradient colors={['rgba(255,255,255,0.1)', 'transparent']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.5 }} style={StyleSheet.absoluteFillObject} pointerEvents="none" />
              <Text style={st.sheetCloseTxt}>Return to Journey</Text>
            </TouchableOpacity>
          </Animated.View>
        </Modal>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(12,24,48,0.7)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  zIndex: 100, elevation: 100,
  },
  // Sleeker elegant header
  title: { fontSize: 26, fontWeight: '700', color: '#fff', letterSpacing: 0.2, fontFamily: 'DancingScript_600SemiBold', textShadowColor: CYAN + '50', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 },

  heroTitle: { fontSize: 11, fontWeight: '800', color: CYAN, letterSpacing: 1.8, textTransform: 'uppercase', opacity: 0.85 },
  heroSteps: { fontFamily: 'Nunito_300Light' },
  heroStepsLbl: { fontWeight: '800' },
  heroSubtitle: { fontSize: 12, color: 'rgba(186,230,253,0.65)', textAlign: 'center', lineHeight: 18, fontWeight: '500', paddingHorizontal: 32 },

  chartCard: {
    borderRadius: 32, borderWidth: 1, borderColor: BORDER,
    backgroundColor: CARD, padding: 24, marginBottom: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 8,
  },
  chartTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chartTitle: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
  goalBadge: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  goalBadgeTxt: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 16,
  },
  statCard: {
    width: '47.5%', borderRadius: 28, borderWidth: 1, borderColor: BORDER,
    backgroundColor: CARD, padding: 20, gap: 8, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 8,
  },
  statIconBox: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  statIcon: { fontSize: 15 },
  statVal: { fontSize: 22, fontFamily: 'Nunito_800ExtraBold', letterSpacing: -0.5 },
  statLabel: { fontSize: 10, color: MUTED, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },

  heatCard: {
    borderRadius: 32, borderWidth: 1, borderColor: BORDER,
    backgroundColor: CARD, padding: 24, marginBottom: 32, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 8,
  },
  heatTitle: { fontSize: 16, fontWeight: '800', color: '#fff', marginBottom: 14, letterSpacing: 0.3 },
  heatHeaderTxt: { fontSize: 10, color: MUTED, fontWeight: '800', textAlign: 'center', flex: 1, marginTop: 4 },
  heatLegend: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24, alignSelf: 'flex-end',
  },
  heatLegendTxt: { fontSize: 9, color: MUTED, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  heatLegendCell: { width: 14, height: 14 },

  // ── Bottom Sheet ─────────────────────────────────────────────────────────
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 36, borderTopRightRadius: 36,
    padding: 26, paddingBottom: 40, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: CYAN, shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 20,
  },
  sheetHandle: { width: 44, height: 5, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 3, alignSelf: 'center', marginBottom: 24 },
  sheetDate: { fontSize: 12, color: MUTED, fontWeight: '800', textAlign: 'center', letterSpacing: 2.5, textTransform: 'uppercase' },
  sheetSteps: { fontSize: 52, fontFamily: 'Nunito_300Light', textAlign: 'center', letterSpacing: -2, marginTop: 6, textShadowColor: CYAN + '60', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12 },
  sheetStepsLbl: { fontSize: 10, color: CYAN, fontWeight: '800', textAlign: 'center', letterSpacing: 3, marginTop: 0 },
  sheetGoalTag: { fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: 14, marginBottom: 28 },
  sheetGrid: { flexDirection: 'row', gap: 14, marginBottom: 28 },
  sheetStat: {
    flex: 1, borderRadius: 22, borderWidth: 1,
    backgroundColor: 'rgba(12,24,48,0.6)', padding: 18, alignItems: 'center', gap: 4, overflow: 'hidden',
  },
  sheetStatVal: { fontSize: 22, fontFamily: 'Nunito_800ExtraBold', letterSpacing: -0.5 },
  sheetStatLabel: { fontSize: 10, color: MUTED, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  sheetClose: { borderRadius: 22, paddingVertical: 16, alignItems: 'center', backgroundColor: 'rgba(56,189,248,0.15)', borderWidth: 1, borderColor: CYAN + '40', overflow: 'hidden' },
  sheetCloseTxt: { color: BRIGHT_CYAN, fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },
});
