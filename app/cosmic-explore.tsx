import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Svg, { Circle as SvgCircle, Path as SvgPath } from 'react-native-svg';

const SCREEN_W = Dimensions.get('window').width;

// ── Data ────────────────────────────────────────────────────────────────────

const NAKSHATRAS = [
  { name: 'Ashwini',           en: 'The Healer',         emoji: '🐴', energy: 'Swift starts & healing energy. Rules the head and upper brain — a day for quick decisions, initiating new treatments, and physical starts. The Ashwini Kumars (twin divine physicians) govern this asterism, lending it restorative electromagnetic frequencies.' },
  { name: 'Bharani',           en: 'The Carrier',        emoji: '⚖️', energy: 'Transformation & endurance. Associated with Yama, the lord of dharma — this nakshatra carries intense creative and destructive force. High sexual vitality, deep karmic processing, and the courage to hold contradictions.' },
  { name: 'Krittika',          en: 'The Flame',          emoji: '🔥', energy: 'Courage, clarity & purification. Ruled by the Sun, aligned with the Pleiades star cluster — one of the most energetically powerful positions. Its fire energy (Agni) cuts through illusion. Best for sharp decisions, truth-telling, and purification.' },
  { name: 'Rohini',            en: 'The Abundant',       emoji: '🌹', energy: 'Growth, beauty & abundance. The most beloved nakshatra — the Moon is exalted here. Aligned with Aldebaran (α Tauri), one of the four royal stars. Maximum lunar fertility and creative magnetism. Ideal for beauty, art, and planting.' },
  { name: 'Mrigashira',        en: 'The Seeker',         emoji: '🦌', energy: 'Curiosity & gentle searching. Aligned with λ Orionis in Orion\'s head — this nakshatra governs the seeking impulse of consciousness. Best for exploration, research, travel, and following your nose toward truth.' },
  { name: 'Ardra',             en: 'The Storm',          emoji: '⛈️', energy: 'Renewal through intensity. Aligned with Betelgeuse (α Orionis), one of the largest stars in our galaxy. Ruled by Rudra (cosmic storm). Disruption that clears — best for deep emotional processing and structural change.' },
  { name: 'Punarvasu',         en: 'Return of Light',    emoji: '🏠', energy: 'Restoration & nourishment. Aligned with Pollux and Castor (Gemini twins). Aditi, the mother of gods, rules this nakshatra of endless renewal. Best for returning home, rebuilding, and receiving nourishment.' },
  { name: 'Pushya',            en: 'The Nourisher',      emoji: '🌸', energy: 'Most auspicious nakshatra — nourish & give. Aligned with δ, γ, θ Cancri. Brihaspati (Jupiter) governs this expansive, generous energy. The cow\'s udder is its symbol — it gives without depletion. Begin anything important today.' },
  { name: 'Ashlesha',          en: 'The Entwiner',       emoji: '🐍', energy: 'Deep insight & hidden wisdom. Aligned with ε, δ, σ, η Hydrae — the serpent constellation. Naga serpent energy governs kundalini, deep psychology, and occult knowledge. Penetrating intelligence, hypnotic presence.' },
  { name: 'Magha',             en: 'The Throne',         emoji: '👑', energy: 'Ancestral power & authority. Aligned with Regulus (α Leonis) — the heart of Leo, one of the four royal stars of ancient astronomy. Pitru (ancestor) energy is at peak. Connect with lineage, exercise authority, and honor your roots.' },
  { name: 'Purva Phalguni',    en: 'The Resting Star',   emoji: '🌺', energy: 'Rest, pleasure & creative flow. Aligned with δ and θ Leonis. Ruled by Bhaga, the god of delight. The hammock is its symbol — rest in abundance, enjoy creativity, sensuality, and artistic expression.' },
  { name: 'Uttara Phalguni',   en: 'The Covenant',       emoji: '🤝', energy: 'Unions, loyalty & commitment. Aligned with Denebola (β Leonis). Aryaman, the god of contracts and patronage, rules this nakshatra. Best for marriage, agreements, partnerships, and long-term commitments.' },
  { name: 'Hasta',             en: 'The Skilled Hand',   emoji: '✋', energy: 'Craft, healing touch & skill. Aligned with the Corvus constellation. The hand is its symbol — manual skill, healing arts, precise work, and craftsmanship reach their peak. Best for surgery, art, and detailed work.' },
  { name: 'Chitra',            en: 'The Brilliant',      emoji: '💎', energy: 'Radiant creativity & achievement. Aligned with Spica (α Virginis) — one of the brightest stars in the sky, used for navigation since antiquity. Vishwakarma, the cosmic architect, rules this nakshatra of brilliant creative achievement.' },
  { name: 'Swati',             en: 'The Independent',    emoji: '🌬️', energy: 'Freedom, flexibility & movement. Aligned with Arcturus (α Boötis) — a fast-moving star. Wind (Vayu) rules this nakshatra of maximum independence, flexibility, and trade. The coral and sword grass are its symbols — bending without breaking.' },
  { name: 'Vishakha',          en: 'The Forked Branch',  emoji: '⚡', energy: 'Ambition, purpose & breakthrough. Aligned with α, β, γ, ι Librae. Indra and Agni jointly rule this nakshatra — peak ambition and breakthrough energy. The gateway or triumphal arch is its symbol — push through obstacles today.' },
  { name: 'Anuradha',          en: 'The Devoted Star',   emoji: '💫', energy: 'Friendship, devotion & success. Aligned with β, δ, π Scorpii. Mitra, the god of friendship and cooperation, rules this nakshatra. Lotus flower is its symbol — bloom through devotion. Best for forging alliances and dedicated effort.' },
  { name: 'Jyeshtha',          en: 'The Eldest',         emoji: '🛡️', energy: 'Power, protection & seniority. Aligned with Antares (α Scorpii) — a massive red supergiant. Indra at his most sovereign rules here. Circular talisman (raksha) is its symbol — protection, authority, and senior leadership.' },
  { name: 'Mula',              en: 'The Root',           emoji: '🌱', energy: 'Core truth & deep foundations. Aligned with the Galactic Center (Sagittarius A*) — the supermassive black hole at the center of our galaxy. Maximum dissolution energy. Go to the root, eliminate what is false, discover the foundation.' },
  { name: 'Purva Ashadha',     en: 'The Undefeated',     emoji: '🌊', energy: 'Strength, purification & victory. Aligned with δ and ε Sagittarii. Apas, the water goddess, rules this nakshatra of purification and invincibility. Fan and winnowing basket are its symbols — separate the essential from the non-essential.' },
  { name: 'Uttara Ashadha',    en: 'The Universal',      emoji: '🌟', energy: 'Universal truth & final success. Aligned with σ and ζ Sagittarii. The Vishvadevas (universal gods) rule this nakshatra of lasting victory and cosmic truth. The elephant\'s tusk is its symbol — penetrating, unstoppable wisdom.' },
  { name: 'Shravana',          en: 'The Listener',       emoji: '👂', energy: 'Learning, listening & connection. Aligned with Altair (α Aquilae). Vishnu in his all-pervading aspect rules this nakshatra of deep listening. Three footsteps are its symbol (Trivikrama) — encompassing all dimensions through listening.' },
  { name: 'Dhanishtha',        en: 'The Richest',        emoji: '🥁', energy: 'Wealth, music & cosmic rhythm. Aligned with α, β, γ, δ Delphini. The Eight Vasus (elemental deities) rule this nakshatra of abundance and rhythm. The drum is its symbol — align with the cosmic pulse, and prosperity follows.' },
  { name: 'Shatabhisha',       en: 'Hundred Healers',    emoji: '💊', energy: 'Healing, mystery & deep knowing. Aligned with Sadachbia (γ Aquarii). Varuna, the cosmic ocean and law, rules this nakshatra of a hundred healing stars. Empty circle is its symbol — healing through emptiness and deep mystical knowledge.' },
  { name: 'Purva Bhadrapada',  en: 'Fierce Feet',        emoji: '🔱', energy: 'Transformation & spiritual fire. Aligned with α and β Pegasi. Aja Ekapada (one-footed goat), an ancient storm deity, rules this intense nakshatra of spiritual fire. Sword and two-faced man are its symbols — fierce, transformative energy.' },
  { name: 'Uttara Bhadrapada', en: 'Gentle Feet',        emoji: '🐉', energy: 'Depth, wisdom & universal love. Aligned with γ Pegasi and α Andromedae. Ahir Budhnya (serpent of the deep), the cosmic serpent of the abyss, rules this profound nakshatra of universal compassion and wisdom.' },
  { name: 'Revati',            en: 'The Wealthy',        emoji: '🐟', energy: 'Completion, nourishment & safe journey. Aligned with ζ Piscium — the very end of the zodiac. Pushan, the god of safe journeys, rules this nakshatra of completion and transition. Drum is its symbol — nourishment, abundance, and arriving home.' },
];

const YOGAS = [
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

const VAARS = [
  { vedicName: 'Surya Vaar',  planet: 'Sun',     emoji: '☀️', color: '#fbbf24', energy: 'Leadership, clarity & self-expression', science: 'Solar UV-B radiation peaks in morning hours, triggering Vitamin D synthesis. Cortisol (your alertness hormone) follows a solar circadian rhythm — peaking 30 min after sunrise. The pineal gland responds to full-spectrum sunlight to regulate melatonin.' },
  { vedicName: 'Soma Vaar',   planet: 'Moon',    emoji: '🌙', color: '#93c5fd', energy: 'Intuition, emotion & inner wisdom',     science: 'The Moon\'s gravitational field subtly modulates the cerebrospinal fluid pressure in your brain. On Moon Day, the hypothalamus — your emotional regulation hub — shows heightened sensitivity to lunar magnetic variation. Intuition is heightened.' },
  { vedicName: 'Mangal Vaar', planet: 'Mars',    emoji: '🔴', color: '#f87171', energy: 'Courage, strength & decisive action',   science: 'Mars\'s ~2.01-year synodic cycle correlates with peak testosterone and adrenaline cycles in traditional medicine. Red-light frequencies (Mars spectrum) penetrate deeper tissue and stimulate mitochondrial ATP production — increasing physical drive.' },
  { vedicName: 'Budha Vaar',  planet: 'Mercury', emoji: '💚', color: '#6ee7b7', energy: 'Communication, learning & agility',     science: 'Mercury, with its 88-day orbit, governs the fastest electromagnetic cycles in the solar system. Ayurvedic chronobiology correlates Wednesday with peak synaptic plasticity — the nervous system\'s capacity to form new neural connections is maximized.' },
  { vedicName: 'Guru Vaar',   planet: 'Jupiter', emoji: '🌟', color: '#fde68a', energy: 'Wisdom, expansion & dharmic action',    science: 'Jupiter\'s enormous magnetic field is 20,000× Earth\'s — it acts as our solar system\'s gravitational protector, deflecting comets and asteroids. Vedic science correlates Jupiter Day with peak liver function (Pitta peak), memory consolidation, and wisdom integration.' },
  { vedicName: 'Shukra Vaar', planet: 'Venus',   emoji: '💗', color: '#f9a8d4', energy: 'Beauty, creativity & abundance',        science: 'Venus\'s 584-day synodic cycle and its 13:8 orbital resonance with Earth creates the famous Venus pentagram when plotted — pure mathematical beauty. Endocrine research links Venus Day with peak estrogen/creative hormone cycles and heightened aesthetic sensitivity.' },
  { vedicName: 'Shani Vaar',  planet: 'Saturn',  emoji: '🪐', color: '#a5b4fc', energy: 'Discipline, karma & enduring effort',   science: 'Saturn\'s 29.5-year orbit mirrors the human biological "Saturn Return" — documented in endocrinology as periods of hormonal restructuring at ages 28-30 and 58-60. Its ringed electromagnetic field creates measurable VLF radio emissions that affect Earth\'s ionosphere.' },
];

const TITHI_NAMES = ['','Pratipada','Dwitiya','Tritiya','Chaturthi','Panchami','Shashthi','Saptami','Ashtami','Navami','Dashami','Ekadashi','Dwadashi','Trayodashi','Chaturdashi','Purnima'];
const TITHI_ENERGY: Record<string, string> = {
  Pratipada: 'New beginnings & fresh intentions', Dwitiya: 'Building on new foundations',
  Tritiya: 'Growth & creative momentum', Chaturthi: 'Remove obstacles — pray to Ganesha',
  Panchami: 'Knowledge, learning & intellect', Shashthi: 'Health & vitality rituals',
  Saptami: 'Sun worship & action', Ashtami: 'Durga energy — courage & transformation',
  Navami: 'Ancestral blessings & devotion', Dashami: 'Dharmic deeds & charity',
  Ekadashi: 'Fasting, spiritual detox & clarity', Dwadashi: 'Vishnu worship & service',
  Trayodashi: 'Kama — desire, joy & prosperity', Chaturdashi: 'Shiva energy — release & dissolve',
  Purnima: 'Full Moon — gratitude & celebration',
};

const MOON_RITUALS: Record<string, { prompt: string; action: string }> = {
  '🌑': { prompt: 'New Moon energy',         action: 'Write one clear intention. Plant your seed of desire today.' },
  '🌒': { prompt: 'Waxing Crescent energy',  action: 'Take the very first small step. Start before you feel ready.' },
  '🌓': { prompt: 'First Quarter energy',    action: 'Push through resistance. Decide and commit — no more hesitation.' },
  '🌔': { prompt: 'Waxing Gibbous energy',   action: 'Refine your effort. You\'re close — adjust and keep momentum.' },
  '🌕': { prompt: 'Full Moon energy',        action: 'Express gratitude out loud. Journal what you\'re releasing.' },
  '🌖': { prompt: 'Waning Gibbous energy',   action: 'Share what you\'ve learned. Give generously to someone today.' },
  '🌗': { prompt: 'Last Quarter energy',     action: 'Forgive one thing. Clear mental clutter — delete, unfollow, let go.' },
  '🌘': { prompt: 'Waning Crescent energy',  action: 'Rest deeply. Recharge. The next cycle begins very soon.' },
};

const VAAR_ACTIONS: string[] = [
  'Spend 10 min in sunlight. Set one bold, visible goal today.',
  'Journal your feelings. Trust your first instinct on a decision.',
  'Do the one hard thing you\'ve been avoiding. Start it now.',
  'Write, call, or send that message. Communicate something important.',
  'Read something that challenges you. Teach or mentor someone today.',
  'Create something — cook, paint, write, arrange. Connect with beauty.',
  'Tackle your most disciplined, long-term task. No shortcuts today.',
];

const SCORE_META: Record<number, { label: string; color: string; emoji: string; desc: string }> = {
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

// ── Math Functions ──────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0');

function getMoonPhase(date: Date = new Date()): {
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

function getPanchangData(date: Date = new Date()) {
  const KNOWN_NEW_MOON_MS = new Date('2000-01-06T18:14:00Z').getTime();
  const MOON_LONG_EPOCH = 285;
  const CYCLE = 29.53058867;
  const ageRaw = (date.getTime() - KNOWN_NEW_MOON_MS) / (1000 * 60 * 60 * 24);
  const moonAge = ((ageRaw % CYCLE) + CYCLE) % CYCLE;
  const moonLong = ((MOON_LONG_EPOCH + (moonAge / CYCLE) * 360) % 360 + 360) % 360;
  const dJ2000 = (date.getTime() - 946728000000) / 86400000;
  const Ldeg = (280.460 + 0.9856474 * dJ2000) % 360;
  const gdeg = (357.528 + 0.9856003 * dJ2000) % 360;
  const gRad = gdeg * Math.PI / 180;
  const sunLong = ((Ldeg + 1.915 * Math.sin(gRad) + 0.020 * Math.sin(2 * gRad)) % 360 + 360) % 360;
  const tithiNum = Math.min(30, Math.floor((moonAge / CYCLE) * 30) + 1);
  const paksha = tithiNum <= 15 ? 'Shukla' : 'Krishna';
  const tithiInPaksha = tithiNum <= 15 ? tithiNum : tithiNum - 15;
  const tithiName = tithiInPaksha === 15 ? (paksha === 'Shukla' ? 'Purnima' : 'Amavasya') : (TITHI_NAMES[tithiInPaksha] ?? String(tithiInPaksha));
  const nakshatraIdx = Math.min(26, Math.floor(moonLong / (360 / 27)));
  const yogaLong = ((sunLong + moonLong) % 360 + 360) % 360;
  const yogaIdx = Math.min(26, Math.floor(yogaLong / (360 / 27)));
  const vaarIdx = date.getDay();
  return { tithiName, tithiInPaksha, paksha, nakshatraIdx, yogaIdx, vaarIdx, moonAge };
}

function getCosmicScore(yogaAuspicious: boolean, moonEmoji: string, tithiName: string): number {
  let score = 5;
  if (yogaAuspicious) score += 2; else score -= 1;
  if (moonEmoji === '🌕' || moonEmoji === '🌑') score += 2;
  else if (moonEmoji === '🌓' || moonEmoji === '🌗') score += 1;
  else score += 1;
  if (tithiName === 'Ekadashi' || tithiName === 'Purnima') score += 1;
  if (tithiName === 'Ashtami' || tithiName === 'Chaturdashi') score -= 1;
  return Math.max(1, Math.min(10, score));
}

// ── Moon SVG ────────────────────────────────────────────────────────────────

function MoonSVG({ tithiNum, size = 40 }: { tithiNum: number; size?: number }) {
  const r = size / 2;
  const isWaxing   = tithiNum <= 15;
  const isPurnima  = tithiNum === 15;
  const isAmavasya = tithiNum === 0 || tithiNum === 30;
  const rawIllum   = isPurnima ? 1 : isAmavasya ? 0 : isWaxing ? tithiNum / 15 : 1 - (tithiNum - 15) / 15;
  const moonFill = '#fef3c7';
  const darkFill = '#0c0c1a';
  if (rawIllum < 0.02) {
    return (
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <SvgCircle cx={r} cy={r} r={r - 0.5} fill={darkFill} stroke="#2d2d4e" strokeWidth={0.8} />
      </Svg>
    );
  }
  if (rawIllum > 0.98) {
    return (
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <SvgCircle cx={r} cy={r} r={r - 0.5} fill={moonFill} />
      </Svg>
    );
  }
  const rx = Math.max(0.5, r * Math.abs(Math.cos(Math.PI * rawIllum)));
  const outerSweep      = isWaxing ? 1 : 0;
  const terminatorSweep = (isWaxing === (rawIllum >= 0.5)) ? 1 : 0;
  const c = r; const s = size;
  const pathD = `M ${c} 0 A ${r} ${r} 0 1 ${outerSweep} ${c} ${s} A ${rx} ${r} 0 0 ${terminatorSweep} ${c} 0 Z`;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <SvgCircle cx={r} cy={r} r={r - 0.5} fill={darkFill} />
      <SvgPath d={pathD} fill={moonFill} />
    </Svg>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function SciBlock({ title, body, borderColor, titleColor }: { title: string; body: string; borderColor: string; titleColor: string }) {
  return (
    <View style={[S.sciBlock, { borderColor }]}>
      <Text style={[S.sciBlockTitle, { color: titleColor }]}>{title}</Text>
      <Text style={S.sciBlockBody}>{body}</Text>
    </View>
  );
}

function SectionHeader({ title, sub, emoji }: { title: string; sub?: string; emoji?: string }) {
  return (
    <View style={S.sectionHeader}>
      {emoji ? <Text style={S.sectionEmoji}>{emoji}</Text> : null}
      <View style={{ flex: 1 }}>
        <Text style={S.sectionTitle}>{title}</Text>
        {sub ? <Text style={S.sectionSub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

// ── Main Screen ─────────────────────────────────────────────────────────────

export default function CosmicExploreScreen() {
  const router = useRouter();
  const [expandedCalendar, setExpandedCalendar] = useState(false);

  const moon        = getMoonPhase();
  const p           = getPanchangData();
  const nakshatra   = NAKSHATRAS[p.nakshatraIdx];
  const yoga        = YOGAS[p.yogaIdx];
  const vaar        = VAARS[p.vaarIdx];
  const tithiEnergy = TITHI_ENERGY[p.tithiName] ?? 'Sacred lunar energy';
  const moonRitual  = MOON_RITUALS[moon.emoji] ?? { prompt: 'Lunar energy', action: 'Connect with the moon tonight.' };
  const vaarAction  = VAAR_ACTIONS[p.vaarIdx] ?? '';
  const isSpecialMoon = moon.emoji === '🌕' || moon.emoji === '🌑';

  const today = new Date();
  const dayOpts: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
  const dateLabel = today.toLocaleDateString('en-US', dayOpts);

  return (
    <View style={S.screen}>
      <LinearGradient
        colors={['#060618', '#0a0a1f', '#080820']}
        style={StyleSheet.absoluteFillObject}
      />

      {/* ── Custom Header ── */}
      <SafeAreaView edges={['top']} style={S.headerSafe}>
        <View style={S.header}>
          <TouchableOpacity onPress={() => router.back()} style={S.backBtn} activeOpacity={0.7}>
            <Text style={S.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={S.headerCap}>VEDIC COSMIC SCIENCE</Text>
            <Text style={S.headerTitle}>Today's Cosmic Blueprint</Text>
          </View>
        </View>
        <View style={S.headerDivider} />
      </SafeAreaView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={S.scroll}
        showsVerticalScrollIndicator={false}>

        {/* ══ HERO — Moon + Date + Cosmic Score ══ */}
        <LinearGradient
          colors={[vaar.color + '15', '#FFFFFF05', 'transparent']}
          style={S.heroGrad}>
          <View style={S.heroRow}>
            <MoonSVG tithiNum={moon.tithiNum} size={72} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={S.heroMoonName}>{moon.name}</Text>
              <Text style={S.heroIllum}>{moon.illumination}% illuminated  ·  {p.paksha} Paksha</Text>
              <Text style={S.heroTithi}>{p.tithiName}  ·  Day {p.tithiInPaksha} of 15</Text>
              <Text style={S.heroNakshatra}>{nakshatra.emoji}  {nakshatra.name}  ·  {nakshatra.en}</Text>
            </View>
          </View>

          {/* Date label */}
          <Text style={S.heroDate}>{dateLabel}</Text>

        </LinearGradient>

        {/* ══ SECTION 1: COSMIC CALENDAR ══ */}
        <View style={S.dividerRow}>
          <View style={S.dividerLine} />
          <Text style={S.dividerLabel}>COSMIC CALENDAR  ·  VEDIC ALMANAC</Text>
          <View style={S.dividerLine} />
        </View>

        {/* Special moon banner */}
        {isSpecialMoon && (
          <View style={[S.moonBanner, {
            borderColor: moon.emoji === '🌕' ? '#fbbf2445' : '#a78bfa45',
            backgroundColor: moon.emoji === '🌕' ? '#fbbf2408' : '#a78bfa08',
          }]}>
            <Text style={{ fontSize: 28 }}>{moon.emoji}</Text>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={[S.moonBannerTitle, { color: moon.emoji === '🌕' ? '#fbbf24' : '#a78bfa' }]}>
                {moon.emoji === '🌕' ? '✦  FULL MOON TODAY  ✦' : '✦  NEW MOON TODAY  ✦'}
              </Text>
              <Text style={S.moonBannerSub}>
                {moon.emoji === '🌕'
                  ? 'Maximum tidal gravitational force on body fluids. Peak energy for release, gratitude, and visibility. The Moon is exerting its strongest influence on your 60% water body right now.'
                  : 'Minimum lunar gravitational field — perfect conditions for planting new intentions, starting fresh systems, and directing your energy inward. The neural "clean slate" effect is real.'}
              </Text>
            </View>
          </View>
        )}

        {/* Vaar (Day Energy) Card */}
        <View style={[S.card, { borderColor: vaar.color + '40' }]}>
          <LinearGradient colors={[vaar.color + '15', 'transparent']} style={StyleSheet.absoluteFillObject} />
          <View style={S.cardHeader}>
            <Text style={S.cardTag}>{vaar.emoji}  PLANETARY DAY ENERGY</Text>
          </View>
          <Text style={[S.vaarTitle, { color: vaar.color }]}>{vaar.energy}</Text>
          <Text style={S.vaarSub}>{vaar.planet} Day  ·  <Text style={{ fontStyle: 'italic', color: '#FFFFFF35' }}>{vaar.vedicName}</Text></Text>
          <View style={[S.infoBox, { backgroundColor: vaar.color + '0C', borderColor: vaar.color + '25' }]}>
            <Text style={S.infoLabel}>PLANETARY SCIENCE</Text>
            <Text style={S.infoText}>{vaar.science}</Text>
          </View>
          <View style={[S.actionBox, { borderColor: vaar.color + '30' }]}>
            <Text style={[S.actionLabel, { color: vaar.color }]}>✦  DO THIS TODAY</Text>
            <Text style={S.actionText}>{vaarAction}</Text>
          </View>
        </View>

        {/* Tithi + Nakshatra Grid */}
        <View style={S.twoCol}>
          <View style={[S.miniCard, { borderColor: '#a78bfa30' }]}>
            <Text style={S.miniCardTag}>🌙  TITHI  ·  LUNAR DAY</Text>
            <Text style={[S.miniCardTitle, { color: '#a78bfa' }]}>{p.tithiName}</Text>
            <Text style={S.miniCardSub}>{p.paksha === 'Shukla' ? 'Waxing' : 'Waning'} Moon</Text>
            <Text style={S.miniCardSub}>Day {p.tithiInPaksha} of 15</Text>
            <View style={[S.miniPill, { backgroundColor: '#a78bfa12', borderColor: '#a78bfa30' }]}>
              <Text style={[S.miniPillText, { color: '#a78bfaCC' }]}>{tithiEnergy}</Text>
            </View>
          </View>
          <View style={[S.miniCard, { borderColor: '#fbbf2430' }]}>
            <Text style={S.miniCardTag}>{nakshatra.emoji}  NAKSHATRA  ·  STAR HOUSE</Text>
            <Text style={[S.miniCardTitle, { color: '#fbbf24' }]}>{nakshatra.name}</Text>
            <Text style={S.miniCardSub}>{nakshatra.en}</Text>
            <Text style={S.miniCardSub}>Moon Mansion {p.nakshatraIdx + 1}/27</Text>
            <View style={[S.miniPill, { backgroundColor: '#fbbf2412', borderColor: '#fbbf2430' }]}>
              <Text style={[S.miniPillText, { color: '#fbbf24CC' }]}>{nakshatra.energy.split('.')[0]}</Text>
            </View>
          </View>
        </View>

        {/* Yoga Card */}
        <View style={[S.card, { borderColor: yoga.auspicious ? '#10b98130' : '#f8717130' }]}>
          <View style={S.cardHeader}>
            <Text style={S.cardTag}>{yoga.auspicious ? '✨' : '🌀'}  COSMIC YOGA  ·  SUN-MOON HARMONY</Text>
            <View style={[S.yogaBadge, {
              backgroundColor: yoga.auspicious ? '#10b98118' : '#f8717118',
              borderColor: yoga.auspicious ? '#10b98140' : '#f8717140',
            }]}>
              <Text style={[S.yogaBadgeText, { color: yoga.auspicious ? '#10b981' : '#f87171' }]}>
                {yoga.auspicious ? 'AUSPICIOUS' : 'CHALLENGING'}
              </Text>
            </View>
          </View>
          <Text style={[S.yogaName, { color: yoga.auspicious ? '#10b981' : '#f87171' }]}>{yoga.name}</Text>
          <Text style={S.yogaEn}>{yoga.en}  ·  {yoga.meaning}</Text>
        </View>

        {/* Moon Ritual */}
        <View style={[S.ritualCard, { borderColor: '#a78bfa25' }]}>
          <LinearGradient colors={['#a78bfa0C', 'transparent']} style={StyleSheet.absoluteFillObject} />
          <View style={S.ritualInner}>
            <MoonSVG tithiNum={moon.tithiNum} size={38} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={S.ritualLabel}>🌙  LUNAR RITUAL FOR TODAY</Text>
              <Text style={S.ritualPrompt}>{moonRitual.prompt}  ·  {moon.illumination}% lit</Text>
              <Text style={S.ritualText}>{moonRitual.action}</Text>
            </View>
          </View>
        </View>

        {/* Expandable tri-cell detail */}
        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setExpandedCalendar(e => !e); }}
          activeOpacity={0.85}
          style={S.expandToggle}>
          <Text style={S.expandToggleText}>{expandedCalendar ? 'Hide detailed breakdown  ↑' : 'Show detailed Panchang breakdown  ↓'}</Text>
        </TouchableOpacity>

        {expandedCalendar && (
          <View style={S.triGrid}>
            <View style={[S.triCell, { borderColor: '#a78bfa22' }]}>
              <Text style={S.triEmoji}>🌙</Text>
              <Text style={[S.triTitle, { color: '#a78bfa' }]}>{p.tithiName}</Text>
              <Text style={S.triSub}>{p.paksha === 'Shukla' ? 'Waxing' : 'Waning'} Moon</Text>
              <Text style={S.triSub}>{p.paksha} Paksha  ·  Day {p.tithiInPaksha}</Text>
              <Text style={S.triEn}>{tithiEnergy}</Text>
            </View>
            <View style={[S.triCell, { borderColor: '#fbbf2422' }]}>
              <Text style={S.triEmoji}>{nakshatra.emoji}</Text>
              <Text style={[S.triTitle, { color: '#fbbf24' }]}>{nakshatra.name}</Text>
              <Text style={S.triSub}>{nakshatra.en}</Text>
              <Text style={S.triSub}>Moon Mansion</Text>
              <Text style={S.triEn}>{nakshatra.energy.split('.')[0]}</Text>
            </View>
            <View style={[S.triCell, { borderColor: yoga.auspicious ? '#10b98122' : '#f8717122' }]}>
              <Text style={S.triEmoji}>{yoga.auspicious ? '✨' : '🌀'}</Text>
              <Text style={[S.triTitle, { color: yoga.auspicious ? '#10b981' : '#f87171' }]}>{yoga.name}</Text>
              <Text style={S.triSub}>{yoga.en}</Text>
              <Text style={S.triSub}>Cosmic Alignment</Text>
              <Text style={S.triEn}>{yoga.meaning}</Text>
            </View>
          </View>
        )}

        <View style={[S.infoNote, { marginHorizontal: 16, marginBottom: 8 }]}>
          <Text style={S.infoNoteText}>
            🕉️  The Panchang is the Vedic cosmic calendar — five ancient "limbs of time" (Vaar, Tithi, Nakshatra, Yoga, Karana) computed with orbital mechanics and used for 5,000+ years to align daily life with planetary cycles. These are not beliefs — they are calculations.
          </Text>
        </View>

        {/* ══ SECTION 2: THE SCIENCE ══ */}
        <View style={S.dividerRow}>
          <View style={S.dividerLine} />
          <Text style={S.dividerLabel}>THE SCIENCE  ·  PHYSICS, BIOLOGY & CHRONOBIOLOGY</Text>
          <View style={S.dividerLine} />
        </View>

        {/* Moon-Body Connection */}
        <View style={S.exploreSection}>
          <SectionHeader emoji="🌊" title="The Moon–Body Connection" sub="GRAVITATIONAL PHYSICS  ·  CHRONOBIOLOGY  ·  ENDOCRINOLOGY" />

          <SciBlock
            title="Gravitational Physics"
            body={`The Moon exerts a measurable tidal force on Earth: 3.3 × 10⁻⁵ m/s² gravitational acceleration at the surface. While small, this force moves oceans — and your body is 60–70% water. The same tidal mechanics act on every fluid-filled cavity: cerebrospinal fluid (CSF), blood plasma, lymph, and intercellular fluid.\n\nThe CSF bathes your brain and spinal cord. Even micro-variations in CSF pressure have documented effects on cognition, mood, and neural firing rates. The Moon is, quite literally, moving the fluid around your brain.`}
            borderColor="#60a5fa25"
            titleColor="#60a5fa"
          />
          <SciBlock
            title="Chronobiology Research"
            body={`A landmark 2013 study (Cajochen et al., University of Basel, published in Current Biology) measured melatonin, deep-sleep EEG delta-wave activity, and cortisol across full lunar cycles in a controlled light environment. Result: around full moon, melatonin was ~30% lower, deep sleep was reduced by 20 min, and sleep onset took 5 extra min — with zero visual access to the moon.\n\nThe mechanism is likely geomagnetic, not optical. Earth's magnetosphere is compressed and reshaped by the Moon's gravitational field — and the pineal gland is exquisitely sensitive to geomagnetic fluctuation. The Moon changes your brain chemistry without you ever seeing it.`}
            borderColor="#a78bfa25"
            titleColor="#a78bfa"
          />
          <SciBlock
            title="Biological Cycles & Evolutionary Entrainment"
            body={`The female reproductive cycle averages 27.3–29.5 days — nearly identical to the lunar synodic month (29.53 days). This is not coincidence: our evolutionary ancestors, living in natural light, had their endocrine systems entrained by lunar light cycles for millions of years. The Moon is humanity's oldest biological clock.\n\nMarine biology confirms: coral spawn synchronised to the full moon, oyster feeding cycles track tidal phases precisely, and even plant sap pressure (measured in agricultural studies) rises during the waxing phase. The biosphere is lunar-entrained at every level.`}
            borderColor="#34d39925"
            titleColor="#34d399"
          />
        </View>

        {/* Tithi Science */}
        <View style={S.exploreSection}>
          <SectionHeader emoji="📐" title="What is a Tithi?" sub={`ORBITAL MECHANICS  ·  ${p.tithiName}  ·  ${p.paksha} Paksha  ·  Day ${p.tithiInPaksha} of 15`} />

          <SciBlock
            title="The Mathematics of Lunar Angular Separation"
            body={`A Tithi is defined as every 12° of angular separation between the Sun and Moon as seen from Earth. Since 360° ÷ 12° = 30, there are exactly 30 Tithis in a lunar month — 15 waxing (Shukla Paksha) and 15 waning (Krishna Paksha).\n\nThis is pure orbital mechanics, not mythology. The Vedic astronomers were calculating synodic angles to arc-minute precision over 3,000 years ago, using the same mathematics as modern ephemeris software. The only difference is the computational medium — they used Beeja corrections and Bija tables; we use computers.`}
            borderColor="#fbbf2425"
            titleColor="#fbbf24"
          />
          <SciBlock
            title="Paksha Biology — Anabolic vs. Catabolic Phases"
            body={`Shukla Paksha (Waxing Moon): As the Moon-Sun angular separation increases 0° → 180°, the resultant tidal force on body fluids increases. Plants absorb more water through roots (confirmed in agriculture studies, Frankfurt Bio-dynamic Research Institute). Cells show higher nutrient uptake. This is the anabolic phase — ideal for building, growing, starting.\n\nKrishna Paksha (Waning Moon): As the angle decreases 180° → 0°, fluid tension reduces. The body prioritises elimination and detoxification. Ayurveda prescribes fasting, cleansing, and surgical procedures in Krishna Paksha — a claim supported by reduced intraoperative bleeding risk documented in German hospitals in the 1990s (Ghilotti et al.).`}
            borderColor="#fbbf2425"
            titleColor="#fbbf24"
          />
          <View style={[S.highlightPill, { borderColor: '#a78bfa30', backgroundColor: '#a78bfa0C' }]}>
            <Text style={S.highlightText}>
              Today:{' '}
              <Text style={{ color: '#a78bfaDD', fontWeight: '800' }}>{p.tithiName}</Text>
              {'  ·  '}
              {p.paksha === 'Shukla'
                ? <Text style={{ color: '#34d399CC' }}>Waxing phase — anabolic, building, growth-oriented</Text>
                : <Text style={{ color: '#94a3b8CC' }}>Waning phase — catabolic, detox, release-oriented</Text>
              }
            </Text>
          </View>
        </View>

        {/* Nakshatra Science */}
        <View style={S.exploreSection}>
          <SectionHeader emoji={nakshatra.emoji} title="Nakshatra — The Lunar Mansions" sub={`SIDEREAL ASTRONOMY  ·  ${nakshatra.name}  ·  ${nakshatra.en}`} />

          <SciBlock
            title="The Stellar Coordinate System"
            body={`The 27 Nakshatras divide the Moon's 27.3-day sidereal orbit into 27 equal arcs of 13°20' each — one per day. Each arc corresponds to a specific star or star cluster that the Moon transits through that day.\n\nThis is the Moon's position relative to FIXED stars (sidereal reference frame), as opposed to the Tithi which measures the Moon relative to the Sun (synodic reference frame). These are two entirely different coordinate systems — and Vedic astronomy tracked both simultaneously for 5,000 years.\n\nModern astronomy uses the same sidereal reference frame (ICRS — the International Celestial Reference System) for navigation satellites and deep space missions. The Nakshatra system predates it by millennia.`}
            borderColor="#f9a8d425"
            titleColor="#f9a8d4"
          />
          <SciBlock
            title={`Today: ${nakshatra.name} — ${nakshatra.en}`}
            body={`${nakshatra.energy}\n\nThe Moon's gravitational vector is currently pointed toward the ${nakshatra.name} star system. In bioelectromagnetic terms, the direction of the tidal force matters — different stellar alignments change the vector of maximum fluid gradient in your body. Vedic rishis empirically catalogued these effects over centuries of careful observation.`}
            borderColor="#f9a8d425"
            titleColor="#f9a8d4"
          />
        </View>

        {/* Yoga Science */}
        <View style={S.exploreSection}>
          <SectionHeader emoji="✨" title="Yoga — The Sun-Moon Electromagnetic Harmony" sub={`SOLAR-LUNAR COMBINED FIELD  ·  ${yoga.en}  ·  ${yoga.auspicious ? 'AUSPICIOUS' : 'CHALLENGING'}`} />

          <SciBlock
            title="The Calculation: Combined Solar-Lunar Longitude"
            body={`A Yoga is calculated by: (Longitude of Sun + Longitude of Moon) ÷ 13°20'. This gives 27 Yogas — each representing a unique combined configuration of solar electromagnetic energy and lunar gravitational influence on Earth's biosphere.\n\nWhen the Sun and Moon are in specific combined positions, their electromagnetic fields interact differently with Earth's magnetosphere, ionosphere, and ultimately with your body's bioelectric field. The 27 Yogas represent 27 distinct "blended field states" — empirically observed for their effects on human cognition, health, and fortune.`}
            borderColor="#10b98125"
            titleColor="#10b981"
          />
          <View style={[S.highlightPill, { borderColor: yoga.auspicious ? '#10b98130' : '#f8717130', backgroundColor: yoga.auspicious ? '#10b9810C' : '#f871710C' }]}>
            <Text style={S.highlightText}>
              Today's Yoga:{' '}
              <Text style={{ color: yoga.auspicious ? '#10b981DD' : '#f87171DD', fontWeight: '800' }}>{yoga.en} ({yoga.name})</Text>
              {'  —  '}{yoga.meaning}
            </Text>
          </View>
        </View>

        {/* Vaar Science (Planet Science) */}
        <View style={S.exploreSection}>
          <SectionHeader emoji={vaar.emoji} title={`${vaar.planet} Day Science`} sub={`PLANETARY ELECTROMAGNETIC INFLUENCE  ·  ${vaar.vedicName}`} />
          <SciBlock
            title={`Why the ${vaar.planet} Governs Today`}
            body={vaar.science}
            borderColor={vaar.color + '25'}
            titleColor={vaar.color}
          />
          <SciBlock
            title="The 7-Day Planetary Week: An Ancient Mathematical System"
            body={`The Vedic 7-day week (Sapta Vaar) is organised by planetary distance from Earth — an observational ordering confirmed by modern astronomy: Moon, Mercury, Venus, Sun, Mars, Jupiter, Saturn. Each planet governs one day because it was understood that planetary orbital periods create measurable resonances with Earth's electromagnetic field.\n\nThis same planetary ordering was independently developed by Babylonian, Egyptian, Greek, and Indian astronomers — suggesting it reflects a real observable phenomenon rather than cultural convention.`}
            borderColor={vaar.color + '25'}
            titleColor={vaar.color}
          />
        </View>

        {/* Grand closing note */}
        <View style={[S.closingCard, { borderColor: '#a78bfa30' }]}>
          <LinearGradient colors={['#a78bfa0F', '#7c3aed08', 'transparent']} style={StyleSheet.absoluteFillObject} />
          <Text style={S.closingEmoji}>🕉️</Text>
          <Text style={S.closingTitle}>Jyotish: The Eye of the Veda</Text>
          <Text style={S.closingBody}>
            {`Jyotisha — Vedic astrology — literally means "the science of light." It is Vedanga: one of the six limbs of the Vedas, considered a tool of empirical observation, not superstition.\n\nFor 5,000+ years, Vedic astronomers tracked planetary positions with instruments (Jantar Mantar observatories), created mathematical algorithms (Bija corrections), and catalogued biological and social outcomes across tens of thousands of lunar cycles. The result is a sophisticated system of chronobiology — aligning human biological cycles with planetary and stellar cycles for optimal health, timing, and consciousness.\n\nModern chronobiology, heliobiology, and bioelectromagnetics are only beginning to rediscover what Vedic science encoded millennia ago: that the cosmos is not separate from your body. You are a microcosm — a living resonator in a vast electromagnetic symphony.`}
          </Text>
          <View style={S.closingDivider} />
          <Text style={S.closingFoot}>
            🔬  All astronomical calculations on this screen use real orbital mechanics — the same mathematics used by NASA ephemeris software. Tithi is calculated from synodic Moon age. Nakshatra from sidereal Moon longitude. Yoga from (Sun + Moon) longitude sum. No approximations.
          </Text>
        </View>

        <View style={{ height: 48 }} />
      </ScrollView>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  screen:        { flex: 1, backgroundColor: '#060618' },
  scroll:        { paddingBottom: 40 },
  headerSafe:    { backgroundColor: 'transparent' },
  header:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, paddingTop: 4, gap: 12 },
  headerDivider: { height: 1, backgroundColor: '#FFFFFF08', marginHorizontal: 16 },
  headerCap:     { fontSize: 8, fontWeight: '900', color: '#FFFFFF30', letterSpacing: 2, marginBottom: 3 },
  headerTitle:   { fontSize: 19, fontWeight: '900', color: '#fff' },
  backBtn:       { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFFFFF0A', borderWidth: 1, borderColor: '#FFFFFF15', alignItems: 'center', justifyContent: 'center' },
  backIcon:      { color: '#fff', fontSize: 18, marginTop: -1 },
  scoreBadge:    { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 99, paddingHorizontal: 11, paddingVertical: 6 },
  scoreBadgeNum: { fontSize: 14, fontWeight: '900' },

  heroGrad:      { marginHorizontal: 16, marginTop: 14, borderRadius: 24, borderWidth: 1, borderColor: '#FFFFFF0C', padding: 18, overflow: 'hidden' },
  heroRow:       { flexDirection: 'row', alignItems: 'center', gap: 18, marginBottom: 12 },
  heroMoonName:  { fontSize: 20, fontWeight: '900', color: '#fff' },
  heroIllum:     { fontSize: 12, color: '#a78bfaCC', fontWeight: '700', marginTop: 1 },
  heroTithi:     { fontSize: 12, color: '#fbbf24AA', fontWeight: '600', marginTop: 1 },
  heroNakshatra: { fontSize: 11, color: '#FFFFFF60', fontWeight: '600', marginTop: 2 },
  heroDate:      { fontSize: 10, color: '#FFFFFF30', fontWeight: '700', letterSpacing: 0.5, marginBottom: 12 },
  scoreRow:      { borderWidth: 1, borderRadius: 14, padding: 12 },
  scoreBarTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  scoreBarFill:  { height: 4, borderRadius: 2 },
  scoreLabel:    { fontSize: 12, fontWeight: '900' },
  scoreDesc:     { fontSize: 11, color: '#FFFFFF50', lineHeight: 17, marginTop: 2 },

  dividerRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 24, marginBottom: 14 },
  dividerLine:   { flex: 1, height: 1, backgroundColor: '#FFFFFF10' },
  dividerLabel:  { fontSize: 7, fontWeight: '900', color: '#FFFFFF25', letterSpacing: 1.5, textAlign: 'center', flexShrink: 1 },

  moonBanner:    { marginHorizontal: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderWidth: 1, borderRadius: 18, padding: 14 },
  moonBannerTitle: { fontSize: 12, fontWeight: '900', letterSpacing: 1, marginBottom: 5 },
  moonBannerSub:   { fontSize: 11, color: '#FFFFFF60', lineHeight: 18 },

  card:          { marginHorizontal: 16, marginBottom: 10, borderRadius: 20, borderWidth: 1, backgroundColor: '#FFFFFF04', padding: 16, overflow: 'hidden' },
  cardHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  cardTag:       { fontSize: 8, fontWeight: '900', color: '#FFFFFF30', letterSpacing: 1.5 },
  vaarTitle:     { fontSize: 17, fontWeight: '900', lineHeight: 24, marginBottom: 3 },
  vaarSub:       { fontSize: 10, color: '#FFFFFF40', marginBottom: 12 },
  infoBox:       { borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 10 },
  infoLabel:     { fontSize: 7, fontWeight: '900', color: '#FFFFFF28', letterSpacing: 1.5, marginBottom: 6 },
  infoText:      { fontSize: 11, color: '#FFFFFF60', lineHeight: 18 },
  actionBox:     { borderWidth: 1, borderRadius: 14, padding: 12, backgroundColor: '#FFFFFF05' },
  actionLabel:   { fontSize: 8, fontWeight: '900', letterSpacing: 1.3, marginBottom: 6 },
  actionText:    { fontSize: 12, fontWeight: '600', color: '#FFFFFFCC', lineHeight: 19 },

  yogaBadge:     { borderWidth: 1, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
  yogaBadgeText: { fontSize: 7, fontWeight: '900', letterSpacing: 1.5 },
  yogaName:      { fontSize: 20, fontWeight: '900', marginBottom: 4 },
  yogaEn:        { fontSize: 12, color: '#FFFFFF55', lineHeight: 18 },

  twoCol:        { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 10 },
  miniCard:      { flex: 1, borderWidth: 1, borderRadius: 18, backgroundColor: '#FFFFFF04', padding: 14, gap: 3 },
  miniCardTag:   { fontSize: 7, fontWeight: '900', color: '#FFFFFF25', letterSpacing: 1.2, marginBottom: 3 },
  miniCardTitle: { fontSize: 15, fontWeight: '900' },
  miniCardSub:   { fontSize: 9, color: '#FFFFFF45', fontWeight: '600' },
  miniPill:      { borderWidth: 1, borderRadius: 10, padding: 8, marginTop: 6 },
  miniPillText:  { fontSize: 9, fontWeight: '700', lineHeight: 14 },

  ritualCard:    { marginHorizontal: 16, marginBottom: 10, borderRadius: 18, borderWidth: 1, overflow: 'hidden', padding: 16 },
  ritualInner:   { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  ritualLabel:   { fontSize: 7, fontWeight: '900', color: '#a78bfa50', letterSpacing: 1.5, marginBottom: 4 },
  ritualPrompt:  { fontSize: 10, fontWeight: '800', color: '#a78bfaCC', marginBottom: 4 },
  ritualText:    { fontSize: 12, color: '#FFFFFF70', lineHeight: 19, fontStyle: 'italic' },

  expandToggle:  { marginHorizontal: 16, marginBottom: 10, alignItems: 'center', paddingVertical: 10 },
  expandToggleText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF30', letterSpacing: 0.5 },

  triGrid:       { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginBottom: 12 },
  triCell:       { flex: 1, borderWidth: 1, borderRadius: 16, backgroundColor: '#FFFFFF04', padding: 11, gap: 3 },
  triEmoji:      { fontSize: 20, marginBottom: 4 },
  triTitle:      { fontSize: 11, fontWeight: '900' },
  triSub:        { fontSize: 8, color: '#FFFFFF45', lineHeight: 13 },
  triEn:         { fontSize: 8, color: '#FFFFFF28', fontWeight: '500', marginTop: 3, lineHeight: 12 },

  infoNote:      { backgroundColor: '#a78bfa08', borderWidth: 1, borderColor: '#a78bfa18', borderRadius: 14, padding: 12 },
  infoNoteText:  { fontSize: 10, color: '#a78bfa65', lineHeight: 16 },

  exploreSection: { marginHorizontal: 16, marginBottom: 18 },
  sectionHeader:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  sectionEmoji:   { fontSize: 24, marginTop: 1 },
  sectionTitle:   { fontSize: 17, fontWeight: '900', color: '#fff', lineHeight: 24, flex: 1 },
  sectionSub:     { fontSize: 9, color: '#FFFFFF35', fontWeight: '700', letterSpacing: 1, marginTop: 3 },

  sciBlock:       { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 8 },
  sciBlockTitle:  { fontSize: 12, fontWeight: '900', marginBottom: 8 },
  sciBlockBody:   { fontSize: 12, color: '#FFFFFF60', lineHeight: 20 },

  highlightPill:  { borderWidth: 1, borderRadius: 14, padding: 13, marginTop: 6 },
  highlightText:  { fontSize: 12, color: '#FFFFFF65', lineHeight: 19 },

  closingCard:    { marginHorizontal: 16, marginTop: 10, borderRadius: 24, borderWidth: 1, padding: 20, overflow: 'hidden' },
  closingEmoji:   { fontSize: 32, marginBottom: 10, textAlign: 'center' },
  closingTitle:   { fontSize: 18, fontWeight: '900', color: '#a78bfa', textAlign: 'center', marginBottom: 14 },
  closingBody:    { fontSize: 12, color: '#FFFFFF60', lineHeight: 21 },
  closingDivider: { height: 1, backgroundColor: '#a78bfa20', marginVertical: 14 },
  closingFoot:    { fontSize: 10, color: '#FFFFFF30', lineHeight: 17, fontStyle: 'italic' },
});
