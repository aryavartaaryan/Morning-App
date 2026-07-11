/**
 * metabolic-period.tsx — Option C
 * Full-screen deep-dive page for the current Ayurvedic metabolic period.
 * Accessed from MetabolicStoryModal Card 5 → "Full Guide".
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, Animated, ImageBackground,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Svg, { Circle as SvgCircle, Path as SvgPath } from 'react-native-svg';
import { store, KEYS } from '@/lib/storage';
import { getSolarTimes, type SolarTimes } from '@/lib/solar';
import { getDoshaPeriods, PERIOD_TEMPLATES, type DoshaPeriod } from '@/lib/ayurvedicPeriods';
import { WELLNESS, PERIOD_SANSKRIT, DOSHA_FULL_SCIENCE } from '@/lib/wellnessData';
import { useBgContext } from '@/lib/bgContext';

const { width: W } = Dimensions.get('window');

// ── Design tokens ──────────────────────────────────────────────────────────────
const DOSHA_COLOR: Record<string, string> = {
  kapha: '#34d399',
  pitta: '#fb923c',
  vata:  '#a78bfa',
};
const SKY   = '#38bdf8';  // sky-blue primary
const SKY2  = '#7dd3fc';  // light sky-blue secondary
const DOSHA_BG_GRAD: Record<string, [string, string]> = {
  kapha: ['#04182ACC', '#020E1ACC'],
  pitta: ['#04182ACC', '#020E1ACC'],
  vata:  ['#04182ACC', '#020E1ACC'],
};

// ── Helpers ────────────────────────────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, '0');
function fmt12H(dec: number): string {
  const total = Math.round(dec * 60) % (24 * 60);
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  const ap = hh < 12 ? 'AM' : 'PM';
  const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  return `${pad(h12)}:${pad(mm)} ${ap}`;
}

// ── 24-Hour Body Clock SVG ─────────────────────────────────────────────────────
function BodyClockFull({ periodId, dosha, solarTimes }: {
  periodId: string;
  dosha: string;
  solarTimes: SolarTimes | null;
}) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.12, duration: 1800, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1,    duration: 1800, useNativeDriver: true }),
    ])).start();
  }, []);

  const SIZE = W - 48;
  const C = SIZE / 2;
  const OUTER_R = SIZE * 0.38;
  const ARC_W = SIZE * 0.07;

  const sr = solarTimes?.sunrise ?? 6;
  const ss = solarTimes?.sunset ?? 18;
  const sn = solarTimes?.solarNoon ?? 12;
  const dayLen = ss - sr;
  const nightLen = 24 - dayLen;
  const daySeg = dayLen / 3;
  const nightSeg = nightLen / 3;
  const bmStart = sr + 24 - 1.6;

  const PERIODS_CLOCK = [
    { id: 'night_vata',     start: bmStart,         end: sr + 24,        color: '#818cf8', label: 'Pre-Dawn', emoji: '✨' },
    { id: 'morning_kapha',  start: sr,               end: sr + daySeg,   color: '#34d399', label: 'Morning',  emoji: '💪' },
    { id: 'midday_pitta',   start: sr + daySeg,      end: sr + 2*daySeg, color: '#fb923c', label: 'Noon',     emoji: '🔥' },
    { id: 'afternoon_vata', start: sr + 2*daySeg,    end: ss,            color: '#a78bfa', label: 'Afternoon',emoji: '🌬️' },
    { id: 'evening_kapha',  start: ss,               end: ss + nightSeg, color: '#34d399', label: 'Evening',  emoji: '🌅' },
    { id: 'night_pitta',    start: ss + nightSeg,    end: bmStart,       color: '#fbbf24', label: 'Night',    emoji: '🌕' },
  ];

  const hourToAngle = (h: number) => ((h % 24) / 24) * 360 - 90;

  const arcPath = (startH: number, endH: number, r: number) => {
    const s = startH % 24;
    const e = endH % 24;
    const dur = ((endH - startH) + 24) % 24;
    const large = dur > 12 ? 1 : 0;
    const sa = (hourToAngle(s) * Math.PI) / 180;
    const ea = (hourToAngle(e === 0 ? 24 : e) * Math.PI) / 180;
    const sx = C + r * Math.cos(sa); const sy = C + r * Math.sin(sa);
    const ex = C + r * Math.cos(ea); const ey = C + r * Math.sin(ea);
    return `M ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${ex} ${ey}`;
  };

  const now = new Date();
  const nowH = now.getHours() + now.getMinutes() / 60;
  const nowA = (hourToAngle(nowH) * Math.PI) / 180;
  const nowX = C + OUTER_R * Math.cos(nowA);
  const nowY = C + OUTER_R * Math.sin(nowA);

  // Clock face markers: 12 AM, 6 AM, 12 PM, 6 PM
  const MARKERS = [
    { h: 0, label: '12 AM' }, { h: 6, label: '6 AM' },
    { h: 12, label: '12 PM' }, { h: 18, label: '6 PM' },
  ];

  const accent = SKY;

  return (
    <View style={{ alignItems: 'center', marginTop: 10 }}>
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {/* Outer decorative ring */}
        <SvgCircle cx={C} cy={C} r={OUTER_R + ARC_W * 0.6} fill="none"
          stroke="rgba(255,255,255,0.04)" strokeWidth={1} />

        {/* Track */}
        <SvgCircle cx={C} cy={C} r={OUTER_R} fill="none"
          stroke="rgba(255,255,255,0.06)" strokeWidth={ARC_W + 2} />

        {/* Period arcs */}
        {PERIODS_CLOCK.map(p => {
          const isActive = p.id === periodId;
          return (
            <SvgPath
              key={p.id}
              d={arcPath(p.start, p.end, OUTER_R)}
              fill="none"
              stroke={p.color}
              strokeWidth={isActive ? ARC_W + 6 : ARC_W - 4}
              strokeLinecap="butt"
              opacity={isActive ? 1 : 0.22}
            />
          );
        })}

        {/* Clock face hour markers */}
        {MARKERS.map(m => {
          const a = (hourToAngle(m.h) * Math.PI) / 180;
          const inner = OUTER_R - ARC_W - 10;
          const outer = OUTER_R + ARC_W + 14;
          const tx = C + (outer + 18) * Math.cos(a);
          const ty = C + (outer + 18) * Math.sin(a);
          const mx = C + inner * Math.cos(a);
          const my = C + inner * Math.sin(a);
          const ex = C + (OUTER_R - ARC_W / 2) * Math.cos(a);
          const ey = C + (OUTER_R - ARC_W / 2) * Math.sin(a);
          return (
            <React.Fragment key={m.h}>
              <SvgPath d={`M ${mx} ${my} L ${ex} ${ey}`}
                stroke="rgba(255,255,255,0.20)" strokeWidth={1.5} />
            </React.Fragment>
          );
        })}

        {/* NOW dot with glow */}
        <SvgCircle cx={nowX} cy={nowY} r={OUTER_R * 0.12} fill={accent} opacity={0.20} />
        <SvgCircle cx={nowX} cy={nowY} r={OUTER_R * 0.07} fill={accent} opacity={0.40} />
        <SvgCircle cx={nowX} cy={nowY} r={OUTER_R * 0.045} fill="#FFFFFF" opacity={0.95} />

        {/* Inner dark circle */}
        <SvgCircle cx={C} cy={C} r={OUTER_R - ARC_W - 14} fill="rgba(4,4,12,0.80)" />
      </Svg>

      {/* Center overlay (positioned over SVG) */}
      <View style={{
        position: 'absolute',
        top: 0, left: (W - 48 - (OUTER_R - ARC_W - 14) * 2) / 2,
        width: (OUTER_R - ARC_W - 14) * 2,
        height: SIZE,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
      }}>
        <Text style={{ fontSize: 9, fontWeight: '900', color: 'rgba(255,255,255,0.30)', letterSpacing: 1.8, textAlign: 'center' }}>YOUR BODY CLOCK</Text>
        <Text style={{ fontSize: 11, fontWeight: '900', color: accent, textAlign: 'center', lineHeight: 15 }}>
          NOW ↑
        </Text>
        <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.40)', textAlign: 'center', lineHeight: 13 }}>
          {fmt12H(sr)} sunrise{'\n'}{fmt12H(ss)} sunset
        </Text>
      </View>

      {/* Period legend below clock */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 14, paddingHorizontal: 8 }}>
        {PERIODS_CLOCK.map(p => (
          <View key={p.id} style={{
            flexDirection: 'row', alignItems: 'center', gap: 4,
            paddingHorizontal: 8, paddingVertical: 4,
            borderRadius: 10, borderWidth: 1,
            borderColor: p.color + (p.id === periodId ? '60' : '30'),
            backgroundColor: p.color + (p.id === periodId ? '20' : '08'),
          }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: p.color }} />
            <Text style={{ fontSize: 9, color: p.id === periodId ? p.color : 'rgba(255,255,255,0.45)', fontWeight: p.id === periodId ? '900' : '600' }}>
              {p.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Sun Position Section ───────────────────────────────────────────────────────
function SunPositionSection({ period, solarTimes }: {
  period: DoshaPeriod;
  solarTimes: SolarTimes | null;
}) {
  const accent = SKY;
  const sr = solarTimes?.sunrise ?? 6;
  const ss = solarTimes?.sunset ?? 18;
  const sn = solarTimes?.solarNoon ?? 12;
  const now = new Date();
  const nowH = now.getHours() + now.getMinutes() / 60;
  const dayLen = ss - sr;
  const t = Math.max(0, Math.min(1, (nowH - sr) / dayLen));
  const isNight = nowH < sr || nowH > ss;
  const daylight = dayLen;
  const dlHr = Math.floor(daylight);
  const dlMn = Math.round((daylight - dlHr) * 60);

  const AW = W - 80;
  const AH = 60;
  const cx = AW / 2;
  const cy = AH + 12;
  const rx = AW / 2 - 6;
  const ry = AH - 8;
  const theta = isNight ? Math.PI * 0.5 : Math.PI * (1 - t);
  const sunX = cx + rx * Math.cos(theta);
  const sunY = cy - ry * Math.sin(theta);
  const labelX = Math.max(20, Math.min(AW - 20, sunX));

  return (
    <View style={[S.section, { borderColor: accent + '25', backgroundColor: accent + '08' }]}>
      <Text style={[S.sectionLabel, { color: accent }]}>☀️  SUN POSITION & PERIOD DURATION</Text>

      {/* Arc */}
      <View style={{ alignItems: 'center', marginTop: 8 }}>
        <View style={{ width: AW, height: 32, position: 'relative', marginBottom: 2 }}>
          <View style={{ position: 'absolute', left: labelX - 18, alignItems: 'center', width: 36 }}>
            <Text style={{ fontSize: 8, color: '#fbbf24', fontWeight: '900' }}>NOW</Text>
            <View style={{ width: 1.5, height: 8, backgroundColor: '#fbbf24', opacity: 0.7 }} />
          </View>
        </View>
        <Svg width={AW} height={AH + 18} viewBox={`0 0 ${AW} ${AH + 18}`}>
          <SvgPath d={`M 6 ${cy} A ${rx} ${ry} 0 0 1 ${AW - 6} ${cy}`}
            stroke="rgba(255,255,255,0.08)" strokeWidth={2} fill="none" />
          <SvgCircle cx={sunX} cy={sunY} r={18} fill={isNight ? '#818cf8' : '#fbbf24'} opacity={0.12} />
          <SvgCircle cx={sunX} cy={sunY} r={10} fill={isNight ? '#818cf8' : '#fbbf24'} opacity={0.22} />
          <SvgCircle cx={sunX} cy={sunY} r={6}  fill={isNight ? '#818cf8' : '#fbbf24'} opacity={0.95} />
        </Svg>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: AW, marginTop: -4 }}>
          <Text style={S.arcLabel}>{solarTimes ? fmt12H(sr) : 'Sunrise'}</Text>
          <Text style={S.arcLabel}>Solar Noon · {solarTimes ? fmt12H(sn) : '12:00 PM'}</Text>
          <Text style={S.arcLabel}>{solarTimes ? fmt12H(ss) : 'Sunset'}</Text>
        </View>
      </View>

      {/* Stats grid */}
      <View style={S.statsGrid}>
        {[
          { label: 'Period Start', value: period.startLabel, color: accent },
          { label: 'Period End',   value: period.endLabel,   color: accent },
          { label: 'Remaining',    value: period.minutesRemaining >= 60
              ? `${Math.floor(period.minutesRemaining / 60)}h ${period.minutesRemaining % 60}m`
              : `${period.minutesRemaining}m`,        color: '#34d399' },
          { label: 'Daylight',     value: `${dlHr}h ${dlMn}m`, color: '#fbbf24' },
        ].map((s, i) => (
          <View key={i} style={S.statCell}>
            <Text style={[S.statValue, { color: s.color }]}>{s.value}</Text>
            <Text style={S.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── All 6 Periods Overview ─────────────────────────────────────────────────────
function AllPeriodsOverview({ currentId, solarTimes }: { currentId: string; solarTimes: SolarTimes | null }) {
  const now = new Date();
  const nowH = now.getHours() + now.getMinutes() / 60;
  const solar = solarTimes ?? { sunrise: 6, sunset: 18, solarNoon: 12 };
  const periods = useMemo(() => getDoshaPeriods(solar, nowH), [nowH]);

  const DISPLAY = ['morning_kapha', 'midday_pitta', 'afternoon_vata', 'evening_kapha', 'night_pitta', 'night_vata'];
  const tmpl = PERIOD_TEMPLATES;

  return (
    <View style={{ gap: 8 }}>
      {DISPLAY.map(id => {
        const p = periods.find(x => x.id === id);
        const t = tmpl.find(x => x.id === id);
        if (!p || !t) return null;
        const isCurrent = id === currentId;
        const color = t.color;
        return (
          <View key={id} style={[S.periodRow, {
            borderColor: isCurrent ? color + '55' : 'rgba(255,255,255,0.10)',
            backgroundColor: isCurrent ? color + '12' : 'rgba(255,255,255,0.03)',
          }]}>
            {isCurrent && (
              <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, borderRadius: 2, backgroundColor: color }} />
            )}
            <Text style={{ fontSize: 20, marginRight: 12, paddingLeft: isCurrent ? 6 : 0 }}>{t.emoji}</Text>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <Text style={{ fontSize: 12, fontWeight: '900', color: isCurrent ? color : '#FFFFFFCC' }}>
                  {t.englishLabel}
                </Text>
                {isCurrent && (
                  <View style={[S.activePill, { backgroundColor: color + '20', borderColor: color + '50' }]}>
                    <Text style={[S.activePillTxt, { color }]}>ACTIVE</Text>
                  </View>
                )}
              </View>
              <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.40)', fontWeight: '600' }}>
                {p.startLabel} → {p.endLabel}
              </Text>
            </View>
            <View style={[S.statusChip, {
              backgroundColor: p.status === 'active' ? color + '20' : p.status === 'completed' ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.05)',
            }]}>
              <Text style={{ fontSize: 8, fontWeight: '800', color: p.status === 'active' ? color : p.status === 'completed' ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.40)', letterSpacing: 0.8 }}>
                {p.status === 'active' ? 'NOW' : p.status === 'completed' ? 'DONE' : `IN ${p.minutesUntil >= 60 ? `${Math.floor(p.minutesUntil / 60)}h` : `${p.minutesUntil}m`}`}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────────
export default function MetabolicPeriodScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    periodId: string;
    periodStart: string;
    periodEnd: string;
    minutesRemaining: string;
  }>();
  const { bgUri } = useBgContext();

  const [solarTimes, setSolarTimes] = useState<SolarTimes | null>(null);
  const [period, setPeriod] = useState<DoshaPeriod | null>(null);
  const [expandedDosha, setExpandedDosha] = useState<string | null>(null);

  useEffect(() => {
    store.getJSON<{ lat: number; lon: number }>(KEYS.location)
      .then(loc => {
        if (loc?.lat && loc?.lon) {
          const s = getSolarTimes(loc.lat, loc.lon);
          setSolarTimes(s);
          const nowH = new Date().getHours() + new Date().getMinutes() / 60;
          const ps = getDoshaPeriods(s, nowH);
          const found = ps.find(p => p.id === params.periodId);
          if (found) setPeriod(found);
        }
      })
      .catch(() => {});

    // Fallback: build period from params if no location
    if (params.periodId) {
      const tmpl = PERIOD_TEMPLATES.find(t => t.id === params.periodId);
      if (tmpl) {
        const fakeP: DoshaPeriod = {
          ...tmpl,
          startH: 0, endH: 0,
          startLabel: params.periodStart ?? '—',
          endLabel: params.periodEnd ?? '—',
          status: 'active',
          minutesUntil: 0,
          minutesRemaining: parseInt(params.minutesRemaining ?? '0', 10),
        };
        setPeriod(p => p ?? fakeP);
      }
    }
  }, []);

  if (!period) {
    return (
      <View style={{ flex: 1, backgroundColor: '#020E1A', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: 'rgba(255,255,255,0.30)', fontSize: 14 }}>Loading period data…</Text>
      </View>
    );
  }

  const w = WELLNESS[period.id];
  const sk = PERIOD_SANSKRIT[period.id];
  const accent = SKY;
  const periodAccent = DOSHA_COLOR[period.dosha] ?? '#60a5fa';  // dosha identity only
  const doshaScience = DOSHA_FULL_SCIENCE[period.dosha] ?? [];
  const bgGrad = DOSHA_BG_GRAD[period.dosha] ?? ['#04182ACC', '#020E1ACC'];
  const rem = period.minutesRemaining;
  const remStr = rem >= 60 ? `${Math.floor(rem / 60)}h ${rem % 60}m` : `${rem}m`;

  const handleNaad = () => {
    router.push('/(tabs)/sleep' as never);
  };

  return (
    <ImageBackground
      source={bgUri ? { uri: bgUri } : undefined}  
      style={{ flex: 1, backgroundColor: '#020E1A' }}
      imageStyle={{ opacity: 0.18 }}>
      <LinearGradient
        colors={[bgGrad[0], bgGrad[1], 'rgba(2,10,24,0.97)']}
        start={{ x: 0, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      {/* Sky-blue glow from top */}
      <LinearGradient
        colors={[SKY + '28', SKY + '0C', 'transparent']}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.32 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      {/* Top accent line */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: SKY + '90', zIndex: 99 }} />

      {/* Sticky Naad bar at bottom */}
      <TouchableOpacity
        onPress={handleNaad}
        activeOpacity={0.86}
        style={[S.naadBar, { backgroundColor: accent }]}>
        <Text style={S.naadBarTxt}>🎵  Open Naad Sounds</Text>
        <Text style={S.naadBarSub}>Sounds recommended for {period.label}</Text>
      </TouchableOpacity>

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>

        {/* ── Header ── */}
        <View style={S.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={S.backBtn}>
            <Text style={S.backTxt}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={S.headerTitle}>Metabolic Period</Text>
            <Text style={[S.headerSub, { color: accent }]}>
              {period.startLabel} → {period.endLabel}
            </Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 130, paddingTop: 4 }}
          showsVerticalScrollIndicator={false}>

          {/* ═══════════════════════════════════════
              SECTION 1 — HERO CARD
          ═══════════════════════════════════════ */}
          <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
            <View style={[S.heroCard, { borderColor: accent + '40' }]}>
              <LinearGradient
                colors={[accent + '25', accent + '0A', 'transparent']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: accent + '90' }} />

              {/* Active badge */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 4 }}>
                <View style={[S.activeBadge, { borderColor: accent + '55', backgroundColor: accent + '14' }]}>
                  <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: accent, marginRight: 7 }} />
                  <Text style={[S.activeBadgeTxt, { color: accent }]}>ACTIVE NOW · {remStr}</Text>
                </View>
                <View style={[S.activeBadge, { borderColor: periodAccent + '50', backgroundColor: periodAccent + '12' }]}>
                  <Text style={[S.activeBadgeTxt, { color: periodAccent }]}>{period.dosha.toUpperCase()}</Text>
                </View>
              </View>

              {/* Emoji + names */}
              <Text style={{ fontSize: 52, textAlign: 'center', marginTop: 14 }}>{period.emoji}</Text>
              <Text style={{ fontSize: 24, fontWeight: '900', color: '#FFFFFFF0', textAlign: 'center', marginTop: 10, lineHeight: 30 }}>
                {period.englishLabel}
              </Text>
              <Text style={{ fontSize: 14, color: periodAccent, textAlign: 'center', marginTop: 4, fontWeight: '700', letterSpacing: 0.3 }}>
                {period.label}
              </Text>

              {/* Sanskrit */}
              {sk && (
                <View style={{ alignItems: 'center', marginTop: 14 }}>
                  <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.50)', fontStyle: 'italic' }}>
                    {sk.sanskrit}
                  </Text>
                  <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)', textAlign: 'center', marginTop: 3 }}>
                    "{sk.meaning}"
                  </Text>
                </View>
              )}

              {/* Elements row */}
              {w && (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16 }}>
                  <View style={[S.elementPill, { borderColor: accent + '40', backgroundColor: accent + '12' }]}>
                    <Text style={{ fontSize: 12 }}>{w.elements[0]?.emoji ?? '🌍'}</Text>
                    <Text style={[S.elementPillTxt, { color: accent }]}>{w.romanElements}</Text>
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* ═══════════════════════════════════════
              SECTION 2 — BODY CLOCK
          ═══════════════════════════════════════ */}
          <View style={{ paddingHorizontal: 16, marginBottom: 24 }}>
            <Text style={[S.sectionTitle, { color: accent }]}>24-Hour Body Clock</Text>
            <Text style={S.sectionSubtitle}>Where you are in the Ayurvedic day cycle</Text>
            <BodyClockFull periodId={period.id} dosha={period.dosha} solarTimes={solarTimes} />
          </View>

          {/* ═══════════════════════════════════════
              SECTION 3 — SUN POSITION
          ═══════════════════════════════════════ */}
          <View style={{ paddingHorizontal: 16, marginBottom: 24 }}>
            <Text style={[S.sectionTitle, { color: accent }]}>Sun Position</Text>
            <Text style={S.sectionSubtitle}>This period is defined by the sun's position in the sky</Text>
            <SunPositionSection period={period} solarTimes={solarTimes} />
            {w && (
              <View style={[S.infoBox, { borderColor: accent + '30', marginTop: 10 }]}>
                <Text style={S.infoTxt}>☀️  {w.sunDesc}</Text>
              </View>
            )}
          </View>

          {/* ═══════════════════════════════════════
              SECTION 4 — BODY SCIENCE
          ═══════════════════════════════════════ */}
          <View style={{ paddingHorizontal: 16, marginBottom: 24 }}>
            <Text style={[S.sectionTitle, { color: accent }]}>Your Body Right Now</Text>
            <Text style={S.sectionSubtitle}>What is happening inside at this exact moment</Text>

            {/* Science hero */}
            <View style={[S.sciCard, { borderColor: accent + '35', backgroundColor: accent + '0E' }]}>
              <Text style={{ fontSize: 38, marginBottom: 12 }}>{period.sciEmoji}</Text>
              <Text style={[S.sciTitle, { color: accent }]}>{period.sciTitle}</Text>
              <View style={{ height: 1, backgroundColor: accent + '40', marginVertical: 14 }} />
              <Text style={S.sciDesc}>{period.sciDesc}</Text>
            </View>

            {/* Body bullets */}
            {w && (
              <View style={{ marginTop: 14, gap: 10 }}>
                {w.bodyBullets.map((b, i) => (
                  <View key={i} style={S.bulletRow}>
                    <View style={[S.bulletDot, { backgroundColor: b.dot }]} />
                    <Text style={S.bulletTxt}>{b.text}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Modern science */}
            {w && (
              <View style={[S.infoBox, { borderColor: '#60a5fa30', backgroundColor: '#60a5fa08', marginTop: 14 }]}>
                <Text style={{ fontSize: 8, fontWeight: '900', color: '#60a5fa', letterSpacing: 1.5, marginBottom: 6 }}>⚗️  MODERN SCIENCE</Text>
                <Text style={[S.infoTxt, { color: 'rgba(255,255,255,0.70)' }]}>{w.modernBrief}</Text>
              </View>
            )}
          </View>

          {/* ═══════════════════════════════════════
              SECTION 5 — DO & AVOID
          ═══════════════════════════════════════ */}
          {w && (
            <View style={{ paddingHorizontal: 16, marginBottom: 24 }}>
              <Text style={[S.sectionTitle, { color: accent }]}>Optimal Actions</Text>
              <Text style={S.sectionSubtitle}>Ayurveda + modern science aligned recommendations</Text>

              {/* DO */}
              <View style={[S.doCard, { borderColor: '#34d39935', backgroundColor: '#34d3990A' }]}>
                <View style={S.doHeader}>
                  <Text style={S.doIcon}>✓</Text>
                  <Text style={S.doTitle}>DO THIS NOW</Text>
                </View>
                {w.doItems.map((item, i) => (
                  <View key={i} style={S.actionRow}>
                    <View style={[S.actionEmoji, { backgroundColor: '#34d39918' }]}>
                      <Text style={{ fontSize: 20 }}>{item.emoji}</Text>
                    </View>
                    <Text style={S.actionTxt}>{item.text}</Text>
                  </View>
                ))}
              </View>

              {/* AVOID */}
              <View style={[S.doCard, { borderColor: '#f43f5e35', backgroundColor: '#f43f5e0A', marginTop: 12 }]}>
                <View style={S.doHeader}>
                  <Text style={[S.doIcon, { color: '#f43f5e' }]}>⚠</Text>
                  <Text style={[S.doTitle, { color: '#f43f5e' }]}>AVOID NOW</Text>
                </View>
                {w.avoidItems.map((item, i) => (
                  <View key={i} style={S.actionRow}>
                    <View style={[S.actionEmoji, { backgroundColor: '#f43f5e18' }]}>
                      <Text style={{ fontSize: 20 }}>{item.emoji}</Text>
                    </View>
                    <Text style={S.actionTxt}>{item.text}</Text>
                  </View>
                ))}
              </View>

              {/* Kaala insight */}
              <View style={[S.boundaryBox, { borderLeftColor: accent + '70', marginTop: 14 }]}>
                <Text style={S.boundaryTxt}>
                  {w.boundaryNote}
                </Text>
              </View>
            </View>
          )}

          {/* ═══════════════════════════════════════
              SECTION 6 — AYURVEDIC DEEP SCIENCE
          ═══════════════════════════════════════ */}
          <View style={{ paddingHorizontal: 16, marginBottom: 24 }}>
            <Text style={[S.sectionTitle, { color: accent }]}>Ayurvedic Deep Science</Text>
            <Text style={S.sectionSubtitle}>Understanding {period.dosha.charAt(0).toUpperCase() + period.dosha.slice(1)} dosha fully</Text>

            {/* Ayurveda brief */}
            {w && (
              <View style={[S.infoBox, { borderColor: accent + '30', backgroundColor: accent + '08', marginBottom: 12 }]}>
                <Text style={[S.infoTxt, { color: 'rgba(255,255,255,0.78)', fontSize: 13, lineHeight: 21 }]}>
                  {w.ayurvedaBrief}
                </Text>
              </View>
            )}

            {/* Elements */}
            {w && (
              <View style={{ marginBottom: 14, gap: 10 }}>
                <Text style={[S.subLabel, { color: accent }]}>ACTIVE ELEMENTS (PANCHAMAHABHUTA)</Text>
                {w.elements.map((el, i) => (
                  <View key={i} style={[S.elementCard, { borderColor: accent + '28', backgroundColor: accent + '08' }]}>
                    <Text style={{ fontSize: 26, marginRight: 14 }}>{el.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '900', color: accent, marginBottom: 4 }}>{el.name}</Text>
                      <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.60)', lineHeight: 18 }}>
                        {el.desc}{el.italic ? <Text style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.80)' }}> {el.italic}</Text> : null}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Dosha science accordion */}
            {doshaScience.map((item, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setExpandedDosha(expandedDosha === String(i) ? null : String(i));
                }}
                activeOpacity={0.82}
                style={[S.accordionItem, {
                  borderColor: accent + (expandedDosha === String(i) ? '50' : '20'),
                  backgroundColor: expandedDosha === String(i) ? accent + '0E' : 'rgba(255,255,255,0.03)',
                }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 13, fontWeight: '900', color: expandedDosha === String(i) ? accent : '#FFFFFFCC', flex: 1 }}>
                    {item.title}
                  </Text>
                  <Text style={{ color: accent + 'AA', fontSize: 16, fontWeight: '300' }}>
                    {expandedDosha === String(i) ? '⌃' : '⌄'}
                  </Text>
                </View>
                {expandedDosha === String(i) && (
                  <Text style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.65)', lineHeight: 20, marginTop: 12, fontWeight: '500' }}>
                    {item.body}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* ═══════════════════════════════════════
              SECTION 7 — ALL 6 PERIODS
          ═══════════════════════════════════════ */}
          <View style={{ paddingHorizontal: 16, marginBottom: 24 }}>
            <Text style={[S.sectionTitle, { color: accent }]}>All 6 Periods Today</Text>
            <Text style={S.sectionSubtitle}>Your complete 24-hour Ayurvedic rhythm based on today's solar times</Text>
            <AllPeriodsOverview currentId={period.id} solarTimes={solarTimes} />
          </View>

        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backTxt: {
    color: 'rgba(255,255,255,0.80)',
    fontSize: 18,
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFFF0',
    letterSpacing: 0.3,
  },
  headerSub: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 0.3,
  },
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 28,
    elevation: 16,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  activeBadgeTxt: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  elementPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  elementPillTxt: {
    fontSize: 13,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.38)',
    marginBottom: 16,
    fontWeight: '600',
    lineHeight: 16,
  },
  section: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  sectionLabel: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.8,
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  statCell: {
    flex: 1,
    minWidth: (W - 80) / 2 - 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 3,
  },
  statLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.38)',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  arcLabel: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.28)',
    fontWeight: '700',
  },
  sciCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
  },
  sciTitle: {
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 23,
  },
  sciDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 21,
    textAlign: 'center',
    fontWeight: '500',
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  bulletDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    flexShrink: 0,
  },
  bulletTxt: {
    flex: 1,
    fontSize: 13,
    color: 'rgba(255,255,255,0.72)',
    lineHeight: 20,
    fontWeight: '500',
  },
  infoBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  infoTxt: {
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.60)',
    lineHeight: 19,
    fontWeight: '500',
  },
  doCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  doHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  doIcon: {
    fontSize: 18,
    fontWeight: '900',
    color: '#34d399',
  },
  doTitle: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.6,
    color: '#34d399',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  actionEmoji: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  actionTxt: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.80)',
    fontWeight: '600',
    flex: 1,
    lineHeight: 19,
  },
  boundaryBox: {
    borderLeftWidth: 3,
    paddingLeft: 14,
    paddingVertical: 4,
  },
  boundaryTxt: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.48)',
    lineHeight: 18,
    fontStyle: 'italic',
    fontWeight: '500',
  },
  subLabel: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.8,
    marginBottom: 10,
  },
  elementCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  accordionItem: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 8,
  },
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  activePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  activePillTxt: {
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 1,
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  naadBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 30,
    paddingTop: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.40,
    shadowRadius: 20,
    elevation: 20,
  },
  naadBarTxt: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  naadBarSub: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 2,
    fontWeight: '600',
  },
});
