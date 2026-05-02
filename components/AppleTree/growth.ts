import { type HabitLogEntry } from '@/lib/habitLogs';
import { getAppleStage, type AppleTreeState, type HealthState } from './types';

const HABIT_IDS = [
  'wake_early','warm_water','morning_cleanse','meditation',
  'morning_walk','breakfast','lunch','dinner','sleep',
  'journaling','workout','evening_walk','sunlight','herbal_tea',
];

function daysBetween(d1: Date, d2: Date): number {
  return Math.floor(Math.abs(d2.getTime() - d1.getTime()) / 86400000);
}

function dateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function getScheduledDaysInWindow(
  habitId: string,
  windowStart: Date,
  today: Date,
): number {
  return daysBetween(windowStart, today) + 1;
}

function getCompletedInWindow(
  habitId: string,
  windowStart: Date,
  today: Date,
  logs: HabitLogEntry[],
): number {
  const start = dateStr(windowStart);
  const end = dateStr(today);
  const datesSet = new Set<string>();
  for (const log of logs) {
    if (log.habitId === habitId && (log.status === 'done' || log.status === 'late') &&
        log.date >= start && log.date <= end) {
      datesSet.add(log.date);
    }
  }
  return datesSet.size;
}

function getBestActiveStreak(logs: HabitLogEntry[]): number {
  const byDate: Record<string, Set<string>> = {};
  for (const log of logs) {
    if (log.status === 'done' || log.status === 'late') {
      if (!byDate[log.date]) byDate[log.date] = new Set();
      byDate[log.date].add(log.habitId);
    }
  }
  const today = new Date();
  let best = 0;
  let cur = 0;
  for (let i = 0; i <= 30; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = dateStr(d);
    if (byDate[ds] && byDate[ds].size > 0) { cur++; best = Math.max(best, cur); }
    else { cur = 0; }
  }
  return best;
}

function allHabitsCompletedToday(logs: HabitLogEntry[]): boolean {
  const today = dateStr(new Date());
  const done = new Set(logs.filter(l => l.date === today && (l.status === 'done' || l.status === 'late')).map(l => l.habitId));
  return done.size >= 5;
}

function perfectWeekAchieved(logs: HabitLogEntry[]): boolean {
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const ds = dateStr(d);
    const done = logs.filter(l => l.date === ds && (l.status === 'done' || l.status === 'late'));
    if (done.length < 3) return false;
  }
  return true;
}

function getConsecutiveMissed(logs: HabitLogEntry[]): number {
  const today = new Date();
  let missed = 0;
  for (let i = 1; i <= 7; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const ds = dateStr(d);
    const done = logs.filter(l => l.date === ds && (l.status === 'done' || l.status === 'late'));
    if (done.length === 0) missed++; else break;
  }
  return missed;
}

function getHealthState(missedDays: number, lastHabitDate: string): HealthState {
  const today = new Date();
  const last = new Date(lastHabitDate);
  const daysSince = Math.floor((today.getTime() - last.getTime()) / 86400000);
  if (daysSince <= 1) return 'thriving';
  if (daysSince === 2 || missedDays === 1) return 'needs_water';
  if (daysSince === 3 || missedDays === 2) return 'wilting';
  return 'critical';
}

export function calculateAppleTreeGrowth(
  logs: HabitLogEntry[],
  seasonStartDate?: string,
): AppleTreeState {
  const today = new Date();
  const seasonStart = seasonStartDate
    ? new Date(seasonStartDate)
    : new Date(today.getTime() - 30 * 86400000);
  const windowStart = new Date(today.getTime() - 30 * 86400000);

  let totalScheduled = 0;
  let totalCompleted = 0;

  for (const id of HABIT_IDS) {
    totalScheduled += getScheduledDaysInWindow(id, windowStart, today);
    totalCompleted += getCompletedInWindow(id, windowStart, today, logs);
  }

  let growth = totalScheduled === 0 ? 0 : (totalCompleted / totalScheduled) * 100;

  const streak = getBestActiveStreak(logs);
  if (streak >= 7)  growth += 5;
  if (streak >= 14) growth += 5;
  if (streak >= 21) growth += 5;
  if (allHabitsCompletedToday(logs)) growth += 3;
  if (perfectWeekAchieved(logs)) growth += 7;

  const missedDays = getConsecutiveMissed(logs);
  if (missedDays >= 2) growth -= (missedDays - 1) * 2;

  growth = Math.min(100, Math.max(0, growth));

  const todayLogged = logs.filter(l => l.date === dateStr(today) && (l.status === 'done' || l.status === 'late'));
  const lastHabitDate = todayLogged.length > 0
    ? dateStr(today)
    : logs.length > 0
      ? logs.sort((a, b) => b.date.localeCompare(a.date))[0].date
      : dateStr(new Date(today.getTime() - 5 * 86400000));

  const daysGrowing = daysBetween(seasonStart, today) + 1;
  const completionRate = totalScheduled === 0 ? 0 : Math.round((totalCompleted / totalScheduled) * 100);

  return {
    growthPercent: Math.round(growth),
    currentStage: getAppleStage(growth),
    healthState: getHealthState(missedDays, lastHabitDate),
    lastHabitDate,
    consecutiveMissedDays: missedDays,
    seasonNumber: 1,
    seasonStartDate: dateStr(seasonStart),
    totalHabitsThisSeason: totalCompleted,
    completionRateThisSeason: completionRate,
    bestStreak: streak,
    daysGrowing: Math.min(daysGrowing, 30),
    orchardTrees: [],
  };
}
