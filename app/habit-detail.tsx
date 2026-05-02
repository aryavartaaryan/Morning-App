import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { auth } from '@/lib/firebase';
import { loadRecentLogs, calcStreaks, calcBestStreak } from '@/lib/habitLogs';
import type { HabitLogEntry } from '@/lib/habitLogs';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Spacing, Radius, Font } from '@/constants/theme';

// ─── 30-day heatmap ───────────────────────────────────────────────────────────
function Heatmap({ logs, habitId, color }: { logs: HabitLogEntry[]; habitId: string; color: string }) {
  const todayObj = new Date();
  const todayLocalStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
  const days: { date: string; status: string | null }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(todayObj.getFullYear(), todayObj.getMonth(), todayObj.getDate() - i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const log = logs.find(l => l.habitId === habitId && l.date === dateStr);
    days.push({ date: dateStr, status: log?.status ?? null });
  }

  const cellColor = (status: string | null) => {
    if (status === 'done') return color;
    if (status === 'late') return color + '70';
    if (status === 'partial') return '#fb923c';
    if (status === 'missed') return '#ef444440';
    return Colors.card;
  };

  const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const [fdY, fdM, fdD] = days[0].date.split('-').map(Number);
  const firstDow = new Date(fdY, fdM - 1, fdD).getDay();

  return (
    <View style={hm.wrap}>
      {/* Week header */}
      <View style={hm.weekRow}>
        {DAY_LABELS.map((d, i) => (
          <Text key={i} style={hm.weekLabel}>{d}</Text>
        ))}
      </View>
      {/* Offset cells + day cells in a 7-col grid */}
      <View style={hm.grid}>
        {Array.from({ length: firstDow }).map((_, i) => (
          <View key={`pad-${i}`} style={hm.cell} />
        ))}
        {days.map((d, i) => {
          const dayNum = parseInt(d.date.split('-')[2], 10);
          const isToday = d.date === todayLocalStr;
          const textColor = d.status === 'done' || d.status === 'late'
            ? '#fff'
            : d.status === 'partial' ? '#fff'
            : d.status === 'missed' ? '#ef4444'
            : Colors.textMuted;
          return (
            <View key={i} style={[hm.cell, { backgroundColor: cellColor(d.status), borderColor: isToday ? color : d.status ? color + '30' : Colors.border, borderWidth: isToday ? 1.5 : 1 }]}>
              <Text style={[hm.dayNum, { color: textColor }]}>{dayNum}</Text>
            </View>
          );
        })}
      </View>
      <View style={hm.legendRow}>
        <View style={hm.legItem}><View style={[hm.legDot, { backgroundColor: color }]} /><Text style={hm.legTxt}>Done</Text></View>
        <View style={hm.legItem}><View style={[hm.legDot, { backgroundColor: '#fb923c' }]} /><Text style={hm.legTxt}>Partial</Text></View>
        <View style={hm.legItem}><View style={[hm.legDot, { backgroundColor: '#ef444440', borderWidth: 1, borderColor: Colors.border }]} /><Text style={hm.legTxt}>Missed</Text></View>
        <View style={hm.legItem}><View style={[hm.legDot, { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border }]} /><Text style={hm.legTxt}>—</Text></View>
      </View>
    </View>
  );
}

const CELL = 36;
const hm = StyleSheet.create({
  wrap: { marginBottom: Spacing.lg },
  weekRow: { flexDirection: 'row', gap: 4, marginBottom: 4 },
  weekLabel: { width: CELL, textAlign: 'center', fontSize: 10, fontWeight: '700', color: Colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  cell: { width: CELL, height: CELL, borderRadius: 7, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dayNum: { fontSize: 11, fontWeight: '700' },
  legendRow: { flexDirection: 'row', gap: 14, marginTop: 10, flexWrap: 'wrap' },
  legItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legDot: { width: 10, height: 10, borderRadius: 3 },
  legTxt: { fontSize: 10, color: Colors.textMuted, fontWeight: '600' },
});

// ─── Log entry row ────────────────────────────────────────────────────────────
function fmtLogDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  return dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function LogRow({ log, color }: { log: HabitLogEntry; color: string }) {
  const ts = (log.loggedAt as any)?.toDate?.() as Date | undefined;
  const timeStr = ts ? ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
  const statusColor = log.status === 'done' ? '#10b981' : log.status === 'late' ? '#f59e0b' : log.status === 'partial' ? '#fb923c' : '#ef4444';
  const statusIcon  = log.status === 'done' ? '✓' : log.status === 'late' ? '⏰' : log.status === 'partial' ? '🔶' : '✗';

  return (
    <View style={lr.row}>
      <View style={[lr.dot, { backgroundColor: statusColor }]} />
      <View style={{ flex: 1 }}>
        <View style={lr.top}>
          <Text style={lr.date}>{fmtLogDate(log.date)}</Text>
          <Text style={lr.time}>{timeStr}</Text>
          <View style={[lr.badge, { backgroundColor: statusColor + '22' }]}>
            <Text style={[lr.badgeTxt, { color: statusColor }]}>{statusIcon} {log.status}</Text>
          </View>
        </View>
        <View style={lr.detail}>
          {log.durationMinutes != null && <Text style={lr.chip}>⏱ {log.durationMinutes} min</Text>}
          {log.distanceKm != null && <Text style={lr.chip}>📍 {log.distanceKm.toFixed(2)} km</Text>}
          {log.steps != null && <Text style={lr.chip}>👣 {log.steps.toLocaleString()} steps</Text>}
          {log.value != null && <Text style={lr.chip}>{log.value} {log.unit ?? ''}</Text>}
          {log.mealSize != null && <Text style={lr.chip}>🍽️ {log.mealSize}</Text>}
          {log.feelRating != null && <Text style={lr.chip}>💬 {log.feelRating}</Text>}
          {log.sleepDurationHours != null && <Text style={lr.chip}>😴 {log.sleepDurationHours}h sleep</Text>}
          {log.workoutType != null && <Text style={lr.chip}>💪 {log.workoutType}</Text>}
          {log.cleanseCount != null && <Text style={lr.chip}>✅ {log.cleanseCount}/5 items</Text>}
        </View>
      </View>
    </View>
  );
}

const lr = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  date: { fontSize: Font.sizes.sm, fontWeight: '700', color: Colors.text },
  time: { fontSize: Font.sizes.xs, color: Colors.textMuted },
  badge: { borderRadius: Radius.full, paddingHorizontal: 6, paddingVertical: 2 },
  badgeTxt: { fontSize: 10, fontWeight: '800' },
  detail: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { fontSize: 10, color: Colors.textSub, fontWeight: '600', backgroundColor: Colors.card, borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
});

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function HabitDetail() {
  const params = useLocalSearchParams<{ habitId: string; habitName: string; color: string; emoji: string; ayurNote: string }>();
  const { habitId, habitName, color = '#10b981', emoji = '✨', ayurNote = '' } = params;

  const [logs, setLogs]       = useState<HabitLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const uid                   = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid || !habitId) return;
    loadRecentLogs(uid, 60)
      .then(all => setLogs(all.filter(l => l.habitId === habitId)))
      .finally(() => setLoading(false));
  }, [uid, habitId]);

  const streaks   = calcStreaks(logs);
  const current   = streaks[habitId] ?? 0;
  const best      = calcBestStreak(logs, habitId);
  const doneCount = logs.filter(l => l.status === 'done' || l.status === 'partial' || l.status === 'late').length;
  const rate      = logs.length > 0 ? Math.round((doneCount / logs.length) * 100) : 0;

  const avgDur = (() => {
    const withDur = logs.filter(l => l.durationMinutes != null);
    if (!withDur.length) return null;
    return Math.round(withDur.reduce((s, l) => s + (l.durationMinutes ?? 0), 0) / withDur.length);
  })();

  const feelCounts: Record<string, number> = {};
  logs.forEach(l => { if (l.feelRating) feelCounts[l.feelRating] = (feelCounts[l.feelRating] ?? 0) + 1; });
  const topFeel = Object.entries(feelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={color} size="large" />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ScreenHeader title={`${emoji} ${habitName}`} subtitle={ayurNote} showBack accent={color} />
      <ScrollView contentContainerStyle={sc.scroll} showsVerticalScrollIndicator={false}>

        {/* Streak cards */}
        <View style={sc.statRow}>
          <LinearGradient colors={[color + '22', color + '08']} style={[sc.statCard, { borderColor: color + '40' }]}>
            <Text style={sc.statEmoji}>🔥</Text>
            <Text style={[sc.statBig, { color }]}>{current}d</Text>
            <Text style={sc.statLbl}>Current Streak</Text>
          </LinearGradient>
          <LinearGradient colors={[color + '15', color + '05']} style={[sc.statCard, { borderColor: color + '30' }]}>
            <Text style={sc.statEmoji}>🏆</Text>
            <Text style={[sc.statBig, { color }]}>{best}d</Text>
            <Text style={sc.statLbl}>Best Streak</Text>
          </LinearGradient>
          <LinearGradient colors={[color + '15', color + '05']} style={[sc.statCard, { borderColor: color + '30' }]}>
            <Text style={sc.statEmoji}>📊</Text>
            <Text style={[sc.statBig, { color }]}>{rate}%</Text>
            <Text style={sc.statLbl}>Completion</Text>
          </LinearGradient>
        </View>

        {avgDur != null && (
          <View style={[sc.avgCard, { borderColor: color + '30', backgroundColor: color + '10' }]}>
            <Text style={[sc.avgTxt, { color }]}>⏱ Average duration: <Text style={sc.avgBold}>{avgDur} min</Text></Text>
          </View>
        )}
        {topFeel && (
          <View style={[sc.avgCard, { borderColor: color + '30', backgroundColor: color + '10' }]}>
            <Text style={[sc.avgTxt, { color }]}>💬 Most common feel: <Text style={sc.avgBold}>{topFeel}</Text></Text>
          </View>
        )}

        {/* 30-day heatmap */}
        <Text style={sc.sectionTitle}>Last 30 days</Text>
        <Heatmap logs={logs} habitId={habitId} color={color} />

        {/* Recent logs */}
        <Text style={sc.sectionTitle}>Recent logs</Text>
        {logs.length === 0 ? (
          <Text style={sc.emptyTxt}>No logs yet — start tracking!</Text>
        ) : (
          logs.slice(0, 20).map((l, i) => <LogRow key={l.id ?? i} log={l} color={color} />)
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const sc = StyleSheet.create({
  scroll: { padding: Spacing.md },
  statRow: { flexDirection: 'row', gap: 10, marginBottom: Spacing.md },
  statCard: { flex: 1, borderRadius: Radius.md, borderWidth: 1, alignItems: 'center', paddingVertical: 16, gap: 4 },
  statEmoji: { fontSize: 22 },
  statBig: { fontSize: Font.sizes.xl, fontWeight: '900' },
  statLbl: { fontSize: 10, color: Colors.textMuted, fontWeight: '600', textAlign: 'center' },
  avgCard: { borderRadius: Radius.md, borderWidth: 1, padding: Spacing.sm + 2, marginBottom: 8 },
  avgTxt: { fontSize: Font.sizes.sm, fontWeight: '600' },
  avgBold: { fontWeight: '900' },
  sectionTitle: { fontSize: Font.sizes.base, fontWeight: '800', color: Colors.text, marginBottom: Spacing.sm, marginTop: Spacing.md },
  emptyTxt: { fontSize: Font.sizes.sm, color: Colors.textMuted, textAlign: 'center', paddingVertical: 24 },
});
