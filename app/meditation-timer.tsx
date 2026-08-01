import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Easing,
  StatusBar, Dimensions, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { auth } from '@/lib/firebase';
import { saveHabitLog, formatDuration, todayStr } from '@/lib/habitLogs';
import { Colors, Spacing, Radius, Font } from '@/constants/theme';

const { width } = Dimensions.get('window');
const CIRCLE = width * 0.68;

type Phase = 'idle' | 'running' | 'paused' | 'done';
type Sound = 'silence' | 'om' | 'birds' | 'bowl' | 'rain';
type Feel = 'distracted' | 'good' | 'deep';

const SOUNDS: { key: Sound; emoji: string; label: string }[] = [
  { key: 'silence', emoji: '🤫', label: 'Silence' },
  { key: 'om',      emoji: '🕉️', label: 'Om' },
  { key: 'birds',   emoji: '🐦', label: 'Birds' },
  { key: 'bowl',    emoji: '🎶', label: 'Singing Bowl' },
  { key: 'rain',    emoji: '🌧️', label: 'Rain' },
];

const FEELS: { key: Feel; emoji: string; label: string; color: string }[] = [
  { key: 'distracted', emoji: '😴', label: 'Distracted', color: '#94a3b8' },
  { key: 'good',       emoji: '😊', label: 'Good',       color: '#10b981' },
  { key: 'deep',       emoji: '🔥', label: 'Deep',       color: '#a78bfa' },
];

export default function MeditationTimer() {
  const router = useRouter();
  const [phase, setPhase]       = useState<Phase>('idle');
  const [elapsed, setElapsed]   = useState(0);
  const [sound, setSound]       = useState<Sound>('silence');
  const [feel, setFeel]         = useState<Feel | null>(null);
  const [saving, setSaving]     = useState(false);
  const startTime               = useRef<Date | null>(null);
  const intervalRef             = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim               = useRef(new Animated.Value(1)).current;
  const uid                     = auth.currentUser?.uid;
  useKeepAwake();

  // Pulsing ring animation while running
  useEffect(() => {
    if (phase === 'running') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.06, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [phase]);

  const start = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    startTime.current = new Date();
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

  const endSession = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    clearInterval(intervalRef.current!);
    setPhase('done');
  };

  const saveSession = useCallback(async () => {
    if (!uid || !feel) return;
    setSaving(true);
    try {
      const minutes = Math.round(elapsed / 60);
      const status = minutes >= 10 ? 'done' : minutes > 0 ? 'partial' : 'missed';
      await saveHabitLog({
        habitId: 'meditation', habitName: 'Meditation',
        userId: uid, date: todayStr(), status,
        durationMinutes: minutes,
        feelRating: feel,
        streakAtLog: 0,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e) {
      Alert.alert('Error', 'Could not save session. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [uid, elapsed, feel]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const isPartial = minutes < 10 && minutes > 0;

  // ── Idle screen ─────────────────────────────────────────────────────────────
  if (phase === 'idle') return (
    <LinearGradient colors={['#0A0A0F', '#12101E', '#0A0A0F']} style={s.full}>
      <StatusBar barStyle="light-content" />
      <TouchableOpacity hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }} style={s.backBtn} onPress={() => router.back()}>
        <Text style={s.backTxt}>← Back</Text>
      </TouchableOpacity>

      <View style={s.center}>
        <Text style={s.bigEmoji}>🧘</Text>
        <Text style={s.heading}>Meditation</Text>
        <Text style={s.sub}>4:00–8:00 AM · Vata window</Text>
        <Text style={s.sub2}>Mind is sharpest — ideal for inner silence</Text>

        {/* Sound selector */}
        <Text style={s.soundLabel}>Ambient sound</Text>
        <View style={s.soundRow}>
          {SOUNDS.map(snd => (
            <TouchableOpacity
              key={snd.key}
              style={[s.soundBtn, sound === snd.key && s.soundBtnActive]}
              onPress={() => { Haptics.selectionAsync(); setSound(snd.key); }}
            >
              <Text style={s.soundEmoji}>{snd.emoji}</Text>
              <Text style={[s.soundTxt, sound === snd.key && { color: '#c084fc' }]}>{snd.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={s.startBtn} onPress={start}>
          <Text style={s.startTxt}>BEGIN SESSION</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );

  // ── Running / Paused screen ──────────────────────────────────────────────────
  if (phase === 'running' || phase === 'paused') return (
    <LinearGradient colors={['#0A0A0F', '#100D1A', '#0A0A0F']} style={s.full}>
      <StatusBar barStyle="light-content" />
      <TouchableOpacity hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }} style={s.backBtn} onPress={() => { pause(); Alert.alert('End session?', 'Your progress will not be saved if you leave now.', [{ text: 'Stay', style: 'cancel', onPress: () => phase === 'running' && resume() }, { text: 'Leave', onPress: () => router.back() }]); }}>
        <Text style={s.backTxt}>← Back</Text>
      </TouchableOpacity>

      <View style={s.center}>
        {/* Circular timer */}
        <Animated.View style={[s.circleOuter, { transform: [{ scale: pulseAnim }] }]}>
          <View style={s.circleInner}>
            <Text style={s.timerMin}>{String(minutes).padStart(2, '0')}</Text>
            <Text style={s.timerColon}>:</Text>
            <Text style={s.timerSec}>{String(seconds).padStart(2, '0')}</Text>
          </View>
        </Animated.View>

        <Text style={s.timerLabel}>{phase === 'paused' ? '⏸ Paused' : '🧘 Meditating...'}</Text>
        <Text style={s.timerSub}>Sound: {SOUNDS.find(s => s.key === sound)?.emoji} {sound}</Text>

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
          <TouchableOpacity style={s.endBtn} onPress={endSession}>
            <Text style={s.endTxt}>END SESSION</Text>
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
  );

  // ── Done / Rating screen ─────────────────────────────────────────────────────
  return (
    <LinearGradient colors={['#0A0A0F', '#0E0D1A', '#0A0A0F']} style={s.full}>
      <StatusBar barStyle="light-content" />

      <View style={s.center}>
        <Text style={s.doneEmoji}>🧘</Text>
        <Text style={s.doneTitle}>Meditation Complete</Text>
        <View style={s.doneStatRow}>
          <Text style={s.doneStat}>⏱ {formatDuration(elapsed)}</Text>
          <Text style={s.doneStat}>· {minutes} min</Text>
          {isPartial && <View style={s.partialBadge}><Text style={s.partialTxt}>⏱ Partial</Text></View>}
          {minutes >= 10 && <View style={s.perfectBadge}><Text style={s.perfectTxt}>✅ Perfect</Text></View>}
        </View>

        <Text style={s.feelQ}>How did it feel?</Text>
        <View style={s.feelRow}>
          {FEELS.map(f => (
            <TouchableOpacity
              key={f.key}
              style={[s.feelBtn, feel === f.key && { borderColor: f.color, backgroundColor: f.color + '20' }]}
              onPress={() => { Haptics.selectionAsync(); setFeel(f.key); }}
            >
              <Text style={s.feelEmoji}>{f.emoji}</Text>
              <Text style={[s.feelLabel, feel === f.key && { color: f.color }]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[s.saveSessionBtn, (!feel || saving) && { opacity: 0.5 }]}
          onPress={saveSession}
          disabled={!feel || saving}
        >
          <Text style={s.saveSessionTxt}>{saving ? 'Saving...' : 'SAVE SESSION'}</Text>
        </TouchableOpacity>

        <TouchableOpacity hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }} style={s.skipBtn} onPress={() => router.back()}>
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
  bigEmoji: { fontSize: 56, marginBottom: Spacing.sm },
  heading: { fontSize: Font.sizes.xxl, fontWeight: '900', color: Colors.text, marginBottom: 4 },
  sub: { fontSize: Font.sizes.sm, color: '#c084fc', fontWeight: '600', marginBottom: 2 },
  sub2: { fontSize: Font.sizes.xs, color: Colors.textMuted, marginBottom: Spacing.xl },
  soundLabel: { fontSize: Font.sizes.sm, color: Colors.textSub, fontWeight: '700', alignSelf: 'flex-start', marginBottom: Spacing.sm },
  soundRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: Spacing.xl },
  soundBtn: { alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderRadius: Radius.md, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, gap: 3, minWidth: 60 },
  soundBtnActive: { borderColor: '#c084fc', backgroundColor: '#c084fc18' },
  soundEmoji: { fontSize: 20 },
  soundTxt: { fontSize: 10, fontWeight: '700', color: Colors.textSub },
  startBtn: { backgroundColor: '#c084fc', borderRadius: Radius.full, paddingVertical: 16, paddingHorizontal: 48, marginTop: Spacing.sm },
  startTxt: { color: '#fff', fontSize: Font.sizes.base, fontWeight: '900', letterSpacing: 1.5 },
  circleOuter: { width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, borderWidth: 3, borderColor: '#c084fc50', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg, backgroundColor: '#c084fc08' },
  circleInner: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  timerMin: { fontSize: 64, fontWeight: '900', color: '#e2d9f3' },
  timerColon: { fontSize: 48, fontWeight: '900', color: '#c084fc80', marginBottom: 8 },
  timerSec: { fontSize: 40, fontWeight: '700', color: '#c084fc' },
  timerLabel: { fontSize: Font.sizes.base, fontWeight: '700', color: Colors.textSub, marginBottom: 4 },
  timerSub: { fontSize: Font.sizes.xs, color: Colors.textMuted, marginBottom: Spacing.xl },
  btnRow: { flexDirection: 'row', gap: 12, marginTop: Spacing.md },
  pauseBtn: { flex: 1, paddingVertical: 14, borderRadius: Radius.md, borderWidth: 1, borderColor: '#c084fc50', alignItems: 'center' },
  pauseTxt: { color: '#c084fc', fontWeight: '800', fontSize: Font.sizes.sm },
  endBtn: { flex: 1, paddingVertical: 14, borderRadius: Radius.md, backgroundColor: '#c084fc', alignItems: 'center' },
  endTxt: { color: '#fff', fontWeight: '800', fontSize: Font.sizes.sm },
  doneEmoji: { fontSize: 60, marginBottom: Spacing.sm },
  doneTitle: { fontSize: Font.sizes.xl, fontWeight: '900', color: Colors.text, marginBottom: Spacing.sm },
  doneStatRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.xl },
  doneStat: { fontSize: Font.sizes.base, fontWeight: '700', color: Colors.textSub },
  partialBadge: { backgroundColor: '#fb923c20', borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  partialTxt: { fontSize: 10, fontWeight: '800', color: '#fb923c' },
  perfectBadge: { backgroundColor: '#10b98120', borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  perfectTxt: { fontSize: 10, fontWeight: '800', color: '#10b981' },
  feelQ: { fontSize: Font.sizes.base, fontWeight: '800', color: Colors.text, marginBottom: Spacing.md },
  feelRow: { flexDirection: 'row', gap: 10, marginBottom: Spacing.xl },
  feelBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card, gap: 6 },
  feelEmoji: { fontSize: 28 },
  feelLabel: { fontSize: 11, fontWeight: '700', color: Colors.textSub },
  saveSessionBtn: { backgroundColor: '#c084fc', borderRadius: Radius.full, paddingVertical: 16, paddingHorizontal: 48, marginBottom: Spacing.sm },
  saveSessionTxt: { color: '#fff', fontSize: Font.sizes.base, fontWeight: '900', letterSpacing: 1 },
  skipBtn: { paddingVertical: 8, zIndex: 100, elevation: 100 },
  skipTxt: { color: Colors.textMuted, fontSize: Font.sizes.sm, fontWeight: '600' },
});
