import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path, Ellipse } from 'react-native-svg';

const { width: W } = Dimensions.get('window');

// ── Design tokens ─────────────────────────────────────────────────────────────
const BG    = '#06060F';
const CARD  = 'rgba(255,255,255,0.055)';
const BORD  = 'rgba(255,255,255,0.10)';
const MOON  = '#60a5fa';
const SUN   = '#fbbf24';
const STAR  = '#a78bfa';
const GREEN = '#6ee7b7';

// ── Tiny helpers ─────────────────────────────────────────────────────────────
function SecLabel({ text }: { text: string }) {
  return <Text style={S.secLabel}>{text}</Text>;
}
function ItalicCard({ text }: { text: string }) {
  return (
    <View style={S.italicCard}>
      <Text style={S.italicTxt}>{text}</Text>
    </View>
  );
}
function Chip({ label, color }: { label: string; color: string }) {
  return (
    <View style={[S.chip, { borderColor: color + '55', backgroundColor: color + '18' }]}>
      <Text style={[S.chipTxt, { color }]}>{label}</Text>
    </View>
  );
}
function Divider() {
  return <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginVertical: 22 }} />;
}

// ── Moon phase visual ────────────────────────────────────────────────────────
function MoonPhaseVisual({ illumination, size = 56 }: { illumination: number; size?: number }) {
  const r = size / 2;
  const lit = illumination / 100;
  const termX = r - (lit * 2 - 1) * r;
  return (
    <Svg width={size} height={size}>
      <Circle cx={r} cy={r} r={r - 1} fill="#1e1e3a" />
      <Path
        d={`M ${r} ${1} A ${r - 1} ${r - 1} 0 0 1 ${r} ${size - 1} A ${Math.abs(termX - r)} ${r - 1} 0 0 ${lit > 0.5 ? 0 : 1} ${r} ${1}`}
        fill="#e2d9c0"
        opacity={0.92}
      />
      <Circle cx={r} cy={r} r={r - 1} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
    </Svg>
  );
}

// ── Orbital rings decoration ─────────────────────────────────────────────────
function OrbitalRings() {
  const cx = (W - 40) / 2;
  return (
    <Svg width={W - 40} height={120} style={{ alignSelf: 'center', marginVertical: 8 }}>
      {/* Orbits */}
      <Ellipse cx={cx} cy={60} rx={cx * 0.95} ry={18} stroke="rgba(96,165,250,0.12)" strokeWidth={1} fill="none" />
      <Ellipse cx={cx} cy={60} rx={cx * 0.65} ry={12} stroke="rgba(251,191,36,0.14)" strokeWidth={1} fill="none" />
      <Ellipse cx={cx} cy={60} rx={cx * 0.35} ry={7}  stroke="rgba(167,139,250,0.12)" strokeWidth={1} fill="none" />
      {/* Sun center */}
      <Circle cx={cx} cy={60} r={10} fill="#fbbf24" opacity={0.85} />
      <Circle cx={cx} cy={60} r={16} fill="#fbbf24" opacity={0.08} />
      {/* Earth */}
      <Circle cx={cx + cx * 0.35} cy={60} r={5} fill="#60a5fa" opacity={0.85} />
      {/* Moon around Earth */}
      <Circle cx={cx + cx * 0.35 + 12} cy={56} r={3} fill="#e2d9c0" opacity={0.80} />
      {/* Outer planet */}
      <Circle cx={cx - cx * 0.65} cy={60} r={6} fill="#a78bfa" opacity={0.75} />
      {/* Stars */}
      {[0.12, 0.28, 0.72, 0.88].map((xf, i) => (
        <Circle key={i} cx={cx * 2 * xf} cy={i % 2 === 0 ? 18 : 102} r={1.2} fill="#FFFFFF" opacity={0.5} />
      ))}
    </Svg>
  );
}

// ── Section 1: Hero ──────────────────────────────────────────────────────────
function HeroSection() {
  return (
    <View style={{ paddingBottom: 4 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
        <Chip label="🌌  Cosmic almanac" color={MOON} />
        <Chip label="⭐  Vedic Jyotish" color={SUN} />
        <Chip label="☯  5 limbs of time" color={STAR} />
      </View>
      <Text style={S.heroTitle}>The complete map of{'\n'}cosmic time</Text>
      <Text style={S.heroBody}>
        Panchang (Pancha = five, Anga = limb) is the Vedic almanac — five simultaneous measures of time running in parallel: Tithi (lunar day), Vara (weekday), Nakshatra (moon's mansion), Yoga (Sun+Moon union), and Karana (half-tithi). Every moment is defined by all five simultaneously.
      </Text>
      <OrbitalRings />
    </View>
  );
}

// ── Section 2: The 7 Vaars (Planetary Days) ──────────────────────────────────
const VAARS_DATA = [
  { day: 'Sunday',    vedic: 'Surya Vaar',  planet: 'Sun ☀️',     color: '#fbbf24', emoji: '☀️', energy: 'Leadership · clarity · self-expression', body: 'Cortisol peaks · vitamin D synthesis · circadian master clock set' },
  { day: 'Monday',    vedic: 'Soma Vaar',   planet: 'Moon 🌙',    color: '#93c5fd', emoji: '🌙', energy: 'Intuition · emotion · inner wisdom',       body: 'Fluid balance · serotonin rhythm · gut-brain axis sensitivity' },
  { day: 'Tuesday',   vedic: 'Mangal Vaar', planet: 'Mars 🔴',    color: '#f87171', emoji: '🔴', energy: 'Courage · strength · decisive action',      body: 'Testosterone peak day · adrenaline axis · muscle recovery' },
  { day: 'Wednesday', vedic: 'Budh Vaar',   planet: 'Mercury ⚡', color: '#6ee7b7', emoji: '⚡', energy: 'Intelligence · communication · trade',       body: 'Dopamine circuits · neural signal velocity · cognitive sharpness' },
  { day: 'Thursday',  vedic: 'Guru Vaar',   planet: 'Jupiter 🟡', color: '#fde68a', emoji: '🟡', energy: 'Wisdom · expansion · spiritual growth',     body: 'Insulin regulation · liver detox · optimism neurotransmitters' },
  { day: 'Friday',    vedic: 'Shukra Vaar', planet: 'Venus 💜',   color: '#f9a8d4', emoji: '💜', energy: 'Beauty · pleasure · creativity · love',      body: 'Oxytocin release · immune modulation · sensory pleasure peak' },
  { day: 'Saturday',  vedic: 'Shani Vaar',  planet: 'Saturn 🪐',  color: '#a5b4fc', emoji: '🪐', energy: 'Discipline · karma · enduring effort',       body: 'Slow-wave sleep repair · autophagy · long-term cellular maintenance' },
];

function VaarsSection() {
  return (
    <View>
      <SecLabel text="THE 7 PLANETARY DAYS  ·  SAPTA VARA" />
      <ItalicCard text="Each day of the week is ruled by a planet — not metaphorically, but astronomically. The planet's gravitational and electromagnetic influence on Earth subtly shifts biological rhythms. Modern chronopharmacology confirms day-of-week variations in drug efficacy, hormone levels, and immune response." />
      <View style={{ gap: 8, marginTop: 14 }}>
        {VAARS_DATA.map((v, i) => (
          <View key={i} style={[S.vaarRow, { borderLeftColor: v.color }]}>
            <View style={[S.vaarIcon, { backgroundColor: v.color + '20' }]}>
              <Text style={{ fontSize: 20 }}>{v.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <Text style={[S.vaarName, { color: v.color }]}>{v.vedic}</Text>
                <Text style={S.vaarDay}>{v.day}</Text>
              </View>
              <Text style={S.vaarEnergy}>{v.energy}</Text>
              <Text style={S.vaarBody}>⚗  {v.body}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Section 3: Moon Cycle + Tithis ───────────────────────────────────────────
const MOON_PHASES = [
  { phase: 'Amavasya',        emoji: '🌑', illumination: 0,   energy: 'New Moon · deep rest · intention-setting',      modern: 'Lowest melatonin variance · fresh HPA axis reset' },
  { phase: 'Shukla Pratipada', emoji: '🌒', illumination: 5,   energy: 'New beginnings · first sprout of lunar energy',  modern: 'Serotonin beginning to rise · cellular regeneration signals' },
  { phase: 'Panchami',        emoji: '🌒', illumination: 30,  energy: 'Knowledge · learning · creativity unlocking',    modern: 'Dopamine peaks — best learning window of lunar month' },
  { phase: 'Ashtami',         emoji: '🌓', illumination: 50,  energy: 'Action · half-moon balance of building/clearing', modern: 'Cortisol balanced · immune cells balanced Th1/Th2' },
  { phase: 'Ekadashi',        emoji: '🌔', illumination: 75,  energy: 'Fasting day · purification · deepest spiritual',  modern: 'Autophagy peaks with fasting — cellular self-cleaning' },
  { phase: 'Chaturdashi',     emoji: '🌔', illumination: 90,  energy: 'Pre-full moon intensity · heightened perception',  modern: 'Max melatonin · sleep deepest · prefrontal cortex quietest' },
  { phase: 'Purnima',         emoji: '🌕', illumination: 100, energy: 'Full Moon · maximum energy · gratitude · celebration', modern: 'Intracranial fluid peaks · sleep slightly disrupted · emotional intensity' },
  { phase: 'Krishna Ashtami', emoji: '🌗', illumination: 50,  energy: 'Release · letting go · internal reflection',     modern: 'Cortisol declining · parasympathetic NS more active' },
  { phase: 'Krishna Ekadashi',emoji: '🌘', illumination: 25,  energy: 'Fasting again · purification · gratitude',       modern: 'Second autophagy window — completing monthly cell repair' },
];

function MoonCycleSection() {
  return (
    <View>
      <SecLabel text="THE MOON CYCLE  ·  TITHI  ·  LUNAR DAYS" />
      <ItalicCard text="The Moon's 29.5-day cycle governs fluid rhythms, sleep architecture, emotional intensity, and immune function. Ayurveda mapped the body's monthly repair cycle to these phases 5000 years ago. Chronobiology now confirms measurable variation in cortisol, melatonin, and intracranial fluid pressure through the lunar month." />

      {/* Phase arc visual */}
      <View style={[S.card, { padding: 16, marginTop: 14, marginBottom: 4 }]}>
        <Text style={{ fontSize: 7.5, fontWeight: '900', color: MOON, letterSpacing: 2, marginBottom: 14 }}>🌙  29.5-DAY LUNAR RHYTHM</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-end', paddingBottom: 4, paddingRight: 10 }}>
            {MOON_PHASES.map((mp, i) => (
              <View key={i} style={{ alignItems: 'center', gap: 6 }}>
                <MoonPhaseVisual illumination={mp.illumination} size={38} />
                <Text style={{ fontSize: 7.5, color: '#FFFFFF60', fontWeight: '700', maxWidth: 50, textAlign: 'center' }}>{mp.phase}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Tithi rows */}
      <View style={{ gap: 8, marginTop: 8 }}>
        {MOON_PHASES.map((mp, i) => (
          <View key={i} style={[S.tithiRow, { borderLeftColor: MOON + '80' }]}>
            <Text style={{ fontSize: 22, width: 30 }}>{mp.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[S.tithiName, { color: MOON }]}>{mp.phase}</Text>
              <Text style={S.tithiEnergy}>{mp.energy}</Text>
              <Text style={S.tithiModern}>⚗  {mp.modern}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Section 4: 27 Nakshatras ─────────────────────────────────────────────────
const NAKSHATRA_GROUPS = [
  {
    group: 'Fire group', color: '#fb923c',
    list: ['Ashwini · Ketu · initiation, healing, speed', 'Krittika · Sun · purification, focus, sharp action', 'Mrigashira · Mars · seeking, creative, restless', 'Purva Phalguni · Venus · pleasure, rest, creativity', 'Uttara Ashadha · Sun · victory, final push', 'Uttara Bhadrapada · Saturn · depth, wisdom, stillness'],
  },
  {
    group: 'Earth group', color: '#F5A623',
    list: ['Bharani · Venus · transformation, intensity', 'Rohini · Moon · fertility, beauty, sensuality', 'Hasta · Moon · skill, craftwork, precision', 'Chitra · Mars · beauty, architecture, creative fire', 'Shravana · Moon · listening, learning, devotion', 'Dhanishtha · Mars · abundance, music, ambition'],
  },
  {
    group: 'Air group', color: '#a78bfa',
    list: ['Ardra · Rahu · storms, transformation, genius', 'Swati · Rahu · independence, movement, wind', 'Vishakha · Jupiter · focus, ambition, purpose', 'Shatabhisha · Rahu · healing, mystery, research', 'Purva Bhadrapada · Jupiter · intensity, passion, fire'], 
  },
  {
    group: 'Water/Space group', color: MOON,
    list: ['Punarvasu · Jupiter · renewal, restoration, return', 'Pushya · Saturn · nourishment, protection, abundance', 'Ashlesha · Mercury · sharp mind, kundalini, secrets', 'Magha · Ketu · ancestors, royalty, authority', 'Anuradha · Saturn · friendship, devotion, success', 'Jyeshtha · Mercury · seniority, protection, power', 'Mula · Ketu · roots, destruction for renewal', 'Purva Ashadha · Venus · invincible, courage, water', 'Uttara Phalguni · Sun · union, partnership, protection', 'Revati · Mercury · completion, journeys, compassion'],
  },
];

function NakshatraSection() {
  return (
    <View>
      <SecLabel text="THE 27 NAKSHATRAS  ·  LUNAR MANSIONS" />
      <ItalicCard text="The Moon moves through one Nakshatra every ~27 hours. Each Nakshatra is a 13.3° section of the sky — a star cluster the Moon 'visits' as it orbits Earth. Modern astronomy confirms these as real star groupings (e.g., Rohini = Aldebaran, Chitra = Spica). Vedic astrology maps each one to a planetary ruler, colour, deity, and quality." />
      <View style={{ gap: 10, marginTop: 14 }}>
        {NAKSHATRA_GROUPS.map((g, i) => (
          <View key={i} style={[S.card, { padding: 14, borderColor: g.color + '30' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <View style={[S.groupDot, { backgroundColor: g.color }]} />
              <Text style={[S.groupLabel, { color: g.color }]}>{g.group}</Text>
            </View>
            {g.list.map((n, j) => (
              <View key={j} style={[S.nakRow, j < g.list.length - 1 && { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', marginBottom: 6, paddingBottom: 6 }]}>
                <View style={[S.nakDot, { backgroundColor: g.color + '80' }]} />
                <Text style={S.nakTxt}>{n}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Section 5: Sun — the master clock ────────────────────────────────────────
function SunSection() {
  const rows = [
    { icon: '🌅', label: 'Sunrise', color: SUN, text: 'Cortisol Awakening Response (CAR) triggers within minutes of first light. Sets testosterone, immunity, and energy baseline for the entire day.' },
    { icon: '🔆', label: 'Solar Zenith', color: '#fb923c', text: 'Core body temperature peaks. Digestive enzymes maximal. Cognitive performance at daily high. Best time for main meal and focused work.' },
    { icon: '🌇', label: 'Sunset', color: '#f97316', text: 'Melatonin synthesis begins as photoreceptors detect falling light. Core temperature starts 1°C nightly descent. Blue light now is most disruptive.' },
    { icon: '🌙', label: 'Pre-Dawn', color: STAR, text: 'Brahma Muhurta — 96 to 48 minutes before sunrise. Alpha-theta brain waves peak. BDNF elevated. The brain is most receptive and neuroplastic.' },
  ];
  return (
    <View>
      <SecLabel text="THE SUN  ·  SURYA  ·  MASTER CLOCK" />
      <ItalicCard text="Every cell in your body carries the CLOCK and BMAL1 genes — circadian clock genes that synchronise to sunlight. The sun is not a metaphor. It is the literal biological clock that sets every hormone, enzyme, and neural rhythm in your body. Ayurveda's Dinacharya (daily rhythm practice) is simply circadian medicine, 5000 years early." />
      <View style={{ gap: 8, marginTop: 14 }}>
        {rows.map((r, i) => (
          <View key={i} style={[S.card, { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, borderColor: r.color + '28' }]}>
            <View style={[S.sunIconBox, { backgroundColor: r.color + '20' }]}>
              <Text style={{ fontSize: 20 }}>{r.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Chip label={r.label} color={r.color} />
              <Text style={{ fontSize: 13, color: '#FFFFFFCC', lineHeight: 20, marginTop: 6 }}>{r.text}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Section 6: Yoga (27 Sun+Moon unions) ────────────────────────────────────
const YOGAS_BRIEF = [
  { name: 'Vishkambha', quality: 'Obstruction', auspicious: false },
  { name: 'Priti',      quality: 'Affection, love',      auspicious: true  },
  { name: 'Ayushman',   quality: 'Long life, vitality',  auspicious: true  },
  { name: 'Saubhagya',  quality: 'Good fortune',         auspicious: true  },
  { name: 'Shobhana',   quality: 'Splendour, beauty',    auspicious: true  },
  { name: 'Atiganda',   quality: 'Danger, obstacles',    auspicious: false },
  { name: 'Sukarman',   quality: 'Good deeds',           auspicious: true  },
  { name: 'Dhriti',     quality: 'Determination',        auspicious: true  },
  { name: 'Shula',      quality: 'Grief, pain',          auspicious: false },
  { name: 'Ganda',      quality: 'Destruction',          auspicious: false },
  { name: 'Vriddhi',    quality: 'Growth, increase',     auspicious: true  },
  { name: 'Dhruva',     quality: 'Fixed, stable',        auspicious: true  },
  { name: 'Vyaghata',   quality: 'Striking blow',        auspicious: false },
  { name: 'Harshana',   quality: 'Joy, happiness',       auspicious: true  },
  { name: 'Vajra',      quality: 'Thunderbolt power',    auspicious: true  },
  { name: 'Siddhi',     quality: 'Success, accomplishment', auspicious: true },
  { name: 'Vyatipata',  quality: 'Calamity, fall',       auspicious: false },
  { name: 'Variyana',   quality: 'Luxury, comfort',      auspicious: true  },
  { name: 'Parigha',    quality: 'Obstruction, bar',     auspicious: false },
  { name: 'Shiva',      quality: 'Auspicious, blessed',  auspicious: true  },
  { name: 'Siddha',     quality: 'Perfection',           auspicious: true  },
  { name: 'Sadhya',     quality: 'Accomplishable',       auspicious: true  },
  { name: 'Shubha',     quality: 'Auspicious',           auspicious: true  },
  { name: 'Shukla',     quality: 'Bright, pure',         auspicious: true  },
  { name: 'Brahma',     quality: 'Creator energy',       auspicious: true  },
  { name: 'Indra',      quality: 'Power, strength',      auspicious: true  },
  { name: 'Vaidhriti',  quality: 'Ill-carried, rest',    auspicious: false },
];

function YogasSection() {
  return (
    <View>
      <SecLabel text="THE 27 YOGAS  ·  SUN + MOON ANGULAR UNIONS" />
      <ItalicCard text="Yoga is calculated by adding the Sun's and Moon's longitudes and dividing into 27 equal segments of 13.3° each. Each segment has a quality — auspicious or inauspicious — that affects the general tone of activity initiated in that period. Modern parallel: the combined gravitational pull of Sun and Moon creates measurable tidal forces that affect biological systems." />
      <View style={[S.card, { padding: 14, marginTop: 14 }]}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {YOGAS_BRIEF.map((y, i) => (
            <View key={i} style={[S.yogaPill, {
              borderColor: y.auspicious ? '#6ee7b720' : '#f8717120',
              backgroundColor: y.auspicious ? '#6ee7b708' : '#f8717108',
            }]}>
              <Text style={[S.yogaTxt, { color: y.auspicious ? '#6ee7b7' : '#f87171' }]}>{y.name}</Text>
              <Text style={S.yogaSub}>{y.quality}</Text>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)' }}>
          <Chip label="✓ Auspicious" color={GREEN} />
          <Chip label="✗ Inauspicious — rest, reflect" color="#f87171" />
        </View>
      </View>
    </View>
  );
}

// ── Section 7: Body-cosmos connection ────────────────────────────────────────
function CosmosBodySection() {
  return (
    <View>
      <SecLabel text="BODY ↔ COSMOS  ·  LOKA PURUSHA SAMYA" />
      <ItalicCard text="Loka-Purusha Samya: the universe and the body are the same structure at different scales. Ayurveda says the macrocosm (universe) and microcosm (body) are built from the same 5 elements and governed by the same rhythmic laws. Modern physics says the same — the atoms in your body were forged in stars." />
      <View style={{ gap: 10, marginTop: 14 }}>
        {[
          { icon: '☀️', title: 'Sun ↔ Pitta / Agni',   color: SUN,   text: 'Solar radiation drives vitamin D synthesis, cortisol, circadian gene expression. Ayurveda: Sun = Agni (fire) — the transformer.' },
          { icon: '🌙', title: 'Moon ↔ Kapha / Ojas',  color: MOON,  text: 'Lunar gravity affects intracranial fluid, menstrual cycles, sleep. Ayurveda: Moon = Soma (nectar) — the builder and sustainer.' },
          { icon: '⭐', title: 'Stars ↔ Vata / Prana', color: STAR,  text: 'Cosmic radiation modulates DNA repair and mutagenesis. Ayurveda: stars = Akasha (space) — the field in which everything moves.' },
          { icon: '🌍', title: 'Earth ↔ Kapha / body', color: '#F5A623', text: 'Earth\'s electromagnetic field aligns geomagnetic sensors in cells. Grounding (bare feet on earth) resets autonomic balance in ~20 min.' },
        ].map((row, i) => (
          <View key={i} style={[S.cosmosCard, { borderLeftColor: row.color }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <Text style={{ fontSize: 20 }}>{row.icon}</Text>
              <Chip label={row.title} color={row.color} />
            </View>
            <Text style={{ fontSize: 13, color: '#FFFFFFCC', lineHeight: 20 }}>{row.text}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function CosmicSciencePage() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <LinearGradient
        colors={['rgba(96,165,250,0.18)', BG, BG]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.35 }}
      />
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={S.header}>
          <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
            <Text style={{ color: '#FFFFFF70', fontSize: 20, lineHeight: 24 }}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={S.headerSub}>COMPLETE REFERENCE  ·  COSMIC ALMANAC</Text>
            <Text style={S.headerTitle}>Cosmic Science</Text>
          </View>
          <View style={[S.livePill, { borderColor: MOON + '55', backgroundColor: MOON + '15' }]}>
            <View style={[S.liveDot, { backgroundColor: MOON }]} />
            <Text style={[S.liveTxt, { color: MOON }]}>PANCHANG</Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 80 }}
        >
          <HeroSection />
          <Divider />

          <VaarsSection />
          <Divider />

          <MoonCycleSection />
          <Divider />

          <NakshatraSection />
          <Divider />

          <SunSection />
          <Divider />

          <YogasSection />
          <Divider />

          <CosmosBodySection />

          {/* Back link */}
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.8}
            style={S.backLink}
          >
            <Text style={{ fontSize: 16 }}>🌿</Text>
            <View style={{ flex: 1 }}>
              <Text style={S.backLinkTitle}>Back to body rhythm</Text>
              <Text style={S.backLinkSub}>Live dosha period · what to do right now</Text>
            </View>
            <Text style={{ fontSize: 16, color: MOON }}>→</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingTop: 8, paddingBottom: 14, gap: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerSub:  { fontSize: 8, fontWeight: '700', color: '#FFFFFF40', letterSpacing: 1.4 },
  headerTitle:{ fontSize: 17, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.2 },
  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 9, paddingVertical: 5, borderRadius: 99, borderWidth: 1,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveTxt:    { fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },

  secLabel: {
    fontSize: 9, fontWeight: '900', color: '#FFFFFF45',
    letterSpacing: 1.8, marginBottom: 10, marginTop: 28,
  },
  italicCard: {
    borderLeftWidth: 2, borderLeftColor: 'rgba(255,255,255,0.22)',
    paddingLeft: 14, marginBottom: 4,
  },
  italicTxt: { fontSize: 13, color: '#FFFFFFCC', fontStyle: 'italic', lineHeight: 20 },

  chip: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99,
    borderWidth: 1, alignSelf: 'flex-start',
  },
  chipTxt: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.4 },

  card: {
    backgroundColor: CARD, borderRadius: 14,
    borderWidth: 1, borderColor: BORD,
  },

  heroTitle: { fontSize: 24, fontWeight: '900', color: '#FFFFFF', lineHeight: 32, marginBottom: 12 },
  heroBody:  { fontSize: 13.5, color: '#FFFFFFCC', lineHeight: 21 },

  vaarRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORD,
    borderLeftWidth: 3, padding: 12,
  },
  vaarIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  vaarName: { fontSize: 13, fontWeight: '900', lineHeight: 18 },
  vaarDay:  { fontSize: 10, color: '#FFFFFF50', fontWeight: '600' },
  vaarEnergy: { fontSize: 11.5, color: '#FFFFFFCC', lineHeight: 17, marginBottom: 3 },
  vaarBody: { fontSize: 10.5, color: '#FFFFFF60', lineHeight: 16, fontStyle: 'italic' },

  tithiRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: CARD, borderRadius: 12, borderWidth: 1, borderColor: BORD,
    borderLeftWidth: 3, padding: 12,
  },
  tithiName:   { fontSize: 12, fontWeight: '800', marginBottom: 3 },
  tithiEnergy: { fontSize: 11.5, color: '#FFFFFFCC', lineHeight: 17 },
  tithiModern: { fontSize: 10.5, color: '#FFFFFF55', lineHeight: 16, marginTop: 3, fontStyle: 'italic' },

  groupDot:  { width: 8, height: 8, borderRadius: 4 },
  groupLabel:{ fontSize: 12, fontWeight: '800' },
  nakRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  nakDot: { width: 5, height: 5, borderRadius: 3, marginTop: 5 },
  nakTxt: { flex: 1, fontSize: 11.5, color: '#FFFFFFCC', lineHeight: 17 },

  sunIconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  yogaPill: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
    borderWidth: 1, minWidth: 100,
  },
  yogaTxt: { fontSize: 11, fontWeight: '800', lineHeight: 15 },
  yogaSub: { fontSize: 9.5, color: '#FFFFFF55', lineHeight: 13 },

  cosmosCard: {
    backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORD,
    borderLeftWidth: 3, padding: 14,
  },

  backLink: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(96,165,250,0.08)', borderRadius: 18,
    borderWidth: 1, borderColor: 'rgba(96,165,250,0.30)',
    padding: 16, marginTop: 28,
  },
  backLinkTitle: { fontSize: 14, fontWeight: '900', color: '#FFFFFF', lineHeight: 20 },
  backLinkSub:   { fontSize: 11, color: '#FFFFFF55', marginTop: 3 },
});
