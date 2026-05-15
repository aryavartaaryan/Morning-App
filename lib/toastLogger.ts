// ─── Crash Toast Logger ──────────────────────────────────────────────────────
// Intercepts global JS errors + unhandled promise rejections and pipes them
// to a visible on-screen toast so you can read crash logs without a debugger.

export type ToastType = 'crash' | 'error' | 'warn';

export type ToastEntry = {
  id: number;
  message: string;
  type: ToastType;
};

type Listener = (entry: ToastEntry) => void;

let _id = 1;
let _listener: Listener | null = null;
const _queue: ToastEntry[] = [];

export const ToastLogger = {
  /** Called once when <CrashToast /> mounts. Flushes any queued pre-mount errors. */
  register(fn: Listener | null) {
    _listener = fn;
    if (fn) _queue.splice(0).forEach(fn);
  },

  push(message: string, type: ToastType = 'crash') {
    const entry: ToastEntry = { id: _id++, message: String(message), type };
    if (_listener) {
      _listener(entry);
    } else {
      _queue.push(entry);
    }
  },
};

/**
 * Install at app startup (module-level) to catch crashes before any component
 * renders. Errors are queued until <CrashToast /> registers its listener.
 */
export function installCrashToast() {
  // 1. Global JS exception handler (covers crashes + unhandled promise rejections
  //    in Hermes/JSC, since RN routes them all through ErrorUtils)
  try {
    const prev = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
      const tag = isFatal ? '💥 FATAL' : '❌ JS ERROR';
      const msg = error?.message ?? String(error);
      ToastLogger.push(`${tag}: ${msg}`, 'crash');
      prev?.(error, isFatal);
    });
  } catch (_) {
    // ErrorUtils unavailable (web / test env) — ignore
  }

  // 2. console.error override — catches errors that don't go through ErrorUtils
  //    (e.g. explicit console.error calls in catch blocks)
  const _origError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    // Skip React's own verbose prop-type / deprecation warnings to reduce noise
    const first = String(args[0] ?? '');
    const isReactNoise =
      first.startsWith('Warning:') ||
      first.includes('Each child in a list') ||
      first.includes('key prop');
    if (!isReactNoise) {
      const msg = args
        .map(a => (a instanceof Error ? a.message : typeof a === 'object' ? JSON.stringify(a) : String(a)))
        .join(' ');
      ToastLogger.push(`⚠️ ${msg}`, 'error');
    }
    _origError(...args);
  };
}
