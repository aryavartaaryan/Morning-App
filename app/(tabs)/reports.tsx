import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ImageBackground, Dimensions, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { store, KEYS } from '@/lib/storage';
import { AlarmSettings, DEFAULT_ALARM_SETTINGS } from '@/lib/notifications';
import { DEFAULT_MISSION_SETTINGS, MissionSettings } from '@/lib/missionAlarm';
import { Colors, Font } from '@/constants/theme';
import { useBgContext } from '@/lib/bgContext';
import type { AlarmEntry } from './alarms';

const { width } = Dimensions.get('window');

const GREEN = '#10b981';
const ACCENT = '#F5820A';
const pad   = (n: number) => String(n).padStart(2, '0');
const fmt12 = (h: number, m: number) => {
  const ap  = h < 12 ? 'AM' : 'PM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${pad(h12)}:${pad(m)} ${ap}`;
};

const WEEK_DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

type HabitStreakRecord = { streak: number; lastDate: string; history: string[] };

export default function ReportsTab() {
  const [settings, setSettings]         = useState<AlarmSettings>(DEFAULT_ALARM_SETTINGS);
  const [mission, setMission]           = useState<MissionSettings>(DEFAULT_MISSION_SETTINGS);
  const [entries, setEntries]           = useState<AlarmEntry[]>([]);
  const [habitStreaks, setHabitStreaks] = useState<Record<string, HabitStreakRecord>>({});
  const { bgUri, accentColor } = useBgContext();
  const today = new Date();

  useEffect(() => {
    (async () => {
      const s  = await store.getJSON<AlarmSettings>(KEYS.alarmSettings);
      const ms = await store.getJSON<MissionSettings>(KEYS.missionSettings);
      const e  = await store.getJSON<AlarmEntry[]>(KEYS.multiAlarms);
      const hs = await store.getJSON<Record<string, HabitStreakRecord>>(KEYS.habitAlarmStreaks);
      if (s)  setSettings(s);
      if (ms) setMission({ ...DEFAULT_MISSION_SETTINGS, ...ms });
      if (e)  setEntries(e);
      if (hs) setHabitStreaks(hs);
    })();
  }, []);

  const habitEntries = entries.filter(e => e.type === 'habit');

  const getWeekDays = (history: string[]): boolean[] => {
    const weekDays: boolean[] = Array(7).fill(false);
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek); d.setDate(startOfWeek.getDate() + i);
      const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      weekDays[i] = history.includes(ds);
    }
    return weekDays;
  };

  const activeCount    = (settings.wakeAlarm.enabled ? 1 : 0) + entries.filter(e => e.enabled).length;
  const totalAlarms    = 1 + entries.length;
  const habitAlarms    = entries.filter(e => e.type === 'habit').length;
  const quickAlarms    = entries.filter(e => e.type === 'quick').length;
  const streakPercent  = Math.min(100, (mission.streak / 30) * 100);

  const mockWeekActivity = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() - (6 - i));
    const dayIdx = d.getDay();
    const active = mission.streak > (6 - i);
    return { label: WEEK_DAYS[dayIdx], active, date: d.getDate() };
  });

  const STAT_CARDS = [
    { emoji: '🔥', value: String(mission.streak), label: 'Day Streak',      color: '#F5820A',  sub: mission.streak === 0 ? 'Start your streak' : mission.streak < 7 ? 'Keep going!' : mission.streak < 30 ? 'Building momentum' : 'Elite level' },
    { emoji: '⏰', value: `${activeCount}/${totalAlarms}`, label: 'Active Alarms', color: GREEN,      sub: `${habitAlarms} habit · ${quickAlarms} quick` },
    { emoji: '🏆', value: String(mission.missionsCompleted ?? 0), label: 'Missions Done',  color: '#a78bfa',  sub: 'All-time completions' },
    { emoji: '💯', value: mission.streak > 0 ? `${Math.round(streakPercent)}%` : '--',  label: '30-day Rate',   color: '#60a5fa', sub: 'Monthly consistency' },
  ];

  return (
    <View style={[S.screen, { backgroundColor: accentColor }]}>
      {/* ── Hero image zone ── */}
      <ImageBackground source={bgUri ? { uri: bgUri } : undefined} style={S.heroZone} imageStyle={{ opacity: 1 }}>
        <LinearGradient colors={['rgba(0,0,0,0.42)', 'rgba(0,0,0,0.14)', 'transparent']} style={StyleSheet.absoluteFillObject} />
        <LinearGradient colors={['transparent', 'transparent', accentColor]} locations={[0, 0.44, 1]} style={StyleSheet.absoluteFillObject} />
        <SafeAreaView edges={['top']} style={{ flex: 1, justifyContent: 'space-between' }}>
          {/* ── Nav bar zone ── */}
          <View style={S.headerTop}>
            <Text style={S.appName}>📊  Reports</Text>
            <Text style={{ fontSize: 11, color: GREEN + 'CC', fontWeight: '700', letterSpacing: 0.3 }}>
              {today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </Text>
          </View>
          {/* ── Title zone ── */}
          <View style={{ paddingHorizontal: 22, paddingBottom: 54 }}>
            <Text style={S.headline}>Your Wake Stats</Text>
            <Text style={S.sub}>Consistency is the only variable that matters</Text>
          </View>
        </SafeAreaView>
      </ImageBackground>

      <ScrollView
        style={S.sheet}
        contentContainerStyle={{ paddingBottom: 110, paddingTop: 8 }}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Stat Cards ── */}
        <View style={S.secRow}>
          <Text style={{ fontSize: 10 }}>📈</Text>
          <Text style={[S.secLabel, { color: ACCENT + '80' }]}>OVERVIEW</Text>
          <View style={[S.secLine, { backgroundColor: ACCENT + '25' }]} />
        </View>
        <View style={S.statsGrid}>
          {STAT_CARDS.map((card, i) => (
            <View key={i} style={[S.statCard, { borderColor: card.color + '28' }]}>
              <Text style={S.statEmoji}>{card.emoji}</Text>
              <Text style={[S.statValue, { color: card.color }]}>{card.value}</Text>
              <Text style={S.statLabel}>{card.label}</Text>
              <Text style={S.statSub}>{card.sub}</Text>
            </View>
          ))}
        </View>

        {/* ── Weekly Activity ── */}
        <View style={S.secRow}>
          <Text style={{ fontSize: 10 }}>📅</Text>
          <Text style={[S.secLabel, { color: GREEN + '80' }]}>THIS WEEK</Text>
          <View style={[S.secLine, { backgroundColor: GREEN + '25' }]} />
        </View>
        <View style={S.glassCard}>
          <View style={{ padding: 18 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end' }}>
              {mockWeekActivity.map((day, i) => (
                <View key={i} style={{ alignItems: 'center', gap: 4 }}>
                  <View style={[S.weekDot, { backgroundColor: day.active ? GREEN + '20' : '#FFFFFF0A', borderColor: day.active ? GREEN + '60' : '#FFFFFF12' }]}>
                    {day.active && <Text style={{ fontSize: 8 }}>✓</Text>}
                  </View>
                  <Text style={{ fontSize: 9, fontWeight: '700', color: day.active ? GREEN : '#FFFFFF30' }}>{day.label}</Text>
                  <Text style={{ fontSize: 8, color: '#FFFFFF20' }}>{day.date}</Text>
                </View>
              ))}
            </View>
            {mission.streak === 0 ? (
              <Text style={{ fontSize: 11, color: '#FFFFFF25', textAlign: 'center', marginTop: 14 }}>No data yet — complete your first morning mission to start tracking</Text>
            ) : (
              <View style={{ marginTop: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontSize: 11, color: GREEN, fontWeight: '800' }}>🔥 {mission.streak}-day streak</Text>
                  <Text style={{ fontSize: 10, color: '#FFFFFF35' }}>Goal: 30 days</Text>
                </View>
                <View style={S.progressBg}>
                  <View style={[S.progressFill, { width: `${streakPercent}%` as any, backgroundColor: GREEN }]} />
                </View>
              </View>
            )}
          </View>
        </View>

        {/* ── Alarm Inventory ── */}
        <View style={S.secRow}>
          <Text style={{ fontSize: 10 }}>⏰</Text>
          <Text style={[S.secLabel, { color: ACCENT + '80' }]}>ALARM INVENTORY</Text>
          <View style={[S.secLine, { backgroundColor: ACCENT + '25' }]} />
        </View>
        <View style={S.glassCard}>
          <View style={[S.alarmRow, { borderBottomWidth: 1, borderBottomColor: '#FFFFFF08' }]}>
            <View style={[S.alarmRowIcon, { backgroundColor: '#F5820A18' }]}>
              <Text style={{ fontSize: 14 }}>⏰</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={S.alarmRowTime}>{fmt12(settings.wakeAlarm.hour, settings.wakeAlarm.minute)}</Text>
              <Text style={S.alarmRowType}>Wake Alarm  ·  Every day</Text>
            </View>
            <View style={[S.statusBadge, { backgroundColor: settings.wakeAlarm.enabled ? '#10b98118' : '#FFFFFF08', borderColor: settings.wakeAlarm.enabled ? '#10b98140' : '#FFFFFF15' }]}>
              <Text style={{ fontSize: 9, fontWeight: '900', color: settings.wakeAlarm.enabled ? GREEN : '#FFFFFF30' }}>{settings.wakeAlarm.enabled ? 'ON' : 'OFF'}</Text>
            </View>
          </View>
          {entries.length === 0 && (
            <Text style={{ fontSize: 12, color: '#FFFFFF20', textAlign: 'center', paddingVertical: 18 }}>No habit or quick alarms yet</Text>
          )}
          {entries.map((entry, i) => (
            <View key={entry.id} style={[S.alarmRow, i < entries.length - 1 && { borderBottomWidth: 1, borderBottomColor: '#FFFFFF08' }]}>
              <View style={[S.alarmRowIcon, { backgroundColor: entry.type === 'habit' ? '#10b98118' : '#f9731618' }]}>
                <Text style={{ fontSize: 14 }}>{entry.type === 'habit' ? (entry.habitEmoji ?? '🌿') : '⚡'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={S.alarmRowTime}>{fmt12(entry.hour, entry.minute)}</Text>
                <Text style={S.alarmRowType}>{entry.label}  ·  {entry.type === 'habit' ? 'Habit' : 'Quick'}</Text>
              </View>
              <View style={[S.statusBadge, { backgroundColor: entry.enabled ? '#10b98118' : '#FFFFFF08', borderColor: entry.enabled ? '#10b98140' : '#FFFFFF15' }]}>
                <Text style={{ fontSize: 9, fontWeight: '900', color: entry.enabled ? GREEN : '#FFFFFF30' }}>{entry.enabled ? 'ON' : 'OFF'}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Habit Alarm Streaks ── */}
        {habitEntries.length > 0 && (
          <>
            <View style={S.secRow}>
              <Text style={{ fontSize: 10 }}>🌿</Text>
              <Text style={[S.secLabel, { color: GREEN + '80' }]}>HABIT ALARM STREAKS</Text>
              <View style={[S.secLine, { backgroundColor: GREEN + '25' }]} />
            </View>
            <View style={S.glassCard}>
              {habitEntries.map((entry, i) => {
                const rec      = habitStreaks[entry.habitKey ?? ''];
                const streak   = rec?.streak ?? 0;
                const weekDays = rec ? getWeekDays(rec.history ?? []) : Array(7).fill(false);
                return (
                  <View key={entry.id} style={[S.alarmRow, { flexDirection: 'column', alignItems: 'flex-start', gap: 10 }, i < habitEntries.length - 1 && { borderBottomWidth: 1, borderBottomColor: '#FFFFFF08' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%' }}>
                      <View style={[S.alarmRowIcon, { backgroundColor: '#10b98118' }]}>
                        <Text style={{ fontSize: 14 }}>{entry.habitEmoji ?? '🌿'}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={S.alarmRowTime}>{entry.label}</Text>
                        <Text style={S.alarmRowType}>{fmt12(entry.hour, entry.minute)}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 28, fontWeight: '100', color: streak > 0 ? GREEN : '#FFFFFF20', letterSpacing: -1 }}>{streak}</Text>
                        <Text style={{ fontSize: 8, fontWeight: '900', color: streak > 0 ? GREEN + '70' : '#FFFFFF20', letterSpacing: 1 }}>{streak === 1 ? 'DAY' : 'DAYS'}</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 5, paddingHorizontal: 4 }}>
                      {['S','M','T','W','T','F','S'].map((d, idx) => {
                        const done    = weekDays[idx];
                        const isToday = idx === new Date().getDay();
                        return (
                          <View key={idx} style={{ width: 32, height: 36, borderRadius: 8, borderWidth: 1.5, borderColor: done ? GREEN : isToday ? GREEN + '45' : '#FFFFFF12', backgroundColor: done ? GREEN + '20' : 'transparent', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                            <Text style={{ fontSize: 8, fontWeight: '900', color: done ? GREEN : isToday ? GREEN + '75' : '#FFFFFF25' }}>{d}</Text>
                            {done && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: GREEN }} />}
                          </View>
                        );
                      })}
                    </View>
                    {streak === 0 && (
                      <Text style={{ fontSize: 10, color: '#FFFFFF25', paddingHorizontal: 4 }}>Complete this habit alarm to start streak</Text>
                    )}
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* ── Motivation banner ── */}
        {mission.streak >= 7 && (
          <>
            <View style={S.secRow}>
              <Text style={{ fontSize: 10 }}>🏆</Text>
              <Text style={[S.secLabel, { color: '#a78bfa80' }]}>ACHIEVEMENT</Text>
              <View style={[S.secLine, { backgroundColor: '#a78bfa25' }]} />
            </View>
            <View style={[S.glassCard, { borderColor: '#F5820A28', marginBottom: 4 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18 }}>
                <Text style={{ fontSize: 32 }}>{mission.streak >= 30 ? '👑' : mission.streak >= 21 ? '🏆' : '🔥'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '900', color: '#fff' }}>
                    {mission.streak >= 30 ? 'Elite Waker' : mission.streak >= 21 ? '3-Week Warrior' : '1-Week Warrior'}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#FFFFFF50', marginTop: 2 }}>
                    {mission.streak} mornings in a row. Discipline is your identity now.
                  </Text>
                </View>
              </View>
            </View>
          </>
        )}

        {mission.streak === 0 && (
          <View style={S.emptyState}>
            <Text style={{ fontSize: 32 }}>📈</Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFFFFF40', marginTop: 8 }}>No data yet</Text>
            <Text style={{ fontSize: 11, color: '#FFFFFF20', marginTop: 4, textAlign: 'center' }}>Complete a morning mission to start building your streak report</Text>
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  screen:        { flex: 1 },
  heroZone:      { height: 280 },
  sheet:         { flex: 1, backgroundColor: 'transparent', marginTop: -26 },
  headerTop:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingTop: 10, paddingBottom: 6 },
  appName:     { fontSize: 15, fontWeight: '900', color: '#fff', letterSpacing: 0.5, fontFamily: 'Nunito_900Black' },
  headline:    { fontSize: 30, fontWeight: '100', color: '#fff', letterSpacing: -0.8 },
  sub:         { fontSize: 12, color: 'rgba(255,255,255,0.62)', marginTop: 5 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginBottom: 4, marginTop: 10 },
  secRow:      { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 20, marginBottom: 10, gap: 6 },
  secLabel:    { fontSize: 8, fontWeight: '900', letterSpacing: 1.8, fontFamily: 'Nunito_900Black' },
  secLine:     { flex: 1, height: 1 },
  glassCard:   { marginHorizontal: 16, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' },
  statsGrid:   { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: 16, gap: 8 },
  statCard:    { width: (width - 32 - 8) / 2, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderRadius: 18, padding: 14, gap: 2 },
  statEmoji:   { fontSize: 18 },
  statValue:   { fontSize: 26, fontWeight: '200', letterSpacing: -0.8, marginTop: 3 },
  statLabel:   { fontSize: 10, fontWeight: '800', color: '#fff', marginTop: 2, fontFamily: 'Nunito_800ExtraBold' },
  statSub:     { fontSize: 9, color: '#FFFFFF35', fontFamily: 'Nunito_600SemiBold' },
  weekDot:     { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  progressBg:  { height: 4, backgroundColor: '#FFFFFF0A', borderRadius: 2 },
  progressFill:{ height: 4, borderRadius: 2 },
  alarmRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  alarmRowIcon:{ width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  alarmRowTime:{ fontSize: 15, fontWeight: '700', color: '#fff', fontFamily: 'Nunito_700Bold' },
  alarmRowType:{ fontSize: 10, color: '#FFFFFF40', marginTop: 1, fontFamily: 'Nunito_600SemiBold' },
  statusBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  emptyState:  { marginHorizontal: 16, marginTop: 24, alignItems: 'center', paddingVertical: 32, borderRadius: 20, borderWidth: 1, borderColor: '#FFFFFF06', borderStyle: 'dashed' },
});
