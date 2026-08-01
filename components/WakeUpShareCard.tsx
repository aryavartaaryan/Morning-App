/**
 * WakeUpShareCard
 * Beautiful shareable card shown when user woke before sunrise via alarm.
 * Tap share → opens native share sheet with formatted text + fake app link.
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  Share, Animated, Easing, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { type WakeLogEntry, type SunriseStreak, setWakeMood, markShared } from '@/lib/sunriseStreak';

const { width } = Dimensions.get('window');
const ACCENT = '#F5820A';

const FAKE_APP_LINK = 'https://onesutra.app/arise';  // placeholder — replace when live

const MOODS = [
  { emoji: '🔥', label: 'Powerful' },
  { emoji: '😌', label: 'Peaceful' },
  { emoji: '⚡', label: 'Energised' },
  { emoji: '🙏', label: 'Grateful' },
  { emoji: '😴', label: 'Sleepy' },
  { emoji: '🧘', label: 'Centred' },
];

const MORNING_QUOTES = [
  'The morning is wiser than the evening.',
  'Early rising makes a man healthy, wealthy, and wise.',
  'Brahma Muhurta — the hour the universe conspires for you.',
  'Win the morning. Win the day.',
  'The Sun never says "you owe me" — it just rises.',
  'Rise before the world asks something of you.',
  'The secret of your future is hidden in your daily routine.',
];

function getTodayQuote(): string {
  const d = new Date().getDay();
  return MORNING_QUOTES[d % MORNING_QUOTES.length];
}

function formatStreakLabel(count: number): string {
  if (count === 0) return 'First time!';
  if (count === 1) return '1 day streak 🔥';
  if (count < 7)   return `${count} day streak 🔥`;
  if (count < 30)  return `${count} day streak 🔥🔥`;
  return `${count} day streak 🔥🔥🔥`;
}

interface Props {
  wakeLog: WakeLogEntry;
  streak: SunriseStreak;
  onClose: () => void;
}

export default function WakeUpShareCard({ wakeLog, streak, onClose }: Props) {
  const [selectedMood, setSelectedMood] = useState<string | null>(wakeLog.mood);
  const [shared, setShared] = useState(wakeLog.sharedToday);
  const glow = new Animated.Value(0);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 2000, easing: Easing.sin, useNativeDriver: false }),
        Animated.timing(glow, { toValue: 0, duration: 2000, easing: Easing.sin, useNativeDriver: false }),
      ])
    ).start();
  }, []);

  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.9] });

  const handleMoodSelect = async (emoji: string) => {
    setSelectedMood(emoji);
    await setWakeMood(emoji);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleShare = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const moodLine = selectedMood
      ? `Feeling: ${selectedMood}  ${MOODS.find(m => m.emoji === selectedMood)?.label ?? ''}\n`
      : '';

    const streakLine = streak.count > 0
      ? `🔥 ${formatStreakLabel(streak.count)}\n`
      : '';

    const text =
      `🌅 I woke before Sunrise!\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `⏰  Wake time: ${wakeLog.wakeTimeStr}\n` +
      `🌄  Sunrise:    ${fmtHour(wakeLog.sunriseHour)}\n` +
      streakLine +
      moodLine +
      `━━━━━━━━━━━━━━━━━━\n` +
      `"${getTodayQuote()}"\n\n` +
      `📱 Track your sunrise streak → ${FAKE_APP_LINK}`;

    try {
      await Share.share({ message: text });
      await markShared();
      setShared(true);
    } catch { /* user cancelled */ }
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={S.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1} />

        {/* Card */}
        <View style={S.cardWrap}>
          <LinearGradient
            colors={['#0a0a1a', '#0d0820', '#060612']}
            style={S.cardBg}>

            {/* Glowing sun circle */}
            <View style={S.sunWrap}>
              <Animated.View style={[S.sunGlow, { opacity: glowOpacity }]} />
              <Text style={S.sunEmoji}>🌅</Text>
            </View>

            {/* Header */}
            <Text style={S.topTag}>ONESUTRA  ·  ARISE</Text>
            <Text style={S.heroTitle}>Woke Before{'\n'}Sunrise ✓</Text>
            <Text style={S.heroSub}>You beat the world today.</Text>

            {/* Time row */}
            <View style={S.timeRow}>
              <View style={S.timeCell}>
                <Text style={S.timeCellLabel}>WAKE TIME</Text>
                <Text style={S.timeCellValue}>{wakeLog.wakeTimeStr}</Text>
              </View>
              <View style={S.timeDivider} />
              <View style={S.timeCell}>
                <Text style={S.timeCellLabel}>SUNRISE</Text>
                <Text style={S.timeCellValue}>{fmtHour(wakeLog.sunriseHour)}</Text>
              </View>
              <View style={S.timeDivider} />
              <View style={S.timeCell}>
                <Text style={S.timeCellLabel}>EARLY BY</Text>
                <Text style={[S.timeCellValue, { color: ACCENT }]}>
                  {earlyBy(wakeLog.wakeHour, wakeLog.sunriseHour)}
                </Text>
              </View>
            </View>

            {/* Streak badge */}
            {streak.count > 0 && (
              <View style={S.streakBadge}>
                <Text style={S.streakNum}>{streak.count}</Text>
                <View>
                  <Text style={S.streakLabel}>DAY STREAK</Text>
                  <Text style={S.streakSub}>Best: {streak.longestEver} days</Text>
                </View>
                <Text style={S.streakFire}>
                  {streak.count >= 30 ? '🔥🔥🔥' : streak.count >= 7 ? '🔥🔥' : '🔥'}
                </Text>
              </View>
            )}

            {/* Quote */}
            <Text style={S.quote}>"{getTodayQuote()}"</Text>

            {/* Mood selector — optional */}
            <View style={S.moodSection}>
              <Text style={S.moodLabel}>HOW ARE YOU FEELING?  (optional)</Text>
              <View style={S.moodRow}>
                {MOODS.map(m => (
                  <TouchableOpacity
                    key={m.emoji}
                    onPress={() => handleMoodSelect(m.emoji)}
                    style={[
                      S.moodChip,
                      selectedMood === m.emoji && S.moodChipActive,
                    ]}>
                    <Text style={S.moodEmoji}>{m.emoji}</Text>
                    <Text style={[
                      S.moodText,
                      selectedMood === m.emoji && { color: ACCENT },
                    ]}>{m.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Fake app link */}
            <View style={S.linkRow}>
              <Text style={S.linkEmoji}>📱</Text>
              <Text style={S.linkText}>{FAKE_APP_LINK}</Text>
            </View>

            {/* Action buttons */}
            <View style={S.btnRow}>
              <TouchableOpacity onPress={onClose} style={S.skipBtn} activeOpacity={0.7}>
                <Text style={S.skipTxt}>Skip</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleShare} style={S.shareBtn} activeOpacity={0.88}>
                <LinearGradient
                  colors={[ACCENT, '#d96600']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={S.shareBtnInner}>
                  <Text style={S.shareBtnTxt}>
                    {shared ? '✓  Shared!' : '🌐  Share with Friends'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtHour(decH: number): string {
  const totalMin = Math.round(decH * 60) % (24 * 60);
  const hh = Math.floor(totalMin / 60) % 24;
  const mm = totalMin % 60;
  const ampm = hh < 12 ? 'AM' : 'PM';
  const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  return `${String(h12).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${ampm}`;
}

function earlyBy(wakeH: number, sunriseH: number): string {
  const diff = Math.max(0, Math.round((sunriseH - wakeH) * 60));
  if (diff >= 60) return `${Math.floor(diff / 60)}h ${diff % 60}m`;
  return `${diff} min`;
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  cardWrap: {
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    overflow: 'hidden',
  },
  cardBg: {
    paddingHorizontal: 24, paddingTop: 32, paddingBottom: 40,
    alignItems: 'center',
  },

  // Glowing sun
  sunWrap:  { alignItems: 'center', justifyContent: 'center', marginBottom: 14, position: 'relative' },
  sunGlow:  {
    position: 'absolute', width: 90, height: 90, borderRadius: 45,
    backgroundColor: '#F5820A', opacity: 0.3,
    shadowColor: '#F5820A', shadowRadius: 40, shadowOpacity: 1, shadowOffset: { width: 0, height: 0 },
  },
  sunEmoji: { fontSize: 52 },

  // Header text
  topTag:   { fontSize: 9, fontWeight: '900', color: '#FFFFFF25', letterSpacing: 2.5, marginBottom: 8 },
  heroTitle:{ fontSize: 32, fontWeight: '900', color: '#fff', textAlign: 'center', lineHeight: 38, letterSpacing: -0.5 },
  heroSub:  { fontSize: 13, color: '#FFFFFF45', fontWeight: '600', marginTop: 4, marginBottom: 24 },

  // Time row
  timeRow:  {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF06', borderRadius: 20, borderWidth: 1, borderColor: '#FFFFFF08',
    paddingVertical: 16, paddingHorizontal: 10, width: '100%', marginBottom: 18,
  },
  timeCell:      { flex: 1, alignItems: 'center', gap: 4 },
  timeCellLabel: { fontSize: 8, fontWeight: '900', color: '#FFFFFF30', letterSpacing: 1.5 },
  timeCellValue: { fontSize: 17, fontWeight: '900', color: '#fff' },
  timeDivider:   { width: 1, height: 36, backgroundColor: '#FFFFFF10' },

  // Streak
  streakBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: ACCENT + '15', borderWidth: 1, borderColor: ACCENT + '35',
    borderRadius: 20, paddingVertical: 14, paddingHorizontal: 20,
    width: '100%', marginBottom: 18,
  },
  streakNum:   { fontSize: 38, fontWeight: '900', color: ACCENT },
  streakLabel: { fontSize: 12, fontWeight: '900', color: '#FFFFFF90', letterSpacing: 0.5 },
  streakSub:   { fontSize: 10, color: '#FFFFFF35', marginTop: 2 },
  streakFire:  { fontSize: 24, marginLeft: 'auto' },

  // Quote
  quote: {
    fontSize: 12, color: '#FFFFFF40', fontStyle: 'italic',
    textAlign: 'center', lineHeight: 19, marginBottom: 22,
    paddingHorizontal: 10,
  },

  // Mood
  moodSection: { width: '100%', marginBottom: 18 },
  moodLabel:   { fontSize: 8, fontWeight: '900', color: '#FFFFFF25', letterSpacing: 1.5, textAlign: 'center', marginBottom: 12 },
  moodRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  moodChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: '#FFFFFF12', borderRadius: 99,
    paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#FFFFFF05',
  },
  moodChipActive: { borderColor: ACCENT + '55', backgroundColor: ACCENT + '12' },
  moodEmoji: { fontSize: 16 },
  moodText:  { fontSize: 11, color: '#FFFFFF45', fontWeight: '700' },

  // Fake link
  linkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 24, opacity: 0.5,
  },
  linkEmoji: { fontSize: 13 },
  linkText:  { fontSize: 10, color: '#FFFFFF60', fontWeight: '600', textDecorationLine: 'underline' },

  // Buttons
  btnRow:  { flexDirection: 'row', gap: 12, width: '100%' },
  skipBtn: {
    flex: 0.35, paddingVertical: 16, alignItems: 'center',
    borderRadius: 18, borderWidth: 1, borderColor: '#FFFFFF12',
  zIndex: 100, elevation: 100,
  },
  skipTxt: { fontSize: 14, fontWeight: '700', color: '#FFFFFF35' },
  shareBtn:      { flex: 1, borderRadius: 18, overflow: 'hidden' },
  shareBtnInner: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  shareBtnTxt:   { fontSize: 15, fontWeight: '900', color: '#fff', letterSpacing: 0.3 },
});
