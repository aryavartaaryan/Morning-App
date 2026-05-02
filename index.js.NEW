/**
 * Root entry — runs in the headless JS task context when the OS wakes
 * the app for an alarm or notification event, even if the app is killed.
 *
 * THREE things must be registered here, BEFORE expo-router/entry runs:
 *   1. Notifee background event handler (alarm fired while app dead)
 *   2. Notifee foreground service runner (keeps audio + wake lock alive)
 *   3. expo-notifications background notification handler (iOS path)
 */

import notifee, { EventType } from '@notifee/react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ALARM_NOTIF_ID = 'onesutra-wake-alarm';
const ALARM_ACTIVE_KEY = 'onesutra_alarm_active_v1';

// ─── 1. FOREGROUND SERVICE RUNNER ───────────────────────────────────────
// Notifee invokes this when a notification scheduled with
// `asForegroundService: true` is delivered. The returned Promise must
// stay pending for as long as the service should run. The Android OS
// keeps the JVM and a wake-lock alive while this Promise is unresolved,
// which is what makes the alarm survive HOME button.
notifee.registerForegroundService(notification => {
  return new Promise(resolve => {
    // Mark the alarm as active so app/_layout.tsx routes to /alarm-ringing
    // when the user opens the app from the notification.
    AsyncStorage.setItem(ALARM_ACTIVE_KEY, '1').catch(() => {});

    // The audio is played by the notification channel itself
    // (loopSound: true on the ALARM channel routes to STREAM_ALARM).
    // We only need to keep the Promise alive so the service stays up.

    // Resolve when the notification is cancelled (mission completed).
    const interval = setInterval(async () => {
      try {
        const visible = await notifee.getDisplayedNotifications();
        const stillUp = visible.some(n => n.notification.id === ALARM_NOTIF_ID);
        if (!stillUp) {
          clearInterval(interval);
          resolve(); // ends the foreground service
        }
      } catch { /* ignore polling error */ }
    }, 1500);
  });
});

// ─── 2. BACKGROUND EVENT HANDLER ────────────────────────────────────────
// Fires when the app is killed and the user interacts with the alarm
// notification (taps it, presses Stop action, etc.). MUST be registered
// before any React rendering happens.
notifee.onBackgroundEvent(async ({ type, detail }) => {
  const id = detail.notification?.id;
  if (id !== ALARM_NOTIF_ID) return;

  if (type === EventType.DELIVERED) {
    // Alarm just fired while app was dead. Mark active so when the
    // full-screen intent launches MainActivity, _layout.tsx routes
    // straight to /alarm-ringing.
    await AsyncStorage.setItem(ALARM_ACTIVE_KEY, '1').catch(() => {});
  }

  if (type === EventType.PRESS || type === EventType.ACTION_PRESS) {
    // User tapped the notification or the Stop action. Do NOT cancel
    // the notification here — the alarm screen must verify mission
    // completion first. Just keep the active flag set and let the app
    // open. Mission-complete is the only path that calls
    // `notifee.cancelNotification()` and `stopForegroundService()`.
    await AsyncStorage.setItem(ALARM_ACTIVE_KEY, '1').catch(() => {});
  }

  if (type === EventType.DISMISSED) {
    // ongoing: true means user can't actually dismiss, but covering
    // OEM weirdness (some Xiaomi/Vivo ROMs allow forced dismiss).
    // Re-mark active so we still route to alarm screen on next open.
    await AsyncStorage.setItem(ALARM_ACTIVE_KEY, '1').catch(() => {});
  }
});

// ─── 3. expo-notifications HANDLER (foreground display rule on iOS) ────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    // iOS time-sensitive interruption — bypasses Focus / Do Not Disturb
    // when the user has granted the entitlement.
    priority: Notifications.AndroidNotificationPriority.MAX,
  }),
});

// ─── Boot the Expo Router app ──────────────────────────────────────────
require('expo-router/entry');
