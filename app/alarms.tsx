import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, Modal,
  TextInput, Alert, Animated, Dimensions, NativeModules, Platform, ToastAndroid, ImageBackground,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import { getLocalMantraPath, isMantraDownloaded, downloadMantra } from '@/lib/mantraDownload';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { speakBodhi, stopBodhi } from '@/lib/speech';
import { store, KEYS } from '@/lib/storage';
import * as Notifications from 'expo-notifications';
import { Audio } from 'expo-av';
import {
  AlarmSettings, CustomReminder, DEFAULT_ALARM_SETTINGS, HABIT_ALERT_TIMES,
  rescheduleAllFromSettings, requestNotificationPermission,
} from '@/lib/notifications';
import { MISSIONS, WAKE_SOUNDS, DEFAULT_MISSION_SETTINGS, MissionSettings } from '@/lib/missionAlarm';
import {
  scheduleNativeAlarm, cancelNativeAlarm,
  checkAlarmPermission, openAlarmPermissionSettings,
  setNativeAlarmSound, setNativeAlarmSoundPath,
  requestAllAlarmPermissions,
} from '@/lib/nativeAlarm';
import notifee, { AndroidImportance, AndroidCategory, AndroidVisibility, TriggerType, RepeatFrequency, AlarmType } from '@notifee/react-native';
import { Colors, Spacing, Radius, Font } from '@/constants/theme';
import { PRAKRITI_PLANS, type PledgeData } from '@/lib/prakritiPlan';

const ACCENT = '#F5820A';
const { width } = Dimensions.get('window');

const MANTRA_TO_WAKE_SOUND: Record<string, string> = {
  gayatri: 'gayatri', lalitha: 'lalitha', shivtandav: 'shiv_tandav',
  bhagya_suktam: 'bhagya_suktam', shiv_sankalpa: 'shiv_sankalpa_suktam',
};

const PRESETS = [
  { label: 'Brahma', sub: '4:30 AM', hour: 4, minute: 30, color: '#a78bfa' },
  { label: 'Early', sub: '5:30 AM', hour: 5, minute: 30, color: '#60a5fa' },
  { label: 'Kapha', sub: '6:00 AM', hour: 6, minute: 0, color: '#34d399' },
  { label: 'General', sub: '6:30 AM', hour: 6, minute: 30, color: '#fbbf24' },
];

const pad = (n: number) => String(n).padStart(2, '0');
const fmt12 = (h: number, m: number) => {
  const p = h < 12 ? 'AM' : 'PM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${pad(h12)}:${pad(m)} ${p}`;
};

const AYU_HABITS = [
  { key: 'wake_early',      label: 'Wake Early',       emoji: '🌙' },
  { key: 'morning_prayer',  label: 'Prayer',           emoji: '🙏' },
  { key: 'morning_stretch', label: 'Stretching',       emoji: '🤸' },
  { key: 'hydrate',         label: 'Hydrate',          emoji: '💧' },
  { key: 'shower',       label: 'Shower',           emoji: '�' },
  { key: 'meditation',   label: 'Meditation',       emoji: '🧘' },
  { key: 'sunlight',     label: 'Sunlight',         emoji: '☀️' },
  { key: 'breakfast',    label: 'Breakfast',        emoji: '🌾' },
  { key: 'main_meal',    label: 'Main Meal',        emoji: '🍛' },
  { key: 'walk',         label: 'Shatapavali Walk', emoji: '🚶' },
  { key: 'herbal_tea',   label: 'Herbal Tea',       emoji: '🍵' },
  { key: 'evening_walk', label: 'Evening Walk',     emoji: '🌆' },
  { key: 'light_dinner', label: 'Light Dinner',     emoji: '🥗' },
  { key: 'screen_free',  label: 'Screen-free Time', emoji: '📵' },
  { key: 'workout',      label: 'Workout',          emoji: '🏋️' },
  { key: 'journaling',   label: 'Journaling',       emoji: '📓' },
  { key: 'sleep',        label: 'Sleep by 10 PM',   emoji: '🌑' },
  { key: 'custom',       label: 'Custom Habit',     emoji: '✨' },
];

export interface AlarmEntry {
  id: string;
  type: 'habit' | 'quick';
  hour: number;
  minute: number;
  label: string;
  enabled: boolean;
  habitKey?: string;
  habitEmoji?: string;
}

const MANTRAS = [
  {
    id: 'gayatri', label: 'Gayatri Mantra', emoji: '🌞', color: '#fbbf24',
    hint: 'ॐ भूर्भुवः स्वः', pitch: 0.85, rate: 0.70,
    text: 'Om Bhur Bhuva Swaha, Tat Savitur Varenyam, Bhargo Devasya Dhimahi, Dhiyo Yo Nah Prachodayat. Om Shanti Shanti Shanti.',
    audioUrl: 'https://ik.imagekit.io/rcsesr4xf/gayatri-mantra-ghanpaath.mp3',
    bundledSrc: null as any,
  },
  {
    id: 'lalitha', label: 'Lalitha Sahasranama', emoji: '🌺', color: '#f472b6',
    hint: 'ॐ ऐं ह्रीं श्रीं', pitch: 0.80, rate: 0.65,
    text: 'Om Aim Hreem Shreem, Sri Lalitha Tripura Sundari, Namami Namami Namami. Om Shakti Shakti Shakti.',
    audioUrl: 'https://ik.imagekit.io/rcsesr4xf/Lalitha-Sahasranamam.mp3',
    bundledSrc: null as any,
  },
  {
    id: 'shivtandav', label: 'Shiv Tandav', emoji: '🔱', color: '#a78bfa',
    hint: 'ॐ नमः शिवाय', pitch: 0.75, rate: 0.68,
    text: 'Jata tavee galajjala pravaha pavithrasthale. Om Namah Shivaya, Om Namah Shivaya. Har Har Mahadev.',
    audioUrl: 'https://ik.imagekit.io/rcsesr4xf/Shiva-Tandav.mp3',
    bundledSrc: null as any,
  },
  {
    id: 'bhagya_suktam', label: 'Bhagya Suktam', emoji: '🌟', color: '#fde68a',
    hint: 'ॐ श्री सूक्तम्', pitch: 0.80, rate: 0.65,
    text: 'Om Hiranyavarnaam Harineem Suvarna Rajata Srajaam. Chandraam Hiranmayeem Lakshmeem Jaatavedo Ma Aavaha.',
    audioUrl: '',
    bundledSrc: require('../assets/sounds/bhagya-suktam.mp3'),
  },
  {
    id: 'shiv_sankalpa', label: 'Shiv Sankalpa Suktam', emoji: '🕉️', color: '#c4b5fd',
    hint: 'ॐ यज्जाग्रतो', pitch: 0.78, rate: 0.62,
    text: 'Yaj Jaagrato Dooaram Udaiti Daivam. Tad U Suptasya Tathaivati. Tan Me Manah Shiva Sankalpam Astu.',
    audioUrl: '',
    bundledSrc: require('../assets/sounds/shiv-sankalpa-suktam.mp3'),
  },
];

function Toggle({ value, onToggle, color = '#a78bfa' }: { value: boolean; onToggle: () => void; color?: string }) {
  return (
    <Switch value={value} onValueChange={onToggle}
      trackColor={{ false: Colors.border, true: color + '80' }}
      thumbColor={value ? color : Colors.textDim}
    />
  );
}

const DRUM_H = 52;
const DRUM_REPEAT = 5;  // repeat values 5× for free infinite scroll in both directions
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

function DrumColumn({ values, selected, onChange }: {
  values: number[]; selected: number; onChange: (v: number) => void;
}) {
  const count = values.length;
  // Build an array that is DRUM_REPEAT copies of values so the user can
  // scroll freely in both directions without ever hitting a wall.
  const repeated = useMemo(
    () => Array.from({ length: count * DRUM_REPEAT }, (_, i) => values[i % count]),
    [count],
  );
  // Middle copy starts at index (2 * count)
  const midOffset = 2 * count;

  const ref = useRef<ScrollView>(null);
  const momentumStarted = useRef(false);
  const lastEmit = useRef(selected);
  const [selIdx, setSelIdx] = useState(() => midOffset + values.indexOf(selected));
  const selIdxRef = useRef(selIdx);

  const updateSel = (idx: number) => {
    selIdxRef.current = idx;
    setSelIdx(idx);
  };

  // Initial position: scroll to middle copy
  useEffect(() => {
    const idx = midOffset + values.indexOf(selected);
    updateSel(idx);
    setTimeout(() => ref.current?.scrollTo({ y: idx * DRUM_H, animated: false }), 80);
  }, []);

  // External changes (e.g. preset buttons) — animate to nearest occurrence
  useEffect(() => {
    if (lastEmit.current === selected) return;
    lastEmit.current = selected;
    const cur = selIdxRef.current;
    let best = midOffset + values.indexOf(selected);
    let minD = Math.abs(best - cur);
    for (let i = 0; i < repeated.length; i++) {
      if (repeated[i] === selected) {
        const d = Math.abs(i - cur);
        if (d < minD) { minD = d; best = i; }
      }
    }
    updateSel(best);
    ref.current?.scrollTo({ y: best * DRUM_H, animated: true });
  }, [selected]);

  const handleSnap = (y: number) => {
    let idx = Math.round(y / DRUM_H);
    idx = Math.max(0, Math.min(idx, repeated.length - 1));
    const v = repeated[idx];
    if (v !== lastEmit.current) {
      lastEmit.current = v;
      onChange(v);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    // If landed in the 1st or 5th copy, silently teleport to the same value
    // in the middle (3rd) copy so there is always room to scroll both ways.
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
        onMomentumScrollEnd={e => { momentumStarted.current = false; handleSnap(e.nativeEvent.contentOffset.y); }}
        onScrollEndDrag={e => { if (!momentumStarted.current) handleSnap(e.nativeEvent.contentOffset.y); }}
      >
        <View style={{ height: DRUM_H }} />
        {repeated.map((v, i) => {
          const isSel = i === selIdx;
          return (
            <View key={i} style={{ height: DRUM_H, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{
                fontSize: isSel ? 42 : 26,
                fontWeight: isSel ? '100' : '300',
                color: isSel ? '#FFFFFF' : '#FFFFFF28',
                letterSpacing: -1.5,
                textAlign: 'center',
              }}>{String(v).padStart(2, '0')}</Text>
            </View>
          );
        })}
        <View style={{ height: DRUM_H }} />
      </ScrollView>
    </View>
  );
}

function TimeAdjuster({ hour, minute, onChange }: { hour: number; minute: number; onChange: (h: number, m: number) => void }) {
  const prevMinRef = useRef(minute);
  useEffect(() => { prevMinRef.current = minute; }, [minute]);

  const handleMinuteChange = (m: number) => {
    const prev = prevMinRef.current;
    prevMinRef.current = m;
    let h = hour;
    if (prev - m > 30) h = (hour + 1) % 24;          // 59 → 0 : carry hour forward
    else if (m - prev > 30) h = (hour - 1 + 24) % 24; // 0 → 59 : borrow hour back
    onChange(h, m);
  };

  return (
    <View style={{ paddingVertical: 10 }}>
      <View>
        {/* selection highlight band */}
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: DRUM_H, height: DRUM_H, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#FFFFFF15', backgroundColor: '#FFFFFF05', zIndex: 1 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
          <DrumColumn values={HOURS} selected={hour} onChange={h => onChange(h, minute)} />
          <Text style={{ fontSize: 36, fontWeight: '100', color: '#FFFFFF35', paddingHorizontal: 8, marginTop: 0, alignSelf: 'center' }}>:</Text>
          <DrumColumn values={MINUTES} selected={minute} onChange={handleMinuteChange} />
          <Text style={{ fontSize: 17, fontWeight: '800', color: '#a78bfa', paddingLeft: 12, alignSelf: 'center', letterSpacing: 0.5 }}>
            {hour < 12 ? 'AM' : 'PM'}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function AlarmsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { autoplay } = useLocalSearchParams<{ autoplay?: string }>();
  const hasAutoPlayed = useRef(false);

  // ── Wake alarm state (existing, unchanged) ─────────────────────────────────
  const [settings, setSettings] = useState<AlarmSettings>(DEFAULT_ALARM_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [selectedMantraId, setSelectedMantraId] = useState('gayatri');
  const saveAnim = useRef(new Animated.Value(0)).current;
  const alarmActiveRef = useRef(false);
  const [dlStatus, setDlStatus] = useState<Record<string, 'idle' | 'downloading' | 'downloaded' | 'bundled'>>(
    { gayatri: 'idle', lalitha: 'idle', shivtandav: 'idle', bhagya_suktam: 'bundled', shiv_sankalpa: 'bundled' }
  );
  const [dlProgress, setDlProgress] = useState<Record<string, number>>({});

  // ── Multi-alarm entries state (habit + quick) ──────────────────────────────
  const [alarmEntries, setAlarmEntries] = useState<AlarmEntry[]>([]);

  // ── FAB state ──────────────────────────────────────────────────────────────
  const [fabOpen, setFabOpen] = useState(false);
  const fabAnim = useRef(new Animated.Value(0)).current;
  const habitScrollRef = useRef<ScrollView>(null);

  // ── Modal state ────────────────────────────────────────────────────────────
  const [showWakeEdit, setShowWakeEdit] = useState(false);
  const [addType, setAddType] = useState<'habit' | 'quick' | null>(null);
  const [editEntry, setEditEntry] = useState<AlarmEntry | null>(null);

  // ── Form state for modals ──────────────────────────────────────────────────
  const [formHour, setFormHour] = useState(7);
  const [formMinute, setFormMinute] = useState(0);
  const [formLabel, setFormLabel] = useState('');
  const [formHabitKey, setFormHabitKey] = useState('meditation');
  const [formHabitEmoji, setFormHabitEmoji] = useState('🧘');
  const [showCustomHabitInput, setShowCustomHabitInput] = useState(false);

  // ── Tab nav state ─────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'alarm' | 'sleep' | 'reports' | 'settings'>('alarm');

  // ── Legacy custom reminders form (kept for backward compat) ────────────────
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newHour, setNewHour] = useState(8);
  const [newMinute, setNewMinute] = useState(0);
  const [missionSettings, setMissionSettings] = useState<MissionSettings>(DEFAULT_MISSION_SETTINGS);
  const [batteryOptOk, setBatteryOptOk] = useState(true);
  const [permStatus, setPermStatus] = useState<{ notifications: boolean; exactAlarm: boolean; batteryOpt: boolean; fullScreen: boolean }>({
    notifications: true, exactAlarm: true, batteryOpt: true, fullScreen: true,
  });
  const [liveClock, setLiveClock] = useState(new Date());
  const [prakritiWake, setPrakritiWake] = useState<{ label: string; hour: number; minute: number; color: string } | null>(null);
  const [alarmModal, setAlarmModal] = useState(false);
  const [settingsSoundOpen, setSettingsSoundOpen] = useState(false);
  const [modalSoundOpen, setModalSoundOpen] = useState(false);
  const [modalMissionOpen, setModalMissionOpen] = useState(false);
  const [alarmType, setAlarmType] = useState<'mantra' | 'gayatri'>('mantra');

  useEffect(() => {
    const t = setInterval(() => setLiveClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Load saved settings
  useEffect(() => {
    (async () => {
      const s = await store.getJSON<AlarmSettings>(KEYS.alarmSettings);
      // Load Prakriti plan wake time recommendation
      const pledge = await store.getJSON<PledgeData>(KEYS.pledge);
      if (pledge?.prakriti && PRAKRITI_PLANS[pledge.prakriti]) {
        const plan = PRAKRITI_PLANS[pledge.prakriti];
        const color = pledge.prakriti === 'Kapha' ? '#34d399' : pledge.prakriti === 'Pitta' ? '#fb923c' : '#a78bfa';
        setPrakritiWake({ label: `${pledge.prakriti} Plan · ${plan.wakeTime}`, hour: plan.wakeHour, minute: plan.wakeMin, color });
        // Auto-apply prakriti wake time if alarm is still at factory default (not yet customised)
        if (!s || (!s.wakeAlarm?.enabled && s.wakeAlarm?.hour === DEFAULT_ALARM_SETTINGS.wakeAlarm.hour && s.wakeAlarm?.minute === DEFAULT_ALARM_SETTINGS.wakeAlarm.minute)) {
          const autoFilled: AlarmSettings = {
            ...(s ?? DEFAULT_ALARM_SETTINGS),
            wakeAlarm: { enabled: false, hour: plan.wakeHour, minute: plan.wakeMin },
          };
          setSettings(autoFilled);
          await store.setJSON(KEYS.alarmSettings, autoFilled);
        }
      }
      if (s) {
        setSettings(prev => ({ ...DEFAULT_ALARM_SETTINGS, ...s, wakeAlarm: s.wakeAlarm ?? prev.wakeAlarm }));
        if (s.selectedMantraId) setSelectedMantraId(s.selectedMantraId);
        if (s.wakeAlarm?.enabled) {
          scheduleNativeAlarm(s.wakeAlarm.hour, s.wakeAlarm.minute).catch(() => {});
        }
      }
      // Check which mantras are already downloaded
      const statuses: Record<string, 'idle' | 'downloading' | 'downloaded' | 'bundled'> = {};
      for (const m of MANTRAS) {
        if (m.bundledSrc) { statuses[m.id] = 'bundled'; continue; }
        statuses[m.id] = (await isMantraDownloaded(m.id)) ? 'downloaded' : 'idle';
      }
      setDlStatus(statuses);

      // Ensure native alarm sound path is set for the currently-selected mantra if it's already
      // downloaded — prevents fallback to bundled mantra_alarm.wav when app restarts
      const currentMantraId = s?.selectedMantraId ?? 'gayatri';
      if (statuses[currentMantraId] === 'downloaded') {
        setNativeAlarmSoundPath(getLocalMantraPath(currentMantraId)).catch(() => {});
      }

      // Load mission settings
      const ms = await store.getJSON<MissionSettings>(KEYS.missionSettings);
      if (ms) setMissionSettings({ ...DEFAULT_MISSION_SETTINGS, ...ms });

      // Load multi-alarm entries (habit + quick)
      const entries = await store.getJSON<AlarmEntry[]>(KEYS.multiAlarms);
      if (entries) setAlarmEntries(entries);

      // Battery optimization check
      if (Platform.OS === 'android' && NativeModules.AlarmModule) {
        try {
          const ignored: boolean = await NativeModules.AlarmModule.isBatteryOptimizationIgnored();
          setBatteryOptOk(ignored);
        } catch { /* native module not yet linked in dev */ }
      }

      // Request all alarm permissions on every alarm screen open.
      // Each step internally checks if already granted — no duplicate dialogs.
      // This ensures users who skipped permissions on first launch get prompted again.
      if (Platform.OS === 'android') {
        setTimeout(async () => {
          await requestAllAlarmPermissions();
          // After prompts, refresh which permissions are still missing
          const [exactAlarm, battOk, fullSc] = await Promise.all([
            checkAlarmPermission(),
            NativeModules.AlarmModule?.isBatteryOptimizationIgnored?.().catch(() => true) ?? Promise.resolve(true),
            NativeModules.AlarmModule?.checkFullScreenIntentPermission?.().catch(() => true) ?? Promise.resolve(true),
          ]);
          const { status } = await (require('expo-notifications') as typeof import('expo-notifications')).getPermissionsAsync();
          setPermStatus({
            notifications: status === 'granted',
            exactAlarm: !!exactAlarm,
            batteryOpt: !!battOk,
            fullScreen: !!fullSc,
          });
        }, 800);
      }

      // Auto-play if launched from a wake-alarm notification tap
      if (autoplay === '1' && !hasAutoPlayed.current) {
        hasAutoPlayed.current = true;
        setTimeout(() => playAlarmSound('mantra'), 1200);
      }
    })();
  }, []);

  const persistAndApply = async (updated: AlarmSettings) => {
    setSettings(updated);
    setSaving(true);
    try {
      await store.setJSON(KEYS.alarmSettings, updated);
      const hasNotifPerm = await requestNotificationPermission();
      if (hasNotifPerm) {
        await rescheduleAllFromSettings(updated);
      }

      // ── Native AlarmManager scheduling ─────────────────────────────────
      // CRITICAL: Schedule FIRST. Run permission walk-through AFTER (non-blocking).
      // Earlier code awaited requestAllAlarmPermissions() before scheduling — that
      // function shows blocking Alert.alert dialogs which can be swallowed by RN's
      // modal stack right after a time-picker dismisses, hanging the await forever
      // and leaving the alarm UN-SCHEDULED while the UI shows it as ON.
      if (updated.wakeAlarm.enabled) {
        // 1. Schedule immediately — same direct native call the test alarm uses.
        setNativeAlarmSound(selectedMantraId).catch(() => {});
        const next = new Date();
        next.setHours(updated.wakeAlarm.hour, updated.wakeAlarm.minute, 0, 0);
        if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
        let scheduled = false;
        if (Platform.OS === 'android' && NativeModules.AlarmModule?.scheduleAlarm) {
          try {
            const res = await NativeModules.AlarmModule.scheduleAlarm(next.getTime());
            scheduled = true;
            console.log(`[Alarm] ✅ ${res} — ${next.toLocaleString()} (mantra: ${selectedMantraId})`);
          } catch (e: any) {
            Alert.alert('❌ Alarm scheduling failed', e?.message ?? String(e));
          }
        } else {
          await scheduleNativeAlarm(updated.wakeAlarm.hour, updated.wakeAlarm.minute);
          scheduled = true;
        }

        // 2. Show user EXPLICIT confirmation that the alarm is armed.
        if (scheduled) {
          const h12 = next.getHours() === 0 ? 12 : next.getHours() > 12 ? next.getHours() - 12 : next.getHours();
          const ampm = next.getHours() >= 12 ? 'PM' : 'AM';
          const mm = String(next.getMinutes()).padStart(2, '0');
          const isTomorrow = next.getDate() !== new Date().getDate();
          ToastAndroid?.show?.(
            `🔔 Alarm armed for ${h12}:${mm} ${ampm}${isTomorrow ? ' (tomorrow)' : ''}`,
            ToastAndroid.LONG,
          );
        }

        // 3. NOW run permission walk-through in the background. Even if it hangs
        //    or the user skips, the alarm is already scheduled. Refresh health
        //    card status afterwards.
        if (Platform.OS === 'android') {
          (async () => {
            try {
              await requestAllAlarmPermissions();
              const [ea, bo, fs] = await Promise.all([
                checkAlarmPermission(),
                NativeModules.AlarmModule?.isBatteryOptimizationIgnored?.().catch(() => true) ?? Promise.resolve(true),
                NativeModules.AlarmModule?.checkFullScreenIntentPermission?.().catch(() => true) ?? Promise.resolve(true),
              ]);
              const { status } = await (require('expo-notifications') as typeof import('expo-notifications')).getPermissionsAsync();
              setPermStatus({ notifications: status === 'granted', exactAlarm: !!ea, batteryOpt: !!bo, fullScreen: !!fs });
            } catch { /* silent — alarm is already scheduled */ }
          })();
        }
      } else {
        await cancelNativeAlarm();
        ToastAndroid?.show?.('🔕 Alarm cancelled', ToastAndroid.SHORT);
      }

      // flash save indicator
      Animated.sequence([
        Animated.timing(saveAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(800),
        Animated.timing(saveAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    } catch {
      /* silent — don't pop Alert on every time adjustment */
    } finally { setSaving(false); }
  };

  const toggleWake = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    persistAndApply({ ...settings, wakeAlarm: { ...settings.wakeAlarm, enabled: !settings.wakeAlarm.enabled } });
  };

  const setWakeTime = (h: number, m: number) => {
    // Auto-enable the alarm when the user picks a time — matches Alarmy/Wakey/Android Clock UX.
    // Without this, picking a time silently does nothing if the toggle was off.
    const updated = { ...settings, wakeAlarm: { enabled: true, hour: h, minute: m } };
    persistAndApply(updated);
  };

  const applyPreset = (preset: typeof PRESETS[0]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const updated = { ...settings, wakeAlarm: { enabled: true, hour: preset.hour, minute: preset.minute } };
    persistAndApply(updated);
  };

  const toggleBrahma = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    persistAndApply({ ...settings, brahmaReminder: !settings.brahmaReminder });
  };

  const toggleCheckin = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    persistAndApply({ ...settings, checkinReminder: !settings.checkinReminder });
  };

  const toggleHabit = (habitId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = { ...settings, habitAlerts: { ...settings.habitAlerts, [habitId]: !settings.habitAlerts[habitId] } };
    persistAndApply(updated);
  };

  const addCustom = () => {
    if (!newTitle.trim()) { Alert.alert('Enter a reminder title'); return; }
    const id = Date.now().toString();
    const r: CustomReminder = { id, title: newTitle.trim(), body: newBody.trim() || 'Time to practice Ayurveda. 🙏', hour: newHour, minute: newMinute, enabled: true };
    const updated = { ...settings, customReminders: [...settings.customReminders, r] };
    persistAndApply(updated);
    setNewTitle(''); setNewBody(''); setNewHour(8); setNewMinute(0);
    setShowAddCustom(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const deleteCustom = (id: string) => {
    Alert.alert('Delete reminder?', '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: () => {
          const updated = { ...settings, customReminders: settings.customReminders.filter(r => r.id !== id) };
          persistAndApply(updated);
        }
      },
    ]);
  };

  const toggleCustom = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = { ...settings, customReminders: settings.customReminders.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r) };
    persistAndApply(updated);
  };

  // Chant selected mantra via expo-speech
  const chantMantra = (mantra: typeof MANTRAS[0], repeat = true) => {
    Speech.stop();
    Speech.speak(mantra.text, {
      language: 'en-IN',
      pitch: mantra.pitch,
      rate: mantra.rate,
      onDone: () => { if (repeat && alarmActiveRef.current) chantMantra(mantra, repeat); },
    });
  };

  const stopAlarm = () => {
    Speech.stop();
    try { } catch (_) { }
    setAlarmModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleMantraSelect = async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedMantraId(id);
    const upd = { ...settings, selectedMantraId: id };
    setSettings(upd);
    store.setJSON(KEYS.alarmSettings, upd);
    // Persist to native SharedPreferences so AlarmSoundService plays this mantra
    setNativeAlarmSound(id).catch(() => {});
    // Keep MissionSettings.wakeSound in sync so alarm-ringing.tsx plays the same mantra
    const wakeSoundId = MANTRA_TO_WAKE_SOUND[id] ?? 'gayatri';
    updateMission({ wakeSound: wakeSoundId });
    // If bundled locally or already downloaded, no CDN download needed
    const m = MANTRAS.find(x => x.id === id);
    if (m?.bundledSrc) return;
    if (dlStatus[id] === 'downloaded') {
      setNativeAlarmSoundPath(getLocalMantraPath(id)).catch(() => {});
      return;
    }
    if (dlStatus[id] === 'downloading') return;
    if (!m?.audioUrl) return;
    setDlStatus(s => ({ ...s, [id]: 'downloading' }));
    setDlProgress(s => ({ ...s, [id]: 0 }));
    const result = await downloadMantra(id, m.audioUrl, (p) =>
      setDlProgress(s => ({ ...s, [id]: p }))
    );
    setDlStatus(s => ({ ...s, [id]: result ? 'downloaded' : 'idle' }));
    // Save the absolute path so AlarmSoundService plays it when app is closed
    if (result && id === selectedMantraId) {
      setNativeAlarmSoundPath(result).catch(() => {});
    }
  };

  // ── Play alarm sound immediately (foreground) ─────────────────────────────
  const playAlarmSound = async (overrideType?: 'mantra' | 'gayatri') => {
    const mantra = MANTRAS.find(m => m.id === selectedMantraId) ?? MANTRAS[0];
    alarmActiveRef.current = true;
    setAlarmType(overrideType === 'mantra' ? 'mantra' : 'gayatri');
    setAlarmModal(true);

    // ── Step 0a: Bundled asset (bhagya_suktam, shiv_sankalpa) ─────────────────
    if (mantra.bundledSrc) {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, shouldDuckAndroid: false, staysActiveInBackground: true });
        const { sound } = await Audio.Sound.createAsync(
          mantra.bundledSrc,
          { shouldPlay: true, volume: 1.0, isLooping: true },
        );
        (global as any).__alarmSound = sound;
        return;
      } catch (_) { /* fall through */ }
    }

    // ── Step 0: Try local downloaded file (offline-first, instant) ───────────
    try {
      const localPath = getLocalMantraPath(mantra.id);
      const localInfo = await FileSystem.getInfoAsync(localPath);
      if (localInfo.exists) {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, shouldDuckAndroid: false, staysActiveInBackground: true });
        const { sound } = await Audio.Sound.createAsync(
          { uri: localPath },
          { shouldPlay: true, volume: 1.0, isLooping: true },
        );
        (global as any).__alarmSound = sound;
        return;
      }
    } catch (_) { /* no local file — fall through */ }

    // ── Step 1: Try streaming the mantra-specific CDN audio ─────────────────
    if (mantra.audioUrl) {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, shouldDuckAndroid: false, staysActiveInBackground: true });
        const { sound } = await Audio.Sound.createAsync(
          { uri: mantra.audioUrl },
          { shouldPlay: true, volume: 1.0, isLooping: true },
        );
        (global as any).__alarmSound = sound;
        return; // streaming started — done
      } catch (_) { /* no internet or CDN down — fall through */ }
    }

    // ── Step 2 (offline fallback): bundled WAV or expo-speech ────────────────
    if (overrideType === 'mantra') {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, shouldDuckAndroid: false, staysActiveInBackground: true });
        const { sound } = await Audio.Sound.createAsync(
          require('../assets/sounds/mantra_alarm.wav'),
          { shouldPlay: true, volume: 1.0, isLooping: true },
        );
        (global as any).__alarmSound = sound;
      } catch (_) {
        chantMantra(mantra, true);
      }
    } else {
      chantMantra(mantra, true);
    }
  };

  const stopAlarmSound = () => {
    alarmActiveRef.current = false;
    // Stop all ongoing audio
    Speech.stop();
    stopBodhi();   // stop any in-progress Gemini speech
    try {
      const s = (global as any).__alarmSound;
      if (s) { s.stopAsync(); s.unloadAsync(); (global as any).__alarmSound = null; }
    } catch (_) { }
    setAlarmModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // After 1.5s — Bodhi greets with Gemini Aoede voice
    const mantra = MANTRAS.find(m => m.id === selectedMantraId) ?? MANTRAS[0];
    const greeting = `Good morning. Your ${mantra.label} session is complete. Take three deep breaths. Drink warm water. Begin your practice with intention. Your body, mind and soul are ready. Jai Guru Dev.`;
    setTimeout(() => speakBodhi(greeting), 1500);
  };

  const snoozeAlarm = async () => {
    alarmActiveRef.current = false;
    Speech.stop();
    stopBodhi();
    try {
      const s = (global as any).__alarmSound;
      if (s) { await s.stopAsync(); await s.unloadAsync(); (global as any).__alarmSound = null; }
    } catch (_) { }
    setAlarmModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    await Notifications.scheduleNotificationAsync({
      identifier: 'snooze-alarm',
      content: {
        title: '⏰ Snooze Over — Rise & Shine! 🌅',
        body: 'Brahma Muhurta will not wait. Rise, meditate and begin your practice. 🙏',
        sound: 'mantra_alarm.wav',
        data: { type: 'wake-alarm', speechId: 'wake-alarm' },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 600, repeats: false },
    });
    Alert.alert('💤 Snoozed', 'Alarm rings again in 10 minutes.');
  };

  const fireTestNotification = async (type: 'mantra' | 'gayatri' = 'mantra') => {
    const granted = await requestNotificationPermission();
    if (!granted) { Alert.alert('Enable notifications in Settings first'); return; }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Persist the user's selected mantra so the native service plays the right sound
    setNativeAlarmSound(selectedMantraId).catch(() => {});

    if (Platform.OS === 'android') {
      // Diagnostic: explicitly check AlarmModule presence so silent fallback
      // (which only plays in foreground via expo-av) cannot hide native-module bugs.
      if (!NativeModules.AlarmModule || typeof NativeModules.AlarmModule.scheduleAlarm !== 'function') {
        Alert.alert(
          '❌ Native AlarmModule MISSING',
          `NativeModules.AlarmModule is ${NativeModules.AlarmModule ? 'present but has no scheduleAlarm' : 'undefined'}. ` +
          `Available keys: ${Object.keys(NativeModules).filter(k => k.toLowerCase().includes('alarm')).join(', ') || 'none'}. ` +
          `This means the APK build did not register AlarmPackage correctly under New Architecture.`,
        );
        return;
      }
      try {
        await NativeModules.AlarmModule.scheduleAlarm(Date.now() + 5000);
        Alert.alert(
          '🔔 Native alarm armed (5s)',
          'Lock your screen or swipe the app away NOW. The mantra should ring on its own — no tap required.',
        );
      } catch (e: any) {
        Alert.alert('Native alarm failed', e?.message ?? String(e));
      }
    } else {
      // iOS only: best we can do is play in-app immediately
      playAlarmSound(type);
    }
  };

  const fireBodhiSpeechTest = async () => {
    const granted = await requestNotificationPermission();
    if (!granted) { Alert.alert('Enable notifications in Settings first'); return; }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await Notifications.scheduleNotificationAsync({
      identifier: 'test-bodhi-speech',
      content: {
        title: '🌅 Morning Rituals Window Open',
        body: 'Kapha Kala is live. Move your body, warm water, Surya Namaskar. 🙏',
        sound: true,
        data: { speechId: 'morning-start' },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3, repeats: false },
    });
    Alert.alert(
      '✓ Bodhi Speech Test!',
      'Keep the app OPEN & on screen.\nBodhi will speak in 3 seconds. 🗣️',
    );
  };

  const updateMission = async (patch: Partial<MissionSettings>) => {
    const updated = { ...missionSettings, ...patch };
    setMissionSettings(updated);
    await store.setJSON(KEYS.missionSettings, updated);
  };

  // ── Multi-alarm entry handlers ─────────────────────────────────────────────
  const scheduleEntryNotif = async (entry: AlarmEntry) => {
    if (!entry.enabled) return;
    const title = entry.type === 'habit'
      ? `${entry.habitEmoji ?? '🌿'} ${entry.label}`
      : `⚡ ${entry.label || 'Quick Alarm'}`;

    // Cancel any stale notifications for this entry before rescheduling
    await notifee.cancelTriggerNotification(`habit-${entry.id}`).catch(() => {});
    await Notifications.cancelScheduledNotificationAsync(`alarm-${entry.id}`).catch(() => {});

    const now = new Date();
    const next = new Date();
    next.setHours(entry.hour, entry.minute, 0, 0);
    if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);

    // ── Android: notifee full-screen intent (same mechanism as wake alarm) ──
    if (Platform.OS === 'android') {
      try {
        await notifee.createChannel({
          id: 'arise-habit-alarms',
          name: 'SolRize Habit Alarms',
          importance: AndroidImportance.HIGH,
          sound: 'mantra_alarm',
          vibration: true,
          vibrationPattern: [0, 600, 300, 600],
          bypassDnd: true,
          visibility: AndroidVisibility.PUBLIC,
        } as any);
        await notifee.createTriggerNotification(
          {
            id: `habit-${entry.id}`,
            title,
            body: entry.type === 'habit' ? 'Time for your habit! Tap to begin. 🙏' : 'Your alarm is ringing! ⏰',
            android: {
              channelId: 'arise-habit-alarms',
              importance: AndroidImportance.HIGH,
              category: AndroidCategory.ALARM,
              visibility: AndroidVisibility.PUBLIC,
              fullScreenAction: { id: 'default', launchActivity: 'default' },
              pressAction: { id: 'default', launchActivity: 'default' },
            } as any,
            data: {
              type: 'habit-alarm',
              alarmId: entry.id,
              habitKey: entry.habitKey ?? entry.id,
              habitEmoji: entry.habitEmoji ?? (entry.type === 'quick' ? '⚡' : '🌿'),
              label: entry.label,
              alarmType: entry.type,
            },
          },
          {
            type: TriggerType.TIMESTAMP,
            timestamp: next.getTime(),
            repeatFrequency: RepeatFrequency.DAILY,
            alarmManager: { type: AlarmType.SET_EXACT_AND_ALLOW_WHILE_IDLE },
          } as any,
        );
        ToastAndroid?.show?.(`🔔 Alarm set · ${fmt12(entry.hour, entry.minute)}`, ToastAndroid.SHORT);
        return;
      } catch (e: any) {
        console.warn('[Alarms] notifee scheduling failed:', e?.message ?? e);
      }
    }

    // ── iOS + Android fallback: expo-notifications DAILY trigger ──
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: `alarm-${entry.id}`,
        content: {
          title,
          body: entry.type === 'habit' ? 'Time for your habit! 🙏' : 'Your alarm is ringing! ⏰',
          sound: 'mantra_alarm.wav',
          data: { type: 'habit-alarm', alarmId: entry.id, habitKey: entry.habitKey ?? entry.id, habitEmoji: entry.habitEmoji ?? '', label: entry.label, alarmType: entry.type },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: entry.hour, minute: entry.minute },
      });
    } catch (e2: any) {
      console.warn('[Alarms] expo-notifications fallback failed:', e2);
    }
  };

  const cancelEntryNotif = async (entryId: string) => {
    await Notifications.cancelScheduledNotificationAsync(`alarm-${entryId}`).catch(() => {});
    await notifee.cancelTriggerNotification(`habit-${entryId}`).catch(() => {});
    await notifee.cancelNotification(`habit-${entryId}`).catch(() => {});
  };

  const saveEntries = async (entries: AlarmEntry[]) => {
    setAlarmEntries(entries);
    await store.setJSON(KEYS.multiAlarms, entries);
  };

  const toggleEntry = async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = alarmEntries.map(e => e.id === id ? { ...e, enabled: !e.enabled } : e);
    const entry = updated.find(e => e.id === id);
    if (entry) {
      if (entry.enabled) await scheduleEntryNotif(entry);
      else await cancelEntryNotif(id);
    }
    await saveEntries(updated);
  };

  const deleteEntry = (id: string) => {
    Alert.alert('Remove alarm?', '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          await cancelEntryNotif(id);
          await saveEntries(alarmEntries.filter(e => e.id !== id));
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  };

  const saveNewEntry = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const type = addType ?? editEntry?.type ?? 'habit';
    const id = editEntry?.id ?? Date.now().toString();
    const habitInfo = type === 'habit' ? AYU_HABITS.find(h => h.key === formHabitKey) : undefined;
    const label = formLabel.trim() || habitInfo?.label || (type === 'quick' ? 'Quick Alarm' : 'Habit Alarm');
    const entry: AlarmEntry = {
      id, type, hour: formHour, minute: formMinute, label, enabled: true,
      habitKey: type === 'habit' ? formHabitKey : undefined,
      habitEmoji: type === 'habit' ? (formHabitEmoji || habitInfo?.emoji) : undefined,
    };
    const updated = editEntry
      ? alarmEntries.map(e => e.id === id ? entry : e)
      : [...alarmEntries, entry];
    await scheduleEntryNotif(entry);
    await saveEntries(updated);
    setAddType(null);
    setEditEntry(null);
    setFormLabel('');
    setFormHabitKey('');
    setShowCustomHabitInput(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const openAddModal = (type: 'habit' | 'quick') => {
    setFormHour(type === 'habit' ? 7 : new Date().getHours());
    setFormMinute(type === 'habit' ? 0 : 0);
    setFormLabel('');
    setFormHabitKey(type === 'habit' ? '' : 'meditation');
    setFormHabitEmoji(type === 'habit' ? '' : '🧘');
    setShowCustomHabitInput(false);
    setEditEntry(null);
    setAddType(type);
  };

  const openEditEntry = (entry: AlarmEntry) => {
    setFormHour(entry.hour);
    setFormMinute(entry.minute);
    setFormLabel(entry.label);
    setFormHabitKey(entry.habitKey ?? 'custom');
    setFormHabitEmoji(entry.habitEmoji ?? '✨');
    setShowCustomHabitInput(entry.habitKey === 'custom');
    setEditEntry(entry);
    setAddType(null);
  };

  const toggleFab = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFabOpen(v => !v);
  };

  // ── Computed values ────────────────────────────────────────────────────────
  const playingMantra = MANTRAS.find(m => m.id === selectedMantraId) ?? MANTRAS[0];
  const allPermsOk = permStatus.notifications && permStatus.exactAlarm && permStatus.batteryOpt && permStatus.fullScreen;

  const nextAlarmEntry = (() => {
    const now = liveClock.getHours() * 60 + liveClock.getMinutes();
    let bestDiff = Infinity;
    let best: { hour: number; minute: number } | null = null;
    if (settings.wakeAlarm.enabled) {
      const t = settings.wakeAlarm.hour * 60 + settings.wakeAlarm.minute;
      const d = t > now ? t - now : t + 1440 - now;
      if (d < bestDiff) { bestDiff = d; best = { hour: settings.wakeAlarm.hour, minute: settings.wakeAlarm.minute }; }
    }
    alarmEntries.filter(e => e.enabled).forEach(e => {
      const t = e.hour * 60 + e.minute;
      const d = t > now ? t - now : t + 1440 - now;
      if (d < bestDiff) { bestDiff = d; best = { hour: e.hour, minute: e.minute }; }
    });
    return best;
  })();

  const nextLabel = (() => {
    const now = liveClock.getHours() * 60 + liveClock.getMinutes();
    const candidates: number[] = [];
    if (settings.wakeAlarm.enabled) {
      const w = settings.wakeAlarm.hour * 60 + settings.wakeAlarm.minute;
      candidates.push(w > now ? w - now : w + 24 * 60 - now);
    }
    alarmEntries.filter(e => e.enabled).forEach(e => {
      const t = e.hour * 60 + e.minute;
      candidates.push(t > now ? t - now : t + 24 * 60 - now);
    });
    if (candidates.length === 0) return '';
    const diff = Math.min(...candidates);
    const hrs = Math.floor(diff / 60);
    const mins = diff % 60;
    return hrs > 0 ? `${hrs} hr ${mins} min` : `${mins} min`;
  })();

  return (
    <View style={S.screen}>
      {/* ── Hero Header ── */}
      <ImageBackground source={require('../assets/images/hanumanji.png')} style={S.heroBg} resizeMode="cover">
        <LinearGradient colors={['rgba(4,2,10,0.10)', 'rgba(6,6,16,0.55)', '#060610']} locations={[0, 0.65, 1]} style={S.heroGrad}>
          <SafeAreaView edges={['top']}>
            <View style={S.heroTop}>
              <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
                <Text style={S.backTxt}>← Back</Text>
              </TouchableOpacity>
              <Animated.View style={{ opacity: saveAnim }}>
                <Text style={{ color: '#10b981', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>✓ SAVED</Text>
              </Animated.View>
            </View>
            <View style={S.heroCenter}>
              {nextAlarmEntry ? (
                <>
                  <Text style={S.heroLabel}>NEXT ALARM</Text>
                  <Text style={S.heroTime}>{fmt12(nextAlarmEntry.hour, nextAlarmEntry.minute)}</Text>
                  <View style={S.heroBadge}>
                    <View style={S.heroDot} />
                    <Text style={S.heroBadgeTxt}>Rings in {nextLabel}</Text>
                  </View>
                </>
              ) : (
                <>
                  <Text style={S.heroLabel}>ALARMS</Text>
                  <Text style={S.heroNoAlarm}>No alarms set</Text>
                  <Text style={S.heroNoAlarmSub}>Tap + to add one  🔕</Text>
                </>
              )}
            </View>
          </SafeAreaView>
        </LinearGradient>
      </ImageBackground>

      {/* Permissions bar (Android, only when needed) */}
      {Platform.OS === 'android' && !allPermsOk && (
        <TouchableOpacity
          style={S.permsBanner}
          onPress={() => requestAllAlarmPermissions().then(async () => {
            const [ea, bo, fs] = await Promise.all([
              checkAlarmPermission(),
              NativeModules.AlarmModule?.isBatteryOptimizationIgnored?.().catch(() => true) ?? Promise.resolve(true),
              NativeModules.AlarmModule?.checkFullScreenIntentPermission?.().catch(() => true) ?? Promise.resolve(true),
            ]);
            const { status } = await (require('expo-notifications') as typeof import('expo-notifications')).getPermissionsAsync();
            setPermStatus({ notifications: status === 'granted', exactAlarm: !!ea, batteryOpt: !!bo, fullScreen: !!fs });
          })}
          activeOpacity={0.8}
        >
          <Text style={S.permsText}>⚠️  Alarm permissions needed — Tap to fix</Text>
          <Text style={S.permsChevron}>→</Text>
        </TouchableOpacity>
      )}

      {/* ── Tab content ── */}
      {activeTab === 'sleep' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
          <View style={{ alignItems: 'center', paddingTop: 40, gap: 16 }}>
            <Text style={{ fontSize: 52 }}>🌙</Text>
            <Text style={{ fontSize: 22, fontWeight: '900', color: '#fff' }}>Sleep Tracker</Text>
            <Text style={{ fontSize: 13, color: '#FFFFFF40', textAlign: 'center', lineHeight: 20 }}>
              Set your sleep goal and track your sleep patterns.{'\n'}Coming soon — wake alarm data will feed insights here.
            </Text>
            <View style={{ width: '100%', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(255,255,255,0.09)', padding: 20, marginTop: 12, gap: 12 }}>
              {[
                { label: 'Recommended Sleep', value: '10:00 PM – 5:30 AM', emoji: '🌑' },
                { label: 'Your Wake Alarm', value: fmt12(settings.wakeAlarm.hour, settings.wakeAlarm.minute), emoji: '⏰' },
                { label: 'Ideal Bedtime', value: fmt12((settings.wakeAlarm.hour + 24 - 7) % 24, settings.wakeAlarm.minute), emoji: '😴' },
              ].map(r => (
                <View key={r.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Text style={{ fontSize: 22 }}>{r.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 10, color: '#FFFFFF30', fontWeight: '800', letterSpacing: 1 }}>{r.label.toUpperCase()}</Text>
                    <Text style={{ fontSize: 15, color: '#fff', fontWeight: '700', marginTop: 2 }}>{r.value}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      )}

      {activeTab === 'reports' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
          <Text style={{ fontSize: 13, fontWeight: '900', color: '#FFFFFF30', letterSpacing: 1.5, marginBottom: 16 }}>ALARM REPORTS</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Day Streak', value: String(missionSettings.streak || 0), emoji: '🔥', color: '#f97316' },
              { label: 'Active Alarms', value: String([settings.wakeAlarm.enabled ? 1 : 0, ...alarmEntries.filter(e => e.enabled)].length), emoji: '⏰', color: '#a78bfa' },
              { label: 'Missions Done', value: String(missionSettings.streak || 0), emoji: '✅', color: '#10b981' },
            ].map(s => (
              <View key={s.label} style={{ flex: 1, borderRadius: 18, borderWidth: 1, borderColor: s.color + '55', backgroundColor: s.color + '18', padding: 14, alignItems: 'center', gap: 6, overflow: 'hidden', shadowColor: s.color, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.22, shadowRadius: 10, elevation: 4 }}>
                <Text style={{ fontSize: 28 }}>{s.emoji}</Text>
                <Text style={{ fontSize: 28, fontWeight: '900', color: s.color }}>{s.value}</Text>
                <Text style={{ fontSize: 9, color: '#FFFFFF35', fontWeight: '700', textAlign: 'center' }}>{s.label.toUpperCase()}</Text>
              </View>
            ))}
          </View>
          <View style={{ borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(255,255,255,0.09)', padding: 18, gap: 14 }}>
            <Text style={{ fontSize: 12, fontWeight: '900', color: '#FFFFFF25', letterSpacing: 1.2 }}>ALARM HISTORY</Text>
            {alarmEntries.length === 0 && !settings.wakeAlarm.enabled ? (
              <Text style={{ color: '#FFFFFF30', fontSize: 12, textAlign: 'center', paddingVertical: 20 }}>No alarms set yet. Add one on the Alarm tab.</Text>
            ) : (
              [...(settings.wakeAlarm.enabled ? [{ label: 'Wake Alarm', time: fmt12(settings.wakeAlarm.hour, settings.wakeAlarm.minute), emoji: '⏰', color: '#a78bfa' }] : []),
               ...alarmEntries.map(e => ({ label: e.label, time: fmt12(e.hour, e.minute), emoji: e.habitEmoji ?? (e.type === 'habit' ? '🌿' : '⚡'), color: e.type === 'habit' ? '#10b981' : '#f97316' }))
              ].map((a, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 }}>
                  <Text style={{ fontSize: 20 }}>{a.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff' }}>{a.label}</Text>
                    <Text style={{ fontSize: 11, color: '#FFFFFF40' }}>{a.time} · Daily</Text>
                  </View>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: a.color }} />
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}

      {activeTab === 'settings' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
          <Text style={{ fontSize: 13, fontWeight: '900', color: '#FFFFFF30', letterSpacing: 1.5, marginBottom: 16 }}>SYSTEM SETTINGS</Text>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.09)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', borderRadius: 20, overflow: 'hidden', marginBottom: 16 }}>
            {([
              { emoji: '🔒', label: 'Lock In Mode', sub: "Alarm won't stop until mission done", val: missionSettings.lockInMode, onToggle: () => updateMission({ lockInMode: !missionSettings.lockInMode }), color: '#ef4444' },
              { emoji: '🤖', label: 'Bodhi Morning Brief', sub: 'AI speaks your personalized morning intel', val: missionSettings.bodhiMorningBrief, onToggle: () => updateMission({ bodhiMorningBrief: !missionSettings.bodhiMorningBrief }), color: '#a78bfa' },
              { emoji: '🌑', label: 'Brahma Muhurta Alert', sub: '4:45 AM reminder (15 min before window)', val: settings.brahmaReminder, onToggle: toggleBrahma, color: '#c084fc' },
              { emoji: '💭', label: 'Daily Check-In', sub: '8:00 AM — Bodhi awaits your check-in', val: settings.checkinReminder, onToggle: toggleCheckin, color: Colors.gold },
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
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSettingsSoundOpen(v => !v); }}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}
          >
            <View>
              <Text style={{ fontSize: 13, fontWeight: '900', color: '#FFFFFF30', letterSpacing: 1.5 }}>ALARM SOUND</Text>
              <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 2 }}>
                {MANTRAS.find(mn => mn.id === selectedMantraId)?.emoji}  {MANTRAS.find(mn => mn.id === selectedMantraId)?.label}
              </Text>
            </View>
            <Text style={{ color: '#FFFFFF25', fontSize: 14 }}>{settingsSoundOpen ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {settingsSoundOpen && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 2 }}>
                {MANTRAS.map(mn => {
                  const active = selectedMantraId === mn.id;
                  return (
                    <TouchableOpacity key={mn.id} onPress={() => handleMantraSelect(mn.id)} style={[S.mantraChip, active && { borderColor: mn.color, backgroundColor: mn.color + '18' }]}>
                      <Text style={{ fontSize: 24 }}>{mn.emoji}</Text>
                      <Text style={{ color: active ? mn.color : Colors.text, fontSize: 10, fontWeight: '800', textAlign: 'center' }}>{mn.label}</Text>
                      <Text style={{ color: mn.color + '80', fontSize: 7, textAlign: 'center' }}>{mn.hint}</Text>
                      <Text style={{ color: dlStatus[mn.id] === 'downloaded' || dlStatus[mn.id] === 'bundled' ? '#10b981' : dlStatus[mn.id] === 'downloading' ? mn.color : Colors.textDim, fontSize: 7, fontWeight: '800', textAlign: 'center' }}>
                        {dlStatus[mn.id] === 'downloaded' ? '✓ Offline' : dlStatus[mn.id] === 'bundled' ? '✓ Bundled' : dlStatus[mn.id] === 'downloading' ? `⬇ ${Math.round((dlProgress[mn.id] ?? 0) * 100)}%` : '☁ Online'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          )}
          {!batteryOptOk && (
            <TouchableOpacity onPress={() => NativeModules.AlarmModule?.requestBatteryOptimizationExemption?.()} style={{ backgroundColor: '#f9731610', borderWidth: 1, borderColor: '#f9731630', borderRadius: 16, padding: 16, marginBottom: 12 }}>
              <Text style={{ color: '#f97316', fontWeight: '800', fontSize: 13 }}>⚡ Enable Battery Optimization Exemption</Text>
              <Text style={{ color: '#FFFFFF40', fontSize: 11, marginTop: 4 }}>Required for reliable alarm delivery</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {/* Alarm list (only in alarm tab) */}
      {activeTab === 'alarm' && <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120, paddingTop: 6 }} showsVerticalScrollIndicator={false}>

        {/* ── Wake Alarm Card ── */}
        <TouchableOpacity style={[S.slimCard, S.slimCardWake]} onPress={() => setShowWakeEdit(true)} activeOpacity={0.82}>
          <LinearGradient
            colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.04)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.38)' }} />
          <View style={[S.slimBar, { backgroundColor: settings.wakeAlarm.enabled ? '#a78bfa' : 'rgba(255,255,255,0.10)' }]} />
          <View style={S.slimBody}>
            <View style={S.slimLeft}>
              <View style={S.slimPill}>
                <Text style={{ fontSize: 10 }}>⏰</Text>
                <Text style={S.slimPillTxt}>WAKE ALARM</Text>
                {missionSettings.lockInMode && <Text style={{ fontSize: 8, color: '#ef4444' }}>🔒</Text>}
              </View>
              <Text style={[S.slimTime, { color: settings.wakeAlarm.enabled ? '#fff' : '#FFFFFF28' }]}>
                {fmt12(settings.wakeAlarm.hour, settings.wakeAlarm.minute)}
              </Text>
              <Text style={S.slimSub} numberOfLines={1}>
                {playingMantra.emoji} {playingMantra.label}  ·  {MISSIONS.find(m => m.id === missionSettings.selectedMission)?.name ?? 'Mission'}
              </Text>
            </View>
            <Toggle value={settings.wakeAlarm.enabled} onToggle={toggleWake} color="#a78bfa" />
          </View>
        </TouchableOpacity>

        {/* ── Habit / Quick Alarm Cards ── */}
        {alarmEntries.map(entry => {
          const isHabit  = entry.type === 'habit';
          const accentC  = '#a78bfa';
          const timeC    = entry.enabled ? '#FFFFFF' : '#FFFFFF28';
          return (
            <TouchableOpacity
              key={entry.id}
              style={[S.slimCard, isHabit ? S.slimCardHabit : S.slimCardQuick]}
              onPress={() => openEditEntry(entry)}
              activeOpacity={0.82}>
              <LinearGradient
                colors={['rgba(255,255,255,0.13)', 'rgba(255,255,255,0.04)', 'transparent']}
                start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.32)' }} />
              <View style={[S.slimBar, { backgroundColor: entry.enabled ? (isHabit ? '#6ee7b7' : '#f97316') : 'rgba(255,255,255,0.10)' }]} />
              <View style={S.slimBody}>
                <View style={S.slimLeft}>
                  <View style={S.slimPill}>
                    <Text style={{ fontSize: 10 }}>{isHabit ? (entry.habitEmoji ?? '🌿') : '⚡'}</Text>
                    <Text style={S.slimPillTxt}>{isHabit ? 'HABIT' : 'QUICK'}</Text>
                  </View>
                  <Text style={[S.slimTime, { color: timeC }]}>
                    {fmt12(entry.hour, entry.minute)}
                  </Text>
                  <Text style={S.slimSub} numberOfLines={1}>{entry.label}</Text>
                </View>
                <View style={S.slimRight}>
                  <Toggle value={entry.enabled} onToggle={() => toggleEntry(entry.id)} color={accentC} />
                  <TouchableOpacity onPress={() => deleteEntry(entry.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Text style={S.slimDelete}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Empty state */}
        {alarmEntries.length === 0 && (
          <View style={S.emptyHint}>
            <Text style={S.emptyIcon}>＋</Text>
            <Text style={S.emptyTxt}>Add habit or quick alarms below</Text>
            <Text style={{ color: '#FFFFFF15', fontSize: 11 }}>Tap the + button</Text>
          </View>
        )}
      </ScrollView>}

      {/* ── FAB (alarm tab only) ── */}
      {activeTab === 'alarm' && fabOpen && <TouchableOpacity style={S.fabBackdrop} onPress={() => setFabOpen(false)} activeOpacity={1} />}
      {activeTab === 'alarm' && fabOpen && (
        <View style={S.fabMenu}>
          {([
            { label: '⏰  Wake Alarm', color: '#a78bfa', onPress: () => { setFabOpen(false); setShowWakeEdit(true); } },
            { label: '🌿  Habit Alarm', color: '#10b981', onPress: () => { setFabOpen(false); openAddModal('habit'); } },
            { label: '⚡  Quick Alarm', color: '#f97316', onPress: () => { setFabOpen(false); openAddModal('quick'); } },
          ] as const).map((item, i) => (
            <TouchableOpacity key={i} style={[S.fabMenuItem, { borderColor: item.color + '50' }]} onPress={item.onPress} activeOpacity={0.85}>
              <Text style={[S.fabMenuItemTxt, { color: item.color }]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {activeTab === 'alarm' && (
        <TouchableOpacity style={[S.fab, fabOpen && S.fabOpen]} onPress={toggleFab} activeOpacity={0.85}>
          <Text style={S.fabTxt}>{fabOpen ? '✕' : '+'}</Text>
        </TouchableOpacity>
      )}

      {/* ── Bottom Tab Bar ── */}
      <View style={[S.tabBar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        {([
          { key: 'alarm', emoji: '⏰', label: 'Alarm' },
          { key: 'sleep', emoji: '🌙', label: 'Sleep' },
          { key: 'reports', emoji: '📊', label: 'Reports' },
          { key: 'settings', emoji: '⚙️', label: 'Settings' },
        ] as const).map(t => {
          const active = activeTab === t.key;
          return (
            <TouchableOpacity key={t.key} style={S.tabItem} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveTab(t.key); }} activeOpacity={0.7}>
              <View style={[S.tabIconWrap, active && { backgroundColor: '#a78bfa22' }]}>
                <Text style={{ fontSize: 20 }}>{t.emoji}</Text>
              </View>
              <Text style={[S.tabLabel, { color: active ? '#a78bfa' : '#FFFFFF30' }]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Wake Alarm Edit Modal ── */}
      <Modal visible={showWakeEdit} animationType="slide" transparent onRequestClose={() => setShowWakeEdit(false)}>
        <View style={S.sheetOverlay}>
          <View style={S.sheet}>
            <View style={S.sheetHandle} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={S.sheetTitle}>⏰  Wake Alarm</Text>
              <TimeAdjuster hour={settings.wakeAlarm.hour} minute={settings.wakeAlarm.minute} onChange={setWakeTime} />

              {/* Prakriti plan */}
              {prakritiWake && (
                <TouchableOpacity
                  style={[S.prakritiRow, { borderColor: prakritiWake.color + '50' }]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); persistAndApply({ ...settings, wakeAlarm: { enabled: true, hour: prakritiWake.hour, minute: prakritiWake.minute } }); }}
                >
                  <Text style={{ fontSize: 16 }}>🌿</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 9, fontWeight: '900', color: prakritiWake.color, letterSpacing: 1 }}>YOUR PRAKRITI PLAN</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.text }}>{prakritiWake.label}</Text>
                  </View>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: prakritiWake.color }}>
                    {settings.wakeAlarm.hour === prakritiWake.hour && settings.wakeAlarm.minute === prakritiWake.minute ? '✓ SET' : 'Apply →'}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Presets */}
              <Text style={S.sheetSection}>QUICK PRESETS</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                {PRESETS.map(p => {
                  const active = settings.wakeAlarm.hour === p.hour && settings.wakeAlarm.minute === p.minute;
                  return (
                    <TouchableOpacity key={p.label} onPress={() => applyPreset(p)} style={[S.presetChip, active && { borderColor: p.color, backgroundColor: p.color + '18' }]}>
                      <Text style={[S.presetChipTime, { color: active ? p.color : Colors.textDim }]}>{p.sub}</Text>
                      <Text style={S.presetChipLabel}>{p.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Alarm Sound — accordion */}
              <TouchableOpacity
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setModalSoundOpen(v => !v); }}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, marginTop: 8, borderTopWidth: 1, borderTopColor: '#FFFFFF0A' }}
              >
                <View>
                  <Text style={{ fontSize: 8, fontWeight: '900', color: '#FFFFFF28', letterSpacing: 1.6 }}>ALARM SOUND</Text>
                  <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 3 }}>
                    {MANTRAS.find(mn => mn.id === selectedMantraId)?.emoji}  {MANTRAS.find(mn => mn.id === selectedMantraId)?.label}
                  </Text>
                </View>
                <Text style={{ color: '#FFFFFF35', fontSize: 16 }}>{modalSoundOpen ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              {modalSoundOpen && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 2 }}>
                    {MANTRAS.map(mn => {
                      const active = selectedMantraId === mn.id;
                      return (
                        <TouchableOpacity key={mn.id} onPress={() => handleMantraSelect(mn.id)} style={[S.mantraChip, active && { borderColor: mn.color, backgroundColor: mn.color + '18' }]}>
                          <Text style={{ fontSize: 24 }}>{mn.emoji}</Text>
                          <Text style={{ color: active ? mn.color : Colors.text, fontSize: 10, fontWeight: '800', textAlign: 'center' }}>{mn.label}</Text>
                          <Text style={{ color: mn.color + '80', fontSize: 7, textAlign: 'center' }}>{mn.hint}</Text>
                          <Text style={{ color: dlStatus[mn.id] === 'downloaded' || dlStatus[mn.id] === 'bundled' ? '#10b981' : dlStatus[mn.id] === 'downloading' ? mn.color : Colors.textDim, fontSize: 7, fontWeight: '800', textAlign: 'center' }}>
                            {dlStatus[mn.id] === 'downloaded' ? '✓ Offline' : dlStatus[mn.id] === 'bundled' ? '✓ Bundled' : dlStatus[mn.id] === 'downloading' ? `⬇ ${Math.round((dlProgress[mn.id] ?? 0) * 100)}%` : '☁ Online'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              )}

              {/* Mission — accordion */}
              <TouchableOpacity
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setModalMissionOpen(v => !v); }}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#FFFFFF0A' }}
              >
                <View>
                  <Text style={{ fontSize: 8, fontWeight: '900', color: '#FFFFFF28', letterSpacing: 1.6 }}>MORNING MISSION</Text>
                  <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 3 }}>
                    {MISSIONS.find(ms => ms.id === missionSettings.selectedMission)?.icon}  {MISSIONS.find(ms => ms.id === missionSettings.selectedMission)?.name}
                  </Text>
                </View>
                <Text style={{ color: '#FFFFFF35', fontSize: 16 }}>{modalMissionOpen ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              {modalMissionOpen && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16, marginTop: 8 }}>
                  {MISSIONS.map(ms => {
                    const active = missionSettings.selectedMission === ms.id;
                    return (
                      <TouchableOpacity key={ms.id} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); updateMission({ selectedMission: ms.id }); }}
                        style={[S.missionChip, { borderColor: active ? ms.color : 'rgba(255,255,255,0.18)', backgroundColor: active ? ms.color + '20' : 'rgba(255,255,255,0.09)' }]}
                      >
                        <Text style={{ fontSize: 22 }}>{ms.icon}</Text>
                        <Text style={{ fontSize: 11, fontWeight: '800', color: active ? ms.color : Colors.textMuted, textAlign: 'center' }}>{ms.name}</Text>
                        {active && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ms.color }} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* System toggles */}
              <Text style={S.sheetSection}>SYSTEM SETTINGS</Text>
              <View style={S.settingsCard}>
                {([
                  { emoji: '🔒', label: 'Lock In Mode', sub: "Alarm won't stop until mission done", val: missionSettings.lockInMode, onToggle: () => updateMission({ lockInMode: !missionSettings.lockInMode }), color: '#ef4444' },
                  { emoji: '🤖', label: 'Bodhi Morning Brief', sub: 'AI speaks your personalized morning intel', val: missionSettings.bodhiMorningBrief, onToggle: () => updateMission({ bodhiMorningBrief: !missionSettings.bodhiMorningBrief }), color: '#a78bfa' },
                  { emoji: '🌑', label: 'Brahma Muhurta Alert', sub: '4:45 AM reminder (15 min before window)', val: settings.brahmaReminder, onToggle: toggleBrahma, color: '#c084fc' },
                  { emoji: '💭', label: 'Daily Check-In', sub: '8:00 AM — Bodhi awaits your check-in', val: settings.checkinReminder, onToggle: toggleCheckin, color: Colors.gold },
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

              {/* Streak */}
              {missionSettings.streak > 0 && (
                <LinearGradient colors={[ACCENT + '18', ACCENT + '08']} style={S.streakBanner}>
                  <Text style={{ fontSize: 26 }}>🔥</Text>
                  <View>
                    <Text style={{ color: ACCENT, fontWeight: '900', fontSize: 15 }}>Day {missionSettings.streak} Streak</Text>
                    <Text style={{ color: Colors.textMuted, fontSize: 11 }}>Every. Single. Day.</Text>
                  </View>
                </LinearGradient>
              )}

              {/* Test alarm */}
              <Text style={S.sheetSection}>TEST ALARM</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
                <TouchableOpacity onPress={() => { setShowWakeEdit(false); setTimeout(() => fireTestNotification('mantra'), 200); }} style={[S.testBtn, { borderColor: '#a78bfa40', backgroundColor: '#a78bfa10' }]}>
                  <Text style={{ fontSize: 24 }}>🔔</Text>
                  <Text style={{ color: '#a78bfa', fontWeight: '800', fontSize: 11 }}>Test (5 sec)</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setShowWakeEdit(false); setTimeout(() => playAlarmSound('mantra'), 200); }} style={[S.testBtn, { borderColor: '#fbbf2440', backgroundColor: '#fbbf2410' }]}>
                  <Text style={{ fontSize: 24 }}>🎵</Text>
                  <Text style={{ color: '#fbbf24', fontWeight: '800', fontSize: 11 }}>Preview Sound</Text>
                </TouchableOpacity>
              </View>

              <View style={{ height: 12 }} />
            </ScrollView>
            {/* Done button pinned outside ScrollView — always visible */}
            <TouchableOpacity onPress={() => setShowWakeEdit(false)} style={[S.sheetDoneBtn, { margin: 16, marginTop: 8 }]}>
              <Text style={S.sheetDoneTxt}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Add / Edit Habit Alarm — Step 1: Pick a habit (FULL SCREEN) ── */}
      <Modal
        visible={(addType === 'habit' || editEntry?.type === 'habit') && formHabitKey === ''}
        animationType="slide"
        transparent={false}
        onRequestClose={() => { setAddType(null); setEditEntry(null); }}
      >
        <View style={{ flex: 1, backgroundColor: '#060610' }}>
          <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#FFFFFF08' }}>
              <TouchableOpacity onPress={() => { setAddType(null); setEditEntry(null); }} style={{ padding: 4 }}>
                <Text style={{ color: '#FFFFFF50', fontSize: 22, fontWeight: '300' }}>✕</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 13, fontWeight: '900', color: '#FFFFFF35', letterSpacing: 2 }}>CHOOSE HABIT</Text>
              <View style={{ width: 32 }} />
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
              <Text style={{ color: Colors.textMuted, fontSize: 13, marginBottom: 20, lineHeight: 18 }}>
                Select a habit to set a daily alarm for.
              </Text>
              <Text style={S.sheetSection}>AYURVEDIC HABITS</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                {AYU_HABITS.filter(h => h.key !== 'custom').map(h => (
                  <TouchableOpacity key={h.key} onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setFormHabitKey(h.key);
                    setFormHabitEmoji(h.emoji);
                    setFormLabel(h.label);
                    setShowCustomHabitInput(false);
                  }}
                    style={[S.habitChip, { width: (width - 40 - 30) / 4 }]}
                    activeOpacity={0.75}
                  >
                    <Text style={{ fontSize: 26 }}>{h.emoji}</Text>
                    <Text style={{ fontSize: 9, fontWeight: '700', color: Colors.textDim, textAlign: 'center', lineHeight: 13 }}>{h.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setFormHabitKey('custom');
                  setFormHabitEmoji('✨');
                  setShowCustomHabitInput(true);
                  setFormLabel('');
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderRadius: 18, padding: 16, borderColor: '#FFFFFF14', backgroundColor: '#FFFFFF04' }}
                activeOpacity={0.8}
              >
                <View style={{ width: 50, height: 50, borderRadius: 14, backgroundColor: '#FFFFFF08', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 24 }}>✨</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#fff' }}>Custom Habit</Text>
                  <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 2 }}>Type any habit name</Text>
                </View>
                <Text style={{ color: '#FFFFFF25', fontSize: 18 }}>›</Text>
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {/* ── Add / Edit Habit Alarm — Step 2: Full-screen alarm setter ── */}
      <Modal
        visible={(addType === 'habit' || editEntry?.type === 'habit') && formHabitKey !== ''}
        animationType="slide"
        transparent={false}
        onRequestClose={() => { setFormHabitKey(''); setShowCustomHabitInput(false); if (editEntry) { setEditEntry(null); setAddType(null); } }}
      >
        <View style={{ flex: 1, backgroundColor: '#060610' }}>
          <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>

            {/* ── Top bar ── */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#FFFFFF08' }}>
              <TouchableOpacity
                onPress={() => { setFormHabitKey(''); setShowCustomHabitInput(false); }}
                style={{ paddingVertical: 4, paddingRight: 12 }}
              >
                <Text style={{ color: '#FFFFFF50', fontSize: 15, fontWeight: '600' }}>← Back</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 12, fontWeight: '900', color: '#FFFFFF30', letterSpacing: 2.5 }}>SET ALARM</Text>
              <View style={{ width: 60 }} />
            </View>

            {/* ── Habit badge ── */}
            <View style={{ alignItems: 'center', paddingTop: 22, paddingBottom: 10, gap: 8 }}>
              <View style={{ width: 80, height: 80, borderRadius: 26, backgroundColor: '#10b98115', borderWidth: 1.5, borderColor: '#10b98130', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 40 }}>{formHabitEmoji}</Text>
              </View>
              <Text style={{ fontSize: 22, fontWeight: '900', color: '#fff', marginTop: 4 }}>
                {formLabel || 'Custom Habit'}
              </Text>
              <TouchableOpacity onPress={() => { setFormHabitKey(''); setShowCustomHabitInput(false); }} activeOpacity={0.7}>
                <Text style={{ fontSize: 12, color: '#10b98165', fontWeight: '700', letterSpacing: 0.3 }}>✎  Change habit</Text>
              </TouchableOpacity>
            </View>

            {/* ── Custom label input ── */}
            {showCustomHabitInput && (
              <TextInput
                style={[S.customInput, { marginHorizontal: 24, marginBottom: 8 }]}
                placeholder="e.g. Oil Pulling, Face Wash..."
                placeholderTextColor={Colors.textDim}
                value={formLabel}
                onChangeText={setFormLabel}
                autoFocus
              />
            )}

            {/* ── Time picker — large, centered ── */}
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 }}>
              <TimeAdjuster
                hour={formHour}
                minute={formMinute}
                onChange={(h, m) => { setFormHour(h); setFormMinute(m); }}
              />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#7C3AED' }} />
                <Text style={{ fontSize: 13, color: '#FFFFFF25', fontWeight: '700', letterSpacing: 0.4 }}>
                  {fmt12(formHour, formMinute)}  ·  Daily
                </Text>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#7C3AED' }} />
              </View>
            </View>

            {/* ── Quick presets ── */}
            <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
              <Text style={{ fontSize: 9, fontWeight: '900', color: '#FFFFFF22', letterSpacing: 2, marginBottom: 10 }}>QUICK PRESETS</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {PRESETS.map(p => {
                  const active = formHour === p.hour && formMinute === p.minute;
                  return (
                    <TouchableOpacity
                      key={p.label}
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setFormHour(p.hour); setFormMinute(p.minute); }}
                      style={[S.presetChip, { flex: 1 }, active && { borderColor: p.color, backgroundColor: p.color + '18' }]}
                      activeOpacity={0.8}
                    >
                      <Text style={[S.presetChipTime, { color: active ? p.color : Colors.textDim }]}>{p.sub}</Text>
                      <Text style={S.presetChipLabel}>{p.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* ── Shower tip (context card) ── */}
            {formHabitKey === 'shower' && (
              <View style={{ marginHorizontal: 20, marginBottom: 14, borderRadius: 16, borderWidth: 1, borderColor: '#38bdf835', backgroundColor: '#0ea5e90C', padding: 14, flexDirection: 'row', gap: 10 }}>
                <Text style={{ fontSize: 20 }}>🌊</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, fontWeight: '900', color: '#38bdf8', letterSpacing: 1, marginBottom: 3 }}>BATHING WISDOM</Text>
                  <Text style={{ fontSize: 11, color: '#e0f2fe', lineHeight: 17 }}>Open-air bath with natural water — strengthens skin, sharpens senses, builds vitality.</Text>
                </View>
              </View>
            )}

            {/* ── SET ALARM button ── */}
            <TouchableOpacity
              onPress={saveNewEntry}
              style={{ marginHorizontal: 20, marginBottom: 10, backgroundColor: '#7C3AED', borderRadius: 20, paddingVertical: 19, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10, shadowColor: '#7C3AED', shadowOpacity: 0.55, shadowRadius: 20, elevation: 8 }}
              activeOpacity={0.85}
            >
              <Text style={{ fontSize: 20 }}>🔔</Text>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 17, letterSpacing: 0.3 }}>
                {editEntry
                  ? `Update Alarm  ·  ${fmt12(formHour, formMinute)}`
                  : `Set Alarm  ·  ${fmt12(formHour, formMinute)}`}
              </Text>
            </TouchableOpacity>

          </SafeAreaView>
        </View>
      </Modal>

      {/* ── Add / Edit Quick Alarm Modal ── */}
      <Modal visible={addType === 'quick' || editEntry?.type === 'quick'} animationType="slide" transparent onRequestClose={() => { setAddType(null); setEditEntry(null); }}>
        <View style={S.sheetOverlay}>
          <View style={S.sheet}>
            <View style={S.sheetHandle} />
            <Text style={S.sheetTitle}>⚡  Quick Alarm</Text>
            <Text style={{ color: Colors.textMuted, fontSize: 12, marginBottom: 12 }}>Rings once — no mission, just stop it.</Text>
            <TimeAdjuster hour={formHour} minute={formMinute} onChange={(h, m) => { setFormHour(h); setFormMinute(m); }} />
            <Text style={S.sheetSection}>LABEL (optional)</Text>
            <TextInput style={S.customInput} placeholder="e.g. Medicine, Meeting, Workout..." placeholderTextColor={Colors.textDim} value={formLabel} onChangeText={setFormLabel} />
            <TouchableOpacity onPress={saveNewEntry} style={[S.saveBtn, { marginTop: 16 }]}>
              <Text style={S.saveBtnTxt}>{editEntry ? '✓ Update Quick Alarm' : '✓ Save Quick Alarm'}</Text>
            </TouchableOpacity>
            <View style={{ height: 48 }} />
          </View>
        </View>
      </Modal>

      {/* ── Foreground Preview Modal ── */}
      <Modal visible={alarmModal} animationType="fade" transparent statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: 'rgba(4,2,18,0.97)', alignItems: 'center', justifyContent: 'center', padding: 28 }}>
          <LinearGradient
            colors={alarmType === 'gayatri' ? [`${playingMantra.color}20`, `${playingMantra.color}10`] : ['#a78bfa20', '#8b5cf620']}
            style={{ width: '100%', borderRadius: 28, borderWidth: 1.5, borderColor: alarmType === 'gayatri' ? `${playingMantra.color}50` : '#a78bfa50', padding: 28, alignItems: 'center', gap: 20 }}
          >
            <Text style={{ fontSize: 60 }}>{alarmType === 'gayatri' ? playingMantra.emoji : '🔔'}</Text>
            <Text style={{ fontSize: 11, fontWeight: '900', color: alarmType === 'gayatri' ? playingMantra.color : '#a78bfa', letterSpacing: 2 }}>
              {alarmType === 'gayatri' ? (playingMantra.label.toUpperCase() + ' CHANTING') : 'MANTRA ALARM PREVIEW'}
            </Text>
            <TouchableOpacity onPress={stopAlarmSound}
              style={{ backgroundColor: '#ef444420', borderWidth: 1.5, borderColor: '#ef444450', borderRadius: 99, paddingVertical: 16, paddingHorizontal: 32, width: '100%', alignItems: 'center' }}
              activeOpacity={0.8}>
              <Text style={{ color: '#ef4444', fontWeight: '900', fontSize: 16 }}>⏹  Stop Preview</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setAlarmModal(false)} style={{ paddingVertical: 8 }} activeOpacity={0.7}>
              <Text style={{ color: Colors.textMuted, fontSize: 12 }}>Continue in background</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </Modal>
    </View>
  );
}

const S = StyleSheet.create({
  screen:          { flex: 1, backgroundColor: '#060610' },
  heroBg:          { width: '100%', height: 185 },
  heroGrad:        { flex: 1 },
  heroTop:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 6, paddingBottom: 6 },
  backBtn:         { paddingVertical: 6, paddingRight: 12 },
  backTxt:         { color: '#FFFFFF55', fontSize: 13, fontWeight: '600' },
  heroCenter:      { alignItems: 'center', paddingBottom: 8, paddingTop: 2 },
  heroLabel:       { fontSize: 9, fontWeight: '900', color: '#FFFFFF40', letterSpacing: 2.5, marginBottom: 4 },
  heroTime:        { fontSize: 48, fontWeight: '200', color: '#fff', letterSpacing: -2, lineHeight: 56 },
  heroBadge:       { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, backgroundColor: 'rgba(167,139,250,0.22)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.50)', borderRadius: 99, paddingHorizontal: 14, paddingVertical: 6 },
  heroDot:         { width: 6, height: 6, borderRadius: 3, backgroundColor: '#a78bfa' },
  heroBadgeTxt:    { fontSize: 12, fontWeight: '700', color: '#c4b5fd' },
  heroNoAlarm:     { fontSize: 28, fontWeight: '200', color: '#FFFFFF30', letterSpacing: -0.5, marginTop: 4 },
  heroNoAlarmSub:  { fontSize: 12, color: '#FFFFFF25', marginTop: 6 },
  permsBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9731610', borderBottomWidth: 1, borderBottomColor: '#f9731625', paddingHorizontal: 16, paddingVertical: 10 },
  permsText: { flex: 1, color: '#f97316', fontSize: 11, fontWeight: '700' },
  permsChevron: { color: '#f97316', fontSize: 14, fontWeight: '900' },
  alarmCard: { marginHorizontal: 16, marginTop: 10, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(255,255,255,0.09)', overflow: 'hidden', elevation: 6, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 5 } },
  alarmCardActive: { borderColor: 'rgba(255,255,255,0.24)' },
  alarmCardHabit: { borderColor: 'rgba(167,139,250,0.30)' },
  alarmCardQuick: { borderColor: 'rgba(249,115,22,0.30)' },
  alarmCardInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, gap: 12 },
  alarmLeft: { flex: 1, gap: 3 },
  alarmTypePill: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  alarmTypeEmoji: { fontSize: 11 },
  alarmTypeTxt: { fontSize: 8, fontWeight: '900', color: '#FFFFFF35', letterSpacing: 1.2 },
  alarmTime: { fontSize: 44, letterSpacing: -1.5, lineHeight: 52, fontWeight: '200' },
  alarmTimeOn: { color: '#fff' },
  alarmTimeOff: { color: '#FFFFFF25' },
  alarmTimeHabit: { color: '#6ee7b7' },
  alarmTimeQuick: { color: '#fdba74' },
  alarmSub: { fontSize: 11, color: '#FFFFFF40', fontWeight: '500' },
  // ── Slim premium card styles ──────────────────────────────────────────────
  slimCard: {
    marginHorizontal: 16, marginTop: 6, borderRadius: 18, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)', backgroundColor: 'rgba(255,255,255,0.09)',
    flexDirection: 'row', overflow: 'hidden',
    elevation: 7, shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 18, shadowOffset: { width: 0, height: 6 },
  },
  slimCardWake:  { borderColor: 'rgba(255,255,255,0.22)' },
  slimCardHabit: { borderColor: 'rgba(255,255,255,0.22)' },
  slimCardQuick: { borderColor: 'rgba(255,255,255,0.22)' },
  slimBar:  { width: 2, borderRadius: 1, marginVertical: 10, marginHorizontal: 4 },
  slimBody: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingRight: 14, paddingLeft: 10 },
  slimLeft: { flex: 1, gap: 2 },
  slimPill: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 1 },
  slimPillTxt: { fontSize: 8, fontWeight: '900', color: '#FFFFFF30', letterSpacing: 1.5 },
  slimTime: { fontSize: 28, fontWeight: '200', letterSpacing: -1, lineHeight: 33 },
  slimSub:  { fontSize: 10, color: '#FFFFFF38', fontWeight: '500', marginTop: 1 },
  slimRight:{ alignItems: 'center', gap: 8 },
  slimDelete: { fontSize: 11, color: '#f43f5e50', fontWeight: '900', paddingTop: 2 },
  emptyHint: { marginHorizontal: 16, marginTop: 32, alignItems: 'center', gap: 8, paddingVertical: 44, borderRadius: 22, borderWidth: 1, borderColor: '#FFFFFF06', borderStyle: 'dashed' },
  emptyIcon: { fontSize: 40, color: '#FFFFFF10' },
  emptyTxt: { fontSize: 13, color: '#FFFFFF22', fontWeight: '500' },
  fab: { position: 'absolute', bottom: 90, right: 24, width: 60, height: 60, borderRadius: 30, backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center', elevation: 10, shadowColor: '#7C3AED', shadowOpacity: 0.6, shadowRadius: 16 },
  fabOpen: { backgroundColor: '#4C1D95' },
  fabTxt: { fontSize: 30, color: '#fff', fontWeight: '200', lineHeight: 36, marginTop: 2 },
  fabBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9 },
  fabMenu: { position: 'absolute', bottom: 162, right: 24, gap: 8, alignItems: 'flex-end', zIndex: 10 },
  fabMenuItem: { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderRadius: 16, paddingHorizontal: 20, paddingVertical: 13, elevation: 8, shadowColor: '#000', shadowOpacity: 0.30, shadowRadius: 16, shadowOffset: { width: 0, height: 5 } },
  fabMenuItemTxt: { fontSize: 14, fontWeight: '800' },
  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000075' },
  sheet: { backgroundColor: '#0D0D20', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, maxHeight: '92%' },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#FFFFFF18', alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 20, fontWeight: '900', color: '#fff', marginBottom: 6 },
  sheetSection: { fontSize: 8, fontWeight: '900', color: '#FFFFFF28', letterSpacing: 1.6, marginTop: 16, marginBottom: 8 },
  presetChip: { flex: 1, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(255,255,255,0.09)', padding: 10, alignItems: 'center', gap: 2 },
  presetChipTime: { fontSize: 12, fontWeight: '900' },
  presetChipLabel: { fontSize: 8, color: '#FFFFFF30', fontWeight: '600' },
  prakritiRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 6, backgroundColor: 'rgba(255,255,255,0.09)' },
  mantraChip: { width: 104, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(255,255,255,0.09)', padding: 10, alignItems: 'center', gap: 4 },
  missionChip: { borderRadius: 14, borderWidth: 1, padding: 12, alignItems: 'center', gap: 4, width: (width - 40 - 8) / 2 },
  settingsCard: { backgroundColor: 'rgba(255,255,255,0.09)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', borderRadius: 18, marginBottom: 10, overflow: 'hidden' },
  settingsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  streakBanner: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, borderWidth: 1, borderColor: ACCENT + '30', padding: 14, marginBottom: 14, marginTop: 4 },
  testBtn: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 14, alignItems: 'center', gap: 4 },
  sheetDoneBtn: { backgroundColor: '#7C3AED25', borderWidth: 1, borderColor: '#7C3AED50', borderRadius: 99, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  sheetDoneTxt: { color: '#a78bfa', fontWeight: '900', fontSize: 15 },
  habitChip: { borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(255,255,255,0.09)', padding: 10, alignItems: 'center', gap: 4, width: (width - 40 - 24) / 4 },
  customInput: { backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, color: '#fff', fontSize: 14, marginBottom: 8 },
  saveBtn: { backgroundColor: '#10b98118', borderWidth: 1, borderColor: '#10b98140', borderRadius: 99, paddingVertical: 14, alignItems: 'center' },
  saveBtnTxt: { color: '#10b981', fontWeight: '900', fontSize: 15 },
  tabBar: { flexDirection: 'row', backgroundColor: 'rgba(12,12,28,0.96)', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.14)', paddingTop: 8, paddingHorizontal: 4 },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 2 },
  tabIconWrap: { width: 44, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.1 },
});
