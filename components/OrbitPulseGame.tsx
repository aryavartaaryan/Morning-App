/**
 * OrbitPulseGame.tsx — "Orbit Pulse" Sacred Geometry Rhythm Game
 * ─────────────────────────────────────────────────────────────────
 * Rules:
 *  - Glowing orbs orbit concentric rings of a live mandala
 *  - A fixed golden "gate" sits at 12-o'clock on each ring
 *  - Tap the gate when the orb passes through it
 *  - Hit window: ±350ms around the perfect moment
 *  - Perfect hit → bloom burst + Om chant surge + haptic
 *  - Miss → ring dims gently, no harsh penalty
 *  - Every 10 hits the mandala blooms a new petal layer
 *  - Background: Tanpura drone (Naad sounds)
 *
 * Performance:
 *  - ALL rotation animations use useNativeDriver: true
 *  - Orbs rotate via container rotation — zero sin/cos on JS thread
 *  - Hit detection via scheduled timeouts, not real-time collision
 *  - Static SVG mandala — never re-renders
 */

import React, {
  useRef, useState, useEffect, useCallback,
} from 'react';
import {
  View, Text, Modal, StyleSheet, TouchableOpacity,
  Animated, Easing, Dimensions, Platform,
} from 'react-native';
import Svg, { Circle, Path, G, Defs, RadialGradient, Stop } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { useSoundPlayer } from '@/lib/soundPlayerContext';
import { ALL_SLEEP_SOUNDS } from '@/lib/sleepSoundsData';

const { width: W, height: H } = Dimensions.get('window');
const CX = W / 2;
const CY = H / 2;

// ── Ring configs ────────────────────────────────────────────────────────────
// Each ring: radius, orbital period (ms), color, unlocks at score N
const RING_CONFIGS = [
  { id: 0, r: 72,  period: 3200, color: '#c084fc', unlockAt: 0  },
  { id: 1, r: 120, period: 2600, color: '#60a5fa', unlockAt: 3  },
  { id: 2, r: 168, period: 2000, color: '#34d399', unlockAt: 8  },
  { id: 3, r: 216, period: 1600, color: '#fbbf24', unlockAt: 15 },
];

const HIT_WINDOW_MS = 350; // ±350ms around the perfect gate crossing
const ORB_SIZE = 22;

// Om hit sound (direct URL)
const OM_HIT_URL = 'https://audio.onesutralabs.com/om.mp3';
// Tanpura background sound ID in the sound player
const TANPURA_SOUND_ID = 'cdn_new_8'; // Carnatic Focus Flow (Veena, Flute & Tanpura)

// ── Mandala SVG layers for visual evolution ─────────────────────────────────
const MANDALA_LEVELS = [1, 2, 3, 4]; // rendered based on score

// ── Types ───────────────────────────────────────────────────────────────────
type RingState = {
  id: number;
  r: number;
  period: number;
  color: string;
  active: boolean;
  unlockAt: number;
  gateFlash: Animated.Value;  // 0 = idle, 1 = hit window
  rotation: Animated.Value;   // 0..1 continuous loop
  orb: Animated.Value;        // opacity of orb
};

// ──────────────────────────────────────────────────────────────────────────────
// Static Mandala Background (pure SVG, no animation state)
// ──────────────────────────────────────────────────────────────────────────────
const MandalaBg = React.memo(({ level, ringColors }: { level: number; ringColors: string[] }) => {
  const L = 360; // SVG canvas size
  const c = L / 2;
  const petals = (n: number, r: number, color: string, opacity: number) => {
    const els = [];
    for (let i = 0; i < n; i++) {
      const a = (i * 360) / n;
      els.push(
        <G key={i} rotation={a} origin={`${c},${c}`}>
          <Path
            d={`M${c} ${c - r * 0.3} Q${c + r * 0.55} ${c - r * 0.85} ${c} ${c - r} Q${c - r * 0.55} ${c - r * 0.85} ${c} ${c - r * 0.3} Z`}
            fill={color}
            opacity={opacity}
          />
        </G>
      );
    }
    return els;
  };

  return (
    <Svg
      width={L} height={L}
      viewBox={`0 0 ${L} ${L}`}
      style={{ position: 'absolute', top: CY - L / 2, left: CX - L / 2 }}
      pointerEvents="none"
    >
      <Defs>
        <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#9333ea" stopOpacity="0.25" />
          <Stop offset="100%" stopColor="#9333ea" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx={c} cy={c} r={c} fill="url(#glow)" />

      {/* Outer decorative rings */}
      <Circle cx={c} cy={c} r={c - 2} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="3 6" />
      <Circle cx={c} cy={c} r={c - 20} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />

      {/* Level 1 — inner 6 petals */}
      {level >= 1 && petals(6, 68, '#c084fc', 0.12)}
      {/* Level 1 — inner circle */}
      {level >= 1 && <Circle cx={c} cy={c} r={64} fill="none" stroke="rgba(192,132,252,0.25)" strokeWidth="1" />}

      {/* Level 2 — 12 petals on mid ring */}
      {level >= 2 && petals(12, 116, '#60a5fa', 0.09)}
      {level >= 2 && <Circle cx={c} cy={c} r={112} fill="none" stroke="rgba(96,165,250,0.2)" strokeWidth="1" />}

      {/* Level 3 — 18 petals outer mid */}
      {level >= 3 && petals(18, 164, '#34d399', 0.07)}
      {level >= 3 && <Circle cx={c} cy={c} r={160} fill="none" stroke="rgba(52,211,153,0.18)" strokeWidth="1" />}

      {/* Level 4 — 24 petals outermost */}
      {level >= 4 && petals(24, 212, '#fbbf24', 0.06)}
      {level >= 4 && <Circle cx={c} cy={c} r={208} fill="none" stroke="rgba(251,191,36,0.15)" strokeWidth="1" />}

      {/* Center sacred geometry: Star of David variant */}
      <Path
        d={`M${c} ${c - 28} L${c + 24} ${c + 14} L${c - 24} ${c + 14} Z`}
        fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1"
      />
      <Path
        d={`M${c} ${c + 28} L${c + 24} ${c - 14} L${c - 24} ${c - 14} Z`}
        fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1"
      />
      <Circle cx={c} cy={c} r={14} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
      <Circle cx={c} cy={c} r={5} fill="rgba(255,255,255,0.4)" />
    </Svg>
  );
});

// ── Gate component (fixed at 12-o'clock of each ring) ───────────────────────
const Gate = React.memo(({ r, color, flash }: { r: number; color: string; flash: Animated.Value }) => {
  const gateY = CY - r;
  const glowScale = flash.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] });
  const glowOp    = flash.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: CX - 14,
        top: gateY - 14,
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ scale: glowScale }],
        opacity: glowOp,
      }}
    >
      {/* Outer halo */}
      <View style={{
        position: 'absolute',
        width: 28, height: 28, borderRadius: 14,
        backgroundColor: color,
        opacity: 0.2,
      }} />
      {/* Inner gem */}
      <View style={{
        width: 14, height: 14, borderRadius: 7,
        backgroundColor: color,
        shadowColor: color, shadowOpacity: 1, shadowRadius: 8,
      }} />
    </Animated.View>
  );
});

// ── Bloom burst — particle fan on perfect hit ────────────────────────────────
function BloomBurst({ x, y, color, trigger }: {
  x: number; y: number; color: string; trigger: number
}) {
  const anims = useRef(
    Array.from({ length: 8 }, () => ({
      tx: new Animated.Value(0),
      ty: new Animated.Value(0),
      op: new Animated.Value(0),
      sc: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    if (trigger === 0) return;
    anims.forEach((a, i) => {
      const angle = (i / 8) * 2 * Math.PI;
      const dist = 55 + Math.random() * 30;
      a.tx.setValue(0); a.ty.setValue(0); a.op.setValue(0); a.sc.setValue(0);
      Animated.parallel([
        Animated.timing(a.op, { toValue: 1, duration: 80,  useNativeDriver: true }),
        Animated.timing(a.sc, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(a.tx, {
            toValue: Math.cos(angle) * dist,
            duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(a.ty, {
            toValue: Math.sin(angle) * dist,
            duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.delay(200),
          Animated.timing(a.op, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]),
      ]).start();
    });
  }, [trigger]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      {anims.map((a, i) => (
        <Animated.View key={i} style={{
          position: 'absolute',
          left: x - 5, top: y - 5,
          width: 10, height: 10, borderRadius: 5,
          backgroundColor: color,
          shadowColor: color, shadowOpacity: 0.9, shadowRadius: 6,
          transform: [{ translateX: a.tx }, { translateY: a.ty }, { scale: a.sc }],
          opacity: a.op,
        }} />
      ))}
    </View>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Main Game Component
// ──────────────────────────────────────────────────────────────────────────────
export default function OrbitPulseGame({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { playSound, stopSound, setGlobalVolume } = useSoundPlayer();

  // ── Game state ─────────────────────────────────────────────────────────────
  const [score, setScore]           = useState(0);
  const [streak, setStreak]         = useState(0);
  const [peakStreak, setPeakStreak] = useState(0);
  const [mandalaLevel, setMandalaLevel] = useState(1);
  const [bloomTrigger, setBloomTrigger] = useState(0);
  const [bloomPos, setBloomPos]     = useState({ x: CX, y: CY - 72 });
  const [bloomColor, setBloomColor] = useState('#c084fc');
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackVisible, setFeedbackVisible] = useState(false);

  const scoreRef     = useRef(0);
  const streakRef    = useRef(0);
  const hitWindowRef = useRef<Record<number, boolean>>({});  // ringId → currently in hit window
  const timersRef    = useRef<ReturnType<typeof setTimeout>[]>([]);
  const omSoundRef   = useRef<Audio.Sound | null>(null);
  const isActiveRef  = useRef(false);

  // Animated values
  const feedbackOp = useRef(new Animated.Value(0)).current;
  const scoreScale = useRef(new Animated.Value(1)).current;
  const screenFlash = useRef(new Animated.Value(0)).current;

  // ── Ring states ─────────────────────────────────────────────────────────────
  const rings = useRef<RingState[]>(
    RING_CONFIGS.map(cfg => ({
      ...cfg,
      active: cfg.unlockAt === 0,
      gateFlash: new Animated.Value(0),
      rotation:  new Animated.Value(0),
      orb:       new Animated.Value(1),
    }))
  ).current;

  // ── Load Om sound ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    (async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, allowsRecordingIOS: false });
        const { sound } = await Audio.Sound.createAsync(
          { uri: OM_HIT_URL },
          { shouldPlay: false, volume: 0.8, isLooping: false }
        );
        omSoundRef.current = sound;
      } catch (e) {
        console.log('[OrbitPulse] Om sound load error:', e);
      }
    })();
    return () => {
      omSoundRef.current?.unloadAsync().catch(() => {});
      omSoundRef.current = null;
    };
  }, [visible]);

  // ── Play tanpura background ────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    const tanpura = ALL_SLEEP_SOUNDS.find(s => s.id === TANPURA_SOUND_ID);
    if (tanpura) {
      setGlobalVolume(0.4);
      playSound(tanpura, 3600, undefined, 0.4, true);
    }
    return () => {
      stopSound();
      setGlobalVolume(1);
    };
  }, [visible]);

  // ── Hit Om sound ───────────────────────────────────────────────────────────
  const playOmHit = useCallback(async () => {
    try {
      if (!omSoundRef.current) return;
      await omSoundRef.current.setPositionAsync(0);
      await omSoundRef.current.playAsync();
      setTimeout(() => {
        omSoundRef.current?.stopAsync().catch(() => {});
      }, 800);
    } catch (_) {}
  }, []);

  // ── Start orbital rotations (native driver) ────────────────────────────────
  const startRotations = useCallback(() => {
    rings.forEach(ring => {
      ring.rotation.setValue(0);
      Animated.loop(
        Animated.timing(ring.rotation, {
          toValue: 1,
          duration: ring.period,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    });
  }, [rings]);

  // ── Schedule hit windows for each ring ─────────────────────────────────────
  // The orb passes the gate (12-o'clock) once every `period` ms.
  // We schedule a window to open at each multiple of period.
  const scheduleHitWindows = useCallback((ring: RingState) => {
    if (!ring.active || !isActiveRef.current) return;

    const scheduleNext = (delay: number) => {
      const t = setTimeout(() => {
        if (!isActiveRef.current) return;
        // Open the hit window
        hitWindowRef.current[ring.id] = true;
        // Flash the gate gold
        Animated.timing(ring.gateFlash, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }).start();

        // Close window after 2 * HIT_WINDOW_MS
        const closeT = setTimeout(() => {
          hitWindowRef.current[ring.id] = false;
          // Dim back if no hit
          Animated.timing(ring.gateFlash, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }).start();
          // Schedule next
          scheduleNext(ring.period - HIT_WINDOW_MS);
        }, HIT_WINDOW_MS * 2);
        timersRef.current.push(closeT);
      }, delay);
      timersRef.current.push(t);
    };

    // First hit window: after one full orbit (with a small offset for the pre-open warning)
    scheduleNext(ring.period - HIT_WINDOW_MS);
  }, []);

  // ── Handle tap on a ring's gate ─────────────────────────────────────────────
  const handleGateTap = useCallback((ring: RingState) => {
    if (!isActiveRef.current) return;
    const isInWindow = hitWindowRef.current[ring.id];

    if (isInWindow) {
      // ✅ PERFECT HIT
      hitWindowRef.current[ring.id] = false;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      scoreRef.current += 1;
      streakRef.current += 1;
      const newScore  = scoreRef.current;
      const newStreak = streakRef.current;

      setScore(newScore);
      setStreak(newStreak);
      setPeakStreak(p => Math.max(p, newStreak));

      // Unlock next ring
      const nextRing = rings.find(r => !r.active && r.unlockAt <= newScore);
      if (nextRing) {
        nextRing.active = true;
        scheduleHitWindows(nextRing);
      }

      // Mandala level up every 10 hits
      const newLevel = Math.min(4, 1 + Math.floor(newScore / 10));
      setMandalaLevel(newLevel);

      // Bloom burst
      setBloomPos({ x: CX, y: CY - ring.r });
      setBloomColor(ring.color);
      setBloomTrigger(t => t + 1);

      // Screen flash
      Animated.sequence([
        Animated.timing(screenFlash, { toValue: 0.15, duration: 60,  useNativeDriver: true }),
        Animated.timing(screenFlash, { toValue: 0,    duration: 300, useNativeDriver: true }),
      ]).start();

      // Score scale pop
      Animated.sequence([
        Animated.spring(scoreScale, { toValue: 1.35, useNativeDriver: true, speed: 60, bounciness: 12 }),
        Animated.spring(scoreScale, { toValue: 1,    useNativeDriver: true, speed: 30, bounciness: 3  }),
      ]).start();

      // Gate dim
      Animated.timing(ring.gateFlash, { toValue: 0, duration: 150, useNativeDriver: true }).start();

      // Feedback text
      const msgs = newStreak >= 10 ? ['🔥 ON FIRE!', '⚡ UNSTOPPABLE!', '💜 DIVINE FLOW!'] :
                   newStreak >= 5  ? ['✨ PERFECT!', '🌟 GREAT!', '💫 FLOW!'] :
                                    ['✅ NICE!', '🎯 HIT!', '💜 YES!'];
      setFeedbackText(msgs[Math.floor(Math.random() * msgs.length)]);
      setFeedbackVisible(true);
      feedbackOp.setValue(0);
      Animated.sequence([
        Animated.timing(feedbackOp, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.delay(500),
        Animated.timing(feedbackOp, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => setFeedbackVisible(false));

      // Om hit sound
      playOmHit();

    } else {
      // ❌ MISS — very gentle
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      streakRef.current = 0;
      setStreak(0);
    }
  }, [rings, scheduleHitWindows, playOmHit, feedbackOp, scoreScale, screenFlash]);

  // ── Start / stop game ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    isActiveRef.current = true;
    scoreRef.current = 0;
    streakRef.current = 0;
    hitWindowRef.current = {};
    setScore(0); setStreak(0); setMandalaLevel(1);

    // Reset rings
    rings.forEach(ring => {
      ring.active = ring.unlockAt === 0;
      ring.gateFlash.setValue(0);
    });

    startRotations();
    // Schedule hit windows for initially active rings
    rings.filter(r => r.active).forEach(r => scheduleHitWindows(r));

    return () => {
      isActiveRef.current = false;
      timersRef.current.forEach(t => clearTimeout(t));
      timersRef.current = [];
      rings.forEach(r => {
        r.rotation.stopAnimation();
        r.gateFlash.setValue(0);
      });
    };
  }, [visible]);

  // ──────────────────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent transparent onRequestClose={onClose}>
      <View style={s.root}>
        {/* Dark deep purple background */}
        <LinearGradient
          colors={['#0A0014', '#0D0022', '#070012']}
          style={StyleSheet.absoluteFillObject}
        />
        {/* Subtle inner glow */}
        <LinearGradient
          colors={['rgba(147,51,234,0.18)', 'transparent']}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: H * 0.5 }}
        />

        {/* Screen flash on hit */}
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFillObject, {
            backgroundColor: '#ffffff',
            opacity: screenFlash,
          }]}
        />

        {/* Static Mandala background */}
        <MandalaBg level={mandalaLevel} ringColors={RING_CONFIGS.map(r => r.color)} />

        {/* ── Orbital rings (visual track circles) ── */}
        {RING_CONFIGS.map(cfg => {
          const ring = rings[cfg.id];
          if (!ring.active) return null;
          return (
            <View key={cfg.id} pointerEvents="none" style={StyleSheet.absoluteFillObject}>
              <Svg
                width={W} height={H}
                style={StyleSheet.absoluteFillObject}
              >
                <Circle
                  cx={CX} cy={CY} r={cfg.r}
                  fill="none"
                  stroke={cfg.color}
                  strokeWidth={1.5}
                  strokeOpacity={0.25}
                  strokeDasharray="4 6"
                />
              </Svg>
            </View>
          );
        })}

        {/* ── Orbiting orbs (rotated containers — native driver) ── */}
        {rings.map(ring => {
          if (!ring.active) return null;
          const spin = ring.rotation.interpolate({
            inputRange:  [0, 1],
            outputRange: ['0deg', '360deg'],
          });
          return (
            <Animated.View
              key={ring.id}
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: CX - ring.r,
                top:  CY - ring.r,
                width:  ring.r * 2,
                height: ring.r * 2,
                transform: [{ rotate: spin }],
              }}
            >
              {/* Orb at top of the rotation container (12 o'clock) */}
              <View style={{
                position: 'absolute',
                left: ring.r - ORB_SIZE / 2,
                top:  -ORB_SIZE / 2,
                width: ORB_SIZE, height: ORB_SIZE, borderRadius: ORB_SIZE / 2,
                backgroundColor: ring.color,
                shadowColor: ring.color,
                shadowOpacity: 0.9,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 0 },
              }}>
                {/* Inner white core */}
                <View style={{
                  position: 'absolute',
                  top: 5, left: 5, right: 5, bottom: 5,
                  borderRadius: 6,
                  backgroundColor: 'rgba(255,255,255,0.8)',
                }} />
              </View>
            </Animated.View>
          );
        })}

        {/* ── Gates (tap targets — fixed at 12-o'clock per ring) ── */}
        {rings.map(ring => {
          if (!ring.active) return null;
          return (
            <TouchableOpacity
              key={ring.id}
              activeOpacity={1}
              onPress={() => handleGateTap(ring)}
              style={{
                position: 'absolute',
                left: CX - 30,
                top:  CY - ring.r - 30,
                width: 60, height: 60,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Gate r={ring.r} color={ring.color} flash={ring.gateFlash} />
            </TouchableOpacity>
          );
        })}

        {/* ── Bloom burst particles ── */}
        <BloomBurst x={bloomPos.x} y={bloomPos.y} color={bloomColor} trigger={bloomTrigger} />

        {/* ── Feedback text ── */}
        {feedbackVisible && (
          <Animated.Text style={[s.feedbackText, { opacity: feedbackOp }]}>
            {feedbackText}
          </Animated.Text>
        )}

        {/* ── Top HUD ── */}
        <View style={s.topHud} pointerEvents="none">
          {/* Score */}
          <View style={s.scoreContainer}>
            <Animated.Text style={[s.scoreNum, { transform: [{ scale: scoreScale }] }]}>
              {score}
            </Animated.Text>
            <Text style={s.scoreLabel}>SCORE</Text>
          </View>

          {/* Title */}
          <View style={{ alignItems: 'center' }}>
            <Text style={s.title}>ORBIT PULSE</Text>
            <Text style={s.subtitle}>🕉️ Sacred Rhythm</Text>
          </View>

          {/* Streak */}
          <View style={[s.scoreContainer, { alignItems: 'flex-end' }]}>
            <Text style={[s.scoreNum, { color: streak >= 10 ? '#fbbf24' : streak >= 5 ? '#34d399' : '#c084fc' }]}>
              {streak >= 5 ? '🔥' : ''}{streak}
            </Text>
            <Text style={s.scoreLabel}>STREAK</Text>
          </View>
        </View>

        {/* ── Close button ── */}
        <TouchableOpacity onPress={onClose} style={s.closeBtn}>
          <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFillObject} />
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 18, lineHeight: 20 }}>✕</Text>
        </TouchableOpacity>

        {/* ── Bottom HUD ── */}
        <View style={s.bottomHud} pointerEvents="none">
          <Text style={s.instructHint}>Tap the glowing gate as the orb passes through</Text>
          {peakStreak > 0 && (
            <Text style={s.peakStreak}>🏆 Best Streak: {peakStreak}</Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#080012',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topHud: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 24, right: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  scoreContainer: {
    alignItems: 'center',
    minWidth: 60,
  },
  scoreNum: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -1,
  },
  scoreLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 10,
    color: 'rgba(192,132,252,0.7)',
    letterSpacing: 1.5,
    marginTop: 2,
  },
  closeBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 36,
    right: 20,
    width: 36, height: 36, borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  feedbackText: {
    position: 'absolute',
    top: H / 2 - 130,
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 1,
    textShadowColor: '#c084fc',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
    alignSelf: 'center',
  },
  bottomHud: {
    position: 'absolute',
    bottom: 60,
    left: 32, right: 32,
    alignItems: 'center',
  },
  instructHint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  peakStreak: {
    fontSize: 12,
    color: 'rgba(251,191,36,0.6)',
    fontWeight: '700',
    letterSpacing: 1,
  },
});
