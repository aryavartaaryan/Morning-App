import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Dimensions, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { speakBodhi } from '@/lib/speech';
import { store, KEYS } from '@/lib/storage';
import { Colors, Spacing, Radius, Font } from '@/constants/theme';

const { width, height } = Dimensions.get('window');
const CHECKIN_KEY = 'onesutra_daily_checkin_mobile_v1';

function getTodayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

// ─── Helpers (called from index.tsx) ─────────────────────────────────────────
export async function shouldShowDailyCheckIn(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(CHECKIN_KEY);
    if (!raw) return true;
    const parsed = JSON.parse(raw) as { date?: string };
    return parsed.date !== getTodayIST();
  } catch {
    return true;
  }
}

// ─── Mood cards ───────────────────────────────────────────────────────────────
const MOOD_CARDS_EN = [
  { key: 'blooming', emoji: '🌸', label: 'Blooming', sub: 'Joyful · Energized', color: '#fb923c',
    bodhiLine_en: "A beautiful day lives inside that feeling — let's honor it.",
    bodhiLine_hi: 'आज का दिन उस feeling को honor करने का है।' },
  { key: 'gentle',   emoji: '🍃', label: 'Gentle',   sub: 'Calm · Peaceful',    color: '#4ade80',
    bodhiLine_en: 'Still and clear. The best place to begin from.',
    bodhiLine_hi: 'शांत और साफ। शुरू करने की सबसे अच्छी जगह।' },
  { key: 'stormy',   emoji: '🌩️', label: 'Stormy',   sub: 'Anxious · Scattered', color: '#a78bfa',
    bodhiLine_en: 'The storm will pass. We move gently today.',
    bodhiLine_hi: 'तूफान गुज़र जाएगा। आज धीरे-धीरे चलते हैं।' },
  { key: 'intense',  emoji: '🔥', label: 'Intense',  sub: 'Driven · Fiery',     color: '#fbbf24',
    bodhiLine_en: "That fire is power. Let's channel it well.",
    bodhiLine_hi: 'वो fire power है। सही जगह लगाओ।' },
  { key: 'heavy',    emoji: '🪨', label: 'Heavy',    sub: 'Sluggish · Low',     color: '#94a3b8',
    bodhiLine_en: 'Heavy mornings are information, not failure. Small steps today.',
    bodhiLine_hi: 'Heavy morning information है, failure नहीं। आज छोटे steps।' },
] as const;
const MOOD_CARDS_HI = [
  { key: 'blooming', emoji: '🌸', label: 'खिला हुआ', sub: 'खुशी · उर्जावान', color: '#fb923c',
    bodhiLine_en: "A beautiful day lives inside that feeling.",
    bodhiLine_hi: 'आज का दिन उस feeling को honor करने का है।' },
  { key: 'gentle',   emoji: '🍃', label: 'शांत',     sub: 'Calm · Peaceful',    color: '#4ade80',
    bodhiLine_en: 'Still and clear.',
    bodhiLine_hi: 'शांत और साफ। शुरू करने की सबसे अच्छी जगह।' },
  { key: 'stormy',   emoji: '🌩️', label: 'उथल-पुथल', sub: 'Anxious · Scattered', color: '#a78bfa',
    bodhiLine_en: 'The storm will pass.',
    bodhiLine_hi: 'तूफान गुज़र जाएगा। आज धीरे-धीरे चलते हैं।' },
  { key: 'intense',  emoji: '🔥', label: 'Intense',   sub: 'Driven · Fiery',    color: '#fbbf24',
    bodhiLine_en: "That fire is power. Channel it well.",
    bodhiLine_hi: 'वो fire power है। सही जगह लगाओ।' },
  { key: 'heavy',    emoji: '🪨', label: 'भारी',      sub: 'Sluggish · Low',    color: '#94a3b8',
    bodhiLine_en: 'Heavy mornings are information, not failure.',
    bodhiLine_hi: 'Heavy morning information है, failure नहीं।' },
] as const;
type MoodKey = 'blooming' | 'gentle' | 'stormy' | 'intense' | 'heavy';

// ─── Bilingual Questions ──────────────────────────────────────────────────────
const QUESTIONS_EN = [
  {
    id: 'wakeup', emoji: '🌅', question: 'How did you wake up this morning?',
    options: [
      { id: 'bright',    emoji: '✨', label: 'Bright & refreshed' },
      { id: 'ok',        emoji: '😶', label: 'Okay, needed a moment' },
      { id: 'groggy',    emoji: '😴', label: 'Groggy & heavy' },
      { id: 'restless',  emoji: '😰', label: 'Restless & anxious' },
    ],
  },
  {
    id: 'digestion', emoji: '🔥', question: 'How is your Agni — digestive fire?',
    options: [
      { id: 'blazing', emoji: '💪', label: 'Blazing — strong appetite' },
      { id: 'steady',  emoji: '🌊', label: 'Steady & comfortable' },
      { id: 'slow',    emoji: '🐌', label: 'Slow, heavy, bloated' },
      { id: 'burning', emoji: '🌶️', label: 'Burning acidity' },
    ],
  },
  {
    id: 'energy', emoji: '⚡', question: 'How is your energy flowing right now?',
    options: [
      { id: 'flowing',  emoji: '🚀', label: 'Flowing freely — in the zone' },
      { id: 'steady',   emoji: '🌊', label: 'Steady, doing okay' },
      { id: 'crashing', emoji: '🌫️', label: 'Crashing, need a reset' },
      { id: 'wired',    emoji: '😬', label: "Wired but can't settle" },
    ],
  },
  {
    id: 'mind', emoji: '🧠', question: 'Your mind feels like...?',
    options: [
      { id: 'clear',    emoji: '🔮', label: 'Crystal clear, focused' },
      { id: 'foggy',    emoji: '🌫️', label: 'Foggy & scattered' },
      { id: 'stressed', emoji: '⚡',  label: 'Sharp but stressed' },
      { id: 'peaceful', emoji: '🍃', label: 'Peaceful, present' },
    ],
  },
] as const;

const QUESTIONS_HI = [
  {
    id: 'wakeup', emoji: '🌅', question: 'आज सुबह नींद कैसे खुली?',
    options: [
      { id: 'bright',   emoji: '✨', label: 'Fresh & energized' },
      { id: 'ok',       emoji: '😶', label: 'ठीक था, थोड़ा समय लगा' },
      { id: 'groggy',   emoji: '😴', label: 'Heavy, sluggish feel' },
      { id: 'restless', emoji: '😰', label: 'Restless & anxious था' },
    ],
  },
  {
    id: 'digestion', emoji: '🔥', question: 'Agni — पाचन अग्नि — कैसी है?',
    options: [
      { id: 'blazing', emoji: '💪', label: 'मजबूत — अच्छी भूख' },
      { id: 'steady',  emoji: '🌊', label: 'Steady & comfortable' },
      { id: 'slow',    emoji: '🐌', label: 'Slow, heavy, bloated' },
      { id: 'burning', emoji: '🌶️', label: 'Acidity / जलन' },
    ],
  },
  {
    id: 'energy', emoji: '⚡', question: 'अभी energy कैसे flow हो रही है?',
    options: [
      { id: 'flowing',  emoji: '🚀', label: 'जोश में हूँ — in the zone' },
      { id: 'steady',   emoji: '🌊', label: 'Steady, ठीक-ठाक है' },
      { id: 'crashing', emoji: '🌫️', label: 'Crash हो रहा है' },
      { id: 'wired',    emoji: '😬', label: 'Wired पर settle नहीं' },
    ],
  },
  {
    id: 'mind', emoji: '🧠', question: 'मन अभी कैसा लग रहा है?',
    options: [
      { id: 'clear',    emoji: '🔮', label: 'बिल्कुल साफ, focused' },
      { id: 'foggy',    emoji: '🌫️', label: 'Foggy & scattered' },
      { id: 'stressed', emoji: '⚡',  label: 'Sharp पर stressed' },
      { id: 'peaceful', emoji: '🍃', label: 'शांत और present' },
    ],
  },
] as const;

type QuestionItem = typeof QUESTIONS_EN[number];

// ─── Bilingual speak helpers ─────────────────────────────────────────────────
const MOOD_INTRO = {
  en: (name: string) => `Hey ${name}! How are you feeling today? Pick the vibe that fits.`,
  hi: (name: string) => `हेय ${name}! आज कैसा महसूस कर रहे हो? जो mood सही लगे चुनो।`,
};
const RESULT_SPEAK = {
  en: (name: string) => `Here's what Bodhi sees for you today, ${name}. Have a great day!`,
  hi: (name: string) => `${name}, ये रहा आज के लिए Bodhi का insight। दिन शानदार हो!`,
};

// ─── Insight builder ──────────────────────────────────────────────────────────
function buildInsight(name: string, mood: MoodKey | null, answers: Record<string, string>, lang: string): string {
  const isHi = lang === 'hi';
  const moodCard = MOOD_CARDS_EN.find(card => card.key === mood);
  const lines: string[] = [];

  if (isHi) {
    if (mood === 'blooming') lines.push(`${name}, आज तुम्हारा Ojas radiant है — उसे protect करो।`);
    else if (mood === 'stormy') lines.push(`${name}, Vata elevated है। Warm food, slow breath और कम rushing।`);
    else if (mood === 'intense') lines.push(`${name}, Pitta strong है। Heat और conflict से बचो।`);
    else if (mood === 'heavy') lines.push(`${name}, Kapha को activate करने की ज़रूरत है। Light movement और dry foods।`);
    else lines.push(`${name}, तुम balanced हो — deep practice के लिए perfect state।`);
    if (answers.digestion === 'slow' || answers.digestion === 'burning')
      lines.push('Agni को care चाहिए — ठंडा खाना avoid करो, CCF tea पियो।');
    if (answers.wakeup === 'groggy' || answers.wakeup === 'restless')
      lines.push('नींद incomplete थी — आज Prana बचाओ, धीरे-धीरे चलो।');
    if (answers.energy === 'crashing') lines.push('Gentle movement से Agni ignite करो।');
    if (answers.energy === 'wired') lines.push('Warm sesame oil और screen-time कम करो।');
    if (answers.mind === 'foggy') lines.push('Brahmi tea और 5 min pranayama — fog उठ जाएगी।');
  } else {
    if (mood === 'blooming') lines.push(`${name}, your Ojas is radiant today — protect that energy.`);
    else if (mood === 'stormy') lines.push(`${name}, Vata is elevated. Ground yourself — warm food, slow breath, less rushing.`);
    else if (mood === 'intense') lines.push(`${name}, Pitta is strong. Channel it wisely — avoid excess heat and conflict.`);
    else if (mood === 'heavy') lines.push(`${name}, Kapha needs activation. Light movement and dry foods will restore your spark.`);
    else lines.push(`${name}, you're steady and balanced — a perfect state for deep practice today.`);
    if (answers.digestion === 'slow' || answers.digestion === 'burning')
      lines.push('Agni needs care — avoid cold food, drink warm CCF tea after meals.');
    if (answers.wakeup === 'groggy' || answers.wakeup === 'restless')
      lines.push('Rest was incomplete — protect your Prana today, take it slow.');
    if (answers.energy === 'crashing') lines.push('Begin with gentle movement to ignite your morning Agni.');
    if (answers.energy === 'wired') lines.push('Ground Vata with warm sesame oil, avoid excess screen-time.');
    if (answers.mind === 'foggy') lines.push('Brahmi tea and 5 minutes of pranayama will lift mental fog quickly.');
  }

  return lines.join(' ');
}

// ─── Component ────────────────────────────────────────────────────────────────
interface Props {
  visible: boolean;
  userName: string;
  accentColor?: string;
  onClose: () => void;
}

export default function DailyCheckInModal({ visible, userName, accentColor = '#F59E0B', onClose }: Props) {
  const firstName = userName.split(' ')[0] || 'friend';
  const [lang, setLang] = useState('en');
  const [phase, setPhase] = useState<'mood' | 'questions' | 'result'>('mood');
  const [selectedMood, setSelectedMood] = useState<MoodKey | null>(null);
  const [moodLine, setMoodLine] = useState('');
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [insight, setInsight] = useState('');
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  const moodCards = lang === 'hi' ? MOOD_CARDS_HI : MOOD_CARDS_EN;
  const questions = lang === 'hi' ? QUESTIONS_HI : QUESTIONS_EN;

  // Load language preference
  useEffect(() => {
    store.get(KEYS.language).then(l => { if (l) setLang(l); });
  }, []);

  useEffect(() => {
    if (visible) {
      setPhase('mood'); setSelectedMood(null); setMoodLine('');
      setQIndex(0); setAnswers({}); setInsight('');
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
      // Bodhi greets in chosen language
      const intro = lang === 'hi' ? MOOD_INTRO.hi(firstName) : MOOD_INTRO.en(firstName);
      setTimeout(() => speakBodhi(intro), 800);
    } else {
      fadeAnim.setValue(0);
    }
  }, [visible, lang]);

  // Speak each new question as it appears
  useEffect(() => {
    if (phase === 'questions' && questions[qIndex]) {
      speakBodhi(questions[qIndex].question);
    }
  }, [qIndex, phase]);

  const handleMoodSelect = useCallback(async (card: typeof moodCards[number]) => {
    if (selectedMood) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedMood(card.key as MoodKey);
    const line = lang === 'hi' ? card.bodhiLine_hi : card.bodhiLine_en;
    setMoodLine(line);
    speakBodhi(line);
    setTimeout(() => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setPhase('questions');
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      });
    }, 2200);
  }, [selectedMood, lang, moodCards]);

  const handleAnswerSelect = useCallback(async (optId: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newAnswers = { ...answers, [questions[qIndex].id]: optId };
    setAnswers(newAnswers);
    if (qIndex < questions.length - 1) {
      Animated.timing(fadeAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
        setQIndex(prev => prev + 1);
        Animated.timing(fadeAnim, { toValue: 1, duration: 320, useNativeDriver: true }).start();
      });
    } else {
      const msg = buildInsight(firstName, selectedMood, newAnswers, lang);
      setInsight(msg);
      Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setPhase('result');
        Animated.timing(fadeAnim, { toValue: 1, duration: 450, useNativeDriver: true }).start();
        const resultLine = lang === 'hi' ? RESULT_SPEAK.hi(firstName) : RESULT_SPEAK.en(firstName);
        setTimeout(() => speakBodhi(resultLine), 600);
      });
    }
  }, [qIndex, answers, selectedMood, firstName, lang, questions, moodCards]);

  const handleComplete = useCallback(async () => {
    await AsyncStorage.setItem(CHECKIN_KEY, JSON.stringify({
      date: getTodayIST(), mood: selectedMood, answers, completedAt: Date.now(),
    }));
    const uid = auth.currentUser?.uid;
    if (uid) {
      try {
        await addDoc(collection(db, 'daily_checkins'), {
          userId: uid, date: getTodayIST(), mood: selectedMood, answers,
          completedAt: serverTimestamp(), skipped: false,
        });
      } catch { /* offline — ok */ }
    }
    onClose();
  }, [selectedMood, answers, onClose]);

  const handleSkip = useCallback(async () => {
    await AsyncStorage.setItem(CHECKIN_KEY, JSON.stringify({ date: getTodayIST(), skipped: true }));
    onClose();
  }, [onClose]);

  const currentQ = questions[qIndex];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent>
      <LinearGradient colors={['#04020E', '#0C0520', '#04020E']} style={styles.root}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <LinearGradient colors={[accentColor + '40', accentColor + '20']} style={styles.bodhiOrb}>
            <Text style={styles.bodhiOrbEmoji}>✦</Text>
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{lang === 'hi' ? 'Bodhi का Daily Check-In' : "Bodhi's Daily Check-In"}</Text>
            <Text style={styles.headerSub}>
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
          </View>
          <TouchableOpacity onPress={handleSkip} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.skipTxt}>{lang === 'hi' ? 'छोड़ें' : 'Skip'}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Progress (questions phase) ── */}
        {phase === 'questions' && (
          <View style={styles.progressRow}>
            {questions.map((_, i) => (
              <View key={i} style={[
                styles.progressDot,
                {
                  backgroundColor: i < qIndex ? accentColor : i === qIndex ? accentColor : 'rgba(255,255,255,0.15)',
                  width: i === qIndex ? 22 : 8,
                  opacity: i <= qIndex ? 1 : 0.4,
                },
              ]} />
            ))}
          </View>
        )}

        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>

            {/* ══════════════ PHASE: MOOD ══════════════ */}
            {phase === 'mood' && (
              <View style={styles.phaseWrap}>
                <Text style={styles.greeting}>🙏 {lang === 'hi' ? `नमस्ते, ${firstName}` : `Namaste, ${firstName}`}</Text>
                <Text style={styles.bigQuestion}>{lang === 'hi' ? 'आज कैसा महसूस\nकर रहे हो?' : 'How are you feeling\nthis morning?'}</Text>
                <Text style={styles.subHint}>{lang === 'hi' ? 'जो सबसे सही लगे वो चुनो' : 'Choose what resonates most'}</Text>

                {/* 2+2+1 mood grid */}
                <View style={styles.moodGrid}>
                  {moodCards.map(card => {
                    const isSelected = selectedMood === card.key;
                    const isDimmed = selectedMood !== null && !isSelected;
                    return (
                      <TouchableOpacity key={card.key} onPress={() => handleMoodSelect(card)}
                        activeOpacity={0.75}
                        style={[styles.moodCard,
                          isSelected && { borderColor: card.color, backgroundColor: card.color + '22' },
                          isDimmed && { opacity: 0.28 },
                        ]}>
                        <Text style={styles.moodEmoji}>{card.emoji}</Text>
                        <Text style={[styles.moodLabel, isSelected && { color: card.color }]}>{card.label}</Text>
                        <Text style={styles.moodSub}>{card.sub}</Text>
                        {isSelected && (
                          <View style={[styles.moodCheck, { backgroundColor: card.color }]}>
                            <Text style={styles.moodCheckTxt}>✓</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Bodhi response line */}
                {!!moodLine && (
                  <View style={[styles.bodhiMsg, { borderColor: accentColor + '35' }]}>
                    <Text style={[styles.bodhiMsgTxt, { color: accentColor }]}>✦  {moodLine}</Text>
                  </View>
                )}
              </View>
            )}

            {/* ══════════════ PHASE: QUESTIONS ══════════════ */}
            {phase === 'questions' && (
              <View style={styles.phaseWrap}>
                <Text style={styles.qEmoji}>{currentQ.emoji}</Text>
                <Text style={styles.bigQuestion}>{currentQ.question}</Text>
                <Text style={styles.subHint}>{lang === 'hi' ? `प्रश्न ${qIndex + 1} / ${questions.length}` : `Question ${qIndex + 1} of ${questions.length}`}</Text>

                <View style={styles.optionsList}>
                  {currentQ.options.map(opt => {
                    const isSelected = answers[currentQ.id] === opt.id;
                    return (
                      <TouchableOpacity key={opt.id} onPress={() => handleAnswerSelect(opt.id)}
                        activeOpacity={0.78}
                        style={[styles.optionBtn,
                          isSelected && { backgroundColor: accentColor + '18', borderColor: accentColor + '55' },
                        ]}>
                        <Text style={styles.optionEmoji}>{opt.emoji}</Text>
                        <Text style={[styles.optionLabel, isSelected && { color: accentColor }]}>{opt.label}</Text>
                        {isSelected && <Text style={[styles.optionCheck, { color: accentColor }]}>✓</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* ══════════════ PHASE: RESULT ══════════════ */}
            {phase === 'result' && (
              <View style={[styles.phaseWrap, { alignItems: 'center' }]}>
                <LinearGradient colors={[accentColor + '35', accentColor + '12']} style={styles.resultOrb}>
                  <Text style={styles.resultOrbEmoji}>✦</Text>
                </LinearGradient>
                <Text style={styles.resultTitle}>{lang === 'hi' ? 'Check-In Complete! ✨' : 'Check-In Complete!'}</Text>
                <Text style={styles.resultSub}>{lang === 'hi' ? 'Bodhi का आज का insight तुम्हारे लिए तैयार है' : "Bodhi has your Ayurvedic guidance for today"}</Text>

                <LinearGradient colors={['rgba(245,158,11,0.12)', 'rgba(245,158,11,0.05)']}
                  style={[styles.insightCard, { borderColor: accentColor + '30' }]}>
                  <Text style={[styles.insightLabel, { color: accentColor }]}>{lang === 'hi' ? '✶  Bodhi’s Insight' : '✶  Bodhi’s Insight'}</Text>
                  <Text style={styles.insightText}>{insight}</Text>
                </LinearGradient>

                <TouchableOpacity onPress={handleComplete} style={styles.doneWrap} activeOpacity={0.85}>
                  <LinearGradient colors={['#D4A840', '#F5C842']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.doneBtn}>
                    <Text style={styles.doneTxt}>{lang === 'hi' ? 'आज का यात्रा शुरू करें ✶' : 'Begin My Sacred Day ✶'}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}

          </Animated.View>
        </ScrollView>
      </LinearGradient>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const MOOD_W = (width - Spacing.lg * 2 - 10) / 2;

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  bodhiOrb: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  bodhiOrbEmoji: { fontSize: 20, color: '#fff' },
  headerTitle: { fontSize: Font.sizes.base, fontWeight: '800', color: Colors.text, letterSpacing: 0.2 },
  headerSub: { fontSize: Font.sizes.xs, color: Colors.textMuted, marginTop: 2 },
  skipTxt: { fontSize: Font.sizes.sm, color: Colors.textMuted, fontWeight: '600' },

  // Progress
  progressRow: { flexDirection: 'row', gap: 6, paddingHorizontal: Spacing.lg, paddingVertical: 10, alignItems: 'center' },
  progressDot: { height: 4, borderRadius: 2 },

  // Body
  body: { paddingHorizontal: Spacing.lg, paddingBottom: 40, flexGrow: 1 },
  phaseWrap: { paddingTop: 22, gap: 0 },

  // Text
  greeting: { fontSize: Font.sizes.sm, color: Colors.textMuted, fontWeight: '700', marginBottom: 8, letterSpacing: 0.4 },
  bigQuestion: { fontSize: 26, fontWeight: '900', color: Colors.text, lineHeight: 34, marginBottom: 6, letterSpacing: -0.5 },
  subHint: { fontSize: Font.sizes.xs, color: Colors.textDim, marginBottom: 20 },
  qEmoji: { fontSize: 42, marginBottom: 10 },

  // Mood cards
  moodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  moodCard: {
    width: MOOD_W, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: Radius.xl, padding: 14, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)', position: 'relative',
  },
  moodEmoji: { fontSize: 30, marginBottom: 6 },
  moodLabel: { fontSize: Font.sizes.sm, fontWeight: '800', color: Colors.text, marginBottom: 3 },
  moodSub: { fontSize: 9, color: Colors.textMuted, textAlign: 'center', lineHeight: 13 },
  moodCheck: { position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  moodCheckTxt: { fontSize: 9, color: '#fff', fontWeight: '900' },

  // Bodhi message
  bodhiMsg: { borderWidth: 1, borderRadius: Radius.lg, padding: 14, backgroundColor: 'rgba(245,158,11,0.06)', marginTop: 4 },
  bodhiMsgTxt: { fontSize: Font.sizes.sm, fontWeight: '700', lineHeight: 21, fontStyle: 'italic' },

  // Options (questions)
  optionsList: { gap: 10, marginTop: 4 },
  optionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: Radius.lg,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)',
  },
  optionEmoji: { fontSize: 22 },
  optionLabel: { flex: 1, fontSize: Font.sizes.base, fontWeight: '600', color: Colors.text },
  optionCheck: { fontSize: 14, fontWeight: '900' },

  // Result
  resultOrb: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  resultOrbEmoji: { fontSize: 36, color: '#F59E0B' },
  resultTitle: { fontSize: 24, fontWeight: '900', color: Colors.text, marginBottom: 6, textAlign: 'center' },
  resultSub: { fontSize: Font.sizes.sm, color: Colors.textMuted, textAlign: 'center', marginBottom: 20 },
  insightCard: { width: '100%', borderWidth: 1, borderRadius: Radius.xl, padding: 16, marginBottom: 24, gap: 8 },
  insightLabel: { fontSize: Font.sizes.xs, fontWeight: '900', letterSpacing: 0.8 },
  insightText: { fontSize: Font.sizes.sm, color: Colors.text, lineHeight: 22, opacity: 0.9 },
  doneWrap: { width: '100%', borderRadius: Radius.full, overflow: 'hidden' },
  doneBtn: { paddingVertical: 17, alignItems: 'center' },
  doneTxt: { color: '#0A0A0F', fontSize: Font.sizes.base, fontWeight: '900', letterSpacing: 0.3 },
});
