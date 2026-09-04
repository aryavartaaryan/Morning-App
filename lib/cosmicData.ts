/**
 * Shared Vedic astrology / Panchanga data and calculation functions.
 * Used by CosmicStoryModal (Option B) and cosmic-daily page (Option C).
 */

// ── Nakshatras ──────────────────────────────────────────────────────────────
export const NAKSHATRAS = [
  { name: 'Ashwini',           constellation: 'Aries',       en: 'The Healer',         emoji: '🐴', deity: 'Ashwini Kumars (divine physicians)', planet: 'Ketu',    energy: 'Swift starts & healing. The twin divine physicians govern this asterism — quick decisions, initiating treatments, and physical starts. Rules the head and upper brain.' },
  { name: 'Bharani',           constellation: 'Aries',       en: 'The Carrier',        emoji: '⚖️', deity: 'Yama (lord of dharma)',              planet: 'Venus',   energy: 'Transformation & endurance. Yama governs intense creative and destructive force. High vitality, deep karmic processing, and the courage to hold contradictions.' },
  { name: 'Krittika',          constellation: 'Taurus',      en: 'The Flame',          emoji: '🔥', deity: 'Agni (fire god)',                    planet: 'Sun',     energy: 'Courage, clarity & purification. Aligned with the Pleiades — Agni cuts through illusion. Best for sharp decisions, truth-telling, and purification practices.' },
  { name: 'Rohini',            constellation: 'Taurus',      en: 'The Abundant',       emoji: '🌹', deity: 'Brahma (the creator)',               planet: 'Moon',    energy: 'Growth, beauty & abundance. The Moon is exalted here. Aligned with Aldebaran (α Tauri), one of the four royal stars. Maximum lunar fertility and creative magnetism.' },
  { name: 'Mrigashira',        constellation: 'Orion',       en: 'The Seeker',         emoji: '🦌', deity: 'Soma (moon god)',                    planet: 'Mars',    energy: 'Curiosity & gentle searching. The seeking impulse of consciousness. Best for exploration, research, travel, and following your intuition toward truth.' },
  { name: 'Ardra',             constellation: 'Orion',       en: 'The Storm',          emoji: '⛈️', deity: 'Rudra (cosmic storm)',               planet: 'Rahu',    energy: 'Renewal through intensity. Aligned with Betelgeuse (α Orionis). Disruption that clears — best for deep emotional processing and structural change.' },
  { name: 'Punarvasu',         constellation: 'Gemini',      en: 'Return of Light',    emoji: '🏠', deity: 'Aditi (mother of gods)',             planet: 'Jupiter', energy: 'Restoration & nourishment. Aligned with Pollux and Castor. Aditi\'s endless renewal energy — best for returning home, rebuilding, and receiving nourishment.' },
  { name: 'Pushya',            constellation: 'Cancer',      en: 'The Nourisher',      emoji: '🌸', deity: 'Brihaspati (Jupiter)',               planet: 'Saturn',  energy: 'Most auspicious nakshatra. Brihaspati governs expansive, generous energy. The cow\'s udder — it gives without depletion. Begin anything important today.' },
  { name: 'Ashlesha',          constellation: 'Hydra',       en: 'The Entwiner',       emoji: '🐍', deity: 'Naga serpent',                       planet: 'Mercury', energy: 'Deep insight & hidden wisdom. Serpent energy governs kundalini, deep psychology, and occult knowledge. Penetrating intelligence and hypnotic presence.' },
  { name: 'Magha',             constellation: 'Leo',         en: 'The Throne',         emoji: '👑', deity: 'Pitru (ancestors)',                  planet: 'Ketu',    energy: 'Ancestral power & authority. Aligned with Regulus (α Leonis) — heart of Leo. Ancestor energy at peak. Honor your roots and exercise authority with grace.' },
  { name: 'Purva Phalguni',    constellation: 'Leo',         en: 'The Resting Star',   emoji: '🌺', deity: 'Bhaga (god of delight)',             planet: 'Venus',   energy: 'Rest, pleasure & creative flow. Ruled by Bhaga. The hammock is its symbol — rest in abundance, enjoy creativity, sensuality, and artistic expression.' },
  { name: 'Uttara Phalguni',   constellation: 'Virgo',       en: 'The Covenant',       emoji: '🤝', deity: 'Aryaman (god of contracts)',         planet: 'Sun',     energy: 'Unions, loyalty & commitment. Aryaman rules contracts and patronage. Best for marriage, agreements, partnerships, and long-term commitments.' },
  { name: 'Hasta',             constellation: 'Corvus',      en: 'The Skilled Hand',   emoji: '✋', deity: 'Savitar (sun of craft)',             planet: 'Moon',    energy: 'Craft, healing touch & skill. The hand is its symbol — manual skill, healing arts, and precise work reach their peak. Best for surgery, art, and detailed work.' },
  { name: 'Chitra',            constellation: 'Virgo',       en: 'The Brilliant',      emoji: '💎', deity: 'Vishwakarma (cosmic architect)',     planet: 'Mars',    energy: 'Radiant creativity & achievement. Aligned with Spica (α Virginis) — one of the brightest stars. Vishwakarma\'s brilliant creative achievement energy.' },
  { name: 'Swati',             constellation: 'Boötes',      en: 'The Independent',    emoji: '🌬️', deity: 'Vayu (wind god)',                    planet: 'Rahu',    energy: 'Freedom, flexibility & movement. Aligned with Arcturus (α Boötis). Maximum independence, flexibility, and trade. Bending without breaking — the coral and sword grass.' },
  { name: 'Vishakha',          constellation: 'Libra',       en: 'The Forked Branch',  emoji: '⚡', deity: 'Indra & Agni (fire + lightning)',    planet: 'Jupiter', energy: 'Ambition, purpose & breakthrough. Peak ambition energy. The gateway/triumphal arch is its symbol — push through obstacles and make decisive moves today.' },
  { name: 'Anuradha',          constellation: 'Scorpius',    en: 'The Devoted Star',   emoji: '💫', deity: 'Mitra (god of friendship)',          planet: 'Saturn',  energy: 'Friendship, devotion & success. Lotus flower is its symbol — bloom through devotion. Best for forging alliances and building dedicated effort.' },
  { name: 'Jyeshtha',          constellation: 'Scorpius',    en: 'The Eldest',         emoji: '🛡️', deity: 'Indra (king of gods)',               planet: 'Mercury', energy: 'Power, protection & seniority. Aligned with Antares (α Scorpii). Circular talisman (raksha) is its symbol — protection, authority, and senior leadership.' },
  { name: 'Mula',              constellation: 'Sagittarius', en: 'The Root',           emoji: '🌱', deity: 'Nirriti (goddess of destruction)',   planet: 'Ketu',    energy: 'Core truth & deep foundations. Aligned with the Galactic Center. Maximum dissolution energy — go to the root, eliminate what is false, discover the foundation.' },
  { name: 'Purva Ashadha',     constellation: 'Sagittarius', en: 'The Undefeated',     emoji: '🌊', deity: 'Apas (water goddess)',               planet: 'Venus',   energy: 'Strength, purification & victory. Fan and winnowing basket are its symbols — separate the essential from the non-essential. Purification and invincibility.' },
  { name: 'Uttara Ashadha',    constellation: 'Sagittarius', en: 'The Universal',      emoji: '🌟', deity: 'Vishvadevas (universal gods)',        planet: 'Sun',     energy: 'Universal truth & final success. Vishvadevas rule lasting victory and cosmic truth. The elephant\'s tusk — penetrating, unstoppable wisdom.' },
  { name: 'Shravana',          constellation: 'Aquila',      en: 'The Listener',       emoji: '👂', deity: 'Vishnu (all-pervading)',             planet: 'Moon',    energy: 'Learning, listening & connection. Vishnu\'s three footsteps (Trivikrama) are its symbol — encompassing all dimensions through deep listening.' },
  { name: 'Dhanishtha',        constellation: 'Delphinus',   en: 'The Richest',        emoji: '🥁', deity: 'Eight Vasus (elemental deities)',    planet: 'Mars',    energy: 'Wealth, music & cosmic rhythm. The drum is its symbol — align with the cosmic pulse and prosperity follows. Best for music, rhythm, and abundance work.' },
  { name: 'Shatabhisha',       constellation: 'Aquarius',    en: 'Hundred Healers',    emoji: '💊', deity: 'Varuna (cosmic ocean)',              planet: 'Rahu',    energy: 'Healing, mystery & deep knowing. Empty circle is its symbol — healing through emptiness and deep mystical knowledge. A day for deep research and healing.' },
  { name: 'Purva Bhadrapada',  constellation: 'Pegasus',     en: 'Fierce Feet',        emoji: '🔱', deity: 'Aja Ekapada (one-footed storm deity)',planet: 'Jupiter', energy: 'Transformation & spiritual fire. Sword and two-faced man are its symbols — fierce, transformative energy. Great for spiritual practice and intense clearing.' },
  { name: 'Uttara Bhadrapada', constellation: 'Andromeda',   en: 'Gentle Feet',        emoji: '🐉', deity: 'Ahir Budhnya (serpent of the deep)', planet: 'Saturn',  energy: 'Depth, wisdom & universal love. The cosmic serpent of the abyss rules this profound nakshatra of universal compassion and deep wisdom.' },
  { name: 'Revati',            constellation: 'Pisces',      en: 'The Wealthy',        emoji: '🐟', deity: 'Pushan (god of safe journeys)',      planet: 'Mercury', energy: 'Completion, nourishment & safe journey. Aligned with ζ Piscium — the very end of the zodiac. Drum is its symbol — nourishment, abundance, and arriving home.' },
];

// ── Yogas ───────────────────────────────────────────────────────────────────
export const YOGAS = [
  { name: 'Vishkambha', en: 'Supportive',    auspicious: true,  meaning: 'Strong support available today' },
  { name: 'Priti',      en: 'Affection',     auspicious: true,  meaning: 'Day of love, connection & harmony' },
  { name: 'Ayushman',   en: 'Vitality',      auspicious: true,  meaning: 'Health & longevity energy amplified' },
  { name: 'Saubhagya',  en: 'Good Fortune',  auspicious: true,  meaning: 'Auspicious for all new beginnings' },
  { name: 'Shobhana',   en: 'Radiance',      auspicious: true,  meaning: 'Your ideas shine brightest today' },
  { name: 'Atiganda',   en: 'Caution',       auspicious: false, meaning: 'Pause before major decisions today' },
  { name: 'Sukarman',   en: 'Right Action',  auspicious: true,  meaning: 'Aligned actions yield great results' },
  { name: 'Dhriti',     en: 'Resolve',       auspicious: true,  meaning: 'Steady determination — keep going' },
  { name: 'Shula',      en: 'Challenge',     auspicious: false, meaning: 'Navigate obstacles with patience' },
  { name: 'Ganda',      en: 'Knot',          auspicious: false, meaning: 'Simplify & clear blockages today' },
  { name: 'Vriddhi',    en: 'Growth',        auspicious: true,  meaning: 'Expansion — ideal to plant seeds' },
  { name: 'Dhruva',     en: 'Constant',      auspicious: true,  meaning: 'Stability & permanence favored' },
  { name: 'Vyaghata',   en: 'Striking',      auspicious: false, meaning: 'Bold moves can break old patterns' },
  { name: 'Harshana',   en: 'Delight',       auspicious: true,  meaning: 'Joy & celebration in the air' },
  { name: 'Vajra',      en: 'Diamond',       auspicious: true,  meaning: 'Unbreakable clarity & strength' },
  { name: 'Siddhi',     en: 'Mastery',       auspicious: true,  meaning: 'Completion energy — finish what you start' },
  { name: 'Vyatipata',  en: 'Rest',          auspicious: false, meaning: 'Inner work over outer action today' },
  { name: 'Variyan',    en: 'Superior',      auspicious: true,  meaning: 'Your unique talents are most visible' },
  { name: 'Parigha',    en: 'Barrier',       auspicious: false, meaning: 'Steady approach, avoid shortcuts' },
  { name: 'Shiva',      en: 'Auspicious',    auspicious: true,  meaning: 'Highly favored — begin anything today' },
  { name: 'Siddha',     en: 'Accomplished',  auspicious: true,  meaning: 'Skills sharp — take inspired action' },
  { name: 'Sadhya',     en: 'Workable',      auspicious: true,  meaning: 'Step-by-step progress yields results' },
  { name: 'Shubha',     en: 'Blessed',       auspicious: true,  meaning: 'Beautiful energy for love & art' },
  { name: 'Shukla',     en: 'Pure',          auspicious: true,  meaning: 'Clear intentions manifest quickly' },
  { name: 'Brahma',     en: 'Creator',       auspicious: true,  meaning: 'Creation energy — ideal for new projects' },
  { name: 'Mahendra',   en: 'Great Power',   auspicious: true,  meaning: 'Peak power — lead, act & create' },
  { name: 'Vaidhriti',  en: 'Ill-carried',   auspicious: false, meaning: 'Rest & reflect — avoid major launches' },
];

// ── Vaars (days of the week) ─────────────────────────────────────────────────
export const VAARS = [
  { vedicName: 'Surya Vaar',  planet: 'Sun',     emoji: '☀️', color: '#fbbf24', energy: 'Leadership, clarity & self-expression',    science: 'Solar UV-B peaks in morning hours — Vitamin D synthesis and Cortisol Awakening Response both track the sun. Pineal gland responds to full-spectrum sunlight to regulate melatonin and circadian rhythm.' },
  { vedicName: 'Soma Vaar',   planet: 'Moon',    emoji: '🌙', color: '#93c5fd', energy: 'Intuition, emotion & inner wisdom',          science: 'The Moon\'s gravitational field subtly modulates cerebrospinal fluid pressure. The hypothalamus — your emotional regulation hub — shows heightened sensitivity to lunar magnetic variation today.' },
  { vedicName: 'Mangal Vaar', planet: 'Mars',    emoji: '🔴', color: '#f87171', energy: 'Courage, strength & decisive action',        science: 'Red-light frequencies (Mars spectrum) penetrate deeper tissue and stimulate mitochondrial ATP production. Traditional medicine correlates Mars Day with peak testosterone and adrenaline cycles.' },
  { vedicName: 'Budha Vaar',  planet: 'Mercury', emoji: '💚', color: '#6ee7b7', energy: 'Communication, learning & agility',           science: 'Mercury governs the fastest electromagnetic cycles in the solar system. Ayurvedic chronobiology correlates Wednesday with peak synaptic plasticity — optimal for forming new neural connections.' },
  { vedicName: 'Guru Vaar',   planet: 'Jupiter', emoji: '🌟', color: '#fde68a', energy: 'Wisdom, expansion & dharmic action',          science: 'Jupiter\'s magnetic field is 20,000× Earth\'s — it acts as our solar system\'s gravitational protector. Vedic science correlates Jupiter Day with peak liver function, memory consolidation, and wisdom.' },
  { vedicName: 'Shukra Vaar', planet: 'Venus',   emoji: '💗', color: '#f9a8d4', energy: 'Beauty, creativity & abundance',              science: 'Venus\'s 584-day synodic cycle creates a perfect pentagram when plotted against Earth. Endocrine research links Venus Day with peak creative hormone cycles and heightened aesthetic sensitivity.' },
  { vedicName: 'Shani Vaar',  planet: 'Saturn',  emoji: '🪐', color: '#a5b4fc', energy: 'Discipline, karma & enduring effort',         science: 'Saturn\'s 29.5-year orbit mirrors the human biological "Saturn Return" — documented hormonal restructuring at ages 28–30 and 58–60. Its ringed electromagnetic field affects Earth\'s ionosphere.' },
];

// ── Tithis ───────────────────────────────────────────────────────────────────
export const TITHI_NAMES = ['','Pratipada','Dwitiya','Tritiya','Chaturthi','Panchami','Shashthi','Saptami','Ashtami','Navami','Dashami','Ekadashi','Dwadashi','Trayodashi','Chaturdashi','Purnima'];
export const TITHI_ORDINALS = ['','First','Second','Third','Fourth','Fifth','Sixth','Seventh','Eighth','Ninth','Tenth','Eleventh','Twelfth','Thirteenth','Fourteenth','Full Moon'];
export const ENGLISH_DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

export const TITHI_ENERGY: Record<string, string> = {
  Pratipada:    'New beginnings & fresh intentions',
  Dwitiya:      'Building on new foundations',
  Tritiya:      'Growth & creative momentum',
  Chaturthi:    'Remove obstacles — pray to Ganesha',
  Panchami:     'Knowledge, learning & intellect',
  Shashthi:     'Health & vitality rituals',
  Saptami:      'Sun worship & decisive action',
  Ashtami:      'Durga energy — courage & transformation',
  Navami:       'Ancestral blessings & devotion',
  Dashami:      'Dharmic deeds & charity',
  Ekadashi:     'Fasting, spiritual detox & clarity',
  Dwadashi:     'Vishnu worship & service to others',
  Trayodashi:   'Kama — desire, joy & prosperity',
  Chaturdashi:  'Shiva energy — release & dissolve',
  Purnima:      'Full Moon — gratitude & celebration',
  Amavasya:     'New Moon — set clear intentions',
};

export const TITHI_DEITY: Record<string, string> = {
  Pratipada: 'Agni · Fire God', Dwitiya: 'Brahma · Creator', Tritiya: 'Gauri · Goddess',
  Chaturthi: 'Ganesha · Remover of Obstacles', Panchami: 'Naga · Serpent Wisdom',
  Shashthi: 'Kartikeya · God of War', Saptami: 'Surya · Sun God',
  Ashtami: 'Durga · Divine Mother', Navami: 'Durga · Power', Dashami: 'Yama · Dharma',
  Ekadashi: 'Vishnu · Preserver', Dwadashi: 'Vishnu · Protector',
  Trayodashi: 'Kama · Desire', Chaturdashi: 'Shiva · Destroyer',
  Purnima: 'Chandra · Moon God', Amavasya: 'Ancestors · Pitru',
};

// ── Moon rituals ─────────────────────────────────────────────────────────────
export const MOON_RITUALS: Record<string, { prompt: string; action: string }> = {
  '🌑': { prompt: 'New Moon energy',         action: 'Write one clear intention. Plant your seed of desire today.' },
  '🌒': { prompt: 'Waxing Crescent energy',  action: 'Take the very first small step. Start before you feel ready.' },
  '🌓': { prompt: 'First Quarter energy',    action: 'Push through resistance. Decide and commit — no more hesitation.' },
  '🌔': { prompt: 'Waxing Gibbous energy',   action: 'Refine your effort. You\'re close — adjust and keep momentum.' },
  '🌕': { prompt: 'Full Moon energy',        action: 'Express gratitude out loud. Journal what you\'re releasing.' },
  '🌖': { prompt: 'Waning Gibbous energy',   action: 'Share what you\'ve learned. Give generously to someone today.' },
  '🌗': { prompt: 'Last Quarter energy',     action: 'Forgive one thing. Clear mental clutter — delete, unfollow, let go.' },
  '🌘': { prompt: 'Waning Crescent energy',  action: 'Rest deeply. Recharge. The next cycle begins very soon.' },
};

export const VAAR_ACTIONS: string[] = [
  'Spend 10 min in sunlight. Set one bold, visible goal today.',
  'Journal your feelings. Trust your first instinct on a decision.',
  'Do the one hard thing you\'ve been avoiding. Start it now.',
  'Write, call, or send that message. Communicate something important.',
  'Read something that challenges you. Teach or mentor someone today.',
  'Create something — cook, paint, write, arrange. Connect with beauty.',
  'Tackle your most disciplined, long-term task. No shortcuts today.',
];

// ── Vedic months ─────────────────────────────────────────────────────────────
export const RASHI_TO_VEDIC_MONTH = [
  { name: 'Chaitra',      sanskrit: 'चैत्र',       rashi: 'Mesha',     en: 'Mar–Apr', season: 'New Year — Ugadi and Chaitra Navratri' },
  { name: 'Vaishakha',    sanskrit: 'वैशाख',       rashi: 'Vrishabha', en: 'Apr–May', season: 'Late spring — Agni season begins' },
  { name: 'Jyeshtha',     sanskrit: 'ज्येष्ठ',     rashi: 'Mithuna',   en: 'May–Jun', season: 'Peak summer — maximum solar energy' },
  { name: 'Ashadha',      sanskrit: 'आषाढ़',       rashi: 'Karka',     en: 'Jun–Jul', season: 'Monsoon approach — heat transitions' },
  { name: 'Shravana',     sanskrit: 'श्रावण',      rashi: 'Simha',     en: 'Jul–Aug', season: 'Full monsoon — Vishnu\'s sacred month' },
  { name: 'Bhadrapada',   sanskrit: 'भाद्रपद',     rashi: 'Kanya',     en: 'Aug–Sep', season: 'Late monsoon — Ganesha festival' },
  { name: 'Ashwin',       sanskrit: 'आश्विन',      rashi: 'Tula',      en: 'Sep–Oct', season: 'Autumn begins — Navaratri season' },
  { name: 'Kartik',       sanskrit: 'कार्तिक',     rashi: 'Vrischika', en: 'Oct–Nov', season: 'Post-monsoon — Diwali, sacred month' },
  { name: 'Margashirsha', sanskrit: 'मार्गशीर्ष',  rashi: 'Dhanu',     en: 'Nov–Dec', season: 'Early winter — Gita Jayanti month' },
  { name: 'Pausha',       sanskrit: 'पौष',         rashi: 'Makara',    en: 'Dec–Jan', season: 'Deep winter — retreat and reflection' },
  { name: 'Magha',        sanskrit: 'माघ',         rashi: 'Kumbha',    en: 'Jan–Feb', season: 'Makar Sankranti — solar return begins' },
  { name: 'Phalguna',     sanskrit: 'फाल्गुन',     rashi: 'Meena',     en: 'Feb–Mar', season: 'Spring arrives — Holi festival' },
];

export const SCORE_META: Record<number, { label: string; color: string; emoji: string; desc: string }> = {
  1:  { label: 'Challenging',  color: '#f43f5e', emoji: '🌧️', desc: 'Rest, retreat inward, avoid major launches' },
  2:  { label: 'Challenging',  color: '#f43f5e', emoji: '🌧️', desc: 'Caution and patience are your best tools today' },
  3:  { label: 'Mixed',        color: '#fb923c', emoji: '⛅',  desc: 'Proceed carefully — some friction present' },
  4:  { label: 'Mixed',        color: '#fb923c', emoji: '⛅',  desc: 'Mixed cosmic signals — stay grounded' },
  5:  { label: 'Steady',       color: '#fbbf24', emoji: '🌤️', desc: 'A neutral, workable day — steady effort rewarded' },
  6:  { label: 'Favorable',    color: '#34d399', emoji: '✨',  desc: 'Good alignment — move on things that matter' },
  7:  { label: 'Favorable',    color: '#34d399', emoji: '✨',  desc: 'Strong cosmic backing — act with confidence' },
  8:  { label: 'Excellent',    color: '#10b981', emoji: '🌟',  desc: 'Excellent energy — begin what you\'ve been planning' },
  9:  { label: 'Excellent',    color: '#10b981', emoji: '🌟',  desc: 'Peak conditions — rare and powerful alignment' },
  10: { label: 'Cosmic Peak',  color: '#a78bfa', emoji: '⚡',  desc: 'Maximum cosmic resonance — once-in-weeks alignment' },
};

// ── Calculation functions ────────────────────────────────────────────────────
export function getMoonPhase(date: Date = new Date()): {
  emoji: string; name: string; illumination: number; paksha: string; tithiNum: number;
} {
  const KNOWN_NEW_MOON = new Date('2000-01-06T18:14:00Z').getTime();
  const CYCLE = 29.53058867;
  const ageRaw = (date.getTime() - KNOWN_NEW_MOON) / (1000 * 60 * 60 * 24);
  const age = ((ageRaw % CYCLE) + CYCLE) % CYCLE;
  const illum = Math.round((1 - Math.cos((age / CYCLE) * 2 * Math.PI)) / 2 * 100);
  const waxing = age < CYCLE / 2;
  const tithiNum = Math.min(30, Math.floor((age / CYCLE) * 30) + 1);
  const paksha = tithiNum <= 15 ? 'Shukla' : 'Krishna';
  if (illum >= 98) return { emoji: '🌕', name: 'Full Moon',         illumination: illum, paksha, tithiNum };
  if (illum <= 2)  return { emoji: '🌑', name: 'New Moon',          illumination: illum, paksha, tithiNum };
  if (illum < 45)  return { emoji: waxing ? '🌒' : '🌘', name: waxing ? 'Waxing Crescent' : 'Waning Crescent', illumination: illum, paksha, tithiNum };
  if (illum < 55)  return { emoji: waxing ? '🌓' : '🌗', name: waxing ? 'First Quarter'   : 'Last Quarter',    illumination: illum, paksha, tithiNum };
  return              { emoji: waxing ? '🌔' : '🌖', name: waxing ? 'Waxing Gibbous'  : 'Waning Gibbous',  illumination: illum, paksha, tithiNum };
}

export function getPanchangData(date: Date = new Date()) {
  const CYCLE = 29.53058867;
  const r = (x: number) => x * Math.PI / 180;
  const dJ2000 = (date.getTime() - 946728000000) / 86400000;

  const Ldeg = (280.460 + 0.9856474 * dJ2000) % 360;
  const gdeg = (357.528 + 0.9856003 * dJ2000) % 360;
  const sunTropical = ((Ldeg + 1.915 * Math.sin(r(gdeg)) + 0.020 * Math.sin(r(2 * gdeg))) % 360 + 360) % 360;

  const L0 = 218.3165 + 13.1763966 * dJ2000;
  const M  = 357.5291 + 0.9856003  * dJ2000;
  const Mp = 134.9634 + 13.0649930 * dJ2000;
  const D  = 297.8502 + 12.1907180 * dJ2000;
  const F  = 93.2721  + 13.2293705 * dJ2000;
  const moonTropical = ((
    L0
    + 6.2886 * Math.sin(r(Mp))
    + 1.2740 * Math.sin(r(2 * D - Mp))
    + 0.6583 * Math.sin(r(2 * D))
    + 0.2136 * Math.sin(r(2 * Mp))
    - 0.1851 * Math.sin(r(M))
    - 0.1143 * Math.sin(r(2 * F))
    + 0.0588 * Math.sin(r(2 * D - 2 * Mp))
    + 0.0572 * Math.sin(r(2 * D - M - Mp))
    + 0.0533 * Math.sin(r(2 * D + Mp))
  ) % 360 + 360) % 360;

  const ayanamsha = 23.8526 + 0.013972 * (dJ2000 / 365.25);
  const moonLong = ((moonTropical - ayanamsha) % 360 + 360) % 360;
  const sunLong  = ((sunTropical  - ayanamsha) % 360 + 360) % 360;

  const elongation = ((moonTropical - sunTropical) % 360 + 360) % 360;
  const moonAge    = (elongation / 360) * CYCLE;
  const tithiNum   = Math.min(30, Math.floor(elongation / 12) + 1);
  const paksha     = tithiNum <= 15 ? 'Shukla' : 'Krishna';
  const tithiInPaksha = tithiNum <= 15 ? tithiNum : tithiNum - 15;
  const tithiName  = tithiInPaksha === 15
    ? (paksha === 'Shukla' ? 'Purnima' : 'Amavasya')
    : (TITHI_NAMES[tithiInPaksha] ?? String(tithiInPaksha));

  const nakshatraIdx = Math.min(26, Math.floor(moonLong / (360 / 27)));
  const yogaLong = ((sunLong + moonLong) % 360 + 360) % 360;
  const yogaIdx  = Math.min(26, Math.floor(yogaLong / (360 / 27)));
  const vaarIdx = date.getDay();

  return { tithiName, tithiInPaksha, paksha, nakshatraIdx, yogaIdx, vaarIdx, moonAge, moonLong, sunLong };
}

export function getVedicMonth(date: Date = new Date(), lat?: number) {
  const dJ2000 = (date.getTime() - 946728000000) / 86400000;
  const Ldeg = (280.460 + 0.9856474 * dJ2000) % 360;
  const gdeg = (357.528 + 0.9856003 * dJ2000) % 360;
  const gRad = gdeg * Math.PI / 180;
  const sunTropical = ((Ldeg + 1.915 * Math.sin(gRad) + 0.020 * Math.sin(2 * gRad)) % 360 + 360) % 360;
  const ayanamsha   = 23.85 + 0.0136 * (dJ2000 / 365.25);
  const siderealSun = ((sunTropical - ayanamsha) % 360 + 360) % 360;
  const KNOWN_NEW_MOON_MS = new Date('2000-01-06T18:14:00Z').getTime();
  const CYCLE    = 29.53058867;
  const moonAge  = ((((date.getTime() - KNOWN_NEW_MOON_MS) / 86400000) % CYCLE) + CYCLE) % CYCLE;
  
  const daysToClosingAmavasya = CYCLE - moonAge;
  const sunAtClosingAmavasya = ((siderealSun + daysToClosingAmavasya * 0.9856) % 360 + 360) % 360;
  const rashiEnd = Math.floor(sunAtClosingAmavasya / 30) % 12;
  
  const daysSinceLastAmavasya = moonAge;
  const sunAtLastAmavasya = ((siderealSun - daysSinceLastAmavasya * 0.9856) % 360 + 360) % 360;
  const rashiStart = Math.floor(sunAtLastAmavasya / 30) % 12;

  const isAdhik = rashiStart === rashiEnd;
  const amavasyantMonthIdx = isAdhik ? (rashiStart + 1) % 12 : rashiEnd;
  
  // Purnimanta convention: Krishna Paksha belongs to the NEXT month
  // Most Indian festivals (like Janmashtami, Diwali) use Purnimanta month names for Krishna Paksha.
  const isKrishna = moonAge > 14.765294; 
  const purnimantaMonthIdx = isKrishna ? (amavasyantMonthIdx + 1) % 12 : amavasyantMonthIdx;
  
  const baseMonth = RASHI_TO_VEDIC_MONTH[purnimantaMonthIdx]!;
  // Keep original index for season logic so seasons don't drift
  const baseMonthIdx = amavasyantMonthIdx;

  // Shift season by 6 months if in Southern Hemisphere
  const isSouthern = typeof lat === 'number' && lat < 0;
  const seasonIdx = isSouthern ? (baseMonthIdx + 6) % 12 : baseMonthIdx;
  const season = RASHI_TO_VEDIC_MONTH[seasonIdx]!.season;

  if (isAdhik) {
    return {
      ...baseMonth,
      name: `Adhik ${baseMonth.name}`,
      season,
    };
  }
  return { ...baseMonth, season };
}

// ── Binary Search Timings ──────────────────────────────────────────────────
function findBoundary(baseDate: Date, getVal: (d: Date) => number, stepHours: number, condition: (v1: number, v2: number) => boolean) {
  let d1 = new Date(baseDate.getTime());
  let d2 = new Date(baseDate.getTime() + stepHours * 3600000);
  let v1 = getVal(d1);
  let v2 = getVal(d2);
  
  let steps = 0;
  while (!condition(v1, v2) && steps < 150) {
    d1 = d2;
    v1 = v2;
    d2 = new Date(d1.getTime() + stepHours * 3600000);
    v2 = getVal(d2);
    steps++;
  }
  
  if (steps >= 150) return null;
  
  for (let i = 0; i < 15; i++) {
    const mid = new Date((d1.getTime() + d2.getTime()) / 2);
    const vMid = getVal(mid);
    if (condition(v1, vMid)) {
      d2 = mid;
      v2 = vMid;
    } else {
      d1 = mid;
      v1 = vMid;
    }
  }
  return d1;
}

export function getExactTimings(date: Date = new Date()) {
  const getTithiIdx = (d: Date) => Math.floor(getPanchangData(d).moonAge / (29.53058867 / 30));
  const tithiStart = findBoundary(date, getTithiIdx, -3, (v1, v2) => v1 !== v2);
  const tithiEnd = findBoundary(date, getTithiIdx, 3, (v1, v2) => v1 !== v2);

  const getNakshatraIdx = (d: Date) => getPanchangData(d).nakshatraIdx;
  const nakshatraStart = findBoundary(date, getNakshatraIdx, -3, (v1, v2) => v1 !== v2);
  const nakshatraEnd = findBoundary(date, getNakshatraIdx, 3, (v1, v2) => v1 !== v2);

  const getYogaIdx = (d: Date) => getPanchangData(d).yogaIdx;
  const yogaStart = findBoundary(date, getYogaIdx, -3, (v1, v2) => v1 !== v2);
  const yogaEnd = findBoundary(date, getYogaIdx, 3, (v1, v2) => v1 !== v2);

  const getRashiIdx = (d: Date) => Math.floor(getPanchangData(d).sunLong / 30);
  const maasStart = findBoundary(date, getRashiIdx, -24, (v1, v2) => v1 !== v2);
  const maasEnd = findBoundary(date, getRashiIdx, 24, (v1, v2) => v1 !== v2);

  return { tithiStart, tithiEnd, nakshatraStart, nakshatraEnd, yogaStart, yogaEnd, maasStart, maasEnd };
}

export function getNextLunarEvents() {
  const KNOWN_NEW_MOON_MS = new Date('2000-01-06T18:14:00Z').getTime();
  const CYCLE = 29.53058867;
  const HALF  = CYCLE / 2;
  const now   = new Date();
  const age   = (((now.getTime() - KNOWN_NEW_MOON_MS) / 86400000) % CYCLE + CYCLE) % CYCLE;
  const illum = Math.round((1 - Math.cos((age / CYCLE) * 2 * Math.PI)) / 2 * 100);
  const isFullToday = illum >= 97;
  const isNewToday  = illum <= 3;
  let daysToFull = HALF - age;
  if (daysToFull <= 0) daysToFull += CYCLE;
  if (isFullToday) daysToFull = 0;
  let daysToNew = CYCLE - age;
  if (daysToNew >= CYCLE) daysToNew = 0;
  if (isNewToday) daysToNew = 0;
  const fmtS: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const fmtL: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' };
  const fullDate = new Date(now.getTime() + daysToFull * 86400000);
  const newDate  = new Date(now.getTime() + daysToNew  * 86400000);
  return {
    daysToFull: Math.round(daysToFull),
    daysToNew:  Math.round(daysToNew),
    fullDateStr:  fullDate.toLocaleDateString('en-US', fmtS),
    newDateStr:   newDate.toLocaleDateString('en-US', fmtS),
    fullDateLong: fullDate.toLocaleDateString('en-US', fmtL),
    newDateLong:  newDate.toLocaleDateString('en-US', fmtL),
    isFullToday, isNewToday,
  };
}

export function getCosmicScore(yogaAuspicious: boolean, moonEmoji: string, tithiName: string): number {
  let score = 5;
  if (yogaAuspicious) score += 2; else score -= 1;
  if (moonEmoji === '🌕' || moonEmoji === '🌑') score += 2;
  else if (moonEmoji === '🌓' || moonEmoji === '🌗') score += 1;
  else score += 1;
  if (tithiName === 'Ekadashi' || tithiName === 'Purnima') score += 1;
  if (tithiName === 'Ashtami' || tithiName === 'Chaturdashi') score -= 1;
  return Math.max(1, Math.min(10, score));
}

// ── Festivals ───────────────────────────────────────────────────────────────
export type Festival = {
  name: string;
  type: 'hindu' | 'christian' | 'global' | 'buddhist' | 'jain' | 'muslim' | 'jewish';
  year?: number; // For specific year hardcoded dates
  month?: number; // 1-12
  day?: number; // 1-31
  vMonth?: string;
  tithi?: string;
  paksha?: 'Shukla' | 'Krishna';
  emoji: string;
  desc: string;
  scienceDesc?: string;
  culturalDesc?: string;   // Cultural traditions, rituals, and customs
  philosophicalDesc?: string; // Philosophical and spiritual significance
};

export const FESTIVALS: Festival[] = [
  // Hindu / Cosmic
  { name: 'Diwali / Deepawali', type: 'hindu', vMonth: 'Kartik', tithi: 'Amavasya', emoji: '🪔', desc: 'Festival of Lights. Triumph of light over darkness.',
    scienceDesc: 'Marks the darkest new moon of autumn. Lighting lamps is an ancient method to sanitize the air post-monsoon and align human circadian rhythms with the changing season.',
    culturalDesc: 'Homes are decorated with clay lamps (diyas), rangoli patterns, and marigold flowers. Families exchange sweets and gifts. Lakshmi Puja is performed at night for prosperity. Fireworks illuminate the sky as a communal celebration of joy and togetherness.',
    philosophicalDesc: 'Diwali symbolizes the victory of inner light over the darkness of ignorance. The lighting of diyas is a metaphor: just as one lamp can illuminate a dark room, one awakened soul can transform those around them. It is a reminder to cultivate your inner flame of consciousness.' },
  { name: 'Dussehra / Vijayadashami', type: 'hindu', vMonth: 'Ashwin', tithi: 'Dashami', paksha: 'Shukla', emoji: '🏹', desc: 'Victory of good over evil.',
    scienceDesc: 'Signals the end of the monsoon and the preparation for the winter harvest. The cooling atmosphere calms the Pitta dosha in the body.',
    culturalDesc: 'Giant effigies of Ravana, Kumbhakarna, and Meghnada are burned. Ram Leela plays enact the Ramayana. Weapons and tools are worshipped (Ayudha Puja). Communities gather for processions, fairs, and feasting.',
    philosophicalDesc: 'Vijayadashami celebrates the conquest of the higher self (Ram) over the ego and its ten heads (Ravana) — representing the ten vices: lust, pride, anger, greed, infatuation, ego, jealousy, selfishness, injustice, and cruelty. True victory is always internal.' },
  { name: 'Maha Shivaratri', type: 'hindu', vMonth: 'Phalguna', tithi: 'Chaturdashi', paksha: 'Krishna', emoji: '🔱', desc: 'The Great Night of Shiva.',
    scienceDesc: 'Occurs on the darkest night before the new moon in late winter. The planetary positions induce a natural upsurge of energy in the human spine, making staying awake biologically beneficial.',
    culturalDesc: 'Devotees fast, chant the Shiva Panchakshara mantra (Om Namah Shivaya), visit Shiva temples, and perform Abhishekam (ritual bathing) of the Shivalingam with milk, honey, and water. All-night vigils with bhajans are held.',
    philosophicalDesc: 'Maha Shivaratri represents the night when Shiva, the embodiment of consciousness, performed the Tandava — the cosmic dance of creation and destruction. Staying awake is a practice of transcending the unconscious (tamas). Shiva is the formless awareness within us all.' },
  { name: 'Holi', type: 'hindu', vMonth: 'Phalguna', tithi: 'Purnima', emoji: '🎨', desc: 'Festival of Colors. Arrival of spring.',
    scienceDesc: 'Celebrated on the spring full moon. The transition from winter to spring causes Kapha dosha imbalances; the natural colored powders and bonfires originally served medicinal and purifying purposes.',
    culturalDesc: 'Holika Dahan (bonfire) is lit on the eve to burn away evil. The next day, people play with colored powders and water, visit friends, and share sweets like gujiya and thandai. Social barriers dissolve as everyone plays together.',
    philosophicalDesc: 'Holi celebrates the story of Prahlada — the devotee who could not be burned by fire because of his pure devotion. The colors represent the vibrant diversity of creation and the joy of being alive. It teaches that divine love is the most powerful force in existence.' },
  { name: 'Ganesh Chaturthi', type: 'hindu', vMonth: 'Bhadrapada', tithi: 'Chaturthi', paksha: 'Shukla', emoji: '🏵️', desc: 'Birth of Lord Ganesha.',
    scienceDesc: 'Marks the late monsoon phase. Traditional clay idols immersed in rivers served to purify and mineralize water bodies post-rains.',
    culturalDesc: 'Clay Ganesha idols are installed at home and in public pandals for 1 to 10 days. Daily puja, bhajans, and prasad offerings are made. The festival concludes with Ganesh Visarjan — processions carry idols to water for immersion.',
    philosophicalDesc: 'Ganesha, with an elephant head and human body, represents the fusion of cosmic intelligence (the vast mind of the elephant) with human will. His large ears mean: listen more than you speak. His curved trunk means: discriminate between the real and the unreal. He is the remover of ego-obstacles.' },
  { name: 'Rama Navami', type: 'hindu', vMonth: 'Chaitra', tithi: 'Navami', paksha: 'Shukla', emoji: '🕉️', desc: 'Birth of Lord Rama.',
    scienceDesc: 'Coincides with the peak of spring. Dietary restrictions (fasting) during this period scientifically prepare the digestive system for the intense summer heat.',
    culturalDesc: 'Temples are beautifully decorated. The Ramayana is chanted and sung continuously (Akhand Ramayan). Devotees fast and break it with prasad at noon — the birth hour of Rama. Chariot processions (Rath Yatras) fill the streets.',
    philosophicalDesc: 'Rama is the ideal of Dharma incarnate — the maryada purushottama (the highest ideal of a human being). His life story is a roadmap for living with integrity, courage, and compassion even under extreme difficulty. Ram Rajya symbolizes a world governed by righteousness.' },
  { name: 'Krishna Janmashtami', type: 'hindu', vMonth: 'Bhadrapada', tithi: 'Ashtami', paksha: 'Krishna', emoji: '🦚', desc: 'Birth of Lord Krishna.',
    scienceDesc: 'Celebrated on the 8th waning moon during peak monsoon. Midnight fasting and alignment with lunar phases helps detoxify the body during high humidity.',
    culturalDesc: 'All-night vigil with bhajans and kirtans. Dahi Handi (breaking of a clay pot of yogurt) is performed the next day. Cradles of the infant Krishna are decorated. The Bhagavad Gita is recited. Homes are decorated with footprints symbolizing Krishna entering.',
    philosophicalDesc: 'Krishna is born at midnight — in the darkest moment — symbolizing that divine light emerges from the deepest darkness. He is the teacher of the Bhagavad Gita, teaching that action without ego-attachment is the highest form of worship. His flute calls the soul back to its source.' },
  { name: 'Raksha Bandhan', type: 'hindu', vMonth: 'Shravana', tithi: 'Purnima', emoji: '🧿', desc: 'Bond of protection between siblings.',
    scienceDesc: 'A monsoon full-moon festival. Originally tied to agricultural cycles where communities bound threads to invoke protection against water-borne diseases and bad harvests.',
    culturalDesc: 'Sisters tie a sacred thread (rakhi) on brothers\' wrists, perform aarti, and feed sweets. Brothers give gifts and pledge protection. The bond extends beyond blood — teachers tie rakhis on students, and communities on leaders.',
    philosophicalDesc: 'The thread is more than a symbol — it is an energetic cord of protection woven from love and intention. Raksha Bandhan teaches that we are bound to each other not by birth alone but by the sacred duty of care. True protection is the willingness to stand for another\'s highest good.' },
  { name: 'Makar Sankranti', type: 'hindu', month: 1, day: 14, emoji: '🪁', desc: 'Sun transitions into Makara (Capricorn).',
    scienceDesc: 'A purely astronomical event marking the Winter Solstice (Sun moving north). Sun exposure via kite flying helps synthesize Vitamin D in peak winter.',
    culturalDesc: 'Kites fill the skies as families gather on rooftops. Sesame and jaggery (til-gul) sweets are exchanged with the saying: eat sweet, speak sweet. Sacred baths in rivers (especially the Ganga-Yamuna-Saraswati confluence) are taken. Harvest offerings are made.',
    philosophicalDesc: 'Makar Sankranti marks Uttarayana — the Sun\'s northward journey, a period considered most auspicious for spiritual practice. The Bhagavad Gita says those who die during Uttarayana attain liberation. It is a reminder that like the sun, we must always move towards higher consciousness.' },
  { name: 'Navaratri Begins', type: 'hindu', vMonth: 'Ashwin', tithi: 'Pratipada', paksha: 'Shukla', emoji: '🌺', desc: 'Nine nights honoring the Divine Mother.',
    scienceDesc: 'Aligns with the equinox. The 9-day fasting resets the gut microbiome during the drastic climatic shift between summer and winter.',
    culturalDesc: 'Nine forms of Devi (Durga, Lakshmi, Saraswati) are worshipped. Garba and Dandiya dances are performed each night. Fasting, prayers, and readings of Devi Mahatmya (Durga Saptashati) are observed. Each day has a different color to wear.',
    philosophicalDesc: 'Navaratri represents a battle between the divine feminine Shakti and the forces of ego-darkness (represented by the buffalo demon Mahishasura). The nine nights mirror the nine stages of sadhana (spiritual practice): purification, concentration, meditation, contemplation, devotion, surrender, ecstasy, expansion, and liberation.' },
  { name: 'Hanuman Jayanti', type: 'hindu', vMonth: 'Chaitra', tithi: 'Purnima', emoji: '🐒', desc: 'Birth of Lord Hanuman.',
    scienceDesc: 'Spring full moon phase. The emphasis on breathwork (Pranayama) and strength honors the vital life-force energy (Prana) surging in nature.',
    culturalDesc: 'Hanuman temples are thronged with devotees. The Hanuman Chalisa (40 verses) is recited continuously. Sindoor (vermillion) and oil are offered. Processions carry Hanuman idols. Wrestlers and gymnasts offer their strength to Hanuman.',
    philosophicalDesc: 'Hanuman represents the perfection of selfless service (Seva), devotion (Bhakti), and the power of a controlled mind (Chitta). His flight to Lanka with the mountain of healing herbs shows that when devotion is complete, the impossible becomes effortless. He reminds us: our greatest strength lies in surrender to the divine.' },
  { name: 'Guru Purnima', type: 'hindu', vMonth: 'Ashadha', tithi: 'Purnima', emoji: '🌕', desc: 'Honoring spiritual teachers and wisdom.',
    scienceDesc: 'Occurs on the first full moon after the summer solstice, marking the start of the monsoon. A time traditionally dedicated to deep study and inner reflection.',
    culturalDesc: 'Disciples visit their Guru, offer reverence, and receive blessings. Spiritual discourses, meditation camps, and chanting of Guru Stotras are held. In yoga traditions, this day honors Adiyogi (Shiva) as the first Guru who transmitted the science of yoga.',
    philosophicalDesc: 'The word Guru means \'one who dispels darkness (Gu = darkness, Ru = dispeller)\'. Guru Purnima is dedicated to Veda Vyasa, who compiled the Vedas and wrote the Mahabharata — gifting humanity the map of dharma. A true Guru does not create followers; they create more Gurus. The full moon on this day is a metaphor: the Guru, like the moon, does not generate its own light — it reflects the light of the sun (universal consciousness).' },
  { name: 'Sharad Purnima', type: 'hindu', vMonth: 'Ashwin', tithi: 'Purnima', emoji: '🎑', desc: 'Harvest festival on the autumn full moon.',
    scienceDesc: 'The moon is closest to Earth on this night. The cooling lunar rays are believed to infuse crops and medicinal herbs with healing properties.',
    culturalDesc: 'Kheer (rice pudding) is prepared and left in moonlight overnight to absorb lunar rays, then consumed as prasad. Families sit under the open sky and celebrate the harvest. Songs and dances are performed in moonlight.',
    philosophicalDesc: 'Sharad Purnima is called Kojagari — meaning \'who is awake?\' Legend holds that Lakshmi descends to Earth on this night asking this question, rewarding those who are spiritually awake and vigilant. It is a reminder that abundance flows to those who are conscious and present.' },
  { name: 'Gudi Padwa', type: 'hindu', vMonth: 'Chaitra', tithi: 'Pratipada', paksha: 'Shukla', emoji: '🚩', desc: 'Traditional New Year for Maharashtrians and Konkanis.',
    scienceDesc: 'Marks the onset of spring and the harvest of Rabi crops. Eating neem and jaggery on this day prepares the immune system for the transition to summer.',
    culturalDesc: 'A decorated bamboo pole (Gudi) is erected outside homes with a bright cloth, neem leaves, mango leaves, and an inverted pot on top — symbolizing victory and good fortune. New clothes are worn, homes are cleaned, and special dishes like Puran Poli are made.',
    philosophicalDesc: 'Gudi Padwa marks the day Brahma created the universe — the very beginning of cosmic time. Erecting the Gudi is an act of claiming one\'s rightful space in creation and declaring readiness to receive abundance. It celebrates beginnings — an invitation to start fresh, aligned with the renewal of nature.' },

  // Buddhist & Jain
  { name: 'Vesak (Buddha Purnima)', type: 'buddhist', vMonth: 'Vaishakha', tithi: 'Purnima', emoji: '🧘', desc: 'Birth, enlightenment, and death of Gautama Buddha.',
    scienceDesc: 'Occurs on the spring full moon, a period of heightened geomagnetic activity ideal for deep meditation and energetic sensitivity.',
    culturalDesc: 'Monasteries are illuminated with lanterns and candles. Monks lead meditation retreats and teachings. Devotees release caged birds and animals as acts of compassion. Vegetarian meals are shared. Dana (charitable giving) is practiced abundantly.',
    philosophicalDesc: 'Three supreme events occurred on the same full moon: the birth, enlightenment, and Parinirvana of the Buddha. This is no coincidence — it reveals that the same cosmic moment holds the seed of liberation. The Buddha\'s message: suffering arises from craving; the path out is the Noble Eightfold Path of mindful living.' },
  { name: 'Mahavir Jayanti', type: 'jain', vMonth: 'Chaitra', tithi: 'Trayodashi', paksha: 'Shukla', emoji: '🕊️', desc: 'Birth of Mahavira, the 24th Tirthankara.',
    scienceDesc: 'Aligns with the spring renewal phase. Fasting and non-violence (Ahimsa) practices during this time reduce ecological footprints and detoxify the body.',
    culturalDesc: 'Processions carry images of Mahavira through streets. Jain temples are beautifully adorned. Prayers, fasting, and readings of Jain scriptures are observed. Charitable acts and animal welfare activities are central to the celebration.',
    philosophicalDesc: 'Mahavira taught the three jewels: Right Knowledge (Samyak Gyan), Right Faith (Samyak Darshan), and Right Conduct (Samyak Charitra). His core teaching — Ahimsa Paramo Dharma (Non-violence is the highest religion) — was not just ethical but a cosmic law: every act of violence disturbs the universe\'s fundamental order.' },

  // Christian / Global
  { name: 'Christmas', type: 'christian', month: 12, day: 25, emoji: '🎄', desc: 'Birth of Jesus Christ.',
    scienceDesc: 'Corresponds closely with the winter solstice, marking the return of longer days and sunlight in the Northern Hemisphere.',
    culturalDesc: 'Homes are decorated with trees, lights, and ornaments. Gifts are exchanged. Carols are sung. Midnight mass is held. Families gather for feasts of roast meats, puddings, and cakes. Santa Claus embodies the spirit of giving.',
    philosophicalDesc: 'Christmas celebrates the incarnation of divine love in human form. Christ\'s birth in a humble manger teaches that the sacred does not require grandeur — it reveals itself in the most ordinary moments. The star of Bethlehem points to what all true seekers follow: an inner light that guides them home.' },
  { name: 'Halloween', type: 'christian', month: 10, day: 31, emoji: '🎃', desc: 'All Hallows\' Eve.',
    scienceDesc: 'Historically marks the end of the harvest season and the beginning of winter, acknowledging the seasonal death of vegetation.' },
  { name: 'New Year', type: 'global', month: 1, day: 1, emoji: '🎆', desc: 'Gregorian New Year.',
    scienceDesc: 'A civil calendar milestone for psychological reset and intention setting.',
    culturalDesc: 'Fireworks fill the sky at midnight worldwide. Resolutions are made, glasses clinked, and families reunite. Each culture has its unique traditions: eating twelve grapes in Spain, writing intentions on lanterns in Asia, polar bear dips in Canada.',
    philosophicalDesc: 'The New Year is humanity\'s collective ritual of renewal. It marks a threshold — a moment between what was and what could be. Every midnight of January 1st is a collective reset: an invitation to consciously choose who you want to become in the next chapter of your life.' },
  { name: 'Valentine\'s Day', type: 'global', month: 2, day: 14, emoji: '💝', desc: 'Day of love and affection.',
    scienceDesc: 'Coincides with early spring in many regions, a biological period of renewal and social bonding.' },
  { name: 'Earth Day', type: 'global', month: 4, day: 22, emoji: '🌍', desc: 'Honoring our planet and environment.',
    scienceDesc: 'A modern global observance emphasizing environmental conservation and ecological harmony.',
    culturalDesc: 'Community cleanups, tree plantings, environmental fairs, and educational events take place globally. Schools teach ecological awareness. Governments announce environmental commitments.',
    philosophicalDesc: 'Earth Day reconnects us with Bhumi Devi — the Earth Mother. Every ancient tradition understood the Earth as sacred and alive. Modern ecology is rediscovering what indigenous wisdom always knew: we do not own the Earth; we belong to it. Caring for the Earth is a form of self-care.' },

  // Muslim (2026 Dates)
  { name: 'Ramadan Begins', type: 'muslim', year: 2026, month: 2, day: 18, emoji: '🌙', desc: 'Month of fasting, prayer, and reflection.',
    scienceDesc: 'A rigorous 30-day intermittent fasting period that triggers autophagy, promoting cellular renewal and deep detoxification.',
    culturalDesc: 'Muslims abstain from food, drink, and worldly pleasures from dawn to sunset. Suhoor (pre-dawn meal) and Iftar (sunset meal) become family rituals. Mosques are filled nightly for Taraweeh prayers. Charity (Zakat) is given generously.',
    philosophicalDesc: 'Ramadan is the month of the Quran — revealed as guidance for humanity. Fasting is not merely physical abstinence but a training of the will, a purification of intention, and a profound act of surrender to the Divine. It teaches that the body is a vessel for the soul, and the soul needs more than bread.' },
  { name: 'Eid al-Fitr', type: 'muslim', year: 2026, month: 3, day: 20, emoji: '🕌', desc: 'Festival of Breaking the Fast.',
    scienceDesc: 'Marks the successful completion of the month-long metabolic reset of Ramadan.',
    culturalDesc: 'New clothes are worn. Eid prayers are offered at mosques. Gifts are given to children. Feasts of biryani, sweets, and savories are shared. Zakat al-Fitr (charity to the poor) ensures everyone can celebrate.',
    philosophicalDesc: 'Eid al-Fitr is not just a celebration of food — it is a celebration of discipline mastered. After 30 days of inner purification, the community emerges renewed. The communal prayer of Eid reminds us that spiritual growth is not a solo journey but a shared human endeavor.' },
  { name: 'Eid al-Adha', type: 'muslim', year: 2026, month: 5, day: 27, emoji: '🕋', desc: 'Feast of the Sacrifice.',
    scienceDesc: 'Coincides with the Hajj pilgrimage, fostering immense global community coherence and charity.' },

  // Jewish (2026 Dates)
  { name: 'Passover (Pesach)', type: 'jewish', year: 2026, month: 4, day: 2, emoji: '🍷', desc: 'Commemorates liberation from slavery.',
    scienceDesc: 'Aligns with the spring equinox. The dietary shift (unleavened bread) historically prevented foodborne illnesses in the shifting season.',
    culturalDesc: 'The Passover Seder meal retells the Exodus story. Matzah (unleavened bread), bitter herbs, and four cups of wine are ritually consumed. Families gather, questions are asked, and freedom is celebrated across generations.',
    philosophicalDesc: 'Passover is the archetype of liberation. The Exodus from Egypt is not just historical but psychological — each person is commanded to see themselves as if they personally left Egypt. Egypt (Mitzrayim) literally means \'narrow place\' — representing the constrictions of the ego. Liberation is always available to those willing to leave their personal Mitzrayim.' },
  { name: 'Yom Kippur', type: 'jewish', year: 2026, month: 9, day: 21, emoji: '🕍', desc: 'Day of Atonement.',
    scienceDesc: 'A strict 25-hour dry fast during the autumn equinox period. Scientifically proven to induce deep cellular repair and reset insulin sensitivity.',
    culturalDesc: 'The holiest day of the Jewish year. A 25-hour complete fast (no food or water). Prayers are held in synagogues throughout the day. White garments are worn symbolizing purity. The day ends with the blowing of the Shofar (ram\'s horn).',
    philosophicalDesc: 'Yom Kippur teaches that forgiveness is not weakness — it is the highest form of strength. Atonement means at-one-ment: returning to wholeness. The tradition holds that on this day, all human beings are judged. The emphasis is not on fear but on the astonishing possibility of a complete reset — that no matter what was done, return is always possible.' },
  { name: 'Hanukkah', type: 'jewish', year: 2026, month: 12, day: 5, emoji: '🕎', desc: 'Festival of Lights.',
    scienceDesc: 'Celebrated near the winter solstice, utilizing the psychological and biological benefits of fire/light during the darkest time of the year.',
    culturalDesc: 'The Menorah (Hanukkiah) is lit for eight nights — one additional candle each night. Latkes (potato pancakes) and sufganiyot (doughnuts) are eaten. Children play with dreidels. Gifts are given and songs are sung.',
    philosophicalDesc: 'Hanukkah celebrates the miracle of the one small jar of oil that lasted eight days — a metaphor for the inextinguishable nature of spiritual light. Even the smallest, purest light cannot be extinguished by the greatest darkness. It only takes one person, one community, one act of courage to rekindle a flame that darkness cannot touch.' }
];

export function getFestivalForDate(date: Date = new Date()): Festival | null {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const y = date.getFullYear();
  const p = getPanchangData(date);
  const vm = getVedicMonth(date);
  
  for (const f of FESTIVALS) {
    if (f.month && f.day) {
      if (f.year && f.year !== y) continue;
      if (f.month === m && f.day === d) return f;
    } else if (f.vMonth && f.tithi) {
      if (vm.name === f.vMonth && p.tithiName === f.tithi) {
        if (!f.paksha || f.paksha === p.paksha) return f;
      }
    }
  }
  return null;
}

export function getUpcomingFestival(startDate: Date = new Date(), maxDays: number = 30): { festival: Festival; days: number; date: Date } | null {
  for (let i = 0; i <= maxDays; i++) {
    const checkDate = new Date(startDate.getTime() + i * 86400000);
    const fest = getFestivalForDate(checkDate);
    if (fest) {
      return { festival: fest, days: i, date: checkDate };
    }
  }
  return null;
}

export function getYearlyFestivals(year: number = new Date().getFullYear()): { festival: Festival; date: Date }[] {
  const results = [];
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const fest = getFestivalForDate(d);
    if (fest) {
      results.push({ festival: fest, date: new Date(d) });
    }
  }
  return results;
}
