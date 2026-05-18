import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getBgSource, BG_URLS } from '@/lib/bgImages';
import { getSolarTimes } from '@/lib/solar';
import { store, KEYS } from '@/lib/storage';

// ── Calm-style warm accent colours per solar period ───────────────────────────
// Dark but distinctly warm-tinted — creates the Calm app "page breathing with
// the hero image" effect. Each colour is the dominant warm hue of that period's
// background photo shifted to a premium near-black tone.
export const BG_ACCENT_COLORS: Record<string, string> = {
  night:     '#06091A',   // midnight blue
  brahma:    '#0C0820',   // deep violet
  predawn:   '#091228',   // dark navy
  sunrise:   '#2A1200',   // rich amber-brown
  morning:   '#0E1A04',   // deep forest green
  midday:    '#1C1400',   // deep golden sunflower
  afternoon: '#1E1000',   // warm umber
  sandhya:   '#281000',   // burnt orange
  twilight:  '#150A20',   // dusk purple
  evening:   '#090614',   // night indigo
};

// ── Brighter gradient start colours (top of the sheet, just under hero) ───────
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
    if (h < sunrise - 1.5) return 'night';
    if (h < sunrise - 0.3) return 'brahma';
    if (h < sunrise + 0.5) return 'predawn';
    if (h < sunrise + 2)   return 'sunrise';
    if (h < solarNoon - 1) return 'morning';
    if (h < solarNoon + 2) return 'midday';
    if (h < sunset - 1.5)  return 'afternoon';
    if (h < sunset)        return 'sandhya';
    if (h < sunset + 0.5)  return 'twilight';
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

interface BgContextValue {
  bgUri: string | null;
  bgKey: string;
  accentColor: string;
  gradientStart: string;
}

const DEFAULT_KEY = getTimedBgKey(new Date().getHours() + new Date().getMinutes() / 60);

const BgContext = createContext<BgContextValue>({
  bgUri:         BG_URLS[DEFAULT_KEY] ?? BG_URLS.night,
  bgKey:         DEFAULT_KEY,
  accentColor:   BG_ACCENT_COLORS[DEFAULT_KEY] ?? BG_ACCENT_COLORS.night,
  gradientStart: BG_GRADIENT_START[DEFAULT_KEY] ?? BG_GRADIENT_START.night,
});

export function BgProvider({ children }: { children: ReactNode }) {
  const h0    = new Date().getHours() + new Date().getMinutes() / 60;
  const key0  = getTimedBgKey(h0);

  const [bgUri,         setBgUri]       = useState<string | null>(BG_URLS[key0] ?? BG_URLS.night);
  const [bgKey,         setBgKey]       = useState<string>(key0);
  const [accentColor,   setAccent]      = useState<string>(BG_ACCENT_COLORS[key0]  ?? BG_ACCENT_COLORS.night);
  const [gradientStart, setGradStart]   = useState<string>(BG_GRADIENT_START[key0] ?? BG_GRADIENT_START.night);
  const solarRef      = React.useRef<{ sunrise: number; solarNoon: number; sunset: number } | null>(null);
  const bgKeyRef      = React.useRef<string>(key0);
  const resolvedOnce  = React.useRef<boolean>(false);

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
        // Always resolve on first call (resolvedOnce gate) or when time period changes
        if (key !== bgKeyRef.current || !resolvedOnce.current) {
          bgKeyRef.current   = key;
          resolvedOnce.current = true;
          const uri = await getBgSource(key);
          if (!cancelled) {
            setBgKey(key);
            setAccent(BG_ACCENT_COLORS[key]  ?? BG_ACCENT_COLORS.night);
            setGradStart(BG_GRADIENT_START[key] ?? BG_GRADIENT_START.night);
            setBgUri(uri);
          }
        }
      } catch { /* silent */ }
    }

    refresh();
    const timer = setInterval(refresh, 60_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  return (
    <BgContext.Provider value={{ bgUri, bgKey, accentColor, gradientStart }}>
      {children}
    </BgContext.Provider>
  );
}

export function useBgContext(): BgContextValue {
  return useContext(BgContext);
}
