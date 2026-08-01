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
import { HeroGeometricAnimation } from '@/components/HeroGeometricAnimation';
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
  const btnScale     = useSharedValue(1);
  // Outer glow bloom — slow deep pulse for the geometry zone
  const glowBloom    = useSharedValue(0.6);

  const btnStyle   = useAnimatedStyle(() => ({ transform: [{ scale: btnScale.value }] }));
  const gloomStyle = useAnimatedStyle(() => ({ opacity: glowBloom.value }));

  useEffect(() => {
    btnScale.value = withRepeat(
      withSequence(withTiming(1.04, { duration: 900 }), withTiming(1, { duration: 900 })), -1,
    );
    // Deep slow bloom behind geometry
    glowBloom.value = withRepeat(
      withSequence(
        withTiming(1.0, { duration: 5000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.4, { duration: 5000, easing: Easing.inOut(Easing.sin) }),
      ), -1,
    );
    // Waveform shimmer — no-op (bars are static, drives no animated value)
    return () => {
      cancelAnimation(btnScale);
      cancelAnimation(glowBloom);
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
      imageStyle={{ opacity: 0.45 }}
    >
      {/* Full-screen touch interceptor */}
      <View style={StyleSheet.absoluteFillObject} />
      <StatusBar hidden />

      {/* ── Deep cinematic dark overlay — ink-black vignette environment ── */}
      <LinearGradient
        colors={[
          'rgba(0,0,0,0.90)',
          'rgba(0,0,0,0.50)',
          'rgba(0,0,0,0.15)',
          'rgba(0,0,0,0.15)',
          'rgba(0,0,0,0.60)',
          'rgba(0,0,0,0.96)',
        ]}
        locations={[0, 0.12, 0.30, 0.62, 0.84, 1]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      {/* ── Radial vignette — deep acoustic dark surround ── */}
      <LinearGradient
        colors={['transparent', accent + '08', 'transparent']}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      {/* ── Accent colour bloom behind geometry zone ── */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          gloomStyle,
          { backgroundColor: accent + '06' },
        ]}
      />

      {/* ── TOP: time + sound chip ── */}
      <View style={S.topArea}>
        <Text style={S.clockText}>{timeStr}</Text>
        <View style={[S.chip, { borderColor: accent + '60', backgroundColor: 'rgba(0,0,0,0.55)' }]}>
          {/* Animated live-dot with deeper glow */}
          <Animated.View style={[S.liveDot, gloomStyle, { backgroundColor: accent, shadowColor: accent, shadowRadius: 8, shadowOpacity: 1 }]} />
          <Text style={{ fontSize: 14 }}>{wakeSound.icon}</Text>
          <Text style={[S.chipLabel, { color: accent }]}>{label}</Text>
        </View>
      </View>

      {/* ── CENTER: Sacred Resonance Geometry Zone ── */}
      <View style={S.orbWrap} pointerEvents="none">

        {/* Deep ambient bloom circle behind geometry */}
        <Animated.View style={[
          S.ambientBloom,
          gloomStyle,
          {
            backgroundColor: accent + '12',
            shadowColor: accent,
            shadowOpacity: 0.55,
            shadowRadius: 80,
          },
        ]} />

        {/* Outer acoustic boundary ring — very faint */}
        <View style={[S.outerBoundary, { borderColor: accent + '18' }]} />
        <View style={[S.midBoundary,   { borderColor: accent + '10' }]} />

        {/* ── Sacred Resonance Geometry — sound variant ── */}
        <View style={S.geometryZone}>
          <HeroGeometricAnimation
            size={300}
            variant="sound"
            accentColor={accent}
            opacity={0.88}
          />
        </View>

        {/* Sound icon — small, centered, floating above geometry */}
        <View style={S.soundIconWrap}>
          <Text style={S.soundIconText}>{wakeSound.icon}</Text>
        </View>

        {/* ── Waveform shimmer bars — sound visualizer at bottom of orb zone ── */}
        <View style={[S.waveformRow]} pointerEvents="none">
          {Array.from({ length: 18 }, (_, i) => {
            const centerDist = Math.abs(i - 8.5) / 8.5;
            const baseH = 4 + (1 - centerDist) * 20;
            return (
              <View
                key={`wbar_${i}`}
                style={[
                  S.waveBar,
                  {
                    height: baseH + (i % 3) * 4,
                    backgroundColor: accent,
                    opacity: 0.25 + (1 - centerDist) * 0.35,
                    borderRadius: 2,
                  },
                ]}
              />
            );
          })}
        </View>
      </View>

      {/* ── BOTTOM: premium category + dismiss ── */}
      <View style={S.bottomArea}>

        {/* Category chip — elegant pill */}
        <View style={[S.categoryChip, { borderColor: accent + '35' }]}>
          <Text style={[S.categoryDot, { color: accent }]}>
            {wakeSound.category === 'mantra' ? '🕉' : '🌿'}
          </Text>
          <Text style={[S.categoryHint, { color: accent + 'CC' }]}>
            {wakeSound.category === 'mantra' ? 'Mantra  ·  Resonance' : 'Ambient  ·  Sound Bath'}
          </Text>
        </View>

        {/* Dismiss button — premium glassmorphism */}
        <Animated.View style={[{ width: '100%' }, btnStyle]}>
          <TouchableOpacity
            style={[S.dismissBtn, { shadowColor: accent }]}
            onPress={handleDismiss}
            activeOpacity={0.80}
          >
            {/* Multi-layer glassmorphism fill */}
            <LinearGradient
              colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)', 'rgba(0,0,0,0.20)']}
              start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
              style={[StyleSheet.absoluteFillObject, { borderRadius: 26 }]}
            />
            <LinearGradient
              colors={[accent + '30', accent + '08']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFillObject, { borderRadius: 26 }]}
            />
            {/* Top glass highlight */}
            <View style={S.dismissGlassHighlight} />

            <View style={S.dismissInner}>
              <View style={[S.dismissIconWrap, { borderColor: accent + '60', shadowColor: accent }]}>
                <Text style={S.dismissIconText}>✦</Text>
              </View>
              <View style={{ marginLeft: 14, flex: 1 }}>
                <Text style={S.dismissTxt}>Finish Listening</Text>
                <Text style={S.dismissSub}>Tap to stop · Return to app</Text>
              </View>
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* Lock indicator */}
        <View style={S.lockBar}>
          <Text style={S.lockBarTxt}>🔒  Screen locked while listening</Text>
        </View>
      </View>
    </ImageBackground>
  );
}

const S = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#020409' },

  // ── Top ──────────────────────────────────────────────────────────────────
  topArea: {
    paddingTop: 58, alignItems: 'center', gap: 16,
  },
  clockText: {
    fontSize: 76, fontWeight: '100', color: '#FFFFFF',
    letterSpacing: -3,
    textShadowColor: 'rgba(255,255,255,0.1)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderRadius: 28,
    paddingHorizontal: 20, paddingVertical: 11,
    backgroundColor: 'rgba(0,0,0,0.50)',
  },
  liveDot: { width: 7, height: 7, borderRadius: 3.5 },
  chipLabel: {
    fontSize: 11, fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 2.2, textTransform: 'uppercase',
  },

  // ── Geometry zone ────────────────────────────────────────────────────────
  orbWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
  },
  ambientBloom: {
    position: 'absolute',
    width: 340, height: 340, borderRadius: 170,
  },
  outerBoundary: {
    position: 'absolute', width: 340, height: 340,
    borderRadius: 170, borderWidth: 1,
  },
  midBoundary: {
    position: 'absolute', width: 260, height: 260,
    borderRadius: 130, borderWidth: 0.8,
  },
  geometryZone: {
    width: 300, height: 300,
    alignItems: 'center', justifyContent: 'center',
  },
  soundIconWrap: {
    position: 'absolute',
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.40)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  soundIconText: { fontSize: 24 },
  waveformRow: {
    position: 'absolute', bottom: -40,
    flexDirection: 'row', alignItems: 'flex-end',
    gap: 3, paddingHorizontal: 20,
  },
  waveBar: {
    width: 3, minHeight: 4,
  },

  // ── Bottom ───────────────────────────────────────────────────────────────
  bottomArea: {
    paddingHorizontal: 28, paddingBottom: 52,
    alignItems: 'center', gap: 18,
  },
  categoryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: 28,
    paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  categoryDot:  { fontSize: 14 },
  categoryHint: {
    fontSize: 11, fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 2.5, textTransform: 'uppercase',
  },

  // Dismiss button — glassmorphism premium
  dismissBtn: {
    width: '100%',
    borderRadius: 26, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    shadowOpacity: 0.5, shadowRadius: 40, elevation: 100, zIndex: 100,
    shadowOffset: { width: 0, height: 12 },
  },
  dismissGlassHighlight: {
    position: 'absolute', top: 0, left: 20, right: 20, height: 1,
    backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 1,
  },
  dismissInner: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 22, paddingHorizontal: 28,
  },
  dismissIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    shadowOpacity: 0.8, shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  dismissIconText: { fontSize: 18, color: '#FFFFFF' },
  dismissTxt: {
    fontSize: 17, fontFamily: 'Nunito_800ExtraBold',
    color: '#FFFFFF', letterSpacing: 0.3,
  },
  dismissSub: {
    fontSize: 10, fontFamily: 'Nunito_700Bold',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 1.2, marginTop: 3, textTransform: 'uppercase',
  },

  // Lock bar
  lockBar: {
    alignSelf: 'center', paddingHorizontal: 18, paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 99, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  lockBarTxt: {
    fontSize: 9, color: 'rgba(255,255,255,0.30)',
    fontFamily: 'Nunito_700Bold', letterSpacing: 1.2, textTransform: 'uppercase',
  },
});
