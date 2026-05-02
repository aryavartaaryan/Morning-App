/**
 * streakSync.ts
 *
 * Persists every user's habit streaks (individual + combined Dinacharya streak)
 * to Firestore so they survive device changes and are visible across sessions.
 *
 * Firestore path: user_streaks/{userId}
 */

import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  HabitLogEntry,
  calcStreaks,
  calcDinacharyaStreak,
  calcBestStreak,
} from '@/lib/habitLogs';

// ── Firestore document shape ──────────────────────────────────────────────────

export interface UserStreakDoc {
  userId: string;
  updatedAt: any;                        // Firestore server timestamp
  habitStreaks: Record<string, number>;  // current streak per habitId
  bestStreaks: Record<string, number>;   // all-time best streak per habitId
  dinacharyaStreak: number;             // combined Dinacharya streak (all core habits)
}

// ── Write: called after every habit log & on app load ────────────────────────

/**
 * Computes all streak values from logs and writes them to Firestore.
 * Silent — never throws; local state remains correct even if sync fails.
 */
export async function syncStreaksToFirestore(
  userId: string,
  logs: HabitLogEntry[],
  coreHabitIds: string[],
): Promise<void> {
  try {
    const habitStreaks = calcStreaks(logs);
    const dinacharyaStreak = calcDinacharyaStreak(logs, coreHabitIds);

    // Best-ever streak for every habit that appears in recent logs
    const allHabitIds = [...new Set(logs.map(l => l.habitId))];
    const bestStreaks: Record<string, number> = {};
    for (const id of allHabitIds) {
      bestStreaks[id] = calcBestStreak(logs, id);
    }

    await setDoc(
      doc(db, 'user_streaks', userId),
      {
        userId,
        updatedAt: serverTimestamp(),
        habitStreaks,
        bestStreaks,
        dinacharyaStreak,
      },
      { merge: true },
    );
  } catch {
    /* silent — streak display from local calc is unaffected */
  }
}

// ── Read: used to pre-populate streaks before local logs finish loading ───────

export async function loadStreaksFromFirestore(userId: string): Promise<UserStreakDoc | null> {
  try {
    const snap = await getDoc(doc(db, 'user_streaks', userId));
    if (snap.exists()) return snap.data() as UserStreakDoc;
  } catch { /* ignore */ }
  return null;
}
