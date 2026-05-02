import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, BackHandler, StatusBar,
  Dimensions, Modal, ScrollView, Vibration, AppState, Platform,
} from 'react-native';
import notifee, { AndroidImportance, AndroidCategory, AndroidVisibility } from '@notifee/react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming,
  Easing, withSpring, interpolate, Extrapolation,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { speakBodhi, stopBodhi } from '@/lib/speech';
import { stopNativeAlarmSound, cancelNativeAlarm, setNativeAlarmVolume } from '@/lib/nativeAlarm';
import { getLocalMantraPath } from '@/lib/mantraDownload';
import { store, KEYS } from '@/lib/storage';
import { type AlarmSettings } from '@/lib/notifications';
import { saveHabitLog, todayStr } from '@/lib/habitLogs';
import { auth } from '@/lib/firebase';
import {
  MISSIONS, WAKE_SOUNDS, DEFAULT_MISSION_SETTINGS, MissionSettings,
  getKalaMessage, WAKE_QUOTES,
} from '@/lib/missionAlarm';

const MANTRA_TO_WAKE: Record<string, string> = {
  gayatri: 'gayatri',
  lalitha: 'lalitha',
  shivtandav: 'shiv_tandav',
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
  const [showSnoozeModal, setShowSnoozeModal] = useState(false);
  const [snoozeCountdown, setSnoozeCountdown] = useState<number | null>(null);
  const [snoozedFor, setSnoozedFor] = useState<number | null>(null);
  const [alarmStopped, setAlarmStopped] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const missionStartedRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);

  // ── Audio helpers ──────────────────────────────────────────────────────────
  const stopWakeAudio = async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    } catch { /* ignore */ }
  };

  const playWakeAudio = async (uri: string, startDucked = false) => {
    await stopWakeAudio();
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
        interruptionModeIOS: 1,
        interruptionModeAndroid: 1,
      });
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true, isLooping: true, volume: startDucked ? 0.06 : 1.0 },
      );
      soundRef.current = sound;
    } catch (e) { console.warn('[AlarmRinging] Wake audio error:', e); }
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
    Vibration.vibrate([0, 200, 100, 200]);
  };

  // ── Keep screen awake ───────────────────────────────────────────────────────
  useEffect(() => {
    activateKeepAwakeAsync('alarm-ringing');
    return () => { deactivateKeepAwake('alarm-ringing'); };
  }, []);

  // ── Clock ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setTimeStr(fmtTime()), 15_000);
    return () => clearInterval(t);
  }, []);

  // ── BLOCK hardware back button completely ───────────────────────────────────
  // Note: MainActivity.kt also overrides onBackPressed natively as a second
  // layer of defence. This JS handler is the first layer.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!alarmStopped) {
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
        const id = await notifee.displayNotification({
          id: 'alarm-bttf',
          title: '⏰ Alarm Ringing!',
          body: 'Return to complete your mission and stop the alarm.',
          android: {
            channelId: 'onesutra-alarms-v4',
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
        Vibration.vibrate([0, 400, 200, 400, 200, 400]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
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
        // Re-trigger alarm sounds when snooze ends — restore native volume
        await setNativeAlarmVolume(1.0);
        Vibration.vibrate([0, 600, 300, 600, 300, 600]);
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

      // ── Play correct mantra audio via JS layer ─────────────────────
      if (!cancelled) {
        const wakeSound = WAKE_SOUNDS.find(s => s.id === mantraId) ?? WAKE_SOUNDS[0];
        const localPath = getLocalMantraPath(mantraId);
        const localInfo = await FileSystem.getInfoAsync(localPath).catch(() => ({ exists: false }));
        const audioSrc = (localInfo as any).exists ? (localInfo as any).uri : wakeSound.audioUrl;
        if (audioSrc) await playWakeAudio(audioSrc, settings.bodhiMorningBrief);
      }

      // ── KEEP native AlarmSoundService running ──────────────────────
      // The foreground service handles alarm audio, wake locks, and
      // Home-button relaunch watchdogs. Stopping it (the old code) was
      // the root cause of the "Home button escapes alarm" bug.
      // We do NOT call stopNativeAlarmSound() here — native audio
      // survives Activity backgrounding, Home press, and recents swipe.

      if (settings.bodhiMorningBrief && !cancelled) {
        // Duck native alarm volume while Bodhi speaks, then restore
        await setNativeAlarmVolume(0.06);
        const mission = MISSIONS.find(m => m.id === settings.selectedMission);
        const mantraLabel =
          mantraId === 'lalitha' ? 'Lalitha Sahasranama' :
          mantraId === 'shivtandav' ? 'Shiv Tandav' : 'Gayatri Mantra';
        const hour = new Date().getHours();
        const kalaLine = hour < 10 ? 'the golden morning window is open' : "it's time to lock in";
        const script =
          `Good morning ${name}. It's ${fmtTime()}, ${kalaLine}. Your ${mantraLabel} is playing. ` +
          `Mission today: ${mission?.name}. You're on a ${settings.streak || 1}-day streak — don't break it now. ` +
          `${mission?.hype} Let's go.`;
        speakBodhi(script).then(async () => {
          await setNativeAlarmVolume(1.0);
        });
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      Vibration.vibrate([0, 500, 200, 500]);
    })();
    return () => {
      cancelled = true;
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
    // Native alarm sound keeps playing during mission — stopped in mission.tsx on completion
    await cancelNativeAlarm();
    Vibration.cancel();
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

    await stopAlarmCompletely();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace(`/mission?id=${mission.id}` as never);
  };

  // ── SNOOZE ──────────────────────────────────────────────────────────────────
  const handleSnoozeChoice = async (minutes: number) => {
    setShowSnoozeModal(false);
    setSnoozedFor(minutes);
    // Duck native alarm audio during snooze (service stays alive)
    await setNativeAlarmVolume(0.08);
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
    <View style={S.screen}>
      <StatusBar hidden />

      {/* ── Full-screen ambient glow ── */}
      <View style={[S.ambientGlow, { backgroundColor: mission.color + '12' }]} pointerEvents="none" />
      <View style={[S.ambientGlowBottom, { backgroundColor: mission.color + '08' }]} pointerEvents="none" />

      {/* ── TOP SECTION: Rings + Time ── */}
      <View style={S.topSection}>
        {/* Pulsing ring cluster */}
        <View style={S.ringWrap} pointerEvents="none">
          <Animated.View style={[S.outerRing, outerStyle, { borderColor: mission.color + '50' }]} />
          <Animated.View style={[S.midRing, { borderColor: mission.color + '28' }]} />
          <Animated.View style={[S.innerCircle, innerStyle, { backgroundColor: mission.color + '18', borderColor: mission.color + '40' }]}>
            <Text style={S.ringIcon}>{mission.icon}</Text>
          </Animated.View>
        </View>

        {/* Time */}
        <Text style={S.time}>{timeStr}</Text>
        <Text style={[S.kala, { color: mission.color }]}>{kala.toUpperCase()}</Text>

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
          {/* Quote */}
          <Text style={S.quote}>"{quote}"</Text>

          {/* Mission card */}
          <Animated.View style={shakeStyle}>
            <View style={[S.missionCard, { borderColor: mission.color + '45', backgroundColor: mission.color + '0A' }]}>
              <Text style={[S.missionBadge, { color: mission.color + 'CC' }]}>TODAY'S MISSION</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
                <Text style={{ fontSize: 28 }}>{mission.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={S.missionName}>{mission.name}</Text>
                  <Text style={S.missionTagline}>{mission.tagline}</Text>
                </View>
              </View>
              <View style={[S.missionChip, { backgroundColor: mission.color + '1A', borderColor: mission.color + '50' }]}>
                <Text style={[S.missionChipText, { color: mission.color }]}>{mission.ayuChip}</Text>
              </View>
            </View>
          </Animated.View>

          {/* CTA — Stop Alarm button */}
          <Animated.View style={[btnStyle, { width: '100%' }]}>
            <TouchableOpacity
              style={[S.stopBtn, { backgroundColor: mission.color }]}
              onPress={handleStart}
              activeOpacity={0.88}
            >
              <Text style={S.stopBtnText}>✓  Complete Mission · Stop Alarm</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Snooze button */}
          <TouchableOpacity style={S.snoozeBtn} onPress={() => setShowSnoozeModal(true)} activeOpacity={0.75}>
            <Text style={S.snoozeBtnText}>💤  Snooze</Text>
          </TouchableOpacity>

          {/* Lock badge */}
          <View style={S.lockBadge}>
            <Text style={S.lockText}>🔒  Can't close — complete mission or snooze</Text>
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
    </View>
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
});
