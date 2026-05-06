import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Modal, StyleSheet,
  Animated, Dimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import type { HabitLogEntry } from '@/lib/habitLogs';

// Names aligned with HABIT_LABELS in index.tsx for consistency with Dinacharya page
export const ALL_HABIT_DEFS: Record<string, { emoji: string; name: string; color: string; slot: string; type: 'LOG' | 'TRACK' | 'MEAL' }> = {
  wake_early:      { emoji: '🌙', name: 'Wake Early',            color: '#a78bfa', slot: 'Brahma',  type: 'LOG'   },
  morning_prayer:  { emoji: '🙏', name: 'Prayer',               color: '#fbbf24', slot: 'Brahma',  type: 'LOG'   },
  morning_stretch: { emoji: '🤸', name: 'Stretching',           color: '#34d399', slot: 'Brahma',  type: 'LOG'   },
  warm_water:      { emoji: '💧', name: 'Morning Hydration',     color: '#60a5fa', slot: 'Brahma',  type: 'LOG'   },
  morning_cleanse: { emoji: '🪷', name: 'Morning Cleanse',       color: '#38bdf8', slot: 'Brahma',  type: 'LOG'   },
  meditation:      { emoji: '🧘', name: 'Meditation',            color: '#c084fc', slot: 'Brahma',  type: 'TRACK' },
  morning_walk:    { emoji: '🌄', name: 'Barefoot Morning Walk', color: '#10b981', slot: 'Morning', type: 'TRACK' },
  sunlight:        { emoji: '☀️', name: 'Sunlight',              color: '#fbbf24', slot: 'Morning', type: 'LOG'   },
  breakfast:       { emoji: '🌾', name: 'Breakfast',             color: '#4ade80', slot: 'Morning', type: 'MEAL'  },
  lunch:           { emoji: '🍛', name: 'Main Meal',             color: '#fb923c', slot: 'Midday',  type: 'MEAL'  },
  walk:            { emoji: '🚶', name: 'Shatapavali',           color: '#34d399', slot: 'Midday',  type: 'TRACK' },
  herbal_tea:      { emoji: '🍵', name: 'Herbal Tea',            color: '#84cc16', slot: 'Midday',  type: 'LOG'   },
  evening_walk:    { emoji: '🌆', name: 'Evening Walk',          color: '#f59e0b', slot: 'Evening', type: 'TRACK' },
  dinner:          { emoji: '🥗', name: 'Light Dinner',          color: '#4ade80', slot: 'Evening', type: 'MEAL'  },
  screen_free:     { emoji: '📵', name: 'Screen-free',           color: '#94a3b8', slot: 'Night',   type: 'LOG'   },
  journaling:      { emoji: '📓', name: 'Journaling',            color: '#e879f9', slot: 'Night',   type: 'TRACK' },
  sleep:           { emoji: '🌑', name: 'Sleep 10 PM',           color: '#6366f1', slot: 'Night',   type: 'LOG'   },
};

// Rolling last-7-days status with done/late/missed distinction
function getRolling7(habitId: string, logs: HabitLogEntry[]): Array<{ label: string; isToday: boolean; status: 'done' | 'late' | 'missed' | 'none' }> {
  const now = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const isToday = i === 6;
    const log = logs.find(l => l.habitId === habitId && l.date === dateStr);
    const label = ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()];
    if (log && (log.status === 'done' || log.status === 'partial')) return { label, isToday, status: 'done' as const };
    if (log && log.status === 'late') return { label, isToday, status: 'late' as const };
    if (!isToday) return { label, isToday, status: 'none' as const };
    return { label, isToday, status: 'none' as const };
  });
}

function fmtWin(m: number): string {
  const hh = Math.floor(m / 60) % 24; const mm = m % 60;
  const p = hh >= 12 ? 'PM' : 'AM'; const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  return `${h12}${mm > 0 ? ':' + String(mm).padStart(2, '0') : ''} ${p}`;
}

interface HabitStripProps {
  activeHabitIds: string[];
  currentPhaseHabitIds: string[]; // kept for interface compatibility
  loggedIds: Set<string>;
  streakMap: Record<string, number>;
  recentLogs: HabitLogEntry[];
  phaseColor: string;
  phaseLabel: string;
  windowMap: Record<string, { start: number; end: number }>;
  nowMins: number;
  onLog: (id: string) => void;
  onBeginTrack: (id: string) => void;
  onScanMeal: (id: string) => void;
  onRemove: (id: string) => void;
  onAdd: (ids: string[]) => void;
  onOpenDetail: (id: string) => void;
}

export function HomeHabitStrip({
  activeHabitIds, loggedIds, streakMap, recentLogs,
  phaseColor, phaseLabel, windowMap, nowMins,
  onLog, onBeginTrack, onScanMeal, onRemove, onAdd, onOpenDetail,
}: HabitStripProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState<string | null>(null);
  const scaleAnims = useRef<Record<string, Animated.Value>>({}).current;
  const scrollRef = useRef<ScrollView>(null);
  const hasAutoScrolled = useRef(false);

  const getAnim = (id: string) => {
    if (!scaleAnims[id]) scaleAnims[id] = new Animated.Value(1);
    return scaleAnims[id];
  };

  const animateTap = (id: string, cb: () => void) => {
    const anim = getAnim(id);
    Animated.sequence([
      Animated.spring(anim, { toValue: 0.90, useNativeDriver: true, speed: 40 }),
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 20 }),
    ]).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    cb();
  };

  // ── Categorise habits by time window (this is the core bug fix) ──
  const activeNow: string[] = [];   // in current window, not yet logged
  const doneToday: string[] = [];   // logged today
  const lockedIds: string[] = [];   // future window, not yet open
  const missedIds: string[] = [];   // window closed, not logged

  for (const id of activeHabitIds) {
    const win = windowMap[id];
    if (loggedIds.has(id)) { doneToday.push(id); continue; }
    if (!win) { activeNow.push(id); continue; } // no time restriction → always show as loggable
    if (nowMins < win.start) {
      lockedIds.push(id);
    } else if (nowMins > win.end + 60) {
      missedIds.push(id);
    } else {
      activeNow.push(id);
    }
  }

  // Sort locked by window start ascending (soonest first)
  lockedIds.sort((a, b) => (windowMap[a]?.start ?? 0) - (windowMap[b]?.start ?? 0));

  // ── Chronological scroll: Past (left) → Present (center) → Future (right) ──
  // Past = only logged (done) habits — expired/missed habits are hidden from scroll
  const pastHabits = [...doneToday].sort((a, b) => {
    const wa = windowMap[a]?.start ?? 0;
    const wb = windowMap[b]?.start ?? 0;
    return wa - wb; // earliest window first (leftmost)
  });
  // Present = active now (in current window or no window restriction)
  // Future = locked (window hasn't opened), already sorted by start
  const scrollCards = [...pastHabits, ...activeNow, ...lockedIds];
  const presentStartIdx = pastHabits.length;

  // Auto-scroll to center the present section so past is on left, future on right
  useEffect(() => {
    if (hasAutoScrolled.current || presentStartIdx === 0) return;
    // Compute offset at effect time (stable snapshot for the async callback)
    const screenW = Dimensions.get('window').width;
    const hasPast = pastHabits.length > 0;
    const hasFuture = activeNow.length > 0 || lockedIds.length > 0;
    const dividerW = 36 + 12; // divider width + gap

    // x-position of first active card in content space:
    // 16px left padding + N past cards (each 158+12=170px) + divider+gap (48px if divider exists)
    const pastWidth = presentStartIdx * (CARD_W + 12);
    const contentPadding = 16;
    const firstActiveX = contentPadding + pastWidth + (hasPast && hasFuture ? dividerW : 0);
    // Scroll so first active card is centered: offset = cardX - (screenW - CARD_W) / 2
    let offset = Math.max(0, firstActiveX - (screenW - CARD_W) / 2);

    // Cap so we don't scroll past the end
    const totalWidth = scrollCards.length * (CARD_W + 12) + (hasPast && hasFuture ? dividerW : 0);
    offset = Math.min(offset, Math.max(0, totalWidth - screenW + 32));

    // Delay until layout is stable; set flag only after scroll fires to allow retry if layout not ready
    const t = setTimeout(() => {
      if (!scrollRef.current) return;
      hasAutoScrolled.current = true;
      scrollRef.current.scrollTo({ x: offset, animated: false });
    }, 500);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presentStartIdx]);

  const totalScheduled = activeNow.length + doneToday.length + missedIds.length;
  const doneCount = doneToday.length;

  const availableToAdd = Object.entries(ALL_HABIT_DEFS).filter(([id]) => !activeHabitIds.includes(id));

  const renderActionBtn = (id: string, h: typeof ALL_HABIT_DEFS[string]) => {
    if (h.type === 'TRACK') {
      const label = id === 'morning_walk' ? '🌄  Start Walk'
        : id === 'evening_walk' ? '🌆  Start Walk'
        : id === 'walk' ? '🚶  Begin'
        : id === 'meditation' ? '🧘  Begin'
        : id === 'journaling' ? '📓  Begin'
        : '▶  Begin';
      return (
        <TouchableOpacity
          style={[ss.btnPrimary, { backgroundColor: h.color + '22', borderColor: h.color + '60' }]}
          onPress={() => animateTap(id, () => onBeginTrack(id))} activeOpacity={0.8}
        >
          <Text style={[ss.btnPrimaryTxt, { color: h.color }]}>{label}</Text>
        </TouchableOpacity>
      );
    }
    if (h.type === 'MEAL') {
      return (
        <View style={{ gap: 6 }}>
          <TouchableOpacity
            style={[ss.btnPrimary, { backgroundColor: '#eab30818', borderColor: '#eab30855' }]}
            onPress={() => onScanMeal(id)} activeOpacity={0.8}
          >
            <Text style={[ss.btnPrimaryTxt, { color: '#eab308' }]}>📷  Ayu Scan</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[ss.btnSecondary, { backgroundColor: h.color + '12', borderColor: h.color + '35' }]}
            onPress={() => animateTap(id, () => onLog(id))} activeOpacity={0.8}
          >
            <Text style={[ss.btnSecondaryTxt, { color: h.color + 'cc' }]}>🍽  Log Meal</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <TouchableOpacity
        style={[ss.btnPrimary, { backgroundColor: h.color + '20', borderColor: h.color + '55' }]}
        onPress={() => animateTap(id, () => onLog(id))} activeOpacity={0.8}
      >
        <Text style={[ss.btnPrimaryTxt, { color: h.color }]}>✓  LOG</Text>
      </TouchableOpacity>
    );
  };

  const missedSet = new Set(missedIds);

  const renderCard = (id: string) => {
    const h = ALL_HABIT_DEFS[id];
    if (!h) return null;
    const done = loggedIds.has(id);
    const streak = streakMap[id] ?? 0;
    const anim = getAnim(id);
    const win = windowMap[id];
    const isLocked = !done && !!win && nowMins < win.start;
    const isMissed = missedSet.has(id);
    const rolling7Raw = getRolling7(id, recentLogs);
    // For missed habits, override today's "none" to "missed" so the ✗ shows
    const rolling7 = isMissed
      ? rolling7Raw.map(day => day.isToday && day.status === 'none' ? { ...day, status: 'missed' as const } : day)
      : rolling7Raw;

    return (
      <Animated.View key={id} style={{ transform: [{ scale: anim }] }}>
        <TouchableOpacity
          style={[
            ss.habitCard,
            done && ss.habitCardDone,
            isLocked && ss.habitCardLocked,
            isMissed && ss.habitCardMissed,
            { borderColor: done ? '#4CD96455'
              : isMissed ? 'rgba(239,68,68,0.30)'
              : isLocked ? 'rgba(255,255,255,0.10)'
              : h.color + '55' },
          ]}
          onPress={() => onOpenDetail(id)}
          onLongPress={() => setRemoveConfirm(id)}
          delayLongPress={600}
          activeOpacity={0.80}
        >
          {/* Status badge (top-right) */}
          {done && (
            <View style={ss.doneBadge}>
              <Text style={ss.doneBadgeTxt}>✓</Text>
            </View>
          )}
          {isLocked && (
            <View style={[ss.doneBadge, { backgroundColor: 'rgba(100,100,120,0.55)' }]}>
              <Text style={{ fontSize: 9 }}>🔒</Text>
            </View>
          )}
          {isMissed && (
            <View style={ss.missedCardBadge}>
              <Text style={ss.missedCardBadgeTxt}>✗</Text>
            </View>
          )}

          {/* Emoji + streak row */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <View style={[ss.emojiWrap, {
              backgroundColor: done ? 'rgba(76,217,100,0.10)'
                : isMissed ? 'rgba(239,68,68,0.10)'
                : isLocked ? 'rgba(255,255,255,0.04)'
                : h.color + '18',
            }]}>
              <Text style={ss.habitEmoji}>{isLocked ? '🔒' : h.emoji}</Text>
            </View>
            {streak > 0 && (
              <View style={ss.streakPill}>
                <Text style={{ fontSize: 10 }}>🔥</Text>
                <Text style={ss.streakNum}>{streak}d</Text>
              </View>
            )}
            {streak === 0 && isMissed && (
              <View style={ss.streakPillDim}>
                <Text style={{ fontSize: 9, color: 'rgba(239,68,68,0.50)' }}>0d</Text>
              </View>
            )}
          </View>

          {/* Name */}
          <Text
            style={[
              ss.habitName,
              done && { color: 'rgba(255,255,255,0.40)' },
              isLocked && { color: 'rgba(255,255,255,0.22)' },
              isMissed && { color: 'rgba(255,255,255,0.50)' },
            ]}
            numberOfLines={2}
          >
            {h.name}
          </Text>

          {/* Window time */}
          {win && !done && !isLocked && !isMissed && (
            <Text style={[ss.windowStr, { color: h.color + '80' }]} numberOfLines={1}>
              🕐 {fmtWin(win.start)} – {fmtWin(win.end)}
            </Text>
          )}
          {isMissed && win && (
            <Text style={[ss.windowStr, { color: 'rgba(239,68,68,0.45)' }]} numberOfLines={1}>
              Was {fmtWin(win.start)} – {fmtWin(win.end)}
            </Text>
          )}
          {isLocked && win && (
            <Text style={[ss.windowStr, { color: 'rgba(255,255,255,0.28)' }]} numberOfLines={1}>
              🔒 Opens {fmtWin(win.start)}
            </Text>
          )}

          {/* Rolling 7-day dots with done/late/missed colour coding */}
          <View style={ss.weekRow}>
            {rolling7.map((day, i) => (
              <View key={i} style={{ alignItems: 'center', gap: 3 }}>
                <View style={[
                  ss.dayDot,
                  day.status === 'done' && ss.dotDone,
                  day.status === 'late' && ss.dotLate,
                  day.status === 'missed' && ss.dotMissed,
                  day.isToday && day.status === 'none' && !isMissed && { borderWidth: 1.5, borderColor: h.color + '80' },
                  day.isToday && day.status === 'none' && isMissed && { borderWidth: 1.5, borderColor: 'rgba(239,68,68,0.50)' },
                  day.isToday && day.status === 'done' && { shadowColor: '#4CD964', shadowOpacity: 0.6, shadowRadius: 4 },
                ]}>
                  {day.status === 'done' && <Text style={{ fontSize: 7, color: '#000', fontWeight: '900' }}>✓</Text>}
                  {day.status === 'late' && <Text style={{ fontSize: 7, color: '#fff' }}>⏰</Text>}
                  {day.status === 'missed' && <Text style={{ fontSize: 7, color: '#ef444488' }}>✗</Text>}
                </View>
                <Text style={[ss.dayLabel, day.isToday && !isMissed && { color: h.color + 'cc', fontWeight: '800' }, day.isToday && isMissed && { color: 'rgba(239,68,68,0.55)', fontWeight: '800' }]}>
                  {day.label}
                </Text>
              </View>
            ))}
          </View>

          {/* Action button */}
          {!done && !isLocked && !isMissed && renderActionBtn(id, h)}
          {done && (
            <View style={ss.btnDone}>
              <Text style={ss.btnDoneTxt}>✓  Completed</Text>
            </View>
          )}
          {isLocked && (
            <View style={[ss.btnDone, { borderColor: 'rgba(255,255,255,0.06)' }]}>
              <Text style={[ss.btnDoneTxt, { color: 'rgba(255,255,255,0.20)' }]}>🔒  Not open yet</Text>
            </View>
          )}
          {isMissed && (
            <View style={ss.btnMissed}>
              <Text style={ss.btnMissedTxt}>✗  Missed · View details</Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View>
      {/* ── Daily Wellness Scheduler header ── */}
      <View style={ss.header}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: phaseColor }} />
            <Text style={[ss.sectionLabel, { color: 'rgba(255,255,255,0.88)' }]}>Daily Wellness Scheduler</Text>
          </View>
          <Text style={ss.sectionSub}>
            {phaseLabel}  ·  {doneCount}/{totalScheduled > 0 ? totalScheduled : activeHabitIds.length} done
            {missedIds.length > 0 ? `  ·  ${missedIds.length} missed` : ''}
            {lockedIds.length > 0 ? `  ·  ${lockedIds.length} coming up` : ''}
          </Text>
        </View>
        <TouchableOpacity
          style={[ss.addBtn, { borderColor: phaseColor + '50', backgroundColor: phaseColor + '10' }]}
          onPress={() => setShowAddModal(true)} activeOpacity={0.8}
        >
          <Text style={[ss.addBtnText, { color: phaseColor }]}>Manage</Text>
        </TouchableOpacity>
      </View>

      {/* Sub-label — timeline hint */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 16, marginBottom: 8 }}>
        {pastHabits.length > 0 && (
          <Text style={{ fontSize: 8, fontWeight: '700', color: 'rgba(255,255,255,0.22)', letterSpacing: 0.6 }}>← Past</Text>
        )}
        <Text style={[ss.groupLabel, { marginBottom: 0, paddingHorizontal: 0 },
          activeNow.length > 0 ? { color: phaseColor + 'cc' }
          : doneToday.length > 0 && missedIds.length === 0 && lockedIds.length === 0 ? { color: '#4CD96488' }
          : { color: 'rgba(255,255,255,0.38)' },
        ]}>
          {activeNow.length > 0 ? '🎯  Active Now'
            : doneToday.length > 0 && missedIds.length === 0 && lockedIds.length === 0 ? '✓  All Done'
            : '📊  Your Day'}
        </Text>
        {lockedIds.length > 0 && (
          <Text style={{ fontSize: 8, fontWeight: '700', color: 'rgba(255,255,255,0.22)', letterSpacing: 0.6 }}>Future →</Text>
        )}
      </View>

      {/* ── Chronological scroll: Past → Present → Future ── */}
      {scrollCards.length > 0 ? (
        <ScrollView
          ref={scrollRef}
          horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingVertical: 4, paddingBottom: 8 }}
        >
          {/* Past section (done + missed) */}
          {pastHabits.map(id => renderCard(id))}

          {/* Section divider: Past → Present */}
          {pastHabits.length > 0 && (activeNow.length > 0 || lockedIds.length > 0) && (
            <View key="div-now" style={ss.sectionDivider}>
              <View style={[ss.dividerLine, { backgroundColor: phaseColor + '40' }]} />
              <Text style={[ss.dividerLabel, { color: phaseColor }]}>NOW</Text>
              <View style={[ss.dividerLine, { backgroundColor: phaseColor + '40' }]} />
            </View>
          )}

          {/* Present section (active now) */}
          {activeNow.map(id => renderCard(id))}

          {/* Section divider: Present → Future */}
          {(pastHabits.length > 0 || activeNow.length > 0) && lockedIds.length > 0 && (
            <View key="div-next" style={ss.sectionDivider}>
              <View style={[ss.dividerLine, { backgroundColor: 'rgba(255,255,255,0.12)' }]} />
              <Text style={[ss.dividerLabel, { color: 'rgba(255,255,255,0.28)' }]}>NEXT</Text>
              <View style={[ss.dividerLine, { backgroundColor: 'rgba(255,255,255,0.12)' }]} />
            </View>
          )}

          {/* Future section (locked) */}
          {lockedIds.map(id => renderCard(id))}
        </ScrollView>
      ) : (
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingVertical: 4, paddingBottom: 8 }}
        >
          <TouchableOpacity
            style={[ss.habitCard, ss.emptyCard, { borderColor: phaseColor + '30' }]}
            onPress={() => setShowAddModal(true)}
          >
            <Text style={{ fontSize: 32, marginBottom: 8 }}>+</Text>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
              Add habits for today
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ── Long-press remove modal ── */}
      <Modal visible={removeConfirm !== null} transparent animationType="fade">
        <TouchableOpacity style={ss.removeOverlay} activeOpacity={1} onPress={() => setRemoveConfirm(null)}>
          <View style={ss.removeModal}>
            {removeConfirm && (
              <>
                <Text style={ss.removeEmoji}>{ALL_HABIT_DEFS[removeConfirm]?.emoji}</Text>
                <Text style={ss.removeTitle}>Remove "{ALL_HABIT_DEFS[removeConfirm]?.name}"?</Text>
                <Text style={ss.removeSub}>It won't appear on home screen. Add it back anytime.</Text>
                <TouchableOpacity
                  style={ss.removeConfirmBtn}
                  onPress={() => { onRemove(removeConfirm!); setRemoveConfirm(null); }}
                >
                  <Text style={ss.removeConfirmText}>Remove</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setRemoveConfirm(null)} style={{ paddingVertical: 12 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Add Habit modal ── */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={ss.addModalOverlay}>
          <View style={ss.addModal}>
            <View style={ss.addModalHeader}>
              <Text style={ss.addModalTitle}>Manage Habits</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 22 }}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={ss.addModalSub}>Add or remove habits from your daily schedule</Text>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              {/* ── Active habits with remove ── */}
              <Text style={[ss.slotLabel, { marginTop: 4, marginBottom: 10 }]}>YOUR SCHEDULE</Text>
              {activeHabitIds.length === 0 && (
                <Text style={{ color: 'rgba(255,255,255,0.30)', textAlign: 'center', marginVertical: 12, fontSize: 13 }}>No habits scheduled yet</Text>
              )}
              {activeHabitIds.map(id => {
                const def = ALL_HABIT_DEFS[id];
                if (!def) return null;
                return (
                  <View key={`active-${id}`} style={[ss.addRow, { borderColor: def.color + '35' }]}>
                    <View style={[ss.addEmoji, { backgroundColor: def.color + '20' }]}>
                      <Text style={{ fontSize: 20 }}>{def.emoji}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={ss.addRowName}>{def.name}</Text>
                      <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
                        {def.type === 'TRACK' ? '📍 Trackable' : def.type === 'MEAL' ? '📷 Ayu Scan' : '✓ Simple log'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={{ backgroundColor: 'rgba(244,63,94,0.12)', borderWidth: 1, borderColor: 'rgba(244,63,94,0.35)', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 5 }}
                      onPress={() => { onRemove(id); }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '800', color: '#f43f5e' }}>− Remove</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
              {availableToAdd.length > 0 && <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 16 }} />}
              {availableToAdd.length > 0 && <Text style={[ss.slotLabel, { marginBottom: 10 }]}>ADD MORE</Text>}
              {['Brahma', 'Morning', 'Midday', 'Evening', 'Night'].map(slot => {
                const slotH = availableToAdd.filter(([, def]) => def.slot === slot);
                if (slotH.length === 0) return null;
                return (
                  <View key={slot} style={{ marginBottom: 16 }}>
                    <Text style={ss.slotLabel}>{slot}</Text>
                    {slotH.map(([hid, def]) => (
                      <TouchableOpacity
                        key={hid}
                        style={[ss.addRow, { borderColor: def.color + '35' }]}
                        onPress={() => { onAdd([hid]); setShowAddModal(false); }}
                        activeOpacity={0.8}
                      >
                        <View style={[ss.addEmoji, { backgroundColor: def.color + '20' }]}>
                          <Text style={{ fontSize: 20 }}>{def.emoji}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={ss.addRowName}>{def.name}</Text>
                          <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
                            {def.type === 'TRACK' ? '📍 Trackable' : def.type === 'MEAL' ? '📷 Ayu Scan' : '✓ Simple log'}
                          </Text>
                        </View>
                        <View style={[ss.addPlusBadge, { backgroundColor: def.color + '20', borderColor: def.color + '50' }]}>
                          <Text style={[ss.addPlusText, { color: def.color }]}>+ Add</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                );
              })}
              {availableToAdd.length === 0 && (
                <Text style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 24, fontSize: 14 }}>
                  All habits added ✓
                </Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const CARD_W = 158;

const ss = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, marginBottom: 10,
  },
  sectionLabel: { fontSize: 12, fontWeight: '900', letterSpacing: 1.6, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  sectionSub: { fontSize: 9.5, color: 'rgba(255,255,255,0.36)', marginTop: 2, textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  addBtn: { borderWidth: 1, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 7 },
  addBtnText: { fontSize: 12, fontWeight: '800' },
  groupLabel: {
    fontSize: 9, fontWeight: '900', letterSpacing: 1.4,
    paddingHorizontal: 16, marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  habitCard: {
    width: CARD_W, borderRadius: 22, borderWidth: 1,
    backgroundColor: 'rgba(12,12,22,0.84)',
    padding: 14, gap: 10,
    minHeight: 218,
    position: 'relative',
    shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  habitCardDone: { backgroundColor: 'rgba(8,26,12,0.88)' },
  habitCardMissed: { backgroundColor: 'rgba(28,8,10,0.88)' },
  habitCardLocked: { opacity: 0.36 },
  emptyCard: { alignItems: 'center', justifyContent: 'center', opacity: 0.5 },
  sectionDivider: { alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 2, width: 36 },
  dividerLine: { width: 1.5, height: 32, borderRadius: 1 },
  dividerLabel: { fontSize: 7, fontWeight: '900', letterSpacing: 1.2 },
  doneBadge: {
    position: 'absolute', top: 10, right: 10,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#4CD964', alignItems: 'center', justifyContent: 'center',
  },
  doneBadgeTxt: { fontSize: 12, fontWeight: '900', color: '#000' },
  emojiWrap: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  habitEmoji: { fontSize: 22 },
  habitName: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.88)', lineHeight: 18 },
  windowStr: { fontSize: 10, fontWeight: '600', letterSpacing: 0.2 },
  streakPill: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2, backgroundColor: 'rgba(245,158,11,0.10)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  streakPillDim: { marginTop: 2, backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  streakNum: { fontSize: 11, fontWeight: '900', color: '#F59E0B' },
  missedCardBadge: {
    position: 'absolute', top: 10, right: 10,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(239,68,68,0.75)', alignItems: 'center', justifyContent: 'center',
  },
  missedCardBadgeTxt: { fontSize: 12, fontWeight: '900', color: '#fff' },
  btnMissed: {
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.22)', borderRadius: 12,
    paddingVertical: 9, alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.07)',
  },
  btnMissedTxt: { fontSize: 11, fontWeight: '800', color: 'rgba(239,68,68,0.60)' },
  // Rolling 7-day dots
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 },
  dayDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
  dotDone: { backgroundColor: 'rgba(76,217,100,0.75)' },
  dotLate: { backgroundColor: 'rgba(245,158,11,0.60)' },
  dotMissed: { backgroundColor: 'rgba(239,68,68,0.18)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.30)' },
  dayLabel: { fontSize: 8, fontWeight: '600', color: 'rgba(255,255,255,0.25)', letterSpacing: 0.2 },
  // Action buttons
  btnPrimary: {
    borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 10,
    alignItems: 'center',
  },
  btnPrimaryTxt: { fontSize: 12, fontWeight: '900', letterSpacing: 0.3 },
  btnSecondary: {
    borderWidth: 1, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10,
    alignItems: 'center',
  },
  btnSecondaryTxt: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
  btnDone: {
    borderWidth: 1, borderColor: 'rgba(76,217,100,0.22)', borderRadius: 12,
    paddingVertical: 9, alignItems: 'center',
    backgroundColor: 'rgba(76,217,100,0.07)',
  },
  btnDoneTxt: { fontSize: 11, fontWeight: '800', color: '#4CD96470' },
  // Remove modal
  removeOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', alignItems: 'center', justifyContent: 'center' },
  removeModal: {
    backgroundColor: '#111122', borderRadius: 24, padding: 28, margin: 24,
    alignItems: 'center', gap: 10, width: 300,
  },
  removeEmoji: { fontSize: 40 },
  removeTitle: { fontSize: 18, fontWeight: '900', color: '#fff', textAlign: 'center' },
  removeSub: { fontSize: 13, color: 'rgba(255,255,255,0.45)', textAlign: 'center', lineHeight: 19 },
  removeConfirmBtn: {
    backgroundColor: '#f43f5e', borderRadius: 99, paddingHorizontal: 28, paddingVertical: 13, marginTop: 6,
  },
  removeConfirmText: { fontSize: 15, fontWeight: '900', color: '#fff' },
  // Add modal
  addModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.82)', justifyContent: 'flex-end' },
  addModal: {
    backgroundColor: '#0D0D1A', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, maxHeight: '85%',
  },
  addModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  addModalTitle: { fontSize: 20, fontWeight: '900', color: '#fff' },
  addModalSub: { fontSize: 13, color: 'rgba(255,255,255,0.40)', marginBottom: 20 },
  slotLabel: { fontSize: 10, fontWeight: '900', color: 'rgba(255,255,255,0.35)', letterSpacing: 1.8, marginBottom: 8, marginTop: 8 },
  addRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8,
  },
  addEmoji: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  addRowName: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },
  addPlusBadge: { borderWidth: 1, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 5 },
  addPlusText: { fontSize: 12, fontWeight: '800' },
});
