import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, BackHandler,
  StatusBar, Dimensions, AppState, Platform, NativeModules, ImageBackground,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, Easing,
} from 'react-native-reanimated';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import notifee, { AndroidImportance, AndroidCategory, AndroidVisibility } from '@notifee/react-native';
import { useSoundPlayer } from '@/lib/soundPlayerContext';
import { ALL_SLEEP_SOUNDS } from '@/lib/sleepSoundsData';

const { width, height } = Dimensions.get('window');
const SLEEP_FS_ID = 'sleep-autostart-service';

export default function SleepRingingScreen() {
  const router = useRouter();
  const { soundId: soundIdParam, label: labelParam } = useLocalSearchParams<{ soundId?: string; label?: string }>();
  const soundId = soundIdParam ?? 'light_rain';
  const meta = ALL_SLEEP_SOUNDS.find(s => s.id === soundId) ?? ALL_SLEEP_SOUNDS[0];
  const label = labelParam ?? meta?.label ?? 'Sleep Sound';
  const accent = meta?.color ?? '#60a5fa';
  const bgImage = meta?.imageUri;

  const [dismissed, setDismissed] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const bttfNotifIdRef = useRef<string | null>(null);
  const { stopSound: stopAmbientSound, dismissMoodSheet } = useSoundPlayer();

  // ── Animations ──────────────────────────────────────────────────────────────
  const outerScale   = useSharedValue(1);
  const outerOpacity = useSharedValue(0.35);
  const innerScale   = useSharedValue(1);

  const outerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: outerScale.value }], opacity: outerOpacity.value,
  }));
  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: innerScale.value }],
  }));

  useEffect(() => {
    outerScale.value   = withRepeat(withSequence(withTiming(1.35, { duration: 1400, easing: Easing.inOut(Easing.ease) }), withTiming(1, { duration: 1400 })), -1);
    outerOpacity.value = withRepeat(withSequence(withTiming(0.7, { duration: 1400 }), withTiming(0.15, { duration: 1400 })), -1);
    innerScale.value   = withRepeat(withSequence(withTiming(1.08, { duration: 1000 }), withTiming(1, { duration: 1000 })), -1);
  }, []);

  // ── Keep awake ──────────────────────────────────────────────────────────────
  useEffect(() => {
    activateKeepAwakeAsync('sleepringing');
    return () => { deactivateKeepAwake('sleepringing'); };
  }, []);

  // ── Silence ambient + mood sheet ────────────────────────────────────────────
  useEffect(() => {
    stopAmbientSound(false).catch(() => {});
    dismissMoodSheet();
  }, []);

  // ── Dismiss native overlay if any ───────────────────────────────────────────
  useEffect(() => {
    NativeModules.HabitAlarmModule?.dismissHabitAlarmOverlay?.().catch?.(() => {});
  }, []);

  // ── Play sleep sound directly from bundled asset ─────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (cancelled) return;
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: false,
          interruptionModeIOS: 1,
          interruptionModeAndroid: 1,
        });
        const source = meta?.src ?? require('../assets/sounds/mixkit-light-rain-loop-2393.m4a');
        const { sound } = await Audio.Sound.createAsync(
          source as any,
          { shouldPlay: true, isLooping: true, volume: 1.0 },
        );
        if (cancelled) { sound.unloadAsync().catch(() => {}); return; }
        soundRef.current = sound;
      } catch (e) {
        console.warn('[SleepRinging] audio error:', e);
        try {
          const { sound } = await Audio.Sound.createAsync(
            require('../assets/sounds/mixkit-light-rain-loop-2393.m4a'),
            { shouldPlay: true, isLooping: true, volume: 1.0 },
          );
          if (!cancelled) soundRef.current = sound;
        } catch (e2) { console.warn('[SleepRinging] fallback error:', e2); }
      }
    })();
    return () => {
      cancelled = true;
      if (soundRef.current) {
        soundRef.current.stopAsync().catch(() => {});
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
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
          id: 'arise-soundbath', name: 'SolRize Sound Bath',
          importance: AndroidImportance.HIGH, bypassDnd: true,
          visibility: AndroidVisibility.PUBLIC,
        } as any);
        await notifee.displayNotification({
          id: SLEEP_FS_ID,
          title: `${meta?.emoji ?? '🌙'}  Sleep Sounds`,
          body: `${label} is playing · tap to return.`,
          android: {
            channelId: 'arise-soundbath',
            importance: AndroidImportance.HIGH,
            category: AndroidCategory.ALARM,
            visibility: AndroidVisibility.PUBLIC,
            ongoing: true,
            asForegroundService: true,
            fullScreenAction: { id: 'default', launchActivity: 'default' },
            pressAction: { id: 'default', launchActivity: 'default' },
          } as any,
        });
        started = true;
      } catch (e) { console.warn('[SleepRinging] fg service:', e); }
    })();
    return () => { if (started) notifee.cancelNotification(SLEEP_FS_ID).catch(() => {}); };
  }, []);

  // ── Back button ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleDismiss();
      return true;
    });
    return () => sub.remove();
  }, []);

  // ── Re-open when HOME pressed (bttf pattern) ─────────────────────────────────
  useEffect(() => {
    if (dismissed) return;
    const BTTF = 'sleep-bttf';
    const fireBttf = async () => {
      if (Platform.OS !== 'android') return;
      try {
        await notifee.createChannel({ id: 'alarm-bttf-silent', name: 'Alarm Return Prompt', importance: AndroidImportance.HIGH });
        await notifee.displayNotification({
          id: BTTF,
          title: `${meta?.emoji ?? '🌙'}  Sleep Sound Playing`,
          body: 'Tap to return.',
          android: {
            channelId: 'alarm-bttf-silent', importance: AndroidImportance.HIGH,
            category: AndroidCategory.ALARM, visibility: AndroidVisibility.PUBLIC,
            ongoing: true, asForegroundService: false,
            fullScreenAction: { id: 'default', launchActivity: 'default' },
            pressAction: { id: 'default', launchActivity: 'default' },
          } as any,
        });
        bttfNotifIdRef.current = BTTF;
      } catch {}
    };
    const cancelBttf = () => {
      notifee.cancelNotification(bttfNotifIdRef.current ?? BTTF).catch(() => {});
      bttfNotifIdRef.current = null;
    };
    const sub = AppState.addEventListener('change', next => {
      if (!dismissed && appStateRef.current === 'active' && (next === 'background' || next === 'inactive')) {
        appStateRef.current = next; fireBttf();
      } else if (!dismissed && (appStateRef.current === 'background' || appStateRef.current === 'inactive') && next === 'active') {
        appStateRef.current = next; cancelBttf();
      } else { appStateRef.current = next; }
    });
    return () => { sub.remove(); cancelBttf(); };
  }, [dismissed]);

  const stopSound = async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    } catch { /* ignore */ }
  };

  const handleDismiss = async () => {
    setDismissed(true);
    await stopSound();
    notifee.cancelNotification(SLEEP_FS_ID).catch(() => {});
    notifee.cancelNotification(bttfNotifIdRef.current ?? 'sleep-bttf').catch(() => {});
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace('/(tabs)/sleep' as never);
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
    const t = setInterval(() => setTimeStr(fmtTime()), 15_000);
    return () => clearInterval(t);
  }, []);

  const catLabel = () => {
    const c = meta?.cat ?? 'Nature';
    if (c === 'Sacred')  return '🕉  Sacred & Healing';
    if (c === 'Rain')    return '🌧  Rain & Storms';
    if (c === 'Ocean')   return '🌊  Ocean & Water';
    return '🌿  Nature & Ambient';
  };

  return (
    <ImageBackground
      source={bgImage ? { uri: bgImage } : undefined}
      style={S.screen}
      imageStyle={{ opacity: 0.5 }}
    >
      <StatusBar hidden />

      {/* Deep gradient overlay */}
      <LinearGradient
        colors={['rgba(1,3,18,0.85)', 'rgba(1,3,18,0.12)', 'rgba(1,3,18,0.92)']}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Tinted ambient glow */}
      <View style={[S.glow, { backgroundColor: accent + '14' }]} pointerEvents="none" />

      {/* ── TOP: chip ── */}
      <View style={S.topArea}>
        <View style={[S.chip, { borderColor: accent + '55', backgroundColor: accent + '18' }]}>
          <View style={[S.liveDot, { backgroundColor: accent }]} />
          <Text style={{ fontSize: 13 }}>{meta?.emoji ?? '🌙'}</Text>
          <Text style={[S.chipLabel, { color: accent }]}>SLEEP MODE</Text>
        </View>
      </View>

      {/* ── CENTER: Orb + Sound Name ── */}
      <View style={S.centerArea}>
        <View style={S.orbWrap} pointerEvents="none">
          <Animated.View style={[S.outerRing, outerStyle, { borderColor: accent + '45' }]} />
          <View style={[S.midRing, { borderColor: accent + '25' }]} />
          <Animated.View style={[S.innerCircle, innerStyle, { backgroundColor: accent + '1A', borderColor: accent + '45' }]}>
            <Text style={S.orbIcon}>{meta?.emoji ?? '🌙'}</Text>
          </Animated.View>
        </View>

        <Text style={S.sleepLabel}>SLEEP SOUNDS</Text>
        <Text style={[S.soundName, { color: accent }]}>{label}</Text>

        <View style={[S.catBadge, { borderColor: accent + '40', backgroundColor: accent + '10' }]}>
          <Text style={[S.catBadgeText, { color: accent + 'CC' }]}>{catLabel()}</Text>
        </View>

        <Text style={S.time}>{timeStr}</Text>
      </View>

      {/* ── BOTTOM: Dismiss button ── */}
      <View style={S.bottomArea}>
        <Text style={S.hintText}>Auto-started at your scheduled time · sleep well 🌙</Text>
        <TouchableOpacity
          style={[S.dismissBtn, { backgroundColor: accent, shadowColor: accent }]}
          onPress={handleDismiss}
          activeOpacity={0.85}
        >
          <Text style={S.dismissIcon}>🌙</Text>
          <Text style={S.dismissTxt}>Dismiss Sleep Sound</Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
}

const S = StyleSheet.create({
  screen:        { flex: 1, backgroundColor: '#01030F' },
  glow:          { position: 'absolute', top: 0, left: 0, right: 0, height: height * 0.55, borderBottomLeftRadius: width * 0.7, borderBottomRightRadius: width * 0.7 },

  topArea:       { paddingTop: 52, alignItems: 'center' },
  chip:          { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 7 },
  liveDot:       { width: 6, height: 6, borderRadius: 3 },
  chipLabel:     { fontSize: 9, fontWeight: '900', letterSpacing: 1.8 },

  centerArea:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  orbWrap:       { alignItems: 'center', justifyContent: 'center', width: 240, height: 240 },
  outerRing:     { position: 'absolute', width: 240, height: 240, borderRadius: 120, borderWidth: 1.5 },
  midRing:       { position: 'absolute', width: 170, height: 170, borderRadius: 85, borderWidth: 1 },
  innerCircle:   { width: 112, height: 112, borderRadius: 56, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  orbIcon:       { fontSize: 46 },

  sleepLabel:    { fontSize: 11, fontWeight: '900', color: '#FFFFFF40', letterSpacing: 3.5, marginTop: 8 },
  soundName:     { fontSize: 32, fontWeight: '100', letterSpacing: -0.5, textAlign: 'center', paddingHorizontal: 32 },
  catBadge:      { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 99, paddingHorizontal: 16, paddingVertical: 6 },
  catBadgeText:  { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  time:          { fontSize: 15, color: '#FFFFFF35', fontWeight: '300', letterSpacing: 1, marginTop: 4 },

  bottomArea:    { paddingHorizontal: 28, paddingBottom: 52, alignItems: 'center', gap: 14 },
  hintText:      { fontSize: 11, color: '#FFFFFF28', textAlign: 'center', fontWeight: '500', letterSpacing: 0.3 },
  dismissBtn:    { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 20, paddingVertical: 20, shadowOpacity: 0.35, shadowRadius: 18, elevation: 8 },
  dismissIcon:   { fontSize: 18 },
  dismissTxt:    { fontSize: 16, fontWeight: '900', color: '#000000CC', letterSpacing: 0.2 },
});
