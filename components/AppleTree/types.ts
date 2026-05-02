export type HealthState = 'thriving' | 'needs_water' | 'wilting' | 'critical';

export interface AppleTreeState {
  growthPercent: number;
  currentStage: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  healthState: HealthState;
  lastHabitDate: string;
  consecutiveMissedDays: number;
  seasonNumber: number;
  seasonStartDate: string;
  totalHabitsThisSeason: number;
  completionRateThisSeason: number;
  bestStreak: number;
  daysGrowing: number;
  orchardTrees: OrchardTree[];
}

export interface OrchardTree {
  season: number;
  completionRate: number;
  treeType: string;
  dateCompleted: string;
  habitsCompleted: number;
}

export interface TreeProps {
  state: AppleTreeState;
  onHabitLogged?: () => void;
  onPress?: () => void;
}

export type TimeOfDay = 'early_morning' | 'morning' | 'afternoon' | 'evening' | 'night';

export function getTimeOfDay(hour: number): TimeOfDay {
  if (hour >= 4 && hour < 7) return 'early_morning';
  if (hour >= 7 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 16) return 'afternoon';
  if (hour >= 16 && hour < 19) return 'evening';
  return 'night';
}

export function getAppleStage(pct: number): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  if (pct <= 5)  return 1;
  if (pct <= 20) return 2;
  if (pct <= 35) return 3;
  if (pct <= 50) return 4;
  if (pct <= 65) return 5;
  if (pct <= 79) return 6;
  return 7;
}

export function getTreeType(rate: number): string {
  if (rate >= 100) return '👑 Cosmic Apple';
  if (rate >= 96)  return '✨ Golden Apple';
  if (rate >= 90)  return '🍎 Red Apple';
  if (rate >= 80)  return '🍏 Green Apple';
  return '🌿 Crabapple';
}

export const STAGE_NAMES: Record<number, string> = {
  1: 'Seed',
  2: 'Seedling',
  3: 'Young Sapling',
  4: 'Established Tree',
  5: 'Flowering Tree',
  6: 'Fruiting Tree',
  7: 'Full Harvest',
};

export const STAGE_BADGES: Record<number, string> = {
  1: '🌱 A seed of intention planted!',
  2: '🌿 Seedling breaking through!',
  3: '🌲 Sapling growing strong!',
  4: '🌳 Roots run deep now!',
  5: '🌸 Apple Blossoms Opening!',
  6: '🍎 First Apples Forming!',
  7: '🍎 Full Harvest Achieved!',
};

export const STAGE_MESSAGES: Record<number, string> = {
  1: 'The smallest seed holds the mightiest tree inside it. Your journey starts now.',
  2: 'Every great forest began with a single sprout. Keep showing up.',
  3: 'Your sapling is finding its roots. Every habit is sunlight to this growing tree.',
  4: 'Deep roots, strong trunk. Your consistency is building something real.',
  5: 'Look at those blossoms — this is what showing up every day looks like.',
  6: 'Apples are forming. The fruit of your consistency is becoming visible. Keep going.',
  7: 'A full harvest. You grew this with real daily effort over 30 days. That is extraordinary.',
};
