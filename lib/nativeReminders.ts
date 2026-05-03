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

// ── Notification definitions ──────────────────────────────────────────────────
export const SLOT_NOTIFICATIONS = [
  {
    id: 'morning-start',
    title: '🌅 Morning Rituals — Window Open',
    body: 'Kapha Kala is live. Move your body, drink warm water, greet the sun. 🙏',
    hour: 6, minute: 0,
  },
  {
    id: 'checkin-reminder',
    title: '💭 Bodhi is Ready — Daily Check-In',
    body: 'Your personalized Ayurvedic prescription for today is waiting. ✦',
    hour: 8, minute: 0,
  },
  {
    id: 'morning-expiry',
    title: '⏰ Morning Window Closing in 5 min',
    body: 'Log your morning habits before the Kapha window ends at 10 AM. 🌿',
    hour: 9, minute: 55,
  },
  {
    id: 'afternoon-start',
    title: '🔥 Pitta Noon — Peak Agni is Here',
    body: 'Your digestive fire is at its absolute peak. Main meal + bold decisions now. 🍛',
    hour: 12, minute: 0,
  },
  {
    id: 'afternoon-expiry',
    title: '⏰ Pitta Window Closing in 5 min',
    body: 'Log your afternoon habits before the Pitta hour ends. 🔥',
    hour: 13, minute: 55,
  },
  {
    id: 'evening-start',
    title: '🪔 Evening Wind-Down Window Open',
    body: 'Light dinner, gentle walk, screen-free time. Protect your Ojas tonight. 🌙',
    hour: 18, minute: 0,
  },
  {
    id: 'evening-expiry',
    title: '⏰ Evening Window Closing in 5 min',
    body: 'Last chance to log today\'s evening habits before 10 PM. 🌑',
    hour: 21, minute: 55,
  },
  {
    id: 'brahma-muhurta',
    title: '🌑 Brahma Muhurta in 15 minutes',
    body: 'The rarest Sattvic window opens at 5 AM. Rise, set your Sankalpa, meditate. 🙏',
    hour: 4, minute: 45,
  },
];

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

// ── Schedule all slot reminders ───────────────────────────────────────────────
export async function scheduleAllNativeReminders(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await setupReminderChannel();

  for (const r of SLOT_NOTIFICATIONS) {
    try {
      await notifee.cancelTriggerNotification(`reminder-${r.id}`);
    } catch { /* ignore */ }

    const now = new Date();
    const next = new Date();
    next.setHours(r.hour, r.minute, 0, 0);
    if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);

    await notifee.createTriggerNotification(
      {
        id: `reminder-${r.id}`,
        title: r.title,
        body: r.body,
        data: { type: REMINDER_DATA_TYPE, slotId: r.id },
        android: {
          channelId: REMINDER_CHANNEL_ID,
          importance: AndroidImportance.HIGH,
          category: AndroidCategory.ALARM,
          visibility: AndroidVisibility.PUBLIC,
          sound: 'mantra_alarm',
          vibrationPattern: [0, 300, 200, 300],
          // ── Full-screen intent: pops over all apps like an alarm ────────────
          fullScreenAction: {
            id: 'default',
            launchActivity: 'default',
          },
          pressAction: { id: 'default', launchActivity: 'default' },
          showTimestamp: true,
          ongoing: false,
        },
      },
      {
        type: TriggerType.TIMESTAMP,
        timestamp: next.getTime(),
        alarmManager: { allowWhileIdle: true },
        repeatFrequency: RepeatFrequency.DAILY,
      },
    );

    console.log(
      `[NativeReminders] ✅ Scheduled ${r.id} ` +
      `at ${r.hour}:${String(r.minute).padStart(2, '0')}`,
    );
  }
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
