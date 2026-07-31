/**
 * OrbitPulseGame.tsx — "Prana Pinball" 2D Physics Game
 * ─────────────────────────────────────────────────────────────────
 * Ultra-premium 60FPS physics using Reanimated UI Thread.
 * Sacred geometry board, energetic chakra bumpers, fluid mechanics.
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Dimensions, StyleSheet, Modal, TouchableOpacity, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  useFrameCallback,
  runOnJS,
  withTiming,
  Easing
} from 'react-native-reanimated';
import Svg, { Circle, Path, Defs, RadialGradient, Stop, G, Line } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { useSoundPlayer } from '@/lib/soundPlayerContext';
import { LinearGradient } from 'expo-linear-gradient';

const { width: W, height: H } = Dimensions.get('window');

// ── Physics Constants ──
const BALL_R = 14;
const GRAVITY = 1800;
const MAX_VEL = 3000;
const BOUNCE_DAMP = 0.5;

// Flipper Config
const L_PIVOT = { x: W * 0.25, y: H - 180 };
const R_PIVOT = { x: W * 0.75, y: H - 180 };
const FLIPPER_LEN = W * 0.28;
const L_ANG_REST = 30;
const L_ANG_ACT = -35;
const R_ANG_REST = 150;
const R_ANG_ACT = 215;

// Chakras (Bumpers)
const BUMPERS = [
  { id: 0, x: W * 0.5, y: H * 0.2, r: 35, color: '#c084fc', name: 'Crown' }, // Crown
  { id: 1, x: W * 0.25, y: H * 0.35, r: 25, color: '#3b82f6', name: 'Third Eye' }, 
  { id: 2, x: W * 0.75, y: H * 0.35, r: 25, color: '#3b82f6', name: 'Throat' }, 
  { id: 3, x: W * 0.5, y: H * 0.45, r: 30, color: '#10b981', name: 'Heart' }, 
  { id: 4, x: W * 0.2, y: H * 0.6, r: 25, color: '#f59e0b', name: 'Solar' }, 
  { id: 5, x: W * 0.8, y: H * 0.6, r: 25, color: '#f59e0b', name: 'Sacral' }, 
  { id: 6, x: W * 0.5, y: H * 0.7, r: 20, color: '#ef4444', name: 'Root' }, 
];

const OM_URL = 'https://audio.onesutralabs.com/om.mp3';

// ── Helpers ──
function getFlipperCircles(px: number, py: number, angleDeg: number, len: number) {
  'worklet';
  const a = angleDeg * (Math.PI / 180);
  return [
    { x: px, y: py, r: 18 },
    { x: px + Math.cos(a) * (len * 0.33), y: py + Math.sin(a) * (len * 0.33), r: 16 },
    { x: px + Math.cos(a) * (len * 0.66), y: py + Math.sin(a) * (len * 0.66), r: 14 },
    { x: px + Math.cos(a) * len, y: py + Math.sin(a) * len, r: 12 },
  ];
}

// ──────────────────────────────────────────────────────────────────────────────
export default function OrbitPulseGame({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { playSound, stopSound, setGlobalVolume } = useSoundPlayer();
  
  // Game State
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  
  // Audio
  const omSoundRef = useRef<Audio.Sound | null>(null);

  // Shared Values for UI Thread Physics
  const ballX = useSharedValue(W * 0.9);
  const ballY = useSharedValue(H * 0.8);
  const ballVx = useSharedValue(0);
  const ballVy = useSharedValue(-1500); // initial launch
  
  const isSimulating = useSharedValue(false);
  
  const leftFlipperAngle = useSharedValue(L_ANG_REST);
  const rightFlipperAngle = useSharedValue(R_ANG_REST);
  const leftActive = useSharedValue(false);
  const rightActive = useSharedValue(false);

  // Bumper glow scales
  const bumperScales = BUMPERS.map(() => useSharedValue(1));

  useEffect(() => {
    if (visible) {
      Audio.Sound.createAsync({ uri: OM_URL }).then(({ sound }) => { omSoundRef.current = sound; });
    }
    return () => { omSoundRef.current?.unloadAsync(); };
  }, [visible]);

  const triggerBumperHit = useCallback((id: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setScore(s => s + (id === 0 ? 500 : 100)); // Crown gives 500
    
    if (id === 0) {
       omSoundRef.current?.setPositionAsync(0);
       omSoundRef.current?.playAsync();
    }
    
    // Animate bumper glow
    bumperScales[id].value = withSequence(
      withTiming(1.6, { duration: 100 }),
      withTiming(1, { duration: 400 })
    );
  }, []);

  const handleGameOver = useCallback(() => {
    setIsPlaying(false);
    isSimulating.value = false;
    setGameOver(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }, []);

  // ── High Performance 60FPS Engine ──
  useFrameCallback((frameInfo) => {
    if (!isSimulating.value) return;
    
    // Limit dt to prevent wall clipping on lag spikes
    const dt = Math.min((frameInfo.timeSincePreviousFrame || 16) / 1000, 0.03);
    
    let bx = ballX.value;
    let by = ballY.value;
    let vx = ballVx.value;
    let vy = ballVy.value;
    
    vy += GRAVITY * dt;
    
    bx += vx * dt;
    by += vy * dt;
    
    // Wall Collisions
    if (bx < BALL_R) { bx = BALL_R; vx = Math.abs(vx) * BOUNCE_DAMP; }
    if (bx > W - BALL_R) { bx = W - BALL_R; vx = -Math.abs(vx) * BOUNCE_DAMP; }
    if (by < BALL_R) { by = BALL_R; vy = Math.abs(vy) * BOUNCE_DAMP; }
    
    // Roof Dome Collision (top curved)
    const domeDistX = bx - W/2;
    const domeDistY = by - H*0.2;
    if (domeDistY < 0 && Math.sqrt(domeDistX*domeDistX + domeDistY*domeDistY) > W/2 - BALL_R) {
        vx = -vx * BOUNCE_DAMP;
        vy = Math.abs(vy) * BOUNCE_DAMP;
        by += 5; // push down
    }

    // Bumper Collisions
    for (let i = 0; i < BUMPERS.length; i++) {
      const b = BUMPERS[i];
      const dx = bx - b.x;
      const dy = by - b.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      
      if (dist < BALL_R + b.r) {
        const nx = dx / dist;
        const ny = dy / dist;
        const dot = vx * nx + vy * ny;
        
        if (dot < 0) {
          // Bounce
          vx -= 2 * dot * nx;
          vy -= 2 * dot * ny;
          // Bumper adds energy
          vx += nx * 800;
          vy += ny * 800;
          
          runOnJS(triggerBumperHit)(b.id);
        }
        
        bx = b.x + nx * (BALL_R + b.r + 2);
        by = b.y + ny * (BALL_R + b.r + 2);
      }
    }
    
    // Flipper Collisions
    const checkFlipper = (circles: any[], isAct: boolean) => {
      let hit = false;
      for (const c of circles) {
        const dx = bx - c.x;
        const dy = by - c.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < BALL_R + c.r) {
          const nx = dx / dist;
          const ny = dy / dist;
          const dot = vx * nx + vy * ny;
          
          if (dot < 0) {
            vx -= 2 * dot * nx;
            vy -= 2 * dot * ny;
            if (isAct) {
              // Huge vertical boost if flipping
              vy = -1800;
              vx += (bx > W/2 ? -600 : 600); // push towards center
            } else {
              vx *= 0.8;
              vy *= 0.8;
            }
            hit = true;
          }
          bx = c.x + nx * (BALL_R + c.r + 2);
          by = c.y + ny * (BALL_R + c.r + 2);
        }
      }
      return hit;
    };

    const lCircles = getFlipperCircles(L_PIVOT.x, L_PIVOT.y, leftFlipperAngle.value, FLIPPER_LEN);
    const rCircles = getFlipperCircles(R_PIVOT.x, R_PIVOT.y, rightFlipperAngle.value, FLIPPER_LEN);
    
    const hitL = checkFlipper(lCircles, leftActive.value);
    const hitR = checkFlipper(rCircles, rightActive.value);
    if (hitL || hitR) {
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
    }

    // Velocity Clamping
    const speed = Math.sqrt(vx*vx + vy*vy);
    if (speed > MAX_VEL) {
      vx = (vx / speed) * MAX_VEL;
      vy = (vy / speed) * MAX_VEL;
    }

    // Game Over 
    if (by > H + 50) {
      runOnJS(handleGameOver)();
    }

    ballX.value = bx;
    ballY.value = by;
    ballVx.value = vx;
    ballVy.value = vy;
  });

  // Helper for sequential animation (since withSequence is not available in all RA3 versions reliably without importing)
  const withSequence = (a1: any, a2: any) => {
    'worklet';
    return a1; // Simplified for now, we will handle glow differently via useAnimatedStyle
  };

  // ── Input Controls ──
  const triggerLeft = (pressed: boolean) => {
    leftActive.value = pressed;
    leftFlipperAngle.value = withSpring(pressed ? L_ANG_ACT : L_ANG_REST, { damping: 12, stiffness: 200 });
    if (pressed) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const triggerRight = (pressed: boolean) => {
    rightActive.value = pressed;
    rightFlipperAngle.value = withSpring(pressed ? R_ANG_ACT : R_ANG_REST, { damping: 12, stiffness: 200 });
    if (pressed) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const startGame = () => {
    setScore(0);
    setGameOver(false);
    
    // Launch sequence
    ballX.value = W - 30;
    ballY.value = H - 100;
    ballVx.value = -300;
    ballVy.value = -2500;
    
    setIsPlaying(true);
    isSimulating.value = true;
  };

  const handleClose = () => {
    isSimulating.value = false;
    setIsPlaying(false);
    setShowQuitConfirm(true);
  };

  // ── Animated Styles ──
  const ballStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: ballX.value - BALL_R },
      { translateY: ballY.value - BALL_R }
    ]
  }));

  const lFlipperStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: L_PIVOT.x },
      { translateY: L_PIVOT.y },
      { rotate: `${leftFlipperAngle.value}deg` },
      { translateX: -L_PIVOT.x },
      { translateY: -L_PIVOT.y }
    ]
  }));

  const rFlipperStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: R_PIVOT.x },
      { translateY: R_PIVOT.y },
      { rotate: `${rightFlipperAngle.value}deg` },
      { translateX: -R_PIVOT.x },
      { translateY: -R_PIVOT.y }
    ]
  }));

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent transparent onRequestClose={onClose}>
      <View style={s.root}>
        {/* Deep Space Background */}
        <LinearGradient colors={['#020010', '#0a0520', '#1a053a']} style={StyleSheet.absoluteFillObject} />
        
        {/* Sacred Geometry Board (Mandala Lines) */}
        <Svg width={W} height={H} style={StyleSheet.absoluteFillObject} pointerEvents="none">
          <Defs>
            <RadialGradient id="glow" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0%" stopColor="#c084fc" stopOpacity="0.4" />
              <Stop offset="100%" stopColor="#000" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          {/* Decorative glowing dome */}
          <Path d={`M0 ${H*0.3} Q ${W/2} ${-H*0.1} ${W} ${H*0.3}`} fill="none" stroke="rgba(192,132,252,0.3)" strokeWidth="2" />
          <Path d={`M${W*0.1} ${H*0.35} Q ${W/2} ${H*0.1} ${W*0.9} ${H*0.35}`} fill="none" stroke="rgba(56,189,248,0.3)" strokeWidth="1" />
          
          {/* Launch Tube */}
          <Line x1={W-15} y1={H} x2={W-15} y2={H*0.4} stroke="rgba(255,255,255,0.2)" strokeWidth="2" />
        </Svg>

        {/* ── BUMPERS (CHAKRAS) ── */}
        {BUMPERS.map((b, i) => {
           const scaleStyle = useAnimatedStyle(() => ({
              transform: [{ scale: bumperScales[i].value }]
           }));
           return (
             <Animated.View key={i} style={[
                { position: 'absolute', left: b.x - b.r, top: b.y - b.r, width: b.r*2, height: b.r*2, borderRadius: b.r, backgroundColor: b.color, alignItems: 'center', justifyContent: 'center' },
                scaleStyle
             ]}>
                <View style={{ width: '100%', height: '100%', borderRadius: 99, borderWidth: 2, borderColor: '#FFF', opacity: 0.8 }} />
                <View style={{ position: 'absolute', width: b.r*4, height: b.r*4, borderRadius: b.r*2, backgroundColor: b.color, opacity: 0.3 }} />
             </Animated.View>
           )
        })}

        {/* ── FLIPPERS ── */}
        <Animated.View style={[s.flipperWrap, lFlipperStyle]}>
           <LinearGradient colors={['#fff', '#60a5fa']} start={{x:0, y:0}} end={{x:1, y:0}} style={{ position: 'absolute', left: L_PIVOT.x - 18, top: L_PIVOT.y - 12, width: FLIPPER_LEN + 30, height: 24, borderRadius: 12, shadowColor: '#60a5fa', shadowOpacity: 1, shadowRadius: 20 }} />
        </Animated.View>

        <Animated.View style={[s.flipperWrap, rFlipperStyle]}>
           <LinearGradient colors={['#60a5fa', '#fff']} start={{x:0, y:0}} end={{x:1, y:0}} style={{ position: 'absolute', left: R_PIVOT.x - 12 - FLIPPER_LEN, top: R_PIVOT.y - 12, width: FLIPPER_LEN + 30, height: 24, borderRadius: 12, shadowColor: '#60a5fa', shadowOpacity: 1, shadowRadius: 20 }} />
        </Animated.View>

        {/* ── THE ORB (PRANA) ── */}
        <Animated.View style={[s.ball, ballStyle]}>
           <View style={{ width: BALL_R*4, height: BALL_R*4, borderRadius: BALL_R*2, backgroundColor: '#FFF', opacity: 0.4, position: 'absolute', left: -BALL_R*1.5, top: -BALL_R*1.5 }} />
        </Animated.View>

        {/* ── TOUCH ZONES ── */}
        {isPlaying && !gameOver && (
          <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
            <TouchableOpacity activeOpacity={1} onPressIn={() => triggerLeft(true)} onPressOut={() => triggerLeft(false)} style={{ position: 'absolute', left: 0, top: H*0.2, bottom: 0, width: W/2 }} />
            <TouchableOpacity activeOpacity={1} onPressIn={() => triggerRight(true)} onPressOut={() => triggerRight(false)} style={{ position: 'absolute', right: 0, top: H*0.2, bottom: 0, width: W/2 }} />
          </View>
        )}

        {/* ── HUD ── */}
        <View style={s.hudRow} pointerEvents="box-none">
          <TouchableOpacity onPress={handleClose} style={s.closeBtn}>
            <Ionicons name="close" size={24} color="#FFF" />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: '800', letterSpacing: 2 }}>FLOW SCORE</Text>
            <Text style={{ fontSize: 44, fontWeight: '900', color: '#FFF', textShadowColor: '#c084fc', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 15 }}>{score.toLocaleString()}</Text>
          </View>
          <View style={{ width: 44 }} />
        </View>

        {/* ── START SCREEN ── */}
        {!isPlaying && !gameOver && !showQuitConfirm && (
          <View style={[StyleSheet.absoluteFillObject, { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)' }]}>
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
            <Ionicons name="aperture" size={60} color="#c084fc" style={{ marginBottom: 20 }} />
            <Text style={{ fontSize: 28, fontWeight: '900', color: '#FFF', letterSpacing: 4, marginBottom: 12 }}>PRANA PINBALL</Text>
            <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginHorizontal: 40, marginBottom: 40 }}>
              Keep the energy flowing. Hit the chakras. Awaken the mandala.
            </Text>
            
            <View style={{ flexDirection: 'row', gap: 20, marginBottom: 40 }}>
               <View style={{ alignItems: 'center' }}><Text style={{ color: '#60a5fa', fontWeight: '800', fontSize: 18 }}>👈 TAP LEFT</Text></View>
               <View style={{ alignItems: 'center' }}><Text style={{ color: '#60a5fa', fontWeight: '800', fontSize: 18 }}>TAP RIGHT 👉</Text></View>
            </View>

            <TouchableOpacity onPress={startGame} style={{ paddingHorizontal: 40, paddingVertical: 18, backgroundColor: '#c084fc', borderRadius: 99, shadowColor: '#c084fc', shadowOpacity: 0.5, shadowRadius: 20 }}>
              <Text style={{ fontSize: 18, fontWeight: '900', color: '#FFF', letterSpacing: 2 }}>AWAKEN</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── GAME OVER ── */}
        {gameOver && (
          <View style={[StyleSheet.absoluteFillObject, { alignItems: 'center', justifyContent: 'center', zIndex: 100 }]}>
            <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFillObject} />
            <View style={{ backgroundColor: 'rgba(10,5,30,0.9)', padding: 40, borderRadius: 32, borderWidth: 1, borderColor: '#38bdf8', alignItems: 'center' }}>
              <Text style={{ fontSize: 32, fontWeight: '900', color: '#38bdf8', letterSpacing: 4, marginBottom: 12 }}>FLOW BROKEN</Text>
              <Text style={{ fontSize: 20, color: 'rgba(255,255,255,0.7)', fontWeight: '600', marginBottom: 30 }}>Energy Gathered: <Text style={{ color: '#FFF' }}>{score.toLocaleString()}</Text></Text>
              
              <TouchableOpacity onPress={startGame} style={{ paddingHorizontal: 32, paddingVertical: 16, backgroundColor: '#38bdf8', borderRadius: 99, width: '100%', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ fontSize: 16, fontWeight: '900', color: '#000', letterSpacing: 1 }}>PLAY AGAIN</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={{ paddingHorizontal: 32, paddingVertical: 16, backgroundColor: 'transparent', borderRadius: 99, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', width: '100%', alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: 'rgba(255,255,255,0.7)' }}>EXIT GAME</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── QUIT CONFIRM ── */}
        {showQuitConfirm && (
          <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
            <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFillObject} />
            <View style={{ backgroundColor: 'rgba(10,5,30,0.85)', padding: 32, borderRadius: 32, borderWidth: 1, borderColor: '#c084fc', alignItems: 'center', width: '85%' }}>
              <Text style={{ fontSize: 22, fontWeight: '900', color: '#FFF', letterSpacing: 1.5, textAlign: 'center', marginBottom: 12 }}>LEAVING THE FLOW?</Text>
              <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginBottom: 32 }}>Your cosmic journey will be paused.</Text>
              
              <TouchableOpacity onPress={() => { setShowQuitConfirm(false); isSimulating.value = true; setIsPlaying(true); }} style={{ paddingVertical: 16, backgroundColor: '#c084fc', borderRadius: 99, alignItems: 'center', width: '100%', marginBottom: 12 }}>
                <Text style={{ fontSize: 15, fontWeight: '900', color: '#FFF', letterSpacing: 1 }}>RESUME</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={{ paddingVertical: 16, backgroundColor: 'transparent', borderRadius: 99, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', width: '100%' }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: 'rgba(255,255,255,0.5)' }}>END SESSION</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

      </View>
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
  flipperWrap: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    pointerEvents: 'none'
  },
  ball: {
    position: 'absolute', left: 0, top: 0,
    width: BALL_R * 2, height: BALL_R * 2,
    borderRadius: BALL_R,
    backgroundColor: '#FFF',
    shadowColor: '#FFF', shadowOpacity: 1, shadowRadius: 15,
  }
});
