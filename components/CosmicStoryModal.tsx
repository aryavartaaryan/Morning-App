/**
 * CosmicStoryModal — v4 "Astral Traveler"
 * 7 immersive full-screen story cards — Panchanga experience.
 * Design: Moonly / Co-Star aesthetic. Deep Sanskrit + scientific context.
 * Purnima, Amavasya, Ekadashi, Ashtami, Chaturdashi, Dwadashi, Navami all
 * receive rich special guidance cards.
 */
import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, Modal, TouchableOpacity, ScrollView,
  StyleSheet, Dimensions, Animated, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Svg, { Circle as SvgCircle, Path as SvgPath, Line as SvgLine, G as SvgG } from 'react-native-svg';
import {
  NAKSHATRAS, YOGAS, VAARS, TITHI_ORDINALS, ENGLISH_DAYS,
  TITHI_ENERGY, TITHI_DEITY, MOON_RITUALS, VAAR_ACTIONS, RASHI_TO_VEDIC_MONTH,
  SCORE_META, getMoonPhase, getPanchangData, getVedicMonth,
  getNextLunarEvents, getCosmicScore,
} from '@/lib/cosmicData';
import type { SolarTimes } from '@/lib/solar';

const { width: W, height: H } = Dimensions.get('window');

// ── Special tithi guidance (Purnima, Amavasya, all sacred tithis) ─────────
const TITHI_SPECIAL: Record<string, { icon: string; title: string; en: string; advice: string; color: string; fasting?: boolean; scienceLine: string }> = {
  Ekadashi:    {
    icon: '🌿', color: '#6ee7b7',
    title: 'Ekadashi Vrat', en: 'Eleventh Day · Sacred Fast',
    fasting: true,
    advice: 'Most sacred fast of the lunar month. Avoid all grains, beans & rice. Fast from sunrise to next sunrise or break at noon with fruits. Autophagy (cellular self-cleaning) peaks at 16–24h. Vishnu\'s energy governs today — ideal for meditation, mantra, and deep inner work.',
    scienceLine: 'Autophagy peaks 16–24h into a fast. Gut microbiome resets. Ketones provide clean neural fuel.',
  },
  Purnima:     {
    icon: '🌕', color: '#fbbf24',
    title: 'Purnima — Full Moon', en: 'Full Moon Day',
    fasting: true,
    advice: 'Maximum lunar energy. Intracranial cerebrospinal fluid measurably peaks. Emotional intensity is at its monthly high. Express gratitude out loud, release what no longer serves, meditate under open sky. Fast lightly or eat cooling foods. Chandra (Moon God) governs.',
    scienceLine: 'CSF pressure peaks. Sleep latency increases ~25 min. Serotonin–melatonin axis is disrupted — plan for lighter, earlier sleep.',
  },
  Amavasya:    {
    icon: '🌑', color: '#a5b4fc',
    title: 'Amavasya — New Moon', en: 'New Moon Day',
    fasting: true,
    advice: 'The cosmic void before creation. Deep rest, silent meditation, ancestor remembrance (Pitru Tarpan). Set one single clear intention for the new lunar cycle. Fasting recommended — conserve all energy, do not scatter it. The Pitrus (ancestors) are closest today.',
    scienceLine: 'Geomagnetic field at monthly minimum. Melatonin peaks. Ideal for HPA axis reset and deep slow-wave sleep.',
  },
  Chaturdashi: {
    icon: '⚡', color: '#f87171',
    title: 'Shiva Chaturdashi', en: 'Fourteenth Day · Shiva',
    fasting: false,
    advice: 'Shiva\'s dissolution energy — releasing before renewal. Avoid beginning new major ventures. Complete existing work with intensity. Excellent day for Shiva worship, light fasting, and fierce spiritual practice. The warrior spirit is purified today.',
    scienceLine: 'Pre-full-moon phase — melatonin approaching peak. Alpha brain waves elevated. Deep contemplative states more accessible.',
  },
  Ashtami:     {
    icon: '🔱', color: '#c084fc',
    title: 'Ashtami — Durga Shakti', en: 'Eighth Day · Durga',
    fasting: false,
    advice: 'Powerful Shakti energy — Durga governs courage, transformation, and fierce grace. Ideal for overcoming obstacles, health intentions, and invoking protective energy. Mid-lunar phase creates a powerful cortisol-testosterone balance — best for physical challenges.',
    scienceLine: 'Mid-lunar: cortisol & testosterone balanced. Immune Th1/Th2 equilibrium. Best window for demanding physical work.',
  },
  Navami:      {
    icon: '✨', color: '#fde68a',
    title: 'Navami — Ancestral Power', en: 'Ninth Day · Divine Power',
    fasting: false,
    advice: 'Sacred day of devotion and ancestral power. Ideal for honoring teachers, elders, and ancestors. Saraswati and Durga both invoked. Begin learning, creative, or devotional practices. Ram Navami falls on this tithi — dharmic action is amplified today.',
    scienceLine: 'Late waxing phase — serotonin and dopamine both elevated. Creative problem-solving and learning retention at peak.',
  },
  Dwadashi:    {
    icon: '🙏', color: '#67e8f9',
    title: 'Dwadashi — Break Fast', en: 'Twelfth Day · Vishnu',
    fasting: false,
    advice: 'The day after Ekadashi — break fast mindfully with light sattvic food: fruits, light grains, warm water. Avoid heavy proteins for the first 6 hours. Vishnu\'s protection and service energy flows powerfully. Ideal for acts of seva (selfless service).',
    scienceLine: 'Refeeding: prioritise soluble fiber and probiotics. Avoid high-protein intake for 6h post-fast to protect gut lining.',
  },
};

// ── Constellation patterns (27 nakshatras) ─────────────────────────────────
const NAK_CONST: { s: [number,number,number][]; l: [number,number][] }[] = [
  { s: [[30,55,2],[52,40,3],[72,35,2]], l: [[0,1],[1,2]] },
  { s: [[35,50,2],[55,38,3],[72,33,2],[45,60,1]], l: [[0,1],[1,2],[0,3]] },
  { s: [[40,45,2],[50,40,3],[60,42,2],[46,52,1],[56,50,1],[50,58,2]], l: [[0,1],[1,2],[0,3],[3,4],[4,5]] },
  { s: [[28,62,2],[44,50,3],[56,42,2],[66,35,2],[76,30,3],[52,62,1]], l: [[0,1],[1,2],[2,3],[3,4],[1,5]] },
  { s: [[38,28,2],[52,23,3],[66,28,2],[46,50,2],[56,50,2],[42,68,2],[52,75,3],[62,68,2]], l: [[0,1],[1,2],[3,4],[5,6],[6,7],[0,3],[2,4]] },
  { s: [[30,25,3],[50,20,2],[70,25,2],[40,50,2],[60,50,3],[35,70,2],[50,78,3],[65,70,2]], l: [[0,1],[1,2],[3,4],[5,6],[6,7],[0,3],[2,4]] },
  { s: [[35,30,3],[45,25,2],[64,30,3],[38,68,2],[48,65,3]], l: [[0,1],[1,2],[0,3],[3,4]] },
  { s: [[40,35,2],[55,30,3],[65,45,2],[60,60,2],[45,55,2]], l: [[0,1],[1,2],[2,3],[3,4],[4,0]] },
  { s: [[20,50,2],[32,45,2],[48,42,3],[62,40,2],[74,42,2],[82,46,2]], l: [[0,1],[1,2],[2,3],[3,4],[4,5]] },
  { s: [[30,65,3],[42,55,2],[52,45,2],[62,40,3],[70,50,2],[52,65,2]], l: [[0,1],[1,2],[2,3],[3,4],[2,5]] },
  { s: [[32,68,2],[44,56,2],[57,46,3],[68,40,2],[72,52,2],[58,64,2]], l: [[0,1],[1,2],[2,3],[3,4],[2,5]] },
  { s: [[30,60,2],[45,50,3],[58,42,2],[70,38,3],[55,60,2],[70,55,2]], l: [[0,1],[1,2],[2,3],[1,4],[4,5]] },
  { s: [[35,40,2],[50,35,3],[65,40,2],[60,60,2],[40,58,3]], l: [[0,1],[1,2],[2,3],[3,4],[4,0]] },
  { s: [[30,55,2],[42,46,2],[55,38,3],[68,33,2],[50,62,2],[65,58,3]], l: [[0,1],[1,2],[2,3],[1,4],[4,5]] },
  { s: [[50,25,3],[38,40,2],[42,58,2],[50,65,2],[58,58,2],[62,40,2]], l: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,0]] },
  { s: [[35,45,2],[50,38,3],[65,42,2],[50,60,2],[38,62,2],[62,60,2]], l: [[0,1],[1,2],[1,3],[3,4],[3,5]] },
  { s: [[35,35,2],[48,30,3],[62,32,2],[72,40,2],[65,55,3],[52,62,2],[40,68,2]], l: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6]] },
  { s: [[28,30,2],[44,25,3],[60,28,2],[70,36,3],[67,50,2],[55,60,2],[44,65,2],[32,62,2]], l: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7]] },
  { s: [[35,40,2],[50,35,3],[62,40,2],[70,50,2],[60,62,2],[48,68,3]], l: [[0,1],[1,2],[2,3],[3,4],[4,5]] },
  { s: [[30,65,2],[40,55,2],[52,47,3],[65,44,2],[72,50,2],[65,62,2],[52,65,2]], l: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,0]] },
  { s: [[35,60,2],[48,50,2],[60,44,3],[70,46,2],[68,58,2],[56,64,2]], l: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,1]] },
  { s: [[35,55,2],[50,44,3],[64,42,2],[72,50,2],[65,60,2],[50,62,2]], l: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,1]] },
  { s: [[45,40,2],[55,35,3],[65,40,2],[60,52,2],[48,52,2]], l: [[0,1],[1,2],[2,3],[3,4],[4,0]] },
  { s: [[28,50,2],[40,44,2],[54,42,3],[66,46,2],[74,54,2],[60,60,2],[46,60,2],[36,57,2]], l: [[0,1],[1,2],[2,3],[3,4],[2,5],[5,6],[6,7],[7,0]] },
  { s: [[30,40,2],[50,35,3],[70,40,2],[70,60,2],[50,60,3],[30,60,2]], l: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,0]] },
  { s: [[35,55,2],[48,48,3],[60,42,2],[70,38,2],[55,60,2],[66,65,2]], l: [[0,1],[1,2],[2,3],[1,4],[4,5]] },
  { s: [[25,55,2],[36,48,2],[50,44,3],[62,48,2],[72,55,2],[65,65,2],[50,68,2],[34,64,2]], l: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,0]] },
];

function ConstellationSVG({ idx, size = 150 }: { idx: number; size: number }) {
  const data = NAK_CONST[Math.min(idx, 26)] ?? NAK_CONST[0]!;
  const toC = (v: number) => (v / 100) * size;
  return (
    <Svg width={size} height={size}>
      {data.l.map(([a, b], i) => (
        <SvgLine key={i}
          x1={toC(data.s[a]![0])} y1={toC(data.s[a]![1])}
          x2={toC(data.s[b]![0])} y2={toC(data.s[b]![1])}
          stroke="rgba(255,255,255,0.18)" strokeWidth={0.8} />
      ))}
      {data.s.map(([x, y, sz], i) => (
        <SvgG key={i}>
          {sz === 3 && <SvgCircle cx={toC(x)} cy={toC(y)} r={6} fill="rgba(255,255,255,0.05)" />}
          <SvgCircle cx={toC(x)} cy={toC(y)} r={sz === 3 ? 2.5 : sz === 2 ? 1.6 : 1.0} fill="#FFFFFF" opacity={sz === 3 ? 1 : sz === 2 ? 0.65 : 0.40} />
        </SvgG>
      ))}
    </Svg>
  );
}

const STARS = Array.from({ length: 80 }, (_, i) => ({
  x: ((i * 137.508) % 100),
  y: ((i * 97.333) % 100),
  r: i % 5 === 0 ? 1.6 : i % 3 === 0 ? 1.0 : 0.5,
  opacity: 0.10 + (i % 7) * 0.07,
}));

function StarField() {
  return (
    <Svg style={StyleSheet.absoluteFillObject} viewBox="0 0 100 100" preserveAspectRatio="none">
      {STARS.map((s, i) => (
        <SvgCircle key={i} cx={s.x} cy={s.y} r={s.r} fill="white" opacity={s.opacity} />
      ))}
    </Svg>
  );
}

function MoonSVG({ tithiNum, size }: { tithiNum: number; size: number }) {
  const r = size / 2;
  const isWaxing   = tithiNum <= 15;
  const isPurnima  = tithiNum === 15;
  const isAmavasya = tithiNum === 0 || tithiNum === 30;
  const rawIllum   = isPurnima ? 1 : isAmavasya ? 0
    : isWaxing ? tithiNum / 15
    : 1 - (tithiNum - 15) / 15;
  const moonFill = '#fef3c7';
  const darkFill = '#0c0c1a';
  if (rawIllum < 0.02) return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <SvgCircle cx={r} cy={r} r={r - 0.5} fill={darkFill} stroke="#2d2d4e" strokeWidth={0.8} />
    </Svg>
  );
  if (rawIllum > 0.98) return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <SvgCircle cx={r} cy={r} r={r - 0.5} fill={moonFill} />
    </Svg>
  );
  const rx = Math.max(0.5, r * Math.abs(Math.cos(Math.PI * rawIllum)));
  const outerSweep      = isWaxing ? 1 : 0;
  const terminatorSweep = (isWaxing === (rawIllum >= 0.5)) ? 1 : 0;
  const pathD = `M ${r} 0 A ${r} ${r} 0 1 ${outerSweep} ${r} ${size} A ${rx} ${r} 0 0 ${terminatorSweep} ${r} 0 Z`;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <SvgCircle cx={r} cy={r} r={r - 0.5} fill={darkFill} />
      <SvgPath d={pathD} fill={moonFill} />
    </Svg>
  );
}

function CosmicScoreArc({ score, color, size = 80 }: { score: number; color: string; size?: number }) {
  const R = size / 2 - 8;
  const cx = size / 2;
  const cy = size / 2;
  const startAngle = -210;
  const sweepDeg = 240;
  const prog = (score / 10) * sweepDeg;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const arc = (a: number) => ({ x: cx + R * Math.cos(toRad(a)), y: cy + R * Math.sin(toRad(a)) });
  const trackStart = arc(startAngle);
  const trackEnd   = arc(startAngle + sweepDeg);
  const progEnd    = arc(startAngle + prog);
  const large = prog > 180 ? 1 : 0;
  const trackPath = `M ${trackStart.x} ${trackStart.y} A ${R} ${R} 0 1 1 ${trackEnd.x} ${trackEnd.y}`;
  const progPath  = prog > 1 ? `M ${trackStart.x} ${trackStart.y} A ${R} ${R} 0 ${large} 1 ${progEnd.x} ${progEnd.y}` : '';
  return (
    <Svg width={size} height={size}>
      <SvgPath d={trackPath} stroke="rgba(255,255,255,0.10)" strokeWidth={5} fill="none" strokeLinecap="round" />
      {progPath ? <SvgPath d={progPath} stroke={color} strokeWidth={5} fill="none" strokeLinecap="round" /> : null}
      <SvgCircle cx={cx} cy={cy} r={R - 8} fill={color + '12'} />
    </Svg>
  );
}

// ── Moon cycle bar (30 tithis) ─────────────────────────────────────────────
function MoonCycleBar({ currentTithi }: { currentTithi: number }) {
  const barW = W - 56;
  const dotW = (barW - 58) / 30;
  return (
    <View style={{ marginVertical: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        {Array.from({ length: 30 }, (_, i) => {
          const t = i + 1;
          const isCurr = t === currentTithi;
          const isShukla = t <= 15;
          return (
            <View key={i} style={{
              width: dotW, height: isCurr ? 28 : 16, borderRadius: 6,
              backgroundColor: isCurr ? '#FFFFFF' : isShukla ? 'rgba(255,220,120,0.35)' : 'rgba(150,160,220,0.25)',
              borderWidth: isCurr ? 1 : 0, borderColor: 'rgba(255,255,255,0.50)',
            }} />
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 }}>
        <Text style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', fontWeight: '700' }}>🌑 Amavasya</Text>
        <Text style={{ fontSize: 8, color: '#fbbf2499', fontWeight: '700' }}>🌕 Purnima</Text>
        <Text style={{ fontSize: 8, color: 'rgba(180,160,255,0.40)', fontWeight: '700' }}>🌑 Amavasya</Text>
      </View>
    </View>
  );
}

function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={{
          width: i === current ? 22 : 5, height: 3, borderRadius: 99,
          backgroundColor: i === current ? '#FFFFFF' : 'rgba(255,255,255,0.22)',
        }} />
      ))}
    </View>
  );
}

function DualLabel({ sanskrit, en, skColor = '#FFFFFF', enColor = '#00D4B8', skSize = 14, enSize = 10 }: {
  sanskrit: string; en: string; skColor?: string; enColor?: string; skSize?: number; enSize?: number;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <Text style={{ fontSize: skSize, fontWeight: '900', color: skColor, letterSpacing: -0.2 }}>{en}</Text>
      <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: enColor + '15', borderWidth: 1, borderColor: enColor + '30' }}>
        <Text style={{ fontSize: Math.max(7, enSize - 1), fontWeight: '700', color: enColor + 'AA', letterSpacing: 0.5 }}>{sanskrit}</Text>
      </View>
    </View>
  );
}

function CardShell({ children, gradColors, topVisual }: {
  children: React.ReactNode;
  gradColors: [string, string, string];
  topVisual?: React.ReactNode;
}) {
  const PANEL_H = Math.round(H * 0.60);
  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={gradColors} start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 1 }} style={StyleSheet.absoluteFillObject} />
      <StarField />
      {topVisual && (
        <View style={{
          position: 'absolute', top: 80, left: 0, right: 0,
          bottom: PANEL_H - 44,
          alignItems: 'center', justifyContent: 'center',
        }}>
          {topVisual}
        </View>
      )}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: PANEL_H,
        backgroundColor: 'rgba(4,5,20,0.94)',
        borderTopLeftRadius: 32, borderTopRightRadius: 32,
        borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.09)',
      }}>
        <LinearGradient
          colors={['rgba(255,255,255,0.055)', 'transparent']}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 70, borderTopLeftRadius: 32, borderTopRightRadius: 32 }}
        />
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 96 }}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </View>
    </View>
  );
}

// ── Info pill ─────────────────────────────────────────────────────────────
function InfoPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ flex: 1, borderRadius: 14, borderWidth: 1, borderColor: color + '30', backgroundColor: color + '0C', padding: 12, alignItems: 'center', gap: 3 }}>
      <Text style={{ fontSize: 7, fontWeight: '900', color: color + 'AA', letterSpacing: 1.5 }}>{label}</Text>
      <Text style={{ fontSize: 12, fontWeight: '900', color: '#FFFFFFEE', textAlign: 'center' }}>{value}</Text>
    </View>
  );
}

// ── CARD 1 — HERO (Cosmic Portal) ─────────────────────────────────────────
function Card1Hero({ p, moon, lunar, score, scoreMeta, vaar, onClose }: {
  p: ReturnType<typeof getPanchangData>;
  moon: ReturnType<typeof getMoonPhase>;
  lunar: ReturnType<typeof getNextLunarEvents>;
  score: number;
  scoreMeta: typeof SCORE_META[number];
  vaar: typeof VAARS[number];
  onClose: () => void;
}) {
  const router = useRouter();
  const now = new Date();
  const nextEvent = lunar.daysToFull <= lunar.daysToNew
    ? { label: `Full Moon in ${lunar.daysToFull}d`, color: '#fbbf24', icon: '🌕' }
    : { label: `New Moon in ${lunar.daysToNew}d`,   color: '#a5b4fc', icon: '🌑' };
  const pakshaLabel = p.paksha === 'Shukla' ? 'Shukla Paksha' : 'Krishna Paksha';
  const pakshaEn    = p.paksha === 'Shukla' ? 'Bright Fortnight · Waxing' : 'Dark Fortnight · Waning';
  const sp = TITHI_SPECIAL[p.tithiName];

  return (
    <CardShell
      gradColors={['#030820', '#080f2e', '#020510']}
      topVisual={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 32 }}>
          <View style={{ alignItems: 'center', gap: 8 }}>
            <MoonSVG tithiNum={moon.tithiNum} size={108} />
            <Text style={{ fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.50)' }}>{moon.illumination}% lit</Text>
          </View>
          <View style={{ alignItems: 'center', gap: 5 }}>
            <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
              <CosmicScoreArc score={score} color={scoreMeta.color} size={108} />
              <View style={{ position: 'absolute', alignItems: 'center' }}>
                <Text style={{ fontSize: 28, fontWeight: '900', color: scoreMeta.color }}>{score}</Text>
                <Text style={{ fontSize: 8, fontWeight: '800', color: scoreMeta.color + 'BB' }}>/ 10</Text>
              </View>
            </View>
            <Text style={{ fontSize: 11, fontWeight: '800', color: scoreMeta.color }}>{scoreMeta.label}</Text>
          </View>
        </View>
      }
    >
      {/* Date */}
      <Text style={{ fontSize: 8, fontWeight: '900', color: 'rgba(255,255,255,0.28)', letterSpacing: 3, marginBottom: 4 }}>
        DINACHARYA  ·  DAILY COSMOS
      </Text>
      <Text style={{ fontSize: 22, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5, marginBottom: 6 }}>
        {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
      </Text>
      <DualLabel sanskrit={pakshaLabel} en={pakshaEn} skColor="rgba(255,255,255,0.55)" enColor="rgba(160,180,255,0.75)" skSize={11} enSize={9} />

      {/* Moon cycle bar */}
      <View style={{ marginTop: 14, marginBottom: 2 }}>
        <MoonCycleBar currentTithi={moon.tithiNum} />
      </View>

      {/* Tithi card */}
      <View style={{ borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(255,255,255,0.05)', padding: 14, marginBottom: 10 }}>
        <Text style={{ fontSize: 7.5, fontWeight: '900', color: 'rgba(255,255,255,0.28)', letterSpacing: 2, marginBottom: 8 }}>TITHI  ·  LUNAR DAY</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <DualLabel sanskrit={p.tithiName} en={TITHI_ORDINALS[p.tithiInPaksha] ?? 'Lunar Day'} skSize={22} enSize={10} enColor="#a5b4fc" />
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 6, lineHeight: 16 }}>
              {TITHI_ENERGY[p.tithiName] ?? 'Sacred lunar alignment'}
            </Text>
          </View>
          <Text style={{ fontSize: 28, marginLeft: 8 }}>{moon.emoji}</Text>
        </View>
      </View>

      {/* Special tithi banner */}
      {sp && (
        <View style={{ borderRadius: 16, borderWidth: 1.5, borderColor: sp.color + '50', backgroundColor: sp.color + '12', padding: 14, marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: sp.color + '20', borderWidth: 1, borderColor: sp.color + '50', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 18 }}>{sp.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <DualLabel sanskrit={sp.title} en={sp.en} skColor='#FFFFFF' enColor={sp.color} skSize={13} enSize={9} />
              {sp.fasting && <View style={{ marginTop: 5, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: '#6ee7b730', alignSelf: 'flex-start', borderWidth: 1, borderColor: '#6ee7b760' }}><Text style={{ fontSize: 7.5, fontWeight: '900', color: '#6ee7b7', letterSpacing: 1 }}>FAST DAY</Text></View>}
            </View>
          </View>
          <Text style={{ fontSize: 11.5, color: '#FFFFFFC0', lineHeight: 17, fontWeight: '600' }}>{sp.advice}</Text>
        </View>
      )}

      {/* 3-pill row */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
        <InfoPill label="VAAR" value={ENGLISH_DAYS[p.vaarIdx] ?? ''} color={vaar.color} />
        <InfoPill label="PLANET" value={vaar.planet} color={vaar.color} />
        <InfoPill label={nextEvent.icon + ' NEXT'} value={nextEvent.label} color={nextEvent.color} />
      </View>

      {/* Day energy */}
      <View style={{ borderRadius: 14, borderWidth: 1, borderColor: vaar.color + '22', backgroundColor: 'rgba(255,255,255,0.03)', padding: 14, marginBottom: 12 }}>
        <Text style={{ fontSize: 7.5, fontWeight: '900', color: vaar.color + 'AA', letterSpacing: 1.5, marginBottom: 5 }}>COSMIC ENERGY TODAY</Text>
        <Text style={{ fontSize: 13.5, color: '#FFFFFFCC', fontWeight: '700', lineHeight: 20 }}>{vaar.energy}</Text>
      </View>

      {/* Astral Science CTA */}
      <TouchableOpacity
        onPress={() => { onClose(); setTimeout(() => router.push('/cosmic-science' as never), 300); }}
        activeOpacity={0.82}
        style={{ borderRadius: 16, overflow: 'hidden' }}
      >
        <LinearGradient
          colors={['rgba(251,146,60,0.30)', 'rgba(234,88,12,0.14)', 'rgba(13,4,0,0.92)']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15, paddingHorizontal: 18, borderWidth: 1, borderColor: 'rgba(251,146,60,0.38)', borderRadius: 16 }}
        >
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(251,146,60,0.18)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 20 }}>🔭</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 8, fontWeight: '900', color: 'rgba(251,191,36,0.70)', letterSpacing: 1.5, marginBottom: 3 }}>✦  EXPLORE</Text>
            <Text style={{ fontSize: 13, fontWeight: '900', color: '#FFFFFF' }}>Astral Science</Text>
            <Text style={{ fontSize: 10, color: 'rgba(251,191,36,0.65)', marginTop: 2 }}>The science behind these cosmic cycles →</Text>
          </View>
          <Text style={{ fontSize: 20, color: 'rgba(251,146,60,0.75)', fontWeight: '700' }}>›</Text>
        </LinearGradient>
      </TouchableOpacity>
    </CardShell>
  );
}

// ── CARD 2 — MOON & TITHI ─────────────────────────────────────────────────
function Card2Moon({ p, moon }: {
  p: ReturnType<typeof getPanchangData>;
  moon: ReturnType<typeof getMoonPhase>;
}) {
  const ritual = MOON_RITUALS[moon.emoji] ?? { prompt: 'Lunar energy', action: 'Connect with the moon.' };
  const deity  = TITHI_DEITY[p.tithiName] ?? 'Sacred alignment';
  const sp = TITHI_SPECIAL[p.tithiName];
  const pakshaDesc = p.paksha === 'Shukla'
    ? 'Shukla Paksha is the waxing fortnight — New Moon to Full Moon. Energy builds, expands, and manifests. Ideal for growth, new starts, and increasing anything positive.'
    : 'Krishna Paksha is the waning fortnight — Full Moon to New Moon. Energy turns inward. Ideal for completing, clearing, fasting, and deep reflection.';

  const moonPhaseFact: Record<string, string> = {
    '🌑': 'At New Moon, Sun and Moon align — their gravitational vectors conjoin, creating peak combined tidal force on Earth\'s bodies of water and cerebrospinal fluid.',
    '🌒': 'The waxing crescent rises 2–3h after sunset. Symbolically a bow ready to launch — energy is building and directional.',
    '🌓': 'First Quarter: the Moon has completed 1/4 of its orbit. The terminator (shadow boundary) runs perfectly straight — balance of dark and light.',
    '🌔': 'Waxing Gibbous: more than half the Moon\'s face is lit. "Gibbous" comes from Latin for hump-backed. Building toward maximum.',
    '🌕': 'Full Moon: Moon is directly opposite the Sun. Rises at sunset, sets at sunrise. Intracranial fluid measurably peaks — emotional and creative intensity highest.',
    '🌖': 'Waning Gibbous: the Moon rises ~1h after sunset. Electromagnetic field measurements show changes in plant transpiration during this phase.',
    '🌗': 'Last Quarter: 3/4 of orbit complete. Traditionally the best phase for release, forgiveness, and light fasting.',
    '🌘': 'Waning Crescent: the thinnest sliver before New Moon — the "balsamic moon" of completion, rest, and preparation for the next cycle.',
  };

  return (
    <CardShell
      gradColors={['#070520', '#0d0835', '#040310']}
      topVisual={
        <View style={{ alignItems: 'center' }}>
          <View style={{ position: 'absolute', width: 196, height: 196, borderRadius: 98, backgroundColor: 'rgba(165,180,252,0.04)' }} />
          <View style={{ position: 'absolute', width: 154, height: 154, borderRadius: 77, backgroundColor: 'rgba(165,180,252,0.06)' }} />
          <MoonSVG tithiNum={moon.tithiNum} size={126} />
          <Text style={{ fontSize: 18, fontWeight: '900', color: '#FFFFFF', marginTop: 12 }}>{moon.name}</Text>
          <Text style={{ fontSize: 11, color: 'rgba(180,180,255,0.65)', fontWeight: '700', marginTop: 3 }}>{moon.illumination}% illuminated · {moon.emoji}</Text>
        </View>
      }
    >
      {/* Section header */}
      <DualLabel sanskrit="Chandra" en="Moon · Lunar Science" skColor="rgba(180,180,255,0.85)" enColor="#a5b4fc" skSize={11} enSize={9} />

      {/* Paksha */}
      <View style={{ borderRadius: 16, borderWidth: 1, borderColor: 'rgba(180,180,255,0.14)', backgroundColor: 'rgba(180,180,255,0.06)', padding: 15, marginTop: 14, marginBottom: 10 }}>
        <DualLabel
          sanskrit={p.paksha === 'Shukla' ? 'Shukla Paksha' : 'Krishna Paksha'}
          en={p.paksha === 'Shukla' ? 'Waxing Fortnight' : 'Waning Fortnight'}
          skColor='#FFFFFF' enColor="rgba(180,180,255,0.80)" skSize={15} enSize={10}
        />
        <Text style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.70)', lineHeight: 19, fontWeight: '600', marginTop: 10 }}>{pakshaDesc}</Text>
      </View>

      {/* Tithi */}
      <View style={{ borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(255,255,255,0.04)', padding: 15, marginBottom: 10 }}>
        <Text style={{ fontSize: 7.5, fontWeight: '900', color: 'rgba(255,255,255,0.28)', letterSpacing: 2, marginBottom: 8 }}>TITHI  ·  LUNAR DAY {p.tithiInPaksha}</Text>
        <DualLabel sanskrit={p.tithiName} en={TITHI_ORDINALS[p.tithiInPaksha] ?? 'Lunar Day'} skSize={24} enSize={10} enColor="#a5b4fc" />
        <Text style={{ fontSize: 11, color: 'rgba(180,180,255,0.65)', fontWeight: '700', marginTop: 6 }}>{deity}</Text>
        <Text style={{ fontSize: 12.5, color: '#FFFFFFCC', fontWeight: '700', lineHeight: 18, marginTop: 8 }}>
          {TITHI_ENERGY[p.tithiName] ?? 'Sacred cosmic alignment'}
        </Text>
      </View>

      {/* Special tithi */}
      {sp && (
        <View style={{ borderRadius: 16, borderWidth: 1.5, borderColor: sp.color + '50', backgroundColor: sp.color + '12', padding: 15, marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: sp.color + '20', borderWidth: 1, borderColor: sp.color + '50', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 17 }}>{sp.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <DualLabel sanskrit={sp.title} en={sp.en} skColor='#FFFFFF' enColor={sp.color} skSize={13} enSize={9} />
              {sp.fasting && <View style={{ marginTop: 4, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: '#6ee7b730', alignSelf: 'flex-start', borderWidth: 1, borderColor: '#6ee7b760' }}><Text style={{ fontSize: 7.5, fontWeight: '900', color: '#6ee7b7', letterSpacing: 1 }}>FAST DAY</Text></View>}
            </View>
          </View>
          <Text style={{ fontSize: 12, color: '#FFFFFFC0', lineHeight: 18, fontWeight: '600', marginBottom: 10 }}>{sp.advice}</Text>
          <View style={{ borderRadius: 10, borderWidth: 1, borderColor: sp.color + '30', backgroundColor: 'rgba(0,0,0,0.20)', padding: 10 }}>
            <Text style={{ fontSize: 8, fontWeight: '900', color: sp.color + 'BB', letterSpacing: 1.5, marginBottom: 4 }}>MODERN SCIENCE</Text>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.60)', lineHeight: 16 }}>{sp.scienceLine}</Text>
          </View>
        </View>
      )}

      {/* Moon phase science */}
      <View style={{ borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 14, marginBottom: 10 }}>
        <Text style={{ fontSize: 7.5, fontWeight: '900', color: 'rgba(180,180,255,0.42)', letterSpacing: 2, marginBottom: 7 }}>MOON SCIENCE  ·  CHANDRA VIGYAN</Text>
        <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.60)', lineHeight: 18, fontWeight: '500' }}>
          {moonPhaseFact[moon.emoji] ?? "The Moon's gravitational pull modulates Earth's tides, atmosphere, and cerebrospinal fluid."}
        </Text>
      </View>

      {/* Ritual */}
      <View style={{ borderRadius: 16, borderWidth: 1, borderColor: 'rgba(180,180,255,0.22)', backgroundColor: 'rgba(180,180,255,0.07)', padding: 15 }}>
        <Text style={{ fontSize: 7.5, fontWeight: '900', color: 'rgba(180,180,255,0.50)', letterSpacing: 2, marginBottom: 8 }}>MOON RITUAL  ·  CHANDRA SADHANA</Text>
        <Text style={{ fontSize: 11, color: 'rgba(180,180,255,0.70)', fontWeight: '700', marginBottom: 6 }}>{ritual.prompt}</Text>
        <Text style={{ fontSize: 15, fontWeight: '800', color: '#FFFFFF', lineHeight: 22 }}>{ritual.action}</Text>
      </View>
    </CardShell>
  );
}

// ── CARD 3 — NAKSHATRA ────────────────────────────────────────────────────
function Card3Nakshatra({ nakshatraIdx }: { nakshatraIdx: number }) {
  const n = NAKSHATRAS[nakshatraIdx]!;
  const pada = Math.floor((nakshatraIdx % 1) * 4) + 1;
  const allPadas = ['Dharma · Aries', 'Artha · Taurus', 'Kama · Gemini', 'Moksha · Cancer'];

  return (
    <CardShell
      gradColors={['#020d1a', '#071525', '#02080e']}
      topVisual={
        <View style={{ alignItems: 'center', gap: 8 }}>
          <ConstellationSVG idx={nakshatraIdx} size={150} />
          <Text style={{ fontSize: 8, color: 'rgba(0,212,184,0.55)', fontWeight: '700', letterSpacing: 2 }}>
            {n.constellation?.toUpperCase()}  ·  LUNAR MANSION
          </Text>
        </View>
      }
    >
      <DualLabel sanskrit="Nakshatra" en="Star Mansion · 27 Lunar Stations" skColor="rgba(0,212,184,0.85)" enColor="#00D4B8" skSize={11} enSize={9} />

      {/* Hero name */}
      <View style={{ marginTop: 14, marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <DualLabel sanskrit={n.name} en={n.en} skSize={20} enSize={10} enColor="#00D4B8" />
          <Text style={{ fontSize: 22 }}>{n.emoji}</Text>
        </View>
        <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', fontWeight: '700' }}>
          In {n.constellation} · Moon is here right now
        </Text>
      </View>

      {/* Deity + Planet */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
        <View style={{ flex: 1, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(0,212,184,0.20)', backgroundColor: 'rgba(0,212,184,0.07)', padding: 13 }}>
          <Text style={{ fontSize: 7, fontWeight: '900', color: 'rgba(0,212,184,0.55)', letterSpacing: 1.5, marginBottom: 5 }}>DEITY  ·  DEVATA</Text>
          <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#FFFFFFEE', lineHeight: 17 }}>{n.deity}</Text>
        </View>
        <View style={{ flex: 1, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(180,180,255,0.20)', backgroundColor: 'rgba(180,180,255,0.06)', padding: 13 }}>
          <Text style={{ fontSize: 7, fontWeight: '900', color: 'rgba(180,180,255,0.55)', letterSpacing: 1.5, marginBottom: 5 }}>PLANET  ·  GRAHA</Text>
          <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#FFFFFFEE', lineHeight: 17 }}>{n.planet}</Text>
        </View>
      </View>

      {/* Energy */}
      <View style={{ borderRadius: 16, borderWidth: 1, borderColor: 'rgba(0,212,184,0.14)', backgroundColor: 'rgba(0,212,184,0.05)', padding: 15, marginBottom: 12 }}>
        <Text style={{ fontSize: 7.5, fontWeight: '900', color: 'rgba(0,212,184,0.50)', letterSpacing: 2, marginBottom: 8 }}>NAKSHATRA ENERGY  ·  TODAY</Text>
        <Text style={{ fontSize: 13.5, color: '#FFFFFFCC', lineHeight: 21, fontWeight: '600' }}>{n.energy}</Text>
      </View>

      {/* Science */}
      <View style={{ borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.03)', padding: 13, marginBottom: 12 }}>
        <Text style={{ fontSize: 7.5, fontWeight: '900', color: 'rgba(255,255,255,0.28)', letterSpacing: 2, marginBottom: 7 }}>WHAT IS A NAKSHATRA?</Text>
        <Text style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)', lineHeight: 18 }}>
          The zodiac is divided into 27 Nakshatras of 13.33° each. The Moon transits one every ~27 hours. These are real star clusters — confirmed by modern astronomy.
        </Text>
      </View>

      {/* Pada strip */}
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {allPadas.map((padaLabel, i) => (
          <View key={i} style={{
            flex: 1, borderRadius: 10, borderWidth: 1,
            borderColor: i + 1 === pada ? 'rgba(0,212,184,0.55)' : 'rgba(255,255,255,0.08)',
            backgroundColor: i + 1 === pada ? 'rgba(0,212,184,0.15)' : 'rgba(255,255,255,0.03)',
            padding: 8, alignItems: 'center', gap: 3,
          }}>
            <Text style={{ fontSize: 11, fontWeight: '900', color: i + 1 === pada ? '#00D4B8' : 'rgba(255,255,255,0.25)' }}>P{i + 1}</Text>
            <Text style={{ fontSize: 6.5, color: i + 1 === pada ? 'rgba(0,212,184,0.80)' : 'rgba(255,255,255,0.20)', fontWeight: '700', textAlign: 'center', lineHeight: 9 }}>
              {padaLabel.split(' · ')[0]}
            </Text>
          </View>
        ))}
      </View>
    </CardShell>
  );
}

// ── CARD 4 — YOGA ─────────────────────────────────────────────────────────
function Card4Yoga({ p }: { p: ReturnType<typeof getPanchangData> }) {
  const yoga = YOGAS[p.yogaIdx]!;
  const yogaColor = yoga.auspicious ? '#34d399' : '#f87171';
  const sunLongDeg = Math.round(p.sunLong);
  const moonLongDeg = Math.round(p.moonLong);
  const yogaLong = ((p.sunLong + p.moonLong) % 360 + 360) % 360;

  return (
    <CardShell
      gradColors={['#080414', '#0d0525', '#04020e']}
      topVisual={
        <View style={{ alignItems: 'center', paddingHorizontal: 20 }}>
          <Svg width={W - 72} height={64}>
            <SvgPath d={`M 28 32 L ${W - 100} 32`} stroke="rgba(255,255,255,0.10)" strokeWidth={1.5} />
            <SvgCircle cx={28} cy={32} r={16} fill="#fbbf2418" stroke="#fbbf24" strokeWidth={1.5} />
            <SvgCircle cx={28} cy={32} r={8} fill="#fbbf24" />
            <SvgCircle cx={Math.min(W - 100, 28 + ((yogaLong / 360) * (W - 132)))} cy={32} r={13} fill="#a5b4fc18" stroke="#a5b4fc" strokeWidth={1.5} />
            <SvgCircle cx={Math.min(W - 100, 28 + ((yogaLong / 360) * (W - 132)))} cy={32} r={6.5} fill="#a5b4fc" />
          </Svg>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: W - 72, marginTop: 4 }}>
            <Text style={{ fontSize: 9, color: '#fbbf2499', fontWeight: '700' }}>Surya  {sunLongDeg}°</Text>
            <Text style={{ fontSize: 9, color: yogaColor + 'CC', fontWeight: '900' }}>{Math.round(yogaLong)}° combined</Text>
            <Text style={{ fontSize: 9, color: '#a5b4fc99', fontWeight: '700' }}>Chandra  {moonLongDeg}°</Text>
          </View>
          <View style={{ alignItems: 'center', marginTop: 16 }}>
            <DualLabel sanskrit={yoga.name} en={yoga.en} skColor='#FFFFFF' enColor={yogaColor} skSize={30} enSize={12} />
            <View style={{ marginTop: 8, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: yogaColor + '14', borderWidth: 1, borderColor: yogaColor + '35' }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: yogaColor }}>{yoga.auspicious ? '✓ Auspicious' : '⚠ Inauspicious'}</Text>
            </View>
          </View>
        </View>
      }
    >
      <DualLabel sanskrit="Yoga" en="Sun-Moon Union · Daily Quality" skColor="rgba(52,211,153,0.80)" enColor={yogaColor} skSize={11} enSize={9} />

      <View style={{ borderRadius: 16, borderWidth: 1, borderColor: yogaColor + '25', backgroundColor: yogaColor + '08', padding: 15, marginTop: 14, marginBottom: 12 }}>
        <Text style={{ fontSize: 7.5, fontWeight: '900', color: yogaColor + 'AA', letterSpacing: 2, marginBottom: 7 }}>MEANING TODAY</Text>
        <Text style={{ fontSize: 15, fontWeight: '800', color: '#FFFFFF', lineHeight: 22 }}>{yoga.meaning}</Text>
      </View>

      <View style={{ borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.03)', padding: 13, marginBottom: 12 }}>
        <Text style={{ fontSize: 7.5, fontWeight: '900', color: 'rgba(255,255,255,0.28)', letterSpacing: 2, marginBottom: 7 }}>SCIENCE OF 27 YOGAS</Text>
        <Text style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)', lineHeight: 18 }}>
          A Yoga is formed by the combined longitude of the Sun and Moon — 27 equal 13.3° segments. As Sun moves ~1°/day and Moon ~13°/day, a new yoga begins every ~24 hours.
        </Text>
      </View>

      <View style={{ borderRadius: 16, borderWidth: 1, borderColor: yogaColor + '35', backgroundColor: yogaColor + '10', padding: 16 }}>
        <Text style={{ fontSize: 7.5, fontWeight: '900', color: yogaColor + 'BB', letterSpacing: 2, marginBottom: 7 }}>COSMIC GUIDANCE</Text>
        <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFFFFF', lineHeight: 21 }}>
          {yoga.auspicious
            ? `Yoga energy supports action. Begin important tasks and take inspired steps. The ${yoga.name} yoga amplifies: ${yoga.meaning}`
            : `Yoga energy favors restraint. Complete existing work and reflect deeply. Let ${yoga.name}'s energy guide you inward.`}
        </Text>
      </View>
    </CardShell>
  );
}

// ── CARD 5 — VAAR (PLANETARY DAY) ─────────────────────────────────────────
function Card5Vaar({ p, vaar }: {
  p: ReturnType<typeof getPanchangData>;
  vaar: typeof VAARS[number];
}) {
  const vaarAction = VAAR_ACTIONS[p.vaarIdx] ?? '';
  const planetColors: Record<string, [string,string,string]> = {
    Sun:     ['#1a0a00','#2a1000','#0d0500'],
    Moon:    ['#030d1a','#061525','#020810'],
    Mars:    ['#1a0404','#2a0808','#0d0202'],
    Mercury: ['#011a0a','#022a12','#010d05'],
    Jupiter: ['#0d0e00','#1a1a00','#060700'],
    Venus:   ['#1a001a','#280028','#0d000d'],
    Saturn:  ['#060614','#0c0c28','#030308'],
  };
  const gradColors = planetColors[vaar.planet] ?? ['#080410','#0d0622','#030208'];
  const hourlyOrder = ['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn'];
  const todayIdx = hourlyOrder.indexOf(vaar.planet);

  return (
    <CardShell
      gradColors={gradColors as [string,string,string]}
      topVisual={
        <View style={{ alignItems: 'center', gap: 12 }}>
          <View style={{ width: 112, height: 112, borderRadius: 56, backgroundColor: vaar.color + '14', borderWidth: 2, borderColor: vaar.color + '50', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 58 }}>{vaar.emoji}</Text>
          </View>
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 26, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.6 }}>{ENGLISH_DAYS[p.vaarIdx]}</Text>
            <DualLabel sanskrit={vaar.vedicName} en={vaar.planet + ' rules today'} skColor={vaar.color} enColor={vaar.color + 'BB'} skSize={13} enSize={10} />
          </View>
        </View>
      }
    >
      <DualLabel sanskrit="Vaar" en="Planetary Day · Cosmic Ruler" skColor={vaar.color + 'CC'} enColor={vaar.color} skSize={11} enSize={9} />

      {/* 7-day strip */}
      <View style={{ borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.03)', padding: 14, marginTop: 14, marginBottom: 12 }}>
        <Text style={{ fontSize: 7.5, fontWeight: '900', color: 'rgba(255,255,255,0.28)', letterSpacing: 2, marginBottom: 10 }}>SAPTA VAAR  ·  7 PLANETARY DAYS</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {['☀️','🌙','🔴','💚','🌟','💗','🪐'].map((em, i) => (
            <View key={i} style={{ alignItems: 'center', gap: 4 }}>
              <View style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: i === todayIdx ? vaar.color + '30' : 'rgba(255,255,255,0.04)',
                borderWidth: i === todayIdx ? 2 : 0.5,
                borderColor: i === todayIdx ? vaar.color + '80' : 'rgba(255,255,255,0.10)',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 17 }}>{em}</Text>
              </View>
              <Text style={{ fontSize: 7, color: i === todayIdx ? vaar.color : 'rgba(255,255,255,0.25)', fontWeight: i === todayIdx ? '900' : '600' }}>
                {['SUN','MON','TUE','WED','THU','FRI','SAT'][i]}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{ borderRadius: 16, borderWidth: 1, borderColor: vaar.color + '22', backgroundColor: vaar.color + '08', padding: 15, marginBottom: 12 }}>
        <Text style={{ fontSize: 7.5, fontWeight: '900', color: vaar.color + 'AA', letterSpacing: 2, marginBottom: 7 }}>PLANETARY ENERGY  ·  GRAHA SHAKTI</Text>
        <Text style={{ fontSize: 15, fontWeight: '800', color: '#FFFFFF', lineHeight: 22 }}>{vaar.energy}</Text>
      </View>

      <View style={{ borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.03)', padding: 13, marginBottom: 12 }}>
        <Text style={{ fontSize: 7.5, fontWeight: '900', color: 'rgba(255,255,255,0.28)', letterSpacing: 2, marginBottom: 7 }}>CHRONOBIOLOGY  ·  MODERN SCIENCE</Text>
        <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.60)', lineHeight: 18, fontWeight: '500' }}>{vaar.science}</Text>
      </View>

      <View style={{ borderRadius: 16, borderWidth: 1, borderColor: vaar.color + '40', backgroundColor: vaar.color + '12', padding: 16 }}>
        <Text style={{ fontSize: 7.5, fontWeight: '900', color: vaar.color + 'BB', letterSpacing: 2, marginBottom: 7 }}>YOUR ACTION TODAY  ·  KARMA</Text>
        <Text style={{ fontSize: 15, fontWeight: '800', color: '#FFFFFF', lineHeight: 22 }}>{vaarAction}</Text>
      </View>
    </CardShell>
  );
}

// ── CARD 6 — VEDIC MONTH ─────────────────────────────────────────────────
function Card6Month({ p }: { p: ReturnType<typeof getPanchangData> }) {
  const vedicMonth = getVedicMonth();
  const monthIdx = RASHI_TO_VEDIC_MONTH.findIndex(m => m.name === vedicMonth.name);

  return (
    <CardShell
      gradColors={['#050215', '#0a0530', '#020108']}
      topVisual={
        <View style={{ alignItems: 'center', gap: 6, paddingHorizontal: 20 }}>
          <Text style={{ fontSize: 46, fontWeight: '900', color: '#FFFFFF', letterSpacing: -1.2 }}>{vedicMonth.name}</Text>
          <DualLabel sanskrit={vedicMonth.rashi} en={vedicMonth.en} skColor="rgba(167,139,250,0.85)" enColor="#a78bfa" skSize={16} enSize={12} />
          <Text style={{ fontSize: 11, color: 'rgba(167,139,250,0.55)', fontWeight: '600', marginTop: 2, textAlign: 'center' }}>{vedicMonth.season}</Text>
        </View>
      }
    >
      <DualLabel sanskrit="Masa" en="Vedic Solar Month · 12 Rashi Cycle" skColor="rgba(167,139,250,0.85)" enColor="#a78bfa" skSize={11} enSize={9} />

      {/* 12-month grid */}
      <View style={{ borderRadius: 16, borderWidth: 1, borderColor: 'rgba(167,139,250,0.12)', backgroundColor: 'rgba(167,139,250,0.04)', padding: 14, marginTop: 14, marginBottom: 12 }}>
        <Text style={{ fontSize: 7.5, fontWeight: '900', color: 'rgba(167,139,250,0.50)', letterSpacing: 2, marginBottom: 12 }}>
          DVADASHA MASA  ·  12 VEDIC MONTHS
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {RASHI_TO_VEDIC_MONTH.map((m, i) => (
            <View key={i} style={{
              borderRadius: 8, paddingVertical: 5, paddingHorizontal: 9,
              backgroundColor: i === monthIdx ? 'rgba(167,139,250,0.28)' : 'rgba(255,255,255,0.04)',
              borderWidth: 1, borderColor: i === monthIdx ? 'rgba(167,139,250,0.65)' : 'rgba(255,255,255,0.08)',
            }}>
              <Text style={{ fontSize: 10, fontWeight: i === monthIdx ? '900' : '600', color: i === monthIdx ? '#FFFFFF' : 'rgba(255,255,255,0.35)' }}>
                {m.name}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* What is Vedic Month */}
      <View style={{ borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.03)', padding: 14, marginBottom: 12 }}>
        <Text style={{ fontSize: 7.5, fontWeight: '900', color: 'rgba(255,255,255,0.28)', letterSpacing: 2, marginBottom: 7 }}>WHAT IS THE VEDIC MONTH?</Text>
        <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 18 }}>
          Unlike the Gregorian calendar, the Vedic solar month tracks the Sun's passage through each of the 12 Rashis (zodiac signs). Each month carries distinct energy tied to the Sun's position and seasonal rhythm.
        </Text>
      </View>

      {/* Lunar context */}
      <View style={{ borderRadius: 16, borderWidth: 1, borderColor: 'rgba(167,139,250,0.20)', backgroundColor: 'rgba(167,139,250,0.07)', padding: 15 }}>
        <Text style={{ fontSize: 7.5, fontWeight: '900', color: 'rgba(167,139,250,0.55)', letterSpacing: 2, marginBottom: 8 }}>LUNAR CONTEXT  ·  CHANDRA SANDARBHA</Text>
        <DualLabel
          sanskrit={p.paksha === 'Shukla' ? 'Shukla Paksha' : 'Krishna Paksha'}
          en={p.tithiName + ' · Day ' + p.tithiInPaksha}
          skColor='#FFFFFF' enColor="rgba(167,139,250,0.75)" skSize={14} enSize={10}
        />
        <Text style={{ fontSize: 12, color: 'rgba(167,139,250,0.70)', fontWeight: '600', marginTop: 8, lineHeight: 18 }}>
          {TITHI_ENERGY[p.tithiName] ?? 'Sacred lunar alignment with the Vedic calendar'}
        </Text>
      </View>
    </CardShell>
  );
}

// ── CARD 7 — GRAND SYNTHESIS (→ cosmic-science swipe) ────────────────────
function Card7Synthesis({ p, moon, score, scoreMeta, onClose }: {
  p: ReturnType<typeof getPanchangData>;
  moon: ReturnType<typeof getMoonPhase>;
  score: number;
  scoreMeta: typeof SCORE_META[number];
  onClose: () => void;
}) {
  const router = useRouter();
  const nakshatra = NAKSHATRAS[p.nakshatraIdx]!;
  const yoga = YOGAS[p.yogaIdx]!;
  const vaar = VAARS[p.vaarIdx]!;
  const vedicMonth = getVedicMonth();

  const goDeepDive = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
    setTimeout(() => router.push('/cosmic-daily' as never), 300);
  };
  const goScience = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onClose();
    setTimeout(() => router.push('/cosmic-science' as never), 300);
  };

  const LIMB_COLORS = ['#a5b4fc', vaar.color, '#00D4B8', yoga.auspicious ? '#34d399' : '#f87171', '#c084fc'];
  const limbs = [
    { label: 'TITHI',     en: 'Lunar Day',      val: p.tithiName,            sub: TITHI_ENERGY[p.tithiName] ?? '',                                         color: LIMB_COLORS[0]! },
    { label: 'VAAR',      en: 'Planetary Day',  val: ENGLISH_DAYS[p.vaarIdx]!, sub: vaar.vedicName + ' · ' + vaar.planet,                                  color: LIMB_COLORS[1]! },
    { label: 'NAKSHATRA', en: 'Star Mansion',   val: nakshatra.name,          sub: nakshatra.en + ' · ' + nakshatra.constellation,                          color: LIMB_COLORS[2]! },
    { label: 'YOGA',      en: 'Sun-Moon Union', val: yoga.name,               sub: yoga.en + (yoga.auspicious ? ' · ✓ Auspicious' : ' · ⚠ Inauspicious'),  color: LIMB_COLORS[3]! },
    { label: 'MASA',      en: 'Solar Month',    val: vedicMonth.name,         sub: vedicMonth.rashi + ' · ' + vedicMonth.en,                                color: LIMB_COLORS[4]! },
  ];

  return (
    <CardShell
      gradColors={['#040118', '#080230', '#020010']}
      topVisual={
        <View style={{ alignItems: 'center', gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {limbs.map((l, i) => (
              <View key={i} style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: l.color + '14', borderWidth: 1.5, borderColor: l.color + '55', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 7, fontWeight: '900', color: l.color, textAlign: 'center', lineHeight: 10 }}>{l.label}</Text>
              </View>
            ))}
          </View>
          <DualLabel sanskrit="Panchanga" en="Five Limbs of Vedic Time" skColor="rgba(192,132,252,0.85)" enColor="#c084fc" skSize={16} enSize={11} />
        </View>
      }
    >
      <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', fontWeight: '600', marginBottom: 16, lineHeight: 18 }}>
        Your complete cosmic picture for today
      </Text>

      {/* 5-limb table */}
      <View style={{ borderRadius: 18, borderWidth: 1, borderColor: 'rgba(192,132,252,0.15)', backgroundColor: 'rgba(192,132,252,0.05)', padding: 8, marginBottom: 16 }}>
        {limbs.map((l, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 12, borderTopWidth: i > 0 ? 0.5 : 0, borderTopColor: 'rgba(255,255,255,0.07)' }}>
            <View style={{ width: 4, height: 36, borderRadius: 2, backgroundColor: l.color }} />
            <View style={{ width: 72 }}>
              <Text style={{ fontSize: 7.5, fontWeight: '900', color: l.color + 'BB', letterSpacing: 1.5 }}>{l.label}</Text>
              <Text style={{ fontSize: 8, color: l.color + '70', fontWeight: '700' }}>{l.en}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#FFFFFF', lineHeight: 17 }}>{l.val}</Text>
              <Text style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.38)', fontWeight: '600', marginTop: 2, lineHeight: 13 }}>{l.sub}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Score recap */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, borderWidth: 1, borderColor: scoreMeta.color + '30', backgroundColor: scoreMeta.color + '0A', padding: 14, marginBottom: 16 }}>
        <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
          <CosmicScoreArc score={score} color={scoreMeta.color} size={68} />
          <View style={{ position: 'absolute' }}>
            <Text style={{ fontSize: 18, fontWeight: '900', color: scoreMeta.color, textAlign: 'center' }}>{score}</Text>
            <Text style={{ fontSize: 7, color: scoreMeta.color + '99', textAlign: 'center', fontWeight: '700' }}>/10</Text>
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 8, fontWeight: '900', color: scoreMeta.color + 'BB', letterSpacing: 2, marginBottom: 3 }}>COSMIC SCORE  ·  BRAHMANDA SCORE</Text>
          <Text style={{ fontSize: 17, fontWeight: '900', color: scoreMeta.color }}>{scoreMeta.label}</Text>
          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.50)', fontWeight: '600', marginTop: 4, lineHeight: 15 }}>{scoreMeta.desc}</Text>
        </View>
      </View>

      {/* CTA: Full Cosmic Guide */}
      <TouchableOpacity onPress={goDeepDive} activeOpacity={0.82} style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 10 }}>
        <LinearGradient colors={['#3b0764','#6d28d9','#4c1d95']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, paddingHorizontal: 20 }}>
          <Text style={{ fontSize: 22 }}>🌌</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '900', color: '#FFFFFF' }}>Full Cosmic Guide</Text>
            <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.58)', marginTop: 2 }}>Detailed Panchanga deep-dive →</Text>
          </View>
          <Text style={{ fontSize: 18, color: '#FFFFFF80', fontWeight: '700' }}>›</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* CTA: Astral Science */}
      <TouchableOpacity onPress={goScience} activeOpacity={0.82} style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
        <LinearGradient colors={['rgba(251,146,60,0.28)', 'rgba(234,88,12,0.13)', 'rgba(13,4,0,0.95)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, paddingHorizontal: 20, borderWidth: 1, borderColor: 'rgba(251,146,60,0.38)', borderRadius: 16 }}>
          <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: 'rgba(251,146,60,0.18)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 22 }}>🔭</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 8, fontWeight: '900', color: 'rgba(251,191,36,0.70)', letterSpacing: 1.5, marginBottom: 3 }}>✦  EXPLORE</Text>
            <Text style={{ fontSize: 14, fontWeight: '900', color: '#FFFFFF' }}>Astral Science</Text>
            <Text style={{ fontSize: 10, color: 'rgba(251,191,36,0.65)', marginTop: 2 }}>Science of cosmic cycles · for all humanity →</Text>
          </View>
          <Text style={{ fontSize: 18, color: 'rgba(251,146,60,0.80)', fontWeight: '700' }}>›</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Universal declaration */}
      <View style={{ borderRadius: 14, borderWidth: 1, borderColor: 'rgba(0,212,184,0.18)', backgroundColor: 'rgba(0,212,184,0.05)', padding: 14 }}>
        <Text style={{ fontSize: 7.5, fontWeight: '900', color: 'rgba(0,212,184,0.55)', letterSpacing: 1.5, marginBottom: 7 }}>JAGAT VIGYAN  ·  UNIVERSAL DECLARATION</Text>
        <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.58)', lineHeight: 19 }}>
          Vedic Jyotish is a universal science of natural cycles. It belongs to every human being, regardless of faith, culture, or nationality. The sky is humanity's shared heritage.
        </Text>
      </View>
    </CardShell>
  );
}

// ── Main Modal ─────────────────────────────────────────────────────────────
export default function CosmicStoryModal({
  solarTimes,
  onClose,
}: {
  solarTimes: SolarTimes | null;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const TOTAL = 7;

  const p         = React.useMemo(() => getPanchangData(), []);
  const moon      = React.useMemo(() => getMoonPhase(), []);
  const lunar     = React.useMemo(() => getNextLunarEvents(), []);
  const vaar      = VAARS[p.vaarIdx]!;
  const score     = getCosmicScore(YOGAS[p.yogaIdx]?.auspicious ?? true, moon.emoji, p.tithiName);
  const scoreMeta = SCORE_META[score] ?? SCORE_META[5]!;

  const navigate = useCallback((dir: 'next' | 'prev') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 80, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 130, useNativeDriver: true }),
    ]).start();
    if (dir === 'next') {
      if (idx < TOTAL - 1) setIdx(i => i + 1);
      else onClose();
    } else {
      if (idx > 0) setIdx(i => i - 1);
    }
  }, [idx, fadeAnim, onClose]);

  const CARD_LABELS = ['Daily Cosmos','Moon & Tithi','Star Mansion','Sun-Moon Union','Planet Day','Solar Month','Five Limbs'];

  const CARDS = [
    <Card1Hero p={p} moon={moon} lunar={lunar} score={score} scoreMeta={scoreMeta} vaar={vaar} onClose={onClose} key={0} />,
    <Card2Moon p={p} moon={moon} key={1} />,
    <Card3Nakshatra nakshatraIdx={p.nakshatraIdx} key={2} />,
    <Card4Yoga p={p} key={3} />,
    <Card5Vaar p={p} vaar={vaar} key={4} />,
    <Card6Month p={p} key={5} />,
    <Card7Synthesis p={p} moon={moon} score={score} scoreMeta={scoreMeta} onClose={onClose} key={6} />,
  ];

  return (
    <Modal visible animationType="fade" transparent statusBarTranslucent onRequestClose={onClose}>
      <StatusBar barStyle="light-content" />
      <View style={{ flex: 1, backgroundColor: '#020510' }}>
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          {CARDS[idx]}
        </Animated.View>

        {/* Progress + close */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 56, paddingHorizontal: 20, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }} pointerEvents="box-none">
          <ProgressDots total={TOTAL} current={idx} />
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onClose(); }}
            hitSlop={{ top: 14, right: 14, bottom: 14, left: 14 }}
            style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.70)', fontWeight: '700', lineHeight: 16 }}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Tap zones */}
        <View style={{ position: 'absolute', top: 100, bottom: 120, left: 0, width: W * 0.30 }}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => navigate('prev')} activeOpacity={1} />
        </View>
        <View style={{ position: 'absolute', top: 100, bottom: 120, right: 0, width: W * 0.30 }}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => navigate('next')} activeOpacity={1} />
        </View>

        {/* Bottom nav */}
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: 40, paddingHorizontal: 24, paddingTop: 14 }}>
          <LinearGradient colors={['transparent', 'rgba(2,5,16,0.92)']} style={StyleSheet.absoluteFillObject} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <TouchableOpacity onPress={() => navigate('prev')} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, opacity: idx === 0 ? 0.20 : 0.75 }}>
              <Text style={{ fontSize: 18, color: '#FFFFFF', fontWeight: '700' }}>‹</Text>
              <Text style={{ fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.75)', letterSpacing: 0.5 }}>PREV</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 9, fontWeight: '900', color: 'rgba(255,255,255,0.35)', letterSpacing: 1.5 }}>
              {CARD_LABELS[idx]}
            </Text>
            <TouchableOpacity onPress={() => navigate('next')} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.75)', letterSpacing: 0.5 }}>
                {idx === TOTAL - 1 ? 'CLOSE' : 'NEXT'}
              </Text>
              <Text style={{ fontSize: 18, color: '#FFFFFF', fontWeight: '700' }}>›</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
