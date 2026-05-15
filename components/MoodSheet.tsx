import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Modal } from 'react-native';
import * as Haptics from 'expo-haptics';

const SLEEP_COLOR = '#60a5fa';
const AUTO_SKIP_SECS = 3;

export const MOODS = [
  { key: 'stressed',  emoji: '😰', label: 'Stressed', color: '#ef4444' },
  { key: 'anxious',   emoji: '😟', label: 'Anxious',  color: '#f97316' },
  { key: 'sad',       emoji: '😔', label: 'Sad',      color: '#60a5fa' },
  { key: 'okay',      emoji: '😐', label: 'Okay',     color: '#94a3b8' },
  { key: 'calm',      emoji: '😌', label: 'Calm',     color: '#34d399' },
  { key: 'relaxed',   emoji: '🙂', label: 'Relaxed',  color: '#6ee7b7' },
  { key: 'happy',     emoji: '😊', label: 'Happy',    color: '#fbbf24' },
  { key: 'great',     emoji: '😄', label: 'Great',    color: '#10b981' },
] as const;

export type MoodKey = typeof MOODS[number]['key'];

export function MoodSheet({
  visible,
  mode,
  preMood,
  onSelect,
  onSkip,
}: {
  visible: boolean;
  mode: 'pre' | 'post' | 'result';
  preMood?: MoodKey | null;
  onSelect: (key: MoodKey) => void;
  onSkip: () => void;
}) {
  const [selected, setSelected]       = useState<MoodKey | null>(null);
  const [countdown, setCountdown]     = useState(AUTO_SKIP_SECS);
  const [countingDown, setCountingDown] = useState(false);
  const slideAnim     = useRef(new Animated.Value(400)).current;
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const onSkipRef     = useRef(onSkip);

  useEffect(() => { onSkipRef.current = onSkip; }, [onSkip]);

  const clearCountdown = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setCountingDown(false);
  }, []);

  const startCountdown = useCallback(() => {
    clearCountdown();
    setCountdown(AUTO_SKIP_SECS);
    setCountingDown(true);
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearCountdown();
          setTimeout(() => onSkipRef.current(), 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [clearCountdown]);

  // Reset selection and animate when visibility changes
  useEffect(() => {
    if (visible) {
      setSelected(null);
      setCountdown(AUTO_SKIP_SECS);
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 6 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: 400, duration: 250, useNativeDriver: true }).start();
    }
    return () => clearCountdown();
  }, [visible]);

  // Countdown control: only auto-skip in 'pre' mode; post and result never auto-skip
  useEffect(() => {
    if (!visible) { clearCountdown(); return; }
    if (mode === 'pre') {
      startCountdown();
    } else {
      clearCountdown();
    }
  }, [visible, mode]);

  const handleMoodTap = (key: MoodKey) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected(key);
    clearCountdown();
  };

  if (!visible) return null;

  if (mode === 'result' && selected) {
    const postMeta = MOODS.find(m => m.key === selected)!;
    const preMeta  = preMood ? (MOODS.find(m => m.key === preMood) ?? null) : null;
    const improved = preMeta ? MOODS.indexOf(postMeta) > MOODS.indexOf(preMeta) : false;
    return (
      <Modal transparent animationType="none" visible={visible} onRequestClose={onSkip}>
        <View style={MS.backdrop}>
          <Animated.View style={[MS.sheet, { transform: [{ translateY: slideAnim }] }]}>
            <View style={MS.handle} />
            <Text style={MS.title}>Your Mood Journey 🌙</Text>
            <Text style={MS.sub}>{preMeta ? "Here's how the session shifted your state" : 'Your mood after this session'}</Text>
            <View style={MS.journeyRow}>
              {preMeta && (
                <>
                  <View style={MS.journeyBox}>
                    <Text style={MS.journeyEmoji}>{preMeta.emoji}</Text>
                    <Text style={[MS.journeyLabel, { color: preMeta.color }]}>{preMeta.label}</Text>
                    <Text style={MS.journeyTime}>Before</Text>
                  </View>
                  <View style={MS.journeyArrow}>
                    <Text style={{ fontSize: 22, color: '#FFFFFF30' }}>→</Text>
                  </View>
                </>
              )}
              <View style={MS.journeyBox}>
                <Text style={MS.journeyEmoji}>{postMeta.emoji}</Text>
                <Text style={[MS.journeyLabel, { color: postMeta.color }]}>{postMeta.label}</Text>
                <Text style={MS.journeyTime}>After</Text>
              </View>
            </View>
            <View style={[MS.insightCard, { borderColor: (improved ? postMeta.color : '#FFFFFF18') + '50', backgroundColor: (improved ? postMeta.color : '#FFFFFF') + '08' }]}>
              <Text style={{ fontSize: 15 }}>{improved ? '✨' : '💙'}</Text>
              <Text style={{ fontSize: 13, color: '#FFFFFF90', flex: 1, lineHeight: 18 }}>
                {preMeta
                  ? (improved
                      ? `Sound moved you from ${preMeta.label} to ${postMeta.label}. Sound science at work.`
                      : `Every session plants a seed. Rest, and let it bloom. 🌙`)
                  : `Feeling ${postMeta.label} after your session. Sound shapes the mind. 🌙`}
              </Text>
            </View>
            <TouchableOpacity onPress={onSkip} style={[MS.doneBtn, { backgroundColor: SLEEP_COLOR + '20', borderColor: SLEEP_COLOR + '50' }]}>
              <Text style={[MS.doneTxt, { color: SLEEP_COLOR }]}>Done</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onSkip}>
      <View style={MS.backdrop}>
        <Animated.View style={[MS.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={MS.handle} />
          <Text style={MS.title}>{mode === 'pre' ? 'How are you feeling?' : 'How do you feel now?'}</Text>
          <Text style={MS.sub}>{mode === 'pre' ? 'Check in before your sound session' : 'After your sound session just now'}</Text>
          <View style={MS.moodGrid}>
            {MOODS.map(m => {
              const isSelected = selected === m.key;
              return (
                <TouchableOpacity key={m.key} onPress={() => handleMoodTap(m.key)}
                  style={[MS.moodBtn, isSelected && { borderColor: m.color, backgroundColor: m.color + '20' }]}>
                  <Text style={MS.moodEmoji}>{m.emoji}</Text>
                  <Text style={[MS.moodLabel, { color: isSelected ? m.color : '#FFFFFF50' }]}>{m.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginHorizontal: 20, marginTop: 4 }}>
            <TouchableOpacity onPress={onSkip} style={MS.skipBtn}>
              <Text style={MS.skipTxt}>{countingDown ? `Skip (${countdown}s)` : 'Skip'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { if (selected) onSelect(selected); }}
              style={[MS.doneBtn, { flex: 2, opacity: selected ? 1 : 0.35, backgroundColor: SLEEP_COLOR + '20', borderColor: SLEEP_COLOR + '50' }]}
              disabled={!selected}>
              <Text style={[MS.doneTxt, { color: SLEEP_COLOR }]}>{mode === 'pre' ? 'Start Session →' : 'See Result'}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const MS = StyleSheet.create({
  backdrop:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet:        { backgroundColor: '#0E0E1C', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12, paddingBottom: 44 },
  handle:       { width: 36, height: 4, borderRadius: 2, backgroundColor: '#FFFFFF20', alignSelf: 'center', marginBottom: 20 },
  title:        { fontSize: 20, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 6 },
  sub:          { fontSize: 12, color: '#FFFFFF40', textAlign: 'center', marginBottom: 24 },
  moodGrid:     { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 10, justifyContent: 'center', marginBottom: 20 },
  moodBtn:      { width: '22%', paddingVertical: 12, alignItems: 'center', borderRadius: 16, borderWidth: 1, borderColor: '#FFFFFF10', backgroundColor: '#FFFFFF05', gap: 4 },
  moodEmoji:    { fontSize: 28 },
  moodLabel:    { fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
  skipBtn:      { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#FFFFFF12', backgroundColor: '#FFFFFF06' },
  skipTxt:      { fontSize: 13, fontWeight: '700', color: '#FFFFFF40' },
  doneBtn:      { borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1 },
  doneTxt:      { fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },
  journeyRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24, gap: 8 },
  journeyBox:   { alignItems: 'center', gap: 6, width: 90 },
  journeyEmoji: { fontSize: 44 },
  journeyLabel: { fontSize: 13, fontWeight: '800' },
  journeyTime:  { fontSize: 9, fontWeight: '700', color: '#FFFFFF35', letterSpacing: 1 },
  journeyArrow: { paddingHorizontal: 8 },
  insightCard:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginHorizontal: 20, borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 20 },
});
