/**
 * cosmic-daily.tsx — Premium Vedic Almanac
 * Top-tier US-market Vedic Almanac experience.
 * Inspired by Co-Star / Moonly / TimePassages aesthetics.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Dimensions, ImageBackground, Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
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

const { width: W, height: H } = Dimensions.get('window');

// ── Design Tokens ──────────────────────────────────────────────────────────────
const GOLD    = '#F5C842';
const GOLD_DIM = '#F5C84260';
const PURPLE  = '#A78BFA';
const TEAL    = '#2DD4BF';
const ROSE    = '#FB7185';
const GLASS   = 'rgba(255,255,255,0.055)';
const BORDER  = 'rgba(255,255,255,0.10)';
const BORDER_GOLD = 'rgba(245,200,66,0.20)';

// ── Helpers ────────────────────────────────────────────────────────────────────
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

// ── Star Canvas ────────────────────────────────────────────────────────────────
const STARS = Array.from({ length: 90 }, (_, i) => ({
  x: ((i * 137.508 + i * 13.7) % 100),
  y: ((i * 97.333 + i * 7.2) % 100),
  r: i % 9 === 0 ? 1.4 : i % 3 === 0 ? 0.9 : 0.5,
  opacity: 0.06 + (i % 11) * 0.045,
}));

function StarCanvas() {
  return (
    <Svg style={StyleSheet.absoluteFillObject} viewBox="0 0 100 100" preserveAspectRatio="none">
      {STARS.map((s, i) => (
        <SvgCircle key={i} cx={s.x} cy={s.y} r={s.r} fill="white" opacity={s.opacity} />
      ))}
    </Svg>
  );
}

// ── Moon SVG ──────────────────────────────────────────────────────────────────
function MoonSVG({ tithiNum, size }: { tithiNum: number; size: number }) {
  const r = size / 2;
  const isWaxing   = tithiNum <= 15;
  const isPurnima  = tithiNum === 15;
  const isAmavasya = tithiNum === 0 || tithiNum === 30;
  const rawIllum   = isPurnima ? 1 : isAmavasya ? 0
    : isWaxing ? tithiNum / 15
    : 1 - (tithiNum - 15) / 15;

  const moonFill = '#FEF3C7';
  const darkFill = '#080818';

  if (rawIllum < 0.02) {
    return (
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <SvgCircle cx={r} cy={r} r={r - 0.5} fill={darkFill} stroke="#1a1a2e" strokeWidth={0.8} />
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

// ── Moon Phase Ring ───────────────────────────────────────────────────────────
function MoonPhaseRing({ currentTithi, size = 260 }: { currentTithi: number; size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 20;
  return (
    <Svg width={size} height={size}>
      {/* Track ring */}
      <SvgCircle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={1.5} />
      {/* Phase dots */}
      {Array.from({ length: 30 }, (_, i) => i + 1).map((t) => {
        const angle = ((t - 1) / 30) * 2 * Math.PI - Math.PI / 2;
        const px = cx + R * Math.cos(angle);
        const py = cy + R * Math.sin(angle);
        const isCurrent = t === currentTithi;
        const isSpecial = t === 15 || t === 30;
        return (
          <G key={t}>
            {isCurrent ? (
              <>
                <SvgCircle cx={px} cy={py} r={10} fill="rgba(245,200,66,0.08)" />
                <SvgCircle cx={px} cy={py} r={6} fill={GOLD} opacity={0.9} />
              </>
            ) : isSpecial ? (
              <SvgCircle cx={px} cy={py} r={3.5}
                fill={t === 15 ? 'rgba(254,243,199,0.55)' : 'rgba(100,100,160,0.35)'}
              />
            ) : (
              <SvgCircle cx={px} cy={py} r={t <= 15 ? 1.8 : 1.5}
                fill={t <= 15 ? 'rgba(255,220,130,0.28)' : 'rgba(130,140,200,0.22)'}
              />
            )}
          </G>
        );
      })}
    </Svg>
  );
}

// ── Score Arc ─────────────────────────────────────────────────────────────────
function ScoreArc({ score, color, size = 84 }: { score: number; color: string; size?: number }) {
  const R = size / 2 - 9;
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
      <SvgPath d={trackPath} stroke="rgba(255,255,255,0.07)" strokeWidth={6} fill="none" strokeLinecap="round" />
      {progPath ? <SvgPath d={progPath} stroke={color} strokeWidth={6} fill="none" strokeLinecap="round" /> : null}
    </Svg>
  );
}

// ── Pulsing Dot ───────────────────────────────────────────────────────────────
function PulseDot({ color }: { color: string }) {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.25, duration: 1000, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return <Animated.View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: color, opacity: anim }} />;
}

// ── Divider ───────────────────────────────────────────────────────────────────
function Divider({ label }: { label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14, marginTop: 8 }}>
      <View style={{ flex: 1, height: 0.5, backgroundColor: BORDER_GOLD }} />
      <Text style={{ fontSize: 8, fontWeight: '800', color: GOLD_DIM, letterSpacing: 3 }}>{label}</Text>
      <View style={{ flex: 1, height: 0.5, backgroundColor: BORDER_GOLD }} />
    </View>
  );
}

// ── Card Shell ────────────────────────────────────────────────────────────────
function Card({ children, accentColor, style }: { children: React.ReactNode; accentColor?: string; style?: any }) {
  return (
    <View style={[{
      borderRadius: 22,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: accentColor ? accentColor + '22' : BORDER,
      backgroundColor: GLASS,
      marginBottom: 14,
    }, style]}>
      {accentColor && (
        <LinearGradient
          colors={[accentColor + '0C', 'transparent']}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      )}
      {children}
    </View>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────
function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={{
      paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99,
      backgroundColor: color + '15', borderWidth: 1, borderColor: color + '40',
    }}>
      <Text style={{ fontSize: 9, fontWeight: '800', color, letterSpacing: 1 }}>{label}</Text>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function CosmicDailyPage() {
  const router = useRouter();
  const { bgUri } = useBgContext();
  const [solarTimes, setSolarTimes]   = useState<SolarTimes | null>(null);
  const [activeSection, setActiveSection] = useState<number | null>(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    store.getJSON<{ lat: number; lon: number }>(KEYS.location)
      .then(loc => { if (loc?.lat && loc?.lon) setSolarTimes(getSolarTimes(loc.lat, loc.lon)); })
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
  const tithiDeity  = TITHI_DEITY[p.tithiName] ?? '';
  const nextEvent   = lunar.daysToFull <= lunar.daysToNew
    ? { label: `Full Moon in ${lunar.daysToFull}d`, color: '#FBBF24', icon: '🌕', long: lunar.fullDateLong }
    : { label: `New Moon in ${lunar.daysToNew}d`,   color: '#A5B4FC', icon: '🌑', long: lunar.newDateLong };

  const csr = solarTimes?.sunrise ?? null;
  const css = solarTimes?.sunset  ?? null;
  const csn = solarTimes?.solarNoon ?? null;

  const headerOpacity = scrollY.interpolate({ inputRange: [0, 80], outputRange: [0, 1], extrapolate: 'clamp' });
  const pakshaLabel = p.paksha === 'Shukla' ? 'Waxing Moon · Shukla Paksha' : 'Waning Moon · Krishna Paksha';

  // Five limbs (Panchanga) data
  const fiveLimbs = [
    {
      num: '01', name: 'Tithi',     label: 'LUNAR DAY',       sanskrit: 'तिथि',
      value: p.tithiName,           color: PURPLE,
      desc: `${TITHI_ORDINALS[p.tithiInPaksha] ?? ''} day of the ${p.paksha === 'Shukla' ? 'Waxing Moon' : 'Waning Moon'}. ${TITHI_ENERGY[p.tithiName] ?? ''}`,
      deity: tithiDeity,
    },
    {
      num: '02', name: 'Nakshatra', label: 'LUNAR MANSION',   sanskrit: 'नक्षत्र',
      value: nakshatra.name,        color: TEAL,
      desc: `${nakshatra.en} · Ruled by ${nakshatra.planet}. ${nakshatra.energy}`,
      deity: nakshatra.deity,
    },
    {
      num: '03', name: 'Yoga',      label: 'COSMIC QUALITY',  sanskrit: 'योग',
      value: yoga.name,             color: yoga.auspicious ? '#34D399' : ROSE,
      desc: `${yoga.en} — ${yoga.meaning}`,
      deity: yoga.auspicious ? '✨ Auspicious' : '⚠️ Inauspicious',
    },
    {
      num: '04', name: 'Vaar',      label: 'PLANETARY DAY',   sanskrit: 'वार',
      value: ENGLISH_DAYS[p.vaarIdx]!,  color: vaar.color,
      desc: `Ruled by ${vaar.planet}. ${vaar.energy}`,
      deity: vaar.vedicName,
    },
    {
      num: '05', name: 'Karana',    label: 'HALF LUNAR DAY',  sanskrit: 'करण',
      value: `${p.tithiName} Karana`,   color: GOLD,
      desc: `Each Tithi is divided into two Karanas. The active Karana shapes the subtle texture of this half-day's energy.`,
      deity: 'Half of ' + p.tithiName,
    },
  ];

  return (
    <ImageBackground
      source={bgUri ? { uri: bgUri } : undefined}
      style={{ flex: 1, backgroundColor: '#04061A' }}
      resizeMode="cover">

      {/* Deep space overlay */}
      <LinearGradient
        colors={['rgba(4,6,26,0.94)', 'rgba(2,3,14,0.96)', 'rgba(4,6,26,0.98)']}
        style={StyleSheet.absoluteFillObject}
      />
      <StarCanvas />

      {/* Ambient glow top */}
      <View style={{
        position: 'absolute', top: -60, left: W * 0.15, right: W * 0.15,
        height: 200, borderRadius: 200,
        backgroundColor: 'rgba(167,139,250,0.07)',
      }} />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>

        {/* ── Sticky blur header on scroll ── */}
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFillObject, { opacity: headerOpacity, zIndex: 5 }]}>
          <BlurView intensity={60} tint="dark" style={{ height: 80 }} />
          <LinearGradient
            colors={['rgba(4,6,26,0.85)', 'transparent']}
            style={{ height: 40 }}
          />
        </Animated.View>

        {/* ── Header bar ── */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 18, paddingTop: 6, paddingBottom: 14, zIndex: 10,
        }}>
          <TouchableOpacity
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              paddingVertical: 8, paddingHorizontal: 14, borderRadius: 99,
              backgroundColor: 'rgba(255,255,255,0.08)',
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
            }}>
            <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.80)', fontWeight: '300' }}>‹</Text>
            <Text style={{ fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.60)', letterSpacing: 1 }}>BACK</Text>
          </TouchableOpacity>

          {/* Title */}
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.4 }}>Vedic Almanac</Text>
            <Text style={{ fontSize: 8, fontWeight: '600', color: GOLD_DIM, letterSpacing: 2, marginTop: 1 }}>DAILY PANCHANGA</Text>
          </View>

          {/* Score badge */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 5,
            paddingVertical: 8, paddingHorizontal: 12, borderRadius: 99,
            backgroundColor: scoreMeta.color + '12',
            borderWidth: 1, borderColor: scoreMeta.color + '35',
          }}>
            <PulseDot color={scoreMeta.color} />
            <Text style={{ fontSize: 11, fontWeight: '900', color: scoreMeta.color }}>{score}/10</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 80 }}
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
          scrollEventThrottle={16}>

          {/* ━━━━━━━━━━ HERO SECTION ━━━━━━━━━━ */}
          <Card accentColor={PURPLE} style={{ marginBottom: 20, padding: 0, overflow: 'hidden' }}>
            {/* Top gradient stripe */}
            <LinearGradient
              colors={['rgba(167,139,250,0.16)', 'rgba(167,139,250,0.04)', 'transparent']}
              start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
              style={{ paddingTop: 22, paddingHorizontal: 20, paddingBottom: 18 }}>

              {/* Date + Score row */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 8, fontWeight: '800', color: GOLD_DIM, letterSpacing: 3, marginBottom: 8 }}>TODAY</Text>
                  <Text style={{ fontSize: 24, fontWeight: '700', color: '#FFFFFF', lineHeight: 28, letterSpacing: -0.5 }}>
                    {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </Text>
                  <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: '600', marginTop: 6 }}>
                    {pakshaLabel}
                  </Text>

                  {/* Vedic Month badge */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
                    <Badge label={vedicMonth.name.toUpperCase() + ' MĀSA'} color={GOLD} />
                    <Badge label={nextEvent.label.toUpperCase()} color={nextEvent.color} />
                  </View>
                </View>

                {/* Score circle */}
                <View style={{ alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  <ScoreArc score={score} color={scoreMeta.color} size={84} />
                  <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 22, fontWeight: '900', color: scoreMeta.color }}>{score}</Text>
                    <Text style={{ fontSize: 6, fontWeight: '800', color: scoreMeta.color + 'AA', letterSpacing: 1 }}>SCORE</Text>
                  </View>
                </View>
              </View>

              {/* ── Moon Phase Display ── */}
              <View style={{ alignItems: 'center', marginBottom: 8 }}>
                <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
                  <MoonPhaseRing currentTithi={moon.tithiNum} size={W - 72} />
                  {/* Center moon */}
                  <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
                    <MoonSVG tithiNum={moon.tithiNum} size={80} />
                  </View>
                </View>

                {/* Moon name */}
                <Text style={{ fontSize: 22, fontWeight: '700', color: '#FFFFFF', marginTop: 8, letterSpacing: -0.3 }}>
                  {moon.name}
                </Text>
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: '600', marginTop: 3 }}>
                  {moon.illumination}% Illuminated
                </Text>

                {/* Phase progress bar */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, width: '85%' }}>
                  <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.30)', fontWeight: '600' }}>🌑 New</Text>
                  <View style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                    <LinearGradient
                      colors={['#A78BFA60', GOLD]}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={{ height: 3, width: `${moon.illumination}%` as any, borderRadius: 2 }}
                    />
                  </View>
                  <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.30)', fontWeight: '600' }}>Full 🌕</Text>
                </View>
              </View>
            </LinearGradient>

            {/* ── Cosmic Score Card (below moon) ── */}
            <View style={{
              margin: 14, borderRadius: 16,
              backgroundColor: scoreMeta.color + '0E',
              borderWidth: 1, borderColor: scoreMeta.color + '25',
              padding: 14,
              flexDirection: 'row', alignItems: 'center', gap: 14,
            }}>
              <Text style={{ fontSize: 32 }}>{scoreMeta.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: scoreMeta.color, letterSpacing: -0.3 }}>
                  {scoreMeta.label}
                </Text>
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.60)', marginTop: 3, lineHeight: 17 }}>
                  {scoreMeta.desc}
                </Text>
              </View>
            </View>
          </Card>

          {/* ━━━━━━━━━━ TODAY'S INTENTION ━━━━━━━━━━ */}
          <Card accentColor={PURPLE} style={{ marginBottom: 20 }}>
            <View style={{ padding: 18 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Text style={{ fontSize: 16 }}>{moon.emoji}</Text>
                <Text style={{ fontSize: 9, fontWeight: '800', color: PURPLE, letterSpacing: 2 }}>MOON RITUAL</Text>
              </View>
              <Text style={{ fontSize: 13, color: 'rgba(167,139,250,0.70)', fontWeight: '600', marginBottom: 6 }}>
                {ritual.prompt}
              </Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF', lineHeight: 24 }}>
                {ritual.action}
              </Text>
            </View>
          </Card>

          {/* ━━━━━━━━━━ FIVE LIMBS OF PANCHANGA ━━━━━━━━━━ */}
          <Divider label="PANCHĀNGA · FIVE LIMBS OF THE VEDIC ALMANAC" />

          <View style={{ marginBottom: 6 }}>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', fontWeight: '500', lineHeight: 18, marginBottom: 16, textAlign: 'center' }}>
              Panchanga — the five pillars of Vedic timekeeping — define the energetic quality of each day.
            </Text>
          </View>

          {fiveLimbs.map((limb, idx) => {
            const isOpen = activeSection === idx;
            return (
              <TouchableOpacity
                key={idx}
                activeOpacity={0.8}
                onPress={() => {
                  Haptics.selectionAsync();
                  setActiveSection(isOpen ? null : idx);
                }}
                style={{ marginBottom: 10 }}>
                <Card accentColor={limb.color} style={{ marginBottom: 0 }}>
                  {/* Row header */}
                  <View style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                    {/* Number */}
                    <Text style={{ fontSize: 11, fontWeight: '900', color: limb.color + '50', width: 22 }}>{limb.num}</Text>

                    {/* Main info */}
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
                        <Text style={{ fontSize: 11, fontWeight: '900', color: limb.color, letterSpacing: 1.5 }}>
                          {limb.name.toUpperCase()}
                        </Text>
                        <Text style={{ fontSize: 13, color: 'rgba(167,139,250,0.50)', fontWeight: '700' }}>
                          {limb.sanskrit}
                        </Text>
                        <Text style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', fontWeight: '700', letterSpacing: 1 }}>
                          {limb.label}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 19, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.3 }}>
                        {limb.value}
                      </Text>
                      {!isOpen && (
                        <Text style={{ fontSize: 10, color: limb.color + 'BB', fontWeight: '600', marginTop: 3 }} numberOfLines={1}>
                          {limb.deity}
                        </Text>
                      )}
                    </View>

                    {/* Chevron */}
                    <Text style={{ fontSize: 18, color: isOpen ? limb.color : 'rgba(255,255,255,0.20)', fontWeight: '300' }}>
                      {isOpen ? '↑' : '›'}
                    </Text>
                  </View>

                  {/* Expanded detail */}
                  {isOpen && (
                    <>
                      <View style={{ height: 1, backgroundColor: limb.color + '18', marginHorizontal: 16 }} />
                      <View style={{ padding: 16, paddingTop: 14 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                          <View style={{
                            paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99,
                            backgroundColor: limb.color + '15', borderWidth: 1, borderColor: limb.color + '30',
                          }}>
                            <Text style={{ fontSize: 9, fontWeight: '800', color: limb.color, letterSpacing: 1 }}>
                              {limb.deity.toUpperCase()}
                            </Text>
                          </View>
                        </View>
                        <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.72)', lineHeight: 21, fontWeight: '500' }}>
                          {limb.desc}
                        </Text>
                      </View>
                    </>
                  )}
                </Card>
              </TouchableOpacity>
            );
          })}

          {/* ━━━━━━━━━━ NAKSHATRA DEEP DIVE ━━━━━━━━━━ */}
          <Divider label="NAKSHATRA · LUNAR MANSION" />

          <Card accentColor={TEAL} style={{ marginBottom: 20 }}>
            <View style={{ padding: 18 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                <View style={{
                  width: 64, height: 64, borderRadius: 32,
                  backgroundColor: TEAL + '15',
                  borderWidth: 1.5, borderColor: TEAL + '35',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ fontSize: 30 }}>{nakshatra.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 25, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.4 }}>
                    {nakshatra.name}
                  </Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: TEAL, marginTop: 2 }}>
                    {nakshatra.en}
                  </Text>
                  <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', fontWeight: '600', marginTop: 3 }}>
                    ✦ {nakshatra.constellation}
                  </Text>
                </View>
              </View>

              {/* Attributes row */}
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                {[
                  { label: 'DEITY', value: nakshatra.deity },
                  { label: 'PLANET', value: nakshatra.planet },
                ].map((item, i) => (
                  <View key={i} style={{
                    flex: 1, borderRadius: 14, borderWidth: 1,
                    borderColor: TEAL + '20', backgroundColor: TEAL + '06', padding: 12,
                  }}>
                    <Text style={{ fontSize: 7, fontWeight: '900', color: TEAL + 'AA', letterSpacing: 1.5, marginBottom: 5 }}>
                      {item.label}
                    </Text>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#FFFFFFEE', lineHeight: 17 }}>
                      {item.value}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={{ height: 1, backgroundColor: TEAL + '15', marginBottom: 14 }} />
              <Text style={{ fontSize: 8, fontWeight: '900', color: TEAL + '80', letterSpacing: 2, marginBottom: 8 }}>
                ENERGETIC QUALITY
              </Text>
              <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.72)', lineHeight: 21, fontWeight: '500' }}>
                {nakshatra.energy}
              </Text>
            </View>
          </Card>

          {/* ━━━━━━━━━━ VAAR DEEP DIVE ━━━━━━━━━━ */}
          <Divider label="VAAR · PLANETARY DAY" />

          <Card accentColor={vaar.color} style={{ marginBottom: 20 }}>
            <View style={{ padding: 18 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                <View style={{
                  width: 64, height: 64, borderRadius: 32,
                  backgroundColor: vaar.color + '15',
                  borderWidth: 1.5, borderColor: vaar.color + '35',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ fontSize: 30 }}>{vaar.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 25, fontWeight: '800', color: '#FFFFFF' }}>
                    {ENGLISH_DAYS[p.vaarIdx]}
                  </Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: vaar.color, marginTop: 2 }}>
                    {vaar.vedicName}
                  </Text>
                  <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', fontWeight: '600', marginTop: 3 }}>
                    {vaar.planet} · Planetary Day
                  </Text>
                </View>
              </View>

              <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.72)', fontWeight: '600', lineHeight: 20, marginBottom: 14 }}>
                {vaar.energy}
              </Text>

              {/* Science blurb */}
              <View style={{
                borderRadius: 14, borderWidth: 1, borderColor: vaar.color + '18',
                backgroundColor: 'rgba(255,255,255,0.03)', padding: 14, marginBottom: 12,
              }}>
                <Text style={{ fontSize: 8, fontWeight: '900', color: vaar.color + 'AA', letterSpacing: 2, marginBottom: 8 }}>
                  SCIENCE BEHIND THE DAY
                </Text>
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.58)', lineHeight: 19 }}>
                  {vaar.science}
                </Text>
              </View>

              {/* Today's action */}
              <View style={{
                borderRadius: 14, borderWidth: 1, borderColor: vaar.color + '30',
                backgroundColor: vaar.color + '0F', padding: 16,
              }}>
                <Text style={{ fontSize: 8, fontWeight: '900', color: vaar.color + 'CC', letterSpacing: 2, marginBottom: 8 }}>
                  ✦  TODAY'S PRACTICE
                </Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF', lineHeight: 22 }}>
                  {vaarAction}
                </Text>
              </View>
            </View>
          </Card>

          {/* ━━━━━━━━━━ VEDIC MONTH ━━━━━━━━━━ */}
          <Divider label="VEDIC MONTH · SOLAR CYCLE" />

          <Card accentColor={GOLD} style={{ marginBottom: 20 }}>
            <View style={{ padding: 18 }}>
              <Text style={{ fontSize: 8, fontWeight: '900', color: GOLD + '80', letterSpacing: 2, marginBottom: 8 }}>
                {vedicMonth.rashi.toUpperCase()} RASHI
              </Text>
              <Text style={{ fontSize: 30, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 }}>
                {vedicMonth.name}
              </Text>
              <Text style={{ fontSize: 20, fontWeight: '600', color: GOLD + 'CC', marginTop: 4 }}>
                {vedicMonth.sanskrit}
              </Text>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.40)', fontWeight: '600', marginTop: 8, marginBottom: 16 }}>
                {vedicMonth.en} · {vedicMonth.season}
              </Text>

              {/* Month mini-grid */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {RASHI_TO_VEDIC_MONTH.map((m, i) => (
                  <View key={i} style={{
                    paddingVertical: 5, paddingHorizontal: 11, borderRadius: 99, borderWidth: 1,
                    borderColor: m.name === vedicMonth.name ? GOLD + '55' : 'rgba(255,255,255,0.07)',
                    backgroundColor: m.name === vedicMonth.name ? GOLD + '15' : 'transparent',
                  }}>
                    <Text style={{
                      fontSize: 10,
                      fontWeight: m.name === vedicMonth.name ? '800' : '500',
                      color: m.name === vedicMonth.name ? GOLD : 'rgba(255,255,255,0.28)',
                    }}>
                      {m.name}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </Card>

          {/* ━━━━━━━━━━ SOLAR TIMES ━━━━━━━━━━ */}
          {csr !== null && css !== null && (
            <>
              <Divider label="SOLAR TIMES · TODAY" />
              <Card style={{ marginBottom: 20 }}>
                <View style={{ padding: 18 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' }}>
                    {[
                      { label: 'SUNRISE',    time: fmtSolar(csr), color: '#FB923C', emoji: '🌅' },
                      ...(csn !== null ? [{ label: 'SOLAR NOON', time: fmtSolar(csn), color: '#FBBF24', emoji: '☀️' }] : []),
                      { label: 'SUNSET',     time: fmtSolar(css), color: '#C084FC', emoji: '🌆' },
                    ].map((item, i, arr) => (
                      <React.Fragment key={i}>
                        <View style={{ alignItems: 'center', gap: 5 }}>
                          <Text style={{ fontSize: 18 }}>{item.emoji}</Text>
                          <Text style={{ fontSize: 17, fontWeight: '800', color: item.color }}>{item.time}</Text>
                          <Text style={{ fontSize: 7, fontWeight: '800', color: 'rgba(255,255,255,0.28)', letterSpacing: 1.2 }}>{item.label}</Text>
                        </View>
                        {i < arr.length - 1 && (
                          <View style={{ width: 0.5, height: 36, backgroundColor: 'rgba(255,255,255,0.10)' }} />
                        )}
                      </React.Fragment>
                    ))}
                  </View>
                </View>
              </Card>
            </>
          )}

          {/* ━━━━━━━━━━ NEXT LUNAR EVENT ━━━━━━━━━━ */}
          <Divider label="LUNAR FORECAST" />
          <Card accentColor={nextEvent.color} style={{ marginBottom: 20 }}>
            <View style={{ padding: 18, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <Text style={{ fontSize: 38 }}>{nextEvent.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 9, fontWeight: '800', color: nextEvent.color + 'AA', letterSpacing: 2, marginBottom: 4 }}>
                  UPCOMING
                </Text>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#FFFFFF' }}>{nextEvent.label}</Text>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: '600', marginTop: 3 }}>
                  {nextEvent.long}
                </Text>
              </View>
            </View>
          </Card>

          {/* ━━━━━━━━━━ EXPLORE DEEPER CTA ━━━━━━━━━━ */}
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/cosmic-explore' as never); }}
            activeOpacity={0.82}
            style={{ borderRadius: 20, overflow: 'hidden', marginBottom: 10 }}>
            <LinearGradient
              colors={['#1a0050', '#0a0030', '#08001e']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                paddingVertical: 18, paddingHorizontal: 22,
                borderWidth: 1, borderColor: 'rgba(167,139,250,0.28)', borderRadius: 20,
              }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <Text style={{ fontSize: 28 }}>🌌</Text>
                <View>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: '#FFFFFF' }}>Astral Explorer</Text>
                  <Text style={{ fontSize: 11, color: 'rgba(167,139,250,0.65)', marginTop: 3 }}>
                    Solar dial · Nakshatra grid · Deep analysis
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: 22, color: PURPLE, fontWeight: '300' }}>›</Text>
            </LinearGradient>
          </TouchableOpacity>

        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({});
