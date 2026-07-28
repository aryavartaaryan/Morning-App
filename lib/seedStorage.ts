import AsyncStorage from '@react-native-async-storage/async-storage';

export interface BloomedSeed {
  id: string;
  type: 'pebble' | 'calm' | 'epic' | 'vitality'; // Keeping vitality for backward compatibility
  date: number; // timestamp
  steps: number;
}

const STORAGE_KEY = '@morning_app_seed_garden';

export async function saveBloomedSeed(type: 'pebble' | 'calm' | 'epic' | 'vitality', steps: number): Promise<void> {
  try {
    const existingStr = await AsyncStorage.getItem(STORAGE_KEY);
    const existing: BloomedSeed[] = existingStr ? JSON.parse(existingStr) : [];
    
    const newSeed: BloomedSeed = {
      id: Math.random().toString(36).substring(2, 15),
      type,
      date: Date.now(),
      steps,
    };
    
    existing.unshift(newSeed); // newest first
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  } catch (e) {
    console.warn('Failed to save bloomed seed', e);
  }
}

export async function getBloomedSeeds(): Promise<BloomedSeed[]> {
  try {
    const existingStr = await AsyncStorage.getItem(STORAGE_KEY);
    if (!existingStr) return [];
    return JSON.parse(existingStr);
  } catch (e) {
    console.warn('Failed to get bloomed seeds', e);
    return [];
  }
}

export async function clearGarden(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn('Failed to clear garden', e);
  }
}
