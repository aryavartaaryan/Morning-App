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
  history: DayRecord[];
};

interface IntentionStore extends IntentionState {
  isLoaded: boolean;
  load: () => Promise<void>;
  addIntention: (text: string) => void;
  toggleIntention: (id: string) => void;
  logIntention: (id: string) => void;
}

const STORAGE_KEY = 'onesutra_daily_intentions_v3';

const getTodayDateStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const useIntentionStore = create<IntentionStore>((set, get) => ({
  history: [],
  isLoaded: false,

  load: async () => {
    const data = await store.getJSON<IntentionState>(STORAGE_KEY);
    if (data) {
      const history = data.history || [];
      // Remove empty days just in case
      const validHistory = history.filter(h => h.items.length > 0);
      set({ ...data, isLoaded: true, history: validHistory });
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

      if (!todayRecord) {
        todayRecord = { date: today, items: [] };
        history.push(todayRecord);
      }

      todayRecord.items.push({
        id: Math.random().toString(36).substring(7),
        text: text.trim(),
        completed: false,
      });

      // Keep only last 14 active days of history (useful for "Recent")
      history = history.slice(-14);

      const newState = { ...state, history };
      store.setJSON(STORAGE_KEY, { history: newState.history });
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
      store.setJSON(STORAGE_KEY, { history: newState.history });
      return newState;
    });
  },

  logIntention: (id: string) => {
    const today = getTodayDateStr();
    set(state => {
      const history = state.history.map(record => {
        if (record.date === today) {
          return {
            ...record,
            items: record.items.map(item => 
              item.id === id ? { ...item, completed: true } : item
            )
          };
        }
        return record;
      });

      const newState = { ...state, history };
      store.setJSON(STORAGE_KEY, { history: newState.history });
      return newState;
    });
  }
}));
