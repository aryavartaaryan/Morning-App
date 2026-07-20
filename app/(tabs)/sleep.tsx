import React, { useState, useEffect, useRef, useCallback, useMemo, memo, startTransition } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Pressable,
  Modal, Animated, Easing, Dimensions, ImageBackground, LayoutAnimation, Image, FlatList, Platform, PanResponder,
  ActivityIndicator, StatusBar, TextInput, Keyboard, BackHandler,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ScrollView as GHScrollView, FlingGestureHandler, Directions, State } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Path, Defs, ClipPath as SvgClipPath, Circle as SvgCircle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import notifee, { AndroidImportance, AndroidCategory, AndroidVisibility, TriggerType, RepeatFrequency, AlarmType } from '@notifee/react-native';
import { store, KEYS } from '@/lib/storage';
import { AlarmSettings, DEFAULT_ALARM_SETTINGS } from '@/lib/notifications';
import { getSolarTimes, SolarTimes } from '@/lib/solar';
import { getCurrentPeriod, getHeroRingContent } from '@/lib/ayurvedicPeriods';
import { getSacredHourInfo } from '@/lib/solarRingPalette';
import { useBgContext } from '@/lib/bgContext';
import { Colors, Font } from '@/constants/theme';
import { useSoundPlayer, PlayableSoundMeta, getCachedDuration } from '@/lib/soundPlayerContext';
import { SOUND_IMAGES as SOUND_IMAGES_LIB, ALL_SLEEP_SOUNDS } from '@/lib/sleepSoundsData';
import { getLocalSoundImageUri, isSoundImageCached, isWarmDone, warmSoundImageMap, prefetchAllSoundImages, ensureSoundImageCached, subscribeToWarm, subscribeToImageCached } from '@/lib/soundImagePreload';
import { initAudioCache } from '@/lib/soundAudioCache';
import { useFocusEffect } from 'expo-router';
import { getTabBarClearance } from '@/lib/tabBarSpacing';
import SoundLibraryModal from '@/components/SoundLibraryModal';
import { ScreenErrorBoundary } from '@/components/ScreenErrorBoundary';
import { MarqueeText } from '@/components/MarqueeText';

const { width: W, height: H } = Dimensions.get('screen');
let _pageScrollRef: any = null;
let _pageScrollLocked = false;
const _lockPageScroll   = () => { if (!_pageScrollLocked) { _pageScrollLocked = true;  _pageScrollRef?.setNativeProps({ scrollEnabled: false }); } };
const _unlockPageScroll = () => { if (_pageScrollLocked)  { _pageScrollLocked = false; _pageScrollRef?.setNativeProps({ scrollEnabled: true });  } };
const SLEEP_COLOR = '#007AFF';
const CARD_W        = (W - 48) / 2;
const CARD_H        = Math.round(CARD_W * 1.35);
const ROW_CARD_W    = Math.round((W - 28) / 1.5);    // 1 full + ~50% peek of second card
const ROW_CARD_H    = ROW_CARD_W;                     // perfect square — Calm style
const GRID_CARD_W   = Math.floor((W - 44) / 2);       // 2-column grid: (W - 32pad - 12gap) / 2
const GRID_CARD_H   = GRID_CARD_W;                    // perfect square
const SQUARE_CARD_W = ROW_CARD_W;
const CALM_CARD_W   = Math.round((W - 34) / 1.5 * 0.84);  // Category rows — slightly compact
const REC_CARD_W    = Math.round((W - 34) / 1.5);           // Recommended — exact 1 card + 50% peek
const THEME_CARD_W  = Math.round(W * 0.50);           // editorial theme cards
const THEME_CARD_H  = THEME_CARD_W;                   // square — matches CalmSoundCard
const HERO_H        = Math.round(H * 0.25);           // hero card — 30% reduced height
const pad = (n: number) => String(n).padStart(2, '0');
const fmt12 = (h: number, m: number) => { const ap = h < 12 ? 'AM' : 'PM'; const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h; return `${pad(h12)}:${pad(m)} ${ap}`; };
const fmtTimer = (s: number) => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;

// ─── Sound library ──────────────────────────────────────────────────────────
const SLEEP_SOUNDS = [
  { id: 'light_rain',    label: 'Light Rain',      emoji: '🌦️', cat: 'Nature',    color: '#60a5fa', top: '#0D2440' as const, bot: '#050F1E' as const, desc: 'Soft pitter-patter on leaves',   src: require('../../assets/sounds/mixkit-light-rain-loop-2393.m4a') },
  { id: 'heavy_rain',    label: 'Heavy Rain',      emoji: '🌧️', cat: 'Nature',    color: '#3b82f6', top: '#0A1A30' as const, bot: '#040A15' as const, desc: 'Deep rhythmic downpour',          src: require('../../assets/sounds/mixkit-heavy-rain-drops-2399.m4a') },
  { id: 'rain_thunder',  label: 'Rain & Thunder',  emoji: '⛈️', cat: 'Nature',    color: '#818cf8', top: '#18103A' as const, bot: '#0C0820' as const, desc: 'Storm rumbling in the distance',  src: require('../../assets/sounds/mixkit-rain-and-thunder-storm-2390.m4a') },
  { id: 'jungle_rain',   label: 'Jungle Rain',     emoji: '🦜', cat: 'Nature',    color: '#34d399', top: '#0A2418' as const, bot: '#05100A' as const, desc: 'Rain with tropical birds',        src: require('../../assets/sounds/mixkit-jungle-rain-and-birds-2392.m4a') },
  { id: 'jungle_storm',  label: 'Jungle Storm',    emoji: '🌿', cat: 'Nature',    color: '#6ee7b7', top: '#0A201A' as const, bot: '#050F0D' as const, desc: 'Calm forest thunderstorm',        src: require('../../assets/sounds/mixkit-calm-thunderstorm-in-the-jungle-2415.m4a') },
  { id: 'sea_waves',     label: 'Sea Waves',       emoji: '🌊', cat: 'Nature',   color: '#38bdf8', top: '#0A2030' as const, bot: '#04101A' as const, desc: 'Gentle coastal waves',            src: require('../../assets/sounds/mixkit-close-sea-waves-loop-1195.m4a') },
  { id: 'rocky_shore',   label: 'Rocky Shore',     emoji: '🪨', cat: 'Nature',   color: '#7dd3fc', top: '#0C1E2F' as const, bot: '#060F18' as const, desc: 'Waves crashing on rocks',         src: require('../../assets/sounds/mixkit-sea-waves-on-a-rocky-shore-1190.m4a') },
  { id: 'harbor_waves',  label: 'Harbor Waves',    emoji: '⚓', cat: 'Nature',   color: '#93c5fd', top: '#0A1828' as const, bot: '#050C15' as const, desc: 'Still harbor at night',           src: require('../../assets/sounds/mixkit-small-waves-harbor-rocks-1208.m4a') },
  { id: 'flowing_water', label: 'Flowing Water',   emoji: '💧', cat: 'Nature',   color: '#67e8f9', top: '#0A1E28' as const, bot: '#050F14' as const, desc: 'Stream flowing over stones',      src: require('../../assets/sounds/mixkit-water-flowing-ambience-loop-3126.m4a') },
  { id: 'forest_breeze', label: 'Forest Breeze',   emoji: '🌳', cat: 'Nature',  color: '#86efac', top: '#0A1E10' as const, bot: '#050F08' as const, desc: 'Wind through the canopy',         src: require('../../assets/sounds/mixkit-breeze-through-the-trees-2427.m4a') },
  { id: 'night_forest',  label: 'Night Forest',    emoji: '🦗', cat: 'Nature',  color: '#4ade80', top: '#0A1E0E' as const, bot: '#050F07' as const, desc: 'Crickets at midnight',             src: require('../../assets/sounds/mixkit-night-forest-with-insects-2414.m4a') },
  { id: 'gentle_wind',   label: 'Gentle Wind',     emoji: '🌬️', cat: 'Nature',  color: '#a3e635', top: '#141808' as const, bot: '#0A0F05' as const, desc: 'Open meadow breeze',              src: require('../../assets/sounds/mixkit-wind-blowing-ambience-2658.m4a') },
  { id: 'city_night',      label: 'City Park Night',  emoji: '🏙️', cat: 'Nature', color: '#fbbf24', top: '#201808' as const, bot: '#100D05' as const, desc: 'Distant city hum',                   src: require('../../assets/sounds/mixkit-urban-ambience-during-the-day-2505.m4a') },
  { id: 'campfire',        label: 'Forest Campfire',  emoji: '🔥', cat: 'Nature',  color: '#f97316', top: '#1A0A00' as const, bot: '#0A0500' as const, desc: 'Crackling fire in the woods',         src: require('../../assets/sounds/forest-campfire.m4a') },
  { id: 'morning_birds',   label: 'Morning Birds',    emoji: '🐦', cat: 'Birds',  color: '#fde68a', top: '#1A1400' as const, bot: '#0A0A00' as const, desc: 'Dawn chorus at sunrise',              src: require('../../assets/sounds/morning-birds-loop.m4a') },
  { id: 'spring_birds',    label: 'Spring Birds',     emoji: '🌸', cat: 'Birds',  color: '#f9a8d4', top: '#1A0A12' as const, bot: '#0A050A' as const, desc: 'Birds of a blooming spring day',      src: require('../../assets/sounds/spring-birds-morning.m4a') },
  { id: 'wanderlust',      label: 'Wanderlust Breeze',emoji: '🌬️', cat: 'Nature',  color: '#bae6fd', top: '#0A1620' as const, bot: '#050B10' as const, desc: 'Open skies and wandering wind',       src: require('../../assets/sounds/mixkit-wind-blowing-ambience-2658.m4a') },
  { id: 'forest_birds',    label: 'Forest Birds',     emoji: '🌳', cat: 'Birds',  color: '#86efac', top: '#081808' as const, bot: '#040C04' as const, desc: 'Birds singing deep in the forest',    src: require('../../assets/sounds/forest-birds-spring.m4a') },
  { id: 'hz_432',          label: '432 Hz Bells',     emoji: '🔔', cat: 'Meditations',  color: '#c084fc', top: '#14082A' as const, bot: '#0A0516' as const, desc: 'Healing frequency, calm the mind',    src: require('../../assets/sounds/432hz-healing-bells.m4a') },
  { id: 'singing_bowl',    label: 'Deep Singing Bowl',emoji: '🔮', cat: 'Meditations',  color: '#a78bfa', top: '#10082A' as const, bot: '#080515' as const, desc: 'Deep resonance for meditation',       src: { uri: 'https://audio.onesutralabs.com/sounds-large/singing-bowl-deep.m4a' } },
  { id: 'tibetan_bowl',    label: 'Tibetan Bowl',     emoji: '🫙', cat: 'Meditations',  color: '#818cf8', top: '#0C0822' as const, bot: '#060411' as const, desc: 'Ancient healing bowl tones',          src: require('../../assets/sounds/tibetan-bowl.m4a') },
  { id: 'morning_flute',   label: 'Light Meditation Tone', emoji: '🎶', cat: 'Meditations',  color: '#6ee7b7', top: '#082018' as const, bot: '#04100C' as const, desc: 'Gentle tones for a peaceful dawn',       src: require('../../assets/sounds/morning-flute.m4a') },
  { id: 'sitar',           label: 'Calm Raga',        emoji: '🎸', cat: 'Meditations',  color: '#fcd34d', top: '#1A1200' as const, bot: '#0A0900' as const, desc: 'Classical raga to ease the mind',     src: require('../../assets/sounds/sitar-morning.m4a') },
  { id: 'indian_beats',    label: 'Indian Beats',     emoji: '🥁', cat: 'Meditations',  color: '#fb923c', top: '#1A0A00' as const, bot: '#0A0500' as const, desc: 'Rhythmic tabla & percussion',         src: require('../../assets/sounds/indian-beats.m4a') },
  // ── Sacred additions ────────────────────────────────────────────────────────
  { id: 'tibetan_dreams',     label: 'Tibetan Dreams',        emoji: '🧘', cat: 'Meditations' as const, color: '#818cf8', top: '#0C0822' as const, bot: '#060411' as const, desc: 'Deep Himalayan soundscape',              src: require('../../assets/sounds/tibetan-dreams.m4a') },
  { id: 'reincarnation_tones',label: 'Reincarnation Tones',   emoji: '♾️', cat: 'Meditations' as const, color: '#a78bfa', top: '#100830' as const, bot: '#080418' as const, desc: 'Timeless tones of past lives',           src: require('../../assets/sounds/reincarnation-tones.m4a') },
  { id: 'spiritual_journey',  label: 'Spiritual Journey',     emoji: '🌌', cat: 'Meditations' as const, color: '#c084fc', top: '#140A28' as const, bot: '#0A0518' as const, desc: 'A journey through sacred realms',        src: { uri: 'https://audio.onesutralabs.com/sounds-large/spiritual-journey.m4a' } },
  // ── Nature addition ─────────────────────────────────────────────────────────
  { id: 'night_jungle_chiangmai', label: 'Night Jungle',      emoji: '🦟', cat: 'Nature'  as const, color: '#4ade80', top: '#061A08' as const, bot: '#030C04' as const, desc: 'Wild night in Chiangmai jungle',         src: { uri: 'https://audio.onesutralabs.com/sounds-large/night-jungle-chiangmai.m4a' } },
  // ── Sitar ───────────────────────────────────────────────────────────────────
  { id: 'sitar_long',          label: 'Sitar Meditation',     emoji: '🎸', cat: 'Ragas'   as const, color: '#f59e0b', top: '#1A1000' as const, bot: '#0A0800' as const, desc: 'Long classical raga session',            src: require('../../assets/sounds/sitar-long.m4a') },

  { id: 'indian_sitar_raga',   label: 'Indian Sitar Raga',    emoji: '🎶', cat: 'Ragas'   as const, color: '#fb923c', top: '#1A0E00' as const, bot: '#0A0700' as const, desc: 'Classical Indian raga melody',           src: require('../../assets/sounds/indian-sitar-raga.m4a') },
  { id: 'sitar_summer_raga',   label: '432Hz Healing Raga',  emoji: '☀️', cat: 'Ragas'   as const, color: '#fde68a', top: '#1A1600' as const, bot: '#0A0B00' as const, desc: 'Mango season raga at 432 Hz',            src: { uri: 'https://audio.onesutralabs.com/sounds-large/sitar-summer-raga.m4a' } },
  { id: 'sitar_radiance',      label: 'Sitar Radiance for Focus & Relaxation', emoji: '✨', cat: 'Ragas'   as const, color: '#f97316', top: '#1A0800' as const, bot: '#0A0400' as const, desc: 'Radiant Indian classical sitar',         src: { uri: 'https://audio.onesutralabs.com/sounds-large/sitar-radiance.m4a' } },
  { id: 'sitar_radiance_med',  label: 'Sitar Radiance for Focus & Relaxation', emoji: '✨', cat: 'Meditations' as const, color: '#f97316', top: '#1A0800' as const, bot: '#0A0400' as const, desc: 'Radiant Indian classical sitar',         src: { uri: 'https://audio.onesutralabs.com/sounds-large/sitar-radiance.m4a' } },
  { id: 'sitar_radiance_sleep',label: 'Sitar Radiance for Focus & Relaxation', emoji: '✨', cat: 'Sleep'       as const, color: '#f97316', top: '#1A0800' as const, bot: '#0A0400' as const, desc: 'Radiant Indian classical sitar',         src: { uri: 'https://audio.onesutralabs.com/sounds-large/sitar-radiance.m4a' } },
  { id: 'sitar_tanpura_sarangi',label: 'Sitar, Tanpura & Sarangi', emoji: '🪕', cat: 'Ragas' as const, color: '#f59e0b', top: '#1A1000' as const, bot: '#0A0800' as const, desc: 'Full classical Indian ensemble',         src: require('../../assets/sounds/sitar-tanpura-sarangi.m4a') },
  { id: 'sitar_tanpura_bgm',   label: 'Sitar & Tanpura',      emoji: '🎼', cat: 'Ragas'   as const, color: '#fbbf24', top: '#1A1200' as const, bot: '#0A0900' as const, desc: 'Indian classical background melody',     src: require('../../assets/sounds/sitar-tanpura.m4a') },
  { id: 'veena_classical',     label: 'Classical Veena',      emoji: '🪗', cat: 'Ragas'   as const, color: '#fcd34d', top: '#1A1A00' as const, bot: '#0A0A00' as const, desc: "Saraswati's divine string instrument",  src: { uri: 'https://audio.onesutralabs.com/sounds-large/veena-classical.m4a' } },
  // ── Flute ───────────────────────────────────────────────────────────────────
  { id: 'andean_flute',        label: 'Andean Flute',         emoji: '🏔️', cat: 'Ragas'   as const, color: '#6ee7b7', top: '#081A10' as const, bot: '#040C08' as const, desc: 'High-altitude Andean melody',           src: require('../../assets/sounds/andean-flute.m4a') },

  { id: 'native_flute',        label: 'Native American Flute',emoji: '🪶', cat: 'Ragas'   as const, color: '#a3e635', top: '#121400' as const, bot: '#090A00' as const, desc: 'Traditional wood flute from the plains', src: require('../../assets/sounds/native-flute.m4a') },
  { id: 'native_flute_echo',   label: 'Native Flute Echo',    emoji: '🌀', cat: 'Ragas'   as const, color: '#86efac', top: '#0A1A10' as const, bot: '#050D08' as const, desc: 'Looping flute with forest echo',         src: require('../../assets/sounds/native-flute-echo.m4a') },
  { id: 'bamboo_flute',        label: 'Bamboo Flute',         emoji: '🎋', cat: 'Ragas'   as const, color: '#34d399', top: '#081A0C' as const, bot: '#040C06' as const, desc: 'Amazon bamboo flute groove',             src: require('../../assets/sounds/bamboo-flute.m4a') },
  { id: 'flute_scale',         label: 'Flute Meditation',     emoji: '🎶', cat: 'Ragas'   as const, color: '#6ee7b7', top: '#081810' as const, bot: '#040C08' as const, desc: 'Gentle flute scale for calm mind',       src: require('../../assets/sounds/flute-scale.m4a') },
  // ── Tabla ───────────────────────────────────────────────────────────────────

  // ── Birds ───────────────────────────────────────────────────────────────────
  { id: 'eagle_feather',       label: 'Eagle Call',           emoji: '🦅', cat: 'Birds'   as const, color: '#78716c', top: '#1A1408' as const, bot: '#0A0A04' as const, desc: 'Majestic eagle soaring above',           src: require('../../assets/sounds/eagle-feather.m4a') },
  { id: 'cuckoo_forest',       label: 'Cuckoo Forest',        emoji: '🌳', cat: 'Birds'   as const, color: '#4ade80', top: '#081A08' as const, bot: '#040C04' as const, desc: 'Cuckoo calling deep in the forest',      src: require('../../assets/sounds/cuckoo-forest.m4a') },
  { id: 'peacock_wild',        label: 'Wild Peacock',         emoji: '🦚', cat: 'Birds'   as const, color: '#34d399', top: '#081808' as const, bot: '#040C04' as const, desc: 'Peacock calling at dawn',                src: require('../../assets/sounds/peacock-wild.m4a') },
  { id: 'cuckoo_chime',        label: 'Cuckoo Chime',         emoji: '🔔', cat: 'Birds'   as const, color: '#a3e635', top: '#101400' as const, bot: '#080A00' as const, desc: 'Clock chimes with cuckoo bell',          src: require('../../assets/sounds/cuckoo-chime.m4a') },
  { id: 'india_countryside_birds', label: 'Sparrows Group',    emoji: '🌾', cat: 'Birds'  as const, color: '#fde68a', top: '#1A1600' as const, bot: '#0A0B00' as const, desc: 'Birdsong from north Indian fields',      src: require('../../assets/sounds/india-countryside-birds.m4a') },
  { id: 'cuckoo_birds_forest', label: 'Cuckoo & Forest Birds',emoji: '🌲', cat: 'Birds'   as const, color: '#86efac', top: '#081A08' as const, bot: '#040C04' as const, desc: 'Mixed forest birds with cuckoo',         src: require('../../assets/sounds/cuckoo-birds-forest.m4a') },
  { id: 'peacock_call',        label: 'Peacock Call',         emoji: '🦚', cat: 'Birds'   as const, color: '#4ade80', top: '#081808' as const, bot: '#040C04' as const, desc: 'Clear peacock call in silence',          src: require('../../assets/sounds/peacock.m4a') },
  { id: 'koel_bird',           label: 'Koel Bird Song',       emoji: '🎵', cat: 'Birds'   as const, color: '#34d399', top: '#081808' as const, bot: '#040C04' as const, desc: 'Indian cuckoo koel singing at dawn',     src: require('../../assets/sounds/koel-bird.m4a') },
  // ── Tanpura ─────────────────────────────────────────────────────────────────
  { id: 'tanpura_sacred_432hz', label: 'Sacred Tanpura 432Hz', emoji: '🕉️', cat: 'Ragas'   as const, color: '#c084fc', top: '#14082A' as const, bot: '#0A0516' as const, desc: 'Gilded tanpura drone at 432 Hz',        src: { uri: 'https://audio.onesutralabs.com/sounds-large/tanpura-sacred-432hz.m4a' } },
  { id: 'tanpura_breath',      label: 'Tanpura Breath',        emoji: '🌬️', cat: 'Ragas'   as const, color: '#a78bfa', top: '#100830' as const, bot: '#080418' as const, desc: 'Soft tanpura drone for meditation',      src: { uri: 'https://audio.onesutralabs.com/sounds-large/tanpura-breath.m4a' } },
  { id: 'tanpura_loop',        label: 'Tanpura Loop',          emoji: '🔁', cat: 'Ragas'   as const, color: '#818cf8', top: '#0C0822' as const, bot: '#060411' as const, desc: 'Continuous looping tanpura music',       src: { uri: 'https://audio.onesutralabs.com/sounds-large/tanpura-loop.m4a' } },
  { id: 'raga_tanpura_drone',  label: 'Raga Tanpura Drone',    emoji: '🌌', cat: 'Ragas'   as const, color: '#6366f1', top: '#0A0820' as const, bot: '#050410' as const, desc: 'Deep space tanpura drone for raga',      src: { uri: 'https://audio.onesutralabs.com/sounds-large/raga-tanpura-drone.m4a' } },
  // ── World (merged into Ragas) ───────────────────────────────────────────────
  { id: 'sargija_eastern',     label: 'Eastern Sargija',       emoji: '🌏', cat: 'Ragas'   as const, color: '#f97316', top: '#1A0A00' as const, bot: '#0A0500' as const, desc: 'Traditional Eastern string improvisation', src: { uri: 'https://audio.onesutralabs.com/sounds-large/sargija-eastern.m4a' } },
  { id: 'tagore_festival',     label: 'Tagore Festival',       emoji: '🎊', cat: 'Ragas'   as const, color: '#fbbf24', top: '#1A1200' as const, bot: '#0A0900' as const, desc: 'Joyful Tagore festival music',           src: { uri: 'https://audio.onesutralabs.com/sounds-large/tagore-festival.m4a' } },
  { id: 'world_ambient',       label: 'World Ambient',         emoji: '🌍', cat: 'Ragas'   as const, color: '#a78bfa', top: '#100830' as const, bot: '#080418' as const, desc: 'Global ambient soundscape',              src: { uri: 'https://audio.onesutralabs.com/sounds-large/world-ambient.m4a' } },
  { id: 'heaven_tune',         label: 'Heaven Tune',           emoji: '✨',  cat: 'Ragas'   as const, color: '#fde68a', top: '#1A1600' as const, bot: '#0A0B00' as const, desc: 'Traditional heavenly melody',            src: { uri: 'https://audio.onesutralabs.com/sounds-large/heaven-tune.m4a' } },
  // ── Sitar additions ────────────────────────────────────────────────────────
  { id: 'sitar_calm',          label: 'Calm Sitar',            emoji: '🎸',  cat: 'Ragas'   as const, color: '#fcd34d', top: '#1A1200' as const, bot: '#0A0900' as const, desc: 'Soft sitar for deep relaxation',         src: require('../../assets/sounds/sitar-calm.m4a') },
  { id: 'veena_raga',          label: 'Veena Raga Kanaad',     emoji: '🪗',  cat: 'Ragas'   as const, color: '#f59e0b', top: '#1A1000' as const, bot: '#0A0800' as const, desc: 'Raga Kanaad on veena with mridangam',   src: require('../../assets/sounds/veena-raga.m4a') },
  // ── Flute additions ────────────────────────────────────────────────────────
  { id: 'bansuri_forest',      label: 'Bansuri Forest',        emoji: '🌿',  cat: 'Ragas'   as const, color: '#34d399', top: '#081A0C' as const, bot: '#040C06' as const, desc: 'Bansuri flute echoing through a forest', src: { uri: 'https://audio.onesutralabs.com/sounds-large/bansuri-forest.m4a' } },
  { id: 'bansuri_melody',      label: 'Bansuri Melody',        emoji: '🎵',  cat: 'Ragas'   as const, color: '#6ee7b7', top: '#081810' as const, bot: '#040C08' as const, desc: 'Serene Indian bansuri flute melody',     src: require('../../assets/sounds/bansuri-melody.m4a') },
  { id: 'bansuri_melody_sleep',label: 'Bansuri Melody',        emoji: '🎵',  cat: 'Sleep'   as const, color: '#6ee7b7', top: '#081810' as const, bot: '#040C08' as const, desc: 'Serene Indian bansuri flute melody',     src: require('../../assets/sounds/bansuri-melody.m4a') },
  { id: 'bansuri_tarana',      label: 'Bansuri Tarana',        emoji: '🎶',  cat: 'Ragas'   as const, color: '#86efac', top: '#0A1A10' as const, bot: '#050D08' as const, desc: 'Classical tarana raga on bansuri',       src: { uri: 'https://audio.onesutralabs.com/sounds-large/bansuri-tarana.m4a' } },
  { id: 'bansuri_tarana_sleep',      label: 'Bansuri Tarana',        emoji: '🎶',  cat: 'Sleep'   as const, color: '#86efac', top: '#0A1A10' as const, bot: '#050D08' as const, desc: 'Classical tarana raga on bansuri',       src: { uri: 'https://audio.onesutralabs.com/sounds-large/bansuri-tarana.m4a' } },
  // ── Tanpura additions ──────────────────────────────────────────────────────
  { id: 'tanpura_mystic',      label: 'Mystic Tanpura',        emoji: '🌌',  cat: 'Ragas'   as const, color: '#818cf8', top: '#0C0830' as const, bot: '#060418' as const, desc: 'Ethereal mystic tanpura waves',          src: require('../../assets/sounds/tanpura-mystic.m4a') },
  { id: 'tanpura_mystic_sleep',      label: 'Mystic Tanpura',        emoji: '🌌',  cat: 'Sleep'   as const, color: '#818cf8', top: '#0C0830' as const, bot: '#060418' as const, desc: 'Ethereal mystic tanpura waves',          src: require('../../assets/sounds/tanpura-mystic.m4a') },
  { id: 'tanpura_mystic_meditation', label: 'Mystic Tanpura',        emoji: '🌌',  cat: 'Meditations' as const, color: '#818cf8', top: '#0C0830' as const, bot: '#060418' as const, desc: 'Ethereal mystic tanpura waves',          src: require('../../assets/sounds/tanpura-mystic.m4a') },
  { id: 'tanpura_serene',      label: 'Serene Tanpura',        emoji: '🧘',  cat: 'Ragas'   as const, color: '#a78bfa', top: '#100828' as const, bot: '#080414' as const, desc: 'Calm serene tanpura meditation',         src: { uri: 'https://audio.onesutralabs.com/sounds-large/tanpura-serene.m4a' } },
  // ── Sacred mantra addition ─────────────────────────────────────────────────
  { id: 'om_shanti',           label: 'Om Shanti',             emoji: '🕉️',  cat: 'Meditations' as const, color: '#c084fc', top: '#140A28' as const, bot: '#0A0516' as const, desc: 'Vedic peace chant — Om Shanti Shanti Shanti', src: require('../../assets/sounds/om-shanti.m4a') },
] as const;

type SoundId = typeof SLEEP_SOUNDS[number]['id'];
type SoundItem = typeof SLEEP_SOUNDS[number];
const SLEEP_HIDDEN_IDS = new Set([
  'flute_scale',
]);
const CATEGORIES = ['All', 'Nature', 'Ragas', 'Sleep', 'Meditations', 'Birds'] as const;
type Category = typeof CATEGORIES[number];
// Categories shown in the tab strip (no 'All' — 'All' is only in the picker modal)
const TAB_CATEGORIES = CATEGORIES.slice(1) as readonly Exclude<Category, 'All'>[];

// ─── Session shuffle seed — random on every app launch, stable within session ─
const _DAILY_SEED = (Math.random() * 0xffffffff) >>> 0;

function shuffleSoundsForDay<T>(arr: T[], cat: string): T[] {
  const a = [...arr];
  let h = _DAILY_SEED >>> 0;
  for (let i = 0; i < cat.length; i++) h = (Math.imul(h, 31) ^ cat.charCodeAt(i)) >>> 0;
  for (let i = a.length - 1; i > 0; i--) {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    const j = h % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const LALITHA_IMG  = { uri: 'https://images.pexels.com/photos/33834247/pexels-photo-33834247.jpeg?auto=compress&cs=tinysrgb&w=400' };
const HANUMAN_IMG  = require('../../assets/images/hanumanji.png');

const SOUND_BUNDLED_IMAGES: Record<string, any> = {
  mantra_lalitha:    LALITHA_IMG,
  med_hanuman_chalisa: HANUMAN_IMG,
};

const SOUND_IMAGES = SOUND_IMAGES_LIB;

// ─── NADA remote sounds — streamed from CDN, not bundled in APK ─────────────
const NAAD_BASE = 'https://audio.onesutralabs.com/All%20Nada%20Sounds/';
type NaadSound = { id: string; label: string; emoji: string; cat: string; color: string; top: string; bot: string; desc: string; src: { uri: string } };
const NAAD_SOUNDS: NaadSound[] = [
  // ── Sitar ──────────────────────────────────────────────────────────────────
  { id: 'naad_aar_sitar_classical',    label: 'Indian Classical Sitar', emoji: '🪕', cat: 'Ragas', color: '#f59e0b', top: '#1A1000', bot: '#0A0800', desc: 'Classical Indian sitar melody',              src: { uri: NAAD_BASE + 'aar_music-indian-classical-music-sitar-296790.m4a' } },
  { id: 'naad_aar_sitar_flute',        label: 'Sitar & Flute',          emoji: '🎵', cat: 'Ragas', color: '#fbbf24', top: '#1A1200', bot: '#0A0900', desc: 'Sitar and bansuri flute interplay',          src: { uri: NAAD_BASE + 'aar_music-indian-classical-music-sitar-flute-298975.m4a' } },
  { id: 'naad_sitar_vibes_i',          label: 'Sitar Resonance',          emoji: '🎸', cat: 'Ragas', color: '#f97316', top: '#1A0E00', bot: '#0A0700', desc: 'Soulful sitar groove',                        src: { uri: NAAD_BASE + 'gskvibes-sitar-2-361895.m4a' } },
  { id: 'naad_sitar_vibes_ii',         label: 'Sitar Reverie',         emoji: '🎶', cat: 'Ragas', color: '#fb923c', top: '#1A0C00', bot: '#0A0600', desc: 'Meditative sitar flow',                       src: { uri: NAAD_BASE + 'gskvibes-sitar-4-361900.m4a' } },
  { id: 'naad_sitar_flute_tabla_soft', label: 'Sitar Flute Tabla',      emoji: '🎼', cat: 'Ragas', color: '#f59e0b', top: '#1A1000', bot: '#0A0800', desc: 'Soft Indian classical trio',                  src: { uri: NAAD_BASE + 'kalsstockmedia-free-soul-indian-sitar-flute-tabla-soft-sounds-white-noise-413706.m4a' } },
  { id: 'naad_sitar_tabla_flute',      label: 'Sitar Tabla Blend',      emoji: '🪕', cat: 'Ragas', color: '#fbbf24', top: '#1A1200', bot: '#0A0900', desc: 'Indian sitar tabla fusion',                   src: { uri: NAAD_BASE + 'kalsstockmedia-free-soul-indian-sitar-tabla-flute-396347.m4a' } },
  { id: 'naad_short_classical_sitar',  label: 'Classical Sitar Short',  emoji: '🎵', cat: 'Ragas', color: '#f59e0b', top: '#1A1000', bot: '#0A0800', desc: 'Short Indian classical sitar',                src: { uri: NAAD_BASE + 'kalsstockmedia-free-soul-short-sitar-music-classical-indian-404177.m4a' } },
  { id: 'naad_sitar_moonlight',        label: 'Sitar in Moonlight',     emoji: '🌙', cat: 'Ragas', color: '#fcd34d', top: '#1A1400', bot: '#0A0A00', desc: 'Sitar resonating in the moonlit night',      src: { uri: NAAD_BASE + 'nourishedbymusic-sitar-in-the-moonlight-115602.m4a' } },
  { id: 'naad_sitar_holistic',         label: 'Sitar & Holistic',       emoji: '🧘', cat: 'Ragas', color: '#f59e0b', top: '#1A1000', bot: '#0A0800', desc: 'Holistic sitar meditation sounds',            src: { uri: NAAD_BASE + 'patrizioyoga-sitar-hand-olistik-sound-project-patrizio-yoga-172195.m4a' } },
  { id: 'naad_sitar_holistic_med',     label: 'Sitar & Holistic',       emoji: '🧘', cat: 'Meditations', color: '#f59e0b', top: '#1A1000', bot: '#0A0800', desc: 'Holistic sitar meditation sounds',            src: { uri: NAAD_BASE + 'patrizioyoga-sitar-hand-olistik-sound-project-patrizio-yoga-172195.m4a' } },
  { id: 'naad_sitar_holistic_sleep',   label: 'Sitar & Holistic',       emoji: '🧘', cat: 'Sleep', color: '#f59e0b', top: '#1A1000', bot: '#0A0800', desc: 'Holistic sitar meditation sounds',            src: { uri: NAAD_BASE + 'patrizioyoga-sitar-hand-olistik-sound-project-patrizio-yoga-172195.m4a' } },
  { id: 'naad_raga_sparkle',           label: 'Raga Sparkle',           emoji: '✨', cat: 'Ragas', color: '#fbbf24', top: '#1A1200', bot: '#0A0900', desc: 'Sparkling Indian raga melody',                src: { uri: NAAD_BASE + 'pixel_perfect_productions-raga-sparkle-437291.m4a' } },
  { id: 'naad_raga_sparkle_sleep',     label: 'Raga Sparkle',           emoji: '✨', cat: 'Sleep', color: '#fbbf24', top: '#1A1200', bot: '#0A0900', desc: 'Sparkling Indian raga melody',                src: { uri: NAAD_BASE + 'pixel_perfect_productions-raga-sparkle-437291.m4a' } },
  { id: 'naad_sitar_temple',           label: 'Sitar in the Temple',    emoji: '🛕', cat: 'Ragas', color: '#f97316', top: '#1A0E00', bot: '#0A0700', desc: 'Sacred sitar resonating in a temple',        src: { uri: NAAD_BASE + 'playlistsons-sitar-in-the-temple-of-rats-430832.m4a' } },
  { id: 'naad_indian_sitar_tune',      label: 'Indian Sitar Tune',      emoji: '🎸', cat: 'Ragas', color: '#f59e0b', top: '#1A1000', bot: '#0A0800', desc: 'Traditional Indian sitar tune',               src: { uri: NAAD_BASE + 'rungstudiorecords-indian-sitar-tune-391626.m4a' } },
  { id: 'naad_sitar_bhagesri',         label: 'Sitar Bhagesri Raga',    emoji: '🪕', cat: 'Ragas', color: '#fbbf24', top: '#1A1200', bot: '#0A0900', desc: 'Raga Bhagesri on sitar and guitar',           src: { uri: NAAD_BASE + 'saseendran-sitar-amp-guitar-bhagesri-374594.m4a' } },
  { id: 'naad_sitar_raga_jog',         label: 'Sitar Raga Jog',         emoji: '🎵', cat: 'Ragas', color: '#f97316', top: '#1A0E00', bot: '#0A0700', desc: 'Classical Raga Jog on sitar',                 src: { uri: NAAD_BASE + 'saseendran-sitar-melody-raga-jog-364969.m4a' } },
  { id: 'naad_sitar_type_beat',        label: 'Sitar Type Beat',        emoji: '🎶', cat: 'Ragas', color: '#f59e0b', top: '#1A1000', bot: '#0A0800', desc: 'Smooth lo-fi sitar beat',                     src: { uri: NAAD_BASE + 'u_67ccao27gv-sitar-type-beat-322065.m4a' } },
  // ── Flute ──────────────────────────────────────────────────────────────────
  { id: 'naad_zen_bamboo_flow',        label: 'Zen Bamboo Flow',        emoji: '🌿', cat: 'Ragas', color: '#86efac', top: '#0A1A10', bot: '#050D08', desc: 'Flowing bamboo Zen melody',                    src: { uri: NAAD_BASE + 'djovan-zen-bamboo-flow-497102.m4a' } },
  { id: 'naad_zen_bamboo_flow_sleep',  label: 'Zen Bamboo Flow',        emoji: '🌿', cat: 'Sleep', color: '#86efac', top: '#0A1A10', bot: '#050D08', desc: 'Flowing bamboo Zen melody',                    src: { uri: NAAD_BASE + 'djovan-zen-bamboo-flow-497102.m4a' } },
  { id: 'naad_ancestors_flute',        label: 'Ancestors Flute',        emoji: '🪶', cat: 'Ragas', color: '#a3e635', top: '#121400', bot: '#090A00', desc: 'Native American ancestral flute',              src: { uri: NAAD_BASE + 'k3lix_music-last-breath-of-ancestors-native-american-flute-214341.m4a' } },
  { id: 'naad_indian_flute_tabla_mix', label: 'Indian Flute & Tabla',   emoji: '🎵', cat: 'Ragas', color: '#34d399', top: '#081A0C', bot: '#040C06', desc: 'Indian flute and tabla mix',                   src: { uri: NAAD_BASE + 'kalsstockmedia-free-soul-indian-flute-amp-tabla-mix-452176.m4a' } },
  { id: 'naad_indian_flute_tabla_mix_sleep', label: 'Indian Flute & Tabla',   emoji: '🎵', cat: 'Sleep', color: '#34d399', top: '#081A0C', bot: '#040C06', desc: 'Indian flute and tabla mix',                   src: { uri: NAAD_BASE + 'kalsstockmedia-free-soul-indian-flute-amp-tabla-mix-452176.m4a' } },
  { id: 'naad_bansuri_tabla_fusion',   label: 'Bansuri Tabla Fusion',   emoji: '🎶', cat: 'Ragas', color: '#6ee7b7', top: '#081810', bot: '#040C08', desc: 'Indian bansuri tabla fusion',                  src: { uri: NAAD_BASE + 'kalsstockmedia-indian-bansuri-tabla-fusion-short-music-25-seconds-track-269954.m4a' } },
  { id: 'naad_flute_tabla_remastered', label: 'Flute Tabla Remastered', emoji: '🌟', cat: 'Ragas', color: '#86efac', top: '#0A1A10', bot: '#050D08', desc: 'Remastered flute and tabla melody',            src: { uri: NAAD_BASE + 'kalsstockmedia-indian-flute-and-tabla-new-tune-remastered-277266.m4a' } },
  { id: 'naad_summer_flute_tabla',     label: 'Summer Flute Tabla',     emoji: '☀️', cat: 'Ragas', color: '#34d399', top: '#081A0C', bot: '#040C06', desc: 'Warm summer flute & tabla blend',              src: { uri: NAAD_BASE + 'kalsstockmedia-indian-summer-tabla-flute-calm-background-music-track-280183.m4a' } },
  { id: 'naad_krishna_flute_i',        label: 'Divine Krishna Flute',        emoji: '💙', cat: 'Ragas', color: '#38bdf8', top: '#0A1E28', bot: '#050F14', desc: 'Lord Krishna\'s divine flute melody',           src: { uri: NAAD_BASE + 'krasnoshchok-hindu-krishna-flute-music-499585.m4a' } },
  { id: 'naad_krishna_flute_ii',       label: 'Celestial Krishna Flute',       emoji: '🌀', cat: 'Ragas', color: '#67e8f9', top: '#081820', bot: '#040C10', desc: 'Second Krishna flute meditation',              src: { uri: NAAD_BASE + 'krasnoshchok-krishna-flute-hindu-music-450217.m4a' } },
  { id: 'naad_muladhara_flute',        label: 'Muladhara Flute',        emoji: '🕉️', cat: 'Ragas', color: '#6ee7b7', top: '#081810', bot: '#040C08', desc: 'Root chakra flute meditation',                 src: { uri: NAAD_BASE + 'meditativetiger-lord-krishnax27s-mulhadara-flute-meditative-tiger-edit-410414.m4a' } },
  { id: 'naad_himalayan_village_flute',label: 'Himalayan Village Flute',emoji: '🏔️', cat: 'Ragas', color: '#86efac', top: '#0A1A10', bot: '#050D08', desc: 'Flute echoing through Himalayan village',      src: { uri: NAAD_BASE + 'oqu-himalayan-village-flute-251427.m4a' } },
  { id: 'naad_himalayan_village_flute_sleep',label: 'Himalayan Village Flute',emoji: '🏔️', cat: 'Sleep', color: '#86efac', top: '#0A1A10', bot: '#050D08', desc: 'Flute echoing through Himalayan village',      src: { uri: NAAD_BASE + 'oqu-himalayan-village-flute-251427.m4a' } },
  { id: 'naad_relaxing_flute',         label: 'Relaxing Flute',         emoji: '🌸', cat: 'Ragas', color: '#34d399', top: '#081A0C', bot: '#040C06', desc: 'Soothing relaxing flute reverie',              src: { uri: NAAD_BASE + 'pojeng-sad-relaxing-flute-406638.m4a' } },
  { id: 'naad_relaxing_flute_sleep',   label: 'Relaxing Flute',         emoji: '🌸', cat: 'Sleep', color: '#34d399', top: '#081A0C', bot: '#040C06', desc: 'Soothing relaxing flute reverie',              src: { uri: NAAD_BASE + 'pojeng-sad-relaxing-flute-406638.m4a' } },
  { id: 'naad_wind_mountain_raga',     label: 'Wind from the Mountain', emoji: '🌬️', cat: 'Ragas', color: '#a3e635', top: '#121400', bot: '#090A00', desc: 'Raga Pahad — mountain winds on flute',         src: { uri: NAAD_BASE + 'saseendran-wind-from-the-mountain-raga-pahad-364841.m4a' } },
  { id: 'naad_pure_flute_melody',      label: 'Pure Flute Melody',      emoji: '🎵', cat: 'Ragas', color: '#6ee7b7', top: '#081810', bot: '#040C08', desc: 'Simple pure flute melody',                     src: { uri: NAAD_BASE + 'trycja-flute-melody-494886.m4a' } },
  { id: 'naad_emotional_flute',        label: 'Emotional Flute',        emoji: '💫', cat: 'Ragas', color: '#86efac', top: '#0A1A10', bot: '#050D08', desc: 'Deep emotional flute journey',                 src: { uri: NAAD_BASE + 'u_iwe3yizfhb-emotional-sad-flute-478667.m4a' } },
  { id: 'naad_flute_rain_ambiance',    label: 'Flute & Rain',           emoji: '🌧️', cat: 'Ragas', color: '#67e8f9', top: '#081820', bot: '#040C10', desc: 'Flute music with soothing rain ambiance',      src: { uri: NAAD_BASE + 'wr_ambiance-flute-music-with-rain-ambiance-370521.m4a' } },
  // ── Tabla ──────────────────────────────────────────────────────────────────
  { id: 'naad_tabla_110',              label: 'Tabla 110',              emoji: '🥁', cat: 'Ragas', color: '#f97316', top: '#1A0800', bot: '#0A0400', desc: 'Crisp tabla at 110 BPM',                       src: { uri: NAAD_BASE + 'jeremiah7-tabla-110-292145.m4a' } },
  { id: 'naad_tabla_flute_i',          label: 'Awakening Tabla & Flute',        emoji: '🪘', cat: 'Ragas', color: '#fb923c', top: '#1A0A00', bot: '#0A0500', desc: 'Tabla and flute melody I',                    src: { uri: NAAD_BASE + 'jeremiah7-tabla-flute-103-262273.m4a' } },
  { id: 'naad_tabla_flute_ii',         label: 'Tranquil Tabla & Flute',       emoji: '🎵', cat: 'Ragas', color: '#f59e0b', top: '#1A0E00', bot: '#0A0700', desc: 'Tabla and flute melody II',                   src: { uri: NAAD_BASE + 'jeremiah7-tabla-flute-104-262260.m4a' } },
  { id: 'naad_tabla_flute_iii',        label: 'Mystic Tabla & Flute',      emoji: '🎶', cat: 'Ragas', color: '#fbbf24', top: '#1A1200', bot: '#0A0900', desc: 'Tabla and flute melody III',                  src: { uri: NAAD_BASE + 'jeremiah7-tabla-flute-105-262271.m4a' } },
  { id: 'naad_tabla_flute_strings_i',  label: 'Tabla Flute Harmony',  emoji: '🪗', cat: 'Ragas', color: '#fb923c', top: '#1A0A00', bot: '#0A0500', desc: 'Tabla, flute and strings blend I',            src: { uri: NAAD_BASE + 'jeremiah7-tabla-flute-strings-105-262265.m4a' } },
  { id: 'naad_tabla_flute_strings_ii', label: 'Tabla Flute Serenade', emoji: '🎼', cat: 'Ragas', color: '#f97316', top: '#1A0800', bot: '#0A0400', desc: 'Tabla, flute and strings blend II',           src: { uri: NAAD_BASE + 'jeremiah7-tabla-flute-strings-107-262266.m4a' } },
  { id: 'naad_calming_tabla_flute',    label: 'Calming Tabla Flute',    emoji: '🧘', cat: 'Ragas', color: '#f59e0b', top: '#1A0E00', bot: '#0A0700', desc: 'Calming Indian background tabla and flute',   src: { uri: NAAD_BASE + 'kalsstockmedia-free-soul-calming-indian-background-music-tabla-flute-385106.m4a' } },
  { id: 'naad_rhythm_riot',            label: 'Rhythm Riot',            emoji: '⚡', cat: 'Ragas', color: '#fbbf24', top: '#1A1200', bot: '#0A0900', desc: 'Energetic tabla rhythm',                       src: { uri: NAAD_BASE + 'nra-lab-stomps-riser-rhythm-riot-246396.m4a' } },
  { id: 'naad_tabla_dance',            label: 'Tabla Dance Groove',     emoji: '🕺', cat: 'Ragas', color: '#fb923c', top: '#1A0A00', bot: '#0A0500', desc: 'Joyful tabla dance rhythm',                    src: { uri: NAAD_BASE + 'one_nug-dont-worry-be-happy-tabla-dance-340952.m4a' } },
  { id: 'naad_old_gold_tabla',         label: 'Old is Gold Tabla',      emoji: '🥁', cat: 'Ragas', color: '#f97316', top: '#1A0800', bot: '#0A0400', desc: 'Timeless Indian tabla music',                  src: { uri: NAAD_BASE + 'vfs_world-old-is-gold-indian-tabla-music-copyright-free-song-394347.m4a' } },
  // ── Meditations ─────────────────────────────────────────────────────────────
  { id: 'naad_hang_drum_tabla',        label: 'Hang Drum & Tabla',      emoji: '🥁', cat: 'Meditations', color: '#c084fc', top: '#14082A', bot: '#0A0516', desc: 'Spiritually uplifting hang drum and tabla',  src: { uri: NAAD_BASE + 'dreamsofserenity-spiritually-uplifting-music-hang-drum-tabla-flute-289790.m4a' } },
  { id: 'naad_bhajan_flute_tabla',     label: 'Bhajan Flute & Tabla',   emoji: '🕉️', cat: 'Sleep', color: '#a78bfa', top: '#100830', bot: '#080418', desc: 'Bhajan-style Indian flute and tabla',        src: { uri: NAAD_BASE + 'kalsstockmedia-free-soul-indian-flute-tabla-bhajan-style-452175.m4a' } },
  { id: 'naad_shiva_nirvana_mantra',   label: 'Shiva Nirvana Mantra',   emoji: '🔱', cat: 'Meditations', color: '#818cf8', top: '#0C0822', bot: '#060411', desc: 'Shiva nirvana rupam mantra',                  src: { uri: NAAD_BASE + 'kalsstockmedia-free-soul-shiva-nirvana-rupam-mantra-487340.m4a' } },
  { id: 'naad_shiva_panchakshara',     label: 'Shiva Panchakshara',     emoji: '🕉️', cat: 'Meditations', color: '#c084fc', top: '#14082A', bot: '#0A0516', desc: 'Shiva Panchakshara mantra v1',               src: { uri: NAAD_BASE + 'kalsstockmedia-free-soul-shiva-panchakshara-mantra-v1-374359.m4a' } },
  { id: 'naad_shiva_panchakshara_sleep',     label: 'Shiva Panchakshara',     emoji: '🕉️', cat: 'Sleep', color: '#c084fc', top: '#14082A', bot: '#0A0516', desc: 'Shiva Panchakshara mantra v1',               src: { uri: NAAD_BASE + 'kalsstockmedia-free-soul-shiva-panchakshara-mantra-v1-374359.m4a' } },
  { id: 'naad_om_namah_shivaya',       label: 'Om Namah Shivaya',       emoji: '🌺', cat: 'Meditations', color: '#a78bfa', top: '#100830', bot: '#080418', desc: 'Om Namah Shivaya devotional song',            src: { uri: NAAD_BASE + 'kalsstockmedia-om-namah-shivaya-song-229613.m4a' } },
  { id: 'naad_govinda_mantra',         label: 'Govinda Mantra',         emoji: '💙', cat: 'Meditations', color: '#818cf8', top: '#0C0822', bot: '#060411', desc: 'Govinda mantra with female voice, tanpura and sitar', src: { uri: NAAD_BASE + 'shidenbeatsmusic-govinda-mantra-female-voice-with-tanpura-and-sitar-120558.m4a' } },
  { id: 'naad_shiv_swarnamala',        label: 'Shiv Swarnamala',        emoji: '🔱', cat: 'Meditations', color: '#c084fc', top: '#14082A', bot: '#0A0516', desc: 'Shiv Swarnamala Samb Sadashiv',               src: { uri: NAAD_BASE + 'shiv-swarnamala-samb-sadashiv-version1-410249.m4a' } },
  { id: 'naad_hang_flute_meditation',  label: 'Hang & Flute Meditation',emoji: '🎵', cat: 'Meditations', color: '#a78bfa', top: '#100830', bot: '#080418', desc: 'Soothing hang drum and flute meditation',    src: { uri: NAAD_BASE + 'silentvoice-soothing-hang-and-flute-meditation-music-229157.m4a' } },
  { id: 'naad_gayatri_mantra_long',    label: 'Gayatri Mantra 10 Min',  emoji: '🌞', cat: 'Meditations', color: '#818cf8', top: '#0C0822', bot: '#060411', desc: 'Extended Gayatri mantra meditation',          src: { uri: NAAD_BASE + 'sounovamusic-gayatri-mantra-10-min-407517.m4a' } },
  { id: 'naad_om_shivaya_meditation',  label: 'Om Shivaya Meditation',  emoji: '🕉️', cat: 'Meditations', color: '#c084fc', top: '#14082A', bot: '#0A0516', desc: 'Om Namah Shivaya music mantra meditation',   src: { uri: NAAD_BASE + 'sounovamusic-om-namah-shivaya-music-mantra-meditation-402775.m4a' } },
  // ── World (merged into Ragas) ──────────────────────────────────────────────
  { id: 'naad_festive_dholak_dance',   label: 'Festive Dholak Dance',   emoji: '🥁', cat: 'Ragas', color: '#f97316', top: '#1A0800', bot: '#0A0400', desc: 'Happy Indian festive flute, tabla & dholak',  src: { uri: NAAD_BASE + 'kalsstockmedia-free-soul-happy-indian-festive-flute-tabla-and-dholak-dance-music-463138.m4a' } },
  { id: 'naad_traditional_koto',       label: 'Traditional Koto',       emoji: '🎌', cat: 'Ragas', color: '#fbbf24', top: '#1A1200', bot: '#0A0900', desc: 'Traditional Japanese koto music',              src: { uri: NAAD_BASE + 'prettysleepy-koto-traditional-japanese-music-264711.m4a' } },
  { id: 'naad_indian_fusion',          label: 'Indian Fusion',          emoji: '🌍', cat: 'Ragas', color: '#a78bfa', top: '#100830', bot: '#080418', desc: 'Indian fusion blend',                          src: { uri: NAAD_BASE + 'shubsmusik-fusion-228214.m4a' } },
];

// ─── Time-based sound mode system ───────────────────────────────────────────
type SoundMode = {
  key: string; icon: string; label: string; subtitle: string; subtitleLines?: string[];
  headerGrad: readonly [string, string, string];
  recommended: string[];
};

const SOUND_MODES: Record<string, SoundMode> = {
  morning: { key: 'morning', icon: '🌅', label: 'Morning Nāda',    subtitle: 'Meditate, move or simply listen',        headerGrad: ['#061826', '#081E30', '#0A1628'], recommended: ['hz_432', 'morning_flute', 'spring_birds', 'forest_breeze', 'tibetan_bowl'] },
  focus:   { key: 'focus',   icon: '💼', label: 'Listen & Work',      subtitle: 'Tune in, block out, go deep',             headerGrad: ['#061420', '#091A2C', '#0A1628'], recommended: ['light_rain', 'flowing_water', 'forest_breeze', 'gentle_wind', 'sea_waves'] },
  restore: { key: 'restore', icon: '🌿', label: 'Afternoon Restore',  subtitle: 'Try Nada Sounds — see what sparks',       headerGrad: ['#061520', '#0A1628', '#0A1628'], recommended: ['flowing_water', 'forest_breeze', 'singing_bowl', 'hz_432', 'morning_birds'] },
  evening: { key: 'evening', icon: '🌙', label: 'Evening Wind Down',  subtitle: 'Signal your body: the day is done',       headerGrad: ['#06102A', '#090F28', '#0A1628'], recommended: ['tibetan_bowl', 'singing_bowl', 'night_forest', 'campfire', 'harbor_waves'] },
  sleep:   { key: 'sleep',   icon: '🌌', label: 'Good Night',         subtitle: 'Set a timer, press play, close your eyes', headerGrad: ['#030C20', '#061226', '#0A1628'], recommended: ['light_rain', 'night_forest', 'harbor_waves', 'tibetan_bowl', 'flowing_water', 'sea_waves', 'heavy_rain', 'campfire', 'singing_bowl', 'rain_thunder', 'jungle_rain'] },
};

const BRAHMA_MODE: SoundMode = {
  key: 'brahma',
  icon: '🌄',
  label: 'Good Morning',
  subtitle: 'Meditate or just listen — let sound guide you',
  headerGrad: ['#061826', '#081E30', '#0A1628'],
  recommended: ['hz_432', 'morning_flute', 'tibetan_bowl', 'singing_bowl', 'spiritual_journey', 'mantra_gayatri', 'tanpura_sacred_432hz'],
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
      { id: 'mantra_gayatri',    label: 'Gayatri Mantra',      emoji: '🌞', color: '#fbbf24', top: '#1A1000', bot: '#0A0800', desc: 'Universal prayer of light & wisdom',       cat: 'Meditations', src: { uri: 'https://ik.imagekit.io/rcsesr4xf/gayatri-mantra-ghanpaath.mp3' } },
      { id: 'mantra_lalitha',    label: 'Divine Power to Clear Obstacles (Lalitha Sahasranama)', emoji: '🌺', color: '#f472b6', top: '#1A0010', bot: '#0A0008', desc: 'Thousand names of the divine feminine',     cat: 'Meditations', src: { uri: 'https://ik.imagekit.io/rcsesr4xf/Lalitha-Sahasranamam.mp3' } },
      { id: 'mantra_shivtandav', label: 'Shiv Tandav',         emoji: '🔱', color: '#a78bfa', top: '#100A1A', bot: '#08050A', desc: 'Cosmic dance of Shiva',                     cat: 'Meditations', src: { uri: 'https://ik.imagekit.io/rcsesr4xf/Shiva-Tandav.mp3' } },
    ],
  },
  {
    category: 'Stotras',
    color: '#34d399',
    icon: '🕉️',
    sounds: [
      { id: 'stotra_bhagya',        label: 'Hymn of Fortune (Bhagya Suktam)',        emoji: '🌟', color: '#fde68a', top: '#1A1400', bot: '#0A0A00', desc: 'Vedic hymn for prosperity & fortune',      cat: 'Meditations', src: { uri: 'https://audio.onesutralabs.com/sounds-large/bhagya-suktam.m4a' } },
      { id: 'stotra_shiv_sankalpa', label: 'Shiv Sankalpa Suktam', emoji: '🕉️', color: '#c4b5fd', top: '#140A1A', bot: '#0A050F', desc: 'Vedic prayer for pure mind & right will', cat: 'Meditations', src: { uri: 'https://audio.onesutralabs.com/sounds-large/shiv-sankalpa-suktam.m4a' } },
    ],
  },
];

// ─── Sound period map (uses ayurvedic period IDs as keys) ───────────────────
// Sounds not listed here appear in ALL time slots.
// Period IDs: night_vata | morning_kapha | midday_pitta | afternoon_vata | evening_kapha | night_pitta
const SOUND_PERIODS: Record<string, string[]> = {
  // ── Rain: midday, afternoon & deep night only (not morning/evening) ───────
  light_rain:           ['midday_pitta', 'afternoon_vata', 'night_pitta'],
  heavy_rain:           ['midday_pitta', 'afternoon_vata', 'night_pitta'],
  rain_thunder:         ['midday_pitta', 'night_pitta'],
  jungle_rain:          ['midday_pitta', 'afternoon_vata', 'night_pitta'],
  jungle_storm:         ['midday_pitta', 'night_pitta'],
  // ── Ocean: morning through night, except pre-dawn ─────────────────────────
  sea_waves:            ['morning_kapha', 'midday_pitta', 'afternoon_vata', 'night_pitta'],
  rocky_shore:          ['morning_kapha', 'midday_pitta', 'afternoon_vata', 'night_pitta'],
  harbor_waves:         ['morning_kapha', 'afternoon_vata', 'evening_kapha', 'night_pitta'],
  flowing_water:        ['morning_kapha', 'midday_pitta', 'afternoon_vata', 'night_pitta'],
  // ── Nature / no birds: spread across day & night ─────────────────────────
  forest_breeze:        ['morning_kapha', 'midday_pitta', 'afternoon_vata', 'night_pitta'],
  night_forest:         ['evening_kapha', 'night_pitta'],
  gentle_wind:          ['morning_kapha', 'midday_pitta', 'afternoon_vata'],
  city_night:           ['night_pitta'],
  campfire:             ['evening_kapha', 'night_pitta'],
  wanderlust:           ['morning_kapha', 'midday_pitta', 'night_pitta'],
  // ── Birds: morning, midday, afternoon — NOT night ─────────────────────────
  morning_birds:        ['morning_kapha', 'midday_pitta', 'afternoon_vata'],
  spring_birds:         ['morning_kapha', 'midday_pitta'],
  forest_birds:         ['morning_kapha', 'midday_pitta'],
  // ── Sacred / Meditation: pre-dawn, morning & evening ─────────────────────
  hz_432:               ['night_vata', 'morning_kapha', 'afternoon_vata', 'evening_kapha'],
  singing_bowl:         ['night_vata', 'afternoon_vata', 'evening_kapha', 'night_pitta'],
  tibetan_bowl:         ['night_vata', 'morning_kapha', 'evening_kapha', 'night_pitta'],
  morning_flute:        ['night_vata', 'morning_kapha', 'evening_kapha'],
  sitar:                ['night_vata', 'morning_kapha', 'afternoon_vata'],
  indian_beats:         ['midday_pitta'],
  // ── Mantras & Stotras ─────────────────────────────────────────────────────
  mantra_gayatri:       ['night_vata', 'morning_kapha', 'evening_kapha'],
  mantra_lalitha:       ['night_vata', 'morning_kapha', 'evening_kapha'],
  mantra_shivtandav:    ['evening_kapha'],
  stotra_bhagya:        ['night_vata', 'morning_kapha'],
  stotra_shiv_sankalpa: ['evening_kapha', 'night_pitta'],
  // ── Sacred additions ─────────────────────────────────────────────────────
  tibetan_dreams:       ['night_vata', 'evening_kapha', 'night_pitta'],
  reincarnation_tones:  ['night_vata', 'afternoon_vata', 'evening_kapha'],
  spiritual_journey:    ['night_vata', 'morning_kapha', 'evening_kapha'],
  // ── Nature addition ──────────────────────────────────────────────────────
  night_jungle_chiangmai: ['night_pitta', 'evening_kapha'],
  // ── Sitar (morning & afternoon raga hours) ────────────────────────────────
  space_sitar:          ['morning_kapha', 'afternoon_vata'],
  sitar_long:           ['night_vata', 'morning_kapha', 'afternoon_vata'],

  indian_sitar_raga:    ['morning_kapha', 'afternoon_vata'],
  sitar_summer_raga:    ['morning_kapha', 'midday_pitta', 'afternoon_vata'],
  sitar_radiance:       ['morning_kapha', 'midday_pitta', 'afternoon_vata'],
  sitar_tanpura_sarangi:['night_vata', 'morning_kapha', 'afternoon_vata'],
  sitar_tanpura_bgm:    ['morning_kapha', 'afternoon_vata'],
  veena_classical:      ['night_vata', 'morning_kapha', 'evening_kapha'],
  // ── Flute ────────────────────────────────────────────────────────────────
  andean_flute:         ['morning_kapha', 'midday_pitta', 'afternoon_vata'],
  quena_flute:          ['morning_kapha', 'afternoon_vata'],
  native_flute:         ['morning_kapha', 'midday_pitta'],
  native_flute_echo:    ['night_vata', 'morning_kapha', 'evening_kapha'],
  bamboo_flute:         ['morning_kapha', 'midday_pitta', 'afternoon_vata'],
  flute_scale:          ['night_vata', 'morning_kapha', 'evening_kapha'],
  // ── Tabla (energetic — midday focus only) ────────────────────────────────
  tabla_shuffle:        ['midday_pitta'],
  tabla_jam:            ['midday_pitta'],
  tabla_claves:         ['midday_pitta'],
  // ── Birds (morning & midday only) ────────────────────────────────────────
  eagle_feather:        ['morning_kapha', 'midday_pitta'],
  cuckoo_forest:        ['morning_kapha', 'midday_pitta'],
  cuckoo_clock:         ['morning_kapha', 'midday_pitta'],
  cuckoo_soft:          ['morning_kapha', 'midday_pitta'],
  peacock_wild:         ['morning_kapha', 'midday_pitta'],
  cuckoo_chime:         ['morning_kapha', 'midday_pitta'],
  india_countryside_birds: ['morning_kapha', 'midday_pitta', 'afternoon_vata'],
  cuckoo_birds_forest:  ['morning_kapha', 'midday_pitta'],
  peacock_call:         ['morning_kapha', 'midday_pitta'],
  koel_bird:            ['morning_kapha', 'midday_pitta'],
  // ── Tanpura (pre-dawn, morning & evening) ────────────────────────────────
  tanpura_sacred_432hz: ['night_vata', 'morning_kapha', 'evening_kapha'],
  tanpura_breath:       ['night_vata', 'afternoon_vata', 'evening_kapha', 'night_pitta'],
  tanpura_loop:         ['night_vata', 'morning_kapha', 'evening_kapha'],
  raga_tanpura_drone:   ['night_vata', 'morning_kapha', 'afternoon_vata', 'evening_kapha'],
  // ── World (afternoon & evening) ──────────────────────────────────────────
  sargija_eastern:      ['afternoon_vata', 'evening_kapha'],
  tagore_festival:      ['morning_kapha', 'midday_pitta'],
  world_ambient:        ['afternoon_vata', 'evening_kapha', 'night_pitta'],
  heaven_tune:          ['afternoon_vata', 'evening_kapha'],
  sitar_calm:           ['night_vata', 'morning_kapha', 'afternoon_vata'],
  veena_raga:           ['night_vata', 'morning_kapha', 'evening_kapha'],
  bansuri_forest:       ['morning_kapha', 'midday_pitta', 'afternoon_vata'],
  bansuri_melody:       ['night_vata', 'morning_kapha', 'evening_kapha'],
  bansuri_tarana:       ['morning_kapha', 'afternoon_vata'],
  tanpura_mystic:       ['night_vata', 'afternoon_vata', 'evening_kapha', 'night_pitta'],
  tanpura_serene:       ['night_vata', 'morning_kapha', 'evening_kapha', 'night_pitta'],
  // ── CDN Ragas — Morning ────────────────────────────────────────────────────
  cdn_hansdhwani_432:   ['night_vata', 'morning_kapha', 'afternoon_vata', 'evening_kapha'],
  cdn_bhairav_soul:     ['night_vata', 'morning_kapha'],
  cdn_morning_aura:     ['night_vata', 'morning_kapha'],
  cdn_calm_sunrise:     ['morning_kapha', 'midday_pitta'],
  cdn_jogiya_morning:   ['night_vata', 'morning_kapha'],
  // ── CDN Ragas — Evening & Focus ───────────────────────────────────────────
  cdn_yaman_mental:     ['afternoon_vata', 'evening_kapha', 'night_pitta'],
  cdn_yaman_jugalbandi: ['afternoon_vata', 'evening_kapha'],
  cdn_bhimpalasi:       ['midday_pitta', 'afternoon_vata', 'evening_kapha'],
  cdn_darbari_silence:  ['afternoon_vata', 'evening_kapha', 'night_pitta'],
  cdn_eternal_union:    ['evening_kapha', 'night_pitta'],
  // ── CDN Ragas — Sleep ─────────────────────────────────────────────────────
  cdn_bageshree_sleep:  ['evening_kapha', 'night_pitta'],
  cdn_monsoon_megh:     ['midday_pitta', 'afternoon_vata', 'night_pitta'],
  cdn_monsoon_temple:   ['afternoon_vata', 'evening_kapha', 'night_pitta'],
  // ── CDN Ragas — Instrumental ──────────────────────────────────────────────
  cdn_naad_sangam:      ['morning_kapha', 'afternoon_vata', 'evening_kapha'],
  cdn_naad_targan:      ['morning_kapha', 'midday_pitta', 'afternoon_vata'],
  cdn_sitar_tabla_soul: ['morning_kapha', 'midday_pitta', 'afternoon_vata'],
  cdn_shiv_kailash:     ['morning_kapha', 'midday_pitta', 'afternoon_vata', 'evening_kapha'],
  cdn_carnatic_essence: ['morning_kapha', 'midday_pitta', 'afternoon_vata'],
  cdn_carnatic_flow:    ['morning_kapha', 'midday_pitta', 'afternoon_vata'],
  cdn_what_are_ragas:   ['morning_kapha', 'midday_pitta'],
  // ── CDN Meditations — Devotional ──────────────────────────────────────────
  cdn_aigiri_nandini:   ['night_vata', 'morning_kapha', 'evening_kapha'],
  cdn_auspicious_mantras: ['night_vata', 'morning_kapha'],
  cdn_kaal_bhairav:     ['evening_kapha', 'night_pitta'],
  cdn_lingashtakam:     ['night_vata', 'morning_kapha', 'evening_kapha'],
  cdn_nirvana_shatakam: ['night_vata', 'morning_kapha', 'afternoon_vata', 'evening_kapha'],
  cdn_shiv_rudrashtakam:['morning_kapha', 'evening_kapha'],
  cdn_shiv_swarnamala:  ['morning_kapha', 'evening_kapha'],
  cdn_surya_sukta:      ['night_vata', 'morning_kapha'],
};

// Fallback when GPS / solar data unavailable
const AUTOMODE_TO_PERIOD: Record<string, string> = {
  morning: 'morning_kapha',
  focus:   'midday_pitta',
  restore: 'afternoon_vata',
  evening: 'evening_kapha',
  sleep:   'night_pitta',
};

export const ALL_SOUNDS_LIST: any[] = [
  ...(SLEEP_SOUNDS as readonly any[]).filter(s => !SLEEP_HIDDEN_IDS.has(s.id)),
  ...NAAD_SOUNDS,
  ...MANTRA_LIBRARY.flatMap(g => g.sounds),
  // CDN / remote long-form tracks (streamed, not downloaded)
  ...ALL_SLEEP_SOUNDS.filter(s => s.id.startsWith('cdn_') || s.id.startsWith('nc_') || s.id.startsWith('med_')),
];

// ─── Solar-aware section label map ────────────────────────────────────────
const PERIOD_SECTION_LABELS: Record<string, { title: string; icon: string; isNight: boolean }> = {
  night_vata:     { title: 'Recommended Now', icon: '✨', isNight: false },
  morning_kapha_early: { title: 'Recommended Now', icon: '🧘', isNight: false },
  morning_kapha:  { title: 'Recommended Now', icon: '🌅', isNight: false },
  midday_pitta:   { title: 'Recommended Now', icon: '☀️', isNight: false },
  afternoon_vata: { title: 'Recommended Now', icon: '🌬️', isNight: false },
  evening_kapha:  { title: 'Recommended Now', icon: '🌇', isNight: false },
  night_pitta:    { title: 'For Your Night',  icon: '🌙', isNight: true  },
};

// ─── Cycling subtitle component ────────────────────────────────────────────
function CyclingSubtitle({ lines, style }: { lines: string[]; style?: object }) {
  const [idx, setIdx] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (lines.length < 2) return;
    const t = setInterval(() => {
      Animated.timing(fade, { toValue: 0, duration: 600, useNativeDriver: true }).start(() => {
        setIdx(i => (i + 1) % lines.length);
        Animated.timing(fade, { toValue: 1, duration: 700, useNativeDriver: true }).start();
      });
    }, 4500);
    return () => clearInterval(t);
  }, [lines.length]);
  return (
    <View style={{ minHeight: 32 }}>
      <Animated.Text style={[style, { opacity: fade }]} numberOfLines={2}>{lines[idx]}</Animated.Text>
    </View>
  );
}

// ─── Period chip friendly labels + hint sentences ──────────────────────────
const PERIOD_CHIP_LABELS: Record<string, { label: string; hint: string }> = {
  night_vata:     { label: 'Sacred Dawn · Body Awakening',   hint: 'Perfect for meditation & deep calm' },
  morning_kapha_early: { label: 'Morning Rise · Yoga & Meditation', hint: 'Gentle movement and mindfulness practice.' },
  morning_kapha:  { label: 'Morning Rise · Anabolic Phase',  hint: 'Move, nourish, build strength & meditation hour. Imperfect perfection, elegance, and a premium effect.' },
  midday_pitta:   { label: 'Peak Deep Work · Body Phase',    hint: 'Peak focus — tackle what matters most' },
  afternoon_vata: { label: 'Creative Flow · Neural Peak',    hint: 'Create, move and express freely' },
  evening_kapha:  { label: 'Wind Down · Recovery Phase',     hint: 'Ease into rest, connect and unwind' },
  night_pitta:    { label: 'Deep Rest · Body Repair Phase',  hint: 'Your body heals and rebuilds now' },
};

// ─── Ayurvedic day-phase hints (sound + activity suggestions) ─────────────
const PERIOD_DAY_HINTS: Record<string, { icon: string; name: string; line1: string; line2: string; color: string }> = {
  night_vata:    { icon: '✨', name: 'Brahma Muhurta',    line1: 'The most sacred hour — before the world wakes.', line2: 'Meditate or listen to birds. Your body is designed to come alive with these sounds and set the tone for everything that follows.', color: '#818cf8' },
  morning_kapha_early: { icon: '🧘', name: 'Yoga & Meditation', line1: 'Ground your nervous system.', line2: 'Perfect time for mindfulness and gentle stretching.', color: '#34d399' },
  morning_kapha: { icon: '🌅', name: 'Morning Rise',      line1: 'Listen to birds as the day opens up.',           line2: 'Nature calibrated your body to thrive with these sounds. Start your day strong — they will make your whole system work properly.', color: '#f59e0b' },
  midday_pitta:  { icon: '☀️', name: 'Deep Work Time',    line1: 'Your body is at peak focus right now.',          line2: 'As per your body rhythm, this is the deepest work window. Listen to sounds as you work — they sharpen output and keep you in flow.', color: '#fb923c' },
  afternoon_vata:{ icon: '🌬️', name: 'Creative Flow',     line1: 'A natural window for creativity and expression.', line2: 'Let flowing ragas and world music carry you. Create, move, and feel freely — your mind is primed for it right now.', color: '#a78bfa' },
  evening_kapha: { icon: '🌇', name: 'Evening Wind Down', line1: 'Listen to sounds or meditate with mantras.',     line2: 'Sacred ragas and nature sounds help your nervous system recover. Use meditation categories — let the day dissolve gently.', color: '#60a5fa' },
  night_pitta:   { icon: '🌙', name: 'Rest & Recover',    line1: 'This is the calm-down recovery period.',        line2: 'Sounds help the body heal deeply. Use nature sounds or ragas crafted by ancient yogis — your body rebuilds itself in silence.', color: '#10b981' },
};

// ─── Night themes (editorial cards) ────────────────────────────────────────
const NIGHT_THEMES = [
  { id: 'deep_sleep',   title: 'Deep Sleep',    subtitle: 'TOTAL SURRENDER', tags: 'All night',  category: 'All'     as Category, gradient: ['#04021A', '#080525', '#030110'] as const, orb1: '#1A0A50', orb2: '#100830', accent: '#7c3aed', featuredId: 'light_rain'    as SoundId, imageUri: 'https://images.pexels.com/photos/6022435/pexels-photo-6022435.jpeg' },
  { id: 'rain_stories', title: 'Rain Stories',  subtitle: 'WASH IT AWAY',    tags: 'Storm',      category: 'Nature'  as Category, gradient: ['#061825', '#0A2235', '#040E1A'] as const, orb1: '#0D3050', orb2: '#051528', accent: '#60a5fa', featuredId: 'light_rain'    as SoundId, imageUri: 'https://images.pexels.com/photos/459451/pexels-photo-459451.jpeg?auto=compress&cs=tinysrgb&w=400'   },
  { id: 'ocean_drift',  title: 'Ocean Drift',   subtitle: 'DEEP BLUE PEACE', tags: 'Coastal',    category: 'Nature'  as Category, gradient: ['#041A20', '#062530', '#021015'] as const, orb1: '#083540', orb2: '#041A25', accent: '#38bdf8', featuredId: 'sea_waves'     as SoundId, imageUri: 'https://images.pexels.com/photos/1295138/pexels-photo-1295138.jpeg?auto=compress&cs=tinysrgb&w=400' },
  { id: 'forest_night', title: 'Forest Night',  subtitle: 'EARTH & SILENCE', tags: 'Wilderness', category: 'Nature'  as Category, gradient: ['#041508', '#07200D', '#020A04'] as const, orb1: '#0A2F12', orb2: '#042008', accent: '#4ade80', featuredId: 'forest_breeze' as SoundId, imageUri: 'https://images.pexels.com/photos/1448055/pexels-photo-1448055.jpeg?auto=compress&cs=tinysrgb&w=400' },
  { id: 'city_rest',    title: 'City Rest',     subtitle: 'URBAN LULLABY',   tags: 'Distant',    category: 'Nature'  as Category, gradient: ['#1A1008', '#2A1A10', '#0E0904'] as const, orb1: '#3A2010', orb2: '#200E06', accent: '#fbbf24', featuredId: 'city_night'    as SoundId, imageUri: 'https://images.pexels.com/photos/466685/pexels-photo-466685.jpeg?auto=compress&cs=tinysrgb&w=400'   },
] as const;

const STOP_TIMES = [
  { label: '15 min', secs: 15 * 60 },
  { label: '21 min', secs: 21 * 60 },
  { label: '30 min', secs: 30 * 60 },
  { label: '45 min', secs: 45 * 60 },
  { label: '1 hr',   secs: 60 * 60 },
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
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={{ width: THEME_CARD_W }}>
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

// ─── Calm-style Sound Card (image + title below, no text overlay) ────────────
const CalmSoundCard = memo(function CalmSoundCard({
  sound, isPlaying, isPaused, onPress, width,
}: {
  sound: SoundItem | NaadSound; isPlaying: boolean; isPaused: boolean; onPress: () => void; width?: number;
}) {
  const [imgLoadFailed, setImgLoadFailed] = useState(false);
  // Safety net: force a re-render once warmSoundImageMap() finishes.
  // Because _layout.tsx now awaits warmSoundImageMap() before showing the UI,
  // this fires synchronously (no-op) in 99.99% of cases. It only matters if
  // the component somehow mounts before warm completes (e.g., dev fast-refresh).
  const [, forceUpdate] = useState(0);
  useEffect(() => subscribeToWarm(() => { setImgLoadFailed(false); forceUpdate(n => n + 1); }), []);
  const imgBundled = SOUND_BUNDLED_IMAGES[sound.id];
  const rawUri = SOUND_IMAGES[sound.id] ?? (sound as any).imageUri;
  const imgUri = !imgBundled ? (rawUri ? getLocalSoundImageUri(rawUri) : undefined) : undefined;
  const imgSource = imgBundled ?? (imgUri ? { uri: imgUri } : undefined);
  const finalSource = imgLoadFailed ? (rawUri ? { uri: rawUri } : undefined) : imgSource;

  const cardW = width ?? CALM_CARD_W;

  return (
    // No outer wrapper needed — title is now inside the card image itself
    <TouchableOpacity onPress={onPress} activeOpacity={0.82} style={{ width: cardW }}>
      <View style={{
        width: cardW,
        // Card is slightly taller than square to give title room inside
        height: Math.round(cardW * 1.15),
        borderRadius: 16, overflow: 'hidden',
        borderWidth: isPlaying ? 2 : 1,
        borderColor: isPlaying ? sound.color + '90' : 'rgba(255,255,255,0.08)',
      }}>
        {/* Background gradient fallback */}
        <LinearGradient colors={[sound.top, sound.bot]} style={StyleSheet.absoluteFillObject} />

        {/* Image layer - directly rendered from local file system, no opacity race conditions */}
        {finalSource && (
          <View style={StyleSheet.absoluteFillObject}>
            <Image
              source={finalSource}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
              onError={() => setImgLoadFailed(true)}
            />
          </View>
        )}

        {/* Strong bottom scrim so title is always readable */}
        <LinearGradient
          colors={['transparent', 'transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.88)']}
          locations={[0, 0.38, 0.70, 1]}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />

        {/* ── Title inside the card — bottom overlay ── */}
        <View style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          paddingHorizontal: 10, paddingBottom: 9, paddingTop: 4,
        }}>
          <Text
            style={{
              fontSize: 11.5,
              fontWeight: '700',
              color: '#FFFFFF',
              fontFamily: 'Nunito_700Bold',
              letterSpacing: 0.1,
              lineHeight: 15,
              textShadowColor: 'rgba(0,0,0,0.70)',
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 4,
            }}
            numberOfLines={2}
          >
            {sound.label}
          </Text>
          <Text
            style={{
              fontSize: 9,
              color: 'rgba(255,255,255,0.52)',
              fontFamily: 'Nunito_400Regular',
              marginTop: 1,
              letterSpacing: 0.3,
            }}
            numberOfLines={1}
          >
            {sound.cat}
          </Text>
        </View>

        {/* Playing indicator — top right */}
        {isPlaying && (
          <View style={{
            position: 'absolute', top: 8, right: 8,
            width: 26, height: 26, borderRadius: 13,
            backgroundColor: sound.color + '35',
            borderWidth: 1, borderColor: sound.color + '80',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name={isPaused ? 'pause' : 'musical-notes'} size={11} color={sound.color} />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
});

// ─── Sound Card — nature image background ────────────────────────────────────
const SoundCard = memo(function SoundCard({
  sound, isPlaying, isPaused, remaining, onPress, compact = false, grid = false,
}: {
  sound: SoundItem; isPlaying: boolean; isPaused: boolean; remaining: number; onPress: () => void; compact?: boolean; grid?: boolean;
}) {
  const [imgLoadFailed, setImgLoadFailed] = useState(false);
  // Safety net: force a re-render once warmSoundImageMap() finishes.
  const [, forceUpdate] = useState(0);
  useEffect(() => subscribeToWarm(() => { setImgLoadFailed(false); forceUpdate(n => n + 1); }), []);
  const pulse = useRef(new Animated.Value(1)).current;
  const imgBundled = SOUND_BUNDLED_IMAGES[sound.id];
  const rawUri = SOUND_IMAGES[sound.id] ?? (sound as any).imageUri;
  const imgUri = !imgBundled ? (rawUri ? getLocalSoundImageUri(rawUri) : undefined) : undefined;
  const imgSource = imgBundled ?? (imgUri ? { uri: imgUri } : undefined);
  const finalSource = imgLoadFailed ? (rawUri ? { uri: rawUri } : undefined) : imgSource;

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

  const cardW = grid ? GRID_CARD_W : (compact ? ROW_CARD_W : CARD_W);
  const cardH = grid ? GRID_CARD_H : (compact ? ROW_CARD_H : CARD_H);
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.80} style={{ width: cardW, height: cardH }}>
      <Animated.View style={{ flex: 1, transform: [{ scale: pulse }] }}>
        <View style={[S.soundCard, { flex: 1 }, isPlaying && { borderColor: sound.color + '80', borderWidth: 1.5 }]}>
          {/* Fallback gradient — always visible as base layer */}
          <LinearGradient colors={[sound.top, sound.bot]} style={[StyleSheet.absoluteFillObject, { borderRadius: 20 }]} />
          {/* Nature image */}
          {finalSource && (
            <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, overflow: 'hidden' }]}>
              <Image
                source={finalSource}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
                onError={() => setImgLoadFailed(true)}
              />
            </View>
          )}
          {/* Gradient overlay for text legibility */}
          <LinearGradient
            colors={['rgba(0,0,0,0.0)', 'rgba(0,0,0,0.48)', 'rgba(0,0,0,0.88)']}
            style={[StyleSheet.absoluteFillObject, { borderRadius: 20 }]}
          />
          {/* Color tint when active */}
          {isPlaying && (
            <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: sound.color + '20' }]} />
          )}
          <View style={S.soundGrad}>
            {/* Top row */}
            <View style={S.soundTopRow}>
              <View style={[S.soundPlayBtn, {
                backgroundColor: isPlaying ? sound.color + '30' : 'rgba(0,0,0,0.42)',
                borderColor: isPlaying ? sound.color + '70' : 'rgba(255,255,255,0.20)',
              }]}>
                <Ionicons name={isPlaying && !isPaused ? 'pause' : 'play'} size={15} color={isPlaying ? sound.color : '#FFFFFFCC'} />
              </View>
              <Text style={[S.soundEmojiAccent, { opacity: 1 }]}>{sound.emoji}</Text>
            </View>
            {/* Name + desc + badge */}
            <View>
              <MarqueeText style={[S.cardName, isPlaying && { color: sound.color }]} active={isPlaying} duration={8000} numberOfLines={2}>{sound.label}</MarqueeText>
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
  const imgUri = imgBundledFeat ?? (SOUND_IMAGES[sound.id] ? { uri: getLocalSoundImageUri(SOUND_IMAGES[sound.id]) } : null);

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
          <View>
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
          <View>
          <Text style={S.featTitle}>{sound.label}</Text>
          <Text style={S.featDesc}>{sound.desc}</Text>
          <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); onPlay(); }} style={[S.featPlayBtn, { backgroundColor: sound.color + '22', borderColor: sound.color + '45' }]}>
            <Ionicons name="play" size={15} color={sound.color} />
            <Text style={[S.featPauseTxt, { color: sound.color }]}>Play Now</Text>
          </TouchableOpacity>
          </View>
        </>
      )}
    </TouchableOpacity>
  );
}

// ─── Animated swipe hint pill ──────────────────────────────────────────────
const SwipeHint = memo(function SwipeHint({ color }: { color: string }) {
  const slide = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(slide, { toValue: 5, duration: 500, useNativeDriver: true }),
        Animated.timing(slide, { toValue: 0, duration: 500, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: color + '1A', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: color + '45' }}>
      <Text style={{ fontSize: 10, fontWeight: '800', color: color + 'CC', letterSpacing: 0.6 }}>SWIPE</Text>
      <Animated.View style={{ transform: [{ translateX: slide }] }}>
        <Ionicons name="arrow-forward" size={13} color={color + 'CC'} />
      </Animated.View>
    </View>
  );
});

const CATEGORY_META: Record<string, { emoji: string; color: string }> = {
  Sleep:       { emoji: '🌙', color: '#60a5fa' },
  Nature:      { emoji: '🍃', color: '#86efac' },
  Meditations: { emoji: '🕉️', color: '#c084fc' },
  Birds:       { emoji: '🐦', color: '#fde68a' },
  Ragas:       { emoji: '🎵', color: '#f59e0b' },
  World:       { emoji: '🌍', color: '#34d399' },
};

function getCategoryMeta(cat: string, periodId?: string | null): { emoji: string; color: string } {
  if (cat === 'Nature' && periodId) {
    switch (periodId) {
      case 'night_vata':        return { emoji: '✨', color: '#22d3ee' }; // Brahma teal / awakening
      case 'morning_kapha_early': return { emoji: '🧘', color: '#34d399' };
      case 'morning_kapha':     return { emoji: '💪', color: '#34d399' }; // kapha green
      case 'midday_pitta':      return { emoji: '🔥', color: '#fb923c' }; // pitta orange
      case 'midday_pitta_late': return { emoji: '🍃', color: '#f59e0b' }; // dip amber
      case 'afternoon_vata':    return { emoji: '⚡', color: '#a78bfa' }; // vata violet
      case 'evening_kapha':     return { emoji: '🌅', color: '#60a5fa' }; // sunset blue
      case 'night_pitta':       return { emoji: '🌙', color: '#F59E0B' }; // repair gold
    }
  }
  return CATEGORY_META[cat] ?? { emoji: '🎵', color: '#FFFFFF' };
}

const CAT_ICONS: Partial<Record<Category, string>> = {
  All:         'apps',
  Sleep:       'moon',
  Nature:      'leaf',
  Meditations: 'meditation',
  Birds:       'bird',      // MaterialCommunityIcons — realistic bird silhouette
  Ragas:       'musical-notes',
};

const CATEGORY_SUBTAGS: Partial<Record<Category, Array<{ emoji: string; label: string }>>> = {
  Sleep: [
    { emoji: '🌧️', label: 'Rain' },
    { emoji: '🌊', label: 'Ocean' },
    { emoji: '🌳', label: 'Forest' },
  ],
  Nature: [
    { emoji: '🌧️', label: 'Rain' },
    { emoji: '🌊', label: 'Ocean' },
    { emoji: '🌳', label: 'Forest' },
  ],
  Ragas: [
    { emoji: '🪕', label: 'Sitar' },
    { emoji: '🎵', label: 'Flute' },
    { emoji: '🥁', label: 'Tabla' },
    { emoji: '🎶', label: 'Tanpura' },
  ],
  Meditations: [
    { emoji: '🔔', label: 'Bowls & Tones' },
    { emoji: '🌞', label: 'Mantras' },
    { emoji: '🕉️', label: 'Sacred Chants' },
  ],
};

// ─── Category Bottom Sheet Selector ──────────────────────────────────────────
const CategoryBottomSheet = memo(function CategoryBottomSheet({
  visible, selectedCat, onSelect, onClose,
}: {
  visible: boolean;
  selectedCat: Category;
  onSelect: (cat: Category) => void;
  onClose: () => void;
}) {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const bgAnim    = useRef(new Animated.Value(0)).current;
  const [rendered, setRendered] = useState(visible);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 1, useNativeDriver: true, damping: 22, stiffness: 280 }),
        Animated.timing(bgAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 210, useNativeDriver: true, easing: Easing.in(Easing.ease) }),
        Animated.timing(bgAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start(() => setRendered(false));
    }
  }, [visible]);

  if (!rendered) return null;

  const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [520, 0] });

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        {/* Animated backdrop */}
        <Animated.View
          style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)', opacity: bgAnim }}
          pointerEvents="none"
        />
        {/* Tap-outside-to-dismiss */}
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1} />

        {/* Sheet */}
        <Animated.View style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          backgroundColor: 'rgba(7,12,28,0.98)',
          borderTopLeftRadius: 28, borderTopRightRadius: 28,
          borderWidth: 1, borderBottomWidth: 0,
          borderColor: 'rgba(255,255,255,0.13)',
          paddingBottom: 48,
          transform: [{ translateY }],
        }}>
          {/* Handle bar */}
          <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 20 }}>
            <View style={{ width: W, height: 26, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)' }} />
            </View>
          </View>

          {/* Elegant Label */}
          <View style={{ alignItems: 'center', marginBottom: 28, paddingHorizontal: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 6, backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 99, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.45)', fontFamily: 'Nunito_600SemiBold', textTransform: 'uppercase', letterSpacing: 1.2 }}>CURRENT CATEGORY :</Text>
              <Text style={{ fontSize: 12, fontWeight: '800', color: selectedCat === 'All' ? '#FFFFFF' : (CATEGORY_META[selectedCat]?.color ?? '#FFFFFF'), fontFamily: 'Nunito_800ExtraBold', letterSpacing: 0.8, textTransform: 'uppercase' }}>{selectedCat}</Text>
            </View>
            <Text style={{ fontSize: 18, fontWeight: '300', color: 'rgba(255,255,255,0.85)', letterSpacing: 0.5, textAlign: 'center', fontFamily: 'Nunito_400Regular', marginTop: 8 }}>
              Select the sound category
            </Text>
            <Text style={{ fontSize: 18, fontWeight: '300', color: 'rgba(255,255,255,0.5)', letterSpacing: 0.5, textAlign: 'center', fontFamily: 'Nunito_400Regular', marginTop: 2 }}>
              you want to listen
            </Text>
          </View>

          {/* "All Sounds" — full width row */}
          {(() => {
            const isActive = selectedCat === 'All';
            return (
              <TouchableOpacity
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onSelect('All'); onClose(); }}
                activeOpacity={0.80}
                style={{
                  alignItems: 'center', justifyContent: 'center',
                  marginHorizontal: 20, marginBottom: 12,
                  backgroundColor: isActive ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.03)',
                  borderRadius: 16, borderWidth: 1,
                  borderColor: isActive ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.06)',
                  paddingVertical: 18,
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: '600', color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.8)', fontFamily: 'Nunito_600SemiBold', letterSpacing: 0.5 }}>All Sounds</Text>
                <Text style={{ fontSize: 11, color: isActive ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.38)', marginTop: 4, fontFamily: 'Nunito_400Regular', letterSpacing: 0.5 }}>Everything · all categories</Text>
              </TouchableOpacity>
            );
          })()}

          {/* Category 2-column grid */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 12 }}>
            {(CATEGORIES.slice(1) as Category[]).map(cat => {
              const isActive = selectedCat === cat;
              const meta = CATEGORY_META[cat] ?? { emoji: '🎵', color: '#FFFFFF' };
              const color = meta.color;
              const cardW = (W - 40 - 12) / 2;
              const effectiveCatForCount = cat === 'Sleep' ? 'Nature' : cat;
              const soundCount = [...(SLEEP_SOUNDS as readonly any[]).filter((s: any) => s.cat === effectiveCatForCount && !SLEEP_HIDDEN_IDS.has(s.id)), ...NAAD_SOUNDS.filter((s: any) => s.cat === cat && !SLEEP_HIDDEN_IDS.has(s.id)), ...MANTRA_LIBRARY.flatMap(g => g.sounds).filter((s: any) => s.cat === cat), ...ALL_SLEEP_SOUNDS.filter((s: any) => (s.id.startsWith('cdn_') || s.id.startsWith('nc_') || s.id.startsWith('med_')) && (s.cat === effectiveCatForCount || s.cat === cat))].length;
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onSelect(cat); onClose(); }}
                  activeOpacity={0.80}
                  style={{
                    width: cardW,
                    backgroundColor: isActive ? `${color}1A` : 'rgba(255,255,255,0.03)',
                    borderRadius: 16, borderWidth: 1,
                    borderColor: isActive ? `${color}60` : 'rgba(255,255,255,0.06)',
                    paddingVertical: 22,
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: '600', color: isActive ? color : 'rgba(255,255,255,0.85)', fontFamily: 'Nunito_600SemiBold', letterSpacing: 0.5 }}>{cat}</Text>
                  <Text style={{ fontSize: 11, color: isActive ? `${color}A0` : 'rgba(255,255,255,0.38)', marginTop: 4, fontFamily: 'Nunito_400Regular', letterSpacing: 0.5 }}>{soundCount} sounds</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
});

// ─── Category Tab Strip — swipeable sticky tabs ──────────────────────────────
const CategoryTabStrip = memo(function CategoryTabStrip({
  selectedCat, onSelect, activePeriodId, onSettingsPress,
}: {
  selectedCat: Category;
  onSelect: (cat: Category, dir?: number) => void;
  activePeriodId?: string | null;
  onSettingsPress: () => void;
}) {
  const tabLayouts = useRef<Record<string, { x: number; width: number }>>({});
  const indicatorX = useRef(new Animated.Value(0)).current;
  const indicatorW = useRef(new Animated.Value(50)).current;
  const selectedCatRef = useRef(selectedCat);
  const onSelectRef    = useRef(onSelect);
  // Subtle shimmer pulse for the glassmorphic strip
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => { selectedCatRef.current = selectedCat; }, [selectedCat]);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  // Continuous shimmer animation
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 2800, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 2800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const moveIndicator = (cat: Category, instant = false) => {
    const layout = tabLayouts.current[cat];
    if (!layout) return;
    if (instant) {
      indicatorX.setValue(layout.x);
      indicatorW.setValue(layout.width);
    } else {
      Animated.parallel([
        Animated.spring(indicatorX, { toValue: layout.x,     useNativeDriver: false, damping: 26, stiffness: 400, mass: 0.5 }),
        Animated.spring(indicatorW, { toValue: layout.width, useNativeDriver: false, damping: 26, stiffness: 400, mass: 0.5 }),
      ]).start();
    }
  };

  useEffect(() => { moveIndicator(selectedCat); }, [selectedCat]);

  // PanResponder — feather-light horizontal swipe for ultra-smooth category switching
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      // Claim on an ultra-light horizontal flick
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 1 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.05,
      onMoveShouldSetPanResponderCapture: () => false,
      // CRITICAL: false = once we claim, the ScrollView cannot steal it back
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_, gs) => {
        try {
          const cur = selectedCatRef.current;
          const tabIdx = TAB_CATEGORIES.indexOf(cur as any);
          if (tabIdx === -1) return;
          const velocity = Math.abs(gs.vx);
          // Ultra-frictionless: fast flick needs only 2px; slow drag needs 4px
          const threshold = velocity > 0.1 ? 2 : 4;
          if (gs.dx < -threshold) {
            if (tabIdx < TAB_CATEGORIES.length - 1) {
              onSelectRef.current(TAB_CATEGORIES[tabIdx + 1] as Category, -1);
            } else {
              onSelectRef.current(TAB_CATEGORIES[0] as Category, -1);
            }
          } else if (gs.dx > threshold) {
            if (tabIdx > 0) {
              onSelectRef.current(TAB_CATEGORIES[tabIdx - 1] as Category, 1);
            } else {
              onSelectRef.current(TAB_CATEGORIES[TAB_CATEGORIES.length - 1] as Category, 1);
            }
          }
        } catch (_e) { /* guard against any crash */ }
      },
    })
  ).current;


  const activeColor = selectedCat === 'All'
    ? '#a78bfa'
    : getCategoryMeta(selectedCat, activePeriodId).color;

  const shimmerOpacity = shimmerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.04, 0.11] });

  const isAndroid = Platform.OS === 'android';
  const HeaderView = isAndroid ? View : BlurView;

  return (
    <HeaderView
      intensity={0}
      tint="dark"
      style={{
        backgroundColor: 'transparent',
        borderBottomWidth: 0,
        borderBottomColor: 'transparent',
        shadowColor: 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
        elevation: 0,
        zIndex: 50,
        overflow: 'hidden',
      }}
      {...pan.panHandlers}
    >
      {/* ── Layer 1: base gradient shimmer — glass diffusion ── */}
      <LinearGradient
        colors={['rgba(120,100,255,0.10)', 'rgba(60,80,200,0.06)', 'rgba(0,0,0,0.00)']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      {/* ── Layer 2: animated shimmer pulse ── */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          {
            opacity: shimmerOpacity,
            backgroundColor: activeColor,
          },
        ]}
      />
      {/* ── Layer 3: top-edge highlight (frosted rim) ── */}
      <LinearGradient
        colors={['rgba(255,255,255,0.20)', 'transparent']}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.4 }}
        style={[StyleSheet.absoluteFillObject, { height: 1.5 }]}
        pointerEvents="none"
      />

      {/* ── Row: tabs ── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', position: 'relative', paddingVertical: 6, paddingHorizontal: 4 }}>
        {/* ── Glowing sliding pill background ── */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 6,
            bottom: 6,
            left: indicatorX,
            width: indicatorW,
            borderRadius: 24,
            backgroundColor: 'rgba(255,255,255,0.08)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.15)',
            shadowColor: activeColor,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.5,
            shadowRadius: 12,
            elevation: 4,
          }}
        />

        {/* ── Category tabs ── */}
        <View style={{ flex: 1, flexDirection: 'row' }}>
          {TAB_CATEGORIES.map(cat => {
            const isActive = selectedCat === cat;
            const catColor = getCategoryMeta(cat, activePeriodId).color;
            const catIcon = (CAT_ICONS[cat] ?? 'apps') as any;
            return (
              <TouchableOpacity
                key={cat}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onSelect(cat);
                }}
                activeOpacity={0.60}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 8, gap: 4 }}
                onLayout={(e) => {
                  const { x, width } = e.nativeEvent.layout;
                  tabLayouts.current[cat] = { x, width };
                  if (cat === selectedCat) moveIndicator(cat, true);
                }}
              >
                {cat === 'Birds' || cat === 'Meditations' ? (
                  <MaterialCommunityIcons
                    name={catIcon}
                    size={22}
                    color={isActive ? catColor : 'rgba(255,255,255,0.5)'}
                    style={isActive ? { textShadowColor: catColor, textShadowRadius: 8 } : {}}
                  />
                ) : (
                  <Ionicons
                    name={catIcon}
                    size={22}
                    color={isActive ? catColor : 'rgba(255,255,255,0.5)'}
                    style={isActive ? { textShadowColor: catColor, textShadowRadius: 8 } : {}}
                  />
                )}
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 9.5,
                    fontWeight: isActive ? '800' : '600',
                    fontFamily: isActive ? 'Nunito_800ExtraBold' : 'Nunito_600SemiBold',
                    color: isActive ? catColor : 'rgba(255,255,255,0.5)',
                    letterSpacing: 0.5,
                    textShadowColor: isActive ? catColor : 'transparent',
                    textShadowRadius: isActive ? 6 : 0,
                  }}
                >
                  {cat === 'Meditations' ? 'MEDITATE' : cat.toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </HeaderView>
  );
});

// ─── Category Mode Badge — tappable header chip ───────────────────────────────
const CategoryModeBadge = memo(function CategoryModeBadge({
  selectedCat, onPress,
}: {
  selectedCat: Category;
  onPress: () => void;
}) {
  const isAll = selectedCat === 'All';
  const meta  = isAll ? null : (CATEGORY_META[selectedCat] ?? { emoji: '🎵', color: '#FFFFFF' });
  const icon  = (CAT_ICONS[selectedCat] ?? 'apps') as any;
  const color = isAll ? '#FFFFFF' : (meta?.color ?? '#FFFFFF');
  const label = isAll ? 'All Sounds' : selectedCat;

  return (
    <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 6 }}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.72}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 8,
          backgroundColor: 'rgba(0,0,0,0.32)',
          borderWidth: 1,
          borderColor: isAll ? 'rgba(255,255,255,0.22)' : `${color}4A`,
          borderRadius: 99,
          paddingHorizontal: 16, paddingVertical: 8,
        }}
      >
        <Ionicons name={icon} size={13} color={color} />
        <Text style={{ fontSize: 13, fontWeight: '600', color, fontFamily: 'Nunito_600SemiBold', letterSpacing: 0.3 }}>
          {label}
        </Text>
        <Ionicons name="chevron-down" size={12} color={`${color}80`} />
      </TouchableOpacity>
    </View>
  );
});

// ─── Calm-style Category Rows ─────────────────────────────────────────────────
const CategoryRows = memo(function CategoryRows({
  playingId, isPaused, sessionSecs, onPress, selectedCat, onSelectCat, resetKey,
  natureLabel, activePeriodId,
}: {
  playingId: string | null;
  isPaused: boolean;
  sessionSecs: number;
  onPress: (id: string) => void;
  selectedCat: Category;
  onSelectCat: (cat: Category) => void;
  resetKey?: number;
  natureLabel?: string;
  activePeriodId?: string | null;
}) {
  const displayCats = selectedCat === 'All'
    ? (CATEGORIES.slice(1) as readonly Category[])
    : ([selectedCat] as readonly Category[]);
  const isFiltered = selectedCat !== 'All';
  // Smaller cards with wider spacing for a lighter, premium look
  const gridCardW = Math.floor((W - 74) / 2); // 26px pad each side + 22px gap

  return (
    <View style={{ paddingBottom: 8 }}>
      {displayCats.map((cat, catIdx) => {
        // 'Sleep' category mirrors all Nature sounds
        const effectiveCat = cat === 'Sleep' ? 'Nature' : cat;
        const localSounds = (SLEEP_SOUNDS as readonly SoundItem[]).filter(s => s.cat === effectiveCat && !SLEEP_HIDDEN_IDS.has(s.id));
        const naadSounds = NAAD_SOUNDS.filter(s => s.cat === cat && !SLEEP_HIDDEN_IDS.has(s.id));
        const mantraSounds = MANTRA_LIBRARY.flatMap(g => g.sounds).filter(s => s.cat === cat);
        const cdnSounds = ALL_SLEEP_SOUNDS.filter(s => (s.id.startsWith('cdn_') || s.id.startsWith('nc_') || s.id.startsWith('med_')) && (s.cat === effectiveCat || s.cat === cat));
        const sounds: any[] = shuffleSoundsForDay([...localSounds, ...naadSounds, ...mantraSounds, ...cdnSounds], cat);
        if (!sounds.length) return null;
        const meta = getCategoryMeta(cat, activePeriodId);
        const subtags = CATEGORY_SUBTAGS[cat];
        return (
          <View key={cat}>
            {catIdx > 0 && (
              <View style={{ paddingHorizontal: 20, marginTop: 20, marginBottom: 28 }}>
                <LinearGradient
                  colors={['transparent', 'rgba(255,255,255,0.28)', 'transparent']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={{ height: 1.5, borderRadius: 1 }}
                />
              </View>
            )}
            <View style={{ marginBottom: 4 }}>
              {/* Section header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: subtags ? 12 : 16, marginTop: 4 }}>
                {isFiltered ? (
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                      <View style={{ width: 3, height: 30, borderRadius: 2, backgroundColor: meta.color }} />
                      {cat === 'Nature' ? (
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 8, fontWeight: '900', color: meta.color, letterSpacing: 1.4, fontFamily: 'Nunito_900Black', opacity: 0.8, marginBottom: 3 }}>NATURE</Text>
                          <Text style={{ fontSize: 13.5, fontWeight: '600', color: 'rgba(255,255,255,0.90)', letterSpacing: 0.1, fontFamily: 'Nunito_700Bold', lineHeight: 18 }}>{natureLabel}</Text>
                        </View>
                      ) : (
                        <Text style={{ fontSize: 19, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.1, fontFamily: 'Nunito_700Bold', textShadowColor: 'rgba(0,0,0,0.70)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 8 }}>{cat}</Text>
                      )}
                    </View>
                  </View>
                ) : (
                  /* All mode — tappable header to switch to filtered view */
                  <TouchableOpacity
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onSelectCat(cat); }}
                    activeOpacity={0.72}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flex: 1 }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1 }}>
                      <View style={{ width: 3, height: cat === 'Nature' ? 30 : 22, borderRadius: 2, backgroundColor: meta.color }} />
                      {cat === 'Nature' ? (
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 8, fontWeight: '900', color: meta.color, letterSpacing: 1.4, fontFamily: 'Nunito_900Black', opacity: 0.8, marginBottom: 3 }}>NATURE</Text>
                          <Text style={{ fontSize: 13.5, fontWeight: '600', color: 'rgba(255,255,255,0.90)', letterSpacing: 0.1, fontFamily: 'Nunito_700Bold', lineHeight: 18 }}>{natureLabel}</Text>
                        </View>
                      ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ fontSize: 19, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.1, fontFamily: 'Nunito_700Bold', textShadowColor: 'rgba(0,0,0,0.70)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 8 }}>{cat}</Text>
                          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', fontWeight: '500' }}>{sounds.length}</Text>
                        </View>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: `${meta.color}18`, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: `${meta.color}30` }}>
                      <Text style={{ fontSize: 10, color: meta.color, fontWeight: '700', letterSpacing: 0.4 }}>Filter</Text>
                      <Ionicons name="chevron-forward" size={10} color={meta.color} />
                    </View>
                  </TouchableOpacity>
                )}
              </View>

              {/* Subcategory pills — Nature, Meditations, Ragas */}
              {subtags && (
                <View style={{ flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                  {subtags.map(tag => (
                    <View key={tag.label} style={{ borderRadius: 99, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}>
                      <Text style={{ fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.72)' }}>{tag.label}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* ── 2-column vertical grid for both All and filtered views ── */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 26, gap: 22, paddingBottom: 12 }}>
                {sounds.map(s => (
                  <CalmSoundCard
                    key={s.id}
                    sound={s}
                    isPlaying={playingId === s.id}
                    isPaused={isPaused && playingId === s.id}
                    onPress={() => onPress(s.id)}
                    width={gridCardW}
                  />
                ))}
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
});

// ─── Full-screen Immersive Sound Player Modal ────────────────────────────────
const { height: SCR_H } = Dimensions.get('screen');

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
  const rawModalUri = SOUND_IMAGES[sound.id] ?? (sound as any).imageUri;
  const imgUri     = imgBundledModal ?? (rawModalUri ? { uri: getLocalSoundImageUri(rawModalUri) } : null);

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
                <Text style={{ fontSize: 9, fontWeight: '400', color: '#FFFFFF60', letterSpacing: 0.5, fontFamily: 'Nunito_400Regular' }}>{sound.cat}</Text>
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
                  <Text style={{ fontSize: 9, fontWeight: '500', color: isPaused ? '#FFFFFF45' : sound.color, letterSpacing: 0.7, fontFamily: 'Nunito_600SemiBold' }}>
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
              <Text style={{ fontSize: 8, fontWeight: '400', color: '#FFFFFF28', letterSpacing: 0.8, marginBottom: 10, fontFamily: 'Nunito_400Regular' }}>Stop after</Text>
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

// ─── Instagram Reels-style Sound Player ──────────────────────────────────────
// Matches the exact same category order + per-category shuffle used by CategoryRows
const REELS_ALL_SOUNDS: PlayableSoundMeta[] = (() => {
  const result: PlayableSoundMeta[] = [];
  for (const cat of (CATEGORIES.slice(1) as readonly string[])) {
    const effectiveCat = cat === 'Sleep' ? 'Nature' : cat;
    const local = (SLEEP_SOUNDS as readonly any[])
      .filter(s => s.cat === effectiveCat && !SLEEP_HIDDEN_IDS.has(s.id))
      .map(s => ({ ...s, imageUri: SOUND_IMAGES[s.id] ?? s.imageUri }));
    const naad = NAAD_SOUNDS
      .filter(s => s.cat === cat && !SLEEP_HIDDEN_IDS.has(s.id))
      .map(s => ({ ...s, imageUri: SOUND_IMAGES[s.id] ?? (s as any).imageUri }));
    const mantra = MANTRA_LIBRARY.flatMap(g => g.sounds)
      .filter(s => s.cat === cat)
      .map(s => ({ ...s, imageUri: SOUND_IMAGES[s.id] ?? (s as any).imageUri, imageBundled: SOUND_BUNDLED_IMAGES[s.id] ?? undefined }));
    const cdn = ALL_SLEEP_SOUNDS
      .filter(s => (s.id.startsWith('cdn_') || s.id.startsWith('nc_') || s.id.startsWith('med_')) && (s.cat === effectiveCat || s.cat === cat));
    result.push(...shuffleSoundsForDay([...local, ...naad, ...mantra, ...cdn], cat));
  }
  return result;
})();
// Use 'window' (not 'screen') — on Android, 'screen' includes the system
// navigation bar height, causing each reel to overflow and pushing the
// bottom controls out of the visible area.
const { width: REEL_W, height: REEL_H } = Dimensions.get('screen');

// Safe find helper — avoids ! non-null assertions that throw on first install
const _findSleepSoundSrc = (id: string, fallbackSrc: any): any => {
  try {
    const found = (SLEEP_SOUNDS as readonly any[]).find(s => s.id === id);
    return found?.src ?? fallbackSrc;
  } catch { return fallbackSrc; }
};
const REEL_MIX_SOUNDS: PlayableSoundMeta[] = [
  { id: 'morning_birds', label: 'Birds',  emoji: '🐦', color: '#fde68a', top: '#1A1400', bot: '#0A0A00', cat: 'Birds',  desc: 'Dawn chorus',   src: _findSleepSoundSrc('morning_birds', require('../../assets/sounds/morning-birds-loop.m4a')), imageUri: SOUND_IMAGES['morning_birds'] },
  { id: 'andean_flute',  label: 'Flute',  emoji: '🏔️', color: '#6ee7b7', top: '#081A10', bot: '#040C08', cat: 'Ragas',  desc: 'Andean melody', src: _findSleepSoundSrc('andean_flute',  require('../../assets/sounds/andean-flute.m4a')),  imageUri: SOUND_IMAGES['andean_flute'] },
  { id: 'sitar_long',    label: 'Sitar',  emoji: '🎸', color: '#f59e0b', top: '#1A1000', bot: '#0A0800', cat: 'Ragas',  desc: 'Sitar raga',    src: _findSleepSoundSrc('sitar_long',    require('../../assets/sounds/sitar-long.m4a')),    imageUri: SOUND_IMAGES['sitar_long'] },
  { id: 'sea_waves',     label: 'Ocean',  emoji: '🌊', color: '#38bdf8', top: '#0A2030', bot: '#04101A', cat: 'Nature', desc: 'Sea waves',     src: _findSleepSoundSrc('sea_waves',     require('../../assets/sounds/mixkit-close-sea-waves-loop-1195.m4a')),     imageUri: SOUND_IMAGES['sea_waves'] },
];


// ── Wave art helpers ─────────────────────────────────────────────────────────
const makeWavePath = (W: number, phase: number, amplitude: number, wavelength: number, fillY: number): string => {
  const pts: string[] = [];
  for (let i = 0; i <= 48; i++) {
    const x = (i / 48) * W;
    const y = fillY + amplitude * Math.sin((x / wavelength) * Math.PI * 2 + phase);
    pts.push(i === 0 ? `M${x.toFixed(1)} ${y.toFixed(1)}` : `L${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  pts.push(`L${W} ${W + 4} L0 ${W + 4} Z`);
  return pts.join(' ');
};

function WaveView({ size, color, soundId, active, paused }: {
  size: number; color: string; soundId: string; active: boolean; paused: boolean;
}) {
  const { getMeteringLevel } = useSoundPlayer();
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (!active || paused) return;
    const iv = setInterval(() => setPhase(p => p + 0.05), 36);
    return () => clearInterval(iv);
  }, [active, paused]);

  
  // Audio-reactive amplitude — quiet = barely visible, loud = liquid waves
  const mLevel = getMeteringLevel();
  const levelScale = paused ? 0.04 : (0.12 + mLevel * 1.4);
  // Fill from slightly above center for a half-full glass sphere look
  const fillY = size * 0.58; 
  
  const waveA = makeWavePath(size, phase, size * 0.08 * levelScale, size * 0.85, fillY);
  const waveB = makeWavePath(size, -phase * 0.6 + 1.2, size * 0.06 * levelScale, size * 0.70, fillY + size * 0.03);
  const waveC = makeWavePath(size, phase * 0.4 + 2.0, size * 0.04 * levelScale, size * 0.55, fillY + size * 0.06);
  // Glossy wave crest
  const waveGlass = makeWavePath(size, phase + 0.15, size * 0.015 * levelScale, size * 0.9, fillY - size * 0.01);
  
  const cid = `wvc_${soundId.replace(/[^a-z0-9]/gi, '_')}`;

  return (
    <View pointerEvents="none" style={{
      position: 'absolute', width: size, height: size,
      borderRadius: size / 2, overflow: 'hidden',
      opacity: paused ? 0.25 : 1,
    }}>
      {/* Frosted glass backing — barely visible hint */}
      <View pointerEvents="none" style={{
        position: 'absolute', width: size, height: size,
        backgroundColor: 'rgba(255,255,255,0.02)',
      }} />

      {/* Sea-water translucent wave layers — 3 depth planes */}
      <Svg width={size} height={size}>
        <Defs>
          <SvgClipPath id={cid}>
            <SvgCircle cx={size / 2} cy={size / 2} r={size / 2} />
          </SvgClipPath>
        </Defs>
        {/* Deep water — ultra transparent */}
        <Path d={waveC} fill={color + '06'} clipPath={`url(#${cid})`} />
        {/* Mid water */}
        <Path d={waveB} fill={color + '0B'} clipPath={`url(#${cid})`} />
        {/* Surface water */}
        <Path d={waveA} fill={color + '12'} clipPath={`url(#${cid})`} />
        {/* Bright glassy crest — delicate white highlight */}
        <Path d={waveGlass} fill="rgba(255,255,255,0.12)" clipPath={`url(#${cid})`} />
      </Svg>
      
      {/* Top crescent glossy highlight */}
      <View pointerEvents="none" style={{
        position: 'absolute', top: size * 0.05, left: size * 0.18, right: size * 0.18,
        height: size * 0.22,
        borderRadius: size / 2,
        backgroundColor: 'rgba(255,255,255,0.10)',
        transform: [{ scaleY: 0.5 }],
      }} />
    </View>
  );
}

// ─── Reel Duration Options (Calm-style single control) ─────────────────────
const REEL_DURATION_OPTIONS = [
  { id: 'once',  label: 'Play Once',   sub: 'Full track · then stop',      icon: 'play-circle-outline' as const, isLoop: false, secs: -1    },
  { id: '15m',   label: '15 minutes',  sub: 'Loop · then stop',             icon: 'repeat'              as const, isLoop: true,  secs: 900   },
  { id: '30m',   label: '30 minutes',  sub: 'Loop · then stop',             icon: 'repeat'              as const, isLoop: true,  secs: 1800  },
  { id: '45m',   label: '45 minutes',  sub: 'Loop · then stop',             icon: 'repeat'              as const, isLoop: true,  secs: 2700  },
  { id: '1h',    label: '1 hour',      sub: 'Loop · then stop',             icon: 'repeat'              as const, isLoop: true,  secs: 3600  },
  { id: 'night', label: 'All night',   sub: '8 hours · perfect for sleep',  icon: 'moon-outline'        as const, isLoop: true,  secs: 28800 },
] as const;
type DurationId = typeof REEL_DURATION_OPTIONS[number]['id'];

function checkIsNightTime(solarTimes: { sunrise: number; solarNoon: number; sunset: number } | null): boolean {
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  if (solarTimes) {
    return h >= solarTimes.sunset || h < solarTimes.sunrise;
  }
  return h >= 18 || h < 6;
}

function ReelCard({
  sound, isActive, isPlaying, isPaused, sessionSecs, stopIdx,
  onPlay, onToggle, onStop, onChangeTimer, onPrev, onNext, isFirst, isLast,
}: {
  sound: PlayableSoundMeta; isActive: boolean;
  isPlaying: boolean; isPaused: boolean; sessionSecs: number; stopIdx: number;
  onPlay: () => void; onToggle: () => void; onStop: () => void;
  onChangeTimer: (i: number) => void;
  onPrev?: () => void; onNext?: () => void; isFirst?: boolean; isLast?: boolean;
}) {
  const { accentColor, solarTimes } = useBgContext();
  const isNight = checkIsNightTime(solarTimes);
  const activeDurationOptions = isNight ? REEL_DURATION_OPTIONS : REEL_DURATION_OPTIONS.filter(o => o.id !== 'night');
  const { playingDurationSecs, setLoopConfig, isAudioLoading, audioNetworkError, getPositionMs, seekTo } = useSoundPlayer();
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
  useEffect(() => {
    if (!isActive || !isAudioLoading) { setShowLoadingOverlay(false); return; }
    const t = setTimeout(() => setShowLoadingOverlay(true), 380);
    return () => clearTimeout(t);
  }, [isActive, isAudioLoading]);
  const insets = useSafeAreaInsets();
  const kbAnim = useRef(new Animated.Value(0)).current;
  const [positionMs, setPositionMs] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const [isTitleExpanded, setIsTitleExpanded] = useState(false);

  const [imgLoadFailed, setImgLoadFailed] = useState(false);
  // Safety net: force a re-render once warmSoundImageMap() finishes.
  const [, forceReelUpdate] = useState(0);
  useEffect(() => subscribeToWarm(() => { setImgLoadFailed(false); forceReelUpdate(n => n + 1); }), []);
  // Also retry when this specific image finishes caching (handles the race where reel opens before cache warms)
  useEffect(() => {
    const rawUri = SOUND_IMAGES[sound.id] ?? (sound as any).imageUri;
    if (!rawUri) return;
    return subscribeToImageCached(rawUri, () => { setImgLoadFailed(false); forceReelUpdate(n => n + 1); });
  }, [sound.id]);

  const imgBundled = SOUND_BUNDLED_IMAGES[sound.id];
  const rawReelUri = SOUND_IMAGES[sound.id] ?? (sound as any).imageUri;
  const imgUri = !imgBundled ? (rawReelUri ? getLocalSoundImageUri(rawReelUri) : undefined) : undefined;

  // Prefer the direct rawReelUri as fallback so image shows immediately even before
  // the local file is ready — avoids blank frames during warm-up.
  const imgSource = imgBundled ?? (imgUri ? { uri: imgUri } : (rawReelUri ? { uri: rawReelUri } : undefined));
  // On error, retry using rawReelUri directly (remote URL fallback).
  const finalSource = imgLoadFailed
    ? (rawReelUri ? { uri: rawReelUri } : undefined)
    : imgSource;

  // ── Duration picker state (Calm-style unified control) ──────────────────
  const [durationOpen, setDurationOpen] = useState(false);
  const [selectedDurationId, setSelectedDurationId] = useState<DurationId>(isNight ? 'night' : '1h');
  // Reset duration picker when sound changes
  useEffect(() => { setSelectedDurationId(isNight ? 'night' : '1h'); setDurationOpen(false); }, [sound.id, isNight]);

  // ── Instagram-style play/pause tap overlay ─────────────────────────────
  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (playTapTimerRef.current) clearTimeout(playTapTimerRef.current);
    };
  }, []);
  const playTapAnim = useRef(new Animated.Value(0)).current;
  const playTapScaleAnim = useRef(new Animated.Value(0.6)).current;
  const playTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Glow breath animation (own dedicated value — avoids meteringAnim crash) ──
  const glowBreathAnim = useRef(new Animated.Value(0)).current;

  // ── Premium multi-layer pulse animations — 5 independent rings ──
  const pulse1 = useRef(new Animated.Value(0)).current;
  const pulse2 = useRef(new Animated.Value(0)).current;
  const pulse3 = useRef(new Animated.Value(0)).current;
  const pulse4 = useRef(new Animated.Value(0)).current;
  const pulse5 = useRef(new Animated.Value(0)).current;

  // Zoom in / zoom out — clean cinematic breathe effect (no pan, just scale)
  const kbScale = kbAnim.interpolate({ inputRange: [0, 1], outputRange: [1.0, 1.12] });
  // Keep pan values zeroed — pure zoom only
  const kbTransX = kbAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0] });
  const kbTransY = kbAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0] });

  // Zoom-in / Zoom-out cinematic breathe — faster 5 s in, 5 s out, seamless loop
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    kbAnim.stopAnimation(() => {
      if (!isActive) {
        kbAnim.setValue(0);
        return;
      }
      kbAnim.setValue(0);
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(kbAnim, {
            toValue: 1, duration: 5000,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(kbAnim, {
            toValue: 0, duration: 5000,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
    });
    return () => { loop?.stop(); kbAnim.stopAnimation(); };
  }, [isActive]);

  // ── 5 staggered pulse loops — each ring has its own rhythm/speed ──
  useEffect(() => {
    const loops: Animated.CompositeAnimation[] = [];
    if (!isActive || !isPlaying || isPaused) {
      [pulse1, pulse2, pulse3, pulse4, pulse5].forEach(p => { p.stopAnimation(); p.setValue(0); });
      return;
    }
    // Ring 1 — slowest, outermost — deep breath
    pulse1.setValue(0);
    const l1 = Animated.loop(Animated.sequence([
      Animated.timing(pulse1, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(pulse1, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])); l1.start(); loops.push(l1);
    // Ring 2 — slightly faster, offset with delay
    pulse2.setValue(0);
    const l2 = Animated.loop(Animated.sequence([
      Animated.delay(320),
      Animated.timing(pulse2, { toValue: 1, duration: 2100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(pulse2, { toValue: 0, duration: 2100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])); l2.start(); loops.push(l2);
    // Ring 3 — mid rhythm
    pulse3.setValue(0);
    const l3 = Animated.loop(Animated.sequence([
      Animated.delay(640),
      Animated.timing(pulse3, { toValue: 1, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(pulse3, { toValue: 0, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])); l3.start(); loops.push(l3);
    // Ring 4 — faster inner pulse
    pulse4.setValue(0);
    const l4 = Animated.loop(Animated.sequence([
      Animated.delay(960),
      Animated.timing(pulse4, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(pulse4, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])); l4.start(); loops.push(l4);
    // Ring 5 — fastest, innermost — heartbeat
    pulse5.setValue(0);
    const l5 = Animated.loop(Animated.sequence([
      Animated.delay(1280),
      Animated.timing(pulse5, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(pulse5, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])); l5.start(); loops.push(l5);
    return () => { loops.forEach(l => l.stop()); [pulse1, pulse2, pulse3, pulse4, pulse5].forEach(p => p.stopAnimation()); };
  }, [isActive, isPlaying, isPaused]);

  // ── Scrubber drag state & Stall Detection ──────────────────────────────────
  const isDragging = useRef(false);
  const dragFraction = useRef(new Animated.Value(0)).current;
  const [isScrubbing, setIsScrubbing] = useState(false);
  const scrubFractionRef = useRef(0);
  const [scrubPositionMs, setScrubPositionMs] = useState(0);
  const prevPositionMsRef = useRef(0);
  const stallCountRef = useRef(0);
  const [isAudioStalled, setIsAudioStalled] = useState(false);
  const trackDurMsRef = useRef(0);
  const trackWRef = useRef(0);
  const seekToRef = useRef(seekTo);

  const controlsAnim = useRef(new Animated.Value(1)).current;
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintAnim = useRef(new Animated.Value(0)).current;
  const bumpControlsRef = useRef(() => {
    // Stop any in-flight animation before starting new one — prevents native driver crash
    controlsAnim.stopAnimation(() => {
      if (!isMountedRef.current) return;
      Animated.timing(controlsAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    });
    if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null; }
  });

  // Poll audio position every 500ms for the real-time progress bar + stall detection
  useEffect(() => {
    if (!isActive || !isPlaying || isPaused) {
      stallCountRef.current = 0;
      setIsAudioStalled(false);
      return;
    }
    stallCountRef.current = 0;
    prevPositionMsRef.current = getPositionMs();
    const interval = setInterval(() => {
      const newPos = getPositionMs();
      setPositionMs(newPos);
      // Stall detection: if position hasn't advanced for 2 s (4 × 500 ms)
      // and the track has a known duration, audio is buffering/stuck
      if (trackDurMsRef.current > 0) {
        if (newPos === prevPositionMsRef.current) {
          stallCountRef.current += 1;
          if (stallCountRef.current >= 4) setIsAudioStalled(true);
        } else {
          stallCountRef.current = 0;
          setIsAudioStalled(false);
        }
      }
      prevPositionMsRef.current = newPos;
    }, 500);
    return () => {
      clearInterval(interval);
      setIsAudioStalled(false);
      stallCountRef.current = 0;
    };
  }, [isActive, isPlaying, isPaused, getPositionMs]);

  useEffect(() => {
    controlsAnim.stopAnimation(() => {
      Animated.timing(controlsAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    });
    if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null; }
    return () => { if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null; } };
  }, [isActive, isPlaying, isPaused]);

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    hintAnim.stopAnimation(() => {
      if (!isActive || isLast) { hintAnim.setValue(0); return; }
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(hintAnim, { toValue: -6, duration: 500, useNativeDriver: true }),
          Animated.timing(hintAnim, { toValue: 0,  duration: 500, useNativeDriver: true }),
          Animated.delay(2200),
        ])
      );
      loop.start();
    });
    return () => { loop?.stop(); hintAnim.stopAnimation(); };
  }, [isActive, isLast]);

  // glowBreathAnim kept (declared above) but its solo effect is replaced by the 5-ring pulse system

  // Progress bar: track width = full reel width minus horizontal padding (24 each side)
  const TRACK_W = REEL_W - 48;
  const trackDurMs = (playingDurationSecs ?? 0) * 1000;
  const loopProgress = trackDurMs > 0 ? Math.min(1, positionMs / trackDurMs) : 0;
  useEffect(() => {
    // Don't animate while user is dragging — they control position directly
    if (isDragging.current) return;
    progressAnim.stopAnimation();
    Animated.timing(progressAnim, {
      toValue: loopProgress,
      duration: 450,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
  }, [loopProgress]);

  // For ambient looping sounds (no known duration), run a gentle shimmer on progressAnim
  useEffect(() => {
    if (trackDurMs > 0 || !isActive || !isPlaying || isPaused) return;
    let loop: Animated.CompositeAnimation | null = null;
    progressAnim.stopAnimation(() => {
      progressAnim.setValue(0);
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(progressAnim, { toValue: 0.65, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
          Animated.timing(progressAnim, { toValue: 0.05, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        ])
      );
      loop!.start();
    });
    return () => { loop?.stop(); progressAnim.stopAnimation(); };
  }, [trackDurMs, isActive, isPlaying, isPaused]);

  // ── Scrubber drag state ──────────────────────────────────────────────────
  // (Declarations moved to top of component to satisfy React hook ordering and TDZ rules)
  useEffect(() => { trackDurMsRef.current = trackDurMs; }, [trackDurMs]);
  useEffect(() => { trackWRef.current = TRACK_W; }, [TRACK_W]);
  useEffect(() => { seekToRef.current = seekTo; }, [seekTo]);

  const scrubPan = useRef(
    PanResponder.create({
      // Only claim the gesture if there's a known duration to scrub
      onStartShouldSetPanResponder: () => trackDurMsRef.current > 0,
      // Only steal clearly horizontal gestures — vertical swipes go to the reel FlatList
      onMoveShouldSetPanResponder: (_, gs) =>
        trackDurMsRef.current > 0 &&
        Math.abs(gs.dx) > Math.abs(gs.dy) &&
        Math.abs(gs.dx) > 4,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        if (trackDurMsRef.current <= 0) return;
        const TW = trackWRef.current;
        if (TW <= 0) return;
        const rawX = evt.nativeEvent.locationX;
        if (rawX == null || !isFinite(rawX)) return;
        // Stop any running progressAnim before entering scrub mode
        progressAnim.stopAnimation();
        isDragging.current = true;
        bumpControlsRef.current();
        const x = Math.max(0, Math.min(rawX, TW));
        const fraction = x / TW;
        dragFraction.setValue(fraction);
        scrubFractionRef.current = fraction;
        setScrubPositionMs(Math.round(fraction * trackDurMsRef.current));
        setIsScrubbing(true);
      },
      onPanResponderMove: (evt) => {
        const TW = trackWRef.current;
        if (TW <= 0) return;
        const rawX = evt.nativeEvent.locationX;
        if (rawX == null || !isFinite(rawX)) return;
        const x = Math.max(0, Math.min(rawX, TW));
        const fraction = x / TW;
        if (!isFinite(fraction)) return;
        dragFraction.setValue(fraction);
        scrubFractionRef.current = fraction;
        setScrubPositionMs(Math.round(fraction * trackDurMsRef.current));
      },
      onPanResponderRelease: (evt) => {
        const TW = trackWRef.current;
        const rawX = evt?.nativeEvent?.locationX;
        // Use ref (not state) — PanResponder closure would capture stale state
        let fraction = scrubFractionRef.current;
        if (rawX != null && isFinite(rawX) && TW > 0) {
          fraction = Math.max(0, Math.min(1, rawX / TW));
          scrubFractionRef.current = fraction;
        }
        const ms = Math.round(fraction * trackDurMsRef.current);
        // Snap progressAnim to the scrubbed position
        progressAnim.setValue(fraction);
        isDragging.current = false;
        setIsScrubbing(false);
        setScrubPositionMs(ms);
        setPositionMs(ms);
        stallCountRef.current = 0;
        setIsAudioStalled(false);
        if (isFinite(ms) && ms >= 0) {
          seekToRef.current(ms).catch(() => {});
        }
      },
      onPanResponderTerminate: () => {
        isDragging.current = false;
        setIsScrubbing(false);
      },
    })
  ).current;

  return (
    <View style={{ width: REEL_W, height: REEL_H, backgroundColor: '#000' }}>

      {/* ── FULL-SCREEN background image with Ken Burns zoom/pan ── */}
      {finalSource ? (
        <View style={[StyleSheet.absoluteFillObject, { overflow: 'hidden' }]}>
          <Animated.View style={[
            StyleSheet.absoluteFillObject,
            { transform: [{ scale: kbScale }, { translateX: kbTransX }, { translateY: kbTransY }] },
          ]}>
            <Image
              source={finalSource}
              style={{ width: REEL_W, height: REEL_H }}
              resizeMode="cover"
              onError={() => setImgLoadFailed(true)}
            />
          </Animated.View>
        </View>
      ) : (
        <LinearGradient
          colors={[(sound.color ?? '#333333') + '40', sound.top ?? '#050505', sound.bot ?? '#000000', '#000']}
          locations={[0, 0.3, 0.7, 1]}
          style={StyleSheet.absoluteFillObject}
        />
      )}

      {/* ── Cinematic scrims ── */}
      {/* Top gradient: strong dark cover for category strip + top bar readability */}
      <LinearGradient
        colors={['rgba(0,0,0,0.6)', 'rgba(0,0,0,0.2)', 'transparent']}
        locations={[0, 0.3, 1]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      {/* Bottom gradient: starts low so most of the background image is visible */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.30)', 'rgba(0,0,0,0.80)', 'rgba(0,0,0,0.97)']}
        locations={[0.52, 0.70, 0.86, 1]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      {/* ── Premium multi-layer glowing pulsing visualizer — vibrant hero style ── */}
      {(() => {
        const baseSize = REEL_W * 0.58;
        const ringColor = accentColor || sound.color;
        // Derive 3 harmonious colors from the accent for a multicolor layered feel
        const c1 = ringColor;        // primary accent
        const c2 = sound.color;      // sound's own tint
        const c3 = '#ffffff';        // white glint

        const rings = [
          // [pulseAnim, sizeMult, baseOpacityMin, baseOpacityMax, colorHex, scaleMin, scaleMax, borderWidth]
          { anim: pulse1, sm: 1.15, oMin: 0.05, oMax: 0.25, color: c1, sMin: 0.92, sMax: 1.08, bw: 1 },
          { anim: pulse2, sm: 0.92, oMin: 0.10, oMax: 0.40, color: c2, sMin: 0.94, sMax: 1.06, bw: 1.5 },
          { anim: pulse3, sm: 0.72, oMin: 0.25, oMax: 0.65, color: c1, sMin: 0.96, sMax: 1.04, bw: 2 },
          { anim: pulse4, sm: 0.54, oMin: 0.45, oMax: 0.85, color: c2, sMin: 0.97, sMax: 1.03, bw: 3 },
          { anim: pulse5, sm: 0.38, oMin: 0.60, oMax: 1.00, color: c3, sMin: 0.98, sMax: 1.02, bw: 4 },
        ];

        return (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              width: baseSize, height: baseSize,
              left: (REEL_W - baseSize) / 2,
              top: (REEL_H - baseSize) / 2 - REEL_H * 0.05,
              zIndex: 2,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            {rings.map((r, i) => {
              const s = baseSize * r.sm;
              return (
                <Animated.View
                  key={i}
                  style={{
                    position: 'absolute',
                    width: s, height: s,
                    borderRadius: s / 2,
                    backgroundColor: 'transparent',
                    borderWidth: r.bw,
                    borderColor: r.color,
                    shadowColor: r.color,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.8,
                    shadowRadius: 15,
                    opacity: r.anim.interpolate({ inputRange: [0, 1], outputRange: [r.oMin, r.oMax] }),
                    transform: [{ scale: r.anim.interpolate({ inputRange: [0, 1], outputRange: [r.sMin, r.sMax] }) }],
                  }}
                >
                  {/* Subtle inner fill so it doesn't wash out the image but still has body */}
                  <View style={{
                    ...StyleSheet.absoluteFillObject,
                    backgroundColor: r.color,
                    opacity: 0.06,
                    borderRadius: s / 2,
                  }} />
                </Animated.View>
              );
            })}
          </View>
        );
      })()}

      {/* ── Full-screen tap to toggle play/pause — Instagram style ── */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => {
          bumpControlsRef.current();
          if (durationOpen) { setDurationOpen(false); return; }
          isPlaying ? onToggle() : onPlay();
          // Instagram flash: scale in, hold, fade out
          playTapScaleAnim.setValue(0.6);
          playTapAnim.setValue(0);
          Animated.parallel([
            Animated.timing(playTapAnim, { toValue: 1, duration: 140, useNativeDriver: true }),
            Animated.spring(playTapScaleAnim, { toValue: 1, tension: 200, friction: 8, useNativeDriver: true }),
          ]).start();
          if (playTapTimerRef.current) clearTimeout(playTapTimerRef.current);
          playTapTimerRef.current = setTimeout(() => {
            Animated.timing(playTapAnim, { toValue: 0, duration: 380, useNativeDriver: true }).start();
          }, 1100);
        }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 3 }}
      />

      {/* Instagram-style center play/pause icon — flashes on tap, fades away */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
          alignItems: 'center', justifyContent: 'center',
          zIndex: 6,
          opacity: playTapAnim,
          transform: [{ scale: playTapScaleAnim }],
        }}
      >
        <View style={{
          width: 78, height: 78, borderRadius: 39,
          backgroundColor: 'rgba(0,0,0,0.52)',
          alignItems: 'center', justifyContent: 'center',
          borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
        }}>
          <Ionicons
            name={isPlaying && !isPaused ? 'pause' : 'play'}
            size={36}
            color="rgba(255,255,255,0.92)"
            style={{ marginLeft: isPlaying && !isPaused ? 0 : 4 }}
          />
        </View>
      </Animated.View>

      {/* ── Premium bottom player bar ── */}
      <Animated.View
        pointerEvents="box-none"
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          paddingHorizontal: 24,
          paddingBottom: Platform.OS === 'android' ? Math.max(insets.bottom + 8, 48) : Math.max(insets.bottom + 8, 18),
          zIndex: 8, opacity: controlsAnim,
        }}
      >
        {/* ── Duration picker sheet — Calm-style, floats above the pill ── */}
        {durationOpen && (
          <View style={{
            marginBottom: 10,
            backgroundColor: 'rgba(6,7,18,0.97)',
            borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
            overflow: 'hidden',
            shadowColor: '#000', shadowOpacity: 0.85, shadowRadius: 30,
            shadowOffset: { width: 0, height: 10 }, elevation: 28,
          }}>
            {/* Subtle top tint */}
            <LinearGradient
              colors={[sound.color + '20', 'transparent']}
              start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
              style={[StyleSheet.absoluteFillObject, { height: 60 }]}
            />
            <Text style={{ fontSize: 9, fontWeight: '800', color: 'rgba(255,255,255,0.22)', letterSpacing: 2.8, textAlign: 'center', paddingTop: 16, paddingBottom: 10 }}>STOP AFTER</Text>
            {activeDurationOptions.map((opt, idx) => {
              const isSelected = selectedDurationId === opt.id;
              const isFirst = idx === 0;
              return (
                <TouchableOpacity
                  key={opt.id}
                  onPress={() => {
                    setSelectedDurationId(opt.id);
                    setDurationOpen(false);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onChangeTimer(opt.secs);
                  }}
                  activeOpacity={0.72}
                  style={{
                    flexDirection: 'row', alignItems: 'center',
                    paddingHorizontal: 20, paddingVertical: 13, gap: 14,
                    backgroundColor: isSelected ? sound.color + '18' : 'transparent',
                    borderTopWidth: isFirst ? 0 : 0.5,
                    borderTopColor: 'rgba(255,255,255,0.06)',
                  }}
                >
                  <View style={{
                    width: 36, height: 36, borderRadius: 18,
                    backgroundColor: isSelected ? sound.color + '28' : 'rgba(255,255,255,0.05)',
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: isSelected ? 1 : 0,
                    borderColor: isSelected ? sound.color + '60' : 'transparent',
                  }}>
                    <Ionicons name={opt.icon} size={17} color={isSelected ? sound.color : 'rgba(255,255,255,0.40)'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: isSelected ? '700' : '400', color: isSelected ? '#FFFFFF' : 'rgba(255,255,255,0.82)', letterSpacing: -0.1 }}>{opt.label}</Text>
                    <Text style={{ fontSize: 11, color: isSelected ? sound.color + 'AA' : 'rgba(255,255,255,0.28)', marginTop: 1 }}>{opt.sub}</Text>
                  </View>
                  {isSelected && (
                    <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: sound.color + '30', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="checkmark" size={13} color={sound.color} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
            <View style={{ height: 10 }} />
          </View>
        )}

        {/* Title row + playing status badge */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
          <Pressable
            // @ts-ignore - RN Web hover props
            onHoverIn={() => setIsTitleExpanded(true)}
            onHoverOut={() => setIsTitleExpanded(false)}
            onPressIn={() => setIsTitleExpanded(true)}
            onPressOut={() => setIsTitleExpanded(false)}
            style={{ flex: 1, marginRight: 10 }}
          >
            <Text style={{ fontSize: 22, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.4 }} numberOfLines={isTitleExpanded ? undefined : 1}>
              {sound.label}
            </Text>
          </Pressable>
          {isPlaying && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: isPaused ? 'rgba(255,255,255,0.28)' : sound.color }} />
              <Text style={{ fontSize: 9, fontWeight: '700', color: isPaused ? 'rgba(255,255,255,0.30)' : sound.color, letterSpacing: 1.8 }}>
                {isPaused ? 'PAUSED' : 'PLAYING'}
              </Text>
            </View>
          )}
        </View>
        <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.40)', marginBottom: 14, lineHeight: 16 }} numberOfLines={1}>
          {sound.desc}
        </Text>

        {/* ── Real-time scrubber — only visible when track duration is known ── */}
        {trackDurMs > 0 ? (
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.60)', letterSpacing: 0.3 }}>
                {fmtTimer(Math.round((isScrubbing ? scrubPositionMs : positionMs) / 1000))}
              </Text>
              <Text style={{ fontSize: 11, fontWeight: '500', color: 'rgba(255,255,255,0.28)', letterSpacing: 0.3 }}>
                {fmtTimer(playingDurationSecs ?? 0)}
              </Text>
            </View>
            {/*
              Crash-proof Instagram-style scrubber:
              ─ Fill uses Animated.View `width` (JS driver, safe in FlatList)
              ─ Thumb is a plain `View` with JS-computed `left` via scrubPositionMs
                so it NEVER mixes native/JS drivers on the same animated node.
              ─ panHandlers on outer View captures locationX relative to the track.
            */}
            <View
              style={{ height: 36, justifyContent: 'center' }}
              {...scrubPan.panHandlers}
              hitSlop={{ top: 14, bottom: 14, left: 4, right: 4 }}
              collapsable={false}
            >
              {/* Track rail */}
              <View style={{
                height: isScrubbing ? 5 : 3,
                borderRadius: 3,
                backgroundColor: 'rgba(255,255,255,0.14)',
                width: TRACK_W,
                overflow: 'visible',
              }}>
                {/* Filled portion — Animated.View with JS-driver `width` only */}
                <Animated.View style={{
                  position: 'absolute',
                  left: 0, top: 0, bottom: 0,
                  borderRadius: 3,
                  backgroundColor: sound.color,
                  width: (isScrubbing ? dragFraction : progressAnim).interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, TRACK_W],
                    extrapolate: 'clamp',
                  }),
                }} />
              </View>
              {/* Thumb — plain View, position derived from scrubPositionMs/positionMs state.
                  Using a regular View avoids ANY animated node driver conflict. */}
              {(() => {
                const ms = isScrubbing ? scrubPositionMs : positionMs;
                const dur = trackDurMsRef.current;
                const thumbFrac = dur > 0 ? Math.min(1, Math.max(0, ms / dur)) : 0;
                const thumbLeft = thumbFrac * TRACK_W;
                const thumbSize = isScrubbing ? 20 : 14;
                return (
                  <View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      // Vertically center on track (32px height, track is 3–5px)
                      top: (36 - thumbSize) / 2,
                      left: thumbLeft - thumbSize / 2,
                      width: thumbSize,
                      height: thumbSize,
                      borderRadius: thumbSize / 2,
                      backgroundColor: '#FFFFFF',
                      shadowColor: sound.color,
                      shadowOpacity: isScrubbing ? 0.95 : 0.80,
                      shadowRadius: isScrubbing ? 10 : 6,
                      shadowOffset: { width: 0, height: 0 },
                      elevation: 8,
                      transform: [{ scale: isScrubbing ? 1.2 : 1 }],
                    }}
                  />
                );
              })()}
            </View>
          </View>
        ) : (
          /* Looping ambient sound — subtle shimmer bar, JS-driver width */
          <View style={{ height: 2, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.10)', marginBottom: 16 }}>
            <Animated.View style={{
              position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: 2,
              backgroundColor: sound.color + '60',
              width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: [0, TRACK_W] }),
            }} />
          </View>
        )}

        {/* ── Single Duration Pill — Calm-style clean control ── */}
        {(() => {
          const opt = activeDurationOptions.find(o => o.id === selectedDurationId) ?? (activeDurationOptions.find(o => o.id === '1h') || activeDurationOptions[0]);
          return (
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setDurationOpen(v => !v); }}
              activeOpacity={0.78}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                gap: 8, alignSelf: 'center',
                paddingHorizontal: 22, paddingVertical: 11, borderRadius: 99,
                backgroundColor: durationOpen ? sound.color + '22' : 'rgba(255,255,255,0.08)',
                borderWidth: 1,
                borderColor: durationOpen ? sound.color + '70' : 'rgba(255,255,255,0.14)',
                marginBottom: 12,
                overflow: 'hidden',
              }}
            >
              <LinearGradient
                colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.02)']}
                start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <Ionicons
                name={opt.icon}
                size={15}
                color={durationOpen ? sound.color : 'rgba(255,255,255,0.70)'}
              />
              <Text style={{ fontSize: 13, fontWeight: '600', color: durationOpen ? '#FFFFFF' : 'rgba(255,255,255,0.85)', letterSpacing: 0.1 }}>
                {opt.label}
              </Text>
              <Ionicons
                name={durationOpen ? 'chevron-down' : 'chevron-up'}
                size={12}
                color={durationOpen ? sound.color + 'BB' : 'rgba(255,255,255,0.30)'}
              />
            </TouchableOpacity>
          );
        })()}

        {/* Swipe hint */}
        {isActive && !isLast && (
          <Animated.View style={{ alignItems: 'center', marginTop: 2, transform: [{ translateY: hintAnim }] }}>
            <Ionicons name="chevron-up" size={14} color="rgba(255,255,255,0.45)" />
            <Text style={{ fontSize: 9, fontWeight: '600', color: 'rgba(255,255,255,0.45)', letterSpacing: 2.5, marginTop: 1, textTransform: 'uppercase' }}>Swipe up for next</Text>
          </Animated.View>
        )}
      </Animated.View>

      {/* ── Loading overlay — appears after 380ms while remote audio is buffering ── */}
      {isActive && showLoadingOverlay && (
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          alignItems: 'center', justifyContent: 'center', zIndex: 18,
        }} pointerEvents="none">
          <View style={{
            width: 80, height: 80, borderRadius: 40,
            backgroundColor: 'rgba(0,0,0,0.62)',
            borderWidth: 1.5, borderColor: sound.color + '55',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <ActivityIndicator size="large" color={sound.color} />
          </View>
          <Text style={{
            marginTop: 12, fontSize: 10, color: 'rgba(255,255,255,0.48)',
            fontWeight: '600', letterSpacing: 1.5,
          }}>LOADING</Text>
        </View>
      )}

      {/* ── Buffering overlay — shown when stream stalls mid-play (slow network) ── */}
      {isActive && isAudioStalled && !showLoadingOverlay && !audioNetworkError && (
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          alignItems: 'center', justifyContent: 'center', zIndex: 18,
        }} pointerEvents="none">
          <View style={{
            width: 80, height: 80, borderRadius: 40,
            backgroundColor: 'rgba(0,0,0,0.62)',
            borderWidth: 1.5, borderColor: sound.color + '55',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <ActivityIndicator size="large" color={sound.color} />
          </View>
          <Text style={{
            marginTop: 12, fontSize: 10, color: 'rgba(255,255,255,0.48)',
            fontWeight: '600', letterSpacing: 1.5,
          }}>BUFFERING</Text>
        </View>
      )}

      {/* ── No-internet overlay — shown when remote audio fails to load ── */}
      {isActive && audioNetworkError && (
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 20, alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.78)',
        }}>
          <View style={{
            alignItems: 'center', paddingHorizontal: 28, paddingVertical: 26,
            backgroundColor: 'rgba(10,10,18,0.93)',
            borderRadius: 24, borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.10)',
            marginHorizontal: 32, overflow: 'hidden',
          }}>
            <LinearGradient
              colors={[sound.color + '18', 'transparent']}
              style={StyleSheet.absoluteFillObject}
              pointerEvents="none"
            />
            <View style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 1.5,
              backgroundColor: sound.color + '65',
            }} />
            <View style={{
              width: 66, height: 66, borderRadius: 33,
              backgroundColor: sound.color + '16', borderWidth: 1.5,
              borderColor: sound.color + '40', alignItems: 'center',
              justifyContent: 'center', marginBottom: 16,
            }}>
              <Ionicons name="cloud-offline-outline" size={30} color={sound.color} />
            </View>
            <Text style={{
              fontSize: 18, fontWeight: '700', color: '#FFFFFF',
              letterSpacing: -0.3, marginBottom: 6, textAlign: 'center',
            }}>No Internet</Text>
            <Text style={{
              fontSize: 12, color: 'rgba(255,255,255,0.40)',
              textAlign: 'center', lineHeight: 18, marginBottom: 22,
            }}>
              This sound streams online.{'\n'}Connect to WiFi or mobile data to play.
            </Text>
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onPlay(); }}
              style={{
                paddingHorizontal: 28, paddingVertical: 12, borderRadius: 99,
                backgroundColor: sound.color + '20',
                borderWidth: 1.5, borderColor: sound.color + '70',
                flexDirection: 'row', alignItems: 'center', gap: 8,
              }}
              activeOpacity={0.72}
            >
              <Ionicons name="refresh" size={14} color={sound.color} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: sound.color, letterSpacing: 0.2 }}>
                Try Again
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const REEL_CAT_META: Record<string, { emoji: string; color: string }> = {
  Nature:      { emoji: '🍃', color: '#86efac' },
  Ragas:       { emoji: '🎵', color: '#f59e0b' },
  Sleep:       { emoji: '🌙', color: '#60a5fa' },
  Meditations: { emoji: '🕉️', color: '#c084fc' },
  Birds:       { emoji: '🐦', color: '#fde68a' },
};

function VeenaIcon({ size = 23, color = '#7A9A7A', filled = false }: {
  size?: number; color?: string; filled?: boolean;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <SvgCircle cx="16" cy="16" r="6" fill={filled ? color : 'none'} stroke={color} strokeWidth={filled ? 0 : 1.6} />
      <Path d="M11.8 11.8 L5.2 5.2" stroke={color} strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <SvgCircle cx="3.5" cy="3.5" r="2.8" fill={filled ? color : 'none'} stroke={color} strokeWidth={filled ? 0 : 1.5} />
      {!filled && (
        <>
          <Path d="M12.8 13.5 L6.5 7.2" stroke={color} strokeWidth="0.55" opacity="0.55" fill="none" />
          <Path d="M14 14.5 L7.7 8.2" stroke={color} strokeWidth="0.55" opacity="0.55" fill="none" />
        </>
      )}
    </Svg>
  );
}

// ─── Instagram-style bottom progress bar for reels ────────────────────────────
// Uses pixel values (not %-strings) so it works correctly on all RN versions.
function ReelProgressBar({ progress, color }: { progress: number; color: string }) {
  const fillW = Math.max(0, Math.min(1, progress)) * REEL_W;
  const dotLeft = Math.max(0, fillW - 5);
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute', bottom: 0, left: 0,
        width: REEL_W, height: 3,
        backgroundColor: 'rgba(255,255,255,0.07)',
        zIndex: 20,
      }}
    >
      {/* Fill bar */}
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: fillW, borderRadius: 2, backgroundColor: color + '90' }} />
      {/* Glow dot at the leading edge */}
      <View style={{
        position: 'absolute',
        left: dotLeft,
        top: -3.5, width: 10, height: 10,
        borderRadius: 5,
        backgroundColor: color,
        shadowColor: color, shadowOpacity: 0.90, shadowRadius: 7, shadowOffset: { width: 0, height: 0 },
        elevation: 6,
      }} />
    </View>
  );
}

function SoundReelsModal({
  visible, startIndex, playingId, isPaused, sessionSecs, stopIdx,
  onPlaySound, onToggle, onStop, onStopSilent, onClose, onChangeTimer,
}: {
  visible: boolean; startIndex: number;
  playingId: string | null; isPaused: boolean; sessionSecs: number; stopIdx: number;
  onPlaySound: (id: string) => void; onToggle: () => void; onStop: () => void;
  onStopSilent: () => void;
  onClose: (fromLastReel: boolean) => void; onChangeTimer: (i: number) => void;
}) {
  const { preBufferSound, cleanPreBuffer } = useSoundPlayer();
  const flatRef = useRef<FlatList>(null);
  const [activeIndex, setActiveIndex] = useState(startIndex);
  const [showClosePrompt, setShowClosePrompt] = useState(false);
  const [catBanner, setCatBanner] = useState<{ text: string; emoji: string; color: string } | null>(null);
  const bannerAnim = useRef(new Animated.Value(0)).current;
  const swipeAnim = useRef(new Animated.Value(0)).current;
  const prevCatRef = useRef(REELS_ALL_SOUNDS[startIndex]?.cat ?? '');
  const activeIndexRef = useRef(startIndex);
  const playDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Gate: false while FlatList is scrolling to initialScrollIndex so onViewableItemsChanged
  // doesn't fire for items 0-4 (rendered first by initialNumToRender) and trigger the wrong sound.
  const isScrollReadyRef = useRef(startIndex === 0);
  // Always-fresh ref so debounce callback reads current playingId, not stale closure
  const playingIdRef = useRef(playingId);
  useEffect(() => { playingIdRef.current = playingId; }, [playingId]);

  // ── Grid browse state ────────────────────────────────────
  const [gridOpen, setGridOpen] = useState(false);
  const catStartIndices = useMemo(() => {
    const map: Record<string, number> = {};
    REELS_ALL_SOUNDS.forEach((s, i) => { if (map[s.cat] === undefined) map[s.cat] = i; });
    return map;
  }, []);
  const scrollToCategory = useCallback((cat: string) => {
    const idx = catStartIndices[cat];
    if (idx != null) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setGridOpen(false);
      activeIndexRef.current = idx;
      setActiveIndex(idx);
      setTimeout(() => { flatRef.current?.scrollToIndex({ index: idx, animated: false }); }, 60);
    }
  }, [catStartIndices]);

  // Swipe hint animation (pulsing triple-chevron)
  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(swipeAnim, { toValue: -8, duration: 600, useNativeDriver: true }),
        Animated.timing(swipeAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
        Animated.delay(2000),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible]);

  // Reset + focus-in haptic when modal becomes visible; clear debounce on close
  useEffect(() => {
    if (visible) {
      // Block viewability callbacks until the FlatList settles on the correct index
      isScrollReadyRef.current = false;
      setActiveIndex(startIndex);
      activeIndexRef.current = startIndex;
      lastAutoPlayedRef.current = null; // allow auto-play to fire for new open
      prevCatRef.current = REELS_ALL_SOUNDS[startIndex]?.cat ?? '';
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // Use scrollToOffset for instant, jank-free positioning — no layout pass needed
      const offset = startIndex * REEL_H;
      flatRef.current?.scrollToOffset({ offset, animated: false });
      // Double-fire after one frame to handle cases where the FlatList hasn't mounted yet
      const t1 = setTimeout(() => {
        flatRef.current?.scrollToOffset({ offset, animated: false });
      }, 50);
      const t2 = setTimeout(() => {
        isScrollReadyRef.current = true; // ungate viewability
      }, 120);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    } else {
      // Focus-out: cancel any pending auto-play timer
      if (playDebounceRef.current) {
        clearTimeout(playDebounceRef.current);
        playDebounceRef.current = null;
        onStopSilentRef.current();
      }
    }
  }, [visible, startIndex]);

  // Pre-cache images for current + next 2 reels so swipe transitions never show an empty image
  useEffect(() => {
    if (!visible) return;
    const ahead = [activeIndex, activeIndex + 1, activeIndex + 2];
    ahead.forEach(i => {
      const s = REELS_ALL_SOUNDS[i];
      if (!s) return;
      const rawUri = SOUND_IMAGES[s.id] ?? (s as any).imageUri;
      if (rawUri && !SOUND_BUNDLED_IMAGES[s.id] && !isSoundImageCached(rawUri)) {
        ensureSoundImageCached(rawUri).catch(() => {});
      }
    });
  }, [activeIndex, visible]);

  // Pre-buffer AUDIO for adjacent reels — Instagram-style instant playback on swipe.
  // createAsync (~500ms cold) is replaced by a near-instant playAsync() on pre-loaded sounds.
  useEffect(() => {
    if (!visible) return;
    [activeIndex + 1, activeIndex + 2, activeIndex - 1].forEach(i => {
      const s = REELS_ALL_SOUNDS[i];
      if (s) preBufferSound(s).catch(() => {});
    });
  }, [activeIndex, visible]);

  // Release pre-buffered sounds when modal closes (free native audio memory)
  useEffect(() => {
    if (!visible) { cleanPreBuffer().catch(() => {}); }
  }, [visible]);

  // Auto-play: immediately stop old sound on swipe, debounce start of new sound.
  // Uses playingIdRef (not prop) so the timeout callback always sees the freshest value.
  const onStopSilentRef = useRef(onStopSilent);
  useEffect(() => { onStopSilentRef.current = onStopSilent; }, [onStopSilent]);
  const onPlaySoundRef = useRef(onPlaySound);
  useEffect(() => { onPlaySoundRef.current = onPlaySound; }, [onPlaySound]);

  // Track the last sound we auto-played so we don't re-trigger on visibility toggle
  const lastAutoPlayedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!visible) return;
    // Guard: on modal open, activeIndexRef.current is updated SYNCHRONOUSLY to startIndex
    // but activeIndex (state) still holds the previous stale value until the next render.
    // Skipping until they match prevents sound[old-index] (e.g. rain at index 0) from
    // playing for ~200ms before the intended reel's auto-play fires.
    if (activeIndex !== activeIndexRef.current) return;
    const sound = REELS_ALL_SOUNDS[activeIndex];
    if (!sound) return;
    if (playingIdRef.current !== sound.id && lastAutoPlayedRef.current !== sound.id) {
      lastAutoPlayedRef.current = sound.id;
      onPlaySoundRef.current(sound.id);
    }
  }, [activeIndex, visible]);

  // Category banner animation
  const showCatBannerRef = useRef<(cat: string, s: PlayableSoundMeta) => void>(() => {});
  showCatBannerRef.current = (cat: string, s: PlayableSoundMeta) => {
    setCatBanner({ text: cat, emoji: s.emoji, color: s.color });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    bannerAnim.stopAnimation(() => {
      bannerAnim.setValue(0);
      Animated.sequence([
        Animated.spring(bannerAnim, { toValue: 1, tension: 80, friction: 10, useNativeDriver: true }),
        Animated.delay(2000),
        Animated.timing(bannerAnim, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setCatBanner(null);
      });
    });
  };

  const onViewRef = useRef(({ viewableItems }: any) => {
    if (!isScrollReadyRef.current) return; // suppress during initial scroll-to-startIndex
    if (viewableItems?.length > 0) {
      const idx = viewableItems[0].index;
      if (idx != null && idx !== activeIndexRef.current) {
        activeIndexRef.current = idx;
        setActiveIndex(idx);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); // focus-in per reel
        const sound = REELS_ALL_SOUNDS[idx];
        if (sound && sound.cat !== prevCatRef.current) {
          prevCatRef.current = sound.cat;
          showCatBannerRef.current(sound.cat, sound);
        }
      }
    }
  });
  const viewConfigRef = useRef({ viewAreaCoveragePercentThreshold: 25 });

  if (!visible) return null;

  const activeSound = REELS_ALL_SOUNDS[activeIndex];
  const isLast = activeIndex === REELS_ALL_SOUNDS.length - 1;
  const isFirst = activeIndex === 0;
  const progress = (activeIndex + 1) / REELS_ALL_SOUNDS.length;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} statusBarTranslucent navigationBarTranslucent onRequestClose={() => setShowClosePrompt(true)}>
      <ScreenErrorBoundary name="SoundReels">
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <FlatList
          ref={flatRef}
          data={REELS_ALL_SOUNDS}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          pagingEnabled
          bounces={false}
          overScrollMode="never"
          // ── Instagram scroll strategy ─────────────────────────────────────
          // onScroll: haptic feedback ONLY — no setState. Calling setActiveIndex
          // every 16ms forces React to re-render the entire tree on every frame,
          // which is the primary cause of FlatList jank.
          // onViewableItemsChanged (25% threshold) owns setActiveIndex for the
          // mid-swipe update. onMomentumScrollEnd is the guaranteed safety-net
          // that fires once after pagingEnabled snaps to a new page.
          onScroll={(e) => {
            const y = e.nativeEvent.contentOffset.y;
            const idx = Math.round(y / REEL_H);
            if (idx !== activeIndexRef.current && idx >= 0 && idx < REELS_ALL_SOUNDS.length) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
          }}
          scrollEventThrottle={150}
          onMomentumScrollEnd={(e) => {
            const y = e.nativeEvent.contentOffset.y;
            const idx = Math.round(y / REEL_H);
            if (idx >= 0 && idx < REELS_ALL_SOUNDS.length && idx !== activeIndexRef.current) {
              activeIndexRef.current = idx;
              setActiveIndex(idx);
            }
          }}
          disableIntervalMomentum
          onViewableItemsChanged={onViewRef.current}
          viewabilityConfig={viewConfigRef.current}
          getItemLayout={(_, index) => ({ length: REEL_H, offset: REEL_H * index, index })}
          onScrollToIndexFailed={(info) => {
            flatRef.current?.scrollToOffset({ offset: REEL_H * info.index, animated: false });
          }}
          initialScrollIndex={startIndex > 0 ? startIndex : undefined}
          initialNumToRender={startIndex > 0 ? 1 : 3}
          windowSize={7}
          maxToRenderPerBatch={2}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews={true}
          renderItem={({ item, index }) => (
            <ScreenErrorBoundary name={`ReelCard-${item.id}`}>
              <ReelCard
                sound={item}
                isActive={activeIndex === index}
                isPlaying={playingId === item.id}
                isPaused={isPaused && playingId === item.id}
                sessionSecs={playingId === item.id ? sessionSecs : 0}
                stopIdx={stopIdx}
                onPlay={() => onPlaySound(item.id)}
                onToggle={onToggle}
                onStop={onStop}
                onChangeTimer={onChangeTimer}
                isFirst={index === 0}
                isLast={index === REELS_ALL_SOUNDS.length - 1}
                onPrev={() => index > 0 && flatRef.current?.scrollToIndex({ index: index - 1, animated: true })}
                onNext={() => index < REELS_ALL_SOUNDS.length - 1 && flatRef.current?.scrollToIndex({ index: index + 1, animated: true })}
              />
            </ScreenErrorBoundary>
          )}
        />

        {/* ── Persistent top scrim — always visible regardless of reel image brightness ── */}
        <LinearGradient
          colors={['rgba(0,0,0,0.86)', 'rgba(0,0,0,0.52)', 'rgba(0,0,0,0.18)', 'rgba(0,0,0,0.00)']}
          locations={[0, 0.38, 0.72, 1]}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 220, zIndex: 9 }}
          pointerEvents="none"
        />

        {/* ── Top bar overlay ── */}
        <SafeAreaView edges={['top']} style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 18, paddingTop: 10, paddingBottom: 8,
          }}>
            {/* Left: chevron-down collapse */}
            <TouchableOpacity
              onPress={() => setShowClosePrompt(true)}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="chevron-down" size={24} color="rgba(255,255,255,0.80)" />
            </TouchableOpacity>

            {/* Center: Empty to keep UI clean, elegant and uncluttered */}
            <View style={{ flex: 1 }} />

            {/* Right: sleep page browse button */}
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onClose(false); }}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="apps-outline" size={20} color="rgba(255,255,255,0.80)" />
            </TouchableOpacity>
          </View>

          {/* ── Category selector — elegant pill layout ── */}
          <View style={{ paddingBottom: 10, marginTop: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, width: '100%' }}>
              {TAB_CATEGORIES.map(cat => {
                const isActive = activeSound?.cat === cat;
                const meta = REEL_CAT_META[cat] ?? { color: '#FFFFFF' };
                const catIcon = (CAT_ICONS[cat] ?? 'apps') as any;
                return (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => scrollToCategory(cat)}
                    activeOpacity={0.70}
                    style={{
                      flexDirection: 'row', gap: 6,
                      paddingHorizontal: 14, paddingVertical: 8,
                      borderRadius: 20,
                      alignItems: 'center', justifyContent: 'center',
                      backgroundColor: isActive ? meta.color + '28' : 'rgba(255,255,255,0.05)',
                      borderWidth: 1,
                      borderColor: isActive ? meta.color + '65' : 'rgba(255,255,255,0.1)',
                      shadowColor: isActive ? meta.color : 'transparent',
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: isActive ? 0.4 : 0,
                      shadowRadius: 8,
                    }}
                  >
                    {cat === 'Birds' || cat === 'Meditations' ? (
                      <MaterialCommunityIcons name={catIcon} size={12} color={isActive ? meta.color : 'rgba(255,255,255,0.45)'} />
                    ) : (
                      <Ionicons name={catIcon} size={12} color={isActive ? meta.color : 'rgba(255,255,255,0.45)'} />
                    )}
                    <Text style={{ fontSize: 11, fontWeight: isActive ? '700' : '500', color: isActive ? meta.color : 'rgba(255,255,255,0.55)', fontFamily: isActive ? 'Nunito_700Bold' : 'Nunito_400Regular', letterSpacing: 0.2 }}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </SafeAreaView>

        {/* ── Bottom progress rail — Instagram style, pixel-based ── */}
        <ReelProgressBar
          progress={progress}
          color={activeSound?.color ?? '#fff'}
        />


        {/* ── Category transition banner ── */}
        {catBanner && (
          <>
            {/* Full-screen tint flash */}
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 18,
                backgroundColor: catBanner.color + '22',
                opacity: bannerAnim.interpolate({ inputRange: [0, 0.25, 0.75, 1], outputRange: [0, 1, 1, 0] }),
              }}
            />
            {/* Sliding "NOW ENTERING" banner */}
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute', top: 88, left: 16, right: 16, zIndex: 20,
                opacity: bannerAnim,
                transform: [
                  { translateY: bannerAnim.interpolate({ inputRange: [0, 1], outputRange: [-28, 0] }) },
                  { scale: bannerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
                ],
              }}
            >
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 14,
                backgroundColor: 'rgba(0,0,0,0.78)',
                borderWidth: 1.5, borderColor: catBanner.color + '65',
                borderRadius: 20, paddingHorizontal: 20, paddingVertical: 14,
                overflow: 'hidden',
              }}>
                <LinearGradient
                  colors={[catBanner.color + '35', catBanner.color + '08', 'transparent']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFillObject}
                />
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, backgroundColor: catBanner.color + '85' }} />
                <Text style={{ fontSize: 34 }}>{catBanner.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 8.5, fontWeight: '900', color: catBanner.color + 'BB', letterSpacing: 2.2, marginBottom: 4 }}>
                    NOW ENTERING
                  </Text>
                  <Text style={{ fontSize: 21, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.2 }}>
                    {catBanner.text}
                  </Text>
                </View>
                <View style={{ alignItems: 'center', gap: 3 }}>
                  <Text style={{ fontSize: 8, color: 'rgba(255,255,255,0.30)', letterSpacing: 0.5 }}>scroll</Text>
                  <Text style={{ fontSize: 18, color: catBanner.color }}>↓</Text>
                </View>
              </View>
            </Animated.View>
          </>
        )}

        {/* ── Grid Browse Overlay ── */}
        {gridOpen && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(4,6,20,0.97)', zIndex: 30 }}>
            <SafeAreaView edges={['top']} style={{ flex: 1 }}>
              {/* Header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14 }}>
                <View>
                  <Text style={{ fontSize: 19, fontWeight: '900', color: '#FFFFFF' }}>Browse Sounds</Text>
                  <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', marginTop: 2 }}>{REELS_ALL_SOUNDS.length} sounds · tap any to play instantly</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setGridOpen(false)}
                  style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name="close" size={20} color="rgba(255,255,255,0.80)" />
                </TouchableOpacity>
              </View>

              {/* Category sections */}
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                {(CATEGORIES.slice(1) as string[]).map(cat => {
                  const catSounds = REELS_ALL_SOUNDS.filter(s => s.cat === cat);
                  if (!catSounds.length) return null;
                  const meta = REEL_CAT_META[cat] ?? { emoji: '🎵', color: '#FFFFFF' };
                  return (
                    <View key={cat} style={{ marginBottom: 26 }}>
                      {/* Section header */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, marginBottom: 10 }}>
                        <Text style={{ fontSize: 15 }}>{meta.emoji}</Text>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: '#FFFFFF' }}>{cat}</Text>
                        <View style={{ flex: 1, height: 0.5, backgroundColor: meta.color + '40', marginLeft: 4 }} />
                        <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.30)' }}>{catSounds.length}</Text>
                      </View>
                      {/* Horizontal sound pills */}
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
                        {catSounds.map(sound => {
                          const idx = REELS_ALL_SOUNDS.indexOf(sound);
                          const isNowPlaying = playingId === sound.id;
                          return (
                            <TouchableOpacity
                              key={sound.id}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                setGridOpen(false);
                                activeIndexRef.current = idx;
                                setActiveIndex(idx);
                                setTimeout(() => { flatRef.current?.scrollToIndex({ index: idx, animated: false }); }, 80);
                              }}
                              style={{
                                flexDirection: 'row', alignItems: 'center', gap: 8,
                                paddingHorizontal: 13, paddingVertical: 10, borderRadius: 14,
                                borderWidth: 1,
                                borderColor: isNowPlaying ? sound.color + '80' : 'rgba(255,255,255,0.12)',
                                backgroundColor: isNowPlaying ? sound.color + '1A' : 'rgba(255,255,255,0.06)',
                                minWidth: 100,
                              }}
                            >
                              <Text style={{ fontSize: 17 }}>{sound.emoji}</Text>
                              <View style={{ flexShrink: 1 }}>
                                <MarqueeText style={{ fontSize: 11, fontWeight: '700', color: isNowPlaying ? sound.color : '#FFFFFFEE' }} active={isNowPlaying} duration={6000}>
                                  {sound.label}
                                </MarqueeText>
                                {isNowPlaying && (
                                  <Text style={{ fontSize: 7, color: sound.color, fontWeight: '900', letterSpacing: 0.5 }}>▶ PLAYING</Text>
                                )}
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  );
                })}
              </ScrollView>
            </SafeAreaView>
          </View>
        )}

        {/* iOS Style Action Popup */}
        {showClosePrompt && (
          <View style={[StyleSheet.absoluteFillObject, { zIndex: 999, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' }]}>
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
            <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setShowClosePrompt(false)} />
            
            <View style={{ width: 300, backgroundColor: 'rgba(25,25,25,0.85)', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
              <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFillObject} />
              
              <View style={{ padding: 22, alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.1)' }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#FFF', marginBottom: 8, fontFamily: 'Nunito_700Bold' }}>Keep Listening?</Text>
                <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', textAlign: 'center', fontFamily: 'Nunito_400Regular', lineHeight: 20 }}>Would you like to minimize this reel and keep the audio playing, or stop playback entirely?</Text>
              </View>
              
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowClosePrompt(false);
                  onClose(isLast);
                }}
                style={{ paddingVertical: 16, alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.03)' }}
              >
                <Text style={{ fontSize: 17, color: '#0A84FF', fontWeight: '600', fontFamily: 'Nunito_600SemiBold' }}>Minimize (Keep Playing)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowClosePrompt(false);
                  onStop();
                  onClose(isLast);
                }}
                style={{ paddingVertical: 16, alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,0,50,0.08)' }}
              >
                <Text style={{ fontSize: 17, color: '#FF453A', fontWeight: '600', fontFamily: 'Nunito_600SemiBold' }}>Stop Audio & Close</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowClosePrompt(false);
                }}
                style={{ paddingVertical: 16, alignItems: 'center' }}
              >
                <Text style={{ fontSize: 17, color: 'rgba(255,255,255,0.9)', fontWeight: '600', fontFamily: 'Nunito_600SemiBold' }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
      </ScreenErrorBoundary>
    </Modal>
  );
}

function SleepTabInner() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { openReel } = useLocalSearchParams<{ openReel?: string }>();
  const { bgUri, accentColor, gradientStart, solarTimes } = useBgContext();
  const [now, setNow] = useState(new Date());
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<TextInput>(null);

  const filteredSearchSounds = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const lowerQ = searchQuery.toLowerCase();
    const matches = ALL_SOUNDS_LIST.filter(s => 
      !SLEEP_HIDDEN_IDS.has(s.id) &&
      ((s.label?.toLowerCase() || '').includes(lowerQ) || (s.cat?.toLowerCase() || '').includes(lowerQ))
    );
    const unique = [];
    const seen = new Set();
    for (const s of matches) {
      if (!seen.has(s.label)) {
        seen.add(s.label);
        unique.push(s);
      }
    }
    return unique.sort((a, b) => (a.label || '').localeCompare(b.label || ''));
  }, [searchQuery]);

  // ── Global sound player (context) ──────────────────────────
  const { playingId, isPaused, sessionSecs, playingDurationSecs: sleepTabDurationSecs, togglePause, stopSound, changeTimer, playSound, pendingOpenReels, clearPendingOpenReels } = useSoundPlayer();

  // ── Settings ───────────────────────────────────────────────
  const [wakeHour,      setWakeHour]      = useState(DEFAULT_ALARM_SETTINGS.wakeAlarm.hour);
  const [wakeMinute,    setWakeMinute]    = useState(DEFAULT_ALARM_SETTINGS.wakeAlarm.minute);
  const [bedtimeAlert,  setBedtimeAlert]  = useState(false);
  const [eveningMantra, setEveningMantra] = useState(false);

  // ── Sound UI state ─────────────────────────────────────────
  const [stopIdx,      setStopIdx]      = useState(0);
  const [category,     setCategory]     = useState<Category>('Meditations');
  const [selectedCat,  setSelectedCat]  = useState<Category>('Meditations');
  const [catSheetOpen, setCatSheetOpen] = useState(false);

  // ── Category swipe + transitions ────────────────────────────
  const contentFadeAnim  = useRef(new Animated.Value(1)).current;
  const contentSlideAnim = useRef(new Animated.Value(0)).current;
  const stripScrollRef  = useRef<any>(null);
  const [rowsResetKey, setRowsResetKey] = useState(0);
  const hasRowResetRef = useRef(false);
  // scrollY drives the JS-based sticky strip (replaces stickyHeaderIndices)
  const scrollY  = useRef(new Animated.Value(0)).current;
  const [searchBarH, setSearchBarH] = useState(60); // measured via onLayout on search bar


  useFocusEffect(useCallback(() => {
    _pageScrollRef?.scrollTo({ y: 0, animated: false });
    setRowsResetKey(k => k + 1);
    hasRowResetRef.current = false;
    setIsSearching(false);
    setSearchQuery('');
  }, []));

  const onMainScroll = useMemo(() => Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    {
      useNativeDriver: true,
      listener: (e: any) => {
        const y = e.nativeEvent.contentOffset.y;
        if (y > 250 && !hasRowResetRef.current) {
          hasRowResetRef.current = true;
          setRowsResetKey(k => k + 1);
        } else if (y < 50) {
          hasRowResetRef.current = false;
        }
      }
    }
  ), [scrollY]);


  const changeCategory = useCallback((cat: Category, dir: number = 0) => {
    // Instant opacity drop then smooth fade in
    contentFadeAnim.setValue(0.4);
    Animated.timing(contentFadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic),
    }).start();

    if (dir !== 0) {
      // Wider slide offset for a more pronounced, page-like transition
      contentSlideAnim.setValue(-dir * W * 0.15);
      Animated.spring(contentSlideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 24,
        stiffness: 220,
        mass: 0.5,
      }).start();
    }
    startTransition(() => {
      setSelectedCat(cat);
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [contentFadeAnim, contentSlideAnim]);

  useEffect(() => {
    _pageScrollRef?.scrollTo({ y: 0, animated: true });
  }, [selectedCat]);

  // Removed buggy contentPan logic in favor of FlingGestureHandler.
  const [localSolarTimes, setLocalSolarTimes]   = useState<SolarTimes | null>(null);
  const [sleepIntelOpen, setSleepIntelOpen] = useState(false);
  const chevronAnim = useRef(new Animated.Value(0)).current;
  const [cyclesOpen, setCyclesOpen] = useState(false);
  const cyclesChevronAnim = useRef(new Animated.Value(0)).current;
  const [nightSettingsOpen, setNightSettingsOpen] = useState(false);
  const nightChevronAnim = useRef(new Animated.Value(0)).current;
  const bedtimeAutoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Auto-start ─────────────────────────────────────────────
  const [showAutoStart, setShowAutoStart] = useState(false);
  const [autoEnabled,   setAutoEnabled]   = useState(false);
  const [autoHour,      setAutoHour]      = useState(22);
  const [autoMinute,    setAutoMinute]    = useState(30);
  const [autoSoundId,   setAutoSoundId]   = useState<SoundId>('light_rain');

  // ── Reels state ───────────────────────────────────────────
  const [showReels,      setShowReels]      = useState(false);
  const [reelsStartIdx,  setReelsStartIdx]  = useState(0);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (showReels) {
          setShowReels(false);
          return true;
        }
        if (catSheetOpen) {
          setCatSheetOpen(false);
          return true;
        }
        if (isSearching) {
          setIsSearching(false);
          setSearchQuery('');
          return true;
        }
        if (libraryOpen) {
          setLibraryOpen(false);
          return true;
        }
        router.navigate('/(tabs)');
        return true;
      };
      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [showReels, catSheetOpen, isSearching, libraryOpen, router])
  );
  // null = use category default (Meditations → once, others → loop)
  const reelLoopModeRef = useRef<boolean | null>(null);

  // ── Open reel from home page "Listen & Recharge" button ──────────────────
  useEffect(() => {
    if (openReel === '1') {
      const ragaIdx = REELS_ALL_SOUNDS.findIndex(s => s.cat === 'Ragas');
      setReelsStartIdx(ragaIdx !== -1 ? ragaIdx : 0);
      setCategory('Ragas');
      setSelectedCat('Ragas');
      setShowReels(true);
      router.setParams({ openReel: undefined });
    }
  }, [openReel]);

  // ── Re-open reels from GlobalPlayerBar compact player tap ──────────────────
  // pendingOpenReels is incremented by openReelsOrPlayer() in the context.
  // Using a counter (not a boolean) means repeated taps always trigger the effect.
  // This is race-condition-free: no callback ref, no setTimeout, no registration.
  const reelsPlayingIdRef = useRef<string | null>(null);
  useEffect(() => { reelsPlayingIdRef.current = playingId; }, [playingId]);
  useEffect(() => {
    if (!pendingOpenReels) return;
    clearPendingOpenReels();
    const idx = REELS_ALL_SOUNDS.findIndex(s => s.id === reelsPlayingIdRef.current);
    const startIdx = idx !== -1 ? idx : 0;
    [-1, 0, 1, 2, 3].forEach(offset => {
      const adj = REELS_ALL_SOUNDS[startIdx + offset];
      if (!adj) return;
      const adjUri = SOUND_IMAGES[adj.id] ?? (adj as any).imageUri;
      if (adjUri && !SOUND_BUNDLED_IMAGES[adj.id] && !isSoundImageCached(adjUri)) {
        ensureSoundImageCached(adjUri).catch(() => {});
      }
    });
    setReelsStartIdx(startIdx);
    setShowReels(true);
  }, [pendingOpenReels]);

  // ── Live clock ──────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // ── Pre-warm + download persistent image cache ────────────────────────────
  useEffect(() => {
    warmSoundImageMap().then(() => {
      prefetchAllSoundImages(15);
    });
  }, []);

  // ── Init ───────────────────────────────────────────────────
  useEffect(() => {
    store.getJSON<AlarmSettings>(KEYS.alarmSettings).then(s => {
      if (s?.wakeAlarm) { setWakeHour(s.wakeAlarm.hour); setWakeMinute(s.wakeAlarm.minute); }
      setEveningMantra(s?.eveningMantra ?? false);
    });
    store.getJSON<{ lat: number; lon: number }>(KEYS.location).then(loc => {
      if (loc?.lat && loc?.lon) setLocalSolarTimes(getSolarTimes(loc.lat, loc.lon));
    }).catch(() => {});
  }, []);

  // Audio cache init (reads existing index — does NOT download anything)
  useEffect(() => { initAudioCache().catch(() => {}); }, []);

  // ── Play from sleep screen (opens Reels immediately, no pre-mood) ──────────
  // NOTE: No direct playSound call here. SoundReelsModal's auto-play effect owns
  // ALL audio start/stop so there is never a concurrent stopAllRefs race.
  // Instagram-style: open the modal INSTANTLY — cache images non-blocking in background.
  const handleSoundCardTap = useCallback((id: string) => {
    const reelIndex = REELS_ALL_SOUNDS.findIndex(s => s.id === id);
    if (reelIndex === -1) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setReelsStartIdx(reelIndex);
    setIsSearching(false);
    setSearchQuery('');
    // Open the modal immediately — Instagram style, no waiting
    setShowReels(true);
    // Non-blocking: cache this reel's image + adjacent reels in background
    const sound = REELS_ALL_SOUNDS[reelIndex];
    const rawUri = SOUND_IMAGES[sound.id] ?? (sound as any).imageUri;
    if (rawUri && !SOUND_BUNDLED_IMAGES[sound.id] && !isSoundImageCached(rawUri)) {
      ensureSoundImageCached(rawUri).catch(() => {});
    }
    [-1, 1, 2, 3].forEach(offset => {
      const adj = REELS_ALL_SOUNDS[reelIndex + offset];
      if (!adj) return;
      const adjUri = SOUND_IMAGES[adj.id] ?? (adj as any).imageUri;
      if (adjUri && !SOUND_BUNDLED_IMAGES[adj.id] && !isSoundImageCached(adjUri)) {
        ensureSoundImageCached(adjUri).catch(() => {});
      }
    });
  }, []);

  const getReelTrimSecs = (cat: string): number => {
    return 0;
  };

  // Reels: play a sound by id (used when swiping between reels — no mood re-ask)
  const handleReelPlaySound = useCallback((id: string) => {
    try {
      const meta = REELS_ALL_SOUNDS.find(s => s.id === id);
      if (meta) {
        // Reset loop mode on each new sound — user must explicitly choose Once/Loop per track
        reelLoopModeRef.current = null;
        const metaFull = { ...meta, imageUri: SOUND_IMAGES[id] ?? (meta as any).imageUri, imageBundled: SOUND_BUNDLED_IMAGES[id] ?? undefined };
        const trimSecs = getReelTrimSecs(meta.cat);
        const isNightTab = checkIsNightTime(solarTimes);
        const defaultDur = isNightTab ? 28800 : 3600;
        
        playSound(metaFull, defaultDur, undefined, trimSecs, true);
      }
    } catch (e) {
      console.warn('Error in handleReelPlaySound:', e);
    }
  }, [playSound, solarTimes]);

  // Reels: close handler — collapses reels to mini bar; sound keeps playing
  const handleReelClose = useCallback((_fromLastReel: boolean) => {
    setShowReels(false);
  }, []);

  const changeStopTimer = (idx: number) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (idx === -1) {
        // Meditation "Once" mode — use real sound duration, cap at 60 min
        reelLoopModeRef.current = false;
        const actualSecs = Math.min(sleepTabDurationSecs ?? 3600, 3600);
        changeTimer(actualSecs);
        if (playingId) {
          const meta = REELS_ALL_SOUNDS.find(s => s.id === playingId);
          if (meta) {
            const mf = { ...meta, imageUri: SOUND_IMAGES[playingId] ?? (meta as any).imageUri, imageBundled: SOUND_BUNDLED_IMAGES[playingId] ?? undefined };
            playSound(mf, actualSecs, undefined, 0, false); // 0 trim — play fully to end
          }
        }
      } else if (idx === -2) {
        // Meditation "Loop" mode — loop indefinitely (8 hr window)
        reelLoopModeRef.current = true;
        changeTimer(28800);
        if (playingId) {
          const meta = REELS_ALL_SOUNDS.find(s => s.id === playingId);
          if (meta) {
            const mf = { ...meta, imageUri: SOUND_IMAGES[playingId] ?? (meta as any).imageUri, imageBundled: SOUND_BUNDLED_IMAGES[playingId] ?? undefined };
            const trimSecs = getReelTrimSecs(meta.cat);
            playSound(mf, 28800, undefined, trimSecs, true);
          }
        }
      } else if (idx === -3) {
        // Auto-detect: silently update timer to real track duration, no restart
        const actualSecs = Math.min(sleepTabDurationSecs ?? 3600, 3600);
        changeTimer(actualSecs);
      } else if (idx > 200) {
        // Loop x N mode — idx encodes total seconds directly (computed in ReelCard)
        reelLoopModeRef.current = true;
        const totalSecs = idx;
        changeTimer(totalSecs);
        if (playingId) {
          const meta = REELS_ALL_SOUNDS.find(s => s.id === playingId);
          if (meta) {
            const mf = { ...meta, imageUri: SOUND_IMAGES[playingId] ?? (meta as any).imageUri, imageBundled: SOUND_BUNDLED_IMAGES[playingId] ?? undefined };
            const trimSecs = getReelTrimSecs(meta.cat);
            playSound(mf, totalSecs, undefined, trimSecs, true);
          }
        }
      } else {
        reelLoopModeRef.current = null;
        setStopIdx(idx);
        changeTimer(STOP_TIMES[idx].secs);
      }
    } catch (e) {
      console.warn('Error in changeStopTimer:', e);
    }
  };

  const toggleSleepIntel = () => {
    const opening = !sleepIntelOpen;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSleepIntelOpen(opening);
    Animated.timing(chevronAnim, { toValue: opening ? 1 : 0, duration: 240, useNativeDriver: true }).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const toggleCycles = () => {
    const opening = !cyclesOpen;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCyclesOpen(opening);
    Animated.timing(cyclesChevronAnim, { toValue: opening ? 1 : 0, duration: 240, useNativeDriver: true }).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const toggleNightSettings = () => {
    const opening = !nightSettingsOpen;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setNightSettingsOpen(opening);
    Animated.timing(nightChevronAnim, { toValue: opening ? 1 : 0, duration: 240, useNativeDriver: true }).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleStop = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    stopSound(true);
  }, [stopSound]);

  const handleStopSilent = useCallback(() => { stopSound(false); }, [stopSound]);

  // ── Evening mantra ─────────────────────────────────────────
  const scheduleEveningMantraNotif = async () => {
    try {
      await notifee.createChannel({ id: 'arise-habit-alarms', name: 'Nada Habit Alarms', importance: AndroidImportance.HIGH, bypassDnd: true, visibility: AndroidVisibility.PUBLIC } as any);
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
      await notifee.createChannel({ id: 'arise-habit-alarms', name: 'Nada Habit Alarms', importance: AndroidImportance.HIGH, bypassDnd: true, visibility: AndroidVisibility.PUBLIC } as any);
      const next = new Date(); next.setHours(autoHour, autoMinute, 0, 0);
      if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
      const meta = SLEEP_SOUNDS.find(s => s.id === autoSoundId)!;
      await notifee.createTriggerNotification(
        {
          id: 'sleep-autostart',
          title: `${meta.emoji}  Nāda`,
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

  // ── Ayurvedic GPS bedtime (sunset + 3.5h, clamped 9PM–11PM) ──
  const ayuBedtime = useMemo(() => {
    if (!solarTimes) return null;
    const dec   = Math.max(21, Math.min(23, solarTimes.sunset + 3.5));
    const total = Math.round(dec * 60);
    return { h: Math.floor(total / 60) % 24, m: total % 60 };
  }, [solarTimes]);

  const displayBedtime = ayuBedtime ?? bestBedtime;
  const displayBedMins = displayBedtime.h * 60 + displayBedtime.m;
  const minsUntilBed = displayBedMins > currentMins ? displayBedMins - currentMins : displayBedMins + 1440 - currentMins;
  const hrsToBed     = Math.floor(minsUntilBed / 60);
  const minsToBed    = minsUntilBed % 60;

  // Whether current time is inside the sleep window (between bedtime and wake time)
  const isSleepWindowActive = useMemo(() => {
    const displayBedMins = displayBedtime.h * 60 + displayBedtime.m;
    const wakeMins = wakeHour * 60 + wakeMinute;
    if (displayBedMins < wakeMins) {
      return currentMins >= displayBedMins && currentMins < wakeMins;
    } else {
      return currentMins >= displayBedMins || currentMins < wakeMins;
    }
  }, [displayBedtime, wakeHour, wakeMinute, currentMins]);

  const sunsetFmt = useMemo(() => {
    if (!solarTimes) return null;
    const h = Math.floor(solarTimes.sunset);
    const m = Math.round((solarTimes.sunset - h) * 60);
    return fmt12(h % 24, m);
  }, [solarTimes]);

  const playingSrc  = SLEEP_SOUNDS.find(s => s.id === playingId);
  const h           = now.getHours() + now.getMinutes() / 60;
  const autoMode    = useMemo(() => getAutoMode(h), [h]);
  const currentPeriod = useMemo(() => solarTimes ? getCurrentPeriod(solarTimes, h) : null, [solarTimes, h]);
  const isBrahmaMuhurta = currentPeriod?.id === 'night_vata';
  // ── Solar-period → SoundMode mapping — mirrors home page solar time period ──
  // When solar data is available, derive displayMode from the actual dosha period
  // so sleep header stays in sync with home hero ring & walk ring (same solar time).
  const solarDisplayMode = useMemo((): SoundMode => {
    if (isBrahmaMuhurta) return BRAHMA_MODE;
    if (!currentPeriod) return autoMode;
    switch (currentPeriod.id) {
      case 'morning_kapha_early':
      case 'morning_kapha':  return SOUND_MODES.morning;
      case 'midday_pitta':   return SOUND_MODES.focus;
      case 'afternoon_vata': return SOUND_MODES.restore;
      case 'evening_kapha':  return SOUND_MODES.evening;
      case 'night_pitta':    return SOUND_MODES.sleep;
      default:               return autoMode; // fallback for any unmapped id
    }
  }, [currentPeriod?.id, isBrahmaMuhurta, autoMode]);
  const displayMode = solarDisplayMode;

  const sacredHour = useMemo(() => {
    return solarTimes ? getSacredHourInfo(h, solarTimes) : { type: null, progress: 0 };
  }, [h, solarTimes]);

  const heroContent = useMemo(() => {
    if (sacredHour.type !== null) {
      return {
        subPill: sacredHour.type === 'sunrise' ? 'SACRED HOUR OF SUNRISE' :
                 sacredHour.type === 'sunset' ? 'SACRED HOUR OF SUNSET' : 'SACRED HOUR OF ZENITH',
        header: sacredHour.type === 'sunrise' ? 'Sun is Rising' :
                sacredHour.type === 'sunset' ? 'Sun is Setting' : 'Sun is at its Peak',
        actionText: 'Meditate now',
        sentence: 'Divine hour. Meditate and connect with the divinity.',
        sciLabel: 'Sacred Hour'
      };
    }
    if (!currentPeriod) return null;
    return getHeroRingContent(currentPeriod.id, currentPeriod.id === 'night_vata');
  }, [currentPeriod?.id, sacredHour.type]);

  const natureCategoryLabel = useMemo(() => {
    const periodId = currentPeriod?.id ?? AUTOMODE_TO_PERIOD[autoMode.key] ?? 'morning_kapha';
    switch (periodId) {
      case 'night_vata':        return 'The world sleeps... breathe with nature and ease into the dawn';
      case 'morning_kapha_early': return 'Morning rises... ground yourself and align with nature';
      case 'morning_kapha':     return 'Morning rises... listen to nature\'s sounds and align yourself';
      case 'midday_pitta':      return 'The sun peaks... ground yourself in nature\'s steady rhythm';
      case 'midday_pitta_late': return 'The afternoon drifts... let nature\'s sounds restore your calm';
      case 'afternoon_vata':    return 'The day softens... let nature\'s breeze quiet your mind';
      case 'evening_kapha':     return 'Evening descends... unwind with nature and release the day';
      case 'night_pitta':       return 'Night deepens... sleep wrapped in nature\'s sounds';
      default:                  return 'Let nature\'s sounds align your mind and body';
    }
  }, [currentPeriod?.id, autoMode.key]);
  const isNightTime = useMemo(() => {
    if (solarTimes) {
      const nowNorm = h < solarTimes.sunrise ? h + 24 : h;
      return nowNorm >= solarTimes.sunset + 2;
    }
    return autoMode.key === 'sleep';
  }, [solarTimes, h, autoMode]);

  // Show ideal sleep chip only within 1 hour of actual bedtime
  const showIdealSleepChip = useMemo(() => minsUntilBed <= 60 && !isSleepWindowActive, [minsUntilBed, isSleepWindowActive]);

  // Show "approaching sleep" strip after sunset but more than 1 hour before bed
  const showApproachingChip = useMemo(() => {
    if (showIdealSleepChip || isSleepWindowActive) return false;
    const nowDecH = now.getHours() + now.getMinutes() / 60;
    if (solarTimes) return nowDecH >= solarTimes.sunset || nowDecH < solarTimes.sunrise;
    return autoMode.key === 'evening' || autoMode.key === 'sleep';
  }, [now, solarTimes, autoMode, showIdealSleepChip, isSleepWindowActive]);
  const dayHint = useMemo(() => {
    const key = currentPeriod?.id ?? AUTOMODE_TO_PERIOD[autoMode.key] ?? 'morning_kapha';
    return PERIOD_DAY_HINTS[key] ?? null;
  }, [currentPeriod, autoMode]);

  const sectionInfo   = useMemo(() => {
    if (currentPeriod && PERIOD_SECTION_LABELS[currentPeriod.id]) {
      const base = PERIOD_SECTION_LABELS[currentPeriod.id];
      return { ...base, isNight: isNightTime };
    }
    if (isNightTime) return { title: 'For Your Night', icon: '🌙', isNight: true };
    return { title: 'Recommended Now', icon: autoMode.icon, isNight: false };
  }, [currentPeriod, autoMode, isNightTime]);
  const recSounds   = useMemo(() => {
    const periodKey = currentPeriod?.id ?? AUTOMODE_TO_PERIOD[autoMode.key] ?? autoMode.key;
    return ALL_SOUNDS_LIST.filter(s => {
      const p = SOUND_PERIODS[s.id];
      if (!p) return true;
      if (periodKey === 'night_vata') {
        if ((s as any).cat === 'Meditations') return true;
        return p.includes('night_vata') || p.includes('morning_kapha') || p.includes('morning_kapha_early');
      }
      if (periodKey === 'morning_kapha' || periodKey === 'morning_kapha_early') {
        if ((s as any).cat === 'Meditations') return true;
        return p.includes('morning_kapha') || p.includes('morning_kapha_early');
      }
      return p.includes(periodKey);
    }) as SoundItem[];
  }, [currentPeriod, autoMode]);
  const featuredSnd = playingSrc ?? (recSounds[0] ?? SLEEP_SOUNDS[0]);
  const bottomPad   = getTabBarClearance(insets.bottom, !!playingId);
  const autoMeta    = SLEEP_SOUNDS.find(s => s.id === autoSoundId)!
  const safeTop = Platform.OS === 'android' ? Math.max(insets.top, StatusBar.currentHeight ?? 0) : (insets.top ?? 44);

  // ── Hero greeting: Calm-style serif font, color shifts with scene ────────
  const heroTextStyle = useMemo(() => {
    const mode = displayMode.key;
    const color =
      mode === 'brahma'  ? '#E8F0FF' :  // pre-dawn cool white
      mode === 'morning' ? '#FFF8F0' :  // warm sunrise white
      mode === 'focus'   ? '#F5F8FF' :  // crisp midday white
      mode === 'restore' ? '#FFF4E8' :  // soft afternoon white
      mode === 'evening' ? '#FFF0D8' :  // golden dusk white
      '#EEEEFF';                        // night — moonlit white
    const shadowColor =
      mode === 'brahma'  ? 'rgba(0,0,20,0.70)'   :
      mode === 'morning' ? 'rgba(60,20,0,0.75)'  :
      mode === 'focus'   ? 'rgba(0,10,40,0.80)'  :
      mode === 'restore' ? 'rgba(60,30,0,0.72)'  :
      mode === 'evening' ? 'rgba(80,30,0,0.78)'  :
      'rgba(0,0,10,0.72)';
    return {
      fontSize: 20,
      fontWeight: '600' as const,
      letterSpacing: 0.5,
      color,
      textShadowColor: shadowColor,
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 12,
      textAlign: 'center' as const,
      fontFamily: 'DancingScript_600SemiBold',
    };
  }, [displayMode.key]);

  return (
    <ImageBackground
      source={bgUri ? { uri: bgUri } : undefined}
      style={[S.screen, { backgroundColor: bgUri ? accentColor : '#04040E' }]}
      imageStyle={{ opacity: 0.72, resizeMode: 'cover' }}>
      {/* Premium frosted-glass gradient overlay — lets background image breathe while keeping text readable */}
      <LinearGradient
        colors={[
          'rgba(0,0,0,0.08)',
          'rgba(0,0,0,0.18)',
          'rgba(0,0,0,0.28)',
          'rgba(0,0,0,0.48)',
        ]}
        locations={[0, 0.25, 0.60, 1]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      <StatusBar hidden={false} barStyle="light-content" translucent backgroundColor="transparent" />
      <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }} />



      {/* ── Content area — hero + JS-sticky tab strip + scroll ── */}
      <View style={{ flex: 1, zIndex: 1 }}>


        <Animated.View style={{ flex: 1, opacity: contentFadeAnim, transform: [{ translateX: contentSlideAnim }] }}>
        
        {/* Top Header Bar (Premium Square Edge-to-Edge) - Now Sticky Outside ScrollView */}
        <View 
          style={{ width: '100%', paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0, zIndex: 200 }}
          onLayout={(e) => setSearchBarH(e.nativeEvent.layout.height)}
        >
          <View style={{ borderRadius: 0, borderWidth: 0, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(0,0,0,0.22)', paddingBottom: 6 }}>
              <LinearGradient
                colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.03)', 'transparent']}
                start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                style={StyleSheet.absoluteFillObject} />
              {/* Bottom shimmer line hinting expansion */}
              <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.10)' }} />
              
              {/* Main row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 6, paddingBottom: 0, paddingRight: 14, gap: 10 }}>
                {/* Back Icon */}
                {isSearching ? (
                  <TouchableOpacity onPress={() => {
                    Keyboard.dismiss();
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setIsSearching(false);
                    setSearchQuery('');
                  }} activeOpacity={0.7} style={{ padding: 4, marginRight: 4 }}>
                    <Ionicons name="arrow-back" size={28} color="rgba(255,255,255,0.95)" />
                  </TouchableOpacity>
                ) : null}

                {/* Search Bar (Expands inline) */}
                <TouchableOpacity
                  onPress={() => { 
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); 
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setIsSearching(true); 
                  }}
                  activeOpacity={0.8}
                  style={isSearching ? {
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    height: 40,
                  } : {
                    marginLeft: 'auto',
                    padding: 8,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="search" size={isSearching ? 16 : 24} color="rgba(255,255,255,0.95)" />
                  {isSearching && (
                    <TextInput
                      ref={searchInputRef}
                      style={{ flex: 1, fontSize: 15, color: '#FFF', fontFamily: 'Nunito_400Regular', marginLeft: 10 }}
                      autoFocus
                      placeholder="Search sounds, ragas..."
                      placeholderTextColor="rgba(255,255,255,0.4)"
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      returnKeyType="search"
                    />
                  )}
                  {isSearching && searchQuery.length > 0 && (
                     <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
                       <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.5)" />
                     </TouchableOpacity>
                  )}
                </TouchableOpacity>

                {/* Cancel (only visible when searching) */}
                {isSearching && (
                  <TouchableOpacity 
                     onPress={() => {
                       Keyboard.dismiss();
                       LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                       setIsSearching(false);
                       setSearchQuery('');
                     }}
                     style={{ paddingVertical: 8, paddingLeft: 4 }}
                  >
                    <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14, fontFamily: 'Nunito_600SemiBold' }}>Cancel</Text>
                  </TouchableOpacity>
                )}

                {/* Nada Library Menu Icon on the right */}
                {!isSearching && (
                  <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setLibraryOpen(true); }} activeOpacity={0.7} style={{ padding: 4 }}>
                    <Ionicons name="menu-outline" size={30} color="rgba(255,255,255,0.95)" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

        {/* Category Tab Strip - Now Sticky Outside ScrollView */}
        {!isSearching && (
          <View style={{ zIndex: 100 }}>
            <CategoryTabStrip
              selectedCat={selectedCat}
              onSelect={changeCategory}
              activePeriodId={currentPeriod?.id ?? AUTOMODE_TO_PERIOD[autoMode.key]}
              onSettingsPress={() => { router.push('/(tabs)/settings' as never); }}
            />
          </View>
        )}

        <Animated.ScrollView
          ref={(r) => { _pageScrollRef = r; }}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: bottomPad }}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={8}
          onScroll={onMainScroll}
          overScrollMode="never"
          nestedScrollEnabled
          removeClippedSubviews
          keyboardShouldPersistTaps="handled"
        >

        {/* ── Hero area ── */}
        <View
          style={{ width: W, alignItems: 'center', paddingHorizontal: 0 }}
        >
          {!isSearching && (
            <View style={{
              width: '100%',
              paddingHorizontal: 24,
              paddingVertical: 40,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'transparent',
              gap: 16,
            }}>
              {/* Main title */}
              <Text style={[heroTextStyle, { fontSize: 24, letterSpacing: 1.2, fontFamily: 'Nunito_700Bold' }]}>
                {heroContent ? heroContent.header : displayMode.label}
              </Text>
              
              <View style={{ backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, marginTop: -2, marginBottom: 2 }}>
                <Text style={{ fontSize: 12.5, color: '#FFFFFF', fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>
                  {heroContent ? heroContent.actionText : 'Listen & tune in'}
                </Text>
              </View>

              {/* Subtitle / Status Text */}
              <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', letterSpacing: 0.5, fontWeight: '400', fontFamily: 'Nunito_400Regular', textAlign: 'center', marginTop: 2 }}>
                {heroContent ? heroContent.sentence : displayMode.subtitle}
              </Text>
            </View>
          )}
        </View>

        {/* Strip moved inline above */}

        {/* ── Content container — transparent, swipe handler for category change ── */}
        <FlingGestureHandler
          direction={Directions.LEFT}
          onHandlerStateChange={({ nativeEvent }) => {
            if (nativeEvent.state === State.ACTIVE) {
              const tabIdx = TAB_CATEGORIES.indexOf(selectedCat as any);
              if (tabIdx !== -1) {
                if (tabIdx < TAB_CATEGORIES.length - 1) {
                  changeCategory(TAB_CATEGORIES[tabIdx + 1] as Category, -1);
                } else {
                  changeCategory(TAB_CATEGORIES[0] as Category, -1);
                }
              }
            }
          }}
        >
          <FlingGestureHandler
            direction={Directions.RIGHT}
            onHandlerStateChange={({ nativeEvent }) => {
              if (nativeEvent.state === State.ACTIVE) {
                const tabIdx = TAB_CATEGORIES.indexOf(selectedCat as any);
                if (tabIdx !== -1) {
                  if (tabIdx > 0) {
                    changeCategory(TAB_CATEGORIES[tabIdx - 1] as Category, 1);
                  } else {
                    changeCategory(TAB_CATEGORIES[TAB_CATEGORIES.length - 1] as Category, 1);
                  }
                }
              }
            }}
          >
            <View style={{ backgroundColor: 'transparent', paddingTop: 4 }}>

        {isSearching ? (
          <View style={{ paddingHorizontal: 16, paddingBottom: 100, minHeight: H }}>
            {filteredSearchSounds.length > 0 ? (
              filteredSearchSounds.map((sound, idx) => {
                const isPlaying = playingId === sound.id;
                return (
                  <TouchableOpacity 
                    key={sound.id} 
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); handleSoundCardTap(sound.id); }} 
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.06)' }}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: sound.color ? sound.color + '20' : 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 18 }}>{sound.emoji || '🎵'}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 16 }}>
                      <MarqueeText style={{ fontSize: 16, fontWeight: '600', color: isPlaying ? (sound.color || '#FFF') : '#E5E5E5', marginBottom: 4, fontFamily: 'Nunito_600SemiBold' }} active={isPlaying} duration={8000}>{sound.label}</MarqueeText>
                      {sound.desc ? <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', fontFamily: 'Nunito_400Regular' }} numberOfLines={1}>{sound.desc}</Text> : null}
                    </View>
                    {isPlaying ? (
                      <Ionicons name="stats-chart" size={16} color={sound.color || '#FFF'} />
                    ) : (
                      <Ionicons name="play" size={16} color="rgba(255,255,255,0.2)" />
                    )}
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={{ alignItems: 'center', marginTop: 40 }}>
                <Ionicons name="search-outline" size={48} color="rgba(255,255,255,0.1)" style={{ marginBottom: 16 }} />
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15, fontFamily: 'Nunito_400Regular' }}>No sounds found for "{searchQuery}"</Text>
              </View>
            )}
          </View>
        ) : (
        <>
        <ScreenErrorBoundary name="CategoryRows">
          <CategoryRows
            playingId={playingId}
            isPaused={isPaused}
            sessionSecs={sessionSecs}
            onPress={handleSoundCardTap}
            selectedCat={selectedCat}
            onSelectCat={changeCategory}
            resetKey={rowsResetKey}
            natureLabel={natureCategoryLabel}
            activePeriodId={currentPeriod?.id ?? AUTOMODE_TO_PERIOD[autoMode.key]}
          />
        </ScreenErrorBoundary>


        {/* ── Sleep Cycles ── */}
        <TouchableOpacity onPress={toggleCycles} activeOpacity={0.75} style={S.secHeader}>
          <Text style={S.secTitle}>Sleep Cycles</Text>
          <Animated.View style={{ transform: [{ rotate: cyclesChevronAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }}>
            <Ionicons name="chevron-down" size={16} color="rgba(255,255,255,0.55)" />
          </Animated.View>
        </TouchableOpacity>
        {cyclesOpen && <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }} decelerationRate={0.88} bounces={false} overScrollMode="never" scrollEventThrottle={8}>
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
        </ScrollView>}

        {/* ── Night Settings ── */}
        <TouchableOpacity onPress={toggleNightSettings} activeOpacity={0.75} style={S.secHeader}>
          <Text style={S.secTitle}>Night Settings</Text>
          <Animated.View style={{ transform: [{ rotate: nightChevronAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }}>
            <Ionicons name="chevron-down" size={16} color="rgba(255,255,255,0.55)" />
          </Animated.View>
        </TouchableOpacity>
        {nightSettingsOpen && <View style={S.groupCard}>
          <LinearGradient
            colors={['rgba(255,255,255,0.07)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject} />
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
              <Text style={S.groupRowSub}>30 min before {fmt12(displayBedtime.h, displayBedtime.m)}</Text>
            </View>
            <Switch value={bedtimeAlert} onValueChange={v => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setBedtimeAlert(v); }}
              trackColor={{ false: '#222', true: SLEEP_COLOR + '80' }} thumbColor={bedtimeAlert ? SLEEP_COLOR : '#444'} />
          </View>
        </View>}

        {/* ── Sleep Science ── */}
        <TouchableOpacity onPress={toggleSleepIntel} activeOpacity={0.75} style={S.secHeader}>
          <Text style={S.secTitle}>Sleep Science</Text>
          <Animated.View style={{ transform: [{ rotate: chevronAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }}>
            <Ionicons name="chevron-down" size={16} color="rgba(255,255,255,0.55)" />
          </Animated.View>
        </TouchableOpacity>
        {sleepIntelOpen && SLEEP_TIPS.map((tip, i) => (
          <View key={i} style={S.tipCard}>
            <LinearGradient
              colors={['rgba(255,255,255,0.07)', 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject} />
            <View style={S.tipIconBox}>
              <Text style={{ fontSize: 18 }}>{tip.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={S.tipTitle}>{tip.title}</Text>
              <Text style={S.tipSub}>{tip.sub}</Text>
            </View>
          </View>
        ))}
        {sleepIntelOpen && <View style={S.scienceNote}>
          <Text style={S.scienceNoteTxt}>💡  Sleep cycles are ~90 min each. Waking between cycles — not mid-cycle — is what makes mornings effortless.</Text>
        </View>}
        </>
        )}

        </View>{/* end lifted container */}
          </FlingGestureHandler>
        </FlingGestureHandler>

      </Animated.ScrollView>
        </Animated.View>

      </View>{/* end content area */}


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
                {SLEEP_SOUNDS.filter(s => !SLEEP_HIDDEN_IDS.has(s.id)).map(s => {
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

      {/* ── Sound Reels Modal ── */}
      <SoundReelsModal
        visible={showReels}
        startIndex={reelsStartIdx}
        playingId={playingId}
        isPaused={isPaused}
        sessionSecs={sessionSecs}
        stopIdx={stopIdx}
        onPlaySound={handleReelPlaySound}
        onToggle={togglePause}
        onStop={handleStop}
        onStopSilent={handleStopSilent}
        onClose={handleReelClose}
        onChangeTimer={changeStopTimer}
      />

      {/* ── Sound Library Modal ── */}
      <SoundLibraryModal
        visible={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        sounds={ALL_SOUNDS_LIST}
        playingId={playingId}
        onPlaySound={(id) => {
          setLibraryOpen(false);
          handleSoundCardTap(id);
        }}
      />

  </ImageBackground>
  );
}

export default function SleepTab() {
  return (
    <ScreenErrorBoundary name="SleepTab">
      <SleepTabInner />
    </ScreenErrorBoundary>
  );
}

const S = StyleSheet.create({
  // ── Scaffold ──────────────────────────────────────────────
  screen:     { flex: 1, backgroundColor: '#04040E', overflow: 'hidden' }, // base fallback; actual bg set dynamically via bgUri/accentColor
  headerGrad: { backgroundColor: 'rgba(4,8,26,0.74)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.10)' },
  soundImgBg: { width: '100%', flex: 1 } as any,

  // ── Header ────────────────────────────────────────────────
  headerTop:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 2, paddingBottom: 2 },
  appName:      { fontSize: 15, fontWeight: '600', color: '#FFFFFF90', letterSpacing: 0.8, fontFamily: 'Nunito_600SemiBold' },
  wakeChip:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: SLEEP_COLOR + '14', borderWidth: 1, borderColor: SLEEP_COLOR + '30', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
  wakeChipTxt:  { fontSize: 10, fontWeight: '800', color: SLEEP_COLOR + 'CC', fontFamily: 'Nunito_800ExtraBold' },
  greeting:     { fontSize: 26, fontWeight: '100', color: '#fff', letterSpacing: -1.0, marginBottom: 2 },
  greetingSub:  { fontSize: 11, color: '#FFFFFF85', letterSpacing: 0.1 },
  bedtimePill:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: '#10b98110', borderWidth: 1, borderColor: '#10b98130', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start' },
  dot:          { width: 5, height: 5, borderRadius: 2.5 },

  // ── Section headers ────────────────────────────────────────
  secHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 26, paddingBottom: 14 },
  secTitle:  { fontSize: 12, fontWeight: '300', color: 'rgba(255,255,255,0.82)', letterSpacing: 0.4, fontFamily: 'Nunito_300Light' },
  secCount:  { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.58)' },

  // ── Tonight's Window inline strip ────────────────────────
  windowRow:      { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 14, borderRadius: 18, borderWidth: 1, borderColor: SLEEP_COLOR + '35', backgroundColor: 'rgba(4,12,28,0.72)', paddingHorizontal: 20, paddingVertical: 14 },
  windowCell:     { flex: 1 },
  windowDivider:  { width: 1, height: 36, backgroundColor: '#FFFFFF10', marginHorizontal: 16 },
  windowLabel:    { fontSize: 10, color: '#FFFFFF45', fontWeight: '600', marginBottom: 4 },
  windowTime:     { fontSize: 18, fontWeight: '700', letterSpacing: -0.5 },

  // ── Sleep Intelligence full card ──────────────────────────
  windowCard:     { marginHorizontal: 16, borderRadius: 24, borderWidth: 1.5, borderColor: SLEEP_COLOR + '35', backgroundColor: 'rgba(15,23,42,0.45)', padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 12 },
  sleepBar:       { height: 5, backgroundColor: '#FFFFFF08', borderRadius: 3, overflow: 'visible', position: 'relative', marginTop: 4 },
  sleepBarFill:   { position: 'absolute', left: 0, top: 0, bottom: 0, right: 0, borderRadius: 3 },
  sleepBarDot:    { position: 'absolute', top: -5, width: 15, height: 15, borderRadius: 8, borderWidth: 2.5, borderColor: '#000000' },
  barLabel:       { fontSize: 9, color: '#FFFFFF25', fontWeight: '700', letterSpacing: 0.3 },

  // ── Featured Hero Card ─────────────────────────────────────
  featuredCard:  { borderRadius: 24, overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(15,23,42,0.4)', padding: 18, height: 186, justifyContent: 'space-between', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 12 },
  featOrb1:      { position: 'absolute', top: -40, right: -30, width: 180, height: 180, borderRadius: 90 },
  featOrb2:      { position: 'absolute', bottom: -20, left: -10, width: 110, height: 110, borderRadius: 55 },
  featTopRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  featLiveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5 },
  featLiveDot:   { width: 6, height: 6, borderRadius: 3 },
  featLiveLabel: { fontSize: 9, fontWeight: '500', letterSpacing: 0.7, fontFamily: 'Nunito_600SemiBold' },
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
  themeCard:     { width: THEME_CARD_W, height: THEME_CARD_H, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(15,23,42,0.4)', justifyContent: 'flex-end', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 10 },
  themeOrb1:     { position: 'absolute', top: -30, right: -20, width: 110, height: 110, borderRadius: 55, opacity: 0.7 },
  themeOrb2:     { position: 'absolute', bottom: 10, left: -15, width: 70, height: 70, borderRadius: 35, opacity: 0.5 },
  themeContent:  { padding: 14, gap: 4 },
  themeSubtitle: { fontSize: 8, fontWeight: '400', letterSpacing: 0.8, fontFamily: 'Nunito_400Regular' },
  themeTitle:    { fontSize: 13, fontWeight: '300', color: '#fff', letterSpacing: -0.3 },
  themeTagRow:   { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start', marginTop: 2 },
  themeTagDot:   { width: 4, height: 4, borderRadius: 2 },
  themeTagTxt:   { fontSize: 9, fontWeight: '700' },
  themeArrow:    { position: 'absolute', top: 12, right: 12, width: 26, height: 26, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  // ── Sound grid ────────────────────────────────────────────
  grid:          { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 12, marginBottom: 4 },
  soundCard:     { borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(15,23,42,0.4)', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 10 },
  soundGrad:     { padding: 14, flex: 1, justifyContent: 'space-between', position: 'relative', overflow: 'hidden' },
  soundOrb:      { position: 'absolute', top: -20, right: -20, width: 90, height: 90, borderRadius: 45 },
  soundTopRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  soundPlayBtn:  { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  soundEmojiAccent: { fontSize: 19, opacity: 0.85 },
  cardName:      { fontSize: 14, fontWeight: '800', color: '#fff', marginTop: 6, fontFamily: 'Nunito_800ExtraBold' },
  cardDesc:      { fontSize: 11, color: '#FFFFFF65', marginBottom: 5, marginTop: 3 },
  badge:         { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 99, borderColor: '#FFFFFF12', backgroundColor: '#FFFFFF06', paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  badgeTxt:      { fontSize: 10, fontWeight: '800', color: '#FFFFFF50', fontFamily: 'Nunito_800ExtraBold' },
  liveDot:       { width: 5, height: 5, borderRadius: 3 },

  // ── Chips (category + timer) ──────────────────────────────
  chip:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, borderWidth: 1, borderColor: '#FFFFFF18', backgroundColor: '#FFFFFF08' },
  chipTxt:     { fontSize: 11, fontWeight: '700', fontFamily: 'Nunito_700Bold', letterSpacing: 0.2 },
  chipDivider: { width: 1, height: 22, backgroundColor: '#FFFFFF10', marginHorizontal: 4, alignSelf: 'center' },

  // ── Night Settings grouped card ────────────────────────────
  groupCard:     { marginHorizontal: 16, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(15,23,42,0.45)', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 12 },
  groupRow:      { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 16 },
  groupIcon:     { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  groupRowTitle: { fontSize: 13, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Nunito_700Bold' },
  groupRowSub:   { fontSize: 11, color: '#FFFFFF65', marginTop: 2 },
  groupDivider:  { height: 1, backgroundColor: '#FFFFFF0C', marginLeft: 70 },
  idealBedChip:      { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#a78bfa14', borderWidth: 1, borderColor: '#a78bfa35', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
  idealBedChipLabel: { fontSize: 9, fontWeight: '600', color: '#a78bfa70', letterSpacing: 0.3 },
  idealBedChipTxt:   { fontSize: 11, fontWeight: '800', color: '#a78bfaCC', fontFamily: 'Nunito_800ExtraBold' },

  // ── Sleep Cycle chips ─────────────────────────────────────
  cycleChip:        { width: 112, borderRadius: 16, borderWidth: 1, padding: 12, gap: 2 },
  cycleChipBadge:   { alignSelf: 'flex-start', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 4 },
  cycleChipTime:    { fontSize: 13, fontWeight: '600', letterSpacing: -0.3, fontFamily: 'Nunito_600SemiBold' },
  cycleChipHours:   { fontSize: 10, fontWeight: '600', color: '#FFFFFFBB', fontFamily: 'Nunito_600SemiBold' },
  cycleChipQuality: { fontSize: 9, fontWeight: '500', fontFamily: 'Nunito_400Regular' },
  cycleChipCycles:  { fontSize: 10, color: '#FFFFFF35', fontWeight: '600', fontFamily: 'Nunito_600SemiBold' },

  // ── Sleep Science ─────────────────────────────────────────
  tipCard:    { marginHorizontal: 16, marginBottom: 12, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(15,23,42,0.4)', flexDirection: 'row', alignItems: 'flex-start', gap: 14, padding: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 10 },
  tipIconBox: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  tipTitle:   { fontSize: 12, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Nunito_700Bold' },
  tipSub:     { fontSize: 10, color: '#FFFFFFBB', marginTop: 2, lineHeight: 15 },
  scienceNote:    { marginHorizontal: 16, marginTop: 4, marginBottom: 8, backgroundColor: 'rgba(6,15,40,0.50)', borderWidth: 1, borderColor: SLEEP_COLOR + '45', borderRadius: 16, padding: 16 },
  scienceNoteTxt: { fontSize: 11, color: SLEEP_COLOR + 'DD', lineHeight: 18 },

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
