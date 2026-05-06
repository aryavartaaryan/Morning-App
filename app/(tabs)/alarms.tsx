import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, Modal,
  TextInput, Alert, Animated, Dimensions, NativeModules, Platform,
  ToastAndroid, ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { speakBodhi, stopBodhi } from '@/lib/speech';
import { store, KEYS } from '@/lib/storage';
import * as Notifications from 'expo-notifications';
import { Audio } from 'expo-av';
import {
  AlarmSettings, DEFAULT_ALARM_SETTINGS, rescheduleAllFromSettings, requestNotificationPermission,
} from '@/lib/notifications';
import { MISSIONS, DEFAULT_MISSION_SETTINGS, MissionSettings } from '@/lib/missionAlarm';
import {
  scheduleNativeAlarm, cancelNativeAlarm, checkAlarmPermission,
  setNativeAlarmSound, setNativeAlarmSoundPath, requestAllAlarmPermissions,
} from '@/lib/nativeAlarm';
import notifee, { AndroidImportance, AndroidCategory, AndroidVisibility, TriggerType, RepeatFrequency, AlarmType, AndroidForegroundServiceType } from '@notifee/react-native';
import { Colors } from '@/constants/theme';
import { getSolarTimes, type SolarTimes } from '@/lib/solar';
import { PRAKRITI_PLANS, type PledgeData } from '@/lib/prakritiPlan';
import * as FileSystem from 'expo-file-system/legacy';
import { getLocalMantraPath, isMantraDownloaded, downloadMantra } from '@/lib/mantraDownload';
import { getBgSource } from '@/lib/bgImages';

const ACCENT = '#F5820A';
const { width } = Dimensions.get('window');
const MANTRA_TO_WAKE_SOUND: Record<string, string> = {
  gayatri: 'gayatri', lalitha: 'lalitha', shivtandav: 'shiv_tandav',
  bhagya_suktam: 'bhagya_suktam', shiv_sankalpa_suktam: 'shiv_sankalpa_suktam',
};
const BUNDLED_MANTRAS = new Set(['bhagya_suktam', 'shiv_sankalpa_suktam']);
const PRESETS = [
  { label: 'Brahma',  sub: '4:00 AM', hour: 4,  minute: 0,  color: '#a78bfa' },
  { label: 'Dawn',    sub: '4:30 AM', hour: 4,  minute: 30, color: '#818cf8' },
  { label: 'Early',   sub: '5:30 AM', hour: 5,  minute: 30, color: '#60a5fa' },
  { label: 'Sunrise', sub: '6:00 AM', hour: 6,  minute: 0,  color: '#34d399' },
];
const MANTRAS = [
  { id: 'gayatri',    label: 'Gayatri Mantra',      emoji: '🌞', color: '#fbbf24', hint: 'ॐ भूर्भुवः स्वः', pitch: 0.85, rate: 0.70, text: 'Om Bhur Bhuva Swaha, Tat Savitur Varenyam, Bhargo Devasya Dhimahi, Dhiyo Yo Nah Prachodayat. Om Shanti Shanti Shanti.', audioUrl: 'https://ik.imagekit.io/rcsesr4xf/gayatri-mantra-ghanpaath.mp3' },
  { id: 'lalitha',    label: 'Lalitha Sahasranama', emoji: '🌺', color: '#f472b6', hint: 'ॐ ऐं ह्रीं श्रीं', pitch: 0.80, rate: 0.65, text: 'Om Aim Hreem Shreem, Sri Lalitha Tripura Sundari, Namami Namami Namami. Om Shakti Shakti Shakti.', audioUrl: 'https://ik.imagekit.io/rcsesr4xf/Lalitha-Sahasranamam.mp3' },
  { id: 'shivtandav',           label: 'Shiv Tandav',              emoji: '🔱', color: '#a78bfa', hint: 'ॐ नमः शिवाय',     pitch: 0.75, rate: 0.68, text: 'Jata tavee galajjala pravaha pavithrasthale. Om Namah Shivaya, Om Namah Shivaya. Har Har Mahadev.', audioUrl: 'https://ik.imagekit.io/rcsesr4xf/Shiva-Tandav.mp3' },
  { id: 'bhagya_suktam',        label: 'Bhagya Suktam',            emoji: '🌟', color: '#fbbf24', hint: 'Fortune Hymn',    pitch: 0.85, rate: 0.70, text: 'Om Bhagyam Dehi, Shri Devi Namaha. May prosperity, wisdom and fortune flow into this day. Om Shanti.', audioUrl: '' },
  { id: 'shiv_sankalpa_suktam', label: 'Shiv Sankalpa Suktam',     emoji: '🔱', color: '#818cf8', hint: 'Sacred Mind Hymn',pitch: 0.80, rate: 0.68, text: 'Yat pragnanam uta cheto dhritishcha, Yat jyotir antah amritam prajasu. Yan nah chittam ahuti pupa ya, tan me manah shivasankalpam astu.', audioUrl: '' },
];
const AYU_HABITS = [
  { key: 'wake_early',   label: 'Wake Early',       emoji: '🌙' },
  { key: 'hydrate',      label: 'Hydrate',          emoji: '💧' },
  { key: 'shower',       label: 'Shower',           emoji: '🚿' },
  { key: 'meditation',   label: 'Meditation',       emoji: '🧘' },
  { key: 'prayer',       label: 'Prayer',           emoji: '🙏' },
  { key: 'stretch',      label: 'Stretch',          emoji: '🤸' },
  { key: 'sunlight',     label: 'Sunlight',         emoji: '☀️' },
  { key: 'breakfast',    label: 'Breakfast',        emoji: '🌾' },
  { key: 'main_meal',    label: 'Main Meal',        emoji: '🍛' },
  { key: 'walk',         label: 'Post-Meal Walk',   emoji: '🚶' },
  { key: 'herbal_tea',   label: 'Herbal Tea',       emoji: '🍵' },
  { key: 'evening_walk', label: 'Evening Walk',     emoji: '🌆' },
  { key: 'light_dinner', label: 'Light Dinner',     emoji: '🥗' },
  { key: 'screen_free',  label: 'Screen-Free Time', emoji: '📵' },
  { key: 'journaling',   label: 'Journaling',       emoji: '📓' },
  { key: 'sleep',        label: 'Sleep by 10 PM',   emoji: '🌑' },
  { key: 'custom',       label: 'Custom',           emoji: '✨' },
];
const DAY_LABELS = ['S','M','T','W','T','F','S'];
const DAY_FULL   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function getTimedBgKey(h: number, solar?: SolarTimes | null): string {
  if (solar) {
    const { sunrise, solarNoon, sunset } = solar;
    if (h < sunrise - 1.5) return 'night';
    if (h < sunrise - 0.3) return 'brahma';
    if (h < sunrise + 0.5) return 'predawn';
    if (h < sunrise + 2)   return 'sunrise';
    if (h < solarNoon - 1) return 'morning';
    if (h < solarNoon + 2) return 'midday';
    if (h < sunset - 1.5)  return 'afternoon';
    if (h < sunset)        return 'sandhya';
    if (h < sunset + 0.5)  return 'twilight';
    if (h < sunset + 2)    return 'evening';
    return 'night';
  }
  if (h >= 2  && h < 5)    return 'brahma';
  if (h >= 5  && h < 5.5)  return 'predawn';
  if (h >= 5.5 && h < 8)   return 'sunrise';
  if (h >= 8  && h < 10)   return 'morning';
  if (h >= 10 && h < 14)   return 'midday';
  if (h >= 14 && h < 17)   return 'afternoon';
  if (h >= 17 && h < 19)    return 'sandhya';
  if (h >= 19 && h < 19.5)  return 'twilight';
  if (h >= 19.5 && h < 21)  return 'evening';
  return 'night';
}

const pad  = (n: number) => String(n).padStart(2, '0');
const fmt12 = (h: number, m: number) => {
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12  = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${pad(h12)}:${pad(m)} ${ampm}`;
};

export interface AlarmEntry {
  id: string; type: 'habit'|'quick'; hour: number; minute: number;
  label: string; enabled: boolean; habitKey?: string; habitEmoji?: string; days?: number[];
}

function Toggle({ value, onToggle, color = '#a78bfa' }: { value: boolean; onToggle: () => void; color?: string }) {
  return <Switch value={value} onValueChange={onToggle} trackColor={{ false: Colors.border ?? '#222', true: color + '80' }} thumbColor={value ? color : '#666'} />;
}

const DS = ['S','M','T','W','T','F','S'] as const;
function DayDots({ days, color = '#10b981' }: { days?: number[]; color?: string }) {
  const isAll = !days || days.length === 0 || days.length === 7;
  return (
    <View style={{ flexDirection: 'row', gap: 4, marginTop: 6 }}>
      {DS.map((d, i) => {
        const on = isAll || days!.includes(i);
        return (
          <View key={i} style={{
            flex: 1, height: 24, borderRadius: 7,
            backgroundColor: on ? color + '22' : '#FFFFFF09',
            borderWidth: 1,
            borderColor: on ? color + '55' : '#FFFFFF14',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 11, fontWeight: on ? '900' : '500', color: on ? color : '#FFFFFF30' }}>{d}</Text>
          </View>
        );
      })}
    </View>
  );
}

const DRUM_H     = 52;
const DRUM_REPEAT = 5;
const HOURS      = Array.from({ length: 24 }, (_, i) => i);
const MINUTES    = Array.from({ length: 60 }, (_, i) => i);

function DrumColumn({ values, selected, onChange }: { values: number[]; selected: number; onChange: (v: number) => void }) {
  const count     = values.length;
  const repeated  = Array.from({ length: DRUM_REPEAT }, () => values).flat();
  const midOffset = 2 * count;

  const ref             = useRef<ScrollView>(null);
  const momentumStarted = useRef(false);
  const lastEmit        = useRef(selected);
  const [selIdx, setSelIdx] = useState(() => midOffset + values.indexOf(selected));
  const selIdxRef = useRef(selIdx);

  const updateSel = (idx: number) => { selIdxRef.current = idx; setSelIdx(idx); };

  useEffect(() => {
    const idx = midOffset + values.indexOf(selected);
    updateSel(idx);
    setTimeout(() => ref.current?.scrollTo({ y: idx * DRUM_H, animated: false }), 100);
  }, []);

  useEffect(() => {
    if (lastEmit.current === selected) return;
    lastEmit.current = selected;
    const cur = selIdxRef.current;
    let best = midOffset + values.indexOf(selected);
    let minD  = Math.abs(best - cur);
    for (let i = 0; i < repeated.length; i++) {
      if (repeated[i] === selected) {
        const d = Math.abs(i - cur);
        if (d < minD) { minD = d; best = i; }
      }
    }
    updateSel(best);
    ref.current?.scrollTo({ y: best * DRUM_H, animated: true });
  }, [selected]);

  const snap = (y: number) => {
    let idx = Math.round(y / DRUM_H);
    idx = Math.max(0, Math.min(idx, repeated.length - 1));
    const v = repeated[idx];
    if (v !== lastEmit.current) { lastEmit.current = v; onChange(v); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }
    if (idx < count || idx >= count * (DRUM_REPEAT - 1)) {
      const mid = midOffset + values.indexOf(v);
      updateSel(mid);
      setTimeout(() => ref.current?.scrollTo({ y: mid * DRUM_H, animated: false }), 0);
    } else {
      updateSel(idx);
      ref.current?.scrollTo({ y: idx * DRUM_H, animated: false });
    }
  };

  return (
    <View style={{ height: DRUM_H * 3, overflow: 'hidden', minWidth: 64 }}>
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={DRUM_H}
        decelerationRate="fast"
        scrollEventThrottle={16}
        nestedScrollEnabled
        onScrollBeginDrag={() => { momentumStarted.current = false; }}
        onMomentumScrollBegin={() => { momentumStarted.current = true; }}
        onMomentumScrollEnd={e => { momentumStarted.current = false; snap(e.nativeEvent.contentOffset.y); }}
        onScrollEndDrag={e => { if (!momentumStarted.current) snap(e.nativeEvent.contentOffset.y); }}
      >
        <View style={{ height: DRUM_H }} />
        {repeated.map((v, i) => (
          <View key={i} style={{ height: DRUM_H, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{
              fontSize: i === selIdx ? 42 : 26,
              fontWeight: i === selIdx ? '100' : '300',
              color: i === selIdx ? '#FFFFFF' : '#FFFFFF28',
              letterSpacing: -1.5,
            }}>{String(v).padStart(2, '0')}</Text>
          </View>
        ))}
        <View style={{ height: DRUM_H }} />
      </ScrollView>
    </View>
  );
}

function TimeAdjuster({ hour, minute, onChange }: { hour: number; minute: number; onChange: (h: number, m: number) => void }) {
  return (
    <View style={{ paddingVertical: 10 }}>
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: DRUM_H + 10, height: DRUM_H, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#FFFFFF15', backgroundColor: '#FFFFFF05', zIndex: 1 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
        <DrumColumn values={HOURS} selected={hour} onChange={h => onChange(h, minute)} />
        <Text style={{ fontSize: 36, fontWeight: '100', color: '#FFFFFF35', paddingHorizontal: 8, alignSelf: 'center' }}>:</Text>
        <DrumColumn values={MINUTES} selected={minute} onChange={m => onChange(hour, m)} />
        <Text style={{ fontSize: 17, fontWeight: '800', color: ACCENT, paddingLeft: 12, alignSelf: 'center' }}>{hour < 12 ? 'AM' : 'PM'}</Text>
      </View>
    </View>
  );
}

function DaySelector({ days, onChange }: { days: number[]; onChange: (d: number[]) => void }) {
  const toggle = (d: number) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onChange(days.includes(d) ? days.filter(x => x !== d) : [...days, d]); };
  return (
    <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
      {DAY_LABELS.map((label, i) => {
        const active = days.includes(i);
        return (
          <TouchableOpacity key={i} onPress={() => toggle(i)} style={{ flex: 1, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: active ? ACCENT + '80' : '#FFFFFF12', backgroundColor: active ? ACCENT + '18' : '#FFFFFF04' }}>
            <Text style={{ fontSize: 10, fontWeight: '800', color: active ? ACCENT : '#FFFFFF30' }}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Glassy Overlay (permanent peak frost — matches home page) ──────────────
function GlassPulseOverlay() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <LinearGradient
        colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.11)', 'rgba(255,255,255,0.03)', 'transparent']}
        start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
export default function AlarmsTab() {
  const insets = useSafeAreaInsets();
  const [settings, setSettings]             = useState<AlarmSettings>(DEFAULT_ALARM_SETTINGS);
  const [saving, setSaving]                 = useState(false);
  const [selectedMantraId, setSelectedMantraId] = useState('bhagya_suktam');
  const saveAnim                            = useRef(new Animated.Value(0)).current;
  const alarmActiveRef                      = useRef(false);
  const [dlStatus, setDlStatus]             = useState<Record<string,'idle'|'downloading'|'downloaded'>>({ gayatri:'idle', lalitha:'idle', shivtandav:'idle', bhagya_suktam:'idle', shiv_sankalpa_suktam:'idle' });
  const [dlProgress, setDlProgress]         = useState<Record<string, number>>({});
  const [alarmEntries, setAlarmEntries]     = useState<AlarmEntry[]>([]);
  const [fabOpen, setFabOpen]               = useState(false);
  const [menuOpenId, setMenuOpenId]         = useState<string|null>(null);
  const [showWakeEdit, setShowWakeEdit]     = useState(false);
  const [addType, setAddType]               = useState<'habit'|'quick'|null>(null);
  const [editEntry, setEditEntry]           = useState<AlarmEntry|null>(null);
  const [formHour, setFormHour]             = useState(7);
  const [formMinute, setFormMinute]         = useState(0);
  const [formLabel, setFormLabel]           = useState('');
  const [formHabitKey, setFormHabitKey]     = useState('meditation');
  const [formHabitEmoji, setFormHabitEmoji] = useState('🧘');
  const [formDays, setFormDays]             = useState<number[]>([]);
  const [showCustomHabitInput, setShowCustomHabitInput] = useState(false);
  const [missionSettings, setMissionSettings] = useState<MissionSettings>(DEFAULT_MISSION_SETTINGS);
  const [permStatus, setPermStatus]         = useState({ notifications: true, exactAlarm: true, batteryOpt: true, fullScreen: true });
  const [liveClock, setLiveClock]           = useState(new Date());
  const [prakritiWake, setPrakritiWake]     = useState<{ label: string; hour: number; minute: number; color: string }|null>(null);
  const [alarmModal, setAlarmModal]         = useState(false);
  const [solarTimes, setSolarTimes]         = useState<SolarTimes|null>(null);
  const [bgUri, setBgUri]                   = useState<string | null>(null);

  useEffect(() => { const t = setInterval(() => setLiveClock(new Date()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => {
    store.getJSON<{lat:number;lon:number}>(KEYS.location).then(loc => { if (loc?.lat && loc?.lon) setSolarTimes(getSolarTimes(loc.lat, loc.lon)); }).catch(() => {});
  }, []);
  useEffect(() => {
    const h = liveClock.getHours() + liveClock.getMinutes() / 60;
    const key = getTimedBgKey(h, solarTimes) ?? 'night';
    getBgSource(key).then(uri => setBgUri(uri)).catch(() => {});
  }, [liveClock, solarTimes]);

  useEffect(() => {
    (async () => {
      const s  = await store.getJSON<AlarmSettings>(KEYS.alarmSettings);
      const pl = await store.getJSON<PledgeData>(KEYS.pledge);
      if (pl?.prakriti && PRAKRITI_PLANS[pl.prakriti]) {
        const plan = PRAKRITI_PLANS[pl.prakriti];
        const color = pl.prakriti === 'Kapha' ? '#34d399' : pl.prakriti === 'Pitta' ? '#fb923c' : '#a78bfa';
        setPrakritiWake({ label: `${pl.prakriti} Plan · ${plan.wakeTime}`, hour: plan.wakeHour, minute: plan.wakeMin, color });
        if (!s || (!s.wakeAlarm?.enabled && s.wakeAlarm?.hour === DEFAULT_ALARM_SETTINGS.wakeAlarm.hour && s.wakeAlarm?.minute === DEFAULT_ALARM_SETTINGS.wakeAlarm.minute)) {
          const auto: AlarmSettings = { ...(s ?? DEFAULT_ALARM_SETTINGS), wakeAlarm: { enabled: false, hour: plan.wakeHour, minute: plan.wakeMin } };
          setSettings(auto); await store.setJSON(KEYS.alarmSettings, auto);
        }
      }
      if (s) {
        setSettings(prev => ({ ...DEFAULT_ALARM_SETTINGS, ...s, wakeAlarm: s.wakeAlarm ?? prev.wakeAlarm }));
        if (s.selectedMantraId) setSelectedMantraId(s.selectedMantraId);
        if (s.wakeAlarm?.enabled) scheduleNativeAlarm(s.wakeAlarm.hour, s.wakeAlarm.minute).catch(() => {});
      }
      const statuses: Record<string,'idle'|'downloading'|'downloaded'> = {};
      for (const m of MANTRAS) statuses[m.id] = (await isMantraDownloaded(m.id)) ? 'downloaded' : 'idle';
      setDlStatus(statuses);
      const currentId = s?.selectedMantraId ?? 'gayatri';
      if (statuses[currentId] === 'downloaded') setNativeAlarmSoundPath(getLocalMantraPath(currentId)).catch(() => {});
      const ms = await store.getJSON<MissionSettings>(KEYS.missionSettings);
      if (ms) setMissionSettings({ ...DEFAULT_MISSION_SETTINGS, ...ms });
      const entries = await store.getJSON<AlarmEntry[]>(KEYS.multiAlarms);
      if (entries) setAlarmEntries(entries);
      if (Platform.OS === 'android') {
        setTimeout(async () => {
          await requestAllAlarmPermissions();
          const [ea, bo, fs] = await Promise.all([checkAlarmPermission(), NativeModules.AlarmModule?.isBatteryOptimizationIgnored?.().catch(() => true) ?? Promise.resolve(true), NativeModules.AlarmModule?.checkFullScreenIntentPermission?.().catch(() => true) ?? Promise.resolve(true)]);
          const { status } = await (require('expo-notifications') as typeof import('expo-notifications')).getPermissionsAsync();
          setPermStatus({ notifications: status === 'granted', exactAlarm: !!ea, batteryOpt: !!bo, fullScreen: !!fs });
        }, 800);
      }
    })();
  }, []);

  const persistAndApply = async (updated: AlarmSettings) => {
    setSettings(updated); setSaving(true);
    try {
      await store.setJSON(KEYS.alarmSettings, updated);
      const hasPerm = await requestNotificationPermission();
      if (hasPerm) await rescheduleAllFromSettings(updated);
      if (updated.wakeAlarm.enabled) {
        setNativeAlarmSound(selectedMantraId).catch(() => {});
        const next = new Date();
        next.setHours(updated.wakeAlarm.hour, updated.wakeAlarm.minute, 0, 0);
        if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
        let scheduled = false;
        if (Platform.OS === 'android' && NativeModules.AlarmModule?.scheduleAlarm) {
          try { await NativeModules.AlarmModule.scheduleAlarm(next.getTime()); scheduled = true; } catch (e: any) { Alert.alert('Scheduling failed', e?.message ?? String(e)); }
        } else { await scheduleNativeAlarm(updated.wakeAlarm.hour, updated.wakeAlarm.minute); scheduled = true; }
        if (scheduled) {
          const h12 = next.getHours() === 0 ? 12 : next.getHours() > 12 ? next.getHours() - 12 : next.getHours();
          const ampm = next.getHours() >= 12 ? 'PM' : 'AM';
          const mm = String(next.getMinutes()).padStart(2, '0');
          (ToastAndroid as any)?.show?.(`🔔 Alarm set for ${h12}:${mm} ${ampm}${next.getDate() !== new Date().getDate() ? ' (tomorrow)' : ''}`, (ToastAndroid as any).LONG);
        }
        if (Platform.OS === 'android') {
          (async () => {
            try {
              await requestAllAlarmPermissions();
              const [ea, bo, fs] = await Promise.all([checkAlarmPermission(), NativeModules.AlarmModule?.isBatteryOptimizationIgnored?.().catch(() => true) ?? Promise.resolve(true), NativeModules.AlarmModule?.checkFullScreenIntentPermission?.().catch(() => true) ?? Promise.resolve(true)]);
              const { status } = await (require('expo-notifications') as typeof import('expo-notifications')).getPermissionsAsync();
              setPermStatus({ notifications: status === 'granted', exactAlarm: !!ea, batteryOpt: !!bo, fullScreen: !!fs });
            } catch {}
          })();
        }
      } else {
        await cancelNativeAlarm();
        (ToastAndroid as any)?.show?.('🔕 Alarm cancelled', (ToastAndroid as any).SHORT);
      }
      Animated.sequence([Animated.timing(saveAnim, { toValue: 1, duration: 200, useNativeDriver: true }), Animated.delay(800), Animated.timing(saveAnim, { toValue: 0, duration: 300, useNativeDriver: true })]).start();
    } catch {} finally { setSaving(false); }
  };

  const toggleWake  = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); persistAndApply({ ...settings, wakeAlarm: { ...settings.wakeAlarm, enabled: !settings.wakeAlarm.enabled } }); };
  const setWakeTime = (h: number, m: number) => persistAndApply({ ...settings, wakeAlarm: { enabled: true, hour: h, minute: m } });
  const applyPreset = (p: typeof PRESETS[0]) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); persistAndApply({ ...settings, wakeAlarm: { enabled: true, hour: p.hour, minute: p.minute } }); };
  const toggleBrahma = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); persistAndApply({ ...settings, brahmaReminder: !settings.brahmaReminder }); };

  const updateMission = async (patch: Partial<MissionSettings>) => { const u = { ...missionSettings, ...patch }; setMissionSettings(u); await store.setJSON(KEYS.missionSettings, u); };

  const chantMantra = (mantra: typeof MANTRAS[0], repeat = true) => {
    Speech.stop();
    Speech.speak(mantra.text, { language: 'en-IN', pitch: mantra.pitch, rate: mantra.rate, onDone: () => { if (repeat && alarmActiveRef.current) chantMantra(mantra, repeat); } });
  };

  const playAlarmSound = async (overrideType?: 'mantra'|'gayatri') => {
    const mantra = MANTRAS.find(m => m.id === selectedMantraId) ?? MANTRAS[0];
    alarmActiveRef.current = true; setAlarmModal(true);
    try {
      const lp = getLocalMantraPath(mantra.id);
      const info = await FileSystem.getInfoAsync(lp);
      if (info.exists) {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, shouldDuckAndroid: false, staysActiveInBackground: true });
        const { sound } = await Audio.Sound.createAsync({ uri: lp }, { shouldPlay: true, volume: 1.0, isLooping: true });
        (global as any).__alarmSound = sound; return;
      }
    } catch {}
    if (mantra.audioUrl) {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, shouldDuckAndroid: false, staysActiveInBackground: true });
        const { sound } = await Audio.Sound.createAsync({ uri: mantra.audioUrl }, { shouldPlay: true, volume: 1.0, isLooping: true });
        (global as any).__alarmSound = sound; return;
      } catch {}
    }
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, shouldDuckAndroid: false, staysActiveInBackground: true });
      const { sound } = await Audio.Sound.createAsync(require('../../assets/sounds/mantra_alarm.wav'), { shouldPlay: true, volume: 1.0, isLooping: true });
      (global as any).__alarmSound = sound;
    } catch { chantMantra(mantra, true); }
  };

  const stopAlarmSound = () => {
    alarmActiveRef.current = false; Speech.stop(); stopBodhi();
    try { const s = (global as any).__alarmSound; if (s) { s.stopAsync(); s.unloadAsync(); (global as any).__alarmSound = null; } } catch {}
    setAlarmModal(false); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const mantra = MANTRAS.find(m => m.id === selectedMantraId) ?? MANTRAS[0];
    setTimeout(() => speakBodhi(`Good morning. Your ${mantra.label} is complete. Begin your day with intention.`), 1500);
  };

  const handleMantraSelect = async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedMantraId(id);
    const upd = { ...settings, selectedMantraId: id }; setSettings(upd);
    store.setJSON(KEYS.alarmSettings, upd); setNativeAlarmSound(id).catch(() => {});
    updateMission({ wakeSound: MANTRA_TO_WAKE_SOUND[id] ?? 'gayatri' });
    if (BUNDLED_MANTRAS.has(id)) { setDlStatus(s => ({ ...s, [id]: 'downloaded' })); return; }
    if (dlStatus[id] === 'downloaded') { setNativeAlarmSoundPath(getLocalMantraPath(id)).catch(() => {}); return; }
    if (dlStatus[id] === 'downloading') return;
    const m = MANTRAS.find(x => x.id === id);
    if (!m?.audioUrl) return;
    setDlStatus(s => ({ ...s, [id]: 'downloading' })); setDlProgress(s => ({ ...s, [id]: 0 }));
    const result = await downloadMantra(id, m.audioUrl, p => setDlProgress(s => ({ ...s, [id]: p })));
    setDlStatus(s => ({ ...s, [id]: result ? 'downloaded' : 'idle' }));
    if (result && id === selectedMantraId) setNativeAlarmSoundPath(result).catch(() => {});
  };

  const fireTestNotification = async () => {
    const granted = await requestNotificationPermission();
    if (!granted) { Alert.alert('Enable notifications in Settings first'); return; }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setNativeAlarmSound(selectedMantraId).catch(() => {});
    if (Platform.OS === 'android') {
      if (!NativeModules.AlarmModule?.scheduleAlarm) { playAlarmSound('mantra'); return; }
      try { await NativeModules.AlarmModule.scheduleAlarm(Date.now() + 5000); Alert.alert('🔔 Test alarm (5 sec)', 'Lock your screen now — alarm should break through.'); } catch (e: any) { Alert.alert('Failed', e?.message ?? String(e)); }
    } else { playAlarmSound('mantra'); }
  };

  const scheduleEntryNotif = async (entry: AlarmEntry) => {
    if (!entry.enabled) return;
    const title = entry.type === 'habit' ? `${entry.habitEmoji ?? '🌿'} ${entry.label}` : `⚡ ${entry.label || 'Quick Alarm'}`;
    const next = new Date(); next.setHours(entry.hour, entry.minute, 0, 0);
    if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);

    if (Platform.OS === 'android') {
      const HabitAlarmNative = NativeModules.HabitAlarmModule;
      if (HabitAlarmNative?.scheduleHabitAlarm) {
        try {
          const cfg = await store.getJSON<{ selectedMantraId?: string }>(KEYS.alarmSettings);
          const mantraId = cfg?.selectedMantraId ?? 'gayatri';
          const lp = getLocalMantraPath(mantraId);
          const info = await FileSystem.getInfoAsync(lp).catch(() => ({ exists: false }));
          const mantraPath = (info as any).exists ? lp.replace('file://', '') : '';
          await HabitAlarmNative.scheduleHabitAlarm(
            next.getTime(),
            entry.habitKey ?? entry.id,
            entry.habitEmoji ?? (entry.type === 'quick' ? '⚡' : '🌿'),
            entry.label,
            entry.type,
            mantraPath,
            entry.id,
          );
          return;
        } catch (e) { console.warn('[HabitAlarm] Native schedule failed, trying notifee:', e); }
      }
      try {
        await notifee.createChannel({ id: 'arise-habit-alarms', name: 'SolRize Habit Alarms', importance: AndroidImportance.HIGH, sound: 'mantra_alarm', vibration: true, bypassDnd: true, visibility: AndroidVisibility.PUBLIC } as any);
        await notifee.createTriggerNotification(
          { id: `habit-${entry.id}`, title, body: entry.type === 'habit' ? 'Time for your habit! Tap to confirm. 🙏' : 'Your alarm is ringing! Tap to dismiss. ⏰', android: { channelId: 'arise-habit-alarms', importance: AndroidImportance.HIGH, category: AndroidCategory.ALARM, visibility: AndroidVisibility.PUBLIC, fullScreenAction: { id: 'default', launchActivity: 'default' }, pressAction: { id: 'default', launchActivity: 'default' }, asForegroundService: true, ongoing: true, autoCancel: false, loopSound: true, foregroundServiceTypes: [AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK] } as any, data: { type: 'habit-alarm', alarmId: entry.id, habitKey: entry.habitKey ?? entry.id, habitEmoji: entry.habitEmoji ?? (entry.type === 'quick' ? '⚡' : '🌿'), label: entry.label, alarmType: entry.type } },
          { type: TriggerType.TIMESTAMP, timestamp: next.getTime(), repeatFrequency: RepeatFrequency.DAILY, alarmManager: { type: AlarmType.SET_ALARM_CLOCK, allowWhileIdle: true } } as any,
        ); return;
      } catch (e) { console.warn('[HabitAlarm] notifee fallback also failed:', e); }
    }
    await Notifications.scheduleNotificationAsync({
      identifier: `alarm-${entry.id}`,
      content: { title, body: entry.type === 'habit' ? 'Time for your habit. 🙏' : 'Your alarm is ringing!', sound: 'mantra_alarm.wav', data: { type: entry.type === 'habit' ? 'habit-alarm' : 'quick-alarm', alarmId: entry.id, habitKey: entry.habitKey ?? entry.id, habitEmoji: entry.habitEmoji ?? '', label: entry.label } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: entry.hour, minute: entry.minute },
    });
  };
  const cancelEntryNotif = async (id: string) => {
    if (Platform.OS === 'android') {
      try { await NativeModules.HabitAlarmModule?.cancelHabitAlarm?.(id); } catch { /* ignore */ }
    }
    await Notifications.cancelScheduledNotificationAsync(`alarm-${id}`).catch(() => {});
    await notifee.cancelTriggerNotification(`habit-${id}`).catch(() => {});
    await notifee.cancelNotification(`habit-${id}`).catch(() => {});
  };
  const saveEntries  = async (entries: AlarmEntry[]) => { setAlarmEntries(entries); await store.setJSON(KEYS.multiAlarms, entries); };
  const toggleEntry  = async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = alarmEntries.map(e => e.id === id ? { ...e, enabled: !e.enabled } : e);
    const entry = updated.find(e => e.id === id);
    if (entry) { if (entry.enabled) await scheduleEntryNotif(entry); else await cancelEntryNotif(id); }
    await saveEntries(updated);
  };
  const deleteEntry  = (id: string) => Alert.alert('Remove alarm?', '', [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: async () => { await cancelEntryNotif(id); await saveEntries(alarmEntries.filter(e => e.id !== id)); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } }]);
  const saveNewEntry = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const type = addType ?? editEntry?.type ?? 'habit';
    const id   = editEntry?.id ?? Date.now().toString();
    const habitInfo = type === 'habit' ? AYU_HABITS.find(h => h.key === formHabitKey) : undefined;
    const label = formLabel.trim() || habitInfo?.label || (type === 'quick' ? 'Quick Alarm' : 'Habit Alarm');
    const entry: AlarmEntry = { id, type, hour: formHour, minute: formMinute, label, enabled: true, habitKey: type === 'habit' ? formHabitKey : undefined, habitEmoji: type === 'habit' ? (formHabitEmoji || habitInfo?.emoji) : undefined, days: formDays.length > 0 ? formDays : undefined };
    const updated = editEntry ? alarmEntries.map(e => e.id === id ? entry : e) : [...alarmEntries, entry];
    await scheduleEntryNotif(entry); await saveEntries(updated);
    setAddType(null); setEditEntry(null); setFormLabel(''); setFormDays([]); setShowCustomHabitInput(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };
  const openAddModal  = (type: 'habit'|'quick') => { setFormHour(type === 'habit' ? 7 : new Date().getHours()); setFormMinute(0); setFormLabel(''); setFormHabitKey(type === 'habit' ? '' : 'meditation'); setFormHabitEmoji(type === 'habit' ? '' : '🧘'); setFormDays([]); setShowCustomHabitInput(false); setEditEntry(null); setAddType(type); };
  const openEditEntry = (entry: AlarmEntry) => { setFormHour(entry.hour); setFormMinute(entry.minute); setFormLabel(entry.label); setFormHabitKey(entry.habitKey ?? 'custom'); setFormHabitEmoji(entry.habitEmoji ?? '✨'); setFormDays(entry.days ?? []); setShowCustomHabitInput(entry.habitKey === 'custom'); setEditEntry(entry); setAddType(null); };

  const playingMantra = MANTRAS.find(m => m.id === selectedMantraId) ?? MANTRAS[0];
  const allPermsOk    = permStatus.notifications && permStatus.exactAlarm && permStatus.batteryOpt && permStatus.fullScreen;
  const now           = liveClock.getHours() * 60 + liveClock.getMinutes();
  const candidates: number[] = [];
  if (settings.wakeAlarm.enabled) { const w = settings.wakeAlarm.hour * 60 + settings.wakeAlarm.minute; candidates.push(w > now ? w - now : w + 1440 - now); }
  alarmEntries.filter(e => e.enabled).forEach(e => { const t = e.hour * 60 + e.minute; candidates.push(t > now ? t - now : t + 1440 - now); });
  const nextLabel = candidates.length ? (() => { const diff = Math.min(...candidates); const hrs = Math.floor(diff / 60); const mins = diff % 60; return hrs > 0 ? `${hrs} hr ${mins} min` : `${mins} min`; })() : '';

  const dateStr = liveClock.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const bgH = liveClock.getHours() + liveClock.getMinutes() / 60;
  const timeBgKey = getTimedBgKey(bgH, solarTimes);
  const isLightBg = timeBgKey === 'morning' || timeBgKey === 'midday' || timeBgKey === 'afternoon';
  const isGoldenBg = timeBgKey === 'sunrise' || timeBgKey === 'sandhya' || timeBgKey === 'predawn' || timeBgKey === 'twilight';
  const scrimColors: [string,string,string] = isLightBg ? ['rgba(0,4,18,0.58)','rgba(0,4,18,0.24)','rgba(0,4,18,0.62)'] : isGoldenBg ? ['rgba(0,0,0,0.46)','rgba(0,0,0,0.16)','rgba(0,0,0,0.50)'] : ['rgba(2,2,16,0.36)','rgba(2,2,16,0.12)','rgba(2,2,16,0.40)'];
  const headerGradColors: [string,string] = isLightBg ? ['rgba(0,5,22,0.84)','rgba(0,5,22,0.10)'] : isGoldenBg ? ['rgba(0,0,0,0.72)','rgba(0,0,0,0.06)'] : ['rgba(2,2,24,0.72)','rgba(2,2,24,0.05)'];

  return (
    <ImageBackground source={bgUri ? { uri: bgUri } : undefined} style={S.screen} imageStyle={{ opacity: 0.88 }}>
      <LinearGradient colors={scrimColors} style={StyleSheet.absoluteFillObject} pointerEvents="none" />
      <LinearGradient colors={headerGradColors} style={S.headerGrad}>
        <SafeAreaView edges={['top']}>
          <View style={S.headerTop}>
            <Text style={S.appName}>⏰  Alarms</Text>
            <Animated.View style={{ opacity: saveAnim }}><Text style={{ color: '#10b981', fontSize: 10, fontWeight: '800' }}>✓ SAVED</Text></Animated.View>
          </View>
          <View style={S.headerCountdownRow}>
            {nextLabel ? (
              <View style={[S.countdownBanner, { overflow: 'hidden' }]}>
                <GlassPulseOverlay />
                <View style={S.countdownDot} />
                <Text style={S.countdownTxt}>Next alarm in  {nextLabel}</Text>
                <Text style={S.countdownChevron}>›</Text>
              </View>
            ) : (
              <View style={S.countdownBannerOff}>
                <Text style={S.countdownOffTxt}>No alarms active  🔕</Text>
              </View>
            )}
            <Text style={S.headerDateSmall}>{dateStr}</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {Platform.OS === 'android' && !allPermsOk && (
        <TouchableOpacity style={S.permsBanner} onPress={async () => {
          await requestAllAlarmPermissions();
          const [ea, bo, fs] = await Promise.all([checkAlarmPermission(), NativeModules.AlarmModule?.isBatteryOptimizationIgnored?.().catch(() => true) ?? Promise.resolve(true), NativeModules.AlarmModule?.checkFullScreenIntentPermission?.().catch(() => true) ?? Promise.resolve(true)]);
          const { status } = await (require('expo-notifications') as typeof import('expo-notifications')).getPermissionsAsync();
          setPermStatus({ notifications: status === 'granted', exactAlarm: !!ea, batteryOpt: !!bo, fullScreen: !!fs });
        }} activeOpacity={0.8}>
          <Text style={S.permsText}>⚠️  Alarm permissions needed — Tap to fix</Text>
          <Text style={S.permsChevron}>→</Text>
        </TouchableOpacity>
      )}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120, paddingTop: 2 }} showsVerticalScrollIndicator={false}>
        {/* Morning Wake-Up Alarm Card */}
        <View style={S.sectionHeaderRow}>
          <Text style={S.sectionHeaderTxt}>🌅  MORNING WAKE-UP</Text>
          <View style={S.sectionHeaderLine} />
        </View>
        <View style={[S.alarmCard, settings.wakeAlarm.enabled && S.alarmCardActive]}>
          <LinearGradient colors={[ACCENT + '28', 'rgba(4,4,18,0.45)', 'rgba(2,2,14,0.68)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFillObject} />
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.72)' }} />
          <GlassPulseOverlay />
          <View style={[S.alarmAccentBar, { backgroundColor: settings.wakeAlarm.enabled ? ACCENT : '#FFFFFF18' }]} />
          <TouchableOpacity onPress={() => setShowWakeEdit(true)} activeOpacity={0.85} style={{ flex: 1 }}>
            <View style={S.alarmCardInner}>
              <View style={S.alarmLeft}>
                <View style={S.alarmTypePill}>
                  <Text style={S.alarmTypeEmoji}>🌅</Text>
                  <Text style={S.alarmTypeTxt}>MORNING WAKE-UP</Text>
                  {missionSettings.lockInMode && <Text style={{ fontSize: 9, color: '#ef4444' }}>🔒</Text>}
                </View>
                <Text style={[S.alarmTime, settings.wakeAlarm.enabled ? S.alarmTimeOn : S.alarmTimeOff]}>
                  {fmt12(settings.wakeAlarm.hour, settings.wakeAlarm.minute)}
                </Text>
                <Text style={S.alarmSub}>{playingMantra.emoji} {playingMantra.label}  ·  {MISSIONS.find(ms => ms.id === missionSettings.selectedMission)?.name ?? 'Mission'}</Text>
                <DayDots days={undefined} color={ACCENT} />
              </View>
              <Toggle value={settings.wakeAlarm.enabled} onToggle={toggleWake} color={ACCENT} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Habit + Quick Alarm Cards */}
        {alarmEntries.map(entry => {
          const isMenuOpen = menuOpenId === entry.id;
          const cardColor  = entry.type === 'habit' ? '#10b981' : '#f97316';
          return (
            <View key={entry.id} style={[S.alarmCard, entry.enabled && (entry.type === 'habit' ? S.alarmCardHabit : S.alarmCardQuick)]}>
              <LinearGradient colors={[cardColor + '28', 'rgba(4,4,18,0.45)', 'rgba(2,2,14,0.68)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFillObject} />
              <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.72)' }} />
              <GlassPulseOverlay />
              <View style={[S.alarmAccentBar, { backgroundColor: entry.enabled ? cardColor : '#FFFFFF18' }]} />
              <View style={{ flex: 1 }}>
                <View style={S.alarmCardInner}>
                  <TouchableOpacity style={S.alarmLeft} onPress={() => { setMenuOpenId(null); openEditEntry(entry); }} activeOpacity={0.85}>
                    <View style={S.alarmTypePill}>
                      <Text style={S.alarmTypeEmoji}>{entry.type === 'habit' ? (entry.habitEmoji ?? '🌿') : '⚡'}</Text>
                      <Text style={S.alarmTypeTxt}>{entry.type === 'habit' ? 'HABIT ALARM' : 'QUICK ALARM'}</Text>
                    </View>
                    <Text style={[S.alarmTime, entry.enabled ? (entry.type === 'habit' ? S.alarmTimeHabit : S.alarmTimeQuick) : S.alarmTimeOff]}>
                      {fmt12(entry.hour, entry.minute)}
                    </Text>
                    <Text style={S.alarmSub}>{entry.label}</Text>
                    <DayDots days={entry.days} color={cardColor} />
                  </TouchableOpacity>
                  <View style={{ alignItems: 'flex-end', gap: 8 }}>
                    <TouchableOpacity onPress={() => setMenuOpenId(isMenuOpen ? null : entry.id)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={S.kebabBtn}>
                      <View style={S.kebabDot} /><View style={S.kebabDot} /><View style={S.kebabDot} />
                    </TouchableOpacity>
                    <Toggle value={entry.enabled} onToggle={() => { setMenuOpenId(null); toggleEntry(entry.id); }} color={cardColor} />
                  </View>
                </View>
                {isMenuOpen && (
                  <View style={S.cardMenu}>
                    <TouchableOpacity style={S.cardMenuItem} onPress={() => { setMenuOpenId(null); openEditEntry(entry); }}><Text style={S.cardMenuTxt}>✎  Edit alarm</Text></TouchableOpacity>
                    <View style={{ height: 1, backgroundColor: '#FFFFFF08' }} />
                    <TouchableOpacity style={S.cardMenuItem} onPress={() => { setMenuOpenId(null); deleteEntry(entry.id); }}><Text style={[S.cardMenuTxt, { color: '#f43f5e' }]}>🗑  Delete alarm</Text></TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          );
        })}

        {alarmEntries.length === 0 && (
          <View style={S.emptyHint}>
            <Text style={S.emptyIcon}>＋</Text>
            <Text style={S.emptyTxt}>Add habit or quick alarms</Text>
            <Text style={{ color: '#FFFFFF15', fontSize: 11 }}>Tap the + button below</Text>
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      {fabOpen && <TouchableOpacity style={S.fabBackdrop} onPress={() => setFabOpen(false)} activeOpacity={1} />}
      {fabOpen && (
        <View style={S.fabMenu}>
          {([
            { label: '⏰  Alarm',  color: ACCENT,    onPress: () => { setFabOpen(false); setShowWakeEdit(true); } },
            { label: '🌿  Habit Alarm', color: '#10b981', onPress: () => { setFabOpen(false); openAddModal('habit'); } },
            { label: '⚡  Quick Alarm', color: '#f97316', onPress: () => { setFabOpen(false); openAddModal('quick'); } },
          ] as const).map((item, i) => (
            <TouchableOpacity key={i} style={[S.fabMenuItem, { borderColor: item.color + '50' }]} onPress={item.onPress} activeOpacity={0.85}>
              <Text style={[S.fabMenuItemTxt, { color: item.color }]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      <TouchableOpacity style={[S.fab, fabOpen && S.fabOpen]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setFabOpen(v => !v); }} activeOpacity={0.85}>
        <Text style={S.fabTxt}>{fabOpen ? '✕' : '+'}</Text>
      </TouchableOpacity>

      {/* Wake Alarm Edit Modal */}
      <Modal visible={showWakeEdit} animationType="slide" transparent onRequestClose={() => setShowWakeEdit(false)}>
        <View style={S.sheetOverlay}>
          <View style={S.sheet}>
            <View style={S.sheetHandle} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={S.sheetTitle}>🌅  Morning Wake-Up Alarm</Text>
              <Text style={{ fontSize: 10, color: '#FFFFFF35', fontWeight: '700', letterSpacing: 1, marginBottom: 8 }}>DEFAULT: 4:00 AM  ·  BRAHMA MUHURTA</Text>
              <TimeAdjuster hour={settings.wakeAlarm.hour} minute={settings.wakeAlarm.minute} onChange={setWakeTime} />
              {prakritiWake && (
                <TouchableOpacity style={[S.prakritiRow, { borderColor: prakritiWake.color + '50' }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); persistAndApply({ ...settings, wakeAlarm: { enabled: true, hour: prakritiWake.hour, minute: prakritiWake.minute } }); }}>
                  <Text style={{ fontSize: 16 }}>🌿</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 9, fontWeight: '900', color: prakritiWake.color, letterSpacing: 1 }}>YOUR RHYTHM PLAN</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.text }}>{prakritiWake.label}</Text>
                  </View>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: prakritiWake.color }}>{settings.wakeAlarm.hour === prakritiWake.hour && settings.wakeAlarm.minute === prakritiWake.minute ? '✓ SET' : 'Apply →'}</Text>
                </TouchableOpacity>
              )}
              <Text style={S.sheetSection}>QUICK PRESETS</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                {PRESETS.map(p => { const active = settings.wakeAlarm.hour === p.hour && settings.wakeAlarm.minute === p.minute; return (
                  <TouchableOpacity key={p.label} onPress={() => applyPreset(p)} style={[S.presetChip, active && { borderColor: p.color, backgroundColor: p.color + '18' }]}>
                    <Text style={[S.presetChipTime, { color: active ? p.color : Colors.textDim }]}>{p.sub}</Text>
                    <Text style={S.presetChipLabel}>{p.label}</Text>
                  </TouchableOpacity>
                ); })}
              </View>
              <Text style={S.sheetSection}>ALARM SOUND</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 2 }}>
                  {MANTRAS.map(mn => { const active = selectedMantraId === mn.id; return (
                    <TouchableOpacity key={mn.id} onPress={() => handleMantraSelect(mn.id)} style={[S.mantraChip, active && { borderColor: mn.color, backgroundColor: mn.color + '18' }]}>
                      <Text style={{ fontSize: 24 }}>{mn.emoji}</Text>
                      <Text style={{ color: active ? mn.color : Colors.text, fontSize: 10, fontWeight: '800', textAlign: 'center' }}>{mn.label}</Text>
                      <Text style={{ color: mn.color + '80', fontSize: 7, textAlign: 'center' }}>{mn.hint}</Text>
                      <Text style={{ color: dlStatus[mn.id] === 'downloaded' ? '#10b981' : dlStatus[mn.id] === 'downloading' ? mn.color : Colors.textDim, fontSize: 7, fontWeight: '800', textAlign: 'center' }}>
                        {BUNDLED_MANTRAS.has(mn.id) ? '✓ Bundled' : dlStatus[mn.id] === 'downloaded' ? '✓ Offline' : dlStatus[mn.id] === 'downloading' ? `⬇ ${Math.round((dlProgress[mn.id] ?? 0) * 100)}%` : '☁ Online'}
                      </Text>
                    </TouchableOpacity>
                  ); })}
                </View>
              </ScrollView>
              <Text style={S.sheetSection}>MORNING MISSION  (alarm won't stop until done)</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {MISSIONS.map(ms => { const active = missionSettings.selectedMission === ms.id; return (
                  <TouchableOpacity key={ms.id} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); updateMission({ selectedMission: ms.id }); }} style={[S.missionChip, { borderColor: active ? ms.color : '#FFFFFF12', backgroundColor: active ? ms.color + '15' : '#FFFFFF05' }]}>
                    <Text style={{ fontSize: 22 }}>{ms.icon}</Text>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: active ? ms.color : Colors.textMuted, textAlign: 'center' }}>{ms.name}</Text>
                    {active && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ms.color }} />}
                  </TouchableOpacity>
                ); })}
              </View>
              <Text style={S.sheetSection}>SYSTEM</Text>
              <View style={S.settingsCard}>
                {([
                  { emoji: '🔒', label: 'Lock In Mode',   sub: "Alarm won't stop until mission done",        val: missionSettings.lockInMode,        onToggle: () => updateMission({ lockInMode: !missionSettings.lockInMode }),                    color: '#ef4444' },
                  { emoji: '🤖', label: 'Morning Brief',  sub: 'AI speaks your personalized morning brief',  val: missionSettings.bodhiMorningBrief, onToggle: () => updateMission({ bodhiMorningBrief: !missionSettings.bodhiMorningBrief }),    color: '#a78bfa' },
                  { emoji: '⏰', label: 'Dawn Alert',      sub: '15 min reminder before your wake alarm',    val: settings.brahmaReminder,           onToggle: toggleBrahma,       color: '#c084fc' },
                ] as const).map((row, i) => (
                  <View key={row.label} style={[S.settingsRow, i > 0 && { borderTopWidth: 1, borderTopColor: '#FFFFFF0C' }]}>
                    <Text style={{ fontSize: 18 }}>{row.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: Colors.text }}>{row.label}</Text>
                      <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 2 }}>{row.sub}</Text>
                    </View>
                    <Toggle value={row.val} onToggle={row.onToggle} color={row.color} />
                  </View>
                ))}
              </View>
              {missionSettings.streak > 0 && (
                <LinearGradient colors={[ACCENT + '18', ACCENT + '08']} style={S.streakBanner}>
                  <Text style={{ fontSize: 26 }}>🔥</Text>
                  <View>
                    <Text style={{ color: ACCENT, fontWeight: '900', fontSize: 15 }}>Day {missionSettings.streak} Streak</Text>
                    <Text style={{ color: Colors.textMuted, fontSize: 11 }}>Every. Single. Day.</Text>
                  </View>
                </LinearGradient>
              )}
              <TouchableOpacity onPress={() => setShowWakeEdit(false)} style={S.sheetDoneBtn}>
                <Text style={S.sheetDoneTxt}>Done</Text>
              </TouchableOpacity>
              <View style={{ height: 48 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Habit Alarm Modal — full screen */}
      <Modal visible={addType === 'habit' || editEntry?.type === 'habit'} animationType="slide" transparent={false} onRequestClose={() => { setAddType(null); setEditEntry(null); }}>
        <View style={{ flex: 1, backgroundColor: '#0C0C1C' }}>

          {/* ── Header ── */}
          <SafeAreaView edges={['top']} style={{ backgroundColor: '#0C0C1C' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 10, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#FFFFFF0C' }}>
              <TouchableOpacity onPress={() => { setAddType(null); setEditEntry(null); }} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFFFFF0E', alignItems: 'center', justifyContent: 'center', marginRight: 14 }} activeOpacity={0.7}>
                <Text style={{ fontSize: 16, color: '#FFFFFF80', fontWeight: '600' }}>✕</Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 18, fontWeight: '900', color: '#fff', letterSpacing: 0.2 }}>🌿  Habit Alarm</Text>
                <Text style={{ fontSize: 11, color: '#FFFFFF40', marginTop: 2 }}>
                  {formHabitKey && formHabitKey !== 'custom'
                    ? `${AYU_HABITS.find(h => h.key === formHabitKey)?.emoji ?? ''} ${AYU_HABITS.find(h => h.key === formHabitKey)?.label ?? ''} selected`
                    : 'Select a habit below'}
                </Text>
              </View>
              {formHabitKey !== '' && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#10b98118', borderWidth: 1, borderColor: '#10b98140', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' }} />
                  <Text style={{ fontSize: 10, fontWeight: '900', color: '#10b981' }}>READY</Text>
                </View>
              )}
            </View>
          </SafeAreaView>

          {/* ── Habit Grid (scrollable) ── */}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 8 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={S.sheetSection}>CHOOSE HABIT</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {AYU_HABITS.filter(h => h.key !== 'custom').map(h => {
                const active = formHabitKey === h.key;
                return (
                  <TouchableOpacity key={h.key} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setFormHabitKey(h.key); setFormHabitEmoji(h.emoji); setFormLabel(h.label); setShowCustomHabitInput(false); }} style={[S.habitChip, active && { borderColor: '#10b981', backgroundColor: '#10b98122', transform: [{ scale: 1.06 }] }]} activeOpacity={0.75}>
                    <Text style={{ fontSize: 24 }}>{h.emoji}</Text>
                    <Text style={{ fontSize: 9, fontWeight: '700', color: active ? '#10b981' : Colors.textDim, textAlign: 'center', lineHeight: 13 }}>{h.label}</Text>
                    {active && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981', marginTop: 2 }} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Custom habit row */}
            <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setFormHabitKey('custom'); setFormHabitEmoji('✨'); setShowCustomHabitInput(true); setFormLabel(''); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 10, borderColor: formHabitKey === 'custom' ? '#a78bfa' : '#FFFFFF14', backgroundColor: formHabitKey === 'custom' ? '#a78bfa14' : '#FFFFFF04' }} activeOpacity={0.8}>
              <Text style={{ fontSize: 22 }}>✨</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: formHabitKey === 'custom' ? '#a78bfa' : '#fff' }}>Custom Habit</Text>
                <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 1 }}>Type any habit name</Text>
              </View>
              {formHabitKey === 'custom' && <Text style={{ fontSize: 14, color: '#a78bfa', fontWeight: '900' }}>✓</Text>}
            </TouchableOpacity>
            {showCustomHabitInput && (
              <TextInput style={[S.customInput, { marginBottom: 10 }]} placeholder="Custom habit name..." placeholderTextColor={Colors.textDim} value={formLabel} onChangeText={setFormLabel} autoFocus />
            )}

            {/* Shower wisdom tip */}
            {formHabitKey === 'shower' && (
              <View style={{ borderRadius: 14, borderWidth: 1, borderColor: '#38bdf840', backgroundColor: '#0ea5e910', padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                <Text style={{ fontSize: 20, marginTop: 1 }}>🌊</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 9, fontWeight: '900', color: '#38bdf8', letterSpacing: 1, marginBottom: 3 }}>BATHING WISDOM</Text>
                  <Text style={{ fontSize: 11, color: '#e0f2fe', lineHeight: 17, fontWeight: '500' }}>Open-air bathing with natural water strengthens the skin, sharpens the senses and activates prana.</Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* ── Fixed Bottom: Time + Days + Save ── */}
          <View style={{ backgroundColor: '#0E0E20', borderTopWidth: 1, borderTopColor: '#FFFFFF10', paddingHorizontal: 16, paddingTop: 14, paddingBottom: insets.bottom + 16 }}>
            {/* Selected habit pill */}
            {formHabitKey !== '' && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Text style={{ fontSize: 18 }}>
                  {formHabitKey === 'custom' ? '✨' : AYU_HABITS.find(h => h.key === formHabitKey)?.emoji ?? '🌿'}
                </Text>
                <Text style={{ fontSize: 12, fontWeight: '800', color: '#10b981', flex: 1 }}>
                  {formHabitKey === 'custom' ? (formLabel || 'Custom Habit') : AYU_HABITS.find(h => h.key === formHabitKey)?.label ?? ''}
                </Text>
                <Text style={{ fontSize: 9, color: '#FFFFFF30', fontWeight: '700', letterSpacing: 1 }}>SET TIME  ↓</Text>
              </View>
            )}

            {/* Time picker */}
            <Text style={[S.sheetSection, { marginTop: 0, marginBottom: 2, marginHorizontal: 0 }]}>SET TIME</Text>
            <TimeAdjuster hour={formHour} minute={formMinute} onChange={(hr, mn) => { setFormHour(hr); setFormMinute(mn); }} />

            {/* Day selector */}
            <Text style={[S.sheetSection, { marginTop: 8, marginBottom: 6, marginHorizontal: 0 }]}>REPEAT DAYS</Text>
            <DaySelector days={formDays} onChange={setFormDays} />

            {/* Save button */}
            <TouchableOpacity
              onPress={saveNewEntry}
              disabled={formHabitKey === ''}
              style={[S.saveBtn, { marginTop: 10, opacity: formHabitKey === '' ? 0.4 : 1 }]}
              activeOpacity={0.8}>
              <Text style={S.saveBtnTxt}>
                {editEntry ? '✓  Update Habit Alarm' : '✓  Save Habit Alarm'}
              </Text>
            </TouchableOpacity>
          </View>

        </View>
      </Modal>

      {/* Quick Alarm Modal */}
      <Modal visible={addType === 'quick' || editEntry?.type === 'quick'} animationType="slide" transparent onRequestClose={() => { setAddType(null); setEditEntry(null); }}>
        <View style={S.sheetOverlay}>
          <View style={S.sheet}>
            <View style={S.sheetHandle} />
            <Text style={S.sheetTitle}>⚡  Quick Alarm</Text>
            <Text style={{ color: Colors.textMuted, fontSize: 12, marginBottom: 12 }}>Rings once — tap stop to dismiss.</Text>
            <TimeAdjuster hour={formHour} minute={formMinute} onChange={(hr, mn) => { setFormHour(hr); setFormMinute(mn); }} />
            <Text style={S.sheetSection}>REPEAT DAYS</Text>
            <DaySelector days={formDays} onChange={setFormDays} />
            <Text style={S.sheetSection}>LABEL (optional)</Text>
            <TextInput style={S.customInput} placeholder="e.g. Medicine, Meeting, Workout..." placeholderTextColor={Colors.textDim} value={formLabel} onChangeText={setFormLabel} />
            <TouchableOpacity onPress={saveNewEntry} style={[S.saveBtn, { marginTop: 16 }]}>
              <Text style={S.saveBtnTxt}>{editEntry ? '✓ Update Quick Alarm' : '✓ Save Quick Alarm'}</Text>
            </TouchableOpacity>
            <View style={{ height: 48 }} />
          </View>
        </View>
      </Modal>

    </ImageBackground>
  );
}

const S = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#060610', overflow: 'hidden' },
  headerGrad: { paddingBottom: 8 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 6, paddingBottom: 8 },
  appName: { fontSize: 15, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },
  headerCountdownRow: { paddingHorizontal: 16, paddingBottom: 6, gap: 6 },
  headerDateSmall: { fontSize: 11, color: '#FFFFFF35', fontWeight: '500', paddingHorizontal: 4 },
  countdownBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: ACCENT + '14', borderWidth: 1, borderColor: ACCENT + '35', borderRadius: 99, paddingHorizontal: 16, paddingVertical: 10, alignSelf: 'flex-start' },
  countdownBannerOff: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF08', borderWidth: 1, borderColor: '#FFFFFF12', borderRadius: 99, paddingHorizontal: 16, paddingVertical: 10, alignSelf: 'flex-start' },
  countdownDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: ACCENT },
  countdownTxt: { fontSize: 13, fontWeight: '700', color: '#fdba74' },
  countdownChevron: { fontSize: 18, color: ACCENT, fontWeight: '300', lineHeight: 20 },
  countdownOffTxt: { fontSize: 12, color: '#FFFFFF25', fontWeight: '500' },
  permsBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9731610', borderBottomWidth: 1, borderBottomColor: '#f9731625', paddingHorizontal: 16, paddingVertical: 10 },
  permsText: { flex: 1, color: '#f97316', fontSize: 11, fontWeight: '700' },
  permsChevron: { color: '#f97316', fontSize: 14, fontWeight: '900' },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 6, marginBottom: 0, gap: 10 },
  sectionHeaderTxt: { fontSize: 9, fontWeight: '900', color: '#FFFFFFB8', letterSpacing: 2.0 },
  sectionHeaderLine: { flex: 1, height: 1, backgroundColor: '#FFFFFF22' },
  alarmCard: { marginHorizontal: 16, marginTop: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.60)', backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden', flexDirection: 'row', elevation: 14, shadowColor: '#000', shadowOpacity: 0.40, shadowRadius: 24, shadowOffset: { width: 0, height: 10 } },
  alarmCardActive: { borderColor: ACCENT + '99', backgroundColor: 'rgba(255,255,255,0.10)', shadowColor: ACCENT, shadowOpacity: 0.44, shadowRadius: 26, elevation: 16 },
  alarmCardHabit: { borderColor: 'rgba(16,185,129,0.65)', backgroundColor: 'rgba(255,255,255,0.08)', shadowColor: '#10b981', shadowOpacity: 0.38, shadowRadius: 22, elevation: 14 },
  alarmCardQuick: { borderColor: 'rgba(249,115,22,0.65)', backgroundColor: 'rgba(255,255,255,0.08)', shadowColor: '#f97316', shadowOpacity: 0.38, shadowRadius: 22, elevation: 14 },
  alarmCardInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 13, paddingLeft: 12, gap: 12 },
  alarmAccentBar: { width: 4, alignSelf: 'stretch' },
  alarmLeft: { flex: 1, gap: 2 },
  alarmTypePill: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
  alarmTypeEmoji: { fontSize: 12 },
  alarmTypeTxt: { fontSize: 9, fontWeight: '900', color: '#FFFFFFAA', letterSpacing: 1.5 },
  alarmTime: { fontSize: 36, letterSpacing: -2, lineHeight: 40, fontWeight: '300' },
  alarmTimeOn: { color: '#FFFFFF' },
  alarmTimeOff: { color: '#FFFFFF50' },
  alarmTimeHabit: { color: '#4ade80' },
  alarmTimeQuick: { color: '#fb923c' },
  alarmSub: { fontSize: 11, color: '#FFFFFFAA', fontWeight: '600', marginTop: 1 },
  emptyHint: { marginHorizontal: 16, marginTop: 32, alignItems: 'center', gap: 8, paddingVertical: 44, borderRadius: 22, borderWidth: 1, borderColor: '#FFFFFF06', borderStyle: 'dashed' },
  emptyIcon: { fontSize: 40, color: '#FFFFFF10' },
  emptyTxt: { fontSize: 13, color: '#FFFFFF22', fontWeight: '500' },
  fab: { position: 'absolute', bottom: 90, right: 24, width: 60, height: 60, borderRadius: 30, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center', elevation: 10, shadowColor: ACCENT, shadowOpacity: 0.6, shadowRadius: 16 },
  fabOpen: { backgroundColor: '#c05e00' },
  fabTxt: { fontSize: 30, color: '#fff', fontWeight: '200', lineHeight: 36, marginTop: 2 },
  fabBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9 },
  fabMenu: { position: 'absolute', bottom: 162, right: 24, gap: 8, alignItems: 'flex-end', zIndex: 10 },
  fabMenuItem: { backgroundColor: '#0D0D20', borderWidth: 1, borderRadius: 16, paddingHorizontal: 20, paddingVertical: 13, elevation: 6 },
  fabMenuItemTxt: { fontSize: 14, fontWeight: '800' },
  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000075' },
  sheet: { backgroundColor: '#0D0D20', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, maxHeight: '92%' },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#FFFFFF18', alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 20, fontWeight: '900', color: '#fff', marginBottom: 6 },
  sheetSection: { fontSize: 8, fontWeight: '900', color: '#FFFFFF28', letterSpacing: 1.6, marginTop: 16, marginBottom: 8 },
  presetChip: { flex: 1, borderRadius: 14, borderWidth: 1, borderColor: '#FFFFFF12', backgroundColor: '#FFFFFF05', padding: 10, alignItems: 'center', gap: 2 },
  presetChipTime: { fontSize: 12, fontWeight: '900' },
  presetChipLabel: { fontSize: 8, color: '#FFFFFF30', fontWeight: '600' },
  prakritiRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 6, backgroundColor: '#FFFFFF04' },
  mantraChip: { width: 104, borderRadius: 14, borderWidth: 1, borderColor: '#FFFFFF12', backgroundColor: '#FFFFFF05', padding: 10, alignItems: 'center', gap: 4 },
  missionChip: { borderRadius: 14, borderWidth: 1, padding: 12, alignItems: 'center', gap: 4, width: (width - 40 - 8) / 2 },
  settingsCard: { backgroundColor: '#FFFFFF04', borderWidth: 1, borderColor: '#FFFFFF0A', borderRadius: 18, marginBottom: 10, overflow: 'hidden' },
  settingsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  streakBanner: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, borderWidth: 1, borderColor: ACCENT + '30', padding: 14, marginBottom: 14, marginTop: 4 },
  testBtn: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 14, alignItems: 'center', gap: 4 },
  sheetDoneBtn: { backgroundColor: ACCENT + '25', borderWidth: 1, borderColor: ACCENT + '50', borderRadius: 99, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  sheetDoneTxt: { color: ACCENT, fontWeight: '900', fontSize: 15 },
  habitChip: { borderRadius: 14, borderWidth: 1, borderColor: '#FFFFFF10', backgroundColor: '#FFFFFF04', padding: 10, alignItems: 'center', gap: 4, width: (width - 40 - 24) / 4 },
  customInput: { backgroundColor: '#FFFFFF07', borderWidth: 1, borderColor: '#FFFFFF12', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, color: '#fff', fontSize: 14, marginBottom: 8 },
  saveBtn: { backgroundColor: '#10b98118', borderWidth: 1, borderColor: '#10b98140', borderRadius: 99, paddingVertical: 14, alignItems: 'center' },
  saveBtnTxt: { color: '#10b981', fontWeight: '900', fontSize: 15 },
  kebabBtn: { paddingVertical: 6, paddingHorizontal: 8, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  kebabDot: { width: 4.5, height: 4.5, borderRadius: 2.5, backgroundColor: '#FFFFFFDD', marginVertical: 2.5 },
  cardMenu: { marginHorizontal: 16, marginBottom: 14, backgroundColor: 'rgba(8,8,24,0.92)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)', overflow: 'hidden' },
  cardMenuItem: { paddingHorizontal: 20, paddingVertical: 16 },
  cardMenuTxt: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});
