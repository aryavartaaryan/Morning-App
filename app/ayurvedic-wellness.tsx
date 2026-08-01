import React, { useRef, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Dimensions, Animated,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle } from 'react-native-svg';
import { PERIOD_TEMPLATES, getDoshaPeriods } from '../lib/ayurvedicPeriods';

const { width: W } = Dimensions.get('window');

// ── Palette ───────────────────────────────────────────────────────────────────
const DOSHA_COLOR: Record<string, string> = {
  kapha: '#F5A623',
  pitta: '#E05C3A',
  vata:  '#9B7FD4',
};
const BG = '#080C1C';
const GLASS    = 'rgba(255,255,255,0.05)';
const GLASS_BD = 'rgba(255,255,255,0.09)';

// ── Wellness data per period ─────────────────────────────────────────────────
const WELLNESS: Record<string, {
  displayName: string;
  romanElements: string;
  sunDesc: string;
  boundaryNote: string;
  elements: { name: string; emoji: string; desc: string; italic?: string }[];
  modernBrief: string;
  ayurvedaBrief: string;
  bodyBullets: { dot: string; text: string }[];
  doItems: { emoji: string; text: string }[];
  avoidItems: { emoji: string; text: string }[];
}> = {
  morning_kapha: {
    displayName: 'Kapha time',
    romanElements: 'Earth + Water',
    sunDesc: 'Active when sun is rising — 6 AM to 10 AM',
    boundaryNote: 'Pre-dawn Vata settles as Kapha rises — the first 20–30 minutes after sunrise blend both. Energy shifts from subtle to solid and grounded.',
    elements: [
      {
        name: 'Earth (Prithvi)', emoji: '🌍',
        desc: 'Your physical body mass — bones, muscles, tissues, solid structure. Not literal soil, but the principle of',
        italic: 'density and form.',
      },
      {
        name: 'Water (Jala)', emoji: '💧',
        desc: 'All fluids — blood, lymph, mucus, synovial fluid. Not drinking water alone, but the',
        italic: 'cohesion and flow principle in all of nature.',
      },
    ],
    modernBrief: 'Testosterone and GH peak 20–25% above evening baseline. Cortisol Awakening Response drives the anabolic cascade. Strength training here maximises mTOR pathway activation by 23%.',
    ayurvedaBrief: 'Kapha governs Sthira (stability), Sneha (lubrication), and Bala (strength). Morning Kapha is ideal for building the body — yoga, exercise, and grounding practices.',
    bodyBullets: [
      { dot: '#F5A623', text: 'Testosterone at its daily peak — muscle-building signals fully active' },
      { dot: '#10b981', text: 'Joints well-lubricated — synovial fluid renewed overnight' },
      { dot: '#9B7FD4', text: 'Lymphatic system actively clearing overnight metabolic waste' },
      { dot: '#60a5fa', text: 'Digestive fire (Agni) is mild — body prefers light, warm foods' },
      { dot: '#F5A623', text: 'Brain alert but calm — cortisol rising, dopamine stabilising' },
    ],
    doItems: [
      { emoji: '🧘', text: 'Yoga & Sun Salutations' },
      { emoji: '💪', text: 'Strength training' },
      { emoji: '☀️', text: 'Morning walk in sunlight' },
      { emoji: '🍵', text: 'Light nourishing breakfast' },
      { emoji: '🛢️', text: 'Abhyanga oil self-massage' },
    ],
    avoidItems: [
      { emoji: '😴', text: 'Sleeping in or daytime nap' },
      { emoji: '🍳', text: 'Heavy fried breakfast' },
      { emoji: '📱', text: 'Immediately checking phone' },
      { emoji: '☕', text: 'Excessive caffeine' },
    ],
  },
  midday_pitta: {
    displayName: 'Pitta time',
    romanElements: 'Fire + Water',
    sunDesc: 'Active when sun is highest — 10 AM to 2 PM',
    boundaryNote: 'Kapha winds down as Pitta ignites — the 10:00–10:30 AM transition blends both. Digestive fire ramps up rapidly through mid-morning.',
    elements: [
      {
        name: 'Fire (Agni)', emoji: '🔥',
        desc: 'Metabolic fire — all biochemical transformation. Digestion of food, liver detox, thought processing. Not a campfire, but the principle of',
        italic: 'transformation itself.',
      },
      {
        name: 'Water (Jala)', emoji: '💧',
        desc: 'Bile, digestive fluids, aqueous medium for enzymes. Every Pitta transformation is liquid fire — hydrolysis breaks molecular bonds using water.',
        italic: undefined,
      },
    ],
    modernBrief: 'Gastric acid (HCl) hits its lowest pH at 12–1 PM. Insulin sensitivity is 30% higher at noon. Core body temperature peaks at 2–3 PM. Best window for your largest meal.',
    ayurvedaBrief: 'Pitta governs Pachana (digestion), Tejas (metabolic fire), and Buddhi (intellect). Noon is Madhyahna Bhojana — your largest meal belongs here without exception.',
    bodyBullets: [
      { dot: '#E05C3A', text: 'Digestive enzymes (HCl, bile, pepsin) at daily maximum — full metabolic power' },
      { dot: '#10b981', text: 'Insulin sensitivity 30% higher — best glucose and nutrient absorption' },
      { dot: '#fbbf24', text: 'Core temperature peaking — feel warm, energised, and cognitively sharp' },
      { dot: '#60a5fa', text: 'Liver CYP450 detox enzymes highly active — clearing metabolic waste' },
      { dot: '#E05C3A', text: 'Cognitive performance peak — ideal for decisions, deep work, learning' },
    ],
    doItems: [
      { emoji: '🍱', text: 'Main and largest meal of the day' },
      { emoji: '🧠', text: 'Deep focused cognitive work' },
      { emoji: '📋', text: 'Decision-making and strategy' },
      { emoji: '📚', text: 'Learning new material' },
      { emoji: '🤝', text: 'Important meetings and negotiations' },
    ],
    avoidItems: [
      { emoji: '🚫', text: 'Skipping or delaying lunch' },
      { emoji: '🌶️', text: 'Excessive spicy or fried food' },
      { emoji: '😤', text: 'Anger, conflict and arguments' },
      { emoji: '💻', text: 'Overworking without breaks' },
    ],
  },
  midday_pitta_late: {
    displayName: 'Energy Dip',
    romanElements: 'Fire + Water',
    sunDesc: 'Active as sun crosses zenith — 12 PM to 2 PM',
    boundaryNote: 'The digestive fire is fully engaged. As blood pools in the digestive tract, cognitive sharpness naturally dips.',
    elements: [
      {
        name: 'Fire (Agni)', emoji: '🔥',
        desc: 'Metabolic fire — focused entirely on digestion and assimilation. The principle of',
        italic: 'internal transformation.',
      },
      {
        name: 'Water (Jala)', emoji: '💧',
        desc: 'Bile, digestive fluids, aqueous medium for enzymes. Transformation through the medium of water.',
      },
    ],
    modernBrief: 'Post-prandial somnolence (food coma) occurs as parasympathetic tone increases. Blood flows to the gut (splanchnic circulation). A natural circadian dip begins.',
    ayurvedaBrief: 'Digestion requires immense energy. Pitta focuses inward. Pushing for high cognitive output now causes stress.',
    bodyBullets: [
      { dot: '#E05C3A', text: 'Digestive system is at peak workload' },
      { dot: '#60a5fa', text: 'Parasympathetic nervous system activates for "rest & digest"' },
      { dot: '#f87171', text: 'Blood flow diverted from brain to gut' },
      { dot: '#fbbf24', text: 'Core temperature slightly elevated from digestion' },
      { dot: '#9B7FD4', text: 'Natural mild drowsiness or "energy dip"' },
    ],
    doItems: [
      { emoji: '🚶', text: 'Light walking to aid digestion' },
      { emoji: '🧘', text: 'Rest and digest' },
      { emoji: '📋', text: 'Low-cognitive routine tasks' },
      { emoji: '🍵', text: 'Warm water or digestive tea' },
    ],
    avoidItems: [
      { emoji: '🧠', text: 'Deep focused cognitive work' },
      { emoji: '🏃', text: 'Intense physical exertion' },
      { emoji: '☕', text: 'Excessive caffeine to fight the dip' },
      { emoji: '😤', text: 'High-stakes decision making' },
    ],
  },
  afternoon_vata: {
    displayName: 'Vata time',
    romanElements: 'Air + Space',
    sunDesc: 'Active as sun descends — 2 PM to 6 PM',
    boundaryNote: 'Pitta winds down, Vata takes over — energy may dip briefly (~2–3 PM dip is Vata entering). Creativity and restlessness both rise.',
    elements: [
      {
        name: 'Air (Vayu)', emoji: '🌬️',
        desc: 'Nerve impulses, breath, all movement. O\u2082/CO\u2082 exchange and neural signals at 70–120 m/s. The principle of',
        italic: 'movement and direction.',
      },
      {
        name: 'Space (Akasha)', emoji: '✨',
        desc: 'Synaptic clefts, hollow channels, extracellular space. The room in which all signals travel — the principle of',
        italic: 'openness and potential.',
      },
    ],
    modernBrief: 'Post-lunch cortisol dip, circadian alertness trough at 2–3 PM. Serotonin synthesis peaks later in afternoon. Motor coordination sharpens by 4–5 PM — athletic peak.',
    ayurvedaBrief: 'Vata governs movement, breath, nerve impulses, and creativity. Afternoon Vata is perfect for creative work, gentle movement, and communication.',
    bodyBullets: [
      { dot: '#F5A623', text: 'Blood sugar stabilising after lunch — mild energy dip possible at 2–3 PM' },
      { dot: '#10b981', text: 'Lung capacity and aerobic performance peak — best for cardio at 4–5 PM' },
      { dot: '#9B7FD4', text: 'Nervous system sensitivity high — heightened perception and creativity' },
      { dot: '#60a5fa', text: 'Elimination (bowel and kidney) movement active' },
      { dot: '#F5A623', text: 'Joints well-lubricated through the day — risk of Vata-type injuries if overexerted' },
    ],
    doItems: [
      { emoji: '🎨', text: 'Creative work — art, writing, music' },
      { emoji: '🚴', text: 'Cardio, cycling, outdoor sports' },
      { emoji: '🗣️', text: 'Meetings, teaching, communication' },
      { emoji: '🍵', text: 'Light herbal tea or snack' },
      { emoji: '🌿', text: 'Nature walk, grounding activities' },
    ],
    avoidItems: [
      { emoji: '📲', text: 'Excessive stimulation and multitasking' },
      { emoji: '🍕', text: 'Heavy or late afternoon meal' },
      { emoji: '😰', text: 'High-stress decisions — mind is restless' },
      { emoji: '😴', text: 'Long naps — disrupts night sleep' },
      { emoji: '🥶', text: 'Exposure to cold dry wind' },
    ],
  },
  evening_kapha: {
    displayName: 'Kapha time',
    romanElements: 'Earth + Water',
    sunDesc: 'Active when sun sets — 6 PM to 10 PM',
    boundaryNote: 'Afternoon Vata settles as evening Kapha rises — the 6 PM transition gradually calms restlessness into stability and quiet. Allow it to happen.',
    elements: [
      {
        name: 'Earth (Prithvi)', emoji: '🌍',
        desc: 'Grounding energy — body weight sinks, muscles relax, structure winds down for repair. The principle of',
        italic: 'density and rest.',
      },
      {
        name: 'Water (Jala)', emoji: '💧',
        desc: 'Fluids shifting into repair mode — lymph, CSF, cellular hydration for overnight renewal. The principle of',
        italic: 'cohesion and restoration.',
      },
    ],
    modernBrief: 'Melatonin rises as photoreceptors detect fading light. Cortisol drops to evening nadir (~100 nmol/L). Core temperature begins 1°C nightly descent. Blue light now disrupts sleep most severely.',
    ayurvedaBrief: 'Evening Kapha is the Ojas (vital essence) restoration window. Life-force is rebuilt in stillness and warmth. Rest, warmth, and gentle connection are the medicine.',
    bodyBullets: [
      { dot: '#9B7FD4', text: 'Melatonin rising — sleep-onset hormone synthesised as light fades' },
      { dot: '#10b981', text: 'Cortisol at evening low — stress response quieting naturally' },
      { dot: '#60a5fa', text: 'Core temperature descending — biological sleep signal beginning' },
      { dot: '#F5A623', text: 'Parasympathetic nervous system taking over — rest-and-digest mode active' },
      { dot: '#E05C3A', text: 'Digestive fire low — avoid heavy meals after 7 PM' },
    ],
    doItems: [
      { emoji: '🍛', text: 'Early light dinner' },
      { emoji: '👨‍👩‍👧', text: 'Family and social bonding' },
      { emoji: '🧘', text: 'Gentle yoga or stretching' },
      { emoji: '📔', text: 'Journaling and self-reflection' },
      { emoji: '🙏', text: 'Gratitude practice' },
    ],
    avoidItems: [
      { emoji: '🍽️', text: 'Heavy late dinner' },
      { emoji: '📱', text: 'Bright screen use after 8 PM' },
      { emoji: '🏃', text: 'Stimulating intense exercise' },
      { emoji: '💢', text: 'Emotionally heated conversations' },
    ],
  },
  night_pitta: {
    displayName: 'Pitta time',
    romanElements: 'Fire + Water',
    sunDesc: 'Active in deep night — 10 PM to 2 AM',
    boundaryNote: 'Evening Kapha transitions into nocturnal Pitta — repair fires ignite under deep sleep. The body burns through metabolic waste silently, invisibly, powerfully.',
    elements: [
      {
        name: 'Fire (Agni)', emoji: '🔥',
        desc: 'Liver detox, cellular repair, autophagy — the body\'s night-shift workers. Fire does not need to be seen to be burning.',
        italic: undefined,
      },
      {
        name: 'Water (Jala)', emoji: '💧',
        desc: 'CSF, lymph, Growth Hormone in blood — all fluid-based repair systems running at maximum. Transformation through the medium of water.',
        italic: undefined,
      },
    ],
    modernBrief: 'Growth Hormone peaks during slow-wave sleep (NREM Stages 3–4). Liver CYP450 detox maximally active at 1–3 AM. Cellular autophagy — the body\'s self-cleaning — runs at full capacity.',
    ayurvedaBrief: 'Nocturnal Pitta is the body rebuilding from the day. Every minute of deep sleep in this window is intensive biological repair. Sleep is not rest — it is the medicine.',
    bodyBullets: [
      { dot: '#E05C3A', text: 'Growth Hormone peaks — driving muscle repair and fat metabolism' },
      { dot: '#10b981', text: 'Liver actively detoxing metabolic waste accumulated during the day' },
      { dot: '#9B7FD4', text: 'Cellular autophagy running — cleaning damaged proteins and organelles' },
      { dot: '#60a5fa', text: 'DNA repair enzymes most active — preventing mutation accumulation' },
      { dot: '#F5A623', text: 'Core temperature at its lowest point — deepest sleep architecture active' },
    ],
    doItems: [
      { emoji: '😴', text: 'Deep uninterrupted sleep (7–8 hrs)' },
      { emoji: '🚫', text: 'Maintain the fasting window' },
      { emoji: '❄️', text: 'Cool, dark and silent bedroom' },
      { emoji: '📓', text: 'Brief journaling before sleep' },
    ],
    avoidItems: [
      { emoji: '🍽️', text: 'Eating or drinking (except water)' },
      { emoji: '📱', text: 'Blue-light and screen exposure' },
      { emoji: '☕', text: 'Stimulants — caffeine, sugar' },
      { emoji: '💭', text: 'Overthinking or emotional rumination' },
    ],
  },
  night_vata: {
    displayName: 'Vata time',
    romanElements: 'Air + Space',
    sunDesc: 'Active in pre-dawn silence — 2 AM to 6 AM',
    boundaryNote: 'Nocturnal Pitta completes repair, Vata takes over pre-dawn — the nervous system stirs, dreams deepen, then Brahma Muhurta opens 96 minutes before sunrise.',
    elements: [
      {
        name: 'Air (Vayu)', emoji: '🌬️',
        desc: 'Neural signals stirring, alpha-theta waves, the pre-dawn nervous system awakening. The principle of',
        italic: 'movement returning from stillness.',
      },
      {
        name: 'Space (Akasha)', emoji: '✨',
        desc: 'Maximum mental space and silence — subconscious most accessible. The principle of',
        italic: 'openness and receptivity.',
      },
    ],
    modernBrief: 'Alpha & theta brainwaves (8–12 Hz, 4–8 Hz) dominate pre-dawn EEG. Cortisol Awakening Response begins. BDNF (brain\'s fertiliser) elevated — neuroplasticity peaks in this window.',
    ayurvedaBrief: 'Brahma Muhurta (96–48 min before sunrise) is the most sacred window in Dinacharya. Meditation here is exponentially more potent than at any other time of day.',
    bodyBullets: [
      { dot: '#9B7FD4', text: 'Alpha-theta brainwaves peaking — deepest meditative access of the 24-hour cycle' },
      { dot: '#10b981', text: 'Cortisol Awakening Response beginning — sets the day\'s energy baseline' },
      { dot: '#60a5fa', text: 'BDNF elevated — brain most receptive to new patterns and intentions' },
      { dot: '#F5A623', text: 'Glymphatic system finalising — flushing neural waste from overnight' },
      { dot: '#9B7FD4', text: 'Subconscious-conscious boundary thinnest — Sankalpa embeds most deeply' },
    ],
    doItems: [
      { emoji: '🧘', text: 'Silent meditation and Dhyana' },
      { emoji: '📿', text: 'Mantra japa or sacred sound listening' },
      { emoji: '🌅', text: 'Sankalpa — intention setting for the day' },
      { emoji: '📖', text: 'Sacred study and scripture reading' },
      { emoji: '🌬️', text: 'Breathwork and nervous system reset' },
    ],
    avoidItems: [
      { emoji: '🍔', text: 'Heavy food or drinks' },
      { emoji: '📱', text: 'Digital media and bright screens' },
      { emoji: '🏋️', text: 'Intense physical exertion' },
      { emoji: '📢', text: 'Loud conversation or noise' },
    ],
  },
};

const NEXT_PERIOD: Record<string, string> = {
  night_vata: 'morning_kapha_early',
  morning_kapha_early: 'morning_kapha',
  morning_kapha: 'midday_pitta',
  midday_pitta: 'midday_pitta_late',
  midday_pitta_late: 'afternoon_vata',
  afternoon_vata: 'evening_kapha',
  evening_kapha: 'night_pitta',
  night_pitta: 'night_vata',
};

// ── Sun Arc SVG ───────────────────────────────────────────────────────────────
function SunArcBar() {
  const now = new Date();
  const nowH = now.getHours() + now.getMinutes() / 60;
  const t = nowH / 24;  // 0=midnight, 0.5=noon, 1=midnight

  const arcW = W - 48;
  const arcH = 54;
  const cx = arcW / 2;
  const cy = arcH + 6;
  const rx = arcW / 2 - 2;
  const ry = arcH - 4;

  // theta goes from π (left/midnight) to 0 (right/midnight) as t goes 0→1
  const theta = Math.PI * (1 - t);
  const sunX = cx + rx * Math.cos(theta);   // left at t=0, center at t=0.5, right at t=1
  const sunY = cy - ry * Math.sin(theta);   // bottom at t=0/1, top at t=0.5

  const labelXClamped = Math.max(16, Math.min(arcW - 16, sunX));

  return (
    <View style={{ marginHorizontal: 0 }}>
      {/* Dynamic "You" label + tick line tracks sun position */}
      <View style={{ height: 26, position: 'relative' }}>
        <View style={{ position: 'absolute', left: labelXClamped - 14, alignItems: 'center', width: 28 }}>
          <Text style={{ fontSize: 8, color: '#fbbf24', fontWeight: '900', letterSpacing: 0.3 }}>You</Text>
          <View style={{ width: 1.5, height: 8, backgroundColor: '#fbbf24', opacity: 0.7, marginTop: 2 }} />
        </View>
      </View>
      {/* Arc */}
      <Svg width={arcW} height={arcH + 10}>
        {/* Track arc */}
        <Path
          d={`M 2 ${cy} A ${rx} ${ry} 0 0 1 ${arcW - 2} ${cy}`}
          stroke="rgba(255,255,255,0.10)"
          strokeWidth={1.5}
          fill="none"
        />
        {/* Sun dot */}
        <Circle cx={sunX} cy={sunY} r={8} fill="#fbbf24" opacity={0.95} />
        <Circle cx={sunX} cy={sunY} r={13} fill="#fbbf24" opacity={0.15} />
      </Svg>
      {/* Bottom labels */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
        <Text style={{ fontSize: 8.5, color: '#FFFFFF40', fontWeight: '700' }}>Midnight</Text>
        <Text style={{ fontSize: 8.5, color: '#FFFFFF40', fontWeight: '700' }}>Noon</Text>
        <Text style={{ fontSize: 8.5, color: '#FFFFFF40', fontWeight: '700' }}>Midnight</Text>
      </View>
    </View>
  );
}

// ── 24-hour Timeline ──────────────────────────────────────────────────────────
function RhythmTimeline({ currentId }: { currentId: string }) {
  const defaultSolar = { sunrise: 6, sunset: 18, solarNoon: 12 };
  const now = new Date();
  const nowH = now.getHours() + now.getMinutes() / 60;
  const periods = useMemo(() => getDoshaPeriods(defaultSolar, nowH), []);
  const nextId = NEXT_PERIOD[currentId] ?? 'morning_kapha';

  const DISPLAY_ORDER = ['morning_kapha_early', 'morning_kapha', 'midday_pitta', 'midday_pitta_late', 'afternoon_vata', 'evening_kapha', 'night_pitta', 'night_vata'];

  return (
    <View style={{ gap: 0 }}>
      {DISPLAY_ORDER.map(id => {
        const p = periods.find(x => x.id === id);
        if (!p) return null;
        const isCurrent = id === currentId;
        const isNext = id === nextId;
        const color = DOSHA_COLOR[p.dosha] ?? '#FFFFFF';
        const PERIOD_LABELS: Record<string, string> = {
          morning_kapha_early: 'Kapha · Yoga & Meditation',
          morning_kapha:      'Kapha · Rise & Build',
          midday_pitta:       'Pitta · Peak Focus',
          midday_pitta_late:  'Pitta · Energy Dip',
          afternoon_vata:     'Vata · Air + Space',
          evening_kapha:      'Kapha · early evening',
          night_pitta:        'Pitta · night digestion & repair',
          night_vata:         'Vata · pre-dawn creativity & spirit',
        };
        const PERIOD_SUBLABELS: Record<string, string> = {
          morning_kapha_early:`${p.startLabel}  |  ${p.endLabel}`,
          morning_kapha:      `${p.startLabel}  |  ${p.endLabel}`,
          midday_pitta:       `${p.startLabel}  |  ${p.endLabel}`,
          midday_pitta_late:  `${p.startLabel}  |  ${p.endLabel}`,
          afternoon_vata:     `${p.startLabel}  |  ${p.endLabel}`,
          evening_kapha:      `Repeat at ${p.startLabel}`,
          night_pitta:        `Repeat ${p.startLabel} – ${p.endLabel}`,
          night_vata:         `Repeat ${p.startLabel} – ${p.endLabel}`,
        };

        return (
          <View key={id} style={[
            TL.row,
            isCurrent && { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14 },
          ]}>
            <View style={[TL.bar, { backgroundColor: color }]} />
            <View style={{ flex: 1 }}>
              <Text style={[TL.label, isCurrent && { color: '#FFFFFF' }]}>{PERIOD_LABELS[id]}</Text>
              <Text style={TL.sub}>{PERIOD_SUBLABELS[id]}</Text>
            </View>
            {isCurrent && (
              <View style={[TL.badge, { backgroundColor: color + '25', borderColor: color + '60' }]}>
                <Text style={[TL.badgeTxt, { color }]}>Now</Text>
              </View>
            )}
            {isNext && !isCurrent && (
              <View style={[TL.badge, { backgroundColor: '#FFFFFF12', borderColor: '#FFFFFF30' }]}>
                <Text style={[TL.badgeTxt, { color: '#FFFFFF70' }]}>Next</Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

// ── Animated fade-in wrapper ─────────────────────────────────────────────────
function FadeIn({ delay = 0, children }: { delay?: number; children: React.ReactNode }) {
  const op = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(14)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(op, { toValue: 1, duration: 480, delay, useNativeDriver: true }),
      Animated.timing(ty, { toValue: 0, duration: 420, delay, useNativeDriver: true }),
    ]).start();
  }, []);
  return <Animated.View style={{ opacity: op, transform: [{ translateY: ty }] }}>{children}</Animated.View>;
}

// ── Section Label ─────────────────────────────────────────────────────────────
function SectionLabel({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 26, marginBottom: 12 }}>
      <View style={{ flex: 1, height: 0.5, backgroundColor: 'rgba(255,255,255,0.10)' }} />
      <Text style={{ fontSize: 9, fontWeight: '900', color: 'rgba(255,255,255,0.30)', letterSpacing: 2 }}>{text}</Text>
      <View style={{ flex: 1, height: 0.5, backgroundColor: 'rgba(255,255,255,0.10)' }} />
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function AyurvedicWellnessScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    periodId?: string;
    periodStart?: string;
    periodEnd?: string;
    minutesRemaining?: string;
    minutesTotal?: string;
  }>();

  const periodId = params.periodId ?? 'morning_kapha';
  const tmpl = PERIOD_TEMPLATES.find(t => t.id === periodId) ?? PERIOD_TEMPLATES[1];
  const data = WELLNESS[periodId] ?? WELLNESS['morning_kapha'];
  const color = DOSHA_COLOR[tmpl.dosha] ?? '#F5A623';

  const rem = parseInt(params.minutesRemaining ?? '0', 10);
  const remStr = rem >= 60 ? `${Math.floor(rem / 60)}h ${rem % 60}m` : `${rem}m`;

  const nextId = NEXT_PERIOD[periodId] ?? 'morning_kapha';
  const nextTmpl = PERIOD_TEMPLATES.find(t => t.id === nextId) ?? PERIOD_TEMPLATES[1];
  const nextColor = DOSHA_COLOR[nextTmpl.dosha] ?? '#F5A623';
  const nextData = WELLNESS[nextId] ?? WELLNESS['morning_kapha'];

  const doshaLabel = tmpl.dosha.charAt(0).toUpperCase() + tmpl.dosha.slice(1);

  const navigateToDeeperScience = () => {
    router.push('/ayurvedic-science' as never);
  };

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <LinearGradient
        colors={[color + '32', color + '12', 'transparent']}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.38 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['transparent', 'rgba(56,189,248,0.06)', 'rgba(56,189,248,0.14)']}
        start={{ x: 0.5, y: 0.60 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: color + 'A0', zIndex: 10 }} />

      <SafeAreaView style={{ flex: 1 }}>
        {/* ── Header ── */}
        <View style={S.header}>
          <TouchableOpacity hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }} onPress={() => router.back()} style={S.backBtn}>
            <Text style={{ color: '#FFFFFF70', fontSize: 20, lineHeight: 24 }}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={S.headerSub}>BODY RHYTHM  ·  NOW</Text>
            <Text style={S.headerTitle}>Ayurvedic Wellness</Text>
          </View>
          <View style={[S.livePill, { borderColor: color + '55', backgroundColor: color + '18' }]}>
            <View style={[S.liveDot, { backgroundColor: color }]} />
            <Text style={[S.liveTxt, { color }]}>LIVE</Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 80 }}
        >
          {/* ══ HERO: Current period ══════════════════════════════════════════ */}
          <FadeIn delay={0}>
            <View style={[S.heroCard, { borderColor: color + '30' }]}>
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, backgroundColor: color + '80', borderRadius: 24 }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <View style={[S.heroIconBox, { backgroundColor: color + '20', borderWidth: 1.5, borderColor: color + '35' }]}>
                  <Text style={{ fontSize: 32 }}>{tmpl.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 9, color, fontWeight: '900', letterSpacing: 1.5, marginBottom: 4 }}>{doshaLabel.toUpperCase()} KALA</Text>
                  <Text style={[S.heroTitle, { color }]}>{data.displayName}</Text>
                  <Text style={S.heroSub}>{data.romanElements}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)' }}>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: '#FFFFFF' }}>~{remStr}</Text>
                  <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.30)', letterSpacing: 0.5, marginTop: 2 }}>REMAINING</Text>
                </View>
                <View style={{ width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.07)', alignSelf: 'center' }} />
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: '#FFFFFF' }}>{params.periodStart ?? '—'}</Text>
                  <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.30)', letterSpacing: 0.5, marginTop: 2 }}>STARTS</Text>
                </View>
                <View style={{ width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.07)', alignSelf: 'center' }} />
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: '#FFFFFF' }}>{params.periodEnd ?? '—'}</Text>
                  <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.30)', letterSpacing: 0.5, marginTop: 2 }}>ENDS</Text>
                </View>
              </View>
            </View>
            <Text style={[S.sunDesc, { borderLeftColor: color + '60' }]}>{data.sunDesc}</Text>
          </FadeIn>

          {/* ══ BOUNDARY NOTE ════════════════════════════════════════════════ */}
          <FadeIn delay={60}>
            <View style={[S.boundaryCard, { borderLeftColor: color + '70' }]}>
              <Text style={S.boundaryLabel}>Boundary note</Text>
              <Text style={S.boundaryText}>{data.boundaryNote}</Text>
            </View>
          </FadeIn>

          {/* ══ ELEMENTS ═════════════════════════════════════════════════════ */}
          <FadeIn delay={100}>
            <SectionLabel text={`WHAT'S IN ${doshaLabel.toUpperCase()}  ·  THE TWO ELEMENTS`} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {data.elements.map((el, i) => (
                <View key={i} style={[S.elementCard, { flex: 1 }]}>
                  <Text style={{ fontSize: 26, marginBottom: 8 }}>{el.emoji}</Text>
                  <Text style={S.elementName}>{el.name}</Text>
                  <Text style={S.elementDesc}>
                    {el.desc}{el.italic ? <Text style={S.elementItalic}> {el.italic}</Text> : null}
                  </Text>
                </View>
              ))}
            </View>

            {/* Pancha Mahabhutas note */}
            <View style={S.panchaNote}>
              <Text style={S.panchaText}>
                The 5 elements (Pancha Mahabhutas) are not chemical elements — they are{' '}
                <Text style={S.panchaItalic}>qualities of matter</Text>: Earth = solid, Water = liquid, Fire = energy, Air = movement, Space = void.
              </Text>
            </View>
          </FadeIn>

          {/* ══ SCIENCE + AYURVEDA ═══════════════════════════════════════════ */}
          <FadeIn delay={140}>
            <SectionLabel text={`WHAT SCIENCE + AYURVEDA SAY  ·  ${doshaLabel.toUpperCase()}`} />
            <View style={S.sciCard}>
              <View style={S.sciRow}>
                <View style={S.sciBadge}>
                  <Text style={S.sciBadgeTxt}>Modern</Text>
                </View>
                <Text style={S.sciBody}>{data.modernBrief}</Text>
              </View>
              <View style={[S.sciDivider]} />
              <View style={S.sciRow}>
                <View style={[S.sciBadge, { borderColor: color + '70', backgroundColor: color + '15' }]}>
                  <Text style={[S.sciBadgeTxt, { color }]}>Ayurveda</Text>
                </View>
                <Text style={S.sciBody}>{data.ayurvedaBrief}</Text>
              </View>
            </View>
          </FadeIn>

          {/* ══ BODY NOW ═════════════════════════════════════════════════════ */}
          <FadeIn delay={180}>
            <SectionLabel text="WHAT'S HAPPENING INSIDE YOUR BODY NOW" />
            <View style={S.bodyCard}>
              {data.bodyBullets.map((b, i) => (
                <View key={i} style={[S.bulletRow, i < data.bodyBullets.length - 1 && S.bulletBorder]}>
                  <View style={[S.bulletDot, { backgroundColor: b.dot }]} />
                  <Text style={S.bulletText}>{b.text}</Text>
                </View>
              ))}
            </View>
          </FadeIn>

          {/* ══ ACTIVITIES ═══════════════════════════════════════════════════ */}
          <FadeIn delay={220}>
            <SectionLabel text={`ACTIVITIES  ·  ALIGNED WITH ${doshaLabel.toUpperCase()} RHYTHM`} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {/* Do now */}
              <View style={[S.actCard, S.actDoCard]}>
                <View style={S.actHeader}>
                  <Text style={{ fontSize: 14 }}>✅</Text>
                  <Text style={S.actHeaderTxt}>Ideal right now</Text>
                </View>
                {data.doItems.map((item, i) => (
                  <View key={i} style={S.actItem}>
                    <Text style={{ fontSize: 13 }}>{item.emoji}</Text>
                    <Text style={S.actItemTxt}>{item.text}</Text>
                  </View>
                ))}
              </View>
              {/* Avoid */}
              <View style={[S.actCard, S.actAvoidCard]}>
                <View style={S.actHeader}>
                  <Text style={{ fontSize: 14 }}>🚫</Text>
                  <Text style={[S.actHeaderTxt, { color: '#f87171' }]}>Best to limit</Text>
                </View>
                {data.avoidItems.map((item, i) => (
                  <View key={i} style={S.actItem}>
                    <Text style={{ fontSize: 13 }}>{item.emoji}</Text>
                    <Text style={S.actItemTxt}>{item.text}</Text>
                  </View>
                ))}
              </View>
            </View>
          </FadeIn>

          {/* ══ NEXT PERIOD PREVIEW ══════════════════════════════════════════ */}
          <FadeIn delay={260}>
            <SectionLabel text="NEXT PERIOD PREVIEW" />
            <View style={[S.nextCard, { borderColor: nextColor + '30' }]}>
              <View style={[S.nextIcon, { backgroundColor: nextColor + '20' }]}>
                <Text style={{ fontSize: 22 }}>{nextTmpl.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[S.nextTitle, { color: nextColor }]}>{nextData.displayName}</Text>
                <Text style={S.nextSub}>{nextData.romanElements}  ·  {nextData.sunDesc.split('—')[1]?.trim() ?? ''}</Text>
              </View>
              <View style={[S.nextBadge, { backgroundColor: nextColor + '20', borderColor: nextColor + '50' }]}>
                <Text style={[S.nextBadgeTxt, { color: nextColor }]}>Next</Text>
              </View>
            </View>
          </FadeIn>

          {/* ══ 24-HOUR RHYTHM ═══════════════════════════════════════════════ */}
          <FadeIn delay={300}>
            <SectionLabel text="YOUR 24-HOUR BODY RHYTHM" />

            {/* Sun arc */}
            <View style={S.arcContainer}>
              <SunArcBar />
            </View>

            {/* Period list note */}
            <View style={S.periodListNote}>
              <Text style={S.periodListNoteTxt}>All 6 periods · each repeats twice in 24 hrs</Text>
            </View>

            {/* Timeline */}
            <RhythmTimeline currentId={periodId} />
          </FadeIn>

          {/* ══ AGNI SECTION ═════════════════════════════════════════════════ */}
          <FadeIn delay={340}>
            <SectionLabel text="AGNI  —  THE FIRE THAT RUNS EVERYTHING" />
            <View style={S.agniCard}>
              <View style={S.agniBadge}>
                <Text style={S.agniBadgeTxt}>Agni</Text>
              </View>
              <Text style={S.agniText}>
                <Text style={S.agniHighlight}>Agni</Text> (Fire + Air elements) is not just digestion — it symbolises{' '}
                <Text style={S.agniItalic}>all transformation</Text>: how food becomes energy, how impressions become thoughts, how breath sustains life. Modern: it maps to metabolism, mitochondrial ATP production, enzymatic activity, and neural signal processing.
              </Text>
            </View>
          </FadeIn>

          {/* ══ DEEP SCIENCE LINK ════════════════════════════════════════════ */}
          <FadeIn delay={380}>
            <TouchableOpacity onPress={navigateToDeeperScience} activeOpacity={0.75} style={S.deepCard}>
              <View style={S.deepIcon}>
                <Text style={{ fontSize: 24 }}>📘</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={S.deepTitle}>Explore complete Ayurvedic science</Text>
                <Text style={S.deepSub}>Doshas · Panchakosha · Ritucharya · Dinacharya</Text>
              </View>
              <Text style={{ fontSize: 16, color: '#FFFFFF40' }}>↗</Text>
            </TouchableOpacity>
          </FadeIn>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20,
    paddingTop: 8, paddingBottom: 14, gap: 12,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  zIndex: 100, elevation: 100,
  },
  headerSub: { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.28)', letterSpacing: 2 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.3 },
  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, borderWidth: 1,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveTxt: { fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },

  heroCard: {
    backgroundColor: GLASS, borderRadius: 24, borderWidth: 1,
    padding: 20, marginTop: 4, overflow: 'hidden',
  },
  heroIconBox: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5, lineHeight: 30 },
  heroSub: { fontSize: 11, color: 'rgba(255,255,255,0.40)', fontWeight: '600', marginTop: 4, lineHeight: 16 },
  heroTime: { fontSize: 10, color: 'rgba(255,255,255,0.30)', marginTop: 4, fontWeight: '600' },
  sunDesc: {
    fontSize: 12.5, color: 'rgba(255,255,255,0.62)', lineHeight: 19,
    borderLeftWidth: 2, paddingLeft: 14, marginTop: 14, marginBottom: 2,
  },

  boundaryCard: {
    backgroundColor: GLASS, borderRadius: 18,
    borderWidth: 1, borderColor: GLASS_BD,
    borderLeftWidth: 3, padding: 16, marginTop: 12,
  },
  boundaryLabel: { fontSize: 9, fontWeight: '900', color: 'rgba(255,255,255,0.28)', letterSpacing: 1.8, marginBottom: 6 },
  boundaryText: { fontSize: 13, color: 'rgba(255,255,255,0.78)', lineHeight: 21 },

  elementCard: {
    backgroundColor: GLASS, borderRadius: 18,
    borderWidth: 1, borderColor: GLASS_BD, padding: 16,
  },
  elementName: { fontSize: 13, fontWeight: '800', color: '#FFFFFF', marginBottom: 8, lineHeight: 18 },
  elementDesc: { fontSize: 12, color: 'rgba(255,255,255,0.52)', lineHeight: 18 },
  elementItalic: { fontStyle: 'italic', color: 'rgba(255,255,255,0.72)' },

  panchaNote: {
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 14,
    borderWidth: 1, borderColor: GLASS_BD,
    padding: 13, marginTop: 10,
  },
  panchaText: { fontSize: 11.5, color: 'rgba(255,255,255,0.45)', lineHeight: 18 },
  panchaItalic: { fontStyle: 'italic', color: 'rgba(255,255,255,0.65)' },

  sciCard: {
    backgroundColor: GLASS, borderRadius: 20,
    borderWidth: 1, borderColor: GLASS_BD, padding: 16, gap: 14,
  },
  sciRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  sciBadge: {
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 99,
    borderWidth: 1, borderColor: '#10b98155', backgroundColor: '#10b98112',
    alignSelf: 'flex-start', marginTop: 2,
  },
  sciBadgeTxt: { fontSize: 9, fontWeight: '800', color: '#10b981', letterSpacing: 0.5 },
  sciBody: { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.78)', lineHeight: 20 },
  sciDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },

  bodyCard: {
    backgroundColor: GLASS, borderRadius: 20,
    borderWidth: 1, borderColor: GLASS_BD,
  },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14 },
  bulletBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  bulletDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6, flexShrink: 0 },
  bulletText: { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.78)', lineHeight: 20 },

  actCard: { flex: 1, borderRadius: 18, borderWidth: 1, padding: 14, gap: 10 },
  actDoCard:    { backgroundColor: 'rgba(16,185,129,0.07)', borderColor: 'rgba(16,185,129,0.22)' },
  actAvoidCard: { backgroundColor: 'rgba(248,113,113,0.07)', borderColor: 'rgba(248,113,113,0.22)' },
  actHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  actHeaderTxt: { fontSize: 12, fontWeight: '800', color: '#10b981' },
  actItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  actItemTxt: { flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.72)', lineHeight: 17 },

  nextCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: GLASS, borderRadius: 20, borderWidth: 1, padding: 16,
  },
  nextIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  nextTitle: { fontSize: 16, fontWeight: '800', lineHeight: 21 },
  nextSub: { fontSize: 11, color: 'rgba(255,255,255,0.36)', marginTop: 4, lineHeight: 16 },
  nextBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, borderWidth: 1 },
  nextBadgeTxt: { fontSize: 10, fontWeight: '800' },

  arcContainer: {
    backgroundColor: GLASS, borderRadius: 20,
    borderWidth: 1, borderColor: GLASS_BD,
    padding: 18, marginBottom: 10,
  },
  periodListNote: {
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12,
    borderWidth: 1, borderColor: GLASS_BD,
    padding: 10, marginBottom: 8,
  },
  periodListNoteTxt: { fontSize: 11, color: 'rgba(255,255,255,0.36)', textAlign: 'center', fontWeight: '600' },

  agniCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    backgroundColor: GLASS, borderRadius: 20,
    borderWidth: 1, borderColor: GLASS_BD, padding: 16,
  },
  agniBadge: {
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 99,
    borderWidth: 1, borderColor: '#F5A62355', backgroundColor: '#F5A62314',
    alignSelf: 'flex-start',
  },
  agniBadgeTxt: { fontSize: 10, fontWeight: '800', color: '#F5A623' },
  agniText: { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.78)', lineHeight: 21 },
  agniHighlight: { fontWeight: '800', color: '#F5A623' },
  agniItalic: { fontStyle: 'italic' },

  deepCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: GLASS, borderRadius: 22,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    padding: 18, marginTop: 16,
  },
  deepIcon: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  deepTitle: { fontSize: 15, fontWeight: '800', color: '#FFFFFF', lineHeight: 20 },
  deepSub: { fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 4 },
});

const TL = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 13,
    borderRadius: 14,
  },
  bar: { width: 3, height: 36, borderRadius: 99 },
  label: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.62)', lineHeight: 18 },
  sub: { fontSize: 10.5, color: 'rgba(255,255,255,0.28)', marginTop: 2, fontWeight: '600' },
  badge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, borderWidth: 1,
  },
  badgeTxt: { fontSize: 9.5, fontWeight: '800' },
});
