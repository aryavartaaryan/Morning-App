import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch,
  Modal, Animated, Dimensions, ImageBackground,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import notifee, { AndroidImportance, AndroidCategory, AndroidVisibility, TriggerType, RepeatFrequency, AlarmType } from '@notifee/react-native';
import { store, KEYS } from '@/lib/storage';
import { AlarmSettings, DEFAULT_ALARM_SETTINGS } from '@/lib/notifications';
import { Colors, Font } from '@/constants/theme';
import { useSoundPlayer, PlayableSoundMeta } from '@/lib/soundPlayerContext';
import { SOUND_IMAGES as SOUND_IMAGES_LIB } from '@/lib/sleepSoundsData';

const { width: W } = Dimensions.get('window');
const SLEEP_COLOR = '#007AFF';
const CARD_W = (W - 48) / 2;
const THEME_CARD_W = 138;
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
  { id: 'city_night',      label: 'City Night',       emoji: '🏙️', cat: 'Ambient', color: '#fbbf24', top: '#201808' as const, bot: '#100D05' as const, desc: 'Distant city hum',                   src: require('../../assets/sounds/mixkit-urban-ambience-during-the-day-2505.m4a') },
  { id: 'campfire',        label: 'Forest Campfire',  emoji: '🔥', cat: 'Nature',  color: '#f97316', top: '#1A0A00' as const, bot: '#0A0500' as const, desc: 'Crackling fire in the woods',         src: require('../../assets/sounds/forest-campfire.m4a') },
  { id: 'morning_birds',   label: 'Morning Birds',    emoji: '🐦', cat: 'Nature',  color: '#fde68a', top: '#1A1400' as const, bot: '#0A0A00' as const, desc: 'Dawn chorus at sunrise',              src: require('../../assets/sounds/morning-birds-loop.m4a') },
  { id: 'spring_birds',    label: 'Spring Birds',     emoji: '🌸', cat: 'Nature',  color: '#f9a8d4', top: '#1A0A12' as const, bot: '#0A050A' as const, desc: 'Birds of a blooming spring day',      src: require('../../assets/sounds/spring-birds-morning.m4a') },
  { id: 'wanderlust',      label: 'Wanderlust Breeze',emoji: '🌬️', cat: 'Nature',  color: '#bae6fd', top: '#0A1620' as const, bot: '#050B10' as const, desc: 'Open skies and wandering wind',       src: require('../../assets/sounds/wanderlust-breeze.m4a') },
  { id: 'forest_birds',    label: 'Forest Birds',     emoji: '🌳', cat: 'Nature',  color: '#86efac', top: '#081808' as const, bot: '#040C04' as const, desc: 'Birds singing deep in the forest',    src: require('../../assets/sounds/forest-birds-spring.m4a') },
  { id: 'hz_432',          label: '432 Hz Bells',     emoji: '🔔', cat: 'Sacred',  color: '#c084fc', top: '#14082A' as const, bot: '#0A0516' as const, desc: 'Healing frequency, calm the mind',    src: require('../../assets/sounds/432hz-healing-bells.m4a') },
  { id: 'singing_bowl',    label: 'Deep Singing Bowl',emoji: '🔮', cat: 'Sacred',  color: '#a78bfa', top: '#10082A' as const, bot: '#080515' as const, desc: 'Deep resonance for meditation',       src: require('../../assets/sounds/singing-bowl-deep.m4a') },
  { id: 'tibetan_bowl',    label: 'Tibetan Bowl',     emoji: '🫙', cat: 'Sacred',  color: '#818cf8', top: '#0C0822' as const, bot: '#060411' as const, desc: 'Ancient healing bowl tones',          src: require('../../assets/sounds/tibetan-bowl.m4a') },
  { id: 'morning_flute',   label: 'Light Meditation Tone', emoji: '🎶', cat: 'Sacred',  color: '#6ee7b7', top: '#082018' as const, bot: '#04100C' as const, desc: 'Gentle tones for a peaceful dawn',       src: require('../../assets/sounds/morning-flute.m4a') },
  { id: 'sitar',           label: 'Calm Raga',        emoji: '🎸', cat: 'Sacred',  color: '#fcd34d', top: '#1A1200' as const, bot: '#0A0900' as const, desc: 'Classical raga to ease the mind',     src: require('../../assets/sounds/sitar-morning.m4a') },
  { id: 'indian_beats',    label: 'Indian Beats',     emoji: '🥁', cat: 'Sacred',  color: '#fb923c', top: '#1A0A00' as const, bot: '#0A0500' as const, desc: 'Rhythmic tabla & percussion',         src: require('../../assets/sounds/indian-beats.m4a') },
] as const;

type SoundId = typeof SLEEP_SOUNDS[number]['id'];
type SoundItem = typeof SLEEP_SOUNDS[number];
const CATEGORIES = ['All', 'Rain', 'Ocean', 'Nature', 'Ambient', 'Sacred'] as const;
type Category = typeof CATEGORIES[number];

const LALITHA_IMG = require('../../assets/images/mata-lalitha.jpg');

const SOUND_BUNDLED_IMAGES: Record<string, any> = {
  mantra_lalitha: LALITHA_IMG,
};

// ─── Nature background images (Unsplash) ────────────────────────────────────
const SOUND_IMAGES: Record<string, string> = {
  light_rain:    'https://images.unsplash.com/photo-1519692933481-e162a57d6721?w=600&q=80&auto=format&fit=crop',
  heavy_rain:    'https://images.unsplash.com/photo-1428592953211-077101b2021b?w=600&q=80&auto=format&fit=crop',
  rain_thunder:  'https://images.unsplash.com/photo-1504370805625-d32c54b16100?w=600&q=80&auto=format&fit=crop',
  jungle_rain:   'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600&q=80&auto=format&fit=crop',
  jungle_storm:  'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=600&q=80&auto=format&fit=crop',
  sea_waves:     'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=600&q=80&auto=format&fit=crop',
  rocky_shore:   'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=80&auto=format&fit=crop',
  harbor_waves:  'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?w=600&q=80&auto=format&fit=crop',
  flowing_water: 'https://images.unsplash.com/photo-1465929639680-64ee080eb3ed?w=600&q=80&auto=format&fit=crop',
  forest_breeze: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=600&q=80&auto=format&fit=crop',
  night_forest:  'https://images.unsplash.com/photo-1518051870910-a46e30d9db16?w=600&q=80&auto=format&fit=crop',
  gentle_wind:   'https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?w=600&q=80&auto=format&fit=crop',
  city_night:    'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=600&q=80&auto=format&fit=crop',
  campfire:      'https://images.unsplash.com/photo-1504851149312-7a075b496cc7?w=600&q=80&auto=format&fit=crop',
  morning_birds: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=600&q=80&auto=format&fit=crop',
  spring_birds:  'https://images.unsplash.com/photo-1462275646964-a0e3386b89fa?w=600&q=80&auto=format&fit=crop',
  wanderlust:    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&q=80&auto=format&fit=crop',
  forest_birds:  'https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?w=600&q=80&auto=format&fit=crop',
  hz_432:        'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=600&q=80&auto=format&fit=crop',
  singing_bowl:  'https://images.unsplash.com/photo-1600881333168-2ef49b341f30?w=600&q=80&auto=format&fit=crop',
  tibetan_bowl:  'https://images.pexels.com/photos/6997988/pexels-photo-6997988.jpeg?auto=compress&cs=tinysrgb&w=600',
  morning_flute: 'https://images.pexels.com/photos/5386063/pexels-photo-5386063.jpeg?auto=compress&cs=tinysrgb&w=600',
  sitar:         'https://images.pexels.com/photos/372281/pexels-photo-372281.jpeg?auto=compress&cs=tinysrgb&w=600',
  indian_beats:        'https://images.pexels.com/photos/35736415/pexels-photo-35736415.jpeg?auto=compress&cs=tinysrgb&w=600',
  mantra_gayatri:       'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=600&q=80&auto=format&fit=crop',
  mantra_lalitha:       'https://images.unsplash.com/photo-1490750967868-88df5691b30c?w=600&q=80&auto=format&fit=crop',
  mantra_shivtandav:    'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=600&q=80&auto=format&fit=crop',
  stotra_bhagya:        'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80&auto=format&fit=crop',
  stotra_shiv_sankalpa: 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=600&q=80&auto=format&fit=crop',
};

// ─── Time-based sound mode system ───────────────────────────────────────────
type SoundMode = {
  key: string; icon: string; label: string; subtitle: string;
  headerGrad: readonly [string, string, string];
  recommended: string[];
};

const SOUND_MODES: Record<string, SoundMode> = {
  morning: { key: 'morning', icon: '🌅', label: 'Morning Sounds',    subtitle: 'Your body was born of nature · Let it return, breathe, and heal',  headerGrad: ['#050201', '#000000', '#000000'], recommended: ['hz_432', 'morning_flute', 'spring_birds', 'forest_breeze', 'tibetan_bowl'] },
  focus:   { key: 'focus',   icon: '💼', label: 'Listen & Work',      subtitle: 'Pitta Peak · Deep focus',             headerGrad: ['#000408', '#000000', '#000000'], recommended: ['light_rain', 'flowing_water', 'forest_breeze', 'gentle_wind', 'sea_waves'] },
  restore: { key: 'restore', icon: '🌿', label: 'Afternoon Restore',  subtitle: 'Vata ease · Slow the mind',           headerGrad: ['#000305', '#000000', '#000000'], recommended: ['flowing_water', 'forest_breeze', 'singing_bowl', 'hz_432', 'morning_birds'] },
  evening: { key: 'evening', icon: '🌙', label: 'Evening Wind Down',  subtitle: 'Kapha dusk · Rest approaches',        headerGrad: ['#020009', '#000000', '#000000'], recommended: ['tibetan_bowl', 'singing_bowl', 'night_forest', 'campfire', 'harbor_waves'] },
  sleep:   { key: 'sleep',   icon: '🌌', label: 'Good Night',         subtitle: 'Deep rest · Surrender fully',         headerGrad: ['#000007', '#000000', '#000000'], recommended: ['light_rain', 'night_forest', 'harbor_waves', 'tibetan_bowl', 'flowing_water', 'sea_waves', 'heavy_rain', 'campfire', 'singing_bowl', 'rain_thunder', 'jungle_rain'] },
};

function getAutoMode(h: number): SoundMode {
  if (h >= 4 && h < 9)  return SOUND_MODES.morning;
  if (h >= 9 && h < 14) return SOUND_MODES.focus;
  if (h >= 14 && h < 18) return SOUND_MODES.restore;
  if (h >= 18 && h < 22) return SOUND_MODES.evening;
  return SOUND_MODES.sleep;
}

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
  { id: 'deep_sleep',   title: 'Deep Sleep',    subtitle: 'TOTAL SURRENDER', tags: 'All night',  category: 'All'     as Category, gradient: ['#04021A', '#080525', '#030110'] as const, orb1: '#1A0A50', orb2: '#100830', accent: '#7c3aed', featuredId: 'light_rain'    as SoundId, imageUri: 'https://images.pexels.com/photos/1252869/pexels-photo-1252869.jpeg?auto=compress&cs=tinysrgb&w=400' },
  { id: 'rain_stories', title: 'Rain Stories',  subtitle: 'WASH IT AWAY',    tags: 'Storm',      category: 'Rain'    as Category, gradient: ['#061825', '#0A2235', '#040E1A'] as const, orb1: '#0D3050', orb2: '#051528', accent: '#60a5fa', featuredId: 'light_rain'    as SoundId, imageUri: 'https://images.pexels.com/photos/459451/pexels-photo-459451.jpeg?auto=compress&cs=tinysrgb&w=400'   },
  { id: 'ocean_drift',  title: 'Ocean Drift',   subtitle: 'DEEP BLUE PEACE', tags: 'Coastal',    category: 'Ocean'   as Category, gradient: ['#041A20', '#062530', '#021015'] as const, orb1: '#083540', orb2: '#041A25', accent: '#38bdf8', featuredId: 'sea_waves'     as SoundId, imageUri: 'https://images.pexels.com/photos/1295138/pexels-photo-1295138.jpeg?auto=compress&cs=tinysrgb&w=400' },
  { id: 'forest_night', title: 'Forest Night',  subtitle: 'EARTH & SILENCE', tags: 'Wilderness', category: 'Nature'  as Category, gradient: ['#041508', '#07200D', '#020A04'] as const, orb1: '#0A2F12', orb2: '#042008', accent: '#4ade80', featuredId: 'forest_breeze' as SoundId, imageUri: 'https://images.pexels.com/photos/1448055/pexels-photo-1448055.jpeg?auto=compress&cs=tinysrgb&w=400' },
  { id: 'city_rest',    title: 'City Rest',     subtitle: 'URBAN LULLABY',   tags: 'Distant',    category: 'Ambient' as Category, gradient: ['#1A1008', '#2A1A10', '#0E0904'] as const, orb1: '#3A2010', orb2: '#200E06', accent: '#fbbf24', featuredId: 'city_night'    as SoundId, imageUri: 'https://images.pexels.com/photos/466685/pexels-photo-466685.jpeg?auto=compress&cs=tinysrgb&w=400'   },
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
      <ImageBackground source={{ uri: theme.imageUri }} style={S.themeCard} imageStyle={{ borderRadius: 20 }}>
        {/* Dark gradient overlay for text readability */}
        <LinearGradient
          colors={['rgba(0,0,0,0.08)', 'rgba(0,0,0,0.48)', 'rgba(0,0,0,0.88)']}
          style={StyleSheet.absoluteFillObject}
        />
        {/* Subtle accent colour wash */}
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: theme.orb1, opacity: 0.22, borderRadius: 20 }]} />
        {/* Content */}
        <View style={S.themeContent}>
          <Text style={[S.themeSubtitle, { color: theme.accent + 'CC' }]}>{theme.subtitle}</Text>
          <Text style={S.themeTitle}>{theme.title}</Text>
          <View style={[S.themeTagRow, { borderColor: theme.accent + '40', backgroundColor: theme.accent + '18' }]}>
            <View style={[S.themeTagDot, { backgroundColor: theme.accent }]} />
            <Text style={[S.themeTagTxt, { color: theme.accent }]}>{theme.tags}</Text>
          </View>
        </View>
        {/* Corner arrow */}
        <View style={[S.themeArrow, { backgroundColor: theme.accent + '25', borderColor: theme.accent + '40' }]}>
          <Ionicons name="arrow-forward" size={11} color={theme.accent + 'DD'} />
        </View>
      </ImageBackground>
    </TouchableOpacity>
  );
});

// ─── Sound Card — nature image background ────────────────────────────────────
const SoundCard = memo(function SoundCard({
  sound, isPlaying, isPaused, remaining, onPress,
}: {
  sound: SoundItem; isPlaying: boolean; isPaused: boolean; remaining: number; onPress: () => void;
}) {
  const pulse = useRef(new Animated.Value(1)).current;
  const imgBundled = SOUND_BUNDLED_IMAGES[sound.id];
  const imgUri = !imgBundled ? (SOUND_IMAGES[sound.id] ?? undefined) : undefined;
  const imgSource = imgBundled ?? (imgUri ? { uri: imgUri } : undefined);

  useEffect(() => {
    if (isPlaying && !isPaused) {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 1.04, duration: 2200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 2200, useNativeDriver: true }),
      ]));
      loop.start();
      return () => loop.stop();
    }
    pulse.setValue(1);
  }, [isPlaying, isPaused]);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.80} style={{ width: CARD_W }}>
      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <View style={[S.soundCard, isPlaying && { borderColor: sound.color + '80', borderWidth: 1.5 }]}>
          <ImageBackground
            source={imgSource}
            style={S.soundImgBg}
            imageStyle={{ borderRadius: 20 }}>
            {/* Dark gradient overlay so text is always readable */}
            <LinearGradient
              colors={['rgba(0,0,0,0.08)', 'rgba(0,0,0,0.58)', 'rgba(0,0,0,0.82)']}
              style={[StyleSheet.absoluteFillObject, { borderRadius: 20 }]}
            />
            {/* Color tint when active */}
            {isPlaying && (
              <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: sound.color + '20' }]} />
            )}
            {/* Fallback gradient when no image */}
            {!imgSource && (
              <LinearGradient colors={[sound.top, sound.bot]} style={[StyleSheet.absoluteFillObject, { borderRadius: 20 }]} />
            )}
            <View style={S.soundGrad}>
              {/* Top row */}
              <View style={S.soundTopRow}>
                <View style={[S.soundPlayBtn, {
                  backgroundColor: isPlaying ? sound.color + '30' : 'rgba(0,0,0,0.38)',
                  borderColor: isPlaying ? sound.color + '70' : 'rgba(255,255,255,0.18)',
                }]}>
                  <Ionicons name={isPlaying && !isPaused ? 'pause' : 'play'} size={13} color={isPlaying ? sound.color : '#FFFFFFBB'} />
                </View>
                <Text style={[S.soundEmojiAccent, { opacity: 1 }]}>{sound.emoji}</Text>
              </View>
              {/* Name + desc + badge */}
              <View>
                <Text style={[S.cardName, isPlaying && { color: sound.color }]} numberOfLines={2}>{sound.label}</Text>
                <Text style={S.cardDesc} numberOfLines={1}>{sound.desc}</Text>
                {isPlaying ? (
                  <View style={[S.badge, { backgroundColor: sound.color + '22', borderColor: sound.color + '55' }]}>
                    <View style={[S.liveDot, { backgroundColor: isPaused ? '#888' : sound.color }]} />
                    <Text style={[S.badgeTxt, { color: isPaused ? '#999' : sound.color }]}>{isPaused ? 'Paused' : fmtTimer(remaining)}</Text>
                  </View>
                ) : (
                  <View style={S.badge}>
                    <Text style={S.badgeTxt}>{sound.cat}</Text>
                  </View>
                )}
              </View>
            </View>
          </ImageBackground>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
});

// ─── Featured Hero Card ────────────────────────────────────────────────────────
function FeaturedCard({
  sound, isPlaying, isPaused, sessionSecs: remSecs, modeLabel, onPlay, onToggle, onStop, onOpen,
}: {
  sound: SoundItem;
  isPlaying: boolean;
  isPaused: boolean;
  sessionSecs: number;
  modeLabel: string;
  onPlay: () => void;
  onToggle: () => void;
  onStop: () => void;
  onOpen: () => void;
}) {
  const pulse = useRef(new Animated.Value(0.95)).current;
  useEffect(() => {
    if (isPlaying && !isPaused) {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 2400, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.95, duration: 2400, useNativeDriver: true }),
      ]));
      loop.start();
      return () => loop.stop();
    }
    Animated.timing(pulse, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [isPlaying, isPaused]);

  const imgBundledFeat = SOUND_BUNDLED_IMAGES[sound.id];
  const imgUri = imgBundledFeat ?? (SOUND_IMAGES[sound.id] ? { uri: SOUND_IMAGES[sound.id] } : null);

  return (
    <TouchableOpacity onPress={onOpen} activeOpacity={0.88} style={S.featuredCard}>
      {/* Nature image background */}
      {imgUri ? (
        <ImageBackground source={imgUri} style={StyleSheet.absoluteFillObject} imageStyle={{ borderRadius: 24, opacity: 0.55 }} />
      ) : (
        <LinearGradient colors={[sound.top, sound.bot, '#060610']} style={StyleSheet.absoluteFillObject} />
      )}
      {/* Dark gradient overlay */}
      <LinearGradient
        colors={['rgba(0,0,0,0.0)', 'rgba(4,2,20,0.70)', 'rgba(4,2,20,0.95)']}
        style={[StyleSheet.absoluteFillObject, { borderRadius: 24 }]}
      />
      {/* Color orbs */}
      <Animated.View style={[S.featOrb1, { backgroundColor: sound.color + '18', transform: [{ scale: pulse }] }]} />
      <View style={[S.featOrb2, { backgroundColor: sound.color + '08' }]} />

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
            <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); onToggle(); }} style={[S.featPauseBtn, { borderColor: sound.color + '50', backgroundColor: sound.color + '18' }]}>
              <Ionicons name={isPaused ? 'play' : 'pause'} size={18} color={sound.color} />
              <Text style={[S.featPauseTxt, { color: sound.color }]}>{isPaused ? 'Resume' : 'Pause'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); onStop(); }} style={S.featStopBtn}>
              <Ionicons name="stop-circle-outline" size={16} color="#FFFFFF35" />
              <Text style={S.featStopTxt}>Stop</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          <View style={S.featTopRow}>
            <View style={[S.featLiveBadge, { backgroundColor: '#FFFFFF08', borderColor: '#FFFFFF15' }]}>
              <Text style={[S.featLiveLabel, { color: '#FFFFFF40' }]}>{modeLabel.toUpperCase()}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 99, paddingHorizontal: 9, paddingVertical: 4 }}>
              <Text style={{ fontSize: 9, color: '#FFFFFF50', fontWeight: '600' }}>Open</Text>
              <Ionicons name="expand-outline" size={10} color="#FFFFFF40" />
            </View>
          </View>
          <Text style={S.featTitle}>{sound.label}</Text>
          <Text style={S.featDesc}>{sound.desc}</Text>
          <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); onPlay(); }} style={[S.featPlayBtn, { backgroundColor: sound.color + '22', borderColor: sound.color + '45' }]}>
            <Ionicons name="play" size={15} color={sound.color} />
            <Text style={[S.featPauseTxt, { color: sound.color }]}>Play Now</Text>
          </TouchableOpacity>
        </>
      )}
    </TouchableOpacity>
  );
}

// ─── Full-screen Immersive Sound Player Modal ────────────────────────────────
const { height: SCR_H } = Dimensions.get('window');

function SoundPlayerModal({
  sound, isPlaying, isPaused, sessionSecs,
  stopIdx, onPlay, onToggle, onStop, onChangeTimer, onClose,
}: {
  sound: SoundItem; isPlaying: boolean; isPaused: boolean; sessionSecs: number;
  stopIdx: number; onPlay: () => void; onToggle: () => void;
  onStop: () => void; onChangeTimer: (i: number) => void; onClose: () => void;
}) {
  const slideAnim  = useRef(new Animated.Value(SCR_H)).current;
  const pulseAnim  = useRef(new Animated.Value(1)).current;
  const imgBundledModal = SOUND_BUNDLED_IMAGES[sound.id];
  const imgUri     = imgBundledModal ?? (SOUND_IMAGES[sound.id] ? { uri: SOUND_IMAGES[sound.id] } : null);

  useEffect(() => {
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 60, friction: 11 }).start();
  }, []);

  useEffect(() => {
    if (isPlaying && !isPaused) {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 2000, useNativeDriver: true }),
      ]));
      loop.start();
      return () => loop.stop();
    }
    pulseAnim.setValue(1);
  }, [isPlaying, isPaused]);

  const handleClose = () => {
    Animated.timing(slideAnim, { toValue: SCR_H, duration: 340, useNativeDriver: true }).start(onClose);
  };

  return (
    <Modal visible animationType="none" transparent statusBarTranslucent onRequestClose={handleClose}>
      <Animated.View style={{ flex: 1, transform: [{ translateY: slideAnim }] }}>
        <ImageBackground
          source={imgUri ?? undefined}
          style={{ flex: 1 }}
          imageStyle={{ resizeMode: 'cover' }}>
          {/* Dark overlay layers */}
          <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(3,2,14,0.42)' }} />
          <LinearGradient
            colors={['transparent', 'transparent', 'rgba(4,2,26,0.82)', 'rgba(3,1,18,0.98)']}
            style={StyleSheet.absoluteFillObject}
          />
          {/* Fallback if no image */}
          {!imgUri && (!imgBundledModal) && (
            <LinearGradient colors={[sound.top, sound.bot, '#04021A']} style={StyleSheet.absoluteFillObject} />
          )}

          <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
            {/* Top bar */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingTop: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6 }}>
                <Text style={{ fontSize: 11 }}>{sound.emoji}</Text>
                <Text style={{ fontSize: 9, fontWeight: '900', color: '#FFFFFF60', letterSpacing: 1.2 }}>{sound.cat.toUpperCase()}</Text>
              </View>
              <TouchableOpacity onPress={handleClose} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#FFFFFF80', fontSize: 16, lineHeight: 20 }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Center pulsing orb */}
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Animated.View style={{
                width: 100, height: 100, borderRadius: 50,
                backgroundColor: sound.color + (isPlaying && !isPaused ? '28' : '10'),
                borderWidth: 1.5, borderColor: sound.color + (isPlaying && !isPaused ? '50' : '20'),
                alignItems: 'center', justifyContent: 'center',
                transform: [{ scale: pulseAnim }],
              }}>
                <Text style={{ fontSize: 46 }}>{sound.emoji}</Text>
              </Animated.View>
            </View>

            {/* Bottom controls */}
            <View style={{ paddingHorizontal: 28, paddingBottom: 8 }}>
              {/* Status */}
              {isPlaying && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 14 }}>
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: isPaused ? '#666' : sound.color }} />
                  <Text style={{ fontSize: 9, fontWeight: '900', color: isPaused ? '#FFFFFF45' : sound.color, letterSpacing: 1.6 }}>
                    {isPaused ? 'PAUSED' : 'NOW PLAYING'}
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: '200', color: sound.color + 'CC', marginLeft: 6 }}>
                    {fmtTimer(sessionSecs)}
                  </Text>
                </View>
              )}

              {/* Title */}
              <Text style={{ fontSize: 34, fontWeight: '200', color: '#fff', letterSpacing: -1.2, marginBottom: 5 }}>{sound.label}</Text>
              <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.50)', marginBottom: 28, letterSpacing: 0.1, lineHeight: 19 }}>{sound.desc}</Text>

              {/* Timer pills */}
              <Text style={{ fontSize: 8, fontWeight: '900', color: '#FFFFFF28', letterSpacing: 1.6, marginBottom: 10 }}>STOP AFTER</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 26, marginHorizontal: -4 }}>
                <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 4 }}>
                  {STOP_TIMES.map((t, i) => {
                    const active = stopIdx === i;
                    return (
                      <TouchableOpacity key={t.label} onPress={() => onChangeTimer(i)}
                        style={{ paddingHorizontal: 16, paddingVertical: 9, borderRadius: 99, borderWidth: 1, borderColor: active ? sound.color + '70' : '#FFFFFF15', backgroundColor: active ? sound.color + '18' : 'rgba(255,255,255,0.04)' }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: active ? sound.color : '#FFFFFF45' }}>{t.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              {/* Play / Pause / Stop */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                {isPlaying ? (
                  <>
                    <TouchableOpacity onPress={onToggle} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: sound.color + '22', borderWidth: 1.5, borderColor: sound.color + '55', borderRadius: 18, paddingVertical: 17 }}>
                      <Ionicons name={isPaused ? 'play' : 'pause'} size={22} color={sound.color} />
                      <Text style={{ fontSize: 15, fontWeight: '700', color: sound.color }}>{isPaused ? 'Resume' : 'Pause'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onStop} style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: '#FFFFFF12', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="stop" size={20} color="#FFFFFF45" />
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity onPress={onPlay} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: sound.color + '22', borderWidth: 1.5, borderColor: sound.color + '55', borderRadius: 18, paddingVertical: 17 }}>
                    <Ionicons name="play" size={22} color={sound.color} />
                    <Text style={{ fontSize: 15, fontWeight: '700', color: sound.color }}>Play</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </SafeAreaView>
        </ImageBackground>
      </Animated.View>
    </Modal>
  );
}

export default function SleepTab() {
  const insets = useSafeAreaInsets();
  const [now, setNow] = useState(new Date());

  // ── Global sound player (context) ──────────────────────────
  const { playingId, isPaused, sessionSecs, togglePause, stopSound, changeTimer, requestPlay, openFullPlayer } = useSoundPlayer();

  // ── Settings ───────────────────────────────────────────────
  const [wakeHour,      setWakeHour]      = useState(DEFAULT_ALARM_SETTINGS.wakeAlarm.hour);
  const [wakeMinute,    setWakeMinute]    = useState(DEFAULT_ALARM_SETTINGS.wakeAlarm.minute);
  const [bedtimeAlert,  setBedtimeAlert]  = useState(false);
  const [eveningMantra, setEveningMantra] = useState(false);

  // ── Sound UI state ─────────────────────────────────────────
  const [stopIdx,      setStopIdx]      = useState(0);
  const [category,     setCategory]     = useState<Category>('All');
  const pendingOpenRef = useRef<string | null>(null);

  // ── Auto-start ─────────────────────────────────────────────
  const [showAutoStart, setShowAutoStart] = useState(false);
  const [autoEnabled,   setAutoEnabled]   = useState(false);
  const [autoHour,      setAutoHour]      = useState(22);
  const [autoMinute,    setAutoMinute]    = useState(30);
  const [autoSoundId,   setAutoSoundId]   = useState<SoundId>('light_rain');

  // ── Live clock ──────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // ── Init ───────────────────────────────────────────────────
  useEffect(() => {
    store.getJSON<AlarmSettings>(KEYS.alarmSettings).then(s => {
      if (s?.wakeAlarm) { setWakeHour(s.wakeAlarm.hour); setWakeMinute(s.wakeAlarm.minute); }
      setEveningMantra(s?.eveningMantra ?? false);
    });
  }, []);

  // ── Play from sleep screen ──────────────────────────────────
  const handleSoundCardTap = useCallback((id: string) => {
    if (playingId === id) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      openFullPlayer();
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const meta = (SLEEP_SOUNDS as readonly any[]).find(s => s.id === id)
      ?? MANTRA_LIBRARY.flatMap(g => g.sounds).find(s => s.id === id);
    if (meta) {
      pendingOpenRef.current = id;
      requestPlay({ ...(meta as unknown as PlayableSoundMeta), imageUri: SOUND_IMAGES[id], imageBundled: SOUND_BUNDLED_IMAGES[id] ?? undefined }, STOP_TIMES[stopIdx].secs);
    }
  }, [playingId, openFullPlayer, requestPlay, stopIdx]);

  useEffect(() => {
    if (playingId && pendingOpenRef.current === playingId) {
      openFullPlayer();
      pendingOpenRef.current = null;
    }
  }, [playingId, openFullPlayer]);

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
      await notifee.createChannel({ id: 'arise-habit-alarms', name: 'SolRize Habit Alarms', importance: AndroidImportance.HIGH, bypassDnd: true, visibility: AndroidVisibility.PUBLIC } as any);
      const next = new Date(); next.setHours(autoHour, autoMinute, 0, 0);
      if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
      const meta = SLEEP_SOUNDS.find(s => s.id === autoSoundId)!;
      await notifee.createTriggerNotification(
        {
          id: 'sleep-autostart',
          title: `${meta.emoji}  Sleep Sounds`,
          body: `${meta.label} · Starting your sleep session now 🌙`,
          android: {
            channelId: 'arise-habit-alarms',
            importance: AndroidImportance.HIGH,
            category: AndroidCategory.ALARM,
            visibility: AndroidVisibility.PUBLIC,
            fullScreenAction: { id: 'default', launchActivity: 'default' },
            pressAction: { id: 'default', launchActivity: 'default' },
          } as any,
          data: { type: 'sleep-autostart', soundId: autoSoundId, label: meta.label },
        },
        { type: TriggerType.TIMESTAMP, timestamp: next.getTime(), repeatFrequency: RepeatFrequency.DAILY, alarmManager: { type: AlarmType.SET_EXACT_AND_ALLOW_WHILE_IDLE } } as any,
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
  const h           = now.getHours();
  const autoMode    = useMemo(() => getAutoMode(h), [h]);
  const recSounds   = useMemo(() => autoMode.recommended.map(id => SLEEP_SOUNDS.find(s => s.id === id)).filter(Boolean) as SoundItem[], [autoMode]);
  const featuredSnd = playingSrc ?? (recSounds[0] ?? SLEEP_SOUNDS[0]);
  const bottomPad   = insets.bottom + 80 + (playingId ? 72 : 0);
  const autoMeta    = SLEEP_SOUNDS.find(s => s.id === autoSoundId)!;

  return (
    <View style={S.screen}>
      {/* ── Header — time-aware ── */}
      <LinearGradient colors={autoMode.headerGrad} style={S.headerGrad}>
        <SafeAreaView edges={['top']}>
          <View style={S.headerTop}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <Text style={{ fontSize: 14 }}>{autoMode.icon}</Text>
              <Text style={S.appName}>{autoMode.label}</Text>
            </View>
            <View style={S.wakeChip}>
              <Ionicons name="alarm-outline" size={11} color={SLEEP_COLOR + '90'} />
              <Text style={S.wakeChipTxt}>{fmt12(wakeHour, wakeMinute)}</Text>
            </View>
          </View>
          <View style={{ paddingHorizontal: 20, paddingBottom: 18 }}>
            <Text style={S.greeting}>{autoMode.label}</Text>
            <Text style={S.greetingSub}>{autoMode.subtitle}</Text>
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
            modeLabel={autoMode.label}
            onPlay={() => handleSoundCardTap(featuredSnd.id)}
            onToggle={togglePause}
            onStop={handleStop}
            onOpen={() => handleSoundCardTap(featuredSnd.id)}
          />
        </View>

        {/* ── Recommended for now ── */}
        <View style={S.secHeader}>
          <Text style={S.secTitle}>{autoMode.icon}  Recommended Now</Text>
          <Text style={S.secCount}>{autoMode.key}</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
          {recSounds.map(s => (
            <TouchableOpacity key={s.id} onPress={() => handleSoundCardTap(s.id)} activeOpacity={0.82}
              style={{ width: 110, height: 130, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: playingId === s.id ? s.color + '80' : 'rgba(255,255,255,0.10)' }}>
              <ImageBackground source={{ uri: SOUND_IMAGES[s.id] }} style={{ flex: 1 }} imageStyle={{ borderRadius: 18 }}>
                <LinearGradient colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.72)']} style={[StyleSheet.absoluteFillObject, { borderRadius: 18 }]} />
                {playingId === s.id && <View style={[StyleSheet.absoluteFillObject, { borderRadius: 18, backgroundColor: s.color + '18' }]} />}
                <View style={{ flex: 1, justifyContent: 'flex-end', padding: 10 }}>
                  <Text style={{ fontSize: 18, marginBottom: 4 }}>{s.emoji}</Text>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: playingId === s.id ? s.color : '#FFFFFFDD' }} numberOfLines={2}>{s.label}</Text>
                  {playingId === s.id && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 }}>
                      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: isPaused ? '#888' : s.color }} />
                      <Text style={{ fontSize: 8, color: s.color, fontWeight: '700' }}>{isPaused ? 'Paused' : 'Playing'}</Text>
                    </View>
                  )}
                </View>
              </ImageBackground>
            </TouchableOpacity>
          ))}
        </ScrollView>

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

        {/* ── For Your Night (themed cards) — only outside sleep/night mode ── */}
        {autoMode.key !== 'sleep' && (
          <>
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
                      handleSoundCardTap(first.id);
                    }}
                  />
                ))}
              </View>
            </ScrollView>
          </>
        )}

        {/* ── Soundscapes ── */}
        <View style={S.secHeader}>
          <Text style={S.secTitle}>All Soundscapes</Text>
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
          </View>
        </ScrollView>

        {/* Sound grid with nature images */}
        <View style={S.grid}>
          {(filtered as readonly SoundItem[]).map(s => (
            <SoundCard
              key={s.id}
              sound={s}
              isPlaying={playingId === s.id}
              isPaused={isPaused && playingId === s.id}
              remaining={sessionSecs}
              onPress={() => handleSoundCardTap(s.id)}
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
                    onPress={() => handleSoundCardTap(s.id)}
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
  screen:     { flex: 1, backgroundColor: '#000000' },
  headerGrad: {},
  soundImgBg: { width: '100%', minHeight: 140 } as any,

  // ── Header ────────────────────────────────────────────────
  headerTop:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 6, paddingBottom: 10 },
  appName:      { fontSize: 15, fontWeight: '600', color: '#FFFFFF55', letterSpacing: 0.8, fontFamily: 'Nunito_600SemiBold' },
  wakeChip:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: SLEEP_COLOR + '14', borderWidth: 1, borderColor: SLEEP_COLOR + '30', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5 },
  wakeChipTxt:  { fontSize: 11, fontWeight: '800', color: SLEEP_COLOR + 'CC', fontFamily: 'Nunito_800ExtraBold' },
  greeting:     { fontSize: 30, fontWeight: '100', color: '#fff', letterSpacing: -1.0, marginBottom: 4 },
  greetingSub:  { fontSize: 12, color: '#FFFFFF50', letterSpacing: 0.1 },
  bedtimePill:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, backgroundColor: '#10b98110', borderWidth: 1, borderColor: '#10b98130', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 7, alignSelf: 'flex-start' },
  dot:          { width: 6, height: 6, borderRadius: 3 },

  // ── Section headers ────────────────────────────────────────
  secHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 26, paddingBottom: 12 },
  secTitle:  { fontSize: 16, fontWeight: '700', color: '#FFFFFFCC', letterSpacing: 0.4, fontFamily: 'Nunito_700Bold' },
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
  sleepBarDot:    { position: 'absolute', top: -5, width: 15, height: 15, borderRadius: 8, borderWidth: 2.5, borderColor: '#000000' },
  barLabel:       { fontSize: 9, color: '#FFFFFF25', fontWeight: '700', letterSpacing: 0.3 },

  // ── Featured Hero Card ─────────────────────────────────────
  featuredCard:  { borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: '#FFFFFF18', padding: 22, minHeight: 190, justifyContent: 'flex-end' },
  featOrb1:      { position: 'absolute', top: -40, right: -30, width: 180, height: 180, borderRadius: 90 },
  featOrb2:      { position: 'absolute', bottom: -20, left: -10, width: 110, height: 110, borderRadius: 55 },
  featTopRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  featLiveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5 },
  featLiveDot:   { width: 6, height: 6, borderRadius: 3 },
  featLiveLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1.2, fontFamily: 'Nunito_900Black' },
  featTimer:     { fontSize: 18, fontWeight: '200', letterSpacing: -0.5 },
  featTitle:     { fontSize: 20, fontWeight: '200', color: '#fff', letterSpacing: -0.5, marginBottom: 5 },
  featDesc:      { fontSize: 12, color: '#FFFFFF45', marginBottom: 18, letterSpacing: 0.1 },
  featControls:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featPauseBtn:  { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 12 },
  featPlayBtn:   { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 12, alignSelf: 'flex-start' },
  featPauseTxt:  { fontSize: 13, fontWeight: '700', fontFamily: 'Nunito_700Bold' },
  featStopBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 12 },
  featStopTxt:   { fontSize: 12, color: '#FFFFFF35', fontWeight: '600' },

  // ── Night Theme Cards ─────────────────────────────────────
  themeCard:     { width: THEME_CARD_W, height: 170, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#FFFFFF0A', justifyContent: 'flex-end' },
  themeOrb1:     { position: 'absolute', top: -30, right: -20, width: 110, height: 110, borderRadius: 55, opacity: 0.7 },
  themeOrb2:     { position: 'absolute', bottom: 10, left: -15, width: 70, height: 70, borderRadius: 35, opacity: 0.5 },
  themeContent:  { padding: 14, gap: 4 },
  themeSubtitle: { fontSize: 8, fontWeight: '900', letterSpacing: 1.5, fontFamily: 'Nunito_900Black' },
  themeTitle:    { fontSize: 13, fontWeight: '300', color: '#fff', letterSpacing: -0.3 },
  themeTagRow:   { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start', marginTop: 2 },
  themeTagDot:   { width: 4, height: 4, borderRadius: 2 },
  themeTagTxt:   { fontSize: 9, fontWeight: '700' },
  themeArrow:    { position: 'absolute', top: 12, right: 12, width: 26, height: 26, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  // ── Sound grid ────────────────────────────────────────────
  grid:          { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 12, marginBottom: 4 },
  soundCard:     { borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#FFFFFF08' },
  soundGrad:     { padding: 11, minHeight: 140, justifyContent: 'space-between', position: 'relative', overflow: 'hidden' },
  soundOrb:      { position: 'absolute', top: -20, right: -20, width: 90, height: 90, borderRadius: 45 },
  soundTopRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  soundPlayBtn:  { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  soundEmojiAccent: { fontSize: 14, opacity: 0.7 },
  cardName:      { fontSize: 11, fontWeight: '800', color: '#fff', marginTop: 8, fontFamily: 'Nunito_800ExtraBold' },
  cardDesc:      { fontSize: 9, color: '#FFFFFF35', marginBottom: 4, marginTop: 2 },
  badge:         { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 99, borderColor: '#FFFFFF12', backgroundColor: '#FFFFFF06', paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  badgeTxt:      { fontSize: 9, fontWeight: '800', color: '#FFFFFF40', fontFamily: 'Nunito_800ExtraBold' },
  liveDot:       { width: 5, height: 5, borderRadius: 3 },

  // ── Chips (category + timer) ──────────────────────────────
  chip:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99, borderWidth: 1, borderColor: '#FFFFFF12', backgroundColor: '#FFFFFF05' },
  chipTxt:     { fontSize: 12, fontWeight: '700', fontFamily: 'Nunito_700Bold' },
  chipDivider: { width: 1, height: 22, backgroundColor: '#FFFFFF10', marginHorizontal: 4, alignSelf: 'center' },

  // ── Night Settings grouped card ────────────────────────────
  groupCard:     { marginHorizontal: 16, borderRadius: 22, borderWidth: 1, borderColor: '#FFFFFF12', backgroundColor: '#111111', overflow: 'hidden' },
  groupRow:      { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 16 },
  groupIcon:     { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  groupRowTitle: { fontSize: 13, fontWeight: '700', color: '#FFFFFFDD', fontFamily: 'Nunito_700Bold' },
  groupRowSub:   { fontSize: 11, color: '#FFFFFF38', marginTop: 2 },
  groupDivider:  { height: 1, backgroundColor: '#FFFFFF0C', marginLeft: 70 },

  // ── Sleep Cycle chips ─────────────────────────────────────
  cycleChip:        { width: 112, borderRadius: 16, borderWidth: 1, padding: 12, gap: 2 },
  cycleChipBadge:   { alignSelf: 'flex-start', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 4 },
  cycleChipTime:    { fontSize: 17, fontWeight: '700', letterSpacing: -0.5, fontFamily: 'Nunito_700Bold' },
  cycleChipHours:   { fontSize: 11, fontWeight: '800', color: '#FFFFFFCC', fontFamily: 'Nunito_800ExtraBold' },
  cycleChipQuality: { fontSize: 9, fontWeight: '700', fontFamily: 'Nunito_700Bold' },
  cycleChipCycles:  { fontSize: 10, color: '#FFFFFF35', fontWeight: '600', fontFamily: 'Nunito_600SemiBold' },

  // ── Sleep Science ─────────────────────────────────────────
  tipCard:    { marginHorizontal: 16, marginBottom: 8, borderRadius: 18, borderWidth: 1, borderColor: '#FFFFFF0C', backgroundColor: '#FFFFFF05', flexDirection: 'row', alignItems: 'flex-start', gap: 14, padding: 16 },
  tipIconBox: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#FFFFFF0A', alignItems: 'center', justifyContent: 'center' },
  tipTitle:   { fontSize: 12, fontWeight: '700', color: '#FFFFFFDD', fontFamily: 'Nunito_700Bold' },
  tipSub:     { fontSize: 10, color: '#FFFFFF40', marginTop: 2, lineHeight: 15 },
  scienceNote:    { marginHorizontal: 16, marginTop: 4, marginBottom: 8, backgroundColor: SLEEP_COLOR + '08', borderWidth: 1, borderColor: SLEEP_COLOR + '15', borderRadius: 16, padding: 16 },
  scienceNoteTxt: { fontSize: 11, color: SLEEP_COLOR + '99', lineHeight: 18 },

  // ── Auto-start modal ──────────────────────────────────────
  overlay:      { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.72)' },
  sheet:        { backgroundColor: '#111111', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12, paddingBottom: 40 },
  sheetHandle:  { width: 36, height: 4, borderRadius: 2, backgroundColor: '#FFFFFF20', alignSelf: 'center', marginBottom: 16 },
  sheetTitle:   { fontSize: 17, fontWeight: '900', color: '#fff', textAlign: 'center', marginBottom: 4, fontFamily: 'Nunito_900Black' },
  modalLabel:   { fontSize: 8, fontWeight: '900', color: '#FFFFFF28', letterSpacing: 1.6, marginHorizontal: 16, marginBottom: 8, marginTop: 8, fontFamily: 'Nunito_900Black' },
  timeBig:      { alignItems: 'center', marginBottom: 20 },
  timeBigTxt:   { fontSize: 46, fontWeight: '100', color: SLEEP_COLOR, letterSpacing: -2 },
  timeChip:     { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#FFFFFF10', backgroundColor: '#FFFFFF04', minWidth: 44, alignItems: 'center' },
  timeChipTxt:  { fontSize: 13, fontWeight: '700', fontFamily: 'Nunito_700Bold' },
  soundPickChip:{ width: 70, paddingVertical: 10, alignItems: 'center', borderRadius: 14, borderWidth: 1, borderColor: '#FFFFFF10', backgroundColor: '#FFFFFF04' },
  confirmBtn:   { marginHorizontal: 20, borderRadius: 16, paddingVertical: 15, alignItems: 'center', borderWidth: 1 },
  confirmTxt:   { fontSize: 14, fontWeight: '900', letterSpacing: 0.5, fontFamily: 'Nunito_900Black' },
});

