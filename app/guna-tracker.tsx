import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Spacing, Radius, Font } from '@/constants/theme';

const GUNAS = [
  { id: 'sattva', name: 'Sattva', emoji: '🌟', color: '#fbbf24', desc: 'Purity · Clarity · Harmony', qualities: ['Peaceful mind', 'Clear thinking', 'Compassion', 'Lightness', 'Truth-seeking'] },
  { id: 'rajas',  name: 'Rajas',  emoji: '🔥', color: '#fb923c', desc: 'Activity · Passion · Motion', qualities: ['Restless energy', 'Desire & craving', 'Ambition', 'Agitation', 'Attachment'] },
  { id: 'tamas',  name: 'Tamas',  emoji: '🌑', color: '#6366f1', desc: 'Inertia · Heaviness · Dullness', qualities: ['Lethargy', 'Confusion', 'Resistance', 'Heaviness', 'Sleep excess'] },
];

const QUESTIONS = [
  { q: 'My mind felt...', opts: [{ t: 'Clear & peaceful', g: 'sattva' }, { t: 'Restless & busy', g: 'rajas' }, { t: 'Foggy & heavy', g: 'tamas' }] },
  { q: 'My food today was...', opts: [{ t: 'Fresh & light', g: 'sattva' }, { t: 'Spicy & stimulating', g: 'rajas' }, { t: 'Heavy & processed', g: 'tamas' }] },
  { q: 'My energy was...', opts: [{ t: 'Steady & calm', g: 'sattva' }, { t: 'Driven but scattered', g: 'rajas' }, { t: 'Low & sluggish', g: 'tamas' }] },
  { q: 'My actions came from...', opts: [{ t: 'Service & love', g: 'sattva' }, { t: 'Desire & ambition', g: 'rajas' }, { t: 'Habit & inertia', g: 'tamas' }] },
  { q: 'My sleep last night was...', opts: [{ t: 'Restful & enough', g: 'sattva' }, { t: 'Disturbed & light', g: 'rajas' }, { t: 'Heavy & excessive', g: 'tamas' }] },
];

export default function GunaTrackerScreen() {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<Record<string, number> | null>(null);

  const pick = (qi: number, guna: string) => setAnswers(prev => ({ ...prev, [qi]: guna }));

  const calculate = async () => {
    if (Object.keys(answers).length < QUESTIONS.length) {
      Alert.alert('Incomplete', 'Please answer all questions.'); return;
    }
    const scores: Record<string, number> = { sattva: 0, rajas: 0, tamas: 0 };
    Object.values(answers).forEach(g => { scores[g] = (scores[g] ?? 0) + 1; });
    setResult(scores);
    const uid = auth.currentUser?.uid;
    if (uid) {
      await addDoc(collection(db, 'guna_logs'), { userId: uid, scores, date: new Date().toISOString().split('T')[0], loggedAt: serverTimestamp() });
    }
  };

  const reset = () => { setAnswers({}); setResult(null); };
  const dominant = result ? Object.entries(result).sort((a, b) => b[1] - a[1])[0][0] : null;
  const dominantGuna = GUNAS.find(g => g.id === dominant);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ScreenHeader title="Guna Tracker" subtitle="Sattva · Rajas · Tamas" showBack accent="#fbbf24" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Guna info cards */}
        <View style={styles.gunaRow}>
          {GUNAS.map(g => (
            <View key={g.id} style={[styles.gunaChip, { borderColor: g.color + '40', backgroundColor: g.color + '0f' }]}>
              <Text style={styles.gunaEmoji}>{g.emoji}</Text>
              <Text style={[styles.gunaName, { color: g.color }]}>{g.name}</Text>
              <Text style={styles.gunaDesc}>{g.desc.split(' · ')[0]}</Text>
            </View>
          ))}
        </View>

        {!result ? (
          <>
            {QUESTIONS.map((q, qi) => (
              <View key={qi} style={styles.qCard}>
                <Text style={styles.qText}>{qi + 1}. {q.q}</Text>
                {q.opts.map(opt => {
                  const g = GUNAS.find(g => g.id === opt.g)!;
                  const picked = answers[qi] === opt.g;
                  return (
                    <TouchableOpacity key={opt.t} onPress={() => pick(qi, opt.g)} activeOpacity={0.75}
                      style={[styles.opt, picked && { borderColor: g.color + '60', backgroundColor: g.color + '14' }]}>
                      <Text style={styles.optEmoji}>{g.emoji}</Text>
                      <Text style={[styles.optText, picked && { color: g.color }]}>{opt.t}</Text>
                      {picked && <View style={[styles.optDot, { backgroundColor: g.color }]} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
            <TouchableOpacity onPress={calculate} style={[styles.btn, Object.keys(answers).length < QUESTIONS.length && { opacity: 0.4 }]} activeOpacity={0.8}>
              <Text style={styles.btnText}>Reveal My Guna State ✦</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.resultWrap}>
            <Text style={styles.resultTitle}>Today's Guna Balance</Text>
            {GUNAS.map(g => {
              const score = result[g.id] ?? 0;
              const pct = Math.round((score / QUESTIONS.length) * 100);
              return (
                <View key={g.id} style={styles.barRow}>
                  <Text style={styles.barLabel}>{g.emoji} {g.name}</Text>
                  <View style={styles.barBg}>
                    <View style={[styles.barFill, { width: `${pct}%` as unknown as number, backgroundColor: g.color }]} />
                  </View>
                  <Text style={[styles.barPct, { color: g.color }]}>{pct}%</Text>
                </View>
              );
            })}
            {dominantGuna && (
              <View style={[styles.insightCard, { borderColor: dominantGuna.color + '40', backgroundColor: dominantGuna.color + '0c' }]}>
                <Text style={[styles.insightTitle, { color: dominantGuna.color }]}>{dominantGuna.emoji} {dominantGuna.name} Dominant</Text>
                <Text style={styles.insightText}>{dominantGuna.qualities.join(' · ')}</Text>
                <Text style={styles.insightNote}>
                  {dominant === 'sattva' ? 'Excellent! Keep nurturing clarity through pure food, meditation, and truthful living.'
                    : dominant === 'rajas' ? 'Channel this energy wisely — add more stillness, early meals, and calming Pranayama.'
                    : 'Gently stimulate Agni — early rising, light meals, Kapalabhati, and morning sunlight help.'}
                </Text>
              </View>
            )}
            <TouchableOpacity onPress={reset} style={styles.resetBtn}>
              <Text style={styles.resetText}>Track Again Tomorrow</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: Spacing.md },
  gunaRow: { flexDirection: 'row', gap: 8, marginBottom: Spacing.lg },
  gunaChip: { flex: 1, borderRadius: Radius.md, borderWidth: 1, padding: 10, alignItems: 'center' },
  gunaEmoji: { fontSize: 22, marginBottom: 3 },
  gunaName: { fontSize: Font.sizes.sm, fontWeight: '800' },
  gunaDesc: { fontSize: 10, color: Colors.textMuted, marginTop: 1, textAlign: 'center' },
  qCard: { backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, marginBottom: 12 },
  qText: { fontSize: Font.sizes.base, fontWeight: '700', color: Colors.text, marginBottom: 10 },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, marginBottom: 6 },
  optEmoji: { fontSize: 16 },
  optText: { flex: 1, fontSize: Font.sizes.sm, color: Colors.textSub, fontWeight: '500' },
  optDot: { width: 8, height: 8, borderRadius: 4 },
  btn: { backgroundColor: Colors.gold, borderRadius: Radius.full, paddingVertical: 15, alignItems: 'center', marginBottom: 12 },
  btnText: { color: '#0A0A0F', fontSize: Font.sizes.base, fontWeight: '800' },
  resultWrap: { gap: 12 },
  resultTitle: { fontSize: Font.sizes.lg, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barLabel: { width: 90, fontSize: Font.sizes.sm, color: Colors.textSub, fontWeight: '600' },
  barBg: { flex: 1, height: 10, backgroundColor: Colors.card, borderRadius: 5, overflow: 'hidden' },
  barFill: { height: 10, borderRadius: 5 },
  barPct: { width: 36, fontSize: Font.sizes.sm, fontWeight: '700', textAlign: 'right' },
  insightCard: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md, marginTop: 4 },
  insightTitle: { fontSize: Font.sizes.md, fontWeight: '900', marginBottom: 6 },
  insightText: { fontSize: Font.sizes.xs, color: Colors.textMuted, lineHeight: 18 },
  insightNote: { fontSize: Font.sizes.sm, color: Colors.textSub, marginTop: 8, lineHeight: 20 },
  resetBtn: { alignItems: 'center', paddingVertical: 12 },
  resetText: { color: Colors.textMuted, fontSize: Font.sizes.sm },
});
