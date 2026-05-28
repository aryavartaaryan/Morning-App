import AsyncStorage from '@react-native-async-storage/async-storage';

export const WALK_BG_TASK   = 'nada-background-walk-tracker';
export const WALK_STATE_KEY = 'nada_active_walk_v2';

export type WalkMode = 'barefoot' | 'regular';

export interface WalkState {
  active:           boolean;
  paused:           boolean;
  type:             'morning' | 'evening';
  walkMode:         WalkMode;
  shatapavalli:     boolean;
  startMs:          number;
  pausedMs:         number;
  pausedAt:         number | null;
  stepCount:        number;
  distanceKm:       number;
  targetKm:         number | null;
  targetSteps:      number | null;
  lastLat:          number | null;
  lastLng:          number | null;
  notifiedTarget:   boolean;
}

export const DEFAULT_WALK_STATE: WalkState = {
  active: false, paused: false, type: 'morning',
  walkMode: 'regular', shatapavalli: false,
  startMs: 0, pausedMs: 0, pausedAt: null,
  stepCount: 0, distanceKm: 0, targetKm: null, targetSteps: null,
  lastLat: null, lastLng: null,
  notifiedTarget: false,
};

export async function getWalkState(): Promise<WalkState> {
  try {
    const raw = await AsyncStorage.getItem(WALK_STATE_KEY);
    if (raw) return { ...DEFAULT_WALK_STATE, ...JSON.parse(raw) };
  } catch { /* */ }
  return { ...DEFAULT_WALK_STATE };
}

export async function saveWalkState(s: WalkState): Promise<void> {
  try { await AsyncStorage.setItem(WALK_STATE_KEY, JSON.stringify(s)); } catch { /* */ }
}

export async function clearWalkState(): Promise<void> {
  try { await AsyncStorage.removeItem(WALK_STATE_KEY); } catch { /* */ }
}

export function haversineKmWalk(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R    = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lng2 - lng1) * Math.PI / 180;
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
