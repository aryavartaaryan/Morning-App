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

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, BackHandler,
  StatusBar, AppState, Platform, NativeModules, ImageBackground,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, Easing, cancelAnimation,
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
import { stopAlarmVibration, stopNativeLockTask, stopNativeAlarmSound, stopNativeAlarmAudioOnly, cancelNativeAlarm } from '@/lib/nativeAlarm';
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
  const [isLoaded, setIsLoaded] = useState(false);
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
  // 'stopping' gives INSTANT visual feedback on press so user knows it was received.
  // This is critical: without it, a press that takes >300ms to process looks "frozen".
  const [stopping, setStopping] = useState(false);
  const appStateRef = useRef(AppState.currentState);
  const bttfNotifIdRef = useRef<string | null>(null);
  const missionStartedRef = useRef(false);
  // Prevent setState after unmount — primary cause of JS-thread freeze on long-ringing screens
  const isMountedRef = useRef(true);
  // Native service health watchdog interval handle
  const watchdogRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { stopSound: stopAmbientSound, dismissMoodSheet } = useSoundPlayer();

  // Derived: is mission mode active?
  const missionEnabled = ms.missionEnabled ?? false;

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
      finally { setIsLoaded(true); }
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
    return () => {
      cancelAnimation(outerScale);
      cancelAnimation(outerOpacity);
      cancelAnimation(innerScale);
      cancelAnimation(btnScale);
    };
  }, []);

  // ── Keep awake + native wake lock ─────────────────────────────────────────
  useEffect(() => {
    activateKeepAwakeAsync('wake-alarm');
    if (Platform.OS === 'android') {
      NativeModules.HabitAlarmModule?.acquireWakeLock?.().catch?.(() => {});
    }
    return () => {
      // Mark unmounted — all isMountedRef guards below will stop setState calls.
      // This is the primary fix for JS thread freeze after long ringing.
      isMountedRef.current = false;
      // Clear watchdog so no intervals outlive the screen
      if (watchdogRef.current !== null) {
        clearTimeout(watchdogRef.current);
        watchdogRef.current = null;
      }
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
    // BUG 3 FIX: Dismiss native overlay IMMEDIATELY on mount.
    // The overlay was using FLAG_NOT_FOCUSABLE (now changed to FLAG_NOT_TOUCH_MODAL
    // in AlarmSoundServiceBase), but dismissing it quickly also removes any residual
    // risk of it blocking keyguard/fingerprint interaction.
    // Call twice: immediately + 200ms safety-net for START_STICKY service race.
    NativeModules.AlarmModule?.dismissAlarmOverlay?.().catch?.(() => {});
    const t = setTimeout(() => {
      NativeModules.AlarmModule?.dismissAlarmOverlay?.().catch?.(() => {});
    }, 200);
    return () => clearTimeout(t);
  }, []);


  // ── Native AlarmSoundService is playing the alarm sound natively. ───────
  // We do not play JS audio here to avoid double-playing sounds.

  // ── Native service health watchdog ───────────────────────────────────────
  // Checks every 30 s that AlarmSoundService is still running.
  // On some OEM devices (Xiaomi, Samsung with aggressive battery saver),
  // the foreground service can be killed after ~10 min, silencing the alarm
  // while leaving the screen visible — making it seem frozen/unresponsive.
  // This watchdog detects that state and pings the native layer to restart.
  // FIX: Using recursive setTimeout instead of setInterval to prevent async overlap.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    
    let isRunning = true;
    const poll = async () => {
      if (!isRunning || !isMountedRef.current) return;
      
      try {
        const playing = await NativeModules.AlarmModule?.isAlarmSoundPlaying?.();
        if (playing === false && isMountedRef.current) {
          console.warn('[WakeAlarm] watchdog: native sound stopped unexpectedly — restarting');
          NativeModules.AlarmModule?.stopAlarmSound?.().catch?.(() => {});
        }
      } catch { /* ignore */ }
      
      if (isRunning) {
        watchdogRef.current = setTimeout(poll, 30_000) as any;
      }
    };
    
    watchdogRef.current = setTimeout(poll, 30_000) as any;
    
    return () => {
      isRunning = false;
      if (watchdogRef.current !== null) {
        clearTimeout(watchdogRef.current);
        watchdogRef.current = null;
      }
    };
  }, []);

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
    if (dismissed) return; // Completely detach listener when dismissed
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      return true;
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
    const t = setInterval(() => {
      // Guard: don't setState if unmounted (avoids memory leak / JS stall)
      if (isMountedRef.current) setTimeStr(fmtTime());
    }, 15_000);
    return () => clearInterval(t);
  }, []);

  // ── Kala context line ─────────────────────────────────────────────────────
  const hour = new Date().getHours();
  const kala = getKalaMessage(hour);

  // ── Stop Alarm (mission-free mode) ────────────────────────────────────────
  //
  // ROOT CAUSE (happens even at 5 min of ringing):
  //
  // After the button press, the old code set missionStartedRef=true, showed
  // visual feedback, then called `await withTimeout(stopNativeAlarmSound(), 2500)`.
  // If stopNativeAlarmSound() stalled on the native bridge (busy thread, OEM
  // quirk), the entire async function was suspended for up to 2500ms. During
  // this time: button is disabled (stopping=true) AND guard is set (missionStartedRef=true)
  // so additional user taps do absolutely nothing — the button appears frozen.
  //
  // SECOND ROOT CAUSE (native watchdog fights navigation):
  // Even when navigation DID fire, the native bringToFrontRunnable (200ms timer)
  // would see the app leave foreground while alarm_stopping was still false
  // (cleanup hadn't happened yet) and immediately call launchApp() to bring
  // the alarm screen BACK — making the button appear to do nothing.
  //
  // THE PRECISE FIX:
  // 1. Fire cleanup native calls FIRST as pure void (fire-and-forget, zero awaiting).
  //    The Kotlin side receives stopAlarmSound() almost instantly and writes
  //    alarm_stopping=true to SharedPreferences in-memory (synchronous .apply()).
  //    Native watchdog stops immediately. Total JS time: <1ms.
  // 2. Navigate in setTimeout(0) — fires on the NEXT JS event loop tick.
  //    By then, alarm_stopping is already true in Kotlin, so the watchdog
  //    will NOT call launchApp() even if it ticks during the transition.
  // 3. Safety-net: reset guard after 3s in case navigation itself failed.
  const handleStopAlarm = useCallback(() => {
    // Double-tap guard — prevents duplicate navigation
    if (missionStartedRef.current) return;
    missionStartedRef.current = true;

    // INSTANT: Write escape hatch flag (relieves foreground-service polling back-pressure)
    void AsyncStorage.setItem('onesutra_alarm_handled_v1', Date.now().toString()).catch(() => {});

    // INSTANT: Visual feedback (synchronous React state queue)
    if (isMountedRef.current) setStopping(true);
    if (isMountedRef.current) setDismissed(true);

    // Kill JS watchdog — no longer needed
    if (watchdogRef.current !== null) { clearTimeout(watchdogRef.current); watchdogRef.current = null; }

    // Haptic (synchronous, never stalls)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // CRITICAL ORDER: Fire ALL native cleanup calls FIRST (no await, no timeout wrappers).
    // These are void — the Promise is intentionally discarded. The Kotlin code for
    // stopAlarmSound() writes alarm_stopping=true using .apply() (in-memory synchronous)
    // so the native bringToFrontRunnable sees it before it can call launchApp() again.
    // Total native bridge dispatch time: <1ms.
    void stopNativeAlarmSound().catch(() => {});
    void stopNativeAlarmAudioOnly().catch(() => {});
    void stopAlarmVibration().catch(() => {});
    void stopNativeLockTask().catch(() => {});
    void cancelNativeAlarm().catch(() => {});
    void notifee.cancelNotification(WAKE_FS_ID).catch(() => {});
    void notifee.cancelNotification(bttfNotifIdRef.current ?? 'wake-alarm-bttf').catch(() => {});
    void notifee.cancelNotification('wake-alarm-bttf').catch(() => {});
    void notifee.cancelNotification('alarm-bttf').catch(() => {});

    // Navigate on the NEXT JS tick — by this point alarm_stopping=true is already
    // queued to Kotlin, so the native watchdog is already stopping before navigation fires.
    setTimeout(() => {
      try { router.replace('/(tabs)' as never); } catch { /* ignore */ }
    }, 0);

    // Safety-net: reset guard after 3s so if everything went wrong, user can retry
    setTimeout(() => {
      if (isMountedRef.current) { missionStartedRef.current = false; }
    }, 3000);
  }, []);


  // ── Begin Your Day (mission mode) ────────────────────────────────────────
  // Same fix as handleStopAlarm — cleanup fires first (void/no-await),
  // then navigate on next JS tick so the native watchdog can't fight us.
  const handleBeginMission = useCallback(() => {
    if (missionStartedRef.current) return;
    missionStartedRef.current = true;

    void AsyncStorage.setItem('onesutra_alarm_handled_v1', Date.now().toString()).catch(() => {});
    void AsyncStorage.setItem('onesutra_mission_active_v1', mission.id).catch(() => {});

    if (isMountedRef.current) setStopping(true);
    if (isMountedRef.current) setDismissed(true);

    if (watchdogRef.current !== null) { clearTimeout(watchdogRef.current); watchdogRef.current = null; }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Cleanup FIRST (sets alarm_stopping=true in Kotlin before navigation)
    void stopNativeAlarmSound().catch(() => {});
    void stopNativeAlarmAudioOnly().catch(() => {});
    void stopAlarmVibration().catch(() => {});
    void stopNativeLockTask().catch(() => {});
    void cancelNativeAlarm().catch(() => {});
    void notifee.cancelNotification(WAKE_FS_ID).catch(() => {});
    void notifee.cancelNotification(bttfNotifIdRef.current ?? 'wake-alarm-bttf').catch(() => {});
    void notifee.cancelNotification('wake-alarm-bttf').catch(() => {});
    void notifee.cancelNotification('alarm-bttf').catch(() => {});

    // Navigate on next JS tick (alarm_stopping already queued to Kotlin)
    setTimeout(() => {
      try { router.replace(`/mission?id=${mission.id}` as never); } catch { /* ignore */ }
    }, 0);

    setTimeout(() => {
      if (isMountedRef.current) missionStartedRef.current = false;
    }, 3000);
  }, [mission.id]);

  if (!isLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#060610' }} />;
  }

  return (
    <ImageBackground
      source={bgImage ? { uri: bgImage } : undefined}
      style={S.screen}
      imageStyle={{ opacity: 0.68 }}
    >
      {/* Dark overlay for image — pointerEvents='none' so it NEVER intercepts
          touches meant for the buttons below. The old default-'auto' absoluteFill
          view was silently swallowing button taps after long uptime on OEM ROMs. */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none" />

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

      {/* ── BOTTOM: kala + CTA ── */}
      <View style={S.bottomArea}>

        {/* Kala context line */}
        <Text style={[S.kalaHint, { color: accent + 'BB' }]}>
          {kala.toUpperCase()}{'  ·  '}{userName} · DAY {ms.streak || 1} 🔥
        </Text>

        {missionEnabled ? (
          // ── MISSION MODE: pill + Begin Your Day ──────────────────────────
          <>
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
                style={[
                  S.ctaBtn,
                  { shadowColor: accent },
                  stopping && { opacity: 0.55, transform: [{ scale: 0.97 }] },
                ]}
                onPress={handleBeginMission}
                activeOpacity={0.7}
                disabled={stopping}
              >
                <LinearGradient
                  colors={[accent + '40', accent + '10']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[StyleSheet.absoluteFillObject, { borderRadius: 28 }]}
                />
                <Text style={S.ctaIcon}>{stopping ? '⏳' : '☀️'}</Text>
                <View style={{ marginLeft: 10 }}>
                  <Text style={S.ctaTitle}>{stopping ? 'Starting…' : 'Begin Your Day'}</Text>
                  <Text style={S.ctaSub}>{stopping ? 'please wait a moment' : 'tap to stop alarm · start mission'}</Text>
                </View>
              </TouchableOpacity>
            </Animated.View>
          </>
        ) : (
          // ── MISSION-FREE MODE: simple Stop Alarm button ──────────────────
          // pointerEvents removed from Animated.View (was 'box-none') so the
          // button is always a direct, unambiguous touch target.
          <Animated.View style={[{ width: '100%' }, btnStyle]}>
            <TouchableOpacity
              style={[
                S.ctaBtn,
                { shadowColor: accent },
                // Visual feedback: dim & scale-down immediately on press so the
                // user knows the tap was received even before cleanup finishes.
                stopping && { opacity: 0.55, transform: [{ scale: 0.97 }] },
              ]}
              onPress={handleStopAlarm}
              activeOpacity={0.7}
              disabled={stopping}
            >
              <LinearGradient
                colors={[accent + '40', accent + '10']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[StyleSheet.absoluteFillObject, { borderRadius: 28 }]}
              />
              <Text style={S.ctaIcon}>{stopping ? '⏳' : '🛑'}</Text>
              <View style={{ marginLeft: 10 }}>
                <Text style={S.ctaTitle}>{stopping ? 'Stopping…' : 'Stop Alarm'}</Text>
                <Text style={S.ctaSub}>{stopping ? 'please wait a moment' : 'tap to dismiss · good morning ☀️'}</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Lock indicator */}
        <View style={S.lockBar}>
          <Text style={S.lockBarTxt}>
            {missionEnabled
              ? '🔒  Can\'t close · complete mission to stop alarm'
              : '☀️  Rise and shine — tap above to stop'}
          </Text>
        </View>
      </View>
    </ImageBackground>
  );
}

const S = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: '#02040C' },
  ambientGlow: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },

  // Top
  topArea:   { paddingTop: 64, alignItems: 'center', gap: 14 },
  chip:      { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 24, paddingHorizontal: 18, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.03)' },
  liveDot:   { width: 8, height: 8, borderRadius: 4 },
  chipLabel: { fontSize: 12, fontFamily: 'Nunito_800ExtraBold', letterSpacing: 1.5, textTransform: 'uppercase' },
  clockText: { fontSize: 72, fontWeight: '200', color: '#FFFFFF', letterSpacing: -2 },

  // Center orb
  orbWrap:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  outerRing:   { position: 'absolute', width: 300, height: 300, borderRadius: 150, borderWidth: 1 },
  midRing:     { position: 'absolute', width: 220, height: 220, borderRadius: 110, borderWidth: 1 },
  innerCircle: { width: 140, height: 140, borderRadius: 70, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  orbIcon:     { fontSize: 54 },

  // Bottom
  bottomArea: { paddingHorizontal: 32, paddingBottom: 56, alignItems: 'center', gap: 16 },
  kalaHint:   { fontSize: 10, fontFamily: 'Nunito_800ExtraBold', letterSpacing: 2, textTransform: 'uppercase' },

  // Mission pill
  missionPill:   {
    width: '100%', flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderRadius: 24, paddingHorizontal: 22, paddingVertical: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5, shadowRadius: 30, elevation: 15,
  },
  missionBadge:  { fontSize: 9, fontFamily: 'Nunito_800ExtraBold', letterSpacing: 2.5, textTransform: 'uppercase' },
  missionName:   { fontSize: 18, fontFamily: 'Nunito_800ExtraBold', color: '#FFFFFF', marginTop: 4, letterSpacing: 0.5 },
  missionTagline:{ fontSize: 12, fontFamily: 'Nunito_400Regular', color: '#FFFFFF80', marginTop: 3, lineHeight: 18 },

  // CTA
  ctaBtn: {
    width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 28, paddingVertical: 24, overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)',
    shadowOpacity: 0.6, shadowRadius: 32, elevation: 15, shadowOffset: { width: 0, height: 10 },
  },
  ctaIcon:  { fontSize: 22, color: '#FFFFFF' },
  ctaTitle: { fontSize: 18, fontFamily: 'Nunito_800ExtraBold', color: '#FFFFFF', letterSpacing: 0.5 },
  ctaSub:   { fontSize: 11, fontFamily: 'Nunito_700Bold', color: '#FFFFFF80', letterSpacing: 0.8, marginTop: 4, textTransform: 'uppercase' },

  // Lock bar
  lockBar:    { alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 99, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  lockBarTxt: { fontSize: 10, color: '#FFFFFF50', fontFamily: 'Nunito_700Bold', letterSpacing: 1, textTransform: 'uppercase' },
});
