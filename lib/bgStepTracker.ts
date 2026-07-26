/**
 * bgStepTracker.ts
 *
 * ⚠️  New Architecture (newArchEnabled=true) note:
 *     DeviceEventEmitter native→JS events are SILENTLY DROPPED in bridgeless mode.
 *     We use polling instead: JS calls getTodaySteps() on a 30-second interval.
 *     The native ForegroundService keeps counting accurately in the background.
 *
 * Android → Native StepCounterService (ForegroundService, TYPE_STEP_COUNTER)
 *   • Runs even when screen is locked / app is backgrounded
 *   • Persists in SharedPreferences — survives app kill + phone reboot
 *   • Auto-restarts on boot via BootReceiver
 *   • JS polls getTodaySteps() every 30s for UI refresh
 *
 * iOS → Pedometer.getStepCountAsync (reads Apple HealthKit)
 *   • Works even when app is killed (HealthKit stores steps natively)
 *   • Polled every 60 seconds
 */

import { Platform, NativeModules } from 'react-native';
import { Pedometer } from 'expo-sensors';
import { updateDailySteps, getTodayDate, getStepTrackingState } from '@/lib/dailyStepTracker';
import { ToastLogger } from '@/lib/toastLogger';

const { StepCounterModule } = NativeModules;

// ─── State ────────────────────────────────────────────────────────────────────
let pollInterval: ReturnType<typeof setInterval> | null = null;   // Android + iOS
let isRunning    = false;

// ─── iOS HealthKit read ───────────────────────────────────────────────────────
async function readTodayStepsIOS(): Promise<number> {
  try {
    const available = await Pedometer.isAvailableAsync();
    if (!available) { ToastLogger.warn('[BgSteps] iOS: not available'); return 0; }
    if (Pedometer.requestPermissionsAsync) {
      const { status } = await Pedometer.requestPermissionsAsync();
      if (status !== 'granted') { ToastLogger.warn(`[BgSteps] iOS: perm ${status}`); return 0; }
    }
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const result = await Pedometer.getStepCountAsync(start, new Date());
    return result.steps;
  } catch (e: any) {
    ToastLogger.warn(`[BgSteps] iOS error: ${e?.message ?? e}`);
    return 0;
  }
}

// ─── Android native poll ──────────────────────────────────────────────────────
async function pollAndroidSteps(): Promise<number> {
  if (!StepCounterModule) return 0;
  try {
    const steps: number = await StepCounterModule.getTodaySteps();
    return steps;
  } catch (e: any) {
    ToastLogger.warn(`[BgSteps] Android poll error: ${e?.message ?? e}`);
    return 0;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function startBackgroundStepTracking(): Promise<void> {
  // Background step tracking is intentionally disabled by user request.
  isRunning = false;
  return;
}

export function stopBackgroundStepTracking(): void {
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }

  if (Platform.OS === 'android' && StepCounterModule) {
    StepCounterModule.stopDailyTracking().catch(() => {});
  }

  isRunning = false;
  ToastLogger.info('[BgSteps] Stopped');
}

/**
 * Sync steps immediately (call on app resume from background).
 */
export async function syncStepsNow(): Promise<number> {
  if (Platform.OS === 'android') {
    const steps = await pollAndroidSteps();
    ToastLogger.info(`[BgSteps] Android syncNow: ${steps} today`);
    if (steps > 0) await updateDailySteps(steps);
    return steps;
  } else {
    const steps = await readTodayStepsIOS();
    if (steps > 0) await updateDailySteps(steps);
    return steps;
  }
}

/** Re-attach after app returns to foreground (no-op now — polling handles it). */
export async function restartAndroidStepSub(): Promise<void> {
  if (Platform.OS !== 'android' || !StepCounterModule || !isRunning) return;
  // Just sync immediately — the 30s poll will continue automatically
  await syncStepsNow();
  ToastLogger.info('[BgSteps] Android foreground sync done');
}

export async function isBackgroundStepTrackingRunning(): Promise<boolean> {
  if (Platform.OS === 'android' && StepCounterModule) {
    try { return await StepCounterModule.isDailyRunning(); } catch { return false; }
  }
  return isRunning;
}
