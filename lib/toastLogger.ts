// ─── Toast Logger ─────────────────────────────────────────────────────────────
// Intercepts global JS errors + unhandled promise rejections and pipes them
// to a visible on-screen toast so you can read crash logs without a debugger.
// Also supports info/debug messages for step tracking diagnostics.

export type ToastType = 'crash' | 'error' | 'warn' | 'info' | 'debug';

export type ToastEntry = {
  id: number;
  message: string;
  type: ToastType;
  timestamp: string; // HH:MM:SS
};

type Listener = (entry: ToastEntry) => void;

let _id = 1;
let _listener: Listener | null = null;
const _queue: ToastEntry[] = [];

function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
}

export const ToastLogger = {
  /** Called once when <CrashToast /> mounts. Flushes any queued pre-mount entries. */
  register(fn: Listener | null) {
    _listener = fn;
    if (fn) _queue.splice(0).forEach(fn);
  },

  push(message: string, type: ToastType = 'crash') {
    const entry: ToastEntry = { id: _id++, message: String(message), type, timestamp: nowTime() };
    if (_listener) {
      _listener(entry);
    } else {
      _queue.push(entry);
    }
  },

  /** Shorthand for step-tracking info logs */
  info(message: string) { this.push(message, 'info'); },
  /** Shorthand for verbose debug logs */
  debug(message: string) { this.push(message, 'debug'); },
  /** Shorthand for warnings */
  warn(message: string) { this.push(message, 'warn'); },
};

/**
 * Install at app startup (module-level) to catch crashes before any component
 * renders. Errors are queued until <CrashToast /> registers its listener.
 */
export function installCrashToast() {
  // 1. Global JS exception handler
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

  // 1.5. Global Promise Rejection handler
  try {
    const tracking = require('promise/setimmediate/rejection-tracking');
    tracking.enable({
      allRejections: true,
      onUnhandled: (id: string, error: Error | any) => {
        const msg = error instanceof Error ? error.message : String(error);
        ToastLogger.push(`⚠️ UNHANDLED PROMISE: ${msg}`, 'error');
      },
      onHandled: () => {},
    });
  } catch (_) {}

  // 2. console.error override
  const _origError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
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
