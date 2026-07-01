import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Animated, TouchableOpacity,
  ScrollView, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ToastLogger, ToastEntry } from '@/lib/toastLogger';

const MAX_TOASTS     = 6;    // Allow more since info toasts are expected
const AUTO_DISMISS_MS = 12_000;
const INFO_DISMISS_MS = 8_000;
const { width: W }  = Dimensions.get('window');

// ─── Toast config per type ────────────────────────────────────────────────────
function getToastStyle(type: ToastEntry['type']) {
  switch (type) {
    case 'crash': return { bg: '#1C0000', border: '#ef4444', tag: '💥 CRASH',  tagClr: '#ef4444' };
    case 'error': return { bg: '#100A00', border: '#f97316', tag: '❌ ERROR',  tagClr: '#f97316' };
    case 'warn':  return { bg: '#1A1100', border: '#f59e0b', tag: '⚠️ WARN',   tagClr: '#f59e0b' };
    case 'info':  return { bg: '#001A10', border: '#34d399', tag: '📡 INFO',   tagClr: '#34d399' };
    case 'debug': return { bg: '#000D1A', border: '#60a5fa', tag: '🔍 DEBUG',  tagClr: '#60a5fa' };
  }
}

// ─── Single animated toast card ───────────────────────────────────────────────
function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastEntry;
  onDismiss: () => void;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const slideY  = useRef(new Animated.Value(-16)).current;
  const style   = getToastStyle(item.type);
  const dismissMs = (item.type === 'info' || item.type === 'debug') ? INFO_DISMISS_MS : AUTO_DISMISS_MS;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.timing(slideY,  { toValue: 0, duration: 260, useNativeDriver: true }),
    ]).start();
    const timer = setTimeout(() => dismiss(), dismissMs);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.timing(slideY,  { toValue: -14, duration: 220, useNativeDriver: true }),
    ]).start(onDismiss);
  };

  return (
    <Animated.View
      style={[
        styles.card,
        { backgroundColor: style.bg, borderLeftColor: style.border, opacity, transform: [{ translateY: slideY }] },
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.tagPill, { borderColor: style.border + '50', backgroundColor: style.border + '18' }]}>
          <Text style={[styles.tagText, { color: style.tagClr }]}>{style.tag}</Text>
        </View>
        {/* Timestamp */}
        <Text style={[styles.tsText, { color: style.border + 'AA' }]}>{item.timestamp}</Text>
        <TouchableOpacity
          onPress={dismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.closeBtn}
        >
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.msgScroll}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        <Text style={styles.msgText} selectable>
          {item.message}
        </Text>
      </ScrollView>

      <AutoDismissBar color={style.border} durationMs={dismissMs} />
    </Animated.View>
  );
}

function AutoDismissBar({ color, durationMs }: { color: string; durationMs: number }) {
  const width = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(width, { toValue: 0, duration: durationMs, useNativeDriver: false }).start();
  }, []);
  return (
    <View style={styles.barBg}>
      <Animated.View style={[styles.barFill, { backgroundColor: color, flex: width }]} />
    </View>
  );
}

// ─── Floating debug toggle button ─────────────────────────────────────────────
function DebugToggleBtn({ onPress, count }: { onPress: () => void; count: number }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.debugToggleBtn} activeOpacity={0.8}>
      <Text style={styles.debugToggleTxt}>🔍{count > 0 ? ` ${count}` : ''}</Text>
    </TouchableOpacity>
  );
}

// ─── Public component — render once at root level ─────────────────────────────
export function CrashToast() {
  const [toasts,    setToasts]    = useState<ToastEntry[]>([]);
  const [showDebug, setShowDebug] = useState(false); // Default to off in production
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

  // Split toasts: critical (always shown) vs info/debug (toggleable)
  const criticalToasts = toasts.filter(t => t.type === 'crash' || t.type === 'error' || t.type === 'warn');
  const infoToasts     = toasts.filter(t => t.type === 'info'  || t.type === 'debug');
  const visibleToasts  = showDebug ? toasts : criticalToasts;
  const hiddenCount    = showDebug ? 0 : infoToasts.length;

  return (
    <>
      {/* Toasts column */}
      {visibleToasts.length > 0 && (
        <View
          style={[styles.container, { top: insets.top + 6 }]}
          pointerEvents="box-none"
        >
          {visibleToasts.map(t => (
            <ToastCard key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
          ))}
        </View>
      )}

      {/* Debug toggle button — tap to show/hide info toasts */}
      {(infoToasts.length > 0 || hiddenCount > 0) && (
        <DebugToggleBtn
          onPress={() => setShowDebug(v => !v)}
          count={hiddenCount}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left:     12,
    right:    12,
    zIndex:   99999,
    gap:      8,
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
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 12,
    paddingTop:        10,
    paddingBottom:     6,
    gap:               6,
  },
  tagPill: {
    borderWidth:       1,
    borderRadius:      6,
    paddingHorizontal: 8,
    paddingVertical:   3,
  },
  tagText: {
    fontSize:     9,
    fontWeight:  '900',
    letterSpacing: 1.2,
  },
  tsText: {
    fontSize:  9,
    fontWeight: '700',
    flex:       1,
    marginLeft: 4,
  },
  closeBtn: {
    width:           28,
    height:          28,
    borderRadius:    14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  closeText: {
    color:      '#FFFFFF55',
    fontSize:   13,
    lineHeight: 16,
  },
  msgScroll: {
    maxHeight:         80,
    paddingHorizontal: 12,
    marginBottom:      6,
  },
  msgText: {
    fontSize:   11,
    color:      '#FFFFFFCC',
    fontFamily: 'monospace',
    lineHeight: 17,
  },
  barBg: {
    height:          3,
    flexDirection:   'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  barFill: {
    height: 3,
  },
  // Debug toggle button (bottom-right floating)
  debugToggleBtn: {
    position:        'absolute',
    bottom:          90,
    right:           14,
    zIndex:          99998,
    backgroundColor: 'rgba(0,20,10,0.82)',
    borderRadius:    20,
    borderWidth:     1,
    borderColor:     'rgba(52,211,153,0.40)',
    paddingHorizontal: 12,
    paddingVertical:   7,
    elevation:       12,
  },
  debugToggleTxt: {
    fontSize:   11,
    fontWeight: '800',
    color:      '#34d399',
  },
});
