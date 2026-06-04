import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, BackHandler, StatusBar, Dimensions, AppState, Platform, NativeModules, ImageBackground } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, Easing } from 'react-native-reanimated';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import notifee, { AndroidImportance, AndroidCategory, AndroidVisibility } from '@notifee/react-native';
import { startAlarmVibration, stopAlarmVibration } from '@/lib/nativeAlarm';
import { store, KEYS } from '@/lib/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSoundPlayer } from '@/lib/soundPlayerContext';
import { saveHabitLog, todayStr } from '@/lib/habitLogs';
import { auth } from '@/lib/firebase';
import { playAlarmAudio, stopAlarmAudio } from '@/lib/alarmAudio';
import { SOUND_IMAGES } from '@/lib/sleepSoundsData';
import { getLocalSoundImageUri, ensureSoundImageCached } from '@/lib/soundImagePreload';
import { useBgContext } from '@/lib/bgContext';

const { width, height } = Dimensions.get('window');
const ACCENT = '#10b981';
const HABIT_FS_ID = 'habit-alarm-service';
const ACTIVE_HABIT_NOTIF_KEY = 'onesutra_active_habit_notif_v1';

export default function HabitAlarmRingingScreen() {
  const router = useRouter();
  const { habitKey, habitEmoji, label, mantraId: mantraIdParam, alarmType } = useLocalSearchParams<{ habitKey?: string; habitEmoji?: string; label?: string; mantraId?: string; alarmType?: string }>();
  const habitLabel = label ?? (alarmType === 'quick' ? 'Quick Alarm' : 'Habit Alarm');
  const emoji = habitEmoji ?? (alarmType === 'quick' ? '⚡' : '🌿');
  const isQuick = alarmType === 'quick';
  // ── Background image (same as wake-up alarm) ──────────────────────────────
  // Use useBgContext for the user's time-of-day wallpaper as primary source,
  // fall back to the sound-specific image if no custom wallpaper is set.
  const { bgUri } = useBgContext();

  // ── Safeguard: soundbath alarms should never land here ──────────────────────
  useEffect(() => {
    if (alarmType === 'soundbath') {
      const sid = encodeURIComponent(mantraIdParam ?? 'morning_birds');
      const lbl = encodeURIComponent(label ?? 'Sound Bath');
      router.replace(`/soundbath-ringing?soundId=${sid}&label=${lbl}` as never);
    }
  }, []);

  const [phase, setPhase] = useState<'countdown' | 'active'>('countdown');
  const [countdown, setCountdown] = useState(3);
  const [stopped, setStopped] = useState(false);
  const [showStreakView, setShowStreakView] = useState(false);
  const [streakData, setStreakData] = useState<{ streak: number; weekDays: boolean[] } | null>(null);
  const [imageCached, setImageCached] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const bttfNotifIdRef = useRef<string | null>(null);
  const { stopSound: stopAmbientSound, dismissMoodSheet } = useSoundPlayer();

  // Animations
  const outerScale = useSharedValue(1);
  const outerOpacity = useSharedValue(0.35);
  const innerScale = useSharedValue(1);
  const outerStyle = useAnimatedStyle(() => ({ transform: [{ scale: outerScale.value }], opacity: outerOpacity.value }));
  const innerStyle = useAnimatedStyle(() => ({ transform: [{ scale: innerScale.value }] }));

  useEffect(() => {
    outerScale.value = withRepeat(withSequence(withTiming(1.35, { duration: 1000, easing: Easing.inOut(Easing.ease) }), withTiming(1, { duration: 1000 })), -1);
    outerOpacity.value = withRepeat(withSequence(withTiming(0.75, { duration: 1000 }), withTiming(0.20, { duration: 1000 })), -1);
    innerScale.value = withRepeat(withSequence(withTiming(1.10, { duration: 800 }), withTiming(1, { duration: 800 })), -1);
  }, []);

  useEffect(() => {
    activateKeepAwakeAsync('habit-alarm');
    if (Platform.OS === 'android') {
      NativeModules.HabitAlarmModule?.acquireWakeLock?.().catch?.(() => {});
    }
    // Vibration will start AFTER audio is confirmed playing (see audio useEffect)
    // This prevents the vibration-only gap when audio loads async
    return () => {
      deactivateKeepAwake('habit-alarm');
      if (Platform.OS === 'android') {
        NativeModules.HabitAlarmModule?.releaseWakeLock?.().catch?.(() => {});
      }
      // Stop vibration when screen unmounts
      stopAlarmVibration().catch(() => {});
    };
  }, []);

  useEffect(() => {
    // NOTE: stopAmbientSound is now called inside the audio useEffect below,
    // BEFORE playAlarmAudio, to prevent audio session conflicts.
    dismissMoodSheet();
  }, []);

  // Preload cuckoo chime image for offline display
  useEffect(() => {
    (async () => {
      try {
        await ensureSoundImageCached(SOUND_IMAGES.cuckoo_chime);
        setImageCached(true);
      } catch (e) {
        console.warn('[HabitAlarm] Image cache error:', e);
        setImageCached(true); // Still mark as ready even if cache failed
      }
    })();
  }, []);

  // Mute the native HabitAlarmSoundService (instant start when killed) so JS takes over
  useEffect(() => {
    NativeModules.HabitAlarmModule?.setHabitAlarmVolume?.(0).catch?.(() => {});
  }, []);

  // Phase 4: Dismiss native overlay the moment this screen mounts
  useEffect(() => {
    NativeModules.HabitAlarmModule?.dismissHabitAlarmOverlay?.().catch?.(() => {});
  }, []);

  // Play mantra audio — uses shared alarm audio core (same logic as working morning alarm)
  useEffect(() => {
    let cancelled = false;
    let vibrationStarted = false;
    (async () => {
      try {
        // ── FOREGROUND FIX: Stop ambient sound FIRST and wait for audio session
        // release before claiming it. Running stopAmbientSound in a separate useEffect
        // caused a race condition where both ran concurrently, leading to audio session
        // conflicts when the alarm fired while the app was already open.
        await stopAmbientSound(false).catch(() => {});
        await new Promise<void>(r => setTimeout(r, 150));
        if (cancelled) return;

        const mantraId = (mantraIdParam as string | undefined) ?? 'cuckoo_chime';
        if (cancelled) return;
        await playAlarmAudio(soundRef, mantraId);
        if (cancelled) { await stopAlarmAudio(soundRef).catch(() => {}); return; }
        
        // Start vibration NOW — audio is loaded and playing
        if (!vibrationStarted) {
          vibrationStarted = true;
          startAlarmVibration().catch(() => {});
        }
        
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
        
        // Additional check at 2 seconds to ensure audio is still playing
        setTimeout(() => {
          if (!cancelled && soundRef.current) {
            soundRef.current.getStatusAsync().then((status: any) => {
              if (status?.isLoaded && !status?.isPlaying) {
                console.warn('[HabitAlarm] Audio stopped unexpectedly, restarting...');
                soundRef.current?.playAsync().catch(() => {});
              }
            }).catch(() => {});
          }
        }, 2000);
      } catch (e) {
        // Audio failed — start vibration as fallback so alarm is still audible
        if (!vibrationStarted) {
          vibrationStarted = true;
          startAlarmVibration().catch(() => {});
        }
        console.warn('[HabitAlarm] audio:', e);
      }
    })();
    return () => {
      cancelled = true;
      stopAlarmAudio(soundRef);
    };
  }, []);

  // Countdown 3-2-1 then activate
  useEffect(() => {
    if (phase !== 'countdown') return;
    if (countdown <= 0) { setPhase('active'); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); return; }
    const t = setTimeout(() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setCountdown(c => c - 1); }, 1000);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  // Block back button
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!stopped) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); return true; }
      return false;
    });
    return () => sub.remove();
  }, [stopped]);

  // ── Foreground service — only start if native HabitAlarmSoundService is NOT running ──
  // When native service is active it already holds the FGS. Starting a second one is
  // redundant and can cause ANRs on some OEM ROMs.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    let notifeeStarted = false;
    (async () => {
      try {
        const nativeActive = await NativeModules.HabitAlarmModule?.wasHabitAlarmFired?.() ?? false;
        if (nativeActive) {
          // Native service is running — just cancel any stale trigger notification
          AsyncStorage.getItem(ACTIVE_HABIT_NOTIF_KEY).then(notifId => {
            if (!notifId) return;
            notifee.cancelNotification(notifId).catch(() => {});
            notifee.cancelTriggerNotification(notifId).catch(() => {});
            AsyncStorage.removeItem(ACTIVE_HABIT_NOTIF_KEY).catch(() => {});
          }).catch(() => {});
          return;
        }
        // No native service — start notifee FGS as fallback
        await notifee.createChannel({
          id: 'arise-habit-alarms', name: 'Nada Habit Alarms',
          importance: AndroidImportance.HIGH, bypassDnd: true,
          visibility: AndroidVisibility.PUBLIC,
        } as any);
        await notifee.displayNotification({
          id: HABIT_FS_ID,
          title: `${emoji}  ${habitLabel}`,
          body: 'Complete your habit to dismiss.',
          android: {
            channelId: 'arise-habit-alarms',
            importance: AndroidImportance.HIGH,
            category: AndroidCategory.ALARM,
            visibility: AndroidVisibility.PUBLIC,
            ongoing: true,
            asForegroundService: true,
            pressAction: { id: 'default', launchActivity: 'default' },
          } as any,
        });
        notifeeStarted = true;
        AsyncStorage.getItem(ACTIVE_HABIT_NOTIF_KEY).then(notifId => {
          if (!notifId) return;
          notifee.cancelNotification(notifId).catch(() => {});
          notifee.cancelTriggerNotification(notifId).catch(() => {});
          AsyncStorage.removeItem(ACTIVE_HABIT_NOTIF_KEY).catch(() => {});
        }).catch(() => {});
      } catch (e) { console.warn('[HabitAlarm] foreground service start:', e); }
    })();
    return () => {
      if (notifeeStarted) notifee.cancelNotification(HABIT_FS_ID).catch(() => {});
    };
  }, []);

  // ── Re-open screen when HOME is pressed (mirrors morning alarm protection) ──
  useEffect(() => {
    if (stopped) return;

    const BTTF_ID = 'habit-bttf';

    const fireBttfNotif = async () => {
      if (Platform.OS !== 'android') return;
      try {
        await notifee.createChannel({
          id: 'alarm-bttf-silent',
          name: 'Alarm Return Prompt',
          importance: AndroidImportance.HIGH,
        });
        await notifee.displayNotification({
          id: BTTF_ID,
          title: `${emoji}  ${habitLabel}`,
          body: 'Return to dismiss your alarm.',
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
        bttfNotifIdRef.current = BTTF_ID;
      } catch (e) { console.warn('[HabitAlarm] bttf notif error:', e); }
    };

    const cancelBttfNotif = () => {
      notifee.cancelNotification(bttfNotifIdRef.current ?? BTTF_ID).catch(() => {});
      bttfNotifIdRef.current = null;
    };

    const ensureAudioPlaying = async () => {
      try {
        if (soundRef.current) {
          const status = await soundRef.current.getStatusAsync();
          if (status?.isLoaded && !status?.isPlaying) {
            await soundRef.current.playAsync();
          }
        }
      } catch (e) {
        console.warn('[HabitAlarm] Audio resume error:', e);
      }
    };

    const sub = AppState.addEventListener('change', (nextState) => {
      if (
        !stopped &&
        appStateRef.current === 'active' &&
        (nextState === 'background' || nextState === 'inactive')
      ) {
        appStateRef.current = nextState;
        fireBttfNotif();
        ensureAudioPlaying();
      } else if (
        !stopped &&
        (appStateRef.current === 'background' || appStateRef.current === 'inactive') &&
        nextState === 'active'
      ) {
        appStateRef.current = nextState;
        cancelBttfNotif();
        ensureAudioPlaying();
        // Native vibration continues uninterrupted in JVM service — just fire haptic.
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      } else {
        appStateRef.current = nextState;
      }
    });

    return () => {
      sub.remove();
      cancelBttfNotif();
    };
  }, [stopped, emoji, habitLabel]);

  const stopAudio = async () => stopAlarmAudio(soundRef);

  /**
   * Stop habit alarm vibration by sending ACTION_STOP_VIBRATION directly to
   * HabitAlarmSoundService. The existing stopAlarmVibration() from nativeAlarm.ts
   * targets AlarmSoundService (wake alarm) — it has no effect on habit alarms.
   */
  const stopHabitAlarmVibration = () => {
    try {
      NativeModules.HabitAlarmModule?.stopHabitAlarmVibration?.().catch?.(() => {});
    } catch { /* ignore */ }
    // Belt-and-suspenders: also cancel any JS-side vibration
    stopAlarmVibration().catch(() => {});
  };

  const localDateStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const updateLocalStreak = async (key: string): Promise<{ streak: number; weekDays: boolean[] }> => {
    const today = new Date();
    const todayS = localDateStr(today);
    const yest = new Date(today); yest.setDate(yest.getDate() - 1);
    const yesterdayS = localDateStr(yest);
    type SR = { streak: number; lastDate: string; history: string[] };
    const all = (await store.getJSON<Record<string, SR>>(KEYS.habitAlarmStreaks)) ?? {};
    const cur: SR = all[key] ?? { streak: 0, lastDate: '', history: [] };
    let newStreak: number;
    if (cur.lastDate === todayS) {
      newStreak = cur.streak;
    } else if (cur.lastDate === yesterdayS || cur.lastDate === '') {
      newStreak = cur.streak + 1;
    } else {
      newStreak = 1;
    }
    const history = [...(cur.history ?? []).filter((d: string) => d !== todayS), todayS].slice(-30);
    await store.setJSON(KEYS.habitAlarmStreaks, { ...all, [key]: { streak: newStreak, lastDate: todayS, history } });
    const weekDays: boolean[] = Array(7).fill(false);
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek); d.setDate(startOfWeek.getDate() + i);
      weekDays[i] = history.includes(localDateStr(d));
    }
    return { streak: newStreak, weekDays };
  };

  const stopForegroundService = async () => {
    try { await notifee.cancelNotification(HABIT_FS_ID); } catch { /* ignore */ }
  };

  const stopNative = async () => {
    try {
      await NativeModules.HabitAlarmModule?.stopHabitAlarmSound?.();
    } catch { /* ignore */ }
  };

  const handleComplete = async () => {
    setStopped(true);
    // 1. Stop ALL alarm signals immediately — audio, vibration, native service
    await stopAudio();
    // 2. Stop habit alarm vibration DIRECTLY on HabitAlarmSoundService
    stopHabitAlarmVibration();
    setTimeout(() => { stopHabitAlarmVibration(); }, 300); // double-stop safety
    // 3. Stop native service BEFORE navigating — this clears isAlarmActive() flag
    // so the lifecycle watchdog stops trying to bring the app to front
    await stopNative();
    await stopForegroundService();
    try { await notifee.cancelNotification(bttfNotifIdRef.current ?? 'habit-bttf'); } catch { /* ignore */ }
    try { await notifee.cancelNotification('habit-bttf'); } catch { /* ignore */ }
    try { await notifee.cancelNotification('alarm-bttf'); } catch { /* ignore */ }
    await notifee.cancelAllNotifications().catch(() => {});
    bttfNotifIdRef.current = null;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const user = auth.currentUser;
    if (!isQuick && user && habitKey) saveHabitLog({ habitId: habitKey, habitName: habitLabel, userId: user.uid, date: todayStr(), status: 'done' }).catch(() => {});
    if (!isQuick && habitKey) {
      try {
        const sd = await updateLocalStreak(habitKey);
        setStreakData(sd);
        setShowStreakView(true);
        setTimeout(() => router.replace('/(tabs)' as never), 3500);
      } catch {
        router.replace('/(tabs)' as never);
      }
    } else {
      await new Promise<void>(r => setTimeout(r, 150));
      router.replace('/(tabs)' as never);
    }
  };

  const handleQuit = async () => {
    setStopped(true);
    // Stop ALL alarm signals immediately
    await stopAudio();
    // Stop habit alarm vibration DIRECTLY on HabitAlarmSoundService
    stopHabitAlarmVibration();
    setTimeout(() => { stopHabitAlarmVibration(); }, 300); // double-stop safety
    // Stop native service BEFORE navigating — clears isAlarmActive() flag
    await stopNative();
    await stopForegroundService();
    try { await notifee.cancelNotification(bttfNotifIdRef.current ?? 'habit-bttf'); } catch { /* ignore */ }
    try { await notifee.cancelNotification('habit-bttf'); } catch { /* ignore */ }
    try { await notifee.cancelNotification('alarm-bttf'); } catch { /* ignore */ }
    await notifee.cancelAllNotifications().catch(() => {});
    bttfNotifIdRef.current = null;
    await new Promise<void>(r => setTimeout(r, 150));
    router.replace('/(tabs)' as never);
  };

  const soundImageUri = mantraIdParam === 'cuckoo_chime' || !mantraIdParam ? getLocalSoundImageUri(SOUND_IMAGES.cuckoo_chime) : SOUND_IMAGES[mantraIdParam as keyof typeof SOUND_IMAGES] ? getLocalSoundImageUri(SOUND_IMAGES[mantraIdParam as keyof typeof SOUND_IMAGES]) : getLocalSoundImageUri(SOUND_IMAGES.cuckoo_chime);
  // Primary background: user's custom wallpaper from bgContext (same as alarm-ringing.tsx)
  // Fallback: sound-specific image (cuckoo chime by default)
  const bgSource = bgUri ? { uri: bgUri } : (soundImageUri ? { uri: soundImageUri } : undefined);

  return (
    <ImageBackground source={bgSource} style={S.screen} imageStyle={{ opacity: bgUri ? 1 : 0.68 }}>
      <View style={S.screen}>
        <StatusBar hidden />
        {/* Dark gradient overlay — heavier at top & bottom for readability */}
        <LinearGradient
          colors={['rgba(0,0,0,0.72)', 'rgba(0,0,0,0.10)', 'rgba(0,0,0,0.10)', 'rgba(0,0,0,0.88)']}
          locations={[0, 0.18, 0.55, 1]}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        {/* Ambient glow */}
        <View style={[S.bgGlow, { opacity: phase === 'active' ? 1 : 0.5 }]} pointerEvents="none" />

        {phase === 'countdown' ? (
          /* ── Countdown 3-2-1 ── */
          <View style={S.centerWrap} pointerEvents="none">
            <View style={S.ringWrap} pointerEvents="none">
              <Animated.View style={[S.outerRing, outerStyle, { borderColor: ACCENT + '55' }]} />
              <View style={[S.midRing, { borderColor: ACCENT + '25' }]} />
              <Animated.View style={[S.innerCircle, innerStyle, { backgroundColor: ACCENT + '18', borderColor: ACCENT + '50' }]}>
                <Text style={[S.countdownNum, { color: ACCENT }]}>{countdown}</Text>
              </Animated.View>
            </View>
            <Text style={S.countdownLabel}>{emoji}  {habitLabel}</Text>
            <Text style={S.countdownSub}>{isQuick ? 'QUICK ALARM ACTIVATED' : 'HABIT ALARM ACTIVATED'}</Text>
          </View>
        ) : (
          /* ── Commitment Screen ── */
          <View style={S.commitWrap} pointerEvents="box-none">
            <View style={S.commitTop} pointerEvents="none">
              <View style={[S.typeBadge, { borderColor: ACCENT + '50', backgroundColor: ACCENT + '12' }]}>
                <Text style={[S.typeBadgeTxt, { color: ACCENT }]}>{isQuick ? '⚡  QUICK ALARM  ·  LOCKED' : '🌿  HABIT ALARM  ·  LOCKED'}</Text>
              </View>
              <Animated.View style={[S.emojiRing, innerStyle, { borderColor: ACCENT + '45', backgroundColor: ACCENT + '10' }]}>
                <Text style={S.bigEmoji}>{emoji}</Text>
              </Animated.View>
              <Text style={S.commitHabitName}>{habitLabel}</Text>
              {!isQuick && (
                <View style={S.riskBanner}>
                  <Text style={S.riskEmoji}>🔥</Text>
                  <Text style={S.riskTxt}>Your streak is at risk — act now!</Text>
                </View>
              )}
            </View>

            <View style={S.commitBottom}>
              <Text style={S.commitQuestion}>{isQuick ? 'Tap below to dismiss your alarm.' : 'Ready to do this right now?'}</Text>
              <TouchableOpacity style={[S.commitBtn, { backgroundColor: ACCENT }]} onPress={handleComplete} activeOpacity={0.88}>
                <Text style={S.commitBtnTxt}>{isQuick ? '✓  DISMISS ALARM' : '✊  I COMMIT — I\'LL DO IT NOW'}</Text>
              </TouchableOpacity>
              {!isQuick && (
                <TouchableOpacity style={S.skipBtn} onPress={handleQuit} activeOpacity={0.7}>
                  <Text style={S.skipTxt}>Skip this time (streak will reset)</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {phase !== 'countdown' && (
          <View style={S.lockBar}>
            <Text style={S.lockBarTxt}>{isQuick ? '🔒  Dismiss by tapping above' : '🔒  Dismiss only by committing'}</Text>
          </View>
        )}

        {/* ── Alarmy-style streak celebration overlay ── */}
        {showStreakView && streakData && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(3,16,10,0.97)', alignItems: 'center', justifyContent: 'center', zIndex: 999, paddingHorizontal: 28 }}>
            <LinearGradient
              colors={['#10b98118', '#10b98108']}
              style={{ width: '100%', borderRadius: 28, borderWidth: 1.5, borderColor: '#10b98135', padding: 32, alignItems: 'center' }}
            >
              <Text style={{ fontSize: 13, fontWeight: '900', color: '#10b98170', letterSpacing: 2, marginBottom: 2 }}>{emoji}  {habitLabel}</Text>
              <Text style={{ fontSize: 88, fontWeight: '100', color: '#10b981', letterSpacing: -4, lineHeight: 100 }}>{streakData.streak}</Text>
              <Text style={{ fontSize: 12, fontWeight: '900', color: '#10b981CC', letterSpacing: 2.5, marginBottom: 28 }}>DAY STREAK  🔥</Text>

              {/* SMTWTFS week pills */}
              <View style={{ flexDirection: 'row', gap: 7, marginBottom: 28 }}>
                {['S','M','T','W','T','F','S'].map((d, i) => {
                  const done = streakData.weekDays[i];
                  const isToday = i === new Date().getDay();
                  return (
                    <View key={i} style={{
                      width: 36, height: 44, borderRadius: 10, borderWidth: 1.5,
                      borderColor: done ? '#10b981' : isToday ? '#10b98150' : '#FFFFFF15',
                      backgroundColor: done ? '#10b98125' : isToday ? '#10b98108' : 'transparent',
                      alignItems: 'center', justifyContent: 'center', gap: 5
                    }}>
                      <Text style={{ fontSize: 9, fontWeight: '900', color: done ? '#10b981' : isToday ? '#10b98180' : '#FFFFFF25' }}>{d}</Text>
                      {done && <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#10b981' }} />}
                    </View>
                  );
                })}
              </View>

              <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFFBB', textAlign: 'center', lineHeight: 22 }}>
                {streakData.streak === 1 ? 'First step taken 🌱\nEvery legend starts here.' : streakData.streak >= 30 ? `${streakData.streak} days — elite level! 👑\nYou are the 1%.` : streakData.streak >= 7 ? `${streakData.streak} days strong! 🏆\nBuilding an unbreakable routine.` : `Keep going! ${streakData.streak} days in 💪`}
              </Text>

              <TouchableOpacity
                onPress={() => router.replace('/(tabs)' as never)}
                style={{ marginTop: 24, paddingHorizontal: 32, paddingVertical: 15, borderRadius: 16, backgroundColor: '#10b98122', borderWidth: 1, borderColor: '#10b98155' }}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 14, fontWeight: '900', color: '#10b981', letterSpacing: 0.3 }}>Continue  →</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        )}
      </View>
    </ImageBackground>
  );
}

const S = StyleSheet.create({
  screen:           { flex: 1, backgroundColor: '#03100A' },
  bgGlow:           { position: 'absolute', top: 0, left: 0, right: 0, height: height * 0.65, backgroundColor: '#10b98118', borderBottomLeftRadius: width * 0.8, borderBottomRightRadius: width * 0.8 },
  // Countdown
  centerWrap:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  ringWrap:         { alignItems: 'center', justifyContent: 'center', width: 230, height: 230, marginBottom: 28 },
  outerRing:        { position: 'absolute', width: 230, height: 230, borderRadius: 115, borderWidth: 1.5 },
  midRing:          { position: 'absolute', width: 165, height: 165, borderRadius: 83, borderWidth: 1 },
  innerCircle:      { width: 110, height: 110, borderRadius: 55, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  countdownNum:     { fontSize: 58, fontWeight: '100', letterSpacing: -2 },
  countdownLabel:   { fontSize: 22, fontWeight: '900', color: '#FFFFFF', textAlign: 'center', marginTop: 4 },
  countdownSub:     { fontSize: 10, color: ACCENT + '80', marginTop: 12, letterSpacing: 2.5, fontWeight: '700' },
  // Commitment
  commitWrap:       { flex: 1, paddingHorizontal: 24 },
  commitTop:        { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 22 },
  typeBadge:        { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 99, paddingHorizontal: 18, paddingVertical: 7 },
  typeBadgeTxt:     { fontSize: 9, fontWeight: '900', letterSpacing: 1.8 },
  emojiRing:        { width: 126, height: 126, borderRadius: 63, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  bigEmoji:         { fontSize: 54 },
  commitHabitName:  { fontSize: 30, fontWeight: '900', color: '#FFFFFF', textAlign: 'center', letterSpacing: -0.5 },
  riskBanner:       { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f9731610', borderWidth: 1, borderColor: '#f9731630', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  riskEmoji:        { fontSize: 16 },
  riskTxt:          { fontSize: 12, fontWeight: '700', color: '#fdba74' },
  // Bottom buttons
  commitBottom:     { paddingBottom: 48, gap: 10 },
  commitQuestion:   { fontSize: 12, color: '#FFFFFF30', textAlign: 'center', fontWeight: '600', letterSpacing: 0.4, marginBottom: 6 },
  commitBtn:        { borderRadius: 20, paddingVertical: 22, alignItems: 'center', shadowColor: ACCENT, shadowOpacity: 0.4, shadowRadius: 20, elevation: 8 },
  commitBtnTxt:     { fontSize: 16, fontWeight: '900', color: '#001A0A', letterSpacing: 0.2 },
  skipBtn:          { alignItems: 'center', paddingVertical: 12 },
  skipTxt:          { fontSize: 12, color: '#FFFFFF18', fontWeight: '600' },
  lockBar:          { alignSelf: 'center', marginBottom: 14, paddingHorizontal: 16, paddingVertical: 6, backgroundColor: '#FFFFFF04', borderRadius: 99, borderWidth: 1, borderColor: '#FFFFFF08' },
  lockBarTxt:       { fontSize: 9, color: '#FFFFFF22', fontWeight: '700', letterSpacing: 0.5 },
});
