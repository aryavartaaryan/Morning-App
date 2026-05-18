// ── Background image cache ─────────────────────────────────────────────────
// First run with internet: downloads all images to local FileSystem.
// All subsequent runs (online or offline): serves from local cache instantly.
// On app update (BG_URLS changed): old cache is wiped and re-downloaded.
import * as FileSystem from 'expo-file-system/legacy';
import { store, KEYS } from '@/lib/storage';

export const BG_URLS: Record<string, string> = {
  brahma:     'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=900&q=85&auto=format&fit=crop',
  predawn:    'https://images.pexels.com/photos/1642220/pexels-photo-1642220.jpeg?auto=compress&cs=tinysrgb&w=900',
  sunrise:    'https://images.pexels.com/photos/27740083/pexels-photo-27740083.jpeg?auto=compress&cs=tinysrgb&w=900',
  morning:    'https://images.pexels.com/photos/30328856/pexels-photo-30328856.jpeg?auto=compress&cs=tinysrgb&w=900',
  midday:     'https://images.pexels.com/photos/32890856/pexels-photo-32890856.jpeg?auto=compress&cs=tinysrgb&w=900',
  afternoon:  'https://images.pexels.com/photos/5887849/pexels-photo-5887849.jpeg?auto=compress&cs=tinysrgb&w=750&h=1500&fit=crop',
  sandhya:    'https://images.pexels.com/photos/34628283/pexels-photo-34628283.jpeg?auto=compress&cs=tinysrgb&w=900',
  twilight:   'https://images.pexels.com/photos/2865404/pexels-photo-2865404.jpeg?auto=compress&cs=tinysrgb&w=900',
  evening:    'https://images.pexels.com/photos/11996274/pexels-photo-11996274.jpeg?auto=compress&cs=tinysrgb&w=900',
  night:      'https://images.pexels.com/photos/1487009/pexels-photo-1487009.jpeg?auto=compress&cs=tinysrgb&w=900',
  auth:       'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=900&q=85&auto=format&fit=crop',
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
    if ((info as any).exists) return path;
    // Not cached yet — use network now, cache in background
    FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true })
      .then(() => FileSystem.downloadAsync(url, path))
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
 * - Unchanged images are never touched.
 */
export async function ensureAllBgsCached(): Promise<void> {
  try {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
    const storedHashes: Record<string, string> =
      JSON.parse((await store.get(KEYS.bgCacheVersion)) ?? '{}');
    const updatedHashes: Record<string, string> = { ...storedHashes };

    for (const [key, url] of Object.entries(BG_URLS)) {
      const path      = cachePath(key);
      const urlHash   = djb2(url);
      const cached    = await FileSystem.getInfoAsync(path).catch(() => ({ exists: false }));
      const urlChanged = storedHashes[key] !== urlHash;

      if (urlChanged && (cached as any).exists) {
        // URL changed in new release — remove stale file
        await FileSystem.deleteAsync(path, { idempotent: true }).catch(() => {});
      }

      const needsDownload = urlChanged || !(cached as any).exists;
      if (needsDownload) {
        try {
          await FileSystem.downloadAsync(url, path);
          updatedHashes[key] = urlHash; // only mark success after confirmed download
        } catch {
          // No internet — old file (if any) stays; hash not updated → retries next launch
        }
      } else {
        updatedHashes[key] = urlHash;
      }
    }

    await store.set(KEYS.bgCacheVersion, JSON.stringify(updatedHashes));
  } catch { /* silent */ }
}
