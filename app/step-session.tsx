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

import StepCounter, { type SessionType } from '@/src/modules/StepCounter';

const { width: W, height: H } = Dimensions.get('window');

// ── Design tokens ─────────────────────────────────────────────────────────────
const BG = '#070710';

// ── Ring geometry ─────────────────────────────────────────────────────────────
const RING_SZ = Math.min(W - 80, 260);
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

  // ── Refs ───────────────────────────────────────────────────────────────────
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const pausedRef    = useRef(false);
  const startMsRef   = useRef(Date.now());
  const pausedMsRef  = useRef(0);
  const pausedAtRef  = useRef(0);
  const doneRef      = useRef(false);

  // ── Animations ─────────────────────────────────────────────────────────────
  const stepBounce   = useRef(new Animated.Value(1)).current;
  const rippleScale  = useRef(new Animated.Value(0)).current;
  const rippleOp     = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const confettiOp   = useRef(new Animated.Value(0)).current;
  const fadeIn       = useRef(new Animated.Value(0)).current;
  const slideUp      = useRef(new Animated.Value(40)).current;
  const pauseScale   = useRef(new Animated.Value(1)).current;

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
    (async () => {
      await StepCounter.startSession(type);
      startMsRef.current = Date.now();

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

      setSteps(total);

      // Spring bounce
      Animated.sequence([
        Animated.spring(stepBounce, { toValue: 1.16, useNativeDriver: true, speed: 60, bounciness: 14 }),
        Animated.spring(stepBounce, { toValue: 1.00, useNativeDriver: true, speed: 40, bounciness: 4  }),
      ]).start();

      // Ripple
      rippleScale.setValue(0);
      rippleOp.setValue(0.55);
      Animated.parallel([
        Animated.timing(rippleScale, { toValue: 1, duration: 750, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(rippleOp,   { toValue: 0, duration: 750, useNativeDriver: true }),
      ]).start();

      // Haptic every 10 steps
      if (total % 10 === 0) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      // Progress ring
      Animated.timing(progressAnim, {
        toValue: Math.min(1, total / meta.goal),
        duration: 250,
        useNativeDriver: false,
      }).start();
      // Sync to state (listener-based, avoids createAnimatedComponent crash)
      const listener = progressAnim.addListener(({ value }) => {
        setProgressDashOffset(CIRCUM - value * CIRCUM);
      });

      // Post-meal 100-step celebration
      if (type === 'postmeal' && total >= 100 && !doneRef.current) {
        doneRef.current = true;
        launchConfetti();
      }
      
      return () => progressAnim.removeListener(listener);
    });
    return () => sub.remove();
  }, []);

  // ── Hardware back button ───────────────────────────────────────────────────
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      confirmEnd();
      return true;
    });
    return () => handler.remove();
  }, []);

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
  const togglePause = () => {
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

        {/* Ring */}
        <View style={s.ringWrapper}>
          {/* Glow border */}
          <View style={[s.ringGlow, { borderColor: C + '22' }]} />

          <Svg
            width={RING_SZ}
            height={RING_SZ}
            style={{ transform: [{ rotate: '-90deg' }] }}
          >
            <Defs>
              <SvgGrad id="sessGrad" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={C} stopOpacity="1" />
                <Stop offset="1" stopColor={C + 'AA'} stopOpacity="1" />
              </SvgGrad>
            </Defs>

            {/* Track */}
            <Circle
              cx={RING_SZ / 2} cy={RING_SZ / 2} r={R}
              stroke="rgba(255,255,255,0.05)"
              strokeWidth={STROKE}
              fill="none"
            />

            {/* Progress arc — driven by progressDashOffset state */}
            <Circle
              cx={RING_SZ/2} cy={RING_SZ/2} r={R}
              stroke="url(#sessGrad)"
              strokeWidth={STROKE}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={CIRCUM}
              strokeDashoffset={progressDashOffset}
            />
          </Svg>

          {/* Centre content */}
          <View style={s.centreBox}>
            <Animated.Text style={[s.bigSteps, { color: C, transform: [{ scale: stepBounce }] }]}>
              {steps.toLocaleString()}
            </Animated.Text>
            <Text style={s.bigStepsUnit}>steps</Text>
            <View style={[s.goalChip, { backgroundColor: C + '18', borderColor: C + '35' }]}>
              <Text style={[s.goalChipTxt, { color: C }]}>
                {Math.min(100, Math.round(pct * 100))}% · {meta.goal.toLocaleString()} goal
              </Text>
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
            { icon: '🔥', val: `${calories}`,            unit: 'kcal' },
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
              onPress={togglePause}
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
