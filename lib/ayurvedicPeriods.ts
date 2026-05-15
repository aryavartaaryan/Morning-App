/**
 * Ayurvedic Dosha Period Engine
 * Divides the 24-hour solar day into 6 dosha periods (2 cycles × 3 doshas)
 * based on actual sunrise / sunset from the NOAA solar calculator.
 *
 * Day cycle  : Kapha → Pitta → Vata   (sunrise → sunset)
 * Night cycle: Kapha → Pitta → Vata   (sunset → next sunrise)
 * The pre-dawn Vata window contains Brahma Muhurta (~96–48 min before sunrise).
 */

import type { SolarTimes } from './solar';

export type DoshaType = 'kapha' | 'pitta' | 'vata';

export interface DoshaPeriod {
  id: string;
  dosha: DoshaType;
  label: string;
  startH: number;
  endH: number;
  startLabel: string;
  endLabel: string;
  emoji: string;
  color: string;
  bgColor: string;
  englishLabel: string;
  sciEmoji: string;
  sciTitle: string;
  sciDesc: string;
  activities: string[];
  avoidances: string[];
  status: 'upcoming' | 'active' | 'completed';
  minutesUntil: number;
  minutesRemaining: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const PAD = (n: number) => String(n).padStart(2, '0');

function fmtH(decH: number): string {
  const totalMin = Math.round(decH * 60) % (24 * 60);
  const hh = Math.floor(totalMin / 60) % 24;
  const mm = totalMin % 60;
  const ampm = hh < 12 ? 'AM' : 'PM';
  const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  return `${PAD(h12)}:${PAD(mm)} ${ampm}`;
}

// ── Period static data ────────────────────────────────────────────────────────
export const PERIOD_TEMPLATES = [
  {
    id: 'night_vata',
    dosha: 'vata' as DoshaType,
    label: 'Night Vata',
    englishLabel: 'Pre-Dawn Clarity Window',
    emoji: '✨',
    color: '#818cf8',
    bgColor: 'rgba(129,140,248,0.09)',
    sciEmoji: '🧠',
    sciTitle: 'Pre-Dawn Neuroplasticity Peak',
    sciDesc: 'Alpha & theta brainwaves dominate the pre-dawn hours (EEG confirmed). Cortisol Awakening Response begins its surge. The subconscious–conscious veil is thinnest — neuroplasticity peaks. This window contains the sacred Brahma Muhurta (96–48 min before sunrise) — the pinnacle of this period for meditation and spiritual practice.',
    activities: ['Silent meditation & dhyana', 'Mantra japa / chanting', 'Sacred study & scripture reading', 'Breathwork & deep nervous system reset', 'Sankalpa (intention-setting)', 'Prayer & deep gratitude practice'],
    avoidances: ['Heavy food or drinks', 'Intense physical exertion', 'Digital media & bright screens', 'Loud conversation or noise', 'Checking phone or social media'],
  },
  {
    id: 'morning_kapha',
    dosha: 'kapha' as DoshaType,
    label: 'Morning Kapha',
    englishLabel: 'Anabolic Power Hour',
    emoji: '💪',
    color: '#34d399',
    bgColor: 'rgba(52,211,153,0.08)',
    sciEmoji: '💪',
    sciTitle: 'Anabolic Hormone & Lymphatic Peak',
    sciDesc: 'Cortisol rises to its morning peak. Lymphatic circulation is highest, synovial fluid lubricates joints. Anabolic hormone window — growth hormone & testosterone peak. Optimal for building physical strength.',
    activities: ['Yoga & Sun Salutations', 'Strength training', 'Light nourishing breakfast', 'Abhyanga · oil self-massage', 'Morning walk in sunlight'],
    avoidances: ['Sleeping in / daytime nap', 'Heavy fried breakfast', 'Excessive caffeine', 'Immediately checking phone'],
  },
  {
    id: 'midday_pitta',
    dosha: 'pitta' as DoshaType,
    label: 'Solar Pitta',
    englishLabel: 'Metabolic Fire Peak',
    emoji: '🔥',
    color: '#fb923c',
    bgColor: 'rgba(251,146,60,0.08)',
    sciEmoji: '🧬',
    sciTitle: 'Peak Metabolic Fire Window',
    sciDesc: 'Digestive enzymes (HCl, pepsin, bile acids) at maximum secretion. Core temperature peaks, thyroid & liver activity are highest. Insulin sensitivity is optimal — macronutrient metabolism at its best.',
    activities: ['Main & largest meal of the day', 'Deep focused cognitive work', 'Decision-making & strategy', 'Complex problem-solving', 'Learning new material', 'Important meetings & negotiations'],
    avoidances: ['Skipping or delaying lunch', 'Overworking without breaks', 'Excessive spicy / fried food', 'Anger, conflict & arguments'],
  },
  {
    id: 'afternoon_vata',
    dosha: 'vata' as DoshaType,
    label: 'Vata Flow',
    englishLabel: 'Neural Peak Phase',
    emoji: '🌬️',
    color: '#a78bfa',
    bgColor: 'rgba(167,139,250,0.08)',
    sciEmoji: '⚡',
    sciTitle: 'Neuro-Cognitive & Athletic Peak',
    sciDesc: 'Dopamine & norepinephrine reach daily peaks. Lung vital capacity is highest (3–4 PM confirmed by spirometry studies). Motor coordination, reflex speed & reaction time are optimal — hence most athletic records fall in the afternoon.',
    activities: ['Creative brainstorming & design', 'Sports, exercise & HIIT', 'Collaboration & communication', 'Light snack if needed', 'Walking meetings', 'Learning physical skills'],
    avoidances: ['Heavy afternoon meal', 'Afternoon nap >20 min', 'Isolating from others', 'Suppressing creative impulses'],
  },
  {
    id: 'evening_kapha',
    dosha: 'kapha' as DoshaType,
    label: 'Kapha Dusk',
    englishLabel: 'Parasympathetic Wind-Down',
    emoji: '🌅',
    color: '#34d399',
    bgColor: 'rgba(52,211,153,0.06)',
    sciEmoji: '🌙',
    sciTitle: 'Circadian Wind-Down Phase',
    sciDesc: 'Melatonin synthesis begins as ambient light fades. Core temperature drops ~0.5°C/hr. Cortisol declines, parasympathetic NS activates — body enters anabolic rest-preparation mode. Blue-light now disrupts sleep more than any other time.',
    activities: ['Light early dinner (before 7 PM)', 'Family & social bonding', 'Gentle yoga / stretching', 'Journaling & self-reflection', 'Gratitude practice', 'Prepare / plan for next day'],
    avoidances: ['Heavy late dinner', 'Bright screen use after 8 PM', 'Stimulating intense exercise', 'Emotionally heated conversations'],
  },
  {
    id: 'night_pitta',
    dosha: 'pitta' as DoshaType,
    label: 'Nocturnal Pitta',
    englishLabel: 'Deep Repair & Detox Phase',
    emoji: '🌕',
    color: '#fbbf24',
    bgColor: 'rgba(251,191,36,0.06)',
    sciEmoji: '🔬',
    sciTitle: 'Nocturnal Repair & Detox Phase',
    sciDesc: 'Growth Hormone (GH) secretion peaks during slow-wave sleep. Liver Phase I & II detoxification enzymes are maximally active. Cellular autophagy, protein synthesis & DNA repair — the body literally rebuilds itself every night.',
    activities: ['Deep uninterrupted sleep (7–8 hrs)', 'Maintain intermittent fasting window', 'Allow full REM & deep-sleep cycles', 'Dream journaling upon waking'],
    avoidances: ['Eating or drinking (except water)', 'Blue-light & screen exposure', 'Stimulants · caffeine, sugar', 'Overthinking or emotional rumination'],
  },
];

// ── Core engine ───────────────────────────────────────────────────────────────
export function getDoshaPeriods(solar: SolarTimes, nowH: number): DoshaPeriod[] {
  const { sunrise, sunset } = solar;
  const dayLen   = sunset - sunrise;
  const nightLen = 24 - dayLen;
  const daySeg   = dayLen / 3;
  const nightSeg = nightLen / 3;

  // Absolute hour ranges (night periods may exceed 24 — spans midnight)
  // Order: predawn, morning-kapha, midday-pitta, afternoon-vata, evening-kapha, night-pitta
  const RANGES: [string, number, number][] = [
    ['night_vata',     sunset + 2 * nightSeg,  sunset + nightLen],   // e.g. 26–30 = 2–6 AM
    ['morning_kapha',   sunrise,                sunrise + daySeg],    // e.g. 6–10 AM
    ['midday_pitta',    sunrise + daySeg,        sunrise + 2 * daySeg],
    ['afternoon_vata',  sunrise + 2 * daySeg,    sunset],
    ['evening_kapha',   sunset,                  sunset + nightSeg],  // e.g. 18–22
    ['night_pitta',     sunset + nightSeg,        sunset + 2 * nightSeg],
  ];

  // Normalise nowH so early-morning hours map to the night cycle
  const nowNorm = nowH < sunrise ? nowH + 24 : nowH;

  return RANGES.map(([id, absStart, absEnd]) => {
    const tmpl = PERIOD_TEMPLATES.find(t => t.id === id)!;

    let status: 'upcoming' | 'active' | 'completed';
    let minutesUntil = 0;
    let minutesRemaining = 0;

    if (nowNorm < absStart) {
      status = 'upcoming';
      minutesUntil = Math.max(1, Math.round((absStart - nowNorm) * 60));
    } else if (nowNorm < absEnd) {
      status = 'active';
      minutesRemaining = Math.max(1, Math.round((absEnd - nowNorm) * 60));
    } else {
      status = 'completed';
    }

    // Display labels: wrap to 0-24
    const displayStart = absStart % 24;
    const displayEnd   = absEnd   % 24;

    return {
      ...tmpl,
      startH:     displayStart,
      endH:       displayEnd,
      startLabel: fmtH(displayStart),
      endLabel:   fmtH(displayEnd),
      status,
      minutesUntil,
      minutesRemaining,
    } as DoshaPeriod;
  });
}

export function getCurrentPeriod(solar: SolarTimes, nowH: number): DoshaPeriod | null {
  return getDoshaPeriods(solar, nowH).find(p => p.status === 'active') ?? null;
}
