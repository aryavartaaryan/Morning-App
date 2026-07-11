/**
 * step-analytics.tsx — Premium Mindful Journey Analytics
 * ─────────────────────────────────────────────────────────────────────────────
 * - Weekly Hero Progress Ring
 * - 7-Day Apple-Fitness style Bar Chart with rounded caps
 * - 4-card 2x2 Oura-style Glassmorphism grid
 * - 30-day consistency mosaic (heatmap)
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
import Svg, {
  Circle, Defs, LinearGradient as SvgGrad, Stop,
  Line, Text as SvgText,
} from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import StepCounter, { type DailyData, type AnalyticsSummary } from '@/src/modules/StepCounter';

const { width: W } = Dimensions.get('window');

// ── Design tokens ─────────────────────────────────────────────────────────────
const BG     = '#060A14';
const CARD   = 'rgba(255,255,255,0.04)';
const BORDER = 'rgba(255,255,255,0.08)';
const ACCENT = '#38bdf8'; // Sky Blue
const GREEN  = '#34D399';
const GOLD   = '#FCD34D';
const TEAL   = '#2DD4BF';
const ORANGE = '#FB923C';
const MUTED  = 'rgba(255,255,255,0.4)';

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtK(n: number): string {
  if (n >= 1000000) return `${(n/1000000).toFixed(1)}M`;
  if (n >= 1000)    return `${(n/1000).toFixed(1)}k`;
  return String(n);
}
function shortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return `${d.getDate()} ${d.toLocaleString('default',{month:'short'})}`;
}
function weekdayChar(dateStr: string): string {
  return ['S','M','T','W','T','F','S'][new Date(dateStr + 'T12:00:00').getDay()];
}

// ── Heatmap colour by goal % ──────────────────────────────────────────────────
function heatColour(pct: number): string {
  if (pct <= 0) return 'rgba(255,255,255,0.03)';
  if (pct >= 1) return TEAL;
  const alpha = 0.2 + pct * 0.8;
  return `rgba(45,212,191,${alpha})`; // Teal with varying opacity
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function StepAnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // ── State ──────────────────────────────────────────────────────────────────
  const [allData,     setAllData]     = useState<DailyData[]>([]);
  const [summary,     setSummary]     = useState<AnalyticsSummary | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [selectedDay, setSelectedDay] = useState<DailyData | null>(null);
  const [showSheet,   setShowSheet]   = useState(false);

  // ── Animations ─────────────────────────────────────────────────────────────
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const sheetAnim = useRef(new Animated.Value(0)).current;

  // ── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const analytics = await StepCounter.getThirtyDayAnalytics();
      setAllData(analytics.dailyData);
      setSummary(analytics.summary);
      setLoading(false);

      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 500, easing: Easing.out(Easing.exp), useNativeDriver: true }),
      ]).start();
    })();
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
  const goal      = last7Days[0]?.goal ?? 8000;
  
  // Hero Ring Math
  const weeklySteps = last7Days.reduce((sum, d) => sum + d.steps, 0);
  const weeklyGoal  = goal * 7;
  const weeklyPct   = Math.min(1, weeklySteps / (weeklyGoal || 1));
  
  // Ring Geometry
  const RING_SZ = 180;
  const STROKE  = 14;
  const R       = (RING_SZ - STROKE) / 2;
  const CIRCUM  = 2 * Math.PI * R;
  const dashOffset = CIRCUM - weeklyPct * CIRCUM;

  // Bar Chart Math
  const chartW = W - 48;
  const chartH = 150;
  const maxBarSteps = Math.max(goal, ...last7Days.map(d => d.steps), 1);
  const barSpacing = chartW / 7;

  // ── Heatmap ───────────────────────────────────────────────────────────────
  const CELL = Math.floor((W - 48 - 20) / 7);

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient colors={['#0A1224', BG, BG]} style={StyleSheet.absoluteFillObject} />

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <View style={[st.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.navigate('/(tabs)/walk')} style={st.backBtn}>
          <Text style={st.backTxt}>✕</Text>
        </TouchableOpacity>
        <Text style={st.title}>Your Journey</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 40 }}
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

          {/* ── WEEKLY HERO RING ──────────────────────────────────────────────── */}
          <View style={st.heroCard}>
            <LinearGradient colors={['rgba(56,189,248,0.06)', 'transparent']} style={StyleSheet.absoluteFillObject} />
            <Text style={st.heroTitle}>This Week's Immersion</Text>
            
            <View style={{ alignItems: 'center', marginVertical: 20 }}>
              <Svg width={RING_SZ} height={RING_SZ} style={{ transform: [{ rotate: '-90deg' }] }}>
                <Defs>
                  <SvgGrad id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor={ACCENT} stopOpacity="1" />
                    <Stop offset="1" stopColor={TEAL} stopOpacity="1" />
                  </SvgGrad>
                </Defs>
                {/* Track */}
                <Circle cx={RING_SZ / 2} cy={RING_SZ / 2} r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={STROKE} />
                {/* Progress */}
                <Circle 
                  cx={RING_SZ / 2} cy={RING_SZ / 2} r={R} fill="none" 
                  stroke="url(#ringGrad)" strokeWidth={STROKE} strokeLinecap="round" 
                  strokeDasharray={CIRCUM} strokeDashoffset={dashOffset} 
                />
              </Svg>
              <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={st.heroSteps}>{fmtK(weeklySteps)}</Text>
                <Text style={st.heroStepsLbl}>STEPS</Text>
              </View>
            </View>
            
            <Text style={st.heroSubtitle}>
              {weeklyPct >= 1 
                ? 'Incredible dedication. You reached your weekly cosmic goal.' 
                : `You are ${Math.round(weeklyPct * 100)}% to your weekly grounding goal.`}
            </Text>
          </View>

          {/* ── 7-DAY BAR CHART ──────────────────────────────────────────────── */}
          <View style={st.chartCard}>
            <LinearGradient colors={['rgba(255,255,255,0.03)', 'transparent']} style={StyleSheet.absoluteFillObject} />
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
                    <Stop offset="0" stopColor={TEAL} stopOpacity="1" />
                    <Stop offset="1" stopColor={ACCENT} stopOpacity="1" />
                  </SvgGrad>
                </Defs>
                
                {/* Goal dashed line */}
                <Line
                  x1={0} y1={chartH - (goal / maxBarSteps) * chartH} x2={chartW} y2={chartH - (goal / maxBarSteps) * chartH}
                  stroke={GOLD} strokeWidth={1} strokeDasharray="4 4" opacity={0.3}
                />

                {last7Days.map((d, i) => {
                  const x = (i + 0.5) * barSpacing;
                  const barH = Math.max(10, (d.steps / maxBarSteps) * chartH);
                  const y = chartH - barH;
                  const isMet = d.goalMet;
                  
                  return (
                    <React.Fragment key={d.date}>
                      {/* Bar Track Background */}
                      <Line x1={x} y1={0} x2={x} y2={chartH} stroke="rgba(255,255,255,0.04)" strokeWidth={14} strokeLinecap="round" />
                      {/* Actual Bar */}
                      <Line 
                        x1={x} y1={chartH} x2={x} y2={y} 
                        stroke={isMet ? "url(#barGrad)" : "rgba(255,255,255,0.15)"} 
                        strokeWidth={14} strokeLinecap="round" 
                      />
                      {/* Label */}
                      <SvgText
                        x={x} y={chartH + 20}
                        fontSize={10} fill={MUTED} textAnchor="middle" fontWeight="600"
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
                { label: 'Best Day',       val: fmtK(summary.bestDay),           icon: '☀️', color: ACCENT },
                { label: 'Daily Average',  val: fmtK(summary.avgPerDay),         icon: '👟', color: TEAL },
              ].map((s, i) => (
                <View key={i} style={[st.statCard, { borderColor: s.color + '25' }]}>
                  <LinearGradient colors={[s.color + '10', 'transparent']} style={StyleSheet.absoluteFillObject} />
                  <View style={st.statIconBox}>
                    <Text style={st.statIcon}>{s.icon}</Text>
                  </View>
                  <Text style={[st.statVal, { color: s.color }]}>{s.val}</Text>
                  <Text style={st.statLabel}>{s.label}</Text>
                </View>
              ))}
            </View>
          )}

          {/* ── CONSISTENCY MOSAIC (Heatmap) ─────────────────────────────────── */}
          <View style={st.heatCard}>
            <LinearGradient colors={['rgba(45,212,191,0.05)', 'transparent']} style={StyleSheet.absoluteFillObject} />
            <Text style={st.heatTitle}>7-Day Consistency</Text>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
              {last7Days.map((cell, di) => {
                const pct  = Math.min(1, cell.steps / goal);
                const bg   = heatColour(pct);
                return (
                  <View key={di} style={{ alignItems: 'center', gap: 6 }}>
                    <TouchableOpacity
                      onPress={() => cell.steps > 0 && openSheet(cell)}
                      disabled={cell.steps === 0}
                      style={[{ width: CELL, height: CELL, backgroundColor: bg, borderRadius: 6, borderWidth: 1, borderColor: cell.steps > 0 ? 'rgba(255,255,255,0.05)' : 'transparent' }]}
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

      {/* ── DAY DETAIL BOTTOM SHEET ──────────────────────────────────────────── */}
      {showSheet && selectedDay && (
        <Modal transparent animationType="fade" onRequestClose={closeSheet}>
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' }}
            onPress={closeSheet}
            activeOpacity={1}
          />
          <Animated.View
            style={[
              st.sheet,
              {
                transform: [{
                  translateY: sheetAnim.interpolate({ inputRange: [0,1], outputRange: [400, 0] }),
                }],
              },
            ]}
          >
            <LinearGradient colors={['#0A1224', BG]} style={StyleSheet.absoluteFillObject} />
            <View style={st.sheetHandle} />
            <Text style={st.sheetDate}>{shortDate(selectedDay.date)}</Text>
            <Text style={[st.sheetSteps, { color: selectedDay.goalMet ? TEAL : ACCENT }]}>
              {selectedDay.steps.toLocaleString()}
            </Text>
            <Text style={st.sheetStepsLbl}>STEPS</Text>
            
            <Text style={[st.sheetGoalTag, { color: selectedDay.goalMet ? GOLD : MUTED }]}>
              {selectedDay.goalMet ? '✨ Cosmic Goal Achieved' : `${Math.round((selectedDay.steps / goal) * 100)}% of daily intention`}
            </Text>
            
            <View style={st.sheetGrid}>
              {[
                { label: 'Distance',  val: `${selectedDay.distanceKm.toFixed(2)} km`,       color: TEAL   },
              ].map((item, i) => (
                <View key={i} style={[st.sheetStat, { borderColor: item.color + '25' }]}>
                  <LinearGradient colors={[item.color + '0A', 'transparent']} style={StyleSheet.absoluteFillObject} />
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
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center',
  },
  backTxt:  { fontSize: 16, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  title:    { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.5, fontFamily: 'DancingScript_600SemiBold' },

  heroCard: {
    borderRadius: 24, borderWidth: 1, borderColor: BORDER,
    backgroundColor: CARD, padding: 24, marginBottom: 16, overflow: 'hidden', alignItems: 'center'
  },
  heroTitle: { fontSize: 13, fontWeight: '700', color: MUTED, letterSpacing: 1.5, textTransform: 'uppercase' },
  heroSteps: { fontSize: 44, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  heroStepsLbl: { fontSize: 10, fontWeight: '800', color: ACCENT, letterSpacing: 2 },
  heroSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 20, fontWeight: '500' },

  chartCard: {
    borderRadius: 24, borderWidth: 1, borderColor: BORDER,
    backgroundColor: CARD, padding: 20, marginBottom: 16, overflow: 'hidden',
  },
  chartTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chartTitle: { fontSize: 16, fontWeight: '800', color: '#fff' },
  goalBadge:  { borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  goalBadgeTxt: { fontSize: 10, fontWeight: '700' },

  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16,
  },
  statCard: {
    width: '47.5%', borderRadius: 20, borderWidth: 1,
    backgroundColor: CARD, padding: 16, gap: 6, overflow: 'hidden',
  },
  statIconBox: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  statIcon:  { fontSize: 16 },
  statVal:   { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  statLabel: { fontSize: 11, color: MUTED, fontWeight: '700' },

  heatCard: {
    borderRadius: 24, borderWidth: 1, borderColor: BORDER,
    backgroundColor: CARD, padding: 20, marginBottom: 32, overflow: 'hidden',
  },
  heatTitle:  { fontSize: 16, fontWeight: '800', color: '#fff', marginBottom: 16 },
  heatHeader: { flexDirection: 'row', gap: 2, marginBottom: 6 },
  heatHeaderTxt: { fontSize: 9, color: MUTED, fontWeight: '700', textAlign: 'center', flex: 1 },
  heatRow:  { flexDirection: 'row', gap: 2, marginBottom: 2 },
  heatCell: { gap: 2, alignItems: 'center', justifyContent: 'center' },
  heatLegend: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, alignSelf: 'flex-end',
  },
  heatLegendTxt:  { fontSize: 10, color: MUTED, fontWeight: '600' },
  heatLegendCell: { width: 12, height: 12 },

  // ── Bottom Sheet ─────────────────────────────────────────────────────────
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: BG, borderTopLeftRadius: 32, borderTopRightRadius: 32,
    padding: 24, paddingBottom: 40, overflow: 'hidden', borderWidth: 1, borderColor: BORDER
  },
  sheetHandle: { width: 40, height: 5, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3, alignSelf: 'center', marginBottom: 24 },
  sheetDate:   { fontSize: 13, color: MUTED, fontWeight: '700', textAlign: 'center', letterSpacing: 1, textTransform: 'uppercase' },
  sheetSteps:  { fontSize: 48, fontWeight: '900', textAlign: 'center', letterSpacing: -1.5, marginTop: 4 },
  sheetStepsLbl: { fontSize: 10, color: ACCENT, fontWeight: '800', textAlign: 'center', letterSpacing: 2, marginTop: -4 },
  sheetGoalTag:{ fontSize: 14, fontWeight: '700', textAlign: 'center', marginTop: 12, marginBottom: 24 },
  sheetGrid:   { flexDirection: 'row', gap: 12, marginBottom: 24 },
  sheetStat: {
    flex: 1, borderRadius: 16, borderWidth: 1,
    backgroundColor: CARD, padding: 16, alignItems: 'center', gap: 4, overflow: 'hidden',
  },
  sheetStatVal:  { fontSize: 18, fontWeight: '800' },
  sheetStatLabel:{ fontSize: 11, color: MUTED, fontWeight: '700' },
  sheetClose:    { borderRadius: 20, paddingVertical: 18, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: BORDER },
  sheetCloseTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
