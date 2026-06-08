import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, BackHandler, StatusBar,
  Dimensions, Modal, ScrollView, AppState, Platform, ImageBackground,
} from 'react-native';
import notifee, { AndroidImportance, AndroidCategory, AndroidVisibility } from '@notifee/react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming,
  Easing, withSpring, interpolate, Extrapolation,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { speakBodhi, stopBodhi } from '@/lib/speech';
import { useSoundPlayer } from '@/lib/soundPlayerContext';
import { stopNativeAlarmSound, setNativeAlarmVolume, startAlarmVibration, stopAlarmVibration, dismissAlarmOverlay } from '@/lib/nativeAlarm';
import { cancelVolumeRamp, cancelFusion, playGentleAlarmAudio, playFusionAlarm, preemptActiveAlarm, setActiveAlarmSoundRef, stopActivePreview } from '@/lib/alarmAudio';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocalMantraPath } from '@/lib/mantraDownload';
import { store, KEYS } from '@/lib/storage';
import { useBgContext } from '@/lib/bgContext';
import { getSolarTimes } from '@/lib/solar';
import { recordWake } from '@/lib/sunriseStreak';
import { type AlarmSettings } from '@/lib/notifications';
import { saveHabitLog, todayStr } from '@/lib/habitLogs';
import { auth } from '@/lib/firebase';
import {
  MISSIONS, WAKE_SOUNDS, DEFAULT_MISSION_SETTINGS, MissionSettings,
  getKalaMessage, WAKE_QUOTES,
} from '@/lib/missionAlarm';
import { SOUND_IMAGES } from '@/lib/sleepSoundsData';
import { getLocalSoundImageUri } from '@/lib/soundImagePreload';

const MANTRA_TO_WAKE: Record<string, string> = {
  gayatri: 'gayatri',
  lalitha: 'lalitha',
  shivtandav: 'shiv_tandav',
};

const BUNDLED_MANTRA_ASSETS: Record<string, any> = {
  bhagya_suktam:        require('../assets/sounds/bhagya-suktam.m4a'),
  shiv_sankalpa_suktam: require('../assets/sounds/shiv-sankalpa-suktam.m4a'),
};

// Gentle / nature sounds that are bundled as .m4a — no download needed
const BUNDLED_NATURE_ASSETS: Record<string, any> = {
  forest_birds:       require('../assets/sounds/mixkit-jungle-rain-and-birds-2392.m4a'),
  sea_waves:          require('../assets/sounds/mixkit-sea-waves-on-a-rocky-shore-1190.m4a'),
  light_rain:         require('../assets/sounds/mixkit-light-rain-loop-2393.m4a'),
  breeze_trees:       require('../assets/sounds/mixkit-breeze-through-the-trees-2427.m4a'),
  river_flow:         require('../assets/sounds/mixkit-water-flowing-ambience-loop-3126.m4a'),
  singing_bowl_deep:  require('../assets/sounds/singing-bowl-deep.m4a'),
  tibetan_bowl:       require('../assets/sounds/tibetan-bowl.m4a'),
  morning_birds:      require('../assets/sounds/morning-birds-loop.m4a'),
  spring_birds:       require('../assets/sounds/spring-birds-morning.m4a'),
  forest_birds_spring:require('../assets/sounds/forest-birds-spring.m4a'),
  morning_flute:      require('../assets/sounds/morning-flute.m4a'),
  sitar_morning:      require('../assets/sounds/sitar-morning.m4a'),
  healing_bells_432:  require('../assets/sounds/432hz-healing-bells.m4a'),
  wanderlust_breeze:  require('../assets/sounds/wanderlust-breeze.m4a'),
  forest_campfire:    require('../assets/sounds/forest-campfire.m4a'),
  indian_beats:       require('../assets/sounds/indian-beats.m4a'),
  // ── ALL_SLEEP_SOUNDS ID aliases (different key names used on sleep page) ──────
  sitar:              require('../assets/sounds/sitar-morning.m4a'),
  wanderlust:         require('../assets/sounds/wanderlust-breeze.m4a'),
  campfire:           require('../assets/sounds/forest-campfire.m4a'),
  flowing_water:      require('../assets/sounds/mixkit-water-flowing-ambience-loop-3126.m4a'),
  hz_432:             require('../assets/sounds/432hz-healing-bells.m4a'),
  singing_bowl:       require('../assets/sounds/singing-bowl-deep.m4a'),
  jungle_rain:        require('../assets/sounds/mixkit-jungle-rain-and-birds-2392.m4a'),
  jungle_storm:       require('../assets/sounds/mixkit-calm-thunderstorm-in-the-jungle-2415.m4a'),
  rocky_shore:        require('../assets/sounds/mixkit-sea-waves-on-a-rocky-shore-1190.m4a'),
  harbor_waves:       require('../assets/sounds/mixkit-small-waves-harbor-rocks-1208.m4a'),
  night_forest:       require('../assets/sounds/mixkit-night-forest-with-insects-2414.m4a'),
  gentle_wind:        require('../assets/sounds/mixkit-wind-blowing-ambience-2658.m4a'),
  city_night:         require('../assets/sounds/mixkit-urban-ambience-during-the-day-2505.m4a'),
  heavy_rain:         require('../assets/sounds/mixkit-heavy-rain-drops-2399.m4a'),
  rain_thunder:       require('../assets/sounds/mixkit-rain-and-thunder-storm-2390.m4a'),
  forest_breeze:      require('../assets/sounds/mixkit-breeze-through-the-trees-2427.m4a'),
  // ── Sitar ──────────────────────────────────────────────────────────────────
  space_sitar:        require('../assets/sounds/space-sitar.m4a'),
  sitar_long:         require('../assets/sounds/sitar-long.m4a'),
  sitar_tabla_bells:  require('../assets/sounds/sitar-tabla-bells.m4a'),
  indian_sitar_raga:  require('../assets/sounds/indian-sitar-raga.m4a'),
  sitar_summer_raga:  require('../assets/sounds/sitar-summer-raga.m4a'),
  sitar_radiance:     require('../assets/sounds/sitar-radiance.m4a'),
  sitar_tanpura_sarangi: require('../assets/sounds/sitar-tanpura-sarangi.m4a'),
  sitar_tanpura_bgm:  require('../assets/sounds/sitar-tanpura.m4a'),
  veena_classical:    require('../assets/sounds/veena-classical.m4a'),
  sitar_calm:         require('../assets/sounds/sitar-calm.m4a'),
  veena_raga:         require('../assets/sounds/veena-raga.m4a'),
  // ── Flute ──────────────────────────────────────────────────────────────────
  andean_flute:       require('../assets/sounds/andean-flute.m4a'),
  quena_flute:        require('../assets/sounds/quena-flute.m4a'),
  native_flute:       require('../assets/sounds/native-flute.m4a'),
  native_flute_echo:  require('../assets/sounds/native-flute-echo.m4a'),
  bamboo_flute:       require('../assets/sounds/bamboo-flute.m4a'),
  pan_flute:          require('../assets/sounds/pan-flute.m4a'),
  arabian_flute:      require('../assets/sounds/arabian-flute.m4a'),
  arabic_flute:       require('../assets/sounds/arabic-flute.m4a'),
  flute_scale:        require('../assets/sounds/flute-scale.m4a'),
  forest_flute:       require('../assets/sounds/forest-flute.m4a'),
  bansuri_forest:     require('../assets/sounds/bansuri-forest.m4a'),
  bansuri_melody:     require('../assets/sounds/bansuri-melody.m4a'),
  bansuri_tarana:     require('../assets/sounds/bansuri-tarana.m4a'),
  // ── Tabla ──────────────────────────────────────────────────────────────────
  tabla_beat:         require('../assets/sounds/tabla-beat.m4a'),
  tabla_shuffle:      require('../assets/sounds/tabla-shuffle.m4a'),
  tabla_loop:         require('../assets/sounds/tabla-loop.m4a'),
  tabla_jam:          require('../assets/sounds/tabla-jam.m4a'),
  tabla_claves:       require('../assets/sounds/tabla-claves.m4a'),
  // ── Birds ──────────────────────────────────────────────────────────────────
  eagle_feather:      require('../assets/sounds/eagle-feather.m4a'),
  cuckoo_forest:      require('../assets/sounds/cuckoo-forest.m4a'),
  cuckoo_clock:       require('../assets/sounds/cuckoo-clock.m4a'),
  cuckoo_soft:        require('../assets/sounds/cuckoo-soft.m4a'),
  peacock_wild:       require('../assets/sounds/peacock-wild.m4a'),
  cuckoo_chime:       require('../assets/sounds/cuckoo-chime.m4a'),
  india_countryside_birds: require('../assets/sounds/india-countryside-birds.m4a'),
  cuckoo_birds_forest:require('../assets/sounds/cuckoo-birds-forest.m4a'),
  peacock_call:       require('../assets/sounds/peacock.m4a'),
  koel_bird:          require('../assets/sounds/koel-bird.m4a'),
  // ── Tanpura ────────────────────────────────────────────────────────────────
  tanpura_sacred_432hz: require('../assets/sounds/tanpura-sacred-432hz.m4a'),
  tanpura_breath:     require('../assets/sounds/tanpura-breath.m4a'),
  tanpura_loop:       require('../assets/sounds/tanpura-loop.m4a'),
  raga_tanpura_drone: require('../assets/sounds/raga-tanpura-drone.m4a'),
  tanpura_mystic:     require('../assets/sounds/tanpura-mystic.m4a'),
  tanpura_serene:     require('../assets/sounds/tanpura-serene.m4a'),
  // ── World / Sacred ─────────────────────────────────────────────────────────
  sargija_eastern:    require('../assets/sounds/sargija-eastern.m4a'),
  tagore_festival:    require('../assets/sounds/tagore-festival.m4a'),
  world_ambient:      require('../assets/sounds/world-ambient.m4a'),
  tibetan_dreams:     require('../assets/sounds/tibetan-dreams.m4a'),
  spiritual_journey:  require('../assets/sounds/spiritual-journey.m4a'),
  reincarnation_tones:require('../assets/sounds/reincarnation-tones.m4a'),
  night_jungle_chiangmai: require('../assets/sounds/night-jungle-chiangmai.m4a'),
  heaven_tune:        require('../assets/sounds/heaven-tune.m4a'),
  om_shanti:          require('../assets/sounds/om-shanti.m4a'),
};


const ALARM_SOUND_BUNDLED_IMAGES: Record<string, any> = {
  lalitha: require('../assets/images/mata-lalitha.jpg'),
};

const ALARM_SOUND_META: Record<string, { label: string; icon: string; color: string }> = {
  forest_birds:        { label: 'Forest Birds',         icon: '🐦', color: '#34d399' },
  sea_waves:           { label: 'Sea Waves',             icon: '🌊', color: '#38bdf8' },
  light_rain:          { label: 'Light Rain',            icon: '🌦️', color: '#60a5fa' },
  breeze_trees:        { label: 'Forest Breeze',         icon: '🌿', color: '#4ade80' },
  river_flow:          { label: 'Flowing Water',          icon: '🏞️', color: '#38bdf8' },
  morning_birds:       { label: 'Morning Birds',         icon: '🌅', color: '#fbbf24' },
  spring_birds:        { label: 'Spring Birds',          icon: '🌸', color: '#f472b6' },
  forest_birds_spring: { label: 'Forest Birds',           icon: '🌲', color: '#4ade80' },
  forest_campfire:     { label: 'Forest Campfire',       icon: '🔥', color: '#f97316' },
  wanderlust_breeze:   { label: 'Wanderlust Breeze',      icon: '🌬️', color: '#67e8f9' },
  singing_bowl_deep:   { label: 'Deep Singing Bowl',      icon: '🔮', color: '#a78bfa' },
  tibetan_bowl:        { label: 'Tibetan Bowl',          icon: '🕌', color: '#c4b5fd' },
  morning_flute:       { label: 'Light Meditation Tone', icon: '🎶', color: '#6ee7b7' },
  sitar_morning:       { label: 'Calm Raga',             icon: '🪕', color: '#f59e0b' },
  healing_bells_432:   { label: '432 Hz Bells',          icon: '🔔', color: '#fde68a' },
  indian_beats:        { label: 'Indian Beats',           icon: '🥁', color: '#fb923c' },
  // ── ALL_SLEEP_SOUNDS ID aliases ──────────────────────────────────────────────
  sitar:               { label: 'Calm Raga',             icon: '🪕', color: '#fcd34d' },
  wanderlust:          { label: 'Wanderlust Breeze',     icon: '🌬️', color: '#bae6fd' },
  campfire:            { label: 'Forest Campfire',       icon: '🔥', color: '#f97316' },
  flowing_water:       { label: 'Flowing Water',         icon: '💧', color: '#38bdf8' },
  hz_432:              { label: '432 Hz Bells',          icon: '🔔', color: '#c084fc' },
  singing_bowl:        { label: 'Deep Singing Bowl',     icon: '🔮', color: '#a78bfa' },
  jungle_rain:         { label: 'Jungle Rain',           icon: '🌿', color: '#34d399' },
  jungle_storm:        { label: 'Jungle Storm',          icon: '⛈️', color: '#6ee7b7' },
  rocky_shore:         { label: 'Rocky Shore',           icon: '🌊', color: '#7dd3fc' },
  harbor_waves:        { label: 'Harbor Waves',          icon: '⚓', color: '#93c5fd' },
  night_forest:        { label: 'Night Forest',          icon: '🦗', color: '#4ade80' },
  gentle_wind:         { label: 'Gentle Wind',           icon: '🌬️', color: '#a3e635' },
  city_night:          { label: 'City Night',            icon: '🏙️', color: '#fbbf24' },
  heavy_rain:          { label: 'Heavy Rain',            icon: '🌧️', color: '#3b82f6' },
  rain_thunder:        { label: 'Rain & Thunder',        icon: '⛈️', color: '#818cf8' },
  forest_breeze:       { label: 'Forest Breeze',         icon: '🌳', color: '#86efac' },
  gayatri:             { label: 'Gayatri Mantra',        icon: '🌞', color: '#fbbf24' },
  lalitha:             { label: 'Lalitha Sahasranama',   icon: '🌺', color: '#f472b6' },
  shivtandav:          { label: 'Shiv Tandav',           icon: '🔱', color: '#60a5fa' },
  bhagya_suktam:       { label: 'Bhagya Suktam',         icon: '🌟', color: '#fbbf24' },
  shiv_sankalpa_suktam:{ label: 'Shiv Sankalpa Suktam',  icon: '🕉️', color: '#c4b5fd' },
  fusion:              { label: 'Fusion Wake',           icon: '✨', color: '#fbbf24' },
  // ── Sitar ────────────────────────────────────────────────────────────────
  space_sitar:         { label: 'Space Sitar',           icon: '🪐', color: '#fcd34d' },
  sitar_long:          { label: 'Sitar Meditation',      icon: '🪕', color: '#f59e0b' },
  sitar_tabla_bells:   { label: 'Sitar, Tabla & Bells',  icon: '🎵', color: '#fbbf24' },
  indian_sitar_raga:   { label: 'Indian Sitar Raga',     icon: '🎶', color: '#fb923c' },
  sitar_summer_raga:   { label: 'Summer Healing Raga',   icon: '☀️', color: '#fde68a' },
  sitar_radiance:      { label: 'Sitar Radiance',        icon: '✨', color: '#f97316' },
  sitar_tanpura_sarangi:{ label: 'Sitar, Tanpura & Sarangi', icon: '🪕', color: '#f59e0b' },
  sitar_tanpura_bgm:   { label: 'Sitar & Tanpura',       icon: '🎼', color: '#fbbf24' },
  veena_classical:     { label: 'Classical Veena',       icon: '🪗', color: '#fcd34d' },
  sitar_calm:          { label: 'Calm Sitar',             icon: '🪕', color: '#fcd34d' },
  veena_raga:          { label: 'Veena Raga Kanada',      icon: '🪗', color: '#f59e0b' },
  // ── Flute ────────────────────────────────────────────────────────────────
  andean_flute:        { label: 'Andean Flute',          icon: '🏔️', color: '#6ee7b7' },
  quena_flute:         { label: 'Canyon Quena',          icon: '🏜️', color: '#86efac' },
  native_flute:        { label: 'Native American Flute', icon: '🪶', color: '#a3e635' },
  native_flute_echo:   { label: 'Native Flute Echo',     icon: '🌀', color: '#86efac' },
  bamboo_flute:        { label: 'Bamboo Flute',          icon: '🎋', color: '#34d399' },
  pan_flute:           { label: 'Pan Flute Drift',       icon: '🌬️', color: '#67e8f9' },
  arabian_flute:       { label: 'Arabian Flute & Drums', icon: '🌙', color: '#fbbf24' },
  arabic_flute:        { label: 'Arabic Flute',          icon: '🕌', color: '#fde68a' },
  flute_scale:         { label: 'Flute Meditation',      icon: '🎶', color: '#6ee7b7' },
  forest_flute:        { label: 'Forest Flute',          icon: '🌿', color: '#86efac' },
  bansuri_forest:      { label: 'Bansuri Forest',         icon: '🌿', color: '#34d399' },
  bansuri_melody:      { label: 'Bansuri Melody',         icon: '🎵', color: '#6ee7b7' },
  bansuri_tarana:      { label: 'Bansuri Tarana',         icon: '🎶', color: '#86efac' },
  // ── Tabla ────────────────────────────────────────────────────────────────
  tabla_beat:          { label: 'Tabla Beat',            icon: '🥁', color: '#f97316' },
  tabla_shuffle:       { label: 'Tabla Shuffle',         icon: '🪘', color: '#fb923c' },
  tabla_loop:          { label: 'Tabla Loop 90',         icon: '🎵', color: '#f59e0b' },
  tabla_jam:           { label: 'Tabla Jam',             icon: '🎶', color: '#fbbf24' },
  tabla_claves:        { label: 'Tabla & Claves',        icon: '🪗', color: '#fb923c' },
  // ── Birds ────────────────────────────────────────────────────────────────
  eagle_feather:       { label: 'Eagle Call',            icon: '🦅', color: '#78716c' },
  cuckoo_forest:       { label: 'Cuckoo Forest',         icon: '🌳', color: '#4ade80' },
  cuckoo_clock:        { label: 'Cuckoo Clock',          icon: '🕰️', color: '#86efac' },
  cuckoo_soft:         { label: 'Soft Cuckoo',           icon: '🐦', color: '#6ee7b7' },
  peacock_wild:        { label: 'Wild Peacock',          icon: '🦚', color: '#34d399' },
  cuckoo_chime:        { label: 'Cuckoo Chime',          icon: '🔔', color: '#a3e635' },
  india_countryside_birds: { label: 'India Countryside', icon: '🌾', color: '#fde68a' },
  cuckoo_birds_forest: { label: 'Cuckoo & Forest Birds', icon: '🌲', color: '#86efac' },
  peacock_call:        { label: 'Peacock Call',          icon: '🦚', color: '#4ade80' },
  koel_bird:           { label: 'Koel Bird Song',        icon: '🎵', color: '#34d399' },
  // ── Tanpura ──────────────────────────────────────────────────────────────
  tanpura_sacred_432hz:{ label: 'Sacred Tanpura 432Hz',  icon: '🕉️', color: '#c084fc' },
  tanpura_breath:      { label: 'Tanpura Breath',        icon: '🌬️', color: '#a78bfa' },
  tanpura_loop:        { label: 'Tanpura Loop',          icon: '🔁', color: '#818cf8' },
  raga_tanpura_drone:  { label: 'Raga Tanpura Drone',    icon: '🌌', color: '#6366f1' },
  tanpura_mystic:      { label: 'Mystic Tanpura',         icon: '🌌', color: '#818cf8' },
  tanpura_serene:      { label: 'Serene Tanpura',         icon: '🧘', color: '#a78bfa' },
  // ── World / Sacred additions ─────────────────────────────────────────────
  sargija_eastern:     { label: 'Eastern Sargija',       icon: '🌏', color: '#f97316' },
  tagore_festival:     { label: 'Tagore Festival',       icon: '🎊', color: '#fbbf24' },
  world_ambient:       { label: 'World Ambient',         icon: '🌍', color: '#a78bfa' },
  tibetan_dreams:      { label: 'Tibetan Dreams',        icon: '🧘', color: '#818cf8' },
  spiritual_journey:   { label: 'Spiritual Journey',     icon: '🌌', color: '#c084fc' },
  reincarnation_tones: { label: 'Reincarnation Tones',   icon: '♾️', color: '#a78bfa' },
  night_jungle_chiangmai: { label: 'Night Jungle',       icon: '🦟', color: '#4ade80' },
  heaven_tune:         { label: 'Heaven Tune',            icon: '✨',  color: '#fde68a' },
  om_shanti:           { label: 'Om Shanti',              icon: '🕉️', color: '#c084fc' },
};

const { width, height } = Dimensions.get('window');
const pad = (n: number) => String(n).padStart(2, '0');
const fmtTime = () => {
  const now = new Date();
  const h = now.getHours(); const m = now.getMinutes();
  const p = h < 12 ? 'AM' : 'PM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${pad(h12)}:${pad(m)} ${p}`;
};

// Snooze options (minutes)
const SNOOZE_OPTIONS = [5, 10, 20];

export default function AlarmRingingScreen() {
  const router = useRouter();
  const [ms, setMs] = useState<MissionSettings>(DEFAULT_MISSION_SETTINGS);
  const [userName, setUserName] = useState('Champion');
  const [timeStr, setTimeStr] = useState(fmtTime());
  const { bgUri } = useBgContext();
  const [bgImageSource, setBgImageSource] = useState<any>(null);
  const [soundMeta,     setSoundMeta]     = useState<{ label: string; icon: string; color: string }>({ label: '', icon: '🕉️', color: '#fbbf24' });
  const [showSnoozeModal, setShowSnoozeModal] = useState(false);
  const [snoozeCountdown, setSnoozeCountdown] = useState<number | null>(null);
  const [snoozedFor, setSnoozedFor] = useState<number | null>(null);
  const [alarmStopped, setAlarmStopped] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const alarmStoppedRef = useRef(false);
  const missionStartedRef = useRef(false);
  const gentleWakeRef = useRef(false);
  const rampMinutesRef = useRef(5);
  const appStateRef = useRef(AppState.currentState);
  const { stopSound: stopAmbientSound, dismissMoodSheet } = useSoundPlayer();

  // ── Audio helpers ──────────────────────────────────────────────────────────
  const stopWakeAudio = async () => {
    cancelVolumeRamp();
    cancelFusion();
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    } catch { /* ignore */ }
  };

  const playWakeAudio = async (uri: string | null, bundledAsset?: any) => {
    await preemptActiveAlarm();
    await stopActivePreview();
    setActiveAlarmSoundRef(soundRef);
    await stopWakeAudio();
    // ── FOREGROUND FIX: Completely stop native MediaPlayer FIRST so it releases
    // audio focus before we claim it with expo-av. Just muting volume (setNativeAlarmVolume(0))
    // was leaving the native service holding audio focus, which caused expo-av
    // createAsync to fail silently when the alarm fired while the app was open.
    // stopNativeAlarmSound() terminates the MediaPlayer and releases focus.
    // We keep the foreground service alive for wake-lock via setNativeAlarmVolume(0)
    // AFTER we have established the JS audio session.
    await stopNativeAlarmSound().catch(() => {});
    try {
      // Claim audio focus FIRST before touching native volume
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
        interruptionModeIOS: 1,
        interruptionModeAndroid: 1,
      });
      // Now safe to mute any residual native audio (belt-and-suspenders)
      await setNativeAlarmVolume(0).catch(() => {});
      const source = bundledAsset ?? (uri ? { uri } : require('../assets/sounds/mantra_alarm.m4a'));
      const { sound } = await Audio.Sound.createAsync(
        source,
        { shouldPlay: true, isLooping: true, volume: 1.0 },
      );
      soundRef.current = sound;
      // Verify it's actually playing (foreground audio session can be interrupted)
      setTimeout(async () => {
        if (!soundRef.current) return;
        try {
          const status = await soundRef.current.getStatusAsync();
          if ((status as any)?.isLoaded && !(status as any)?.isPlaying) {
            await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: true, shouldDuckAndroid: false, interruptionModeIOS: 1, interruptionModeAndroid: 1 });
            await soundRef.current.playAsync();
          }
        } catch { /* ignore */ }
      }, 800);
    } catch {
      try {
        // Retry with fresh audio mode claim
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: true, shouldDuckAndroid: false, interruptionModeIOS: 1, interruptionModeAndroid: 1 });
        const { sound } = await Audio.Sound.createAsync(
          require('../assets/sounds/mantra_alarm.m4a'),
          { shouldPlay: true, isLooping: true, volume: 1.0 },
        );
        soundRef.current = sound;
      } catch (e2) { console.warn('[AlarmRinging] Wake audio fallback error:', e2); }
    }
  };

  // ── Animations ──────────────────────────────────────────────────────────────
  const outerScale = useSharedValue(1);
  const outerOpacity = useSharedValue(0.35);
  const innerScale = useSharedValue(1);
  const shakeX = useSharedValue(0);
  const btnScale = useSharedValue(1);

  const outerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: outerScale.value }],
    opacity: outerOpacity.value,
  }));
  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: innerScale.value }],
  }));
  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));
  const btnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: btnScale.value }],
  }));

  useEffect(() => {
    outerScale.value = withRepeat(
      withSequence(withTiming(1.30, { duration: 1200, easing: Easing.inOut(Easing.ease) }), withTiming(1, { duration: 1200 })), -1,
    );
    outerOpacity.value = withRepeat(
      withSequence(withTiming(0.8, { duration: 1200 }), withTiming(0.20, { duration: 1200 })), -1,
    );
    innerScale.value = withRepeat(
      withSequence(withTiming(1.12, { duration: 900 }), withTiming(1, { duration: 900 })), -1,
    );
    // Pulse the CTA button
    btnScale.value = withRepeat(
      withSequence(withTiming(1.05, { duration: 700 }), withTiming(1, { duration: 700 })), -1,
    );
  }, []);

  // Shake effect when user tries to dismiss improperly
  const triggerShake = () => {
    shakeX.value = withSequence(
      withTiming(-12, { duration: 60 }),
      withTiming(12, { duration: 60 }),
      withTiming(-8, { duration: 60 }),
      withTiming(8, { duration: 60 }),
      withTiming(0, { duration: 60 }),
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  };

  // ── Sync alarmStopped → ref so setTimeout callbacks read it without stale closure ──
  useEffect(() => { alarmStoppedRef.current = alarmStopped; }, [alarmStopped]);

  // ── Phase 4: Dismiss native overlay the moment this screen mounts ──────────
  // AlarmSoundService drew a TYPE_APPLICATION_OVERLAY window ~50 ms after the
  // alarm fired so the screen was covered before React Native finished loading.
  // Now that the proper UI is visible, remove the placeholder.
  useEffect(() => { dismissAlarmOverlay().catch(() => {}); }, []);

  // ── Keep screen awake ───────────────────────────────────────────────────────
  useEffect(() => {
    activateKeepAwakeAsync('alarm-ringing');
    return () => { deactivateKeepAwake('alarm-ringing'); };
  }, []);

  // ── Fast-start: begin stopping ambient sound immediately on mount ───────────
  // The bootstrap also awaits stopAmbientSound before playing — this just
  // starts the stop process early to reduce any perceived gap.
  useEffect(() => {
    stopAmbientSound(false).catch(() => {});
    dismissMoodSheet();
  }, []);

  // ── Clock ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setTimeStr(fmtTime()), 15_000);
    return () => clearInterval(t);
  }, []);

  // ── BLOCK hardware back button completely ───────────────────────────────────
  // Note: MainActivity.kt also overrides dispatchKeyEvent natively as a second
  // layer of defence. This JS handler is the first layer.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!alarmStopped) {
        // Native vibration runs in JVM — no restart needed. Just shake the UI.
        triggerShake();
        return true; // blocks back — MainActivity also swallows it natively
      }
      return false;
    });
    return () => sub.remove();
  }, [alarmStopped]);

  // ── Re-open screen if user presses HOME ─────────────────────────────────────
  // Android 14+ blocks startActivity from background services, so the native
  // bringToFrontRunnable no longer works reliably. Instead we fire an immediate
  // notifee notification with fullScreenAction, which auto-relaunches the
  // alarm activity on top of whatever the user is doing — no sound disruption.
  const bttfNotifIdRef = useRef<string | null>(null);

  useEffect(() => {
    const fireBttfNotif = async () => {
      if (Platform.OS !== 'android') return;
      try {
        // Create a silent channel so the notification does NOT play a sound
        // (using 'arise-alarms' plays mantra_alarm.wav which interrupts the looping audio)
        await notifee.createChannel({
          id: 'alarm-bttf-silent',
          name: 'Alarm Return Prompt',
          importance: AndroidImportance.HIGH,
        });
        const id = await notifee.displayNotification({
          id: 'alarm-bttf',
          title: '⏰ Alarm Ringing!',
          body: 'Return to complete your mission and stop the alarm.',
          android: {
            channelId: 'alarm-bttf-silent',
            importance: AndroidImportance.HIGH,
            category: AndroidCategory.ALARM,
            visibility: AndroidVisibility.PUBLIC,
            ongoing: true,
            asForegroundService: false,
            fullScreenAction: {
              id: 'default',
              launchActivity: 'default',
            },
            pressAction: { id: 'default', launchActivity: 'default' },
          },
        });
        bttfNotifIdRef.current = id ?? 'alarm-bttf';
      } catch (e) { console.warn('[AlarmRinging] bttf notif error:', e); }
    };

    const cancelBttfNotif = () => {
      notifee.cancelNotification(bttfNotifIdRef.current ?? 'alarm-bttf').catch(() => {});
      notifee.cancelNotification('alarm-bttf').catch(() => {});
      bttfNotifIdRef.current = null;
    };

    const sub = AppState.addEventListener('change', (nextState) => {
      if (
        !alarmStopped &&
        appStateRef.current === 'active' &&
        (nextState === 'background' || nextState === 'inactive')
      ) {
        appStateRef.current = nextState;
        fireBttfNotif();
      } else if (
        !alarmStopped &&
        (appStateRef.current === 'background' || appStateRef.current === 'inactive') &&
        nextState === 'active'
      ) {
        appStateRef.current = nextState;
        cancelBttfNotif();
        // Native vibration continues uninterrupted in the JVM service — no restart needed.
        triggerShake();
      } else {
        appStateRef.current = nextState;
      }
    });
    return () => {
      sub.remove();
      cancelBttfNotif();
    };
  }, [alarmStopped]);

  // ── Snooze countdown timer ──────────────────────────────────────────────────
  useEffect(() => {
    if (snoozedFor === null) return;
    let secondsLeft = snoozedFor * 60;
    setSnoozeCountdown(secondsLeft);
    const interval = setInterval(async () => {
      secondsLeft -= 1;
      setSnoozeCountdown(secondsLeft);
      if (secondsLeft <= 0) {
        clearInterval(interval);
        setSnoozedFor(null);
        setSnoozeCountdown(null);
        // Re-trigger alarm sounds when snooze ends — restore native volume + vibration
        await setNativeAlarmVolume(1.0);
        startAlarmVibration();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [snoozedFor]);

  // ── Bootstrap ───────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await store.getJSON<MissionSettings>(KEYS.missionSettings);
      const settings = saved ? { ...DEFAULT_MISSION_SETTINGS, ...saved } : DEFAULT_MISSION_SETTINGS;
      if (cancelled) return;
      setMs(settings);

      const dosha = await store.getJSON<{ name?: string }>(KEYS.dosha);
      const name = dosha?.name ?? 'Champion';
      if (cancelled) return;
      setUserName(name);

      const alarmCfg = await store.getJSON<AlarmSettings>(KEYS.alarmSettings);
      const mantraId = alarmCfg?.selectedMantraId ?? 'gayatri';
      const meta = ALARM_SOUND_META[mantraId] ?? { label: 'Sacred Sound', icon: '🕉️', color: '#fbbf24' };
      const bgSrc = ALARM_SOUND_BUNDLED_IMAGES[mantraId]
        ?? (SOUND_IMAGES[mantraId] ? { uri: getLocalSoundImageUri(SOUND_IMAGES[mantraId]) } : null);
      if (!cancelled) { setSoundMeta(meta); setBgImageSource(bgSrc); }
      const useGentle = alarmCfg?.gentleWake ?? false;
      const rampMins = alarmCfg?.rampMinutes ?? 5;
      gentleWakeRef.current = useGentle;
      rampMinutesRef.current = rampMins;

      // ── Play correct mantra / nature / gentle / fusion audio via JS layer ───
      // FOREGROUND FIX: Stop ambient sound FIRST and wait for audio session release
      // before claiming it with expo-av. Previously stopAmbientSound ran in a separate
      // useEffect concurrently with playWakeAudio, causing audio session conflicts
      // when the alarm fired while the app was already open.
      if (!cancelled) {
        await stopAmbientSound(false).catch(() => {});
        dismissMoodSheet();
        // Give the audio session 150ms to release before we reclaim it
        await new Promise<void>(r => setTimeout(r, 150));
      }
      if (cancelled) return;

      if (!cancelled) {
        if (mantraId === 'fusion') {
          // Fusion path: 5-phase cross-fade sequence (nature → birds → sitar → mantra → flute)
          await playFusionAlarm(soundRef, 'gayatri', useGentle, rampMins);
        } else if (useGentle) {
          // Gentle path: starts at 5 % volume and ramps up
          await playGentleAlarmAudio(soundRef, mantraId, rampMins);
        } else {
          // Normalise ID: 'shivtandav' in alarms.tsx maps to 'shiv_tandav' in WAKE_SOUNDS
          const wakeId = MANTRA_TO_WAKE[mantraId] ?? mantraId;
          const wakeSound = WAKE_SOUNDS.find(s => s.id === wakeId) ?? WAKE_SOUNDS.find(s => s.id === mantraId) ?? null;
          // BUNDLED_NATURE_ASSETS covers all ALL_SLEEP_SOUNDS IDs — check it first so
          // no sound ever falls through to gayatri's audioUrl as a wrong default.
          const bundledAsset = BUNDLED_NATURE_ASSETS[mantraId] ?? BUNDLED_MANTRA_ASSETS[mantraId] ?? wakeSound?.bundledAsset;
          const localPath = getLocalMantraPath(mantraId);
          const localInfo = await FileSystem.getInfoAsync(localPath).catch(() => ({ exists: false }));
          const audioSrc: string | null = bundledAsset ? null
            : (localInfo as any).exists ? (localInfo as any).uri
            : (wakeSound?.audioUrl ?? null);
          await playWakeAudio(audioSrc, bundledAsset);
        }
      }

      // Race-condition guard: if handleStart/cleanup set cancelled=true while
      // createAsync was still in-flight, the sound was created after the stop
      // no-op. Catch the leak immediately before any further async work.
      if (cancelled) {
        stopWakeAudio().catch?.(() => {});
        cancelVolumeRamp();
        cancelFusion();
        return;
      }

      // ── Native AlarmSoundService stays alive DURING alarm ─────────
      // It is stopped in stopAlarmCompletely() right before navigating
      // to the mission screen. JS audio (__missionBgSound) takes over.

      if (settings.bodhiMorningBrief && !cancelled) {
        const mission = MISSIONS.find(m => m.id === settings.selectedMission);
        const mantraLabel =
          mantraId === 'lalitha'              ? 'Lalitha Sahasranama' :
          mantraId === 'shivtandav'           ? 'Shiv Tandav' :
          mantraId === 'bhagya_suktam'        ? 'Bhagya Suktam' :
          mantraId === 'shiv_sankalpa_suktam' ? 'Shiv Sankalpa Suktam' : 'Gayatri Mantra';
        const hour = new Date().getHours();
        const kalaLine = hour < 10 ? 'the golden morning window is open' : "it's time to lock in";
        const script =
          `Good morning ${name}. It's ${fmtTime()}, ${kalaLine}. Your ${mantraLabel} is playing. ` +
          `Mission today: ${mission?.name}. You're on a ${settings.streak || 1}-day streak — don't break it now. ` +
          `${mission?.hype} Let's go.`;
        // Mantra stays at full volume — both alarm and Bodhi play simultaneously
        speakBodhi(script).then(async () => {
          if (cancelled) return;
          // speakBodhi sets shouldDuckAndroid:true globally — restore alarm audio mode
          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: true,
            shouldDuckAndroid: false,
            interruptionModeIOS: 1,
            interruptionModeAndroid: 1,
          }).catch(() => {});
        }).catch(async () => {
          // TTS failed — restore audio mode so alarm is never affected
          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: true,
            shouldDuckAndroid: false,
            interruptionModeIOS: 1,
            interruptionModeAndroid: 1,
          }).catch(() => {});
        });
      }

      // NOTE: Do NOT call Haptics.impactAsync() here.
      // Native AlarmSoundService already runs the hardware vibration pattern via
      // startAlarmVibration(). Adding a JS Haptics call on top causes abnormal/
      // chaotic vibration when the alarm fires while the app is in the foreground.
    })();
    return () => {
      cancelled = true;
      cancelVolumeRamp();
      cancelFusion();
      stopBodhi();
      stopWakeAudio();
    };
  }, []);

  const mission = MISSIONS.find(m => m.id === ms.selectedMission) ?? MISSIONS[4];
  const hour = new Date().getHours();
  const kala = getKalaMessage(hour);
  const today = new Date().getDay();
  const quote = WAKE_QUOTES[today % WAKE_QUOTES.length];

  // ── STOP ALARM completely (mission started) ─────────────────────────────────
  const stopAlarmCompletely = async () => {
    setAlarmStopped(true);
    stopBodhi();
    // Transfer JS audio to mission screen so mantra keeps playing until mission
    // is fully completed. Setting soundRef to null prevents the unmount cleanup
    // from stopping the sound prematurely.
    if (soundRef.current) {
      (global as any).__missionBgSound = soundRef.current;
      soundRef.current = null;
    }
    // Stop vibration immediately — double-call after 300 ms catches any JVM restart
    stopAlarmVibration().catch(() => {});
    setTimeout(() => { stopAlarmVibration().catch(() => {}); }, 300);
    // Stop native AlarmSoundService completely — clears alarm_fired_pending synchronously
    // and stops the FGS + bringToFrontRunnable watchdog. Previously setNativeAlarmVolume(0)
    // only muted the MediaPlayer but left alarm_fired_pending=true and the watchdog running,
    // causing a crash loop every time the user opened the app after completing the mission.
    // The JS __missionBgSound (expo-av) continues playing independently of the native FGS.
    await stopNativeAlarmSound().catch(() => {});
    // Belt-and-suspenders JS flag: _layout.tsx checks this to skip routing to alarm-ringing
    // even if the native stopAlarmSound call silently fails (e.g. during ReactContext teardown).
    await AsyncStorage.setItem('onesutra_alarm_handled_v1', Date.now().toString()).catch(() => {});
    // Cancel all "bring to front" notifications so no notification can re-open
    // the alarm screen after the user has tapped Begin Your Day.
    notifee.cancelNotification('alarm-bttf').catch(() => {});
    notifee.cancelNotification(bttfNotifIdRef.current ?? 'alarm-bttf').catch(() => {});
  };

  // ── START MISSION ───────────────────────────────────────────────────────────
  const handleStart = async () => {
    if (missionStartedRef.current) return;
    missionStartedRef.current = true;

    const user = auth.currentUser;
    if (user) {
      const now = new Date();
      saveHabitLog({
        habitId: 'wake_early', habitName: 'Wake Early', userId: user.uid,
        date: todayStr(), status: 'done',
        wakeTime: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
      }).catch(() => {});
    }

    // Record wake time & update sunrise streak
    try {
      const loc = await store.getJSON<{ lat: number; lon: number }>(KEYS.location);
      if (loc?.lat && loc?.lon) {
        const solar = await getSolarTimes(loc.lat, loc.lon);
        await recordWake(solar.sunrise);
      } else {
        await recordWake(6.25); // fallback ~6:15 AM
      }
    } catch { /* non-blocking */ }

    await stopAlarmCompletely();
    await AsyncStorage.setItem('onesutra_mission_active_v1', mission.id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace(`/mission?id=${mission.id}` as never);
  };

  // ── SNOOZE ──────────────────────────────────────────────────────────────────
  const handleSnoozeChoice = async (minutes: number) => {
    setShowSnoozeModal(false);
    setSnoozedFor(minutes);
    // Duck native alarm audio and vibration during snooze (service stays alive)
    await setNativeAlarmVolume(0.08);
    stopAlarmVibration();
    stopBodhi();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  // Snooze countdown display
  const fmtCountdown = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${pad(m)}:${pad(sec)}`;
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <ImageBackground
      source={bgUri ? { uri: bgUri } : (bgImageSource ?? undefined)}
      style={S.screen}
      imageStyle={{ opacity: 1 }}
    >
      <StatusBar hidden />

      {/* Dark gradient — heavy at poles, transparent in middle so image shows */}
      <LinearGradient
        colors={['rgba(0,0,0,0.72)', 'rgba(0,0,0,0.10)', 'rgba(0,0,0,0.10)', 'rgba(0,0,0,0.88)']}
        locations={[0, 0.18, 0.55, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Subtle ambient colour wash */}
      <View style={[S.ambientGlow, { backgroundColor: soundMeta.color + '0E' }]} pointerEvents="none" />

      {/* ── TOP: time + sound chip ── */}
      <View style={S.topArea}>
        <Text style={S.clockText}>{timeStr}</Text>
        <View style={[S.chip, { borderColor: soundMeta.color + '55', backgroundColor: 'rgba(0,0,0,0.40)' }]}>
          <View style={[S.liveDot, { backgroundColor: soundMeta.color }]} />
          <Text style={{ fontSize: 13 }}>{soundMeta.icon}</Text>
          <Text style={[S.chipLabel, { color: soundMeta.color }]}>{soundMeta.label || 'Now Playing'}</Text>
        </View>
      </View>

      {/* ── CENTER: pulsing orb OR snooze countdown ── */}
      {snoozedFor === null ? (
        <View style={S.orbWrap} pointerEvents="none">
          <Animated.View style={[S.outerRing, outerStyle, { borderColor: soundMeta.color + '40' }]} />
          <View style={[S.midRing, { borderColor: soundMeta.color + '20' }]} />
          <Animated.View style={[S.innerCircle, innerStyle, { backgroundColor: soundMeta.color + '18', borderColor: soundMeta.color + '50' }]}>
            <Text style={S.orbIcon}>{soundMeta.icon || '🕉️'}</Text>
          </Animated.View>
        </View>
      ) : (
        <View style={S.orbWrap}>
          <Text style={S.snoozeActiveLabel}>SNOOZED — RESUMES IN</Text>
          {snoozeCountdown !== null && (
            <Text style={[S.snoozeActiveTimer, { color: soundMeta.color }]}>{fmtCountdown(snoozeCountdown)}</Text>
          )}
          <Text style={S.snoozeActiveNote}>Mission challenge starts when alarm resumes.</Text>
        </View>
      )}

      {/* ── BOTTOM ── */}
      {snoozedFor === null ? (
        <View style={S.bottomArea}>
          {/* Kala + streak hint */}
          <Text style={[S.kalaHint, { color: soundMeta.color + 'BB' }]}>
            {kala.toUpperCase()}{'  ·  '}{userName} · DAY {ms.streak || 1} 🔥
          </Text>

          {/* Mission pill */}
          <Animated.View style={[shakeStyle, { width: '100%' }]}>
            <View style={[S.missionPill, { borderColor: mission.color + '40', backgroundColor: 'rgba(0,0,0,0.35)' }]}>
              <Text style={{ fontSize: 22 }}>{mission.icon}</Text>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[S.missionBadge, { color: mission.color + 'AA' }]}>TODAY'S MISSION</Text>
                <Text style={S.missionName}>{mission.name}</Text>
              </View>
            </View>
          </Animated.View>

          {/* CTA — glassmorphism, sleek */}
          <Animated.View style={[{ width: '100%' }, btnStyle]}>
            <TouchableOpacity
              style={[S.ctaBtn, { shadowColor: soundMeta.color }]}
              onPress={handleStart}
              activeOpacity={0.84}
            >
              <LinearGradient
                colors={[soundMeta.color + '55', soundMeta.color + '30']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[StyleSheet.absoluteFillObject, { borderRadius: 24 }]}
              />
              <Text style={S.ctaIcon}>☀️</Text>
              <View style={{ marginLeft: 10 }}>
                <Text style={S.ctaTitle}>Begin Your Day</Text>
                <Text style={S.ctaSub}>tap to stop alarm · start mission</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* Snooze — very subtle ghost pill */}
          <TouchableOpacity style={S.snoozeBtn} onPress={() => setShowSnoozeModal(true)} activeOpacity={0.75}>
            <Text style={S.snoozeBtnText}>💤  Snooze</Text>
          </TouchableOpacity>

          {/* Lock badge */}
          <View style={S.lockBadge}>
            <Text style={S.lockText}>🔒  Can't close · complete mission or snooze</Text>
          </View>
        </View>
      ) : (
        <View style={S.bottomArea}>
          <View style={S.lockBadge}>
            <Text style={S.lockText}>⏰  Alarm will resume automatically</Text>
          </View>
        </View>
      )}

      {/* ── Snooze picker modal ── */}
      <Modal visible={showSnoozeModal} transparent animationType="slide">
        <View style={S.modalOverlay}>
          <View style={[S.snoozeSheet, { borderColor: mission.color + '30' }]}>
            <View style={S.sheetHandle} />
            <Text style={S.snoozeSheetTitle}>💤  Snooze</Text>
            <Text style={S.snoozeSheetSub}>
              Your streak is at risk.{'\n'}
              Mission stays when alarm resumes.
            </Text>
            <View style={{ gap: 10, marginTop: 8 }}>
              {SNOOZE_OPTIONS.map(min => (
                <TouchableOpacity
                  key={min}
                  style={[S.snoozeOption, { borderColor: mission.color + '50' }]}
                  onPress={() => handleSnoozeChoice(min)}
                  activeOpacity={0.82}
                >
                  <View>
                    <Text style={S.snoozeOptionMin}>{min} min</Text>
                    <Text style={[S.snoozeOptionLabel, { color: mission.color }]}>Snooze</Text>
                  </View>
                  <Text style={{ fontSize: 18, color: mission.color + '80' }}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={S.snoozeCancelBtn} onPress={() => setShowSnoozeModal(false)}>
              <Text style={S.snoozeCancelText}>← Back to Mission</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ImageBackground>
  );
}

const S = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: '#04040E' },
  ambientGlow: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },

  // Top
  topArea:   { paddingTop: 54, alignItems: 'center', gap: 10 },
  chip:      { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 99, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: 'rgba(6,15,40,0.72)' },
  liveDot:   { width: 7, height: 7, borderRadius: 3.5 },
  chipLabel: { fontSize: 13, fontWeight: '800', letterSpacing: 0.4 },
  clockText: { fontSize: 64, fontWeight: '100', color: '#FFFFFF', letterSpacing: -2.5 },

  // Center orb
  orbWrap:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  outerRing:   { position: 'absolute', width: 220, height: 220, borderRadius: 110, borderWidth: 1.5 },
  midRing:     { position: 'absolute', width: 160, height: 160, borderRadius: 80, borderWidth: 1 },
  innerCircle: { width: 110, height: 110, borderRadius: 55, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  orbIcon:     { fontSize: 44 },

  // Snooze active (inside orbWrap)
  snoozeActiveLabel: { fontSize: 9, fontWeight: '900', color: '#FFFFFF30', letterSpacing: 2, marginBottom: 8 },
  snoozeActiveTimer: { fontSize: 80, fontWeight: '100', letterSpacing: -4 },
  snoozeActiveNote:  { fontSize: 12, color: '#FFFFFF35', marginTop: 12, textAlign: 'center', fontStyle: 'italic', lineHeight: 18 },

  // Bottom
  bottomArea:  { paddingHorizontal: 26, paddingBottom: 52, alignItems: 'center', gap: 12 },
  kalaHint:    { fontSize: 9, fontWeight: '800', letterSpacing: 1.8 },

  // Mission pill — Deep Navy Tinted Glass
  missionPill:  { width: '100%', flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 18, paddingHorizontal: 18, paddingVertical: 14, backgroundColor: 'rgba(6,15,40,0.72)', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.38, shadowRadius: 20, elevation: 12 },
  missionBadge: { fontSize: 8, fontWeight: '900', letterSpacing: 2 },
  missionName:  { fontSize: 16, fontWeight: '900', color: '#FFFFFF', marginTop: 2 },

  // CTA — glassmorphism, not solid
  ctaBtn: {
    width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 24, paddingVertical: 22, overflow: 'hidden',
    shadowOpacity: 0.45, shadowRadius: 24, elevation: 12, shadowOffset: { width: 0, height: 6 },
  },
  ctaIcon:  { fontSize: 22, color: '#FFFFFFEE' },
  ctaTitle: { fontSize: 18, fontWeight: '900', color: '#FFFFFFEE', letterSpacing: 0.2 },
  ctaSub:   { fontSize: 10, fontWeight: '600', color: '#FFFFFF70', letterSpacing: 0.5, marginTop: 2 },

  // Snooze — ghost pill, minimal
  snoozeBtn:     { paddingHorizontal: 28, paddingVertical: 11, borderRadius: 99, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', backgroundColor: 'rgba(6,15,40,0.55)' },
  snoozeBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF45' },

  // Lock badge
  lockBadge: { paddingHorizontal: 14, paddingVertical: 6, backgroundColor: '#FFFFFF05', borderRadius: 99, borderWidth: 1, borderColor: '#FFFFFF0E' },
  lockText:  { fontSize: 9, color: '#FFFFFF30', fontWeight: '700', letterSpacing: 0.3 },

  // Modal
  modalOverlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.80)', justifyContent: 'flex-end' },
  snoozeSheet:       { backgroundColor: 'rgba(6,15,40,0.92)', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.22)', padding: 24, paddingBottom: 44 },
  sheetHandle:       { width: 36, height: 4, borderRadius: 2, backgroundColor: '#FFFFFF20', alignSelf: 'center', marginBottom: 18 },
  snoozeSheetTitle:  { fontSize: 22, fontWeight: '900', color: '#fff', marginBottom: 4 },
  snoozeSheetSub:    { fontSize: 13, color: '#FFFFFF45', lineHeight: 20, marginBottom: 4 },
  snoozeOption:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 18, paddingHorizontal: 20, paddingVertical: 16, backgroundColor: 'rgba(6,15,40,0.72)' },
  snoozeOptionMin:   { fontSize: 20, fontWeight: '900', color: '#fff' },
  snoozeOptionLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5, marginTop: 2 },
  snoozeCancelBtn:   { alignItems: 'center', paddingVertical: 16, marginTop: 6 },
  snoozeCancelText:  { fontSize: 13, color: '#FFFFFF35', fontWeight: '700' },
});
