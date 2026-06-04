/**
 * nativeStepCounter.ts
 *
 * ⚠️  ARCHITECTURE NOTE:
 *     This app uses newArchEnabled=true (React Native New Architecture / Bridgeless).
 *     In New Architecture, native → JS event emission via DeviceEventManagerModule
 *     (the old bridge approach) is SILENTLY DROPPED — events never reach JS.
 *
 *     Solution: JS polls the native module every 500ms instead.
 *     The native ForegroundService counts steps accurately (TYPE_STEP_DETECTOR +
 *     TYPE_STEP_COUNTER cross-check). JS reads the count via getSessionSteps().
 *     Callback is only fired when the count actually changes → no wasted renders.
 *
 * Android: StepCounterService (ForegroundService) counts steps natively.
 *          JS polls getSessionSteps() every 500ms.
 *
 * iOS:     expo-sensors Pedometer.watchStepCount works perfectly on iOS
 *          (CMPedometer / CoreMotion — no bridge issue).
 */

import { Platform, NativeModules } from 'react-native';
import { Pedometer } from 'expo-sensors';
import { ToastLogger } from '@/lib/toastLogger';

const { StepCounterModule } = NativeModules;

export type StepCallback = (steps: number) => void;

export interface StepSubscription {
  remove: () => void;
}

export const NativeStepCounter = {

  /** Returns true if the device has a step sensor. */
  async isAvailable(): Promise<boolean> {
    try {
      if (Platform.OS === 'android' && StepCounterModule) {
        const ok: boolean = await StepCounterModule.isAvailable();
        ToastLogger.info(`[NativePed] Android sensor available: ${ok}`);
        return ok;
      }
      const ok = await Pedometer.isAvailableAsync();
      ToastLogger.info(`[NativePed] iOS sensor available: ${ok}`);
      return ok;
    } catch (e: any) {
      ToastLogger.warn(`[NativePed] isAvailable error: ${e?.message ?? e}`);
      return false;
    }
  },

  /**
   * Start the native Android ForegroundService for walk step counting.
   * iOS: no-op (CMPedometer handles it automatically).
   */
  async start(): Promise<void> {
    ToastLogger.info(`[NativePed] start() on ${Platform.OS}`);
    if (Platform.OS === 'android') {
      if (!StepCounterModule) {
        ToastLogger.warn('[NativePed] ⚠️ StepCounterModule is NULL in NativeModules!');
        ToastLogger.warn('[NativePed] Available modules: ' +
          Object.keys(NativeModules).filter(k => k.toLowerCase().includes('step')).join(', '));
        return;
      }
      try {
        await StepCounterModule.startWalkSession();
        ToastLogger.info('[NativePed] ✓ ForegroundService started');
      } catch (e: any) {
        ToastLogger.warn(`[NativePed] startWalkSession error: ${e?.message ?? e}`);
      }
    }
  },

  /** Stop the native walk session service. */
  async stop(): Promise<void> {
    ToastLogger.info('[NativePed] stop()');
    if (Platform.OS === 'android' && StepCounterModule) {
      try {
        await StepCounterModule.stopWalkSession();
        ToastLogger.debug('[NativePed] ForegroundService stopped');
      } catch (e: any) {
        ToastLogger.warn(`[NativePed] stopWalkSession error: ${e?.message ?? e}`);
      }
    }
  },

  /**
   * Subscribe to step updates.
   *
   * Android: Polls StepCounterModule.getSessionSteps() every 500ms.
   *          Only fires callback when the count actually changes.
   *          This avoids the New Architecture DeviceEventEmitter issue.
   *
   * iOS:     Uses Pedometer.watchStepCount (works perfectly on iOS).
   *
   * @param callback  receives total session steps whenever count changes
   * @param baseSteps steps already counted before this subscription (for resume)
   */
  onStep(callback: StepCallback, baseSteps = 0): StepSubscription {

    if (Platform.OS === 'android') {
      if (!StepCounterModule) {
        ToastLogger.warn('[NativePed] onStep: StepCounterModule is NULL — no steps will count!');
        return { remove: () => {} };
      }

      let lastTotal = baseSteps;
      let stopped   = false;

      ToastLogger.info(`[NativePed] Starting 500ms poll (baseSteps=${baseSteps})`);

      // Poll every 500ms — only calls callback when count changes
      const tick = async () => {
        if (stopped) return;
        try {
          const sessionSteps: number = await StepCounterModule.getSessionSteps();
          const total = baseSteps + sessionSteps;
          if (total !== lastTotal) {
            lastTotal = total;
            ToastLogger.info(`[NativePed] ✓ Step! session=${sessionSteps} total=${total}`);
            callback(total);
          }
        } catch (e: any) {
          ToastLogger.warn(`[NativePed] poll error: ${e?.message ?? e}`);
        }
        if (!stopped) setTimeout(tick, 500);
      };

      // Start first tick after 500ms
      const initialTimer = setTimeout(tick, 500);

      return {
        remove: () => {
          stopped = true;
          clearTimeout(initialTimer);
          ToastLogger.debug('[NativePed] poll stopped');
        },
      };

    } else {
      // iOS: expo-sensors Pedometer fires very frequently via CMPedometer
      ToastLogger.info(`[NativePed] iOS watchStepCount (baseSteps=${baseSteps})`);
      const sub = Pedometer.watchStepCount((result) => {
        const total = baseSteps + result.steps;
        ToastLogger.info(`[NativePed] iOS step: ${result.steps} total=${total}`);
        callback(total);
      });
      return { remove: () => sub.remove() };
    }
  },

  async getSessionSteps(): Promise<number> {
    if (Platform.OS === 'android' && StepCounterModule) {
      return await StepCounterModule.getSessionSteps();
    }
    return 0;
  },

  async isRunning(): Promise<boolean> {
    if (Platform.OS === 'android' && StepCounterModule) {
      return await StepCounterModule.isRunning();
    }
    return false;
  },
};
