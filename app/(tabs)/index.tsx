import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, Modal,
  TextInput, Alert, Animated, Dimensions, NativeModules, Platform,
  ActivityIndicator, ToastAndroid, ImageBackground, Image,
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
import notifee, { AndroidImportance, AndroidCategory, AndroidVisibility, TriggerType, RepeatFrequency } from '@notifee/react-native';
import { Colors } from '@/constants/theme';
import { getSolarTimes, type SolarTimes } from '@/lib/solar';
import { PRAKRITI_PLANS, type PledgeData } from '@/lib/prakritiPlan';
import * as FileSystem from 'expo-file-system/legacy';
import { getLocalMantraPath, isMantraDownloaded, downloadMantra } from '@/lib/mantraDownload';
import { fetchWeather, type WeatherData } from '@/lib/weather';
import {
  getBrahmaMuhurtaInfo, scheduleBrahmaMuhurtaNotif, cancelBrahmaMuhurtaNotif,
  SCIENCE_ALIASES, type BrahmaMuhurtaInfo,
} from '@/lib/brahmaMuhurta';

// ── Constants ────────────────────────────────────────────────────────────────
const ACCENT = '#F5820A';
const { width } = Dimensions.get('window');

const MANTRA_TO_WAKE_SOUND: Record<string, string> = {
  gayatri: 'gayatri', lalitha: 'lalitha', shivtandav: 'shiv_tandav',
};

const PRESETS = [
  { label: 'Dawn',    sub: '4:30 AM', hour: 4,  minute: 30, color: '#a78bfa' },
  { label: 'Early',   sub: '5:30 AM', hour: 5,  minute: 30, color: '#60a5fa' },
  { label: 'Sunrise', sub: '6:00 AM', hour: 6,  minute: 0,  color: '#34d399' },
  { label: 'Morning', sub: '6:30 AM', hour: 6,  minute: 30, color: '#fbbf24' },
];

const MANTRAS = [
  { id: 'gayatri',    label: 'Gayatri Mantra',       emoji: '🌞', color: '#fbbf24', hint: 'ॐ भूर्भुवः स्वः', pitch: 0.85, rate: 0.70, text: 'Om Bhur Bhuva Swaha, Tat Savitur Varenyam, Bhargo Devasya Dhimahi, Dhiyo Yo Nah Prachodayat. Om Shanti Shanti Shanti.', audioUrl: 'https://ik.imagekit.io/rcsesr4xf/gayatri-mantra-ghanpaath.mp3' },
  { id: 'lalitha',    label: 'Lalitha Sahasranama',  emoji: '🌺', color: '#f472b6', hint: 'ॐ ऐं ह्रीं श्रीं', pitch: 0.80, rate: 0.65, text: 'Om Aim Hreem Shreem, Sri Lalitha Tripura Sundari, Namami Namami Namami. Om Shakti Shakti Shakti.', audioUrl: 'https://ik.imagekit.io/rcsesr4xf/Lalitha-Sahasranamam.mp3' },
  { id: 'shivtandav', label: 'Shiv Tandav',          emoji: '🔱', color: '#a78bfa', hint: 'ॐ नमः शिवाय',     pitch: 0.75, rate: 0.68, text: 'Jata tavee galajjala pravaha pavithrasthale. Om Namah Shivaya, Om Namah Shivaya. Har Har Mahadev.', audioUrl: 'https://ik.imagekit.io/rcsesr4xf/Shiva-Tandav.mp3' },
];

const AYU_HABITS = [
  { key: 'wake_early',   label: 'Wake Early',       emoji: '🌙' },
  { key: 'warm_water',   label: 'Warm Water',       emoji: '💧' },
  { key: 'meditation',   label: 'Meditation',       emoji: '🧘' },
  { key: 'pranayama',    label: 'Pranayama',        emoji: '🌬️' },
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

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_FULL   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MORNING_QUOTES = [
  'The early morning has gold in its mouth.',
  "Lose an hour in the morning, and you'll be all day hunting for it.",
  'Each morning we are born again. What we do today is what matters most.',
  'The sun is new each day.',
  'Morning is an important time — it sets the tone for the whole day.',
  'Rise up, start fresh, see the bright opportunity in each new day.',
  'Every morning is a chance at a new beginning.',
];

const pad = (n: number) => String(n).padStart(2, '0');
const fmt12 = (h: number, m: number) => {
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${pad(h12)}:${pad(m)} ${ampm}`;
};
function formatDays(days?: number[]): string {
  if (!days || days.length === 0 || days.length === 7) return 'Every day';
  if (days.length === 5 && !days.includes(0) && !days.includes(6)) return 'Weekdays';
  if (days.length === 2 && days.includes(0) && days.includes(6)) return 'Weekends';
  return [...days].sort((a, b) => a - b).map(d => DAY_FULL[d]).join(' · ');
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface AlarmEntry {
  id: string;
  type: 'habit' | 'quick';
  hour: number;
  minute: number;
  label: string;
  enabled: boolean;
  habitKey?: string;
  habitEmoji?: string;
  days?: number[];
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function Toggle({ value, onToggle, color = '#a78bfa' }: { value: boolean; onToggle: () => void; color?: string }) {
  return (
    <Switch
      value={value} onValueChange={onToggle}
      trackColor={{ false: Colors.border ?? '#222', true: color + '80' }}
      thumbColor={value ? color : '#666'}
    />
  );
}

const DS = ['S','M','T','W','T','F','S'] as const;
function DayDots({ days, color = '#10b981' }: { days?: number[]; color?: string }) {
  const isAll = !days || days.length === 0 || days.length === 7;
  return (
    <View style={{ flexDirection: 'row', gap: 5, marginTop: 8 }}>
      {DS.map((d, i) => {
        const on = isAll || days!.includes(i);
        return (
          <View key={i} style={{ alignItems: 'center', gap: 2 }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: on ? color + '22' : 'transparent', borderWidth: 1, borderColor: on ? color + '60' : '#FFFFFF12', alignItems: 'center', justifyContent: 'center' }}>
              {on && <Text style={{ fontSize: 9, fontWeight: '900', color }}>{`\u2713`}</Text>}
            </View>
            <Text style={{ fontSize: 7, fontWeight: on ? '800' : '400', color: on ? color + 'CC' : '#FFFFFF25' }}>{d}</Text>
          </View>
        );
      })}
    </View>
  );
}

const DRUM_H = 52;
const HOURS   = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

function DrumColumn({ values, selected, onChange }: { values: number[]; selected: number; onChange: (v: number) => void }) {
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
    if (v !== lastEmit.current) { lastEmit.current = v; onChange(v); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }
    ref.current?.scrollTo({ y: idx * DRUM_H, animated: false });
  };

  return (
    <View style={{ height: DRUM_H * 3, overflow: 'hidden', minWidth: 64 }}>
      <ScrollView
        ref={ref} showsVerticalScrollIndicator={false} snapToInterval={DRUM_H}
        decelerationRate="fast" scrollEventThrottle={16} nestedScrollEnabled
        onScrollBeginDrag={() => { momentumStarted.current = false; }}
        onMomentumScrollBegin={() => { momentumStarted.current = true; }}
        onMomentumScrollEnd={e => { momentumStarted.current = false; snap(e.nativeEvent.contentOffset.y); }}
        onScrollEndDrag={e => { if (!momentumStarted.current) snap(e.nativeEvent.contentOffset.y); }}
      >
        <View style={{ height: DRUM_H }} />
        {values.map(v => (
          <View key={v} style={{ height: DRUM_H, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: v === selected ? 42 : 26, fontWeight: v === selected ? '100' : '300', color: v === selected ? '#FFFFFF' : '#FFFFFF28', letterSpacing: -1.5, textAlign: 'center' }}>
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
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: DRUM_H + 10, height: DRUM_H, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#FFFFFF15', backgroundColor: '#FFFFFF05', zIndex: 1 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
        <DrumColumn values={HOURS} selected={hour} onChange={h => onChange(h, minute)} />
        <Text style={{ fontSize: 36, fontWeight: '100', color: '#FFFFFF35', paddingHorizontal: 8, alignSelf: 'center' }}>:</Text>
        <DrumColumn values={MINUTES} selected={minute} onChange={m => onChange(hour, m)} />
        <Text style={{ fontSize: 17, fontWeight: '800', color: ACCENT, paddingLeft: 12, alignSelf: 'center', letterSpacing: 0.5 }}>
          {hour < 12 ? 'AM' : 'PM'}
        </Text>
      </View>
    </View>
  );
}

function WeatherCard({ weather, loading }: { weather: WeatherData | null; loading: boolean }) {
  if (loading) return (
    <View style={wS.card}>
      <ActivityIndicator size="small" color="#FFFFFF20" />
      <Text style={wS.loadingTxt}>Checking weather...</Text>
    </View>
  );
  if (!weather) return null;
  return (
    <View style={wS.card}>
      <Text style={wS.emoji}>{weather.emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={wS.condition}>{weather.condition}{weather.city ? `  ·  ${weather.city}` : ''}</Text>
        <Text style={wS.feels}>Feels like {weather.feelsLike}°C</Text>
      </View>
      <Text style={wS.temp}>{weather.temp}°</Text>
      <Text style={wS.humidity}>💧{weather.humidity}%</Text>
    </View>
  );
}

const wS = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginTop: 8, backgroundColor: '#FFFFFF05', borderWidth: 1, borderColor: '#FFFFFF0A', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  emoji: { fontSize: 22 },
  condition: { fontSize: 11, fontWeight: '700', color: '#FFFFFF80' },
  feels: { fontSize: 9, color: '#FFFFFF35', marginTop: 1 },
  temp: { fontSize: 26, fontWeight: '200', color: '#fff', letterSpacing: -1 },
  humidity: { fontSize: 10, color: '#60a5fa', fontWeight: '700' },
  loadingTxt: { fontSize: 11, color: '#FFFFFF25' },
});

function DaySelector({ days, onChange }: { days: number[]; onChange: (d: number[]) => void }) {
  const toggle = (d: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(days.includes(d) ? days.filter(x => x !== d) : [...days, d]);
  };
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

// ── Time-of-day background images (Unsplash + Pexels, free) ─────────────────
const BG_URLS: Record<string, string> = {
  brahma:    'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1000&q=95&auto=format&fit=crop',
  predawn:   'https://images.pexels.com/photos/1642220/pexels-photo-1642220.jpeg?auto=compress&cs=tinysrgb&w=1000',
  sunrise:   'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1000&q=95&auto=format&fit=crop',
  morning:   'https://images.unsplash.com/photo-1470770903676-69b98201ea1c?w=900&q=92&auto=format&fit=crop',
  midday:    'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=900&q=90&auto=format&fit=crop',
  afternoon: 'https://images.unsplash.com/photo-1476673160081-cf065607f449?w=900&q=90&auto=format&fit=crop',
  sandhya:   'https://images.pexels.com/photos/459271/pexels-photo-459271.jpeg?auto=compress&cs=tinysrgb&w=1000',
  twilight:  'https://images.pexels.com/photos/166012/pexels-photo-166012.jpeg?auto=compress&cs=tinysrgb&w=1000',
  night:     'https://images.unsplash.com/photo-1507400492013-162706c8c05e?w=900&q=90&auto=format&fit=crop',
};

function getTimedBgKey(h: number, solar?: SolarTimes | null): string {
  if (solar) {
    const { sunrise, solarNoon, sunset } = solar;
    if (h < sunrise - 1.5 || h >= sunset + 5) return 'night';
    if (h < sunrise - 0.3) return 'brahma';
    if (h < sunrise + 0.5) return 'predawn';
    if (h < sunrise + 2)   return 'sunrise';
    if (h < solarNoon - 1) return 'morning';
    if (h < solarNoon + 2) return 'midday';
    if (h < sunset - 1.5)  return 'afternoon';
    if (h < sunset)        return 'sandhya';
    if (h < sunset + 2)    return 'twilight';
    return 'night';
  }
  if (h >= 2  && h < 5)   return 'brahma';
  if (h >= 5  && h < 5.5) return 'predawn';
  if (h >= 5.5 && h < 8)  return 'sunrise';
  if (h >= 8  && h < 10)  return 'morning';
  if (h >= 10 && h < 14)  return 'midday';
  if (h >= 14 && h < 17)  return 'afternoon';
  if (h >= 17 && h < 19)  return 'sandhya';
  if (h >= 19 && h < 21)  return 'twilight';
  return 'night';
}

// ── Brahma Muhurta Card ─────────────────────────────────────────────────────
const BM_INDIGO = '#818cf8';
const BM_VIOLET = '#a78bfa';

function BrahmaMuhurtaCard({
  bmInfo, enabled, onToggle, scienceIdx, hasGPS,
}: {
  bmInfo: BrahmaMuhurtaInfo | null;
  enabled: boolean;
  onToggle: () => void;
  scienceIdx: number;
  hasGPS: boolean;
}) {
  const alias = SCIENCE_ALIASES[scienceIdx % SCIENCE_ALIASES.length];
  const statusColor = !bmInfo ? '#666'
    : bmInfo.status === 'active'   ? '#34d399'
    : bmInfo.status === 'upcoming' ? BM_INDIGO
    : '#FFFFFF28';

  const countdownStr = bmInfo
    ? bmInfo.status === 'active'
      ? `⏳ ${bmInfo.minutesRemaining} min remaining`
      : bmInfo.status === 'upcoming'
      ? `⏰ In ${bmInfo.minutesUntil >= 60 ? `${Math.floor(bmInfo.minutesUntil / 60)}h ${bmInfo.minutesUntil % 60}m` : `${bmInfo.minutesUntil} min`}`
      : null
    : null;

  return (
    <View style={bmS.wrap}>
      <LinearGradient
        colors={['rgba(67,56,202,0.22)', 'rgba(109,40,217,0.10)', 'rgba(0,0,0,0)']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      />
      {/* Header */}
      <View style={bmS.headerRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
          <Text style={{ fontSize: 20 }}>🌙</Text>
          <View style={{ flex: 1 }}>
            <Text style={bmS.sectionLabel}>BRAHMA MUHURTA</Text>
            <Text style={bmS.sciTitle} numberOfLines={1}>{alias.emoji}  {alias.title}</Text>
          </View>
        </View>
        {bmInfo && (
          <View style={[bmS.statusPill, { borderColor: statusColor + '55', backgroundColor: statusColor + '18' }]}>
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: statusColor, marginRight: 5 }} />
            <Text style={[bmS.statusTxt, { color: statusColor }]}>
              {bmInfo.status === 'active' ? 'ACTIVE NOW' : bmInfo.status === 'upcoming' ? 'UPCOMING' : 'PASSED'}
            </Text>
          </View>
        )}
      </View>

      {/* Time band */}
      {bmInfo ? (
        <View style={bmS.timeBand}>
          <Text style={bmS.timeMain}>{bmInfo.startLabel}</Text>
          <Text style={bmS.timeSep}>—</Text>
          <Text style={bmS.timeEnd}>{bmInfo.endLabel}</Text>
        </View>
      ) : (
        <Text style={bmS.noGps}>📍 Enable GPS for accurate times</Text>
      )}

      {/* Countdown + sunrise row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
        {countdownStr && (
          <View style={[bmS.countPill, { borderColor: statusColor + '40', backgroundColor: statusColor + '12' }]}>
            <Text style={[bmS.countTxt, { color: statusColor }]}>{countdownStr}</Text>
          </View>
        )}
        {bmInfo && (
          <Text style={bmS.sunriseTxt}>☀️ Sunrise {bmInfo.sunriseLabel}{hasGPS ? '  ·  GPS ✓' : ''}</Text>
        )}
      </View>

      {/* Science description */}
      <Text style={bmS.sciDesc} numberOfLines={2}>{alias.desc}</Text>

      {/* Footer toggle */}
      <View style={bmS.footerRow}>
        <View style={{ flex: 1 }}>
          <Text style={bmS.alertLabel}>Daily Alert</Text>
          <Text style={bmS.alertSub}>Notify me at Brahma Muhurta each day</Text>
        </View>
        <Toggle value={enabled} onToggle={onToggle} color={BM_INDIGO} />
      </View>
    </View>
  );
}

const bmS = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginTop: 10, borderRadius: 22, borderWidth: 1, borderColor: BM_INDIGO + '22', backgroundColor: BM_INDIGO + '06', overflow: 'hidden', padding: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10, gap: 8 },
  sectionLabel: { fontSize: 8, fontWeight: '900', color: BM_INDIGO + 'BB', letterSpacing: 1.8 },
  sciTitle: { fontSize: 13, fontWeight: '800', color: '#fff', marginTop: 1 },
  statusPill: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 5 },
  statusTxt: { fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  timeBand: { flexDirection: 'row', alignItems: 'baseline', gap: 0, marginBottom: 2 },
  timeMain: { fontSize: 34, fontWeight: '200', color: '#fff', letterSpacing: -1 },
  timeSep: { fontSize: 18, color: '#FFFFFF28', fontWeight: '200', paddingHorizontal: 8 },
  timeEnd: { fontSize: 26, fontWeight: '200', color: '#FFFFFF60', letterSpacing: -0.5 },
  noGps: { fontSize: 13, color: '#FFFFFF35', marginVertical: 12 },
  countPill: { borderWidth: 1, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
  countTxt: { fontSize: 11, fontWeight: '700' },
  sunriseTxt: { fontSize: 10, color: '#FFFFFF30', fontWeight: '500' },
  sciDesc: { fontSize: 10, color: '#FFFFFF32', lineHeight: 15, marginTop: 10, marginBottom: 14 },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#FFFFFF0A', paddingTop: 12, gap: 12 },
  alertLabel: { fontSize: 13, fontWeight: '700', color: '#fff' },
  alertSub: { fontSize: 10, color: '#FFFFFF30', marginTop: 1 },
});

// ══════════════════════════════════════════════════════════════════════════════
// Main Screen
// ══════════════════════════════════════════════════════════════════════════════
export default function AlarmTab() {
  const insets = useSafeAreaInsets();

  // ── State ─────────────────────────────────────────────────────────────────
  const [settings, setSettings]               = useState<AlarmSettings>(DEFAULT_ALARM_SETTINGS);
  const [saving, setSaving]                   = useState(false);
  const [selectedMantraId, setSelectedMantraId] = useState('gayatri');
  const saveAnim                              = useRef(new Animated.Value(0)).current;
  const alarmActiveRef                        = useRef(false);
  const [dlStatus, setDlStatus]               = useState<Record<string, 'idle'|'downloading'|'downloaded'>>({ gayatri: 'idle', lalitha: 'idle', shivtandav: 'idle' });
  const [dlProgress, setDlProgress]           = useState<Record<string, number>>({});
  const [alarmEntries, setAlarmEntries]       = useState<AlarmEntry[]>([]);
  const [fabOpen, setFabOpen]                 = useState(false);
  const [menuOpenId, setMenuOpenId]           = useState<string | null>(null);
  const [showWakeEdit, setShowWakeEdit]       = useState(false);
  const [addType, setAddType]                 = useState<'habit'|'quick'|null>(null);
  const [editEntry, setEditEntry]             = useState<AlarmEntry | null>(null);
  const [formHour, setFormHour]               = useState(7);
  const [formMinute, setFormMinute]           = useState(0);
  const [formLabel, setFormLabel]             = useState('');
  const [formHabitKey, setFormHabitKey]       = useState('meditation');
  const [formHabitEmoji, setFormHabitEmoji]   = useState('🧘');
  const [formDays, setFormDays]               = useState<number[]>([]);
  const [showCustomHabitInput, setShowCustomHabitInput] = useState(false);
  const [missionSettings, setMissionSettings] = useState<MissionSettings>(DEFAULT_MISSION_SETTINGS);
  const [permStatus, setPermStatus]           = useState({ notifications: true, exactAlarm: true, batteryOpt: true, fullScreen: true });
  const [liveClock, setLiveClock]             = useState(new Date());
  const [prakritiWake, setPrakritiWake]       = useState<{ label: string; hour: number; minute: number; color: string } | null>(null);
  const [alarmModal, setAlarmModal]           = useState(false);
  const [alarmType, setAlarmType]             = useState<'mantra'|'gayatri'>('mantra');
  const [weather, setWeather]                 = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading]   = useState(true);
  const [solarTimes, setSolarTimes]           = useState<SolarTimes | null>(null);
  const [bgUri, setBgUri]                     = useState<string | null>(null);
  const [brahmaMuhurtaEnabled, setBrahmaMuhurtaEnabled] = useState(false);
  const [bmInfo, setBmInfo]                   = useState<BrahmaMuhurtaInfo | null>(null);
  const [scienceIdx, setScienceIdx]           = useState(0);
  const [hasGPS, setHasGPS]                   = useState(false);

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setLiveClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    fetchWeather().then(w => { setWeather(w); setWeatherLoading(false); }).catch(() => setWeatherLoading(false));
  }, []);

  useEffect(() => {
    store.getJSON<{ lat: number; lon: number }>(KEYS.location)
      .then(loc => { if (loc?.lat && loc?.lon) { setSolarTimes(getSolarTimes(loc.lat, loc.lon)); setHasGPS(true); } })
      .catch(() => {});
  }, []);

  useEffect(() => {
    store.get(KEYS.brahmaMuhurtaNotif).then(v => { if (v === '1') setBrahmaMuhurtaEnabled(true); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!solarTimes) return;
    const nowH = liveClock.getHours() + liveClock.getMinutes() / 60;
    setBmInfo(getBrahmaMuhurtaInfo(solarTimes, nowH));
  }, [solarTimes, liveClock]);

  useEffect(() => {
    const t = setInterval(() => setScienceIdx(i => (i + 1) % SCIENCE_ALIASES.length), 6000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    Object.values(BG_URLS).forEach(url => Image.prefetch(url).catch(() => {}));
  }, []);

  useEffect(() => {
    const h   = liveClock.getHours() + liveClock.getMinutes() / 60;
    const key = getTimedBgKey(h, solarTimes);
    const url = BG_URLS[key] ?? BG_URLS.night;
    let cancelled = false;
    Image.prefetch(url).then(() => { if (!cancelled) setBgUri(url); }).catch(() => { if (!cancelled) setBgUri(url); });
    return () => { cancelled = true; };
  }, [liveClock, solarTimes]);

  useEffect(() => {
    (async () => {
      const s  = await store.getJSON<AlarmSettings>(KEYS.alarmSettings);
      const pl = await store.getJSON<PledgeData>(KEYS.pledge);
      if (pl?.prakriti && PRAKRITI_PLANS[pl.prakriti]) {
        const plan  = PRAKRITI_PLANS[pl.prakriti];
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
      const statuses: Record<string, 'idle'|'downloading'|'downloaded'> = {};
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
          const [ea, bo, fs] = await Promise.all([
            checkAlarmPermission(),
            NativeModules.AlarmModule?.isBatteryOptimizationIgnored?.().catch(() => true) ?? Promise.resolve(true),
            NativeModules.AlarmModule?.checkFullScreenIntentPermission?.().catch(() => true) ?? Promise.resolve(true),
          ]);
          const { status } = await (require('expo-notifications') as typeof import('expo-notifications')).getPermissionsAsync();
          setPermStatus({ notifications: status === 'granted', exactAlarm: !!ea, batteryOpt: !!bo, fullScreen: !!fs });
        }, 800);
      }
    })();
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────
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
          const mm   = String(next.getMinutes()).padStart(2, '0');
          const isTomorrow = next.getDate() !== new Date().getDate();
          (ToastAndroid as any)?.show?.(`🔔 Alarm set for ${h12}:${mm} ${ampm}${isTomorrow ? ' (tomorrow)' : ''}`, (ToastAndroid as any).LONG);
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
      Animated.sequence([
        Animated.timing(saveAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(800),
        Animated.timing(saveAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    } catch {} finally { setSaving(false); }
  };

  const toggleWake   = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); persistAndApply({ ...settings, wakeAlarm: { ...settings.wakeAlarm, enabled: !settings.wakeAlarm.enabled } }); };
  const setWakeTime  = (h: number, m: number) => persistAndApply({ ...settings, wakeAlarm: { enabled: true, hour: h, minute: m } });
  const applyPreset  = (p: typeof PRESETS[0]) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); persistAndApply({ ...settings, wakeAlarm: { enabled: true, hour: p.hour, minute: p.minute } }); };
  const toggleBrahma = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); persistAndApply({ ...settings, brahmaReminder: !settings.brahmaReminder }); };

  const toggleBrahmaMuhurtaAlert = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = !brahmaMuhurtaEnabled;
    setBrahmaMuhurtaEnabled(next);
    await store.set(KEYS.brahmaMuhurtaNotif, next ? '1' : '0');
    if (next) {
      const loc = await store.getJSON<{ lat: number; lon: number }>(KEYS.location).catch(() => null);
      if (loc?.lat && loc?.lon) {
        await scheduleBrahmaMuhurtaNotif(loc.lat, loc.lon);
      }
    } else {
      await cancelBrahmaMuhurtaNotif();
    }
  };
  const updateMission = async (patch: Partial<MissionSettings>) => { const u = { ...missionSettings, ...patch }; setMissionSettings(u); await store.setJSON(KEYS.missionSettings, u); };

  const chantMantra = (mantra: typeof MANTRAS[0], repeat = true) => {
    Speech.stop();
    Speech.speak(mantra.text, { language: 'en-IN', pitch: mantra.pitch, rate: mantra.rate, onDone: () => { if (repeat && alarmActiveRef.current) chantMantra(mantra, repeat); } });
  };

  const playAlarmSound = async (overrideType?: 'mantra'|'gayatri') => {
    const mantra = MANTRAS.find(m => m.id === selectedMantraId) ?? MANTRAS[0];
    alarmActiveRef.current = true; setAlarmType(overrideType === 'mantra' ? 'mantra' : 'gayatri'); setAlarmModal(true);
    try {
      const lp   = getLocalMantraPath(mantra.id);
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
    if (Platform.OS === 'android' && entry.type === 'habit') {
      try {
        await notifee.createChannel({ id: 'morning-habit-alarms', name: 'Habit Alarms', importance: AndroidImportance.HIGH, sound: 'mantra_alarm', vibration: true, bypassDnd: true, visibility: AndroidVisibility.PUBLIC } as any);
        const next = new Date(); next.setHours(entry.hour, entry.minute, 0, 0);
        if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
        await notifee.createTriggerNotification(
          { id: `habit-${entry.id}`, title, body: 'Time for your habit! Tap to confirm. 🙏', android: { channelId: 'morning-habit-alarms', importance: AndroidImportance.HIGH, category: AndroidCategory.ALARM, visibility: AndroidVisibility.PUBLIC, fullScreenAction: { id: 'default', launchActivity: 'default' }, pressAction: { id: 'default', launchActivity: 'default' } } as any, data: { type: 'habit-alarm', alarmId: entry.id, habitKey: entry.habitKey ?? entry.id, habitEmoji: entry.habitEmoji ?? '🌿', label: entry.label } },
          { type: TriggerType.TIMESTAMP, timestamp: next.getTime(), repeatFrequency: RepeatFrequency.DAILY, alarmManager: { allowWhileIdle: true } } as any,
        ); return;
      } catch (e) { console.warn('[Morning] notifee fallback:', e); }
    }
    await Notifications.scheduleNotificationAsync({
      identifier: `alarm-${entry.id}`,
      content: { title, body: entry.type === 'habit' ? 'Time for your habit. 🙏' : 'Your alarm is ringing!', sound: 'mantra_alarm.wav', data: { type: entry.type === 'habit' ? 'habit-alarm' : 'quick-alarm', alarmId: entry.id, habitKey: entry.habitKey ?? entry.id, habitEmoji: entry.habitEmoji ?? '', label: entry.label } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: entry.hour, minute: entry.minute },
    });
  };

  const cancelEntryNotif = async (id: string) => {
    await Notifications.cancelScheduledNotificationAsync(`alarm-${id}`).catch(() => {});
    await notifee.cancelTriggerNotification(`habit-${id}`).catch(() => {});
  };

  const saveEntries   = async (entries: AlarmEntry[]) => { setAlarmEntries(entries); await store.setJSON(KEYS.multiAlarms, entries); };
  const toggleEntry   = async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = alarmEntries.map(e => e.id === id ? { ...e, enabled: !e.enabled } : e);
    const entry = updated.find(e => e.id === id);
    if (entry) { if (entry.enabled) await scheduleEntryNotif(entry); else await cancelEntryNotif(id); }
    await saveEntries(updated);
  };
  const deleteEntry   = (id: string) => Alert.alert('Remove alarm?', '', [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: async () => { await cancelEntryNotif(id); await saveEntries(alarmEntries.filter(e => e.id !== id)); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } }]);
  const saveNewEntry  = async () => {
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
  const openAddModal  = (type: 'habit'|'quick') => { setFormHour(type === 'habit' ? 7 : new Date().getHours()); setFormMinute(0); setFormLabel(''); setFormHabitKey('meditation'); setFormHabitEmoji('🧘'); setFormDays([]); setShowCustomHabitInput(false); setEditEntry(null); setAddType(type); };
  const openEditEntry = (entry: AlarmEntry) => { setFormHour(entry.hour); setFormMinute(entry.minute); setFormLabel(entry.label); setFormHabitKey(entry.habitKey ?? 'custom'); setFormHabitEmoji(entry.habitEmoji ?? '✨'); setFormDays(entry.days ?? []); setShowCustomHabitInput(entry.habitKey === 'custom'); setEditEntry(entry); setAddType(null); };

  // ── Computed ──────────────────────────────────────────────────────────────
  const playingMantra = MANTRAS.find(m => m.id === selectedMantraId) ?? MANTRAS[0];
  const allPermsOk    = permStatus.notifications && permStatus.exactAlarm && permStatus.batteryOpt && permStatus.fullScreen;
  const nextLabel     = (() => {
    const now = liveClock.getHours() * 60 + liveClock.getMinutes();
    const candidates: number[] = [];
    if (settings.wakeAlarm.enabled) { const w = settings.wakeAlarm.hour * 60 + settings.wakeAlarm.minute; candidates.push(w > now ? w - now : w + 1440 - now); }
    alarmEntries.filter(e => e.enabled).forEach(e => { const t = e.hour * 60 + e.minute; candidates.push(t > now ? t - now : t + 1440 - now); });
    if (!candidates.length) return '';
    const diff = Math.min(...candidates); const hrs = Math.floor(diff / 60); const mins = diff % 60;
    return hrs > 0 ? `${hrs} hr ${mins} min` : `${mins} min`;
  })();
  const h = liveClock.getHours(); const m = liveClock.getMinutes();
  const timeStr  = `${pad(h === 0 ? 12 : h > 12 ? h - 12 : h)}:${pad(m)}`;
  const ampmStr  = h < 12 ? 'AM' : 'PM';
  const dateStr  = liveClock.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const todayQuote = MORNING_QUOTES[liveClock.getDay()];

  // ── Background phase ────────────────────────────────────────────────────────
  const bgH        = liveClock.getHours() + liveClock.getMinutes() / 60;
  const timeBgKey  = getTimedBgKey(bgH, solarTimes);
  const isNightBg  = timeBgKey === 'night' || timeBgKey === 'brahma';
  const isGoldenBg = timeBgKey === 'sunrise' || timeBgKey === 'sandhya' || timeBgKey === 'predawn' || timeBgKey === 'twilight';
  const isLightBg  = timeBgKey === 'morning' || timeBgKey === 'midday' || timeBgKey === 'afternoon';
  const scrimColors: [string, string, string] = isLightBg
    ? ['rgba(0,4,18,0.80)', 'rgba(0,4,18,0.64)', 'rgba(0,4,18,0.82)']
    : isGoldenBg
    ? ['rgba(0,0,0,0.62)', 'rgba(0,0,0,0.42)', 'rgba(0,0,0,0.68)']
    : ['rgba(2,2,16,0.48)', 'rgba(2,2,16,0.28)', 'rgba(2,2,16,0.50)'];
  const headerGradColors: [string, string] = isLightBg
    ? ['rgba(0,5,22,0.84)', 'rgba(0,5,22,0.10)']
    : isGoldenBg
    ? ['rgba(0,0,0,0.72)', 'rgba(0,0,0,0.06)']
    : ['rgba(2,2,24,0.72)', 'rgba(2,2,24,0.05)'];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <ImageBackground
      source={bgUri ? { uri: bgUri } : undefined}
      style={S.screen}
      imageStyle={{ opacity: 0.68 }}
    >
      <LinearGradient colors={scrimColors} style={StyleSheet.absoluteFillObject} pointerEvents="none" />
      {/* Header */}
      <LinearGradient colors={headerGradColors} style={S.headerGrad}>
        <SafeAreaView edges={['top']}>
          <View style={S.headerTop}>
            <Text style={S.appName}>☀️  Arise</Text>
            <Animated.View style={{ opacity: saveAnim }}>
              <Text style={{ color: '#10b981', fontSize: 10, fontWeight: '800' }}>✓ SAVED</Text>
            </Animated.View>
          </View>
          <View style={{ alignItems: 'center', paddingBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
              <Text style={S.clockTime}>{timeStr}</Text>
              <Text style={S.clockAmpm}>{ampmStr}</Text>
            </View>
            <Text style={S.clockDate}>{dateStr}</Text>
            <Text style={S.quote} numberOfLines={1}>"{todayQuote}"</Text>
          </View>
          {nextLabel ? (
            <View style={S.countdownBanner}>
              <View style={S.countdownDot} />
              <Text style={S.countdownTxt}>Next alarm in  {nextLabel}</Text>
            </View>
          ) : (
            <View style={S.countdownBanner}>
              <Text style={S.countdownOffTxt}>No alarms active  🔕</Text>
            </View>
          )}
        </SafeAreaView>
      </LinearGradient>

      {/* Weather */}
      <WeatherCard weather={weather} loading={weatherLoading} />

      {/* Permission banner */}
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

      {/* Alarm list */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120, paddingTop: 6 }} showsVerticalScrollIndicator={false}>
        {/* Brahma Muhurta Card */}
        <BrahmaMuhurtaCard
          bmInfo={bmInfo}
          enabled={brahmaMuhurtaEnabled}
          onToggle={toggleBrahmaMuhurtaAlert}
          scienceIdx={scienceIdx}
          hasGPS={hasGPS}
        />

        {/* Wake Alarm Card */}
        <View style={[S.alarmCard, settings.wakeAlarm.enabled && S.alarmCardActive]}>
          <TouchableOpacity onPress={() => setShowWakeEdit(true)} activeOpacity={0.85}>
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
                  <TouchableOpacity style={S.cardMenuItem} onPress={() => { setMenuOpenId(null); openEditEntry(entry); }}>
                    <Text style={S.cardMenuTxt}>✎  Edit alarm</Text>
                  </TouchableOpacity>
                  <View style={{ height: 1, backgroundColor: '#FFFFFF08' }} />
                  <TouchableOpacity style={S.cardMenuItem} onPress={() => { setMenuOpenId(null); deleteEntry(entry.id); }}>
                    <Text style={[S.cardMenuTxt, { color: '#f43f5e' }]}>🗑  Delete alarm</Text>
                  </TouchableOpacity>
                </View>
              )}
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
            { label: '⏰  Wake Alarm',  color: ACCENT,    onPress: () => { setFabOpen(false); setShowWakeEdit(true); } },
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
              <Text style={S.sheetTitle}>⏰  Wake Alarm</Text>
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
                        {dlStatus[mn.id] === 'downloaded' ? '✓ Offline' : dlStatus[mn.id] === 'downloading' ? `⬇ ${Math.round((dlProgress[mn.id] ?? 0) * 100)}%` : '☁ Online'}
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
                  { emoji: '🔒', label: 'Lock In Mode',    sub: "Alarm won't stop until mission done",         val: missionSettings.lockInMode,         onToggle: () => updateMission({ lockInMode: !missionSettings.lockInMode }),                     color: '#ef4444' },
                  { emoji: '🤖', label: 'Morning Brief',   sub: 'AI speaks your personalized morning brief',   val: missionSettings.bodhiMorningBrief,  onToggle: () => updateMission({ bodhiMorningBrief: !missionSettings.bodhiMorningBrief }),     color: '#a78bfa' },
                  { emoji: '⏰', label: 'Dawn Alert',       sub: '15 min reminder before your wake alarm',     val: settings.brahmaReminder,            onToggle: toggleBrahma,                                                                          color: '#c084fc' },
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
              <Text style={S.sheetSection}>TEST YOUR ALARM</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
                <TouchableOpacity onPress={() => { setShowWakeEdit(false); setTimeout(fireTestNotification, 200); }} style={[S.testBtn, { borderColor: ACCENT + '40', backgroundColor: ACCENT + '10' }]}>
                  <Text style={{ fontSize: 24 }}>🔔</Text><Text style={{ color: ACCENT, fontWeight: '800', fontSize: 11 }}>Test (5 sec)</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setShowWakeEdit(false); setTimeout(() => playAlarmSound('mantra'), 200); }} style={[S.testBtn, { borderColor: '#fbbf2440', backgroundColor: '#fbbf2410' }]}>
                  <Text style={{ fontSize: 24 }}>🎵</Text><Text style={{ color: '#fbbf24', fontWeight: '800', fontSize: 11 }}>Preview Sound</Text>
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

      {/* Habit Alarm Modal */}
      <Modal visible={addType === 'habit' || editEntry?.type === 'habit'} animationType="slide" transparent onRequestClose={() => { setAddType(null); setEditEntry(null); }}>
        <View style={S.sheetOverlay}>
          <View style={[S.sheet, { maxHeight: '90%' }]}>
            <View style={S.sheetHandle} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={S.sheetTitle}>🌿  Habit Alarm</Text>
              <Text style={{ color: Colors.textMuted, fontSize: 12, marginBottom: 12 }}>Gentle reminder — tap confirm when it rings.</Text>
              <TimeAdjuster hour={formHour} minute={formMinute} onChange={(hr, mn) => { setFormHour(hr); setFormMinute(mn); }} />
              <Text style={S.sheetSection}>REPEAT DAYS</Text>
              <DaySelector days={formDays} onChange={setFormDays} />
              <Text style={S.sheetSection}>CHOOSE HABIT</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {AYU_HABITS.filter(h => h.key !== 'custom').map(h => { const active = formHabitKey === h.key; return (
                  <TouchableOpacity key={h.key} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setFormHabitKey(h.key); setFormHabitEmoji(h.emoji); setFormLabel(h.label); setShowCustomHabitInput(false); }} style={[S.habitChip, active && { borderColor: '#10b981', backgroundColor: '#10b98115' }]}>
                    <Text style={{ fontSize: 20 }}>{h.emoji}</Text>
                    <Text style={{ fontSize: 9, fontWeight: '700', color: active ? '#10b981' : Colors.textDim, textAlign: 'center' }}>{h.label}</Text>
                  </TouchableOpacity>
                ); })}
              </View>
              <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setFormHabitKey('custom'); setFormHabitEmoji('✨'); setShowCustomHabitInput(true); setFormLabel(''); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 8, borderColor: formHabitKey === 'custom' ? '#a78bfa' : '#FFFFFF14', backgroundColor: formHabitKey === 'custom' ? '#a78bfa12' : '#FFFFFF04' }} activeOpacity={0.8}>
                <Text style={{ fontSize: 22 }}>✨</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: formHabitKey === 'custom' ? '#a78bfa' : '#fff' }}>Custom Habit</Text>
                  <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 1 }}>Type any habit name</Text>
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

      {/* Preview Modal */}
      <Modal visible={alarmModal} animationType="fade" transparent statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: 'rgba(4,2,18,0.97)', alignItems: 'center', justifyContent: 'center', padding: 28 }}>
          <LinearGradient colors={[`${playingMantra.color}20`, `${playingMantra.color}10`]} style={{ width: '100%', borderRadius: 28, borderWidth: 1.5, borderColor: `${playingMantra.color}50`, padding: 28, alignItems: 'center', gap: 20 }}>
            <Text style={{ fontSize: 60 }}>{playingMantra.emoji}</Text>
            <Text style={{ fontSize: 11, fontWeight: '900', color: playingMantra.color, letterSpacing: 2 }}>{playingMantra.label.toUpperCase()}</Text>
            <TouchableOpacity onPress={stopAlarmSound} style={{ backgroundColor: '#ef444420', borderWidth: 1.5, borderColor: '#ef444450', borderRadius: 99, paddingVertical: 16, paddingHorizontal: 32, width: '100%', alignItems: 'center' }} activeOpacity={0.8}>
              <Text style={{ color: '#ef4444', fontWeight: '900', fontSize: 16 }}>⏹  Stop</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setAlarmModal(false)} style={{ paddingVertical: 8 }} activeOpacity={0.7}>
              <Text style={{ color: Colors.textMuted, fontSize: 12 }}>Continue in background</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </Modal>
    </ImageBackground>
  );
}

const S = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#060610', overflow: 'hidden' },
  headerGrad: { paddingBottom: 10 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 6, paddingBottom: 8 },
  appName: { fontSize: 15, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },
  clockTime: { fontSize: 72, fontWeight: '100', color: '#fff', letterSpacing: -3 },
  clockAmpm: { fontSize: 18, fontWeight: '300', color: ACCENT, paddingBottom: 14 },
  clockDate: { fontSize: 12, color: '#FFFFFF50', fontWeight: '600', letterSpacing: 0.5 },
  quote: { fontSize: 10, color: '#FFFFFF25', fontStyle: 'italic', marginTop: 4, paddingHorizontal: 32, textAlign: 'center' },
  countdownBanner: { marginHorizontal: 16, marginBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: ACCENT + '08', borderWidth: 1, borderColor: ACCENT + '20', borderRadius: 99, paddingHorizontal: 14, paddingVertical: 7 },
  countdownDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: ACCENT },
  countdownTxt: { flex: 1, fontSize: 12, fontWeight: '700', color: '#fdba74' },
  countdownOffTxt: { fontSize: 12, color: '#FFFFFF20', fontWeight: '500' },
  permsBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9731610', borderBottomWidth: 1, borderBottomColor: '#f9731625', paddingHorizontal: 16, paddingVertical: 10 },
  permsText: { flex: 1, color: '#f97316', fontSize: 11, fontWeight: '700' },
  permsChevron: { color: '#f97316', fontSize: 14, fontWeight: '900' },
  alarmCard: { marginHorizontal: 16, marginTop: 10, borderRadius: 22, borderWidth: 1, borderColor: '#FFFFFF0A', backgroundColor: '#FFFFFF04', overflow: 'hidden' },
  alarmCardActive: { borderColor: ACCENT + '28', backgroundColor: ACCENT + '05' },
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
  kebabBtn:    { paddingVertical: 4, paddingHorizontal: 6, alignItems: 'center' },
  kebabDot:    { width: 3.5, height: 3.5, borderRadius: 2, backgroundColor: '#FFFFFF45', marginVertical: 2.5 },
  cardMenu:    { marginHorizontal: 16, marginBottom: 14, backgroundColor: '#0E0E20', borderRadius: 14, borderWidth: 1, borderColor: '#FFFFFF0E', overflow: 'hidden' },
  cardMenuItem:{ paddingHorizontal: 20, paddingVertical: 15 },
  cardMenuTxt: { fontSize: 14, fontWeight: '700', color: '#FFFFFFA0' },
});
