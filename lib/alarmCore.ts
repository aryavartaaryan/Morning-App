/**
 * Alarm Core — pure Notifee + expo-notifications, no custom native code.
 *
 * This replaces the broken `NativeModules.AlarmModule` references in
 * `lib/nativeAlarm.ts` and gives you an Alarmy-grade Android alarm using
 * only managed-workflow-friendly libraries.
 *
 * Architecture:
 *   1. Schedule via `notifee.createTriggerNotification` with
 *      `alarmManager.type = SET_ALARM_CLOCK` → exact + Doze-exempt.
 *   2. Notification posts with `asForegroundService: true` so a Foreground
 *      Service holds the alarm sound and wake lock — survives HOME button.
 *   3. Notification has `fullScreenAction` → punches through lock screen
 *      and launches MainActivity, which Expo Router routes to /alarm-ringing.
 *   4. `loopSound: true` on a HIGH-importance ALARM channel keeps the sound
 *      blasting on STREAM_ALARM until `completeAlarmMission()` is called.
 */

import notifee, {
  AndroidCategory,
  AndroidImportance,
  AndroidVisibility,
  EventType,
  TriggerType,
  TimestampTrigger,
  AlarmType,
  AndroidLaunchActivityFlag,
  AndroidForegroundServiceType,
} from '@notifee/react-native';
import { Platform, AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import { store, KEYS } from './storage';

// ── Constants ──────────────────────────────────────────────────────────
export const ALARM_NOTIF_ID = 'onesutra-wake-alarm';
export const ALARM_CHANNEL_ID = 'onesutra-alarms-v4';
export const ALARM_FG_SERVICE_TYPE = 'alarm';

// ── Public types ───────────────────────────────────────────────────────
export interface AlarmPayload {
  /** Local epoch millis when the alarm should fire */
  fireAt: number;
  /** Display title */
  title?: string;
  /** Display body */
  body?: string;
  /** Custom sound file basename (without extension), declared in expo-notifications plugin */
  sound?: string;
  /** Free-form metadata accessible from `onForegroundEvent` / `onBackgroundEvent` */
  data?: Record<string, string>;
}

// ── Channel setup ──────────────────────────────────────────────────────
let channelReady = false;
export async function ensureAlarmChannel(): Promise<void> {
  if (Platform.OS !== 'android' || channelReady) return;
  await notifee.createChannel({
    id: ALARM_CHANNEL_ID,
    name: 'OneSutra Wake Alarm',
    description: 'Mission alarm — fires even when phone is sleeping.',
    importance: AndroidImportance.HIGH,
    sound: 'mantra_alarm',
    vibration: true,
    vibrationPattern: [0, 800, 400, 800, 400, 800],
    bypassDnd: true,
    visibility: AndroidVisibility.PUBLIC,
  });
  channelReady = true;
}

// ── Schedule the alarm ─────────────────────────────────────────────────
export async function scheduleAlarm(p: AlarmPayload): Promise<void> {
  if (Platform.OS === 'android') return scheduleAlarmAndroid(p);
  if (Platform.OS === 'ios') return scheduleAlarmIOS(p);
}

async function scheduleAlarmAndroid(p: AlarmPayload): Promise<void> {
  await ensureAlarmChannel();
  await cancelAlarm(); // one alarm at a time

  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: p.fireAt,
    alarmManager: {
      // SET_ALARM_CLOCK → Doze-exempt, shows alarm icon in status bar,
      // highest priority on Android. Requires SCHEDULE_EXACT_ALARM permission.
      type: AlarmType.SET_ALARM_CLOCK,
      allowWhileIdle: true,
    },
  };

  await notifee.createTriggerNotification(
    {
      id: ALARM_NOTIF_ID,
      title: p.title ?? '⏰ Brahma Muhurta',
      body: p.body ?? 'Rise — your mission is waiting.',
      data: p.data ?? {},
      android: {
        channelId: ALARM_CHANNEL_ID,
        category: AndroidCategory.ALARM,
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,

        // Sound looped at HIGH importance on the ALARM channel,
        // routed to STREAM_ALARM by the channel config.
        sound: p.sound ?? 'mantra_alarm',
        loopSound: true,
        vibrationPattern: [0, 800, 400, 800, 400, 800],

        // The big three for "unbreakable":
        //   asForegroundService → audio + wake lock survive HOME press
        //   ongoing            → user cannot swipe away
        //   autoCancel: false  → tap-to-launch does not dismiss
        asForegroundService: true,
        ongoing: true,
        autoCancel: false,
        foregroundServiceTypes: [
          AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_SPECIAL_USE,
          AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK,
        ],

        // Lock-screen punch-through.
        fullScreenAction: {
          id: 'alarm-fullscreen',
          launchActivity: 'default',
          launchActivityFlags: [
            AndroidLaunchActivityFlag.NEW_TASK,
            AndroidLaunchActivityFlag.CLEAR_TOP,
            AndroidLaunchActivityFlag.SINGLE_TOP,
          ],
        },

        // Tap re-launches alarm screen if user backgrounds the app.
        pressAction: {
          id: 'alarm-press',
          launchActivity: 'default',
        },

        // Visible while CPU is suspended.
        showTimestamp: true,
        timestamp: p.fireAt,

        // Color-tinted ALARM icon in status bar.
        color: '#F5820A',
        colorized: true,

        actions: [
          {
            title: '⏹ Stop',
            pressAction: { id: 'alarm-stop', launchActivity: 'default' },
          },
        ],
      },
    },
    trigger,
  );
}

/**
 * iOS — best-effort. There is NO equivalent of foreground service or
 * full-screen intent. The notification will fire; user must tap to open.
 * Once open, alarm-ringing.tsx plays sound via expo-av with audio
 * background mode declared in app.json. Sound stops if user force-quits.
 */
async function scheduleAlarmIOS(p: AlarmPayload): Promise<void> {
  await cancelAlarm();
  const seconds = Math.max(1, Math.floor((p.fireAt - Date.now()) / 1000));
  await Notifications.scheduleNotificationAsync({
    identifier: ALARM_NOTIF_ID,
    content: {
      title: p.title ?? '⏰ Brahma Muhurta',
      body: p.body ?? 'Rise — your mission is waiting.',
      sound: 'mantra_alarm.wav', // configured in expo-notifications plugin
      interruptionLevel: 'timeSensitive',
      categoryIdentifier: 'alarm',
      data: p.data ?? {},
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
      repeats: false,
    },
  });
}

// ── Cancel ─────────────────────────────────────────────────────────────
export async function cancelAlarm(): Promise<void> {
  try { await notifee.cancelTriggerNotification(ALARM_NOTIF_ID); } catch { /* ignore */ }
  try { await notifee.cancelNotification(ALARM_NOTIF_ID); } catch { /* ignore */ }
  try { await Notifications.cancelScheduledNotificationAsync(ALARM_NOTIF_ID); } catch { /* ignore */ }
}

// ── THE MISSION COMPLETION GATE ────────────────────────────────────────
/**
 * The ONLY function authorised to silence the alarm.
 * Tears down the foreground service, stops the looped sound, removes the
 * persistent notification, and frees the wake lock.
 */
export async function completeAlarmMission(): Promise<void> {
  try { await notifee.cancelNotification(ALARM_NOTIF_ID); } catch { /* ignore */ }
  try { await notifee.cancelTriggerNotification(ALARM_NOTIF_ID); } catch { /* ignore */ }
  try { await notifee.stopForegroundService(); } catch { /* ignore */ }
  try { await Notifications.dismissNotificationAsync(ALARM_NOTIF_ID); } catch { /* ignore */ }

  // Mark alarm as inactive so if user re-opens the app, /alarm-ringing
  // doesn't bootstrap itself again.
  try { await store.set(KEYS.alarmActive, '0'); } catch { /* ignore */ }
}

// ── Detect "did the app boot because the alarm fired?" ─────────────────
/**
 * Call from app/_layout.tsx on root mount. Returns true if the user
 * launched the app via the alarm notification — caller should then
 * router.replace('/alarm-ringing').
 */
export async function getInitialAlarmNotification(): Promise<boolean> {
  try {
    const initial = await notifee.getInitialNotification();
    if (initial?.notification?.id === ALARM_NOTIF_ID) return true;
  } catch { /* ignore */ }
  try {
    const last = await Notifications.getLastNotificationResponseAsync();
    const id = last?.notification?.request?.identifier;
    if (id === ALARM_NOTIF_ID) return true;
  } catch { /* ignore */ }
  try {
    const flag = await store.get(KEYS.alarmActive);
    return flag === '1';
  } catch { /* ignore */ }
  return false;
}

// ── Mark alarm as active when it fires (called from background event) ──
export async function markAlarmActive(): Promise<void> {
  try { await store.set(KEYS.alarmActive, '1'); } catch { /* ignore */ }
}

// ── Permission flow ────────────────────────────────────────────────────
export async function checkAlarmPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const s = await notifee.getNotificationSettings();
    // 2 = DISABLED → blocked. Anything else (0 NOT_SUPPORTED, 1 ENABLED) → OK.
    return (s.android.alarm as number) !== 2;
  } catch { return false; }
}

export async function openAlarmPermissionSettings(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try { await notifee.openAlarmPermissionSettings(); } catch { /* ignore */ }
}

export async function openBatteryOptimizationSettings(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try { await notifee.openBatteryOptimizationSettings(); } catch { /* ignore */ }
}

export async function isBatteryOptimizationEnabled(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    const enabled = await notifee.isBatteryOptimizationEnabled();
    return !!enabled;
  } catch { return false; }
}

/**
 * Request all permissions in sequence. Call once during onboarding.
 * On Android 13+ this includes POST_NOTIFICATIONS; on Android 14+ this
 * also covers USE_FULL_SCREEN_INTENT and SCHEDULE_EXACT_ALARM.
 */
export async function requestAllAlarmPermissions(): Promise<void> {
  // 1. POST_NOTIFICATIONS (Android 13+)
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') await Notifications.requestPermissionsAsync();
  } catch { /* ignore */ }

  // 2. Notifee notification authorization
  try {
    const s = await notifee.getNotificationSettings();
    if ((s.authorizationStatus as number) < 1) await notifee.requestPermission();
  } catch { /* ignore */ }

  // 3. Exact alarm clock permission (Android 12+)
  try {
    const ok = await checkAlarmPermission();
    if (!ok) await openAlarmPermissionSettings();
    await waitForForeground();
  } catch { /* ignore */ }

  // 4. Battery optimization exemption
  try {
    const blocked = await isBatteryOptimizationEnabled();
    if (blocked) await openBatteryOptimizationSettings();
    await waitForForeground();
  } catch { /* ignore */ }
}

function waitForForeground(timeoutMs = 60_000): Promise<void> {
  return new Promise(resolve => {
    let done = false;
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'active' && !done) { done = true; sub.remove(); resolve(); }
    });
    setTimeout(() => { if (!done) { done = true; sub.remove(); resolve(); } }, timeoutMs);
  });
}

// ── Foreground event subscriber (call once from app/_layout.tsx) ───────
/**
 * Lets the running app react to alarm notification taps / actions.
 * Returns an unsubscribe fn.
 */
export function subscribeForegroundAlarmEvents(handlers: {
  onAlarmFired?: () => void;
  onStop?: () => void;
}): () => void {
  return notifee.onForegroundEvent(async ({ type, detail }) => {
    const id = detail.notification?.id;
    if (id !== ALARM_NOTIF_ID) return;

    if (type === EventType.DELIVERED) {
      await markAlarmActive();
      handlers.onAlarmFired?.();
    } else if (type === EventType.ACTION_PRESS && detail.pressAction?.id === 'alarm-stop') {
      // Stop button does NOT actually stop — it just opens the app to the
      // mission. Mission completion is the only real exit.
      handlers.onAlarmFired?.();
    } else if (type === EventType.PRESS) {
      handlers.onAlarmFired?.();
    }
  });
}
