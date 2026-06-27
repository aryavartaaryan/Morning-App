// ── Sound & theme image persistent-disk cache ──────────────────────────────
// First launch with internet: downloads all images to the app's documents
// directory (never evicted by the OS, unlike the HTTP/native image cache).
// All subsequent app opens: images are served instantly from local storage.
// Falls back to the remote URL gracefully if download fails (no internet).
import * as FileSystem from 'expo-file-system/legacy';
import { SOUND_IMAGES, ALL_SLEEP_SOUNDS } from './sleepSoundsData';

const CACHE_DIR = (FileSystem.documentDirectory ?? '') + 'sound-img-cache-v2/';

// In-memory map: remote URL → local file URI (populated during prefetch/cache-hit)
const LOCAL_URI_MAP: Record<string, string> = {};

// Warm-done subscriber system — card components subscribe so they re-render
// with local URIs once warmSoundImageMap() finishes populating LOCAL_URI_MAP.
let _warmDone = false;
const _warmSubs: Set<() => void> = new Set();

// Per-URL subscriber system — notifies when a specific image finishes downloading.
const _urlSubs: Map<string, Set<() => void>> = new Map();

/** Subscribe to be notified when a specific remote URL is cached on disk.
 *  If already cached, the callback is called synchronously.
 *  Returns an unsubscribe function. */
export function subscribeToImageCached(url: string, cb: () => void): () => void {
  if (LOCAL_URI_MAP[url]) { cb(); return () => {}; }
  if (!_urlSubs.has(url)) _urlSubs.set(url, new Set());
  _urlSubs.get(url)!.add(cb);
  return () => { _urlSubs.get(url)?.delete(cb); };
}

/** Subscribe to be notified when warmSoundImageMap() completes.
 *  If warm already finished, the callback is called synchronously.
 *  Returns an unsubscribe function. */
export function subscribeToWarm(cb: () => void): () => void {
  if (_warmDone) { cb(); return () => {}; }
  _warmSubs.add(cb);
  return () => { _warmSubs.delete(cb); };
}

/**
 * Synchronously returns true once warmSoundImageMap() has finished
 * scanning disk and LOCAL_URI_MAP is fully populated.
 * Safe to call inside useState lazy initializers during render.
 */
export function isWarmDone(): boolean {
  return _warmDone;
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
    if ((info as any).exists && (info as any).size > 100) {
      LOCAL_URI_MAP[url] = path;
      _urlSubs.get(url)?.forEach(cb => cb());
      _urlSubs.delete(url);
      return;
    }
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true }).catch(() => {});
    // Atomic write to prevent partial/corrupted files if app is killed mid-download
    await FileSystem.downloadAsync(url, path + '.tmp');
    await FileSystem.moveAsync({ from: path + '.tmp', to: path });
    LOCAL_URI_MAP[url] = path;
    _urlSubs.get(url)?.forEach(cb => cb());
    _urlSubs.delete(url);
  } catch {
    // silent — remote URL remains as fallback on next render
    await FileSystem.deleteAsync(path + '.tmp', { idempotent: true }).catch(() => {});
  }
}

// Night-theme editorial cards defined in sleep.tsx (not in data file)
const NIGHT_THEME_URLS: readonly string[] = [
  'https://images.pexels.com/photos/6022435/pexels-photo-6022435.jpeg',
  'https://images.pexels.com/photos/459451/pexels-photo-459451.jpeg?auto=compress&cs=tinysrgb&w=400',
  'https://images.pexels.com/photos/1295138/pexels-photo-1295138.jpeg?auto=compress&cs=tinysrgb&w=400',
  'https://images.pexels.com/photos/1448055/pexels-photo-1448055.jpeg?auto=compress&cs=tinysrgb&w=400',
  'https://images.pexels.com/photos/466685/pexels-photo-466685.jpeg?auto=compress&cs=tinysrgb&w=400',
];

const SLEEP_SOUNDS_IMAGE_URLS: readonly string[] = ALL_SLEEP_SOUNDS
  .map(s => (s as any).imageUri as string | undefined)
  .filter((u): u is string => !!u);

const ALL_URLS: readonly string[] = [
  ...new Set([...Object.values(SOUND_IMAGES), ...NIGHT_THEME_URLS, ...SLEEP_SOUNDS_IMAGE_URLS]),
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

/** Total number of sound images the app manages. */
export const TOTAL_SOUND_IMAGES = ALL_URLS.length;

/**
 * Returns true when every sound image is already on disk.
 */
export function isSoundImageFullyCached(): boolean {
  return ALL_URLS.every(url => !!LOCAL_URI_MAP[url]);
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
 * Like prefetchAllSoundImages but reports progress (done / total) after each image.
 */
export async function prefetchAllSoundImagesWithProgress(
  onProgress: (done: number, total: number) => void,
  concurrency = 8,
): Promise<void> {
  const total = ALL_URLS.length;
  let done = 0;
  for (let i = 0; i < ALL_URLS.length; i += concurrency) {
    await Promise.allSettled(
      ALL_URLS.slice(i, i + concurrency).map(async (url) => {
        await cacheOne(url);
        done += 1;
        onProgress(done, total);
      }),
    );
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

/**
 * Pre-download critical alarm images (habit alarm, wake alarm) immediately.
 * These should be downloaded first since alarms can fire at any time.
 * Call this with high priority on app startup.
 */
export async function prefetchCriticalAlarmImages(): Promise<void> {
  const criticalUrls = [
    SOUND_IMAGES.cuckoo_chime,  // Habit alarm image
    SOUND_IMAGES.morning_birds, // Wake alarm fallback
  ];
  await Promise.allSettled(criticalUrls.map(cacheOne));
}
