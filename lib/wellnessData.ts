/**
 * Shared Ayurvedic wellness data for all 6 dosha periods.
 * Used by MetabolicStoryModal (Option B) and metabolic-period page (Option C).
 */

export type WellnessEntry = {
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
  naadSounds: string[];
};

export const WELLNESS: Record<string, WellnessEntry> = {
  morning_kapha: {
    displayName: 'Kapha time',
    romanElements: 'Earth + Water',
    sunDesc: 'Active when sun is rising — Sunrise to ~4 hrs after',
    boundaryNote: 'Pre-dawn Vata settles as Kapha rises — the first 20–30 minutes after sunrise blend both. Energy shifts from subtle to solid and grounded.',
    elements: [
      { name: 'Earth (Prithvi)', emoji: '🌍', desc: 'Your physical body mass — bones, muscles, tissues, solid structure. Not literal soil, but the principle of', italic: 'density and form.' },
      { name: 'Water (Jala)', emoji: '💧', desc: 'All fluids — blood, lymph, mucus, synovial fluid. Not drinking water alone, but the', italic: 'cohesion and flow principle in all of nature.' },
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
    naadSounds: ['morning_birds', 'spring_birds', 'forest_breeze', 'morning_flute', 'sitar'],
  },
  midday_pitta: {
    displayName: 'Pitta time',
    romanElements: 'Fire + Water',
    sunDesc: 'Active when sun is highest — around Solar Noon ±2 hrs',
    boundaryNote: 'Kapha winds down as Pitta ignites — the 10:00–10:30 AM transition blends both. Digestive fire ramps up rapidly through mid-morning.',
    elements: [
      { name: 'Fire (Agni)', emoji: '🔥', desc: 'Metabolic fire — all biochemical transformation. Digestion of food, liver detox, thought processing. Not a campfire, but the principle of', italic: 'transformation itself.' },
      { name: 'Water (Jala)', emoji: '💧', desc: 'Bile, digestive fluids, aqueous medium for enzymes. Every Pitta transformation is liquid fire — hydrolysis breaks molecular bonds using water.' },
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
    naadSounds: ['hz_432', 'singing_bowl', 'indian_beats', 'sitar_tabla_bells', 'flowing_water'],
  },
  afternoon_vata: {
    displayName: 'Vata time',
    romanElements: 'Air + Space',
    sunDesc: 'Active as sun descends — ~4 hrs before Sunset',
    boundaryNote: 'Pitta winds down, Vata takes over — energy may dip briefly (~2–3 PM dip is Vata entering). Creativity and restlessness both rise.',
    elements: [
      { name: 'Air (Vayu)', emoji: '🌬️', desc: 'Nerve impulses, breath, all movement. O₂/CO₂ exchange and neural signals at 70–120 m/s. The principle of', italic: 'movement and direction.' },
      { name: 'Space (Akasha)', emoji: '✨', desc: 'Synaptic clefts, hollow channels, extracellular space. The room in which all signals travel — the principle of', italic: 'openness and potential.' },
    ],
    modernBrief: 'Post-lunch cortisol dip, circadian alertness trough at 2–3 PM. Serotonin synthesis peaks later in afternoon. Motor coordination sharpens by 4–5 PM — athletic peak.',
    ayurvedaBrief: 'Vata governs movement, breath, nerve impulses, and creativity. Afternoon Vata is perfect for creative work, gentle movement, and communication.',
    bodyBullets: [
      { dot: '#F5A623', text: 'Blood sugar stabilising after lunch — mild energy dip possible at 2–3 PM' },
      { dot: '#10b981', text: 'Lung capacity and aerobic performance peak — best for cardio at 4–5 PM' },
      { dot: '#9B7FD4', text: 'Nervous system sensitivity high — heightened perception and creativity' },
      { dot: '#60a5fa', text: 'Elimination movement active — body clearing waste channels' },
      { dot: '#F5A623', text: 'Joints well-lubricated — risk of Vata-type injuries if overexerted' },
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
    ],
    naadSounds: ['gentle_wind', 'forest_breeze', 'sea_waves', 'wanderlust', 'spiritual_journey'],
  },
  evening_kapha: {
    displayName: 'Kapha time',
    romanElements: 'Earth + Water',
    sunDesc: 'Active when sun sets — Sunset onwards ~4 hrs',
    boundaryNote: 'Afternoon Vata settles as evening Kapha rises — the sunset transition gradually calms restlessness into stability and quiet. Allow it to happen.',
    elements: [
      { name: 'Earth (Prithvi)', emoji: '🌍', desc: 'Grounding energy — body weight sinks, muscles relax, structure winds down for repair. The principle of', italic: 'density and rest.' },
      { name: 'Water (Jala)', emoji: '💧', desc: 'Fluids shifting into repair mode — lymph, CSF, cellular hydration for overnight renewal. The principle of', italic: 'cohesion and restoration.' },
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
    naadSounds: ['tibetan_bowl', 'singing_bowl', 'tibetan_dreams', 'night_forest', 'reincarnation_tones'],
  },
  night_pitta: {
    displayName: 'Pitta time',
    romanElements: 'Fire + Water',
    sunDesc: 'Active in deep night — ~4 hrs after Sunset to pre-dawn',
    boundaryNote: 'Evening Kapha transitions into nocturnal Pitta — repair fires ignite under deep sleep. The body burns through metabolic waste silently, invisibly, powerfully.',
    elements: [
      { name: 'Fire (Agni)', emoji: '🔥', desc: 'Liver detox, cellular repair, autophagy — the body\'s night-shift workers. Fire does not need to be seen to be burning.' },
      { name: 'Water (Jala)', emoji: '💧', desc: 'CSF, lymph, Growth Hormone in blood — all fluid-based repair systems running at maximum. Transformation through the medium of water.' },
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
    naadSounds: ['tibetan_dreams', 'singing_bowl', 'reincarnation_tones', 'night_forest', 'night_jungle_chiangmai'],
  },
  night_vata: {
    displayName: 'Vata time',
    romanElements: 'Air + Space',
    sunDesc: 'Sacred pre-dawn window — ~96 min before Sunrise',
    boundaryNote: 'Nocturnal Pitta completes repair, Vata takes over pre-dawn — the nervous system stirs, dreams deepen, then Brahma Muhurta opens 96 minutes before sunrise.',
    elements: [
      { name: 'Air (Vayu)', emoji: '🌬️', desc: 'Neural signals stirring, alpha-theta waves, the pre-dawn nervous system awakening. The principle of', italic: 'movement returning from stillness.' },
      { name: 'Space (Akasha)', emoji: '✨', desc: 'Maximum mental space and silence — subconscious most accessible. The principle of', italic: 'openness and receptivity.' },
    ],
    modernBrief: 'Alpha & theta brainwaves (8–12 Hz, 4–8 Hz) dominate pre-dawn EEG. Cortisol Awakening Response begins. BDNF (brain\'s fertiliser) elevated — neuroplasticity peaks in this window.',
    ayurvedaBrief: 'Brahma Muhurta (96–48 min before sunrise) is the most sacred window in Dinacharya. Meditation here is exponentially more potent than at any other time of day.',
    bodyBullets: [
      { dot: '#9B7FD4', text: 'Alpha-theta brainwaves peaking — deepest meditative access of the 24-hour cycle' },
      { dot: '#10b981', text: 'Cortisol Awakening Response beginning — sets the day\'s energy baseline' },
      { dot: '#60a5fa', text: 'BDNF elevated — brain most receptive to new patterns and intentions' },
      { dot: '#F5A623', text: 'Glymphatic system finalising — flushing neural waste from overnight' },
      { dot: '#9B7FD4', text: 'Subconscious–conscious boundary thinnest — Sankalpa embeds most deeply' },
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
    naadSounds: ['hz_432', 'singing_bowl', 'tibetan_bowl', 'morning_flute', 'spiritual_journey'],
  },
};

export const PERIOD_SANSKRIT: Record<string, { sanskrit: string; meaning: string }> = {
  morning_kapha:  { sanskrit: 'Prabhāta Kapha Kāla', meaning: 'The time of earth and water at dawn' },
  midday_pitta:   { sanskrit: 'Madhyāhna Pitta Kāla', meaning: 'The time of fire and transformation at noon' },
  afternoon_vata: { sanskrit: 'Aparāhna Vāta Kāla', meaning: 'The time of air and movement in the afternoon' },
  evening_kapha:  { sanskrit: 'Sandhyā Kapha Kāla', meaning: 'The twilight time of earth and water' },
  night_pitta:    { sanskrit: 'Rātri Pitta Kāla', meaning: 'The time of nocturnal fire and deep repair' },
  night_vata:     { sanskrit: 'Brahma Muhūrta Vāta', meaning: 'The sacred pre-dawn hour of air and space' },
};

export type PeriodExtended = {
  phonetic: string;
  etymParts: { term: string; breakdown: string }[];
  classicalRef: { text: string; source: string };
  phaseNumber: number;
  circadianSci: string;
  sunPosition: string;
  systemTags: string[];
  elementCombined: string;
};

export const PERIOD_EXTENDED: Record<string, PeriodExtended> = {
  night_vata: {
    phonetic: 'BRAH-mah moo-HOOR-tah · VAA-tah',
    etymParts: [
      { term: 'Brahma', breakdown: 'from √bṛh (to expand) = cosmic creative intelligence' },
      { term: 'Muhūrta', breakdown: '1/30th of a solar day = 48 minutes. This Muhūrta = 96–48 min before sunrise' },
      { term: 'Vāta', breakdown: 'from √vā (to blow/move) = principle of all movement' },
    ],
    classicalRef: { text: 'Brahma muhūrte budhyeta dharmārtha cānucintayet.', source: 'Ashtānga Hridayam, Sūtrasthāna 2.1' },
    phaseNumber: 1,
    circadianSci: 'Alpha (8–12 Hz) and theta (4–8 Hz) brainwaves dominate EEG output. BDNF (Brain-Derived Neurotrophic Factor) is elevated — neuroplasticity is at its 24-hour peak. The Cortisol Awakening Response (CAR) prepares to launch. The subconscious–conscious boundary is at its thinnest — why Sankalpa (intention) embeds most deeply here.',
    sunPosition: '🌑 Sun 6–12° below the horizon (astronomical twilight) — retinal ipRGC photoreceptors not yet stimulated. Pineal gland maintains peak melatonin release. Maximum neurological openness, minimum sympathetic activation.',
    systemTags: ['Neurological', 'Cognitive', 'Glymphatic', 'Endocrine'],
    elementCombined: 'Pre-dawn Vāyu (Air) is the subtlest movement — the stirring of consciousness from deep sleep toward awareness. Alpha-theta brainwave oscillations are literally Vāyu moving through Ākāsha. The mind has been emptied by sleep and is now a perfect vessel for Sankalpa and meditation.',
  },
  morning_kapha: {
    phonetic: 'prahb-HAA-tah · KAH-phah · KAA-lah',
    etymParts: [
      { term: 'Prabhāta', breakdown: 'pra (first/forward) + bhāta (shining) = the first illumination' },
      { term: 'Kapha', breakdown: 'ka (water/head) + pha (fills) = that which fills, binds, and nourishes' },
      { term: 'Kāla', breakdown: 'from √kal (to reckon/count) = the moment in cyclic cosmic time' },
    ],
    classicalRef: { text: 'Vyāyāmam ācaret kāle deha-bala-abhivṛddhaye.', source: 'Charaka Samhitā, Sūtrasthāna 7.32' },
    phaseNumber: 2,
    circadianSci: 'Cortisol Awakening Response (CAR) drives a 50–100% cortisol surge within 30 min of waking. Testosterone and GH are at their 24-hour peak. Synovial fluid is fully renewed overnight — joint lubrication is maximal. The mTOR pathway for muscle protein synthesis is fully open. This is the body\'s peak anabolic window.',
    sunPosition: '☀️ Sun on the eastern horizon — the first 480nm blue-spectrum photons reach retinal ipRGC cells, signalling the suprachiasmatic nucleus (SCN) to suppress melatonin and launch the cortisol cascade.',
    systemTags: ['Anabolic', 'Immune', 'Lymphatic', 'Musculoskeletal'],
    elementCombined: 'Prithvī (Earth) grounds the body\'s structure — bones, muscles, connective tissue. Jala (Water) lubricates every joint and maintains every fluid compartment. Together they are the force of construction. Morning Kapha builds the body that Pitta will fuel and Vāta will animate.',
  },
  midday_pitta: {
    phonetic: 'mahd-HYAH-nah · PIT-tah · KAA-lah',
    etymParts: [
      { term: 'Madhyāhna', breakdown: 'madhya (middle) + ahna (day) = the centre of the solar arc' },
      { term: 'Pitta', breakdown: 'from √tap (to heat/burn) = the principle of transformation itself' },
      { term: 'Kāla', breakdown: 'the peak — when solar Agni reaches maximum' },
    ],
    classicalRef: { text: 'Madhyāhne bhojanaṃ śreṣṭhaṃ — agnibalaṃ hi tadā mahat.', source: 'Ashtānga Hridayam, Sūtrasthāna 8.4' },
    phaseNumber: 3,
    circadianSci: 'Gastric acid (HCl) reaches its lowest pH (1.0–1.5) — maximum digestive power. Insulin sensitivity is 30% higher than morning baseline. Core body temperature peaks at 2–3 PM. Liver CYP450 detox enzymes most active — the body\'s chemical processing plant runs at full capacity.',
    sunPosition: '☀️ Sun at or approaching zenith — maximum UV-B radiation drives peak Vitamin D₃ synthesis. Solar angle maximises photon delivery to retinal cells, sustaining peak cortisol and wakefulness signals through the hypothalamic-pituitary axis.',
    systemTags: ['Metabolic', 'Digestive', 'Cognitive', 'Hepatic'],
    elementCombined: 'Agni (Fire) is all transformation — not the campfire, but the principle itself. Every enzyme reaction, every decision is Agni. Jala (Water) is the medium — without bile, digestive juices, and aqueous enzyme substrates, fire cannot transform. Pitta is liquid fire: biochemical hydrolysis is Pitta in action.',
  },
  afternoon_vata: {
    phonetic: 'ah-pah-RAH-nah · VAA-tah · KAA-lah',
    etymParts: [
      { term: 'Aparāhna', breakdown: 'apara (after/following) + ahna (day) = the second half of the solar day' },
      { term: 'Vāta', breakdown: 'from √vā (to blow, to move) = the principle of all movement in nature' },
      { term: 'Kāla', breakdown: 'the descending arc — when the solar cycle begins its return journey' },
    ],
    classicalRef: { text: 'Aparāhne vāta-pradhānaṃ tatra śīghragati-karmaṇi śreṣṭham.', source: 'Ashtānga Hridayam, Śārīrasthāna 3.22' },
    phaseNumber: 4,
    circadianSci: 'Serotonin synthesis peaks in the mid-to-late afternoon. Motor coordination reaches its daily maximum at 4–5 PM — reaction time is fastest, VO₂max most accessible. The 2–3 PM alertness trough (post-prandial dip) is a Vāta transition signal. The ANS shifts from sympathetic dominance toward a mixed parasympathetic state.',
    sunPosition: '☀️ Sun descending in the western sky — decreasing solar angle reduces blue-light photon intensity, initiating the dim-light melatonin onset (DLMO) pre-signal ~2 hours before sunset. The autonomic nervous system begins its parasympathetic shift.',
    systemTags: ['Nervous', 'Respiratory', 'Motor', 'Eliminative'],
    elementCombined: 'Vāyu (Air) is every movement in your body — nerve impulses firing at 70–120 m/s, your breath, the peristaltic wave, your heartbeat. Ākāsha (Space) is every hollow space those signals travel through — synaptic clefts, bronchial tubes, gut lumen, extracellular matrix. Without Space, Air has nowhere to move. This is why Vāta governs both creativity and anxiety.',
  },
  evening_kapha: {
    phonetic: 'SAHN-dhyaa · KAH-phah · KAA-lah',
    etymParts: [
      { term: 'Sandhyā', breakdown: 'sam (joining) + dhyā (from √dhyai, to hold) = the twilight junction — neither day nor night' },
      { term: 'Kapha', breakdown: 'the settling, cohesive force that binds scattered Vāta energy into stillness' },
      { term: 'Kāla', breakdown: 'the sacred transitional arc — Sandhyā is itself a goddess in Vedic cosmology' },
    ],
    classicalRef: { text: 'Sandhyāyāṃ laghu āhāraṃ — rātryāṃ na guru bhojanam.', source: 'Charaka Samhitā, Vimānasthāna 1.24' },
    phaseNumber: 5,
    circadianSci: 'Melatonin synthesis begins as ipRGC photoreceptors detect the drop in blue-spectrum light (480nm). Cortisol reaches its evening nadir (~10–12 μg/dL, down from morning peak of 18–25 μg/dL). Core temperature begins its nightly 1°C descent. Blue light now suppresses melatonin 5× more potently than at midday.',
    sunPosition: '🌅 Sun at or below the western horizon — the sharp drop in blue-spectrum light removes the SCN\'s primary wake-maintenance signal, launching the melatonin cascade from the pineal gland. This is the most critical light-timing moment in the 24-hour cycle.',
    systemTags: ['Parasympathetic', 'Endocrine', 'Fluid', 'Sleep Prep'],
    elementCombined: 'Evening Kapha uses the same elements as morning — but the direction reverses. Prithvī (Earth) now pulls energy downward into rest. Jala (Water) shifts from building (lymph, blood) to restoring (CSF circulation, cellular rehydration, melatonin synthesis). Evening Kapha is the transition from doing to being.',
  },
  night_pitta: {
    phonetic: 'RAA-tree · PIT-tah · KAA-lah',
    etymParts: [
      { term: 'Rātri', breakdown: 'from √rā (to give) — night gives repair, renewal, restoration' },
      { term: 'Pitta', breakdown: 'the nocturnal fire — burning without flame, the body\'s invisible repair workshop' },
      { term: 'Kāla', breakdown: 'the hidden peak — most powerful metabolic moment in the entire 24-hour cycle' },
    ],
    classicalRef: { text: 'Nidrayā yojyate sarvam — jagat sthāvara-jaṅgamam.', source: 'Charaka Samhitā, Sūtrasthāna 21.36' },
    phaseNumber: 6,
    circadianSci: 'Growth Hormone (GH) secretion peaks during NREM Stage 3 slow-wave sleep — the largest daily GH pulse occurs 60–90 min after sleep onset. Liver CYP450 Phase I & II detox enzymes maximally active between 1–3 AM. Cellular autophagy (Nobel Prize 2016) runs at full capacity — the body\'s self-cleaning programme. Every missed hour here has a compounding biological cost.',
    sunPosition: '🌑 Sun at maximum depth below the horizon — plasma melatonin reaches its 24-hour peak (up to 200 pg/mL). Complete darkness maximises GH pulse amplitude and NREM Stage 3–4 deep sleep architecture. A single room light at night can suppress melatonin by 50%.',
    systemTags: ['Repair', 'Hepatic', 'Immune', 'Glymphatic'],
    elementCombined: 'Nocturnal Agni (Fire) repairs what daytime Agni consumed. The liver\'s detox fire burns metabolic waste products (CYP450 biotransformation). Cellular repair fire fixes DNA (BER/NER pathways). Jala (Water) carries GH through blood, CSF through brain, lymph through repair sites. This is the body\'s night shift — it works only when you sleep.',
  },
};

export const DOSHA_FULL_SCIENCE: Record<string, { title: string; body: string }[]> = {
  kapha: [
    { title: 'What is Kapha?', body: 'Kapha is the dosha of structure, stability, and lubrication. It binds the universe together. In the body, it is responsible for the growth of all new cells, maintenance of immunity (Ojas), and the fluid that protects every organ. Without Kapha, Pitta\'s fire would consume us and Vata\'s wind would scatter us.' },
    { title: 'Modern Parallel', body: 'Science now understands anabolic hormones (testosterone, GH, IGF-1), synovial fluid, mucosal immunity (IgA), and connective tissue repair as direct parallels to Kapha function. The anabolic window post-sleep aligns precisely with morning Kapha timing.' },
    { title: 'When Kapha is Balanced', body: 'Strength, endurance, calm confidence, emotional stability, generous spirit, and a strong immune system. You feel rooted, nourished, and ready to give.' },
    { title: 'When Kapha is Disturbed', body: 'Lethargy, sluggish digestion, weight gain, excessive mucus, emotional attachment, depression. The antidote is movement, sunlight, and heat.' },
  ],
  pitta: [
    { title: 'What is Pitta?', body: 'Pitta is the dosha of transformation. Fire + Water create the digestive juices, enzymes, hormones, and the heat of intelligence. Every biochemical transformation in the body — from digestion to perception — is Pitta at work.' },
    { title: 'Modern Parallel', body: 'Pitta maps precisely to the entire metabolic axis: gastric acid, bile, CYP450 liver enzymes, thyroid hormones, mitochondrial ATP production, and even the inflammatory cascade. Solar Pitta timing aligns with peak gastric acid secretion and core body temperature.' },
    { title: 'When Pitta is Balanced', body: 'Sharp intellect, precise speech, disciplined courage, warm leadership, excellent digestion, and healthy ambition. You see clearly, decide confidently, and digest everything — food and experience.' },
    { title: 'When Pitta is Disturbed', body: 'Anger, perfectionism, acid reflux, skin inflammation, burnout, excessive criticism. The antidote is cooling — coconut water, moonlight, silence, and sweet taste.' },
  ],
  vata: [
    { title: 'What is Vata?', body: 'Vata is the dosha of movement. Air + Space govern every movement in the body and mind — the beating of the heart, the firing of neurons, the movement of food through the gut, the breath, and thought itself. Without Vata, nothing moves.' },
    { title: 'Modern Parallel', body: 'Vata\'s properties are mirrored in the autonomic nervous system, peristalsis, neural signal propagation (action potentials), synaptic transmission, and the oscillatory nature of consciousness. Pre-dawn Vata timing aligns with dominant alpha-theta brainwave states.' },
    { title: 'When Vata is Balanced', body: 'Creativity, enthusiasm, adaptability, quick mind, light body, and spiritual sensitivity. You feel inspired, connected, and free.' },
    { title: 'When Vata is Disturbed', body: 'Anxiety, insomnia, constipation, dry skin, scattered thoughts, and fear. The antidote is warmth, routine, grounding — oil massage, warm food, and stillness.' },
  ],
};

export const MIDDAY_PITTA_LATE_WELLNESS: WellnessEntry = {
  displayName: 'Energy Dip Phase',
  romanElements: 'Fire + Water',
  sunDesc: 'Active as the sun begins to descend from zenith',
  boundaryNote: 'The intense peak of solar noon has passed, and the body\'s energy turns inward for digestion.',
  elements: [
    { name: 'Fire (Agni)', emoji: '🔥', desc: 'Metabolic fire turning inward. Not the active, outward burning fire of noon, but the smoldering fire of internal digestion.' },
    { name: 'Water (Jala)', emoji: '💧', desc: 'Digestive fluids and bile actively breaking down the midday meal.' },
  ],
  modernBrief: 'Post-prandial somnolence and the natural post-solar cortisol dip occur in this window. The parasympathetic nervous system is activated to support digestion.',
  ayurvedaBrief: 'The intense active Pitta phase gives way to the digestive Pitta phase. The body requires a slightly slower pace to allow Pachana (digestion) to complete without interference.',
  bodyBullets: [
    { dot: '#E05C3A', text: 'Blood flow strongly diverted to the GI tract for digestion' },
    { dot: '#10b981', text: 'Cortisol drops from its midday peak, causing a natural energy lull' },
    { dot: '#fbbf24', text: 'Parasympathetic tone increases to support digestive processes' },
    { dot: '#60a5fa', text: 'Cognitive sharpness briefly dulls as energy is reallocated' },
    { dot: '#E05C3A', text: 'Nutrients are actively being broken down and assimilated' },
  ],
  doItems: [
    { emoji: '🚶', text: 'Light walking to aid digestion' },
    { emoji: '🧘', text: 'Brief restorative pause or meditation' },
    { emoji: '📋', text: 'Low-cognitive routine tasks' },
    { emoji: '💧', text: 'Hydrate with warm or room-temperature water' },
  ],
  avoidItems: [
    { emoji: '🧠', text: 'High-stakes decision making' },
    { emoji: '🏃', text: 'Intense physical exertion immediately after eating' },
    { emoji: '☕', text: 'Excessive caffeine to fight the dip' },
    { emoji: '💻', text: 'Deep focused cognitive work' },
  ],
  naadSounds: ['hz_432', 'flowing_water', 'gentle_wind', 'singing_bowl'],
};

export const MIDDAY_PITTA_LATE_SANSKRIT = { sanskrit: 'Madhyāhna Pariṇāma', meaning: 'The phase of internal transformation and digestion' };

export const MIDDAY_PITTA_LATE_EXTENDED: PeriodExtended = {
  phonetic: 'mahd-HYAH-nah · (pah-ri-NAA-mah)',
  etymParts: [
    { term: 'Madhyāhna', breakdown: 'the centre of the solar day' },
    { term: 'Pariṇāma', breakdown: 'from pari (around) + nam (to bend) = transformation or digestion' },
  ],
  classicalRef: { text: 'Pariṇāme tu bhuktasya vidyāt pittaṃ prakopitam.', source: 'Ashtānga Hridayam' },
  phaseNumber: 3,
  circadianSci: 'The post-prandial state is characterised by parasympathetic activation and increased splanchnic blood flow. This causes a transient decrease in systemic blood pressure and cerebral perfusion, leading to the subjective feeling of a "mid-day dip".',
  sunPosition: '☀️ Sun descending from zenith — solar radiation remains high but the body\'s internal rhythm shifts priority to processing the midday meal.',
  systemTags: ['Digestive', 'Metabolic', 'Parasympathetic'],
  elementCombined: 'Agni (Fire) is fully engaged in the gut, breaking down the heaviest meal of the day. Because the fire is concentrated internally, there is less "heat" available for outward cognitive or physical action.',
};

WELLNESS['midday_pitta_late'] = MIDDAY_PITTA_LATE_WELLNESS;
PERIOD_SANSKRIT['midday_pitta_late'] = MIDDAY_PITTA_LATE_SANSKRIT;
PERIOD_EXTENDED['midday_pitta_late'] = MIDDAY_PITTA_LATE_EXTENDED;


