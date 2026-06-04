import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getBgSource, getBgSourceSync, BG_URLS, bgWarmup } from '@/lib/bgImages';
import { getSolarTimes } from '@/lib/solar';
import { store, KEYS } from '@/lib/storage';

// ── Wallpaper Mode storage key ─────────────────────────────────────────────
const WP_MODE_KEY   = 'morning_wp_mode_v1';    // 'solar' | 'manual'
const WP_MANUAL_KEY = 'morning_wp_manual_v1';  // key from BG_KEYS

// ── All background images with display metadata ────────────────────────────
export const BG_KEYS = [
  'brahma', 'predawn', 'sunrise', 'morning',
  'midday', 'afternoon', 'sandhya', 'twilight', 'evening', 'night',
] as const;
export type BgKey = typeof BG_KEYS[number];

export const BG_META: Record<BgKey, { label: string; sub: string; emoji: string; time: string }> = {
  brahma:    { label: 'Brahma Muhurta', sub: 'The sacred pre-dawn',      emoji: '🌌', time: '4–5 AM' },
  predawn:   { label: 'Pre-Dawn',       sub: 'First glow of morning',    emoji: '🌄', time: '5–5:30 AM' },
  sunrise:   { label: 'Sunrise',        sub: 'Golden hour clarity',      emoji: '🌅', time: '5:30–8 AM' },
  morning:   { label: 'Morning',        sub: 'Kapha energy, lush green', emoji: '🌿', time: '8–10 AM' },
  midday:    { label: 'Midday',         sub: 'Peak solar, full power',   emoji: '☀️', time: '10 AM–2 PM' },
  afternoon: { label: 'Afternoon',      sub: 'Warm Pitta fire',          emoji: '🌤️', time: '2–5:30 PM' },
  sandhya:   { label: 'Sandhya',        sub: 'Sacred golden sunset',     emoji: '🌇', time: '5:30–7 PM' },
  twilight:  { label: 'Twilight',       sub: 'Dusk — Vata meets Kapha',  emoji: '🌆', time: '7–7:30 PM' },
  evening:   { label: 'Evening',        sub: 'Cool night energy',        emoji: '🌃', time: '7:30–9 PM' },
  night:     { label: 'Night',          sub: 'Deep Vata stillness',      emoji: '🌙', time: '9 PM–4 AM' },
};

// ── Calm-style warm accent colours per solar period ───────────────────────────
export const BG_ACCENT_COLORS: Record<string, string> = {
  night:     '#06091A',
  brahma:    '#0C0820',
  predawn:   '#091228',
  sunrise:   '#2A1200',
  morning:   '#0E1A04',
  midday:    '#1C1400',
  afternoon: '#1E1000',
  sandhya:   '#281000',
  twilight:  '#150A20',
  evening:   '#090614',
};

export const BG_GRADIENT_START: Record<string, string> = {
  night:     '#0C1430',
  brahma:    '#180D3C',
  predawn:   '#101E40',
  sunrise:   '#4A2200',
  morning:   '#1C3008',
  midday:    '#3A2600',
  afternoon: '#361C00',
  sandhya:   '#441800',
  twilight:  '#260D38',
  evening:   '#0E0A24',
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
    if (h < brahmaMuhurtaStart) return 'night';
    if (h < sunrise - 0.3) return 'brahma';
    if (h < sunrise + 0.5) return 'predawn';
    if (h < sunrise + 2)   return 'sunrise';
    if (h < kaphaPeriodEnd) return 'morning';
    if (h < solarNoon + 2) return 'midday';
    if (h < sunset - 1.5)  return 'afternoon';
    if (h < sunset)        return 'sandhya';
    if (h < sunset + 35/60) return 'twilight';
    if (h < sunset + 2)    return 'evening';
    return 'night';
  }
  if (h >= 2   && h < 5)    return 'brahma';
  if (h >= 5   && h < 5.5)  return 'predawn';
  if (h >= 5.5 && h < 8)    return 'sunrise';
  if (h >= 8   && h < 10)   return 'morning';
  if (h >= 10  && h < 14)   return 'midday';
  if (h >= 14  && h < 17)   return 'afternoon';
  if (h >= 17  && h < 19)   return 'sandhya';
  if (h >= 19  && h < 19.5) return 'twilight';
  if (h >= 19.5 && h < 21)  return 'evening';
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
      await bgWarmup;
      const uris: Partial<Record<BgKey, string>> = {};
      await Promise.allSettled(
        BG_KEYS.map(async (k) => {
          const uri = await getBgSource(k);
          uris[k] = uri;
        })
      );
      setAllBgUris(uris);
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
