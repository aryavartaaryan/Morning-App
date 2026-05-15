import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, Modal,
  TextInput, Alert, Animated, Dimensions, NativeModules, Platform,
  ToastAndroid, ImageBackground, Linking, ActionSheetIOS,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
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
  ExtraWakeAlarm,
} from '@/lib/notifications';
import { MISSIONS, WAKE_SOUNDS, DEFAULT_MISSION_SETTINGS, MissionSettings } from '@/lib/missionAlarm';
import {
  scheduleNativeAlarm, cancelNativeAlarm, checkAlarmPermission,
  setNativeAlarmSound, setNativeAlarmSoundPath, requestAllAlarmPermissions,
  scheduleExtraWakeAlarm, cancelExtraWakeAlarm,
} from '@/lib/nativeAlarm';
import notifee, { AndroidImportance, AndroidCategory, AndroidVisibility, TriggerType, RepeatFrequency, AlarmType, AndroidForegroundServiceType } from '@notifee/react-native';
import { Colors, Font } from '@/constants/theme';
import { PRAKRITI_PLANS, type PledgeData } from '@/lib/prakritiPlan';
import { useBgContext } from '@/lib/bgContext';
import * as FileSystem from 'expo-file-system/legacy';
import { getLocalMantraPath, isMantraDownloaded, downloadMantra } from '@/lib/mantraDownload';
import { registerPreviewStopper } from '@/lib/alarmAudio';
import { SOUND_IMAGES } from '@/lib/sleepSoundsData';

const ACCENT = '#F5820A';
const { width } = Dimensions.get('window');
const MANTRA_TO_WAKE_SOUND: Record<string, string> = {
  gayatri: 'gayatri', lalitha: 'lalitha', shivtandav: 'shiv_tandav',
  bhagya_suktam: 'bhagya_suktam', shiv_sankalpa_suktam: 'shiv_sankalpa_suktam',
};
const BUNDLED_MANTRAS = new Set(['bhagya_suktam', 'shiv_sankalpa_suktam']);
const PRESETS = [
  { label: 'Brahma',  sub: '4:00 AM', hour: 4,  minute: 0,  color: '#60a5fa' },
  { label: 'Dawn',    sub: '4:30 AM', hour: 4,  minute: 30, color: '#60a5fa' },
  { label: 'Early',   sub: '5:30 AM', hour: 5,  minute: 30, color: '#60a5fa' },
  { label: 'Sunrise', sub: '6:00 AM', hour: 6,  minute: 0,  color: '#34d399' },
];
const MANTRAS = [
  { id: 'gayatri',    label: 'Gayatri Mantra',      emoji: '🌞', color: '#fbbf24', hint: 'ॐ भूर्भुवः स्वः', pitch: 0.85, rate: 0.70, text: 'Om Bhur Bhuva Swaha, Tat Savitur Varenyam, Bhargo Devasya Dhimahi, Dhiyo Yo Nah Prachodayat. Om Shanti Shanti Shanti.', audioUrl: 'https://ik.imagekit.io/rcsesr4xf/gayatri-mantra-ghanpaath.mp3' },
  { id: 'lalitha',    label: 'Lalitha Sahasranama', emoji: '🌺', color: '#f472b6', hint: 'ॐ ऐं ह्रीं श्रीं', pitch: 0.80, rate: 0.65, text: 'Om Aim Hreem Shreem, Sri Lalitha Tripura Sundari, Namami Namami Namami. Om Shakti Shakti Shakti.', audioUrl: 'https://ik.imagekit.io/rcsesr4xf/Lalitha-Sahasranamam.mp3' },
  { id: 'shivtandav',           label: 'Shiv Tandav',              emoji: '🔱', color: '#60a5fa', hint: 'ॐ नमः शिवाय',     pitch: 0.75, rate: 0.68, text: 'Jata tavee galajjala pravaha pavithrasthale. Om Namah Shivaya, Om Namah Shivaya. Har Har Mahadev.', audioUrl: 'https://ik.imagekit.io/rcsesr4xf/Shiva-Tandav.mp3' },
  { id: 'bhagya_suktam',        label: 'Bhagya Suktam',            emoji: '🌟', color: '#fbbf24', hint: 'Fortune Hymn',    pitch: 0.85, rate: 0.70, text: 'Om Bhagyam Dehi, Shri Devi Namaha. May prosperity, wisdom and fortune flow into this day. Om Shanti.', audioUrl: '' },
  { id: 'shiv_sankalpa_suktam', label: 'Shiv Sankalpa Suktam',     emoji: '🔱', color: '#60a5fa', hint: 'Sacred Mind Hymn',pitch: 0.80, rate: 0.68, text: 'Yat pragnanam uta cheto dhritishcha, Yat jyotir antah amritam prajasu. Yan nah chittam ahuti pupa ya, tan me manah shivasankalpam astu.', audioUrl: '' },
];
// ── Comprehensive alarm sound catalogue (nature + sacred + mantra + stotra) ──
const ALARM_SOUNDS = [
  // Nature
  { id: 'forest_birds',        label: 'Forest Birds',        emoji: '🐦', cat: 'Nature',  color: '#34d399', audioUrl: null as string | null },
  { id: 'sea_waves',           label: 'Sea Waves',           emoji: '🌊', cat: 'Nature',  color: '#38bdf8', audioUrl: null as string | null },
  { id: 'light_rain',          label: 'Light Rain',          emoji: '🌦️', cat: 'Nature',  color: '#60a5fa', audioUrl: null as string | null },
  { id: 'breeze_trees',        label: 'Forest Breeze',       emoji: '🌿', cat: 'Nature',  color: '#4ade80', audioUrl: null as string | null },
  { id: 'river_flow',          label: 'Flowing Water',       emoji: '🏞️', cat: 'Nature',  color: '#38bdf8', audioUrl: null as string | null },
  { id: 'morning_birds',       label: 'Morning Birds',       emoji: '🌅', cat: 'Nature',  color: '#fbbf24', audioUrl: null as string | null },
  { id: 'spring_birds',        label: 'Spring Birds',        emoji: '🌸', cat: 'Nature',  color: '#f472b6', audioUrl: null as string | null },
  { id: 'forest_birds_spring', label: 'Forest Birds',        emoji: '🌲', cat: 'Nature',  color: '#4ade80', audioUrl: null as string | null },
  { id: 'forest_campfire',     label: 'Forest Campfire',     emoji: '🔥', cat: 'Nature',  color: '#f97316', audioUrl: null as string | null },
  { id: 'wanderlust_breeze',   label: 'Wanderlust Breeze',   emoji: '🌬️', cat: 'Nature',  color: '#67e8f9', audioUrl: null as string | null },
  // Sacred
  { id: 'singing_bowl_deep',   label: 'Deep Singing Bowl',   emoji: '🔮', cat: 'Sacred',  color: '#a78bfa', audioUrl: null as string | null },
  { id: 'tibetan_bowl',        label: 'Tibetan Bowl',        emoji: '🕌', cat: 'Sacred',  color: '#c4b5fd', audioUrl: null as string | null },
  { id: 'morning_flute',       label: 'Light Meditation Tone',emoji: '🎶', cat: 'Sacred',  color: '#6ee7b7', audioUrl: null as string | null },
  { id: 'sitar_morning',       label: 'Calm Raga',           emoji: '🎵', cat: 'Sacred',  color: '#f59e0b', audioUrl: null as string | null },
  { id: 'healing_bells_432',   label: '432 Hz Bells',        emoji: '🔔', cat: 'Sacred',  color: '#fde68a', audioUrl: null as string | null },
  { id: 'indian_beats',        label: 'Indian Beats',        emoji: '🥁', cat: 'Sacred',  color: '#fb923c', audioUrl: null as string | null },
  // Mantras
  { id: 'gayatri',             label: 'Gayatri Mantra',      emoji: '🌞', cat: 'Mantra',  color: '#fbbf24', audioUrl: 'https://ik.imagekit.io/rcsesr4xf/gayatri-mantra-ghanpaath.mp3' as string | null },
  { id: 'lalitha',             label: 'Lalitha Sahasranama', emoji: '🌺', cat: 'Mantra',  color: '#f472b6', audioUrl: 'https://ik.imagekit.io/rcsesr4xf/Lalitha-Sahasranamam.mp3' as string | null },
  { id: 'shivtandav',          label: 'Shiv Tandav',         emoji: '🔱', cat: 'Mantra',  color: '#60a5fa', audioUrl: 'https://ik.imagekit.io/rcsesr4xf/Shiva-Tandav.mp3' as string | null },
  // Stotras (bundled)
  { id: 'bhagya_suktam',       label: 'Bhagya Suktam',       emoji: '🌟', cat: 'Stotra',  color: '#fbbf24', audioUrl: null as string | null },
  { id: 'shiv_sankalpa_suktam',label: 'Shiv Sankalpa Suktam',emoji: '🕉️', cat: 'Stotra',  color: '#c4b5fd', audioUrl: null as string | null },
];


const LALITHA_IMG = require('../../assets/images/mata-lalitha.jpg');

const ALARM_BUNDLED: Record<string, any> = {
  forest_birds:        require('../../assets/sounds/mixkit-jungle-rain-and-birds-2392.m4a'),
  sea_waves:           require('../../assets/sounds/mixkit-sea-waves-on-a-rocky-shore-1190.m4a'),
  light_rain:          require('../../assets/sounds/mixkit-light-rain-loop-2393.m4a'),
  breeze_trees:        require('../../assets/sounds/mixkit-breeze-through-the-trees-2427.m4a'),
  river_flow:          require('../../assets/sounds/mixkit-water-flowing-ambience-loop-3126.m4a'),
  singing_bowl_deep:   require('../../assets/sounds/singing-bowl-deep.m4a'),
  tibetan_bowl:        require('../../assets/sounds/tibetan-bowl.m4a'),
  morning_birds:       require('../../assets/sounds/morning-birds-loop.m4a'),
  spring_birds:        require('../../assets/sounds/spring-birds-morning.m4a'),
  forest_birds_spring: require('../../assets/sounds/forest-birds-spring.m4a'),
  morning_flute:       require('../../assets/sounds/morning-flute.m4a'),
  sitar_morning:       require('../../assets/sounds/sitar-morning.m4a'),
  healing_bells_432:   require('../../assets/sounds/432hz-healing-bells.m4a'),
  wanderlust_breeze:   require('../../assets/sounds/wanderlust-breeze.m4a'),
  forest_campfire:     require('../../assets/sounds/forest-campfire.m4a'),
  indian_beats:        require('../../assets/sounds/indian-beats.m4a'),
  bhagya_suktam:       require('../../assets/sounds/bhagya-suktam.mp3'),
  shiv_sankalpa_suktam:require('../../assets/sounds/shiv-sankalpa-suktam.mp3'),
};

const ALARM_SOUND_CATS = ['Nature', 'Sacred', 'Mantra', 'Stotra'] as const;

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

// ══════════════════════════════════════════════════════════════════════════════
export default function AlarmsTab() {
  const insets = useSafeAreaInsets();
  const [settings, setSettings]             = useState<AlarmSettings>(DEFAULT_ALARM_SETTINGS);
  const [saving, setSaving]                 = useState(false);
  const [selectedMantraId, setSelectedMantraId] = useState('bhagya_suktam');
  const saveAnim                            = useRef(new Animated.Value(0)).current;
  const alarmActiveRef                      = useRef(false);
  const [dlStatus, setDlStatus]             = useState<Record<string,'idle'|'downloading'|'downloaded'>>({ gayatri:'idle', lalitha:'idle', shivtandav:'idle', bhagya_suktam:'idle', shiv_sankalpa_suktam:'idle' });
  const [dlProgress, setDlProgress]         = useState<Record<string, number>>({});
  const [alarmEntries, setAlarmEntries]     = useState<AlarmEntry[]>([]);
  const [fabOpen, setFabOpen]               = useState(false);
  const [menuOpenId, setMenuOpenId]         = useState<string|null>(null);
  const [showWakeEdit, setShowWakeEdit]         = useState(false);
  const [showAddExtraWake, setShowAddExtraWake]  = useState(false);
  const [editingExtraWake, setEditingExtraWake]  = useState<ExtraWakeAlarm | null>(null);
  const [extraWakeAlarms, setExtraWakeAlarms]    = useState<ExtraWakeAlarm[]>([]);
  const [extraFormHour, setExtraFormHour]        = useState(8);
  const [extraFormMinute, setExtraFormMinute]    = useState(0);
  const [extraFormLabel, setExtraFormLabel]      = useState('');
  const [addType, setAddType]                    = useState<'habit'|'quick'|'soundbath'|null>(null);
  const [formSoundId, setFormSoundId]            = useState('morning_birds');
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
  const [alarmModal, setAlarmModal]         = useState(false);
  const { bgUri }                           = useBgContext();
  const [previewingId, setPreviewingId]     = useState<string | null>(null);
  const previewSoundRef                     = useRef<Audio.Sound | null>(null);

  useEffect(() => { const t = setInterval(() => setLiveClock(new Date()), 1000); return () => clearInterval(t); }, []);

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
          const [ea, bo, fs] = await Promise.all([checkAlarmPermission(), NativeModules.AlarmModule?.isBatteryOptimizationIgnored?.().catch(() => true) ?? Promise.resolve(true), NativeModules.AlarmModule?.checkFullScreenIntentPermission?.().catch(() => true) ?? Promise.resolve(true)]);
          const { status } = await (require('expo-notifications') as typeof import('expo-notifications')).getPermissionsAsync();
          setPermStatus({ notifications: status === 'granted', exactAlarm: !!ea, batteryOpt: !!bo, fullScreen: !!fs });
        }, 800);
      }
    })();
  }, []);

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
          const mm = String(next.getMinutes()).padStart(2, '0');
          (ToastAndroid as any)?.show?.(`🔔 Alarm set for ${h12}:${mm} ${ampm}${next.getDate() !== new Date().getDate() ? ' (tomorrow)' : ''}`, (ToastAndroid as any).LONG);
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
      Animated.sequence([Animated.timing(saveAnim, { toValue: 1, duration: 200, useNativeDriver: true }), Animated.delay(800), Animated.timing(saveAnim, { toValue: 0, duration: 300, useNativeDriver: true })]).start();
    } catch {} finally { setSaving(false); }
  };

  const persistExtraWakeAlarms = async (updated: ExtraWakeAlarm[]) => {
    setExtraWakeAlarms(updated);
    const s = await store.getJSON<AlarmSettings>(KEYS.alarmSettings) ?? DEFAULT_ALARM_SETTINGS;
    await store.setJSON(KEYS.alarmSettings, { ...s, extraWakeAlarms: updated });
  };
  const addExtraWakeAlarm = async () => {
    const id = Date.now().toString();
    const a: ExtraWakeAlarm = { id, enabled: true, hour: extraFormHour, minute: extraFormMinute, label: extraFormLabel.trim() || undefined };
    const updated = [...extraWakeAlarms, a];
    await persistExtraWakeAlarms(updated);
    await scheduleExtraWakeAlarm(a.id, a.hour, a.minute, a.label);
    setShowAddExtraWake(false);
    setExtraFormLabel('');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const h12 = a.hour === 0 ? 12 : a.hour > 12 ? a.hour - 12 : a.hour;
    const ampm = a.hour < 12 ? 'AM' : 'PM';
    const mm = String(a.minute).padStart(2, '0');
    (ToastAndroid as any)?.show?.(`🔔 Extra wake alarm set for ${h12}:${mm} ${ampm}`, (ToastAndroid as any).SHORT);
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
  const deleteWakeAlarm = () => {
    Alert.alert('Remove wake alarm?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        await cancelNativeAlarm();
        persistAndApply({ ...settings, wakeAlarm: { ...settings.wakeAlarm, enabled: false } });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }},
    ]);
  };

  const showWakeAlarmMenu = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Edit', 'Delete'], cancelButtonIndex: 0, destructiveButtonIndex: 2, title: 'Wake Alarm' },
        i => { if (i === 1) setShowWakeEdit(true); if (i === 2) deleteWakeAlarm(); }
      );
    } else {
      Alert.alert('Wake Alarm', '', [
        { text: 'Edit', onPress: () => setShowWakeEdit(true) },
        { text: 'Delete', style: 'destructive', onPress: deleteWakeAlarm },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const openEditExtraWake = (alarm: ExtraWakeAlarm) => {
    setEditingExtraWake(alarm);
    setExtraFormHour(alarm.hour);
    setExtraFormMinute(alarm.minute);
    setExtraFormLabel(alarm.label ?? '');
    setShowAddExtraWake(true);
  };

  const updateExtraWakeAlarm = async () => {
    if (!editingExtraWake) return;
    const updated = extraWakeAlarms.map(a =>
      a.id === editingExtraWake.id
        ? { ...a, hour: extraFormHour, minute: extraFormMinute, label: extraFormLabel.trim() || undefined }
        : a
    );
    await persistExtraWakeAlarms(updated);
    const changed = updated.find(a => a.id === editingExtraWake.id)!;
    if (changed.enabled) await scheduleExtraWakeAlarm(changed.id, changed.hour, changed.minute, changed.label);
    setShowAddExtraWake(false);
    setEditingExtraWake(null);
    setExtraFormLabel('');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const showExtraWakeMenu = (alarm: ExtraWakeAlarm) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const title = alarm.label || 'Extra Wake Alarm';
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Edit', 'Delete'], cancelButtonIndex: 0, destructiveButtonIndex: 2, title },
        i => { if (i === 1) openEditExtraWake(alarm); if (i === 2) deleteExtraWake(alarm.id); }
      );
    } else {
      Alert.alert(title, '', [
        { text: 'Edit', onPress: () => openEditExtraWake(alarm) },
        { text: 'Delete', style: 'destructive', onPress: () => deleteExtraWake(alarm.id) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const showAlarmMenu = (entry: AlarmEntry) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const title = entry.label || (entry.type === 'habit' ? 'Habit Alarm' : entry.type === 'soundbath' ? 'Sound Bath' : 'Quick Alarm');
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Edit', 'Delete'], cancelButtonIndex: 0, destructiveButtonIndex: 2, title },
        i => { if (i === 1) openEditEntry(entry); if (i === 2) deleteEntry(entry.id); }
      );
    } else {
      Alert.alert(title, '', [
        { text: 'Edit', onPress: () => openEditEntry(entry) },
        { text: 'Delete', style: 'destructive', onPress: () => deleteEntry(entry.id) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };
  const setWakeTime = (h: number, m: number) => persistAndApply({ ...settings, wakeAlarm: { enabled: true, hour: h, minute: m } });
  const applyPreset = (p: typeof PRESETS[0]) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); persistAndApply({ ...settings, wakeAlarm: { enabled: true, hour: p.hour, minute: p.minute } }); };
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
            'This mission uses the camera. Please enable Camera permission for SolRize in your device Settings.',
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
    updateMission({ selectedMission: missionId });
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
  };

  useEffect(() => {
    registerPreviewStopper(stopPreview);
    return () => { registerPreviewStopper(null); };
  }, []);

  const togglePreview = async (snd: typeof ALARM_SOUNDS[0]) => {
    if (previewingId === snd.id) { await stopPreview(); return; }
    await stopPreview();
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false, shouldDuckAndroid: true });
      const bundled = ALARM_BUNDLED[snd.id];
      const source = bundled ?? (snd.audioUrl ? { uri: snd.audioUrl } : null);
      if (!source) return;
      const { sound } = await Audio.Sound.createAsync(source, { shouldPlay: true, isLooping: false, volume: 0.9 });
      previewSoundRef.current = sound;
      setPreviewingId(snd.id);
      sound.setOnPlaybackStatusUpdate(status => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
          previewSoundRef.current = null;
          setPreviewingId(null);
        }
      });
    } catch { setPreviewingId(null); }
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
    updateMission({ wakeSound: id });
    // Bundled nature/sacred/stotra sounds need no download
    if (ALARM_BUNDLED[id] != null) { setDlStatus(s => ({ ...s, [id]: 'downloaded' })); return; }
    if (BUNDLED_MANTRAS.has(id)) { setDlStatus(s => ({ ...s, [id]: 'downloaded' })); return; }
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
            entry.habitKey ?? entry.id,
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
        await notifee.createChannel({ id: 'arise-habit-alarms', name: 'SolRize Habit Alarms', importance: AndroidImportance.HIGH, sound: 'mantra_alarm', vibration: true, bypassDnd: true, visibility: AndroidVisibility.PUBLIC } as any);
        await notifee.createTriggerNotification(
          { id: `habit-${entry.id}`, title, body: entry.type === 'habit' ? 'Time for your habit! Tap to confirm. 🙏' : entry.type === 'soundbath' ? 'Your Sound Bath is ready 🎵 Tap to listen.' : 'Your alarm is ringing! Tap to dismiss. ⏰', android: { channelId: 'arise-habit-alarms', importance: AndroidImportance.HIGH, category: AndroidCategory.ALARM, visibility: AndroidVisibility.PUBLIC, fullScreenAction: { id: 'default', launchActivity: 'default' }, pressAction: { id: 'default', launchActivity: 'default' }, asForegroundService: true, ongoing: true, autoCancel: false, loopSound: true, foregroundServiceTypes: [AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK] } as any, data: { type: entry.type === 'soundbath' ? 'soundbath-alarm' : 'habit-alarm', alarmId: entry.id, habitKey: entry.habitKey ?? entry.id, habitEmoji: entry.habitEmoji ?? (entry.type === 'quick' ? '⚡' : entry.type === 'soundbath' ? '🎵' : '🎯'), label: entry.label, alarmType: entry.type, soundId: entry.soundId ?? 'morning_birds' } },
          { type: TriggerType.TIMESTAMP, timestamp: next.getTime(), repeatFrequency: RepeatFrequency.DAILY, alarmManager: { type: AlarmType.SET_ALARM_CLOCK, allowWhileIdle: true } } as any,
        ); return;
      } catch (e) { console.warn('[HabitAlarm] notifee fallback also failed:', e); }
    }
    await Notifications.scheduleNotificationAsync({
      identifier: `alarm-${entry.id}`,
      content: { title, body: entry.type === 'habit' ? 'Time for your habit. 🙏' : entry.type === 'soundbath' ? 'Your Sound Bath is ready 🎵' : 'Your alarm is ringing!', sound: 'mantra_alarm.wav', data: { type: entry.type === 'soundbath' ? 'soundbath-alarm' : entry.type === 'habit' ? 'habit-alarm' : 'quick-alarm', alarmId: entry.id, habitKey: entry.habitKey ?? entry.id, habitEmoji: entry.habitEmoji ?? '', label: entry.label, soundId: entry.soundId ?? 'morning_birds' } },
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
    if (settings.wakeAlarm.enabled) alarms.push({ h: settings.wakeAlarm.hour, m: settings.wakeAlarm.minute, label: 'Wake Alarm', color: '#a78bfa' });
    extraWakeAlarms.filter(a => a.enabled).forEach(a => alarms.push({ h: a.hour, m: a.minute, label: a.label || 'Wake', color: '#c4b5fd' }));
    alarmEntries.filter(e => e.enabled).forEach(e => alarms.push({ h: e.hour, m: e.minute, label: e.label, color: e.type === 'habit' ? '#10b981' : e.type === 'soundbath' ? '#a78bfa' : '#f97316' }));
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
  const playingMantra = MANTRAS.find(m => m.id === selectedMantraId) ?? MANTRAS[0];
  const allPermsOk    = permStatus.notifications && permStatus.exactAlarm && permStatus.batteryOpt && permStatus.fullScreen;


  return (
    <ImageBackground source={bgUri ? { uri: bgUri } : undefined} style={S.screen} imageStyle={{ opacity: 1 }}>
      <SafeAreaView edges={['top']} />

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

      {/* ── Next Alarm Banner ── */}
      {nextAlarm && (
        <View style={{ marginHorizontal: 16, marginTop: 8, marginBottom: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 13, backgroundColor: 'rgba(0,0,0,0.52)', borderWidth: 1, borderColor: nextAlarm.color + '45' }}>
            <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: nextAlarm.color }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 8, fontWeight: '900', color: nextAlarm.color, letterSpacing: 1.4 }}>NEXT ALARM</Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff', letterSpacing: -0.3, marginTop: 1 }} numberOfLines={1}>{nextAlarm.label}  ·  {fmt12(nextAlarm.h, nextAlarm.m)}</Text>
            </View>
            <View style={{ backgroundColor: nextAlarm.color + '20', borderRadius: 13, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: nextAlarm.color + '50' }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: nextAlarm.color }}>{computeTimeUntil(nextAlarm.h, nextAlarm.m, liveClock)}</Text>
            </View>
          </View>
        </View>
      )}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120, paddingTop: 4 }} showsVerticalScrollIndicator={false}>
        {/* ── Alarm List (iOS-native slim rows) ── */}
        <View style={S.listContainer}>

          {/* Primary Wake Alarm Row */}
          <TouchableOpacity style={S.alarmRow} onPress={() => setShowWakeEdit(true)} activeOpacity={0.8}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                <Ionicons name="alarm" size={9} color="#a78bfa" />
                <Text style={[S.alarmRowBadge, { color: '#a78bfa' }]}>WAKE ALARM{missionSettings.lockInMode ? '  🔒' : ''}</Text>
                <Text style={{ fontSize: 8, color: '#FFFFFF55', fontWeight: '700', letterSpacing: 0.8 }}>· DAILY</Text>
              </View>
              <Text style={[S.alarmRowTime, !settings.wakeAlarm.enabled && S.alarmRowTimeOff]}>
                {pad(settings.wakeAlarm.hour)}:{pad(settings.wakeAlarm.minute)}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
                <Text style={[S.alarmRowSub, { color: '#a78bfaCC' }]} numberOfLines={1}>
                  {playingMantra.emoji} {playingMantra.label}
                </Text>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.58)', fontWeight: '700' }}>
                  · {settings.wakeAlarm.enabled ? computeTimeUntilShort(settings.wakeAlarm.hour, settings.wakeAlarm.minute, liveClock) : 'off'}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Toggle value={settings.wakeAlarm.enabled} onToggle={toggleWake} color='#a78bfa' />
              <TouchableOpacity onPress={showWakeAlarmMenu} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Feather name="more-vertical" size={18} color="rgba(255,255,255,0.28)" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>

          {/* Habit + Quick + SoundBath Rows */}
          {alarmEntries.map(entry => {
            const isHabit = entry.type === 'habit';
            const isBath  = entry.type === 'soundbath';
            const accent  = isHabit ? '#10b981' : isBath ? '#a78bfa' : '#f97316';
            const badgeLabel = isHabit ? 'HABIT ALARM' : isBath ? 'SOUND BATH' : 'QUICK ALARM';
            const subLine = isHabit
              ? `${entry.habitEmoji ?? '🎯'}  ${entry.label}`
              : isBath
              ? `🎵  ${entry.label || 'Ambient Sound'}`
              : `⚡  ${entry.label || 'Quick Alarm'}`;
            return (
              <React.Fragment key={entry.id}>
                <View style={S.rowDivider} />
                <TouchableOpacity style={S.alarmRow} onPress={() => openEditEntry(entry)} activeOpacity={0.8}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                      {isHabit
                        ? <Ionicons name="checkmark-done" size={9} color={accent} />
                        : isBath
                        ? <Ionicons name="musical-notes" size={9} color={accent} />
                        : <Feather name="zap" size={8} color={accent} />}
                      <Text style={[S.alarmRowBadge, { color: accent }]}>{badgeLabel}</Text>
                    </View>
                    <Text style={[S.alarmRowTime, !entry.enabled && S.alarmRowTimeOff]}>
                      {pad(entry.hour)}:{pad(entry.minute)}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
                      <Text style={[S.alarmRowSub, { color: accent + 'CC' }]} numberOfLines={1}>{subLine}</Text>
                      <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.58)', fontWeight: '700' }}>
                        · {entry.enabled ? computeTimeUntilShort(entry.hour, entry.minute, liveClock) : 'off'}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Toggle value={entry.enabled} onToggle={() => toggleEntry(entry.id)} color={accent} />
                    <TouchableOpacity onPress={() => showAlarmMenu(entry)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                      <Feather name="more-vertical" size={18} color="rgba(255,255,255,0.28)" />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              </React.Fragment>
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
      {fabOpen && <TouchableOpacity style={S.fabBackdrop} onPress={() => setFabOpen(false)} activeOpacity={1} />}
      {fabOpen && (
        <View style={S.fabMenu}>
          {([
            { label: '⏰  Wake Alarm',       color: ACCENT,    onPress: () => { setFabOpen(false); setShowWakeEdit(true); } },
            { label: '🎯  Habit Alarm',       color: '#10b981', onPress: () => { setFabOpen(false); openAddModal('habit'); } },
            { label: '⚡  Quick Alarm',        color: '#f97316', onPress: () => { setFabOpen(false); openAddModal('quick'); } },
            { label: '🎵  Sound Bath',         color: '#a78bfa', onPress: () => { setFabOpen(false); openAddModal('soundbath'); } },
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
      <Modal visible={showWakeEdit} animationType="slide" transparent onRequestClose={() => { stopPreview(); setShowWakeEdit(false); }}>
        <View style={S.sheetOverlay}>
          <View style={S.sheet}>
            <View style={S.sheetHandle} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={S.sheetTitle}>🌅  Morning Wake-Up Alarm</Text>
              <Text style={{ fontSize: 10, color: '#FFFFFF35', fontWeight: '700', letterSpacing: 1, marginBottom: 8 }}>DEFAULT: 4:00 AM  ·  BRAHMA MUHURTA</Text>
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
              {ALARM_SOUND_CATS.map(cat => {
                const sounds = ALARM_SOUNDS.filter(s => s.cat === cat);
                const catColors: Record<string,string> = { Nature: '#34d399', Sacred: '#a78bfa', Mantra: '#fbbf24', Stotra: '#c4b5fd' };
                const catEmoji: Record<string,string> = { Nature: '🌿', Sacred: '🕉️', Mantra: '📿', Stotra: '🌟' };
                return (
                  <View key={cat} style={{ marginBottom: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <Text style={{ fontSize: 11 }}>{catEmoji[cat]}</Text>
                      <Text style={{ fontSize: 8, fontWeight: '900', color: catColors[cat] + 'AA', letterSpacing: 1.6, fontFamily: 'Nunito_900Black' }}>{cat.toUpperCase()}</Text>
                      <View style={{ flex: 1, height: 1, backgroundColor: catColors[cat] + '25' }} />
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {sounds.map(snd => {
                        const active = selectedMantraId === snd.id;
                        const previewing = previewingId === snd.id;
                        const imgSrc = snd.id === 'lalitha' ? LALITHA_IMG : (SOUND_IMAGES[snd.id] ? { uri: SOUND_IMAGES[snd.id] } : undefined);
                        const cardW = (width - 40 - 24 - 8) / 2;
                        return (
                          <TouchableOpacity
                            key={snd.id}
                            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); handleMantraSelect(snd.id); }}
                            activeOpacity={0.82}
                            style={{ width: cardW, height: 96, borderRadius: 16, overflow: 'hidden', borderWidth: active ? 2 : 1, borderColor: active ? snd.color : '#FFFFFF14' }}
                          >
                            <ImageBackground source={imgSrc} style={{ flex: 1 }} imageStyle={{ borderRadius: 15 }}>
                              <LinearGradient colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.72)']} style={[StyleSheet.absoluteFillObject, { borderRadius: 15 }]} />
                              {active && <View style={[StyleSheet.absoluteFillObject, { borderRadius: 15, backgroundColor: snd.color + '18' }]} />}
                              <View style={{ flex: 1, padding: 8, justifyContent: 'space-between' }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                  <TouchableOpacity
                                    onPress={e => { e.stopPropagation?.(); togglePreview(snd); }}
                                    style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: previewing ? snd.color + '40' : 'rgba(0,0,0,0.45)', borderWidth: 1, borderColor: previewing ? snd.color + '80' : 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}
                                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                  >
                                    <Text style={{ fontSize: 9, color: previewing ? snd.color : '#FFFFFFCC' }}>{previewing ? '■' : '▶'}</Text>
                                  </TouchableOpacity>
                                  <Text style={{ fontSize: 16 }}>{snd.emoji}</Text>
                                </View>
                                <View>
                                  <Text style={{ fontSize: 10, fontWeight: '800', color: active ? snd.color : '#FFFFFFEE', lineHeight: 13 }} numberOfLines={2}>{snd.label}</Text>
                                  {active && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
                                      <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: snd.color }} />
                                      <Text style={{ fontSize: 7, color: snd.color, fontWeight: '900' }}>SELECTED</Text>
                                    </View>
                                  )}
                                </View>
                              </View>
                            </ImageBackground>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
              <Text style={S.sheetSection}>MORNING MISSION  (alarm won't stop until done)</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {MISSIONS.map(ms => { const active = missionSettings.selectedMission === ms.id; return (
                  <TouchableOpacity key={ms.id} onPress={() => handleSelectMission(ms.id)} style={[S.missionChip, { borderColor: active ? ms.color : '#FFFFFF12', backgroundColor: active ? ms.color + '15' : '#FFFFFF05' }]}>
                    <Text style={{ fontSize: 22 }}>{ms.icon}</Text>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: active ? ms.color : Colors.textMuted, textAlign: 'center' }}>{ms.name}</Text>
                    {active && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ms.color }} />}
                  </TouchableOpacity>
                ); })}
              </View>
              <Text style={S.sheetSection}>SYSTEM</Text>
              <View style={S.settingsCard}>
                {([
                  { emoji: '🔒', label: 'Lock In Mode',   sub: "Alarm won't stop until mission done",        val: missionSettings.lockInMode,        onToggle: () => updateMission({ lockInMode: !missionSettings.lockInMode }),                    color: '#ef4444' },
                  { emoji: '🤖', label: 'Morning Brief',  sub: 'AI speaks your personalized morning brief',  val: missionSettings.bodhiMorningBrief, onToggle: () => updateMission({ bodhiMorningBrief: !missionSettings.bodhiMorningBrief }),    color: '#60a5fa' },
                  { emoji: '⏰', label: 'Dawn Alert',      sub: '15 min reminder before your wake alarm',    val: settings.brahmaReminder,           onToggle: toggleBrahma,       color: '#60a5fa' },
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
              <TouchableOpacity onPress={() => { stopPreview(); setShowWakeEdit(false); }} style={S.sheetDoneBtn}>
                <Text style={S.sheetDoneTxt}>Done</Text>
              </TouchableOpacity>
              <View style={{ height: 48 }} />
            </ScrollView>
          </View>
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

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Selected sound hero card */}
              {(() => {
                const selSnd = ALARM_SOUNDS.find(s => s.id === formSoundId);
                const selColor = selSnd?.color ?? '#a78bfa';
                const selImgSrc = selSnd?.id === 'lalitha' ? LALITHA_IMG : (SOUND_IMAGES[formSoundId] ? { uri: SOUND_IMAGES[formSoundId] } : undefined);
                return (
                  <View style={{ marginHorizontal: 20, marginTop: 16, marginBottom: 4, height: 136, borderRadius: 22, overflow: 'hidden', borderWidth: 2, borderColor: selColor + '60' }}>
                    <ImageBackground source={selImgSrc} style={{ flex: 1 }} imageStyle={{ borderRadius: 20, opacity: 0.75 }}>
                      <LinearGradient colors={['rgba(0,0,0,0.10)', 'rgba(0,0,0,0.82)']} style={[StyleSheet.absoluteFillObject, { borderRadius: 20 }]} />
                      <View style={{ flex: 1, padding: 16, justifyContent: 'flex-end' }}>
                        <Text style={{ fontSize: 9, fontWeight: '900', color: selColor, letterSpacing: 1.6, marginBottom: 4 }}>SELECTED SOUND</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <Text style={{ fontSize: 30 }}>{selSnd?.emoji ?? '🎵'}</Text>
                          <Text style={{ fontSize: 20, fontWeight: '900', color: '#fff', letterSpacing: -0.3 }}>{selSnd?.label ?? 'Sound Bath'}</Text>
                        </View>
                        <Text style={{ fontSize: 10, color: '#FFFFFF45', marginTop: 3, fontWeight: '600' }}>No mission · No lock · Just sounds</Text>
                      </View>
                    </ImageBackground>
                  </View>
                );
              })()}

              {/* Time picker */}
              <View style={{ alignItems: 'center', paddingHorizontal: 20, paddingBottom: 4 }}>
                <TimeAdjuster hour={formHour} minute={formMinute} onChange={(h, m) => { setFormHour(h); setFormMinute(m); }} />
              </View>

              {/* Sound picker — categorized image grid */}
              {(['Nature', 'Sacred'] as const).map(cat => {
                const catSounds = ALARM_SOUNDS.filter(s => s.cat === cat);
                const catColors: Record<string, string> = { Nature: '#34d399', Sacred: '#a78bfa' };
                const catEmoji: Record<string, string> = { Nature: '🌿', Sacred: '🕉️' };
                const cardW = (width - 40 - 8) / 2;
                return (
                  <View key={cat} style={{ marginBottom: 14, paddingHorizontal: 20 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <Text style={{ fontSize: 11 }}>{catEmoji[cat]}</Text>
                      <Text style={{ fontSize: 8, fontWeight: '900', color: catColors[cat] + 'AA', letterSpacing: 1.6 }}>{cat.toUpperCase()}</Text>
                      <View style={{ flex: 1, height: 1, backgroundColor: catColors[cat] + '25' }} />
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {catSounds.map(snd => {
                        const active = formSoundId === snd.id;
                        const previewing = previewingId === snd.id;
                        const imgSrc = snd.id === 'lalitha' ? LALITHA_IMG : (SOUND_IMAGES[snd.id] ? { uri: SOUND_IMAGES[snd.id] } : undefined);
                        return (
                          <TouchableOpacity
                            key={snd.id}
                            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setFormSoundId(snd.id); }}
                            activeOpacity={0.82}
                            style={{ width: cardW, height: 96, borderRadius: 16, overflow: 'hidden', borderWidth: active ? 2 : 1, borderColor: active ? snd.color : '#FFFFFF14' }}
                          >
                            <ImageBackground source={imgSrc} style={{ flex: 1 }} imageStyle={{ borderRadius: 15 }}>
                              <LinearGradient colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.72)']} style={[StyleSheet.absoluteFillObject, { borderRadius: 15 }]} />
                              {active && <View style={[StyleSheet.absoluteFillObject, { borderRadius: 15, backgroundColor: snd.color + '18' }]} />}
                              <View style={{ flex: 1, padding: 8, justifyContent: 'space-between' }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                  <TouchableOpacity
                                    onPress={e => { e.stopPropagation?.(); togglePreview(snd); }}
                                    style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: previewing ? snd.color + '40' : 'rgba(0,0,0,0.45)', borderWidth: 1, borderColor: previewing ? snd.color + '80' : 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}
                                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                  >
                                    <Text style={{ fontSize: 9, color: previewing ? snd.color : '#FFFFFFCC' }}>{previewing ? '■' : '▶'}</Text>
                                  </TouchableOpacity>
                                  <Text style={{ fontSize: 16 }}>{snd.emoji}</Text>
                                </View>
                                <View>
                                  <Text style={{ fontSize: 10, fontWeight: '800', color: active ? snd.color : '#FFFFFFEE', lineHeight: 13 }} numberOfLines={2}>{snd.label}</Text>
                                  {active && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
                                      <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: snd.color }} />
                                      <Text style={{ fontSize: 7, color: snd.color, fontWeight: '900' }}>SELECTED</Text>
                                    </View>
                                  )}
                                </View>
                              </View>
                            </ImageBackground>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );
              })}

              {/* Optional label */}
              <View style={{ marginHorizontal: 20, marginTop: 6, marginBottom: 10 }}>
                <Text style={{ fontSize: 8, fontWeight: '900', color: '#FFFFFF22', letterSpacing: 2, marginBottom: 8 }}>LABEL (optional)</Text>
                <TextInput
                  style={{ backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, color: '#fff', fontSize: 14 }}
                  placeholder="e.g. Morning Meditation, Evening Rest..."
                  placeholderTextColor={Colors.textDim}
                  value={formLabel}
                  onChangeText={setFormLabel}
                />
              </View>

              {/* Save button */}
              <TouchableOpacity
                onPress={() => { stopPreview(); saveNewEntry(); }}
                style={{ marginHorizontal: 20, marginBottom: 10, backgroundColor: '#a78bfa', borderRadius: 20, paddingVertical: 19, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10, shadowColor: '#a78bfa', shadowOpacity: 0.5, shadowRadius: 18, elevation: 8 }}
                activeOpacity={0.85}
              >
                <Ionicons name="musical-notes" size={20} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 17, letterSpacing: 0.3 }}>
                  {editEntry ? `Update  ·  ${fmt12(formHour, formMinute)}` : `Set Sound Bath  ·  ${fmt12(formHour, formMinute)}`}
                </Text>
              </TouchableOpacity>
              <View style={{ height: 20 }} />
            </ScrollView>
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

          {/* ── Habit section (no vertical scroll — navigation is horizontal-only) ── */}
          <View style={{ flex: 1 }}>
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

          {/* ── Fixed Bottom: Time + Days + Save ── */}
          <View style={{ backgroundColor: '#0E0E20', borderTopWidth: 1, borderTopColor: '#FFFFFF10', paddingHorizontal: 16, paddingTop: 14, paddingBottom: insets.bottom + 16 }}>
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

    </ImageBackground>
  );
}

const S = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#060610', overflow: 'hidden' },
  headerGrad: { paddingBottom: 2 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 4, paddingBottom: 4 },
  appName: { fontSize: 15, fontWeight: '900', color: '#fff', letterSpacing: 0.5, fontFamily: 'Nunito_900Black' },
  headerCountdownRow: { paddingHorizontal: 16, paddingBottom: 2, gap: 4 },
  headerDateSmall: { fontSize: 11, color: '#FFFFFF35', fontWeight: '500', paddingHorizontal: 4 },
  countdownBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: ACCENT + '14', borderWidth: 1, borderColor: ACCENT + '35', borderRadius: 99, paddingHorizontal: 16, paddingVertical: 10, alignSelf: 'flex-start' },
  countdownBannerOff: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF08', borderWidth: 1, borderColor: '#FFFFFF12', borderRadius: 99, paddingHorizontal: 16, paddingVertical: 10, alignSelf: 'flex-start' },
  countdownDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: ACCENT },
  countdownTxt: { fontSize: 13, fontWeight: '700', color: '#fdba74', fontFamily: 'Nunito_700Bold' },
  countdownChevron: { fontSize: 18, color: ACCENT, fontWeight: '300', lineHeight: 20 },
  countdownOffTxt: { fontSize: 12, color: '#FFFFFF25', fontWeight: '500' },
  permsBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9731610', borderBottomWidth: 1, borderBottomColor: '#f9731625', paddingHorizontal: 16, paddingVertical: 10 },
  permsText: { flex: 1, color: '#f97316', fontSize: 11, fontWeight: '700' },
  permsChevron: { color: '#f97316', fontSize: 14, fontWeight: '900' },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 6, marginBottom: 0, gap: 10 },
  sectionHeaderTxt: { fontSize: 9, fontWeight: '900', color: '#74B87480', letterSpacing: 2.0, fontFamily: 'Nunito_900Black' },
  sectionHeaderLine: { flex: 1, height: 1, backgroundColor: '#74B87430' },
  alarmCard: { marginHorizontal: 16, marginTop: 10, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(14, 14, 32, 0.92)', overflow: 'hidden', elevation: 10, shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 22, shadowOffset: { width: 0, height: 6 } },
  alarmCardActive: { borderColor: 'rgba(255,255,255,0.60)', backgroundColor: 'rgba(255,255,255,0.09)', shadowColor: '#000', shadowOpacity: 0.38, shadowRadius: 22, elevation: 14 },
  alarmCardHabit: { borderColor: 'rgba(255,255,255,0.60)', backgroundColor: 'rgba(255,255,255,0.08)', shadowColor: '#000', shadowOpacity: 0.38, shadowRadius: 22, elevation: 14 },
  alarmCardQuick: { borderColor: 'rgba(255,255,255,0.60)', backgroundColor: 'rgba(255,255,255,0.08)', shadowColor: '#000', shadowOpacity: 0.38, shadowRadius: 22, elevation: 14 },
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
  fab: { position: 'absolute', bottom: 90, left: (width / 2) - 30, width: 60, height: 60, borderRadius: 30, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center', elevation: 10, shadowColor: ACCENT, shadowOpacity: 0.6, shadowRadius: 16 },
  fabOpen: { backgroundColor: '#c05e00' },
  fabTxt: { fontSize: 30, color: '#fff', fontWeight: '200', lineHeight: 36, marginTop: 2 },
  fabBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9 },
  fabMenu: { position: 'absolute', bottom: 162, left: 0, right: 0, gap: 8, alignItems: 'center', zIndex: 10 },
  fabMenuItem: { backgroundColor: '#0D0D20', borderWidth: 1, borderRadius: 16, paddingHorizontal: 20, paddingVertical: 13, elevation: 6 },
  fabMenuItemTxt: { fontSize: 14, fontWeight: '800', fontFamily: 'Nunito_800ExtraBold' },
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
  settingsCard: { backgroundColor: '#FFFFFF04', borderWidth: 1, borderColor: '#FFFFFF0A', borderRadius: 18, marginBottom: 10, overflow: 'hidden' },
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
  cardMenu: { marginHorizontal: 16, marginBottom: 14, backgroundColor: 'rgba(8,8,24,0.92)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)', overflow: 'hidden' },
  cardMenuItem: { paddingHorizontal: 20, paddingVertical: 16 },
  cardMenuTxt: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', fontFamily: 'Nunito_700Bold' },
  alarmBigTime: { fontSize: 38, fontWeight: '200', color: '#FFFFFF', letterSpacing: -2, lineHeight: 46 },
  alarmCountdownSub: { fontSize: 11, color: '#a78bfaBB', fontWeight: '800', fontFamily: 'Nunito_800ExtraBold' },
  listContainer: { marginHorizontal: 16, marginTop: 6, borderRadius: 22, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.22)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  alarmRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14 },
  alarmRowBadge: { fontSize: 9, fontWeight: '900', letterSpacing: 1.3, textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  alarmRowTime: { fontSize: 46, fontWeight: '300', color: '#FFFFFF', letterSpacing: -2.5, lineHeight: 52, textShadowColor: 'rgba(0,0,0,0.92)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 14 },
  alarmRowTimeOff: { color: 'rgba(255,255,255,0.32)', textShadowColor: 'rgba(0,0,0,0.7)' },
  alarmRowSub: { fontSize: 13, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.88)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 7 },
  rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.18)', marginHorizontal: 18 },
});
