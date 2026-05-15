export type MissionId =
  | 'move_it'
  // | 'sky_check'
  // | 'make_bed'
  | 'morning_mantra'
  | 'gratitude_drop'
  // | 'hydrate'
  | 'affirmations';

export interface Mission {
  id: MissionId;
  name: string;
  icon: string;
  tagline: string;
  difficulty: 'Easy' | 'Medium';
  ayuChip: string;
  color: string;
  hype: string;
}

export const MISSIONS: Mission[] = [
  {
    id: 'move_it',
    name: 'Move It',
    icon: '📳',
    tagline: 'Shake your phone hard to prove you\'re awake.',
    difficulty: 'Medium',
    ayuChip: 'Agni Igniter 🔥',
    color: '#F5820A',
    hype: 'Get that body moving — your energy depends on it.',
  },
  // {
  //   id: 'sky_check',
  //   name: 'Sky Check',
  //   icon: '🌅',
  //   tagline: 'Step outside. Look up. Capture the vibe.',
  //   difficulty: 'Easy',
  //   ayuChip: 'Prana Boost ✨',
  //   color: '#38bdf8',
  //   hype: 'Step outside. Breathe real air. Capture it.',
  // },
  // {
  //   id: 'make_bed',
  //   name: 'Make Your Bed',
  //   icon: '🛏️',
  //   tagline: 'Win the first battle of the day.',
  //   difficulty: 'Easy',
  //   ayuChip: 'Kapha Buster 🌀',
  //   color: '#a78bfa',
  //   hype: 'One minute. Make that bed. Win the day.',
  // },
  {
    id: 'morning_mantra',
    name: 'Morning Mantra',
    icon: '🎵',
    tagline: 'Recite. Repeat. Reset your frequency.',
    difficulty: 'Easy',
    ayuChip: 'Mind Cleanse 🧠',
    color: '#fbbf24',
    hype: "11 recitations. That's all. Your mind will thank you.",
  },
  {
    id: 'gratitude_drop',
    name: 'Gratitude Drop',
    icon: '🙏',
    tagline: 'Name 3 things. Change your whole day.',
    difficulty: 'Easy',
    ayuChip: 'Sattva Up ⬆️',
    color: '#34d399',
    hype: 'Name three things. Shift your whole mindset.',
  },
  // {
  //   id: 'hydrate',
  //   name: 'Hydrate',
  //   icon: '💧',
  //   tagline: 'Your body is 60% water. Reload it.',
  //   difficulty: 'Easy',
  //   ayuChip: 'Ama Flush 🌊',
  //   color: '#60a5fa',
  //   hype: 'One glass. Your cells are waiting.',
  // },
  {
    id: 'affirmations',
    name: 'Affirmations',
    icon: '⚡',
    tagline: 'Speak it. Believe it. Become it.',
    difficulty: 'Easy',
    ayuChip: 'Ojas Builder 💫',
    color: '#f472b6',
    hype: 'Say it out loud. Become it.',
  },
];

export type WakeSoundCategory = 'mantra' | 'gentle' | 'nature';

export interface WakeSound {
  id: string;
  label: string;
  icon: string;
  audioUrl: string;
  category: WakeSoundCategory;
  /** If true, this sound is ideal for the gentle-wake ramp (starts very soft) */
  isGentle?: boolean;
  /** Local bundled asset key — must also exist in BUNDLED_MANTRA_ASSETS */
  bundledKey?: string;
  /** Local bundled require() — for ambient .m4a sounds already in the bundle */
  bundledAsset?: any;
}

export const WAKE_SOUNDS: WakeSound[] = [
  // ── Mantra sounds ──────────────────────────────────────────────────────────
  {
    id: 'gayatri',
    label: 'Gayatri Mantra',
    icon: '🌞',
    audioUrl: 'https://ik.imagekit.io/rcsesr4xf/gayatri-mantra-ghanpaath.mp3',
    category: 'mantra',
  },
  {
    id: 'shiv_tandav',
    label: 'Shiv Tandav',
    icon: '🔱',
    audioUrl: 'https://ik.imagekit.io/rcsesr4xf/Shiva-Tandav.mp3',
    category: 'mantra',
  },
  {
    id: 'lalitha',
    label: 'Lalitha Sahasranama',
    icon: '🌺',
    audioUrl: 'https://ik.imagekit.io/rcsesr4xf/Lalitha-Sahasranamam.mp3',
    category: 'mantra',
  },
  {
    id: 'om_chant',
    label: 'Om Chant',
    icon: '🕉️',
    audioUrl: 'https://ik.imagekit.io/rcsesr4xf/om-chant-108.mp3',
    category: 'mantra',
    isGentle: true,
  },
  {
    id: 'rudrashtakam',
    label: 'Rudrashtakam',
    icon: '🔔',
    audioUrl: 'https://ik.imagekit.io/rcsesr4xf/Shiva-Tandav.mp3',
    category: 'mantra',
  },
  {
    id: 'devi_stuti',
    label: 'Devi Stuti',
    icon: '✨',
    audioUrl: 'https://ik.imagekit.io/rcsesr4xf/Lalitha-Sahasranamam.mp3',
    category: 'mantra',
  },
  {
    id: 'bhagya_suktam',
    label: 'Bhagya Suktam',
    icon: '🌟',
    audioUrl: '',
    category: 'mantra',
    bundledKey: 'bhagya_suktam',
  },
  {
    id: 'shiv_sankalpa_suktam',
    label: 'Shiv Sankalpa Suktam',
    icon: '🔱',
    audioUrl: '',
    category: 'mantra',
    bundledKey: 'shiv_sankalpa_suktam',
  },

  // ── Gentle wake sounds ─────────────────────────────────────────────────────
  {
    id: 'singing_bowl',
    label: 'Tibetan Singing Bowl',
    icon: '🫙',
    audioUrl: 'https://ik.imagekit.io/rcsesr4xf/tibetan-singing-bowl.mp3',
    category: 'gentle',
    isGentle: true,
  },
  {
    id: 'temple_bell',
    label: 'Temple Bell',
    icon: '🔔',
    audioUrl: 'https://ik.imagekit.io/rcsesr4xf/temple-bell-soft.mp3',
    category: 'gentle',
    isGentle: true,
  },
  {
    id: 'soft_veena',
    label: 'Soft Veena',
    icon: '🎵',
    audioUrl: 'https://ik.imagekit.io/rcsesr4xf/veena-morning.mp3',
    category: 'gentle',
    isGentle: true,
  },
  {
    id: 'flute_morning',
    label: 'Light Meditation Tone',
    icon: '🎶',
    audioUrl: 'https://ik.imagekit.io/rcsesr4xf/bansuri-morning.mp3',
    category: 'gentle',
    isGentle: true,
  },
  {
    id: 'singing_bowl_deep',
    label: 'Deep Singing Bowl',
    icon: '🔮',
    audioUrl: '',
    category: 'gentle',
    isGentle: true,
    bundledAsset: require('../assets/sounds/singing-bowl-deep.m4a'),
  },
  {
    id: 'tibetan_bowl',
    label: 'Tibetan Bowl',
    icon: '🫙',
    audioUrl: '',
    category: 'gentle',
    isGentle: true,
    bundledAsset: require('../assets/sounds/tibetan-bowl.m4a'),
  },
  {
    id: 'morning_flute',
    label: 'Light Meditation Tone',
    icon: '🎶',
    audioUrl: '',
    category: 'gentle',
    isGentle: true,
    bundledAsset: require('../assets/sounds/morning-flute.m4a'),
  },
  {
    id: 'sitar_morning',
    label: 'Calm Raga',
    icon: '🎸',
    audioUrl: '',
    category: 'gentle',
    isGentle: true,
    bundledAsset: require('../assets/sounds/sitar-morning.m4a'),
  },
  {
    id: 'healing_bells_432',
    label: '432 Hz Bells',
    icon: '🔔',
    audioUrl: '',
    category: 'gentle',
    isGentle: true,
    bundledAsset: require('../assets/sounds/432hz-healing-bells.m4a'),
  },
  {
    id: 'fusion',
    label: 'Fusion Wake',
    icon: '🌅',
    audioUrl: '',
    category: 'gentle',
    isGentle: true,
  },

  // ── Nature sounds ──────────────────────────────────────────────────────────
  {
    id: 'forest_birds',
    label: 'Forest & Birds',
    icon: '🌿',
    audioUrl: '',
    category: 'nature',
    isGentle: true,
    bundledAsset: require('../assets/sounds/mixkit-jungle-rain-and-birds-2392.m4a'),
  },
  {
    id: 'sea_waves',
    label: 'Sea Waves',
    icon: '🌊',
    audioUrl: '',
    category: 'nature',
    isGentle: true,
    bundledAsset: require('../assets/sounds/mixkit-sea-waves-on-a-rocky-shore-1190.m4a'),
  },
  {
    id: 'light_rain',
    label: 'Light Rain',
    icon: '🌧️',
    audioUrl: '',
    category: 'nature',
    isGentle: true,
    bundledAsset: require('../assets/sounds/mixkit-light-rain-loop-2393.m4a'),
  },
  {
    id: 'breeze_trees',
    label: 'Breeze & Trees',
    icon: '🍃',
    audioUrl: '',
    category: 'nature',
    isGentle: true,
    bundledAsset: require('../assets/sounds/mixkit-breeze-through-the-trees-2427.m4a'),
  },
  {
    id: 'river_flow',
    label: 'River Flow',
    icon: '💧',
    audioUrl: '',
    category: 'nature',
    isGentle: true,
    bundledAsset: require('../assets/sounds/mixkit-water-flowing-ambience-loop-3126.m4a'),
  },
  {
    id: 'morning_birds',
    label: 'Morning Birds',
    icon: '🐦',
    audioUrl: '',
    category: 'nature',
    isGentle: true,
    bundledAsset: require('../assets/sounds/morning-birds-loop.m4a'),
  },
  {
    id: 'spring_birds',
    label: 'Spring Birds',
    icon: '🌸',
    audioUrl: '',
    category: 'nature',
    isGentle: true,
    bundledAsset: require('../assets/sounds/spring-birds-morning.m4a'),
  },
  {
    id: 'forest_birds_spring',
    label: 'Forest Birds',
    icon: '🌳',
    audioUrl: '',
    category: 'nature',
    isGentle: true,
    bundledAsset: require('../assets/sounds/forest-birds-spring.m4a'),
  },
  {
    id: 'wanderlust_breeze',
    label: 'Wanderlust Breeze',
    icon: '🌬️',
    audioUrl: '',
    category: 'nature',
    isGentle: true,
    bundledAsset: require('../assets/sounds/wanderlust-breeze.m4a'),
  },
  {
    id: 'forest_campfire',
    label: 'Forest Campfire',
    icon: '🔥',
    audioUrl: '',
    category: 'nature',
    isGentle: true,
    bundledAsset: require('../assets/sounds/forest-campfire.m4a'),
  },
  {
    id: 'indian_beats',
    label: 'Indian Beats',
    icon: '🥁',
    audioUrl: '',
    category: 'gentle',
    isGentle: true,
    bundledAsset: require('../assets/sounds/indian-beats.m4a'),
  },
];

// ── Sleep sounds (ambient .m4a files already bundled) ──────────────────────
export interface SleepSound {
  id: string;
  label: string;
  icon: string;
  bundledAsset: any;
}

export const SLEEP_SOUNDS: SleepSound[] = [
  { id: 'sl_light_rain',      label: 'Light Rain',        icon: '🌧️',  bundledAsset: require('../assets/sounds/mixkit-light-rain-loop-2393.m4a') },
  { id: 'sl_jungle_rain',     label: 'Jungle Rain',       icon: '🌿',  bundledAsset: require('../assets/sounds/mixkit-jungle-rain-and-birds-2392.m4a') },
  { id: 'sl_sea_waves',       label: 'Sea Waves',         icon: '🌊',  bundledAsset: require('../assets/sounds/mixkit-sea-waves-on-a-rocky-shore-1190.m4a') },
  { id: 'sl_harbor_waves',    label: 'Harbor Waves',      icon: '⚓',  bundledAsset: require('../assets/sounds/mixkit-small-waves-harbor-rocks-1208.m4a') },
  { id: 'sl_river',           label: 'River Flow',        icon: '💧',  bundledAsset: require('../assets/sounds/mixkit-water-flowing-ambience-loop-3126.m4a') },
  { id: 'sl_heavy_rain',      label: 'Heavy Rain',        icon: '⛈️',  bundledAsset: require('../assets/sounds/mixkit-heavy-rain-drops-2399.m4a') },
  { id: 'sl_thunder_jungle',  label: 'Thunderstorm',      icon: '🌩️',  bundledAsset: require('../assets/sounds/mixkit-calm-thunderstorm-in-the-jungle-2415.m4a') },
  { id: 'sl_night_insects',   label: 'Night Insects',     icon: '🦗',  bundledAsset: require('../assets/sounds/mixkit-night-forest-with-insects-2414.m4a') },
  { id: 'sl_breeze',          label: 'Gentle Breeze',     icon: '🍃',  bundledAsset: require('../assets/sounds/mixkit-breeze-through-the-trees-2427.m4a') },
  { id: 'sl_wind',            label: 'Wind Ambience',     icon: '🌬️',  bundledAsset: require('../assets/sounds/mixkit-wind-blowing-ambience-2658.m4a') },
  { id: 'sl_close_waves',     label: 'Close Sea Waves',   icon: '🏖️',  bundledAsset: require('../assets/sounds/mixkit-close-sea-waves-loop-1195.m4a') },
  { id: 'sl_rain_thunder',    label: 'Rain & Thunder',    icon: '🌧️',  bundledAsset: require('../assets/sounds/mixkit-rain-and-thunder-storm-2390.m4a') },
  { id: 'sl_urban_day',       label: 'Urban Ambience',    icon: '🏙️',  bundledAsset: require('../assets/sounds/mixkit-urban-ambience-during-the-day-2505.m4a') },
  { id: 'sl_singing_bowl',    label: 'Deep Singing Bowl', icon: '🔮',  bundledAsset: require('../assets/sounds/singing-bowl-deep.m4a') },
  { id: 'sl_tibetan_bowl',    label: 'Tibetan Bowl',      icon: '🫙',  bundledAsset: require('../assets/sounds/tibetan-bowl.m4a') },
  { id: 'sl_morning_birds',   label: 'Morning Birds',     icon: '🐦',  bundledAsset: require('../assets/sounds/morning-birds-loop.m4a') },
  { id: 'sl_spring_birds',    label: 'Spring Birds',      icon: '🌸',  bundledAsset: require('../assets/sounds/spring-birds-morning.m4a') },
  { id: 'sl_forest_birds',    label: 'Forest Birds',      icon: '🌳',  bundledAsset: require('../assets/sounds/forest-birds-spring.m4a') },
  { id: 'sl_morning_flute',   label: 'Light Meditation Tone', icon: '🎶',  bundledAsset: require('../assets/sounds/morning-flute.m4a') },
  { id: 'sl_sitar',           label: 'Calm Raga',         icon: '🎸',  bundledAsset: require('../assets/sounds/sitar-morning.m4a') },
  { id: 'sl_432hz',           label: '432 Hz Bells',      icon: '🔔',  bundledAsset: require('../assets/sounds/432hz-healing-bells.m4a') },
  { id: 'sl_wanderlust',      label: 'Wanderlust Breeze', icon: '🌬️',  bundledAsset: require('../assets/sounds/wanderlust-breeze.m4a') },
  { id: 'sl_campfire',        label: 'Forest Campfire',   icon: '🔥',  bundledAsset: require('../assets/sounds/forest-campfire.m4a') },
  { id: 'sl_indian_beats',    label: 'Indian Beats',      icon: '🥁',  bundledAsset: require('../assets/sounds/indian-beats.m4a') },
];

export function getKalaMessage(hour: number): string {
  if (hour >= 4 && hour < 6) return '🌙 Prime Time — The world is asleep';
  if (hour >= 6 && hour < 10) return '🌅 Golden Window — Kapha hour, move fast';
  if (hour >= 10 && hour < 14) return "☀️ Late riser — Let's not make this a habit";
  return '🌤 Afternoon — Better than never. Go.';
}

export const WAKE_QUOTES = [
  'Discipline is just choosing between what you want now and what you want most.',
  'Every morning is a second chance.',
  'The way you start your morning is the way you live your life.',
  'Win the morning. Win the day.',
  'Your future self is watching you right now. Make it count.',
  '5 AM is not early. It\'s a different timezone — the one where winners live.',
  'Rise up. Start fresh. See the bright opportunity in each new day.',
  'The secret of getting ahead is getting started.',
  'You don\'t find willpower. You build it.',
  'Small disciplines repeated daily lead to great achievement.',
];

export const MANTRAS = [
  { text: 'Om Namah Shivaya', meaning: 'I honor the divine within', pronounce: 'Om Na-mah Shi-vaa-ya' },
  { text: 'Om Shanti Shanti Shanti', meaning: 'Peace in body, mind and spirit', pronounce: 'Om Shan-ti Shan-ti Shan-ti' },
  { text: 'So Hum', meaning: 'I am that. I am whole.', pronounce: 'So-hum (inhale: So, exhale: Hum)' },
  { text: 'Om Gam Ganapataye Namaha', meaning: 'Remove all obstacles', pronounce: 'Om Gum Guh-nuh-puh-tuh-yay Nah-mah-ha' },
  { text: 'Om Mani Padme Hum', meaning: 'The jewel is in the lotus', pronounce: 'Om Mah-nee Pahd-may Hum' },
  { text: 'Aham Brahmasmi', meaning: 'I am the universe', pronounce: 'Ah-ham Brah-maas-mi' },
  { text: 'Sat Nam', meaning: 'Truth is my identity', pronounce: 'Sat (truth) Naam (name/identity)' },
];

export const AFFIRMATIONS = [
  { text: 'My body is strong, my mind is clear, my energy is rising.', category: 'health' },
  { text: 'I show up fully for everything I do today.', category: 'discipline' },
  { text: 'I am exactly where I need to be, becoming who I am meant to be.', category: 'confidence' },
  { text: 'I attract abundance, health and joy effortlessly.', category: 'abundance' },
  { text: 'Every challenge I face makes me stronger and wiser.', category: 'resilience' },
  { text: 'I have the power to create the life I want.', category: 'confidence' },
  { text: 'My focus is laser sharp. I do deep work with ease.', category: 'focus' },
  { text: 'I am grateful for this body, this mind, this moment.', category: 'health' },
  { text: 'I lead with courage and act with conviction.', category: 'discipline' },
];

export interface MissionSettings {
  selectedMission: MissionId;
  lockInMode: boolean;
  bodhiMorningBrief: boolean;
  wakeSound: string;
  skipsUsed: number;
  skipsResetDate: string;
  streak: number;
  lastCompletedDate: string;
}

export const DEFAULT_MISSION_SETTINGS: MissionSettings = {
  selectedMission: 'gratitude_drop',
  lockInMode: true,
  bodhiMorningBrief: true,
  wakeSound: 'temple_bell',
  skipsUsed: 0,
  skipsResetDate: '',
  streak: 0,
  lastCompletedDate: '',
};

export const GRATITUDE_PROMPTS = [
  [
    'Something in your body you\'re grateful for',
    'Someone in your life right now',
    'Something small that happened yesterday',
  ],
  [
    'A skill or talent you are grateful to have',
    'A person who believed in you',
    'Something beautiful you noticed recently',
  ],
  [
    'A challenge that made you stronger',
    'A friend or family member who supports you',
    'Something you\'re looking forward to today',
  ],
];

export const MOVE_IT_OPTIONS = [
  { id: 'jumping_jacks', icon: '⚡', label: 'Jumping Jacks', sub: 'Phone detects every jump — no faking', duration: 60, repsTarget: 20, shakeThreshold: 1.4, cooldownMs: 450 },
  { id: 'push_ups', icon: '💪', label: 'Push-Ups', sub: 'Phone on floor counts each push-up', duration: 60, repsTarget: 10, shakeThreshold: 0.7, cooldownMs: 600 },
  { id: 'outdoor_walk', icon: '🌤️', label: 'Brisk Walk', sub: 'Phone counts your steps — must actually walk', duration: 120, repsTarget: 50, shakeThreshold: 0.45, cooldownMs: 320 },
  { id: 'indoor_stretch', icon: '🏠', label: 'Indoor Stretch', sub: '5 big body stretches — timer based', duration: 90, repsTarget: null, shakeThreshold: 0, cooldownMs: 0 },
];
