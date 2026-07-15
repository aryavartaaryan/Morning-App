import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Image } from 'react-native';
import { getBgSource, getBgSourceSync, BG_URLS, bgWarmup } from '@/lib/bgImages';
import { getSolarTimes } from '@/lib/solar';
import { store, KEYS } from '@/lib/storage';

// ── Wallpaper Mode storage key ─────────────────────────────────────────────
const WP_MODE_KEY   = 'morning_wp_mode_v1';    // 'solar' | 'manual'
const WP_MANUAL_KEY = 'morning_wp_manual_v1';  // key from BG_KEYS

// ── All background images with display metadata ────────────────────────────
export const BG_KEYS = [
  'brahma', 'predawn', 'predawn_mid', 'sunrise', 'sunrise_2', 'sunrise_late', 'sunrise_late_2', 'morning_early', 'morning_early_late', 'morning', 'morning_late', 'morning_late_2',
  'midday_early', 'midday_early_2', 'midday_early_mid', 'midday_early_late', 'midday', 'midday_mid', 'midday_late', 'midday_late_2', 'afternoon', 'afternoon_first_late', 'afternoon_mid', 'afternoon_late', 'sandhya', 'sandhya_mid', 'sandhya_late', 'sandhya_late_mid', 'sandhya_late_mid_2', 'sandhya_late_2', 'sandhya_late_3', 'twilight', 'twilight_late', 'twilight_deep', 'evening_early', 'evening_early_2', 'evening', 'night_early', 'night_early_mid1', 'night_early_mid2', 'night_early_mid2_late', 'night_early_late', 'night', 'night_late',
] as const;
export type BgKey = typeof BG_KEYS[number];

export const BG_META: Record<BgKey, { label: string; sub: string; emoji: string; time: string }> = {
  brahma:    { label: 'Brahma Muhurta', sub: 'The sacred pre-dawn',      emoji: '🌌', time: '4–5 AM' },
  predawn:   { label: 'Pre-Dawn Horizon', sub: 'First glow of morning',    emoji: '🌄', time: '5–5:10 AM' },
  predawn_mid: { label: 'Pre-Dawn Twilight', sub: 'Soft light on horizon',    emoji: '🌅', time: '5:10–5:20 AM' },
  sunrise:   { label: 'Sunrise',        sub: 'Golden hour clarity',      emoji: '🌅', time: '5:20–6:45 AM' },
  sunrise_2: { label: 'Sunrise Second Half', sub: 'Golden hour continues', emoji: '🌅', time: '6:00–6:45 AM' },
  sunrise_late: { label: 'Sunrise Golden Glow', sub: 'Morning light settling',   emoji: '🌅', time: '6:45–7:22 AM' },
  sunrise_late_2: { label: 'Morning Horizon',  sub: 'Morning light settles',   emoji: '🌅', time: '7:22–8 AM' },
  morning_early: { label: 'Early Morning', sub: 'Fresh Kapha sunrise glow', emoji: '🌱', time: '8–8:20 AM' },
  morning_early_late: { label: 'Early Morning Mist', sub: 'Fresh Kapha morning glow', emoji: '🌱', time: '8:20–8:40 AM' },
  morning:   { label: 'Morning Energy', sub: 'Kapha energy, lush green', emoji: '🌿', time: '8:40–9:20 AM' },
  morning_late: { label: 'Bright Morning', sub: 'Bright Kapha clarity',   emoji: '🌳', time: '9:20–9:40 AM' },
  morning_late_2: { label: 'Late Morning Sun', sub: 'Bright Kapha clarity deepens',   emoji: '🌳', time: '9:40–10 AM' },
  midday_early: { label: 'Midday Ascent', sub: 'Rising solar energy',   emoji: '☀️', time: '10–10:20 AM' },
  midday_early_2: { label: 'High Sun Rise', sub: 'Rising solar energy',   emoji: '☀️', time: '10:20–10:40 AM' },
  midday_early_mid: { label: 'Midday Warmth', sub: 'Solar warmth builds', emoji: '☀️', time: '10:40–11:20 AM' },
  midday_early_late: { label: 'Pre-Noon Sun', sub: 'Approaching peak sun', emoji: '🔥', time: '11:20 AM–12 PM' },
  midday:    { label: 'Solar Noon', sub: 'Peak solar begins',      emoji: '🔥', time: '12–12:40 PM' },
  midday_mid: { label: 'Peak Solar Noon',  sub: 'Solar intensity peaks',  emoji: '☀️', time: '12:40–1:20 PM' },
  midday_late: { label: 'Post-Noon Heat', sub: 'Peak solar begins to wane',       emoji: '🌤️', time: '1:20–1:40 PM' },
  midday_late_2: { label: 'Early Afternoon Sun', sub: 'Peak solar wanes further',       emoji: '🌤️', time: '1:40–2 PM' },
  afternoon: { label: 'Golden Afternoon', sub: 'Warm Pitta fire begins',   emoji: '🌤️', time: '2–2:30 PM' },
  afternoon_first_late: { label: 'Late Afternoon Warmth', sub: 'Warm Pitta fire deepens', emoji: '🌤️', time: '2:30–3 PM' },
  afternoon_mid: { label: 'Mellow Afternoon',  sub: 'Pitta warmth deepens',    emoji: '🔥', time: '3–4 PM' },
  afternoon_late: { label: 'Late Afternoon Light', sub: 'Golden late light',       emoji: '', time: '4–5 PM' },
  sandhya:   { label: 'Sunset Hour',  sub: 'Sacred golden sunset',     emoji: '🌇', time: '5:30–5:52 PM' },
  sandhya_mid: { label: 'Golden Sunset', sub: 'Deepening sacred sunset', emoji: '🌇', time: '5:52–6:15 PM' },
  sandhya_late: { label: 'Sunset Horizon', sub: 'Last golden light', emoji: '🌅', time: '6:15–6:26 PM' },
  sandhya_late_mid: { label: 'Crimson Sunset', sub: 'Deepening golden light', emoji: '🌅', time: '6:26–6:32 PM' },
  sandhya_late_mid_2: { label: 'Final Sunset Glow', sub: 'Final deep gold', emoji: '🌅', time: '6:32–6:37 PM' },
  sandhya_late_2: { label: 'Early Dusk', sub: 'Final embers before twilight', emoji: '🌇', time: '6:37–6:51 PM' },
  sandhya_late_3: { label: 'Dusk Fall', sub: 'Deepening final embers', emoji: '🌇', time: '6:51–7:05 PM' },
  twilight:  { label: 'Twilight Dusk',       sub: 'Dusk — Vata meets Kapha',  emoji: '🌆', time: '7:05–7:15 PM' },
  twilight_late: { label: 'Deep Twilight', sub: 'Deepening dusk glow', emoji: '🌇', time: '7:15–7:25 PM' },
  twilight_deep: { label: 'Cosmic Dusk', sub: 'Stars beginning to rise', emoji: '🌌', time: '7:25–7:35 PM' },
  evening_early: { label: 'Early Evening Calm', sub: 'Cool night energy settling', emoji: '🌃', time: '7:30–7:52 PM' },
  evening_early_2: { label: 'Early Evening Calm', sub: 'Cool night energy settling', emoji: '🌃', time: '7:52–8:15 PM' },
  evening:   { label: 'Evening Calm',        sub: 'Cool night energy',        emoji: '🌃', time: '8:15–9 PM' },
  night_early: { label: 'Early Night', sub: 'Early stillness descends', emoji: '🌌', time: '9 PM–9:52 PM' },
  night_early_mid1: { label: 'Night Quietude', sub: 'Quiet deepens', emoji: '🌌', time: '9:52 PM–10:18 PM' },
  night_early_mid2: { label: 'Night Stillness', sub: 'Quiet deepens', emoji: '🌌', time: '10:18 PM–10:32 PM' },
  night_early_mid2_late: { label: 'Midnight Silence', sub: 'Quiet deepens further', emoji: '🌌', time: '10:32 PM–10:45 PM' },
  night_early_late: { label: 'Midnight Deep', sub: 'Stillness deepens', emoji: '🌌', time: '10:45 PM–12:30 AM' },
  night:     { label: 'Late Night Stillness',   sub: 'Deep Vata stillness',      emoji: '🌙', time: '12:30 AM–2:15 AM' },
  night_late: { label: 'Deep Night Rest',   sub: 'Darkest hours of rest',    emoji: '🌑', time: '2:15 AM–4 AM' },
};

// ── Calm-style warm accent colours per solar period ───────────────────────────
export const BG_ACCENT_COLORS: Record<string, string> = {
  brahma:    '#0C0820',
  predawn:   '#091228',
  predawn_mid: '#0A142C',
  sunrise:   '#2A1200',
  sunrise_late: '#1A1800',
  sunrise_late_2: '#181700',
  morning_early: '#0A1602',
  morning_early_late: '#0C1803',
  morning:   '#0E1A04',
  morning_late: '#121E04',
  morning_late_2: '#121E04',
  midday_early: '#1E1200',
  midday_early_2: '#1F1300',
  midday_early_mid: '#221400',
  midday_early_late: '#261600',
  midday:    '#1C1400',
  midday_mid: '#201400',
  midday_late: '#241200',
  midday_late_2: '#241200',
  afternoon: '#1E1000',
  afternoon_first_late: '#201200',
  afternoon_mid: '#221400',
  afternoon_late: '#261200',
  sandhya:   '#281000',
  sandhya_mid: '#291100',
  sandhya_late: '#2A1200',
  sandhya_late_mid: '#2B1300',
  sandhya_late_2: '#2C1400',
  sandhya_late_3: '#2D1600',
  twilight:  '#150A20',
  twilight_late: '#1A0B26',
  twilight_deep: '#100818',
  evening_early: '#090614',
  evening_early_2: '#090614',
  evening:   '#090614',
  night_early: '#08051A',
  night_early_mid1: '#070416',
  night_early_mid2: '#070416',
  night_early_mid2_late: '#070416',
  night_early_late: '#060312',
  night: '#04020C',
  night_late: '#020108',
};

export const BG_GRADIENT_START: Record<string, string> = {
  brahma:    '#180D3C',
  predawn:   '#101E40',
  predawn_mid: '#122244',
  sunrise:   '#4A2200',
  sunrise_late: '#363200',
  sunrise_late_2: '#343000',
  morning_early: '#163006',
  morning_early_late: '#193007',
  morning:   '#1C3008',
  morning_late: '#22380A',
  morning_late_2: '#22380A',
  midday_early: '#3C2800',
  midday_early_2: '#3E2900',
  midday_early_mid: '#402A00',
  midday_early_late: '#442C00',
  midday:    '#3A2600',
  midday_mid: '#3E2800',
  midday_late: '#422A00',
  midday_late_2: '#422A00',
  afternoon: '#361C00',
  afternoon_first_late: '#381E00',
  afternoon_mid: '#3A2000',
  afternoon_late: '#3E2400',
  sandhya:   '#441800',
  sandhya_mid: '#471A00',
  sandhya_late: '#4A2200',
  sandhya_late_mid: '#4C2400',
  sandhya_late_mid_2: '#4D2500',
  sandhya_late_2: '#4E2600',
  sandhya_late_3: '#502800',
  twilight:  '#260D38',
  twilight_late: '#2C0E40',
  twilight_deep: '#1B0B28',
  evening_early: '#0E0A24',
  evening_early_2: '#0E0A24',
  evening:   '#0E0A24',
  night_early: '#0A0620',
  night_early_mid1: '#09051B',
  night_early_mid2: '#09051B',
  night_early_mid2_late: '#09051B',
  night_early_late: '#080415',
  night: '#060310',
  night_late: '#04020A',
};

export function getTimedBgKey(
  h: number,
  solar?: { sunrise: number; solarNoon: number; sunset: number } | null,
): string {
  if (solar) {
    const { sunrise, solarNoon, sunset } = solar;
    const dayLen = sunset - sunrise;
    const kaphaPeriodEnd = sunrise + dayLen / 3;
    const brahmaMuhurtaStart = sunrise - (96 / 60);

    const getNightPhase = (hour: number) => {
      const nStart = sunset + 2;
      const nEnd = brahmaMuhurtaStart + 24;
      const nDur = nEnd - nStart;
      const q1 = nStart + nDur / 4;
      const q2 = nStart + (nDur * 2) / 4;
      const q3 = nStart + (nDur * 3) / 4;
      const hAdj = hour < brahmaMuhurtaStart ? hour + 24 : hour;
      if (hAdj < q1) {
        const q1Half = nStart + (q1 - nStart) / 2;
        if (hAdj < q1Half) return 'night_early';
        const q1MidHalf = q1Half + (q1 - q1Half) / 2;
        if (hAdj < q1MidHalf) return 'night_early_mid1';
        const q1MidHalf2 = q1MidHalf + (q1 - q1MidHalf) / 2;
        if (hAdj < q1MidHalf2) return 'night_early_mid2';
        return 'night_early_mid2_late';
      }
      if (hAdj < q2) return 'night_early_late';
      if (hAdj < q3) return 'night';
      return 'night_late';
    };

    if (h < brahmaMuhurtaStart) return getNightPhase(h);
    if (h < sunrise - 0.3) return 'brahma';
    const predawnDuration = (sunrise + 0.5) - (sunrise - 0.3);
    const predawnStep = 0.5 / 4;
    if (h < sunrise - 0.3 + predawnStep * 1) return 'predawn';
    if (h < sunrise - 0.3 + predawnStep * 3) return 'predawn_mid';
    if (h < sunrise + 0.5) return 'sunrise';
    if (h < sunrise + 1)   return 'sunrise_2';
    if (h < sunrise + 1.5) return 'sunrise_late';
    if (h < sunrise + 2)   return 'sunrise_late_2';
    const morningWindow = kaphaPeriodEnd - (sunrise + 2);
    const morningThird1 = sunrise + 2 + morningWindow / 3;
    const morningEarlyMid = sunrise + 2 + (morningWindow / 3) / 2;
    const morningThird2 = sunrise + 2 + morningWindow * 2 / 3;
    if (h < morningEarlyMid) return 'morning_early';
    if (h < morningThird1) return 'morning_early_late';
    if (h < morningThird2)  return 'morning';
    const morningLateStart = morningThird2;
    const morningLateHalf = morningLateStart + (kaphaPeriodEnd - morningLateStart) / 2;
    if (h < morningLateHalf) return 'morning_late';
    if (h < kaphaPeriodEnd) return 'morning_late_2';
    const middayEarlyStart = kaphaPeriodEnd;
    const middayEarlyEnd = solarNoon - 0.5;
    const middayEarlyDuration = middayEarlyEnd - middayEarlyStart;
    const middayEarlyStep = middayEarlyDuration / 4;
    if (h < middayEarlyStart + middayEarlyStep * 1) return 'midday_early';
    if (h < middayEarlyStart + middayEarlyStep * 2) return 'midday_early_2';
    if (h < middayEarlyStart + middayEarlyStep * 3) return 'midday_early_mid';
    if (h < middayEarlyEnd) return 'midday_early_late';
    const middayStart = solarNoon - 0.5;
    const middayEnd = solarNoon + 1.5;
    const middayStep = (middayEnd - middayStart) / 4;
    if (h < middayStart + middayStep * 1) return 'midday';
    if (h < middayStart + middayStep * 2) return 'midday_mid';
    if (h < middayStart + middayStep * 3) return 'midday_late';
    if (h < middayEnd) return 'midday_late_2';
    const sandhyaStart = sunset - 1.5;
    const sandhyaMid = sandhyaStart + 0.75;
    const afternoonStart = middayEnd;
    const afternoonEnd = sandhyaStart;
    const afternoonDuration = afternoonEnd - afternoonStart;
    const afternoonStep = afternoonDuration / 3;
    const afternoonFirstHalf = afternoonStart + afternoonStep / 2;
    if (h < afternoonFirstHalf) return 'afternoon';
    if (h < afternoonStart + afternoonStep) return 'afternoon_first_late';
    if (h < afternoonStart + afternoonStep * 2) return 'afternoon_mid';
    if (h < afternoonEnd) return 'afternoon_late';
    const sandhyaLateMid = sandhyaMid + (sunset - sandhyaMid) / 2;
    const sandhyaLateFirstHalf = sandhyaMid + (sandhyaLateMid - sandhyaMid) / 2;
    const duskEnd = sunset + (10 / 60);
    const duskMid = sandhyaLateMid + (duskEnd - sandhyaLateMid) / 2;
    const sandhyaFirstHalf = sandhyaStart + (sandhyaMid - sandhyaStart) / 2;
    const duskEarlyStart = sandhyaLateMid + (duskMid - sandhyaLateMid) / 2;
    if (h < sandhyaFirstHalf)  return 'sandhya';
    if (h < sandhyaMid)        return 'sandhya_mid';
    if (h < sandhyaLateFirstHalf) return 'sandhya_late';
    if (h < sandhyaLateMid)    return 'sandhya_late_mid';
    if (h < duskEarlyStart)    return 'sandhya_late_mid_2';
    if (h < duskMid)           return 'sandhya_late_2';
    if (h < duskEnd)           return 'sandhya_late_3';
    const twilightStart = duskEnd;
    const twilightEnd = twilightStart + (35 / 60);
    const twilightStep = (twilightEnd - twilightStart) / 3;
    if (h < twilightStart + twilightStep) return 'twilight';
    if (h < twilightStart + twilightStep * 2) return 'twilight_late';
    if (h < twilightEnd) return 'twilight_deep';
    const eveningEnd = sunset + 2;
    const eveningMid = twilightEnd + (eveningEnd - twilightEnd) / 2;
    const eveningEarlyStart = twilightEnd;
    const eveningEarlyMid = eveningEarlyStart + (eveningMid - eveningEarlyStart) / 2;
    if (h < eveningEarlyMid) return 'evening_early';
    if (h < eveningMid) return 'evening_early_2';
    if (h < eveningEnd) return 'evening';
    return getNightPhase(h);
  }
  if (h >= 4   && h < 5)    return 'brahma';
  if (h >= 5 && h < 5 + 10/60) return 'predawn';
  if (h >= 5 + 10/60 && h < 5 + 20/60) return 'predawn_mid';
  if (h >= 5 + 20/60 && h < 6.0) return 'sunrise';
  if (h >= 6.0 && h < 6.75) return 'sunrise_2';
  if (h >= 6.75 && h < 7.375) return 'sunrise_late';
  if (h >= 7.375 && h < 8)    return 'sunrise_late_2';
  if (h >= 8   && h < 8 + 1/3) return 'morning_early';
  if (h >= 8 + 1/3 && h < 8 + 2/3) return 'morning_early_late';
  if (h >= 8 + 2/3 && h < 9 + 1/3) return 'morning';
  if (h >= 9 + 1/3 && h < 9 + 2/3)  return 'morning_late';
  if (h >= 9 + 2/3 && h < 10)  return 'morning_late_2';
  if (h >= 10   && h < 10.5) return 'midday_early';
  if (h >= 10.5 && h < 11.0) return 'midday_early_2';
  if (h >= 11.0 && h < 11.5) return 'midday_early_mid';
  if (h >= 11.5 && h < 11.75) return 'midday_early_late';
  if (h >= 11.75 && h < 12.5) return 'midday';
  if (h >= 12.5 && h < 13.0) return 'midday_mid';
  if (h >= 13.0 && h < 13.5) return 'midday_late';
  if (h >= 13.5 && h < 14.0) return 'midday_late_2';
  if (h >= 14  && h < 14.5) return 'afternoon';
  if (h >= 14.5  && h < 15) return 'afternoon_first_late';
  if (h >= 15  && h < 16)   return 'afternoon_mid';
  if (h >= 16  && h < 17)   return 'afternoon_late';
  if (h >= 17  && h < 17.5)   return 'sandhya';
  if (h >= 17.5  && h < 18)   return 'sandhya_mid';
  if (h >= 18    && h < 18.25)  return 'sandhya_late';
  if (h >= 18.25 && h < 18.5)  return 'sandhya_late_mid';
  if (h >= 18.5 && h < 18.65)  return 'sandhya_late_mid_2';
  if (h >= 18.65  && h < 18 + 51 / 60)    return 'sandhya_late_2';
  if (h >= 18 + 51 / 60  && h < 19 + 10 / 60)    return 'sandhya_late_3';
  const twiStartStatic = 19 + 10 / 60;
  if (h >= twiStartStatic   && h < twiStartStatic + 35 / 180) return 'twilight';
  if (h >= twiStartStatic + 35 / 180 && h < twiStartStatic + 70 / 180) return 'twilight_late';
  if (h >= twiStartStatic + 70 / 180 && h < twiStartStatic + 35 / 60) return 'twilight_deep';
  const staticEveningStart = twiStartStatic + 35 / 60;
  const staticEveningMid = staticEveningStart + (21 - staticEveningStart) / 2;
  const staticEveningEarlyMid = staticEveningStart + (staticEveningMid - staticEveningStart) / 2;
  if (h >= staticEveningStart && h < staticEveningEarlyMid) return 'evening_early';
  if (h >= staticEveningEarlyMid && h < staticEveningMid) return 'evening_early_2';
  if (h >= staticEveningMid && h < 21)  return 'evening';
  if (h >= 21 && h < 22.75) {
    if (h < 21.875) return 'night_early';
    if (h < 22.3125) return 'night_early_mid1';
    if (h < 22.53125) return 'night_early_mid2';
    return 'night_early_mid2_late';
  }
  if (h >= 22.75 || h < 0.5) return 'night_early_late';
  if (h >= 0.5 && h < 2.25) return 'night';
  if (h >= 2.25 && h < 4) return 'night_late';
  return 'night';
}

export type WallpaperMode = 'solar' | 'manual';

interface BgContextValue {
  bgUri: string | null;
  bgKey: string;
  accentColor: string;
  gradientStart: string;
  // Wallpaper mode
  wallpaperMode: WallpaperMode;
  manualBgKey: BgKey;
  setWallpaperMode: (mode: WallpaperMode) => void;
  setManualBgKey: (key: BgKey) => void;
  // URI cache for all BG images (for picker thumbnails)
  allBgUris: Partial<Record<BgKey, string>>;
  solarTimes: { sunrise: number; solarNoon: number; sunset: number } | null;
}

const DEFAULT_KEY = getTimedBgKey(new Date().getHours() + new Date().getMinutes() / 60) as BgKey;

const BgContext = createContext<BgContextValue>({
  bgUri:         BG_URLS[DEFAULT_KEY] ?? BG_URLS.night,
  bgKey:         DEFAULT_KEY,
  accentColor:   BG_ACCENT_COLORS[DEFAULT_KEY] ?? BG_ACCENT_COLORS.night,
  gradientStart: BG_GRADIENT_START[DEFAULT_KEY] ?? BG_GRADIENT_START.night,
  wallpaperMode: 'solar',
  manualBgKey:   'morning',
  setWallpaperMode: () => {},
  setManualBgKey:   () => {},
  allBgUris:     {},
  solarTimes:    null,
});

export function BgProvider({ children }: { children: ReactNode }) {
  const h0   = new Date().getHours() + new Date().getMinutes() / 60;
  const key0 = getTimedBgKey(h0) as BgKey;

  const [bgUri,          setBgUri]       = useState<string | null>(null);
  const [bgKey,          setBgKey]       = useState<string>(key0);
  const [accentColor,    setAccent]      = useState<string>(BG_ACCENT_COLORS[key0] ?? BG_ACCENT_COLORS.night);
  const [gradientStart,  setGradStart]   = useState<string>(BG_GRADIENT_START[key0] ?? BG_GRADIENT_START.night);
  const [wallpaperMode,  setWpMode]      = useState<WallpaperMode>('solar');
  const [manualBgKey,    setManualKey]   = useState<BgKey>('morning');
  const [allBgUris,      setAllBgUris]   = useState<Partial<Record<BgKey, string>>>({});
  const [solarTimesState, setSolarTimesState] = useState<{ sunrise: number; solarNoon: number; sunset: number } | null>(null);

  const solarRef     = React.useRef<{ sunrise: number; solarNoon: number; sunset: number } | null>(null);
  const bgKeyRef     = React.useRef<string>(key0);
  const resolvedOnce = React.useRef<boolean>(false);
  const wpModeRef    = React.useRef<WallpaperMode>('solar');

  // ── Load persisted wallpaper preferences ──────────────────────────────────
  useEffect(() => {
    (async () => {
      const mode = (await store.get(WP_MODE_KEY)) as WallpaperMode | null;
      const mKey = (await store.get(WP_MANUAL_KEY)) as BgKey | null;
      if (mode && (mode === 'solar' || mode === 'manual')) {
        setWpMode(mode);
        wpModeRef.current = mode;
      }
      if (mKey && BG_KEYS.includes(mKey as BgKey)) setManualKey(mKey as BgKey);
    })();
  }, []);

  // ── Pre-load all BG image URIs for picker thumbnails ─────────────────────
  // safeUri: empty string or very short strings crash Android's ImageBackground
  const safeUri = (u: string | null | undefined): string | undefined =>
    (u && u.length > 4) ? u : undefined;

  useEffect(() => {
    (async () => {
      try {
        await bgWarmup;
        // Immediately populate from in-memory map — no I/O, instant after warmup.
        // This ensures the wallpaper picker renders all thumbnails right away
        // instead of showing a loading state while waiting for async file checks.
        const syncUris: Partial<Record<BgKey, string>> = {};
        for (const k of BG_KEYS) {
          // Guard: getBgSourceSync can return null/undefined for uncached keys.
          // Use safeUri to filter empty strings that crash Android ImageBackground.
          const u = safeUri(getBgSourceSync(k));
          if (u) syncUris[k] = u;
        }
        setAllBgUris(syncUris);
        // Then update each key individually as getBgSource resolves —
        // covers remote-URL fallbacks and verifies on-disk file existence.
        await Promise.allSettled(
          BG_KEYS.map(async (k) => {
            try {
              const uri = safeUri(await getBgSource(k));
              if (uri) setAllBgUris(prev => ({ ...prev, [k]: uri }));
            } catch { /* ignore — thumbnail missing is non-fatal */ }
          })
        );
      } catch { /* silent — picker thumbnails failing is non-fatal */ }
    })();
  }, []);

  // ── Solar mode: auto-refresh background every minute ─────────────────────
  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        if (!solarRef.current) {
          const loc = await store.getJSON<{ lat: number; lon: number }>(KEYS.location).catch(() => null);
          solarRef.current = loc?.lat && loc?.lon ? getSolarTimes(loc.lat, loc.lon) : null;
        }
        const nowH = new Date().getHours() + new Date().getMinutes() / 60;
        const key  = getTimedBgKey(nowH, solarRef.current);
        if (cancelled) return;
        
        if (key !== bgKeyRef.current || !resolvedOnce.current) {
          bgKeyRef.current   = key;
          resolvedOnce.current = true;
          const syncUri = getBgSourceSync(key);
          const localSyncUri = syncUri && !syncUri.startsWith('http') ? safeUri(syncUri) ?? null : null;
          const safeSyncUri  = safeUri(syncUri) ?? null;
          
          if (!cancelled) {
            // Preload URI for thumbnails — only store if safe (non-empty, valid)
            const preloadUri = localSyncUri ?? safeSyncUri;
            if (preloadUri) setAllBgUris(prev => ({ ...prev, [key]: preloadUri }));
            
            // Only apply solar UI state if in solar mode
            if (wpModeRef.current === 'solar') {
              setBgKey(key);
              setAccent(BG_ACCENT_COLORS[key] ?? BG_ACCENT_COLORS.night);
              setGradStart(BG_GRADIENT_START[key] ?? BG_GRADIENT_START.night);
              if (localSyncUri || safeSyncUri) {
                setBgUri(localSyncUri ?? safeSyncUri);
              }
            }
          }
          
          const uri = await getBgSource(key);
          if (!cancelled) {
            const safe = safeUri(uri);
            if (safe) setAllBgUris(prev => ({ ...prev, [key]: safe }));
            if (wpModeRef.current === 'solar' && bgKeyRef.current === key) {
              setBgUri(safe ?? null);
            }
          }
        }
      } catch { /* silent */ }
    }

    bgWarmup.then(() => { if (!cancelled) refresh(); }).catch(() => { if (!cancelled) refresh(); });
    const timer = setInterval(refresh, 60_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  // ── Apply background URI based on mode ───────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function applyBg() {
      try {
        if (wallpaperMode === 'manual') {
          const uri = safeUri(await getBgSource(manualBgKey)) ?? null;
          if (!cancelled) {
            setBgUri(uri);
            setBgKey(manualBgKey);
            setAccent(BG_ACCENT_COLORS[manualBgKey] ?? BG_ACCENT_COLORS.night);
            setGradStart(BG_GRADIENT_START[manualBgKey] ?? BG_GRADIENT_START.night);
          }
        } else {
          // Solar mode — derive from current time
          const key = bgKeyRef.current;
          const uri = safeUri(await getBgSource(key)) ?? null;
          if (!cancelled) {
            setBgUri(uri);
            setBgKey(key);
            setAccent(BG_ACCENT_COLORS[key] ?? BG_ACCENT_COLORS.night);
            setGradStart(BG_GRADIENT_START[key] ?? BG_GRADIENT_START.night);
          }
          if (!solarTimesState && solarRef.current) {
            setSolarTimesState(solarRef.current);
          }
        }
      } catch (error) {
        console.warn('Error applying background wallpaper:', error);
      }
    }
    bgWarmup.then(() => { if (!cancelled) applyBg(); }).catch(() => {});
    return () => { cancelled = true; };
  }, [wallpaperMode, manualBgKey]);

  // ── Persist mode changes ──────────────────────────────────────────────────
  const setWallpaperMode = (mode: WallpaperMode) => {
    setWpMode(mode);
    wpModeRef.current = mode;
    store.set(WP_MODE_KEY, mode);
  };

  const setManualBgKey = (key: BgKey) => {
    setManualKey(key);
    store.set(WP_MANUAL_KEY, key);
  };

  return (
    <BgContext.Provider value={{
      bgUri, bgKey, accentColor, gradientStart,
      wallpaperMode, manualBgKey,
      setWallpaperMode, setManualBgKey,
      allBgUris,
      solarTimes: solarTimesState,
    }}>
      {children}
      {/* Preload naad_step backgrounds into memory so they render instantly in walk.tsx */}
      <Image source={{ uri: getBgSourceSync('naad_step') }} style={{ width: 0, height: 0, position: 'absolute', opacity: 0 }} />
      <Image source={{ uri: getBgSourceSync('naad_step_night' as any) }} style={{ width: 0, height: 0, position: 'absolute', opacity: 0 }} />
      {/* Preload live_session backgrounds */}
      <Image source={{ uri: getBgSourceSync('live_session') }} style={{ width: 0, height: 0, position: 'absolute', opacity: 0 }} />
      <Image source={{ uri: getBgSourceSync('live_session_night' as any) }} style={{ width: 0, height: 0, position: 'absolute', opacity: 0 }} />
    </BgContext.Provider>
  );
}

export function useBgContext(): BgContextValue {
  return useContext(BgContext);
}
