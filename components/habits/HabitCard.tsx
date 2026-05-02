import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  useSharedValue, useAnimatedStyle, withSpring, withRepeat, withTiming, withSequence,
  runOnJS, interpolate, Extrapolation,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { HabitLogEntry } from '@/lib/habitLogs';

// ─── Habit interaction type ────────────────────────────────────────────────
export type HabitInteractionType = 'LOG' | 'TRACK' | 'MEAL';

// ─── Quick options (LOG type only) ────────────────────────────────────────
interface QuickOpt { label: string; val: string | number; }

const LOG_QUICK_OPTS: Record<string, QuickOpt[]> = {
  warm_water: [
    { label: '✓ Done', val: 'done' },
    { label: '+1 glass', val: 1 },
    { label: '+2 glasses', val: 2 },
    { label: '+3 glasses', val: 3 },
    { label: '📝 Details', val: 'sheet' },
  ],
  wake_early: [
    { label: '✓ Logged', val: 'done' },
    { label: '📝 Log Time', val: 'sheet' },
  ],
  morning_cleanse: [
    { label: '✓ Done', val: 'done' },
    { label: '☑ Checklist', val: 'sheet' },
  ],
};

// ─── TRACK button config per habit ────────────────────────────────────────
const TRACK_BTN: Record<string, { label: string; emoji: string; color: string }> = {
  morning_walk: { label: 'BEGIN WALK', emoji: '🌄', color: '#34d399' },
  evening_walk: { label: 'BEGIN WALK', emoji: '🌆', color: '#34d399' },
  walk: { label: 'BEGIN WALK', emoji: '🚶', color: '#34d399' },
  meditation: { label: 'BEGIN', emoji: '🧘', color: '#a78bfa' },

  journaling: { label: 'BEGIN', emoji: '📝', color: '#22d3ee' },
};

// ─── Shared props ──────────────────────────────────────────────────────────
export interface HabitCardProps {
  id: string;
  emoji: string;
  name: string;
  color: string;
  interactionType: HabitInteractionType;
  isDone: boolean;
  isLocked: boolean;
  isLate: boolean;
  lockTimeStr?: string;
  windowLabel?: string;  // e.g. "Ideal: 8:00–9:00 AM"
  openUntilStr?: string; // e.g. "Open until 9:38 AM"
  streak?: number;
  monthlyCount?: number;
  weeklyCount?: number;
  lastLog?: HabitLogEntry | null;
  onLog: (val?: string | number) => void;
  onUndo: () => void;
  onDetail: () => void;
  onBeginTrack: () => void;
  timingStatus?: string;
  loggedAtMins?: number;
  onLongPress?: () => void;
}

const SWIPE_THRESH = 60;

// ─── Feel emoji helpers ────────────────────────────────────────────────────
const FEEL_EMOJI: Record<string, string> = {
  distracted: '😴', okay: '😊', good: '😊', deep: '🔥',
  easy: '😌', energising: '⚡', light: '😌', moderate: '💪', intense: '🔥',
};
const MEAL_SIZE_LABEL: Record<string, string> = {
  light: '🍃 Light', medium: '🍽 Medium', heavy: '🫕 Heavy',
};
const MEAL_FEEL_LABEL: Record<string, string> = {
  good: '😊', okay: '🤔', heavy: '😌',
};

// ─── Done-state helpers ──────────────────────────────────────────────────
const DONE_STATUS: Record<string, { label: string; color: string; icon: string }> = {
  on_time: { label: 'Perfect ✦', color: '#4CD964', icon: '✓' },
  late: { label: 'Late', color: '#fbbf24', icon: '⏰' },
  early: { label: 'Early', color: '#60a5fa', icon: '⭐' },
  missed: { label: 'Missed', color: '#f43f5e', icon: '✗' },
};

function fmtLogMins(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const mn = m % 60;
  const p = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(mn).padStart(2, '0')} ${p}`;
}

// ─── TYPE 1 — LOG CARD ────────────────────────────────────────────────────
function LogCard({
  id, emoji, name, color,
  isDone, isLocked, isLate, lockTimeStr, windowLabel, openUntilStr,
  streak = 0, monthlyCount = 0, weeklyCount = 0,
  timingStatus, loggedAtMins,
  onLog, onUndo, onDetail, onLongPress,
}: HabitCardProps) {
  const doneStatus = DONE_STATUS[timingStatus ?? 'on_time'] ?? DONE_STATUS.on_time;
  const logTimeStr = loggedAtMins != null ? fmtLogMins(loggedAtMins) : null;
  const [showQuick, setShowQuick] = useState(false);
  const tx = useSharedValue(0);
  const opts = LOG_QUICK_OPTS[id] ?? [];
  const hasQuick = opts.length > 0;

  const doLog = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (hasQuick) setShowQuick(true); else onLog();
  };
  const doUndo = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onUndo(); };

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12]).failOffsetY([-15, 15])
    .onUpdate(e => { 'worklet'; tx.value = e.translationX; })
    .onEnd(e => {
      'worklet';
      if (e.translationX > SWIPE_THRESH && !isDone && !isLocked) runOnJS(doLog)();
      else if (e.translationX < -SWIPE_THRESH && isDone) runOnJS(doUndo)();
      tx.value = withSpring(0, { damping: 18, stiffness: 200 });
    });

  const cardAnim = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));
  const logReveal = useAnimatedStyle(() => ({
    opacity: interpolate(tx.value, [0, SWIPE_THRESH], [0, 1], Extrapolation.CLAMP),
  }));
  const undoReveal = useAnimatedStyle(() => ({
    opacity: interpolate(-tx.value, [0, SWIPE_THRESH], [0, 1], Extrapolation.CLAMP),
  }));

  const streakLine = isLocked ? `🔒 Opens ${lockTimeStr ?? 'later'}`
    : isLate && !isDone ? '❌ Solar slot closed — missed for today'
      : isDone
        ? `🔥 ${streak}d  ·  ${monthlyCount}×/mo  ·  ${weeklyCount}×/wk`
        : streak > 0
          ? `🔥 ${streak}d streak  ·  ${monthlyCount}×/mo  ·  ${weeklyCount}×/wk`
          : weeklyCount === 0 && monthlyCount === 0
            ? '📋 Not logged yet this month — start today!'
            : `${monthlyCount}×/mo  ·  ${weeklyCount}×/wk`;

  return (
    <View>
      <View style={cs.rowWrap}>
        {!isDone && !isLocked && (
          <Reanimated.View style={[StyleSheet.absoluteFill, cs.logRevealBg, logReveal]}>
            <Text style={cs.logRevealTxt}>✓  LOG</Text>
          </Reanimated.View>
        )}
        {isDone && (
          <Reanimated.View style={[StyleSheet.absoluteFill, cs.undoRevealBg, undoReveal]}>
            <Text style={cs.undoRevealTxt}>↩  UNDO</Text>
          </Reanimated.View>
        )}
        <GestureDetector gesture={pan}>
          <Reanimated.View style={[cardAnim, { opacity: isLocked ? 0.33 : isLate && !isDone ? 0.55 : 1 }]}>
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={isLocked || showQuick ? undefined : onDetail}
              onLongPress={onLongPress}
              style={[cs.card, isDone && cs.cardDone, isLate && !isDone && cs.cardLate]}
            >
              <View style={[cs.accentBar, { backgroundColor: isDone ? '#4CD964' : isLate ? '#FF3B30' : color }]} />
              <View style={[cs.iconBox, {
                backgroundColor: isDone ? 'rgba(76,217,100,0.12)' : color + '18',
                borderColor: isDone ? 'rgba(76,217,100,0.28)' : color + '35',
              }]}>
                <Text style={cs.iconEmoji}>{emoji}</Text>
              </View>
              <View style={cs.textCol}>
                <Text numberOfLines={1} style={[
                  cs.habitName,
                  isDone && { color: 'rgba(255,255,255,0.55)' },
                  isLate && !isDone && { color: 'rgba(255,120,100,0.80)' },
                  isLocked && { color: 'rgba(255,255,255,0.20)' },
                ]}>{name}</Text>
                {(windowLabel || (openUntilStr && !isDone && !isLate)) && (
                  <View style={{ gap: 1 }}>
                    {windowLabel && (
                      <Text numberOfLines={1} style={[cs.windowLabelLine, {
                        color: isDone ? '#4CD96460'
                          : isLate && !isDone ? '#FF950070'
                            : isLocked ? 'rgba(255,255,255,0.18)'
                              : color + '80',
                      }]}>{windowLabel}</Text>
                    )}
                    {openUntilStr && !isDone && !isLate && (
                      <Text numberOfLines={1} style={[cs.windowLabelLine, { color: '#ffffff30' }]}>{openUntilStr}</Text>
                    )}
                  </View>
                )}
                {isDone ? (
                  <>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <View style={{ backgroundColor: doneStatus.color + '18', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: doneStatus.color + '35' }}>
                        <Text style={{ fontSize: 10, fontFamily: 'Nunito_900Black', color: doneStatus.color }}>{doneStatus.icon} {doneStatus.label}</Text>
                      </View>
                      {logTimeStr && <Text style={{ fontSize: 10, fontFamily: 'Nunito_600SemiBold', color: 'rgba(255,255,255,0.28)' }}>Logged {logTimeStr}</Text>}
                    </View>
                    <Text numberOfLines={1} style={[cs.streakLine, { color: '#4CD96450' }]}>
                      {streak > 0 ? `🔥 ${streak}d  ·  ` : ''}{monthlyCount}×/mo  ·  {weeklyCount}×/wk
                    </Text>
                  </>
                ) : (
                  <Text numberOfLines={1} style={[cs.streakLine, {
                    color: isLocked ? 'rgba(255,255,255,0.22)' : isLate && !isDone ? 'rgba(255,100,80,0.60)' : color + '90',
                  }]}>{streakLine}</Text>
                )}
              </View>
              {isDone ? (
                <View style={{ alignItems: 'center', gap: 3 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: doneStatus.color + '18', borderWidth: 1.5, borderColor: doneStatus.color + '40', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 16, color: doneStatus.color, fontFamily: 'Nunito_900Black' }}>✓</Text>
                  </View>
                  <TouchableOpacity onPress={doUndo} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={{ fontSize: 9, fontFamily: 'Nunito_700Bold', color: 'rgba(255,255,255,0.22)', letterSpacing: 0.3 }}>UNDO</Text>
                  </TouchableOpacity>
                </View>
              ) : isLocked ? (
                <Text style={{ fontSize: 13, opacity: 0.25 }}>🔒</Text>
              ) : isLate ? (
                <View style={[cs.latePill, { opacity: 0.7 }]}>
                  <Text style={[cs.latePillTxt, { color: '#f43f5e' }]}>❌{', '}MISSED</Text>
                </View>
              ) : (
                <TouchableOpacity onPress={doLog} style={[cs.logBtn, { borderColor: color + '40', backgroundColor: color + '10' }]}>
                  <Text style={[cs.logBtnTxt, { color }]}>LOG</Text>
                </TouchableOpacity>
              )}
              {isDone && <View style={[cs.progressBar, { backgroundColor: '#4CD964' }]} />}
            </TouchableOpacity>
          </Reanimated.View>
        </GestureDetector>
      </View>
      {showQuick && opts.length > 0 && (
        <View style={cs.quickPanel}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 12, gap: 8, paddingVertical: 10 }}>
            {opts.map(o => (
              <TouchableOpacity key={String(o.val)}
                onPress={() => { setShowQuick(false); onLog(o.val); }}
                style={[cs.quickOpt, { backgroundColor: color + '22', borderColor: color + '55' }]}>
                <Text style={[cs.quickOptTxt, { color }]}>{o.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setShowQuick(false)} style={cs.quickCancel}>
              <Text style={cs.quickCancelTxt}>✕</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}
      {!isDone && !isLocked && (
        <TouchableOpacity onPress={() => onLog('skip')} style={cs.skipBtn}>
          <Text style={cs.skipBtnTxt}>⏭  Skip today</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── TYPE 2 — TRACK CARD ─────────────────────────────────────────────────
function TrackCard({
  id, emoji, name, color,
  isDone, isLocked, isLate, lockTimeStr, windowLabel, openUntilStr,
  streak = 0, monthlyCount = 0, weeklyCount = 0, lastLog,
  timingStatus, loggedAtMins,
  onLog, onDetail, onBeginTrack, onLongPress,
}: HabitCardProps) {
  const doneStatus = DONE_STATUS[timingStatus ?? 'on_time'] ?? DONE_STATUS.on_time;
  const logTimeStr = loggedAtMins != null ? fmtLogMins(loggedAtMins) : null;
  const tx = useSharedValue(0);
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.7);
  const isWindowActive = !isDone && !isLocked && !isLate;
  const btn = TRACK_BTN[id] ?? { label: 'BEGIN', emoji: '▶', color };

  React.useEffect(() => {
    if (!isWindowActive) { pulseScale.value = 1; pulseOpacity.value = 0; return; }
    pulseScale.value = withRepeat(withSequence(
      withTiming(2.0, { duration: 900 }),
      withTiming(1.0, { duration: 900 }),
    ), -1, false);
    pulseOpacity.value = withRepeat(withSequence(
      withTiming(0.1, { duration: 900 }),
      withTiming(0.7, { duration: 900 }),
    ), -1, false);
  }, [isWindowActive]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  // Wobble — no swipe logging, just bounce back
  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12]).failOffsetY([-15, 15])
    .onUpdate(e => { 'worklet'; tx.value = Math.max(-18, Math.min(18, e.translationX * 0.3)); })
    .onEnd(() => { 'worklet'; tx.value = withSpring(0, { damping: 12, stiffness: 400 }); });

  const cardAnim = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));

  // Last session summary for display
  let lastSessionLine = '';
  if (lastLog && !isDone) {
    const parts: string[] = [];
    if (lastLog.distanceKm) parts.push(`📍 ${lastLog.distanceKm}km`);
    if (lastLog.durationMinutes) parts.push(`⏱ ${lastLog.durationMinutes}min`);
    if (lastLog.feelRating && FEEL_EMOJI[lastLog.feelRating]) parts.push(FEEL_EMOJI[lastLog.feelRating]);
    if (parts.length) lastSessionLine = `Last: ${parts.join(' · ')}`;
  }

  // Tracked data for done state
  let trackedLine = '';
  if (isDone && lastLog) {
    const parts: string[] = [];
    if (lastLog.distanceKm) parts.push(`📍 ${lastLog.distanceKm}km`);
    if (lastLog.durationMinutes) parts.push(`⏱ ${lastLog.durationMinutes}min`);
    if (lastLog.steps) parts.push(`👣 ${lastLog.steps.toLocaleString()}`);
    if (lastLog.feelRating && FEEL_EMOJI[lastLog.feelRating]) parts.push(FEEL_EMOJI[lastLog.feelRating]);
    trackedLine = parts.join('  ');
  }

  return (
    <GestureDetector gesture={pan}>
      <Reanimated.View style={[cardAnim, { opacity: isLocked ? 0.33 : isLate && !isDone ? 0.55 : 1, marginBottom: 8 }]}>
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={onDetail}
          onLongPress={onLongPress}
          style={[cs.card, isDone && cs.cardDone, isLate && !isDone && cs.cardLate, { paddingBottom: 12 }]}
        >
          <View style={[cs.accentBar, { backgroundColor: isDone ? '#4CD964' : isLate ? '#FF3B30' : color }]} />
          {/* Pulsing live dot */}
          {isWindowActive && (
            <View style={cs.pulseOuter}>
              <Reanimated.View style={[cs.pulseDot, pulseStyle]} />
              <View style={cs.pulseDotCore} />
            </View>
          )}

          <View style={[cs.iconBox, {
            backgroundColor: isDone ? '#1B3A1F' : color + '22',
            borderColor: isDone ? '#4CD96455' : color + '55',
          }]}>
            <Text style={cs.iconEmoji}>{emoji}</Text>
          </View>

          <View style={cs.textCol}>
            <Text numberOfLines={1} style={[
              cs.habitName,
              isDone && { color: 'rgba(255,255,255,0.55)' },
              isLate && !isDone && { color: '#5A3030' },
              isLocked && { color: '#2C2C2C' },
            ]}>{name}</Text>
            {(windowLabel || (openUntilStr && !isDone && !isLate)) && (
              <View style={{ gap: 1 }}>
                {windowLabel && (
                  <Text numberOfLines={1} style={[cs.windowLabelLine, {
                    color: isDone ? '#4CD96460'
                      : isLate && !isDone ? '#FF950070'
                        : isLocked ? '#2A2A2A'
                          : color + '80',
                  }]}>{windowLabel}</Text>
                )}
                {openUntilStr && !isDone && !isLate && (
                  <Text numberOfLines={1} style={[cs.windowLabelLine, { color: '#ffffff30' }]}>{openUntilStr}</Text>
                )}
              </View>
            )}

            {/* Streak + session summary */}
            {isDone ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <View style={{ backgroundColor: doneStatus.color + '22', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: doneStatus.color + '45' }}>
                    <Text style={{ fontSize: 10, fontFamily: 'Nunito_900Black', color: doneStatus.color }}>{doneStatus.icon} {doneStatus.label}</Text>
                  </View>
                  {logTimeStr && <Text style={{ fontSize: 10, fontFamily: 'Nunito_600SemiBold', color: 'rgba(255,255,255,0.28)' }}>Logged {logTimeStr}</Text>}
                </View>
                {trackedLine ? <Text numberOfLines={1} style={[cs.streakLine, { color: '#4CD96460' }]}>{trackedLine}</Text> : null}
                <Text numberOfLines={1} style={[cs.streakLine, { color: '#4CD96450' }]}>
                  {streak > 0 ? `🔥 ${streak}d  ·  ` : ''}{monthlyCount}×/mo  ·  {weeklyCount}×/wk
                </Text>
              </>
            ) : (
              <Text numberOfLines={1} style={[cs.streakLine, {
                color: isLocked ? '#2A2A2A' : isLate && !isDone ? '#5A3030' : color + '90',
              }]}>
                {isLocked ? `🔒 Opens ${lockTimeStr ?? 'later'}`
                  : isLate && !isDone ? '❌ Solar slot closed — missed for today'
                    : streak > 0
                      ? `🔥 ${streak}d streak  ·  ${monthlyCount}×/mo  ·  ${weeklyCount}×/wk`
                      : weeklyCount === 0 && monthlyCount === 0
                        ? '📋 Not logged yet — start your streak today!'
                        : `${monthlyCount}×/mo  ·  ${weeklyCount}×/wk`}
              </Text>
            )}

            {/* Previous session when window active */}
            {isWindowActive && lastSessionLine ? (
              <Text numberOfLines={1} style={[cs.lastSessionLine, { color: color + '65' }]}>
                {lastSessionLine}
              </Text>
            ) : null}
          </View>

          {isDone ? (
            <View style={{ alignItems: 'center', gap: 3 }}>
              <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: doneStatus.color + '20', borderWidth: 1.5, borderColor: doneStatus.color + '55', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 16, color: doneStatus.color, fontFamily: 'Nunito_900Black' }}>✓</Text>
              </View>
              {logTimeStr && <Text style={{ fontSize: 9, fontFamily: 'Nunito_700Bold', color: 'rgba(255,255,255,0.25)' }}>{logTimeStr}</Text>}
            </View>
          ) : isLocked ? (
            <Text style={{ fontSize: 13, opacity: 0.2 }}>🔒</Text>
          ) : null}

          {isDone && <View style={[cs.progressBar, { backgroundColor: '#4CD964' }]} />}
        </TouchableOpacity>

        {/* BEGIN + SKIP row — only when window is active */}
        {isWindowActive && (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: -4 }}>
            <TouchableOpacity
              onPress={onBeginTrack}
              activeOpacity={0.82}
              style={[cs.trackBeginBtn, { flex: 1, backgroundColor: btn.color + '20', borderColor: btn.color + '50' }]}
            >
              <Text style={[cs.trackBeginTxt, { color: btn.color }]}>▶  {btn.label}  {btn.emoji}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onLog('skip')} style={cs.skipBtnAlt}>
              <Text style={cs.skipBtnTxt}>⏭</Text>
            </TouchableOpacity>
          </View>
        )}
      </Reanimated.View>
    </GestureDetector>
  );
}

// ─── TYPE 3 — MEAL CARD ───────────────────────────────────────────────────
function MealCard({
  id, emoji, name, color,
  isDone, isLocked, isLate, lockTimeStr, windowLabel, openUntilStr,
  streak = 0, monthlyCount = 0, weeklyCount = 0, lastLog,
  timingStatus, loggedAtMins,
  onLog, onUndo, onDetail, onLongPress,
}: HabitCardProps) {
  const doneStatus = DONE_STATUS[timingStatus ?? 'on_time'] ?? DONE_STATUS.on_time;
  const logTimeStr = loggedAtMins != null ? fmtLogMins(loggedAtMins) : null;
  const tx = useSharedValue(0);

  // Wobble on swipe attempt — no logging via swipe for MEAL
  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12]).failOffsetY([-15, 15])
    .onUpdate(e => { 'worklet'; tx.value = Math.max(-18, Math.min(18, e.translationX * 0.3)); })
    .onEnd(() => { 'worklet'; tx.value = withSpring(0, { damping: 12, stiffness: 400 }); });

  const cardAnim = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));

  // Post-log meal summary
  let mealSummary = '';
  if (isDone && lastLog) {
    const parts: string[] = [];
    if (lastLog.mealDescription) parts.push(lastLog.mealDescription.slice(0, 24));
    if (lastLog.mealSize && MEAL_SIZE_LABEL[lastLog.mealSize]) parts.push(MEAL_SIZE_LABEL[lastLog.mealSize]);
    if (lastLog.postMealFeeling && MEAL_FEEL_LABEL[lastLog.postMealFeeling]) parts.push(MEAL_FEEL_LABEL[lastLog.postMealFeeling]);
    mealSummary = parts.join(' · ');
  }

  // Previous meal for streak line
  let lastMealSnippet = '';
  if (!isDone && lastLog) {
    const parts: string[] = [];
    if (lastLog.mealDescription) parts.push(lastLog.mealDescription.slice(0, 16));
    if (lastLog.mealSize && MEAL_SIZE_LABEL[lastLog.mealSize]) parts.push(MEAL_SIZE_LABEL[lastLog.mealSize]);
    if (parts.length) lastMealSnippet = `Last: ${parts.join(' · ')}`;
  }

  const streakLine = isLocked ? `🔒 Opens ${lockTimeStr ?? 'later'}`
    : isLate && !isDone ? '⏰ Slot closed — tap below to log late meal'
      : isDone
        ? (mealSummary || `🔥 ${streak}d  ·  ${monthlyCount}×/mo  ·  ${weeklyCount}×/wk`)
        : streak > 0
          ? `🔥 ${streak}d  ·  ${monthlyCount}×/mo  ·  ${lastMealSnippet || ''}`
          : weeklyCount === 0 && monthlyCount === 0
            ? '📋 Log your first meal today!'
            : `${monthlyCount}×/mo  ·  ${weeklyCount}×/wk`;

  const isWindowActive = !isDone && !isLocked && !isLate;

  return (
    <GestureDetector gesture={pan}>
      <Reanimated.View style={[cardAnim, { opacity: isLocked ? 0.33 : isLate && !isDone ? 0.55 : 1, marginBottom: 8 }]}>
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={onDetail}
          onLongPress={onLongPress}
          style={[cs.card, isDone && cs.cardDone, isLate && !isDone && cs.cardLate, { paddingBottom: 10 }]}
        >
          <View style={[cs.accentBar, { backgroundColor: isDone ? '#4CD964' : isLate ? '#FF3B30' : color }]} />
          <View style={[cs.iconBox, {
            backgroundColor: isDone ? '#1B3A1F' : color + '22',
            borderColor: isDone ? '#4CD96455' : color + '55',
          }]}>
            <Text style={cs.iconEmoji}>{emoji}</Text>
          </View>
          <View style={cs.textCol}>
            <Text numberOfLines={1} style={[
              cs.habitName,
              isDone && { color: 'rgba(255,255,255,0.55)' },
              isLate && !isDone && { color: '#5A3030' },
              isLocked && { color: '#2C2C2C' },
            ]}>{name}</Text>
            {(windowLabel || (openUntilStr && !isDone && !isLate)) && (
              <View style={{ gap: 1 }}>
                {windowLabel && (
                  <Text numberOfLines={1} style={[cs.windowLabelLine, {
                    color: isDone ? '#4CD96460'
                      : isLate && !isDone ? '#FF950070'
                        : isLocked ? '#2A2A2A'
                          : color + '80',
                  }]}>{windowLabel}</Text>
                )}
                {openUntilStr && !isDone && !isLate && (
                  <Text numberOfLines={1} style={[cs.windowLabelLine, { color: '#ffffff30' }]}>{openUntilStr}</Text>
                )}
              </View>
            )}
            {isDone ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <View style={{ backgroundColor: doneStatus.color + '22', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: doneStatus.color + '45' }}>
                    <Text style={{ fontSize: 10, fontFamily: 'Nunito_900Black', color: doneStatus.color }}>{doneStatus.icon} {doneStatus.label}</Text>
                  </View>
                  {logTimeStr && <Text style={{ fontSize: 10, fontFamily: 'Nunito_600SemiBold', color: 'rgba(255,255,255,0.28)' }}>Logged {logTimeStr}</Text>}
                </View>
                <Text numberOfLines={1} style={[cs.streakLine, { color: '#4CD96450' }]}>{streakLine}</Text>
              </>
            ) : (
              <Text numberOfLines={1} style={[cs.streakLine, {
                color: isLocked ? '#2A2A2A' : isLate && !isDone ? '#5A3030' : color + '90',
              }]}>{streakLine}</Text>
            )}
          </View>
          {isDone ? (
            <View style={{ alignItems: 'center', gap: 3 }}>
              <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: doneStatus.color + '20', borderWidth: 1.5, borderColor: doneStatus.color + '55', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 16, color: doneStatus.color, fontFamily: 'Nunito_900Black' }}>✓</Text>
              </View>
              <TouchableOpacity onPress={onUndo} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={{ fontSize: 9, fontFamily: 'Nunito_700Bold', color: 'rgba(255,255,255,0.22)', letterSpacing: 0.3 }}>UNDO</Text>
              </TouchableOpacity>
            </View>
          ) : isLocked ? (
            <Text style={{ fontSize: 13, opacity: 0.2 }}>🔒</Text>
          ) : null}
          {isDone && <View style={[cs.progressBar, { backgroundColor: '#4CD964' }]} />}
        </TouchableOpacity>

        {/* Dual action buttons when window active */}
        {isWindowActive && (
          <View style={cs.mealBtnRow}>
            <TouchableOpacity
              onPress={() => onLog('sheet')}
              activeOpacity={0.82}
              style={[cs.mealBtn, { flex: 1, backgroundColor: color + '20', borderColor: color + '50' }]}
            >
              <Text style={[cs.mealBtnTxt, { color }]}>🍽  LOG MEAL</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onLog('snap')}
              activeOpacity={0.82}
              style={[cs.mealBtnSnap]}
            >
              <Text style={cs.mealBtnSnapTxt}>📷</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onLog('skip')} style={cs.skipBtnAlt}>
              <Text style={cs.skipBtnTxt}>⏭</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* LOG LATE button when missed */}
        {isLate && !isDone && (
          <TouchableOpacity
            onPress={() => onLog('sheet')}
            activeOpacity={0.82}
            style={[cs.mealBtn, { backgroundColor: '#2A0D0D', borderColor: '#FF3B3035', marginBottom: 0 }]}
          >
            <Text style={[cs.mealBtnTxt, { color: '#FF3B30' }]}>🍽  LOG LATE MEAL</Text>
          </TouchableOpacity>
        )}
      </Reanimated.View>
    </GestureDetector>
  );
}

// ─── Main dispatcher ──────────────────────────────────────────────────────
export function HabitCard(props: HabitCardProps) {
  switch (props.interactionType) {
    case 'TRACK': return <TrackCard {...props} />;
    case 'MEAL': return <MealCard  {...props} />;
    default: return <LogCard   {...props} />;
  }
}

// ─── Shared styles — Ultra iOS Premium ────────────────────────────────────
const cs = StyleSheet.create({
  rowWrap: { marginBottom: 10, borderRadius: 20, overflow: 'hidden' },
  logRevealBg: { backgroundColor: 'rgba(10,32,16,0.92)', justifyContent: 'center', paddingLeft: 28 },
  logRevealTxt: { fontSize: 15, fontWeight: '900', color: '#4CD964', letterSpacing: 0.5 },
  undoRevealBg: { backgroundColor: 'rgba(38,8,8,0.92)', justifyContent: 'center', alignItems: 'flex-end', paddingRight: 28 },
  undoRevealTxt: { fontSize: 15, fontWeight: '900', color: '#FF3B30', letterSpacing: 0.5 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(12,12,22,0.82)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
    paddingHorizontal: 16, paddingVertical: 13,
    minHeight: 72, overflow: 'hidden', position: 'relative',
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  cardDone: {
    backgroundColor: 'rgba(8,28,12,0.88)',
    borderColor: 'rgba(76,217,100,0.28)',
  },
  cardLate: {
    backgroundColor: 'rgba(28,8,8,0.88)',
    borderColor: 'rgba(255,59,48,0.28)',
  },
  accentBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3.5 },
  iconBox: {
    width: 44, height: 44, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 0,
  },
  iconEmoji: { fontSize: 22 },
  textCol: { flex: 1, gap: 3 },
  habitName: { fontSize: 15, fontFamily: 'Nunito_700Bold', color: 'rgba(255,255,255,0.88)', letterSpacing: -0.2 },
  windowLabelLine: { fontSize: 10, fontFamily: 'Nunito_600SemiBold', letterSpacing: 0.1 },
  streakLine: { fontSize: 10, fontFamily: 'Nunito_600SemiBold', opacity: 0.65 },
  lastSessionLine: { fontSize: 11, fontFamily: 'Nunito_600SemiBold', marginTop: 1 },
  doneCheck: { fontSize: 22, flexShrink: 0 },
  latePill: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  latePillTxt: { fontSize: 10, fontFamily: 'Nunito_900Black', color: '#FF3B30', textDecorationLine: 'underline', textAlign: 'center' },
  logBtn: { borderWidth: 0, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 9, backgroundColor: 'rgba(255,255,255,0.13)', flexShrink: 0 },
  logBtnTxt: { fontSize: 12, fontFamily: 'Nunito_900Black', letterSpacing: 1.2 },
  progressBar: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, borderRadius: 20 },
  quickPanel: { backgroundColor: 'rgba(24,24,27,0.88)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', borderRadius: 20, marginBottom: 10 },
  quickOpt: { borderRadius: 999, borderWidth: 1.5, paddingHorizontal: 18, paddingVertical: 11 },
  quickOptTxt: { fontSize: 13, fontFamily: 'Nunito_700Bold' },
  quickCancel: { justifyContent: 'center', paddingHorizontal: 8 },
  quickCancelTxt: { fontSize: 15, color: '#555' },
  // TRACK card
  pulseOuter: { position: 'absolute', top: 11, left: 11, width: 14, height: 14, alignItems: 'center', justifyContent: 'center' },
  pulseDot: { position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: '#4CD964' },
  pulseDotCore: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4CD964' },
  trackBeginBtn: { borderRadius: 22, borderWidth: 1, paddingVertical: 16, alignItems: 'center', marginBottom: 0, marginTop: -4, backgroundColor: 'rgba(255,255,255,0.04)' },
  trackBeginTxt: { fontSize: 13, fontFamily: 'Nunito_900Black', letterSpacing: 0.8 },
  // MEAL card
  mealBtnRow: { flexDirection: 'row', gap: 8, marginTop: -4 },
  mealBtn: { borderRadius: 22, borderWidth: 1.5, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 0 },
  mealBtnTxt: { fontSize: 13, fontFamily: 'Nunito_900Black', letterSpacing: 0.3 },
  mealBtnSnap: { width: 54, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.09)' },
  mealBtnSnapTxt: { fontSize: 20 },
  // SKIP
  skipBtn: { alignItems: 'center', paddingVertical: 9, marginBottom: 4, marginTop: -4 },
  skipBtnAlt: { width: 48, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.07)' },
  skipBtnTxt: { fontSize: 10, color: 'rgba(255,255,255,0.25)', fontWeight: '700', letterSpacing: 0.3 },
});
