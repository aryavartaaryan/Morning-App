import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Switch, ImageBackground, ActivityIndicator, Modal,
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

const ACCENT = '#F5820A';

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
    tips: ['Stay indoors and avoid open areas','Do not stand under trees or near water','Postpone any outdoor plans today','Ideal day for indoor work & rest'] };

  if (isSnow)   return { icon: '❄️', color: '#93c5fd', title: 'Snow Outside',
    tips: ['Dress in warm layers before stepping out','Roads may be icy — drive carefully','Morning walk not recommended today','Warm herbal tea & indoor routines are ideal'] };

  if (isFog)    return { icon: '🌫️', color: '#94a3b8', title: 'Foggy Morning',
    tips: ['Visibility is low — drive carefully','Avoid early morning outdoor exercise','Fog usually clears by mid-morning','Good day for indoor pranayama & meditation'] };

  if (isRain)   return { icon: '🌧️', color: '#60a5fa', title: 'Rain Today — Carry Umbrella',
    tips: ['Keep an umbrella ready before going out','Morning walk can wait for a dry window','Stay dry — wet feet can affect digestion (Ayurveda)','Great day for indoor yoga & light meals'] };

  if (isClear && veryHot) return { icon: '🌡️', color: '#f97316', title: 'Very Hot — Sun Protection',
    tips: ['Apply sunscreen before any outdoor activity','Carry water — hydrate every 30 min','Avoid going out between 11 AM – 4 PM','Morning walk best done before 8 AM today'] };

  if (isClear && hot && veryHumid) return { icon: '🥵', color: '#fb923c', title: 'Hot & Humid Day',
    tips: ['Humidity is high — sweat cools poorly','Drink coconut water or ORS to stay hydrated','Outdoor walk best in early morning only','Light breathable clothing recommended'] };

  if (isClear && pleasant) return { icon: '✨', color: '#34d399', title: 'Perfect Day to Go Out!',
    tips: ['Ideal conditions for a morning walk 🚶','Great day to exercise outdoors','Enjoy sunlight — 15–20 min for Vitamin D','Open windows — let fresh air fill your space'] };

  if (isPartly && pleasant) return { icon: '⛅', color: '#a78bfa', title: 'Pleasant Weather',
    tips: ['Good day for a leisurely morning walk','Comfortable for outdoor activities','Nice weather for a picnic or open-air lunch','Enjoy the natural light and breeze'] };

  if (cool) return { icon: '🧥', color: '#7dd3fc', title: 'Cool & Fresh',
    tips: ['Wear a light layer before stepping out','Cool mornings are great for brisk walking','Warm breakfast and herbal tea recommended','Good day for focused outdoor work'] };

  return { icon: '🌤️', color: '#fbbf24', title: 'Mostly Clear Sky',
    tips: ['Good day for a morning walk','Comfortable outdoor conditions','Stay hydrated through the day','Enjoy the daylight hours outdoors'] };
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
  if ([95,96,99].includes(code))       return { icon: '⛈️', color: '#f43f5e', title: 'Thunderstorm — Stay Indoors',  tips: ['Avoid going outside right now', 'Stay away from trees & open areas', 'Postpone any travel or outdoor plans'] };
  if ([61,63,65,80,81,82].includes(code)) return { icon: '🌧️', color: '#60a5fa', title: 'Rain This Hour',             tips: ['Carry an umbrella before stepping out', 'Wet roads — slow down while driving', 'Good time for indoor focus or reading'] };
  if ([51,53,55].includes(code))       return { icon: '🌦️', color: '#93c5fd', title: 'Light Drizzle Outside',       tips: ['Keep a light jacket handy', 'Brief outdoor trips are fine', 'Walk carefully on slick surfaces'] };
  if ([45,48].includes(code))          return { icon: '🌫️', color: '#94a3b8', title: 'Foggy Conditions',            tips: ['Low visibility — drive slowly', 'Avoid outdoor exercise right now', 'Fog typically lifts within an hour'] };
  if ([71,73,75].includes(code))       return { icon: '❄️', color: '#bae6fd', title: 'Snow This Hour',              tips: ['Dress in warm layers before going out', 'Roads may be icy — drive carefully', 'Perfect time to stay warm inside'] };
  if (temp >= 38)                       return { icon: '🌡️', color: '#ef4444', title: 'Extreme Heat Right Now',      tips: ['Avoid direct sun — stay in shade', 'Drink water every 20–30 min', 'Limit outdoor exposure this hour'] };
  if (temp >= 34)                       return { icon: '☀️',  color: '#f97316', title: 'Very Hot Outside',           tips: ['Carry water before heading out', 'Wear a hat or apply sunscreen', 'Best to limit time in direct sun'] };
  if ([0,1].includes(code) && temp >= 22 && temp < 34) return { icon: '✅', color: '#34d399', title: 'Great Conditions Right Now', tips: ['Perfect time for a walk or outdoor activity', 'Enjoy the fresh air & sunlight', 'Open windows — let the breeze in'] };
  if ([2,3].includes(code) && temp >= 20) return { icon: '⛅', color: '#a78bfa', title: 'Comfortable Outside',      tips: ['Comfortable for any outdoor activity', 'Light clothing is all you need', 'Good hour to step outside & move'] };
  return { icon: '🌤️', color: '#fbbf24', title: 'Clear Skies',                                                       tips: ['Decent conditions outside', 'Stay hydrated if heading out', 'Enjoy the daylight while it lasts'] };
}

// ── Background images keyed by solar period ───────────────────────────────

function getTimedBgKey(h: number, solar?: SolarTimes | null): string {
  if (solar) {
    const { sunrise, solarNoon, sunset } = solar;
    if (h < sunrise - 1.5 || h >= sunset + 5) return 'night';
    if (h < sunrise - 0.3) return 'brahma';
    if (h < sunrise + 0.5) return 'predawn';
    if (h < sunrise + 2)   return 'sunrise';
    if (h < solarNoon - 1) return 'morning';
    if (h < solarNoon + 2) return 'midday';
    if (h < sunset - 1.5)  return 'afternoon';
    if (h < sunset)        return 'sandhya';
    if (h < sunset + 2)    return 'twilight';
    return 'night';
  }
  if (h >= 2  && h < 5)   return 'brahma';
  if (h >= 5  && h < 5.5) return 'predawn';
  if (h >= 5.5 && h < 8)  return 'sunrise';
  if (h >= 8  && h < 10)  return 'morning';
  if (h >= 10 && h < 14)  return 'midday';
  if (h >= 14 && h < 17)  return 'afternoon';
  if (h >= 17 && h < 19)  return 'sandhya';
  if (h >= 19 && h < 21)  return 'twilight';
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
function PanchangCard() {
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
    <TouchableOpacity
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setExpanded(e => !e); }}
      activeOpacity={0.9}
      style={[PC.card, { borderColor: vaar.color + '35' }]}>

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
      </View>
    </TouchableOpacity>
  );
}

// ── Hourly Weather Strip ──────────────────────────────────────────────────
function HourlyStrip({ hourly, onMore }: { hourly: WeatherData['hourly']; onMore: () => void }) {
  return (
    <View style={W.stripContainer}>
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 4 }}>
        {hourly.map((pt, i) => (
          <View key={i} style={[W.hourCell, i === 0 && W.hourCellNow]}>
            <Text style={[W.hourLabel, i === 0 && { color: ACCENT }]}>{i === 0 ? 'NOW' : hrLabel(pt.hour)}</Text>
            <Text style={W.hourEmoji}>{pt.emoji}</Text>
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
      <View style={[WS.card, { borderColor: s.color + '35' }]}>
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
    <View style={[WS.card, { borderColor: adv.color + '35' }]}>
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

// ── Current Period Card (always fully expanded) ──────────────────────────
function CurrentPeriodCard({ period }: { period: DoshaPeriod }) {
  const rem  = period.minutesRemaining;
  const remStr = rem >= 60
    ? `${Math.floor(rem / 60)}h ${rem % 60}m left`
    : `${rem} min left`;
  const durH    = (period.endH - period.startH + 24) % 24;
  const totalM  = Math.round(durH * 60);
  const progress = totalM > 0 ? Math.min(1, Math.max(0, (totalM - rem) / totalM)) : 0;
  return (
    <View style={[CP.card, { borderColor: period.color + '50' }]}>
      <LinearGradient
        colors={[period.color + '20', period.color + '07', 'transparent']}
        style={StyleSheet.absoluteFillObject} />
      {/* Badges */}
      <View style={CP.badgeRow}>
        <View style={[CP.doshaBadge, { backgroundColor: period.color + '20', borderColor: period.color + '55' }]}>
          <Text style={[CP.doshaTxt, { color: period.color }]}>{period.dosha.toUpperCase()}</Text>
        </View>
        <View style={[CP.activeBadge, { backgroundColor: period.color + '15', borderColor: period.color + '40' }]}>
          <View style={[CP.activeDotB, { backgroundColor: period.color }]} />
          <Text style={[CP.activeTxtB, { color: period.color }]}>ACTIVE NOW</Text>
        </View>
      </View>
      {/* Name + countdown row */}
      <View style={CP.nameRow}>
        <Text style={CP.emoji}>{period.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[CP.name, { color: period.color }]}>{period.label}</Text>
          <Text style={[CP.engLabel, { color: period.color + '80' }]}>{period.englishLabel}</Text>
          <Text style={CP.sciSub}>{period.sciEmoji}  {period.sciTitle}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          <Text style={[CP.countdown, { color: period.color }]}>{remStr}</Text>
          <Text style={CP.timeRange}>{period.startLabel} → {period.endLabel}</Text>
        </View>
      </View>
      {/* Progress bar */}
      <View style={CP.progressTrack}>
        <View style={[CP.progressFill, { width: `${Math.round(progress * 100)}%` as any, backgroundColor: period.color }]} />
      </View>
      {/* Science description */}
      <Text style={CP.sciDesc}>{period.sciDesc}</Text>
      {/* Activities */}
      <View style={CP.divider} />
      <Text style={[CP.secLabel, { color: period.color + 'CC' }]}>✓  IDEAL ACTIVITIES</Text>
      <View style={CP.listGrid}>
        {period.activities.map((a, i) => (
          <View key={i} style={CP.listItem}>
            <View style={[CP.listDot, { backgroundColor: period.color + 'AA' }]} />
            <Text style={CP.listTxt}>{a}</Text>
          </View>
        ))}
      </View>
      {/* Avoidances */}
      <View style={[CP.divider, { marginTop: 10 }]} />
      <Text style={CP.avoidSecLabel}>✗  BEST AVOIDED</Text>
      <View style={CP.listGrid}>
        {period.avoidances.map((a, i) => (
          <View key={i} style={CP.listItem}>
            <View style={[CP.listDot, { backgroundColor: '#f43f5e60' }]} />
            <Text style={[CP.listTxt, { color: '#FFFFFF40' }]}>{a}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Next Period Card (compact preview) ────────────────────────────────────
function NextPeriodCard({ period }: { period: DoshaPeriod }) {
  const untilStr = period.minutesUntil >= 60
    ? `${Math.floor(period.minutesUntil / 60)}h ${period.minutesUntil % 60}m`
    : `${period.minutesUntil} min`;
  return (
    <View style={[NP.card, { borderColor: period.color + '28' }]}>
      <LinearGradient
        colors={[period.color + '0E', 'transparent']}
        style={StyleSheet.absoluteFillObject} />
      <Text style={NP.emoji}>{period.emoji}</Text>
      <View style={{ flex: 1 }}>
        <View style={NP.titleRow}>
          <View style={[NP.nextBadge, { borderColor: period.color + '40' }]}>
            <Text style={[NP.nextTxt, { color: period.color + 'AA' }]}>NEXT</Text>
          </View>
          <Text style={NP.name}>{period.label}</Text>
        </View>
        <Text style={[NP.engLabel, { color: period.color + '70' }]}>{period.englishLabel}</Text>
        <Text style={NP.sci}>{period.sciEmoji}  {period.sciTitle}</Text>
        <Text style={NP.time}>{period.startLabel} → {period.endLabel}</Text>
      </View>
      <View style={NP.right}>
        <Text style={NP.inLabel}>STARTS IN</Text>
        <Text style={[NP.inTime, { color: period.color }]}>{untilStr}</Text>
      </View>
    </View>
  );
}

// ── Brahma Muhurta Extras (notification toggle + science) ────────────────
function BrahmaMuhurtaExtrasCard({
  info, enabled, onToggle,
}: {
  info: BrahmaMuhurtaInfo; enabled: boolean; onToggle: () => void;
}) {
  const [showSci, setShowSci] = useState(false);
  return (
    <View style={BMX.card}>
      <View style={BMX.headerRow}>
        <View>
          <Text style={BMX.sacredLabel}>SACRED WINDOW</Text>
          <Text style={BMX.sacredTimes}>{info.startLabel}  →  {info.endLabel}</Text>
          <Text style={BMX.sacredSub}>96–48 min before sunrise</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <Switch
            value={enabled} onValueChange={onToggle}
            trackColor={{ false: '#222', true: '#a78bfa50' }}
            thumbColor={enabled ? '#a78bfa' : '#555'} />
          <Text style={BMX.notifTxt}>{enabled ? '🔔 Reminder ON' : '🔕 Reminder OFF'}</Text>
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

  // Live clock tick
  useEffect(() => {
    const t = setInterval(() => setLiveClock(new Date()), 1000);
    return () => clearInterval(t);
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
  const timeStr = `${pad(hh === 0 ? 12 : hh > 12 ? hh - 12 : hh)}:${pad(mm)}`;
  const ampmStr = hh < 12 ? 'AM' : 'PM';
  const dateStr = liveClock.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const bgH = hh + mm / 60;
  const timeBgKey = getTimedBgKey(bgH, solarTimes);
  const isLight  = timeBgKey === 'morning' || timeBgKey === 'midday' || timeBgKey === 'afternoon';
  const isGolden = timeBgKey === 'sunrise' || timeBgKey === 'sandhya' || timeBgKey === 'predawn' || timeBgKey === 'twilight';

  const scrim: [string, string, string] = isLight
    ? ['rgba(0,4,18,0.82)', 'rgba(0,4,18,0.64)', 'rgba(0,4,18,0.85)']
    : isGolden
    ? ['rgba(0,0,0,0.68)',  'rgba(0,0,0,0.44)',  'rgba(0,0,0,0.72)']
    : ['rgba(2,2,16,0.52)',  'rgba(2,2,16,0.30)',  'rgba(2,2,16,0.56)'];

  const headerGrad: [string, string] = isLight
    ? ['rgba(0,5,22,0.88)',  'rgba(0,5,22,0.12)']
    : isGolden
    ? ['rgba(0,0,0,0.76)',   'rgba(0,0,0,0.06)']
    : ['rgba(2,2,24,0.72)',  'rgba(2,2,24,0.05)'];

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <ImageBackground
      source={bgUri ? { uri: bgUri } : undefined}
      style={D.screen}
      imageStyle={{ opacity: 0.65 }}>

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

          {/* Clock */}
          <View style={{ alignItems: 'center', paddingBottom: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
              <Text style={D.clockTime}>{timeStr}</Text>
              <Text style={D.clockAmpm}>{ampmStr}</Text>
            </View>
            <Text style={D.clockDate}>{dateStr}</Text>
          </View>

          {/* Solar times strip + Moon phase */}
          {solarTimes && (() => {
            const moon = getMoonPhase();
            return (
              <>
                <View style={[D.solarRow, { marginTop: 4, marginBottom: 2 }]}>
                  {([
                    { emoji: '🌅', label: 'Sunrise',    val: fmtSolar(solarTimes.sunrise)   },
                    { emoji: '☀️',  label: 'Solar Noon', val: fmtSolar(solarTimes.solarNoon) },
                    { emoji: '🌇', label: 'Sunset',     val: fmtSolar(solarTimes.sunset)    },
                  ] as { emoji: string; label: string; val: string }[]).map((item, i) => (
                    <View key={i} style={D.solarCell}>
                      <Text style={{ fontSize: 15 }}>{item.emoji}</Text>
                      <Text style={D.solarVal}>{item.val}</Text>
                      <Text style={D.solarLabel}>{item.label}</Text>
                    </View>
                  ))}
                  <View style={D.solarCell}>
                    <MoonSVG tithiNum={moon.tithiNum} size={26} />
                    <Text style={D.solarVal}>{moon.illumination}%</Text>
                    <Text style={D.solarLabel}>{moon.name}</Text>
                  </View>
                </View>
                <View style={D.tithiRow}>
                  <Text style={D.tithiText}>
                    {moon.paksha === 'Shukla' ? '☽' : '☾'}{'  '}{moon.name}  ·  {moon.paksha} Paksha  ·  {moon.tithi}
                  </Text>
                </View>
              </>
            );
          })()}

          {/* Current weather summary */}
          {weather && (
            <View style={D.weatherSummary}>
              <Text style={D.weatherEmoji}>{weather.emoji}</Text>
              <Text style={D.weatherTemp}>{weather.temp}°C  /  {Math.round(weather.temp * 9 / 5 + 32)}°F</Text>
              <Text style={D.weatherCond}>{weather.condition}</Text>
              {weather.city ? <Text style={D.weatherCity}>·  {weather.city}</Text> : null}
              <Text style={D.weatherExtra}>💧 {weather.humidity}%</Text>
              {weather.daily?.[0] && (
                <View style={D.hlRow}>
                  <Text style={D.hlHigh}>↑{weather.daily[0].maxTemp}°C / {Math.round(weather.daily[0].maxTemp * 9 / 5 + 32)}°F</Text>
                  <Text style={D.hlLow}>↓{weather.daily[0].minTemp}°C / {Math.round(weather.daily[0].minTemp * 9 / 5 + 32)}°F</Text>
                </View>
              )}
            </View>
          )}
        </SafeAreaView>
      </LinearGradient>

      {/* ── Scrollable content ── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 110, paddingTop: 4 }}
        showsVerticalScrollIndicator={false}>

        {/* Vedic Cosmic Calendar (Panchang) — shown first */}
        <PanchangCard />

        {/* Hourly forecast strip — slide to see upcoming hours, tap end for 7-day */}
        {weather?.hourly && weather.hourly.length > 0 && (
          <HourlyStrip hourly={weather.hourly} onMore={() => setShow7Day(true)} />
        )}

        {/* Current-hour weather explanation + activities */}
        {weather && (
          <SmartWeatherCard
            code={weather.hourly?.[0]?.weatherCode ?? weather.weatherCode}
            temp={weather.hourly?.[0]?.temp ?? weather.temp}
            humidity={weather.humidity}
            hourly={weather.hourly}
            isMorning={hh < Math.floor(solarTimes?.solarNoon ?? 12)}
          />
        )}

        {/* Current period — fully expanded */}
        {currentPeriod ? (
          <>
            <View style={D.sectionRow}>
              <Text style={D.sectionTitle}>NOW  ·  ENERGY PERIOD</Text>
              <Text style={[D.sectionSub, { color: currentPeriod.color + 'BB' }]}>Ayurvedic · Solar time</Text>
            </View>
            <CurrentPeriodCard period={currentPeriod} />
            {currentPeriod.id === 'night_vata' && brahmaInfo && (
              <BrahmaMuhurtaExtrasCard info={brahmaInfo} enabled={brahmaEnabled} onToggle={toggleBrahma} />
            )}
          </>
        ) : (
          <View style={D.sectionRow}>
            <Text style={D.sectionTitle}>ENERGY CYCLES  ·  AYURVEDIC</Text>
            <Text style={D.sectionSub}>Solar time</Text>
          </View>
        )}

        {/* Next upcoming period */}
        {nextPeriod && (
          <>
            <View style={[D.sectionRow, { marginTop: 4 }]}>
              <Text style={D.sectionTitle}>UPCOMING</Text>
              <Text style={D.sectionSub}>
                {nextPeriod.minutesUntil < 60
                  ? `in ${nextPeriod.minutesUntil} min`
                  : `in ${Math.floor(nextPeriod.minutesUntil / 60)}h ${nextPeriod.minutesUntil % 60}m`}
              </Text>
            </View>
            <NextPeriodCard period={nextPeriod} />
            {nextPeriod.id === 'night_vata' && brahmaInfo && (
              <BrahmaMuhurtaExtrasCard info={brahmaInfo} enabled={brahmaEnabled} onToggle={toggleBrahma} />
            )}
          </>
        )}

        {/* No GPS hint */}
        {!solarTimes && periods.length === 0 && (
          <View style={D.noGpsHint}>
            <Text style={{ fontSize: 34 }}>🛰</Text>
            <Text style={{ color: '#FFFFFF40', fontSize: 13, fontWeight: '600', textAlign: 'center', lineHeight: 20 }}>
              GPS location needed{'\n'}for solar-accurate periods
            </Text>
            <TouchableOpacity onPress={loadWeather} style={D.gpsBtn}>
              <Text style={{ color: ACCENT, fontWeight: '800', fontSize: 12 }}>Enable Location  →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 7-Day forecast modal */}
        {show7Day && weather?.daily && weather.daily.length > 0 && (
          <SevenDayModal daily={weather.daily} onClose={() => setShow7Day(false)} />
        )}


      </ScrollView>
    </ImageBackground>
  );
}

// ── StyleSheets ───────────────────────────────────────────────────────────────
const D = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#060610' },
  headerGrad: { paddingBottom: 8 },
  headerTop: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 6, paddingBottom: 6,
  },
  appName: { fontSize: 15, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },
  refreshBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  clockTime: { fontSize: 48, fontWeight: '200', color: '#fff', letterSpacing: -2 },
  clockAmpm: { fontSize: 15, fontWeight: '300', color: ACCENT, paddingBottom: 9 },
  clockDate: { fontSize: 11, color: '#FFFFFF50', fontWeight: '600', letterSpacing: 0.5 },
  weatherSummary: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap',
    gap: 8, paddingHorizontal: 18, paddingBottom: 8,
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
    borderRadius: 16, borderWidth: 1, borderColor: '#FFFFFF08',
    backgroundColor: '#FFFFFF04', overflow: 'hidden',
  },
  solarCell:  { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 9 },
  solarVal:   { fontSize: 12, fontWeight: '800', color: '#fff' },
  solarLabel: { fontSize: 8, color: '#FFFFFF35', fontWeight: '600' },
  tithiRow:   { alignItems: 'center', paddingBottom: 8 },
  tithiText:  { fontSize: 10, color: '#FFFFFF40', fontWeight: '600', letterSpacing: 0.4 },
});

const W = StyleSheet.create({
  stripContainer: { marginTop: 8, marginBottom: 2 },
  hourCell: {
    alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 10,
    borderRadius: 16, backgroundColor: '#FFFFFF05', borderWidth: 1, borderColor: '#FFFFFF08',
    minWidth: 58,
  },
  hourCellNow: { backgroundColor: ACCENT + '15', borderColor: ACCENT + '40' },
  hourLabel: { fontSize: 8, fontWeight: '900', color: '#FFFFFF35', letterSpacing: 0.5 },
  hourEmoji: { fontSize: 20 },
  hourTemp:  { fontSize: 12, fontWeight: '800', color: '#fff' },
  moreBtn: {
    alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 16, backgroundColor: ACCENT + '18', borderWidth: 1, borderColor: ACCENT + '45',
    minWidth: 66,
  },
  moreTxt:   { fontSize: 9, fontWeight: '900', color: ACCENT, letterSpacing: 0.5 },
  moreArrow: { fontSize: 16, color: ACCENT },
});


const WS = StyleSheet.create({
  card: {
    marginHorizontal: 16, marginTop: 10, borderRadius: 20, borderWidth: 1,
    backgroundColor: '#FFFFFF04', flexDirection: 'row', overflow: 'hidden',
    paddingVertical: 16, paddingRight: 16,
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
    marginHorizontal: 16, marginTop: 8, borderRadius: 20, borderWidth: 1,
    backgroundColor: '#FFFFFF03', overflow: 'hidden', padding: 16,
  },
  cardActive: { backgroundColor: '#FFFFFF06' },
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
    marginHorizontal: 16, marginTop: 8, borderRadius: 24, borderWidth: 1.5,
    backgroundColor: '#FFFFFF04', overflow: 'hidden', padding: 20,
  },
  badgeRow:    { flexDirection: 'row', gap: 8, marginBottom: 16 },
  doshaBadge:  { borderRadius: 99, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 4 },
  doshaTxt:    { fontSize: 8, fontWeight: '900', letterSpacing: 1.8 },
  activeBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 99, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 4 },
  activeDotB:  { width: 6, height: 6, borderRadius: 3 },
  activeTxtB:  { fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  nameRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  emoji:       { fontSize: 44 },
  name:        { fontSize: 22, fontWeight: '900', lineHeight: 26 },
  engLabel:    { fontSize: 10, fontWeight: '700', marginTop: 1 },
  sciSub:      { fontSize: 10, color: '#FFFFFF50', fontWeight: '600', marginTop: 2 },
  countdown:   { fontSize: 15, fontWeight: '900' },
  timeRange:   { fontSize: 10, color: '#FFFFFF40', textAlign: 'right', marginTop: 2 },
  progressTrack: { height: 3, borderRadius: 2, backgroundColor: '#FFFFFF10', marginBottom: 16, overflow: 'hidden' },
  progressFill:  { height: 3, borderRadius: 2 },
  sciDesc:     { fontSize: 12, color: '#FFFFFF55', lineHeight: 19, marginBottom: 4 },
  divider:     { height: 1, backgroundColor: '#FFFFFF08', marginVertical: 12 },
  secLabel:    { fontSize: 9, fontWeight: '900', letterSpacing: 1.6, marginBottom: 10 },
  avoidSecLabel: { fontSize: 9, fontWeight: '900', color: '#f43f5e80', letterSpacing: 1.6, marginBottom: 10 },
  listGrid:    { gap: 7 },
  listItem:    { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  listDot:     { width: 5, height: 5, borderRadius: 3, marginTop: 6 },
  listTxt:     { fontSize: 12, color: '#FFFFFF65', lineHeight: 19, flex: 1 },
});

const NP = StyleSheet.create({
  card: {
    marginHorizontal: 16, marginTop: 6, borderRadius: 20, borderWidth: 1,
    backgroundColor: '#FFFFFF03', overflow: 'hidden', padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  emoji:    { fontSize: 34 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  nextBadge: { borderRadius: 99, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  nextTxt:  { fontSize: 7, fontWeight: '900', letterSpacing: 1.8 },
  name:     { fontSize: 15, fontWeight: '800', color: '#FFFFFFCC' },
  engLabel: { fontSize: 9, fontWeight: '700', marginBottom: 3, marginTop: 1 },
  sci:      { fontSize: 10, color: '#FFFFFF40', fontWeight: '500', marginBottom: 2 },
  time:     { fontSize: 10, color: '#FFFFFF30', fontWeight: '500' },
  right:    { alignItems: 'flex-end', gap: 3 },
  inLabel:  { fontSize: 7, fontWeight: '900', color: '#FFFFFF25', letterSpacing: 1.5 },
  inTime:   { fontSize: 18, fontWeight: '900' },
});

const PC = StyleSheet.create({
  card: {
    marginHorizontal: 16, marginTop: 10, borderRadius: 22, borderWidth: 1,
    backgroundColor: '#FFFFFF04', flexDirection: 'row', overflow: 'hidden',
    paddingVertical: 16, paddingRight: 16,
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
  actionBox:       { backgroundColor: '#FFFFFF06', borderRadius: 14, padding: 12, marginBottom: 10 },
  actionLabel:     { fontSize: 8, fontWeight: '900', color: '#FFFFFF30', letterSpacing: 1.5, marginBottom: 5 },
  actionText:      { fontSize: 12, fontWeight: '600', color: '#FFFFFFCC', lineHeight: 18 },
  alignRow:        { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
  alignDot:        { width: 6, height: 6, borderRadius: 3, marginTop: 5 },
  alignText:       { flex: 1, fontSize: 11, lineHeight: 17 },
  ritualRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#FFFFFF05', borderRadius: 14, padding: 12 },
  ritualPrompt:    { fontSize: 9, fontWeight: '800', color: '#FFFFFF35', letterSpacing: 0.5, marginBottom: 3 },
  ritualText:      { fontSize: 11, color: '#FFFFFF65', lineHeight: 17, fontStyle: 'italic' },
  expandedSection: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#FFFFFF08', paddingTop: 12, gap: 12 },
  triRow:          { flexDirection: 'row', gap: 8 },
  triCell:         { flex: 1, borderWidth: 1, borderRadius: 16, backgroundColor: '#FFFFFF04', padding: 11, gap: 3 },
  triEmoji:        { fontSize: 20, marginBottom: 4 },
  triTitle:        { fontSize: 12, fontWeight: '900' },
  triSub:          { fontSize: 9, color: '#FFFFFF50', lineHeight: 14 },
  triEn:           { fontSize: 8, color: '#FFFFFF25', fontWeight: '500', marginTop: 3 },
  infoNote:        { backgroundColor: '#a78bfa08', borderWidth: 1, borderColor: '#a78bfa18', borderRadius: 14, padding: 12 },
  infoNoteText:    { fontSize: 10, color: '#a78bfa65', lineHeight: 15 },
  biRow:           { flexDirection: 'row', gap: 8, marginBottom: 10, marginTop: 2 },
  biCell:          { flex: 1, borderWidth: 1, borderRadius: 14, backgroundColor: '#FFFFFF04', padding: 10, gap: 3 },
  biTag:           { fontSize: 7, fontWeight: '900', color: '#FFFFFF25', letterSpacing: 1.2, marginBottom: 2 },
  biSanskrit:      { fontSize: 13, fontWeight: '900' },
  biEnglish:       { fontSize: 9, color: '#FFFFFF45', fontWeight: '500' },
});

const BMX = StyleSheet.create({
  card: {
    marginHorizontal: 16, marginTop: 6, borderRadius: 20, borderWidth: 1,
    borderColor: '#a78bfa25', backgroundColor: '#a78bfa06', padding: 16, overflow: 'hidden',
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
