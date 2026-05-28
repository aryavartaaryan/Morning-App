// ── Sound & theme image persistent-disk cache ──────────────────────────────
// First launch with internet: downloads all images to the app's documents
// directory (never evicted by the OS, unlike the HTTP/native image cache).
// All subsequent app opens: images are served instantly from local storage.
// Falls back to the remote URL gracefully if download fails (no internet).
import * as FileSystem from 'expo-file-system/legacy';
import { SOUND_IMAGES } from './sleepSoundsData';

const CACHE_DIR = (FileSystem.documentDirectory ?? '') + 'sound-img-cache/';

// In-memory map: remote URL → local file URI (populated during prefetch/cache-hit)
const LOCAL_URI_MAP: Record<string, string> = {};

// Warm-done subscriber system — card components subscribe so they re-render
// with local URIs once warmSoundImageMap() finishes populating LOCAL_URI_MAP.
let _warmDone = false;
const _warmSubs: Set<() => void> = new Set();

/** Subscribe to be notified when warmSoundImageMap() completes.
 *  If warm already finished, the callback is called synchronously.
 *  Returns an unsubscribe function. */
export function subscribeToWarm(cb: () => void): () => void {
  if (_warmDone) { cb(); return () => {}; }
  _warmSubs.add(cb);
  return () => { _warmSubs.delete(cb); };
}

/**
 * Returns the local cached file URI for the given remote URL if already
 * downloaded, otherwise returns the remote URL as-is.
 * Synchronous — safe to call during component render.
 */
export function getLocalSoundImageUri(remoteUrl: string): string {
  return LOCAL_URI_MAP[remoteUrl] ?? remoteUrl;
}

/**
 * Returns true if the given remote URL has already been downloaded to
 * the persistent disk cache and is ready to display instantly.
 * Synchronous — safe to call during component render.
 */
export function isSoundImageCached(remoteUrl: string): boolean {
  return remoteUrl != null && LOCAL_URI_MAP[remoteUrl] != null;
}

function cacheFilename(url: string): string {
  return url.replace(/[^a-z0-9]/gi, '_').slice(-80) + '.jpg';
}

async function cacheOne(url: string): Promise<void> {
  if (LOCAL_URI_MAP[url]) return;
  const path = CACHE_DIR + cacheFilename(url);
  try {
    const info = await FileSystem.getInfoAsync(path);
    if ((info as any).exists) {
      LOCAL_URI_MAP[url] = path;
      return;
    }
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true }).catch(() => {});
    await FileSystem.downloadAsync(url, path);
    LOCAL_URI_MAP[url] = path;
  } catch {
    // silent — remote URL remains as fallback on next render
  }
}

// Night-theme editorial cards defined in sleep.tsx (not in data file)
const NIGHT_THEME_URLS: readonly string[] = [
  'https://images.pexels.com/photos/1252869/pexels-photo-1252869.jpeg?auto=compress&cs=tinysrgb&w=400',
  'https://images.pexels.com/photos/459451/pexels-photo-459451.jpeg?auto=compress&cs=tinysrgb&w=400',
  'https://images.pexels.com/photos/1295138/pexels-photo-1295138.jpeg?auto=compress&cs=tinysrgb&w=400',
  'https://images.pexels.com/photos/1448055/pexels-photo-1448055.jpeg?auto=compress&cs=tinysrgb&w=400',
  'https://images.pexels.com/photos/466685/pexels-photo-466685.jpeg?auto=compress&cs=tinysrgb&w=400',
];

const ALL_URLS: readonly string[] = [
  ...new Set([...Object.values(SOUND_IMAGES), ...NIGHT_THEME_URLS]),
];

/**
 * Fast startup warm-up: scans all expected cache files that already exist on
 * disk and populates LOCAL_URI_MAP so getLocalSoundImageUri() returns local
 * paths immediately on the next render — without downloading anything new.
 * Call this as early as possible (no delay needed, pure file-stat calls).
 */
export async function warmSoundImageMap(): Promise<void> {
  await Promise.allSettled(
    ALL_URLS.map(async (url) => {
      if (LOCAL_URI_MAP[url]) return;
      try {
        const path = CACHE_DIR + cacheFilename(url);
        const info = await FileSystem.getInfoAsync(path);
        if ((info as any).exists) LOCAL_URI_MAP[url] = path;
      } catch { /* ignore */ }
    }),
  );
  _warmDone = true;
  _warmSubs.forEach(cb => cb());
  _warmSubs.clear();
}

/**
 * Downloads every sound card & night-theme image to persistent disk storage.
 * Should be called once on app start (with a small delay so it doesn't block
 * the initial render). Images already on disk are skipped instantly.
 */
export async function prefetchAllSoundImages(concurrency = 10): Promise<void> {
  for (let i = 0; i < ALL_URLS.length; i += concurrency) {
    await Promise.allSettled(ALL_URLS.slice(i, i + concurrency).map(cacheOne));
  }
}

/**
 * Ensures a single remote image URL is downloaded to persistent disk cache
 * and registered in LOCAL_URI_MAP so isSoundImageCached() returns true.
 * Resolves immediately if already cached. Safe to call before opening a reel.
 */
export async function ensureSoundImageCached(url: string): Promise<void> {
  await cacheOne(url);
}
