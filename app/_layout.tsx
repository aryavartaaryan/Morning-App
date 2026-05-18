'use client';
import { Component, useEffect, useRef, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, AppState, View, Animated, Dimensions, StyleSheet, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import {
  Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold,
  Nunito_800ExtraBold, Nunito_900Black,
} from '@expo-google-fonts/nunito';
import { DancingScript_600SemiBold } from '@expo-google-fonts/dancing-script';
import * as SplashScreen from 'expo-splash-screen';
import { useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { store, KEYS } from '@/lib/storage';
import { ensureAllMantrasDownloaded } from '@/lib/mantraDownload';
import { ensureAllBgsCached } from '@/lib/bgImages';
import { prefetchAllSoundImages } from '@/lib/soundImagePreload';
import { scheduleHabitReminders, setupNotificationChannel, NOTIFICATION_SPEECHES } from '@/lib/notifications';
import { getInitialAlarmNotification, requestAllAlarmPermissions, checkAndRescheduleDaily, ALARM_NOTIF_ID } from '@/lib/nativeAlarm';
import * as ImagePicker from 'expo-image-picker';
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

function SplashOverlay({ onDone }: { onDone: () => void }) {
  const glowOp  = useRef(new Animated.Value(0)).current;
  const titleOp = useRef(new Animated.Value(0)).current;
  const titleSc = useRef(new Animated.Value(0.84)).current;
  const subOp   = useRef(new Animated.Value(0)).current;
  const screenOp = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(glowOp,   { toValue: 0.20, duration: 750, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(titleOp, { toValue: 1,    duration: 680, useNativeDriver: true }),
        Animated.spring(titleSc, { toValue: 1, tension: 48, friction: 9, useNativeDriver: true }),
      ]),
      Animated.delay(280),
      Animated.timing(subOp,    { toValue: 1,    duration: 520, useNativeDriver: true }),
      Animated.delay(1150),
      Animated.timing(screenOp, { toValue: 0,    duration: 680, useNativeDriver: true }),
    ]).start(() => onDone());
  }, []);

  return (
    <Animated.View pointerEvents="none" style={[SS.overlay, { opacity: screenOp }]}>
      <LinearGradient colors={['#0B052F', '#05040F', '#000009']} style={StyleSheet.absoluteFillObject} />
      {/* Ambient glow orb */}
      <Animated.View style={[SS.glowOrb, { opacity: glowOp }]} />
      {/* Center */}
      <View style={SS.center}>
        <Animated.Text style={[SS.arise, { opacity: titleOp, transform: [{ scale: titleSc }] }]}>
          SolRize
        </Animated.Text>
        <Animated.View style={[SS.subBlock, { opacity: subOp }]}>
          <Text style={SS.tagline}>YOUR DAY  ·  BY DESIGN</Text>
          <View style={SS.accentLine} />
        </Animated.View>
      </View>
      {/* Footer */}
      <Animated.Text style={[SS.version, { opacity: subOp }]}>SOLRIZE  ·  V 1.0</Animated.Text>
    </Animated.View>
  );
}

const SS = StyleSheet.create({
  overlay:    { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, backgroundColor: '#04030F', alignItems: 'center' },
  glowOrb:    { position: 'absolute', top: SH * 0.22, alignSelf: 'center', width: 360, height: 360, borderRadius: 180, backgroundColor: '#F5820A' },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  arise:      { fontSize: 86, color: '#FFFFFF', fontFamily: 'DancingScript_600SemiBold', letterSpacing: 3 },
  subBlock:   { alignItems: 'center', gap: 14 },
  tagline:    { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.35)', letterSpacing: 6 },
  accentLine: { width: 64, height: 1.5, backgroundColor: '#F5820A', opacity: 0.70, borderRadius: 1 },
  version:    { fontSize: 9, color: 'rgba(255,255,255,0.15)', letterSpacing: 5, fontWeight: '600', paddingBottom: 50 },
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
      }, 3500);
    } catch { /* Expo Go */ }
    // Route straight to tabs unless already there or on alarm screens
    const root = segments[0] as string;
    if (root !== '(tabs)' && root !== 'alarm-ringing' && root !== 'habit-alarm-ringing' && root !== 'mission') {
      router.replace('/(tabs)' as never);
    }
    setTimeout(() => onAuthReady(), 80);
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
  const navReady = !!navigationState?.key;

  // Reset the guard whenever we leave the alarm-ringing screen so the next
  // alarm cycle can trigger routing again.
  useEffect(() => {
    if (!(segments as string[]).includes('alarm-ringing')) {
      alarmRoutedRef.current = false;
    }
  }, [segments]);

  // ── When app is LAUNCHED by wake alarm (phone was sleeping/app was killed) ──
  useEffect(() => {
    if (!navReady) return;
    getInitialAlarmNotification().then(async (initial) => {
      if (initial && !alarmRoutedRef.current) {
        const missionId = await AsyncStorage.getItem('onesutra_mission_active_v1').catch(() => null);
        alarmRoutedRef.current = true;
        if (missionId && !(segments as string[]).includes('mission')) {
          console.log('[Layout] App launched mid-mission → routing to /mission');
          setTimeout(() => router.replace(`/mission?id=${missionId}` as never), 150);
        } else if (!missionId) {
          console.log('[Layout] App launched from alarm notification → routing to /alarm-ringing');
          setTimeout(() => router.replace('/alarm-ringing' as never), 150);
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
      if ((segments as string[]).includes('alarm-ringing')) return; // already on screen
      getInitialAlarmNotification().then(async (fired) => {
        if (fired && !alarmRoutedRef.current && !(segments as string[]).includes('alarm-ringing')) {
          const missionId = await AsyncStorage.getItem('onesutra_mission_active_v1').catch(() => null);
          alarmRoutedRef.current = true;
          if (missionId) {
            if (!(segments as string[]).includes('mission')) {
              console.log('[Layout] App foregrounded mid-mission → /mission');
              router.push(`/mission?id=${missionId}` as never);
            }
          } else {
            console.log('[Layout] App foregrounded from alarm (background path) → /alarm-ringing');
            router.push('/alarm-ringing' as never);
          }
        }
      }).catch(() => { });
    });
    return () => sub.remove();
  }, [segments]);

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
  useEffect(() => {
    if (!navReady) return;
    AsyncStorage.getItem('onesutra_pending_soundbath_v1')
      .then((raw: string | null) => {
        if (!raw) return;
        AsyncStorage.removeItem('onesutra_pending_soundbath_v1').catch(() => {});
        const alarm = JSON.parse(raw);
        const sid = encodeURIComponent(alarm.soundId ?? 'morning_birds');
        const lbl = encodeURIComponent(alarm.label ?? 'Sound Bath');
        setTimeout(() => router.replace(`/soundbath-ringing?soundId=${sid}&label=${lbl}` as never), 400);
      })
      .catch(() => {});
  }, [navReady]);

  // ── When app is LAUNCHED by a sleep auto-start fullScreenAction (app was killed) ──
  useEffect(() => {
    if (!navReady) return;
    AsyncStorage.getItem('onesutra_pending_sleep_v1')
      .then((raw: string | null) => {
        if (!raw) return;
        AsyncStorage.removeItem('onesutra_pending_sleep_v1').catch(() => {});
        const alarm = JSON.parse(raw);
        const sid = encodeURIComponent(alarm.soundId ?? 'light_rain');
        const lbl = encodeURIComponent(alarm.label ?? 'Sleep Sound');
        setTimeout(() => router.replace(`/sleep-ringing?soundId=${sid}&label=${lbl}` as never), 400);
      })
      .catch(() => {});
  }, [navReady]);

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
          name: 'SolRize Alarms',
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
          setTimeout(() => router.push('/alarm-ringing' as never), 800);
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
          if (type === EventType.DELIVERED && (notifId === ALARM_NOTIF_ID || (notifId?.startsWith('wake-extra-') && data?.type === 'wake-alarm'))) {
            console.log('[Layout] Alarm delivered in foreground → routing to /alarm-ringing');
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

export default function RootLayout() {
  useEffect(() => {
    const t1 = setTimeout(() => ensureAllBgsCached().catch(() => {}), 500);
    const t2 = setTimeout(() => ensureAllMantrasDownloaded().catch(() => {}), 10_000);
    const t3 = setTimeout(() => prefetchAllSoundImages().catch(() => {}), 4_000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  const [fontsLoaded] = useFonts({
    Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold,
    Nunito_800ExtraBold, Nunito_900Black,
    DancingScript_600SemiBold,
  });
  const [authReady, setAuthReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    if (fontsLoaded && authReady) SplashScreen.hideAsync();
  }, [fontsLoaded, authReady]);

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
        {authReady && showSplash && <SplashOverlay onDone={() => setShowSplash(false)} />}
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
        </Stack>
        </BgProvider>
      </SoundPlayerProvider>
      </AppErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
