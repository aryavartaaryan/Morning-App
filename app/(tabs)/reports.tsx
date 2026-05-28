import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ImageBackground, Dimensions, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { store, KEYS } from '@/lib/storage';
import { AlarmSettings, DEFAULT_ALARM_SETTINGS } from '@/lib/notifications';
import { DEFAULT_MISSION_SETTINGS, MissionSettings } from '@/lib/missionAlarm';
import { getStreak, type SunriseStreak } from '@/lib/sunriseStreak';
import { useBgContext } from '@/lib/bgContext';
import type { AlarmEntry } from './alarms';

const { width } = Dimensions.get('window');

const GREEN  = '#10b981';
const ORANGE = '#F5820A';
const CARD_BG     = 'rgba(6,15,40,0.62)';
const CARD_BORDER = 'rgba(255,255,255,0.18)';

const pad   = (n: number) => String(n).padStart(2, '0');
const fmt12 = (h: number, m: number) => {
  const ap  = h < 12 ? 'AM' : 'PM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${pad(h12)}:${pad(m)} ${ap}`;
};

const WEEK_DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

type HabitStreakRecord = { streak: number; lastDate: string; history: string[] };

const BADGES = [
  { id: 'first_light',   emoji: '🌅', name: 'First Light',        desc: 'First pre-sunrise wake',  sunThreshold: 1,  missionThreshold: 1  },
  { id: 'dawn_warrior',  emoji: '🔥', name: 'Dawn Warrior',       desc: '3 days before sunrise',   sunThreshold: 3,  missionThreshold: 3  },
  { id: 'brahma_7',      emoji: '⭐', name: 'Brahma Muhurta',     desc: '7 days before sunrise',   sunThreshold: 7,  missionThreshold: 7  },
  { id: 'solar_14',      emoji: '🏅', name: '14-Day Solar',       desc: '14 days before sunrise',  sunThreshold: 14, missionThreshold: 14 },
  { id: 'warrior_21',    emoji: '🏆', name: '21-Day Warrior',     desc: '21 consecutive mornings', sunThreshold: 21, missionThreshold: 21 },
  { id: 'solar_devotee', emoji: '👑', name: 'Solar Devotee',      desc: '30 days before sunrise',  sunThreshold: 30, missionThreshold: 30 },
];

export default function ReportsTab() {
  const router = useRouter();
  const [settings, setSettings]         = useState<AlarmSettings>(DEFAULT_ALARM_SETTINGS);
  const [mission, setMission]           = useState<MissionSettings>(DEFAULT_MISSION_SETTINGS);
  const [entries, setEntries]           = useState<AlarmEntry[]>([]);
  const [habitStreaks, setHabitStreaks] = useState<Record<string, HabitStreakRecord>>({});
  const [sunStreak, setSunStreak]       = useState<SunriseStreak>({ count: 0, lastDate: '', longestEver: 0 });
  const { bgUri } = useBgContext();
  const today = new Date();

  useEffect(() => {
    (async () => {
      const [s, ms, e, hs, ss] = await Promise.all([
        store.getJSON<AlarmSettings>(KEYS.alarmSettings),
        store.getJSON<MissionSettings>(KEYS.missionSettings),
        store.getJSON<AlarmEntry[]>(KEYS.multiAlarms),
        store.getJSON<Record<string, HabitStreakRecord>>(KEYS.habitAlarmStreaks),
        getStreak(),
      ]);
      if (s)  setSettings(s);
      if (ms) setMission({ ...DEFAULT_MISSION_SETTINGS, ...ms });
      if (e)  setEntries(e);
      if (hs) setHabitStreaks(hs);
      setSunStreak(ss);
    })();
  }, []);

  const habitEntries   = entries.filter(e => e.type === 'habit');
  const activeCount    = (settings.wakeAlarm.enabled ? 1 : 0) + entries.filter(e => e.enabled).length;
  const totalAlarms    = 1 + entries.length;
  const habitAlarms    = entries.filter(e => e.type === 'habit').length;
  const quickAlarms    = entries.filter(e => e.type === 'quick').length;
  const missionsTotal  = (mission as any).missionsCompleted ?? 0;
  const rate30         = missionsTotal >= 30 ? 100 : missionsTotal > 0 ? Math.round((missionsTotal / 30) * 100) : mission.streak > 0 ? Math.round(Math.min(100, (mission.streak / 30) * 100)) : 0;
  const streakPercent  = Math.min(100, (mission.streak / 30) * 100);

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

  const mockWeekActivity = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() - (6 - i));
    const dayIdx = d.getDay();
    const active = mission.streak > (6 - i);
    return { label: WEEK_DAYS[dayIdx], active, date: d.getDate() };
  });

  const earnedBadges = BADGES.filter(b =>
    sunStreak.longestEver >= b.sunThreshold || mission.streak >= b.missionThreshold
  );

  const STAT_CARDS = [
    {
      emoji: '🌅', value: String(sunStreak.count),
      label: 'Sunrise Streak', sub: sunStreak.count === 0 ? 'Wake before sunrise' : sunStreak.count < 7 ? 'Building the ritual' : 'Brahma Muhurta master',
    },
    {
      emoji: '🔥', value: String(mission.streak),
      label: 'Mission Streak', sub: mission.streak === 0 ? 'Start your streak' : mission.streak < 7 ? 'Keep going!' : 'Elite discipline',
    },
    {
      emoji: '⏰', value: `${activeCount}/${totalAlarms}`,
      label: 'Active Alarms', sub: `${habitAlarms} habit · ${quickAlarms} quick`,
    },
    {
      emoji: '📊', value: rate30 > 0 ? `${rate30}%` : '--',
      label: '30-Day Progress', sub: rate30 >= 100 ? 'Goal complete!' : `${missionsTotal} mornings logged`,
    },
  ];

  return (
    <ImageBackground source={bgUri ? { uri: bgUri } : undefined} style={S.screen} imageStyle={{ opacity: 1 }}>
      <LinearGradient
        colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.04)', 'transparent']}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      <LinearGradient
        colors={[GREEN + '1A', 'transparent']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.35 }}
        pointerEvents="none"
      />

      <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
        <View style={S.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={S.headerCap}>WAKE STATS  ·  YOUR CONSISTENCY</Text>
            <Text style={S.appName}>📊  Reports</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/settings' as any)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={S.settingsBtn}
          >
            <Ionicons name="settings-outline" size={18} color="rgba(255,255,255,0.50)" />
          </TouchableOpacity>
        </View>
        <View style={{ height: 1, backgroundColor: '#FFFFFF0C' }} />
      </SafeAreaView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 110, paddingTop: 8 }}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Badge Section ── */}
        {earnedBadges.length > 0 && (
          <>
            <View style={S.secRow}>
              <Text style={{ fontSize: 10 }}>🏅</Text>
              <Text style={[S.secLabel, { color: '#fbbf2480' }]}>BADGES EARNED</Text>
              <View style={[S.secLine, { backgroundColor: '#fbbf2420' }]} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
              {earnedBadges.map(b => (
                <View key={b.id} style={S.badgeCard}>
                  <Text style={{ fontSize: 24 }}>{b.emoji}</Text>
                  <Text style={S.badgeName}>{b.name}</Text>
                  <Text style={S.badgeDesc}>{b.desc}</Text>
                </View>
              ))}
              {BADGES.filter(b => !earnedBadges.includes(b)).slice(0, 2).map(b => (
                <View key={b.id} style={[S.badgeCard, { opacity: 0.30 }]}>
                  <Text style={{ fontSize: 24, grayscale: 1 } as any}>🔒</Text>
                  <Text style={S.badgeName}>{b.name}</Text>
                  <Text style={S.badgeDesc}>{b.desc}</Text>
                </View>
              ))}
            </ScrollView>
          </>
        )}

        {earnedBadges.length === 0 && (
          <>
            <View style={S.secRow}>
              <Text style={{ fontSize: 10 }}>🏅</Text>
              <Text style={[S.secLabel, { color: '#fbbf2480' }]}>BADGES</Text>
              <View style={[S.secLine, { backgroundColor: '#fbbf2420' }]} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
              {BADGES.slice(0, 4).map(b => (
                <View key={b.id} style={[S.badgeCard, { opacity: 0.28 }]}>
                  <Text style={{ fontSize: 24 }}>🔒</Text>
                  <Text style={S.badgeName}>{b.name}</Text>
                  <Text style={S.badgeDesc}>{b.desc}</Text>
                </View>
              ))}
            </ScrollView>
          </>
        )}

        {/* ── Stat Cards ── */}
        <View style={S.secRow}>
          <Text style={{ fontSize: 10 }}>📈</Text>
          <Text style={[S.secLabel, { color: ORANGE + '80' }]}>OVERVIEW</Text>
          <View style={[S.secLine, { backgroundColor: ORANGE + '22' }]} />
        </View>
        <View style={S.statsGrid}>
          {STAT_CARDS.map((card, i) => (
            <View key={i} style={S.statCard}>
              <Text style={S.statEmoji}>{card.emoji}</Text>
              <Text style={S.statValue}>{card.value}</Text>
              <Text style={S.statLabel}>{card.label}</Text>
              <Text style={S.statSub}>{card.sub}</Text>
            </View>
          ))}
        </View>

        {/* ── Weekly Activity ── */}
        <View style={S.secRow}>
          <Text style={{ fontSize: 10 }}>📅</Text>
          <Text style={[S.secLabel, { color: GREEN + '80' }]}>THIS WEEK</Text>
          <View style={[S.secLine, { backgroundColor: GREEN + '22' }]} />
        </View>
        <View style={S.glassCard}>
          <View style={{ padding: 18 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end' }}>
              {mockWeekActivity.map((day, i) => (
                <View key={i} style={{ alignItems: 'center', gap: 4 }}>
                  <View style={[S.weekDot, { backgroundColor: day.active ? GREEN + '20' : '#FFFFFF08', borderColor: day.active ? GREEN + '55' : '#FFFFFF10' }]}>
                    {day.active && <Text style={{ fontSize: 8, color: GREEN }}>✓</Text>}
                  </View>
                  <Text style={{ fontSize: 9, fontWeight: '700', color: day.active ? GREEN : '#FFFFFF28' }}>{day.label}</Text>
                  <Text style={{ fontSize: 8, color: '#FFFFFF18' }}>{day.date}</Text>
                </View>
              ))}
            </View>
            {mission.streak === 0 ? (
              <Text style={{ fontSize: 11, color: '#FFFFFF22', textAlign: 'center', marginTop: 14 }}>
                No data yet — complete your first morning mission to start tracking
              </Text>
            ) : (
              <View style={{ marginTop: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontSize: 11, color: GREEN, fontWeight: '800' }}>🔥 {mission.streak}-day streak</Text>
                  <Text style={{ fontSize: 10, color: '#FFFFFF30' }}>Goal: 30 days</Text>
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
          <Text style={[S.secLabel, { color: ORANGE + '80' }]}>ALARM INVENTORY</Text>
          <View style={[S.secLine, { backgroundColor: ORANGE + '22' }]} />
        </View>
        <View style={S.glassCard}>
          <View style={[S.alarmRow, { borderBottomWidth: 1, borderBottomColor: '#FFFFFF08' }]}>
            <View style={[S.alarmRowIcon, { backgroundColor: '#FFFFFF0A' }]}>
              <Text style={{ fontSize: 14 }}>⏰</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={S.alarmRowTime}>{fmt12(settings.wakeAlarm.hour, settings.wakeAlarm.minute)}</Text>
              <Text style={S.alarmRowType}>Wake Alarm  ·  Every day</Text>
            </View>
            <View style={[S.statusBadge, { backgroundColor: settings.wakeAlarm.enabled ? GREEN + '18' : '#FFFFFF08', borderColor: settings.wakeAlarm.enabled ? GREEN + '40' : '#FFFFFF12' }]}>
              <Text style={{ fontSize: 9, fontWeight: '900', color: settings.wakeAlarm.enabled ? GREEN : '#FFFFFF28' }}>{settings.wakeAlarm.enabled ? 'ON' : 'OFF'}</Text>
            </View>
          </View>
          {entries.length === 0 && (
            <Text style={{ fontSize: 12, color: '#FFFFFF18', textAlign: 'center', paddingVertical: 18 }}>No habit or quick alarms yet</Text>
          )}
          {entries.map((entry, i) => (
            <View key={entry.id} style={[S.alarmRow, i < entries.length - 1 && { borderBottomWidth: 1, borderBottomColor: '#FFFFFF08' }]}>
              <View style={[S.alarmRowIcon, { backgroundColor: '#FFFFFF0A' }]}>
                <Text style={{ fontSize: 14 }}>{entry.type === 'habit' ? (entry.habitEmoji ?? '🌿') : '⚡'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={S.alarmRowTime}>{fmt12(entry.hour, entry.minute)}</Text>
                <Text style={S.alarmRowType}>{entry.label}  ·  {entry.type === 'habit' ? 'Habit' : 'Quick'}</Text>
              </View>
              <View style={[S.statusBadge, { backgroundColor: entry.enabled ? GREEN + '18' : '#FFFFFF08', borderColor: entry.enabled ? GREEN + '40' : '#FFFFFF12' }]}>
                <Text style={{ fontSize: 9, fontWeight: '900', color: entry.enabled ? GREEN : '#FFFFFF28' }}>{entry.enabled ? 'ON' : 'OFF'}</Text>
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
              <View style={[S.secLine, { backgroundColor: GREEN + '22' }]} />
            </View>
            <View style={S.glassCard}>
              {habitEntries.map((entry, i) => {
                const rec      = habitStreaks[entry.habitKey ?? ''];
                const streak   = rec?.streak ?? 0;
                const weekDays = rec ? getWeekDays(rec.history ?? []) : Array(7).fill(false);
                return (
                  <View key={entry.id} style={[S.alarmRow, { flexDirection: 'column', alignItems: 'flex-start', gap: 10 }, i < habitEntries.length - 1 && { borderBottomWidth: 1, borderBottomColor: '#FFFFFF08' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%' }}>
                      <View style={[S.alarmRowIcon, { backgroundColor: '#FFFFFF0A' }]}>
                        <Text style={{ fontSize: 14 }}>{entry.habitEmoji ?? '🌿'}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={S.alarmRowTime}>{entry.label}</Text>
                        <Text style={S.alarmRowType}>{fmt12(entry.hour, entry.minute)}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 28, fontWeight: '100', color: streak > 0 ? GREEN : '#FFFFFF18', letterSpacing: -1 }}>{streak}</Text>
                        <Text style={{ fontSize: 8, fontWeight: '900', color: streak > 0 ? GREEN + '70' : '#FFFFFF18', letterSpacing: 1 }}>{streak === 1 ? 'DAY' : 'DAYS'}</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 5, paddingHorizontal: 4 }}>
                      {['S','M','T','W','T','F','S'].map((d, idx) => {
                        const done    = weekDays[idx];
                        const isToday = idx === new Date().getDay();
                        return (
                          <View key={idx} style={{ width: 32, height: 36, borderRadius: 8, borderWidth: 1.5, borderColor: done ? GREEN : isToday ? GREEN + '45' : '#FFFFFF10', backgroundColor: done ? GREEN + '1A' : 'transparent', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                            <Text style={{ fontSize: 8, fontWeight: '900', color: done ? GREEN : isToday ? GREEN + '75' : '#FFFFFF22' }}>{d}</Text>
                            {done && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: GREEN }} />}
                          </View>
                        );
                      })}
                    </View>
                    {streak === 0 && (
                      <Text style={{ fontSize: 10, color: '#FFFFFF22', paddingHorizontal: 4 }}>Complete this habit alarm to start streak</Text>
                    )}
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* ── Next badge to earn ── */}
        {(() => {
          const next = BADGES.find(b => sunStreak.longestEver < b.sunThreshold && mission.streak < b.missionThreshold);
          if (!next) return null;
          const progressSun     = Math.min(100, (sunStreak.longestEver / next.sunThreshold) * 100);
          const progressMission = Math.min(100, (mission.streak / next.missionThreshold) * 100);
          const progress        = Math.max(progressSun, progressMission);
          return (
            <>
              <View style={S.secRow}>
                <Text style={{ fontSize: 10 }}>🎯</Text>
                <Text style={[S.secLabel, { color: '#fbbf2480' }]}>NEXT BADGE</Text>
                <View style={[S.secLine, { backgroundColor: '#fbbf2420' }]} />
              </View>
              <View style={[S.glassCard, { marginBottom: 4 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }}>
                  <Text style={{ fontSize: 28, opacity: 0.45 }}>{next.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#FFFFFF' }}>{next.name}</Text>
                    <Text style={{ fontSize: 10, color: '#FFFFFF45', marginTop: 2 }}>{next.desc}</Text>
                    <View style={{ marginTop: 8, height: 3, backgroundColor: '#FFFFFF0A', borderRadius: 2 }}>
                      <View style={{ height: 3, borderRadius: 2, backgroundColor: '#fbbf24', width: `${progress}%` as any }} />
                    </View>
                    <Text style={{ fontSize: 9, color: '#fbbf2470', marginTop: 4 }}>{Math.round(progress)}% there</Text>
                  </View>
                </View>
              </View>
            </>
          );
        })()}

        {mission.streak === 0 && sunStreak.count === 0 && (
          <View style={S.emptyState}>
            <Text style={{ fontSize: 32 }}>📈</Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFFFFF38', marginTop: 8 }}>No data yet</Text>
            <Text style={{ fontSize: 11, color: '#FFFFFF20', marginTop: 4, textAlign: 'center' }}>
              Complete a morning mission to start building your streak report
            </Text>
          </View>
        )}

      </ScrollView>
    </ImageBackground>
  );
}

const S = StyleSheet.create({
  screen:        { flex: 1 },
  headerTop:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 12 },
  headerCap:     { fontSize: 9, fontWeight: '900', color: '#FFFFFF45', letterSpacing: 1.8, marginBottom: 4 },
  appName:       { fontSize: 22, fontWeight: '200', color: '#fff', letterSpacing: -0.5 },
  settingsBtn:   { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' },
  secRow:        { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 20, marginBottom: 10, gap: 6 },
  secLabel:      { fontSize: 8, fontWeight: '900', letterSpacing: 1.8, fontFamily: 'Nunito_900Black' },
  secLine:       { flex: 1, height: 1 },
  glassCard:     { marginHorizontal: 16, borderRadius: 18, borderWidth: 1, borderColor: CARD_BORDER, backgroundColor: CARD_BG, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.38, shadowRadius: 20, elevation: 12 },
  statsGrid:     { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: 16, gap: 8 },
  statCard:      { width: (width - 32 - 8) / 2, backgroundColor: CARD_BG, borderWidth: 1, borderColor: CARD_BORDER, borderRadius: 18, padding: 14, gap: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.38, shadowRadius: 20, elevation: 12 },
  statEmoji:     { fontSize: 18 },
  statValue:     { fontSize: 26, fontWeight: '200', color: '#FFFFFF', letterSpacing: -0.8, marginTop: 3 },
  statLabel:     { fontSize: 10, fontWeight: '800', color: '#FFFFFF', marginTop: 2, fontFamily: 'Nunito_800ExtraBold' },
  statSub:       { fontSize: 9, color: '#FFFFFF35', fontFamily: 'Nunito_600SemiBold' },
  badgeCard:     { alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16, borderWidth: 1, borderColor: CARD_BORDER, backgroundColor: CARD_BG, minWidth: 88, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.30, shadowRadius: 12, elevation: 8 },
  badgeName:     { fontSize: 10, fontWeight: '800', color: '#FFFFFF', textAlign: 'center', fontFamily: 'Nunito_800ExtraBold' },
  badgeDesc:     { fontSize: 8, color: '#FFFFFF40', textAlign: 'center', maxWidth: 80 },
  weekDot:       { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  progressBg:    { height: 4, backgroundColor: '#FFFFFF0A', borderRadius: 2 },
  progressFill:  { height: 4, borderRadius: 2 },
  alarmRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  alarmRowIcon:  { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  alarmRowTime:  { fontSize: 15, fontWeight: '700', color: '#fff', fontFamily: 'Nunito_700Bold' },
  alarmRowType:  { fontSize: 10, color: '#FFFFFF38', marginTop: 1, fontFamily: 'Nunito_600SemiBold' },
  statusBadge:   { borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  emptyState:    { marginHorizontal: 16, marginTop: 24, alignItems: 'center', paddingVertical: 32, borderRadius: 20, borderWidth: 1, borderColor: '#FFFFFF06', borderStyle: 'dashed' },
});
