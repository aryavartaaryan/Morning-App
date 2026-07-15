import * as FileSystem from 'expo-file-system/legacy';

const MANTRA_DIR = (FileSystem.documentDirectory ?? '') + 'mantras/';

const CDN_BASE = 'https://audio.onesutralabs.com/sounds-large/';

export const MANTRA_CATALOG: { id: string; url: string }[] = [
  { id: 'gayatri',    url: 'https://ik.imagekit.io/rcsesr4xf/gayatri-mantra-ghanpaath.mp3' },
  { id: 'lalitha',    url: 'https://ik.imagekit.io/rcsesr4xf/Lalitha-Sahasranamam.mp3' },
  { id: 'shivtandav', url: 'https://ik.imagekit.io/rcsesr4xf/Shiva-Tandav.mp3' },
  { id: 'naad_govinda_mantra',      url: 'https://audio.onesutralabs.com/All%20Nada%20Sounds/shidenbeatsmusic-govinda-mantra-female-voice-with-tanpura-and-sitar-120558.m4a' },
  { id: 'naad_aar_sitar_classical', url: 'https://audio.onesutralabs.com/All%20Nada%20Sounds/aar_music-indian-classical-music-sitar-296790.m4a' },
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
  { id: 'med_govind_bolo',       url: 'https://pub-0d083e39b57f47e8b2398292a67eef84.r2.dev/Meditations/Govind%20BoloShri%20Krishna%20Govind%20%20Krishna%20Sankirtanl%20%20Om%20Voices.mp3' },
  { id: 'cdn_ultra_vedic_healing_chant', url: 'https://pub-0d083e39b57f47e8b2398292a67eef84.r2.dev/NadaUltra/Vedic%20Mantra%20for%20Weight%20Loss%20%20Healing%20Meditation%20Music%20%20Divine%20Female%20Chanting.m4a' },
  { id: 'cdn_ultra_mahamrityunjaya',     url: 'https://pub-0d083e39b57f47e8b2398292a67eef84.r2.dev/NadaUltra/108%20Mahamrityunjaya%20Mantra%20Chant%20%20Tibetan%20Shiva%20Mantra%20for%20Protection%20%26%20Healing.m4a' },
  { id: 'med_ganesha_pancharatnam',      url: 'https://pub-0d083e39b57f47e8b2398292a67eef84.r2.dev/Meditations/Ganesha%20Pancharatnam%20I%20Om%20Voices%20Junior%20I%20Mudakaratha%20Modakam%20I%20Adi%20Shankaracharya.mp3' },
  { id: 'med_shyamale_meenakshi',        url: 'https://pub-0d083e39b57f47e8b2398292a67eef84.r2.dev/Meditations/Shyamale%20Meenakshi%20%20I%20Om%20Voices%20Junior%20I%20Praise%20Goddess%20Meenakshi%20with%20Dikshitar%27s%20Nottuswara.mp3' },
  { id: 'cdn_ultra_rise_krishna',        url: 'https://pub-0d083e39b57f47e8b2398292a67eef84.r2.dev/NadaUltra/Rise%20with%20Krishna_%20Uplifting%20Indian%20Morning%20Music%20%20Yoga%20%26%20Meditation%20Instrumentals.m4a' },
];

export function getLocalMantraPath(id: string): string {
  const item = MANTRA_CATALOG.find(m => m.id === id);
  const ext = item?.url.split('.').pop()?.split('?')[0]?.toLowerCase() ?? 'mp3';
  const finalExt = ['mp3', 'm4a', 'wav'].includes(ext) ? ext : 'mp3';
  return MANTRA_DIR + id + '.' + finalExt;
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

// MANTRA_CATALOG has been moved above for getLocalMantraPath to access.

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
