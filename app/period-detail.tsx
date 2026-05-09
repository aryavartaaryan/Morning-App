import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Dimensions, Animated,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PERIOD_TEMPLATES } from '../lib/ayurvedicPeriods';

const W = Dimensions.get('window').width;

// ── Enhanced Dosha Science — Roman script + modern biology ────────────────────
const DOSHA_SCIENCE = {
  kapha: {
    romanScript: 'Kapha',
    pronunciation: 'kuh-fuh',
    elementEq: 'Prithvi (Earth)  +  Jala (Water)  =  Sthira (Stability)',
    elementBreakdown: [
      { sanskrit: 'Prithvi', english: 'Earth', emoji: '🌍', body: 'Bone mineral density (hydroxyapatite crystals), type-I collagen fibres, muscle actin/myosin filaments — the solid scaffold of your body.' },
      { sanskrit: 'Jala', english: 'Water', emoji: '💧', body: 'Synovial joint fluid, cerebrospinal fluid, lymph (2–4 L/day), mucus membranes, hyaluronic acid (3.5 mg/ml in joints).' },
    ],
    westernSystem: 'Anabolic Hormone Axis · Lymphatic-Immune System · Connective Tissue',
    tagline: 'Kapha is the principle of Sthira (stability), Sneha (lubrication) & Bala (strength)',
    biology: 'Kapha governs the anabolic-immune axis. In modern terms: Growth Hormone (GH), IGF-1, testosterone, and the entire lymphatic network (600+ nodes, 2–4 L lymph/day) are Kapha in biological action. Systems biology calls this anabolism — the body building, protecting, and structuring itself. Kapha excess creates heaviness; Kapha deficiency creates dryness and fragility.',
    peakFact: 'Morning testosterone is 20–25% above its evening baseline (circadian peak: 7–8 AM). The Cortisol Awakening Response (CAR) co-rises, triggering the anabolic cascade. Strength training in this window maximises mTOR pathway activation by 23% vs afternoon sessions (Sato et al., 2014).',
    chemicals: [
      { name: 'Growth Hormone (GH)', role: 'Master anabolic signal — drives protein synthesis & tissue repair. Peaks in slow-wave (NREM) sleep.', emoji: '📈', peak: 88 },
      { name: 'Testosterone', role: 'Activates mTOR muscle-building pathway — 20–25% above baseline at 7–8 AM', emoji: '⚡', peak: 95 },
      { name: 'Serotonin', role: 'Mood stability, intestinal motility, sleep quality — synthesised from dietary tryptophan', emoji: '😊', peak: 72 },
      { name: 'IGF-1', role: 'Insulin-like Growth Factor — cellular growth, repair, and longevity signalling downstream of GH', emoji: '🔬', peak: 80 },
    ],
    processes: [
      { name: 'Lymphatic Immune Peak', detail: '600+ lymph nodes · 2–4 L lymph/day · T & B cell trafficking at max', emoji: '🛡️' },
      { name: 'Muscle Protein Synthesis', detail: 'mTOR pathway active · 1.6–2.2 g protein/kg/day turnover · IGF-1 driven', emoji: '💪' },
      { name: 'Synovial Fluid Renewal', detail: 'Hyaluronic acid matrix · 0.5–4 ml/joint · full joint lubrication active', emoji: '🦴' },
      { name: 'Collagen Synthesis', detail: 'Type I/II/III collagen · tendon, cartilage & skin structural repair begins', emoji: '🔗' },
    ],
    imbalance: [
      { symptom: 'Lethargy & Oversleeping', science: 'Serotonin dominance with dopamine deficiency — reward circuitry underactivated, low motivation' },
      { symptom: 'Weight Gain & Insulin Resistance', science: 'Chronic adipogenesis > myogenesis — mTORC1 imbalance, adiponectin levels drop' },
      { symptom: 'Congestion & Excess Mucus', science: 'Lymphatic stagnation — IL-4/IL-13 cytokines drive goblet cell hypersecretion' },
      { symptom: 'Emotional Heaviness & Low Drive', science: 'SERT dysregulation — reduced synaptic 5-HT, low BDNF expression in hippocampus' },
    ],
    balance: [
      { practice: 'Vigorous Exercise Before 10 AM', science: 'Activates AMPK, depletes glycogen, upregulates GLUT4 translocation to muscle membrane' },
      { practice: 'Kapalabhati Pranayama (120 rapid exhales)', science: 'Alkalises blood pH, activates sympathetic NS, raises core temperature 0.3°C in 3 minutes' },
      { practice: 'Garshana — Dry Brushing Before Shower', science: 'Mechanical stimulation increases lymphocyte circulation 3×, clears metabolic waste products' },
      { practice: 'Shunthi Kashaya — Warm Ginger Tea', science: 'Gingerols activate TRPA1/TRPV1 receptors → thermogenic effect, stimulates gastric motility' },
    ],
    actionCta: 'Start Morning Movement',
    actionEmoji: '💪',
    pomodoroLabel: 'Workout Timer',
    pomodoroMinutes: 30,
  },
  pitta: {
    romanScript: 'Pitta',
    pronunciation: 'pit-tuh',
    elementEq: 'Agni (Fire)  +  Jala (Water)  =  Pachana (Transformation)',
    elementBreakdown: [
      { sanskrit: 'Agni', english: 'Fire', emoji: '🔥', body: 'Mitochondrial oxidative phosphorylation (32 ATP/glucose), cytochrome P450 liver enzymes, gastric HCl — the body\'s controlled biochemical combustion.' },
      { sanskrit: 'Jala', english: 'Water', emoji: '💧', body: 'Bile (95% water), all enzymatic reactions require aqueous medium. Every Pitta transformation is liquid fire — hydrolysis breaks molecular bonds using water.' },
    ],
    westernSystem: 'HPA Axis · Hepatic CYP450 Detoxification · Digestive Enzyme System',
    tagline: 'Pitta is the principle of Pachana (digestion), Tejas (metabolic fire) & Buddhi (intelligence)',
    biology: 'Pitta governs every biochemical transformation in the body. In modern terms: Cytochrome P450 liver enzymes, gastric hydrochloric acid (HCl), bile acids, insulin signalling, and core temperature regulation are all Pitta-driven systems. Pitta is the biological force that converts matter into energy — food into fuel, light into sight, information into understanding.',
    peakFact: 'Gastric acid (HCl) hits its lowest pH (most acidic) at 12–1 PM — confirmed by intragastric pH studies. Insulin sensitivity is 30% higher at noon vs evening. Core body temperature peaks at 2–3 PM (Royal et al., 2003). This is why your largest meal should always be at solar noon.',
    chemicals: [
      { name: 'Cortisol', role: 'Energy mobilisation, circadian rhythm master driver, anti-inflammatory response, cognitive sharpness', emoji: '⚡', peak: 90 },
      { name: 'Insulin', role: 'Glucose uptake gatekeeper — sensitivity 30% higher at noon. Anabolic signalling master regulator', emoji: '🔑', peak: 85 },
      { name: 'Thyroid Hormones (T3/T4)', role: 'Sets the basal metabolic rate (BMR), thermogenesis, and protein synthesis speed', emoji: '🌡️', peak: 78 },
      { name: 'HCl + Pepsin + Bile Acids', role: 'Protein denaturation at pH 1.5–3.5 + fat emulsification — all peak at solar noon', emoji: '🧪', peak: 92 },
    ],
    processes: [
      { name: 'Peak Pachaka Agni (HCl)', detail: 'Parietal cells secrete 1.5–3 L acid/day · gastric pH 1.5–3.5 at noon', emoji: '🧪' },
      { name: 'Ranjaka Pitta — Bile Synthesis', detail: 'Liver converts cholesterol → cholic acid · 600 ml bile/day released postprandially', emoji: '💛' },
      { name: 'Bhutagni — CYP450 Liver Detox', detail: 'Phase I (oxidation) + Phase II (conjugation) · 60 active CYP enzyme isoforms', emoji: '🔄' },
      { name: 'Core Temperature Peak', detail: 'Hypothalamus holds 37°C set-point · peak thermal drive at 2–3 PM daily', emoji: '🌡️' },
    ],
    imbalance: [
      { symptom: 'Acid Reflux & Heartburn (Amlapitta)', science: 'Excess HCl output — lower esophageal sphincter cannot contain the Pachaka Pitta surge' },
      { symptom: 'Skin Inflammation & Acne (Bhrajaka Pitta)', science: 'Prostaglandin E2 excess + elevated androgens → sebaceous gland hyperactivation' },
      { symptom: 'Anger & Irritability (Sadhaka Pitta)', science: 'Elevated cortisol + serotonin deficiency → amygdala hyperreactivity, impulse dysregulation' },
      { symptom: 'Burnout & Adrenal Fatigue', science: 'Chronic HPA axis activation → cortisol flatline, DHEA depletion, mitochondrial dysfunction' },
    ],
    balance: [
      { practice: 'Largest Meal at Solar Noon (Madhyahna Bhojana)', science: 'HCl, bile & all pancreatic enzymes are at daily maximum — highest nutrient assimilation window' },
      { practice: 'Cooling Foods — Cucumber, Coconut, Lime', science: 'Reduces prostaglandin E2, lowers core temperature 0.2–0.4°C via evaporative and conductive cooling' },
      { practice: 'Sheetali Pranayama (Curled Tongue Breath)', science: 'Evaporative cooling through tongue surface lowers tympanic temperature 0.3°C within 5 min' },
      { practice: 'Evening Blue-Light Cut-off (Tarpaka Pitta)', science: 'Maintains cortisol decline trajectory — protects melatonin onset timing and total sleep quality' },
    ],
    actionCta: 'Log Your Largest Meal',
    actionEmoji: '🔥',
    pomodoroLabel: 'Deep Work Timer',
    pomodoroMinutes: 25,
  },
  vata: {
    romanScript: 'Vata',
    pronunciation: 'vaa-tuh',
    elementEq: 'Vayu (Air)  +  Akasha (Space)  =  Chala (Movement)',
    elementBreakdown: [
      { sanskrit: 'Vayu', english: 'Air', emoji: '🌬️', body: 'Alveolar O₂/CO₂ exchange, electrochemical gradients across cell membranes (−70 mV resting), nerve action potentials travelling at 70–120 m/s — the body\'s electrical grid.' },
      { sanskrit: 'Akasha', english: 'Space', emoji: '✨', body: 'Synaptic clefts (20 nm gaps between neurons), hollow channels (arteries, bronchi, lymphatics), 15 L extracellular fluid matrix, and the EM field of 86 billion neurons firing simultaneously.' },
    ],
    westernSystem: 'Autonomic Nervous System · Peripheral & Enteric NS · Neurotransmission',
    tagline: 'Vata is the principle of Chala (movement), Prana (life-force) & Spanda (vibration)',
    biology: 'Vata governs the entire Autonomic Nervous System. In modern terms: every action potential (70 mV impulse) propagating at 70–120 m/s through myelinated axons is pure Vata. The enteric nervous system (500 million neurons lining the gut wall) is entirely Vata-governed. Vata moves energy, information, breath, and neural signals — it is the biological substrate of movement and consciousness itself.',
    peakFact: 'Lung vital capacity peaks at 3–4 PM, confirmed by spirometry (Zamir et al., 1999). Plasma catecholamines (dopamine + noradrenaline) peak in this Vata window. Reaction time, fine motor coordination, VO₂max, and athletic output are all statistically highest in the afternoon — which is why 80% of Olympic world records are broken between 2–6 PM.',
    chemicals: [
      { name: 'Dopamine', role: 'Movement initiation, reward motivation, creative drive, prefrontal cortex focus — peaks in this window', emoji: '🎯', peak: 88 },
      { name: 'Norepinephrine', role: 'Sympathetic alertness, sustained attention, signal-to-noise ratio in neural processing', emoji: '⚡', peak: 85 },
      { name: 'Acetylcholine (ACh)', role: 'Nerve-muscle junction firing, hippocampal memory encoding, attention modulation', emoji: '🧠', peak: 80 },
      { name: 'GABA', role: 'Inhibitory counterbalance — prevents Vata hyperactivation (anxiety spirals) by calming excess neural firing', emoji: '🌊', peak: 60 },
    ],
    processes: [
      { name: 'Prana Vata — Nerve Speed', detail: '70–120 m/s in myelinated Aα fibres · all brain-body signals peak', emoji: '⚡' },
      { name: 'Prana Vayu — Lung Capacity', detail: 'Vital capacity peaks at 3–4 PM · pre-Bötzinger complex rhythm optimal', emoji: '🫁' },
      { name: 'Udana Vata — Working Memory', detail: 'Prefrontal γ-oscillations (40 Hz) · 100 ms neural feedback loops active', emoji: '🧠' },
      { name: 'Vyana Vata — Motor Control', detail: 'Cerebellum timing + basal ganglia coordination · 10 ms precision control', emoji: '🤸' },
    ],
    imbalance: [
      { symptom: 'Anxiety & Racing Thoughts (Prana Vata)', science: 'Excess sympathetic tone — chronically elevated norepinephrine and CRH, amygdala hyperactivation' },
      { symptom: 'Insomnia & Night Waking (Vyana Vata)', science: 'Nocturnal norepinephrine surge prevents GABA-mediated sleep onset — elevated HRV variability' },
      { symptom: 'Constipation & Bloating (Apana Vata)', science: 'Weakened peristaltic wave amplitude — low acetylcholine in enteric nervous system neurons' },
      { symptom: 'Scattered Focus & Restlessness (Udana Vata)', science: 'Dopamine dysregulation — prefrontal D1-receptor underactivation (clinically mirrors ADHD phenotype)' },
    ],
    balance: [
      { practice: 'Abhyanga — Warm Sesame Oil Self-Massage', science: 'Activates cutaneous mechanoreceptors → stimulates vagal tone, reduces cortisol 28%, upregulates parasympathetic NS (Ironson et al.)' },
      { practice: 'Pranayama — 4-7-8 Breathing Technique', science: 'Prolonged exhale activates ventral vagal complex → measurable HRV improvement within 5 minutes' },
      { practice: 'Niyama — Fixed Sleep/Wake Schedule (±15 min)', science: 'Regulates the Cortisol Awakening Response and CLOCK/BMAL1 circadian gene expression cycle' },
      { practice: 'Annapana — Warm Grounding Foods + Regular Meals', science: 'Stabilises blood glucose oscillation amplitude → reduces cortisol variability, dampens anxiety' },
    ],
    actionCta: 'Start Deep Focus Session',
    actionEmoji: '⚡',
    pomodoroLabel: 'Focus Timer',
    pomodoroMinutes: 25,
  },
};

// ── Per-Period Overrides — period-specific data replacing dosha-wide defaults ──
const PERIOD_PEAK_FACTS: Partial<Record<string, string>> = {
  morning_kapha:  'Morning testosterone is 20–25% above its evening baseline (circadian peak: 7–8 AM). The Cortisol Awakening Response (CAR) co-rises, triggering the anabolic cascade. Strength training in this window maximises mTOR pathway activation by 23% vs afternoon sessions (Sato et al., 2014).',
  midday_pitta:   'Gastric acid (HCl) hits its lowest pH at 12–1 PM — confirmed by intragastric pH studies. Insulin sensitivity is 30% higher at noon vs evening. Core body temperature peaks at 2–3 PM (Royal et al., 2003). This is why Ayurveda designates solar noon as the Madhyahna Bhojana window — your largest meal belongs here.',
  afternoon_vata: 'Lung vital capacity peaks at 3–4 PM, confirmed by spirometry (Zamir et al., 1999). Plasma catecholamines (dopamine + noradrenaline) peak in this Vata window. Reaction time, fine motor coordination, VO₂max and athletic output are all statistically highest — 80% of Olympic world records are broken between 2–6 PM.',
  evening_kapha:  'Melatonin synthesis accelerates as photoreceptors detect fading light. Blue light (460–480 nm) suppresses melatonin production by up to 85% — a single screen can delay sleep onset by 90 minutes (Harvard, 2015). Cortisol drops to its evening nadir (~100 nmol/L, down from morning peak of 500 nmol/L). Core temperature begins its 1°C nightly descent — the biological sleep trigger. GABA rises. The parasympathetic nervous system — Ayurveda\'s Kapha-Ojas restoration window — takes command of the body.',
  night_pitta:    'Growth Hormone (GH) secretion peaks during slow-wave sleep (Stages 3–4), reaching 500–700 μg/L — its highest output of the day. Liver CYP450 detoxification enzymes are maximally active at 1–3 AM. Autophagy — the cellular self-cleaning process — runs at full capacity. Every minute of undisturbed sleep in this window is intensive biological repair.',
  night_vata:     'Alpha & theta brainwaves (8–12 Hz, 4–8 Hz) dominate the pre-dawn nervous system — EEG confirmed. The Cortisol Awakening Response (CAR) begins its surge. The subconscious–conscious veil is thinnest — neuroplasticity peaks. This window contains the sacred Brahma Muhurta (96–48 min before sunrise) — Vata\'s 48-minute neurological window of maximum receptivity.',
};

const PERIOD_BALANCE: Partial<Record<string, { practice: string; science: string }[]>> = {
  night_pitta: [
    { practice: 'Deep Uninterrupted Sleep — The Practice IS the Medicine', science: 'During nocturnal Pitta (10 PM–2 AM), Growth Hormone (GH) peaks in slow-wave sleep — driving protein synthesis, tissue repair and fat metabolism. Liver CYP450 detox enzymes are maximally active at 1–3 AM. Every hour of broken sleep in this window directly reduces GH output and halts cellular repair.' },
    { practice: 'Maintain the Fasting Window — No Caloric Intake', science: 'Any caloric input after 9 PM halts autophagy (cellular self-cleaning) immediately. Nocturnal Pitta is the body\'s only window for autophagy — the single most powerful anti-aging process available. Fasting protects it completely.' },
    { practice: 'Cool, Dark & Silent Bedroom — Tamasa-free Environment', science: 'Core temperature must drop ~1°C to initiate and maintain deep sleep. A cool room (18–20°C), total darkness (blackout curtains), and silence allow the body to hold slow-wave sleep longer — maximising the GH secretion window.' },
    { practice: 'Brief Journaling or Gratitude Before Sleep', science: 'Writing 3 grateful thoughts before sleep reduces pre-sleep cognitive arousal and lowers cortisol. The hippocampus consolidates emotional memories during REM — journaling gives it positive content to process, improving mood the next day.' },
  ],
  night_vata: [
    { practice: 'Silent Meditation & Dhyana — Brahma Muhurta', science: 'The 96–48 minutes before sunrise (Brahma Muhurta) are neurologically unique — alpha and theta brainwaves (EEG confirmed) create the deepest meditative access of the 24-hour cycle. The subconscious–conscious veil is thinnest. Meditation here is exponentially more potent than at any other time.' },
    { practice: 'Mantra Japa — or Listen to Sacred Mantras & Nada', science: 'Pre-dawn silence amplifies mantra vibration. Repetitive sacred sound at this hour activates vagal tone, creates coherent heart-rate variability (HRV), and directly entrains alpha brainwaves. Our curated Nada and mantra collection is specifically powerful in this window.' },
    { practice: 'Sankalpa — Intention Setting for the Day', science: 'The hypnagogic-to-wakeful transition state makes the subconscious most receptive to new neural patterning. A Sankalpa (firm resolve) planted here bypasses the critical-factor mind and embeds deeply — research on pre-wake suggestion confirms 40% stronger retention than waking-state intentions.' },
    { practice: 'No Screens or Bright Light — Protect the CAR Window', science: 'The Cortisol Awakening Response (CAR) — a 50–100% cortisol surge in the 30 minutes around waking — sets your entire day\'s energy and circadian timing. Any bright light or screen exposure during Brahma Muhurta catastrophically disrupts CAR timing and offsets your clock for the full day.' },
  ],
  evening_kapha: [
    { practice: 'Yoga — Under a Guru\'s Guidance (includes Pranayama)', science: 'Restorative yoga and breath-work taught by a qualified Guru activates deep parasympathetic tone — heart rate slows, cortisol drops measurably. Pranayama is an integral part of Yoga, not separate from it. Practice under Guru\'s guidance allows the nervous system to surrender safely in ways self-practice rarely achieves.' },
    { practice: 'Nada & Mantra Listening — Sacred Sound Therapy', science: 'Nada Yoga (the yoga of sound) uses specific frequencies and mantra vibrations to entrain the nervous system. Listening to sacred mantras and Nada from our curated collection reduces amygdala activation, lowers cortisol, and guides brainwaves from beta (active) toward alpha and theta (rest-repair) states — helping in profound and immeasurable ways.' },
    { practice: 'Screen-Free After 8 PM — Protect Tarpaka Pitta', science: 'Blue light (460–480 nm) suppresses melatonin synthesis by up to 85%, delays sleep onset by 90 minutes, and reduces deep-sleep duration by 15–20%. Ayurveda calls this protecting Tarpaka Pitta — the nourishing mental fire that requires darkness to replenish.' },
    { practice: 'Garshana — Gentle Dry-Brush Self-Massage', science: '🤔 What is Garshana?\nSimply: take a dry rough-textured cloth, a dry loofah, or raw silk/linen gloves and gently rub your skin in small circular strokes — starting from your feet upward toward your heart — before your evening bath or shower. No oil, no water. Just dry friction on bare skin for 3–5 minutes.\n\nGarshana (Sanskrit: "friction") is an ancient Ayurvedic practice. In the evening, this gentle brushing stimulates lymphatic circulation and helps clear the Ama (metabolic waste) your body accumulated throughout the day. Modern science: mechanical skin stimulation increases lymphocyte trafficking 3×, and the gentle pressure activates vagal tone — signalling the nervous system into rest-and-repair mode. Your body enters sleep cleaner, lighter, and more deeply restored.' },
    { practice: 'Warm Ashwagandha Milk — Ojas Tonic (Ksheer Paka)', science: 'Ashwagandha (Withania somnifera) reduces serum cortisol by 27.9% (Chandrasekhar et al., 2012). Warm milk triggers the tryptophan → serotonin → melatonin cascade — a direct biochemical pathway to sleep onset validated by modern sleep science.' },
  ],
};

const PERIOD_CHEMICALS: Partial<Record<string, { name: string; role: string; emoji: string; peak: number }[]>> = {
  night_pitta: [
    { name: 'Growth Hormone (GH)', role: 'Master repair signal — peaks in slow-wave NREM sleep (Stage 3–4). Drives muscle protein synthesis, tissue rebuilding, fat metabolism and cellular regeneration during deep sleep.', emoji: '🔬', peak: 88 },
    { name: 'Melatonin (High)', role: 'Still at high levels maintaining deep sleep architecture. Melatonin is also a potent antioxidant and cellular repair co-factor — its role extends far beyond sleep onset.', emoji: '🌙', peak: 80 },
    { name: 'IGF-1', role: 'Insulin-like Growth Factor — downstream signal of GH. Drives cellular growth, muscle protein synthesis, and longevity pathways during the nocturnal repair window.', emoji: '📈', peak: 72 },
    { name: 'Cortisol (Nadir)', role: 'At its daily minimum — the body is shielded from catabolic breakdown. This low-cortisol window is what allows GH to do maximum anabolic repair. Any stress or waking suppresses this.', emoji: '📉', peak: 8 },
  ],
  night_vata: [
    { name: 'Cortisol (CAR Rising)', role: 'The Cortisol Awakening Response begins its pre-dawn surge 30–45 min before waking — a 50–100% spike that primes the brain for the day. Sets your entire circadian energy and motivation baseline.', emoji: '⚡', peak: 42 },
    { name: 'BDNF', role: 'Brain-Derived Neurotrophic Factor — the brain\'s fertiliser. Elevated in pre-dawn hours. Supports neuroplasticity, memory consolidation, and the formation of new neural connections during meditation.', emoji: '🧠', peak: 78 },
    { name: 'Serotonin (Rising)', role: 'Transitioning from melatonin dominance toward serotonin — the mood, motivation and wakefulness neurotransmitter. The pre-dawn window sets this transition cleanly, determining mood tone for the entire day.', emoji: '😊', peak: 48 },
    { name: 'Melatonin (Declining)', role: 'Completing its overnight role and declining toward wakefulness. The melatonin–serotonin handoff in Brahma Muhurta is one of the most important hormonal transitions of the 24-hour cycle.', emoji: '🌅', peak: 45 },
  ],
  evening_kapha: [
    { name: 'Melatonin (Rising)', role: 'Sleep-onset hormone synthesised by the pineal gland as light fades. Blue light at 460–480 nm suppresses it by 85%. Rising now, peaks around midnight. Ayurveda: primary Ojas-restoration signal.', emoji: '🌙', peak: 38 },
    { name: 'GABA', role: 'Primary inhibitory neurotransmitter — the nervous system\'s brake pedal. Rising in the evening, reducing neural excitation and easing the brain toward deep sleep. Correlates with Kapha Sthira (stability) quality.', emoji: '😌', peak: 68 },
    { name: 'Serotonin → Melatonin', role: 'Serotonin is the melatonin precursor — pineal gland converts serotonin to melatonin via AANAT enzyme as darkness falls. In Ayurveda: this is Ojas (vital essence) flowing from active (Pitta) to restorative (Kapha).', emoji: '💛', peak: 55 },
    { name: 'Cortisol (Nadir)', role: 'HPA axis quieting — falling from morning peak (~500 nmol/L) to evening nadir (~100 nmol/L). Stress, arguments, or screens after sunset disrupt this critical decline and directly suppress GH secretion later in sleep.', emoji: '📉', peak: 18 },
  ],
};

const PERIOD_PROCESSES: Partial<Record<string, { name: string; detail: string; emoji: string }[]>> = {
  night_pitta: [
    { name: 'GH Surge (Slow-Wave Sleep)', detail: 'Pituitary releases GH in 1–2 hr pulses during Stage 3–4 sleep · anabolic master signal · muscle & tissue repair', emoji: '🔬' },
    { name: 'Liver CYP450 Detox', detail: 'Phase I (oxidation) + Phase II (conjugation) · maximally active 1–3 AM · neutralises 200+ metabolic toxins', emoji: '🫀' },
    { name: 'Cellular Autophagy', detail: 'Cells digest damaged proteins & organelles · halted immediately by any caloric intake · the body\'s anti-aging cycle', emoji: '♻️' },
    { name: 'DNA Repair', detail: 'NER + BER repair enzymes most active · corrects DNA damage from day\'s oxidative stress · prevents mutation accumulation', emoji: '🛡️' },
  ],
  night_vata: [
    { name: 'Brahma Muhurta Window', detail: '96–48 min before sunrise · alpha-theta brainwaves peak · subconscious-conscious veil thinnest · meditation most potent', emoji: '✨' },
    { name: 'Cortisol Awakening Response', detail: '50–100% cortisol spike begins · sets circadian tone for full day · disrupted by light or screen exposure', emoji: '⚡' },
    { name: 'Glymphatic System Finalisation', detail: 'Brain\'s CSF-based waste-clearance finalises · flushes beta-amyloid and metabolic debris from neurons', emoji: '🧠' },
    { name: 'Neuroplasticity Peak', detail: 'BDNF elevated · alpha-theta EEG confirmed · new neural connections form most readily · learning and intention embed deepest', emoji: '🌊' },
  ],
  evening_kapha: [
    { name: 'Melatonin Synthesis', detail: 'Pineal AANAT enzyme converts serotonin → melatonin · rises 10× above daytime levels by midnight · light exposure halts this', emoji: '🌙' },
    { name: 'Parasympathetic NS Takeover', detail: 'Vagal tone increases · HRV shifts to high-frequency band · rest-and-digest mode initiated · Ojas restoration begins', emoji: '😌' },
    { name: 'Core Temperature Descent', detail: 'Hypothalamic set-point drops ~1°C overnight · peripheral vasodilation dissipates body heat · critical sleep-onset signal', emoji: '❄️' },
    { name: 'Cellular Repair Preparation', detail: 'Autophagy initiates · GH pre-surge begins · anabolic repair window opens as cortisol clears the system', emoji: '✨' },
  ],
};

type DoshaKey = 'kapha' | 'pitta' | 'vata';

// ── Pomodoro Timer ────────────────────────────────────────────────────────────
function PomodoroTimer({ minutes, label, color }: { minutes: number; label: string; color: string }) {
  const [secs, setSecs] = useState(minutes * 60);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (running) {
      timerRef.current = setInterval(() => {
        setSecs(s => {
          if (s <= 1) { clearInterval(timerRef.current!); setRunning(false); setDone(true); return 0; }
          return s - 1;
        });
      }, 1000);
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])).start();
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      pulseAnim.stopAnimation();
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [running]);

  const total = minutes * 60;
  const prog = Math.max(0, (total - secs) / total);
  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');

  const reset = () => { setSecs(total); setRunning(false); setDone(false); };

  return (
    <View style={{ borderRadius: 22, borderWidth: 1, borderColor: color + '45', backgroundColor: color + '0C', overflow: 'hidden' }}>
      <LinearGradient colors={[color + '22', color + '08', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFillObject} />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.25)' }} />
      <View style={{ padding: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 14 }}>
          <Text style={{ fontSize: 8, fontWeight: '900', color: color + 'AA', letterSpacing: 1.6 }}>⏱  {label.toUpperCase()}  ·  DINACHARYA TOOL</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Animated.View style={{ transform: [{ scale: running ? pulseAnim : 1 }] }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: done ? '#22c55e' : color + '80', backgroundColor: color + '18', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 22, fontWeight: '900', color: done ? '#22c55e' : '#FFFFFF', letterSpacing: -1 }}>{done ? '✓' : `${mm}:${ss}`}</Text>
              {!done && <Text style={{ fontSize: 7, color: '#FFFFFF40', fontWeight: '700' }}>remaining</Text>}
            </View>
          </Animated.View>
          <View style={{ flex: 1, gap: 8 }}>
            <View style={{ height: 5, borderRadius: 99, backgroundColor: color + '22', overflow: 'hidden' }}>
              <View style={{ height: '100%', borderRadius: 99, backgroundColor: done ? '#22c55e' : color, width: `${Math.round(prog * 100)}%` as any, opacity: 0.9 }} />
            </View>
            <Text style={{ fontSize: 11, color: '#FFFFFF70', lineHeight: 16 }}>
              {done ? '🎉 Session complete! Great work.' : running ? `Prana (life-force) flows best in focused bursts. Stay present.` : `Set your ${label.toLowerCase()} for ${minutes} minutes. Undistracted.`}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity onPress={() => setRunning(r => !r)} activeOpacity={0.8}
                style={{ flex: 1, paddingVertical: 9, borderRadius: 12, backgroundColor: running ? color + '30' : color, borderWidth: 1, borderColor: color + '80', alignItems: 'center' }}>
                <Text style={{ fontSize: 11, fontWeight: '900', color: running ? color : '#000000CC', letterSpacing: 0.5 }}>{running ? '⏸  Pause' : done ? '▶  Again' : '▶  Start'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={reset} activeOpacity={0.8}
                style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center' }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#FFFFFF60' }}>↺</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

// ── Hormone Bar ───────────────────────────────────────────────────────────────
function HormoneBar({ name, role, emoji, peak, color }: { name: string; role: string; emoji: string; peak: number; color: string }) {
  const barAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(barAnim, { toValue: peak / 100, duration: 900, useNativeDriver: false, delay: 200 }).start();
  }, []);
  const barW = barAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${peak}%`] });
  const levelLabel = peak >= 85 ? 'PEAK NOW' : peak >= 70 ? 'ELEVATED' : 'MODERATE';
  const levelColor = peak >= 85 ? '#60a5fa' : peak >= 70 ? color : '#fbbf24';
  return (
    <View style={{ borderRadius: 16, borderWidth: 1, borderColor: color + '30', backgroundColor: color + '0C', paddingHorizontal: 14, paddingVertical: 13, marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: color + '22', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 18 }}>{emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 13, fontWeight: '900', color: color }}>{name}</Text>
            <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 99, backgroundColor: levelColor + '22', borderWidth: 1, borderColor: levelColor + '55' }}>
              <Text style={{ fontSize: 7, fontWeight: '900', color: levelColor, letterSpacing: 1 }}>{levelLabel}</Text>
            </View>
          </View>
          <Text style={{ fontSize: 10, color: '#FFFFFFAA', lineHeight: 15, marginTop: 2 }}>{role}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 8, color: '#FFFFFF35', fontWeight: '700', width: 26 }}>0%</Text>
        <View style={{ flex: 1, height: 7, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
          <Animated.View style={{ height: '100%', borderRadius: 99, backgroundColor: color, width: barW, opacity: 0.88 }} />
        </View>
        <Text style={{ fontSize: 8, color: color + 'CC', fontWeight: '900', width: 32, textAlign: 'right' }}>{peak}%</Text>
      </View>
    </View>
  );
}

// ── 24-hr Phase Timeline ──────────────────────────────────────────────────────
function PhaseTimeline({ currentId, color }: { currentId: string; color: string }) {
  const order = ['night_vata', 'morning_kapha', 'midday_pitta', 'afternoon_vata', 'evening_kapha', 'night_pitta'];
  const labels: Record<string, { short: string; emoji: string; col: string }> = {
    night_vata:     { short: 'Pre-Dawn', emoji: '✨', col: '#818cf8' },
    morning_kapha:  { short: 'Morning', emoji: '💪', col: '#34d399' },
    midday_pitta:   { short: 'Midday', emoji: '🔥', col: '#fb923c' },
    afternoon_vata: { short: 'Afternoon', emoji: '🌬️', col: '#a78bfa' },
    evening_kapha:  { short: 'Evening', emoji: '🌅', col: '#34d399' },
    night_pitta:    { short: 'Night', emoji: '🌕', col: '#fbbf24' },
  };
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: 16, marginBottom: 4 }} contentContainerStyle={{ gap: 6, paddingRight: 6, paddingBottom: 4 }}>
      {order.map(id => {
        const l = labels[id];
        const isActive = id === currentId;
        return (
          <View key={id} style={{ alignItems: 'center', gap: 4 }}>
            <View style={{ paddingHorizontal: isActive ? 12 : 9, paddingVertical: isActive ? 7 : 5, borderRadius: 12, borderWidth: 1.5, borderColor: isActive ? l.col : l.col + '40', backgroundColor: isActive ? l.col + '28' : l.col + '0C', alignItems: 'center', gap: 2 }}>
              <Text style={{ fontSize: isActive ? 18 : 14 }}>{l.emoji}</Text>
              <Text style={{ fontSize: 7, fontWeight: '900', color: isActive ? l.col : l.col + '80', letterSpacing: 0.6 }} numberOfLines={1}>{l.short}</Text>
            </View>
            {isActive && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: l.col }} />}
          </View>
        );
      })}
    </ScrollView>
  );
}

// ── Body Rhythm Task Card ─────────────────────────────────────────────────────
function BodyRhythmTask({ text, why, color, isDo }: { text: string; why: string; color: string; isDo: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const accentColor = isDo ? color : '#f43f5e';
  return (
    <TouchableOpacity onPress={() => setExpanded(v => !v)} activeOpacity={0.85}
      style={{ borderRadius: 16, borderWidth: 1, borderColor: accentColor + '40', backgroundColor: accentColor + '0A', marginBottom: 9, overflow: 'hidden' }}>
      <LinearGradient colors={[accentColor + '18', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
      <View style={{ padding: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: accentColor + '22', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 16 }}>{getEmoji(text, isDo)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: '#FFFFFFEE', lineHeight: 18 }}>{text}</Text>
            {!expanded && <Text style={{ fontSize: 10, color: accentColor + '90', marginTop: 2, fontWeight: '600' }} numberOfLines={1}>{why}</Text>}
          </View>
          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: accentColor + '20', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: accentColor + '40' }}>
            <Text style={{ fontSize: 9, fontWeight: '900', color: accentColor }}>{expanded ? '↑' : '↓'}</Text>
          </View>
        </View>
        {expanded && (
          <View style={{ marginTop: 12, backgroundColor: 'rgba(0,0,0,0.28)', borderRadius: 10, padding: 10, borderLeftWidth: 2, borderLeftColor: accentColor }}>
            <Text style={{ fontSize: 8, fontWeight: '900', color: accentColor + 'AA', letterSpacing: 1.2, marginBottom: 5 }}>🔬  WHY YOUR BODY {isDo ? 'THRIVES' : 'STRUGGLES'} WITH THIS NOW</Text>
            <Text style={{ fontSize: 12, color: '#FFFFFFB8', lineHeight: 19 }}>{why}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── Ayurveda 101 Collapsible ──────────────────────────────────────────────────
function Ayurveda101({ color, router }: { color: string; router: ReturnType<typeof useRouter> }) {
  const [open, setOpen] = useState(false);

  const DOSHAS = [
    {
      name: 'Vata', emoji: '🌬️', col: '#a78bfa',
      elements: 'Vayu (Air) + Akasha (Space)',
      principle: 'Movement, neural signals, breath, creativity',
      body: 'Autonomic nervous system, all 86 billion neurons, every heartbeat, peristalsis, respiratory rhythm — anything that moves in the body is Vata.',
      modern: 'Autonomic Nervous System · Neurotransmission · Enteric Nervous System',
    },
    {
      name: 'Pitta', emoji: '🔥', col: '#fb923c',
      elements: 'Agni (Fire) + Jala (Water)',
      principle: 'Metabolism, digestion, transformation, intelligence',
      body: 'Every biochemical reaction — mitochondria producing ATP, liver enzymes detoxifying, gastric acid digesting food, the immune system recognising threats.',
      modern: 'Metabolic-Endocrine Axis · Hepatic Detox · HPA Cortisol System',
    },
    {
      name: 'Kapha', emoji: '💧', col: '#34d399',
      elements: 'Prithvi (Earth) + Jala (Water)',
      principle: 'Structure, immunity, lubrication, stability',
      body: 'Every solid structure — bones, muscles, connective tissue, the lymphatic network (600+ nodes), mucus membranes, synovial joint fluid, all anabolic repair.',
      modern: 'Anabolic Hormone Axis · Lymphatic-Immune System · Connective Tissue',
    },
  ];

  const ELEMENTS = [
    { name: 'Prithvi', eng: 'Earth', emoji: '🌍', body: 'Bones, teeth, muscle fibre, solid organ tissue — the structural scaffold' },
    { name: 'Jala', eng: 'Water', emoji: '💧', body: 'Blood plasma, lymph, bile, synovial fluid, saliva, cerebrospinal fluid' },
    { name: 'Agni', eng: 'Fire', emoji: '🔥', body: 'Mitochondrial ATP synthesis, digestive enzymes, body heat, neural electricity' },
    { name: 'Vayu', eng: 'Air', emoji: '🌬️', body: 'Breath (O₂/CO₂), nerve impulses (−70 mV), electrochemical gradients across all membranes' },
    { name: 'Akasha', eng: 'Space', emoji: '✨', body: 'Synaptic clefts, hollow channels (arteries, gut), the 15 L extracellular fluid matrix' },
  ];

  const EXPLORE_LINKS = [
    { label: 'Discover Your Dosha Type', sub: 'Prakriti body-type quiz', emoji: '🧬', route: '/prakriti-quiz' },
    { label: 'The 5 Energy Bodies', sub: 'Pancha Kosha framework', emoji: '✨', route: '/pancha-kosha' },
    { label: 'Explore All Doshas', sub: 'Deep Ayurvedic biology', emoji: '🕉️', route: '/dosha-explore' },
  ];

  return (
    <View style={{ marginHorizontal: 16, marginTop: 28 }}>
      {/* Collapsed header — always visible */}
      <TouchableOpacity onPress={() => setOpen(v => !v)} activeOpacity={0.85}
        style={{ borderRadius: 20, borderWidth: 1, borderColor: '#a78bfa35', backgroundColor: '#a78bfa0A', overflow: 'hidden' }}>
        <LinearGradient colors={['#a78bfa18', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.20)' }} />
        <View style={{ padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: '#a78bfa20', borderWidth: 1, borderColor: '#a78bfa50', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 24 }}>🕉️</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 8, fontWeight: '900', color: '#a78bfa80', letterSpacing: 1.5, marginBottom: 3 }}>NEW TO AYURVEDA?</Text>
            <Text style={{ fontSize: 15, fontWeight: '900', color: '#FFFFFF', lineHeight: 20 }}>Ayurveda 101</Text>
            <Text style={{ fontSize: 11, color: '#FFFFFF50', marginTop: 2 }}>The complete beginner's foundation</Text>
          </View>
          <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#a78bfa18', borderWidth: 1, borderColor: '#a78bfa40', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 12, fontWeight: '900', color: '#a78bfa' }}>{open ? '↑' : '↓'}</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Expanded content */}
      {open && (
        <View style={{ marginTop: 10, gap: 10 }}>

          {/* What is Ayurveda */}
          <View style={{ borderRadius: 18, borderWidth: 1, borderColor: '#a78bfa28', backgroundColor: '#a78bfa08', padding: 18 }}>
            <Text style={{ fontSize: 8, fontWeight: '900', color: '#a78bfa80', letterSpacing: 1.5, marginBottom: 10 }}>WHAT IS AYURVEDA</Text>
            <Text style={{ fontSize: 20, fontWeight: '900', color: '#a78bfa', marginBottom: 10 }}>Āyur = Life  ·  Veda = Science</Text>
            <Text style={{ fontSize: 13.5, color: '#FFFFFFB0', lineHeight: 22, marginBottom: 12 }}>
              The world's oldest complete health system — over 5,000 years old, originating in ancient India. Ayurveda sees the human body as a microcosm of the universe, composed of five elements that combine into three biological forces (Doshas) governing every physical and mental process.
            </Text>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 12, borderLeftWidth: 2, borderLeftColor: '#a78bfa60' }}>
              <Text style={{ fontSize: 8, fontWeight: '900', color: '#38bdf875', letterSpacing: 1.3, marginBottom: 6 }}>🏆  MODERN SCIENCE VALIDATION</Text>
              <Text style={{ fontSize: 12.5, color: '#FFFFFF80', lineHeight: 20 }}>
                The 2017 Nobel Prize in Physiology was awarded for discovering the circadian clock genes (CLOCK, BMAL1, PER, CRY) — independently confirming the circadian framework Ayurvedic seers mapped thousands of years ago as Dinacharya (daily rhythm).
              </Text>
            </View>
          </View>

          {/* Three Doshas */}
          <View style={{ borderRadius: 18, borderWidth: 1, borderColor: '#a78bfa28', backgroundColor: '#a78bfa06', padding: 18 }}>
            <Text style={{ fontSize: 8, fontWeight: '900', color: '#a78bfa80', letterSpacing: 1.5, marginBottom: 14 }}>THE 3 DOSHAS  ·  TRI-DOSHA THEORY</Text>
            <Text style={{ fontSize: 13, color: '#FFFFFF70', lineHeight: 20, marginBottom: 16 }}>
              Everything in your body is governed by three biological forces — Doshas. They are not diseases or defects. They are the fundamental operating principles of life itself.
            </Text>
            {DOSHAS.map((d, i) => (
              <View key={i} style={{ marginBottom: i < 2 ? 14 : 0, borderRadius: 14, borderWidth: 1, borderColor: d.col + '35', backgroundColor: d.col + '0C', padding: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <Text style={{ fontSize: 24 }}>{d.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '900', color: d.col }}>{d.name}</Text>
                    <Text style={{ fontSize: 10, color: d.col + '90', fontWeight: '700' }}>{d.elements}</Text>
                  </View>
                  <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, backgroundColor: d.col + '20', borderWidth: 1, borderColor: d.col + '40' }}>
                    <Text style={{ fontSize: 7, fontWeight: '900', color: d.col, letterSpacing: 0.8 }}>FORCE</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 11, fontWeight: '800', color: d.col + 'CC', marginBottom: 6 }}>{d.principle}</Text>
                <Text style={{ fontSize: 12, color: '#FFFFFF80', lineHeight: 19, marginBottom: 8 }}>{d.body}</Text>
                <View style={{ height: 1, backgroundColor: d.col + '20', marginBottom: 8 }} />
                <Text style={{ fontSize: 8, fontWeight: '900', color: '#38bdf870', letterSpacing: 1, marginBottom: 3 }}>⟷  WESTERN BIOLOGY</Text>
                <Text style={{ fontSize: 10, color: d.col + '80', fontWeight: '700' }}>{d.modern}</Text>
              </View>
            ))}
          </View>

          {/* Pancha Mahabhuta — 5 Elements */}
          <View style={{ borderRadius: 18, borderWidth: 1, borderColor: '#a78bfa28', backgroundColor: '#a78bfa06', padding: 18 }}>
            <Text style={{ fontSize: 8, fontWeight: '900', color: '#a78bfa80', letterSpacing: 1.5, marginBottom: 6 }}>PANCHA MAHABHUTA</Text>
            <Text style={{ fontSize: 15, fontWeight: '900', color: '#FFFFFF', marginBottom: 12 }}>The 5 Great Elements in Your Body</Text>
            {ELEMENTS.map((el, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: i < 4 ? 12 : 0 }}>
                <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: '#a78bfa18', borderWidth: 1, borderColor: '#a78bfa35', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Text style={{ fontSize: 16 }}>{el.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <Text style={{ fontSize: 13, fontWeight: '900', color: '#a78bfaDD' }}>{el.name}</Text>
                    <Text style={{ fontSize: 10, color: '#a78bfa70', fontWeight: '700' }}>({el.eng})</Text>
                  </View>
                  <Text style={{ fontSize: 12, color: '#FFFFFF70', lineHeight: 18 }}>{el.body}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Dinacharya */}
          <View style={{ borderRadius: 18, borderWidth: 1, borderColor: '#fbbf2428', backgroundColor: '#fbbf2406', padding: 18 }}>
            <Text style={{ fontSize: 8, fontWeight: '900', color: '#fbbf2480', letterSpacing: 1.5, marginBottom: 6 }}>DINACHARYA  ·  DAILY RHYTHM</Text>
            <Text style={{ fontSize: 15, fontWeight: '900', color: '#FFFFFF', marginBottom: 10 }}>Dina = Day  ·  Charya = Discipline</Text>
            <Text style={{ fontSize: 13, color: '#FFFFFFB0', lineHeight: 22, marginBottom: 12 }}>
              The Ayurvedic daily routine — aligning your activities with the natural cycles of the Doshas throughout the day. This page is your Dinacharya guide: every action you take in sync with your body's biological clock has a measurably greater benefit.
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {['2–6 AM  ·  Vata', '6–10 AM  ·  Kapha', '10 AM–2 PM  ·  Pitta', '2–6 PM  ·  Vata', '6–10 PM  ·  Kapha', '10 PM–2 AM  ·  Pitta'].map((s, i) => (
                <View key={i} style={{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: 99, backgroundColor: '#fbbf2415', borderWidth: 1, borderColor: '#fbbf2430' }}>
                  <Text style={{ fontSize: 8, fontWeight: '800', color: '#fbbf24CC' }}>{s}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Explore Links */}
          <View style={{ borderRadius: 18, borderWidth: 1, borderColor: '#a78bfa28', backgroundColor: '#a78bfa06', padding: 18 }}>
            <Text style={{ fontSize: 8, fontWeight: '900', color: '#a78bfa80', letterSpacing: 1.5, marginBottom: 14 }}>GO DEEPER  ·  EXPLORE</Text>
            {EXPLORE_LINKS.map((link, i) => (
              <TouchableOpacity key={i} onPress={() => router.push(link.route as any)} activeOpacity={0.8}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: i < 2 ? 1 : 0, borderBottomColor: '#a78bfa18' }}>
                <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: '#a78bfa18', borderWidth: 1, borderColor: '#a78bfa40', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 18 }}>{link.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#FFFFFF', lineHeight: 18 }}>{link.label}</Text>
                  <Text style={{ fontSize: 10, color: '#FFFFFF55', marginTop: 2 }}>{link.sub}</Text>
                </View>
                <Text style={{ fontSize: 18, color: '#a78bfa70', fontWeight: '900' }}>→</Text>
              </TouchableOpacity>
            ))}
          </View>

        </View>
      )}
    </View>
  );
}

// ── Section Label ─────────────────────────────────────────────────────────────
function SectionLabel({ title, color }: { title: string; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 28, marginBottom: 12 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: '#FFFFFF0E' }} />
      <Text style={{ fontSize: 8, fontWeight: '900', color: color + '99', letterSpacing: 1.8 }}>{title}</Text>
      <View style={{ flex: 1, height: 1, backgroundColor: '#FFFFFF0E' }} />
    </View>
  );
}

// ── Activity WHY explanations ─────────────────────────────────────────────────
const ACTIVITY_WHY: Record<string, string> = {
  'Creative brainstorming & design': 'Dopamine peaks now, activating the prefrontal cortex\'s default mode network — the neural circuit responsible for imagination and pattern synthesis. Your brain is literally wired for creativity in this window.',
  'Sports, exercise & HIIT': 'Lung vital capacity peaks at 3–4 PM (spirometry confirmed). Core body temperature is at daily high, muscles are pre-warmed, reaction time and VO₂max are optimal. 80% of Olympic records are broken in this window.',
  'Collaboration & communication': 'Norepinephrine sharpens social signal processing. Verbal fluency and emotional intelligence are heightened. This is the ideal time for team synergy, pitching ideas, or any high-stakes conversation.',
  'Light snack if needed': 'Blood glucose may dip slightly after midday digestion. A light, protein-rich snack stabilises glucose without triggering a Pitta digestive burden that would dampen your neural sharpness.',
  'Walking meetings': 'Bilateral movement (left/right stride) synchronises the brain\'s two hemispheres — research shows walking meetings improve creative output by 81% (Stanford, 2014). Motion activates Vata Prana optimally.',
  'Learning physical skills': 'Motor learning and procedural memory encoding peak with dopamine. The cerebellum absorbs timing patterns most efficiently when catecholamines are high. Learn instruments, sports, or manual skills now.',
  'Yoga & Sun Salutations': 'Morning Kapha creates joint stiffness. Surya Namaskar (Sun Salutations) activate synovial fluid release into joints, raise core temperature, and co-regulate the Cortisol Awakening Response with physical breath rhythm.',
  'Strength training': 'Testosterone is 20–25% above evening baseline. mTOR muscle-building pathway is maximally responsive to mechanical load. Glycogen stores are full. This is your anabolic window.',
  'Light nourishing breakfast': 'Agni (digestive fire) is still awakening in Kapha phase. A light, warm, easily digestible meal respects this — avoid overwhelming a gentle morning metabolism.',
  'Abhyanga · oil self-massage': 'Warm sesame oil applied to skin stimulates cutaneous mechanoreceptors, activating vagal tone. Research shows it reduces cortisol by 28% and upregulates parasympathetic output (Ironson et al.).',
  'Morning walk in sunlight': 'Early photons hitting the retina suppress melatonin immediately and synchronise the suprachiasmatic nucleus (SCN) — your master circadian clock. This single act improves sleep quality that night by 30%.',
  'Main & largest meal of the day': 'HCl, bile acids, pepsin and all pancreatic enzymes peak at solar noon. Insulin sensitivity is 30% higher. Every macronutrient you eat is processed with maximum efficiency right now. Never skip lunch.',
  'Deep focused cognitive work': 'Core body temperature peaks at 2–3 PM, which drives cognitive processing speed. IQ-type problem solving, executive function, and logical reasoning are statistically highest in this window.',
  'Decision-making & strategy': 'Cortisol and dopamine together create optimal signal-clarity in the prefrontal cortex — the brain\'s CEO. High-stakes decisions made now have the lowest error rate in the circadian day.',
  'Complex problem-solving': 'Working memory capacity and processing bandwidth peak with midday cortisol and thermal regulation. The hippocampus consolidates new associative links most efficiently in this zone.',
  'Learning new material': 'Acetylcholine (memory encoding) and dopamine (reward motivation for learning) co-peak. Hippocampal long-term potentiation (LTP) — the molecular basis of memory — is most active.',
  'Important meetings & negotiations': 'Verbal fluency, emotional regulation, and cognitive speed all peak in the Pitta window. Your arguments are sharper, your presence more commanding, your read on others more accurate.',
  'Silent meditation & dhyana': 'Pre-dawn alpha-theta brainwaves create the ideal substrate for deep meditation. The veil between subconscious and conscious mind is thinnest. Brahma Muhurta (96–48 min before sunrise) is the pinnacle.',
  'Mantra japa / chanting': 'Repetitive vocal vibration at specific frequencies activates vagal tone and creates coherent heart-rate variability patterns. The pre-dawn silence amplifies neural resonance.',
  'Breathwork & deep nervous system reset': 'Pre-dawn parasympathetic dominance and low cortisol make this the most receptive window for breathwork. 4-7-8 or pranayama breathing now sets your HRV baseline for the entire day.',
  'Sankalpa (intention-setting)': 'The subconscious mind is most malleable in the hypnagogic state between sleep and waking. Intentions (Sankalpa) set now bypass the critical-factor mind and embed deeply in neural patterning.',
  'Light early dinner (before 7 PM)': 'Melatonin begins rising after sunset. Insulin sensitivity drops significantly in the evening. A light early dinner ensures the gut clears before sleep — protecting deep-sleep GH secretion and liver detox.',
  'Family & social bonding': 'Cortisol is naturally declining; oxytocin becomes the dominant social hormone. Parasympathetic activation creates genuine openness and warmth. This is the relational healing window.',
  'Gentle yoga / stretching': 'As core temperature slowly falls in Kapha Dusk, light stretching supports the lymphatic clearance of metabolic waste accumulated during the day. It also activates GABA — the rest-and-digest signal.',
  'Journaling & self-reflection': 'The prefrontal cortex is still active but softening. Writing while cortisol falls allows access to deeper emotional states. This bridges Pitta\'s clarity with Kapha\'s emotional depth.',
  'Deep uninterrupted sleep (7–8 hrs)': 'Growth Hormone peaks in slow-wave NREM sleep (Stages 3–4). Liver CYP450 detox enzymes are maximally active. Autophagy clears cellular debris. Sleep is not rest — it is intensive repair. Every hour counts.',
  'Dream journaling upon waking': 'REM sleep consolidates emotional memories and creative connections. Capturing dreams immediately upon waking bridges unconscious neural processing into conscious insight.',
};

const AVOIDANCE_WHY: Record<string, string> = {
  'Heavy afternoon meal': 'Pachaka Agni (digestive fire) has passed its solar noon peak. Heavy food now creates an Ama (undigested metabolic waste) burden, draws blood to the gut, and directly blunts dopamine-driven neural sharpness — you\'ll feel the afternoon crash.',
  'Afternoon nap >20 min': 'A nap longer than 20 minutes enters slow-wave sleep, causing sleep inertia — a groggy, dopamine-depleted state that can last 30–90 minutes. You\'ll waste your entire neural peak window recovering.',
  'Isolating from others': 'This is a social + creative peak. Isolation suppresses the dopamine circuit that thrives on novel stimulation and collaboration. Research shows social engagement in this window increases creative output by 40%.',
  'Suppressing creative impulses': 'Vata energy suppressed becomes anxiety. Unexpressed Vata Prana recirculates in the nervous system as restlessness, racing thoughts, and creative frustration — a direct pathway to evening Vata imbalance.',
  'Heavy fried breakfast': 'Agni (digestive fire) is still low in morning Kapha. Fried, heavy food overwhelms weak morning digestion, creating Ama — undigested metabolic waste that clogs lymphatic and immune channels.',
  'Sleeping in / daytime nap': 'Excess Kapha sleep suppresses the Cortisol Awakening Response (CAR) and prevents lymphatic drainage. Every hour of oversleeping increases lethargy and blunts the anabolic hormone cascade.',
  'Excessive caffeine': 'Morning cortisol is already at its peak. Caffeine on top of peak cortisol creates cortisol stacking — elevated stress hormones that crash your adrenal system by early afternoon.',
  'Immediately checking phone': 'The first 30 minutes of waking is the critical window for cortisol-driven motivation and intentional brain state setting. Social media flooding this window hijacks dopamine and programs reactive thinking for the entire day.',
  'Skipping or delaying lunch': 'When digestive enzymes peak and no food arrives, HCl begins breaking down the gastric lining itself — causing hypersecretion, reflux, and an Amlapitta (acid imbalance) that disrupts the entire afternoon.',
  'Overworking without breaks': 'Pitta imbalance (Atiyoga — excess use) depletes Sadhaka Pitta (the mental fire). Without breaks, cortisol spikes erratically, working memory degrades, and the liver\'s detox load increases from stress hormones.',
  'Excessive spicy / fried food': 'Pitta is already blazing at noon. Spicy, oily, and acidic foods pour oil onto fire — triggering Bhrajaka Pitta (skin inflammation), Sadhaka Pitta (irritability), and Ranjaka Pitta (liver heat).',
  'Anger, conflict & arguments': 'Pitta emotion is anger. Midday emotional conflict elevates cortisol, CRH, and amygdala activation at the worst possible time — undermining the prefrontal cognitive clarity this window is built for.',
  'Heavy late dinner': 'Eating heavily after 8 PM with rising melatonin creates metabolic confusion. Insulin spikes suppress GH secretion in sleep. The liver cannot detox efficiently while simultaneously processing a heavy meal.',
  'Bright screen use after 8 PM': 'Blue light at 460–480 nm directly suppresses melatonin synthesis by up to 85%. Even 1 hour of screen exposure after sunset delays sleep onset by 90 minutes and reduces deep-sleep duration by 15–20%.',
  'Stimulating intense exercise': 'Evening exercise raises cortisol, core temperature, and adrenaline — the exact opposites of what sleep preparation requires. It delays melatonin onset and reduces total sleep time by 23 minutes on average.',
  'Heavy food or drinks': 'The pre-dawn system is in deep Vata state — nervous and delicate. Any digestive load sends blood to the gut, disrupting the alpha-theta brainwave state essential for Brahma Muhurta meditation and neural recharge.',
  'Digital media & bright screens': 'Light during the pre-dawn Vata window catastrophically disrupts the Cortisol Awakening Response timing and permanently offsets the circadian clock. The worst time of day to check your phone.',
  'Eating or drinking (except water)': 'During nocturnal Pitta (11 PM – 3 AM), the body is in autophagy mode — cells are self-cleaning. Any caloric input halts autophagy immediately, disrupting the single most powerful anti-aging process your body performs.',
};

// ── Tomorrow's Phase Preview ──────────────────────────────────────────────────
const NEXT_PHASE: Record<string, string> = {
  night_vata: 'morning_kapha', morning_kapha: 'midday_pitta',
  midday_pitta: 'afternoon_vata', afternoon_vata: 'evening_kapha',
  evening_kapha: 'night_pitta', night_pitta: 'night_vata',
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PeriodDetailPage() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    periodId?: string; periodStart?: string;
    periodEnd?: string; minutesRemaining?: string; minutesTotal?: string;
  }>();

  const periodId = params.periodId ?? 'morning_kapha';
  const tmpl = PERIOD_TEMPLATES.find(t => t.id === periodId) ?? PERIOD_TEMPLATES[1];
  const doshaKey = (tmpl.dosha ?? 'kapha') as DoshaKey;
  const sci = DOSHA_SCIENCE[doshaKey];
  const C = '#60a5fa';

  const rem   = parseInt(params.minutesRemaining ?? '0', 10);
  const total = parseInt(params.minutesTotal ?? '240', 10);
  const prog  = total > 0 ? Math.min(1, Math.max(0, (total - rem) / total)) : 0;
  const remStr = rem >= 60 ? `${Math.floor(rem / 60)}h ${rem % 60}m` : `${rem}m`;

  const [factOpen, setFactOpen] = useState(false);
  const peakFact  = PERIOD_PEAK_FACTS[periodId]  ?? sci.peakFact;
  const balance   = PERIOD_BALANCE[periodId]    ?? sci.balance;
  const chemicals = PERIOD_CHEMICALS[periodId]  ?? sci.chemicals;
  const processes = PERIOD_PROCESSES[periodId]  ?? sci.processes;

  const nextId = NEXT_PHASE[periodId] ?? 'morning_kapha';
  const nextTmpl = PERIOD_TEMPLATES.find(t => t.id === nextId) ?? PERIOD_TEMPLATES[1];

  return (
    <View style={S.root}>
      <LinearGradient colors={[C + '30', '#07071C', '#050512']} style={StyleSheet.absoluteFillObject} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 0.65 }} />
      <SafeAreaView style={{ flex: 1 }}>

        {/* ── Header ── */}
        <View style={S.header}>
          <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
            <Text style={{ color: '#FFFFFF80', fontSize: 18, lineHeight: 22 }}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[S.headerLabel, { color: C + '95' }]}>DINACHARYA  ·  BODY SCIENCE</Text>
            <Text style={S.headerTitle} numberOfLines={1}>{tmpl.englishLabel}</Text>
          </View>
          <View style={[S.livePill, { borderColor: C + '55', backgroundColor: C + '18' }]}>
            <View style={[S.liveDot, { backgroundColor: C }]} />
            <Text style={[S.liveTxt, { color: C }]}>LIVE</Text>
          </View>
        </View>
        <View style={S.headerDivider} />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 72 }}>

          {/* ══ 24-HR PHASE TIMELINE ══════════════════════════════════════════ */}
          <View style={{ marginTop: 16, marginBottom: 4 }}>
            <Text style={{ fontSize: 7, fontWeight: '900', color: '#FFFFFF40', letterSpacing: 1.5, marginHorizontal: 16, marginBottom: 10 }}>YOUR 24-HOUR BODY CLOCK  ·  DINACHARYA</Text>
            <PhaseTimeline currentId={periodId} color={C} />
          </View>

          {/* ══ HERO — Identity + Progress ═══════════════════════════════════ */}
          <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <Text style={{ fontSize: 52 }}>{tmpl.emoji}</Text>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                  <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: 99, backgroundColor: C + '20', borderWidth: 1, borderColor: C + '55' }}>
                    <Text style={{ fontSize: 7, fontWeight: '900', color: C, letterSpacing: 1.2 }}>{sci.romanScript.toUpperCase()}  ·  ACTIVE NOW</Text>
                  </View>
                  {params.periodStart ? <Text style={{ fontSize: 9, color: C + '80', fontWeight: '700' }}>{params.periodStart}  →  {params.periodEnd}</Text> : null}
                </View>
                <Text style={{ fontSize: 21, fontWeight: '900', color: '#FFFFFF', lineHeight: 27 }}>{tmpl.englishLabel}</Text>
                <Text style={{ fontSize: 10, color: '#FFFFFF55', marginTop: 4, lineHeight: 16 }}>{sci.tagline}</Text>
              </View>
            </View>

            {/* Progress bar */}
            <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C + '28' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 }}>
                <Text style={{ fontSize: 8, fontWeight: '700', color: C + '80' }}>{params.periodStart ?? '—'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Text style={{ fontSize: 18, fontWeight: '900', color: C }}>{remStr}</Text>
                  <Text style={{ fontSize: 9, color: '#FFFFFF35', fontWeight: '600' }}>remaining</Text>
                </View>
                <Text style={{ fontSize: 8, fontWeight: '700', color: C + '80' }}>{params.periodEnd ?? '—'}</Text>
              </View>
              <View style={{ height: 8, borderRadius: 99, backgroundColor: C + '22', overflow: 'hidden' }}>
                <View style={{ height: '100%', borderRadius: 99, backgroundColor: C, width: `${Math.round(prog * 100)}%` as any, opacity: 0.9 }} />
              </View>
              <Text style={{ fontSize: 8, color: '#FFFFFF28', marginTop: 7, textAlign: 'center', fontWeight: '700', letterSpacing: 1 }}>{Math.round(prog * 100)}%  THROUGH THIS PHASE</Text>
            </View>
          </View>

          {/* ══ AYURVEDIC BRIEF CONTEXT — top decode card ════════════════════ */}
          <View style={{ marginHorizontal: 16, marginTop: 10, marginBottom: 2, borderRadius: 20, borderWidth: 1, borderColor: C + '38', backgroundColor: C + '07', overflow: 'hidden' }}>
            <LinearGradient colors={[C + '22', C + '0A', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.22)' }} />
            <View style={{ padding: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <View style={{ width: 48, height: 48, borderRadius: 15, backgroundColor: C + '22', borderWidth: 1, borderColor: C + '50', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 22 }}>🕉️</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 7, fontWeight: '900', color: '#38bdf875', letterSpacing: 1.5, marginBottom: 3 }}>AYURVEDA  ·  ĀYUR (LIFE) + VEDA (SCIENCE)</Text>
                  <Text style={{ fontSize: 15, fontWeight: '900', color: C, lineHeight: 20 }}>{sci.romanScript}</Text>
                  <Text style={{ fontSize: 9, color: '#FFFFFF55', marginTop: 2, lineHeight: 14 }}>{sci.elementEq}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.28)', borderRadius: 12, padding: 10, borderLeftWidth: 2, borderLeftColor: C }}>
                  <Text style={{ fontSize: 7, fontWeight: '900', color: C + 'AA', letterSpacing: 1.2, marginBottom: 4 }}>🕉  AYURVEDIC PRINCIPLE</Text>
                  <Text style={{ fontSize: 11, color: '#FFFFFFA0', lineHeight: 17 }}>{sci.tagline}</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.28)', borderRadius: 12, padding: 10, borderLeftWidth: 2, borderLeftColor: '#38bdf8' }}>
                  <Text style={{ fontSize: 7, fontWeight: '900', color: '#38bdf875', letterSpacing: 1.2, marginBottom: 4 }}>⟷  MODERN BIOLOGY</Text>
                  <Text style={{ fontSize: 9, color: '#FFFFFF70', fontWeight: '700', lineHeight: 15 }}>{sci.westernSystem}</Text>
                </View>
              </View>
              <View style={{ paddingHorizontal: 6, paddingVertical: 6, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: C + '20' }}>
                <Text style={{ fontSize: 11, color: '#FFFFFFB0', lineHeight: 18, textAlign: 'center' }} numberOfLines={2}>{sci.biology.slice(0, 120)}…</Text>
              </View>
            </View>
          </View>

          {/* ══ SCIENCE FACT — collapsible, collapsed by default ══════════════ */}
          <TouchableOpacity
            onPress={() => setFactOpen(v => !v)}
            activeOpacity={0.85}
            style={{ marginHorizontal: 16, marginTop: 10, borderRadius: 16, borderWidth: 1, borderColor: '#60a5fa40', backgroundColor: 'rgba(255,255,255,0.03)', overflow: 'hidden' }}>
            <LinearGradient colors={['#60a5fa1A', '#60a5fa08', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ padding: 13 }}>
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.20)' }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: factOpen ? 10 : 7 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#60a5fa' }} />
                  <Text style={{ fontSize: 7, fontWeight: '900', color: '#60a5faBB', letterSpacing: 1.5 }}>🔬  SCIENCE FACT  ·  RIGHT NOW IN YOUR BODY</Text>
                </View>
                <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: '#60a5fa50', backgroundColor: '#60a5fa18', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 10, color: '#60a5fa', fontWeight: '900', lineHeight: 14 }}>{factOpen ? '↑' : '↓'}</Text>
                </View>
              </View>
              <Text style={{ fontSize: 11, color: '#FFFFFF80', lineHeight: 17 }} numberOfLines={factOpen ? undefined : 2}>{peakFact}</Text>
              {factOpen && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
                  <View style={{ height: 1, flex: 1, backgroundColor: '#60a5fa20' }} />
                  <Text style={{ fontSize: 7, color: '#60a5fa80', fontWeight: '800', letterSpacing: 1 }}>TAP TO COLLAPSE  ↑</Text>
                  <View style={{ height: 1, flex: 1, backgroundColor: '#60a5fa20' }} />
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* ══ PRIMARY CTA ═══════════════════════════════════════════════════ */}
          <View style={{ marginTop: 16, marginHorizontal: 16 }}>
            <PomodoroTimer minutes={sci.pomodoroMinutes} label={sci.pomodoroLabel} color={C} />
          </View>

          {/* ══ BODY RHYTHM TASKS ═════════════════════════════════════════════ */}
          <SectionLabel title={`SUITS YOUR BODY RHYTHM NOW  ·  ${sci.romanScript.toUpperCase()} PHASE`} color={C} />
          <View style={{ paddingHorizontal: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12 }}>
              <View style={{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: 99, backgroundColor: C + '20', borderWidth: 1, borderColor: C + '40' }}>
                <Text style={{ fontSize: 7, fontWeight: '900', color: C, letterSpacing: 1.2 }}>✓  ALIGNED WITH YOUR BIOLOGY  ·  TAP TO UNDERSTAND WHY</Text>
              </View>
            </View>
            {tmpl.activities.map((act, i) => (
              <BodyRhythmTask key={i} text={act} why={ACTIVITY_WHY[act] ?? `Your ${sci.romanScript} phase hormones and circadian biology are specifically optimised for this activity right now. Timing this with your body clock multiplies its benefit.`} color={C} isDo={true} />
            ))}
          </View>

          {/* ══ DOES NOT SUIT BODY RHYTHM ═════════════════════════════════════ */}
          <SectionLabel title={`DOES NOT SUIT YOUR BODY RHYTHM NOW  ·  AVOID`} color="#f43f5e" />
          <View style={{ paddingHorizontal: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12 }}>
              <View style={{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: 99, backgroundColor: '#f43f5e18', borderWidth: 1, borderColor: '#f43f5e40' }}>
                <Text style={{ fontSize: 7, fontWeight: '900', color: '#f43f5e', letterSpacing: 1.2 }}>✕  WORKS AGAINST YOUR CURRENT BIOLOGY  ·  TAP TO UNDERSTAND WHY</Text>
              </View>
            </View>
            {tmpl.avoidances.map((av, i) => (
              <BodyRhythmTask key={i} text={av} why={AVOIDANCE_WHY[av] ?? `During your ${sci.romanScript} phase, this activity conflicts with the active hormonal and neurological state of your body. The biological cost is measurably higher right now than at other times.`} color={C} isDo={false} />
            ))}
          </View>

          {/* ══ AYURVEDIC SCIENCE LENS ════════════════════════════════════════ */}
          <SectionLabel title={`${sci.romanScript.toUpperCase()}  ·  THE AYURVEDIC SCIENCE`} color={C} />
          <View style={[S.glassCard, { borderColor: C + '35', marginHorizontal: 16 }]}>
            <LinearGradient colors={[C + '22', 'transparent']} style={StyleSheet.absoluteFillObject} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
            <View style={S.topGloss} />
            <View style={{ padding: 18 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <Text style={{ fontSize: 26 }}>🕉️</Text>
                <View>
                  <Text style={{ fontSize: 8, fontWeight: '900', color: C + '80', letterSpacing: 1.4, marginBottom: 3 }}>AYURVEDA  ·  ĀYUR (LIFE) + VEDA (SCIENCE)</Text>
                  <Text style={{ fontSize: 16, fontWeight: '900', color: C }}>{sci.romanScript}</Text>
                </View>
              </View>

              {/* Element equation */}
              <View style={{ backgroundColor: 'rgba(0,0,0,0.32)', borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: C + '30' }}>
                <Text style={{ fontSize: 8, fontWeight: '900', color: '#FFFFFF40', letterSpacing: 1.3, marginBottom: 7 }}>PANCHA MAHABHUTA  ·  THE FIVE GREAT ELEMENTS</Text>
                <Text style={{ fontSize: 14, fontWeight: '900', color: C, letterSpacing: 0.5 }}>{sci.elementEq}</Text>
              </View>

              {/* Element breakdowns */}
              {sci.elementBreakdown.map((el, i) => (
                <View key={i} style={{ marginBottom: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C + '25' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                    <Text style={{ fontSize: 20 }}>{el.emoji}</Text>
                    <View>
                      <Text style={{ fontSize: 12, fontWeight: '900', color: C + 'DD' }}>{el.sanskrit}  <Text style={{ fontSize: 10, color: C + '80', fontWeight: '700' }}>({el.english})</Text></Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 12, color: '#FFFFFFA0', lineHeight: 19 }}>{el.body}</Text>
                </View>
              ))}

              <View style={{ height: 1, backgroundColor: '#FFFFFF12', marginBottom: 12 }} />
              <Text style={{ fontSize: 8, fontWeight: '900', color: '#38bdf875', letterSpacing: 1.3, marginBottom: 7 }}>⟷  MODERN BIOLOGY EQUIVALENT</Text>
              <Text style={{ fontSize: 9, fontWeight: '700', color: C + '80', letterSpacing: 0.8, marginBottom: 10 }}>{sci.westernSystem}</Text>
              <Text style={{ fontSize: 13.5, color: '#FFFFFFB0', lineHeight: 22 }}>{sci.biology}</Text>
            </View>
          </View>

          {/* ══ WHAT'S HAPPENING IN YOUR BODY ════════════════════════════════ */}
          <SectionLabel title="WHAT'S HAPPENING IN YOUR BODY RIGHT NOW" color={C} />
          <View style={[S.glassCard, { borderColor: C + '40', marginHorizontal: 16 }]}>
            <LinearGradient colors={[C + '25', 'transparent']} style={StyleSheet.absoluteFillObject} />
            <View style={S.topGloss} />
            <View style={{ padding: 18 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <Text style={{ fontSize: 34 }}>{tmpl.sciEmoji}</Text>
                <Text style={[S.sciTitle, { color: C, flex: 1 }]}>{tmpl.sciTitle}</Text>
              </View>
              <Text style={S.sciDesc}>{tmpl.sciDesc}</Text>
            </View>
          </View>

          {/* ══ ACTIVE HORMONES WITH LEVEL BARS ══════════════════════════════ */}
          <SectionLabel title="ACTIVE HORMONES  ·  CURRENT LEVELS" color={C} />
          <View style={{ paddingHorizontal: 16 }}>
            <Text style={{ fontSize: 9, color: '#FFFFFF40', lineHeight: 15, marginBottom: 14 }}>
              Bar indicates relative % of daily peak. Levels are based on published circadian research for this time window.
            </Text>
            {chemicals.map((ch, i) => (
              <HormoneBar key={i} name={ch.name} role={ch.role} emoji={ch.emoji} peak={ch.peak} color={C} />
            ))}
          </View>

          {/* ══ KEY BODY PROCESSES ═══════════════════════════════════════════ */}
          <SectionLabel title="KEY BIOLOGICAL PROCESSES  ·  THIS PHASE" color={C} />
          <View style={{ paddingHorizontal: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {processes.map((fn, i) => (
              <View key={i} style={[S.processCard, { width: (W - 42) / 2, borderColor: C + '28', backgroundColor: C + '0A' }]}>
                <Text style={{ fontSize: 24, marginBottom: 8 }}>{fn.emoji}</Text>
                <Text style={[S.processName, { color: '#FFFFFFD0' }]}>{fn.name}</Text>
                <Text style={S.processDetail}>{fn.detail}</Text>
              </View>
            ))}
          </View>

          {/* ══ BALANCE PRACTICES ════════════════════════════════════════════ */}
          <SectionLabel title="BALANCE PRACTICES  ·  SCIENCE-BACKED" color={C} />
          <View style={{ paddingHorizontal: 16, gap: 10 }}>
            {balance.map((b, i) => (
              <View key={i} style={[S.practiceCard, { borderColor: C + '28', backgroundColor: C + '08' }]}>
                <Text style={[S.practiceName, { color: C + 'E0' }]}>{b.practice}</Text>
                <View style={S.scienceRow}>
                  <Text style={S.scienceLabel}>🔬  WHY IT WORKS</Text>
                  <Text style={S.scienceText}>{b.science}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* ══ SIGNS OF IMBALANCE ════════════════════════════════════════════ */}
          <SectionLabel title="SIGNS OF IMBALANCE  ·  WHEN THIS IS IGNORED" color="#f43f5e" />
          <View style={{ paddingHorizontal: 16, gap: 9 }}>
            {sci.imbalance.map((im, i) => (
              <View key={i} style={S.imbalanceCard}>
                <Text style={S.imbalanceName}>{im.symptom}</Text>
                <Text style={S.imbalanceSci}>{im.science}</Text>
              </View>
            ))}
          </View>

          {/* ══ AYURVEDA 101 — COLLAPSIBLE ═══════════════════════════════════ */}
          <Ayurveda101 color={C} router={router} />

          {/* ══ TOMORROW'S PHASE PREVIEW ══════════════════════════════════════ */}
          <SectionLabel title="COMING UP NEXT  ·  PREPARE NOW" color={nextTmpl.color} />
          <View style={{ marginHorizontal: 16, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: nextTmpl.color + '40' }}>
            <LinearGradient colors={[nextTmpl.color + '22', nextTmpl.color + '0A', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.20)' }} />
            <View style={{ padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{ width: 60, height: 60, borderRadius: 18, backgroundColor: nextTmpl.color + '20', borderWidth: 1.5, borderColor: nextTmpl.color + '55', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 28 }}>{nextTmpl.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 8, fontWeight: '900', color: nextTmpl.color + '80', letterSpacing: 1.4, marginBottom: 4 }}>NEXT PHASE  ·  {DOSHA_SCIENCE[nextTmpl.dosha as DoshaKey]?.romanScript?.toUpperCase()}</Text>
                <Text style={{ fontSize: 16, fontWeight: '900', color: '#FFFFFF', lineHeight: 22 }}>{nextTmpl.englishLabel}</Text>
                <Text style={{ fontSize: 11, color: '#FFFFFF55', marginTop: 3, lineHeight: 16 }}>{nextTmpl.sciEmoji}  {nextTmpl.sciTitle}</Text>
              </View>
              <Text style={{ fontSize: 22, color: nextTmpl.color + '90', fontWeight: '900' }}>→</Text>
            </View>
          </View>
          <View style={{ height: 10 }} />

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ── Emoji helper ──────────────────────────────────────────────────────────────
function getEmoji(text: string, isDo: boolean): string {
  const t = text.toLowerCase();
  if (/yoga|sun salut/i.test(t)) return '🧘';
  if (/strength|weight|training|gym|hiit|exercise/i.test(t)) return '💪';
  if (/walk|sunlight|outdoor/i.test(t)) return '🚶';
  if (/meal|breakfast|lunch|dinner|food|eat|nourish/i.test(t)) return isDo ? '🥗' : '🍔';
  if (/oil|abhyanga|massage/i.test(t)) return '🫧';
  if (/meditat|dhyana|prayer/i.test(t)) return '🧘';
  if (/breath|pranayama|kapalbhati/i.test(t)) return '🌬️';
  if (/sleep|nap/i.test(t)) return isDo ? '😴' : '🛌';
  if (/screen|phone|digital|blue.?light|media/i.test(t)) return '📵';
  if (/caffeine|coffee/i.test(t)) return isDo ? '☕' : '☕';
  if (/journal|gratitude|reflect/i.test(t)) return '📖';
  if (/fast|intermit/i.test(t)) return '⏱️';
  if (/study|learn|reading|scripture|study/i.test(t)) return '📚';
  if (/mantra|japa|chant/i.test(t)) return '🔔';
  if (/ginger|tea|herbal|water|coconut/i.test(t)) return '🫖';
  if (/brush|dry brush/i.test(t)) return '✨';
  if (/creative|brainstorm|design/i.test(t)) return '💡';
  if (/focus|cognitiv|decision|strateg|work|meeting/i.test(t)) return '🎯';
  if (/family|social|bond|communic/i.test(t)) return '❤️';
  if (/anger|conflict|argument/i.test(t)) return '😤';
  if (/sankalpa|intention/i.test(t)) return '🌟';
  return isDo ? '✅' : '🚫';
}

// ── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#06060F' },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  headerDivider: { height: 1, backgroundColor: '#FFFFFF08', marginHorizontal: 16 },
  headerLabel: { fontSize: 8, fontWeight: '900', letterSpacing: 2 },
  headerTitle: { fontSize: 15, fontWeight: '900', color: '#FFFFFF', marginTop: 1 },
  backBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#FFFFFF18', backgroundColor: '#FFFFFF0A', alignItems: 'center', justifyContent: 'center' },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, borderWidth: 1 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveTxt: { fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },

  // Hero
  ringCenter: { position: 'absolute', alignItems: 'center', gap: 1, zIndex: 10, elevation: 10 },
  ringTime: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5, marginTop: 3 },
  ringRemaining: { fontSize: 8, color: '#FFFFFF35', fontWeight: '700', letterSpacing: 0.8 },
  doshaBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 99, borderWidth: 1, marginBottom: 10 },
  doshaBadgeTxt: { fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  heroTitle: { fontSize: 24, fontWeight: '900', color: '#FFFFFF', textAlign: 'center', paddingHorizontal: 24, lineHeight: 32 },
  heroTimeRange: { fontSize: 11, fontWeight: '700', marginTop: 5 },
  heroTagline: { fontSize: 12, color: '#FFFFFF55', marginTop: 5, textAlign: 'center', paddingHorizontal: 32, lineHeight: 18 },

  // Shared card
  glassCard: { borderRadius: 22, borderWidth: 1, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.05)' },
  topGloss: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.22)' },

  // Ayurvedic lens card
  cardSectionLabel: { fontSize: 8, fontWeight: '900', letterSpacing: 1.6 },
  elementEq: { fontSize: 15, fontWeight: '900', letterSpacing: 1, marginBottom: 3 },
  westernSys: { fontSize: 10, fontWeight: '700', marginBottom: 10 },
  divider: { height: 1, backgroundColor: '#FFFFFF12', marginBottom: 10 },
  biologyText: { fontSize: 13.5, color: '#FFFFFFB0', lineHeight: 22 },

  // Science card
  sciTitle: { fontSize: 16, fontWeight: '900', lineHeight: 24 },
  sciDesc: { fontSize: 14, color: '#FFFFFFB8', lineHeight: 23 },

  // Fact box
  factBox: { borderRadius: 16, borderWidth: 1, borderColor: '#fbbf2422', backgroundColor: '#fbbf2408', padding: 16 },
  factLabel: { fontSize: 8, fontWeight: '900', color: '#fbbf24AA', letterSpacing: 1.6, marginBottom: 8 },
  factText: { fontSize: 13, color: '#FFFFFF90', lineHeight: 21 },

  // Chemical row
  chemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 13 },
  chemIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  chemName: { fontSize: 13, fontWeight: '900', marginBottom: 3 },
  chemRole: { fontSize: 11.5, color: '#FFFFFFAA', lineHeight: 17 },

  // Process grid
  processCard: { borderRadius: 18, borderWidth: 1, padding: 14 },
  processName: { fontSize: 11, fontWeight: '900', lineHeight: 16, marginBottom: 5 },
  processDetail: { fontSize: 10, color: '#FFFFFF55', lineHeight: 15 },

  // Element cards
  elementCard: { borderRadius: 16, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.04)', padding: 15 },
  elementTitle: { fontSize: 12, fontWeight: '900', marginBottom: 7 },
  elementBody: { fontSize: 12.5, color: '#FFFFFFA0', lineHeight: 20 },

  // Do row
  doRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 13 },
  doIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  doText: { fontSize: 13, color: '#FFFFFFCC', fontWeight: '600', flex: 1, lineHeight: 20 },
  doCheck: { fontSize: 14, fontWeight: '900' },

  // Don't row
  dontRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: '#f43f5e22', backgroundColor: '#f43f5e08', paddingHorizontal: 14, paddingVertical: 13 },
  dontIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: '#f43f5e18', alignItems: 'center', justifyContent: 'center' },
  dontText: { fontSize: 13, color: '#FFFFFFCC', fontWeight: '600', flex: 1, lineHeight: 20 },
  dontX: { fontSize: 14, color: '#f43f5e70', fontWeight: '900' },

  // Practice card
  practiceCard: { borderRadius: 16, borderWidth: 1, padding: 15 },
  practiceName: { fontSize: 13, fontWeight: '900', marginBottom: 9 },
  scienceRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  scienceLabel: { fontSize: 8, fontWeight: '900', color: '#fbbf2490', letterSpacing: 0.8, marginTop: 2, flexShrink: 0 },
  scienceText: { fontSize: 12, color: '#FFFFFF70', lineHeight: 18, flex: 1 },

  // Imbalance card
  imbalanceCard: { borderRadius: 14, borderWidth: 1, borderColor: '#f43f5e20', backgroundColor: '#f43f5e07', paddingHorizontal: 15, paddingVertical: 13 },
  imbalanceName: { fontSize: 13, fontWeight: '900', color: '#f87171', marginBottom: 5 },
  imbalanceSci: { fontSize: 12, color: '#FFFFFF60', lineHeight: 18 },

  // Ayurveda box
  ayurvedaBox: { borderRadius: 22, borderWidth: 1, borderColor: '#a78bfa28', backgroundColor: '#a78bfa08', padding: 18 },
  ayurvedaTitle: { fontSize: 14, fontWeight: '900', color: '#a78bfa' },
  ayurvedaBody: { fontSize: 13, color: '#FFFFFF90', lineHeight: 22 },
  ayurvedaDivider: { height: 1, backgroundColor: '#a78bfa18', marginVertical: 12 },
  doshaPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, borderWidth: 1, borderColor: '#a78bfa30', backgroundColor: '#a78bfa10' },
  doshaPillTxt: { fontSize: 9, fontWeight: '900', color: '#a78bfaCC', letterSpacing: 0.5 },
});
