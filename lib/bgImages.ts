// ── Background image cache ─────────────────────────────────────────────────
// First run with internet: downloads all images to local FileSystem.
// All subsequent runs (online or offline): serves from local cache instantly.
// On app update (BG_URLS changed): old cache is wiped and re-downloaded.
import * as FileSystem from 'expo-file-system/legacy';
import { store, KEYS } from '@/lib/storage';

export const BG_URLS: Record<string, string> = {
  brahma:     'https://images.pexels.com/photos/20494584/pexels-photo-20494584.jpeg',
  predawn:    'https://images.pexels.com/photos/10729000/pexels-photo-10729000.jpeg',
  predawn_mid: 'https://images.pexels.com/photos/8576018/pexels-photo-8576018.jpeg',
  predawn_late: 'https://images.pexels.com/photos/35701856/pexels-photo-35701856.jpeg',
  sunrise:    'https://images.pexels.com/photos/7067945/pexels-photo-7067945.jpeg',
  sunrise_late: 'https://images.pexels.com/photos/14146976/pexels-photo-14146976.jpeg',
  morning_early: 'https://images.pexels.com/photos/13067636/pexels-photo-13067636.jpeg',
  morning:    'https://images.pexels.com/photos/12826618/pexels-photo-12826618.jpeg',
  morning_late: 'https://images.pexels.com/photos/9945162/pexels-photo-9945162.jpeg',
  midday_early: 'https://images.pexels.com/photos/5759034/pexels-photo-5759034.jpeg?auto=compress&cs=tinysrgb&w=800',
  midday_early_mid: 'https://images.pexels.com/photos/32414982/pexels-photo-32414982.jpeg',
  midday_early_late: 'https://images.pexels.com/photos/10630194/pexels-photo-10630194.jpeg',
  midday:     'https://images.pexels.com/photos/35521604/pexels-photo-35521604.jpeg',
  midday_mid: 'https://images.pexels.com/photos/10635417/pexels-photo-10635417.jpeg',
  midday_late: 'https://images.pexels.com/photos/36505945/pexels-photo-36505945.jpeg',
  afternoon:  'https://images.pexels.com/photos/33441030/pexels-photo-33441030.jpeg',
  afternoon_mid: 'https://images.pexels.com/photos/10630127/pexels-photo-10630127.jpeg',
  afternoon_late: 'https://images.pexels.com/photos/17931651/pexels-photo-17931651.jpeg',
  sandhya:    'https://images.pexels.com/photos/14448604/pexels-photo-14448604.jpeg',
  sandhya_late: 'https://images.pexels.com/photos/22705447/pexels-photo-22705447.jpeg',
  sandhya_late_2: 'https://images.pexels.com/photos/8990472/pexels-photo-8990472.jpeg',
  twilight:   'https://images.pexels.com/photos/17407357/pexels-photo-17407357.jpeg',
  twilight_late: 'https://images.pexels.com/photos/12506672/pexels-photo-12506672.jpeg',
  twilight_deep: 'https://images.pexels.com/photos/36097390/pexels-photo-36097390.jpeg',
  evening:    'https://images.pexels.com/photos/36497785/pexels-photo-36497785.jpeg',
  night_early: 'https://images.pexels.com/photos/35069746/pexels-photo-35069746.jpeg',
  night_early_late: 'https://images.pexels.com/photos/14976665/pexels-photo-14976665.jpeg',
  night:      'https://images.pexels.com/photos/19377475/pexels-photo-19377475.jpeg',
  auth:       'https://images.pexels.com/photos/10404089/pexels-photo-10404089.jpeg',
  splash:     'https://images.pexels.com/photos/26570345/pexels-photo-26570345.jpeg',
  onboarding: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=900&q=85&auto=format&fit=crop',
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
  await Promise.allSettled(
    Object.keys(BG_URLS).map(async (key) => {
      try {
        const path = cachePath(key);
        const info = await FileSystem.getInfoAsync(path);
        if ((info as any).exists) BG_LOCAL_MAP[key] = path;
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
    if ((info as any).exists) {
      BG_LOCAL_MAP[key] = path; // keep in-memory map current
      return path;
    }
    // Not cached yet — use network now, cache in background
    FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true })
      .then(() => FileSystem.downloadAsync(url, path))
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

    await Promise.allSettled(
      Object.entries(BG_URLS).map(async ([key, url]) => {
        const path      = cachePath(key);
        const urlHash   = djb2(url);
        const cached    = await FileSystem.getInfoAsync(path).catch(() => ({ exists: false }));
        const urlChanged = storedHashes[key] !== urlHash;

        if (urlChanged && (cached as any).exists) {
          await FileSystem.deleteAsync(path, { idempotent: true }).catch(() => {});
          delete BG_LOCAL_MAP[key];
        }

        const needsDownload = urlChanged || !(cached as any).exists;
        if (needsDownload) {
          try {
            await FileSystem.downloadAsync(url, path);
            updatedHashes[key] = urlHash;
            BG_LOCAL_MAP[key]  = path;
          } catch {
            // No internet — old file (if any) stays; hash not updated → retries next launch
          }
        } else {
          updatedHashes[key] = urlHash;
          BG_LOCAL_MAP[key]  = path;
        }
      })
    );

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
    await FileSystem.downloadAsync(url, path);
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
 * Downloads ALL images in PARALLEL (same as ensureAllBgsCached) so the
 * total time equals the slowest single image, not the sum of all images.
 * Each download is individually raced against a 10s timeout.
 */
export async function ensureAllBgsCachedWithProgress(
  onProgress: (done: number, total: number) => void,
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

    // Parallel: all images download concurrently — total time ≈ slowest image.
    await Promise.allSettled(
      entries.map(async ([key, url]) => {
        const path      = cachePath(key);
        const urlHash   = djb2(url);
        const cached    = await FileSystem.getInfoAsync(path).catch(() => ({ exists: false }));
        // Only consider URL changed if we previously HAD a hash and it differs.
        const hasHash    = typeof storedHashes[key] === 'string';
        const urlChanged = hasHash && storedHashes[key] !== urlHash;

        if (urlChanged && (cached as any).exists) {
          await FileSystem.deleteAsync(path, { idempotent: true }).catch(() => {});
          delete BG_LOCAL_MAP[key];
        }

        const needsDownload = urlChanged || !(cached as any).exists;
        if (needsDownload) {
          try {
            await Promise.race([
              FileSystem.downloadAsync(url, path),
              _timeout(PER_IMAGE_TIMEOUT_MS),
            ]);
            updatedHashes[key] = urlHash;
            BG_LOCAL_MAP[key]  = path;
          } catch {
            // Timed-out or failed — keep old cached file; hash not saved → retries next launch.
          }
        } else {
          updatedHashes[key] = urlHash;
          BG_LOCAL_MAP[key]  = path;
        }
        done += 1;
        onProgress(done, total);
      }),
    );

    await store.set(KEYS.bgCacheVersion, JSON.stringify(updatedHashes));
  } catch { /* silent */ }
}

// Kick off disk-scan the moment this module loads so BG_LOCAL_MAP is populated
// before BgProvider's first render — eliminates the remote-URL flash on launch.
export const bgWarmup: Promise<void> = warmBgLocalMap();
