import * as FileSystem from 'expo-file-system/legacy';

const MANTRA_DIR = (FileSystem.documentDirectory ?? '') + 'mantras/';

export function getLocalMantraPath(id: string): string {
  return MANTRA_DIR + id + '.mp3';
}

export async function isMantraDownloaded(id: string): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(getLocalMantraPath(id));
    return info.exists;
  } catch { return false; }
}

export async function downloadMantra(
  id: string,
  url: string,
  onProgress?: (progress: number) => void,
): Promise<string | null> {
  try {
    const dirInfo = await FileSystem.getInfoAsync(MANTRA_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(MANTRA_DIR, { intermediates: true });
    }
    const dest = getLocalMantraPath(id);
    const dl = FileSystem.createDownloadResumable(url, dest, {}, (data) => {
      if (data.totalBytesExpectedToWrite > 0) {
        onProgress?.(data.totalBytesWritten / data.totalBytesExpectedToWrite);
      }
    });
    const result = await dl.downloadAsync();
    return result?.uri ?? null;
  } catch { return null; }
}

const MANTRA_CATALOG: { id: string; url: string }[] = [
  { id: 'gayatri',    url: 'https://ik.imagekit.io/rcsesr4xf/gayatri-mantra-ghanpaath.mp3' },
  { id: 'lalitha',    url: 'https://ik.imagekit.io/rcsesr4xf/Lalitha-Sahasranamam.mp3' },
  { id: 'shivtandav', url: 'https://ik.imagekit.io/rcsesr4xf/Shiva-Tandav.mp3' },
  { id: 'nada_govinda_mantra',      url: 'https://audio.onesutralabs.com/All%20Nada%20Sounds/shidenbeatsmusic-govinda-mantra-female-voice-with-tanpura-and-sitar-120558.m4a' },
  { id: 'nada_aar_sitar_classical', url: 'https://audio.onesutralabs.com/All%20Nada%20Sounds/aar_music-indian-classical-music-sitar-296790.m4a' },
];

export async function ensureAllMantrasDownloaded(): Promise<void> {
  for (const m of MANTRA_CATALOG) {
    try {
      const already = await isMantraDownloaded(m.id);
      if (!already) await downloadMantra(m.id, m.url);
    } catch { /* ignore per-mantra failures */ }
  }
}

export async function deleteMantra(id: string): Promise<void> {
  try {
    const path = getLocalMantraPath(id);
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) await FileSystem.deleteAsync(path);
  } catch {}
}
