import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Dimensions, Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path, Ellipse, Line, G, Rect, Text as SvgText } from 'react-native-svg';

const { width: W } = Dimensions.get('window');

const BG    = '#0d0400';
const CARD  = 'rgba(255,140,30,0.06)';
const BORD  = 'rgba(255,140,30,0.13)';
const MOON  = '#60a5fa';
const SUN   = '#fbbf24';
const STAR  = '#a78bfa';
const TEAL  = '#00D4B8';
const ROSE  = '#f472b6';

function Tag({ label, color }: { label: string; color: string }) {
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, borderWidth: 1, borderColor: color + '50', backgroundColor: color + '18', alignSelf: 'flex-start' }}>
      <Text style={{ fontSize: 10, fontWeight: '800', color, letterSpacing: 0.3 }}>{label}</Text>
    </View>
  );
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 28 }} />;
}

function SectionHeader({ emoji, title, subtitle, color }: { emoji: string; title: string; subtitle: string; color: string }) {
  return (
    <View style={{ marginBottom: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <Text style={{ fontSize: 22 }}>{emoji}</Text>
        <View>
          <Text style={{ fontSize: 9, fontWeight: '900', color: color + 'AA', letterSpacing: 2.5 }}>{subtitle}</Text>
          <Text style={{ fontSize: 22, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.4 }}>{title}</Text>
        </View>
      </View>
    </View>
  );
}

// ── Solar System Diagram ────────────────────────────────────────────────────
function SolarSystemDiagram() {
  const cx = (W - 48) / 2;
  const planets = [
    { r: 22, color: '#fbbf24', label: 'Sun ☀', size: 14 },
    { r: 44, color: '#93c5fd', label: 'Moon', size: 5 },
    { r: 66, color: '#f87171', label: 'Mars', size: 5 },
    { r: 88, color: '#6ee7b7', label: 'Mercury', size: 4 },
    { r: 110, color: '#fde68a', label: 'Jupiter', size: 7 },
  ];
  return (
    <View style={{ alignItems: 'center', marginVertical: 16 }}>
      <Svg width={W - 48} height={240}>
        {planets.map((p, i) => (
          <G key={i}>
            <Circle cx={cx} cy={120} r={p.r} stroke={p.color + '20'} strokeWidth={1} fill="none" />
            <Circle cx={cx + p.r} cy={120} r={p.size} fill={p.color} opacity={0.9} />
            {i === 0 && <Circle cx={cx} cy={120} r={16} fill={p.color + '30'} />}
          </G>
        ))}
        {[0.12, 0.88].map((xf, i) => (
          <Circle key={i} cx={(W - 48) * xf} cy={i === 0 ? 20 : 220} r={1.2} fill="#FFFFFF" opacity={0.4} />
        ))}
      </Svg>
      <View style={{ flexDirection: 'row', gap: 14, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
        {planets.map((p, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: p.color }} />
            <Text style={{ fontSize: 9, color: p.color + 'CC', fontWeight: '700' }}>{p.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Moon Cycle Arc ────────────────────────────────────────────────────────
function MoonCycleArc() {
  const size = W - 48;
  const cx = size / 2;
  const cy = 80;
  const R = 60;
  const phases = [
    { angle: 180, emoji: '🌑', label: 'New Moon\n(Amavasya)', color: '#a5b4fc' },
    { angle: 225, emoji: '🌒', label: 'Waxing\nCrescent', color: '#93c5fd' },
    { angle: 270, emoji: '🌓', label: '1st Quarter\n(Ashtami)', color: '#60a5fa' },
    { angle: 315, emoji: '🌔', label: 'Gibbous', color: '#fbbf24' },
    { angle: 0,   emoji: '🌕', label: 'Full Moon\n(Purnima)', color: '#fbbf24' },
    { angle: 45,  emoji: '🌖', label: 'Waning\nGibbous', color: '#fb923c' },
    { angle: 90,  emoji: '🌗', label: 'Last\nQtr', color: '#f87171' },
    { angle: 135, emoji: '🌘', label: 'Balsamic', color: '#c084fc' },
  ];
  const toRad = (d: number) => (d * Math.PI) / 180;
  return (
    <View style={{ alignItems: 'center', marginVertical: 8 }}>
      <Svg width={size} height={170}>
        <Circle cx={cx} cy={cy} r={R} stroke="rgba(255,255,255,0.08)" strokeWidth={1.5} fill="none" />
        {phases.map((p, i) => {
          const rad = toRad(p.angle);
          const x = cx + R * Math.cos(rad);
          const y = cy + R * Math.sin(rad);
          return (
            <G key={i}>
              <Circle cx={x} cy={y} r={12} fill={p.color + '20'} stroke={p.color + '50'} strokeWidth={1} />
            </G>
          );
        })}
        <Circle cx={cx} cy={cy} r={10} fill="#fbbf2430" stroke="#fbbf2460" strokeWidth={1} />
      </Svg>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 4 }}>
        {phases.map((p, i) => (
          <View key={i} style={{ alignItems: 'center', gap: 2 }}>
            <Text style={{ fontSize: 18 }}>{p.emoji}</Text>
            <Text style={{ fontSize: 7, color: p.color, fontWeight: '700', textAlign: 'center', maxWidth: 54 }}>{p.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── 7 Planets Wheel ────────────────────────────────────────────────────────
function PlanetWheel({ todayIdx }: { todayIdx: number }) {
  const PLANETS = [
    { label: 'SUN', vedic: 'Surya', emoji: '☀️', color: '#fbbf24' },
    { label: 'MON', vedic: 'Soma', emoji: '🌙', color: '#93c5fd' },
    { label: 'TUE', vedic: 'Mangal', emoji: '🔴', color: '#f87171' },
    { label: 'WED', vedic: 'Budha', emoji: '💚', color: '#6ee7b7' },
    { label: 'THU', vedic: 'Guru', emoji: '🌟', color: '#fde68a' },
    { label: 'FRI', vedic: 'Shukra', emoji: '💗', color: '#f9a8d4' },
    { label: 'SAT', vedic: 'Shani', emoji: '🪐', color: '#a5b4fc' },
  ];
  return (
    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
      {PLANETS.map((p, i) => (
        <View key={i} style={{
          flex: 1, minWidth: 40, borderRadius: 14, borderWidth: i === todayIdx ? 1.5 : 1,
          borderColor: i === todayIdx ? p.color + 'AA' : 'rgba(255,255,255,0.08)',
          backgroundColor: i === todayIdx ? p.color + '20' : 'rgba(255,255,255,0.03)',
          padding: 10, alignItems: 'center', gap: 4,
        }}>
          <Text style={{ fontSize: 20 }}>{p.emoji}</Text>
          <Text style={{ fontSize: 9, fontWeight: '900', color: i === todayIdx ? p.color : 'rgba(255,255,255,0.40)' }}>{p.label}</Text>
          <Text style={{ fontSize: 7.5, color: i === todayIdx ? p.color + 'CC' : 'rgba(255,255,255,0.25)', fontWeight: '700' }}>{p.vedic}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Nakshatra Grid ─────────────────────────────────────────────────────────
const NAK_BRIEF = [
  { name: 'Ashwini', planet: 'Ketu', symbol: '🐴', color: '#f87171' },
  { name: 'Bharani', planet: 'Venus', symbol: '⚖️', color: '#f9a8d4' },
  { name: 'Krittika', planet: 'Sun', symbol: '🔥', color: '#fbbf24' },
  { name: 'Rohini', planet: 'Moon', symbol: '🌹', color: '#93c5fd' },
  { name: 'Mrigashira', planet: 'Mars', symbol: '🦌', color: '#f87171' },
  { name: 'Ardra', planet: 'Rahu', symbol: '⛈️', color: '#a5b4fc' },
  { name: 'Punarvasu', planet: 'Jupiter', symbol: '🏠', color: '#fde68a' },
  { name: 'Pushya', planet: 'Saturn', symbol: '🌸', color: '#a5b4fc' },
  { name: 'Ashlesha', planet: 'Mercury', symbol: '🐍', color: '#6ee7b7' },
  { name: 'Magha', planet: 'Ketu', symbol: '👑', color: '#f87171' },
  { name: 'Purva Phal.', planet: 'Venus', symbol: '🌺', color: '#f9a8d4' },
  { name: 'Uttara Phal.', planet: 'Sun', symbol: '🤝', color: '#fbbf24' },
  { name: 'Hasta', planet: 'Moon', symbol: '✋', color: '#93c5fd' },
  { name: 'Chitra', planet: 'Mars', symbol: '💎', color: '#f87171' },
  { name: 'Swati', planet: 'Rahu', symbol: '🌬️', color: '#a5b4fc' },
  { name: 'Vishakha', planet: 'Jupiter', symbol: '⚡', color: '#fde68a' },
  { name: 'Anuradha', planet: 'Saturn', symbol: '💫', color: '#a5b4fc' },
  { name: 'Jyeshtha', planet: 'Mercury', symbol: '🛡️', color: '#6ee7b7' },
  { name: 'Mula', planet: 'Ketu', symbol: '🌱', color: '#f87171' },
  { name: 'Purva Ash.', planet: 'Venus', symbol: '🌊', color: '#f9a8d4' },
  { name: 'Uttara Ash.', planet: 'Sun', symbol: '🌟', color: '#fbbf24' },
  { name: 'Shravana', planet: 'Moon', symbol: '👂', color: '#93c5fd' },
  { name: 'Dhanishtha', planet: 'Mars', symbol: '🥁', color: '#f87171' },
  { name: 'Shatabhisha', planet: 'Rahu', symbol: '💊', color: '#a5b4fc' },
  { name: 'Purva Bha.', planet: 'Jupiter', symbol: '🔱', color: '#fde68a' },
  { name: 'Uttara Bha.', planet: 'Saturn', symbol: '🐉', color: '#a5b4fc' },
  { name: 'Revati', planet: 'Mercury', symbol: '🐟', color: '#6ee7b7' },
];

function NakshatraGrid() {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {NAK_BRIEF.map((n, i) => (
        <View key={i} style={{
          width: (W - 48 - 12) / 3 - 4,
          borderRadius: 12, borderWidth: 1,
          borderColor: n.color + '30', backgroundColor: n.color + '0A',
          padding: 8, alignItems: 'center', gap: 3,
        }}>
          <Text style={{ fontSize: 16 }}>{n.symbol}</Text>
          <Text style={{ fontSize: 8.5, fontWeight: '800', color: '#FFFFFFDD', textAlign: 'center' }}>{n.name}</Text>
          <Text style={{ fontSize: 7, color: n.color + 'BB', fontWeight: '700' }}>{n.planet}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Tithi Special Days ─────────────────────────────────────────────────────
const TITHI_SPECIAL_DAYS = [
  { tithi: 'Ekadashi', num: '11', emoji: '🌿', color: '#6ee7b7', title: 'Sacred Fast · Ekadashi (11th)', desc: 'Most sacred fasting tithi. Avoid grains & beans. Autophagy (cellular self-cleaning) peaks during a 24h fast. Deep spiritual clarity, meditation & Vishnu worship.', science: 'Autophagy peaks at 16–24h fast. Gut microbiome resets. Ketones provide clean brain fuel.' },
  { tithi: 'Purnima', num: '15', emoji: '🌕', color: '#fbbf24', title: 'Full Moon · Purnima (15th)', desc: 'Maximum lunar energy. Intracranial fluid peaks. Emotional intensity is high. Express gratitude, release what no longer serves. Powerful for any spiritual practice.', science: 'Intracranial fluid pressure measurably peaks. Sleep latency increases. Serotonin–melatonin axis disrupted.' },
  { tithi: 'Amavasya', num: '30', emoji: '🌑', color: '#a5b4fc', title: 'New Moon · Amavasya (30th)', desc: 'The cosmic void. Deep rest, silent meditation, ancestor remembrance (Pitru Tarpan). Set one clear intention. Conserve energy — do not scatter it. Fasting recommended.', science: 'Geomagnetic field at monthly minimum. Melatonin peaks. Optimal for deep sleep & HPA axis reset.' },
  { tithi: 'Ashtami', num: '8', emoji: '🔱', color: '#c084fc', title: 'Durga Day · Ashtami (8th)', desc: 'Powerful Shakti energy. Durga governs transformation & fierce grace. Ideal for overcoming obstacles. Health intentions & invoking protective energy.', science: 'Mid-lunar phase — cortisol & testosterone both balanced. Immune Th1/Th2 equilibrium. Best for physical challenges.' },
  { tithi: 'Chaturdashi', num: '14', emoji: '⚡', color: '#f87171', title: 'Shiva Day · Chaturdashi (14th)', desc: 'Shiva energy — dissolution before renewal. Complete existing work. Fast lightly. Excellent for intense spiritual practice & releasing old patterns.', science: 'Pre-full-moon phase — melatonin approaching peak. Neural alpha-waves elevated. Deep contemplative states accessible.' },
  { tithi: 'Dwadashi', num: '12', emoji: '🙏', color: '#67e8f9', title: 'Break Fast Day · Dwadashi (12th)', desc: 'Day after Ekadashi — break fast gently with light sattvic food. Vishnu protection & service energy flows. Ideal for seva (selfless service).', science: 'Refeeding window: prioritise soluble fiber, probiotics. Avoid heavy proteins first 6 hours post-fast.' },
];

function TithiSpecialSection() {
  return (
    <View style={{ gap: 12 }}>
      {TITHI_SPECIAL_DAYS.map((t, i) => (
        <View key={i} style={{ borderRadius: 18, borderWidth: 1, borderColor: t.color + '40', backgroundColor: t.color + '0E', overflow: 'hidden' }}>
          <LinearGradient colors={[t.color + '18', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
          <View style={{ padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.color + '25', borderWidth: 1, borderColor: t.color + '50', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 20 }}>{t.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 7, fontWeight: '900', color: t.color, letterSpacing: 2, marginBottom: 2 }}>TITHI {t.num}</Text>
                <Text style={{ fontSize: 16, fontWeight: '900', color: '#FFFFFF' }}>{t.title}</Text>
              </View>
            </View>
            <Text style={{ fontSize: 12.5, color: '#FFFFFFCC', lineHeight: 19, fontWeight: '600', marginBottom: 10 }}>{t.desc}</Text>
            <View style={{ borderRadius: 10, borderWidth: 1, borderColor: t.color + '30', backgroundColor: 'rgba(0,0,0,0.25)', padding: 10 }}>
              <Text style={{ fontSize: 8, fontWeight: '900', color: t.color + 'AA', letterSpacing: 1.5, marginBottom: 4 }}>⚗ MODERN SCIENCE</Text>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', lineHeight: 16 }}>{t.science}</Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

// ── Vaar Science rows ──────────────────────────────────────────────────────
const VAAR_SCIENCE = [
  { day: 'Sunday',    vedic: 'Surya Vaar',  emoji: '☀️', color: '#fbbf24', focus: 'Leadership · Clarity', science: 'Cortisol Awakening Response (CAR) peaks. Vitamin D synthesis. Circadian master-clock reset via UV-A.' },
  { day: 'Monday',    vedic: 'Soma Vaar',   emoji: '🌙', color: '#93c5fd', focus: 'Intuition · Emotion',  science: 'Lunar gravity subtly modulates CSF pressure. Hypothalamus shows heightened emotional sensitivity.' },
  { day: 'Tuesday',   vedic: 'Mangal Vaar', emoji: '🔴', color: '#f87171', focus: 'Courage · Strength',  science: 'Red-light wavelengths stimulate mitochondrial ATP. Peak testosterone & adrenaline cycles documented.' },
  { day: 'Wednesday', vedic: 'Budha Vaar',  emoji: '💚', color: '#6ee7b7', focus: 'Learning · Agility',   science: 'Peak synaptic plasticity window. Dopamine receptor sensitivity highest — ideal for new neural connections.' },
  { day: 'Thursday',  vedic: 'Guru Vaar',   emoji: '🌟', color: '#fde68a', focus: 'Wisdom · Expansion',   science: 'Liver detox enzymes peak. Memory consolidation during Thursday sleep strongest in weekly cycle.' },
  { day: 'Friday',    vedic: 'Shukra Vaar', emoji: '💗', color: '#f9a8d4', focus: 'Beauty · Creativity',  science: 'Oxytocin & estrogen highest. Immune NK cell activity peaks. Sensory pleasure & creative output enhanced.' },
  { day: 'Saturday',  vedic: 'Shani Vaar',  emoji: '🪐', color: '#a5b4fc', focus: 'Discipline · Karma',   science: 'Slow-wave deep sleep (SWS) longest Friday–Saturday night. Autophagy & cellular repair maximize overnight.' },
];

// ── Body–Cosmos Section ────────────────────────────────────────────────────
const BODY_COSMOS = [
  { icon: '☀️', title: 'Sun — Fire & Transformation  ·  Agni / Pitta', color: '#fbbf24', text: 'Solar UV-B drives Vitamin D synthesis and cortisol — the body\'s daily energy budget. Ayurveda: Sun = Agni (transformative fire). CLOCK gene expression tracks the sun.' },
  { icon: '🌙', title: 'Moon — Essence & Vitality  ·  Soma / Ojas', color: '#93c5fd', text: 'Lunar gravity modulates intracranial fluid, menstrual cycles (avg 29.5 days = lunar month), and sleep. Ayurveda: Moon = Soma (vital essence, builder of tissue).' },
  { icon: '🌍', title: 'Earth — Stability & Ground  ·  Prithvi / Kapha', color: '#6ee7b7', text: 'Earth\'s Schumann resonance (7.83 Hz) entrains alpha brain waves. Grounding (bare feet on earth) reduces cortisol and inflammation markers within 20 minutes.' },
  { icon: '⭐', title: 'Stars — Space & Movement  ·  Akasha / Vata', color: '#a78bfa', text: 'Galactic cosmic rays modulate DNA repair, mutagenesis, and cloud formation on Earth. Ayurveda: stars = Akasha (space) — the field in which all motion occurs.' },
];

// ── Main Page ──────────────────────────────────────────────────────────────
export default function CosmicSciencePage() {
  const router = useRouter();
  const todayIdx = new Date().getDay();

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <LinearGradient
        colors={['rgba(251,146,60,0.55)', 'rgba(234,88,12,0.22)', BG]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 0.45 }}
      />
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={S.header}>
          <TouchableOpacity hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }} onPress={() => router.back()} style={S.backBtn}>
            <Text style={{ color: '#FFFFFF70', fontSize: 20 }}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={S.headerSup}>ASTRAL SCIENCE  ·  JYOTISH SHASTRA</Text>
            <Text style={S.headerTitle}>Astral Science</Text>
          </View>
          <View style={[S.badge, { borderColor: TEAL + '55', backgroundColor: TEAL + '15' }]}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: TEAL }} />
            <Text style={{ fontSize: 8, fontWeight: '900', color: TEAL, letterSpacing: 1 }}>LIVE</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 80 }}>

          {/* ── HERO ── */}
          <View style={{ paddingVertical: 24 }}>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
              <Tag label="🌌  Universal Science" color={MOON} />
              <Tag label="🔭  5000 Years of Data" color={SUN} />
              <Tag label="🧬  Chronobiology" color={TEAL} />
            </View>
            <Text style={{ fontSize: 32, fontWeight: '900', color: '#FFFFFF', lineHeight: 40, letterSpacing: -0.8, marginBottom: 14 }}>
              {'The cosmos moves\nthrough you.'}
            </Text>
            <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 22 }}>
              Jyotish (Vedic Astrology) is not religion — it is an empirically observed, mathematically precise system of cosmic timing, developed over 5,000 years. Like astronomy, it belongs to every human being on Earth, regardless of faith, culture, or nationality.
            </Text>
            <View style={{ marginTop: 18, borderRadius: 16, borderWidth: 1.5, borderColor: TEAL + '50', backgroundColor: TEAL + '0F', padding: 16 }}>
              <Text style={{ fontSize: 9, fontWeight: '900', color: TEAL, letterSpacing: 2, marginBottom: 8 }}>✦ UNIVERSAL DECLARATION</Text>
              <Text style={{ fontSize: 13, color: '#FFFFFFCC', lineHeight: 20, fontWeight: '600' }}>
                Astrology is a science of natural cycles — as universal and impersonal as physics, chemistry, or biology. The sky is humanity's oldest shared heritage. These patterns belong to everyone.
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <Tag label="🌍  For every human" color={TEAL} />
                <Tag label="🕌  No religion required" color={MOON} />
                <Tag label="🔬  Scientifically grounded" color={STAR} />
              </View>
            </View>
          </View>

          {/* ── SOLAR SYSTEM ── */}
          <SectionHeader emoji="☀️" title="The Solar System" subtitle="SOLAR STRUCTURE  ·  SAURA MANDALA" color={SUN} />
          <SolarSystemDiagram />
          <View style={{ borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: CARD, padding: 16, marginBottom: 8 }}>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.70)', lineHeight: 20 }}>
              <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>Panchanga</Text> — "five limbs" — five simultaneous measures of cosmic time: <Text style={{ color: TEAL }}>Tithi</Text> (lunar day), <Text style={{ color: SUN }}>Vaar</Text> (planetary day), <Text style={{ color: STAR }}>Nakshatra</Text> (Moon's star mansion), <Text style={{ color: '#34d399' }}>Yoga</Text> (Sun+Moon union), and <Text style={{ color: ROSE }}>Karana</Text> (half-tithi). Every moment is defined by all five simultaneously — like coordinates in cosmic space.
            </Text>
          </View>

          <Divider />

          {/* ── SACRED TITHIS ── */}
          <SectionHeader emoji="🌕" title="Sacred Lunar Days" subtitle="LUNAR SCIENCE  ·  TITHI VIGYAN" color={MOON} />
          <View style={{ borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: CARD, padding: 14, marginBottom: 16 }}>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 20 }}>
              The Moon's 29.5-day cycle creates 30 Tithis (lunar days). Each is a 12° elongation of the Moon from the Sun, creating measurable shifts in Earth's tidal forces, electromagnetic fields, and human biology. Several Tithis carry special cosmic significance.
            </Text>
          </View>
          <MoonCycleArc />
          <View style={{ height: 16 }} />
          <TithiSpecialSection />

          <Divider />

          {/* ── 7 VAARS ── */}
          <SectionHeader emoji="🪐" title="Seven Planetary Days" subtitle="PLANETARY RULERS  ·  SAPTA VAAR" color={SUN} />
          <View style={{ borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: CARD, padding: 14, marginBottom: 16 }}>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 20 }}>
              Each day is governed by a planet whose gravitational and electromagnetic signature subtly shifts biological rhythms. Modern chronopharmacology confirms day-of-week variation in hormone levels, drug efficacy, and immune response.
            </Text>
          </View>
          <PlanetWheel todayIdx={todayIdx} />
          <View style={{ gap: 8, marginTop: 12 }}>
            {VAAR_SCIENCE.map((v, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 14, borderWidth: 1, borderColor: i === todayIdx ? v.color + '50' : 'rgba(255,255,255,0.07)', backgroundColor: i === todayIdx ? v.color + '10' : CARD, borderLeftWidth: 3, borderLeftColor: v.color, padding: 12 }}>
                <Text style={{ fontSize: 22, width: 30 }}>{v.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <Text style={{ fontSize: 12, fontWeight: '900', color: v.color }}>{v.day}</Text>
                    <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: v.color + '15', borderWidth: 1, borderColor: v.color + '30' }}><Text style={{ fontSize: 8, fontWeight: '700', color: v.color + 'AA' }}>{v.vedic}</Text></View>
                    {i === todayIdx && <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: v.color + '30' }}><Text style={{ fontSize: 7, fontWeight: '900', color: v.color }}>TODAY</Text></View>}
                  </View>
                  <Text style={{ fontSize: 11.5, color: '#FFFFFFCC', lineHeight: 16, marginBottom: 4 }}>{v.focus}</Text>
                  <Text style={{ fontSize: 10.5, color: '#FFFFFF55', lineHeight: 15, fontStyle: 'italic' }}>⚗  {v.science}</Text>
                </View>
              </View>
            ))}
          </View>

          <Divider />

          {/* ── 27 NAKSHATRAS ── */}
          <SectionHeader emoji="⭐" title="27 Star Mansions" subtitle="LUNAR MANSIONS  ·  NAKSHATRA VIGYAN" color={STAR} />
          <View style={{ borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: CARD, padding: 14, marginBottom: 16 }}>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 20 }}>
              The zodiac is divided into 27 Nakshatras of 13.33° each. The Moon transits one nakshatra every ~27 hours. Each is a real star cluster — Rohini = Aldebaran, Chitra = Spica, Jyeshtha = Antares. Your nakshatra tunes your intuitive frequency for the day.
            </Text>
          </View>
          <NakshatraGrid />

          <Divider />

          {/* ── BODY ↔ COSMOS ── */}
          <SectionHeader emoji="🧬" title="Body & Cosmos" subtitle="YOU ARE THE UNIVERSE  ·  LOKA-PURUSHA SAMYA" color={TEAL} />
          <View style={{ borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: CARD, padding: 14, marginBottom: 16 }}>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 20 }}>
              "As in the body, so in the universe" — Yatha pinde tatha brahmande. Modern physics confirms: the atoms in your body were forged in stellar cores. You are, literally, made of stars.
            </Text>
          </View>
          <View style={{ gap: 10 }}>
            {BODY_COSMOS.map((r, i) => (
              <View key={i} style={{ borderRadius: 16, borderWidth: 1, borderColor: r.color + '30', backgroundColor: r.color + '08', borderLeftWidth: 3, borderLeftColor: r.color, padding: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <Text style={{ fontSize: 22 }}>{r.icon}</Text>
                  <Text style={{ fontSize: 14, fontWeight: '900', color: r.color }}>{r.title}</Text>
                </View>
                <Text style={{ fontSize: 12.5, color: '#FFFFFFCC', lineHeight: 19 }}>{r.text}</Text>
              </View>
            ))}
          </View>

          {/* ── FOOTER ── */}
          <View style={{ borderRadius: 20, borderWidth: 1.5, borderColor: TEAL + '40', backgroundColor: TEAL + '08', padding: 20, marginTop: 28 }}>
            <Text style={{ fontSize: 10, fontWeight: '900', color: TEAL, letterSpacing: 2, marginBottom: 10 }}>THE SCIENTIFIC FOUNDATION</Text>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.70)', lineHeight: 21 }}>
              Vedic Jyotish is grounded in precise astronomical observation developed over 5,000 years. The Panchanga calculations use real planetary positions derived from rigorous mathematical models — the same positions used by modern planetariums. This is celestial mechanics, not mysticism.
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              <Tag label="🌍  Humanity's science" color={TEAL} />
              <Tag label="📡  Astronomical precision" color={MOON} />
              <Tag label="🧬  Biologically verified" color={STAR} />
            </View>
          </View>

          {/* Back */}
          <TouchableOpacity hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }} onPress={() => router.back()} style={S.backLink}>
            <Text style={{ fontSize: 16 }}>←</Text>
            <View style={{ flex: 1 }}>
              <Text style={S.backLinkTitle}>Return to your cosmic day</Text>
              <Text style={S.backLinkSub}>Live Panchanga · astral story</Text>
            </View>
            <Text style={{ fontSize: 16, color: TEAL }}>→</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const S = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14, gap: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  backBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', zIndex: 100, elevation: 100 },
  headerSup: { fontSize: 7.5, fontWeight: '800', color: '#FFFFFF35', letterSpacing: 1.5 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.2 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, borderWidth: 1 },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: 'rgba(96,165,250,0.08)', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(96,165,250,0.28)', padding: 16, marginTop: 28 },
  backLinkTitle: { fontSize: 14, fontWeight: '900', color: '#FFFFFF', lineHeight: 20 },
  backLinkSub: { fontSize: 11, color: '#FFFFFF50', marginTop: 3 },
});
