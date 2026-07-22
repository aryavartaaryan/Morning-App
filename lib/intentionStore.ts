import { create } from 'zustand';
import { store } from './storage';

export type IntentionItem = {
  id: string;
  text: string;
  completed: boolean;
};

export type DayRecord = {
  date: string; // YYYY-MM-DD
  items: IntentionItem[];
};

export type IntentionState = {
  currentStreak: number;
  streakStartDate: string | null;
  history: DayRecord[];
};

interface IntentionStore extends IntentionState {
  isLoaded: boolean;
  load: () => Promise<void>;
  addIntention: (text: string) => void;
  toggleIntention: (id: string) => void;
}

const STORAGE_KEY = 'onesutra_daily_intentions_v2';

const getTodayDateStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const useIntentionStore = create<IntentionStore>((set, get) => ({
  currentStreak: 0,
  streakStartDate: null,
  history: [],
  isLoaded: false,

  load: async () => {
    const data = await store.getJSON<IntentionState>(STORAGE_KEY);
    if (data) {
      const today = getTodayDateStr();
      const history = data.history || [];
      let streak = data.currentStreak || 0;
      let start = data.streakStartDate || null;

      const yesterdayDate = new Date();
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterdayStr = `${yesterdayDate.getFullYear()}-${String(yesterdayDate.getMonth() + 1).padStart(2, '0')}-${String(yesterdayDate.getDate()).padStart(2, '0')}`;

      const hasYesterday = history.some(h => h.date === yesterdayStr);
      const hasToday = history.some(h => h.date === today);

      if (!hasToday && !hasYesterday) {
         // Missed a day, streak broken
         streak = 0;
         start = null;
      }

      // Remove empty days just in case
      const validHistory = history.filter(h => h.items.length > 0);

      set({ ...data, currentStreak: streak, streakStartDate: start, isLoaded: true, history: validHistory });
    } else {
      set({ isLoaded: true });
    }
  },

  addIntention: (text: string) => {
    if (!text.trim()) return;
    const today = getTodayDateStr();
    set(state => {
      let history = [...state.history];
      let todayRecord = history.find(h => h.date === today);
      let newStreak = state.currentStreak;
      let newStart = state.streakStartDate;

      if (!todayRecord) {
        // First intention of the day!
        todayRecord = { date: today, items: [] };
        history.push(todayRecord);
        
        // Increase streak logic (1 to 7 cycle)
        if (newStreak >= 7 || newStreak === 0) {
            newStreak = 1;
            newStart = today;
        } else {
            newStreak += 1;
        }
      }

      todayRecord.items.push({
        id: Math.random().toString(36).substring(7),
        text: text.trim(),
        completed: false,
      });

      // Keep only last 7 active days of history
      history = history.slice(-7);

      const newState = { ...state, history, currentStreak: newStreak, streakStartDate: newStart };
      store.setJSON(STORAGE_KEY, { history: newState.history, currentStreak: newStreak, streakStartDate: newStart });
      return newState;
    });
  },

  toggleIntention: (id: string) => {
    const today = getTodayDateStr();
    set(state => {
      const history = state.history.map(record => {
        if (record.date === today) {
          return {
            ...record,
            items: record.items.map(item => 
              item.id === id ? { ...item, completed: !item.completed } : item
            )
          };
        }
        return record;
      });

      const newState = { ...state, history };
      store.setJSON(STORAGE_KEY, { history: newState.history, currentStreak: state.currentStreak, streakStartDate: state.streakStartDate });
      return newState;
    });
  }
}));
