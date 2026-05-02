import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Animated, Easing } from 'react-native';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Spacing, Radius, Font } from '@/constants/theme';

const PRACTICES = [
  { id: 'nadi', emoji: '🌬️', name: 'Nadi Shodhana', sanskrit: 'नाड़ी शोधन', color: '#60a5fa', timing: '4–8 AM', rounds: 12, desc: 'Alternate nostril breathing. Balances Ida & Pingala Nadi. Calms Vata, clarifies Pitta.', pattern: { inhale: 4, hold: 4, exhale: 4, hold2: 0 } },
  { id: 'kapala', emoji: '🔥', name: 'Kapalabhati', sanskrit: 'कपालभाति', color: '#fb923c', timing: '4–8 AM', rounds: 30, desc: 'Skull-shining breath. Clears Kapha, kindles Agni, and energises Prana.', pattern: { inhale: 1, hold: 0, exhale: 1, hold2: 0 } },
  { id: 'bhramari', emoji: '🐝', name: 'Bhramari', sanskrit: 'भ्रामरी', color: '#a78bfa', timing: 'Anytime', rounds: 7, desc: 'Humming bee breath. Instantly calms Vata — ideal before sleep or meditation.', pattern: { inhale: 4, hold: 0, exhale: 6, hold2: 0 } },
  { id: 'ujjayi', emoji: '🌊', name: 'Ujjayi', sanskrit: 'उज्जायी', color: '#34d399', timing: 'Anytime', rounds: 10, desc: 'Ocean breath. Generates inner heat, focuses the mind, soothes nerves.', pattern: { inhale: 4, hold: 4, exhale: 6, hold2: 2 } },
  { id: 'sheetali', emoji: '❄️', name: 'Sheetali', sanskrit: 'शीतली', color: '#38bdf8', timing: 'Midday', rounds: 8, desc: 'Cooling breath. Pacifies Pitta — ideal in summer or after heated activity.', pattern: { inhale: 4, hold: 4, exhale: 6, hold2: 0 } },
];

type Phase = 'idle' | 'inhale' | 'hold' | 'exhale' | 'hold2';

export default function PranayamaScreen() {
  const [selected, setSelected] = useState(PRACTICES[0]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [counter, setCounter] = useState(0);
  const [round, setRound] = useState(0);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearAll = () => { if (intervalRef.current) clearInterval(intervalRef.current); };

  useEffect(() => { return clearAll; }, []);

  const animatePhase = (p: Phase, dur: number) => {
    const toScale = p === 'inhale' ? 1.5 : p === 'exhale' ? 0.85 : 1.15;
    Animated.timing(scaleAnim, { toValue: toScale, duration: dur * 900, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }).start();
  };

  const start = () => {
    clearAll();
    setRound(0);
    runCycle(0);
  };

  const runCycle = (r: number) => {
    const { inhale, hold, exhale, hold2 } = selected.pattern;
    const phases: { name: Phase; dur: number }[] = [
      { name: 'inhale', dur: inhale },
      ...(hold ? [{ name: 'hold' as Phase, dur: hold }] : []),
      { name: 'exhale', dur: exhale },
      ...(hold2 ? [{ name: 'hold2' as Phase, dur: hold2 }] : []),
    ];
    let pi = 0;
    let timeLeft = phases[0].dur;
    setPhase(phases[0].name);
    setCounter(phases[0].dur);
    animatePhase(phases[0].name, phases[0].dur);

    intervalRef.current = setInterval(() => {
      timeLeft -= 1;
      setCounter(timeLeft);
      if (timeLeft <= 0) {
        pi += 1;
        if (pi >= phases.length) {
          const nextRound = r + 1;
          setRound(nextRound);
          if (nextRound >= selected.rounds) {
            clearAll();
            setPhase('idle');
            Animated.timing(scaleAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
            return;
          }
          pi = 0;
          runCycle(nextRound);
          return;
        }
        timeLeft = phases[pi].dur;
        setPhase(phases[pi].name);
        setCounter(phases[pi].dur);
        animatePhase(phases[pi].name, phases[pi].dur);
      }
    }, 1000);
  };

  const stop = () => { clearAll(); setPhase('idle'); setRound(0); Animated.timing(scaleAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start(); };

  const phaseColor = phase === 'inhale' ? '#60a5fa' : phase === 'exhale' ? '#34d399' : phase === 'idle' ? Colors.border : '#f59e0b';
  const phaseLabel = phase === 'inhale' ? 'Inhale' : phase === 'hold' || phase === 'hold2' ? 'Hold' : phase === 'exhale' ? 'Exhale' : 'Press Start';

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ScreenHeader title="Pranayama" subtitle="Breath · Prana · Vitality" showBack accent="#60a5fa" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Breath Circle */}
        <View style={styles.circleWrap}>
          <Animated.View style={[styles.outerRing, { borderColor: phaseColor + '40', transform: [{ scale: scaleAnim }] }]}>
            <View style={[styles.innerCircle, { borderColor: phaseColor + '80', backgroundColor: phaseColor + '12' }]}>
              <Text style={[styles.phaseLabel, { color: phaseColor }]}>{phaseLabel}</Text>
              {phase !== 'idle' && <Text style={styles.counter}>{counter}</Text>}
              {phase !== 'idle' && <Text style={styles.roundText}>Round {round + 1} / {selected.rounds}</Text>}
              {phase === 'idle' && <Text style={styles.practiceEmoji}>{selected.emoji}</Text>}
            </View>
          </Animated.View>
          <View style={styles.btnRow}>
            {phase === 'idle'
              ? <TouchableOpacity onPress={start} style={[styles.ctaBtn, { backgroundColor: selected.color }]}>
                  <Text style={styles.ctaBtnText}>Begin Practice ✦</Text>
                </TouchableOpacity>
              : <TouchableOpacity onPress={stop} style={[styles.ctaBtn, { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border }]}>
                  <Text style={[styles.ctaBtnText, { color: Colors.textSub }]}>Stop</Text>
                </TouchableOpacity>
            }
          </View>
        </View>

        {/* Practice Selector */}
        <Text style={styles.sectionTitle}>Select Practice</Text>
        {PRACTICES.map(p => (
          <TouchableOpacity key={p.id} onPress={() => { stop(); setSelected(p); }} activeOpacity={0.75}
            style={[styles.card, selected.id === p.id && { borderColor: p.color + '60', backgroundColor: p.color + '0c' }]}>
            <View style={[styles.iconBox, { backgroundColor: p.color + '18' }]}>
              <Text style={styles.pEmoji}>{p.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.pName, selected.id === p.id && { color: p.color }]}>{p.name}</Text>
              <Text style={styles.pSanskrit}>{p.sanskrit} · {p.timing}</Text>
              <Text style={styles.pDesc} numberOfLines={2}>{p.desc}</Text>
            </View>
          </TouchableOpacity>
        ))}
        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: Spacing.md },
  circleWrap: { alignItems: 'center', paddingVertical: Spacing.xl },
  outerRing: { width: 200, height: 200, borderRadius: 100, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  innerCircle: { width: 156, height: 156, borderRadius: 78, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  phaseLabel: { fontSize: Font.sizes.md, fontWeight: '900', letterSpacing: 1 },
  counter: { fontSize: Font.sizes.hero, fontWeight: '900', color: Colors.text, marginTop: 2 },
  roundText: { fontSize: Font.sizes.xs, color: Colors.textMuted, marginTop: 4 },
  practiceEmoji: { fontSize: 44 },
  btnRow: { marginTop: Spacing.lg },
  ctaBtn: { borderRadius: Radius.full, paddingVertical: 14, paddingHorizontal: 36, alignItems: 'center' },
  ctaBtnText: { color: '#0A0A0F', fontSize: Font.sizes.base, fontWeight: '800' },
  sectionTitle: { fontSize: Font.sizes.base, fontWeight: '800', color: Colors.text, marginBottom: Spacing.sm },
  card: { flexDirection: 'row', gap: 12, backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm + 2, marginBottom: 10 },
  iconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pEmoji: { fontSize: 22 },
  pName: { fontSize: Font.sizes.base, fontWeight: '800', color: Colors.text },
  pSanskrit: { fontSize: Font.sizes.xs, color: Colors.textMuted, marginTop: 1 },
  pDesc: { fontSize: Font.sizes.xs, color: Colors.textMuted, marginTop: 3, lineHeight: 16 },
});
