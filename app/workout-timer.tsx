import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar,
  Dimensions, Alert, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { auth } from '@/lib/firebase';
import { saveHabitLog, formatDuration, todayStr } from '@/lib/habitLogs';
import type { WorkoutType, Intensity } from '@/lib/habitLogs';
import { Colors, Spacing, Radius, Font } from '@/constants/theme';

const { width } = Dimensions.get('window');
const CIRCLE = width * 0.62;

type Phase = 'select' | 'running' | 'paused' | 'done';

const WORKOUT_TYPES: { key: WorkoutType; emoji: string; label: string; color: string }[] = [
  { key: 'cardio',     emoji: '🏃', label: 'Cardio',     color: '#ef4444' },
  { key: 'strength',   emoji: '🏋️', label: 'Strength',  color: '#fb923c' },
  { key: 'yoga',       emoji: '🧘', label: 'Yoga',       color: '#c084fc' },
  { key: 'stretching', emoji: '🤸', label: 'Stretching', color: '#34d399' },
  { key: 'other',      emoji: '💪', label: 'Other',      color: '#60a5fa' },
];

const INTENSITIES: { key: Intensity; emoji: string; label: string; color: string }[] = [
  { key: 'light',    emoji: '😌', label: 'Light',    color: '#34d399' },
  { key: 'moderate', emoji: '💪', label: 'Moderate', color: '#fb923c' },
  { key: 'intense',  emoji: '🔥', label: 'Intense',  color: '#ef4444' },
];

export default function WorkoutTimer() {
  const router = useRouter();
  const [phase, setPhase]           = useState<Phase>('select');
  const [workoutType, setWorkoutType] = useState<WorkoutType>('yoga');
  const [elapsed, setElapsed]       = useState(0);
  const [intensity, setIntensity]   = useState<Intensity | null>(null);
  const [saving, setSaving]         = useState(false);
  const intervalRef                 = useRef<ReturnType<typeof setInterval> | null>(null);
  const uid                         = auth.currentUser?.uid;
  useKeepAwake();

  const activeType = WORKOUT_TYPES.find(t => t.key === workoutType)!;

  const start = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setPhase('running');
    intervalRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
  };

  const pause = () => {
    Haptics.selectionAsync();
    clearInterval(intervalRef.current!);
    setPhase('paused');
  };

  const resume = () => {
    Haptics.selectionAsync();
    setPhase('running');
    intervalRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
  };

  const endWorkout = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    clearInterval(intervalRef.current!);
    setPhase('done');
  };

  const saveSession = useCallback(async () => {
    if (!uid || !intensity) return;
    setSaving(true);
    try {
      const minutes = Math.round(elapsed / 60);
      const status = minutes >= 15 ? 'done' : minutes > 0 ? 'partial' : 'missed';
      await saveHabitLog({
        habitId: 'workout', habitName: 'Workout',
        userId: uid, date: todayStr(), status,
        durationMinutes: minutes,
        workoutType,
        intensity,
        feelRating: intensity,
        streakAtLog: 0,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      Alert.alert('Error', 'Could not save session.');
    } finally {
      setSaving(false);
    }
  }, [uid, elapsed, workoutType, intensity]);

  const minutes = Math.floor(elapsed / 60);
  const secs    = elapsed % 60;

  // ── Type selection screen ───────────────────────────────────────────────────
  if (phase === 'select') return (
    <LinearGradient colors={['#0A0A0F', '#1A0A0A', '#0A0A0F']} style={s.full}>
      <StatusBar barStyle="light-content" />
      <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
        <Text style={s.backTxt}>← Back</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={s.centerPad} showsVerticalScrollIndicator={false}>
        <Text style={s.bigEmoji}>💪</Text>
        <Text style={s.heading}>Workout</Text>
        <Text style={s.sub}>6:00–8:00 AM · Builds Agni</Text>

        <Text style={s.sectionLabel}>What type of workout?</Text>
        <View style={s.typeGrid}>
          {WORKOUT_TYPES.map(t => (
            <TouchableOpacity
              key={t.key}
              style={[s.typeBtn, workoutType === t.key && { borderColor: t.color, backgroundColor: t.color + '20' }]}
              onPress={() => { Haptics.selectionAsync(); setWorkoutType(t.key); }}
            >
              <Text style={s.typeEmoji}>{t.emoji}</Text>
              <Text style={[s.typeLabel, workoutType === t.key && { color: t.color }]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={[s.selectedCard, { borderColor: activeType.color + '40', backgroundColor: activeType.color + '12' }]}>
          <Text style={[s.selectedTxt, { color: activeType.color }]}>
            {activeType.emoji} {activeType.label} selected — ready to begin!
          </Text>
        </View>

        <TouchableOpacity style={[s.startBtn, { backgroundColor: activeType.color }]} onPress={start}>
          <Text style={s.startTxt}>START {activeType.label.toUpperCase()} TIMER</Text>
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );

  // ── Running / Paused ────────────────────────────────────────────────────────
  if (phase === 'running' || phase === 'paused') return (
    <LinearGradient colors={['#0A0A0F', '#1A0A0A', '#0A0A0F']} style={s.full}>
      <StatusBar barStyle="light-content" />
      <TouchableOpacity style={s.backBtn} onPress={() => {
        if (phase === 'running') pause();
        Alert.alert('End workout?', 'Leave without saving?', [
          { text: 'Stay', style: 'cancel', onPress: () => phase === 'running' ? resume() : undefined },
          { text: 'Leave', style: 'destructive', onPress: () => router.back() },
        ]);
      }}>
        <Text style={s.backTxt}>← Back</Text>
      </TouchableOpacity>

      <View style={s.center}>
        <Text style={s.activeTypeLabel}>{activeType.emoji} {activeType.label}</Text>

        <View style={[s.circleOuter, { borderColor: activeType.color + '50' }]}>
          <View style={s.circleInner}>
            <Text style={[s.timerMin, { color: activeType.color + 'DD' }]}>{String(minutes).padStart(2, '0')}</Text>
            <Text style={[s.timerColon, { color: activeType.color + '80' }]}>:</Text>
            <Text style={[s.timerSec, { color: activeType.color }]}>{String(secs).padStart(2, '0')}</Text>
          </View>
        </View>

        <Text style={s.phaseLabel}>{phase === 'paused' ? '⏸ Paused' : '💪 Keep going!'}</Text>
        {minutes >= 15 && <Text style={s.milestoneLabel}>🔥 15+ min — excellent work!</Text>}

        <View style={s.btnRow}>
          {phase === 'running' ? (
            <TouchableOpacity style={s.pauseBtn} onPress={pause}>
              <Text style={s.pauseTxt}>⏸ PAUSE</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={s.pauseBtn} onPress={resume}>
              <Text style={s.pauseTxt}>▶ RESUME</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[s.endBtn, { backgroundColor: activeType.color }]} onPress={endWorkout}>
            <Text style={s.endTxt}>END WORKOUT</Text>
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
  );

  // ── Summary / Rating screen ─────────────────────────────────────────────────
  const isPartial = minutes < 15 && minutes > 0;
  return (
    <LinearGradient colors={['#0A0A0F', '#1A0A0A', '#0A0A0F']} style={s.full}>
      <StatusBar barStyle="light-content" />
      <View style={s.center}>
        <Text style={s.doneEmoji}>💪</Text>
        <Text style={s.doneTitle}>Workout Complete!</Text>

        <View style={s.summaryBox}>
          <View style={s.summaryRow}>
            <Text style={s.summaryKey}>{activeType.emoji} Type</Text>
            <Text style={[s.summaryVal, { color: activeType.color }]}>{activeType.label}</Text>
          </View>
          <View style={s.summaryRow}>
            <Text style={s.summaryKey}>⏱ Duration</Text>
            <Text style={s.summaryVal}>{formatDuration(elapsed)}</Text>
          </View>
          <View style={s.summaryRow}>
            <Text style={s.summaryKey}>📊 Status</Text>
            {isPartial
              ? <View style={s.partialBadge}><Text style={s.partialTxt}>⏱ Partial (under 15 min)</Text></View>
              : <View style={s.doneBadge}><Text style={s.doneBadgeTxt}>✅ Perfect</Text></View>
            }
          </View>
        </View>

        <Text style={s.feelQ}>Intensity felt like?</Text>
        <View style={s.feelRow}>
          {INTENSITIES.map(i => (
            <TouchableOpacity
              key={i.key}
              style={[s.feelBtn, intensity === i.key && { borderColor: i.color, backgroundColor: i.color + '20' }]}
              onPress={() => { Haptics.selectionAsync(); setIntensity(i.key); }}
            >
              <Text style={s.feelEmoji}>{i.emoji}</Text>
              <Text style={[s.feelLabel, intensity === i.key && { color: i.color }]}>{i.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[s.saveBtn, { backgroundColor: activeType.color }, (!intensity || saving) && { opacity: 0.5 }]}
          onPress={saveSession}
          disabled={!intensity || saving}
        >
          <Text style={s.saveTxt}>{saving ? 'Saving...' : 'SAVE WORKOUT'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.skipBtn} onPress={() => router.back()}>
          <Text style={s.skipTxt}>Skip & close</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  full: { flex: 1 },
  backBtn: { position: 'absolute', top: 56, left: Spacing.lg, zIndex: 10, paddingVertical: 6, paddingHorizontal: 10 },
  backTxt: { color: Colors.textSub, fontSize: Font.sizes.sm, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.lg },
  centerPad: { alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: 96, paddingBottom: 48 },
  bigEmoji: { fontSize: 56, marginBottom: Spacing.sm },
  heading: { fontSize: Font.sizes.xxl, fontWeight: '900', color: Colors.text, marginBottom: 4 },
  sub: { fontSize: Font.sizes.sm, color: '#ef4444', fontWeight: '600', marginBottom: Spacing.xl },
  sectionLabel: { fontSize: Font.sizes.sm, color: Colors.textSub, fontWeight: '700', alignSelf: 'flex-start', marginBottom: Spacing.sm },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: Spacing.lg, width: '100%' },
  typeBtn: { width: (width - Spacing.lg * 2 - 40) / 3, alignItems: 'center', paddingVertical: 14, borderRadius: Radius.md, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, gap: 6 },
  typeEmoji: { fontSize: 26 },
  typeLabel: { fontSize: Font.sizes.xs, fontWeight: '700', color: Colors.textSub },
  selectedCard: { borderRadius: Radius.md, borderWidth: 1, padding: Spacing.sm + 2, marginBottom: Spacing.lg, alignSelf: 'stretch' },
  selectedTxt: { fontSize: Font.sizes.sm, fontWeight: '700', textAlign: 'center' },
  startBtn: { borderRadius: Radius.full, paddingVertical: 16, paddingHorizontal: 40, alignSelf: 'stretch', alignItems: 'center' },
  startTxt: { color: '#fff', fontSize: Font.sizes.base, fontWeight: '900', letterSpacing: 1 },
  activeTypeLabel: { fontSize: Font.sizes.base, fontWeight: '800', color: Colors.textSub, marginBottom: Spacing.lg },
  circleOuter: { width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, borderWidth: 3, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg },
  circleInner: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  timerMin: { fontSize: 60, fontWeight: '900' },
  timerColon: { fontSize: 44, fontWeight: '900', marginBottom: 8 },
  timerSec: { fontSize: 36, fontWeight: '700' },
  phaseLabel: { fontSize: Font.sizes.base, fontWeight: '700', color: Colors.textSub, marginBottom: 4 },
  milestoneLabel: { fontSize: Font.sizes.sm, color: '#f59e0b', fontWeight: '700', marginBottom: Spacing.lg },
  btnRow: { flexDirection: 'row', gap: 12, marginTop: Spacing.lg },
  pauseBtn: { flex: 1, paddingVertical: 14, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  pauseTxt: { color: Colors.textSub, fontWeight: '800', fontSize: Font.sizes.sm },
  endBtn: { flex: 1, paddingVertical: 14, borderRadius: Radius.md, alignItems: 'center' },
  endTxt: { color: '#fff', fontWeight: '800', fontSize: Font.sizes.sm },
  doneEmoji: { fontSize: 60, marginBottom: Spacing.sm },
  doneTitle: { fontSize: Font.sizes.xl, fontWeight: '900', color: Colors.text, marginBottom: Spacing.lg },
  summaryBox: { backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, alignSelf: 'stretch', marginBottom: Spacing.lg, gap: 10 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryKey: { fontSize: Font.sizes.sm, color: Colors.textSub, fontWeight: '600' },
  summaryVal: { fontSize: Font.sizes.sm, fontWeight: '800', color: Colors.text },
  partialBadge: { backgroundColor: '#fb923c20', borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  partialTxt: { fontSize: 10, fontWeight: '800', color: '#fb923c' },
  doneBadge: { backgroundColor: '#10b98120', borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  doneBadgeTxt: { fontSize: 10, fontWeight: '800', color: '#10b981' },
  feelQ: { fontSize: Font.sizes.base, fontWeight: '800', color: Colors.text, marginBottom: Spacing.md },
  feelRow: { flexDirection: 'row', gap: 10, marginBottom: Spacing.xl },
  feelBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card, gap: 6 },
  feelEmoji: { fontSize: 26 },
  feelLabel: { fontSize: 11, fontWeight: '700', color: Colors.textSub },
  saveBtn: { borderRadius: Radius.full, paddingVertical: 16, paddingHorizontal: 48, alignSelf: 'stretch', alignItems: 'center', marginBottom: Spacing.sm },
  saveTxt: { color: '#fff', fontSize: Font.sizes.base, fontWeight: '900', letterSpacing: 1 },
  skipBtn: { paddingVertical: 8 },
  skipTxt: { color: Colors.textMuted, fontSize: Font.sizes.sm, fontWeight: '600' },
});
