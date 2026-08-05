/**
 * OrbitPulseGame.tsx — "Mind Mario" Mental Health Platformer
 * ─────────────────────────────────────────────────────────────────
 * Super Mario-style 2D platformer with calming mental health theme.
 *
 * Key Architecture (crash-free):
 *  - Physics runs on UI thread via Reanimated useFrameCallback
 *  - Rendering uses JS-state (worldXState) updated ~30fps via runOnJS
 *  - Only VISIBLE chunks rendered — no giant world-wide SVG
 *  - Single W×H SVG, items drawn in screen-space coordinates
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View, Text, Modal, StyleSheet, TouchableOpacity,
  Dimensions, Platform, BackHandler,
} from 'react-native';
import Svg, {
  Rect, Circle, Path, G, Defs, Stop,
  LinearGradient as SvgLinearGradient,
  Text as SvgText,
  Ellipse,
} from 'react-native-svg';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { useSoundPlayer } from '@/lib/soundPlayerContext';
import { ALL_SLEEP_SOUNDS } from '@/lib/sleepSoundsData';
import { Ionicons } from '@expo/vector-icons';
import {
  GestureHandlerRootView,
  GestureDetector,
  Gesture,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useFrameCallback,
  withTiming,
  withSequence,
  withRepeat,
  runOnJS,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

// ─── Screen ──────────────────────────────────────────────────────────────────
const { width: W, height: H } = Dimensions.get('window');

// ─── Game Constants ───────────────────────────────────────────────────────────
const PLAYER_X    = W * 0.22;        // Fixed screen X of player
const PLAYER_W    = 34;
const PLAYER_H    = 46;
const GROUND_Y    = H * 0.72;        // Screen Y of ground surface (player feet rest here)
const GRAVITY     = 1600;
const JUMP_VY     = -630;
const DJ_VY       = -560;
const MAX_VY      = 900;
const WORLD_SPEED = 210;             // px/s initial
const WORLD_ACC   = 3;               // px/s² acceleration
const WORLD_MAX   = 460;
const CHUNK_W     = 600;
const OM_URL      = 'https://audio.onesutralabs.com/om.mp3';
const TANPURA_ID  = 'cdn_new_8';

// ─── World Generation (pure functions, no worklet needed) ────────────────────
type GamePlatform = { x: number; y: number; w: number; id: number };
type Coin     = { x: number; y: number; id: number; label: string };
type Obstacle = { x: number; y: number; w: number; h: number; id: number; type: 'thorn' | 'cloud' };

const LABELS = ['JOY', 'CALM', 'BREATHE', 'FLOW', 'PEACE', 'LOVE', 'HEAL', 'REST'];

function getPlatforms(chunk: number): GamePlatform[] {
  if (chunk < 1) return [];
  const r1 = Math.abs(Math.sin(chunk * 127.1 + 311.7)) % 1;
  const r2 = Math.abs(Math.sin(chunk * 269.5 + 183.3)) % 1;
  const out: GamePlatform[] = [];
  if (r1 > 0.3) {
    out.push({ x: chunk * CHUNK_W + r1 * 280 + 80, y: GROUND_Y - 90 - r2 * 100, w: 90 + r2 * 100, id: chunk * 10 + 1 });
  }
  if (r2 > 0.65 && chunk > 2) {
    out.push({ x: chunk * CHUNK_W + r2 * 200 + 320, y: GROUND_Y - 180 - r1 * 60, w: 70 + r1 * 60, id: chunk * 10 + 2 });
  }
  return out;
}

function getCoins(chunk: number): Coin[] {
  if (chunk < 1) return [];
  const r  = Math.abs(Math.sin(chunk * 75.3  + 457.1)) % 1;
  const r2 = Math.abs(Math.sin(chunk * 132.7 + 89.2))  % 1;
  const baseX = chunk * CHUNK_W + 120 + r * 200;
  const baseY = GROUND_Y - 80 - r2 * 110;
  const lbl   = LABELS[Math.floor(r * LABELS.length) % LABELS.length];
  const coins: Coin[] = [
    { x: baseX,      y: baseY,                             id: chunk * 100,      label: '' },
    { x: baseX + 50, y: baseY - Math.sin(Math.PI / 2) * 30, id: chunk * 100 + 1, label: lbl },
    { x: baseX + 100,y: baseY,                             id: chunk * 100 + 2, label: '' },
  ];
  if (r > 0.5) {
    const plats = getPlatforms(chunk);
    if (plats.length > 0) {
      const p = plats[0];
      coins.push({ x: p.x + p.w / 2, y: p.y - 48, id: chunk * 100 + 10, label: '' });
    }
  }
  return coins;
}

function getObstacles(chunk: number): Obstacle[] {
  if (chunk < 3) return [];
  const r = Math.abs(Math.sin(chunk * 211.3 + 19.1)) % 1;
  if (r < 0.4) return [];
  return [{
    x: chunk * CHUNK_W + 400 + r * 150,
    y: GROUND_Y - 40,
    w: 34, h: 40,
    id: chunk * 1000,
    type: r > 0.7 ? 'cloud' : 'thorn',
  }];
}

// ─── Parallax Sky Background ─────────────────────────────────────────────────
const SkyBackground = React.memo(() => (
  <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
    <LinearGradient
      colors={['#1a0533','#2d1155','#4a2070','#7c3aed','#a855f7','#c084fc','#f0abfc']}
      style={StyleSheet.absoluteFillObject}
      start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
    />
    {/* Stars */}
    <Svg width={W} height={H * 0.55} style={{ position: 'absolute', top: 0 }}>
      {Array.from({ length: 45 }).map((_, i) => (
        <Circle
          key={i}
          cx={((i * 137.5) % 1) * W}
          cy={((i * 73.3)  % 1) * H * 0.5}
          r={i % 4 === 0 ? 2.5 : 1.2}
          fill={`rgba(255,255,255,${0.4 + (i % 3) * 0.2})`}
        />
      ))}
    </Svg>
    {/* Ground fill */}
    <LinearGradient
      colors={['#15803d','#166534','#14532d','#0f2a18']}
      style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: H * 0.29 }}
      start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
    />
  </View>
));

// ─── Parallax Layers (Mountains / Trees / Clouds) ────────────────────────────
const ParallaxLayers = React.memo(({ worldX }: { worldX: SharedValue<number> }) => {
  const mtStyle    = useAnimatedStyle(() => ({ transform: [{ translateX: -(worldX.value * 0.08) % (W * 2) }] }));
  const treeStyle  = useAnimatedStyle(() => ({ transform: [{ translateX: -(worldX.value * 0.28) % (W * 2) }] }));
  const cloudStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -(worldX.value * 0.18) % (W * 3) }] }));

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {/* Mountains */}
      <Animated.View style={[{ position: 'absolute', bottom: H * 0.27, left: 0, width: W * 3, height: 150 }, mtStyle]}>
        <Svg width={W * 3} height={150}>
          {[0, 1, 2].map(t => (
            <G key={t} transform={`translate(${t * W},0)`}>
              <Path d={`M0,150 L${W*0.14},35 L${W*0.28},150 Z`}    fill="rgba(55,18,95,0.55)" />
              <Path d={`M${W*0.22},150 L${W*0.38},12 L${W*0.54},150 Z`} fill="rgba(75,28,125,0.5)" />
              <Path d={`M${W*0.48},150 L${W*0.63},48 L${W*0.78},150 Z`} fill="rgba(55,18,95,0.55)" />
              <Path d={`M${W*0.72},150 L${W*0.88},22 L${W},150 Z`}  fill="rgba(95,35,155,0.45)" />
              {/* Snow */}
              <Path d={`M${W*0.14},35 L${W*0.11},58 L${W*0.17},58 Z`}  fill="rgba(255,255,255,0.28)" />
              <Path d={`M${W*0.38},12 L${W*0.34},42 L${W*0.42},42 Z`}  fill="rgba(255,255,255,0.3)" />
              <Path d={`M${W*0.63},48 L${W*0.60},68 L${W*0.66},68 Z`}  fill="rgba(255,255,255,0.25)" />
              <Path d={`M${W*0.88},22 L${W*0.85},50 L${W*0.91},50 Z`}  fill="rgba(255,255,255,0.28)" />
            </G>
          ))}
        </Svg>
      </Animated.View>

      {/* Trees */}
      <Animated.View style={[{ position: 'absolute', bottom: H * 0.27, left: 0, width: W * 3, height: 100 }, treeStyle]}>
        <Svg width={W * 3} height={100}>
          {Array.from({ length: 22 }).map((_, i) => {
            const tx = i * (W / 6) + ((i * 49) % 55);
            const th = 50 + (i % 3) * 22;
            return (
              <G key={i}>
                <Rect x={tx + 8} y={100 - th} width={8} height={th * 0.35} fill="rgba(80,40,10,0.5)" />
                <Ellipse cx={tx + 12} cy={100 - th} rx={13} ry={th * 0.5}
                  fill={i % 2 === 0 ? 'rgba(20,75,20,0.78)' : 'rgba(30,100,30,0.65)'} />
              </G>
            );
          })}
        </Svg>
      </Animated.View>

      {/* Clouds */}
      <Animated.View style={[{ position: 'absolute', top: H * 0.06, left: 0, width: W * 4, height: 110 }, cloudStyle]}>
        <Svg width={W * 4} height={110}>
          {[W*0.1,W*0.5,W*0.9,W*1.35,W*1.75,W*2.1,W*2.5,W*2.9,W*3.3,W*3.7].map((cx, i) => (
            <G key={i} transform={`translate(${cx},${20 + (i%3)*18}) scale(${0.8 + (i%3)*0.2})`}>
              <Ellipse cx={40} cy={24} rx={40} ry={19} fill="rgba(255,255,255,0.11)" />
              <Ellipse cx={65} cy={18} rx={28} ry={17} fill="rgba(255,255,255,0.09)" />
              <Ellipse cx={18} cy={22} rx={20} ry={14} fill="rgba(255,255,255,0.09)" />
            </G>
          ))}
        </Svg>
      </Animated.View>
    </View>
  );
});

// ─── Ground Tiles ─────────────────────────────────────────────────────────────
const GroundTiles = React.memo(({ worldX }: { worldX: SharedValue<number> }) => {
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: -(worldX.value % 40) }],
  }));
  const count = Math.ceil(W / 40) + 2;
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', top: GROUND_Y, left: -40, width: W + 80, height: H - GROUND_Y }, style]}
    >
      <Svg width={W + 80} height={H - GROUND_Y}>
        <Defs>
          <SvgLinearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0"    stopColor="#22c55e" stopOpacity="1" />
            <Stop offset="0.07" stopColor="#16a34a" stopOpacity="1" />
            <Stop offset="0.09" stopColor="#854d0e" stopOpacity="1" />
            <Stop offset="1"    stopColor="#1c0a00" stopOpacity="1" />
          </SvgLinearGradient>
        </Defs>
        {Array.from({ length: count }).map((_, i) => (
          <G key={i}>
            <Rect x={i*40} y={0} width={40} height={H - GROUND_Y} fill="url(#g1)" />
            <Rect x={i*40} y={0} width={40} height={H - GROUND_Y} fill="none"
              stroke="rgba(0,0,0,0.25)" strokeWidth={1} />
            {/* Grass blades */}
            <Path d={`M${i*40+6},0 Q${i*40+8},-8 ${i*40+10},0`}   stroke="#4ade80" strokeWidth={1.5} fill="none" />
            <Path d={`M${i*40+19},0 Q${i*40+21},-10 ${i*40+23},0`} stroke="#4ade80" strokeWidth={1.5} fill="none" />
            <Path d={`M${i*40+32},0 Q${i*40+34},-7 ${i*40+36},0`}  stroke="#4ade80" strokeWidth={1.5} fill="none" />
            {/* Soil */}
            <Circle cx={i*40+12} cy={18} r={3} fill="rgba(180,120,60,0.28)" />
            <Circle cx={i*40+30} cy={28} r={2} fill="rgba(180,120,60,0.22)" />
          </G>
        ))}
      </Svg>
    </Animated.View>
  );
});

// ─── World Items (rendered in screen-space from JS state) ────────────────────
type WorldState = {
  worldX: number;
  consumed: Record<number, boolean>;
};

const WorldItems = React.memo(({ ws }: { ws: WorldState }) => {
  const { worldX, consumed } = ws;
  const chunk0 = Math.max(0, Math.floor(worldX / CHUNK_W) - 1);
  const visibleChunks = [chunk0, chunk0 + 1, chunk0 + 2, chunk0 + 3];

  const platforms: GamePlatform[] = visibleChunks.flatMap(getPlatforms);
  const coins: Coin[]         = visibleChunks.flatMap(getCoins);
  const obstacles: Obstacle[] = visibleChunks.flatMap(getObstacles);

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <Svg width={W} height={H}>
        <Defs>
          <SvgLinearGradient id="brick" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#f97316" stopOpacity="1" />
            <Stop offset="1" stopColor="#7c2d12" stopOpacity="1" />
          </SvgLinearGradient>
          <SvgLinearGradient id="coin" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#fef08a" stopOpacity="1" />
            <Stop offset="0.5" stopColor="#fbbf24" stopOpacity="1" />
            <Stop offset="1" stopColor="#d97706" stopOpacity="1" />
          </SvgLinearGradient>
          <SvgLinearGradient id="thorn" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#7c3aed" stopOpacity="1" />
            <Stop offset="1" stopColor="#1e1b4b" stopOpacity="1" />
          </SvgLinearGradient>
        </Defs>

        {/* ── Platforms ── */}
        {platforms.map(p => {
          const sx = p.x - worldX;
          if (sx > W + 20 || sx + p.w < -20) return null;
          const bw = 30;
          const bc = Math.ceil(p.w / bw);
          return (
            <G key={p.id}>
              <Rect x={sx} y={p.y} width={p.w} height={22} fill="url(#brick)" rx={3} />
              <Rect x={sx} y={p.y} width={p.w} height={6}  fill="#f97316" opacity={0.7} rx={2} />
              {Array.from({ length: bc }).map((_, bi) => (
                <G key={bi}>
                  <Rect x={sx + bi*bw} y={p.y+6} width={bw} height={16}
                    fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth={1} />
                  <Rect x={sx + bi*bw+2} y={p.y+8} width={bw-4} height={3}
                    fill="rgba(255,255,255,0.15)" rx={1} />
                </G>
              ))}
              <Rect x={sx} y={p.y} width={p.w} height={22}
                fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={1} rx={3} />
            </G>
          );
        })}

        {/* ── Coins ── */}
        {coins.map(coin => {
          if (consumed[coin.id]) return null;
          const sx = coin.x - worldX;
          if (sx > W + 30 || sx < -30) return null;
          return (
            <G key={coin.id}>
              <Circle cx={sx} cy={coin.y} r={16} fill="rgba(251,191,36,0.18)" />
              <Circle cx={sx} cy={coin.y} r={11} fill="url(#coin)" />
              <Circle cx={sx} cy={coin.y} r={7}  fill="none" stroke="#d97706" strokeWidth={1.5} />
              {/* Inner star */}
              <Path
                d={`M${sx},${coin.y-5} L${sx+1.5},${coin.y-1.5} L${sx+5},${coin.y-1.5} L${sx+2.5},${coin.y+1} L${sx+3.5},${coin.y+4} L${sx},${coin.y+2.5} L${sx-3.5},${coin.y+4} L${sx-2.5},${coin.y+1} L${sx-5},${coin.y-1.5} L${sx-1.5},${coin.y-1.5} Z`}
                fill="rgba(255,255,255,0.65)"
              />
              {/* Sheen */}
              <Circle cx={sx - 3} cy={coin.y - 4} r={4} fill="rgba(255,255,255,0.3)" />
              {/* Label pill */}
              {coin.label ? (
                <G>
                  <Rect x={sx-28} y={coin.y-38} width={56} height={17} rx={8} fill="rgba(109,40,217,0.92)" />
                  <SvgText x={sx} y={coin.y-26} textAnchor="middle"
                    fontSize={8} fontWeight="bold" fill="#fff" letterSpacing={1.5}>
                    {coin.label}
                  </SvgText>
                </G>
              ) : null}
            </G>
          );
        })}

        {/* ── Obstacles ── */}
        {obstacles.map(obs => {
          const sx = obs.x - worldX;
          if (sx > W + 40 || sx < -40) return null;
          if (obs.type === 'thorn') {
            const { y, w, h } = obs;
            return (
              <G key={obs.id}>
                <Rect x={sx} y={y+10} width={w} height={h-10} fill="url(#thorn)" rx={3} />
                {[0,1,2].map(si => (
                  <Path key={si}
                    d={`M${sx+si*11+5},${y+10} L${sx+si*11},${y-3} L${sx+si*11+10},${y-3} Z`}
                    fill="#8b5cf6" />
                ))}
                <Rect x={sx-2} y={y-5} width={w+4} height={h+7}
                  fill="none" stroke="rgba(139,92,246,0.45)" strokeWidth={1.5} rx={3} />
              </G>
            );
          } else {
            const { y } = obs;
            return (
              <G key={obs.id}>
                <Ellipse cx={sx+15} cy={y+10} rx={32} ry={17} fill="rgba(25,15,55,0.88)" />
                <Ellipse cx={sx+32} cy={y+5}  rx={22} ry={15} fill="rgba(35,18,75,0.88)" />
                <Ellipse cx={sx}    cy={y+12} rx={17} ry={13} fill="rgba(25,15,55,0.88)" />
                <Path
                  d={`M${sx+20},${y-4} L${sx+13},${y+10} L${sx+18},${y+10} L${sx+11},${y+28} L${sx+23},${y+12} L${sx+17},${y+12} Z`}
                  fill="#fde047" />
              </G>
            );
          }
        })}
      </Svg>
    </View>
  );
});

// ─── Player Character ─────────────────────────────────────────────────────────
const PlayerCharacter = React.memo(({
  playerY, isGrounded, isJumping, isPressing, auraScale,
}: {
  playerY:   SharedValue<number>;
  isGrounded:SharedValue<boolean>;
  isJumping: SharedValue<boolean>;
  isPressing:SharedValue<boolean>;
  auraScale: SharedValue<number>;
}) => {
  const runFrame = useSharedValue(0);
  useEffect(() => {
    runFrame.value = withRepeat(
      withTiming(1, { duration: 280, easing: Easing.linear }), -1, false
    );
  }, []);

  const bodyStyle = useAnimatedStyle(() => {
    const sy = playerY.value - PLAYER_H;
    const sx = isJumping.value ? 1.1 : isPressing.value ? 0.9 : 1.0;
    const sy2 = isJumping.value ? 1.15 : isPressing.value ? 0.87 : 1.0;
    return { transform: [{ translateY: sy }, { scaleX: sx }, { scaleY: sy2 }] };
  });

  const auraStyle = useAnimatedStyle(() => ({
    opacity: interpolate(auraScale.value, [1, 2], [0.3, 0.75]),
    transform: [{ scale: auraScale.value }],
  }));

  const legLStyle = useAnimatedStyle(() => {
    const angle = isGrounded.value ? Math.sin(runFrame.value * Math.PI * 2) * 18 : 0;
    return { transform: [{ rotate: `${angle}deg` }] };
  });
  const legRStyle = useAnimatedStyle(() => {
    const angle = isGrounded.value ? Math.sin(runFrame.value * Math.PI * 2 + Math.PI) * 18 : 0;
    return { transform: [{ rotate: `${angle}deg` }] };
  });

  return (
    <View style={{ position: 'absolute', left: PLAYER_X - PLAYER_W / 2, top: 0,
                   width: PLAYER_W, height: H }}>
      <Animated.View style={[{ position: 'absolute', width: PLAYER_W, height: PLAYER_H }, bodyStyle]}>
        {/* Aura glow */}
        <Animated.View style={[{
          position: 'absolute', left: -18, top: -14,
          width: PLAYER_W + 36, height: PLAYER_H + 28,
          borderRadius: 50, backgroundColor: '#c084fc',
        }, auraStyle]} />
        {/* Shadow */}
        <Svg width={PLAYER_W} height={PLAYER_H}>
          <Ellipse cx={PLAYER_W/2} cy={PLAYER_H-2} rx={12} ry={4} fill="rgba(0,0,0,0.28)" />
          {/* Body */}
          <Rect x={7} y={17} width={20} height={21} fill="#7c3aed" rx={3} />
          <Rect x={9} y={19} width={7}  height={8}  fill="rgba(255,255,255,0.18)" rx={2} />
          {/* Head */}
          <Rect x={5} y={4}  width={24} height={16} fill="#fbbf24" rx={5} />
          {/* Hat brim */}
          <Rect x={3} y={4}  width={28} height={5}  fill="#7c3aed" rx={2} />
          {/* Hat top */}
          <Rect x={7} y={-3} width={20} height={10} fill="#7c3aed" rx={2} />
          {/* Hat star */}
          <Circle cx={PLAYER_W/2} cy={1} r={5} fill="#fde047" />
          <Path
            d={`M${PLAYER_W/2},${-3} L${PLAYER_W/2+1.5},${-0.5} L${PLAYER_W/2+4},${-0.5} L${PLAYER_W/2+2},${1.5} L${PLAYER_W/2+2.5},${4} L${PLAYER_W/2},${2.5} L${PLAYER_W/2-2.5},${4} L${PLAYER_W/2-2},${1.5} L${PLAYER_W/2-4},${-0.5} L${PLAYER_W/2-1.5},${-0.5} Z`}
            fill="rgba(255,255,255,0.75)" />
          {/* Eyes */}
          <Circle cx={11} cy={10} r={2.8} fill="white" />
          <Circle cx={23} cy={10} r={2.8} fill="white" />
          <Circle cx={12} cy={10.5} r={1.3} fill="#1e1b4b" />
          <Circle cx={24} cy={10.5} r={1.3} fill="#1e1b4b" />
          {/* Cheeks */}
          <Circle cx={9}  cy={13} r={2.5} fill="rgba(249,115,22,0.4)" />
          <Circle cx={25} cy={13} r={2.5} fill="rgba(249,115,22,0.4)" />
          {/* Mustache */}
          <Path d="M9,14 Q13,17 17,14 Q21,17 25,14" stroke="#7c2d12" strokeWidth={1.5} fill="none" />
          {/* Arms */}
          <Rect x={1}  y={19} width={7} height={5} fill="#fbbf24" rx={2} />
          <Rect x={26} y={19} width={7} height={5} fill="#fbbf24" rx={2} />
        </Svg>

        {/* Legs — animated */}
        <Animated.View style={[{
          position: 'absolute', left: 7, top: 36,
          width: 10, height: 10, transformOrigin: 'top center',
        }, legLStyle]}>
          <Svg width={10} height={18}>
            <Rect x={0} y={0} width={10} height={10} fill="#1e40af" rx={2} />
            <Rect x={-2} y={8} width={14} height={6} fill="#7c2d12" rx={2} />
          </Svg>
        </Animated.View>
        <Animated.View style={[{
          position: 'absolute', left: 18, top: 36,
          width: 10, height: 10, transformOrigin: 'top center',
        }, legRStyle]}>
          <Svg width={10} height={18}>
            <Rect x={0} y={0} width={10} height={10} fill="#1e40af" rx={2} />
            <Rect x={-2} y={8} width={14} height={6} fill="#7c2d12" rx={2} />
          </Svg>
        </Animated.View>
      </Animated.View>
    </View>
  );
});

// ─── Floating Popup ───────────────────────────────────────────────────────────
function FloatPop({ text, color, onDone }: { text: string; color: string; onDone: () => void }) {
  const op  = useSharedValue(1);
  const ty  = useSharedValue(0);
  useEffect(() => {
    op.value  = withSequence(withTiming(1, { duration: 80 }), withTiming(0, { duration: 750 }));
    ty.value  = withTiming(-58, { duration: 850, easing: Easing.out(Easing.ease) });
    const t   = setTimeout(onDone, 900);
    return () => clearTimeout(t);
  }, []);
  const s = useAnimatedStyle(() => ({ opacity: op.value, transform: [{ translateY: ty.value }] }));
  return (
    <Animated.View style={[{ position: 'absolute', left: PLAYER_X - 52, top: H * 0.38,
                              zIndex: 300, alignItems: 'center' }, s]} pointerEvents="none">
      <LinearGradient colors={['#c084fc','#7c3aed']}
        style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 }}>
        <Text style={{ color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 1.5 }}>{text}</Text>
      </LinearGradient>
    </Animated.View>
  );
}

function ScorePop({ pts, onDone }: { pts: number; onDone: () => void }) {
  const op = useSharedValue(0);
  const ty = useSharedValue(0);
  useEffect(() => {
    op.value = withSequence(withTiming(1, { duration: 80 }), withTiming(0, { duration: 700 }));
    ty.value = withTiming(-48, { duration: 800, easing: Easing.out(Easing.ease) });
    const t  = setTimeout(onDone, 850);
    return () => clearTimeout(t);
  }, []);
  const s = useAnimatedStyle(() => ({ opacity: op.value, transform: [{ translateY: ty.value }] }));
  return (
    <Animated.View style={[{ position: 'absolute', left: PLAYER_X + 18, top: H * 0.48,
                              zIndex: 301 }, s]} pointerEvents="none">
      <Text style={{ color: '#fde047', fontWeight: '900', fontSize: 22,
                     textShadowColor: '#000', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } }}>
        +{pts}
      </Text>
    </Animated.View>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function OrbitPulseGame({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { playSound, stopSound, setGlobalVolume } = useSoundPlayer();

  // ── React State ──
  const [score,          setScore]          = useState(0);
  const [health,         setHealth]         = useState(3);
  const [distance,       setDistance]       = useState(0);
  const [combo,          setCombo]          = useState(0);
  const [gameOver,       setGameOver]       = useState(false);
  const [showTutorial,   setShowTutorial]   = useState(true);
  const [showQuit,       setShowQuit]       = useState(false);
  const [worldState,     setWorldState]     = useState<WorldState>({ worldX: 0, consumed: {} });
  const [popups,         setPopups]         = useState<Array<{ id: number; type: 'label'|'pts'; text: string; pts?: number }>>([]);

  const popIdRef   = useRef(0);
  const scoreRef   = useRef(0);
  const comboRef   = useRef(0);
  const comboTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const omSnd      = useRef<Audio.Sound | null>(null);
  const tanSnd     = useRef<Audio.Sound | null>(null);

  // ── Shared Values (UI Thread) ──
  const isPlaying   = useSharedValue(false);
  const worldX      = useSharedValue(0);
  const playerY     = useSharedValue(GROUND_Y);
  const playerVY    = useSharedValue(0);
  const worldSpd    = useSharedValue(WORLD_SPEED);
  const isGrounded  = useSharedValue(true);
  const isJumping   = useSharedValue(false);
  const isPressing  = useSharedValue(false);
  const jumpCount   = useSharedValue(0);
  const consumed    = useSharedValue<Record<number, boolean>>({});
  const hitObs      = useSharedValue<Record<number, boolean>>({});
  const auraScale   = useSharedValue(1.0);
  const flashOp     = useSharedValue(0);
  const shakeX      = useSharedValue(0);

  // Back handler
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isPlaying.value || showTutorial) { setShowQuit(true); isPlaying.value = false; return true; }
      return false;
    });
    return () => sub.remove();
  }, [showTutorial]);

  // ── Audio ──
  useEffect(() => {
    if (!visible) return;
    (async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, allowsRecordingIOS: false });
        const { sound } = await Audio.Sound.createAsync({ uri: OM_URL }, { shouldPlay: false });
        omSnd.current = sound;
        const src = require('../assets/sounds/tanpura-mystic.m4a');
        const { sound: ts } = await Audio.Sound.createAsync(src, { shouldPlay: true, isLooping: true, volume: 0.35 });
        tanSnd.current = ts;
      } catch (_) {}
    })();
    return () => { omSnd.current?.unloadAsync(); tanSnd.current?.unloadAsync(); };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const t = ALL_SLEEP_SOUNDS.find(s => s.id === TANPURA_ID);
    if (t) { setGlobalVolume(0.55); playSound(t, 3600, undefined, 0.55, true); }
    return () => { stopSound(); setGlobalVolume(1); };
  }, [visible]);

  // ── JS Callbacks ──
  const addPopup = useCallback((type: 'label'|'pts', text: string, pts?: number) => {
    const id = ++popIdRef.current;
    setPopups(p => [...p.slice(-4), { id, type, text, pts }]);
  }, []);
  const removePopup = useCallback((id: number) => {
    setPopups(p => p.filter(x => x.id !== id));
  }, []);

  // Throttled world state sync (render at ~30fps from UI thread worldX)
  const syncWorldState = useCallback((wx: number, cons: Record<number, boolean>) => {
    setWorldState({ worldX: wx, consumed: cons });
  }, []);

  const onCoinHit = useCallback((label: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    omSnd.current?.setPositionAsync(0).catch(() => {});
    omSnd.current?.playAsync().catch(() => {});
    comboRef.current += 1;
    setCombo(comboRef.current);
    if (comboTimer.current) clearTimeout(comboTimer.current);
    comboTimer.current = setTimeout(() => { comboRef.current = 0; setCombo(0); }, 2000);
    const pts = 100 * (comboRef.current >= 3 ? 2 : 1);
    scoreRef.current += pts;
    setScore(scoreRef.current);
    if (label) addPopup('label', label);
    addPopup('pts', `+${pts}`);
  }, [addPopup]);

  const onObsHit = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    flashOp.value = withSequence(withTiming(0.65, { duration: 60 }), withTiming(0, { duration: 500 }));
    shakeX.value  = withSequence(
      withTiming(18, { duration: 45 }), withTiming(-18, { duration: 45 }),
      withTiming(10, { duration: 35 }), withTiming(-10, { duration: 35 }),
      withTiming(0,  { duration: 35 })
    );
    setHealth(h => {
      const nh = h - 1;
      if (nh <= 0) { isPlaying.value = false; setGameOver(true); }
      return nh;
    });
  }, []);

  const onDistTick = useCallback((d: number) => {
    setDistance(Math.floor(d / 10));
    scoreRef.current += 0.4;
    setScore(Math.floor(scoreRef.current));
  }, []);

  const doJumpHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  // ── Sync rate limiter ──
  const lastSync = useSharedValue(0);

  // ── Game Loop ──
  useFrameCallback(({ timeSincePreviousFrame }) => {
    if (!isPlaying.value) return;
    const dt = Math.min((timeSincePreviousFrame ?? 16) / 1000, 0.05);

    // World scroll
    worldSpd.value  = Math.min(worldSpd.value + WORLD_ACC * dt, WORLD_MAX);
    worldX.value   += worldSpd.value * dt;

    // Gravity
    playerVY.value  = Math.min(playerVY.value + GRAVITY * dt, MAX_VY);
    playerY.value  += playerVY.value * dt;

    // ── Platform collision ──
    const ci0 = Math.max(0, Math.floor(worldX.value / CHUNK_W) - 1);
    let onPlat = false;
    for (let ci = ci0; ci <= ci0 + 3; ci++) {
      const plats = getPlatforms(ci);
      for (const p of plats) {
        const psx  = p.x - worldX.value;
        const pLeft = psx;
        const pRight = psx + p.w;
        const pl = PLAYER_X - PLAYER_W / 2;
        const pr = PLAYER_X + PLAYER_W / 2;
        if (pr > pLeft && pl < pRight) {
          const prevY = playerY.value - playerVY.value * dt;
          if (prevY <= p.y + 4 && playerY.value >= p.y - 2 && playerVY.value >= 0) {
            playerY.value  = p.y;
            playerVY.value = 0;
            isGrounded.value = true;
            isJumping.value  = false;
            jumpCount.value  = 0;
            onPlat = true;
          }
        }
      }
    }

    // ── Ground collision ──
    if (!onPlat) {
      if (playerY.value >= GROUND_Y) {
        playerY.value    = GROUND_Y;
        playerVY.value   = 0;
        isGrounded.value = true;
        isJumping.value  = false;
        jumpCount.value  = 0;
      } else {
        isGrounded.value = false;
      }
    }

    // ── Coin collision ──
    for (let ci = ci0; ci <= ci0 + 3; ci++) {
      const coins = getCoins(ci);
      for (const coin of coins) {
        if (consumed.value[coin.id]) continue;
        const csx = coin.x - worldX.value;
        const dx  = Math.abs(PLAYER_X - csx);
        const dy  = Math.abs((playerY.value - PLAYER_H / 2) - coin.y);
        if (dx < PLAYER_W * 0.85 && dy < PLAYER_H * 0.85) {
          const m = { ...consumed.value };
          m[coin.id] = true;
          consumed.value  = m;
          auraScale.value = withTiming(Math.min(auraScale.value + 0.22, 2.2), { duration: 240 });
          runOnJS(onCoinHit)(coin.label);
        }
      }
    }

    // ── Obstacle collision ──
    for (let ci = ci0; ci <= ci0 + 3; ci++) {
      const obs = getObstacles(ci);
      for (const o of obs) {
        if (hitObs.value[o.id]) continue;
        const osx  = o.x - worldX.value;
        const pl   = PLAYER_X - PLAYER_W / 2 + 7;
        const pr   = PLAYER_X + PLAYER_W / 2 - 7;
        const pt   = playerY.value - PLAYER_H;
        const pb   = playerY.value;
        if (pr > osx && pl < osx + o.w && pb > o.y && pt < o.y + o.h) {
          const m = { ...hitObs.value };
          m[o.id] = true;
          hitObs.value   = m;
          auraScale.value = withTiming(Math.max(auraScale.value - 0.35, 0.6), { duration: 280 });
          runOnJS(onObsHit)();
        }
      }
    }

    // Aura decay
    if (auraScale.value > 1) auraScale.value = Math.max(1, auraScale.value - 0.25 * dt);

    // Distance tick
    runOnJS(onDistTick)(worldX.value);

    // Sync render state ~30fps
    const now = Date.now();
    if (now - lastSync.value > 33) {
      lastSync.value = now;
      runOnJS(syncWorldState)(worldX.value, consumed.value);
    }
  });

  // ── Gestures ──
  const tapGesture = Gesture.Tap().onEnd(() => {
    if (gameOver || showQuit) return;
    if (showTutorial) {
      runOnJS(setShowTutorial)(false);
      isPlaying.value = true;
      return;
    }
    if (!isPlaying.value) return;
    if (isGrounded.value || jumpCount.value < 1) {
      playerVY.value   = jumpCount.value === 0 ? JUMP_VY : DJ_VY;
      isGrounded.value = false;
      isJumping.value  = true;
      jumpCount.value += 1;
      runOnJS(doJumpHaptic)();
    }
  });
  const holdGesture = Gesture.LongPress().minDuration(180)
    .onBegin(() => { isPressing.value = true; })
    .onFinalize(() => { isPressing.value = false; });
  const combined = Gesture.Simultaneous(tapGesture, holdGesture);

  // ── Restart ──
  const restart = useCallback(() => {
    worldX.value    = 0; playerY.value = GROUND_Y; playerVY.value = 0;
    worldSpd.value  = WORLD_SPEED;
    isGrounded.value = true; isJumping.value = false;
    isPressing.value = false; jumpCount.value = 0;
    consumed.value  = {}; hitObs.value = {};
    auraScale.value = 1; flashOp.value = 0; shakeX.value = 0;
    scoreRef.current = 0; comboRef.current = 0;
    setScore(0); setDistance(0); setHealth(3); setCombo(0);
    setGameOver(false); setPopups([]);
    setWorldState({ worldX: 0, consumed: {} });
    isPlaying.value = true;
  }, []);

  const closePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    isPlaying.value = false;
    setShowQuit(true);
  }, []);

  // ── Animated styles ──
  const flashStyle = useAnimatedStyle(() => ({ opacity: flashOp.value }));
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));

  // ── Render ──
  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent transparent onRequestClose={closePress}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <GestureDetector gesture={combined}>
          <View style={st.root}>

            {/* Sky */}
            <SkyBackground />
            {/* Parallax layers */}
            <ParallaxLayers worldX={worldX} />

            {/* Shake wrapper */}
            <Animated.View style={[StyleSheet.absoluteFillObject, shakeStyle]} pointerEvents="none">
              {/* World items — JS-rendered, only visible chunks */}
              <WorldItems ws={worldState} />
              {/* Ground tiles */}
              <GroundTiles worldX={worldX} />
              {/* Player */}
              <PlayerCharacter
                playerY={playerY} isGrounded={isGrounded}
                isJumping={isJumping} isPressing={isPressing}
                auraScale={auraScale}
              />
            </Animated.View>

            {/* Screen flash */}
            <Animated.View pointerEvents="none"
              style={[StyleSheet.absoluteFillObject, { backgroundColor: '#c084fc', zIndex: 300 }, flashStyle]} />

            {/* Popups */}
            {popups.map(p => p.type === 'label'
              ? <FloatPop key={p.id} text={p.text} color="#c084fc" onDone={() => removePopup(p.id)} />
              : <ScorePop key={p.id} pts={p.pts ?? 0} onDone={() => removePopup(p.id)} />
            )}

            {/* ── HUD ── */}
            <View style={st.hud} pointerEvents="box-none">
              <TouchableOpacity onPress={closePress} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <View style={st.closeBtn}>
                  <Ionicons name="close" size={20} color="#e9d5ff" />
                </View>
              </TouchableOpacity>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={st.hudLabel}>FLOW POINTS</Text>
                <Text style={st.hudScore}>{score.toLocaleString()}</Text>
                <Text style={st.hudSub}>
                  {distance}m {combo >= 3 ? `🔥 COMBO ×${combo}` : combo > 0 ? `✦ ×${combo}` : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', minWidth: 64 }}>
                <View style={{ flexDirection: 'row', gap: 5 }}>
                  {[0,1,2].map(i => (
                    <View key={i} style={{
                      width: 15, height: 15, borderRadius: 8,
                      backgroundColor: i < health ? '#f472b6' : 'rgba(255,255,255,0.14)',
                      borderWidth: 1.5,
                      borderColor:     i < health ? '#ec4899' : 'rgba(255,255,255,0.08)',
                    }} />
                  ))}
                </View>
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, marginTop: 4 }}>BREATH</Text>
              </View>
            </View>

            {/* ── Tutorial ── */}
            {showTutorial && (
              <View style={[st.overlay]} pointerEvents="none">
                <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFillObject} />
                <View style={st.card}>
                  <LinearGradient colors={['#4c1d95','#1e1b4b']}
                    style={[StyleSheet.absoluteFillObject, { borderRadius: 28 }]} />
                  <View style={{ borderWidth: 1, borderColor: 'rgba(192,132,252,0.4)',
                                 borderRadius: 28, ...StyleSheet.absoluteFillObject }} />
                  <View style={{ alignItems: 'center', marginBottom: 22 }}>
                    <Text style={st.tutBadge}>MIND MARIO</Text>
                    <Text style={st.tutTitle}>AURA FLOW</Text>
                    <Text style={st.tutSub}>A calming journey for mind & soul</Text>
                  </View>
                  {[
                    { icon: '👆',   title: 'TAP',         desc: 'Jump' },
                    { icon: '👆👆', title: 'DOUBLE TAP',  desc: 'Double jump in mid-air' },
                    { icon: '✦',   title: 'COLLECT',     desc: 'Joy seeds for calm energy' },
                    { icon: '⚡',  title: 'AVOID',       desc: 'Stress clouds & thorns' },
                  ].map((item, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                      <View style={{ width: 42, height: 42, borderRadius: 21,
                                     backgroundColor: 'rgba(192,132,252,0.2)',
                                     alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 18 }}>{item.icon}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: '#c084fc', fontWeight: '900', fontSize: 12, letterSpacing: 1 }}>{item.title}</Text>
                        <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>{item.desc}</Text>
                      </View>
                    </View>
                  ))}
                  <LinearGradient colors={['#7c3aed','#4c1d95']}
                    style={{ marginTop: 20, borderRadius: 99 }}>
                    <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                      <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 2 }}>TAP TO BEGIN ✦</Text>
                    </View>
                  </LinearGradient>
                </View>
              </View>
            )}

            {/* ── Game Over ── */}
            {gameOver && (
              <View style={[st.overlay, { zIndex: 500 }]}>
                <BlurView intensity={42} tint="dark" style={StyleSheet.absoluteFillObject} />
                <View style={st.card}>
                  <LinearGradient colors={['#1e1b4b','#0f0c29']}
                    style={[StyleSheet.absoluteFillObject, { borderRadius: 28 }]} />
                  <View style={{ borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
                                 borderRadius: 28, ...StyleSheet.absoluteFillObject }} />
                  <Text style={{ fontSize: 12, color: '#f472b6', fontWeight: '900', letterSpacing: 3,
                                 textAlign: 'center', marginBottom: 6 }}>SESSION ENDED</Text>
                  <Text style={{ fontSize: 30, fontWeight: '900', color: '#fff', textAlign: 'center', marginBottom: 6 }}>
                    Take a breath.
                  </Text>
                  <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginBottom: 24 }}>
                    You did beautifully. Try again.
                  </Text>
                  <View style={{ backgroundColor: 'rgba(192,132,252,0.12)', borderRadius: 16,
                                 padding: 16, marginBottom: 22 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, textAlign: 'center', marginBottom: 4 }}>FLOW SCORE</Text>
                    <Text style={{ color: '#fff', fontSize: 38, fontWeight: '900', textAlign: 'center' }}>{score.toLocaleString()}</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center', marginTop: 4 }}>{distance}m traveled</Text>
                  </View>
                  <TouchableOpacity onPress={restart} style={{ width: '100%', marginBottom: 12 }}>
                    <LinearGradient colors={['#7c3aed','#4c1d95']}
                      style={{ borderRadius: 99, paddingVertical: 16, alignItems: 'center' }}>
                      <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 1.5 }}>FLOW AGAIN ✦</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={onClose} style={st.outlineBtn}>
                    <Text style={st.outlineTxt}>Return to Peace</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ── Quit Confirm ── */}
            {showQuit && (
              <View style={[st.overlay, { zIndex: 600 }]}>
                <BlurView intensity={52} tint="dark" style={StyleSheet.absoluteFillObject} />
                <View style={st.card}>
                  <LinearGradient colors={['#1e1b4b','#0f0c29']}
                    style={[StyleSheet.absoluteFillObject, { borderRadius: 28 }]} />
                  <View style={{ borderWidth: 1, borderColor: 'rgba(192,132,252,0.35)',
                                 borderRadius: 28, ...StyleSheet.absoluteFillObject }} />
                  <Ionicons name="moon" size={46} color="#c084fc"
                    style={{ marginBottom: 16, alignSelf: 'center' }} />
                  <Text style={{ fontSize: 22, fontWeight: '900', color: '#fff',
                                 textAlign: 'center', marginBottom: 10 }}>Leaving the Flow?</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, textAlign: 'center',
                                 lineHeight: 22, marginBottom: 28 }}>
                    Your peace journey is still ongoing. Keep flowing or return to calm?
                  </Text>
                  <TouchableOpacity style={{ width: '100%', marginBottom: 12 }}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setShowQuit(false);
                      isPlaying.value = true;
                    }}>
                    <LinearGradient colors={['#7c3aed','#4c1d95']}
                      style={{ borderRadius: 99, paddingVertical: 16, alignItems: 'center' }}>
                      <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15, letterSpacing: 1 }}>KEEP FLOWING ✦</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onClose(); }}
                    style={st.outlineBtn}>
                    <Text style={st.outlineTxt}>Return to Peace</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

          </View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f0c29', overflow: 'hidden' },
  hud: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 38,
    left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', zIndex: 400,
  },
  hudLabel: { fontSize: 10, color: '#c084fc', fontWeight: '800', letterSpacing: 2.5, marginBottom: 2 },
  hudScore: { fontSize: 34, fontWeight: '900', color: '#fff',
              textShadowColor: '#7c3aed', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12 },
  hudSub:   { fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: '600', marginTop: 2, letterSpacing: 0.4 },
  closeBtn: { backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 22, padding: 8,
              borderWidth: 1, borderColor: 'rgba(192,132,252,0.38)' },
  overlay:  { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              alignItems: 'center', justifyContent: 'center', zIndex: 400 },
  card:     { width: '88%', padding: 28, borderRadius: 28, overflow: 'hidden' },
  outlineBtn: { width: '100%', paddingVertical: 14, alignItems: 'center',
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', borderRadius: 99 },
  outlineTxt: { color: 'rgba(255,255,255,0.5)', fontWeight: '700', fontSize: 14 },
  tutBadge: { fontSize: 10, color: '#c084fc', fontWeight: '800', letterSpacing: 3, marginBottom: 8 },
  tutTitle: { fontSize: 26, fontWeight: '900', color: '#fff', letterSpacing: 1 },
  tutSub:   { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 6, textAlign: 'center' },
});
