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

const ALARM_NOTIF_ID        = 'onesutra-wake-alarm';
const HABIT_ALARM_NOTIF_ID  = 'habit-alarm-service';
const ALARM_ACTIVE_KEY      = 'onesutra_alarm_active_v1';
const PENDING_SLOT_KEY      = 'onesutra_pending_slot_v1';
const PENDING_HABIT_KEY      = 'onesutra_pending_habit_v1';
const ACTIVE_HABIT_NOTIF_KEY = 'onesutra_active_habit_notif_v1';

// ─── 1. FOREGROUND SERVICE RUNNER ───────────────────────────────────────────────────────────────────────────────
// Handles BOTH wake alarm (onesutra-wake-alarm) and habit alarm
// (habit-alarm-service). Keeps the Android JVM + wake-lock alive so
// pressing HOME does not kill the ringing screen.
notifee.registerForegroundService(notification => {
  return new Promise(resolve => {
    const watchId = notification.id ?? ALARM_NOTIF_ID;

    // For wake alarm only: mark active so _layout.tsx can route correctly.
    if (watchId === ALARM_NOTIF_ID) {
      AsyncStorage.setItem(ALARM_ACTIVE_KEY, '1').catch(() => {});
    }

    // Resolve (end service) once the watched notification is cancelled.
    const interval = setInterval(async () => {
      try {
        const visible = await notifee.getDisplayedNotifications();
        const stillUp = visible.some(n => n.notification.id === watchId);
        if (!stillUp) {
          clearInterval(interval);
          resolve();
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
  const id   = detail.notification?.id;
  const data = detail.notification?.data ?? {};

  // ── Slot reminder (Ayurvedic period alert) ──────────────────────────────
  if (data.type === 'slot-reminder') {
    if ((type === EventType.DELIVERED || type === EventType.PRESS) && data.slotId) {
      await AsyncStorage.setItem(PENDING_SLOT_KEY, data.slotId).catch(() => {});
    }
    return;
  }

  // ── Habit alarm fired while app was killed ───────────────────────────────────
  // Store the alarm payload so _layout.tsx can route to /habit-alarm-ringing
  // when MainActivity is launched by the fullScreenAction intent.
  // getInitialNotification() alone is unreliable for fullScreenAction launches
  // (user never "tapped" the notification), so AsyncStorage is the safety net.
  if (data.type === 'habit-alarm') {
    if (type === EventType.DELIVERED || type === EventType.PRESS || type === EventType.ACTION_PRESS) {
      if (data.alarmType === 'soundbath') {
        // Sound Bath alarm arrived via native HabitAlarmModule — route to soundbath screen
        await AsyncStorage.setItem('onesutra_pending_soundbath_v1', JSON.stringify({
          soundId: data.soundId ?? 'morning_birds',
          label:   data.label   ?? 'Sound Bath',
        })).catch(() => {});
        await AsyncStorage.setItem('onesutra_active_soundbath_notif_v1', id ?? '').catch(() => {});
      } else {
        await AsyncStorage.setItem(PENDING_HABIT_KEY, JSON.stringify({
          habitKey:   data.habitKey   ?? data.alarmId ?? id ?? '',
          habitEmoji: data.habitEmoji ?? '🌿',
          label:      data.label      ?? 'Habit Alarm',
          alarmType:  data.alarmType  ?? 'habit',
          soundId:    data.soundId    ?? 'morning_birds',
        })).catch(() => {});
        await AsyncStorage.setItem(ACTIVE_HABIT_NOTIF_KEY, id ?? '').catch(() => {});
      }
    }
    return;
  }

  // ── Sleep auto-start fired while app was killed ─────────────────────────────
  if (data.type === 'sleep-autostart') {
    if (type === EventType.DELIVERED || type === EventType.PRESS || type === EventType.ACTION_PRESS) {
      await AsyncStorage.setItem('onesutra_pending_sleep_v1', JSON.stringify({
        soundId: data.soundId ?? 'light_rain',
        label:   data.label   ?? 'Sleep Sound',
      })).catch(() => {});
    }
    return;
  }

  // ── Sound Bath alarm fired while app was killed ──────────────────────────────
  if (data.type === 'soundbath-alarm') {
    if (type === EventType.DELIVERED || type === EventType.PRESS || type === EventType.ACTION_PRESS) {
      await AsyncStorage.setItem('onesutra_pending_soundbath_v1', JSON.stringify({
        soundId: data.soundId ?? 'morning_birds',
        label:   data.label   ?? 'Sound Bath',
      })).catch(() => {});
      await AsyncStorage.setItem('onesutra_active_soundbath_notif_v1', id ?? '').catch(() => {});
    }
    return;
  }

  // Extra wake alarms (notifee trigger with data.type === 'wake-alarm')
  if (data.type === 'wake-alarm' && id !== ALARM_NOTIF_ID) {
    if (type === EventType.DELIVERED || type === EventType.PRESS || type === EventType.ACTION_PRESS) {
      await AsyncStorage.setItem(ALARM_ACTIVE_KEY, '1').catch(() => {});
    }
    return;
  }

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
