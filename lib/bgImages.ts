// ── Background image cache ─────────────────────────────────────────────────
// First run with internet: downloads all images to local FileSystem.
// All subsequent runs (online or offline): serves from local cache instantly.
import * as FileSystem from 'expo-file-system/legacy';

export const BG_URLS: Record<string, string> = {
  brahma:     'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=900&q=85&auto=format&fit=crop',
  predawn:    'https://images.pexels.com/photos/1642220/pexels-photo-1642220.jpeg?auto=compress&cs=tinysrgb&w=900',
  sunrise:    'https://images.pexels.com/photos/11584498/pexels-photo-11584498.jpeg?auto=compress&cs=tinysrgb&w=900',
  morning:    'https://images.pexels.com/photos/30485719/pexels-photo-30485719.jpeg?auto=compress&cs=tinysrgb&w=900',
  midday:     'https://images.pexels.com/photos/7145343/pexels-photo-7145343.jpeg?auto=compress&cs=tinysrgb&w=900',
  afternoon:  'https://images.pexels.com/photos/5887849/pexels-photo-5887849.jpeg?auto=compress&cs=tinysrgb&w=750&h=1500&fit=crop',
  sandhya:    'https://images.pexels.com/photos/16678058/pexels-photo-16678058.jpeg?auto=compress&cs=tinysrgb&w=900',
  twilight:   'https://images.pexels.com/photos/1624496/pexels-photo-1624496.jpeg?auto=compress&cs=tinysrgb&w=900',
  evening:    'https://images.pexels.com/photos/3967143/pexels-photo-3967143.jpeg?auto=compress&cs=tinysrgb&w=900',
  night:      'https://images.pexels.com/photos/13651742/pexels-photo-13651742.jpeg?auto=compress&cs=tinysrgb&w=900',
  auth:       'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=900&q=85&auto=format&fit=crop',
  onboarding: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=900&q=85&auto=format&fit=crop',
};

const CACHE_DIR = (FileSystem.documentDirectory ?? '') + 'bg-cache/';

function cachePath(key: string) { return CACHE_DIR + key + '.jpg'; }

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
 * Called once on app start. Downloads any missing images silently in background.
 * Already-cached images are skipped. Safe to call with no internet (errors ignored).
 */
export async function ensureAllBgsCached(): Promise<void> {
  try {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
    for (const [key, url] of Object.entries(BG_URLS)) {
      const path = cachePath(key);
      const info = await FileSystem.getInfoAsync(path).catch(() => ({ exists: false }));
      if (!(info as any).exists) {
        FileSystem.downloadAsync(url, path).catch(() => {});
      }
    }
  } catch { /* no internet — silently skip */ }
}
