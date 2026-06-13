/**
 * wake-alarm-ringing.tsx
 *
 * Wake-up alarm screen powered 100% by the Sound Bath audio engine
 * (expo-av / JS only — no native AlarmSoundService audio).
 *
 * UI: identical to soundbath-ringing.tsx (ImageBackground, pulsing orb,
 *     clock, accent chip) with one extra layer — the Mission pill and
 *     "Begin Your Day" CTA that routes to mission.tsx.
 *
 * Screen-pinning: same stopNativeLockTask() call as Sound Bath.
 * No vibration added (user's explicit request).
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, BackHandler,
  StatusBar, AppState, Platform, NativeModules, ImageBackground,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, Easing,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import notifee, { AndroidImportance, AndroidCategory, AndroidVisibility } from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSoundPlayer } from '@/lib/soundPlayerContext';
import {
  WAKE_SOUNDS, MISSIONS, DEFAULT_MISSION_SETTINGS, MissionSettings,
  getKalaMessage,
} from '@/lib/missionAlarm';
import { stopAlarmVibration, stopNativeLockTask, stopNativeAlarmSound } from '@/lib/nativeAlarm';
import { SOUND_IMAGES } from '@/lib/sleepSoundsData';
import { getLocalSoundImageUri } from '@/lib/soundImagePreload';
import { store, KEYS } from '@/lib/storage';

const WAKE_FS_ID = 'wake-alarm-soundbath-fs';

// Accent colours keyed by sound ID (mirrors soundbath-ringing.tsx)
const SOUND_ACCENT: Record<string, string> = {
  forest_birds: '#34d399', sea_waves: '#38bdf8', light_rain: '#60a5fa',
  breeze_trees: '#4ade80', river_flow: '#38bdf8', morning_birds: '#fbbf24',
  spring_birds: '#f472b6', forest_birds_spring: '#4ade80', forest_campfire: '#f97316',
  wanderlust_breeze: '#67e8f9', singing_bowl_deep: '#a78bfa', tibetan_bowl: '#c4b5fd',
  morning_flute: '#6ee7b7', sitar_morning: '#f59e0b', healing_bells_432: '#fde68a',
  indian_beats: '#fb923c', gayatri: '#fbbf24', lalitha: '#f472b6',
  shivtandav: '#60a5fa', bhagya_suktam: '#fbbf24', shiv_sankalpa_suktam: '#c4b5fd',
  // Sitar
  space_sitar: '#fcd34d', sitar_long: '#f59e0b', sitar_tabla_bells: '#fbbf24',
  indian_sitar_raga: '#fb923c', sitar_summer_raga: '#fde68a', sitar_radiance: '#f97316',
  sitar_tanpura_sarangi: '#f59e0b', sitar_tanpura_bgm: '#fbbf24', veena_classical: '#fcd34d',
  sitar_calm: '#fcd34d', veena_raga: '#f59e0b',
  // Flute
  andean_flute: '#6ee7b7', quena_flute: '#86efac', native_flute: '#a3e635',
  native_flute_echo: '#86efac', bamboo_flute: '#34d399',
  bansuri_tarana: '#86efac',
  // Birds
  koel_bird: '#34d399', peacock_wild: '#34d399', peacock_call: '#4ade80',
  cuckoo_forest: '#4ade80', cuckoo_soft: '#6ee7b7', cuckoo_clock: '#86efac',
  cuckoo_chime: '#a3e635', eagle_feather: '#78716c', india_countryside_birds: '#fde68a',
  cuckoo_birds_forest: '#86efac',
  // Tanpura
  tanpura_sacred_432hz: '#c084fc', tanpura_breath: '#a78bfa', tanpura_loop: '#818cf8',
  raga_tanpura_drone: '#6366f1', tanpura_mystic: '#818cf8', tanpura_serene: '#a78bfa',
  // World
  sargija_eastern: '#f97316', tagore_festival: '#fbbf24', world_ambient: '#a78bfa',
  tibetan_dreams: '#818cf8', spiritual_journey: '#c084fc', reincarnation_tones: '#a78bfa',
  night_jungle_chiangmai: '#4ade80', heaven_tune: '#fde68a', om_shanti: '#c084fc',
};

export default function WakeAlarmRingingScreen() {
  const router = useRouter();

  // ── Resolve sound from stored alarm settings ──────────────────────────────
  const [soundId, setSoundId] = useState('morning_birds');
  const [ms, setMs] = useState<MissionSettings>(DEFAULT_MISSION_SETTINGS);
  const [userName, setUserName] = useState('Champion');

  // Derived from soundId
  const wakeSound = WAKE_SOUNDS.find(s => s.id === soundId) ?? WAKE_SOUNDS.find(s => s.id === 'morning_birds')!;
  const label = wakeSound.label ?? 'Wake Sound';
  const accent = SOUND_ACCENT[soundId] ?? '#10b981';
  const bgImage = SOUND_IMAGES[soundId] ? getLocalSoundImageUri(SOUND_IMAGES[soundId]) : undefined;
  const mission = MISSIONS.find(m => m.id === ms.selectedMission) ?? MISSIONS[0];

  const [dismissed, setDismissed] = useState(false);
  const appStateRef = useRef(AppState.currentState);
  const bttfNotifIdRef = useRef<string | null>(null);
  const missionStartedRef = useRef(false);
  const { stopSound: stopAmbientSound, dismissMoodSheet } = useSoundPlayer();

  // ── Bootstrap: load alarm settings ───────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const alarmCfg = await store.getJSON<{ selectedMantraId?: string }>(KEYS.alarmSettings);
        const sid = alarmCfg?.selectedMantraId ?? 'morning_birds';
        setSoundId(sid);

        const saved = await store.getJSON<MissionSettings>(KEYS.missionSettings);
        if (saved) setMs({ ...DEFAULT_MISSION_SETTINGS, ...saved });

        const dosha = await store.getJSON<{ name?: string }>(KEYS.dosha);
        setUserName(dosha?.name ?? 'Champion');
      } catch { /* ignore */ }
    })();
  }, []);

  // ── Animations ─────────────────────────────────────────────────────────────
  const outerScale   = useSharedValue(1);
  const outerOpacity = useSharedValue(0.30);
  const innerScale   = useSharedValue(1);
  const btnScale     = useSharedValue(1);

  const outerStyle = useAnimatedStyle(() => ({ transform: [{ scale: outerScale.value }], opacity: outerOpacity.value }));
  const innerStyle = useAnimatedStyle(() => ({ transform: [{ scale: innerScale.value }] }));
  const btnStyle   = useAnimatedStyle(() => ({ transform: [{ scale: btnScale.value }] }));

  useEffect(() => {
    outerScale.value = withRepeat(
      withSequence(withTiming(1.35, { duration: 1400, easing: Easing.inOut(Easing.ease) }), withTiming(1, { duration: 1400 })), -1,
    );
    outerOpacity.value = withRepeat(
      withSequence(withTiming(0.70, { duration: 1400 }), withTiming(0.20, { duration: 1400 })), -1,
    );
    innerScale.value = withRepeat(
      withSequence(withTiming(1.10, { duration: 1000 }), withTiming(1, { duration: 1000 })), -1,
    );
    btnScale.value = withRepeat(
      withSequence(withTiming(1.04, { duration: 900 }), withTiming(1, { duration: 900 })), -1,
    );
  }, []);

  // ── Keep awake + native wake lock ─────────────────────────────────────────
  useEffect(() => {
    activateKeepAwakeAsync('wake-alarm');
    if (Platform.OS === 'android') {
      NativeModules.HabitAlarmModule?.acquireWakeLock?.().catch?.(() => {});
    }
    return () => {
      deactivateKeepAwake('wake-alarm');
      if (Platform.OS === 'android') {
        NativeModules.HabitAlarmModule?.releaseWakeLock?.().catch?.(() => {});
      }
    };
  }, []);

  // ── Silence ambient + mood sheet ──────────────────────────────────────────
  useEffect(() => {
    stopAmbientSound(false).catch(() => {});
    dismissMoodSheet();
  }, []);

  // ── Mute habit alarm if any, but KEEP WAKE ALARM SOUND PLAYING ──────────
  useEffect(() => {
    // Mute habit alarm
    NativeModules.HabitAlarmModule?.setHabitAlarmVolume?.(0).catch?.(() => {});
    NativeModules.HabitAlarmModule?.dismissHabitAlarmOverlay?.().catch?.(() => {});
    NativeModules.HabitAlarmModule?.stopHabitAlarmSound?.().catch?.(() => {});
    stopAlarmVibration().catch(() => {});
    // Dismiss native overlay if present
    NativeModules.AlarmModule?.dismissAlarmOverlay?.().catch?.(() => {});
  }, []);

  // ── Native AlarmSoundService is playing the alarm sound natively. ───────
  // We do not play JS audio here to avoid double-playing sounds.

  // ── Foreground service (Android) — keeps JVM alive when HOME pressed ──────
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    let started = false;
    (async () => {
      try {
        await notifee.createChannel({
          id: 'arise-soundbath', name: 'Nada Wake Alarm',
          importance: AndroidImportance.HIGH, bypassDnd: true,
          visibility: AndroidVisibility.PUBLIC,
        } as any);
        await notifee.displayNotification({
          id: WAKE_FS_ID,
          title: `${wakeSound.icon}  ${label} · Wake Alarm`,
          body: 'Alarm is ringing · tap to return.',
          android: {
            channelId: 'arise-soundbath',
            importance: AndroidImportance.HIGH,
            category: AndroidCategory.ALARM,
            visibility: AndroidVisibility.PUBLIC,
            ongoing: true,
            asForegroundService: true,
            fullScreenAction: { id: 'default', launchActivity: 'default' },
            pressAction:       { id: 'default', launchActivity: 'default' },
          } as any,
        });
        started = true;
      } catch (e) { console.warn('[WakeAlarm] fg service:', e); }
    })();
    return () => { if (started) notifee.cancelNotification(WAKE_FS_ID).catch(() => {}); };
  }, [label]);

  // ── Block hardware back button ────────────────────────────────────────────
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!dismissed) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [dismissed]);

  // ── Re-open when HOME pressed ─────────────────────────────────────────────
  useEffect(() => {
    if (dismissed) return;
    const BTTF = 'wake-alarm-bttf';

    const fireBttf = async () => {
      if (Platform.OS !== 'android') return;
      try {
        await notifee.createChannel({ id: 'alarm-bttf-silent', name: 'Alarm Return Prompt', importance: AndroidImportance.HIGH });
        await notifee.displayNotification({
          id: BTTF,
          title: `${wakeSound.icon}  Wake Alarm Ringing`,
          body: 'Tap to return and complete your mission.',
          android: {
            channelId: 'alarm-bttf-silent',
            importance: AndroidImportance.HIGH,
            category: AndroidCategory.ALARM,
            visibility: AndroidVisibility.PUBLIC,
            ongoing: true,
            asForegroundService: false,
            fullScreenAction: { id: 'default', launchActivity: 'default' },
            pressAction: { id: 'default', launchActivity: 'default' },
          } as any,
        });
        bttfNotifIdRef.current = BTTF;
      } catch {}
    };

    const cancelBttf = () => {
      notifee.cancelNotification(bttfNotifIdRef.current ?? BTTF).catch(() => {});
      notifee.cancelNotification(BTTF).catch(() => {});
      bttfNotifIdRef.current = null;
    };

    const ensureAudioPlaying = async () => {
      // Native audio is handled by foreground service
    };

    const sub = AppState.addEventListener('change', next => {
      if (!dismissed && appStateRef.current === 'active' && (next === 'background' || next === 'inactive')) {
        appStateRef.current = next; fireBttf(); ensureAudioPlaying();
      } else if (!dismissed && (appStateRef.current === 'background' || appStateRef.current === 'inactive') && next === 'active') {
        appStateRef.current = next; cancelBttf(); ensureAudioPlaying();
      } else { appStateRef.current = next; }
    });

    return () => { sub.remove(); cancelBttf(); };
  }, [dismissed, wakeSound]);

  // ── Clock ─────────────────────────────────────────────────────────────────
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmtTime = () => {
    const now = new Date();
    const h = now.getHours(); const m = now.getMinutes();
    const p = h < 12 ? 'AM' : 'PM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${pad(h12)}:${pad(m)} ${p}`;
  };
  const [timeStr, setTimeStr] = useState(fmtTime());
  useEffect(() => {
    const t = setInterval(() => setTimeStr(fmtTime()), 15_000);
    return () => clearInterval(t);
  }, []);

  // ── Kala context line ─────────────────────────────────────────────────────
  const hour = new Date().getHours();
  const kala = getKalaMessage(hour);

  // ── Begin Your Day (mission start) ────────────────────────────────────────
  const handleBeginMission = async () => {
    if (missionStartedRef.current) return;
    missionStartedRef.current = true;
    setDismissed(true);

    // DO NOT stop native alarm sound here!
    // We want the Native AlarmSoundService to keep playing the wake sound 
    // seamlessly while the user completes their mission.
    // The sound will be stopped in mission.tsx handleComplete().
    try { await NativeModules.HabitAlarmModule?.stopHabitAlarmSound?.(); } catch {}
    stopAlarmVibration().catch(() => {});

    // Note: We DO NOT stop screen pinning (stopNativeLockTask) here.
    // The mission screen will stop it when the mission is completed.

    // Mark alarm as handled
    await AsyncStorage.setItem('onesutra_alarm_handled_v1', Date.now().toString()).catch(() => {});
    await AsyncStorage.setItem('onesutra_mission_active_v1', mission.id).catch(() => {});

    // Cancel foreground service + bttf notifications
    notifee.cancelNotification(WAKE_FS_ID).catch(() => {});
    notifee.cancelNotification(bttfNotifIdRef.current ?? 'wake-alarm-bttf').catch(() => {});
    notifee.cancelNotification('wake-alarm-bttf').catch(() => {});
    notifee.cancelNotification('alarm-bttf').catch(() => {});

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace(`/mission?id=${mission.id}` as never);
  };

  return (
    <ImageBackground
      source={bgImage ? { uri: bgImage } : undefined}
      style={S.screen}
      imageStyle={{ opacity: 0.68 }}
    >
      {/* Full-screen touch interceptor */}
      <View style={StyleSheet.absoluteFillObject} />

      <StatusBar hidden />

      {/* Dark gradient overlay */}
      <LinearGradient
        colors={['rgba(0,0,0,0.72)', 'rgba(0,0,0,0.10)', 'rgba(0,0,0,0.10)', 'rgba(0,0,0,0.88)']}
        locations={[0, 0.18, 0.55, 1]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      {/* Ambient colour wash */}
      <View style={[S.ambientGlow, { backgroundColor: accent + '0E' }]} pointerEvents="none" />

      {/* ── TOP: time + sound chip ── */}
      <View style={S.topArea}>
        <Text style={S.clockText}>{timeStr}</Text>
        <View style={[S.chip, { borderColor: accent + '55', backgroundColor: 'rgba(0,0,0,0.40)' }]}>
          <View style={[S.liveDot, { backgroundColor: accent }]} />
          <Text style={{ fontSize: 13 }}>{wakeSound.icon}</Text>
          <Text style={[S.chipLabel, { color: accent }]}>{label}</Text>
        </View>
      </View>

      {/* ── CENTER: pulsing orb ── */}
      <View style={S.orbWrap} pointerEvents="none">
        <Animated.View style={[S.outerRing, outerStyle, { borderColor: accent + '40' }]} />
        <View style={[S.midRing, { borderColor: accent + '20' }]} />
        <Animated.View style={[S.innerCircle, innerStyle, { backgroundColor: accent + '18', borderColor: accent + '50' }]}>
          <Text style={S.orbIcon}>{wakeSound.icon}</Text>
        </Animated.View>
      </View>

      {/* ── BOTTOM: kala + mission pill + CTA ── */}
      <View style={S.bottomArea}>

        {/* Kala context line */}
        <Text style={[S.kalaHint, { color: accent + 'BB' }]}>
          {kala.toUpperCase()}{'  ·  '}{userName} · DAY {ms.streak || 1} 🔥
        </Text>

        {/* Mission pill */}
        <View style={[S.missionPill, { borderColor: mission.color + '40', backgroundColor: 'rgba(0,0,0,0.45)' }]}>
          <Text style={{ fontSize: 22 }}>{mission.icon}</Text>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[S.missionBadge, { color: mission.color + 'AA' }]}>TODAY'S MISSION</Text>
            <Text style={S.missionName}>{mission.name}</Text>
            <Text style={S.missionTagline}>{mission.tagline}</Text>
          </View>
        </View>

        {/* CTA — Begin Your Day */}
        <Animated.View style={[{ width: '100%' }, btnStyle]}>
          <TouchableOpacity
            style={[S.ctaBtn, { shadowColor: accent }]}
            onPress={handleBeginMission}
            activeOpacity={0.84}
          >
            <LinearGradient
              colors={[accent + '55', accent + '30']}
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

        {/* Lock indicator */}
        <View style={S.lockBar}>
          <Text style={S.lockBarTxt}>🔒  Can't close · complete mission to stop alarm</Text>
        </View>
      </View>
    </ImageBackground>
  );
}

const S = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: '#02040C' },
  ambientGlow: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },

  // Top
  topArea:   { paddingTop: 54, alignItems: 'center', gap: 10 },
  chip:      { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 99, paddingHorizontal: 16, paddingVertical: 8 },
  liveDot:   { width: 7, height: 7, borderRadius: 3.5 },
  chipLabel: { fontSize: 13, fontWeight: '800', letterSpacing: 0.4 },
  clockText: { fontSize: 64, fontWeight: '100', color: '#FFFFFF', letterSpacing: -2.5 },

  // Center orb
  orbWrap:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  outerRing:   { position: 'absolute', width: 220, height: 220, borderRadius: 110, borderWidth: 1.5 },
  midRing:     { position: 'absolute', width: 160, height: 160, borderRadius: 80, borderWidth: 1 },
  innerCircle: { width: 110, height: 110, borderRadius: 55, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  orbIcon:     { fontSize: 44 },

  // Bottom
  bottomArea: { paddingHorizontal: 26, paddingBottom: 48, alignItems: 'center', gap: 12 },
  kalaHint:   { fontSize: 9, fontWeight: '800', letterSpacing: 1.8 },

  // Mission pill
  missionPill:   {
    width: '100%', flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: 18, paddingHorizontal: 18, paddingVertical: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.38, shadowRadius: 20, elevation: 12,
  },
  missionBadge:  { fontSize: 8, fontWeight: '900', letterSpacing: 2 },
  missionName:   { fontSize: 16, fontWeight: '900', color: '#FFFFFF', marginTop: 2 },
  missionTagline:{ fontSize: 11, color: '#FFFFFF60', marginTop: 2, lineHeight: 16 },

  // CTA
  ctaBtn: {
    width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 24, paddingVertical: 22, overflow: 'hidden',
    shadowOpacity: 0.45, shadowRadius: 24, elevation: 12, shadowOffset: { width: 0, height: 6 },
  },
  ctaIcon:  { fontSize: 20, color: '#FFFFFFEE' },
  ctaTitle: { fontSize: 18, fontWeight: '900', color: '#FFFFFFEE', letterSpacing: 0.2 },
  ctaSub:   { fontSize: 10, fontWeight: '600', color: '#FFFFFF70', letterSpacing: 0.5, marginTop: 2 },

  // Lock bar
  lockBar:    { alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 6, backgroundColor: '#FFFFFF04', borderRadius: 99, borderWidth: 1, borderColor: '#FFFFFF08' },
  lockBarTxt: { fontSize: 9, color: '#FFFFFF22', fontWeight: '700', letterSpacing: 0.5 },
});
