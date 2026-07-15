/**
 * StepCounter.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * Fully-typed TypeScript wrapper around the native Android StepCounterModule.
 * RN screens ONLY import from this file — never NativeModules directly.
 *
 * Native module: com.solrize.StepCounterModule
 * Registered in: AlarmPackage.kt
 * Service:       StepCounterService.kt (foreground service, TYPE_STEP_DETECTOR +
 *                TYPE_STEP_COUNTER)
 */

import {
  NativeModules,
  DeviceEventEmitter,
  Platform,
  PermissionsAndroid,
  type EmitterSubscription,
} from 'react-native';

// ── Types ────────────────────────────────────────────────────────────────────

export type SessionType = 'morning' | 'evening' | 'postmeal';

export interface TodayStats {
  /** Steps counted by the background daily-tracking service */
  autoSteps: number;
  /** Steps counted during manual walk sessions (sum of today's sessions) */
  manualSteps: number;
  /** autoSteps + manualSteps */
  totalSteps: number;
  /** User's daily step goal (default: 8 000) */
  goalSteps: number;
  /** Distance derived from totalSteps at 0.000762 km/step */
  distanceKm: number;
  /** Calories: totalSteps × 0.04 kcal */
  calories: number;
  /** Active minutes from session durations saved in SharedPreferences */
  activeMinutes: number;
  /** Percentage toward dailyGoal (0–100) */
  goalPercent: number;
}

export interface SessionResult {
  steps: number;
  durationSeconds: number;
  distanceKm: number;
  calories: number;
  goalMet: boolean;
}

export interface DailyData {
  date: string;      // "yyyy-MM-dd"
  steps: number;
  goal: number;
  goalMet: boolean;
  distanceKm: number;
  calories: number;
}

export interface AnalyticsSummary {
  totalSteps: number;
  bestDay: number;
  avgPerDay: number;
  currentStreak: number;
  longestStreak: number;
  goalRate: number;        // 0–100 %
}

export interface ThirtyDayAnalytics {
  dailyData: DailyData[];
  summary: AnalyticsSummary;
}

// ── Constants ────────────────────────────────────────────────────────────────

const SESSION_GOALS: Record<SessionType, number> = {
  morning:  3000,
  evening:  3000,
  postmeal: 100,
};

const STRIDE_KM   = 0.000762;  // avg stride length
const CAL_PER_STEP = 0.04;     // kcal per step (brisk walk)
const DEFAULT_GOAL = 5000;

// ── Shared preferences keys (must match StepCounterService.kt) ───────────────

const PREFS_KEY_DATE         = 'daily_date';
const PREFS_KEY_STEPS        = 'daily_steps';
const PREFS_KEY_GOAL         = 'step_daily_goal';
const PREFS_KEY_ACTIVE_MIN   = 'step_active_minutes';
const PREFS_KEY_SESSION_STEPS = 'step_session_total';
const PREFS_KEY_STREAK       = 'step_streak';

// ── AsyncStorage helpers (used to persist settings JS-side) ──────────────────

let _AsyncStorage: any = null;
function getAsyncStorage() {
  if (!_AsyncStorage) {
    try { _AsyncStorage = require('@react-native-async-storage/async-storage').default; } catch { /* not installed */ }
  }
  return _AsyncStorage;
}

async function asGet(key: string): Promise<string | null> {
  try { return await getAsyncStorage()?.getItem(key) ?? null; } catch { return null; }
}
async function asSet(key: string, value: string) {
  try { await getAsyncStorage()?.setItem(key, value); } catch { /* */ }
}

// ── Native module reference ───────────────────────────────────────────────────

const _native: {
  isAvailable: () => Promise<boolean>;
  startWalkSession: () => Promise<void>;
  stopWalkSession:  () => Promise<void>;
  getSessionSteps:  () => Promise<number>;
  isRunning:        () => Promise<boolean>;
  getSensorSource:  () => Promise<string>;
  startDailyTracking: () => Promise<void>;
  stopDailyTracking:  () => Promise<void>;
  getTodaySteps:      () => Promise<number>;
  isDailyRunning:     () => Promise<boolean>;
} | null = NativeModules.StepCounterModule ?? null;

// ── Permission Helper ─────────────────────────────────────────────────────────

async function ensurePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  if (Platform.Version < 29) return true; // ACTIVITY_RECOGNITION not required before Android 10

  try {
    const perms = [PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION];
    if (Platform.Version >= 33) {
      perms.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    }
    const granted = await PermissionsAndroid.requestMultiple(perms);
    return granted[PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION] === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

// ── StepCounter public API ───────────────────────────────────────────────────

export const StepCounter = {

  // ── Availability ────────────────────────────────────────────────────────────

  /** Returns true if the device has a hardware step sensor. */
  async isAvailable(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    try { return await (_native?.isAvailable() ?? Promise.resolve(false)); }
    catch { return false; }
  },

  /**
   * Returns which hardware sensor is powering the walk session:
   *   "STEP_DETECTOR" — real-time pedometer (1 event per step, zero latency) ✅
   *   "STEP_COUNTER"  — cumulative batched counter (fallback, may deliver in bursts)
   *   "NONE"          — no step sensor hardware found on this device
   * Use this to show a diagnostic Toast when a session starts.
   */
  async getSensorSource(): Promise<string> {
    if (Platform.OS !== 'android') return 'NOT_ANDROID';
    try { return await (_native?.getSensorSource() ?? Promise.resolve('NONE')); }
    catch { return 'NONE'; }
  },

  // ── Background daily tracking ────────────────────────────────────────────────

  /**
   * Starts the background foreground-service that counts steps all day.
   * Safe to call on every app launch — the service checks if it's already
   * running and is a no-op if so.
   */
  async startBackgroundTracking(): Promise<void> {
    if (Platform.OS !== 'android') return;
    const hasPerms = await ensurePermissions();
    if (!hasPerms) return;
    try { await _native?.startDailyTracking(); } catch { /* */ }
  },

  /** Stops background step counting. */
  async stopBackgroundTracking(): Promise<void> {
    if (Platform.OS !== 'android') return;
    try { await _native?.stopDailyTracking(); } catch { /* */ }
  },

  /** Returns true if background step counting is active. */
  async isTrackingEnabled(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    try { return await (_native?.isDailyRunning() ?? Promise.resolve(false)); }
    catch { return false; }
  },

  // ── Today's summary ──────────────────────────────────────────────────────────

  /**
   * Returns a full summary of today's step activity.
   * Merges live native data (autoSteps) with JS-persisted session data.
   */
  async getTodayStats(): Promise<TodayStats> {
    let autoSteps = 0;
    let manualSteps = 0;

    try {
      autoSteps   = await (_native?.getTodaySteps() ?? Promise.resolve(0));
    } catch { /* */ }

    try {
      const stored = await asGet('sc_session_steps_today');
      if (stored) manualSteps = parseInt(stored, 10) || 0;
    } catch { /* */ }

    const goalSteps   = await StepCounter.getDailyGoal();
    // Only use steps accumulated during active Nada walk sessions
    const totalSteps  = manualSteps;
    const distanceKm  = parseFloat((totalSteps * STRIDE_KM).toFixed(2));
    const calories    = Math.round(totalSteps * CAL_PER_STEP);
    const activeMin   = parseInt(await asGet('sc_active_minutes_today') ?? '0', 10) || 0;
    const goalPercent = Math.min(100, Math.round((totalSteps / goalSteps) * 100));

    return { autoSteps, manualSteps, totalSteps, goalSteps, distanceKm, calories, activeMinutes: activeMin, goalPercent };
  },

  // ── Manual walk sessions ─────────────────────────────────────────────────────

  /**
   * Starts a manual walk session (foreground service with per-step events).
   * @param type 'morning' | 'evening' | 'postmeal'
   */
  async startSession(type: SessionType): Promise<{ goalSteps: number, startTime: number }> {
    if (Platform.OS !== 'android') return { goalSteps: SESSION_GOALS[type], startTime: Date.now() };
    const hasPerms = await ensurePermissions();
    if (!hasPerms) return { goalSteps: SESSION_GOALS[type], startTime: Date.now() };
    
    const isRunning = await (_native?.isRunning() ?? Promise.resolve(false));
    if (isRunning) {
      const existingStart = await asGet('sc_current_session_start');
      return { 
        goalSteps: SESSION_GOALS[type], 
        startTime: existingStart ? parseInt(existingStart, 10) : Date.now() 
      };
    }

    const now = Date.now();
    await asSet('sc_current_session_type', type);
    await asSet('sc_current_session_start', String(now));
    try { await _native?.startWalkSession(); } catch { /* */ }
    return { goalSteps: SESSION_GOALS[type], startTime: now };
  },

  /**
   * Ends the current manual walk session.
   * Returns a SessionResult and persists session totals.
   */
  async endSession(): Promise<SessionResult> {
    let steps = 0;
    try { steps = await (_native?.getSessionSteps() ?? Promise.resolve(0)); } catch { /* */ }

    const type = (await asGet('sc_current_session_type') as SessionType | null) ?? 'morning';
    const startMs = parseInt(await asGet('sc_current_session_start') ?? '0', 10) || Date.now();
    const durationSeconds = Math.round((Date.now() - startMs) / 1000);
    const distanceKm  = parseFloat((steps * STRIDE_KM).toFixed(2));
    const calories    = Math.round(steps * CAL_PER_STEP);
    const goalMet     = steps >= SESSION_GOALS[type];

    // Persist active minutes
    const prevMin = parseInt(await asGet('sc_active_minutes_today') ?? '0', 10) || 0;
    await asSet('sc_active_minutes_today', String(prevMin + Math.round(durationSeconds / 60)));

    // Persist session steps (additive — user may do multiple sessions)
    const prevSess = parseInt(await asGet('sc_session_steps_today') ?? '0', 10) || 0;
    await asSet('sc_session_steps_today', String(prevSess + steps));

    // Persist session record
    const history = JSON.parse(await asGet('sc_session_history') ?? '[]');
    history.unshift({
      date: new Date().toISOString().split('T')[0],
      type, steps, durationSeconds, distanceKm, calories, goalMet,
      startMs, endMs: Date.now(),
    });
    await asSet('sc_session_history', JSON.stringify(history.slice(0, 90)));

    try { await _native?.stopWalkSession(); } catch { /* */ }
    await asSet('sc_current_session_type', '');
    await asSet('sc_current_session_start', '');

    return { steps, durationSeconds, distanceKm, calories, goalMet };
  },

  /** Returns live step count for the current session without ending it. */
  async getCurrentSessionSteps(): Promise<number> {
    try { return await (_native?.getSessionSteps() ?? Promise.resolve(0)); } catch { return 0; }
  },

  /** Returns true if a walk session service is currently running. */
  async isSessionRunning(): Promise<boolean> {
    try { return await (_native?.isRunning() ?? Promise.resolve(false)); } catch { return false; }
  },

  // ── Analytics ────────────────────────────────────────────────────────────────

  /** Returns 30-day analytics computed in JS from persisted history. */
  async getThirtyDayAnalytics(): Promise<ThirtyDayAnalytics> {
    const goal = await StepCounter.getDailyGoal();

    // Build a 30-slot array of daily steps from stored daily snapshots
    const stored = JSON.parse(await asGet('sc_daily_history') ?? '[]') as { date: string; steps: number }[];

    // Determine the earliest date we should show (never show phantom pre-install zeroes)
    let firstUseStr = await asGet('sc_first_use_date');
    if (!firstUseStr) {
      // For existing users: use earliest date in stored history so real data is preserved.
      // For new users with no history: use today so no phantom past dates appear.
      const sortedDates = stored.map(x => x.date).sort();
      firstUseStr = sortedDates.length > 0 ? sortedDates[0] : new Date().toISOString().split('T')[0];
      await asSet('sc_first_use_date', firstUseStr);
    }
    const firstUseTime = new Date(firstUseStr + 'T00:00:00').getTime();

    const today = new Date();
    const dailyData: DailyData[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      // Skip dates that pre-date the first recorded app use
      if (d.getTime() < firstUseTime) continue;
      const dateStr = d.toISOString().split('T')[0];
      const entry   = stored.find(x => x.date === dateStr);
      const steps   = entry?.steps ?? (i === 0 ? (await StepCounter.getTodayStats()).totalSteps : 0);
      dailyData.push({
        date: dateStr,
        steps,
        goal,
        goalMet:    steps >= goal,
        distanceKm: parseFloat((steps * STRIDE_KM).toFixed(2)),
        calories:   Math.round(steps * CAL_PER_STEP),
      });
    }

    const summary = StepCounter._computeSummary(dailyData, goal);
    return { dailyData, summary };
  },

  /** Internal: compute summary stats from a daily data array. */
  _computeSummary(data: DailyData[], goal: number): AnalyticsSummary {
    const validDays = data.filter(d => d.steps > 0);
    const totalSteps = validDays.reduce((s, d) => s + d.steps, 0);
    const bestDay    = Math.max(0, ...data.map(d => d.steps));
    const avgPerDay  = validDays.length > 0 ? Math.round(totalSteps / validDays.length) : 0;
    const goalRate   = data.length > 0 ? Math.round((data.filter(d => d.goalMet).length / data.length) * 100) : 0;

    // Streak (from most recent day going backwards)
    let currentStreak = 0, longestStreak = 0, running = 0;
    const sorted = [...data].sort((a, b) => b.date.localeCompare(a.date));
    let streakBroken = false;
    for (const d of sorted) {
      if (d.goalMet) {
        running++;
        if (!streakBroken) currentStreak = running;
        if (running > longestStreak) longestStreak = running;
      } else {
        streakBroken = true;
        running = 0;
      }
    }

    return { totalSteps, bestDay, avgPerDay, currentStreak, longestStreak, goalRate };
  },

  // ── Settings ─────────────────────────────────────────────────────────────────

  async getDailyGoal(): Promise<number> {
    const stored = await asGet('sc_daily_goal');
    return stored ? (parseInt(stored, 10) || DEFAULT_GOAL) : DEFAULT_GOAL;
  },

  async setDailyGoal(steps: number): Promise<void> {
    await asSet('sc_daily_goal', String(Math.max(500, steps)));
  },

  async getStrideLength(): Promise<number> {
    const stored = await asGet('sc_stride_cm');
    return stored ? (parseInt(stored, 10) || 76) : 76;
  },

  async setStrideLength(cm: number): Promise<void> {
    await asSet('sc_stride_cm', String(Math.max(30, Math.min(120, cm))));
  },

  // ── Snapshot persistence (call once/day to save today's steps) ───────────────

  async snapshotTodayToHistory(): Promise<void> {
    const stats   = await StepCounter.getTodayStats();
    const dateStr = new Date().toISOString().split('T')[0];
    const history = JSON.parse(await asGet('sc_daily_history') ?? '[]') as { date: string; steps: number }[];
    const existing = history.findIndex(x => x.date === dateStr);
    if (existing >= 0) history[existing].steps = stats.totalSteps;
    else history.push({ date: dateStr, steps: stats.totalSteps });
    const trimmed = history.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 90);
    await asSet('sc_daily_history', JSON.stringify(trimmed));
  },

  // ── Event subscriptions ───────────────────────────────────────────────────────

  /**
   * Subscribe to per-step events during a walk session.
   * Fires on every step with the cumulative session step count.
   * Android New Architecture (Bridgeless) drops DeviceEventEmitter events, so we poll.
   */
  onStep(callback: (steps: number) => void): { remove: () => void } {
    if (Platform.OS === 'android') {
      let stopped = false;
      let lastSteps = -1;
      const tick = async () => {
        if (stopped) return;
        try {
          const steps = await (_native?.getSessionSteps() ?? Promise.resolve(0));
          if (steps !== lastSteps) {
            lastSteps = steps;
            callback(steps);
          }
        } catch { /* */ }
        if (!stopped) setTimeout(tick, 400);
      };
      setTimeout(tick, 400);
      return { remove: () => { stopped = true; } };
    }
    return DeviceEventEmitter.addListener('NativeStepUpdate', callback);
  },

  /**
   * Subscribe to daily step count updates from background tracking.
   * Android New Architecture (Bridgeless) drops DeviceEventEmitter events, so we poll.
   */
  onDailyStepUpdate(callback: (steps: number) => void): { remove: () => void } {
    if (Platform.OS === 'android') {
      let stopped = false;
      let lastSteps = -1;
      const tick = async () => {
        if (stopped) return;
        try {
          const steps = await (_native?.getTodaySteps() ?? Promise.resolve(0));
          if (steps !== lastSteps) {
            lastSteps = steps;
            callback(steps);
          }
        } catch { /* */ }
        if (!stopped) setTimeout(tick, 5000); // 5 sec for daily tracking is plenty
      };
      setTimeout(tick, 5000);
      return { remove: () => { stopped = true; } };
    }
    return DeviceEventEmitter.addListener('NativeDailyStepUpdate', callback);
  },

  // ── Helpers (exported so screens can use them) ───────────────────────────────

  stepsToKm(steps: number, strideCm = 76): number {
    return parseFloat((steps * (strideCm / 100000)).toFixed(2));
  },

  stepsToCal(steps: number): number {
    return Math.round(steps * CAL_PER_STEP);
  },

  formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  },

  SESSION_GOALS,
};

export default StepCounter;
