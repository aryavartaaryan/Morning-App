import {
  addDoc, collection, getDocs, query, where, orderBy, serverTimestamp,
  setDoc, doc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type LogStatus = 'done' | 'partial' | 'missed' | 'late' | 'skipped';
export type MealSize = 'light' | 'medium' | 'heavy';
export type MealFeeling = 'good' | 'okay' | 'heavy';
export type WorkoutType = 'cardio' | 'strength' | 'yoga' | 'stretching' | 'other';
export type Intensity = 'light' | 'moderate' | 'intense';
export type FeelRating =
  | 'distracted' | 'okay' | 'good' | 'deep'    // meditation
  | 'easy' | 'energising'                       // walk
  | 'light' | 'moderate' | 'intense';           // workout (reuses Intensity labels)

export type InteractionType =
  | 'yesno'
  | 'wake_early'
  | 'warm_water'
  | 'meditation'
  | 'cleanse'
  | 'workout'
  | 'walk'
  | 'meal';

export interface LatLng { lat: number; lng: number; }

export interface HabitLogEntry {
  id?: string;
  habitId: string;
  habitName: string;
  userId: string;
  date: string;           // YYYY-MM-DD
  loggedAt?: any;         // Firestore Timestamp
  status: LogStatus;

  // Measurable
  value?: number | null;
  unit?: string | null;

  // Meal
  mealDescription?: string | null;
  mealSize?: MealSize | null;
  postMealFeeling?: MealFeeling | null;
  photoUri?: string | null;
  isMainMeal?: boolean | null;

  // Walk / Workout duration
  durationMinutes?: number | null;
  distanceKm?: number | null;
  steps?: number | null;
  routeCoordinates?: LatLng[] | null;

  // Sleep (via Wake Early)
  sleepStart?: string | null;           // "HH:MM"
  sleepEnd?: string | null;
  sleepDurationHours?: number | null;
  wakeTime?: string | null;

  // Workout
  workoutType?: WorkoutType | null;
  intensity?: Intensity | null;

  // Cleanse checklist
  cleanseItems?: string[] | null;
  cleanseCount?: number | null;

  // Universal feel rating
  feelRating?: FeelRating | null;

  // Streak snapshot at time of logging
  streakAtLog?: number;

  notes?: string | null;

  // AyuIntel integration
  fromAyuIntel?: boolean;
  ayuIntelVerdict?: 'good' | 'caution' | 'avoid' | null;
  ayuIntelSummary?: string | null;
  ayuIntelAmaRisk?: 'low' | 'medium' | 'high' | null;
  ayuIntelAgniEffect?: 'stimulating' | 'dampening' | 'neutral' | null;
  ayuIntelPrakritiVerdict?: string | null;
}

// ─── Firebase helpers ─────────────────────────────────────────────────────────

/**
 * Persists computed streak data to Firestore so every user's streak is
 * queryable server-side (leaderboards, push notifications, admin views).
 * Called whenever streak data is freshly recomputed on the home screen.
 */
export async function saveStreakSummary(
  userId: string,
  individualStreaks: Record<string, number>,
  combinedStreak: number,
): Promise<void> {
  await setDoc(
    doc(db, 'user_streaks', userId),
    {
      userId,
      individual: individualStreaks,
      combined: combinedStreak,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function saveHabitLog(log: Omit<HabitLogEntry, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'habit_logs'), {
    ...log,
    loggedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function loadRecentLogs(userId: string, days = 30): Promise<HabitLogEntry[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffDate = localDateFromDate(cutoff); // Use local date, not UTC
  const q = query(
    collection(db, 'habit_logs'),
    where('userId', '==', userId),
    where('date', '>=', cutoffDate),
    orderBy('date', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as HabitLogEntry));
}

// ─── Streak calculation ───────────────────────────────────────────────────────

export function calcStreaks(logs: HabitLogEntry[]): Record<string, number> {
  const byHabit: Record<string, Set<string>> = {};
  for (const log of logs) {
    if (log.status === 'done' || log.status === 'late' || log.status === 'partial') {
      if (!byHabit[log.habitId]) byHabit[log.habitId] = new Set();
      byHabit[log.habitId].add(log.date);
    }
  }

  const streaks: Record<string, number> = {};
  const today = localDateStr();

  for (const [habitId, datesSet] of Object.entries(byHabit)) {
    const sorted = Array.from(datesSet).sort().reverse();
    let streak = 0;
    let check = today;
    for (const date of sorted) {
      if (date === check) {
        streak++;
        const [cy, cm, cd] = check.split('-').map(Number);
        const d = new Date(cy, cm - 1, cd - 1);
        check = localDateFromDate(d);
      } else if (date < check) {
        break;
      }
    }
    streaks[habitId] = streak;
  }
  return streaks;
}

/**
 * Overall Dinacharya streak: consecutive days where the user logged ALL
 * of their chosen (active/non-hidden) habits.
 * Today is skipped if not yet complete so the streak does not break mid-day.
 */
export function calcDinacharyaStreak(
  logs: HabitLogEntry[],
  habitIds: string[],
): number {
  if (!habitIds.length) return 0;
  const byDate: Record<string, Set<string>> = {};
  for (const log of logs) {
    if (log.status === 'done' || log.status === 'late' || log.status === 'partial') {
      if (!byDate[log.date]) byDate[log.date] = new Set();
      byDate[log.date].add(log.habitId);
    }
  }
  let streak = 0;
  const now = new Date();
  for (let i = 0; i < 60; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const dateStr = localDateFromDate(d);
    const done = byDate[dateStr] ?? new Set();
    const complete = habitIds.every(id => done.has(id));
    if (complete) { streak++; }
    else if (i === 0) { continue; } // today in-progress — don't break streak
    else { break; }
  }
  return streak;
}

export function calcBestStreak(logs: HabitLogEntry[], habitId: string): number {
  const dates = logs
    .filter(l => l.habitId === habitId &&
      (l.status === 'done' || l.status === 'late' || l.status === 'partial'))
    .map(l => l.date)
    .sort();
  if (!dates.length) return 0;
  let best = 1, cur = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]);
    prev.setDate(prev.getDate() + 1);
    if (prev.toISOString().split('T')[0] === dates[i]) {
      cur++;
      if (cur > best) best = cur;
    } else {
      cur = 1;
    }
  }
  return best;
}

// ─── Score helpers ────────────────────────────────────────────────────────────

export function calcDinacharyaScore(done: number, total: number): number {
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

export function getScoreInfo(score: number): { label: string; icon: string; color: string } {
  if (score >= 90) return { label: 'Excellent', icon: '🔥', color: '#f59e0b' };
  if (score >= 70) return { label: 'Good', icon: '✅', color: '#10b981' };
  if (score >= 50) return { label: 'Moderate', icon: '🔶', color: '#fb923c' };
  return { label: 'Needs attention', icon: '⚠️', color: '#ef4444' };
}

// ─── Geo helpers ──────────────────────────────────────────────────────────────

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Time / duration helpers ──────────────────────────────────────────────────

export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function fmtHHMM(h: number, m: number): string {
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

export function calcSleepDuration(
  sleepH: number, sleepM: number,
  wakeH: number, wakeM: number,
): number {
  let sleepTotal = sleepH * 60 + sleepM;
  let wakeTotal = wakeH * 60 + wakeM;
  if (wakeTotal < sleepTotal) wakeTotal += 24 * 60; // crossed midnight
  return parseFloat(((wakeTotal - sleepTotal) / 60).toFixed(1));
}

export function localDateFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function localDateStr(offsetDays = 0): string {
  const d = new Date();
  if (offsetDays) d.setDate(d.getDate() + offsetDays);
  return localDateFromDate(d);
}

export function todayStr(): string {
  return localDateStr();
}

export function calcMonthlyCount(logs: HabitLogEntry[], habitId: string): number {
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
  const cutoffDate = localDateFromDate(cutoff);
  return logs.filter(l =>
    l.habitId === habitId &&
    l.date >= cutoffDate &&
    (l.status === 'done' || l.status === 'late' || l.status === 'partial'),
  ).length;
}

export function calcWeeklyCount(logs: HabitLogEntry[], habitId: string): number {
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
  const cutoffDate = localDateFromDate(cutoff);
  return logs.filter(l =>
    l.habitId === habitId &&
    l.date >= cutoffDate &&
    (l.status === 'done' || l.status === 'late' || l.status === 'partial'),
  ).length;
}
