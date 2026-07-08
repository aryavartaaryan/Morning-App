import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, BackHandler,
  StatusBar, AppState, Platform, NativeModules, ImageBackground,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, Easing, cancelAnimation,
} from 'react-native-reanimated';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import notifee, { AndroidImportance, AndroidCategory, AndroidVisibility } from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSoundPlayer } from '@/lib/soundPlayerContext';
import { playAlarmAudio, stopAlarmAudio } from '@/lib/alarmAudio';
import { WAKE_SOUNDS } from '@/lib/missionAlarm';
import { stopAlarmVibration, startNativeLockTask, stopNativeLockTask } from '@/lib/nativeAlarm';
import { SOUND_IMAGES } from '@/lib/sleepSoundsData';
import { getLocalSoundImageUri } from '@/lib/soundImagePreload';

const SOUNDBATH_FS_ID = 'soundbath-alarm-service';
const ACTIVE_SOUNDBATH_NOTIF_KEY = 'onesutra_active_soundbath_notif_v1';

const SOUND_ACCENT: Record<string, string> = {
  forest_birds: '#34d399', sea_waves: '#38bdf8', light_rain: '#60a5fa',
  breeze_trees: '#4ade80', river_flow: '#38bdf8', morning_birds: '#fbbf24',
  spring_birds: '#f472b6', forest_birds_spring: '#4ade80', forest_campfire: '#f97316',
  wanderlust_breeze: '#67e8f9', singing_bowl_deep: '#a78bfa', tibetan_bowl: '#c4b5fd',
  morning_flute: '#6ee7b7', sitar_morning: '#f59e0b', healing_bells_432: '#fde68a',
  indian_beats: '#fb923c', gayatri: '#fbbf24', lalitha: '#f472b6',
  shivtandav: '#60a5fa', bhagya_suktam: '#fbbf24', shiv_sankalpa_suktam: '#c4b5fd',
};

export default function SoundBathRingingScreen() {
  const router = useRouter();
  const { soundId: soundIdParam, label: labelParam } = useLocalSearchParams<{ soundId?: string; label?: string }>();
  const soundId = soundIdParam ?? 'morning_birds';
  const wakeSound = WAKE_SOUNDS.find(s => s.id === soundId) ?? WAKE_SOUNDS[0];
  const label = labelParam ?? wakeSound.label ?? 'Sound Bath';
  const accent = SOUND_ACCENT[soundId] ?? '#10b981';
  const bgImage = SOUND_IMAGES[soundId] ? getLocalSoundImageUri(SOUND_IMAGES[soundId]) : undefined;

  const [dismissed, setDismissed] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const bttfNotifIdRef = useRef<string | null>(null);
  // Prevent setState after unmount — avoids JS thread stall on long-ringing screens
  const isMountedRef = useRef(true);
  // JS audio health watchdog interval handle
  const watchdogRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { stopSound: stopAmbientSound, dismissMoodSheet } = useSoundPlayer();

  // ── Animations ────────────────────────────────────────────────────────────
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

  // ── Pin screen immediately on mount (Lock Task Mode) ────────────────────────
  useEffect(() => {
    startNativeLockTask().catch(() => {});
  }, []);

  // ── Keep awake + native wake lock ──────────────────────────────────────────
  useEffect(() => {
    activateKeepAwakeAsync('soundbath');
    if (Platform.OS === 'android') {
      NativeModules.HabitAlarmModule?.acquireWakeLock?.().catch?.(() => {});
    }
    return () => {
      // Mark unmounted so all future async callbacks skip setState
      isMountedRef.current = false;
      // Cancel watchdog to prevent zombie interval
      if (watchdogRef.current !== null) {
        clearInterval(watchdogRef.current);
        watchdogRef.current = null;
      }
      deactivateKeepAwake('soundbath');
      if (Platform.OS === 'android') {
        NativeModules.HabitAlarmModule?.releaseWakeLock?.().catch?.(() => {});
      }
    };
  }, []);

  // ── Silence ambient + mood sheet ─────────────────────────────────────────────
  useEffect(() => {
    stopAmbientSound(false).catch(() => {});
    dismissMoodSheet();
  }, []);

  // ── Mute native HabitAlarmSoundService so JS audio takes over ─────────────
  // We only mute volume and dismiss the native overlay — we do NOT call
  // stopHabitAlarmSound here. The native service must stay alive so that
  // isAlarmActive() = true, which powers the Home / Back button watchdogs
  // and keeps the screen protected without any OS "Okay to pin" dialog.
  useEffect(() => {
    NativeModules.HabitAlarmModule?.setHabitAlarmVolume?.(0).catch?.(() => {});
    NativeModules.HabitAlarmModule?.dismissHabitAlarmOverlay?.().catch?.(() => {});
    stopAlarmVibration().catch(() => {});
  }, []);

  // ── Play the selected sound bath sound ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (cancelled) return;
        await playAlarmAudio(soundRef, soundId);
        // Ensure sound is playing after a short delay
        setTimeout(() => {
          if (!cancelled && soundRef.current) {
            soundRef.current.getStatusAsync().then((status: any) => {
              if (status?.isLoaded && !status?.isPlaying) {
                soundRef.current?.playAsync().catch(() => {});
              }
            }).catch(() => {});
          }
        }, 500);
      } catch (e) { console.warn('[SoundBath] audio:', e); }
    })();
    return () => { cancelled = true; stopAlarmAudio(soundRef); };
  }, [soundId]);

  // ── JS audio health watchdog ────────────────────────────────────────────
  // expo-av can lose audio focus after a phone call, another app claiming
  // AUDIOFOCUS_GAIN, or an OS audio session interruption. Without this,
  // the screen stays visible but goes silent — appearing frozen/broken.
  // This runs every 30 s (lightweight) and resumes playback if needed.
  useEffect(() => {
    watchdogRef.current = setInterval(async () => {
      if (!isMountedRef.current || !soundRef.current) return;
      try {
        const status = await soundRef.current.getStatusAsync();
        if ((status as any)?.isLoaded && !(status as any)?.isPlaying) {
          console.warn('[SoundBath] watchdog: audio stopped — resuming');
          // Re-claim audio focus then resume
          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: true,
            shouldDuckAndroid: false,
            interruptionModeIOS: 1,
            interruptionModeAndroid: 1,
          });
          await soundRef.current.playAsync().catch(() => {});
        }
      } catch { /* sound may have been unloaded — ignore */ }
    }, 30_000);
    return () => {
      if (watchdogRef.current !== null) {
        clearInterval(watchdogRef.current);
        watchdogRef.current = null;
      }
    };
  }, [soundId]);

  // ── Foreground service (Android) ─────────────────────────────────────────────
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    let started = false;
    (async () => {
      try {
        await notifee.createChannel({
          id: 'arise-soundbath', name: 'Nada Sound Bath',
          importance: AndroidImportance.HIGH, bypassDnd: true,
          visibility: AndroidVisibility.PUBLIC,
        } as any);
        await notifee.displayNotification({
          id: SOUNDBATH_FS_ID,
          title: `${wakeSound.icon}  ${label}`,
          body: 'Sound Bath is playing · tap to return.',
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
        AsyncStorage.getItem(ACTIVE_SOUNDBATH_NOTIF_KEY).then(nid => {
          if (!nid) return;
          notifee.cancelNotification(nid).catch(() => {});
          notifee.cancelTriggerNotification(nid).catch(() => {});
          AsyncStorage.removeItem(ACTIVE_SOUNDBATH_NOTIF_KEY).catch(() => {});
        }).catch(() => {});
      } catch (e) { console.warn('[SoundBath] fg service:', e); }
    })();
    return () => { if (started) notifee.cancelNotification(SOUNDBATH_FS_ID).catch(() => {}); };
  }, []);

  // ── Back button: blocked — must finish listening ─────────────────────────────
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

  // ── Re-open when HOME pressed ────────────────────────────────────────────────
  useEffect(() => {
    if (dismissed) return;
    const BTTF = 'soundbath-bttf';
    const fireBttf = async () => {
      if (Platform.OS !== 'android') return;
      try {
        await notifee.createChannel({ id: 'alarm-bttf-silent', name: 'Alarm Return Prompt', importance: AndroidImportance.HIGH });
        await notifee.displayNotification({
          id: BTTF, title: `${wakeSound.icon}  Sound Bath Playing`, body: 'Tap to return.',
          android: { channelId: 'alarm-bttf-silent', importance: AndroidImportance.HIGH, category: AndroidCategory.ALARM, visibility: AndroidVisibility.PUBLIC, ongoing: true, asForegroundService: false, fullScreenAction: { id: 'default', launchActivity: 'default' }, pressAction: { id: 'default', launchActivity: 'default' } } as any,
        });
        bttfNotifIdRef.current = BTTF;
      } catch {}
    };
    const cancelBttf = () => { notifee.cancelNotification(bttfNotifIdRef.current ?? BTTF).catch(() => {}); notifee.cancelNotification(BTTF).catch(() => {}); bttfNotifIdRef.current = null; };
    const ensureAudioPlaying = async () => {
      try {
        if (soundRef.current) {
          const status = await soundRef.current.getStatusAsync();
          if (status?.isLoaded && !status?.isPlaying) {
            await soundRef.current.playAsync();
          }
        }
      } catch (e) {
        console.warn('[SoundBath] Audio resume error:', e);
      }
    };
    const sub = AppState.addEventListener('change', next => {
      if (!dismissed && appStateRef.current === 'active' && (next === 'background' || next === 'inactive')) { appStateRef.current = next; fireBttf(); ensureAudioPlaying(); }
      else if (!dismissed && (appStateRef.current === 'background' || appStateRef.current === 'inactive') && next === 'active') { appStateRef.current = next; cancelBttf(); ensureAudioPlaying(); }
      else { appStateRef.current = next; }
    });
    return () => { sub.remove(); cancelBttf(); };
  }, [dismissed]);

  const handleDismiss = async () => {
    setDismissed(true);
    // Stop watchdog immediately before cleanup to prevent interference
    if (watchdogRef.current !== null) { clearInterval(watchdogRef.current); watchdogRef.current = null; }
    await stopAlarmAudio(soundRef);
    // Await stopHabitAlarmSound so isAlarmActive() = false BEFORE stopNativeLockTask
    // and BEFORE the 350 ms onWindowFocusChanged watchdog can fire.
    try { await NativeModules.HabitAlarmModule?.stopHabitAlarmSound?.(); } catch { /* ignore */ }
    // Exit lock task mode (screen pinning) — without this the app stays pinned
    // and the user cannot press HOME or close the app after the soundbath ends.
    await stopNativeLockTask();
    stopAlarmVibration().catch(() => {});
    notifee.cancelNotification(SOUNDBATH_FS_ID).catch(() => {});
    notifee.cancelNotification(bttfNotifIdRef.current ?? 'soundbath-bttf').catch(() => {});
    notifee.cancelNotification('soundbath-bttf').catch(() => {});
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace('/(tabs)' as never);
  };

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
      // Guard: don't setState if unmounted
      if (isMountedRef.current) setTimeStr(fmtTime());
    }, 15_000);
    return () => clearInterval(t);
  }, []);

  return (
    <ImageBackground
      source={bgImage ? { uri: bgImage } : undefined}
      style={S.screen}
      imageStyle={{ opacity: 0.68 }}
    >
      {/* Full-screen touch interceptor — blocks center/right nav buttons from closing screen */}
      <View style={StyleSheet.absoluteFillObject} />

      <StatusBar hidden />

      {/* Dark gradient overlay — heavier at top & bottom so text is readable */}
      <LinearGradient
        colors={['rgba(0,0,0,0.72)', 'rgba(0,0,0,0.10)', 'rgba(0,0,0,0.10)', 'rgba(0,0,0,0.88)']}
        locations={[0, 0.18, 0.55, 1]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      {/* Subtle ambient colour wash matching the accent */}
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

      {/* ── CENTER: pulsing orb (non-interactive) ── */}
      <View style={S.orbWrap} pointerEvents="none">
        <Animated.View style={[S.outerRing, outerStyle, { borderColor: accent + '40' }]} />
        <View style={[S.midRing, { borderColor: accent + '20' }]} />
        <Animated.View style={[S.innerCircle, innerStyle, { backgroundColor: accent + '18', borderColor: accent + '50' }]}>
          <Text style={S.orbIcon}>{wakeSound.icon}</Text>
        </Animated.View>
      </View>

      {/* ── BOTTOM: category hint + finish button ── */}
      <View style={S.bottomArea}>
        <Text style={[S.categoryHint, { color: accent + 'BB' }]}>
          {wakeSound.category === 'mantra' ? '🕉  Mantra  ·  Sound Bath' : '🌿  Ambient  ·  Sound Bath'}
        </Text>

        <Animated.View style={[{ width: '100%' }, btnStyle]}>
          <TouchableOpacity
            style={[S.dismissBtn, { shadowColor: accent }]}
            onPress={handleDismiss}
            activeOpacity={0.84}
          >
            <LinearGradient
              colors={[accent + '55', accent + '30']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFillObject, { borderRadius: 24 }]}
            />
            <Text style={S.dismissIcon}>✦</Text>
            <View style={{ marginLeft: 10 }}>
              <Text style={S.dismissTxt}>Finish Listening</Text>
              <Text style={S.dismissSub}>tap to stop sound · close</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* Lock indicator — mirrors habit alarm locked state */}
        <View style={S.lockBar}>
          <Text style={S.lockBarTxt}>🔒  Dismiss only by tapping above</Text>
        </View>
      </View>
    </ImageBackground>
  );
}

const S = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: '#02040C' },
  ambientGlow:  { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },

  // Top
  topArea:      { paddingTop: 54, alignItems: 'center', gap: 10 },
  chip:         { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 99, paddingHorizontal: 16, paddingVertical: 8 },
  liveDot:      { width: 7, height: 7, borderRadius: 3.5 },
  chipLabel:    { fontSize: 13, fontWeight: '800', letterSpacing: 0.4 },
  clockText:    { fontSize: 64, fontWeight: '100', color: '#FFFFFF', letterSpacing: -2.5 },

  // Center orb
  orbWrap:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
  outerRing:    { position: 'absolute', width: 220, height: 220, borderRadius: 110, borderWidth: 1.5 },
  midRing:      { position: 'absolute', width: 160, height: 160, borderRadius: 80, borderWidth: 1 },
  innerCircle:  { width: 110, height: 110, borderRadius: 55, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  orbIcon:      { fontSize: 44 },

  // Bottom
  bottomArea:   { paddingHorizontal: 26, paddingBottom: 48, alignItems: 'center', gap: 14 },
  categoryHint: { fontSize: 10, fontWeight: '800', letterSpacing: 1.8 },
  dismissBtn:   {
    width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 24, paddingVertical: 22, overflow: 'hidden',
    shadowOpacity: 0.45, shadowRadius: 24, elevation: 12, shadowOffset: { width: 0, height: 6 },
  },
  dismissIcon:  { fontSize: 20, color: '#FFFFFFEE' },
  dismissTxt:   { fontSize: 18, fontWeight: '900', color: '#FFFFFFEE', letterSpacing: 0.2 },
  dismissSub:   { fontSize: 10, fontWeight: '600', color: '#FFFFFF70', letterSpacing: 0.5, marginTop: 2 },
  lockBar:      { alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 6, backgroundColor: '#FFFFFF04', borderRadius: 99, borderWidth: 1, borderColor: '#FFFFFF08' },
  lockBarTxt:   { fontSize: 9, color: '#FFFFFF22', fontWeight: '700', letterSpacing: 0.5 },
});
