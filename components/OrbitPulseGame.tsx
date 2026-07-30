/**
 * OrbitPulseGame.tsx — "Momentum Flow" 2D Physics Game (Level 2)
 * ─────────────────────────────────────────────────────────────────
 * Ultra-rich graphics, 60FPS high-performance physics loop.
 * 
 * New Mechanics:
 *  - Procedural Terrain: Hills interleaved with flat plains.
 *  - Tap to Jump / Hold to Dive.
 *  - Collect Prana Orbs (Bonus & Momentum).
 *  - Avoid Void Crystals (Damage & Slowdown).
 *  - 3 Lives & Game Over screen.
 *  - Deep Starry Parallax visual upgrades.
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View, Text, Modal, StyleSheet, TouchableOpacity,
  Animated, Easing, Dimensions, Platform
} from 'react-native';
import Svg, { Circle, Path, G, Defs, Stop, LinearGradient as SvgLinearGradient } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { useSoundPlayer } from '@/lib/soundPlayerContext';
import { ALL_SLEEP_SOUNDS } from '@/lib/sleepSoundsData';
import { Ionicons } from '@expo/vector-icons';

const { width: W, height: H } = Dimensions.get('window');
const PLAYER_X = W * 0.35; 
const CX = W / 2;
const CY = H / 2;

const OM_HIT_URL = 'https://audio.onesutralabs.com/om.mp3';
const TANPURA_SOUND_ID = 'cdn_new_8';

// ── Terrain Math ────────────────────────────────────────────────────────────
function getTerrainY(x: number) {
  // Combining sine waves for hills
  const hillWave = Math.sin(x / 400) * 180 + Math.sin(x / 200) * 70 + Math.sin(x / 800) * 300;
  
  // Plains multiplier: smoothly transitions between 0 (flat plains) and 1 (full hills)
  // using a slow sine wave clamped between 0 and 1
  const plainsMultiplier = Math.max(0, Math.min(1, Math.sin(x / 1500) * 1.5 + 0.2));
  
  return (hillWave * plainsMultiplier) + 600;
}

function getTerrainSlopeAndAngle(x: number) {
  const dx = 1;
  const dy = getTerrainY(x + dx) - getTerrainY(x - dx);
  const slope = dy / (dx * 2);
  const angle = Math.atan(slope);
  return { slope, angle };
}

// ── Entity Generation ────────────────────────────────────────────────────────
const ENTITY_SPACING = 700;
function getEntityAtChunk(chunkIdx: number) {
  const seed = Math.sin(chunkIdx * 12.9898) * 43758.5453;
  const rand = seed - Math.floor(seed);
  
  if (rand < 0.3) return null; // 30% empty chunk
  
  const x = chunkIdx * ENTITY_SPACING + (rand * 300);
  const ty = getTerrainY(x);
  
  if (rand < 0.65) {
    // Prana Orb (Positive) floating in the air
    return { id: chunkIdx, type: 'prana', x, y: ty - 120 - (rand * 150), active: true, radius: 25 };
  } else {
    // Void Spike (Negative) on the ground
    return { id: chunkIdx, type: 'void', x, y: ty - 20, active: true, radius: 30 };
  }
}

// ── Background Layers ────────────────────────────────────────────────────────
const StarryBackground = React.memo(({ cameraX, cameraY, spin }: any) => {
  // Pre-generate stars
  const stars = useRef(Array.from({ length: 80 }).map(() => ({
    x: Math.random() * W * 2,
    y: Math.random() * H * 1.5,
    r: Math.random() * 2 + 0.5,
    op: Math.random() * 0.8 + 0.2
  }))).current;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <LinearGradient colors={['#05021a', '#0a0526', '#1a0b38']} style={StyleSheet.absoluteFillObject} />
      
      {/* Slow Parallax Stars */}
      <Animated.View style={[StyleSheet.absoluteFillObject, { 
        transform: [
          { translateX: cameraX.interpolate({ inputRange: [0, 1000], outputRange: [0, -20] }) },
          { translateY: cameraY.interpolate({ inputRange: [-1000, 1000], outputRange: [20, -20] }) }
        ]
      }]}>
        <Svg width={W*2} height={H*1.5} style={{ position: 'absolute' }}>
          {stars.map((s, i) => (
            <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#FFF" opacity={s.op} />
          ))}
        </Svg>
      </Animated.View>

      {/* Massive rotating mandala */}
      <Animated.View style={{ position: 'absolute', top: H * 0.1, left: CX - 300, width: 600, height: 600, transform: [{ rotate: spin }], opacity: 0.15 }}>
        <Svg width={600} height={600} viewBox="0 0 600 600">
           {Array.from({length: 12}).map((_, i) => (
             <G key={i} rotation={i * 30} origin="300,300">
               <Path d={`M300 150 Q380 50 300 0 Q220 50 300 150 Z`} fill="#818cf8" />
             </G>
           ))}
        </Svg>
      </Animated.View>
    </View>
  );
});

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
  const [health, setHealth]       = useState(3);
  const [maxCombo, setMaxCombo]   = useState(1);
  const [showTutorial, setShowTutorial] = useState(true);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  
  // Native Refs
  const terrainPathRef = useRef<any>(null);
  const bgTerrainPathRef = useRef<any>(null);
  const pranaPathRef = useRef<any>(null);
  const voidPathRef = useRef<any>(null);
  const playerRef = useRef<any>(null);
  const cameraWrapperRef = useRef<any>(null);
  
  const reqRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const scoreRef = useRef(0);

  // Physics & Entity State
  const p = useRef({
    x: 0,
    y: 100,
    vx: 350,
    vy: 0,
    isGrounded: false,
    cameraX: 0,
    cameraY: 0,
  }).current;

  // Track active entities
  const activeEntities = useRef<any[]>([]).current;
  const lastChunkGenerated = useRef(-1);

  const inputRef = useRef({ isPressing: false, pressStartTime: 0 });
  const bgRotation = useRef(new Animated.Value(0)).current;
  const cameraXAnim = useRef(new Animated.Value(0)).current;
  const cameraYAnim = useRef(new Animated.Value(0)).current;
  const screenFlash = useRef(new Animated.Value(0)).current;
  const screenFlashColor = useRef('#FFF');
  const screenShake = useRef(new Animated.Value(0)).current;
  const speedLinesOp = useRef(new Animated.Value(0)).current;
  
  const omSoundRef = useRef<Audio.Sound | null>(null);

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

  // ── Visual FX ──────────────────────────────────────────────────────────────
  const flashScreen = (color: string, intensity: number, duration: number) => {
    screenFlashColor.current = color;
    screenFlash.setValue(intensity);
    Animated.timing(screenFlash, { toValue: 0, duration, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
  };

  const triggerShake = (intensity: number) => {
    Animated.sequence([
      Animated.timing(screenShake, { toValue: intensity, duration: 40, useNativeDriver: true }),
      Animated.timing(screenShake, { toValue: -intensity, duration: 40, useNativeDriver: true }),
      Animated.timing(screenShake, { toValue: intensity * 0.6, duration: 40, useNativeDriver: true }),
      Animated.timing(screenShake, { toValue: -intensity * 0.6, duration: 40, useNativeDriver: true }),
      Animated.timing(screenShake, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();
  };

  const triggerPerfectLanding = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    omSoundRef.current?.setPositionAsync(0);
    omSoundRef.current?.playAsync();
    flashScreen('#FFF', 0.4, 400);
    triggerShake(12);
    setMaxCombo(c => c + 1);
  }, []);

  const triggerPranaCollect = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    flashScreen('#34d399', 0.2, 300);
    scoreRef.current += 500;
  }, []);

  const triggerDamage = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    flashScreen('#ef4444', 0.5, 500);
    triggerShake(20);
    setMaxCombo(1);
    
    // Play Tanpura loop snippet on collision as requested by user
    const tanpura = ALL_SLEEP_SOUNDS.find(s => s.id === TANPURA_SOUND_ID);
    if (tanpura) {
      playSound(tanpura, 3, undefined, 1.0, false);
    }
    
    setHealth(h => {
      const newH = h - 1;
      if (newH <= 0) {
        setIsPlaying(false);
        setGameOver(true);
      }
      return newH;
    });
  }, [playSound]);

  // ── Physics Engine & Game Loop ──────────────────────────────────────────────
  const gameLoop = useCallback((time: number) => {
    if (!lastTimeRef.current) lastTimeRef.current = time;
    const dt = Math.min((time - lastTimeRef.current) / 1000, 0.05);
    lastTimeRef.current = time;

    if (!isPlaying || gameOver) {
      reqRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    const GRAVITY = 1800;
    const DIVE_GRAVITY = 5500;
    const BASE_SPEED = 400;
    const MAX_SPEED = 2400;
    const DRAG = 0.99;
    const FRICTION = 0.995;

    // 1. Apply Forces
    if (inputRef.current.isPressing) {
      p.vy += DIVE_GRAVITY * dt;
    } else {
      p.vy += GRAVITY * dt;
    }

    // Decay speed naturally
    if (p.vx > BASE_SPEED) {
      p.vx = p.vx * (p.isGrounded ? FRICTION : DRAG) - (20 * dt);
      if (p.vx < BASE_SPEED) p.vx = BASE_SPEED;
    } else if (p.vx < BASE_SPEED) {
      p.vx += 400 * dt; // recover speed
    }

    // 2. Move Player
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // 3. Generate Entities
    const currentChunk = Math.floor(p.x / ENTITY_SPACING);
    // Generate chunks slightly ahead
    for (let c = lastChunkGenerated.current + 1; c <= currentChunk + 3; c++) {
      const ent = getEntityAtChunk(c);
      if (ent) activeEntities.push(ent);
      lastChunkGenerated.current = c;
    }

    // Cleanup old entities behind player
    for (let i = activeEntities.length - 1; i >= 0; i--) {
      if (activeEntities[i].x < p.x - W) {
        activeEntities.splice(i, 1);
      }
    }

    // 4. Collision Detection with Entities
    const PLAYER_R = 15;
    for (const ent of activeEntities) {
      if (!ent.active) continue;
      const dx = p.x - ent.x;
      const dy = p.y - ent.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      
      if (dist < PLAYER_R + ent.radius) {
        ent.active = false; // consume
        if (ent.type === 'prana') {
          p.vx = Math.min(p.vx + 200, MAX_SPEED); // boost
          triggerPranaCollect();
        } else if (ent.type === 'void') {
          p.vx = BASE_SPEED * 0.3; // halt speed
          p.vy = -500; // bounce off
          p.isGrounded = false;
          triggerDamage();
        }
      }
    }

    // 5. Collision Detection with Terrain
    const groundY = getTerrainY(p.x);
    const { slope, angle } = getTerrainSlopeAndAngle(p.x);

    if (p.y >= groundY) {
      if (!p.isGrounded) {
        // Landing event
        const velocityAngle = Math.atan2(p.vy, p.vx);
        const impactDiff = Math.abs(velocityAngle - angle);
        
        if (slope > 0 && impactDiff < 0.6 && inputRef.current.isPressing && p.vy > 400) {
          // PERFECT LANDING
          p.vx = Math.min(p.vx + p.vy * 0.9, MAX_SPEED);
          triggerPerfectLanding();
        } else if (slope < -0.3 && p.vy > 400) {
          // HARD CRASH INTO UPHILL
          p.vx = BASE_SPEED * 0.4;
          triggerShake(8);
          setMaxCombo(1);
        }
      }

      p.isGrounded = true;
      p.y = groundY;
      
      const vMag = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      p.vx = vMag * Math.cos(angle);
      p.vy = vMag * Math.sin(angle);

      // Accelerate downhill if pressing
      if (inputRef.current.isPressing && slope > 0) {
        p.vx += 1800 * Math.sin(angle) * dt;
        p.vx = Math.min(p.vx, MAX_SPEED);
      }
      
      // Launch uphill if released
      if (!inputRef.current.isPressing && slope < 0) {
        p.isGrounded = false; 
      }
    } else {
      p.isGrounded = false;
    }

    // Update score
    scoreRef.current += (p.vx * dt) / 10;
    if (Math.floor(scoreRef.current) % 10 === 0) {
      setScore(Math.floor(scoreRef.current));
    }

    // Speed lines opacity based on speed
    const speedRatio = Math.max(0, (p.vx - 800) / (MAX_SPEED - 800));
    speedLinesOp.setValue(speedRatio);

    // 6. Render Updates via Native Props
    
    // Main Terrain Path
    const points = [];
    const step = 25; 
    for (let lx = 0; lx <= W + 100; lx += step) {
      const worldX = p.x - PLAYER_X + lx;
      points.push(`${lx},${getTerrainY(worldX)}`);
    }
    const d = `M0,${H * 2} L0,${getTerrainY(p.x - PLAYER_X)} L${points.join(' L')} L${W + 100},${H * 2} Z`;
    terrainPathRef.current?.setNativeProps({ d });

    // Background Parallax Hills
    const bgPoints = [];
    for (let lx = 0; lx <= W + 100; lx += step) {
      const worldX = (p.x * 0.5) - PLAYER_X + lx; // 0.5 parallax speed
      // different sine seed for bg hills
      const bgY = (Math.sin(worldX / 500) * 150 + Math.sin(worldX / 300) * 80) + 500;
      bgPoints.push(`${lx},${bgY}`);
    }
    const bgD = `M0,${H * 2} L0,${(Math.sin(((p.x*0.5) - PLAYER_X) / 500) * 150 + Math.sin(((p.x*0.5) - PLAYER_X) / 300) * 80) + 500} L${bgPoints.join(' L')} L${W + 100},${H * 2} Z`;
    bgTerrainPathRef.current?.setNativeProps({ d: bgD });

    // Build Entity SVGs
    let pranaD = '';
    let voidD = '';
    for (const ent of activeEntities) {
      if (!ent.active) continue;
      const screenX = ent.x - p.x + PLAYER_X;
      if (screenX < -100 || screenX > W + 100) continue;
      
      if (ent.type === 'prana') {
        const r = ent.radius;
        // SVG circle path
        pranaD += `M ${screenX},${ent.y} m -${r},0 a ${r},${r} 0 1,0 ${r*2},0 a ${r},${r} 0 1,0 -${r*2},0 `;
      } else if (ent.type === 'void') {
        const r = ent.radius;
        // Triangle spike
        voidD += `M ${screenX},${ent.y - r} L ${screenX + r},${ent.y + r} L ${screenX - r},${ent.y + r} Z `;
      }
    }
    pranaPathRef.current?.setNativeProps({ d: pranaD });
    voidPathRef.current?.setNativeProps({ d: voidD });

    // Smooth Camera Tracking
    const targetCameraY = p.y - H * 0.6;
    p.cameraY += (targetCameraY - p.cameraY) * 0.1;
    p.cameraX = p.x;

    cameraXAnim.setValue(p.cameraX);
    cameraYAnim.setValue(p.cameraY);

    cameraWrapperRef.current?.setNativeProps({
      style: { transform: [{ translateY: -p.cameraY }] }
    });

    // Player Rotation based on velocity
    const rot = Math.atan2(p.vy, p.vx) * (180 / Math.PI);
    
    playerRef.current?.setNativeProps({
      style: { transform: [{ translateY: p.y }, { rotate: `${rot}deg` }] }
    });

    reqRef.current = requestAnimationFrame(gameLoop);
  }, [isPlaying, gameOver, triggerPerfectLanding, triggerDamage, triggerPranaCollect]);

  useEffect(() => {
    reqRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(reqRef.current);
  }, [gameLoop]);

  // ── Background continuous rotation ──
  useEffect(() => {
    if (visible) {
      Animated.loop(Animated.timing(bgRotation, { toValue: 1, duration: 40000, easing: Easing.linear, useNativeDriver: true })).start();
    }
  }, [visible]);

  // ── Input Handling ─────────────────────────────────────────────────────────
  const handlePressIn = () => {
    if (showTutorial) {
      setShowTutorial(false);
      setIsPlaying(true);
      lastTimeRef.current = performance.now();
    }
    if (gameOver) return;

    inputRef.current.isPressing = true;
    inputRef.current.pressStartTime = performance.now();
    
    // Squish on press
    playerRef.current?.setNativeProps({ style: { transform: [{ translateY: p.y }, { scaleX: 1.2 }, { scaleY: 0.8 }] } });
  };

  const handlePressOut = () => {
    if (gameOver) return;
    inputRef.current.isPressing = false;
    
    // Tap to JUMP logic
    const pressDuration = performance.now() - inputRef.current.pressStartTime;
    if (pressDuration < 200 && p.isGrounded) {
      p.vy = -1400; // Jump force
      p.isGrounded = false;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    playerRef.current?.setNativeProps({ style: { transform: [{ translateY: p.y }, { scaleX: 1 }, { scaleY: 1 }] } });
  };

  const restartGame = () => {
    p.x = 0; p.y = 100; p.vx = 400; p.vy = 0; p.isGrounded = false;
    scoreRef.current = 0;
    setScore(0);
    setHealth(3);
    setMaxCombo(1);
    activeEntities.length = 0;
    lastChunkGenerated.current = -1;
    setGameOver(false);
    setIsPlaying(true);
    lastTimeRef.current = performance.now();
  };

  const handleClosePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsPlaying(false);
    setShowQuitConfirm(true);
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent transparent onRequestClose={onClose}>
      <TouchableOpacity 
        activeOpacity={1} 
        onPressIn={handlePressIn} 
        onPressOut={handlePressOut}
        style={s.root}
      >
        <StarryBackground cameraX={cameraXAnim} cameraY={cameraYAnim} spin={bgRotation} />

        {/* Screen Flash */}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: screenFlashColor.current, opacity: screenFlash, zIndex: 10 }]} />

        {/* Speed Lines */}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { opacity: speedLinesOp, zIndex: 5 }]}>
          <LinearGradient colors={['rgba(255,255,255,0.0)', 'rgba(56,189,248,0.25)', 'rgba(255,255,255,0.0)']} start={{x:0, y:0}} end={{x:1, y:0}} style={{ position: 'absolute', top: H*0.2, left: 0, right: 0, height: 2 }} />
          <LinearGradient colors={['rgba(255,255,255,0.0)', 'rgba(192,132,252,0.25)', 'rgba(255,255,255,0.0)']} start={{x:0, y:0}} end={{x:1, y:0}} style={{ position: 'absolute', top: H*0.5, left: 0, right: 0, height: 3 }} />
          <LinearGradient colors={['rgba(255,255,255,0.0)', 'rgba(56,189,248,0.3)', 'rgba(255,255,255,0.0)']} start={{x:0, y:0}} end={{x:1, y:0}} style={{ position: 'absolute', top: H*0.8, left: 0, right: 0, height: 2 }} />
        </Animated.View>

        {/* ── Camera Wrapper ── */}
        <Animated.View ref={cameraWrapperRef} style={[StyleSheet.absoluteFillObject, { transform: [{ translateX: screenShake }] }]}>
          
          {/* Background Hills Layer */}
          <Svg width={W + 100} height={H * 2} style={{ position: 'absolute', top: 0, left: 0, opacity: 0.4 }}>
            <Defs>
              <SvgLinearGradient id="bgHillGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#818cf8" stopOpacity="0.6" />
                <Stop offset="1" stopColor="#1e1b4b" stopOpacity="1" />
              </SvgLinearGradient>
            </Defs>
            <Path ref={bgTerrainPathRef} fill="url(#bgHillGrad)" />
          </Svg>

          {/* Main Terrain Layer */}
          <Svg width={W + 100} height={H * 2} style={{ position: 'absolute', top: 0, left: 0 }}>
            <Defs>
              <SvgLinearGradient id="hillGradient" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#38bdf8" stopOpacity="0.7" />
                <Stop offset="0.15" stopColor="#6d28d9" stopOpacity="0.9" />
                <Stop offset="1" stopColor="#020010" stopOpacity="1" />
              </SvgLinearGradient>
              <SvgLinearGradient id="pranaGrad" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#34d399" stopOpacity="1" />
                <Stop offset="1" stopColor="#10b981" stopOpacity="0.4" />
              </SvgLinearGradient>
            </Defs>
            
            {/* Terrain Body */}
            <Path ref={terrainPathRef} fill="url(#hillGradient)" stroke="#60a5fa" strokeWidth="6" strokeLinecap="round" />
            
            {/* Entities */}
            <Path ref={pranaPathRef} fill="url(#pranaGrad)" />
            <Path ref={voidPathRef} fill="#ef4444" stroke="#7f1d1d" strokeWidth="2" />
          </Svg>

          {/* Player Orb */}
          <View ref={playerRef} style={{
            position: 'absolute',
            left: PLAYER_X - 12,
            width: 24, height: 24,
            alignItems: 'center', justifyContent: 'center'
          }}>
            {/* Massive rich glow */}
            <View style={{ position: 'absolute', width: 90, height: 90, borderRadius: 45, backgroundColor: '#38bdf8', opacity: 0.25 }} />
            <View style={{ position: 'absolute', width: 44, height: 44, borderRadius: 22, backgroundColor: '#c084fc', opacity: 0.8 }} />
            {/* Solid core */}
            <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: '#FFF', shadowColor: '#FFF', shadowOpacity: 1, shadowRadius: 20 }} />
          </View>
        </Animated.View>

        {/* ── Top HUD ── */}
        <View style={s.hudRow} pointerEvents="box-none">
          <TouchableOpacity onPress={handleClosePress} style={s.closeBtn}>
            <Ionicons name="close" size={24} color="#FFF" />
          </TouchableOpacity>

          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '800', letterSpacing: 2 }}>FLOW SCORE</Text>
            <Text style={{ fontSize: 40, fontWeight: '900', color: '#FFF', textShadowColor: '#38bdf8', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 }}>{score.toLocaleString()}</Text>
          </View>

          <View style={{ width: 60, alignItems: 'flex-end' }}>
             <Text style={{ color: '#ef4444', fontWeight: '900', fontSize: 16 }}>
               {Array.from({length: health}).map(() => '❤️').join('')}
             </Text>
          </View>
        </View>

        {/* Tutorial Overlay */}
        {showTutorial && (
          <View style={{ position: 'absolute', top: CY - 120, left: 20, right: 20, alignItems: 'center' }} pointerEvents="none">
            <View style={{ backgroundColor: 'rgba(10,5,30,0.8)', padding: 24, borderRadius: 32, borderWidth: 1, borderColor: 'rgba(56,189,248,0.5)', alignItems: 'center', shadowColor: '#38bdf8', shadowOpacity: 0.3, shadowRadius: 30 }}>
              <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
              <Ionicons name="infinite" size={36} color="#38bdf8" style={{ marginBottom: 12 }} />
              <Text style={{ fontSize: 22, fontWeight: '900', color: '#FFF', letterSpacing: 2, marginBottom: 16 }}>MOMENTUM FLOW 2.0</Text>
              
              <View style={{ gap: 14, alignItems: 'flex-start', width: '100%' }}>
                <Text style={{ fontSize: 16, color: '#FFF', fontWeight: '600' }}>
                  👇 <Text style={{ color: '#38bdf8', fontWeight: '800' }}>PRESS & HOLD</Text> to dive downhill.
                </Text>
                <Text style={{ fontSize: 16, color: '#FFF', fontWeight: '600' }}>
                  👆 <Text style={{ color: '#c084fc', fontWeight: '800' }}>TAP QUICKLY</Text> to Jump!
                </Text>
                <Text style={{ fontSize: 16, color: '#FFF', fontWeight: '600' }}>
                  🟢 <Text style={{ color: '#34d399', fontWeight: '800' }}>COLLECT PRANA</Text> for massive boosts.
                </Text>
                <Text style={{ fontSize: 16, color: '#FFF', fontWeight: '600' }}>
                  🔴 <Text style={{ color: '#ef4444', fontWeight: '800' }}>AVOID VOID CRYSTALS</Text> or lose health.
                </Text>
              </View>

              <Animated.View style={{ marginTop: 28, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: 'rgba(56,189,248,0.2)', borderRadius: 99, borderWidth: 1, borderColor: '#38bdf8' }}>
                <Text style={{ fontSize: 15, fontWeight: '900', color: '#38bdf8', letterSpacing: 1.5 }}>TAP TO BEGIN</Text>
              </Animated.View>
            </View>
          </View>
        )}

        {/* Game Over Overlay */}
        {gameOver && (
          <View style={{ position: 'absolute', top: CY - 100, left: 40, right: 40, alignItems: 'center', zIndex: 100 }}>
            <View style={{ backgroundColor: 'rgba(20,5,5,0.9)', padding: 32, borderRadius: 32, borderWidth: 1, borderColor: 'rgba(239,68,68,0.5)', alignItems: 'center' }}>
              <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
              <Text style={{ fontSize: 32, fontWeight: '900', color: '#ef4444', letterSpacing: 4, marginBottom: 12 }}>GAME OVER</Text>
              <Text style={{ fontSize: 18, color: 'rgba(255,255,255,0.7)', fontWeight: '600', marginBottom: 24 }}>Final Score: <Text style={{ color: '#FFF' }}>{score.toLocaleString()}</Text></Text>
              
              <TouchableOpacity onPress={restartGame} style={{ paddingHorizontal: 32, paddingVertical: 14, backgroundColor: '#ef4444', borderRadius: 99, marginBottom: 12, width: '100%', alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: '900', color: '#FFF', letterSpacing: 1 }}>PLAY AGAIN</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={{ paddingHorizontal: 32, paddingVertical: 14, backgroundColor: 'transparent', borderRadius: 99, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', width: '100%', alignItems: 'center' }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: 'rgba(255,255,255,0.5)' }}>QUIT GAME</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Quit Confirmation Overlay */}
        {showQuitConfirm && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
            <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFillObject} />
            <View style={{ backgroundColor: 'rgba(10,5,30,0.85)', padding: 32, borderRadius: 32, borderWidth: 1, borderColor: 'rgba(192,132,252,0.5)', alignItems: 'center', shadowColor: '#c084fc', shadowOpacity: 0.3, shadowRadius: 30, width: '85%' }}>
              <Ionicons name="moon" size={40} color="#c084fc" style={{ marginBottom: 16 }} />
              <Text style={{ fontSize: 22, fontWeight: '900', color: '#FFF', letterSpacing: 1.5, textAlign: 'center', marginBottom: 12 }}>LEAVING THE FLOW?</Text>
              <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.7)', fontWeight: '500', textAlign: 'center', marginBottom: 32, lineHeight: 24 }}>Your cosmic journey will be paused. Are you sure you want to exit?</Text>
              
              <View style={{ width: '100%', gap: 12 }}>
                <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowQuitConfirm(false); setIsPlaying(true); lastTimeRef.current = performance.now(); }} style={{ paddingVertical: 16, backgroundColor: '#c084fc', borderRadius: 99, alignItems: 'center' }}>
                  <Text style={{ fontSize: 15, fontWeight: '900', color: '#FFF', letterSpacing: 1 }}>STAY IN FLOW</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onClose(); }} style={{ paddingVertical: 16, backgroundColor: 'transparent', borderRadius: 99, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center' }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: 'rgba(255,255,255,0.5)' }}>END SESSION</Text>
                </TouchableOpacity>
              </View>
            </View>
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
    flexDirection: 'row', alignItems: 'flex-start', zIndex: 100
  },
  closeBtn: {
    width: 44, height: 44,
    borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
});
