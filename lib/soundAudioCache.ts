// ── User-initiated audio cache ────────────────────────────────────────────────
// Sounds stream from remote URLs by default.
// The user can opt in to download individual sounds for offline playback.
// Downloaded files live in the app's documentDirectory (never auto-evicted).
import * as FileSystem from 'expo-file-system/legacy';
import { store } from './storage';

const AUDIO_CACHE_DIR = (FileSystem.documentDirectory ?? '') + 'sound-audio-cache/';
const CACHE_INDEX_KEY = '@naad_audio_cache_v1';

// In-memory index: soundId → local file URI
const CACHED_MAP: Record<string, string> = {};
let initialized = false;

export async function initAudioCache(): Promise<void> {
  if (initialized) return;
  initialized = true;
  const raw = await store.get(CACHE_INDEX_KEY);
  if (!raw) return;
  try {
    const entries: [string, string][] = JSON.parse(raw);
    // Verify files still exist on disk
    await Promise.allSettled(
      entries.map(async ([id, path]) => {
        const info = await FileSystem.getInfoAsync(path).catch(() => null);
        if ((info as any)?.exists) CACHED_MAP[id] = path;
      })
    );
    await persistIndex();
  } catch { /* ignore corrupt index */ }
}

async function persistIndex(): Promise<void> {
  await store.set(CACHE_INDEX_KEY, JSON.stringify(Object.entries(CACHED_MAP)));
}

/** Returns the local cached URI for this sound, or null if not yet downloaded. */
export function getCachedAudioPath(id: string): string | null {
  return CACHED_MAP[id] ?? null;
}

/** True if the sound has been downloaded to device storage. */
export function isAudioCached(id: string): boolean {
  return !!CACHED_MAP[id];
}

/** Download a remote sound to device storage for offline playback.
 *  Calls onProgress(0–1) as the file downloads.
 *  Returns the local file path on success. */
export async function downloadAudioToCache(
  id: string,
  remoteUrl: string,
  onProgress?: (fraction: number) => void,
): Promise<string> {
  await FileSystem.makeDirectoryAsync(AUDIO_CACHE_DIR, { intermediates: true }).catch(() => {});
  const filename = id.replace(/[^a-z0-9_-]/gi, '_') + '.m4a';
  const localPath = AUDIO_CACHE_DIR + filename;

  const dl = FileSystem.createDownloadResumable(
    remoteUrl,
    localPath,
    {},
    ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
      if (onProgress && totalBytesExpectedToWrite > 0) {
        onProgress(totalBytesWritten / totalBytesExpectedToWrite);
      }
    },
  );

  const result = await dl.downloadAsync();
  if (!result?.uri) throw new Error('Download failed');

  CACHED_MAP[id] = result.uri;
  await persistIndex();
  return result.uri;
}

/** Remove a previously cached sound from device storage. */
export async function deleteAudioFromCache(id: string): Promise<void> {
  const path = CACHED_MAP[id];
  if (path) {
    await FileSystem.deleteAsync(path, { idempotent: true }).catch(() => {});
    delete CACHED_MAP[id];
    await persistIndex();
  }
}

/** Given a sound id + remote URL, resolve the best playback source URI.
 *  Uses local cached file if available, otherwise falls back to the remote URL. */
export function resolveAudioUri(id: string, remoteUrl: string): string {
  return CACHED_MAP[id] ?? remoteUrl;
}
