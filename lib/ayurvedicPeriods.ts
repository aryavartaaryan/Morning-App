/**
 * Ayurvedic Dosha Period Engine
 * Divides the 24-hour solar day into 6 dosha periods (2 cycles × 3 doshas)
 * based on actual sunrise / sunset from the NOAA solar calculator.
 *
 * Day cycle  : Kapha → Pitta → Vata   (sunrise → sunset)
 * Night cycle: Kapha → Pitta → Vata   (sunset → next sunrise)
 * The pre-dawn Vata window contains Brahma Muhurta (~96–48 min before sunrise).
 */

import { getSolarTimes, type SolarTimes } from './solar';
import notifee, { AndroidImportance, AndroidVisibility, TriggerType, RepeatFrequency } from '@notifee/react-native';
import { Platform } from 'react-native';

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
    englishLabel: 'Neuroplasticity Peak Hour',
    emoji: '✨',
    color: '#c7d2e0',
    bgColor: 'rgba(199,210,224,0.08)',
    sciEmoji: '🧠',
    sciTitle: 'Pre-Dawn Neuroplasticity Peak',
    sciDesc: 'Alpha & theta brainwaves dominate the pre-dawn hours (EEG confirmed). Cortisol Awakening Response begins its surge. The subconscious–conscious veil is thinnest — neuroplasticity peaks. This window contains the sacred Brahma Muhurta (96–48 min before sunrise) — the pinnacle of this period for meditation and spiritual practice.',
    activities: ['Silent meditation & dhyana', 'Mantra japa / chanting', 'Sacred study & scripture reading', 'Breathwork & deep nervous system reset', 'Sankalpa (intention-setting)', 'Prayer & deep gratitude practice'],
    avoidances: ['Heavy food or drinks', 'Intense physical exertion', 'Digital media & bright screens', 'Loud conversation or noise', 'Checking phone or social media'],
  },
  {
    id: 'morning_kapha_early',
    dosha: 'kapha' as DoshaType,
    label: 'Early Morning Kapha',
    englishLabel: 'Yoga & Meditation',
    emoji: '🧘',
    color: '#FFD700',
    bgColor: 'rgba(255,215,0,0.08)',
    sciEmoji: '🧘',
    sciTitle: 'Cortisol Awakening & Mindfulness Window',
    sciDesc: 'Optimal time for grounding the nervous system before the active day begins. Gentle movement and mindfulness practice.',
    activities: ['Yoga & Asana practice', 'Meditation & Mindfulness', 'Deep breathing exercises', 'Gentle stretching'],
    avoidances: ['Heavy breakfast', 'High-intensity workouts', 'Checking emails immediately'],
  },
  {
    id: 'morning_kapha',
    dosha: 'kapha' as DoshaType,
    label: 'Morning Kapha',
    englishLabel: 'Rise & Build',
    emoji: '💪',
    color: '#FFD700',
    bgColor: 'rgba(255,215,0,0.08)',
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
    englishLabel: 'Peak Focus Period',
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
    id: 'midday_pitta_late',
    dosha: 'pitta' as DoshaType,
    label: 'Digestive Pitta',
    englishLabel: 'Energy Dip Phase',
    emoji: '🍃',
    color: '#f59e0b',
    bgColor: 'rgba(245,158,11,0.08)',
    sciEmoji: '🩸',
    sciTitle: 'Post-Solar Digestive Dip',
    sciDesc: 'As the sun crosses its zenith, your body shifts blood flow to the digestive tract. A natural post-solar cortisol dip occurs, triggering a mild rest phase. This is an optimal window for digestion, not high-cognitive output.',
    activities: ['Rest and digest', 'Light walking to aid digestion', 'Low-cognitive routine tasks', 'Brief restorative pause'],
    avoidances: ['High-stakes decision making', 'Intense physical exertion immediately after eating', 'Excessive caffeine to fight the dip', 'Deep focused cognitive work'],
  },
  {
    id: 'afternoon_vata',
    dosha: 'vata' as DoshaType,
    label: 'Vata Flow',
    englishLabel: 'Creative Peak Hours',
    emoji: '⚡',
    color: '#a78bfa',
    bgColor: 'rgba(167,139,250,0.08)',
    sciEmoji: '⚡',
    sciTitle: 'Your brain & body are at their sharpest now',
    sciDesc: 'Your focus, creativity, and energy all peak together in this window. Great time to create, move, collaborate, or learn anything new. Most athletic records are broken in the afternoon for a reason.',
    activities: ['Creative brainstorming & design', 'Sports, exercise & HIIT', 'Collaboration & communication', 'Light snack if needed', 'Walking meetings', 'Learning physical skills'],
    avoidances: ['Heavy afternoon meal', 'Afternoon nap >20 min', 'Isolating from others', 'Suppressing creative impulses'],
  },
  {
    id: 'evening_kapha',
    dosha: 'kapha' as DoshaType,
    label: 'Kapha Dusk',
    englishLabel: 'Evening Wind Down',
    emoji: '🌙',
    color: '#c7d2e0',
    bgColor: 'rgba(199,210,224,0.06)',
    sciEmoji: '🌙',
    sciTitle: 'Circadian Wind-Down Phase',
    sciDesc: 'Melatonin synthesis begins as ambient light fades. Core temperature drops ~0.5°C/hr. Cortisol declines, parasympathetic NS activates — body enters anabolic rest-preparation mode. Blue-light now disrupts sleep more than any other time.',
    activities: ['Early light dinner', 'Family & social bonding', 'Gentle yoga / stretching', 'Journaling & self-reflection', 'Gratitude practice', 'Prepare / plan for next day'],
    avoidances: ['Heavy late dinner', 'Bright screen use after 8 PM', 'Stimulating intense exercise', 'Emotionally heated conversations'],
  },
  {
    id: 'night_pitta',
    dosha: 'pitta' as DoshaType,
    label: 'Nocturnal Pitta',
    englishLabel: 'Deep Repair & Detox Phase',
    emoji: '🌕',
    color: '#F59E0B',
    bgColor: 'rgba(245,158,11,0.06)',
    sciEmoji: '🧬',
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
  // Brahma Muhurta starts exactly 96 min (1.6 h) before sunrise — traditional definition.
  // night_vata (pre-dawn clarity) covers that window; it shifts daily with solar sunrise.
  // night_pitta (deep sleep) fills from end of evening_kapha to Brahma Muhurta onset.
  const brahmaMuhurta = sunrise + 24 - (96 / 60); // 96 min before next sunrise

  // Energy Dip: starts 1.5 hrs after solar noon, ends 3 hrs after solar noon (~90 min dip)
  // This matches the circadian alertness trough confirmed by chronobiology research.
  // Capped so it never overlaps sunset (edge case protection).
  const dipStart = solar.solarNoon + 1.5;
  const dipEnd   = Math.min(solar.solarNoon + 3, sunset - 0.5);
  // Afternoon Vata starts right when the dip ends — anchored to real sun position.
  const vataStart = dipEnd;

  // Order: predawn, morning-kapha-early, morning-kapha, midday-pitta, energy-dip, afternoon-vata, evening-kapha, night-pitta
  const RANGES: [string, number, number][] = [
    ['night_vata',          brahmaMuhurta,  sunrise + 24],  // Brahma Muhurta → sunrise
    ['morning_kapha_early', sunrise,        sunrise + daySeg / 2], // e.g. 6–8 AM
    ['morning_kapha',       sunrise + daySeg / 2, sunrise + daySeg], // e.g. 8–10 AM
    ['midday_pitta',        sunrise + daySeg, dipStart],    // Peak focus: ~10 AM → 1:30 PM
    ['midday_pitta_late',   dipStart,       dipEnd],         // Energy Dip: ~1:30 PM → 3:00 PM (sun-based)
    ['afternoon_vata',      vataStart,      sunset],         // Creative peak: ~3 PM → sunset
    ['evening_kapha',       sunset,         sunset + nightSeg], // e.g. 6:30–10 PM
    ['night_pitta',         sunset + nightSeg, brahmaMuhurta], // deep sleep until Brahma Muhurta
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

export function getHeroRingContent(periodId: string, brahmaActive: boolean): {
  subPill: string;
  header: string;
  sentence: string;
  sciLabel: string;
  actionText: string;
} {
  if (brahmaActive) {
    return {
      subPill: 'BRAHMA MUHURTA · OPEN NOW',
      header: 'Neuroplasticity Peak Hours',
      sentence: 'Your subconscious and conscious merge. The clearest thinking of your life.',
      sciLabel: 'Alpha-Theta Brainwave State · Cortisol Awakening Response begins',
      actionText: 'Listen & meditate',
    };
  }
  if (periodId === 'midday_pitta') {
    return {
      subPill: 'PEAK FOCUS PERIOD',
      header: 'Peak Focus Period',
      sentence: 'Your metabolic fire and mental sharpness peak together. Decide. Create. Execute.',
      sciLabel: 'Peak Metabolic Fire · HCl + Pepsin + Bile at maximum · Thyroid apex',
      actionText: 'Listen & work',
    };
  }
  if (periodId === 'midday_pitta_late') {
    return {
      subPill: 'ENERGY DIP PHASE',
      header: 'Energy Dip Phase',
      sentence: 'Your body enters a natural rest cycle. Digestion takes priority over focus.',
      sciLabel: 'Post-Solar Cortisol Dip · Melatonin Micro-Pulse · Digestive Blood Flow peaks',
      actionText: 'Listen & rest',
    };
  }
  switch (periodId) {
    case 'night_vata':
      return {
        subPill: 'BRAHMA MUHURTA WINDOW',
        header: 'Neuroplasticity Peak Hours',
        sentence: 'Your subconscious and conscious merge. The clearest thinking of your life.',
        sciLabel: 'Alpha-Theta Brainwave State · Cortisol Awakening Response begins',
        actionText: 'Listen & meditate',
      };
    case 'morning_kapha_early':
      return {
        subPill: 'MORNING KAPHA PERIOD',
        header: 'Yoga & Meditation Hour',
        sentence: 'Ground your nervous system. Perfect time for mindfulness and gentle stretching.',
        sciLabel: 'Cortisol Awakening & Mindfulness Window',
        actionText: 'Listen & stretch',
      };
    case 'morning_kapha':
      return {
        subPill: 'MORNING KAPHA PERIOD',
        header: 'Rise & Build Hours',
        sentence: 'Your hormones are primed to build. Move now and it compounds all day.',
        sciLabel: 'Anabolic Hormone Peak · Lymphatic Clearance · Cortisol Rising',
        actionText: 'Listen & work out',
      };
    case 'afternoon_vata':
      return {
        subPill: 'AFTERNOON VATA PERIOD',
        header: 'Creative Peak Hours',
        sentence: 'Your body is built to move and create right now. Peak athletic window.',
        sciLabel: 'Lung Capacity Peak · Reaction Time Fastest · Neuromuscular Coordination',
        actionText: 'Listen & get spark',
      };
    case 'evening_kapha':
      return {
        subPill: 'EVENING KAPHA PERIOD',
        header: 'Evening Wind Down Hours',
        sentence: 'Melatonin is rising. Your nervous system is ready to let go.',
        sciLabel: 'Melatonin Synthesis Begins · Core Temp Drops · Parasympathetic NS Active',
        actionText: 'Listen & wind down',
      };
    case 'night_pitta':
      return {
        subPill: 'DEEP REPAIR PHASE',
        header: 'Deep Repair Hours',
        sentence: 'Your body is in complete detox mode. Take deep sleep.',
        sciLabel: 'Liver Detox Phase I & II · Growth Hormone Surge · Cellular Autophagy Active',
        actionText: 'Listen & sleep',
      };
    default:
      return {
        subPill: 'AYURVEDIC CYCLE',
        header: 'Circadian Rhythm',
        sentence: 'Align with nature.',
        sciLabel: 'Biological synchronization',
        actionText: 'Listen & align',
      };
  }
}

export const CIRCADIAN_CHANNEL = 'arise-circadian-cycle';

// ── Elegant Western-science circadian notification copy per period ─────────────
const CIRCADIAN_NOTIF_CONTENT: Record<string, { title: string; body: string; sub: string; color: string }> = {
  night_vata: {
    title:  '✨ Pre-Dawn Alpha State',
    body:   'Theta-alpha brainwave dominance is peaking. The boundary between subconscious and conscious is at its thinnest. Ideal window for meditation, intention-setting and deep breathwork.',
    sub:    'Circadian Cycle · Night Vata',
    color:  '#c7d2e0',
  },
  morning_kapha_early: {
    title:  '🧘 Yoga & Meditation Hour',
    body:   'Cortisol is beginning its ascent. This is the optimal window to ground your nervous system before the active day begins. Focus on gentle movement and mindfulness.',
    sub:    'Circadian Cycle · Early Morning Kapha',
    color:  '#FFD700',
  },
  morning_kapha: {
    title:  '💪 Anabolic Window — Move Now',
    body:   'Cortisol, growth hormone and lymphatic clearance are all peaking together. Your body is primed to build. Every minute of movement now compounds for the rest of the day.',
    sub:    'Circadian Cycle · Morning Kapha',
    color:  '#FFD700',
  },
  midday_pitta: {
    title:  '🔥 Metabolic Peak — Your Sharpest Hour',
    body:   'HCl, pepsin and bile acid secretion are at maximum. Digestive fire is strongest. Eat your main meal. Make bold decisions. Your mind and metabolism are perfectly aligned right now.',
    sub:    'Circadian Cycle · Solar Pitta',
    color:  '#fb923c',
  },
  midday_pitta_late: {
    title:  '🍃 Post-Solar Dip — Rest Phase',
    body:   'Cortisol drops post-solar peak. A natural energy lull is normal and necessary. Light movement or a short rest will restore clarity for the Vata creative window ahead.',
    sub:    'Circadian Cycle · Digestive Pitta',
    color:  '#a3e635',
  },
  afternoon_vata: {
    title:  '⚡ Neuromuscular Peak — Create or Move',
    body:   'Reaction time, lung capacity and athletic performance are peaking. Your nervous system is at its most wired and creative. Use this window to move, create or solve complex problems.',
    sub:    'Circadian Cycle · Afternoon Vata',
    color:  '#a78bfa',
  },
  evening_kapha: {
    title:  '🌙 Melatonin Rising — Wind Down',
    body:   'Melatonin synthesis has begun. Your parasympathetic nervous system is activating. Lower your screen brightness. Eat light. Every choice you make now directly shapes your sleep architecture tonight.',
    sub:    'Circadian Cycle · Evening Kapha',
    color:  '#818cf8',
  },
  night_pitta: {
    title:  '🔬 Cellular Repair — Protect Your Sleep',
    body:   'Liver detox Phase I and II are active. Growth hormone is surging. Cellular autophagy is clearing damaged proteins. Deep, uninterrupted sleep is the only way to not disrupt this process.',
    sub:    'Circadian Cycle · Night Pitta',
    color:  '#60a5fa',
  },
};

export async function scheduleCircadianNotifs(lat: number, lon: number): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await notifee.createChannel({
      id: CIRCADIAN_CHANNEL,
      name: 'Circadian Rhythm Alerts',
      importance: AndroidImportance.DEFAULT,
      vibration: false,
      bypassDnd: false,
      visibility: AndroidVisibility.PUBLIC,
    } as any);

    const solar = getSolarTimes(lat, lon);
    const periods = getDoshaPeriods(solar, new Date().getHours());
    const now = Date.now();

    for (const period of periods) {
      const content = CIRCADIAN_NOTIF_CONTENT[period.id] ?? {
        title: '⏱ Circadian Phase Shift',
        body:  'Your body rhythm has entered a new biological phase. Align your actions with your biology.',
        sub:   'Circadian Cycle',
        color: '#38bdf8',
      };
      const notifId = `circadian-${period.id}`;

      const fire = new Date();
      const fireH = Math.floor(period.startH);
      const fireM = Math.round((period.startH - fireH) * 60);
      fire.setHours(fireH, fireM, 0, 0);
      if (fire.getTime() <= now) fire.setDate(fire.getDate() + 1);

      await notifee.cancelTriggerNotification(notifId).catch(() => {});
      await notifee.createTriggerNotification(
        {
          id: notifId,
          title: content.title,
          body:  content.body,
          android: {
            channelId: CIRCADIAN_CHANNEL,
            importance: AndroidImportance.DEFAULT,
            visibility: AndroidVisibility.PUBLIC,
            pressAction: { id: 'default', launchActivity: 'default' },
            color: content.color,
            showTimestamp: false,
            subText: content.sub,
          } as any,
        },
        {
          type: TriggerType.TIMESTAMP,
          timestamp: fire.getTime(),
          repeatFrequency: RepeatFrequency.DAILY,
          alarmManager: { allowWhileIdle: true },
        } as any,
      );
    }
  } catch (e) {
    console.warn('[Circadian] schedule failed:', e);
  }
}

export async function cancelCircadianNotifs(lat: number, lon: number): Promise<void> {
  const solar = getSolarTimes(lat, lon);
  const periods = getDoshaPeriods(solar, 12);
  for (const period of periods) {
    await notifee.cancelTriggerNotification(`circadian-${period.id}`).catch(() => {});
  }
}

// ── Real-time circadian notification (fires when hero ring changes period) ──────
// Call this from index.tsx when currentPeriod.id changes.
export async function fireCircadianNotification(period: DoshaPeriod): Promise<void> {
  try {
    const content = CIRCADIAN_NOTIF_CONTENT[period.id] ?? {
      title: '⏱ Circadian Phase Shift',
      body:  'Your body rhythm has entered a new biological phase. Align your actions with your biology.',
      sub:   'Circadian Cycle',
      color: '#38bdf8',
    };

    await notifee.createChannel({
      id: CIRCADIAN_CHANNEL,
      name: 'Circadian Rhythm Alerts',
      importance: AndroidImportance.DEFAULT,
      vibration: false,
      bypassDnd: false,
      visibility: AndroidVisibility.PUBLIC,
    } as any);

    await notifee.displayNotification({
      id: `circadian-live-${period.id}`,
      title: content.title,
      body:  content.body,
      android: {
        channelId: CIRCADIAN_CHANNEL,
        importance: AndroidImportance.DEFAULT,
        visibility: AndroidVisibility.PUBLIC,
        pressAction: { id: 'default', launchActivity: 'default' },
        color: content.color,
        showTimestamp: true,
        subText: content.sub,
        autoCancel: true,
      } as any,
    });
  } catch (e) {
    console.warn('[Circadian] live notification failed:', e);
  }
}

