import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Switch, ImageBackground, ActivityIndicator, Modal, Dimensions,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { store, KEYS } from '@/lib/storage';
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

  if (isPartly && pleasant) return { icon: '⛅', color: '#a78bfa', title: 'Pleasant Weather',
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
  if ([2,3].includes(code) && temp >= 20) return { icon: '⛅', tip: 'Partly cloudy — comfortable',  color: '#a78bfa' };
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
  if ([2,3].includes(code) && temp >= 20) return { icon: '⛅', color: '#a78bfa', title: 'Comfortable Outside',      tips: ['🏃 Great for any outdoor activity', '👕 Light clothing is enough', '🌳 Step outside & move', '☺️ Enjoy the natural breeze', '🌤️ Good hour to be outside'] };
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
  10: { label: 'Cosmic Peak',   color: '#a78bfa', emoji: '⚡' },
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
          <View style={[PC.moonBanner, { borderColor: moon.emoji === '🌕' ? '#fbbf2440' : '#a78bfa40', backgroundColor: moon.emoji === '🌕' ? '#fbbf2408' : '#a78bfa08' }]}>
            <Text style={{ fontSize: 18 }}>{moon.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[PC.moonBannerTitle, { color: moon.emoji === '🌕' ? '#fbbf24' : '#a78bfa' }]}>
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
          <View style={[PC.biCell, { borderColor: '#a78bfa20' }]}>
            <Text style={PC.biTag}>🌙 TITHI  ·  लुनर दिन</Text>
            <Text style={[PC.biSanskrit, { color: '#a78bfa' }]}>{p.tithiName}</Text>
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
              <View style={[PC.triCell, { borderColor: '#a78bfa22' }]}>
                <Text style={PC.triEmoji}>🌙</Text>
                <Text style={[PC.triTitle, { color: '#a78bfa' }]}>{p.tithiName}</Text>
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
          <Text style={[PC.exploreTxt, { color: vaar.color }]}>🌌  Explore Cosmic Science — Moon, Tithi, Nakshatra</Text>
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
    { emoji: '🌙',             label: p.tithiName,      sub: p.paksha + ' Paksha',             color: '#a78bfa'   },
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
      <Text style={{ fontSize: 8, fontWeight: '900', color: '#FFFFFF22', letterSpacing: 1.8, marginLeft: 20, marginBottom: 7 }}>
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
            <Text style={{ fontSize: 10, fontWeight: '800', color: item.color, textAlign: 'center', lineHeight: 13 }} numberOfLines={1}>{item.label}</Text>
            <Text style={{ fontSize: 8, color: '#FFFFFF40', fontWeight: '600', textAlign: 'center', lineHeight: 11 }} numberOfLines={1}>{item.sub}</Text>
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
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
            {daily.map((day, i) => {
              const sugg = getWeatherSuggestion(day.weatherCode, day.maxTemp, 60);
              return (
                <View key={i} style={[SD.dayRow, i > 0 && SD.dayRowBorder]}>
                  <View style={SD.dayLeft}>
                    <Text style={[SD.dayLabel, i === 0 && { color: ACCENT }]}>{day.dayLabel}</Text>
                    <Text style={SD.dayDate}>{day.date.slice(5).replace('-', ' / ')}</Text>
                  </View>
                  <Text style={SD.dayEmoji}>{day.emoji}</Text>
                  <View style={SD.dayMid}>
                    <Text style={SD.dayCond}>{day.condition}</Text>
                    {day.precipitation > 0 && <Text style={SD.dayPrec}>💧 {day.precipitation} mm</Text>}
                  </View>
                  <View style={SD.dayTemps}>
                    <Text style={SD.dayMax}>{day.maxTemp}°</Text>
                    <Text style={SD.dayMin}>{day.minTemp}°</Text>
                  </View>
                  <View style={[SD.suggDot, { backgroundColor: sugg.color }]} />
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
            colors={['#a78bfa1E', 'transparent']}
            start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 130, borderTopLeftRadius: 28, borderTopRightRadius: 28 }}
            pointerEvents="none"
          />
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: '#a78bfa70', borderTopLeftRadius: 28, borderTopRightRadius: 28 }} />
          <View style={EX.handle} />
          {/* Header */}
          <View style={EX.sheetHeader}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#a78bfa' }} />
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
              <View style={[EX.sciBlock, { borderColor: '#a78bfa25', marginTop: 8 }]}>
                <Text style={[EX.sciBlockTitle, { color: '#a78bfa' }]}>Chronobiology Research</Text>
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
              <View style={[EX.highlightPill, { borderColor: '#a78bfa30', backgroundColor: '#a78bfa0C' }]}>
                <Text style={EX.highlightPillText}>
                  Today: <Text style={{ color: '#a78bfaDD', fontWeight: '800' }}>{p.tithiName}</Text> — {p.paksha === 'Shukla' ? 'Waxing phase · Build, grow, take in' : 'Waning phase · Release, detox, reduce'}
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
      <LinearGradient colors={['rgba(167,139,250,0.22)','rgba(167,139,250,0.08)','transparent']} start={{x:0,y:0}} end={{x:0,y:1}} style={StyleSheet.absoluteFillObject} />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.32)' }} />
      <View style={BMX.headerRow}>
        <View>
          <Text style={BMX.sacredLabel}>SACRED WINDOW</Text>
          <Text style={BMX.sacredTimes}>{info.startLabel}  →  {info.endLabel}</Text>
          <Text style={BMX.sacredSub}>96–48 min before sunrise</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(167,139,250,0.20)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.50)', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6 }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#a78bfa' }} />
          <Text style={{ fontSize: 9, fontWeight: '900', color: '#a78bfa', letterSpacing: 1.5 }}>LIVE</Text>
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
    name: 'Autumn', emoji: '🍂', color: '#a78bfa', doshaAffinity: 'Vata',
    zone,
    sciDesc: 'Autumn\'s dry, cool, erratic winds up-regulate sympathetic nervous system tone. Shortened daylight reduces serotonin synthesis and disrupts the melatonin-cortisol circadian axis. The Pitta-to-Vata seasonal transition creates a systemic neural volatility surge.',
    advice: 'A fixed daily routine (Dinacharya) is the single most powerful Vata stabiliser. Warm sesame Abhyanga grounds the sympathetic nervous system. Root vegetables, warming spices and warm oils counter the drying season.',
  };
  return {
    name: 'Winter', emoji: '❄️', color: '#818cf8', doshaAffinity: 'Vata-Kapha',
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
              <Text style={{ color: '#a78bfa70', fontWeight: '800' }}>{vMonth.name}  </Text>
              <Text style={{ color: '#FFFFFF28' }}>{dateLabel}  ·  {clockStr}</Text>
            </Text>
          </View>
        </View>

        <View style={TH.divider} />

        {/* Special moon banner */}
        {isSpecialMoon && (
          <View style={[TH.moonBanner, {
            borderColor: moon.emoji === '🌕' ? '#fbbf2440' : '#a78bfa40',
            backgroundColor: moon.emoji === '🌕' ? '#fbbf2408' : '#a78bfa08',
          }]}>
            <Text style={{ fontSize: 18 }}>{moon.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[TH.moonBannerTitle, { color: moon.emoji === '🌕' ? '#fbbf24' : '#a78bfa' }]}>
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
          <View style={[TH.cosmicPill, { borderColor: '#a78bfa55', backgroundColor: '#a78bfa18' }]}>
            <Text style={{ fontSize: 9 }}>🌙</Text>
            <Text style={[TH.cosmicPillTxt, { color: '#a78bfaCC' }]}>{p.tithiName}</Text>
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
        colors={[vaar.color + '28', '#a78bfa18', 'transparent']}
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
            <Text style={{ fontSize: 9, color: '#a78bfaCC', fontWeight: '800', lineHeight: 13 }}>{p.tithiName}</Text>
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
            <Text style={{ fontSize: 9, color: '#a78bfaCC', fontWeight: '800', lineHeight: 13 }}>{p.paksha}</Text>
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
          showsVerticalScrollIndicator={false}>
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

const HES_SCROLL_SPEED = 0.42; // px per animation frame — gentle, unbroken, peaceful glide

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
        onPress={() => router.push({ pathname: '/dosha-explore' as never, params: { activeDosha: period.dosha, periodLabel: period.label, periodStart: period.startLabel, periodEnd: period.endLabel } } as never)}
        activeOpacity={0.75}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
          <View>
            <Text style={{ fontSize: 17, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.2, lineHeight: 22 }}>{period.englishLabel}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5, alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: '#D4A84B60', backgroundColor: '#D4A84B1A' }}>
              <Text style={{ fontSize: 11 }}>⚗️</Text>
              <Text style={{ fontSize: 9, color: '#D4A84B', fontWeight: '900', letterSpacing: 0.8 }}>EXPLORE SCIENCE</Text>
              <View style={{ width: 15, height: 15, borderRadius: 8, backgroundColor: '#D4A84B35', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 9, color: '#D4A84B', fontWeight: '900', lineHeight: 11 }}>↗</Text>
              </View>
            </View>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 0 }}>
          <Text style={{ fontSize: 28, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5, lineHeight: 33 }}>{remStr}</Text>
          <Text style={{ fontSize: 12, fontWeight: '800', color: period.color, letterSpacing: 0.4 }}>remaining</Text>
          <Text style={{ fontSize: 11, fontWeight: '600', color: '#FFFFFF55', letterSpacing: 0.4, marginTop: 2 }}>{period.startLabel} → {period.endLabel}</Text>
        </View>
      </TouchableOpacity>

      <View>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingRight: 24 }}
        decelerationRate="fast"
        snapToInterval={178}
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
            <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: card.color + '55', backgroundColor: card.color + '20', marginBottom: 9 }}>
              <Text style={{ fontSize: 8, fontWeight: '900', color: card.color, letterSpacing: 1.2 }}>{card.label}</Text>
            </View>
            {/* Emoji icon */}
            <Text style={{ fontSize: 26, marginBottom: 7 }}>{card.emoji}</Text>
            <Text style={{ fontSize: 13, fontWeight: '800', color: '#FFFFFF', lineHeight: 18, marginBottom: 7 }}>{card.title}</Text>
            <View style={{ height: 1, backgroundColor: card.color + '50', marginBottom: 7 }} />
            {card.tips.map((tip, j) => (
              <View key={j} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 4 }}>
                <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: card.color + 'DD', marginTop: 4, flexShrink: 0 }} />
                <Text style={{ fontSize: 10, color: '#FFFFFFDC', lineHeight: 15, flex: 1 }}>{tip}</Text>
              </View>
            ))}
            <View style={{ position: 'absolute', bottom: 9, right: 10 }}>
              <Text style={{ fontSize: 8, color: card.color + '80', fontWeight: '800', letterSpacing: 0.5 }}>expand ↗</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
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
    width: 168,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.62)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    padding: 13,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.40,
    shadowRadius: 26,
    elevation: 14,
  },
});

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
  temp:  { fontSize: 16, fontWeight: '900', color: '#FFFFFFDD' },
  cond:  { fontSize: 12, color: '#FFFFFF55', fontWeight: '500', flexShrink: 1 },
  sep:   { fontSize: 12, color: '#FFFFFF20' },
  city:  { fontSize: 12, color: '#FFFFFF30', fontWeight: '500', flexShrink: 1 },
  spacer:{ flex: 1 },
  hum:   { fontSize: 11, color: '#7dd3fc80', fontWeight: '700' },
  hi:    { fontSize: 11, color: '#f87171AA', fontWeight: '700' },
  lo:    { fontSize: 11, color: '#60a5faAA', fontWeight: '700' },
});

// ══════════════════════════════════════════════════════════════════════════════
// Cosmic Orbit Strip — unified solar ephemeris · lunar phase · cosmic almanac
// ══════════════════════════════════════════════════════════════════════════════
function CosmicOrbitStrip({
  solarTimes,
  onCosmicPress,
}: {
  solarTimes: SolarTimes | null;
  onCosmicPress: () => void;
}) {
  const moon      = React.useMemo(() => getMoonPhase(new Date()), []);
  const p         = React.useMemo(() => getPanchangData(), []);
  const vaar      = VAARS[p.vaarIdx];
  const nakshatra = NAKSHATRAS[p.nakshatraIdx];

  const now  = new Date();
  const curH = now.getHours() + now.getMinutes() / 60;
  let SunIcon: React.ComponentType<{ size?: number }> = NoonSunSVG;
  if (solarTimes) {
    if (curH <= solarTimes.sunrise + 0.75)     SunIcon = RisingSunSVG;
    else if (curH >= solarTimes.sunset - 0.75) SunIcon = SettingSunSVG;
    else                                        SunIcon = NoonSunSVG;
  }

  return (
    <View style={COS.card}>
      <LinearGradient
        colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.01)']}
        start={{ x: 0, y: 0 }} end={{ x: 0.65, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <LinearGradient
        colors={[vaar.color + '14', 'transparent']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={COS.topLine} />
      <GlassPulseOverlay />

      {/* ── Row 1 : Solar arc + Lunar phase ── */}
      <View style={COS.row1}>
        <SunIcon size={36} />

        {solarTimes ? (
          <>
            <View style={COS.vSep} />
            <View style={COS.sCell}>
              <Text style={COS.sTime}>{fmtSolar(solarTimes.sunrise)}</Text>
              <Text style={COS.sLbl}>Sunrise</Text>
            </View>
            <View style={COS.vSep} />
            <View style={COS.sCell}>
              <Text style={[COS.sTime, { color: '#fbbf24DD' }]}>{fmtSolar(solarTimes.solarNoon)}</Text>
              <Text style={COS.sLbl}>Solar Zenith</Text>
            </View>
            <View style={COS.vSep} />
            <View style={COS.sCell}>
              <Text style={COS.sTime}>{fmtSolar(solarTimes.sunset)}</Text>
              <Text style={COS.sLbl}>Sunset</Text>
            </View>
          </>
        ) : (
          <>
            <View style={COS.vSep} />
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={COS.sLbl}>Activate GPS  ·  Solar Ephemeris Pending</Text>
            </View>
          </>
        )}

        <View style={COS.vSep} />
        <View style={COS.moonWrap}>
          <MoonSVG tithiNum={moon.tithiNum} size={30} />
          <View style={{ marginLeft: 6 }}>
            <Text style={COS.sTime}>{moon.illumination}%</Text>
            <Text style={COS.sLbl}>Lunar Phase</Text>
          </View>
        </View>
      </View>

      {/* ── Divider ── */}
      <View style={COS.hDiv} />

      {/* ── Row 2 : Cosmic almanac + CTA ── */}
      <View style={COS.row2}>
        <View style={[COS.starDot, { top: 5,  right: 80,  width: 1.5, height: 1.5, opacity: 0.38 }]} />
        <View style={[COS.starDot, { top: 12, right: 118, width: 1,   height: 1,   opacity: 0.22 }]} />

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 }}>
            <Text style={[COS.regent, { color: vaar.color }]}>✦  {vaar.planet} Regent</Text>
            <View style={[COS.dot3, { backgroundColor: vaar.color + '55' }]} />
            <Text style={COS.cMeta} numberOfLines={1}>{p.tithiName}  ·  {nakshatra.name}</Text>
          </View>
          <Text style={COS.cSub}>{p.paksha} Paksha  ·  Stellar almanac active</Text>
        </View>

        <TouchableOpacity
          onPress={onCosmicPress}
          activeOpacity={0.76}
          style={[COS.ctaBtn, { borderColor: vaar.color + '60', backgroundColor: vaar.color + '1A' }]}
        >
          <Text style={[COS.ctaTxt, { color: vaar.color }]}>Cosmic{"\n"}Field  ›</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const COS = StyleSheet.create({
  card: {
    marginHorizontal: 16, marginTop: 6, marginBottom: 8,
    borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.28, shadowRadius: 18, elevation: 10,
  },
  topLine:  { height: 1, backgroundColor: 'rgba(255,255,255,0.42)' },
  row1:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8 },
  row2:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9 },
  hDiv:     { height: 1, backgroundColor: 'rgba(255,255,255,0.09)', marginHorizontal: 8 },
  vSep:     { width: 1, height: 26, backgroundColor: 'rgba(255,255,255,0.11)', marginHorizontal: 5 },
  sCell:    { flex: 1, alignItems: 'center' },
  sTime:    { fontSize: 11, fontWeight: '800', color: '#FFFFFFCC', letterSpacing: 0.1 },
  sLbl:     { fontSize: 7, fontWeight: '700', color: '#FFFFFF45', letterSpacing: 0.7, marginTop: 2, textTransform: 'uppercase' },
  moonWrap: { flexDirection: 'row', alignItems: 'center', paddingLeft: 3 },
  regent:   { fontSize: 12, fontWeight: '900', letterSpacing: 0.2 },
  dot3:     { width: 3, height: 3, borderRadius: 2 },
  cMeta:    { fontSize: 9, fontWeight: '600', color: '#FFFFFF55', flex: 1 },
  cSub:     { fontSize: 8, fontWeight: '500', color: '#FFFFFF30', letterSpacing: 0.3 },
  ctaBtn:   { borderWidth: 1, borderRadius: 11, paddingHorizontal: 11, paddingVertical: 7, alignItems: 'center', minWidth: 66 },
  ctaTxt:   { fontSize: 9, fontWeight: '900', letterSpacing: 0.5, textAlign: 'center', lineHeight: 13 },
  starDot:  { position: 'absolute', borderRadius: 50, backgroundColor: '#FFFFFF' },
});

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
  const nextPeriod = periods.filter(x => x.status === 'upcoming').sort((a, b) => a.minutesUntil - b.minutesUntil)[0] ?? null;
  const hh = liveClock.getHours();
  const mm = liveClock.getMinutes();

  const bgH = hh + mm / 60;
  const timeBgKey = getTimedBgKey(bgH, solarTimes);
  const isLight  = timeBgKey === 'morning' || timeBgKey === 'midday' || timeBgKey === 'afternoon';
  const isGolden = timeBgKey === 'sunrise' || timeBgKey === 'sandhya' || timeBgKey === 'predawn' || timeBgKey === 'twilight';

  const scrim: [string, string, string] = isLight
    ? ['rgba(0,4,18,0.58)', 'rgba(0,4,18,0.24)', 'rgba(0,4,18,0.62)']
    : isGolden
    ? ['rgba(0,0,0,0.46)',  'rgba(0,0,0,0.16)',  'rgba(0,0,0,0.50)']
    : ['rgba(2,2,16,0.36)',  'rgba(2,2,16,0.12)',  'rgba(2,2,16,0.40)'];

  const headerGrad: [string, string] = isLight
    ? ['rgba(0,5,22,0.88)',  'rgba(0,5,22,0.12)']
    : isGolden
    ? ['rgba(0,0,0,0.76)',   'rgba(0,0,0,0.06)']
    : ['rgba(2,2,24,0.72)',  'rgba(2,2,24,0.05)'];

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
              colors={['#F5820A22', '#a78bfa14', 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFillObject} />
            <LinearGradient colors={['rgba(255,255,255,0.14)','rgba(255,255,255,0.03)']} start={{x:0,y:0}} end={{x:0,y:1}} style={StyleSheet.absoluteFillObject} />
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.35)' }} />
            <Text style={{ fontSize: 22 }}>🌅</Text>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={MSB.title}>
                You woke at <Text style={{ color: ACCENT }}>{wakeLog.wakeTimeStr}</Text>
                {sunStreak && sunStreak.count > 0
                  ? <Text style={{ color: '#a78bfa' }}>  ·  🔥 {sunStreak.count} day streak</Text>
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

        {/* WEATHER SUMMARY ROW */}
        {weather && <WeatherSummaryBar weather={weather} />}

        {/* HOURLY STRIP — weather forecast + night-aware icons */}
        {weather?.hourly && weather.hourly.length > 0 && (
          <HourlyStrip hourly={weather.hourly} onMore={() => setShow7Day(true)} solarTimes={solarTimes} />
        )}

        {/* BIO CIRCADIAN ENVIRONMENT CYCLE */}
        {currentPeriod ? (
          <View>
            <View style={[D.sectionRow, { marginTop: 22, marginBottom: 10, alignItems: 'flex-start', justifyContent: 'flex-end' }]}>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[D.sectionSub, { color: currentPeriod.color + 'CC' }]}>{currentPeriod.label}</Text>
                <Text style={[D.sectionSub, { color: '#FFFFFF30', marginTop: 2 }]}>Solar time · Active now</Text>
              </View>
            </View>
            {!(brahmaInfo?.status === 'active') && <HourlyEnvSuggestion period={currentPeriod} weather={weather} />}
            <CurrentPeriodCard
              period={currentPeriod}
              liveClock={liveClock}
              onExplore={(dosha, label, start, end) =>
                router.push({ pathname: '/dosha-explore' as never, params: { activeDosha: dosha, periodLabel: label, periodStart: start, periodEnd: end } } as never)
              }
            />
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
  appName: { fontSize: 15, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },
  refreshBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  clockTime: { fontSize: 44, fontWeight: '200', color: '#fff', letterSpacing: -2 },
  clockAmpm: { fontSize: 15, fontWeight: '300', color: ACCENT, paddingBottom: 3 },
  clockDate: { fontSize: 11, color: '#FFFFFF50', fontWeight: '600', letterSpacing: 0.5 },
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
  sectionTitle: { fontSize: 9, fontWeight: '900', color: '#FFFFFF30', letterSpacing: 1.8 },
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
  bioCircadianTitle: { fontSize: 17, fontWeight: '900', color: '#FFFFFFCC', letterSpacing: 0.8, lineHeight: 22 },
  bioCircadianSub:   { fontSize: 13, fontWeight: '700', color: '#FFFFFF50', letterSpacing: 1.4, lineHeight: 18 },
  bioCircadianTag:   { fontSize: 9,  fontWeight: '900', color: ACCENT + 'AA', letterSpacing: 2.2, marginTop: 3 },
});

const W = StyleSheet.create({
  stripContainer: { marginTop: 8, marginBottom: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.10, shadowRadius: 6, elevation: 2 },
  hourCell: {
    alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 10,
    borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.13)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.30)',
    minWidth: 58,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.30, shadowRadius: 14, elevation: 6,
  },
  hourCellNow: { backgroundColor: ACCENT + '22', borderColor: ACCENT + '55' },
  hourLabel: { fontSize: 8, fontWeight: '900', color: '#FFFFFF35', letterSpacing: 0.5 },
  hourEmoji: { fontSize: 20 },
  hourTemp:  { fontSize: 12, fontWeight: '800', color: '#fff' },
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
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000080' },
  sheet: {
    backgroundColor: '#0C0C1E', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, maxHeight: '82%',
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#FFFFFF18', alignSelf: 'center', marginBottom: 16 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontWeight: '900', color: '#fff' },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 },
  dayRowBorder: { borderTopWidth: 1, borderTopColor: '#FFFFFF07' },
  dayLeft: { width: 52 },
  dayLabel: { fontSize: 13, fontWeight: '800', color: '#fff' },
  dayDate:  { fontSize: 9, color: '#FFFFFF30', marginTop: 2 },
  dayEmoji: { fontSize: 26, width: 36, textAlign: 'center' },
  dayMid:   { flex: 1, gap: 2 },
  dayCond:  { fontSize: 11, color: '#FFFFFF65', fontWeight: '600' },
  dayPrec:  { fontSize: 10, color: '#60a5fa', fontWeight: '600' },
  dayTemps: { alignItems: 'flex-end', gap: 2 },
  dayMax:   { fontSize: 15, fontWeight: '800', color: '#fff' },
  dayMin:   { fontSize: 11, color: '#FFFFFF35', fontWeight: '600' },
  suggDot:  { width: 8, height: 8, borderRadius: 4 },
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
    shadowColor: '#a78bfa', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.36, shadowRadius: 30, elevation: 14,
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
  infoNote:        { backgroundColor: '#a78bfa08', borderWidth: 1, borderColor: '#a78bfa18', borderRadius: 14, padding: 12 },
  infoNoteText:    { fontSize: 10, color: '#a78bfa65', lineHeight: 15 },
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
  footerNote:    { backgroundColor: 'rgba(167,139,250,0.06)', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(167,139,250,0.22)', padding: 16, marginTop: 8 },
  footerTxt:     { fontSize: 12, color: '#FFFFFF80', lineHeight: 19 },
  cosmoHero:     { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', padding: 18, marginBottom: 18 },
  cosmoTitle:    { fontSize: 18, fontWeight: '900', color: '#fff', marginBottom: 3 },
  cosmoSub:      { fontSize: 12, color: '#a78bfaDD', fontWeight: '700', marginBottom: 2 },
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
    borderColor: 'rgba(167,139,250,0.40)', backgroundColor: 'rgba(167,139,250,0.16)', padding: 16, overflow: 'hidden',
    shadowColor: '#a78bfa', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.34, shadowRadius: 24, elevation: 12,
  },
  headerRow:   { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 },
  sacredLabel: { fontSize: 8, fontWeight: '900', color: '#a78bfa60', letterSpacing: 1.5, marginBottom: 4 },
  sacredTimes: { fontSize: 15, fontWeight: '800', color: '#a78bfaDD' },
  sacredSub:   { fontSize: 9, color: '#a78bfa50', marginTop: 3 },
  notifTxt:    { fontSize: 8, color: '#FFFFFF35', fontWeight: '700' },
  sciRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#FFFFFF08' },
  sciToggleTxt: { fontSize: 11, color: '#a78bfa80', fontWeight: '700' },
  aliasRow:    { flexDirection: 'row', gap: 10, paddingVertical: 9, alignItems: 'flex-start' },
  aliasTitle:  { fontSize: 11, fontWeight: '800', color: '#a78bfa', marginBottom: 3 },
  aliasDesc:   { fontSize: 10, color: '#FFFFFF45', lineHeight: 15 },
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
    shadowColor: '#a78bfa',
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
