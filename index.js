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
import * as TaskManager from 'expo-task-manager';
import { installCrashShield } from './lib/crashShield';

// ─── MASTER CRASH SHIELD ─────────────────────────────────────────────────────
// Must be the very first thing that runs — before expo-router/entry, before
// any component mounts, before any async work begins.
// Intercepts ALL JS crashes (fatal + non-fatal + unhandled rejections) and
// converts them into visible toast overlays instead of process terminations.
installCrashShield();

// ─── Walk Background Task ────────────────────────────────────────────────────
// Defined here (before React renders) so the OS can wake the headless JS
// context and process GPS updates even after the app is killed.
const WALK_BG_TASK   = 'naad-background-walk-tracker';
// Align with lib/walkStore.ts (v2) so background distance updates are reflected in UI
const WALK_STATE_KEY = 'naad_active_walk_v2';

function _walkHaversineKm(lat1, lng1, lat2, lng2) {
  const R    = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lng2 - lng1) * Math.PI / 180;
  const a    = Math.sin(dLat / 2) ** 2 +
               Math.cos(lat1 * Math.PI / 180) *
               Math.cos(lat2 * Math.PI / 180) *
               Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

TaskManager.defineTask(WALK_BG_TASK, async ({ data, error }) => {
  if (error) return;
  const locations = data && data.locations;
  if (!locations || !locations.length) return;
  const loc = locations[locations.length - 1];
  const { latitude: lat, longitude: lng } = loc.coords;

  try {
    const raw = await AsyncStorage.getItem(WALK_STATE_KEY);
    if (!raw) return;
    const state = JSON.parse(raw);
    if (!state.active || state.paused) return;

    if (state.lastLat !== null && state.lastLng !== null) {
      const dist = _walkHaversineKm(state.lastLat, state.lastLng, lat, lng);
      // Accept 3 m–300 m increments (filters GPS noise and teleports)
      if (dist >= 0.003 && dist <= 0.3) {
        state.distanceKm = parseFloat((state.distanceKm + dist).toFixed(4));
      }
    }
    state.lastLat = lat;
    state.lastLng = lng;

    // Fire a local notification when target is reached
    if (!state.notifiedTarget && state.targetKm && state.distanceKm >= state.targetKm) {
      state.notifiedTarget = true;
      const kmLabel = state.targetKm >= 1
        ? state.targetKm + ' km'
        : (state.targetKm * 1000) + ' m';
      await Notifications.scheduleNotificationAsync({
        content: {
          title: state.type === 'morning' ? '🌅 Morning Walk Complete!' : '🌆 Evening Walk Complete!',
          body:  `${kmLabel} achieved. Your prana flows freely. 🙏`,
          sound: true,
        },
        trigger: null,
      });
    }

    await AsyncStorage.setItem(WALK_STATE_KEY, JSON.stringify(state));
  } catch { /* */ }
});

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

    // ── ROOT CAUSE FIX ─────────────────────────────────────────────────────
    // PROBLEM: This polling loop ran every 5 seconds calling
    // notifee.getDisplayedNotifications(). After 30+ min of ringing that is
    // 360+ accumulated async bridge calls queued on the JS thread. When the
    // user pressed Stop, those queued callbacks created back-pressure that
    // made the JS thread appear frozen — touch events were delayed or lost.
    //
    // MORE CRITICALLY: The polling loop kept the foreground service Promise
    // alive even AFTER the JS stop handler called
    // notifee.cancelNotification(WAKE_FS_ID). The notification was cancelled
    // but the poll interval hadn't fired yet to detect it, so the service
    // stayed alive for up to 5 more seconds — during which the native
    // AlarmSoundService watchdogs saw an active foreground service and kept
    // fighting navigation.
    //
    // FIX: Check BOTH the notification visibility AND the
    // onesutra_alarm_handled_v1 AsyncStorage key (written synchronously by
    // JS stopAlarm handler BEFORE any awaits). This gives an immediate
    // escape path that doesn't depend on notification cancellation timing.
    // The interval is also reduced to 2 s to cut max accumulated calls by
    // 60% vs the old 5 s value.
    // ── ROOT CAUSE FIX 2: PREVENT ASYNC DEADLOCK ────────────────────────────
    // PROBLEM: setInterval doesn't wait for async functions to finish. If the
    // bridge or SystemUI slows down, the 2-second interval queues up overlapping
    // async calls. After 30-60 mins, thousands of pending bridge calls deadlock
    // the JS thread entirely, making the "Stop Alarm" button unresponsive.
    //
    // FIX: Use a recursive setTimeout to guarantee absolutely zero overlap.
    // We also REMOVED the heavy notifee.getDisplayedNotifications() check. We
    // now ONLY check the lightweight AsyncStorage flag to resolve the service.
    let isRunning = true;
    const poll = async () => {
      if (!isRunning) return;
      try {
        const handled = await AsyncStorage.getItem('onesutra_alarm_handled_v1');
        if (handled) {
          isRunning = false;
          resolve();
          return;
        }
      } catch { /* ignore */ }
      
      // Schedule next check only AFTER this one fully completes
      if (isRunning) {
        setTimeout(poll, 2000);
      }
    };
    
    // Start the non-overlapping poll
    poll();
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
