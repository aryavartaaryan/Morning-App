/**
 * MetabolicStoryModal v4 — Instagram-style Stories
 * ZERO scrolling — every card fits perfectly on screen.
 * Long content → split into 2 cards automatically.
 * Total: 13 cards (some topics split for frictionless UX)
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, Modal, TouchableOpacity,
  StyleSheet, Dimensions, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Svg, { Circle as SvgCircle, Path as SvgPath } from 'react-native-svg';
import type { DoshaPeriod } from '@/lib/ayurvedicPeriods';
import type { SolarTimes } from '@/lib/solar';
import { WELLNESS, PERIOD_SANSKRIT, PERIOD_EXTENDED } from '@/lib/wellnessData';

const { width: W, height: H } = Dimensions.get('window');

// Available vertical space for card content
// Screen - topBar(~100px) - navBar(~90px) = content area
const CONTENT_H = H - 190;

const DOSHA_COLOR: Record<string, string> = {
  kapha: '#34d399',
  pitta: '#fb923c',
  vata:  '#a78bfa',
};
const NIGHT_PERIODS = new Set(['evening_kapha', 'night_pitta', 'night_vata']);
const SYS_COLOR: Record<string, string> = {
  'Anabolic': '#34d399', 'Immune': '#34d399', 'Lymphatic': '#60a5fa',
  'Musculoskeletal': '#a78bfa', 'Metabolic': '#fb923c', 'Digestive': '#fb923c',
  'Cognitive': '#fbbf24', 'Hepatic': '#f59e0b', 'Nervous': '#a78bfa',
  'Respiratory': '#60a5fa', 'Motor': '#34d399', 'Eliminative': '#818cf8',
  'Parasympathetic': '#a78bfa', 'Endocrine': '#fbbf24', 'Fluid': '#60a5fa',
  'Sleep Prep': '#818cf8', 'Repair': '#34d399', 'Glymphatic': '#60a5fa',
  'Neurological': '#a78bfa',
};

function fmt12H(dec: number): string {
  const total = Math.round(dec * 60) % (24 * 60);
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  const ap = hh < 12 ? 'AM' : 'PM';
  const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  return `${String(h12).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${ap}`;
}

// ── Western-friendly period data ──────────────────────────────────────────────
const WESTERN_EXPLAINER: Record<string, {
  headline: string; tagline: string; what: string;
  whyMatters: string; analogy: string;
  topFact: { icon: string; label: string; value: string }[];
}> = {
  morning_kapha_early: {
    headline: 'Your Body is Grounding & Waking',
    tagline: 'Yoga & Meditation Hour · Cortisol rising · Best time for mindfulness',
    what: 'Right now, your body is transitioning from sleep to wakefulness. Cortisol is beginning its ascent. Ayurveda calls this early Kapha — the quiet, grounding phase before the active day.',
    whyMatters: 'Mindfulness and gentle movement in THIS window regulate your nervous system for the entire day. It sets your baseline stress response.',
    analogy: '🌅  The engine is warming up. Don\'t redline it immediately. Let it idle smoothly with breathwork and stretching.',
    topFact: [
      { icon: '🧘', label: 'Nervous Sys', value: 'Highly receptive' },
      { icon: '📈', label: 'Cortisol', value: 'Morning rise' },
      { icon: '🌱', label: 'Mindset', value: 'Open for intention' },
    ],
  },
  morning_kapha: {
    headline: 'Your Body is in Build Mode',
    tagline: 'Peak Anabolic Window · Testosterone highest · Best time to move',
    what: 'Right now, your body is pumping its highest testosterone and growth hormone. Joints are freshly lubricated. Muscles are primed to grow. Ayurveda calls this Kapha — the heavy, building, earthy phase.',
    whyMatters: 'Exercise in THIS window builds 23% more muscle than the same workout at 6 PM. Your anabolic hormones will never be higher today.',
    analogy: '🏗️  Your body is a construction site. The foreman just arrived. Workers are energised. Build NOW.',
    topFact: [
      { icon: '💪', label: 'Testosterone', value: '+25% above evening' },
      { icon: '🦴', label: 'Joints', value: 'Max lubrication' },
      { icon: '🧠', label: 'Cortisol', value: 'Rising — alert' },
    ],
  },
  midday_pitta: {
    headline: 'Your Digestive Fire is at Peak',
    tagline: 'Metabolism Maximum · Best meal window · Cognitive peak',
    what: "Right now (10 AM–2 PM), stomach acid is at lowest pH — meaning most powerful. Digestive enzymes at maximum. Liver detox running at full speed. Ayurveda calls this Pitta — fire, transformation, intensity.",
    whyMatters: 'Eating your largest meal NOW means 30% better nutrient absorption vs 7 PM. The same food eaten at night becomes fat.',
    analogy: '🔥  Your stomach is a furnace. At noon it burns white-hot. By evening it\'s embers. Feed it when HOT.',
    topFact: [
      { icon: '🔬', label: 'Stomach Acid', value: 'Strongest of the day' },
      { icon: '⚡', label: 'Insulin', value: '+30% vs evening' },
      { icon: '🧠', label: 'Cognition', value: 'Peak for decisions' },
    ],
  },
  afternoon_vata: {
    headline: 'Your Nervous System is Alive',
    tagline: 'Creativity peak · Athletic performance rising · Move now',
    what: 'Right now (2–6 PM), your nervous system is highly sensitive. Reaction time improves. Creativity surges. Lungs reach peak capacity around 4–5 PM. Ayurveda calls this Vata — air, movement, velocity.',
    whyMatters: 'Athletic records are most broken between 4–6 PM — body temperature, reaction time, and muscle coordination all peak here.',
    analogy: '🌬️  Your nervous system is a sail. The afternoon wind fills it perfectly. Move, create, communicate.',
    topFact: [
      { icon: '🎨', label: 'Creativity', value: 'Highest of the day' },
      { icon: '🏃', label: 'Athletic Peak', value: '4–5 PM window' },
      { icon: '🫁', label: 'Lung Capacity', value: 'Maximum' },
    ],
  },
  evening_kapha: {
    headline: 'Your Body is Slowing Down — Let It',
    tagline: 'Melatonin rising · Blue light most damaging · Rest begins',
    what: 'Right now (6–10 PM), melatonin is being produced as light fades. Core temperature is starting its 1°C nightly drop. Cortisol at its daily low. Ayurveda calls this evening Kapha — heavy, stable, quiet.',
    whyMatters: 'Blue light NOW suppresses melatonin by 50%, delaying sleep 1–3 hours. Your body is trying to wind down — screens are fighting that every evening.',
    analogy: '🌙  Your body is a city at dusk. Shops are closing. The night shift is about to clock in. Stop the noise.',
    topFact: [
      { icon: '😴', label: 'Melatonin', value: 'Rising — protect it' },
      { icon: '🌡️', label: 'Core Temp', value: 'Descending for sleep' },
      { icon: '📱', label: 'Blue Light', value: 'Most damaging NOW' },
    ],
  },
  night_pitta: {
    headline: 'Your Body is Running Its Night Shift',
    tagline: 'Growth Hormone peak · Liver detox max · Sleep IS medicine',
    what: "Right now (10 PM–2 AM), if you're asleep, extraordinary work is happening. Growth Hormone peaks during deep sleep. Liver detox enzymes at maximum. Autophagy — the body's self-cleaning — fully active.",
    whyMatters: "Every hour of deep sleep here is your body's only chance to detox, repair DNA, and build muscle for that day. Missing it isn't just tiredness.",
    analogy: '🏭  Your body is a factory. Daytime = production. Now = night shift maintenance. If you stay up — the crew can\'t work.',
    topFact: [
      { icon: '🏋️', label: 'Growth Hormone', value: 'Peaks in deep sleep' },
      { icon: '🧹', label: 'Autophagy', value: 'Self-cleaning max' },
      { icon: '🔬', label: 'DNA Repair', value: 'Enzymes most active' },
    ],
  },
  night_vata: {
    headline: 'The Sacred Pre-Dawn Window',
    tagline: 'Brahma Muhurta · Meditation peak · Mind most open',
    what: 'Right now (2–6 AM), your brainwaves are in alpha-theta — the same state meditators spend years trying to achieve. The subconscious boundary is thinnest. Ayurveda calls this Brahma Muhurta — the Creator\'s hour.',
    whyMatters: 'Meditation in THIS window is 10–20× more effective than midday. BDNF (brain growth hormone) is elevated — new intentions embed deeply.',
    analogy: '🌅  Your mind is a calm lake before sunrise. No wind, no boats. Whatever you drop in (intentions, mantras) sinks straight to the bottom.',
    topFact: [
      { icon: '🧘', label: 'Brainwaves', value: 'Alpha-theta peak' },
      { icon: '🌱', label: 'BDNF', value: 'Elevated — best learning' },
      { icon: '🕐', label: 'Brahma Muhurta', value: '96 min before sunrise' },
    ],
  },
  midday_pitta_late: {
    headline: 'Your Body is in Digest Mode',
    tagline: 'Post-Solar Dip · Digestive Blood Flow · Rest & Digest',
    what: "Right now (post-solar noon), blood flow is heavily diverted to your digestive tract to process your main meal. Your body experiences a natural cortisol dip. Ayurveda identifies this as the later part of Pitta — where the fire turns inward to transform food into fuel.",
    whyMatters: 'Pushing for high cognitive output now causes unnecessary stress. By taking a brief restorative pause or doing low-cognitive tasks, you allow digestion to finish efficiently.',
    analogy: '🔋 Your battery is briefly redirecting power to the internal engine. Let the engine run smoothly before hitting the accelerator again.',
    topFact: [
      { icon: '🩸', label: 'Blood Flow', value: 'Diverted to gut' },
      { icon: '📉', label: 'Cortisol', value: 'Natural afternoon dip' },
      { icon: '🧘', label: 'Focus', value: 'Shifted internally' },
    ],
  },
};

// ── CARD 0: Western Explainer ─────────────────────────────────────────────────
function Card0Western({ period, accent }: { period: DoshaPeriod; accent: string }) {
  const ex = WESTERN_EXPLAINER[period.id];
  if (!ex) return null;
  const isNight = NIGHT_PERIODS.has(period.id);

  return (
    <View style={S.card}>
      {/* Period badge row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <Text style={{ fontSize: 36 }}>{period.emoji}</Text>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 4 }}>
            <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, backgroundColor: accent + '20', borderWidth: 1, borderColor: accent + '40' }}>
              <Text style={{ fontSize: 8, color: accent, fontWeight: '900', letterSpacing: 1.2 }}>
                {period.dosha.toUpperCase()} · {isNight ? 'NIGHT' : 'DAY'}
              </Text>
            </View>
          </View>
          <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.40)', fontWeight: '600' }}>
            {period.startLabel}  →  {period.endLabel}
          </Text>
        </View>
      </View>

      {/* Headline */}
      <Text style={{ fontSize: 24, fontWeight: '900', color: '#FFFFFF', lineHeight: 30, letterSpacing: -0.5, marginBottom: 5 }}>
        {ex.headline}
      </Text>
      <Text style={{ fontSize: 10, color: accent, fontWeight: '700', letterSpacing: 0.4, marginBottom: 14 }}>
        {ex.tagline}
      </Text>

      {/* What box */}
      <View style={[S.infoBox, { borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(255,255,255,0.04)', marginBottom: 10 }]}>
        <Text style={S.infoBoxLabel}>WHAT IS HAPPENING RIGHT NOW</Text>
        <Text style={S.infoBoxText}>{ex.what}</Text>
      </View>

      {/* Why matters box */}
      <View style={[S.infoBox, { borderColor: accent + '30', backgroundColor: accent + '0A', marginBottom: 14 }]}>
        <Text style={[S.infoBoxLabel, { color: accent }]}>WHY THIS WINDOW MATTERS</Text>
        <Text style={S.infoBoxText}>{ex.whyMatters}</Text>
      </View>

      {/* Key facts row */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {ex.topFact.map((f, i) => (
          <View key={i} style={{ flex: 1, borderRadius: 12, borderWidth: 1, borderColor: accent + '28', backgroundColor: accent + '08', padding: 10, alignItems: 'center', gap: 3 }}>
            <Text style={{ fontSize: 18 }}>{f.icon}</Text>
            <Text style={{ fontSize: 8, color: accent, fontWeight: '900', textAlign: 'center', letterSpacing: 0.4 }}>{f.label}</Text>
            <Text style={{ fontSize: 9, color: '#FFFFFFCC', fontWeight: '700', textAlign: 'center', lineHeight: 13 }}>{f.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── CARD 0b: Analogy card (second part of Western explainer) ──────────────────
function Card0bAnalogy({ period, accent }: { period: DoshaPeriod; accent: string }) {
  const ex = WESTERN_EXPLAINER[period.id];
  if (!ex) return null;
  const s = PERIOD_SANSKRIT[period.id];

  return (
    <View style={S.card}>
      <Text style={S.cardLabel}>THE ANALOGY</Text>

      {/* Big analogy */}
      <View style={[S.infoBox, { borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.05)', marginBottom: 18, padding: 20 }]}>
        <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.80)', lineHeight: 24, fontStyle: 'italic' }}>{ex.analogy}</Text>
      </View>

      {/* Sanskrit name reveal */}
      {s && (
        <View style={[S.infoBox, { borderColor: accent + '35', backgroundColor: accent + '0C', alignItems: 'center', padding: 20, marginBottom: 18 }]}>
          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: '700', letterSpacing: 1.8, marginBottom: 6 }}>WHAT AYURVEDA CALLS THIS</Text>
          <Text style={{ fontSize: 28, fontWeight: '900', color: accent, letterSpacing: 0.3 }}>{s.sanskrit}</Text>
          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', fontStyle: 'italic', marginTop: 6, textAlign: 'center', lineHeight: 19 }}>"{s.meaning}"</Text>
        </View>
      )}

      {/* Time window pill */}
      <View style={{ alignItems: 'center' }}>
        <View style={{ paddingHorizontal: 18, paddingVertical: 10, borderRadius: 18, borderWidth: 1, borderColor: accent + '40', backgroundColor: accent + '12' }}>
          <Text style={{ fontSize: 13, color: accent, fontWeight: '800' }}>
            {period.startLabel}  →  {period.endLabel}
          </Text>
        </View>
        <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', marginTop: 8 }}>Swipe to see inside your body →</Text>
      </View>
    </View>
  );
}

// ── CARD 1: Phase Dashboard ───────────────────────────────────────────────────
function Card1Dashboard({ period, accent }: { period: DoshaPeriod; accent: string }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.10, duration: 1400, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1,    duration: 1400, useNativeDriver: true }),
    ])).start();
  }, []);

  const rem = period.minutesRemaining;
  const remStr = rem >= 60 ? `${Math.floor(rem / 60)}h ${rem % 60}m` : `${rem}m`;
  const durM = Math.max(1, Math.round(((period.endH - period.startH + 24) % 24) * 60));
  const prog = Math.min(1, Math.max(0, (durM - rem) / durM));
  const durStr = durM >= 60 ? `${Math.floor(durM / 60)}h ${durM % 60}m` : `${durM}m`;

  return (
    <View style={[S.card, { alignItems: 'center' }]}>
      {/* Active badge */}
      <View style={[S.activeBadge, { borderColor: accent + '60', backgroundColor: accent + '14', marginBottom: 20 }]}>
        <Animated.View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: accent, transform: [{ scale: pulse }], marginRight: 6 }} />
        <Text style={[S.activeBadgeTxt, { color: accent }]}>ACTIVE NOW</Text>
      </View>

      {/* Emoji + name */}
      <Text style={{ fontSize: 56, marginBottom: 10 }}>{period.emoji}</Text>
      <Text style={{ fontSize: 26, fontWeight: '900', color: '#FFFFFF', textAlign: 'center', letterSpacing: -0.5, lineHeight: 32, marginBottom: 4 }}>
        {period.englishLabel}
      </Text>
      <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.36)', fontWeight: '600', marginBottom: 24 }}>
        {period.startLabel}  →  {period.endLabel}
      </Text>

      {/* Metrics row */}
      <View style={[S.metricRow, { width: '100%', marginBottom: 20 }]}>
        {[
          { label: 'DURATION', value: durStr },
          { label: 'REMAINING', value: remStr },
          { label: 'ELAPSED', value: `${Math.round(prog * 100)}%` },
        ].map((m, i) => (
          <View key={i} style={[S.metricCell, i === 1 && { borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }]}>
            <Text style={[S.metricVal, { color: i === 2 ? accent : '#FFFFFF' }]}>{m.value}</Text>
            <Text style={S.metricLabel}>{m.label}</Text>
          </View>
        ))}
      </View>

      {/* Progress bar */}
      <View style={{ width: '100%' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text style={{ fontSize: 8, color: 'rgba(255,255,255,0.28)', fontWeight: '700', letterSpacing: 1 }}>PHASE PROGRESS</Text>
          <Text style={{ fontSize: 8, color: accent, fontWeight: '800' }}>{Math.round(prog * 100)}%</Text>
        </View>
        <View style={{ height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
          <View style={{ width: `${Math.round(prog * 100)}%` as any, height: 5, borderRadius: 3, backgroundColor: accent }} />
        </View>
      </View>
    </View>
  );
}

// ── CARD 2: Body Clock — clean horizontal timeline ────────────────────────────
function Card2BodyClock({ period, solarTimes, accent }: {
  period: DoshaPeriod; solarTimes: SolarTimes | null; accent: string;
}) {
  const sr = solarTimes?.sunrise ?? 6;
  const ss = solarTimes?.sunset ?? 18;
  const sn = solarTimes?.solarNoon ?? ((sr + ss) / 2);
  const dayLen = ss - sr;
  const nightLen = 24 - dayLen;
  const daySeg = dayLen / 3;
  const nightSeg = nightLen / 3;

  // Energy Dip: solarNoon + 1.5 hrs → solarNoon + 3 hrs (90-min circadian alertness trough)
  const dipStart  = sn + 1.5;
  const dipEnd    = Math.min(sn + 3, ss - 0.5);
  const vataStart = dipEnd;

  const PERIODS_ORDERED = [
    { id: 'morning_kapha_early',start: sr,         end: sr + daySeg/2,color: '#34d399', emoji: '🧘', label: 'Yoga & Med' },
    { id: 'morning_kapha',      start: sr + daySeg/2, end: sr + daySeg, color: '#34d399', emoji: '🌿', label: 'Morning Kapha' },
    { id: 'midday_pitta',       start: sr + daySeg, end: dipStart,    color: '#fb923c', emoji: '🔥', label: 'Peak Focus' },
    { id: 'midday_pitta_late',  start: dipStart,   end: dipEnd,       color: '#f59e0b', emoji: '🍃', label: 'Energy Dip' },
    { id: 'afternoon_vata',     start: vataStart,  end: ss,           color: '#a78bfa', emoji: '🌬️', label: 'Afternoon Vāta' },
    { id: 'evening_kapha',      start: ss,         end: ss + nightSeg, color: '#34d399', emoji: '🌿', label: 'Evening Kapha' },
    { id: 'night_pitta',        start: ss + nightSeg, end: ss + 2 * nightSeg, color: '#fbbf24', emoji: '🔥', label: 'Night Pitta' },
    { id: 'night_vata',         start: ss + 2 * nightSeg, end: sr + 24, color: '#818cf8', emoji: '🌬️', label: 'Pre-dawn Vāta' },
  ];

  return (
    <View style={S.card}>
      <Text style={S.cardLabel}>YOUR 24-HOUR BODY CLOCK</Text>
      <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 17, textAlign: 'center', marginBottom: 14 }}>
        The day splits into 6 natural phases. Each governs different biology. Ayurveda mapped this 5,000 years ago.
      </Text>

      {/* 24h bar */}
      <View style={{ flexDirection: 'row', height: 24, borderRadius: 12, overflow: 'hidden', marginBottom: 8 }}>
        {PERIODS_ORDERED.map((p, i) => {
          const dur = (p.end - p.start + 24) % 24 || 24;
          const w = (dur / 24) * 100;
          const isActive = p.id === period.id;
          return (
            <View key={i} style={{ width: `${w}%`, backgroundColor: p.color + (isActive ? 'FF' : '38'), alignItems: 'center', justifyContent: 'center' }}>
              {isActive && <Text style={{ fontSize: 9 }}>{p.emoji}</Text>}
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
        <Text style={{ fontSize: 7, color: '#fbbf2480', fontWeight: '700' }}>☀️ {fmt12H(sr)}</Text>
        <Text style={{ fontSize: 7, color: 'rgba(255,255,255,0.28)', fontWeight: '700' }}>Noon</Text>
        <Text style={{ fontSize: 7, color: '#f9731680', fontWeight: '700' }}>🌅 {fmt12H(ss)}</Text>
        <Text style={{ fontSize: 7, color: '#818cf880', fontWeight: '700' }}>🌙 Mid</Text>
      </View>

      {/* Period list */}
      <View style={{ gap: 6 }}>
        {PERIODS_ORDERED.map((p, i) => {
          const isActive = p.id === period.id;
          const dur = (p.end - p.start + 24) % 24 || 24;
          return (
            <View key={i} style={{
              flexDirection: 'row', alignItems: 'center', gap: 10,
              paddingVertical: 9, paddingHorizontal: 12, borderRadius: 12,
              borderWidth: isActive ? 1.5 : 1,
              borderColor: isActive ? p.color + '70' : 'rgba(255,255,255,0.06)',
              backgroundColor: isActive ? p.color + '12' : 'rgba(255,255,255,0.02)',
            }}>
              <View style={{ width: 3, height: 28, borderRadius: 2, backgroundColor: p.color, opacity: isActive ? 1 : 0.35 }} />
              <Text style={{ fontSize: 14, opacity: isActive ? 1 : 0.5 }}>{p.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: isActive ? p.color : 'rgba(255,255,255,0.50)' }}>
                  {p.label}
                </Text>
                <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.28)', fontWeight: '600', marginTop: 1 }}>
                  {fmt12H(p.start % 24)} → {fmt12H(p.end % 24)}  ·  {Math.round(dur)}h
                </Text>
              </View>
              {isActive && (
                <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99, backgroundColor: p.color + '25', borderWidth: 1, borderColor: p.color + '55' }}>
                  <Text style={{ fontSize: 7, color: p.color, fontWeight: '900', letterSpacing: 0.8 }}>NOW</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── CARD 3: Etymology & Sun ───────────────────────────────────────────────────
function Card3Etym({ period, accent }: { period: DoshaPeriod; accent: string }) {
  const x = PERIOD_EXTENDED[period.id];
  if (!x) return null;

  return (
    <View style={S.card}>
      <Text style={S.cardLabel}>ETYMOLOGY & ORIGIN</Text>

      {x.etymParts.slice(0, 2).map((e, i) => (
        <View key={i} style={[S.infoBox, { borderColor: 'rgba(255,255,255,0.07)', backgroundColor: 'rgba(255,255,255,0.03)', marginBottom: 10 }]}>
          <Text style={{ fontSize: 13, fontWeight: '900', color: accent, marginBottom: 4 }}>{e.term}</Text>
          <Text style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)', lineHeight: 17 }}>{e.breakdown}</Text>
        </View>
      ))}

      <View style={[S.infoBox, { borderColor: '#fbbf2430', backgroundColor: '#fbbf2408', marginBottom: 12 }]}>
        <Text style={{ fontSize: 9, color: '#fbbf24', fontWeight: '900', letterSpacing: 1.2, marginBottom: 6 }}>☀️  SUN CONNECTION</Text>
        <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.70)', lineHeight: 18, fontWeight: '500' }}>{x.sunPosition}</Text>
      </View>

      <View style={{ borderLeftWidth: 3, borderLeftColor: accent + '55', paddingLeft: 14, paddingVertical: 4 }}>
        <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.48)', lineHeight: 17, fontStyle: 'italic', marginBottom: 5 }}>"{x.classicalRef.text}"</Text>
        <Text style={{ fontSize: 9, color: accent, fontWeight: '800', letterSpacing: 0.5 }}>— {x.classicalRef.source}</Text>
      </View>
    </View>
  );
}

// ── CARD 4: Body Systems ──────────────────────────────────────────────────────
function Card4BodySystems({ period, accent }: { period: DoshaPeriod; accent: string }) {
  const w = WELLNESS[period.id];
  const x = PERIOD_EXTENDED[period.id];
  if (!w) return null;

  const now = new Date();
  const timeStr = `${String(now.getHours() % 12 || 12).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')} ${now.getHours() < 12 ? 'AM' : 'PM'}`;

  return (
    <View style={S.card}>
      <Text style={S.cardLabel}>YOUR BODY AT {timeStr}</Text>

      {/* Hero science box */}
      <View style={[S.infoBox, { borderColor: accent + '35', backgroundColor: accent + '0C', alignItems: 'center', marginBottom: 12 }]}>
        <Text style={{ fontSize: 32, marginBottom: 6 }}>{period.sciEmoji}</Text>
        <Text style={{ fontSize: 15, fontWeight: '900', color: accent, textAlign: 'center', lineHeight: 21, marginBottom: 6 }}>{period.sciTitle}</Text>
        <Text style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.62)', lineHeight: 18, textAlign: 'center' }}>{period.sciDesc}</Text>
      </View>

      {/* System tags */}
      {x?.systemTags && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {x.systemTags.map((tag, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: (SYS_COLOR[tag] ?? accent) + '18', borderColor: (SYS_COLOR[tag] ?? accent) + '35' }}>
              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: SYS_COLOR[tag] ?? accent, marginRight: 4 }} />
              <Text style={{ fontSize: 8, color: SYS_COLOR[tag] ?? accent, fontWeight: '800' }}>{tag}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Top 3 bullets */}
      <Text style={{ fontSize: 8, color: 'rgba(255,255,255,0.28)', fontWeight: '900', letterSpacing: 1.6, marginBottom: 8 }}>HAPPENING INSIDE</Text>
      {w.bodyBullets.slice(0, 3).map((b, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 9 }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, marginTop: 6, flexShrink: 0, backgroundColor: b.dot }} />
          <Text style={{ flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.72)', lineHeight: 18 }}>{b.text}</Text>
        </View>
      ))}
    </View>
  );
}

// ── CARD 5: Circadian Science ─────────────────────────────────────────────────
function Card5CircSci({ period, accent }: { period: DoshaPeriod; accent: string }) {
  const w = WELLNESS[period.id];
  const x = PERIOD_EXTENDED[period.id];
  if (!w) return null;

  return (
    <View style={S.card}>
      <Text style={S.cardLabel}>SCIENCE SAYS</Text>

      <View style={[S.infoBox, { borderColor: accent + '28', backgroundColor: accent + '08', marginBottom: 14 }]}>
        <Text style={{ fontSize: 9, color: accent, fontWeight: '900', letterSpacing: 1.2, marginBottom: 8 }}>MODERN CHRONOBIOLOGY</Text>
        <Text style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.68)', lineHeight: 20 }}>{w.modernBrief}</Text>
      </View>

      {x?.circadianSci && (
        <View style={[S.infoBox, { borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.03)' }]}>
          <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.30)', fontWeight: '900', letterSpacing: 1.2, marginBottom: 8 }}>DEEP SCIENCE</Text>
          <Text style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.58)', lineHeight: 18 }}>{x.circadianSci}</Text>
        </View>
      )}
    </View>
  );
}

// ── CARD 6: Elements ──────────────────────────────────────────────────────────
function Card6Elements({ period, accent }: { period: DoshaPeriod; accent: string }) {
  const w = WELLNESS[period.id];
  const x = PERIOD_EXTENDED[period.id];
  if (!w || !x) return null;

  const ELEMENT_CHIPS: Record<string, string[]> = {
    'Air (Vayu)':     ['Neural Signals', 'ANS', 'Breath'],
    'Space (Akasha)': ['Synaptic Clefts', 'Gut Lumen'],
    'Fire (Agni)':    ['HCl / pH 1.5', 'Bile', 'CYP450'],
    'Water (Jala)':   ['Lymph', 'Blood Plasma', 'CSF'],
    'Earth (Prithvi)':['Bone Matrix', 'Muscle', 'Connective Tissue'],
  };

  return (
    <View style={S.card}>
      <Text style={S.cardLabel}>ELEMENTAL PHYSIOLOGY</Text>

      <View style={[S.infoBox, { borderColor: accent + '35', backgroundColor: accent + '0C', alignItems: 'center', marginBottom: 14 }]}>
        <Text style={{ fontSize: 16, fontWeight: '900', color: accent }}>
          {period.dosha.charAt(0).toUpperCase() + period.dosha.slice(1)} = {w.romanElements}
        </Text>
        <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', marginTop: 4, fontStyle: 'italic' }}>Two forces · one biological principle</Text>
      </View>

      {w.elements.map((el, i) => {
        const chips = ELEMENT_CHIPS[el.name] ?? [];
        return (
          <View key={i} style={[S.infoBox, { borderColor: accent + '22', backgroundColor: accent + '07', marginBottom: 10 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <Text style={{ fontSize: 22 }}>{el.emoji}</Text>
              <View>
                <Text style={{ fontSize: 13, fontWeight: '900', color: accent }}>{el.name}</Text>
                <Text style={{ fontSize: 8, color: 'rgba(255,255,255,0.28)', fontWeight: '700', letterSpacing: 0.8 }}>VEDIC ELEMENT</Text>
              </View>
            </View>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.60)', lineHeight: 16, marginBottom: 8 }}>
              {el.desc}{el.italic ? ` ${el.italic}` : ''}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
              {chips.map((c, j) => (
                <View key={j} style={{ borderRadius: 7, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 3, backgroundColor: accent + '18', borderColor: accent + '30' }}>
                  <Text style={{ fontSize: 9, fontWeight: '800', color: accent }}>{c}</Text>
                </View>
              ))}
            </View>
          </View>
        );
      })}

      <View style={{ borderLeftWidth: 3, borderLeftColor: accent + '55', paddingLeft: 12, paddingVertical: 4 }}>
        <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 17, fontStyle: 'italic' }}>{x.elementCombined}</Text>
      </View>
    </View>
  );
}

// ── CARD 7: Do This Now ───────────────────────────────────────────────────────
function Card7DoNow({ period, accent }: { period: DoshaPeriod; accent: string }) {
  const w = WELLNESS[period.id];
  if (!w) return null;

  return (
    <View style={S.card}>
      <Text style={S.cardLabel}>YOUR PROTOCOL</Text>

      <View style={[S.infoBox, { borderColor: '#34d39930', backgroundColor: '#34d3990A', marginBottom: 14 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#34d39920', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 13, color: '#34d399', fontWeight: '900' }}>✓</Text>
          </View>
          <Text style={{ fontSize: 11, fontWeight: '900', color: '#34d399', letterSpacing: 1.5 }}>DO THIS NOW</Text>
        </View>
        {w.doItems.slice(0, 4).map((item, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: '#34d39914', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 18 }}>{item.emoji}</Text>
            </View>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.78)', fontWeight: '600', flex: 1, lineHeight: 18 }}>{item.text}</Text>
          </View>
        ))}
      </View>

      <View style={{ borderLeftWidth: 3, borderLeftColor: accent + '55', paddingLeft: 14 }}>
        <Text style={{ fontSize: 10, color: accent, fontWeight: '800', letterSpacing: 0.8, marginBottom: 5 }}>KĀLA AS MEDICINE</Text>
        <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 17, fontStyle: 'italic' }}>Right action at the right time requires 10% of the effort. This is Kāla Cikitsā — time as the primary physician.</Text>
      </View>
    </View>
  );
}

// ── CARD 7b: Avoid Now ────────────────────────────────────────────────────────
function Card7bAvoidNow({ period, accent }: { period: DoshaPeriod; accent: string }) {
  const w = WELLNESS[period.id];
  if (!w) return null;

  return (
    <View style={S.card}>
      <Text style={S.cardLabel}>AVOID THIS NOW</Text>

      <View style={[S.infoBox, { borderColor: '#f43f5e28', backgroundColor: '#f43f5e08', marginBottom: 18 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#f43f5e20', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 12, color: '#f43f5e', fontWeight: '900' }}>✕</Text>
          </View>
          <Text style={{ fontSize: 11, fontWeight: '900', color: '#f43f5e', letterSpacing: 1.5 }}>AVOID THIS NOW</Text>
        </View>
        {w.avoidItems.slice(0, 4).map((item, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: '#f43f5e14', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 18 }}>{item.emoji}</Text>
            </View>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.78)', fontWeight: '600', flex: 1, lineHeight: 18 }}>{item.text}</Text>
          </View>
        ))}
      </View>

      {/* Body bullets 4-5 if any */}
      {w.bodyBullets.length > 3 && (
        <>
          <Text style={{ fontSize: 8, color: 'rgba(255,255,255,0.28)', fontWeight: '900', letterSpacing: 1.6, marginBottom: 10 }}>ALSO HAPPENING IN YOUR BODY</Text>
          {w.bodyBullets.slice(3, 5).map((b, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, marginTop: 6, flexShrink: 0, backgroundColor: b.dot }} />
              <Text style={{ flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.68)', lineHeight: 17 }}>{b.text}</Text>
            </View>
          ))}
        </>
      )}
    </View>
  );
}

// ── CARD 8: Nāda + Wellness Portal ────────────────────────────────────────────
function Card8Naad({ period, accent, onNaad, onDeepDive, onWellness }: {
  period: DoshaPeriod; accent: string;
  onNaad: () => void; onDeepDive: () => void; onWellness: () => void;
}) {
  const w = WELLNESS[period.id];
  const NAAD_ICONS: Record<string, string> = {
    morning_birds: '🐦', spring_birds: '🌸', forest_breeze: '🌳', morning_flute: '🎶',
    sitar: '🎸', hz_432: '🔔', singing_bowl: '🔮', indian_beats: '🥁',
    sitar_tabla_bells: '🎵', flowing_water: '💧', gentle_wind: '🌬️', sea_waves: '🌊',
    wanderlust: '🌬️', spiritual_journey: '🌌', tibetan_bowl: '🫙', tibetan_dreams: '🧘',
    night_forest: '🦗', reincarnation_tones: '♾️', night_jungle_chiangmai: '🦟',
  };
  const NAAD_NAMES: Record<string, string> = {
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
    <View style={S.card}>
      <Text style={S.cardLabel}>DEEPEN THIS PERIOD</Text>

      {/* Nāda box */}
      <View style={[S.infoBox, { borderColor: accent + '28', backgroundColor: accent + '09', alignItems: 'center', marginBottom: 12 }]}>
        <Text style={{ fontSize: 28, marginBottom: 4 }}>🎵</Text>
        <Text style={{ fontSize: 17, fontWeight: '900', color: accent, marginBottom: 5 }}>Nāda Cikitsā</Text>
        <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.52)', lineHeight: 17, textAlign: 'center', marginBottom: 10 }}>
          Sound as medicine — frequencies aligned to {period.dosha.charAt(0).toUpperCase() + period.dosha.slice(1)}.
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, justifyContent: 'center', marginBottom: 10 }}>
          {(w?.naadSounds ?? []).slice(0, 4).map((id, i) => (
            <TouchableOpacity key={i} onPress={onNaad} activeOpacity={0.70}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: accent + '45', backgroundColor: accent + '14' }}>
              <Text style={{ fontSize: 14 }}>{NAAD_ICONS[id] ?? '🎵'}</Text>
              <Text style={{ fontSize: 10, fontWeight: '700', color: accent }}>{NAAD_NAMES[id] ?? id}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity onPress={onNaad} activeOpacity={0.82}
          style={{ borderRadius: 14, paddingVertical: 13, paddingHorizontal: 24, alignItems: 'center', backgroundColor: accent }}>
          <Text style={{ fontSize: 13, fontWeight: '900', color: '#FFFFFF' }}>🎵  Open Nāda Sounds</Text>
        </TouchableOpacity>
      </View>

      {/* Explore buttons */}
      <TouchableOpacity onPress={onDeepDive} activeOpacity={0.80}
        style={[S.portalRow, { borderColor: accent + '45', marginBottom: 8 }]}>
        <LinearGradient colors={[accent + '18', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFillObject} />
        <Text style={{ fontSize: 20 }}>📊</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, color: accent, fontWeight: '800' }}>My {period.englishLabel} — Full Science</Text>
          <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>Sun clock · Protocol · Deep dive</Text>
        </View>
        <Text style={{ fontSize: 16, color: accent }}>→</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onWellness} activeOpacity={0.80}
        style={[S.portalRow, { borderColor: '#34d39945' }]}>
        <LinearGradient colors={['#34d39918', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFillObject} />
        <Text style={{ fontSize: 20 }}>🌿</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, color: '#34d399', fontWeight: '800' }}>Āyurveda Wellness Guide</Text>
          <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>All doshas · Daily routine · Activities</Text>
        </View>
        <Text style={{ fontSize: 16, color: '#34d399' }}>→</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── MAIN MODAL ─────────────────────────────────────────────────────────────────
export default function MetabolicStoryModal({
  period, solarTimes, onClose,
}: {
  period: DoshaPeriod; solarTimes: SolarTimes | null; onClose: () => void;
}) {
  const router = useRouter();
  const [card, setCard] = useState(0);

  // 10 cards: 0=Western, 0b=Analogy, 1=Dashboard, 2=Clock, 3=Etym,
  //           4=BodySys, 5=CircSci, 6=Elements, 7=DoNow, 7b=Avoid, 8=Nāda
  const TOTAL = 11;
  const accent = DOSHA_COLOR[period.dosha] ?? '#60a5fa';

  const nowH = new Date().getHours() + new Date().getMinutes() / 60;

  const goNext = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (card < TOTAL - 1) setCard(c => c + 1);
    else onClose();
  }, [card, onClose]);

  const goPrev = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (card > 0) setCard(c => c - 1);
    else onClose();
  }, [card, onClose]);

  const handleNaad = useCallback(() => {
    onClose();
    setTimeout(() => router.push('/(tabs)/sleep' as never), 400);
  }, [router, onClose]);

  const handleDeepDive = useCallback(() => {
    onClose();
    setTimeout(() => router.push({
      pathname: '/metabolic-period' as never,
      params: { periodId: period.id, periodStart: period.startLabel, periodEnd: period.endLabel, minutesRemaining: String(period.minutesRemaining) },
    } as never), 400);
  }, [router, onClose, period]);

  const handleWellness = useCallback(() => {
    onClose();
    setTimeout(() => router.push({
      pathname: '/ayurvedic-wellness' as never,
      params: { periodId: period.id, periodStart: period.startLabel, periodEnd: period.endLabel, minutesRemaining: String(period.minutesRemaining) },
    } as never), 400);
  }, [router, onClose, period]);

  // Ultra-premium iOS dark mode
  const bgColors = ['#000000', '#0a0a0a'];

  const LABELS = [
    '◉  LIVE DASHBOARD',
    '⏰  BODY CLOCK',
    `${period.emoji}  WHAT'S HAPPENING`,
    '💬  THE ANALOGY',
    '✦  ETYMOLOGY',
    '🫀  BODY SYSTEMS',
    '🔬  SCIENCE',
    '⬡  ELEMENTS',
    '✓  DO THIS NOW',
    '✕  AVOID NOW',
    '🎵  SOUNDS & EXPLORE',
  ];

  return (
    <Modal visible animationType="fade" transparent statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.screen}>
        {/* Pure black background for OLED screens */}
        <View style={StyleSheet.absoluteFillObject} backgroundColor="#000000" />
        
        {/* Subtle top glow based on dosha color */}
        <LinearGradient colors={[accent + '40', 'transparent']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.6 }} style={StyleSheet.absoluteFillObject} pointerEvents="none" />
        
        {/* Elegant top progress bar */}
        <View style={styles.progressRow}>
          {Array.from({ length: TOTAL }).map((_, i) => (
            <View key={i} style={[styles.progressSeg, {
              backgroundColor: i < card ? '#FFFFFF' : i === card ? '#FFFFFF' : 'rgba(255,255,255,0.25)',
              opacity: i < card ? 0.6 : i === card ? 1 : 1,
            }]} />
          ))}
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerLabel, { color: accent }]} numberOfLines={1}>{LABELS[card]}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }} style={styles.closeBtn}>
            <Text style={styles.closeTxt}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Card — fills remaining space, no scroll */}
        <View style={{ flex: 1, justifyContent: 'center' }}>
          {card === 0  && <Card1Dashboard    period={period} accent={accent} />}
          {card === 1  && <Card2BodyClock    period={period} solarTimes={solarTimes} accent={accent} />}
          {card === 2  && <Card0Western      period={period} accent={accent} />}
          {card === 3  && <Card0bAnalogy     period={period} accent={accent} />}
          {card === 4  && <Card3Etym         period={period} accent={accent} />}
          {card === 5  && <Card4BodySystems  period={period} accent={accent} />}
          {card === 6  && <Card5CircSci      period={period} accent={accent} />}
          {card === 7  && <Card6Elements     period={period} accent={accent} />}
          {card === 8  && <Card7DoNow        period={period} accent={accent} />}
          {card === 9  && <Card7bAvoidNow    period={period} accent={accent} />}
          {card === 10 && <Card8Naad period={period} accent={accent} onNaad={handleNaad} onDeepDive={handleDeepDive} onWellness={handleWellness} />}
        </View>

        {/* Tap zones — left = back, right = forward */}
        <View pointerEvents="box-none" style={styles.tapZones}>
          <TouchableOpacity style={{ flex: 2 }} activeOpacity={0.01} onPress={goPrev} />
          <TouchableOpacity style={{ flex: 3 }} activeOpacity={0.01} onPress={goNext} />
        </View>

        {/* Nav bar */}
        <View style={styles.navBar}>
          <TouchableOpacity onPress={goPrev} disabled={card === 0} style={[styles.navBtn, { opacity: card > 0 ? 1 : 0.22 }]}>
            <Text style={styles.navBtnTxt}>←  Back</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
            {Array.from({ length: TOTAL }).map((_, i) => (
              <TouchableOpacity key={i} onPress={() => setCard(i)}>
                <View style={{ width: i === card ? 16 : 4, height: 4, borderRadius: 2, backgroundColor: i === card ? accent : '#FFFFFF20' }} />
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

// ── Shared card layout ─────────────────────────────────────────────────────────
const S = StyleSheet.create({
  card: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 20,
    justifyContent: 'center',
  },
  cardLabel: {
    fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.45)',
    letterSpacing: 2.5, marginBottom: 20, textAlign: 'center',
    textTransform: 'uppercase',
  },
  infoBox: {
    borderRadius: 24, borderWidth: 1, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20,
  },
  infoBoxLabel: {
    fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: '800',
    letterSpacing: 1.5, marginBottom: 8, textTransform: 'uppercase',
  },
  infoBoxText: {
    fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 22, fontWeight: '500',
  },
  activeBadge: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'center',
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 24, borderWidth: 1,
  },
  activeBadgeTxt: { fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  metricRow: {
    flexDirection: 'row', borderRadius: 20, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.04)', overflow: 'hidden',
  },
  metricCell: { flex: 1, alignItems: 'center', paddingVertical: 16 },
  metricVal: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  metricLabel: { fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: '800', letterSpacing: 1.2, marginTop: 4, textTransform: 'uppercase' },
  portalRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 20, borderWidth: 1, padding: 16, overflow: 'hidden',
  },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
  progressRow: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 55, gap: 4, position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  progressSeg: { flex: 1, height: 2.5, borderRadius: 1.5 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 75, paddingBottom: 10, gap: 10, zIndex: 10,
  },
  headerLabel: { flex: 1, fontSize: 10, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4,
  },
  closeTxt: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  tapZones: { position: 'absolute', top: 120, bottom: 100, left: 0, right: 0, flexDirection: 'row', zIndex: 5 },
  navBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingBottom: 45, paddingHorizontal: 24, paddingTop: 30,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    zIndex: 10,
  },
  navBtn: {
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.08)',
  },
  navBtnTxt: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '800' },
  navBtnAccent: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20, borderWidth: 1 },
  navBtnAccentTxt: { fontSize: 13, fontWeight: '800' },
});
