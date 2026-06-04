import { store, KEYS } from '@/lib/storage';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface DailyStepData {
  date: string; // YYYY-MM-DD
  steps: number;
  goal: number;
  distanceKm: number; // step-based distance (Apple Health model)
}

export interface StepTrackingState {
  enabled: boolean;
  promptShown: boolean;
  enabledAt: number | null;
  dailyData: DailyStepData[];
  lastUpdated: number;
  currentDaySteps: number;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

export const STEP_GOAL = 10000;

// Apple Health model: average stride = 0.762 m (2.5 ft)
// Used by Apple Health, Google Fit, Fitbit for step-based distance
const STRIDE_KM = 0.000762;

const DEFAULT_STATE: StepTrackingState = {
  enabled: false,
  promptShown: false,
  enabledAt: null,
  dailyData: [],
  lastUpdated: Date.now(),
  currentDaySteps: 0,
};

// ─── Date helpers ──────────────────────────────────────────────────────────────

export function getTodayDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getDateNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Short day label: Mon, Tue, etc.
export function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
}

// Short date label: "31 May"
export function formatDateShort(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${date.getDate()} ${months[date.getMonth()]}`;
}

// ─── Step ↔ Distance (Apple Health model) ─────────────────────────────────────

/**
 * Convert steps to distance in km using Apple Health's stride model.
 * Apple Health uses ~0.762m average stride (varies slightly by height).
 * This is the same formula used by Apple Health, Google Fit, Fitbit.
 */
export function stepsToDistanceKm(steps: number): number {
  return parseFloat((steps * STRIDE_KM).toFixed(2));
}

export function getStepGoal(): number {
  return STEP_GOAL;
}

// ─── State persistence ─────────────────────────────────────────────────────────

export async function getStepTrackingState(): Promise<StepTrackingState> {
  try {
    const state = await store.getJSON<StepTrackingState>(KEYS.stepTracking);
    if (state) return state;
  } catch (e) {
    console.warn('Failed to get step tracking state:', e);
  }
  return { ...DEFAULT_STATE };
}

export async function saveStepTrackingState(state: StepTrackingState): Promise<void> {
  try {
    await store.setJSON(KEYS.stepTracking, state);
  } catch (e) {
    console.warn('Failed to save step tracking state:', e);
  }
}

export async function enableStepTracking(): Promise<void> {
  const state = await getStepTrackingState();
  state.enabled = true;
  state.promptShown = true;
  state.enabledAt = Date.now();
  await saveStepTrackingState(state);
}

export async function disableStepTracking(): Promise<void> {
  const state = await getStepTrackingState();
  state.enabled = false;
  await saveStepTrackingState(state);
}

export async function dismissStepTrackingPrompt(): Promise<void> {
  const state = await getStepTrackingState();
  state.promptShown = true;
  await saveStepTrackingState(state);
}

// ─── Step data updates ─────────────────────────────────────────────────────────

/**
 * Update today's step count.
 * Called by the foreground poller every 60s using Pedometer.getStepCountAsync.
 * This is the same approach Apple Health uses — reads from the motion chip.
 */
export async function updateDailySteps(steps: number): Promise<void> {
  const state = await getStepTrackingState();
  if (!state.enabled) return;

  const today = getTodayDate();
  state.currentDaySteps = steps;
  state.lastUpdated = Date.now();

  const distanceKm = stepsToDistanceKm(steps);

  const idx = state.dailyData.findIndex(d => d.date === today);
  if (idx >= 0) {
    state.dailyData[idx].steps = steps;
    state.dailyData[idx].distanceKm = distanceKm;
  } else {
    state.dailyData.push({ date: today, steps, goal: STEP_GOAL, distanceKm });
  }

  // Keep only last 30 days
  const cutoff = getDateNDaysAgo(30);
  state.dailyData = state.dailyData.filter(d => d.date >= cutoff);

  await saveStepTrackingState(state);
}

export async function getTodaySteps(): Promise<number> {
  const state = await getStepTrackingState();
  return state.currentDaySteps;
}

// ─── Analytics ─────────────────────────────────────────────────────────────────

export interface DayStats extends DailyStepData {
  isToday: boolean;
  goalMet: boolean;
  dayLabel: string;   // "Mon"
  dateLabel: string;  // "31 May"
}

export interface ThirtyDayStats {
  daily: DayStats[];           // 30 entries, oldest → newest
  totalSteps: number;
  avgStepsPerDay: number;      // average of days with data (non-zero days)
  avgAllDays: number;          // average across all 30 days
  bestSteps: number;
  bestDate: string;
  totalDistanceKm: number;     // step-based distance, 30-day total
  avgDistanceKm: number;       // avg per day (non-zero days)
  currentStreak: number;       // consecutive days ≥ goal ending today
  bestStreak: number;
  daysGoalMet: number;
  daysWithData: number;
}

export async function get30DayStats(): Promise<ThirtyDayStats> {
  const state = await getStepTrackingState();
  const today = getTodayDate();

  // Build 30 slots oldest → newest
  const daily: DayStats[] = [];
  for (let i = 29; i >= 0; i--) {
    const dateStr = getDateNDaysAgo(i);
    const existing = state.dailyData.find(d => d.date === dateStr);
    const steps = existing?.steps ?? 0;
    const goalMet = steps >= STEP_GOAL;
    daily.push({
      date: dateStr,
      steps,
      goal: STEP_GOAL,
      distanceKm: stepsToDistanceKm(steps),
      isToday: dateStr === today,
      goalMet,
      dayLabel: formatDate(dateStr),
      dateLabel: formatDateShort(dateStr),
    });
  }

  const daysWithData = daily.filter(d => d.steps > 0).length;
  const totalSteps = daily.reduce((s, d) => s + d.steps, 0);
  const avgStepsPerDay = daysWithData > 0 ? Math.round(totalSteps / daysWithData) : 0;
  const avgAllDays = Math.round(totalSteps / 30);
  const totalDistanceKm = parseFloat(daily.reduce((s, d) => s + d.distanceKm, 0).toFixed(2));
  const avgDistanceKm = daysWithData > 0 ? parseFloat((totalDistanceKm / daysWithData).toFixed(2)) : 0;
  const daysGoalMet = daily.filter(d => d.goalMet).length;

  // Best day
  const bestDay = [...daily].sort((a, b) => b.steps - a.steps)[0];
  const bestSteps = bestDay?.steps ?? 0;
  const bestDate = bestDay?.date ?? '';

  // Current streak: consecutive days ≥ goal going backwards from today
  let currentStreak = 0;
  for (let i = daily.length - 1; i >= 0; i--) {
    if (daily[i].goalMet) currentStreak++;
    else if (daily[i].isToday) continue; // today in-progress, don't break
    else break;
  }

  // Best streak: longest run of ≥ goal days
  let bestStreak = 0;
  let cur = 0;
  for (const d of daily) {
    if (d.goalMet) { cur++; if (cur > bestStreak) bestStreak = cur; }
    else cur = 0;
  }

  return {
    daily,
    totalSteps,
    avgStepsPerDay,
    avgAllDays,
    bestSteps,
    bestDate,
    totalDistanceKm,
    avgDistanceKm,
    currentStreak,
    bestStreak,
    daysGoalMet,
    daysWithData,
  };
}

/** Legacy 7-day stats — kept for backward compat */
export async function getWeeklyStats(): Promise<{
  daily: DailyStepData[];
  total: number;
  average: number;
  best: number;
  bestDate: string;
}> {
  const state = await getStepTrackingState();
  const today = new Date();

  const fullWeek: DailyStepData[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const existing = state.dailyData.find(d => d.date === dateStr);
    fullWeek.push(existing || { date: dateStr, steps: 0, goal: STEP_GOAL, distanceKm: 0 });
  }

  const total = fullWeek.reduce((sum, d) => sum + d.steps, 0);
  const average = Math.round(total / fullWeek.length);
  const best = Math.max(...fullWeek.map(d => d.steps));
  const bestDate = fullWeek.find(d => d.steps === best)?.date || '';

  return { daily: fullWeek, total, average, best, bestDate };
}
