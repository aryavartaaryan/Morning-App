/**
 * step-session.tsx — Active Walk Session Screen
 * ─────────────────────────────────────────────────────────────────────────────
 * Full-screen immersive session tracker.
 * - Giant live step count with spring animation on each step
 * - Circular progress arc (SVG, animated strokeDashoffset)
 * - Live distance / time / pace / calories row
 * - Pause and End buttons
 * - Back press → confirmation dialog
 * - Post-meal 100-step completion → canvas confetti celebration overlay
 *
 * All sensor work is inside StepCounterService.kt — this screen only
 * subscribes to 'NativeStepUpdate' events and displays the result.
 */

import React, {
  useState, useEffect, useRef, useCallback,
} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Dimensions,
  Animated,
  Easing,
  BackHandler,
  Alert,
  ToastAndroid,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgGrad,
  Stop,
} from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

import StepCounter, { type SessionType } from '@/src/modules/StepCounter';
import { useSoundPlayer } from '@/lib/soundPlayerContext';
import SoundLibraryModal from '@/components/SoundLibraryModal';
import { ALL_SOUNDS_LIST } from '@/app/(tabs)/sleep';

const { width: W, height: H } = Dimensions.get('window');

// ── Design tokens ─────────────────────────────────────────────────────────────
const BG = '#070710';

// ── Ring geometry ─────────────────────────────────────────────────────────────
const RING_SZ = 210;
const STROKE  = 14;
const R       = (RING_SZ - STROKE) / 2;
const CIRCUM  = 2 * Math.PI * R;

// ── Session meta ──────────────────────────────────────────────────────────────
const SESSION_META: Record<
  SessionType,
  { label: string; emoji: string; color: string; goal: number; bgTop: string }
> = {
  morning:  { label: 'Morning Walk',   emoji: '🌅', color: '#34D399', goal: 3000, bgTop: '#0A1A12' },
  evening:  { label: 'Evening Walk',   emoji: '🌆', color: '#F472B6', goal: 3000, bgTop: '#1A0A12' },
  postmeal: { label: 'Post-meal Walk', emoji: '🍽️', color: '#FB923C', goal: 100,  bgTop: '#1A0E08' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function StepSessionScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sessionType } = useLocalSearchParams<{ sessionType?: string }>();

  const type = (sessionType as SessionType | undefined) ?? 'morning';
  let meta = SESSION_META[type] ?? SESSION_META.morning;
  
  // Apply dynamic time-based label if it's the main walk during midday
  if (type === 'morning') {
    const hour = new Date().getHours();
    if (hour >= 12 && hour < 17) {
      meta = { ...meta, label: 'Walk', emoji: '☀️' };
    }
  }

  const C = meta.color;

  // ── State ──────────────────────────────────────────────────────────────────
  const [steps,    setSteps]    = useState(0);
  const [elapsed,  setElapsed]  = useState(0);
  const [paused,   setPaused]   = useState(false);
  const [done,     setDone]     = useState(false);
  const [confetti, setConfetti] = useState(false);
  // Drives SVG strokeDashoffset without createAnimatedComponent (avoids stopTracking crash)
  const [progressDashOffset, setProgressDashOffset] = useState(CIRCUM);

  // Sound Integration
  const { playingId, isPaused, togglePause, stopSound, playSound } = useSoundPlayer();
  const [isSoundModalVisible, setIsSoundModalVisible] = useState(false);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const pausedRef    = useRef(false);
  const startMsRef   = useRef(Date.now());
  const pausedMsRef  = useRef(0);
  const pausedAtRef  = useRef(0);
  const doneRef      = useRef(false);
  const lastUpdateRef = useRef(0);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Animations ─────────────────────────────────────────────────────────────
  const stepBounce   = useRef(new Animated.Value(1)).current;
  const pulseAnim    = useRef(new Animated.Value(1)).current;
  const rippleScale  = useRef(new Animated.Value(0)).current;
  const rippleOp     = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const confettiOp   = useRef(new Animated.Value(0)).current;
  const fadeIn       = useRef(new Animated.Value(0)).current;
  const slideUp      = useRef(new Animated.Value(40)).current;
  const pauseScale   = useRef(new Animated.Value(1)).current;
  
  // Sci-fi ring rotations
  const rot1 = useRef(new Animated.Value(0)).current;
  const rot2 = useRef(new Animated.Value(0)).current;
  const rot3 = useRef(new Animated.Value(0)).current;

  // Confetti particles (stable refs)
  const PARTICLE_COUNT = 32;
  const particlesX   = useRef(Array.from({ length: PARTICLE_COUNT }, () => new Animated.Value(0))).current;
  const particlesY   = useRef(Array.from({ length: PARTICLE_COUNT }, () => new Animated.Value(0))).current;
  const particlesOp  = useRef(Array.from({ length: PARTICLE_COUNT }, () => new Animated.Value(0))).current;
  const particlesScl = useRef(Array.from({ length: PARTICLE_COUNT }, () => new Animated.Value(0))).current;
  const PARTICLE_COLORS = ['#34D399','#F472B6','#FB923C','#A78BFA','#FCD34D','#2DD4BF'];
  const PARTICLE_ANGLES = Array.from({ length: PARTICLE_COUNT }, (_, i) => (i / PARTICLE_COUNT) * Math.PI * 2);
  const PARTICLE_DISTS  = Array.from({ length: PARTICLE_COUNT }, (_, i) => 70 + (i % 5) * 28);

  // ── Boot ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.00, duration: 1500, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(Animated.timing(rot1, { toValue: 1, duration: 20000, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(rot2, { toValue: 1, duration: 25000, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(rot3, { toValue: 1, duration: 12000, easing: Easing.linear, useNativeDriver: true })).start();

    (async () => {
      const result = await StepCounter.startSession(type);
      startMsRef.current = result.startTime;

      // ── Diagnostic Toast: which sensor is powering this session? ─────────────
      // Fires 1.5s after start so the native service has time to register sensors.
      if (Platform.OS === 'android') {
        setTimeout(async () => {
          const src = await StepCounter.getSensorSource();
          let msg: string;
          if (src === 'STEP_DETECTOR') {
            msg = '✅ Pedometer active — real-time, 1 step = 1 update';
          } else if (src === 'STEP_COUNTER') {
            msg = '⚠️ Batched pedometer — steps may arrive in small bursts';
          } else {
            msg = '❌ No step sensor found on this device';
          }
          ToastAndroid.showWithGravityAndOffset(
            msg, ToastAndroid.LONG, ToastAndroid.BOTTOM, 0, 120,
          );
        }, 1500);
      }
      // ────────────────────────────────────────────────────────────────────────

      Animated.parallel([
        Animated.timing(fadeIn,  { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(slideUp, { toValue: 0, duration: 500, easing: Easing.out(Easing.exp), useNativeDriver: true }),
      ]).start();

      timerRef.current = setInterval(() => {
        if (!pausedRef.current) {
          setElapsed(Math.round((Date.now() - startMsRef.current - pausedMsRef.current) / 1000));
        }
      }, 1000);
    })();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ── Step event subscription ────────────────────────────────────────────────
  useEffect(() => {
    const sub = StepCounter.onStep((total) => {
      if (pausedRef.current || doneRef.current) return;

      // 1. Run ultra-cheap native animations immediately (zero JS lag)
      Animated.sequence([
        Animated.spring(stepBounce, { toValue: 1.16, useNativeDriver: true, speed: 60, bounciness: 14 }),
        Animated.spring(stepBounce, { toValue: 1.00, useNativeDriver: true, speed: 40, bounciness: 4  }),
      ]).start();

      rippleScale.setValue(0);
      rippleOp.setValue(0.55);
      Animated.parallel([
        Animated.timing(rippleScale, { toValue: 1, duration: 750, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(rippleOp,   { toValue: 0, duration: 750, useNativeDriver: true }),
      ]).start();

      if (total % 10 === 0) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      if (type === 'postmeal' && total >= 100 && !doneRef.current) {
        doneRef.current = true;
        launchConfetti();
      }

      // 2. Throttle the heavy React re-render (setSteps / setProgressDashOffset)
      const now = Date.now();
      const syncState = () => {
        setSteps(total);
        setProgressDashOffset(CIRCUM - Math.min(1, total / meta.goal) * CIRCUM);
        lastUpdateRef.current = Date.now();
      };

      if (now - lastUpdateRef.current > 1000) {
        if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
        syncState();
      } else {
        if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = setTimeout(syncState, 1000 - (now - lastUpdateRef.current));
      }
    });

    return () => {
      sub.remove();
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, []);

  // ── Minimize Session ───────────────────────────────────────────────────────
  const minimizeSession = useCallback(() => {
    Haptics.selectionAsync();
    router.back();
  }, []);

  // ── Hardware back button ───────────────────────────────────────────────────
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      minimizeSession();
      return true;
    });
    return () => handler.remove();
  }, [minimizeSession]);

  // ── Confetti ───────────────────────────────────────────────────────────────
  const launchConfetti = useCallback(() => {
    setConfetti(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 200);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 500);

    Animated.timing(confettiOp, { toValue: 1, duration: 300, useNativeDriver: true }).start();

    particlesX.forEach((_, i) => {
      const angle = PARTICLE_ANGLES[i];
      const dist  = PARTICLE_DISTS[i];
      particlesX[i].setValue(0);
      particlesY[i].setValue(0);
      particlesOp[i].setValue(1);
      particlesScl[i].setValue(0);

      Animated.parallel([
        Animated.timing(particlesX[i],  { toValue: Math.cos(angle) * dist, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(particlesY[i],  { toValue: Math.sin(angle) * dist, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(particlesOp[i], { toValue: 0, duration: 900, useNativeDriver: true }),
        Animated.spring(particlesScl[i], { toValue: 1.4, useNativeDriver: true, speed: 30 }),
      ]).start();
    });

    setTimeout(() => endSession(), 3000);
  }, []);

  // ── Pause / Resume ─────────────────────────────────────────────────────────
  const toggleSessionPause = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.spring(pauseScale, { toValue: 0.94, useNativeDriver: true, speed: 60 }).start(() => {
      Animated.spring(pauseScale, { toValue: 1.00, useNativeDriver: true, speed: 40 }).start();
    });

    if (!pausedRef.current) {
      pausedRef.current  = true;
      pausedAtRef.current = Date.now();
      setPaused(true);
    } else {
      pausedMsRef.current += Date.now() - pausedAtRef.current;
      pausedRef.current  = false;
      setPaused(false);
    }
  };

  // ── End session ────────────────────────────────────────────────────────────
  const endSession = useCallback(async () => {
    doneRef.current = true;
    setDone(true);
    if (timerRef.current) clearInterval(timerRef.current);
    await StepCounter.endSession();
    await StepCounter.snapshotTodayToHistory();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  }, []);

  const confirmEnd = () => {
    if (doneRef.current) return;
    Alert.alert(
      'End Session?',
      'Your steps will be saved.',
      [
        { text: 'Keep Walking', style: 'cancel' },
        { text: 'End Session', style: 'destructive', onPress: endSession },
      ]
    );
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const pct      = Math.min(1, steps / meta.goal);
  const distKm   = StepCounter.stepsToKm(steps);
  const calories = StepCounter.stepsToCal(steps);
  const pace     = elapsed > 30 && distKm > 0.01
    ? (() => {
        const minsPerKm = (elapsed / 60) / distKm;
        const m = Math.floor(minsPerKm);
        const s = Math.round((minsPerKm - m) * 60);
        return `${m}'${String(s).padStart(2,'0')}"`;
      })()
    : '--';

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Background */}
      <LinearGradient colors={[meta.bgTop, BG, BG]} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFillObject} />

      {/* Ripple ring */}
      <Animated.View
        style={[
          s.ripple,
          {
            borderColor: C + '55',
            opacity:     rippleOp,
            transform:   [{
              scale: rippleScale.interpolate({ inputRange: [0,1], outputRange: [0.4, 3.2] }),
            }],
          },
        ]}
        pointerEvents="none"
      />

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <Animated.View
        style={[s.header, { paddingTop: insets.top + 8, opacity: fadeIn, transform: [{ translateY: slideUp }] }]}
      >
        <TouchableOpacity onPress={confirmEnd} style={s.closeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={s.closeTxt}>✕</Text>
        </TouchableOpacity>

        <View style={{ alignItems: 'center' }}>
          <Text style={s.headerEmoji}>{meta.emoji}</Text>
          <Text style={[s.headerLabel, { color: C }]}>{meta.label}</Text>
        </View>

        <View style={s.statusPill}>
          {paused ? (
            <Text style={s.pausedBadge}>PAUSED</Text>
          ) : (
            <View style={[s.liveDot, { backgroundColor: C }]} />
          )}
        </View>
      </Animated.View>

      {/* ── BODY ────────────────────────────────────────────────────────────── */}
      <Animated.View style={[s.body, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>

        {/* Minimize Button */}
        <TouchableOpacity 
          style={{ position: 'absolute', top: insets.top + 16, left: 24, zIndex: 10, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' }}
          onPress={minimizeSession}
        >
          <Ionicons name="chevron-down" size={24} color="#fff" />
        </TouchableOpacity>

        {/* Premium Quick Hints Column (Zero clutter, ultra smart) */}
        <View style={{ alignItems: 'center', gap: 8, marginBottom: 20, paddingHorizontal: 16 }}>
          {/* Headphone Hint */}
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(56,189,248,0.12)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(56,189,248,0.2)' }}>
            <Ionicons name="headset" size={12} color="#38bdf8" style={{ marginRight: 6 }} />
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#bae6fd', letterSpacing: 0.2 }}>Use headphones for Naad Audio</Text>
          </View>
          {/* Barefoot Hint */}
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(52,211,153,0.12)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(52,211,153,0.2)' }}>
            <Ionicons name="footsteps" size={12} color="#34d399" style={{ marginRight: 6 }} />
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#a7f3d0', letterSpacing: 0.2 }}>Barefoot only in good weather on clean, natural earth</Text>
          </View>
        </View>

        {/* ── ULTRA-PREMIUM SCI-FI RING ────────────────────────────────────────────── */}
        <View style={s.ringWrapper}>
          {/* Outer glowing pulsing base */}
          <Animated.View style={{ position: 'absolute', width: RING_SZ + 60, height: RING_SZ + 60, borderRadius: (RING_SZ + 60) / 2, backgroundColor: C, opacity: pulseAnim.interpolate({ inputRange: [1, 1.12], outputRange: [0.03, 0.08] }), transform: [{ scale: pulseAnim }], top: -30, left: -30 }} />
          <Animated.View style={{ position: 'absolute', width: RING_SZ + 30, height: RING_SZ + 30, borderRadius: (RING_SZ + 30) / 2, backgroundColor: C, opacity: pulseAnim.interpolate({ inputRange: [1, 1.12], outputRange: [0.06, 0.12] }), transform: [{ scale: pulseAnim }], top: -15, left: -15 }} />

          {/* Core ring */}
          <Svg
            width={RING_SZ}
            height={RING_SZ}
            style={{ transform: [{ rotate: '-90deg' }] }}
          >
            <Defs>
              <SvgGrad id="sessGrad" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={C} stopOpacity="1" />
                <Stop offset="0.5" stopColor="#ffffff" stopOpacity="0.8" />
                <Stop offset="1" stopColor={C} stopOpacity="1" />
              </SvgGrad>
            </Defs>

            {/* Dark background track */}
            <Circle cx={RING_SZ / 2} cy={RING_SZ / 2} r={R} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth={STROKE} />
            
            {/* Main neon arc */}
            <Circle cx={RING_SZ / 2} cy={RING_SZ / 2} r={R} fill="none" stroke="url(#sessGrad)" strokeWidth={STROKE} strokeLinecap="round" strokeDasharray={CIRCUM} strokeDashoffset={progressDashOffset} opacity={1} />
            
            {/* Core inner glow */}
            <Circle cx={RING_SZ / 2} cy={RING_SZ / 2} r={R} fill="none" stroke={C} strokeWidth={STROKE + 8} strokeDasharray={CIRCUM} strokeDashoffset={progressDashOffset} opacity={0.3} />
          </Svg>

          {/* Rotating Outer Dashed HUD */}
          <Animated.View style={{ position: 'absolute', width: RING_SZ, height: RING_SZ, transform: [{ rotate: rot1.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
            <Svg width={RING_SZ} height={RING_SZ} viewBox={`0 0 ${RING_SZ} ${RING_SZ}`}>
              <Circle cx={RING_SZ / 2} cy={RING_SZ / 2} r={R + 18} stroke={C} strokeWidth={1.5} fill="none" strokeDasharray="2 14" opacity={0.6} />
              <Circle cx={RING_SZ / 2} cy={RING_SZ / 2} r={R + 18} stroke="#ffffff" strokeWidth={2} fill="none" strokeDasharray="1 40" opacity={0.8} />
            </Svg>
          </Animated.View>

          {/* Rotating Inner HUD 1 (Opposite) */}
          <Animated.View style={{ position: 'absolute', width: RING_SZ, height: RING_SZ, transform: [{ rotate: rot2.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] }) }] }}>
            <Svg width={RING_SZ} height={RING_SZ} viewBox={`0 0 ${RING_SZ} ${RING_SZ}`}>
              <Circle cx={RING_SZ / 2} cy={RING_SZ / 2} r={R - 16} stroke={C} strokeWidth={1.5} fill="none" strokeDasharray="10 20" opacity={0.4} />
              <Circle cx={RING_SZ / 2} cy={RING_SZ / 2} r={R - 16} stroke="#ffffff" strokeWidth={2.5} fill="none" strokeDasharray="0.5 45" opacity={0.9} strokeLinecap="round" />
            </Svg>
          </Animated.View>

          {/* Rotating Inner HUD 2 (Fast scanning) */}
          <Animated.View style={{ position: 'absolute', width: RING_SZ, height: RING_SZ, transform: [{ rotate: rot3.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
            <Svg width={RING_SZ} height={RING_SZ} viewBox={`0 0 ${RING_SZ} ${RING_SZ}`}>
              <Circle cx={RING_SZ / 2} cy={RING_SZ / 2} r={R - 26} stroke={C} strokeWidth={1} fill="none" strokeDasharray="2 12" opacity={0.25} />
              <Circle cx={RING_SZ / 2} cy={RING_SZ / 2} r={R - 26} stroke="#ffffff" strokeWidth={1} fill="none" strokeDasharray="10 200" opacity={0.5} />
            </Svg>
          </Animated.View>

          {/* Centre content */}
          <View style={[s.centreBox, { gap: 2 }]}>
            <View style={{ alignItems: 'center' }}>
              <Animated.Text style={[s.bigSteps, { fontSize: playingId ? 46 : 56, lineHeight: playingId ? 52 : 62, color: C, transform: [{ scale: stepBounce }] }]}>
                {steps.toLocaleString()}
              </Animated.Text>
              <Text style={[s.bigStepsUnit, playingId && { fontSize: 11 }]}>STEPS</Text>
            </View>
            
            {!playingId && (
              <View style={[s.goalChip, { backgroundColor: C + '18', borderColor: C + '35' }]}>
                <Text style={[s.goalChipTxt, { color: C }]}>
                  {Math.min(100, Math.round(pct * 100))}% · {meta.goal.toLocaleString()} goal
                </Text>
              </View>
            )}

            {/* Ultra-Smart Sound Controls */}
            <View style={{ marginTop: playingId ? 4 : 8 }}>
              {!playingId ? (
                <TouchableOpacity 
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setIsSoundModalVisible(true); }}
                  activeOpacity={0.8}
                >
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                    paddingHorizontal: 16, paddingVertical: 8,
                    borderRadius: 20,
                    backgroundColor: 'rgba(56,189,248,0.12)',
                    borderWidth: 1, borderColor: 'rgba(56,189,248,0.3)',
                  }}>
                    <Ionicons name="musical-notes" size={14} color="#38bdf8" style={{ marginRight: 6 }} />
                    <Text style={{ color: '#38bdf8', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }}>SELECT SOUND</Text>
                  </View>
                </TouchableOpacity>
              ) : (
                <View style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  backgroundColor: 'rgba(0,0,0,0.45)',
                  borderWidth: 1, borderColor: 'rgba(56,189,248,0.4)',
                  paddingHorizontal: 12, paddingVertical: 6,
                  borderRadius: 24, gap: 14,
                  shadowColor: '#38bdf8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10,
                  elevation: 5,
                }}>
                  <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); stopSound(); }} style={{ padding: 4 }}>
                    <Ionicons name="stop" size={14} color="rgba(255,255,255,0.45)" />
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); togglePause(); }} 
                    style={{ 
                      width: 38, height: 38, borderRadius: 19, 
                      backgroundColor: 'rgba(56,189,248,0.2)', 
                      borderWidth: 1, borderColor: 'rgba(56,189,248,0.5)',
                      alignItems: 'center', justifyContent: 'center' 
                    }}
                  >
                    <Ionicons name={isPaused ? "play" : "pause"} size={18} color="#FFF" style={isPaused ? { marginLeft: 2 } : {}} />
                  </TouchableOpacity>
                  
                  <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setIsSoundModalVisible(true); }} style={{ padding: 4 }}>
                    <Ionicons name="list" size={16} color="rgba(255,255,255,0.8)" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Timer */}
        <Text style={[s.timer, paused && { color: 'rgba(255,255,255,0.30)' }]}>
          {fmtTime(elapsed)}
        </Text>

        {/* Metric row */}
        <View style={s.metricRow}>
          {[
            { icon: '🏃', val: `${distKm.toFixed(2)}`, unit: 'km'  },
            { icon: '⚡',  val: pace,                    unit: 'pace' },
          ].map((m, i) => (
            <View
              key={i}
              style={[
                s.metric,
                i > 0 && { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.07)' },
              ]}
            >
              <Text style={s.metricIcon}>{m.icon}</Text>
              <Text style={[s.metricVal, { color: C }]}>{m.val}</Text>
              <Text style={s.metricUnit}>{m.unit}</Text>
            </View>
          ))}
        </View>

        {/* Post-meal progress bar */}
        {type === 'postmeal' && (
          <View style={s.shataBar}>
            <Text style={[s.shataLabel, { color: C }]}>
              Shatapavalli · {steps} / 100 steps
            </Text>
            <View style={s.shataTrack}>
              <View style={[s.shataFill, { backgroundColor: C, width: `${Math.min(100, pct * 100)}%` as any }]} />
            </View>
          </View>
        )}

        {/* Buttons */}
        <View style={s.btnRow}>
          <Animated.View style={{ flex: 1, transform: [{ scale: pauseScale }] }}>
            <TouchableOpacity
              style={[
                s.pauseBtn,
                paused && { borderColor: C, backgroundColor: C + '18' },
              ]}
              onPress={toggleSessionPause}
            >
              <Text style={[s.pauseTxt, paused && { color: C }]}>
                {paused ? '▶  RESUME' : '⏸  PAUSE'}
              </Text>
            </TouchableOpacity>
          </Animated.View>

          <TouchableOpacity style={[s.endBtn, { backgroundColor: C }]} onPress={confirmEnd}>
            <Text style={s.endTxt}>■  END</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* ── CONFETTI / CELEBRATION OVERLAY ──────────────────────────────────── */}
      {confetti && (
        <Animated.View
          style={[StyleSheet.absoluteFillObject, s.overlay, { opacity: confettiOp }]}
          pointerEvents="none"
        >
          <LinearGradient
            colors={['rgba(0,0,0,0.88)', 'rgba(5,20,12,0.94)']}
            style={StyleSheet.absoluteFillObject}
          />
          {/* Particles */}
          {particlesX.map((px, i) => (
            <Animated.View
              key={i}
              style={[
                s.particle,
                {
                  backgroundColor: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
                  opacity:   particlesOp[i],
                  transform: [
                    { translateX: px },
                    { translateY: particlesY[i] },
                    { scale:      particlesScl[i] },
                  ],
                },
              ]}
            />
          ))}
          {/* Message */}
          <View style={s.celebMsg}>
            <Text style={s.celebEmoji}>🎉</Text>
            <Text style={[s.celebTitle, { color: C }]}>Shatapavalli Complete!</Text>
            <Text style={s.celebBody}>100 steps walked. Agni is awakened.</Text>
            <Text style={[s.celebBody, { color: 'rgba(255,255,255,0.35)', marginTop: 4 }]}>
              Walk no more — rest and digest 🙏
            </Text>
          </View>
        </Animated.View>
      )}
      {/* Sound Library Modal */}
      <SoundLibraryModal
        visible={isSoundModalVisible}
        onClose={() => setIsSoundModalVisible(false)}
        sounds={ALL_SOUNDS_LIST}
        playingId={playingId}
        onPlaySound={(id) => {
          const meta = ALL_SOUNDS_LIST.find(s => s.id === id);
          if (meta) {
            // Play sound for an indefinite looping walk session (12 hrs)
            playSound(meta, 43200, undefined, 0, true);
          }
          setIsSoundModalVisible(false);
        }}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const CARD_BG  = 'rgba(255,255,255,0.055)';
const CARD_BDR = 'rgba(255,255,255,0.09)';

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingBottom: 8,
  },
  closeBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: CARD_BG, borderWidth: 1, borderColor: CARD_BDR,
    alignItems: 'center', justifyContent: 'center',
  },
  closeTxt:     { fontSize: 16, color: 'rgba(255,255,255,0.55)', fontWeight: '700' },
  headerEmoji:  { fontSize: 20 },
  headerLabel:  { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  statusPill:   { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  pausedBadge:  { fontSize: 8, fontWeight: '900', color: '#FB923C', letterSpacing: 1 },
  liveDot:      { width: 8, height: 8, borderRadius: 4 },

  body: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24,
  },

  ringWrapper: {
    width: RING_SZ + 32, height: RING_SZ + 32,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  ringGlow: {
    position: 'absolute',
    width: RING_SZ + 32, height: RING_SZ + 32,
    borderRadius: (RING_SZ + 32) / 2,
    borderWidth: 1,
  },
  centreBox: {
    position: 'absolute', alignItems: 'center', justifyContent: 'center',
  },
  bigSteps:     { fontSize: 62, fontWeight: '900', letterSpacing: -2, lineHeight: 68 },
  bigStepsUnit: { fontSize: 13, color: 'rgba(255,255,255,0.38)', fontWeight: '600', marginTop: -2 },
  goalChip: {
    borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, marginTop: 10,
  },
  goalChipTxt: { fontSize: 11, fontWeight: '700' },

  ripple: {
    position: 'absolute',
    alignSelf: 'center',
    top: H * 0.5 - RING_SZ * 0.5,
    width: RING_SZ, height: RING_SZ,
    borderRadius: RING_SZ / 2,
    borderWidth: 2,
  },

  timer: {
    fontSize: 20, fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 2, marginBottom: 22,
  },

  metricRow: {
    flexDirection: 'row',
    backgroundColor: CARD_BG, borderRadius: 20,
    borderWidth: 1, borderColor: CARD_BDR,
    marginBottom: 24, alignSelf: 'stretch', overflow: 'hidden',
  },
  metric:     { flex: 1, alignItems: 'center', paddingVertical: 16, gap: 2 },
  metricIcon: { fontSize: 16 },
  metricVal:  { fontSize: 17, fontWeight: '900' },
  metricUnit: { fontSize: 10, color: 'rgba(255,255,255,0.33)', fontWeight: '600' },

  shataBar:   { alignSelf: 'stretch', gap: 8, marginBottom: 20 },
  shataLabel: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  shataTrack: { height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' },
  shataFill:  { height: 6, borderRadius: 3 },

  btnRow: { flexDirection: 'row', gap: 12, alignSelf: 'stretch' },
  pauseBtn: {
    flex: 1, paddingVertical: 16, borderRadius: 18,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: CARD_BG, alignItems: 'center',
  },
  pauseTxt: { fontSize: 13, fontWeight: '900', color: 'rgba(255,255,255,0.65)', letterSpacing: 1 },
  endBtn:   { paddingVertical: 16, paddingHorizontal: 28, borderRadius: 18, alignItems: 'center' },
  endTxt:   { fontSize: 13, fontWeight: '900', color: '#fff', letterSpacing: 1 },

  overlay:   { alignItems: 'center', justifyContent: 'center' },
  particle:  { position: 'absolute', width: 10, height: 10, borderRadius: 5, alignSelf: 'center', top: '50%' },
  celebMsg:  { alignItems: 'center', gap: 8, paddingHorizontal: 32 },
  celebEmoji:{ fontSize: 56 },
  celebTitle:{ fontSize: 24, fontWeight: '900', textAlign: 'center' },
  celebBody: { fontSize: 14, color: 'rgba(255,255,255,0.58)', textAlign: 'center', lineHeight: 20 },
});
