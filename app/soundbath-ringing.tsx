import React, { useEffect, useState, useRef, memo, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, BackHandler,
  StatusBar, AppState, Platform, NativeModules, ImageBackground, Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, Easing, cancelAnimation,
} from 'react-native-reanimated';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import notifee from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useSoundPlayer } from '@/lib/soundPlayerContext';
import { playAlarmAudio, stopAlarmAudio } from '@/lib/alarmAudio';
import { WAKE_SOUNDS } from '@/lib/missionAlarm';
import { stopAlarmVibration, startNativeLockTask, stopNativeLockTask } from '@/lib/nativeAlarm';
import { SOUND_IMAGES } from '@/lib/sleepSoundsData';
import { getLocalSoundImageUri } from '@/lib/soundImagePreload';
import { CymaticsView } from '@/components/visualizer/CymaticsView';
import {
  USE_CYMATICS_VISUALIZER,
  VISUALIZER_MODE_STORAGE_KEY,
  DEFAULT_SCRIM_OPACITY,
} from '@/constants/visualizerSettings';

const { width } = Dimensions.get('window');

const SOUNDBATH_FS_ID = 'soundbath-alarm-service';
const ACTIVE_SOUNDBATH_NOTIF_KEY = 'onesutra_active_soundbath_notif_v1';

// ── Dish size: fills the circleOuter slot exactly ─────────────────────────────
// circleOuter was width * 0.7; we match that so the cymatics fills it perfectly.
const DISH_SIZE = width * 0.7;

// ── Legacy waveform (kept behind feature flag for rollback) ───────────────────
const BARS = 40;
const WaveformVisualizer = memo(({ meteringAnim }: { meteringAnim: any }) => {
  return (
    <View style={styles.waveformContainer} pointerEvents="none">
      {Array.from({ length: BARS }).map((_, i) => {
        const centerDist = Math.abs(i - BARS / 2) / (BARS / 2);
        const envelope = Math.max(0.1, 1 - Math.pow(centerDist, 2));
        const randomFactor = 0.5 + Math.sin(i * 123.456) * 0.5;

        const animatedStyle = useAnimatedStyle(() => {
          const meter = meteringAnim.value;
          const minHeight = 4 * envelope;
          const maxHeight = 80 * envelope * randomFactor;
          const dynamicHeight = minHeight + (maxHeight - minHeight) * meter;
          return { height: dynamicHeight };
        });

        return (
          <Animated.View
            key={i}
            style={[styles.waveBar, animatedStyle]}
          />
        );
      })}
    </View>
  );
});

export default function SoundBathRingingScreen() {
  const router = useRouter();
  const { soundId: soundIdParam, label: labelParam } = useLocalSearchParams<{ soundId?: string; label?: string }>();
  const soundId = soundIdParam ?? 'morning_birds';
  const wakeSound = WAKE_SOUNDS.find(s => s.id === soundId) ?? WAKE_SOUNDS[0];
  const label = labelParam ?? wakeSound.label ?? 'Sound Bath';
  const bgImage = SOUND_IMAGES[soundId] ? getLocalSoundImageUri(SOUND_IMAGES[soundId]) : undefined;

  const [dismissed, setDismissed] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const soundRef = useRef<Audio.Sound | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const bttfNotifIdRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);
  const watchdogRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { stopSound: stopAmbientSound } = useSoundPlayer();

  // ── Visualizer mode persisted preference ──────────────────────────────────
  // 'cymatics' | 'reduced' | 'off'
  type VisualizerMode = 'cymatics' | 'reduced' | 'off';
  const [visualizerMode, setVisualizerMode] = useState<VisualizerMode>('cymatics');

  useEffect(() => {
    AsyncStorage.getItem(VISUALIZER_MODE_STORAGE_KEY)
      .then(v => {
        if (v === 'cymatics' || v === 'reduced' || v === 'off') {
          setVisualizerMode(v);
        }
      })
      .catch(() => {});
  }, []);

  // ── Shared metering value (0..1 RMS) ─────────────────────────────────────
  // This is the ONLY audio data the visualizer uses from this screen.
  // It's updated by expo-av's playback status callback below.
  const meteringAnim = useSharedValue(0);

  // ── Setup Keep Awake and Lock Task ────────────────────────────────────────
  useEffect(() => {
    startNativeLockTask().catch(() => {});
    activateKeepAwakeAsync('soundbath');
    if (Platform.OS === 'android') {
      NativeModules.HabitAlarmModule?.acquireWakeLock?.().catch?.(() => {});
    }
    return () => {
      isMountedRef.current = false;
      if (watchdogRef.current !== null) {
        clearInterval(watchdogRef.current);
        watchdogRef.current = null;
      }
      deactivateKeepAwake('soundbath');
      if (Platform.OS === 'android') {
        NativeModules.HabitAlarmModule?.releaseWakeLock?.().catch?.(() => {});
      }
      stopNativeLockTask().catch(() => {});
    };
  }, []);

  // ── Setup Audio ───────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await stopAmbientSound();
        if (cancelled) return;

        await playAlarmAudio(soundRef, soundId);

        if (soundRef.current) {
          // Enable metering — the cymatics visualizer reads meteringAnim
          await soundRef.current.setStatusAsync({
            isMeteringEnabled: true,
            progressUpdateIntervalMillis: 50, // faster updates for better visual sync
          } as any);

          soundRef.current.setOnPlaybackStatusUpdate((status: any) => {
            if (cancelled || !isMountedRef.current) return;
            if (status.isLoaded) {
              if (status.isPlaying !== isPlaying) {
                setIsPlaying(status.isPlaying);
              }
              // Map expo-av metering (-160..0 dBFS) to 0..1
              // The cymatics visualizer consumes this value
              if (status.metering !== undefined && status.isPlaying) {
                // More sensitive range: -70..0 dBFS
                const raw = Math.max(0, Math.min(1, (status.metering + 70) / 70));
                meteringAnim.value = withTiming(raw, { duration: 80 });
              } else {
                meteringAnim.value = withTiming(0, { duration: 200 });
              }
            }
          });
        }
      } catch (e) { console.warn('[SoundBath] audio:', e); }
    })();

    return () => {
      cancelled = true;
      stopAlarmAudio(soundRef);
    };
  }, [soundId]);

  const handleDismiss = async () => {
    if (dismissed) return;
    setDismissed(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (soundRef.current) {
      soundRef.current.setOnPlaybackStatusUpdate(null);
    }
    await stopAlarmAudio(soundRef);
    stopNativeLockTask().catch(() => {});
    router.replace('/(tabs)');
  };

  const togglePlayPause = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (soundRef.current) {
      const status = await soundRef.current.getStatusAsync();
      if (status.isLoaded) {
        if (status.isPlaying) {
          await soundRef.current.pauseAsync();
          setIsPlaying(false);
          meteringAnim.value = withTiming(0, { duration: 200 });
        } else {
          await soundRef.current.playAsync();
          setIsPlaying(true);
        }
      }
    }
  };

  // ── Dev-only: long-press title to open Visualizer Lab ────────────────────
  const handleTitleLongPress = useCallback(() => {
    if (!__DEV__) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/visualizer-lab' as any);
  }, [router]);

  // ── Determine which visualizer to render ─────────────────────────────────
  const showCymatics = USE_CYMATICS_VISUALIZER && visualizerMode === 'cymatics';
  const showWaveform = !showCymatics && visualizerMode === 'reduced';
  // 'off' → neither renders inside the ring

  return (
    <ImageBackground
      source={bgImage ? { uri: bgImage } : require('@/assets/images/new_bg.jpeg')}
      style={styles.screen}
      resizeMode="cover"
    >
      <StatusBar hidden />

      {/* Dark Vignette Overlay — unchanged */}
      <View style={styles.vignetteOverlay}>
        <LinearGradient
          colors={['rgba(0,0,0,0.8)', 'transparent', 'rgba(0,0,0,0.8)']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.centerDarkener} />
      </View>

      {/* Top Bar — unchanged */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={handleDismiss}>
          <Ionicons name="chevron-down" size={28} color="#FFF" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.libraryBtn} onPress={handleDismiss}>
          <Ionicons name="grid-outline" size={16} color="#FFF" style={{ marginRight: 6 }} />
          <Text style={styles.libraryText}>Library</Text>
        </TouchableOpacity>
      </View>

      {/* Center Circle — cymatics visualizer replaces waveform bars */}
      <View style={styles.centerWrap}>
        <View style={styles.circleOuter}>
          {/* ── circleInner removed when cymatics is active (its own scrim handles darkening) */}
          {!showCymatics && <View style={styles.circleInner} />}

          {/* ── Cymatics visualizer (transparent, fills the dish) */}
          {showCymatics && (
            <CymaticsView
              size={DISH_SIZE}
              isPlaying={isPlaying}
              meteringAnim={meteringAnim}
              quality="auto"
              scrimOpacity={DEFAULT_SCRIM_OPACITY}
              blendMode="srcOver"
            />
          )}

          {/* ── Fallback: legacy waveform bars */}
          {showWaveform && (
            <WaveformVisualizer meteringAnim={meteringAnim} />
          )}
          {/* 'off' mode: nothing renders here — background image shows through the ring */}
        </View>

        {/* Title — long-press opens Visualizer Lab in __DEV__ */}
        <TouchableOpacity
          onLongPress={handleTitleLongPress}
          activeOpacity={1}
          delayLongPress={800}
        >
          <Text style={styles.titleText}>{label}</Text>
        </TouchableOpacity>

        {/* Loop pill — unchanged */}
        <View style={styles.loopPill}>
          <Ionicons name="repeat" size={14} color="#FFF" />
          <Text style={styles.loopText}>1 hour</Text>
        </View>
      </View>

      {/* Bottom Controls — unchanged */}
      <View style={styles.bottomArea}>
        <View style={styles.playbackRow}>
          <TouchableOpacity style={styles.playbackBtn} onPress={() => Haptics.selectionAsync()}>
            <Ionicons name="play-skip-back" size={28} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.playbackBtnMain} onPress={togglePlayPause}>
            <Ionicons name={isPlaying ? "pause" : "play"} size={36} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.playbackBtn} onPress={() => Haptics.selectionAsync()}>
            <Ionicons name="play-skip-forward" size={28} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Progress Bar — unchanged */}
        <View style={styles.progressRow}>
          <Text style={styles.progressTime}>0:00</Text>
          <View style={styles.progressBarBg}>
            <View style={styles.progressBarFill} />
            <View style={styles.progressDot} />
          </View>
          <Text style={styles.progressTime}>0:00</Text>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  vignetteOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  centerDarkener: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },

  // Top
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 24,
    zIndex: 10,
  },
  iconBtn: {
    width: 44, height: 44,
    justifyContent: 'center', alignItems: 'flex-start',
  },
  libraryBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  libraryText: {
    color: '#FFF', fontSize: 14, fontFamily: 'Nunito_600SemiBold',
  },

  // Center
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  circleOuter: {
    width: width * 0.7,
    height: width * 0.7,
    borderRadius: width * 0.35,
    borderWidth: 1,
    // Slightly more lavender-tinted border when cymatics is active
    borderColor: USE_CYMATICS_VISUALIZER
      ? 'rgba(202,192,243,0.35)'
      : 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    overflow: 'hidden', // clip cymatics to circle bounds
  },
  circleInner: {
    position: 'absolute',
    width: '100%', height: '100%',
    borderRadius: width * 0.35,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  // Legacy waveform styles (kept for rollback)
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 100,
    width: '100%',
    gap: 2,
  },
  waveBar: {
    width: 2,
    backgroundColor: '#FFF',
    borderRadius: 1,
  },

  titleText: {
    color: '#FFF',
    fontSize: 22,
    fontFamily: 'Nunito_700Bold',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  loopPill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  loopText: {
    color: '#FFF', fontSize: 12, fontFamily: 'Nunito_600SemiBold',
  },

  // Bottom
  bottomArea: {
    paddingBottom: 50,
    paddingHorizontal: 30,
    zIndex: 10,
  },
  playbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 40,
    marginBottom: 40,
  },
  playbackBtn: {
    padding: 10,
  },
  playbackBtnMain: {
    width: 64, height: 64,
    borderRadius: 32,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },

  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressTime: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontFamily: 'Nunito_600SemiBold',
  },
  progressBarBg: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBarFill: {
    width: '15%',
    height: '100%',
    backgroundColor: '#FFF',
    borderRadius: 1,
  },
  progressDot: {
    width: 10, height: 10,
    borderRadius: 5,
    backgroundColor: '#FFF',
    marginLeft: -5,
  },
});
