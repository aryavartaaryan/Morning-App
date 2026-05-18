import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch,
  Modal, Animated, Dimensions, ImageBackground, LayoutAnimation, Image, FlatList,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import notifee, { AndroidImportance, AndroidCategory, AndroidVisibility, TriggerType, RepeatFrequency, AlarmType } from '@notifee/react-native';
import { store, KEYS } from '@/lib/storage';
import { AlarmSettings, DEFAULT_ALARM_SETTINGS } from '@/lib/notifications';
import { getSolarTimes, SolarTimes } from '@/lib/solar';
import { getCurrentPeriod } from '@/lib/ayurvedicPeriods';
import { Colors, Font } from '@/constants/theme';
import { useSoundPlayer, PlayableSoundMeta } from '@/lib/soundPlayerContext';
import { SOUND_IMAGES as SOUND_IMAGES_LIB } from '@/lib/sleepSoundsData';

const { width: W } = Dimensions.get('window');
const SLEEP_COLOR = '#007AFF';
const CARD_W        = (W - 48) / 2;
const SQUARE_CARD_W = Math.round((W - 28) / 1.48);  // 1 full card + ~45% of next peeking
const ROW_CARD_W    = SQUARE_CARD_W;
const THEME_CARD_W  = SQUARE_CARD_W;
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
  // ── Sacred additions ────────────────────────────────────────────────────────
  { id: 'tibetan_dreams',     label: 'Tibetan Dreams',        emoji: '🧘', cat: 'Sacred'  as const, color: '#818cf8', top: '#0C0822' as const, bot: '#060411' as const, desc: 'Deep Himalayan soundscape',              src: require('../../assets/sounds/tibetan-dreams.m4a') },
  { id: 'reincarnation_tones',label: 'Reincarnation Tones',   emoji: '♾️', cat: 'Sacred'  as const, color: '#a78bfa', top: '#100830' as const, bot: '#080418' as const, desc: 'Timeless tones of past lives',           src: require('../../assets/sounds/reincarnation-tones.m4a') },
  { id: 'spiritual_journey',  label: 'Spiritual Journey',     emoji: '🌌', cat: 'Sacred'  as const, color: '#c084fc', top: '#140A28' as const, bot: '#0A0518' as const, desc: 'A journey through sacred realms',        src: require('../../assets/sounds/spiritual-journey.m4a') },
  // ── Nature addition ─────────────────────────────────────────────────────────
  { id: 'night_jungle_chiangmai', label: 'Night Jungle',      emoji: '🦟', cat: 'Nature'  as const, color: '#4ade80', top: '#061A08' as const, bot: '#030C04' as const, desc: 'Wild night in Chiangmai jungle',         src: require('../../assets/sounds/night-jungle-chiangmai.m4a') },
  // ── Sitar ───────────────────────────────────────────────────────────────────
  { id: 'sitar_long',          label: 'Sitar Meditation',     emoji: '🎸', cat: 'Sitar'   as const, color: '#f59e0b', top: '#1A1000' as const, bot: '#0A0800' as const, desc: 'Long classical raga session',            src: require('../../assets/sounds/sitar-long.m4a') },
  { id: 'sitar_tabla_bells',   label: 'Sitar, Tabla & Bells', emoji: '🎵', cat: 'Sitar'   as const, color: '#fbbf24', top: '#1A1200' as const, bot: '#0A0900' as const, desc: 'Fusion of strings, rhythm & bells',      src: require('../../assets/sounds/sitar-tabla-bells.m4a') },
  { id: 'indian_sitar_raga',   label: 'Indian Sitar Raga',    emoji: '🎶', cat: 'Sitar'   as const, color: '#fb923c', top: '#1A0E00' as const, bot: '#0A0700' as const, desc: 'Classical Indian raga melody',           src: require('../../assets/sounds/indian-sitar-raga.m4a') },
  { id: 'sitar_summer_raga',   label: 'Summer Healing Raga',  emoji: '☀️', cat: 'Sitar'   as const, color: '#fde68a', top: '#1A1600' as const, bot: '#0A0B00' as const, desc: 'Mango season raga at 432 Hz',            src: require('../../assets/sounds/sitar-summer-raga.m4a') },
  { id: 'sitar_radiance',      label: 'Sitar Radiance',       emoji: '✨', cat: 'Sitar'   as const, color: '#f97316', top: '#1A0800' as const, bot: '#0A0400' as const, desc: 'Radiant Indian classical sitar',         src: require('../../assets/sounds/sitar-radiance.m4a') },
  { id: 'sitar_tanpura_sarangi',label: 'Sitar, Tanpura & Sarangi', emoji: '🪕', cat: 'Sitar' as const, color: '#f59e0b', top: '#1A1000' as const, bot: '#0A0800' as const, desc: 'Full classical Indian ensemble',         src: require('../../assets/sounds/sitar-tanpura-sarangi.m4a') },
  { id: 'sitar_tanpura_bgm',   label: 'Sitar & Tanpura',      emoji: '🎼', cat: 'Sitar'   as const, color: '#fbbf24', top: '#1A1200' as const, bot: '#0A0900' as const, desc: 'Indian classical background melody',     src: require('../../assets/sounds/sitar-tanpura.m4a') },
  { id: 'veena_classical',     label: 'Classical Veena',      emoji: '🪗', cat: 'Sitar'   as const, color: '#fcd34d', top: '#1A1A00' as const, bot: '#0A0A00' as const, desc: "Saraswati's divine string instrument",  src: require('../../assets/sounds/veena-classical.m4a') },
  // ── Flute ───────────────────────────────────────────────────────────────────
  { id: 'andean_flute',        label: 'Andean Flute',         emoji: '🏔️', cat: 'Flute'   as const, color: '#6ee7b7', top: '#081A10' as const, bot: '#040C08' as const, desc: 'High-altitude Andean melody',           src: require('../../assets/sounds/andean-flute.m4a') },
  { id: 'quena_flute',         label: 'Canyon Quena',         emoji: '🏜️', cat: 'Flute'   as const, color: '#86efac', top: '#0A1E12' as const, bot: '#050F09' as const, desc: 'Solo Quena through canyon winds',        src: require('../../assets/sounds/quena-flute.m4a') },
  { id: 'native_flute',        label: 'Native American Flute',emoji: '🪶', cat: 'Flute'   as const, color: '#a3e635', top: '#121400' as const, bot: '#090A00' as const, desc: 'Traditional wood flute from the plains', src: require('../../assets/sounds/native-flute.m4a') },
  { id: 'native_flute_echo',   label: 'Native Flute Echo',    emoji: '🌀', cat: 'Flute'   as const, color: '#86efac', top: '#0A1A10' as const, bot: '#050D08' as const, desc: 'Looping flute with forest echo',         src: require('../../assets/sounds/native-flute-echo.m4a') },
  { id: 'bamboo_flute',        label: 'Bamboo Flute',         emoji: '🎋', cat: 'Flute'   as const, color: '#34d399', top: '#081A0C' as const, bot: '#040C06' as const, desc: 'Amazon bamboo flute groove',             src: require('../../assets/sounds/bamboo-flute.m4a') },
  { id: 'pan_flute',           label: 'Pan Flute Drift',      emoji: '🌬️', cat: 'Flute'   as const, color: '#67e8f9', top: '#081820' as const, bot: '#040C10' as const, desc: 'Pan pipe looping melody',                src: require('../../assets/sounds/pan-flute.m4a') },
  { id: 'arabian_flute',       label: 'Arabian Flute & Drums',emoji: '🌙', cat: 'Flute'   as const, color: '#fbbf24', top: '#1A1400' as const, bot: '#0A0A00' as const, desc: 'Desert night flute with rhythm',         src: require('../../assets/sounds/arabian-flute.m4a') },
  { id: 'arabic_flute',        label: 'Arabic Flute',         emoji: '🕌', cat: 'Flute'   as const, color: '#fde68a', top: '#1A1600' as const, bot: '#0A0B00' as const, desc: 'Maqam-style Arabic flute loop',          src: require('../../assets/sounds/arabic-flute.m4a') },
  { id: 'flute_scale',         label: 'Flute Meditation',     emoji: '🎶', cat: 'Flute'   as const, color: '#6ee7b7', top: '#081810' as const, bot: '#040C08' as const, desc: 'Gentle flute scale for calm mind',       src: require('../../assets/sounds/flute-scale.m4a') },
  { id: 'forest_flute',        label: 'Forest Flute',         emoji: '🌿', cat: 'Flute'   as const, color: '#86efac', top: '#081A0A' as const, bot: '#040C05' as const, desc: 'Soft flute among the trees',             src: require('../../assets/sounds/forest-flute.m4a') },
  // ── Tabla ───────────────────────────────────────────────────────────────────
  { id: 'tabla_beat',          label: 'Tabla Beat',           emoji: '🥁', cat: 'Tabla'   as const, color: '#f97316', top: '#1A0800' as const, bot: '#0A0400' as const, desc: 'Crisp rhythmic tabla beat',              src: require('../../assets/sounds/tabla-beat.m4a') },
  { id: 'tabla_shuffle',       label: 'Tabla Shuffle',        emoji: '🪘', cat: 'Tabla'   as const, color: '#fb923c', top: '#1A0A00' as const, bot: '#0A0500' as const, desc: '105 BPM shuffled tabla loop',            src: require('../../assets/sounds/tabla-shuffle.m4a') },
  { id: 'tabla_loop',          label: 'Tabla Loop 90',        emoji: '🎵', cat: 'Tabla'   as const, color: '#f59e0b', top: '#1A0E00' as const, bot: '#0A0700' as const, desc: '90 BPM tabla rhythm for focus',          src: require('../../assets/sounds/tabla-loop.m4a') },
  { id: 'tabla_jam',           label: 'Tabla Jam',            emoji: '🎶', cat: 'Tabla'   as const, color: '#fbbf24', top: '#1A1200' as const, bot: '#0A0900' as const, desc: 'Energetic tabla jam session',            src: require('../../assets/sounds/tabla-jam.m4a') },
  { id: 'tabla_claves',        label: 'Tabla & Claves',       emoji: '🪗', cat: 'Tabla'   as const, color: '#fb923c', top: '#1A0A00' as const, bot: '#0A0500' as const, desc: 'Tabla meets Latin percussion',           src: require('../../assets/sounds/tabla-claves.m4a') },
  // ── Birds ───────────────────────────────────────────────────────────────────
  { id: 'eagle_feather',       label: 'Eagle Call',           emoji: '🦅', cat: 'Birds'   as const, color: '#78716c', top: '#1A1408' as const, bot: '#0A0A04' as const, desc: 'Majestic eagle soaring above',           src: require('../../assets/sounds/eagle-feather.m4a') },
  { id: 'cuckoo_forest',       label: 'Cuckoo Forest',        emoji: '🌳', cat: 'Birds'   as const, color: '#4ade80', top: '#081A08' as const, bot: '#040C04' as const, desc: 'Cuckoo calling deep in the forest',      src: require('../../assets/sounds/cuckoo-forest.m4a') },
  { id: 'cuckoo_clock',        label: 'Cuckoo Clock',         emoji: '🕰️', cat: 'Birds'   as const, color: '#86efac', top: '#0A1A0A' as const, bot: '#050D05' as const, desc: 'Twelve chimes of a cuckoo clock',        src: require('../../assets/sounds/cuckoo-clock.m4a') },
  { id: 'cuckoo_soft',         label: 'Soft Cuckoo',          emoji: '🐦', cat: 'Birds'   as const, color: '#6ee7b7', top: '#081A10' as const, bot: '#040C08' as const, desc: 'Gentle lone cuckoo call',                src: require('../../assets/sounds/cuckoo-soft.m4a') },
  { id: 'peacock_wild',        label: 'Wild Peacock',         emoji: '🦚', cat: 'Birds'   as const, color: '#34d399', top: '#081808' as const, bot: '#040C04' as const, desc: 'Peacock calling at dawn',                src: require('../../assets/sounds/peacock-wild.m4a') },
  { id: 'cuckoo_chime',        label: 'Cuckoo Chime',         emoji: '🔔', cat: 'Birds'   as const, color: '#a3e635', top: '#101400' as const, bot: '#080A00' as const, desc: 'Clock chimes with cuckoo bell',          src: require('../../assets/sounds/cuckoo-chime.m4a') },
  { id: 'india_countryside_birds', label: 'Sparrows Group',    emoji: '🌾', cat: 'Birds'  as const, color: '#fde68a', top: '#1A1600' as const, bot: '#0A0B00' as const, desc: 'Birdsong from north Indian fields',      src: require('../../assets/sounds/india-countryside-birds.m4a') },
  { id: 'cuckoo_birds_forest', label: 'Cuckoo & Forest Birds',emoji: '🌲', cat: 'Birds'   as const, color: '#86efac', top: '#081A08' as const, bot: '#040C04' as const, desc: 'Mixed forest birds with cuckoo',         src: require('../../assets/sounds/cuckoo-birds-forest.m4a') },
  { id: 'peacock_call',        label: 'Peacock Call',         emoji: '🦚', cat: 'Birds'   as const, color: '#4ade80', top: '#081808' as const, bot: '#040C04' as const, desc: 'Clear peacock call in silence',          src: require('../../assets/sounds/peacock.m4a') },
  { id: 'koel_bird',           label: 'Koel Bird Song',       emoji: '🎵', cat: 'Birds'   as const, color: '#34d399', top: '#081808' as const, bot: '#040C04' as const, desc: 'Indian cuckoo koel singing at dawn',     src: require('../../assets/sounds/koel-bird.m4a') },
  // ── Tanpura ─────────────────────────────────────────────────────────────────
  { id: 'tanpura_sacred_432hz', label: 'Sacred Tanpura 432Hz', emoji: '🕉️', cat: 'Tanpura' as const, color: '#c084fc', top: '#14082A' as const, bot: '#0A0516' as const, desc: 'Gilded tanpura drone at 432 Hz',        src: require('../../assets/sounds/tanpura-sacred-432hz.m4a') },
  { id: 'tanpura_breath',      label: 'Tanpura Breath',        emoji: '🌬️', cat: 'Tanpura' as const, color: '#a78bfa', top: '#100830' as const, bot: '#080418' as const, desc: 'Soft tanpura drone for meditation',      src: require('../../assets/sounds/tanpura-breath.m4a') },
  { id: 'tanpura_loop',        label: 'Tanpura Loop',          emoji: '🔁', cat: 'Tanpura' as const, color: '#818cf8', top: '#0C0822' as const, bot: '#060411' as const, desc: 'Continuous looping tanpura music',       src: require('../../assets/sounds/tanpura-loop.m4a') },
  { id: 'raga_tanpura_drone',  label: 'Raga Tanpura Drone',    emoji: '🌌', cat: 'Tanpura' as const, color: '#6366f1', top: '#0A0820' as const, bot: '#050410' as const, desc: 'Deep space tanpura drone for raga',      src: require('../../assets/sounds/raga-tanpura-drone.m4a') },
  // ── World ───────────────────────────────────────────────────────────────────
  { id: 'sargija_eastern',     label: 'Eastern Sargija',       emoji: '🌏', cat: 'World'   as const, color: '#f97316', top: '#1A0A00' as const, bot: '#0A0500' as const, desc: 'Traditional Eastern string improvisation', src: require('../../assets/sounds/sargija-eastern.m4a') },
  { id: 'tagore_festival',     label: 'Tagore Festival',       emoji: '🎊', cat: 'World'   as const, color: '#fbbf24', top: '#1A1200' as const, bot: '#0A0900' as const, desc: 'Joyful Tagore festival music',           src: require('../../assets/sounds/tagore-festival.m4a') },
  { id: 'world_ambient',       label: 'World Ambient',         emoji: '🌍', cat: 'World'   as const, color: '#a78bfa', top: '#100830' as const, bot: '#080418' as const, desc: 'Global ambient soundscape',              src: require('../../assets/sounds/world-ambient.m4a') },
  { id: 'heaven_tune',         label: 'Heaven Tune',           emoji: '✨',  cat: 'World'   as const, color: '#fde68a', top: '#1A1600' as const, bot: '#0A0B00' as const, desc: 'Traditional heavenly melody',            src: require('../../assets/sounds/heaven-tune.m4a') },
  // ── Sitar additions ────────────────────────────────────────────────────────
  { id: 'sitar_calm',          label: 'Calm Sitar',            emoji: '🎸',  cat: 'Sitar'   as const, color: '#fcd34d', top: '#1A1200' as const, bot: '#0A0900' as const, desc: 'Soft sitar for deep relaxation',         src: require('../../assets/sounds/sitar-calm.m4a') },
  { id: 'veena_raga',          label: 'Veena Raga Kanada',     emoji: '🪗',  cat: 'Sitar'   as const, color: '#f59e0b', top: '#1A1000' as const, bot: '#0A0800' as const, desc: 'Raga Kanada on veena with mridangam',   src: require('../../assets/sounds/veena-raga.m4a') },
  // ── Flute additions ────────────────────────────────────────────────────────
  { id: 'bansuri_forest',      label: 'Bansuri Forest',        emoji: '🌿',  cat: 'Flute'   as const, color: '#34d399', top: '#081A0C' as const, bot: '#040C06' as const, desc: 'Bansuri flute echoing through a forest', src: require('../../assets/sounds/bansuri-forest.m4a') },
  { id: 'bansuri_melody',      label: 'Bansuri Melody',        emoji: '🎵',  cat: 'Flute'   as const, color: '#6ee7b7', top: '#081810' as const, bot: '#040C08' as const, desc: 'Serene Indian bansuri flute melody',     src: require('../../assets/sounds/bansuri-melody.m4a') },
  { id: 'bansuri_tarana',      label: 'Bansuri Tarana',        emoji: '🎶',  cat: 'Flute'   as const, color: '#86efac', top: '#0A1A10' as const, bot: '#050D08' as const, desc: 'Classical tarana raga on bansuri',       src: require('../../assets/sounds/bansuri-tarana.m4a') },
  // ── Tanpura additions ──────────────────────────────────────────────────────
  { id: 'tanpura_mystic',      label: 'Mystic Tanpura',        emoji: '🌌',  cat: 'Tanpura' as const, color: '#818cf8', top: '#0C0830' as const, bot: '#060418' as const, desc: 'Ethereal mystic tanpura waves',          src: require('../../assets/sounds/tanpura-mystic.m4a') },
  { id: 'tanpura_serene',      label: 'Serene Tanpura',        emoji: '🧘',  cat: 'Tanpura' as const, color: '#a78bfa', top: '#100828' as const, bot: '#080414' as const, desc: 'Calm serene tanpura meditation',         src: require('../../assets/sounds/tanpura-serene.m4a') },
  // ── Sacred mantra addition ─────────────────────────────────────────────────
  { id: 'om_shanti',           label: 'Om Shanti',             emoji: '🕉️',  cat: 'Sacred'  as const, color: '#c084fc', top: '#140A28' as const, bot: '#0A0516' as const, desc: 'Vedic peace chant — Om Shanti Shanti Shanti', src: require('../../assets/sounds/om-shanti.m4a') },
] as const;

type SoundId = typeof SLEEP_SOUNDS[number]['id'];
type SoundItem = typeof SLEEP_SOUNDS[number];
const CATEGORIES = ['All', 'Rain', 'Ocean', 'Nature', 'Ambient', 'Sacred', 'Sitar', 'Flute', 'Tabla', 'Birds', 'Tanpura', 'World'] as const;
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
  sea_waves:     'https://images.pexels.com/photos/28760386/pexels-photo-28760386.jpeg?auto=compress&cs=tinysrgb&w=800',
  rocky_shore:   'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=80&auto=format&fit=crop',
  harbor_waves:  'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?w=600&q=80&auto=format&fit=crop',
  flowing_water: 'https://images.pexels.com/photos/10476320/pexels-photo-10476320.jpeg?auto=compress&cs=tinysrgb&w=800',
  forest_breeze: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=600&q=80&auto=format&fit=crop',
  night_forest:  'https://images.pexels.com/photos/19374781/pexels-photo-19374781.jpeg?auto=compress&cs=tinysrgb&w=800',
  gentle_wind:   'https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?w=600&q=80&auto=format&fit=crop',
  city_night:    'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=600&q=80&auto=format&fit=crop',
  campfire:      'https://images.unsplash.com/photo-1504851149312-7a075b496cc7?w=600&q=80&auto=format&fit=crop',
  morning_birds: 'https://images.pexels.com/photos/5969492/pexels-photo-5969492.jpeg?auto=compress&cs=tinysrgb&w=800',
  spring_birds:  'https://images.unsplash.com/photo-1462275646964-a0e3386b89fa?w=600&q=80&auto=format&fit=crop',
  wanderlust:    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&q=80&auto=format&fit=crop',
  forest_birds:  'https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?w=600&q=80&auto=format&fit=crop',
  hz_432:        'https://images.pexels.com/photos/18411177/pexels-photo-18411177.jpeg?auto=compress&cs=tinysrgb&w=800',
  singing_bowl:  'https://images.unsplash.com/photo-1600881333168-2ef49b341f30?w=600&q=80&auto=format&fit=crop',
  tibetan_bowl:  'https://images.pexels.com/photos/6997988/pexels-photo-6997988.jpeg?auto=compress&cs=tinysrgb&w=600',
  morning_flute: 'https://images.pexels.com/photos/5386063/pexels-photo-5386063.jpeg?auto=compress&cs=tinysrgb&w=600',
  sitar:         'https://images.pexels.com/photos/372281/pexels-photo-372281.jpeg?auto=compress&cs=tinysrgb&w=600',
  indian_beats:        'https://images.pexels.com/photos/10491567/pexels-photo-10491567.jpeg?auto=compress&cs=tinysrgb&w=800',
  night_jungle_chiangmai: 'https://images.pexels.com/photos/1366919/pexels-photo-1366919.jpeg?auto=compress&cs=tinysrgb&w=800',
  tibetan_dreams:       'https://images.pexels.com/photos/6997988/pexels-photo-6997988.jpeg?auto=compress&cs=tinysrgb&w=800',
  reincarnation_tones:  'https://images.pexels.com/photos/1252869/pexels-photo-1252869.jpeg?auto=compress&cs=tinysrgb&w=800',
  spiritual_journey:    'https://images.pexels.com/photos/355296/pexels-photo-355296.jpeg?auto=compress&cs=tinysrgb&w=800',
  space_sitar:          'https://images.pexels.com/photos/24489809/pexels-photo-24489809.jpeg?auto=compress&cs=tinysrgb&w=800',
  sitar_long:           'https://images.pexels.com/photos/10491614/pexels-photo-10491614.jpeg?auto=compress&cs=tinysrgb&w=800',
  sitar_tabla_bells:    'https://images.pexels.com/photos/27935987/pexels-photo-27935987.jpeg?auto=compress&cs=tinysrgb&w=800',
  indian_sitar_raga:    'https://images.pexels.com/photos/372281/pexels-photo-372281.jpeg?auto=compress&cs=tinysrgb&w=800',
  sitar_summer_raga:    'https://images.pexels.com/photos/3822622/pexels-photo-3822622.jpeg?auto=compress&cs=tinysrgb&w=800',
  sitar_radiance:       'https://images.pexels.com/photos/3768263/pexels-photo-3768263.jpeg?auto=compress&cs=tinysrgb&w=800',
  sitar_tanpura_sarangi:'https://images.pexels.com/photos/32858785/pexels-photo-32858785.jpeg?auto=compress&cs=tinysrgb&w=800',
  sitar_tanpura_bgm:    'https://images.pexels.com/photos/35736419/pexels-photo-35736419.jpeg?auto=compress&cs=tinysrgb&w=800',
  veena_classical:      'https://images.pexels.com/photos/10491565/pexels-photo-10491565.jpeg?auto=compress&cs=tinysrgb&w=800',
  andean_flute:         'https://images.pexels.com/photos/6647473/pexels-photo-6647473.jpeg?auto=compress&cs=tinysrgb&w=800',
  quena_flute:          'https://images.pexels.com/photos/1237119/pexels-photo-1237119.jpeg?auto=compress&cs=tinysrgb&w=800',
  native_flute:         'https://images.pexels.com/photos/16784046/pexels-photo-16784046.jpeg?auto=compress&cs=tinysrgb&w=800',
  native_flute_echo:    'https://images.pexels.com/photos/6904937/pexels-photo-6904937.jpeg?auto=compress&cs=tinysrgb&w=800',
  bamboo_flute:         'https://images.pexels.com/photos/31250336/pexels-photo-31250336.jpeg?auto=compress&cs=tinysrgb&w=800',
  pan_flute:            'https://images.pexels.com/photos/12391588/pexels-photo-12391588.jpeg?auto=compress&cs=tinysrgb&w=800',
  arabian_flute:        'https://images.pexels.com/photos/8929068/pexels-photo-8929068.jpeg?auto=compress&cs=tinysrgb&w=800',
  arabic_flute:         'https://images.pexels.com/photos/14303418/pexels-photo-14303418.jpeg?auto=compress&cs=tinysrgb&w=800',
  flute_scale:          'https://images.pexels.com/photos/14303413/pexels-photo-14303413.jpeg?auto=compress&cs=tinysrgb&w=800',
  forest_flute:         'https://images.pexels.com/photos/1179229/pexels-photo-1179229.jpeg?auto=compress&cs=tinysrgb&w=800',
  tabla_beat:           'https://images.pexels.com/photos/16743021/pexels-photo-16743021.jpeg?auto=compress&cs=tinysrgb&w=800',
  tabla_shuffle:        'https://images.pexels.com/photos/33437393/pexels-photo-33437393.jpeg?auto=compress&cs=tinysrgb&w=800',
  tabla_loop:           'https://images.pexels.com/photos/31203802/pexels-photo-31203802.jpeg?auto=compress&cs=tinysrgb&w=800',
  tabla_jam:            'https://images.pexels.com/photos/31250338/pexels-photo-31250338.jpeg?auto=compress&cs=tinysrgb&w=800',
  tabla_claves:         'https://images.pexels.com/photos/5909956/pexels-photo-5909956.jpeg?auto=compress&cs=tinysrgb&w=800',
  eagle_feather:        'https://images.pexels.com/photos/1624438/pexels-photo-1624438.jpeg?auto=compress&cs=tinysrgb&w=800',
  cuckoo_forest:        'https://images.pexels.com/photos/10523815/pexels-photo-10523815.jpeg?auto=compress&cs=tinysrgb&w=800',
  cuckoo_clock:         'https://images.pexels.com/photos/36897828/pexels-photo-36897828.jpeg?auto=compress&cs=tinysrgb&w=800',
  cuckoo_soft:          'https://images.pexels.com/photos/32163268/pexels-photo-32163268.jpeg?auto=compress&cs=tinysrgb&w=800',
  peacock_wild:         'https://images.pexels.com/photos/8538423/pexels-photo-8538423.jpeg?auto=compress&cs=tinysrgb&w=800',
  cuckoo_chime:         'https://images.pexels.com/photos/16825546/pexels-photo-16825546.jpeg?auto=compress&cs=tinysrgb&w=800',
  india_countryside_birds:'https://images.pexels.com/photos/20708616/pexels-photo-20708616.jpeg?auto=compress&cs=tinysrgb&w=800',
  cuckoo_birds_forest:  'https://images.pexels.com/photos/1132047/pexels-photo-1132047.jpeg?auto=compress&cs=tinysrgb&w=800',
  peacock_call:         'https://images.pexels.com/photos/36886164/pexels-photo-36886164.jpeg?auto=compress&cs=tinysrgb&w=800',
  koel_bird:            'https://images.pexels.com/photos/3876421/pexels-photo-3876421.jpeg?auto=compress&cs=tinysrgb&w=800',
  tanpura_sacred_432hz: 'https://images.pexels.com/photos/18411177/pexels-photo-18411177.jpeg?auto=compress&cs=tinysrgb&w=800',
  tanpura_breath:       'https://images.pexels.com/photos/13770653/pexels-photo-13770653.jpeg?auto=compress&cs=tinysrgb&w=800',
  tanpura_loop:         'https://images.pexels.com/photos/1712349/pexels-photo-1712349.jpeg?auto=compress&cs=tinysrgb&w=800',
  raga_tanpura_drone:   'https://images.pexels.com/photos/1252869/pexels-photo-1252869.jpeg?auto=compress&cs=tinysrgb&w=800',
  sargija_eastern:      'https://images.pexels.com/photos/3775601/pexels-photo-3775601.jpeg?auto=compress&cs=tinysrgb&w=800',
  tagore_festival:      'https://images.pexels.com/photos/34923010/pexels-photo-34923010.jpeg?auto=compress&cs=tinysrgb&w=800',
  world_ambient:        'https://images.pexels.com/photos/27935987/pexels-photo-27935987.jpeg?auto=compress&cs=tinysrgb&w=800',
  heaven_tune:          'https://images.pexels.com/photos/3171837/pexels-photo-3171837.jpeg?auto=compress&cs=tinysrgb&w=800',
  sitar_calm:           'https://images.pexels.com/photos/2561628/pexels-photo-2561628.jpeg?auto=compress&cs=tinysrgb&w=800',
  veena_raga:           'https://images.pexels.com/photos/6192334/pexels-photo-6192334.jpeg?auto=compress&cs=tinysrgb&w=800',
  bansuri_forest:       'https://images.pexels.com/photos/2260932/pexels-photo-2260932.jpeg?auto=compress&cs=tinysrgb&w=800',
  bansuri_melody:       'https://images.pexels.com/photos/1105666/pexels-photo-1105666.jpeg?auto=compress&cs=tinysrgb&w=800',
  bansuri_tarana:       'https://images.pexels.com/photos/3756766/pexels-photo-3756766.jpeg?auto=compress&cs=tinysrgb&w=800',
  tanpura_mystic:       'https://images.pexels.com/photos/2088205/pexels-photo-2088205.jpeg?auto=compress&cs=tinysrgb&w=800',
  tanpura_serene:       'https://images.pexels.com/photos/18364244/pexels-photo-18364244.jpeg?auto=compress&cs=tinysrgb&w=800',
  mantra_gayatri:       'https://images.pexels.com/photos/3768263/pexels-photo-3768263.jpeg?auto=compress&cs=tinysrgb&w=800',
  mantra_lalitha:       'https://images.unsplash.com/photo-1490750967868-88df5691b30c?w=600&q=80&auto=format&fit=crop',
  mantra_shivtandav:    'https://images.pexels.com/photos/3171837/pexels-photo-3171837.jpeg?auto=compress&cs=tinysrgb&w=800',
  stotra_bhagya:        'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80&auto=format&fit=crop',
  stotra_shiv_sankalpa: 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=600&q=80&auto=format&fit=crop',
  om_shanti:            'https://images.pexels.com/photos/14253835/pexels-photo-14253835.jpeg?auto=compress&cs=tinysrgb&w=800',
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
      { id: 'stotra_bhagya',        label: 'Bhagya Suktam',        emoji: '🌟', color: '#fde68a', top: '#1A1400', bot: '#0A0A00', desc: 'Vedic hymn for prosperity & fortune',      cat: 'Stotras', src: require('../../assets/sounds/bhagya-suktam.m4a') },
      { id: 'stotra_shiv_sankalpa', label: 'Shiv Sankalpa Suktam', emoji: '🕉️', color: '#c4b5fd', top: '#140A1A', bot: '#0A050F', desc: 'Vedic prayer for pure mind & right will', cat: 'Stotras', src: require('../../assets/sounds/shiv-sankalpa-suktam.m4a') },
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
  sitar_radiance:       ['morning_kapha', 'afternoon_vata'],
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
  ...(SLEEP_SOUNDS as readonly any[]),
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

// ─── Night themes (editorial cards) ────────────────────────────────────────
const NIGHT_THEMES = [
  { id: 'deep_sleep',   title: 'Deep Sleep',    subtitle: 'TOTAL SURRENDER', tags: 'All night',  category: 'All'     as Category, gradient: ['#04021A', '#080525', '#030110'] as const, orb1: '#1A0A50', orb2: '#100830', accent: '#7c3aed', featuredId: 'light_rain'    as SoundId, imageUri: 'https://images.pexels.com/photos/1252869/pexels-photo-1252869.jpeg?auto=compress&cs=tinysrgb&w=400' },
  { id: 'rain_stories', title: 'Rain Stories',  subtitle: 'WASH IT AWAY',    tags: 'Storm',      category: 'Rain'    as Category, gradient: ['#061825', '#0A2235', '#040E1A'] as const, orb1: '#0D3050', orb2: '#051528', accent: '#60a5fa', featuredId: 'light_rain'    as SoundId, imageUri: 'https://images.pexels.com/photos/459451/pexels-photo-459451.jpeg?auto=compress&cs=tinysrgb&w=400'   },
  { id: 'ocean_drift',  title: 'Ocean Drift',   subtitle: 'DEEP BLUE PEACE', tags: 'Coastal',    category: 'Ocean'   as Category, gradient: ['#041A20', '#062530', '#021015'] as const, orb1: '#083540', orb2: '#041A25', accent: '#38bdf8', featuredId: 'sea_waves'     as SoundId, imageUri: 'https://images.pexels.com/photos/1295138/pexels-photo-1295138.jpeg?auto=compress&cs=tinysrgb&w=400' },
  { id: 'forest_night', title: 'Forest Night',  subtitle: 'EARTH & SILENCE', tags: 'Wilderness', category: 'Nature'  as Category, gradient: ['#041508', '#07200D', '#020A04'] as const, orb1: '#0A2F12', orb2: '#042008', accent: '#4ade80', featuredId: 'forest_breeze' as SoundId, imageUri: 'https://images.pexels.com/photos/1448055/pexels-photo-1448055.jpeg?auto=compress&cs=tinysrgb&w=400' },
  { id: 'city_rest',    title: 'City Rest',     subtitle: 'URBAN LULLABY',   tags: 'Distant',    category: 'Ambient' as Category, gradient: ['#1A1008', '#2A1A10', '#0E0904'] as const, orb1: '#3A2010', orb2: '#200E06', accent: '#fbbf24', featuredId: 'city_night'    as SoundId, imageUri: 'https://images.pexels.com/photos/466685/pexels-photo-466685.jpeg?auto=compress&cs=tinysrgb&w=400'   },
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

// ─── Sound Card — nature image background ────────────────────────────────────
const SoundCard = memo(function SoundCard({
  sound, isPlaying, isPaused, remaining, onPress, compact = false,
}: {
  sound: SoundItem; isPlaying: boolean; isPaused: boolean; remaining: number; onPress: () => void; compact?: boolean;
}) {
  const pulse = useRef(new Animated.Value(1)).current;
  const imgOpacity = useRef(new Animated.Value(0)).current;
  const [imgError, setImgError] = useState(false);
  const imgBundled = SOUND_BUNDLED_IMAGES[sound.id];
  const imgUri = !imgBundled ? (SOUND_IMAGES[sound.id] ?? undefined) : undefined;
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

  const cardW = compact ? ROW_CARD_W : CARD_W;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.80} style={{ width: cardW, height: cardW }}>
      <Animated.View style={{ flex: 1, transform: [{ scale: pulse }] }}>
        <View style={[S.soundCard, { flex: 1 }, isPlaying && { borderColor: sound.color + '80', borderWidth: 1.5 }]}>
          {/* Fallback gradient — always visible as base layer */}
          <LinearGradient colors={[sound.top, sound.bot]} style={[StyleSheet.absoluteFillObject, { borderRadius: 20 }]} />
          {/* Nature image fades in smoothly once loaded */}
          {imgSource && (
            <Animated.Image
              source={imgSource}
              style={[StyleSheet.absoluteFillObject, { borderRadius: 20, opacity: imgOpacity }]}
              onLoad={() => Animated.timing(imgOpacity, { toValue: 1, duration: 480, useNativeDriver: true }).start()}
              onError={() => setImgError(true)}
              resizeMode="cover"
            />
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

const CATEGORY_META: Record<string, { emoji: string; color: string }> = {
  Rain:    { emoji: '🌧️', color: '#60a5fa' },
  Ocean:   { emoji: '🏖️', color: '#38bdf8' },
  Nature:  { emoji: '🌳', color: '#86efac' },
  Ambient: { emoji: '🏙️', color: '#fbbf24' },
  Sacred:  { emoji: '🔱', color: '#c084fc' },
  Sitar:   { emoji: '🪕', color: '#f59e0b' },
  Flute:   { emoji: '🎵', color: '#6ee7b7' },
  Tabla:   { emoji: '🥁', color: '#f97316' },
  Birds:   { emoji: '🐦', color: '#fde68a' },
  Tanpura: { emoji: '🎶', color: '#a78bfa' },
  World:   { emoji: '🌍', color: '#34d399' },
};

// ─── Netflix-style Category Rows (one horizontal scroll row per category) ────
const CategoryRows = memo(function CategoryRows({
  playingId, isPaused, sessionSecs, onPress,
}: {
  playingId: string | null;
  isPaused: boolean;
  sessionSecs: number;
  onPress: (id: string) => void;
}) {
  const displayCats = CATEGORIES.slice(1); // skip 'All'
  return (
    <View style={{ paddingBottom: 8 }}>
      {displayCats.map(cat => {
        const sounds = (SLEEP_SOUNDS as readonly SoundItem[]).filter(s => s.cat === cat);
        if (!sounds.length) return null;
        return (
          <View key={cat} style={{ marginBottom: 28 }}>
            {/* Row header — prominent section label */}
            {(() => {
              const meta = CATEGORY_META[cat] ?? { emoji: '🎵', color: '#FFFFFF' };
              return (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    {/* Coloured left accent bar */}
                    <View style={{ width: 3, height: 26, borderRadius: 2, backgroundColor: meta.color }} />
                    {/* Emoji */}
                    <Text style={{ fontSize: 20 }}>{meta.emoji}</Text>
                    {/* Category name */}
                    <Text style={{ fontSize: 20, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.3, fontFamily: 'Nunito_800ExtraBold' }}>{cat}</Text>
                    {/* Count pill */}
                    <View style={{ backgroundColor: meta.color + '20', borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: meta.color + '40' }}>
                      <Text style={{ fontSize: 10, fontWeight: '800', color: meta.color, letterSpacing: 0.4 }}>{sounds.length}</Text>
                    </View>
                  </View>
                  {/* Swipe hint */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <Text style={{ fontSize: 9, fontWeight: '700', color: '#FFFFFF28', letterSpacing: 0.8 }}>SWIPE</Text>
                    <Ionicons name="chevron-forward" size={10} color="#FFFFFF28" />
                  </View>
                </View>
              );
            })()}
            {/* Horizontal row — swipe to see more */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 14, paddingBottom: 4 }}
              decelerationRate="fast"
              snapToInterval={ROW_CARD_W + 14}
              snapToAlignment="start"
              scrollEventThrottle={16}
            >
              {sounds.map(s => (
                <SoundCard
                  key={s.id}
                  sound={s}
                  isPlaying={playingId === s.id}
                  isPaused={isPaused && playingId === s.id}
                  remaining={sessionSecs}
                  onPress={() => onPress(s.id)}
                  compact
                />
              ))}
            </ScrollView>
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

// ─── Instagram Reels-style Sound Player ──────────────────────────────────────
const REELS_ALL_SOUNDS = SLEEP_SOUNDS as readonly SoundItem[];
const { width: REEL_W, height: REEL_H } = Dimensions.get('window');

const REEL_MIX_SOUNDS: PlayableSoundMeta[] = [
  { id: 'morning_birds', label: 'Birds',  emoji: '🐦', color: '#fde68a', top: '#1A1400', bot: '#0A0A00', cat: 'Nature', desc: 'Dawn chorus',   src: (SLEEP_SOUNDS as readonly any[]).find(s => s.id === 'morning_birds')!.src, imageUri: SOUND_IMAGES['morning_birds'] },
  { id: 'andean_flute',  label: 'Flute',  emoji: '🏔️', color: '#6ee7b7', top: '#081A10', bot: '#040C08', cat: 'Flute',  desc: 'Andean melody', src: (SLEEP_SOUNDS as readonly any[]).find(s => s.id === 'andean_flute')!.src,  imageUri: SOUND_IMAGES['andean_flute'] },
  { id: 'tabla_beat',    label: 'Tabla',  emoji: '🥁', color: '#f97316', top: '#1A0800', bot: '#0A0400', cat: 'Tabla',  desc: 'Tabla beat',    src: (SLEEP_SOUNDS as readonly any[]).find(s => s.id === 'tabla_beat')!.src,    imageUri: SOUND_IMAGES['tabla_beat'] },
  { id: 'sitar_long',    label: 'Sitar',  emoji: '🎸', color: '#f59e0b', top: '#1A1000', bot: '#0A0800', cat: 'Sitar',  desc: 'Sitar raga',    src: (SLEEP_SOUNDS as readonly any[]).find(s => s.id === 'sitar_long')!.src,    imageUri: SOUND_IMAGES['sitar_long'] },
  { id: 'sea_waves',     label: 'Ocean',  emoji: '🌊', color: '#38bdf8', top: '#0A2030', bot: '#04101A', cat: 'Ocean',  desc: 'Sea waves',     src: (SLEEP_SOUNDS as readonly any[]).find(s => s.id === 'sea_waves')!.src,     imageUri: SOUND_IMAGES['sea_waves'] },
];

function ReelCard({
  sound, isActive, isPlaying, isPaused, sessionSecs, stopIdx,
  onPlay, onToggle, onStop, onChangeTimer,
}: {
  sound: SoundItem; isActive: boolean;
  isPlaying: boolean; isPaused: boolean; sessionSecs: number; stopIdx: number;
  onPlay: () => void; onToggle: () => void; onStop: () => void;
  onChangeTimer: (i: number) => void;
}) {
  const { addToMix, removeFromMix, mixedSounds } = useSoundPlayer();
  const zoomAnim  = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [mixerOpen, setMixerOpen] = useState(false);
  const mixerAnim = useRef(new Animated.Value(0)).current;
  const [clockTime, setClockTime] = useState(() => {
    const now = new Date();
    return fmt12(now.getHours(), now.getMinutes());
  });

  useEffect(() => {
    const id = setInterval(() => {
      const now = new Date();
      setClockTime(fmt12(now.getHours(), now.getMinutes()));
    }, 15000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (isActive) {
      zoomAnim.setValue(1.07);
      Animated.spring(zoomAnim, { toValue: 1, tension: 38, friction: 9, useNativeDriver: true }).start();
    }
  }, [isActive]);

  useEffect(() => {
    if (isPlaying && !isPaused && isActive) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.035, duration: 2800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,     duration: 2800, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
    pulseAnim.setValue(1);
  }, [isPlaying, isPaused, isActive]);

  const toggleMixer = () => {
    const toValue = mixerOpen ? 0 : 1;
    Animated.spring(mixerAnim, { toValue, tension: 72, friction: 10, useNativeDriver: true }).start();
    setMixerOpen(v => !v);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const imgBundled = SOUND_BUNDLED_IMAGES[sound.id];
  const imgUri     = !imgBundled ? (SOUND_IMAGES[sound.id] ?? undefined) : undefined;
  const imgSource  = imgBundled ?? (imgUri ? { uri: imgUri } : undefined);
  const mixIds     = new Set(mixedSounds.map(s => s.id));

  return (
    <View style={{ width: REEL_W, height: REEL_H, backgroundColor: '#0a0a0a' }}>

      {/* ── Background image — always fully visible, scale only ── */}
      <Animated.View style={[StyleSheet.absoluteFillObject, {
        transform: [{ scale: Animated.multiply(zoomAnim, pulseAnim) }],
      }]}>
        {imgSource ? (
          <ImageBackground
            source={imgSource}
            style={StyleSheet.absoluteFillObject}
            imageStyle={{ resizeMode: 'cover' }}
          />
        ) : (
          <LinearGradient colors={[sound.top, sound.bot, '#000']} style={StyleSheet.absoluteFillObject} />
        )}
      </Animated.View>

      {/* ── Soft bottom-only gradient for text legibility — no flat filter ── */}
      <LinearGradient
        colors={['transparent', 'transparent', 'rgba(0,0,0,0.18)', 'rgba(0,0,0,0.70)', 'rgba(0,0,0,0.93)']}
        locations={[0, 0.44, 0.60, 0.82, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* ── Plus button (CENTER) — opens mixer panel ── */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', zIndex: 6 }} pointerEvents="box-none">
        <TouchableOpacity
          onPress={toggleMixer}
          activeOpacity={0.78}
          style={{
            width: 64, height: 64, borderRadius: 32,
            backgroundColor: 'rgba(255,255,255,0.10)',
            borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.32)',
            alignItems: 'center', justifyContent: 'center',
            shadowColor: '#fff', shadowOpacity: 0.08, shadowRadius: 20, shadowOffset: { width: 0, height: 0 },
          }}
        >
          <Ionicons name={mixerOpen ? 'close' : 'add'} size={30} color="rgba(255,255,255,0.90)" />
        </TouchableOpacity>
        {mixedSounds.length > 0 && !mixerOpen && (
          <View style={{
            position: 'absolute', top: '50%', left: '50%',
            marginTop: -36, marginLeft: 14,
            width: 18, height: 18, borderRadius: 9,
            backgroundColor: sound.color, borderWidth: 1.5, borderColor: '#000',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 8, fontWeight: '900', color: '#000' }}>{mixedSounds.length}</Text>
          </View>
        )}
      </View>

      {/* ── Mixer panel — slides in when + is tapped ── */}
      <Animated.View
        pointerEvents={mixerOpen ? 'auto' : 'none'}
        style={{
          position: 'absolute', top: 100, left: 16, right: 16, zIndex: 5,
          opacity: mixerAnim,
          transform: [{ translateY: mixerAnim.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) }],
        }}
      >
        <View style={{
          flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
          backgroundColor: 'rgba(0,0,0,0.55)',
          borderRadius: 22, paddingHorizontal: 14, paddingVertical: 14,
          borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
        }}>
          {REEL_MIX_SOUNDS.map(ms => {
            const isMainSound = ms.id === sound.id;
            const inMix       = mixIds.has(ms.id) && !isMainSound;
            return (
              <TouchableOpacity
                key={ms.id}
                onPress={() => {
                  if (isMainSound) return;
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  if (inMix) removeFromMix(ms.id);
                  else       addToMix(ms);
                }}
                activeOpacity={isMainSound ? 1 : 0.72}
                style={{ alignItems: 'center', gap: 5, opacity: isMainSound ? 0.26 : 1 }}
              >
                <View style={{
                  width: 44, height: 44, borderRadius: 22,
                  backgroundColor: inMix ? ms.color + '28' : 'rgba(255,255,255,0.09)',
                  borderWidth: 1.5, borderColor: inMix ? ms.color + '99' : 'rgba(255,255,255,0.14)',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ fontSize: 20 }}>{ms.emoji}</Text>
                  {inMix && (
                    <View style={{
                      position: 'absolute', bottom: -2, right: -2,
                      width: 14, height: 14, borderRadius: 7,
                      backgroundColor: ms.color, borderWidth: 2, borderColor: '#000',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Ionicons name="checkmark" size={7} color="#000" />
                    </View>
                  )}
                </View>
                <Text style={{
                  fontSize: 7.5, fontWeight: '700', letterSpacing: 0.3,
                  color: inMix ? ms.color : 'rgba(255,255,255,0.34)',
                }}>
                  {ms.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={{
          fontSize: 6.5, fontWeight: '700', color: 'rgba(255,255,255,0.18)',
          textAlign: 'center', letterSpacing: 2, marginTop: 5,
        }}>
          TAP TO MIX IN
        </Text>
      </Animated.View>

      {/* ── Subtle pulsing orb — only when playing ── */}
      {isPlaying && isActive && (
        <View style={[StyleSheet.absoluteFillObject, { alignItems: 'center', justifyContent: 'center' }]}>
          <Animated.View style={{
            width: 76, height: 76, borderRadius: 38,
            backgroundColor: isPaused ? 'rgba(255,255,255,0.03)' : sound.color + '0D',
            borderWidth: 1, borderColor: isPaused ? 'rgba(255,255,255,0.09)' : sound.color + '26',
            alignItems: 'center', justifyContent: 'center',
            transform: [{ scale: pulseAnim }],
          }}>
            <Text style={{ fontSize: 26, opacity: 0.40 }}>{sound.emoji}</Text>
          </Animated.View>
        </View>
      )}

      {/* ── Bottom overlay ── */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 22, paddingBottom: 54 }}>

        {/* Now playing status */}
        {isPlaying && (
          <View style={{
            alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7,
            backgroundColor: 'rgba(0,0,0,0.24)', borderRadius: 99,
            paddingHorizontal: 11, paddingVertical: 5, marginBottom: 10,
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
          }}>
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: isPaused ? '#555' : sound.color }} />
            <Text style={{ fontSize: 8, fontWeight: '800', letterSpacing: 1.5, color: isPaused ? 'rgba(255,255,255,0.32)' : sound.color }}>
              {isPaused ? 'PAUSED' : 'NOW PLAYING'}
            </Text>
          </View>
        )}

        {/* Title + desc */}
        <Text style={{ fontSize: 32, fontWeight: '200', color: '#FFFFFF', letterSpacing: -1.2, marginBottom: 3 }}>
          {sound.label}
        </Text>
        <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', marginBottom: 24, lineHeight: 17 }}>
          {sound.desc}
        </Text>

        {/* Timer pills row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 18, marginHorizontal: -4 }}>
          <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 4 }}>
            {STOP_TIMES.map((t, i) => {
              const active = stopIdx === i;
              return (
                <TouchableOpacity key={t.label} onPress={() => onChangeTimer(i)}
                  style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 99, borderWidth: 1, borderColor: active ? sound.color + '80' : 'rgba(255,255,255,0.14)', backgroundColor: active ? sound.color + '1A' : 'rgba(0,0,0,0.22)' }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: active ? sound.color : 'rgba(255,255,255,0.45)' }}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* Controls: single glassy play/pause + circular clock */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 4 }}>

          {/* Ultra-transparent glassy play/pause button */}
          <TouchableOpacity
            onPress={isPlaying ? onToggle : onPlay}
            activeOpacity={0.74}
            style={{
              width: 70, height: 70, borderRadius: 35,
              backgroundColor: 'rgba(255,255,255,0.09)',
              borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.20)',
              alignItems: 'center', justifyContent: 'center',
              shadowColor: '#fff', shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 0 },
              elevation: 4,
            }}
          >
            <Ionicons
              name={isPlaying && !isPaused ? 'pause' : 'play'}
              size={28}
              color="rgba(255,255,255,0.88)"
            />
          </TouchableOpacity>

          {/* Circular clock */}
          <View style={{
            width: 60, height: 60, borderRadius: 30,
            backgroundColor: 'rgba(0,0,0,0.20)',
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.11)',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 12, fontWeight: '200', color: 'rgba(255,255,255,0.82)', letterSpacing: 0, textAlign: 'center', lineHeight: 14 }}>
              {clockTime.split(' ')[0]}
            </Text>
            <Text style={{ fontSize: 7, fontWeight: '500', color: 'rgba(255,255,255,0.42)', letterSpacing: 0.8, textAlign: 'center' }}>
              {clockTime.split(' ')[1]}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function SoundReelsModal({
  visible, startIndex, playingId, isPaused, sessionSecs, stopIdx,
  onPlaySound, onToggle, onStop, onClose, onChangeTimer,
}: {
  visible: boolean; startIndex: number;
  playingId: string | null; isPaused: boolean; sessionSecs: number; stopIdx: number;
  onPlaySound: (id: string) => void; onToggle: () => void; onStop: () => void;
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

  // Swipe hint animation (pulsing triple-chevron)
  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(swipeAnim, { toValue: -10, duration: 700, useNativeDriver: true }),
        Animated.timing(swipeAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
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
      if (startIndex > 0) {
        setTimeout(() => {
          flatRef.current?.scrollToIndex({ index: startIndex, animated: false });
        }, 80);
      }
    } else {
      // Focus-out: cancel any pending auto-play timer
      if (playDebounceRef.current) {
        clearTimeout(playDebounceRef.current);
        playDebounceRef.current = null;
      }
    }
  }, [visible, startIndex]);

  // Auto-play sound when active reel changes — debounced to prevent overlap on fast swipes
  useEffect(() => {
    if (!visible) return;
    const sound = REELS_ALL_SOUNDS[activeIndex];
    if (!sound) return;
    if (playingId === sound.id) return;
    if (playDebounceRef.current) clearTimeout(playDebounceRef.current);
    playDebounceRef.current = setTimeout(() => {
      onPlaySound(sound.id);
    }, 180);
    return () => {
      if (playDebounceRef.current) clearTimeout(playDebounceRef.current);
    };
  }, [activeIndex, visible]);

  // Category banner animation
  const showCatBannerRef = useRef<(cat: string, s: SoundItem) => void>(() => {});
  showCatBannerRef.current = (cat: string, s: SoundItem) => {
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
  const viewConfigRef = useRef({ viewAreaCoveragePercentThreshold: 60 });

  if (!visible) return null;

  const activeSound = REELS_ALL_SOUNDS[activeIndex];
  const isLast = activeIndex === REELS_ALL_SOUNDS.length - 1;
  const isFirst = activeIndex === 0;
  const progress = (activeIndex + 1) / REELS_ALL_SOUNDS.length;

  return (
    <Modal visible animationType="fade" transparent={false} statusBarTranslucent onRequestClose={() => onClose(false)}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <FlatList
          ref={flatRef}
          data={REELS_ALL_SOUNDS as unknown as SoundItem[]}
          keyExtractor={(item) => item.id}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToAlignment="start"
          decelerationRate="fast"
          onViewableItemsChanged={onViewRef.current}
          viewabilityConfig={viewConfigRef.current}
          getItemLayout={(_, index) => ({ length: REEL_H, offset: REEL_H * index, index })}
          initialScrollIndex={startIndex}
          windowSize={3}
          maxToRenderPerBatch={3}
          removeClippedSubviews
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

            {/* Center: active sound title */}
            <Text style={{ flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.1, marginHorizontal: 4 }} numberOfLines={1}>
              {activeSound?.label}
            </Text>

            {/* Right: stop circle */}
            <TouchableOpacity
              onPress={onStop}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="stop-circle-outline" size={22} color="rgba(255,255,255,0.50)" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        {/* ── Right-side vertical progress rail ── */}
        <View style={{
          position: 'absolute', right: 10, top: '28%', bottom: '28%',
          width: 3, borderRadius: 2, backgroundColor: '#FFFFFF0C',
        }}>
          <View style={{
            position: 'absolute', bottom: 0, width: '100%', borderRadius: 2,
            backgroundColor: (activeSound?.color ?? '#fff') + '90',
            height: `${progress * 100}%`,
          }} />
          {/* Glow dot at progress tip */}
          <View style={{
            position: 'absolute', bottom: `${progress * 100}%`, left: -3, width: 9, height: 9,
            borderRadius: 5, backgroundColor: activeSound?.color ?? '#fff',
            marginBottom: -4,
          }} />
        </View>

        {/* ── Top swipe ripple indicator ── */}
        {!isFirst && (
          <Animated.View style={{
            position: 'absolute', top: 96, left: 0, right: 0, alignItems: 'center',
            transform: [{ translateY: Animated.multiply(swipeAnim, new Animated.Value(-1)) }],
          }}>
            <View style={{ alignItems: 'center', gap: 5 }}>
              {[0.90, 0.55, 0.25].map((op, idx) => (
                <View key={idx} style={{
                  width: idx === 1 ? 28 : idx === 0 ? 20 : 14,
                  height: 1.5,
                  borderRadius: 1,
                  backgroundColor: `rgba(255,255,255,${op})`,
                }} />
              ))}
            </View>
          </Animated.View>
        )}

        {/* ── Bottom swipe ripple indicator ── */}
        {!isLast ? (
          <Animated.View style={{
            position: 'absolute', bottom: 16, left: 0, right: 0, alignItems: 'center',
            transform: [{ translateY: swipeAnim }],
          }}>
            <View style={{ alignItems: 'center', gap: 5 }}>
              {[0.25, 0.55, 0.90].map((op, idx) => (
                <View key={idx} style={{
                  width: idx === 0 ? 14 : idx === 1 ? 28 : 20,
                  height: 1.5,
                  borderRadius: 1,
                  backgroundColor: `rgba(255,255,255,${op})`,
                }} />
              ))}
            </View>
            <Text style={{ fontSize: 6, fontWeight: '800', color: 'rgba(255,255,255,0.18)', letterSpacing: 3, marginTop: 6 }}>SCROLL</Text>
          </Animated.View>
        ) : (
          <View style={{ position: 'absolute', bottom: 12, left: 0, right: 0, alignItems: 'center' }}>
            <View style={{
              backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: '#FFFFFF15',
              borderRadius: 99, paddingHorizontal: 16, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 6,
            }}>
              <Ionicons name="checkmark-circle" size={12} color="#FFFFFF35" />
              <Text style={{ fontSize: 8, fontWeight: '900', color: '#FFFFFF35', letterSpacing: 1.2 }}>END OF SOUNDS</Text>
            </View>
          </View>
        )}

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
              <Text style={{ fontSize: 11, fontWeight: '900', color: catBanner.color, letterSpacing: 2.5 }}>
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
  const [now, setNow] = useState(new Date());

  // ── Global sound player (context) ──────────────────────────
  const { playingId, isPaused, sessionSecs, togglePause, stopSound, changeTimer, playSound, requestPlay, openFullPlayer, registerReelsOpener, unregisterReelsOpener } = useSoundPlayer();

  // ── Settings ───────────────────────────────────────────────
  const [wakeHour,      setWakeHour]      = useState(DEFAULT_ALARM_SETTINGS.wakeAlarm.hour);
  const [wakeMinute,    setWakeMinute]    = useState(DEFAULT_ALARM_SETTINGS.wakeAlarm.minute);
  const [bedtimeAlert,  setBedtimeAlert]  = useState(false);
  const [eveningMantra, setEveningMantra] = useState(false);

  // ── Sound UI state ─────────────────────────────────────────
  const [stopIdx,      setStopIdx]      = useState(0);
  const [category,     setCategory]     = useState<Category>('All');
  const pendingOpenRef = useRef<string | null>(null);
  const [solarTimes, setSolarTimes]   = useState<SolarTimes | null>(null);
  const [sleepIntelOpen, setSleepIntelOpen] = useState(false);
  const chevronAnim = useRef(new Animated.Value(0)).current;
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
      const idx = (SLEEP_SOUNDS as readonly SoundItem[]).findIndex(s => s.id === playingId);
      setReelsStartIdx(idx !== -1 ? idx : 0);
      setShowReels(true);
    });
    return () => unregisterReelsOpener();
  }, [playingId, registerReelsOpener, unregisterReelsOpener]);

  // ── Live clock ──────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // ── Pre-warm image cache so all sound card photos load instantly ──────────
  useEffect(() => {
    const t = setTimeout(() => {
      Object.values(SOUND_IMAGES).forEach(url => {
        if (url) Image.prefetch(url).catch(() => {});
      });
    }, 2500);
    return () => clearTimeout(t);
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

  // ── Play from sleep screen (opens Reels) ────────────────────
  const handleSoundCardTap = useCallback((id: string) => {
    const soundIndex = (SLEEP_SOUNDS as readonly SoundItem[]).findIndex(s => s.id === id);

    // Mantra sounds: fall back to the old full-player behaviour
    if (soundIndex === -1) {
      const meta = MANTRA_LIBRARY.flatMap(g => g.sounds).find(s => s.id === id);
      if (meta) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const metaFull = { ...(meta as unknown as PlayableSoundMeta), imageUri: SOUND_IMAGES[id], imageBundled: SOUND_BUNDLED_IMAGES[id] ?? undefined };
        pendingOpenRef.current = id;
        if (playingId) { playSound(metaFull, STOP_TIMES[stopIdx].secs); }
        else           { requestPlay(metaFull, STOP_TIMES[stopIdx].secs); }
      }
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setReelsStartIdx(soundIndex);

    if (playingId === id) {
      // Already playing this sound — just re-open Reels
      setShowReels(true);
      return;
    }

    const meta = SLEEP_SOUNDS[soundIndex];
    const metaFull = { ...(meta as unknown as PlayableSoundMeta), imageUri: SOUND_IMAGES[id], imageBundled: SOUND_BUNDLED_IMAGES[id] ?? undefined };
    pendingOpenRef.current = id;
    if (playingId) { playSound(metaFull, STOP_TIMES[stopIdx].secs); }
    else           { requestPlay(metaFull, STOP_TIMES[stopIdx].secs); }
  }, [playingId, playSound, requestPlay, stopIdx]);

  // Open Reels once the sound actually starts playing
  useEffect(() => {
    if (playingId && pendingOpenRef.current === playingId) {
      const idx = (SLEEP_SOUNDS as readonly SoundItem[]).findIndex(s => s.id === playingId);
      if (idx !== -1) {
        setReelsStartIdx(idx);
        setShowReels(true);
      } else {
        openFullPlayer();
      }
      pendingOpenRef.current = null;
    }
  }, [playingId, openFullPlayer]);

  // Reels: play a sound by id (used when swiping between reels — no mood re-ask)
  const handleReelPlaySound = useCallback((id: string) => {
    const meta = (SLEEP_SOUNDS as readonly any[]).find(s => s.id === id);
    if (meta) {
      const metaFull = { ...(meta as unknown as PlayableSoundMeta), imageUri: SOUND_IMAGES[id], imageBundled: SOUND_BUNDLED_IMAGES[id] ?? undefined };
      playSound(metaFull, STOP_TIMES[stopIdx].secs);
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
    if (bedtimeAutoCloseRef.current) clearTimeout(bedtimeAutoCloseRef.current);
    if (opening) {
      bedtimeAutoCloseRef.current = setTimeout(() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setSleepIntelOpen(false);
        Animated.timing(chevronAnim, { toValue: 0, duration: 240, useNativeDriver: true }).start();
      }, 5000);
    }
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
  const isNightTime = useMemo(() => {
    if (solarTimes) {
      const nowNorm = h < solarTimes.sunrise ? h + 24 : h;
      return nowNorm >= solarTimes.sunset + 2;
    }
    return autoMode.key === 'sleep';
  }, [solarTimes, h, autoMode]);
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
      return !p || p.includes(periodKey);
    }) as SoundItem[];
  }, [currentPeriod, autoMode]);
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
              <Ionicons name="time-outline" size={11} color={SLEEP_COLOR + '90'} />
              <Text style={S.wakeChipTxt}>{fmt12(now.getHours(), now.getMinutes())}</Text>
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

        {/* ── Recommended / For Your Night (unified time-aware section) ── */}
        <View style={S.secHeader}>
          <Text style={S.secTitle}>{sectionInfo.icon}  {sectionInfo.title}</Text>
          <Text style={S.secCount}>{currentPeriod ? currentPeriod.label : autoMode.label}</Text>
        </View>
        {/* ── Unified For Your Night / Recommended scroll ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 8 }}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: 4 }}
          decelerationRate="fast"
          snapToInterval={THEME_CARD_W + 12}
          snapToAlignment="start"
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
            <TouchableOpacity key={s.id} onPress={() => handleSoundCardTap(s.id)} activeOpacity={0.82}
              style={{ width: THEME_CARD_W, height: THEME_CARD_W, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: playingId === s.id ? s.color + '80' : 'rgba(255,255,255,0.10)' }}>
              <ImageBackground
                source={SOUND_IMAGES[s.id] ? { uri: SOUND_IMAGES[s.id] } : undefined}
                style={{ flex: 1 }}
                imageStyle={{ borderRadius: 20 }}
              >
                <LinearGradient colors={['rgba(0,0,0,0.02)', 'rgba(0,0,0,0.68)']} style={[StyleSheet.absoluteFillObject, { borderRadius: 20 }]} />
                {playingId === s.id && <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: s.color + '18' }]} />}
                <View style={{ flex: 1, justifyContent: 'flex-end', padding: 12 }}>
                  <Text style={{ fontSize: 20, marginBottom: 4 }}>{s.emoji}</Text>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: playingId === s.id ? s.color : '#FFFFFFDD' }} numberOfLines={2}>{s.label}</Text>
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

        {/* ── Compact Bedtime Bar · after sunset (top position) ── */}
        {(autoMode.key === 'evening' || autoMode.key === 'sleep') && (
          <View style={{ marginHorizontal: 16, marginTop: 10, marginBottom: 6 }}>
            <TouchableOpacity
              onPress={toggleSleepIntel}
              activeOpacity={0.82}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 10,
                backgroundColor: SLEEP_COLOR + '0C',
                borderWidth: 1,
                borderColor: sleepIntelOpen ? SLEEP_COLOR + '40' : SLEEP_COLOR + '1A',
                borderRadius: sleepIntelOpen ? 16 : 99,
                borderBottomLeftRadius: sleepIntelOpen ? 0 : 99,
                borderBottomRightRadius: sleepIntelOpen ? 0 : 99,
                paddingHorizontal: 16, paddingVertical: 10,
              }}
            >
              <Text style={{ fontSize: 13 }}>🌙</Text>
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#FFFFFF55', letterSpacing: 0.1 }}>Ideal Bedtime</Text>
              {ayuBedtime && (
                <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#10b981' }} />
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: SLEEP_COLOR, letterSpacing: -0.3 }}>{fmt12(displayBedtime.h, displayBedtime.m)}</Text>
                <Text style={{ fontSize: 10, color: '#FFFFFF28', fontWeight: '600' }}>→</Text>
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#F5820A', letterSpacing: -0.3 }}>{fmt12(wakeHour, wakeMinute)}</Text>
              </View>
              <Animated.View style={{ transform: [{ rotate: chevronAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }}>
                <Ionicons name="chevron-down" size={12} color="#FFFFFF28" />
              </Animated.View>
            </TouchableOpacity>
            {sleepIntelOpen && (
              <View style={{ borderWidth: 1, borderTopWidth: 0, borderColor: SLEEP_COLOR + '40', backgroundColor: '#03070F', borderBottomLeftRadius: 16, borderBottomRightRadius: 16, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14 }}>
                <View style={S.sleepBar}>
                  <LinearGradient colors={[SLEEP_COLOR + '55', '#F5820A35']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={S.sleepBarFill} />
                  <View style={[S.sleepBarDot, { left: 0, backgroundColor: SLEEP_COLOR }]} />
                  <View style={[S.sleepBarDot, { right: 0, backgroundColor: '#F5820A' }]} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, marginBottom: 12 }}>
                  <View>
                    <Text style={{ fontSize: 9, color: '#FFFFFF30', fontWeight: '700', marginBottom: 2, letterSpacing: 0.3 }}>SLEEP</Text>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: SLEEP_COLOR, letterSpacing: -0.5 }}>{fmt12(displayBedtime.h, displayBedtime.m)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 9, color: '#FFFFFF30', fontWeight: '700', marginBottom: 2, letterSpacing: 0.3 }}>WAKE</Text>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#F5820A', letterSpacing: -0.5 }}>{fmt12(wakeHour, wakeMinute)}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#10b98108', borderWidth: 1, borderColor: '#10b98120', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 }}>
                    <Text style={{ fontSize: 11 }}>🌿</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 9, fontWeight: '800', color: '#10b981CC', letterSpacing: 0.2 }}>Kapha Window</Text>
                      <Text style={{ fontSize: 8, color: '#FFFFFF35', marginTop: 1 }}>{ayuBedtime ? `Sunset +3.5 hr · GPS` : 'Sleep before 10 PM'}</Text>
                    </View>
                  </View>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: SLEEP_COLOR + '08', borderWidth: 1, borderColor: SLEEP_COLOR + '20', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 }}>
                    <Text style={{ fontSize: 11 }}>🔬</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 9, fontWeight: '800', color: SLEEP_COLOR + 'CC', letterSpacing: 0.2 }}>5 × 90-min</Text>
                      <Text style={{ fontSize: 8, color: '#FFFFFF35', marginTop: 1 }}>7.5 hrs · optimal REM</Text>
                    </View>
                  </View>
                </View>
                <Text style={{ fontSize: 8, fontWeight: '700', color: '#FFFFFF18', textAlign: 'center', letterSpacing: 1.2 }}>AUTO-CLOSES IN 5s</Text>
              </View>
            )}
          </View>
        )}

        {/* ── Soundscapes — Netflix rows ── */}
        <View style={S.secHeader}>
          <Text style={S.secTitle}>Soundscapes</Text>
          <Text style={S.secCount}>{SLEEP_SOUNDS.length} sounds · swipe each row</Text>
        </View>
        <CategoryRows
          playingId={playingId}
          isPaused={isPaused}
          sessionSecs={sessionSecs}
          onPress={handleSoundCardTap}
        />

        {/* ── Sacred Sounds: Mantras & Stotras ── */}
        <View style={S.secHeader}>
          <Text style={S.secTitle}>Sacred Sounds</Text>
          <Text style={S.secCount}>Mantras · Stotras</Text>
        </View>
        {MANTRA_LIBRARY.map(section => (
          <View key={section.category} style={{ marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 3, height: 26, borderRadius: 2, backgroundColor: section.color }} />
                <Text style={{ fontSize: 20 }}>{section.icon}</Text>
                <Text style={{ fontSize: 20, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.3, fontFamily: 'Nunito_800ExtraBold' }}>{section.category}</Text>
                <View style={{ backgroundColor: section.color + '20', borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: section.color + '40' }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: section.color, letterSpacing: 0.4 }}>{section.sounds.length}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Text style={{ fontSize: 9, fontWeight: '700', color: '#FFFFFF28', letterSpacing: 0.8 }}>SWIPE</Text>
                <Ionicons name="chevron-forward" size={10} color="#FFFFFF28" />
              </View>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: 4 }}
              decelerationRate="fast"
              snapToInterval={ROW_CARD_W + 12}
              snapToAlignment="start"
            >
              {section.sounds.map(s => (
                <SoundCard
                  key={s.id}
                  sound={s as any}
                  isPlaying={playingId === s.id}
                  isPaused={isPaused && playingId === s.id}
                  remaining={playingId === s.id ? sessionSecs : 0}
                  onPress={() => handleSoundCardTap(s.id)}
                  compact
                />
              ))}
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
              <Text style={S.groupRowSub}>30 min before {fmt12(displayBedtime.h, displayBedtime.m)}</Text>
            </View>
            <Switch value={bedtimeAlert} onValueChange={v => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setBedtimeAlert(v); }}
              trackColor={{ false: '#222', true: SLEEP_COLOR + '80' }} thumbColor={bedtimeAlert ? SLEEP_COLOR : '#444'} />
          </View>
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

        {/* ── Compact Bedtime Bar · night only ── */}
        {(autoMode.key === 'morning' || autoMode.key === 'focus' || autoMode.key === 'restore') && (
          <View style={{ marginHorizontal: 16, marginTop: 10, marginBottom: 6 }}>
            <TouchableOpacity
              onPress={toggleSleepIntel}
              activeOpacity={0.82}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 10,
                backgroundColor: SLEEP_COLOR + '0C',
                borderWidth: 1,
                borderColor: sleepIntelOpen ? SLEEP_COLOR + '40' : SLEEP_COLOR + '1A',
                borderRadius: sleepIntelOpen ? 16 : 99,
                borderBottomLeftRadius: sleepIntelOpen ? 0 : 99,
                borderBottomRightRadius: sleepIntelOpen ? 0 : 99,
                paddingHorizontal: 16, paddingVertical: 10,
              }}
            >
              <Text style={{ fontSize: 13 }}>🌙</Text>
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#FFFFFF55', letterSpacing: 0.1 }}>Ideal Bedtime</Text>
              {ayuBedtime && (
                <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#10b981' }} />
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: SLEEP_COLOR, letterSpacing: -0.3 }}>{fmt12(displayBedtime.h, displayBedtime.m)}</Text>
                <Text style={{ fontSize: 10, color: '#FFFFFF28', fontWeight: '600' }}>→</Text>
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#F5820A', letterSpacing: -0.3 }}>{fmt12(wakeHour, wakeMinute)}</Text>
              </View>
              <Animated.View style={{ transform: [{ rotate: chevronAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }}>
                <Ionicons name="chevron-down" size={12} color="#FFFFFF28" />
              </Animated.View>
            </TouchableOpacity>

            {sleepIntelOpen && (
              <View style={{ borderWidth: 1, borderTopWidth: 0, borderColor: SLEEP_COLOR + '40', backgroundColor: '#03070F', borderBottomLeftRadius: 16, borderBottomRightRadius: 16, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14 }}>
                {/* Sleep bar */}
                <View style={S.sleepBar}>
                  <LinearGradient colors={[SLEEP_COLOR + '55', '#F5820A35']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={S.sleepBarFill} />
                  <View style={[S.sleepBarDot, { left: 0, backgroundColor: SLEEP_COLOR }]} />
                  <View style={[S.sleepBarDot, { right: 0, backgroundColor: '#F5820A' }]} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, marginBottom: 12 }}>
                  <View>
                    <Text style={{ fontSize: 9, color: '#FFFFFF30', fontWeight: '700', marginBottom: 2, letterSpacing: 0.3 }}>SLEEP</Text>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: SLEEP_COLOR, letterSpacing: -0.5 }}>{fmt12(displayBedtime.h, displayBedtime.m)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 9, color: '#FFFFFF30', fontWeight: '700', marginBottom: 2, letterSpacing: 0.3 }}>WAKE</Text>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#F5820A', letterSpacing: -0.5 }}>{fmt12(wakeHour, wakeMinute)}</Text>
                  </View>
                </View>

                {/* Inline science badges */}
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#10b98108', borderWidth: 1, borderColor: '#10b98120', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 }}>
                    <Text style={{ fontSize: 11 }}>🌿</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 9, fontWeight: '800', color: '#10b981CC', letterSpacing: 0.2 }}>Kapha Window</Text>
                      <Text style={{ fontSize: 8, color: '#FFFFFF35', marginTop: 1 }}>
                        {ayuBedtime ? `Sunset +3.5 hr · GPS` : 'Sleep before 10 PM'}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: SLEEP_COLOR + '08', borderWidth: 1, borderColor: SLEEP_COLOR + '20', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 }}>
                    <Text style={{ fontSize: 11 }}>🔬</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 9, fontWeight: '800', color: SLEEP_COLOR + 'CC', letterSpacing: 0.2 }}>5 × 90-min</Text>
                      <Text style={{ fontSize: 8, color: '#FFFFFF35', marginTop: 1 }}>7.5 hrs · optimal REM</Text>
                    </View>
                  </View>
                </View>

                <Text style={{ fontSize: 8, fontWeight: '700', color: '#FFFFFF18', textAlign: 'center', letterSpacing: 1.2 }}>AUTO-CLOSES IN 5s</Text>
              </View>
            )}
          </View>
        )}
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
        onClose={handleReelClose}
        onChangeTimer={changeStopTimer}
      />


    </View>
  );
}

const S = StyleSheet.create({
  // ── Scaffold ──────────────────────────────────────────────
  screen:     { flex: 1, backgroundColor: '#000000' },
  headerGrad: {},
  soundImgBg: { width: '100%', flex: 1 } as any,

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
  themeCard:     { width: THEME_CARD_W, height: THEME_CARD_W, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#FFFFFF0A', justifyContent: 'flex-end' },
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

