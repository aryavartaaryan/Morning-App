import * as FileSystem from 'expo-file-system/legacy';
import { WAKE_SOUNDS } from './missionAlarm';
import { ALL_SLEEP_SOUNDS } from './sleepSoundsData';
import { getLocalMantraPath } from './mantraDownload';

const { Asset } = require('expo-asset') as typeof import('expo-asset');

const BUNDLED_MANTRA_ASSETS: Record<string, any> = {}; // CDN sounds — no longer bundled locally

const WAKE_SOUND_ALIASES: Record<string, string> = {
  shivtandav: 'shiv_tandav',
  forest_breeze: 'breeze_trees',
  sitar: 'sitar_morning',
  hz_432: 'healing_bells_432',
  campfire: 'forest_campfire',
  singing_bowl: 'singing_bowl_deep',
  wanderlust: 'wanderlust_breeze',
  jungle_rain: 'forest_birds',
  fusion: 'morning_birds',
};

const DOWNLOAD_ID_ALIASES: Record<string, string> = {
  shiv_tandav: 'shivtandav',
};

function normalizeWakeSoundId(id: string): string {
  return WAKE_SOUND_ALIASES[id] ?? id;
}

async function getExistingDownloadedPath(id: string): Promise<string | null> {
  const candidates = [id, normalizeWakeSoundId(id), DOWNLOAD_ID_ALIASES[id]].filter(Boolean) as string[];
  for (const candidate of candidates) {
    const path = getLocalMantraPath(candidate);
    const info = await FileSystem.getInfoAsync(path).catch(() => ({ exists: false }));
    if ((info as any).exists) return path;
  }
  return null;
}

async function getAssetFilePath(moduleId: any): Promise<string | null> {
  try {
    const asset = Asset.fromModule(moduleId);
    if (!asset.localUri) await asset.downloadAsync();
    return asset.localUri ?? asset.uri ?? null;
  } catch {
    return null;
  }
}

export async function resolveNativeWakeAlarmSoundPath(id: string): Promise<string | null> {
  const normalizedId = normalizeWakeSoundId(id);
  const sleepSound = ALL_SLEEP_SOUNDS.find(s => s.id === id || s.id === normalizedId);
  const wakeSound = WAKE_SOUNDS.find(s => s.id === normalizedId) ?? WAKE_SOUNDS.find(s => s.id === id);
  const bundledAsset = sleepSound?.src ?? wakeSound?.bundledAsset ?? BUNDLED_MANTRA_ASSETS[id] ?? BUNDLED_MANTRA_ASSETS[normalizedId];

  // Skip expo-asset resolution for CDN URI objects — they need to be pre-downloaded via mantraDownload
  const isCdnUri = bundledAsset && typeof bundledAsset === 'object' && typeof bundledAsset.uri === 'string' && bundledAsset.uri.startsWith('http');
  if (bundledAsset && !isCdnUri) {
    const path = await getAssetFilePath(bundledAsset);
    if (path) return path;
  }

  return getExistingDownloadedPath(id);
}
