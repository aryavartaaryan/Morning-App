/**
 * Sunrise Streak Engine
 * Tracks how many consecutive days the user has woken before sunrise via alarm.
 */

import { store, KEYS } from './storage';

export interface WakeLogEntry {
  date: string;       // 'YYYY-MM-DD'
  wakeTimeMs: number; // epoch ms
  wakeTimeStr: string; // '05:23 AM'
  wakeHour: number;   // decimal hour e.g. 5.38
  sunriseHour: number; // decimal hour
  wasBeforeSunrise: boolean;
  mood: string | null; // emoji e.g. '🔥' or null
  sharedToday: boolean;
  cardShownToday?: boolean;
}

export interface SunriseStreak {
  count: number;       // current streak days
  lastDate: string;    // 'YYYY-MM-DD' of last recorded day
  longestEver: number;
}

const TODAY = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const YESTERDAY = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function fmtWakeTime(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
}

/**
 * Call this when the alarm is dismissed (before or at sunrise).
 * Saves wake log and updates streak.
 */
export async function recordWake(sunriseHour: number): Promise<WakeLogEntry> {
  const now     = new Date();
  const wakeH   = now.getHours() + now.getMinutes() / 60;
  const before  = wakeH < sunriseHour;
  const today   = TODAY();

  const entry: WakeLogEntry = {
    date: today,
    wakeTimeMs: now.getTime(),
    wakeTimeStr: fmtWakeTime(now),
    wakeHour: wakeH,
    sunriseHour,
    wasBeforeSunrise: before,
    mood: null,
    sharedToday: false,
  };

  await store.setJSON(KEYS.wakeLog, entry);

  // Update streak only if woke before sunrise
  if (before) {
    const prev = await store.getJSON<SunriseStreak>(KEYS.sunriseStreak);
    const yest  = YESTERDAY();
    let newCount = 1;
    if (prev) {
      if (prev.lastDate === yest || prev.lastDate === today) {
        newCount = prev.lastDate === today ? prev.count : prev.count + 1;
      }
    }
    const streak: SunriseStreak = {
      count: newCount,
      lastDate: today,
      longestEver: Math.max(newCount, prev?.longestEver ?? 0),
    };
    await store.setJSON(KEYS.sunriseStreak, streak);
  }

  return entry;
}

/** Update mood on today's wake log entry */
export async function setWakeMood(mood: string): Promise<void> {
  const entry = await store.getJSON<WakeLogEntry>(KEYS.wakeLog);
  if (entry && entry.date === TODAY()) {
    await store.setJSON(KEYS.wakeLog, { ...entry, mood });
  }
}

/** Mark today's share card as already shown (prevents re-showing on subsequent app opens) */
export async function markCardShown(): Promise<void> {
  const entry = await store.getJSON<WakeLogEntry>(KEYS.wakeLog);
  if (entry && entry.date === TODAY()) {
    await store.setJSON(KEYS.wakeLog, { ...entry, cardShownToday: true });
  }
}

/** Mark today as shared */
export async function markShared(): Promise<void> {
  const entry = await store.getJSON<WakeLogEntry>(KEYS.wakeLog);
  if (entry && entry.date === TODAY()) {
    await store.setJSON(KEYS.wakeLog, { ...entry, sharedToday: true });
  }
}

/** Get today's wake log (null if not yet woken) */
export async function getTodayWakeLog(): Promise<WakeLogEntry | null> {
  const entry = await store.getJSON<WakeLogEntry>(KEYS.wakeLog);
  if (!entry) return null;
  return entry.date === TODAY() ? entry : null;
}

/** Get current streak */
export async function getStreak(): Promise<SunriseStreak> {
  const s = await store.getJSON<SunriseStreak>(KEYS.sunriseStreak);
  return s ?? { count: 0, lastDate: '', longestEver: 0 };
}
