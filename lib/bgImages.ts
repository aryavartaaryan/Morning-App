// ── Background image cache ─────────────────────────────────────────────────
// First run with internet: downloads all images to local FileSystem.
// All subsequent runs (online or offline): serves from local cache instantly.
// On app update (BG_URLS changed): old cache is wiped and re-downloaded.
import * as FileSystem from 'expo-file-system/legacy';
import { store, KEYS } from '@/lib/storage';

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

export const BG_URLS: Record<string, string> = {
  brahma:     'https://images.pexels.com/photos/20494584/pexels-photo-20494584.jpeg?auto=compress&cs=tinysrgb&w=600',
  predawn:    'https://images.pexels.com/photos/1334116/pexels-photo-1334116.jpeg?auto=compress&cs=tinysrgb&w=600',
  predawn_mid: 'https://images.pexels.com/photos/12348207/pexels-photo-12348207.jpeg?auto=compress&cs=tinysrgb&w=600',
  sunrise:    'https://images.pexels.com/photos/35753449/pexels-photo-35753449.jpeg?auto=compress&cs=tinysrgb&w=600',
  sunrise_2:  'https://images.pexels.com/photos/4161253/pexels-photo-4161253.png',
  sunrise_late: 'https://images.pexels.com/photos/6240658/pexels-photo-6240658.jpeg?auto=compress&cs=tinysrgb&w=600',
  sunrise_late_2: 'https://images.pexels.com/photos/9004241/pexels-photo-9004241.jpeg?auto=compress&cs=tinysrgb&w=600',
  morning_early: 'https://images.pexels.com/photos/2035066/pexels-photo-2035066.jpeg?auto=compress&cs=tinysrgb&w=600',
  morning_early_late: 'https://images.pexels.com/photos/21810071/pexels-photo-21810071.jpeg',
  morning:     'https://images.pexels.com/photos/34491611/pexels-photo-34491611.jpeg',
  morning_2:   'https://images.pexels.com/photos/14469571/pexels-photo-14469571.jpeg?auto=compress&cs=tinysrgb&w=600',
  morning_late: 'https://images.pexels.com/photos/2121062/pexels-photo-2121062.jpeg',
  morning_late_2: 'https://images.pexels.com/photos/6229960/pexels-photo-6229960.jpeg',
  midday_early: 'https://images.pexels.com/photos/14106721/pexels-photo-14106721.jpeg?auto=compress&cs=tinysrgb&w=600',
  midday_early_2: 'https://images.pexels.com/photos/33638423/pexels-photo-33638423.jpeg?auto=compress&cs=tinysrgb&w=600',
  midday_early_mid: 'https://images.pexels.com/photos/4558590/pexels-photo-4558590.jpeg',
  midday_early_late: 'https://images.pexels.com/photos/37366260/pexels-photo-37366260.jpeg',
  midday:     'https://images.pexels.com/photos/3269583/pexels-photo-3269583.jpeg',
  midday_late: 'https://images.pexels.com/photos/35452047/pexels-photo-35452047.jpeg',
  midday_late_2: 'https://images.pexels.com/photos/12597857/pexels-photo-12597857.jpeg?auto=compress&cs=tinysrgb&w=600',
  afternoon:  'https://images.pexels.com/photos/14406384/pexels-photo-14406384.jpeg?auto=compress&cs=tinysrgb&w=600',
  afternoon_first_late: 'https://images.pexels.com/photos/20737548/pexels-photo-20737548.jpeg',
  afternoon_mid: 'https://images.pexels.com/photos/2035108/pexels-photo-2035108.jpeg?auto=compress&cs=tinysrgb&w=600',
  afternoon_late: 'https://images.pexels.com/photos/8952400/pexels-photo-8952400.jpeg?auto=compress&cs=tinysrgb&w=600',
  afternoon_late_2: 'https://images.pexels.com/photos/8952105/pexels-photo-8952105.jpeg?auto=compress&cs=tinysrgb&w=600',
  sandhya:    'https://images.pexels.com/photos/16534748/pexels-photo-16534748.jpeg?auto=compress&cs=tinysrgb&w=600',
  sandhya_mid: 'https://images.pexels.com/photos/35662311/pexels-photo-35662311.jpeg?auto=compress&cs=tinysrgb&w=600',
  sandhya_late: 'https://images.pexels.com/photos/34323059/pexels-photo-34323059.jpeg',
  sandhya_late_part2: 'https://images.pexels.com/photos/8038504/pexels-photo-8038504.jpeg?auto=compress&cs=tinysrgb&w=600',
  sandhya_late_mid: 'https://images.pexels.com/photos/11774422/pexels-photo-11774422.jpeg?auto=compress&cs=tinysrgb&w=600',
  sandhya_late_mid_2: 'https://images.pexels.com/photos/7929897/pexels-photo-7929897.jpeg',
  sandhya_late_2: 'https://images.pexels.com/photos/4161255/pexels-photo-4161255.png',
  sandhya_late_3: 'https://images.pexels.com/photos/14448604/pexels-photo-14448604.jpeg',
  twilight: 'https://images.pexels.com/photos/34644590/pexels-photo-34644590.jpeg?auto=compress&cs=tinysrgb&w=600',
  evening_early: 'https://images.pexels.com/photos/20565269/pexels-photo-20565269.png?auto=compress&cs=tinysrgb&w=600',
  evening_early_2: 'https://images.pexels.com/photos/5641976/pexels-photo-5641976.jpeg',
  evening:    'https://images.pexels.com/photos/7828546/pexels-photo-7828546.jpeg?auto=compress&cs=tinysrgb&w=600',
  night_early: 'https://images.pexels.com/photos/6022476/pexels-photo-6022476.jpeg?auto=compress&cs=tinysrgb&w=600',
  night_early_mid2: 'https://images.pexels.com/photos/36396694/pexels-photo-36396694.jpeg?auto=compress&cs=tinysrgb&w=600',
  night_early_late: 'https://images.pexels.com/photos/36221368/pexels-photo-36221368.jpeg',
  night:      'https://images.pexels.com/photos/18635120/pexels-photo-18635120.jpeg',
  night_late: 'https://images.pexels.com/photos/7607889/pexels-photo-7607889.jpeg',
  auth:       'https://images.pexels.com/photos/10404089/pexels-photo-10404089.jpeg?auto=compress&cs=tinysrgb&w=600',
  splash:     'https://images.pexels.com/photos/7981134/pexels-photo-7981134.jpeg?auto=compress&cs=tinysrgb&w=600',
  onboarding: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=900&q=85&auto=format&fit=crop',
  naad_step:  'https://images.pexels.com/photos/8690653/pexels-photo-8690653.jpeg?auto=compress&cs=tinysrgb&w=600',
  naad_step_night: 'https://images.pexels.com/photos/30987027/pexels-photo-30987027.jpeg?auto=compress&cs=tinysrgb&w=600',
  live_session: 'https://images.pexels.com/photos/8685329/pexels-photo-8685329.jpeg?auto=compress&cs=tinysrgb&w=600',
  live_session_night: 'https://images.pexels.com/photos/35846224/pexels-photo-35846224.jpeg?auto=compress&cs=tinysrgb&w=600',
};

const CACHE_DIR = (FileSystem.documentDirectory ?? '') + 'bg-cache/';

function cachePath(key: string) { return CACHE_DIR + key + '.jpg'; }

/** djb2 hash of a single string */
function djb2(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0;
  }
  return h.toString(16);
}

// ── In-memory map: key → local file URI (populated during warmup / getBgSource) ──
// Lets bgContext set bgUri synchronously to the local file path on every app
// open after first launch — eliminates the network-flash when navigating tabs.
const BG_LOCAL_MAP: Record<string, string> = {};

/**
 * Synchronous lookup — returns local file URI if already cached in memory,
 * falls back to the remote URL otherwise. Safe to call at render time.
 */
export function getBgSourceSync(key: string): string {
  return BG_LOCAL_MAP[key] ?? BG_URLS[key] ?? BG_URLS.night;
}

/**
 * Fast startup routine: checks which BG files already exist on disk and
 * populates BG_LOCAL_MAP so getBgSourceSync returns local paths immediately.
 * No downloads — purely file-existence checks (~10 ms total).
 * Call this as early as possible in _layout.tsx before BgProvider mounts.
 */
export async function warmBgLocalMap(): Promise<void> {
  // ── COLD-BOOT FIX ─────────────────────────────────────────────────────────
  // After a phone restart, Android's filesystem/JNI bridge may not be fully
  // initialized. FileSystem.getInfoAsync() can hang indefinitely in this window.
  // A per-file 2-second timeout guarantees we always resolve and never block.
  const FILE_STAT_TIMEOUT_MS = 2000;
  await Promise.allSettled(
    Object.keys(BG_URLS).map(async (key) => {
      try {
        const path = cachePath(key);
        const info = await Promise.race([
          FileSystem.getInfoAsync(path),
          new Promise<{ exists: false }>(r =>
            setTimeout(() => r({ exists: false }), FILE_STAT_TIMEOUT_MS)
          ),
        ]);
        if ((info as any).exists && (info as any).size > 1024) BG_LOCAL_MAP[key] = path;
      } catch { /* ignore */ }
    }),
  );
}

/**
 * Returns the best available URI for a background image:
 *  - Local cached file (instant, offline) if already downloaded
 *  - Network URL as fallback (triggers a background cache-fill download)
 */
export async function getBgSource(key: string): Promise<string> {
  const url = BG_URLS[key] ?? BG_URLS.night;
  try {
    const path = cachePath(key);
    const info = await FileSystem.getInfoAsync(path);
    if ((info as any).exists && (info as any).size > 1024) {
      BG_LOCAL_MAP[key] = path; // keep in-memory map current
      return path;
    }
    // Not cached yet — use network now, cache in background
    FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true })
      .then(() => safeDownloadAndMove(url, path))
      .then(() => { BG_LOCAL_MAP[key] = path; })
      .catch(() => {});
    return url;
  } catch {
    return url;
  }
}

/**
 * Called once on app start.
 * Per-image URL hash tracking:
 * - If a URL changed (app update): deletes only that image's cache file, then re-downloads it.
 * - If re-download fails (no internet): keeps the old file so the user sees something.
 * - Hash is only saved after a successful download — retries automatically on next launch.
 * - All images are downloaded in parallel for fast first-install.
 */
export async function ensureAllBgsCached(): Promise<void> {
  try {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
    const storedHashes: Record<string, string> =
      JSON.parse((await store.get(KEYS.bgCacheVersion)) ?? '{}');
    const updatedHashes: Record<string, string> = { ...storedHashes };

    const entries = Object.entries(BG_URLS);
    const executing = new Set<Promise<any>>();

    for (const [key, url] of entries) {
      const p = (async () => {
        const path      = cachePath(key);
        const urlHash   = djb2(url);
        const cached    = await FileSystem.getInfoAsync(path).catch(() => ({ exists: false, size: 0 }));
        const urlChanged = storedHashes[key] !== urlHash;
        const isValid = (cached as any).exists && (cached as any).size > 1024;

        if (urlChanged && (cached as any).exists) {
          await FileSystem.deleteAsync(path, { idempotent: true }).catch(() => {});
          delete BG_LOCAL_MAP[key];
        }

        const needsDownload = urlChanged || !isValid;
        if (needsDownload) {
          try {
            await safeDownloadAndMove(url, path);
            updatedHashes[key] = urlHash;
            BG_LOCAL_MAP[key]  = path;
          } catch {
            // silent fail, keeps old file if exists
          }
        } else {
          updatedHashes[key] = urlHash;
          BG_LOCAL_MAP[key]  = path;
        }
      })();

      executing.add(p);
      const clean = () => executing.delete(p);
      p.then(clean).catch(clean);
      if (executing.size >= 8) {
        await Promise.race(executing);
      }
    }
    await Promise.all(executing);

    await store.set(KEYS.bgCacheVersion, JSON.stringify(updatedHashes));
  } catch { /* silent */ }
}

/**
 * Returns true when every BG image is already on disk (fast check, no downloads).
 * Call after bgWarmup resolves.
 */
export function isBgFullyCached(): boolean {
  return Object.keys(BG_URLS).every(k => !!BG_LOCAL_MAP[k]);
}

/**
 * Returns true if the splash image (the minimum-viable image for launch) is
 * already on disk. Used to decide whether to show the download progress gate:
 *   • true  → splash cached → skip gate, proceed directly to splash screen.
 *   • false → first install → show progress ring while images download.
 */
export function isSplashCached(): boolean {
  return !!BG_LOCAL_MAP['splash'];
}

/**
 * Guarantees a single BG key is on disk before returning its local path.
 * If already cached in memory: returns instantly (zero network).
 * If missing: downloads it now and returns the local path.
 * Falls back to the remote URL only if download fails (no internet).
 * Use this for critical images (splash, current period BG) so they are
 * never loaded from the network mid-render.
 */
export async function ensureBgKey(key: string): Promise<string> {
  if (BG_LOCAL_MAP[key]) return BG_LOCAL_MAP[key];
  const url = BG_URLS[key] ?? BG_URLS.night;
  try {
    const path = cachePath(key);
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true }).catch(() => {});
    await safeDownloadAndMove(url, path);
    BG_LOCAL_MAP[key] = path;
    return path;
  } catch {
    return url; // fallback to remote URL if no internet
  }
}

/** Returns a promise that rejects after `ms` milliseconds. */
function _timeout(ms: number): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

/**
 * Like ensureAllBgsCached but reports progress after each image completes.
 * Uses a concurrency limit to prevent network thread exhaustion/crashes.
 * Each download is individually raced against a 10s timeout.
 */
export async function ensureAllBgsCachedWithProgress(
  onProgress: (done: number, total: number) => void,
  concurrency = 8,
): Promise<void> {
  const PER_IMAGE_TIMEOUT_MS = 10_000;

  try {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
    const storedHashes: Record<string, string> =
      JSON.parse((await store.get(KEYS.bgCacheVersion)) ?? '{}');
    const updatedHashes: Record<string, string> = { ...storedHashes };
    const entries = Object.entries(BG_URLS);
    const total   = entries.length;
    let done = 0;

    let hasError = false;
    const executing = new Set<Promise<any>>();

    for (const [key, url] of entries) {
      if (hasError) break;
      const p = (async () => {
        const path      = cachePath(key);
        const urlHash   = djb2(url);
        const cached = await Promise.race([
          FileSystem.getInfoAsync(path),
          new Promise<any>(r => setTimeout(() => r({ exists: false, size: 0 }), 1500))
        ]).catch(() => ({ exists: false, size: 0 }));
        const hasHash    = typeof storedHashes[key] === 'string';
        const urlChanged = hasHash && storedHashes[key] !== urlHash;
        const isValid = (cached as any).exists && (cached as any).size > 1024;

        if (urlChanged && (cached as any).exists) {
          await FileSystem.deleteAsync(path, { idempotent: true }).catch(() => {});
          delete BG_LOCAL_MAP[key];
        }

        const needsDownload = urlChanged || !isValid;
        if (needsDownload) {
          try {
            await safeDownloadAndMove(url, path);
            updatedHashes[key] = urlHash;
            BG_LOCAL_MAP[key]  = path;
          } catch (e) {
            throw e;
          }
        } else {
          updatedHashes[key] = urlHash;
          BG_LOCAL_MAP[key]  = path;
        }
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

    await store.set(KEYS.bgCacheVersion, JSON.stringify(updatedHashes));
    
    if (hasError) {
      throw new Error("Some background images failed to download.");
    }
  } catch (err) {
    // Throw error so setup screen shows retry prompt, enforcing full preload.
    console.warn('[bgImages] ensureAllBgsCachedWithProgress error:', err);
    throw err;
  }
}

// Kick off disk-scan the moment this module loads so BG_LOCAL_MAP is populated
// before BgProvider's first render — eliminates the remote-URL flash on launch.
//
// ── COLD-BOOT FIX ─────────────────────────────────────────────────────────
// After a phone restart Android's filesystem is still initializing. warmBgLocalMap
// can hang if the JNI bridge isn't ready. A 4-second outer timeout guarantees
// bgWarmup ALWAYS resolves — even on a fresh cold boot — so nothing that
// `await bgWarmup` can ever block indefinitely and trigger an ANR.
export const bgWarmup: Promise<void> = Promise.race([
  warmBgLocalMap(),
  new Promise<void>(resolve => setTimeout(resolve, 4000)),
]).catch(() => {});
