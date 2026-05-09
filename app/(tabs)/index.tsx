import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Switch, ImageBackground, ActivityIndicator, Modal, Dimensions, Animated,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { store, KEYS } from '@/lib/storage';
import { useSoundPlayer, type PlayableSoundMeta } from '@/lib/soundPlayerContext';
import { getSolarTimes, type SolarTimes } from '@/lib/solar';
import { fetchWeather, type WeatherData } from '@/lib/weather';
import { getDoshaPeriods, type DoshaPeriod } from '@/lib/ayurvedicPeriods';
import type { DailyPoint } from '@/lib/weather';
import {
  getBrahmaMuhurtaInfo, scheduleBrahmaMuhurtaNotif, cancelBrahmaMuhurtaNotif,
  SCIENCE_ALIASES, type BrahmaMuhurtaInfo,
} from '@/lib/brahmaMuhurta';
import {
  AlarmSettings, DEFAULT_ALARM_SETTINGS,
} from '@/lib/notifications';
import { getBgSource } from '@/lib/bgImages';
import { Font } from '@/constants/theme';
import Svg, { Circle as SvgCircle, Path as SvgPath } from 'react-native-svg';
import WakeUpShareCard from '@/components/WakeUpShareCard';
import { getTodayWakeLog, getStreak, type WakeLogEntry, type SunriseStreak } from '@/lib/sunriseStreak';

const ACCENT = '#F5820A';
const SCREEN_W = Dimensions.get('window').width;

// ── Glassy Overlay (permanent peak frost) ────────────────────────────────────
function GlassPulseOverlay() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <LinearGradient
        colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.11)', 'rgba(255,255,255,0.03)', 'transparent']}
        start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
    </View>
  );
}

// ── Weather suggestion engine ─────────────────────────────────────────────
function getWeatherSuggestion(code: number, temp: number, humidity: number): {
  icon: string; color: string; title: string; tips: string[];
} {
  const isRain      = [51,53,55,61,63,65,80,81,82].includes(code);
  const isStorm     = [95,96,99].includes(code);
  const isSnow      = [71,73,75].includes(code);
  const isFog       = [45,48].includes(code);
  const isClear     = [0,1].includes(code);
  const isPartly    = [2,3].includes(code);
  const veryHot     = temp >= 36;
  const hot         = temp >= 32 && temp < 36;
  const pleasant    = temp >= 22 && temp < 32;
  const cool        = temp < 22;
  const veryHumid   = humidity >= 78;

  if (isStorm)  return { icon: '⛈️', color: '#f43f5e', title: 'Thunderstorm Warning',
    tips: ['🏠 Stay indoors today', '🌳 Away from trees & open areas', '🚗 Avoid driving if possible', '⚡ Unplug electronics', '💻 Ideal for indoor work & rest'] };

  if (isSnow)   return { icon: '❄️', color: '#93c5fd', title: 'Snow Outside',
    tips: ['🧥 Dress in warm layers before going out', '🚗 Icy roads — drive carefully', '👟 Grip-sole boots recommended', '🏠 Morning walk not advised today', '☕ Warm herbal tea & indoor routines', '🧤 Gloves & hat essential'] };

  if (isFog)    return { icon: '🌫️', color: '#94a3b8', title: 'Foggy Morning',
    tips: ['🌫️ Visibility low — drive carefully', '🏃 Skip early outdoor exercise', '⏰ Fog clears by mid-morning', '🚨 Use fog lights while driving', '🧘 Indoor pranayama & meditation ideal'] };

  if (isRain)   return { icon: '🌧️', color: '#60a5fa', title: 'Rain Today — Carry Umbrella',
    tips: ['☂️ Carry umbrella before going out', '👟 Non-slip footwear recommended', '🚗 Slow down — wet roads', '🚶 Watch step — wet floors & surfaces', '🧘 Great for indoor yoga today', '🍲 Light warm meals ideal'] };

  if (isClear && veryHot) return { icon: '🌡️', color: '#f97316', title: 'Very Hot — Sun Protection',
    tips: ['🧴 Apply sunscreen before going out', '💧 Carry water — hydrate every 30 min', '⏰ Avoid 11 AM – 4 PM outdoors', '🚶 Morning walk best before 8 AM', '🧢 Wear hat or cap'] };

  if (isClear && hot && veryHumid) return { icon: '🥵', color: '#fb923c', title: 'Hot & Humid Day',
    tips: ['💧 Drink coconut water or ORS', '🌬️ Humidity high — sweat cools poorly', '🚶 Outdoor walk only in early morning', '👕 Light breathable clothing', '🦴 Eat light — avoid heavy meals'] };

  if (isClear && pleasant) return { icon: '✨', color: '#34d399', title: 'Perfect Day to Go Out!',
    tips: ['🚶 Ideal for a morning walk', '🏃 Great day to exercise outdoors', '☀️ 15–20 min sun for Vitamin D', '🪟 Open windows — let fresh air in', '🌿 Perfect for outdoor activities'] };

  if (isPartly && pleasant) return { icon: '⛅', color: '#60a5fa', title: 'Pleasant Weather',
    tips: ['🚶 Good day for a morning walk', '🏃 Comfortable for outdoor activities', '🌿 Nice for a picnic or open-air lunch', '🌬️ Enjoy the natural light & breeze', '😊 Ideal weather to be outside'] };

  if (cool) return { icon: '🧥', color: '#7dd3fc', title: 'Cool & Fresh',
    tips: ['🧥 Wear a light layer before going out', '🚶 Cool mornings great for brisk walking', '☕ Warm breakfast & herbal tea', '🌬️ Good day for outdoor focused work', '🌫️ Layer up if heading out early'] };

  return { icon: '🌤️', color: '#fbbf24', title: 'Mostly Clear Sky',
    tips: ['🚶 Good day for a morning walk', '💧 Stay hydrated through the day', '☀️ Enjoy the daylight outdoors', '🌿 Comfortable outdoor conditions', '🪟 Open windows — fresh air'] };
}

// ── Hourly tip generator (for afternoon view) ────────────────────────
function getTinyTip(code: number, temp: number): { icon: string; tip: string; color: string } | null {
  if ([95,96,99].includes(code)) return { icon: '⛈️', tip: 'Thunderstorm — stay indoors',    color: '#f43f5e' };
  if ([61,63,65,80,81,82].includes(code)) return { icon: '🌧️', tip: 'Rain — carry umbrella',        color: '#60a5fa' };
  if ([51,53,55].includes(code)) return { icon: '🌦️', tip: 'Light drizzle — stay dry',      color: '#93c5fd' };
  if ([45,48].includes(code)) return { icon: '🌫️', tip: 'Foggy — drive carefully',        color: '#94a3b8' };
  if ([71,73,75].includes(code)) return { icon: '❄️', tip: 'Snow — dress warmly',             color: '#bae6fd' };
  if (temp >= 38) return { icon: '🌡️', tip: 'Extreme heat — avoid direct sun',  color: '#ef4444' };
  if (temp >= 34) return { icon: '☀️',  tip: 'Very hot — stay hydrated',          color: '#f97316' };
  if ([0,1].includes(code) && temp >= 22 && temp < 34) return { icon: '✅', tip: 'Clear & pleasant — great outside', color: '#34d399' };
  if ([2,3].includes(code) && temp >= 20) return { icon: '⛅', tip: 'Partly cloudy — comfortable',  color: '#60a5fa' };
  return null;
}

// ── Per-hour action advice (multiple tips per condition) ─────────────────
function getHourlyAdvice(code: number, temp: number): { icon: string; color: string; title: string; tips: string[] } {
  if ([95,96,99].includes(code))       return { icon: '⛈️', color: '#f43f5e', title: 'Thunderstorm — Stay Indoors',  tips: ['🏠 Stay indoors right now', '🌳 Away from trees & open areas', '🚗 Avoid driving if possible', '⚡ Unplug electronics', '💻 Perfect for indoor work & rest'] };
  if ([61,63,65,80,81,82].includes(code)) return { icon: '🌧️', color: '#60a5fa', title: 'Rain This Hour',             tips: ['☂️ Carry umbrella before stepping out', '👟 Wear non-slip footwear', '🚗 Slow down — wet roads', '🚶 Watch step on wet floors', '🏠 Good for indoor tasks', '🫖 Warm ginger tea recommended'] };
  if ([51,53,55].includes(code))       return { icon: '🌦️', color: '#93c5fd', title: 'Light Drizzle Outside',       tips: ['🧥 Keep a light jacket handy', '🚶 Walk carefully — slick surfaces', '🌂 Brief outdoor trips are fine', '☕ Perfect tea weather', '💧 Shoes may get wet'] };
  if ([45,48].includes(code))          return { icon: '🌫️', color: '#94a3b8', title: 'Foggy Conditions',            tips: ['🌫️ Drive slowly — low visibility', '🏃 Skip outdoor exercise now', '⏰ Fog lifts by 9–10 AM', '🧘 Indoor pranayama ideal', '🚨 Use fog lights while driving'] };
  if ([71,73,75].includes(code))       return { icon: '❄️', color: '#bae6fd', title: 'Snow This Hour',              tips: ['🧥 Dress in warm layers', '🚗 Icy roads — drive carefully', '👟 Grip-sole boots recommended', '🏠 Best to stay warm inside', '☕ Hot broth or herbal tea', '🧤 Gloves & hat essential'] };
  if (temp >= 38)                       return { icon: '🌡️', color: '#ef4444', title: 'Extreme Heat Right Now',      tips: ['🌡️ Avoid direct sun — stay in shade', '💧 Drink water every 20 min', '⏰ Limit outdoor time this hour', '🌬️ Seek air-conditioned spaces', '🍉 Eat water-rich fruits'] };
  if (temp >= 34)                       return { icon: '☀️',  color: '#f97316', title: 'Very Hot Outside',           tips: ['💧 Carry water before heading out', '🧢 Wear hat or cap', '🧴 Apply sunscreen', '⏰ Best before 8 AM or after 5 PM', '🍋 Electrolyte drink recommended'] };
  if ([0,1].includes(code) && temp >= 22 && temp < 34) return { icon: '✅', color: '#34d399', title: 'Great Conditions Right Now', tips: ['🚶 Perfect for a walk or jog', '🌿 Enjoy fresh air & sunlight', '🪟 Open windows — let the breeze in', '☀️ 15–20 min sun for Vitamin D', '🏃 Great for outdoor exercise'] };
  if ([2,3].includes(code) && temp >= 20) return { icon: '⛅', color: '#60a5fa', title: 'Comfortable Outside',      tips: ['🏃 Great for any outdoor activity', '👕 Light clothing is enough', '🌳 Step outside & move', '☺️ Enjoy the natural breeze', '🌤️ Good hour to be outside'] };
  return { icon: '🌤️', color: '#fbbf24', title: 'Clear Skies',                                                       tips: ['🌤️ Decent outdoor conditions', '💧 Stay hydrated if heading out', '🌅 Enjoy the daylight', '🚶 Light walk is ideal'] };
}

// ── Background images keyed by solar period ───────────────────────────────

function getTimedBgKey(h: number, solar?: SolarTimes | null): string {
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
  if (h >= 2  && h < 5)   return 'brahma';
  if (h >= 5  && h < 5.5) return 'predawn';
  if (h >= 5.5 && h < 8)  return 'sunrise';
  if (h >= 8  && h < 10)  return 'morning';
  if (h >= 10 && h < 14)  return 'midday';
  if (h >= 14 && h < 17)  return 'afternoon';
  if (h >= 17 && h < 19)    return 'sandhya';
  if (h >= 19 && h < 19.5)  return 'twilight';
  if (h >= 19.5 && h < 21)  return 'evening';
  return 'night';
}

const pad = (n: number) => String(n).padStart(2, '0');
function fmt12H(h: number, m: number) {
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12  = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${pad(h12)}:${pad(m)} ${ampm}`;
}
function hrLabel(h: number) {
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12  = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}${ampm}`;
}
function fmtSolar(dec: number): string {
  const flr = Math.floor(dec);
  const mn  = Math.round((dec - flr) * 60);
  return fmt12H(flr, mn);
}

// ── Moon phase — pure math, no API ───────────────────────────────────────
function getMoonPhase(date: Date = new Date()): {
  emoji: string; name: string; tithi: string; illumination: number; paksha: string; tithiNum: number;
} {
  const KNOWN_NEW_MOON = new Date('2000-01-06T18:14:00Z').getTime();
  const CYCLE = 29.53058867;
  const ageRaw = (date.getTime() - KNOWN_NEW_MOON) / (1000 * 60 * 60 * 24);
  const age = ((ageRaw % CYCLE) + CYCLE) % CYCLE;
  const illum = Math.round((1 - Math.cos((age / CYCLE) * 2 * Math.PI)) / 2 * 100);
  const waxing = age < CYCLE / 2;

  // Tithi (1-30)
  const tithiNum = Math.min(30, Math.floor((age / CYCLE) * 30) + 1);
  const paksha = tithiNum <= 15 ? 'Shukla' : 'Krishna';
  const tithiInPaksha = tithiNum <= 15 ? tithiNum : tithiNum - 15;
  const TITHI_NAMES = ['','Pratipada','Dwitiya','Tritiya','Chaturthi','Panchami','Shashthi','Saptami','Ashtami','Navami','Dashami','Ekadashi','Dwadashi','Trayodashi','Chaturdashi','Purnima / Amavasya'];
  const tithi = `${TITHI_NAMES[tithiInPaksha] ?? tithiInPaksha}`;

  // Illumination-based phase (more accurate than fixed age thresholds)
  if (illum >= 98) return { emoji: '�', name: 'Full Moon',         tithi, illumination: illum, paksha, tithiNum };
  if (illum <= 2)  return { emoji: '�', name: 'New Moon',          tithi, illumination: illum, paksha, tithiNum };
  if (illum < 45)  return { emoji: waxing ? '�' : '🌘', name: waxing ? 'Waxing Crescent' : 'Waning Crescent', tithi, illumination: illum, paksha, tithiNum };
  if (illum < 55)  return { emoji: waxing ? '�' : '🌗', name: waxing ? 'First Quarter'   : 'Last Quarter',    tithi, illumination: illum, paksha, tithiNum };
  return             { emoji: waxing ? '�' : '🌖', name: waxing ? 'Waxing Gibbous'  : 'Waning Gibbous',  tithi, illumination: illum, paksha, tithiNum };
}

// ── Next Purnima / Amavasya countdown ───────────────────────────────────
function getNextLunarEvents() {
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
  if (isNewToday)  daysToNew  = 0;
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

// ── Accurate SVG Moon Shape (tithi-based) ────────────────────────────────
function MoonSVG({ tithiNum, size = 40 }: { tithiNum: number; size?: number }) {
  const r = size / 2;
  const isWaxing  = tithiNum <= 15;
  const isPurnima = tithiNum === 15;
  const isAmavasya = tithiNum === 0 || tithiNum === 30;
  const rawIllum  = isPurnima ? 1 : isAmavasya ? 0
    : isWaxing ? tithiNum / 15
    : 1 - (tithiNum - 15) / 15;

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
  const c = r;
  const s = size;
  const pathD = `M ${c} 0 A ${r} ${r} 0 1 ${outerSweep} ${c} ${s} A ${rx} ${r} 0 0 ${terminatorSweep} ${c} 0 Z`;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <SvgCircle cx={r} cy={r} r={r - 0.5} fill={darkFill} />
      <SvgPath d={pathD} fill={moonFill} />
    </Svg>
  );
}

// ── Sun SVGs (algorithmic — NOAA-inspired arc geometry) ──────────────────
function RisingSunSVG({ size = 26 }: { size?: number }) {
  const cx = size / 2;
  const hy = size * 0.68;          // horizon y
  const r  = size * 0.27;
  const rs = r + size * 0.05;      // ray inner radius
  const re = r + size * 0.17;      // ray outer radius
  const rays = [-90, -55, -125, -28, -152];
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <SvgCircle cx={cx} cy={hy} r={r * 1.65} fill="#f9780408" />
      {rays.map((deg, i) => {
        const rad = deg * Math.PI / 180;
        const x1 = cx + rs * Math.cos(rad); const y1 = hy + rs * Math.sin(rad);
        const x2 = cx + re * Math.cos(rad); const y2 = hy + re * Math.sin(rad);
        if (y1 > hy + 0.5 || y2 > hy + 0.5) return null;
        return <SvgPath key={i} d={`M ${x1} ${y1} L ${x2} ${y2}`} stroke="#fbbf24" strokeWidth={1.5} strokeLinecap="round" opacity={0.85} />;
      })}
      <SvgPath d={`M 0 ${hy} L ${size} ${hy}`} stroke="#f9780432" strokeWidth={0.7} />
      <SvgPath d={`M ${cx - r} ${hy} A ${r} ${r} 0 0 1 ${cx + r} ${hy} Z`} fill="#f97316" />
      <SvgCircle cx={cx - r * 0.22} cy={hy - r * 0.48} r={r * 0.17} fill="#fde68a" opacity={0.7} />
    </Svg>
  );
}

function NoonSunSVG({ size = 26 }: { size?: number }) {
  const cx = size / 2; const cy = size / 2;
  const r  = size * 0.26;
  const rs = r + size * 0.05;
  const re = r + size * 0.16;
  const rays = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <SvgCircle cx={cx} cy={cy} r={r * 1.72} fill="#fbbf2410" />
      {rays.map((deg, i) => {
        const rad = deg * Math.PI / 180;
        return <SvgPath key={i} d={`M ${cx + rs * Math.cos(rad)} ${cy + rs * Math.sin(rad)} L ${cx + re * Math.cos(rad)} ${cy + re * Math.sin(rad)}`} stroke="#fbbf24" strokeWidth={1.4} strokeLinecap="round" opacity={0.9} />;
      })}
      <SvgCircle cx={cx} cy={cy} r={r} fill="#fde68a" />
      <SvgCircle cx={cx - r * 0.27} cy={cy - r * 0.35} r={r * 0.2} fill="#fff" opacity={0.55} />
    </Svg>
  );
}

function SettingSunSVG({ size = 26 }: { size?: number }) {
  const cx = size / 2;
  const hy = size * 0.68;
  const r  = size * 0.27;
  const rs = r + size * 0.05;
  const re = r + size * 0.16;
  const rays = [-90, -45, -135, -20, -160];
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <SvgCircle cx={cx} cy={hy} r={r * 1.65} fill="#ef444408" />
      {rays.map((deg, i) => {
        const rad = deg * Math.PI / 180;
        const x1 = cx + rs * Math.cos(rad); const y1 = hy + rs * Math.sin(rad);
        const x2 = cx + re * Math.cos(rad); const y2 = hy + re * Math.sin(rad);
        if (y1 > hy + 0.5 || y2 > hy + 0.5) return null;
        return <SvgPath key={i} d={`M ${x1} ${y1} L ${x2} ${y2}`} stroke="#f97316" strokeWidth={1.5} strokeLinecap="round" opacity={0.8} />;
      })}
      <SvgPath d={`M 0 ${hy} L ${size} ${hy}`} stroke="#ef444432" strokeWidth={0.7} />
      <SvgPath d={`M ${cx - r} ${hy} A ${r} ${r} 0 0 1 ${cx + r} ${hy} Z`} fill="#ef4444" />
      <SvgCircle cx={cx - r * 0.22} cy={hy - r * 0.48} r={r * 0.17} fill="#fbbf24" opacity={0.5} />
    </Svg>
  );
}

// ── Panchang data ─────────────────────────────────────────────────────────
const NAKSHATRAS = [
  { name: 'Ashwini',           en: 'The Healer',         emoji: '🐴', energy: 'Swift starts & healing energy' },
  { name: 'Bharani',           en: 'The Carrier',        emoji: '⚖️', energy: 'Transformation & endurance' },
  { name: 'Krittika',          en: 'The Flame',          emoji: '🔥', energy: 'Courage, clarity & purification' },
  { name: 'Rohini',            en: 'The Abundant',       emoji: '🌹', energy: 'Growth, beauty & abundance' },
  { name: 'Mrigashira',        en: 'The Seeker',         emoji: '🦌', energy: 'Curiosity & gentle searching' },
  { name: 'Ardra',             en: 'The Storm',          emoji: '⛈️', energy: 'Renewal through intensity' },
  { name: 'Punarvasu',         en: 'Return of Light',    emoji: '🏠', energy: 'Restoration & nourishment' },
  { name: 'Pushya',            en: 'The Nourisher',      emoji: '🌸', energy: 'Most auspicious — nourish & give' },
  { name: 'Ashlesha',          en: 'The Entwiner',       emoji: '🐍', energy: 'Deep insight & hidden wisdom' },
  { name: 'Magha',             en: 'The Throne',         emoji: '👑', energy: 'Ancestral power & authority' },
  { name: 'Purva Phalguni',    en: 'The Resting Star',   emoji: '🌺', energy: 'Rest, pleasure & creative flow' },
  { name: 'Uttara Phalguni',   en: 'The Covenant',       emoji: '🤝', energy: 'Unions, loyalty & commitment' },
  { name: 'Hasta',             en: 'The Skilled Hand',   emoji: '✋', energy: 'Craft, healing touch & skill' },
  { name: 'Chitra',            en: 'The Brilliant',      emoji: '💎', energy: 'Radiant creativity & achievement' },
  { name: 'Swati',             en: 'The Independent',    emoji: '🌬️', energy: 'Freedom, flexibility & movement' },
  { name: 'Vishakha',          en: 'The Forked Branch',  emoji: '⚡', energy: 'Ambition, purpose & breakthrough' },
  { name: 'Anuradha',          en: 'The Devoted Star',   emoji: '💫', energy: 'Friendship, devotion & success' },
  { name: 'Jyeshtha',          en: 'The Eldest',         emoji: '🛡️', energy: 'Power, protection & seniority' },
  { name: 'Mula',              en: 'The Root',           emoji: '🌱', energy: 'Core truth & deep foundations' },
  { name: 'Purva Ashadha',     en: 'The Undefeated',     emoji: '🌊', energy: 'Strength, purification & victory' },
  { name: 'Uttara Ashadha',    en: 'The Universal',      emoji: '🌟', energy: 'Universal truth & final success' },
  { name: 'Shravana',          en: 'The Listener',       emoji: '👂', energy: 'Learning, listening & connection' },
  { name: 'Dhanishtha',        en: 'The Richest',        emoji: '🥁', energy: 'Wealth, music & cosmic rhythm' },
  { name: 'Shatabhisha',       en: 'Hundred Healers',    emoji: '💊', energy: 'Healing, mystery & deep knowing' },
  { name: 'Purva Bhadrapada',  en: 'Fierce Feet',        emoji: '🔱', energy: 'Transformation & spiritual fire' },
  { name: 'Uttara Bhadrapada', en: 'Gentle Feet',        emoji: '🐉', energy: 'Depth, wisdom & universal love' },
  { name: 'Revati',            en: 'The Wealthy',        emoji: '🐟', energy: 'Completion, nourishment & safe journey' },
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
  { vedicName: 'Surya Vaar',  planet: 'Sun',     emoji: '☀️', color: '#fbbf24', energy: 'Leadership, clarity & self-expression' },
  { vedicName: 'Soma Vaar',   planet: 'Moon',    emoji: '🌙', color: '#93c5fd', energy: 'Intuition, emotion & inner wisdom' },
  { vedicName: 'Mangal Vaar', planet: 'Mars',    emoji: '🔴', color: '#f87171', energy: 'Courage, strength & decisive action' },
  { vedicName: 'Budha Vaar',  planet: 'Mercury', emoji: '💚', color: '#6ee7b7', energy: 'Communication, learning & agility' },
  { vedicName: 'Guru Vaar',   planet: 'Jupiter', emoji: '🌟', color: '#fde68a', energy: 'Wisdom, expansion & dharmic action' },
  { vedicName: 'Shukra Vaar', planet: 'Venus',   emoji: '💗', color: '#f9a8d4', energy: 'Beauty, creativity & abundance' },
  { vedicName: 'Shani Vaar',  planet: 'Saturn',  emoji: '🪐', color: '#a5b4fc', energy: 'Discipline, karma & enduring effort' },
];

const ENGLISH_DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const TITHI_ORDINALS = ['','First','Second','Third','Fourth','Fifth','Sixth','Seventh','Eighth','Ninth','Tenth','Eleventh','Twelfth','Thirteenth','Fourteenth','Full Moon'];
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

// Rashi (sidereal sign) → Vedic Saura Maasa (solar month)
// Order: Mesha=0 … Meena=11
const RASHI_TO_VEDIC_MONTH = [
  { name: 'Vaishakha',    sanskrit: 'वैशाख',       rashi: 'Mesha',     en: 'Apr–May' },
  { name: 'Jyeshtha',     sanskrit: 'ज्येष्ठ',     rashi: 'Vrishabha', en: 'May–Jun' },
  { name: 'Ashadha',      sanskrit: 'आषाढ़',       rashi: 'Mithuna',   en: 'Jun–Jul' },
  { name: 'Shravana',     sanskrit: 'श्रावण',      rashi: 'Karka',     en: 'Jul–Aug' },
  { name: 'Bhadrapada',   sanskrit: 'भाद्रपद',     rashi: 'Simha',     en: 'Aug–Sep' },
  { name: 'Ashwin',       sanskrit: 'आश्विन',      rashi: 'Kanya',     en: 'Sep–Oct' },
  { name: 'Kartik',       sanskrit: 'कार्तिक',     rashi: 'Tula',      en: 'Oct–Nov' },
  { name: 'Margashirsha', sanskrit: 'मार्गशीर्ष',  rashi: 'Vrischika', en: 'Nov–Dec' },
  { name: 'Pausha',       sanskrit: 'पौष',          rashi: 'Dhanu',     en: 'Dec–Jan' },
  { name: 'Magha',        sanskrit: 'माघ',          rashi: 'Makara',    en: 'Jan–Feb' },
  { name: 'Phalguna',     sanskrit: 'फाल्गुन',     rashi: 'Kumbha',    en: 'Feb–Mar' },
  { name: 'Chaitra',      sanskrit: 'चैत्र',       rashi: 'Meena',     en: 'Mar–Apr' },
];
function getVedicMonth(date: Date = new Date()) {
  const dJ2000 = (date.getTime() - 946728000000) / 86400000;

  // ── Sun: tropical → sidereal (Lahiri ayanamsha) ──
  const Ldeg = (280.460 + 0.9856474 * dJ2000) % 360;
  const gdeg = (357.528 + 0.9856003 * dJ2000) % 360;
  const gRad = gdeg * Math.PI / 180;
  const sunTropical = ((Ldeg + 1.915 * Math.sin(gRad) + 0.020 * Math.sin(2 * gRad)) % 360 + 360) % 360;
  const ayanamsha   = 23.85 + 0.0136 * (dJ2000 / 365.25);
  const siderealSun = ((sunTropical - ayanamsha) % 360 + 360) % 360;

  // ── Moon age in current lunation (0 = Amavasya, ~14.77 = Purnima) ──
  const KNOWN_NEW_MOON_MS = new Date('2000-01-06T18:14:00Z').getTime();
  const CYCLE    = 29.53058867;
  const moonAge  = ((((date.getTime() - KNOWN_NEW_MOON_MS) / 86400000) % CYCLE) + CYCLE) % CYCLE;

  // ── Purnimanta Chandra Maasa (North India) ──
  // Month starts right after Purnima; named by Sun's rashi at the CLOSING Purnima.
  // Shukla paksha (moonAge < halfCycle): closing Purnima is THIS lunation's Purnima.
  // Krishna paksha (moonAge >= halfCycle): month just changed; closing Purnima is NEXT lunation's.
  const halfCycle           = CYCLE / 2;
  const daysToClosingPurnima = moonAge < halfCycle
    ? halfCycle - moonAge           // Purnima still ahead in this lunation
    : CYCLE - moonAge + halfCycle;  // next Purnima closes the new month
  const sunAtClosingPurnima = ((siderealSun + daysToClosingPurnima * 0.9856) % 360 + 360) % 360;

  const rashiIdx = Math.floor(sunAtClosingPurnima / 30) % 12;
  return RASHI_TO_VEDIC_MONTH[rashiIdx];
}

// ── Moon rituals, Vaar actions, Cosmic Score ─────────────────────────────
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

const SCORE_META: Record<number, { label: string; color: string; emoji: string }> = {
  1:  { label: 'Challenging',   color: '#f43f5e', emoji: '🌧️' },
  2:  { label: 'Challenging',   color: '#f43f5e', emoji: '🌧️' },
  3:  { label: 'Mixed',         color: '#fb923c', emoji: '⛅' },
  4:  { label: 'Mixed',         color: '#fb923c', emoji: '⛅' },
  5:  { label: 'Steady',        color: '#fbbf24', emoji: '🌤️' },
  6:  { label: 'Favorable',     color: '#34d399', emoji: '✨' },
  7:  { label: 'Favorable',     color: '#34d399', emoji: '✨' },
  8:  { label: 'Excellent',     color: '#10b981', emoji: '🌟' },
  9:  { label: 'Excellent',     color: '#10b981', emoji: '🌟' },
  10: { label: 'Cosmic Peak',   color: '#60a5fa', emoji: '⚡' },
};

// ── Panchang Card ─────────────────────────────────────────────────────────
function PanchangCard({ onExplore }: { onExplore: () => void }) {
  const [expanded, setExpanded] = React.useState(false);
  const p            = getPanchangData();
  const moon         = getMoonPhase();
  const vaar         = VAARS[p.vaarIdx];
  const nakshatra    = NAKSHATRAS[p.nakshatraIdx];
  const yoga         = YOGAS[p.yogaIdx];
  const tithiEnergy  = TITHI_ENERGY[p.tithiName] ?? 'Sacred lunar energy';
  const moonRitual   = MOON_RITUALS[moon.emoji] ?? { prompt: 'Lunar energy', action: 'Connect with the moon tonight.' };
  const vaarAction   = VAAR_ACTIONS[p.vaarIdx] ?? '';
  const score        = getCosmicScore(yoga.auspicious, moon.emoji, p.tithiName);
  const scoreMeta    = SCORE_META[score];
  const isSpecialMoon = moon.emoji === '🌕' || moon.emoji === '🌑';

  return (
    <>
    <TouchableOpacity
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setExpanded(e => !e); }}
      activeOpacity={0.9}
      style={[PC.card, { borderColor: vaar.color + '45' }]}>
      <LinearGradient colors={['rgba(255,255,255,0.13)','rgba(255,255,255,0.04)','transparent']} start={{x:0,y:0}} end={{x:0,y:0.6}} style={StyleSheet.absoluteFillObject} />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.32)' }} />

      {/* Planet-colored left bar */}
      <View style={[PC.sideBar, { backgroundColor: vaar.color }]} />

      <View style={{ flex: 1, paddingLeft: 14 }}>

        {/* ── Header ── */}
        <View style={PC.headerRow}>
          <Text style={PC.sectionTag}>TODAY'S COSMIC ENERGY  ·  VEDIC ALMANAC</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={[PC.scorePill, { backgroundColor: scoreMeta.color + '18', borderColor: scoreMeta.color + '45' }]}>
              <Text style={{ fontSize: 10 }}>{scoreMeta.emoji}</Text>
              <Text style={[PC.scoreNum, { color: scoreMeta.color }]}>{score}/10</Text>
              <Text style={[PC.scoreLabel, { color: scoreMeta.color }]}>{scoreMeta.label}</Text>
            </View>
            <Text style={[PC.arrow, expanded && { transform: [{ rotate: '180deg' }] }]}>⌄</Text>
          </View>
        </View>

        {/* ── Full/New Moon Special Banner ── */}
        {isSpecialMoon && (
          <View style={[PC.moonBanner, { borderColor: moon.emoji === '🌕' ? '#fbbf2440' : '#60a5fa40', backgroundColor: moon.emoji === '🌕' ? '#fbbf2408' : '#60a5fa08' }]}>
            <Text style={{ fontSize: 18 }}>{moon.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[PC.moonBannerTitle, { color: moon.emoji === '🌕' ? '#fbbf24' : '#60a5fa' }]}>
                {moon.emoji === '🌕' ? 'FULL MOON TODAY' : 'NEW MOON TODAY'}
              </Text>
              <Text style={PC.moonBannerSub}>
                {moon.emoji === '🌕' ? 'Peak energy. Best day to release, celebrate & be seen.' : 'Clean slate. Ideal day to set intentions & begin fresh.'}
              </Text>
            </View>
          </View>
        )}

        {/* ── Vaar headline — English first ── */}
        <View style={PC.energyRow}>
          <Text style={{ fontSize: 28 }}>{vaar.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[PC.energyTitle, { color: vaar.color }]}>{vaar.energy}</Text>
            <Text style={PC.energySub}>{vaar.planet} Day  ·  <Text style={{ fontStyle: 'italic', color: '#FFFFFF30' }}>{vaar.vedicName}</Text></Text>
          </View>
        </View>

        {/* ── Do This Today ── */}
        <View style={PC.actionBox}>
          <Text style={PC.actionLabel}>DO THIS TODAY</Text>
          <Text style={PC.actionText}>{vaarAction}</Text>
        </View>

        {/* ── Cosmic Alignment ── */}
        <View style={PC.alignRow}>
          <View style={[PC.alignDot, { backgroundColor: yoga.auspicious ? '#10b981' : '#f87171' }]} />
          <Text style={PC.alignText}>
            <Text style={{ color: yoga.auspicious ? '#10b981DD' : '#f87171DD', fontWeight: '800' }}>{yoga.en}  </Text>
            <Text style={{ color: '#FFFFFF45' }}>— {yoga.meaning}</Text>
          </Text>
        </View>

        {/* ── Tithi · Nakshatra bilingual strip ── */}
        <View style={PC.biRow}>
          <View style={[PC.biCell, { borderColor: '#60a5fa20' }]}>
            <Text style={PC.biTag}>🌙 TITHI  ·  लुनर दिन</Text>
            <Text style={[PC.biSanskrit, { color: '#60a5fa' }]}>{p.tithiName}</Text>
            <Text style={PC.biEnglish}>{p.paksha === 'Shukla' ? 'Waxing' : 'Waning'} Moon · Day {p.tithiInPaksha}</Text>
          </View>
          <View style={[PC.biCell, { borderColor: '#fbbf2420' }]}>
            <Text style={PC.biTag}>{nakshatra.emoji} NAKSHATRA  ·  नक्षत्र</Text>
            <Text style={[PC.biSanskrit, { color: '#fbbf24' }]}>{nakshatra.name}</Text>
            <Text style={PC.biEnglish}>{nakshatra.en}</Text>
          </View>
        </View>

        {/* ── Moon Ritual ── */}
        <View style={PC.ritualRow}>
          <MoonSVG tithiNum={moon.tithiNum} size={28} />
          <View style={{ flex: 1 }}>
            <Text style={PC.ritualPrompt}>{moonRitual.prompt}  ·  {moon.illumination}% lit</Text>
            <Text style={PC.ritualText}>{moonRitual.action}</Text>
          </View>
        </View>

        {/* ── Expanded Detail ── */}
        {expanded && (
          <View style={PC.expandedSection}>
            <View style={PC.triRow}>

              {/* Lunar Day */}
              <View style={[PC.triCell, { borderColor: '#60a5fa22' }]}>
                <Text style={PC.triEmoji}>🌙</Text>
                <Text style={[PC.triTitle, { color: '#60a5fa' }]}>{p.tithiName}</Text>
                <Text style={PC.triSub}>{p.paksha === 'Shukla' ? 'Waxing' : 'Waning'} Moon ({p.paksha})  ·  Day {p.tithiInPaksha}</Text>
                <Text style={PC.triEn}>{tithiEnergy}</Text>
              </View>

              {/* Moon Mansion */}
              <View style={[PC.triCell, { borderColor: '#fbbf2422' }]}>
                <Text style={PC.triEmoji}>{nakshatra.emoji}</Text>
                <Text style={[PC.triTitle, { color: '#fbbf24' }]}>{nakshatra.name}</Text>
                <Text style={PC.triSub}>{nakshatra.en}  ·  Moon Mansion</Text>
                <Text style={PC.triEn}>{nakshatra.energy}</Text>
              </View>

              {/* Cosmic Yoga */}
              <View style={[PC.triCell, { borderColor: yoga.auspicious ? '#10b98122' : '#f8717122' }]}>
                <Text style={PC.triEmoji}>{yoga.auspicious ? '✨' : '🌀'}</Text>
                <Text style={[PC.triTitle, { color: yoga.auspicious ? '#10b981' : '#f87171' }]}>{yoga.name}</Text>
                <Text style={PC.triSub}>{yoga.en}  ·  Cosmic Alignment</Text>
                <Text style={PC.triEn}>{yoga.meaning}</Text>
              </View>
            </View>

            <View style={PC.infoNote}>
              <Text style={PC.infoNoteText}>
                🕉️  Panchang is the Vedic cosmic calendar — five ancient "limbs of time" (Vaar, Tithi, Nakshatra, Yoga, Karana) used for 5,000+ years to align daily life with the cosmos.
              </Text>
            </View>
          </View>
        )}

        {/* Explore Cosmos button */}
        <TouchableOpacity
          onPress={(e) => { e.stopPropagation?.(); onExplore(); }}
          activeOpacity={0.8}
          style={[PC.exploreBtn, { borderColor: vaar.color + '40', backgroundColor: vaar.color + '10' }]}>
          <Text style={[PC.exploreTxt, { color: vaar.color }]}>🌌  Explore Today's Cosmic Science</Text>
          <Text style={[PC.exploreArrow, { color: vaar.color }]}>→</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
    </>
  );
}

// ── Today at a Glance — horizontal pill strip ─────────────────────────────
function TodayGlanceStrip({ currentPeriod, nextPeriod, weather }: {
  currentPeriod: DoshaPeriod | null;
  nextPeriod: DoshaPeriod | null;
  weather: WeatherData | null;
}) {
  const p          = getPanchangData();
  const moon       = getMoonPhase();
  const vaar       = VAARS[p.vaarIdx];
  const nakshatra  = NAKSHATRAS[p.nakshatraIdx];
  const yoga       = YOGAS[p.yogaIdx];
  const score      = getCosmicScore(yoga.auspicious, moon.emoji, p.tithiName);
  const scoreMeta  = SCORE_META[score];

  const items: { emoji: string; label: string; sub: string; color: string }[] = [
    ...(currentPeriod ? [{ emoji: currentPeriod.emoji, label: currentPeriod.label, sub: 'Active Now', color: currentPeriod.color }] : []),
    { emoji: vaar.emoji,       label: vaar.planet,      sub: vaar.vedicName,                  color: vaar.color  },
    { emoji: nakshatra.emoji,  label: nakshatra.name,   sub: nakshatra.en,                    color: '#fbbf24'   },
    { emoji: '🌙',             label: p.tithiName,      sub: p.paksha + ' Paksha',             color: '#60a5fa'   },
    { emoji: scoreMeta.emoji,  label: scoreMeta.label,  sub: 'Cosmic · ' + score + '/10',     color: scoreMeta.color },
    { emoji: yoga.auspicious ? '✨' : '⚠️', label: yoga.name, sub: yoga.en,                  color: yoga.auspicious ? '#34d399' : '#fb923c' },
    ...(weather ? [{ emoji: weather.emoji, label: weather.temp + '°C', sub: weather.condition, color: '#60a5fa' }] : []),
    ...(nextPeriod ? [{
      emoji: nextPeriod.emoji,
      label: nextPeriod.label,
      sub: 'in ' + (nextPeriod.minutesUntil < 60
        ? nextPeriod.minutesUntil + 'm'
        : Math.floor(nextPeriod.minutesUntil / 60) + 'h ' + (nextPeriod.minutesUntil % 60) + 'm'),
      color: nextPeriod.color,
    }] : []),
  ];

  return (
    <View style={{ marginTop: 8, marginBottom: 2 }}>
      <Text style={{ fontSize: 8, fontWeight: '900', color: '#FFFFFF99', letterSpacing: 1.8, marginLeft: 20, marginBottom: 7, textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }}>
        TODAY AT A GLANCE
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 2 }}>
        {items.map((item, i) => (
          <View key={i} style={{
            backgroundColor: 'rgba(255,255,255,0.09)',
            borderWidth: 1,
            borderColor: item.color + '60',
            borderRadius: 18,
            paddingHorizontal: 13,
            paddingVertical: 11,
            alignItems: 'center',
            gap: 4,
            minWidth: 80,
            overflow: 'hidden',
            shadowColor: item.color,
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.22,
            shadowRadius: 10,
            elevation: 4,
          }}>
            <Text style={{ fontSize: 22 }}>{item.emoji}</Text>
            <Text style={{ fontSize: 10, fontWeight: '800', color: item.color, textAlign: 'center', lineHeight: 13, textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 }} numberOfLines={1}>{item.label}</Text>
            <Text style={{ fontSize: 8, color: '#FFFFFFBB', fontWeight: '700', textAlign: 'center', lineHeight: 11, textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }} numberOfLines={1}>{item.sub}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// ── Night-aware emoji: replace sun with moon/stars for night hours ─────────
function nightAwareEmoji(emoji: string, hour: number, solarTimes?: SolarTimes | null): string {
  const sunrise = solarTimes?.sunrise ?? 6;
  const sunset  = solarTimes?.sunset  ?? 18.5;
  const isNight = hour < sunrise || hour >= sunset;
  if (!isNight) return emoji;
  const clearNightEmojis: Record<string, string> = { '☀️': '🌙', '🌤️': '🌙', '⛅': '🌙', '☁️': '☁️' };
  return clearNightEmojis[emoji] ?? emoji;
}

// ── Hourly Weather Strip ──────────────────────────────────────────────────
function HourlyStrip({ hourly, onMore, solarTimes }: { hourly: WeatherData['hourly']; onMore: () => void; solarTimes?: SolarTimes | null }) {
  return (
    <View style={W.stripContainer}>
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 4 }}>
        {hourly.map((pt, i) => (
          <View key={i} style={[W.hourCell, i === 0 && W.hourCellNow]}>
            <Text style={[W.hourLabel, i === 0 && { color: ACCENT }]}>{i === 0 ? 'NOW' : hrLabel(pt.hour)}</Text>
            <Text style={W.hourEmoji}>{nightAwareEmoji(pt.emoji, pt.hour, solarTimes)}</Text>
            <Text style={W.hourTemp}>{pt.temp}°</Text>
          </View>
        ))}
        <TouchableOpacity onPress={onMore} style={W.moreBtn} activeOpacity={0.8}>
          <Text style={W.moreTxt}>7 Days</Text>
          <Text style={W.moreArrow}>→</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ── Smart Weather Card (morning = day plan, afternoon = hourly live) ──────
function SmartWeatherCard({
  code, temp, humidity, hourly, isMorning,
}: {
  code: number; temp: number; humidity: number;
  hourly: WeatherData['hourly']; isMorning: boolean;
}) {
  if (isMorning) {
    const s = getWeatherSuggestion(code, temp, humidity);
    return (
      <View style={[WS.card, { borderColor: s.color + '45' }]}>
        <LinearGradient colors={['rgba(255,255,255,0.13)','rgba(255,255,255,0.03)','transparent']} start={{x:0,y:0}} end={{x:0,y:1}} style={StyleSheet.absoluteFillObject} />
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.30)' }} />
        <View style={[WS.colorBar, { backgroundColor: s.color }]} />
        <View style={{ flex: 1, paddingLeft: 14 }}>
          <Text style={WS.timeLabel}>TODAY  ·  DAY PLAN</Text>
          <View style={WS.titleRow}>
            <Text style={{ fontSize: 20 }}>{s.icon}</Text>
            <Text style={[WS.title, { color: s.color }]}>{s.title}</Text>
          </View>
          <View style={{ gap: 6, marginTop: 8 }}>
            {s.tips.map((tip, i) => (
              <View key={i} style={WS.tipRow}>
                <View style={[WS.tipDot, { backgroundColor: s.color }]} />
                <Text style={WS.tipText}>{tip}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }

  // After morning — show current-hour advice only
  const adv = getHourlyAdvice(code, temp);

  return (
    <View style={[WS.card, { borderColor: adv.color + '45' }]}>
      <LinearGradient colors={['rgba(255,255,255,0.13)','rgba(255,255,255,0.03)','transparent']} start={{x:0,y:0}} end={{x:0,y:1}} style={StyleSheet.absoluteFillObject} />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.30)' }} />
      <View style={[WS.colorBar, { backgroundColor: adv.color }]} />
      <View style={{ flex: 1, paddingLeft: 14 }}>
        <Text style={WS.timeLabel}>RIGHT NOW  ·  {hrLabel(new Date().getHours())}</Text>
        <View style={WS.titleRow}>
          <Text style={{ fontSize: 20 }}>{adv.icon}</Text>
          <Text style={[WS.title, { color: adv.color }]}>{adv.title}</Text>
        </View>
        <View style={{ gap: 6, marginTop: 8 }}>
          {adv.tips.map((tip, i) => (
            <View key={i} style={WS.tipRow}>
              <View style={[WS.tipDot, { backgroundColor: adv.color }]} />
              <Text style={WS.tipText}>{tip}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// ── 7-Day Forecast Modal ──────────────────────────────────────────────────
function SevenDayModal({ daily, onClose }: { daily: DailyPoint[]; onClose: () => void }) {
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={SD.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1} />
        <View style={SD.sheet}>
          <View style={SD.handle} />
          <View style={SD.sheetHeader}>
            <Text style={SD.sheetTitle}>7-Day Forecast</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={{ color: '#FFFFFF30', fontSize: 22, fontWeight: '200' }}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32, gap: 8 }}>
            {daily.map((day, i) => {
              const sugg = getWeatherSuggestion(day.weatherCode, day.maxTemp, 60);
              const isToday = i === 0;
              return (
                <View key={i} style={[
                  SD.dayCard,
                  { borderColor: isToday ? ACCENT + '80' : sugg.color + '38', backgroundColor: isToday ? ACCENT + '12' : sugg.color + '0C' },
                ]}>
                  <LinearGradient
                    colors={[isToday ? ACCENT + '22' : sugg.color + '18', 'rgba(4,4,18,0.55)', 'rgba(2,2,14,0.78)']}
                    start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                  />
                  <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.65)' }} />
                  {/* Left accent bar */}
                  <View style={{ width: 3, borderRadius: 2, alignSelf: 'stretch', backgroundColor: sugg.color + 'CC', marginRight: 12 }} />
                  {/* Day label */}
                  <View style={{ width: 54 }}>
                    <Text style={{ fontSize: 13, fontWeight: '900', color: isToday ? ACCENT : '#fff', letterSpacing: 0.2 }}>{day.dayLabel}</Text>
                    <Text style={{ fontSize: 8, color: '#FFFFFF35', marginTop: 2, fontWeight: '600' }}>{day.date.slice(5).replace('-', ' / ')}</Text>
                  </View>
                  {/* Emoji */}
                  <Text style={{ fontSize: 28, width: 38, textAlign: 'center' }}>{day.emoji}</Text>
                  {/* Condition + suggestion */}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, color: '#FFFFFFBB', fontWeight: '700', lineHeight: 16 }}>{day.condition}</Text>
                    {day.precipitation > 0 && <Text style={{ fontSize: 9, color: '#60a5fa', fontWeight: '700', marginTop: 2 }}>💧 {day.precipitation} mm</Text>}
                    <Text style={{ fontSize: 8, color: sugg.color + 'CC', fontWeight: '800', marginTop: 3, letterSpacing: 0.5 }}>{sugg.title}</Text>
                  </View>
                  {/* Temps */}
                  <View style={{ alignItems: 'flex-end', gap: 3 }}>
                    <Text style={{ fontSize: 16, fontWeight: '900', color: '#fff' }}>{day.maxTemp}°</Text>
                    <Text style={{ fontSize: 10, color: '#FFFFFF38', fontWeight: '700' }}>{day.minTemp}°</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── Panchang Explore Modal ────────────────────────────────────────────────
function PanchangExploreModal({ onClose }: { onClose: () => void }) {
  const moon = getMoonPhase();
  const p    = getPanchangData();
  const nakshatra = NAKSHATRAS[p.nakshatraIdx];
  const yoga      = YOGAS[p.yogaIdx];

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={EX.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1} />
        <View style={EX.sheet}>
          <LinearGradient
            colors={['#60a5fa1E', 'transparent']}
            start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 130, borderTopLeftRadius: 28, borderTopRightRadius: 28 }}
            pointerEvents="none"
          />
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: '#60a5fa70', borderTopLeftRadius: 28, borderTopRightRadius: 28 }} />
          <View style={EX.handle} />
          {/* Header */}
          <View style={EX.sheetHeader}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#60a5fa' }} />
                <Text style={EX.sheetCap}>VEDIC COSMIC SCIENCE</Text>
              </View>
              <Text style={EX.sheetTitle}>Today's Cosmic Blueprint</Text>
              <Text style={EX.sheetSub}>Orbital mechanics  ·  Tidal biology  ·  Chrono-astrology</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={EX.closeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={EX.closeTxt}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

            {/* Today summary */}
            <View style={EX.cosmoHero}>
              <MoonSVG tithiNum={moon.tithiNum} size={52} />
              <View style={{ flex: 1 }}>
                <Text style={EX.cosmoTitle}>{moon.name}  ·  {moon.illumination}% lit</Text>
                <Text style={EX.cosmoSub}>{p.tithiName}  ·  {p.paksha} Paksha  ·  Day {p.tithiInPaksha}</Text>
                <Text style={EX.cosmoSub2}>{nakshatra.emoji}  {nakshatra.name}  ·  {nakshatra.en}</Text>
              </View>
            </View>

            {/* Moon Science */}
            <View style={EX.exploreSection}>
              <Text style={EX.exploreSectionTitle}>🌊  The Moon–Body Connection</Text>
              <Text style={EX.exploreSectionSub}>Physics · Biology · Chronobiology</Text>
              <View style={[EX.sciBlock, { borderColor: '#60a5fa25', marginTop: 10 }]}>
                <Text style={[EX.sciBlockTitle, { color: '#60a5fa' }]}>Gravitational Physics</Text>
                <Text style={EX.sciBlockBody}>
                  The Moon exerts a measurable tidal force on Earth: 3.3 × 10⁻⁵ m/s² gravitational acceleration at the surface. While small, this force moves oceans — and your body is 60–70% water. The same tidal mechanics act on every fluid-filled cavity: cerebrospinal fluid, blood plasma, lymph, and intercellular fluid.
                </Text>
              </View>
              <View style={[EX.sciBlock, { borderColor: '#60a5fa25', marginTop: 8 }]}>
                <Text style={[EX.sciBlockTitle, { color: '#60a5fa' }]}>Chronobiology Research</Text>
                <Text style={EX.sciBlockBody}>
                  A landmark 2013 study (Cajochen et al., University of Basel) measured melatonin, sleep EEG, and cortisol across full lunar cycles in a light-controlled lab. Result: around full moon, melatonin was 30% lower, deep sleep reduced by 20 min, and subjects took 5 min longer to fall asleep — with no visual access to the moon. The mechanism is likely geomagnetic, not optical.
                </Text>
              </View>
              <View style={[EX.sciBlock, { borderColor: '#34d39925', marginTop: 8 }]}>
                <Text style={[EX.sciBlockTitle, { color: '#34d399' }]}>Biological Cycles</Text>
                <Text style={EX.sciBlockBody}>
                  The female reproductive cycle averages 27.3–29.5 days — nearly identical to the lunar synodic month (29.53 days). This is not coincidence: our evolutionary ancestors, living in natural light, had their endocrine systems entrained by lunar light cycles for millions of years. The Moon is humanity's oldest clock.
                </Text>
              </View>
            </View>

            {/* Tithi Science */}
            <View style={EX.exploreSection}>
              <Text style={EX.exploreSectionTitle}>📐  What is a Tithi? Orbital Mechanics</Text>
              <Text style={EX.exploreSectionSub}>{p.tithiName}  ·  {p.paksha} Paksha  ·  Day {p.tithiInPaksha} of 15</Text>
              <View style={[EX.sciBlock, { borderColor: '#fbbf2425', marginTop: 10 }]}>
                <Text style={[EX.sciBlockTitle, { color: '#fbbf24' }]}>The Mathematics</Text>
                <Text style={EX.sciBlockBody}>
                  A Tithi is defined as every 12° of angular separation between the Sun and Moon as seen from Earth. Since 360° ÷ 12° = 30, there are exactly 30 Tithis in a lunar month — 15 waxing (Shukla Paksha) and 15 waning (Krishna Paksha).{'\n\n'}This is pure orbital mechanics, not mythology. The Vedic astronomers were calculating synodic angles to arc-minute precision over 3,000 years ago.
                </Text>
              </View>
              <View style={[EX.sciBlock, { borderColor: '#fbbf2425', marginTop: 8 }]}>
                <Text style={[EX.sciBlockTitle, { color: '#fbbf24' }]}>Paksha Biology — Anabolic vs Catabolic</Text>
                <Text style={EX.sciBlockBody}>
                  <Text style={{ fontWeight: '800', color: '#fbbf24CC' }}>Shukla Paksha (Waxing Moon): </Text>
                  As the Moon-Sun angular separation increases, the resultant tidal force on body fluids increases. Plants absorb more water through roots (confirmed in agriculture studies). Cells show higher nutrient uptake. This is the anabolic phase — ideal for building, growing, and adding.{'\n\n'}
                  <Text style={{ fontWeight: '800', color: '#94a3b8CC' }}>Krishna Paksha (Waning Moon): </Text>
                  As the angle decreases, fluid tension reduces. The body prioritises elimination and detoxification. Ayurveda prescribes fasting, cleansing, and surgical procedures in Krishna Paksha for this reason — confirmed by reduced bleeding risk in surgery (studied in German hospitals in the 1990s).
                </Text>
              </View>
              <View style={[EX.highlightPill, { borderColor: '#60a5fa30', backgroundColor: '#60a5fa0C' }]}>
                <Text style={EX.highlightPillText}>
                  Today: <Text style={{ color: '#60a5faDD', fontWeight: '800' }}>{p.tithiName}</Text> — {p.paksha === 'Shukla' ? 'Waxing phase · Build, grow, take in' : 'Waning phase · Release, detox, reduce'}
                </Text>
              </View>
            </View>

            {/* Nakshatra Science */}
            <View style={EX.exploreSection}>
              <Text style={EX.exploreSectionTitle}>{nakshatra.emoji}  Nakshatra — The Lunar Mansions</Text>
              <Text style={EX.exploreSectionSub}>{nakshatra.name}  ·  {nakshatra.en}</Text>
              <View style={[EX.sciBlock, { borderColor: '#f9a8d425', marginTop: 10 }]}>
                <Text style={[EX.sciBlockTitle, { color: '#f9a8d4' }]}>The Stellar System</Text>
                <Text style={EX.sciBlockBody}>
                  The 27 Nakshatras divide the Moon's 27.3-day sidereal orbit into 27 equal segments of 13°20' each, each corresponding to a specific star cluster or asterism that the Moon passes through each day.{'\n\n'}This is the Moon's position relative to FIXED stars (sidereal), not relative to the Sun (synodic). These are two different coordinate systems — the Nakshatra tells you WHERE in the galaxy the Moon is pointing its gravitational vector.
                </Text>
              </View>
              <View style={[EX.sciBlock, { borderColor: '#f9a8d425', marginTop: 8 }]}>
                <Text style={[EX.sciBlockTitle, { color: '#f9a8d4' }]}>Today: {nakshatra.name} — {nakshatra.en}</Text>
                <Text style={EX.sciBlockBody}>{nakshatra.energy}</Text>
              </View>
            </View>

            {/* Yoga Science */}
            <View style={[EX.exploreSection, { marginBottom: 8 }]}>
              <Text style={EX.exploreSectionTitle}>✨  Yoga — The Sun-Moon Harmony</Text>
              <Text style={EX.exploreSectionSub}>{yoga.en}  ·  {yoga.auspicious ? 'Auspicious' : 'Challenging'}</Text>
              <View style={[EX.sciBlock, { borderColor: '#10b98125', marginTop: 10 }]}>
                <Text style={[EX.sciBlockTitle, { color: '#10b981' }]}>The Calculation</Text>
                <Text style={EX.sciBlockBody}>
                  A Yoga is calculated by adding the longitude of the Sun and the Moon (in degrees), then dividing by 13°20'. This gives 27 Yogas — measuring the combined solar-lunar electromagnetic influence on Earth's environment on that day.{'\n\n'}
                  <Text style={{ fontWeight: '800', color: yoga.auspicious ? '#10b981CC' : '#f87171CC' }}>Today's Yoga: {yoga.en} — {yoga.meaning}</Text>
                </Text>
              </View>
            </View>

          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── Current Period Card (compact, includes live clock) ───────────────────
function CurrentPeriodCard({
  period, liveClock, onExplore,
}: {
  period: DoshaPeriod; liveClock: Date;
  onExplore?: (dosha: string, label: string, start: string, end: string) => void;
}) {
  const router = useRouter();
  const rem  = period.minutesRemaining;
  const remStr = rem >= 60
    ? `${Math.floor(rem / 60)}h ${rem % 60}m left`
    : `${rem} min left`;
  const durH    = (period.endH - period.startH + 24) % 24;
  const totalM  = Math.round(durH * 60);
  const progress = totalM > 0 ? Math.min(1, Math.max(0, (totalM - rem) / totalM)) : 0;

  const hh = liveClock.getHours();
  const mm = liveClock.getMinutes();
  const ss = liveClock.getSeconds();
  const ampm = hh < 12 ? 'AM' : 'PM';
  const h12  = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  const clockStr = `${pad(h12)}:${pad(mm)}`;

  return (
    <>
    <View style={[CP.card, { borderColor: period.color + '99' }]}>
      <LinearGradient
        colors={[period.color + '28', 'rgba(4,4,18,0.45)', 'rgba(2,2,14,0.68)']}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFillObject} />
      <LinearGradient colors={['rgba(255,255,255,0.18)','rgba(255,255,255,0.05)','transparent']} start={{x:0,y:0}} end={{x:0,y:0.45}} style={StyleSheet.absoluteFillObject} />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.72)' }} />
      <GlassPulseOverlay />

      {/* Top row: badges + live clock */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={[CP.doshaBadge, { backgroundColor: period.color + '20', borderColor: period.color + '55' }]}>
            <Text style={[CP.doshaTxt, { color: period.color }]}>{period.dosha.toUpperCase()}</Text>
          </View>
          <View style={[CP.activeBadge, { backgroundColor: period.color + '15', borderColor: period.color + '40' }]}>
            <View style={[CP.activeDotB, { backgroundColor: period.color }]} />
            <Text style={[CP.activeTxtB, { color: period.color }]}>ACTIVE NOW</Text>
          </View>
        </View>
        {/* Live clock — only here, not in header */}
        <View style={{ alignItems: 'flex-end' }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3 }}>
            <Text style={{ fontSize: 26, fontWeight: '200', color: '#fff', letterSpacing: -1 }}>{clockStr}</Text>
            <Text style={{ fontSize: 11, fontWeight: '600', color: period.color, paddingBottom: 2 }}>{ampm}</Text>
          </View>
          <Text style={{ fontSize: 8, color: '#FFFFFF35', fontWeight: '700', letterSpacing: 0.5 }}>{pad(ss)}s</Text>
        </View>
      </View>

      {/* Name + countdown row — tappable to explore */}
      <TouchableOpacity
        onPress={() => onExplore ? onExplore(period.dosha, period.label, period.startLabel, period.endLabel) : router.push({ pathname: '/dosha-explore' as never, params: { activeDosha: period.dosha, periodLabel: period.label, periodStart: period.startLabel, periodEnd: period.endLabel } } as never)}
        activeOpacity={0.75}
        style={CP.nameRow}>
        <View style={{ flex: 1 }}>
          <Text style={[CP.name, { color: '#fff' }]}>{period.englishLabel}</Text>
          <Text style={[CP.engLabel, { color: period.color }]}>{period.label}</Text>
          <Text style={CP.sciSub}>{period.sciEmoji}  {period.sciTitle}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          <Text style={[CP.countdown, { color: period.color }]}>{remStr}</Text>
          <Text style={CP.timeRange}>{period.startLabel} → {period.endLabel}</Text>
          <Text style={[CP.exploreTapHint, { color: '#D4A84B90' }]}>tap to explore ↗</Text>
        </View>
      </TouchableOpacity>

      {/* Progress bar */}
      <View style={CP.progressTrack}>
        <View style={[CP.progressFill, { width: `${Math.round(progress * 100)}%` as any, backgroundColor: period.color }]} />
      </View>

      {/* Science description */}
      <Text style={CP.sciDesc}>{period.sciDesc}</Text>

      {/* DO's Section */}
      <View style={CP.divider} />
      <View style={CP.sectionHeaderRow}>
        <View style={[CP.sectionBadge, { backgroundColor: period.color + '22', borderColor: period.color + '55' }]}>
          <Text style={[CP.sectionBadgeTxt, { color: period.color }]}>✓  DO'S</Text>
        </View>
        <View style={[CP.sectionLine, { backgroundColor: period.color + '20' }]} />
      </View>
      <View style={[CP.listGrid, { marginBottom: 14 }]}>
        {period.activities.map((a, i) => (
          <View key={i} style={[CP.doCard, { backgroundColor: period.color + '18', borderColor: period.color + '45' }]}>
            <Text style={{ fontSize: 14, marginTop: 1 }}>{getActivityEmoji(a)}</Text>
            <Text style={CP.doTxt}>{a}</Text>
          </View>
        ))}
      </View>

      {/* DON'TS Section */}
      <View style={CP.sectionHeaderRow}>
        <View style={[CP.sectionBadge, { backgroundColor: '#f43f5e18', borderColor: '#f43f5e45' }]}>
          <Text style={[CP.sectionBadgeTxt, { color: '#f43f5e' }]}>✕  DON'TS</Text>
        </View>
        <View style={[CP.sectionLine, { backgroundColor: '#f43f5e18' }]} />
      </View>
      <View style={CP.listGrid}>
        {period.avoidances.map((a, i) => (
          <View key={i} style={[CP.dontCard, { backgroundColor: '#f43f5e14', borderColor: '#f43f5e42' }]}>
            <Text style={{ fontSize: 14, marginTop: 1 }}>{getAvoidanceEmoji(a)}</Text>
            <Text style={CP.dontTxt}>{a}</Text>
          </View>
        ))}
      </View>

      {/* Explore More CTA */}
      <View style={[CP.divider, { marginTop: 12 }]} />
      <TouchableOpacity
        onPress={() => onExplore ? onExplore(period.dosha, period.label, period.startLabel, period.endLabel) : router.push({ pathname: '/dosha-explore' as never, params: { activeDosha: period.dosha, periodLabel: period.label, periodStart: period.startLabel, periodEnd: period.endLabel } } as never)}
        activeOpacity={0.8}>
        <LinearGradient
          colors={['#D4A84B22', '#D4A84B0C']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={[CP.exploreBtn, { borderColor: '#D4A84B45' }]}>
          <View style={{ flex: 1 }}>
            <Text style={[CP.exploreTxt, { color: '#D4A84B' }]}>🔬  Explore Full Ayurvedic Science</Text>
            <Text style={{ fontSize: 9, color: '#D4A84B70', marginTop: 2, fontWeight: '600' }}>Elements · Biochemicals · Research · Chronobiology</Text>
          </View>
          <View style={[CP.exploreChevron, { backgroundColor: '#D4A84B25', borderColor: '#D4A84B50' }]}>
            <Text style={[CP.exploreArrow, { color: '#D4A84B' }]}>→</Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </View>
    </>
  );
}

// ── Next Solar Period Card — scientific briefing ─────────────────────────
function NextPeriodCard({ period }: { period: DoshaPeriod }) {
  const untilStr = period.minutesUntil >= 60
    ? `${Math.floor(period.minutesUntil / 60)}h ${period.minutesUntil % 60}m`
    : `${period.minutesUntil} min`;
  return (
    <View style={[NP.card, { borderColor: period.color + '99' }]}>
      <LinearGradient
        colors={[period.color + '25', 'rgba(4,4,18,0.45)', 'rgba(2,2,14,0.65)']}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFillObject} />
      <LinearGradient colors={['rgba(255,255,255,0.16)','rgba(255,255,255,0.04)','transparent']} start={{x:0,y:0}} end={{x:0,y:0.45}} style={StyleSheet.absoluteFillObject} />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.72)' }} />

      {/* Left accent bar */}
      <View style={[NP.sideBar, { backgroundColor: period.color }]} />

      <View style={{ flex: 1, paddingLeft: 14 }}>

        {/* Header row — label + countdown */}
        <View style={NP.headerRow}>
          <Text style={NP.sectionTag}>NEXT SOLAR WINDOW</Text>
          <View style={NP.countdownBox}>
            <Text style={NP.countdownLabel}>STARTS IN</Text>
            <Text style={[NP.countdownTime, { color: period.color }]}>{untilStr}</Text>
          </View>
        </View>

        {/* Identity row */}
        <View style={NP.identityRow}>
          <Text style={NP.bigEmoji}>{period.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={NP.periodTitle}>{period.englishLabel}</Text>
            <Text style={[NP.periodAyur, { color: period.color }]}>{period.label}</Text>
          </View>
          <View style={[NP.doshaPill, { backgroundColor: period.color + '18', borderColor: period.color + '45' }]}>
            <Text style={[NP.doshaPillTxt, { color: period.color }]}>{period.dosha.toUpperCase()}</Text>
          </View>
        </View>

        {/* Science title */}
        <Text style={NP.sciTitle}>{period.sciEmoji}  {period.sciTitle}</Text>

        {/* Body shift science box */}
        <View style={[NP.shiftBox, { borderColor: period.color + '22' }]}>
          <Text style={[NP.shiftLabel, { color: period.color + 'AA' }]}>🔬  WHAT SHIFTS IN YOUR BODY</Text>
          <Text style={NP.shiftText} numberOfLines={3}>{period.sciDesc}</Text>
        </View>

        {/* Prepare now tips */}
        <View style={NP.prepSection}>
          <Text style={NP.prepLabel}>✓  PREPARE NOW</Text>
          {period.activities.slice(0, 2).map((a, i) => (
            <View key={i} style={NP.prepRow}>
              <View style={[NP.prepDot, { backgroundColor: period.color + '90' }]} />
              <Text style={NP.prepText}>{a}</Text>
            </View>
          ))}
        </View>

        {/* Time range */}
        <Text style={NP.timeRange}>{period.startLabel}  →  {period.endLabel}</Text>
      </View>
    </View>
  );
}

// ── Brahma Muhurta Extras (science info) ────────────────────────────────
function BrahmaMuhurtaExtrasCard({
  info,
}: {
  info: BrahmaMuhurtaInfo;
}) {
  const [showSci, setShowSci] = useState(false);
  return (
    <View style={BMX.card}>
      <LinearGradient colors={['rgba(96,165,250,0.22)','rgba(96,165,250,0.08)','transparent']} start={{x:0,y:0}} end={{x:0,y:1}} style={StyleSheet.absoluteFillObject} />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.32)' }} />
      <View style={BMX.headerRow}>
        <View>
          <Text style={BMX.sacredLabel}>SACRED WINDOW</Text>
          <Text style={BMX.sacredTimes}>{info.startLabel}  →  {info.endLabel}</Text>
          <Text style={BMX.sacredSub}>96–48 min before sunrise</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(96,165,250,0.20)', borderWidth: 1, borderColor: 'rgba(96,165,250,0.50)', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6 }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#60a5fa' }} />
          <Text style={{ fontSize: 9, fontWeight: '900', color: '#60a5fa', letterSpacing: 1.5 }}>LIVE</Text>
        </View>
      </View>
      <TouchableOpacity onPress={() => setShowSci(v => !v)} style={BMX.sciRow} activeOpacity={0.8}>
        <Text style={BMX.sciToggleTxt}>🔬  5 Scientific Perspectives</Text>
        <Text style={{ color: '#FFFFFF25', fontSize: 16 }}>{showSci ? '⌃' : '⌄'}</Text>
      </TouchableOpacity>
      {showSci && (
        <View style={{ gap: 2 }}>
          {SCIENCE_ALIASES.map((a, i) => (
            <View key={i} style={[BMX.aliasRow, i > 0 && { borderTopWidth: 1, borderTopColor: '#FFFFFF06' }]}>
              <Text style={{ fontSize: 15 }}>{a.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={BMX.aliasTitle}>{a.title}</Text>
                <Text style={BMX.aliasDesc}>{a.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Season Intelligence Engine ─────────────────────────────────────────────
type SeasonInfo = {
  name: string; emoji: string; color: string;
  doshaAffinity: string; zone: string;
  sciDesc: string; advice: string;
};

function getSeason(lat: number, month: number, temp: number, humidity: number): SeasonInfo {
  const isTropical = Math.abs(lat) < 23.5;
  const isSouthern = lat < 0;

  if (isTropical) {
    const isWet = humidity >= 68 || [4,5,6,7,8,9].includes(month);
    if (isWet) return {
      name: 'Wet Season', emoji: '🌧️', color: '#60a5fa', doshaAffinity: 'Kapha-Vata',
      zone: 'Tropical',
      sciDesc: 'High relative humidity reduces air O₂ partial pressure, slowing cellular aerobic metabolism. Barometric oscillations from rainfall activate vagal nerve tension and cyclic sympathetic arousal.',
      advice: 'Support digestive fire (Agni) with warm spiced foods. Counter lymphatic stagnation with vigorous morning movement. Avoid cold, raw or heavy foods which compound Kapha accumulation.',
    };
    return {
      name: 'Dry Season', emoji: '🌵', color: '#fb923c', doshaAffinity: 'Pitta-Vata',
      zone: 'Tropical',
      sciDesc: 'Tropical dry season combines intense UV radiation (elevating cortisol and prostaglandins) with low humidity that desiccates mucosal membranes and reduces neural conduction efficiency.',
      advice: 'Cooling, hydrating foods are critical. Coconut water replenishes electrolytes. Avoid peak solar hours (11 AM–2 PM). Sheetali pranayama (cooling breath) actively lowers core temperature.',
    };
  }

  const m = isSouthern ? (month + 6) % 12 : month;
  const zone = isSouthern ? 'Southern Hemisphere' : 'Northern Hemisphere';

  if (m >= 2 && m <= 4) return {
    name: 'Spring', emoji: '🌸', color: '#34d399', doshaAffinity: 'Kapha',
    zone,
    sciDesc: 'Spring triggers accumulated winter Kapha to liquefy and release. Histamine surges (allergy season) represent Kapha-immune excess. Lymphatic congestion peaks as the body attempts seasonal detoxification through the skin, sinuses and digestive tract.',
    advice: 'Ideal season for dietary detox. Reduce sweet, heavy, oily foods. Increase vigorous morning exercise. Honey, ginger and pungent spices accelerate Kapha dissolution. Intermittent fasting (16:8) strongly supported.',
  };
  if (m >= 5 && m <= 7) return {
    name: 'Summer', emoji: '☀️', color: '#fbbf24', doshaAffinity: 'Pitta',
    zone,
    sciDesc: 'Summer solar radiation directly elevates core body temperature and UV-driven cortisol output. Prolonged heat suppresses digestive enzyme secretion as the hypothalamus prioritises thermoregulation over digestion.',
    advice: 'Cooling foods essential: cucumber, coconut, coriander, mint. Outdoor activity before 8 AM only. Evening moonlight walks lower cortisol. Avoid spicy foods, midday exertion and competitive stress which triple Pitta.',
  };
  if (m >= 8 && m <= 10) return {
    name: 'Autumn', emoji: '🍂', color: '#60a5fa', doshaAffinity: 'Vata',
    zone,
    sciDesc: 'Autumn\'s dry, cool, erratic winds up-regulate sympathetic nervous system tone. Shortened daylight reduces serotonin synthesis and disrupts the melatonin-cortisol circadian axis. The Pitta-to-Vata seasonal transition creates a systemic neural volatility surge.',
    advice: 'A fixed daily routine (Dinacharya) is the single most powerful Vata stabiliser. Warm sesame Abhyanga grounds the sympathetic nervous system. Root vegetables, warming spices and warm oils counter the drying season.',
  };
  return {
    name: 'Winter', emoji: '❄️', color: '#60a5fa', doshaAffinity: 'Vata-Kapha',
    zone,
    sciDesc: 'Winter combines Vata aggravation (cold, dry, shortened daylight) with Kapha stagnation. Serotonin synthesis drops measurably with reduced UV — seasonal neurochemical disruption is well-documented. Paradoxically, digestive fire (Agni) is at its annual peak in cold weather.',
    advice: 'Leverage strong winter Agni with nourishing, heavier meals. Prioritise vitamin D. Move vigorously to counter Kapha inertia. Consistent sleep timing is critical as melatonin rhythms are most fragile in winter.',
  };
}

// ── Weather × Dosha Intelligence Engine ──────────────────────────────────
function getWeatherDoshaInsight(code: number, temp: number, humidity: number, dosha: string, season?: SeasonInfo): {
  impact: string;
  tip: string;
  combinedTip: string;
  extraActivities: string[];
  extraAvoidances: string[];
} {
  const isHot    = temp >= 28;
  const isWarm   = temp >= 22 && temp < 28;
  const isCool   = temp >= 15 && temp < 22;
  const isCold   = temp < 15;
  const isHumid  = humidity >= 70;
  const isDry    = humidity < 40;
  const isRainy  = [51,53,55,61,63,65,80,81,82,95].includes(code);
  const isCloudy = [1,2,3,45,48].includes(code);
  const isClear  = code === 0;

  // Build season resonance note — whether season amplifies or moderates today
  const seasonNote = (s: SeasonInfo | undefined, doshaKey: string): string => {
    if (!s) return '';
    const sameDosha = s.doshaAffinity.toLowerCase().includes(doshaKey);
    if (sameDosha)
      return ` ${s.emoji} ${s.name} is a ${s.doshaAffinity} season — today\'s weather and season both push in the same direction. This is a high-priority adjustment window.`;
    return ` ${s.emoji} ${s.name} (${s.doshaAffinity} season) provides a seasonal counterbalance — the season moderates some of today\'s ${doshaKey.charAt(0).toUpperCase() + doshaKey.slice(1)} intensity.`;
  };

  if (dosha === 'vata') {
    if (isCold || isDry) return {
      impact: 'Cold & dry air up-regulates the sympathetic nervous system — Vata aggravated',
      tip: 'Low humidity reduces mucosal conductivity, slowing nerve conduction velocity. Warm, grounding inputs stabilise the dopamine-norepinephrine axis and reduce cortisol hyper-reactivity.',
      combinedTip: `Low humidity reduces mucosal conductivity and slows nerve conduction velocity. Warm, grounding inputs stabilise the dopamine-norepinephrine axis and reduce cortisol hyper-reactivity.${seasonNote(season, 'vata')}`,
      extraActivities: ['Warm herbal tea before practice', 'Indoor breathwork', 'Warm sesame self-massage'],
      extraAvoidances: ['Prolonged cold exposure', 'Skipping breakfast', 'Irregular meal timing'],
    };
    if (isRainy) return {
      impact: 'Barometric pressure drops during rain — sympathetic arousal and anxiety pathways spike',
      tip: 'Falling air pressure activates vagal nerve tension. Rhythmic 4-7-8 breathing resets parasympathetic tone and counters the cortisol surge that rainy Vata mornings produce.',
      combinedTip: `Falling barometric pressure directly activates vagal nerve tension and elevates norepinephrine. Rhythmic 4-7-8 breathing resets parasympathetic tone within 3 minutes.${seasonNote(season, 'vata')}`,
      extraActivities: ['Slow pranayama', 'Journaling', 'Warm nourishing breakfast', 'Indoor meditation'],
      extraAvoidances: ['Cold damp exposure', 'Erratic schedule', 'Raw cold foods'],
    };
    if (isHot && isHumid) return {
      impact: 'Warm humidity mildly pacifies Vata — optimal autonomic balance window',
      tip: 'Moderate warmth supports acetylcholine synthesis and nerve conduction. Stay hydrated — even mild dehydration reduces working memory by 15% in the Vata cognitive peak window.',
      combinedTip: `Moderate warmth supports acetylcholine synthesis and nerve conduction. Even mild dehydration reduces working memory by 15% — prioritise fluid intake during this Vata cognitive peak.${seasonNote(season, 'vata')}`,
      extraActivities: ['Outdoor gentle walk', 'Creative deep work', 'Coconut water hydration'],
      extraAvoidances: ['Dehydration', 'Overexertion in peak heat', 'Caffeine excess'],
    };
    return {
      impact: 'Mild conditions — Vata sympathetic tone in natural circadian balance',
      tip: 'Stable atmospheric pressure supports the norepinephrine peak of the Vata window — the highest neural plasticity state of the 24-hour cycle.',
      combinedTip: `Stable atmospheric pressure supports the norepinephrine peak of the Vata window. This is the highest neural plasticity state of the 24-hour cycle — prioritise learning, movement and creativity.${seasonNote(season, 'vata')}`,
      extraActivities: ['Focused learning', 'Morning walk in natural light'],
      extraAvoidances: ['Skipping the morning routine', 'Multitasking'],
    };
  }

  if (dosha === 'pitta') {
    if (isHot) return {
      impact: 'Elevated ambient temperature co-elevates core body temperature — Pitta strongly aggravated',
      tip: 'High external heat forces the hypothalamus to suppress digestive enzyme output and divert energy to thermoregulation. Core temp above 37°C triggers systemic Pitta cascade.',
      combinedTip: `High external heat forces the hypothalamus to suppress digestive enzyme output (HCl, pepsin, bile acids) and redirect energy to thermoregulation. Eat light and cool.${seasonNote(season, 'pitta')}`,
      extraActivities: ['Stay shaded', 'Coconut water or lime water', 'Cool shower', 'Cooling pranayama (Sheetali)'],
      extraAvoidances: ['Direct midday sun', 'Spicy & acidic foods', 'Competitive exertion', 'Anger or confrontation'],
    };
    if (isCool || isCold) return {
      impact: 'Cool ambient air moderates Pitta — metabolic-endocrine axis at peak efficiency',
      tip: 'Cooler temperature allows core body temperature to remain optimal without thermoregulatory interference. Gastric acid and bile acid secretion hit their biological maximum now.',
      combinedTip: `Cooler external conditions let your core temperature maintain the sweet spot for enzyme activity. HCl, pepsin and bile acids are at maximum secretion — this is your most powerful digestive window.${seasonNote(season, 'pitta')}`,
      extraActivities: ['Largest meal of day', 'Strength training', 'Deep analytical work', 'Strategic planning'],
      extraAvoidances: ['Skipping lunch', 'Overworking without hydration breaks'],
    };
    if (isRainy || isCloudy) return {
      impact: 'Reduced solar UV load during overcast conditions mildly pacifies Pitta',
      tip: 'Overcast skies reduce thermal and UV load, lowering cortisol-driven inflammation. Cytochrome P450 liver detox enzymes are more efficient with moderated core temperature.',
      combinedTip: `Overcast conditions reduce thermal and UV load, lowering cortisol-driven prostaglandin output. Cytochrome P450 Phase I & II liver detox enzymes operate more efficiently when core temperature is stabilised.${seasonNote(season, 'pitta')}`,
      extraActivities: ['Light lunch', 'Indoor focused work', 'Hydrate with room-temp water'],
      extraAvoidances: ['Heavy oily meals', 'Excess caffeine', 'Prolonged screen time'],
    };
    return {
      impact: 'Moderate conditions — Pitta metabolic fire at full biological efficiency',
      tip: 'Gastric acid secretion peaks at solar noon (intragastric pH studies confirm lowest pH 12–1 PM). Maximum nutrient assimilation window.',
      combinedTip: `Gastric acid (HCl) secretion peaks at solar noon — intragastric pH studies confirm lowest pH at 12–1 PM. Insulin sensitivity is simultaneously at its daily peak. Eat your largest, most complex meal now.${seasonNote(season, 'pitta')}`,
      extraActivities: ['Main meal of the day', 'Problem-solving sessions'],
      extraAvoidances: ['Fasting through midday', 'Eating while stressed'],
    };
  }

  if (dosha === 'kapha') {
    if (isHumid || (isCloudy && !isClear)) return {
      impact: 'Humid & overcast conditions strongly amplify Kapha — lymphatic stagnation and serotonin dominance risk',
      tip: 'High humidity reduces air O₂ partial pressure by 3–5%, suppressing aerobic metabolism. Lymphocyte circulation rises 3× during exercise versus rest.',
      combinedTip: `High humidity reduces air O₂ partial pressure by 3–5%, suppressing cellular aerobic metabolism. Lymphocyte circulation rate rises 3× during vigorous exercise — move to counteract the dual environmental-circadian Kapha load.${seasonNote(season, 'kapha')}`,
      extraActivities: ['Vigorous cardio before 9 AM', 'Kapalabhati pranayama (100+ rapid exhales)', 'Dry brushing', 'Warm spiced ginger tea'],
      extraAvoidances: ['Sleeping past sunrise', 'Heavy dairy breakfast', 'Sedentary morning hours', 'Cold food or drinks'],
    };
    if (isClear && (isWarm || isHot)) return {
      impact: 'Clear warm morning — optimal Kapha activation, ideal anabolic hormone conditions',
      tip: 'Sunlight triggers the cortisol awakening response co-peaking with testosterone. Outdoor exercise maximises vitamin D synthesis and muscle protein synthesis rates simultaneously.',
      combinedTip: `Morning sunlight triggers the cortisol awakening response which co-peaks with testosterone, creating a unique anabolic window. Outdoor exercise in direct sunlight maximises vitamin D synthesis and muscle protein synthesis rates simultaneously.${seasonNote(season, 'kapha')}`,
      extraActivities: ['Outdoor exercise in sunlight', 'Brisk walk or run', 'Bodyweight circuit training'],
      extraAvoidances: ['Staying indoors', 'Heavy foods before exercise', 'Morning nap'],
    };
    if (isCold) return {
      impact: 'Cold morning amplifies Kapha sluggishness — growth hormone suppressed without activation',
      tip: 'Kapalabhati pranayama raises core temperature by 0.3°C in 3 minutes and flushes the lymphatic system via diaphragmatic pressure — no equipment needed.',
      combinedTip: `Cold increases lymphatic stagnation risk. Kapalabhati pranayama raises core temperature by 0.3°C within 3 minutes and flushes the lymphatic system via diaphragmatic pressure changes — the most efficient cold-morning Kapha activator.${seasonNote(season, 'kapha')}`,
      extraActivities: ['Kapalabhati pranayama on waking', 'Warm spiced drink (ginger-pepper)', 'Indoor HIIT'],
      extraAvoidances: ['Long hot showers (induces lethargy)', 'Cold foods', 'Low-movement morning'],
    };
    return {
      impact: 'Mild morning — Kapha in moderate activation state, movement required',
      tip: 'Lymphocyte count peaks in morning blood draws — this immune advantage is only realised through physical activation.',
      combinedTip: `Move within 30 minutes of waking. Lymphocyte count is measurably highest in morning blood draws — this immune advantage is only realised through physical activation, not rest.${seasonNote(season, 'kapha')}`,
      extraActivities: ['Morning walk', 'Light exercise', 'Active commute'],
      extraAvoidances: ['Prolonged sitting', 'Heavy carbohydrate breakfast'],
    };
  }

  return {
    impact: 'Weather interacting with your circadian biology',
    tip: 'Aligning environmental conditions with your active dosha period produces compounding benefits.',
    combinedTip: `Aligning your season, today's weather and active dosha period produces compounding benefits across the hormonal, neurological and metabolic axes.${seasonNote(season, dosha)}`,
    extraActivities: [],
    extraAvoidances: [],
  };
}

// ── Today at a Glance — Premium Hero Card ─────────────────────────────────
function TodayHeroCard({
  onExplore, onExploreDosha, solarTimes, weather, currentPeriod, liveClock,
}: {
  onExplore: () => void;
  onExploreDosha: (dosha: string, label: string, start: string, end: string) => void;
  solarTimes: SolarTimes | null;
  weather: WeatherData | null;
  currentPeriod: DoshaPeriod | null;
  liveClock: Date;
}) {
  const p           = getPanchangData();
  const moon        = getMoonPhase();
  const vaar        = VAARS[p.vaarIdx];
  const nakshatra   = NAKSHATRAS[p.nakshatraIdx];
  const yoga        = YOGAS[p.yogaIdx];
  const vMonth      = getVedicMonth();
  const tithiEnergy = TITHI_ENERGY[p.tithiName] ?? 'Sacred lunar energy';
  const moonRitual  = MOON_RITUALS[moon.emoji] ?? { prompt: 'Lunar energy', action: 'Connect with the moon tonight.' };
  const vaarAction  = VAAR_ACTIONS[p.vaarIdx] ?? '';
  const isSpecialMoon = moon.emoji === '🌕' || moon.emoji === '🌑';

  const today     = new Date();
  const dateLabel = today.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const hh = liveClock.getHours();
  const mm = liveClock.getMinutes();
  const ampm = hh < 12 ? 'AM' : 'PM';
  const h12  = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  const clockStr = `${pad(h12)}:${pad(mm)} ${ampm}`;

  const per  = currentPeriod;
  const rem  = per?.minutesRemaining ?? 0;
  const remStr = rem >= 60 ? `${Math.floor(rem / 60)}h ${rem % 60}m` : `${rem}m left`;
  const durM = per ? Math.round(((per.endH - per.startH + 24) % 24) * 60) : 1;
  const progress = per ? Math.min(1, Math.max(0, (durM - rem) / durM)) : 0;

  const maxT = weather?.daily?.[0]?.maxTemp ?? null;
  const minT = weather?.daily?.[0]?.minTemp ?? null;

  const STARS = [
    { top: 18, right: 28, size: 1.5, opacity: 0.35 },
    { top: 38, right: 56, size: 1,   opacity: 0.22 },
    { top: 10, right: 80, size: 2,   opacity: 0.18 },
    { top: 55, right: 40, size: 1,   opacity: 0.28 },
    { top: 26, right: 112,size: 1.5, opacity: 0.20 },
    { top: 70, right: 90, size: 1,   opacity: 0.15 },
    { top: 8,  right: 145,size: 1,   opacity: 0.18 },
  ];

  return (
    <View style={TH.card}>
      <LinearGradient
        colors={[(per?.color ?? vaar.color) + '28', vaar.color + '14', 'transparent']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject} />
      <LinearGradient colors={['rgba(255,255,255,0.18)','rgba(255,255,255,0.06)','transparent']} start={{x:0,y:0}} end={{x:0,y:0.45}} style={StyleSheet.absoluteFillObject} />
      <View style={TH.topHighlight} />

      {/* ═══════════════════════════════════════
          SECTION 1 — COSMIC CALENDAR (tappable → cosmic-explore)
      ═══════════════════════════════════════ */}
      <TouchableOpacity onPress={onExplore} activeOpacity={0.88} style={{ padding: 16, paddingTop: 12 }}>
        {/* Decorative star dots — cosmic atmosphere */}
        {STARS.map((s, i) => (
          <View key={i} style={[TH.starDot, { top: s.top, right: s.right, width: s.size, height: s.size, opacity: s.opacity }]} />
        ))}
        {/* Header */}
        <View style={TH.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={TH.headerLabel}>TODAY AT A GLANCE  ·  VEDIC ALMANAC</Text>
            <Text style={TH.headerSub}>
              <Text style={{ color: '#60a5fa70', fontWeight: '800' }}>{vMonth.name}  </Text>
              <Text style={{ color: '#FFFFFF28' }}>{dateLabel}  ·  {clockStr}</Text>
            </Text>
          </View>
        </View>

        <View style={TH.divider} />

        {/* Special moon banner */}
        {isSpecialMoon && (
          <View style={[TH.moonBanner, {
            borderColor: moon.emoji === '🌕' ? '#fbbf2440' : '#60a5fa40',
            backgroundColor: moon.emoji === '🌕' ? '#fbbf2408' : '#60a5fa08',
          }]}>
            <Text style={{ fontSize: 18 }}>{moon.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[TH.moonBannerTitle, { color: moon.emoji === '🌕' ? '#fbbf24' : '#60a5fa' }]}>
                {moon.emoji === '🌕' ? 'FULL MOON TODAY' : 'NEW MOON TODAY'}
              </Text>
              <Text style={TH.moonBannerSub}>
                {moon.emoji === '🌕' ? 'Peak energy. Best day to release, celebrate & be seen.' : 'Clean slate. Ideal day to set intentions & begin fresh.'}
              </Text>
            </View>
          </View>
        )}

        {/* ── Big headline: Moon + Vaar energy ── */}
        <View style={TH.cosmicRow}>
          <MoonSVG tithiNum={moon.tithiNum} size={38} />
          <View style={{ flex: 1 }}>
            <Text style={[TH.vaarEnergyTitle, { color: vaar.color, fontSize: 16 }]}>{vaar.energy}</Text>
            <Text style={TH.cosmicLine2} numberOfLines={1}>
              <Text style={{ color: vaar.color + '90', fontWeight: '700' }}>{vaar.planet} Day  </Text>
              <Text style={{ color: '#FFFFFF30' }}>·  </Text>
              <Text>{p.paksha === 'Shukla' ? 'Waxing' : 'Waning'}  {moon.illumination}% Moon</Text>
            </Text>
          </View>
        </View>

        {/* ── DO TODAY: one short action line ── */}
        <View style={{ marginTop: 10, marginBottom: 10 }}>
          <Text style={TH.doTodayLabel}>DO THIS TODAY</Text>
          <Text style={TH.doTodayTxt} numberOfLines={2}>{vaarAction}</Text>
        </View>

        {/* ── Compact info pills row ── */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 10 }}>
          {/* Tithi */}
          <View style={[TH.cosmicPill, { borderColor: '#60a5fa55', backgroundColor: '#60a5fa18' }]}>
            <Text style={{ fontSize: 9 }}>🌙</Text>
            <Text style={[TH.cosmicPillTxt, { color: '#60a5faCC' }]}>{p.tithiName}</Text>
          </View>
          {/* Nakshatra */}
          <View style={[TH.cosmicPill, { borderColor: '#fbbf2455', backgroundColor: '#fbbf2418' }]}>
            <Text style={{ fontSize: 9 }}>{nakshatra.emoji}</Text>
            <Text style={[TH.cosmicPillTxt, { color: '#fbbf24CC' }]}>{nakshatra.name}</Text>
          </View>
          {/* Yoga */}
          <View style={[TH.cosmicPill, { borderColor: yoga.auspicious ? '#10b98155' : '#f8717155', backgroundColor: yoga.auspicious ? '#10b98118' : '#f8717118' }]}>
            <View style={[TH.yogaDot, { backgroundColor: yoga.auspicious ? '#10b981' : '#f87171' }]} />
            <Text style={[TH.cosmicPillTxt, { color: yoga.auspicious ? '#10b981CC' : '#f87171CC' }]}>{yoga.en}</Text>
          </View>
        </View>

        {/* ── Compact context bar: season · weather ── */}
        <View style={TH.contextBar}>
              {season && (
                <View style={[TH.ctxPill, { borderColor: season.color + '35', backgroundColor: season.color + '10' }]}>
                  <Text style={{ fontSize: 10 }}>{season.emoji}</Text>
                  <Text style={[TH.ctxPillTxt, { color: season.color }]}>{season.name}</Text>
                </View>
              )}
              <Text style={TH.ctxDot}>·</Text>
              {weather && (
                <Text style={TH.ctxWeather}>{weather.emoji} {weather.temp}°  {weather.condition}</Text>
              )}
              {maxT !== null && minT !== null && (
                <Text style={TH.ctxRange}> ↑{maxT}° ↓{minT}°</Text>
              )}
            </View>

            {/* ── Impact one-liner ── */}
            <View style={[TH.impactRow, { marginBottom: 12 }]}>
              <View style={[TH.impactDot, { backgroundColor: per.color }]} />
              <Text style={[TH.impactTxt, { color: per.color + 'CC' }]} numberOfLines={2}>{insight.impact}</Text>
            </View>

            {/* ── Dosha badge + active + countdown ── */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 }}>
              <View style={[TH.badge, { backgroundColor: per.color + '20', borderColor: per.color + '50' }]}>
                <Text style={[TH.badgeTxt, { color: per.color }]}>{per.dosha.toUpperCase()}</Text>
              </View>
              <View style={[TH.activePill, { backgroundColor: per.color + '15', borderColor: per.color + '35' }]}>
                <View style={[TH.activeDot, { backgroundColor: per.color }]} />
                <Text style={[TH.activeTxt, { color: per.color }]}>ACTIVE NOW</Text>
              </View>
              <View style={{ flex: 1 }} />
              <Text style={[TH.countdown, { color: per.color }]}>{remStr}</Text>
            </View>

            {/* ── Period name ── */}
            <Text style={TH.energyName}>{per.emoji}  {per.englishLabel}</Text>
            <Text style={[TH.energySci, { color: per.color + '90', marginBottom: 10, marginTop: 3 }]}>
              {per.sciEmoji}  {per.sciTitle}
            </Text>

            {/* ── Progress bar with times ── */}
            <View style={TH.progressTrack}>
              <View style={[TH.progressFill, { width: `${Math.round(progress * 100)}%` as any, backgroundColor: per.color }]} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 5, marginBottom: 14 }}>
              <Text style={TH.timeRange}>{per.startLabel}</Text>
              <Text style={TH.timeRange}>{per.endLabel}</Text>
            </View>

            {/* ── Top activities (weather-boosted) ── */}
            <Text style={[TH.periodSecLabel, { color: per.color + 'BB' }]}>✓  DO NOW</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {topActs.map((a, i) => (
                <View key={i} style={[TH.chip, { borderColor: per.color + '40', backgroundColor: per.color + '12' }]}>
                  <View style={[TH.chipDot, { backgroundColor: per.color + 'CC' }]} />
                  <Text style={[TH.chipTxt, { color: '#FFFFFFAA' }]}>{a}</Text>
                </View>
              ))}
            </View>

            {/* ── Explore row ── */}
            <View style={[TH.exploreRow, { borderTopColor: per.color + '20' }]}>
              <Text style={[TH.exploreTxt, { color: per.color }]}>
                🔬  Full Analysis · Season, Weather & Dosha Science
              </Text>
              <Text style={[TH.exploreArrow, { color: per.color }]}>→</Text>
            </View>
          </TouchableOpacity>
        );
      })()}
    </View>
  );
}

// ── Activity / Avoidance emoji helpers ────────────────────────────────────────
function getActivityEmoji(text: string): string {
  if (/yoga|sun salutation/i.test(text)) return '🧘';
  if (/strength|weight|training|gym/i.test(text)) return '🏋️';
  if (/pranayama|kapalbhati|breath/i.test(text)) return '🫁';
  if (/breakfast|meal|nourish|food/i.test(text)) return '🥗';
  if (/massage|abhyanga|oil/i.test(text)) return '🧴';
  if (/walk|sunlight/i.test(text)) return '🌅';
  if (/meditation|dhyana|mantra|sankalpa/i.test(text)) return '🕉️';
  if (/study|scripture|reading|learn/i.test(text)) return '📖';
  if (/prayer|gratitude/i.test(text)) return '🙏';
  if (/work|focus|cognitive|strategy|decision|meeting/i.test(text)) return '🎯';
  if (/cold shower|shower/i.test(text)) return '🚿';
  if (/brush/i.test(text)) return '✨';
  if (/fasting|fast/i.test(text)) return '⏱️';
  if (/stillness|quiet/i.test(text)) return '🌙';
  return '⚡';
}

function getAvoidanceEmoji(text: string): string {
  if (/sleep|nap/i.test(text)) return '😴';
  if (/caffeine|coffee/i.test(text)) return '☕';
  if (/phone|social|media/i.test(text)) return '📵';
  if (/screen|digital|bright/i.test(text)) return '📺';
  if (/food|fried|breakfast|dairy|sweet|oily|heavy/i.test(text)) return '🍔';
  if (/anger|conflict|argument|heated/i.test(text)) return '⚡';
  if (/sun|heat|midday/i.test(text)) return '☀️';
  if (/cold|ice|raw/i.test(text)) return '❄️';
  if (/noise|loud|conversation/i.test(text)) return '🔊';
  if (/exertion|intense|physical/i.test(text)) return '🏃';
  if (/multi.*task|multitask/i.test(text)) return '🌀';
  if (/schedule|irregular/i.test(text)) return '🗓️';
  if (/spicy|acidic/i.test(text)) return '🌶️';
  if (/skip|delay.*lunch|skipping/i.test(text)) return '🍽️';
  if (/overwork|burnout|without.*break/i.test(text)) return '🔋';
  return '⚠️';
}

// ── Compact Cosmic Pill Button (homepage → cosmic-explore) ─────────────────
function CosmicPill({ onPress }: { onPress: () => void }) {
  const p      = getPanchangData();
  const moon   = getMoonPhase();
  const vaar   = VAARS[p.vaarIdx];
  const vMonth = getVedicMonth();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      style={CPL.container}>
      <LinearGradient
        colors={[vaar.color + '28', '#60a5fa18', 'transparent']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFillObject}
      />
      <LinearGradient colors={['rgba(255,255,255,0.14)','rgba(255,255,255,0.03)']} start={{x:0,y:0}} end={{x:0,y:1}} style={StyleSheet.absoluteFillObject} />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.38)' }} />
      <GlassPulseOverlay />
      {/* Starfield accents */}
      <View style={[CPL.star, { top: 6,  right: 52,  width: 1.5, height: 1.5, opacity: 0.45 }]} />
      <View style={[CPL.star, { top: 14, right: 88,  width: 1,   height: 1,   opacity: 0.28 }]} />
      <View style={[CPL.star, { top: 8,  right: 122, width: 2,   height: 2,   opacity: 0.18 }]} />

      {/* Phase-accurate moon icon */}
      <MoonSVG tithiNum={moon.tithiNum} size={28} />

      {/* Labels */}
      <View style={{ flex: 1 }}>
        <Text style={[CPL.title, { color: vaar.color }]}>✦  Cosmic Date</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 5, alignItems: 'flex-start' }}>
          <View style={{ alignItems: 'flex-start', minWidth: 50 }}>
            <Text style={{ fontSize: 6, color: '#FFFFFF35', fontWeight: '800', letterSpacing: 0.8 }}>TITHI</Text>
            <Text style={{ fontSize: 9, color: '#60a5faCC', fontWeight: '800', lineHeight: 13 }}>{p.tithiName}</Text>
            <Text style={{ fontSize: 7, color: '#FFFFFF35', lineHeight: 10 }}>Day {p.tithiInPaksha}</Text>
          </View>
          <View style={{ width: 1, height: 26, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 4 }} />
          <View style={{ alignItems: 'flex-start', minWidth: 52 }}>
            <Text style={{ fontSize: 6, color: '#FFFFFF35', fontWeight: '800', letterSpacing: 0.8 }}>VAAR</Text>
            <Text style={{ fontSize: 9, color: vaar.color + 'CC', fontWeight: '800', lineHeight: 13 }}>{vaar.vedicName}</Text>
            <Text style={{ fontSize: 7, color: '#FFFFFF35', lineHeight: 10 }}>{vaar.planet} Day</Text>
          </View>
          <View style={{ width: 1, height: 26, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 4 }} />
          <View style={{ alignItems: 'flex-start', minWidth: 46 }}>
            <Text style={{ fontSize: 6, color: '#FFFFFF35', fontWeight: '800', letterSpacing: 0.8 }}>PAKSHA</Text>
            <Text style={{ fontSize: 9, color: '#60a5faCC', fontWeight: '800', lineHeight: 13 }}>{p.paksha}</Text>
            <Text style={{ fontSize: 7, color: '#FFFFFF35', lineHeight: 10 }}>{p.paksha === 'Shukla' ? 'Waxing' : 'Waning'}</Text>
          </View>
          <View style={{ width: 1, height: 26, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 4 }} />
          <View style={{ alignItems: 'flex-start', minWidth: 48 }}>
            <Text style={{ fontSize: 6, color: '#FFFFFF35', fontWeight: '800', letterSpacing: 0.8 }}>MAAS</Text>
            <Text style={{ fontSize: 9, color: '#fbbf24CC', fontWeight: '800', lineHeight: 13 }}>{vMonth.name}</Text>
            <Text style={{ fontSize: 7, color: '#FFFFFF35', lineHeight: 10 }}>{vMonth.en}</Text>
          </View>
        </View>
        <Text style={[CPL.cta, { marginTop: 5 }]}>See today's cosmic energy  ›</Text>
      </View>

      {/* Chevron badge */}
      <View style={[CPL.badge, { backgroundColor: vaar.color + '18', borderColor: vaar.color + '40' }]}>
        <Text style={[CPL.badgeTxt, { color: vaar.color }]}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Period Carousel (swipe Current ↔ Next) ────────────────────────────────
function PeriodCarousel({
  currentPeriod, nextPeriod, liveClock, brahmaInfo,
}: {
  currentPeriod: DoshaPeriod | null;
  nextPeriod: DoshaPeriod | null;
  liveClock: Date;
  brahmaInfo: BrahmaMuhurtaInfo | null;
}) {
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const cards: React.ReactNode[] = [];

  if (currentPeriod) {
    cards.push(
      <View key="current" style={{ width: SCREEN_W }}>
        <View style={{ paddingHorizontal: 16 }}>
          <View style={[D.sectionRow, { marginHorizontal: 0 }]}>
            <Text style={D.sectionTitle}>NOW  ·  ENERGY PERIOD</Text>
            <Text style={[D.sectionSub, { color: currentPeriod.color + 'BB' }]}>{currentPeriod.label}  ·  Solar time</Text>
          </View>
          <CurrentPeriodCard period={currentPeriod} liveClock={liveClock} />
          {brahmaInfo?.status === 'active' && (
            <BrahmaMuhurtaExtrasCard info={brahmaInfo} />
          )}
        </View>
      </View>
    );
  }

  if (nextPeriod) {
    cards.push(
      <View key="next" style={{ width: SCREEN_W }}>
        <View style={{ paddingHorizontal: 16 }}>
          <View style={[D.sectionRow, { marginHorizontal: 0 }]}>
            <Text style={D.sectionTitle}>NEXT SOLAR WINDOW</Text>
            <Text style={[D.sectionSub, { color: nextPeriod.color + 'BB' }]}>{nextPeriod.englishLabel}</Text>
          </View>
          <NextPeriodCard period={nextPeriod} />
          {brahmaInfo?.status === 'active' && (
            <BrahmaMuhurtaExtrasCard info={brahmaInfo} />
          )}
        </View>
      </View>
    );
  }

  if (cards.length === 0) return null;

  const totalPages = cards.length;

  return (
    <View>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={SCREEN_W}
        snapToAlignment="start"
        onMomentumScrollEnd={e => {
          const p = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
          setPage(p);
        }}>
        {cards}
      </ScrollView>
      {/* Page dots */}
      {totalPages > 1 && (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10, marginBottom: 2 }}>
          {cards.map((_, i) => (
            <TouchableOpacity key={i} onPress={() => { scrollRef.current?.scrollTo({ x: i * SCREEN_W, animated: true }); setPage(i); }}>
              <View style={{
                width: i === page ? 18 : 6, height: 6, borderRadius: 3,
                backgroundColor: i === page
                  ? (i === 0 ? (currentPeriod?.color ?? ACCENT) : (nextPeriod?.color ?? ACCENT))
                  : '#FFFFFF20',
              }} />
            </TouchableOpacity>
          ))}
        </View>
      )}
      {/* Swipe hint — only when multiple cards */}
      {totalPages > 1 && (
        <Text style={{ textAlign: 'center', fontSize: 8, color: '#FFFFFF20', letterSpacing: 1, marginTop: 2, marginBottom: 4 }}>
          {page === 0 ? 'SWIPE ← FOR NEXT WINDOW' : 'SWIPE → FOR CURRENT'}
        </Text>
      )}
    </View>
  );
}

// ── Inline Weather Action Card (compact, right below hourly strip) ─────────
function InlineWeatherAction({
  code, temp, humidity, isNight, emoji, maxTemp, minTemp, city,
}: {
  code: number; temp: number; humidity: number; isNight: boolean;
  emoji?: string; maxTemp?: number | null; minTemp?: number | null; city?: string;
}) {
  const adv = isNight ? getHourlyAdvice(code, temp) : getWeatherSuggestion(code, temp, humidity);
  return (
    <View style={[IW.card, { borderColor: adv.color + '45' }]}>
      <LinearGradient colors={['rgba(255,255,255,0.12)','rgba(255,255,255,0.03)','transparent']} start={{x:0,y:0}} end={{x:0,y:1}} style={StyleSheet.absoluteFillObject} />
      <LinearGradient colors={[adv.color+'14','transparent']} start={{x:0,y:0}} end={{x:1,y:0}} style={StyleSheet.absoluteFillObject} />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.28)' }} />
      <View style={[IW.leftBar, { backgroundColor: adv.color }]} />
      <View style={{ flex: 1, paddingLeft: 12 }}>

        {/* Header row: label + live metrics */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text style={IW.label}>RIGHT NOW  ·  WEATHER</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            {emoji ? <Text style={{ fontSize: 14 }}>{emoji}</Text> : null}
            <Text style={{ fontSize: 14, fontWeight: '900', color: '#FFFFFFCC' }}>{temp}°</Text>
            {maxTemp != null ? <Text style={{ fontSize: 10, fontWeight: '700', color: '#f8717188' }}>↑{maxTemp}°</Text> : null}
            {minTemp != null ? <Text style={{ fontSize: 10, fontWeight: '700', color: '#60a5fa88' }}>↓{minTemp}°</Text> : null}
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#7dd3fc88' }}>💧{humidity}%</Text>
            {city ? <Text style={{ fontSize: 9, color: '#FFFFFF30', fontWeight: '600' }}>· {city}</Text> : null}
          </View>
        </View>

        {/* Suggestion title */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Text style={{ fontSize: 18 }}>{adv.icon}</Text>
          <Text style={[IW.title, { color: adv.color }]}>{adv.title}</Text>
        </View>

        {/* Tips — horizontally scrollable chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          nestedScrollEnabled
          style={{ marginTop: 5 }}
          contentContainerStyle={{ gap: 7, paddingRight: 10 }}
        >
          {adv.tips.map((t, i) => (
            <View key={i} style={[IW.tipChip, { borderColor: adv.color + '40', backgroundColor: adv.color + '14' }]}>
              <Text style={{ fontSize: 11, color: '#FFFFFFCC', lineHeight: 17, fontWeight: '600' }}>{t}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

// ── Hourly Environment Suggestion helper ─────────────────────────────────
function getHourlyEnvSuggestion(
  period: DoshaPeriod,
  weather: WeatherData | null,
  hour: number,
): { emoji: string; title: string; desc: string } {
  const d = period.dosha;
  const wCode = weather?.weatherCode ?? 0;
  const temp  = weather?.temp ?? 25;
  const isRain = wCode >= 51;
  const isCold = temp < 18;
  const isHot  = temp > 32;

  if (hour >= 4 && hour < 6) {
    return { emoji: '🌑', title: 'Pre-Dawn Stillness', desc: 'Body temperature lowest · Minimal distraction · Ideal for pranayama & deep meditation' };
  }
  if (hour >= 6 && hour < 8) {
    if (isRain) return { emoji: '🌧️', title: 'Indoor Morning', desc: 'Rain outside · Gentle stretches indoors · Warm ginger water' };
    return { emoji: '🌅', title: 'Sunrise Window', desc: 'Step outside · Bare-feet on earth · 10 min sun exposure' };
  }
  if (hour >= 8 && hour < 10) {
    if (d === 'kapha') return { emoji: '🏃', title: 'Move Now', desc: 'Kapha peak — vigorous movement essential · Skip heavy breakfast' };
    return { emoji: '🍵', title: 'Fuel Up', desc: 'Light nourishing breakfast · Warm spiced tea · Set task priorities' };
  }
  if (hour >= 10 && hour < 12) {
    if (d === 'pitta') return { emoji: '🔥', title: 'Peak Focus', desc: 'Pitta sharpness is highest · Tackle your hardest cognitive work now' };
    return { emoji: '💡', title: 'Deep Work', desc: 'High-clarity window · Minimize distractions · Close notifications' };
  }
  if (hour >= 12 && hour < 14) {
    if (isHot) return { emoji: '🫁', title: 'Rest Indoors', desc: `${temp}° outside — avoid direct sun · Light lunch · 10 min eyes-closed rest` };
    return { emoji: '🥗', title: 'Mindful Lunch', desc: 'Eat your largest meal now · Walk 5 min post-lunch · Avoid screens while eating' };
  }
  if (hour >= 14 && hour < 16) {
    if (d === 'vata') return { emoji: '✍️', title: 'Creative Surge', desc: 'Vata afternoon peak · Ideal for writing, brainstorming & creative thinking' };
    return { emoji: '☕', title: 'Afternoon Reset', desc: 'Light snack if needed · Herbal tea over caffeine · Short outdoor walk' };
  }
  if (hour >= 16 && hour < 18) {
    if (isRain) return { emoji: '🎵', title: 'Indoor Wind-Down', desc: 'Rain hour — music, reading or light stretching · Avoid heavy meals' };
    return { emoji: '🚶', title: 'Evening Walk', desc: 'Best exercise window · 20 min brisk walk · Lung capacity is at peak' };
  }
  if (hour >= 18 && hour < 20) {
    return { emoji: '🌇', title: 'Transition Hour', desc: 'Light early dinner · Reduce screen brightness · Begin winding nervous system' };
  }
  if (hour >= 20 && hour < 22) {
    if (d === 'pitta') return { emoji: '❄️', title: 'Cool Down', desc: 'Evening Pitta — avoid heated discussions · Cool water · Dim lights' };
    return { emoji: '📖', title: 'Calm Input', desc: 'Light reading or journaling · No stimulating content · Chamomile tea' };
  }
  if (hour >= 22 || hour < 2) {
    return { emoji: '🌙', title: 'Sleep Onset', desc: 'Melatonin rising · Screen off · Cool dark room · Slow breathing' };
  }
  if (isCold) {
    return { emoji: '🧣', title: 'Stay Warm', desc: `${temp}° · Layer up · Warm sesame oil on feet · Sip hot broth` };
  }
  return { emoji: '⏳', title: 'Rest Window', desc: 'Deep night · Liver detox peak · Full rest · No eating after this point' };
}

// ── Weather action cards builder ──────────────────────────────────────────
type HESCard = { emoji: string; title: string; tips: string[]; color: string; label: string };

function getWeatherCards(weather: WeatherData | null): HESCard[] {
  if (!weather) return [];
  const wCode       = weather.weatherCode ?? 0;
  const temp        = weather.temp ?? 25;
  const isThunder   = wCode >= 95;
  const isHeavyRain = wCode >= 63 && wCode < 95;
  const isRain      = wCode >= 51 && wCode < 63;
  const isCloudy    = wCode >= 2  && wCode < 51;
  const isClear     = wCode < 2;
  const isHot       = temp > 34;
  const isCold      = temp < 14;
  const hour        = new Date().getHours();
  const cards: HESCard[] = [];

  if (isThunder) {
    cards.push({ emoji: '⛈️', title: 'Storm Alert', tips: ['Stay indoors · avoid open areas', 'Unplug electronics · ground yourself'], color: '#ef4444', label: 'WEATHER ALERT' });
  } else if (isHeavyRain) {
    cards.push({ emoji: '🌧️', title: 'Heavy Rain', tips: ['Carry umbrella before stepping out', 'Wet roads — slow down while driving'], color: '#38bdf8', label: 'RAIN ACTION' });
  } else if (isRain) {
    cards.push({ emoji: '🌦️', title: 'Rain This Hour', tips: ['Carry umbrella before stepping out', 'Wet roads — slow down while driving'], color: '#60a5fa', label: 'RAIN ACTION' });
  }

  if (isClear) {
    if (hour >= 6 && hour <= 10) {
      cards.push({ emoji: '☀️', title: 'Clear Sunrise Sky', tips: ['Bare feet on earth · 10 min sun', 'Best Vitamin D window of the day'], color: '#fbbf24', label: 'SKY CONDITION' });
    } else {
      cards.push({ emoji: '🌤️', title: 'Clear Sky', tips: ['Good visibility · ideal for outdoors', 'Natural light boosts serotonin'], color: '#fbbf24', label: 'SKY CONDITION' });
    }
  } else if (isCloudy && !isRain && !isHeavyRain && !isThunder) {
    cards.push({ emoji: '☁️', title: 'Overcast Sky', tips: ['Diffused light — gentle on eyes', 'Good window for focused indoor work'], color: '#94a3b8', label: 'SKY CONDITION' });
  }

  if (isHot) {
    cards.push({ emoji: '🌡️', title: `${Math.round(temp)}°  Heat`, tips: ['Stay hydrated · avoid noon sun', 'Light breathable clothing only'], color: '#f97316', label: 'TEMP SIGNAL' });
  } else if (isCold) {
    cards.push({ emoji: '❄️', title: `${Math.round(temp)}°  Cool`, tips: ['Warm up before stepping out', 'Sesame oil massage keeps body warm'], color: '#60a5fa', label: 'TEMP SIGNAL' });
  }

  return cards;
}

// ── HES Full-Screen Story Modal ───────────────────────────────────────────────
function HESStoryModal({ cards, initialIndex, onClose }: {
  cards: HESCard[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(initialIndex);
  const card  = cards[idx];
  const total = cards.length;

  const goNext = () => { if (idx < total - 1) setIdx(idx + 1); else onClose(); };
  const goPrev = () => { if (idx > 0) setIdx(idx - 1); };

  return (
    <Modal visible animationType="fade" transparent statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#05050E' }}>
        {/* Color glow background */}
        <LinearGradient
          colors={[card.color + '38', '#05050E', '#05050E']}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.52 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: card.color + '90' }} />

        {/* Segmented progress bar */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingTop: 56, gap: 3 }}>
          {cards.map((_, i) => (
            <View key={i} style={{
              flex: 1, height: 3, borderRadius: 2,
              backgroundColor: i < idx ? card.color + 'CC' : i === idx ? '#FFFFFFCC' : '#FFFFFF20',
            }} />
          ))}
        </View>

        {/* Header row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 }}>
          <Text style={{ flex: 1, fontSize: 9, fontWeight: '900', color: card.color + 'DD', letterSpacing: 1.8 }}>{card.label}</Text>
          <TouchableOpacity
            onPress={onClose}
            style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: '#FFFFFF25', backgroundColor: '#FFFFFF0A', alignItems: 'center', justifyContent: 'center' }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={{ color: '#FFFFFF80', fontSize: 13, fontWeight: '700' }}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Card content */}
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingBottom: 110 }}
          showsVerticalScrollIndicator={true}
          indicatorStyle="white">
          <Text style={{ fontSize: 72, marginBottom: 20, textAlign: 'center' }}>{card.emoji}</Text>
          <Text style={{ fontSize: 27, fontWeight: '900', color: '#FFFFFF', lineHeight: 35, marginBottom: 18, textAlign: 'center' }}>{card.title}</Text>
          <View style={{ height: 1.5, backgroundColor: card.color + '65', marginBottom: 22, marginHorizontal: 8 }} />
          {card.tips.map((tip, j) => (
            <View key={j} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16, paddingHorizontal: 4 }}>
              <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: card.color, marginTop: 7, flexShrink: 0 }} />
              <Text style={{ fontSize: 16, color: '#FFFFFFD8', lineHeight: 25, flex: 1, fontWeight: '500' }}>{tip}</Text>
            </View>
          ))}
          <Text style={{ fontSize: 11, color: '#FFFFFF30', marginTop: 20, textAlign: 'center', fontWeight: '600', letterSpacing: 0.5 }}>{idx + 1} of {total}</Text>
          <Text style={{ fontSize: 9, color: '#FFFFFF20', marginTop: 6, textAlign: 'center', fontWeight: '700', letterSpacing: 1.2 }}>↓  scroll for full content</Text>
        </ScrollView>

        {/* Invisible left/right tap zones */}
        <View pointerEvents="box-none" style={{ position: 'absolute', top: 100, bottom: 90, left: 0, right: 0, flexDirection: 'row' }}>
          <TouchableOpacity style={{ flex: 2 }} activeOpacity={0.01} onPress={goPrev} />
          <TouchableOpacity style={{ flex: 3 }} activeOpacity={0.01} onPress={goNext} />
        </View>

        {/* Bottom nav bar */}
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: 38, paddingHorizontal: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <TouchableOpacity
            onPress={goPrev}
            disabled={idx === 0}
            style={{ opacity: idx > 0 ? 1 : 0.22, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 14, borderWidth: 1, borderColor: '#FFFFFF18', backgroundColor: '#FFFFFF08' }}>
            <Text style={{ color: '#FFFFFF80', fontSize: 14, fontWeight: '700' }}>←</Text>
            <Text style={{ color: '#FFFFFF60', fontSize: 11, fontWeight: '700' }}>Prev</Text>
          </TouchableOpacity>
          {/* Dot indicators */}
          <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
            {cards.map((_, i) => (
              <View key={i} style={{ width: i === idx ? 18 : 5, height: 5, borderRadius: 3, backgroundColor: i === idx ? card.color : '#FFFFFF25' }} />
            ))}
          </View>
          <TouchableOpacity
            onPress={goNext}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 14, borderWidth: 1, borderColor: card.color + '50', backgroundColor: card.color + '1C' }}>
            <Text style={{ color: card.color, fontSize: 11, fontWeight: '800' }}>{idx < total - 1 ? 'Next' : 'Done'}</Text>
            <Text style={{ color: card.color, fontSize: 14, fontWeight: '700' }}>{idx < total - 1 ? '→' : '✓'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const HES_SCROLL_SPEED = 0.18; // px per animation frame — slow, calm, premium glide

// ── Hourly Environment Suggestion Strip (horizontal swipe + continuous auto-scroll) ─────
function HourlyEnvSuggestion({ period, weather }: { period: DoshaPeriod; weather: WeatherData | null }) {
  const scrollRef      = useRef<ScrollView>(null);
  const pausedRef      = useRef(false);
  const posRef         = useRef(0);
  const dirRef         = useRef(1);
  const maxPosRef      = useRef(0);
  const rafRef         = useRef<number>(0);
  const resumeTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [storyIdx, setStoryIdx] = useState<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    const tick = () => {
      if (!pausedRef.current && maxPosRef.current > 0) {
        posRef.current += HES_SCROLL_SPEED * dirRef.current;
        if (posRef.current >= maxPosRef.current) {
          posRef.current = maxPosRef.current;
          dirRef.current = -1;
        } else if (posRef.current <= 0) {
          posRef.current = 0;
          dirRef.current = 1;
        }
        scrollRef.current?.scrollTo({ x: posRef.current, animated: false });
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const pauseScroll = () => {
    pausedRef.current = true;
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
  };
  const scheduleResume = () => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => { pausedRef.current = false; }, 2500);
  };

  const hour = new Date().getHours();
  const s    = getHourlyEnvSuggestion(period, weather, hour);
  const rem  = period.minutesRemaining;
  const remStr = rem >= 60 ? `${Math.floor(rem / 60)}h ${rem % 60}m` : `${rem}m`;

  const sciCard: HESCard = {
    emoji: period.emoji,
    title: period.englishLabel,
    tips: [
      period.sciEmoji + '  ' + period.sciTitle,
      period.sciDesc.length > 115 ? period.sciDesc.slice(0, 115) + '…' : period.sciDesc,
    ],
    color: period.color,
    label: '◉  ACTIVE PHASE',
  };

  const envCard: HESCard = {
    emoji: s.emoji,
    title: s.title,
    tips:  s.desc.split(' · '),
    color: period.color,
    label: '↟  ENV SIGNAL',
  };

  const doCards: HESCard[] = period.activities.map(a => ({
    emoji: getActivityEmoji(a),
    title: a,
    tips: [period.sciTitle + '  ·  ' + period.label],
    color: period.color,
    label: '✓  DO THIS HOUR',
  }));

  const dontCards: HESCard[] = period.avoidances.map(a => ({
    emoji: getAvoidanceEmoji(a),
    title: a,
    tips: ['Avoid during ' + period.label],
    color: '#f43f5e',
    label: '⚠️  AVOID THIS HOUR',
  }));

  const allCards: HESCard[] = [sciCard, envCard, ...getWeatherCards(weather), ...doCards, ...dontCards];

  return (
    <>
    <View style={{ marginBottom: 10 }}>
      {/* Header — tappable → opens Ayurvedic Science explore */}
      <TouchableOpacity
        onPress={() => { const durM = Math.max(1, Math.round(((period.endH - period.startH + 24) % 24) * 60)); router.push({ pathname: '/period-detail' as never, params: { periodId: period.id, periodStart: period.startLabel, periodEnd: period.endLabel, minutesRemaining: String(period.minutesRemaining), minutesTotal: String(durM) } } as never); }}
        activeOpacity={0.75}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
          <View>
            <Text style={{ fontSize: 8, fontWeight: '700', color: '#FFFFFF45', letterSpacing: 1.4, marginBottom: 3 }}>CURRENT BODY RHYTHM PERIOD</Text>
            <Text style={{ fontSize: 17, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.2, lineHeight: 22, fontFamily: 'Nunito_900Black', textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 }}>{period.englishLabel}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5, alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: '#D4A84B60', backgroundColor: '#D4A84B1A' }}>
              <Text style={{ fontSize: 9, color: '#D4A84B', fontWeight: '900', letterSpacing: 0.8 }}>EXPLORE AYURVEDIC SCIENCE</Text>
              <View style={{ width: 15, height: 15, borderRadius: 8, backgroundColor: '#D4A84B35', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 9, color: '#D4A84B', fontWeight: '900', lineHeight: 11 }}>↗</Text>
              </View>
            </View>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          <Text style={{ fontSize: 14, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.3, lineHeight: 18, fontFamily: 'Nunito_900Black' }}>{remStr}</Text>
          <Text style={{ fontSize: 9, fontWeight: '700', color: period.color, letterSpacing: 0.4 }}>remaining</Text>
          <Text style={{ fontSize: 9, fontWeight: '500', color: '#FFFFFF45', letterSpacing: 0.3, marginTop: 1 }}>{period.startLabel} – {period.endLabel}</Text>
        </View>
      </TouchableOpacity>

      <View>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingRight: 24 }}
        decelerationRate="fast"
        snapToInterval={136}
        snapToAlignment="start"
        scrollEventThrottle={16}
        onContentSizeChange={(w) => { maxPosRef.current = Math.max(0, w - SCREEN_W); }}
        onScrollBeginDrag={() => {
          pausedRef.current = true;
          if (resumeTimer.current) clearTimeout(resumeTimer.current);
        }}
        onScrollEndDrag={(e) => {
          posRef.current = e.nativeEvent.contentOffset.x;
          scheduleResume();
        }}
        onMomentumScrollEnd={(e) => {
          posRef.current = e.nativeEvent.contentOffset.x;
          scheduleResume();
        }}
      >
        {allCards.map((card, i) => (
          <TouchableOpacity
            key={i}
            activeOpacity={0.85}
            onPress={() => { pauseScroll(); setStoryIdx(i); }}
            style={[HES.card, { borderColor: card.color + '55' }]}>
            <LinearGradient
              colors={[card.color + '28', 'rgba(4,4,18,0.48)', 'rgba(2,2,14,0.70)']}
              start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.72)' }} />
            <GlassPulseOverlay />
            {/* Label pill badge */}
            <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: card.color + '55', backgroundColor: card.color + '20', marginBottom: 7 }}>
              <Text style={{ fontSize: 7, fontWeight: '900', color: card.color, letterSpacing: 1.0 }}>{card.label}</Text>
            </View>
            {/* Emoji icon */}
            <Text style={{ fontSize: 20, marginBottom: 5 }}>{card.emoji}</Text>
            <Text style={{ fontSize: 10, fontWeight: '800', color: '#FFFFFF', lineHeight: 14, marginBottom: 5 }}>{card.title}</Text>
            <View style={{ height: 1, backgroundColor: card.color + '50', marginBottom: 5 }} />
            {card.tips.map((tip, j) => (
              <View key={j} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginBottom: 3 }}>
                <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: card.color + 'DD', marginTop: 4, flexShrink: 0 }} />
                <Text style={{ fontSize: 8, color: '#FFFFFFDC', lineHeight: 12, flex: 1 }}>{tip}</Text>
              </View>
            ))}
            <View style={{ position: 'absolute', bottom: 7, right: 8 }}>
              <Text style={{ fontSize: 7, color: card.color + '80', fontWeight: '800', letterSpacing: 0.5 }}>expand ↗</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 9, paddingBottom: 2, gap: 8 }}>
        <View style={{ height: 1, flex: 1, backgroundColor: '#FFFFFF0A', marginLeft: 16 }} />
        <Text style={{ fontSize: 8, color: '#FFFFFF28', fontWeight: '700', letterSpacing: 1.4 }}>←  SWIPE TO EXPLORE  →</Text>
        <View style={{ height: 1, flex: 1, backgroundColor: '#FFFFFF0A', marginRight: 16 }} />
      </View>
      </View>
    </View>

    {storyIdx !== null && (
      <HESStoryModal
        cards={allCards}
        initialIndex={storyIdx}
        onClose={() => { setStoryIdx(null); scheduleResume(); }}
      />
    )}
    </>
  );
}

const HES = StyleSheet.create({
  card: {
    width: 126,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.62)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    padding: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.38,
    shadowRadius: 20,
    elevation: 10,
  },
});

// ── Period Expanded Preview Card (replaces CurrentPeriodCard below the strip) ─────────────
function PeriodExpandedCard({ period, weather }: { period: DoshaPeriod; weather: WeatherData | null }) {
  const [storyIdx, setStoryIdx] = useState<number | null>(null);

  const hour = new Date().getHours();
  const s    = getHourlyEnvSuggestion(period, weather, hour);

  const sciCard: HESCard = {
    emoji: period.emoji,
    title: period.englishLabel,
    tips: [period.sciEmoji + '  ' + period.sciTitle, period.sciDesc],
    color: period.color,
    label: '◎  ACTIVE PHASE',
  };
  const envCard: HESCard   = { emoji: s.emoji, title: s.title, tips: s.desc.split(' · '), color: period.color, label: '⇟  ENV SIGNAL' };
  const doCards: HESCard[] = period.activities.map(a => ({ emoji: getActivityEmoji(a), title: a, tips: [period.sciTitle + '  ·  ' + period.label], color: period.color, label: '✓  DO THIS HOUR' }));
  const dontCards: HESCard[] = period.avoidances.map(a => ({ emoji: getAvoidanceEmoji(a), title: a, tips: ['Avoid during ' + period.label], color: '#f43f5e', label: '⚠️  AVOID THIS HOUR' }));
  const allCards: HESCard[] = [sciCard, envCard, ...getWeatherCards(weather), ...doCards, ...dontCards];
  const card = allCards[0];

  return (
    <>
      <TouchableOpacity
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setStoryIdx(0); }}
        activeOpacity={0.88}
        style={{ marginHorizontal: 16, marginTop: 10, borderRadius: 22, borderWidth: 1, borderColor: card.color + '70', backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
        <LinearGradient
          colors={[card.color + '2E', 'rgba(4,4,18,0.55)', 'rgba(2,2,14,0.82)']}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.72)' }} />
        <GlassPulseOverlay />

        <View style={{ padding: 18 }}>
          {/* Header row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7, borderWidth: 1, borderColor: card.color + '55', backgroundColor: card.color + '20' }}>
              <Text style={{ fontSize: 8, fontWeight: '900', color: card.color, letterSpacing: 1.4 }}>{card.label}</Text>
            </View>
            <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: card.color + '45', backgroundColor: card.color + '14', flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={{ fontSize: 9, fontWeight: '900', color: card.color, letterSpacing: 0.5 }}>TAP TO EXPLORE ALL</Text>
              <Text style={{ fontSize: 11, color: card.color, fontWeight: '700' }}>↗</Text>
            </View>
          </View>

          {/* Emoji + title */}
          <Text style={{ fontSize: 38, marginBottom: 10 }}>{card.emoji}</Text>
          <Text style={{ fontSize: 20, fontWeight: '900', color: '#FFFFFF', lineHeight: 27, marginBottom: 12 }}>{card.title}</Text>

          {/* Divider */}
          <View style={{ height: 1.5, backgroundColor: card.color + '60', marginBottom: 14 }} />

          {/* Full tips */}
          {card.tips.map((tip, j) => (
            <View key={j} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: card.color, marginTop: 6, flexShrink: 0 }} />
              <Text style={{ fontSize: 13, color: '#FFFFFFD0', lineHeight: 20, flex: 1, fontWeight: '500' }}>{tip}</Text>
            </View>
          ))}

          {/* Footer: dot indicators + count + scroll cue */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: card.color + '20' }}>
            <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center', flex: 1 }}>
              {allCards.slice(0, Math.min(allCards.length, 9)).map((_, i) => (
                <View key={i} style={{ width: i === 0 ? 18 : 5, height: 5, borderRadius: 3, backgroundColor: i === 0 ? card.color : '#FFFFFF22' }} />
              ))}
              {allCards.length > 9 && <Text style={{ fontSize: 8, color: '#FFFFFF35', fontWeight: '800', marginLeft: 2 }}>+{allCards.length - 9}</Text>}
            </View>
            <Text style={{ fontSize: 9, color: '#FFFFFF45', fontWeight: '700' }}>{allCards.length} insights inside</Text>
          </View>
        </View>
      </TouchableOpacity>

      {storyIdx !== null && (
        <HESStoryModal
          cards={allCards}
          initialIndex={storyIdx}
          onClose={() => setStoryIdx(null)}
        />
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Weather Summary Bar — compact inline row below solar bar
// ══════════════════════════════════════════════════════════════════════════════
function WeatherSummaryBar({ weather }: { weather: WeatherData }) {
  const maxT = weather.daily?.[0]?.maxTemp ?? null;
  const minT = weather.daily?.[0]?.minTemp ?? null;
  return (
    <View style={WSB.row}>
      <Text style={WSB.emoji}>{weather.emoji}</Text>
      <Text style={WSB.temp}>{weather.temp}°</Text>
      <Text style={WSB.cond}>{weather.condition}</Text>
      {weather.city ? <Text style={WSB.sep}>·</Text> : null}
      {weather.city ? <Text style={WSB.city}>{weather.city}</Text> : null}
      <View style={WSB.spacer} />
      <Text style={WSB.hum}>💧 {weather.humidity}%</Text>
      {maxT !== null && <Text style={WSB.hi}>↑{maxT}°</Text>}
      {minT !== null && <Text style={WSB.lo}>↓{minT}°</Text>}
    </View>
  );
}

const WSB = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 7, gap: 5 },
  emoji: { fontSize: 18 },
  temp:  { fontSize: 16, fontWeight: '900', color: '#FFFFFFEE', textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  cond:  { fontSize: 12, color: '#FFFFFFCC', fontWeight: '600', flexShrink: 1, textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  sep:   { fontSize: 12, color: '#FFFFFF50' },
  city:  { fontSize: 12, color: '#FFFFFFAA', fontWeight: '600', flexShrink: 1, textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  spacer:{ flex: 1 },
  hum:   { fontSize: 11, color: '#7dd3fcCC', fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.85)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  hi:    { fontSize: 11, color: '#f87171DD', fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.85)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  lo:    { fontSize: 11, color: '#60a5faDD', fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.85)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
});

// ══════════════════════════════════════════════════════════════════════════════
// Weather Section — collapsible summary card with hourly forecast strip
// ══════════════════════════════════════════════════════════════════════════════
function WeatherSection({
  weather,
  solarTimes,
  onMore,
}: {
  weather: WeatherData;
  solarTimes: SolarTimes | null;
  onMore: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const animVal    = useRef(new Animated.Value(0)).current;
  const chevronAnim = useRef(new Animated.Value(0)).current;

  const toggle = () => {
    const toValue = expanded ? 0 : 1;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.parallel([
      Animated.spring(animVal,    { toValue, useNativeDriver: false, friction: 9, tension: 52 }),
      Animated.timing(chevronAnim, { toValue, duration: 280, useNativeDriver: true }),
    ]).start();
    setExpanded(!expanded);
  };

  const stripMaxH    = animVal.interpolate({ inputRange: [0, 1], outputRange: [0, 148] });
  const stripOpacity = animVal.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0, 0, 1] });
  const chevronRot   = chevronAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

  const maxT = weather.daily?.[0]?.maxTemp ?? null;
  const minT = weather.daily?.[0]?.minTemp ?? null;

  return (
    <View style={WSEC.container}>
      <LinearGradient
        colors={['rgba(255,255,255,0.20)', 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.03)']}
        start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.38)' }} />

      {/* ── Summary row (always visible) — tap to expand ── */}
      <TouchableOpacity onPress={toggle} activeOpacity={0.78} style={WSEC.summaryRow}>
        <View style={WSEC.leftGroup}>
          <Text style={WSEC.emoji}>{weather.emoji}</Text>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={WSEC.temp}>{weather.temp}°</Text>
              <Text style={WSEC.cond}>{weather.condition}</Text>
            </View>
            {weather.city ? <Text style={WSEC.city}>{weather.city}</Text> : null}
          </View>
        </View>

        <View style={WSEC.rightGroup}>
          {/* Row 1: live data metrics */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Text style={WSEC.hum}>💧 {weather.humidity}%</Text>
            {maxT !== null && <Text style={WSEC.hi}>↑{maxT}°</Text>}
            {minT !== null && <Text style={WSEC.lo}>↓{minT}°</Text>}
          </View>
          {/* Row 2: action pill + chevron */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
            {!expanded && (
              <View style={WSEC.forecastPill}>
                <Text style={WSEC.forecastPillTxt}>FORECAST</Text>
              </View>
            )}
            <Animated.View style={[WSEC.chevronWrap, { transform: [{ rotate: chevronRot }] }]}>
              <Text style={WSEC.chevron}>⌄</Text>
            </Animated.View>
          </View>
        </View>
      </TouchableOpacity>

      {/* ── Expandable hourly forecast ── */}
      <Animated.View style={{ maxHeight: stripMaxH, opacity: stripOpacity, overflow: 'hidden' }}>
        <View style={WSEC.divider} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4 }}>
          <Text style={WSEC.forecastLabel}>HOURLY FORECAST</Text>
          <Text style={{ fontSize: 7, fontWeight: '700', color: '#FFFFFF28', letterSpacing: 1.2 }}>TAP CARD FOR 7 DAYS  →</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 14, paddingTop: 6, paddingBottom: 16 }}
        >
          {weather.hourly?.map((pt, i) => (
            <View key={i} style={[W.hourCell, i === 0 && W.hourCellNow]}>
              <Text style={[W.hourLabel, i === 0 && { color: ACCENT }]}>{i === 0 ? 'NOW' : hrLabel(pt.hour)}</Text>
              <Text style={W.hourEmoji}>{nightAwareEmoji(pt.emoji, pt.hour, solarTimes)}</Text>
              <Text style={W.hourTemp}>{pt.temp}°</Text>
            </View>
          ))}
          <TouchableOpacity onPress={onMore} style={W.moreBtn} activeOpacity={0.8}>
            <Text style={W.moreTxt}>7 Days</Text>
            <Text style={W.moreArrow}>→</Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const WSEC = StyleSheet.create({
  container: {
    marginHorizontal: 16, marginTop: 6, marginBottom: 10,
    borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.36)',
    backgroundColor: 'rgba(255,255,255,0.16)', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.20, shadowRadius: 14, elevation: 7,
  },
  summaryRow:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11 },
  leftGroup:   { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  rightGroup:  { flexDirection: 'column', alignItems: 'flex-end', gap: 4 },
  emoji:       { fontSize: 22 },
  temp:        { fontSize: 17, fontWeight: '900', color: '#FFFFFFEE', textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  cond:        { fontSize: 12, color: '#FFFFFFCC', fontWeight: '600', flexShrink: 1, textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  city:        { fontSize: 10, color: '#FFFFFF70', fontWeight: '600', marginTop: 2, textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  hum:         { fontSize: 11, color: '#7dd3fcCC', fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.85)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  hi:          { fontSize: 11, color: '#f87171DD', fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.85)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  lo:          { fontSize: 11, color: '#60a5faDD', fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.85)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  chevronWrap: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  chevron:     { fontSize: 15, color: '#FFFFFF55', fontWeight: '700', lineHeight: 18 },
  divider:     { height: 1, backgroundColor: 'rgba(255,255,255,0.09)', marginHorizontal: 12 },
  forecastLabel: { fontSize: 7, fontWeight: '900', color: '#FFFFFF45', letterSpacing: 1.6 },
  forecastPill:   { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.07)' },
  forecastPillTxt:{ fontSize: 7, fontWeight: '800', color: 'rgba(255,255,255,0.42)', letterSpacing: 1.3 },
});

// ══════════════════════════════════════════════════════════════════════════════
// Cosmic Detail Sheet  — full cosmic almanac, slides up on strip tap
// ══════════════════════════════════════════════════════════════════════════════
function CosmicDetailSheet({
  solarTimes, onCosmicPress, onClose,
}: {
  solarTimes: SolarTimes | null;
  onCosmicPress: () => void;
  onClose: () => void;
}) {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const moon  = React.useMemo(() => getMoonPhase(new Date()), []);
  const p     = React.useMemo(() => getPanchangData(), []);
  const lunar = React.useMemo(() => getNextLunarEvents(), []);
  const vaar  = VAARS[p.vaarIdx];
  const vm    = getVedicMonth();

  useEffect(() => {
    Animated.spring(slideAnim, { toValue: 1, useNativeDriver: true, friction: 10, tension: 68 }).start();
  }, []);

  const close = () => {
    Animated.timing(slideAnim, { toValue: 0, duration: 260, useNativeDriver: true }).start(() => onClose());
  };

  const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [600, 0] });

  const nakshatras = ['Ashwini','Bharani','Krittika','Rohini','Mrigashira','Ardra','Punarvasu','Pushya','Ashlesha','Magha','Purva Phalguni','Uttara Phalguni','Hasta','Chitra','Swati','Vishakha','Anuradha','Jyeshtha','Mula','Purva Ashadha','Uttara Ashadha','Shravana','Dhanishtha','Shatabhisha','Purva Bhadrapada','Uttara Bhadrapada','Revati'];
  const yogas      = ['Vishkambha','Priti','Ayushman','Saubhagya','Shobhana','Atiganda','Sukarman','Dhriti','Shula','Ganda','Vriddhi','Dhruva','Vyaghata','Harshana','Vajra','Siddhi','Vyatipata','Variyana','Parigha','Shiva','Siddha','Sadhya','Shubha','Shukla','Brahma','Indra','Vaidhriti'];
  const nakshatra  = nakshatras[p.nakshatraIdx] ?? '—';
  const yoga       = yogas[p.yogaIdx] ?? '—';
  const nextEvent  = lunar.daysToFull <= lunar.daysToNew
    ? { icon: '🌕', label: `Full Moon  ·  ${lunar.daysToFull === 0 ? 'Today' : `in ${lunar.daysToFull}d`}`, date: lunar.fullDateLong, color: '#fbbf24' }
    : { icon: '🌑', label: `New Moon  ·  ${lunar.daysToNew === 0 ? 'Today' : `in ${lunar.daysToNew}d`}`,   date: lunar.newDateLong,  color: '#60a5fa' };

  const now  = new Date();
  const curH = now.getHours() + now.getMinutes() / 60;
  let SunIcon: React.ComponentType<{ size?: number }> = NoonSunSVG;
  if (solarTimes) {
    if (curH <= solarTimes.sunrise + 0.75)     SunIcon = RisingSunSVG;
    else if (curH >= solarTimes.sunset - 0.75) SunIcon = SettingSunSVG;
  }

  const tithiEnergy = TITHI_ENERGY[p.tithiName] ?? 'Cosmic alignment in progress';

  return (
    <Modal visible animationType="none" transparent statusBarTranslucent onRequestClose={close}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,5,0.60)' }}>
        {/* Tap-outside to close */}
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={close} activeOpacity={1} />

        <Animated.View style={{ transform: [{ translateY }], backgroundColor: '#05050E', borderTopLeftRadius: 30, borderTopRightRadius: 30, maxHeight: '88%', overflow: 'hidden' }}>
          {/* Cosmic accent line */}
          <LinearGradient colors={[vaar.color + 'CC', '#60a5fa88', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 2 }} />
          {/* Handle */}
          <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 2 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#FFFFFF18' }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 48 }}>

            {/* ── Header ── */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#FFFFFF08', marginBottom: 18 }}>
              <View>
                <Text style={{ fontSize: 8, fontWeight: '900', color: '#60a5fa', letterSpacing: 2.2, marginBottom: 4 }}>TODAY'S COSMIC ALMANAC</Text>
                <Text style={{ fontSize: 18, fontWeight: '900', color: '#FFFFFF' }}>🌌  {ENGLISH_DAYS[p.vaarIdx]},  {now.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</Text>
                <Text style={{ fontSize: 10, color: vaar.color + 'CC', fontWeight: '700', marginTop: 3 }}>{vaar.vedicName}  ·  {vaar.planet} Day  ·  {vm?.name}</Text>
              </View>
              <TouchableOpacity onPress={close} style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: '#FFFFFF18', backgroundColor: '#FFFFFF08', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#FFFFFF55', fontSize: 14, fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* ── Solar Arc ── */}
            {solarTimes ? (
              <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,168,50,0.25)', padding: 14, marginBottom: 14 }}>
                <Text style={{ fontSize: 8, fontWeight: '900', color: '#fbbf24', letterSpacing: 2, marginBottom: 12 }}>☀️  SOLAR EPHEMERIS</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ alignItems: 'center', gap: 5 }}>
                    <RisingSunSVG size={30} />
                    <Text style={{ fontSize: 13, fontWeight: '900', color: '#FFFFFFEE' }}>{fmtSolar(solarTimes.sunrise)}</Text>
                    <Text style={{ fontSize: 7.5, fontWeight: '700', color: '#FFFFFF50', letterSpacing: 0.8, textTransform: 'uppercase' }}>Sunrise</Text>
                  </View>
                  <View style={{ flex: 1, height: 1, backgroundColor: '#fbbf2430', marginHorizontal: 10 }} />
                  <View style={{ alignItems: 'center', gap: 5 }}>
                    <NoonSunSVG size={30} />
                    <Text style={{ fontSize: 13, fontWeight: '900', color: '#fbbf24DD' }}>{fmtSolar(solarTimes.solarNoon)}</Text>
                    <Text style={{ fontSize: 7.5, fontWeight: '700', color: '#FFFFFF50', letterSpacing: 0.8, textTransform: 'uppercase' }}>Solar Zenith</Text>
                  </View>
                  <View style={{ flex: 1, height: 1, backgroundColor: '#fbbf2430', marginHorizontal: 10 }} />
                  <View style={{ alignItems: 'center', gap: 5 }}>
                    <SettingSunSVG size={30} />
                    <Text style={{ fontSize: 13, fontWeight: '900', color: '#FFFFFFEE' }}>{fmtSolar(solarTimes.sunset)}</Text>
                    <Text style={{ fontSize: 7.5, fontWeight: '700', color: '#FFFFFF50', letterSpacing: 0.8, textTransform: 'uppercase' }}>Sunset</Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, borderWidth: 1, borderColor: '#FFFFFF0C', padding: 14, marginBottom: 14, alignItems: 'center' }}>
                <Text style={{ fontSize: 11, color: '#FFFFFF30', fontWeight: '600' }}>🛰  Enable GPS for solar ephemeris</Text>
              </View>
            )}

            {/* ── Moon + Tithi ── */}
            <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(96,165,250,0.28)', padding: 14, marginBottom: 14 }}>
              <Text style={{ fontSize: 8, fontWeight: '900', color: '#60a5fa', letterSpacing: 2, marginBottom: 12 }}>🌙  LUNAR PHASE  ·  TITHI</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <MoonSVG tithiNum={moon.tithiNum} size={52} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '900', color: '#FFFFFF', marginBottom: 3 }}>{moon.name}  ·  {moon.illumination}% lit</Text>
                  <Text style={{ fontSize: 12, fontWeight: '900', color: '#60a5faDD', marginBottom: 4 }}>{p.tithiName}  ·  {p.paksha} Paksha</Text>
                  <Text style={{ fontSize: 10, color: '#FFFFFF55', lineHeight: 15, fontStyle: 'italic' }}>{tithiEnergy}</Text>
                </View>
              </View>
              {/* Next lunar event */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#FFFFFF08' }}>
                <Text style={{ fontSize: 20 }}>{nextEvent.icon}</Text>
                <View>
                  <Text style={{ fontSize: 11, fontWeight: '900', color: nextEvent.color }}>{nextEvent.label}</Text>
                  <Text style={{ fontSize: 9, color: '#FFFFFF35', marginTop: 2 }}>{nextEvent.date}</Text>
                </View>
              </View>
            </View>

            {/* ── Nakshatra + Yoga + Vaar ── */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
              <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(251,191,36,0.22)', padding: 12 }}>
                <Text style={{ fontSize: 7, fontWeight: '900', color: '#fbbf24', letterSpacing: 1.6, marginBottom: 8 }}>⭐  NAKSHATRA</Text>
                <Text style={{ fontSize: 13, fontWeight: '900', color: '#FFFFFF', marginBottom: 3 }}>{nakshatra}</Text>
                <Text style={{ fontSize: 9, color: '#FFFFFF45', fontWeight: '500' }}>Moon's mansion today</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(110,231,183,0.22)', padding: 12 }}>
                <Text style={{ fontSize: 7, fontWeight: '900', color: '#6ee7b7', letterSpacing: 1.6, marginBottom: 8 }}>✦  YOGA</Text>
                <Text style={{ fontSize: 13, fontWeight: '900', color: '#FFFFFF', marginBottom: 3 }}>{yoga}</Text>
                <Text style={{ fontSize: 9, color: '#FFFFFF45', fontWeight: '500' }}>Sun + Moon union</Text>
              </View>
            </View>

            {/* ── Vaar / Planet Day ── */}
            <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 18, borderWidth: 1, borderColor: vaar.color + '30', padding: 14, marginBottom: 18 }}>
              <Text style={{ fontSize: 8, fontWeight: '900', color: vaar.color, letterSpacing: 2, marginBottom: 10 }}>{vaar.emoji}  PLANETARY DAY  ·  VAAR</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text style={{ fontSize: 36 }}>{vaar.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '900', color: '#FFFFFF', marginBottom: 3 }}>{vaar.vedicName}</Text>
                  <Text style={{ fontSize: 11, color: vaar.color + 'CC', fontWeight: '700', marginBottom: 5 }}>{vaar.planet} Day  ·  {vm?.name ?? ''}</Text>
                  <Text style={{ fontSize: 11, color: '#FFFFFF65', lineHeight: 16, fontStyle: 'italic' }}>{vaar.energy}</Text>
                </View>
              </View>
            </View>

            {/* ── CTA ── */}
            <TouchableOpacity
              onPress={() => { close(); setTimeout(onCosmicPress, 300); }}
              activeOpacity={0.85}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1, borderRadius: 18, paddingVertical: 15, borderColor: '#60a5fa50', backgroundColor: '#60a5fa16' }}>
              <Text style={{ fontSize: 14, fontWeight: '900', color: '#60a5faDD' }}>🌌  Explore Full Cosmic Date</Text>
              <Text style={{ fontSize: 16, color: '#60a5faDD', fontWeight: '900' }}>→</Text>
            </TouchableOpacity>

          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Cosmic Orbit Strip — ultra-slim pill, tap to open CosmicDetailSheet
// ══════════════════════════════════════════════════════════════════════════════
function CosmicOrbitStrip({
  solarTimes,
  onCosmicPress,
}: {
  solarTimes: SolarTimes | null;
  onCosmicPress: () => void;
}) {
  const moon  = React.useMemo(() => getMoonPhase(new Date()), []);
  const p     = React.useMemo(() => getPanchangData(), []);
  const lunar = React.useMemo(() => getNextLunarEvents(), []);
  const vaar  = VAARS[p.vaarIdx];
  const [sheetOpen, setSheetOpen] = useState(false);

  const nextEvent = lunar.daysToFull <= lunar.daysToNew
    ? { icon: '🌕', label: `New Moon in ${lunar.daysToNew}d`, color: '#60a5fa' }
    : { icon: '🌑', label: `Full Moon in ${lunar.daysToFull}d`, color: '#fbbf24' };

  return (
    <>
      <TouchableOpacity
        style={COS.strip}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSheetOpen(true); }}
        activeOpacity={0.80}>
        <LinearGradient colors={['rgba(255,255,255,0.13)', 'rgba(255,255,255,0.04)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFillObject} />
        <LinearGradient colors={[vaar.color + '18', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFillObject} />
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.30)' }} />

        {/* Moon */}
        <MoonSVG tithiNum={moon.tithiNum} size={18} />

        {/* Tithi */}
        <Text style={COS.stripTithi} numberOfLines={1}>
          <Text style={{ color: '#60a5faEE', fontWeight: '900' }}>{p.tithiName}</Text>
          <Text style={{ color: '#FFFFFF40' }}>  ·  {p.paksha} Paksha</Text>
        </Text>

        {/* Separator */}
        <View style={COS.stripSep} />

        {/* Next event */}
        <Text style={{ fontSize: 10 }}>{nextEvent.icon}</Text>
        <Text style={[COS.stripEvent, { color: nextEvent.color }]}>{nextEvent.label}</Text>

        {/* Separator */}
        <View style={COS.stripSep} />

        {/* Vaar */}
        <Text style={{ fontSize: 12 }}>{vaar.emoji}</Text>
        <Text style={[COS.stripVaar, { color: vaar.color }]}>{ENGLISH_DAYS[p.vaarIdx]}</Text>

        {/* Expand chevron */}
        <Text style={COS.stripChevron}>⌄</Text>
      </TouchableOpacity>

      {sheetOpen && (
        <CosmicDetailSheet
          solarTimes={solarTimes}
          onCosmicPress={onCosmicPress}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </>
  );
}

const COS = StyleSheet.create({
  strip: {
    marginHorizontal: 16, marginTop: 6, marginBottom: 6,
    borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.32)',
    backgroundColor: 'rgba(255,255,255,0.13)',
    overflow: 'hidden',
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 9,
    gap: 7,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 10, elevation: 5,
  },
  stripTithi:   { fontSize: 10, fontWeight: '700', flex: 1, color: '#FFFFFF80' },
  stripSep:     { width: 1, height: 14, backgroundColor: 'rgba(255,255,255,0.14)' },
  stripEvent:   { fontSize: 10, fontWeight: '800', letterSpacing: 0.2 },
  stripVaar:    { fontSize: 10, fontWeight: '800', letterSpacing: 0.2 },
  stripChevron: { fontSize: 13, color: '#FFFFFF30', fontWeight: '700', marginLeft: 2 },
  // Legacy keys kept to avoid any residual reference errors
  card: { marginHorizontal: 16, marginTop: 6, marginBottom: 8, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)', backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  topLine:  { height: 1, backgroundColor: 'rgba(255,255,255,0.42)' },
  row1:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 9, paddingBottom: 8 },
  vSep:     { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.11)', marginHorizontal: 5 },
  sCell:    { flex: 1, alignItems: 'center' },
  sTime:    { fontSize: 11, fontWeight: '800', color: '#FFFFFFEE' },
  sLbl:     { fontSize: 7, fontWeight: '700', color: '#FFFFFFBB', letterSpacing: 0.7, marginTop: 2 },
  moonWrap: { flexDirection: 'row', alignItems: 'center', paddingLeft: 3 },
  ctaRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 9, paddingTop: 5 },
  ctaDayLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  ctaPill:     { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, gap: 2 },
  ctaPillTxt:  { fontSize: 9, fontWeight: '900', letterSpacing: 0.4 },
  ctaArrow:    { fontSize: 11, fontWeight: '900', marginLeft: 2 },
  infoRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 7 },
  infoLeft:  { flexDirection: 'row', alignItems: 'center', flex: 1 },
  infoRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  infoTithi: { fontSize: 10, fontWeight: '700', flexShrink: 1 },
  infoLunar: { fontSize: 10, fontWeight: '900', letterSpacing: 0.2 },
});

// ══════════════════════════════════════════════════════════════════════════════
// Phase Detail Bottom Sheet  — premium deep-dive on the active dosha period
// ══════════════════════════════════════════════════════════════════════════════
function PhaseDetailSheet({
  period, onClose,
}: {
  period: DoshaPeriod;
  onClose: () => void;
}) {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const router    = useRouter();

  useEffect(() => {
    Animated.spring(slideAnim, { toValue: 1, useNativeDriver: true, friction: 9, tension: 65 }).start();
  }, []);

  const close = () => {
    Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: true }).start(() => onClose());
  };

  const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [700, 0] });

  const rem    = period.minutesRemaining;
  const durM   = Math.max(1, Math.round(((period.endH - period.startH + 24) % 24) * 60));
  const prog   = Math.min(1, Math.max(0, (durM - rem) / durM));
  const remStr = rem >= 60 ? `${Math.floor(rem / 60)}h ${rem % 60}m` : `${rem}m`;
  const MINI_R = 22; const MINI_C = 2 * Math.PI * MINI_R;

  return (
    <Modal visible animationType="none" transparent statusBarTranslucent onRequestClose={close}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.68)' }}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={close} activeOpacity={1} />

        <Animated.View style={{ transform: [{ translateY }], backgroundColor: '#06060F', borderTopLeftRadius: 32, borderTopRightRadius: 32, maxHeight: '91%', overflow: 'hidden' }}>
          {/* Colored top accent line */}
          <View style={{ height: 2.5, backgroundColor: period.color + '90' }} />
          {/* Handle */}
          <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 2 }}>
            <View style={{ width: 44, height: 4, borderRadius: 2, backgroundColor: '#FFFFFF18' }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 52 }}>

            {/* ── Header row ── */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#FFFFFF0A', marginBottom: 20 }}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ fontSize: 8, fontWeight: '900', color: period.color, letterSpacing: 2.2 }}>CURRENT BODY RHYTHM PERIOD</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 4 }}>
                  <Text style={{ fontSize: 30 }}>{period.emoji}</Text>
                  <View>
                    <Text style={{ fontSize: 19, fontWeight: '900', color: '#FFFFFF', lineHeight: 25 }}>{period.englishLabel}</Text>
                    <Text style={{ fontSize: 10, color: period.color + 'CC', fontWeight: '700', marginTop: 2 }}>{remStr} remaining  ·  {period.startLabel} – {period.endLabel}</Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity onPress={close} style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: '#FFFFFF18', backgroundColor: '#FFFFFF08', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#FFFFFF60', fontSize: 14, fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* ── Mini ring + progress ── */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 18, borderWidth: 1, borderColor: period.color + '28', padding: 16, marginBottom: 22 }}>
              <Svg width={52} height={52} viewBox="0 0 52 52">
                <SvgCircle cx={26} cy={26} r={MINI_R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={5} />
                <SvgCircle cx={26} cy={26} r={MINI_R} fill="none" stroke={period.color} strokeWidth={5} strokeLinecap="round"
                  strokeDasharray={String(MINI_C)} strokeDashoffset={String(MINI_C * (1 - prog))}
                  transform="rotate(-90, 26, 26)" />
              </Svg>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '900', color: '#FFFFFFCC' }}>{Math.round(prog * 100)}% through this phase</Text>
                <View style={{ height: 5, backgroundColor: '#FFFFFF0C', borderRadius: 3, marginTop: 8, overflow: 'hidden' }}>
                  <View style={{ height: 5, width: `${Math.round(prog * 100)}%` as any, backgroundColor: period.color, borderRadius: 3 }} />
                </View>
                <Text style={{ fontSize: 9, color: '#FFFFFF35', marginTop: 5, fontWeight: '600' }}>{period.startLabel}  →  {period.endLabel}</Text>
              </View>
            </View>

            {/* ── What's happening — the deep science ── */}
            <Text style={{ fontSize: 8, fontWeight: '900', color: period.color, letterSpacing: 2.2, marginBottom: 12 }}>WHAT'S HAPPENING IN YOUR BODY</Text>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 22, borderWidth: 1, borderColor: period.color + '35', padding: 20, marginBottom: 22 }}>
              <Text style={{ fontSize: 26, marginBottom: 12 }}>{period.sciEmoji}</Text>
              <Text style={{ fontSize: 16, fontWeight: '900', color: period.color, lineHeight: 24, marginBottom: 12 }}>{period.sciTitle}</Text>
              <Text style={{ fontSize: 13.5, color: '#FFFFFFB8', lineHeight: 23, fontWeight: '400' }}>{period.sciDesc}</Text>
            </View>

            {/* ── Do Now ── */}
            <Text style={{ fontSize: 8, fontWeight: '900', color: period.color, letterSpacing: 2.2, marginBottom: 12 }}>✓  DO NOW</Text>
            <View style={{ gap: 8, marginBottom: 22 }}>
              {period.activities.map((act, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, borderColor: period.color + '35', backgroundColor: period.color + '0C' }}>
                  <Text style={{ fontSize: 20 }}>{getActivityEmoji(act)}</Text>
                  <Text style={{ fontSize: 13, color: '#FFFFFFCC', fontWeight: '600', flex: 1, lineHeight: 20 }}>{act}</Text>
                </View>
              ))}
            </View>

            {/* ── Avoid Now ── */}
            <Text style={{ fontSize: 8, fontWeight: '900', color: '#f43f5eCC', letterSpacing: 2.2, marginBottom: 12 }}>⚠️  AVOID NOW</Text>
            <View style={{ gap: 8, marginBottom: 28 }}>
              {period.avoidances.map((av, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, borderColor: '#f43f5e30', backgroundColor: '#f43f5e0A' }}>
                  <Text style={{ fontSize: 20 }}>{getAvoidanceEmoji(av)}</Text>
                  <Text style={{ fontSize: 13, color: '#FFFFFFCC', fontWeight: '600', flex: 1, lineHeight: 20 }}>{av}</Text>
                </View>
              ))}
            </View>

            {/* ── CTA ── */}
            <TouchableOpacity
              onPress={() => {
                close();
                const durM = Math.max(1, Math.round(((period.endH - period.startH + 24) % 24) * 60));
                setTimeout(() => router.push({ pathname: '/period-detail' as never, params: { periodId: period.id, periodStart: period.startLabel, periodEnd: period.endLabel, minutesRemaining: String(period.minutesRemaining), minutesTotal: String(durM) } } as never), 320);
              }}
              activeOpacity={0.85}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1, borderRadius: 18, paddingVertical: 16, borderColor: period.color + '50', backgroundColor: period.color + '16' }}>
              <Text style={{ fontSize: 14, fontWeight: '900', color: period.color }}>🔬  Explore Full Ayurvedic Science</Text>
              <Text style={{ fontSize: 16, color: period.color, fontWeight: '900' }}>→</Text>
            </TouchableOpacity>

          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ── Zen Mode sound library (ambient + mantras) ───────────────────────────────
const ZEN_SOUNDS: PlayableSoundMeta[] = [
  { id: 'light_rain',       label: 'Light Rain',      emoji: '🌦️', color: '#60a5fa', top: '#0D2440', bot: '#050F1E', cat: 'Nature',  desc: 'Soft rain on leaves',               src: require('../../assets/sounds/mixkit-light-rain-loop-2393.m4a') },
  { id: 'sea_waves',        label: 'Sea Waves',        emoji: '🌊', color: '#38bdf8', top: '#0A2030', bot: '#04101A', cat: 'Nature',  desc: 'Gentle coastal waves',              src: require('../../assets/sounds/mixkit-close-sea-waves-loop-1195.m4a') },
  { id: 'night_forest',     label: 'Night Forest',     emoji: '🦗', color: '#4ade80', top: '#0A1E0E', bot: '#050F07', cat: 'Nature',  desc: 'Crickets at midnight',              src: require('../../assets/sounds/mixkit-night-forest-with-insects-2414.m4a') },
  { id: 'forest_breeze',    label: 'Forest Breeze',    emoji: '🌳', color: '#86efac', top: '#0A1E10', bot: '#050F08', cat: 'Nature',  desc: 'Wind through the canopy',          src: require('../../assets/sounds/mixkit-breeze-through-the-trees-2427.m4a') },
  { id: 'flowing_water',    label: 'Flowing Water',    emoji: '💧', color: '#67e8f9', top: '#0A1E28', bot: '#050F14', cat: 'Nature',  desc: 'Stream over stones',                src: require('../../assets/sounds/mixkit-water-flowing-ambience-loop-3126.m4a') },
  { id: 'gentle_wind',      label: 'Gentle Wind',      emoji: '🌬️', color: '#a3e635', top: '#141808', bot: '#0A0F05', cat: 'Nature',  desc: 'Open meadow breeze',               src: require('../../assets/sounds/mixkit-wind-blowing-ambience-2658.m4a') },
  { id: 'jungle_rain',      label: 'Jungle Rain',      emoji: '🦜', color: '#34d399', top: '#0A2418', bot: '#05100A', cat: 'Nature',  desc: 'Rain with tropical birds',          src: require('../../assets/sounds/mixkit-jungle-rain-and-birds-2392.m4a') },
  { id: 'stotra_bhagya',    label: 'Bhagya Suktam',   emoji: '🌟', color: '#fde68a', top: '#1A1400', bot: '#0A0A00', cat: 'Stotra', desc: 'Vedic hymn for prosperity',         src: require('../../assets/sounds/bhagya-suktam.mp3') },
  { id: 'stotra_shiv',      label: 'Shiv Sankalpa',   emoji: '🕉️', color: '#93c5fd', top: '#140A1A', bot: '#0A050F', cat: 'Stotra', desc: 'Vedic prayer for pure mind',        src: require('../../assets/sounds/shiv-sankalpa-suktam.mp3') },
  { id: 'mantra_gayatri',   label: 'Gayatri Mantra',  emoji: '🌞', color: '#fbbf24', top: '#1A1000', bot: '#0A0800', cat: 'Mantra', desc: 'Universal prayer of light',         src: { uri: 'https://ik.imagekit.io/rcsesr4xf/gayatri-mantra-ghanpaath.mp3' } },
  { id: 'mantra_lalitha',   label: 'Lalitha Sahasra', emoji: '🌺', color: '#f472b6', top: '#1A0010', bot: '#0A0008', cat: 'Stotra', desc: 'Thousand names of the divine',      src: { uri: 'https://ik.imagekit.io/rcsesr4xf/Lalitha-Sahasranamam.mp3' } },
  { id: 'mantra_shivtandav',label: 'Shiv Tandav',     emoji: '🔱', color: '#60a5fa', top: '#100A1A', bot: '#08050A', cat: 'Mantra', desc: 'Cosmic dance of Shiva',             src: { uri: 'https://ik.imagekit.io/rcsesr4xf/Shiva-Tandav.mp3' } },
];

// ── Vedic Panchanga helpers ───────────────────────────────────────────────────
const VAAR_NAMES  = ['Ravivāra','Somavāra','Maṅgalavāra','Budhavāra','Guruvāra','Śukravāra','Śanivāra'];
const TITHI_NAMES_PANCHANGA = ['Pratipada','Dvitīyā','Tṛtīyā','Caturthī','Pañcamī','Ṣaṣṭhī','Saptamī','Aṣṭamī','Navamī','Daśamī','Ekādaśī','Dvādaśī','Trayodaśī','Caturdaśī','Pūrṇimā','Pratipada','Dvitīyā','Tṛtīyā','Caturthī','Pañcamī','Ṣaṣṭhī','Saptamī','Aṣṭamī','Navamī','Daśamī','Ekādaśī','Dvādaśī','Trayodaśī','Caturdaśī','Amāvasyā'];
const MAAS_NAMES  = ['Chaitra','Vaiśākha','Jyeṣṭha','Āṣāḍha','Śrāvaṇa','Bhādrapada','Āśvina','Kārtika','Mārgaśīrṣa','Pauṣa','Māgha','Phālguna'];

function getVedicDate(d: Date) {
  const vaar = VAAR_NAMES[d.getDay()];
  const REF_NM   = 946933200000;           // Jan 6 2000 UTC — approx new moon (Pausha Amavasya)
  const SYNODIC  = 29.53059 * 86400000;
  const elapsed  = d.getTime() - REF_NM;
  const frac     = ((elapsed % SYNODIC) + SYNODIC) % SYNODIC;
  const tithiIdx = Math.floor((frac / SYNODIC) * 30);
  const paksha   = tithiIdx < 15 ? 'Śukla' : 'Kṛṣṇa';
  const tithi    = TITHI_NAMES_PANCHANGA[tithiIdx] ?? 'Pratipada';
  const months   = Math.floor(elapsed / SYNODIC);
  const maas     = MAAS_NAMES[((months + 9) % 12 + 12) % 12];  // ref month = Pausha (idx 9)
  return { vaar, tithi, paksha, maas };
}

// ── Zen Mode constants ────────────────────────────────────────────────────────
const ZEN_CIRCLE_COLORS = ['#60a5fa','#60a5fa','#38bdf8','#34d399','#fbbf24','#f97316','#ec4899'];
const ZEN_BREATH = [
  { label: '✦  BREATHE IN', secs: 4, toScale: 1.28 },
  { label: '◈  HOLD',        secs: 7, toScale: 1.28 },
  { label: '◯  RELEASE',     secs: 8, toScale: 0.88 },
];

// ── Vedic sleep mantras ───────────────────────────────────────────────────────
const SLEEP_MANTRAS = [
  { skt: 'सोऽहम्',                    rom: "So'ham",              en: 'I am that — the breath of the universe is my own' },
  { skt: 'ॐ नमः शिवाय',              rom: 'Om Namah Shivaya',    en: 'I bow to the auspicious one who resides within all' },
  { skt: 'शान्तिः शान्तिः शान्तिः',  rom: 'Shanti Shanti Shanti',en: 'Peace in body · peace in mind · peace in spirit' },
  { skt: 'अहं ब्रह्मास्मि',          rom: 'Aham Brahmasmi',      en: 'I am Brahman — pure infinite consciousness' },
  { skt: 'तत् त्वम् असि',            rom: 'Tat Tvam Asi',        en: 'Thou art that — you are the entire cosmos' },
  { skt: 'ॐ तत् सत्',                rom: 'Om Tat Sat',          en: 'That is the absolute truth — pure existence' },
  { skt: 'प्रशान्तम्',               rom: 'Prashāntam',          en: 'Utterly calm — beyond thought, beyond time' },
  { skt: 'ॐ मणि पद्मे हूँ',          rom: 'Om Mani Padme Hum',   en: 'The jewel in the lotus — compassion and wisdom united' },
];

const NIGHT_SCIENCE: Record<string, string[]> = {
  evening_kapha: [
    'Melatonin synthesis begins as ambient light fades — sleep hormone rising',
    'Parasympathetic nervous system activates — rest-and-digest mode on',
    'Core body temperature drops 0.5°C/hr — the biological sleep signal',
  ],
  night_pitta: [
    'Growth Hormone peaks in slow-wave sleep — body rebuilds',
    'Liver Phase I & II detox enzymes are maximally active',
    'Autophagy fires — cellular debris cleared, DNA repaired',
  ],
  night_vata: [
    'Alpha-theta brainwaves dominate — subconscious veil is thinnest',
    'Cortisol Awakening Response begins its sacred surge',
    'Neuroplasticity at 24-hr zenith — Brahma Muhurta opens',
  ],
};

// ══════════════════════════════════════════════════════════════════════════════
// Zen Mode Overlay  — Endel/Calm-style: full nature bg, glowing orb, mantra
// ══════════════════════════════════════════════════════════════════════════════
function ZenModeOverlay({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const SW      = Dimensions.get('window').width;
  const CIRCLE_R = Math.min(SW * 0.64, 248);

  // Nature background image (time-matched)
  const [bgUri, setBgUri] = useState<string | null>(null);
  useEffect(() => {
    if (!visible) return;
    const h = new Date().getHours() + new Date().getMinutes() / 60;
    const key =
      h < 4.5 ? 'brahma'   : h < 6   ? 'predawn'  :
      h < 8   ? 'sunrise'  : h < 11  ? 'morning'  :
      h < 14  ? 'midday'   : h < 17  ? 'afternoon':
      h < 19  ? 'sandhya'  : h < 21  ? 'twilight' :
      h < 23  ? 'evening'  : 'night';
    getBgSource(key).then(uri => setBgUri(uri)).catch(() => {});
  }, [visible]);

  // Sound player
  const { playingId, isPaused, playSound, stopSound, togglePause } = useSoundPlayer();
  const [zenCat, setZenCat] = useState<'Nature' | 'Mantra' | 'Stotra'>('Nature');
  const zenFiltered = ZEN_SOUNDS.filter(s => s.cat === zenCat);
  const playingZen  = ZEN_SOUNDS.find(s => s.id === playingId);

  const handleSoundTap = (sound: PlayableSoundMeta) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (playingId === sound.id) togglePause();
    else playSound(sound, 3600);
  };

  // Live clock
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Slow color cycle (every 5 s)
  const [colorIdx, setColorIdx] = useState(0);
  useEffect(() => {
    if (!visible) return;
    const t = setInterval(() => setColorIdx(p => (p + 1) % ZEN_CIRCLE_COLORS.length), 5000);
    return () => clearInterval(t);
  }, [visible]);

  // 4-7-8 breathing
  const breathScale = useRef(new Animated.Value(1)).current;
  const [bpIdx,     setBpIdx]     = useState(0);
  const [countdown, setCountdown] = useState(4);
  const bpRun = useRef(true);
  useEffect(() => {
    if (!visible) return;
    bpRun.current = true;
    let cdTimer: ReturnType<typeof setInterval>;
    let phase = 0;
    const run = () => {
      if (!bpRun.current) return;
      const ph = ZEN_BREATH[phase];
      setBpIdx(phase);
      let cd = ph.secs; setCountdown(cd);
      cdTimer = setInterval(() => { cd--; if (cd >= 0) setCountdown(cd); else clearInterval(cdTimer); }, 1000);
      Animated.timing(breathScale, { toValue: ph.toScale, duration: ph.secs * 1000, useNativeDriver: true })
        .start(({ finished }) => {
          clearInterval(cdTimer);
          if (finished && bpRun.current) { phase = (phase + 1) % ZEN_BREATH.length; run(); }
        });
    };
    run();
    return () => { bpRun.current = false; clearInterval(cdTimer); breathScale.stopAnimation(); };
  }, [visible]);

  // Mantra fade-rotation
  const [mantraIdx, setMantraIdx] = useState(0);
  const mantraOp = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!visible) return;
    const t = setInterval(() => {
      Animated.timing(mantraOp, { toValue: 0, duration: 900, useNativeDriver: true })
        .start(() => {
          setMantraIdx(p => (p + 1) % SLEEP_MANTRAS.length);
          Animated.timing(mantraOp, { toValue: 1, duration: 900, useNativeDriver: true }).start();
        });
    }, 8000);
    return () => clearInterval(t);
  }, [visible]);

  const cc     = ZEN_CIRCLE_COLORS[colorIdx];
  const bp     = ZEN_BREATH[bpIdx];
  const mantra = SLEEP_MANTRAS[mantraIdx];

  const hh      = now.getHours().toString().padStart(2, '0');
  const mm      = now.getMinutes().toString().padStart(2, '0');
  const timeStr = `${hh}:${mm}`;
  const dateStr = now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <Modal visible={visible} transparent={false} animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <ImageBackground
        source={bgUri ? { uri: bgUri } : undefined}
        style={{ flex: 1, backgroundColor: '#04040E' }}
        imageStyle={{ opacity: 0.72 }}>

        {/* Subtle gradient veil — preserves nature image, hides no UI clutter */}
        <LinearGradient
          colors={['rgba(3,3,18,0.45)', 'rgba(3,3,18,0.08)', 'rgba(3,3,18,0.55)']}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        />

        {/* Exit — top-right ghost pill */}
        <TouchableOpacity
          onPress={onClose}
          style={{
            position: 'absolute', top: 52, right: 18, zIndex: 99,
            backgroundColor: 'rgba(255,255,255,0.10)',
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
            borderRadius: 22, paddingHorizontal: 14, paddingVertical: 8,
          }}>
          <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', fontWeight: '700', letterSpacing: 0.8 }}>
            Back to App
          </Text>
        </TouchableOpacity>

        {/* ── Center: glowing orb + breath label + mantra ── */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingTop: 36 }}>

          {/* Glowing breathing orb */}
          <View style={{ alignItems: 'center', justifyContent: 'center', marginBottom: 30 }}>
            {/* Outermost diffuse halo */}
            <Animated.View style={{
              position: 'absolute',
              width: CIRCLE_R * 1.62, height: CIRCLE_R * 1.62,
              borderRadius: CIRCLE_R * 0.81,
              backgroundColor: cc + '27',
              transform: [{ scale: breathScale }],
            }} />
            {/* Outer glow fill */}
            <Animated.View style={{
              position: 'absolute',
              width: CIRCLE_R * 1.32, height: CIRCLE_R * 1.32,
              borderRadius: CIRCLE_R * 0.66,
              backgroundColor: cc + '32',
              transform: [{ scale: breathScale }],
            }} />
            {/* Mid border ring */}
            <Animated.View style={{
              position: 'absolute',
              width: CIRCLE_R * 1.10, height: CIRCLE_R * 1.10,
              borderRadius: CIRCLE_R * 0.55,
              borderWidth: 1, borderColor: cc + '50',
              transform: [{ scale: breathScale }],
            }} />
            {/* Core glowing circle */}
            <Animated.View style={{
              width: CIRCLE_R, height: CIRCLE_R,
              borderRadius: CIRCLE_R / 2,
              backgroundColor: cc + '3A',
              borderWidth: 1.5, borderColor: cc + 'C0',
              alignItems: 'center', justifyContent: 'center',
              shadowColor: cc,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.92,
              shadowRadius: 42,
              elevation: 20,
              transform: [{ scale: breathScale }],
            }}>
              <Text style={{
                fontSize: Math.round(CIRCLE_R * 0.235),
                fontWeight: '100', color: '#FFFFFF', letterSpacing: -2,
              }}>
                {timeStr}
              </Text>
              <Text style={{
                fontSize: 11, color: 'rgba(255,255,255,0.58)',
                fontWeight: '500', marginTop: 4, letterSpacing: 0.4,
              }}>
                {dateStr}
              </Text>
            </Animated.View>
          </View>

          {/* Breath phase label */}
          <Text style={{ fontSize: 10, fontWeight: '700', color: cc + 'CC', letterSpacing: 2.5, marginBottom: 3 }}>
            {bp.label}
          </Text>
          <Text style={{ fontSize: 8, color: 'rgba(255,255,255,0.26)', fontWeight: '600', letterSpacing: 1, marginBottom: 36 }}>
            {countdown}s  ·  4 · 7 · 8  PRANAYAMA
          </Text>

          {/* Mantra — fades in/out, no overlapping labels */}
          <Animated.View style={{ opacity: mantraOp, alignItems: 'center', paddingHorizontal: 16 }}>
            <Text style={{
              fontSize: 22, color: cc, fontWeight: '800',
              textAlign: 'center', letterSpacing: 0.5, marginBottom: 8, lineHeight: 30,
            }}>
              {mantra.rom}
            </Text>
            <Text style={{
              fontSize: 26, color: 'rgba(255,255,255,0.72)',
              textAlign: 'center', lineHeight: 38, marginBottom: 6, letterSpacing: 0.3,
            }}>
              {mantra.skt}
            </Text>
            <Text style={{
              fontSize: 11, color: 'rgba(255,255,255,0.40)',
              textAlign: 'center', lineHeight: 17, fontStyle: 'italic',
            }}>
              {mantra.en}
            </Text>
          </Animated.View>
        </View>

        {/* ── Sound Picker — minimal horizontal pill strip ── */}
        <View style={{ paddingBottom: 48 }}>

          {/* Category tabs + now-playing indicator */}
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            justifyContent: 'center', gap: 8, marginBottom: 12, paddingHorizontal: 20,
          }}>
            {(['Nature', 'Mantra', 'Stotra'] as const).map(cat => {
              const catIcon = cat === 'Nature' ? '≈' : cat === 'Mantra' ? 'ॐ' : '✦';
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setZenCat(cat)}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 99,
                    borderWidth: 1,
                    borderColor: zenCat === cat ? cc + '70' : 'rgba(255,255,255,0.12)',
                    backgroundColor: zenCat === cat ? cc + '22' : 'rgba(255,255,255,0.05)',
                  }}>
                  <Text style={{
                    fontSize: 9, fontWeight: '800', letterSpacing: 0.8,
                    color: zenCat === cat ? cc : 'rgba(255,255,255,0.38)',
                  }}>
                    {catIcon}  {cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {playingZen && (
              <TouchableOpacity
                onPress={() => stopSound()}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 5,
                  paddingHorizontal: 11, paddingVertical: 6, borderRadius: 99,
                  backgroundColor: playingZen.color + '22',
                  borderWidth: 1, borderColor: playingZen.color + '50',
                }}>
                <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: isPaused ? 'rgba(255,255,255,0.35)' : playingZen.color }} />
                <Text style={{ fontSize: 8, color: playingZen.color, fontWeight: '800' }} numberOfLines={1}>
                  {isPaused ? 'Paused' : playingZen.label}
                </Text>
                <Text style={{ fontSize: 8, color: playingZen.color + '90', fontWeight: '900' }}>■</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Horizontal pill list — text-forward, no emoji grid */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
            {zenFiltered.map(sound => {
              const active = playingId === sound.id;
              return (
                <TouchableOpacity
                  key={sound.id}
                  onPress={() => handleSoundTap(sound)}
                  activeOpacity={0.75}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 7,
                    paddingHorizontal: 15, paddingVertical: 10, borderRadius: 24,
                    borderWidth: active ? 1.5 : 1,
                    borderColor: active ? sound.color + 'BB' : 'rgba(255,255,255,0.13)',
                    backgroundColor: active ? sound.color + '22' : 'rgba(255,255,255,0.06)',
                  }}>
                  <View style={{
                    width: 7, height: 7, borderRadius: 4,
                    backgroundColor: active ? sound.color : 'rgba(255,255,255,0.18)',
                  }} />
                  <Text style={{
                    fontSize: 11,
                    color: active ? sound.color : 'rgba(255,255,255,0.52)',
                    fontWeight: active ? '800' : '500',
                  }}>
                    {sound.label}
                  </Text>
                  {active && (
                    <View style={{
                      width: 4, height: 4, borderRadius: 2,
                      backgroundColor: sound.color, opacity: isPaused ? 0.3 : 0.9,
                    }} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </ImageBackground>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// NightSleepMode  — period header + single Open Calm Space / Night Sleep CTA
// ══════════════════════════════════════════════════════════════════════════════
function NightSleepMode({ period, autoZen = true, mode, onModeChange }: {
  period: DoshaPeriod;
  autoZen?: boolean;
  mode: 'normal' | 'relax';
  onModeChange: (m: 'normal' | 'relax') => void;
}) {
  const NC = period.id === 'night_vata'    ? '#60a5fa'
           : period.id === 'night_pitta'   ? '#fbbf24'
           : period.id === 'evening_kapha' ? '#34d399'
           : period.color;

  const isNight = ['evening_kapha', 'night_pitta', 'night_vata'].includes(period.id);

  const [zenActive, setZenActive] = useState(false);
  // Auto-zen disabled for now
  // useEffect(() => {
  //   if (!autoZen) return;
  //   const t = setTimeout(() => setZenActive(true), 600);
  //   return () => clearTimeout(t);
  // }, [autoZen]);

  const rem    = period.minutesRemaining;
  const remStr = rem >= 60 ? `${Math.floor(rem / 60)}h ${rem % 60}m` : `${rem}m`;

  const sectionLabel =
    period.id === 'night_vata'      ? 'BRAHMA MUHURTA  ·  PRE-DAWN'
    : period.id === 'night_pitta'   ? 'SLEEP  ·  DEEP REPAIR PHASE'
    : period.id === 'evening_kapha' ? 'EVENING  ·  PARASYMPATHETIC WIND-DOWN'
    : `RELAXATION  ·  ${period.label.toUpperCase()}`;

  const borderColor =
    period.id === 'night_vata'      ? 'rgba(129,140,248,0.35)'
    : period.id === 'night_pitta'   ? 'rgba(251,191,36,0.28)'
    : period.id === 'evening_kapha' ? 'rgba(52,211,153,0.32)'
    : NC + '55';

  const gradientColors: [string, string, string] =
    period.id === 'night_vata'
      ? ['rgba(30,20,70,0.84)',  'rgba(10,8,28,0.92)',  'rgba(49,46,129,0.72)']
      : period.id === 'night_pitta'
      ? ['rgba(45,25,10,0.84)',  'rgba(12,8,4,0.92)',   'rgba(120,53,15,0.50)']
      : period.id === 'evening_kapha'
      ? ['rgba(5,30,20,0.84)',   'rgba(4,16,12,0.92)',  'rgba(16,80,60,0.55)']
      : ['rgba(8,6,24,0.84)',    'rgba(5,4,16,0.92)',   'rgba(20,15,50,0.65)'];

  const tagline =
    period.id === 'night_vata'      ? 'Brahma Muhurta — the sacred pre-dawn window'
    : period.id === 'night_pitta'   ? 'Deep repair · Growth hormone · Autophagy'
    : period.id === 'evening_kapha' ? 'Parasympathetic wind-down · Melatonin rising'
    : 'Rest, breathe, and let the body restore';

  return (
    <>
    <View style={{ marginHorizontal: 16, marginTop: 18, marginBottom: 6 }}>

      {/* ── Mode Toggle — hidden for now, kept for future use ── */}
      {false && <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 16, padding: 4, marginBottom: 16 }}>
        {(['normal', 'relax'] as const).map(m => {
          const label = m === 'normal' ? 'Work Mode' : (isNight ? 'Night Sleep' : 'Calm Space');
          const icon  = m === 'normal' ? '⚡' : '◯';
          return (
            <TouchableOpacity
              key={m}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onModeChange(m); }}
              activeOpacity={0.8}
              style={{
                flex: 1, paddingVertical: 11, borderRadius: 13,
                alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 7,
                backgroundColor: mode === m ? (m === 'relax' ? 'rgba(96,165,250,0.25)' : 'rgba(255,255,255,0.15)') : 'transparent',
                borderWidth: mode === m ? 1 : 0,
                borderColor: mode === m ? (m === 'relax' ? '#60a5fa60' : 'rgba(255,255,255,0.25)') : 'transparent',
              }}>
              <Text style={{ fontSize: 15 }}>{icon}</Text>
              <Text style={{
                fontSize: 11, fontWeight: '900', letterSpacing: 0.3,
                color: mode === m ? (m === 'relax' ? '#93c5fd' : '#FFFFFF') : 'rgba(255,255,255,0.35)',
              }}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>}

      {/* Section label */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: NC }} />
          <Text style={{ fontSize: 9, fontWeight: '900', color: '#FFFFFFBB', letterSpacing: 1.8, textShadowColor: 'rgba(0,0,0,0.95)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 5 }}>
            {sectionLabel}
          </Text>
        </View>
        <Text style={{ fontSize: 9, fontWeight: '700', color: NC }}>{period.startLabel} – {period.endLabel}</Text>
      </View>

      {/* ── Calm Space card ── */}
      <View style={{ borderRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: borderColor }}>
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ padding: 22 }}>

          {/* Glass shimmer */}
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: NC + '55' }} />

          {/* Period identity row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ fontSize: 28, lineHeight: 34 }}>{period.emoji}</Text>
              <View>
                <Text style={{ fontSize: 13, fontWeight: '900', color: '#FFFFFFEE', lineHeight: 18 }}>{period.englishLabel}</Text>
                <Text style={{ fontSize: 7, color: NC + 'CC', fontWeight: '700', letterSpacing: 0.8, marginTop: 2 }}>{period.sciEmoji}  {period.sciTitle}</Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 22, fontWeight: '900', color: NC }}>{remStr}</Text>
              <Text style={{ fontSize: 6, color: 'rgba(255,255,255,0.35)', fontWeight: '700', letterSpacing: 0.6 }}>remaining</Text>
            </View>
          </View>

          {/* Tagline */}
          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.42)', textAlign: 'center', lineHeight: 17, marginBottom: 22 }}>
            {tagline}
          </Text>

          {/* ── Open Calm Space / Night Sleep button ── */}
          <TouchableOpacity
            onPress={() => setZenActive(true)}
            activeOpacity={0.82}
            style={{
              alignItems: 'center', paddingVertical: 18, borderRadius: 20,
              backgroundColor: NC + '20', borderWidth: 1.5, borderColor: NC + '65',
            }}>
            <Text style={{ fontSize: 22, marginBottom: 6 }}>◯</Text>
            <Text style={{ fontSize: 14, fontWeight: '900', color: NC, letterSpacing: 0.5 }}>
              {isNight ? 'Open Night Sleep' : 'Open Calm Space'}
            </Text>
            <Text style={{ fontSize: 9.5, color: NC + '70', fontWeight: '600', marginTop: 4, letterSpacing: 0.3 }}>
              {isNight ? '4·7·8 breathing  ·  Vedic mantras  ·  Sleep science' : '4·7·8 breathing  ·  Vedic mantras  ·  Nature sounds'}
            </Text>
          </TouchableOpacity>

          {/* Bottom shimmer */}
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, backgroundColor: NC + '30' }} />
        </LinearGradient>
      </View>
    </View>

    {/* Full-screen calm overlay */}
    <ZenModeOverlay visible={zenActive} onClose={() => setZenActive(false)} />
    </>
  );
}

// ── Friendly Reel Weather Blurb ──────────────────────────────────────────────
function getReelWeatherBlurb(
  weather: WeatherData,
  period: DoshaPeriod,
  hour: number,
): { emoji: string; title: string; tip: string; storyTips: string[] } {
  const code  = weather.weatherCode ?? 0;
  const temp  = weather.temp        ?? 25;
  const humid = weather.humidity    ?? 50;
  const t     = `${Math.round(temp)}°`;

  const isStorm    = code >= 95;
  const isRain     = !isStorm && code >= 51;
  const isCloudy   = !isRain  && [1,2,3,45,48].includes(code);
  const isClear    = code === 0;
  const isHot      = temp >= 32;
  const isWarm     = temp >= 24 && temp < 32;
  const isCool     = temp >= 16 && temp < 24;
  const isCold     = temp < 16;
  const isHumid    = humid >= 70;

  const isMorning   = hour >= 5  && hour < 10;
  const isMidday    = hour >= 10 && hour < 14;
  const isAfternoon = hour >= 14 && hour < 18;
  const isEvening   = hour >= 18;

  if (isStorm) return {
    emoji: '⛈️', title: 'Storm outside · Stay in',
    tip: 'Thunder & lightning — avoid open areas and stay safe indoors',
    storyTips: ['⛈️ Active storm outside — do not step out', 'Avoid open areas and tall trees', 'Unplug electronics · Keep calm and stay safe'],
  };

  // ── Morning ──────────────────────────────────────────────────────────────
  if (isMorning) {
    if (isRain) return {
      emoji: '🌧️', title: 'Rainy morning · Carry umbrella',
      tip: 'Take an umbrella before heading out · Wet roads ahead',
      storyTips: ['🌧️ Raining — grab an umbrella before leaving', 'Roads are wet · Drive slowly', 'Perfect morning for indoor breathwork or yoga'],
    };
    if (isCold) return {
      emoji: '🥶', title: `Cold ${t} · Layer up before going out`,
      tip: `${t} outside · Warm up indoors first · Sesame oil on feet`,
      storyTips: [`${t} this morning — layer up before stepping out`, 'Warm ginger-pepper tea is your best friend today', 'Sesame oil massage helps the body stay warm'],
    };
    if (isHot) return {
      emoji: '🌡️', title: `Already ${t} · Head out early`,
      tip: 'Step out now before it heats up · Light clothing only',
      storyTips: [`Already ${t} this morning — exercise early`, 'Light breathable clothing is a must', 'Hydrate before and after any outdoor activity'],
    };
    if (isHumid) return {
      emoji: '💧', title: `Humid ${t} · Move before 9 AM`,
      tip: 'High humidity slows you down · Finish exercise early',
      storyTips: [`Humid at ${t} — complete outdoor exercise before 9 AM`, 'High humidity reduces aerobic efficiency', 'Coconut water or ORS keeps you going'],
    };
    if (isClear && (isWarm || isHot)) return {
      emoji: '☀️', title: 'Beautiful morning · Go outside!',
      tip: 'Perfect for a walk or workout · Soak 10 min of sun',
      storyTips: ['☀️ Gorgeous clear morning — ideal for outdoor exercise', '10 min of morning sun locks in your circadian rhythm', 'Bare feet on grass amplifies the cortisol awakening response'],
    };
    if (isClear && isCool) return {
      emoji: '🌤️', title: `Fresh ${t} · Great for a walk`,
      tip: 'Crisp fresh air · Ideal for a brisk walk or run',
      storyTips: [`${t} and clear — perfect for a brisk morning walk`, 'Cool air sharpens focus and boosts morning alertness', 'Best outdoor exercise window of the day'],
    };
    return {
      emoji: '⛅', title: 'Decent morning · Get moving',
      tip: 'Cloudy but dry · Good window for outdoor activity',
      storyTips: ['Overcast sky — no rain expected', 'Diffused morning light is gentle on the eyes', 'Still a good window for a walk or light exercise'],
    };
  }

  // ── Midday ───────────────────────────────────────────────────────────────
  if (isMidday) {
    if (isRain) return {
      emoji: '🌧️', title: 'Raining · Eat in, focus well',
      tip: 'Stay indoors · Light lunch · Great deep work window',
      storyTips: ['Raining outside — stay in and make the most of it', 'Great window for deep focused work or learning', 'Light lunch today — rain cools digestive fire slightly'],
    };
    if (isHot) return {
      emoji: '🔥', title: `Hot ${t} · Stay shaded & hydrated`,
      tip: 'Avoid direct noon sun · Cool fluids · Eat light',
      storyTips: [`${t} outside — avoid direct midday sun`, 'Cool lime water or coconut water helps manage Pitta', 'Eat light — excess heat suppresses digestive enzymes'],
    };
    if (isCool || isCold) return {
      emoji: '🌤️', title: 'Cool midday · Peak digestive window',
      tip: 'Best time for your main meal · Eat well now',
      storyTips: ['Cool midday — digestive enzymes are firing at full power', 'Eat your largest, most complex meal between 12–1 PM', 'Walk 5 minutes post-lunch to stabilise blood sugar'],
    };
    return {
      emoji: '☀️', title: 'Good midday · Eat & focus',
      tip: 'Digestive fire at peak · Main meal of the day now',
      storyTips: ['Midday digestive fire is at its biological peak', 'Eat your largest meal between 12–1 PM', '5-minute post-lunch walk improves metabolism by 15%'],
    };
  }

  // ── Afternoon ─────────────────────────────────────────────────────────────
  if (isAfternoon) {
    if (isRain) return {
      emoji: '🌦️', title: 'Afternoon rain · Stay creative',
      tip: 'Rainy afternoon · Great for creative work indoors',
      storyTips: ['Afternoon rain — perfect for creative deep work', 'If you must go out, take an umbrella', 'Herbal tea over coffee this afternoon'],
    };
    if (isHot) return {
      emoji: '🌡️', title: `Hot ${t} · Skip outdoor cardio`,
      tip: 'Avoid intense sun · Shaded walk or indoor workout ok',
      storyTips: [`${t} — skip intense outdoor cardio today`, 'Indoor exercise or shaded walk only', 'Coconut water cools Pitta heat effectively'],
    };
    return {
      emoji: '🚶', title: 'Good afternoon · Perfect for walk',
      tip: 'Lung capacity peaks 3–5 PM · Best exercise window',
      storyTips: ['Lung capacity peaks at 3–5 PM — the best cardio window', 'A 20-minute walk now is worth 40 minutes in the morning', 'Great window for sports, creative work and collaboration'],
    };
  }

  // ── Evening ───────────────────────────────────────────────────────────────
  if (isEvening) {
    if (isRain) return {
      emoji: '🌧️', title: 'Rainy evening · Stay cozy',
      tip: 'Stay indoors · Light dinner · Wind down early',
      storyTips: ['Rainy evening — wind down comfortably indoors', 'Light early dinner before 7 PM recommended', 'Cozy journaling or light reading is perfect now'],
    };
    if (isCold) return {
      emoji: '🌙', title: `Cool ${t} · Grab a light jacket`,
      tip: 'Take a jacket · Brief walk still fine before 8 PM',
      storyTips: [`${t} this evening — take a light jacket or shawl`, 'A short 15-min walk before 8 PM still beneficial', 'Cool evenings naturally ease the body into sleep mode'],
    };
    if (isClear) return {
      emoji: '🌇', title: 'Clear evening · Nice for a walk',
      tip: 'Pleasant for a post-dinner walk · Dim screens by 9 PM',
      storyTips: ['Clear evening — gentle post-dinner walk is ideal', 'Fresh air after dinner lowers cortisol and aids digestion', 'Dim screens from 9 PM to protect melatonin production'],
    };
    if (isHumid || (isWarm && isHumid)) return {
      emoji: '💧', title: `Humid ${t} · Keep room cool`,
      tip: 'Humid night ahead · Light bedsheet · Ventilate room',
      storyTips: [`Humid at ${t} — keep your room ventilated tonight`, 'Use a light bedsheet rather than heavy blankets', 'A small fan or open window helps you sleep deeper'],
    };
    return {
      emoji: '🌆', title: 'Calm evening · Begin winding down',
      tip: 'Light dinner · Screen-free by 9 PM · Sleep by 10 PM',
      storyTips: ['A calm evening — prioritise winding down now', 'Light dinner before 7:30 PM recommended', 'Begin dimming lights and screens from 9 PM'],
    };
  }

  return {
    emoji: '🌡️', title: `${t} outside today`,
    tip: 'Dress appropriately for the current weather',
    storyTips: [`Current temperature: ${t}`, 'Dress for the weather and stay comfortable throughout the day'],
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Phase Ring Hero  — enlarged ring (left) + touch-sensitive Oracle Reel (right)
// ══════════════════════════════════════════════════════════════════════════════
function PhaseRingHero({ period, weather }: { period: DoshaPeriod; weather: WeatherData | null }) {
  const pulseAnim               = useRef(new Animated.Value(1)).current;
  const reelScrollRef           = useRef<ScrollView>(null);
  const reelPosRef              = useRef(0);
  const reelPausedRef           = useRef(false);
  const reelRafRef              = useRef<number>(0);
  const reelDirRef              = useRef<1 | -1>(1);
  const reelMaxPosRef           = useRef(0);
  const [storyIdx,    setStoryIdx]    = useState<number | null>(null);
  const [sciExpanded, setSciExpanded] = useState(false);
  const router = useRouter();

  const isNightPeriod = ['evening_kapha', 'night_pitta', 'night_vata'].includes(period.id);

  const navigateToExplore = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const durM = Math.max(1, Math.round(((period.endH - period.startH + 24) % 24) * 60));
    router.push({ pathname: '/period-detail' as never, params: { periodId: period.id, periodStart: period.startLabel, periodEnd: period.endLabel, minutesRemaining: String(period.minutesRemaining), minutesTotal: String(durM) } } as never);
  };

  // Pulse animation for ring halos
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.055, duration: 2400, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,     duration: 2400, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Ring dimensions (+15%)
  const RING_SIZE   = 210;
  const RING_STROKE = 11;
  const R = (RING_SIZE - RING_STROKE * 2) / 2;
  const C = 2 * Math.PI * R;

  const rem    = period.minutesRemaining;
  const durM   = Math.max(1, Math.round(((period.endH - period.startH + 24) % 24) * 60));
  const prog   = Math.min(1, Math.max(0, (durM - rem) / durM));
  const remStr = rem >= 60 ? `${Math.floor(rem / 60)}h ${rem % 60}m` : `${rem}m`;

  // Build Oracle Reel items
  const hour      = new Date().getHours();
  const envSugg   = getHourlyEnvSuggestion(period, weather, hour);
  const isDayPeriod = !isNightPeriod;  // suppress weather card at night

  const REEL_CARD_H = 90;
  const REEL_CARD_W = 140;

  const reelItems = [
    {
      label: '◉  PHASE SCIENCE',
      emoji: period.sciEmoji,
      title: period.sciTitle,
      tip: period.sciDesc.length > 85 ? period.sciDesc.slice(0, 85) + '…' : period.sciDesc,
      color: period.color,
      storyCard: { emoji: period.emoji, title: period.englishLabel, tips: [period.sciEmoji + '  ' + period.sciTitle, period.sciDesc], color: period.color, label: '◉  ACTIVE PHASE' } as HESCard,
    },
    ...(weather && isDayPeriod ? (() => {
      const wb = getReelWeatherBlurb(weather, period, hour);
      return [{
        label: '🌤  WEATHER TODAY',
        emoji: wb.emoji,
        title: wb.title.length > 38 ? wb.title.slice(0, 38) + '…' : wb.title,
        tip:   wb.tip.length   > 78 ? wb.tip.slice(0, 78)   + '…' : wb.tip,
        color: '#60a5fa',
        storyCard: { emoji: wb.emoji, title: wb.title, tips: wb.storyTips, color: '#60a5fa', label: '🌤  WEATHER SIGNAL' } as HESCard,
      }];
    })() : []),
    {
      label: '⏱  ENV SIGNAL',
      emoji: envSugg.emoji,
      title: envSugg.title,
      tip: envSugg.desc.length > 78 ? envSugg.desc.slice(0, 78) + '…' : envSugg.desc,
      color: period.color,
      storyCard: { emoji: envSugg.emoji, title: envSugg.title, tips: envSugg.desc.split(' · '), color: period.color, label: '⏱  ENV SIGNAL' } as HESCard,
    },
    ...period.activities.map(a => ({
      label: '✓  DO NOW',
      emoji: getActivityEmoji(a),
      title: a,
      tip: period.sciTitle + '  ·  ' + period.label,
      color: period.color,
      storyCard: { emoji: getActivityEmoji(a), title: a, tips: [period.sciTitle + '  ·  ' + period.label], color: period.color, label: '✓  DO THIS HOUR' } as HESCard,
    })),
    ...period.avoidances.map(a => ({
      label: '⚠️  AVOID',
      emoji: getAvoidanceEmoji(a),
      title: a,
      tip: 'Avoid during ' + period.label,
      color: '#f43f5e',
      storyCard: { emoji: getAvoidanceEmoji(a), title: a, tips: ['Avoid during ' + period.label], color: '#f43f5e', label: '⚠️  AVOID THIS HOUR' } as HESCard,
    })),
  ];

  const allStoryCards = reelItems.map(r => r.storyCard) as HESCard[];

  // Auto-scroll RAF loop — ping-pong left/right horizontal, stops on touch
  const REEL_SPEED = 0.18;
  useEffect(() => {
    if (reelItems.length === 0) return;
    reelDirRef.current = 1;
    reelPosRef.current = 0;
    const tick = () => {
      if (!reelPausedRef.current && reelMaxPosRef.current > 0) {
        reelPosRef.current += REEL_SPEED * reelDirRef.current;
        if (reelPosRef.current >= reelMaxPosRef.current) {
          reelPosRef.current = reelMaxPosRef.current;
          reelDirRef.current = -1;
        } else if (reelPosRef.current <= 0) {
          reelPosRef.current = 0;
          reelDirRef.current = 1;
        }
        reelScrollRef.current?.scrollTo({ x: reelPosRef.current, animated: false });
      }
      reelRafRef.current = requestAnimationFrame(tick);
    };
    reelRafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(reelRafRef.current);
  }, []);

  return (
    <>
      <View style={{ marginHorizontal: 16, marginTop: 18, marginBottom: 6 }}>

        {/* ── Section label — Body Rhythm · Phase Name ── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#60a5fa' }} />
            <View>
              <Text style={{ fontSize: 7.5, fontWeight: '900', color: '#FFFFFF50', letterSpacing: 1.6, fontFamily: 'Nunito_900Black' }}>BODY RHYTHM  ·  ACTIVE NOW</Text>
              <Text style={{ fontSize: 14, fontWeight: '900', color: '#FFFFFFEE', letterSpacing: 0.2, lineHeight: 18, fontFamily: 'Nunito_900Black', textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 5 }}>{period.englishLabel}</Text>
            </View>
          </View>
          <Text style={{ fontSize: 9, fontWeight: '700', color: '#60a5fa', fontFamily: 'Nunito_700Bold', textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 }}>{period.startLabel} – {period.endLabel}</Text>
        </View>

        {/* ── Decode CTA — just below Body Rhythm header ── */}
        <TouchableOpacity
          onPress={navigateToExplore}
          activeOpacity={0.85}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 14, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 99, borderWidth: 1.5, borderColor: '#60a5fa80', backgroundColor: 'rgba(8,10,28,0.75)', alignSelf: 'center' }}>
          <Text style={{ fontSize: 9, fontWeight: '900', color: '#60a5fa', letterSpacing: 0.9, fontFamily: 'Nunito_900Black' }}>✦  Decode your {period.englishLabel}</Text>
          <Text style={{ fontSize: 11, color: '#60a5fa', fontWeight: '900' }}>↗</Text>
        </TouchableOpacity>

        {/* ── Centered Progress Ring — Glassy Blue + Aura ── */}
        <View style={{ alignItems: 'center', marginBottom: 14 }}>
          <TouchableOpacity onPress={navigateToExplore} activeOpacity={0.92}>
            {/* Fixed-size ring container — all layers anchored here */}
            <View style={{ width: RING_SIZE, height: RING_SIZE }}>

              {/* === 5-layer pulsing aura (centered via symmetric negative top/left) === */}
              <Animated.View style={{ position: 'absolute', width: RING_SIZE + 72, height: RING_SIZE + 72, borderRadius: (RING_SIZE + 72) / 2, backgroundColor: 'rgba(96,165,250,0.025)', transform: [{ scale: pulseAnim }], top: -36, left: -36 }} />
              <Animated.View style={{ position: 'absolute', width: RING_SIZE + 52, height: RING_SIZE + 52, borderRadius: (RING_SIZE + 52) / 2, backgroundColor: 'rgba(96,165,250,0.05)', transform: [{ scale: pulseAnim }], top: -26, left: -26 }} />
              <Animated.View style={{ position: 'absolute', width: RING_SIZE + 34, height: RING_SIZE + 34, borderRadius: (RING_SIZE + 34) / 2, backgroundColor: 'rgba(96,165,250,0.09)', transform: [{ scale: pulseAnim }], top: -17, left: -17 }} />
              <Animated.View style={{ position: 'absolute', width: RING_SIZE + 18, height: RING_SIZE + 18, borderRadius: (RING_SIZE + 18) / 2, backgroundColor: 'rgba(96,165,250,0.15)', transform: [{ scale: pulseAnim }], top: -9, left: -9 }} />
              <Animated.View style={{ position: 'absolute', width: RING_SIZE + 6, height: RING_SIZE + 6, borderRadius: (RING_SIZE + 6) / 2, backgroundColor: 'rgba(96,165,250,0.24)', transform: [{ scale: pulseAnim }], top: -3, left: -3 }} />

              {/* === SVG arc — 3-layer glassy blue glow stroke === */}
              <Svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
                {/* Track */}
                <SvgCircle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={R} fill="none" stroke="rgba(96,165,250,0.13)" strokeWidth={RING_STROKE} />
                {/* Wide outer glow stroke */}
                <SvgCircle
                  cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={R}
                  fill="none" stroke="#93c5fd" strokeWidth={RING_STROKE + 16} strokeLinecap="round"
                  strokeDasharray={String(C)} strokeDashoffset={String(C * (1 - prog))}
                  transform={`rotate(-90, ${RING_SIZE / 2}, ${RING_SIZE / 2})`} opacity={0.14}
                />
                {/* Mid glow stroke */}
                <SvgCircle
                  cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={R}
                  fill="none" stroke="#7dd3fc" strokeWidth={RING_STROKE + 8} strokeLinecap="round"
                  strokeDasharray={String(C)} strokeDashoffset={String(C * (1 - prog))}
                  transform={`rotate(-90, ${RING_SIZE / 2}, ${RING_SIZE / 2})`} opacity={0.26}
                />
                {/* Main crisp stroke */}
                <SvgCircle
                  cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={R}
                  fill="none" stroke="#60a5fa" strokeWidth={RING_STROKE} strokeLinecap="round"
                  strokeDasharray={String(C)} strokeDashoffset={String(C * (1 - prog))}
                  transform={`rotate(-90, ${RING_SIZE / 2}, ${RING_SIZE / 2})`} opacity={0.96}
                />
                {/* Inner highlight sliver */}
                <SvgCircle
                  cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={R}
                  fill="none" stroke="#bfdbfe" strokeWidth={3} strokeLinecap="round"
                  strokeDasharray={String(C)} strokeDashoffset={String(C * (1 - prog))}
                  transform={`rotate(-90, ${RING_SIZE / 2}, ${RING_SIZE / 2})`} opacity={0.40}
                />
              </Svg>

              {/* === Center content — two-line safe, clearly legible === */}
              <View style={{ position: 'absolute', top: 0, left: 0, width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, gap: 2, zIndex: 10, elevation: 10 }}>
                <Text style={{ fontSize: 34, lineHeight: 42 }}>{period.emoji}</Text>
                <Text style={{ fontSize: 9.5, fontWeight: '900', color: '#FFFFFFF0', textAlign: 'center', lineHeight: 13.5, fontFamily: 'Nunito_900Black', textShadowColor: 'rgba(0,0,0,0.95)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 5 }} numberOfLines={2}>{period.englishLabel}</Text>
                <Text style={{ fontSize: 28, fontWeight: '900', color: '#60a5fa', letterSpacing: -0.5, marginTop: 3, fontFamily: 'Nunito_900Black', textShadowColor: 'rgba(0,0,14,0.9)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10 }}>{remStr}</Text>
                <Text style={{ fontSize: 7, fontWeight: '700', color: '#FFFFFF65', letterSpacing: 0.8 }}>remaining</Text>
                <View style={{ height: 1, width: 54, backgroundColor: 'rgba(96,165,250,0.40)', marginVertical: 3 }} />
                <Text style={{ fontSize: 7.5, fontWeight: '800', color: '#93c5fdEE', textAlign: 'center', lineHeight: 11.5 }} numberOfLines={2}>{period.sciEmoji}  {period.sciTitle}</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Oracle Reel — horizontal auto-sliding strip ── */}
        <View style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ fontSize: 7, fontWeight: '900', color: '#FFFFFF55', letterSpacing: 1.4 }}>✦  ORACLE REEL</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={{ fontSize: 6, color: '#FFFFFF40', fontWeight: '700', letterSpacing: 0.8 }}>👆 tap</Text>
              <Text style={{ fontSize: 6, color: '#FFFFFF25', fontWeight: '700' }}>·</Text>
              <Text style={{ fontSize: 6, color: '#FFFFFF40', fontWeight: '700', letterSpacing: 0.8 }}>↔ swipe</Text>
            </View>
          </View>
          <View style={{ overflow: 'hidden' }}>
            {/* Left edge fade */}
            <LinearGradient
              colors={['rgba(6,6,16,0.55)', 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 18, zIndex: 2 }}
              pointerEvents="none"
            />
            {/* Right edge fade */}
            <LinearGradient
              colors={['transparent', 'rgba(6,6,16,0.55)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: 18, zIndex: 2 }}
              pointerEvents="none"
            />
            <ScrollView
              ref={reelScrollRef}
              horizontal
              scrollEnabled
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={16}
              decelerationRate="fast"
              snapToInterval={REEL_CARD_W + 10}
              snapToAlignment="start"
              contentContainerStyle={{ gap: 10, paddingRight: 8 }}
              onContentSizeChange={(w) => { reelMaxPosRef.current = Math.max(0, w - (SCREEN_W - 32)); }}
              onScrollBeginDrag={() => { reelPausedRef.current = true; }}
              onScrollEndDrag={(e) => {
                reelPosRef.current = e.nativeEvent.contentOffset.x;
                setTimeout(() => { reelPausedRef.current = false; }, 2200);
              }}
              onMomentumScrollEnd={(e) => { reelPosRef.current = e.nativeEvent.contentOffset.x; }}>
              {reelItems.map((item, i) => (
                <TouchableOpacity
                  key={i}
                  activeOpacity={0.78}
                  onPress={() => { setStoryIdx(i); }}
                  style={{ width: REEL_CARD_W, height: REEL_CARD_H, overflow: 'hidden', borderRadius: 14, borderWidth: 1, borderColor: item.color + '55', backgroundColor: 'rgba(255,255,255,0.04)' }}>
                  <LinearGradient
                    colors={[item.color + '34', item.color + '12', 'rgba(3,3,14,0.82)']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                  />
                  <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.30)' }} />
                  <View style={{ flex: 1, paddingHorizontal: 10, paddingVertical: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <View style={{ paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5, borderWidth: 1, borderColor: item.color + '65', backgroundColor: item.color + '2A', flexShrink: 1, marginRight: 4 }}>
                        <Text style={{ fontSize: 6, fontWeight: '900', color: item.color, letterSpacing: 0.8 }} numberOfLines={1}>{item.label}</Text>
                      </View>
                      <Text style={{ fontSize: 9, color: item.color + 'BB', fontWeight: '900' }}>↗</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 22, lineHeight: 26 }}>{item.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 9.5, fontWeight: '900', color: '#FFFFFFEE', lineHeight: 13 }} numberOfLines={1}>{item.title}</Text>
                        <View style={{ height: 1.5, width: 26, backgroundColor: item.color + '60', marginVertical: 4 }} />
                        <Text style={{ fontSize: 7, color: '#FFFFFFCC', lineHeight: 10.5 }} numberOfLines={2}>{item.tip}</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* ── Body Science Card — expandable ── */}
        <TouchableOpacity
          onPress={() => setSciExpanded(v => !v)}
          activeOpacity={0.88}
          style={{ borderRadius: 18, borderWidth: 1, borderColor: '#60a5fa50', marginTop: 14, marginBottom: 4, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.04)' }}>
          <LinearGradient colors={['#60a5fa26', '#60a5fa0A', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ padding: 14 }}>
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.28)' }} />

            {/* ── Header: label + toggle ── */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#60a5fa' }} />
                <Text style={{ fontSize: 7, fontWeight: '900', color: '#60a5faBB', letterSpacing: 1.5 }}>BODY SCIENCE  ·  RIGHT NOW</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {sciExpanded && (
                  <TouchableOpacity onPress={navigateToExplore} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#60a5fa28', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#60a5fa60' }}>
                    <Text style={{ fontSize: 7, fontWeight: '900', color: '#60a5fa' }}>FULL SCIENCE</Text>
                    <Text style={{ fontSize: 9, color: '#60a5fa' }}>↗</Text>
                  </TouchableOpacity>
                )}
                <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: '#60a5fa55', backgroundColor: '#60a5fa20', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 10, color: '#60a5fa', fontWeight: '900', lineHeight: 14 }}>{sciExpanded ? '↑' : '↓'}</Text>
                </View>
              </View>
            </View>

            {/* ── Emoji + title — always visible ── */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: sciExpanded ? 10 : 0 }}>
              <Text style={{ fontSize: 28 }}>{period.sciEmoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 6, fontWeight: '900', color: '#38bdf875', letterSpacing: 1.3, marginBottom: 2 }}>🔬  BIOLOGY + AYURVEDA</Text>
                <Text style={{ fontSize: 13, fontWeight: '900', color: '#FFFFFFEE', lineHeight: 18 }} numberOfLines={1}>{period.sciTitle}</Text>
                {!sciExpanded && (
                  <Text style={{ fontSize: 10, color: '#FFFFFF65', lineHeight: 15, marginTop: 4 }} numberOfLines={2}>{period.sciDesc}</Text>
                )}
              </View>
            </View>

            {/* ── Expanded content ── */}
            {sciExpanded && (
              <>
                {(() => {
                  const ayurMap: Record<string, { agni: string; bio: string }> = {
                    morning_kapha:  { agni: 'AGNI BALANCED · ANABOLIC WINDOW',       bio: 'Testosterone & GH surge · Lymphatic clearance peak · Anabolic cellular repair' },
                    midday_pitta:   { agni: 'AGNI BLAZING · DIGESTIVE FIRE PEAK',    bio: 'HCl & enzymes elevated · Insulin sensitivity optimal · Metabolism at daily high' },
                    afternoon_vata: { agni: 'PRANA VATA · NEURAL FIRE PEAK',         bio: 'Dopamine & Norepinephrine surge · Acetylcholine peaks · Neural plasticity open' },
                    evening_kapha:  { agni: 'OJAS REPLENISHES · MELATONIN RISES',    bio: 'Melatonin synthesis begins · Core temp drops 0.5°C/hr · Parasympathetic activates' },
                    night_pitta:    { agni: 'NOCTURNAL PITTA · LIVER REPAIR ACTIVE', bio: 'GH peaks in slow-wave sleep · Autophagy fires · DNA & cellular repair active' },
                    night_vata:     { agni: 'PRANA VATA · BRAHMA MUHURTA OPEN',      bio: 'Alpha-theta brainwaves peak · CAR begins · Neuroplasticity at 24-hr zenith' },
                  };
                  const ins = ayurMap[period.id];
                  if (!ins) return null;
                  return (
                    <View style={{ backgroundColor: 'rgba(0,0,0,0.32)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 9, borderLeftWidth: 2, borderLeftColor: '#60a5fa' }}>
                      <Text style={{ fontSize: 7, fontWeight: '900', color: '#60a5faBB', letterSpacing: 1.2, marginBottom: 4 }}>🕉  AS PER AYURVEDA  ·  {ins.agni}</Text>
                      <Text style={{ fontSize: 7, fontWeight: '800', color: '#38bdf872', letterSpacing: 1.1, marginBottom: 3 }}>⟷  ANALOGOUS IN MODERN BIOLOGY</Text>
                      <Text style={{ fontSize: 11, color: '#FFFFFF95', lineHeight: 16 }}>{ins.bio}</Text>
                    </View>
                  );
                })()}
                {(() => {
                  const pillsMap: Record<string, string[]> = {
                    morning_kapha:  ['💪 Testosterone', '📈 GH', '🛡️ Lymph Peak', '⚡ Cortisol Rise'],
                    midday_pitta:   ['🧪 HCl Peak', '🔑 Insulin', '⚡ Cortisol', '🔥 Bile Acids'],
                    afternoon_vata: ['🎯 Dopamine', '⚡ Norepinephrine', '🧠 Acetylcholine', '💨 Lung Peak'],
                    evening_kapha:  ['🌙 Melatonin', '😌 Serotonin', '💎 Ojas', '❄️ Core Temp ↓'],
                    night_pitta:    ['🔬 GH Peak', '♻️ Autophagy', '🛡️ DNA Repair', '🫀 Liver Detox'],
                    night_vata:     ['🌊 Theta Waves', '🌅 CAR Rising', '✨ Neuroplasticity', '🧘 Deep Rest'],
                  };
                  const list = pillsMap[period.id] ?? [];
                  if (!list.length) return null;
                  return (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled style={{ marginBottom: 9 }} contentContainerStyle={{ gap: 6, paddingRight: 4 }}>
                      {list.map((pill, pi) => (
                        <View key={pi} style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: 99, borderWidth: 1, borderColor: '#60a5fa45', backgroundColor: '#60a5fa15' }}>
                          <Text style={{ fontSize: 8, fontWeight: '900', color: '#60a5faDD', letterSpacing: 0.3 }}>{pill}</Text>
                        </View>
                      ))}
                    </ScrollView>
                  );
                })()}
                <Text style={{ fontSize: 11, color: '#FFFFFF80', lineHeight: 17, marginBottom: 10 }} numberOfLines={4}>{period.sciDesc}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ height: 1, flex: 1, backgroundColor: '#60a5fa28' }} />
                  <Text style={{ fontSize: 7, color: '#60a5fa90', fontWeight: '800', letterSpacing: 1 }}>TAP TO COLLAPSE  ↑</Text>
                  <View style={{ height: 1, flex: 1, backgroundColor: '#60a5fa28' }} />
                </View>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>


        {/* ── Reel hint ── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 10, paddingBottom: 2, gap: 8 }}>
          <View style={{ height: 1, flex: 1, backgroundColor: '#FFFFFF08' }} />
          <Text style={{ fontSize: 7.5, color: '#FFFFFF22', fontWeight: '700', letterSpacing: 1.2 }}>←  AUTO-SCROLLING  ·  SWIPE TO EXPLORE  ·  TAP TO OPEN</Text>
          <View style={{ height: 1, flex: 1, backgroundColor: '#FFFFFF08' }} />
        </View>
      </View>

      {/* Story modal on reel card tap */}
      {storyIdx !== null && (
        <HESStoryModal
          cards={allStoryCards}
          initialIndex={storyIdx}
          onClose={() => { setStoryIdx(null); }}
        />
      )}

    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Main Daily Screen
// ══════════════════════════════════════════════════════════════════════════════
export default function DailyTab() {
  const [liveClock, setLiveClock]           = useState(new Date());
  const [solarTimes, setSolarTimes]         = useState<SolarTimes | null>(null);
  const [weather, setWeather]               = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [bgUri, setBgUri]                   = useState<string | null>(null);
  const [periods, setPeriods]               = useState<DoshaPeriod[]>([]);
  const [currentPeriod, setCurrentPeriod]   = useState<DoshaPeriod | null>(null);
  const [brahmaInfo, setBrahmaInfo]         = useState<BrahmaMuhurtaInfo | null>(null);
  const [brahmaEnabled, setBrahmaEnabled]   = useState(false);
  const [settings, setSettings]             = useState<AlarmSettings>(DEFAULT_ALARM_SETTINGS);
  const [show7Day, setShow7Day]             = useState(false);
  const router = useRouter();
  const [wakeLog, setWakeLog]               = useState<WakeLogEntry | null>(null);
  const [sunStreak, setSunStreak]           = useState<SunriseStreak | null>(null);
  const [showShareCard, setShowShareCard]   = useState(false);
  const [mode, setMode]                     = useState<'normal' | 'relax'>('normal');
  const [zenActive, setZenActive]           = useState(false);

  // Live clock tick
  useEffect(() => {
    const t = setInterval(() => setLiveClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Load today's wake log + streak — auto-show share card if woke before sunrise
  useEffect(() => {
    (async () => {
      const [log, streak] = await Promise.all([getTodayWakeLog(), getStreak()]);
      setWakeLog(log);
      setSunStreak(streak);
      if (log?.wasBeforeSunrise && !log.sharedToday) {
        setTimeout(() => setShowShareCard(true), 1200); // slight delay so screen loads first
      }
    })();
  }, []);

  // Load saved settings and GPS location
  useEffect(() => {
    store.getJSON<AlarmSettings>(KEYS.alarmSettings)
      .then(s => { if (s) { setSettings({ ...DEFAULT_ALARM_SETTINGS, ...s }); setBrahmaEnabled(s.brahmaReminder ?? false); } })
      .catch(() => {});
    store.getJSON<{ lat: number; lon: number }>(KEYS.location)
      .then(loc => {
        if (loc?.lat && loc?.lon) {
          const s = getSolarTimes(loc.lat, loc.lon);
          setSolarTimes(s);
          setBrahmaInfo(getBrahmaMuhurtaInfo(s));
        }
      }).catch(() => {});
    loadWeather();
  }, []);

  const loadWeather = async () => {
    setWeatherLoading(true);
    try {
      const w = await fetchWeather();
      setWeather(w);
      if (w?.lat && w?.lon) {
        const s = getSolarTimes(w.lat, w.lon);
        setSolarTimes(s);
        setBrahmaInfo(getBrahmaMuhurtaInfo(s));
        store.setJSON(KEYS.location, { lat: w.lat, lon: w.lon }).catch(() => {});
      }
    } catch {} finally { setWeatherLoading(false); }
  };

  // Recalculate dosha periods every minute
  useEffect(() => {
    if (!solarTimes) return;
    const nowH = liveClock.getHours() + liveClock.getMinutes() / 60;
    const p = getDoshaPeriods(solarTimes, nowH);
    setPeriods(p);
    setCurrentPeriod(p.find(x => x.status === 'active') ?? null);
    setBrahmaInfo(getBrahmaMuhurtaInfo(solarTimes));
  }, [liveClock, solarTimes]);

  // Background image — local cache first, network fallback
  useEffect(() => {
    const h = liveClock.getHours() + liveClock.getMinutes() / 60;
    const key = getTimedBgKey(h, solarTimes) ?? 'night';
    getBgSource(key).then(uri => setBgUri(uri)).catch(() => {});
  }, [liveClock, solarTimes]);

  // Sync mode when period changes — disabled for now, mode stays 'normal' always
  // useEffect(() => {
  //   const isNight = currentPeriod ? ['evening_kapha', 'night_pitta', 'night_vata'].includes(currentPeriod.id) : false;
  //   setMode(isNight ? 'relax' : 'normal');
  // }, [currentPeriod?.id]);

  // Auto-open ZenModeOverlay for night periods — disabled for now
  // useEffect(() => {
  //   const isNight = currentPeriod ? ['evening_kapha', 'night_pitta', 'night_vata'].includes(currentPeriod.id) : false;
  //   if (isNight && mode === 'relax') {
  //     const t = setTimeout(() => setZenActive(true), 600);
  //     return () => clearTimeout(t);
  //   }
  // }, [mode, currentPeriod?.id]);

  const toggleBrahma = async () => {
    const newVal = !brahmaEnabled;
    setBrahmaEnabled(newVal);
    const updated = { ...settings, brahmaReminder: newVal };
    setSettings(updated);
    await store.setJSON(KEYS.alarmSettings, updated);
    if (newVal) {
      const loc = await store.getJSON<{ lat: number; lon: number }>(KEYS.location).catch(() => null);
      if (loc?.lat && loc?.lon) { await scheduleBrahmaMuhurtaNotif(loc.lat, loc.lon); }
    }
    else { await cancelBrahmaMuhurtaNotif(); }
  };

  // ── Derived display values ───────────────────────────────────────────────
  const isNightPeriodNow = currentPeriod ? ['evening_kapha', 'night_pitta', 'night_vata'].includes(currentPeriod.id) : false;
  const nextPeriod = periods.filter(x => x.status === 'upcoming').sort((a, b) => a.minutesUntil - b.minutesUntil)[0] ?? null;
  const hh = liveClock.getHours();
  const mm = liveClock.getMinutes();

  const bgH = hh + mm / 60;
  const timeBgKey = getTimedBgKey(bgH, solarTimes);
  const isLight  = timeBgKey === 'morning' || timeBgKey === 'midday' || timeBgKey === 'afternoon';
  const isGolden = timeBgKey === 'sunrise' || timeBgKey === 'sandhya' || timeBgKey === 'predawn' || timeBgKey === 'twilight';

  const scrim: [string, string, string] = isLight
    ? ['rgba(0,4,18,0.82)', 'rgba(0,4,18,0.52)', 'rgba(0,4,18,0.86)']
    : isGolden
    ? ['rgba(0,0,0,0.66)',  'rgba(0,0,0,0.36)',  'rgba(0,0,0,0.70)']
    : ['rgba(2,2,16,0.56)',  'rgba(2,2,16,0.28)',  'rgba(2,2,16,0.60)'];

  const headerGrad: [string, string] = isLight
    ? ['rgba(0,5,22,0.96)',  'rgba(0,5,22,0.28)']
    : isGolden
    ? ['rgba(0,0,0,0.88)',   'rgba(0,0,0,0.16)']
    : ['rgba(2,2,24,0.88)',  'rgba(2,2,24,0.12)'];

  // ── Render ───────────────────────────────────────────────────────────────
  const isNightNow = hh < Math.floor(solarTimes?.sunrise ?? 6) || hh >= Math.floor(solarTimes?.sunset ?? 19);

  return (
    <ImageBackground
      source={bgUri ? { uri: bgUri } : undefined}
      style={D.screen}
      imageStyle={{ opacity: 0.88 }}>

      <LinearGradient colors={scrim} style={StyleSheet.absoluteFillObject} pointerEvents="none" />

      {/* ── Sticky header ── */}
      <LinearGradient colors={headerGrad} style={D.headerGrad}>
        <SafeAreaView edges={['top']}>
          <View style={D.headerTop}>
            <Text style={D.appName}>🌅  Daily</Text>
            <TouchableOpacity
              onPress={loadWeather} style={D.refreshBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              {weatherLoading
                ? <ActivityIndicator size="small" color={ACCENT} />
                : <Text style={{ color: ACCENT, fontSize: 18 }}>↻</Text>}
            </TouchableOpacity>
          </View>

        </SafeAreaView>
      </LinearGradient>

      {/* ── Sticky Mode Toggle — hidden for now, kept for future use ── */}
      {false && currentPeriod && (
        <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 }}>
          <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 16, padding: 4 }}>
            {(['normal', 'relax'] as const).map(m => {
              const label = m === 'normal' ? 'Work Mode' : (isNightPeriodNow ? 'Night Sleep' : 'Calm Space');
              const icon  = m === 'normal' ? '⚡' : '◯';
              return (
                <TouchableOpacity
                  key={m}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setMode(m);
                    if (m === 'relax') setZenActive(true);
                  }}
                  activeOpacity={0.8}
                  style={{
                    flex: 1, paddingVertical: 11, borderRadius: 13,
                    alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 7,
                    backgroundColor: mode === m ? (m === 'relax' ? 'rgba(96,165,250,0.25)' : 'rgba(255,255,255,0.15)') : 'transparent',
                    borderWidth: mode === m ? 1 : 0,
                    borderColor: mode === m ? (m === 'relax' ? '#60a5fa60' : 'rgba(255,255,255,0.25)') : 'transparent',
                  }}>
                  <Text style={{ fontSize: 15 }}>{icon}</Text>
                  <Text style={{
                    fontSize: 11, fontWeight: '900', letterSpacing: 0.3,
                    color: mode === m ? (m === 'relax' ? '#93c5fd' : '#FFFFFF') : 'rgba(255,255,255,0.35)',
                  }}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* ── Scrollable content ── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 110, paddingTop: 4 }}
        showsVerticalScrollIndicator={false}>

        {/* MORNING SHARE BANNER — shown if woke before sunrise today */}
        {wakeLog?.wasBeforeSunrise && (
          <TouchableOpacity
            onPress={() => setShowShareCard(true)}
            activeOpacity={0.85}
            style={MSB.bar}>
            <LinearGradient
              colors={['#F5820A22', '#60a5fa14', 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFillObject} />
            <LinearGradient colors={['rgba(255,255,255,0.14)','rgba(255,255,255,0.03)']} start={{x:0,y:0}} end={{x:0,y:1}} style={StyleSheet.absoluteFillObject} />
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.35)' }} />
            <Text style={{ fontSize: 22 }}>🌅</Text>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={MSB.title}>
                You woke at <Text style={{ color: ACCENT }}>{wakeLog.wakeTimeStr}</Text>
                {sunStreak && sunStreak.count > 0
                  ? <Text style={{ color: '#60a5fa' }}>  ·  🔥 {sunStreak.count} day streak</Text>
                  : null}
              </Text>
              <Text style={MSB.sub}>Tap to share your sunrise with friends →</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* COSMIC ORBIT STRIP — unified solar ephemeris · lunar phase · cosmic almanac */}
        <CosmicOrbitStrip
          solarTimes={solarTimes}
          onCosmicPress={() => router.push('/cosmic-explore' as never)}
        />

        {/* WEATHER SECTION — collapsible (tap to expand hourly forecast) */}
        {weather && (
          <WeatherSection
            weather={weather}
            solarTimes={solarTimes}
            onMore={() => setShow7Day(true)}
          />
        )}

        {/* BIO CIRCADIAN — PHASE RING HERO */}
        {currentPeriod ? (
          <View>
            <PhaseRingHero key={currentPeriod.id} period={currentPeriod} weather={weather} />
            {brahmaInfo?.status === 'active' && (
              <View style={{ paddingHorizontal: 16 }}>
                <BrahmaMuhurtaExtrasCard info={brahmaInfo} />
              </View>
            )}
          </View>
        ) : (
          !solarTimes && periods.length === 0 ? (
            <View style={D.noGpsHint}>
              <Text style={{ fontSize: 34 }}>🛰</Text>
              <Text style={{ color: '#FFFFFF40', fontSize: 13, fontWeight: '600', textAlign: 'center', lineHeight: 20 }}>
                GPS location needed{'\n'}for solar-accurate periods
              </Text>
              <TouchableOpacity onPress={loadWeather} style={D.gpsBtn}>
                <Text style={{ color: ACCENT, fontWeight: '800', fontSize: 12 }}>Enable Location  →</Text>
              </TouchableOpacity>
            </View>
          ) : null
        )}

        {/* 7-Day forecast modal */}
        {show7Day && weather?.daily && weather.daily.length > 0 && (
          <SevenDayModal daily={weather.daily} onClose={() => setShow7Day(false)} />
        )}


      </ScrollView>

      {/* WAKE-UP SHARE CARD MODAL */}
      {showShareCard && wakeLog && sunStreak && (
        <WakeUpShareCard
          wakeLog={wakeLog}
          streak={sunStreak}
          onClose={() => setShowShareCard(false)}
        />
      )}
      {/* Calm / Night Sleep full-screen overlay */}
      <ZenModeOverlay
        visible={zenActive}
        onClose={() => { setZenActive(false); setMode('normal'); }}
      />
    </ImageBackground>
  );
}

// ── StyleSheets ───────────────────────────────────────────────────────────────
const D = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#060610' },
  headerGrad: { paddingBottom: 4 },
  headerTop: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 6, paddingBottom: 6,
  },
  appName: { fontSize: 15, fontWeight: '900', color: '#fff', letterSpacing: 0.5, fontFamily: 'Nunito_900Black', textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 },
  refreshBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  clockTime: { fontSize: 44, fontWeight: '300', color: '#fff', letterSpacing: -2, fontFamily: 'Nunito_400Regular', textShadowColor: 'rgba(0,0,0,0.85)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10 },
  clockAmpm: { fontSize: 15, fontWeight: '600', color: ACCENT, paddingBottom: 3, fontFamily: 'Nunito_600SemiBold' },
  clockDate: { fontSize: 11, color: '#FFFFFF50', fontWeight: '600', letterSpacing: 0.5, fontFamily: 'Nunito_600SemiBold' },
  weatherSummary: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'nowrap',
    gap: 6, paddingHorizontal: 18, paddingBottom: 4,
  },
  weatherEmoji: { fontSize: 18 },
  weatherTemp:  { fontSize: 16, fontWeight: '800', color: '#fff' },
  weatherCond:  { fontSize: 12, color: '#FFFFFF60', fontWeight: '500' },
  weatherCity:  { fontSize: 12, color: '#FFFFFF40' },
  weatherExtra: { fontSize: 12, color: '#FFFFFF35' },
  hlRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hlHigh: { fontSize: 12, fontWeight: '800', color: '#fb923c' },
  hlLow:  { fontSize: 12, fontWeight: '700', color: '#93c5fd' },
  currentBanner: {
    marginHorizontal: 16, marginTop: 10, borderRadius: 22, borderWidth: 1.5,
    padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14, overflow: 'hidden',
  },
  cpEmoji:  { fontSize: 38 },
  cpLabel:  { fontSize: 18, fontWeight: '900' },
  cpSci:    { fontSize: 11, color: '#FFFFFF55', fontWeight: '500' },
  cpTime:   { fontSize: 10, color: '#FFFFFF40' },
  activeDot: { width: 8, height: 8, borderRadius: 4, alignSelf: 'flex-start', marginTop: 4 },
  sectionRow: {
    flexDirection: 'row', alignItems: 'baseline', gap: 8,
    marginHorizontal: 16, marginTop: 18, marginBottom: 8,
  },
  sectionTitle: { fontSize: 9, fontWeight: '900', color: '#FFFFFF30', letterSpacing: 1.8, fontFamily: 'Nunito_900Black' },
  sectionSub:   { fontSize: 9, color: '#FFFFFF18' },
  noGpsHint: {
    marginHorizontal: 16, marginTop: 16, alignItems: 'center', gap: 12,
    padding: 36, borderRadius: 22, borderWidth: 1, borderColor: '#FFFFFF08',
    borderStyle: 'dashed',
  },
  gpsBtn: {
    borderWidth: 1, borderColor: ACCENT + '40', borderRadius: 99,
    paddingHorizontal: 20, paddingVertical: 10, backgroundColor: ACCENT + '10',
  },
  solarRow: {
    flexDirection: 'row', marginHorizontal: 16, marginTop: 6, marginBottom: 2,
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.32, shadowRadius: 18, elevation: 8,
  },
  solarCell:  { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 6 },
  solarVal:   { fontSize: 12, fontWeight: '800', color: '#fff' },
  solarLabel: { fontSize: 8, color: '#FFFFFF35', fontWeight: '600' },
  tithiRow:   { alignItems: 'center', paddingBottom: 8 },
  tithiText:  { fontSize: 10, color: '#FFFFFF40', fontWeight: '600', letterSpacing: 0.4 },
  bioCircadianTitle: { fontSize: 17, fontWeight: '900', color: '#FFFFFFCC', letterSpacing: 0.8, lineHeight: 22, fontFamily: 'Nunito_900Black' },
  bioCircadianSub:   { fontSize: 13, fontWeight: '700', color: '#FFFFFF50', letterSpacing: 1.4, lineHeight: 18, fontFamily: 'Nunito_700Bold' },
  bioCircadianTag:   { fontSize: 9,  fontWeight: '900', color: ACCENT + 'AA', letterSpacing: 2.2, marginTop: 3 },
});

const W = StyleSheet.create({
  stripContainer: { marginTop: 8, marginBottom: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.10, shadowRadius: 6, elevation: 2 },
  hourCell: {
    alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 10,
    borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.20)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.42)',
    minWidth: 58,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.30, shadowRadius: 14, elevation: 6,
  },
  hourCellNow: { backgroundColor: ACCENT + '22', borderColor: ACCENT + '55' },
  hourLabel: { fontSize: 8, fontWeight: '900', color: '#FFFFFFCC', letterSpacing: 0.5, textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  hourEmoji: { fontSize: 20 },
  hourTemp:  { fontSize: 12, fontWeight: '900', color: '#FFFFFFEE', textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  moreBtn: {
    alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 16, backgroundColor: ACCENT + '25', borderWidth: 1, borderColor: ACCENT + '60',
    minWidth: 66,
    shadowColor: ACCENT, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.22, shadowRadius: 10, elevation: 4,
  },
  moreTxt:   { fontSize: 9, fontWeight: '900', color: ACCENT, letterSpacing: 0.5 },
  moreArrow: { fontSize: 16, color: ACCENT },
});


const WS = StyleSheet.create({
  card: {
    marginHorizontal: 16, marginTop: 10, borderRadius: 20, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.26)',
    backgroundColor: 'rgba(255,255,255,0.13)', flexDirection: 'row', overflow: 'hidden',
    paddingVertical: 16, paddingRight: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.36, shadowRadius: 24, elevation: 12,
  },
  colorBar:     { width: 4, borderRadius: 2, marginLeft: 4 },
  timeLabel:    { fontSize: 8, fontWeight: '900', color: '#FFFFFF28', letterSpacing: 1.6, marginBottom: 6 },
  titleRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title:        { fontSize: 14, fontWeight: '900', flex: 1 },
  tipRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  tipDot:       { width: 5, height: 5, borderRadius: 3, marginTop: 5 },
  tipText:      { fontSize: 11, color: '#FFFFFF60', lineHeight: 18, flex: 1 },
  upcomingRow:  { marginTop: 14, borderTopWidth: 1, borderTopColor: '#FFFFFF08', paddingTop: 10 },
  upcomingLabel:{ fontSize: 7, fontWeight: '900', color: '#FFFFFF20', letterSpacing: 1.5, marginBottom: 2 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFFFFF05', borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 7,
  },
  chipHour: { fontSize: 11, fontWeight: '900' },
  chipTip:  { fontSize: 9, color: '#FFFFFF35', fontWeight: '500', marginTop: 1 },
});

const SD = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000088' },
  sheet: {
    backgroundColor: '#080814', borderTopLeftRadius: 30, borderTopRightRadius: 30,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, maxHeight: '85%',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.12)',
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#FFFFFF18', alignSelf: 'center', marginBottom: 16 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sheetTitle: { fontSize: 17, fontWeight: '900', color: '#fff', letterSpacing: 0.2 },
  dayCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 18, borderWidth: 1, overflow: 'hidden',
    paddingVertical: 13, paddingRight: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32, shadowRadius: 16, elevation: 8,
  },
});

const P = StyleSheet.create({
  card: {
    marginHorizontal: 16, marginTop: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.26)',
    backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden', padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.34, shadowRadius: 22, elevation: 10,
  },
  cardActive: { backgroundColor: 'rgba(255,255,255,0.13)' },
  cardDone:   { opacity: 0.52 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  doshaTag: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 },
  doshaTagTxt: { fontSize: 7, fontWeight: '900', letterSpacing: 1.5 },
  activePill: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  activeDot: { width: 6, height: 6, borderRadius: 3 },
  activeTxt: { fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  doneTxt:  { fontSize: 8, fontWeight: '800', color: '#FFFFFF25', letterSpacing: 1 },
  upcomingTxt: { fontSize: 8, fontWeight: '700', color: '#FFFFFF30' },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  periodEmoji: { fontSize: 32 },
  periodLabel: { fontSize: 17, fontWeight: '800', color: '#fff' },
  periodLabelDone: { color: '#FFFFFF40' },
  periodTime: { fontSize: 10, color: '#FFFFFF40', fontWeight: '500' },
  expandArrow: { fontSize: 22, color: '#FFFFFF25', fontWeight: '300', paddingLeft: 4 },
  details: {
    marginTop: 14, borderTopWidth: 1, borderTopColor: '#FFFFFF08',
    paddingTop: 14, gap: 10,
  },
  sciRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  sciTitle: { fontSize: 12, fontWeight: '900', marginBottom: 4 },
  sciDesc:  { fontSize: 11, color: '#FFFFFF55', lineHeight: 17 },
  activitiesSection: { gap: 4 },
  activitiesLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5, marginBottom: 4 },
  activityItem: { fontSize: 11, color: '#FFFFFF65', paddingLeft: 8, lineHeight: 18 },
  avoidLabel: { fontSize: 10, fontWeight: '900', color: '#f43f5e99', letterSpacing: 0.5, marginBottom: 4 },
  avoidItem: { fontSize: 11, color: '#FFFFFF35', paddingLeft: 8, lineHeight: 18 },
  progressRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 },
});

const CP = StyleSheet.create({
  card: {
    marginHorizontal: 16, marginTop: 8, borderRadius: 24, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.60)',
    backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden', padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.44, shadowRadius: 32, elevation: 16,
  },
  badgeRow:    { flexDirection: 'row', gap: 8, marginBottom: 16 },
  doshaBadge:  { borderRadius: 99, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 4 },
  doshaTxt:    { fontSize: 8, fontWeight: '900', letterSpacing: 1.8 },
  activeBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 99, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 4 },
  activeDotB:  { width: 6, height: 6, borderRadius: 3 },
  activeTxtB:  { fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  nameRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  emoji:       { fontSize: 44 },
  name:        { fontSize: 16, fontWeight: '900', lineHeight: 21 },
  engLabel:    { fontSize: 10, fontWeight: '700', marginTop: 1 },
  sciSub:      { fontSize: 10, color: '#FFFFFF90', fontWeight: '600', marginTop: 2 },
  exploreBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, marginTop: 4 },
  exploreTxt:  { fontSize: 12, fontWeight: '900', flex: 1 },
  exploreArrow:{ fontSize: 14, fontWeight: '900' },
  exploreChevron: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  exploreTapHint: { fontSize: 8, fontWeight: '700', letterSpacing: 0.5, marginTop: 2 },
  countdown:   { fontSize: 15, fontWeight: '900' },
  timeRange:   { fontSize: 10, color: '#FFFFFF85', textAlign: 'right', marginTop: 2 },
  progressTrack: { height: 3, borderRadius: 2, backgroundColor: '#FFFFFF10', marginBottom: 16, overflow: 'hidden' },
  progressFill:  { height: 3, borderRadius: 2 },
  sciDesc:     { fontSize: 12, color: '#FFFFFFA0', lineHeight: 19, marginBottom: 4 },
  divider:     { height: 1, backgroundColor: '#FFFFFF08', marginVertical: 12 },
  secLabel:    { fontSize: 9, fontWeight: '900', letterSpacing: 1.6, marginBottom: 10 },
  avoidSecLabel: { fontSize: 9, fontWeight: '900', color: '#f43f5e80', letterSpacing: 1.6, marginBottom: 10 },
  listGrid:    { gap: 7 },
  listItem:    { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  listDot:     { width: 5, height: 5, borderRadius: 3, marginTop: 6 },
  listTxt:     { fontSize: 12, color: '#FFFFFFAA', lineHeight: 19, flex: 1 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  sectionBadge:    { borderWidth: 1, borderRadius: 8, paddingHorizontal: 11, paddingVertical: 4 },
  sectionBadgeTxt: { fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  sectionLine:     { flex: 1, height: 1 },
  doCard:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  doCheck:  { fontSize: 13, fontWeight: '900', marginTop: 1 },
  doTxt:    { fontSize: 12, color: '#FFFFFFBB', lineHeight: 18, flex: 1 },
  dontCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  dontX:    { fontSize: 13, fontWeight: '900', color: '#f43f5e', marginTop: 1 },
  dontTxt:  { fontSize: 12, color: '#FFFFFFA0', lineHeight: 18, flex: 1 },
});

const NP = StyleSheet.create({
  card: {
    marginHorizontal: 16, marginTop: 6, borderRadius: 22, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.60)',
    backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden',
    paddingVertical: 16, paddingRight: 16, flexDirection: 'row',
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.40, shadowRadius: 28, elevation: 14,
  },
  sideBar:       { width: 3, borderRadius: 2, marginLeft: 4 },
  headerRow:     { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 },
  sectionTag:    { fontSize: 8, fontWeight: '900', color: '#FFFFFF90', letterSpacing: 1.8 },
  countdownBox:  { alignItems: 'flex-end', gap: 1 },
  countdownLabel:{ fontSize: 7, fontWeight: '900', color: '#FFFFFF80', letterSpacing: 1.5 },
  countdownTime: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  identityRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  bigEmoji:      { fontSize: 32 },
  periodTitle:   { fontSize: 16, fontWeight: '900', color: '#fff', lineHeight: 21 },
  periodAyur:    { fontSize: 10, fontWeight: '700', marginTop: 2 },
  doshaPill:     { borderRadius: 99, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  doshaPillTxt:  { fontSize: 8, fontWeight: '900', letterSpacing: 1.6 },
  sciTitle:      { fontSize: 10, color: '#FFFFFF88', fontWeight: '600', marginBottom: 10 },
  shiftBox:      { borderWidth: 1, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.09)', padding: 11, marginBottom: 10 },
  shiftLabel:    { fontSize: 8, fontWeight: '900', letterSpacing: 1.4, marginBottom: 5 },
  shiftText:     { fontSize: 11, color: '#FFFFFFA0', lineHeight: 17 },
  prepSection:   { gap: 5, marginBottom: 10 },
  prepLabel:     { fontSize: 8, fontWeight: '900', color: '#FFFFFF88', letterSpacing: 1.5, marginBottom: 2 },
  prepRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  prepDot:       { width: 4, height: 4, borderRadius: 2, marginTop: 6 },
  prepText:      { fontSize: 11, color: '#FFFFFF90', lineHeight: 17, flex: 1 },
  timeRange:     { fontSize: 10, color: '#FFFFFF80', fontWeight: '600' },
});

const PC = StyleSheet.create({
  card: {
    marginHorizontal: 16, marginTop: 10, borderRadius: 22, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.60)',
    backgroundColor: 'rgba(255,255,255,0.08)', flexDirection: 'row', overflow: 'hidden',
    paddingVertical: 16, paddingRight: 16,
    shadowColor: '#60a5fa', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.36, shadowRadius: 30, elevation: 14,
  },
  sideBar:         { width: 4, borderRadius: 2, marginLeft: 4 },
  headerRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTag:      { fontSize: 8, fontWeight: '900', color: '#FFFFFF25', letterSpacing: 1.5 },
  arrow:           { fontSize: 20, color: '#FFFFFF25', fontWeight: '200' },
  scorePill:       { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 4 },
  scoreNum:        { fontSize: 12, fontWeight: '900' },
  scoreLabel:      { fontSize: 9, fontWeight: '700' },
  moonBanner:      { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 12 },
  moonBannerTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5, marginBottom: 2 },
  moonBannerSub:   { fontSize: 10, color: '#FFFFFF60', lineHeight: 15 },
  energyRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  energyTitle:     { fontSize: 15, fontWeight: '900', lineHeight: 21 },
  energySub:       { fontSize: 10, color: '#FFFFFF40', marginTop: 3 },
  actionBox:       { backgroundColor: 'rgba(255,255,255,0.11)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', padding: 12, marginBottom: 10 },
  actionLabel:     { fontSize: 8, fontWeight: '900', color: '#FFFFFF30', letterSpacing: 1.5, marginBottom: 5 },
  actionText:      { fontSize: 12, fontWeight: '600', color: '#FFFFFFCC', lineHeight: 18 },
  alignRow:        { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
  alignDot:        { width: 6, height: 6, borderRadius: 3, marginTop: 5 },
  alignText:       { flex: 1, fontSize: 11, lineHeight: 17 },
  ritualRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: 'rgba(255,255,255,0.09)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', padding: 12 },
  ritualPrompt:    { fontSize: 9, fontWeight: '800', color: '#FFFFFF35', letterSpacing: 0.5, marginBottom: 3 },
  ritualText:      { fontSize: 11, color: '#FFFFFF65', lineHeight: 17, fontStyle: 'italic' },
  expandedSection: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#FFFFFF08', paddingTop: 12, gap: 12 },
  triRow:          { flexDirection: 'row', gap: 8 },
  triCell:         { flex: 1, borderWidth: 1, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.10)', borderColor: 'rgba(255,255,255,0.18)', padding: 11, gap: 3 },
  triEmoji:        { fontSize: 20, marginBottom: 4 },
  triTitle:        { fontSize: 12, fontWeight: '900' },
  triSub:          { fontSize: 9, color: '#FFFFFF50', lineHeight: 14 },
  triEn:           { fontSize: 8, color: '#FFFFFF25', fontWeight: '500', marginTop: 3 },
  infoNote:        { backgroundColor: '#60a5fa08', borderWidth: 1, borderColor: '#60a5fa18', borderRadius: 14, padding: 12 },
  infoNoteText:    { fontSize: 10, color: '#60a5fa65', lineHeight: 15 },
  biRow:           { flexDirection: 'row', gap: 8, marginBottom: 10, marginTop: 2 },
  biCell:          { flex: 1, borderWidth: 1, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.10)', borderColor: 'rgba(255,255,255,0.18)', padding: 10, gap: 3 },
  biTag:           { fontSize: 7, fontWeight: '900', color: '#FFFFFF25', letterSpacing: 1.2, marginBottom: 2 },
  biSanskrit:      { fontSize: 13, fontWeight: '900' },
  biEnglish:       { fontSize: 9, color: '#FFFFFF45', fontWeight: '500' },
  exploreBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, marginTop: 10, marginBottom: 2 },
  exploreTxt:      { fontSize: 12, fontWeight: '800', flex: 1 },
  exploreArrow:    { fontSize: 16, fontWeight: '800' },
});

const EX = StyleSheet.create({
  overlay:       { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,10,0.75)' },
  sheet:         { backgroundColor: '#090916', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '93%', paddingHorizontal: 18, overflow: 'hidden' },
  handle:        { width: 44, height: 4, borderRadius: 2, backgroundColor: '#FFFFFF30', alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  sheetHeader:   { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#FFFFFF12', marginBottom: 16 },
  sheetCap:      { fontSize: 8, fontWeight: '900', color: '#FFFFFF80', letterSpacing: 2.2, marginBottom: 4 },
  sheetTitle:    { fontSize: 24, fontWeight: '900', color: '#fff', lineHeight: 30 },
  sheetSub:      { fontSize: 10, color: '#FFFFFF60', fontWeight: '600', marginTop: 3 },
  closeBtn:      { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: '#FFFFFF25', backgroundColor: '#FFFFFF0A', alignItems: 'center', justifyContent: 'center' },
  closeTxt:      { color: '#FFFFFF80', fontSize: 13, fontWeight: '700' },
  introBox:      { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', padding: 16, marginBottom: 16 },
  introText:     { fontSize: 13, color: '#FFFFFFB0', lineHeight: 21 },
  activePill:    { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16 },
  activeDot:     { width: 9, height: 9, borderRadius: 4.5 },
  activeTxt:     { fontSize: 13, fontWeight: '900' },
  timelineCard:  { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 16, marginBottom: 16 },
  timelineLabel: { fontSize: 8, fontWeight: '900', color: '#FFFFFF70', letterSpacing: 2.0, marginBottom: 12 },
  timelineBar:   { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden' },
  dCard:         { borderWidth: 1, borderRadius: 20, padding: 16, marginBottom: 12, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.03)' },
  dCardHeader:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dEmojiBox:     { width: 56, height: 56, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  expandIcon:    { width: 30, height: 30, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  dName:         { fontSize: 20, fontWeight: '900', lineHeight: 26 },
  dSanskrit:     { fontSize: 16, fontWeight: '700' },
  nowBadge:      { flexDirection: 'row', alignItems: 'center', borderRadius: 99, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  nowTxt:        { fontSize: 7, fontWeight: '900', letterSpacing: 1.5 },
  dElements:     { fontSize: 11, color: '#FFFFFF60', fontWeight: '600', marginTop: 2 },
  dTagline:      { fontSize: 12, fontWeight: '700', marginTop: 4, lineHeight: 17 },
  sciBlock:      { borderWidth: 1, borderRadius: 16, padding: 14, backgroundColor: 'rgba(255,255,255,0.06)' },
  sciBlockTitle: { fontSize: 13, fontWeight: '900' },
  sciBlockBody:  { fontSize: 12, color: '#FFFFFFA8', lineHeight: 20 },
  secHead:       { fontSize: 8, fontWeight: '900', letterSpacing: 1.6 },
  biochemChip:   { borderWidth: 1, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 7 },
  funcGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  funcCell:      { flexDirection: 'row', alignItems: 'flex-start', gap: 7, borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, width: '48.5%' },
  funcDot:       { width: 5, height: 5, borderRadius: 2.5, marginTop: 4, flexShrink: 0 },
  funcTxt:       { fontSize: 10, color: '#FFFFFFB8', lineHeight: 15, flex: 1 },
  peakBar:       { height: 8, backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  peakTime:      { fontSize: 14, fontWeight: '900', marginBottom: 6 },
  imbalRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 9, backgroundColor: 'rgba(244,63,94,0.07)', borderWidth: 1, borderColor: 'rgba(244,63,94,0.22)', borderRadius: 13, paddingHorizontal: 12, paddingVertical: 9 },
  imbalTxt:      { fontSize: 12, color: '#FFFFFF95', lineHeight: 18, flex: 1 },
  balRow:        { flexDirection: 'row', alignItems: 'flex-start', gap: 9, backgroundColor: 'rgba(16,185,129,0.07)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.22)', borderRadius: 13, paddingHorizontal: 12, paddingVertical: 9 },
  balIcon:       { width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(16,185,129,0.22)', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  balTxt:        { fontSize: 12, color: '#FFFFFF95', lineHeight: 18, flex: 1 },
  neuRow:        { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', padding: 12 },
  neuLabel:      { fontSize: 7, fontWeight: '900', color: '#FFFFFF60', letterSpacing: 1.5, marginBottom: 4 },
  neuVal:        { fontSize: 13, fontWeight: '800' },
  imbalHead:     { fontSize: 8, fontWeight: '900', color: '#f43f5e80', letterSpacing: 1.5, marginBottom: 8 },
  listRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 5 },
  dot:           { width: 5, height: 5, borderRadius: 3, marginTop: 6 },
  listTxt:       { fontSize: 12, color: '#FFFFFFA8', lineHeight: 18, flex: 1 },
  footerNote:    { backgroundColor: 'rgba(96,165,250,0.06)', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(96,165,250,0.22)', padding: 16, marginTop: 8 },
  footerTxt:     { fontSize: 12, color: '#FFFFFF80', lineHeight: 19 },
  cosmoHero:     { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', padding: 18, marginBottom: 18 },
  cosmoTitle:    { fontSize: 18, fontWeight: '900', color: '#fff', marginBottom: 3 },
  cosmoSub:      { fontSize: 12, color: '#60a5faDD', fontWeight: '700', marginBottom: 2 },
  cosmoSub2:     { fontSize: 12, color: '#fbbf24BB', fontWeight: '700' },
  exploreSection:      { marginBottom: 18 },
  exploreSectionTitle: { fontSize: 17, fontWeight: '900', color: '#fff', marginBottom: 3 },
  exploreSectionSub:   { fontSize: 10, color: '#FFFFFF70', fontWeight: '700', letterSpacing: 1.2, marginBottom: 8 },
  highlightPill:       { borderWidth: 1, borderRadius: 16, padding: 14, marginTop: 10 },
  highlightPillText:   { fontSize: 13, color: '#FFFFFF90', lineHeight: 20 },
});

const BMX = StyleSheet.create({
  card: {
    marginHorizontal: 16, marginTop: 6, borderRadius: 20, borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.40)', backgroundColor: 'rgba(96,165,250,0.16)', padding: 16, overflow: 'hidden',
    shadowColor: '#60a5fa', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.34, shadowRadius: 24, elevation: 12,
  },
  headerRow:   { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 },
  sacredLabel: { fontSize: 8, fontWeight: '900', color: '#60a5fa60', letterSpacing: 1.5, marginBottom: 4 },
  sacredTimes: { fontSize: 15, fontWeight: '800', color: '#60a5faDD' },
  sacredSub:   { fontSize: 9, color: '#60a5fa50', marginTop: 3 },
  notifTxt:    { fontSize: 8, color: '#FFFFFF35', fontWeight: '700' },
  sciRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#FFFFFF08' },
  sciToggleTxt: { fontSize: 11, color: '#60a5fa80', fontWeight: '700' },
  aliasRow:    { flexDirection: 'row', gap: 10, paddingVertical: 9, alignItems: 'flex-start' },
  aliasTitle:  { fontSize: 11, fontWeight: '800', color: '#60a5fa', marginBottom: 3 },
  aliasDesc:   { fontSize: 10, color: '#FFFFFF45', lineHeight: 15 },
});

const PRH = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    backgroundColor: 'rgba(255,255,255,0.07)',
    padding: 9,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.34,
    shadowRadius: 16,
    elevation: 8,
  },
});

const MSB = StyleSheet.create({
  bar: {
    marginHorizontal: 16, marginTop: 10, marginBottom: 2,
    borderRadius: 18, borderWidth: 1, borderColor: 'rgba(245,130,10,0.70)',
    backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden',
    paddingHorizontal: 14, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center',
    shadowColor: ACCENT, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.38, shadowRadius: 24, elevation: 12,
  },
  title: { fontSize: 13, fontWeight: '800', color: '#FFFFFFCC', lineHeight: 19 },
  sub:   { fontSize: 10, color: '#FFFFFF40', fontWeight: '500', marginTop: 1 },
});

const CPL = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.60)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 9,
    gap: 11,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.36, shadowRadius: 22, elevation: 12,
  },
  star:     { position: 'absolute', borderRadius: 50, backgroundColor: '#FFFFFF' },
  title:    { fontSize: 12, fontWeight: '900', letterSpacing: 0.2 },
  sep:      { width: 3, height: 3, borderRadius: 2 },
  meta:     { fontSize: 9,  fontWeight: '600', color: '#FFFFFF55', flex: 1 },
  cta:      { fontSize: 9,  fontWeight: '700', color: '#FFFFFF38', letterSpacing: 0.3, marginTop: 2 },
  badge:    { width: 26, height: 26, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  badgeTxt: { fontSize: 16, fontWeight: '700', marginTop: -1 },
});

const TH = StyleSheet.create({
  card: {
    marginHorizontal: 16, marginTop: 8, marginBottom: 4,
    borderRadius: 24,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.62)',
    backgroundColor: 'rgba(255,255,255,0.09)',
    overflow: 'hidden',
    shadowColor: '#60a5fa',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.46,
    shadowRadius: 44,
    elevation: 24,
  },
  topHighlight: { height: 1, backgroundColor: 'rgba(255,255,255,0.35)', width: '100%' },
  headerRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 0 },
  headerLabel: { fontSize: 8, fontWeight: '900', color: '#FFFFFF30', letterSpacing: 1.8 },
  headerSub:   { fontSize: 9, fontWeight: '600', marginTop: 2 },
  arrow:       { fontSize: 16, color: '#FFFFFF25', paddingLeft: 8 },
  divider:     { height: 1, backgroundColor: '#FFFFFF12', marginVertical: 12 },
  dot:         { color: '#FFFFFF25' },
  cosmicRow:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cosmicLine1: { fontSize: 13, fontWeight: '700', color: '#FFFFFFAA', lineHeight: 19, marginBottom: 3 },
  cosmicLine2: { fontSize: 9,  fontWeight: '500', color: '#FFFFFF45', lineHeight: 14 },
  starDot:     { position: 'absolute', borderRadius: 50, backgroundColor: '#FFFFFF' },
  energyRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 2 },
  badge:       { borderWidth: 1, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3 },
  badgeTxt:    { fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  activePill:  { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3 },
  activeDot:   { width: 5, height: 5, borderRadius: 3 },
  activeTxt:   { fontSize: 8, fontWeight: '800', letterSpacing: 0.4 },
  energyName:  { fontSize: 15, fontWeight: '900', color: '#FFFFFFD0', lineHeight: 22 },
  energySci:   { fontSize: 9,  fontWeight: '600', lineHeight: 14 },
  countdown:   { fontSize: 17, fontWeight: '900' },
  timeRange:   { fontSize: 8,  color: '#FFFFFF35', fontWeight: '600' },
  progressTrack: { height: 10, backgroundColor: '#FFFFFF0C', borderRadius: 5, marginTop: 10, overflow: 'hidden' },
  progressFill:  { height: 10, borderRadius: 5 },
  chip:    { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  chipDot: { width: 4, height: 4, borderRadius: 2 },
  chipTxt: { fontSize: 8, color: '#FFFFFF60', fontWeight: '600' },
  weatherBox:  { backgroundColor: 'rgba(255,255,255,0.09)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(96,165,250,0.25)', paddingHorizontal: 12, paddingVertical: 10 },
  weatherRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  wTemp: { fontSize: 18, fontWeight: '900', color: '#FFFFFFDD' },
  wCond: { fontSize: 10, color: '#FFFFFF55', fontWeight: '600', flex: 1 },
  wMax:  { fontSize: 10, fontWeight: '700', color: '#f8717190' },
  wMin:  { fontSize: 10, fontWeight: '700', color: '#60a5fa90' },
  wHum:  { fontSize: 10, fontWeight: '700', color: '#7dd3fc80' },
  wCity: { fontSize: 9,  fontWeight: '600', color: '#FFFFFF30' },
  exploreRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 11, borderTopWidth: 1, borderTopColor: '#FFFFFF12' },
  exploreTxt:  { fontSize: 10, fontWeight: '800', opacity: 0.8 },
  exploreArrow:{ fontSize: 14, fontWeight: '900', opacity: 0.8 },
  moonBanner:      { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 11, marginBottom: 12 },
  moonBannerTitle: { fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  moonBannerSub:   { fontSize: 9, color: '#FFFFFF65', fontWeight: '500', marginTop: 2 },
  vaarEnergyRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 12 },
  vaarEnergyTitle: { fontSize: 13, fontWeight: '900', lineHeight: 18 },
  vaarActionTxt:   { fontSize: 9, color: '#FFFFFF60', fontWeight: '500', lineHeight: 14, marginTop: 2 },
  yogaRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  yogaDot:  { width: 7, height: 7, borderRadius: 4 },
  yogaTxt:  { fontSize: 9, fontWeight: '600', flex: 1, lineHeight: 14 },
  biRow:    { flexDirection: 'row', gap: 8, marginTop: 11 },
  biCell:   { flex: 1, borderWidth: 1, borderRadius: 12, padding: 10, backgroundColor: 'rgba(255,255,255,0.11)', borderColor: 'rgba(255,255,255,0.18)' },
  biTag:    { fontSize: 7, fontWeight: '900', color: '#FFFFFF35', letterSpacing: 0.8, marginBottom: 5 },
  biSanskrit:  { fontSize: 13, fontWeight: '900', lineHeight: 18 },
  biEnglish:   { fontSize: 8, color: '#FFFFFF50', fontWeight: '500', lineHeight: 13, marginTop: 3 },
  ritualRow:    { marginTop: 11, padding: 11, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.09)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  ritualPrompt: { fontSize: 8, fontWeight: '800', color: '#FFFFFF40', letterSpacing: 0.6, marginBottom: 4 },
  ritualAction: { fontSize: 10, fontWeight: '600', color: '#FFFFFF80', lineHeight: 16 },
  energySection: { borderTopWidth: 1, paddingHorizontal: 16, paddingVertical: 16, overflow: 'hidden' },
  energySciDesc: { fontSize: 11, color: '#FFFFFF55', lineHeight: 18, fontWeight: '500', marginTop: 10, marginBottom: 12 },
  periodSecLabel: { fontSize: 8, fontWeight: '900', letterSpacing: 1, marginBottom: 7 },
  avoidLabel: { fontSize: 8, fontWeight: '900', color: '#f43f5e70', letterSpacing: 1, marginBottom: 7 },
  engineLabel: { fontSize: 7, fontWeight: '900', color: '#FFFFFF28', letterSpacing: 1.6, marginBottom: 12 },
  impactRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 7, marginTop: 8 },
  impactDot:   { width: 6, height: 6, borderRadius: 3, marginTop: 3 },
  impactTxt:   { fontSize: 9, fontWeight: '700', flex: 1, lineHeight: 14 },
  insightBox:  { borderWidth: 1, borderRadius: 12, padding: 11, marginTop: 4, backgroundColor: 'rgba(255,255,255,0.09)', borderColor: 'rgba(255,255,255,0.18)' },
  insightLabel:{ fontSize: 7, fontWeight: '900', color: '#FFFFFF30', letterSpacing: 1.4, marginBottom: 5 },
  insightTxt:  { fontSize: 10, color: '#FFFFFF65', lineHeight: 16, fontWeight: '500' },
  seasonBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1, borderRadius: 13, padding: 11, marginBottom: 12 },
  seasonName:   { fontSize: 12, fontWeight: '900' },
  seasonSep:    { fontSize: 9, color: '#FFFFFF25', fontWeight: '600' },
  seasonDosha:  { fontSize: 9, fontWeight: '700' },
  seasonZone:   { fontSize: 8, color: '#FFFFFF30', fontWeight: '600' },
  seasonAdvice: { fontSize: 9, color: '#FFFFFF55', lineHeight: 14, fontWeight: '500', marginTop: 3 },
  topIconStrip: { flexDirection: 'row', alignItems: 'stretch', borderBottomWidth: 1, borderBottomColor: '#FFFFFF0C' },
  iconCell:     { flex: 1, alignItems: 'center', paddingVertical: 11, gap: 2 },
  iconSep:      { width: 1, backgroundColor: '#FFFFFF0C', marginVertical: 8 },
  iconEmoji:    { fontSize: 18, marginBottom: 1 },
  iconTime:     { fontSize: 11, fontWeight: '800', color: '#FFFFFFCC' },
  iconLabel:    { fontSize: 8, fontWeight: '600', color: '#FFFFFF40', letterSpacing: 0.3 },
  doTodayLabel: { fontSize: 7, fontWeight: '900', color: '#FFFFFF25', letterSpacing: 1.4, marginBottom: 4 },
  doTodayTxt:   { fontSize: 11, fontWeight: '600', color: '#FFFFFF70', lineHeight: 16 },
  cosmicPill:   { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4 },
  cosmicPillTxt:{ fontSize: 9, fontWeight: '700' },
  solarStrip:   { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#FFFFFF09' },
  solarItem:    { fontSize: 10, fontWeight: '700', color: '#FFFFFF55' },
  solarSep:     { fontSize: 9, color: '#FFFFFF20', fontWeight: '600' },
  contextBar:   { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  ctxPill:      { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  ctxPillTxt:   { fontSize: 9, fontWeight: '800' },
  ctxDot:       { fontSize: 9, color: '#FFFFFF20', fontWeight: '600' },
  ctxWeather:   { fontSize: 10, color: '#FFFFFF60', fontWeight: '600' },
  ctxRange:     { fontSize: 9, color: '#FFFFFF35', fontWeight: '600' },
});

const IW = StyleSheet.create({
  card: {
    marginHorizontal: 16, marginTop: 6, borderRadius: 18, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.60)',
    backgroundColor: 'rgba(255,255,255,0.08)', flexDirection: 'row', overflow: 'hidden',
    paddingVertical: 12, paddingRight: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.38, shadowRadius: 24, elevation: 12,
  },
  leftBar:  { width: 3, borderRadius: 2, marginLeft: 4 },
  label:    { fontSize: 7, fontWeight: '900', color: '#FFFFFF25', letterSpacing: 1.6, marginBottom: 5 },
  title:    { fontSize: 13, fontWeight: '900', flex: 1, lineHeight: 18 },
  tipChip:  { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
});
