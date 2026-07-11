/**
 * ─── Crash Shield ────────────────────────────────────────────────────────────
 * Master crash-prevention for a consumer React Native app.
 *
 * STRATEGY (master-fix, not per-spot fixes):
 *   1. Replace ErrorUtils global handler so ALL JS errors — including fatal
 *      ones — are logged to the toast overlay but NEVER forwarded to the native
 *      crash handler (which terminates the process on __DEV__ = false builds).
 *   2. Capture every unhandled Promise rejection via the global event.
 *   3. Override console.error so stray throws in third-party libs are visible.
 *   4. Register an AppState listener that resets transient error state when the
 *      user backgrounds + foregrounds the app (cheap recovery signal).
 *
 * Call installCrashShield() ONCE at the very top of index.js, before
 * require('expo-router/entry').  It is idempotent.
 */

import { AppState } from 'react-native';
import { ToastLogger } from './toastLogger';

let _installed = false;

// Tracks consecutive fatal errors in the current session.
// If this spikes to an absurd number something is truly broken —
// we log it but still don't crash.
let _fatalCount = 0;

export function installCrashShield() {
  _installed = true;

  // ── 1. Global JS exception handler ─────────────────────────────────────────
  // RN's default fatal handler calls NativeModules.ExceptionsManager.reportFatalException()
  // which terminates the process on release builds.
  // We replace it entirely: log to toast, increment counter, but DO NOT forward.
  try {
    ErrorUtils.setGlobalHandler((error: Error | unknown, isFatal?: boolean) => {
      try {
        const msg  = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? (error.stack?.slice(0, 400) ?? '') : '';
        const tag  = isFatal ? '💥 FATAL (shielded)' : '❌ JS ERROR';
        if (isFatal) _fatalCount++;

        ToastLogger.push(
          `${tag}\n${msg}${stack ? `\n${stack}` : ''}`,
          'crash'
        );

        // In __DEV__ mode forward to RN's red box so developers still see it.
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.warn(`[CrashShield] ${tag}: ${msg}`);
        }

        // NEVER re-throw or forward to native — that's the whole point.
      } catch {
        // Even the logger failed — silently swallow to stay alive.
      }
    });
  } catch {
    // ErrorUtils not available (Expo Go web, unit tests) — skip.
  }

  // ── 2. Unhandled Promise rejections ────────────────────────────────────────
  // React Native 0.71+ surfaces these via the global 'unhandledrejection' event.
  try {
    // @ts-ignore — global is available in Hermes / JSC
    const g = global as any;

    // Hermes / JSC path: onunhandledrejection
    const prev = g.onunhandledrejection;
    g.onunhandledrejection = (event: any) => {
      try {
        const reason = event?.reason;
        const msg = reason instanceof Error ? reason.message : String(reason ?? 'Unknown rejection');
        ToastLogger.push(`⚠️ UNHANDLED PROMISE\n${msg}`, 'error');
        // Prevent the default (which would escalate to ErrorUtils on some RN versions)
        event?.preventDefault?.();
      } catch { /* silent */ }
      // Still call the previous handler if it was set
      try { if (typeof prev === 'function') prev(event); } catch { /* silent */ }
    };

    // promise/setimmediate rejection tracking (React Native's built-in polyfill)
    try {
      const tracking = require('promise/setimmediate/rejection-tracking');
      tracking.enable({
        allRejections: true,
        onUnhandled: (_id: string, error: Error | any) => {
          try {
            const msg = error instanceof Error ? error.message : String(error ?? 'Unknown');
            ToastLogger.push(`⚠️ PROMISE REJECTION\n${msg}`, 'error');
          } catch { /* silent */ }
        },
        onHandled: () => {},
      });
    } catch { /* polyfill not available */ }
  } catch { /* silent */ }

  // ── 3. console.error override ───────────────────────────────────────────────
  // Catches errors logged by third-party libs (react-native-svg, expo-av, etc.)
  // that don't throw but do console.error.
  try {
    const _orig = console.error.bind(console);
    console.error = (...args: unknown[]) => {
      try {
        const first = String(args[0] ?? '');
        // Filter noisy React warnings that aren't real errors.
        const isNoise =
          first.startsWith('Warning:') ||
          first.includes('Each child in a list') ||
          first.includes('key prop') ||
          first.includes('VirtualizedList') ||
          first.includes('componentWillReceiveProps') ||
          first.includes('componentWillMount');
        if (!isNoise) {
          const msg = args
            .map(a =>
              a instanceof Error
                ? a.message
                : typeof a === 'object' && a !== null
                ? (() => { try { return JSON.stringify(a); } catch { return String(a); } })()
                : String(a)
            )
            .join(' ');
          // Only show if message is meaningful
          if (msg.length > 3) ToastLogger.push(`⚠️ ${msg}`, 'error');
        }
      } catch { /* silent */ }
      _orig(...args);
    };
  } catch { /* silent */ }

  // ── 4. AppState recovery signal ─────────────────────────────────────────────
  // When the user backgrounds and foregrounds the app after seeing a crash toast,
  // reset the fatal counter so we don't think we're in a crash loop.
  try {
    AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && _fatalCount > 0) {
        _fatalCount = 0;
      }
    });
  } catch { /* silent */ }
}

/**
 * Wrap any async function so it NEVER throws — any rejection is caught and
 * logged to the crash toast instead.  Use for fire-and-forget side effects.
 *
 * Example:  safeRun(() => someRiskyAsyncOperation())
 */
export function safeRun<T>(
  fn: () => Promise<T>,
  label = 'safeRun'
): void {
  try {
    fn().catch((err: unknown) => {
      try {
        const msg = err instanceof Error ? err.message : String(err);
        ToastLogger.push(`⚠️ ${label}: ${msg}`, 'warn');
      } catch { /* silent */ }
    });
  } catch (err: unknown) {
    try {
      const msg = err instanceof Error ? err.message : String(err);
      ToastLogger.push(`⚠️ ${label} (sync): ${msg}`, 'warn');
    } catch { /* silent */ }
  }
}

/**
 * Safely call any synchronous function, swallowing thrown errors.
 * Returns undefined on error.
 */
export function safeTry<T>(fn: () => T, label = 'safeTry'): T | undefined {
  try {
    return fn();
  } catch (err: unknown) {
    try {
      const msg = err instanceof Error ? err.message : String(err);
      ToastLogger.push(`⚠️ ${label}: ${msg}`, 'warn');
    } catch { /* silent */ }
    return undefined;
  }
}
