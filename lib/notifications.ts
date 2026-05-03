import * as Notifications from 'expo-notifications';

try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
} catch { /* Expo Go — skip */ }

export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ── Bodhi speech scripts per notification per language ────────────────────────
export const NOTIFICATION_SPEECHES: Record<string, Record<string, string>> = {
  'wake-alarm': {
    en: "Good morning! Rise and greet this sacred day with intention. Drink warm water, breathe deeply, and let your Agni awaken gently. Your body is ready. Your mind is clear. Begin. 🙏",
    hi: "शुभ प्रभात! इस पवित्र दिन को संकल्प के साथ शुरू करें। गर्म पानी पियें, गहरी सांस लें और अपनी अग्नि को जागृत करें।",
  },
  'brahma-muhurta': {
    en: "Brahma Muhurta has arrived. The cosmos is completely silent right now and your mind is at its clearest. Rise, set your Sankalpa, and meditate. This is the most auspicious window of the entire day. Do not let it pass. 🌑",
    hi: "ब्रह्म मुहूर्त आ गया है। ब्रह्मांड पूर्णतः शांत है और आपका मन सबसे स्पष्ट है। उठिए, अपना संकल्प लीजिए और ध्यान करिए। यह दिन का सबसे पवित्र समय है।",
  },
  'morning-start': {
    en: "Good morning! The Kapha morning window is now open. Do your Surya Namaskar, drink warm water, and set your sankalpa. Your Agni needs this warmth right now.",
    hi: "शुभ प्रभात! कफ काल शुरू हो गया है। सूर्य नमस्कार करें, गर्म पानी पियें और अपना संकल्प लें। आपकी अग्नि को यह ऊर्जा चाहिए।",
  },
  'morning-expiry': {
    en: "Morning rituals close in five minutes. Log your morning habits now before the Kapha window ends.",
    hi: "सुबह की दिनचर्या पाँच मिनट में बंद होगी। अभी अपनी सुबह की आदतें दर्ज करें।",
  },
  'afternoon-start': {
    en: "Pitta noon is here! Your Agni is at its absolute peak. Have your largest meal, tackle your hardest decisions, and get into deep focus work right now.",
    hi: "पित्त दोपहर आ गई! आपकी अग्नि अभी अपने शिखर पर है। सबसे बड़ा भोजन करें और कठिन निर्णय लें।",
  },
  'afternoon-expiry': {
    en: "The Pitta power window closes in five minutes. Log your afternoon habits before your energy shifts to Vata.",
    hi: "पित्त काल पाँच मिनट में बंद होगा। दोपहर की आदतें अभी दर्ज करें।",
  },
  'evening-start': {
    en: "Good evening! The Kapha wind-down begins. Eat light, take a gentle walk, and put your screens away. Every choice you make now protects your Ojas tonight.",
    hi: "शुभ संध्या! कफ काल शुरू। हल्का भोजन करें, टहलें और स्क्रीन बंद करें। आज रात के ओजस की रक्षा करें।",
  },
  'evening-expiry': {
    en: "Evening window closes in five minutes. Log your wind-down habits now before the late Pitta hour begins.",
    hi: "शाम की दिनचर्या पाँच मिनट में बंद होगी। अभी अपनी आदतें दर्ज करें।",
  },
  'checkin-reminder': {
    en: "Bodhi is ready with today's Ayurvedic wisdom. Open OneSutra for your morning check-in and see what the cosmos prescribes for you today.",
    hi: "बोधि आज की आयुर्वेदिक जानकारी के साथ तैयार है। अपना दैनिक चेक-इन शुरू करें।",
  },
};

// ── Scheduled notifications ───────────────────────────────────────────────────
const SLOT_REMINDERS = [
  // ── Period START notifications ──────────────────────────────────────────────
  {
    id: 'morning-start',
    title: '🌅 Morning Rituals Window Open',
    body: 'Kapha Kala is live. Move your body, warm water, Surya Namaskar. Log your habits now. 🙏',
    hour: 6, minute: 0,
  },
  {
    id: 'afternoon-start',
    title: '🔥 Pitta Noon — Peak Agni Window',
    body: 'Agni is strongest right now. Eat your main meal, make bold decisions. Log afternoon habits. 🍛',
    hour: 12, minute: 0,
  },
  {
    id: 'evening-start',
    title: '🌆 Evening Wind-Down Window Open',
    body: 'Light dinner, evening walk, screen-free time. Protect your Ojas. Log habits now. 🪔',
    hour: 18, minute: 0,
  },
  {
    id: 'checkin-reminder',
    title: '💭 Daily Check-In — Bodhi Awaits',
    body: "Bodhi has your Ayurvedic wisdom for today. Tap to begin your morning check-in. ✦",
    hour: 8, minute: 0,
  },
  // ── 5 minutes before period EXPIRY ─────────────────────────────────────────
  {
    id: 'morning-expiry',
    title: '⏰ Morning Window Closing in 5 min',
    body: 'Last chance! Log your morning habits before the Kapha window ends at 10 AM.',
    hour: 9, minute: 55,
  },
  {
    id: 'afternoon-expiry',
    title: '⏰ Afternoon Window Closing in 5 min',
    body: 'Pitta noon ends soon. Log your afternoon habits before 2 PM!',
    hour: 13, minute: 55,
  },
  {
    id: 'evening-expiry',
    title: '⏰ Evening Window Closing in 5 min',
    body: 'Evening wind-down ends at 10 PM. Log your habits now before the window closes.',
    hour: 21, minute: 55,
  },
];

// ── Channel setup (call once at app startup) ─────────────────────────────────
export async function setupNotificationChannel() {
  if (require('react-native').Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync('onesutra-alarms', {
      name: 'OneSutra Alarms',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'mantra_alarm.wav',
      vibrationPattern: [0, 500, 500, 500],
      enableVibrate: true,
      showBadge: true,
      bypassDnd: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
    console.log('[Alarm] onesutra-alarms channel created/updated');
  } catch (e) {
    console.warn('[Alarm] Channel setup failed:', e);
  }
}

export async function scheduleHabitReminders() {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  await setupNotificationChannel();
  await Notifications.cancelAllScheduledNotificationsAsync();
  console.log('[Alarm] Scheduling habit reminders...');

  for (const r of SLOT_REMINDERS) {
    await Notifications.scheduleNotificationAsync({
      identifier: r.id,
      content: {
        title: r.title,
        body: r.body,
        sound: 'mantra_alarm.wav',
        data: { speechId: r.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: r.hour,
        minute: r.minute,
        channelId: 'onesutra-alarms',
      },
    });
    console.log(`[Alarm] Scheduled habit reminder: ${r.id} at ${r.hour}:${String(r.minute).padStart(2,'0')}`);
  }
}

export async function cancelAllReminders() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// ── Alarm Settings Type ───────────────────────────────────────────────────────
export interface CustomReminder {
  id: string; title: string; body: string; hour: number; minute: number; enabled: boolean;
}
export interface AlarmSettings {
  wakeAlarm: { enabled: boolean; hour: number; minute: number };
  brahmaReminder: boolean;
  eveningMantra: boolean;
  checkinReminder: boolean;
  habitAlerts: Record<string, boolean>;
  customReminders: CustomReminder[];
  selectedMantraId?: string;
}
export const DEFAULT_ALARM_SETTINGS: AlarmSettings = {
  wakeAlarm: { enabled: false, hour: 5, minute: 30 },
  brahmaReminder: true,
  eveningMantra: false,
  checkinReminder: true,
  habitAlerts: {},
  customReminders: [],
};

// ── Per-habit expiry window (minutes from midnight, alert 15 min before end) ─
export const HABIT_ALERT_TIMES: Record<string, { alertHour: number; alertMinute: number; label: string; emoji: string }> = {
  wake_early: { alertHour: 6, alertMinute: 15, label: 'Wake Early', emoji: '🌙' },
  warm_water: { alertHour: 7, alertMinute: 15, label: 'Warm Water', emoji: '💧' },
  meditation: { alertHour: 7, alertMinute: 45, label: 'Meditation', emoji: '🧘' },
  pranayama: { alertHour: 7, alertMinute: 45, label: 'Pranayama', emoji: '🌬️' },
  sunlight: { alertHour: 8, alertMinute: 45, label: 'Sunlight', emoji: '☀️' },
  breakfast: { alertHour: 9, alertMinute: 15, label: 'Breakfast', emoji: '🌾' },
  main_meal: { alertHour: 13, alertMinute: 15, label: 'Main Meal', emoji: '🍛' },
  walk: { alertHour: 13, alertMinute: 45, label: 'Shatapavali', emoji: '🚶' },
  herbal_tea: { alertHour: 16, alertMinute: 45, label: 'Herbal Tea', emoji: '🍵' },
  evening_walk: { alertHour: 18, alertMinute: 45, label: 'Evening Walk', emoji: '🌆' },
  light_dinner: { alertHour: 19, alertMinute: 45, label: 'Light Dinner', emoji: '🥗' },
  screen_free: { alertHour: 21, alertMinute: 45, label: 'Screen-free', emoji: '📵' },
  journaling: { alertHour: 22, alertMinute: 15, label: 'Journaling', emoji: '📓' },
  sleep: { alertHour: 22, alertMinute: 45, label: 'Sleep 10 PM', emoji: '🌑' },
};

// ── Wake-up alarm ─────────────────────────────────────────────────────────────
// IMPORTANT: On Android the wake alarm is owned by the native AlarmManager →
// AlarmSoundService path (see lib/nativeAlarm.ts + AlarmModule.kt). expo-notifications
// can NOT auto-play a looping alarm sound when the app is killed — its "sound" field
// only plays the channel tone once on delivery, which created the "tap-to-play" bug.
// On iOS we still register a notification because that is the ONLY thing iOS allows
// for a killed app. The bundled sound (≤30 s, no loop) is the best iOS can give
// without Apple Critical Alert entitlement.
export async function scheduleWakeAlarm(hour: number, minute: number) {
  const { Platform } = require('react-native');
  if (Platform.OS === 'android') return; // native AlarmManager handles it
  await Notifications.cancelScheduledNotificationAsync('wake-alarm').catch(() => { });
  await setupNotificationChannel();
  const pad = (n: number) => String(n).padStart(2, '0');
  const period = hour < 12 ? 'AM' : 'PM';
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  await Notifications.scheduleNotificationAsync({
    identifier: 'wake-alarm',
    content: {
      title: `🌙 OneSutra Wake Alarm — ${pad(h12)}:${pad(minute)} ${period}`,
      body: 'Tap to begin your morning practice. 🙏',
      sound: 'mantra_alarm.wav',
      interruptionLevel: 'timeSensitive',
      data: { type: 'wake-alarm', speechId: 'wake-alarm' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

export async function cancelWakeAlarm() {
  await Notifications.cancelScheduledNotificationAsync('wake-alarm').catch(() => { });
}

// ── Brahma Muhurta reminder at 4:45 AM ───────────────────────────────────────
export async function scheduleBrahmaReminder() {
  await Notifications.cancelScheduledNotificationAsync('brahma-muhurta').catch(() => { });
  await setupNotificationChannel();
  await Notifications.scheduleNotificationAsync({
    identifier: 'brahma-muhurta',
    content: {
      title: '🌑 Brahma Muhurta Begins in 15 min',
      body: 'The sacred pre-dawn window opens at 5 AM. The cosmos is silent. Prepare to meditate, chant your mantra, set your Sankalpa.',
      sound: 'mantra_alarm.wav',
      data: { type: 'brahma-muhurta', speechId: 'brahma-muhurta' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 4,
      minute: 45,
      channelId: 'onesutra-alarms',
    },
  });
  console.log('[Alarm] Brahma Muhurta reminder scheduled at 4:45 AM → channel onesutra-alarms');
}

export async function cancelBrahmaReminder() {
  await Notifications.cancelScheduledNotificationAsync('brahma-muhurta').catch(() => { });
}

// ── Per-habit expiry alert ────────────────────────────────────────────────────
export async function scheduleHabitAlert(habitId: string) {
  const t = HABIT_ALERT_TIMES[habitId];
  if (!t) return;
  const id = `habit-alert-${habitId}`;
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => { });
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: {
      title: `${t.emoji} ${t.label} — Closing Soon`,
      body: `Your ${t.label} window closes in 15 minutes. Log it now to keep your streak! 🔥`,
      sound: 'mantra_alarm.wav',
      data: { type: 'habit-expiry', habitId },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: t.alertHour,
      minute: t.alertMinute,
      channelId: 'onesutra-alarms',
    },
  });
  console.log(`[Alarm] Habit alert scheduled: ${habitId} at ${t.alertHour}:${String(t.alertMinute).padStart(2,'0')}`);
}

export async function cancelHabitAlert(habitId: string) {
  await Notifications.cancelScheduledNotificationAsync(`habit-alert-${habitId}`).catch(() => { });
}

// ── Custom reminder ───────────────────────────────────────────────────────────
export async function scheduleCustomReminder(r: CustomReminder) {
  await Notifications.cancelScheduledNotificationAsync(`custom-${r.id}`).catch(() => { });
  if (!r.enabled) return;
  await Notifications.scheduleNotificationAsync({
    identifier: `custom-${r.id}`,
    content: { title: r.title, body: r.body, sound: 'mantra_alarm.wav', data: { type: 'custom' } },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: r.hour,
      minute: r.minute,
      channelId: 'onesutra-alarms',
    },
  });
  console.log(`[Alarm] Custom reminder scheduled: "${r.title}" at ${r.hour}:${String(r.minute).padStart(2,'0')}`);
}

export async function cancelCustomReminder(id: string) {
  await Notifications.cancelScheduledNotificationAsync(`custom-${id}`).catch(() => { });
}

// ── Master reschedule from settings ──────────────────────────────────────────
export async function rescheduleAllFromSettings(s: AlarmSettings) {

  if (s.wakeAlarm.enabled) {
    await scheduleWakeAlarm(s.wakeAlarm.hour, s.wakeAlarm.minute);
  } else {
    await cancelWakeAlarm();
  }

  if (s.brahmaReminder) await scheduleBrahmaReminder();
  else await cancelBrahmaReminder();

  for (const [habitId, enabled] of Object.entries(s.habitAlerts)) {
    if (enabled) await scheduleHabitAlert(habitId);
    else await cancelHabitAlert(habitId);
  }

  for (const r of s.customReminders) {
    await scheduleCustomReminder(r);
  }

  // Reschedule slot reminders (check-in + slot start/expiry)
  for (const r of SLOT_REMINDERS) {
    if (r.id === 'checkin-reminder' && !s.checkinReminder) {
      await Notifications.cancelScheduledNotificationAsync(r.id).catch(() => { });
      continue;
    }
    await Notifications.scheduleNotificationAsync({
      identifier: r.id,
      content: { title: r.title, body: r.body, sound: 'mantra_alarm.wav', data: { speechId: r.id } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: r.hour,
        minute: r.minute,
        channelId: 'onesutra-alarms',
      },
    });
    console.log(`[Alarm] Rescheduled slot reminder: ${r.id} at ${r.hour}:${String(r.minute).padStart(2,'0')}`);
  }
  console.log('[Alarm] rescheduleAllFromSettings complete');
}
