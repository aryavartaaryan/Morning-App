/**
 * step-session.tsx — Live Walk Session Screen
 * ─────────────────────────────────────────────────────────────────────────────
 * Ultra-premium frosted glass live activity tracker.
 * - Full frosted glass design — feels like iOS Live Activity
 * - Premium solid frosted ring disc (not transparent)
 * - Live step count with spring animation
 * - Circular progress arc (multi-layer premium SVG)
 * - Live distance / time / pace metric cards (glassmorphic)
 * - Pause and End buttons (premium frosted)
 * - Exit modal and confetti celebration
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
  ImageBackground,
  Modal,
} from 'react-native';
import { BlurView } from 'expo-blur';
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
import { DeviceEventEmitter } from 'react-native';

import StepCounter, { type SessionType } from '@/src/modules/StepCounter';
import { useSoundPlayer } from '@/lib/soundPlayerContext';
import SoundLibraryModal from '@/components/SoundLibraryModal';
import { ALL_SOUNDS_LIST } from '@/app/(tabs)/sleep';
import { useBgContext } from '@/lib/bgContext';
import { getBgSourceSync } from '@/lib/bgImages';
import { DARK_BG_KEYS } from '@/lib/cardTheme';
import { getSolarRingPalette } from '@/lib/solarRingPalette';
import { fetchWeather } from '@/lib/weather';

const { width: W, height: H } = Dimensions.get('window');

// ── Design tokens ─────────────────────────────────────────────────────────────
const BG = '#070710';

// ── Ring geometry ─────────────────────────────────────────────────────────────
const RING_SZ = 200; // Slightly larger for live activity feel
const STROKE  = 14;
const R       = (RING_SZ - STROKE) / 2;
const CIRCUM  = 2 * Math.PI * R;

// ── Session meta ──────────────────────────────────────────────────────────────
const SESSION_META: Record<
  SessionType,
  { label: string; emoji: string; color: string; goal: number; bgTop: string; gradA: string; gradB: string }
> = {
  morning:  { label: 'Morning Walk',   emoji: '🌅', color: '#38bdf8', goal: 3000, bgTop: '#081a29', gradA: '#38bdf8', gradB: '#0ea5e9' },
  evening:  { label: 'Evening Walk',   emoji: '🌆', color: '#F472B6', goal: 3000, bgTop: '#1A0A12', gradA: '#F472B6', gradB: '#A78BFA' },
  postmeal: { label: 'Post-meal Walk', emoji: '🍽️', color: '#FB923C', goal: 100,  bgTop: '#1A0E08', gradA: '#FB923C', gradB: '#FCD34D' },
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

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const MemoRing = React.memo(({ RING_SZ, R, STROKE, CIRCUM, GA, GB, C, progressAnim, rot1, rot2 }: any) => (
  <>
    {/* ── LIVE ACTIVITY DYNAMIC NEON RING ───────────────────────────────── */}
    <View style={{ shadowColor: C, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 40, elevation: 20 }}>
      <Svg width={RING_SZ} height={RING_SZ} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Defs>
          <SvgGrad id="sessGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0"   stopColor="#ffffff" stopOpacity="1" />
            <Stop offset="0.4" stopColor={GA} stopOpacity="1" />
            <Stop offset="1"   stopColor={GB} stopOpacity="1" />
          </SvgGrad>
        </Defs>
        
        {/* Outer razor-thin neon orbit */}
        <Circle cx={RING_SZ/2} cy={RING_SZ/2} r={R + 12} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
        <AnimatedCircle cx={RING_SZ/2} cy={RING_SZ/2} r={R + 12} fill="none" stroke="url(#sessGrad)" strokeWidth={3} strokeDasharray={CIRCUM + 75} strokeDashoffset={progressAnim.interpolate({ inputRange: [0, CIRCUM], outputRange: [0, CIRCUM + 75] })} strokeLinecap="round" />

        {/* Main thick segmented track */}
        <Circle cx={RING_SZ/2} cy={RING_SZ/2} r={R} fill="none" stroke="rgba(255,255,255,0.40)" strokeWidth={STROKE} strokeDasharray="4 6" />
        
        {/* Massive blur duplicate for outer core glow */}
        <AnimatedCircle cx={RING_SZ/2} cy={RING_SZ/2} r={R} fill="none" stroke="url(#sessGrad)" strokeWidth={STROKE + 20} strokeDasharray={CIRCUM} strokeDashoffset={progressAnim} opacity={0.65} strokeLinecap="round" />
        {/* Intense blur duplicate for inner core glow */}
        <AnimatedCircle cx={RING_SZ/2} cy={RING_SZ/2} r={R} fill="none" stroke="url(#sessGrad)" strokeWidth={STROKE + 8} strokeDasharray={CIRCUM} strokeDashoffset={progressAnim} opacity={0.9} strokeLinecap="round" />
        {/* Active solid glowing progress overlay */}
        <AnimatedCircle cx={RING_SZ/2} cy={RING_SZ/2} r={R} fill="none" stroke="url(#sessGrad)" strokeWidth={STROKE} strokeDasharray={CIRCUM} strokeDashoffset={progressAnim} strokeLinecap="round" />
        {/* Neon White Core */}
        <AnimatedCircle cx={RING_SZ/2} cy={RING_SZ/2} r={R} fill="none" stroke="#ffffff" strokeWidth={5} strokeDasharray={CIRCUM} strokeDashoffset={progressAnim} strokeLinecap="round" opacity={0.9} />
        
        {/* Inner razor-thin neon orbit */}
        <Circle cx={RING_SZ/2} cy={RING_SZ/2} r={R - 12} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
        <AnimatedCircle cx={RING_SZ/2} cy={RING_SZ/2} r={R - 12} fill="none" stroke="url(#sessGrad)" strokeWidth={3} strokeDasharray={CIRCUM - 75} strokeDashoffset={progressAnim.interpolate({ inputRange: [0, CIRCUM], outputRange: [0, CIRCUM - 75] })} strokeLinecap="round" />
      </Svg>
    </View>

    {/* Rotating Outer Visualizer HUD */}
    <Animated.View style={{ position: 'absolute', top: 20, left: 20, width: RING_SZ, height: RING_SZ, transform: [{ rotate: rot1.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
      <Svg width={RING_SZ} height={RING_SZ} viewBox={`0 0 ${RING_SZ} ${RING_SZ}`}>
        <Circle cx={RING_SZ/2} cy={RING_SZ/2} r={R + 22} stroke={C} strokeWidth={2.5} fill="none" strokeDasharray="1 10" opacity={0.65} />
        <Circle cx={RING_SZ/2} cy={RING_SZ/2} r={R + 22} stroke={GB} strokeWidth={4} fill="none" strokeDasharray="1 50" opacity={0.80} />
      </Svg>
    </Animated.View>

    {/* Rotating Inner HUD (Sine wave rapid feel) */}
    <Animated.View style={{ position: 'absolute', top: 20, left: 20, width: RING_SZ, height: RING_SZ, transform: [{ rotate: rot2.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] }) }] }}>
      <Svg width={RING_SZ} height={RING_SZ} viewBox={`0 0 ${RING_SZ} ${RING_SZ}`}>
        <Circle cx={RING_SZ/2} cy={RING_SZ/2} r={R - 18} stroke={C} strokeWidth={1} fill="none" strokeDasharray="4 22" opacity={0.45} />
        <Circle cx={RING_SZ/2} cy={RING_SZ/2} r={R - 18} stroke="#ffffff" strokeWidth={2.5} fill="none" strokeDasharray="0.5 14" opacity={0.9} strokeLinecap="round" />
      </Svg>
    </Animated.View>
  </>
));

// ── iOS-style glass overlay — identical to sleep.tsx ─────────────────────────
function GlassPulseOverlay() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <BlurView
        tint="dark"
        intensity={65}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      {/* Premium iOS frosted-glass gradient overlay — same as sleep page */}
      <LinearGradient
        colors={[
          'rgba(4,6,14,0.15)',
          'rgba(4,6,14,0.30)',
          'rgba(4,6,14,0.45)',
          'rgba(4,6,14,0.65)',
        ]}
        locations={[0, 0.3, 0.7, 1]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function StepSessionScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sessionType } = useLocalSearchParams<{ sessionType?: string }>();

  const type = (sessionType as SessionType | undefined) ?? 'morning';
  let meta = SESSION_META[type] ?? SESSION_META.morning;
  
  if (type === 'morning') {
    const hour = new Date().getHours();
    if (hour >= 12 && hour < 17) {
      meta = { ...meta, emoji: '☀️' };
    }
  }

  // Always use "The Walk" as the title
  meta = { ...meta, label: 'The Walk' };

  const { solarTimes } = useBgContext();
  const now = new Date();
  const hour = now.getHours() + now.getMinutes() / 60;
  const [done,     setDone]     = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [weather, setWeather] = useState<any>(null);

  // Fixed ultra-premium iOS style palette for the ring — neutral frosted glass
  const C  = '#FFFFFF';
  const GA = 'rgba(255,255,255,0.9)';
  const GB = 'rgba(255,255,255,0.3)';

  const isNightReal = solarTimes ? (hour < solarTimes.sunrise || hour >= solarTimes.sunset) : (hour < 6 || hour >= 18);

  // ── State ──────────────────────────────────────────────────────────────────
  const [steps,    setSteps]    = useState(0);
  const [elapsed,  setElapsed]  = useState(0);
  const [paused,   setPaused]   = useState(false);

  // Sound Integration
  const { playingId, isPaused, togglePause, stopSound, playSound } = useSoundPlayer();
  const [isSoundModalVisible, setIsSoundModalVisible] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const pausedRef    = useRef(false);
  const startMsRef   = useRef(Date.now());
  const pausedMsRef  = useRef(0);
  const pausedAtRef  = useRef(0);
  const doneRef      = useRef(false);
  const lastUpdateRef = useRef(0);
  const lastBounceRef = useRef(0);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Animations ─────────────────────────────────────────────────────────────
  const stepBounce   = useRef(new Animated.Value(1)).current;
  const pulseAnim    = useRef(new Animated.Value(1)).current;
  const rippleScale  = useRef(new Animated.Value(0)).current;
  const rippleOp     = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(CIRCUM)).current;
  const confettiOp   = useRef(new Animated.Value(0)).current;
  const fadeIn       = useRef(new Animated.Value(0)).current;
  const slideUp      = useRef(new Animated.Value(40)).current;
  const pauseScale   = useRef(new Animated.Value(1)).current;
  const glowAnim     = useRef(new Animated.Value(0)).current;
  
  // Sci-fi ring rotations
  const rot1 = useRef(new Animated.Value(0)).current;
  const rot2 = useRef(new Animated.Value(0)).current;
  const rot3 = useRef(new Animated.Value(0)).current;

  // Confetti particles
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
    // Start animations IMMEDIATELY so content appears instantly
    Animated.parallel([
      Animated.timing(fadeIn,  { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 300, easing: Easing.out(Easing.exp), useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.10, duration: 3000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.00, duration: 3000, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(Animated.timing(rot1, { toValue: 1, duration: 20000, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(rot2, { toValue: 1, duration: 28000, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(rot3, { toValue: 1, duration: 12000, easing: Easing.linear, useNativeDriver: true })).start();

    // Start timer immediately
    timerRef.current = setInterval(() => {
      if (!pausedRef.current) {
        setElapsed(Math.round((Date.now() - startMsRef.current - pausedMsRef.current) / 1000));
      }
    }, 1000);

    // Async background operations (weather + session start)
    (async () => {
      try {
        const w = await fetchWeather();
        setWeather(w);
      } catch (err) {}

      try {
        const result = await StepCounter.startSession(type);
        startMsRef.current = result.startTime;
      } catch (e) {
        console.warn("Failed to start walk session: ", e);
      }
    })();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ── Step event subscription ────────────────────────────────────────────────
  useEffect(() => {
    const sub = StepCounter.onStep((total) => {
      if (pausedRef.current || doneRef.current) return;

      const now = Date.now();
      
      if (now - lastBounceRef.current > 350) {
        lastBounceRef.current = now;
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
      }

      if (type === 'postmeal' && total >= 100 && !doneRef.current) {
        doneRef.current = true;
        launchConfetti();
      }

      const syncState = () => {
        setSteps(total);
        Animated.timing(progressAnim, { toValue: CIRCUM - Math.min(1, total / meta.goal) * CIRCUM, duration: 250, useNativeDriver: false }).start();
        lastUpdateRef.current = Date.now();
        syncTimeoutRef.current = null;
      };

      if (now - lastUpdateRef.current >= 1000) {
        if (syncTimeoutRef.current) { clearTimeout(syncTimeoutRef.current); syncTimeoutRef.current = null; }
        syncState();
      } else if (!syncTimeoutRef.current) {
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

  const promptExit = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowExitModal(true);
  }, []);

  // ── Hardware back button ───────────────────────────────────────────────────
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      promptExit();
      return true;
    });
    return () => handler.remove();
  }, [promptExit]);

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
    DeviceEventEmitter.emit('SessionEnded');
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

  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });

  // ─────────────────────────────────────────────────────────────────────────────
  const { bgUri, accentColor, bgKey } = useBgContext();
  const sessionBgKey = isNightReal ? 'live_session_night' : 'live_session';

  return (
    <ImageBackground
      source={{ uri: getBgSourceSync(sessionBgKey as any) }}
      style={[{ flex: 1, backgroundColor: accentColor || BG }]}
      imageStyle={{ opacity: 1, resizeMode: 'cover' }}>
      <GlassPulseOverlay />
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Session-colour aurora aura */}
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: glowOpacity }]} pointerEvents="none">
        <LinearGradient
          colors={[GA + '22', 'transparent']}
          style={{ position: 'absolute', top: -100, left: -100, width: 420, height: 420, borderRadius: 210 }}
        />
        <LinearGradient
          colors={[GB + '14', 'transparent']}
          style={{ position: 'absolute', top: 80, right: -80, width: 320, height: 320, borderRadius: 160 }}
        />
        {/* Bottom glow */}
        <LinearGradient
          colors={['transparent', GA + '14']}
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 300 }}
        />
      </Animated.View>

      {/* ── HEADER — frosted glass live activity bar ──────────────────────────── */}
      <Animated.View
        style={[{ opacity: fadeIn, transform: [{ translateY: slideUp }] }]}
      >
        <View style={{
          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
          paddingTop: insets.top + 6,
          paddingBottom: 14,
          paddingHorizontal: 20,
          backgroundColor: 'transparent',
          overflow: 'hidden',
        }}>
          {/* Top shine */}
          <LinearGradient
            colors={['rgba(255,255,255,0.09)', 'transparent']}
            start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.8 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          {/* Bottom border glow */}
          <LinearGradient
            colors={[C + '50', C + '20', 'transparent', C + '35']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1.5 }}
            pointerEvents="none"
          />

          {/* Close / Exit */}
          <TouchableOpacity
            onPress={promptExit}
            style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={18} color="rgba(255,255,255,0.65)" />
          </TouchableOpacity>

          {/* Centre — session identity */}
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 18, marginBottom: 1 }}>{meta.emoji}</Text>
            <Text style={{ fontSize: 13, fontWeight: '600', color: C, letterSpacing: 0.6, textShadowColor: C + '80', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 }}>
              {meta.label}
            </Text>
          </View>

          {/* Live / Paused status */}
          <View style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}>
            {paused ? (
              <View style={{ paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(251,146,60,0.18)', borderWidth: 1, borderColor: 'rgba(251,146,60,0.4)' }}>
                <Text style={{ fontSize: 7, fontWeight: '900', color: '#FB923C', letterSpacing: 1.2 }}>PAUSE</Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10, backgroundColor: C + '20', borderWidth: 1, borderColor: C + '50' }}>
                <Animated.View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: C, opacity: pulseAnim.interpolate({ inputRange: [1, 1.10], outputRange: [0.6, 1] }) }} />
                <Text style={{ fontSize: 7, fontWeight: '900', color: C, letterSpacing: 1 }}>LIVE</Text>
              </View>
            )}
          </View>
        </View>
      </Animated.View>

      {/* ── BODY ────────────────────────────────────────────────────────────── */}
      <Animated.View style={[s.body, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>

        {/* ── PREMIUM SUGGESTION CARD ────────────────────────────────────── */}
        <View style={{ width: '100%', marginBottom: 16 }}>
          <View style={{
            backgroundColor: 'rgba(20, 30, 25, 0.45)', // Sleek nature tint
            borderRadius: 20,
            padding: 16,
            borderWidth: 1, borderColor: C + '25',
            alignItems: 'center',
            overflow: 'hidden',
          }}>
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
            <LinearGradient
              colors={[C + '15', 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <Text style={{ fontSize: 13, fontWeight: '700', color: C, letterSpacing: 0.3, marginBottom: 6, textAlign: 'center' }}>
              Nature Connection
            </Text>
            <Text style={{ fontSize: 11, fontWeight: '400', color: 'rgba(255,255,255,0.65)', lineHeight: 16, textAlign: 'center', marginBottom: 10 }}>
              Walk barefoot if conditions permit, or simply wear shoes and take a mindful nature bath.
            </Text>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="headset" size={11} color={C} />
              <Text style={{ fontSize: 10, fontWeight: '600', color: C, letterSpacing: 0.2 }}>Use headphones for Nada sound</Text>
            </View>
          </View>
        </View>

        {/* ── ULTRA-PREMIUM LIVE RING ───────────────────────────────────────── */}
        <View style={s.ringWrapper}>
          {/* Outer breathing aura layers */}
          <Animated.View style={{ position: 'absolute', top: -15, left: -15, width: RING_SZ + 70, height: RING_SZ + 70, borderRadius: (RING_SZ + 70) / 2, overflow: 'hidden', opacity: pulseAnim.interpolate({ inputRange: [1, 1.10], outputRange: [0.3, 0.8] }), transform: [{ scale: pulseAnim }] }}>
            <LinearGradient colors={[`${GA}80`, `${GB}00`]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFillObject} />
          </Animated.View>
          <Animated.View style={{ position: 'absolute', top: 2, left: 2, width: RING_SZ + 36, height: RING_SZ + 36, borderRadius: (RING_SZ + 36) / 2, overflow: 'hidden', opacity: pulseAnim.interpolate({ inputRange: [1, 1.10], outputRange: [0.5, 1] }), transform: [{ scale: pulseAnim }] }}>
            <LinearGradient colors={[`${GA}80`, `${GB}00`]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFillObject} />
          </Animated.View>

          {/* Inner disc for better text contrast */}
          <View style={{ position: 'absolute', top: 30, left: 30, width: RING_SZ - 20, height: RING_SZ - 20, borderRadius: (RING_SZ - 20) / 2, backgroundColor: 'rgba(0,0,0,0.3)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }} />

          <MemoRing RING_SZ={RING_SZ} R={R} STROKE={STROKE} CIRCUM={CIRCUM} GA={GA} GB={GB} C={C} progressAnim={progressAnim} rot1={rot1} rot2={rot2} />

          {/* Centre content */}
          <View style={[s.centreBox, { gap: 3 }]}>
            {/* Badge */}
            <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99, backgroundColor: C + '20', borderWidth: 1, borderColor: C + '60', marginBottom: 4 }}>
              <Text style={{ fontSize: 7, fontWeight: '700', color: C, letterSpacing: 1.4 }}>👣  LIVE STEPS</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Animated.Text style={[s.bigSteps, { fontSize: playingId ? 44 : 54, lineHeight: playingId ? 50 : 60, color: C, transform: [{ scale: stepBounce }], textShadowColor: C + '80', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 16 }]}>
                {steps.toLocaleString()}
              </Animated.Text>
              <Text style={[s.bigStepsUnit, playingId && { fontSize: 10 }]}>STEPS</Text>
            </View>
            
            {!playingId && (
              <View style={[s.goalChip, { backgroundColor: C + '18', borderColor: C + '40' }]}>
                <Text style={[s.goalChipTxt, { color: C }]}>
                  {Math.min(100, Math.round(pct * 100))}% · {meta.goal.toLocaleString()} goal
                </Text>
              </View>
            )}

            {/* Sound Controls */}
            <View style={{ marginTop: playingId ? 4 : 8 }}>
              {!playingId ? (
                <TouchableOpacity 
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setIsSoundModalVisible(true); }}
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', overflow: 'hidden' }}>
                    <LinearGradient
                      colors={['rgba(255,255,255,0.1)', 'transparent']}
                      start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
                      style={StyleSheet.absoluteFillObject}
                    />
                    <Ionicons name="musical-notes" size={12} color="#FFFFFF" style={{ marginRight: 5 }} />
                    <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '600', letterSpacing: 0.8 }}>SELECT SOUND</Text>
                  </View>
                </TouchableOpacity>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 22, gap: 12, overflow: 'hidden', shadowColor: '#FFFFFF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 }}>
                  <LinearGradient
                    colors={['rgba(255,255,255,0.1)', 'transparent']}
                    start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                  />
                  <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); stopSound(); }} style={{ padding: 4 }}>
                    <Ionicons name="stop" size={14} color="rgba(255,255,255,0.45)" />
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); togglePause(); }} 
                    style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Ionicons name={isPaused ? "play" : "pause"} size={16} color="#FFF" style={isPaused ? { marginLeft: 2 } : {}} />
                  </TouchableOpacity>
                  
                  <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setIsSoundModalVisible(true); }} style={{ padding: 4 }}>
                    <Ionicons name="list" size={16} color="rgba(255,255,255,0.75)" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* ── TIMER — frosted glass pill ──────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', marginBottom: 10, overflow: 'hidden' }}>
          <LinearGradient
            colors={['rgba(255,255,255,0.07)', 'transparent']}
            start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.6 }}
            style={StyleSheet.absoluteFillObject}
          />
          <Text style={[s.timer, paused && { color: 'rgba(255,255,255,0.25)' }]}>
            {fmtTime(elapsed)}
          </Text>
        </View>

        {/* ── METRIC ROW — frosted glass cards ───────────────────────────── */}
        <View style={s.metricRow}>
          {[
            { icon: '🏃', val: `${distKm.toFixed(2)}`, unit: 'km',  label: 'Distance' },
            { icon: '⚡',  val: pace,                    unit: 'pace', label: 'Pace'     },
          ].map((m, i) => (
            <View
              key={i}
              style={[
                s.metric,
                i > 0 && { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.08)' },
              ]}
            >
              <Text style={s.metricIcon}>{m.icon}</Text>
              <Text style={[s.metricVal, { color: C }]}>{m.val}</Text>
              <Text style={s.metricUnit}>{m.label}</Text>
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

        {/* ── ACTION BUTTONS — ultra smart frosted glass ─────────────────── */}
        <View style={s.btnRow}>
          {/* PAUSE button */}
          <Animated.View style={{ flex: 1, transform: [{ scale: pauseScale }] }}>
            <TouchableOpacity
              onPress={toggleSessionPause}
              activeOpacity={0.82}
              style={{ borderRadius: 22, overflow: 'hidden', shadowColor: paused ? C : '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: paused ? 0.35 : 0.25, shadowRadius: 14, elevation: 5 }}
            >
              <LinearGradient
                colors={paused ? [GA + '30', GA + '18', GA + '25'] : ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.05)']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={{ paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <View style={{ position: 'absolute', inset: 0, borderRadius: 22, borderWidth: 1.5, borderColor: paused ? C + '60' : 'rgba(255,255,255,0.2)' }} />
                <LinearGradient
                  colors={['rgba(255,255,255,0.10)', 'transparent']}
                  start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.5 }}
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 22, borderTopLeftRadius: 22, borderTopRightRadius: 22 }}
                />
                <Ionicons name={paused ? 'play' : 'pause'} size={16} color={paused ? C : '#FFF'} />
                <Text style={[s.pauseTxt, paused ? { color: C } : { color: '#FFF' }]}>
                  {paused ? 'RESUME' : 'PAUSE'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* END button */}
          <View style={{ flex: 1 }}>
            <TouchableOpacity 
              onPress={promptExit}
              activeOpacity={0.82}
              style={{ borderRadius: 22, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 14, elevation: 5 }}
            >
              <LinearGradient
                colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.05)']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={{ paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <View style={{ position: 'absolute', inset: 0, borderRadius: 22, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)' }} />
                <LinearGradient
                  colors={['rgba(255,255,255,0.10)', 'transparent']}
                  start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.5 }}
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 22, borderTopLeftRadius: 22, borderTopRightRadius: 22 }}
                />
                <Ionicons name="stop" size={15} color="#FFF" />
                <Text style={[s.endTxt, { color: '#FFF' }]}>END</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

      </Animated.View>

      {/* ── CONFETTI / CELEBRATION OVERLAY ──────────────────────────────────── */}
      {confetti && (
        <Animated.View
          style={[StyleSheet.absoluteFillObject, s.overlay, { opacity: confettiOp }]}
          pointerEvents="none"
        >
          <LinearGradient
            colors={['rgba(0,0,0,0.92)', 'rgba(5,20,12,0.96)']}
            style={StyleSheet.absoluteFillObject}
          />
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
            playSound(meta, 43200, undefined, 0, true);
          }
          setIsSoundModalVisible(false);
        }}
      />
      <ExitModal 
        visible={showExitModal} 
        onClose={() => setShowExitModal(false)} 
        onMinimize={() => { setShowExitModal(false); minimizeSession(); }} 
        onEnd={() => { setShowExitModal(false); endSession(); }} 
        color={C}
        gradA={GA}
        gradB={GB}
      />
    </ImageBackground>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Exit Modal — frosted glass
// ─────────────────────────────────────────────────────────────────────────────
function ExitModal({
  visible, onClose, onMinimize, onEnd, color, gradA, gradB
}: {
  visible: boolean; onClose: () => void; onMinimize: () => void; onEnd: () => void; color: string; gradA: string; gradB: string;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} />
        
        {/* Apple-style floating premium frosted glass sheet */}
        <View style={{ borderRadius: 28, width: '100%', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.5, shadowRadius: 40 }}>
          <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFillObject} />
          
          <View style={{ padding: 28, paddingBottom: 16, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 28 }}>
            
            {/* Top inner shine */}
            <LinearGradient
              colors={['rgba(255,255,255,0.25)', 'transparent']}
              start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.2 }}
              style={StyleSheet.absoluteFillObject}
              pointerEvents="none"
            />
            
            {/* Elegant minimal icon */}
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 18, shadowColor: '#FFF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 10 }}>
              <Ionicons name="walk" size={24} color="#fff" style={{ marginLeft: 3 }} />
            </View>
            
            <Text style={{ fontSize: 20, fontWeight: '700', color: '#fff', textAlign: 'center', marginBottom: 6, letterSpacing: 0.35 }}>
              Session in Progress
            </Text>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginBottom: 28, lineHeight: 18, paddingHorizontal: 12 }}>
              Minimize to keep tracking steps and playing audio in the background, or end your session.
            </Text>
            
            <View style={{ width: '100%', gap: 12 }}>
              {/* Keep Walking (Primary Safe Action) — Glass Button */}
              <TouchableOpacity
                onPress={onMinimize}
                style={{ borderRadius: 22, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }}
                activeOpacity={0.8}
              >
                <View style={{ paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Ionicons name="chevron-down" size={16} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15, letterSpacing: 0.2 }}>Keep Walking in Background</Text>
                </View>
              </TouchableOpacity>
              
              {/* End Session (Destructive) — Subtle Red Tint */}
              <TouchableOpacity
                onPress={onEnd}
                style={{ borderRadius: 22, overflow: 'hidden', backgroundColor: 'rgba(239,68,68,0.15)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' }}
                activeOpacity={0.8}
              >
                <View style={{ paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Ionicons name="stop" size={14} color="#fca5a5" />
                  <Text style={{ color: '#fca5a5', fontWeight: '700', fontSize: 15, letterSpacing: 0.3 }}>End Session</Text>
                </View>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity onPress={onClose} style={{ marginTop: 20, paddingVertical: 12, paddingHorizontal: 20, width: '100%', alignItems: 'center' }}>
              <Text style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', fontSize: 15, fontWeight: '600', letterSpacing: 0.2 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const CARD_BG  = 'rgba(12,12,30,0.72)';
const CARD_BDR = 'rgba(255,255,255,0.09)';

const s = StyleSheet.create({
  body: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, marginTop: -25,
  },

  ringWrapper: {
    width: RING_SZ + 40, height: RING_SZ + 40,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4, marginTop: 4,
  },
  centreBox: {
    position: 'absolute', alignItems: 'center', justifyContent: 'center',
  },
  bigSteps:     { fontSize: 58, fontWeight: '300', fontVariant: ['tabular-nums'], letterSpacing: -1.5, lineHeight: 64 },
  bigStepsUnit: { fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: '600', marginTop: -2, letterSpacing: 2 },
  goalChip: {
    borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, marginTop: 8,
  },
  goalChipTxt: { fontSize: 10, fontWeight: '700' },

  timer: {
    fontSize: 24, fontWeight: '300', fontVariant: ['tabular-nums'],
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 2,
  },

  metricRow: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
    borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 10, alignSelf: 'stretch', overflow: 'hidden',
  },
  metric:     { flex: 1, alignItems: 'center', paddingVertical: 8, gap: 2 },
  metricIcon: { fontSize: 16, marginBottom: 2 },
  metricVal:  { fontSize: 18, fontWeight: '500', fontVariant: ['tabular-nums'] },
  metricUnit: { fontSize: 10, color: 'rgba(255,255,255,0.38)', fontWeight: '600' },

  shataBar:   { alignSelf: 'stretch', gap: 8, marginBottom: 12 },
  shataLabel: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  shataTrack: { height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' },
  shataFill:  { height: 6, borderRadius: 3 },

  btnRow: { flexDirection: 'row', gap: 14, alignSelf: 'stretch', justifyContent: 'center' },
  pauseTxt: { fontSize: 13, fontWeight: '600', letterSpacing: 1 },
  endTxt:   { fontSize: 13, fontWeight: '600', color: '#0A0A0F', letterSpacing: 1 },

  overlay:   { alignItems: 'center', justifyContent: 'center' },
  particle:  { position: 'absolute', width: 10, height: 10, borderRadius: 5, alignSelf: 'center', top: '50%' },
  celebMsg:  { alignItems: 'center', gap: 8, paddingHorizontal: 32 },
  celebEmoji:{ fontSize: 56 },
  celebTitle:{ fontSize: 24, fontWeight: '600', textAlign: 'center', letterSpacing: 0.5 },
  celebBody: { fontSize: 14, color: 'rgba(255,255,255,0.58)', textAlign: 'center', lineHeight: 20 },
});
