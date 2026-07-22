import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Animated, Easing, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';
import { doc, updateDoc } from 'firebase/firestore';
import * as Haptics from 'expo-haptics';
import { auth, db } from '@/lib/firebase';
import { store, KEYS } from '@/lib/storage';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Spacing, Radius, Font } from '@/constants/theme';

// multi: true → checkbox style, select all that apply
// multi: false → radio style, only one answer
const QUESTIONS = [
  { q: 'My body frame is best described as...', multi: false, opts: [{ t: 'Thin and light — hard to gain weight', d: 'V' }, { t: 'Medium and muscular — easy to maintain weight', d: 'P' }, { t: 'Large or heavy — easy to gain weight', d: 'K' }] },
  { q: 'My skin tends to be... (select all that apply)', multi: true, opts: [{ t: 'Dry, rough, or flaky in patches', d: 'V' }, { t: 'Oily, warm or prone to rashes & inflammation', d: 'P' }, { t: 'Smooth, moist and cool to touch', d: 'K' }] },
  { q: 'My hair is often... (select all that apply)', multi: true, opts: [{ t: 'Dry, brittle or frizzy', d: 'V' }, { t: 'Fine, oily or prone to early greying', d: 'P' }, { t: 'Thick, lustrous, wavy or heavy', d: 'K' }] },
  { q: 'My digestion... (select all that apply)', multi: true, opts: [{ t: 'Is irregular — gas, bloating, variable appetite', d: 'V' }, { t: 'Is strong — I get irritable when I miss meals', d: 'P' }, { t: 'Is slow but steady — I can easily skip meals', d: 'K' }] },
  { q: 'My typical sleep pattern is...', multi: false, opts: [{ t: 'Light and interrupted — hard to fall or stay asleep', d: 'V' }, { t: 'Moderate — fall asleep okay but sometimes restless', d: 'P' }, { t: 'Deep and long — very hard to wake up', d: 'K' }] },
  { q: 'Under stress, I tend to... (select all that apply)', multi: true, opts: [{ t: 'Worry, feel anxious or overwhelmed', d: 'V' }, { t: 'Get angry, critical or impatient', d: 'P' }, { t: 'Withdraw, shut down or become stubborn', d: 'K' }] },
  { q: 'My thinking style is... (select all that apply)', multi: true, opts: [{ t: 'Fast, creative — many ideas, hard to focus on one', d: 'V' }, { t: 'Sharp, analytical — love precision and details', d: 'P' }, { t: 'Steady and slow — excellent long-term memory', d: 'K' }] },
  { q: 'My natural activity level is...', multi: false, opts: [{ t: 'Highly active — restless, always on the move', d: 'V' }, { t: 'Purposeful and moderate — action when needed', d: 'P' }, { t: 'Calm and slow — I prefer rest over hustle', d: 'K' }] },
  { q: 'My appetite follows a pattern of...', multi: false, opts: [{ t: 'Variable — sometimes ravenous, sometimes not hungry', d: 'V' }, { t: 'Strong and consistent — sharp, must-eat hunger', d: 'P' }, { t: 'Modest and flexible — can easily delay meals', d: 'K' }] },
  { q: 'My joints are typically...', multi: false, opts: [{ t: 'Cracking, dry, or changing in comfort', d: 'V' }, { t: 'Loose, flexible, sometimes warm or inflamed', d: 'P' }, { t: 'Large, well-formed and well-lubricated', d: 'K' }] },
];

const ANALYSIS_STEPS = [
  { icon: '🌬️', text: 'Mapping Vata constitution markers...' },
  { icon: '🔥', text: 'Measuring your digestive fire (Agni)...' },
  { icon: '🌿', text: 'Reading Kapha earth & endurance traits...' },
  { icon: '📜', text: 'Consulting Charaka Samhita (300 BCE)...' },
  { icon: '⚖️', text: 'Cross-referencing Tridosha balance...' },
  { icon: '🧬', text: 'Computing your unique Prakriti...' },
];

function AnalyzingScreen({ onComplete }: { onComplete: () => void }) {
  const spinAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const [stepIdx, setStepIdx] = useState(-1);

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 5000, easing: Easing.linear, useNativeDriver: true }),
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.14, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.92, duration: 900, useNativeDriver: true }),
      ]),
    ).start();
    Animated.timing(progressAnim, { toValue: 1, duration: 4200, useNativeDriver: false }).start();

    const timers: ReturnType<typeof setTimeout>[] = [];
    ANALYSIS_STEPS.forEach((_, i) => {
      timers.push(setTimeout(() => {
        setStepIdx(i);
        Haptics.impactAsync(i === ANALYSIS_STEPS.length - 1
          ? Haptics.ImpactFeedbackStyle.Heavy
          : Haptics.ImpactFeedbackStyle.Light);
      }, 200 + i * 650));
    });
    timers.push(setTimeout(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onComplete();
    }, 4400));
    return () => timers.forEach(clearTimeout);
  }, []);

  const spinCW = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const spinCCW = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });
  const barWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={as.wrap}>
      {/* Tridosha mandala */}
      <View style={as.mandalaWrap}>
        <Animated.View style={[as.ring1, { transform: [{ rotate: spinCW }] }]} />
        <Animated.View style={[as.ring2, { transform: [{ rotate: spinCCW }] }]} />
        <Animated.View style={[as.ring3, { transform: [{ rotate: spinCW }] }]} />
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <Text style={as.mandalaCenter}>🪷</Text>
        </Animated.View>
      </View>

      <Text style={as.labelTop}>AYURVEDIC ANALYSIS</Text>
      <Text style={as.headline}>Reading your constitution...</Text>

      {/* Progress bar */}
      <View style={as.barTrack}>
        <Animated.View style={[as.barFill, { width: barWidth }]} />
      </View>

      {/* Sequential steps */}
      <View style={as.stepsWrap}>
        {ANALYSIS_STEPS.map((step, i) => {
          const done = i < stepIdx;
          const active = i === stepIdx;
          return (
            <View key={i} style={[as.stepRow, { opacity: i <= stepIdx ? 1 : 0.18 }]}>
              <Text style={as.stepIcon}>{done ? '✓' : step.icon}</Text>
              <Text style={[as.stepText, active && as.stepTextActive, done && as.stepTextDone]}>{step.text}</Text>
            </View>
          );
        })}
      </View>

      <Text style={as.footer}>Tridosha Intelligence · Charaka Samhita · © Nada</Text>
    </View>
  );
}
const as = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 40 },
  mandalaWrap: { width: 180, height: 180, alignItems: 'center', justifyContent: 'center', marginBottom: 36 },
  ring1: { position: 'absolute', width: 176, height: 176, borderRadius: 88, borderWidth: 1, borderColor: '#a78bfa40' },
  ring2: { position: 'absolute', width: 138, height: 138, borderRadius: 69, borderWidth: 1.5, borderColor: '#f9731650', borderStyle: 'dashed' },
  ring3: { position: 'absolute', width: 100, height: 100, borderRadius: 50, borderWidth: 2, borderColor: '#10b98155' },
  mandalaCenter: { fontSize: 42 },
  labelTop: { fontSize: 10, fontWeight: '900', color: '#FFFFFF45', letterSpacing: 2.5, marginBottom: 8 },
  headline: { fontSize: 20, fontWeight: '900', color: Colors.text, textAlign: 'center', marginBottom: 28 },
  barTrack: { width: '100%', height: 3, backgroundColor: '#FFFFFF12', borderRadius: 2, marginBottom: 32, overflow: 'hidden' },
  barFill: { height: 3, backgroundColor: Colors.gold, borderRadius: 2 },
  stepsWrap: { width: '100%', gap: 11 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepIcon: { fontSize: 14, width: 20, textAlign: 'center' },
  stepText: { flex: 1, fontSize: 12, color: '#FFFFFF35', fontWeight: '500' },
  stepTextActive: { color: Colors.text, fontWeight: '700' },
  stepTextDone: { color: '#FFFFFF45' },
  footer: { fontSize: 9, color: '#FFFFFF18', marginTop: 36, textAlign: 'center', letterSpacing: 0.5, fontStyle: 'italic' },
});

export const DOSHA_TRAITS: Record<string, {
  emoji: string; element: string; color: string; archetype: string;
  positive: string[]; shadow: string[]; balance: string;
}> = {
  Vata: {
    emoji: '🌬️', element: 'Air & Space', color: '#a78bfa', archetype: 'The Creative Mover',
    positive: [
      'Highly creative, imaginative & artistic',
      'Quick learner who adapts to change fast',
      'Enthusiastic, lively & expressive spirit',
      'Intuitive, spiritually sensitive & visionary',
      'Multi-talented with a love for exploration',
    ],
    shadow: [
      'Anxiety & worry spiral under pressure',
      'Scattered focus — many starts, few finishes',
      'Irregular sleep & inconsistent daily routines',
    ],
    balance: 'Warm meals, sesame oil self-massage, fixed sleep schedule, grounding yoga & pranayama',
  },
  Pitta: {
    emoji: '🔥', element: 'Fire & Water', color: '#f97316', archetype: 'The Passionate Leader',
    positive: [
      'Sharp intellect with laser-like focus',
      'Natural leader — ambitious & goal-driven',
      'Strong digestion & high metabolic energy',
      'Courageous, disciplined & decisive',
      'Clear communicator who gets things done',
    ],
    shadow: [
      'Anger & impatience flares when blocked',
      'Overcritical of self and others — perfectionism',
      'Burnout from pushing too hard, too long',
    ],
    balance: 'Cooling foods (coconut, coriander), moonlight walks, non-competitive activity & laughter',
  },
  Kapha: {
    emoji: '🌿', element: 'Earth & Water', color: '#10b981', archetype: 'The Steadfast Nurturer',
    positive: [
      'Deeply loyal, compassionate & trustworthy',
      'Emotionally stable, calm & patient under pressure',
      'Excellent long-term memory & retention',
      'Natural physical endurance & strength',
      'Forgiving, consistent & a pillar for others',
    ],
    shadow: [
      'Lethargy & oversleeping — needs external spark',
      'Attachment & resistance to necessary change',
      'Sluggish metabolism & tendency toward heaviness',
    ],
    balance: 'Vigorous morning movement, warming spices (ginger, pepper), socializing & varied routines',
  },
};

type Scores = { V: number; P: number; K: number };

// answers is now Record<number, string[]> to support multi-select
function computePrakriti(answers: Record<number, string[]>): { prakriti: string; scores: Scores } {
  const scores: Scores = { V: 0, P: 0, K: 0 };
  Object.values(answers).flat().forEach(d => { (scores as any)[d] = ((scores as any)[d] ?? 0) + 1; });
  const total = scores.V + scores.P + scores.K; // actual answer count (may exceed 10 due to multi)
  const sorted = (Object.entries(scores) as [keyof Scores, number][]).sort((a, b) => b[1] - a[1]);
  const [first, second, third] = sorted;
  const names: Record<string, string> = { V: 'Vata', P: 'Pitta', K: 'Kapha' };

  const fp = first[1] / total;
  const tp = third[1] / total;

  if (fp - tp <= 0.18 && third[1] >= 2) return { prakriti: 'Sama (Tridoshic)', scores };
  if (fp >= 0.62) return { prakriti: names[first[0]], scores };
  if ((second[1] - third[1]) / total <= 0.12 && third[1] >= 2)
    return { prakriti: `${names[first[0]]}-${names[second[0]]}-${names[third[0]]}`, scores };
  return { prakriti: `${names[first[0]]}-${names[second[0]]}`, scores };
}

type Phase = 'quiz' | 'analyzing' | 'result';

export default function PrakritiQuizScreen() {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<number, string[]>>({});
  const [phase, setPhase] = useState<Phase>('quiz');
  const [result, setResult] = useState<{ prakriti: string; scores: Scores } | null>(null);
  const [saving, setSaving] = useState(false);

  const pick = (qi: number, dosha: string, multi: boolean) => {
    setAnswers(prev => {
      const cur = prev[qi] ?? [];
      if (multi) {
        return { ...prev, [qi]: cur.includes(dosha) ? cur.filter(d => d !== dosha) : [...cur, dosha] };
      }
      return { ...prev, [qi]: [dosha] };
    });
  };

  const isComplete = QUESTIONS.every((_, qi) => (answers[qi] ?? []).length > 0);
  const answeredCount = QUESTIONS.filter((_, qi) => (answers[qi] ?? []).length > 0).length;

  const submit = () => {
    if (!isComplete) {
      Alert.alert('Almost there', `Please answer all ${QUESTIONS.length} questions — ${QUESTIONS.length - answeredCount} remaining.`); return;
    }
    setResult(computePrakriti(answers));
    setPhase('analyzing');
  };

  const save = async () => {
    if (!result) return;
    setSaving(true);
    try {
      const uid = auth.currentUser?.uid;
      if (uid) await updateDoc(doc(db, 'users', uid), { prakriti: result.prakriti, prakritiScores: result.scores });
      await store.setJSON(KEYS.dosha, { prakritiAssessment: { prakriti: { primary: result.prakriti }, scores: result.scores } });
      Alert.alert('Saved ✦', `Your Prakriti (${result.prakriti}) has been saved.`, [{ text: 'Continue', onPress: () => router.back() }]);
    } finally { setSaving(false); }
  };

  const presentDoshas = result
    ? (['Vata', 'Pitta', 'Kapha'] as const).filter(d => result.prakriti.includes(d))
    : [];
  const primaryColor = result ? (DOSHA_TRAITS[presentDoshas[0]]?.color ?? Colors.gold) : Colors.gold;

  // ── Analysis screen — full screen, no header/scroll ────────────────────────
  if (phase === 'analyzing') {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.bg }}>
        <AnalyzingScreen onComplete={() => setPhase('result')} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ImageBackground source={require('../assets/images/new_bg.jpeg')} style={StyleSheet.absoluteFillObject} imageStyle={{ opacity: 0.14, resizeMode: 'contain' }} />
      <ScreenHeader title="Prakriti Assessment" subtitle="10 questions · Discover your real constitution" showBack accent={Colors.gold} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {phase === 'quiz' ? (
          <>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${(answeredCount / QUESTIONS.length) * 100}%` }]} />
            </View>
            <Text style={styles.progressText}>{answeredCount} / {QUESTIONS.length} answered</Text>

            {QUESTIONS.map((q, qi) => {
              const DC: Record<string, string> = { V: '#a78bfa', P: '#fb923c', K: '#34d399' };
              const sel = answers[qi] ?? [];
              return (
                <View key={qi} style={styles.qBlock}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={styles.qNum}>Q{qi + 1} of {QUESTIONS.length}</Text>
                    {q.multi
                      ? <View style={styles.multiBadge}><Text style={styles.multiBadgeTxt}>Multi-select</Text></View>
                      : <View style={styles.singleBadge}><Text style={styles.singleBadgeTxt}>Single answer</Text></View>}
                  </View>
                  <Text style={styles.qText}>{q.q}</Text>
                  {q.opts.map(opt => {
                    const picked = sel.includes(opt.d);
                    const c = DC[opt.d];
                    return (
                      <TouchableOpacity key={opt.t}
                        onPress={() => { pick(qi, opt.d, q.multi); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                        activeOpacity={0.75}
                        style={[styles.opt, picked && { borderColor: c + '60', backgroundColor: c + '12' }]}>
                        {q.multi ? (
                          <View style={[styles.optCheckbox, picked && { backgroundColor: c, borderColor: c }]}>
                            {picked && <Text style={{ color: Colors.bg, fontSize: 10, fontWeight: '900', lineHeight: 14 }}>✓</Text>}
                          </View>
                        ) : (
                          <View style={[styles.optRadio, picked && { backgroundColor: c, borderColor: c }]}>
                            {picked && <View style={styles.optDot} />}
                          </View>
                        )}
                        <Text style={[styles.optText, picked && { color: c, fontWeight: '600' }]}>{opt.t}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })}

            <TouchableOpacity onPress={submit} activeOpacity={0.8}
              style={[styles.submitBtn, !isComplete && { opacity: 0.4 }]}>
              <Text style={styles.submitText}>Analyse My Prakriti ✦</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.resultWrap}>

            {/* ── Hero result badge ── */}
            <View style={[styles.heroBadge, { borderColor: primaryColor + '45', backgroundColor: primaryColor + '0e' }]}>
              <Text style={styles.heroEmoji}>🧬</Text>
              <Text style={[styles.heroLabel, { color: primaryColor + '90' }]}>YOUR PRAKRITI CONSTITUTION</Text>
              <Text style={[styles.heroDosha, { color: primaryColor }]}>{result!.prakriti}</Text>
              {result!.prakriti === 'Sama (Tridoshic)' && (
                <Text style={styles.heroSub}>All three doshas in balance — the rarest and most harmonious constitution in Ayurveda.</Text>
              )}
            </View>

            {/* ── Actual dosha score bars ── */}
            <View style={styles.scoresCard}>
              <Text style={styles.scoresTitle}>YOUR DOSHA MIX · FROM YOUR ANSWERS</Text>
              {(['Vata', 'Pitta', 'Kapha'] as const).map(d => {
                const key = d[0] as keyof Scores;
                const score = result!.scores[key];
                const scoreTotal = result!.scores.V + result!.scores.P + result!.scores.K;
                const pct = Math.round((score / scoreTotal) * 100);
                const tr = DOSHA_TRAITS[d];
                return (
                  <View key={d} style={{ marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: tr.color }}>{tr.emoji}  {d}</Text>
                      <Text style={{ fontSize: 13, fontWeight: '900', color: tr.color }}>{pct}%</Text>
                    </View>
                    <View style={{ height: 7, backgroundColor: Colors.border, borderRadius: 4, overflow: 'hidden' }}>
                      <View style={{ height: 7, width: `${pct}%` as any, backgroundColor: tr.color, borderRadius: 4 }} />
                    </View>
                  </View>
                );
              })}
              <Text style={styles.scoresNote}>In Ayurveda, everyone carries all three doshas. Your prakriti reflects which are most expressed in you.</Text>
            </View>

            {/* ── Per-dosha trait cards ── */}
            {presentDoshas.map((d, idx) => {
              const tr = DOSHA_TRAITS[d];
              const key = d[0] as keyof Scores;
              const score = result!.scores[key];
              const st = result!.scores.V + result!.scores.P + result!.scores.K;
              const pct = Math.round((score / st) * 100);
              return (
                <View key={d} style={[styles.traitCard, { borderColor: tr.color + '30' }]}>
                  <View style={[styles.traitHeader, { backgroundColor: tr.color + '12' }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.traitTitle, { color: tr.color }]}>{tr.emoji}  {d} · {pct}%</Text>
                      <Text style={styles.traitSubtitle}>{tr.element} · {tr.archetype}</Text>
                    </View>
                    {idx === 0 && (
                      <View style={[styles.primaryPill, { backgroundColor: tr.color + '20', borderColor: tr.color + '55' }]}>
                        <Text style={[styles.primaryPillTxt, { color: tr.color }]}>PRIMARY</Text>
                      </View>
                    )}
                    {idx === 1 && (
                      <View style={[styles.primaryPill, { backgroundColor: Colors.card, borderColor: Colors.border }]}>
                        <Text style={[styles.primaryPillTxt, { color: Colors.textMuted }]}>SECONDARY</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.traitBody}>
                    <Text style={[styles.traitSection, { color: tr.color }]}>✨  YOUR GIFTS</Text>
                    {tr.positive.map((p, i) => (
                      <View key={i} style={styles.traitRow}>
                        <View style={[styles.traitDot, { backgroundColor: tr.color }]} />
                        <Text style={styles.traitText}>{p}</Text>
                      </View>
                    ))}
                    <Text style={[styles.traitSection, { marginTop: 14, color: 'rgba(255,255,255,0.45)' }]}>⚠️  CAUTION & SHADOWS</Text>
                    {tr.shadow.map((s, i) => (
                      <View key={i} style={styles.traitRow}>
                        <View style={[styles.traitDot, { backgroundColor: 'rgba(255,255,255,0.25)' }]} />
                        <Text style={[styles.traitText, { color: Colors.textMuted }]}>{s}</Text>
                      </View>
                    ))}
                    <View style={[styles.balanceStrip, { backgroundColor: tr.color + '0e', borderColor: tr.color + '28' }]}>
                      <Text style={[styles.balanceTxt, { color: tr.color + 'cc' }]}>🌿  Balanced by: {tr.balance}</Text>
                    </View>
                  </View>
                </View>
              );
            })}

            <TouchableOpacity onPress={save} disabled={saving} activeOpacity={0.8}
              style={[styles.saveBtn, { backgroundColor: primaryColor }]}>
              <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save to My Profile ✦'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setResult(null); setAnswers({}); setPhase('quiz'); }} style={styles.retakeLink}>
              <Text style={styles.retakeTxt}>Retake Quiz</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 },
  progressBar: { height: 3, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, marginBottom: 6, overflow: 'hidden' },
  progressFill: { height: 3, backgroundColor: Colors.gold, borderRadius: 2 },
  progressText: { fontSize: Font.sizes.xs, color: 'rgba(255,255,255,0.35)', marginBottom: Spacing.md, textAlign: 'right' },
  qBlock: { paddingVertical: 18, paddingHorizontal: 0, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  qNum: { fontSize: Font.sizes.xs, fontWeight: '800', color: Colors.gold, letterSpacing: 1, marginBottom: 4 },
  qText: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 12, lineHeight: 22 },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 50, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', marginBottom: 8, backgroundColor: 'rgba(255,255,255,0.06)' },
  optRadio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  optCheckbox: { width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  optDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.bg },
  optText: { flex: 1, fontSize: Font.sizes.sm, color: 'rgba(255,255,255,0.85)', lineHeight: 18 },
  multiBadge: { backgroundColor: '#a78bfa18', borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#a78bfa40' },
  multiBadgeTxt: { fontSize: 9, fontWeight: '800', color: '#a78bfa', letterSpacing: 0.5 },
  singleBadge: { backgroundColor: '#FFFFFF08', borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: Colors.border },
  singleBadgeTxt: { fontSize: 9, fontWeight: '700', color: Colors.textDim, letterSpacing: 0.5 },
  submitBtn: { backgroundColor: Colors.gold, borderRadius: Radius.full, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  submitText: { color: '#0A0A0F', fontSize: Font.sizes.base, fontWeight: '900' },
  // Result
  resultWrap: { gap: 14 },
  heroBadge: { borderRadius: Radius.xl, borderWidth: 1.5, padding: Spacing.xl, alignItems: 'center', gap: 6 },
  heroEmoji: { fontSize: 44, marginBottom: 4 },
  heroLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  heroDosha: { fontSize: 30, fontWeight: '900', letterSpacing: -0.5, textAlign: 'center' },
  heroSub: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', lineHeight: 18, marginTop: 4, fontStyle: 'italic' },
  scoresCard: { backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: 4 },
  scoresTitle: { fontSize: 9, fontWeight: '900', color: Colors.textDim, letterSpacing: 1.4, marginBottom: 10 },
  scoresNote: { fontSize: 10, color: Colors.textDim, lineHeight: 15, fontStyle: 'italic', marginTop: 6 },
  traitCard: { borderRadius: Radius.xl, borderWidth: 1, overflow: 'hidden' },
  traitHeader: { paddingHorizontal: Spacing.md, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' },
  traitTitle: { fontSize: 16, fontWeight: '900' },
  traitSubtitle: { fontSize: 10, color: Colors.textMuted, marginTop: 3, fontWeight: '600' },
  primaryPill: { borderWidth: 1, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  primaryPillTxt: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  traitBody: { padding: Spacing.md, gap: 4 },
  traitSection: { fontSize: 9, fontWeight: '900', letterSpacing: 1.4, marginBottom: 6 },
  traitRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 5 },
  traitDot: { width: 5, height: 5, borderRadius: 3, marginTop: 7, flexShrink: 0 },
  traitText: { flex: 1, fontSize: 13, color: Colors.text, lineHeight: 20 },
  balanceStrip: { marginTop: 12, borderRadius: Radius.md, borderWidth: 1, padding: 10 },
  balanceTxt: { fontSize: 11, lineHeight: 17 },
  saveBtn: { borderRadius: Radius.full, paddingVertical: 16, alignItems: 'center' },
  saveBtnText: { color: '#0A0A0F', fontSize: Font.sizes.base, fontWeight: '900' },
  retakeLink: { alignItems: 'center', paddingVertical: 10 },
  retakeTxt: { color: Colors.textMuted, fontSize: Font.sizes.sm },
});
