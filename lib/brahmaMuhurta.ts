/**
 * Brahma Muhurta Intelligence Engine
 * Calculates GPS-accurate pre-dawn window and schedules daily notification.
 *
 * Brahma Muhurta = 96 minutes (2 muhurtas) before sunrise.
 * Duration       = 48 minutes (1 muhurta).
 *
 * For Western audiences, mapped to modern science equivalents.
 */

import { getSolarTimes, type SolarTimes } from './solar';
import notifee, { AndroidImportance, AndroidCategory, AndroidVisibility, TriggerType, RepeatFrequency } from '@notifee/react-native';
import { Platform } from 'react-native';

export const BM_START_MIN = 96; // minutes before sunrise → window opens
export const BM_END_MIN   = 48; // minutes before sunrise → window closes
export const BM_CHANNEL   = 'arise-brahma-muhurta';
export const BM_NOTIF_ID  = 'arise-bm-daily';

// ── Science aliases — same phenomenon, Western vocabulary ────────────────────
export const SCIENCE_ALIASES = [
  {
    emoji: '🧠',
    title: 'Pre-Dawn Alpha State',
    desc: 'EEG research: alpha brain waves dominate 90 min before sunrise — peak window for meditation, deep focus & creative insight.',
  },
  {
    emoji: '⚡',
    title: 'Cortisol Awakening Response',
    desc: 'Cortisol naturally surges 50% on waking. Timing this to Brahma Muhurta maximizes your natural energy spike & mental clarity.',
  },
  {
    emoji: '🌙',
    title: 'REM Completion Window',
    desc: "The brain's final REM cycle — rich in memory consolidation & creative dreaming — occurs precisely in this pre-dawn hour.",
  },
  {
    emoji: '💓',
    title: 'HRV Golden Hour',
    desc: 'Heart Rate Variability coherence peaks before sunrise. The optimal window for breathwork & deep nervous system reset.',
  },
  {
    emoji: '☀️',
    title: 'Circadian Light Gate',
    desc: 'Rising before sunrise exposure resets the master biological clock — improving sleep quality for the following 24 hours.',
  },
  {
    emoji: '🔬',
    title: 'Chrono-Biology Peak Window',
    desc: 'Chronobiology research identifies pre-dawn as the window of peak neuroplasticity — ideal for learning, habit formation & intention-setting.',
  },
];

// ── Types ─────────────────────────────────────────────────────────────────────
export interface BrahmaMuhurtaInfo {
  startH: number;            // decimal hours, e.g. 4.4 = 4:24 AM
  endH: number;
  sunriseH: number;
  startLabel: string;        // "04:24 AM"
  endLabel: string;
  sunriseLabel: string;
  status: 'active' | 'upcoming' | 'missed';
  minutesUntil: number;      // > 0 when upcoming
  minutesRemaining: number;  // > 0 when active
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDecH(h: number): string {
  const totalMin = Math.round(h * 60);
  const hh = Math.floor(totalMin / 60) % 24;
  const mm = totalMin % 60;
  const ampm = hh < 12 ? 'AM' : 'PM';
  const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  return `${String(h12).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${ampm}`;
}

// ── Core calculation ──────────────────────────────────────────────────────────
export function getBrahmaMuhurtaInfo(
  solar: SolarTimes,
  nowH?: number,
): BrahmaMuhurtaInfo {
  const startH = solar.sunrise - BM_START_MIN / 60;
  const endH   = solar.sunrise - BM_END_MIN   / 60;
  const now    = nowH ?? (new Date().getHours() + new Date().getMinutes() / 60);

  let status: 'active' | 'upcoming' | 'missed';
  let minutesUntil = 0;
  let minutesRemaining = 0;

  if (now < startH) {
    status = 'upcoming';
    minutesUntil = Math.max(1, Math.round((startH - now) * 60));
  } else if (now < endH) {
    status = 'active';
    minutesRemaining = Math.max(1, Math.round((endH - now) * 60));
  } else {
    status = 'missed';
  }

  return {
    startH, endH, sunriseH: solar.sunrise,
    startLabel: fmtDecH(startH),
    endLabel:   fmtDecH(endH),
    sunriseLabel: fmtDecH(solar.sunrise),
    status, minutesUntil, minutesRemaining,
  };
}

// ── Notification scheduling ───────────────────────────────────────────────────
export async function scheduleBrahmaMuhurtaNotif(
  lat: number,
  lon: number,
): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await notifee.createChannel({
      id: BM_CHANNEL,
      name: 'Brahma Muhurta · Pre-Dawn Alert',
      importance: AndroidImportance.HIGH,
      vibration: true,
      bypassDnd: false,
      visibility: AndroidVisibility.PUBLIC,
    } as any);

    const solar  = getSolarTimes(lat, lon);
    const bmH    = solar.sunrise - BM_START_MIN / 60;
    const bmHour = Math.floor(Math.max(0, bmH));
    const bmMin  = Math.round((Math.max(0, bmH) - bmHour) * 60);

    const now = new Date();
    const fire = new Date();
    fire.setHours(bmHour, bmMin, 0, 0);
    if (fire.getTime() <= now.getTime()) fire.setDate(fire.getDate() + 1);

    await notifee.cancelTriggerNotification(BM_NOTIF_ID).catch(() => {});
    await notifee.createTriggerNotification(
      {
        id: BM_NOTIF_ID,
        title: '🌙 Brahma Muhurta — Sacred Window Opens',
        body: `Pre-Dawn Alpha State begins. Sunrise in 96 min. Rise, meditate & set your Sankalpa. 🙏`,
        android: {
          channelId: BM_CHANNEL,
          importance: AndroidImportance.HIGH,
          category: AndroidCategory.REMINDER,
          visibility: AndroidVisibility.PUBLIC,
          pressAction: { id: 'default', launchActivity: 'default' },
          color: '#818cf8',
          showTimestamp: false,
          subText: 'Pre-Dawn Alert',
        } as any,
      },
      {
        type: TriggerType.TIMESTAMP,
        timestamp: fire.getTime(),
        repeatFrequency: RepeatFrequency.DAILY,
        alarmManager: { allowWhileIdle: true },
      } as any,
    );
  } catch (e) {
    console.warn('[BrahmaMuhurta] schedule failed:', e);
  }
}

export async function cancelBrahmaMuhurtaNotif(): Promise<void> {
  await notifee.cancelTriggerNotification(BM_NOTIF_ID).catch(() => {});
}

export const SACRED_CHANNEL = 'arise-sacred-hour';
export const SUNRISE_NOTIF_ID  = 'arise-sunrise-daily';
export const SUNSET_NOTIF_ID   = 'arise-sunset-daily';
export const ZENITH_NOTIF_ID   = 'arise-zenith-daily';

// ── Elegant Western-science sacred hour notification copy ─────────────────────
const SACRED_NOTIF_CONTENT = {
  sunrise: {
    title: '🌅 Circadian Anchor — Sun Rising',
    body:  'Your biological clock is locking to true sunrise right now. Step outside. 10 min of direct morning light sets your cortisol, mood and sleep for the full next 24 hours.',
    sub:   'Sacred Hour · Sunrise',
    color: '#fbbf24',
  },
  zenith: {
    title: '☀️ Solar Zenith — Your Peak Hour',
    body:  'The sun is at its highest point. Your core temperature, cognitive speed, reaction time and digestive enzymes are all peaking together. This is your sharpest hour — use it.',
    sub:   'Sacred Hour · Solar Noon',
    color: '#FDE047',
  },
  sunset: {
    title: '🌇 Melatonin Gate — Sun Setting',
    body:  'The sun has crossed the horizon. Melatonin synthesis begins. Your nervous system is shifting from sympathetic to parasympathetic mode. Lower your lights and wind down.',
    sub:   'Sacred Hour · Sunset',
    color: '#f97316',
  },
};

export async function scheduleSacredHourNotifs(
  lat: number,
  lon: number,
): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await notifee.createChannel({
      id: SACRED_CHANNEL,
      name: 'Sacred Solar Hour Alerts',
      importance: AndroidImportance.HIGH,
      vibration: true,
      bypassDnd: false,
      visibility: AndroidVisibility.PUBLIC,
    } as any);

    const solar = getSolarTimes(lat, lon);
    const now = Date.now();

    // ── Sunrise ──────────────────────────────────────────────────────────────
    const srH = Math.floor(solar.sunrise);
    const srM = Math.round((solar.sunrise - srH) * 60);
    const srFire = new Date();
    srFire.setHours(srH, srM, 0, 0);
    if (srFire.getTime() <= now) srFire.setDate(srFire.getDate() + 1);

    await notifee.cancelTriggerNotification(SUNRISE_NOTIF_ID).catch(() => {});
    await notifee.createTriggerNotification(
      {
        id: SUNRISE_NOTIF_ID,
        title: SACRED_NOTIF_CONTENT.sunrise.title,
        body:  SACRED_NOTIF_CONTENT.sunrise.body,
        android: {
          channelId: SACRED_CHANNEL,
          importance: AndroidImportance.HIGH,
          category: AndroidCategory.REMINDER,
          visibility: AndroidVisibility.PUBLIC,
          pressAction: { id: 'default', launchActivity: 'default' },
          color: SACRED_NOTIF_CONTENT.sunrise.color,
          showTimestamp: false,
          subText: SACRED_NOTIF_CONTENT.sunrise.sub,
          largeIcon: 'ic_sunrise',
        } as any,
      },
      {
        type: TriggerType.TIMESTAMP,
        timestamp: srFire.getTime(),
        repeatFrequency: RepeatFrequency.DAILY,
        alarmManager: { allowWhileIdle: true },
      } as any,
    );

    // ── Solar Zenith / Noon ───────────────────────────────────────────────────
    const snH = Math.floor(solar.solarNoon);
    const snM = Math.round((solar.solarNoon - snH) * 60);
    const snFire = new Date();
    snFire.setHours(snH, snM, 0, 0);
    if (snFire.getTime() <= now) snFire.setDate(snFire.getDate() + 1);

    await notifee.cancelTriggerNotification(ZENITH_NOTIF_ID).catch(() => {});
    await notifee.createTriggerNotification(
      {
        id: ZENITH_NOTIF_ID,
        title: SACRED_NOTIF_CONTENT.zenith.title,
        body:  SACRED_NOTIF_CONTENT.zenith.body,
        android: {
          channelId: SACRED_CHANNEL,
          importance: AndroidImportance.HIGH,
          category: AndroidCategory.REMINDER,
          visibility: AndroidVisibility.PUBLIC,
          pressAction: { id: 'default', launchActivity: 'default' },
          color: SACRED_NOTIF_CONTENT.zenith.color,
          showTimestamp: false,
          subText: SACRED_NOTIF_CONTENT.zenith.sub,
        } as any,
      },
      {
        type: TriggerType.TIMESTAMP,
        timestamp: snFire.getTime(),
        repeatFrequency: RepeatFrequency.DAILY,
        alarmManager: { allowWhileIdle: true },
      } as any,
    );

    // ── Sunset ───────────────────────────────────────────────────────────────
    const ssH = Math.floor(solar.sunset);
    const ssM = Math.round((solar.sunset - ssH) * 60);
    const ssFire = new Date();
    ssFire.setHours(ssH, ssM, 0, 0);
    if (ssFire.getTime() <= now) ssFire.setDate(ssFire.getDate() + 1);

    await notifee.cancelTriggerNotification(SUNSET_NOTIF_ID).catch(() => {});
    await notifee.createTriggerNotification(
      {
        id: SUNSET_NOTIF_ID,
        title: SACRED_NOTIF_CONTENT.sunset.title,
        body:  SACRED_NOTIF_CONTENT.sunset.body,
        android: {
          channelId: SACRED_CHANNEL,
          importance: AndroidImportance.HIGH,
          category: AndroidCategory.REMINDER,
          visibility: AndroidVisibility.PUBLIC,
          pressAction: { id: 'default', launchActivity: 'default' },
          color: SACRED_NOTIF_CONTENT.sunset.color,
          showTimestamp: false,
          subText: SACRED_NOTIF_CONTENT.sunset.sub,
        } as any,
      },
      {
        type: TriggerType.TIMESTAMP,
        timestamp: ssFire.getTime(),
        repeatFrequency: RepeatFrequency.DAILY,
        alarmManager: { allowWhileIdle: true },
      } as any,
    );

  } catch (e) {
    console.warn('[SacredHour] schedule failed:', e);
  }
}

export async function cancelSacredHourNotifs(): Promise<void> {
  await notifee.cancelTriggerNotification(SUNRISE_NOTIF_ID).catch(() => {});
  await notifee.cancelTriggerNotification(SUNSET_NOTIF_ID).catch(() => {});
  await notifee.cancelTriggerNotification(ZENITH_NOTIF_ID).catch(() => {});
}

// ── Real-time sacred hour notification (fires when hero ring changes phase) ────
// Call this from index.tsx when sacredHour.type changes to a non-null value.
export async function fireSacredHourNotification(
  type: 'sunrise' | 'sunset' | 'zenith',
): Promise<void> {
  try {
    const content = SACRED_NOTIF_CONTENT[type];
    // Ensure channel exists (no-op if already created)
    await notifee.createChannel({
      id: SACRED_CHANNEL,
      name: 'Sacred Solar Hour Alerts',
      importance: AndroidImportance.HIGH,
      vibration: true,
      bypassDnd: false,
      visibility: AndroidVisibility.PUBLIC,
    } as any);

    await notifee.displayNotification({
      id: `sacred-live-${type}`,
      title: content.title,
      body: content.body,
      android: {
        channelId: SACRED_CHANNEL,
        importance: AndroidImportance.HIGH,
        category: AndroidCategory.REMINDER,
        visibility: AndroidVisibility.PUBLIC,
        pressAction: { id: 'default', launchActivity: 'default' },
        color: content.color,
        showTimestamp: true,
        subText: content.sub,
        autoCancel: true,
      } as any,
    });
  } catch (e) {
    console.warn('[SacredHour] live notification failed:', e);
  }
}
