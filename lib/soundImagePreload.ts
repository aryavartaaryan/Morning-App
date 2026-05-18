// ── Sound & theme image prefetch cache ─────────────────────────────────────
// First launch with internet: downloads all images into the native HTTP cache
// (NSURLCache on iOS, OkHttp cache on Android). Both caches persist across
// app sessions so images load instantly from disk on every subsequent open.
import { Image } from 'react-native';
import { SOUND_IMAGES } from './sleepSoundsData';

// Night-theme editorial cards defined in sleep.tsx (not in data file)
const NIGHT_THEME_URLS: readonly string[] = [
  'https://images.pexels.com/photos/1252869/pexels-photo-1252869.jpeg?auto=compress&cs=tinysrgb&w=400',
  'https://images.pexels.com/photos/459451/pexels-photo-459451.jpeg?auto=compress&cs=tinysrgb&w=400',
  'https://images.pexels.com/photos/1295138/pexels-photo-1295138.jpeg?auto=compress&cs=tinysrgb&w=400',
  'https://images.pexels.com/photos/1448055/pexels-photo-1448055.jpeg?auto=compress&cs=tinysrgb&w=400',
  'https://images.pexels.com/photos/466685/pexels-photo-466685.jpeg?auto=compress&cs=tinysrgb&w=400',
];

// Deduplicated master list of every sound card image URL
const ALL_IMAGE_URLS: readonly string[] = [
  ...new Set([...Object.values(SOUND_IMAGES), ...NIGHT_THEME_URLS]),
];

/** Prefetch URLs in parallel batches to avoid flooding the network */
async function batchPrefetch(
  urls: readonly string[],
  concurrency = 8,
): Promise<void> {
  for (let i = 0; i < urls.length; i += concurrency) {
    await Promise.allSettled(
      urls.slice(i, i + concurrency).map(url => Image.prefetch(url)),
    );
  }
}

/**
 * Prefetches every sound card & night-theme image into the native image cache.
 * Should be called once on app start (with a small delay so it doesn't block
 * the initial render). The native cache persists across app sessions.
 */
export async function prefetchAllSoundImages(): Promise<void> {
  await batchPrefetch(ALL_IMAGE_URLS);
}
