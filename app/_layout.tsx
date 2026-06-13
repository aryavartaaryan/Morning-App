'use client';
import { Component, useEffect, useRef, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, AppState, View, Animated, Dimensions, StyleSheet, Text, NativeModules, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import {
  Nunito_300Light, Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold,
  Nunito_800ExtraBold, Nunito_900Black,
} from '@expo-google-fonts/nunito';
import { DancingScript_600SemiBold } from '@expo-google-fonts/dancing-script';
import * as SplashScreen from 'expo-splash-screen';
import { useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { store, KEYS } from '@/lib/storage';
import { ensureAllMantrasDownloaded } from '@/lib/mantraDownload';
import { ensureAllBgsCachedWithProgress, getBgSourceSync, isBgFullyCached, bgWarmup, BG_URLS } from '@/lib/bgImages';
import { prefetchAllSoundImagesWithProgress, warmSoundImageMap, prefetchCriticalAlarmImages } from '@/lib/soundImagePreload';
import Svg, { Circle } from 'react-native-svg';
import { scheduleHabitReminders, setupNotificationChannel, NOTIFICATION_SPEECHES } from '@/lib/notifications';
import { getInitialAlarmNotification, requestAllAlarmPermissions, checkAndRescheduleDaily, ALARM_NOTIF_ID } from '@/lib/nativeAlarm';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { scheduleAllNativeReminders, getInitialReminderNotification, REMINDER_DATA_TYPE } from '@/lib/nativeReminders';
import { speakBodhi } from '@/lib/speech';
import { Colors } from '@/constants/theme';
import { SoundPlayerProvider, useSoundPlayer } from '@/lib/soundPlayerContext';
import { BgProvider } from '@/lib/bgContext';
import { MoodSheet } from '@/components/MoodSheet';
import { CrashToast } from '@/components/CrashToast';
import { installCrashToast, ToastLogger } from '@/lib/toastLogger';
import { LinearGradient } from 'expo-linear-gradient';
import type { MoodKey } from '@/components/MoodSheet';

SplashScreen.preventAutoHideAsync();

// Install global crash logger as early as possible (before any component mounts)
installCrashToast();

// ─── React render-tree error boundary ────────────────────────────────────────
class AppErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean; errorMsg: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMsg: error?.message ?? String(error) };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    const stack = info?.componentStack?.slice(0, 300) ?? '';
    ToastLogger.push(
      `🔴 RENDER ERROR\n${error?.message ?? String(error)}\n${stack}`,
      'crash'
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#0A0005', alignItems: 'center', justifyContent: 'center', padding: 28 }}>
          <Text style={{ fontSize: 36, marginBottom: 14 }}>💥</Text>
          <Text style={{ fontSize: 16, fontWeight: '800', color: '#ef4444', textAlign: 'center', marginBottom: 10 }}>Render Crash</Text>
          <Text style={{ fontSize: 11, color: '#FFFFFF45', textAlign: 'center', fontFamily: 'monospace', lineHeight: 18 }} selectable>
            {this.state.errorMsg}
          </Text>
          <Text style={{ fontSize: 10, color: '#FFFFFF20', marginTop: 20 }}>See toast overlay for full details</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const { height: SH } = Dimensions.get('window');

function SplashOverlay({ onDone, bgUri }: { onDone: () => void; bgUri: string }) {
  const bgScale  = useRef(new Animated.Value(1.04)).current;  // Ken Burns start: slightly zoomed
  const glowOp   = useRef(new Animated.Value(0)).current;
  const titleOp  = useRef(new Animated.Value(0)).current;
  const titleSc  = useRef(new Animated.Value(0.78)).current;
  const subOp    = useRef(new Animated.Value(0)).current;
  const screenOp = useRef(new Animated.Value(1)).current;
  const screenSc = useRef(new Animated.Value(1.0)).current;   // zoom-out on exit

  useEffect(() => {
    // Ken Burns: bg image slowly zooms across the full splash
    Animated.timing(bgScale, { toValue: 1.10, duration: 4200, useNativeDriver: true }).start();

    // Title + glow appear together immediately (bg is already on disk)
    Animated.parallel([
      // Logo fades + springs in immediately
      Animated.timing(titleOp, { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.spring(titleSc, { toValue: 1, tension: 55, friction: 9, useNativeDriver: true }),
      // Glow orb also fades in together
      Animated.timing(glowOp, { toValue: 0.18, duration: 700, useNativeDriver: true }),
    ]).start();

    // Tagline fades in 400ms after logo
    Animated.sequence([
      Animated.delay(400),
      Animated.timing(subOp, { toValue: 1, duration: 450, useNativeDriver: true }),
      // HOLD: total splash ~4.5s (400 + 450 + 2650 hold + 650 exit)
      Animated.delay(2650),
      // Exit: fade out + subtle zoom-out
      Animated.parallel([
        Animated.timing(screenOp, { toValue: 0, duration: 650, useNativeDriver: true }),
        Animated.timing(screenSc, { toValue: 0.95, duration: 650, useNativeDriver: true }),
      ]),
    ]).start(() => onDone());
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      style={[SS.overlay, { opacity: screenOp, transform: [{ scale: screenSc }] }]}
    >
      {/* Background image with Ken Burns zoom */}
      {!!bgUri && (
        <Animated.Image
          source={{ uri: bgUri }}
          style={[StyleSheet.absoluteFillObject, { transform: [{ scale: bgScale }] }]}
          resizeMode="cover"
        />
      )}
      {/* Dark overlay so text remains readable over bright background images */}
      <View style={SS.bgOverlay} />
      {/* Ambient glow orb */}
      <Animated.View style={[SS.glowOrb, { opacity: glowOp }]} />
      {/* Center */}
      <View style={SS.center}>
        <Animated.Text style={[SS.arise, { opacity: titleOp, transform: [{ scale: titleSc }] }]}>
          Nada
        </Animated.Text>
        <Animated.View style={[SS.subBlock, { opacity: subOp }]}>
          <Text style={SS.tagline}>YOUR DAY  ·  BY DESIGN</Text>
          <View style={SS.accentLine} />
        </Animated.View>
      </View>
      {/* Footer */}
      <Animated.Text style={[SS.version, { opacity: subOp }]}>NADA  ·  V 1.0</Animated.Text>
    </Animated.View>
  );
}

const SS = StyleSheet.create({
  overlay:    { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, backgroundColor: '#04030F', alignItems: 'center' },
  bgOverlay:  { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(4,3,15,0.42)' },
  glowOrb:    { position: 'absolute', top: SH * 0.22, alignSelf: 'center', width: 360, height: 360, borderRadius: 180, backgroundColor: '#F5820A' },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  arise:      { fontSize: 96, color: '#FFFFFF', fontFamily: 'DancingScript_600SemiBold', letterSpacing: 8 },
  subBlock:   { alignItems: 'center', gap: 14 },
  tagline:    { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.35)', letterSpacing: 6 },
  accentLine: { width: 64, height: 1.5, backgroundColor: '#F5820A', opacity: 0.70, borderRadius: 1 },
  version:    { fontSize: 9, color: 'rgba(255,255,255,0.15)', letterSpacing: 5, fontWeight: '600', paddingBottom: 50 },
});

// ─── Download progress screen (first-install gate) ─────────────────────────
// Only shows a clean progress ring — NO Nada logo, NO tagline.
// This screen is shown ONLY on first install while BG images are downloading.
function DownloadScreen({ progress, label }: { progress: number; label: string }) {
  const fadeIn = useRef(new Animated.Value(1)).current;

  const pct    = Math.round(Math.min(progress, 1) * 100);
  const R      = 58;
  const STRKW  = 6;
  const circ   = 2 * Math.PI * R;
  const offset = circ * (1 - Math.min(progress, 1));

  return (
    <Animated.View pointerEvents="none" style={[DS.screen, { opacity: fadeIn }]}>
      <LinearGradient colors={['#04030F', '#0C0820', '#04030F']} style={StyleSheet.absoluteFillObject} />
      <View style={DS.center}>
        {/* Ring only — pct inside */}
        <View style={DS.ringWrap}>
          <Svg width={138} height={138} viewBox="0 0 138 138">
            <Circle cx={69} cy={69} r={R} stroke="rgba(255,255,255,0.08)" strokeWidth={STRKW} fill="none" />
            <Circle
              cx={69} cy={69} r={R}
              stroke="#F5820A"
              strokeWidth={STRKW}
              fill="none"
              strokeDasharray={`${circ}`}
              strokeDashoffset={`${offset}`}
              strokeLinecap="round"
              rotation={-90}
              origin="69, 69"
            />
          </Svg>
          <View style={DS.pctWrap}>
            <Text style={DS.pctNum}>{pct}</Text>
            <Text style={DS.pctSign}>%</Text>
          </View>
        </View>
        <Text style={DS.statusLabel}>{label}</Text>
      </View>
    </Animated.View>
  );
}

const DS = StyleSheet.create({
  screen:      { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, alignItems: 'center', backgroundColor: '#04030F' },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
  ringWrap:    { width: 138, height: 138, alignItems: 'center', justifyContent: 'center' },
  pctWrap:     { position: 'absolute', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center' },
  pctNum:      { fontSize: 32, color: '#FFFFFF', fontFamily: 'Nunito_700Bold' },
  pctSign:     { fontSize: 14, color: 'rgba(255,255,255,0.40)', fontFamily: 'Nunito_400Regular', marginBottom: 4, marginLeft: 1 },
  statusLabel: { fontSize: 12, color: 'rgba(255,255,255,0.40)', fontFamily: 'Nunito_400Regular', letterSpacing: 0.5 },
});

function AuthGuard({ onAuthReady }: { onAuthReady: () => void }) {
  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const signalled = useRef(false);

  useEffect(() => {
    // Wait until Expo Router's navigation container is fully mounted.
    // Without this guard, router.replace() throws the
    // "Attempted to navigate before mounting the Root Layout" crash.
    if (!navigationState?.key) return;
    if (signalled.current) return;
    signalled.current = true;
    // Init alarm permissions + notification channel silently
    try {
      setupNotificationChannel().catch(() => {});
      scheduleHabitReminders();
      scheduleAllNativeReminders().catch(() => {});
      checkAndRescheduleDaily().catch(() => {});
      setTimeout(() => requestAllAlarmPermissions().catch(() => {}), 2500);
      setTimeout(() => {
        ImagePicker.requestCameraPermissionsAsync().catch(() => {});
        ImagePicker.requestMediaLibraryPermissionsAsync().catch(() => {});
        // Request location permission for home page weather + walk distance tracking
        Location.requestForegroundPermissionsAsync().catch(() => {});
        // NOTE: Pedometer (Physical Activity) permission is NOT requested here.
        // It is requested contextually in walk.tsx when the user taps "Start Walk",
        // so the system dialog appears with clear user intent.
      }, 3500);
    } catch { /* Expo Go */ }
    // Route straight to tabs unless already there or on alarm screens.
    // ALARM DEEP-LINK RACE FIX: On a cold start (app killed) via an alarm deep link,
    // Expo Router may not have processed Linking.getInitialURL() before this guard
    // fires. If we redirect to /(tabs) first, the user sees the homepage instead of
    // the alarm screen. Fix: await the initial URL and skip the redirect when the
    // app was opened via an alarm deep link — Expo Router will navigate there itself.
    (async () => {
      const root = segments[0] as string;
      const alarmRoutes = ['(tabs)', 'wake-alarm-ringing', 'alarm-ringing', 'habit-alarm-ringing', 'mission', 'soundbath-ringing', 'sleep-ringing'];
      if (!alarmRoutes.includes(root)) {
        let shouldRedirect = true;
        try {
          const initialUrl = await Linking.getInitialURL();
          if (initialUrl && /soundbath-ringing|habit-alarm-ringing|wake-alarm-ringing|alarm-ringing|sleep-ringing/.test(initialUrl)) {
            shouldRedirect = false;
          }
        } catch { /* ignore */ }
        if (shouldRedirect) {
          router.replace('/(tabs)' as never);
        }
      }
      setTimeout(() => onAuthReady(), 80);
    })().catch(() => {
      router.replace('/(tabs)' as never);
      setTimeout(() => onAuthReady(), 80);
    });
  }, [navigationState?.key]);

  return null;
}

function BodhiNotificationListener() {
  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  // Guard: ensure we navigate to /alarm-ringing at most once per alarm cycle.
  // Multiple navigation calls re-mount the component, restarting audio playback.
  const alarmRoutedRef = useRef(false);
  // Guard: prevent double-navigation to habit/soundbath alarm screens.
  const habitAlarmRoutedRef = useRef(false);
  // Always-fresh segments ref — used inside async callbacks to avoid stale closure.
  const segmentsRef = useRef<string[]>([]);
  const navReady = !!navigationState?.key;

  // Reset the guard whenever we leave the alarm-ringing screen so the next
  // alarm cycle can trigger routing again.
  useEffect(() => {
    if (!(segments as string[]).includes('wake-alarm-ringing') && !(segments as string[]).includes('alarm-ringing')) {
      alarmRoutedRef.current = false;
    }
  }, [segments]);

  // Keep segmentsRef current so async callbacks always read the latest route.
  useEffect(() => { segmentsRef.current = segments as string[]; }, [segments]);

  // Reset habitAlarmRoutedRef when leaving habit/soundbath alarm screens so
  // the next alarm cycle can trigger routing again.
  useEffect(() => {
    const segs = segments as string[];
    if (!segs.includes('soundbath-ringing') && !segs.includes('habit-alarm-ringing')) {
      habitAlarmRoutedRef.current = false;
    }
  }, [segments]);

  // ── When app is LAUNCHED by wake alarm (phone was sleeping/app was killed) ──
  useEffect(() => {
    if (!navReady) return;
    getInitialAlarmNotification().then(async (initial) => {
      if (initial && !alarmRoutedRef.current) {
        // Guard: if the alarm was already fully handled (mission completed), skip routing.
        // wasAlarmFired() can stay true on the native side after a completed alarm cycle
        // causing a crash loop where alarm-ringing remounts into a stopped native service.
        const handled = await AsyncStorage.getItem('onesutra_alarm_handled_v1').catch(() => null);
        if (handled && Date.now() - Number(handled) < 43_200_000) {
          alarmRoutedRef.current = true; // suppress future routing this session
          return;
        }
        const missionId = await AsyncStorage.getItem('onesutra_mission_active_v1').catch(() => null);
        alarmRoutedRef.current = true;
        if (missionId && !(segments as string[]).includes('mission')) {
          console.log('[Layout] App launched mid-mission → routing to /mission');
          setTimeout(() => router.replace(`/mission?id=${missionId}` as never), 150);
        } else if (!missionId) {
          console.log('[Layout] App launched from alarm notification → routing to /wake-alarm-ringing');
          setTimeout(() => router.replace('/wake-alarm-ringing' as never), 150);
        }
      }
    }).catch(() => { });
  }, [navReady]);

  // ── When app resumes from BACKGROUND (not killed) and alarm fired ──────────
  // The native AlarmSoundService.launchApp() already brings the app to the
  // alarm-ringing screen on the first call. This AppState listener is a
  // belt-and-suspenders fallback; the guard prevents it from pushing a second
  // time which would re-mount the component and restart audio playback.
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active') return;
      if (alarmRoutedRef.current) return; // already routed this alarm cycle
      if ((segments as string[]).includes('wake-alarm-ringing') || (segments as string[]).includes('alarm-ringing')) return; // already on screen
      getInitialAlarmNotification().then(async (fired) => {
        if (fired && !alarmRoutedRef.current && !(segments as string[]).includes('wake-alarm-ringing') && !(segments as string[]).includes('alarm-ringing')) {
          // Guard: skip routing if alarm was already handled — prevents crash loop
          // caused by wasAlarmFired() persisting after a completed alarm cycle.
          const handled = await AsyncStorage.getItem('onesutra_alarm_handled_v1').catch(() => null);
          if (handled && Date.now() - Number(handled) < 43_200_000) {
            alarmRoutedRef.current = true;
            return;
          }
          const missionId = await AsyncStorage.getItem('onesutra_mission_active_v1').catch(() => null);
          alarmRoutedRef.current = true;
          if (missionId) {
            if (!(segments as string[]).includes('mission')) {
              console.log('[Layout] App foregrounded mid-mission → /mission');
              router.push(`/mission?id=${missionId}` as never);
            }
          } else {
            console.log('[Layout] App foregrounded from alarm (background path) → /wake-alarm-ringing');
            router.push('/wake-alarm-ringing' as never);
          }
        }
      }).catch(() => { });
    });
    return () => sub.remove();
  }, [segments]);

  // ── When alarm fires while app is already in the FOREGROUND ─────────────────
  // AppState does NOT change when the app is already active, so the listener
  // above never fires in this case. AlarmSoundService.launchApp() sends the
  // deep-link URI arise://alarm-ringing via onNewIntent → React Native Linking
  // fires the 'url' event. Without this listener the alarm screen is never
  // navigated to for foreground alarms — the user sees the native overlay but
  // the JS alarm-ringing screen never mounts.
  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }: { url: string }) => {
      if (!url.includes('alarm-ringing') && !url.includes('wake-alarm-ringing')) return;
      if (alarmRoutedRef.current) return;
      if (segmentsRef.current.includes('wake-alarm-ringing') || segmentsRef.current.includes('alarm-ringing')) return;
      (async () => {
        const handled = await AsyncStorage.getItem('onesutra_alarm_handled_v1').catch(() => null);
        if (handled && Date.now() - Number(handled) < 43_200_000) {
          alarmRoutedRef.current = true; return;
        }
        const fired = await getInitialAlarmNotification().catch(() => false);
        if (!fired || alarmRoutedRef.current) return;
        alarmRoutedRef.current = true;
        router.replace('/wake-alarm-ringing' as never);
      })().catch(() => {});
    });
    return () => sub.remove();
  }, []);

  // ── When app is LAUNCHED by a habit alarm fullScreenAction (app was killed) ───
  // index.js background handler writes PENDING_HABIT_KEY to AsyncStorage on
  // EventType.DELIVERED. We read + clear it here so the alarm screen opens
  // automatically even when getInitialNotification() returns null (fullScreen
  // action launches the activity without a user "tap").
  //
  // RACE-CONDITION FIX: The fullScreenAction intent launches MainActivity
  // *concurrently* with onBackgroundEvent writing to AsyncStorage. A single
  // immediate read races and loses — poll every 350 ms for up to 2.1 s so
  // we catch the key regardless of OEM scheduling jitter.
  useEffect(() => {
    const PENDING_HABIT_KEY = 'onesutra_pending_habit_v1';
    let cancelled = false;

    const navigateToHabitAlarm = (raw: string) => {
      if (cancelled) return;
      AsyncStorage.removeItem(PENDING_HABIT_KEY).catch(() => {});
      try {
        const alarm = JSON.parse(raw);
        const hk  = encodeURIComponent(alarm.habitKey  ?? '');
        const he  = encodeURIComponent(alarm.habitEmoji ?? '🌿');
        const hl  = encodeURIComponent(alarm.label      ?? 'Habit Alarm');
        const at  = alarm.alarmType ?? 'habit';
        const sid = encodeURIComponent(alarm.soundId    ?? 'morning_birds');
        if (at === 'soundbath') {
          const lbl = encodeURIComponent(alarm.label ?? 'Sound Bath');
          setTimeout(() => { if (!cancelled) router.replace(`/soundbath-ringing?soundId=${sid}&label=${lbl}` as never); }, 400);
        } else {
          setTimeout(() => { if (!cancelled) router.replace(`/habit-alarm-ringing?habitKey=${hk}&habitEmoji=${he}&label=${hl}&alarmType=${at}&mantraId=${sid}` as never); }, 400);
        }
      } catch { /* ignore parse error */ }
    };

    // Poll up to 6 × 350 ms = 2.1 s — covers the race where onBackgroundEvent
    // hasn't finished writing to AsyncStorage when MainActivity is already up.
    const pollPendingHabit = async () => {
      for (let attempt = 0; attempt < 6; attempt++) {
        if (cancelled) return;
        try {
          const raw = await AsyncStorage.getItem(PENDING_HABIT_KEY);
          if (raw) { navigateToHabitAlarm(raw); return; }
        } catch { /* ignore */ }
        await new Promise<void>(resolve => setTimeout(resolve, 350));
      }
    };
    pollPendingHabit().catch(() => {});

    // Belt-and-suspenders: also check when app resumes from background
    // (covers the edge case where the app was backgrounded, not killed).
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      AsyncStorage.getItem(PENDING_HABIT_KEY).then((raw) => {
        if (raw) navigateToHabitAlarm(raw);
      }).catch(() => {});
    });

    return () => {
      cancelled = true;
      appStateSub.remove();
    };
  }, []);

  // ── When app is LAUNCHED by a soundbath alarm fullScreenAction (app was killed) ──
  // RACE-CONDITION FIX: onBackgroundEvent writes onesutra_pending_soundbath_v1
  // concurrently with MainActivity launching. A single immediate read races and
  // loses on OEM devices — poll every 350 ms for up to 2.1 s (same pattern as
  // PENDING_HABIT_KEY above) so we catch the key regardless of scheduling jitter.
  useEffect(() => {
    const PENDING_SB_KEY = 'onesutra_pending_soundbath_v1';
    let cancelled = false;

    const navigateToSoundbath = (raw: string) => {
      if (cancelled) return;
      AsyncStorage.removeItem(PENDING_SB_KEY).catch(() => {});
      try {
        const alarm = JSON.parse(raw);
        const sid = encodeURIComponent(alarm.soundId ?? 'morning_birds');
        const lbl = encodeURIComponent(alarm.label ?? 'Sound Bath');
        setTimeout(() => { if (!cancelled) router.replace(`/soundbath-ringing?soundId=${sid}&label=${lbl}` as never); }, 400);
      } catch { /* ignore parse error */ }
    };

    const pollPendingSoundbath = async () => {
      for (let attempt = 0; attempt < 6; attempt++) {
        if (cancelled) return;
        try {
          const raw = await AsyncStorage.getItem(PENDING_SB_KEY);
          if (raw) { navigateToSoundbath(raw); return; }
        } catch { /* ignore */ }
        await new Promise<void>(resolve => setTimeout(resolve, 350));
      }
    };
    pollPendingSoundbath().catch(() => {});

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      AsyncStorage.getItem(PENDING_SB_KEY).then((raw) => {
        if (raw) navigateToSoundbath(raw);
      }).catch(() => {});
    });

    return () => {
      cancelled = true;
      appStateSub.remove();
    };
  }, []);

  // ── SOUNDBATH DEEP-LINK RACE FIX: native SharedPrefs fallback ────────────────
  // Problem: HabitAlarmSoundService fires the deep-link solrize://soundbath-ringing
  // via launchApp(). On a cold start or background resume, AuthGuard sometimes runs
  // before Expo Router processes the deep-link intent, sees segments[0] ≠ 'soundbath-
  // ringing', and redirects to /(tabs). pollPendingSoundbath cannot recover because
  // HabitAlarmSoundService (native AlarmManager path) NEVER writes
  // onesutra_pending_soundbath_v1 to AsyncStorage — only onBackgroundEvent (Notifee
  // path) does that.
  // Fix: read native habit_alarm_prefs SharedPreferences directly via the new
  // getActiveHabitAlarmParams() bridge method. If alarmType === 'soundbath' and we
  // are not already on the alarm screen, navigate there. Guarded by
  // habitAlarmRoutedRef to prevent double-navigation (which would restart audio).
  useEffect(() => {
    if (!navReady) return;
    let cancelled = false;

    const checkNativeSoundbathAlarm = async () => {
      if (cancelled || habitAlarmRoutedRef.current) return;
      const freshSegs = segmentsRef.current;
      if (
        freshSegs.includes('soundbath-ringing') ||
        freshSegs.includes('habit-alarm-ringing') ||
        freshSegs.includes('alarm-ringing')
      ) {
        habitAlarmRoutedRef.current = true;
        return;
      }
      try {
        const params = await (NativeModules.HabitAlarmModule as any)?.getActiveHabitAlarmParams?.();
        if (!params || cancelled || habitAlarmRoutedRef.current) return;
        const latestSegs = segmentsRef.current;
        if (
          latestSegs.includes('soundbath-ringing') ||
          latestSegs.includes('habit-alarm-ringing') ||
          latestSegs.includes('alarm-ringing')
        ) {
          habitAlarmRoutedRef.current = true;
          return;
        }
        habitAlarmRoutedRef.current = true;
        if (params.alarmType === 'soundbath') {
          const sid = encodeURIComponent(params.habitKey ?? 'morning_birds');
          const lbl = encodeURIComponent(params.habitLabel ?? 'Sound Bath');
          console.log('[Layout] Native soundbath fallback → /soundbath-ringing');
          router.replace(`/soundbath-ringing?soundId=${sid}&label=${lbl}` as never);
        }
      } catch { /* ignore */ }
    };

    checkNativeSoundbathAlarm().catch(() => {});

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      checkNativeSoundbathAlarm().catch(() => {});
    });

    return () => {
      cancelled = true;
      appStateSub.remove();
    };
  }, [navReady]);

  // ── When app is LAUNCHED by a sleep auto-start fullScreenAction (app was killed) ──
  // RACE-CONDITION FIX: same polling pattern as soundbath and PENDING_HABIT_KEY.
  useEffect(() => {
    const PENDING_SLEEP_KEY = 'onesutra_pending_sleep_v1';
    let cancelled = false;

    const navigateToSleep = (raw: string) => {
      if (cancelled) return;
      AsyncStorage.removeItem(PENDING_SLEEP_KEY).catch(() => {});
      try {
        const alarm = JSON.parse(raw);
        const sid = encodeURIComponent(alarm.soundId ?? 'light_rain');
        const lbl = encodeURIComponent(alarm.label ?? 'Sleep Sound');
        setTimeout(() => { if (!cancelled) router.replace(`/sleep-ringing?soundId=${sid}&label=${lbl}` as never); }, 400);
      } catch { /* ignore parse error */ }
    };

    const pollPendingSleep = async () => {
      for (let attempt = 0; attempt < 6; attempt++) {
        if (cancelled) return;
        try {
          const raw = await AsyncStorage.getItem(PENDING_SLEEP_KEY);
          if (raw) { navigateToSleep(raw); return; }
        } catch { /* ignore */ }
        await new Promise<void>(resolve => setTimeout(resolve, 350));
      }
    };
    pollPendingSleep().catch(() => {});

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      AsyncStorage.getItem(PENDING_SLEEP_KEY).then((raw) => {
        if (raw) navigateToSleep(raw);
      }).catch(() => {});
    });

    return () => {
      cancelled = true;
      appStateSub.remove();
    };
  }, []);

  // ── When app is LAUNCHED by a notifee notification (habit alarm / evening mantra) ──
  useEffect(() => {
    if (!navReady) return;
    try {
      const notifee = require('@notifee/react-native').default;
      notifee.getInitialNotification().then((initial: any) => {
        if (!initial) return;
        const data = initial.notification?.data as Record<string, string> | undefined;
        if (data?.type === 'evening-mantra') {
          setTimeout(() => router.replace('/habit-alarm-ringing?habitKey=evening_mantra&habitEmoji=%F0%9F%94%B1&label=Shiv%20Sankalpa%20Suktam&mantraId=shiv_sankalpa_suktam' as never), 300);
        } else if (data?.type === 'soundbath-alarm') {
          const sid = encodeURIComponent(data?.soundId ?? 'morning_birds');
          const lbl = encodeURIComponent(data?.label ?? 'Sound Bath');
          setTimeout(() => router.replace(`/soundbath-ringing?soundId=${sid}&label=${lbl}` as never), 300);
        } else if (data?.type === 'sleep-autostart') {
          const sid = encodeURIComponent(data?.soundId ?? 'light_rain');
          const lbl = encodeURIComponent(data?.label ?? 'Sleep Sound');
          setTimeout(() => router.replace(`/sleep-ringing?soundId=${sid}&label=${lbl}` as never), 300);
        } else if (data?.type === 'habit-alarm') {
          const hk = encodeURIComponent(data?.habitKey ?? data?.alarmId ?? '');
          const he = encodeURIComponent(data?.habitEmoji ?? '🌿');
          const hl = encodeURIComponent(data?.label ?? 'Habit Alarm');
          const at = data?.alarmType ?? 'habit';
          const sid = encodeURIComponent(data?.soundId ?? 'morning_birds');
          if (at === 'soundbath') {
            const lbl = encodeURIComponent(data?.label ?? 'Sound Bath');
            setTimeout(() => router.replace(`/soundbath-ringing?soundId=${sid}&label=${lbl}` as never), 300);
          } else {
            setTimeout(() => router.replace(`/habit-alarm-ringing?habitKey=${hk}&habitEmoji=${he}&label=${hl}&alarmType=${at}&mantraId=${sid}` as never), 300);
          }
        }
      }).catch(() => {});
    } catch { /* ignore */ }
  }, [navReady]);

  // ── When app is LAUNCHED by a slot reminder (full-screen intent tap) ─────
  useEffect(() => {
    if (!navReady) return;
    getInitialReminderNotification().then(slotId => {
      if (slotId) {
        console.log(`[Layout] App launched from reminder → /notification-landing?slotId=${slotId}`);
        setTimeout(() => router.push(`/notification-landing?slotId=${slotId}` as never), 1400);
      }
    }).catch(() => { });
  }, [navReady]);

  useEffect(() => {
    let foregroundSub: { remove: () => void } | null = null;
    let tapSub: { remove: () => void } | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Notifications = require('expo-notifications');

      // ── Android: ensure notification channel is ready on every app open ──
      if (Platform.OS === 'android') {
        Notifications.setNotificationChannelAsync('arise-alarms', {
          name: 'Nada Alarms',
          importance: Notifications.AndroidImportance.MAX,
          sound: 'mantra_alarm.m4a',
          vibrationPattern: [0, 250, 250, 250],
          enableVibrate: true,
          showBadge: true,
          bypassDnd: true,
        }).then(() => console.log('[App] Android alarm channel ready')).catch(() => { });
      }

      // Fires when notification arrives while app is OPEN (foreground)
      foregroundSub = Notifications.addNotificationReceivedListener(async (notification: any) => {
        const speechId = notification.request.content.data?.speechId as string | undefined;
        if (!speechId) return;
        const lang = (await store.get(KEYS.language)) ?? 'en';
        const scripts = NOTIFICATION_SPEECHES[speechId];
        if (scripts) {
          const text = scripts[lang] ?? scripts['en'];
          speakBodhi(text);
        }
      });

      // Fires when user TAPS notification to open the app (background → foreground)
      tapSub = Notifications.addNotificationResponseReceivedListener(async (response: any) => {
        const data = response.notification.request.content.data ?? {};
        const speechId = data?.speechId as string | undefined;
        const type = data?.type as string | undefined;

        // Wake-up alarm tap → open Mission Alarm ringing screen
        if (type === 'wake-alarm' || speechId === 'wake-alarm') {
          // Guard: only navigate if not already on alarm-ringing screen
          if (!alarmRoutedRef.current && !segmentsRef.current.includes('alarm-ringing')) {
            alarmRoutedRef.current = true;
            setTimeout(() => router.push('/alarm-ringing' as never), 800);
          }
          return;
        }

        // Sound Bath tap → open soundbath ringing screen
        if (type === 'soundbath-alarm') {
          const sid = encodeURIComponent((data?.soundId ?? 'morning_birds') as string);
          const lbl = encodeURIComponent((data?.label ?? 'Sound Bath') as string);
          setTimeout(() => router.push(`/soundbath-ringing?soundId=${sid}&label=${lbl}` as never), 800);
          return;
        }

        // Sleep auto-start tap → open sleep ringing screen
        if (type === 'sleep-autostart') {
          const sid = encodeURIComponent((data?.soundId ?? 'light_rain') as string);
          const lbl = encodeURIComponent((data?.label ?? 'Sleep Sound') as string);
          setTimeout(() => router.push(`/sleep-ringing?soundId=${sid}&label=${lbl}` as never), 800);
          return;
        }

        // Habit alarm tap → open habit alarm ringing screen
        if (type === 'habit-alarm') {
          const habitKey = encodeURIComponent((data?.alarmId ?? '') as string);
          const habitEmoji = encodeURIComponent((data?.habitEmoji ?? '🌿') as string);
          const habitLabel = encodeURIComponent((data?.label ?? 'Habit Alarm') as string);
          const alarmType = data?.alarmType ?? 'habit';
          const mantraId = encodeURIComponent((data?.soundId ?? 'morning_birds') as string);
          if (alarmType === 'soundbath') {
            const lbl = encodeURIComponent((data?.label ?? 'Sound Bath') as string);
            setTimeout(() => router.push(`/soundbath-ringing?soundId=${mantraId}&label=${lbl}` as never), 800);
          } else {
            setTimeout(() => router.push(`/habit-alarm-ringing?habitKey=${habitKey}&habitEmoji=${habitEmoji}&label=${habitLabel}&alarmType=${alarmType}&mantraId=${mantraId}` as never), 800);
          }
          return;
        }

        // iOS expo-notification slot reminder tap → notification landing screen
        if (speechId && speechId !== 'wake-alarm') {
          setTimeout(() => router.push(`/notification-landing?slotId=${speechId}` as never), 800);
          return;
        }

        if (!speechId) return;
        setTimeout(async () => {
          const lang = (await store.get(KEYS.language)) ?? 'en';
          const scripts = NOTIFICATION_SPEECHES[speechId];
          if (scripts) {
            const text = scripts[lang] ?? scripts['en'];
            speakBodhi(text);
          }
        }, 1500);
      });

      // ── Notifee foreground event: slot reminder arrives while app is OPEN ──
      try {
        const notifee = require('@notifee/react-native').default;
        const { EventType } = require('@notifee/react-native');
        notifee.onForegroundEvent(({ type, detail }: { type: any; detail: any }) => {
          const notifId = detail?.notification?.id as string | undefined;
          const data = detail?.notification?.data as Record<string, string> | undefined;

          // Wake alarm delivered while app is in foreground (fullScreenIntent path)
          // GUARD: use alarmRoutedRef to ensure we navigate at most ONCE per alarm cycle.
          // Without this guard, multiple DELIVERED events (native service + extra wake alarms)
          // each push a new /alarm-ringing screen, causing: abnormal vibration (Haptics fires
          // on each mount), unpin popup loop (dismissAlarmOverlay re-fires each mount),
          // and the "mantra plays then selected sound" symptom (each fresh mount calls
          // preemptActiveAlarm() which stops the previous mount's audio and restarts it).
          if (type === EventType.DELIVERED && (notifId === ALARM_NOTIF_ID || (notifId?.startsWith('wake-extra-') && data?.type === 'wake-alarm'))) {
            if (alarmRoutedRef.current || segmentsRef.current.includes('alarm-ringing')) {
              console.log('[Layout] Alarm delivered in foreground — already routed, skipping duplicate push.');
              return;
            }
            console.log('[Layout] Alarm delivered in foreground → routing to /alarm-ringing');
            alarmRoutedRef.current = true;
            router.push('/alarm-ringing' as never);
            return;
          }

          // Evening mantra delivered or pressed while app is in foreground
          if ((type === EventType.DELIVERED || type === EventType.PRESS) && data?.type === 'evening-mantra') {
            router.push('/habit-alarm-ringing?habitKey=evening_mantra&habitEmoji=%F0%9F%94%B1&label=Shiv%20Sankalpa%20Suktam&mantraId=shiv_sankalpa_suktam' as never);
            return;
          }

          // Sound Bath delivered or pressed while app is in foreground
          if ((type === EventType.DELIVERED || type === EventType.PRESS) && data?.type === 'soundbath-alarm') {
            const sid = encodeURIComponent((data?.soundId ?? 'morning_birds') as string);
            const lbl = encodeURIComponent((data?.label ?? 'Sound Bath') as string);
            router.push(`/soundbath-ringing?soundId=${sid}&label=${lbl}` as never);
            return;
          }

          // Sleep auto-start delivered or pressed while app is in foreground
          if ((type === EventType.DELIVERED || type === EventType.PRESS) && data?.type === 'sleep-autostart') {
            const sid = encodeURIComponent((data?.soundId ?? 'light_rain') as string);
            const lbl = encodeURIComponent((data?.label ?? 'Sleep Sound') as string);
            router.push(`/sleep-ringing?soundId=${sid}&label=${lbl}` as never);
            return;
          }

          // Habit alarm delivered or pressed while app is in foreground
          if ((type === EventType.DELIVERED || type === EventType.PRESS) && data?.type === 'habit-alarm') {
            const habitKey = encodeURIComponent((data?.alarmId ?? '') as string);
            const habitEmoji = encodeURIComponent((data?.habitEmoji ?? '🌿') as string);
            const habitLabel = encodeURIComponent((data?.label ?? 'Habit Alarm') as string);
            const alarmType = data?.alarmType ?? 'habit';
            const mantraId = encodeURIComponent((data?.soundId ?? 'morning_birds') as string);
            if (alarmType === 'soundbath') {
              const lbl = encodeURIComponent((data?.label ?? 'Sound Bath') as string);
              router.push(`/soundbath-ringing?soundId=${mantraId}&label=${lbl}` as never);
            } else {
              router.push(`/habit-alarm-ringing?habitKey=${habitKey}&habitEmoji=${habitEmoji}&label=${habitLabel}&alarmType=${alarmType}&mantraId=${mantraId}` as never);
            }
            return;
          }

          if (data?.type !== REMINDER_DATA_TYPE) return;
          if (type === EventType.DELIVERED || type === EventType.PRESS) {
            const slotId = data?.slotId;
            if (slotId) router.push(`/notification-landing?slotId=${slotId}` as never);
          }
        });
      } catch { /* ignore */ }

    } catch { /* Expo Go — notifications not supported, skip silently */ }
    return () => {
      try { foregroundSub?.remove(); } catch { /* ignore */ }
      try { tapSub?.remove(); } catch { /* ignore */ }
    };
  }, []);
  return null;
}

function GlobalMoodLayer() {
  const { moodPhase, preMood, confirmMood, skipMood } = useSoundPlayer();
  return (
    <MoodSheet
      visible={moodPhase !== null}
      mode={moodPhase === 'result' ? 'result' : (moodPhase ?? 'pre')}
      preMood={preMood}
      onSelect={(key: MoodKey) => confirmMood(key)}
      onSkip={() => skipMood()}
    />
  );
}

// Phase values:
//   'gate'        → fonts loaded, running warm/cache checks (shows dark cover)
//   'downloading' → images missing, showing download progress screen
//   'splash'      → all images cached, showing 7-second splash with bg image
//   'done'        → splash finished, full app visible
type AppPhase = 'gate' | 'downloading' | 'splash' | 'done';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Nunito_300Light, Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold,
    Nunito_800ExtraBold, Nunito_900Black,
    DancingScript_600SemiBold,
  });

  const [authReady,   setAuthReady]   = useState(false);
  const [phase,       setPhase]       = useState<AppPhase>('gate');
  const [dlProgress,  setDlProgress]  = useState(0);
  const [dlLabel,     setDlLabel]     = useState('Preparing...');
  const [splashBgUri, setSplashBgUri] = useState('');

  // Hide native splash as soon as fonts + auth are ready
  useEffect(() => {
    if (fontsLoaded && authReady) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, authReady]);

  // ── Download gate: runs once fonts are loaded ─────────────────────────────
  // STRATEGY:
  //   • Gate ONLY on BG images (16 images, ~5–15 MB total on first install)
  //   • Sound card images (50+ images) are NOT a gate — they download silently
  //     after the splash screen so the user never waits for them on first open.
  //   • Solar positions, Ayurvedic periods etc. are pure JS computation — instant.
  //   • On subsequent opens all BGs are already cached → gate resolves in <50 ms.
  useEffect(() => {
    if (!fontsLoaded) return;
    let cancelled = false;

    (async () => {
      try {
        // Alarm images — high priority, fire at any time
        prefetchCriticalAlarmImages().catch(() => {});

        // Fast disk-scan — no downloads, just file-existence checks (~10 ms)
        await bgWarmup;
        // Warm sound image map in parallel but do NOT wait for it to gate
        warmSoundImageMap().catch(() => {});

        const bgCached = isBgFullyCached();

        if (!bgCached) {
          // Only show progress ring for BG images (much faster than all images)
          if (cancelled) return;
          setPhase('downloading');
          const bgTotal = Object.keys(BG_URLS).length;

          setDlLabel('Setting up...');
          await ensureAllBgsCachedWithProgress((done) => {
            if (!cancelled) setDlProgress(done / bgTotal);
          });

          if (!cancelled) {
            setDlProgress(1);
            // Brief pause so ring fills to 100% before disappearing
            await new Promise(r => setTimeout(r, 400));
          }
        }

        if (cancelled) return;

        // Splash BG is now guaranteed on disk — show splash immediately
        const splashBg = getBgSourceSync('splash');
        setSplashBgUri(splashBg);
        setPhase('splash');

        // Background downloads that do NOT block the user:
        //   • Sound card images (50+ images) — download silently after splash
        //   • Mantras — large files, low priority
        prefetchAllSoundImagesWithProgress(() => {}).catch(() => {});
        ensureAllMantrasDownloaded().catch(() => {});

      } catch {
        if (!cancelled) {
          setSplashBgUri(getBgSourceSync('splash'));
          setPhase('splash');
          // Still kick off background downloads even after error
          prefetchAllSoundImagesWithProgress(() => {}).catch(() => {});
          ensureAllMantrasDownloaded().catch(() => {});
        }
      }
    })();

    return () => { cancelled = true; };
  }, [fontsLoaded]);

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: Colors.bg }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <SafeAreaProvider>
      {/* CrashToast lives OUTSIDE AppErrorBoundary so it stays alive on crashes */}
      <CrashToast />
      <AppErrorBoundary>
      <SoundPlayerProvider>
        <BgProvider>
        <GlobalMoodLayer />
        <StatusBar style="light" />
        <AuthGuard onAuthReady={() => setAuthReady(true)} />
        <BodhiNotificationListener />
        {/* Dark cover while gate check runs (< 100 ms, prevents flash) */}
        {phase === 'gate' && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, backgroundColor: '#04030F' }} />
        )}
        {/* Elegant download progress screen — first install only */}
        {phase === 'downloading' && (
          <DownloadScreen progress={dlProgress} label={dlLabel} />
        )}
        {/* Splash overlay — only renders once bg image is confirmed on disk */}
        {phase === 'splash' && splashBgUri !== '' && (
          <SplashOverlay onDone={() => setPhase('done')} bgUri={splashBgUri} />
        )}
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.bg }, animation: 'fade' }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="alarm-ringing" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="habit-alarm-ringing" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="soundbath-ringing" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="notification-landing" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="mission" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
          <Stack.Screen name="prakriti-quiz" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="cosmic-explore" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="cosmic-science" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="meditation-timer" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
          <Stack.Screen name="step-session" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
          <Stack.Screen name="step-analytics" options={{ animation: 'slide_from_right' }} />
        </Stack>
        </BgProvider>
      </SoundPlayerProvider>
      </AppErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
