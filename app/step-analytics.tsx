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
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, {
  Circle, Defs, LinearGradient as SvgGrad, Stop,
  Line, Text as SvgText,
} from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

import StepCounter, { type DailyData, type AnalyticsSummary } from '@/src/modules/StepCounter';

const { width: W } = Dimensions.get('window');

// ── Design tokens ─────────────────────────────────────────────────────────────
const BG = '#020617';
const CARD = 'rgba(15,23,42,0.6)';
const BORDER = 'rgba(56,189,248,0.15)';
const SKY_BLUE = '#0ea5e9';
const CYAN = '#38bdf8';
const DEEP_CYAN = '#0284c7';
const BRIGHT_CYAN = '#bae6fd';
const GOLD = '#fde047';
const TEAL = '#2DD4BF';
const ORANGE = '#FB923C';
const MUTED = 'rgba(56,189,248,0.5)';

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
  if (pct <= 0) return 'rgba(56,189,248,0.03)';
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
  const slideAnim = useRef(new Animated.Value(20)).current;
  const sheetAnim = useRef(new Animated.Value(0)).current;

  // Ultra-premium circle anims
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const rot1 = useRef(new Animated.Value(0)).current;
  const rot2 = useRef(new Animated.Value(0)).current;
  const rot3 = useRef(new Animated.Value(0)).current;

  // ── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const analytics = await StepCounter.getThirtyDayAnalytics();
      setAllData(analytics.dailyData);
      setSummary(analytics.summary);
      setLoading(false);

      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 600, easing: Easing.out(Easing.exp), useNativeDriver: true }),
      ]).start();
    })();

    Animated.loop(Animated.timing(rot1, { toValue: 1, duration: 25000, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(rot2, { toValue: 1, duration: 35000, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(rot3, { toValue: 1, duration: 15000, easing: Easing.linear, useNativeDriver: true })).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
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
  const realLast7 = allData.slice(-7);
  const emptyDays = Array(Math.max(0, 7 - realLast7.length)).fill(null).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (7 - i));
    return {
      date: d.toISOString().split('T')[0], steps: 0, goal: 8000, distanceKm: 0, calories: 0, activeMinutes: 0, goalMet: false, goalPercent: 0
    } as DailyData;
  });
  const last7Days = [...emptyDays, ...realLast7];
  const goal = last7Days[0]?.goal ?? 8000;

  // Hero Ring Math
  const weeklySteps = last7Days.reduce((sum, d) => sum + d.steps, 0);
  const weeklyGoal = goal * 7;
  const weeklyPct = Math.min(1, weeklySteps / (weeklyGoal || 1));

  // Ultra-Premium Ring Geometry
  const SIZE = Math.min(W - 48, 300);
  const cx = SIZE / 2;

  const rMain = SIZE * 0.38;
  const cMain = 2 * Math.PI * rMain;
  const offsetMain = cMain * (1 - Math.min(weeklyPct, 1));

  const rOuter = SIZE * 0.44;
  const rInner1 = SIZE * 0.32;
  const rInner2 = SIZE * 0.28;

  // Bar Chart Math
  const chartW = W - 88;
  const chartH = 120;
  const maxBarSteps = Math.max(goal, ...last7Days.map(d => d.steps), 1);
  const barSpacing = chartW / 7;

  // Heatmap
  const CELL = Math.floor((W - 88 - 24) / 7);

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient colors={['#020617', '#0f172a', '#020617']} style={StyleSheet.absoluteFillObject} />

      {/* Ambient background glow */}
      <Animated.View style={{
        position: 'absolute', width: 400, height: 400, borderRadius: 200, backgroundColor: DEEP_CYAN, top: '10%',
        opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.03, 0.12] }),
        alignSelf: 'center',
        transform: [{ scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.1] }) }]
      }} />

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <View style={[st.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={st.backBtn}>
          <Ionicons name="arrow-back" size={20} color={BRIGHT_CYAN} />
        </TouchableOpacity>
        <Text style={st.title}>Your Journey</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 40 }}
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

          {/* ── WEEKLY HERO RING ──────────────────────────────────────────────── */}
          <View style={{ alignItems: 'center', marginTop: 10, marginBottom: 20 }}>
            <Text style={st.heroTitle}>This Week's Immersion</Text>

            <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center', marginTop: 12, marginBottom: 12 }}>

              {/* Core Glow Pulse */}
              <Animated.View style={{
                position: 'absolute', width: rInner2 * 2, height: rInner2 * 2, borderRadius: rInner2,
                backgroundColor: CYAN,
                opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.02, 0.08] }),
                transform: [{ scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.1] }) }]
              }} />

              {/* SVG Elements */}
              <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ position: 'absolute' }}>
                <Defs>
                  <SvgGrad id="glow" x1="0%" y1="0%" x2="100%" y2="100%">
                    <Stop offset="0%" stopColor={BRIGHT_CYAN} stopOpacity="1" />
                    <Stop offset="50%" stopColor={CYAN} stopOpacity="1" />
                    <Stop offset="100%" stopColor={DEEP_CYAN} stopOpacity="1" />
                  </SvgGrad>
                </Defs>

                {/* Static thin track for main progress */}
                <Circle cx={cx} cy={cx} r={rMain} stroke="rgba(56,189,248,0.1)" strokeWidth={2} fill="none" />

                {/* Main Progress Arc */}
                <Circle
                  cx={cx} cy={cx} r={rMain}
                  stroke="url(#glow)"
                  strokeWidth={5}
                  fill="none"
                  strokeDasharray={`${cMain}`}
                  strokeDashoffset={`${offsetMain}`}
                  strokeLinecap="round"
                  rotation={-90}
                  origin={`${cx}, ${cx}`}
                />
              </Svg>

              {/* Rotating Outer Ring (Dashed) */}
              <Animated.View style={{ position: 'absolute', width: SIZE, height: SIZE, transform: [{ rotate: rot1.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
                <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
                  <Circle cx={cx} cy={cx} r={rOuter} stroke={DEEP_CYAN} strokeWidth={1} fill="none" strokeDasharray="4 8" opacity={0.6} />
                  <Circle cx={cx} cy={cx} r={rOuter} stroke={CYAN} strokeWidth={2} fill="none" strokeDasharray="1 30" opacity={0.8} />
                </Svg>
              </Animated.View>

              {/* Rotating Inner Ring 1 (Dashed opposite) */}
              <Animated.View style={{ position: 'absolute', width: SIZE, height: SIZE, transform: [{ rotate: rot2.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] }) }] }}>
                <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
                  <Circle cx={cx} cy={cx} r={rInner1} stroke={CYAN} strokeWidth={1.5} fill="none" strokeDasharray="15 15" opacity={0.3} />
                  <Circle cx={cx} cy={cx} r={rInner1} stroke={BRIGHT_CYAN} strokeWidth={3} fill="none" strokeDasharray="0.5 45" opacity={0.9} strokeLinecap="round" />
                </Svg>
              </Animated.View>

              {/* Rotating Inner Ring 2 (Fast scanning ring) */}
              <Animated.View style={{ position: 'absolute', width: SIZE, height: SIZE, transform: [{ rotate: rot3.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
                <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
                  <Circle cx={cx} cy={cx} r={rInner2} stroke={DEEP_CYAN} strokeWidth={1} fill="none" strokeDasharray="2 12" opacity={0.4} />
                  <Circle cx={cx} cy={cx} r={rInner2} stroke={BRIGHT_CYAN} strokeWidth={1.5} fill="none" strokeDasharray="20 200" opacity={0.7} />
                </Svg>
              </Animated.View>

              {/* Percentage Text inside the ring */}
              <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <Text style={st.heroSteps}>{fmtK(weeklySteps)}</Text>
                </View>
                <Text style={st.heroStepsLbl}>STEPS</Text>
              </View>
            </View>

            <Text style={st.heroSubtitle}>
              {weeklyPct >= 1
                ? 'Cosmic goal achieved. You are perfectly grounded.'
                : `You are ${Math.round(weeklyPct * 100)}% to your weekly grounding goal.`}
            </Text>
          </View>

          {/* ── 7-DAY BAR CHART ──────────────────────────────────────────────── */}
          <View style={st.chartCard}>
            <View style={st.chartTop}>
              <Text style={st.chartTitle}>Past 7 Days</Text>
              <View style={[st.goalBadge, { borderColor: GOLD + '40' }]}>
                <Text style={[st.goalBadgeTxt, { color: GOLD }]}>Daily Goal {fmtK(goal)}</Text>
              </View>
            </View>

            <View style={{ height: chartH + 30, marginTop: 10 }}>
              <Svg width={chartW} height={chartH + 30}>
                <Defs>
                  <SvgGrad id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={BRIGHT_CYAN} stopOpacity="1" />
                    <Stop offset="0.5" stopColor={CYAN} stopOpacity="1" />
                    <Stop offset="1" stopColor={DEEP_CYAN} stopOpacity="1" />
                  </SvgGrad>
                </Defs>

                {/* Goal dashed line */}
                <Line
                  x1={0} y1={chartH - (goal / maxBarSteps) * chartH} x2={chartW} y2={chartH - (goal / maxBarSteps) * chartH}
                  stroke={GOLD} strokeWidth={1} strokeDasharray="4 4" opacity={0.3}
                />

                {last7Days.map((d, i) => {
                  const x = (i + 0.5) * barSpacing;
                  const barH = Math.max(8, (d.steps / maxBarSteps) * chartH);
                  const y = chartH - barH;
                  const isMet = d.goalMet;

                  return (
                    <React.Fragment key={d.date}>
                      {/* Bar Track Background */}
                      <Line x1={x} y1={0} x2={x} y2={chartH} stroke="rgba(56,189,248,0.05)" strokeWidth={12} strokeLinecap="round" />
                      {/* Actual Bar */}
                      <Line
                        x1={x} y1={chartH} x2={x} y2={y}
                        stroke={isMet ? "url(#barGrad)" : "rgba(56,189,248,0.15)"}
                        strokeWidth={12} strokeLinecap="round"
                      />
                      {/* Label */}
                      <SvgText
                        x={x} y={chartH + 20}
                        fontSize={10} fill={MUTED} textAnchor="middle" fontWeight="700"
                      >
                        {weekdayChar(d.date)}
                      </SvgText>
                    </React.Fragment>
                  );
                })}
              </Svg>
            </View>
          </View>

          {/* ── 4 INSIGHT CARDS (2x2) ───────────────────────────────────────── */}
          {summary && (
            <View style={st.statsGrid}>
              {[
                { label: 'Current Streak', val: `${summary.currentStreak} Days`, icon: '🔥', color: ORANGE },
                { label: 'Longest Streak', val: `${summary.longestStreak} Days`, icon: '👑', color: GOLD },
                { label: 'Best Day', val: fmtK(summary.bestDay), icon: '☀️', color: BRIGHT_CYAN },
                { label: 'Daily Average', val: fmtK(summary.avgPerDay), icon: '👟', color: CYAN },
              ].map((s, i) => (
                <View key={i} style={[st.statCard, { borderColor: s.color + '25' }]}>
                  <LinearGradient colors={[s.color + '10', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
                  <View style={st.statIconBox}>
                    <Text style={st.statIcon}>{s.icon}</Text>
                  </View>
                  <Text style={[st.statVal, { color: s.color, textShadowColor: s.color + '80', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 6 }]}>{s.val}</Text>
                  <Text style={st.statLabel}>{s.label}</Text>
                </View>
              ))}
            </View>
          )}

          {/* ── CONSISTENCY MOSAIC (Heatmap) ─────────────────────────────────── */}
          <View style={st.heatCard}>
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
                      style={[{ width: CELL, height: CELL, backgroundColor: bg, borderRadius: 8, borderWidth: 1, borderColor: isActive ? CYAN + '30' : 'transparent' }]}
                    />
                    <Text style={st.heatHeaderTxt}>{weekdayChar(cell.date)}</Text>
                  </View>
                );
              })}
            </View>

            <View style={st.heatLegend}>
              <Text style={st.heatLegendTxt}>Rest</Text>
              {[0, 0.25, 0.5, 0.75, 1].map(p => (
                <View key={p} style={[st.heatLegendCell, { backgroundColor: heatColour(p), borderRadius: 3 }]} />
              ))}
              <Text style={st.heatLegendTxt}>Grounded</Text>
            </View>
          </View>

        </Animated.View>
      </ScrollView>

      {/* ── DAY DETAIL BOTTOM SHEET (Glassmorphism) ──────────────────────────────────────────── */}
      {showSheet && selectedDay && (
        <Modal transparent animationType="fade" onRequestClose={closeSheet}>
          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={closeSheet}
            activeOpacity={1}
          >
            <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFillObject} />
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
          </TouchableOpacity>

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
            <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFillObject} />
            <LinearGradient colors={['rgba(2,132,199,0.15)', 'rgba(2,6,23,0.95)']} style={StyleSheet.absoluteFillObject} />
            
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
                <View key={i} style={[st.sheetStat, { borderColor: item.color + '30' }]}>
                  <LinearGradient colors={[item.color + '10', 'transparent']} style={StyleSheet.absoluteFillObject} />
                  <Text style={[st.sheetStatVal, { color: item.color }]}>{item.val}</Text>
                  <Text style={st.sheetStatLabel}>{item.label}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity style={st.sheetClose} onPress={closeSheet} activeOpacity={0.8}>
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
    paddingHorizontal: 24,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(2,132,199,0.15)',
    borderWidth: 1, borderColor: DEEP_CYAN,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 32, fontWeight: '800', color: BRIGHT_CYAN, letterSpacing: -0.5, fontFamily: 'DancingScript_600SemiBold', textShadowColor: CYAN + '60', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 },

  heroTitle: { fontSize: 13, fontWeight: '800', color: CYAN, letterSpacing: 1.5, textTransform: 'uppercase', opacity: 0.8 },
  heroSteps: { fontSize: 52, fontFamily: 'Nunito_300Light', color: '#fff', letterSpacing: -1.5, textShadowColor: CYAN + '80', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 },
  heroStepsLbl: { fontSize: 10, fontWeight: '800', color: CYAN, letterSpacing: 2, marginTop: 4 },
  heroSubtitle: { fontSize: 13, color: 'rgba(186,230,253,0.7)', textAlign: 'center', lineHeight: 20, fontWeight: '600', paddingHorizontal: 40 },

  chartCard: {
    borderRadius: 32, borderWidth: 1, borderColor: BORDER,
    backgroundColor: CARD, padding: 20, marginBottom: 16, overflow: 'hidden',
  },
  chartTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chartTitle: { fontSize: 18, fontWeight: '800', color: BRIGHT_CYAN, letterSpacing: 0.2 },
  goalBadge: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: 'rgba(253,224,71,0.05)' },
  goalBadgeTxt: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16,
  },
  statCard: {
    width: '47.5%', borderRadius: 24, borderWidth: 1,
    backgroundColor: CARD, padding: 18, gap: 8, overflow: 'hidden',
  },
  statIconBox: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(56,189,248,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  statIcon: { fontSize: 16 },
  statVal: { fontSize: 24, fontFamily: 'Nunito_800ExtraBold', letterSpacing: -0.5 },
  statLabel: { fontSize: 11, color: MUTED, fontWeight: '700', letterSpacing: 0.5 },

  heatCard: {
    borderRadius: 32, borderWidth: 1, borderColor: BORDER,
    backgroundColor: CARD, padding: 20, marginBottom: 32, overflow: 'hidden',
  },
  heatTitle: { fontSize: 18, fontWeight: '800', color: BRIGHT_CYAN, marginBottom: 16, letterSpacing: 0.2 },
  heatHeaderTxt: { fontSize: 10, color: MUTED, fontWeight: '800', textAlign: 'center', flex: 1, marginTop: 4 },
  heatLegend: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24, alignSelf: 'flex-end',
  },
  heatLegendTxt: { fontSize: 10, color: MUTED, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  heatLegendCell: { width: 14, height: 14 },

  // ── Bottom Sheet ─────────────────────────────────────────────────────────
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 40, borderTopRightRadius: 40,
    padding: 24, paddingBottom: 40, overflow: 'hidden', borderWidth: 1, borderColor: BORDER
  },
  sheetHandle: { width: 48, height: 5, backgroundColor: 'rgba(186,230,253,0.3)', borderRadius: 3, alignSelf: 'center', marginBottom: 28 },
  sheetDate: { fontSize: 14, color: MUTED, fontWeight: '800', textAlign: 'center', letterSpacing: 2, textTransform: 'uppercase' },
  sheetSteps: { fontSize: 56, fontFamily: 'Nunito_300Light', textAlign: 'center', letterSpacing: -2, marginTop: 8, textShadowColor: CYAN + '60', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 },
  sheetStepsLbl: { fontSize: 11, color: CYAN, fontWeight: '800', textAlign: 'center', letterSpacing: 3, marginTop: 2 },
  sheetGoalTag: { fontSize: 14, fontWeight: '700', textAlign: 'center', marginTop: 16, marginBottom: 32 },
  sheetGrid: { flexDirection: 'row', gap: 12, marginBottom: 32 },
  sheetStat: {
    flex: 1, borderRadius: 24, borderWidth: 1,
    backgroundColor: 'rgba(2,132,199,0.1)', padding: 20, alignItems: 'center', gap: 6, overflow: 'hidden',
  },
  sheetStatVal: { fontSize: 24, fontFamily: 'Nunito_800ExtraBold', letterSpacing: -0.5 },
  sheetStatLabel: { fontSize: 11, color: MUTED, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  sheetClose: { borderRadius: 24, paddingVertical: 18, alignItems: 'center', backgroundColor: 'rgba(56,189,248,0.1)', borderWidth: 1, borderColor: CYAN + '30' },
  sheetCloseTxt: { color: BRIGHT_CYAN, fontWeight: '800', fontSize: 15, letterSpacing: 1 },
});
