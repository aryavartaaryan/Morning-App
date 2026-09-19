/**
 * cosmic-daily.tsx — Option C
 * Full Panchanga deep-dive page.
 * Modern astrology app aesthetic (Moonly / Co-Star style).
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Dimensions, ImageBackground, Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Svg, { Circle as SvgCircle, Path as SvgPath, G } from 'react-native-svg';
import { store, KEYS } from '@/lib/storage';
import { getSolarTimes, type SolarTimes } from '@/lib/solar';
import { useBgContext } from '@/lib/bgContext';
import {
  NAKSHATRAS, YOGAS, VAARS, TITHI_ORDINALS, ENGLISH_DAYS,
  TITHI_ENERGY, TITHI_DEITY, MOON_RITUALS, VAAR_ACTIONS, SCORE_META,
  RASHI_TO_VEDIC_MONTH,
  getMoonPhase, getPanchangData, getVedicMonth, getNextLunarEvents, getCosmicScore,
} from '@/lib/cosmicData';

const { width: W } = Dimensions.get('window');

// ── Design tokens ─────────────────────────────────────────────────────────────
const GLASS  = 'rgba(255,255,255,0.035)';
const BORDER = 'rgba(255,255,255,0.07)';
const TEAL   = '#00D4B8';
const PURPLE = '#a78bfa';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt12H = (h: number, m: number) => {
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12  = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
};
function fmtSolar(dec: number): string {
  const flr = Math.floor(dec);
  const mn  = Math.round((dec - flr) * 60);
  return fmt12H(flr, mn);
}

// ── Star field ────────────────────────────────────────────────────────────────
const STARS = Array.from({ length: 50 }, (_, i) => ({
  x: ((i * 137.508) % 100),
  y: ((i * 97.333) % 100),
  r: i % 5 === 0 ? 1.0 : 0.5,
  opacity: 0.04 + (i % 7) * 0.03,
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

// ── Moon SVG — accurate path-based phase shape ───────────────────────────────
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
  const pathD = `M ${r} 0 A ${r} ${r} 0 1 ${outerSweep} ${r} ${size} A ${rx} ${r} 0 0 ${terminatorSweep} ${r} 0 Z`;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <SvgCircle cx={r} cy={r} r={r - 0.5} fill={darkFill} />
      <SvgPath d={pathD} fill={moonFill} />
    </Svg>
  );
}

// ── Circular Moon Phase Dial (all 30 tithis) ─────────────────────────────────
function MoonPhaseDial({ currentTithi, size = 280 }: { currentTithi: number; size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 24;
  const phases = Array.from({ length: 30 }, (_, i) => i + 1);
  const MOON_EMOJIS = ['🌑','🌒','🌒','🌒','🌓','🌔','🌔','🌔','🌔','🌔','🌔','🌔','🌔','🌔','🌕','🌖','🌖','🌖','🌖','🌖','🌖','🌖','🌖','🌖','🌗','🌘','🌘','🌘','🌘','🌑'];
  return (
    <Svg width={size} height={size}>
      <SvgCircle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth={1} />
      {phases.map((t) => {
        const angle = ((t - 1) / 30) * 2 * Math.PI - Math.PI / 2;
        const px = cx + R * Math.cos(angle);
        const py = cy + R * Math.sin(angle);
        const isCurrent = t === currentTithi;
        return (
          <G key={t}>
            <SvgCircle cx={px} cy={py} r={isCurrent ? 7 : 3}
              fill={isCurrent ? '#FFFFFF' : t <= 15 ? 'rgba(255,220,120,0.30)' : 'rgba(150,160,220,0.20)'}
              stroke={isCurrent ? 'rgba(255,255,255,0.50)' : 'none'}
              strokeWidth={isCurrent ? 1 : 0} />
          </G>
        );
      })}
      {/* Center moon display */}
      <G>
        <SvgCircle cx={cx} cy={cy} r={40} fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
      </G>
    </Svg>
  );
}

// ── Cosmic score arc ──────────────────────────────────────────────────────────
function ScoreArc({ score, color, size = 90 }: { score: number; color: string; size?: number }) {
  const R = size / 2 - 8;
  const cx = size / 2;
  const cy = size / 2;
  const sweepDeg = 240;
  const startAngle = -210;
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
      <SvgPath d={trackPath} stroke="rgba(255,255,255,0.08)" strokeWidth={5} fill="none" strokeLinecap="round" />
      {progPath ? <SvgPath d={progPath} stroke={color} strokeWidth={5} fill="none" strokeLinecap="round" /> : null}
      <SvgCircle cx={cx} cy={cy} r={R - 8} fill={color + '10'} />
    </Svg>
  );
}

// ── Section divider ───────────────────────────────────────────────────────────
function SectionLabel({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12, marginTop: 6 }}>
      <View style={{ flex: 1, height: 0.5, backgroundColor: BORDER }} />
      <Text style={{ fontSize: 8, fontWeight: '900', color: 'rgba(255,255,255,0.25)', letterSpacing: 2.5 }}>{text}</Text>
      <View style={{ flex: 1, height: 0.5, backgroundColor: BORDER }} />
    </View>
  );
}

// ── Pulsing glow dot ──────────────────────────────────────────────────────────
function PulseDot({ color }: { color: string }) {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return <Animated.View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, opacity: anim }} />;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════════════════════════
export default function CosmicDailyPage() {
  const router = useRouter();
  const { bgUri } = useBgContext();
  const [solarTimes, setSolarTimes] = useState<SolarTimes | null>(null);

  useEffect(() => {
    store.getJSON<{ lat: number; lon: number }>(KEYS.location)
      .then(loc => {
        if (loc?.lat && loc?.lon) setSolarTimes(getSolarTimes(loc.lat, loc.lon));
      })
      .catch(() => {});
  }, []);

  const now        = new Date();
  const p          = getPanchangData(now);
  const moon       = getMoonPhase(now);
  const lunar      = getNextLunarEvents();
  const vedicMonth = getVedicMonth(now);
  const nakshatra  = NAKSHATRAS[p.nakshatraIdx]!;
  const yoga       = YOGAS[p.yogaIdx]!;
  const vaar       = VAARS[p.vaarIdx]!;
  const score      = getCosmicScore(yoga.auspicious, moon.emoji, p.tithiName);
  const scoreMeta  = SCORE_META[score] ?? SCORE_META[5]!;
  const ritual     = MOON_RITUALS[moon.emoji] ?? { prompt: '', action: '' };
  const vaarAction = VAAR_ACTIONS[p.vaarIdx] ?? '';
  const pakshaLabel = p.paksha === 'Shukla' ? 'Waxing Moon Phase (Shukla Paksha)' : 'Waning Moon Phase (Krishna Paksha)';
  const tithiDeity  = TITHI_DEITY[p.tithiName] ?? '';
  const nextEvent   = lunar.daysToFull <= lunar.daysToNew
    ? { label: `Full Moon in ${lunar.daysToFull} days`, color: '#fbbf24', icon: '🌕' }
    : { label: `New Moon in ${lunar.daysToNew} days`,   color: '#a5b4fc', icon: '🌑' };

  const csr = solarTimes?.sunrise ?? null;
  const css = solarTimes?.sunset  ?? null;
  const csn = solarTimes?.solarNoon ?? null;

  return (
    <ImageBackground
      source={bgUri ? { uri: bgUri } : undefined}
      style={{ flex: 1, backgroundColor: '#000000' }}
      resizeMode="cover">
      <LinearGradient
        colors={['rgba(0,0,0,0.90)', 'rgba(6,7,10,0.96)', 'rgba(0,0,0,1)']}
        style={StyleSheet.absoluteFillObject} />
      <StarField />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 6, paddingBottom: 14 }}>
          <TouchableOpacity hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, backgroundColor: GLASS, borderWidth: 1, borderColor: BORDER, zIndex: 100, elevation: 100 }}>
            <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.70)', fontWeight: '700' }}>‹</Text>
            <Text style={{ fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.60)', letterSpacing: 0.8 }}>BACK</Text>
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 12, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.5 }}>DAILY COSMOS</Text>
            <Text style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.40)', fontWeight: '700', letterSpacing: 0.8 }}>VEDIC PANCHANGA</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, backgroundColor: scoreMeta.color + '15', borderWidth: 1, borderColor: scoreMeta.color + '35' }}>
            <PulseDot color={scoreMeta.color} />
            <Text style={{ fontSize: 10, fontWeight: '900', color: scoreMeta.color }}>{score}/10</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>

          {/* ── Hero: Moon + Date ── */}
          <View style={{ borderRadius: 24, borderWidth: 1, borderColor: BORDER, backgroundColor: GLASS, overflow: 'hidden', marginBottom: 14, padding: 20 }}>
            <LinearGradient colors={['rgba(167,139,250,0.05)', 'transparent']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFillObject} />

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 8, fontWeight: '900', color: 'rgba(255,255,255,0.35)', letterSpacing: 2.5, marginBottom: 6 }}>TODAY</Text>
                <Text style={{ fontSize: 20, fontWeight: '900', color: '#FFFFFF', lineHeight: 26 }}>
                  {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </Text>
                <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.40)', fontWeight: '700', marginTop: 5 }}>{pakshaLabel}</Text>
              </View>
              <View style={{ alignItems: 'center', position: 'relative' }}>
                <ScoreArc score={score} color={scoreMeta.color} size={78} />
                <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 20, fontWeight: '900', color: scoreMeta.color }}>{score}</Text>
                  <Text style={{ fontSize: 6.5, fontWeight: '800', color: scoreMeta.color + 'AA', letterSpacing: 0.5 }}>SCORE</Text>
                </View>
              </View>
            </View>

            {/* Moon phase dial */}
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
              <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
                <MoonPhaseDial currentTithi={moon.tithiNum} size={W - 80} />
                <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
                  <MoonSVG tithiNum={moon.tithiNum} size={74} />
                </View>
              </View>
              <Text style={{ fontSize: 20, fontWeight: '900', color: '#FFFFFF', marginTop: 10 }}>{moon.name}</Text>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: '700', marginTop: 3 }}>{moon.illumination}% illuminated · {moon.emoji}</Text>
              <View style={{ marginTop: 10, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: '600' }}>◄ Full Moon</Text>
                <View style={{ flex: 1, height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                  <View style={{ height: '100%', width: `${(moon.illumination)}%`, backgroundColor: '#fbbf24', borderRadius: 1 }} />
                </View>
                <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: '600' }}>New Moon ►</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1, borderRadius: 14, borderWidth: 1, borderColor: BORDER, backgroundColor: 'rgba(255,255,255,0.02)', padding: 12, alignItems: 'center', gap: 3 }}>
                <Text style={{ fontSize: 8, fontWeight: '900', color: 'rgba(255,255,255,0.30)', letterSpacing: 1.5 }}>NEXT EVENT</Text>
                <Text style={{ fontSize: 14 }}>{nextEvent.icon}</Text>
                <Text style={{ fontSize: 11, fontWeight: '800', color: nextEvent.color, textAlign: 'center' }}>{nextEvent.label}</Text>
              </View>
              <View style={{ flex: 1, borderRadius: 14, borderWidth: 1, borderColor: scoreMeta.color + '15', backgroundColor: scoreMeta.color + '04', padding: 12, alignItems: 'center', gap: 3 }}>
                <Text style={{ fontSize: 8, fontWeight: '900', color: scoreMeta.color + 'AA', letterSpacing: 1.5 }}>COSMIC SCORE</Text>
                <Text style={{ fontSize: 16 }}>{scoreMeta.emoji}</Text>
                <Text style={{ fontSize: 11, fontWeight: '800', color: scoreMeta.color, textAlign: 'center' }}>{scoreMeta.label}</Text>
              </View>
            </View>
          </View>

          {/* ── TITHI ── */}
          <SectionLabel text="TITHI  ·  LUNAR DAY" />
          <View style={{ borderRadius: 20, borderWidth: 1, borderColor: BORDER, backgroundColor: GLASS, padding: 18, marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 28, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5 }}>{p.tithiName}</Text>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.50)', fontWeight: '700', marginTop: 4 }}>
                  {TITHI_ORDINALS[p.tithiInPaksha] ?? p.tithiInPaksha} lunar day of the {p.paksha === 'Shukla' ? 'Waxing Moon' : 'Waning Moon'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                <MoonSVG tithiNum={moon.tithiNum} size={38} />
                <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: '700', marginTop: 8 }}>Day {p.tithiInPaksha}</Text>
              </View>
            </View>
            <View style={{ height: 0.5, backgroundColor: BORDER, marginBottom: 12 }} />
            <Text style={{ fontSize: 8, fontWeight: '900', color: 'rgba(255,255,255,0.30)', letterSpacing: 2, marginBottom: 6 }}>ENERGY & MEANING</Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFFFFFCC', lineHeight: 20, marginBottom: 10 }}>
              {TITHI_ENERGY[p.tithiName] ?? 'Sacred cosmic alignment'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ borderRadius: 12, borderWidth: 1, borderColor: BORDER, backgroundColor: 'rgba(255,255,255,0.02)', paddingVertical: 8, paddingHorizontal: 12, flex: 1 }}>
                <Text style={{ fontSize: 7, fontWeight: '900', color: 'rgba(255,255,255,0.30)', letterSpacing: 1.5, marginBottom: 4 }}>DEITY</Text>
                <Text style={{ fontSize: 12, fontWeight: '800', color: '#FFFFFFDD' }}>{tithiDeity}</Text>
              </View>
              <View style={{ borderRadius: 12, borderWidth: 1, borderColor: BORDER, backgroundColor: 'rgba(255,255,255,0.02)', paddingVertical: 8, paddingHorizontal: 12, flex: 1 }}>
                <Text style={{ fontSize: 7, fontWeight: '900', color: 'rgba(255,255,255,0.30)', letterSpacing: 1.5, marginBottom: 4 }}>PAKSHA</Text>
                <Text style={{ fontSize: 12, fontWeight: '800', color: '#FFFFFFDD' }}>{p.paksha === 'Shukla' ? 'Waxing Moon (Shukla)' : 'Waning Moon (Krishna)'}</Text>
              </View>
            </View>
          </View>

          {/* ── Moon Ritual ── */}
          <View style={{ borderRadius: 20, borderWidth: 1, borderColor: 'rgba(167,139,250,0.15)', backgroundColor: 'rgba(167,139,250,0.03)', padding: 18, marginBottom: 14 }}>
            <Text style={{ fontSize: 8, fontWeight: '900', color: 'rgba(167,139,250,0.55)', letterSpacing: 2, marginBottom: 8 }}>✦  MOON RITUAL</Text>
            <Text style={{ fontSize: 11, fontWeight: '700', color: 'rgba(167,139,250,0.75)', marginBottom: 6 }}>{ritual.prompt}</Text>
            <Text style={{ fontSize: 15, fontWeight: '800', color: '#FFFFFF', lineHeight: 22 }}>{ritual.action}</Text>
          </View>

          {/* ── NAKSHATRA ── */}
          <SectionLabel text="NAKSHATRA  ·  LUNAR MANSION" />
          <View style={{ borderRadius: 20, borderWidth: 1, borderColor: 'rgba(0,212,184,0.12)', backgroundColor: 'rgba(0,212,184,0.03)', padding: 18, marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 }}>
              <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(0,212,184,0.06)', borderWidth: 1, borderColor: 'rgba(0,212,184,0.20)', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 28 }}>{nakshatra.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 26, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.4 }}>{nakshatra.name}</Text>
                <Text style={{ fontSize: 13, fontWeight: '800', color: TEAL, marginTop: 2 }}>{nakshatra.en}</Text>
                <Text style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.40)', fontWeight: '700', marginTop: 3 }}>
                  Constellation: {nakshatra.constellation}
                </Text>
              </View>
            </View>

            <View style={{ height: 0.5, backgroundColor: 'rgba(0,212,184,0.15)', marginBottom: 14 }} />

            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
              {[
                { label: 'DEITY', val: nakshatra.deity },
                { label: 'RULING PLANET', val: nakshatra.planet },
              ].map((item, i) => (
                <View key={i} style={{ flex: 1, borderRadius: 12, borderWidth: 1, borderColor: BORDER, backgroundColor: 'rgba(255,255,255,0.02)', padding: 12 }}>
                  <Text style={{ fontSize: 7, fontWeight: '900', color: 'rgba(0,212,184,0.50)', letterSpacing: 1.5, marginBottom: 5 }}>{item.label}</Text>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#FFFFFFEE', lineHeight: 16 }}>{item.val}</Text>
                </View>
              ))}
            </View>

            <Text style={{ fontSize: 8, fontWeight: '900', color: 'rgba(0,212,184,0.45)', letterSpacing: 2, marginBottom: 8 }}>NAKSHATRA ENERGY</Text>
            <Text style={{ fontSize: 13, color: '#FFFFFFBB', lineHeight: 20, fontWeight: '600' }}>{nakshatra.energy}</Text>
          </View>

          {/* ── YOGA ── */}
          <SectionLabel text="YOGA  ·  AUSPICIOUS QUALITY" />
          <View style={{ borderRadius: 20, borderWidth: 1, borderColor: (yoga.auspicious ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)'), backgroundColor: (yoga.auspicious ? 'rgba(52,211,153,0.03)' : 'rgba(248,113,113,0.03)'), padding: 18, marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
              <View style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 99, borderWidth: 1, borderColor: (yoga.auspicious ? 'rgba(52,211,153,0.25)' : 'rgba(248,113,113,0.25)'), backgroundColor: (yoga.auspicious ? 'rgba(52,211,153,0.08)' : 'rgba(248,113,113,0.08)') }}>
                <Text style={{ fontSize: 10, fontWeight: '900', color: (yoga.auspicious ? '#34d399' : '#f87171'), letterSpacing: 1 }}>
                  {yoga.auspicious ? '✨ AUSPICIOUS' : '⚠ INAUSPICIOUS'}
                </Text>
              </View>
            </View>
            <Text style={{ fontSize: 30, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5, marginBottom: 4 }}>{yoga.name}</Text>
            <Text style={{ fontSize: 14, fontWeight: '800', color: yoga.auspicious ? '#34d399' : '#f87171', marginBottom: 12 }}>{yoga.en}</Text>
            <Text style={{ fontSize: 13, color: '#FFFFFFCC', fontWeight: '700', lineHeight: 20, marginBottom: 14 }}>{yoga.meaning}</Text>
            <View style={{ borderRadius: 12, borderWidth: 1, borderColor: BORDER, backgroundColor: 'rgba(255,255,255,0.03)', padding: 14 }}>
              <Text style={{ fontSize: 8, fontWeight: '900', color: 'rgba(255,255,255,0.25)', letterSpacing: 2, marginBottom: 6 }}>WHAT IS A YOGA?</Text>
              <Text style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.50)', lineHeight: 17 }}>
                Yoga is calculated from the combined longitude of the Sun and Moon — there are 27 yogas, each spanning 13°20′. They modulate the day's vibrational quality independently of Tithi or Nakshatra.
              </Text>
            </View>
          </View>

          {/* ── VAAR ── */}
          <SectionLabel text="VAAR  ·  DAY RULER" />
          <View style={{ borderRadius: 20, borderWidth: 1, borderColor: vaar.color + '15', backgroundColor: vaar.color + '04', padding: 18, marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 14 }}>
              <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: vaar.color + '08', borderWidth: 1, borderColor: vaar.color + '20', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 28 }}>{vaar.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 26, fontWeight: '900', color: '#FFFFFF' }}>{ENGLISH_DAYS[p.vaarIdx]}</Text>
                <Text style={{ fontSize: 13, fontWeight: '800', color: vaar.color, marginTop: 2 }}>{vaar.vedicName}</Text>
                <Text style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.40)', fontWeight: '700', marginTop: 3 }}>{vaar.planet} · Planetary Day</Text>
              </View>
            </View>
            <Text style={{ fontSize: 13, color: '#FFFFFFCC', fontWeight: '700', lineHeight: 20, marginBottom: 14 }}>{vaar.energy}</Text>
            <View style={{ borderRadius: 14, borderWidth: 1, borderColor: vaar.color + '15', backgroundColor: 'rgba(255,255,255,0.02)', padding: 14, marginBottom: 12 }}>
              <Text style={{ fontSize: 8, fontWeight: '900', color: vaar.color + 'AA', letterSpacing: 2, marginBottom: 8 }}>PLANETARY SCIENCE</Text>
              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.60)', lineHeight: 18 }}>{vaar.science}</Text>
            </View>
            <View style={{ borderRadius: 14, borderWidth: 1, borderColor: vaar.color + '20', backgroundColor: vaar.color + '08', padding: 16 }}>
              <Text style={{ fontSize: 8, fontWeight: '900', color: vaar.color + 'BB', letterSpacing: 2, marginBottom: 8 }}>✦  TODAY'S ACTION</Text>
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFFFFF', lineHeight: 21 }}>{vaarAction}</Text>
            </View>
          </View>

          {/* ── VEDIC MONTH ── */}
          <SectionLabel text="VEDIC MONTH  ·  SOLAR CALENDAR" />
          <View style={{ borderRadius: 20, borderWidth: 1, borderColor: 'rgba(167,139,250,0.12)', backgroundColor: 'rgba(167,139,250,0.03)', padding: 18, marginBottom: 14 }}>
            <Text style={{ fontSize: 8, fontWeight: '900', color: 'rgba(167,139,250,0.45)', letterSpacing: 2, marginBottom: 8 }}>
              {vedicMonth.rashi.toUpperCase()} RASHI
            </Text>
            <Text style={{ fontSize: 30, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5 }}>{vedicMonth.name}</Text>
            <Text style={{ fontSize: 20, fontWeight: '700', color: 'rgba(167,139,250,0.80)', marginTop: 4 }}>{vedicMonth.sanskrit}</Text>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.40)', fontWeight: '700', marginTop: 8, marginBottom: 14 }}>
              {vedicMonth.en} · {vedicMonth.season}
            </Text>
            {/* All 12 months mini strip */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {RASHI_TO_VEDIC_MONTH.map((m, i) => (
                <View key={i} style={{ paddingVertical: 5, paddingHorizontal: 10, borderRadius: 99, borderWidth: 1, borderColor: m.name === vedicMonth.name ? 'rgba(167,139,250,0.40)' : 'rgba(255,255,255,0.06)', backgroundColor: m.name === vedicMonth.name ? 'rgba(167,139,250,0.12)' : 'transparent' }}>
                  <Text style={{ fontSize: 10, fontWeight: m.name === vedicMonth.name ? '900' : '600', color: m.name === vedicMonth.name ? PURPLE : 'rgba(255,255,255,0.30)' }}>
                    {m.name}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* ── Solar Times ── */}
          {csr !== null && css !== null && (
            <>
              <SectionLabel text="SOLAR TIMES  ·  TODAY" />
              <View style={{ borderRadius: 20, borderWidth: 1, borderColor: BORDER, backgroundColor: GLASS, padding: 16, marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                  {[
                    { label: 'SUNRISE',    val: fmtSolar(csr), color: '#fb923c' },
                    ...(csn !== null ? [{ label: 'SOLAR NOON', val: fmtSolar(csn), color: '#fbbf24' }] : []),
                    { label: 'SUNSET',     val: fmtSolar(css), color: '#c084fc' },
                  ].map((item, i, arr) => (
                    <React.Fragment key={i}>
                      <View style={{ alignItems: 'center', gap: 6 }}>
                        <Text style={{ fontSize: 16, fontWeight: '900', color: item.color }}>{item.val}</Text>
                        <Text style={{ fontSize: 7, fontWeight: '800', color: 'rgba(255,255,255,0.30)', letterSpacing: 1.2 }}>{item.label}</Text>
                      </View>
                      {i < arr.length - 1 && <View style={{ width: 0.5, height: 32, backgroundColor: BORDER }} />}
                    </React.Fragment>
                  ))}
                </View>
              </View>
            </>
          )}

          {/* ── Full Panchanga Summary ── */}
          <SectionLabel text="PANCHANGA  ·  FIVE LIMBS" />
          <View style={{ borderRadius: 20, borderWidth: 1, borderColor: BORDER, backgroundColor: GLASS, padding: 18, marginBottom: 14 }}>
            <Text style={{ fontSize: 8, fontWeight: '900', color: 'rgba(255,255,255,0.25)', letterSpacing: 2, marginBottom: 14 }}>
              Panchanga means "five limbs" — the five elements of the Vedic almanac that define each day's cosmic quality.
            </Text>
            {[
              { num: '01', name: 'Tithi',     Sanskrit: 'तिथि',     val: p.tithiName,             sub: "Lunar Day — Moon's elongation from Sun" },
              { num: '02', name: 'Vaar',      Sanskrit: 'वार',      val: vaar.vedicName,           sub: 'Day of Week — Planetary rulership' },
              { num: '03', name: 'Nakshatra', Sanskrit: 'नक्षत्र',  val: nakshatra.name,           sub: "Lunar Mansion — Moon's star cluster" },
              { num: '04', name: 'Yoga',      Sanskrit: 'योग',      val: yoga.name,                sub: 'Auspicious Quality — Sun + Moon longitude sum' },
              { num: '05', name: 'Karana',    Sanskrit: 'करण',      val: `Half of ${p.tithiName}`, sub: 'Half-tithi period' },
            ].map((row, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 12, borderTopWidth: i > 0 ? 0.5 : 0, borderTopColor: BORDER }}>
                <Text style={{ fontSize: 11, fontWeight: '900', color: 'rgba(255,255,255,0.15)', width: 24, marginTop: 1 }}>{row.num}</Text>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                    <Text style={{ fontSize: 15, fontWeight: '900', color: '#FFFFFF' }}>{row.name}</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: 'rgba(167,139,250,0.65)' }}>{row.Sanskrit}</Text>
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: TEAL }}>{row.val}</Text>
                  <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.40)', fontWeight: '600', marginTop: 2 }}>{row.sub}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* ── Explore Cosmos deeper CTA ── */}
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/cosmic-explore' as never); }}
            activeOpacity={0.82}
            style={{ borderRadius: 18, overflow: 'hidden', marginBottom: 8 }}>
            <LinearGradient colors={['rgba(10,0,53,0.8)', 'rgba(26,0,80,0.6)', 'rgba(13,0,48,0.8)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, paddingHorizontal: 20, borderWidth: 1, borderColor: 'rgba(167,139,250,0.15)', borderRadius: 18 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text style={{ fontSize: 22 }}>🌌</Text>
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '900', color: '#FFFFFF' }}>Cosmic Explorer</Text>
                  <Text style={{ fontSize: 10, color: 'rgba(167,139,250,0.70)', marginTop: 2 }}>Solar dial · Nakshatra grid · Deep Panchanga</Text>
                </View>
              </View>
              <Text style={{ fontSize: 20, color: PURPLE, fontWeight: '700' }}>›</Text>
            </LinearGradient>
          </TouchableOpacity>

        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({});
