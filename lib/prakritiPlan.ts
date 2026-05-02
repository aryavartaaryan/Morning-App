// ── Prakriti-Personalised Dinacharya ────────────────────────────────────────
// Each dosha gets 16 activities covering the full day with Ayurveda-aligned
// timing windows, Prakriti-specific instructions, and a habit ID that maps
// directly to the streak tracker on the home screen.

export interface DActivity {
  habitId: string;
  emoji: string;
  name: string;
  time: string;       // Display label e.g. "6:00 AM"
  startMin: number;   // Minutes from midnight – used for home-screen timing
  endMin: number;
  duration: string;   // e.g. "10 min", "2 glasses", "—"
  note: string;       // Prakriti-specific Ayurvedic instruction
}

export interface PrakritiPlan {
  wakeTime: string;
  wakeHour: number;
  wakeMin: number;
  exerciseLabel: string;
  morningMantra: string;
  activities: DActivity[];
}

// ── VATA (Air + Space) ─────────────────────────────────────────────────────
// Needs: grounding, warmth, routine, slow movement, oily nourishment
const V: DActivity[] = [
  { habitId:'wake_early',       emoji:'🌙', name:'Rise & Ground',         time:'6:00 AM', startMin:360, endMin:390, duration:'—',         note:'Rise gently — no alarm shock. Lie still 2 min, take 5 deep breaths before standing.' },
  { habitId:'warm_water',       emoji:'💧', name:'Warm Ginger Water',     time:'6:05 AM', startMin:365, endMin:390, duration:'2 glasses',  note:'Warm water + fresh ginger + lemon. Drink within 30 min of waking — flushes overnight Ama and awakens Agni gently.' },
  { habitId:'morning_cleanse',  emoji:'🪷', name:'Abhyanga & Cleanse',    time:'6:20 AM', startMin:380, endMin:450, duration:'20 min',     note:'Sesame oil Abhyanga (5 min self-massage), Dant Manjan, answer urge, warm oil bath.' },
  { habitId:'meditation',       emoji:'🧘', name:'Morning Meditation',      time:'6:50 AM', startMin:410, endMin:450, duration:'10 min',     note:'Sit in stillness and watch the breath. The most powerful Vata-calming practice — 10 min of morning silence.' },
  { habitId:'morning_walk',     emoji:'🌄', name:'Barefoot Morning Walk',  time:'7:05 AM', startMin:425, endMin:480, duration:'20–30 min',  note:'Walk barefoot on bare earth, grass, or soil. Slow grounded pace — this is your daily medicine for Vata.' },
  { habitId:'sunlight',         emoji:'☀️', name:'Morning Sunlight',       time:'7:35 AM', startMin:455, endMin:510, duration:'10–15 min',  note:'Warm early sun grounds Vata and syncs circadian rhythm. Stand barefoot on earth if possible.' },
  { habitId:'breakfast',        emoji:'🌾', name:'Warm Oily Breakfast',   time:'8:00 AM', startMin:480, endMin:540, duration:'—',          note:'Warm khichdi, oats with ghee, or stewed fruit. Never cold, raw, or dry food.' },
  { habitId:'lunch',            emoji:'🍛', name:'Main Meal',              time:'12:30 PM',startMin:750, endMin:810, duration:'—',          note:'Largest warm meal — dal with ghee, cooked rice, sabzi. Eat slowly, no screens.' },
  { habitId:'walk',             emoji:'🚶', name:'Shatapavali',           time:'1:15 PM', startMin:795, endMin:840, duration:'100 steps',  note:'Slow post-lunch walk aids Vata digestion and prevents afternoon gas and bloating.' },
  { habitId:'herbal_tea',       emoji:'🍵', name:'CCF Herbal Tea',        time:'3:30 PM', startMin:930, endMin:1020,duration:'1 cup',      note:'Cumin-Coriander-Fennel. Tridoshic digestive. Gently kindles Vata Agni and reduces gas.' },
  { habitId:'evening_walk',     emoji:'🌆', name:'Grounding Walk',        time:'5:30 PM', startMin:1050,endMin:1140,duration:'20–30 min',  note:'Slow walk in nature. Grounds accumulated Vata anxiety before darkness arrives.' },
  { habitId:'meditation',       emoji:'🧘', name:'Evening Meditation',    time:'6:30 PM', startMin:1110,endMin:1170,duration:'10 min',     note:'Body-scan or Yoga Nidra. Releases the day\'s scattered Vata energy before dinner.' },
  { habitId:'dinner',           emoji:'🥗', name:'Light Warm Dinner',     time:'7:00 PM', startMin:1140,endMin:1200,duration:'—',          note:'Half of lunch — warm soup, soft dal, light rice. Never cold or raw at night.' },
  { habitId:'screen_free',      emoji:'📵', name:'Screen-free',           time:'9:00 PM', startMin:1260,endMin:1320,duration:'—',          note:'Phones away. Sesame oil on feet and scalp — deeply grounds Vata for restorative sleep.' },
  { habitId:'journaling',       emoji:'📓', name:'Svadhyaya',             time:'9:30 PM', startMin:1290,endMin:1350,duration:'10 min',     note:'Write tomorrow\'s 3 intentions. Releases mental Ama so sleep can truly restore you.' },
  { habitId:'sleep',            emoji:'🌑', name:'Sleep by 10 PM',        time:'10:00 PM',startMin:1320,endMin:1380,duration:'7–8 hrs',    note:'Warm saffron-cardamom milk before bed. Vata must sleep by 10 PM to preserve Ojas.' },
];

// ── PITTA (Fire + Water) ───────────────────────────────────────────────────
// Needs: cooling, calming, moderation, cooling oil, no midday sun
const P: DActivity[] = [
  { habitId:'wake_early',       emoji:'🌙', name:'Pre-dawn Rise',         time:'5:45 AM', startMin:345, endMin:390, duration:'—',         note:'Rise before Pitta ignites. The Vata pre-dawn hour preserves coolness and mental clarity.' },
  { habitId:'warm_water',       emoji:'💧', name:'Cooling Hydration',     time:'5:50 AM', startMin:350, endMin:375, duration:'2 glasses',  note:'Room-temp water with fennel seeds or fresh coconut water — NOT warm. Drink within 25 min of waking to cool Pitta fire at dawn.' },
  { habitId:'morning_cleanse',  emoji:'🪷', name:'Coconut Abhyanga',      time:'6:10 AM', startMin:370, endMin:420, duration:'20 min',     note:'Coconut oil Abhyanga, Dant Manjan, answer urge, lukewarm (not hot) shower.' },
  { habitId:'morning_walk',     emoji:'�', name:'Barefoot Morning Walk',  time:'6:35 AM', startMin:395, endMin:450, duration:'25–30 min',  note:'Walk barefoot on earth or grass at a peaceful pace. Morning dew on the feet — Pitta\'s most cooling medicine.' },
  { habitId:'meditation',       emoji:'🧘', name:'Pitta Meditation',      time:'7:15 AM', startMin:435, endMin:480, duration:'15 min',     note:'Meditate before the mind heats up. Chandra Bhedhana (left nostril) calms Pitta heat.' },
  { habitId:'sunlight',         emoji:'☀️', name:'Gentle Early Sun',       time:'7:45 AM', startMin:465, endMin:510, duration:'10 min',     note:'Early morning sun only. Pitta overheats after 9 AM — avoid midday or afternoon sun.' },
  { habitId:'breakfast',        emoji:'🌾', name:'Cooling Breakfast',     time:'8:00 AM', startMin:480, endMin:540, duration:'—',          note:'Sweet, cooling, light — coconut oats, pomegranate, fresh fruit. No sour or spicy food.' },
  { habitId:'lunch',            emoji:'🍛', name:'Main Meal',              time:'12:00 PM',startMin:720, endMin:780, duration:'—',          note:'Largest meal on time — never skip. Cooling spices: coriander, fennel, mint. Eat calmly.' },
  { habitId:'walk',             emoji:'🚶', name:'Shaded Shatapavali',    time:'12:45 PM',startMin:765, endMin:810, duration:'100 steps',  note:'Slow shaded walk after lunch. Helps Pitta digestion without triggering overheating.' },
  { habitId:'herbal_tea',       emoji:'🍵', name:'Cooling Herbal Tea',    time:'3:30 PM', startMin:930, endMin:1020,duration:'1 cup',      note:'Mint, brahmi, rose, or CCF tea. Never hot spicy chai — that inflames Pitta fire.' },
  { habitId:'evening_walk',     emoji:'🌆', name:'Moonlight Walk',        time:'6:00 PM', startMin:1080,endMin:1140,duration:'25–30 min',  note:'Walk in open sky at dusk — Chandra Darshana. Moonlight is Pitta\'s greatest medicine.' },
  { habitId:'meditation',       emoji:'🧘', name:'Evening Meditation',    time:'7:00 PM', startMin:1140,endMin:1200,duration:'15 min',     note:'Pratyahara — sensory withdrawal. Release the day\'s competitive fire before dinner.' },
  { habitId:'dinner',           emoji:'🥗', name:'Light Cooling Dinner',  time:'7:30 PM', startMin:1170,endMin:1230,duration:'—',          note:'Cooling, light, early. No spicy or acidic food at night — Pitta sleep needs cool calm.' },
  { habitId:'screen_free',      emoji:'📵', name:'Screen-free',           time:'9:00 PM', startMin:1260,endMin:1320,duration:'—',          note:'Screens off. Rose water on eyes. No work email — the inner fire must fully rest by 9.' },
  { habitId:'journaling',       emoji:'📓', name:'Svadhyaya',             time:'9:30 PM', startMin:1290,endMin:1350,duration:'10 min',     note:'Write 3 gratitudes. Shifts Pitta from critical to compassionate mindset before sleep.' },
  { habitId:'sleep',            emoji:'🌑', name:'Sleep by 10 PM',        time:'10:00 PM',startMin:1320,endMin:1380,duration:'7–8 hrs',    note:'Pitta repair peaks 10 PM–2 AM. Every minute of sleep before midnight = 2× cell renewal.' },
];

// ── KAPHA (Earth + Water) ──────────────────────────────────────────────────
// Needs: vigour, stimulation, heat, dry massage, early rising, light food
const K: DActivity[] = [
  { habitId:'wake_early',       emoji:'🌙', name:'Pre-Kapha Rise',        time:'5:15 AM', startMin:315, endMin:360, duration:'—',         note:'MUST rise before 6 AM. Kapha accumulates 6–10 AM — sleeping in creates all-day heaviness.' },
  { habitId:'warm_water',       emoji:'💧', name:'Stimulating Detox',     time:'5:20 AM', startMin:320, endMin:345, duration:'2 glasses',  note:'Warm water with ginger, lemon, black pepper, and raw honey. Drink immediately on waking — ignites Kapha Agni and flushes overnight Ama.' },
  { habitId:'morning_cleanse',  emoji:'🪷', name:'Garshana & Cleanse',    time:'5:35 AM', startMin:335, endMin:395, duration:'15 min',     note:'Dry-brush Garshana 5 min (activates lymph), Dant Manjan, answer urge, warm-hot shower.' },
  { habitId:'morning_walk',     emoji:'�', name:'Brisk Barefoot Walk',   time:'6:00 AM', startMin:360, endMin:445, duration:'30–40 min',  note:'Walk briskly barefoot on earth, sand, or grass. Kapha must move every morning — this single walk transforms your whole day.' },
  { habitId:'meditation',       emoji:'🧘', name:'Morning Meditation',      time:'7:00 AM', startMin:420, endMin:455, duration:'10 min',     note:'Sit in stillness after your walk. 10 min of focused inner awareness clears Kapha heaviness completely.' },
  { habitId:'sunlight',         emoji:'☀️', name:'Morning Sunlight',       time:'7:20 AM', startMin:440, endMin:480, duration:'15 min',     note:'Warm sunlight on the body. Kapha needs heat and light to dissolve heaviness each morning.' },
  { habitId:'breakfast',        emoji:'🌾', name:'Light Breakfast',       time:'8:00 AM', startMin:480, endMin:540, duration:'—',          note:'Light and spiced only — or skip if not hungry. Fresh fruit, light poha with ginger.' },
  { habitId:'lunch',            emoji:'🍛', name:'Main Meal',              time:'12:00 PM',startMin:720, endMin:780, duration:'—',          note:'Largest meal, but light. Ginger, pepper, turmeric, mustard. No fried or heavy dairy.' },
  { habitId:'walk',             emoji:'🚶', name:'Brisk Shatapavali',     time:'12:45 PM',startMin:765, endMin:810, duration:'100 steps',  note:'Brisk post-meal walk. Kapha digestion needs vigorous stimulation to prevent Ama.' },
  { habitId:'herbal_tea',       emoji:'🍵', name:'Stimulating Tea',       time:'3:00 PM', startMin:900, endMin:960, duration:'1 cup',      note:'Ginger-cinnamon-tulsi or trikatu. Prevents Kapha afternoon slump — no sweet drinks.' },
  { habitId:'evening_walk',     emoji:'🌆', name:'Brisk Evening Walk',    time:'5:30 PM', startMin:1050,endMin:1140,duration:'30–40 min',  note:'Brisk pace — Kapha benefits from two vigorous sessions daily for complete balance.' },
  { habitId:'meditation',       emoji:'🧘', name:'Evening Meditation',    time:'6:30 PM', startMin:1110,endMin:1145,duration:'10 min',     note:'Sit in stillness. Watch the breath. Let the evening dissolve Kapha heaviness into calm.' },
  { habitId:'dinner',           emoji:'🥗', name:'Early Light Dinner',    time:'6:45 PM', startMin:1125,endMin:1185,duration:'—',          note:'Light, hot, spiced, and small. Eat by 7 PM. No dessert, no dairy, no cold food.' },
  { habitId:'screen_free',      emoji:'📵', name:'Screen-free',           time:'8:30 PM', startMin:1230,endMin:1290,duration:'—',          note:'Screens off early. Calm evenings improve Kapha sleep quality. Tech-free after 8:30.' },
  { habitId:'journaling',       emoji:'📓', name:'Svadhyaya',             time:'9:00 PM', startMin:1260,endMin:1320,duration:'10 min',     note:'Write tomorrow\'s movement goal. Clear action plans help Kapha overcome morning inertia.' },
  { habitId:'sleep',            emoji:'🌑', name:'Sleep by 9:30 PM',      time:'9:30 PM', startMin:1290,endMin:1350,duration:'7 hrs',      note:'Kapha needs only 7 hrs — not more. Oversleeping deepens Kapha. Rise early regardless.' },
];

export const PRAKRITI_PLANS: Record<string, PrakritiPlan> = {
  Vata:  { wakeTime:'6:00 AM', wakeHour:6, wakeMin:0,  exerciseLabel:'Barefoot morning walk on earth',      morningMantra:'Warmth and routine are your greatest medicines today.', activities:V },
  Pitta: { wakeTime:'5:45 AM', wakeHour:5, wakeMin:45, exerciseLabel:'Peaceful barefoot morning walk',        morningMantra:'Direct your fire wisely — coolness is your power.', activities:P },
  Kapha: { wakeTime:'5:15 AM', wakeHour:5, wakeMin:15, exerciseLabel:'Brisk barefoot morning walk on earth',  morningMantra:'Rise and walk — bare earth beneath your feet is your daily medicine.', activities:K },
  Sama:  { wakeTime:'5:45 AM', wakeHour:5, wakeMin:45, exerciseLabel:'Barefoot morning walk on earth',      morningMantra:'Sama Prakriti — balance all three doshas with equal attention.', activities:P },
};

export function getPrakritiPlan(prakriti: string): PrakritiPlan {
  const primary = prakriti.split('-')[0];
  return PRAKRITI_PLANS[primary] ?? PRAKRITI_PLANS.Vata;
}

export interface PledgeData {
  prakriti: string;
  startDate: string;      // YYYY-MM-DD
  duration: 7 | 21 | 30 | 90;
  signedAt: number;       // Date.now()
  userName: string;
  wakeHour: number;
  wakeMin: number;
  missionId?: string;     // selected wake mission id
}

// ── Wake Missions ─────────────────────────────────────────────────────────────
export interface WakeMission {
  id: string;
  name: string;
  headline: string;
  emoji: string;
  badge: string;
  badgeColor: string;
  time: string;
  wakeHour: number;
  wakeMin: number;
  desc: string;
  perks: string[];
  color: string;
  tier: 'gold' | 'silver' | 'bronze';
}

export const WAKE_MISSIONS: WakeMission[] = [
  {
    id: 'brahma_sadhak',
    name: 'Best Time',
    headline: 'The Ideal Ayurvedic Wake Window',
    emoji: '🕉️',
    badge: '✦ BEST TIME',
    badgeColor: '#F5C842',
    time: '4:00 AM',
    wakeHour: 4, wakeMin: 0,
    desc: 'The purest window of the entire day — when silence is absolute, Vata is Sattvic, and the mind is clearest. Used by yogis, sages and high-performers for five thousand years. Your practices here carry 10× the benefit.',
    perks: ['Peak Brahma Muhurta — highest Sattvic energy', '2+ hrs of pure uninterrupted stillness', 'Deepest Ojas & Prana generation', 'Recommended by ancient Ayurvedic texts'],
    color: '#F5C842',
    tier: 'gold',
  },
  {
    id: 'prana_riser',
    name: 'Better Time',
    headline: 'Within Brahma Muhurta — Strong Alignment',
    emoji: '⚡',
    badge: '◈ BETTER TIME',
    badgeColor: '#a78bfa',
    time: '5:00 AM',
    wakeHour: 5, wakeMin: 0,
    desc: 'Rise within Brahma Muhurta — the air is pure, the mind is clear, and the entire day belongs to you before the world wakes and demands your attention.',
    perks: ['Firmly within Brahma Muhurta', '1+ hour before the world wakes', 'Ideal for working professionals', 'Strong Agni & razor-sharp mental clarity'],
    color: '#a78bfa',
    tier: 'silver',
  },
  {
    id: 'sunrise_grace',
    name: 'Good Start',
    headline: 'Rise With the Sun — Natural & Sustainable',
    emoji: '🌅',
    badge: '○ GOOD START',
    badgeColor: '#10b981',
    time: '6:00 AM',
    wakeHour: 6, wakeMin: 0,
    desc: 'Rise with the sun — a natural, consistent and powerfully sustainable practice. You are already ahead of most of the world and building sacred momentum one morning at a time.',
    perks: ['Natural sunrise alignment', 'Perfect entry point for beginners', 'Consistent & powerfully sustainable', 'Full Dinacharya fits beautifully'],
    color: '#10b981',
    tier: 'bronze',
  },
];

// Returns location-aware wake options adjusted to the user's actual Brahma Muhurta
export function getLocationAwareWakeOptions(
  bm?: { wakeHour: number; wakeMin: number; sunriseHour: number; sunriseMin: number } | null
): WakeMission[] {
  if (!bm) return WAKE_MISSIONS;
  const fmt = (h: number, m: number): string => {
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  };
  const bestH = bm.wakeHour; const bestM = bm.wakeMin;
  const betterTot = bestH * 60 + bestM + 60;
  const betterH = Math.floor(betterTot / 60) % 24; const betterM = betterTot % 60;
  const goodH = bm.sunriseHour; const goodM = bm.sunriseMin;
  return [
    { ...WAKE_MISSIONS[0], wakeHour: bestH, wakeMin: bestM, time: fmt(bestH, bestM) },
    { ...WAKE_MISSIONS[1], wakeHour: betterH, wakeMin: betterM, time: fmt(betterH, betterM) },
    { ...WAKE_MISSIONS[2], wakeHour: goodH, wakeMin: goodM, time: fmt(goodH, goodM) },
  ];
}

// Shift all activities forward/back when user picks a different wake time
function minsToTimeLabel(mins: number): string {
  const total = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(total / 60);
  const m = total % 60;
  const p = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${p}`;
}

/**
 * Override afternoon/evening activity times with solar-accurate values.
 * solar: { solarNoon, sunset } in decimal hours (same shape as SolarTimes from lib/solar).
 */
export function applySolarToActivities(
  activities: DActivity[],
  solar: { solarNoon: number; sunset: number; sunrise?: number },
): DActivity[] {
  const noon = solar.solarNoon * 60;
  const set  = solar.sunset   * 60;
  const rise = (solar.sunrise != null ? solar.sunrise : solar.solarNoon - 6.5) * 60;
  const overrides: Record<string, { startMin: number; endMin: number }> = {
    breakfast:    { startMin: Math.round(rise + 120), endMin: Math.round(rise + 180) },
    lunch:        { startMin: Math.round(noon - 15),  endMin: Math.round(noon + 60)  },
    walk:         { startMin: Math.round(noon + 15),  endMin: Math.round(noon + 90)  },
    herbal_tea:   { startMin: Math.round(set  - 150), endMin: Math.round(set  - 60)  },
    evening_walk: { startMin: Math.round(set  - 60),  endMin: Math.round(set  + 30)  },
    dinner:       { startMin: Math.round(set  + 60),  endMin: Math.round(set  + 150) },
    screen_free:  { startMin: Math.round(set  + 120), endMin: Math.round(set  + 210) },
    journaling:   { startMin: Math.round(set  + 150), endMin: Math.round(set  + 210) },
    sleep:        { startMin: Math.round(set  + 210), endMin: Math.round(set  + 300) },
  };
  return activities.map(a => {
    const o = overrides[a.habitId];
    if (!o) return a;
    return { ...a, startMin: o.startMin, endMin: o.endMin, time: minsToTimeLabel(o.startMin) };
  });
}

export function shiftActivitiesToWake(
  activities: DActivity[],
  fromWakeMin: number,
  toWakeMin: number,
  morningCutoffMin = 720, // noon — afternoon/evening stays Ayurvedic-anchored
): DActivity[] {
  const diff = toWakeMin - fromWakeMin;
  if (diff === 0) return activities;
  return activities.map(a => {
    if (a.startMin >= morningCutoffMin) return a; // keep afternoon/evening fixed
    return {
      ...a,
      startMin: Math.max(0, a.startMin + diff),
      endMin: Math.max(0, a.endMin + diff),
      time: minsToTimeLabel(a.startMin + diff),
    };
  });
}
