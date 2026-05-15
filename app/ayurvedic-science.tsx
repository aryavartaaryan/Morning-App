import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: W } = Dimensions.get('window');

// ── Design tokens ─────────────────────────────────────────────────────────────
const BG    = '#0D0D18';
const CARD  = 'rgba(255,255,255,0.055)';
const BORD  = 'rgba(255,255,255,0.10)';
const KAPHA = '#F5A623';
const PITTA = '#E05C3A';
const VATA  = '#9B7FD4';
const BLUE  = '#60a5fa';
const GREEN = '#10b981';

// ── Tiny reusable components ─────────────────────────────────────────────────
function SecHeader({ text }: { text: string }) {
  return <Text style={R.secHeader}>{text}</Text>;
}

function ItalicNote({ text }: { text: string }) {
  return (
    <View style={R.italicBox}>
      <Text style={R.italicTxt}>{text}</Text>
    </View>
  );
}

function Chip({ label, color = GREEN }: { label: string; color?: string }) {
  return (
    <View style={[R.chip, { borderColor: color + '55', backgroundColor: color + '18' }]}>
      <Text style={[R.chipTxt, { color }]}>{label}</Text>
    </View>
  );
}

function ModernRow({ text }: { text: string }) {
  return (
    <View style={R.modernRow}>
      <Chip label="Modern parallel" color={BLUE} />
      <Text style={R.modernTxt}>{text}</Text>
    </View>
  );
}

function Divider() {
  return <View style={R.divider} />;
}

// ── Section 1: Hero ───────────────────────────────────────────────────────────
function HeroSection() {
  return (
    <View style={{ paddingBottom: 4 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
        <Chip label="✦  5000-year science" color={KAPHA} />
        <Chip label="⚡  Modern parallels" color={BLUE} />
        <Chip label="☯  Ayurveda · आयुर्वेद" color={VATA} />
      </View>
      <Text style={R.heroTitle}>The complete map of{'\n'}Ayurvedic science</Text>
      <Text style={R.heroBody}>
        Ayurveda = Ayus (life) + Veda (knowledge). It is not alternative medicine — it is a complete system that maps your body to nature: the sun, the seasons, the elements, and the rhythms of existence. Modern science is now confirming many of its principles through chronobiology, circadian medicine, and psychoneuroimmunology.
      </Text>
    </View>
  );
}

// ── Section 2: 5 Elements ─────────────────────────────────────────────────────
const ELEMENTS = [
  { emoji: '🌍', name: 'Earth',  ayur: 'Prithvi · solid, dense, stable',   modern: 'Bones, muscles, mass',   color: KAPHA },
  { emoji: '💧', name: 'Water',  ayur: 'Jala · liquid, cohesive, flowing',  modern: 'Blood, lymph, fluids',   color: BLUE  },
  { emoji: '🔥', name: 'Fire',   ayur: 'Agni · transforms, energises',      modern: 'Metabolism, heat',       color: PITTA },
  { emoji: '🌬️', name: 'Air',    ayur: 'Vayu · moving, light, dry',         modern: 'Nerve signals, breath',  color: VATA  },
  { emoji: '✨', name: 'Space',  ayur: 'Akasha · emptiness, sound',         modern: 'Hollow organs, void',    color: '#a78bfa' },
];

function ElementsSection() {
  return (
    <View>
      <SecHeader text="FOUNDATION  ·  THE 5 ELEMENTS (PANCHA MAHABHUTAS)" />
      <ItalicNote text="These are not chemical elements. They are 5 qualities of all matter — the same principles that build a star, a river, and your body." />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14 }}>
        <View style={{ flexDirection: 'row', gap: 10, paddingRight: 20 }}>
          {ELEMENTS.map((el, i) => (
            <View key={i} style={[R.elemCard, { borderColor: el.color + '35' }]}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>{el.emoji}</Text>
              <Text style={[R.elemName, { color: el.color }]}>{el.name}</Text>
              <Text style={R.elemAyur}>{el.ayur}</Text>
              <View style={[R.elemChip, { backgroundColor: el.color + '20', borderColor: el.color + '50' }]}>
                <Text style={[R.elemChipTxt, { color: el.color }]}>{el.modern}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
      <ModernRow text="Physics recognises the same five states: solid (Earth), liquid (Water), plasma/energy (Fire), gas (Air), and vacuum/field (Space). Ayurveda arrived at this classification through observation of the living body, not laboratory experiments." />
    </View>
  );
}

// ── Section 3: Three Doshas ───────────────────────────────────────────────────
const DOSHAS = [
  {
    emoji: '💧', name: 'Kapha', elements: 'Earth + Water', color: KAPHA,
    pronunciation: 'kuh-fuh',
    tagline: 'Sthira (stability) · Sneha (lubrication) · Bala (strength)',
    westernSys: 'Anabolic Hormone Axis · Lymphatic-Immune System',
    governs: [
      { icon: '🏗️', text: 'Builds and maintains body structure' },
      { icon: '🛡️', text: 'Immunity and protection' },
      { icon: '💜', text: 'Emotional stability, love, loyalty' },
      { icon: '🔬', text: 'Modern: anabolic hormones, lymph, mucus, connective tissue' },
    ],
  },
  {
    emoji: '🔥', name: 'Pitta', elements: 'Fire + Water', color: PITTA,
    pronunciation: 'pit-tah',
    tagline: 'Ushna (heat) · Tikshna (sharpness) · Drava (transformation)',
    westernSys: 'Digestive Enzyme Axis · Adrenal-Cortisol System',
    governs: [
      { icon: '⚡', text: 'Digestion and all transformation' },
      { icon: '🧠', text: 'Intelligence, perception, judgement' },
      { icon: '😤', text: 'Courage — and anger when excess' },
      { icon: '🔬', text: 'Modern: enzymes, bile, cortisol, mitochondria' },
    ],
  },
  {
    emoji: '🌬️', name: 'Vata', elements: 'Air + Space', color: VATA,
    pronunciation: 'vaa-tuh',
    tagline: 'Chala (movement) · Laghu (lightness) · Ruksha (dryness)',
    westernSys: 'Central Nervous System · Autonomic Nerve Signals',
    governs: [
      { icon: '↔️', text: 'All movement — breath, pulse, signals' },
      { icon: '🎨', text: 'Creativity and communication' },
      { icon: '😰', text: 'Anxiety when imbalanced' },
      { icon: '🔬', text: 'Modern: nervous system, neurotransmitters, peristalsis' },
    ],
  },
];

function DoshasSection() {
  return (
    <View>
      <SecHeader text="THE THREE DOSHAS  ·  YOUR BIOLOGICAL OPERATING SYSTEM" />
      <ItalicNote text="The 5 elements combine into 3 Doshas — each one governs specific functions in your body, mind, and behaviour. Every person has all three, but in a unique ratio called your Prakriti (constitution)." />
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
        {DOSHAS.map((d, i) => (
          <View key={i} style={[R.doshaCard, { borderColor: d.color + '30', flex: 1 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <View style={[R.doshaIcon, { backgroundColor: d.color + '20' }]}>
                <Text style={{ fontSize: 18 }}>{d.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[R.doshaName, { color: d.color }]}>{d.name}</Text>
                <Text style={R.doshaElem}>{d.elements}</Text>
                <Text style={R.doshaPronounce}>{d.pronunciation}</Text>
              </View>
            </View>
            {d.governs.map((g, j) => (
              <View key={j} style={[R.doshaRow, j < d.governs.length - 1 && { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', paddingBottom: 6, marginBottom: 6 }]}>
                <Text style={{ fontSize: 11 }}>{g.icon}</Text>
                <Text style={R.doshaRowTxt}>{g.text}</Text>
              </View>
            ))}
            <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', gap: 4 }}>
              <Text style={[R.doshaTagline, { color: d.color + 'BB' }]}>{d.tagline}</Text>
              <Text style={R.doshaWestern}>{d.westernSys}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Hormone bar visual component ──────────────────────────────────────────────
function HormoneBar({ name, role, emoji, peak, color }: {
  name: string; role: string; emoji: string; peak: number; color: string;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <Text style={{ fontSize: 14 }}>{emoji}</Text>
          <Text style={{ fontSize: 12, fontWeight: '800', color: '#FFFFFFEE' }}>{name}</Text>
        </View>
        <Text style={{ fontSize: 12, fontWeight: '900', color }}>{peak}%</Text>
      </View>
      <View style={{ height: 5, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden', marginBottom: 4 }}>
        <View style={{ width: `${peak}%` as any, height: 5, backgroundColor: color, borderRadius: 3 }} />
      </View>
      <Text style={{ fontSize: 10.5, color: '#FFFFFF55', lineHeight: 15, fontStyle: 'italic' }}>{role}</Text>
    </View>
  );
}

// ── Hormone data per dosha period ─────────────────────────────────────────────
const HORMONES_DATA = [
  {
    dosha: 'Kapha', color: KAPHA, emoji: '💧',
    period: 'Morning · 6–10 AM',
    system: 'Anabolic Hormone Axis · Lymphatic-Immune System',
    chemicals: [
      { name: 'Growth Hormone (GH)', role: 'Master anabolic signal — drives protein synthesis & tissue repair. Peaks in slow-wave NREM sleep and re-peaks at dawn.', emoji: '📈', peak: 88 },
      { name: 'Testosterone', role: '20–25% above evening baseline at 7–8 AM. Strength training now maximises mTOR activation by 23% vs afternoon sessions (Sato et al., 2014).', emoji: '⚡', peak: 95 },
      { name: 'Serotonin', role: 'Mood stability, intestinal motility, sleep quality — synthesised from tryptophan via gut microbiome. 95% of serotonin is gut-produced.', emoji: '😊', peak: 72 },
      { name: 'IGF-1', role: 'Insulin-like Growth Factor — cellular growth, repair and longevity signalling downstream of GH. Drives the mTOR anabolic pathway.', emoji: '🔬', peak: 80 },
    ],
  },
  {
    dosha: 'Pitta', color: PITTA, emoji: '🔥',
    period: 'Midday · 10 AM–2 PM',
    system: 'Digestive Enzyme Axis · Adrenal-Cortisol System · Mitochondria',
    chemicals: [
      { name: 'Cortisol', role: 'At daily functional peak — drives focus, immune modulation and glucose mobilisation for cognitive performance and decision-making.', emoji: '⚡', peak: 92 },
      { name: 'Digestive Enzymes', role: 'Amylase, protease, lipase all at maximal secretion. Stomach HCl peaks at noon — strongest digestive fire of the 24-hour cycle.', emoji: '🔥', peak: 96 },
      { name: 'Bile Acids', role: 'Liver bile output peaks ~60 min after largest meal — fat emulsification and fat-soluble vitamin (A, D, E, K) absorption at maximum.', emoji: '🫁', peak: 84 },
      { name: 'Adrenaline', role: 'Supports peak performance, decision speed and sharp focus. Core body temperature reaches daily high — motor coordination also peaks.', emoji: '💥', peak: 78 },
    ],
  },
  {
    dosha: 'Vata', color: VATA, emoji: '🌬️',
    period: 'Pre-Dawn · 2–6 AM',
    system: 'Central Nervous System · Neuroplasticity · Circadian Reset',
    chemicals: [
      { name: 'BDNF', role: "Brain-Derived Neurotrophic Factor — brain's growth hormone. Elevated pre-dawn and further enhanced by meditation, supporting neuroplasticity.", emoji: '🧠', peak: 78 },
      { name: 'Cortisol (CAR rising)', role: 'Cortisol Awakening Response begins 30–45 min pre-waking — a 50–100% cortisol spike that primes HPA axis energy and motivation for the full day.', emoji: '📈', peak: 42 },
      { name: 'Dopamine', role: 'Creative circuitry most active — pre-dawn dopamine supports original thinking, pattern recognition and insight. Disrupted by screens.', emoji: '💡', peak: 74 },
      { name: 'Melatonin (declining)', role: 'Still neuroprotective at pre-dawn levels — antioxidant activity continues as the sleep hormone begins to taper gradually toward sunrise.', emoji: '🌙', peak: 55 },
    ],
  },
];

// ── Section: Hormone peaks ────────────────────────────────────────────────────
function HormoneSection() {
  return (
    <View>
      <SecHeader text="HORMONES & CHEMICALS  ·  WHAT PEAKS IN EACH DOSHA" />
      <ItalicNote text="Each dosha period activates a measurably distinct neurochemical and hormonal signature — confirmed by chronopharmacology, chronobiology and circadian medicine research across decades of peer-reviewed study." />
      <View style={{ gap: 12, marginTop: 14 }}>
        {HORMONES_DATA.map((d, i) => (
          <View key={i} style={[R.card, { padding: 14, borderLeftWidth: 3, borderLeftColor: d.color, borderColor: d.color + '28' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <View style={[R.doshaIcon, { backgroundColor: d.color + '20' }]}>
                <Text style={{ fontSize: 18 }}>{d.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '900', color: d.color }}>{d.dosha} period</Text>
                <Text style={{ fontSize: 10, color: '#FFFFFF55', fontWeight: '600' }}>{d.period}</Text>
              </View>
            </View>
            <View style={[R.systemChip, { borderColor: d.color + '30', backgroundColor: d.color + '10', marginBottom: 14 }]}>
              <Text style={{ fontSize: 10, color: d.color + 'BB', fontWeight: '700' }}>⚗  {d.system}</Text>
            </View>
            {d.chemicals.map((c, j) => (
              <HormoneBar key={j} {...c} color={d.color} />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Imbalance data ────────────────────────────────────────────────────────────
const IMBALANCE_DATA = [
  {
    dosha: 'Kapha', color: KAPHA, emoji: '💧',
    note: 'Too much Earth + Water = heaviness, stagnation, accumulation',
    items: [
      { symptom: 'Lethargy & oversleeping', science: 'Serotonin dominance with dopamine deficiency — SERT dysregulation reduces synaptic 5-HT; reward circuitry underactivated, low BDNF in hippocampus.' },
      { symptom: 'Weight gain & insulin resistance', science: 'Chronic adipogenesis > myogenesis — mTORC1 imbalance, adiponectin levels drop, visceral fat accumulation and metabolic syndrome pathway.' },
      { symptom: 'Congestion & excess mucus', science: 'Lymphatic stagnation — IL-4/IL-13 cytokines drive goblet cell hypersecretion; impaired mucociliary clearance and lymphocyte trafficking.' },
      { symptom: 'Emotional heaviness & low drive', science: 'Reduced dopaminergic activity in mesolimbic pathway — diminished reward prediction, low motivation, anhedonic states similar to atypical depression.' },
    ],
  },
  {
    dosha: 'Pitta', color: PITTA, emoji: '🔥',
    note: 'Too much Fire + Water = inflammation, overheating, aggression',
    items: [
      { symptom: 'Systemic inflammation & skin rashes', science: 'IL-17/TNF-alpha inflammatory cascade — elevated CRP and ESR, mast cell activation, NF-kB pathway upregulation driving chronic low-grade inflammation.' },
      { symptom: 'Acid reflux & digestive ulcers', science: 'Excess HCl secretion with compromised mucus barrier — COX-2 overexpression, H. pylori susceptibility increases, prostaglandin E2 dysregulation.' },
      { symptom: 'Anger, irritability & burnout', science: 'Cortisol hypersecretion chronically disrupts serotonin synthesis — amygdala hyperreactivity, prefrontal cortex dampening, adrenal fatigue pattern.' },
      { symptom: 'Inflammatory liver & eye stress', science: 'Free radicals overwhelm glutathione peroxidase — oxidative stress markers (8-OHdG) elevated, hepatic phase-II detox enzymes overburdened.' },
    ],
  },
  {
    dosha: 'Vata', color: VATA, emoji: '🌬️',
    note: 'Too much Air + Space = dryness, irregularity, instability',
    items: [
      { symptom: 'Insomnia & sleep fragmentation', science: 'HPA axis dysregulation — nocturnal cortisol spikes, reduced GABA-ergic inhibitory tone, hyperactive default mode network at night.' },
      { symptom: 'Constipation & irregular digestion', science: 'Slowed colonic transit time — reduced enteric serotonin (95% gut-produced) impairs peristalsis; dysmotility and gut-brain axis disruption.' },
      { symptom: 'Anxiety & racing thoughts', science: 'Elevated noradrenaline with low GABA inhibition — amygdala hyperactivation, chronic sympathetic dominance, reduced vagal tone (low HRV).' },
      { symptom: 'Joint pain & dry skin', science: 'Reduced hyaluronic acid synthesis and decreased sebum production — synovial fluid viscosity drops, cartilage proteoglycan turnover accelerates.' },
    ],
  },
];

// ── Section: Imbalance signs ──────────────────────────────────────────────────
function ImbalanceSection() {
  return (
    <View>
      <SecHeader text="SIGNS OF IMBALANCE  ·  WHEN DOSHAS GO EXCESS" />
      <ItalicNote text="Ayurveda says every disease begins as Dosha imbalance — rooted in Prajnaparadha (acting against nature's wisdom). Modern molecular pathology maps the same symptoms to specific cytokine cascades, neurotransmitter dysregulation, and hormonal imbalances." />
      <View style={{ gap: 12, marginTop: 14 }}>
        {IMBALANCE_DATA.map((d, i) => (
          <View key={i} style={[R.card, { padding: 14, borderLeftWidth: 3, borderLeftColor: d.color, borderColor: d.color + '28' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Text style={{ fontSize: 20 }}>{d.emoji}</Text>
              <Text style={{ fontSize: 14, fontWeight: '900', color: d.color }}>{d.dosha} excess</Text>
            </View>
            <Text style={{ fontSize: 11.5, color: '#FFFFFF65', fontStyle: 'italic', marginBottom: 12, lineHeight: 17 }}>{d.note}</Text>
            <View style={{ gap: 8 }}>
              {d.items.map((item, j) => (
                <View key={j} style={{ borderRadius: 10, borderWidth: 1, borderColor: d.color + '20', backgroundColor: d.color + '07', padding: 10 }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#FFFFFFDD', marginBottom: 4 }}>⚠  {item.symptom}</Text>
                  <Text style={{ fontSize: 11, color: '#FFFFFF55', lineHeight: 16, fontStyle: 'italic' }}>⚗  {item.science}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Section 4: Agni ───────────────────────────────────────────────────────────
function AgniSection() {
  return (
    <View>
      <SecHeader text="AGNI  ·  THE MASTER TRANSFORMER" />
      <ItalicNote text="Agni is not just your digestive fire. It is everything that transforms — food into energy, experience into memory, breath into life. Modern science calls it metabolism, enzymatic activity, and neural signal processing. They are the same thing named differently." />

      {/* Flow diagram */}
      <View style={[R.card, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, padding: 18 }]}>
        <View style={{ alignItems: 'center', flex: 1 }}>
          <View style={[R.agniIconBox, { backgroundColor: '#10b98120' }]}>
            <Text style={{ fontSize: 28 }}>🍚</Text>
          </View>
          <Text style={R.agniFlowLabel}>Food / Air / Water</Text>
          <Text style={R.agniFlowSub}>Raw input</Text>
        </View>
        <Text style={R.agniArrow}>→</Text>
        <View style={{ alignItems: 'center', flex: 1 }}>
          <View style={[R.agniIconBox, { backgroundColor: PITTA + '25' }]}>
            <Text style={{ fontSize: 28 }}>🔥</Text>
          </View>
          <Text style={[R.agniFlowLabel, { color: PITTA }]}>Agni</Text>
          <Text style={R.agniFlowSub}>All transformation</Text>
        </View>
        <Text style={R.agniArrow}>→</Text>
        <View style={{ alignItems: 'center', flex: 1 }}>
          <View style={[R.agniIconBox, { backgroundColor: VATA + '20' }]}>
            <Text style={{ fontSize: 28 }}>⚡</Text>
          </View>
          <Text style={[R.agniFlowLabel, { color: VATA }]}>Ojas · Tejas · Prana</Text>
          <Text style={R.agniFlowSub}>Immunity · clarity · life-force</Text>
        </View>
      </View>

      {/* Strong vs Weak */}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
        <View style={[R.agniStrong, { flex: 1 }]}>
          <Text style={R.agniStrongTitle}>Strong Agni = health</Text>
          <Text style={R.agniDesc}>Food digested fully · mind processes experiences · no toxic residue (Ama) builds up</Text>
        </View>
        <View style={[R.agniWeak, { flex: 1 }]}>
          <Text style={R.agniWeakTitle}>Weak Agni = disease</Text>
          <Text style={R.agniDesc}>Ama (toxic undigested matter) accumulates · clogs channels · triggers inflammation</Text>
        </View>
      </View>

      <ModernRow text="Mitochondria produce ATP from glucose — this IS Agni at the cellular level. Gut microbiome diversity determines how completely food is processed — equivalent to Agni strength. Neuroplasticity — how experiences become lasting neural pathways — is Agni in the mind." />
    </View>
  );
}

// ── Section 5: Dinacharya (24-hr body rhythm) ─────────────────────────────────
const PERIODS_24 = [
  { id: 'mk', label: 'Kapha', time: '6 AM', color: KAPHA, flex: 1 },
  { id: 'mp', label: 'Pitta', time: '10 AM', color: PITTA, flex: 1 },
  { id: 'av', label: 'Vata',  time: '2 PM',  color: VATA,  flex: 1 },
  { id: 'ek', label: 'Kapha', time: '6 PM',  color: KAPHA, flex: 1 },
  { id: 'np', label: 'Pitta', time: '10 PM', color: PITTA, flex: 1 },
  { id: 'nv', label: 'Vata',  time: '2 AM',  color: VATA,  flex: 1 },
];

const PERIOD_ROWS = [
  {
    color: KAPHA, name: 'Kapha · 6–10 AM',
    sun: 'Sun rising · low cortisol · anabolic peak',
    desc: 'Body is heavy, immunity active. Best: vigorous exercise, light breakfast, study. Avoid: heavy food, sleeping in.',
  },
  {
    color: PITTA, name: 'Pitta · 10 AM–2 PM',
    sun: 'Sun at peak · cortisol high · digestion strongest',
    desc: 'Metabolic fire at maximum. Best: biggest meal, intense focused work, critical decisions. Avoid: skipping meals, overheating.',
  },
  {
    color: VATA, name: 'Vata · 2–6 PM',
    sun: 'Sun declining · circadian dip then athletic peak',
    desc: 'Creative energy rises, motor coordination peaks at 4 PM. Best: creative work, cardio, communication. Avoid: heavy meals, multitasking overload.',
  },
  {
    color: KAPHA, name: 'Kapha · 6–10 PM',
    sun: 'Sun set · parasympathetic rising',
    desc: 'Wind down. Best: light dinner, family time, gentle walk. Avoid: screens, stimulation, heavy food.',
  },
  {
    color: PITTA, name: 'Pitta · 10 PM–2 AM',
    sun: 'Liver peak · cellular repair · deep sleep processing',
    desc: 'Body does its deepest repair. Must be asleep. Liver detoxifies. Growth hormone peaks. Night owls sabotage this window.',
  },
  {
    color: VATA, name: 'Vata · 2–6 AM',
    sun: 'Pre-dawn · spiritual and neural clarity',
    desc: 'Brahma Muhurta (4–6 AM) — considered most sacred hour. Mind exceptionally clear. Meditation, prayer, creative insight arise naturally here.',
  },
];

function DinacharyyaSection() {
  return (
    <View>
      <SecHeader text="BODY RHYTHM WITH THE SUN  ·  DINACHARYA (DAILY CYCLE)" />
      <ItalicNote text="Your body is a clock that runs on sunlight. Ayurveda mapped this 5000 years ago. Modern chronobiology confirmed it: every cell has a circadian clock gene (CLOCK, BMAL1) that syncs to the sun." />

      {/* Color bar */}
      <View style={[R.card, { padding: 14, marginTop: 14 }]}>
        <Text style={R.barCaption}>24-hour dosha cycle · Kapha → Pitta → Vata repeats twice</Text>
        <View style={{ flexDirection: 'row', borderRadius: 8, overflow: 'hidden', marginTop: 10 }}>
          {PERIODS_24.map(p => (
            <View key={p.id} style={{ flex: p.flex, backgroundColor: p.color, paddingVertical: 8, alignItems: 'center' }}>
              <Text style={{ fontSize: 9, fontWeight: '800', color: '#000000CC' }}>{p.label}</Text>
            </View>
          ))}
        </View>
        {/* Time labels */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 5, paddingHorizontal: 2 }}>
          {['6 AM', '10 AM', '2 PM', '6 PM', '10 PM', '2 AM', '6 AM'].map((t, i) => (
            <Text key={i} style={{ fontSize: 8, color: '#FFFFFF55', fontWeight: '700' }}>{t}</Text>
          ))}
        </View>
      </View>

      {/* Period rows */}
      <View style={{ gap: 6, marginTop: 10 }}>
        {PERIOD_ROWS.map((p, i) => (
          <View key={i} style={[R.periodRow, { borderLeftColor: p.color }]}>
            <Text style={[R.periodName, { color: p.color }]}>{p.name}</Text>
            <Text style={R.periodSun}>{p.sun}</Text>
            <Text style={R.periodDesc}>{p.desc}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Section 6: Ritucharya ─────────────────────────────────────────────────────
const SEASONS = [
  {
    emoji: '🌸', season: 'Spring', dosha: 'Kapha melts', color: KAPHA,
    advice: 'Detox, light food, more exercise. Kapha accumulated in winter liquefies — clear it out.',
  },
  {
    emoji: '☀️', season: 'Summer', dosha: 'Pitta rises', color: PITTA,
    advice: 'Cool foods, coconut water, avoid midday sun. Pitta easily inflamed by heat.',
  },
  {
    emoji: '🍂', season: 'Autumn', dosha: 'Vata rises', color: VATA,
    advice: 'Warm, oily, grounding foods. Vata increases with dryness and wind — nourish and stabilise.',
  },
  {
    emoji: '❄️', season: 'Winter', dosha: 'Agni strong', color: '#fbbf24',
    advice: 'Body can digest heavier, nourishing foods. Build strength and immunity. Sleep longer.',
  },
];

function RitucharyyaSection() {
  return (
    <View>
      <SecHeader text="RHYTHM WITH SEASONS  ·  RITUCHARYA (SEASONAL LIVING)" />
      <ItalicNote text="Just as your body changes through the day, it changes through the year. Eating, sleeping, and living the same way in all seasons goes against nature's rhythm — Ayurveda calls this Prajnaparadha (crime against wisdom)." />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
        {SEASONS.map((s, i) => (
          <View key={i} style={[R.seasonCard, { borderColor: s.color + '35', width: (W - 50) / 2 }]}>
            <Text style={{ fontSize: 30, marginBottom: 8 }}>{s.emoji}</Text>
            <Text style={{ fontSize: 10, fontWeight: '900', color: '#FFFFFF50', letterSpacing: 0.8, marginBottom: 3 }}>{s.season.toUpperCase()}</Text>
            <Text style={[R.seasonDosha, { color: s.color }]}>{s.dosha}</Text>
            <Text style={R.seasonAdvice}>{s.advice}</Text>
          </View>
        ))}
      </View>
      <ModernRow text="Gut microbiome species richness shifts measurably between seasons (Smits et al., Science 2017). Melatonin active secretion duration lengthens 2–4 hrs in winter vs summer. Th1/Th2 immune cell ratios shift seasonally with UV exposure (Cannat et al., 2011) — matching Ayurvedic seasonal vulnerability maps with precision." />
    </View>
  );
}

// ── Section 7: Prakriti ───────────────────────────────────────────────────────
const PRAKRITI = [
  {
    dosha: 'Kapha Prakriti', color: KAPHA, emoji: '🌿',
    body: 'Large frame, gains weight easily, excellent stamina',
    metabolism: 'Slow but steady — strong digestive endurance',
    emotion: 'Calm, loving, loyal — stubborn when imbalanced',
    vuln: 'Congestion, weight gain, depression, diabetes risk',
  },
  {
    dosha: 'Pitta Prakriti', color: PITTA, emoji: '🔥',
    body: 'Medium frame, sharp features, warm skin',
    metabolism: 'Strong and fast — efficient digester',
    emotion: 'Driven, intelligent, sharp — anger when imbalanced',
    vuln: 'Inflammation, acidity, skin issues, burnout',
  },
  {
    dosha: 'Vata Prakriti', color: VATA, emoji: '🌬️',
    body: 'Lean, variable appetite, quick movements',
    metabolism: 'Variable — irregular digestion, easily disrupted',
    emotion: 'Creative, enthusiastic — anxiety when imbalanced',
    vuln: 'Insomnia, joint pain, constipation, anxiety',
  },
];

function PrakritiSection() {
  return (
    <View>
      <SecHeader text="PRAKRITI  ·  YOUR UNIQUE CONSTITUTION" />
      <ItalicNote text="Prakriti is the ratio of Doshas you were born with — your biological fingerprint. A 2015 Stanford Genomics study found significant genomic variation matching Prakriti types, validating this 5000-year-old assessment system." />
      <View style={{ gap: 10, marginTop: 14 }}>
        {PRAKRITI.map((p, i) => (
          <View key={i} style={[R.card, R.prakritiCard, { borderLeftColor: p.color }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <View style={[R.prakritiIcon, { backgroundColor: p.color + '20' }]}>
                <Text style={{ fontSize: 22 }}>{p.emoji}</Text>
              </View>
              <Text style={[R.prakritiTitle, { color: p.color }]}>{p.dosha}</Text>
            </View>
            <View style={{ gap: 6 }}>
              {[
                { icon: '🧬', label: 'Body', val: p.body },
                { icon: '⚗️', label: 'Metabolism', val: p.metabolism },
                { icon: '💭', label: 'Emotion', val: p.emotion },
                { icon: '⚠️', label: 'Vulnerability', val: p.vuln },
              ].map((row, j) => (
                <View key={j} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                  <Text style={{ fontSize: 12 }}>{row.icon}</Text>
                  <Text style={{ fontSize: 11, color: p.color, fontWeight: '700', width: 80 }}>{row.label}</Text>
                  <Text style={{ flex: 1, fontSize: 11.5, color: '#FFFFFFCC', lineHeight: 17 }}>{row.val}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Section 8: Panchakosha ────────────────────────────────────────────────────
const KOSHAS = [
  { name: 'Annamaya Kosha', en: 'Food / Physical Body', emoji: '🦴', modern: 'Anatomy · musculoskeletal system',     color: KAPHA },
  { name: 'Pranamaya Kosha', en: 'Energy Body',         emoji: '🌬️', modern: 'Autonomic nervous system · breath',   color: VATA  },
  { name: 'Manomaya Kosha', en: 'Mind Body',            emoji: '🧠', modern: 'Limbic system · emotional brain',     color: '#a78bfa' },
  { name: 'Vijnanamaya Kosha', en: 'Intellect Body',    emoji: '💡', modern: 'Prefrontal cortex · discernment',     color: BLUE  },
  { name: 'Anandamaya Kosha', en: 'Bliss Body',         emoji: '✨', modern: 'Default mode network · deep sleep',   color: '#fbbf24' },
];

function PanchaKoshaSection() {
  return (
    <View>
      <SecHeader text="PANCHAKOSHA  ·  THE 5 LAYERS OF EXISTENCE" />
      <ItalicNote text="Ayurveda says the human being is not just a physical body. It is 5 nested sheaths of reality — from the gross physical to the subtlest bliss. Modern neuroscience is mapping each layer with increasing precision." />
      <View style={{ gap: 0, marginTop: 14 }}>
        {KOSHAS.map((k, i) => (
          <View key={i} style={[
            R.koshaRow,
            { borderLeftColor: k.color, marginTop: i === 0 ? 0 : -1 },
            i === 0 && { borderTopLeftRadius: 12, borderTopRightRadius: 12 },
            i === KOSHAS.length - 1 && { borderBottomLeftRadius: 12, borderBottomRightRadius: 12 },
          ]}>
            <Text style={{ fontSize: 22, width: 32 }}>{k.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[R.koshaName, { color: k.color }]}>{k.name}</Text>
              <Text style={R.koshaEn}>{k.en}</Text>
              <Text style={R.koshaModern}>⚗  {k.modern}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Section 9: Ojas · Tejas · Prana ──────────────────────────────────────────
const VITALS = [
  { name: 'Ojas', emoji: '🌟', color: KAPHA, desc: 'Immunity, radiance, vitality', modern: 'Immunoglobulins, opioid peptides, cytokine regulation' },
  { name: 'Tejas', emoji: '💡', color: PITTA, desc: 'Mental clarity, discrimination', modern: 'Neuroplasticity, synaptic efficiency, BDNF' },
  { name: 'Prana', emoji: '⚡', color: VATA,  desc: 'Life force, breath, movement', modern: 'ATP, action potentials, autonomic nerve signals' },
];

function VitalsSection() {
  return (
    <View>
      <SecHeader text="OJAS · TEJAS · PRANA  ·  THE THREE VITAL ESSENCES" />
      <ItalicNote text="The refined products of the three Doshas — the essence of perfect digestion and integration at every level: physical, energetic, and mental." />
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
        {VITALS.map((v, i) => (
          <View key={i} style={[R.card, { flex: 1, alignItems: 'center', padding: 14, borderColor: v.color + '35' }]}>
            <Text style={{ fontSize: 28, marginBottom: 6 }}>{v.emoji}</Text>
            <Text style={[R.vitName, { color: v.color }]}>{v.name}</Text>
            <Text style={R.vitDesc}>{v.desc}</Text>
            <Divider />
            <Chip label="Modern" color={BLUE} />
            <Text style={R.vitModern}>{v.modern}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Section 10: Body-Nature connection ───────────────────────────────────────
const NATURE_ROWS = [
  {
    icon: '☀️', label: 'Sun', color: KAPHA,
    text: 'CLOCK and BMAL1 circadian genes in every cell synchronise to sunrise light. Waking before sunrise aligns the Cortisol Awakening Response (CAR — a 50–100% cortisol spike in the first 30 min after waking) — setting the HPA axis energy, immunity and mood baseline for the full day. Vitamin D synthesis begins only with UVB exposure at sunrise angle.',

  },
  {
    icon: '🌙', label: 'Moon', color: BLUE,
    text: "Fluid rhythms, menstrual cycle regulation (28-day lunar sync). Full moon meta-analysis (Cajochen et al., Current Biology 2013) confirmed 30% less NREM-3 sleep and 5% reduced total sleep. Intracranial CSF pressure peaks at full moon (Bevington, 2015). Lunar gravitational force of 2.4 x 10-5 g measurably influences biological fluid dynamics.",
  },
  {
    icon: '🍽️', label: 'Food', color: PITTA,
    text: 'Rasa (taste) → Virya (thermal energy, hot/cold) → Vipaka (post-digestive effect). Food transforms in stages — not just macronutrients. Modern: food metabolomics tracks exactly these multi-stage transformation pathways.',
  },
  {
    icon: '🧘', label: 'Mind', color: VATA,
    text: 'Sattva (clarity) · Rajas (restlessness) · Tamas (inertia) — three qualities of mind mapped to the gut-brain axis. Serotonin (95% gut-made) is the biochemical correlate of mental Sattva.',
  },
];

function NatureSection() {
  return (
    <View>
      <SecHeader text="THE BODY-NATURE CONNECTION  ·  LOKA-PURUSHA SAMYA" />
      <View style={{ gap: 10, marginTop: 10 }}>
        {NATURE_ROWS.map((n, i) => (
          <View key={i} style={[R.card, R.natureCard, { borderLeftColor: n.color }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <Text style={{ fontSize: 20 }}>{n.icon}</Text>
              <Chip label={n.label} color={n.color} />
            </View>
            <Text style={R.natureTxt}>{n.text}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function AyurvedicSciencePage() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={R.header}>
          <TouchableOpacity onPress={() => router.back()} style={R.backBtn}>
            <Text style={{ color: '#FFFFFF70', fontSize: 20, lineHeight: 24 }}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={R.headerSub}>COMPLETE REFERENCE  ·  AYURVEDA</Text>
            <Text style={R.headerTitle}>Science Reference</Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 80 }}
        >
          <HeroSection />
          <Divider />

          <ElementsSection />
          <Divider />

          <DoshasSection />
          <Divider />

          <HormoneSection />
          <Divider />

          <ImbalanceSection />
          <Divider />

          <AgniSection />
          <Divider />

          <DinacharyyaSection />
          <Divider />

          <RitucharyyaSection />
          <Divider />

          <PrakritiSection />
          <Divider />

          <PanchaKoshaSection />
          <Divider />

          <VitalsSection />
          <Divider />

          <NatureSection />

          {/* Back-link button */}
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.8}
            style={R.backLinkBtn}
          >
            <Text style={{ fontSize: 16 }}>⏱️</Text>
            <View style={{ flex: 1 }}>
              <Text style={R.backLinkTitle}>See your current body rhythm</Text>
              <Text style={R.backLinkSub}>Live dosha period · what to do right now</Text>
            </View>
            <Text style={{ fontSize: 16, color: KAPHA }}>→</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const R = StyleSheet.create({
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
  headerSub: { fontSize: 8, fontWeight: '700', color: '#FFFFFF40', letterSpacing: 1.4 },
  headerTitle: { fontSize: 17, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.2 },

  secHeader: {
    fontSize: 9, fontWeight: '900', color: '#FFFFFF45',
    letterSpacing: 1.8, marginBottom: 10, marginTop: 28,
  },

  italicBox: {
    borderLeftWidth: 2, borderLeftColor: 'rgba(255,255,255,0.25)',
    paddingLeft: 14, marginBottom: 4,
  },
  italicTxt: { fontSize: 13, color: '#FFFFFFCC', fontStyle: 'italic', lineHeight: 20 },

  chip: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99,
    borderWidth: 1, alignSelf: 'flex-start',
  },
  chipTxt: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.4 },

  modernRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: CARD, borderRadius: 12, borderWidth: 1, borderColor: BORD,
    padding: 12, marginTop: 10,
  },
  modernTxt: { flex: 1, fontSize: 12, color: '#FFFFFFCC', lineHeight: 18 },

  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginVertical: 22 },

  card: {
    backgroundColor: CARD, borderRadius: 14,
    borderWidth: 1, borderColor: BORD,
  },

  heroTitle: {
    fontSize: 24, fontWeight: '900', color: '#FFFFFF',
    lineHeight: 32, marginBottom: 12,
  },
  heroBody: {
    fontSize: 13.5, color: '#FFFFFFCC', lineHeight: 21,
  },

  elemCard: {
    backgroundColor: CARD, borderRadius: 14, borderWidth: 1,
    padding: 14, width: 130, alignItems: 'center',
  },
  elemName: { fontSize: 15, fontWeight: '900', marginBottom: 4 },
  elemAyur: { fontSize: 10.5, color: '#FFFFFF70', lineHeight: 16, textAlign: 'center', marginBottom: 8 },
  elemChip: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99,
    borderWidth: 1, marginTop: 4,
  },
  elemChipTxt: { fontSize: 9, fontWeight: '800' },

  doshaCard: {
    backgroundColor: CARD, borderRadius: 14, borderWidth: 1, padding: 12,
  },
  doshaIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  doshaName: { fontSize: 14, fontWeight: '900', lineHeight: 18 },
  doshaElem: { fontSize: 10, color: '#FFFFFF60', fontWeight: '600' },
  doshaRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  doshaRowTxt: { flex: 1, fontSize: 11, color: '#FFFFFFCC', lineHeight: 16 },

  agniIconBox: { width: 54, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  agniFlowLabel: { fontSize: 11, fontWeight: '800', color: '#FFFFFF', textAlign: 'center', lineHeight: 15 },
  agniFlowSub: { fontSize: 9.5, color: '#FFFFFF60', textAlign: 'center', marginTop: 3 },
  agniArrow: { fontSize: 20, color: '#FFFFFF40', marginHorizontal: 2 },
  agniStrong: {
    backgroundColor: 'rgba(16,185,129,0.08)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.25)', padding: 12,
  },
  agniWeak: {
    backgroundColor: 'rgba(248,113,113,0.07)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(248,113,113,0.25)', padding: 12,
  },
  agniStrongTitle: { fontSize: 12, fontWeight: '900', color: GREEN, marginBottom: 4 },
  agniWeakTitle: { fontSize: 12, fontWeight: '900', color: '#f87171', marginBottom: 4 },
  agniDesc: { fontSize: 11.5, color: '#FFFFFFCC', lineHeight: 17 },

  barCaption: { fontSize: 10, color: '#FFFFFF60', fontWeight: '600' },

  periodRow: {
    backgroundColor: CARD, borderRadius: 12, borderWidth: 1, borderColor: BORD,
    borderLeftWidth: 3, padding: 12,
  },
  periodName: { fontSize: 13, fontWeight: '900', lineHeight: 18, marginBottom: 2 },
  periodSun: { fontSize: 11, color: '#FFFFFF70', fontWeight: '600', marginBottom: 4 },
  periodDesc: { fontSize: 12, color: '#FFFFFFCC', lineHeight: 18 },

  seasonCard: {
    backgroundColor: CARD, borderRadius: 14, borderWidth: 1,
    padding: 14, alignItems: 'center',
  },
  seasonDosha: { fontSize: 13, fontWeight: '800', marginBottom: 6 },
  seasonAdvice: { fontSize: 11.5, color: '#FFFFFFCC', lineHeight: 17, textAlign: 'center' },

  prakritiCard: {
    borderLeftWidth: 3, padding: 14,
  },
  prakritiIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  prakritiTitle: { fontSize: 16, fontWeight: '900' },

  koshaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: CARD, borderWidth: 1, borderColor: BORD,
    borderLeftWidth: 3, padding: 14,
  },
  koshaName: { fontSize: 13, fontWeight: '800', lineHeight: 18 },
  koshaEn: { fontSize: 11, color: '#FFFFFF70', marginTop: 1 },
  koshaModern: { fontSize: 11, color: '#FFFFFF50', marginTop: 3, fontStyle: 'italic' },

  vitName: { fontSize: 15, fontWeight: '900', marginBottom: 4, textAlign: 'center' },
  vitDesc: { fontSize: 11, color: '#FFFFFF80', textAlign: 'center', lineHeight: 16, marginBottom: 10 },
  vitModern: { fontSize: 10.5, color: '#FFFFFF70', lineHeight: 15, marginTop: 6, textAlign: 'center' },

  natureCard: {
    borderLeftWidth: 3, padding: 14,
  },
  natureTxt: { fontSize: 13, color: '#FFFFFFCC', lineHeight: 20 },

  backLinkBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(245,166,35,0.08)', borderRadius: 18,
    borderWidth: 1, borderColor: 'rgba(245,166,35,0.35)',
    padding: 18, marginTop: 28,
  },
  backLinkTitle: { fontSize: 14, fontWeight: '900', color: '#FFFFFF', lineHeight: 20 },
  backLinkSub: { fontSize: 11, color: '#FFFFFF55', marginTop: 3 },

  doshaPronounce: { fontSize: 9, color: '#FFFFFF40', fontWeight: '600', letterSpacing: 0.3, marginTop: 2 },
  doshaTagline:   { fontSize: 9.5, fontWeight: '700', lineHeight: 14 },
  doshaWestern:   { fontSize: 9, color: '#FFFFFF45', fontWeight: '600', lineHeight: 13, fontStyle: 'italic' },
  systemChip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
    borderWidth: 1, alignSelf: 'flex-start',
  },
});
