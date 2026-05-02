'use client';
import { useEffect, useRef, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, AppState, View, Animated, Dimensions, StyleSheet, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import {
  Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold,
  Nunito_800ExtraBold, Nunito_900Black,
} from '@expo-google-fonts/nunito';
import { DancingScript_600SemiBold } from '@expo-google-fonts/dancing-script';
import * as SplashScreen from 'expo-splash-screen';
import { useRouter, useSegments } from 'expo-router';
import { store, KEYS } from '@/lib/storage';
import { scheduleHabitReminders, setupNotificationChannel, NOTIFICATION_SPEECHES } from '@/lib/notifications';
import { getInitialAlarmNotification, requestAllAlarmPermissions, checkAndRescheduleDaily, ALARM_NOTIF_ID } from '@/lib/nativeAlarm';
import { scheduleAllNativeReminders, getInitialReminderNotification, REMINDER_DATA_TYPE } from '@/lib/nativeReminders';
import { speakBodhi } from '@/lib/speech';
import { Colors } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';

SplashScreen.preventAutoHideAsync();

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
          Arise
        </Animated.Text>
        <Animated.View style={[SS.subBlock, { opacity: subOp }]}>
          <Text style={SS.tagline}>YOUR DAY  ·  BY DESIGN</Text>
          <View style={SS.accentLine} />
        </Animated.View>
      </View>
      {/* Footer */}
      <Animated.Text style={[SS.version, { opacity: subOp }]}>ARISE  ·  V 1.0</Animated.Text>
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
  const signalled = useRef(false);

  useEffect(() => {
    if (signalled.current) return;
    signalled.current = true;
    // Init alarm permissions + notification channel silently
    try {
      setupNotificationChannel().catch(() => {});
      scheduleHabitReminders();
      scheduleAllNativeReminders().catch(() => {});
      checkAndRescheduleDaily().catch(() => {});
      setTimeout(() => requestAllAlarmPermissions().catch(() => {}), 2500);
    } catch { /* Expo Go */ }
    // Route straight to tabs unless already there or on alarm screens
    const root = segments[0] as string;
    if (root !== '(tabs)' && root !== 'alarm-ringing' && root !== 'habit-alarm-ringing' && root !== 'mission') {
      router.replace('/(tabs)' as never);
    }
    setTimeout(() => onAuthReady(), 80);
  }, []);

  return null;
}

function BodhiNotificationListener() {
  const router = useRouter();
  const segments = useSegments();
  // Guard: ensure we navigate to /alarm-ringing at most once per alarm cycle.
  // Multiple navigation calls re-mount the component, restarting audio playback.
  const alarmRoutedRef = useRef(false);

  // Reset the guard whenever we leave the alarm-ringing screen so the next
  // alarm cycle can trigger routing again.
  useEffect(() => {
    if (!(segments as string[]).includes('alarm-ringing')) {
      alarmRoutedRef.current = false;
    }
  }, [segments]);

  // ── When app is LAUNCHED by wake alarm (phone was sleeping/app was killed) ──
  useEffect(() => {
    getInitialAlarmNotification().then(initial => {
      if (initial && !alarmRoutedRef.current) {
        alarmRoutedRef.current = true;
        console.log('[Layout] App launched from alarm notification → routing to /alarm-ringing');
        setTimeout(() => router.replace('/alarm-ringing' as never), 150);
      }
    }).catch(() => { });
  }, []);

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
      getInitialAlarmNotification().then(fired => {
        if (fired && !alarmRoutedRef.current && !(segments as string[]).includes('alarm-ringing')) {
          alarmRoutedRef.current = true;
          console.log('[Layout] App foregrounded from alarm (background path) → /alarm-ringing');
          router.push('/alarm-ringing' as never);
        }
      }).catch(() => { });
    });
    return () => sub.remove();
  }, [segments]);

  // ── When app is LAUNCHED by a slot reminder (full-screen intent tap) ─────
  useEffect(() => {
    getInitialReminderNotification().then(slotId => {
      if (slotId) {
        console.log(`[Layout] App launched from reminder → /notification-landing?slotId=${slotId}`);
        setTimeout(() => router.push(`/notification-landing?slotId=${slotId}` as never), 1400);
      }
    }).catch(() => { });
  }, []);

  useEffect(() => {
    let foregroundSub: { remove: () => void } | null = null;
    let tapSub: { remove: () => void } | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Notifications = require('expo-notifications');

      // ── Android: ensure notification channel is ready on every app open ──
      if (Platform.OS === 'android') {
        Notifications.setNotificationChannelAsync('arise-alarms', {
          name: 'Arise Alarms',
          importance: Notifications.AndroidImportance.MAX,
          sound: 'mantra_alarm.wav',
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

        // Habit alarm tap → open habit alarm ringing screen
        if (type === 'habit-alarm') {
          const habitKey = encodeURIComponent((data?.alarmId ?? '') as string);
          const habitEmoji = encodeURIComponent((data?.habitEmoji ?? '🌿') as string);
          const habitLabel = encodeURIComponent((data?.label ?? 'Habit Alarm') as string);
          setTimeout(() => router.push(`/habit-alarm-ringing?habitKey=${habitKey}&habitEmoji=${habitEmoji}&label=${habitLabel}` as never), 800);
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
          if (type === EventType.DELIVERED && notifId === ALARM_NOTIF_ID) {
            console.log('[Layout] Alarm delivered in foreground → routing to /alarm-ringing');
            router.push('/alarm-ringing' as never);
            return;
          }

          // Habit alarm delivered or pressed while app is in foreground
          if ((type === EventType.DELIVERED || type === EventType.PRESS) && data?.type === 'habit-alarm') {
            const habitKey = encodeURIComponent((data?.alarmId ?? '') as string);
            const habitEmoji = encodeURIComponent((data?.habitEmoji ?? '🌿') as string);
            const habitLabel = encodeURIComponent((data?.label ?? 'Habit Alarm') as string);
            router.push(`/habit-alarm-ringing?habitKey=${habitKey}&habitEmoji=${habitEmoji}&label=${habitLabel}` as never);
            return;
          }

          if (data?.type !== REMINDER_DATA_TYPE) return;
          if (type === EventType.PRESS) {
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

export default function RootLayout() {
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
        <StatusBar style="light" />
        <AuthGuard onAuthReady={() => setAuthReady(true)} />
        <BodhiNotificationListener />
        {authReady && showSplash && <SplashOverlay onDone={() => setShowSplash(false)} />}
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.bg }, animation: 'fade' }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="alarm-ringing" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="habit-alarm-ringing" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="notification-landing" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="mission" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
          <Stack.Screen name="prakriti-quiz" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="meditation-timer" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
