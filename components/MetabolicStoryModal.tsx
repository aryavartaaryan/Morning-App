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
import { BlurView } from 'expo-blur';
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

// ── CARD 0: Western Explainer (Cinematic) ───────────────────────────────────
function Card0Western({ period, accent }: { period: DoshaPeriod; accent: string }) {
  const ex = WESTERN_EXPLAINER[period.id];
  if (!ex) return null;

  return (
    <View style={S.card}>
      <Text style={[S.clinicalLabel, { color: accent, marginBottom: 12 }]}>{period.startLabel} — {period.endLabel}</Text>
      <Text style={[S.heroText, { marginBottom: 16 }]}>{ex.headline}</Text>
      <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: '600', letterSpacing: 1, marginBottom: 40, textTransform: 'uppercase' }}>
        {ex.tagline}
      </Text>

      <View style={{ marginBottom: 40 }}>
        <Text style={[S.clinicalLabel, { color: 'rgba(255,255,255,0.3)', marginBottom: 16 }]}>HAPPENING NOW</Text>
        <Text style={S.subHeroText}>{ex.what}</Text>
      </View>

      <View style={{ marginBottom: 40 }}>
        <Text style={[S.clinicalLabel, { color: accent, marginBottom: 16 }]}>WHY IT MATTERS</Text>
        <Text style={S.subHeroText}>{ex.whyMatters}</Text>
      </View>

      {/* Raw Key Facts (No boxes, just sleek typography) */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.1)', paddingTop: 30 }}>
        {ex.topFact.map((f, i) => (
          <View key={i} style={{ flex: 1, paddingRight: 10 }}>
            <Text style={{ fontSize: 24, marginBottom: 12 }}>{f.icon}</Text>
            <Text style={[S.clinicalLabel, { color: accent, marginBottom: 4 }]}>{f.label}</Text>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '500' }}>{f.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── CARD 0b: Analogy card (Cinematic) ─────────────────────────────────────────
function Card0bAnalogy({ period, accent }: { period: DoshaPeriod; accent: string }) {
  const ex = WESTERN_EXPLAINER[period.id];
  if (!ex) return null;
  const s = PERIOD_SANSKRIT[period.id];

  return (
    <View style={S.card}>
      <Text style={[S.cardLabel, { marginBottom: 60 }]}>THE ANALOGY</Text>

      {/* Massive Cinematic Analogy */}
      <Text style={{ fontSize: 36, fontWeight: '300', color: '#FFFFFF', lineHeight: 46, fontStyle: 'italic', marginBottom: 80 }}>
        "{ex.analogy.replace(/^.*?\s\s/, '')}"
      </Text>

      {/* Raw Sanskrit Name */}
      {s && (
        <View style={{ marginBottom: 40, borderLeftWidth: 2, borderLeftColor: accent, paddingLeft: 20 }}>
          <Text style={[S.clinicalLabel, { color: 'rgba(255,255,255,0.3)', marginBottom: 8 }]}>AYURVEDIC TERM</Text>
          <Text style={{ fontSize: 48, fontWeight: '900', color: accent, letterSpacing: -1, marginBottom: 8 }}>{s.sanskrit}</Text>
          <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', fontStyle: 'italic' }}>"{s.meaning}"</Text>
        </View>
      )}
    </View>
  );
}

// ── CARD 1: Live Dashboard (Cinematic) ────────────────────────────────────────
function Card1Dashboard({ period, accent }: { period: DoshaPeriod; accent: string }) {
  const [pulse] = useState(new Animated.Value(1));
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.4, duration: 1500, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 1500, useNativeDriver: true })
    ])).start();
  }, [pulse]);

  const remM = period.minutesRemaining;
  const remStr = remM >= 60 ? `${Math.floor(remM / 60)}h ${remM % 60}m` : `${remM}m`;
  const durH = (period.endH - period.startH + 24) % 24 || 24;
  const durM = Math.round(durH * 60);
  const prog = Math.max(0, Math.min(1, 1 - (remM / durM)));

  return (
    <View style={[S.card, { justifyContent: 'center' }]}>
      {/* Massive floating emoji with glow */}
      <View style={{ alignItems: 'center', marginBottom: 20 }}>
        <Text style={{ fontSize: 120, textShadowColor: accent + '80', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 60 }}>{period.emoji}</Text>
      </View>
      
      {/* Cinematic Hero */}
      <Text style={[S.heroText, { textAlign: 'center', marginBottom: 16 }]}>{period.englishLabel}</Text>
      
      {/* Sleek Subtitle */}
      <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: '700', letterSpacing: 4, marginBottom: 80, textAlign: 'center', textTransform: 'uppercase' }}>
        {period.startLabel}  —  {period.endLabel}
      </Text>

      {/* Edge-to-edge Progress Line */}
      <View style={{ width: '100%', marginBottom: 50 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
          <Text style={[S.clinicalLabel, { color: 'rgba(255,255,255,0.4)' }]}>PHASE PROGRESS</Text>
          <Text style={[S.clinicalLabel, { color: accent }]}>{Math.round(prog * 100)}%</Text>
        </View>
        <View style={{ height: 2, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
          <View style={{ width: `${Math.round(prog * 100)}%` as any, height: 2, backgroundColor: accent }} />
        </View>
      </View>

      {/* Raw Data Row (No Boxes) */}
      <View style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between' }}>
        <View>
          <Text style={[S.clinicalLabel, { color: 'rgba(255,255,255,0.4)', marginBottom: 8 }]}>TIME REMAINING</Text>
          <Text style={{ fontSize: 40, fontWeight: '900', color: '#FFFFFF', letterSpacing: -1 }}>{remStr}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Animated.View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: accent, transform: [{ scale: pulse }], marginRight: 8 }} />
            <Text style={[S.clinicalLabel, { color: accent }]}>STATUS</Text>
          </View>
          <Text style={{ fontSize: 40, fontWeight: '900', color: accent, letterSpacing: -1 }}>ACTIVE</Text>
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
      <Text style={[S.cardLabel, { marginBottom: 60 }]}>YOUR 24-HOUR BODY CLOCK</Text>

      {/* Edge-to-edge Period sleek list */}
      <View style={{ gap: 0 }}>
        {PERIODS_ORDERED.map((p, i) => {
          const isActive = p.id === period.id;
          return (
            <View key={i} style={{
              flexDirection: 'row', alignItems: 'center',
              paddingVertical: 14,
              opacity: isActive ? 1 : 0.3
            }}>
              <Text style={{ fontSize: 32, width: 50, textAlign: 'center' }}>{p.emoji}</Text>
              <View style={{ flex: 1, paddingLeft: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 2 }}>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: isActive ? p.color : '#FFFFFF' }}>{p.label}</Text>
                  {isActive && <Text style={{ fontSize: 9, color: p.color, fontWeight: '900', letterSpacing: 2 }}>ACTIVE</Text>}
                </View>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '600', letterSpacing: 1 }}>
                  {fmt12H(p.start % 24)} — {fmt12H(p.end % 24)}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 18, textAlign: 'center', marginTop: 40, fontStyle: 'italic', paddingHorizontal: 20 }}>
        The day splits into 6 natural phases. Each governs different biology. Ayurveda mapped this 5,000 years ago.
      </Text>
    </View>
  );
}

// ── CARD 3: Etymology & Sun (Cinematic) ───────────────────────────────────────
function Card3Etym({ period, accent }: { period: DoshaPeriod; accent: string }) {
  const x = PERIOD_EXTENDED[period.id];
  if (!x) return null;

  return (
    <View style={S.card}>
      <Text style={[S.cardLabel, { marginBottom: 60 }]}>ETYMOLOGY & ORIGIN</Text>

      {x.etymParts.slice(0, 2).map((e, i) => (
        <View key={i} style={{ marginBottom: 40 }}>
          <Text style={{ fontSize: 32, fontWeight: '900', color: accent, marginBottom: 12 }}>{e.term}</Text>
          <Text style={S.subHeroText}>{e.breakdown}</Text>
        </View>
      ))}

      <View style={{ marginBottom: 60, borderLeftWidth: 2, borderLeftColor: '#fbbf24', paddingLeft: 20 }}>
        <Text style={[S.clinicalLabel, { color: '#fbbf24', marginBottom: 12 }]}>☀️  SUN CONNECTION</Text>
        <Text style={{ fontSize: 18, color: 'rgba(255,255,255,0.9)', lineHeight: 28, fontWeight: '500' }}>{x.sunPosition}</Text>
      </View>

      <View style={{ alignItems: 'flex-start' }}>
        <Text style={{ fontSize: 15, fontWeight: '300', color: 'rgba(255,255,255,0.7)', lineHeight: 24, fontStyle: 'italic', marginBottom: 16 }}>"{x.classicalRef.text}"</Text>
        <Text style={[S.clinicalLabel, { color: accent }]}>— {x.classicalRef.source}</Text>
      </View>
    </View>
  );
}

// ── CARD 4: Body Systems (Cinematic) ──────────────────────────────────────────
function Card4BodySystems({ period, accent }: { period: DoshaPeriod; accent: string }) {
  const w = WELLNESS[period.id];
  const x = PERIOD_EXTENDED[period.id];
  if (!w) return null;

  const now = new Date();
  const timeStr = `${String(now.getHours() % 12 || 12).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')} ${now.getHours() < 12 ? 'AM' : 'PM'}`;

  return (
    <View style={S.card}>
      <Text style={[S.cardLabel, { marginBottom: 40 }]}>YOUR BODY AT {timeStr}</Text>

      {/* Cinematic Hero science section */}
      <View style={{ alignItems: 'center', marginBottom: 40 }}>
        <Text style={{ fontSize: 80, marginBottom: 20, textShadowColor: accent + '80', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 40 }}>{period.sciEmoji}</Text>
        <Text style={{ fontSize: 28, fontWeight: '900', color: accent, textAlign: 'center', lineHeight: 36, marginBottom: 16 }}>{period.sciTitle}</Text>
        <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.75)', lineHeight: 26, textAlign: 'center', fontWeight: '400' }}>{period.sciDesc}</Text>
      </View>

      {/* Raw System tags */}
      {x?.systemTags && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 60 }}>
          {x.systemTags.map((tag, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: (SYS_COLOR[tag] ?? accent) + '50', backgroundColor: (SYS_COLOR[tag] ?? accent) + '15' }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: SYS_COLOR[tag] ?? accent, marginRight: 8 }} />
              <Text style={{ fontSize: 10, color: '#FFFFFF', fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>{tag}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Edge-to-edge bullets */}
      <View>
        <Text style={[S.clinicalLabel, { color: 'rgba(255,255,255,0.4)', marginBottom: 24 }]}>HAPPENING INSIDE</Text>
        {w.bodyBullets.slice(0, 3).map((b, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 16, marginBottom: 24 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 8, flexShrink: 0, backgroundColor: b.dot }} />
            <Text style={{ flex: 1, fontSize: 16, color: 'rgba(255,255,255,0.9)', lineHeight: 24 }}>{b.text}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── CARD 5: Circadian Science (Cinematic) ─────────────────────────────────────
function Card5CircSci({ period, accent }: { period: DoshaPeriod; accent: string }) {
  const w = WELLNESS[period.id];
  const x = PERIOD_EXTENDED[period.id];
  if (!w) return null;

  return (
    <View style={S.card}>
      <Text style={[S.cardLabel, { marginBottom: 60 }]}>SCIENCE SAYS</Text>

      <View style={{ marginBottom: 60 }}>
        <Text style={[S.clinicalLabel, { color: accent, marginBottom: 16 }]}>MODERN CHRONOBIOLOGY</Text>
        <Text style={S.subHeroText}>{w.modernBrief}</Text>
      </View>

      {x?.circadianSci && (
        <View style={{ borderLeftWidth: 2, borderLeftColor: 'rgba(255,255,255,0.2)', paddingLeft: 20 }}>
          <Text style={[S.clinicalLabel, { color: 'rgba(255,255,255,0.4)', marginBottom: 16 }]}>DEEP SCIENCE</Text>
          <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', lineHeight: 24, fontStyle: 'italic' }}>{x.circadianSci}</Text>
        </View>
      )}
    </View>
  );
}

// ── CARD 6: Elements (Cinematic) ──────────────────────────────────────────────
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
      <Text style={[S.cardLabel, { marginBottom: 40 }]}>ELEMENTAL PHYSIOLOGY</Text>

      <View style={{ marginBottom: 40 }}>
        <Text style={{ fontSize: 40, fontWeight: '900', color: accent, letterSpacing: -1, marginBottom: 8 }}>
          {period.dosha.charAt(0).toUpperCase() + period.dosha.slice(1)} = {w.romanElements}
        </Text>
        <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontStyle: 'italic', letterSpacing: 0.5 }}>Two forces · one biological principle</Text>
      </View>

      {w.elements.map((el, i) => {
        const chips = ELEMENT_CHIPS[el.name] ?? [];
        return (
          <View key={i} style={{ marginBottom: 32 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 }}>
              <Text style={{ fontSize: 48 }}>{el.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 22, fontWeight: '900', color: accent, marginBottom: 4 }}>{el.name}</Text>
                <Text style={[S.clinicalLabel, { color: 'rgba(255,255,255,0.3)' }]}>VEDIC ELEMENT</Text>
              </View>
            </View>
            <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.8)', lineHeight: 24, marginBottom: 16 }}>
              {el.desc}{el.italic ? ` ` : ''}
              {el.italic && <Text style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.6)' }}>{el.italic}</Text>}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {chips.map((c, j) => (
                <View key={j} style={{ borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6, borderColor: accent + '40', backgroundColor: accent + '10' }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: accent }}>{c}</Text>
                </View>
              ))}
            </View>
          </View>
        );
      })}

      <View style={{ paddingVertical: 20 }}>
        <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 22, fontStyle: 'italic', textAlign: 'center' }}>
          {x.elementCombined}
        </Text>
      </View>
    </View>
  );
}

// ── CARD 7: Do This Now (Cinematic) ───────────────────────────────────────────
function Card7DoNow({ period, accent }: { period: DoshaPeriod; accent: string }) {
  const w = WELLNESS[period.id];
  if (!w) return null;

  return (
    <View style={S.card}>
      <Text style={[S.cardLabel, { marginBottom: 40 }]}>YOUR PROTOCOL</Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 30 }}>
        <Text style={{ fontSize: 32, color: '#34d399', fontWeight: '900' }}>✓</Text>
        <Text style={{ fontSize: 24, fontWeight: '900', color: '#34d399', letterSpacing: -0.5 }}>DO THIS NOW</Text>
      </View>

      <View style={{ gap: 24, marginBottom: 60 }}>
        {w.doItems.slice(0, 4).map((item, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <Text style={{ fontSize: 32 }}>{item.emoji}</Text>
            <Text style={{ fontSize: 18, color: 'rgba(255,255,255,0.95)', fontWeight: '500', flex: 1, lineHeight: 28 }}>{item.text}</Text>
          </View>
        ))}
      </View>

      <View style={{ alignItems: 'flex-start', borderLeftWidth: 2, borderLeftColor: accent + '60', paddingLeft: 20 }}>
        <Text style={[S.clinicalLabel, { color: accent, marginBottom: 12 }]}>KĀLA CIKITSĀ</Text>
        <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.7)', lineHeight: 24, fontStyle: 'italic' }}>
          Right action at the right time requires 10% of the effort. Time is the primary physician.
        </Text>
      </View>
    </View>
  );
}

// ── CARD 7b: Avoid Now (Cinematic) ────────────────────────────────────────────
function Card7bAvoidNow({ period, accent }: { period: DoshaPeriod; accent: string }) {
  const w = WELLNESS[period.id];
  if (!w) return null;

  return (
    <View style={S.card}>
      <Text style={[S.cardLabel, { marginBottom: 40 }]}>AVOID THIS NOW</Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 30 }}>
        <Text style={{ fontSize: 32, color: '#f43f5e', fontWeight: '900' }}>✕</Text>
        <Text style={{ fontSize: 24, fontWeight: '900', color: '#f43f5e', letterSpacing: -0.5 }}>AVOID THIS NOW</Text>
      </View>

      <View style={{ gap: 24, marginBottom: 60 }}>
        {w.avoidItems.slice(0, 4).map((item, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <Text style={{ fontSize: 32 }}>{item.emoji}</Text>
            <Text style={{ fontSize: 18, color: 'rgba(255,255,255,0.95)', fontWeight: '500', flex: 1, lineHeight: 28 }}>{item.text}</Text>
          </View>
        ))}
      </View>

      {w.bodyBullets.length > 3 && (
        <View style={{ borderLeftWidth: 2, borderLeftColor: 'rgba(255,255,255,0.1)', paddingLeft: 20 }}>
          <Text style={[S.clinicalLabel, { color: 'rgba(255,255,255,0.4)', marginBottom: 16 }]}>ALSO HAPPENING INSIDE</Text>
          {w.bodyBullets.slice(3, 5).map((b, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: i === 1 ? 0 : 16 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, marginTop: 9, flexShrink: 0, backgroundColor: b.dot }} />
              <Text style={{ flex: 1, fontSize: 16, color: 'rgba(255,255,255,0.85)', lineHeight: 24 }}>{b.text}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ── CARD 8: Nāda + Wellness Portal (Cinematic) ────────────────────────────────
function Card8Naad({ period, accent, onNaad, onDeepDive, onWellness }: {
  period: DoshaPeriod; accent: string;
  onNaad: () => void; onDeepDive: () => void; onWellness: () => void;
}) {
  const w = WELLNESS[period.id];
  const NAAD_ICONS: Record<string, string> = {
    morning_birds: '🐦', spring_birds: '🌸', forest_breeze: '🌳', morning_flute: '🎶',
    sitar: '🪕', hz_432: '🔔', singing_bowl: '🔮', indian_beats: '🥁',
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
      <Text style={[S.cardLabel, { marginBottom: 40 }]}>DEEPEN THIS PERIOD</Text>

      {/* Nāda immersive section */}
      <View style={{ alignItems: 'center', marginBottom: 60 }}>
        <Text style={{ fontSize: 80, marginBottom: 16 }}>🎵</Text>
        <Text style={{ fontSize: 32, fontWeight: '900', color: accent, marginBottom: 16, letterSpacing: -1 }}>Nāda Cikitsā</Text>
        <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.7)', lineHeight: 26, textAlign: 'center', marginBottom: 32 }}>
          Sound as medicine — specific frequencies aligned to balance {period.dosha.charAt(0).toUpperCase() + period.dosha.slice(1)}.
        </Text>
        
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 40 }}>
          {(w?.naadSounds ?? []).slice(0, 4).map((id, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, borderWidth: 1, borderColor: accent + '40', backgroundColor: accent + '10' }}>
              <Text style={{ fontSize: 18 }}>{NAAD_ICONS[id] ?? '🎵'}</Text>
              <Text style={{ fontSize: 11, fontWeight: '800', color: accent, textTransform: 'uppercase' }}>{NAAD_NAMES[id] ?? id}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity onPress={onNaad} activeOpacity={0.8}
          style={{ borderRadius: 99, paddingVertical: 20, paddingHorizontal: 48, alignItems: 'center', backgroundColor: accent, shadowColor: accent, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 20 }}>
          <Text style={{ fontSize: 16, fontWeight: '900', color: '#000000', letterSpacing: 2 }}>PLAY SOUNDS</Text>
        </TouchableOpacity>
      </View>

      {/* Explore buttons */}
      <View style={{ gap: 20 }}>
        <TouchableOpacity onPress={onDeepDive} activeOpacity={0.80} style={[S.portalRow, { borderWidth: 1 }]}>
          <Text style={{ fontSize: 32 }}>📊</Text>
          <View style={{ flex: 1, paddingLeft: 6 }}>
            <Text style={{ fontSize: 16, color: accent, fontWeight: '800', marginBottom: 4 }}>Full Science & Sun Clock</Text>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: '600' }}>Deep dive into {period.englishLabel}</Text>
          </View>
          <Text style={{ fontSize: 24, color: 'rgba(255,255,255,0.3)' }}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onWellness} activeOpacity={0.80} style={[S.portalRow, { borderWidth: 1, borderColor: '#34d39940' }]}>
          <Text style={{ fontSize: 32 }}>🌿</Text>
          <View style={{ flex: 1, paddingLeft: 6 }}>
            <Text style={{ fontSize: 16, color: '#34d399', fontWeight: '800', marginBottom: 4 }}>Āyurveda Wellness Guide</Text>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: '600' }}>Daily routine · Activities</Text>
          </View>
          <Text style={{ fontSize: 24, color: 'rgba(255,255,255,0.3)' }}>→</Text>
        </TouchableOpacity>
      </View>
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
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
        <BlurView intensity={100} tint="dark" style={styles.screen}>
          {/* Massive deep radial glow */}
          <LinearGradient colors={[accent + '55', accent + '10', 'transparent']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.8 }} style={[StyleSheet.absoluteFillObject, { opacity: 0.6 }]} pointerEvents="none" />
          
          {/* Elegant top progress bar */}
          <View style={styles.progressRow}>
            {Array.from({ length: TOTAL }).map((_, i) => (
              <View key={i} style={[styles.progressSeg, {
                backgroundColor: i < card ? '#FFFFFF' : i === card ? '#FFFFFF' : 'rgba(255,255,255,0.25)',
                opacity: i < card ? 0.7 : i === card ? 1 : 1,
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
        </BlurView>
      </View>
    </Modal>
  );
}

// ── Shared card layout ─────────────────────────────────────────────────────────
const S = StyleSheet.create({
  card: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    justifyContent: 'center',
  },
  cardLabel: {
    fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.4)',
    letterSpacing: 4, marginBottom: 20, textAlign: 'center',
    textTransform: 'uppercase', fontFamily: 'System'
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginVertical: 40,
    width: '100%',
  },
  heroText: {
    fontSize: 48,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 52,
    letterSpacing: -1.5,
  },
  subHeroText: {
    fontSize: 18,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 28,
  },
  clinicalLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  portalRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.2)', padding: 20, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 15,
  },
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  progressRow: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 55, gap: 4, position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  progressSeg: { flex: 1, height: 2.5, borderRadius: 1.5 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 24, paddingTop: 75, paddingBottom: 10, gap: 10, zIndex: 10,
  },
  headerLabel: { flex: 1, fontSize: 11, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8,
  },
  closeTxt: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  tapZones: { position: 'absolute', top: 120, bottom: 100, left: 0, right: 0, flexDirection: 'row', zIndex: 5 },
  navBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingBottom: 45, paddingHorizontal: 24, paddingTop: 30,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    zIndex: 10,
  },
  navBtn: {
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4,
  },
  navBtnTxt: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '800' },
  navBtnAccent: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  navBtnAccentTxt: { fontSize: 13, fontWeight: '800' },
});
