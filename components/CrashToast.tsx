import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Animated, TouchableOpacity,
  ScrollView, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ToastLogger, ToastEntry } from '@/lib/toastLogger';

const MAX_TOASTS = 3;
const AUTO_DISMISS_MS = 12_000;
const { width: W } = Dimensions.get('window');

// ─── Single animated toast card ──────────────────────────────────────────────
function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastEntry;
  onDismiss: () => void;
}) {
  const opacity  = useRef(new Animated.Value(0)).current;
  const slideY   = useRef(new Animated.Value(-16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,  { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.timing(slideY,   { toValue: 0, duration: 260, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => dismiss(), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.timing(slideY,  { toValue: -14, duration: 220, useNativeDriver: true }),
    ]).start(onDismiss);
  };

  const isCrash = item.type === 'crash';
  const isWarn  = item.type === 'warn';
  const bg      = isCrash ? '#1C0000' : isWarn ? '#1A1100' : '#100A00';
  const border  = isCrash ? '#ef4444' : isWarn ? '#f59e0b' : '#f97316';
  const tag     = isCrash ? '💥 CRASH' : item.type === 'error' ? '❌ ERROR' : '⚠️  WARN';
  const tagClr  = border;

  return (
    <Animated.View
      style={[
        styles.card,
        { backgroundColor: bg, borderLeftColor: border, opacity, transform: [{ translateY: slideY }] },
      ]}
    >
      {/* Header row */}
      <View style={styles.header}>
        <View style={[styles.tagPill, { borderColor: border + '50', backgroundColor: border + '18' }]}>
          <Text style={[styles.tagText, { color: tagClr }]}>{tag}</Text>
        </View>
        <TouchableOpacity
          onPress={dismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.closeBtn}
        >
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Scrollable message — user can read long stack traces */}
      <ScrollView
        style={styles.msgScroll}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        <Text style={styles.msgText} selectable>
          {item.message}
        </Text>
      </ScrollView>

      {/* Auto-dismiss bar */}
      <AutoDismissBar color={border} durationMs={AUTO_DISMISS_MS} />
    </Animated.View>
  );
}

function AutoDismissBar({ color, durationMs }: { color: string; durationMs: number }) {
  const width = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(width, {
      toValue: 0,
      duration: durationMs,
      useNativeDriver: false,
    }).start();
  }, []);

  return (
    <View style={styles.barBg}>
      <Animated.View style={[styles.barFill, { backgroundColor: color, flex: width }]} />
    </View>
  );
}

// ─── Public component — render once at root level ─────────────────────────────
export function CrashToast() {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    ToastLogger.register(entry => {
      setToasts(prev => {
        const next = [...prev, entry];
        return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next;
      });
    });
    return () => ToastLogger.register(null);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  if (toasts.length === 0) return null;

  return (
    <View
      style={[styles.container, { top: insets.top + 6 }]}
      pointerEvents="box-none"
    >
      {toasts.map(t => (
        <ToastCard key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position:  'absolute',
    left:      12,
    right:     12,
    zIndex:    99999,
    gap:       8,
  },
  card: {
    borderRadius:    14,
    borderLeftWidth: 3,
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.08)',
    overflow:        'hidden',
    shadowColor:     '#000',
    shadowOpacity:   0.55,
    shadowRadius:    12,
    shadowOffset:    { width: 0, height: 4 },
    elevation:       16,
  },
  header: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop:     10,
    paddingBottom:  6,
  },
  tagPill: {
    borderWidth:     1,
    borderRadius:    6,
    paddingHorizontal: 8,
    paddingVertical:   3,
  },
  tagText: {
    fontSize:   9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  closeBtn: {
    width:  28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems:     'center',
    justifyContent: 'center',
  },
  closeText: {
    color:    '#FFFFFF55',
    fontSize: 13,
    lineHeight: 16,
  },
  msgScroll: {
    maxHeight:        120,
    paddingHorizontal: 12,
    marginBottom:     6,
  },
  msgText: {
    fontSize:   11,
    color:      '#FFFFFFCC',
    fontFamily: 'monospace',
    lineHeight: 17,
  },
  barBg: {
    height:         3,
    flexDirection:  'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  barFill: {
    height: 3,
  },
});
