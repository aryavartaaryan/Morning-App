// ── Background image cache ─────────────────────────────────────────────────
// First run with internet: downloads all images to local FileSystem.
// All subsequent runs (online or offline): serves from local cache instantly.
// On app update (BG_URLS changed): old cache is wiped and re-downloaded.
import * as FileSystem from 'expo-file-system/legacy';
import { store, KEYS } from '@/lib/storage';

export const BG_URLS: Record<string, string> = {
  brahma:     'https://images.pexels.com/photos/20494584/pexels-photo-20494584.jpeg',
  predawn:    'https://images.pexels.com/photos/10729000/pexels-photo-10729000.jpeg',
  sunrise:    'https://images.pexels.com/photos/31887800/pexels-photo-31887800.jpeg',
  morning_early: 'https://images.pexels.com/photos/14064412/pexels-photo-14064412.jpeg',
  morning:    'https://images.pexels.com/photos/35400949/pexels-photo-35400949.jpeg',
  morning_late: 'https://images.pexels.com/photos/29224010/pexels-photo-29224010.jpeg',
  midday_early: 'https://images.pexels.com/photos/28871326/pexels-photo-28871326.jpeg',
  midday:     'https://images.pexels.com/photos/26728076/pexels-photo-26728076.jpeg',
  afternoon:  'https://images.pexels.com/photos/33441030/pexels-photo-33441030.jpeg',
  sandhya:    'https://images.pexels.com/photos/13605711/pexels-photo-13605711.jpeg',
  sandhya_late: 'https://images.pexels.com/photos/31887800/pexels-photo-31887800.jpeg',
  twilight:   'https://images.pexels.com/photos/12174054/pexels-photo-12174054.jpeg',
  twilight_late: 'https://images.pexels.com/photos/13258317/pexels-photo-13258317.jpeg',
  twilight_deep: 'https://images.pexels.com/photos/19377475/pexels-photo-19377475.jpeg',
  evening:    'https://images.pexels.com/photos/25853779/pexels-photo-25853779.jpeg',
  night:      'https://images.pexels.com/photos/1674625/pexels-photo-1674625.jpeg',
  auth:       'https://images.pexels.com/photos/10404089/pexels-photo-10404089.jpeg',
  splash:     'https://images.pexels.com/photos/10404089/pexels-photo-10404089.jpeg',
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
 * Like ensureAllBgsCached but reports progress after each image.
 * onProgress(done, total) — done counts successfully written images.
 */
export async function ensureAllBgsCachedWithProgress(
  onProgress: (done: number, total: number) => void,
): Promise<void> {
  try {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
    const storedHashes: Record<string, string> =
      JSON.parse((await store.get(KEYS.bgCacheVersion)) ?? '{}');
    const updatedHashes: Record<string, string> = { ...storedHashes };
    const entries = Object.entries(BG_URLS);
    const total   = entries.length;
    let done = 0;

    for (const [key, url] of entries) {
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
        } catch { /* keep old if any */ }
      } else {
        updatedHashes[key] = urlHash;
        BG_LOCAL_MAP[key]  = path;
      }
      done += 1;
      onProgress(done, total);
    }

    await store.set(KEYS.bgCacheVersion, JSON.stringify(updatedHashes));
  } catch { /* silent */ }
}

// Kick off disk-scan the moment this module loads so BG_LOCAL_MAP is populated
// before BgProvider's first render — eliminates the remote-URL flash on launch.
export const bgWarmup: Promise<void> = warmBgLocalMap();
