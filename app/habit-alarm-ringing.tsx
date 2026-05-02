import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, BackHandler, StatusBar, Dimensions, Vibration, AppState, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, Easing } from 'react-native-reanimated';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import notifee, { AndroidImportance, AndroidCategory, AndroidVisibility } from '@notifee/react-native';
import { store, KEYS } from '@/lib/storage';
import { saveHabitLog, todayStr } from '@/lib/habitLogs';
import { auth } from '@/lib/firebase';
import { getLocalMantraPath } from '@/lib/mantraDownload';

const { width, height } = Dimensions.get('window');
const ACCENT = '#10b981';

export default function HabitAlarmRingingScreen() {
  const router = useRouter();
  const { habitKey, habitEmoji, label } = useLocalSearchParams<{ habitKey?: string; habitEmoji?: string; label?: string }>();
  const habitLabel = label ?? 'Habit Alarm';
  const emoji = habitEmoji ?? '🌿';

  const [phase, setPhase] = useState<'countdown' | 'active'>('countdown');
  const [countdown, setCountdown] = useState(3);
  const [stopped, setStopped] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const appStateRef = useRef(AppState.currentState);

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

  useEffect(() => { activateKeepAwakeAsync('habit-alarm'); return () => { deactivateKeepAwake('habit-alarm'); }; }, []);

  // Play mantra audio
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfg = await store.getJSON<{ selectedMantraId?: string }>(KEYS.alarmSettings);
        const mantraId = cfg?.selectedMantraId ?? 'gayatri';
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: true, shouldDuckAndroid: false, interruptionModeIOS: 1, interruptionModeAndroid: 1 });
        const localPath = getLocalMantraPath(mantraId);
        const localInfo = await FileSystem.getInfoAsync(localPath);
        const src = localInfo.exists ? { uri: localPath } : require('../assets/sounds/mantra_alarm.wav');
        if (cancelled) return;
        const { sound } = await Audio.Sound.createAsync(src, { shouldPlay: true, isLooping: true, volume: 1.0 });
        if (cancelled) { sound.unloadAsync(); return; }
        soundRef.current = sound;
      } catch (e) { console.warn('[HabitAlarm] audio:', e); }
    })();
    return () => {
      cancelled = true;
      soundRef.current?.stopAsync().catch(() => {});
      soundRef.current?.unloadAsync().catch(() => {});
      soundRef.current = null;
    };
  }, []);

  useEffect(() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); Vibration.vibrate([0, 500, 200, 500, 200, 500]); }, []);

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
      if (!stopped) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); Vibration.vibrate([0, 200, 100, 200]); return true; }
      return false;
    });
    return () => sub.remove();
  }, [stopped]);

  // Keep-alive: persistent fullScreen notification fires IMMEDIATELY on mount
  // so Android treats the process as high-priority (similar to a foreground service).
  // Re-fires every time the app backgrounds so it can never be lost.
  // Completely isolated from the wake alarm (different channel + notif ID).
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const NOTIF_ID = 'habit-alarm-lock';
    const CHAN_ID   = 'arise-habit-alarms';

    const fire = async () => {
      try {
        await notifee.createChannel({
          id: CHAN_ID, name: 'Arise Habit Alarms',
          importance: AndroidImportance.HIGH, bypassDnd: true,
          visibility: AndroidVisibility.PUBLIC,
        } as any);
        await notifee.displayNotification({
          id: NOTIF_ID,
          title: `${emoji}  ${habitLabel}`,
          body: 'Tap to return and commit to your habit.',
          android: {
            channelId: CHAN_ID,
            importance: AndroidImportance.HIGH,
            category: AndroidCategory.ALARM,
            visibility: AndroidVisibility.PUBLIC,
            ongoing: true,
            autoCancel: false,
            fullScreenAction: { id: 'default', launchActivity: 'default' },
            pressAction:      { id: 'default', launchActivity: 'default' },
          } as any,
        });
      } catch { /* ignore */ }
    };

    fire(); // ← fires immediately on mount, pins process in Android's eyes

    const sub = AppState.addEventListener('change', next => {
      if (!stopped && appStateRef.current === 'active' &&
          (next === 'background' || next === 'inactive')) {
        appStateRef.current = next;
        fire(); // re-fire in case notification was dismissed
      } else if (!stopped &&
          (appStateRef.current === 'background' || appStateRef.current === 'inactive') &&
          next === 'active') {
        appStateRef.current = next;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      } else {
        appStateRef.current = next;
      }
    });

    return () => {
      sub.remove();
      notifee.cancelNotification(NOTIF_ID).catch(() => {});
    };
  }, [stopped, emoji, habitLabel]);

  const stopAudio = async () => {
    try { if (soundRef.current) { await soundRef.current.stopAsync(); await soundRef.current.unloadAsync(); soundRef.current = null; } } catch { /* ignore */ }
  };

  const handleComplete = async () => {
    setStopped(true); await stopAudio(); Vibration.cancel();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const user = auth.currentUser;
    if (user && habitKey) saveHabitLog({ habitId: habitKey, habitName: habitLabel, userId: user.uid, date: todayStr(), status: 'done' }).catch(() => {});
    router.replace('/(tabs)' as never);
  };

  const handleQuit = async () => { setStopped(true); await stopAudio(); Vibration.cancel(); router.replace('/(tabs)' as never); };

  return (
    <View style={S.screen}>
      <StatusBar hidden />
      {/* Ambient glow */}
      <View style={[S.bgGlow, { opacity: phase === 'active' ? 1 : 0.5 }]} pointerEvents="none" />

      {phase === 'countdown' ? (
        /* ── Countdown 3-2-1 ── */
        <View style={S.centerWrap}>
          <View style={S.ringWrap} pointerEvents="none">
            <Animated.View style={[S.outerRing, outerStyle, { borderColor: ACCENT + '55' }]} />
            <View style={[S.midRing, { borderColor: ACCENT + '25' }]} />
            <Animated.View style={[S.innerCircle, innerStyle, { backgroundColor: ACCENT + '18', borderColor: ACCENT + '50' }]}>
              <Text style={[S.countdownNum, { color: ACCENT }]}>{countdown}</Text>
            </Animated.View>
          </View>
          <Text style={S.countdownLabel}>{emoji}  {habitLabel}</Text>
          <Text style={S.countdownSub}>HABIT ALARM ACTIVATED</Text>
        </View>
      ) : (
        /* ── Commitment Screen ── */
        <View style={S.commitWrap}>
          <View style={S.commitTop}>
            <View style={[S.typeBadge, { borderColor: ACCENT + '50', backgroundColor: ACCENT + '12' }]}>
              <Text style={[S.typeBadgeTxt, { color: ACCENT }]}>🌿  HABIT ALARM  ·  LOCKED</Text>
            </View>
            <Animated.View style={[S.emojiRing, innerStyle, { borderColor: ACCENT + '45', backgroundColor: ACCENT + '10' }]}>
              <Text style={S.bigEmoji}>{emoji}</Text>
            </Animated.View>
            <Text style={S.commitHabitName}>{habitLabel}</Text>
            <View style={S.riskBanner}>
              <Text style={S.riskEmoji}>🔥</Text>
              <Text style={S.riskTxt}>Your streak is at risk — act now!</Text>
            </View>
          </View>

          <View style={S.commitBottom}>
            <Text style={S.commitQuestion}>Ready to do this right now?</Text>
            <TouchableOpacity style={[S.commitBtn, { backgroundColor: ACCENT }]} onPress={handleComplete} activeOpacity={0.88}>
              <Text style={S.commitBtnTxt}>✊  I COMMIT — I'LL DO IT NOW</Text>
            </TouchableOpacity>
            <TouchableOpacity style={S.skipBtn} onPress={handleQuit} activeOpacity={0.7}>
              <Text style={S.skipTxt}>Skip this time (streak will reset)</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {phase !== 'countdown' && (
        <View style={S.lockBar}>
          <Text style={S.lockBarTxt}>🔒  Dismiss only by committing</Text>
        </View>
      )}
    </View>
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
