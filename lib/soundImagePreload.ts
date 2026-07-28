// ── Sound & theme image persistent-disk cache ──────────────────────────────
// First launch with internet: downloads all images to the app's documents
// directory (never evicted by the OS, unlike the HTTP/native image cache).
// All subsequent app opens: images are served instantly from local storage.
// Falls back to the remote URL gracefully if download fails (no internet).
import * as FileSystem from 'expo-file-system/legacy';
import { SOUND_IMAGES, ALL_SLEEP_SOUNDS } from './sleepSoundsData';

const CACHE_DIR = (FileSystem.documentDirectory ?? '') + 'sound-img-cache-v3/';

async function safeDownloadAndMove(url: string, finalPath: string, timeoutMs: number = 15000, maxRetries: number = 3): Promise<void> {
  let attempt = 0;
  while (attempt < maxRetries) {
    attempt++;
    const tmpPath = finalPath + '_' + Date.now() + '_' + Math.floor(Math.random() * 1000) + '.tmp';
    const resumable = FileSystem.createDownloadResumable(url, tmpPath);
    let timeoutId: any;
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        resumable.cancelAsync().catch(() => {});
        reject(new Error('timeout'));
      }, timeoutMs);
    });

    try {
      const res = await Promise.race([ resumable.downloadAsync(), timeoutPromise ]);
      if (timeoutId) clearTimeout(timeoutId);
      if (res && res.status >= 200 && res.status < 400) {
        await FileSystem.deleteAsync(finalPath, { idempotent: true }).catch(() => {});
        await FileSystem.moveAsync({ from: tmpPath, to: finalPath });
        return; // Success
      } else {
        throw new Error(`HTTP ${res?.status}`);
      }
    } catch (e) {
      if (timeoutId) clearTimeout(timeoutId);
      FileSystem.deleteAsync(tmpPath, { idempotent: true }).catch(() => {});
      if (attempt >= maxRetries) {
        throw e;
      }
      // Wait before retrying (exponential backoff)
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
}


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

const IN_FLIGHT_DOWNLOADS: Record<string, Promise<void> | undefined> = {};

async function cacheOne(url: string): Promise<void> {
  if (LOCAL_URI_MAP[url]) return;
  if (IN_FLIGHT_DOWNLOADS[url]) return IN_FLIGHT_DOWNLOADS[url];

  const downloadPromise = (async () => {
    const path = CACHE_DIR + cacheFilename(url);
    const tmpPath = path + '_' + Date.now() + '_' + Math.floor(Math.random() * 1000) + '.tmp';
    try {
      const info = await Promise.race([
        FileSystem.getInfoAsync(path),
        new Promise<any>(r => setTimeout(() => r({ exists: false, size: 0 }), 1500))
      ]).catch(() => ({ exists: false, size: 0 }));
      if ((info as any).exists && (info as any).size > 1024) {
        LOCAL_URI_MAP[url] = path;
        _urlSubs.get(url)?.forEach(cb => cb());
        _urlSubs.delete(url);
        return;
      }
      await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true }).catch(() => {});
      await safeDownloadAndMove(url, path);
      LOCAL_URI_MAP[url] = path;
      _urlSubs.get(url)?.forEach(cb => cb());
      _urlSubs.delete(url);
    } catch (e) {
      // silent — remote URL remains as fallback on next render
      throw e;
    } finally {
      delete IN_FLIGHT_DOWNLOADS[url];
    }
  })();

  IN_FLIGHT_DOWNLOADS[url] = downloadPromise;
  return downloadPromise;
}

// Night-theme editorial cards defined in sleep.tsx (not in data file)
const NIGHT_THEME_URLS: readonly string[] = [
  'https://images.pexels.com/photos/6022435/pexels-photo-6022435.jpeg',
  'https://images.pexels.com/photos/459451/pexels-photo-459451.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/1295138/pexels-photo-1295138.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/1448055/pexels-photo-1448055.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/466685/pexels-photo-466685.jpeg?auto=compress&cs=tinysrgb&w=600',
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
  // ── COLD-BOOT FIX ─────────────────────────────────────────────────────────
  // After a phone restart, Android's JNI/filesystem bridge is still warming up.
  // FileSystem.getInfoAsync() can hang indefinitely during this window causing
  // the entire app startup gate to block and eventually trigger an ANR kill.
  // A 1.5-second per-file timeout guarantees we always finish quickly.
  const FILE_STAT_TIMEOUT_MS = 1500;
  await Promise.allSettled(
    ALL_URLS.map(async (url) => {
      if (LOCAL_URI_MAP[url]) return;
      try {
        const path = CACHE_DIR + cacheFilename(url);
        const info = await Promise.race([
          FileSystem.getInfoAsync(path),
          new Promise<{ exists: false }>(r =>
            setTimeout(() => r({ exists: false }), FILE_STAT_TIMEOUT_MS)
          ),
        ]);
        if ((info as any).exists && (info as any).size > 1024) LOCAL_URI_MAP[url] = path;
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
  const executing = new Set<Promise<any>>();
  for (const url of ALL_URLS) {
    const p = cacheOne(url);
    executing.add(p);
    const clean = () => executing.delete(p);
    p.then(clean).catch(clean);
    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }
  await Promise.all(executing);
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
  let hasError = false;
  
  const executing = new Set<Promise<any>>();
  
  for (const url of ALL_URLS) {
    if (hasError) break;
    const p = (async () => {
      await cacheOne(url);
    })().finally(() => {
      done += 1;
      onProgress(done, total);
    });
    
    const pWrapped = p.catch(() => { hasError = true; });
    executing.add(pWrapped);
    const clean = () => executing.delete(pWrapped);
    pWrapped.then(clean);
    
    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }
  await Promise.all(executing);
  
  if (hasError) {
    throw new Error('Some sound images failed to download.');
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
