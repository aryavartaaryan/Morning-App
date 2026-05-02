import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, Modal,
  TextInput, Alert, Animated, Dimensions, NativeModules, Platform, ToastAndroid,
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
import notifee, { AndroidImportance, AndroidCategory, AndroidVisibility, TriggerType, RepeatFrequency } from '@notifee/react-native';
import { Colors, Spacing, Radius, Font } from '@/constants/theme';
import { PRAKRITI_PLANS, type PledgeData } from '@/lib/prakritiPlan';

const ACCENT = '#F5820A';
const { width } = Dimensions.get('window');

const MANTRA_TO_WAKE_SOUND: Record<string, string> = {
  gayatri: 'gayatri', lalitha: 'lalitha', shivtandav: 'shiv_tandav',
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
  { key: 'wake_early', label: 'Wake Early', emoji: '🌙' },
  { key: 'warm_water', label: 'Warm Water', emoji: '💧' },
  { key: 'meditation', label: 'Meditation', emoji: '🧘' },
  { key: 'pranayama', label: 'Pranayama', emoji: '🌬️' },
  { key: 'sunlight', label: 'Sunlight', emoji: '☀️' },
  { key: 'breakfast', label: 'Breakfast', emoji: '🌾' },
  { key: 'main_meal', label: 'Main Meal', emoji: '🍛' },
  { key: 'walk', label: 'Shatapavali Walk', emoji: '🚶' },
  { key: 'herbal_tea', label: 'Herbal Tea', emoji: '🍵' },
  { key: 'evening_walk', label: 'Evening Walk', emoji: '🌆' },
  { key: 'light_dinner', label: 'Light Dinner', emoji: '🥗' },
  { key: 'screen_free', label: 'Screen-free Time', emoji: '📵' },
  { key: 'journaling', label: 'Journaling', emoji: '📓' },
  { key: 'sleep', label: 'Sleep by 10 PM', emoji: '🌑' },
  { key: 'custom', label: 'Custom Habit', emoji: '✨' },
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
  },
  {
    id: 'lalitha', label: 'Lalitha Sahasranama', emoji: '🌺', color: '#f472b6',
    hint: 'ॐ ऐं ह्रीं श्रीं', pitch: 0.80, rate: 0.65,
    text: 'Om Aim Hreem Shreem, Sri Lalitha Tripura Sundari, Namami Namami Namami. Om Shakti Shakti Shakti.',
    audioUrl: 'https://ik.imagekit.io/rcsesr4xf/Lalitha-Sahasranamam.mp3',
  },
  {
    id: 'shivtandav', label: 'Shiv Tandav', emoji: '🔱', color: '#a78bfa',
    hint: 'ॐ नमः शिवाय', pitch: 0.75, rate: 0.68,
    text: 'Jata tavee galajjala pravaha pavithrasthale. Om Namah Shivaya, Om Namah Shivaya. Har Har Mahadev.',
    audioUrl: 'https://ik.imagekit.io/rcsesr4xf/Shiva-Tandav.mp3',
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
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

function DrumColumn({ values, selected, onChange }: {
  values: number[]; selected: number; onChange: (v: number) => void;
}) {
  const ref = useRef<ScrollView>(null);
  const lastEmit = useRef(selected);
  const momentumStarted = useRef(false);
  const didMount = useRef(false);

  useEffect(() => {
    if (didMount.current) return;
    didMount.current = true;
    const idx = values.indexOf(selected);
    setTimeout(() => ref.current?.scrollTo({ y: idx * DRUM_H, animated: false }), 100);
  }, []);

  useEffect(() => {
    if (lastEmit.current !== selected) {
      const idx = values.indexOf(selected);
      ref.current?.scrollTo({ y: idx * DRUM_H, animated: true });
      lastEmit.current = selected;
    }
  }, [selected]);

  const snap = (y: number) => {
    const idx = Math.max(0, Math.min(Math.round(y / DRUM_H), values.length - 1));
    const v = values[idx];
    if (v !== lastEmit.current) {
      lastEmit.current = v;
      onChange(v);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    ref.current?.scrollTo({ y: idx * DRUM_H, animated: false });
  };

  return (
    <View style={{ height: DRUM_H * 3, overflow: 'hidden', minWidth: 64 }}>
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={DRUM_H}
        decelerationRate="fast"
        scrollEventThrottle={16}
        nestedScrollEnabled={true}
        onScrollBeginDrag={() => { momentumStarted.current = false; }}
        onMomentumScrollBegin={() => { momentumStarted.current = true; }}
        onMomentumScrollEnd={e => { momentumStarted.current = false; snap(e.nativeEvent.contentOffset.y); }}
        onScrollEndDrag={e => { if (!momentumStarted.current) snap(e.nativeEvent.contentOffset.y); }}
      >
        <View style={{ height: DRUM_H }} />
        {values.map(v => (
          <View key={v} style={{ height: DRUM_H, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{
              fontSize: v === selected ? 42 : 26,
              fontWeight: v === selected ? '100' : '300',
              color: v === selected ? '#FFFFFF' : '#FFFFFF28',
              letterSpacing: -1.5,
              textAlign: 'center',
            }}>
              {String(v).padStart(2, '0')}
            </Text>
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
      <View>
        {/* selection highlight band */}
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: DRUM_H, height: DRUM_H, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#FFFFFF15', backgroundColor: '#FFFFFF05', zIndex: 1 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
          <DrumColumn values={HOURS} selected={hour} onChange={h => onChange(h, minute)} />
          <Text style={{ fontSize: 36, fontWeight: '100', color: '#FFFFFF35', paddingHorizontal: 8, marginTop: 0, alignSelf: 'center' }}>:</Text>
          <DrumColumn values={MINUTES} selected={minute} onChange={m => onChange(hour, m)} />
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
  const [dlStatus, setDlStatus] = useState<Record<string, 'idle' | 'downloading' | 'downloaded'>>(
    { gayatri: 'idle', lalitha: 'idle', shivtandav: 'idle' }
  );
  const [dlProgress, setDlProgress] = useState<Record<string, number>>({});

  // ── Multi-alarm entries state (habit + quick) ──────────────────────────────
  const [alarmEntries, setAlarmEntries] = useState<AlarmEntry[]>([]);

  // ── FAB state ──────────────────────────────────────────────────────────────
  const [fabOpen, setFabOpen] = useState(false);
  const fabAnim = useRef(new Animated.Value(0)).current;

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
      const statuses: Record<string, 'idle' | 'downloading' | 'downloaded'> = {};
      for (const m of MANTRAS) {
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
    // If already downloaded, update native path immediately so the service plays the right file
    if (dlStatus[id] === 'downloaded') {
      setNativeAlarmSoundPath(getLocalMantraPath(id)).catch(() => {});
      return;
    }
    if (dlStatus[id] === 'downloading') return;
    const m = MANTRAS.find(x => x.id === id);
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
    const title = entry.type === 'habit' ? `${entry.habitEmoji ?? '🌿'} ${entry.label}` : `⚡ ${entry.label || 'Quick Alarm'}`;

    // Habit alarms on Android: use notifee full-screen intent (rings even when screen is off)
    if (Platform.OS === 'android' && entry.type === 'habit') {
      try {
        await notifee.createChannel({
          id: 'onesutra-habit-alarms',
          name: 'OneSutra Habit Alarms',
          importance: AndroidImportance.HIGH,
          sound: 'mantra_alarm',
          vibration: true,
          vibrationPattern: [0, 600, 300, 600],
          bypassDnd: true,
          visibility: AndroidVisibility.PUBLIC,
        } as any);
        const now = new Date();
        const next = new Date();
        next.setHours(entry.hour, entry.minute, 0, 0);
        if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
        await notifee.createTriggerNotification(
          {
            id: `habit-${entry.id}`,
            title,
            body: 'Time for your habit! Tap to confirm. 🙏',
            android: {
              channelId: 'onesutra-habit-alarms',
              importance: AndroidImportance.HIGH,
              category: AndroidCategory.ALARM,
              visibility: AndroidVisibility.PUBLIC,
              fullScreenAction: { id: 'default', launchActivity: 'default' },
              pressAction: { id: 'default', launchActivity: 'default' },
            } as any,
            data: { type: 'habit-alarm', alarmId: entry.id, habitKey: entry.habitKey ?? entry.id, habitEmoji: entry.habitEmoji ?? '🌿', label: entry.label },
          },
          { type: TriggerType.TIMESTAMP, timestamp: next.getTime(), repeatFrequency: RepeatFrequency.DAILY, alarmManager: { allowWhileIdle: true } } as any,
        );
        return;
      } catch (e) { console.warn('[Alarms] notifee habit alarm failed, falling back:', e); }
    }

    // Quick alarms + iOS: expo-notifications
    await Notifications.scheduleNotificationAsync({
      identifier: `alarm-${entry.id}`,
      content: {
        title,
        body: entry.type === 'habit' ? 'Time for your habit. Will you do it today? 🙏' : 'Your alarm is ringing!',
        sound: 'mantra_alarm.wav',
        data: { type: entry.type === 'habit' ? 'habit-alarm' : 'quick-alarm', alarmId: entry.id, habitKey: entry.habitKey ?? entry.id, habitEmoji: entry.habitEmoji ?? '', label: entry.label },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: entry.hour, minute: entry.minute },
    });
  };

  const cancelEntryNotif = async (entryId: string) => {
    await Notifications.cancelScheduledNotificationAsync(`alarm-${entryId}`).catch(() => {});
    await notifee.cancelTriggerNotification(`habit-${entryId}`).catch(() => {});
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
    setShowCustomHabitInput(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const openAddModal = (type: 'habit' | 'quick') => {
    setFormHour(type === 'habit' ? 7 : new Date().getHours());
    setFormMinute(type === 'habit' ? 0 : 0);
    setFormLabel('');
    setFormHabitKey('meditation');
    setFormHabitEmoji('🧘');
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
      {/* Header gradient */}
      <LinearGradient colors={['#16052E', '#0D0120', '#060610']} style={S.headerGrad}>
        <SafeAreaView edges={['top']}>
          <View style={S.headerRow}>
            <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
              <Text style={S.backTxt}>← Back</Text>
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={S.headerTitle}>⏰ Smart Alarmy</Text>
              <Text style={S.headerSub}>Sacred Wake Intelligence</Text>
            </View>
            <Animated.View style={{ width: 56, alignItems: 'flex-end', opacity: saveAnim }}>
              <Text style={{ color: '#10b981', fontSize: 10, fontWeight: '800' }}>✓ SAVED</Text>
            </Animated.View>
          </View>
          {/* Countdown banner */}
          {nextLabel ? (
            <View style={S.countdownBanner}>
              <View style={S.countdownDot} />
              <Text style={S.countdownTxt}>Ring in {nextLabel}</Text>
              <Text style={S.countdownChevron}>›</Text>
            </View>
          ) : (
            <View style={S.countdownBanner}>
              <Text style={S.countdownOffTxt}>No alarms active  🔕</Text>
            </View>
          )}
        </SafeAreaView>
      </LinearGradient>

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
            <View style={{ width: '100%', borderRadius: 20, borderWidth: 1, borderColor: '#FFFFFF0A', backgroundColor: '#FFFFFF04', padding: 20, marginTop: 12, gap: 12 }}>
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
              <View key={s.label} style={{ flex: 1, borderRadius: 18, borderWidth: 1, borderColor: s.color + '25', backgroundColor: s.color + '08', padding: 14, alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 28 }}>{s.emoji}</Text>
                <Text style={{ fontSize: 28, fontWeight: '900', color: s.color }}>{s.value}</Text>
                <Text style={{ fontSize: 9, color: '#FFFFFF35', fontWeight: '700', textAlign: 'center' }}>{s.label.toUpperCase()}</Text>
              </View>
            ))}
          </View>
          <View style={{ borderRadius: 20, borderWidth: 1, borderColor: '#FFFFFF0A', backgroundColor: '#FFFFFF04', padding: 18, gap: 14 }}>
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
          <View style={{ backgroundColor: '#FFFFFF04', borderWidth: 1, borderColor: '#FFFFFF0A', borderRadius: 20, overflow: 'hidden', marginBottom: 16 }}>
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
          <Text style={{ fontSize: 13, fontWeight: '900', color: '#FFFFFF30', letterSpacing: 1.5, marginBottom: 12 }}>ALARM SOUND</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 2 }}>
              {MANTRAS.map(m => {
                const active = selectedMantraId === m.id;
                return (
                  <TouchableOpacity key={m.id} onPress={() => handleMantraSelect(m.id)} style={[S.mantraChip, active && { borderColor: m.color, backgroundColor: m.color + '18' }]}>
                    <Text style={{ fontSize: 24 }}>{m.emoji}</Text>
                    <Text style={{ color: active ? m.color : Colors.text, fontSize: 10, fontWeight: '800', textAlign: 'center' }}>{m.label}</Text>
                    <Text style={{ color: m.color + '80', fontSize: 7, textAlign: 'center' }}>{m.hint}</Text>
                    <Text style={{ color: dlStatus[m.id] === 'downloaded' ? '#10b981' : dlStatus[m.id] === 'downloading' ? m.color : Colors.textDim, fontSize: 7, fontWeight: '800', textAlign: 'center' }}>
                      {dlStatus[m.id] === 'downloaded' ? '✓ Offline' : dlStatus[m.id] === 'downloading' ? `⬇ ${Math.round((dlProgress[m.id] ?? 0) * 100)}%` : '☁ Online'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
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
        <TouchableOpacity style={[S.alarmCard, settings.wakeAlarm.enabled && S.alarmCardActive]} onPress={() => setShowWakeEdit(true)} activeOpacity={0.85}>
          <View style={S.alarmCardInner}>
            <View style={S.alarmLeft}>
              <View style={S.alarmTypePill}>
                <Text style={S.alarmTypeEmoji}>⏰</Text>
                <Text style={S.alarmTypeTxt}>WAKE ALARM</Text>
                {missionSettings.lockInMode && <Text style={{ fontSize: 9, color: '#ef4444' }}>🔒</Text>}
              </View>
              <Text style={[S.alarmTime, settings.wakeAlarm.enabled ? S.alarmTimeOn : S.alarmTimeOff]}>
                {fmt12(settings.wakeAlarm.hour, settings.wakeAlarm.minute)}
              </Text>
              <Text style={S.alarmSub}>
                {playingMantra.emoji} {playingMantra.label}  ·  {MISSIONS.find(m => m.id === missionSettings.selectedMission)?.name ?? 'Mission'}
              </Text>
            </View>
            <Toggle value={settings.wakeAlarm.enabled} onToggle={toggleWake} color="#a78bfa" />
          </View>
        </TouchableOpacity>

        {/* ── Habit / Quick Alarm Cards ── */}
        {alarmEntries.map(entry => (
          <TouchableOpacity key={entry.id} style={[S.alarmCard, entry.enabled && (entry.type === 'habit' ? S.alarmCardHabit : S.alarmCardQuick)]} onPress={() => openEditEntry(entry)} activeOpacity={0.85}>
            <View style={S.alarmCardInner}>
              <View style={S.alarmLeft}>
                <View style={S.alarmTypePill}>
                  <Text style={S.alarmTypeEmoji}>{entry.type === 'habit' ? (entry.habitEmoji ?? '🌿') : '⚡'}</Text>
                  <Text style={S.alarmTypeTxt}>{entry.type === 'habit' ? 'HABIT ALARM' : 'QUICK ALARM'}</Text>
                </View>
                <Text style={[S.alarmTime, entry.enabled ? (entry.type === 'habit' ? S.alarmTimeHabit : S.alarmTimeQuick) : S.alarmTimeOff]}>
                  {fmt12(entry.hour, entry.minute)}
                </Text>
                <Text style={S.alarmSub}>{entry.label}</Text>
              </View>
              <View style={{ alignItems: 'center', gap: 10 }}>
                <Toggle value={entry.enabled} onToggle={() => toggleEntry(entry.id)} color={entry.type === 'habit' ? '#10b981' : '#f97316'} />
                <TouchableOpacity onPress={() => deleteEntry(entry.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={{ color: '#f43f5e60', fontSize: 10, fontWeight: '700' }}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        ))}

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

              {/* Alarm Sound */}
              <Text style={S.sheetSection}>ALARM SOUND</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 2 }}>
                  {MANTRAS.map(m => {
                    const active = selectedMantraId === m.id;
                    return (
                      <TouchableOpacity key={m.id} onPress={() => handleMantraSelect(m.id)} style={[S.mantraChip, active && { borderColor: m.color, backgroundColor: m.color + '18' }]}>
                        <Text style={{ fontSize: 24 }}>{m.emoji}</Text>
                        <Text style={{ color: active ? m.color : Colors.text, fontSize: 10, fontWeight: '800', textAlign: 'center' }}>{m.label}</Text>
                        <Text style={{ color: m.color + '80', fontSize: 7, textAlign: 'center' }}>{m.hint}</Text>
                        <Text style={{ color: dlStatus[m.id] === 'downloaded' ? '#10b981' : dlStatus[m.id] === 'downloading' ? m.color : Colors.textDim, fontSize: 7, fontWeight: '800', textAlign: 'center' }}>
                          {dlStatus[m.id] === 'downloaded' ? '✓ Offline' : dlStatus[m.id] === 'downloading' ? `⬇ ${Math.round((dlProgress[m.id] ?? 0) * 100)}%` : '☁ Online'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              {/* Mission */}
              <Text style={S.sheetSection}>MORNING MISSION  (alarm won't stop until complete)</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {MISSIONS.map(m => {
                  const active = missionSettings.selectedMission === m.id;
                  return (
                    <TouchableOpacity key={m.id} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); updateMission({ selectedMission: m.id }); }}
                      style={[S.missionChip, { borderColor: active ? m.color : '#FFFFFF12', backgroundColor: active ? m.color + '15' : '#FFFFFF05' }]}
                    >
                      <Text style={{ fontSize: 22 }}>{m.icon}</Text>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: active ? m.color : Colors.textMuted, textAlign: 'center' }}>{m.name}</Text>
                      {active && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: m.color }} />}
                    </TouchableOpacity>
                  );
                })}
              </View>

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

              <TouchableOpacity onPress={() => setShowWakeEdit(false)} style={S.sheetDoneBtn}>
                <Text style={S.sheetDoneTxt}>Done</Text>
              </TouchableOpacity>
              <View style={{ height: 48 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Add / Edit Habit Alarm Modal ── */}
      <Modal visible={addType === 'habit' || editEntry?.type === 'habit'} animationType="slide" transparent onRequestClose={() => { setAddType(null); setEditEntry(null); }}>
        <View style={S.sheetOverlay}>
          <View style={[S.sheet, { maxHeight: '85%' }]}>
            <View style={S.sheetHandle} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={S.sheetTitle}>🌿  Habit Alarm</Text>
              <Text style={{ color: Colors.textMuted, fontSize: 12, marginBottom: 12 }}>No mission — just tap confirm when it rings.</Text>
              <TimeAdjuster hour={formHour} minute={formMinute} onChange={(h, m) => { setFormHour(h); setFormMinute(m); }} />
              <Text style={S.sheetSection}>CHOOSE HABIT</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {AYU_HABITS.filter(h => h.key !== 'custom').map(h => {
                  const active = formHabitKey === h.key;
                  return (
                    <TouchableOpacity key={h.key} onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setFormHabitKey(h.key);
                      setFormHabitEmoji(h.emoji);
                      setFormLabel(h.label);
                      setShowCustomHabitInput(false);
                    }}
                      style={[S.habitChip, active && { borderColor: '#10b981', backgroundColor: '#10b98115' }]}
                    >
                      <Text style={{ fontSize: 20 }}>{h.emoji}</Text>
                      <Text style={{ fontSize: 9, fontWeight: '700', color: active ? '#10b981' : Colors.textDim, textAlign: 'center' }}>{h.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {/* ── Custom Habit row ── */}
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setFormHabitKey('custom');
                  setFormHabitEmoji('✨');
                  setShowCustomHabitInput(true);
                  setFormLabel('');
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 8, borderColor: formHabitKey === 'custom' ? '#a78bfa' : '#FFFFFF14', backgroundColor: formHabitKey === 'custom' ? '#a78bfa12' : '#FFFFFF04' }}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 22 }}>✨</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: formHabitKey === 'custom' ? '#a78bfa' : '#fff' }}>Custom Habit</Text>
                  <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 1 }}>Type any habit name — reminder will be set for it</Text>
                </View>
                {formHabitKey === 'custom' && <Text style={{ fontSize: 12, color: '#a78bfa', fontWeight: '900' }}>✓</Text>}
              </TouchableOpacity>
              {showCustomHabitInput && (
                <TextInput style={S.customInput} placeholder="Custom habit name..." placeholderTextColor={Colors.textDim} value={formLabel} onChangeText={setFormLabel} autoFocus />
              )}
              <TouchableOpacity onPress={saveNewEntry} style={[S.saveBtn, { marginTop: 8 }]}>
                <Text style={S.saveBtnTxt}>{editEntry ? '✓ Update Habit Alarm' : '✓ Save Habit Alarm'}</Text>
              </TouchableOpacity>
              <View style={{ height: 48 }} />
            </ScrollView>
          </View>
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
  screen: { flex: 1, backgroundColor: '#060610' },
  headerGrad: { paddingBottom: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10 },
  backBtn: { width: 56, paddingVertical: 4 },
  backTxt: { color: '#FFFFFF45', fontSize: 13, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '900', color: '#fff', letterSpacing: 0.3 },
  headerSub: { fontSize: 9, color: '#c084fc70', marginTop: 1, fontWeight: '700', letterSpacing: 0.9 },
  countdownBanner: { marginHorizontal: 16, marginBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#a78bfa08', borderWidth: 1, borderColor: '#a78bfa20', borderRadius: 99, paddingHorizontal: 14, paddingVertical: 7 },
  countdownDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#a78bfa' },
  countdownTxt: { flex: 1, fontSize: 12, fontWeight: '700', color: '#c4b5fd' },
  countdownChevron: { fontSize: 16, color: '#a78bfa80' },
  countdownOffTxt: { fontSize: 12, color: '#FFFFFF20', fontWeight: '500' },
  permsBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9731610', borderBottomWidth: 1, borderBottomColor: '#f9731625', paddingHorizontal: 16, paddingVertical: 10 },
  permsText: { flex: 1, color: '#f97316', fontSize: 11, fontWeight: '700' },
  permsChevron: { color: '#f97316', fontSize: 14, fontWeight: '900' },
  alarmCard: { marginHorizontal: 16, marginTop: 10, borderRadius: 22, borderWidth: 1, borderColor: '#FFFFFF0A', backgroundColor: '#FFFFFF04', overflow: 'hidden' },
  alarmCardActive: { borderColor: '#a78bfa28', backgroundColor: '#a78bfa05' },
  alarmCardHabit: { borderColor: '#10b98128', backgroundColor: '#10b98105' },
  alarmCardQuick: { borderColor: '#f9731628', backgroundColor: '#f9731605' },
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
  emptyHint: { marginHorizontal: 16, marginTop: 32, alignItems: 'center', gap: 8, paddingVertical: 44, borderRadius: 22, borderWidth: 1, borderColor: '#FFFFFF06', borderStyle: 'dashed' },
  emptyIcon: { fontSize: 40, color: '#FFFFFF10' },
  emptyTxt: { fontSize: 13, color: '#FFFFFF22', fontWeight: '500' },
  fab: { position: 'absolute', bottom: 90, right: 24, width: 60, height: 60, borderRadius: 30, backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center', elevation: 10, shadowColor: '#7C3AED', shadowOpacity: 0.6, shadowRadius: 16 },
  fabOpen: { backgroundColor: '#4C1D95' },
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
  sheetDoneBtn: { backgroundColor: '#7C3AED25', borderWidth: 1, borderColor: '#7C3AED50', borderRadius: 99, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  sheetDoneTxt: { color: '#a78bfa', fontWeight: '900', fontSize: 15 },
  habitChip: { borderRadius: 14, borderWidth: 1, borderColor: '#FFFFFF10', backgroundColor: '#FFFFFF04', padding: 10, alignItems: 'center', gap: 4, width: (width - 40 - 24) / 4 },
  customInput: { backgroundColor: '#FFFFFF07', borderWidth: 1, borderColor: '#FFFFFF12', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, color: '#fff', fontSize: 14, marginBottom: 8 },
  saveBtn: { backgroundColor: '#10b98118', borderWidth: 1, borderColor: '#10b98140', borderRadius: 99, paddingVertical: 14, alignItems: 'center' },
  saveBtnTxt: { color: '#10b981', fontWeight: '900', fontSize: 15 },
  tabBar: { flexDirection: 'row', backgroundColor: 'rgba(12,12,28,0.98)', borderTopWidth: 1, borderTopColor: '#FFFFFF0C', paddingTop: 8, paddingHorizontal: 4 },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 2 },
  tabIconWrap: { width: 44, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.1 },
});
