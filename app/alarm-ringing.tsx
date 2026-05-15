import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, BackHandler, StatusBar,
  Dimensions, Modal, ScrollView, AppState, Platform, ImageBackground,
} from 'react-native';
import notifee, { AndroidImportance, AndroidCategory, AndroidVisibility } from '@notifee/react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming,
  Easing, withSpring, interpolate, Extrapolation,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { speakBodhi, stopBodhi } from '@/lib/speech';
import { useSoundPlayer } from '@/lib/soundPlayerContext';
import { stopNativeAlarmSound, setNativeAlarmVolume, startAlarmVibration, stopAlarmVibration, dismissAlarmOverlay } from '@/lib/nativeAlarm';
import { cancelVolumeRamp, cancelFusion, playGentleAlarmAudio, playFusionAlarm, preemptActiveAlarm, setActiveAlarmSoundRef, stopActivePreview } from '@/lib/alarmAudio';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocalMantraPath } from '@/lib/mantraDownload';
import { store, KEYS } from '@/lib/storage';
import { getSolarTimes } from '@/lib/solar';
import { recordWake } from '@/lib/sunriseStreak';
import { type AlarmSettings } from '@/lib/notifications';
import { saveHabitLog, todayStr } from '@/lib/habitLogs';
import { auth } from '@/lib/firebase';
import {
  MISSIONS, WAKE_SOUNDS, DEFAULT_MISSION_SETTINGS, MissionSettings,
  getKalaMessage, WAKE_QUOTES,
} from '@/lib/missionAlarm';
import { SOUND_IMAGES } from '@/lib/sleepSoundsData';

const MANTRA_TO_WAKE: Record<string, string> = {
  gayatri: 'gayatri',
  lalitha: 'lalitha',
  shivtandav: 'shiv_tandav',
};

const BUNDLED_MANTRA_ASSETS: Record<string, any> = {
  bhagya_suktam:        require('../assets/sounds/bhagya-suktam.mp3'),
  shiv_sankalpa_suktam: require('../assets/sounds/shiv-sankalpa-suktam.mp3'),
};

// Gentle / nature sounds that are bundled as .m4a — no download needed
const BUNDLED_NATURE_ASSETS: Record<string, any> = {
  forest_birds:       require('../assets/sounds/mixkit-jungle-rain-and-birds-2392.m4a'),
  sea_waves:          require('../assets/sounds/mixkit-sea-waves-on-a-rocky-shore-1190.m4a'),
  light_rain:         require('../assets/sounds/mixkit-light-rain-loop-2393.m4a'),
  breeze_trees:       require('../assets/sounds/mixkit-breeze-through-the-trees-2427.m4a'),
  river_flow:         require('../assets/sounds/mixkit-water-flowing-ambience-loop-3126.m4a'),
  singing_bowl_deep:  require('../assets/sounds/singing-bowl-deep.m4a'),
  tibetan_bowl:       require('../assets/sounds/tibetan-bowl.m4a'),
  morning_birds:      require('../assets/sounds/morning-birds-loop.m4a'),
  spring_birds:       require('../assets/sounds/spring-birds-morning.m4a'),
  forest_birds_spring:require('../assets/sounds/forest-birds-spring.m4a'),
  morning_flute:      require('../assets/sounds/morning-flute.m4a'),
  sitar_morning:      require('../assets/sounds/sitar-morning.m4a'),
  healing_bells_432:  require('../assets/sounds/432hz-healing-bells.m4a'),
  wanderlust_breeze:  require('../assets/sounds/wanderlust-breeze.m4a'),
  forest_campfire:    require('../assets/sounds/forest-campfire.m4a'),
  indian_beats:       require('../assets/sounds/indian-beats.m4a'),
};


const ALARM_SOUND_BUNDLED_IMAGES: Record<string, any> = {
  lalitha: require('../assets/images/mata-lalitha.jpg'),
};

const ALARM_SOUND_META: Record<string, { label: string; icon: string; color: string }> = {
  forest_birds:        { label: 'Forest Birds',         icon: '🐦', color: '#34d399' },
  sea_waves:           { label: 'Sea Waves',             icon: '🌊', color: '#38bdf8' },
  light_rain:          { label: 'Light Rain',            icon: '🌦️', color: '#60a5fa' },
  breeze_trees:        { label: 'Forest Breeze',         icon: '🌿', color: '#4ade80' },
  river_flow:          { label: 'Flowing Water',          icon: '🏞️', color: '#38bdf8' },
  morning_birds:       { label: 'Morning Birds',         icon: '🌅', color: '#fbbf24' },
  spring_birds:        { label: 'Spring Birds',          icon: '🌸', color: '#f472b6' },
  forest_birds_spring: { label: 'Forest Birds',           icon: '🌲', color: '#4ade80' },
  forest_campfire:     { label: 'Forest Campfire',       icon: '🔥', color: '#f97316' },
  wanderlust_breeze:   { label: 'Wanderlust Breeze',      icon: '�️', color: '#67e8f9' },
  singing_bowl_deep:   { label: 'Deep Singing Bowl',      icon: '🔮', color: '#a78bfa' },
  tibetan_bowl:        { label: 'Tibetan Bowl',          icon: '🕌', color: '#c4b5fd' },
  morning_flute:       { label: 'Light Meditation Tone', icon: '🎶', color: '#6ee7b7' },
  sitar_morning:       { label: 'Calm Raga',             icon: '🎵', color: '#f59e0b' },
  healing_bells_432:   { label: '432 Hz Bells',          icon: '🔔', color: '#fde68a' },
  indian_beats:        { label: 'Indian Beats',           icon: '🥁', color: '#fb923c' },
  gayatri:             { label: 'Gayatri Mantra',        icon: '🌞', color: '#fbbf24' },
  lalitha:             { label: 'Lalitha Sahasranama',   icon: '🌺', color: '#f472b6' },
  shivtandav:          { label: 'Shiv Tandav',           icon: '🔱', color: '#60a5fa' },
  bhagya_suktam:       { label: 'Bhagya Suktam',         icon: '🌟', color: '#fbbf24' },
  shiv_sankalpa_suktam:{ label: 'Shiv Sankalpa Suktam',  icon: '🕉️', color: '#c4b5fd' },
  fusion:              { label: 'Fusion Wake',           icon: '✨', color: '#fbbf24' },
};

const { width, height } = Dimensions.get('window');
const pad = (n: number) => String(n).padStart(2, '0');
const fmtTime = () => {
  const now = new Date();
  const h = now.getHours(); const m = now.getMinutes();
  const p = h < 12 ? 'AM' : 'PM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${pad(h12)}:${pad(m)} ${p}`;
};

// Snooze options (minutes)
const SNOOZE_OPTIONS = [5, 10, 20];

export default function AlarmRingingScreen() {
  const router = useRouter();
  const [ms, setMs] = useState<MissionSettings>(DEFAULT_MISSION_SETTINGS);
  const [userName, setUserName] = useState('Champion');
  const [timeStr, setTimeStr] = useState(fmtTime());
  const [bgImageSource, setBgImageSource] = useState<any>(null);
  const [soundMeta,     setSoundMeta]     = useState<{ label: string; icon: string; color: string }>({ label: '', icon: '🕉️', color: '#fbbf24' });
  const [showSnoozeModal, setShowSnoozeModal] = useState(false);
  const [snoozeCountdown, setSnoozeCountdown] = useState<number | null>(null);
  const [snoozedFor, setSnoozedFor] = useState<number | null>(null);
  const [alarmStopped, setAlarmStopped] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const alarmStoppedRef = useRef(false);
  const missionStartedRef = useRef(false);
  const gentleWakeRef = useRef(false);
  const rampMinutesRef = useRef(5);
  const appStateRef = useRef(AppState.currentState);
  const { stopSound: stopAmbientSound, dismissMoodSheet } = useSoundPlayer();

  // ── Audio helpers ──────────────────────────────────────────────────────────
  const stopWakeAudio = async () => {
    cancelVolumeRamp();
    cancelFusion();
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    } catch { /* ignore */ }
  };

  const playWakeAudio = async (uri: string | null, bundledAsset?: any) => {
    await preemptActiveAlarm();
    await stopActivePreview();
    setActiveAlarmSoundRef(soundRef);
    await stopWakeAudio();
    // Silence the native AlarmSoundService MediaPlayer — JS audio takes over from here.
    // Native service keeps running for wake lock / fullScreen notification, but its
    // audio output is muted so we never get two mantras playing simultaneously.
    await setNativeAlarmVolume(0).catch(() => {});
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
        interruptionModeIOS: 1,
        interruptionModeAndroid: 1,
      });
      const source = bundledAsset ?? (uri ? { uri } : require('../assets/sounds/mantra_alarm.wav'));
      const { sound } = await Audio.Sound.createAsync(
        source,
        { shouldPlay: true, isLooping: true, volume: 1.0 },
      );
      soundRef.current = sound;
    } catch {
      try {
        const { sound } = await Audio.Sound.createAsync(
          require('../assets/sounds/mantra_alarm.wav'),
          { shouldPlay: true, isLooping: true, volume: 1.0 },
        );
        soundRef.current = sound;
      } catch (e2) { console.warn('[AlarmRinging] Wake audio fallback error:', e2); }
    }
  };

  // ── Animations ──────────────────────────────────────────────────────────────
  const outerScale = useSharedValue(1);
  const outerOpacity = useSharedValue(0.35);
  const innerScale = useSharedValue(1);
  const shakeX = useSharedValue(0);
  const btnScale = useSharedValue(1);

  const outerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: outerScale.value }],
    opacity: outerOpacity.value,
  }));
  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: innerScale.value }],
  }));
  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));
  const btnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: btnScale.value }],
  }));

  useEffect(() => {
    outerScale.value = withRepeat(
      withSequence(withTiming(1.30, { duration: 1200, easing: Easing.inOut(Easing.ease) }), withTiming(1, { duration: 1200 })), -1,
    );
    outerOpacity.value = withRepeat(
      withSequence(withTiming(0.8, { duration: 1200 }), withTiming(0.20, { duration: 1200 })), -1,
    );
    innerScale.value = withRepeat(
      withSequence(withTiming(1.12, { duration: 900 }), withTiming(1, { duration: 900 })), -1,
    );
    // Pulse the CTA button
    btnScale.value = withRepeat(
      withSequence(withTiming(1.05, { duration: 700 }), withTiming(1, { duration: 700 })), -1,
    );
  }, []);

  // Shake effect when user tries to dismiss improperly
  const triggerShake = () => {
    shakeX.value = withSequence(
      withTiming(-12, { duration: 60 }),
      withTiming(12, { duration: 60 }),
      withTiming(-8, { duration: 60 }),
      withTiming(8, { duration: 60 }),
      withTiming(0, { duration: 60 }),
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  };

  // ── Sync alarmStopped → ref so setTimeout callbacks read it without stale closure ──
  useEffect(() => { alarmStoppedRef.current = alarmStopped; }, [alarmStopped]);

  // ── Phase 4: Dismiss native overlay the moment this screen mounts ──────────
  // AlarmSoundService drew a TYPE_APPLICATION_OVERLAY window ~50 ms after the
  // alarm fired so the screen was covered before React Native finished loading.
  // Now that the proper UI is visible, remove the placeholder.
  useEffect(() => { dismissAlarmOverlay().catch(() => {}); }, []);

  // ── Keep screen awake ───────────────────────────────────────────────────────
  useEffect(() => {
    activateKeepAwakeAsync('alarm-ringing');
    return () => { deactivateKeepAwake('alarm-ringing'); };
  }, []);

  // ── Silence ambient sound player when alarm starts ──────────────────────────
  useEffect(() => {
    stopAmbientSound(false).catch(() => {});
    dismissMoodSheet();
  }, []);

  // ── Clock ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setTimeStr(fmtTime()), 15_000);
    return () => clearInterval(t);
  }, []);

  // ── BLOCK hardware back button completely ───────────────────────────────────
  // Note: MainActivity.kt also overrides dispatchKeyEvent natively as a second
  // layer of defence. This JS handler is the first layer.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!alarmStopped) {
        // Native vibration runs in JVM — no restart needed. Just shake the UI.
        triggerShake();
        return true; // blocks back — MainActivity also swallows it natively
      }
      return false;
    });
    return () => sub.remove();
  }, [alarmStopped]);

  // ── Re-open screen if user presses HOME ─────────────────────────────────────
  // Android 14+ blocks startActivity from background services, so the native
  // bringToFrontRunnable no longer works reliably. Instead we fire an immediate
  // notifee notification with fullScreenAction, which auto-relaunches the
  // alarm activity on top of whatever the user is doing — no sound disruption.
  const bttfNotifIdRef = useRef<string | null>(null);

  useEffect(() => {
    const fireBttfNotif = async () => {
      if (Platform.OS !== 'android') return;
      try {
        // Create a silent channel so the notification does NOT play a sound
        // (using 'arise-alarms' plays mantra_alarm.wav which interrupts the looping audio)
        await notifee.createChannel({
          id: 'alarm-bttf-silent',
          name: 'Alarm Return Prompt',
          importance: AndroidImportance.HIGH,
        });
        const id = await notifee.displayNotification({
          id: 'alarm-bttf',
          title: '⏰ Alarm Ringing!',
          body: 'Return to complete your mission and stop the alarm.',
          android: {
            channelId: 'alarm-bttf-silent',
            importance: AndroidImportance.HIGH,
            category: AndroidCategory.ALARM,
            visibility: AndroidVisibility.PUBLIC,
            ongoing: true,
            asForegroundService: false,
            fullScreenAction: {
              id: 'default',
              launchActivity: 'default',
            },
            pressAction: { id: 'default', launchActivity: 'default' },
          },
        });
        bttfNotifIdRef.current = id ?? 'alarm-bttf';
      } catch (e) { console.warn('[AlarmRinging] bttf notif error:', e); }
    };

    const cancelBttfNotif = () => {
      notifee.cancelNotification(bttfNotifIdRef.current ?? 'alarm-bttf').catch(() => {});
      bttfNotifIdRef.current = null;
    };

    const sub = AppState.addEventListener('change', (nextState) => {
      if (
        !alarmStopped &&
        appStateRef.current === 'active' &&
        (nextState === 'background' || nextState === 'inactive')
      ) {
        appStateRef.current = nextState;
        fireBttfNotif();
      } else if (
        !alarmStopped &&
        (appStateRef.current === 'background' || appStateRef.current === 'inactive') &&
        nextState === 'active'
      ) {
        appStateRef.current = nextState;
        cancelBttfNotif();
        // Native vibration continues uninterrupted in the JVM service — no restart needed.
        triggerShake();
      } else {
        appStateRef.current = nextState;
      }
    });
    return () => {
      sub.remove();
      cancelBttfNotif();
    };
  }, [alarmStopped]);

  // ── Snooze countdown timer ──────────────────────────────────────────────────
  useEffect(() => {
    if (snoozedFor === null) return;
    let secondsLeft = snoozedFor * 60;
    setSnoozeCountdown(secondsLeft);
    const interval = setInterval(async () => {
      secondsLeft -= 1;
      setSnoozeCountdown(secondsLeft);
      if (secondsLeft <= 0) {
        clearInterval(interval);
        setSnoozedFor(null);
        setSnoozeCountdown(null);
        // Re-trigger alarm sounds when snooze ends — restore native volume + vibration
        await setNativeAlarmVolume(1.0);
        startAlarmVibration();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [snoozedFor]);

  // ── Bootstrap ───────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await store.getJSON<MissionSettings>(KEYS.missionSettings);
      const settings = saved ? { ...DEFAULT_MISSION_SETTINGS, ...saved } : DEFAULT_MISSION_SETTINGS;
      if (cancelled) return;
      setMs(settings);

      const dosha = await store.getJSON<{ name?: string }>(KEYS.dosha);
      const name = dosha?.name ?? 'Champion';
      if (cancelled) return;
      setUserName(name);

      const alarmCfg = await store.getJSON<AlarmSettings>(KEYS.alarmSettings);
      const mantraId = alarmCfg?.selectedMantraId ?? 'gayatri';
      const meta = ALARM_SOUND_META[mantraId] ?? { label: 'Sacred Sound', icon: '🕉️', color: '#fbbf24' };
      const bgSrc = ALARM_SOUND_BUNDLED_IMAGES[mantraId]
        ?? (SOUND_IMAGES[mantraId] ? { uri: SOUND_IMAGES[mantraId] } : null);
      if (!cancelled) { setSoundMeta(meta); setBgImageSource(bgSrc); }
      const useGentle = alarmCfg?.gentleWake ?? false;
      const rampMins = alarmCfg?.rampMinutes ?? 5;
      gentleWakeRef.current = useGentle;
      rampMinutesRef.current = rampMins;

      // ── Play correct mantra / nature / gentle / fusion audio via JS layer ───
      if (!cancelled) {
        if (mantraId === 'fusion') {
          // Fusion path: 5-phase cross-fade sequence (nature → birds → sitar → mantra → flute)
          await playFusionAlarm(soundRef, 'gayatri', useGentle, rampMins);
        } else if (useGentle) {
          // Gentle path: starts at 5 % volume and ramps up
          await playGentleAlarmAudio(soundRef, mantraId, rampMins);
        } else {
          const wakeSound = WAKE_SOUNDS.find(s => s.id === mantraId) ?? WAKE_SOUNDS[0];
          // Prefer bundledAsset (nature .m4a) over bundledKey (mantra mp3) over CDN
          const bundledAsset = wakeSound.bundledAsset ?? BUNDLED_MANTRA_ASSETS[mantraId] ?? BUNDLED_NATURE_ASSETS[mantraId];
          const localPath = getLocalMantraPath(mantraId);
          const localInfo = await FileSystem.getInfoAsync(localPath).catch(() => ({ exists: false }));
          const audioSrc: string | null = bundledAsset ? null
            : (localInfo as any).exists ? (localInfo as any).uri
            : (wakeSound.audioUrl ?? null);
          await playWakeAudio(audioSrc, bundledAsset);
        }
      }

      // ── Native AlarmSoundService stays alive DURING alarm ─────────
      // It is stopped in stopAlarmCompletely() right before navigating
      // to the mission screen. JS audio (__missionBgSound) takes over.

      if (settings.bodhiMorningBrief && !cancelled) {
        const mission = MISSIONS.find(m => m.id === settings.selectedMission);
        const mantraLabel =
          mantraId === 'lalitha'              ? 'Lalitha Sahasranama' :
          mantraId === 'shivtandav'           ? 'Shiv Tandav' :
          mantraId === 'bhagya_suktam'        ? 'Bhagya Suktam' :
          mantraId === 'shiv_sankalpa_suktam' ? 'Shiv Sankalpa Suktam' : 'Gayatri Mantra';
        const hour = new Date().getHours();
        const kalaLine = hour < 10 ? 'the golden morning window is open' : "it's time to lock in";
        const script =
          `Good morning ${name}. It's ${fmtTime()}, ${kalaLine}. Your ${mantraLabel} is playing. ` +
          `Mission today: ${mission?.name}. You're on a ${settings.streak || 1}-day streak — don't break it now. ` +
          `${mission?.hype} Let's go.`;
        // Mantra stays at full volume — both alarm and Bodhi play simultaneously
        speakBodhi(script).then(async () => {
          if (cancelled) return;
          // speakBodhi sets shouldDuckAndroid:true globally — restore alarm audio mode
          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: true,
            shouldDuckAndroid: false,
            interruptionModeIOS: 1,
            interruptionModeAndroid: 1,
          }).catch(() => {});
        }).catch(async () => {
          // TTS failed — restore audio mode so alarm is never affected
          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: true,
            shouldDuckAndroid: false,
            interruptionModeIOS: 1,
            interruptionModeAndroid: 1,
          }).catch(() => {});
        });
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      // Vibration is already running from AlarmSoundService.startAlarmVibration() — no JS call needed.
    })();
    return () => {
      cancelled = true;
      cancelVolumeRamp();
      cancelFusion();
      stopBodhi();
      stopWakeAudio();
    };
  }, []);

  const mission = MISSIONS.find(m => m.id === ms.selectedMission) ?? MISSIONS[4];
  const hour = new Date().getHours();
  const kala = getKalaMessage(hour);
  const today = new Date().getDay();
  const quote = WAKE_QUOTES[today % WAKE_QUOTES.length];

  // ── STOP ALARM completely (mission started) ─────────────────────────────────
  const stopAlarmCompletely = async () => {
    setAlarmStopped(true);
    stopBodhi();
    // Transfer JS audio to mission screen so mantra keeps playing until mission
    // is fully completed. Setting soundRef to null prevents the unmount cleanup
    // from stopping the sound prematurely.
    if (soundRef.current) {
      (global as any).__missionBgSound = soundRef.current;
      soundRef.current = null;
    }
    // Mute native AlarmSoundService audio but KEEP the service running.
    // alarm_fired_pending stays true → isAlarmActive() = true in MainActivity
    // → onUserLeaveHint + lifecycle watchdog keep blocking HOME on mission screen.
    // The service (and both watchdogs) are stopped in mission.tsx handleComplete().
    await setNativeAlarmVolume(0).catch(() => {});
    stopAlarmVibration();
  };

  // ── START MISSION ───────────────────────────────────────────────────────────
  const handleStart = async () => {
    if (missionStartedRef.current) return;
    missionStartedRef.current = true;

    const user = auth.currentUser;
    if (user) {
      const now = new Date();
      saveHabitLog({
        habitId: 'wake_early', habitName: 'Wake Early', userId: user.uid,
        date: todayStr(), status: 'done',
        wakeTime: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
      }).catch(() => {});
    }

    // Record wake time & update sunrise streak
    try {
      const loc = await store.getJSON<{ lat: number; lon: number }>(KEYS.location);
      if (loc?.lat && loc?.lon) {
        const solar = await getSolarTimes(loc.lat, loc.lon);
        await recordWake(solar.sunrise);
      } else {
        await recordWake(6.25); // fallback ~6:15 AM
      }
    } catch { /* non-blocking */ }

    await stopAlarmCompletely();
    await AsyncStorage.setItem('onesutra_mission_active_v1', mission.id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace(`/mission?id=${mission.id}` as never);
  };

  // ── SNOOZE ──────────────────────────────────────────────────────────────────
  const handleSnoozeChoice = async (minutes: number) => {
    setShowSnoozeModal(false);
    setSnoozedFor(minutes);
    // Duck native alarm audio and vibration during snooze (service stays alive)
    await setNativeAlarmVolume(0.08);
    stopAlarmVibration();
    stopBodhi();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  // Snooze countdown display
  const fmtCountdown = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${pad(m)}:${pad(sec)}`;
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <ImageBackground
      source={bgImageSource ?? undefined}
      style={S.screen}
      imageStyle={{ opacity: 0.65 }}
    >
      {/* Dark gradient overlay */}
      <LinearGradient
        colors={['rgba(4,4,16,0.75)', 'rgba(4,4,16,0.22)', 'rgba(4,4,16,0.88)']}
        style={StyleSheet.absoluteFillObject}
      />
      <StatusBar hidden />

      {/* ── Full-screen ambient glow ── */}
      <View style={[S.ambientGlow, { backgroundColor: mission.color + '12' }]} pointerEvents="none" />
      <View style={[S.ambientGlowBottom, { backgroundColor: mission.color + '08' }]} pointerEvents="none" />

      {/* ── TOP SECTION: Sound chip + Orb + Time ── */}
      <View style={S.topSection}>
        {/* Now playing chip */}
        <View style={[S.soundChip, { borderColor: soundMeta.color + '55', backgroundColor: soundMeta.color + '18' }]}>
          <View style={[S.liveDot, { backgroundColor: soundMeta.color }]} />
          <Text style={{ fontSize: 13 }}>{soundMeta.icon}</Text>
          <Text style={[S.soundChipLabel, { color: soundMeta.color }]}>{soundMeta.label || 'Now Playing'}</Text>
        </View>

        {/* Pulsing orb — shows sound icon */}
        <View style={S.ringWrap} pointerEvents="none">
          <Animated.View style={[S.outerRing, outerStyle, { borderColor: soundMeta.color + '45' }]} />
          <Animated.View style={[S.midRing, { borderColor: soundMeta.color + '25' }]} />
          <Animated.View style={[S.innerCircle, innerStyle, { backgroundColor: soundMeta.color + '1A', borderColor: soundMeta.color + '45' }]}>
            <Text style={S.ringIcon}>{soundMeta.icon || '🕉️'}</Text>
          </Animated.View>
        </View>

        {/* Time */}
        <Text style={S.time}>{timeStr}</Text>
        <Text style={[S.kala, { color: soundMeta.color }]}>{kala.toUpperCase()}</Text>

        {/* Streak pill */}
        {snoozedFor === null && (
          <View style={[S.streakPill, { borderColor: mission.color + '40', backgroundColor: mission.color + '12' }]}>
            <Text style={{ fontSize: 13 }}>🔥</Text>
            <Text style={{ fontSize: 12, fontWeight: '800', color: mission.color }}>
              {userName} · Day {ms.streak || 1}
            </Text>
          </View>
        )}
      </View>

      {/* ── SNOOZE ACTIVE VIEW ── */}
      {snoozedFor !== null && snoozeCountdown !== null && (
        <View style={S.snoozeActiveView}>
          <Text style={S.snoozeActiveLabel}>SNOOZED — RESUMES IN</Text>
          <Text style={[S.snoozeActiveTimer, { color: mission.color }]}>{fmtCountdown(snoozeCountdown)}</Text>
          <Text style={S.snoozeActiveNote}>Mission challenge starts when alarm resumes.</Text>
        </View>
      )}

      {/* ── BOTTOM SECTION: Mission + CTA ── */}
      {snoozedFor === null && (
        <View style={S.bottomSection}>
          {/* Mission row — compact */}
          <Animated.View style={shakeStyle}>
            <View style={[S.missionRow, { borderColor: mission.color + '40', backgroundColor: mission.color + '0A' }]}>
              <Text style={{ fontSize: 30 }}>{mission.icon}</Text>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={[S.missionBadge, { color: mission.color + 'AA' }]}>TODAY'S MISSION</Text>
                <Text style={S.missionName}>{mission.name}</Text>
                <Text style={S.missionTagline}>{mission.tagline}</Text>
              </View>
            </View>
          </Animated.View>

          {/* CTA — premium begin-your-day button */}
          <Animated.View style={[btnStyle, { width: '100%', marginTop: 16 }]}>
            <TouchableOpacity
              style={[S.ctaBtn, { backgroundColor: mission.color, shadowColor: mission.color }]}
              onPress={handleStart}
              activeOpacity={0.88}
            >
              <Text style={S.ctaIcon}>☀️</Text>
              <View style={{ marginLeft: 10 }}>
                <Text style={S.ctaTitle}>Begin Your Day</Text>
                <Text style={S.ctaSub}>tap to stop alarm · start mission</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* Snooze */}
          <TouchableOpacity style={S.snoozeBtn} onPress={() => setShowSnoozeModal(true)} activeOpacity={0.75}>
            <Text style={S.snoozeBtnText}>💤  Snooze</Text>
          </TouchableOpacity>

          {/* Lock badge */}
          <View style={S.lockBadge}>
            <Text style={S.lockText}>🔒  Can't close · complete mission or snooze</Text>
          </View>
        </View>
      )}

      {/* ── Snooze picker modal ── */}
      <Modal visible={showSnoozeModal} transparent animationType="slide">
        <View style={S.modalOverlay}>
          <View style={[S.snoozeSheet, { borderColor: mission.color + '30' }]}>
            <View style={S.sheetHandle} />
            <Text style={S.snoozeSheetTitle}>💤  Snooze</Text>
            <Text style={S.snoozeSheetSub}>
              Your streak is at risk.{'\n'}
              Mission stays when alarm resumes.
            </Text>
            <View style={{ gap: 10, marginTop: 8 }}>
              {SNOOZE_OPTIONS.map(min => (
                <TouchableOpacity
                  key={min}
                  style={[S.snoozeOption, { borderColor: mission.color + '50' }]}
                  onPress={() => handleSnoozeChoice(min)}
                  activeOpacity={0.82}
                >
                  <View>
                    <Text style={S.snoozeOptionMin}>{min} min</Text>
                    <Text style={[S.snoozeOptionLabel, { color: mission.color }]}>Snooze</Text>
                  </View>
                  <Text style={{ fontSize: 18, color: mission.color + '80' }}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={S.snoozeCancelBtn} onPress={() => setShowSnoozeModal(false)}>
              <Text style={S.snoozeCancelText}>← Back to Mission</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ImageBackground>
  );
}

const S = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#040410' },
  ambientGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: height * 0.55, borderBottomLeftRadius: width, borderBottomRightRadius: width },
  ambientGlowBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: height * 0.45 },
  // Top section
  topSection: { flex: 0, alignItems: 'center', paddingTop: height * 0.08, paddingBottom: 16 },
  ringWrap: { alignItems: 'center', justifyContent: 'center', width: 220, height: 220, marginBottom: 16 },
  outerRing: { position: 'absolute', width: 220, height: 220, borderRadius: 110, borderWidth: 1.5 },
  midRing: { position: 'absolute', width: 160, height: 160, borderRadius: 80, borderWidth: 1 },
  innerCircle: { width: 100, height: 100, borderRadius: 50, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  ringIcon: { fontSize: 40 },
  time: { fontSize: 72, fontWeight: '100', color: '#FFFFFF', letterSpacing: -3 },
  kala: { fontSize: 9, fontWeight: '900', letterSpacing: 2, marginTop: 6, textAlign: 'center' },
  streakPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 6, marginTop: 12 },
  // Snooze active
  snoozeActiveView: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  snoozeActiveLabel: { fontSize: 9, fontWeight: '900', color: '#FFFFFF30', letterSpacing: 2, marginBottom: 8 },
  snoozeActiveTimer: { fontSize: 80, fontWeight: '100', letterSpacing: -4 },
  snoozeActiveNote: { fontSize: 12, color: '#FFFFFF35', marginTop: 12, textAlign: 'center', fontStyle: 'italic', lineHeight: 18 },
  // Bottom section
  bottomSection: { flex: 1, paddingHorizontal: 22, paddingBottom: 36, justifyContent: 'flex-end', gap: 0 },
  quote: { fontSize: 11, color: '#FFFFFF30', textAlign: 'center', lineHeight: 17, fontStyle: 'italic', paddingHorizontal: 12, marginBottom: 12 },
  missionCard: { borderWidth: 1, borderRadius: 22, padding: 18, gap: 10, marginBottom: 16 },
  missionBadge: { fontSize: 8, fontWeight: '900', letterSpacing: 2 },
  missionName: { fontSize: 18, fontWeight: '900', color: '#FFFFFF' },
  missionTagline: { fontSize: 11, color: '#FFFFFF60', lineHeight: 16, marginTop: 2 },
  missionChip: { borderWidth: 1, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 5, alignSelf: 'flex-start' },
  missionChipText: { fontSize: 10, fontWeight: '800' },
  stopBtn: { width: '100%', borderRadius: 99, paddingVertical: 20, alignItems: 'center' },
  stopBtnText: { fontSize: 16, fontWeight: '900', color: '#000000EA', letterSpacing: 0.2 },
  snoozeBtn: { width: '100%', borderRadius: 99, paddingVertical: 13, alignItems: 'center', marginTop: 10, borderWidth: 1, borderColor: '#FFFFFF18', backgroundColor: '#FFFFFF07' },
  snoozeBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF45' },
  lockBadge: { alignSelf: 'center', marginTop: 12, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: '#FFFFFF05', borderRadius: 99, borderWidth: 1, borderColor: '#FFFFFF0E' },
  lockText: { fontSize: 9, color: '#FFFFFF30', fontWeight: '700', letterSpacing: 0.3 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.80)', justifyContent: 'flex-end' },
  snoozeSheet: { backgroundColor: '#0C0C1C', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, padding: 24, paddingBottom: 44 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#FFFFFF20', alignSelf: 'center', marginBottom: 18 },
  snoozeSheetTitle: { fontSize: 22, fontWeight: '900', color: '#fff', marginBottom: 4 },
  snoozeSheetSub: { fontSize: 13, color: '#FFFFFF45', lineHeight: 20, marginBottom: 4 },
  snoozeOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 18, paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#FFFFFF06' },
  snoozeOptionMin: { fontSize: 20, fontWeight: '900', color: '#fff' },
  snoozeOptionLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5, marginTop: 2 },
  snoozeCancelBtn: { alignItems: 'center', paddingVertical: 16, marginTop: 6 },
  snoozeCancelText: { fontSize: 13, color: '#FFFFFF35', fontWeight: '700' },
  // Sound chip (now playing indicator)
  soundChip:      { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 7, marginBottom: 18 },
  liveDot:        { width: 7, height: 7, borderRadius: 3.5 },
  soundChipLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
  // Mission row
  missionRow:     { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 20, padding: 16, marginBottom: 0 },
  // Premium CTA
  ctaBtn:         { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 99, paddingVertical: 20, shadowOpacity: 0.50, shadowRadius: 22, shadowOffset: { width: 0, height: 6 }, elevation: 14 },
  ctaIcon:        { fontSize: 26 },
  ctaTitle:       { fontSize: 18, fontWeight: '900', color: '#000000EE', letterSpacing: 0.1 },
  ctaSub:         { fontSize: 10, fontWeight: '700', color: '#00000055', letterSpacing: 0.5, marginTop: 2 },
});
