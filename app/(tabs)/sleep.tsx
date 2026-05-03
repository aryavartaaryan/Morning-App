import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import notifee, { AndroidImportance, AndroidCategory, AndroidVisibility, TriggerType, RepeatFrequency } from '@notifee/react-native';
import { store, KEYS } from '@/lib/storage';
import { AlarmSettings, DEFAULT_ALARM_SETTINGS } from '@/lib/notifications';
import { Colors } from '@/constants/theme';

const SLEEP_COLOR = '#60a5fa';
const pad = (n: number) => String(n).padStart(2, '0');

function fmt12(h: number, m: number) {
  const ap = h < 12 ? 'AM' : 'PM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${pad(h12)}:${pad(m)} ${ap}`;
}

const SLEEP_CYCLES = [
  { cycles: 6, hours: 9.0, label: '9 hr', quality: 'Optimal',    color: '#10b981' },
  { cycles: 5, hours: 7.5, label: '7.5 hr', quality: 'Great',    color: '#34d399' },
  { cycles: 4, hours: 6.0, label: '6 hr',   quality: 'Minimum',  color: '#fbbf24' },
  { cycles: 3, hours: 4.5, label: '4.5 hr', quality: 'Caution',  color: '#f97316' },
];

const SLEEP_TIPS = [
  { emoji: '📵', title: 'No screens 1 hr before bed', sub: 'Blue light suppresses melatonin by up to 50%.' },
  { emoji: '🌡️', title: 'Cool room (65–68°F / 18–20°C)', sub: 'Core body temp drop triggers sleep onset.' },
  { emoji: '🫁', title: '4-7-8 breathing to sleep faster', sub: 'Inhale 4s · Hold 7s · Exhale 8s. Repeat 4×.' },
  { emoji: '☕', title: 'No caffeine after 2 PM', sub: 'Caffeine half-life is ~6 hrs — it stays in your system.' },
  { emoji: '🌙', title: 'Same wake time every day', sub: 'Consistent wake time is the #1 sleep quality lever.' },
  { emoji: '🛁', title: 'Warm shower 1 hr before bed', sub: 'Rapid skin cooling after shower accelerates sleep.' },
];

export default function SleepTab() {
  const [wakeHour, setWakeHour]     = useState(DEFAULT_ALARM_SETTINGS.wakeAlarm.hour);
  const [wakeMinute, setWakeMinute] = useState(DEFAULT_ALARM_SETTINGS.wakeAlarm.minute);
  const [bedtimeAlert, setBedtimeAlert]   = useState(false);
  const [eveningMantra, setEveningMantra] = useState(false);
  const now = new Date();

  useEffect(() => {
    store.getJSON<AlarmSettings>(KEYS.alarmSettings).then(s => {
      if (s?.wakeAlarm) { setWakeHour(s.wakeAlarm.hour); setWakeMinute(s.wakeAlarm.minute); }
      setEveningMantra(s?.eveningMantra ?? false);
    });
  }, []);

  const scheduleEveningMantraNotif = async () => {
    try {
      await notifee.createChannel({ id: 'arise-habit-alarms', name: 'SolRize Habit Alarms', importance: AndroidImportance.HIGH, bypassDnd: true, visibility: AndroidVisibility.PUBLIC } as any);
      const next = new Date(); next.setHours(21, 30, 0, 0);
      if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
      await notifee.createTriggerNotification(
        { id: 'evening-mantra-daily', title: '🔱  Shiv Sankalpa Suktam', body: 'Sacred Mind Hymn · 9:30 PM', android: { channelId: 'arise-habit-alarms', importance: AndroidImportance.HIGH, category: AndroidCategory.ALARM, visibility: AndroidVisibility.PUBLIC, fullScreenAction: { id: 'default', launchActivity: 'default' }, pressAction: { id: 'default', launchActivity: 'default' } } as any, data: { type: 'evening-mantra' } },
        { type: TriggerType.TIMESTAMP, timestamp: next.getTime(), repeatFrequency: RepeatFrequency.DAILY, alarmManager: { allowWhileIdle: true } } as any,
      );
    } catch (e) { console.warn('[EveningMantra] schedule:', e); }
  };
  const cancelEveningMantraNotif = async () => { await notifee.cancelTriggerNotification('evening-mantra-daily').catch(() => {}); };

  const toggleEveningMantra = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newVal = !eveningMantra;
    setEveningMantra(newVal);
    const s = await store.getJSON<AlarmSettings>(KEYS.alarmSettings);
    await store.setJSON(KEYS.alarmSettings, { ...(s ?? DEFAULT_ALARM_SETTINGS), eveningMantra: newVal });
    if (newVal) scheduleEveningMantraNotif(); else cancelEveningMantraNotif();
  };

  const getBedtime = (hoursBack: number) => {
    const totalMins  = wakeHour * 60 + wakeMinute - Math.round(hoursBack * 60) - 15;
    const normalized = ((totalMins % 1440) + 1440) % 1440;
    return { h: Math.floor(normalized / 60), m: normalized % 60 };
  };

  const currentMins   = now.getHours() * 60 + now.getMinutes();
  const wakeMins      = wakeHour * 60 + wakeMinute;
  const bestBedtime   = getBedtime(7.5);
  const bestBedMins   = bestBedtime.h * 60 + bestBedtime.m;
  const minsUntilBed  = bestBedMins > currentMins ? bestBedMins - currentMins : bestBedMins + 1440 - currentMins;
  const hrsToBed      = Math.floor(minsUntilBed / 60);
  const minsToBed     = minsUntilBed % 60;

  return (
    <View style={S.screen}>
      <LinearGradient colors={['#0C1A3A', '#060C20', '#060610']} style={S.headerGrad}>
        <SafeAreaView edges={['top']}>
          <View style={S.headerTop}>
            <Text style={S.appName}>🌙  Sleep</Text>
            <Text style={{ fontSize: 11, color: SLEEP_COLOR + '80', fontWeight: '700' }}>Wake · {fmt12(wakeHour, wakeMinute)}</Text>
          </View>
          <View style={{ alignItems: 'center', paddingBottom: 14 }}>
            <Text style={S.headline}>Bedtime Windows</Text>
            <Text style={S.sub}>Based on your {fmt12(wakeHour, wakeMinute)} wake alarm</Text>
            {minsUntilBed < 120 && (
              <View style={S.bedtimePill}>
                <View style={[S.dot, { backgroundColor: '#10b981' }]} />
                <Text style={{ color: '#10b981', fontSize: 11, fontWeight: '700' }}>Bedtime in {hrsToBed > 0 ? `${hrsToBed}h ${minsToBed}m` : `${minsToBed} min`}</Text>
              </View>
            )}
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* Sleep cycle cards */}
        <Text style={S.sectionLabel}>SLEEP CYCLE WINDOWS  (90 min each)</Text>
        {SLEEP_CYCLES.map(cycle => {
          const bed = getBedtime(cycle.hours);
          const isRecommended = cycle.cycles === 5;
          return (
            <View key={cycle.cycles} style={[S.cycleCard, isRecommended && { borderColor: cycle.color + '50', backgroundColor: cycle.color + '06' }]}>
              <View style={[S.cycleLeft, { backgroundColor: cycle.color + '18' }]}>
                <Text style={[S.cycleHours, { color: cycle.color }]}>{cycle.label}</Text>
                <Text style={[S.cycleCycles, { color: cycle.color + '80' }]}>{cycle.cycles} cycles</Text>
              </View>
              <View style={{ flex: 1, paddingLeft: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={S.bedtimeTime}>{fmt12(bed.h, bed.m)}</Text>
                  {isRecommended && <View style={[S.recommendedBadge, { backgroundColor: cycle.color + '20', borderColor: cycle.color + '50' }]}><Text style={[S.recommendedTxt, { color: cycle.color }]}>IDEAL</Text></View>}
                </View>
                <Text style={[S.qualityTxt, { color: cycle.color }]}>{cycle.quality}</Text>
                <Text style={S.bedSub}>Sleep by this time to wake refreshed</Text>
              </View>
            </View>
          );
        })}

        {/* Sleep window visualization */}
        <Text style={S.sectionLabel}>YOUR SLEEP WINDOW</Text>
        <View style={S.windowCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text style={S.windowLabel}>🛏  Ideal bedtime</Text>
            <Text style={[S.windowTime, { color: SLEEP_COLOR }]}>{fmt12(bestBedtime.h, bestBedtime.m)}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
            <Text style={S.windowLabel}>⏰  Wake alarm</Text>
            <Text style={[S.windowTime, { color: '#F5820A' }]}>{fmt12(wakeHour, wakeMinute)}</Text>
          </View>
          <View style={S.sleepBar}>
            <LinearGradient colors={[SLEEP_COLOR + '30', SLEEP_COLOR + '10']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[S.sleepBarFill, { width: '80%' }]} />
            <View style={[S.sleepBarDot, { left: '0%', backgroundColor: SLEEP_COLOR }]} />
            <View style={[S.sleepBarDot, { right: 0, backgroundColor: '#F5820A' }]} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
            <Text style={S.barLabel}>{fmt12(bestBedtime.h, bestBedtime.m)}</Text>
            <Text style={S.barLabel}>{fmt12(wakeHour, wakeMinute)}</Text>
          </View>
        </View>

        {/* Bedtime reminder toggle */}
        <Text style={S.sectionLabel}>BEDTIME REMINDER</Text>
        <View style={S.toggleCard}>
          <Text style={{ fontSize: 18 }}>🌙</Text>
          <View style={{ flex: 1 }}>
            <Text style={S.toggleTitle}>Bedtime Alert</Text>
            <Text style={S.toggleSub}>Remind me 30 min before ideal bedtime</Text>
          </View>
          <Switch value={bedtimeAlert} onValueChange={v => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setBedtimeAlert(v); }} trackColor={{ false: '#222', true: SLEEP_COLOR + '80' }} thumbColor={bedtimeAlert ? SLEEP_COLOR : '#666'} />
        </View>

        {/* Evening mantra toggle */}
        <View style={[S.toggleCard, { borderColor: '#818cf820', marginTop: 4 }]}>
          <Text style={{ fontSize: 18 }}>🔱</Text>
          <View style={{ flex: 1 }}>
            <Text style={S.toggleTitle}>Evening Mantra</Text>
            <Text style={S.toggleSub}>Shiv Sankalpa Suktam · 9:30 PM every night</Text>
          </View>
          <Switch value={eveningMantra} onValueChange={toggleEveningMantra} trackColor={{ false: '#222', true: '#818cf880' }} thumbColor={eveningMantra ? '#818cf8' : '#666'} />
        </View>

        {/* Sleep science tips */}
        <Text style={S.sectionLabel}>SLEEP SCIENCE</Text>
        {SLEEP_TIPS.map((tip, i) => (
          <View key={i} style={S.tipCard}>
            <Text style={S.tipEmoji}>{tip.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={S.tipTitle}>{tip.title}</Text>
              <Text style={S.tipSub}>{tip.sub}</Text>
            </View>
          </View>
        ))}

        <View style={S.scienceNote}>
          <Text style={S.scienceNoteTxt}>💡  Sleep cycles are ~90 min each. The 15-min buffer accounts for falling asleep. Waking between cycles — not mid-cycle — is what makes mornings effortless.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#060610' },
  headerGrad: { paddingBottom: 14 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 6, paddingBottom: 8 },
  appName: { fontSize: 15, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },
  headline: { fontSize: 26, fontWeight: '200', color: '#fff', letterSpacing: -0.5 },
  sub: { fontSize: 12, color: '#FFFFFF40', marginTop: 4 },
  bedtimePill: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, backgroundColor: '#10b98112', borderWidth: 1, borderColor: '#10b98130', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  sectionLabel: { fontSize: 8, fontWeight: '900', color: '#FFFFFF28', letterSpacing: 1.6, marginHorizontal: 16, marginTop: 20, marginBottom: 8 },
  cycleCard: { marginHorizontal: 16, marginBottom: 8, borderRadius: 18, borderWidth: 1, borderColor: '#FFFFFF0A', backgroundColor: '#FFFFFF04', flexDirection: 'row', alignItems: 'center', padding: 14, overflow: 'hidden' },
  cycleLeft: { width: 70, borderRadius: 12, paddingVertical: 10, alignItems: 'center', gap: 2 },
  cycleHours: { fontSize: 15, fontWeight: '900' },
  cycleCycles: { fontSize: 9, fontWeight: '700' },
  bedtimeTime: { fontSize: 22, fontWeight: '200', color: '#fff', letterSpacing: -0.5 },
  recommendedBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  recommendedTxt: { fontSize: 7, fontWeight: '900', letterSpacing: 1 },
  qualityTxt: { fontSize: 11, fontWeight: '800', marginTop: 2 },
  bedSub: { fontSize: 10, color: '#FFFFFF30', marginTop: 2 },
  windowCard: { marginHorizontal: 16, marginBottom: 8, borderRadius: 18, borderWidth: 1, borderColor: '#FFFFFF0A', backgroundColor: '#FFFFFF04', padding: 18 },
  windowLabel: { fontSize: 12, color: '#FFFFFF50', fontWeight: '600' },
  windowTime: { fontSize: 15, fontWeight: '900' },
  sleepBar: { height: 6, backgroundColor: '#FFFFFF08', borderRadius: 3, overflow: 'visible', position: 'relative' },
  sleepBarFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 3 },
  sleepBarDot: { position: 'absolute', top: -4, width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#060610' },
  barLabel: { fontSize: 9, color: '#FFFFFF30', fontWeight: '600' },
  toggleCard: { marginHorizontal: 16, marginBottom: 8, borderRadius: 18, borderWidth: 1, borderColor: '#FFFFFF0A', backgroundColor: '#FFFFFF04', flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  toggleTitle: { fontSize: 13, fontWeight: '800', color: '#fff' },
  toggleSub: { fontSize: 11, color: '#FFFFFF40', marginTop: 2 },
  tipCard: { marginHorizontal: 16, marginBottom: 6, borderRadius: 16, borderWidth: 1, borderColor: '#FFFFFF08', backgroundColor: '#FFFFFF03', flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14 },
  tipEmoji: { fontSize: 20, marginTop: 1 },
  tipTitle: { fontSize: 13, fontWeight: '700', color: '#fff' },
  tipSub: { fontSize: 11, color: '#FFFFFF45', marginTop: 3 },
  scienceNote: { marginHorizontal: 16, marginTop: 12, marginBottom: 4, backgroundColor: SLEEP_COLOR + '08', borderWidth: 1, borderColor: SLEEP_COLOR + '18', borderRadius: 14, padding: 14 },
  scienceNoteTxt: { fontSize: 11, color: SLEEP_COLOR + 'AA', lineHeight: 17 },
});
