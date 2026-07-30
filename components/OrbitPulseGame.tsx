/**
 * OrbitPulseGame.tsx — "Orbital Jump" Hyper-Casual Survival
 * ─────────────────────────────────────────────────────────────────
 * Rules:
 *  - Player controls a glowing orb fixed at the bottom (6 o'clock).
 *  - Tap ANYWHERE to jump between the 3 concentric rings (Inner -> Mid -> Outer -> Mid ...).
 *  - Dark Energy blocks spawn on the rings and rotate towards the player.
 *  - Dodge the blocks! Score increases the longer you survive.
 *  - Extremely rich visuals: heavy glows, particle trails, dynamic backgrounds.
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View, Text, Modal, StyleSheet, TouchableOpacity,
  Animated, Easing, Dimensions, Platform
} from 'react-native';
import Svg, { Circle, Path, G, Defs, RadialGradient, Stop } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { useSoundPlayer } from '@/lib/soundPlayerContext';
import { ALL_SLEEP_SOUNDS } from '@/lib/sleepSoundsData';
import { Ionicons } from '@expo/vector-icons';

const { width: W, height: H } = Dimensions.get('window');
const CX = W / 2;
const CY = H / 2;

// ── Configuration ────────────────────────────────────────────────────────────
const RINGS = [80, 140, 200]; // Radii of the 3 rings
const ORB_SIZE = 24;
const OBSTACLE_SIZE = 28;

const OM_HIT_URL = 'https://audio.onesutralabs.com/om.mp3';
const TANPURA_SOUND_ID = 'cdn_new_8';

type Obstacle = {
  id: number;
  ringIdx: number;
  angle: number; // 0 to 360 (player is at 0)
  active: boolean;
};

// ── Static Rich Mandala Background ───────────────────────────────────────────
const MandalaBg = React.memo(({ rotation }: { rotation: Animated.Value }) => {
  const L = 400; // SVG canvas size
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

  const spin = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', top: CY - L/2, left: CX - L/2, width: L, height: L, transform: [{ rotate: spin }] }}>
      <Svg width={L} height={L} viewBox={`0 0 ${L} ${L}`}>
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#c084fc" stopOpacity="0.15" />
            <Stop offset="100%" stopColor="#c084fc" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={c} cy={c} r={c} fill="url(#glow)" />

        {/* 3 Main Rings matching gameplay */}
        {RINGS.map((r, i) => (
          <Circle key={`rg-${i}`} cx={c} cy={c} r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" strokeDasharray="4 8" />
        ))}

        {petals(12, 100, '#60a5fa', 0.1)}
        {petals(24, 180, '#c084fc', 0.1)}
        
        {/* Core star */}
        <Path d={`M${c} ${c - 28} L${c + 24} ${c + 14} L${c - 24} ${c + 14} Z`} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
        <Path d={`M${c} ${c + 28} L${c + 24} ${c - 14} L${c - 24} ${c - 14} Z`} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
      </Svg>
    </Animated.View>
  );
});

// ── Glowing Player Orb with Trail ────────────────────────────────────────────
function PlayerOrb({ radiusAnim, jumpScale }: { radiusAnim: Animated.Value, jumpScale: Animated.Value }) {
  const ty = radiusAnim; // Player is always at bottom, so translate Y by radius

  return (
    <Animated.View style={{
      position: 'absolute',
      left: CX - ORB_SIZE/2,
      top: CY - ORB_SIZE/2,
      width: ORB_SIZE, height: ORB_SIZE,
      transform: [
        { translateY: ty },
        { scale: jumpScale }
      ],
      alignItems: 'center', justifyContent: 'center'
    }}>
      {/* Heavy rich glow */}
      <View style={{ position: 'absolute', width: 60, height: 60, borderRadius: 30, backgroundColor: '#38bdf8', opacity: 0.35 }} />
      <View style={{ position: 'absolute', width: 40, height: 40, borderRadius: 20, backgroundColor: '#38bdf8', opacity: 0.6 }} />
      {/* Solid core */}
      <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: '#FFF', shadowColor: '#FFF', shadowOpacity: 1, shadowRadius: 10 }} />
    </Animated.View>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Main Game Component
// ──────────────────────────────────────────────────────────────────────────────
export default function OrbitPulseGame({
  visible, onClose,
}: {
  visible: boolean; onClose: () => void;
}) {
  const { playSound, stopSound, setGlobalVolume } = useSoundPlayer();

  // ── State ──────────────────────────────────────────────────────────────────
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameOver, setGameOver]   = useState(false);
  const [score, setScore]         = useState(0);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  
  const playerRingRef = useRef(0); // 0=Inner, 1=Mid, 2=Outer
  const jumpDirRef    = useRef(1); // 1 = going outwards, -1 = going inwards
  const obsIdRef      = useRef(0);
  const scoreRef      = useRef(0);
  const reqRef        = useRef<number>(0);
  const lastTimeRef   = useRef<number>(0);

  // Difficulty settings
  const speedRef = useRef(120); // Degrees per second
  const spawnRateRef = useRef(1500); // ms between spawns
  const lastSpawnRef = useRef<number>(0);

  // Animated Values
  const playerRadiusAnim = useRef(new Animated.Value(RINGS[0])).current;
  const playerJumpScale  = useRef(new Animated.Value(1)).current;
  const bgRotation       = useRef(new Animated.Value(0)).current;
  const screenShakeX     = useRef(new Animated.Value(0)).current;
  const screenShakeY     = useRef(new Animated.Value(0)).current;
  
  const omSoundRef       = useRef<Audio.Sound | null>(null);

  // ── Audio ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    (async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, allowsRecordingIOS: false });
        const { sound } = await Audio.Sound.createAsync({ uri: OM_HIT_URL }, { shouldPlay: false, volume: 1.0 });
        omSoundRef.current = sound;
      } catch (e) {}
    })();
    return () => { omSoundRef.current?.unloadAsync(); };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const tanpura = ALL_SLEEP_SOUNDS.find(s => s.id === TANPURA_SOUND_ID);
    if (tanpura) {
      setGlobalVolume(0.5);
      playSound(tanpura, 3600, undefined, 0.5, true);
    }
    return () => { stopSound(); setGlobalVolume(1); };
  }, [visible]);

  // ── Game Loop (Collision & Movement) ───────────────────────────────────────
  const gameLoop = useCallback((time: number) => {
    if (!lastTimeRef.current) lastTimeRef.current = time;
    const dt = (time - lastTimeRef.current) / 1000; // seconds
    lastTimeRef.current = time;

    if (!isPlaying || gameOver) {
      reqRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    // 1. Update Score
    scoreRef.current += dt * 100;
    setScore(Math.floor(scoreRef.current));

    // 2. Increase Difficulty over time
    speedRef.current = 120 + (scoreRef.current * 0.05); // Speed increases
    spawnRateRef.current = Math.max(600, 1500 - (scoreRef.current * 0.3));

    // 3. Spawn Obstacles
    if (time - lastSpawnRef.current > spawnRateRef.current) {
      lastSpawnRef.current = time;
      const newObs: Obstacle = {
        id: obsIdRef.current++,
        ringIdx: Math.floor(Math.random() * 3), // Random ring 0,1,2
        angle: 180, // Spawns at top
        active: true,
      };
      setObstacles(prev => [...prev, newObs]);
    }

    // 4. Move Obstacles & Check Collision
    let collisionDetected = false;
    setObstacles(prev => {
      const pRing = playerRingRef.current;
      const nextObs: Obstacle[] = [];
      
      for (let i = 0; i < prev.length; i++) {
        let obs = prev[i];
        if (!obs.active) continue;

        // Move obstacle (it travels from 180 down to 0/360)
        // Let's have it move positively: 180 -> 360 (which is 0)
        obs.angle += speedRef.current * dt;

        // Collision logic
        // Player is fixed at angle 360 (or 0)
        // Hit box: if angle is between 350 and 370 (±10 degrees) and same ring
        if (obs.ringIdx === pRing && obs.angle >= 350 && obs.angle <= 370) {
          collisionDetected = true;
        }

        // If it passes 380, remove it
        if (obs.angle < 380) {
          nextObs.push(obs);
        }
      }
      return nextObs;
    });

    if (collisionDetected) {
      triggerGameOver();
    } else {
      reqRef.current = requestAnimationFrame(gameLoop);
    }
  }, [isPlaying, gameOver]);

  useEffect(() => {
    reqRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(reqRef.current);
  }, [gameLoop]);

  // ── Background continuous rotation ──
  useEffect(() => {
    if (visible && !gameOver) {
      Animated.loop(Animated.timing(bgRotation, { toValue: 1, duration: 30000, easing: Easing.linear, useNativeDriver: true })).start();
    } else {
      bgRotation.stopAnimation();
    }
  }, [visible, gameOver]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const triggerGameOver = () => {
    setGameOver(true);
    setIsPlaying(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    bgRotation.stopAnimation();
    omSoundRef.current?.playAsync();

    // Intense screen shake
    Animated.sequence([
      Animated.timing(screenShakeX, { toValue: 15, duration: 40, useNativeDriver: true }),
      Animated.timing(screenShakeX, { toValue: -15, duration: 40, useNativeDriver: true }),
      Animated.timing(screenShakeX, { toValue: 10, duration: 40, useNativeDriver: true }),
      Animated.timing(screenShakeX, { toValue: -10, duration: 40, useNativeDriver: true }),
      Animated.timing(screenShakeX, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();
  };

  const handleTap = () => {
    if (gameOver) return;
    if (!isPlaying) {
      setIsPlaying(true);
      lastSpawnRef.current = performance.now();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      return;
    }

    // Jump logic: ping-pong between 0, 1, 2
    let nextRing = playerRingRef.current + jumpDirRef.current;
    if (nextRing > 2) {
      nextRing = 1;
      jumpDirRef.current = -1;
    } else if (nextRing < 0) {
      nextRing = 1;
      jumpDirRef.current = 1;
    }
    
    playerRingRef.current = nextRing;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Animate jump radius & squeeze
    Animated.parallel([
      Animated.spring(playerRadiusAnim, {
        toValue: RINGS[nextRing],
        useNativeDriver: true,
        tension: 80, friction: 8
      }),
      Animated.sequence([
        Animated.timing(playerJumpScale, { toValue: 1.4, duration: 100, useNativeDriver: true }),
        Animated.timing(playerJumpScale, { toValue: 1.0, duration: 150, useNativeDriver: true }),
      ])
    ]).start();
  };

  const restartGame = () => {
    setGameOver(false);
    setScore(0);
    scoreRef.current = 0;
    setObstacles([]);
    playerRingRef.current = 0;
    jumpDirRef.current = 1;
    playerRadiusAnim.setValue(RINGS[0]);
    speedRef.current = 120;
    spawnRateRef.current = 1500;
    lastTimeRef.current = 0;
    // Don't auto start, wait for tap
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent transparent onRequestClose={onClose}>
      <TouchableOpacity activeOpacity={1} onPress={handleTap} style={s.root}>
        
        <Animated.View style={[StyleSheet.absoluteFillObject, { transform: [{ translateX: screenShakeX }, { translateY: screenShakeY }] }]}>
          {/* Deep Rich Background */}
          <LinearGradient colors={['#030014', '#0A0022', '#000000']} style={StyleSheet.absoluteFillObject} />
          <LinearGradient colors={['rgba(56,189,248,0.1)', 'transparent']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: H * 0.4 }} />

          {/* Background Mandala */}
          <MandalaBg rotation={bgRotation} />

          {/* Obstacles rendering */}
          {obstacles.map(obs => {
            const rad = RINGS[obs.ringIdx];
            // Obstacle angle from center
            // Convert angle to radians. Offset by -90 so 180 is top, 360 is bottom.
            const angleRad = (obs.angle - 270) * (Math.PI / 180);
            const ox = CX + rad * Math.cos(angleRad);
            const oy = CY + rad * Math.sin(angleRad);

            return (
              <View key={obs.id} pointerEvents="none" style={{
                position: 'absolute',
                left: ox - OBSTACLE_SIZE/2,
                top: oy - OBSTACLE_SIZE/2,
                width: OBSTACLE_SIZE, height: OBSTACLE_SIZE,
                alignItems: 'center', justifyContent: 'center',
                transform: [{ rotate: `${obs.angle}deg` }] // Point towards center
              }}>
                {/* Aggressive Red/Pink Glow */}
                <View style={{ position: 'absolute', width: 40, height: 40, borderRadius: 10, backgroundColor: '#ef4444', opacity: 0.4 }} />
                {/* Sharp crystal shape */}
                <View style={{ width: 18, height: 18, backgroundColor: '#f43f5e', transform: [{ rotate: '45deg' }], shadowColor: '#f43f5e', shadowOpacity: 1, shadowRadius: 10 }} />
              </View>
            );
          })}

          {/* Player Orb */}
          <PlayerOrb radiusAnim={playerRadiusAnim} jumpScale={playerJumpScale} />

          {/* Top HUD */}
          <View style={s.hudRow} pointerEvents="box-none">
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>

            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: '800', letterSpacing: 2 }}>SCORE</Text>
              <Text style={{ fontSize: 36, fontWeight: '900', color: '#FFF' }}>{score.toLocaleString()}</Text>
            </View>
          </View>

          {/* Start Tutorial / Instructions */}
          {!isPlaying && !gameOver && (
            <View style={{ position: 'absolute', top: CY - 100, left: 40, right: 40, alignItems: 'center' }} pointerEvents="none">
              <View style={{ backgroundColor: 'rgba(0,0,0,0.6)', padding: 24, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(56,189,248,0.4)', alignItems: 'center', shadowColor: '#38bdf8', shadowOpacity: 0.2, shadowRadius: 20 }}>
                <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFillObject} />
                <Ionicons name="finger-print-outline" size={32} color="#38bdf8" style={{ marginBottom: 12 }} />
                <Text style={{ fontSize: 20, fontWeight: '900', color: '#FFF', letterSpacing: 2, marginBottom: 8 }}>HOW TO PLAY</Text>
                
                <View style={{ gap: 10, marginTop: 10, alignItems: 'center' }}>
                  <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.8)', textAlign: 'center', fontWeight: '500' }}>
                    1. Tap <Text style={{ color: '#38bdf8', fontWeight: '800' }}>ANYWHERE</Text> to jump.
                  </Text>
                  <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.8)', textAlign: 'center', fontWeight: '500' }}>
                    2. Bounce between the 3 rings.
                  </Text>
                  <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.8)', textAlign: 'center', fontWeight: '500' }}>
                    3. Dodge the <Text style={{ color: '#ef4444', fontWeight: '800' }}>RED ENERGY</Text>.
                  </Text>
                </View>

                <Animated.View style={{ marginTop: 24, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: 'rgba(56,189,248,0.2)', borderRadius: 99, opacity: Math.sin(Date.now() / 200) > 0 ? 1 : 0.6 }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#38bdf8', letterSpacing: 1 }}>TAP TO START JUMPING</Text>
                </Animated.View>
              </View>
            </View>
          )}

        </Animated.View>

        {/* Game Over Modal */}
        {gameOver && (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center' }]}>
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
            <Text style={{ fontSize: 24, fontWeight: '800', color: '#f87171', letterSpacing: 3, marginBottom: 10 }}>COLLISION</Text>
            <Text style={{ fontSize: 56, fontWeight: '900', color: '#FFF', marginBottom: 30 }}>{score.toLocaleString()}</Text>
            
            <TouchableOpacity onPress={restartGame} style={{ backgroundColor: '#38bdf8', paddingHorizontal: 36, paddingVertical: 16, borderRadius: 99, marginBottom: 15, shadowColor: '#38bdf8', shadowOpacity: 0.5, shadowRadius: 15 }}>
              <Text style={{ color: '#000', fontSize: 18, fontWeight: '900', letterSpacing: 1.5 }}>PLAY AGAIN</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={onClose} style={{ padding: 10 }}>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '600', letterSpacing: 1 }}>RETURN TO WALK</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  hudRow: {
    position: 'absolute', top: 50, left: 20, right: 20,
    flexDirection: 'row', alignItems: 'center',
  },
  closeBtn: {
    width: 44, height: 44,
    borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
    position: 'absolute', left: 0, top: 0, zIndex: 10
  },
});
