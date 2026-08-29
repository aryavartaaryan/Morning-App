import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, Modal, TouchableOpacity,
  StyleSheet, Dimensions, Animated, ScrollView,
  StatusBar, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import type { DoshaPeriod } from '@/lib/ayurvedicPeriods';
import type { SolarTimes } from '@/lib/solar';
import { WELLNESS, PERIOD_SANSKRIT, PERIOD_EXTENDED } from '@/lib/wellnessData';
import { Ionicons } from '@expo/vector-icons';

const { width: W, height: H } = Dimensions.get('window');

const DOSHA_COLOR: Record<string, string> = {
  kapha: '#F59E0B',
  pitta: '#EF4444',
  vata:  '#8B5CF6',
};

const DOSHA_NAMES: Record<string, string> = {
  kapha: 'Kapha · Stability & Structure',
  pitta: 'Pitta · Transformation & Fire',
  vata:  'Vāta · Kinetic Velocity & Mind',
};

function fmtH(decH: number): string {
  const totalMin = Math.round(decH * 60) % (24 * 60);
  const hh = Math.floor(totalMin / 60) % 24;
  const mm = totalMin % 60;
  const ampm = hh < 12 ? 'AM' : 'PM';
  const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  return `${String(h12).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${ampm}`;
}

const WESTERN_EXPLAINER: Record<string, {
  headline: string;
  tagline: string;
  what: string;
  whyMatters: string;
  analogy: string;
  topFact: { icon: string; label: string; value: string }[];
}> = {
  morning_kapha_early: {
    headline: 'Your Body is Grounding & Waking',
    tagline: 'Dawn Awakening · Cortisol Rising · Mindful Calibration',
    what: 'Right now, as dawn light stimulates the suprachiasmatic nucleus (SCN), your neurobiology transitions smoothly from sleep to wakefulness. Cortisol initiates its morning rise. Ayurveda designates this the early Kapha window — the grounded, peaceful calm before the day speeds up.',
    whyMatters: 'Gentle movement and breathwork during this window regulate your autonomic nervous system, locking in your baseline vagal tone for the entire day.',
    analogy: 'The engine is gently warming up after a cool night. Do not redline it with stressful notifications. Let it idle smoothly with conscious breath.',
    topFact: [
      { icon: '🧘', label: 'Vagal Tone', value: 'Highly receptive' },
      { icon: '📈', label: 'Cortisol Arc', value: 'Natural morning rise' },
      { icon: '🌱', label: 'Neuroplasticity', value: 'Open for intention' },
    ],
  },
  morning_kapha: {
    headline: 'Your Body is in Prime Anabolic Build Mode',
    tagline: 'Peak Anabolic Window · Joint Lubrication · Physical Strength',
    what: 'During the ascending solar arc, testosterone, growth hormone, and core cellular building signals peak. Synovial fluid actively lubricates joints, and the musculoskeletal matrix is primed for structural adaptation.',
    whyMatters: 'Strength training in this solar window stimulates up to 23% greater muscle protein synthesis than evening sessions. Your hormonal environment will not be more anabolic at any other point today.',
    analogy: 'Your biological factory is fully staffed and supplied. The morning light signals maximum cellular construction. Build now.',
    topFact: [
      { icon: '💪', label: 'Anabolic Surge', value: '+25% vs evening' },
      { icon: '🦴', label: 'Joint Fluid', value: 'Optimal viscosity' },
      { icon: '🛡️', label: 'Immune Guard', value: 'High white blood cells' },
    ],
  },
  midday_pitta: {
    headline: 'Your Metabolic Fire (Agni) Peaks with the Sun',
    tagline: 'Solar Zenith Alignment · Max Digestive Capacity · Cognitive Acuity',
    what: 'As the sun approaches celestial zenith, gastric hydrochloric acid reaches its lowest pH and highest potency. Liver detox pathways and digestive enzymes operate at maximum enzymatic efficiency. Ayurveda terms this Pitta — transformation, digestion, and sharp intellectual focus.',
    whyMatters: 'Eating your primary, most substantial meal during this peak solar window yields up to 30% higher nutrient assimilation and prevents the metabolic stagnation (Ama) caused by late-night dining.',
    analogy: 'Your stomach is a roaring blast furnace fueled by the sun above. Feed it when the fire burns brightest.',
    topFact: [
      { icon: '🔥', label: 'Gastric Acid', value: 'Peak enzymatic pH' },
      { icon: '⚡', label: 'Insulin Sensitivity', value: '+30% vs evening' },
      { icon: '🧠', label: 'Prefrontal Focus', value: 'High clarity & decisions' },
    ],
  },
  midday_pitta_late: {
    headline: 'Your Body Enters Internal Digest Mode',
    tagline: 'Post-Zenith Realignment · Splanchnic Blood Flow · Rest & Digest',
    what: 'Following peak solar noon, systemic blood flow is channeled toward the splanchnic vascular bed to digest and assimilate nutrients. Core temperature undergoes a brief physiological dip, creating a natural circadian alertness trough.',
    whyMatters: 'Demanding intense cognitive or physical output now creates unnecessary autonomic friction. Honoring this natural biological lull allows cellular digestion to complete cleanly.',
    analogy: 'The battery is re-routing power to the digestive furnace. Let the internal engine process without redlining the accelerator.',
    topFact: [
      { icon: '🩸', label: 'Splanchnic Flow', value: 'Reallocated to gut' },
      { icon: '📉', label: 'Cortisol Curve', value: 'Natural midday dip' },
      { icon: '🧘', label: 'Autonomic Mode', value: 'Rest & assimilation' },
    ],
  },
  afternoon_vata: {
    headline: 'Your Nervous System & Athletic Velocity Peak',
    tagline: 'Neuromuscular Precision · Peak Aerobic Capacity · Creative Surge',
    what: 'As the sun descends toward the western horizon, sympathetic nervous system tone rises smoothly. Motor coordination, reaction time, and lung vital capacity reach their diurnal zenith. Ayurveda terms this Vata — the kinetic principle of air, movement, and velocity.',
    whyMatters: 'Athletic performance, fine motor coordination, and world records peak predominantly between late afternoon and dusk. This is your biological peak for movement, strategic brainstorming, and expressive communication.',
    analogy: 'Your nervous system is a taut sail filled with brisk afternoon wind. Move, articulate, create, and flow.',
    topFact: [
      { icon: '🎨', label: 'Cognitive Flow', value: 'Lateral creative peak' },
      { icon: '🏃', label: 'Athletic Peak', value: 'Highest VO2 & reflex' },
      { icon: '🫁', label: 'Vital Capacity', value: 'Maximum lung volume' },
    ],
  },
  evening_kapha: {
    headline: 'Dusk Transition: Your Body Winds Down',
    tagline: 'Melatonin Synthesis · Core Temperature Drop · Parasympathetic Shift',
    what: 'Following sunset, the absence of short-wavelength blue light triggers the pineal gland to synthesize melatonin. Core body temperature begins its nightly 0.5–1°C drop. Cortisol reaches its 24-hour nadir as the parasympathetic nervous system takes command.',
    whyMatters: 'Artificial blue screen light exposure during this twilight window suppresses melatonin synthesis by over 50%, throwing off circadian phase alignment by up to 3 hours.',
    analogy: 'The city of your cells is dimming its streetlights. The daytime factories are closing. Welcome the peaceful silence.',
    topFact: [
      { icon: '🌙', label: 'Melatonin Rise', value: 'Synthesis initiates' },
      { icon: '🌡️', label: 'Core Temp', value: 'Dropping for sleep' },
      { icon: '📵', label: 'Blue Light Impact', value: 'Maximum vulnerability' },
    ],
  },
  night_pitta: {
    headline: 'The Nocturnal Cellular Maintenance Shift',
    tagline: 'Growth Hormone Surge · Cellular Autophagy · Glymphatic Brain Flush',
    what: 'While conscious awareness sleeps, the body activates its most aggressive repair programs. Pulsatile Growth Hormone surges during slow-wave sleep. The glymphatic system clears metabolic waste and beta-amyloid plaques from brain tissue. Liver Phase I/II detoxification reaches its nocturnal peak.',
    whyMatters: 'Every hour of deep sleep before the pre-dawn hours is irreplaceable biological medicine for DNA repair, mitochondrial restoration, and memory consolidation.',
    analogy: 'The manufacturing line is paused so the deep cleaning and structural maintenance crew can rebuild the machinery.',
    topFact: [
      { icon: '🧬', label: 'Cellular Autophagy', value: 'Self-cleaning maximum' },
      { icon: '🏋️', label: 'Growth Hormone', value: 'Slow-wave sleep surge' },
      { icon: '🧹', label: 'Glymphatic Flush', value: 'Brain waste clearance' },
    ],
  },
  night_vata: {
    headline: 'The Sacred Pre-Dawn Window (Brahma Muhurta)',
    tagline: 'Subconscious Clarity · Alpha-Theta Brainwaves · Spiritual Alignment',
    what: 'In the 96 minutes before solar dawn, the atmosphere is charged with nascent ozone, pure stillness, and absence of electromagnetic chatter. EEG studies confirm spontaneous alpha and theta brainwave dominance — the neurological signature of deep meditation.',
    whyMatters: 'Intentions, meditation, and mantras set during this window penetrate deep into the subconscious mind with up to 10× the efficacy of midday practice.',
    analogy: 'Your mind is a pristine mountain lake before sunrise. Any pebble dropped into the water creates ripples that reach the deepest depths.',
    topFact: [
      { icon: '🧘', label: 'EEG Brainwaves', value: 'Alpha-theta baseline' },
      { icon: '🌱', label: 'BDNF Factor', value: 'Elevated synaptic growth' },
      { icon: '✨', label: 'Brahma Muhurta', value: '96 min prior to sunrise' },
    ],
  },
};

export default function MetabolicStoryModal({
  period,
  solarTimes,
  onClose,
}: {
  period: DoshaPeriod;
  solarTimes: SolarTimes | null;
  onClose: () => void;
}) {
  const accent = period.color || DOSHA_COLOR[period.dosha] || '#00D4B8';
  const ex = WESTERN_EXPLAINER[period.id] || WESTERN_EXPLAINER['afternoon_vata'];
  const w = WELLNESS[period.id];
  const s = PERIOD_SANSKRIT[period.id];

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const pulseDot = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 450, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseDot, { toValue: 1.4, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseDot, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 240, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 30, duration: 240, useNativeDriver: true }),
    ]).start(onClose);
  };

  // Solar calculations
  const srStr = solarTimes ? fmtH(solarTimes.sunrise) : '05:58 AM';
  const snStr = solarTimes ? fmtH(solarTimes.solarNoon) : '12:14 PM';
  const ssStr = solarTimes ? fmtH(solarTimes.sunset) : '06:30 PM';
  const dayLengthHrs = solarTimes ? (solarTimes.sunset - solarTimes.sunrise).toFixed(1) : '12.5';

  const remM = period.minutesRemaining ?? 0;
  const remStr = remM >= 60 ? `${Math.floor(remM / 60)}h ${remM % 60}m remaining` : `${remM}m remaining`;
  const durH = (period.endH - period.startH + 24) % 24 || 3;
  const durM = Math.round(durH * 60);
  const prog = Math.max(0, Math.min(1, 1 - (remM / durM)));

  return (
    <Modal
      transparent={false}
      visible
      animationType="slide"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={S.container}>
        <StatusBar barStyle="light-content" />

        {/* Ambient Cosmic Background Lighting */}
        <LinearGradient
          colors={[`${accent}28`, `${accent}0A`, '#060712']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.6 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />

        {/* Subtle Radial Glow */}
        <View
          style={[
            S.glowOrb,
            {
              backgroundColor: accent,
              shadowColor: accent,
            },
          ]}
          pointerEvents="none"
        />

        <SafeAreaView style={{ flex: 1 }}>
          {/* ── Fixed Luxury Top Navigation Bar ── */}
          <View style={S.topBar}>
            <TouchableOpacity
              onPress={handleClose}
              hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
              style={S.closeCircleBtn}
            >
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={S.centerPill}>
              <Animated.View
                style={[
                  S.liveDot,
                  { backgroundColor: accent, transform: [{ scale: pulseDot }] },
                ]}
              />
              <Text style={[S.livePillText, { color: accent }]}>
                {period.label ? period.label.toUpperCase() : 'ACTIVE DOSHA'}
              </Text>
            </View>

            <View style={S.tiltBadge}>
              <Text style={S.tiltBadgeText}>🌍 23.44° TILT</Text>
            </View>
          </View>

          {/* ── Immersive Full-Screen Scroll Content ── */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={S.scrollContent}
            bounces={true}
          >
            {/* Header / Hero Title */}
            <View style={{ marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: accent, letterSpacing: 2, textTransform: 'uppercase' }}>
                  {DOSHA_NAMES[period.dosha] || period.dosha.toUpperCase()}
                </Text>
              </View>

              <Text style={S.heroHeadline}>{ex.headline}</Text>
              <Text style={S.heroTagline}>{ex.tagline}</Text>
            </View>

            {/* Dynamic Real-Time Window Card */}
            <View style={S.timeWindowCard}>
              <LinearGradient
                colors={['rgba(255,255,255,0.07)', 'rgba(255,255,255,0.02)']}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <View>
                  <Text style={S.cardEyebrow}>
                    CURRENT {period.dosha.toUpperCase()} PHASE · {period.englishLabel.toUpperCase()}
                  </Text>
                  <Text style={S.windowTimePremium}>
                    {period.startLabel} <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 16, fontWeight: '400' }}>to</Text> {period.endLabel}
                  </Text>
                </View>
                <View style={[S.activeBadge, { backgroundColor: `${accent}20`, borderColor: `${accent}50` }]}>
                  <Text style={[S.activeBadgeText, { color: accent }]}>LIVE</Text>
                </View>
              </View>

              {/* Progress Line */}
              <View style={S.progressTrack}>
                <View style={[S.progressBar, { width: `${Math.round(prog * 100)}%`, backgroundColor: accent }]} />
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                <Text style={S.progressSubText}>{remStr}</Text>
                <Text style={S.progressSubText}>{Math.round(prog * 100)}% completed</Text>
              </View>
            </View>

            {/* ════ SECTION: THE REAL SCIENCE OF EARTH'S TILT ════ */}
            <View style={[S.card, S.cardGlow]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <View style={[S.iconPill, { backgroundColor: 'rgba(56, 189, 248, 0.15)', borderColor: 'rgba(56, 189, 248, 0.3)' }]}>
                  <Ionicons name="planet-outline" size={18} color="#38bdf8" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={S.cardTitle}>Why This Time Changes Every Day</Text>
                  <Text style={S.cardSubtitle}>Earth's 23.44° Axial Tilt & Planetary Solar Geometry</Text>
                </View>
              </View>

              <Text style={S.bodyParagraph}>
                Human biology does not operate on arbitrary mechanical wall clocks. Generic apps falsely claim Vata, Pitta, and Kapha fall at rigid clock numbers like "2 to 4" or "10 to 2".
              </Text>
              <Text style={S.bodyParagraph}>
                In reality, your cells synchronize to <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>true celestial solar angles</Text>. Because the Earth tilts on its axis at 23.44° while orbiting the Sun, daylight duration and solar noon shift every single day at your exact latitude.
              </Text>

              {/* Solar Coordinates Matrix */}
              <View style={S.solarMatrix}>
                <View style={S.solarCol}>
                  <Text style={S.solarIcon}>🌅</Text>
                  <Text style={S.solarVal}>{srStr}</Text>
                  <Text style={S.solarLbl}>SUNRISE</Text>
                </View>
                <View style={S.matrixDivider} />
                <View style={S.solarCol}>
                  <Text style={S.solarIcon}>☀️</Text>
                  <Text style={S.solarVal}>{snStr}</Text>
                  <Text style={S.solarLbl}>SOLAR ZENITH</Text>
                </View>
                <View style={S.matrixDivider} />
                <View style={S.solarCol}>
                  <Text style={S.solarIcon}>🌇</Text>
                  <Text style={S.solarVal}>{ssStr}</Text>
                  <Text style={S.solarLbl}>SUNSET</Text>
                </View>
                <View style={S.matrixDivider} />
                <View style={S.solarCol}>
                  <Text style={S.solarIcon}>⏳</Text>
                  <Text style={S.solarVal}>{dayLengthHrs}h</Text>
                  <Text style={S.solarLbl}>DAY ARC</Text>
                </View>
              </View>

              <View style={S.astronomyNote}>
                <Ionicons name="information-circle-outline" size={15} color="rgba(255,255,255,0.6)" />
                <Text style={S.astronomyNoteText}>
                  Your {period.englishLabel || period.label} phase today ({period.startLabel} – {period.endLabel}) is mathematically derived in real-time from today's solar coordinates.
                </Text>
              </View>
            </View>

            {/* ════ SECTION: MODERN CHRONOBIOLOGY ════ */}
            <View style={S.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <View style={[S.iconPill, { backgroundColor: 'rgba(52, 211, 153, 0.15)', borderColor: 'rgba(52, 211, 153, 0.3)' }]}>
                  <Ionicons name="git-network-outline" size={18} color="#34d399" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={S.cardTitle}>Modern Chronobiology & Cellular Genetics</Text>
                  <Text style={S.cardSubtitle}>2017 Nobel Prize Discovery (Hall, Rosbash, Young)</Text>
                </View>
              </View>

              <Text style={S.bodyParagraph}>{ex.what}</Text>

              <View style={[S.whyMattersBox, { borderLeftColor: accent }]}>
                <Text style={[S.boxEyebrow, { color: accent }]}>PHYSIOLOGICAL IMPACT</Text>
                <Text style={S.whyMattersText}>{ex.whyMatters}</Text>
              </View>

              {/* 3 Scientific Biometric Chips */}
              <View style={S.factsRow}>
                {ex.topFact.map((fact, idx) => (
                  <View key={idx} style={S.factCard}>
                    <Text style={{ fontSize: 24, marginBottom: 6 }}>{fact.icon}</Text>
                    <Text style={[S.factValue, { color: accent }]}>{fact.label}</Text>
                    <Text style={S.factSub}>{fact.value}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* ════ SECTION: 5,000-YEAR AYURVEDIC SCIENCE ════ */}
            <View style={S.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <View style={[S.iconPill, { backgroundColor: 'rgba(245, 158, 11, 0.15)', borderColor: 'rgba(245, 158, 11, 0.3)' }]}>
                  <Ionicons name="sparkles-outline" size={18} color="#F59E0B" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={S.cardTitle}>5,000-Year Classical Ayurvedic Science</Text>
                  <Text style={S.cardSubtitle}>Charaka Samhita · Dinacharya Solar Division</Text>
                </View>
              </View>

              {/* Sanskrit Callout */}
              {s && (
                <View style={[S.sanskritCard, { borderColor: `${accent}40` }]}>
                  <Text style={[S.sanskritWord, { color: accent }]}>{s.sanskrit}</Text>
                  <Text style={S.sanskritMeaning}>"{s.meaning}"</Text>
                </View>
              )}

              {w && (
                <>
                  <Text style={S.bodyParagraph}>{w.ayurvedaBrief}</Text>

                  {/* Elements */}
                  <Text style={[S.boxEyebrow, { color: 'rgba(255,255,255,0.4)', marginTop: 14, marginBottom: 10 }]}>
                    DOMINANT PANCHA MAHABHUTAS (ELEMENTAL QUALITIES)
                  </Text>
                  <View style={S.elementsGrid}>
                    {w.elements.map((el, idx) => (
                      <View key={idx} style={S.elementPill}>
                        <Text style={{ fontSize: 20 }}>{el.emoji}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={S.elementName}>{el.name}</Text>
                          <Text style={S.elementDesc}>{el.desc} {el.italic ? <Text style={{ fontStyle: 'italic' }}>{el.italic}</Text> : null}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </>
              )}

              {/* Analogy Box */}
              <View style={S.analogyBox}>
                <Text style={S.analogyQuote}>"{ex.analogy}"</Text>
              </View>
            </View>

            {/* ════ SECTION: DO & AVOID PROTOCOLS ════ */}
            {w && (
              <View style={S.card}>
                <Text style={S.cardTitle}>Biological Protocols for this Window</Text>
                <Text style={[S.cardSubtitle, { marginBottom: 16 }]}>Aligned with active metabolic enzymes & neuro-hormones</Text>

                <View style={S.protocolsGrid}>
                  {/* Cultivate */}
                  <View style={S.protocolCol}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#34d399' }} />
                      <Text style={[S.protocolHeader, { color: '#34d399' }]}>CULTIVATE</Text>
                    </View>
                    {w.doItems.map((item, idx) => (
                      <View key={idx} style={S.protocolItem}>
                        <Text style={{ fontSize: 14 }}>{item.emoji}</Text>
                        <Text style={S.protocolText}>{item.text}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Avoid */}
                  <View style={S.protocolCol}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#f87171' }} />
                      <Text style={[S.protocolHeader, { color: '#f87171' }]}>PAUSE</Text>
                    </View>
                    {w.avoidItems.map((item, idx) => (
                      <View key={idx} style={S.protocolItem}>
                        <Text style={{ fontSize: 14 }}>{item.emoji}</Text>
                        <Text style={S.protocolText}>{item.text}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            )}

            {/* Bottom Done Button */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleClose}
              style={[S.doneButton, { backgroundColor: accent }]}
            >
              <Text style={S.doneButtonText}>SYNCHRONIZE & CLOSE</Text>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const S = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070814',
  },
  glowOrb: {
    position: 'absolute',
    top: -120,
    alignSelf: 'center',
    width: 320,
    height: 320,
    borderRadius: 160,
    opacity: 0.12,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 100,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  closeCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  centerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  livePillText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  tiltBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderWidth: 0.5,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  tiltBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#38bdf8',
    letterSpacing: 0.8,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  heroHeadline: {
    fontSize: 28,
    fontWeight: '400',
    color: '#FFFFFF',
    lineHeight: 36,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    marginBottom: 8,
  },
  heroTagline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
    lineHeight: 20,
  },
  timeWindowCard: {
    borderRadius: 28,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  cardEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  windowTimePremium: {
    fontSize: 20,
    fontWeight: '400',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  activeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginTop: 14,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  progressSubText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '600',
  },
  card: {
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 24,
    marginBottom: 20,
  },
  cardGlow: {
    borderColor: 'rgba(56, 189, 248, 0.15)',
    backgroundColor: 'rgba(56, 189, 248, 0.02)',
  },
  iconPill: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  cardSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    fontWeight: '500',
    marginTop: 3,
  },
  bodyParagraph: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 24,
    marginBottom: 16,
    fontWeight: '400',
  },
  solarMatrix: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 8,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  solarCol: {
    flex: 1,
    alignItems: 'center',
  },
  solarIcon: {
    fontSize: 16,
    marginBottom: 4,
  },
  solarVal: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  solarLbl: {
    fontSize: 8.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  matrixDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  astronomyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 10,
    borderRadius: 12,
    marginTop: 4,
  },
  astronomyNoteText: {
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 16,
    flex: 1,
    fontWeight: '500',
  },
  whyMattersBox: {
    borderLeftWidth: 3,
    paddingLeft: 14,
    marginVertical: 10,
  },
  boxEyebrow: {
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  whyMattersText: {
    fontSize: 13.5,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 20,
    fontWeight: '500',
  },
  factsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  factCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
  },
  factValue: {
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },
  factSub: {
    fontSize: 9.5,
    color: 'rgba(255,255,255,0.45)',
    fontWeight: '500',
    textAlign: 'center',
  },
  sanskritCard: {
    padding: 20,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 16,
  },
  sanskritWord: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  sanskritMeaning: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  elementsGrid: {
    gap: 10,
    marginBottom: 16,
  },
  elementPill: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.02)',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  elementName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  elementDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 18,
  },
  analogyBox: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 18,
    padding: 16,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(255,255,255,0.3)',
    marginTop: 8,
  },
  analogyQuote: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    fontStyle: 'italic',
    lineHeight: 22,
  },
  protocolsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  protocolCol: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  protocolHeader: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  protocolItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 10,
  },
  protocolText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 18,
    flex: 1,
    fontWeight: '500',
  },
  doneButton: {
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  doneButtonText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1.8,
  },
});
