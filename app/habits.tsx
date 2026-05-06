import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Spacing, Radius, Font } from '@/constants/theme';
import {
  loadRecentLogs, calcStreaks, calcMonthlyCount, calcWeeklyCount,
  calcDinacharyaScore, getScoreInfo, todayStr,
} from '@/lib/habitLogs';
import type { InteractionType, HabitLogEntry } from '@/lib/habitLogs';
import { store, KEYS } from '@/lib/storage';
import { getPrakritiPlan, PledgeData, shiftActivitiesToWake, applySolarToActivities, WAKE_MISSIONS } from '@/lib/prakritiPlan';
import { getSolarTimes, type SolarTimes } from '@/lib/solar';

// ─── Habit definitions ────────────────────────────────────────────────────────

interface HabitDef {
  id: string; emoji: string; name: string; kala: string;
  color: string; ayurNote: string;
  ws: number; we: number;
  type: InteractionType;
}

type SlotGroup = { key: string; label: string; kalaLabel: string; color: string; habits: HabitDef[]; };

const DOSHA_COLORS: Record<string, string> = {
  Vata: '#a78bfa', Pitta: '#f97316', Kapha: '#10b981', Sama: '#60a5fa',
};

const ACTIVITY_TO_TYPE: Record<string, InteractionType> = {
  wake_early: 'wake_early', warm_water: 'warm_water', morning_cleanse: 'cleanse',
  morning_prayer: 'yesno', morning_stretch: 'yesno',
  meditation: 'meditation',
  morning_walk: 'walk', evening_walk: 'walk', sunlight: 'yesno',
  breakfast: 'meal', lunch: 'meal', dinner: 'meal',
  walk: 'yesno', herbal_tea: 'yesno', screen_free: 'yesno', journaling: 'yesno', sleep: 'yesno',
};

const SLOT_GROUPS = [
  { key: 'brahma', label: 'Brahma Muhurta', kalaLabel: '🌙 Before 6:00 AM', color: '#a78bfa', minMin: 0, maxMin: 360 },
  { key: 'morning', label: 'Morning Sadhana', kalaLabel: '🌅 6:00 AM – 12:00 PM', color: '#fbbf24', minMin: 360, maxMin: 720 },
  { key: 'midday', label: 'Midday Balance', kalaLabel: '🌞 Solar Noon Window', color: '#fb923c', minMin: 720, maxMin: 1020 },
  { key: 'evening', label: 'Evening Restore', kalaLabel: '🌆 Around Sunset', color: '#f472b6', minMin: 1020, maxMin: 1260 },
  { key: 'night', label: 'Night Wind-down', kalaLabel: '🌃 After Sunset', color: '#8b5cf6', minMin: 1260, maxMin: 9999 },
];

function fmtSolarH(h: number): string {
  const hh = Math.floor(h) % 24; const mm = Math.round((h - Math.floor(h)) * 60);
  const p = hh >= 12 ? 'PM' : 'AM'; const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  return mm === 0 ? `${h12} ${p}` : `${h12}:${String(mm).padStart(2,'0')} ${p}`;
}

function getSlotGroups(solar?: SolarTimes | null) {
  if (solar) {
    const { sunrise, solarNoon, sunset } = solar;
    return [
      { key: 'brahma',  label: 'Brahma Muhurta',  kalaLabel: `🌙 Before ${fmtSolarH(sunrise)}`,                              color: '#a78bfa', minMin: 0,              maxMin: Math.round(sunrise * 60) },
      { key: 'morning', label: 'Morning Sadhana',  kalaLabel: `🌅 ${fmtSolarH(sunrise)} – ${fmtSolarH(solarNoon - 2)}`,         color: '#fbbf24', minMin: Math.round(sunrise * 60),       maxMin: Math.round((solarNoon - 2) * 60) },
      { key: 'midday',  label: 'Midday Balance',   kalaLabel: `🌞 Solar Noon · ${fmtSolarH(solarNoon - 2)} – ${fmtSolarH(solarNoon + 2)}`, color: '#fb923c', minMin: Math.round((solarNoon - 2) * 60), maxMin: Math.round((solarNoon + 2) * 60) },
      { key: 'evening', label: 'Evening Restore',  kalaLabel: `🌆 ${fmtSolarH(solarNoon + 2)} – ${fmtSolarH(sunset + 2.5)}`,  color: '#f472b6', minMin: Math.round((solarNoon + 2) * 60), maxMin: Math.round((sunset + 2.5) * 60) },
      { key: 'night',   label: 'Night Wind-down',  kalaLabel: `🌃 After ${fmtSolarH(sunset + 2.5)}`,                          color: '#8b5cf6', minMin: Math.round((sunset + 2.5) * 60), maxMin: 9999 },
    ];
  }
  return SLOT_GROUPS;
}

function buildSlotsFromPlan(pledgeData: PledgeData, solar?: SolarTimes | null): SlotGroup[] {
  const plan = getPrakritiPlan(pledgeData.prakriti);
  const primaryKey = pledgeData.prakriti.split('-')[0];
  const accentColor = DOSHA_COLORS[primaryKey] ?? '#a78bfa';
  const defaultWakeMin = plan.wakeHour * 60 + plan.wakeMin;
  const chosenWakeMin = pledgeData.wakeHour * 60 + pledgeData.wakeMin;
  const shifted = shiftActivitiesToWake(plan.activities, defaultWakeMin, chosenWakeMin);
  const activities = solar ? applySolarToActivities(shifted, solar) : shifted;

  // Helper to format minutes as "H:MM AM/PM"
  const fmtMin = (mins: number) => {
    const hh = Math.floor(((mins % 1440) + 1440) % 1440 / 60) % 24;
    const mm = mins % 60;
    const p = hh >= 12 ? 'PM' : 'AM';
    const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
    return `${h12}:${String(mm).padStart(2, '0')} ${p}`;
  };

  return getSlotGroups(solar).map(g => ({
    key: g.key,
    label: g.label,
    kalaLabel: g.kalaLabel,
    color: g.color,
    habits: activities
      .filter(a => a.startMin >= g.minMin && a.startMin < g.maxMin)
      .map(a => ({
        id: a.habitId,
        emoji: a.emoji,
        name: a.name,
        // Show full window: "8:00–9:00 AM · 20 min" or just "8:00–9:00 AM"
        kala: `${fmtMin(a.startMin)}\u2013${fmtMin(a.endMin)}${a.duration !== '\u2014' ? ` \u00b7 ${a.duration}` : ''}`,
        color: accentColor,
        ayurNote: a.note,
        ws: a.startMin,
        we: a.endMin,
        type: ACTIVITY_TO_TYPE[a.habitId] ?? 'yesno',
      } as HabitDef)),
  })).filter(g => g.habits.length > 0);
}

type CardStatus = 'perfect' | 'late' | 'partial' | 'missed' | 'pending' | 'locked';

// Per-habit action button config (label, color, done label) — drives all button states
const HABIT_BTN: Record<string, { icon: string; label: string; color: string; doneLabel: string }> = {
  // SIMPLE
  wake_early: { icon: '✓', label: 'LOGGED', color: '#F5A623', doneLabel: 'LOGGED' },
  morning_prayer: { icon: '🙏', label: 'PRAYED', color: '#fbbf24', doneLabel: 'PRAYED' },
  morning_stretch: { icon: '🤸', label: 'STRETCHED', color: '#34d399', doneLabel: 'DONE' },
  warm_water: { icon: '✓', label: 'DONE', color: '#007AFF', doneLabel: 'DONE' },
  sunlight: { icon: '✓', label: 'DONE', color: '#fbbf24', doneLabel: 'DONE' },
  walk: { icon: '✓', label: '100 STEPS', color: '#34d399', doneLabel: 'DONE' },
  herbal_tea: { icon: '✓', label: 'DONE', color: '#5AC8FA', doneLabel: 'DONE' },
  sleep: { icon: '✓', label: 'DONE', color: '#9B59B6', doneLabel: 'DONE' },
  // MEAL
  breakfast: { icon: '🌅', label: 'LOG MEAL', color: '#F5A623', doneLabel: 'LOGGED' },
  lunch: { icon: '☀️', label: 'LOG MEAL', color: '#F5A623', doneLabel: 'LOGGED' },
  dinner: { icon: '🌙', label: 'LOG MEAL', color: '#F5A623', doneLabel: 'LOGGED' },
  // TIMER
  meditation: { icon: '▶', label: 'BEGIN', color: '#9B59B6', doneLabel: 'DONE' },
  journaling: { icon: '▶', label: 'BEGIN', color: '#5AC8FA', doneLabel: 'DONE' },
  screen_free: { icon: '▶', label: 'START', color: '#8E8E93', doneLabel: 'DONE' },
  // GPS WALK
  morning_walk: { icon: '📍', label: 'MORNING WALK', color: '#4CD964', doneLabel: 'WALKED' },
  evening_walk: { icon: '📍', label: 'EVENING WALK', color: '#4CD964', doneLabel: 'WALKED' },
  // CHECKLIST
  morning_cleanse: { icon: '☑', label: 'CHECK IN', color: '#5AC8FA', doneLabel: 'DONE' },
};

// Fallback for any habit ID not in HABIT_BTN
const habitBtn = (h: HabitDef) =>
  HABIT_BTN[h.id] ?? { icon: '✓', label: 'DONE', color: h.color, doneLabel: 'DONE' };

const SLOT_EMOJI: Record<string, string> = {
  brahma: '🌙', early_morning: '🌅', morning: '☀️',
  midday: '🌞', evening: '🌆', night: '🌃',
};

const AYU_C: Record<string, string> = { good: '#4CD964', caution: '#FF9500', avoid: '#FF3B30' };

// ─── Helper ───────────────────────────────────────────────────────────────────
const fmtTime = (mins: number) => {
  const hh = Math.floor(mins / 60) % 24;
  const mm = mins % 60;
  const p = hh >= 12 ? 'PM' : 'AM';
  const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  return `${h12}:${String(mm).padStart(2, '0')} ${p}`;
};

const FEEL_LABEL: Record<string, string> = {
  deep: '🔥 Deep', good: '😊 Good', distracted: '😶 OK',
  energised: '⚡ Energised', tired: '😴 Tired', calm: '🌿 Calm',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getLogSummary = (h: HabitDef, e: Record<string, any>): string | null => {
  switch (h.type) {
    case 'meditation': {
      if (!e.durationMinutes) return null;
      const m = Math.round(Number(e.durationMinutes));
      const dStr = m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`;
      const p = [dStr];
      if (e.feelRating && FEEL_LABEL[e.feelRating]) p.push(FEEL_LABEL[e.feelRating]);
      return p.join(' · ');
    }
    case 'walk': {
      const p: string[] = [];
      if (e.distanceKm) p.push(`${Number(e.distanceKm).toFixed(1)} km`);
      if (e.steps) p.push(`${Number(e.steps).toLocaleString()} steps`);
      if (e.feelRating && FEEL_LABEL[e.feelRating]) p.push(FEEL_LABEL[e.feelRating]);
      return p.length ? p.join(' · ') : null;
    }
    case 'meal': {
      const p: string[] = [];
      if (e.mealDescription) p.push(String(e.mealDescription).length > 22 ? String(e.mealDescription).slice(0, 22) + '…' : String(e.mealDescription));
      if (e.mealSize) p.push(String(e.mealSize));
      if (e.postMealFeeling) p.push(String(e.postMealFeeling));
      return p.length ? p.join(' · ') : null;
    }
    case 'cleanse':
      return e.cleanseCount != null ? `${e.cleanseCount}/5 done` : null;
    case 'wake_early': {
      if (!e.wakeTime) return null;
      const p = [`Woke ${e.wakeTime}`];
      if (e.sleepDurationHours) p.push(`${Number(e.sleepDurationHours).toFixed(1)}h sleep`);
      return p.join(' · ');
    }
    case 'warm_water':
      return e.value ? `${e.value} glass${e.value > 1 ? 'es' : ''} warm` : null;
    default:
      return null;
  }
};

// ─── Main screen — DATA VIEWER ONLY (no logging) ─────────────────────────────
export default function HabitsScreen() {
  const router = useRouter();
  const uid = auth.currentUser?.uid;
  const today = todayStr();
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const hour = now.getHours();

  const [logMap, setLogMap] = useState<Map<string, Record<string, any>>>(new Map());
  const [streakMap, setStreakMap] = useState<Record<string, number>>({});
  const [recentLogs, setRecentLogs] = useState<HabitLogEntry[]>([]);
  const [pledgeData, setPledgeData] = useState<PledgeData | null>(null);
  const [solarTimes, setSolarTimes] = useState<SolarTimes | null>(null);

  const activeSlot = (() => {
    const h = hour + now.getMinutes() / 60;
    if (solarTimes) {
      const { sunrise, solarNoon, sunset } = solarTimes;
      if (h >= sunrise - 1.6 && h < sunrise)      return 'brahma';
      if (h >= sunrise      && h < solarNoon - 2)  return 'morning';
      if (h >= solarNoon - 2 && h < solarNoon + 2) return 'midday';
      if (h >= solarNoon + 2 && h < sunset + 2.5)  return 'evening';
      return 'night';
    }
    return hour < 6 ? 'brahma' : hour < 12 ? 'morning' : hour < 17 ? 'midday' : hour < 20 ? 'evening' : 'night';
  })();

  // Load pledge to personalise habits
  useEffect(() => {
    store.getJSON<PledgeData>(KEYS.pledge).then(p => { if (p) setPledgeData(p); }).catch(() => { });
  }, []);

  // Load solar times from stored location profile (set during onboarding)
  useEffect(() => {
    store.getJSON<{ lat: number; lon: number }>(KEYS.location)
      .then(loc => { if (loc?.lat && loc?.lon) setSolarTimes(getSolarTimes(loc.lat, loc.lon)); })
      .catch(() => { });
  }, []);

  // Real-time today's logs
  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, 'habit_logs'), where('userId', '==', uid), where('date', '==', today));
    return onSnapshot(q, snap => {
      const map = new Map<string, Record<string, any>>();
      snap.docs.forEach(d => {
        const data = d.data() as Record<string, any>;
        const ts = data.loggedAt?.toDate?.() as Date | undefined;
        map.set(data.habitId, { ...data, mins: ts ? ts.getHours() * 60 + ts.getMinutes() : null });
      });
      setLogMap(map);
    });
  }, [uid, today]);

  // Load streaks + recent logs
  useEffect(() => {
    if (!uid) return;
    loadRecentLogs(uid, 60).then(logs => {
      setRecentLogs(logs);
      setStreakMap(calcStreaks(logs));
    }).catch(() => { });
  }, [uid]);

  const getStatus = (h: HabitDef): CardStatus => {
    if (logMap.has(h.id)) {
      const e = logMap.get(h.id)!;
      if (e.status === 'partial') return 'partial';
      if ((e.status as string) === 'skipped') return 'missed';
      // Late = logged after the window end (endMin)
      return (e.mins === null || e.mins <= h.we) ? 'perfect' : 'late';
    }
    // Missed = current time is past window end + 30min grace
    if (h.we !== -1 && nowMins > h.we + 30) return 'missed';
    return 'pending';
  };

  const openDetail = (h: HabitDef) => {
    router.push({
      pathname: '/habit-detail' as any,
      params: { habitId: h.id, habitName: h.name, color: h.color, emoji: h.emoji, ayurNote: h.ayurNote },
    });
  };

  // Score for header — use dynamic slot count if pledge loaded
  const activeSlots: SlotGroup[] = pledgeData ? buildSlotsFromPlan(pledgeData, solarTimes) : [];
  const DYNAMIC_TOTAL = activeSlots.flatMap(s => s.habits).length || 1;
  const loggedCount = logMap.size;
  const score = calcDinacharyaScore(loggedCount, DYNAMIC_TOTAL);
  const scoreInfo = getScoreInfo(score);
  const missionInfo = pledgeData?.missionId ? WAKE_MISSIONS.find(m => m.id === pledgeData.missionId) : null;
  const primaryKey = pledgeData?.prakriti.split('-')[0] ?? '';
  const doshaColor = DOSHA_COLORS[primaryKey] ?? scoreInfo.color;
  const overallStreak = Object.values(streakMap).length > 0 ? Math.max(...Object.values(streakMap)) : 0;

  const progressAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progressAnim, { toValue: score, duration: 700, useNativeDriver: false }).start();
  }, [score]);

  const doshaEmoji = primaryKey === 'Vata' ? '🌬️' : primaryKey === 'Pitta' ? '🔥' : '🌿';

  return (
    <View style={s.page}>
      <ScrollView showsVerticalScrollIndicator={false} stickyHeaderIndices={[0]}>

        {/* ── Hero Banner (sticky) — mirrors profile page ── */}
        <View style={{ backgroundColor: Colors.bg }}>
        <LinearGradient colors={[doshaColor + '30', doshaColor + '08', Colors.bg]} style={s.heroBanner}>
          <ScreenHeader title="My Dinacharya" showBack accent={doshaColor} />

          {/* Identity row */}
          <View style={s.identityRow}>
            <View style={[s.identityBadge, { borderColor: doshaColor + '55', backgroundColor: doshaColor + '14' }]}>
              <Text style={{ fontSize: 18 }}>{doshaEmoji}</Text>
              <View>
                <Text style={[s.identityName, { color: doshaColor }]}>{pledgeData?.prakriti ?? 'Prakriti'} Prakriti</Text>
                <Text style={s.identityDate}>{now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
              </View>
              {missionInfo && (
                <View style={[s.missionChip, { backgroundColor: missionInfo.color + '18', borderColor: missionInfo.color + '40' }]}>
                  <Text style={{ fontSize: 12 }}>{missionInfo.emoji}</Text>
                  <Text style={[s.missionTime, { color: missionInfo.color }]}>{missionInfo.time}</Text>
                </View>
              )}
            </View>
          </View>

          {/* 4-column stats */}
          <View style={s.statsRow}>
            {[
              { val: `🔥 ${overallStreak}`, lbl: 'Day Streak', clr: '#f59e0b' },
              { val: `${loggedCount}/${DYNAMIC_TOTAL}`, lbl: 'Done Today', clr: doshaColor },
              { val: `${score}%`, lbl: 'Score', clr: scoreInfo.color },
              { val: String(Object.values(streakMap).filter(v => v >= 3).length), lbl: 'Habits ≥3d', clr: '#8b5cf6' },
            ].map(stat => (
              <View key={stat.lbl} style={[s.statCard, { borderColor: stat.clr + '30' }]}>
                <Text style={[s.statVal, { color: stat.clr }]}>{stat.val}</Text>
                <Text style={s.statLbl}>{stat.lbl}</Text>
              </View>
            ))}
          </View>

          {/* Progress bar */}
          <View style={s.progTrack}>
            <Animated.View style={[s.progFill, {
              width: progressAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
              backgroundColor: scoreInfo.color,
            }]} />
          </View>
          <View style={s.progLblRow}>
            <Text style={[s.progLbl, { color: scoreInfo.color }]}>{scoreInfo.icon} {scoreInfo.label}</Text>
            <Text style={[s.progPct, { color: scoreInfo.color }]}>{score}%</Text>
          </View>
        </LinearGradient>
        </View>

        {/* ── Body ── */}
        <View style={s.body}>
          {!pledgeData && (
            <View style={s.emptyState}>
              <Text style={{ fontSize: 40 }}>🌿</Text>
              <Text style={s.emptyTitle}>Complete Your Prakriti Assessment</Text>
              <Text style={s.emptyBody}>Your personalized Dinacharya will appear here once you complete the Prakriti analysis in onboarding.</Text>
            </View>
          )}

          {activeSlots.map(slot => {
            const slotDone = slot.habits.filter(h => logMap.has(h.id)).length;
            const isActive = slot.key === activeSlot;
            const allComplete = slotDone === slot.habits.length && slot.habits.length > 0;

            return (
              <View key={slot.key} style={s.section}>
                {/* Section title row — profile style */}
                <View style={s.sectionTitleRow}>
                  <View style={[s.sectionDot, { backgroundColor: isActive ? slot.color : allComplete ? '#4CD964' : 'rgba(255,255,255,0.15)' }]} />
                  <Text style={[s.sectionTitle, { color: isActive ? slot.color : allComplete ? '#4CD964' : Colors.textMuted }]}>
                    {SLOT_EMOJI[slot.key]}  {slot.label.toUpperCase()}
                  </Text>
                  <Text style={[s.sectionKala, { color: isActive ? slot.color + 'aa' : Colors.textDim }]}>
                    {slot.kalaLabel.replace(/^.\s/, '')}
                  </Text>
                  <View style={s.slotRight}>
                    {isActive && <View style={[s.nowPill, { backgroundColor: slot.color }]}><Text style={s.nowPillTxt}>NOW</Text></View>}
                    {allComplete && !isActive && <View style={[s.nowPill, { backgroundColor: '#4CD96422', borderWidth: 1, borderColor: '#4CD96445' }]}><Text style={[s.nowPillTxt, { color: '#4CD964' }]}>✓</Text></View>}
                    <Text style={[s.slotCount, { color: isActive ? slot.color : slotDone > 0 ? '#4CD964' : Colors.textDim }]}>{slotDone}/{slot.habits.length}</Text>
                  </View>
                </View>

                {/* Thin progress under title */}
                <View style={s.slotProgTrack}>
                  <View style={[s.slotProgFill, {
                    width: `${slot.habits.length ? (slotDone / slot.habits.length) * 100 : 0}%` as `${number}%`,
                    backgroundColor: allComplete ? '#4CD964' : slot.color,
                    opacity: isActive ? 1 : 0.45,
                  }]} />
                </View>

                {/* Habit cards — profile card style */}
                <View style={[s.cardGroup, { borderColor: isActive ? slot.color + '35' : Colors.border }]}>
                  {slot.habits.map((h, idx) => {
                    const status = getStatus(h);
                    const isDone = status === 'perfect' || status === 'late';
                    const isPartial = status === 'partial';
                    const isMissed = status === 'missed';
                    const isPending = status === 'pending';
                    const streak = streakMap[h.id] ?? 0;
                    const monthly = calcMonthlyCount(recentLogs, h.id);
                    const weekly = calcWeeklyCount(recentLogs, h.id);
                    const logEntry = logMap.get(h.id);
                    const summary = logEntry ? getLogSummary(h, logEntry) : null;
                    const logTime = logEntry?.mins != null ? fmtTime(logEntry.mins) : null;
                    const accentClr = isDone ? '#4CD964' : isPartial ? '#FF9500' : isMissed ? '#FF3B30' : h.color;

                    return (
                      <TouchableOpacity
                        key={h.id}
                        onPress={() => openDetail(h)}
                        activeOpacity={0.78}
                        style={[
                          s.habitRow,
                          idx > 0 && { borderTopWidth: 1, borderTopColor: Colors.border },
                          { borderLeftWidth: 3, borderLeftColor: accentClr + 'cc' },
                          isDone && { backgroundColor: 'rgba(16,32,20,0.6)' },
                          isMissed && { opacity: 0.65 },
                        ]}
                      >

                        {/* Emoji icon */}
                        <View style={[s.iconWrap, { backgroundColor: h.color + '18', borderColor: h.color + '35' }]}>
                          <Text style={s.habitEmoji}>{h.emoji}</Text>
                        </View>

                        {/* Content */}
                        <View style={{ flex: 1, gap: 2 }}>
                          <View style={s.nameRow}>
                            <Text style={[s.habitName, (isDone || isMissed) && { opacity: 0.45 }]} numberOfLines={1}>
                              {h.name}
                            </Text>
                            {isDone && <View style={[s.badge, { backgroundColor: '#4CD96418', borderColor: '#4CD96440' }]}><Text style={[s.badgeTxt, { color: '#4CD964' }]}>{status === 'late' ? '⏰ Late' : '✓ Done'}</Text></View>}
                            {isPartial && <View style={[s.badge, { backgroundColor: '#FF950018', borderColor: '#FF950040' }]}><Text style={[s.badgeTxt, { color: '#FF9500' }]}>◆ Partial</Text></View>}
                            {isMissed && <View style={[s.badge, { backgroundColor: '#FF3B3018', borderColor: '#FF3B3040' }]}><Text style={[s.badgeTxt, { color: '#FF3B30' }]}>✗ Missed</Text></View>}
                            {isPending && <View style={[s.badge, { backgroundColor: h.color + '18', borderColor: h.color + '40' }]}><Text style={[s.badgeTxt, { color: h.color }]}>○ Up next</Text></View>}
                          </View>
                          <Text style={[s.timeWin, isPending && { color: h.color + 'bb' }]}>
                            🕒 {h.kala}{logTime ? `  ·  logged ${logTime}` : ''}
                          </Text>
                          {!isDone && !isMissed && h.ayurNote ? (
                            <Text style={s.ayurNote} numberOfLines={2}>{h.ayurNote}</Text>
                          ) : null}
                          {summary ? <Text style={s.logSummary} numberOfLines={1}>✓ {summary}</Text> : null}
                          <Text style={s.streakLine}>
                            {streak > 0 ? `🔥 ${streak}d  ·  ` : ''}{monthly}×/mo  ·  {weekly}×/wk
                          </Text>
                        </View>

                        <Text style={s.caret}>›</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          })}
          <View style={{ height: 60 }} />
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: Colors.bg },

  // ── Hero banner (like profile heroBanner) ────────────────────────────────────
  heroBanner: { paddingBottom: Spacing.md },

  identityRow: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  identityBadge: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.sm },
  identityName: { fontSize: Font.sizes.sm, fontFamily: Font.black, letterSpacing: 0.3 },
  identityDate: { fontSize: 9, color: Colors.textMuted, marginTop: 1, fontFamily: Font.semi },
  missionChip: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  missionTime: { fontSize: 11, fontFamily: Font.black },

  // 4-column stats (same as profile statsRow)
  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, marginBottom: Spacing.sm },
  statCard: { flex: 1, backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1, paddingVertical: Spacing.sm, alignItems: 'center' },
  statVal: { fontSize: Font.sizes.sm, fontFamily: Font.black },
  statLbl: { fontSize: 8, color: Colors.textMuted, fontFamily: Font.semi, marginTop: 2, textAlign: 'center' },

  // Progress
  progTrack: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginHorizontal: Spacing.lg, marginBottom: 6 },
  progFill: { height: '100%', borderRadius: 2 },
  progLblRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  progLbl: { fontSize: 12, fontFamily: Font.bold },
  progPct: { fontSize: 12, fontFamily: Font.black },

  // ── Body ─────────────────────────────────────────────────────────────────────
  body: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTitle: { fontSize: 16, fontFamily: Font.extraBold, color: Colors.text, textAlign: 'center' },
  emptyBody: { fontSize: 13, fontFamily: Font.regular, color: Colors.textMuted, textAlign: 'center', lineHeight: 20, paddingHorizontal: 24 },

  // ── Section (profile-like) ───────────────────────────────────────────────────
  section: { marginBottom: Spacing.xl },

  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 6 },
  sectionDot: { width: 7, height: 7, borderRadius: 4 },
  sectionTitle: { fontSize: Font.sizes.xs, fontFamily: Font.black, letterSpacing: 1.2 },
  sectionKala: { flex: 1, fontSize: 9, fontFamily: Font.semi, letterSpacing: 0.3, textAlign: 'right' },
  slotRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nowPill: { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  nowPillTxt: { fontSize: 9, fontFamily: Font.black, color: '#000', letterSpacing: 0.6 },
  slotCount: { fontSize: 14, fontFamily: Font.black },

  slotProgTrack: { height: 3, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2, marginBottom: Spacing.sm, overflow: 'hidden' },
  slotProgFill: { height: '100%', borderRadius: 2 },

  // Card group (profile doshaCard style)
  cardGroup: { backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },

  // Habit row (like profile accountRow)
  habitRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: Spacing.md, paddingVertical: 14, position: 'relative' },

  iconWrap: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  habitEmoji: { fontSize: 22 },

  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  habitName: { fontSize: Font.sizes.sm, fontFamily: Font.extraBold, color: Colors.text },
  badge: { borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: 7, paddingVertical: 2 },
  badgeTxt: { fontSize: 9, fontFamily: Font.black, letterSpacing: 0.3 },

  timeWin: { fontSize: 11, fontFamily: Font.semi, color: Colors.textMuted },
  ayurNote: { fontSize: 10, fontFamily: Font.regular, color: 'rgba(255,255,255,0.35)', lineHeight: 15, fontStyle: 'italic' },
  logSummary: { fontSize: 11, fontFamily: Font.semi, color: '#4CD96488' },
  streakLine: { fontSize: 10, fontFamily: Font.bold, color: Colors.textDim, marginTop: 2 },

  caret: { fontSize: 18, color: Colors.textMuted, fontFamily: Font.bold },
});
