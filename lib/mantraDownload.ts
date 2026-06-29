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

const CDN_BASE = 'https://audio.onesutralabs.com/sounds-large/';

const MANTRA_CATALOG: { id: string; url: string }[] = [
  { id: 'gayatri',    url: 'https://ik.imagekit.io/rcsesr4xf/gayatri-mantra-ghanpaath.mp3' },
  { id: 'lalitha',    url: 'https://ik.imagekit.io/rcsesr4xf/Lalitha-Sahasranamam.mp3' },
  { id: 'shivtandav', url: 'https://ik.imagekit.io/rcsesr4xf/Shiva-Tandav.mp3' },
  { id: 'nada_govinda_mantra',      url: 'https://audio.onesutralabs.com/All%20Nada%20Sounds/shidenbeatsmusic-govinda-mantra-female-voice-with-tanpura-and-sitar-120558.m4a' },
  { id: 'nada_aar_sitar_classical', url: 'https://audio.onesutralabs.com/All%20Nada%20Sounds/aar_music-indian-classical-music-sitar-296790.m4a' },
  // ── CDN large sounds (migrated from bundle to reduce APK size) ──────────────
  { id: 'bhagya_suktam',         url: CDN_BASE + 'bhagya-suktam.m4a' },
  { id: 'shiv_sankalpa_suktam',  url: CDN_BASE + 'shiv-sankalpa-suktam.m4a' },
  { id: 'singing_bowl_deep',     url: CDN_BASE + 'singing-bowl-deep.m4a' },
  { id: 'sitar_summer_raga',     url: CDN_BASE + 'sitar-summer-raga.m4a' },
  { id: 'sitar_radiance',        url: CDN_BASE + 'sitar-radiance.m4a' },
  { id: 'veena_classical',       url: CDN_BASE + 'veena-classical.m4a' },
  { id: 'bansuri_forest',        url: CDN_BASE + 'bansuri-forest.m4a' },
  { id: 'bansuri_tarana',        url: CDN_BASE + 'bansuri-tarana.m4a' },
  { id: 'tanpura_sacred_432hz',  url: CDN_BASE + 'tanpura-sacred-432hz.m4a' },
  { id: 'tanpura_breath',        url: CDN_BASE + 'tanpura-breath.m4a' },
  { id: 'tanpura_loop',          url: CDN_BASE + 'tanpura-loop.m4a' },
  { id: 'raga_tanpura_drone',    url: CDN_BASE + 'raga-tanpura-drone.m4a' },
  { id: 'tanpura_serene',        url: CDN_BASE + 'tanpura-serene.m4a' },
  { id: 'sargija_eastern',       url: CDN_BASE + 'sargija-eastern.m4a' },
  { id: 'tagore_festival',       url: CDN_BASE + 'tagore-festival.m4a' },
  { id: 'world_ambient',         url: CDN_BASE + 'world-ambient.m4a' },
  { id: 'spiritual_journey',     url: CDN_BASE + 'spiritual-journey.m4a' },
  { id: 'night_jungle_chiangmai',url: CDN_BASE + 'night-jungle-chiangmai.m4a' },
  { id: 'heaven_tune',           url: CDN_BASE + 'heaven-tune.m4a' },
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
