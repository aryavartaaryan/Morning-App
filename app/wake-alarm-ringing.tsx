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
import { stopAlarmVibration, startNativeLockTask, stopNativeLockTask, stopNativeAlarmSound, stopNativeAlarmAudioOnly, cancelNativeAlarm } from '@/lib/nativeAlarm';
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
  om_chant_cosmic: '#6366f1', tanpura_nada: '#818cf8',
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
  const rotVal       = useSharedValue(0);

  const outerStyle = useAnimatedStyle(() => ({ transform: [{ scale: outerScale.value }], opacity: outerOpacity.value }));
  const innerStyle = useAnimatedStyle(() => ({ transform: [{ scale: innerScale.value }] }));
  const btnStyle   = useAnimatedStyle(() => ({ transform: [{ scale: btnScale.value }] }));
  const rotStyle   = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotVal.value}deg` }] }));
  const rotRevStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `-${rotVal.value}deg` }] }));

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
    rotVal.value = withRepeat(withTiming(360, { duration: 25000, easing: Easing.linear }), -1, false);
    return () => {
      cancelAnimation(outerScale);
      cancelAnimation(outerOpacity);
      cancelAnimation(innerScale);
      cancelAnimation(btnScale);
      cancelAnimation(rotVal);
    };
  }, []);

  // ── Pin screen immediately on mount (Lock Task Mode) ─────────────────────
  // Restores the enforced/automatic screen pinning that was present earlier.
  // Calls startLockTask() immediately when the wake alarm screen opens —
  // same pattern as soundbath-ringing.tsx (proven stable). When the alarm
  // fires on a locked/sleeping device via fullScreenIntent, this pins silently
  // with NO dialog. When the device is already unlocked, Android shows its
  // standard "App is pinned" confirmation — but the call is made automatically
  // without waiting for any user button press.
  useEffect(() => {
    startNativeLockTask().catch(() => {});
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
        // Notify the native service that the JS alarm UI was dismissed.
        // This resets alarmScreenLaunched on the service so the next time the
        // user opens the app while the alarm is still ringing, the native watchdog
        // will re-fire the deep-link (solrize://wake-alarm-ringing) instead of
        // just doing REORDER_TO_FRONT (which lands on the home screen).
        NativeModules.AlarmModule?.notifyAlarmUIDismissed?.().catch?.(() => {});
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

  // ── AUTO-DISMISS: Maximum alarm ring duration ──────────────────────────────
  //
  // ALL modern alarm apps implement this:
  //   Google Clock: 30 minutes, Samsung Clock: 20 minutes, Alarmy: configurable
  //
  // Without this, a ringing alarm that the user misses will ring indefinitely,
  // and the longer it rings the higher the chance watchdog/lock-task state gets
  // corrupted making the Stop button appear frozen.
  //
  // After MAX_RING_DURATION_MS the alarm auto-dismisses to the home tab.
  // This is the single most important safety guarantee for long-ringing alarms.
  const MAX_RING_DURATION_MS = 30 * 60 * 1000; // 30 minutes
  useEffect(() => {
    if (!isLoaded) return;
    const autoDismissTimer = setTimeout(() => {
      if (!isMountedRef.current || missionStartedRef.current) return;
      console.warn('[WakeAlarm] Auto-dismiss: alarm rang for 30 minutes without user interaction');
      // Fire the same cleanup as a manual stop
      void AsyncStorage.setItem('onesutra_alarm_handled_v1', Date.now().toString()).catch(() => {});
      void stopNativeAlarmSound().catch(() => {});
      void stopNativeAlarmAudioOnly().catch(() => {});
      void stopAlarmVibration().catch(() => {});
      void stopNativeLockTask().catch(() => {});
      void cancelNativeAlarm().catch(() => {});
      if (watchdogRef.current !== null) { clearTimeout(watchdogRef.current); watchdogRef.current = null; }
      try { router.replace('/(tabs)' as never); } catch { /* ignore */ }
    }, MAX_RING_DURATION_MS);
    return () => clearTimeout(autoDismissTimer);
  }, [isLoaded]);

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
  // COMPLETE ROOT CAUSE FIX (after 30+ failed attempts at workarounds):
  //
  // The true root cause was a 2-layer problem:
  //
  // LAYER 1 — LOCK TASK MODE (primary freeze cause):
  // After 3-4 minutes, MainActivity.startAlarmLockTaskOnce() had entered Android
  // Lock Task Mode (screen pinning). When the user taps Stop, stopLockTask() was
  // fired as a void/fire-and-forget AFTER all other cleanup. Android blocks ALL
  // touch input and window transitions while in Lock Task Mode. If router.replace()
  // fired BEFORE stopLockTask() resolved, navigation was blocked by the OS itself.
  // Fix: stopLockTask() is now called FIRST (in AlarmModule.stopAlarmSound() on
  // the main thread) BEFORE the service stops.
  //
  // LAYER 2 — WATCHDOG RE-POST BUG (secondary freeze cause):
  // bringToFrontRunnable re-posted itself unconditionally at the bottom of run()
  // even when isAlarmStopping() caused an early return at the top. The runnable
  // kept scheduling forever until onDestroy() ran — fighting router.replace().
  // Fix: re-post is now inside an if(!isAlarmStopping() && isAlarmActive()) guard.
  //
  // LAYER 3 — JS NAVIGATION RETRY:
  // Even after the native fixes, the JS side now uses a retry loop: if the first
  // router.replace() call fails (throws or is blocked), it retries every 200ms
  // up to 5 times. This mirrors what production alarm apps like Google Clock do.
  const handleStopAlarm = useCallback(() => {
    // Double-tap guard — prevents duplicate navigation
    if (missionStartedRef.current) return;
    missionStartedRef.current = true;

    // INSTANT: Write escape hatch flag
    void AsyncStorage.setItem('onesutra_alarm_handled_v1', Date.now().toString()).catch(() => {});

    // INSTANT: Visual feedback (synchronous React state queue)
    if (isMountedRef.current) setStopping(true);
    if (isMountedRef.current) setDismissed(true);

    // Kill JS watchdog — no longer needed
    if (watchdogRef.current !== null) { clearTimeout(watchdogRef.current); watchdogRef.current = null; }

    // Haptic (synchronous, never stalls)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // STEP 1: Fire ALL native cleanup calls (no await — fire-and-forget).
    // stopNativeAlarmSound() internally calls stopLockTask() on the main thread
    // BEFORE stopping the service — this is the critical ordering that fixes the freeze.
    void stopNativeAlarmSound().catch(() => {});
    void stopNativeAlarmAudioOnly().catch(() => {});
    void stopAlarmVibration().catch(() => {});
    void stopNativeLockTask().catch(() => {});
    void cancelNativeAlarm().catch(() => {});
    void notifee.cancelNotification(WAKE_FS_ID).catch(() => {});
    void notifee.cancelNotification(bttfNotifIdRef.current ?? 'wake-alarm-bttf').catch(() => {});
    void notifee.cancelNotification('wake-alarm-bttf').catch(() => {});
    void notifee.cancelNotification('alarm-bttf').catch(() => {});

    // STEP 2: Navigation retry loop.
    // Retries every 200ms up to 5 times. By the time this fires, stopLockTask()
    // has already been dispatched to the Android main thread via stopAlarmSound().
    let navAttempts = 0;
    const MAX_NAV_ATTEMPTS = 5;
    const tryNavigate = () => {
      navAttempts++;
      try {
        router.replace('/(tabs)' as never);
        return; // success
      } catch {
        if (navAttempts < MAX_NAV_ATTEMPTS) {
          setTimeout(tryNavigate, 200);
        } else {
          // All retries exhausted — ALWAYS re-enable the button so user can tap again.
          // A permanently disabled button is NEVER acceptable.
          if (isMountedRef.current) { missionStartedRef.current = false; setStopping(false); }
        }
      }
    };
    setTimeout(tryNavigate, 0);

    // Hard safety-net: after 3s unconditionally re-enable the button.
    // This covers cases where tryNavigate never throws (e.g. router silently
    // ignores the call) but navigation also never completes (unmount never fires).
    setTimeout(() => {
      if (isMountedRef.current) { missionStartedRef.current = false; setStopping(false); }
    }, 3000);
  }, []);


  // ── Begin Your Day (mission mode) ────────────────────────────────────────
  // Same root-cause fix as handleStopAlarm — stopLockTask fires inside
  // stopAlarmSound() on the native main thread BEFORE service stops.
  // Navigation uses a retry loop for robustness.
  const handleBeginMission = useCallback(() => {
    if (missionStartedRef.current) return;
    missionStartedRef.current = true;

    void AsyncStorage.setItem('onesutra_alarm_handled_v1', Date.now().toString()).catch(() => {});
    void AsyncStorage.setItem('onesutra_mission_active_v1', mission.id).catch(() => {});

    if (isMountedRef.current) setStopping(true);
    if (isMountedRef.current) setDismissed(true);

    if (watchdogRef.current !== null) { clearTimeout(watchdogRef.current); watchdogRef.current = null; }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Cleanup FIRST (sets alarm_stopping=true + calls stopLockTask on main thread in Kotlin)
    void stopNativeAlarmSound().catch(() => {});
    void stopNativeAlarmAudioOnly().catch(() => {});
    void stopAlarmVibration().catch(() => {});
    void stopNativeLockTask().catch(() => {});
    void cancelNativeAlarm().catch(() => {});
    void notifee.cancelNotification(WAKE_FS_ID).catch(() => {});
    void notifee.cancelNotification(bttfNotifIdRef.current ?? 'wake-alarm-bttf').catch(() => {});
    void notifee.cancelNotification('wake-alarm-bttf').catch(() => {});
    void notifee.cancelNotification('alarm-bttf').catch(() => {});

    // Navigation retry loop
    let navAttempts = 0;
    const MAX_NAV_ATTEMPTS = 5;
    const tryNavigate = () => {
      navAttempts++;
      try {
        router.replace(`/mission?id=${mission.id}` as never);
        return;
      } catch {
        if (navAttempts < MAX_NAV_ATTEMPTS) {
          setTimeout(tryNavigate, 200);
        } else {
          // All retries exhausted — ALWAYS re-enable the button
          if (isMountedRef.current) { missionStartedRef.current = false; setStopping(false); }
        }
      }
    };
    setTimeout(tryNavigate, 0);

    // Hard safety-net: after 3s unconditionally re-enable
    setTimeout(() => {
      if (isMountedRef.current) { missionStartedRef.current = false; setStopping(false); }
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

      
      {/* ── CENTER: PREMIUM PULSING ORB ── */}
      <View style={S.orbWrap} pointerEvents="none">
        {/* Outer ambient glow */}
        <Animated.View style={[S.outerRing, outerStyle, { backgroundColor: accent + '15', borderWidth: 0, shadowColor: accent, shadowOpacity: 0.6, shadowRadius: 50 }]} />
        
        {/* Slow rotating dashed ring */}
        <Animated.View style={[S.midRing, rotStyle, { borderColor: accent + '60', borderStyle: 'dashed', borderWidth: 1.5, opacity: 0.8 }]} />
        
        {/* Reverse rotating outer thin ring */}
        <Animated.View style={[rotRevStyle, { position: 'absolute', width: 260, height: 260, borderRadius: 130, borderColor: accent + '30', borderWidth: 1 }]} />
        
        {/* Sparkle nodes on reverse ring */}
        <Animated.View style={[rotRevStyle, { position: 'absolute', width: 260, height: 260, borderRadius: 130 }]}>
            <View style={{ position: 'absolute', top: -3, left: 127, width: 6, height: 6, borderRadius: 3, backgroundColor: accent, shadowColor: accent, shadowOpacity: 1, shadowRadius: 10 }} />
            <View style={{ position: 'absolute', bottom: -3, left: 127, width: 6, height: 6, borderRadius: 3, backgroundColor: accent, shadowColor: accent, shadowOpacity: 1, shadowRadius: 10 }} />
        </Animated.View>

        {/* Inner solid core with intense drop shadow */}
        <Animated.View style={[S.innerCircle, innerStyle, { backgroundColor: accent + '25', borderColor: accent + '80', shadowColor: accent, shadowOpacity: 1, shadowRadius: 30, shadowOffset: { width: 0, height: 0 } }]}>
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
          // The button is NEVER disabled — missionStartedRef guards double-tap.
          // disabled={stopping} was permanently locking the button when navigation
          // silently failed. Now stopping only controls visual appearance.
          <Animated.View style={[{ width: '100%' }, btnStyle]}>
            <TouchableOpacity
              style={[
                S.ctaBtn,
                { shadowColor: accent },
                stopping && { opacity: 0.55, transform: [{ scale: 0.97 }] },
              ]}
              onPress={handleStopAlarm}
              activeOpacity={0.7}
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
