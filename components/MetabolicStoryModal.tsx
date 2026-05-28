/**
 * MetabolicStoryModal v2 — Wellness Dashboard
 * 7-card full-screen stories · Sanskrit + English + Medical Science
 * Cards: Dashboard → Identity → Sun/Circadian → Elements → Body Systems → Protocol → Nāda
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, Modal, TouchableOpacity,
  StyleSheet, Dimensions, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Svg, { Circle as SvgCircle, Path as SvgPath, Text as SvgText } from 'react-native-svg';
import type { DoshaPeriod } from '@/lib/ayurvedicPeriods';
import type { SolarTimes } from '@/lib/solar';
import { WELLNESS, PERIOD_SANSKRIT, PERIOD_EXTENDED } from '@/lib/wellnessData';

const { width: W } = Dimensions.get('window');

// ── Design tokens ──────────────────────────────────────────────────────────────
const DOSHA_COLOR: Record<string, string> = {
  kapha: '#34d399',
  pitta: '#fb923c',
  vata:  '#a78bfa',
};
const DOSHA_BG: Record<string, string[]> = {
  kapha: ['#1C3D28', '#102018'],
  pitta: ['#3E2008', '#22100A'],
  vata:  ['#221840', '#14102C'],
};

const NIGHT_PERIODS = new Set(['evening_kapha', 'night_pitta', 'night_vata']);
// Balancing element per dosha (Āyurvedic opposition therapy)
const DOSHA_BALANCE: Record<string, string> = {
  kapha: '#f43f5e',  // 🔥 Agni (fire) energises heavy Kapha
  pitta: '#60a5fa',  // 💧 Jala (water) cools burning Pitta
  vata:  '#f97316',  // 🌍 Prithvī (earth) grounds cold Vāta
};
const DOSHA_BALANCE_LABEL: Record<string, string> = {
  kapha: '🔥 Agni  ·  Energise',
  pitta: '💧 Jala  ·  Cool',
  vata:  '🌍 Prithvī  ·  Ground',
};

// ── System color map ───────────────────────────────────────────────────────────
const SYS_COLOR: Record<string, string> = {
  'Anabolic': '#34d399', 'Immune': '#34d399', 'Lymphatic': '#60a5fa',
  'Musculoskeletal': '#a78bfa', 'Metabolic': '#fb923c', 'Digestive': '#fb923c',
  'Cognitive': '#fbbf24', 'Hepatic': '#f59e0b', 'Nervous': '#a78bfa',
  'Respiratory': '#60a5fa', 'Motor': '#34d399', 'Eliminative': '#818cf8',
  'Parasympathetic': '#a78bfa', 'Endocrine': '#fbbf24', 'Fluid': '#60a5fa',
  'Sleep Prep': '#818cf8', 'Repair': '#34d399', 'Glymphatic': '#60a5fa',
  'Neurological': '#a78bfa',
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmt12H(dec: number): string {
  const total = Math.round(dec * 60) % (24 * 60);
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  const ap = hh < 12 ? 'AM' : 'PM';
  const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  return `${String(h12).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${ap}`;
}

// ── Full 24-Hour Solar Orbit ───────────────────────────────────────────────────
// Complete 360° orbit: noon=top, midnight=bottom, sunrise≈right, sunset≈left
function SunPositionArc({ period, solarTimes }: { period: DoshaPeriod; solarTimes: SolarTimes | null }) {
  const AW = W - 52;
  const AH = 168;
  const CX = AW / 2;
  const CY = AH / 2;
  const RX = AW * 0.43;
  const RY = AH * 0.41;

  const now = new Date();
  const nowH = now.getHours() + now.getMinutes() / 60;
  const sr = solarTimes?.sunrise ?? 6;
  const ss = solarTimes?.sunset ?? 18;
  const isDaytime = nowH >= sr && nowH <= ss;

  // Hour → ellipse angle: 6am=right(0), noon=top(π/2 in math), 6pm=left(π), midnight=bottom(-π/2)
  const hToAngle = (h: number) => ((h - 6) / 24) * 2 * Math.PI;
  const eXY = (h: number): [number, number] => {
    const a = hToAngle(h);
    return [CX + RX * Math.cos(a), CY - RY * Math.sin(a)];
  };

  const [srX, srY] = eXY(sr);
  const [ssX, ssY] = eXY(ss);
  const [sunX, sunY] = eXY(nowH);

  const dayHours = ss - sr;
  const dayLargeArc = dayHours > 12 ? 1 : 0;
  const nightLargeArc = (24 - dayHours) > 12 ? 1 : 0;

  // Day arc: sr → ss, sweep=0 (CCW in SVG y-down = arc goes UP through noon at top) ✓
  const dayPath = `M ${srX} ${srY} A ${RX} ${RY} 0 ${dayLargeArc} 0 ${ssX} ${ssY}`;
  // Night arc: ss → sr, sweep=1 (CW in SVG y-down = arc goes DOWN through midnight at bottom) ✓
  const nightPath = `M ${ssX} ${ssY} A ${RX} ${RY} 0 ${nightLargeArc} 1 ${srX} ${srY}`;

  return (
    <View style={{ alignItems: 'center', marginTop: 8, marginBottom: 2 }}>
      <Svg width={AW} height={AH} viewBox={`0 0 ${AW} ${AH}`}>
        {/* Horizon line */}
        <SvgPath
          d={`M ${CX - RX - 10} ${CY} L ${CX + RX + 10} ${CY}`}
          stroke="rgba(255,255,255,0.10)" strokeWidth={1} strokeDasharray="3 6"
        />
        {/* DAY label */}
        <SvgPath d={`M ${CX - 14} ${CY - 8} L ${CX + 14} ${CY - 8}`}
          stroke="transparent" fill="none" />

        {/* Full orbit track */}
        <SvgPath
          d={`M ${CX + RX} ${CY} A ${RX} ${RY} 0 0 1 ${CX - RX} ${CY} A ${RX} ${RY} 0 0 1 ${CX + RX} ${CY}`}
          fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={2}
        />

        {/* Night arc — dim violet dashed */}
        <SvgPath d={nightPath} fill="none" stroke="#818cf860" strokeWidth={2.5}
          strokeLinecap="round" strokeDasharray="5 5" />

        {/* Day arc — bright gold */}
        <SvgPath d={dayPath} fill="none" stroke="#fbbf24CC" strokeWidth={3.5} strokeLinecap="round" />

        {/* Sunrise dot */}
        <SvgCircle cx={srX} cy={srY} r={3.5} fill="#fbbf24" opacity={0.80} />
        {/* Sunset dot */}
        <SvgCircle cx={ssX} cy={ssY} r={3.5} fill="#f97316" opacity={0.80} />
        {/* Solar noon marker (top) */}
        <SvgCircle cx={CX} cy={CY - RY} r={2.5} fill="#fbbf2480" />
        {/* Midnight marker (bottom) */}
        <SvgCircle cx={CX} cy={CY + RY} r={2.5} fill="#818cf850" />

        {/* Sun glow + position dot */}
        <SvgCircle cx={sunX} cy={sunY} r={18} fill={isDaytime ? '#fbbf24' : '#818cf8'} opacity={0.14} />
        <SvgCircle cx={sunX} cy={sunY} r={9.5} fill={isDaytime ? '#fbbf24' : '#c4b5fd'} opacity={0.97} />
      </Svg>

      {/* Labels row */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: AW, marginTop: -8, paddingHorizontal: 2 }}>
        <Text style={{ fontSize: 7.5, color: 'rgba(255,255,255,0.32)', fontWeight: '700' }}>
          ☀️ {solarTimes ? fmt12H(sr) : 'Sunrise'}
        </Text>
        <View style={{ alignItems: 'center', gap: 1 }}>
          <Text style={{ fontSize: 7, color: 'rgba(255,255,255,0.22)', fontWeight: '700' }}>☀ Noon  ↑  ↓  🌙 Mid</Text>
        </View>
        <Text style={{ fontSize: 7.5, color: 'rgba(255,255,255,0.32)', fontWeight: '700' }}>
          🌅 {solarTimes ? fmt12H(ss) : 'Sunset'}
        </Text>
      </View>
    </View>
  );
}

// ── 24-Hr Body Clock SVG ──────────────────────────────────────────────────────
function BodyClockSVG({ period, solarTimes }: { period: DoshaPeriod; solarTimes: SolarTimes | null }) {
  const SIZE = 200;
  const C = SIZE / 2;
  const OUTER_R = 88;
  const ARC_W = 18;

  const sr = solarTimes?.sunrise ?? 6;
  const ss = solarTimes?.sunset ?? 18;
  const dayLen = ss - sr;
  const nightLen = 24 - dayLen;
  const daySeg = dayLen / 3;
  const nightSeg = nightLen / 3;
  const bmStart = sr + 24 - 1.6;

  const PERIODS = [
    { id: 'night_vata',     start: bmStart,              end: sr + 24,              color: '#818cf8' },
    { id: 'morning_kapha',  start: sr,                   end: sr + daySeg,          color: '#34d399' },
    { id: 'midday_pitta',   start: sr + daySeg,          end: sr + 2 * daySeg,      color: '#fb923c' },
    { id: 'afternoon_vata', start: sr + 2 * daySeg,      end: ss,                   color: '#a78bfa' },
    { id: 'evening_kapha',  start: ss,                   end: ss + nightSeg,        color: '#34d399' },
    { id: 'night_pitta',    start: ss + nightSeg,        end: bmStart,              color: '#fbbf24' },
  ];

  // Convert hour (0-24) to SVG angle: midnight=top (−90°), noon=bottom (+90°)
  const hourToAngle = (h: number) => ((h % 24) / 24) * 360 - 90;

  const arcPath = (startH: number, endH: number, r: number, strokeW: number) => {
    const startNorm = startH % 24;
    const endNorm = endH % 24;
    const startA = (hourToAngle(startNorm) * Math.PI) / 180;
    const endA = (hourToAngle(endNorm === 0 ? 24 : endNorm) * Math.PI) / 180;
    const durationH = ((endH - startH) + 24) % 24;
    const largeArc = durationH > 12 ? 1 : 0;
    const sx = C + r * Math.cos(startA);
    const sy = C + r * Math.sin(startA);
    const ex = C + r * Math.cos(endA);
    const ey = C + r * Math.sin(endA);
    return `M ${sx} ${sy} A ${r} ${r} 0 ${largeArc} 1 ${ex} ${ey}`;
  };

  const now = new Date();
  const nowH = now.getHours() + now.getMinutes() / 60;
  const nowA = (hourToAngle(nowH) * Math.PI) / 180;
  const nowX = C + OUTER_R * Math.cos(nowA);
  const nowY = C + OUTER_R * Math.sin(nowA);

  return (
    <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
      {/* Track ring */}
      <SvgCircle cx={C} cy={C} r={OUTER_R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={ARC_W + 2} />

      {/* Period arcs */}
      {PERIODS.map(p => {
        const isActive = p.id === period.id;
        return (
          <SvgPath
            key={p.id}
            d={arcPath(p.start, p.end, OUTER_R, ARC_W)}
            fill="none"
            stroke={p.color}
            strokeWidth={isActive ? ARC_W + 4 : ARC_W - 2}
            strokeLinecap="round"
            opacity={isActive ? 1 : 0.28}
          />
        );
      })}

      {/* NOW dot */}
      <SvgCircle cx={nowX} cy={nowY} r={9} fill="#FFFFFF" opacity={0.95} />
      <SvgCircle cx={nowX} cy={nowY} r={14} fill={period.color} opacity={0.25} />

      {/* Day / Night center zone */}
      <SvgPath d={`M ${C - (OUTER_R - ARC_W - 10)} ${C} A ${OUTER_R - ARC_W - 10} ${OUTER_R - ARC_W - 10} 0 0 1 ${C + (OUTER_R - ARC_W - 10)} ${C} Z`}
        fill="rgba(0,0,0,0.22)" />
      <SvgPath d={`M ${C - (OUTER_R - ARC_W - 10)} ${C} A ${OUTER_R - ARC_W - 10} ${OUTER_R - ARC_W - 10} 0 0 1 ${C + (OUTER_R - ARC_W - 10)} ${C} Z`}
        fill="rgba(251,191,36,0.09)" />
      <SvgPath d={`M ${C - (OUTER_R - ARC_W - 10)} ${C} A ${OUTER_R - ARC_W - 10} ${OUTER_R - ARC_W - 10} 0 0 0 ${C + (OUTER_R - ARC_W - 10)} ${C} Z`}
        fill="rgba(0,0,0,0.30)" />
      <SvgPath d={`M ${C - (OUTER_R - ARC_W - 10)} ${C} A ${OUTER_R - ARC_W - 10} ${OUTER_R - ARC_W - 10} 0 0 0 ${C + (OUTER_R - ARC_W - 10)} ${C} Z`}
        fill="rgba(129,140,248,0.10)" />
      <SvgPath d={`M ${C - (OUTER_R - ARC_W - 10)} ${C} L ${C + (OUTER_R - ARC_W - 10)} ${C}`}
        stroke="rgba(255,255,255,0.07)" strokeWidth={0.5} />
      <SvgText x={C} y={C - 44} textAnchor="middle" fontSize={6}
        fill="rgba(129,140,248,0.60)" fontWeight="bold">NIGHT</SvgText>
      <SvgText x={C} y={C + 53} textAnchor="middle" fontSize={6}
        fill="rgba(251,191,36,0.60)" fontWeight="bold">DAY</SvgText>
    </Svg>
  );
}

// ── Full 24h Circadian Clock (Card 3) ─────────────────────────────────────────
function CircadianClockLarge({ period, solarTimes, accent }: {
  period: DoshaPeriod; solarTimes: SolarTimes | null; accent: string;
}) {
  const SIZE = W - 64;
  const C = SIZE / 2;
  const R = SIZE * 0.37;
  const ARC_W = SIZE * 0.085;

  const sr = solarTimes?.sunrise ?? 6;
  const ss = solarTimes?.sunset ?? 18;
  const dayLen = ss - sr;
  const nightLen = 24 - dayLen;
  const daySeg = dayLen / 3;
  const nightSeg = nightLen / 3;
  const bmStart = sr + 24 - 1.6;

  const PCLOCK = [
    { id: 'night_vata',     start: bmStart,        end: sr + 24,        color: '#818cf8' },
    { id: 'morning_kapha',  start: sr,             end: sr + daySeg,    color: '#34d399' },
    { id: 'midday_pitta',   start: sr + daySeg,    end: sr + 2 * daySeg, color: '#fb923c' },
    { id: 'afternoon_vata', start: sr + 2 * daySeg, end: ss,            color: '#a78bfa' },
    { id: 'evening_kapha',  start: ss,             end: ss + nightSeg,  color: '#34d399' },
    { id: 'night_pitta',    start: ss + nightSeg,  end: bmStart,        color: '#fbbf24' },
  ];

  const hourToAngle = (h: number) => ((h % 24) / 24) * 360 - 90;
  const arcPath = (startH: number, endH: number, r: number) => {
    const sn = startH % 24;
    const en = endH % 24;
    const sa = (hourToAngle(sn) * Math.PI) / 180;
    const ea = (hourToAngle(en === 0 ? 24 : en) * Math.PI) / 180;
    const dur = ((endH - startH) + 24) % 24;
    const la = dur > 12 ? 1 : 0;
    const sx = C + r * Math.cos(sa);
    const sy = C + r * Math.sin(sa);
    const ex = C + r * Math.cos(ea);
    const ey = C + r * Math.sin(ea);
    return `M ${sx} ${sy} A ${r} ${r} 0 ${la} 1 ${ex} ${ey}`;
  };

  const now = new Date();
  const nowH = now.getHours() + now.getMinutes() / 60;
  const nowA = (hourToAngle(nowH) * Math.PI) / 180;
  const nowX = C + R * Math.cos(nowA);
  const nowY = C + R * Math.sin(nowA);
  const INNER_R = R - ARC_W / 2 - 4;

  const OR = R + ARC_W / 2 + 10;
  const srA = (hourToAngle(sr) * Math.PI) / 180;
  const ssA = (hourToAngle(ss) * Math.PI) / 180;
  const sunSX = C + OR * Math.cos(srA);
  const sunSY = C + OR * Math.sin(srA);
  const sunEX = C + OR * Math.cos(ssA);
  const sunEY = C + OR * Math.sin(ssA);
  const sunLA = (ss - sr) > 12 ? 1 : 0;

  return (
    <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
      <SvgCircle cx={C} cy={C} r={OR} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={3} />
      <SvgPath
        d={`M ${sunSX} ${sunSY} A ${OR} ${OR} 0 ${sunLA} 1 ${sunEX} ${sunEY}`}
        fill="none" stroke="#fbbf2445" strokeWidth={3} strokeLinecap="round"
      />
      <SvgCircle cx={C} cy={C} r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={ARC_W + 2} />
      {PCLOCK.map(p => {
        const isActive = p.id === period.id;
        return (
          <SvgPath
            key={p.id}
            d={arcPath(p.start, p.end, R)}
            fill="none"
            stroke={p.color}
            strokeWidth={isActive ? ARC_W + 7 : ARC_W - 4}
            strokeLinecap="round"
            opacity={isActive ? 1 : 0.20}
          />
        );
      })}
      <SvgCircle cx={nowX} cy={nowY} r={15} fill={accent} opacity={0.20} />
      <SvgCircle cx={nowX} cy={nowY} r={8}  fill="#FFFFFF" opacity={0.96} />
      {/* Day / Night center zone — midnight=top, noon=bottom */}
      <SvgPath d={`M ${C - INNER_R} ${C} A ${INNER_R} ${INNER_R} 0 0 1 ${C + INNER_R} ${C} Z`}
        fill="rgba(0,0,0,0.38)" />
      <SvgPath d={`M ${C - INNER_R} ${C} A ${INNER_R} ${INNER_R} 0 0 1 ${C + INNER_R} ${C} Z`}
        fill="rgba(251,191,36,0.09)" />
      <SvgPath d={`M ${C - INNER_R} ${C} A ${INNER_R} ${INNER_R} 0 0 0 ${C + INNER_R} ${C} Z`}
        fill="rgba(0,0,0,0.50)" />
      <SvgPath d={`M ${C - INNER_R} ${C} A ${INNER_R} ${INNER_R} 0 0 0 ${C + INNER_R} ${C} Z`}
        fill="rgba(129,140,248,0.13)" />
      <SvgPath d={`M ${C - INNER_R} ${C} L ${C + INNER_R} ${C}`}
        stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
      <SvgText x={C} y={C - INNER_R * 0.38} textAnchor="middle" fontSize={14}
        fill="rgba(129,140,248,0.65)" fontWeight="bold">NIGHT</SvgText>
      <SvgText x={C} y={C + INNER_R * 0.50} textAnchor="middle" fontSize={14}
        fill="rgba(251,191,36,0.65)" fontWeight="bold">DAY</SvgText>
    </Svg>
  );
}

// ── Card 1: PHASE DASHBOARD ────────────────────────────────────────────────────
function Card1Dashboard({ period, solarTimes, accent }: { period: DoshaPeriod; solarTimes: SolarTimes | null; accent: string }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.08, duration: 1600, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1,    duration: 1600, useNativeDriver: true }),
    ])).start();
  }, []);

  const rem = period.minutesRemaining;
  const remStr = rem >= 60 ? `${Math.floor(rem / 60)}h ${rem % 60}m` : `${rem}m`;
  const durM = Math.max(1, Math.round(((period.endH - period.startH + 24) % 24) * 60));
  const prog = Math.min(1, Math.max(0, (durM - rem) / durM));
  const durStr = durM >= 60 ? `${Math.floor(durM / 60)}h ${durM % 60}m` : `${durM}m`;

  return (
    <View style={[styles.cardContent, { flex: 1, paddingBottom: 14 }]}>
      {/* ACTIVE + BALANCE + DAY/NIGHT badges */}
      {(() => {
        const isNight = NIGHT_PERIODS.has(period.id);
        const dnColor = isNight ? '#818cf8' : '#fbbf24';
        return (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginBottom: 6, flexWrap: 'wrap' }}>
            <View style={[styles.activeBadge, { borderColor: accent + '60', backgroundColor: accent + '14', marginBottom: 0 }]}>
              <Animated.View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: accent, transform: [{ scale: pulse }], marginRight: 6 }} />
              <Text style={[styles.activeBadgeTxt, { color: accent }]}>ACTIVE NOW</Text>
            </View>
            <View style={{ width: 1, height: 14, backgroundColor: 'rgba(255,255,255,0.12)' }} />
            <View style={[styles.activeBadge, { borderColor: dnColor + '55', backgroundColor: dnColor + '12', marginBottom: 0 }]}>
              <Text style={[styles.activeBadgeTxt, { color: dnColor }]}>{isNight ? '🌙 NIGHT' : '☀️ DAY'}</Text>
            </View>
            <View style={{ width: 1, height: 14, backgroundColor: 'rgba(255,255,255,0.12)' }} />
            <View style={[styles.activeBadge, {
              borderColor: (DOSHA_BALANCE[period.dosha] ?? '#60a5fa') + '55',
              backgroundColor: (DOSHA_BALANCE[period.dosha] ?? '#60a5fa') + '12',
              marginBottom: 0,
            }]}>
              <Text style={[styles.activeBadgeTxt, { color: DOSHA_BALANCE[period.dosha] ?? '#60a5fa' }]}>
                {DOSHA_BALANCE_LABEL[period.dosha] ?? 'BALANCE'}
              </Text>
            </View>
          </View>
        );
      })()}

      {/* Body clock — scaled down to fit more content on screen */}
      <View style={{ alignItems: 'center', marginTop: 4 }}>
        <View style={{ transform: [{ scale: 0.82 }], marginVertical: -18 }}>
          <View style={{ position: 'relative' }}>
            <BodyClockSVG period={period} solarTimes={solarTimes} />
            <View style={{ position: 'absolute', top: 0, left: 0, width: 200, height: 200, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 30, lineHeight: 36 }}>{period.emoji}</Text>
              <Text style={{ fontSize: 11, fontWeight: '900', color: '#FFFFFFEE', textAlign: 'center', lineHeight: 15, marginTop: 4 }}>{period.englishLabel}</Text>
              <Text style={{ fontSize: 22, fontWeight: '900', color: accent, letterSpacing: -0.5, marginTop: 2 }}>{remStr}</Text>
              <Text style={{ fontSize: 8, color: 'rgba(255,255,255,0.38)', fontWeight: '700', letterSpacing: 0.8 }}>remaining</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Metric row */}
      <View style={styles.metricRow}>
        {[
          { label: 'DURATION', value: durStr },
          { label: 'REMAINING', value: remStr },
          { label: 'ELAPSED', value: `${Math.round(prog * 100)}%` },
        ].map((m, i) => (
          <View key={i} style={[styles.metricCell, i === 1 && { borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }]}>
            <Text style={[styles.metricVal, { color: i === 2 ? accent : '#FFFFFF' }]}>{m.value}</Text>
            <Text style={styles.metricLabel}>{m.label}</Text>
          </View>
        ))}
      </View>

      {/* Time window */}
      <View style={styles.timeRow}>
        <View style={[styles.timePill, { borderColor: accent + '40', backgroundColor: accent + '10' }]}>
          <Text style={[styles.timeTxt, { color: accent }]}>{period.startLabel}  →  {period.endLabel}</Text>
        </View>
      </View>

      {/* Phase progress bar */}
      <View style={{ marginTop: 14, marginHorizontal: 4 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
          <Text style={{ fontSize: 8, color: 'rgba(255,255,255,0.30)', fontWeight: '700', letterSpacing: 1 }}>PHASE PROGRESS</Text>
          <Text style={{ fontSize: 8, color: accent + 'CC', fontWeight: '800' }}>{Math.round(prog * 100)}% elapsed</Text>
        </View>
        <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.07)' }}>
          <View style={{ width: `${Math.round(prog * 100)}%` as any, height: 4, borderRadius: 2, backgroundColor: accent }} />
        </View>
      </View>

      <Text style={styles.swipeHint}>Swipe right to explore →</Text>
    </View>
  );
}

// ── Card 2: SANSKRIT IDENTITY & ETYMOLOGY ─────────────────────────────────────
function Card2Identity({ period, accent }: { period: DoshaPeriod; accent: string }) {
  const s = PERIOD_SANSKRIT[period.id];
  const x = PERIOD_EXTENDED[period.id];
  if (!s || !x) return null;

  const isNight = NIGHT_PERIODS.has(period.id);
  const timeTagColor = isNight ? '#818cf8' : '#fbbf24';
  const timeTagLabel = isNight ? '🌙  NIGHT PERIOD' : '☀️  DAY PERIOD';

  return (
    <View style={{ flex: 1, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', paddingBottom: 14 }}>
      {/* Badges row */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
        <View style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: accent + '20', borderWidth: 1, borderColor: accent + '40' }}>
          <Text style={{ fontSize: 9, color: accent, fontWeight: '900', letterSpacing: 1.5 }}>{period.dosha.toUpperCase()}</Text>
        </View>
        <View style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: timeTagColor + '18', borderWidth: 1, borderColor: timeTagColor + '40' }}>
          <Text style={{ fontSize: 9, color: timeTagColor, fontWeight: '900', letterSpacing: 1.2 }}>{timeTagLabel}</Text>
        </View>
        <View style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
          <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', fontWeight: '700', letterSpacing: 1 }}>PHASE {x.phaseNumber} OF 6</Text>
        </View>
      </View>

      {/* English name — PRIMARY (what Western users read first) */}
      <Text style={{ fontSize: 30, fontWeight: '900', color: '#FFFFFFF0', textAlign: 'center', letterSpacing: -0.5, lineHeight: 36, marginBottom: 8 }}>
        {period.englishLabel}
      </Text>

      {/* Sanskrit name — secondary context */}
      <Text style={{ fontSize: 18, fontWeight: '700', color: accent, textAlign: 'center', letterSpacing: 0.3, lineHeight: 25, marginBottom: 4 }}>
        {s.sanskrit}
      </Text>

      {/* Phonetic pronunciation */}
      <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: 3, marginBottom: 12, fontWeight: '400' }}>
        {x.phonetic}
      </Text>

      {/* Time window pill */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 7, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.11)', marginBottom: 18, flexDirection: 'row', alignItems: 'center', gap: 7 }}>
        <Text style={{ fontSize: 12, color: timeTagColor }}>{isNight ? '🌙' : '☀️'}</Text>
        <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.62)', fontWeight: '700', letterSpacing: 0.3 }}>
          {period.startLabel}  →  {period.endLabel}
        </Text>
      </View>

      <View style={{ width: 44, height: 1.5, borderRadius: 1, backgroundColor: accent + '55', marginBottom: 16 }} />

      <Text style={{ fontSize: 17, color: 'rgba(255,255,255,0.78)', textAlign: 'center', fontStyle: 'italic', lineHeight: 26, fontWeight: '300' }}>
        "{s.meaning}"
      </Text>

      <View style={{ marginTop: 20, width: 54, height: 54, borderRadius: 27, backgroundColor: accent + '18', borderWidth: 1.5, borderColor: accent + '35', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 26 }}>{period.emoji}</Text>
      </View>
    </View>
  );
}

// ── Card 3: SUN & CIRCADIAN SCIENCE ───────────────────────────────────────────
function Card3EtymSun({ period, accent }: { period: DoshaPeriod; accent: string }) {
  const x = PERIOD_EXTENDED[period.id];
  if (!x) return null;

  return (
    <View style={[styles.cardContent, { flex: 1, paddingBottom: 14 }]}>
      <Text style={styles.cardLabel}>ETYMOLOGY & ORIGIN</Text>

      {x.etymParts.map((e, i) => (
        <View key={i} style={[styles.etymRow, { marginBottom: 8 }]}>
          <Text style={[styles.etymTerm, { color: accent }]}>{e.term}</Text>
          <Text style={styles.etymBreakdown}>{e.breakdown}</Text>
        </View>
      ))}

      <View style={{ borderRadius: 14, borderWidth: 1, borderColor: '#fbbf2430', backgroundColor: '#fbbf2408', padding: 14, marginTop: 10 }}>
        <Text style={{ fontSize: 9, color: '#fbbf24', fontWeight: '900', letterSpacing: 1.2, marginBottom: 6 }}>☀️  SUN CONNECTION</Text>
        <Text style={styles.sunBoxTxt}>{x.sunPosition}</Text>
        <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 8 }} />
        <Text style={styles.sunBoxSub}>Āyurveda correlated the Sun’s position with human physiology 5,000 years before chronobiology confirmed it. This is Kāla-vidyā — the science of sacred time.</Text>
      </View>

      <View style={[styles.classicalBox, { borderLeftColor: accent + '55', marginTop: 14 }]}>
        <Text style={styles.classicalText}>"{x.classicalRef.text}"</Text>
        <Text style={[styles.classicalSource, { color: accent }]}>— {x.classicalRef.source}</Text>
      </View>
    </View>
  );
}

function Card3Solar({ period, solarTimes, accent }: { period: DoshaPeriod; solarTimes: SolarTimes | null; accent: string }) {
  const x = PERIOD_EXTENDED[period.id];
  const CLOCK_LEGEND = [
    { id: 'night_vata',     color: '#818cf8', label: 'Pre-Dawn Vāta' },
    { id: 'morning_kapha',  color: '#34d399', label: 'Morning Kapha' },
    { id: 'midday_pitta',   color: '#fb923c', label: 'Midday Pitta'  },
    { id: 'afternoon_vata', color: '#a78bfa', label: 'Afternoon Vāta'},
    { id: 'evening_kapha',  color: '#34d399', label: 'Evening Kapha' },
    { id: 'night_pitta',    color: '#fbbf24', label: 'Night Pitta'   },
  ];

  return (
    <View style={[styles.cardContent, { flex: 1, paddingBottom: 14 }]}>
      <Text style={styles.cardLabel}>THE SUN DRIVES YOUR DOSHAS</Text>
      <Text style={styles.introTxt}>The Sun governs every hormone & organ clock — Ayurveda mapped this 5,000 years ago.</Text>

      <View style={{ alignItems: 'center', marginVertical: 4 }}>
        <View style={{ transform: [{ scale: 0.72 }], marginVertical: -46 }}>
          <CircadianClockLarge period={period} solarTimes={solarTimes} accent={accent} />
        </View>
        {(() => {
          const isNight = NIGHT_PERIODS.has(period.id);
          const dnLabel = isNight ? '🌙 NIGHT' : '☀️ DAY';
          return (
            <View style={[styles.nowBadge, { backgroundColor: accent + '18', borderColor: accent + '40' }]}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF', marginRight: 5 }} />
              <Text style={{ fontSize: 9, color: '#FFFFFF', fontWeight: '800', letterSpacing: 1 }}>
                YOU ARE HERE · {dnLabel} · {period.englishLabel.toUpperCase()}
              </Text>
            </View>
          );
        })()}
      </View>

      <View style={styles.legendGrid}>
        {CLOCK_LEGEND.map((l, i) => (
          <View key={i} style={[
            styles.legendItem,
            l.id === period.id && { backgroundColor: l.color + '18', borderColor: l.color + '40' },
          ]}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: l.color, marginRight: 6 }} />
            <Text style={{ fontSize: 9, color: l.id === period.id ? l.color : 'rgba(255,255,255,0.45)', fontWeight: l.id === period.id ? '800' : '600' }}>
              {l.label}
            </Text>
          </View>
        ))}
      </View>


    </View>
  );
}

// ── Card 4: ELEMENTAL PHYSIOLOGY ──────────────────────────────────────────────
function Card5CircSci({ period, accent }: { period: DoshaPeriod; accent: string }) {
  const x = PERIOD_EXTENDED[period.id];

  return (
    <View style={[styles.cardContent, { flex: 1, paddingBottom: 14 }]}>
      <Text style={styles.cardLabel}>CIRCADIAN SCIENCE</Text>

      <View style={[styles.sciBox, { borderColor: accent + '28', backgroundColor: accent + '08', marginBottom: 14 }]}>
        <Text style={{ fontSize: 9, color: accent, fontWeight: '900', letterSpacing: 1.2, marginBottom: 8 }}>☀️  SOLAR POSITION NOW</Text>
        <Text style={styles.sciBoxTxt}>{x?.sunPosition ?? ''}</Text>
      </View>

      <Text style={[styles.subLabel, { color: accent }]}>MODERN CHRONOBIOLOGY</Text>
      <Text style={styles.briefTxt}>{x?.circadianSci ?? ''}</Text>
    </View>
  );
}

function Card4Elements({ period, accent }: { period: DoshaPeriod; accent: string }) {
  const w = WELLNESS[period.id];
  const x = PERIOD_EXTENDED[period.id];
  if (!w || !x) return null;

  const ELEMENT_CHIPS: Record<string, string[]> = {
    'Air (Vayu)':     ['Neural Signals', 'ANS', 'Breath', 'Peristalsis'],
    'Space (Akasha)': ['Synaptic Clefts', 'Gut Lumen', 'Bronchial Space'],
    'Fire (Agni)':    ['HCl / pH 1.5', 'Bile', 'CYP450', 'mTOR', 'ATP'],
    'Water (Jala)':   ['Lymph', 'Blood Plasma', 'CSF', 'Synovial Fluid'],
    'Earth (Prithvi)':['Bone Matrix', 'Muscle Tissue', 'Connective Tissue'],
  };
  const ELEMENT_MED: Record<string, string> = {
    'Air (Vayu)':     'ANS excitation · action potentials (70–120 m/s) · respiratory drive · enteric nervous system motility',
    'Space (Akasha)': 'Synaptic transmission across 20–40 nm cleft · hollow viscera (GI, bronchial) · extracellular matrix',
    'Fire (Agni)':    'Gastric acid (HCl pH 1.0–1.5) · hepatic CYP450 enzymes · mitochondrial ATP synthesis · BMR',
    'Water (Jala)':   'Hydrolysis reactions · lymphatic circulation · cerebrospinal fluid dynamics · enzyme substrates',
    'Earth (Prithvi)':'Hydroxyapatite bone mineral · myofibrillar proteins (actin/myosin) · collagen/elastin ECM',
  };

  return (
    <View style={[styles.cardContent, { flex: 1, paddingBottom: 14 }]}>
      <Text style={styles.cardLabel}>ELEMENTAL PHYSIOLOGY</Text>

      <View style={[styles.doshaEquation, { borderColor: accent + '35', backgroundColor: accent + '0C' }]}>
        <Text style={[styles.doshaEquationTxt, { color: accent }]}>
          {period.dosha.charAt(0).toUpperCase() + period.dosha.slice(1)} = {w.romanElements}
        </Text>
        <Text style={styles.doshaEquationSub}>Two elemental forces · one biological principle</Text>
      </View>

      {w.elements.map((el, i) => {
        const chips = ELEMENT_CHIPS[el.name] ?? [];
        const medical = ELEMENT_MED[el.name] ?? el.desc;
        return (
          <View key={i} style={[styles.elementBlock, { borderColor: accent + '22', backgroundColor: accent + '07' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              <Text style={{ fontSize: 24, marginRight: 10 }}>{el.emoji}</Text>
              <View>
                <Text style={[styles.elementName, { color: accent }]}>{el.name}</Text>
                <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.30)', fontWeight: '700', letterSpacing: 0.8 }}>VEDIC ELEMENT</Text>
              </View>
            </View>
            <View style={styles.elRow}>
              <Text style={styles.elRowLabel}>VEDIC</Text>
              <Text style={styles.elRowVal}>{el.desc}{el.italic ? ` ${el.italic}` : ''}</Text>
            </View>
            <View style={styles.elRow}>
              <Text style={styles.elRowLabel}>BODY</Text>
              <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                {chips.map((c, j) => (
                  <View key={j} style={[styles.chip, { backgroundColor: accent + '18', borderColor: accent + '30' }]}>
                    <Text style={[styles.chipTxt, { color: accent }]}>{c}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        );
      })}

      <View style={[styles.boundaryBox, { borderLeftColor: accent + '55', marginTop: 6 }]}>
        <Text style={{ fontSize: 10, color: accent, fontWeight: '800', letterSpacing: 0.8, marginBottom: 5 }}>COMBINED EFFECT</Text>
        <Text style={styles.boundaryTxt}>{x.elementCombined}</Text>
      </View>
    </View>
  );
}

// ── Card 5: BODY SYSTEMS NOW ───────────────────────────────────────────────────
function Card5BodySystems({ period, accent }: { period: DoshaPeriod; accent: string }) {
  const w = WELLNESS[period.id];
  const x = PERIOD_EXTENDED[period.id];
  if (!w) return null;

  const now = new Date();
  const timeStr = `${String(now.getHours() % 12 || 12).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} ${now.getHours() < 12 ? 'AM' : 'PM'}`;

  return (
    <View style={[styles.cardContent, { flex: 1, paddingBottom: 14 }]}>
      <Text style={styles.cardLabel}>YOUR PHYSIOLOGY AT {timeStr}</Text>

      <View style={[styles.sciHero, { borderColor: accent + '35', backgroundColor: accent + '0C' }]}>
        <Text style={{ fontSize: 38, marginBottom: 8 }}>{period.sciEmoji}</Text>
        <Text style={[styles.sciTitle, { color: accent }]}>{period.sciTitle}</Text>
        <View style={{ height: 1, backgroundColor: accent + '35', marginVertical: 12 }} />
        <Text style={styles.sciDesc}>{period.sciDesc}</Text>
      </View>

      {x?.systemTags && (
        <View style={styles.systemLegend}>
          {x.systemTags.map((tag, i) => (
            <View key={i} style={[styles.systemTag, {
              backgroundColor: (SYS_COLOR[tag] ?? accent) + '18',
              borderColor: (SYS_COLOR[tag] ?? accent) + '35',
            }]}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: SYS_COLOR[tag] ?? accent, marginRight: 4 }} />
              <Text style={{ fontSize: 9, color: SYS_COLOR[tag] ?? accent, fontWeight: '800' }}>{tag}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={[styles.subLabel, { color: accent, marginTop: 14 }]}>WHAT'S HAPPENING INSIDE</Text>
      {w.bodyBullets.slice(0, 3).map((b, i) => (
        <View key={i} style={styles.bulletRow}>
          <View style={[styles.bulletDot, { backgroundColor: b.dot }]} />
          <Text style={styles.bulletTxt}>{b.text}</Text>
        </View>
      ))}

    </View>
  );
}

// ── Card 6: OPTIMAL PROTOCOL ──────────────────────────────────────────────────
function Card8ModernSci({ period, accent }: { period: DoshaPeriod; accent: string }) {
  const w = WELLNESS[period.id];
  if (!w) return null;

  return (
    <View style={[styles.cardContent, { flex: 1, paddingBottom: 14 }]}>
      <Text style={styles.cardLabel}>MODERN SCIENCE SAYS</Text>

      <View style={[styles.sciBox, { borderColor: accent + '28', backgroundColor: accent + '08', marginBottom: 16 }]}>
        <Text style={styles.sciBoxTxt}>{w.modernBrief}</Text>
      </View>

      {w.bodyBullets.slice(3).length > 0 && (
        <>
          <Text style={[styles.subLabel, { color: accent }]}>MORE INSIDE</Text>
          {w.bodyBullets.slice(3).map((b, i) => (
            <View key={i} style={styles.bulletRow}>
              <View style={[styles.bulletDot, { backgroundColor: b.dot }]} />
              <Text style={styles.bulletTxt}>{b.text}</Text>
            </View>
          ))}
        </>
      )}
    </View>
  );
}

function Card6Protocol({ period, accent }: { period: DoshaPeriod; accent: string }) {
  const w = WELLNESS[period.id];
  if (!w) return null;

  return (
    <View style={[styles.cardContent, { flex: 1, paddingBottom: 14 }]}>
      <Text style={styles.cardLabel}>YOUR DHARMIC PROTOCOL</Text>

      <View style={[styles.doAvoidSection, { borderColor: '#34d39930', backgroundColor: '#34d3990A' }]}>
        <View style={styles.doAvoidHeader}>
          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#34d39920', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
            <Text style={{ fontSize: 12, color: '#34d399', fontWeight: '900' }}>✓</Text>
          </View>
          <Text style={[styles.doAvoidTitle, { color: '#34d399' }]}>DO THIS NOW</Text>
        </View>
        {w.doItems.slice(0, 3).map((item, i) => (
          <View key={i} style={styles.actionRow}>
            <View style={[styles.actionEmojiBg, { backgroundColor: '#34d39914' }]}>
              <Text style={{ fontSize: 18 }}>{item.emoji}</Text>
            </View>
            <Text style={styles.actionTxt}>{item.text}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.doAvoidSection, { borderColor: '#f43f5e28', backgroundColor: '#f43f5e08', marginTop: 12 }]}>
        <View style={styles.doAvoidHeader}>
          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#f43f5e20', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
            <Text style={{ fontSize: 11, color: '#f43f5e', fontWeight: '900' }}>✕</Text>
          </View>
          <Text style={[styles.doAvoidTitle, { color: '#f43f5e' }]}>AVOID THIS NOW</Text>
        </View>
        {w.avoidItems.slice(0, 3).map((item, i) => (
          <View key={i} style={styles.actionRow}>
            <View style={[styles.actionEmojiBg, { backgroundColor: '#f43f5e14' }]}>
              <Text style={{ fontSize: 18 }}>{item.emoji}</Text>
            </View>
            <Text style={styles.actionTxt}>{item.text}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.boundaryBox, { borderLeftColor: accent + '55', marginTop: 16 }]}>
        <Text style={{ fontSize: 10, color: accent, fontWeight: '800', letterSpacing: 0.8, marginBottom: 5 }}>KĀLA AS MEDICINE</Text>
        <Text style={styles.boundaryTxt}>Right action at the right time requires 10% of the effort that wrong-time action cannot achieve with 100%. This is Kāla Cikitsā — time as the primary physician.</Text>
      </View>
    </View>
  );
}

// ── Card 7: NĀDA + WELLNESS PORTAL ────────────────────────────────────────────
function Card7Nada({ period, accent, onNada, onDeepDive, onWellness }: {
  period: DoshaPeriod; accent: string; onNada: () => void; onDeepDive: () => void; onWellness: () => void;
}) {
  const w = WELLNESS[period.id];
  const NADA_ICONS: Record<string, string> = {
    morning_birds: '🐦', spring_birds: '🌸', forest_breeze: '🌳', morning_flute: '🎶',
    sitar: '🎸', hz_432: '🔔', singing_bowl: '🔮', indian_beats: '🥁',
    sitar_tabla_bells: '🎵', flowing_water: '💧', gentle_wind: '🌬️', sea_waves: '🌊',
    wanderlust: '🌬️', spiritual_journey: '🌌', tibetan_bowl: '🫙', tibetan_dreams: '🧘',
    night_forest: '🦗', reincarnation_tones: '♾️', night_jungle_chiangmai: '🦟',
  };
  const NADA_NAMES: Record<string, string> = {
    morning_birds: 'Morning Birds', spring_birds: 'Spring Birds', forest_breeze: 'Forest Breeze',
    morning_flute: 'Meditation Tone', sitar: 'Calm Raga', hz_432: '432 Hz Bells',
    singing_bowl: 'Singing Bowl', indian_beats: 'Indian Beats',
    sitar_tabla_bells: 'Sitar & Tabla', flowing_water: 'Flowing Water',
    gentle_wind: 'Gentle Wind', sea_waves: 'Sea Waves',
    wanderlust: 'Wanderlust Breeze', spiritual_journey: 'Spiritual Journey',
    tibetan_bowl: 'Tibetan Bowl', tibetan_dreams: 'Tibetan Dreams',
    night_forest: 'Night Forest', reincarnation_tones: 'Reincarnation',
    night_jungle_chiangmai: 'Night Jungle',
  };

  return (
    <View style={[styles.cardContent, { flex: 1, paddingBottom: 14 }]}>
      <Text style={styles.cardLabel}>DEEPEN THIS PERIOD</Text>

      <View style={[styles.nadaHero, { borderColor: accent + '28', backgroundColor: accent + '09' }]}>
        <Text style={{ fontSize: 36, marginBottom: 6 }}>🎵</Text>
        <Text style={[styles.nadaTitle, { color: accent }]}>Nāda Cikitsā</Text>
        <Text style={styles.nadaSubtitle}>
          Āyurveda uses sound as medicine. These frequencies amplify {period.dosha.charAt(0).toUpperCase() + period.dosha.slice(1)} qualities and harmonise your current energetic state.
        </Text>
      </View>

      <Text style={[styles.subLabel, { color: accent, marginTop: 14 }]}>RECOMMENDED FOR {period.label.toUpperCase()}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 6 }}>
        {(w?.nadaSounds ?? []).map((id, i) => (
          <TouchableOpacity key={i} onPress={onNada} activeOpacity={0.70}
            style={[styles.nadaPill, { borderColor: accent + '45', backgroundColor: accent + '14' }]}>
            <Text style={{ fontSize: 16 }}>{NADA_ICONS[id] ?? '🎵'}</Text>
            <Text style={[styles.nadaPillTxt, { color: accent }]}>{NADA_NAMES[id] ?? id}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity onPress={onNada} activeOpacity={0.82}
        style={[styles.nadaBtn, { backgroundColor: accent }]}>
        <Text style={styles.nadaBtnTxt}>🎵  Open Nāda Sounds</Text>
      </TouchableOpacity>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 14 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.07)' }} />
        <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.18)', fontWeight: '700', letterSpacing: 1.2 }}>EXPLORE FURTHER</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.07)' }} />
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <TouchableOpacity onPress={onDeepDive} activeOpacity={0.80}
          style={[styles.wellnessPortal, { borderColor: accent + '45', flex: 1, padding: 12 }]}>
          <LinearGradient
            colors={[accent + '1A', accent + '08', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, backgroundColor: accent + '60', borderRadius: 14 }} />
          <Text style={{ fontSize: 22, marginBottom: 6 }}>📊</Text>
          <Text style={{ fontSize: 10, color: accent, fontWeight: '800', lineHeight: 14 }}>My {period.englishLabel}</Text>
          <Text style={{ fontSize: 8, color: 'rgba(255,255,255,0.38)', marginTop: 3, lineHeight: 12 }}>Deep dive · Sun clock · Science</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onWellness} activeOpacity={0.80}
          style={[styles.wellnessPortal, { borderColor: '#34d39945', flex: 1, padding: 12 }]}>
          <LinearGradient
            colors={['#34d39918', '#34d39908', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, backgroundColor: '#34d39960', borderRadius: 14 }} />
          <Text style={{ fontSize: 22, marginBottom: 6 }}>🌿</Text>
          <Text style={{ fontSize: 10, color: '#34d399', fontWeight: '800', lineHeight: 14 }}>Āyurveda Wellness</Text>
          <Text style={{ fontSize: 8, color: 'rgba(255,255,255,0.38)', marginTop: 3, lineHeight: 12 }}>All doshas · Daily routine · Guide</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}

// ── MAIN MODAL ─────────────────────────────────────────────────────────────────
export default function MetabolicStoryModal({
  period,
  solarTimes,
  onClose,
}: {
  period: DoshaPeriod;
  solarTimes: SolarTimes | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [card, setCard] = useState(0);
  const TOTAL = 10;
  const accent = DOSHA_COLOR[period.dosha] ?? '#60a5fa';
  const balance = DOSHA_BALANCE[period.dosha] ?? '#60a5fa';
  const bgColors = DOSHA_BG[period.dosha] ?? ['#140E1E', '#0C0814'];

  const goNext = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (card < TOTAL - 1) setCard(c => c + 1);
    else onClose();
  }, [card, onClose]);

  const goPrev = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (card > 0) setCard(c => c - 1);
  }, [card]);

  const handleNada = () => {
    router.push('/(tabs)/sleep' as never);
    onClose();
  };

  const handleDeepDive = () => {
    router.push({
      pathname: '/metabolic-period' as never,
      params: {
        periodId: period.id,
        periodStart: period.startLabel,
        periodEnd: period.endLabel,
        minutesRemaining: String(period.minutesRemaining),
      },
    } as never);
    onClose();
  };

  const handleWellness = () => {
    router.push('/ayurvedic-wellness' as never);
    onClose();
  };

  const CARD_LABELS = [
    `${period.emoji}  ${period.englishLabel.toUpperCase()}`,
    '◉  SANSKRIT IDENTITY',
    '✦  ETYMOLOGY & ORIGIN',
    '☀️  CIRCADIAN CLOCK',
    '🔬  CIRCADIAN SCIENCE',
    '⬡  ELEMENTAL PHYSIOLOGY',
    '🫀  BODY SYSTEMS NOW',
    '💡  MODERN SCIENCE',
    '⚡  YOUR PROTOCOL',
    '🎵  NĀDA & WELLNESS',
  ];

  return (
    <Modal visible animationType="slide" transparent statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.screen}>
        {/* Base dosha background */}
        <LinearGradient
          colors={[bgColors[0], bgColors[1]]}
          start={{ x: 0, y: 0 }} end={{ x: 0.4, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        {/* Dosha glow — top */}
        <LinearGradient
          colors={[accent + '30', accent + '10', 'transparent']}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.38 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        {/* Balance element glow — bottom */}
        <LinearGradient
          colors={['transparent', balance + '0C', balance + '1C']}
          start={{ x: 0.5, y: 0.55 }} end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        {/* Top dosha accent line */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: accent + 'A0' }} />
        {/* Bottom balance accent line */}
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: balance + '70' }} />

        <View style={styles.progressRow}>
          {Array.from({ length: TOTAL }).map((_, i) => (
            <View key={i} style={[styles.progressSeg, {
              backgroundColor: i < card ? accent + 'CC' : i === card ? '#FFFFFFCC' : '#FFFFFF15',
            }]} />
          ))}
        </View>

        <View style={styles.header}>
          <Text style={[styles.headerLabel, { color: accent }]}>{CARD_LABELS[card]}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={styles.closeBtn}>
            <Text style={styles.closeTxt}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={{ flex: 1 }}>
          {card === 0 && <Card1Dashboard period={period} solarTimes={solarTimes} accent={accent} />}
          {card === 1 && <Card2Identity period={period} accent={accent} />}
          {card === 2 && <Card3EtymSun period={period} accent={accent} />}
          {card === 3 && <Card3Solar period={period} solarTimes={solarTimes} accent={accent} />}
          {card === 4 && <Card5CircSci period={period} accent={accent} />}
          {card === 5 && <Card4Elements period={period} accent={accent} />}
          {card === 6 && <Card5BodySystems period={period} accent={accent} />}
          {card === 7 && <Card8ModernSci period={period} accent={accent} />}
          {card === 8 && <Card6Protocol period={period} accent={accent} />}
          {card === 9 && <Card7Nada period={period} accent={accent} onNada={handleNada} onDeepDive={handleDeepDive} onWellness={handleWellness} />}
        </View>

        <View pointerEvents="box-none" style={styles.tapZones}>
          <TouchableOpacity style={{ flex: 2 }} activeOpacity={0.01} onPress={goPrev} />
          <TouchableOpacity style={{ flex: 3 }} activeOpacity={0.01} onPress={goNext} />
        </View>

        <View style={styles.navBar}>
          <TouchableOpacity onPress={goPrev} disabled={card === 0} style={[styles.navBtn, { opacity: card > 0 ? 1 : 0.22 }]}>
            <Text style={styles.navBtnTxt}>←  Prev</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
            {Array.from({ length: TOTAL }).map((_, i) => (
              <TouchableOpacity key={i} onPress={() => setCard(i)}>
                <View style={{ width: i === card ? 18 : 5, height: 5, borderRadius: 3, backgroundColor: i === card ? accent : '#FFFFFF20' }} />
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity onPress={goNext} style={[styles.navBtnAccent, { borderColor: accent + '55', backgroundColor: accent + '20' }]}>
            <Text style={[styles.navBtnAccentTxt, { color: accent }]}>
              {card < TOTAL - 1 ? 'Next  →' : 'Done  ✓'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#14122A' },
  progressRow: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 58, gap: 3 },
  progressSeg: { flex: 1, height: 3, borderRadius: 2 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 12, paddingBottom: 4, gap: 8 },
  headerLabel: { flex: 1, fontSize: 9, fontWeight: '900', letterSpacing: 1.6 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: '#FFFFFF20', backgroundColor: '#FFFFFF0A', alignItems: 'center', justifyContent: 'center' },
  closeTxt: { color: '#FFFFFF70', fontSize: 13, fontWeight: '700' },
  cardContent: { paddingHorizontal: 22, paddingTop: 10, paddingBottom: 88 },

  // Card 1
  activeBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, marginBottom: 0 },
  activeBadgeTxt: { fontSize: 9, fontWeight: '900', letterSpacing: 1.8 },
  metricRow: { flexDirection: 'row', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.04)', marginTop: 14, overflow: 'hidden' },
  metricCell: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  metricVal: { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  metricLabel: { fontSize: 8, color: 'rgba(255,255,255,0.32)', fontWeight: '700', letterSpacing: 1, marginTop: 2 },
  timeRow: { alignItems: 'center', marginTop: 14 },
  timePill: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  timeTxt: { fontSize: 13, fontWeight: '800', letterSpacing: 0.3 },
  swipeHint: { textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.22)', fontWeight: '600', marginTop: 20, letterSpacing: 0.4 },

  // Card 2
  cardLabel: { fontSize: 9, fontWeight: '900', color: 'rgba(255,255,255,0.30)', letterSpacing: 2, marginBottom: 14, textAlign: 'center' },
  subLabel: { fontSize: 8, fontWeight: '900', letterSpacing: 1.8, marginBottom: 10 },
  sanskritHero: { borderRadius: 18, borderWidth: 1, padding: 18, alignItems: 'center', marginBottom: 18 },
  sanskritBig: { fontSize: 22, fontWeight: '900', textAlign: 'center', letterSpacing: 0.3, lineHeight: 30 },
  phoneticTxt: { fontSize: 11, color: 'rgba(255,255,255,0.42)', fontStyle: 'italic', marginTop: 4, letterSpacing: 0.5 },
  sanskritMeaning: { fontSize: 12, color: 'rgba(255,255,255,0.58)', textAlign: 'center', fontStyle: 'italic', lineHeight: 18 },
  etymRow: { borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', backgroundColor: 'rgba(255,255,255,0.03)', padding: 12, marginBottom: 7 },
  etymTerm: { fontSize: 13, fontWeight: '900', marginBottom: 3, letterSpacing: 0.2 },
  etymBreakdown: { fontSize: 11.5, color: 'rgba(255,255,255,0.52)', lineHeight: 17 },
  sunBox: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 14 },
  sunBoxTxt: { fontSize: 12.5, color: 'rgba(255,255,255,0.70)', lineHeight: 19, fontWeight: '600' },
  sunBoxSub: { fontSize: 11, color: 'rgba(255,255,255,0.38)', lineHeight: 17, fontStyle: 'italic' },
  classicalBox: { borderLeftWidth: 3, paddingLeft: 14, paddingVertical: 4 },
  classicalText: { fontSize: 11.5, color: 'rgba(255,255,255,0.55)', lineHeight: 18, fontStyle: 'italic', marginBottom: 5 },
  classicalSource: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

  // Card 3
  introTxt: { fontSize: 12, color: 'rgba(255,255,255,0.58)', lineHeight: 18, textAlign: 'center', marginBottom: 4, fontStyle: 'italic' },
  nowBadge: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 6, marginTop: 8 },
  legendGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  sciBox: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10 },
  sciBoxTxt: { fontSize: 12.5, color: 'rgba(255,255,255,0.68)', lineHeight: 19, fontWeight: '500' },

  // Card 4
  doshaEquation: { borderRadius: 16, borderWidth: 1, padding: 14, alignItems: 'center', marginBottom: 16 },
  doshaEquationTxt: { fontSize: 17, fontWeight: '900', letterSpacing: 0.3 },
  doshaEquationSub: { fontSize: 10, color: 'rgba(255,255,255,0.38)', marginTop: 4, fontStyle: 'italic' },
  elementBlock: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 12 },
  elementName: { fontSize: 13, fontWeight: '900', marginBottom: 1 },
  elRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 8 },
  elRowLabel: { fontSize: 8, fontWeight: '900', color: 'rgba(255,255,255,0.28)', letterSpacing: 1.2, width: 46, paddingTop: 2, flexShrink: 0 },
  elRowVal: { flex: 1, fontSize: 11.5, color: 'rgba(255,255,255,0.62)', lineHeight: 17 },
  chip: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 3 },
  chipTxt: { fontSize: 9, fontWeight: '800' },

  // Card 5
  sciHero: { borderRadius: 20, borderWidth: 1, padding: 20, alignItems: 'center', marginBottom: 10 },
  sciTitle: { fontSize: 17, fontWeight: '900', textAlign: 'center', lineHeight: 23 },
  sciDesc: { fontSize: 12.5, color: 'rgba(255,255,255,0.65)', lineHeight: 20, textAlign: 'center', fontWeight: '500' },
  systemLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 4 },
  systemTag: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 5 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 11 },
  bulletDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6, flexShrink: 0 },
  bulletTxt: { flex: 1, fontSize: 12.5, color: 'rgba(255,255,255,0.72)', lineHeight: 19, fontWeight: '500' },

  // Card 6
  briefBox: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 14 },
  briefTxt: { fontSize: 12.5, color: 'rgba(255,255,255,0.70)', lineHeight: 20, fontWeight: '500' },
  doAvoidSection: { borderRadius: 18, borderWidth: 1, padding: 16 },
  doAvoidHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  doAvoidTitle: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 9 },
  actionEmojiBg: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionTxt: { fontSize: 13, color: 'rgba(255,255,255,0.78)', fontWeight: '600', flex: 1, lineHeight: 18 },
  boundaryBox: { borderLeftWidth: 3, paddingLeft: 14, paddingVertical: 4 },
  boundaryTxt: { fontSize: 11.5, color: 'rgba(255,255,255,0.48)', lineHeight: 18, fontStyle: 'italic' },

  // Card 7
  nadaHero: { borderRadius: 20, borderWidth: 1, padding: 20, alignItems: 'center', marginBottom: 6 },
  nadaTitle: { fontSize: 20, fontWeight: '900', marginBottom: 7 },
  nadaSubtitle: { fontSize: 11.5, color: 'rgba(255,255,255,0.55)', lineHeight: 18, textAlign: 'center' },
  nadaPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, borderWidth: 1 },
  nadaPillTxt: { fontSize: 11, fontWeight: '700' },
  nadaBtn: { borderRadius: 18, paddingVertical: 16, alignItems: 'center', marginTop: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 14, elevation: 10 },
  nadaBtnTxt: { fontSize: 15, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.3 },
  wellnessPortal: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 18, borderWidth: 1, padding: 18, overflow: 'hidden' },
  portalTitle: { fontSize: 15, fontWeight: '900', color: '#FFFFFFEE', marginBottom: 4 },
  portalSub: { fontSize: 10, color: 'rgba(255,255,255,0.40)', lineHeight: 15 },
  portalIcon: { width: 50, height: 50, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

  // Nav
  tapZones: { position: 'absolute', top: 110, bottom: 100, left: 0, right: 0, flexDirection: 'row' },
  navBar: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: 42, paddingHorizontal: 22, paddingTop: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(4,4,14,0.72)' },
  navBtn: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 14, borderWidth: 1, borderColor: '#FFFFFF15', backgroundColor: '#FFFFFF08' },
  navBtnTxt: { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: '700' },
  navBtnAccent: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 14, borderWidth: 1 },
  navBtnAccentTxt: { fontSize: 12, fontWeight: '800' },
});
