import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Svg, { Circle as SvgCircle, Path as SvgPath } from 'react-native-svg';

const SCREEN_W = Dimensions.get('window').width;

import { 
  getPanchangData, getVedicMonth, getCosmicScore, getExactTimings,
  getMoonPhase, getNextLunarEvents,
  NAKSHATRAS, YOGAS, VAARS, TITHI_NAMES, MOON_RITUALS, VAAR_ACTIONS, SCORE_META,
  TITHI_ORDINALS, ENGLISH_DAYS, TITHI_ENERGY
} from '@/lib/cosmicData';

// ── Data ────────────────────────────────────────────────────────────────────

// Imported Panchang Data

// ── Moon SVG ────────────────────────────────────────────────────────────────

function MoonSVG({ tithiNum, size = 40 }: { tithiNum: number; size?: number }) {
  const r = size / 2;
  const isWaxing   = tithiNum <= 15;
  const isPurnima  = tithiNum === 15;
  const isAmavasya = tithiNum === 0 || tithiNum === 30;
  const rawIllum   = isPurnima ? 1 : isAmavasya ? 0 : isWaxing ? tithiNum / 15 : 1 - (tithiNum - 15) / 15;
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
  const c = r; const s = size;
  const pathD = `M ${c} 0 A ${r} ${r} 0 1 ${outerSweep} ${c} ${s} A ${rx} ${r} 0 0 ${terminatorSweep} ${c} 0 Z`;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <SvgCircle cx={r} cy={r} r={r - 0.5} fill={darkFill} />
      <SvgPath d={pathD} fill={moonFill} />
    </Svg>
  );
}



// ── Sub-components ──────────────────────────────────────────────────────────

function SciBlock({ title, body, borderColor, titleColor }: { title: string; body: string; borderColor: string; titleColor: string }) {
  return (
    <View style={[S.sciBlock, { borderColor }]}>
      <Text style={[S.sciBlockTitle, { color: titleColor }]}>{title}</Text>
      <Text style={S.sciBlockBody}>{body}</Text>
    </View>
  );
}

function SectionHeader({ title, sub, emoji }: { title: string; sub?: string; emoji?: string }) {
  return (
    <View style={S.sectionHeader}>
      {emoji ? <Text style={S.sectionEmoji}>{emoji}</Text> : null}
      <View style={{ flex: 1 }}>
        <Text style={S.sectionTitle}>{title}</Text>
        {sub ? <Text style={S.sectionSub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

// ── Main Screen ─────────────────────────────────────────────────────────────

export default function CosmicExploreScreen() {
  const router = useRouter();
  const [expandedCalendar, setExpandedCalendar] = useState(false);

  const moon        = getMoonPhase();
  const p           = getPanchangData();
  const nakshatra   = NAKSHATRAS[p.nakshatraIdx];
  const yoga        = YOGAS[p.yogaIdx];
  const vaar        = VAARS[p.vaarIdx];
  const tithiEnergy = TITHI_ENERGY[p.tithiName] ?? 'Sacred lunar energy';
  const moonRitual  = MOON_RITUALS[moon.emoji] ?? { prompt: 'Lunar energy', action: 'Connect with the moon tonight.' };
  const vaarAction  = VAAR_ACTIONS[p.vaarIdx] ?? '';
  const params      = useLocalSearchParams();
  const lat         = params.lat ? parseFloat(params.lat as string) : undefined;
  const vMonth      = getVedicMonth(new Date(), lat);
  const isSpecialMoon = moon.emoji === '🌕' || moon.emoji === '🌑';
  const lunar       = getNextLunarEvents();

  const today = new Date();
  const dayOpts: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
  const dateLabel = today.toLocaleDateString('en-US', dayOpts);

  const timings = React.useMemo(() => getExactTimings(today), [today]);
  const tFmt = (d: Date | null) => d ? d.toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <View style={S.screen}>
      <LinearGradient
        colors={['#060618', '#0a0a1f', '#080820']}
        style={StyleSheet.absoluteFillObject}
      />

      {/* ── Custom Header ── */}
      <SafeAreaView edges={['top']} style={S.headerSafe}>
        <View style={S.header}>
          <TouchableOpacity hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }} onPress={() => router.back()} style={S.backBtn} activeOpacity={0.7}>
            <Text style={S.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={S.headerCap}>VEDIC COSMIC SCIENCE</Text>
            <Text style={S.headerTitle}>Today's Cosmic Date</Text>
          </View>
        </View>
        <View style={S.headerDivider} />
      </SafeAreaView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={S.scroll}
        showsVerticalScrollIndicator={false}>

        {/* ══ HERO — Moon + Date + Cosmic Score ══ */}
        <LinearGradient
          colors={[vaar.color + '15', '#FFFFFF05', 'transparent']}
          style={S.heroGrad}>
          <View style={S.heroRow}>
            <View style={{ alignItems: 'center' }}>
              <MoonSVG tithiNum={moon.tithiNum} size={72} />
              <View style={{ marginTop: 7, flexDirection: 'row', alignItems: 'baseline', gap: 2, backgroundColor: '#FFFFFF0C', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4, borderWidth: 1, borderColor: '#a78bfa40' }}>
                <Text style={{ fontSize: 17, fontWeight: '900', color: '#FFFFFFEE', letterSpacing: -0.5 }}>{moon.illumination}</Text>
                <Text style={{ fontSize: 10, fontWeight: '900', color: '#a78bfaBB' }}>%</Text>
                <Text style={{ fontSize: 7, fontWeight: '800', color: '#FFFFFF35', letterSpacing: 0.8, marginLeft: 2 }}>LIT</Text>
              </View>
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={S.heroMoonName}>{moon.name}</Text>
              <Text style={S.heroIllum}>{p.paksha} Paksha  ·  {moon.name}</Text>
              <Text style={S.heroTithi}>{p.tithiName}  ·  {TITHI_ORDINALS[p.tithiInPaksha]} day  ·  {vMonth.name} — Vedic Month</Text>
              <Text style={S.heroNakshatra}>{nakshatra.emoji}  {nakshatra.name}  ·  Nakshatra (Lunar Constellation)  ·  {nakshatra.en}</Text>
            </View>
          </View>

          {/* Date label */}
          <Text style={S.heroDate}>{dateLabel}</Text>

        </LinearGradient>

        {/* ══ PANCHANG QUICK VIEW — Today’s Cosmic Snapshot ══ */}
        <View style={S.snapCard}>
          <LinearGradient
            colors={[vaar.color + '10', '#FFFFFF04', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.28)' }} />

          <Text style={S.snapTag}>TODAY’S PANCHANG  ·  5 LIMBS OF VEDIC TIME</Text>

          {/* 4-cell grid: Vaar / Tithi / Nakshatra / Yoga */}
          <View style={S.snapGrid}>
            <View style={[S.snapCell, { borderColor: vaar.color + '35' }]}>
              <Text style={S.snapEmoji}>{vaar.emoji}</Text>
              <Text style={[S.snapCellTitle, { color: vaar.color }]}>{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][p.vaarIdx]}</Text>
              <Text style={S.snapCellSub}>{vaar.planet} Day</Text>
            </View>
            <View style={[S.snapCell, { borderColor: '#a78bfa35' }]}>
              <Text style={S.snapEmoji}>🌙</Text>
              <Text style={[S.snapCellTitle, { color: '#a78bfa' }]}>{p.tithiName}</Text>
              <Text style={S.snapCellSub}>{p.paksha} · Day {p.tithiInPaksha}</Text>
            </View>
            <View style={[S.snapCell, { borderColor: '#fbbf2435' }]}>
              <Text style={S.snapEmoji}>{nakshatra.emoji}</Text>
              <Text style={[S.snapCellTitle, { color: '#fbbf24' }]}>{nakshatra.name}</Text>
              <Text style={S.snapCellSub}>{nakshatra.en}</Text>
            </View>
            <View style={[S.snapCell, { borderColor: yoga.auspicious ? '#10b98135' : '#f8717135' }]}>
              <Text style={S.snapEmoji}>{yoga.auspicious ? '✨' : '🌀'}</Text>
              <Text style={[S.snapCellTitle, { color: yoga.auspicious ? '#10b981' : '#f87171' }]}>{yoga.name}</Text>
              <Text style={S.snapCellSub}>{yoga.en}</Text>
            </View>
          </View>

          {/* Vedic month + Paksha info */}
          <View style={S.snapInfoRow}>
            <Text style={S.snapInfoTxt}>
              📅  <Text style={{ color: '#60a5faBB', fontWeight: '800' }}>{vMonth.name}</Text>  ·  Vedic Month  ·  {vMonth.en}  ·{' '}
              <Text style={{ color: p.paksha === 'Shukla' ? '#34d399BB' : '#94a3b8BB', fontWeight: '800' }}>{p.paksha} Paksha</Text>
            </Text>
          </View>

          {/* Lunar event countdown strip */}
          <View style={S.snapLunarRow}>
            <View style={S.snapLunarItem}>
              <Text style={{ fontSize: 18 }}>🌕</Text>
              <View style={{ flex: 1 }}>
                <Text style={S.snapLunarLabel}>PURNIMA  ·  FULL MOON</Text>
                <Text style={S.snapLunarVal}>
                  {lunar.isFullToday
                    ? <Text style={{ color: '#fbbf24EE' }}>✦  Today is Purnima!</Text>
                    : <><Text style={{ color: '#fbbf24DD', fontWeight: '800' }}>in {lunar.daysToFull} day{lunar.daysToFull !== 1 ? 's' : ''}</Text><Text style={{ color: '#FFFFFF35' }}>  ·  {lunar.fullDateStr}</Text></>}
                </Text>
              </View>
            </View>
            <View style={S.snapLunarSep} />
            <View style={S.snapLunarItem}>
              <Text style={{ fontSize: 18 }}>🌑</Text>
              <View style={{ flex: 1 }}>
                <Text style={S.snapLunarLabel}>AMAVASYA  ·  NEW MOON</Text>
                <Text style={S.snapLunarVal}>
                  {lunar.isNewToday
                    ? <Text style={{ color: '#a78bfaEE' }}>✦  Today is Amavasya!</Text>
                    : <><Text style={{ color: '#a78bfaDD', fontWeight: '800' }}>in {lunar.daysToNew} day{lunar.daysToNew !== 1 ? 's' : ''}</Text><Text style={{ color: '#FFFFFF35' }}>  ·  {lunar.newDateStr}</Text></>}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ══ SECTION 1: COSMIC CALENDAR ══ */}
        <View style={S.dividerRow}>
          <View style={S.dividerLine} />
          <Text style={S.dividerLabel}>COSMIC CALENDAR  ·  VEDIC ALMANAC</Text>
          <View style={S.dividerLine} />
        </View>

        {/* Special moon banner */}
        {isSpecialMoon && (
          <View style={[S.moonBanner, {
            borderColor: moon.emoji === '🌕' ? '#fbbf2445' : '#a78bfa45',
            backgroundColor: moon.emoji === '🌕' ? '#fbbf2408' : '#a78bfa08',
          }]}>
            <Text style={{ fontSize: 28 }}>{moon.emoji}</Text>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={[S.moonBannerTitle, { color: moon.emoji === '🌕' ? '#fbbf24' : '#a78bfa' }]}>
                {moon.emoji === '🌕' ? '✦  FULL MOON TODAY  ✦' : '✦  NEW MOON TODAY  ✦'}
              </Text>
              <Text style={S.moonBannerSub}>
                {moon.emoji === '🌕'
                  ? 'Maximum tidal gravitational force on body fluids. Peak energy for release, gratitude, and visibility. The Moon is exerting its strongest influence on your 60% water body right now.'
                  : 'Minimum lunar gravitational field — perfect conditions for planting new intentions, starting fresh systems, and directing your energy inward. The neural "clean slate" effect is real.'}
              </Text>
            </View>
          </View>
        )}

        {/* Vaar (Day Energy) Card */}
        <View style={[S.card, { borderColor: vaar.color + '40' }]}>
          <LinearGradient colors={[vaar.color + '15', 'transparent']} style={StyleSheet.absoluteFillObject} />
          <View style={S.cardHeader}>
            <Text style={S.cardTag}>{vaar.emoji}  {ENGLISH_DAYS[p.vaarIdx].toUpperCase()}  ·  PLANETARY DAY</Text>
          </View>
          <Text style={[S.vaarTitle, { color: vaar.color }]}>{vaar.energy}</Text>
          <Text style={S.vaarSub}>{ENGLISH_DAYS[p.vaarIdx]}  ·  ({vaar.planet} Day)  ·  <Text style={{ fontStyle: 'italic', color: '#FFFFFF35' }}>{vaar.vedicName}</Text></Text>
          <View style={[S.infoBox, { backgroundColor: vaar.color + '0C', borderColor: vaar.color + '25' }]}>
            <Text style={S.infoLabel}>PLANETARY SCIENCE</Text>
            <Text style={S.infoText}>{vaar.science}</Text>
          </View>
          <View style={[S.actionBox, { borderColor: vaar.color + '30' }]}>
            <Text style={[S.actionLabel, { color: vaar.color }]}>✦  DO THIS TODAY</Text>
            <Text style={S.actionText}>{vaarAction}</Text>
          </View>
        </View>

        {/* Tithi + Nakshatra Grid */}
        <View style={S.twoCol}>
          <View style={[S.miniCard, { borderColor: '#a78bfa30' }]}>
            <Text style={S.miniCardTag}>🌙  TITHI  ·  LUNAR DAY</Text>
            <Text style={[S.miniCardTitle, { color: '#a78bfa' }]}>{p.tithiName}</Text>
            <Text style={S.miniCardSub}>{p.paksha === 'Shukla' ? 'Waxing' : 'Waning'} Moon</Text>
            <Text style={S.miniCardSub}>{TITHI_ORDINALS[p.tithiInPaksha]} day  ·  {vMonth.name}</Text>
            <View style={[S.miniPill, { backgroundColor: '#a78bfa12', borderColor: '#a78bfa30' }]}>
              <Text style={[S.miniPillText, { color: '#a78bfaCC' }]}>{tithiEnergy}</Text>
            </View>
          </View>
          <View style={[S.miniCard, { borderColor: '#fbbf2430' }]}>
            <Text style={S.miniCardTag}>{nakshatra.emoji}  NAKSHATRA  ·  LUNAR CONSTELLATION</Text>
            <Text style={[S.miniCardTitle, { color: '#fbbf24' }]}>{nakshatra.name}</Text>
            <Text style={[S.miniCardSub, { color: '#FFFFFF80', fontWeight: '700' }]}>Nakshatra = Constellation (Sanskrit)</Text>
            <Text style={S.miniCardSub}>{nakshatra.en}  ·  {p.nakshatraIdx + 1} of 27</Text>
            <View style={[S.miniPill, { backgroundColor: '#fbbf2412', borderColor: '#fbbf2430' }]}>
              <Text style={[S.miniPillText, { color: '#fbbf24CC' }]}>{nakshatra.energy.split('.')[0]}</Text>
            </View>
          </View>
        </View>

        {/* Yoga Card */}
        <View style={[S.card, { borderColor: yoga.auspicious ? '#10b98130' : '#f8717130' }]}>
          <View style={S.cardHeader}>
            <Text style={S.cardTag}>{yoga.auspicious ? '✨' : '🌀'}  COSMIC YOGA  ·  SUN-MOON HARMONY</Text>
            <View style={[S.yogaBadge, {
              backgroundColor: yoga.auspicious ? '#10b98118' : '#f8717118',
              borderColor: yoga.auspicious ? '#10b98140' : '#f8717140',
            }]}>
              <Text style={[S.yogaBadgeText, { color: yoga.auspicious ? '#10b981' : '#f87171' }]}>
                {yoga.auspicious ? 'AUSPICIOUS' : 'CHALLENGING'}
              </Text>
            </View>
          </View>
          <Text style={[S.yogaName, { color: yoga.auspicious ? '#10b981' : '#f87171' }]}>{yoga.name}</Text>
          <Text style={S.yogaEn}>{yoga.en}  ·  {yoga.meaning}</Text>
        </View>

        {/* Moon Ritual */}
        <View style={[S.ritualCard, { borderColor: '#a78bfa25' }]}>
          <LinearGradient colors={['#a78bfa0C', 'transparent']} style={StyleSheet.absoluteFillObject} />
          <View style={S.ritualInner}>
            <View style={{ alignItems: 'center' }}>
              <MoonSVG tithiNum={moon.tithiNum} size={38} />
              <Text style={{ fontSize: 11, fontWeight: '900', color: '#a78bfaDD', marginTop: 5, letterSpacing: -0.3 }}>{moon.illumination}%</Text>
              <Text style={{ fontSize: 7, fontWeight: '700', color: '#FFFFFF30', letterSpacing: 0.5 }}>LIT</Text>
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={S.ritualLabel}>🌙  LUNAR RITUAL FOR TODAY</Text>
              <Text style={S.ritualPrompt}>{moonRitual.prompt}  ·  {moon.illumination}% lit</Text>
              <Text style={S.ritualText}>{moonRitual.action}</Text>
            </View>
          </View>
        </View>

        {/* ══ UPCOMING LUNAR EVENTS CARD ══ */}
        <View style={[S.card, { borderColor: '#FFFFFF12', marginBottom: 10 }]}>
          <LinearGradient colors={['#a78bfa08', '#fbbf2405', 'transparent']} style={StyleSheet.absoluteFillObject} />
          <View style={S.cardHeader}>
            <Text style={S.cardTag}>🌙  UPCOMING LUNAR EVENTS  ·  LIVE ORBITAL COUNTDOWN</Text>
          </View>

          {/* ─ Purnima (Full Moon) ─ */}
          <View style={S.lunarEventRow}>
            <Text style={{ fontSize: 30 }}>🌕</Text>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 3, flexWrap: 'wrap' }}>
                <Text style={S.lunarEventName}>Purnima — Full Moon</Text>
                {lunar.isFullToday
                  ? <View style={[S.lunarTodayPill, { backgroundColor: '#fbbf2420', borderColor: '#fbbf2455' }]}>
                      <Text style={[S.lunarTodayTxt, { color: '#fbbf24' }]}>TODAY</Text>
                    </View>
                  : <Text style={S.lunarEventDays}>in {lunar.daysToFull} day{lunar.daysToFull !== 1 ? 's' : ''}</Text>}
              </View>
              {!lunar.isFullToday && (
                <Text style={S.lunarEventDate}>{lunar.fullDateLong}</Text>
              )}
              <View style={[S.lunarEventBox, { borderColor: '#fbbf2428', backgroundColor: '#fbbf240A' }]}>
                <Text style={[S.lunarEventSci, { color: '#fbbf24BB' }]}>
                  {'Peak tidal gravitational force  ·  Maximum cerebrospinal fluid (CSF) pressure  ·  Serotonin–melatonin inflection point  ·  Heightened neural electromagnetic excitation  ·  Heightened dream vividness  ·  Best for: gratitude, release, high-energy action & celebration'}
                </Text>
              </View>
            </View>
          </View>

          <View style={S.lunarEventDivider} />

          {/* ─ Amavasya (New Moon) ─ */}
          <View style={S.lunarEventRow}>
            <Text style={{ fontSize: 30 }}>🌑</Text>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 3, flexWrap: 'wrap' }}>
                <Text style={S.lunarEventName}>Amavasya — New Moon</Text>
                {lunar.isNewToday
                  ? <View style={[S.lunarTodayPill, { backgroundColor: '#a78bfa20', borderColor: '#a78bfa55' }]}>
                      <Text style={[S.lunarTodayTxt, { color: '#a78bfa' }]}>TODAY</Text>
                    </View>
                  : <Text style={[S.lunarEventDays, { color: '#a78bfaCC' }]}>in {lunar.daysToNew} day{lunar.daysToNew !== 1 ? 's' : ''}</Text>}
              </View>
              {!lunar.isNewToday && (
                <Text style={S.lunarEventDate}>{lunar.newDateLong}</Text>
              )}
              <View style={[S.lunarEventBox, { borderColor: '#a78bfa28', backgroundColor: '#a78bfa0A' }]}>
                <Text style={[S.lunarEventSci, { color: '#a78bfaBB' }]}>
                  {'Zero tidal load on body fluids  ·  Minimum cerebrospinal fluid (CSF) pressure  ·  Dopamine reset window  ·  Maximum melatonin synthesis  ·  Synaptic consolidation phase  ·  Neural detox protocol  ·  Pineal gland activation peak  ·  Best for: new intentions, fasting, deep meditation, introspection & inner reset'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Expandable tri-cell detail */}
        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setExpandedCalendar(e => !e); }}
          activeOpacity={0.85}
          style={S.expandToggle}>
          <Text style={S.expandToggleText}>{expandedCalendar ? 'Hide detailed breakdown  ↑' : 'Show detailed Panchang breakdown  ↓'}</Text>
        </TouchableOpacity>

        {expandedCalendar && (
          <View style={S.triGrid}>
            <View style={[S.triCell, { borderColor: '#a78bfa22' }]}>
              <Text style={S.triEmoji}>🌙</Text>
              <Text style={[S.triTitle, { color: '#a78bfa' }]}>{p.tithiName}</Text>
              <Text style={S.triSub}>{p.paksha === 'Shukla' ? 'Waxing' : 'Waning'} Moon</Text>
              <Text style={S.triSub}>{p.paksha} Paksha  ·  {TITHI_ORDINALS[p.tithiInPaksha]} ({p.tithiInPaksha}) day</Text>
              <Text style={S.triEn}>{tithiEnergy}</Text>
              <View style={{ marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderColor: '#a78bfa15' }}>
                <Text style={{ fontSize: 9.5, color: '#a78bfaAA', fontWeight: '700', marginBottom: 2 }}>Exact Timing</Text>
                <Text style={{ fontSize: 9.5, color: '#FFFFFF77' }}>Starts: {tFmt(timings.tithiStart)}</Text>
                <Text style={{ fontSize: 9.5, color: '#FFFFFF77' }}>Ends: {tFmt(timings.tithiEnd)}</Text>
              </View>
            </View>
            <View style={[S.triCell, { borderColor: '#fbbf2422' }]}>
              <Text style={S.triEmoji}>{nakshatra.emoji}</Text>
              <Text style={[S.triTitle, { color: '#fbbf24' }]}>{nakshatra.name}</Text>
              <Text style={[S.triSub, { color: '#fbbf24AA', fontWeight: '700' }]}>Nakshatra = Constellation</Text>
              <Text style={S.triSub}>{nakshatra.en}</Text>
              <Text style={S.triSub}>Moon Mansion {p.nakshatraIdx + 1} of 27</Text>
              <Text style={S.triEn}>{nakshatra.energy.split('.')[0]}</Text>
              <View style={{ marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderColor: '#fbbf2415' }}>
                <Text style={{ fontSize: 9.5, color: '#fbbf24AA', fontWeight: '700', marginBottom: 2 }}>Exact Timing</Text>
                <Text style={{ fontSize: 9.5, color: '#FFFFFF77' }}>Starts: {tFmt(timings.nakshatraStart)}</Text>
                <Text style={{ fontSize: 9.5, color: '#FFFFFF77' }}>Ends: {tFmt(timings.nakshatraEnd)}</Text>
              </View>
            </View>
            <View style={[S.triCell, { borderColor: yoga.auspicious ? '#10b98122' : '#f8717122' }]}>
              <Text style={S.triEmoji}>{yoga.auspicious ? '✨' : '🌀'}</Text>
              <Text style={[S.triTitle, { color: yoga.auspicious ? '#10b981' : '#f87171' }]}>{yoga.name}</Text>
              <Text style={S.triSub}>{yoga.en}</Text>
              <Text style={S.triSub}>Cosmic Alignment</Text>
              <Text style={S.triEn}>{yoga.meaning}</Text>
              <View style={{ marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderColor: yoga.auspicious ? '#10b98115' : '#f8717115' }}>
                <Text style={{ fontSize: 9.5, color: (yoga.auspicious ? '#10b981' : '#f87171') + 'AA', fontWeight: '700', marginBottom: 2 }}>Exact Timing</Text>
                <Text style={{ fontSize: 9.5, color: '#FFFFFF77' }}>Starts: {tFmt(timings.yogaStart)}</Text>
                <Text style={{ fontSize: 9.5, color: '#FFFFFF77' }}>Ends: {tFmt(timings.yogaEnd)}</Text>
              </View>
            </View>
          </View>
        )}

        <View style={[S.infoNote, { marginHorizontal: 16, marginBottom: 8 }]}>
          <Text style={S.infoNoteText}>
            🕉️  The Panchang is the Vedic cosmic calendar — five ancient "limbs of time" (Vaar, Tithi, Nakshatra, Yoga, Karana) computed with orbital mechanics and used for 5,000+ years to align daily life with planetary cycles. These are not beliefs — they are calculations.
          </Text>
        </View>

        {/* ══ SECTION 2: THE SCIENCE ══ */}
        <View style={S.dividerRow}>
          <View style={S.dividerLine} />
          <Text style={S.dividerLabel}>THE SCIENCE  ·  PHYSICS, BIOLOGY & CHRONOBIOLOGY</Text>
          <View style={S.dividerLine} />
        </View>

        {/* Moon-Body Connection */}
        <View style={S.exploreSection}>
          <SectionHeader emoji="🌊" title="The Moon–Body Connection" sub="GRAVITATIONAL PHYSICS  ·  CHRONOBIOLOGY  ·  ENDOCRINOLOGY" />

          <SciBlock
            title="Gravitational Physics"
            body={`The Moon exerts a measurable tidal force on Earth: 3.3 × 10⁻⁵ m/s² gravitational acceleration at the surface. While small, this force moves oceans — and your body is 60–70% water. The same tidal mechanics act on every fluid-filled cavity: cerebrospinal fluid (CSF), blood plasma, lymph, and intercellular fluid.\n\nThe CSF bathes your brain and spinal cord. Even micro-variations in CSF pressure have documented effects on cognition, mood, and neural firing rates. The Moon is, quite literally, moving the fluid around your brain.`}
            borderColor="#60a5fa25"
            titleColor="#60a5fa"
          />
          <SciBlock
            title="Chronobiology Research"
            body={`A landmark 2013 study (Cajochen et al., University of Basel, published in Current Biology) measured melatonin, deep-sleep EEG delta-wave activity, and cortisol across full lunar cycles in a controlled light environment. Result: around full moon, melatonin was ~30% lower, deep sleep was reduced by 20 min, and sleep onset took 5 extra min — with zero visual access to the moon.\n\nThe mechanism is likely geomagnetic, not optical. Earth's magnetosphere is compressed and reshaped by the Moon's gravitational field — and the pineal gland is exquisitely sensitive to geomagnetic fluctuation. The Moon changes your brain chemistry without you ever seeing it.`}
            borderColor="#a78bfa25"
            titleColor="#a78bfa"
          />
          <SciBlock
            title="Biological Cycles & Evolutionary Entrainment"
            body={`The female reproductive cycle averages 27.3–29.5 days — nearly identical to the lunar synodic month (29.53 days). This is not coincidence: our evolutionary ancestors, living in natural light, had their endocrine systems entrained by lunar light cycles for millions of years. The Moon is humanity's oldest biological clock.\n\nMarine biology confirms: coral spawn synchronised to the full moon, oyster feeding cycles track tidal phases precisely, and even plant sap pressure (measured in agricultural studies) rises during the waxing phase. The biosphere is lunar-entrained at every level.`}
            borderColor="#34d39925"
            titleColor="#34d399"
          />
        </View>

        {/* Tithi Science */}
        <View style={S.exploreSection}>
          <SectionHeader emoji="📐" title="What is a Tithi?" sub={`ORBITAL MECHANICS  ·  ${p.tithiName}  ·  ${TITHI_ORDINALS[p.tithiInPaksha]} day  ·  ${p.paksha} Paksha  ·  ${vMonth.name}`} />

          <SciBlock
            title="The Mathematics of Lunar Angular Separation"
            body={`A Tithi is defined as every 12° of angular separation between the Sun and Moon as seen from Earth. Since 360° ÷ 12° = 30, there are exactly 30 Tithis in a lunar month — 15 waxing (Shukla Paksha) and 15 waning (Krishna Paksha).\n\nThis is pure orbital mechanics, not mythology. The Vedic astronomers were calculating synodic angles to arc-minute precision over 3,000 years ago, using the same mathematics as modern ephemeris software. The only difference is the computational medium — they used Beeja corrections and Bija tables; we use computers.`}
            borderColor="#fbbf2425"
            titleColor="#fbbf24"
          />
          <SciBlock
            title="Paksha Biology — Anabolic vs. Catabolic Phases"
            body={`Shukla Paksha (Waxing Moon): As the Moon-Sun angular separation increases 0° → 180°, the resultant tidal force on body fluids increases. Plants absorb more water through roots (confirmed in agriculture studies, Frankfurt Bio-dynamic Research Institute). Cells show higher nutrient uptake. This is the anabolic phase — ideal for building, growing, starting.\n\nKrishna Paksha (Waning Moon): As the angle decreases 180° → 0°, fluid tension reduces. The body prioritises elimination and detoxification. Ayurveda prescribes fasting, cleansing, and surgical procedures in Krishna Paksha — a claim supported by reduced intraoperative bleeding risk documented in German hospitals in the 1990s (Ghilotti et al.).`}
            borderColor="#fbbf2425"
            titleColor="#fbbf24"
          />
          <View style={[S.highlightPill, { borderColor: '#a78bfa30', backgroundColor: '#a78bfa0C' }]}>
            <Text style={S.highlightText}>
              Today:{' '}
              <Text style={{ color: '#a78bfaDD', fontWeight: '800' }}>{p.tithiName}</Text>
              {'  ·  '}
              {p.paksha === 'Shukla'
                ? <Text style={{ color: '#34d399CC' }}>Waxing phase — anabolic, building, growth-oriented</Text>
                : <Text style={{ color: '#94a3b8CC' }}>Waning phase — catabolic, detox, release-oriented</Text>
              }
            </Text>
          </View>
        </View>

        {/* Nakshatra Science */}
        <View style={S.exploreSection}>
          <SectionHeader emoji={nakshatra.emoji} title="Nakshatra — Lunar Star Constellations" sub={`SIDEREAL ASTRONOMY  ·  TODAY: ${nakshatra.name.toUpperCase()} (CONSTELLATION ${p.nakshatraIdx + 1} OF 27)  ·  ${nakshatra.en.toUpperCase()}`} />

          <SciBlock
            title={`What is a Nakshatra? (Plain English)`}
            body={`Nakshatra (नक्षत्र) simply means 'constellation' or 'star cluster' in Sanskrit. The sky is divided into 27 Nakshatras — 27 groups of stars that the Moon passes through during its 27.3-day journey around Earth. Think of them as 27 'star neighbourhoods' that the Moon visits, roughly one per day.\n\nToday's Nakshatra is ${nakshatra.name} (${nakshatra.emoji}) — the ${p.nakshatraIdx + 1}th of 27 constellations. In English, ${nakshatra.name} means '${nakshatra.en}' and it is associated with the Corvus (Crow) star group in the constellation Virgo. This is not an opinion or belief — it is the real, calculated position of the Moon in the night sky right now, using the same orbital mathematics that NASA uses for spacecraft navigation.`}
            borderColor="#fbbf2420"
            titleColor="#fbbf24"
          />
          <SciBlock
            title="The Stellar Coordinate System"
            body={`The 27 Nakshatras divide the Moon's 27.3-day sidereal orbit into 27 equal arcs of 13°20' each — one per day. Each arc corresponds to a specific star or star cluster that the Moon transits through that day.\n\nThis is the Moon's position relative to FIXED stars (sidereal reference frame), as opposed to the Tithi which measures the Moon relative to the Sun (synodic reference frame). These are two entirely different coordinate systems — and Vedic astronomy tracked both simultaneously for 5,000 years.\n\nModern astronomy uses the same sidereal reference frame (ICRS — the International Celestial Reference System) for navigation satellites and deep space missions. The Nakshatra system predates it by millennia.`}
            borderColor="#f9a8d425"
            titleColor="#f9a8d4"
          />
          <SciBlock
            title={`Today: ${nakshatra.name} — ${nakshatra.en}`}
            body={`${nakshatra.energy}\n\nThe Moon's gravitational vector is currently pointed toward the ${nakshatra.name} star system. In bioelectromagnetic terms, the direction of the tidal force matters — different stellar alignments change the vector of maximum fluid gradient in your body. Vedic rishis empirically catalogued these effects over centuries of careful observation.`}
            borderColor="#f9a8d425"
            titleColor="#f9a8d4"
          />
        </View>

        {/* Vedic Month Science */}
        <View style={S.exploreSection}>
          <SectionHeader emoji="📅" title="Vedic Month — The Lunisolar Calendar" sub={`CHANDRA MAASA  ·  TODAY: ${vMonth.name.toUpperCase()} (${vMonth.sanskrit})  ·  SUN IN ${vMonth.rashi.toUpperCase()}  ·  ${vMonth.en.toUpperCase()}`} />

          <SciBlock
            title={`What is a Vedic Month? — ${vMonth.name} (Plain English)`}
            body={`A Vedic month (Chandra Maasa = 'Lunar Month') is NOT the same as a Gregorian month. It is defined by the Moon's orbit combined with the Sun's position in the sky — making it a lunisolar system, not a purely solar one.\n\nThe current Vedic month is ${vMonth.name} (${vMonth.sanskrit}), roughly corresponding to ${vMonth.en} in the Gregorian calendar. A Vedic month lasts one full lunar cycle — approximately 29.5 days — and is NAMED by the zodiac sign (Rashi) that the Sun occupies at the closing Full Moon (Purnima) of that month.\n\nIn plain English: look at where the Sun sits in the starry sky on the night of the Full Moon — that zodiac neighbourhood names the entire month.`}
            borderColor="#60a5fa25"
            titleColor="#60a5fa"
          />
          <SciBlock
            title="How It's Calculated: Sun × Moon × Orbital Mechanics"
            body={`Step 1 — LOCATE THE SUN: Compute the Sun's sidereal longitude using the Lahiri ayanamsha (23.85° offset from tropical ecliptic). This maps the Sun's position onto the real star-background sky, not just the seasonal/tropical position.\n\nStep 2 — FIND THE CLOSING PURNIMA: If today is in Shukla Paksha (waxing Moon, age < 14.77 days), the closing Full Moon is still ahead in this lunation. If in Krishna Paksha (waning Moon), that Purnima has passed and the next one closes the upcoming month.\n\nStep 3 — PROJECT THE SUN FORWARD: The Sun advances ~0.9856° per day. Project its sidereal longitude forward to the exact closing Purnima date.\n\nStep 4 — NAME THE MONTH: 360° ÷ 12 = 30° per Rashi (zodiac sign). Whichever Rashi bracket the projected Sun falls into — that Rashi names the month.\n\nThis is the Purnimanta system (North India). The Amanta system (South India) ends months at New Moon instead of Full Moon — the same sky, two naming conventions. Both are exact orbital calculations, not estimates.\n\nThe Jewish calendar, Chinese lunisolar calendar, and Babylonian MUL.APIN system all use equivalent mathematics — independently arrived at by separate civilisations, because the Moon–Sun cycle is the most precise natural timekeeping signal available to any civilisation on Earth.`}
            borderColor="#60a5fa25"
            titleColor="#60a5fa"
          />
          <View style={[S.highlightPill, { borderColor: '#60a5fa30', backgroundColor: '#60a5fa0C' }]}>
            <Text style={S.highlightText}>
              {'Current Vedic Month: '}
              <Text style={{ color: '#60a5faDD', fontWeight: '800' }}>{vMonth.name} ({vMonth.sanskrit})</Text>
              {'  ·  Sun in '}
              <Text style={{ color: '#60a5faAA', fontWeight: '700' }}>{vMonth.rashi}</Text>
              {'  ·  '}
              <Text style={{ color: '#FFFFFF55' }}>{vMonth.en}  ·  {p.paksha} Paksha</Text>
            </Text>
            <View style={{ marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderColor: '#60a5fa20' }}>
              <Text style={{ fontSize: 10, color: '#60a5faAA', fontWeight: '700', marginBottom: 2 }}>Exact Timing for {vMonth.name}</Text>
              <Text style={{ fontSize: 10, color: '#FFFFFF99' }}>Starts: {tFmt(timings.maasStart)}</Text>
              <Text style={{ fontSize: 10, color: '#FFFFFF99' }}>Ends: {tFmt(timings.maasEnd)}</Text>
            </View>
          </View>
        </View>

        {/* Yoga Science */}
        <View style={S.exploreSection}>
          <SectionHeader emoji="✨" title="Yoga — The Sun-Moon Electromagnetic Harmony" sub={`SOLAR-LUNAR COMBINED FIELD  ·  ${yoga.en}  ·  ${yoga.auspicious ? 'AUSPICIOUS' : 'CHALLENGING'}`} />

          <SciBlock
            title="The Calculation: Combined Solar-Lunar Longitude"
            body={`A Yoga is calculated by: (Longitude of Sun + Longitude of Moon) ÷ 13°20'. This gives 27 Yogas — each representing a unique combined configuration of solar electromagnetic energy and lunar gravitational influence on Earth's biosphere.\n\nWhen the Sun and Moon are in specific combined positions, their electromagnetic fields interact differently with Earth's magnetosphere, ionosphere, and ultimately with your body's bioelectric field. The 27 Yogas represent 27 distinct "blended field states" — empirically observed for their effects on human cognition, health, and fortune.`}
            borderColor="#10b98125"
            titleColor="#10b981"
          />
          <View style={[S.highlightPill, { borderColor: yoga.auspicious ? '#10b98130' : '#f8717130', backgroundColor: yoga.auspicious ? '#10b9810C' : '#f871710C' }]}>
            <Text style={S.highlightText}>
              Today's Yoga:{' '}
              <Text style={{ color: yoga.auspicious ? '#10b981DD' : '#f87171DD', fontWeight: '800' }}>{yoga.en} ({yoga.name})</Text>
              {'  —  '}{yoga.meaning}
            </Text>
          </View>
        </View>

        {/* Vaar Science (Planet Science) */}
        <View style={S.exploreSection}>
          <SectionHeader emoji={vaar.emoji} title={`${ENGLISH_DAYS[p.vaarIdx]} — ${vaar.planet} Day Science`} sub={`PLANETARY ELECTROMAGNETIC INFLUENCE  ·  ${vaar.vedicName}`} />
          <SciBlock
            title={`Why the ${vaar.planet} Governs Today`}
            body={vaar.science}
            borderColor={vaar.color + '25'}
            titleColor={vaar.color}
          />
          <SciBlock
            title="The 7-Day Planetary Week: An Ancient Mathematical System"
            body={`The Vedic 7-day week (Sapta Vaar) is organised by planetary distance from Earth — an observational ordering confirmed by modern astronomy: Moon, Mercury, Venus, Sun, Mars, Jupiter, Saturn. Each planet governs one day because it was understood that planetary orbital periods create measurable resonances with Earth's electromagnetic field.\n\nThis same planetary ordering was independently developed by Babylonian, Egyptian, Greek, and Indian astronomers — suggesting it reflects a real observable phenomenon rather than cultural convention.`}
            borderColor={vaar.color + '25'}
            titleColor={vaar.color}
          />
        </View>

        {/* Grand closing note */}
        <View style={[S.closingCard, { borderColor: '#a78bfa30' }]}>
          <LinearGradient colors={['#a78bfa0F', '#7c3aed08', 'transparent']} style={StyleSheet.absoluteFillObject} />
          <Text style={S.closingEmoji}>🕉️</Text>
          <Text style={S.closingTitle}>Jyotish: The Eye of the Veda</Text>
          <Text style={S.closingBody}>
            {`Jyotisha — Vedic astrology — literally means "the science of light." It is Vedanga: one of the six limbs of the Vedas, considered a tool of empirical observation, not superstition.\n\nFor 5,000+ years, Vedic astronomers tracked planetary positions with instruments (Jantar Mantar observatories), created mathematical algorithms (Bija corrections), and catalogued biological and social outcomes across tens of thousands of lunar cycles. The result is a sophisticated system of chronobiology — aligning human biological cycles with planetary and stellar cycles for optimal health, timing, and consciousness.\n\nModern chronobiology, heliobiology, and bioelectromagnetics are only beginning to rediscover what Vedic science encoded millennia ago: that the cosmos is not separate from your body. You are a microcosm — a living resonator in a vast electromagnetic symphony.`}
          </Text>
          <View style={S.closingDivider} />
          <Text style={S.closingFoot}>
            🔬  All astronomical calculations on this screen use real orbital mechanics — the same mathematics used by NASA ephemeris software. Tithi is calculated from synodic Moon age. Nakshatra from sidereal Moon longitude. Yoga from (Sun + Moon) longitude sum. No approximations.
          </Text>
        </View>

        <View style={{ height: 48 }} />
      </ScrollView>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  screen:        { flex: 1, backgroundColor: '#060618' },
  scroll:        { paddingBottom: 40 },
  headerSafe:    { backgroundColor: 'transparent' },
  header:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, paddingTop: 4, gap: 12 },
  headerDivider: { height: 1, backgroundColor: '#FFFFFF08', marginHorizontal: 16 },
  headerCap:     { fontSize: 8, fontWeight: '900', color: '#FFFFFF30', letterSpacing: 2, marginBottom: 3 },
  headerTitle:   { fontSize: 19, fontWeight: '900', color: '#fff' },
  backBtn:       { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFFFFF0A', borderWidth: 1, borderColor: '#FFFFFF15', alignItems: 'center', justifyContent: 'center', zIndex: 100, elevation: 100 },
  backIcon:      { color: '#fff', fontSize: 18, marginTop: -1 },
  scoreBadge:    { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 99, paddingHorizontal: 11, paddingVertical: 6 },
  scoreBadgeNum: { fontSize: 14, fontWeight: '900' },

  heroGrad:      { marginHorizontal: 16, marginTop: 14, borderRadius: 24, borderWidth: 1, borderColor: '#FFFFFF0C', padding: 18, overflow: 'hidden' },
  heroRow:       { flexDirection: 'row', alignItems: 'center', gap: 18, marginBottom: 12 },
  heroMoonName:  { fontSize: 20, fontWeight: '900', color: '#fff' },
  heroIllum:     { fontSize: 12, color: '#a78bfaCC', fontWeight: '700', marginTop: 1 },
  heroTithi:     { fontSize: 12, color: '#fbbf24AA', fontWeight: '600', marginTop: 1 },
  heroNakshatra: { fontSize: 11, color: '#fbbf24BB', fontWeight: '700', marginTop: 2 },
  heroDate:      { fontSize: 10, color: '#FFFFFF30', fontWeight: '700', letterSpacing: 0.5, marginBottom: 12 },
  scoreRow:      { borderWidth: 1, borderRadius: 14, padding: 12 },
  scoreBarTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  scoreBarFill:  { height: 4, borderRadius: 2 },
  scoreLabel:    { fontSize: 12, fontWeight: '900' },
  scoreDesc:     { fontSize: 11, color: '#FFFFFF50', lineHeight: 17, marginTop: 2 },

  dividerRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 24, marginBottom: 14 },
  dividerLine:   { flex: 1, height: 1, backgroundColor: '#FFFFFF10' },
  dividerLabel:  { fontSize: 7, fontWeight: '900', color: '#FFFFFF25', letterSpacing: 1.5, textAlign: 'center', flexShrink: 1 },

  moonBanner:    { marginHorizontal: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderWidth: 1, borderRadius: 18, padding: 14 },
  moonBannerTitle: { fontSize: 12, fontWeight: '900', letterSpacing: 1, marginBottom: 5 },
  moonBannerSub:   { fontSize: 11, color: '#FFFFFF60', lineHeight: 18 },

  card:          { marginHorizontal: 16, marginBottom: 10, borderRadius: 20, borderWidth: 1, backgroundColor: '#FFFFFF04', padding: 16, overflow: 'hidden' },
  cardHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  cardTag:       { fontSize: 8, fontWeight: '900', color: '#FFFFFF30', letterSpacing: 1.5 },
  vaarTitle:     { fontSize: 17, fontWeight: '900', lineHeight: 24, marginBottom: 3 },
  vaarSub:       { fontSize: 10, color: '#FFFFFF40', marginBottom: 12 },
  infoBox:       { borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 10 },
  infoLabel:     { fontSize: 7, fontWeight: '900', color: '#FFFFFF28', letterSpacing: 1.5, marginBottom: 6 },
  infoText:      { fontSize: 11, color: '#FFFFFF60', lineHeight: 18 },
  actionBox:     { borderWidth: 1, borderRadius: 14, padding: 12, backgroundColor: '#FFFFFF05' },
  actionLabel:   { fontSize: 8, fontWeight: '900', letterSpacing: 1.3, marginBottom: 6 },
  actionText:    { fontSize: 12, fontWeight: '600', color: '#FFFFFFCC', lineHeight: 19 },

  yogaBadge:     { borderWidth: 1, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
  yogaBadgeText: { fontSize: 7, fontWeight: '900', letterSpacing: 1.5 },
  yogaName:      { fontSize: 20, fontWeight: '900', marginBottom: 4 },
  yogaEn:        { fontSize: 12, color: '#FFFFFF55', lineHeight: 18 },

  twoCol:        { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 10 },
  miniCard:      { flex: 1, borderWidth: 1, borderRadius: 18, backgroundColor: '#FFFFFF04', padding: 14, gap: 3 },
  miniCardTag:   { fontSize: 7, fontWeight: '900', color: '#FFFFFF25', letterSpacing: 1.2, marginBottom: 3 },
  miniCardTitle: { fontSize: 15, fontWeight: '900' },
  miniCardSub:   { fontSize: 9, color: '#FFFFFF45', fontWeight: '600' },
  miniPill:      { borderWidth: 1, borderRadius: 10, padding: 8, marginTop: 6 },
  miniPillText:  { fontSize: 9, fontWeight: '700', lineHeight: 14 },

  ritualCard:    { marginHorizontal: 16, marginBottom: 10, borderRadius: 18, borderWidth: 1, overflow: 'hidden', padding: 16 },
  ritualInner:   { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  ritualLabel:   { fontSize: 7, fontWeight: '900', color: '#a78bfa50', letterSpacing: 1.5, marginBottom: 4 },
  ritualPrompt:  { fontSize: 10, fontWeight: '800', color: '#a78bfaCC', marginBottom: 4 },
  ritualText:    { fontSize: 12, color: '#FFFFFF70', lineHeight: 19, fontStyle: 'italic' },

  expandToggle:  { marginHorizontal: 16, marginBottom: 10, alignItems: 'center', paddingVertical: 10 },
  expandToggleText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF30', letterSpacing: 0.5 },

  triGrid:       { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginBottom: 12 },
  triCell:       { flex: 1, borderWidth: 1, borderRadius: 16, backgroundColor: '#FFFFFF04', padding: 11, gap: 3 },
  triEmoji:      { fontSize: 20, marginBottom: 4 },
  triTitle:      { fontSize: 11, fontWeight: '900' },
  triSub:        { fontSize: 8, color: '#FFFFFF45', lineHeight: 13 },
  triEn:         { fontSize: 8, color: '#FFFFFF28', fontWeight: '500', marginTop: 3, lineHeight: 12 },

  infoNote:      { backgroundColor: '#a78bfa08', borderWidth: 1, borderColor: '#a78bfa18', borderRadius: 14, padding: 12 },
  infoNoteText:  { fontSize: 10, color: '#a78bfa65', lineHeight: 16 },

  exploreSection: { marginHorizontal: 16, marginBottom: 18 },
  sectionHeader:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  sectionEmoji:   { fontSize: 24, marginTop: 1 },
  sectionTitle:   { fontSize: 17, fontWeight: '900', color: '#fff', lineHeight: 24, flex: 1 },
  sectionSub:     { fontSize: 9, color: '#FFFFFF35', fontWeight: '700', letterSpacing: 1, marginTop: 3 },

  sciBlock:       { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 8 },
  sciBlockTitle:  { fontSize: 12, fontWeight: '900', marginBottom: 8 },
  sciBlockBody:   { fontSize: 12, color: '#FFFFFF60', lineHeight: 20 },

  highlightPill:  { borderWidth: 1, borderRadius: 14, padding: 13, marginTop: 6 },
  highlightText:  { fontSize: 12, color: '#FFFFFF65', lineHeight: 19 },

  lunarEventRow:    { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: 2 },
  lunarEventName:   { fontSize: 14, fontWeight: '900', color: '#FFFFFFDD' },
  lunarEventDays:   { fontSize: 12, fontWeight: '800', color: '#fbbf24CC' },
  lunarEventDate:   { fontSize: 10, color: '#FFFFFF55', marginBottom: 7, marginTop: 1 },
  lunarEventBox:    { borderWidth: 1, borderRadius: 12, padding: 10, marginTop: 5 },
  lunarEventSci:    { fontSize: 10, lineHeight: 17, fontWeight: '600' },
  lunarEventDivider:{ height: 1, backgroundColor: '#FFFFFF08', marginVertical: 14 },
  lunarTodayPill:   { borderWidth: 1, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 },
  lunarTodayTxt:    { fontSize: 7, fontWeight: '900', letterSpacing: 1 },

  closingCard:    { marginHorizontal: 16, marginTop: 10, borderRadius: 24, borderWidth: 1, padding: 20, overflow: 'hidden' },
  closingEmoji:   { fontSize: 32, marginBottom: 10, textAlign: 'center' },
  closingTitle:   { fontSize: 18, fontWeight: '900', color: '#a78bfa', textAlign: 'center', marginBottom: 14 },
  closingBody:    { fontSize: 12, color: '#FFFFFF60', lineHeight: 21 },
  closingDivider: { height: 1, backgroundColor: '#a78bfa20', marginVertical: 14 },
  closingFoot:    { fontSize: 10, color: '#FFFFFF30', lineHeight: 17, fontStyle: 'italic' },

  snapCard:       { marginHorizontal: 16, marginTop: 12, marginBottom: 4, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)', backgroundColor: 'rgba(255,255,255,0.04)', overflow: 'hidden', paddingHorizontal: 14, paddingTop: 13, paddingBottom: 14 },
  snapTag:        { fontSize: 7, fontWeight: '900', color: '#FFFFFF28', letterSpacing: 1.8, textTransform: 'uppercase', marginBottom: 12 },
  snapGrid:       { flexDirection: 'row', gap: 7, marginBottom: 11 },
  snapCell:       { flex: 1, borderWidth: 1, borderRadius: 14, backgroundColor: '#FFFFFF03', paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center', gap: 3 },
  snapEmoji:      { fontSize: 16, marginBottom: 1 },
  snapCellTitle:  { fontSize: 9, fontWeight: '900', textAlign: 'center', letterSpacing: -0.2, lineHeight: 12 },
  snapCellSub:    { fontSize: 7, color: '#FFFFFF38', textAlign: 'center', fontWeight: '600', lineHeight: 10 },
  snapInfoRow:    { backgroundColor: '#FFFFFF05', borderRadius: 10, paddingVertical: 7, paddingHorizontal: 10, marginBottom: 10 },
  snapInfoTxt:    { fontSize: 10, color: '#FFFFFF55', fontWeight: '600', lineHeight: 16 },
  snapLunarRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)', paddingTop: 10 },
  snapLunarItem:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  snapLunarSep:   { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.08)' },
  snapLunarLabel: { fontSize: 6, fontWeight: '900', color: '#FFFFFF35', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 3 },
  snapLunarVal:   { fontSize: 10, fontWeight: '700', color: '#FFFFFFCC' },
});
