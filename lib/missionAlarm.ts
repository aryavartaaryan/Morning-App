export type MissionId =
  | 'move_it'
  | 'sky_check'
  | 'make_bed'
  | 'morning_mantra'
  | 'gratitude_drop'
  | 'hydrate'
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
  {
    id: 'sky_check',
    name: 'Sky Check',
    icon: '🌅',
    tagline: 'Step outside. Look up. Capture the vibe.',
    difficulty: 'Easy',
    ayuChip: 'Prana Boost ✨',
    color: '#38bdf8',
    hype: 'Step outside. Breathe real air. Capture it.',
  },
  {
    id: 'make_bed',
    name: 'Make Your Bed',
    icon: '🛏️',
    tagline: 'Win the first battle of the day.',
    difficulty: 'Easy',
    ayuChip: 'Kapha Buster 🌀',
    color: '#a78bfa',
    hype: 'One minute. Make that bed. Win the day.',
  },
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
  {
    id: 'hydrate',
    name: 'Hydrate',
    icon: '💧',
    tagline: 'Your body is 60% water. Reload it.',
    difficulty: 'Easy',
    ayuChip: 'Ama Flush 🌊',
    color: '#60a5fa',
    hype: 'One glass. Your cells are waiting.',
  },
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

export const WAKE_SOUNDS = [
  {
    id: 'gayatri',
    label: 'Gayatri',
    icon: '�',
    audioUrl: 'https://ik.imagekit.io/rcsesr4xf/gayatri-mantra-ghanpaath.mp3',
  },
  {
    id: 'shiv_tandav',
    label: 'Shiv Tandav',
    icon: '🔱',
    audioUrl: 'https://ik.imagekit.io/rcsesr4xf/Shiva-Tandav.mp3',
  },
  {
    id: 'lalitha',
    label: 'Lalitha',
    icon: '�',
    audioUrl: 'https://ik.imagekit.io/rcsesr4xf/Lalitha-Sahasranamam.mp3',
  },
  {
    id: 'om_chant',
    label: 'Om Chant',
    icon: '�️',
    audioUrl: 'https://ik.imagekit.io/rcsesr4xf/gayatri-mantra-ghanpaath.mp3',
  },
  {
    id: 'rudrashtakam',
    label: 'Rudrashtakam',
    icon: '🔔',
    audioUrl: 'https://ik.imagekit.io/rcsesr4xf/Shiva-Tandav.mp3',
  },
  {
    id: 'devi_stuti',
    label: 'Devi Stuti',
    icon: '✨',
    audioUrl: 'https://ik.imagekit.io/rcsesr4xf/Lalitha-Sahasranamam.mp3',
  },
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
