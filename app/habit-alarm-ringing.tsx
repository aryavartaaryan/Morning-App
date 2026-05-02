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
const ACCENT = '#f97316';

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

  // Bring-to-front notification when home pressed
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const bttfId = 'habit-alarm-bttf';
    const fireBttf = async () => {
      try {
        await notifee.createChannel({ id: 'onesutra-habit-alarms', name: 'OneSutra Habit Alarms', importance: AndroidImportance.HIGH, bypassDnd: true, visibility: AndroidVisibility.PUBLIC } as any);
        await notifee.displayNotification({ id: bttfId, title: `${emoji} ${habitLabel}`, body: 'Return to complete your habit.', android: { channelId: 'onesutra-habit-alarms', importance: AndroidImportance.HIGH, category: AndroidCategory.ALARM, visibility: AndroidVisibility.PUBLIC, ongoing: true, fullScreenAction: { id: 'default', launchActivity: 'default' }, pressAction: { id: 'default', launchActivity: 'default' } } as any });
      } catch { /* ignore */ }
    };
    const sub = AppState.addEventListener('change', next => {
      if (!stopped && appStateRef.current === 'active' && (next === 'background' || next === 'inactive')) { appStateRef.current = next; fireBttf(); }
      else if (!stopped && (appStateRef.current === 'background' || appStateRef.current === 'inactive') && next === 'active') { appStateRef.current = next; notifee.cancelNotification(bttfId).catch(() => {}); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); }
      else { appStateRef.current = next; }
    });
    return () => { sub.remove(); notifee.cancelNotification(bttfId).catch(() => {}); };
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
      <View style={S.glowTop} pointerEvents="none" />

      <View style={S.centerWrap}>
        <View style={S.ringWrap} pointerEvents="none">
          <Animated.View style={[S.outerRing, outerStyle, { borderColor: ACCENT + '55' }]} />
          <View style={[S.midRing, { borderColor: ACCENT + '25' }]} />
          <Animated.View style={[S.innerCircle, innerStyle, { backgroundColor: ACCENT + '18', borderColor: ACCENT + '45' }]}>
            {phase === 'countdown'
              ? <Text style={[S.countdownNum, { color: ACCENT }]}>{countdown}</Text>
              : <Text style={S.flameEmoji}>🔥</Text>}
          </Animated.View>
        </View>

        <Text style={S.habitName}>{habitLabel}</Text>

        {phase === 'countdown' ? (
          <View style={{ alignItems: 'center', gap: 4, marginTop: 8 }}>
            <Text style={S.cueMain}>Time for your habit goal!</Text>
            <Text style={S.cueSub}>Do it and hit 'Complete'</Text>
          </View>
        ) : (
          <View style={S.progressBadge}>
            <Text style={{ fontSize: 14 }}>🔥</Text>
            <Text style={S.progressBadgeTxt}>Habit in progress</Text>
          </View>
        )}
      </View>

      <View style={S.lockBadge}><Text style={S.lockTxt}>🔒  Complete your habit to dismiss</Text></View>

      <View style={S.btnRow}>
        <TouchableOpacity style={S.quitBtn} onPress={handleQuit} activeOpacity={0.8}>
          <Text style={S.quitTxt}>Quit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={S.completeBtn} onPress={handleComplete} activeOpacity={0.85}>
          <Text style={S.completeTxt}>✓  Complete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#040410' },
  glowTop: { position: 'absolute', top: 0, left: 0, right: 0, height: height * 0.6, backgroundColor: ACCENT + '10', borderBottomLeftRadius: width, borderBottomRightRadius: width },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  ringWrap: { alignItems: 'center', justifyContent: 'center', width: 230, height: 230, marginBottom: 24 },
  outerRing: { position: 'absolute', width: 230, height: 230, borderRadius: 115, borderWidth: 1.5 },
  midRing: { position: 'absolute', width: 165, height: 165, borderRadius: 83, borderWidth: 1 },
  innerCircle: { width: 110, height: 110, borderRadius: 55, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  countdownNum: { fontSize: 52, fontWeight: '100', letterSpacing: -2 },
  flameEmoji: { fontSize: 48 },
  habitName: { fontSize: 24, fontWeight: '900', color: '#FFFFFF', textAlign: 'center', letterSpacing: -0.5 },
  cueMain: { fontSize: 16, fontWeight: '800', color: '#FFFFFF', textAlign: 'center', marginTop: 2 },
  cueSub: { fontSize: 13, color: '#FFFFFF60', textAlign: 'center', marginTop: 2 },
  progressBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: ACCENT + '18', borderWidth: 1, borderColor: ACCENT + '40', borderRadius: 99, paddingHorizontal: 16, paddingVertical: 8, marginTop: 12 },
  progressBadgeTxt: { fontSize: 13, fontWeight: '800', color: ACCENT },
  lockBadge: { alignSelf: 'center', marginBottom: 16, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: '#FFFFFF05', borderRadius: 99, borderWidth: 1, borderColor: '#FFFFFF0E' },
  lockTxt: { fontSize: 9, color: '#FFFFFF30', fontWeight: '700', letterSpacing: 0.3 },
  btnRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 22, paddingBottom: 44 },
  quitBtn: { flex: 1, borderRadius: 18, paddingVertical: 18, alignItems: 'center', backgroundColor: '#FFFFFF0A', borderWidth: 1, borderColor: '#FFFFFF18' },
  quitTxt: { fontSize: 15, fontWeight: '700', color: '#FFFFFF60' },
  completeBtn: { flex: 2, borderRadius: 18, paddingVertical: 18, alignItems: 'center', backgroundColor: ACCENT },
  completeTxt: { fontSize: 15, fontWeight: '900', color: '#000000EA' },
});
