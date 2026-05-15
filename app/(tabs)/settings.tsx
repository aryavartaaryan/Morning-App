import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch,
  Alert, Modal, NativeModules, Platform, Linking, ImageBackground, Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { store, KEYS } from '@/lib/storage';
import { AlarmSettings, DEFAULT_ALARM_SETTINGS } from '@/lib/notifications';
import { DEFAULT_MISSION_SETTINGS, MissionSettings, MISSIONS } from '@/lib/missionAlarm';
import { checkAlarmPermission, setNativeAlarmSound, requestAllAlarmPermissions } from '@/lib/nativeAlarm';
import { registerPreviewStopper } from '@/lib/alarmAudio';
import { Colors, Font } from '@/constants/theme';
import { getSolarTimes, type SolarTimes } from '@/lib/solar';
import { getBgSource } from '@/lib/bgImages';
import { useBgContext } from '@/lib/bgContext';
import { SOUND_IMAGES } from '@/lib/sleepSoundsData';

const PURPLE = '#a78bfa';
const ACCENT  = '#F5820A';
const { width } = Dimensions.get('window');

const ALARM_SOUNDS = [
  { id: 'forest_birds',         label: 'Forest Birds',        emoji: '🐦', cat: 'Nature',  color: '#34d399', audioUrl: null as string | null },
  { id: 'sea_waves',            label: 'Sea Waves',           emoji: '🌊', cat: 'Nature',  color: '#38bdf8', audioUrl: null as string | null },
  { id: 'light_rain',           label: 'Light Rain',          emoji: '🌦️', cat: 'Nature',  color: '#60a5fa', audioUrl: null as string | null },
  { id: 'breeze_trees',         label: 'Forest Breeze',       emoji: '🌿', cat: 'Nature',  color: '#4ade80', audioUrl: null as string | null },
  { id: 'river_flow',           label: 'Flowing Water',       emoji: '🏞️', cat: 'Nature',  color: '#38bdf8', audioUrl: null as string | null },
  { id: 'morning_birds',        label: 'Morning Birds',       emoji: '🌅', cat: 'Nature',  color: '#fbbf24', audioUrl: null as string | null },
  { id: 'spring_birds',         label: 'Spring Birds',        emoji: '🌸', cat: 'Nature',  color: '#f472b6', audioUrl: null as string | null },
  { id: 'forest_birds_spring',  label: 'Forest Birds',        emoji: '🌲', cat: 'Nature',  color: '#4ade80', audioUrl: null as string | null },
  { id: 'forest_campfire',      label: 'Forest Campfire',     emoji: '🔥', cat: 'Nature',  color: '#f97316', audioUrl: null as string | null },
  { id: 'wanderlust_breeze',    label: 'Wanderlust Breeze',   emoji: '�️', cat: 'Nature',  color: '#67e8f9', audioUrl: null as string | null },
  { id: 'singing_bowl_deep',    label: 'Deep Singing Bowl',   emoji: '🔮', cat: 'Sacred',  color: '#a78bfa', audioUrl: null as string | null },
  { id: 'tibetan_bowl',         label: 'Tibetan Bowl',        emoji: '🕌', cat: 'Sacred',  color: '#c4b5fd', audioUrl: null as string | null },
  { id: 'morning_flute',        label: 'Light Meditation Tone', emoji: '🎶', cat: 'Sacred',  color: '#6ee7b7', audioUrl: null as string | null },
  { id: 'sitar_morning',        label: 'Calm Raga',           emoji: '🎵', cat: 'Sacred',  color: '#f59e0b', audioUrl: null as string | null },
  { id: 'healing_bells_432',    label: '432 Hz Bells',        emoji: '🔔', cat: 'Sacred',  color: '#fde68a', audioUrl: null as string | null },
  { id: 'indian_beats',         label: 'Indian Beats',        emoji: '🥁', cat: 'Sacred',  color: '#fb923c', audioUrl: null as string | null },
  { id: 'gayatri',              label: 'Gayatri Mantra',      emoji: '🌞', cat: 'Mantra',  color: '#fbbf24', audioUrl: 'https://ik.imagekit.io/rcsesr4xf/gayatri-mantra-ghanpaath.mp3' as string | null },
  { id: 'lalitha',              label: 'Lalitha Sahasranama', emoji: '🌺', cat: 'Mantra',  color: '#f472b6', audioUrl: 'https://ik.imagekit.io/rcsesr4xf/Lalitha-Sahasranamam.mp3' as string | null },
  { id: 'shivtandav',           label: 'Shiv Tandav',         emoji: '🔱', cat: 'Mantra',  color: '#60a5fa', audioUrl: 'https://ik.imagekit.io/rcsesr4xf/Shiva-Tandav.mp3' as string | null },
  { id: 'bhagya_suktam',        label: 'Bhagya Suktam',       emoji: '🌟', cat: 'Stotra',  color: '#fbbf24', audioUrl: null as string | null },
  { id: 'shiv_sankalpa_suktam', label: 'Shiv Sankalpa Suktam',emoji: '🕉️', cat: 'Stotra',  color: '#c4b5fd', audioUrl: null as string | null },
];


const LALITHA_IMG = require('../../assets/images/mata-lalitha.jpg');

const ALARM_BUNDLED: Record<string, any> = {
  forest_birds:         require('../../assets/sounds/mixkit-jungle-rain-and-birds-2392.m4a'),
  sea_waves:            require('../../assets/sounds/mixkit-sea-waves-on-a-rocky-shore-1190.m4a'),
  light_rain:           require('../../assets/sounds/mixkit-light-rain-loop-2393.m4a'),
  breeze_trees:         require('../../assets/sounds/mixkit-breeze-through-the-trees-2427.m4a'),
  river_flow:           require('../../assets/sounds/mixkit-water-flowing-ambience-loop-3126.m4a'),
  singing_bowl_deep:    require('../../assets/sounds/singing-bowl-deep.m4a'),
  tibetan_bowl:         require('../../assets/sounds/tibetan-bowl.m4a'),
  morning_birds:        require('../../assets/sounds/morning-birds-loop.m4a'),
  spring_birds:         require('../../assets/sounds/spring-birds-morning.m4a'),
  forest_birds_spring:  require('../../assets/sounds/forest-birds-spring.m4a'),
  morning_flute:        require('../../assets/sounds/morning-flute.m4a'),
  sitar_morning:        require('../../assets/sounds/sitar-morning.m4a'),
  healing_bells_432:    require('../../assets/sounds/432hz-healing-bells.m4a'),
  wanderlust_breeze:    require('../../assets/sounds/wanderlust-breeze.m4a'),
  forest_campfire:      require('../../assets/sounds/forest-campfire.m4a'),
  indian_beats:         require('../../assets/sounds/indian-beats.m4a'),
  bhagya_suktam:        require('../../assets/sounds/bhagya-suktam.mp3'),
  shiv_sankalpa_suktam: require('../../assets/sounds/shiv-sankalpa-suktam.mp3'),
};

const ALARM_SOUND_CATS = ['Nature', 'Sacred', 'Mantra', 'Stotra'] as const;
const catColors: Record<string, string> = { Nature: '#34d399', Sacred: '#a78bfa', Mantra: '#fbbf24', Stotra: '#c4b5fd' };
const catEmoji:  Record<string, string> = { Nature: '🌿',     Sacred: '🕉️',      Mantra: '📿',     Stotra: '🌟'    };

interface PermState { notifications: boolean; exactAlarm: boolean; batteryOpt: boolean; fullScreen: boolean; }

export default function SettingsTab() {
  const [settings, setSettings]         = useState<AlarmSettings>(DEFAULT_ALARM_SETTINGS);
  const [mission, setMission]           = useState<MissionSettings>(DEFAULT_MISSION_SETTINGS);
  const [permStatus, setPermStatus]     = useState<PermState>({ notifications: true, exactAlarm: true, batteryOpt: true, fullScreen: true });
  const [checkingPerms, setCheckingPerms] = useState(false);
  const [bgUri, setBgUri]               = useState<string | null>(null);
  const { accentColor }  = useBgContext();
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [solarTimes, setSolarTimes]     = useState<SolarTimes | null>(null);
  const previewSoundRef                 = useRef<Audio.Sound | null>(null);
  const [showSoundSheet, setShowSoundSheet] = useState(false);

  useEffect(() => {
    (async () => {
      const s  = await store.getJSON<AlarmSettings>(KEYS.alarmSettings);
      const ms = await store.getJSON<MissionSettings>(KEYS.missionSettings);
      if (s)  setSettings(s);
      if (ms) setMission({ ...DEFAULT_MISSION_SETTINGS, ...ms });
      if (Platform.OS === 'android') checkPerms();
      const loc = await store.getJSON<{ lat: number; lon: number }>(KEYS.location).catch(() => null);
      if (loc?.lat && loc?.lon) setSolarTimes(getSolarTimes(loc.lat, loc.lon));
    })();
  }, []);

  useEffect(() => {
    const now = new Date();
    const h   = now.getHours() + now.getMinutes() / 60;
    let key   = 'night';
    if (solarTimes) {
      const { sunrise, solarNoon, sunset } = solarTimes;
      if      (h < sunrise - 1.5)  key = 'night';
      else if (h < sunrise - 0.3)  key = 'brahma';
      else if (h < sunrise + 0.5)  key = 'predawn';
      else if (h < sunrise + 2)    key = 'sunrise';
      else if (h < solarNoon - 1)  key = 'morning';
      else if (h < solarNoon + 2)  key = 'midday';
      else if (h < sunset - 1.5)   key = 'afternoon';
      else if (h < sunset)         key = 'sandhya';
      else if (h < sunset + 0.5)   key = 'twilight';
      else if (h < sunset + 2)     key = 'evening';
    } else {
      if      (h >= 5   && h < 8)  key = 'sunrise';
      else if (h >= 8   && h < 10) key = 'morning';
      else if (h >= 10  && h < 14) key = 'midday';
      else if (h >= 14  && h < 17) key = 'afternoon';
      else if (h >= 17  && h < 19) key = 'sandhya';
    }
    getBgSource(key).then(uri => setBgUri(uri)).catch(() => {});
  }, [solarTimes]);

  const checkPerms = async () => {
    try {
      const [ea, bo, fs] = await Promise.all([
        checkAlarmPermission(),
        NativeModules.AlarmModule?.isBatteryOptimizationIgnored?.().catch(() => true) ?? Promise.resolve(true),
        NativeModules.AlarmModule?.checkFullScreenIntentPermission?.().catch(() => true) ?? Promise.resolve(true),
      ]);
      const { status } = await (require('expo-notifications') as typeof import('expo-notifications')).getPermissionsAsync();
      setPermStatus({ notifications: status === 'granted', exactAlarm: !!ea, batteryOpt: !!bo, fullScreen: !!fs });
    } catch {}
  };

  const saveSettings = async (updated: AlarmSettings) => {
    setSettings(updated); await store.setJSON(KEYS.alarmSettings, updated);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  const saveMission = async (updated: MissionSettings) => {
    setMission(updated); await store.setJSON(KEYS.missionSettings, updated);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const stopPreview = async () => {
    if (previewSoundRef.current) {
      try { await previewSoundRef.current.stopAsync(); await previewSoundRef.current.unloadAsync(); } catch {}
      previewSoundRef.current = null;
    }
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
      const source  = bundled ?? (snd.audioUrl ? { uri: snd.audioUrl } : null);
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

  const handleMantraSelect = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    saveSettings({ ...settings, selectedMantraId: id });
    setNativeAlarmSound(id).catch(() => {});
  };

  const handleFixPerms = async () => {
    setCheckingPerms(true);
    await requestAllAlarmPermissions();
    await checkPerms();
    setCheckingPerms(false);
  };

  const CAMERA_MISSIONS = new Set(['sky_check', 'make_bed', 'hydrate']);
  const handleSelectMission = async (ms: typeof MISSIONS[0]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (CAMERA_MISSIONS.has(ms.id)) {
      const { status, canAskAgain } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        if (!canAskAgain) {
          Alert.alert('Camera Permission Required', 'Please enable Camera permission in Settings.',
            [{ text: 'Cancel', style: 'cancel' }, { text: 'Open Settings', onPress: () => Linking.openSettings() }]);
        } else {
          Alert.alert('Camera Permission Required', 'This mission requires camera access.');
        }
        return;
      }
    }
    saveMission({ ...mission, selectedMission: ms.id });
  };

  const handleResetStreak = () => {
    Alert.alert('Reset Streak?', 'This will reset your streak counter to 0. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: async () => { await saveMission({ ...mission, streak: 0, missionsCompleted: 0 }); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } },
    ]);
  };

  const handleResetAll = () => {
    Alert.alert('Reset All Data?', 'This will clear all alarms, settings, and streak data. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset Everything', style: 'destructive', onPress: async () => {
        await store.setJSON(KEYS.alarmSettings, DEFAULT_ALARM_SETTINGS);
        await store.setJSON(KEYS.missionSettings, DEFAULT_MISSION_SETTINGS);
        await store.setJSON(KEYS.multiAlarms, []);
        setSettings(DEFAULT_ALARM_SETTINGS); setMission(DEFAULT_MISSION_SETTINGS);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert('Done', 'All data has been reset.');
      }},
    ]);
  };

  const allPermsOk = permStatus.notifications && permStatus.exactAlarm && permStatus.batteryOpt && permStatus.fullScreen;
  const selectedMn  = settings.selectedMantraId ?? 'gayatri';
  const selectedSnd = ALARM_SOUNDS.find(s => s.id === selectedMn);

  const TOGGLES = [
    { emoji: '🔒', label: 'Lock In Mode',   sub: "Alarm won't stop until mission is completed", val: mission.lockInMode,            onToggle: () => saveMission({ ...mission, lockInMode: !mission.lockInMode }),                       color: '#ef4444' },
    { emoji: '🤖', label: 'Morning Brief',  sub: 'AI speaks your personalized morning brief',   val: mission.bodhiMorningBrief,    onToggle: () => saveMission({ ...mission, bodhiMorningBrief: !mission.bodhiMorningBrief }),          color: PURPLE },
    { emoji: '⏰', label: 'Dawn Alert',      sub: '15-min reminder before your wake alarm',      val: settings.brahmaReminder,      onToggle: () => saveSettings({ ...settings, brahmaReminder: !settings.brahmaReminder }),             color: '#c084fc' },
    { emoji: '📅', label: 'Daily Check-in', sub: 'Evening prompt to log your day',               val: settings.checkinReminder,     onToggle: () => saveSettings({ ...settings, checkinReminder: !settings.checkinReminder }),          color: '#34d399' },
    { emoji: '📈', label: 'Gradual Volume', sub: 'Alarm fades in over 60 seconds (Android)',     val: mission.gradualVolume ?? false, onToggle: () => saveMission({ ...mission, gradualVolume: !(mission.gradualVolume ?? false) }),    color: '#60a5fa' },
  ] as const;

  return (
    <View style={[S.screen, { backgroundColor: accentColor }]}>
      {/* ── Hero image zone ── */}
      <ImageBackground source={bgUri ? { uri: bgUri } : undefined} style={S.heroZone} imageStyle={{ opacity: 1 }}>
        <LinearGradient colors={['rgba(0,0,0,0.42)', 'rgba(0,0,0,0.14)', 'transparent']} style={StyleSheet.absoluteFillObject} />
        <LinearGradient colors={['transparent', 'transparent', accentColor]} locations={[0, 0.44, 1]} style={StyleSheet.absoluteFillObject} />
        <SafeAreaView edges={['top']} style={{ flex: 1, justifyContent: 'space-between' }}>
          {/* ── Nav bar zone ── */}
          <View style={S.headerTop}>
            <Text style={S.appName}>⚙️  Settings</Text>
            <Text style={{ fontSize: 11, color: PURPLE + 'CC', fontWeight: '700', letterSpacing: 0.3 }}>Morning App</Text>
          </View>
          {/* ── Title zone ── */}
          <View style={{ paddingHorizontal: 22, paddingBottom: 54 }}>
            <Text style={S.headline}>Preferences</Text>
            <Text style={S.subline}>Customise your morning ritual</Text>
          </View>
        </SafeAreaView>
      </ImageBackground>

      <ScrollView style={S.sheet} contentContainerStyle={{ paddingBottom: 110, paddingTop: 8 }} showsVerticalScrollIndicator={false}>

        {/* ── Permissions ── */}
        {Platform.OS === 'android' && (
          <>
            <View style={S.secRow}>
              <Text style={{ fontSize: 10 }}>🔐</Text>
              <Text style={[S.secLabel, { color: allPermsOk ? '#10b98175' : '#ef444490' }]}>ALARM PERMISSIONS</Text>
              <View style={[S.secLine, { backgroundColor: allPermsOk ? '#10b98120' : '#ef444420' }]} />
            </View>
            <View style={S.glassCard}>
              {[
                { label: 'Notifications',         ok: permStatus.notifications },
                { label: 'Schedule Exact Alarms', ok: permStatus.exactAlarm },
                { label: 'Battery Optimization',  ok: permStatus.batteryOpt },
                { label: 'Full-Screen Intent',    ok: permStatus.fullScreen },
              ].map((p, i) => (
                <View key={p.label} style={[S.permRow, i > 0 && { borderTopWidth: 1, borderTopColor: '#FFFFFF08' }]}>
                  <View style={[S.permDot, { backgroundColor: p.ok ? '#10b981' : '#ef4444' }]} />
                  <Text style={{ flex: 1, fontSize: 13, color: p.ok ? '#FFFFFF70' : '#fff', fontWeight: p.ok ? '500' : '700' }}>{p.label}</Text>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: p.ok ? '#10b981' : '#ef4444' }}>{p.ok ? 'OK' : 'MISSING'}</Text>
                </View>
              ))}
              {!allPermsOk && (
                <TouchableOpacity onPress={handleFixPerms} disabled={checkingPerms} style={S.fixBtn} activeOpacity={0.8}>
                  <Text style={{ color: '#ef4444', fontWeight: '900', fontSize: 13 }}>{checkingPerms ? 'Checking...' : '⚡ Fix Permissions'}</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}

        {/* ── Alarm Sound ── */}
        <View style={S.secRow}>
          <Text style={{ fontSize: 10 }}>🔔</Text>
          <Text style={[S.secLabel, { color: '#fbbf2480' }]}>ALARM SOUND</Text>
          <View style={[S.secLine, { backgroundColor: '#fbbf2425' }]} />
        </View>
        <TouchableOpacity onPress={() => setShowSoundSheet(true)} style={S.glassCard} activeOpacity={0.82}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
            <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: (selectedSnd?.color ?? '#fbbf24') + '20', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: (selectedSnd?.color ?? '#fbbf24') + '30' }}>
              <Text style={{ fontSize: 22 }}>{selectedSnd?.emoji ?? '🔔'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#fff', fontFamily: 'Nunito_800ExtraBold' }}>{selectedSnd?.label ?? 'Forest Birds'}</Text>
              <Text style={{ fontSize: 10, color: '#FFFFFF45', marginTop: 2 }}>{selectedSnd?.cat ?? 'Nature'}  ·  Tap to change</Text>
            </View>
            <Text style={{ fontSize: 22, color: '#FFFFFF30', marginRight: 2 }}>›</Text>
          </View>
        </TouchableOpacity>

        {/* ── Mission selection ── */}
        <View style={S.secRow}>
          <Text style={{ fontSize: 10 }}>🎯</Text>
          <Text style={[S.secLabel, { color: '#60a5fa80' }]}>DEFAULT MISSION</Text>
          <View style={[S.secLine, { backgroundColor: '#60a5fa25' }]} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, marginBottom: 4 }}>
          {MISSIONS.map(ms => {
            const active = mission.selectedMission === ms.id;
            return (
              <TouchableOpacity
                key={ms.id} onPress={() => handleSelectMission(ms)}
                style={[S.missionChip, { borderColor: active ? ms.color : '#FFFFFF14', backgroundColor: active ? ms.color + '18' : 'rgba(255,255,255,0.06)' }]}
                activeOpacity={0.78}
              >
                <Text style={{ fontSize: 24 }}>{ms.icon}</Text>
                <Text style={{ fontSize: 11, fontWeight: '800', color: active ? ms.color : '#FFFFFF80', textAlign: 'center' }}>{ms.name}</Text>
                {active && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ms.color }} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Behaviour Toggles ── */}
        <View style={S.secRow}>
          <Text style={{ fontSize: 10 }}>⚡</Text>
          <Text style={[S.secLabel, { color: '#FFFFFF38' }]}>BEHAVIOUR</Text>
          <View style={[S.secLine, { backgroundColor: '#FFFFFF12' }]} />
        </View>
        <View style={S.glassCard}>
          {TOGGLES.map((row, i) => (
            <View key={row.label} style={[S.toggleRow, i > 0 && { borderTopWidth: 1, borderTopColor: '#FFFFFF08' }]}>
              <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: row.color + '18', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 18 }}>{row.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={S.toggleTitle}>{row.label}</Text>
                <Text style={S.toggleSub}>{row.sub}</Text>
              </View>
              <Switch value={row.val} onValueChange={row.onToggle} trackColor={{ false: '#222', true: row.color + '80' }} thumbColor={row.val ? row.color : '#666'} />
            </View>
          ))}
        </View>

        {/* ── About ── */}
        <View style={S.secRow}>
          <Text style={{ fontSize: 10 }}>ℹ️</Text>
          <Text style={[S.secLabel, { color: '#FFFFFF28' }]}>ABOUT</Text>
          <View style={[S.secLine, { backgroundColor: '#FFFFFF10' }]} />
        </View>
        <View style={[S.glassCard, { marginBottom: 4 }]}>
          <View style={{ padding: 16 }}>
            <Text style={{ fontSize: 11, color: '#FFFFFF50', lineHeight: 18 }}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>Morning App</Text>{'  ·  '}Version 1.0{'\n'}
              Smart alarm system with morning missions, habit alarms, weather, and sleep cycle guidance.{'\n\n'}
              Built on Android AlarmManager, Notifee, and Open-Meteo weather API.
            </Text>
          </View>
        </View>

        {/* ── Danger Zone ── */}
        <View style={S.secRow}>
          <Text style={{ fontSize: 10 }}>⚠️</Text>
          <Text style={[S.secLabel, { color: '#ef444440' }]}>DANGER ZONE</Text>
          <View style={[S.secLine, { backgroundColor: '#ef444415' }]} />
        </View>
        <View style={[S.glassCard, { borderColor: '#ef444425', marginBottom: 4 }]}>
          <TouchableOpacity onPress={handleResetStreak} style={S.dangerBtn} activeOpacity={0.8}>
            <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: '#f9731618', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 18 }}>🔄</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#f97316' }}>Reset Streak</Text>
              <Text style={{ fontSize: 10, color: '#FFFFFF35', marginTop: 1 }}>Clear streak counter only</Text>
            </View>
          </TouchableOpacity>
          <View style={{ height: 1, backgroundColor: '#FFFFFF08' }} />
          <TouchableOpacity onPress={handleResetAll} style={S.dangerBtn} activeOpacity={0.8}>
            <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: '#ef444418', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 18 }}>🗑️</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#ef4444' }}>Reset All Data</Text>
              <Text style={{ fontSize: 10, color: '#FFFFFF35', marginTop: 1 }}>Clear all alarms, settings, and streak</Text>
            </View>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* ── Sound Picker Sheet ── */}
      <Modal
        visible={showSoundSheet}
        transparent
        animationType="slide"
        onRequestClose={() => { stopPreview(); setShowSoundSheet(false); }}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.62)' }}>
          <View style={{ backgroundColor: '#0A0D10', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '88%', borderWidth: 1, borderBottomWidth: 0, borderColor: 'rgba(255,255,255,0.12)' }}>
            <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)' }} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 }}>
              <View>
                <Text style={{ fontSize: 18, fontWeight: '900', color: '#fff', fontFamily: 'Nunito_900Black' }}>Alarm Sound</Text>
                <Text style={{ fontSize: 11, color: '#FFFFFF40', marginTop: 2 }}>Choose your wake-up sound</Text>
              </View>
              <TouchableOpacity onPress={() => { stopPreview(); setShowSoundSheet(false); }} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#FFFFFF70', fontSize: 15 }}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 44 }}>
              {ALARM_SOUND_CATS.map(cat => {
                const sounds = ALARM_SOUNDS.filter(s => s.cat === cat);
                const cW = (width - 32 - 8) / 2;
                return (
                  <View key={cat} style={{ marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <Text style={{ fontSize: 11 }}>{catEmoji[cat]}</Text>
                      <Text style={{ fontSize: 8, fontWeight: '900', color: catColors[cat] + 'AA', letterSpacing: 1.6 }}>{cat.toUpperCase()}</Text>
                      <View style={{ flex: 1, height: 1, backgroundColor: catColors[cat] + '28' }} />
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {sounds.map(snd => {
                        const active     = selectedMn === snd.id;
                        const previewing = previewingId === snd.id;
                        const imgSrc     = snd.id === 'lalitha' ? LALITHA_IMG : (SOUND_IMAGES[snd.id] ? { uri: SOUND_IMAGES[snd.id] } : undefined);
                        return (
                          <TouchableOpacity
                            key={snd.id}
                            onPress={() => handleMantraSelect(snd.id)}
                            activeOpacity={0.82}
                            style={{ width: cW, height: 96, borderRadius: 16, overflow: 'hidden', borderWidth: active ? 2 : 1, borderColor: active ? snd.color : '#FFFFFF14' }}
                          >
                            <ImageBackground source={imgSrc} style={{ flex: 1 }} imageStyle={{ borderRadius: 15 }}>
                              <LinearGradient colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.72)']} style={[StyleSheet.absoluteFillObject, { borderRadius: 15 }]} />
                              {active && <View style={[StyleSheet.absoluteFillObject, { borderRadius: 15, backgroundColor: snd.color + '18' }]} />}
                              <View style={{ flex: 1, padding: 8, justifyContent: 'space-between' }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                  <TouchableOpacity
                                    onPress={e => { (e as any).stopPropagation?.(); togglePreview(snd); }}
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
            </ScrollView>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const S = StyleSheet.create({
  screen:      { flex: 1 },
  heroZone:    { height: 280 },
  sheet:       { flex: 1, backgroundColor: 'transparent', marginTop: -26 },
  headerTop:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingTop: 10, paddingBottom: 6 },
  appName:     { fontSize: 15, fontWeight: '900', color: '#fff', letterSpacing: 0.5, fontFamily: 'Nunito_900Black' },
  headline:    { fontSize: 30, fontWeight: '100', color: '#fff', letterSpacing: -0.8 },
  subline:     { fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 5 },
  secRow:      { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 20, marginBottom: 10, gap: 6 },
  secLabel:    { fontSize: 8, fontWeight: '900', letterSpacing: 1.8, fontFamily: 'Nunito_900Black' },
  secLine:     { flex: 1, height: 1 },
  glassCard:   { marginHorizontal: 16, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' },
  permRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  permDot:     { width: 8, height: 8, borderRadius: 4 },
  fixBtn:      { margin: 12, backgroundColor: '#ef444410', borderWidth: 1, borderColor: '#ef444430', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  missionChip: { borderRadius: 14, borderWidth: 1, padding: 12, alignItems: 'center', gap: 4, width: (width - 32 - 8) / 2 },
  toggleRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  toggleTitle: { fontSize: 13, fontWeight: '800', color: '#fff', fontFamily: 'Nunito_800ExtraBold' },
  toggleSub:   { fontSize: 10, color: '#FFFFFF40', marginTop: 2 },
  dangerBtn:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
});
