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

export type WakeSoundCategory = 'mantra' | 'gentle' | 'nature' | 'sitar' | 'flute' | 'tabla' | 'birds' | 'tanpura' | 'world';

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
    label: 'Hymn of Fortune (Bhagya Suktam)',
    icon: '🪔',
    audioUrl: 'https://audio.onesutralabs.com/sounds-large/bhagya-suktam.m4a',
    category: 'mantra',
  },
  {
    id: 'shiv_sankalpa_suktam',
    label: 'Shiv Sankalpa Suktam',
    icon: '🔱',
    audioUrl: 'https://audio.onesutralabs.com/sounds-large/shiv-sankalpa-suktam.m4a',
    category: 'mantra',
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
    audioUrl: 'https://audio.onesutralabs.com/sounds-large/singing-bowl-deep.m4a',
    category: 'gentle',
    isGentle: true,
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
    bundledAsset: require('../assets/sounds/mixkit-wind-blowing-ambience-2658.m4a'),
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
  // ── Sitar ──────────────────────────────────────────────────────────────────────
  { id: 'space_sitar',          label: 'Space Sitar',             icon: '🪐', audioUrl: '', category: 'sitar',   isGentle: true,  bundledAsset: require('../assets/sounds/space-sitar.m4a') },
  { id: 'sitar_long',           label: 'Sitar Meditation',        icon: '🎸', audioUrl: '', category: 'sitar',   isGentle: true,  bundledAsset: require('../assets/sounds/sitar-long.m4a') },
  { id: 'sitar_tabla_bells',    label: 'Sitar, Tabla & Bells',    icon: '🎵', audioUrl: '', category: 'sitar',   isGentle: false, bundledAsset: require('../assets/sounds/sitar-tabla-bells.m4a') },
  { id: 'indian_sitar_raga',    label: 'Indian Sitar Raga',       icon: '🎶', audioUrl: '', category: 'sitar',   isGentle: true,  bundledAsset: require('../assets/sounds/indian-sitar-raga.m4a') },
  { id: 'sitar_summer_raga',    label: 'Summer Healing Raga',     icon: '☀️', audioUrl: 'https://audio.onesutralabs.com/sounds-large/sitar-summer-raga.m4a', category: 'sitar',   isGentle: true },
  { id: 'sitar_radiance',       label: 'Sitar Radiance',          icon: '✨', audioUrl: 'https://audio.onesutralabs.com/sounds-large/sitar-radiance.m4a', category: 'sitar',   isGentle: false },
  { id: 'sitar_tanpura_sarangi',label: 'Sitar, Tanpura & Sarangi',icon: '🪕', audioUrl: '', category: 'sitar',   isGentle: true,  bundledAsset: require('../assets/sounds/sitar-tanpura-sarangi.m4a') },
  { id: 'sitar_tanpura_bgm',    label: 'Sitar & Tanpura',         icon: '🎼', audioUrl: '', category: 'sitar',   isGentle: true,  bundledAsset: require('../assets/sounds/sitar-tanpura.m4a') },
  { id: 'veena_classical',      label: 'Classical Veena',         icon: '🪗', audioUrl: 'https://audio.onesutralabs.com/sounds-large/veena-classical.m4a', category: 'sitar',   isGentle: true },
  { id: 'sitar_calm',            label: 'Calm Sitar',              icon: '🎸', audioUrl: '', category: 'sitar',   isGentle: true,  bundledAsset: require('../assets/sounds/sitar-calm.m4a') },
  { id: 'veena_raga',            label: 'Veena Raga Kanada',       icon: '🪗', audioUrl: '', category: 'sitar',   isGentle: true,  bundledAsset: require('../assets/sounds/veena-raga.m4a') },
  // ── Flute ──────────────────────────────────────────────────────────────────────
  { id: 'andean_flute',         label: 'Andean Flute',            icon: '🏔️', audioUrl: '', category: 'flute',   isGentle: true,  bundledAsset: require('../assets/sounds/andean-flute.m4a') },
  { id: 'native_flute',         label: 'Native American Flute',   icon: '🪶', audioUrl: '', category: 'flute',   isGentle: true,  bundledAsset: require('../assets/sounds/native-flute.m4a') },
  { id: 'native_flute_echo',    label: 'Native Flute Echo',       icon: '🌀', audioUrl: '', category: 'flute',   isGentle: true,  bundledAsset: require('../assets/sounds/native-flute-echo.m4a') },
  { id: 'bamboo_flute',         label: 'Bamboo Flute',            icon: '🎋', audioUrl: '', category: 'flute',   isGentle: true,  bundledAsset: require('../assets/sounds/bamboo-flute.m4a') },
  { id: 'flute_scale',          label: 'Flute Meditation',        icon: '🎶', audioUrl: '', category: 'flute',   isGentle: true,  bundledAsset: require('../assets/sounds/flute-scale.m4a') },
  { id: 'bansuri_forest',        label: 'Bansuri Forest',          icon: '🌿', audioUrl: 'https://audio.onesutralabs.com/sounds-large/bansuri-forest.m4a', category: 'flute',   isGentle: true },
  { id: 'bansuri_melody',        label: 'Bansuri Melody',          icon: '🎵', audioUrl: '', category: 'flute',   isGentle: true,  bundledAsset: require('../assets/sounds/bansuri-melody.m4a') },
  { id: 'bansuri_tarana',        label: 'Bansuri Tarana',          icon: '🎶', audioUrl: 'https://audio.onesutralabs.com/sounds-large/bansuri-tarana.m4a', category: 'flute',   isGentle: true },
  // ── Tabla ──────────────────────────────────────────────────────────────────────
  // ── Birds ──────────────────────────────────────────────────────────────────────
  { id: 'koel_bird',            label: 'Koel Bird Song',          icon: '🎵', audioUrl: '', category: 'birds',   isGentle: true,  bundledAsset: require('../assets/sounds/koel-bird.m4a') },
  { id: 'peacock_wild',         label: 'Wild Peacock',            icon: '🦚', audioUrl: '', category: 'birds',   isGentle: false, bundledAsset: require('../assets/sounds/peacock-wild.m4a') },
  { id: 'peacock_call',         label: 'Peacock Call',            icon: '🦚', audioUrl: '', category: 'birds',   isGentle: false, bundledAsset: require('../assets/sounds/peacock.m4a') },
  { id: 'cuckoo_forest',        label: 'Cuckoo Forest',           icon: '🌳', audioUrl: '', category: 'birds',   isGentle: true,  bundledAsset: require('../assets/sounds/cuckoo-forest.m4a') },
  { id: 'cuckoo_soft',          label: 'Soft Cuckoo',             icon: '🐦', audioUrl: '', category: 'birds',   isGentle: true,  bundledAsset: require('../assets/sounds/cuckoo-soft.m4a') },
  { id: 'cuckoo_clock',         label: 'Cuckoo Clock',            icon: '🕰️', audioUrl: '', category: 'birds',   isGentle: false, bundledAsset: require('../assets/sounds/cuckoo-clock.m4a') },
  { id: 'cuckoo_chime',         label: 'Cuckoo Chime',            icon: '🔔', audioUrl: '', category: 'birds',   isGentle: false, bundledAsset: require('../assets/sounds/cuckoo-chime.m4a') },
  { id: 'eagle_feather',        label: 'Eagle Call',              icon: '🦅', audioUrl: '', category: 'birds',   isGentle: false, bundledAsset: require('../assets/sounds/eagle-feather.m4a') },
  { id: 'india_countryside_birds', label: 'India Countryside',    icon: '🌾', audioUrl: '', category: 'birds',   isGentle: true,  bundledAsset: require('../assets/sounds/india-countryside-birds.m4a') },
  { id: 'cuckoo_birds_forest',  label: 'Cuckoo & Forest Birds',   icon: '🌲', audioUrl: '', category: 'birds',   isGentle: true,  bundledAsset: require('../assets/sounds/cuckoo-birds-forest.m4a') },
  // ── Tanpura ─────────────────────────────────────────────────────────────────
  { id: 'tanpura_sacred_432hz', label: 'Sacred Tanpura 432 Hz',   icon: '🕉️', audioUrl: 'https://audio.onesutralabs.com/sounds-large/tanpura-sacred-432hz.m4a', category: 'tanpura', isGentle: true },
  { id: 'tanpura_breath',       label: 'Tanpura Breath',          icon: '🌬️', audioUrl: 'https://audio.onesutralabs.com/sounds-large/tanpura-breath.m4a', category: 'tanpura', isGentle: true },
  { id: 'tanpura_loop',         label: 'Tanpura Loop',            icon: '🔁', audioUrl: 'https://audio.onesutralabs.com/sounds-large/tanpura-loop.m4a', category: 'tanpura', isGentle: true },
  { id: 'raga_tanpura_drone',   label: 'Raga Tanpura Drone',      icon: '🌌', audioUrl: 'https://audio.onesutralabs.com/sounds-large/raga-tanpura-drone.m4a', category: 'tanpura', isGentle: true },
  { id: 'tanpura_mystic',        label: 'Mystic Tanpura',          icon: '🌌', audioUrl: '', category: 'tanpura', isGentle: true,  bundledAsset: require('../assets/sounds/tanpura-mystic.m4a') },
  { id: 'tanpura_serene',        label: 'Serene Tanpura',          icon: '🧘', audioUrl: 'https://audio.onesutralabs.com/sounds-large/tanpura-serene.m4a', category: 'tanpura', isGentle: true },
  // ── World ──────────────────────────────────────────────────────────────────────
  { id: 'sargija_eastern',      label: 'Eastern Sargija',         icon: '🌏', audioUrl: 'https://audio.onesutralabs.com/sounds-large/sargija-eastern.m4a', category: 'world',   isGentle: true },
  { id: 'tagore_festival',      label: 'Tagore Festival',         icon: '🎊', audioUrl: 'https://audio.onesutralabs.com/sounds-large/tagore-festival.m4a', category: 'world',   isGentle: false },
  { id: 'world_ambient',        label: 'World Ambient',           icon: '🌍', audioUrl: 'https://audio.onesutralabs.com/sounds-large/world-ambient.m4a', category: 'world',   isGentle: true },
  { id: 'tibetan_dreams',       label: 'Tibetan Dreams',          icon: '🧘', audioUrl: '', category: 'world',   isGentle: true,  bundledAsset: require('../assets/sounds/tibetan-dreams.m4a') },
  { id: 'spiritual_journey',    label: 'Spiritual Journey',       icon: '🌌', audioUrl: 'https://audio.onesutralabs.com/sounds-large/spiritual-journey.m4a', category: 'world',   isGentle: true },
  { id: 'reincarnation_tones',  label: 'Reincarnation Tones',     icon: '♾️', audioUrl: '', category: 'world',   isGentle: true,  bundledAsset: require('../assets/sounds/reincarnation-tones.m4a') },
  { id: 'night_jungle_chiangmai', label: 'Night Jungle',          icon: '🦟', audioUrl: 'https://audio.onesutralabs.com/sounds-large/night-jungle-chiangmai.m4a', category: 'world',   isGentle: true },
  { id: 'heaven_tune',           label: 'Heaven Tune',             icon: '✨', audioUrl: 'https://audio.onesutralabs.com/sounds-large/heaven-tune.m4a', category: 'world',   isGentle: true },
  { id: 'om_shanti',              label: 'Om Shanti',               icon: '🕉️', audioUrl: '', category: 'mantra',  isGentle: true,  bundledAsset: require('../assets/sounds/om-shanti.m4a') },
];

// ── Sleep sounds (ambient .m4a files already bundled) ──────────────────────
export interface SleepSound {
  id: string;
  label: string;
  icon: string;
  bundledAsset?: any;
  audioUrl?: string;
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
  { id: 'sl_singing_bowl',    label: 'Deep Singing Bowl', icon: '🔮',  audioUrl: 'https://audio.onesutralabs.com/sounds-large/singing-bowl-deep.m4a' },
  { id: 'sl_tibetan_bowl',    label: 'Tibetan Bowl',      icon: '🫙',  bundledAsset: require('../assets/sounds/tibetan-bowl.m4a') },
  { id: 'sl_morning_birds',   label: 'Morning Birds',     icon: '🐦',  bundledAsset: require('../assets/sounds/morning-birds-loop.m4a') },
  { id: 'sl_spring_birds',    label: 'Spring Birds',      icon: '🌸',  bundledAsset: require('../assets/sounds/spring-birds-morning.m4a') },
  { id: 'sl_forest_birds',    label: 'Forest Birds',      icon: '🌳',  bundledAsset: require('../assets/sounds/forest-birds-spring.m4a') },
  { id: 'sl_morning_flute',   label: 'Light Meditation Tone', icon: '🎶',  bundledAsset: require('../assets/sounds/morning-flute.m4a') },
  { id: 'sl_sitar',           label: 'Calm Raga',         icon: '🎸',  bundledAsset: require('../assets/sounds/sitar-morning.m4a') },
  { id: 'sl_432hz',           label: '432 Hz Bells',      icon: '🔔',  bundledAsset: require('../assets/sounds/432hz-healing-bells.m4a') },
  { id: 'sl_wanderlust',      label: 'Wanderlust Breeze', icon: '🌬️',  bundledAsset: require('../assets/sounds/mixkit-wind-blowing-ambience-2658.m4a') },
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
  /** When false the wake alarm rings without any mission — just a Stop button */
  missionEnabled: boolean;
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
  missionEnabled: false,
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
