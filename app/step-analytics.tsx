/**
 * step-analytics.tsx — 30-Day Step Analytics Screen
 * ─────────────────────────────────────────────────────────────────────────────
 * - 30-day SVG line chart (CubicBezier smooth) with goal line
 * - 8-stat summary cards in 2×4 grid
 * - 30-day calendar heatmap (custom grid, cells coloured by goal %)
 * - Tap any heatmap cell → BottomSheet with that day's breakdown
 * - Date range toggle: 7 / 30 / 90 days
 * - All charts native SVG — NO WebView
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Path, Circle, Defs, LinearGradient as SvgGrad, Stop,
  G, Rect, Text as SvgText, Line,
} from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import StepCounter, { type DailyData, type AnalyticsSummary } from '@/src/modules/StepCounter';

const { width: W } = Dimensions.get('window');

// ── Design tokens ─────────────────────────────────────────────────────────────
const BG     = '#0A0A0F';
const CARD   = 'rgba(255,255,255,0.055)';
const BORDER = 'rgba(255,255,255,0.09)';
const ACCENT = '#A78BFA';
const GREEN  = '#34D399';
const ORANGE = '#FB923C';
const PINK   = '#F472B6';
const GOLD   = '#FCD34D';
const TEAL   = '#2DD4BF';
const MUTED  = 'rgba(255,255,255,0.35)';

type Range = 7 | 30 | 90;

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

// ── Cubic Bezier smooth path builder ─────────────────────────────────────────
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return '';
  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const p0 = points[i - 1];
    const p1 = points[i];
    const cp1x = p0.x + (p1.x - p0.x) * 0.4;
    const cp1y = p0.y;
    const cp2x = p0.x + (p1.x - p0.x) * 0.6;
    const cp2y = p1.y;
    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p1.x},${p1.y}`;
  }
  return d;
}

// ── Heatmap colour by goal % ──────────────────────────────────────────────────
function heatColour(pct: number, accent: string): string {
  if (pct <= 0) return 'rgba(255,255,255,0.04)';
  if (pct >= 1) return accent;
  // Interpolate from dim accent to full accent
  const alpha = 0.15 + pct * 0.85;
  return accent + Math.round(alpha * 255).toString(16).padStart(2,'0');
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function StepAnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // ── State ──────────────────────────────────────────────────────────────────
  const [range,       setRange]       = useState<Range>(30);
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

  // ── Derived data by range ───────────────────────────────────────────────────
  const rangeData = allData.slice(-range);
  const goal      = rangeData[0]?.goal ?? 8000;
  const maxSteps  = Math.max(goal, ...rangeData.map(d => d.steps), 1);

  // ── Chart dimensions ────────────────────────────────────────────────────────
  const chartW = W - 48;
  const chartH = 140;

  // ── Build smooth line path ──────────────────────────────────────────────────
  const pts = rangeData.map((d, i) => ({
    x: rangeData.length > 1 ? (i / (rangeData.length - 1)) * chartW : chartW / 2,
    y: chartH - (d.steps / maxSteps) * chartH,
  }));
  const linePath  = smoothPath(pts);
  const areaPath  = linePath
    ? `${linePath} L${chartW},${chartH} L0,${chartH} Z`
    : '';
  const goalY = chartH - (goal / maxSteps) * chartH;

  // ── X-axis labels (show every nth) ─────────────────────────────────────────
  const labelStep = range <= 7 ? 1 : range <= 30 ? 5 : 10;
  const xLabels   = rangeData
    .map((d, i) => ({ d, i }))
    .filter(({ i }) => i % labelStep === 0 || i === rangeData.length - 1);

  // ── Heatmap: group into weeks ───────────────────────────────────────────────
  const heatData = allData.slice(-30);
  // Pad start so first day aligns to correct weekday column
  const firstWD = heatData.length > 0 ? new Date(heatData[0].date + 'T12:00:00').getDay() : 0;
  const padded  = [...Array(firstWD).fill(null), ...heatData];
  const weeks: (DailyData | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7));

  const CELL = Math.floor((W - 48 - 20) / 7);

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient colors={['#130A2A', BG, BG]} style={StyleSheet.absoluteFillObject} />

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <View style={[st.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={st.backBtn}>
          <Text style={st.backTxt}>←</Text>
        </TouchableOpacity>
        <Text style={st.title}>Analytics</Text>
        {/* Date range toggle */}
        <View style={st.rangeRow}>
          {([7, 30, 90] as Range[]).map(r => (
            <TouchableOpacity
              key={r}
              onPress={() => { Haptics.selectionAsync(); setRange(r); }}
              style={[st.rangePill, range === r && { backgroundColor: ACCENT + '28', borderColor: ACCENT }]}
            >
              <Text style={[st.rangeTxt, range === r && { color: ACCENT }]}>{r}d</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 40 }}
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

          {/* ── LINE CHART ───────────────────────────────────────────────────── */}
          <View style={st.chartCard}>
            <LinearGradient colors={[ACCENT + '10', 'transparent']} style={StyleSheet.absoluteFillObject} />
            <View style={st.chartTop}>
              <Text style={st.chartTitle}>{range}-Day Steps</Text>
              <View style={[st.goalBadge, { borderColor: GOLD + '40' }]}>
                <Text style={[st.goalBadgeTxt, { color: GOLD }]}>— goal {fmtK(goal)}</Text>
              </View>
            </View>

            <Svg width={chartW} height={chartH + 24} style={{ marginTop: 4 }}>
              <Defs>
                <SvgGrad id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0"   stopColor={ACCENT} stopOpacity="1" />
                  <Stop offset="0.5" stopColor={PINK}   stopOpacity="1" />
                  <Stop offset="1"   stopColor={TEAL}   stopOpacity="1" />
                </SvgGrad>
                <SvgGrad id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={ACCENT} stopOpacity="0.25" />
                  <Stop offset="1" stopColor={ACCENT} stopOpacity="0"    />
                </SvgGrad>
              </Defs>

              {/* Goal dashed line */}
              <Line
                x1={0} y1={goalY} x2={chartW} y2={goalY}
                stroke={GOLD} strokeWidth={1} strokeDasharray="5 4" opacity={0.5}
              />

              {/* Area fill */}
              {areaPath ? <Path d={areaPath} fill="url(#areaGrad)" opacity={0.6} /> : null}

              {/* Smooth line */}
              {linePath ? (
                <Path d={linePath} stroke="url(#lineGrad)" strokeWidth={2.5} fill="none" strokeLinecap="round" />
              ) : null}

              {/* Data dots on goal-met days */}
              {rangeData.map((d, i) => {
                if (!d.goalMet) return null;
                const x = rangeData.length > 1 ? (i / (rangeData.length - 1)) * chartW : chartW / 2;
                const y = chartH - (d.steps / maxSteps) * chartH;
                return (
                  <Circle key={d.date} cx={x} cy={y} r={3} fill={GREEN} opacity={0.9} />
                );
              })}

              {/* X-axis labels */}
              {xLabels.map(({ d, i }) => {
                const x = rangeData.length > 1 ? (i / (rangeData.length - 1)) * chartW : chartW / 2;
                return (
                  <SvgText
                    key={d.date} x={x} y={chartH + 16}
                    fontSize={8} fill={MUTED} textAnchor="middle" fontWeight="500"
                  >
                    {shortDate(d.date)}
                  </SvgText>
                );
              })}
            </Svg>
          </View>

          {/* ── 8 SUMMARY STAT CARDS (2×4) ──────────────────────────────────── */}
          {summary && (
            <View style={st.statsGrid}>
              {[
                { label: 'Total Steps',    val: fmtK(summary.totalSteps),                    icon: '👣', color: ACCENT  },
                { label: 'Best Day',       val: fmtK(summary.bestDay),                        icon: '🏆', color: GOLD   },
                { label: 'Avg / Day',      val: fmtK(summary.avgPerDay),                      icon: '📊', color: TEAL   },
                { label: 'Goal Rate',      val: `${summary.goalRate}%`,                       icon: '🎯', color: GREEN  },
                { label: 'Total Distance', val: `${StepCounter.stepsToKm(summary.totalSteps)} km`, icon: '🗺️', color: PINK   },
                { label: 'Total Calories', val: `${fmtK(StepCounter.stepsToCal(summary.totalSteps))} kcal`, icon: '🔥', color: ORANGE },
                { label: 'Cur. Streak',    val: `${summary.currentStreak}d`,                  icon: '⚡', color: ACCENT  },
                { label: 'Best Streak',    val: `${summary.longestStreak}d`,                  icon: '🌟', color: GOLD   },
              ].map((s, i) => (
                <View key={i} style={[st.statCard, { borderColor: s.color + '25' }]}>
                  <LinearGradient colors={[s.color + '10', 'transparent']} style={StyleSheet.absoluteFillObject} />
                  <Text style={st.statIcon}>{s.icon}</Text>
                  <Text style={[st.statVal, { color: s.color }]}>{s.val}</Text>
                  <Text style={st.statLabel}>{s.label}</Text>
                </View>
              ))}
            </View>
          )}

          {/* ── CALENDAR HEATMAP ─────────────────────────────────────────────── */}
          <View style={st.heatCard}>
            <LinearGradient colors={['rgba(167,139,250,0.08)', 'transparent']} style={StyleSheet.absoluteFillObject} />
            <Text style={st.heatTitle}>30-Day Heatmap</Text>

            {/* Day-of-week headers */}
            <View style={st.heatHeader}>
              {['S','M','T','W','T','F','S'].map((d, i) => (
                <View key={i} style={[st.heatCell, { width: CELL, height: 18 }]}>
                  <Text style={st.heatHeaderTxt}>{d}</Text>
                </View>
              ))}
            </View>

            {/* Weeks */}
            {weeks.map((week, wi) => (
              <View key={wi} style={st.heatRow}>
                {Array.from({ length: 7 }, (_, di) => {
                  const cell = week[di] ?? null;
                  const pct  = cell ? Math.min(1, cell.steps / goal) : 0;
                  const bg   = heatColour(pct, ACCENT);
                  return (
                    <TouchableOpacity
                      key={di}
                      onPress={() => cell && openSheet(cell)}
                      disabled={!cell}
                      style={[st.heatCell, { width: CELL, height: CELL, backgroundColor: bg, borderRadius: 4 }]}
                    />
                  );
                })}
              </View>
            ))}

            {/* Legend */}
            <View style={st.heatLegend}>
              <Text style={st.heatLegendTxt}>Less</Text>
              {[0, 0.25, 0.5, 0.75, 1].map(p => (
                <View key={p} style={[st.heatLegendCell, { backgroundColor: heatColour(p, ACCENT), borderRadius: 3 }]} />
              ))}
              <Text style={st.heatLegendTxt}>More</Text>
            </View>
          </View>

          {/* ── PER-DAY LIST (last 7 days) ───────────────────────────────────── */}
          <Text style={[st.sectionTitle, { marginBottom: 12 }]}>Recent Days</Text>
          {allData.slice(-7).reverse().map(d => (
            <TouchableOpacity
              key={d.date}
              style={st.dayRow}
              onPress={() => openSheet(d)}
            >
              <LinearGradient
                colors={d.goalMet ? [GREEN + '0A', 'transparent'] : ['transparent', 'transparent']}
                style={StyleSheet.absoluteFillObject}
              />
              {/* Colour bar */}
              <View style={[st.dayBar, { backgroundColor: d.goalMet ? GREEN : ACCENT + '50', height: `${Math.max(4, Math.min(100, (d.steps / goal) * 100))}%` as any }]} />
              <View style={{ flex: 1 }}>
                <Text style={st.dayDate}>{shortDate(d.date)} · {weekdayChar(d.date)}</Text>
                <Text style={[st.daySteps, { color: d.goalMet ? GREEN : 'rgba(255,255,255,0.7)' }]}>
                  {fmtK(d.steps)} steps
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={[st.dayPct, { color: d.goalMet ? GREEN : MUTED }]}>
                  {d.goalMet ? '✅' : `${Math.round((d.steps / goal) * 100)}%`}
                </Text>
                <Text style={st.dayDist}>{d.distanceKm.toFixed(1)} km · {fmtK(d.calories)} kcal</Text>
              </View>
            </TouchableOpacity>
          ))}

        </Animated.View>
      </ScrollView>

      {/* ── DAY DETAIL BOTTOM SHEET ──────────────────────────────────────────── */}
      {showSheet && selectedDay && (
        <Modal transparent animationType="none" onRequestClose={closeSheet}>
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }}
            onPress={closeSheet}
            activeOpacity={1}
          />
          <Animated.View
            style={[
              st.sheet,
              {
                transform: [{
                  translateY: sheetAnim.interpolate({ inputRange: [0,1], outputRange: [300, 0] }),
                }],
              },
            ]}
          >
            <LinearGradient colors={['#1A0A3A', '#0A0A0F']} style={StyleSheet.absoluteFillObject} />
            <View style={st.sheetHandle} />
            <Text style={st.sheetDate}>{shortDate(selectedDay.date)}</Text>
            <Text style={[st.sheetSteps, { color: selectedDay.goalMet ? GREEN : ACCENT }]}>
              {selectedDay.steps.toLocaleString()} steps
            </Text>
            <Text style={[st.sheetGoalTag, { color: selectedDay.goalMet ? GREEN : MUTED }]}>
              {selectedDay.goalMet ? '🏆 Goal Achieved' : `${Math.round((selectedDay.steps / goal) * 100)}% of goal`}
            </Text>
            <View style={st.sheetGrid}>
              {[
                { label: 'Distance',  val: `${selectedDay.distanceKm.toFixed(2)} km`,       color: TEAL   },
                { label: 'Calories',  val: `${selectedDay.calories} kcal`,                  color: ORANGE },
                { label: 'Goal',      val: `${selectedDay.goal.toLocaleString()} steps`,     color: GOLD   },
                { label: 'Status',    val: selectedDay.goalMet ? 'Goal Met ✅' : 'Partial',  color: selectedDay.goalMet ? GREEN : PINK },
              ].map((item, i) => (
                <View key={i} style={[st.sheetStat, { borderColor: item.color + '25' }]}>
                  <LinearGradient colors={[item.color + '10', 'transparent']} style={StyleSheet.absoluteFillObject} />
                  <Text style={[st.sheetStatVal, { color: item.color }]}>{item.val}</Text>
                  <Text style={st.sheetStatLabel}>{item.label}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity style={[st.sheetClose, { backgroundColor: ACCENT }]} onPress={closeSheet}>
              <Text style={st.sheetCloseTxt}>Close</Text>
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
    paddingBottom: 16,
    gap: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  backTxt:  { fontSize: 20, color: 'rgba(255,255,255,0.7)', fontWeight: '700' },
  title:    { fontSize: 26, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  rangeRow: { flexDirection: 'row', gap: 8 },
  rangePill:{
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: BORDER, backgroundColor: CARD,
  },
  rangeTxt: { fontSize: 12, fontWeight: '700', color: MUTED },

  chartCard: {
    borderRadius: 20, borderWidth: 1, borderColor: BORDER,
    backgroundColor: CARD, padding: 16, marginBottom: 16, overflow: 'hidden',
  },
  chartTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  chartTitle: { fontSize: 14, fontWeight: '800', color: '#fff' },
  goalBadge:  { borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  goalBadgeTxt: { fontSize: 10, fontWeight: '700' },

  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16,
  },
  statCard: {
    width: '47.5%', borderRadius: 16, borderWidth: 1,
    backgroundColor: CARD, padding: 16, alignItems: 'center', gap: 4, overflow: 'hidden',
  },
  statIcon:  { fontSize: 22 },
  statVal:   { fontSize: 20, fontWeight: '900' },
  statLabel: { fontSize: 10, color: MUTED, fontWeight: '600' },

  heatCard: {
    borderRadius: 20, borderWidth: 1, borderColor: BORDER,
    backgroundColor: CARD, padding: 16, marginBottom: 16, overflow: 'hidden',
  },
  heatTitle:  { fontSize: 14, fontWeight: '800', color: '#fff', marginBottom: 12 },
  heatHeader: { flexDirection: 'row', gap: 2, marginBottom: 4 },
  heatHeaderTxt: { fontSize: 9, color: MUTED, fontWeight: '600', textAlign: 'center', flex: 1 },
  heatRow:  { flexDirection: 'row', gap: 2, marginBottom: 2 },
  heatCell: { gap: 2, alignItems: 'center', justifyContent: 'center' },
  heatLegend: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12, alignSelf: 'flex-end',
  },
  heatLegendTxt:  { fontSize: 9, color: MUTED },
  heatLegendCell: { width: 12, height: 12 },

  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#fff' },
  dayRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER,
    padding: 14, marginBottom: 8, overflow: 'hidden',
  },
  dayBar: { width: 3, borderRadius: 2, position: 'absolute', left: 0, bottom: 0, top: 0 },
  dayDate:  { fontSize: 11, color: MUTED, fontWeight: '600' },
  daySteps: { fontSize: 16, fontWeight: '800', marginTop: 2 },
  dayPct:   { fontSize: 13, fontWeight: '800' },
  dayDist:  { fontSize: 10, color: MUTED, fontWeight: '500' },

  // ── Bottom Sheet ─────────────────────────────────────────────────────────
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: BG, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 40, overflow: 'hidden',
  },
  sheetHandle: { width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetDate:   { fontSize: 14, color: MUTED, fontWeight: '600', textAlign: 'center' },
  sheetSteps:  { fontSize: 40, fontWeight: '900', textAlign: 'center', letterSpacing: -1, marginTop: 4 },
  sheetGoalTag:{ fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: 6, marginBottom: 20 },
  sheetGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  sheetStat: {
    width: '47.5%', borderRadius: 14, borderWidth: 1,
    backgroundColor: CARD, padding: 14, alignItems: 'center', gap: 4, overflow: 'hidden',
  },
  sheetStatVal:  { fontSize: 16, fontWeight: '800' },
  sheetStatLabel:{ fontSize: 11, color: MUTED, fontWeight: '600' },
  sheetClose:    { borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  sheetCloseTxt: { color: '#fff', fontWeight: '900', fontSize: 15 },
});
