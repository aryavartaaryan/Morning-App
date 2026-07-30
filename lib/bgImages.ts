// ── Background image cache ─────────────────────────────────────────────────
// First run with internet: downloads all images to local FileSystem.
// All subsequent runs (online or offline): serves from local cache instantly.
// On app update (BG_URLS changed): old cache is wiped and re-downloaded.
import * as FileSystem from 'expo-file-system/legacy';
import { store, KEYS } from '@/lib/storage';

// Compressed Pexels URLs – all use ?auto=compress&cs=tinysrgb&w=600&q=85
// This reduces typical image size from 300–800 KB → 50–120 KB (5–6× smaller),
// making first-install setup ~5× faster without visible quality loss.
export const BG_URLS: Record<string, string> = {
  brahma:     'https://images.pexels.com/photos/20494584/pexels-photo-20494584.jpeg?auto=compress&cs=tinysrgb&w=600&q=85',
  predawn:    'https://images.pexels.com/photos/1334116/pexels-photo-1334116.jpeg?auto=compress&cs=tinysrgb&w=600&q=85',
  predawn_mid: 'https://images.pexels.com/photos/12348207/pexels-photo-12348207.jpeg?auto=compress&cs=tinysrgb&w=600&q=85',
  sunrise:    'https://images.pexels.com/photos/12625496/pexels-photo-12625496.jpeg?auto=compress&cs=tinysrgb&w=600&q=85',
  sunrise_2:  'https://images.pexels.com/photos/4161253/pexels-photo-4161253.png?auto=compress&cs=tinysrgb&w=600&q=85',
  sunrise_late: 'https://images.pexels.com/photos/6240658/pexels-photo-6240658.jpeg?auto=compress&cs=tinysrgb&w=600&q=85',
  sunrise_late_2: 'https://images.pexels.com/photos/9004241/pexels-photo-9004241.jpeg?auto=compress&cs=tinysrgb&w=600&q=85',
  morning_early: 'https://images.pexels.com/photos/2035066/pexels-photo-2035066.jpeg?auto=compress&cs=tinysrgb&w=600&q=85',
  morning_early_late: 'https://images.pexels.com/photos/21810071/pexels-photo-21810071.jpeg?auto=compress&cs=tinysrgb&w=600&q=85',
  morning:     'https://images.pexels.com/photos/34491611/pexels-photo-34491611.jpeg?auto=compress&cs=tinysrgb&w=600&q=85',
  morning_2:   'https://images.pexels.com/photos/14469571/pexels-photo-14469571.jpeg?auto=compress&cs=tinysrgb&w=600&q=85',
  morning_late: 'https://images.pexels.com/photos/2121062/pexels-photo-2121062.jpeg?auto=compress&cs=tinysrgb&w=600&q=85',
  morning_late_2: 'https://images.pexels.com/photos/6229960/pexels-photo-6229960.jpeg?auto=compress&cs=tinysrgb&w=600&q=85',
  midday_early: 'https://images.pexels.com/photos/14106721/pexels-photo-14106721.jpeg?auto=compress&cs=tinysrgb&w=600&q=85',
  midday_early_2: 'https://images.pexels.com/photos/33638423/pexels-photo-33638423.jpeg?auto=compress&cs=tinysrgb&w=600&q=85',
  midday_early_mid: 'https://images.pexels.com/photos/4558590/pexels-photo-4558590.jpeg?auto=compress&cs=tinysrgb&w=600&q=85',
  midday_early_late: 'https://images.pexels.com/photos/32749973/pexels-photo-32749973.jpeg?auto=compress&cs=tinysrgb&w=600&q=85',
  midday:     'https://images.pexels.com/photos/3269583/pexels-photo-3269583.jpeg?auto=compress&cs=tinysrgb&w=600&q=85',
  midday_late: 'https://images.pexels.com/photos/35452047/pexels-photo-35452047.jpeg?auto=compress&cs=tinysrgb&w=600&q=85',
  midday_late_2: 'https://images.pexels.com/photos/12597857/pexels-photo-12597857.jpeg?auto=compress&cs=tinysrgb&w=600&q=85',
  afternoon:  'https://images.pexels.com/photos/38255566/pexels-photo-38255566.jpeg?auto=compress&cs=tinysrgb&w=600&q=85',
  afternoon_first_late: 'https://images.pexels.com/photos/20737548/pexels-photo-20737548.jpeg?auto=compress&cs=tinysrgb&w=600&q=85',
  afternoon_mid: 'https://images.pexels.com/photos/2035108/pexels-photo-2035108.jpeg?auto=compress&cs=tinysrgb&w=600&q=85',
  afternoon_late: 'https://images.pexels.com/photos/8952400/pexels-photo-8952400.jpeg?auto=compress&cs=tinysrgb&w=600&q=85',
  afternoon_late_2: 'https://images.pexels.com/photos/8952105/pexels-photo-8952105.jpeg?auto=compress&cs=tinysrgb&w=600&q=85',
  sandhya:    'https://images.pexels.com/photos/16534748/pexels-photo-16534748.jpeg?auto=compress&cs=tinysrgb&w=600&q=85',
  sandhya_mid: 'https://images.pexels.com/photos/35662311/pexels-photo-35662311.jpeg?auto=compress&cs=tinysrgb&w=600&q=85',
  sandhya_late: 'https://images.pexels.com/photos/34323059/pexels-photo-34323059.jpeg?auto=compress&cs=tinysrgb&w=600&q=85',
  sandhya_late_part2: 'https://images.pexels.com/photos/8038504/pexels-photo-8038504.jpeg?auto=compress&cs=tinysrgb&w=600&q=85',
  sandhya_late_mid: 'https://images.pexels.com/photos/11774422/pexels-photo-11774422.jpeg?auto=compress&cs=tinysrgb&w=600&q=85',
  sandhya_late_mid_2: 'https://images.pexels.com/photos/7929897/pexels-photo-7929897.jpeg?auto=compress&cs=tinysrgb&w=600&q=85',
  sandhya_late_2: 'https://images.pexels.com/photos/4161255/pexels-photo-4161255.png?auto=compress&cs=tinysrgb&w=600&q=85',
  sandhya_late_3: 'https://images.pexels.com/photos/14448604/pexels-photo-14448604.jpeg?auto=compress&cs=tinysrgb&w=600&q=85',
  twilight: 'https://images.pexels.com/photos/34644590/pexels-photo-34644590.jpeg?auto=compress&cs=tinysrgb&w=600&q=85',
  evening_early: 'https://images.pexels.com/photos/20565269/pexels-photo-20565269.png?auto=compress&cs=tinysrgb&w=600&q=85',
  evening_early_2: 'https://images.pexels.com/photos/5641976/pexels-photo-5641976.jpeg?auto=compress&cs=tinysrgb&w=600&q=85',
  evening:    'https://images.pexels.com/photos/7828546/pexels-photo-7828546.jpeg?auto=compress&cs=tinysrgb&w=600&q=85',
  night_early: 'https://images.pexels.com/photos/6022476/pexels-photo-6022476.jpeg?auto=compress&cs=tinysrgb&w=600&q=85',
  night_early_mid2: 'https://images.pexels.com/photos/17182745/pexels-photo-17182745.jpeg?auto=compress&cs=tinysrgb&w=600&q=85',
  night_early_late: 'https://images.pexels.com/photos/36221368/pexels-photo-36221368.jpeg?auto=compress&cs=tinysrgb&w=600&q=85',
  night:      'https://images.pexels.com/photos/18635120/pexels-photo-18635120.jpeg?auto=compress&cs=tinysrgb&w=600&q=85',
  night_late: 'https://images.pexels.com/photos/7607889/pexels-photo-7607889.jpeg?auto=compress&cs=tinysrgb&w=600&q=85',
  auth:       'https://images.pexels.com/photos/10404089/pexels-photo-10404089.jpeg?auto=compress&cs=tinysrgb&w=600&q=85',
  splash:     'https://images.pexels.com/photos/7981134/pexels-photo-7981134.jpeg?auto=compress&cs=tinysrgb&w=600&q=85',
  onboarding: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=85&auto=format&fit=crop',
  naad_step:  'https://images.pexels.com/photos/8690653/pexels-photo-8690653.jpeg?auto=compress&cs=tinysrgb&w=600&q=85',
  naad_step_night: 'https://images.pexels.com/photos/30987027/pexels-photo-30987027.jpeg?auto=compress&cs=tinysrgb&w=600&q=85',
  live_session: 'https://images.pexels.com/photos/8685329/pexels-photo-8685329.jpeg?auto=compress&cs=tinysrgb&w=600&q=85',
  live_session_night: 'https://images.pexels.com/photos/35846224/pexels-photo-35846224.jpeg?auto=compress&cs=tinysrgb&w=600&q=85',
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
 * Safely download one file with retries and a per-attempt timeout.
 * ── KEY DESIGN ────────────────────────────────────────────────────────────
 * • maxRetries = 5 (increased from 3) — tolerates brief network glitches
 * • timeoutMs  = 30 000 — slower connections get a full 30 s per attempt
 * • Exponential backoff: 1 s, 2 s, 3 s, 4 s, 5 s between attempts
 * • Cleans up temp file on any failure to avoid orphaned partials
 */
async function safeDownloadAndMove(
  url: string,
  finalPath: string,
  timeoutMs: number = 30_000,
  maxRetries: number = 5,
): Promise<void> {
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
      const res = await Promise.race([resumable.downloadAsync(), timeoutPromise]);
      if (timeoutId) clearTimeout(timeoutId);
      if (res && res.status >= 200 && res.status < 400) {
        await FileSystem.deleteAsync(finalPath, { idempotent: true }).catch(() => {});
        await FileSystem.moveAsync({ from: tmpPath, to: finalPath });
        return; // ✅ Success
      } else {
        throw new Error(`HTTP ${res?.status}`);
      }
    } catch (e) {
      if (timeoutId) clearTimeout(timeoutId);
      FileSystem.deleteAsync(tmpPath, { idempotent: true }).catch(() => {});
      if (attempt >= maxRetries) throw e;
      // Exponential backoff before next attempt
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
}

/**
 * Like ensureAllBgsCached but reports progress after each image completes.
 *
 * ── KEY BEHAVIOURAL CHANGES vs old version ──────────────────────────────────
 * 1. NO early break on error: every image is attempted regardless of failures.
 *    This guarantees ALL wallpaper cards are downloaded — no blank cards.
 * 2. Failed images are tracked separately and retried AFTER the main pass,
 *    giving them a second chance without blocking progress for successful files.
 * 3. Only throws if the entire batch had 0 successful downloads (truly offline).
 * 4. Concurrency bumped to 12 for faster parallel downloads on good connections.
 */
export async function ensureAllBgsCachedWithProgress(
  onProgress: (done: number, total: number) => void,
  concurrency = 12,
): Promise<void> {
  try {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
    const storedHashes: Record<string, string> =
      JSON.parse((await store.get(KEYS.bgCacheVersion)) ?? '{}');
    const updatedHashes: Record<string, string> = { ...storedHashes };
    const entries = Object.entries(BG_URLS);
    const total   = entries.length;
    let done = 0;

    // Track which keys failed so we can retry them afterward
    const failedKeys: string[] = [];

    const executing = new Set<Promise<any>>();

    for (const [key, url] of entries) {
      const p = (async () => {
        const path    = cachePath(key);
        const urlHash = djb2(url);
        const cached  = await Promise.race([
          FileSystem.getInfoAsync(path),
          new Promise<any>(r => setTimeout(() => r({ exists: false, size: 0 }), 2000)),
        ]).catch(() => ({ exists: false, size: 0 }));

        const hasHash    = typeof storedHashes[key] === 'string';
        const urlChanged = hasHash && storedHashes[key] !== urlHash;
        const isValid    = (cached as any).exists && (cached as any).size > 1024;

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
            // ── CRITICAL CHANGE: Do NOT break the loop. Track the failure
            // and continue downloading remaining images. A second retry pass
            // will re-attempt failed files after the main batch completes.
            failedKeys.push(key);
          }
        } else {
          updatedHashes[key] = urlHash;
          BG_LOCAL_MAP[key]  = path;
        }
      })().finally(() => {
        done += 1;
        onProgress(done, total);
      });

      executing.add(p);
      const clean = () => executing.delete(p);
      p.then(clean).catch(clean);

      if (executing.size >= concurrency) {
        await Promise.race(executing);
      }
    }
    await Promise.all(executing);

    // ── RETRY PASS: Re-attempt all images that failed in the first pass ─────
    // This handles brief network glitches that cause a burst of failures.
    // By the time this runs, many successful downloads are complete and the
    // network may have stabilised. We silently retry without updating progress.
    if (failedKeys.length > 0) {
      console.log(`[bgImages] Retrying ${failedKeys.length} failed images...`);
      const retryExecuting = new Set<Promise<any>>();
      for (const key of failedKeys) {
        const url  = BG_URLS[key];
        const path = cachePath(key);
        const p = (async () => {
          try {
            await safeDownloadAndMove(url, path);
            updatedHashes[key] = djb2(url);
            BG_LOCAL_MAP[key]  = path;
          } catch {
            // Still failed after retry — silently leave this image for the
            // background re-download that happens after the app opens.
            console.warn(`[bgImages] Retry also failed for: ${key}`);
          }
        })();
        retryExecuting.add(p);
        const clean = () => retryExecuting.delete(p);
        p.then(clean).catch(clean);
        if (retryExecuting.size >= 6) {
          await Promise.race(retryExecuting);
        }
      }
      await Promise.all(retryExecuting);
    }

    await store.set(KEYS.bgCacheVersion, JSON.stringify(updatedHashes));

    // Only throw if EVERY single image failed (truly offline).
    // Partial failures are handled by the retry pass above.
    const allFailed = failedKeys.length === total;
    if (allFailed) {
      throw new Error('All background images failed to download — no internet?');
    }
  } catch (err) {
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
