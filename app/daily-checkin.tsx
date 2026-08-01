import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Animated, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { speakBodhi } from '@/lib/speech';
import { store, KEYS } from '@/lib/storage';
import { addDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Colors, Spacing, Radius, Font } from '@/constants/theme';

const MOODS = [
  { id: 'blissful',  emoji: '😇', label: 'Blissful',  color: '#fbbf24' },
  { id: 'happy',     emoji: '😊', label: 'Happy',     color: '#34d399' },
  { id: 'calm',      emoji: '😌', label: 'Calm',      color: '#60a5fa' },
  { id: 'neutral',   emoji: '😐', label: 'Neutral',   color: '#a3a3a3' },
  { id: 'tired',     emoji: '😴', label: 'Tired',     color: '#a78bfa' },
  { id: 'anxious',   emoji: '😟', label: 'Anxious',   color: '#f97316' },
  { id: 'low',       emoji: '😔', label: 'Low',       color: '#f43f5e' },
];

const ENERGY_LEVELS = [
  { id: 1, label: 'Drained',   color: '#f43f5e' },
  { id: 2, label: 'Low',       color: '#f97316' },
  { id: 3, label: 'Moderate',  color: '#fbbf24' },
  { id: 4, label: 'Good',      color: '#34d399' },
  { id: 5, label: 'Energised', color: '#10b981' },
];

const AYUR_GREETINGS: Record<string, string[]> = {
  morning:   ['Brahma muhurta pranam! The divine dawn blesses your new beginning.', 'Suprabhat! Agni awakens — nourish it with warm water and sunlight today.', 'This sacred morning hour is Sattvic gold. Begin with stillness.'],
  afternoon: ['Pitta kala greets you. Your fire is at its peak — digest well and act decisively.', 'Midday clarity arrives. Channel your Pitta into purposeful action.'],
  evening:   ['Vata kala descends. The mind needs grounding — gentle walk, light dinner, stillness.', 'As the sun sets, Apana Vata flows down. Let go of the day with grace.'],
};

function getBodhiGreeting(name: string, prakriti: string, mood: string, energy: number, lang = 'en'): string {
  const hour = new Date().getHours();
  const slot = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const greets = AYUR_GREETINGS[slot];
  const base = greets[Math.floor(Math.random() * greets.length)];
  const dosha = prakriti?.split('-')[0] ?? '';

  if (lang === 'hi') {
    const moodHi: Record<string, string> = {
      blissful: 'आपका सत्व उज्ज्वल है। इस स्पष्टता का उपयोग ध्यान या सृजनात्मक कार्य के लिए करें।',
      happy:    'आज ओजस ऊर्जा सुंदर है! इसे साझा करें — संपर्क से आनंद बढ़ता है।',
      calm:     'स्थिरता सर्वोच्च आयुर्वेदिक अवस्था है। आप संरेखित हैं।',
      neutral:  'संतुलन उपस्थित है। एक छोटा प्राणायाम आपकी जागरूकता को बढ़ा सकता है।',
      tired:    'विश्राम कमज़ोरी नहीं, औषधि है। आज रात अश्वगंधा और गर्म दूध को प्राथमिकता दें।',
      anxious:  'वात बढ़ा हुआ है। स्वयं को ground करें — पृथ्वी पर नंगे पाँव, तिल के तेल से स्वयं मालिश।',
      low:      'आपके अग्नि को पुनः जागृत करना है। धूप, गतिविधि और गर्म पोषक भोजन लें।',
    };
    const doshaHi: Record<string, string> = {
      Vata:  'वात प्रकृति के रूप में, दिनचर्या और ऊष्णता आपके आधार हैं।',
      Pitta: 'पित्त प्रकृति के रूप में, अधिक गर्मी से बचें — गतिविधियों के बीच ठंडी छाया में विश्राम करें।',
      Kapha: 'कफ प्रकृति के रूप में, गति आपकी औषधि है। 10 मिनट की तेज़ सैर भी अग्नि प्रज्वलित करती है।',
    };
    return `नमस्ते, ${name}! ${base} ${moodHi[mood] ?? ''} ${doshaHi[dosha] ?? ''}`.trim();
  }

  const moodAdvice: Record<string, string> = {
    blissful: 'Your Sattva is radiating. Use this clarity for meditation or creative work.',
    happy:    'Beautiful Ojas energy today! Share it — connection multiplies joy.',
    calm:     'Stillness is the highest Ayurvedic state. You are aligned.',
    neutral:  'Balance is present. A short pranayama can amplify your awareness.',
    tired:    'Rest is medicine, not weakness. Prioritise Ashwagandha, warm milk tonight.',
    anxious:  'Vata is elevated. Ground yourself — barefoot on earth, warm sesame oil self-massage.',
    low:      'Your Agni needs rekindling. Sun exposure, movement, and warm nourishing food today.',
  };
  const doshaAdvice: Record<string, string> = {
    Vata:  'As a Vata type, routine and warmth are your anchors today.',
    Pitta: 'As a Pitta type, avoid overheating — rest in cool shade between activities.',
    Kapha: 'As a Kapha type, movement is your medicine. Even 10 minutes of brisk walking ignites your Agni.',
  };
  return `Namaste ${name}! ${base} ${moodAdvice[mood] ?? ''} ${doshaAdvice[dosha] ?? ''}`.trim();
}

export default function DailyCheckInScreen() {
  const router = useRouter();
  const [step, setStep] = useState<'mood' | 'energy' | 'result'>('mood');
  const [mood, setMood] = useState('');
  const [energy, setEnergy] = useState(0);
  const [greeting, setGreeting] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [alreadyDone, setAlreadyDone] = useState(false);
  const [name, setName] = useState('Seeker');
  const [prakriti, setPrakriti] = useState('');
  const [lang, setLang] = useState('en');
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const hour = new Date().getHours();
  const kala = hour < 12 ? '🌅 Kapha Kala' : hour < 17 ? '☀️ Pitta Kala' : '🪔 Vata Kala';
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    (async () => {
      const a = await store.getJSON<{ name: string }>(KEYS.auth);
      setName(a?.name ?? auth.currentUser?.displayName ?? 'Seeker');
      const d = await store.getJSON<{ prakritiAssessment?: { prakriti?: { primary?: string } } }>(KEYS.dosha);
      setPrakriti(d?.prakritiAssessment?.prakriti?.primary ?? '');
      const l = await store.get(KEYS.language); if (l) setLang(l);

      const uid = auth.currentUser?.uid;
      if (uid) {
        const snap = await getDocs(query(collection(db, 'daily_checkins'), where('userId', '==', uid), where('date', '==', today)));
        if (!snap.empty) {
          const data = snap.docs[0].data();
          setMood(data.mood ?? '');
          setEnergy(data.energy ?? 0);
          setGreeting(data.greeting ?? '');
          setAlreadyDone(true);
          setStep('result');
        }
      }
    })();
  }, []);

  const fadeSwitch = (cb: () => void) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
      cb();
      Animated.timing(fadeAnim, { toValue: 1, duration: 260, useNativeDriver: true }).start();
    });
  };

  const selectMood = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMood(id);
    setTimeout(() => fadeSwitch(() => setStep('energy')), 200);
  };

  const selectEnergy = async (lvl: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setEnergy(lvl);
    setSaving(true);
    const g = getBodhiGreeting(name, prakriti, mood, lvl, lang);
    setGreeting(g);
    try {
      const uid = auth.currentUser?.uid;
      if (uid) {
        await addDoc(collection(db, 'daily_checkins'), { userId: uid, date: today, mood, energy: lvl, greeting: g, loggedAt: serverTimestamp() });
      }
    } catch { /* silent */ }
    setSaving(false);
    fadeSwitch(() => setStep('result'));
    setSpeaking(true);
    await speakBodhi(g);
    setSpeaking(false);
  };

  const moodObj = MOODS.find(m => m.id === mood);
  const energyObj = ENERGY_LEVELS.find(e => e.id === energy);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <LinearGradient colors={[Colors.gold + '12', Colors.bg]} style={styles.header}>
          <TouchableOpacity hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }} onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.headerTitle}>Daily Check-In</Text>
            <Text style={styles.headerSub}>{kala} · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</Text>
          </View>
          <View style={{ width: 60 }} />
        </LinearGradient>

        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

            {/* ── MOOD STEP ── */}
            {step === 'mood' && (
              <>
                <Text style={styles.stepEmoji}>💭</Text>
                <Text style={styles.question}>{lang === 'hi' ? 'आप अभी कैसा महसूस कर रहे हैं?' : `How are you feeling${"\n"}right now?`}</Text>
                <Text style={styles.sub}>{lang === 'hi' ? 'आपकी भावनात्मक स्थिति आज की आयुर्वेदिक दिशा तय करती है' : "Your emotional state guides today's Ayurvedic wisdom"}</Text>
                <View style={styles.moodGrid}>
                  {MOODS.map(m => (
                    <TouchableOpacity key={m.id} onPress={() => selectMood(m.id)} activeOpacity={0.75}
                      style={[styles.moodCard, mood === m.id && { borderColor: m.color, backgroundColor: m.color + '18' }]}>
                      <Text style={styles.moodEmoji}>{m.emoji}</Text>
                      <Text style={[styles.moodLabel, mood === m.id && { color: m.color }]}>{m.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* ── ENERGY STEP ── */}
            {step === 'energy' && (
              <>
                <Text style={styles.stepEmoji}>⚡</Text>
                <Text style={styles.question}>{lang === 'hi' ? 'आज आपकी ऊर्जा का स्तर क्या है?' : `What's your energy${"\n"}level today?`}</Text>
                <Text style={styles.sub}>{lang === 'hi' ? 'आयुर्वेद में इसे प्राण कहते हैं — जीवन शक्ति' : 'Ayurveda calls this your Prana — vital life force'}</Text>
                {saving && <ActivityIndicator color={Colors.gold} style={{ marginBottom: 12 }} />}
                <View style={styles.energyCol}>
                  {[...ENERGY_LEVELS].reverse().map(e => (
                    <TouchableOpacity key={e.id} onPress={() => selectEnergy(e.id)} activeOpacity={0.78}
                      style={[styles.energyCard, { borderColor: e.color + '40' }]}>
                      <View style={[styles.energyDots, { gap: 4 }]}>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <View key={i} style={[styles.dot, { backgroundColor: i < e.id ? e.color : Colors.border }]} />
                        ))}
                      </View>
                      <Text style={[styles.energyLabel, { color: e.color }]}>{e.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* ── RESULT STEP ── */}
            {step === 'result' && (
              <>
                {/* Mood + Energy chips */}
                <View style={styles.summaryRow}>
                  {moodObj && (
                    <View style={[styles.summaryChip, { borderColor: moodObj.color + '50', backgroundColor: moodObj.color + '15' }]}>
                      <Text style={styles.summaryChipEmoji}>{moodObj.emoji}</Text>
                      <Text style={[styles.summaryChipText, { color: moodObj.color }]}>{moodObj.label}</Text>
                    </View>
                  )}
                  {energyObj && (
                    <View style={[styles.summaryChip, { borderColor: energyObj.color + '50', backgroundColor: energyObj.color + '15' }]}>
                      <Text style={styles.summaryChipEmoji}>⚡</Text>
                      <Text style={[styles.summaryChipText, { color: energyObj.color }]}>{energyObj.label}</Text>
                    </View>
                  )}
                  {alreadyDone && (
                    <View style={[styles.summaryChip, { borderColor: Colors.gold + '40', backgroundColor: Colors.gold + '10' }]}>
                      <Text style={styles.summaryChipText}>✓ Done today</Text>
                    </View>
                  )}
                </View>

                {/* Bodhi message */}
                <LinearGradient colors={[Colors.gold + '12', Colors.purple + '08']} style={styles.bodhiCard}>
                  <View style={styles.bodhiHeader}>
                    <LinearGradient colors={[Colors.gold + '30', Colors.purple + '20']} style={styles.bodhiAvatar}>
                      <Text style={styles.bodhiAvatarText}>ॐ</Text>
                    </LinearGradient>
                    <View>
                      <Text style={styles.bodhiName}>✦ {lang === 'hi' ? 'आपकी स्वास्थ्य अंतर्दृष्टि' : 'Your Health Insight'}</Text>
                      {speaking && <Text style={styles.speakingText}>♪ speaking...</Text>}
                    </View>
                    <TouchableOpacity onPress={async () => { setSpeaking(true); await speakBodhi(greeting); setSpeaking(false); }}
                      style={styles.replaySpeakBtn}>
                      <Text style={styles.replaySpeakIcon}>{speaking ? '🔊' : '🔈'}</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.greetingText}>{greeting}</Text>
                </LinearGradient>

                {/* Suggested actions */}
                <View style={styles.suggestSection}>
                  <Text style={styles.suggestTitle}>SUGGESTED FOR YOU</Text>
                  {[
                    { emoji: '🧘', label: 'Morning Meditation', route: '/pranayama', color: '#c084fc' },
                    { emoji: '🌿', label: 'Log Today\'s Habits', route: '/habits',   color: '#34d399' },
                    { emoji: '🤖', label: 'Ask Bodhi Anything',  route: '/(tabs)/bodhi', color: Colors.gold },
                  ].map(s => (
                    <TouchableOpacity key={s.label} onPress={() => router.push(s.route as never)}
                      activeOpacity={0.78} style={[styles.suggestCard, { borderColor: s.color + '30' }]}>
                      <View style={[styles.suggestIcon, { backgroundColor: s.color + '18' }]}>
                        <Text style={{ fontSize: 20 }}>{s.emoji}</Text>
                      </View>
                      <Text style={[styles.suggestLabel, { color: s.color }]}>{s.label}</Text>
                      <Text style={[styles.suggestArrow, { color: s.color }]}>›</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

          </ScrollView>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.md },
  backBtn: { width: 60, paddingVertical: 4, zIndex: 100, elevation: 100 },
  backText: { color: Colors.textMuted, fontSize: Font.sizes.sm, fontWeight: '600' },
  headerTitle: { fontSize: Font.sizes.base, fontWeight: '800', color: Colors.text },
  headerSub: { fontSize: Font.sizes.xs, color: Colors.gold, marginTop: 2, fontWeight: '600' },
  scroll: { padding: Spacing.lg, paddingBottom: 60 },
  stepEmoji: { fontSize: 48, marginBottom: 10 },
  question: { fontSize: 22, fontWeight: '900', color: Colors.text, lineHeight: 30, marginBottom: 6 },
  sub: { fontSize: Font.sizes.sm, color: Colors.textMuted, marginBottom: Spacing.lg, lineHeight: 20 },
  moodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  moodCard: { width: '30%', alignItems: 'center', backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: Colors.border, paddingVertical: Spacing.md, gap: 4 },
  moodEmoji: { fontSize: 28 },
  moodLabel: { fontSize: Font.sizes.xs, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.3 },
  energyCol: { gap: 10 },
  energyCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md },
  energyDots: { flexDirection: 'row' },
  dot: { width: 16, height: 16, borderRadius: 8 },
  energyLabel: { fontSize: Font.sizes.base, fontWeight: '800' },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.lg },
  summaryChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 6 },
  summaryChipEmoji: { fontSize: 14 },
  summaryChipText: { fontSize: Font.sizes.xs, fontWeight: '700', color: Colors.textMuted },
  bodhiCard: { borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.gold + '20', padding: Spacing.md, marginBottom: Spacing.lg },
  bodhiHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  bodhiAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  bodhiAvatarText: { fontSize: 18, color: Colors.gold },
  bodhiName: { fontSize: Font.sizes.sm, fontWeight: '800', color: Colors.gold },
  speakingText: { fontSize: Font.sizes.xs, color: Colors.gold + 'aa', marginTop: 2 },
  replaySpeakBtn: { marginLeft: 'auto', padding: 4 },
  replaySpeakIcon: { fontSize: 20 },
  greetingText: { fontSize: Font.sizes.base, color: Colors.text, lineHeight: 24 },
  suggestSection: { gap: 10 },
  suggestTitle: { fontSize: Font.sizes.xs, fontWeight: '800', color: Colors.textMuted, letterSpacing: 1.2, marginBottom: 4 },
  suggestCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.sm + 2 },
  suggestIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  suggestLabel: { flex: 1, fontSize: Font.sizes.base, fontWeight: '700' },
  suggestArrow: { fontSize: 22 },
});
