import AsyncStorage from '@react-native-async-storage/async-storage';

export const store = {
  get: async (key: string) => {
    try { return await AsyncStorage.getItem(key); } catch { return null; }
  },
  set: async (key: string, value: string) => {
    try { await AsyncStorage.setItem(key, value); } catch { /* */ }
  },
  remove: async (key: string) => {
    try { await AsyncStorage.removeItem(key); } catch { /* */ }
  },
  getJSON: async <T>(key: string): Promise<T | null> => {
    try {
      const raw = await AsyncStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },
  setJSON: async (key: string, value: unknown) => {
    try { await AsyncStorage.setItem(key, JSON.stringify(value)); } catch { /* */ }
  },
};

export const KEYS = {
  auth: 'onesutra_auth_v1',
  dosha: 'onesutra_dosha_v1',
  lifestyle: 'onesutra_lifestyle_v2',
  dailyLog: 'onesutra_daily_log_story_v1',
  mealAnalysis: 'onesutra_meal_analysis_v1',
  prakritiAnswers: 'onesutra_prakriti_answers_v1',
  language: 'onesutra_language_v1',
  welcomeSeen: 'onesutra_welcome_seen_v1',
  alarmSettings: 'onesutra_alarm_settings_v1',
  missionSettings: 'onesutra_mission_settings_v1',
  pledge: 'onesutra_pledge_v1',
  location: 'onesutra_location_v1',       // GPS-derived LocationProfile
  lastAlarmDate: 'onesutra_alarm_date_v1', // Last Brahma Muhurta alarm schedule date
  permissionsPrompted: 'onesutra_perms_v1',  // Set after first-launch permission walk-through
  alarmActive: 'onesutra_alarm_active_v1',   // '1' while alarm is ringing; cleared on mission complete
  multiAlarms: 'onesutra_multi_alarms_v1',   // AlarmEntry[] — habit + quick alarms
  brahmaMuhurtaNotif: 'arise_brahma_muhurta_v1', // boolean — daily BM notification enabled
  wakeLog:            'onesutra_wake_log_v1',     // WakeLogEntry — today's alarm wake record
  sunriseStreak:      'onesutra_sunrise_streak_v1', // SunriseStreak — before-sunrise wake streak
  habitAlarmStreaks:  'onesutra_habit_alarm_streaks_v1', // Record<habitKey, { streak, lastDate, history }>
  bgCacheVersion:     'solrize_bg_cache_version_v1',     // hash of BG_URLS — wipe cache on mismatch
};
