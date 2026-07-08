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
 *
 * NOTE: The global JS error handler + promise rejection handler is now owned
 * by lib/crashShield.ts (installCrashShield). This function is kept for
 * backwards compatibility and only sets up the console.error override.
 * If crashShield is not installed, this also sets the ErrorUtils handler as
 * a fallback.
 */
export function installCrashToast() {
  // Fallback: set the global error handler ONLY if crashShield hasn't already.
  // crashShield.ts's installCrashShield() is the preferred owner.
  try {
    const prev = ErrorUtils.getGlobalHandler();
    // Check if crashShield already installed its handler (it sets a custom one).
    // We detect this by name — if it's already 'CrashShieldHandler', skip.
    const handlerSrc = String(prev);
    if (!handlerSrc.includes('CrashShield') && !handlerSrc.includes('shielded')) {
      ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
        try {
          const tag = isFatal ? '💥 FATAL (shielded)' : '❌ JS ERROR';
          const msg = error?.message ?? String(error);
          ToastLogger.push(`${tag}: ${msg}`, 'crash');
          // DO NOT forward fatal errors to the previous handler in production —
          // doing so calls ExceptionsManager.reportFatalException() which kills the process.
          if (__DEV__ && !isFatal) prev?.(error, isFatal);
        } catch { /* silent */ }
      });
    }
  } catch (_) {
    // ErrorUtils unavailable (web / test env) — ignore
  }

  // Promise rejection handler (polyfill path)
  try {
    const tracking = require('promise/setimmediate/rejection-tracking');
    tracking.enable({
      allRejections: true,
      onUnhandled: (_id: string, error: Error | any) => {
        try {
          const msg = error instanceof Error ? error.message : String(error);
          ToastLogger.push(`⚠️ UNHANDLED PROMISE: ${msg}`, 'error');
        } catch { /* silent */ }
      },
      onHandled: () => {},
    });
  } catch (_) {}

  // console.error override — catches errors from third-party libs
  try {
    const _origError = console.error.bind(console);
    console.error = (...args: unknown[]) => {
      try {
        const first = String(args[0] ?? '');
        const isReactNoise =
          first.startsWith('Warning:') ||
          first.includes('Each child in a list') ||
          first.includes('key prop') ||
          first.includes('VirtualizedList') ||
          first.includes('componentWillReceiveProps') ||
          first.includes('componentWillMount');
        if (!isReactNoise) {
          const msg = args
            .map(a => {
              if (a instanceof Error) return a.message;
              if (typeof a === 'object' && a !== null) {
                try { return JSON.stringify(a); } catch { return String(a); }
              }
              return String(a);
            })
            .join(' ');
          if (msg.length > 3) ToastLogger.push(`⚠️ ${msg}`, 'error');
        }
      } catch { /* silent */ }
      _origError(...args);
    };
  } catch { /* silent */ }
}
