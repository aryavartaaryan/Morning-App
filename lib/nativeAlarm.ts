/**
 * Native Alarm Manager — @notifee/react-native
 *
 * Uses AlarmManager.setAlarmClock() (Android) for exact firing even when
 * app is killed / phone in Doze mode.  On alarm delivery, a full-screen
 * Intent launches alarm-ringing.tsx over the lock screen automatically.
 *
 * Requires:  npm install @notifee/react-native  →  npx expo run:android
 */

import notifee, {
  AndroidImportance,
  AndroidVisibility,
} from '@notifee/react-native';
import { Platform, NativeModules, Alert, AppState } from 'react-native';
import { getBrahmaMuhurtaResult, type LocationProfile } from './locationIntel';
import { store, KEYS } from './storage';

// Native bridge — AlarmModule.kt (AlarmManager + AlarmSoundService)
const AlarmNative: {
  scheduleAlarm(ts: number): Promise<string>;
  cancelAlarm(): Promise<string>;
  stopAlarmSound(): Promise<string>;
  setAlarmVolume(volume: number): Promise<string>;
  setAlarmSound(mantraId: string): Promise<string>;
  setAlarmSoundPath(path: string): Promise<string>;
  isAlarmSoundPlaying(): Promise<boolean>;
  isBatteryOptimizationIgnored(): Promise<boolean>;
  requestBatteryOptimizationExemption(): Promise<string>;
  canScheduleExactAlarms(): Promise<boolean>;
  openExactAlarmSettings(): Promise<string>;
  wasAlarmFired(): Promise<boolean>;
  checkFullScreenIntentPermission(): Promise<boolean>;
  openFullScreenIntentSettings(): Promise<string>;
  canDrawOverlays(): Promise<boolean>;
  requestOverlayPermission(): Promise<string>;
  setPickerActive(active: boolean): Promise<string>;
  startAlarmVibration(): Promise<string>;
  stopAlarmVibration(): Promise<string>;
  dismissAlarmOverlay(): Promise<string>;
} = NativeModules.AlarmModule ?? {};

export const ALARM_NOTIF_ID = 'onesutra-wake-alarm';
export const ALARM_CHANNEL_ID = 'onesutra-alarms-v3';

const pad = (n: number) => String(n).padStart(2, '0');

// ── Channel ────────────────────────────────────────────────────────────────────
export async function setupAlarmChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await notifee.createChannel({
    id: ALARM_CHANNEL_ID,
    name: 'SolRize Wake Alarm',
    description: 'Mission alarm — fires even when phone is sleeping',
    importance: AndroidImportance.HIGH,  // HIGH required for fullScreenIntent
    sound: 'mantra_alarm',
    vibration: true,
    vibrationPattern: [0, 600, 300, 600, 300, 600],
    bypassDnd: true,
    visibility: AndroidVisibility.PUBLIC,
  });
}

// ── Schedule ───────────────────────────────────────────────────────────────────
export async function scheduleNativeAlarm(hour: number, minute: number): Promise<void> {
  if (Platform.OS !== 'android') return;

  await cancelNativeAlarm();
  await setupAlarmChannel();

  const now = new Date();
  const next = new Date();
  next.setHours(hour, minute, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);

  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const ampm = hour < 12 ? 'AM' : 'PM';

  const body =
    hour < 6 ? '🌙 Brahma Muhurta. Rise — the world is asleep.' :
      hour < 9 ? '🌅 Kapha Kala. Move fast or lose the window.' :
        '☀️ Rise. Your mission is waiting.';

  // ── 1. Native AlarmManager → BroadcastReceiver → AlarmSoundService ────────
  // Plays audio on STREAM_ALARM immediately at alarm time, no JS startup delay.
  // Uses setAlarmClock() which is Doze-exempt and shows alarm icon in status bar.
  if (AlarmNative?.scheduleAlarm) {
    try {
      const result = await AlarmNative.scheduleAlarm(next.getTime());
      console.log(`[NativeAlarm] 🔔 Native AlarmManager: ${result}`);
    } catch (e) {
      console.warn('[NativeAlarm] Native schedule failed (non-critical):', e);
    }
  }

  // ── 1b. Persist selected mantra so AlarmSoundService plays the right audio ─
  // Reads selectedMantraId from AlarmSettings (set when user picks Gayatri /
  // Lalitha / Shiv Tandav in the alarms screen) and saves it to SharedPreferences.
  if (AlarmNative?.setAlarmSound) {
    try {
      const alarmSettings = await store.getJSON<{ selectedMantraId?: string }>(KEYS.alarmSettings);
      const mantraId = alarmSettings?.selectedMantraId ?? 'gayatri';
      await AlarmNative.setAlarmSound(mantraId);
      console.log(`[NativeAlarm] 🎵 Alarm sound set to: ${mantraId}`);
    } catch (e) {
      console.warn('[NativeAlarm] setAlarmSound failed (non-critical):', e);
    }
  }

  // NOTE: We intentionally DO NOT schedule a Notifee trigger notification here.
  // AlarmSoundService already posts its own fullScreenIntent notification on
  // STREAM_ALARM with a looped MediaPlayer. A second Notifee notification
  // would (a) play the channel sound once on delivery and (b) compete with
  // the service's audio, producing the "tap to play" symptom we are fixing.

  // Best-effort body suppression of unused vars — body string kept for future use.
  void body;

  console.log(
    `[NativeAlarm] ✅ Native AlarmManager scheduled ${pad(h12)}:${pad(minute)} ${ampm}` +
    ` → fires at ${next.toLocaleString()}`,
  );
}

// ── Extra wake alarms (notifee trigger, routes to alarm-ringing) ───────────────────
export async function scheduleExtraWakeAlarm(
  id: string, hour: number, minute: number, label?: string,
): Promise<void> {
  await cancelExtraWakeAlarm(id);
  if (Platform.OS !== 'android') return;

  await setupAlarmChannel();
  const now = new Date();
  const next = new Date();
  next.setHours(hour, minute, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);

  const pad2 = (n: number) => String(n).padStart(2, '0');
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const ampm = hour < 12 ? 'AM' : 'PM';
  const notif = require('@notifee/react-native').default;
  const { TriggerType, RepeatFrequency, AlarmType } = require('@notifee/react-native');
  try {
    await notif.createTriggerNotification(
      {
        id: `wake-extra-${id}`,
        title: `⏰ ${label || `Wake Alarm ${pad2(h12)}:${pad2(minute)} ${ampm}`}`,
        body: 'Your wake alarm is ringing. Rise and shine! 🌅',
        android: {
          channelId: ALARM_CHANNEL_ID,
          importance: 5,
          category: 'alarm',
          visibility: 1,
          fullScreenAction: { id: 'default', launchActivity: 'default' },
          pressAction: { id: 'default', launchActivity: 'default' },
          ongoing: true,
          autoCancel: false,
          loopSound: true,
          bypassDnd: true,
        },
        data: { type: 'wake-alarm', alarmId: id, label: label ?? '' },
      },
      {
        type: TriggerType.TIMESTAMP,
        timestamp: next.getTime(),
        repeatFrequency: RepeatFrequency.DAILY,
        alarmManager: { type: AlarmType.SET_ALARM_CLOCK },
      },
    );
    console.log(`[NativeAlarm] Extra wake alarm scheduled: ${pad2(h12)}:${pad2(minute)} ${ampm}`);
  } catch (e) {
    console.warn('[NativeAlarm] scheduleExtraWakeAlarm failed:', e);
  }
}

export async function cancelExtraWakeAlarm(id: string): Promise<void> {
  try {
    const notif = require('@notifee/react-native').default;
    await notif.cancelTriggerNotification(`wake-extra-${id}`);
    await notif.cancelNotification(`wake-extra-${id}`);
  } catch { /* ignore */ }
}

// ── Gate the native bringToFront watchdog during camera/gallery pickers ────────────
// Call setNativePickerActive(true) BEFORE launching ImagePicker, and
// setNativePickerActive(false) in the finally block after it resolves.
// Without this, AlarmSoundService.onActivityPaused() fires when the camera
// opens and immediately brings MainActivity back to front, closing the picker.
export async function setNativePickerActive(active: boolean): Promise<void> {
  if (Platform.OS !== 'android' || !AlarmNative?.setPickerActive) return;
  try { await AlarmNative.setPickerActive(active); } catch { /* ignore */ }
}

// ── Instantly update mantra preference (call from alarms.tsx on mantra change) ──
export async function setNativeAlarmSound(mantraId: string): Promise<void> {
  if (!AlarmNative?.setAlarmSound) return;
  try { await AlarmNative.setAlarmSound(mantraId); } catch { /* ignore */ }
}

export async function setNativeAlarmSoundPath(path: string): Promise<void> {
  if (!AlarmNative?.setAlarmSoundPath) return;
  // Strip file:// prefix — Android MediaPlayer needs an absolute path, not a URI
  const absPath = path.replace(/^file:\/\//, '');
  try { await AlarmNative.setAlarmSoundPath(absPath); } catch { /* ignore */ }
}

// ── Stop native audio (call from alarm-ringing.tsx on mount) ───────────────────
export async function stopNativeAlarmSound(): Promise<void> {
  if (Platform.OS !== 'android' || !AlarmNative?.stopAlarmSound) return;
  try { await AlarmNative.stopAlarmSound(); } catch { /* ignore */ }
}

// ── Adjust native alarm volume WITHOUT stopping the service ─────────────────────
// Keeps foreground service, wake lock, and Home-button watchdogs alive.
// volume: 0.0 (mute) → 1.0 (full)
export async function setNativeAlarmVolume(volume: number): Promise<void> {
  if (Platform.OS !== 'android' || !AlarmNative?.setAlarmVolume) return;
  try { await AlarmNative.setAlarmVolume(volume); } catch { /* ignore */ }
}

// ── Cancel ─────────────────────────────────────────────────────────────────────
export async function cancelNativeAlarm(): Promise<void> {
  // Cancel Notifee trigger notification
  try { await notifee.cancelTriggerNotification(ALARM_NOTIF_ID); } catch { /* ignore */ }
  try { await notifee.cancelNotification(ALARM_NOTIF_ID); } catch { /* ignore */ }
  // Cancel native AlarmManager intent
  if (AlarmNative?.cancelAlarm) {
    try { await AlarmNative.cancelAlarm(); } catch { /* ignore */ }
  }
}

// ── Permission helpers ─────────────────────────────────────────────────────────
export async function checkAlarmPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const s = await notifee.getNotificationSettings();
  // 0 = NOT_SUPPORTED (Android < 12, no permission needed = OK)
  // 1 = ENABLED (granted = OK)
  // 2 = DISABLED (explicitly denied = NOT OK)
  return (s.android.alarm as number) !== 2;
}

export async function openAlarmPermissionSettings(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await notifee.openAlarmPermissionSettings();
}

// ── Sequential permission-request helpers ─────────────────────────────────────
// Each step explains WHY the permission is needed before redirecting the user.

function waitForAppForeground(): Promise<void> {
  return new Promise(resolve => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') { sub.remove(); resolve(); }
    });
  });
}

async function stepExactAlarm(): Promise<void> {
  try {
    const granted = await checkAlarmPermission();
    if (!granted && AlarmNative?.openExactAlarmSettings) {
      await new Promise<void>(resolve =>
        Alert.alert(
          '⏰ Exact Alarm Permission',
          'OneSutra needs this to ring your Brahma Muhurta alarm at the precise moment — even when your phone is fully asleep.',
          [
            { text: 'Skip', style: 'cancel', onPress: resolve },
            {
              text: 'Open Settings', onPress: () => {
                AlarmNative.openExactAlarmSettings().catch(() => {});
                waitForAppForeground().then(resolve);
              },
            },
          ],
          { cancelable: false },
        ),
      );
    }
  } catch { /* ignore */ }
}

async function stepBatteryOpt(): Promise<void> {
  try {
    if (!AlarmNative?.isBatteryOptimizationIgnored) return;
    const ok = await AlarmNative.isBatteryOptimizationIgnored();
    if (!ok && AlarmNative?.requestBatteryOptimizationExemption) {
      await new Promise<void>(resolve =>
        Alert.alert(
          '🔋 Background Battery Access',
          'OneSutra must run without battery restrictions to play your alarm sound. Without this, Android may silence the alarm mid-ring.',
          [
            { text: 'Skip', style: 'cancel', onPress: resolve },
            {
              text: 'Allow', onPress: () => {
                AlarmNative.requestBatteryOptimizationExemption().catch(() => {});
                waitForAppForeground().then(resolve);
              },
            },
          ],
          { cancelable: false },
        ),
      );
    }
  } catch { /* ignore */ }
}

async function stepFullScreenIntent(): Promise<void> {
  try {
    if (!AlarmNative?.checkFullScreenIntentPermission) return;
    const ok = await AlarmNative.checkFullScreenIntentPermission();
    if (!ok && AlarmNative?.openFullScreenIntentSettings) {
      await new Promise<void>(resolve =>
        Alert.alert(
          '📱 Full-Screen Alarm Display',
          'To show the alarm screen over your lock screen when the phone is sleeping, OneSutra needs Full-Screen Intent permission.',
          [
            { text: 'Skip', style: 'cancel', onPress: resolve },
            {
              text: 'Open Settings', onPress: () => {
                AlarmNative.openFullScreenIntentSettings().catch(() => {});
                waitForAppForeground().then(resolve);
              },
            },
          ],
          { cancelable: false },
        ),
      );
    }
  } catch { /* ignore */ }
}

export async function requestAllAlarmPermissions(): Promise<void> {
  if (Platform.OS !== 'android') return;
  // Step 0: expo-notifications POST_NOTIFICATIONS (Android 13+)
  // Only shows the system dialog if not already granted — silent if already allowed.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Notifs = require('expo-notifications');
    const { status } = await Notifs.getPermissionsAsync();
    if (status !== 'granted') await Notifs.requestPermissionsAsync();
  } catch { /* ignore — Expo Go or older Android */ }
  // Step 1: Notifee auth (only show dialog if not yet authorized)
  try {
    const s = await notifee.getNotificationSettings();
    if ((s.authorizationStatus as number) < 1) await notifee.requestPermission();
  } catch { /* ignore */ }
  // Steps 2–4: exact alarm clock, battery opt exemption, full-screen intent (Android 14+)
  await stepExactAlarm();
  await stepBatteryOpt();
  await stepFullScreenIntent();
  // Step 5: "Appear on top of other apps" (SYSTEM_ALERT_WINDOW, Android 6+)
  // Required for the alarm screen to reappear over the home screen when HOME is pressed.
  await stepOverlayPermission();
}

async function stepOverlayPermission(): Promise<void> {
  try {
    if (!AlarmNative?.canDrawOverlays) return;
    const ok = await AlarmNative.canDrawOverlays();
    if (!ok && AlarmNative?.requestOverlayPermission) {
      await new Promise<void>(resolve =>
        Alert.alert(
          '📱 Appear on Top of Other Apps',
          'OneSutra needs this to keep the alarm screen visible even when the Home button is pressed — exactly like Alarmy. Without it, the alarm can be bypassed by pressing Home.',
          [
            { text: 'Skip', style: 'cancel', onPress: resolve },
            {
              text: 'Allow', onPress: () => {
                AlarmNative.requestOverlayPermission().catch(() => {});
                waitForAppForeground().then(resolve);
              },
            },
          ],
          { cancelable: false },
        ),
      );
    }
  } catch { /* ignore */ }
}

// ── Initial notification (app opened by alarm while killed) ────────────────────
// Checks BOTH Notifee (if notification fired) AND AlarmSoundService flag
// (written to SharedPreferences before launching activity — fires even when
// the app is killed and Notifee couldn't deliver a notification).
export async function getInitialAlarmNotification(): Promise<boolean> {
  try {
    const initial = await notifee.getInitialNotification();
    if (initial?.notification?.id === ALARM_NOTIF_ID) return true;
  } catch { /* ignore */ }
  try {
    if (AlarmNative?.wasAlarmFired) {
      const fired = await AlarmNative.wasAlarmFired();
      if (fired) return true;
    }
  } catch { /* ignore */ }
  return false;
}


// onBackgroundEvent is registered in index.js (project root) — the app entry file.
// It MUST live there so the headless JS task finds it when the app is killed.

// ── Brahma Muhurta Auto-scheduling ────────────────────────────────────────

/**
 * Compute today's Brahma Muhurta from GPS and schedule the alarm.
 * Called from onboarding (after GPS permission) and daily rescheduler.
 */
export async function scheduleBrahmaMuhurtaAlarm(lat: number, lon: number): Promise<void> {
  const bm = getBrahmaMuhurtaResult(lat, lon);
  await scheduleNativeAlarm(bm.wakeHour, bm.wakeMin);
  // Persist the scheduled date so we don't reschedule more than once per day
  const today = new Date().toISOString().split('T')[0];
  await store.set(KEYS.lastAlarmDate, today);
  console.log(`[BrahmaMuhurta] ☀️ Scheduled ${bm.wakeHour}:${String(bm.wakeMin).padStart(2, '0')} (${bm.brahmaMuhurtaDesc})`);
}

// ── Overlay control (Phase 4) ───────────────────────────────────────────────

/**
 * Remove the native TYPE_APPLICATION_OVERLAY window drawn by AlarmSoundService.
 * Call this as soon as alarm-ringing.tsx mounts so the placeholder is replaced
 * by the React Native alarm UI without any visible flash.
 */
export async function dismissAlarmOverlay(): Promise<void> {
  try {
    if (Platform.OS === 'android') await AlarmNative.dismissAlarmOverlay?.();
  } catch (e) { console.warn('[nativeAlarm] dismissAlarmOverlay:', e); }
}

// ── Vibration control (Phase 3) ───────────────────────────────────────────────

/**
 * Start the native alarm vibration in the running AlarmSoundService.
 * Call when snooze ends and the alarm resumes, so the hardware pattern
 * restarts in sync with audio.
 */
export async function startAlarmVibration(): Promise<void> {
  try {
    if (Platform.OS === 'android') await AlarmNative.startAlarmVibration?.();
  } catch (e) { console.warn('[nativeAlarm] startAlarmVibration:', e); }
}

/**
 * Stop the native alarm vibration in the running AlarmSoundService.
 * Call when snooze starts and when the alarm is fully dismissed.
 */
export async function stopAlarmVibration(): Promise<void> {
  try {
    if (Platform.OS === 'android') await AlarmNative.stopAlarmVibration?.();
  } catch (e) { console.warn('[nativeAlarm] stopAlarmVibration:', e); }
}

/**
 * Call this from app/_layout.tsx on every app open.
 * If location data exists and we haven't scheduled today, reschedule.
 */
export async function checkAndRescheduleDaily(): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const lastDate = await store.get(KEYS.lastAlarmDate);
    if (lastDate === today) return; // already scheduled today

    const location = await store.getJSON<LocationProfile>(KEYS.location);
    if (!location?.lat || !location?.lon) return; // no GPS data yet

    await scheduleBrahmaMuhurtaAlarm(location.lat, location.lon);
  } catch (e) {
    console.warn('[BrahmaMuhurta] Daily reschedule failed:', e);
  }
}
