import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Animated, TouchableWithoutFeedback, Dimensions, Text,
  StyleSheet, Modal, TouchableOpacity,
} from 'react-native';
import Svg, {
  Path, Circle, Ellipse, G, Defs, RadialGradient, LinearGradient as SvgLinearGradient,
  Stop, Rect, Line,
} from 'react-native-svg';
import { type AppleTreeState, type TimeOfDay, getTimeOfDay, STAGE_NAMES, STAGE_MESSAGES } from './types';

const { width: SW } = Dimensions.get('window');
const CW = SW - 32;
const CH = 260;
const CX = CW / 2;

// ─── Sky Gradient by time of day ──────────────────────────────────────────────
function getSkyColors(tod: TimeOfDay, stage: number): [string, string, string] {
  if (stage <= 1) return ['#1a1a2e', '#16213e', '#0f3460'];
  switch (tod) {
    case 'early_morning': return ['#1a0a2e', '#2d1b5a', '#c6893a'];
    case 'morning':       return ['#87ceeb', '#b0e2ff', '#e8f4fd'];
    case 'afternoon':     return ['#4a9eda', '#87ceeb', '#c9e8f7'];
    case 'evening':       return ['#ff7043', '#ff9800', '#ffcc80'];
    case 'night':         return ['#0d1b2a', '#1b2838', '#0a0f1e'];
  }
}

// ─── Tree geometry by stage ────────────────────────────────────────────────────
function getTrunkHeight(stage: number): number {
  const heights = [0, 14, 40, 60, 90, 110, 130, 145];
  return heights[stage] ?? 145;
}

function getTrunkWidth(stage: number): number {
  const widths = [0, 0, 5, 8, 13, 16, 18, 22];
  return widths[stage] ?? 22;
}

function getLeafColor(health: string, tod: TimeOfDay): string {
  if (health === 'critical')    return '#8B7355';
  if (health === 'wilting')     return '#B8B820';
  if (health === 'needs_water') return '#5a9e52';
  return tod === 'morning' ? '#4CAF50' : '#388E3C';
}

// ─── APPLE TREE SVG ────────────────────────────────────────────────────────────
interface TreeSVGProps {
  stage: number;
  health: string;
  tod: TimeOfDay;
}

function TreeSVG({ stage, health, tod }: TreeSVGProps) {
  const leafColor = getLeafColor(health, tod);
  const skyColors = getSkyColors(tod, stage);
  const trunkH = getTrunkHeight(stage);
  const trunkW = getTrunkWidth(stage);
  const groundY = CH - 32;
  const trunkBaseY = groundY;
  const trunkTopY = groundY - trunkH;
  const trunkCX = CX;


  return (
    <Svg width={CW} height={CH} viewBox={`0 0 ${CW} ${CH}`}>
      <Defs>
        <SvgLinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={skyColors[0]} />
          <Stop offset="0.5" stopColor={skyColors[1]} />
          <Stop offset="1" stopColor={skyColors[2]} />
        </SvgLinearGradient>
        <SvgLinearGradient id="trunk_grad" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#3E2723" />
          <Stop offset="0.3" stopColor="#5D4037" />
          <Stop offset="0.7" stopColor="#8D6E63" />
          <Stop offset="1" stopColor="#4E342E" />
        </SvgLinearGradient>
        <SvgLinearGradient id="soil_grad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#4a3728" />
          <Stop offset="1" stopColor="#2d1f14" />
        </SvgLinearGradient>
        <RadialGradient id="leaf_grad" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={leafColor} stopOpacity="1" />
          <Stop offset="1" stopColor={leafColor} stopOpacity="0.8" />
        </RadialGradient>
        <RadialGradient id="apple_red" cx="35%" cy="30%" r="60%">
          <Stop offset="0" stopColor="#FF6B6B" />
          <Stop offset="0.5" stopColor="#C62828" />
          <Stop offset="1" stopColor="#8B0000" />
        </RadialGradient>
        <RadialGradient id="apple_green" cx="35%" cy="30%" r="60%">
          <Stop offset="0" stopColor="#AED581" />
          <Stop offset="0.5" stopColor="#7CB342" />
          <Stop offset="1" stopColor="#558B2F" />
        </RadialGradient>
        <RadialGradient id="apple_yellow" cx="35%" cy="30%" r="60%">
          <Stop offset="0" stopColor="#FFF176" />
          <Stop offset="0.5" stopColor="#F9A825" />
          <Stop offset="1" stopColor="#E65100" />
        </RadialGradient>
      </Defs>

      {/* Sky */}
      <Rect x="0" y="0" width={CW} height={groundY} fill="url(#sky)" />

      {/* Clouds (stage 5+) */}
      {stage >= 5 && <Cloud x={CW * 0.15} y={20} scale={0.7} />}
      {stage >= 6 && <Cloud x={CW * 0.65} y={30} scale={0.5} />}

      {/* Ground */}
      <Rect x="0" y={groundY} width={CW} height={CH - groundY} fill="url(#soil_grad)" />

      {/* Grass tufts */}
      <GrassTufts groundY={groundY} cw={CW} />

      {/* Ground shadow */}
      {stage >= 3 && (
        <Ellipse cx={trunkCX} cy={groundY + 4} rx={trunkW * 2.5} ry={4} fill="rgba(0,0,0,0.35)" />
      )}

      {/* STAGE 1: Seed */}
      {stage === 1 && <SeedStage groundY={groundY} cx={trunkCX} />}

      {/* STAGE 2: Seedling */}
      {stage === 2 && <SeedlingStage groundY={groundY} cx={trunkCX} leafColor={leafColor} />}

      {/* Stage 3+: Trunk + Branches */}
      {stage >= 3 && (
        <>
          {/* Visible roots (stage 4+) */}
          {stage >= 4 && <Roots cx={trunkCX} baseY={groundY} trunkW={trunkW} />}

          {/* Trunk */}
          <Trunk
            cx={trunkCX} baseY={trunkBaseY}
            topY={trunkTopY} w={trunkW}
            stage={stage}
          />

          {/* Trunk knot detail */}
          {stage >= 4 && (
            <Ellipse
              cx={trunkCX + 2} cy={trunkTopY + trunkH * 0.55}
              rx={3} ry={2}
              fill="#3E2723" opacity={0.7}
            />
          )}

          {/* Branches + Leaves + Blossoms + Apples */}
          <CanopyGroup
            stage={stage} cx={trunkCX} topY={trunkTopY}
            leafColor={leafColor} health={health} tod={tod}
          />
        </>
      )}

      {/* Tree shadow (stage 7, evening) */}
      {stage === 7 && tod === 'evening' && (
        <Ellipse cx={trunkCX - 20} cy={groundY + 6} rx={55} ry={8} fill="rgba(0,0,0,0.22)" />
      )}
    </Svg>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function Cloud({ x, y, scale }: { x: number; y: number; scale: number }) {
  return (
    <G transform={`translate(${x},${y}) scale(${scale})`}>
      <Ellipse cx={20} cy={12} rx={18} ry={10} fill="rgba(255,255,255,0.75)" />
      <Ellipse cx={35} cy={10} rx={14} ry={9} fill="rgba(255,255,255,0.80)" />
      <Ellipse cx={10} cy={14} rx={10} ry={7} fill="rgba(255,255,255,0.70)" />
    </G>
  );
}

function GrassTufts({ groundY, cw }: { groundY: number; cw: number }) {
  const tufts = [0.1, 0.18, 0.28, 0.38, 0.52, 0.62, 0.72, 0.82, 0.9];
  return (
    <G>
      {tufts.map((t, i) => {
        const x = t * cw;
        const h = 4 + (i % 3);
        return (
          <G key={i}>
            <Path d={`M${x},${groundY} Q${x - 2},${groundY - h} ${x},${groundY - h + 1}`} stroke="#4CAF50" strokeWidth="1.2" fill="none" opacity={0.8} />
            <Path d={`M${x + 2},${groundY} Q${x + 4},${groundY - h + 1} ${x + 2},${groundY - h + 2}`} stroke="#388E3C" strokeWidth="1" fill="none" opacity={0.7} />
          </G>
        );
      })}
    </G>
  );
}

function SeedStage({ groundY, cx }: { groundY: number; cx: number }) {
  return (
    <G>
      {/* Soil crack lines */}
      <Line x1={cx - 18} y1={groundY - 3} x2={cx - 8} y2={groundY - 5} stroke="#6D4C41" strokeWidth="0.8" opacity={0.5} />
      <Line x1={cx + 12} y1={groundY - 4} x2={cx + 22} y2={groundY - 2} stroke="#6D4C41" strokeWidth="0.8" opacity={0.5} />
      {/* Seed */}
      <Ellipse cx={cx} cy={groundY - 8} rx={5} ry={7} fill="#5D4037" />
      <Ellipse cx={cx} cy={groundY - 9} rx={2} ry={3} fill="#8D6E63" opacity={0.6} />
      {/* Tiny root threads */}
      <Path d={`M${cx - 1},${groundY - 1} Q${cx - 4},${groundY + 4} ${cx - 6},${groundY + 8}`} stroke="#9E9E9E" strokeWidth="0.8" fill="none" opacity={0.5} />
      <Path d={`M${cx + 1},${groundY - 1} Q${cx + 3},${groundY + 3} ${cx + 5},${groundY + 7}`} stroke="#9E9E9E" strokeWidth="0.8" fill="none" opacity={0.5} />
      {/* Moisture halo */}
      <Ellipse cx={cx} cy={groundY - 6} rx={9} ry={11} fill="none" stroke="rgba(100,160,255,0.18)" strokeWidth="1.5" />
    </G>
  );
}

function SeedlingStage({ groundY, cx, leafColor }: { groundY: number; cx: number; leafColor: string }) {
  const stemH = 38;
  return (
    <G>
      {/* Cracked seed halves */}
      <Ellipse cx={cx - 3} cy={groundY - 5} rx={3.5} ry={5} fill="#5D4037" transform={`rotate(-15, ${cx - 3}, ${groundY - 5})`} />
      <Ellipse cx={cx + 3} cy={groundY - 5} rx={3.5} ry={5} fill="#5D4037" transform={`rotate(15, ${cx + 3}, ${groundY - 5})`} />
      {/* Thin stem */}
      <Path d={`M${cx},${groundY - 3} Q${cx - 2},${groundY - stemH * 0.5} ${cx + 1},${groundY - stemH}`}
        stroke="#A5D6A7" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {/* Cotyledon leaves */}
      <Leaf cx={cx - 9} cy={groundY - stemH + 3} angle={-40} size={9} color="#C8E6C9" />
      <Leaf cx={cx + 9} cy={groundY - stemH + 3} angle={40} size={9} color="#C8E6C9" />
    </G>
  );
}

function Roots({ cx, baseY, trunkW }: { cx: number; baseY: number; trunkW: number }) {
  return (
    <G>
      <Path d={`M${cx - trunkW * 0.4},${baseY} Q${cx - 28},${baseY + 8} ${cx - 42},${baseY + 5}`}
        stroke="#5D4037" strokeWidth="5" fill="none" strokeLinecap="round" />
      <Path d={`M${cx - trunkW * 0.3},${baseY} Q${cx - 20},${baseY + 12} ${cx - 30},${baseY + 18}`}
        stroke="#5D4037" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <Path d={`M${cx + trunkW * 0.4},${baseY} Q${cx + 28},${baseY + 8} ${cx + 42},${baseY + 5}`}
        stroke="#5D4037" strokeWidth="5" fill="none" strokeLinecap="round" />
      <Path d={`M${cx + trunkW * 0.3},${baseY} Q${cx + 20},${baseY + 12} ${cx + 30},${baseY + 18}`}
        stroke="#5D4037" strokeWidth="3.5" fill="none" strokeLinecap="round" />
    </G>
  );
}

function Trunk({ cx, baseY, topY, w, stage }: { cx: number; baseY: number; topY: number; w: number; stage: number }) {
  const bw = w * 1.35;
  return (
    <G>
      {/* Main trunk shape — irregular polygon */}
      <Path
        d={`M${cx - bw},${baseY} Q${cx - bw * 0.7},${topY + (baseY - topY) * 0.6} ${cx - w * 0.55},${topY}
           L${cx + w * 0.55},${topY}
           Q${cx + bw * 0.65},${topY + (baseY - topY) * 0.55} ${cx + bw},${baseY} Z`}
        fill="url(#trunk_grad)"
      />
      {/* Bark vertical lines */}
      {stage >= 4 && Array.from({ length: 4 }).map((_, i) => {
        const x = cx - w * 0.4 + (i * w * 0.28);
        const yTop = topY + 8 + (i % 2) * 12;
        const yBot = baseY - 8;
        return (
          <Path key={i}
            d={`M${x},${yBot} Q${x + (i % 2 === 0 ? 1.5 : -1.5)},${(yTop + yBot) / 2} ${x},${yTop}`}
            stroke="#3E2723" strokeWidth="0.8" fill="none" opacity={0.45}
          />
        );
      })}
    </G>
  );
}

function Leaf({ cx, cy, angle, size, color }: { cx: number; cy: number; angle: number; size: number; color: string }) {
  return (
    <G transform={`translate(${cx},${cy}) rotate(${angle})`}>
      <Ellipse rx={size * 0.45} ry={size * 0.75} fill={color} />
      <Line x1={0} y1={-size * 0.7} x2={0} y2={size * 0.5} stroke="rgba(0,0,0,0.25)" strokeWidth="0.6" />
    </G>
  );
}

function Apple({ cx, cy, size, type }: { cx: number; cy: number; size: number; type: 'red' | 'green' | 'yellow' | 'tiny' }) {
  const fill = type === 'red' ? 'url(#apple_red)' : type === 'green' ? 'url(#apple_green)' : type === 'tiny' ? '#AED581' : 'url(#apple_yellow)';
  const r = type === 'tiny' ? size * 0.5 : size;
  return (
    <G>
      {/* Stem */}
      <Path d={`M${cx},${cy - r} Q${cx + 2},${cy - r - 5} ${cx + 1},${cy - r - 7}`}
        stroke="#5D4037" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      {/* Apple body */}
      <Ellipse cx={cx} cy={cy} rx={r * 0.9} ry={r} fill={fill} />
      {/* Indent at top */}
      <Ellipse cx={cx} cy={cy - r + 1} rx={r * 0.3} ry={r * 0.2} fill="rgba(0,0,0,0.2)" />
      {/* Highlight */}
      {type !== 'tiny' && (
        <Ellipse cx={cx - r * 0.3} cy={cy - r * 0.35} rx={r * 0.22} ry={r * 0.28} fill="rgba(255,255,255,0.35)" />
      )}
    </G>
  );
}

function Blossom({ cx, cy }: { cx: number; cy: number }) {
  const petals = [0, 72, 144, 216, 288];
  return (
    <G>
      {petals.map((angle, i) => (
        <Ellipse key={i}
          cx={cx + Math.cos((angle * Math.PI) / 180) * 4.5}
          cy={cy + Math.sin((angle * Math.PI) / 180) * 4.5}
          rx={3.5} ry={2.5}
          fill="#FFF9C4"
          transform={`rotate(${angle}, ${cx + Math.cos((angle * Math.PI) / 180) * 4.5}, ${cy + Math.sin((angle * Math.PI) / 180) * 4.5})`}
          opacity={0.92}
        />
      ))}
      <Circle cx={cx} cy={cy} r={2.8} fill="#F48FB1" />
      <Circle cx={cx} cy={cy} r={1.2} fill="#FFF176" />
    </G>
  );
}

interface CanopyProps {
  stage: number; cx: number; topY: number;
  leafColor: string; health: string; tod: TimeOfDay;
}

function CanopyGroup({ stage, cx, topY, leafColor, health, tod }: CanopyProps) {
  const canopyY = topY - 10;
  const spread = stage >= 6 ? 68 : stage >= 5 ? 58 : stage >= 4 ? 48 : 32;
  const density = stage >= 7 ? 1.0 : stage >= 6 ? 0.9 : stage >= 5 ? 0.8 : stage >= 4 ? 0.6 : 0.4;

  const appleType = stage >= 7 ? 'red' : stage >= 6 ? 'yellow' : 'green';
  const appleCount = stage >= 7 ? 9 : stage >= 6 ? 5 : stage >= 5 ? 2 : 0;
  const applePositions = [
    { x: cx - 28, y: canopyY + 20 }, { x: cx + 22, y: canopyY + 15 },
    { x: cx - 10, y: canopyY + 30 }, { x: cx + 38, y: canopyY + 35 },
    { x: cx - 40, y: canopyY + 40 }, { x: cx + 10, y: canopyY + 50 },
    { x: cx - 22, y: canopyY + 52 }, { x: cx + 32, y: canopyY + 55 },
    { x: cx + 2,  y: canopyY + 18 },
  ];

  const blossomPositions = [
    { x: cx - 32, y: canopyY + 12 }, { x: cx + 28, y: canopyY + 8 },
    { x: cx - 12, y: canopyY + 5 },  { x: cx + 12, y: canopyY + 22 },
    { x: cx + 45, y: canopyY + 28 }, { x: cx - 46, y: canopyY + 30 },
  ];

  const leafPositions = [
    { x: cx, y: canopyY - 5, a: 0, s: 12 },
    { x: cx - 18, y: canopyY + 8, a: -25, s: 11 },
    { x: cx + 18, y: canopyY + 8, a: 25, s: 11 },
    { x: cx - 32, y: canopyY + 22, a: -40, s: 10 },
    { x: cx + 32, y: canopyY + 22, a: 40, s: 10 },
    { x: cx - 14, y: canopyY + 28, a: -15, s: 10 },
    { x: cx + 14, y: canopyY + 28, a: 15, s: 10 },
    { x: cx - 44, y: canopyY + 38, a: -50, s: 9 },
    { x: cx + 44, y: canopyY + 38, a: 50, s: 9 },
    { x: cx, y: canopyY + 40, a: 5, s: 11 },
    { x: cx - 26, y: canopyY + 46, a: -30, s: 9 },
    { x: cx + 26, y: canopyY + 46, a: 30, s: 9 },
    { x: cx - 8, y: canopyY + 18, a: -8, s: 10 },
    { x: cx + 8, y: canopyY + 18, a: 8, s: 10 },
    { x: cx - 50, y: canopyY + 52, a: -55, s: 8 },
  ];

  const visibleLeaves = stage >= 7 ? 15 : stage >= 6 ? 13 : stage >= 5 ? 11 : stage >= 4 ? 9 : stage >= 3 ? 6 : 0;
  const autumnLeafColor = tod === 'evening' || stage === 7 ? '#FF8F00' : leafColor;

  return (
    <G>
      {/* Primary branches */}
      {stage >= 3 && (
        <>
          <Path
            d={`M${cx - 3},${topY + 5} Q${cx - 20},${topY - 15} ${cx - spread * 0.7},${topY - 20}`}
            stroke="#5D4037" strokeWidth={stage >= 6 ? 5 : 4} fill="none" strokeLinecap="round"
          />
          <Path
            d={`M${cx + 3},${topY + 5} Q${cx + 20},${topY - 15} ${cx + spread * 0.65},${topY - 18}`}
            stroke="#5D4037" strokeWidth={stage >= 6 ? 5 : 4} fill="none" strokeLinecap="round"
          />
        </>
      )}
      {/* Secondary branches (stage 5+) */}
      {stage >= 5 && (
        <>
          <Path
            d={`M${cx - spread * 0.5},${topY - 16} Q${cx - spread * 0.8},${topY - 35} ${cx - spread},${topY - 40}`}
            stroke="#5D4037" strokeWidth="3" fill="none" strokeLinecap="round"
          />
          <Path
            d={`M${cx + spread * 0.48},${topY - 14} Q${cx + spread * 0.78},${topY - 32} ${cx + spread},${topY - 38}`}
            stroke="#5D4037" strokeWidth="3" fill="none" strokeLinecap="round"
          />
          <Path
            d={`M${cx - 3},${topY} Q${cx - 5},${topY - 28} ${cx - 8},${topY - 55}`}
            stroke="#5D4037" strokeWidth="2.5" fill="none" strokeLinecap="round"
          />
          <Path
            d={`M${cx + 3},${topY} Q${cx + 8},${topY - 25} ${cx + 12},${topY - 50}`}
            stroke="#5D4037" strokeWidth="2.2" fill="none" strokeLinecap="round"
          />
        </>
      )}

      {/* Leaves — mixed autumn colors for stage 7 */}
      {leafPositions.slice(0, visibleLeaves).map((lp, i) => {
        const isAutumn = stage === 7 && i % 3 === 0;
        const lc = isAutumn ? '#FF8F00' : i % 5 === 0 && stage >= 6 ? '#558B2F' : leafColor;
        return <Leaf key={i} cx={lp.x} cy={lp.y} angle={lp.a} size={lp.s} color={lc} />;
      })}

      {/* Flower buds (stage 4 — just small dots) */}
      {stage === 4 && blossomPositions.slice(0, 3).map((bp, i) => (
        <Circle key={i} cx={bp.x} cy={bp.y} r={2} fill="#F48FB1" opacity={0.7} />
      ))}

      {/* Blossoms (stage 5) */}
      {stage === 5 && blossomPositions.map((bp, i) => (
        <Blossom key={i} cx={bp.x} cy={bp.y} />
      ))}

      {/* Apples (stage 5+) */}
      {applePositions.slice(0, appleCount).map((ap, i) => {
        const size = stage >= 7 ? 9 + (i % 3) * 1.5 : stage >= 6 ? 7 + (i % 2) : 5;
        const type = stage >= 7 ? (i % 4 === 0 ? 'yellow' : 'red') : stage >= 6 ? 'yellow' : 'tiny';
        return <Apple key={i} cx={ap.x} cy={ap.y} size={size} type={type as any} />;
      })}

      {/* Canopy cluster overlay for fullness */}
      {stage >= 5 && (
        <Ellipse
          cx={cx} cy={canopyY + 30}
          rx={spread + 10} ry={48 * density}
          fill={leafColor} opacity={0.06}
        />
      )}
    </G>
  );
}

// ─── Particle ──────────────────────────────────────────────────────────────────
interface Particle {
  x: Animated.Value;
  y: Animated.Value;
  opacity: Animated.Value;
  scale: Animated.Value;
  color: string;
  symbol: string;
}

function useParticles(count: number) {
  return useRef(
    Array.from({ length: count }, () => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0),
      color: '#FFD700',
      symbol: '✦',
    }))
  ).current;
}

// ─── Main LivingAppleTree component ────────────────────────────────────────────
interface Props {
  treeState: AppleTreeState;
  onHabitLogged?: () => void;
}

export function LivingAppleTree({ treeState, onHabitLogged }: Props) {
  const { growthPercent, currentStage, healthState, bestStreak } = treeState;
  const tod = getTimeOfDay(new Date().getHours());

  // ── Animation refs ──
  const breathScale    = useRef(new Animated.Value(1)).current;
  const windRotate     = useRef(new Animated.Value(0)).current;
  const windInterp     = windRotate.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-5deg', '0deg', '5deg'] });
  const floatingTextY  = useRef(new Animated.Value(0)).current;
  const floatingTextOp = useRef(new Animated.Value(0)).current;

  const [floatingStr, setFloatingStr] = useState('+🍎');
  const [sheetVisible, setSheetVisible] = useState(false);

  const particles = useParticles(14);

  // ── Speed multiplier by time of day ──
  const speedMult = tod === 'night' ? 0.4 : tod === 'early_morning' ? 0.8 : tod === 'evening' ? 0.85 : 1.0;

  // ── Continuous breathing ──
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathScale, { toValue: 1.014, duration: 2500 / speedMult, useNativeDriver: true }),
        Animated.timing(breathScale, { toValue: 1.0,   duration: 2500 / speedMult, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [speedMult]);

  // ── Wind gust ──
  useEffect(() => {
    if (currentStage < 3) return;
    const delay = (20000 + Math.random() * 20000) / speedMult;
    const timer = setTimeout(() => {
      Animated.sequence([
        Animated.timing(windRotate, { toValue: 1,  duration: 600,  useNativeDriver: true }),
        Animated.timing(windRotate, { toValue: -1, duration: 1200, useNativeDriver: true }),
        Animated.timing(windRotate, { toValue: 0,  duration: 700,  useNativeDriver: true }),
      ]).start();
    }, delay);
    return () => clearTimeout(timer);
  }, [currentStage, speedMult]);


  // ── Habit logged animation ──
  const triggerHabitAnimation = useCallback(() => {
    // Bounce + shimmer
    Animated.sequence([
      Animated.timing(breathScale, { toValue: 1.06, duration: 200, useNativeDriver: true }),
      Animated.timing(breathScale, { toValue: 0.97, duration: 150, useNativeDriver: true }),
      Animated.timing(breathScale, { toValue: 1.0,  duration: 150, useNativeDriver: true }),
    ]).start();

    // Floating +🍎
    setFloatingStr(bestStreak > 0 && bestStreak % 7 === 0 ? `+🔥 ${bestStreak}d` : '+🍎');
    floatingTextY.setValue(0);
    floatingTextOp.setValue(1);
    Animated.parallel([
      Animated.timing(floatingTextY, { toValue: -55, duration: 1500, useNativeDriver: true }),
      Animated.timing(floatingTextOp, { toValue: 0,  duration: 1500, useNativeDriver: true }),
    ]).start();

    // Particles
    particles.forEach((p, i) => {
      p.symbol = ['✦', '🍎', '🌿', '⭐', '✨'][i % 5];
      const angle = (i / particles.length) * Math.PI * 2;
      const dist = 55 + Math.random() * 30;
      p.x.setValue(0);
      p.y.setValue(0);
      p.opacity.setValue(1);
      p.scale.setValue(0);
      Animated.parallel([
        Animated.timing(p.x,      { toValue: Math.cos(angle) * dist, duration: 900, useNativeDriver: true }),
        Animated.timing(p.y,      { toValue: Math.sin(angle) * dist - 20, duration: 900, useNativeDriver: true }),
        Animated.timing(p.scale,  { toValue: 1.2, duration: 300, useNativeDriver: true }),
        Animated.timing(p.opacity,{ toValue: 0,   duration: 900, useNativeDriver: true }),
      ]).start(() => { p.opacity.setValue(0); });
    });
  }, [bestStreak, particles]);

  useEffect(() => {
    if (onHabitLogged) {
      const timer = setTimeout(triggerHabitAnimation, 50);
      return () => clearTimeout(timer);
    }
  }, [treeState.totalHabitsThisSeason]);

  // ── Critical tremor ──
  useEffect(() => {
    if (healthState !== 'critical') return;
    const tremor = Animated.sequence([
      Animated.timing(windRotate, { toValue: 0.5,  duration: 100, useNativeDriver: true }),
      Animated.timing(windRotate, { toValue: -0.5, duration: 100, useNativeDriver: true }),
      Animated.timing(windRotate, { toValue: 0.3,  duration: 100, useNativeDriver: true }),
      Animated.timing(windRotate, { toValue: 0,    duration: 200, useNativeDriver: true }),
    ]);
    tremor.start();
  }, [healthState]);

  // ── Health badge ──
  const healthBadge = healthState === 'critical'    ? { text: '💧 Needs care', color: '#ef4444' }
                    : healthState === 'wilting'      ? { text: '💧 Wilting',    color: '#f59e0b' }
                    : healthState === 'needs_water'  ? { text: '💛 Needs water', color: '#fbbf24' }
                    : null;

  // ── Progress ring ──
  const nextStageAt = currentStage < 7
    ? [0, 5, 20, 35, 50, 65, 79, 100][currentStage]
    : 100;
  const withinStageStart = [0, 0, 6, 21, 36, 51, 66, 80][currentStage];
  const withinStageEnd   = [5, 5, 20, 35, 50, 65, 79, 100][currentStage];
  const stageRange = withinStageEnd - withinStageStart;
  const stagePct = stageRange > 0
    ? Math.round(((growthPercent - withinStageStart) / stageRange) * 100)
    : 100;

  return (
    <View style={styles.container}>
      {/* ── Header labels ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>🌳 Grow Your Apple Tree</Text>
          <Text style={styles.headerSub}>
            {STAGE_NAMES[currentStage]} · Season {treeState.seasonNumber} · Day {treeState.daysGrowing}/30
          </Text>
        </View>
        <View style={styles.progressPill}>
          <Text style={styles.progressPct}>{growthPercent}%</Text>
          <Text style={styles.progressSub}>grown</Text>
        </View>
      </View>

      {/* ── Tree canvas ── */}
      <TouchableWithoutFeedback onPress={() => setSheetVisible(true)}>
        <View style={styles.treeWrap}>
          <Animated.View style={{ transform: [{ scale: breathScale }, { rotate: windInterp }] }}>
            <TreeSVG
              stage={currentStage}
              health={healthState}
              tod={tod}
            />
          </Animated.View>

          {/* Floating +🍎 */}
          <Animated.View
            style={[styles.floatingText, {
              transform: [{ translateY: floatingTextY }],
              opacity: floatingTextOp,
            }]}
          >
            <Text style={styles.floatingTextStr}>{floatingStr}</Text>
          </Animated.View>

          {/* Particle burst */}
          {particles.map((p, i) => (
            <Animated.Text
              key={i}
              style={[styles.particle, {
                transform: [{ translateX: p.x }, { translateY: p.y }, { scale: p.scale }],
                opacity: p.opacity,
              }]}
            >
              {p.symbol}
            </Animated.Text>
          ))}

          {/* Health badge */}
          {healthBadge && (
            <View style={[styles.healthBadge, { borderColor: healthBadge.color + '60' }]}>
              <Text style={[styles.healthBadgeText, { color: healthBadge.color }]}>
                {healthBadge.text}
              </Text>
            </View>
          )}

          {/* Tap hint */}
          <View style={styles.tapHint}>
            <Text style={styles.tapHintText}>Tap tree to explore ✦</Text>
          </View>
        </View>
      </TouchableWithoutFeedback>

      {/* ── Stage progress bar ── */}
      <View style={styles.stageBar}>
        <View style={styles.stageBarBg}>
          <View style={[styles.stageBarFill, { width: `${stagePct}%` as `${number}%` }]} />
        </View>
        <View style={styles.stageLabels}>
          <Text style={styles.stageLabelLeft}>{STAGE_NAMES[currentStage]}</Text>
          {currentStage < 7 && (
            <Text style={styles.stageLabelRight}>
              Next: {STAGE_NAMES[Math.min(currentStage + 1, 7) as keyof typeof STAGE_NAMES]} at {nextStageAt}%
            </Text>
          )}
        </View>
      </View>

      {/* ── Stats strip ── */}
      <View style={styles.statsStrip}>
        {[
          { icon: '🍎', val: String(treeState.totalHabitsThisSeason), label: 'habits' },
          { icon: '🔥', val: `${bestStreak}d`, label: 'streak' },
          { icon: '📅', val: `${treeState.completionRateThisSeason}%`, label: 'rate' },
          { icon: '🌱', val: `${treeState.daysGrowing}d`, label: 'growing' },
        ].map((s, i) => (
          <View key={i} style={styles.statItem}>
            <Text style={styles.statIcon}>{s.icon}</Text>
            <Text style={styles.statVal}>{s.val}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* ── Stage message ── */}
      <View style={styles.messageWrap}>
        <Text style={styles.messageText}>✦  {STAGE_MESSAGES[currentStage]}</Text>
      </View>

      {/* ── Detail Sheet ── */}
      <TreeDetailSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        treeState={treeState}
        tod={tod}
      />
    </View>
  );
}

// ─── Tree Detail Sheet ────────────────────────────────────────────────────────
function TreeDetailSheet({ visible, onClose, treeState, tod }: {
  visible: boolean; onClose: () => void;
  treeState: AppleTreeState; tod: TimeOfDay;
}) {
  const { growthPercent, currentStage, healthState, bestStreak, totalHabitsThisSeason,
    completionRateThisSeason, daysGrowing, seasonNumber, consecutiveMissedDays } = treeState;

  const healthDisplay = healthState === 'thriving'    ? { text: '💚 Thriving',          color: '#4ade80' }
                      : healthState === 'needs_water' ? { text: '💛 Needs attention',   color: '#fbbf24' }
                      : healthState === 'wilting'     ? { text: '🟠 Wilting — water it', color: '#fb923c' }
                      : { text: '🔴 Critical — needs care', color: '#ef4444' };

  const ringCircumference = 2 * Math.PI * 48;
  const ringProgress = (growthPercent / 100) * ringCircumference;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.sheetHandle} />

          {/* Header */}
          <View style={styles.sheetHeader}>
            <Text style={{ fontSize: 32 }}>🍎</Text>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.sheetTitle}>{STAGE_NAMES[currentStage]}</Text>
              <Text style={styles.sheetSub}>Season {seasonNumber} · Day {daysGrowing} of 30</Text>
            </View>
          </View>

          {/* Progress ring */}
          <View style={styles.ringWrap}>
            <Svg width={120} height={120}>
              <Defs>
                <SvgLinearGradient id="ring_grad" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor="#4ade80" />
                  <Stop offset="1" stopColor="#f59e0b" />
                </SvgLinearGradient>
              </Defs>
              <Circle cx={60} cy={60} r={48} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={10} />
              <Circle cx={60} cy={60} r={48} fill="none" stroke="url(#ring_grad)" strokeWidth={10}
                strokeDasharray={`${ringProgress} ${ringCircumference}`}
                strokeDashoffset={ringCircumference * 0.25}
                strokeLinecap="round" rotation={-90} origin="60,60"
              />
              <Circle cx={60} cy={60} r={38} fill="rgba(0,0,0,0.3)" />
            </Svg>
            <View style={[StyleSheet.absoluteFillObject, { pointerEvents: 'none' }]}>
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={styles.ringPct}>{growthPercent}%</Text>
                <Text style={styles.ringLabel}>growth</Text>
              </View>
            </View>
          </View>

          {/* Next stage */}
          {currentStage < 7 && (
            <Text style={styles.nextStageText}>
              Next: {STAGE_NAMES[(currentStage + 1) as keyof typeof STAGE_NAMES]} at {[0,5,20,35,50,65,79,100][currentStage]}%
            </Text>
          )}

          {/* Stats */}
          <View style={styles.sheetStats}>
            {[
              { icon: '🍎', label: 'Habits this season', val: String(totalHabitsThisSeason) },
              { icon: '📅', label: 'Completion rate', val: `${completionRateThisSeason}%` },
              { icon: '🔥', label: 'Best streak', val: `${bestStreak} days` },
              { icon: '🌱', label: 'Days growing', val: String(daysGrowing) },
            ].map((s, i) => (
              <View key={i} style={styles.sheetStatRow}>
                <Text style={styles.sheetStatIcon}>{s.icon}</Text>
                <Text style={styles.sheetStatLabel}>{s.label}</Text>
                <Text style={styles.sheetStatVal}>{s.val}</Text>
              </View>
            ))}
          </View>

          {/* Health */}
          <View style={[styles.healthRow, { borderColor: healthDisplay.color + '40' }]}>
            <Text style={[styles.healthText, { color: healthDisplay.color }]}>{healthDisplay.text}</Text>
          </View>

          {/* Message */}
          <Text style={styles.sheetMessage}>"{STAGE_MESSAGES[currentStage]}"</Text>

          {/* Close */}
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16, marginBottom: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 24, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 15, fontWeight: '800',
    color: 'rgba(255,255,255,0.92)', letterSpacing: 0.3,
  },
  headerSub: {
    fontSize: 10, color: 'rgba(255,255,255,0.48)',
    marginTop: 2, letterSpacing: 0.3,
  },
  progressPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(76,217,100,0.14)',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(76,217,100,0.30)',
  },
  progressPct: { fontSize: 18, fontWeight: '900', color: '#4CD964' },
  progressSub: { fontSize: 8, color: 'rgba(76,217,100,0.70)', fontWeight: '700', letterSpacing: 0.5 },
  treeWrap: {
    height: CH, width: CW, alignSelf: 'center',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  floatingText: {
    position: 'absolute', top: CH * 0.3, alignSelf: 'center',
  },
  floatingTextStr: { fontSize: 18, fontWeight: '900', color: '#FFD700' },
  particle: {
    position: 'absolute', top: CH * 0.38, left: CW / 2 - 10,
    fontSize: 14,
  },
  healthBadge: {
    position: 'absolute', bottom: 38, alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 99,
    paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1,
  },
  healthBadgeText: { fontSize: 11, fontWeight: '800' },
  tapHint: {
    position: 'absolute', bottom: 10, alignSelf: 'center',
  },
  tapHintText: {
    fontSize: 9, color: 'rgba(255,255,255,0.30)',
    fontStyle: 'italic', letterSpacing: 0.5,
  },
  stageBar: { paddingHorizontal: 16, paddingBottom: 10 },
  stageBarBg: {
    height: 4, backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2, overflow: 'hidden',
  },
  stageBarFill: {
    height: 4,
    backgroundColor: '#4CD964',
    borderRadius: 2,
  },
  stageLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  stageLabelLeft:  { fontSize: 9, color: '#4CD964', fontWeight: '800' },
  stageLabelRight: { fontSize: 9, color: 'rgba(255,255,255,0.38)', fontWeight: '600' },
  statsStrip: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingHorizontal: 12, paddingBottom: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 10,
  },
  statItem: { alignItems: 'center', gap: 2 },
  statIcon: { fontSize: 14 },
  statVal: { fontSize: 14, fontWeight: '900', color: 'rgba(255,255,255,0.88)' },
  statLabel: { fontSize: 8, color: 'rgba(255,255,255,0.40)', fontWeight: '600', letterSpacing: 0.5 },
  messageWrap: {
    paddingHorizontal: 16, paddingBottom: 14,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)',
    paddingTop: 10,
  },
  messageText: {
    fontSize: 11, color: 'rgba(255,255,255,0.55)',
    fontStyle: 'italic', lineHeight: 17, textAlign: 'center',
  },
  sheetOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0e1118', borderTopLeftRadius: 26, borderTopRightRadius: 26,
    paddingHorizontal: 20, paddingBottom: 34, paddingTop: 12,
    borderTopWidth: 1, borderColor: 'rgba(76,217,100,0.20)',
  },
  sheetHandle: {
    width: 38, height: 4, backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 2, alignSelf: 'center', marginBottom: 16,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  sheetTitle: { fontSize: 18, fontWeight: '900', color: '#fff' },
  sheetSub: { fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  ringWrap: {
    alignSelf: 'center', marginBottom: 6, position: 'relative',
    width: 120, height: 120,
  },
  ringPct: { fontSize: 24, fontWeight: '900', color: '#fff' },
  ringLabel: { fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: '700' },
  nextStageText: {
    textAlign: 'center', fontSize: 11,
    color: 'rgba(255,255,255,0.45)', marginBottom: 18,
  },
  sheetStats: { gap: 10, marginBottom: 14 },
  sheetStatRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  sheetStatIcon: { fontSize: 16 },
  sheetStatLabel: { flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.60)', fontWeight: '600' },
  sheetStatVal:   { fontSize: 14, fontWeight: '900', color: '#fff' },
  healthRow: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, marginBottom: 14, alignItems: 'center',
  },
  healthText: { fontSize: 14, fontWeight: '800' },
  sheetMessage: {
    fontSize: 12, color: 'rgba(255,255,255,0.45)',
    fontStyle: 'italic', textAlign: 'center',
    lineHeight: 18, marginBottom: 18,
  },
  closeBtn: {
    backgroundColor: 'rgba(76,217,100,0.14)', borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(76,217,100,0.28)',
  },
  closeBtnText: { fontSize: 14, fontWeight: '800', color: '#4CD964' },
});
