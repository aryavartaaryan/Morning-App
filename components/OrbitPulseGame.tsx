/**
 * OrbitPulseGame.tsx — Native UI Thread Physics Engine
 * ─────────────────────────────────────────────────────────────────
 * Fully rebuilt using React Native Reanimated and Gesture Handler.
 * Zero JS-bridge lag. Perfect 60/120FPS synchronization.
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View, Text, Modal, StyleSheet, TouchableOpacity,
  Dimensions, Platform, BackHandler
} from 'react-native';
import Svg, { Circle, Path, G, Defs, Stop, LinearGradient as SvgLinearGradient } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { useSoundPlayer } from '@/lib/soundPlayerContext';
import { ALL_SLEEP_SOUNDS } from '@/lib/sleepSoundsData';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useFrameCallback,
  withTiming,
  withSequence,
  runOnJS,
  Easing,
  interpolate,
  withRepeat
} from 'react-native-reanimated';

const { width: W, height: H } = Dimensions.get('window');
const PLAYER_X = W * 0.35; 
const CX = W / 2;
const CY = H / 2;

const OM_HIT_URL = 'https://audio.onesutralabs.com/om.mp3';
const TANPURA_SOUND_ID = 'cdn_new_8';

const AnimatedPath = Animated.createAnimatedComponent(Path);

// ── Terrain Math (Worklets) ────────────────────────────────────────────────
const getTerrainY = (x: number) => {
  'worklet';
  const hillWave = Math.sin(x / 600) * 50 + Math.sin(x / 400) * 20 + Math.sin(x / 1200) * 60;
  return hillWave + 600;
};

const getTerrainSlopeAndAngle = (x: number) => {
  'worklet';
  const dx = 1;
  const dy = getTerrainY(x + dx) - getTerrainY(x - dx);
  const slope = dy / (dx * 2);
  const angle = Math.atan2(dy, dx * 2);
  return { slope, angle };
};

// ── Entity Math (Worklets) ────────────────────────────────────────────────
const ENTITY_SPACING = 700;
const getEntityAtChunk = (chunkIdx: number) => {
  'worklet';
  const seed = Math.sin(chunkIdx * 12.9898) * 43758.5453;
  const rand = seed - Math.floor(seed);
  
  if (rand < 0.3) return null;
  
  const x = chunkIdx * ENTITY_SPACING + (rand * 300);
  const ty = getTerrainY(x);
  
  if (rand < 0.65) {
    return { id: chunkIdx, type: 'prana', x, y: ty - 120 - (rand * 150), radius: 25 };
  } else {
    return { id: chunkIdx, type: 'void', x, y: ty - 20, radius: 30 };
  }
};

// ── Background Layers ────────────────────────────────────────────────────────
const DreamyAuraBackground = React.memo(({ cameraXAnim, cameraYAnim }: any) => {
  // Drifting affirmations for mental health focus
  const words = useRef([
    { text: 'BREATHE', x: W * 0.5, y: H * 0.3, speed: 0.2 },
    { text: 'LET GO', x: W * 1.5, y: H * 0.5, speed: 0.15 },
    { text: 'AURA', x: W * 2.5, y: H * 0.4, speed: 0.25 },
    { text: 'FLOW', x: W * 3.5, y: H * 0.2, speed: 0.1 },
    { text: 'RELEASE', x: W * 4.5, y: H * 0.6, speed: 0.18 },
  ]).current;

  const bgStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: interpolate(cameraXAnim.value, [0, 5000], [0, -500]) },
        { translateY: interpolate(cameraYAnim.value, [-1000, 1000], [20, -20]) }
      ]
    };
  });

  const spinAnim = useSharedValue(0);
  const spinRevAnim = useSharedValue(0);
  useEffect(() => {
    spinAnim.value = withRepeat(withTiming(360, { duration: 90000, easing: Easing.linear }), -1, false);
    spinRevAnim.value = withRepeat(withTiming(-360, { duration: 120000, easing: Easing.linear }), -1, false);
  }, []);

  const mandalaStyle = useAnimatedStyle(() => {
    return { transform: [{ rotate: `${spinAnim.value}deg` }] };
  });
  const reverseMandalaStyle = useAnimatedStyle(() => {
    return { transform: [{ rotate: `${spinRevAnim.value}deg` }] };
  });

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {/* 2026 Premium Dark Twilight Flow Background */}
      <LinearGradient colors={['#0f0c29', '#302b63', '#24243e', '#1a1025']} style={StyleSheet.absoluteFillObject} start={{x: 0, y: 0}} end={{x: 1, y: 1}} />
      
      <Animated.View style={[StyleSheet.absoluteFillObject, bgStyle]}>
        {words.map((w, i) => (
          <Text key={i} style={{
            position: 'absolute',
            left: w.x, top: w.y,
            fontSize: 64, fontWeight: '900',
            color: 'rgba(167, 139, 250, 0.05)',
            letterSpacing: 20,
            textTransform: 'uppercase',
          }}>
            {w.text}
          </Text>
        ))}
        {/* Soft glowing ambient orbs - darker, richer */}
        <View style={{ position: 'absolute', top: '10%', left: '20%', width: 400, height: 400, borderRadius: 200, backgroundColor: '#c084fc', opacity: 0.25, filter: 'blur(80px)' }} />
        <View style={{ position: 'absolute', top: '50%', left: '60%', width: 500, height: 500, borderRadius: 250, backgroundColor: '#f472b6', opacity: 0.2, filter: 'blur(90px)' }} />
        <View style={{ position: 'absolute', top: '80%', left: '10%', width: 300, height: 300, borderRadius: 150, backgroundColor: '#818cf8', opacity: 0.2, filter: 'blur(70px)' }} />
      </Animated.View>

      {/* ── Sacred Geometry Layers (Enlarged for Premium Look) ── */}
      {/* Slow Clockwise Outer Geometry (Flower of Life style) */}
      <Animated.View style={[{ position: 'absolute', top: H * 0.5 - 450, left: CX - 450, width: 900, height: 900, opacity: 0.35 }, mandalaStyle]}>
        <Svg width={900} height={900} viewBox="0 0 900 900">
           {/* Outer Ring */}
           {Array.from({length: 12}).map((_, i) => (
             <Circle key={`outer-${i}`} cx={450 + 260 * Math.cos(i * 30 * Math.PI / 180)} cy={450 + 260 * Math.sin(i * 30 * Math.PI / 180)} r={160} stroke="#c084fc" strokeWidth="2.5" fill="none" />
           ))}
           {/* Yantra Triangles */}
           {Array.from({length: 8}).map((_, i) => (
             <G key={`tri-${i}`} rotation={i * 45} origin="450,450">
               <Path d="M450 180 L630 570 L270 570 Z" stroke="#f472b6" strokeWidth="2" fill="none" />
             </G>
           ))}
        </Svg>
      </Animated.View>

      {/* Slower Counter-Clockwise Inner Geometry (Seed of Life) */}
      <Animated.View style={[{ position: 'absolute', top: H * 0.5 - 300, left: CX - 300, width: 600, height: 600, opacity: 0.4 }, reverseMandalaStyle]}>
        <Svg width={600} height={600} viewBox="0 0 600 600">
          <Circle cx="300" cy="300" r="280" stroke="#fef08a" strokeWidth="2" strokeDasharray="6,12" fill="none" />
          <Path d="M300 30 L570 300 L300 570 L30 300 Z" stroke="#fbcfe8" strokeWidth="2" fill="none" />
          {/* Inner Seed */}
          {Array.from({length: 6}).map((_, i) => (
             <Circle key={`inner-${i}`} cx={300 + 100 * Math.cos(i * 60 * Math.PI / 180)} cy={300 + 100 * Math.sin(i * 60 * Math.PI / 180)} r={100} stroke="#a78bfa" strokeWidth="2.5" fill="none" />
          ))}
        </Svg>
      </Animated.View>
    </View>
  );
});

// ──────────────────────────────────────────────────────────────────────────────
export default function OrbitPulseGame({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { playSound, stopSound, setGlobalVolume } = useSoundPlayer();

  // ── React State ──
  const [isPlayingReact, setIsPlayingReact] = useState(false);
  const [gameOver, setGameOver]   = useState(false);
  const [score, setScore]         = useState(0);
  const [health, setHealth]       = useState(3);
  const [showTutorial, setShowTutorial] = useState(true);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);

  useEffect(() => {
    const backAction = () => {
      if (isPlaying.value || showTutorial) {
        setShowQuitConfirm(true);
        isPlaying.value = false;
        setIsPlayingReact(false);
        return true;
      }
      return false;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [showTutorial]);
  
  const scoreRef = useRef(0);
  const omSoundRef = useRef<Audio.Sound | null>(null);

  // ── Reanimated Shared Values (Native UI Thread State) ──
  const isPlaying = useSharedValue(false);
  const px = useSharedValue(0);
  const py = useSharedValue(100);
  const pvx = useSharedValue(250);
  const pvy = useSharedValue(0);
  const isGrounded = useSharedValue(false);
  const isPressing = useSharedValue(false);
  const pressStartTime = useSharedValue(0);
  const cameraX = useSharedValue(0);
  const cameraY = useSharedValue(0);
  const consumedEntities = useSharedValue<Record<number, boolean>>({});
  
  const screenFlash = useSharedValue(0);
  const screenShake = useSharedValue(0);
  const speedLinesOp = useSharedValue(0);
  const auraScale = useSharedValue(1);

  const extraTanpuraRef = useRef<Audio.Sound | null>(null);

  // ── Audio Setup ──
  useEffect(() => {
    if (!visible) return;
    (async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, allowsRecordingIOS: false });
        const { sound } = await Audio.Sound.createAsync({ uri: OM_HIT_URL }, { shouldPlay: false, volume: 1.0 });
        omSoundRef.current = sound;
        
        // Add additional soothing tanpura loop natively
        const extraTanpuraSrc = require('../assets/sounds/tanpura-mystic.m4a');
        const { sound: extraSound } = await Audio.Sound.createAsync(extraTanpuraSrc, { shouldPlay: true, isLooping: true, volume: 0.4 });
        extraTanpuraRef.current = extraSound;
      } catch (e) {}
    })();
    return () => { 
      omSoundRef.current?.unloadAsync(); 
      extraTanpuraRef.current?.unloadAsync(); 
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const tanpura = ALL_SLEEP_SOUNDS.find(s => s.id === TANPURA_SOUND_ID);
    if (tanpura) {
      setGlobalVolume(0.6);
      playSound(tanpura, 3600, undefined, 0.6, true);
    }
    return () => { stopSound(); setGlobalVolume(1); };
  }, [visible]);

  // ── JS Callbacks for UI updates and Sound ──
  const updateScoreJS = (add: number) => {
    scoreRef.current += add;
    setScore(Math.floor(scoreRef.current));
  };

  const triggerPerfectLandingJS = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    omSoundRef.current?.setPositionAsync(0);
    omSoundRef.current?.playAsync();
    
    screenFlash.value = withSequence(
      withTiming(0.4, { duration: 50 }),
      withTiming(0, { duration: 400, easing: Easing.out(Easing.ease) })
    );
    screenShake.value = withSequence(
      withTiming(12, { duration: 40 }),
      withTiming(-12, { duration: 40 }),
      withTiming(0, { duration: 40 })
    );
  };

  const triggerPranaJS = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    scoreRef.current += 500;
  };

  const triggerCrashJS = (intensity: number) => {
    screenShake.value = withSequence(
      withTiming(intensity, { duration: 40 }),
      withTiming(-intensity, { duration: 40 }),
      withTiming(0, { duration: 40 })
    );
  };

  const triggerDamageJS = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    screenFlash.value = withSequence(
      withTiming(0.5, { duration: 50 }),
      withTiming(0, { duration: 500 })
    );
    triggerCrashJS(20);
    
    const tanpura = ALL_SLEEP_SOUNDS.find(s => s.id === TANPURA_SOUND_ID);
    if (tanpura) playSound(tanpura, 3, undefined, 1.0, false);
    
    setHealth(h => {
      const newH = h - 1;
      if (newH <= 0) {
        setIsPlayingReact(false);
        isPlaying.value = false;
        setGameOver(true);
      }
      return newH;
    });
  };

  // ── Game Loop (Runs perfectly on UI Thread) ──
  useFrameCallback((frameInfo) => {
    if (!isPlaying.value) return;
    
    const dt = Math.min((frameInfo.timeSincePreviousFrame ?? 16) / 1000, 0.05);

    const GRAVITY = 1000;
    const DIVE_GRAVITY = 2500;
    const BASE_SPEED = 200;
    const MAX_SPEED = 600;
    const DRAG = 0.99;
    const FRICTION = 0.995;

    // Apply Vertical Forces
    pvy.value += (isPressing.value ? DIVE_GRAVITY : GRAVITY) * dt;

    // Apply Horizontal Forces
    if (pvx.value > BASE_SPEED) {
      pvx.value = pvx.value * (isGrounded.value ? FRICTION : DRAG) - (20 * dt);
      if (pvx.value < BASE_SPEED) pvx.value = BASE_SPEED;
    } else if (pvx.value < BASE_SPEED) {
      pvx.value += 400 * dt;
    }

    // Move Player
    px.value += pvx.value * dt;
    py.value += pvy.value * dt;

    // Entity Collision (Native loop check)
    const currentChunk = Math.floor(px.value / ENTITY_SPACING);
    for (let c = currentChunk - 1; c <= currentChunk + 3; c++) {
       const ent = getEntityAtChunk(c);
       if (ent && !consumedEntities.value[c]) {
           const dx = px.value - ent.x;
           const dy = py.value - ent.y;
           const dist = Math.sqrt(dx*dx + dy*dy);
           if (dist < 15 + ent.radius) {
              const map = Object.assign({}, consumedEntities.value);
              map[c] = true;
              consumedEntities.value = map;
              
              if (ent.type === 'prana') {
                 pvx.value = Math.min(pvx.value + 100, MAX_SPEED);
                 auraScale.value = withTiming(Math.min(auraScale.value + 0.15, 2.5), { duration: 300 });
                 runOnJS(triggerPranaJS)();
              } else {
                 pvx.value = BASE_SPEED * 0.3;
                 pvy.value = -500;
                 isGrounded.value = false;
                 auraScale.value = withTiming(Math.max(auraScale.value - 0.4, 0.5), { duration: 300 });
                 runOnJS(triggerDamageJS)();
              }
           }
       }
    }

    // Terrain Collision
    const groundY = getTerrainY(px.value);
    const { slope, angle } = getTerrainSlopeAndAngle(px.value);

    if (py.value >= groundY) {
      if (!isGrounded.value) {
        // Landing event
        const velocityAngle = Math.atan2(pvy.value, pvx.value);
        const impactDiff = Math.abs(velocityAngle - angle);
        
        if (slope > 0 && impactDiff < 0.6 && isPressing.value && pvy.value > 400) {
          pvx.value = Math.min(pvx.value + pvy.value * 0.9, MAX_SPEED);
          runOnJS(triggerPerfectLandingJS)();
        } else if (slope < -0.3 && pvy.value > 400) {
          pvx.value = BASE_SPEED * 0.4;
          runOnJS(triggerCrashJS)(8);
        }
      }

      isGrounded.value = true;
      py.value = groundY;
      
      const vMag = Math.sqrt(pvx.value * pvx.value + pvy.value * pvy.value);
      pvx.value = vMag * Math.cos(angle);
      pvy.value = vMag * Math.sin(angle);

      if (isPressing.value && slope > 0) {
        pvx.value += 1800 * Math.sin(angle) * dt;
        pvx.value = Math.min(pvx.value, MAX_SPEED);
      }
      
      if (!isPressing.value && slope < 0) {
        isGrounded.value = false; 
      }
    } else {
      isGrounded.value = false;
    }

    // Decay aura slowly back towards 1
    if (auraScale.value > 1) {
      auraScale.value -= 0.05 * dt;
    } else if (auraScale.value < 1) {
      auraScale.value += 0.05 * dt;
    }

    // Update Speed Lines
    speedLinesOp.value = Math.max(0, (pvx.value - 800) / (MAX_SPEED - 800));

    // Smooth Camera Tracking
    const targetCameraY = py.value - H * 0.75;
    cameraY.value += (targetCameraY - cameraY.value) * 0.1;
    cameraX.value = px.value;

    // Send score to JS thread
    runOnJS(updateScoreJS)((pvx.value * dt) / 10);
  });

  // ── Input Handling (Gesture Handler = Native Thread Input) ──
  const panGesture = Gesture.Pan()
    .manualActivation(true)
    .onBegin(() => {
      if (!isPlaying.value && !gameOver) return;
      isPressing.value = true;
      pressStartTime.value = Date.now();
    })
    .onTouchesDown((e, stateManager) => {
      if (gameOver || showQuitConfirm) {
        stateManager.fail();
        return;
      }
      // Begin immediately on any touch
      stateManager.activate();
      if (!isPlaying.value && !showTutorial) {
        runOnJS(setIsPlayingReact)(true);
        isPlaying.value = true;
      } else if (showTutorial) {
        runOnJS(setShowTutorial)(false);
        runOnJS(setIsPlayingReact)(true);
        isPlaying.value = true;
      }
    })
    .onFinalize(() => {
      isPressing.value = false;
      const duration = Date.now() - pressStartTime.value;
      if (duration < 250 && isGrounded.value) {
        // Native Tap Jump! Zero JS latency.
        pvy.value = -1000; 
        isGrounded.value = false;
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
      }
    });

  const restartGame = () => {
    px.value = 0; py.value = 100; pvx.value = 200; pvy.value = 0;
    auraScale.value = 1;
    isGrounded.value = false;
    consumedEntities.value = {};
    scoreRef.current = 0;
    setScore(0);
    setHealth(3);
    setGameOver(false);
    setIsPlayingReact(true);
    isPlaying.value = true;
  };

  const handleClosePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsPlayingReact(false);
    isPlaying.value = false;
    setShowQuitConfirm(true);
  };

  // ── Animated Rendering (UI Thread) ──
  const terrainProps = useAnimatedProps(() => {
    let d = `M0,${H * 2} L0,${getTerrainY(px.value - PLAYER_X)}`;
    for (let lx = 0; lx <= W; lx += W / 40) {
      d += ` L${lx},${getTerrainY(px.value - PLAYER_X + lx)}`;
    }
    d += ` L${W},${H * 2} Z`;
    return { d };
  });

  const bgTerrainProps = useAnimatedProps(() => {
    const bgX = px.value * 0.4; 
    let d = `M0,${H * 2} L0,${getTerrainY(bgX) - 150}`;
    for (let lx = 0; lx <= W; lx += W / 30) {
      d += ` L${lx},${getTerrainY(bgX + lx) - 150}`;
    }
    d += ` L${W},${H * 2} Z`;
    return { d };
  });

  const pranaProps = useAnimatedProps(() => {
    let d = '';
    const currentChunk = Math.floor(px.value / ENTITY_SPACING);
    for (let c = currentChunk - 1; c <= currentChunk + 3; c++) {
      const ent = getEntityAtChunk(c);
      if (ent && ent.type === 'prana' && !consumedEntities.value[c]) {
        const screenX = ent.x - px.value + PLAYER_X;
        const r = ent.radius;
        // Draw a diamond/sparkle shape for Prana (Positive energy)
        d += `M ${screenX},${ent.y - r} Q ${screenX},${ent.y} ${screenX + r},${ent.y} Q ${screenX},${ent.y} ${screenX},${ent.y + r} Q ${screenX},${ent.y} ${screenX - r},${ent.y} Q ${screenX},${ent.y} ${screenX},${ent.y - r} Z `;
      }
    }
    return { d };
  });

  const voidProps = useAnimatedProps(() => {
    let d = '';
    const currentChunk = Math.floor(px.value / ENTITY_SPACING);
    for (let c = currentChunk - 1; c <= currentChunk + 3; c++) {
      const ent = getEntityAtChunk(c);
      if (ent && ent.type === 'void' && !consumedEntities.value[c]) {
        const screenX = ent.x - px.value + PLAYER_X;
        const r = ent.radius;
        // Draw an organic blob / jagged dark crystal (Anxiety/Void)
        d += `M ${screenX},${ent.y - r} L ${screenX + r*0.8},${ent.y - r*0.3} L ${screenX + r*1.2},${ent.y + r*0.8} L ${screenX - r*0.5},${ent.y + r} L ${screenX - r},${ent.y - r*0.2} Z `;
      }
    }
    return { d };
  });

  const cameraStyle = useAnimatedStyle(() => {
    return { transform: [{ translateX: screenShake.value }, { translateY: -cameraY.value }] };
  });

  const playerStyle = useAnimatedStyle(() => {
    const rot = Math.atan2(pvy.value, pvx.value) * (180 / Math.PI);
    const baseScale = auraScale.value;
    return {
      transform: [
        { translateY: py.value - 15 },
        { rotate: `${rot}deg` },
        { scaleX: (isPressing.value ? 1.2 : 1) * baseScale },
        { scaleY: (isPressing.value ? 0.8 : 1) * baseScale }
      ]
    };
  });

  const flashStyle = useAnimatedStyle(() => ({
    opacity: screenFlash.value,
  }));

  const speedLinesStyle = useAnimatedStyle(() => ({
    opacity: speedLinesOp.value,
  }));

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent transparent onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <GestureDetector gesture={panGesture}>
          <View style={s.root}>
            
            <DreamyAuraBackground cameraXAnim={cameraX} cameraYAnim={cameraY} />

            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: '#FFF', zIndex: 10 }, flashStyle]} />

            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { zIndex: 5 }, speedLinesStyle]}>
              <LinearGradient colors={['transparent', 'rgba(255,255,255,0.4)', 'transparent']} start={{x:0, y:0}} end={{x:1, y:0}} style={{ position: 'absolute', top: H*0.2, left: 0, right: 0, height: 2 }} />
              <LinearGradient colors={['transparent', 'rgba(244,114,182,0.4)', 'transparent']} start={{x:0, y:0}} end={{x:1, y:0}} style={{ position: 'absolute', top: H*0.5, left: 0, right: 0, height: 3 }} />
              <LinearGradient colors={['transparent', 'rgba(167,139,250,0.4)', 'transparent']} start={{x:0, y:0}} end={{x:1, y:0}} style={{ position: 'absolute', top: H*0.8, left: 0, right: 0, height: 2 }} />
            </Animated.View>

            {/* ── Native Synced Rendering Camera ── */}
            <Animated.View style={[StyleSheet.absoluteFillObject, cameraStyle]}>
              
              <Svg width={W + 100} height={H * 2} style={{ position: 'absolute', top: 0, left: 0, opacity: 0.6 }}>
                <Defs>
                  <SvgLinearGradient id="bgHillGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#64748b" stopOpacity="0.8" />
                    <Stop offset="1" stopColor="#334155" stopOpacity="0.2" />
                  </SvgLinearGradient>
                </Defs>
                <AnimatedPath animatedProps={bgTerrainProps} fill="url(#bgHillGrad)" />
              </Svg>

              <Svg width={W + 100} height={H * 2} style={{ position: 'absolute', top: 0, left: 0 }}>
                <Defs>
                  <SvgLinearGradient id="hillGradient" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#16a34a" stopOpacity="1" />
                    <Stop offset="0.15" stopColor="#654321" stopOpacity="1" />
                    <Stop offset="1" stopColor="#1e130c" stopOpacity="1" />
                  </SvgLinearGradient>
                  <SvgLinearGradient id="pranaGrad" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor="#fde047" stopOpacity="1" />
                    <Stop offset="1" stopColor="#fbbf24" stopOpacity="0.8" />
                  </SvgLinearGradient>
                  <SvgLinearGradient id="voidGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#1e1b4b" stopOpacity="0.9" />
                    <Stop offset="1" stopColor="#4c1d95" stopOpacity="1" />
                  </SvgLinearGradient>
                </Defs>
                <AnimatedPath animatedProps={terrainProps} fill="url(#hillGradient)" stroke="#22c55e" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
                <AnimatedPath animatedProps={pranaProps} fill="url(#pranaGrad)" />
                <AnimatedPath animatedProps={voidProps} fill="url(#voidGrad)" stroke="#312e81" strokeWidth="2" strokeLinejoin="round" />
              </Svg>

              {/* Player - Zen Master Running */}
              <Animated.View style={[{
                position: 'absolute', left: PLAYER_X - 15, width: 30, height: 30,
                alignItems: 'center', justifyContent: 'center'
              }, playerStyle]}>
                <View style={{ position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: '#fdf4ff', opacity: 0.15, filter: 'blur(10px)' }} />
                <View style={{ position: 'absolute', width: 90, height: 90, borderRadius: 45, backgroundColor: '#4ade80', opacity: 0.4, filter: 'blur(5px)' }} />
                <Text style={{ fontSize: 36, textShadowColor: '#fbbf24', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 15 }}>🧘‍♂️</Text>
              </Animated.View>
            </Animated.View>

            {/* ── Top HUD ── */}
            <View style={s.hudRow} pointerEvents="box-none">
              <TouchableOpacity onPress={handleClosePress} style={s.closeBtn}>
                <Ionicons name="close" size={24} color="#a78bfa" />
              </TouchableOpacity>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 12, color: '#8b5cf6', fontWeight: '800', letterSpacing: 2 }}>FLOW SCORE</Text>
                <Text style={{ fontSize: 40, fontWeight: '900', color: '#a78bfa', textShadowColor: '#fdf4ff', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10 }}>{score.toLocaleString()}</Text>
              </View>
              <View style={{ width: 60, alignItems: 'flex-end' }}>
                 <Text style={{ color: '#f472b6', fontWeight: '900', fontSize: 16 }}>
                   {Array.from({length: health}).map(() => '❤️').join('')}
                 </Text>
              </View>
            </View>

            {/* Tutorial Overlay */}
            {showTutorial && (
              <View style={{ position: 'absolute', top: CY - 120, left: 20, right: 20, alignItems: 'center' }} pointerEvents="none">
                <View style={{ backgroundColor: 'rgba(10,5,30,0.8)', padding: 24, borderRadius: 32, borderWidth: 1, borderColor: 'rgba(56,189,248,0.5)', alignItems: 'center' }}>
                  <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
                  <Ionicons name="infinite" size={36} color="#38bdf8" style={{ marginBottom: 12 }} />
                  <Text style={{ fontSize: 22, fontWeight: '900', color: '#FFF', letterSpacing: 2, marginBottom: 16 }}>AURA FLOW</Text>
                  
                  <View style={{ gap: 14, alignItems: 'flex-start', width: '100%' }}>
                    <Text style={{ fontSize: 16, color: '#FFF', fontWeight: '600' }}>
                      👇 <Text style={{ color: '#38bdf8', fontWeight: '800' }}>PRESS & HOLD</Text> to dive downhill.
                    </Text>
                    <Text style={{ fontSize: 16, color: '#FFF', fontWeight: '600' }}>
                      👆 <Text style={{ color: '#c084fc', fontWeight: '800' }}>TAP QUICKLY</Text> to Jump!
                    </Text>
                  </View>
                  <Animated.View style={{ marginTop: 28, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: 'rgba(56,189,248,0.2)', borderRadius: 99, borderWidth: 1, borderColor: '#38bdf8' }}>
                    <Text style={{ fontSize: 15, fontWeight: '900', color: '#38bdf8', letterSpacing: 1.5 }}>TAP ANYWHERE TO BEGIN</Text>
                  </Animated.View>
                </View>
              </View>
            )}

            {/* Game Over Overlay */}
            {gameOver && (
              <View style={{ position: 'absolute', top: CY - 100, left: 40, right: 40, alignItems: 'center', zIndex: 100, elevation: 100 }}>
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

            {/* Quit Confirmation */}
            {showQuitConfirm && (
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
                <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFillObject} />
                <View style={{ backgroundColor: 'rgba(10,5,30,0.9)', padding: 32, borderRadius: 32, borderWidth: 1, borderColor: 'rgba(192,132,252,0.5)', alignItems: 'center', width: '85%' }}>
                  <Ionicons name="moon" size={40} color="#c084fc" style={{ marginBottom: 16 }} />
                  <Text style={{ fontSize: 22, fontWeight: '900', color: '#FFF', letterSpacing: 1.5, textAlign: 'center', marginBottom: 12 }}>LEAVING THE FLOW?</Text>
                  <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.7)', fontWeight: '500', textAlign: 'center', marginBottom: 32, lineHeight: 24 }}>Do you want to exit the Aura Flow therapy or not?</Text>
                  <View style={{ width: '100%', gap: 12 }}>
                    <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowQuitConfirm(false); setIsPlayingReact(true); isPlaying.value = true; }} style={{ paddingVertical: 16, backgroundColor: '#c084fc', borderRadius: 99, alignItems: 'center' }}>
                      <Text style={{ fontSize: 15, fontWeight: '900', color: '#FFF', letterSpacing: 1 }}>STAY IN FLOW</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onClose(); }} style={{ paddingVertical: 16, backgroundColor: 'transparent', borderRadius: 99, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center' }}>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: 'rgba(255,255,255,0.5)' }}>END SESSION</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

          </View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f0c29' },
  hudRow: {
    position: 'absolute', top: 50, left: 20, right: 20,
    flexDirection: 'row', alignItems: 'flex-start', zIndex: 100, elevation: 100
  },
  closeBtn: {
    width: 44, height: 44,
    borderRadius: 22, backgroundColor: 'rgba(167,139,250,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
});
