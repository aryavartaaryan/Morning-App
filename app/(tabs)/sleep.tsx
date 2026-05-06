import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch,
  Modal, Animated, Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import notifee, { AndroidImportance, AndroidCategory, AndroidVisibility, TriggerType, RepeatFrequency } from '@notifee/react-native';
import { store, KEYS } from '@/lib/storage';
import { AlarmSettings, DEFAULT_ALARM_SETTINGS } from '@/lib/notifications';
import { Colors } from '@/constants/theme';
import { useSoundPlayer, PlayableSoundMeta } from '@/lib/soundPlayerContext';

const { width: W } = Dimensions.get('window');
const SLEEP_COLOR = '#60a5fa';
const CARD_W = (W - 48) / 2;
const THEME_CARD_W = 152;
const pad = (n: number) => String(n).padStart(2, '0');
const fmt12 = (h: number, m: number) => { const ap = h < 12 ? 'AM' : 'PM'; const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h; return `${pad(h12)}:${pad(m)} ${ap}`; };
const fmtTimer = (s: number) => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;

// ─── Sound library ──────────────────────────────────────────────────────────
const SLEEP_SOUNDS = [
  { id: 'light_rain',    label: 'Light Rain',      emoji: '🌦️', cat: 'Rain',    color: '#60a5fa', top: '#0D2440' as const, bot: '#050F1E' as const, desc: 'Soft pitter-patter on leaves',   src: require('../../assets/sounds/mixkit-light-rain-loop-2393.m4a') },
  { id: 'heavy_rain',    label: 'Heavy Rain',      emoji: '🌧️', cat: 'Rain',    color: '#3b82f6', top: '#0A1A30' as const, bot: '#040A15' as const, desc: 'Deep rhythmic downpour',          src: require('../../assets/sounds/mixkit-heavy-rain-drops-2399.m4a') },
  { id: 'rain_thunder',  label: 'Rain & Thunder',  emoji: '⛈️', cat: 'Rain',    color: '#818cf8', top: '#18103A' as const, bot: '#0C0820' as const, desc: 'Storm rumbling in the distance',  src: require('../../assets/sounds/mixkit-rain-and-thunder-storm-2390.m4a') },
  { id: 'jungle_rain',   label: 'Jungle Rain',     emoji: '🦜', cat: 'Rain',    color: '#34d399', top: '#0A2418' as const, bot: '#05100A' as const, desc: 'Rain with tropical birds',        src: require('../../assets/sounds/mixkit-jungle-rain-and-birds-2392.m4a') },
  { id: 'jungle_storm',  label: 'Jungle Storm',    emoji: '🌿', cat: 'Rain',    color: '#6ee7b7', top: '#0A201A' as const, bot: '#050F0D' as const, desc: 'Calm forest thunderstorm',        src: require('../../assets/sounds/mixkit-calm-thunderstorm-in-the-jungle-2415.m4a') },
  { id: 'sea_waves',     label: 'Sea Waves',       emoji: '🌊', cat: 'Ocean',   color: '#38bdf8', top: '#0A2030' as const, bot: '#04101A' as const, desc: 'Gentle coastal waves',            src: require('../../assets/sounds/mixkit-close-sea-waves-loop-1195.m4a') },
  { id: 'rocky_shore',   label: 'Rocky Shore',     emoji: '🪨', cat: 'Ocean',   color: '#7dd3fc', top: '#0C1E2F' as const, bot: '#060F18' as const, desc: 'Waves crashing on rocks',         src: require('../../assets/sounds/mixkit-sea-waves-on-a-rocky-shore-1190.m4a') },
  { id: 'harbor_waves',  label: 'Harbor Waves',    emoji: '⚓', cat: 'Ocean',   color: '#93c5fd', top: '#0A1828' as const, bot: '#050C15' as const, desc: 'Still harbor at night',           src: require('../../assets/sounds/mixkit-small-waves-harbor-rocks-1208.m4a') },
  { id: 'flowing_water', label: 'Flowing Water',   emoji: '💧', cat: 'Ocean',   color: '#67e8f9', top: '#0A1E28' as const, bot: '#050F14' as const, desc: 'Stream flowing over stones',      src: require('../../assets/sounds/mixkit-water-flowing-ambience-loop-3126.m4a') },
  { id: 'forest_breeze', label: 'Forest Breeze',   emoji: '🌳', cat: 'Nature',  color: '#86efac', top: '#0A1E10' as const, bot: '#050F08' as const, desc: 'Wind through the canopy',         src: require('../../assets/sounds/mixkit-breeze-through-the-trees-2427.m4a') },
  { id: 'night_forest',  label: 'Night Forest',    emoji: '🦗', cat: 'Nature',  color: '#4ade80', top: '#0A1E0E' as const, bot: '#050F07' as const, desc: 'Crickets at midnight',             src: require('../../assets/sounds/mixkit-night-forest-with-insects-2414.m4a') },
  { id: 'gentle_wind',   label: 'Gentle Wind',     emoji: '🌬️', cat: 'Nature',  color: '#a3e635', top: '#141808' as const, bot: '#0A0F05' as const, desc: 'Open meadow breeze',              src: require('../../assets/sounds/mixkit-wind-blowing-ambience-2658.m4a') },
  { id: 'city_night',    label: 'City Night',      emoji: '🏙️', cat: 'Ambient', color: '#fbbf24', top: '#201808' as const, bot: '#100D05' as const, desc: 'Distant city hum',                src: require('../../assets/sounds/mixkit-urban-ambience-during-the-day-2505.m4a') },
] as const;

type SoundId = typeof SLEEP_SOUNDS[number]['id'];
type SoundItem = typeof SLEEP_SOUNDS[number];
const CATEGORIES = ['All', 'Rain', 'Ocean', 'Nature', 'Ambient'] as const;
type Category = typeof CATEGORIES[number];

// ─── Mantra & Stotra library ─────────────────────────────────────────────────
const MANTRA_LIBRARY = [
  {
    category: 'Energy Mantras',
    color: '#fbbf24',
    icon: '⚡',
    sounds: [
      { id: 'mantra_gayatri',    label: 'Gayatri Mantra',      emoji: '🌞', color: '#fbbf24', top: '#1A1000', bot: '#0A0800', desc: 'Universal prayer of light & wisdom',       cat: 'Energy Mantras', src: { uri: 'https://ik.imagekit.io/rcsesr4xf/gayatri-mantra-ghanpaath.mp3' } },
      { id: 'mantra_lalitha',    label: 'Lalitha Sahasranama', emoji: '🌺', color: '#f472b6', top: '#1A0010', bot: '#0A0008', desc: 'Thousand names of the divine feminine',     cat: 'Energy Mantras', src: { uri: 'https://ik.imagekit.io/rcsesr4xf/Lalitha-Sahasranamam.mp3' } },
      { id: 'mantra_shivtandav', label: 'Shiv Tandav',         emoji: '🔱', color: '#a78bfa', top: '#100A1A', bot: '#08050A', desc: 'Cosmic dance of Shiva',                     cat: 'Energy Mantras', src: { uri: 'https://ik.imagekit.io/rcsesr4xf/Shiva-Tandav.mp3' } },
    ],
  },
  {
    category: 'Stotras',
    color: '#34d399',
    icon: '🕉️',
    sounds: [
      { id: 'stotra_bhagya',        label: 'Bhagya Suktam',        emoji: '🌟', color: '#fde68a', top: '#1A1400', bot: '#0A0A00', desc: 'Vedic hymn for prosperity & fortune',      cat: 'Stotras', src: require('../../assets/sounds/bhagya-suktam.mp3') },
      { id: 'stotra_shiv_sankalpa', label: 'Shiv Sankalpa Suktam', emoji: '🕉️', color: '#c4b5fd', top: '#140A1A', bot: '#0A050F', desc: 'Vedic prayer for pure mind & right will', cat: 'Stotras', src: require('../../assets/sounds/shiv-sankalpa-suktam.mp3') },
    ],
  },
];

// ─── Night themes (editorial cards) ────────────────────────────────────────
const NIGHT_THEMES = [
  { id: 'deep_sleep',   title: 'Deep Sleep',    subtitle: 'TOTAL SURRENDER', tags: 'All night',  category: 'All'     as Category, gradient: ['#04021A', '#080525', '#030110'] as const, orb1: '#1A0A50', orb2: '#100830', accent: '#7c3aed', featuredId: 'light_rain'    as SoundId },
  { id: 'rain_stories', title: 'Rain Stories',  subtitle: 'WASH IT AWAY',    tags: 'Storm',      category: 'Rain'    as Category, gradient: ['#061825', '#0A2235', '#040E1A'] as const, orb1: '#0D3050', orb2: '#051528', accent: '#60a5fa', featuredId: 'light_rain'    as SoundId },
  { id: 'ocean_drift',  title: 'Ocean Drift',   subtitle: 'DEEP BLUE PEACE', tags: 'Coastal',    category: 'Ocean'   as Category, gradient: ['#041A20', '#062530', '#021015'] as const, orb1: '#083540', orb2: '#041A25', accent: '#38bdf8', featuredId: 'sea_waves'     as SoundId },
  { id: 'forest_night', title: 'Forest Night',  subtitle: 'EARTH & SILENCE', tags: 'Wilderness', category: 'Nature'  as Category, gradient: ['#041508', '#07200D', '#020A04'] as const, orb1: '#0A2F12', orb2: '#042008', accent: '#4ade80', featuredId: 'forest_breeze' as SoundId },
  { id: 'city_rest',    title: 'City Rest',     subtitle: 'URBAN LULLABY',   tags: 'Distant',    category: 'Ambient' as Category, gradient: ['#1A1008', '#2A1A10', '#0E0904'] as const, orb1: '#3A2010', orb2: '#200E06', accent: '#fbbf24', featuredId: 'city_night'    as SoundId },
] as const;

const STOP_TIMES = [
  { label: '21 min', secs: 21 * 60 },
  { label: '30 min', secs: 30 * 60 },
  { label: '45 min', secs: 45 * 60 },
  { label: '1 hr',   secs: 60 * 60 },
  { label: '2 hr',   secs: 120 * 60 },
];

const SLEEP_CYCLES = [
  { cycles: 6, hours: 9.0, label: '9 hr',   quality: 'Optimal', color: '#10b981' },
  { cycles: 5, hours: 7.5, label: '7.5 hr', quality: 'Great',   color: '#34d399' },
  { cycles: 4, hours: 6.0, label: '6 hr',   quality: 'Minimum', color: '#fbbf24' },
  { cycles: 3, hours: 4.5, label: '4.5 hr', quality: 'Caution', color: '#f97316' },
];

const SLEEP_TIPS = [
  { emoji: '📵', title: 'No screens 1 hr before bed',        sub: 'Blue light suppresses melatonin by up to 50%.' },
  { emoji: '🌡️', title: 'Cool room (65–68°F / 18–20°C)',    sub: 'Core body temp drop triggers sleep onset.' },
  { emoji: '🫁', title: '4-7-8 breathing to sleep faster',   sub: 'Inhale 4s · Hold 7s · Exhale 8s. Repeat 4×.' },
  { emoji: '☕', title: 'No caffeine after 2 PM',             sub: 'Caffeine half-life is ~6 hrs — it stays in your system.' },
  { emoji: '🌙', title: 'Same wake time every day',           sub: 'Consistent wake time is the #1 sleep quality lever.' },
  { emoji: '🛁', title: 'Warm shower 1 hr before bed',        sub: 'Rapid skin cooling after shower accelerates sleep.' },
];


// ─── Night Theme Card (editorial horizontal scroll) ──────────────────────────
const NightThemeCard = memo(function NightThemeCard({
  theme, onPress,
}: {
  theme: typeof NIGHT_THEMES[number];
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={{ width: THEME_CARD_W, marginRight: 12 }}>
      <View style={S.themeCard}>
        <LinearGradient colors={theme.gradient} style={StyleSheet.absoluteFillObject} />
        {/* Glow orbs for atmospheric depth */}
        <View style={[S.themeOrb1, { backgroundColor: theme.orb1 }]} />
        <View style={[S.themeOrb2, { backgroundColor: theme.orb2 }]} />
        {/* Content */}
        <View style={S.themeContent}>
          <Text style={[S.themeSubtitle, { color: theme.accent + 'AA' }]}>{theme.subtitle}</Text>
          <Text style={S.themeTitle}>{theme.title}</Text>
          <View style={[S.themeTagRow, { borderColor: theme.accent + '30', backgroundColor: theme.accent + '10' }]}>
            <View style={[S.themeTagDot, { backgroundColor: theme.accent }]} />
            <Text style={[S.themeTagTxt, { color: theme.accent }]}>{theme.tags}</Text>
          </View>
        </View>
        {/* Corner arrow */}
        <View style={[S.themeArrow, { backgroundColor: theme.accent + '20', borderColor: theme.accent + '30' }]}>
          <Ionicons name="arrow-forward" size={11} color={theme.accent + 'CC'} />
        </View>
      </View>
    </TouchableOpacity>
  );
});

// ─── Sound Card (atmospheric, no large emoji) ─────────────────────────────────
const SoundCard = memo(function SoundCard({
  sound, isPlaying, isPaused, remaining, onPress,
}: {
  sound: SoundItem; isPlaying: boolean; isPaused: boolean; remaining: number; onPress: () => void;
}) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isPlaying && !isPaused) {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 1.03, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 2000, useNativeDriver: true }),
      ]));
      loop.start();
      return () => loop.stop();
    }
    pulse.setValue(1);
  }, [isPlaying, isPaused]);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.82} style={{ width: CARD_W }}>
      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <View style={[S.soundCard, isPlaying && { borderColor: sound.color + '60', borderWidth: 1.5 }]}>
          <LinearGradient colors={[sound.top, sound.bot]} style={S.soundGrad}>
            {/* Atmospheric glow orb */}
            <View style={[S.soundOrb, { backgroundColor: sound.color + '20' }]} />
            {/* Top row: play icon + emoji accent */}
            <View style={S.soundTopRow}>
              <View style={[S.soundPlayBtn, { backgroundColor: isPlaying ? sound.color + '25' : '#FFFFFF0A', borderColor: isPlaying ? sound.color + '50' : '#FFFFFF12' }]}>
                <Ionicons
                  name={isPlaying && !isPaused ? 'pause' : 'play'}
                  size={13}
                  color={isPlaying ? sound.color : '#FFFFFF45'}
                />
              </View>
              <Text style={S.soundEmojiAccent}>{sound.emoji}</Text>
            </View>
            {/* Sound name */}
            <Text style={[S.cardName, isPlaying && { color: sound.color }]} numberOfLines={2}>{sound.label}</Text>
            <Text style={S.cardDesc} numberOfLines={1}>{sound.desc}</Text>
            {/* Bottom badge */}
            {isPlaying ? (
              <View style={[S.badge, { backgroundColor: sound.color + '18', borderColor: sound.color + '45' }]}>
                <View style={[S.liveDot, { backgroundColor: isPaused ? '#555' : sound.color }]} />
                <Text style={[S.badgeTxt, { color: isPaused ? '#666' : sound.color }]}>
                  {isPaused ? 'Paused' : fmtTimer(remaining)}
                </Text>
              </View>
            ) : (
              <View style={S.badge}>
                <Text style={S.badgeTxt}>{sound.cat}</Text>
              </View>
            )}
          </LinearGradient>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
});

// ─── Featured Hero Card ────────────────────────────────────────────────────────
function FeaturedCard({
  sound, isPlaying, isPaused, sessionSecs: remSecs, onPlay, onToggle, onStop,
}: {
  sound: SoundItem;
  isPlaying: boolean;
  isPaused: boolean;
  sessionSecs: number;
  onPlay: () => void;
  onToggle: () => void;
  onStop: () => void;
}) {
  const pulse = useRef(new Animated.Value(0.92)).current;
  useEffect(() => {
    if (isPlaying && !isPaused) {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 2200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.92, duration: 2200, useNativeDriver: true }),
      ]));
      loop.start();
      return () => loop.stop();
    }
    Animated.timing(pulse, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [isPlaying, isPaused]);

  return (
    <View style={S.featuredCard}>
      <LinearGradient colors={[sound.top, sound.bot, '#060610']} style={StyleSheet.absoluteFillObject} />
      {/* Atmospheric orbs */}
      <Animated.View style={[S.featOrb1, { backgroundColor: sound.color + '22', transform: [{ scale: pulse }] }]} />
      <View style={[S.featOrb2, { backgroundColor: sound.color + '10' }]} />

      {isPlaying ? (
        <>
          <View style={S.featTopRow}>
            <View style={[S.featLiveBadge, { backgroundColor: sound.color + '20', borderColor: sound.color + '40' }]}>
              <View style={[S.featLiveDot, { backgroundColor: isPaused ? '#555' : sound.color }]} />
              <Text style={[S.featLiveLabel, { color: sound.color }]}>{isPaused ? 'PAUSED' : 'NOW PLAYING'}</Text>
            </View>
            <Text style={[S.featTimer, { color: sound.color + 'CC' }]}>{fmtTimer(remSecs)}</Text>
          </View>
          <Text style={S.featTitle}>{sound.label}</Text>
          <Text style={S.featDesc}>{sound.desc}</Text>
          <View style={S.featControls}>
            <TouchableOpacity onPress={onToggle} style={[S.featPauseBtn, { borderColor: sound.color + '50', backgroundColor: sound.color + '18' }]}>
              <Ionicons name={isPaused ? 'play' : 'pause'} size={18} color={sound.color} />
              <Text style={[S.featPauseTxt, { color: sound.color }]}>{isPaused ? 'Resume' : 'Pause'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onStop} style={S.featStopBtn}>
              <Ionicons name="stop-circle-outline" size={16} color="#FFFFFF35" />
              <Text style={S.featStopTxt}>Stop</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          <View style={S.featTopRow}>
            <View style={[S.featLiveBadge, { backgroundColor: '#FFFFFF08', borderColor: '#FFFFFF15' }]}>
              <Text style={[S.featLiveLabel, { color: '#FFFFFF40' }]}>TONIGHT'S PICK</Text>
            </View>
          </View>
          <Text style={S.featTitle}>{sound.label}</Text>
          <Text style={S.featDesc}>{sound.desc}</Text>
          <TouchableOpacity onPress={onPlay} style={[S.featPlayBtn, { backgroundColor: sound.color + '20', borderColor: sound.color + '40' }]}>
            <Ionicons name="play" size={15} color={sound.color} />
            <Text style={[S.featPauseTxt, { color: sound.color }]}>Play Now</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

export default function SleepTab() {
  const insets = useSafeAreaInsets();
  const now    = new Date();

  // ── Global sound player (context) ──────────────────────────
  const { playingId, isPaused, sessionSecs, togglePause, stopSound, changeTimer, requestPlay } = useSoundPlayer();

  // ── Settings ───────────────────────────────────────────────
  const [wakeHour,      setWakeHour]      = useState(DEFAULT_ALARM_SETTINGS.wakeAlarm.hour);
  const [wakeMinute,    setWakeMinute]    = useState(DEFAULT_ALARM_SETTINGS.wakeAlarm.minute);
  const [bedtimeAlert,  setBedtimeAlert]  = useState(false);
  const [eveningMantra, setEveningMantra] = useState(false);

  // ── Sound UI state ─────────────────────────────────────────
  const [stopIdx,   setStopIdx]   = useState(0);
  const [category,  setCategory]  = useState<Category>('All');

  // ── Auto-start ─────────────────────────────────────────────
  const [showAutoStart, setShowAutoStart] = useState(false);
  const [autoEnabled,   setAutoEnabled]   = useState(false);
  const [autoHour,      setAutoHour]      = useState(22);
  const [autoMinute,    setAutoMinute]    = useState(30);
  const [autoSoundId,   setAutoSoundId]   = useState<SoundId>('light_rain');

  // ── Init ───────────────────────────────────────────────────
  useEffect(() => {
    store.getJSON<AlarmSettings>(KEYS.alarmSettings).then(s => {
      if (s?.wakeAlarm) { setWakeHour(s.wakeAlarm.hour); setWakeMinute(s.wakeAlarm.minute); }
      setEveningMantra(s?.eveningMantra ?? false);
    });
  }, []);

  // ── Play from sleep screen ──────────────────────────────────
  const handleCard = useCallback((id: SoundId) => {
    if (playingId === id) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); togglePause(); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const meta = SLEEP_SOUNDS.find(s => s.id === id)!;
    requestPlay(meta as unknown as PlayableSoundMeta, STOP_TIMES[stopIdx].secs);
  }, [playingId, togglePause, requestPlay, stopIdx]);

  const changeStopTimer = (idx: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStopIdx(idx);
    changeTimer(STOP_TIMES[idx].secs);
  };

  const handleStop = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    stopSound(true);
  }, [stopSound]);

  // ── Evening mantra ─────────────────────────────────────────
  const scheduleEveningMantraNotif = async () => {
    try {
      await notifee.createChannel({ id: 'arise-habit-alarms', name: 'SolRize Habit Alarms', importance: AndroidImportance.HIGH, bypassDnd: true, visibility: AndroidVisibility.PUBLIC } as any);
      const next = new Date(); next.setHours(21, 30, 0, 0);
      if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
      await notifee.createTriggerNotification(
        { id: 'evening-mantra-daily', title: '🔱  Shiv Sankalpa Suktam', body: 'Sacred Mind Hymn · 9:30 PM', android: { channelId: 'arise-habit-alarms', importance: AndroidImportance.HIGH, category: AndroidCategory.ALARM, visibility: AndroidVisibility.PUBLIC, fullScreenAction: { id: 'default', launchActivity: 'default' }, pressAction: { id: 'default', launchActivity: 'default' } } as any, data: { type: 'evening-mantra' } },
        { type: TriggerType.TIMESTAMP, timestamp: next.getTime(), repeatFrequency: RepeatFrequency.DAILY, alarmManager: { allowWhileIdle: true } } as any,
      );
    } catch {}
  };
  const cancelEveningMantraNotif = async () => { await notifee.cancelTriggerNotification('evening-mantra-daily').catch(() => {}); };
  const toggleEveningMantra = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const v = !eveningMantra; setEveningMantra(v);
    const s = await store.getJSON<AlarmSettings>(KEYS.alarmSettings);
    await store.setJSON(KEYS.alarmSettings, { ...(s ?? DEFAULT_ALARM_SETTINGS), eveningMantra: v });
    if (v) scheduleEveningMantraNotif(); else cancelEveningMantraNotif();
  };

  // ── Auto-start scheduler ───────────────────────────────────
  const scheduleAutoStart = async () => {
    try {
      await notifee.createChannel({ id: 'arise-habit-alarms', name: 'SolRize Habit Alarms', importance: AndroidImportance.HIGH, bypassDnd: false, visibility: AndroidVisibility.PUBLIC } as any);
      const next = new Date(); next.setHours(autoHour, autoMinute, 0, 0);
      if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
      const meta = SLEEP_SOUNDS.find(s => s.id === autoSoundId)!;
      await notifee.createTriggerNotification(
        { id: 'sleep-autostart', title: `${meta.emoji}  Sleep Sounds`, body: `${meta.label} · Tap to begin your sleep session 🌙`, android: { channelId: 'arise-habit-alarms', importance: AndroidImportance.HIGH, pressAction: { id: 'default', launchActivity: 'default' } } as any, data: { type: 'sleep-autostart', soundId: autoSoundId } },
        { type: TriggerType.TIMESTAMP, timestamp: next.getTime(), repeatFrequency: RepeatFrequency.DAILY, alarmManager: { allowWhileIdle: true } } as any,
      );
    } catch {}
  };
  const cancelAutoStart = async () => { await notifee.cancelTriggerNotification('sleep-autostart').catch(() => {}); };
  const toggleAutoStart = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const v = !autoEnabled; setAutoEnabled(v);
    if (v) await scheduleAutoStart(); else await cancelAutoStart();
  };

  // ── Bedtime math ───────────────────────────────────────────
  const getBedtime = (hoursBack: number) => {
    const totalMins  = wakeHour * 60 + wakeMinute - Math.round(hoursBack * 60) - 15;
    const normalized = ((totalMins % 1440) + 1440) % 1440;
    return { h: Math.floor(normalized / 60), m: normalized % 60 };
  };
  const currentMins  = now.getHours() * 60 + now.getMinutes();
  const bestBedtime  = getBedtime(7.5);
  const bestBedMins  = bestBedtime.h * 60 + bestBedtime.m;
  const minsUntilBed = bestBedMins > currentMins ? bestBedMins - currentMins : bestBedMins + 1440 - currentMins;
  const hrsToBed     = Math.floor(minsUntilBed / 60);
  const minsToBed    = minsUntilBed % 60;

  const filtered    = useMemo(() => category === 'All' ? SLEEP_SOUNDS : SLEEP_SOUNDS.filter(s => s.cat === category), [category]);
  const playingSrc  = SLEEP_SOUNDS.find(s => s.id === playingId);
  const featuredSnd = playingSrc ?? SLEEP_SOUNDS[0];
  const bottomPad   = insets.bottom + 80 + (playingId ? 72 : 0);
  const h = now.getHours();
  const greeting    = h < 17 ? 'Plan Your Night' : h < 20 ? 'Good Evening' : 'Good Night';
  const greetingSub = h < 20 ? 'Your bedtime window is approaching' : 'Let sound carry you to sleep';
  const autoMeta    = SLEEP_SOUNDS.find(s => s.id === autoSoundId)!;

  return (
    <View style={S.screen}>
      {/* ── Header ── */}
      <LinearGradient colors={['#0A1628', '#060C1E', '#060610']} style={S.headerGrad}>
        <SafeAreaView edges={['top']}>
          <View style={S.headerTop}>
            <Text style={S.appName}>🌙  Sleep</Text>
            <View style={S.wakeChip}>
              <Ionicons name="alarm-outline" size={11} color={SLEEP_COLOR + '90'} />
              <Text style={S.wakeChipTxt}>{fmt12(wakeHour, wakeMinute)}</Text>
            </View>
          </View>
          <View style={{ paddingHorizontal: 20, paddingBottom: 18 }}>
            <Text style={S.greeting}>{greeting}</Text>
            <Text style={S.greetingSub}>{greetingSub}</Text>
            {minsUntilBed < 120 && (
              <View style={S.bedtimePill}>
                <View style={[S.dot, { backgroundColor: '#10b981' }]} />
                <Text style={{ color: '#10b981', fontSize: 11, fontWeight: '700', letterSpacing: 0.2 }}>
                  Bedtime in {hrsToBed > 0 ? `${hrsToBed}h ${minsToBed}m` : `${minsToBed} min`}
                </Text>
              </View>
            )}
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>

        {/* ── Featured Hero Card ── */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 }}>
          <FeaturedCard
            sound={featuredSnd}
            isPlaying={playingId === featuredSnd.id}
            isPaused={isPaused && playingId === featuredSnd.id}
            sessionSecs={sessionSecs}
            onPlay={() => handleCard(featuredSnd.id as SoundId)}
            onToggle={togglePause}
            onStop={handleStop}
          />
        </View>

        {/* ── Tonight's Window strip ── */}
        <View style={S.windowRow}>
          <View style={S.windowCell}>
            <Text style={S.windowLabel}>🛏  Ideal bedtime</Text>
            <Text style={[S.windowTime, { color: SLEEP_COLOR }]}>{fmt12(bestBedtime.h, bestBedtime.m)}</Text>
          </View>
          <View style={S.windowDivider} />
          <View style={[S.windowCell, { alignItems: 'flex-end' }]}>
            <Text style={S.windowLabel}>⏰  Wake alarm</Text>
            <Text style={[S.windowTime, { color: '#F5820A' }]}>{fmt12(wakeHour, wakeMinute)}</Text>
          </View>
        </View>

        {/* ── For Your Night (themed cards) ── */}
        <View style={S.secHeader}>
          <Text style={S.secTitle}>For Your Night</Text>
          <Text style={S.secCount}>5 moods</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
          <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 6 }}>
            {NIGHT_THEMES.map(theme => (
              <NightThemeCard
                key={theme.id}
                theme={theme}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setCategory(theme.category);
                  const first = SLEEP_SOUNDS.find(s => s.id === theme.featuredId) ?? SLEEP_SOUNDS.find(s => theme.category === 'All' || s.cat === theme.category)!;
                  handleCard(first.id as SoundId);
                }}
              />
            ))}
          </View>
        </ScrollView>

        {/* ── Soundscapes ── */}
        <View style={S.secHeader}>
          <Text style={S.secTitle}>Soundscapes</Text>
          <Text style={S.secCount}>{filtered.length} of {SLEEP_SOUNDS.length}</Text>
        </View>

        {/* Category + timer filter pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16 }}>
            {CATEGORIES.map(cat => {
              const active = category === cat;
              return (
                <TouchableOpacity key={cat} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setCategory(cat); }}
                  style={[S.chip, active && { borderColor: SLEEP_COLOR + '70', backgroundColor: SLEEP_COLOR + '15' }]}>
                  <Text style={[S.chipTxt, { color: active ? SLEEP_COLOR : '#FFFFFF40' }]}>{cat}</Text>
                </TouchableOpacity>
              );
            })}
            <View style={S.chipDivider} />
            {STOP_TIMES.map((t, i) => {
              const active = stopIdx === i;
              return (
                <TouchableOpacity key={t.label} onPress={() => changeStopTimer(i)}
                  style={[S.chip, active && { borderColor: '#a78bfa', backgroundColor: '#a78bfa18' }]}>
                  <Ionicons name="timer-outline" size={10} color={active ? '#a78bfa' : '#FFFFFF30'} style={{ marginRight: 3 }} />
                  <Text style={[S.chipTxt, { color: active ? '#a78bfa' : '#FFFFFF40' }]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* Sound grid */}
        <View style={S.grid}>
          {filtered.map(s => (
            <SoundCard
              key={s.id}
              sound={s}
              isPlaying={playingId === s.id}
              isPaused={isPaused && playingId === s.id}
              remaining={playingId === s.id ? sessionSecs : 0}
              onPress={() => handleCard(s.id as SoundId)}
            />
          ))}
        </View>

        {/* ── Sacred Sounds: Mantras & Stotras ── */}
        <View style={S.secHeader}>
          <Text style={S.secTitle}>Sacred Sounds</Text>
          <Text style={S.secCount}>Mantras · Stotras</Text>
        </View>
        {MANTRA_LIBRARY.map(section => (
          <View key={section.category} style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10, gap: 6 }}>
              <Text style={{ fontSize: 14 }}>{section.icon}</Text>
              <Text style={{ fontSize: 13, fontWeight: '800', color: section.color, letterSpacing: 0.2 }}>{section.category}</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingBottom: 4 }}>
                {section.sounds.map(s => (
                  <SoundCard
                    key={s.id}
                    sound={s as any}
                    isPlaying={playingId === s.id}
                    isPaused={isPaused && playingId === s.id}
                    remaining={playingId === s.id ? sessionSecs : 0}
                    onPress={() => {
                      if (playingId === s.id) {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        togglePause();
                        return;
                      }
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      requestPlay(s as unknown as PlayableSoundMeta, STOP_TIMES[stopIdx].secs);
                    }}
                  />
                ))}
              </View>
            </ScrollView>
          </View>
        ))}

        {/* ── Sleep Cycles ── */}
        <View style={S.secHeader}>
          <Text style={S.secTitle}>Sleep Cycles</Text>
          <Text style={S.secCount}>90-min each</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
          <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingBottom: 6 }}>
            {SLEEP_CYCLES.map(cycle => {
              const bed   = getBedtime(cycle.hours);
              const isRec = cycle.cycles === 5;
              return (
                <View key={cycle.cycles} style={[S.cycleChip, { borderColor: cycle.color + (isRec ? '60' : '20'), backgroundColor: cycle.color + (isRec ? '10' : '06') }]}>
                  {isRec && <View style={[S.cycleChipBadge, { backgroundColor: cycle.color + '25' }]}><Text style={{ fontSize: 7, fontWeight: '900', color: cycle.color, letterSpacing: 0.8 }}>IDEAL</Text></View>}
                  <Text style={[S.cycleChipTime, { color: cycle.color }]}>{fmt12(bed.h, bed.m)}</Text>
                  <Text style={S.cycleChipHours}>{cycle.label}</Text>
                  <Text style={[S.cycleChipQuality, { color: cycle.color + 'BB' }]}>{cycle.quality}</Text>
                  <Text style={S.cycleChipCycles}>{cycle.cycles} cycles</Text>
                </View>
              );
            })}
          </View>
        </ScrollView>

        {/* ── Night Settings ── */}
        <View style={S.secHeader}>
          <Text style={S.secTitle}>Night Settings</Text>
        </View>
        <View style={S.groupCard}>
          <TouchableOpacity onPress={() => setShowAutoStart(true)} activeOpacity={0.75} style={S.groupRow}>
            <View style={[S.groupIcon, { backgroundColor: SLEEP_COLOR + '18' }]}>
              <Ionicons name="timer-outline" size={17} color={SLEEP_COLOR} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={S.groupRowTitle}>Auto-Start Sound</Text>
              <Text style={S.groupRowSub}>{autoMeta.emoji}  {autoMeta.label}  ·  {fmt12(autoHour, autoMinute)}</Text>
            </View>
            <Switch value={autoEnabled} onValueChange={toggleAutoStart}
              trackColor={{ false: '#222', true: SLEEP_COLOR + '80' }} thumbColor={autoEnabled ? SLEEP_COLOR : '#444'} />
          </TouchableOpacity>
          <View style={S.groupDivider} />
          <View style={S.groupRow}>
            <View style={[S.groupIcon, { backgroundColor: '#818cf818' }]}>
              <Text style={{ fontSize: 14 }}>🔱</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={S.groupRowTitle}>Evening Mantra</Text>
              <Text style={S.groupRowSub}>Shiv Sankalpa Suktam · 9:30 PM</Text>
            </View>
            <Switch value={eveningMantra} onValueChange={toggleEveningMantra}
              trackColor={{ false: '#222', true: '#818cf880' }} thumbColor={eveningMantra ? '#818cf8' : '#444'} />
          </View>
          <View style={S.groupDivider} />
          <View style={S.groupRow}>
            <View style={[S.groupIcon, { backgroundColor: SLEEP_COLOR + '12' }]}>
              <Text style={{ fontSize: 14 }}>🌙</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={S.groupRowTitle}>Bedtime Alert</Text>
              <Text style={S.groupRowSub}>30 min before {fmt12(bestBedtime.h, bestBedtime.m)}</Text>
            </View>
            <Switch value={bedtimeAlert} onValueChange={v => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setBedtimeAlert(v); }}
              trackColor={{ false: '#222', true: SLEEP_COLOR + '80' }} thumbColor={bedtimeAlert ? SLEEP_COLOR : '#444'} />
          </View>
        </View>

        {/* ── Sleep Intelligence ── */}
        <View style={S.secHeader}>
          <Text style={S.secTitle}>Sleep Intelligence</Text>
        </View>
        <View style={S.windowCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 }}>
            <View>
              <Text style={S.windowLabel}>🛏  Ideal bedtime</Text>
              <Text style={[S.windowTime, { color: SLEEP_COLOR }]}>{fmt12(bestBedtime.h, bestBedtime.m)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={S.windowLabel}>⏰  Wake alarm</Text>
              <Text style={[S.windowTime, { color: '#F5820A' }]}>{fmt12(wakeHour, wakeMinute)}</Text>
            </View>
          </View>
          <View style={S.sleepBar}>
            <LinearGradient colors={[SLEEP_COLOR + '50', '#F5820A30']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={S.sleepBarFill} />
            <View style={[S.sleepBarDot, { left: 0, backgroundColor: SLEEP_COLOR }]} />
            <View style={[S.sleepBarDot, { right: 0, backgroundColor: '#F5820A' }]} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
            <Text style={S.barLabel}>{fmt12(bestBedtime.h, bestBedtime.m)}</Text>
            <Text style={S.barLabel}>{fmt12(wakeHour, wakeMinute)}</Text>
          </View>
          <Text style={[S.barLabel, { marginTop: 14, color: '#FFFFFF30', fontSize: 10, lineHeight: 16 }]}>
            7.5 hr · 5 cycles · 15-min sleep onset buffer included
          </Text>
        </View>

        {/* ── Sleep Science ── */}
        <View style={S.secHeader}>
          <Text style={S.secTitle}>Sleep Science</Text>
        </View>
        {SLEEP_TIPS.map((tip, i) => (
          <View key={i} style={S.tipCard}>
            <View style={S.tipIconBox}>
              <Text style={{ fontSize: 18 }}>{tip.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={S.tipTitle}>{tip.title}</Text>
              <Text style={S.tipSub}>{tip.sub}</Text>
            </View>
          </View>
        ))}
        <View style={S.scienceNote}>
          <Text style={S.scienceNoteTxt}>💡  Sleep cycles are ~90 min each. Waking between cycles — not mid-cycle — is what makes mornings effortless.</Text>
        </View>
      </ScrollView>

      {/* ── Auto-start modal ── */}
      <Modal visible={showAutoStart} animationType="slide" transparent onRequestClose={() => setShowAutoStart(false)}>
        <View style={S.overlay}>
          <View style={S.sheet}>
            <View style={S.sheetHandle} />
            <Text style={S.sheetTitle}>⏰  Auto-Start Sleep Sound</Text>
            <Text style={{ color: '#FFFFFF35', fontSize: 11, textAlign: 'center', marginBottom: 16 }}>Sound begins automatically at this time every night</Text>
            <View style={S.timeBig}>
              <Text style={S.timeBigTxt}>{fmt12(autoHour, autoMinute)}</Text>
            </View>
            <Text style={S.modalLabel}>HOUR</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16 }}>
                {Array.from({ length: 24 }, (_, i) => i).map(hh => {
                  const active = autoHour === hh;
                  return (
                    <TouchableOpacity key={hh} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setAutoHour(hh); }}
                      style={[S.timeChip, active && { backgroundColor: SLEEP_COLOR + '22', borderColor: SLEEP_COLOR }]}>
                      <Text style={[S.timeChipTxt, { color: active ? SLEEP_COLOR : '#FFFFFF35' }]}>{pad(hh)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
            <Text style={S.modalLabel}>MINUTE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16 }}>
                {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(mm => {
                  const active = autoMinute === mm;
                  return (
                    <TouchableOpacity key={mm} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setAutoMinute(mm); }}
                      style={[S.timeChip, active && { backgroundColor: SLEEP_COLOR + '22', borderColor: SLEEP_COLOR }]}>
                      <Text style={[S.timeChipTxt, { color: active ? SLEEP_COLOR : '#FFFFFF35' }]}>{pad(mm)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
            <Text style={S.modalLabel}>SOUND</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
              <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16 }}>
                {SLEEP_SOUNDS.map(s => {
                  const active = autoSoundId === s.id;
                  return (
                    <TouchableOpacity key={s.id} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setAutoSoundId(s.id as SoundId); }}
                      style={[S.soundPickChip, active && { borderColor: s.color, backgroundColor: s.color + '18' }]}>
                      <Text style={{ fontSize: 20 }}>{s.emoji}</Text>
                      <Text style={{ fontSize: 8, fontWeight: '700', color: active ? s.color : '#FFFFFF35', textAlign: 'center', marginTop: 4 }}>{s.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
            <TouchableOpacity onPress={() => { setShowAutoStart(false); if (autoEnabled) scheduleAutoStart(); }}
              style={[S.confirmBtn, { borderColor: SLEEP_COLOR + '50', backgroundColor: SLEEP_COLOR + '18' }]}>
              <Text style={[S.confirmTxt, { color: SLEEP_COLOR }]}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const S = StyleSheet.create({
  // ── Scaffold ──────────────────────────────────────────────
  screen:     { flex: 1, backgroundColor: '#060610' },
  headerGrad: {},

  // ── Header ────────────────────────────────────────────────
  headerTop:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 6, paddingBottom: 10 },
  appName:      { fontSize: 13, fontWeight: '900', color: '#FFFFFF70', letterSpacing: 1.2 },
  wakeChip:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: SLEEP_COLOR + '14', borderWidth: 1, borderColor: SLEEP_COLOR + '30', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5 },
  wakeChipTxt:  { fontSize: 11, fontWeight: '800', color: SLEEP_COLOR + 'CC' },
  greeting:     { fontSize: 30, fontWeight: '200', color: '#fff', letterSpacing: -0.8, marginBottom: 6 },
  greetingSub:  { fontSize: 13, color: '#FFFFFF45', letterSpacing: 0.1 },
  bedtimePill:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, backgroundColor: '#10b98110', borderWidth: 1, borderColor: '#10b98130', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 7, alignSelf: 'flex-start' },
  dot:          { width: 6, height: 6, borderRadius: 3 },

  // ── Section headers ────────────────────────────────────────
  secHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 26, paddingBottom: 12 },
  secTitle:  { fontSize: 19, fontWeight: '300', color: '#FFFFFFCC', letterSpacing: -0.3 },
  secCount:  { fontSize: 11, fontWeight: '700', color: '#FFFFFF30' },

  // ── Tonight's Window inline strip ────────────────────────
  windowRow:      { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 14, borderRadius: 18, borderWidth: 1, borderColor: SLEEP_COLOR + '18', backgroundColor: SLEEP_COLOR + '06', paddingHorizontal: 20, paddingVertical: 14 },
  windowCell:     { flex: 1 },
  windowDivider:  { width: 1, height: 36, backgroundColor: '#FFFFFF10', marginHorizontal: 16 },
  windowLabel:    { fontSize: 10, color: '#FFFFFF45', fontWeight: '600', marginBottom: 4 },
  windowTime:     { fontSize: 18, fontWeight: '700', letterSpacing: -0.5 },

  // ── Sleep Intelligence full card ──────────────────────────
  windowCard:     { marginHorizontal: 16, borderRadius: 22, borderWidth: 1, borderColor: SLEEP_COLOR + '20', backgroundColor: SLEEP_COLOR + '06', padding: 20 },
  sleepBar:       { height: 5, backgroundColor: '#FFFFFF08', borderRadius: 3, overflow: 'visible', position: 'relative', marginTop: 4 },
  sleepBarFill:   { position: 'absolute', left: 0, top: 0, bottom: 0, right: 0, borderRadius: 3 },
  sleepBarDot:    { position: 'absolute', top: -5, width: 15, height: 15, borderRadius: 8, borderWidth: 2.5, borderColor: '#060610' },
  barLabel:       { fontSize: 9, color: '#FFFFFF25', fontWeight: '700', letterSpacing: 0.3 },

  // ── Featured Hero Card ─────────────────────────────────────
  featuredCard:  { borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: '#FFFFFF10', padding: 22, minHeight: 190, justifyContent: 'flex-end' },
  featOrb1:      { position: 'absolute', top: -40, right: -30, width: 180, height: 180, borderRadius: 90 },
  featOrb2:      { position: 'absolute', bottom: -20, left: -10, width: 110, height: 110, borderRadius: 55 },
  featTopRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  featLiveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5 },
  featLiveDot:   { width: 6, height: 6, borderRadius: 3 },
  featLiveLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  featTimer:     { fontSize: 18, fontWeight: '200', letterSpacing: -0.5 },
  featTitle:     { fontSize: 28, fontWeight: '200', color: '#fff', letterSpacing: -0.8, marginBottom: 6 },
  featDesc:      { fontSize: 12, color: '#FFFFFF45', marginBottom: 18, letterSpacing: 0.1 },
  featControls:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featPauseBtn:  { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 12 },
  featPlayBtn:   { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 12, alignSelf: 'flex-start' },
  featPauseTxt:  { fontSize: 13, fontWeight: '700' },
  featStopBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 12 },
  featStopTxt:   { fontSize: 12, color: '#FFFFFF35', fontWeight: '600' },

  // ── Night Theme Cards ─────────────────────────────────────
  themeCard:     { width: THEME_CARD_W, height: 200, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: '#FFFFFF0A', justifyContent: 'flex-end' },
  themeOrb1:     { position: 'absolute', top: -30, right: -20, width: 110, height: 110, borderRadius: 55, opacity: 0.7 },
  themeOrb2:     { position: 'absolute', bottom: 10, left: -15, width: 70, height: 70, borderRadius: 35, opacity: 0.5 },
  themeContent:  { padding: 14, gap: 4 },
  themeSubtitle: { fontSize: 8, fontWeight: '900', letterSpacing: 1.5 },
  themeTitle:    { fontSize: 17, fontWeight: '300', color: '#fff', letterSpacing: -0.4 },
  themeTagRow:   { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start', marginTop: 2 },
  themeTagDot:   { width: 4, height: 4, borderRadius: 2 },
  themeTagTxt:   { fontSize: 9, fontWeight: '700' },
  themeArrow:    { position: 'absolute', top: 12, right: 12, width: 26, height: 26, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  // ── Sound grid ────────────────────────────────────────────
  grid:          { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 12, marginBottom: 4 },
  soundCard:     { borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#FFFFFF08' },
  soundGrad:     { padding: 14, minHeight: 148, justifyContent: 'space-between', position: 'relative', overflow: 'hidden' },
  soundOrb:      { position: 'absolute', top: -20, right: -20, width: 90, height: 90, borderRadius: 45 },
  soundTopRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  soundPlayBtn:  { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  soundEmojiAccent: { fontSize: 14, opacity: 0.7 },
  cardName:      { fontSize: 13, fontWeight: '800', color: '#fff', marginTop: 10 },
  cardDesc:      { fontSize: 10, color: '#FFFFFF35', marginBottom: 6, marginTop: 2 },
  badge:         { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 99, borderColor: '#FFFFFF12', backgroundColor: '#FFFFFF06', paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  badgeTxt:      { fontSize: 9, fontWeight: '800', color: '#FFFFFF40' },
  liveDot:       { width: 5, height: 5, borderRadius: 3 },

  // ── Chips (category + timer) ──────────────────────────────
  chip:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99, borderWidth: 1, borderColor: '#FFFFFF12', backgroundColor: '#FFFFFF05' },
  chipTxt:     { fontSize: 12, fontWeight: '700' },
  chipDivider: { width: 1, height: 22, backgroundColor: '#FFFFFF10', marginHorizontal: 4, alignSelf: 'center' },

  // ── Night Settings grouped card ────────────────────────────
  groupCard:     { marginHorizontal: 16, borderRadius: 22, borderWidth: 1, borderColor: '#FFFFFF0A', backgroundColor: '#0D0D1E', overflow: 'hidden' },
  groupRow:      { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 16 },
  groupIcon:     { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  groupRowTitle: { fontSize: 14, fontWeight: '700', color: '#FFFFFFDD' },
  groupRowSub:   { fontSize: 11, color: '#FFFFFF38', marginTop: 2 },
  groupDivider:  { height: 1, backgroundColor: '#FFFFFF07', marginLeft: 70 },

  // ── Sleep Cycle chips ─────────────────────────────────────
  cycleChip:        { width: 130, borderRadius: 18, borderWidth: 1, padding: 16, gap: 3 },
  cycleChipBadge:   { alignSelf: 'flex-start', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 4 },
  cycleChipTime:    { fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  cycleChipHours:   { fontSize: 13, fontWeight: '800', color: '#FFFFFFCC' },
  cycleChipQuality: { fontSize: 11, fontWeight: '700' },
  cycleChipCycles:  { fontSize: 10, color: '#FFFFFF35', fontWeight: '600' },

  // ── Sleep Science ─────────────────────────────────────────
  tipCard:    { marginHorizontal: 16, marginBottom: 8, borderRadius: 18, borderWidth: 1, borderColor: '#FFFFFF07', backgroundColor: '#FFFFFF03', flexDirection: 'row', alignItems: 'flex-start', gap: 14, padding: 16 },
  tipIconBox: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#FFFFFF07', alignItems: 'center', justifyContent: 'center' },
  tipTitle:   { fontSize: 13, fontWeight: '700', color: '#FFFFFFDD' },
  tipSub:     { fontSize: 11, color: '#FFFFFF40', marginTop: 3, lineHeight: 16 },
  scienceNote:    { marginHorizontal: 16, marginTop: 4, marginBottom: 8, backgroundColor: SLEEP_COLOR + '08', borderWidth: 1, borderColor: SLEEP_COLOR + '15', borderRadius: 16, padding: 16 },
  scienceNoteTxt: { fontSize: 11, color: SLEEP_COLOR + '99', lineHeight: 18 },

  // ── Auto-start modal ──────────────────────────────────────
  overlay:      { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.72)' },
  sheet:        { backgroundColor: '#0E0E1C', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12, paddingBottom: 40 },
  sheetHandle:  { width: 36, height: 4, borderRadius: 2, backgroundColor: '#FFFFFF20', alignSelf: 'center', marginBottom: 16 },
  sheetTitle:   { fontSize: 17, fontWeight: '900', color: '#fff', textAlign: 'center', marginBottom: 4 },
  modalLabel:   { fontSize: 8, fontWeight: '900', color: '#FFFFFF28', letterSpacing: 1.6, marginHorizontal: 16, marginBottom: 8, marginTop: 8 },
  timeBig:      { alignItems: 'center', marginBottom: 20 },
  timeBigTxt:   { fontSize: 46, fontWeight: '100', color: SLEEP_COLOR, letterSpacing: -2 },
  timeChip:     { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#FFFFFF10', backgroundColor: '#FFFFFF04', minWidth: 44, alignItems: 'center' },
  timeChipTxt:  { fontSize: 13, fontWeight: '700' },
  soundPickChip:{ width: 70, paddingVertical: 10, alignItems: 'center', borderRadius: 14, borderWidth: 1, borderColor: '#FFFFFF10', backgroundColor: '#FFFFFF04' },
  confirmBtn:   { marginHorizontal: 20, borderRadius: 16, paddingVertical: 15, alignItems: 'center', borderWidth: 1 },
  confirmTxt:   { fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },
});

