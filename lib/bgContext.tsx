import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getBgSource, getBgSourceSync, BG_URLS, bgWarmup } from '@/lib/bgImages';
import { getSolarTimes } from '@/lib/solar';
import { store, KEYS } from '@/lib/storage';

// ── Wallpaper Mode storage key ─────────────────────────────────────────────
const WP_MODE_KEY   = 'morning_wp_mode_v1';    // 'solar' | 'manual'
const WP_MANUAL_KEY = 'morning_wp_manual_v1';  // key from BG_KEYS

// ── All background images with display metadata ────────────────────────────
export const BG_KEYS = [
  'brahma', 'predawn', 'predawn_mid', 'predawn_late', 'sunrise', 'sunrise_late', 'morning_early', 'morning', 'morning_late',
  'midday_early', 'midday_early_mid', 'midday_early_late', 'midday', 'midday_mid', 'midday_late', 'afternoon', 'afternoon_mid', 'afternoon_late', 'sandhya', 'sandhya_late', 'sandhya_late_2', 'twilight', 'twilight_late', 'twilight_deep', 'evening', 'night_early', 'night_early_mid', 'night_early_late', 'night', 'night_late',
] as const;
export type BgKey = typeof BG_KEYS[number];

export const BG_META: Record<BgKey, { label: string; sub: string; emoji: string; time: string }> = {
  brahma:    { label: 'Brahma Muhurta', sub: 'The sacred pre-dawn',      emoji: '🌌', time: '4–5 AM' },
  predawn:   { label: 'Pre-Dawn (Early)', sub: 'First glow of morning',    emoji: '🌄', time: '5–5:10 AM' },
  predawn_mid: { label: 'Pre-Dawn (Mid)',   sub: 'Soft light on horizon',    emoji: '🌅', time: '5:10–5:20 AM' },
  predawn_late: { label: 'Pre-Dawn (Late)',  sub: 'Brightening sky',          emoji: '🌅', time: '5:20–5:30 AM' },
  sunrise:   { label: 'Sunrise',        sub: 'Golden hour clarity',      emoji: '🌅', time: '5:30–6:45 AM' },
  sunrise_late: { label: 'Sunrise (Late)',  sub: 'Morning light settling',   emoji: '🌅', time: '6:45–8 AM' },
  morning_early: { label: 'Morning (Early)', sub: 'Fresh Kapha sunrise glow', emoji: '🌱', time: '8–8:40 AM' },
  morning:   { label: 'Morning',        sub: 'Kapha energy, lush green', emoji: '🌿', time: '8:40–9:20 AM' },
  morning_late: { label: 'Morning (Late)', sub: 'Bright Kapha clarity',   emoji: '🌳', time: '9:20–10 AM' },
  midday_early: { label: 'Midday (Early)', sub: 'Rising solar energy',   emoji: '☀️', time: '10–10:40 AM' },
  midday_early_mid: { label: 'Midday (Early-Mid)', sub: 'Solar warmth builds', emoji: '☀️', time: '10:40–11:20 AM' },
  midday_early_late: { label: 'Midday (Early-Late)', sub: 'Approaching peak sun', emoji: '🔥', time: '11:20 AM–12 PM' },
  midday:    { label: 'Midday (First)', sub: 'Peak solar begins',      emoji: '🔥', time: '12–12:40 PM' },
  midday_mid: { label: 'Midday (Mid)',  sub: 'Solar intensity peaks',  emoji: '☀️', time: '12:40–1:20 PM' },
  midday_late: { label: 'Midday (Late)', sub: 'Peak solar wanes',       emoji: '🌤️', time: '1:20–2 PM' },
  afternoon: { label: 'Afternoon (First)', sub: 'Warm Pitta fire begins',   emoji: '🌤️', time: '2–3 PM' },
  afternoon_mid: { label: 'Afternoon (Mid)',  sub: 'Pitta warmth deepens',    emoji: '🔥', time: '3–4 PM' },
  afternoon_late: { label: 'Afternoon (Late)', sub: 'Golden late light',       emoji: '�', time: '4–5 PM' },
  sandhya:   { label: 'Sandhya',        sub: 'Sacred golden sunset',     emoji: '🌇', time: '5:30–6:15 PM' },
  sandhya_late: { label: 'Sandhya (Late)', sub: 'Last golden light', emoji: '🌅', time: '6:15–6:37 PM' },
  sandhya_late_2: { label: 'Sandhya (Dusk)', sub: 'Final embers before twilight', emoji: '🌇', time: '6:37–7 PM' },
  twilight:  { label: 'Twilight',       sub: 'Dusk — Vata meets Kapha',  emoji: '🌆', time: '7–7:12 PM' },
  twilight_late: { label: 'Twilight (Late)', sub: 'Deepening dusk glow', emoji: '🌇', time: '7:12–7:24 PM' },
  twilight_deep: { label: 'Twilight (Deep)', sub: 'Stars beginning to rise', emoji: '🌌', time: '7:24–7:35 PM' },
  evening:   { label: 'Evening',        sub: 'Cool night energy',        emoji: '🌃', time: '7:30–9 PM' },
  night_early: { label: 'Night (Early)', sub: 'Early stillness descends', emoji: '🌌', time: '9 PM–9:52 PM' },
  night_early_mid: { label: 'Night (Early-Mid)', sub: 'Quiet deepens', emoji: '🌌', time: '9:52 PM–10:45 PM' },
  night_early_late: { label: 'Night (Early-Late)', sub: 'Stillness deepens', emoji: '🌌', time: '10:45 PM–12:30 AM' },
  night:     { label: 'Night (Late)',   sub: 'Deep Vata stillness',      emoji: '🌙', time: '12:30 AM–2:15 AM' },
  night_late: { label: 'Night (Deep)',   sub: 'Darkest hours of rest',    emoji: '🌑', time: '2:15 AM–4 AM' },
};

// ── Calm-style warm accent colours per solar period ───────────────────────────
export const BG_ACCENT_COLORS: Record<string, string> = {
  brahma:    '#0C0820',
  predawn:   '#091228',
  predawn_mid: '#0A142C',
  predawn_late: '#0B1630',
  sunrise:   '#2A1200',
  sunrise_late: '#1A1800',
  morning_early: '#0A1602',
  morning:   '#0E1A04',
  morning_late: '#121E04',
  midday_early: '#1E1200',
  midday_early_mid: '#221400',
  midday_early_late: '#261600',
  midday:    '#1C1400',
  midday_mid: '#201400',
  midday_late: '#241200',
  afternoon: '#1E1000',
  afternoon_mid: '#221400',
  afternoon_late: '#261200',
  sandhya:   '#281000',
  sandhya_late: '#2A1200',
  sandhya_late_2: '#2C1400',
  twilight:  '#150A20',
  twilight_late: '#1A0B26',
  twilight_deep: '#100818',
  evening:   '#090614',
  night_early: '#08051A',
  night_early_mid: '#070416',
  night_early_late: '#060312',
  night: '#04020C',
  night_late: '#020108',
};

export const BG_GRADIENT_START: Record<string, string> = {
  brahma:    '#180D3C',
  predawn:   '#101E40',
  predawn_mid: '#122244',
  predawn_late: '#142648',
  sunrise:   '#4A2200',
  sunrise_late: '#363200',
  morning_early: '#163006',
  morning:   '#1C3008',
  morning_late: '#22380A',
  midday_early: '#3C2800',
  midday_early_mid: '#402A00',
  midday_early_late: '#442C00',
  midday:    '#3A2600',
  midday_mid: '#3E2800',
  midday_late: '#422A00',
  afternoon: '#361C00',
  afternoon_mid: '#3A2000',
  afternoon_late: '#3E2400',
  sandhya:   '#441800',
  sandhya_late: '#4A2200',
  sandhya_late_2: '#4E2600',
  twilight:  '#260D38',
  twilight_late: '#2C0E40',
  twilight_deep: '#1B0B28',
  evening:   '#0E0A24',
  night_early: '#0A0620',
  night_early_mid: '#09051B',
  night_early_late: '#080415',
  night: '#060310',
  night_late: '#04020A',
};

function getTimedBgKey(
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
        return 'night_early_mid';
      }
      if (hAdj < q2) return 'night_early_late';
      if (hAdj < q3) return 'night';
      return 'night_late';
    };

    if (h < brahmaMuhurtaStart) return getNightPhase(h);
    if (h < sunrise - 0.3) return 'brahma';
    const predawnDuration = (sunrise + 0.5) - (sunrise - 0.3);
    const predawnStep = predawnDuration / 3;
    if (h < sunrise - 0.3 + predawnStep) return 'predawn';
    if (h < sunrise - 0.3 + predawnStep * 2) return 'predawn_mid';
    if (h < sunrise + 0.5) return 'predawn_late';
    if (h < sunrise + 1)   return 'sunrise';
    if (h < sunrise + 2)   return 'sunrise_late';
    const morningWindow = kaphaPeriodEnd - (sunrise + 2);
    const morningThird1 = sunrise + 2 + morningWindow / 3;
    const morningThird2 = sunrise + 2 + morningWindow * 2 / 3;
    if (h < morningThird1)  return 'morning_early';
    if (h < morningThird2)  return 'morning';
    if (h < kaphaPeriodEnd) return 'morning_late';
    const middayEarlyStart = kaphaPeriodEnd;
    const middayEarlyEnd = solarNoon + 1;
    const middayEarlyDuration = middayEarlyEnd - middayEarlyStart;
    const middayEarlyStep = middayEarlyDuration / 3;
    if (h < middayEarlyStart + middayEarlyStep) return 'midday_early';
    if (h < middayEarlyStart + middayEarlyStep * 2) return 'midday_early_mid';
    if (h < middayEarlyEnd) return 'midday_early_late';
    const middayStart = solarNoon + 1;
    const middayEnd = solarNoon + 2;
    const middayDuration = middayEnd - middayStart;
    const middayStep = middayDuration / 3;
    if (h < middayStart + middayStep) return 'midday';
    if (h < middayStart + middayStep * 2) return 'midday_mid';
    if (h < middayEnd) return 'midday_late';
    const sandhyaStart = sunset - 1.5;
    const sandhyaMid = sandhyaStart + 0.75;
    const afternoonStart = middayEnd;
    const afternoonEnd = sandhyaStart;
    const afternoonDuration = afternoonEnd - afternoonStart;
    const afternoonStep = afternoonDuration / 3;
    if (h < afternoonStart + afternoonStep) return 'afternoon';
    if (h < afternoonStart + afternoonStep * 2) return 'afternoon_mid';
    if (h < afternoonEnd) return 'afternoon_late';
    const sandhyaLateMid = sandhyaMid + (sunset - sandhyaMid) / 2;
    if (h < sandhyaMid)        return 'sandhya';
    if (h < sandhyaLateMid)    return 'sandhya_late';
    if (h < sunset)            return 'sandhya_late_2';
    const twilightDuration = 35 / 60;
    const twilightStep = twilightDuration / 3;
    if (h < sunset + twilightStep) return 'twilight';
    if (h < sunset + twilightStep * 2) return 'twilight_late';
    if (h < sunset + twilightDuration) return 'twilight_deep';
    if (h < sunset + 2)    return 'evening';
    return getNightPhase(h);
  }
  if (h >= 4   && h < 5)    return 'brahma';
  if (h >= 5   && h < 5 + 10/60) return 'predawn';
  if (h >= 5 + 10/60 && h < 5 + 20/60) return 'predawn_mid';
  if (h >= 5 + 20/60 && h < 5.5) return 'predawn_late';
  if (h >= 5.5 && h < 6.75)    return 'sunrise';
  if (h >= 6.75 && h < 8)    return 'sunrise_late';
  if (h >= 8   && h < 8 + 2/3) return 'morning_early';
  if (h >= 8 + 2/3 && h < 9 + 1/3) return 'morning';
  if (h >= 9 + 1/3 && h < 10)  return 'morning_late';
  if (h >= 10  && h < 10 + 40/60)   return 'midday_early';
  if (h >= 10 + 40/60 && h < 11 + 20/60) return 'midday_early_mid';
  if (h >= 11 + 20/60 && h < 12) return 'midday_early_late';
  if (h >= 12  && h < 12 + 40/60)   return 'midday';
  if (h >= 12 + 40/60 && h < 13 + 20/60) return 'midday_mid';
  if (h >= 13 + 20/60 && h < 14) return 'midday_late';
  if (h >= 14  && h < 15)   return 'afternoon';
  if (h >= 15  && h < 16)   return 'afternoon_mid';
  if (h >= 16  && h < 17)   return 'afternoon_late';
  if (h >= 17  && h < 18)   return 'sandhya';
  if (h >= 18    && h < 18.5)  return 'sandhya_late';
  if (h >= 18.5  && h < 19)    return 'sandhya_late_2';
  if (h >= 19   && h < 19 + 35 / 180) return 'twilight';
  if (h >= 19 + 35 / 180 && h < 19 + 70 / 180) return 'twilight_late';
  if (h >= 19 + 70 / 180 && h < 19 + 35 / 60) return 'twilight_deep';
  if (h >= 19 + 35 / 60 && h < 21)  return 'evening';
  if (h >= 21 && h < 22.75) {
    if (h < 21.875) return 'night_early';
    return 'night_early_mid';
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
          // Use empty string fallback so ImageBackground never gets source={{ uri: undefined }}.
          syncUris[k] = getBgSourceSync(k) || '';
        }
        setAllBgUris(syncUris);
        // Then update each key individually as getBgSource resolves —
        // covers remote-URL fallbacks and verifies on-disk file existence.
        await Promise.allSettled(
          BG_KEYS.map(async (k) => {
            try {
              const uri = await getBgSource(k);
              setAllBgUris(prev => ({ ...prev, [k]: uri || '' }));
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
          const localSyncUri = syncUri && !syncUri.startsWith('http') ? syncUri : null;
          
          if (!cancelled) {
            // Preload URI for thumbnails
            setAllBgUris(prev => ({ ...prev, [key]: localSyncUri ?? syncUri ?? undefined }));
            
            // Only apply solar UI state if in solar mode
            if (wpModeRef.current === 'solar') {
              setBgKey(key);
              setAccent(BG_ACCENT_COLORS[key] ?? BG_ACCENT_COLORS.night);
              setGradStart(BG_GRADIENT_START[key] ?? BG_GRADIENT_START.night);
              if (localSyncUri || syncUri) {
                setBgUri(localSyncUri ?? syncUri ?? null);
              }
            }
          }
          
          const uri = await getBgSource(key);
          if (!cancelled) {
            setAllBgUris(prev => ({ ...prev, [key]: uri }));
            if (wpModeRef.current === 'solar' && bgKeyRef.current === key) {
              setBgUri(uri);
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
      if (wallpaperMode === 'manual') {
        const uri = await getBgSource(manualBgKey);
        if (!cancelled) {
          setBgUri(uri);
          setBgKey(manualBgKey);
          setAccent(BG_ACCENT_COLORS[manualBgKey] ?? BG_ACCENT_COLORS.night);
          setGradStart(BG_GRADIENT_START[manualBgKey] ?? BG_GRADIENT_START.night);
        }
      } else {
        // Solar mode — derive from current time
        const key = bgKeyRef.current;
        const uri = await getBgSource(key);
        if (!cancelled) {
          setBgUri(uri);
          setBgKey(key);
          setAccent(BG_ACCENT_COLORS[key] ?? BG_ACCENT_COLORS.night);
          setGradStart(BG_GRADIENT_START[key] ?? BG_GRADIENT_START.night);
        }
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
    }}>
      {children}
    </BgContext.Provider>
  );
}

export function useBgContext(): BgContextValue {
  return useContext(BgContext);
}
