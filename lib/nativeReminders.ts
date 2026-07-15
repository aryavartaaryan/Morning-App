/**
 * nativeReminders.ts
 *
 * All slot/habit reminder notifications via @notifee/react-native.
 * On Android these fire with fullScreenAction — if the screen is off,
 * the notification covers the entire lock screen (identical to an alarm).
 * When the user taps or the app opens from killed state, _layout.tsx
 * routes to /notification-landing?slotId=<id>.
 */

import notifee, {
  AndroidImportance,
  AndroidCategory,
  AndroidVisibility,
  TriggerType,
  RepeatFrequency,
  EventType,
} from '@notifee/react-native';
import { Platform } from 'react-native';

export const REMINDER_CHANNEL_ID = 'onesutra-reminders-v1';
export const REMINDER_DATA_TYPE = 'slot-reminder';

// ── Fixed-slot notifications removed ─────────────────────────────────────────
// These fixed-clock notifications (6 AM morning, 12 PM pitta, 6 PM evening, etc.)
// are removed. Users reported them feeling like unwanted "login notifications".
// Sacred Solar Hours + Circadian Alerts now fire in real-time from the home
// screen when the hero ring changes its solar/circadian phase — not on a
// fixed schedule.
export const SLOT_NOTIFICATIONS: Array<{ id: string; title: string; body: string; hour: number; minute: number }> = [];

// ── Channel ───────────────────────────────────────────────────────────────────
export async function setupReminderChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await notifee.createChannel({
    id: REMINDER_CHANNEL_ID,
    name: 'OneSutra Daily Reminders',
    description: 'Ayurvedic slot reminders — fullScreen on lock screen',
    importance: AndroidImportance.HIGH,
    sound: 'mantra_alarm',
    vibration: true,
    vibrationPattern: [0, 300, 200, 300],
    bypassDnd: true,
    visibility: AndroidVisibility.PUBLIC,
  });
}

// ── Schedule all slot reminders (no-op — real-time notifications replace these) ─
export async function scheduleAllNativeReminders(): Promise<void> {
  if (Platform.OS !== 'android') return;
  // Sacred Solar Hours + Circadian Alerts now fire in real-time from the
  // home screen (index.tsx) when the hero ring changes its solar/circadian
  // phase. Fixed-clock slot reminders have been removed.
  await setupReminderChannel(); // keep channel alive for other notification types
  console.log('[NativeReminders] Fixed-slot reminders disabled — using real-time solar phase notifications');
}


// ── Cancel all reminders ──────────────────────────────────────────────────────
export async function cancelAllNativeReminders(): Promise<void> {
  if (Platform.OS !== 'android') return;
  for (const r of SLOT_NOTIFICATIONS) {
    try { await notifee.cancelTriggerNotification(`reminder-${r.id}`); } catch { /* ignore */ }
  }
}

// ── Get initial reminder notification (app opened from killed state) ──────────
const PENDING_SLOT_KEY = 'onesutra_pending_slot_v1';
export async function getInitialReminderNotification(): Promise<string | null> {
  try {
    // Path 1: fullScreenAction launched the app — notification is still attached
    const initial = await notifee.getInitialNotification();
    const data = initial?.notification?.data as Record<string, string> | undefined;
    if (data?.type === REMINDER_DATA_TYPE && data?.slotId) {
      return data.slotId;
    }
    // Path 2: background event handler stored the slotId before the app loaded
    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
    const pending = await AsyncStorage.getItem(PENDING_SLOT_KEY);
    if (pending) {
      await AsyncStorage.removeItem(PENDING_SLOT_KEY);
      return pending;
    }
  } catch { /* ignore */ }
  return null;
}

// Background event is handled in nativeAlarm.ts (single merged handler)
