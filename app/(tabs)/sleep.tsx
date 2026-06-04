import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch,
  Modal, Animated, Easing, Dimensions, ImageBackground, LayoutAnimation, Image, FlatList, Platform, PanResponder,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ScrollView as GHScrollView } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import notifee, { AndroidImportance, AndroidCategory, AndroidVisibility, TriggerType, RepeatFrequency, AlarmType } from '@notifee/react-native';
import { store, KEYS } from '@/lib/storage';
import { AlarmSettings, DEFAULT_ALARM_SETTINGS } from '@/lib/notifications';
import { getSolarTimes, SolarTimes } from '@/lib/solar';
import { getCurrentPeriod } from '@/lib/ayurvedicPeriods';
import { useBgContext } from '@/lib/bgContext';
import { Colors, Font } from '@/constants/theme';
import { useSoundPlayer, PlayableSoundMeta } from '@/lib/soundPlayerContext';
import { SOUND_IMAGES as SOUND_IMAGES_LIB } from '@/lib/sleepSoundsData';
import { getLocalSoundImageUri, isSoundImageCached, warmSoundImageMap, prefetchAllSoundImages, ensureSoundImageCached, subscribeToWarm } from '@/lib/soundImagePreload';
import { isAudioCached, downloadAudioToCache, initAudioCache } from '@/lib/soundAudioCache';
import { useFocusEffect } from 'expo-router';

const { width: W, height: H } = Dimensions.get('window');
let _pageScrollRef: ScrollView | null = null;
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
  { id: 'city_night',      label: 'City Night',       emoji: '🏙️', cat: 'Nature', color: '#fbbf24', top: '#201808' as const, bot: '#100D05' as const, desc: 'Distant city hum',                   src: require('../../assets/sounds/mixkit-urban-ambience-during-the-day-2505.m4a') },
  { id: 'campfire',        label: 'Forest Campfire',  emoji: '🔥', cat: 'Nature',  color: '#f97316', top: '#1A0A00' as const, bot: '#0A0500' as const, desc: 'Crackling fire in the woods',         src: require('../../assets/sounds/forest-campfire.m4a') },
  { id: 'morning_birds',   label: 'Morning Birds',    emoji: '🐦', cat: 'Birds',  color: '#fde68a', top: '#1A1400' as const, bot: '#0A0A00' as const, desc: 'Dawn chorus at sunrise',              src: require('../../assets/sounds/morning-birds-loop.m4a') },
  { id: 'spring_birds',    label: 'Spring Birds',     emoji: '🌸', cat: 'Birds',  color: '#f9a8d4', top: '#1A0A12' as const, bot: '#0A050A' as const, desc: 'Birds of a blooming spring day',      src: require('../../assets/sounds/spring-birds-morning.m4a') },
  { id: 'wanderlust',      label: 'Wanderlust Breeze',emoji: '🌬️', cat: 'Nature',  color: '#bae6fd', top: '#0A1620' as const, bot: '#050B10' as const, desc: 'Open skies and wandering wind',       src: require('../../assets/sounds/wanderlust-breeze.m4a') },
  { id: 'forest_birds',    label: 'Forest Birds',     emoji: '🌳', cat: 'Birds',  color: '#86efac', top: '#081808' as const, bot: '#040C04' as const, desc: 'Birds singing deep in the forest',    src: require('../../assets/sounds/forest-birds-spring.m4a') },
  { id: 'hz_432',          label: '432 Hz Bells',     emoji: '🔔', cat: 'Meditations',  color: '#c084fc', top: '#14082A' as const, bot: '#0A0516' as const, desc: 'Healing frequency, calm the mind',    src: require('../../assets/sounds/432hz-healing-bells.m4a') },
  { id: 'singing_bowl',    label: 'Deep Singing Bowl',emoji: '🔮', cat: 'Meditations',  color: '#a78bfa', top: '#10082A' as const, bot: '#080515' as const, desc: 'Deep resonance for meditation',       src: require('../../assets/sounds/singing-bowl-deep.m4a') },
  { id: 'tibetan_bowl',    label: 'Tibetan Bowl',     emoji: '🫙', cat: 'Meditations',  color: '#818cf8', top: '#0C0822' as const, bot: '#060411' as const, desc: 'Ancient healing bowl tones',          src: require('../../assets/sounds/tibetan-bowl.m4a') },
  { id: 'morning_flute',   label: 'Light Meditation Tone', emoji: '🎶', cat: 'Meditations',  color: '#6ee7b7', top: '#082018' as const, bot: '#04100C' as const, desc: 'Gentle tones for a peaceful dawn',       src: require('../../assets/sounds/morning-flute.m4a') },
  { id: 'sitar',           label: 'Calm Raga',        emoji: '🎸', cat: 'Meditations',  color: '#fcd34d', top: '#1A1200' as const, bot: '#0A0900' as const, desc: 'Classical raga to ease the mind',     src: require('../../assets/sounds/sitar-morning.m4a') },
  { id: 'indian_beats',    label: 'Indian Beats',     emoji: '🥁', cat: 'Meditations',  color: '#fb923c', top: '#1A0A00' as const, bot: '#0A0500' as const, desc: 'Rhythmic tabla & percussion',         src: require('../../assets/sounds/indian-beats.m4a') },
  // ── Sacred additions ────────────────────────────────────────────────────────
  { id: 'tibetan_dreams',     label: 'Tibetan Dreams',        emoji: '🧘', cat: 'Meditations' as const, color: '#818cf8', top: '#0C0822' as const, bot: '#060411' as const, desc: 'Deep Himalayan soundscape',              src: require('../../assets/sounds/tibetan-dreams.m4a') },
  { id: 'reincarnation_tones',label: 'Reincarnation Tones',   emoji: '♾️', cat: 'Meditations' as const, color: '#a78bfa', top: '#100830' as const, bot: '#080418' as const, desc: 'Timeless tones of past lives',           src: require('../../assets/sounds/reincarnation-tones.m4a') },
  { id: 'spiritual_journey',  label: 'Spiritual Journey',     emoji: '🌌', cat: 'Meditations' as const, color: '#c084fc', top: '#140A28' as const, bot: '#0A0518' as const, desc: 'A journey through sacred realms',        src: require('../../assets/sounds/spiritual-journey.m4a') },
  // ── Nature addition ─────────────────────────────────────────────────────────
  { id: 'night_jungle_chiangmai', label: 'Night Jungle',      emoji: '🦟', cat: 'Nature'  as const, color: '#4ade80', top: '#061A08' as const, bot: '#030C04' as const, desc: 'Wild night in Chiangmai jungle',         src: require('../../assets/sounds/night-jungle-chiangmai.m4a') },
  // ── Sitar ───────────────────────────────────────────────────────────────────
  { id: 'sitar_long',          label: 'Sitar Meditation',     emoji: '🎸', cat: 'Ragas'   as const, color: '#f59e0b', top: '#1A1000' as const, bot: '#0A0800' as const, desc: 'Long classical raga session',            src: require('../../assets/sounds/sitar-long.m4a') },
  { id: 'sitar_tabla_bells',   label: 'Sitar, Tabla & Bells', emoji: '🎵', cat: 'Ragas'   as const, color: '#fbbf24', top: '#1A1200' as const, bot: '#0A0900' as const, desc: 'Fusion of strings, rhythm & bells',      src: require('../../assets/sounds/sitar-tabla-bells.m4a') },
  { id: 'indian_sitar_raga',   label: 'Indian Sitar Raga',    emoji: '🎶', cat: 'Ragas'   as const, color: '#fb923c', top: '#1A0E00' as const, bot: '#0A0700' as const, desc: 'Classical Indian raga melody',           src: require('../../assets/sounds/indian-sitar-raga.m4a') },
  { id: 'sitar_summer_raga',   label: 'Summer Healing Raga',  emoji: '☀️', cat: 'Ragas'   as const, color: '#fde68a', top: '#1A1600' as const, bot: '#0A0B00' as const, desc: 'Mango season raga at 432 Hz',            src: require('../../assets/sounds/sitar-summer-raga.m4a') },
  { id: 'sitar_radiance',      label: 'Sitar Radiance',       emoji: '✨', cat: 'Ragas'   as const, color: '#f97316', top: '#1A0800' as const, bot: '#0A0400' as const, desc: 'Radiant Indian classical sitar',         src: require('../../assets/sounds/sitar-radiance.m4a') },
  { id: 'sitar_tanpura_sarangi',label: 'Sitar, Tanpura & Sarangi', emoji: '🪕', cat: 'Ragas' as const, color: '#f59e0b', top: '#1A1000' as const, bot: '#0A0800' as const, desc: 'Full classical Indian ensemble',         src: require('../../assets/sounds/sitar-tanpura-sarangi.m4a') },
  { id: 'sitar_tanpura_bgm',   label: 'Sitar & Tanpura',      emoji: '🎼', cat: 'Ragas'   as const, color: '#fbbf24', top: '#1A1200' as const, bot: '#0A0900' as const, desc: 'Indian classical background melody',     src: require('../../assets/sounds/sitar-tanpura.m4a') },
  { id: 'veena_classical',     label: 'Classical Veena',      emoji: '🪗', cat: 'Ragas'   as const, color: '#fcd34d', top: '#1A1A00' as const, bot: '#0A0A00' as const, desc: "Saraswati's divine string instrument",  src: require('../../assets/sounds/veena-classical.m4a') },
  // ── Flute ───────────────────────────────────────────────────────────────────
  { id: 'andean_flute',        label: 'Andean Flute',         emoji: '🏔️', cat: 'Ragas'   as const, color: '#6ee7b7', top: '#081A10' as const, bot: '#040C08' as const, desc: 'High-altitude Andean melody',           src: require('../../assets/sounds/andean-flute.m4a') },
  { id: 'quena_flute',         label: 'Canyon Quena',         emoji: '🏜️', cat: 'Ragas'   as const, color: '#86efac', top: '#0A1E12' as const, bot: '#050F09' as const, desc: 'Solo Quena through canyon winds',        src: require('../../assets/sounds/quena-flute.m4a') },
  { id: 'native_flute',        label: 'Native American Flute',emoji: '🪶', cat: 'Ragas'   as const, color: '#a3e635', top: '#121400' as const, bot: '#090A00' as const, desc: 'Traditional wood flute from the plains', src: require('../../assets/sounds/native-flute.m4a') },
  { id: 'native_flute_echo',   label: 'Native Flute Echo',    emoji: '🌀', cat: 'Ragas'   as const, color: '#86efac', top: '#0A1A10' as const, bot: '#050D08' as const, desc: 'Looping flute with forest echo',         src: require('../../assets/sounds/native-flute-echo.m4a') },
  { id: 'bamboo_flute',        label: 'Bamboo Flute',         emoji: '🎋', cat: 'Ragas'   as const, color: '#34d399', top: '#081A0C' as const, bot: '#040C06' as const, desc: 'Amazon bamboo flute groove',             src: require('../../assets/sounds/bamboo-flute.m4a') },
  { id: 'pan_flute',           label: 'Pan Flute Drift',      emoji: '🌬️', cat: 'Ragas'   as const, color: '#67e8f9', top: '#081820' as const, bot: '#040C10' as const, desc: 'Pan pipe looping melody',                src: require('../../assets/sounds/pan-flute.m4a') },
  { id: 'arabian_flute',       label: 'Arabian Flute & Drums',emoji: '🌙', cat: 'Ragas'   as const, color: '#fbbf24', top: '#1A1400' as const, bot: '#0A0A00' as const, desc: 'Desert night flute with rhythm',         src: require('../../assets/sounds/arabian-flute.m4a') },
  { id: 'arabic_flute',        label: 'Arabic Flute',         emoji: '🕌', cat: 'Ragas'   as const, color: '#fde68a', top: '#1A1600' as const, bot: '#0A0B00' as const, desc: 'Maqam-style Arabic flute loop',          src: require('../../assets/sounds/arabic-flute.m4a') },
  { id: 'flute_scale',         label: 'Flute Meditation',     emoji: '🎶', cat: 'Ragas'   as const, color: '#6ee7b7', top: '#081810' as const, bot: '#040C08' as const, desc: 'Gentle flute scale for calm mind',       src: require('../../assets/sounds/flute-scale.m4a') },
  { id: 'forest_flute',        label: 'Forest Flute',         emoji: '🌿', cat: 'Ragas'   as const, color: '#86efac', top: '#081A0A' as const, bot: '#040C05' as const, desc: 'Soft flute among the trees',             src: require('../../assets/sounds/forest-flute.m4a') },
  // ── Tabla ───────────────────────────────────────────────────────────────────
  { id: 'tabla_beat',          label: 'Tabla Beat',           emoji: '🥁', cat: 'Ragas'   as const, color: '#f97316', top: '#1A0800' as const, bot: '#0A0400' as const, desc: 'Crisp rhythmic tabla beat',              src: require('../../assets/sounds/tabla-beat.m4a') },
  { id: 'tabla_shuffle',       label: 'Tabla Shuffle',        emoji: '🪘', cat: 'Ragas'   as const, color: '#fb923c', top: '#1A0A00' as const, bot: '#0A0500' as const, desc: '105 BPM shuffled tabla loop',            src: require('../../assets/sounds/tabla-shuffle.m4a') },
  { id: 'tabla_loop',          label: 'Tabla Loop 90',        emoji: '🎵', cat: 'Ragas'   as const, color: '#f59e0b', top: '#1A0E00' as const, bot: '#0A0700' as const, desc: '90 BPM tabla rhythm for focus',          src: require('../../assets/sounds/tabla-loop.m4a') },
  { id: 'tabla_jam',           label: 'Tabla Jam',            emoji: '🎶', cat: 'Ragas'   as const, color: '#fbbf24', top: '#1A1200' as const, bot: '#0A0900' as const, desc: 'Energetic tabla jam session',            src: require('../../assets/sounds/tabla-jam.m4a') },
  { id: 'tabla_claves',        label: 'Tabla & Claves',       emoji: '🪗', cat: 'Ragas'   as const, color: '#fb923c', top: '#1A0A00' as const, bot: '#0A0500' as const, desc: 'Tabla meets Latin percussion',           src: require('../../assets/sounds/tabla-claves.m4a') },
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
  { id: 'tanpura_sacred_432hz', label: 'Sacred Tanpura 432Hz', emoji: '🕉️', cat: 'Ragas'   as const, color: '#c084fc', top: '#14082A' as const, bot: '#0A0516' as const, desc: 'Gilded tanpura drone at 432 Hz',        src: require('../../assets/sounds/tanpura-sacred-432hz.m4a') },
  { id: 'tanpura_breath',      label: 'Tanpura Breath',        emoji: '🌬️', cat: 'Ragas'   as const, color: '#a78bfa', top: '#100830' as const, bot: '#080418' as const, desc: 'Soft tanpura drone for meditation',      src: require('../../assets/sounds/tanpura-breath.m4a') },
  { id: 'tanpura_loop',        label: 'Tanpura Loop',          emoji: '🔁', cat: 'Ragas'   as const, color: '#818cf8', top: '#0C0822' as const, bot: '#060411' as const, desc: 'Continuous looping tanpura music',       src: require('../../assets/sounds/tanpura-loop.m4a') },
  { id: 'raga_tanpura_drone',  label: 'Raga Tanpura Drone',    emoji: '🌌', cat: 'Ragas'   as const, color: '#6366f1', top: '#0A0820' as const, bot: '#050410' as const, desc: 'Deep space tanpura drone for raga',      src: require('../../assets/sounds/raga-tanpura-drone.m4a') },
  // ── World (merged into Ragas) ───────────────────────────────────────────────
  { id: 'sargija_eastern',     label: 'Eastern Sargija',       emoji: '🌏', cat: 'Ragas'   as const, color: '#f97316', top: '#1A0A00' as const, bot: '#0A0500' as const, desc: 'Traditional Eastern string improvisation', src: require('../../assets/sounds/sargija-eastern.m4a') },
  { id: 'tagore_festival',     label: 'Tagore Festival',       emoji: '🎊', cat: 'Ragas'   as const, color: '#fbbf24', top: '#1A1200' as const, bot: '#0A0900' as const, desc: 'Joyful Tagore festival music',           src: require('../../assets/sounds/tagore-festival.m4a') },
  { id: 'world_ambient',       label: 'World Ambient',         emoji: '🌍', cat: 'Ragas'   as const, color: '#a78bfa', top: '#100830' as const, bot: '#080418' as const, desc: 'Global ambient soundscape',              src: require('../../assets/sounds/world-ambient.m4a') },
  { id: 'heaven_tune',         label: 'Heaven Tune',           emoji: '✨',  cat: 'Ragas'   as const, color: '#fde68a', top: '#1A1600' as const, bot: '#0A0B00' as const, desc: 'Traditional heavenly melody',            src: require('../../assets/sounds/heaven-tune.m4a') },
  // ── Sitar additions ────────────────────────────────────────────────────────
  { id: 'sitar_calm',          label: 'Calm Sitar',            emoji: '🎸',  cat: 'Ragas'   as const, color: '#fcd34d', top: '#1A1200' as const, bot: '#0A0900' as const, desc: 'Soft sitar for deep relaxation',         src: require('../../assets/sounds/sitar-calm.m4a') },
  { id: 'veena_raga',          label: 'Veena Raga Kanada',     emoji: '🪗',  cat: 'Ragas'   as const, color: '#f59e0b', top: '#1A1000' as const, bot: '#0A0800' as const, desc: 'Raga Kanada on veena with mridangam',   src: require('../../assets/sounds/veena-raga.m4a') },
  // ── Flute additions ────────────────────────────────────────────────────────
  { id: 'bansuri_forest',      label: 'Bansuri Forest',        emoji: '🌿',  cat: 'Ragas'   as const, color: '#34d399', top: '#081A0C' as const, bot: '#040C06' as const, desc: 'Bansuri flute echoing through a forest', src: require('../../assets/sounds/bansuri-forest.m4a') },
  { id: 'bansuri_melody',      label: 'Bansuri Melody',        emoji: '🎵',  cat: 'Ragas'   as const, color: '#6ee7b7', top: '#081810' as const, bot: '#040C08' as const, desc: 'Serene Indian bansuri flute melody',     src: require('../../assets/sounds/bansuri-melody.m4a') },
  { id: 'bansuri_tarana',      label: 'Bansuri Tarana',        emoji: '🎶',  cat: 'Ragas'   as const, color: '#86efac', top: '#0A1A10' as const, bot: '#050D08' as const, desc: 'Classical tarana raga on bansuri',       src: require('../../assets/sounds/bansuri-tarana.m4a') },
  // ── Tanpura additions ──────────────────────────────────────────────────────
  { id: 'tanpura_mystic',      label: 'Mystic Tanpura',        emoji: '🌌',  cat: 'Ragas'   as const, color: '#818cf8', top: '#0C0830' as const, bot: '#060418' as const, desc: 'Ethereal mystic tanpura waves',          src: require('../../assets/sounds/tanpura-mystic.m4a') },
  { id: 'tanpura_serene',      label: 'Serene Tanpura',        emoji: '🧘',  cat: 'Ragas'   as const, color: '#a78bfa', top: '#100828' as const, bot: '#080414' as const, desc: 'Calm serene tanpura meditation',         src: require('../../assets/sounds/tanpura-serene.m4a') },
  // ── Sacred mantra addition ─────────────────────────────────────────────────
  { id: 'om_shanti',           label: 'Om Shanti',             emoji: '🕉️',  cat: 'Meditations' as const, color: '#c084fc', top: '#140A28' as const, bot: '#0A0516' as const, desc: 'Vedic peace chant — Om Shanti Shanti Shanti', src: require('../../assets/sounds/om-shanti.m4a') },
] as const;

type SoundId = typeof SLEEP_SOUNDS[number]['id'];
type SoundItem = typeof SLEEP_SOUNDS[number];
const SLEEP_HIDDEN_IDS = new Set([
  'cuckoo_chime',
  'nada_golden_sitar_432',
  'nada_sitar_moonlight',
  'nada_flute_infinite_sky',
  'nada_whispering_bamboo',
  'nada_wind_mountain_raga',
  'nada_emotional_flute',
  'nada_flute_rain_ambiance',
  'nada_tabla_flute_strings_ii',
  'nada_rhythm_riot',
]);
const CATEGORIES = ['All', 'Nature', 'Sleep', 'Meditations', 'Birds', 'Ragas'] as const;
type Category = typeof CATEGORIES[number];

const LALITHA_IMG = require('../../assets/images/mata-lalitha.jpg');

const SOUND_BUNDLED_IMAGES: Record<string, any> = {
  mantra_lalitha: LALITHA_IMG,
};

const SOUND_IMAGES = SOUND_IMAGES_LIB;

// ─── NADA remote sounds — streamed from CDN, not bundled in APK ─────────────
const NADA_BASE = 'https://audio.onesutralabs.com/All%20Nada%20Sounds/';
type NadaSound = { id: string; label: string; emoji: string; cat: string; color: string; top: string; bot: string; desc: string; src: { uri: string } };
const NADA_SOUNDS: NadaSound[] = [
  // ── Sitar ──────────────────────────────────────────────────────────────────
  { id: 'nada_aar_sitar_classical',    label: 'Indian Classical Sitar', emoji: '🪕', cat: 'Ragas', color: '#f59e0b', top: '#1A1000', bot: '#0A0800', desc: 'Classical Indian sitar melody',              src: { uri: NADA_BASE + 'aar_music-indian-classical-music-sitar-296790.m4a' } },
  { id: 'nada_aar_sitar_flute',        label: 'Sitar & Flute',          emoji: '🎵', cat: 'Ragas', color: '#fbbf24', top: '#1A1200', bot: '#0A0900', desc: 'Sitar and bansuri flute interplay',          src: { uri: NADA_BASE + 'aar_music-indian-classical-music-sitar-flute-298975.m4a' } },
  { id: 'nada_golden_sitar_432',       label: 'Golden Sitar 432 Hz',   emoji: '✨', cat: 'Ragas', color: '#fcd34d', top: '#1A1400', bot: '#0A0B00', desc: 'Healing resonance sitar at 432 Hz',          src: { uri: NADA_BASE + 'boopul-golden-sitar-healing-resonance-432hz-525936.m4a' } },
  { id: 'nada_sitar_vibes_i',          label: 'Sitar Vibes I',          emoji: '🎸', cat: 'Ragas', color: '#f97316', top: '#1A0E00', bot: '#0A0700', desc: 'Soulful sitar groove',                        src: { uri: NADA_BASE + 'gskvibes-sitar-2-361895.m4a' } },
  { id: 'nada_sitar_vibes_ii',         label: 'Sitar Vibes II',         emoji: '🎶', cat: 'Ragas', color: '#fb923c', top: '#1A0C00', bot: '#0A0600', desc: 'Meditative sitar flow',                       src: { uri: NADA_BASE + 'gskvibes-sitar-4-361900.m4a' } },
  { id: 'nada_sitar_flute_tabla_soft', label: 'Sitar Flute Tabla',      emoji: '🎼', cat: 'Ragas', color: '#f59e0b', top: '#1A1000', bot: '#0A0800', desc: 'Soft Indian classical trio',                  src: { uri: NADA_BASE + 'kalsstockmedia-free-soul-indian-sitar-flute-tabla-soft-sounds-white-noise-413706.m4a' } },
  { id: 'nada_sitar_tabla_flute',      label: 'Sitar Tabla Blend',      emoji: '🪕', cat: 'Ragas', color: '#fbbf24', top: '#1A1200', bot: '#0A0900', desc: 'Indian sitar tabla fusion',                   src: { uri: NADA_BASE + 'kalsstockmedia-free-soul-indian-sitar-tabla-flute-396347.m4a' } },
  { id: 'nada_short_classical_sitar',  label: 'Classical Sitar Short',  emoji: '🎵', cat: 'Ragas', color: '#f59e0b', top: '#1A1000', bot: '#0A0800', desc: 'Short Indian classical sitar',                src: { uri: NADA_BASE + 'kalsstockmedia-free-soul-short-sitar-music-classical-indian-404177.m4a' } },
  { id: 'nada_sitar_moonlight',        label: 'Sitar in Moonlight',     emoji: '🌙', cat: 'Ragas', color: '#fcd34d', top: '#1A1400', bot: '#0A0A00', desc: 'Sitar resonating in the moonlit night',      src: { uri: NADA_BASE + 'nourishedbymusic-sitar-in-the-moonlight-115602.m4a' } },
  { id: 'nada_sitar_holistic',         label: 'Sitar & Holistic',       emoji: '🧘', cat: 'Ragas', color: '#f59e0b', top: '#1A1000', bot: '#0A0800', desc: 'Holistic sitar meditation sounds',            src: { uri: NADA_BASE + 'patrizioyoga-sitar-hand-olistik-sound-project-patrizio-yoga-172195.m4a' } },
  { id: 'nada_raga_sparkle',           label: 'Raga Sparkle',           emoji: '✨', cat: 'Ragas', color: '#fbbf24', top: '#1A1200', bot: '#0A0900', desc: 'Sparkling Indian raga melody',                src: { uri: NADA_BASE + 'pixel_perfect_productions-raga-sparkle-437291.m4a' } },
  { id: 'nada_sitar_temple',           label: 'Sitar in the Temple',    emoji: '🛕', cat: 'Ragas', color: '#f97316', top: '#1A0E00', bot: '#0A0700', desc: 'Sacred sitar resonating in a temple',        src: { uri: NADA_BASE + 'playlistsons-sitar-in-the-temple-of-rats-430832.m4a' } },
  { id: 'nada_indian_sitar_tune',      label: 'Indian Sitar Tune',      emoji: '🎸', cat: 'Ragas', color: '#f59e0b', top: '#1A1000', bot: '#0A0800', desc: 'Traditional Indian sitar tune',               src: { uri: NADA_BASE + 'rungstudiorecords-indian-sitar-tune-391626.m4a' } },
  { id: 'nada_sitar_bhagesri',         label: 'Sitar Bhagesri Raga',    emoji: '🪕', cat: 'Ragas', color: '#fbbf24', top: '#1A1200', bot: '#0A0900', desc: 'Raga Bhagesri on sitar and guitar',           src: { uri: NADA_BASE + 'saseendran-sitar-amp-guitar-bhagesri-374594.m4a' } },
  { id: 'nada_sitar_raga_jog',         label: 'Sitar Raga Jog',         emoji: '🎵', cat: 'Ragas', color: '#f97316', top: '#1A0E00', bot: '#0A0700', desc: 'Classical Raga Jog on sitar',                 src: { uri: NADA_BASE + 'saseendran-sitar-melody-raga-jog-364969.m4a' } },
  { id: 'nada_sitar_type_beat',        label: 'Sitar Type Beat',        emoji: '🎶', cat: 'Ragas', color: '#f59e0b', top: '#1A1000', bot: '#0A0800', desc: 'Smooth lo-fi sitar beat',                     src: { uri: NADA_BASE + 'u_67ccao27gv-sitar-type-beat-322065.m4a' } },
  // ── Flute ──────────────────────────────────────────────────────────────────
  { id: 'nada_flute_infinite_sky',     label: 'Infinite Sky Flute',     emoji: '☁️', cat: 'Ragas', color: '#34d399', top: '#081A10', bot: '#040C08', desc: 'Flute soaring through infinite sky',          src: { uri: NADA_BASE + 'djovan-flute-of-the-infinite-sky-486758.m4a' } },
  { id: 'nada_whispering_bamboo',      label: 'Whispering Bamboo',      emoji: '🎋', cat: 'Ragas', color: '#6ee7b7', top: '#081810', bot: '#040C08', desc: 'Soft bamboo flute whispers',                   src: { uri: NADA_BASE + 'djovan-whispering-bamboo-melody-497104.m4a' } },
  { id: 'nada_zen_bamboo_flow',        label: 'Zen Bamboo Flow',        emoji: '🌿', cat: 'Ragas', color: '#86efac', top: '#0A1A10', bot: '#050D08', desc: 'Flowing bamboo Zen melody',                    src: { uri: NADA_BASE + 'djovan-zen-bamboo-flow-497102.m4a' } },
  { id: 'nada_ancestors_flute',        label: 'Ancestors Flute',        emoji: '🪶', cat: 'Ragas', color: '#a3e635', top: '#121400', bot: '#090A00', desc: 'Native American ancestral flute',              src: { uri: NADA_BASE + 'k3lix_music-last-breath-of-ancestors-native-american-flute-214341.m4a' } },
  { id: 'nada_indian_flute_tabla_mix', label: 'Indian Flute & Tabla',   emoji: '🎵', cat: 'Ragas', color: '#34d399', top: '#081A0C', bot: '#040C06', desc: 'Indian flute and tabla mix',                   src: { uri: NADA_BASE + 'kalsstockmedia-free-soul-indian-flute-amp-tabla-mix-452176.m4a' } },
  { id: 'nada_bansuri_tabla_fusion',   label: 'Bansuri Tabla Fusion',   emoji: '🎶', cat: 'Ragas', color: '#6ee7b7', top: '#081810', bot: '#040C08', desc: 'Indian bansuri tabla fusion',                  src: { uri: NADA_BASE + 'kalsstockmedia-indian-bansuri-tabla-fusion-short-music-25-seconds-track-269954.m4a' } },
  { id: 'nada_flute_tabla_remastered', label: 'Flute Tabla Remastered', emoji: '🌟', cat: 'Ragas', color: '#86efac', top: '#0A1A10', bot: '#050D08', desc: 'Remastered flute and tabla melody',            src: { uri: NADA_BASE + 'kalsstockmedia-indian-flute-and-tabla-new-tune-remastered-277266.m4a' } },
  { id: 'nada_summer_flute_tabla',     label: 'Summer Flute Tabla',     emoji: '☀️', cat: 'Ragas', color: '#34d399', top: '#081A0C', bot: '#040C06', desc: 'Warm summer flute & tabla blend',              src: { uri: NADA_BASE + 'kalsstockmedia-indian-summer-tabla-flute-calm-background-music-track-280183.m4a' } },
  { id: 'nada_krishna_flute_i',        label: 'Krishna Flute I',        emoji: '💙', cat: 'Ragas', color: '#38bdf8', top: '#0A1E28', bot: '#050F14', desc: 'Lord Krishna\'s divine flute melody',           src: { uri: NADA_BASE + 'krasnoshchok-hindu-krishna-flute-music-499585.m4a' } },
  { id: 'nada_krishna_flute_ii',       label: 'Krishna Flute II',       emoji: '🌀', cat: 'Ragas', color: '#67e8f9', top: '#081820', bot: '#040C10', desc: 'Second Krishna flute meditation',              src: { uri: NADA_BASE + 'krasnoshchok-krishna-flute-hindu-music-450217.m4a' } },
  { id: 'nada_muladhara_flute',        label: 'Muladhara Flute',        emoji: '🕉️', cat: 'Ragas', color: '#6ee7b7', top: '#081810', bot: '#040C08', desc: 'Root chakra flute meditation',                 src: { uri: NADA_BASE + 'meditativetiger-lord-krishnax27s-mulhadara-flute-meditative-tiger-edit-410414.m4a' } },
  { id: 'nada_himalayan_village_flute',label: 'Himalayan Village Flute',emoji: '🏔️', cat: 'Ragas', color: '#86efac', top: '#0A1A10', bot: '#050D08', desc: 'Flute echoing through Himalayan village',      src: { uri: NADA_BASE + 'oqu-himalayan-village-flute-251427.m4a' } },
  { id: 'nada_relaxing_flute',         label: 'Relaxing Flute',         emoji: '🌸', cat: 'Ragas', color: '#34d399', top: '#081A0C', bot: '#040C06', desc: 'Soothing relaxing flute reverie',              src: { uri: NADA_BASE + 'pojeng-sad-relaxing-flute-406638.m4a' } },
  { id: 'nada_wind_mountain_raga',     label: 'Wind from the Mountain', emoji: '🌬️', cat: 'Ragas', color: '#a3e635', top: '#121400', bot: '#090A00', desc: 'Raga Pahad — mountain winds on flute',         src: { uri: NADA_BASE + 'saseendran-wind-from-the-mountain-raga-pahad-364841.m4a' } },
  { id: 'nada_pure_flute_melody',      label: 'Pure Flute Melody',      emoji: '🎵', cat: 'Ragas', color: '#6ee7b7', top: '#081810', bot: '#040C08', desc: 'Simple pure flute melody',                     src: { uri: NADA_BASE + 'trycja-flute-melody-494886.m4a' } },
  { id: 'nada_emotional_flute',        label: 'Emotional Flute',        emoji: '💫', cat: 'Ragas', color: '#86efac', top: '#0A1A10', bot: '#050D08', desc: 'Deep emotional flute journey',                 src: { uri: NADA_BASE + 'u_iwe3yizfhb-emotional-sad-flute-478667.m4a' } },
  { id: 'nada_flute_rain_ambiance',    label: 'Flute & Rain',           emoji: '🌧️', cat: 'Ragas', color: '#67e8f9', top: '#081820', bot: '#040C10', desc: 'Flute music with soothing rain ambiance',      src: { uri: NADA_BASE + 'wr_ambiance-flute-music-with-rain-ambiance-370521.m4a' } },
  // ── Tabla ──────────────────────────────────────────────────────────────────
  { id: 'nada_tabla_110',              label: 'Tabla 110',              emoji: '🥁', cat: 'Ragas', color: '#f97316', top: '#1A0800', bot: '#0A0400', desc: 'Crisp tabla at 110 BPM',                       src: { uri: NADA_BASE + 'jeremiah7-tabla-110-292145.m4a' } },
  { id: 'nada_tabla_flute_i',          label: 'Tabla & Flute I',        emoji: '🪘', cat: 'Ragas', color: '#fb923c', top: '#1A0A00', bot: '#0A0500', desc: 'Tabla and flute melody I',                    src: { uri: NADA_BASE + 'jeremiah7-tabla-flute-103-262273.m4a' } },
  { id: 'nada_tabla_flute_ii',         label: 'Tabla & Flute II',       emoji: '🎵', cat: 'Ragas', color: '#f59e0b', top: '#1A0E00', bot: '#0A0700', desc: 'Tabla and flute melody II',                   src: { uri: NADA_BASE + 'jeremiah7-tabla-flute-104-262260.m4a' } },
  { id: 'nada_tabla_flute_iii',        label: 'Tabla & Flute III',      emoji: '🎶', cat: 'Ragas', color: '#fbbf24', top: '#1A1200', bot: '#0A0900', desc: 'Tabla and flute melody III',                  src: { uri: NADA_BASE + 'jeremiah7-tabla-flute-105-262271.m4a' } },
  { id: 'nada_tabla_flute_strings_i',  label: 'Tabla Flute Strings I',  emoji: '🪗', cat: 'Ragas', color: '#fb923c', top: '#1A0A00', bot: '#0A0500', desc: 'Tabla, flute and strings blend I',            src: { uri: NADA_BASE + 'jeremiah7-tabla-flute-strings-105-262265.m4a' } },
  { id: 'nada_tabla_flute_strings_ii', label: 'Tabla Flute Strings II', emoji: '🎼', cat: 'Ragas', color: '#f97316', top: '#1A0800', bot: '#0A0400', desc: 'Tabla, flute and strings blend II',           src: { uri: NADA_BASE + 'jeremiah7-tabla-flute-strings-107-262266.m4a' } },
  { id: 'nada_calming_tabla_flute',    label: 'Calming Tabla Flute',    emoji: '🧘', cat: 'Ragas', color: '#f59e0b', top: '#1A0E00', bot: '#0A0700', desc: 'Calming Indian background tabla and flute',   src: { uri: NADA_BASE + 'kalsstockmedia-free-soul-calming-indian-background-music-tabla-flute-385106.m4a' } },
  { id: 'nada_rhythm_riot',            label: 'Rhythm Riot',            emoji: '⚡', cat: 'Ragas', color: '#fbbf24', top: '#1A1200', bot: '#0A0900', desc: 'Energetic tabla rhythm',                       src: { uri: NADA_BASE + 'nra-lab-stomps-riser-rhythm-riot-246396.m4a' } },
  { id: 'nada_tabla_dance',            label: 'Tabla Dance Groove',     emoji: '🕺', cat: 'Ragas', color: '#fb923c', top: '#1A0A00', bot: '#0A0500', desc: 'Joyful tabla dance rhythm',                    src: { uri: NADA_BASE + 'one_nug-dont-worry-be-happy-tabla-dance-340952.m4a' } },
  { id: 'nada_old_gold_tabla',         label: 'Old is Gold Tabla',      emoji: '🥁', cat: 'Ragas', color: '#f97316', top: '#1A0800', bot: '#0A0400', desc: 'Timeless Indian tabla music',                  src: { uri: NADA_BASE + 'vfs_world-old-is-gold-indian-tabla-music-copyright-free-song-394347.m4a' } },
  // ── Meditations ─────────────────────────────────────────────────────────────
  { id: 'nada_hang_drum_tabla',        label: 'Hang Drum & Tabla',      emoji: '🥁', cat: 'Meditations', color: '#c084fc', top: '#14082A', bot: '#0A0516', desc: 'Spiritually uplifting hang drum and tabla',  src: { uri: NADA_BASE + 'dreamsofserenity-spiritually-uplifting-music-hang-drum-tabla-flute-289790.m4a' } },
  { id: 'nada_bhajan_flute_tabla',     label: 'Bhajan Flute & Tabla',   emoji: '🕉️', cat: 'Meditations', color: '#a78bfa', top: '#100830', bot: '#080418', desc: 'Bhajan-style Indian flute and tabla',        src: { uri: NADA_BASE + 'kalsstockmedia-free-soul-indian-flute-tabla-bhajan-style-452175.m4a' } },
  { id: 'nada_shiva_nirvana_mantra',   label: 'Shiva Nirvana Mantra',   emoji: '🔱', cat: 'Meditations', color: '#818cf8', top: '#0C0822', bot: '#060411', desc: 'Shiva nirvana rupam mantra',                  src: { uri: NADA_BASE + 'kalsstockmedia-free-soul-shiva-nirvana-rupam-mantra-487340.m4a' } },
  { id: 'nada_shiva_panchakshara',     label: 'Shiva Panchakshara',     emoji: '🕉️', cat: 'Meditations', color: '#c084fc', top: '#14082A', bot: '#0A0516', desc: 'Shiva Panchakshara mantra v1',               src: { uri: NADA_BASE + 'kalsstockmedia-free-soul-shiva-panchakshara-mantra-v1-374359.m4a' } },
  { id: 'nada_om_namah_shivaya',       label: 'Om Namah Shivaya',       emoji: '🌺', cat: 'Meditations', color: '#a78bfa', top: '#100830', bot: '#080418', desc: 'Om Namah Shivaya devotional song',            src: { uri: NADA_BASE + 'kalsstockmedia-om-namah-shivaya-song-229613.m4a' } },
  { id: 'nada_govinda_mantra',         label: 'Govinda Mantra',         emoji: '💙', cat: 'Meditations', color: '#818cf8', top: '#0C0822', bot: '#060411', desc: 'Govinda mantra with female voice, tanpura and sitar', src: { uri: NADA_BASE + 'shidenbeatsmusic-govinda-mantra-female-voice-with-tanpura-and-sitar-120558.m4a' } },
  { id: 'nada_shiv_swarnamala',        label: 'Shiv Swarnamala',        emoji: '🔱', cat: 'Meditations', color: '#c084fc', top: '#14082A', bot: '#0A0516', desc: 'Shiv Swarnamala Samb Sadashiv',               src: { uri: NADA_BASE + 'shiv-swarnamala-samb-sadashiv-version1-410249.m4a' } },
  { id: 'nada_hang_flute_meditation',  label: 'Hang & Flute Meditation',emoji: '🎵', cat: 'Meditations', color: '#a78bfa', top: '#100830', bot: '#080418', desc: 'Soothing hang drum and flute meditation',    src: { uri: NADA_BASE + 'silentvoice-soothing-hang-and-flute-meditation-music-229157.m4a' } },
  { id: 'nada_gayatri_mantra_long',    label: 'Gayatri Mantra 10 Min',  emoji: '🌞', cat: 'Meditations', color: '#818cf8', top: '#0C0822', bot: '#060411', desc: 'Extended Gayatri mantra meditation',          src: { uri: NADA_BASE + 'sounovamusic-gayatri-mantra-10-min-407517.m4a' } },
  { id: 'nada_om_shivaya_meditation',  label: 'Om Shivaya Meditation',  emoji: '🕉️', cat: 'Meditations', color: '#c084fc', top: '#14082A', bot: '#0A0516', desc: 'Om Namah Shivaya music mantra meditation',   src: { uri: NADA_BASE + 'sounovamusic-om-namah-shivaya-music-mantra-meditation-402775.m4a' } },
  // ── World (merged into Ragas) ──────────────────────────────────────────────
  { id: 'nada_festive_dholak_dance',   label: 'Festive Dholak Dance',   emoji: '🥁', cat: 'Ragas', color: '#f97316', top: '#1A0800', bot: '#0A0400', desc: 'Happy Indian festive flute, tabla & dholak',  src: { uri: NADA_BASE + 'kalsstockmedia-free-soul-happy-indian-festive-flute-tabla-and-dholak-dance-music-463138.m4a' } },
  { id: 'nada_traditional_koto',       label: 'Traditional Koto',       emoji: '🎌', cat: 'Ragas', color: '#fbbf24', top: '#1A1200', bot: '#0A0900', desc: 'Traditional Japanese koto music',              src: { uri: NADA_BASE + 'prettysleepy-koto-traditional-japanese-music-264711.m4a' } },
  { id: 'nada_indian_fusion',          label: 'Indian Fusion',          emoji: '🌍', cat: 'Ragas', color: '#a78bfa', top: '#100830', bot: '#080418', desc: 'Indian fusion blend',                          src: { uri: NADA_BASE + 'shubsmusik-fusion-228214.m4a' } },
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
      { id: 'mantra_lalitha',    label: 'Lalitha Sahasranama', emoji: '🌺', color: '#f472b6', top: '#1A0010', bot: '#0A0008', desc: 'Thousand names of the divine feminine',     cat: 'Meditations', src: { uri: 'https://ik.imagekit.io/rcsesr4xf/Lalitha-Sahasranamam.mp3' } },
      { id: 'mantra_shivtandav', label: 'Shiv Tandav',         emoji: '🔱', color: '#a78bfa', top: '#100A1A', bot: '#08050A', desc: 'Cosmic dance of Shiva',                     cat: 'Meditations', src: { uri: 'https://ik.imagekit.io/rcsesr4xf/Shiva-Tandav.mp3' } },
    ],
  },
  {
    category: 'Stotras',
    color: '#34d399',
    icon: '🕉️',
    sounds: [
      { id: 'stotra_bhagya',        label: 'Bhagya Suktam',        emoji: '🌟', color: '#fde68a', top: '#1A1400', bot: '#0A0A00', desc: 'Vedic hymn for prosperity & fortune',      cat: 'Meditations', src: require('../../assets/sounds/bhagya-suktam.m4a') },
      { id: 'stotra_shiv_sankalpa', label: 'Shiv Sankalpa Suktam', emoji: '🕉️', color: '#c4b5fd', top: '#140A1A', bot: '#0A050F', desc: 'Vedic prayer for pure mind & right will', cat: 'Meditations', src: require('../../assets/sounds/shiv-sankalpa-suktam.m4a') },
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
  sitar_tabla_bells:    ['morning_kapha', 'midday_pitta'],
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
  pan_flute:            ['morning_kapha', 'afternoon_vata', 'evening_kapha'],
  arabian_flute:        ['evening_kapha', 'night_pitta'],
  arabic_flute:         ['evening_kapha', 'night_pitta'],
  flute_scale:          ['night_vata', 'morning_kapha', 'evening_kapha'],
  forest_flute:         ['morning_kapha', 'midday_pitta'],
  // ── Tabla (energetic — midday focus only) ────────────────────────────────
  tabla_beat:           ['midday_pitta'],
  tabla_shuffle:        ['midday_pitta'],
  tabla_loop:           ['midday_pitta', 'afternoon_vata'],
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
};

// Fallback when GPS / solar data unavailable
const AUTOMODE_TO_PERIOD: Record<string, string> = {
  morning: 'morning_kapha',
  focus:   'midday_pitta',
  restore: 'afternoon_vata',
  evening: 'evening_kapha',
  sleep:   'night_pitta',
};

const ALL_SOUNDS_LIST: any[] = [
  ...(SLEEP_SOUNDS as readonly any[]).filter(s => !SLEEP_HIDDEN_IDS.has(s.id)),
  ...NADA_SOUNDS,
  ...MANTRA_LIBRARY.flatMap(g => g.sounds),
];

// ─── Solar-aware section label map ────────────────────────────────────────
const PERIOD_SECTION_LABELS: Record<string, { title: string; icon: string; isNight: boolean }> = {
  night_vata:     { title: 'Recommended Now', icon: '✨', isNight: false },
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
  morning_kapha:  { label: 'Morning Rise · Anabolic Phase',  hint: 'Move, nourish and build strength' },
  midday_pitta:   { label: 'Peak Deep Work · Body Phase',    hint: 'Peak focus — tackle what matters most' },
  afternoon_vata: { label: 'Creative Flow · Neural Peak',    hint: 'Create, move and express freely' },
  evening_kapha:  { label: 'Wind Down · Recovery Phase',     hint: 'Ease into rest, connect and unwind' },
  night_pitta:    { label: 'Deep Rest · Body Repair Phase',  hint: 'Your body heals and rebuilds now' },
};

// ─── Ayurvedic day-phase hints (sound + activity suggestions) ─────────────
const PERIOD_DAY_HINTS: Record<string, { icon: string; name: string; line1: string; line2: string; color: string }> = {
  night_vata:    { icon: '✨', name: 'Brahma Muhurta',    line1: 'The most sacred hour — before the world wakes.', line2: 'Meditate or listen to birds. Your body is designed to come alive with these sounds and set the tone for everything that follows.', color: '#818cf8' },
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
  sound: SoundItem | NadaSound; isPlaying: boolean; isPaused: boolean; onPress: () => void; width?: number;
}) {
  const [imgError, setImgError] = useState(false);
  const [dlState, setDlState] = useState<'idle' | 'downloading' | 'done'>(() =>
    isAudioCached(sound.id) ? 'done' : 'idle'
  );
  const [dlProgress, setDlProgress] = useState(0);
  const [, forceRefresh] = useState(0);
  useEffect(() => subscribeToWarm(() => forceRefresh(n => n + 1)), []);

  const imgBundled = SOUND_BUNDLED_IMAGES[sound.id];
  const rawUri = SOUND_IMAGES[sound.id] ?? (sound as any).imageUri;
  const imgUri = !imgBundled ? (rawUri ? getLocalSoundImageUri(rawUri) : undefined) : undefined;
  const imgSource = imgError ? undefined : (imgBundled ?? (imgUri ? { uri: imgUri } : undefined));
  const imgFadeAnim = useRef(new Animated.Value(1)).current;
  const cardW = width ?? CALM_CARD_W;

  const remoteUri: string | null = typeof (sound as any).src?.uri === 'string' ? (sound as any).src.uri : null;
  const canDownload = !!remoteUri;

  const handleDownload = useCallback(async (e: any) => {
    e.stopPropagation?.();
    if (!remoteUri || dlState !== 'idle') return;
    setDlState('downloading');
    setDlProgress(0);
    try {
      await downloadAudioToCache(sound.id, remoteUri, (p) => setDlProgress(p));
      setDlState('done');
    } catch {
      setDlState('idle');
    }
  }, [remoteUri, dlState, sound.id]);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.82} style={{ width: cardW }}>
      <View style={{
        width: cardW, height: cardW,
        borderRadius: 14, overflow: 'hidden',
        borderWidth: isPlaying ? 2 : 0,
        borderColor: sound.color + '90',
      }}>
        <LinearGradient colors={[sound.top, sound.bot]} style={StyleSheet.absoluteFillObject} />
        {imgSource && !imgError && (
          <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: imgFadeAnim }]}>
            <Image
              source={imgSource}
              style={{ width: '100%', height: '100%' }}
              onLoad={() => Animated.timing(imgFadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start()}
              onError={() => setImgError(true)}
              resizeMode="cover"
            />
          </Animated.View>
        )}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.22)']}
          style={StyleSheet.absoluteFillObject}
        />
        {isPlaying && (
          <View style={{
            position: 'absolute', top: 8, right: 8,
            width: 28, height: 28, borderRadius: 14,
            backgroundColor: sound.color + '35',
            borderWidth: 1, borderColor: sound.color + '80',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name={isPaused ? 'pause' : 'musical-notes'} size={12} color={sound.color} />
          </View>
        )}
        {canDownload && (
          <TouchableOpacity
            onPress={handleDownload}
            activeOpacity={0.75}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            style={{
              position: 'absolute', top: 8, left: 8,
              width: 26, height: 26, borderRadius: 13,
              backgroundColor: 'rgba(0,0,0,0.45)',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            {dlState === 'done'
              ? <Ionicons name="checkmark" size={13} color="#4ade80" />
              : dlState === 'downloading'
              ? <Text style={{ fontSize: 8, color: '#fff', fontWeight: '700' }}>{Math.round(dlProgress * 100)}%</Text>
              : <Ionicons name="cloud-download-outline" size={13} color="rgba(255,255,255,0.75)" />
            }
          </TouchableOpacity>
        )}
      </View>
      <Text style={{
        fontSize: 12.5, fontWeight: '400', color: 'rgba(255,255,255,0.90)',
        marginTop: 6, paddingHorizontal: 2, fontFamily: 'Nunito_400Regular', letterSpacing: 0.1,
      }} numberOfLines={2}>{sound.label}</Text>
      <Text style={{
        fontSize: 10.5, color: 'rgba(255,255,255,0.38)',
        marginTop: 1, paddingHorizontal: 2, fontFamily: 'Nunito_400Regular',
      }} numberOfLines={1}>{sound.cat}</Text>
    </TouchableOpacity>
  );
});

// ─── Sound Card — nature image background ────────────────────────────────────
const SoundCard = memo(function SoundCard({
  sound, isPlaying, isPaused, remaining, onPress, compact = false, grid = false,
}: {
  sound: SoundItem; isPlaying: boolean; isPaused: boolean; remaining: number; onPress: () => void; compact?: boolean; grid?: boolean;
}) {
  const pulse = useRef(new Animated.Value(1)).current;
  const [imgError, setImgError] = useState(false);
  const [, forceRefresh] = useState(0);
  useEffect(() => subscribeToWarm(() => forceRefresh(n => n + 1)), []);
  const imgBundled = SOUND_BUNDLED_IMAGES[sound.id];
  const rawUri  = SOUND_IMAGES[sound.id];
  const imgOpacity = useRef(new Animated.Value(1)).current;
  const imgUri  = !imgBundled ? (rawUri ? getLocalSoundImageUri(rawUri) : undefined) : undefined;
  const imgSource = imgError ? undefined : (imgBundled ?? (imgUri ? { uri: imgUri } : undefined));

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
          {/* Nature image — Animated.View wrapper ensures reliable native-driver opacity */}
          {imgSource && (
            <Animated.View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, overflow: 'hidden', opacity: imgOpacity }]}>
              <Image
                source={imgSource}
                style={{ width: '100%', height: '100%' }}
                onLoad={() => Animated.timing(imgOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start()}
                onError={() => setImgError(true)}
                resizeMode="cover"
              />
            </Animated.View>
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
  Meditations: 'flower',
  Birds:       'feather',
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
            <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)' }} />
          </View>

          {/* Label */}
          <Text style={{ fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.38)', letterSpacing: 1.6, textAlign: 'center', marginBottom: 22, textTransform: 'uppercase', fontFamily: 'Nunito_600SemiBold' }}>
            Browse Sounds
          </Text>

          {/* "All Sounds" — full width row */}
          {(() => {
            const isActive = selectedCat === 'All';
            return (
              <TouchableOpacity
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onSelect('All'); onClose(); }}
                activeOpacity={0.80}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 14,
                  marginHorizontal: 20, marginBottom: 12,
                  backgroundColor: isActive ? 'rgba(255,255,255,0.11)' : 'rgba(255,255,255,0.05)',
                  borderRadius: 18, borderWidth: 1.5,
                  borderColor: isActive ? 'rgba(255,255,255,0.42)' : 'rgba(255,255,255,0.10)',
                  padding: 16,
                }}
              >
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' }}>
                  <Ionicons name="apps" size={22} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Nunito_700Bold', letterSpacing: 0.1 }}>All Sounds</Text>
                  <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 3, fontFamily: 'Nunito_400Regular' }}>Everything · all categories</Text>
                </View>
                {isActive && <Ionicons name="checkmark-circle" size={20} color="rgba(255,255,255,0.75)" />}
              </TouchableOpacity>
            );
          })()}

          {/* Category 2-column grid */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 12 }}>
            {(CATEGORIES.slice(1) as Category[]).map(cat => {
              const isActive = selectedCat === cat;
              const meta = CATEGORY_META[cat] ?? { emoji: '🎵', color: '#FFFFFF' };
              const iconName = (CAT_ICONS[cat] ?? 'musical-notes') as any;
              const color = meta.color;
              const cardW = (W - 40 - 12) / 2;
              const effectiveCatForCount = cat === 'Sleep' ? 'Nature' : cat;
              const soundCount = cat === 'Sleep'
                ? (SLEEP_SOUNDS as readonly any[]).filter((s: any) => s.cat === 'Nature' && !SLEEP_HIDDEN_IDS.has(s.id)).length
                : [...(SLEEP_SOUNDS as readonly any[]).filter((s: any) => s.cat === effectiveCatForCount && !SLEEP_HIDDEN_IDS.has(s.id)), ...NADA_SOUNDS.filter((s: any) => s.cat === cat)].length;
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onSelect(cat); onClose(); }}
                  activeOpacity={0.80}
                  style={{
                    width: cardW,
                    backgroundColor: isActive ? `${color}1E` : 'rgba(255,255,255,0.05)',
                    borderRadius: 18, borderWidth: 1.5,
                    borderColor: isActive ? `${color}5A` : 'rgba(255,255,255,0.10)',
                    padding: 18,
                    alignItems: 'flex-start',
                  }}
                >
                  <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: `${color}18`, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${color}30`, marginBottom: 12 }}>
                    <Ionicons name={iconName} size={22} color={color} />
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: isActive ? color : '#FFFFFF', fontFamily: 'Nunito_700Bold', letterSpacing: 0.1 }}>{cat}</Text>
                  <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 3, fontFamily: 'Nunito_400Regular' }}>{soundCount} sounds</Text>
                  {isActive && <Ionicons name="checkmark-circle" size={18} color={color} style={{ position: 'absolute', top: 12, right: 12 }} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
});

// ─── Category Tab Strip — swipeable top tabs ─────────────────────────────────
const CategoryTabStrip = memo(function CategoryTabStrip({
  selectedCat, onSelect, activePeriodId,
}: {
  selectedCat: Category;
  onSelect: (cat: Category, dir?: number) => void;
  activePeriodId?: string | null;
}) {
  const tabLayouts = useRef<Record<string, { x: number; width: number }>>({});
  const indicatorX = useRef(new Animated.Value(0)).current;
  const indicatorW = useRef(new Animated.Value(50)).current;
  const selectedCatRef = useRef(selectedCat);
  const onSelectRef    = useRef(onSelect);

  useEffect(() => { selectedCatRef.current = selectedCat; }, [selectedCat]);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  const moveIndicator = (cat: Category, instant = false) => {
    const layout = tabLayouts.current[cat];
    if (!layout) return;
    if (instant) {
      indicatorX.setValue(layout.x);
      indicatorW.setValue(layout.width);
    } else {
      Animated.parallel([
        Animated.spring(indicatorX, { toValue: layout.x,     useNativeDriver: false, damping: 28, stiffness: 380, mass: 0.6 }),
        Animated.spring(indicatorW, { toValue: layout.width, useNativeDriver: false, damping: 28, stiffness: 380, mass: 0.6 }),
      ]).start();
    }
  };

  useEffect(() => { moveIndicator(selectedCat); }, [selectedCat]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder:  (_, gs) =>
        Math.abs(gs.dx) > 10 && Math.abs(gs.dx) > Math.abs(gs.dy) * 2.0,
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_, gs) => {
        const idx = CATEGORIES.indexOf(selectedCatRef.current);
        const velocity = Math.abs(gs.vx);
        const threshold = velocity > 0.4 ? 28 : 45;
        if (gs.dx < -threshold && idx < CATEGORIES.length - 1) {
          onSelectRef.current(CATEGORIES[idx + 1] as Category, -1);
        } else if (gs.dx > threshold && idx > 0) {
          onSelectRef.current(CATEGORIES[idx - 1] as Category, 1);
        }
      },
    })
  ).current;

  const activeColor = selectedCat === 'All'
    ? '#FFFFFF'
    : getCategoryMeta(selectedCat, activePeriodId).color;

  return (
    <View
      style={{
        backgroundColor: 'rgba(0,0,0,0.34)',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.11)',
      }}
      {...pan.panHandlers}
    >
      <View style={{ flexDirection: 'row', position: 'relative' }}>
        {CATEGORIES.map(cat => {
          const isActive = selectedCat === cat;
          return (
            <TouchableOpacity
              key={cat}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onSelect(cat); }}
              activeOpacity={0.65}
              style={{ flex: 1, alignItems: 'center', paddingTop: 13, paddingBottom: 16 }}
              onLayout={(e) => {
                const { x, width } = e.nativeEvent.layout;
                tabLayouts.current[cat] = { x, width };
                if (cat === selectedCat) moveIndicator(cat, true);
              }}
            >
              <Text style={{
                fontSize: 13,
                fontWeight: isActive ? '700' : '400',
                fontFamily: isActive ? 'Nunito_700Bold' : 'Nunito_400Regular',
                color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.34)',
                letterSpacing: 0.1,
              }}>
                {cat}
              </Text>
            </TouchableOpacity>
          );
        })}
        {/* Glowing animated underline */}
        <Animated.View
          style={{
            position: 'absolute',
            bottom: 0,
            left: indicatorX,
            width: indicatorW,
            height: 2.5,
            borderRadius: 2,
            backgroundColor: activeColor,
            shadowColor: activeColor,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.90,
            shadowRadius: 7,
            elevation: 4,
          }}
        />
      </View>
    </View>
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
  const gridCardW = Math.floor((W - 50) / 2); // 20px pad each side + 10px gap

  return (
    <View style={{ paddingBottom: 8 }}>
      {displayCats.map((cat, catIdx) => {
        // 'Sleep' category mirrors all Nature sounds
        const effectiveCat = cat === 'Sleep' ? 'Nature' : cat;
        const localSounds = (SLEEP_SOUNDS as readonly SoundItem[]).filter(s => s.cat === effectiveCat && !SLEEP_HIDDEN_IDS.has(s.id));
        const nadaSounds = cat === 'Sleep' ? [] : NADA_SOUNDS.filter(s => s.cat === cat && !SLEEP_HIDDEN_IDS.has(s.id));
        const mantraSounds = cat === 'Sleep' ? [] : MANTRA_LIBRARY.flatMap(g => g.sounds).filter(s => s.cat === cat);
        const sounds: any[] = [...localSounds, ...nadaSounds, ...mantraSounds];
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
                      <View style={{ width: 3, height: 22, borderRadius: 2, backgroundColor: meta.color }} />
                      <Text style={{ fontSize: 19, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.1, fontFamily: 'Nunito_700Bold', textShadowColor: 'rgba(0,0,0,0.70)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 8 }}>
                        {cat === 'Nature' ? natureLabel : cat}
                      </Text>
                      {cat === 'Nature' && activePeriodId && (
                        <View style={{
                          backgroundColor: `${meta.color}18`,
                          borderColor: `${meta.color}38`,
                          borderWidth: 1,
                          borderRadius: 6,
                          paddingHorizontal: 6,
                          paddingVertical: 1.5,
                          alignSelf: 'center',
                        }}>
                          <Text style={{
                            fontSize: 7.5,
                            fontWeight: '900',
                            color: meta.color,
                            letterSpacing: 0.8,
                            fontFamily: 'Nunito_900Black',
                          }}>
                            RHYTHM ALIGNED
                          </Text>
                        </View>
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
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                      <View style={{ width: 3, height: 22, borderRadius: 2, backgroundColor: meta.color }} />
                      <Text style={{ fontSize: 19, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.1, fontFamily: 'Nunito_700Bold', textShadowColor: 'rgba(0,0,0,0.70)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 8 }}>
                        {cat === 'Nature' ? natureLabel : cat}
                      </Text>
                      {cat === 'Nature' && activePeriodId && (
                        <View style={{
                          backgroundColor: `${meta.color}18`,
                          borderColor: `${meta.color}38`,
                          borderWidth: 1,
                          borderRadius: 6,
                          paddingHorizontal: 6,
                          paddingVertical: 1.5,
                          alignSelf: 'center',
                        }}>
                          <Text style={{
                            fontSize: 7.5,
                            fontWeight: '900',
                            color: meta.color,
                            letterSpacing: 0.8,
                            fontFamily: 'Nunito_900Black',
                          }}>
                            RHYTHM ALIGNED
                          </Text>
                        </View>
                      )}
                      <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', fontWeight: '500', marginLeft: 2 }}>
                        {sounds.length}
                      </Text>
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
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 10, paddingBottom: 12 }}>
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
  const imgUri     = imgBundledModal ?? (SOUND_IMAGES[sound.id] ? { uri: getLocalSoundImageUri(SOUND_IMAGES[sound.id]) } : null);

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
const REELS_ALL_SOUNDS: PlayableSoundMeta[] = [
  ...(SLEEP_SOUNDS as readonly any[]).filter(s => !SLEEP_HIDDEN_IDS.has(s.id)).map(s => ({ ...s, imageUri: SOUND_IMAGES[s.id] })),
  ...NADA_SOUNDS.map(s => ({ ...s, imageUri: SOUND_IMAGES[s.id] })),
  ...MANTRA_LIBRARY.flatMap(g => g.sounds).map(s => ({ ...s, imageUri: SOUND_IMAGES[s.id], imageBundled: SOUND_BUNDLED_IMAGES[s.id] ?? undefined })),
];
const { width: REEL_W, height: REEL_H } = Dimensions.get('screen');

const REEL_MIX_SOUNDS: PlayableSoundMeta[] = [
  { id: 'morning_birds', label: 'Birds',  emoji: '🐦', color: '#fde68a', top: '#1A1400', bot: '#0A0A00', cat: 'Birds',  desc: 'Dawn chorus',   src: (SLEEP_SOUNDS as readonly any[]).find(s => s.id === 'morning_birds')!.src, imageUri: SOUND_IMAGES['morning_birds'] },
  { id: 'andean_flute',  label: 'Flute',  emoji: '🏔️', color: '#6ee7b7', top: '#081A10', bot: '#040C08', cat: 'Ragas',  desc: 'Andean melody', src: (SLEEP_SOUNDS as readonly any[]).find(s => s.id === 'andean_flute')!.src,  imageUri: SOUND_IMAGES['andean_flute'] },
  { id: 'tabla_beat',    label: 'Tabla',  emoji: '🥁', color: '#f97316', top: '#1A0800', bot: '#0A0400', cat: 'Ragas',  desc: 'Tabla beat',    src: (SLEEP_SOUNDS as readonly any[]).find(s => s.id === 'tabla_beat')!.src,    imageUri: SOUND_IMAGES['tabla_beat'] },
  { id: 'sitar_long',    label: 'Sitar',  emoji: '🎸', color: '#f59e0b', top: '#1A1000', bot: '#0A0800', cat: 'Ragas',  desc: 'Sitar raga',    src: (SLEEP_SOUNDS as readonly any[]).find(s => s.id === 'sitar_long')!.src,    imageUri: SOUND_IMAGES['sitar_long'] },
  { id: 'sea_waves',     label: 'Ocean',  emoji: '🌊', color: '#38bdf8', top: '#0A2030', bot: '#04101A', cat: 'Nature', desc: 'Sea waves',     src: (SLEEP_SOUNDS as readonly any[]).find(s => s.id === 'sea_waves')!.src,     imageUri: SOUND_IMAGES['sea_waves'] },
];

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
  const { bgKey: reelBgKey } = useBgContext(); // kept for potential future use
  const insets = useSafeAreaInsets();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringRotAnim = useRef(new Animated.Value(0)).current;
  const [imgLoadFailed, setImgLoadFailed] = useState(false);
  const [, forceRefresh] = useState(0);
  useEffect(() => subscribeToWarm(() => forceRefresh(n => n + 1)), []);
  const imgBundled = SOUND_BUNDLED_IMAGES[sound.id];
  const rawReelUri = SOUND_IMAGES[sound.id];
  const imgUri     = !imgBundled ? (rawReelUri ? getLocalSoundImageUri(rawReelUri) : undefined) : undefined;
  const imgSource  = (!imgLoadFailed) ? (imgBundled ?? (imgUri ? { uri: imgUri } : undefined)) : undefined;
  const imgFadeAnim = useRef(new Animated.Value(imgSource ? 0 : 1)).current;
  const [timerPickerOpen, setTimerPickerOpen] = useState(false);

  const controlsAnim = useRef(new Animated.Value(1)).current;
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintAnim = useRef(new Animated.Value(0)).current;
  const bumpControlsRef = useRef(() => {
    Animated.timing(controlsAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null; }
  });

  // Slowly rotate ring when playing
  useEffect(() => {
    if (isPlaying && !isPaused && isActive) {
      const loop = Animated.loop(
        Animated.timing(ringRotAnim, { toValue: 1, duration: 12000, easing: Easing.linear, useNativeDriver: true })
      );
      loop.start();
      return () => loop.stop();
    }
  }, [isPlaying, isPaused, isActive]);

  useEffect(() => {
    if (isPlaying && !isPaused && isActive) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.04, duration: 2800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 2800, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
    pulseAnim.setValue(1);
  }, [isPlaying, isPaused, isActive]);

  useEffect(() => {
    Animated.timing(controlsAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null; }
    return () => { if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null; } };
  }, [isActive, isPlaying, isPaused]);

  useEffect(() => {
    if (!isActive || isLast) { hintAnim.setValue(0); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(hintAnim, { toValue: -6, duration: 500, useNativeDriver: true }),
        Animated.timing(hintAnim, { toValue: 0,  duration: 500, useNativeDriver: true }),
        Animated.delay(2200),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isActive, isLast]);

  const RING_SIZE = Math.round(REEL_W * 0.62);
  const ringRotDeg = ringRotAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={{ width: REEL_W, height: REEL_H, backgroundColor: '#000' }}>

      {/* ── FULL-SCREEN background image ── */}
      {imgSource ? (
        <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: imgFadeAnim }]}>
          <Image
            source={imgSource}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
            onLoad={() => Animated.timing(imgFadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }).start()}
            onError={() => setImgLoadFailed(true)}
          />
        </Animated.View>
      ) : (
        // Fallback color gradient when no image
        <LinearGradient
          colors={[sound.color + '40', sound.top, sound.bot, '#000']}
          locations={[0, 0.3, 0.7, 1]}
          style={StyleSheet.absoluteFillObject}
        />
      )}

      {/* ── Multi-layer cinematic scrim ── */}
      {/* Top dark fade for status bar readability */}
      <LinearGradient
        colors={['rgba(0,0,0,0.70)', 'rgba(0,0,0,0.10)', 'transparent']}
        locations={[0, 0.18, 0.4]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      {/* Bottom dark fade for controls readability */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.20)', 'rgba(0,0,0,0.72)', 'rgba(0,0,0,0.92)']}
        locations={[0.38, 0.56, 0.78, 1]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      {/* ── Circular ring in CENTER — shows countdown time inside ── */}
      <View style={{
        position: 'absolute',
        top: 0, bottom: 0, left: 0, right: 0,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 4,
        // Push ring to upper-center (40% from top)
        marginTop: -REEL_H * 0.10,
      }}>
        {/* Outer slow-rotating dashed ring */}
        <Animated.View style={{
          width: RING_SIZE,
          height: RING_SIZE,
          borderRadius: RING_SIZE / 2,
          borderWidth: 2,
          borderColor: isPlaying && !isPaused ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.35)',
          borderStyle: 'solid',
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ rotate: ringRotDeg }],
        }}>
          {/* Dashes on ring */}
          {[0,45,90,135,180,225,270,315].map(angle => (
            <View key={angle} style={{
              position: 'absolute',
              width: 8, height: 2.5,
              borderRadius: 1.5,
              backgroundColor: isPlaying && !isPaused ? sound.color + 'CC' : 'rgba(255,255,255,0.30)',
              left: RING_SIZE / 2 - 4 + (RING_SIZE / 2 - 5) * Math.cos(angle * Math.PI / 180),
              top:  RING_SIZE / 2 - 1.25 + (RING_SIZE / 2 - 5) * Math.sin(angle * Math.PI / 180),
            }} />
          ))}
        </Animated.View>

        {/* Inner static ring */}
        <View style={{
          position: 'absolute',
          width: RING_SIZE - 22,
          height: RING_SIZE - 22,
          borderRadius: (RING_SIZE - 22) / 2,
          borderWidth: 1,
          borderColor: isPlaying && !isPaused ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.08)',
        }} />

        {/* ── CENTER: Big countdown time (or timer label when not playing) ── */}
        <Animated.View style={{
          position: 'absolute',
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale: pulseAnim }],
        }}>
          {isPlaying ? (
            // When playing: show big countdown MM:SS
            <>
              <Text style={{
                fontSize: Math.round(RING_SIZE * 0.24),
                fontWeight: '200',
                color: '#FFFFFF',
                letterSpacing: -2,
                fontFamily: 'Nunito_300Light',
                textShadowColor: 'rgba(0,0,0,0.6)',
                textShadowOffset: { width: 0, height: 2 },
                textShadowRadius: 8,
              }}>
                {fmtTimer(sessionSecs)}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
                <Animated.View style={{
                  width: 6, height: 6, borderRadius: 3,
                  backgroundColor: isPaused ? 'rgba(255,255,255,0.40)' : sound.color,
                  transform: [{ scale: pulseAnim }],
                }} />
                <Text style={{ fontSize: 9, fontWeight: '700', color: isPaused ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.75)', letterSpacing: 2.0 }}>
                  {isPaused ? 'PAUSED' : 'PLAYING'}
                </Text>
              </View>
            </>
          ) : (
            // When not playing: show emoji + label
            <>
              <Text style={{ fontSize: 52, textAlign: 'center' }}>{sound.emoji}</Text>
              <Text style={{ fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.50)', letterSpacing: 1.2, marginTop: 6 }}>TAP TO PLAY</Text>
            </>
          )}
        </Animated.View>

        {/* ── Timer button: pill below the ring ── */}
        <View style={{
          position: 'absolute',
          top: RING_SIZE + 22,
          alignItems: 'center',
        }}>
          {/* Timer picker dropdown */}
          {timerPickerOpen && (
            <View style={{ marginBottom: 10 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 4 }}>
                  {STOP_TIMES.map((t, i) => {
                    const active = stopIdx === i;
                    return (
                      <TouchableOpacity key={t.label} onPress={() => { onChangeTimer(i); setTimerPickerOpen(false); }}
                        style={{
                          paddingHorizontal: 16, paddingVertical: 8, borderRadius: 99,
                          borderWidth: 1,
                          borderColor: active ? 'rgba(255,255,255,0.80)' : 'rgba(255,255,255,0.28)',
                          backgroundColor: active ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.40)',
                        }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: active ? '#FFFFFF' : 'rgba(255,255,255,0.60)' }}>{t.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Timer pill button — matches reference screenshot */}
          <TouchableOpacity
            onPress={() => setTimerPickerOpen(v => !v)}
            activeOpacity={0.76}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 8,
              paddingHorizontal: 24, paddingVertical: 12,
              borderRadius: 99,
              borderWidth: 1,
              borderColor: timerPickerOpen ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.35)',
              backgroundColor: timerPickerOpen ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.12)',
              overflow: 'hidden',
              zIndex: 10,
            }}
          >
            <LinearGradient
              colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.03)']}
              start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <Ionicons name="timer-outline" size={17} color="rgba(255,255,255,0.90)" />
            <Text style={{ fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.90)', letterSpacing: 0.2 }}>
              Timer
            </Text>
          </TouchableOpacity>

          {/* ── Three action icon buttons below timer ── */}
          <View style={{
            flexDirection: 'row',
            gap: 24,
            marginTop: 20,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {/* Sound / Volume icon */}
            <View style={{ alignItems: 'center', gap: 6 }}>
              <TouchableOpacity
                activeOpacity={0.75}
                style={{
                  width: 58, height: 58, borderRadius: 16,
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: 'rgba(255,255,255,0.12)',
                  borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
                }}
              >
                <Ionicons name="rainy-outline" size={24} color="rgba(255,255,255,0.80)" />
              </TouchableOpacity>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: '600' }}>
                {isPlaying ? '100%' : sound.cat.slice(0,5)}
              </Text>
            </View>

            {/* Boost / Energy icon */}
            <View style={{ alignItems: 'center', gap: 6 }}>
              <TouchableOpacity
                activeOpacity={0.75}
                style={{
                  width: 58, height: 58, borderRadius: 16,
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: 'rgba(255,255,255,0.12)',
                  borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
                }}
              >
                <Ionicons name="flash-outline" size={24} color="rgba(255,255,255,0.80)" />
              </TouchableOpacity>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: '600' }}>50%</Text>
            </View>

            {/* Edit / Info icon */}
            <View style={{ alignItems: 'center', gap: 6 }}>
              <TouchableOpacity
                activeOpacity={0.75}
                style={{
                  width: 58, height: 58, borderRadius: 16,
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: 'rgba(255,255,255,0.12)',
                  borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
                }}
              >
                <Ionicons name="create-outline" size={24} color="rgba(255,255,255,0.80)" />
              </TouchableOpacity>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: '600' }}>Edit</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Tap upper area to toggle play/pause */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => { bumpControlsRef.current(); isPlaying ? onToggle() : onPlay(); }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: REEL_H * 0.38, zIndex: 3 }}
      />

      {/* ── Bottom controls ── */}
      <Animated.View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        paddingHorizontal: 26,
        paddingBottom: Math.max(insets.bottom + 14, 26),
        zIndex: 8, opacity: controlsAnim,
      }}>

        {/* Category badge + title */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 5,
            backgroundColor: 'rgba(0,0,0,0.42)', borderRadius: 99,
            paddingHorizontal: 10, paddingVertical: 4,
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
          }}>
            <Text style={{ fontSize: 12 }}>{sound.emoji}</Text>
            <Text style={{ fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.80)', letterSpacing: 0.8 }}>{sound.cat}</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={{ fontSize: 24, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.5, marginBottom: 2 }} numberOfLines={1}>
          {sound.label}
        </Text>
        <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 14, lineHeight: 17 }} numberOfLines={1}>
          {sound.desc}
        </Text>

        {/* Timer progress bar */}
        {isPlaying && (
          <View style={{ marginBottom: 14 }}>
            <View style={{ height: 2.5, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 2 }}>
              <View style={{ height: '100%', borderRadius: 2, backgroundColor: sound.color, width: `${Math.max(2, Math.min(100, (sessionSecs / STOP_TIMES[stopIdx].secs) * 100))}%` }} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 }}>
              <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.30)' }}>0:00</Text>
              <Text style={{ fontSize: 10, fontWeight: '600', color: sound.color + 'CC' }}>{fmtTimer(sessionSecs)} left</Text>
            </View>
          </View>
        )}

        {/* ── Big centered Play/Pause button ── */}
        <View style={{ alignItems: 'center', marginBottom: 8 }}>
          <TouchableOpacity
            onPress={isPlaying ? onToggle : onPlay}
            activeOpacity={0.82}
            style={{
              width: 72, height: 72, borderRadius: 36,
              alignItems: 'center', justifyContent: 'center',
              borderWidth: 1.5,
              borderColor: 'rgba(255,255,255,0.40)',
              shadowColor: sound.color,
              shadowOpacity: 0.55, shadowRadius: 22,
              shadowOffset: { width: 0, height: 5 },
              elevation: 14,
              overflow: 'hidden',
            }}
          >
            <LinearGradient
              colors={['rgba(255,255,255,0.32)', 'rgba(255,255,255,0.10)']}
              start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <Ionicons
              name={isPlaying && !isPaused ? 'pause' : 'play'}
              size={28}
              color="#FFFFFF"
              style={{ marginLeft: isPlaying && !isPaused ? 0 : 3 }}
            />
          </TouchableOpacity>
        </View>

        {/* ── Swipe for next (bottom) ── */}
        {isActive && !isLast && (
          <Animated.View style={{ alignItems: 'center', marginTop: 4, transform: [{ translateY: hintAnim }] }}>
            <Ionicons name="chevron-up" size={14} color="rgba(255,255,255,0.45)" />
            <Text style={{ fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.45)', letterSpacing: 1.4, marginTop: 1 }}>SWIPE UP FOR NEXT</Text>
          </Animated.View>
        )}
      </Animated.View>
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
  const flatRef = useRef<FlatList>(null);
  const [activeIndex, setActiveIndex] = useState(startIndex);
  const [catBanner, setCatBanner] = useState<{ text: string; emoji: string; color: string } | null>(null);
  const bannerAnim = useRef(new Animated.Value(0)).current;
  const swipeAnim = useRef(new Animated.Value(0)).current;
  const prevCatRef = useRef(REELS_ALL_SOUNDS[startIndex]?.cat ?? '');
  const activeIndexRef = useRef(startIndex);
  const playDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Always-fresh ref so debounce callback reads current playingId, not stale closure
  const playingIdRef = useRef(playingId);
  useEffect(() => { playingIdRef.current = playingId; }, [playingId]);

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
      setActiveIndex(startIndex);
      activeIndexRef.current = startIndex;
      prevCatRef.current = REELS_ALL_SOUNDS[startIndex]?.cat ?? '';
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // Scroll FlatList to the correct reel — critical when startIndex changes
      // while the modal is already open (e.g. user taps a different sound card)
      setTimeout(() => {
        flatRef.current?.scrollToIndex({ index: startIndex, animated: false });
      }, 50);
    } else {
      // Focus-out: cancel any pending auto-play timer
      if (playDebounceRef.current) {
        clearTimeout(playDebounceRef.current);
        playDebounceRef.current = null;
      }
    }
  }, [visible, startIndex]);

  // Pre-cache images for the next 2 reels ahead so swipe transitions never show an empty image
  useEffect(() => {
    if (!visible) return;
    const ahead = [activeIndex + 1, activeIndex + 2];
    ahead.forEach(i => {
      const s = REELS_ALL_SOUNDS[i];
      if (!s) return;
      const rawUri = SOUND_IMAGES[s.id] ?? (s as any).imageUri;
      if (rawUri && !SOUND_BUNDLED_IMAGES[s.id] && !isSoundImageCached(rawUri)) {
        ensureSoundImageCached(rawUri).catch(() => {});
      }
    });
  }, [activeIndex, visible]);

  // Auto-play: immediately stop old sound on swipe, debounce start of new sound.
  // Uses playingIdRef (not prop) so the timeout callback always sees the freshest value.
  const onStopSilentRef = useRef(onStopSilent);
  useEffect(() => { onStopSilentRef.current = onStopSilent; }, [onStopSilent]);
  const onPlaySoundRef = useRef(onPlaySound);
  useEffect(() => { onPlaySoundRef.current = onPlaySound; }, [onPlaySound]);

  useEffect(() => {
    if (!visible) return;
    const sound = REELS_ALL_SOUNDS[activeIndex];
    if (!sound) return;
    // Cancel any pending play timer
    if (playDebounceRef.current) { clearTimeout(playDebounceRef.current); playDebounceRef.current = null; }
    // Do NOT call onStopSilent here — playSound already calls stopAllRefs atomically.
    // A pre-debounce stop races with the debounced playSound's own stopAllRefs,
    // causing two concurrent teardowns that corrupt mixRefs and bleed audio.
    // Debounce is 80ms so swipe feels immediate; audio engine still gets a settle window.
    playDebounceRef.current = setTimeout(() => {
      playDebounceRef.current = null;
      if (playingIdRef.current !== sound.id) {
        onPlaySoundRef.current(sound.id);
      }
    }, 80);
    return () => {
      if (playDebounceRef.current) { clearTimeout(playDebounceRef.current); playDebounceRef.current = null; }
    };
  }, [activeIndex, visible]);

  // Category banner animation
  const showCatBannerRef = useRef<(cat: string, s: PlayableSoundMeta) => void>(() => {});
  showCatBannerRef.current = (cat: string, s: PlayableSoundMeta) => {
    setCatBanner({ text: cat, emoji: s.emoji, color: s.color });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    bannerAnim.setValue(0);
    Animated.sequence([
      Animated.spring(bannerAnim, { toValue: 1, tension: 80, friction: 10, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(bannerAnim, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start(() => setCatBanner(null));
  };

  const onViewRef = useRef(({ viewableItems }: any) => {
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
  const viewConfigRef = useRef({ viewAreaCoveragePercentThreshold: 55 });

  if (!visible) return null;

  const activeSound = REELS_ALL_SOUNDS[activeIndex];
  const isLast = activeIndex === REELS_ALL_SOUNDS.length - 1;
  const isFirst = activeIndex === 0;
  const progress = (activeIndex + 1) / REELS_ALL_SOUNDS.length;

  return (
    <Modal visible animationType="slide" transparent={false} statusBarTranslucent onRequestClose={() => onClose(false)}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <FlatList
          ref={flatRef}
          data={REELS_ALL_SOUNDS}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          pagingEnabled
          bounces={false}
          overScrollMode="never"
          onViewableItemsChanged={onViewRef.current}
          viewabilityConfig={viewConfigRef.current}
          getItemLayout={(_, index) => ({ length: REEL_H, offset: REEL_H * index, index })}
          onScrollToIndexFailed={(info) => {
            flatRef.current?.scrollToOffset({ offset: REEL_H * info.index, animated: false });
          }}
          initialScrollIndex={startIndex}
          initialNumToRender={3}
          windowSize={7}
          maxToRenderPerBatch={3}
          updateCellsBatchingPeriod={30}
          removeClippedSubviews={false}
          renderItem={({ item, index }) => (
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
          )}
        />

        {/* ── Top bar overlay ── */}
        <SafeAreaView edges={['top']} style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}>
          {/* Thin progress bar at very top */}
          <View style={{ height: 2, backgroundColor: 'rgba(255,255,255,0.04)' }}>
            <View style={{
              height: '100%', borderRadius: 1,
              backgroundColor: (activeSound?.color ?? '#fff') + '80',
              width: `${progress * 100}%`,
            }} />
          </View>
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 18, paddingTop: 10, paddingBottom: 8,
          }}>
            {/* Left: chevron-down collapse */}
            <TouchableOpacity
              onPress={() => onClose(isLast)}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="chevron-down" size={24} color="rgba(255,255,255,0.80)" />
            </TouchableOpacity>

            {/* Center: active sound title — smaller, sleeker */}
            <Text style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.72)', letterSpacing: 0.1, marginHorizontal: 4 }} numberOfLines={1}>
              {activeSound?.label}
            </Text>

            {/* Right: balance placeholder */}
            <View style={{ width: 44 }} />
          </View>
        </SafeAreaView>

        {/* ── Bottom horizontal progress rail ── */}
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2.5, backgroundColor: '#FFFFFF08', zIndex: 9 }} pointerEvents="none">
          <View style={{
            height: '100%', borderRadius: 2,
            backgroundColor: (activeSound?.color ?? '#fff') + '90',
            width: `${progress * 100}%`,
          }} />
          {/* Glow dot at progress tip */}
          <View style={{
            position: 'absolute', right: `${(1 - progress) * 100}%`, top: -3, width: 9, height: 9,
            borderRadius: 5, backgroundColor: activeSound?.color ?? '#fff',
            marginRight: -4,
          }} />
        </View>


        {/* ── Category transition banner ── */}
        {catBanner && (
          <Animated.View style={{
            position: 'absolute', top: '40%', left: 0, right: 0, alignItems: 'center', zIndex: 20,
            opacity: bannerAnim,
            transform: [
              { scale: bannerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] }) },
              { translateY: bannerAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
            ],
          }}>
            <View style={{
              backgroundColor: catBanner.color + '20',
              borderWidth: 1.5, borderColor: catBanner.color + '50',
              borderRadius: 22, paddingHorizontal: 32, paddingVertical: 16, alignItems: 'center', gap: 6,
            }}>
              <Text style={{ fontSize: 32 }}>{catBanner.emoji}</Text>
              <Text style={{ fontSize: 11, fontWeight: '400', color: catBanner.color, letterSpacing: 0.8, fontFamily: 'Nunito_400Regular' }}>
                {catBanner.text.toUpperCase()}
              </Text>
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 5,
                backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 99,
                paddingHorizontal: 10, paddingVertical: 3, marginTop: 2,
              }}>
                <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: catBanner.color }} />
                <Text style={{ fontSize: 8, fontWeight: '700', color: '#FFFFFF40' }}>Category changed</Text>
              </View>
            </View>
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}

export default function SleepTab() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { bgUri, accentColor, gradientStart } = useBgContext();
  const [now, setNow] = useState(new Date());

  // ── Global sound player (context) ──────────────────────────
  const { playingId, isPaused, sessionSecs, togglePause, stopSound, changeTimer, playSound, openFullPlayer, registerReelsOpener, unregisterReelsOpener } = useSoundPlayer();

  // ── Settings ───────────────────────────────────────────────
  const [wakeHour,      setWakeHour]      = useState(DEFAULT_ALARM_SETTINGS.wakeAlarm.hour);
  const [wakeMinute,    setWakeMinute]    = useState(DEFAULT_ALARM_SETTINGS.wakeAlarm.minute);
  const [bedtimeAlert,  setBedtimeAlert]  = useState(false);
  const [eveningMantra, setEveningMantra] = useState(false);

  // ── Sound UI state ─────────────────────────────────────────
  const [stopIdx,      setStopIdx]      = useState(0);
  const [category,     setCategory]     = useState<Category>('All');
  const [selectedCat,  setSelectedCat]  = useState<Category>('All');
  const [catSheetOpen, setCatSheetOpen] = useState(false);

  // ── Category swipe + transitions ────────────────────────────
  const contentFadeAnim  = useRef(new Animated.Value(1)).current;
  const contentSlideAnim = useRef(new Animated.Value(0)).current;
  const stripScrollRef  = useRef<any>(null);
  const [rowsResetKey, setRowsResetKey] = useState(0);
  const hasRowResetRef = useRef(false);

  useFocusEffect(useCallback(() => {
    _pageScrollRef?.scrollTo({ y: 0, animated: false });
    setRowsResetKey(k => k + 1);
    hasRowResetRef.current = false;
  }, []));

  const onMainScroll = useCallback((e: any) => {
    const y = e.nativeEvent.contentOffset.y;
    if (y > 250 && !hasRowResetRef.current) {
      // Reset while rows are off-screen (scrolled above) — invisible to user
      hasRowResetRef.current = true;
      setRowsResetKey(k => k + 1);
    } else if (y < 50) {
      hasRowResetRef.current = false;
    }
  }, []);

  const changeCategory = useCallback((cat: Category, dir: number = 0) => {
    Animated.sequence([
      Animated.timing(contentFadeAnim,  { toValue: 0.60, duration: 55,  useNativeDriver: true }),
      Animated.timing(contentFadeAnim,  { toValue: 1,    duration: 180, useNativeDriver: true }),
    ]).start();
    if (dir !== 0) {
      contentSlideAnim.setValue(-dir * W * 0.08);
      Animated.spring(contentSlideAnim, { toValue: 0, useNativeDriver: true, damping: 28, stiffness: 380, mass: 0.6 }).start();
    }
    setSelectedCat(cat);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [contentFadeAnim, contentSlideAnim]);

  useEffect(() => {
    _pageScrollRef?.scrollTo({ y: 0, animated: true });
  }, [selectedCat]);

  // Refs for content PanResponder (avoids stale closures)
  const selectedCatPanRef    = useRef<Category>(selectedCat);
  const changeCategoryPanRef = useRef(changeCategory);
  useEffect(() => { selectedCatPanRef.current    = selectedCat;    }, [selectedCat]);
  useEffect(() => { changeCategoryPanRef.current = changeCategory; }, [changeCategory]);

  const contentPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder:  (_, gs) =>
        Math.abs(gs.dx) > 14 && Math.abs(gs.dx) > Math.abs(gs.dy) * 2.0,
      onPanResponderGrant: () => {},
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_, gs) => {
        const cur = selectedCatPanRef.current;
        const idx = CATEGORIES.indexOf(cur);
        const velocity = Math.abs(gs.vx);
        const threshold = velocity > 0.4 ? 30 : 50;
        if (gs.dx < -threshold && idx < CATEGORIES.length - 1) {
          changeCategoryPanRef.current(CATEGORIES[idx + 1] as Category, -1);
        } else if (gs.dx > threshold && idx > 0) {
          changeCategoryPanRef.current(CATEGORIES[idx - 1] as Category, 1);
        }
      },
    })
  ).current;
  const [solarTimes, setSolarTimes]   = useState<SolarTimes | null>(null);
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

  // ── Register reels opener so GlobalPlayerBar re-opens reels ──
  useEffect(() => {
    registerReelsOpener(() => {
      const idx = REELS_ALL_SOUNDS.findIndex(s => s.id === playingId);
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
    });
    return () => unregisterReelsOpener();
  }, [playingId, registerReelsOpener, unregisterReelsOpener]);

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
      if (loc?.lat && loc?.lon) setSolarTimes(getSolarTimes(loc.lat, loc.lon));
    }).catch(() => {});
  }, []);

  // ── Background auto-download all NADA remote sounds ────────────────────────
  useEffect(() => {
    (async () => {
      await initAudioCache();
      const pending = NADA_SOUNDS.filter(s => !isAudioCached(s.id));
      for (const s of pending) {
        try { await downloadAudioToCache(s.id, s.src.uri); } catch { /* silent */ }
      }
    })();
  }, []);

  // ── Play from sleep screen (opens Reels immediately, no pre-mood) ──────────
  // NOTE: No direct playSound call here. SoundReelsModal's auto-play effect owns
  // ALL audio start/stop so there is never a concurrent stopAllRefs race.
  const handleSoundCardTap = useCallback(async (id: string) => {
    const reelIndex = REELS_ALL_SOUNDS.findIndex(s => s.id === id);
    if (reelIndex === -1) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setReelsStartIdx(reelIndex);
    // Ensure the opening reel's image is on disk before showing the modal
    // so the reel never opens with an empty/loading background.
    // Wait at most 2 seconds — after that open regardless.
    const sound = REELS_ALL_SOUNDS[reelIndex];
    const rawUri = SOUND_IMAGES[sound.id] ?? (sound as any).imageUri;
    if (rawUri && !SOUND_BUNDLED_IMAGES[sound.id] && !isSoundImageCached(rawUri)) {
      await Promise.race([
        ensureSoundImageCached(rawUri),
        new Promise<void>(resolve => setTimeout(resolve, 2000)),
      ]);
    }
    // Non-blocking: preload adjacent reel images so swiping is always instant
    [-1, 1, 2, 3].forEach(offset => {
      const adj = REELS_ALL_SOUNDS[reelIndex + offset];
      if (!adj) return;
      const adjUri = SOUND_IMAGES[adj.id] ?? (adj as any).imageUri;
      if (adjUri && !SOUND_BUNDLED_IMAGES[adj.id] && !isSoundImageCached(adjUri)) {
        ensureSoundImageCached(adjUri).catch(() => {});
      }
    });
    setShowReels(true);
  }, []);

  // Reels: play a sound by id (used when swiping between reels — no mood re-ask)
  const handleReelPlaySound = useCallback((id: string) => {
    const meta = REELS_ALL_SOUNDS.find(s => s.id === id);
    if (meta) {
      const metaFull = { ...meta, imageUri: SOUND_IMAGES[id], imageBundled: SOUND_BUNDLED_IMAGES[id] ?? undefined };
      playSound(metaFull, STOP_TIMES[stopIdx].secs, undefined, 3);
    }
  }, [playSound, stopIdx]);

  // Reels: close handler — collapses reels to mini bar; sound keeps playing
  const handleReelClose = useCallback((_fromLastReel: boolean) => {
    setShowReels(false);
  }, []);

  const changeStopTimer = (idx: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStopIdx(idx);
    changeTimer(STOP_TIMES[idx].secs);
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
  const bestBedMins  = bestBedtime.h * 60 + bestBedtime.m;
  const minsUntilBed = bestBedMins > currentMins ? bestBedMins - currentMins : bestBedMins + 1440 - currentMins;
  const hrsToBed     = Math.floor(minsUntilBed / 60);
  const minsToBed    = minsUntilBed % 60;

  // ── Ayurvedic GPS bedtime (sunset + 3.5h, clamped 9PM–11PM) ──
  const ayuBedtime = useMemo(() => {
    if (!solarTimes) return null;
    const dec   = Math.max(21, Math.min(23, solarTimes.sunset + 3.5));
    const total = Math.round(dec * 60);
    return { h: Math.floor(total / 60) % 24, m: total % 60 };
  }, [solarTimes]);

  const displayBedtime = ayuBedtime ?? bestBedtime;

  const sunsetFmt = useMemo(() => {
    if (!solarTimes) return null;
    const h = Math.floor(solarTimes.sunset);
    const m = Math.round((solarTimes.sunset - h) * 60);
    return fmt12(h % 24, m);
  }, [solarTimes]);

  const playingSrc  = SLEEP_SOUNDS.find(s => s.id === playingId);
  const h           = now.getHours();
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
      case 'morning_kapha':  return SOUND_MODES.morning;
      case 'midday_pitta':   return SOUND_MODES.focus;
      case 'afternoon_vata': return SOUND_MODES.restore;
      case 'evening_kapha':  return SOUND_MODES.evening;
      case 'night_pitta':    return SOUND_MODES.sleep;
      default:               return autoMode; // fallback for any unmapped id
    }
  }, [currentPeriod?.id, isBrahmaMuhurta, autoMode]);
  const displayMode = solarDisplayMode;

  const natureCategoryLabel = useMemo(() => {
    const periodId = currentPeriod?.id ?? AUTOMODE_TO_PERIOD[autoMode.key] ?? 'morning_kapha';
    switch (periodId) {
      case 'night_vata':        return 'Awaken in Nature';
      case 'morning_kapha':     return 'Rise in Nature';
      case 'midday_pitta':      return 'Work in Nature';
      case 'midday_pitta_late': return 'Relax in Nature';
      case 'afternoon_vata':    return 'Create in Nature';
      case 'evening_kapha':     return 'Unwind in Nature';
      case 'night_pitta':       return 'Sleep in Nature';
      default:                  return 'Nature';
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
  const showIdealSleepChip = useMemo(() => minsUntilBed <= 60, [minsUntilBed]);

  // Show "approaching sleep" strip after sunset but more than 1 hour before bed
  const showApproachingChip = useMemo(() => {
    if (showIdealSleepChip) return false;
    const nowDecH = now.getHours() + now.getMinutes() / 60;
    if (solarTimes) return nowDecH >= solarTimes.sunset || nowDecH < solarTimes.sunrise;
    return autoMode.key === 'evening' || autoMode.key === 'sleep';
  }, [now, solarTimes, autoMode, showIdealSleepChip]);
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
        return p.includes('night_vata') || p.includes('morning_kapha');
      }
      if (periodKey === 'morning_kapha') {
        if ((s as any).cat === 'Meditations') return true;
        return p.includes('morning_kapha');
      }
      return p.includes(periodKey);
    }) as SoundItem[];
  }, [currentPeriod, autoMode]);
  const featuredSnd = playingSrc ?? (recSounds[0] ?? SLEEP_SOUNDS[0]);
  const bottomPad   = insets.bottom + 80 + (playingId ? 72 : 0);
  const autoMeta    = SLEEP_SOUNDS.find(s => s.id === autoSoundId)!

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
      style={[S.screen, { backgroundColor: accentColor }]}
      imageStyle={{ opacity: 0.65, resizeMode: 'cover' }}>
      {/* Smart gradient overlay — lighter at top to show image, darker at bottom for card readability */}
      <LinearGradient
        colors={['rgba(0,0,0,0.12)', 'rgba(0,0,0,0.20)', 'rgba(0,0,0,0.35)']}
        locations={[0, 0.40, 1]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }} />

      {/* Settings floating button — top-right */}
      <TouchableOpacity
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/(tabs)/settings' as never); }}
        style={{
          position: 'absolute',
          top: (insets?.top ?? 44) + 10,
          right: 16,
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: 'rgba(255,255,255,0.12)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.20)',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 20,
        }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="settings-outline" size={15} color="rgba(255,255,255,0.80)" />
      </TouchableOpacity>

      {/* ── Content area below header — strip + scroll ── */}
      <View style={{ flex: 1 }}>

        <Animated.View style={{ flex: 1, opacity: contentFadeAnim, transform: [{ translateX: contentSlideAnim }] }} {...contentPan.panHandlers}>
        <ScrollView
          ref={(r) => { _pageScrollRef = r; }}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: bottomPad }}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={onMainScroll}
          overScrollMode="never"
          nestedScrollEnabled
          removeClippedSubviews
        >

        {/* ── Hero area — premium center-aligned glassmorphism card ── */}
        <View style={{ width: W, alignItems: 'center', paddingHorizontal: 0 }}>
          <View style={{
            width: '100%',
            backgroundColor: 'rgba(0,0,0,0.16)',
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: 'rgba(255,255,255,0.14)',
            borderRadius: 0,
            paddingHorizontal: 20,
            paddingTop: 18,
            paddingBottom: 16,
            alignItems: 'center',
            overflow: 'hidden',
          }}>
            {/* Subtle top shimmer */}
            <LinearGradient
              colors={['rgba(255,255,255,0.06)', 'transparent']}
              start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.6 }}
              style={StyleSheet.absoluteFillObject}
              pointerEvents="none"
            />
            {/* Main title */}
            <Text style={heroTextStyle}>{displayMode.label}</Text>
            {/* Subtitle */}
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.58)', marginTop: 6, letterSpacing: 0.1, fontWeight: '300', textAlign: 'center' }}>
              {displayMode.subtitle}
            </Text>
            {/* Divider */}
            <View style={{ width: 32, height: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginVertical: 12 }} />
            {/* Bottom hint — compact inline */}
            {showIdealSleepChip ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#10b981' }} />
                <Text style={{ fontSize: 11, fontWeight: '600', color: '#10b981' }}>Ideal Sleep Time</Text>
                <Text style={{ fontSize: 10, color: 'rgba(16,185,129,0.70)', fontWeight: '400' }}>
                  · Bed {fmt12(displayBedtime.h, displayBedtime.m)}
                </Text>
              </View>
            ) : showApproachingChip ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 13 }}>🌙</Text>
                <Text style={{ fontSize: 11, fontWeight: '500', color: 'rgba(167,139,250,0.85)' }}>
                  Sleep in {hrsToBed > 0 ? `${hrsToBed}h ${minsToBed}m` : `${minsToBed}m`}
                </Text>
                <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', fontWeight: '400' }}>
                  · Bed {fmt12(displayBedtime.h, displayBedtime.m)}
                </Text>
              </View>
            ) : (
              <Text style={{ fontSize: 10, fontWeight: '300', color: 'rgba(255,255,255,0.52)', letterSpacing: 0.3, textAlign: 'center', fontStyle: 'italic' }}>
                {isBrahmaMuhurta ? '✨ Brahma Muhurta · sacred dawn hour' : dayHint ? dayHint.name : 'listen to heal as the day dawns up'}
              </Text>
            )}
          </View>
        </View>

        {/* ── Category tab strip — moved below hero card ── */}
        <CategoryTabStrip
          selectedCat={selectedCat}
          onSelect={changeCategory}
          activePeriodId={currentPeriod?.id ?? AUTOMODE_TO_PERIOD[autoMode.key]}
        />

        {/* ── Content container — transparent so wallpaper shows through ── */}
        <View style={{ backgroundColor: 'transparent', paddingTop: 4 }}>

        {/* ── Recommended section ── */}
        {false && selectedCat === 'All' && (<>
          <View style={S.secHeader}>
            <Text style={S.secTitle}>{sectionInfo.title}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: '500', letterSpacing: 0.5 }}>swipe</Text>
              <Ionicons name="chevron-forward" size={11} color="rgba(255,255,255,0.30)" />
            </View>
          </View>
          <View style={{ position: 'relative' }}>
          <GHScrollView
            horizontal
            directionalLockEnabled
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 8 }}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 20, paddingBottom: 4 }}
            decelerationRate={0.88}
            bounces={false}
            overScrollMode="never"
            scrollEventThrottle={8}
          >
            {sectionInfo.isNight && NIGHT_THEMES.map(theme => (
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
            {recSounds.map(s => (
              <CalmSoundCard
                key={s.id}
                sound={s}
                isPlaying={playingId === s.id}
                isPaused={isPaused && playingId === s.id}
                onPress={() => handleSoundCardTap(s.id)}
                width={REC_CARD_W}
              />
            ))}
          </GHScrollView>
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.55)']}
            start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
            style={{ position: 'absolute', right: 0, top: 0, bottom: 4, width: 56, pointerEvents: 'none' }}
          />
          </View>
        </>)}

        {/* ── Soundscapes — Netflix rows ── */}
        {selectedCat === 'All' && (
          <View style={{ paddingHorizontal: 20, marginTop: 12 }}>
            <LinearGradient
              colors={['transparent', 'rgba(255,255,255,0.20)', 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ height: 1.5, borderRadius: 1 }}
            />
          </View>
        )}
        {selectedCat === 'All' && (
          <View style={S.secHeader}>
            <Text style={S.secTitle}>Soundscapes</Text>
            <Text style={S.secCount}>{SLEEP_SOUNDS.length + NADA_SOUNDS.length} sounds · swipe each row</Text>
          </View>
        )}
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

        </View>{/* end lifted container */}
      </ScrollView>
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


  </ImageBackground>
  );
}

const S = StyleSheet.create({
  // ── Scaffold ──────────────────────────────────────────────
  screen:     { flex: 1, backgroundColor: '#04040E', overflow: 'hidden' },
  headerGrad: { backgroundColor: 'rgba(4,8,26,0.74)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.10)' },
  soundImgBg: { width: '100%', flex: 1 } as any,

  // ── Header ────────────────────────────────────────────────
  headerTop:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 6, paddingBottom: 6 },
  appName:      { fontSize: 15, fontWeight: '600', color: '#FFFFFF90', letterSpacing: 0.8, fontFamily: 'Nunito_600SemiBold' },
  wakeChip:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: SLEEP_COLOR + '14', borderWidth: 1, borderColor: SLEEP_COLOR + '30', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5 },
  wakeChipTxt:  { fontSize: 11, fontWeight: '800', color: SLEEP_COLOR + 'CC', fontFamily: 'Nunito_800ExtraBold' },
  greeting:     { fontSize: 30, fontWeight: '100', color: '#fff', letterSpacing: -1.0, marginBottom: 4 },
  greetingSub:  { fontSize: 12, color: '#FFFFFF85', letterSpacing: 0.1 },
  bedtimePill:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, backgroundColor: '#10b98110', borderWidth: 1, borderColor: '#10b98130', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 7, alignSelf: 'flex-start' },
  dot:          { width: 6, height: 6, borderRadius: 3 },

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
  windowCard:     { marginHorizontal: 16, borderRadius: 22, borderWidth: 1, borderColor: SLEEP_COLOR + '35', backgroundColor: 'rgba(4,12,28,0.78)', padding: 20 },
  sleepBar:       { height: 5, backgroundColor: '#FFFFFF08', borderRadius: 3, overflow: 'visible', position: 'relative', marginTop: 4 },
  sleepBarFill:   { position: 'absolute', left: 0, top: 0, bottom: 0, right: 0, borderRadius: 3 },
  sleepBarDot:    { position: 'absolute', top: -5, width: 15, height: 15, borderRadius: 8, borderWidth: 2.5, borderColor: '#000000' },
  barLabel:       { fontSize: 9, color: '#FFFFFF25', fontWeight: '700', letterSpacing: 0.3 },

  // ── Featured Hero Card ─────────────────────────────────────
  featuredCard:  { borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: '#FFFFFF18', padding: 18, height: 186, justifyContent: 'space-between' },
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
  themeCard:     { width: THEME_CARD_W, height: THEME_CARD_H, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', justifyContent: 'flex-end' },
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
  soundCard:     { borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#FFFFFF08' },
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
  chip:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99, borderWidth: 1, borderColor: '#FFFFFF12', backgroundColor: '#FFFFFF05' },
  chipTxt:     { fontSize: 12, fontWeight: '700', fontFamily: 'Nunito_700Bold' },
  chipDivider: { width: 1, height: 22, backgroundColor: '#FFFFFF10', marginHorizontal: 4, alignSelf: 'center' },

  // ── Night Settings grouped card ────────────────────────────
  groupCard:     { marginHorizontal: 16, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', backgroundColor: 'rgba(6,15,40,0.50)', overflow: 'hidden' },
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
  tipCard:    { marginHorizontal: 16, marginBottom: 8, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', backgroundColor: 'rgba(6,15,40,0.50)', flexDirection: 'row', alignItems: 'flex-start', gap: 14, padding: 16, overflow: 'hidden' },
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

