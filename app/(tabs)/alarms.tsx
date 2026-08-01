import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, Modal,
  TextInput, Alert, Animated, Dimensions, NativeModules, Platform,
  ToastAndroid, ImageBackground, Linking, ActionSheetIOS, StatusBar, Easing,
  BackHandler,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { speakBodhi, stopBodhi } from '@/lib/speech';
import { store, KEYS } from '@/lib/storage';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import { Audio } from 'expo-av';
import {
  AlarmSettings, DEFAULT_ALARM_SETTINGS, rescheduleAllFromSettings, requestNotificationPermission,
  ExtraWakeAlarm,
} from '@/lib/notifications';
import { MISSIONS, WAKE_SOUNDS, DEFAULT_MISSION_SETTINGS, MissionSettings } from '@/lib/missionAlarm';
import {
  scheduleNativeAlarm, cancelNativeAlarm, checkAlarmPermission,
  requestAllAlarmPermissions,
  scheduleExtraWakeAlarm, cancelExtraWakeAlarm, getNextAlarmTimestamp, syncNativeWakeAlarmSound,
} from '@/lib/nativeAlarm';
import notifee, { AndroidImportance, AndroidCategory, AndroidVisibility, TriggerType, RepeatFrequency, AlarmType, AndroidForegroundServiceType } from '@notifee/react-native';
import { Colors, Font } from '@/constants/theme';
import { PRAKRITI_PLANS, type PledgeData } from '@/lib/prakritiPlan';
import { useSoundPlayer } from '@/lib/soundPlayerContext';
import { getBgSourceSync } from '@/lib/bgImages';
import AppBackground from '@/components/AppBackground';
import { useBgContext } from '@/lib/bgContext';
import { getCardBg } from '@/lib/cardTheme';
import * as FileSystem from 'expo-file-system/legacy';
import { getLocalMantraPath, isMantraDownloaded, downloadMantra } from '@/lib/mantraDownload';
import { registerPreviewStopper } from '@/lib/alarmAudio';
import { ALL_SLEEP_SOUNDS, SOUND_IMAGES } from '@/lib/sleepSoundsData';
import { getLocalSoundImageUri, ensureSoundImageCached } from '@/lib/soundImagePreload';
import AlarmSoundLibraryModal, { AlarmSoundItem } from '@/components/alarms/AlarmSoundLibraryModal';
import { getSolarTimes } from '@/lib/solar';
import { useFocusEffect, useRouter } from 'expo-router';
import { getTabBarClearance } from '@/lib/tabBarSpacing';

const ACCENT = '#F5820A';
const { width } = Dimensions.get('window');
const ALARM_CARD_BG = 'rgba(20,25,40,0.5)'; // Matching Daily Intention Card
const MANTRA_TO_WAKE_SOUND: Record<string, string> = {
  gayatri: 'gayatri', lalitha: 'lalitha', shivtandav: 'shiv_tandav',
  bhagya_suktam: 'bhagya_suktam', shiv_sankalpa_suktam: 'shiv_sankalpa_suktam',
};
const BUNDLED_MANTRAS = new Set<string>([]); // CDN sounds — download-based, not bundled
const PRESETS = [
  { label: 'Brahma',  sub: '4:00 AM', hour: 4,  minute: 0,  color: '#60a5fa' },
  { label: 'Dawn',    sub: '4:30 AM', hour: 4,  minute: 30, color: '#60a5fa' },
  { label: 'Early',   sub: '5:30 AM', hour: 5,  minute: 30, color: '#60a5fa' },
  { label: 'Sunrise', sub: '6:00 AM', hour: 6,  minute: 0,  color: '#34d399' },
];
const MANTRAS = [
  { id: 'gayatri',    label: 'Gayatri Mantra',      emoji: '🌞', color: '#fbbf24', hint: 'ॐ भूर्भुवः स्वः', pitch: 0.85, rate: 0.70, text: 'Om Bhur Bhuva Swaha, Tat Savitur Varenyam, Bhargo Devasya Dhimahi, Dhiyo Yo Nah Prachodayat. Om Shanti Shanti Shanti.', audioUrl: 'https://ik.imagekit.io/rcsesr4xf/gayatri-mantra-ghanpaath.mp3' },
  { id: 'lalitha',    label: 'Divine Power to Clear Obstacles (Lalitha Sahasranama)', emoji: '🌺', color: '#f472b6', hint: 'ॐ ऐं ह्रीं श्रीं', pitch: 0.80, rate: 0.65, text: 'Om Aim Hreem Shreem, Sri Lalitha Tripura Sundari, Namami Namami Namami. Om Shakti Shakti Shakti.', audioUrl: 'https://ik.imagekit.io/rcsesr4xf/Lalitha-Sahasranamam.mp3' },
  { id: 'shivtandav',           label: 'Shiv Tandav',              emoji: '🔱', color: '#60a5fa', hint: 'ॐ नमः शिवाय',     pitch: 0.75, rate: 0.68, text: 'Jata tavee galajjala pravaha pavithrasthale. Om Namah Shivaya, Om Namah Shivaya. Har Har Mahadev.', audioUrl: 'https://ik.imagekit.io/rcsesr4xf/Shiva-Tandav.mp3' },
  { id: 'bhagya_suktam',        label: 'Hymn of Fortune (Bhagya Suktam)',            emoji: '🌟', color: '#fbbf24', hint: 'Fortune Hymn',    pitch: 0.85, rate: 0.70, text: 'Om Bhagyam Dehi, Shri Devi Namaha. May prosperity, wisdom and fortune flow into this day. Om Shanti.', audioUrl: 'https://audio.onesutralabs.com/sounds-large/bhagya-suktam.m4a' },
  { id: 'shiv_sankalpa_suktam', label: 'Shiv Sankalpa Suktam',     emoji: '🔱', color: '#60a5fa', hint: 'Sacred Mind Hymn',pitch: 0.80, rate: 0.68, text: 'Yat pragnanam uta cheto dhritishcha, Yat jyotir antah amritam prajasu. Yan nah chittam ahuti pupa ya, tan me manah shivasankalpam astu.', audioUrl: 'https://audio.onesutralabs.com/sounds-large/shiv-sankalpa-suktam.m4a' },
  { id: 'naad_govinda_mantra',      label: 'Govinda Mantra',         emoji: '💙', color: '#818cf8', hint: 'Govinda Hari', pitch: 1.0, rate: 1.0, text: '', audioUrl: 'https://audio.onesutralabs.com/All%20Nada%20Sounds/shidenbeatsmusic-govinda-mantra-female-voice-with-tanpura-and-sitar-120558.m4a' },
  { id: 'naad_aar_sitar_classical', label: 'Indian Classical Sitar', emoji: '🪕', color: '#f59e0b', hint: 'Indian Raga',   pitch: 1.0, rate: 1.0, text: '', audioUrl: 'https://audio.onesutralabs.com/All%20Nada%20Sounds/aar_music-indian-classical-music-sitar-296790.m4a' },
  { id: 'cdn_ultra_rise_krishna',   label: 'Rise with Krishna',      emoji: '🪈', color: '#fde68a', hint: 'Krishna Flute', pitch: 1.0, rate: 1.0, text: 'Rise with the divine flute of Krishna. May your morning be filled with clarity and peace.', audioUrl: 'https://pub-0d083e39b57f47e8b2398292a67eef84.r2.dev/NadaUltra/Rise%20with%20Krishna_%20Uplifting%20Indian%20Morning%20Music%20%20Yoga%20%26%20Meditation%20Instrumentals.m4a' },
];
// ── Curated alarm sounds ───────────────────────────────────────────────────
const NAAD_BASE_ALARM = 'https://audio.onesutralabs.com/All%20Nada%20Sounds/';
const ALARM_SOUNDS = [
  { id: 'morning_birds',           label: 'Morning Birds',          emoji: '🐦', cat: 'Birds',  color: '#fde68a', audioUrl: null as string | null },
  { id: 'spring_birds',            label: 'Spring Birds',           emoji: '🌸', cat: 'Birds',  color: '#f9a8d4', audioUrl: null as string | null },
  { id: 'forest_birds',            label: 'Forest Birds',           emoji: '🌳', cat: 'Birds',  color: '#86efac', audioUrl: null as string | null },
  { id: 'eagle_feather',           label: 'Eagle Call',             emoji: '🦅', cat: 'Birds',  color: '#78716c', audioUrl: null as string | null },
  { id: 'cuckoo_forest',           label: 'Cuckoo Forest',          emoji: '🌳', cat: 'Birds',  color: '#4ade80', audioUrl: null as string | null },
  { id: 'cuckoo_soft',             label: 'Soft Cuckoo',            emoji: '🐦', cat: 'Birds',  color: '#6ee7b7', audioUrl: null as string | null },
  { id: 'peacock_wild',            label: 'Wild Peacock',           emoji: '🦚', cat: 'Birds',  color: '#34d399', audioUrl: null as string | null },
  { id: 'india_countryside_birds', label: 'Sparrows Group',         emoji: '🌾', cat: 'Birds',  color: '#fde68a', audioUrl: null as string | null },
  { id: 'cuckoo_birds_forest',     label: 'Cuckoo & Forest Birds',  emoji: '🌲', cat: 'Birds',  color: '#86efac', audioUrl: null as string | null },
  { id: 'peacock_call',            label: 'Peacock Call',           emoji: '🦚', cat: 'Birds',  color: '#4ade80', audioUrl: null as string | null },
  { id: 'koel_bird',               label: 'Koel Bird Song',         emoji: '🎵', cat: 'Birds',  color: '#34d399', audioUrl: null as string | null },
  { id: 'sea_waves',               label: 'Sea Waves',              emoji: '🌊', cat: 'Ocean',  color: '#38bdf8', audioUrl: null as string | null },
  { id: 'rocky_shore',             label: 'Rocky Shore',            emoji: '🪨', cat: 'Ocean',  color: '#7dd3fc', audioUrl: null as string | null },
  { id: 'harbor_waves',            label: 'Harbor Waves',           emoji: '⚓', cat: 'Ocean',  color: '#93c5fd', audioUrl: null as string | null },
  { id: 'flowing_water',           label: 'Flowing Water',          emoji: '💧', cat: 'Nature', color: '#67e8f9', audioUrl: null as string | null },
  { id: 'jungle_storm',            label: 'Jungle Storm',           emoji: '🌿', cat: 'Nature', color: '#6ee7b7', audioUrl: null as string | null },
  { id: 'spiritual_journey',       label: 'Spiritual Journey',      emoji: '🌌', cat: 'Sacred', color: '#c084fc', audioUrl: 'https://audio.onesutralabs.com/sounds-large/spiritual-journey.m4a' as string | null },
  { id: 'om_shanti',               label: 'Om Shanti',              emoji: '🕉️', cat: 'Sacred', color: '#c084fc', audioUrl: null as string | null },
  { id: 'naad_aar_sitar_classical', label: 'Indian Classical Sitar', emoji: '🪕', cat: 'Sacred', color: '#f59e0b', audioUrl: NAAD_BASE_ALARM + 'aar_music-indian-classical-music-sitar-296790.m4a' as string | null },
  { id: 'gayatri',                 label: 'Gayatri Mantra',         emoji: '🌞', cat: 'Mantra', color: '#fbbf24', audioUrl: 'https://ik.imagekit.io/rcsesr4xf/gayatri-mantra-ghanpaath.mp3' as string | null },
  { id: 'lalitha',                 label: 'Divine Power to Clear Obstacles (Lalitha Sahasranama)',    emoji: '🌺', cat: 'Mantra', color: '#f472b6', audioUrl: 'https://ik.imagekit.io/rcsesr4xf/Lalitha-Sahasranamam.mp3' as string | null },
  { id: 'naad_govinda_mantra',     label: 'Govinda Mantra',         emoji: '💙', cat: 'Mantra', color: '#818cf8', audioUrl: NAAD_BASE_ALARM + 'shidenbeatsmusic-govinda-mantra-female-voice-with-tanpura-and-sitar-120558.m4a' as string | null },
  { id: 'med_govind_bolo',         label: 'Govind Bolo · Krishna',  emoji: '🪈', cat: 'Mantra', color: '#38bdf8', audioUrl: 'https://pub-0d083e39b57f47e8b2398292a67eef84.r2.dev/Meditations/Govind%20BoloShri%20Krishna%20Govind%20%20Krishna%20Sankirtanl%20%20Om%20Voices.mp3' as string | null },
  { id: 'cdn_ultra_vedic_healing_chant', label: 'Vedic Healing Chanting', emoji: '🌿', cat: 'Mantra', color: '#86efac', audioUrl: 'https://pub-0d083e39b57f47e8b2398292a67eef84.r2.dev/NadaUltra/Vedic%20Mantra%20for%20Weight%20Loss%20%20Healing%20Meditation%20Music%20%20Divine%20Female%20Chanting.m4a' as string | null },
  { id: 'cdn_ultra_mahamrityunjaya',      label: '108 Mahamrityunjaya Mantra',    emoji: '🕉️', cat: 'Mantra', color: '#c084fc', audioUrl: 'https://pub-0d083e39b57f47e8b2398292a67eef84.r2.dev/NadaUltra/108%20Mahamrityunjaya%20Mantra%20Chant%20%20Tibetan%20Shiva%20Mantra%20for%20Protection%20%26%20Healing.m4a' as string | null },
  { id: 'om_chant_cosmic',                label: 'Om Chanting (Cosmic Sound)',    emoji: '🕉️', cat: 'Mantra', color: '#6366f1', audioUrl: 'https://audio.onesutralabs.com/om.mp3' as string | null },
  { id: 'tanpura_nada',                   label: 'Tanpura (Nada Sound)',          emoji: '🎵', cat: 'Mantra', color: '#818cf8', audioUrl: 'https://audio.onesutralabs.com/Tanpura.mp3' as string | null },
  { id: 'med_ganesha_pancharatnam',      label: 'Ganesha Pancharatnam',   emoji: '🪔', cat: 'Stotra', color: '#fb923c', audioUrl: 'https://pub-0d083e39b57f47e8b2398292a67eef84.r2.dev/Meditations/Ganesha%20Pancharatnam%20I%20Om%20Voices%20Junior%20I%20Mudakaratha%20Modakam%20I%20Adi%20Shankaracharya.mp3' as string | null },
  { id: 'med_shyamale_meenakshi',  label: 'Feminine Universal Energy (Shyamale Meenakshi)', emoji: '🌺', cat: 'Stotra', color: '#f9a8d4', audioUrl: 'https://pub-0d083e39b57f47e8b2398292a67eef84.r2.dev/Meditations/Shyamale%20Meenakshi%20%20I%20Om%20Voices%20Junior%20I%20Praise%20Goddess%20Meenakshi%20with%20Dikshitar%27s%20Nottuswara.mp3' as string | null },
  { id: 'med_saraswati_shloka',    label: 'Wisdom Awakening (Saraswati Shloka)',          emoji: '📚', cat: 'Stotra', color: '#c084fc', audioUrl: 'https://pub-0d083e39b57f47e8b2398292a67eef84.r2.dev/Meditations/%E0%A4%B8%E0%A4%B0%E0%A4%B8%E0%A4%B5%E0%A4%A4%20%E0%A4%B6%E0%A4%B2%E0%A4%95%20%20%20Rekha%20Bharadwaj%20%20Saraswati%20Shloka%20%20%E0%A4%A8%E0%A4%B5%E0%A4%B0%E0%A4%A4%E0%A4%B0%20%E0%A4%B8%E0%A4%AA%E0%A4%B6%E0%A4%B2%20%20Times%20Music%20Spiritual.mp3' as string | null },
  { id: 'bhagya_suktam',           label: 'Hymn of Fortune (Bhagya Suktam)',          emoji: '🌟', cat: 'Stotra', color: '#fbbf24', audioUrl: 'https://audio.onesutralabs.com/sounds-large/bhagya-suktam.m4a' as string | null },
  // ── Sitar & Flute (Ragas from Sleep Page) ──────────────────────────────────
  { id: 'sitar_long',              label: 'Sitar Meditation',       emoji: '🎸', cat: 'Sitar & Flute', color: '#f59e0b', audioUrl: null as string | null },
  { id: 'sitar_tabla_bells',       label: 'Sitar, Tabla & Bells',   emoji: '🎵', cat: 'Sitar & Flute', color: '#fbbf24', audioUrl: null as string | null },
  { id: 'indian_sitar_raga',       label: 'Indian Sitar Raga',      emoji: '🎶', cat: 'Sitar & Flute', color: '#fb923c', audioUrl: null as string | null },
  { id: 'sitar_summer_raga',       label: 'Summer Healing Raga',    emoji: '☀️', cat: 'Sitar & Flute', color: '#fde68a', audioUrl: 'https://audio.onesutralabs.com/sounds-large/sitar-summer-raga.m4a' as string | null },
  { id: 'sitar_radiance',          label: 'Sitar Radiance',         emoji: '✨', cat: 'Sitar & Flute', color: '#f97316', audioUrl: 'https://audio.onesutralabs.com/sounds-large/sitar-radiance.m4a' as string | null },
  { id: 'sitar_tanpura_sarangi',   label: 'Sitar, Tanpura & Sarangi', emoji: '🪕', cat: 'Sitar & Flute', color: '#f59e0b', audioUrl: null as string | null },
  { id: 'sitar_tanpura_bgm',       label: 'Sitar & Tanpura',        emoji: '🎼', cat: 'Sitar & Flute', color: '#fbbf24', audioUrl: null as string | null },
  { id: 'veena_classical',         label: 'Classical Veena',        emoji: '🪗', cat: 'Sitar & Flute', color: '#fcd34d', audioUrl: 'https://audio.onesutralabs.com/sounds-large/veena-classical.m4a' as string | null },
  { id: 'sitar_calm',              label: 'Calm Sitar',             emoji: '🎸', cat: 'Sitar & Flute', color: '#fcd34d', audioUrl: null as string | null },
  { id: 'veena_raga',              label: 'Veena Raga Kanaad',      emoji: '🪗', cat: 'Sitar & Flute', color: '#f59e0b', audioUrl: null as string | null },
  { id: 'andean_flute',            label: 'Andean Flute',           emoji: '🏔️', cat: 'Sitar & Flute', color: '#6ee7b7', audioUrl: null as string | null },
  { id: 'quena_flute',             label: 'Canyon Quena',           emoji: '🏜️', cat: 'Sitar & Flute', color: '#86efac', audioUrl: null as string | null },
  { id: 'native_flute',            label: 'Native American Flute',  emoji: '🪶', cat: 'Sitar & Flute', color: '#a3e635', audioUrl: null as string | null },
  { id: 'native_flute_echo',       label: 'Native Flute Echo',      emoji: '🌀', cat: 'Sitar & Flute', color: '#86efac', audioUrl: null as string | null },
  { id: 'bamboo_flute',            label: 'Bamboo Flute',           emoji: '🎋', cat: 'Sitar & Flute', color: '#34d399', audioUrl: null as string | null },
  { id: 'flute_scale',             label: 'Flute Meditation',       emoji: '🎶', cat: 'Sitar & Flute', color: '#6ee7b7', audioUrl: null as string | null },
  { id: 'bansuri_forest',          label: 'Bansuri Forest',         emoji: '🌿', cat: 'Sitar & Flute', color: '#34d399', audioUrl: 'https://audio.onesutralabs.com/sounds-large/bansuri-forest.m4a' as string | null },
  { id: 'bansuri_melody',          label: 'Bansuri Melody',         emoji: '🎵', cat: 'Sitar & Flute', color: '#6ee7b7', audioUrl: null as string | null },
  { id: 'bansuri_tarana',          label: 'Bansuri Tarana',         emoji: '🎶', cat: 'Sitar & Flute', color: '#86efac', audioUrl: 'https://audio.onesutralabs.com/sounds-large/bansuri-tarana.m4a' as string | null },
  { id: 'cdn_ultra_rise_krishna',  label: 'Rise with Krishna',      emoji: '🪈', cat: 'Sitar & Flute', color: '#fde68a', audioUrl: 'https://pub-0d083e39b57f47e8b2398292a67eef84.r2.dev/NadaUltra/Rise%20with%20Krishna_%20Uplifting%20Indian%20Morning%20Music%20%20Yoga%20%26%20Meditation%20Instrumentals.m4a' as string | null },
];


const LALITHA_IMG = { uri: 'https://images.pexels.com/photos/33834247/pexels-photo-33834247.jpeg?auto=compress&cs=tinysrgb&w=400' };

const ALARM_BUNDLED: Record<string, any> = {
  // Only truly bundled sounds (require() module IDs = numbers), not CDN URI objects
  ...Object.fromEntries(ALL_SLEEP_SOUNDS.filter(s => typeof s.src === 'number').map(s => [s.id, s.src])),
};

const ALARM_SOUND_CATS = ['Birds', 'Ocean', 'Nature', 'Sitar & Flute', 'Sacred', 'Mantra', 'Stotra'] as const;

const AYU_HABITS = [
  { key: 'wake_early',   label: 'Wake Early',       emoji: '🌙' },
  { key: 'hydrate',      label: 'Hydrate',          emoji: '💧' },
  { key: 'shower',       label: 'Shower',           emoji: '🚿' },
  { key: 'meditation',   label: 'Meditation',       emoji: '🧘' },
  { key: 'prayer',       label: 'Prayer',           emoji: '🙏' },
  { key: 'stretch',      label: 'Stretch',          emoji: '🤸' },
  { key: 'sunlight',     label: 'Sunlight',         emoji: '☀️' },
  { key: 'breakfast',    label: 'Breakfast',        emoji: '🥣' },
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

const HABIT_WISDOM: Record<string, { icon: string; title: string; color: string; body: string }> = {
  wake_early:   { icon: '🌅', color: '#60a5fa', title: 'RISE BEFORE THE WORLD',      body: 'Waking early gives you quiet, uninterrupted time before the day\'s noise begins. Your mind is freshest in the early hours — use it for focus, intention, and calm before the world wakes up.' },
  hydrate:      { icon: '💧', color: '#38bdf8', title: 'MORNING HYDRATION',           body: 'You lose water overnight through breathing. Starting the day with water rehydrates your body, clears brain fog, and kick-starts your digestion — one of the simplest habits with outsized returns.' },
  shower:       { icon: '🚿', color: '#38bdf8', title: 'REFRESH YOUR SYSTEM',         body: 'A morning shower wakes the body, sharpens the mind, and creates a clean psychological boundary between sleep and the active day. Cold water boosts alertness and circulation instantly.' },
  meditation:   { icon: '🙏', color: '#60a5fa', title: 'TRAIN YOUR MIND',             body: 'Even 10 minutes of morning stillness reduces anxiety, improves focus, and builds emotional resilience. Meditation is the one habit that makes every other habit easier.' },
  prayer:       { icon: '🙏', color: '#fbbf24', title: 'ANCHOR YOUR DAY',             body: 'Morning prayer or gratitude anchors your intention for the day. It shifts the mind from reactive to purposeful — building inner strength and a sense of meaning before anything else.' },
  stretch:      { icon: '🤸', color: '#34d399', title: 'WAKE YOUR BODY',              body: 'Gentle morning stretches loosen stiff joints, improve blood flow, and signal the body that it\'s time to be active. Just 5 minutes reverses the effects of 7–8 hours of stillness overnight.' },
  sunlight:     { icon: '☀️', color: '#fbbf24', title: 'MORNING LIGHT MATTERS',       body: 'Natural morning light resets your body clock, lifts your mood, and programs better sleep tonight. Step outside for 10 minutes — it\'s the most powerful free wellness tool available.' },
  breakfast:    { icon: '🥣', color: '#f97316', title: 'FUEL THE START',              body: 'Eating a balanced breakfast within the first 2 hours of waking stabilises blood sugar, prevents energy crashes, and gives your brain the fuel it needs for peak morning performance.' },
  main_meal:    { icon: '🍴', color: '#f59e0b', title: 'EAT BIG AT MIDDAY',          body: 'Your body\'s digestion is strongest around midday. Making lunch your biggest meal helps your body process food more efficiently, sustains energy longer, and avoids afternoon sluggishness.' },
  walk:         { icon: '🚶', color: '#34d399', title: 'MOVE AFTER MEALS',            body: 'A short walk after eating improves digestion, lowers blood sugar, and prevents the post-meal energy crash. Just 10–15 minutes of walking after a meal makes a measurable difference.' },
  herbal_tea:   { icon: '🍵', color: '#a3e635', title: 'A RITUAL OF CALM',            body: 'A daily herbal tea ritual creates a mindful pause in your day. Calming herbs like chamomile or ginger reduce stress, support digestion, and build a consistent moment of self-care.' },
  evening_walk: { icon: '🌆', color: '#fb923c', title: 'UNWIND AND MOVE',             body: 'An evening walk is one of the most effective natural stress relievers. It lowers cortisol, clears mental fatigue, and prepares your body and mind for deep, restorative sleep.' },
  light_dinner: { icon: '🥗', color: '#34d399', title: 'EAT LIGHT AT NIGHT',          body: 'Your digestion slows significantly after sunset. A light dinner reduces bloating, improves sleep quality, and helps your body focus on repair and recovery overnight instead of digestion.' },
  screen_free:  { icon: '📵', color: '#60a5fa', title: 'PROTECT YOUR SLEEP',          body: 'Screens before bed suppress the sleep hormone melatonin by up to 50%. Even 30 minutes of screen-free wind-down dramatically improves sleep onset, depth, and morning energy levels.' },
  journaling:   { icon: '📓', color: '#60a5fa', title: 'CLEAR YOUR MIND',             body: 'Writing down your thoughts offloads mental clutter and helps you process the day. Just 5 minutes of journaling before bed reduces overthinking, improves mood, and sharpens next-day clarity.' },
  sleep:        { icon: '�', color: '#60a5fa', title: 'SLEEP IS THE FOUNDATION',     body: 'Everything — mood, focus, energy, health — depends on quality sleep. Going to bed by 10 PM gives your body and brain the full repair window they need to perform at their best tomorrow.' },
};

const pad  = (n: number) => String(n).padStart(2, '0');
const fmt12 = (h: number, m: number) => {
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12  = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${pad(h12)}:${pad(m)} ${ampm}`;
};
const computeTimeUntil = (hour: number, minute: number, now: Date): string => {
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const tgt = hour * 60 + minute;
  const diff = tgt > nowMins ? tgt - nowMins : tgt + 1440 - nowMins;
  const hrs = Math.floor(diff / 60);
  const mins = diff % 60;
  if (hrs === 0) return `in ${mins} minutes`;
  if (mins === 0) return `in ${hrs} hours`;
  return `in ${hrs}h ${mins}m`;
};
const computeTimeUntilShort = (hour: number, minute: number, now: Date): string => {
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const tgt = hour * 60 + minute;
  const diff = tgt > nowMins ? tgt - nowMins : tgt + 1440 - nowMins;
  const hrs = Math.floor(diff / 60);
  const mins = diff % 60;
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
};

export interface AlarmEntry {
  id: string; type: 'habit'|'quick'|'soundbath'; hour: number; minute: number;
  label: string; enabled: boolean; habitKey?: string; habitEmoji?: string; soundId?: string; days?: number[];
}

function Toggle({ value, onToggle, color = '#60a5fa' }: { value: boolean; onToggle: () => void; color?: string }) {
  return <Switch value={value} onValueChange={onToggle} trackColor={{ false: Colors.border ?? '#222', true: color + '80' }} thumbColor={value ? color : '#666'} />;
}

const DS = ['S','M','T','W','T','F','S'] as const;
function DayDots({ days, color = '#10b981' }: { days?: number[]; color?: string }) {
  const isAll = !days || days.length === 0 || days.length === 7;
  return (
    <View style={{ flexDirection: 'row', gap: 3, marginTop: 3 }}>
      {DS.map((d, i) => {
        const on = isAll || days!.includes(i);
        return (
          <View key={i} style={{
            flex: 1, height: 16, borderRadius: 4,
            backgroundColor: on ? color + '1E' : '#FFFFFF07',
            borderWidth: 1,
            borderColor: on ? color + '45' : '#FFFFFF10',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 8, fontWeight: on ? '900' : '500', color: on ? color : '#FFFFFF28' }}>{d}</Text>
          </View>
        );
      })}
    </View>
  );
}

const DRUM_H     = 52;
const DRUM_REPEAT = 5;
const HOURS_12   = Array.from({ length: 12 }, (_, i) => i + 1);
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
  const isPM = hour >= 12;
  const h12  = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;

  const handleHourChange = (newH12: number) => {
    let h24: number;
    if (isPM) { h24 = newH12 === 12 ? 12 : newH12 + 12; }
    else       { h24 = newH12 === 12 ? 0  : newH12; }
    onChange(h24, minute);
  };

  const toggleAmPm = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    let h24: number;
    if (isPM) { h24 = hour === 12 ? 0  : hour - 12; }
    else       { h24 = hour === 0  ? 12 : hour + 12; }
    onChange(h24, minute);
  };

  return (
    <View style={{ paddingVertical: 10 }}>
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: DRUM_H + 10, height: DRUM_H, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#FFFFFF15', backgroundColor: '#FFFFFF05', zIndex: 1 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
        <DrumColumn values={HOURS_12} selected={h12} onChange={handleHourChange} />
        <Text style={{ fontSize: 36, fontWeight: '100', color: '#FFFFFF35', paddingHorizontal: 8, alignSelf: 'center' }}>:</Text>
        <DrumColumn values={MINUTES} selected={minute} onChange={m => onChange(hour, m)} />
        <TouchableOpacity onPress={toggleAmPm} style={{ paddingLeft: 14, paddingVertical: 10 }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: ACCENT, alignSelf: 'center' }}>{isPM ? 'PM' : 'AM'}</Text>
        </TouchableOpacity>
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

type FabAction = { label: string; sub: string; color: string; iconName: string; onPress: () => void };

const AlarmFabMenu = React.memo(function AlarmFabMenu({
  bottomOffset,
  actionsRef,
}: {
  bottomOffset: number;
  actionsRef: React.MutableRefObject<FabAction[]>;
}) {
  const [open, setOpen] = React.useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      return () => {
        setOpen(false);
        anim.setValue(0);
      };
    }, [])
  );

  const toggle = () => {
    if (!open) {
      setOpen(true);
      Animated.spring(anim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 7,
        tension: 60,
      }).start();
    } else {
      Animated.timing(anim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setOpen(false));
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const backdropOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const spin = anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] });

  return (
    <>
      {open && (
        <Animated.View style={[StyleSheet.absoluteFill, { zIndex: 9999, elevation: 9999, opacity: backdropOpacity }]} pointerEvents="auto">
          <BlurView intensity={Platform.OS === 'android' ? 60 : 100} tint="dark" experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFillObject} />
          <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={toggle} activeOpacity={1} />
          
          <Animated.View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 80, pointerEvents: 'box-none', transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }] }}>
            <Text style={{ color: '#fff', fontSize: 32, fontFamily: 'DancingScript_600SemiBold', textAlign: 'center', marginBottom: 24, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 8 }}>
              Create New
            </Text>
            <View style={{ gap: 12 }}>
              {actionsRef.current.map((item, i) => (
                <Animated.View key={i} style={{
                  transform: [
                    { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [30 + (i * 15), 0] }) }
                  ]
                }}>
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: 'rgba(255,255,255,0.06)',
                      borderRadius: 22,
                      padding: 14,
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.15)',
                      overflow: 'hidden',
                    }}
                    onPress={() => { toggle(); setTimeout(() => item.onPress(), 200); }}
                    activeOpacity={0.7}
                  >
                    <BlurView intensity={Platform.OS === 'android' ? 20 : 20} tint="light" experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFillObject} />
                    <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: `${item.color}25`, alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                      <Ionicons name={item.iconName as any} size={24} color={item.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', fontFamily: 'Nunito_700Bold', color: '#fff', letterSpacing: 0.2, marginBottom: 2 }}>{item.label}</Text>
                      <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '400', fontFamily: 'Nunito_400Regular' }}>{item.sub}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </View>
          </Animated.View>
        </Animated.View>
      )}
      <TouchableOpacity
        style={[S.fab, { bottom: bottomOffset + 16 }, open && S.fabOpen]}
        onPress={toggle}
        activeOpacity={0.85}
      >
        <Animated.View style={{ transform: [{ rotate: spin }] }}>
          <Text style={S.fabTxt}>+</Text>
        </Animated.View>
      </TouchableOpacity>
    </>
  );
});

const AUTO_SCROLL_CATEGORIES = [
  { label: 'Nature', color: '#34d399' },
  { label: 'Ragas',  color: '#a78bfa' },
  { label: 'Birds',  color: '#60a5fa' },
  { label: 'Mantras',color: '#fbbf24' },
  { label: 'Stotras',color: '#f472b6' },
];

const AutoScrollingCategories = React.memo(() => {
  const anim = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (width > 0) {
      // 100ms per pixel makes it much slower and more calming.
      const duration = width * 100; 
      
      anim.setValue(0);
      Animated.loop(
        Animated.timing(anim, {
          toValue: -width,
          duration,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    }
  }, [width, anim]);

  const onLayout = (e: any) => {
    if (width === 0) setWidth(e.nativeEvent.layout.width);
  };

  const strip = (
    <View style={{ flexDirection: 'row', alignItems: 'center' }} onLayout={onLayout}>
      {AUTO_SCROLL_CATEGORIES.map((tag, idx) => (
        <View key={`${tag.label}-${idx}`} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', fontFamily: 'DancingScript_600SemiBold', color: 'rgba(255,255,255,0.90)', letterSpacing: 0.8 }}>
            {tag.label}
          </Text>
          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', marginLeft: 16 }} />
        </View>
      ))}
    </View>
  );

  return (
    <View style={{ overflow: 'hidden', flexDirection: 'row', width: '100%' }}>
      <Animated.View style={{ flexDirection: 'row', transform: [{ translateX: anim }] }}>
        {strip}
        {width > 0 && strip}
        {width > 0 && strip}
        {width > 0 && strip}
      </Animated.View>
    </View>
  );
});

// ══════════════════════════════════════════════════════════════════════════════
export default function AlarmsTab() {
  const insets = useSafeAreaInsets();
  const router  = useRouter();
  const { playingId, stopSound } = useSoundPlayer();
  const [settings, setSettings]             = useState<AlarmSettings>(DEFAULT_ALARM_SETTINGS);
  const [saving, setSaving]                 = useState(false);
  const [selectedMantraId, setSelectedMantraId] = useState('bhagya_suktam');
  const saveAnim                            = useRef(new Animated.Value(0)).current;
  const alarmActiveRef                      = useRef(false);
  const fabActionsRef                        = useRef<FabAction[]>([]);
  const [dlStatus, setDlStatus]             = useState<Record<string,'idle'|'downloading'|'downloaded'>>({ gayatri:'idle', lalitha:'idle', shivtandav:'idle', bhagya_suktam:'idle', shiv_sankalpa_suktam:'idle', naad_govinda_mantra:'idle', naad_aar_sitar_classical:'idle', spiritual_journey:'idle', sitar_summer_raga:'idle', sitar_radiance:'idle', veena_classical:'idle', bansuri_forest:'idle', bansuri_tarana:'idle', med_govind_bolo:'idle', cdn_ultra_vedic_healing_chant:'idle', med_ganesha_pancharatnam:'idle' });
  const [dlProgress, setDlProgress]         = useState<Record<string, number>>({});
  const [alarmEntries, setAlarmEntries]     = useState<AlarmEntry[]>([]);
  const [menuOpenId, setMenuOpenId]         = useState<string|null>(null);
  const [menuTarget, setMenuTarget]         = useState<{ type: 'wake' | 'extraWake' | 'entry'; entry?: AlarmEntry; extraWake?: ExtraWakeAlarm } | null>(null);
  const [showWakeEdit, setShowWakeEdit]         = useState(false);
  const [editingExtraWake, setEditingExtraWake]  = useState<ExtraWakeAlarm | null>(null);
  const [isAddingExtraWake, setIsAddingExtraWake] = useState(false);
  const [extraWakeAlarms, setExtraWakeAlarms]    = useState<ExtraWakeAlarm[]>([]);
  const [extraFormHour, setExtraFormHour]        = useState(8);
  const [extraFormMinute, setExtraFormMinute]    = useState(0);
  const [extraFormLabel, setExtraFormLabel]      = useState('');
  const [addType, setAddType]                    = useState<'habit'|'quick'|'soundbath'|null>(null);
  const [formSoundId, setFormSoundId]            = useState('morning_birds');
  const [wakeFormSoundCat, setWakeFormSoundCat]  = useState<typeof ALARM_SOUND_CATS[number]>('Nature');
  const [wakeRepeatDays, setWakeRepeatDays]       = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [wakeFormHour, setWakeFormHour]          = useState(5);
  const [wakeFormMinute, setWakeFormMinute]       = useState(30);
  const [extraFormRepeatDays, setExtraFormRepeatDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [bmHour, setBmHour]                       = useState<number | null>(null);
  const [bmMinute, setBmMinute]                   = useState(0);
  const [showBMModal, setShowBMModal]             = useState(false);
  const [bmAlarmDays, setBmAlarmDays]             = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [bathFormSoundCat, setBathFormSoundCat]  = useState<typeof ALARM_SOUND_CATS[number]>('Nature');
  const [editEntry, setEditEntry]           = useState<AlarmEntry|null>(null);
  const [formHour, setFormHour]             = useState(7);
  const [formMinute, setFormMinute]         = useState(0);
  const [formLabel, setFormLabel]           = useState('');
  const [formHabitKey, setFormHabitKey]     = useState('meditation');
  const [formHabitEmoji, setFormHabitEmoji] = useState('🧘');
  const [formDays, setFormDays]             = useState<number[]>([]);
  const [showCustomHabitInput, setShowCustomHabitInput] = useState(false);
  const [habitPage, setHabitPage] = useState(0);
  const [missionSettings, setMissionSettings] = useState<MissionSettings>(DEFAULT_MISSION_SETTINGS);
  const [permStatus, setPermStatus]         = useState({ notifications: true, exactAlarm: true, batteryOpt: true, fullScreen: true });
  const [liveClock, setLiveClock]           = useState(new Date());
  const [prakritiWake, setPrakritiWake]     = useState<{ label: string; hour: number; minute: number; color: string }|null>(null);
  const [libraryModalVisible, setLibraryModalVisible] = useState(false);
  const [libraryModalTarget, setLibraryModalTarget] = useState<'wake' | 'habit'>('wake');
  const [alarmModal, setAlarmModal]         = useState(false);
  const { bgUri, bgKey, accentColor }        = useBgContext();
  const cardBg                              = getCardBg(bgKey);
  const [previewingId, setPreviewingId]     = useState<string | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);
  const previewSoundRef                     = useRef<Audio.Sound | null>(null);
  const alarmScrollRef                      = useRef<ScrollView | null>(null);

  useEffect(() => { const t = setInterval(() => setLiveClock(new Date()), 30_000); return () => clearInterval(t); }, []);

  useFocusEffect(useCallback(() => {
    alarmScrollRef.current?.scrollTo({ y: 0, animated: false });
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      router.navigate('/(tabs)');
      return true;
    });
    return () => {
      sub.remove();
      stopPreview().catch(() => {});
    };
  }, [router]));

  useEffect(() => {
    (async () => {
      const s  = await store.getJSON<AlarmSettings>(KEYS.alarmSettings);
      const pl = await store.getJSON<PledgeData>(KEYS.pledge);
      if (pl?.prakriti && PRAKRITI_PLANS[pl.prakriti]) {
        const plan = PRAKRITI_PLANS[pl.prakriti];
        const color = pl.prakriti === 'Kapha' ? '#34d399' : pl.prakriti === 'Pitta' ? '#fb923c' : '#60a5fa';
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
        if (s.extraWakeAlarms?.length) {
          setExtraWakeAlarms(s.extraWakeAlarms);
          s.extraWakeAlarms.filter(a => a.enabled).forEach(a => scheduleExtraWakeAlarm(a.id, a.hour, a.minute, a.label).catch(() => {}));
        }
      }
      const statuses: Record<string,'idle'|'downloading'|'downloaded'> = {};
      for (const m of MANTRAS) statuses[m.id] = (await isMantraDownloaded(m.id)) ? 'downloaded' : 'idle';
      for (const s of ALARM_SOUNDS.filter(s => s.audioUrl)) { if (!(s.id in statuses)) statuses[s.id] = (await isMantraDownloaded(s.id)) ? 'downloaded' : 'idle'; }
      setDlStatus(statuses);
      const currentId = s?.selectedMantraId ?? 'gayatri';
      syncNativeWakeAlarmSound(currentId).catch(() => {});
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
      // Calculate Brahma Muhurta (96 min before sunrise) from stored location
      try {
        let loc = await store.getJSON<{ lat: number; lon: number }>(KEYS.location);
        if (!loc?.lat || !loc?.lon) {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const currentLoc = await Location.getLastKnownPositionAsync({}) ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            if (currentLoc) {
              loc = { lat: currentLoc.coords.latitude, lon: currentLoc.coords.longitude };
              await store.setJSON(KEYS.location, loc);
            }
          }
        }
        
        if (loc?.lat && loc?.lon) {
          const solar = getSolarTimes(loc.lat, loc.lon);
          const bmDecimal = solar.sunrise - 96 / 60;
          const bmH = bmDecimal < 0 ? bmDecimal + 24 : bmDecimal;
          const calcH = Math.floor(bmH);
          const calcM = Math.round((bmH - Math.floor(bmH)) * 60);
          setBmHour(calcH);
          setBmMinute(calcM);
          // Auto-reschedule BM alarm with today's recalculated time if enabled
          if (s?.brahmaMuhurtaAlarm?.enabled) {
            setBmAlarmDays(s.brahmaMuhurtaAlarm.days);
            const next = new Date();
            next.setHours(calcH, calcM, 0, 0);
            if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
            if (Platform.OS === 'android' && NativeModules.AlarmModule?.scheduleAlarm) {
              NativeModules.AlarmModule.scheduleAlarm(next.getTime()).catch(() => {});
            } else {
              scheduleNativeAlarm(calcH, calcM).catch(() => {});
            }
          }
        }
      } catch {}
    })();
  }, []);

  const persistAndApply = async (updated: AlarmSettings) => {
    setSettings(updated); setSaving(true);
    try {
      await store.setJSON(KEYS.alarmSettings, updated);
      const hasPerm = await requestNotificationPermission();
      if (hasPerm) await rescheduleAllFromSettings(updated);
      if (updated.wakeAlarm.enabled) {
        await syncNativeWakeAlarmSound(selectedMantraId);
        
        if (Platform.OS === 'android') {
          try {
            await requestAllAlarmPermissions();
            const [ea, bo, fs] = await Promise.all([checkAlarmPermission(), NativeModules.AlarmModule?.isBatteryOptimizationIgnored?.().catch(() => true) ?? Promise.resolve(true), NativeModules.AlarmModule?.checkFullScreenIntentPermission?.().catch(() => true) ?? Promise.resolve(true)]);
            const { status } = await (require('expo-notifications') as typeof import('expo-notifications')).getPermissionsAsync();
            setPermStatus({ notifications: status === 'granted', exactAlarm: !!ea, batteryOpt: !!bo, fullScreen: !!fs });
          } catch {}
        }

        const next = new Date(getNextAlarmTimestamp(updated.wakeAlarm.hour, updated.wakeAlarm.minute, updated.wakeAlarm.days));
        if (Platform.OS === 'android' && NativeModules.AlarmModule?.scheduleAlarm) {
          try { await NativeModules.AlarmModule.scheduleAlarm(next.getTime()); } catch (e: any) { console.warn('[AlarmModule] schedule failed:', e); }
        } else {
          scheduleNativeAlarm(updated.wakeAlarm.hour, updated.wakeAlarm.minute, updated.wakeAlarm.days).catch(() => {});
        }
        // Always show confirmation toast — native Android handles actual alarm firing
        const h12 = next.getHours() === 0 ? 12 : next.getHours() > 12 ? next.getHours() - 12 : next.getHours();
        const ampm = next.getHours() >= 12 ? 'PM' : 'AM';
        const mm = String(next.getMinutes()).padStart(2, '0');
        (ToastAndroid as any)?.show?.(`🔔 Alarm set for ${h12}:${mm} ${ampm}${next.getDate() !== new Date().getDate() ? ' (tomorrow)' : ''}`, (ToastAndroid as any).LONG);
      } else {
        await cancelNativeAlarm();
        (ToastAndroid as any)?.show?.('🔕 Alarm cancelled', (ToastAndroid as any).SHORT);
      }
      Animated.sequence([Animated.timing(saveAnim, { toValue: 1, duration: 200, useNativeDriver: true }), Animated.delay(800), Animated.timing(saveAnim, { toValue: 0, duration: 300, useNativeDriver: true })]).start();
    } catch {} finally { setSaving(false); }
  };

  const persistExtraWakeAlarms = async (updated: ExtraWakeAlarm[]) => {
    setExtraWakeAlarms(updated);
    setSettings(prev => ({ ...prev, extraWakeAlarms: updated }));
    const s = await store.getJSON<AlarmSettings>(KEYS.alarmSettings) ?? DEFAULT_ALARM_SETTINGS;
    await store.setJSON(KEYS.alarmSettings, { ...s, extraWakeAlarms: updated });
  };
  const addExtraWakeAlarm = async () => {
    // Block duplicate times across main alarm and all extra wake alarms
    const existingTimes = [
      ...(settings.wakeAlarm.enabled ? [{ hour: settings.wakeAlarm.hour, minute: settings.wakeAlarm.minute }] : []),
      ...extraWakeAlarms.map(a => ({ hour: a.hour, minute: a.minute })),
    ];
    if (existingTimes.some(t => t.hour === extraFormHour && t.minute === extraFormMinute)) {
      Alert.alert('⚠️ Duplicate Alarm', `A wake alarm at ${fmt12(extraFormHour, extraFormMinute)} already exists. Choose a different time.`);
      return;
    }
    const id = Date.now().toString();
    const a: ExtraWakeAlarm = { id, enabled: true, hour: extraFormHour, minute: extraFormMinute, label: extraFormLabel.trim() || undefined, days: extraFormRepeatDays };
    const updated = [...extraWakeAlarms, a];
    // Close modal instantly — persist + schedule run in background
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowWakeEdit(false);
    setIsAddingExtraWake(false);
    setExtraFormLabel('');
    persistExtraWakeAlarms(updated).catch(() => {});
    const next = new Date();
    next.setHours(a.hour, a.minute, 0, 0);
    if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
    if (Platform.OS === 'android' && NativeModules.AlarmModule?.scheduleAlarm) {
      try { await NativeModules.AlarmModule.scheduleAlarm(next.getTime()); } catch (e: any) { console.warn('[AlarmModule] extra alarm schedule failed:', e); }
    } else {
      scheduleNativeAlarm(a.hour, a.minute).catch(() => {});
    }
    const h12 = a.hour === 0 ? 12 : a.hour > 12 ? a.hour - 12 : a.hour;
    const ampm = a.hour < 12 ? 'AM' : 'PM';
    const mm = String(a.minute).padStart(2, '0');
    (ToastAndroid as any)?.show?.(`🔔 Alarm set for ${h12}:${mm} ${ampm}${next.getDate() !== new Date().getDate() ? ' (tomorrow)' : ''}`, (ToastAndroid as any).LONG);
  };
  const toggleExtraWake = async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = extraWakeAlarms.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a);
    await persistExtraWakeAlarms(updated);
    const alarm = updated.find(a => a.id === id)!;
    if (alarm.enabled) await scheduleExtraWakeAlarm(alarm.id, alarm.hour, alarm.minute, alarm.label);
    else await cancelExtraWakeAlarm(id);
  };
  const deleteExtraWake = (id: string) => Alert.alert('Remove alarm?', '', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: async () => {
      await cancelExtraWakeAlarm(id);
      await persistExtraWakeAlarms(extraWakeAlarms.filter(a => a.id !== id));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }},
  ]);

  const toggleWake  = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); persistAndApply({ ...settings, wakeAlarm: { ...settings.wakeAlarm, enabled: !settings.wakeAlarm.enabled } }); };
  const showWakeAlarmMenu = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMenuTarget({ type: 'wake' });
  };

  const openEditExtraWake = (alarm: ExtraWakeAlarm) => {
    setEditingExtraWake(alarm);
    setExtraFormHour(alarm.hour);
    setExtraFormMinute(alarm.minute);
    setExtraFormLabel(alarm.label ?? '');
    setExtraFormRepeatDays(alarm.days ?? [0, 1, 2, 3, 4, 5, 6]);
    setIsAddingExtraWake(true);
    setShowWakeEdit(true);
  };

  const updateExtraWakeAlarm = async () => {
    if (!editingExtraWake) return;
    // Block duplicate times (exclude the alarm being edited)
    const existingTimes = [
      ...(settings.wakeAlarm.enabled ? [{ hour: settings.wakeAlarm.hour, minute: settings.wakeAlarm.minute }] : []),
      ...extraWakeAlarms.filter(a => a.id !== editingExtraWake.id).map(a => ({ hour: a.hour, minute: a.minute })),
    ];
    if (existingTimes.some(t => t.hour === extraFormHour && t.minute === extraFormMinute)) {
      Alert.alert('⚠️ Duplicate Alarm', `A wake alarm at ${fmt12(extraFormHour, extraFormMinute)} already exists. Choose a different time.`);
      return;
    }
    const updated = extraWakeAlarms.map(a =>
      a.id === editingExtraWake.id
        ? { ...a, hour: extraFormHour, minute: extraFormMinute, label: extraFormLabel.trim() || undefined, days: extraFormRepeatDays }
        : a
    );
    // Close modal instantly — persist + schedule run in background
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowWakeEdit(false);
    setIsAddingExtraWake(false);
    setEditingExtraWake(null);
    setExtraFormLabel('');
    persistExtraWakeAlarms(updated).catch(() => {});
    const changed = updated.find(a => a.id === editingExtraWake.id)!;
    if (changed.enabled) {
      const next = new Date();
      next.setHours(changed.hour, changed.minute, 0, 0);
      if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
      if (Platform.OS === 'android' && NativeModules.AlarmModule?.scheduleAlarm) {
        try { await NativeModules.AlarmModule.scheduleAlarm(next.getTime()); } catch (e: any) { console.warn('[AlarmModule] update extra alarm failed:', e); }
      } else {
        scheduleNativeAlarm(changed.hour, changed.minute).catch(() => {});
      }
      const h12 = changed.hour === 0 ? 12 : changed.hour > 12 ? changed.hour - 12 : changed.hour;
      const ampm = changed.hour < 12 ? 'AM' : 'PM';
      const mm = String(changed.minute).padStart(2, '0');
      (ToastAndroid as any)?.show?.(`🔔 Alarm set for ${h12}:${mm} ${ampm}${next.getDate() !== new Date().getDate() ? ' (tomorrow)' : ''}`, (ToastAndroid as any).LONG);
    }
  };

  const showExtraWakeMenu = (alarm: ExtraWakeAlarm) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMenuTarget({ type: 'extraWake', extraWake: alarm });
  };

  const showAlarmMenu = (entry: AlarmEntry) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMenuTarget({ type: 'entry', entry });
  };

  const openBMModal = () => {
    const saved = settings.brahmaMuhurtaAlarm;
    if (saved?.days) setBmAlarmDays(saved.days);
    setShowBMModal(true);
  };

  const saveBMAlarm = async () => {
    if (bmHour === null) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const updated: AlarmSettings = { ...settings, brahmaMuhurtaAlarm: { enabled: true, days: bmAlarmDays } };
    setSettings(updated);
    await store.setJSON(KEYS.alarmSettings, updated);
    // Use the same native alarm logic as extra wake alarms (tried & tested)
    const next = new Date();
    next.setHours(bmHour, bmMinute, 0, 0);
    if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
    if (Platform.OS === 'android' && NativeModules.AlarmModule?.scheduleAlarm) {
      try { await NativeModules.AlarmModule.scheduleAlarm(next.getTime()); } catch (e: any) { console.warn('[AlarmModule] BM alarm schedule failed:', e); }
    } else {
      scheduleNativeAlarm(bmHour, bmMinute).catch(() => {});
    }
    setShowBMModal(false);
    const nextDay = new Date(); nextDay.setDate(nextDay.getDate() + 1);
    const tomorrow = nextDay.toLocaleDateString('en-IN', { weekday: 'long' });
    (ToastAndroid as any)?.show?.(`🌄 Sacred alarm set · ${tomorrow}, Brahma Muhurta at ${fmt12(bmHour, bmMinute)}`, (ToastAndroid as any).LONG);
  };

  const toggleBMAlarm = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const wasEnabled = settings.brahmaMuhurtaAlarm?.enabled ?? false;
    const updated: AlarmSettings = { ...settings, brahmaMuhurtaAlarm: { enabled: !wasEnabled, days: bmAlarmDays } };
    setSettings(updated);
    await store.setJSON(KEYS.alarmSettings, updated);
    if (!wasEnabled && bmHour !== null) {
      const next = new Date();
      next.setHours(bmHour, bmMinute, 0, 0);
      if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
      if (Platform.OS === 'android' && NativeModules.AlarmModule?.scheduleAlarm) {
        NativeModules.AlarmModule.scheduleAlarm(next.getTime()).catch(() => {});
      } else {
        scheduleNativeAlarm(bmHour, bmMinute).catch(() => {});
      }
    } else {
      cancelNativeAlarm().catch(() => {});
    }
  };

  const cancelBMAlarm = async () => {
    const updated: AlarmSettings = { ...settings, brahmaMuhurtaAlarm: { enabled: false, days: bmAlarmDays } };
    setSettings(updated);
    await store.setJSON(KEYS.alarmSettings, updated);
    cancelNativeAlarm().catch(() => {});
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowBMModal(false);
  };
  const toggleBrahma = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); persistAndApply({ ...settings, brahmaReminder: !settings.brahmaReminder }); };

  const updateMission = async (patch: Partial<MissionSettings>) => { const u = { ...missionSettings, ...patch }; setMissionSettings(u); await store.setJSON(KEYS.missionSettings, u); };

  const CAMERA_MISSIONS = new Set(['sky_check', 'make_bed', 'hydrate']);

  const handleSelectMission = async (missionId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (CAMERA_MISSIONS.has(missionId)) {
      const { status, canAskAgain } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        if (!canAskAgain) {
          Alert.alert(
            'Camera Permission Required',
            'This mission uses the camera. Please enable Camera permission for Nada in your device Settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ],
          );
        } else {
          Alert.alert(
            'Camera Permission Required',
            'This mission requires camera access. Please allow it when prompted to select this mission.',
          );
        }
        return;
      }
    }
    updateMission({ selectedMission: missionId as any });
  };

  const stopPreview = async () => {
    try {
      if (previewSoundRef.current) {
        await previewSoundRef.current.stopAsync();
        await previewSoundRef.current.unloadAsync();
        previewSoundRef.current = null;
      }
    } catch { /* ignore */ }
    setPreviewingId(null);
    setPreviewLoadingId(null);
  };

  useEffect(() => {
    registerPreviewStopper(stopPreview);
    return () => { registerPreviewStopper(null); };
  }, []);

  const togglePreview = async (snd: AlarmSoundItem) => {
    if (playingId) {
      try {
        await stopSound();
      } catch (e) {
        console.warn('Failed to stop background sound:', e);
      }
    }
    if (previewingId === snd.id || previewLoadingId === snd.id) { await stopPreview(); return; }
    await stopPreview();
    // Show loading badge immediately so user knows tap was registered
    setPreviewLoadingId(snd.id);
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false, shouldDuckAndroid: true });
      
      let source: any = null;
      const lp = getLocalMantraPath(snd.id);
      const info = await FileSystem.getInfoAsync(lp).catch(() => null);
      
      if (info?.exists) {
        source = { uri: lp };
      } else {
        const bundled = ALARM_BUNDLED[snd.id];
        // Fallback: find the URI from ALL_SLEEP_SOUNDS if audioUrl is null and not bundled
        const sleepSrc = ALL_SLEEP_SOUNDS.find(s => s.id === snd.id)?.src;
        const fallbackUri = (!bundled && !snd.audioUrl && sleepSrc && typeof sleepSrc !== 'number')
          ? (sleepSrc as { uri: string }).uri
          : null;
        source = bundled ?? (snd.audioUrl ? { uri: snd.audioUrl } : (fallbackUri ? { uri: fallbackUri } : null));
      }
      
      if (!source) { setPreviewLoadingId(null); return; }
      const { sound } = await Audio.Sound.createAsync(source, { shouldPlay: true, isLooping: false, volume: 0.9 });
      previewSoundRef.current = sound;
      setPreviewLoadingId(null);
      setPreviewingId(snd.id);
      sound.setOnPlaybackStatusUpdate(status => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
          previewSoundRef.current = null;
          setPreviewingId(null);
        }
      });
    } catch {
      setPreviewLoadingId(null);
      setPreviewingId(null);
    }
  };

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
      const { sound } = await Audio.Sound.createAsync(require('../../assets/sounds/mantra_alarm.m4a'), { shouldPlay: true, volume: 1.0, isLooping: true });
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
    store.setJSON(KEYS.alarmSettings, upd); syncNativeWakeAlarmSound(id).catch(() => {});
    if (SOUND_IMAGES[id]) ensureSoundImageCached(SOUND_IMAGES[id]).catch(() => {});
    const snd = ALARM_SOUNDS.find(s => s.id === id);
    updateMission({ wakeSound: id });
    // Bundled nature/sacred/stotra sounds need no download
    if (ALARM_BUNDLED[id] != null) {
      setDlStatus(s => ({ ...s, [id]: 'downloaded' }));
      syncNativeWakeAlarmSound(id).catch(() => {});
      return;
    }
    if (dlStatus[id] === 'downloaded') { syncNativeWakeAlarmSound(id).catch(() => {}); return; }
    if (dlStatus[id] === 'downloading') return;
    const m = MANTRAS.find(x => x.id === id);
    const cdnSnd = ALARM_SOUNDS.find(x => x.id === id);
    const dlUrl = m?.audioUrl || cdnSnd?.audioUrl || null;
    if (!dlUrl) return;
    setDlStatus(s => ({ ...s, [id]: 'downloading' })); setDlProgress(s => ({ ...s, [id]: 0 }));
    const result = await downloadMantra(id, dlUrl, p => setDlProgress(s => ({ ...s, [id]: p })));
    setDlStatus(s => ({ ...s, [id]: result ? 'downloaded' : 'idle' }));
    if (result && id === selectedMantraId) syncNativeWakeAlarmSound(id).catch(() => {});
  };

  const fireTestNotification = async () => {
    const granted = await requestNotificationPermission();
    if (!granted) { Alert.alert('Enable notifications in Settings first'); return; }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); syncNativeWakeAlarmSound(selectedMantraId).catch(() => {});
    if (Platform.OS === 'android') {
      if (!NativeModules.AlarmModule?.scheduleAlarm) { playAlarmSound('mantra'); return; }
      try { await NativeModules.AlarmModule.scheduleAlarm(Date.now() + 5000); Alert.alert('🔔 Test alarm (5 sec)', 'Lock your screen now — alarm should break through.'); } catch (e: any) { Alert.alert('Failed', e?.message ?? String(e)); }
    } else { playAlarmSound('mantra'); }
  };

  const scheduleEntryNotif = async (entry: AlarmEntry) => {
    if (!entry.enabled) return;
    const title = entry.type === 'habit'
      ? `${entry.habitEmoji ?? '🎯'}  ${entry.label}`
      : entry.type === 'soundbath'
      ? `🎵 ${entry.label || 'Sound Bath'}`
      : `⚡ ${entry.label || 'Quick Alarm'}`;
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
            entry.type === 'soundbath' ? (entry.soundId ?? 'morning_birds') : (entry.habitKey ?? entry.id),
            entry.habitEmoji ?? (entry.type === 'quick' ? '⚡' : entry.type === 'soundbath' ? '🎵' : '🎯'),
            entry.label,
            entry.type,
            mantraPath,
            entry.id,
          );
          return;
        } catch (e) { console.warn('[HabitAlarm] Native schedule failed, trying notifee:', e); }
      }
      try {
        await notifee.createChannel({ id: 'arise-habit-alarms', name: 'Nada Habit Alarms', importance: AndroidImportance.HIGH, sound: 'mantra_alarm', vibration: true, bypassDnd: true, visibility: AndroidVisibility.PUBLIC } as any);
        await notifee.createTriggerNotification(
          { id: `habit-${entry.id}`, title, body: entry.type === 'habit' ? 'Time for your habit! Tap to confirm. 🙏' : entry.type === 'soundbath' ? 'Your Sound Bath is ready 🎵 Tap to listen.' : 'Your alarm is ringing! Tap to dismiss. ⏰', android: { channelId: 'arise-habit-alarms', importance: AndroidImportance.HIGH, category: AndroidCategory.ALARM, visibility: AndroidVisibility.PUBLIC, fullScreenAction: { id: 'default', launchActivity: 'default' }, pressAction: { id: 'default', launchActivity: 'default' }, asForegroundService: true, ongoing: true, autoCancel: false, loopSound: true, foregroundServiceTypes: [AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK] } as any, data: { type: entry.type === 'soundbath' ? 'soundbath-alarm' : 'habit-alarm', alarmId: entry.id, habitKey: entry.habitKey ?? entry.id, habitEmoji: entry.habitEmoji ?? (entry.type === 'quick' ? '⚡' : entry.type === 'soundbath' ? '🎵' : '🎯'), label: entry.label, alarmType: entry.type, soundId: entry.soundId ?? 'morning_birds' } },
          { type: TriggerType.TIMESTAMP, timestamp: next.getTime(), repeatFrequency: RepeatFrequency.DAILY, alarmManager: { type: AlarmType.SET_ALARM_CLOCK, allowWhileIdle: true } } as any,
        ); return;
      } catch (e) { console.warn('[HabitAlarm] notifee fallback also failed:', e); }
    }
    await Notifications.scheduleNotificationAsync({
      identifier: `alarm-${entry.id}`,
      content: { title, body: entry.type === 'habit' ? 'Time for your habit. 🙏' : entry.type === 'soundbath' ? 'Your Sound Bath is ready 🎵' : 'Your alarm is ringing!', sound: 'mantra_alarm.m4a', data: { type: entry.type === 'soundbath' ? 'soundbath-alarm' : entry.type === 'habit' ? 'habit-alarm' : 'quick-alarm', alarmId: entry.id, habitKey: entry.habitKey ?? entry.id, habitEmoji: entry.habitEmoji ?? '', label: entry.label, soundId: entry.soundId ?? 'morning_birds' } },
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
    const label = formLabel.trim() || habitInfo?.label || (type === 'quick' ? 'Quick Alarm' : type === 'soundbath' ? 'Sound Bath' : 'Habit Alarm');
    const entry: AlarmEntry = { id, type, hour: formHour, minute: formMinute, label, enabled: true, habitKey: type === 'habit' ? formHabitKey : undefined, habitEmoji: type === 'habit' ? (formHabitEmoji || habitInfo?.emoji) : undefined, soundId: type === 'soundbath' ? formSoundId : undefined, days: formDays.length > 0 ? formDays : undefined };
    const updated = editEntry ? alarmEntries.map(e => e.id === id ? entry : e) : [...alarmEntries, entry];
    await scheduleEntryNotif(entry); await saveEntries(updated);
    setAddType(null); setEditEntry(null); setFormLabel(''); setFormDays([]); setShowCustomHabitInput(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };
  const openAddModal  = (type: 'habit'|'quick'|'soundbath') => { setFormHour(type === 'soundbath' ? 6 : type === 'habit' ? 7 : new Date().getHours()); setFormMinute(0); setFormLabel(type === 'soundbath' ? 'Sound Bath' : ''); setFormHabitKey(type === 'habit' ? '' : 'meditation'); setFormHabitEmoji(type === 'habit' ? '' : '🧘'); setFormSoundId('morning_birds'); setFormDays([]); setShowCustomHabitInput(false); setEditEntry(null); setAddType(type); };
  const openEditEntry = (entry: AlarmEntry) => { setFormHour(entry.hour); setFormMinute(entry.minute); setFormLabel(entry.label); setFormHabitKey(entry.habitKey ?? 'custom'); setFormHabitEmoji(entry.habitEmoji ?? '✨'); setFormSoundId(entry.soundId ?? 'morning_birds'); setFormDays(entry.days ?? []); setShowCustomHabitInput(entry.habitKey === 'custom'); setEditEntry(entry); setAddType(null); };

  const nextAlarm = useMemo(() => {
    const alarms: { h: number; m: number; label: string; color: string }[] = [];
    if (settings.wakeAlarm.enabled) alarms.push({ h: settings.wakeAlarm.hour, m: settings.wakeAlarm.minute, label: 'Wake Alarm', color: '#38bdf8' });
    if (settings.brahmaMuhurtaAlarm?.enabled && bmHour !== null) alarms.push({ h: bmHour, m: bmMinute, label: 'Brahma Muhurta', color: '#f59e0b' });
    extraWakeAlarms.filter(a => a.enabled).forEach(a => alarms.push({ h: a.hour, m: a.minute, label: a.label || 'Wake', color: '#38bdf8' }));
    alarmEntries.filter(e => e.enabled).forEach(e => alarms.push({ h: e.hour, m: e.minute, label: e.label, color: e.type === 'habit' ? '#10b981' : e.type === 'soundbath' ? '#38bdf8' : '#f97316' }));
    if (alarms.length === 0) return null;
    const nowMins = liveClock.getHours() * 60 + liveClock.getMinutes();
    let best: { h: number; m: number; label: string; color: string; diff: number } | null = null;
    for (const a of alarms) {
      const tgt = a.h * 60 + a.m;
      const diff = tgt > nowMins ? tgt - nowMins : tgt + 1440 - nowMins;
      if (!best || diff < best.diff) best = { ...a, diff };
    }
    return best;
  }, [liveClock, settings.wakeAlarm, extraWakeAlarms, alarmEntries]);

  const habitsForPicker = AYU_HABITS.filter(h => h.key !== 'custom');
  const habitPages = Array.from({ length: Math.ceil(habitsForPicker.length / 8) }, (_, i) => habitsForPicker.slice(i * 8, (i + 1) * 8));
  const playingMantra = ALARM_SOUNDS.find(s => s.id === selectedMantraId) ?? MANTRAS.find(m => m.id === selectedMantraId) ?? MANTRAS[0];
  const allPermsOk    = permStatus.notifications && permStatus.exactAlarm && permStatus.batteryOpt && permStatus.fullScreen;

  fabActionsRef.current = [
    { label: 'Divine Hour Wake', sub: 'Awaken during the sacred hours', color: '#f59e0b', iconName: 'sparkles', onPress: () => openBMModal() },
    { label: 'Daily Wake Alarm', sub: 'Set your regular morning alarm', color: ACCENT, iconName: 'alarm', onPress: () => { setEditingExtraWake(null); setExtraFormHour(5); setExtraFormMinute(0); setExtraFormLabel(''); setIsAddingExtraWake(true); setShowWakeEdit(true); } },
    { label: 'Habit Reminders', sub: 'Build routines throughout the day', color: '#10b981', iconName: 'target', onPress: () => openAddModal('habit') },
    { label: 'Quick Timer', sub: 'Set a fast timer for naps or tasks', color: '#f97316', iconName: 'flash', onPress: () => openAddModal('quick') },
    { label: 'Healing Sound Bath', sub: 'Immersive healing audio session', color: '#a78bfa', iconName: 'musical-notes', onPress: () => openAddModal('soundbath') },
  ];


  return (
    <View style={[S.screen, { backgroundColor: accentColor }]}>
      <AppBackground />
      <LinearGradient
        colors={['rgba(0,0,0,0.22)', 'rgba(0,0,0,0.00)', 'rgba(0,0,0,0.08)']}
        locations={[0, 0.28, 1]}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      <StatusBar hidden={false} barStyle="light-content" translucent backgroundColor="transparent" />
      {/* Premium Floating Settings Button */}
      <TouchableOpacity
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/(tabs)/settings' as never); }}
        style={{
          position: 'absolute',
          top: (Platform.OS === 'android' ? Math.max(insets.top, StatusBar.currentHeight ?? 0) : (insets.top ?? 44)) + 12,
          right: 12,
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: 'rgba(0,0,0,0.4)',
          borderWidth: 1.5,
          borderColor: 'rgba(255,255,255,0.25)',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 8,
          elevation: 5,
        }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="settings-outline" size={17} color="rgba(255,255,255,0.95)" />
      </TouchableOpacity>

      {/* ── Page Header Card — glassmorphism matching sleep page hero ── */}
      <View style={{ marginTop: 0, marginBottom: 15 }}>
        <View style={{
          width: '100%',
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderColor: 'rgba(255,255,255,0.15)',
          overflow: 'hidden',
          paddingTop: (Platform.OS === 'android' ? Math.max(insets.top, StatusBar.currentHeight ?? 0) : (insets.top ?? 44)) + 12,
          paddingBottom: 8,
          alignItems: 'center',
        }}>
          <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(5, 5, 10, 0.3)' }]} />
          
          {/* Subtle top shimmer */}
          <LinearGradient
            colors={['rgba(255,255,255,0.1)', 'transparent']}
            start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.6 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          {/* Main title */}
          <Text style={{
            fontSize: 24,
            fontWeight: '600',
            color: '#FFF8F0',
            letterSpacing: 0.5,
            fontFamily: 'DancingScript_600SemiBold',
            textShadowColor: 'rgba(0,0,0,0.8)',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 10,
            textAlign: 'center',
            marginBottom: 4,
          }}>
            Healing Rhythmic Alarm
          </Text>
          {/* Subtitle */}
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 0, letterSpacing: 0.2, fontWeight: '400', textAlign: 'center' }}>
            Rise with your body's natural rhythm
          </Text>
          
          {/* Divider */}
          <View style={{ width: 60, height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginTop: 12, marginBottom: 8 }} />
          
          {/* Seamless floating category stripe */}
          <View style={{ width: '100%', marginTop: 2, marginBottom: 12 }}>
            <AutoScrollingCategories />
          </View>
        </View>
      </View>

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


      <ScrollView
        ref={alarmScrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingBottom: getTabBarClearance(insets.bottom, !!playingId) + 140,
          paddingTop: 12,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Alarm List (individual slim cards) ── */}
        <View style={{ gap: 8 }}>

          {/* Primary Wake Alarm Card — Smart A */}
          <View style={[S.alarmCard2, { backgroundColor: ALARM_CARD_BG }]}>
            <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFillObject} />
            <LinearGradient colors={['rgba(255,255,255,0.08)', 'transparent']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.6 }} style={StyleSheet.absoluteFillObject} pointerEvents="none" />
            <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: '#7dd3fc' }} />
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 12, paddingVertical: 8, gap: 12 }} onPress={() => { setIsAddingExtraWake(false); setWakeRepeatDays(settings.wakeAlarm.days ?? [0, 1, 2, 3, 4, 5, 6]); setWakeFormHour(settings.wakeAlarm.hour); setWakeFormMinute(settings.wakeAlarm.minute); setShowWakeEdit(true); }} activeOpacity={0.8}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', fontWeight: '500' }} numberOfLines={1}>
                    {playingMantra.emoji} {playingMantra.label}
                  </Text>
                  <View style={{ flex: 1 }} />
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)' }}>
                    <Text style={{ fontSize: 8, fontWeight: '700', color: 'rgba(255,255,255,0.72)' }}>
                      {(() => {
                        const d = settings.wakeAlarm.days;
                        if (!d || d.length === 7) return 'DAILY';
                        if (d.length === 5 && [1,2,3,4,5].every(x => d.includes(x))) return 'WEEKDAYS';
                        if (d.length === 2 && d.includes(0) && d.includes(6)) return 'WEEKENDS';
                        return d.sort().map(i => DAY_LABELS[i]).join(' ');
                      })()}
                    </Text>
                  </View>
                </View>
                <View style={{ marginBottom: 2 }}>
                  <Text style={{ fontSize: 28, fontWeight: '200', letterSpacing: -1.0, color: settings.wakeAlarm.enabled ? '#FFFFFF' : 'rgba(255,255,255,0.28)', lineHeight: 30 }}>
                    {fmt12(settings.wakeAlarm.hour, settings.wakeAlarm.minute)}
                  </Text>
                  <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: '500', marginTop: 2 }}>
                    {settings.wakeAlarm.enabled ? computeTimeUntil(settings.wakeAlarm.hour, settings.wakeAlarm.minute, liveClock) : 'off'}
                  </Text>
                </View>
              </View>
              <View style={{ alignItems: 'center', gap: 8, flexDirection: 'column' }}>
                <Toggle value={settings.wakeAlarm.enabled} onToggle={toggleWake} color='#7dd3fc' />
                <TouchableOpacity onPress={showWakeAlarmMenu} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <Feather name="more-vertical" size={18} color="rgba(255,255,255,0.28)" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </View>

          {/* Brahma Muhurta Alarm Card */}
          {settings.brahmaMuhurtaAlarm?.enabled && bmHour !== null && (
            <View style={[S.alarmCard2, { backgroundColor: ALARM_CARD_BG }]}>
              <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFillObject} />
              <LinearGradient colors={['rgba(255,255,255,0.08)', 'transparent']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.6 }} style={StyleSheet.absoluteFillObject} pointerEvents="none" />
              <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: '#fde68a' }} />
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 12, paddingVertical: 8, gap: 12 }} onPress={() => openBMModal()} activeOpacity={0.8}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', fontWeight: '500' }} numberOfLines={1}>🌄 Sacred Rise</Text>
                    <View style={{ flex: 1 }} />
                    <View style={{ backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)' }}>
                      <Text style={{ fontSize: 8, fontWeight: '700', color: 'rgba(255,255,255,0.72)' }}>
                        {(() => {
                          const d = settings.brahmaMuhurtaAlarm?.days;
                          if (!d || d.length === 7) return 'DAILY';
                          if (d.length === 5 && [1,2,3,4,5].every(x => d.includes(x))) return 'WEEKDAYS';
                          if (d.length === 2 && d.includes(0) && d.includes(6)) return 'WEEKENDS';
                          return d.sort().map(i => DAY_LABELS[i]).join(' ');
                        })()} 
                      </Text>
                    </View>
                  </View>
                  <View style={{ marginBottom: 2 }}>
                    <Text style={{ fontSize: 28, fontWeight: '200', letterSpacing: -1.0, color: '#FFFFFF', lineHeight: 30 }}>
                      {fmt12(bmHour, bmMinute)}
                    </Text>
                    <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: '500', marginTop: 2 }}>
                      {computeTimeUntil(bmHour, bmMinute, liveClock)}
                    </Text>
                  </View>
                </View>
                <View style={{ alignItems: 'center', gap: 8, flexDirection: 'column' }}>
                  <Toggle value={settings.brahmaMuhurtaAlarm?.enabled ?? false} onToggle={toggleBMAlarm} color="#fde68a" />
                  <TouchableOpacity onPress={() => openBMModal()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                    <Feather name="more-vertical" size={18} color="rgba(255,255,255,0.28)" />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* Extra Wake Alarm Cards — Smart A */}
          {extraWakeAlarms.map(alarm => (
            <View key={alarm.id} style={[S.alarmCard2, { backgroundColor: ALARM_CARD_BG }]}>
              <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFillObject} />
              <LinearGradient colors={['rgba(255,255,255,0.08)', 'transparent']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.6 }} style={StyleSheet.absoluteFillObject} pointerEvents="none" />
              <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: '#93c5fd' }} />
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 12, paddingVertical: 12, gap: 12 }} onPress={() => openEditExtraWake(alarm)} activeOpacity={0.8}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', fontWeight: '500' }} numberOfLines={1}>
                      {alarm.label ? `🔔 ${alarm.label}` : '🔔 Wake Alarm'}
                    </Text>
                    <View style={{ flex: 1 }} />
                    <View style={{ backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)' }}>
                      <Text style={{ fontSize: 8, fontWeight: '700', color: 'rgba(255,255,255,0.72)' }}>
                        {(() => {
                          const d = alarm.days;
                          if (!d || d.length === 7) return 'DAILY';
                          if (d.length === 5 && [1,2,3,4,5].every(x => d.includes(x))) return 'WEEKDAYS';
                          if (d.length === 2 && d.includes(0) && d.includes(6)) return 'WEEKENDS';
                          return d.sort().map(i => DAY_LABELS[i]).join(' ');
                        })()}
                      </Text>
                    </View>
                  </View>
                  <View style={{ marginBottom: 2 }}>
                    <Text style={{ fontSize: 28, fontWeight: '200', letterSpacing: -1.0, color: alarm.enabled ? '#FFFFFF' : 'rgba(255,255,255,0.28)', lineHeight: 30 }}>
                      {fmt12(alarm.hour, alarm.minute)}
                    </Text>
                    <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: '500', marginTop: 2 }}>
                      {alarm.enabled ? computeTimeUntil(alarm.hour, alarm.minute, liveClock) : 'off'}
                    </Text>
                  </View>
                </View>
                <View style={{ alignItems: 'center', gap: 8, flexDirection: 'column' }}>
                  <Toggle value={alarm.enabled} onToggle={() => toggleExtraWake(alarm.id)} color="#93c5fd" />
                  <TouchableOpacity onPress={() => showExtraWakeMenu(alarm)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                    <Feather name="more-vertical" size={18} color="rgba(255,255,255,0.28)" />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </View>
          ))}

          {/* Habit + Quick + SoundBath Cards — Smart A */}
          {alarmEntries.map(entry => {
            const isHabit = entry.type === 'habit';
            const isBath  = entry.type === 'soundbath';
            const accent  = isHabit ? '#86efac' : isBath ? '#99f6e4' : '#fed7aa';
            const subLine = isHabit
              ? `${entry.habitEmoji ?? '🎯'}  ${entry.label}`
              : isBath
              ? `🎵  ${entry.label || 'Ambient Sound'}`
              : `⚡  ${entry.label || 'Quick Alarm'}`;
            return (
              <View key={entry.id} style={[S.alarmCard2, { backgroundColor: ALARM_CARD_BG }]}>
                <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFillObject} />
                <LinearGradient colors={['rgba(255,255,255,0.08)', 'transparent']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.6 }} style={StyleSheet.absoluteFillObject} pointerEvents="none" />
                <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: accent }} />
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 12, paddingVertical: 12, gap: 12 }} onPress={() => openEditEntry(entry)} activeOpacity={0.8}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', fontWeight: '500' }} numberOfLines={1}>{subLine}</Text>
                      <View style={{ flex: 1 }} />
                      <View style={{ backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)' }}>
                        <Text style={{ fontSize: 8, fontWeight: '700', color: 'rgba(255,255,255,0.72)' }}>
                          {(() => {
                            const d = entry.days;
                            if (!d || d.length === 0 || d.length === 7) return 'DAILY';
                            if (d.length === 5 && [1,2,3,4,5].every(x => d.includes(x))) return 'WEEKDAYS';
                            if (d.length === 2 && d.includes(0) && d.includes(6)) return 'WEEKENDS';
                            return d.sort().map(i => DAY_LABELS[i]).join(' ');
                          })()}
                        </Text>
                      </View>
                    </View>
                    <View style={{ marginBottom: 2 }}>
                      <Text style={{ fontSize: 28, fontWeight: '200', letterSpacing: -1.0, color: entry.enabled ? '#FFFFFF' : 'rgba(255,255,255,0.28)', lineHeight: 30 }}>
                        {fmt12(entry.hour, entry.minute)}
                      </Text>
                      <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: '500', marginTop: 2 }}>
                        {entry.enabled ? computeTimeUntil(entry.hour, entry.minute, liveClock) : 'off'}
                      </Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'center', gap: 8, flexDirection: 'column' }}>
                    <Toggle value={entry.enabled} onToggle={() => toggleEntry(entry.id)} color={accent} />
                    <TouchableOpacity onPress={() => showAlarmMenu(entry)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                      <Feather name="more-vertical" size={18} color="rgba(255,255,255,0.28)" />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              </View>
            );
          })}

        </View>

        {alarmEntries.length === 0 && (
          <View style={S.emptyHint}>
            <Text style={S.emptyIcon}>＋</Text>
            <Text style={S.emptyTxt}>Add habit or quick alarms</Text>
            <Text style={{ color: '#FFFFFF15', fontSize: 11 }}>Tap the + button below</Text>
          </View>
        )}

      </ScrollView>

      {/* FAB */}
      <AlarmFabMenu
        bottomOffset={getTabBarClearance(insets.bottom, !!playingId)}
        actionsRef={fabActionsRef}
      />

      {/* Wake Alarm Edit Modal — full-screen, Sound Bath style */}
      <Modal
        visible={showWakeEdit}
        animationType="none"
        transparent={false}
        onRequestClose={() => { stopPreview(); setIsAddingExtraWake(false); setEditingExtraWake(null); setExtraFormLabel(''); setShowWakeEdit(false); }}
      >
        <View style={{ flex: 1, backgroundColor: '#060610' }}>
          <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
            {/* Header with Save Button */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#FFFFFF08' }}>
              <TouchableOpacity onPress={() => { stopPreview(); setIsAddingExtraWake(false); setEditingExtraWake(null); setExtraFormLabel(''); setShowWakeEdit(false); }} style={{ padding: 4, width: 70 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.45)' }}>Cancel</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 13, fontWeight: '900', color: '#FFFFFF', letterSpacing: 2.0 }}>
                {isAddingExtraWake ? (editingExtraWake ? 'EDIT WAKE ALARM' : 'NEW WAKE ALARM') : 'WAKE ALARM'}
              </Text>
              <View style={{ width: 70 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingBottom: 160 }}>
              
              {/* ── Slim Sound Selection Banner (Top Visual Range) ── */}
              {(() => {
                const selSnd = ALARM_SOUNDS.find(s => s.id === selectedMantraId);
                const selColor = selSnd?.color ?? '#0ea5e9';
                const selImgSrc = selSnd?.id === 'lalitha' ? LALITHA_IMG : (SOUND_IMAGES[selectedMantraId] ? { uri: getLocalSoundImageUri(SOUND_IMAGES[selectedMantraId]) } : undefined);
                return (
                  <View style={{ marginHorizontal: 20, marginTop: 16, marginBottom: 16 }}>
                    {/* Selected Sound Banner */}
                    <View style={{ height: 64, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: selColor + '20', marginBottom: 12 }}>
                      <ImageBackground source={selImgSrc} style={{ flex: 1 }} imageStyle={{ borderRadius: 14, opacity: 0.7 }}>
                        <LinearGradient colors={['rgba(0,0,0,0.6)', 'rgba(0,0,0,0.9)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[StyleSheet.absoluteFillObject, { borderRadius: 14 }]} />
                        <View style={{ flex: 1, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' }}>
                          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                            <Text style={{ fontSize: 18 }}>{selSnd?.emoji ?? '🎵'}</Text>
                          </View>
                          <View style={{ flex: 1, justifyContent: 'center' }}>
                            <Text style={{ fontSize: 8, fontFamily: 'Nunito_800ExtraBold', color: selColor, letterSpacing: 1.6, marginBottom: 1 }}>CURRENTLY SELECTED</Text>
                            <Text style={{ fontSize: 15, fontFamily: 'Nunito_800ExtraBold', color: '#fff', letterSpacing: -0.2 }} numberOfLines={1}>{selSnd?.label ?? 'Select Sound'}</Text>
                          </View>
                        </View>
                      </ImageBackground>
                    </View>

                    {/* Elegant Select Button */}
                    <TouchableOpacity
                      onPress={() => { setLibraryModalTarget('wake'); setLibraryModalVisible(true); }}
                      activeOpacity={0.8}
                      style={{ height: 50, borderRadius: 16, overflow: 'hidden' }}
                    >
                      <LinearGradient colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.03)']} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 16 }}>
                        <Feather name="music" size={16} color="#fff" style={{ marginRight: 10, opacity: 0.9 }} />
                        <Text style={{ fontSize: 13, fontFamily: 'Nunito_800ExtraBold', color: '#fff', letterSpacing: 1.5 }}>CHOOSE SOUND</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                );
              })()}

              {/* ── Compact Time Picker & Countdown ── */}
              {(() => {
                const now = liveClock;
                const nowH = now.getHours(), nowM = now.getMinutes();
                const alarmH = isAddingExtraWake ? extraFormHour : wakeFormHour;
                const alarmM = isAddingExtraWake ? extraFormMinute : wakeFormMinute;
                let diff = (alarmH * 60 + alarmM) - (nowH * 60 + nowM);
                if (diff <= 0) diff += 24 * 60;
                const countdownStr = diff >= 60 ? `${Math.floor(diff / 60)}h ${diff % 60}m` : `${diff}m`;
                return (
                  <View style={{ alignItems: 'center', marginBottom: 16 }}>
                    <View style={{ backgroundColor: '#0284c715', borderWidth: 1, borderColor: '#0284c740', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginBottom: -12, zIndex: 10 }}>
                      <Text style={{ fontSize: 11, fontFamily: 'Nunito_700Bold', color: '#7dd3fc' }}>Rings in {countdownStr}</Text>
                    </View>
                    <TimeAdjuster
                      hour={alarmH} minute={alarmM}
                      onChange={isAddingExtraWake ? (h, m) => { setExtraFormHour(h); setExtraFormMinute(m); } : (h, m) => { setWakeFormHour(h); setWakeFormMinute(m); }}
                    />
                  </View>
                );
              })()}

              {/* ── Prakriti Row (default alarm only) ── */}
              {!isAddingExtraWake && prakritiWake && (
                <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
                  <TouchableOpacity style={[S.prakritiRow, { borderColor: prakritiWake.color + '40', padding: 12, marginBottom: 0, backgroundColor: prakritiWake.color + '0A' }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setWakeFormHour(prakritiWake.hour); setWakeFormMinute(prakritiWake.minute); }}>
                    <Text style={{ fontSize: 16 }}>🌿</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 9, fontWeight: '900', color: prakritiWake.color, letterSpacing: 1 }}>YOUR RHYTHM PLAN</Text>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.text }}>{prakritiWake.label}</Text>
                    </View>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: prakritiWake.color }}>{wakeFormHour === prakritiWake.hour && wakeFormMinute === prakritiWake.minute ? '✓ SET' : 'APPLY'}</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* ── Days & Label Row ── */}
              <View style={{ paddingHorizontal: 20, marginBottom: 16, marginTop: 16 }}>
                <Text style={{ fontSize: 10, fontFamily: 'Nunito_800ExtraBold', color: '#38bdf880', letterSpacing: 1.5, marginBottom: 10, marginLeft: 4 }}>REPEAT DAYS</Text>
                {!isAddingExtraWake ? (
                  <DaySelector days={wakeRepeatDays} onChange={setWakeRepeatDays} />
                ) : (
                  <>
                    <DaySelector days={extraFormRepeatDays} onChange={setExtraFormRepeatDays} />
                    <View style={{ marginTop: 24, marginBottom: 0 }}>
                      <Text style={{ fontSize: 10, fontFamily: 'Nunito_800ExtraBold', color: '#38bdf880', letterSpacing: 1.5, marginBottom: 10, marginLeft: 4 }}>LABEL (OPTIONAL)</Text>
                      <TextInput style={{ backgroundColor: 'rgba(56, 189, 248, 0.05)', borderWidth: 1, borderColor: 'rgba(56, 189, 248, 0.3)', borderRadius: 18, paddingHorizontal: 20, paddingVertical: 16, color: '#fff', fontSize: 15, fontFamily: 'Nunito_600SemiBold' }} placeholder="e.g. Backup alarm, Gym..." placeholderTextColor="rgba(255,255,255,0.3)" value={extraFormLabel} onChangeText={setExtraFormLabel} />
                    </View>
                  </>
                )}
              </View>



              {/* ── Mission Setup (Compact) ── */}
              <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
                <TouchableOpacity
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); updateMission({ missionEnabled: !(missionSettings.missionEnabled ?? false) }); }}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF03', borderWidth: 1, borderColor: (missionSettings.missionEnabled ?? false) ? '#f59e0b40' : '#FFFFFF10', borderRadius: 16, padding: 14 }}
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Text style={{ fontSize: 16 }}>🎯</Text>
                    <Text style={{ fontSize: 14, fontFamily: 'Nunito_700Bold', color: (missionSettings.missionEnabled ?? false) ? '#fff' : '#FFFFFF90' }}>Morning Mission</Text>
                  </View>
                  <Toggle value={missionSettings.missionEnabled ?? false} onToggle={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); updateMission({ missionEnabled: !(missionSettings.missionEnabled ?? false) }); }} color="#f59e0b" />
                </TouchableOpacity>

                {(missionSettings.missionEnabled ?? false) && (
                  <View style={{ gap: 4, marginTop: 10 }}>
                    {MISSIONS.map(ms => { const active = missionSettings.selectedMission === ms.id; return (
                      <TouchableOpacity key={ms.id} onPress={() => handleSelectMission(ms.id)} style={[{ flexDirection: 'row', alignItems: 'center', height: 48, borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, gap: 12 }, { borderColor: active ? ms.color : '#FFFFFF12', backgroundColor: active ? ms.color + '15' : '#FFFFFF05' }]} activeOpacity={0.8}>
                        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: active ? ms.color + '20' : '#FFFFFF08', alignItems: 'center', justifyContent: 'center' }}>
                           <Text style={{ fontSize: 16 }}>{ms.icon}</Text>
                        </View>
                        <Text style={{ flex: 1, fontSize: 14, fontFamily: 'Nunito_700Bold', color: active ? '#fff' : Colors.textMuted }}>{ms.name}</Text>
                        {active && <Feather name="check-circle" size={18} color={ms.color} />}
                      </TouchableOpacity>
                    ); })}
                  </View>
                )}
              </View>
            </ScrollView>

            {/* Floating Wake Alarm Save button */}
            <View style={{ position: 'absolute', bottom: 50, left: 20, right: 20 }}>
              <TouchableOpacity
                onPress={() => {
                  if (isAddingExtraWake) {
                    if (editingExtraWake) {
                      setShowWakeEdit(false); setEditingExtraWake(null); setExtraFormLabel(''); stopPreview(); updateExtraWakeAlarm().catch(() => {});
                    } else {
                      setShowWakeEdit(false); setIsAddingExtraWake(false); setExtraFormLabel(''); stopPreview(); addExtraWakeAlarm().catch(() => {});
                    }
                  } else {
                    const duplicate = extraWakeAlarms.some(a => a.hour === wakeFormHour && a.minute === wakeFormMinute);
                    if (duplicate) {
                      Alert.alert('⚠️ Duplicate Time', `Another wake alarm is already set for ${fmt12(wakeFormHour, wakeFormMinute)}.`);
                      return;
                    }
                    setShowWakeEdit(false); stopPreview();
                    persistAndApply({ ...settings, wakeAlarm: { ...settings.wakeAlarm, enabled: true, hour: wakeFormHour, minute: wakeFormMinute, days: wakeRepeatDays } }).catch(() => {});
                  }
                }}
                style={{ borderRadius: 999, overflow: 'hidden', shadowColor: '#38bdf8', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.45, shadowRadius: 25, elevation: 15 }}
                activeOpacity={0.9}
              >
                <LinearGradient colors={['#0284c7', '#7dd3fc']} start={{x:0, y:0}} end={{x:1, y:1}} style={{ paddingVertical: 20, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 16, fontFamily: 'Nunito_800ExtraBold', color: '#ffffff', letterSpacing: 2, textTransform: 'uppercase' }}>
                    {isAddingExtraWake ? (editingExtraWake ? 'Update Wake Alarm' : 'Set Wake Alarm') : 'Set Wake Alarm'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* ── Rise at Brahma Muhurta Modal ── */}
      <Modal
        visible={showBMModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowBMModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: '#060610' }}>
          <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>

            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#FFFFFF08' }}>
              <TouchableOpacity onPress={() => setShowBMModal(false)} style={{ padding: 4 }}>
                <Feather name="x" size={22} color="rgba(255,255,255,0.35)" />
              </TouchableOpacity>
              <Text style={{ fontSize: 12, fontWeight: '900', color: '#f59e0b60', letterSpacing: 2.5 }}>BRAHMA MUHURTA ALARM</Text>
              <View style={{ width: 32 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>

              {/* ── Hero Section ── */}
              <LinearGradient
                colors={['#1a0e00', '#0f0700', '#060610']}
                style={{ marginHorizontal: 20, marginTop: 16, borderRadius: 24, overflow: 'hidden', borderWidth: 1.5, borderColor: '#f59e0b30', padding: 28, alignItems: 'center' }}
              >
                <Text style={{ fontSize: 64, marginBottom: 8 }}>🌄</Text>
                <Text style={{ fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: 0.5, marginBottom: 4, textAlign: 'center' }}>Brahma Muhurta</Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#f59e0b', letterSpacing: 1.5, marginBottom: 20, textAlign: 'center' }}>THE GREATER MEDITATIVE HOUR</Text>

                {bmHour !== null ? (
                  <>
                    <Text style={{ fontSize: 11, color: '#FFFFFF40', fontWeight: '700', letterSpacing: 1.2, marginBottom: 6 }}>TOMORROW · SACRED WINDOW OPENS</Text>
                    <Text style={{ fontSize: 52, fontWeight: '200', color: '#fff', letterSpacing: -2, lineHeight: 58 }}>{fmt12(bmHour, bmMinute)}</Text>
                    <Text style={{ fontSize: 12, color: '#f59e0b80', fontWeight: '600', marginTop: 8, textAlign: 'center' }}>96 minutes before sunrise</Text>
                    <Text style={{ fontSize: 11, color: '#FFFFFF35', fontWeight: '500', marginTop: 4, textAlign: 'center' }}>Recalculates daily as the sun shifts with the season</Text>
                  </>
                ) : (
                  <View style={{ alignItems: 'center', padding: 16 }}>
                    <Text style={{ fontSize: 28, marginBottom: 8 }}>📍</Text>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFFFFF60', textAlign: 'center' }}>Enable location to calculate{'\n'}your local Brahma Muhurta time</Text>
                  </View>
                )}
              </LinearGradient>

              {/* ── Science Note ── */}
              <View style={{ marginHorizontal: 20, marginTop: 14, padding: 16, borderRadius: 16, backgroundColor: '#FFFFFF05', borderWidth: 1, borderColor: '#FFFFFF0A' }}>
                <Text style={{ fontSize: 11, color: '#FFFFFF50', fontWeight: '600', lineHeight: 18, textAlign: 'center' }}>
                  Alpha & theta brainwaves dominate pre-dawn hours. Cortisol begins its natural surge.{'\n'}
                  The subconscious–conscious veil is at its thinnest. <Text style={{ color: '#f59e0b80' }}>The ideal window for meditation & intention-setting.</Text>
                </Text>
              </View>

              {/* ── Locked Sound ── */}
              <View style={{ marginHorizontal: 20, marginTop: 16 }}>
                <Text style={[S.sheetSection, { marginHorizontal: 0, marginBottom: 10 }]}>SACRED SOUND · LOCKED TO THIS ALARM</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 18, borderWidth: 1.5, borderColor: '#c084fc50', backgroundColor: '#c084fc0A', padding: 16 }}>
                  <Text style={{ fontSize: 28 }}>🌌</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '900', color: '#fff' }}>Spiritual Journey</Text>
                    <Text style={{ fontSize: 11, color: '#FFFFFF45', marginTop: 2 }}>A journey through sacred realms · Meditations</Text>
                  </View>
                  <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, backgroundColor: '#c084fc20', borderWidth: 1, borderColor: '#c084fc40' }}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#c084fc' }}>ACTIVE</Text>
                  </View>
                </View>
              </View>

              {/* ── Rise on These Days ── */}
              <View style={{ marginHorizontal: 20, marginTop: 16 }}>
                <Text style={[S.sheetSection, { marginHorizontal: 0, marginBottom: 10 }]}>RISE ON THESE DAYS</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                  {([
                    { label: 'Every Day', days: [0, 1, 2, 3, 4, 5, 6] },
                    { label: 'Weekdays',  days: [1, 2, 3, 4, 5] },
                    { label: 'Weekends',  days: [0, 6] },
                  ] as const).map(p => {
                    const isMatch = p.days.length === bmAlarmDays.length && p.days.every(d => bmAlarmDays.includes(d));
                    return (
                      <TouchableOpacity
                        key={p.label}
                        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setBmAlarmDays([...p.days]); }}
                        style={{ flex: 1, paddingVertical: 9, borderRadius: 12, borderWidth: 1, borderColor: isMatch ? '#f59e0b80' : '#FFFFFF15', backgroundColor: isMatch ? '#f59e0b15' : 'transparent', alignItems: 'center' }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '800', color: isMatch ? '#f59e0b' : '#FFFFFF55' }}>{p.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <DaySelector days={bmAlarmDays} onChange={setBmAlarmDays} />
              </View>

              {/* ── Active BM alarm cancel option ── */}
              {settings.brahmaMuhurtaAlarm?.enabled && (
                <TouchableOpacity
                  onPress={cancelBMAlarm}
                  style={{ marginHorizontal: 20, marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#ef444430', backgroundColor: '#ef44440A' }}
                  activeOpacity={0.7}
                >
                  <Feather name="bell-off" size={15} color="#ef4444" />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#ef4444' }}>Cancel Sacred Alarm</Text>
                </TouchableOpacity>
              )}

              {/* ── Set Button ── */}
              <TouchableOpacity
                onPress={saveBMAlarm}
                disabled={bmHour === null}
                style={{
                  marginHorizontal: 20, marginTop: 20, marginBottom: 10,
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: 'rgba(217,119,6,0.15)',
                  borderRadius: 16,
                  paddingVertical: 18,
                  borderWidth: 1, borderColor: 'rgba(217,119,6,0.4)',
                  shadowColor: '#d97706', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10,
                  opacity: bmHour === null ? 0.4 : 1
                }}
                activeOpacity={0.85}
              >
                <Text style={{ fontSize: 13, fontFamily: 'Nunito_800ExtraBold', color: '#fbbf24', letterSpacing: 1.5, textTransform: 'uppercase' }}>
                  SET SACRED DAWN ALARM
                </Text>
              </TouchableOpacity>
              <View style={{ height: 24 }} />
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {/* ── Sound Bath Alarm Modal ── */}
      <Modal
        visible={addType === 'soundbath' || editEntry?.type === 'soundbath'}
        animationType="slide"
        transparent={false}
        onRequestClose={() => { stopPreview(); setAddType(null); setEditEntry(null); }}
      >
        <View style={{ flex: 1, backgroundColor: '#060610' }}>
          <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#FFFFFF08' }}>
              <TouchableOpacity onPress={() => { stopPreview(); setAddType(null); setEditEntry(null); }} style={{ padding: 4 }}>
                <Feather name="x" size={22} color="rgba(255,255,255,0.35)" />
              </TouchableOpacity>
              <Text style={{ fontSize: 12, fontWeight: '900', color: '#FFFFFF30', letterSpacing: 2.5 }}>SOUND BATH ALARM</Text>
              <View style={{ width: 32 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingBottom: 160 }}>
              {/* Selected sound hero card */}
              {(() => {
                const selSnd = ALARM_SOUNDS.find(s => s.id === formSoundId);
                const selColor = selSnd?.color ?? '#a78bfa';
                const selImgSrc = selSnd?.id === 'lalitha' ? LALITHA_IMG : (SOUND_IMAGES[formSoundId] ? { uri: getLocalSoundImageUri(SOUND_IMAGES[formSoundId]) } : undefined);
                return (
                  <View style={{ marginHorizontal: 20, marginTop: 16, marginBottom: 16 }}>
                    {/* Selected Sound Banner */}
                    <View style={{ height: 64, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: selColor + '20', marginBottom: 12 }}>
                      <ImageBackground source={selImgSrc} style={{ flex: 1 }} imageStyle={{ borderRadius: 14, opacity: 0.7 }}>
                        <LinearGradient colors={['rgba(0,0,0,0.6)', 'rgba(0,0,0,0.9)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[StyleSheet.absoluteFillObject, { borderRadius: 14 }]} />
                        <View style={{ flex: 1, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' }}>
                          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                            <Text style={{ fontSize: 18 }}>{selSnd?.emoji ?? '🎵'}</Text>
                          </View>
                          <View style={{ flex: 1, justifyContent: 'center' }}>
                            <Text style={{ fontSize: 8, fontFamily: 'Nunito_800ExtraBold', color: selColor, letterSpacing: 1.6, marginBottom: 1 }}>CURRENTLY SELECTED</Text>
                            <Text style={{ fontSize: 15, fontFamily: 'Nunito_800ExtraBold', color: '#fff', letterSpacing: -0.2 }} numberOfLines={1}>{selSnd?.label ?? 'Sound Bath'}</Text>
                          </View>
                        </View>
                      </ImageBackground>
                    </View>

                    {/* Elegant Select Button */}
                    <TouchableOpacity
                      onPress={() => { setLibraryModalTarget('habit'); setLibraryModalVisible(true); }}
                      activeOpacity={0.8}
                      style={{ height: 50, borderRadius: 16, overflow: 'hidden' }}
                    >
                      <LinearGradient colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.03)']} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 16 }}>
                        <Feather name="headphones" size={16} color="#fff" style={{ marginRight: 10, opacity: 0.9 }} />
                        <Text style={{ fontSize: 13, fontFamily: 'Nunito_800ExtraBold', color: '#fff', letterSpacing: 1.5 }}>CHOOSE SOUND BATH</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                );
              })()}

              {/* Time picker */}
              <View style={{ alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16 }}>
                <TimeAdjuster hour={formHour} minute={formMinute} onChange={(h, m) => { setFormHour(h); setFormMinute(m); }} />
              </View>

              {/* Repeat days */}
              <View style={{ paddingHorizontal: 20, marginBottom: 16, marginTop: 12 }}>
                <Text style={{ fontSize: 10, fontFamily: 'Nunito_800ExtraBold', color: '#a78bfa80', letterSpacing: 1.5, marginBottom: 10, marginLeft: 4 }}>REPEAT DAYS</Text>
                <DaySelector days={formDays} onChange={setFormDays} />
              </View>

              {/* Sound picker widget (now integrated into the hero card) */}

              {/* Optional label */}
              <View style={{ marginHorizontal: 20, marginTop: 12, marginBottom: 20 }}>
                <Text style={{ fontSize: 10, fontFamily: 'Nunito_800ExtraBold', color: '#a78bfa80', letterSpacing: 1.5, marginBottom: 10, marginLeft: 4 }}>LABEL (OPTIONAL)</Text>
                <TextInput
                  style={{ backgroundColor: 'rgba(167, 139, 250, 0.05)', borderWidth: 1, borderColor: 'rgba(167, 139, 250, 0.3)', borderRadius: 18, paddingHorizontal: 20, paddingVertical: 16, color: '#fff', fontSize: 15, fontFamily: 'Nunito_600SemiBold' }}
                  placeholder="e.g. Morning Meditation, Evening Rest..."
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={formLabel}
                  onChangeText={setFormLabel}
                />
              </View>
            </ScrollView>

            {/* Floating Save button */}
            <View style={{ position: 'absolute', bottom: 50, left: 20, right: 20 }}>
              <TouchableOpacity
                onPress={() => { stopPreview(); saveNewEntry(); }}
                style={{ borderRadius: 999, overflow: 'hidden', shadowColor: '#c084fc', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.45, shadowRadius: 25, elevation: 15 }}
                activeOpacity={0.9}
              >
                <LinearGradient colors={['#9333ea', '#d8b4fe']} start={{x:0, y:0}} end={{x:1, y:1}} style={{ paddingVertical: 20, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 16, fontFamily: 'Nunito_800ExtraBold', color: '#ffffff', letterSpacing: 2, textTransform: 'uppercase' }}>
                    {editEntry ? 'Update Sound Bath' : 'Set Sound Bath'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Habit Alarm Modal — full screen */}
      <Modal visible={addType === 'habit' || editEntry?.type === 'habit'} animationType="slide" transparent={false} onRequestClose={() => { setAddType(null); setEditEntry(null); }}>
        <View style={{ flex: 1, backgroundColor: '#0C0C1C' }}>

          {/* ── Header ── */}
          <SafeAreaView edges={['top']} style={{ backgroundColor: '#0C0C1C' }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 18, paddingTop: 10, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#FFFFFF0C', gap: 12 }}>
              <TouchableOpacity onPress={() => { setAddType(null); setEditEntry(null); }} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFFFFF0E', alignItems: 'center', justifyContent: 'center', marginTop: 2, flexShrink: 0 }} activeOpacity={0.7}>
                <Text style={{ fontSize: 16, color: '#FFFFFF80', fontWeight: '600' }}>✕</Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 18, fontWeight: '900', color: '#fff', letterSpacing: 0.2 }}>Habit Alarm</Text>
                <Text style={{ fontSize: 11, color: '#FFFFFF55', marginTop: 3, lineHeight: 16 }}>
                  Add habit alarms with gentle sounds to make your life disciplined and increase your productivity.
                </Text>
              </View>
              {formHabitKey !== '' && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#10b98118', borderWidth: 1, borderColor: '#10b98140', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, marginTop: 2, flexShrink: 0 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' }} />
                  <Text style={{ fontSize: 10, fontWeight: '900', color: '#10b981' }}>READY</Text>
                </View>
              )}
            </View>
          </SafeAreaView>

          {/* ── Habit section (with vertical scroll) ── */}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 16 }} showsVerticalScrollIndicator={false}>
            <View style={{ paddingBottom: 16 }}>
              <Text style={[S.sheetSection, { marginHorizontal: 16, marginTop: 14, marginBottom: 10 }]}>CHOOSE HABIT</Text>

              {/* ── Horizontal pager: each page = 4 cols × 2 rows ── */}
              <View style={{ marginBottom: 2 }}>
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  decelerationRate="fast"
                  scrollEventThrottle={16}
                  onMomentumScrollEnd={e => {
                    const pg = Math.round(e.nativeEvent.contentOffset.x / width);
                    setHabitPage(pg);
                  }}
                >
                  {habitPages.map((page, pageIdx) => (
                    <View key={pageIdx} style={{ width, flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingTop: 2, paddingBottom: 6 }}>
                      {page.map(h => {
                        const active = formHabitKey === h.key;
                        return (
                          <TouchableOpacity
                            key={h.key}
                            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setFormHabitKey(h.key); setFormHabitEmoji(h.emoji); setFormLabel(h.label); setShowCustomHabitInput(false); }}
                            style={[S.habitChip, active && { borderColor: '#10b981', backgroundColor: '#10b98122', transform: [{ scale: 1.05 }] }]}
                            activeOpacity={0.75}
                          >
                            <Text style={{ fontSize: 26 }}>{h.emoji}</Text>
                            <Text style={{ fontSize: 9, fontWeight: '700', color: active ? '#10b981' : Colors.textDim, textAlign: 'center', lineHeight: 13 }}>{h.label}</Text>
                            {active && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981', marginTop: 1 }} />}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ))}
                </ScrollView>

                {/* Page indicator dots */}
                {habitPages.length > 1 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingTop: 8, paddingBottom: 4 }}>
                    {habitPages.map((_, i) => (
                      <View key={i} style={{ width: i === habitPage ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i === habitPage ? '#10b981' : '#FFFFFF22' }} />
                    ))}
                  </View>
                )}
              </View>

              {/* ── Custom habit row ── */}
              <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setFormHabitKey('custom'); setFormHabitEmoji('✨'); setShowCustomHabitInput(true); setFormLabel(''); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 14, marginHorizontal: 16, marginTop: 6, marginBottom: 4, borderColor: formHabitKey === 'custom' ? '#60a5fa' : '#FFFFFF14', backgroundColor: formHabitKey === 'custom' ? '#60a5fa14' : '#FFFFFF04' }} activeOpacity={0.8}>
                <Text style={{ fontSize: 22 }}>✨</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: formHabitKey === 'custom' ? '#60a5fa' : '#fff' }}>Custom Habit</Text>
                  <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 1 }}>Type any habit name</Text>
                </View>
                {formHabitKey === 'custom' && <Text style={{ fontSize: 14, color: '#60a5fa', fontWeight: '900' }}>✓</Text>}
              </TouchableOpacity>
              {showCustomHabitInput && (
                <TextInput style={[S.customInput, { marginHorizontal: 16, marginTop: 4, marginBottom: 4 }]} placeholder="Custom habit name..." placeholderTextColor={Colors.textDim} value={formLabel} onChangeText={setFormLabel} autoFocus />
              )}
            </View>

            {/* ── Bottom: Time + Days + Save ── */}
            <View style={{ flex: 1, justifyContent: 'flex-end' }}>
              <View style={{ backgroundColor: '#0E0E20', borderTopWidth: 1, borderTopColor: '#FFFFFF10', paddingHorizontal: 16, paddingTop: 14 }}>
                {formHabitKey !== '' && (() => {
                  const w = formHabitKey !== 'custom' ? HABIT_WISDOM[formHabitKey] : null;
                  if (w) {
                    return (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, borderColor: w.color + '45', backgroundColor: w.color + '0D', paddingVertical: 9, paddingHorizontal: 12, marginBottom: 10 }}>
                        <View style={{ width: 34, height: 34, borderRadius: 10, borderColor: w.color + '55', borderWidth: 1, backgroundColor: w.color + '18', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Text style={{ fontSize: 17 }}>{w.icon}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 8, fontWeight: '900', color: w.color, letterSpacing: 1.4, marginBottom: 2 }}>{w.title}</Text>
                          <Text style={{ fontSize: 10, color: '#FFFFFFBB', lineHeight: 14 }} numberOfLines={2}>{w.body}</Text>
                        </View>
                      </View>
                    );
                  }
                  return (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <Text style={{ fontSize: 18 }}>✨</Text>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: '#60a5fa', flex: 1 }}>{formLabel || 'Custom Habit'}</Text>
                      <Text style={{ fontSize: 9, color: '#FFFFFF30', fontWeight: '700', letterSpacing: 1 }}>SET TIME  ↓</Text>
                    </View>
                  );
                })()}
                <Text style={[S.sheetSection, { marginTop: 0, marginBottom: 2, marginHorizontal: 0 }]}>SET TIME</Text>
                <TimeAdjuster hour={formHour} minute={formMinute} onChange={(hr, mn) => { setFormHour(hr); setFormMinute(mn); }} />
                <Text style={[S.sheetSection, { marginTop: 8, marginBottom: 6, marginHorizontal: 0 }]}>REPEAT DAYS</Text>
                <DaySelector days={formDays} onChange={setFormDays} />
                <TouchableOpacity onPress={saveNewEntry} disabled={formHabitKey === ''} style={[S.saveBtn, { marginTop: 10, opacity: formHabitKey === '' ? 0.4 : 1 }]} activeOpacity={0.8}>
                  <Text style={S.saveBtnTxt}>{editEntry ? '✓  Update Habit Alarm' : '✓  Save Habit Alarm'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>

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
            <TouchableOpacity
              onPress={saveNewEntry}
              style={{
                marginHorizontal: 16, marginTop: 16,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: 'rgba(16,185,129,0.15)',
                borderRadius: 16,
                paddingVertical: 18,
                borderWidth: 1, borderColor: 'rgba(16,185,129,0.4)',
                shadowColor: '#10b981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10,
              }}
              activeOpacity={0.85}
            >
              <Text style={{ fontSize: 13, fontFamily: 'Nunito_800ExtraBold', color: '#34d399', letterSpacing: 1.5, textTransform: 'uppercase' }}>
                {editEntry ? 'UPDATE ALARM' : 'SAVE ALARM'}
              </Text>
            </TouchableOpacity>
            <View style={{ height: 48 }} />
          </View>
        </View>
      </Modal>


      {/* ── Custom Alarm Context Menu ── */}
      {menuTarget && (
        <Modal transparent animationType="fade" visible={!!menuTarget} onRequestClose={() => setMenuTarget(null)}>
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}
            activeOpacity={1}
            onPress={() => setMenuTarget(null)}
          >
            <TouchableOpacity activeOpacity={1} style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 100 }}>
              <View style={{ borderRadius: 22, overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(200,180,255,0.35)', backgroundColor: 'rgba(22,12,58,0.93)' }}>
                <LinearGradient
                  colors={['rgba(167,139,250,0.32)', 'rgba(120,100,200,0.18)', 'rgba(255,255,255,0.04)']}
                  start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 1 }}
                  style={StyleSheet.absoluteFillObject} />
                <View style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14 }}>
                  <Text style={{ fontSize: 9, fontWeight: '900', color: '#FFFFFF38', letterSpacing: 1.8 }}>
                    {menuTarget.type === 'wake' ? 'WAKE ALARM' : menuTarget.type === 'extraWake' ? 'WAKE ALARM' : menuTarget.entry?.type === 'habit' ? 'HABIT ALARM' : menuTarget.entry?.type === 'soundbath' ? 'SOUND BATH' : 'QUICK ALARM'}
                  </Text>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff', marginTop: 3 }} numberOfLines={1}>
                    {menuTarget.type === 'wake'
                      ? fmt12(settings.wakeAlarm.hour, settings.wakeAlarm.minute)
                      : menuTarget.type === 'extraWake'
                      ? `${menuTarget.extraWake?.label ?? 'Wake Alarm'}  ·  ${fmt12(menuTarget.extraWake?.hour ?? 0, menuTarget.extraWake?.minute ?? 0)}`
                      : `${menuTarget.entry?.label ?? ''}  ·  ${fmt12(menuTarget.entry?.hour ?? 0, menuTarget.entry?.minute ?? 0)}`}
                  </Text>
                </View>
                <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.13)', marginHorizontal: 16 }} />
                <TouchableOpacity
                  onPress={() => {
                    const t = menuTarget;
                    setMenuTarget(null);
                    if (t.type === 'wake') { setIsAddingExtraWake(false); setWakeFormHour(settings.wakeAlarm.hour); setWakeFormMinute(settings.wakeAlarm.minute); setShowWakeEdit(true); }
                    else if (t.type === 'extraWake' && t.extraWake) openEditExtraWake(t.extraWake);
                    else if (t.entry) openEditEntry(t.entry);
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 17 }}
                  activeOpacity={0.7}
                >
                  <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: '#60a5fa14', borderWidth: 1, borderColor: '#60a5fa28', alignItems: 'center', justifyContent: 'center' }}>
                    <Feather name="edit-2" size={15} color="#60a5fa" />
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff', flex: 1 }}>Edit Alarm</Text>
                  <Feather name="chevron-right" size={15} color="#FFFFFF28" />
                </TouchableOpacity>
                {menuTarget.type !== 'wake' && (
                  <>
                    <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.10)', marginHorizontal: 16 }} />
                    <TouchableOpacity
                      onPress={() => {
                        const t = menuTarget;
                        setMenuTarget(null);
                        if (t.type === 'extraWake' && t.extraWake) deleteExtraWake(t.extraWake.id);
                        else if (t.entry) deleteEntry(t.entry.id);
                      }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 17 }}
                      activeOpacity={0.7}
                    >
                      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: '#ef444414', borderWidth: 1, borderColor: '#ef444428', alignItems: 'center', justifyContent: 'center' }}>
                        <Feather name="trash-2" size={15} color="#ef4444" />
                      </View>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: '#ef4444', flex: 1 }}>Delete Alarm</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
              <TouchableOpacity
                onPress={() => setMenuTarget(null)}
                style={{ marginTop: 8, borderRadius: 16, backgroundColor: 'rgba(22,12,58,0.90)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.28)', paddingVertical: 15, alignItems: 'center' }}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: 'rgba(200,180,255,0.60)' }}>Cancel</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}

      <AlarmSoundLibraryModal
        visible={libraryModalVisible}
        onClose={() => {
          setLibraryModalVisible(false);
          stopPreview().catch(() => {});
        }}
        sounds={ALARM_SOUNDS as any}
        selectedId={libraryModalTarget === 'wake' ? selectedMantraId : formSoundId}
        previewingId={previewingId}
        previewLoadingId={previewLoadingId}
        dlStatus={dlStatus}
        dlProgress={dlProgress}
        onSelectSound={(id) => {
          if (libraryModalTarget === 'wake') handleMantraSelect(id);
          else setFormSoundId(id);
          setLibraryModalVisible(false);
          stopPreview().catch(() => {});
        }}
        onTogglePreview={togglePreview}
      />

    </View>
  );
}

const S = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden' },
  pageHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 4, paddingBottom: 10 },
  pageHeaderTitle: { fontSize: 24, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.5, textShadowColor: 'rgba(0,0,0,0.90)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10 },
  pageHeaderEyebrow: { fontSize: 8, fontWeight: '800', color: 'rgba(167,139,250,0.85)', letterSpacing: 2.5 },
  pageHeaderClock: { fontSize: 13, fontWeight: '200', color: 'rgba(255,255,255,0.40)', letterSpacing: -0.3 },
  headerGrad: { paddingBottom: 2 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 2, paddingBottom: 2 },
  appName: { fontSize: 15, fontWeight: '900', color: '#fff', letterSpacing: 0.5, fontFamily: 'Nunito_900Black' },
  headerCountdownRow: { paddingHorizontal: 16, paddingBottom: 0, gap: 4 },
  headerDateSmall: { fontSize: 11, color: '#FFFFFF35', fontWeight: '500', paddingHorizontal: 4 },
  countdownBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: ACCENT + '14', borderWidth: 1, borderColor: ACCENT + '35', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start' },
  countdownBannerOff: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF08', borderWidth: 1, borderColor: '#FFFFFF12', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start' },
  countdownDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: ACCENT },
  countdownTxt: { fontSize: 12, fontWeight: '700', color: '#fdba74', fontFamily: 'Nunito_700Bold' },
  countdownChevron: { fontSize: 16, color: ACCENT, fontWeight: '300', lineHeight: 18 },
  countdownOffTxt: { fontSize: 11, color: '#FFFFFF30', fontWeight: '500' },
  permsBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9731610', borderBottomWidth: 1, borderBottomColor: '#f9731625', paddingHorizontal: 16, paddingVertical: 10 },
  permsText: { flex: 1, color: '#f97316', fontSize: 11, fontWeight: '700' },
  permsChevron: { color: '#f97316', fontSize: 14, fontWeight: '900' },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 6, marginBottom: 0, gap: 10 },
  sectionHeaderTxt: { fontSize: 9, fontWeight: '900', color: '#74B87480', letterSpacing: 2.0, fontFamily: 'Nunito_900Black' },
  sectionHeaderLine: { flex: 1, height: 1, backgroundColor: '#74B87430' },
  alarmCard: { marginHorizontal: 16, marginTop: 10, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', backgroundColor: 'rgba(255,255,255,0.10)', overflow: 'hidden' },
  alarmCardActive: { borderColor: 'rgba(255,255,255,0.40)', backgroundColor: 'rgba(255,255,255,0.16)' },
  alarmCardHabit: { borderColor: 'rgba(255,255,255,0.28)', backgroundColor: 'rgba(255,255,255,0.10)' },
  alarmCardQuick: { borderColor: 'rgba(255,255,255,0.28)', backgroundColor: 'rgba(255,255,255,0.10)' },
  alarmCardInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 13, paddingVertical: 6, paddingLeft: 11, gap: 12 },
  alarmAccentBar: { width: 3, alignSelf: 'stretch' },
  alarmLeft: { flex: 1, gap: 2 },
  alarmTypePill: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 1 },
  alarmTypeEmoji: { fontSize: 12 },
  alarmTypeTxt: { fontSize: 8, fontWeight: '900', color: '#FFFFFF70', letterSpacing: 1.4, fontFamily: 'Nunito_900Black' },
  alarmTime: { fontSize: 24, letterSpacing: -0.8, lineHeight: 27, fontWeight: '300' },
  alarmTimeOn: { color: '#FFFFFF' },
  alarmTimeOff: { color: 'rgba(255,255,255,0.22)' },
  alarmTimeHabit: { color: '#FFFFFF' },
  alarmTimeQuick: { color: '#FFFFFF' },
  alarmSub: { fontSize: 10, color: '#FFFFFF65', fontWeight: '600', marginTop: 1, fontFamily: 'Nunito_600SemiBold' },
  emptyHint: { marginHorizontal: 16, marginTop: 32, alignItems: 'center', gap: 8, paddingVertical: 44, borderRadius: 22, borderWidth: 1, borderColor: '#FFFFFF06', borderStyle: 'dashed' },
  emptyIcon: { fontSize: 40, color: '#FFFFFF10' },
  emptyTxt: { fontSize: 13, color: '#FFFFFF22', fontWeight: '500' },
  fab: { position: 'absolute', bottom: 92, left: width / 2 - 27, width: 54, height: 54, borderRadius: 27, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center', elevation: 12, shadowColor: ACCENT, shadowOpacity: 0.8, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, zIndex: 11 },
  fabOpen: { backgroundColor: 'rgba(255,255,255,0.15)', shadowOpacity: 0, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  fabTxt: { fontSize: 28, color: '#fff', fontWeight: '300', lineHeight: 32, marginTop: -2 },
  fabBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9 },
  fabMenu: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 10, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 12 },
  fabMenuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, minWidth: 260 },
  fabMenuItemTxt: { fontSize: 16, fontWeight: '600', fontFamily: 'Nunito_600SemiBold', letterSpacing: 0.3 },
  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000075' },
  sheet: { backgroundColor: '#0D0D20', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, maxHeight: '92%' },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#FFFFFF18', alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 20, fontWeight: '900', color: '#fff', marginBottom: 6, fontFamily: 'Nunito_900Black' },
  sheetSection: { fontSize: 8, fontWeight: '900', color: '#FFFFFF28', letterSpacing: 1.6, marginTop: 16, marginBottom: 8, fontFamily: 'Nunito_900Black' },
  presetChip: { flex: 1, borderRadius: 14, borderWidth: 1, borderColor: '#FFFFFF12', backgroundColor: '#FFFFFF05', padding: 10, alignItems: 'center', gap: 2 },
  presetChipTime: { fontSize: 12, fontWeight: '900', fontFamily: 'Nunito_900Black' },
  presetChipLabel: { fontSize: 8, color: '#FFFFFF30', fontWeight: '600', fontFamily: 'Nunito_600SemiBold' },
  prakritiRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 6, backgroundColor: '#FFFFFF04' },
  mantraChip: { width: 104, borderRadius: 14, borderWidth: 1, borderColor: '#FFFFFF12', backgroundColor: '#FFFFFF05', padding: 10, alignItems: 'center', gap: 4 },
  missionChip: { borderRadius: 14, borderWidth: 1, padding: 12, alignItems: 'center', gap: 4, width: (width - 40 - 8) / 2 },
  settingsCard: { backgroundColor: 'rgba(255,255,255,0.09)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)', borderRadius: 18, marginBottom: 10, overflow: 'hidden' },
  settingsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  streakBanner: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, borderWidth: 1, borderColor: ACCENT + '30', padding: 14, marginBottom: 14, marginTop: 4 },
  testBtn: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 14, alignItems: 'center', gap: 4 },
  sheetDoneBtn: { backgroundColor: ACCENT + '25', borderWidth: 1, borderColor: ACCENT + '50', borderRadius: 99, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  sheetDoneTxt: { color: ACCENT, fontWeight: '900', fontSize: 15, fontFamily: 'Nunito_900Black' },
  habitChip: { borderRadius: 14, borderWidth: 1, borderColor: '#FFFFFF10', backgroundColor: '#FFFFFF04', padding: 10, alignItems: 'center', gap: 4, width: (width - 40 - 24) / 4 },
  customInput: { backgroundColor: '#FFFFFF07', borderWidth: 1, borderColor: '#FFFFFF12', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, color: '#fff', fontSize: 14, marginBottom: 8 },
  saveBtn: { backgroundColor: '#10b98118', borderWidth: 1, borderColor: '#10b98140', borderRadius: 99, paddingVertical: 14, alignItems: 'center' },
  saveBtnTxt: { color: '#10b981', fontWeight: '900', fontSize: 15, fontFamily: 'Nunito_900Black' },
  kebabBtn: { paddingVertical: 6, paddingHorizontal: 8, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  kebabDot: { width: 4.5, height: 4.5, borderRadius: 2.5, backgroundColor: '#FFFFFFDD', marginVertical: 2.5 },
  cardMenu: { marginHorizontal: 16, marginBottom: 14, backgroundColor: 'rgba(255,255,255,0.13)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', overflow: 'hidden' },
  cardMenuItem: { paddingHorizontal: 20, paddingVertical: 16 },
  cardMenuTxt: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Nunito_700Bold' },
  alarmBigTime: { fontSize: 38, fontWeight: '200', color: '#FFFFFF', letterSpacing: -2, lineHeight: 46 },
  alarmCountdownSub: { fontSize: 11, color: '#38bdf8BB', fontWeight: '800', fontFamily: 'Nunito_800ExtraBold' },
  listContainer: { marginHorizontal: 'auto', width: '90%', marginTop: 6, marginBottom: 14, borderRadius: 24, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.35, shadowRadius: 24, elevation: 12 },
  alarmCard2: { marginHorizontal: 'auto', width: '92%', borderRadius: 28, overflow: 'hidden', borderWidth: 1, borderTopColor: 'rgba(255,255,255,0.3)', borderBottomColor: 'rgba(255,255,255,0.05)', borderLeftColor: 'rgba(255,255,255,0.15)', borderRightColor: 'rgba(255,255,255,0.15)', backgroundColor: 'transparent', marginBottom: 16 },
  alarmRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  alarmRowBadge: { fontSize: 8, fontWeight: '500', letterSpacing: 0.8 },
  alarmRowTime: { fontSize: 18, fontWeight: '200', color: '#FFFFFF', letterSpacing: -1.0, lineHeight: 22 },
  alarmRowTimeOff: { color: 'rgba(255,255,255,0.28)' },
  alarmRowSub: { fontSize: 10, fontWeight: '400' },
  rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.18)', marginHorizontal: 18 },
});
