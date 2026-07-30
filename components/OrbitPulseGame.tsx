/**
 * OrbitPulseGame.tsx — "Momentum Flow" 2D Physics Game
 * ─────────────────────────────────────────────────────────────────
 * Ultra-rich graphics, 60FPS high-performance physics loop.
 * 
 * Rules:
 *  - Press and hold the screen to DIVE (gain momentum downhill).
 *  - Release to launch into the sky.
 *  - Perfect landings trigger the Om chant and massive speed boosts.
 *  - Deep parallax mandala background and glowing synth-style hills.
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View, Text, Modal, StyleSheet, TouchableOpacity,
  Animated, Easing, Dimensions, Platform
} from 'react-native';
import Svg, { Circle, Path, G, Defs, RadialGradient, Stop, LinearGradient as SvgLinearGradient } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { useSoundPlayer } from '@/lib/soundPlayerContext';
import { ALL_SLEEP_SOUNDS } from '@/lib/sleepSoundsData';
import { Ionicons } from '@expo/vector-icons';

const { width: W, height: H } = Dimensions.get('window');
const PLAYER_X = W * 0.35; // Player is fixed at 35% of the screen width
const CX = W / 2;
const CY = H / 2;

const OM_HIT_URL = 'https://audio.onesutralabs.com/om.mp3';
const TANPURA_SOUND_ID = 'cdn_new_8';

// ── Terrain Math ────────────────────────────────────────────────────────────
function getTerrainY(x: number) {
  // A complex sum of sine waves to create beautiful rolling hills
  const scale = 1.0; // increase for steeper hills
  const y1 = Math.sin(x / 400) * 180 * scale;
  const y2 = Math.sin(x / 200) * 70 * scale;
  const y3 = Math.sin(x / 800) * 300 * scale;
  return y1 + y2 + y3 + 600; // Base height is 600
}

function getTerrainSlopeAndAngle(x: number) {
  const dx = 1;
  const dy = getTerrainY(x + dx) - getTerrainY(x - dx);
  const slope = dy / (dx * 2);
  const angle = Math.atan(slope);
  return { slope, angle };
}

// ── Static Mandala Background (Parallax) ────────────────────────────────────
const MandalaParallax = React.memo(({ rotation }: { rotation: Animated.Value }) => {
  const L = 600;
  const c = L / 2;
  const petals = (n: number, r: number, color: string, opacity: number) => {
    const els = [];
    for (let i = 0; i < n; i++) {
      const a = (i * 360) / n;
      els.push(
        <G key={i} rotation={a} origin={`${c},${c}`}>
          <Path d={`M${c} ${c - r * 0.3} Q${c + r * 0.55} ${c - r * 0.85} ${c} ${c - r} Q${c - r * 0.55} ${c - r * 0.85} ${c} ${c - r * 0.3} Z`} fill={color} opacity={opacity} />
        </G>
      );
    }
    return els;
  };

  const spin = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const spinRev = rotation.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {/* Deep Space Background */}
      <LinearGradient colors={['#030014', '#0f0524', '#1f0d3d']} style={StyleSheet.absoluteFillObject} />
      
      {/* Sun / Core */}
      <View style={{ position: 'absolute', top: H * 0.3, left: CX - 100, width: 200, height: 200, borderRadius: 100, backgroundColor: '#c084fc', opacity: 0.1, shadowColor: '#c084fc', shadowOpacity: 1, shadowRadius: 100 }} />

      {/* Massive rotating mandala 1 */}
      <Animated.View style={{ position: 'absolute', top: H * 0.1, left: CX - L/2, width: L, height: L, transform: [{ rotate: spin }] }}>
        <Svg width={L} height={L} viewBox={`0 0 ${L} ${L}`}>
          {petals(12, 200, '#60a5fa', 0.08)}
          {petals(24, 280, '#c084fc', 0.05)}
        </Svg>
      </Animated.View>

      {/* Massive rotating mandala 2 (reverse) */}
      <Animated.View style={{ position: 'absolute', top: H * 0.2, left: -100, width: L, height: L, transform: [{ rotate: spinRev }] }}>
        <Svg width={L} height={L} viewBox={`0 0 ${L} ${L}`}>
          {petals(16, 250, '#38bdf8', 0.06)}
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
  const [score, setScore]         = useState(0);
  const [maxCombo, setMaxCombo]   = useState(1);
  const [showTutorial, setShowTutorial] = useState(true);
  
  // Refs for ultra-fast native manipulation (bypassing React state for 60FPS)
  const terrainPathRef = useRef<any>(null);
  const playerRef = useRef<any>(null);
  const cameraWrapperRef = useRef<any>(null);
  const trailContainerRef = useRef<any>(null);
  
  const scoreRef = useRef(0);
  const reqRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  // Physics State
  const p = useRef({
    x: 0,
    y: 100,
    vx: 300,
    vy: 0,
    isGrounded: false,
    cameraY: 0
  }).current;

  const inputRef = useRef({ isPressing: false });
  const bgRotation = useRef(new Animated.Value(0)).current;
  const screenFlash = useRef(new Animated.Value(0)).current;
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
  const triggerPerfectLanding = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    omSoundRef.current?.setPositionAsync(0);
    omSoundRef.current?.playAsync();
    
    // Intense visual flash and shake
    Animated.sequence([
      Animated.timing(screenFlash, { toValue: 0.4, duration: 50, useNativeDriver: true }),
      Animated.timing(screenFlash, { toValue: 0, duration: 400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start();

    Animated.sequence([
      Animated.timing(screenShake, { toValue: 12, duration: 40, useNativeDriver: true }),
      Animated.timing(screenShake, { toValue: -12, duration: 40, useNativeDriver: true }),
      Animated.timing(screenShake, { toValue: 8, duration: 40, useNativeDriver: true }),
      Animated.timing(screenShake, { toValue: -8, duration: 40, useNativeDriver: true }),
      Animated.timing(screenShake, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();
    
    setMaxCombo(c => c + 1);
  }, []);

  const triggerCrash = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMaxCombo(1);
    // Subtle red flash
    Animated.sequence([
      Animated.timing(screenFlash, { toValue: 0.2, duration: 50, useNativeDriver: true }),
      Animated.timing(screenFlash, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  // ── Physics Engine & Game Loop ──────────────────────────────────────────────
  const gameLoop = useCallback((time: number) => {
    if (!lastTimeRef.current) lastTimeRef.current = time;
    const dt = Math.min((time - lastTimeRef.current) / 1000, 0.05); // cap dt to prevent huge jumps
    lastTimeRef.current = time;

    if (!isPlaying) {
      reqRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    const GRAVITY = 1500;
    const DIVE_GRAVITY = 5000;
    const BASE_SPEED = 350;
    const MAX_SPEED = 2200;
    const DRAG = 0.99; // Air resistance
    const FRICTION = 0.995; // Ground friction

    // 1. Apply Forces
    if (inputRef.current.isPressing) {
      p.vy += DIVE_GRAVITY * dt;
    } else {
      p.vy += GRAVITY * dt;
    }

    // Horizontal speed slowly naturally decays to base speed if in air or just rolling
    if (p.vx > BASE_SPEED) {
      p.vx = p.vx * (p.isGrounded ? FRICTION : DRAG) - (20 * dt);
      if (p.vx < BASE_SPEED) p.vx = BASE_SPEED;
    } else if (p.vx < BASE_SPEED) {
      p.vx += 300 * dt; // recover speed
    }

    // 2. Move Player
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // 3. Collision Detection with Terrain
    const groundY = getTerrainY(p.x);
    const { slope, angle } = getTerrainSlopeAndAngle(p.x);

    if (p.y >= groundY) {
      // We hit the ground
      if (!p.isGrounded) {
        // Landing event
        // Calculate impact angle difference
        const velocityAngle = Math.atan2(p.vy, p.vx);
        const impactDiff = Math.abs(velocityAngle - angle);
        
        // If the ground is sloping down, and we dive perfectly into it
        if (slope > 0 && impactDiff < 0.6 && inputRef.current.isPressing && p.vy > 400) {
          // PERFECT LANDING! Massive speed boost.
          p.vx = Math.min(p.vx + p.vy * 0.8, MAX_SPEED);
          triggerPerfectLanding();
        } else if (slope < -0.2 && p.vy > 300) {
          // CRASH (Smashing into a hill upwards)
          p.vx = BASE_SPEED * 0.5; // Kill speed
          triggerCrash();
        }
      }

      p.isGrounded = true;
      p.y = groundY;
      
      // Calculate velocity vector along the slope
      const vMag = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      p.vx = vMag * Math.cos(angle);
      p.vy = vMag * Math.sin(angle);

      // If pressing while on ground going downhill, accelerate massively
      if (inputRef.current.isPressing && slope > 0) {
        p.vx += 1500 * Math.sin(angle) * dt;
        p.vx = Math.min(p.vx, MAX_SPEED);
      }
      
      // If NOT pressing while going uphill, launch into the air naturally
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

    // 4. Render Updates via Native Props (Insanely fast, no React renders)
    // Build the SVG path string for the visible screen width
    const points = [];
    const step = 20; // resolution of terrain curve
    for (let lx = 0; lx <= W + 100; lx += step) {
      const worldX = p.x - PLAYER_X + lx;
      points.push(`${lx},${getTerrainY(worldX)}`);
    }
    const d = `M0,${H * 2} L0,${getTerrainY(p.x - PLAYER_X)} L${points.join(' L')} L${W + 100},${H * 2} Z`;
    
    terrainPathRef.current?.setNativeProps({ d });

    // Smooth Camera Tracking
    // We want the player to stay roughly in the lower-middle of the screen.
    const targetCameraY = p.y - H * 0.6;
    p.cameraY += (targetCameraY - p.cameraY) * 0.1; // Smooth interpolation

    cameraWrapperRef.current?.setNativeProps({
      style: { transform: [{ translateY: -p.cameraY }] }
    });

    playerRef.current?.setNativeProps({
      style: { transform: [{ translateY: p.y }] }
    });

    reqRef.current = requestAnimationFrame(gameLoop);
  }, [isPlaying, triggerPerfectLanding, triggerCrash]);

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
    inputRef.current.isPressing = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Squeeze animation
    playerRef.current?.setNativeProps({ style: { transform: [{ translateY: p.y }, { scaleX: 1.2 }, { scaleY: 0.8 }] } });
  };

  const handlePressOut = () => {
    inputRef.current.isPressing = false;
    // Release animation
    playerRef.current?.setNativeProps({ style: { transform: [{ translateY: p.y }, { scaleX: 0.9 }, { scaleY: 1.1 }] } });
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
        <MandalaParallax rotation={bgRotation} />

        {/* Screen Flash (Red for crash, White for perfect) */}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: '#FFF', opacity: screenFlash, zIndex: 10 }]} />

        {/* Speed Lines (Overlay when moving fast) */}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { opacity: speedLinesOp, zIndex: 5 }]}>
          <LinearGradient colors={['rgba(255,255,255,0.0)', 'rgba(56,189,248,0.15)', 'rgba(255,255,255,0.0)']} start={{x:0, y:0}} end={{x:1, y:0}} style={{ position: 'absolute', top: H*0.2, left: 0, right: 0, height: 2 }} />
          <LinearGradient colors={['rgba(255,255,255,0.0)', 'rgba(192,132,252,0.15)', 'rgba(255,255,255,0.0)']} start={{x:0, y:0}} end={{x:1, y:0}} style={{ position: 'absolute', top: H*0.5, left: 0, right: 0, height: 3 }} />
          <LinearGradient colors={['rgba(255,255,255,0.0)', 'rgba(56,189,248,0.2)', 'rgba(255,255,255,0.0)']} start={{x:0, y:0}} end={{x:1, y:0}} style={{ position: 'absolute', top: H*0.8, left: 0, right: 0, height: 2 }} />
        </Animated.View>

        {/* ── Camera Wrapper (Moves up and down to follow player) ── */}
        <Animated.View ref={cameraWrapperRef} style={[StyleSheet.absoluteFillObject, { transform: [{ translateX: screenShake }] }]}>
          
          {/* Dynamic Terrain */}
          <Svg width={W + 100} height={H * 2} style={{ position: 'absolute', top: 0, left: 0 }}>
            <Defs>
              <SvgLinearGradient id="hillGradient" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#38bdf8" stopOpacity="0.4" />
                <Stop offset="0.1" stopColor="#9333ea" stopOpacity="0.8" />
                <Stop offset="1" stopColor="#030014" stopOpacity="1" />
              </SvgLinearGradient>
            </Defs>
            {/* The Path is updated 60fps via setNativeProps */}
            <Path ref={terrainPathRef} fill="url(#hillGradient)" stroke="#60a5fa" strokeWidth="4" />
          </Svg>

          {/* Player Orb */}
          <View ref={playerRef} style={{
            position: 'absolute',
            left: PLAYER_X - 12,
            width: 24, height: 24,
            alignItems: 'center', justifyContent: 'center'
          }}>
            {/* Massive rich glow */}
            <View style={{ position: 'absolute', width: 80, height: 80, borderRadius: 40, backgroundColor: '#38bdf8', opacity: 0.2 }} />
            <View style={{ position: 'absolute', width: 40, height: 40, borderRadius: 20, backgroundColor: '#c084fc', opacity: 0.6 }} />
            {/* Solid core */}
            <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: '#FFF', shadowColor: '#FFF', shadowOpacity: 1, shadowRadius: 15 }} />
          </View>
        </Animated.View>

        {/* ── Top HUD ── */}
        <View style={s.hudRow} pointerEvents="box-none">
          <TouchableOpacity onPress={onClose} style={s.closeBtn}>
            <Ionicons name="close" size={24} color="#FFF" />
          </TouchableOpacity>

          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: '800', letterSpacing: 2 }}>FLOW SCORE</Text>
            <Text style={{ fontSize: 36, fontWeight: '900', color: '#FFF' }}>{score.toLocaleString()}</Text>
            {maxCombo > 1 && (
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#f59e0b', marginTop: 4 }}>x{maxCombo} MULTIPLIER</Text>
            )}
          </View>
        </View>

        {/* Tutorial Overlay */}
        {showTutorial && (
          <View style={{ position: 'absolute', top: CY - 100, left: 40, right: 40, alignItems: 'center' }} pointerEvents="none">
            <View style={{ backgroundColor: 'rgba(0,0,0,0.6)', padding: 24, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(56,189,248,0.4)', alignItems: 'center', shadowColor: '#38bdf8', shadowOpacity: 0.2, shadowRadius: 20 }}>
              <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFillObject} />
              <Ionicons name="infinite" size={32} color="#38bdf8" style={{ marginBottom: 12 }} />
              <Text style={{ fontSize: 20, fontWeight: '900', color: '#FFF', letterSpacing: 2, marginBottom: 8 }}>MOMENTUM FLOW</Text>
              
              <View style={{ gap: 10, marginTop: 10, alignItems: 'center' }}>
                <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.8)', textAlign: 'center', fontWeight: '500' }}>
                  1. <Text style={{ color: '#38bdf8', fontWeight: '800' }}>PRESS & HOLD</Text> to dive downhill and gain speed.
                </Text>
                <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.8)', textAlign: 'center', fontWeight: '500' }}>
                  2. <Text style={{ color: '#c084fc', fontWeight: '800' }}>RELEASE</Text> on uphill slopes to launch into the sky.
                </Text>
                <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.8)', textAlign: 'center', fontWeight: '500' }}>
                  3. Find the perfect rhythm to unlock the Om.
                </Text>
              </View>

              <Animated.View style={{ marginTop: 24, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: 'rgba(56,189,248,0.2)', borderRadius: 99 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#38bdf8', letterSpacing: 1 }}>PRESS ANYWHERE TO BEGIN</Text>
              </Animated.View>
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
    flexDirection: 'row', alignItems: 'center', zIndex: 100
  },
  closeBtn: {
    width: 44, height: 44,
    borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
    position: 'absolute', left: 0, top: 0, zIndex: 10
  },
});
