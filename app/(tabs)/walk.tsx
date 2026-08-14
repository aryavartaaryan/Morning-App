import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated, Easing, TouchableOpacity, Dimensions, Platform, ScrollView, Image
} from 'react-native';
import Svg, { Circle, Rect, Path, G, Defs, RadialGradient, LinearGradient as SvgLinearGradient, Stop, Line, Text as SvgText } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Gyroscope } from 'expo-sensors';

const { width: W, height: H } = Dimensions.get('window');

import * as Location from 'expo-location';

// ── Design Tokens ──
const COLORS = {
  bg: '#0B0B14',
  gold: '#C9A24B',
  goldMuted: 'rgba(201,162,75,0.4)',
  goldFaint: 'rgba(201,162,75,0.15)',
  saffron: '#C1652F',
  ivory: '#EDE6D6',
  surface: 'rgba(255,255,255,0.04)',
};

const FONTS = {
  serif: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  sans: Platform.OS === 'ios' ? 'System' : 'sans-serif',
};

// ── Spatial Zone Data ──
type ZoneId = 'meditate' | 'deepwork' | 'wfh' | 'eat' | 'sleep';

const ZONES: Record<ZoneId, {
  id: ZoneId;
  title: string;
  tip: string;
  why: string;
  zones: { direction: string; sanskrit: string; angle: number }[];
}> = {
  meditate: {
    id: 'meditate',
    title: 'Meditation & Mindfulness',
    tip: 'Face Northeast or East during meditation for maximum nervous system coherence.',
    why: 'These channels carry the most spiritually potent, clear energy, perfect for inner stillness.',
    zones: [
      { direction: 'Northeast', sanskrit: 'Ishaan', angle: 45 },
      { direction: 'East', sanskrit: 'Purva', angle: 90 },
      { direction: 'North', sanskrit: 'Uttar', angle: 0 },
    ]
  },
  deepwork: {
    id: 'deepwork',
    title: 'Deep Work & Focus',
    tip: 'Your Northeast or East corner carries the clearest energy — ideal for focused, deep work.',
    why: 'Considered the most spiritually potent axis; associated with clarity, wisdom, and calm energy.',
    zones: [
      { direction: 'Northeast', sanskrit: 'Ishaan', angle: 45 },
      { direction: 'East', sanskrit: 'Purva', angle: 90 },
      { direction: 'North', sanskrit: 'Uttar', angle: 0 },
    ]
  },
  wfh: {
    id: 'wfh',
    title: 'Career & WFH',
    tip: 'Face North or East while working to align with the direction of growth and wealth.',
    why: 'Direction of wealth and career growth (governed by Kubera).',
    zones: [
      { direction: 'North', sanskrit: 'Uttar', angle: 0 },
      { direction: 'East', sanskrit: 'Purva', angle: 90 },
    ]
  },
  eat: {
    id: 'eat',
    title: 'Eating & Dining',
    tip: 'Dining in the West or East supports stability and physical gains.',
    why: 'Supports gains and stability, perfect for the dining area.',
    zones: [
      { direction: 'West', sanskrit: 'Paschim', angle: 270 },
      { direction: 'East', sanskrit: 'Purva', angle: 90 },
      { direction: 'North', sanskrit: 'Uttar', angle: 0 },
    ]
  },
  sleep: {
    id: 'sleep',
    title: 'Sleeping & Relaxing',
    tip: 'Place your bed in the Southwest or South for deep, grounded rest.',
    why: 'Heaviest, most stable direction — ideal for the master bedroom and deep rest.',
    zones: [
      { direction: 'Southwest', sanskrit: 'Nairutya', angle: 225 },
      { direction: 'South', sanskrit: 'Dakshin', angle: 180 },
      { direction: 'East', sanskrit: 'Purva', angle: 90 },
    ]
  },
};

const SECONDARY_ZONES = [
  { direction: 'E', sanskrit: 'Purva', angle: 90 },
  { direction: 'SE', sanskrit: 'Agneya', angle: 135 },
  { direction: 'S', sanskrit: 'Dakshin', angle: 180 },
  { direction: 'NW', sanskrit: 'Vayavya', angle: 315 },
];

// ── Sacred Geometry Yantra Component ──
const HarmonyCompassSVG = ({ size, activeZoneData, pulseAnim, compassRotAnim, compassInnerRotAnim, breathingScaleAnim }: any) => {
  const r = size / 2;
  const center = r;

  // Generates a sleek sacred geometry (Metatron's cube-inspired or sleek 12-point star)
  const generateSleekStar = (outerR: number, innerR: number) => {
    let d = '';
    for (let i = 0; i < 12; i++) {
      const angle = (i * 30 - 90) * (Math.PI / 180);
      const nextAngle = ((i + 1) * 30 - 90) * (Math.PI / 180);
      const midAngle = ((i + 0.5) * 30 - 90) * (Math.PI / 180);

      const x1 = center + innerR * Math.cos(angle);
      const y1 = center + innerR * Math.sin(angle);
      const x2 = center + outerR * Math.cos(midAngle);
      const y2 = center + outerR * Math.sin(midAngle);
      const x3 = center + innerR * Math.cos(nextAngle);
      const y3 = center + innerR * Math.sin(nextAngle);

      if (i === 0) d += `M ${x1} ${y1} `;
      d += `L ${x2} ${y2} L ${x3} ${y3} `; // Sharp lines instead of curves for premium look
    }
    return d + 'Z';
  };

  const AnimatedSvgCircle = Animated.createAnimatedComponent(Circle);
  const rotInterpolate = compassRotAnim.interpolate({ inputRange: [-36000, 36000], outputRange: ['-36000deg', '36000deg'] });
  const innerRotInterpolate = compassInnerRotAnim.interpolate({ inputRange: [-36000, 36000], outputRange: ['-36000deg', '36000deg'] });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      
      {/* ── Outer Layer (Bioluminescent Void Base, Instant Rotation) ── */}
      <Animated.View style={{ position: 'absolute', width: size, height: size, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: rotInterpolate }] }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Defs>
            <RadialGradient id="voidGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#000000" stopOpacity="1" />
              <Stop offset="80%" stopColor="#000000" stopOpacity="0.8" />
              <Stop offset="100%" stopColor={COLORS.bg} stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="centerPulse" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={COLORS.saffron} stopOpacity="0.15" />
              <Stop offset="100%" stopColor={COLORS.saffron} stopOpacity="0" />
            </RadialGradient>
          </Defs>

          {/* Absolute Black Void */}
          <Circle cx={center} cy={center} r={r * 0.95} fill="url(#voidGlow)" />

          {/* Bioluminescent Breathing Aura */}
          <AnimatedSvgCircle cx={center} cy={center} r={r * 0.9} fill="url(#centerPulse)" opacity={pulseAnim as any} />

          {/* Outer Rings (Glowing Energy) */}
          <Circle cx={center} cy={center} r={r - 2} fill="none" stroke={COLORS.ivory} strokeWidth={0.5} opacity={0.15} />
          
          <Circle cx={center} cy={center} r={r - 12} fill="none" stroke={COLORS.saffron} strokeWidth={4} opacity={0.3} /> {/* Aura */}
          <Circle cx={center} cy={center} r={r - 12} fill="none" stroke={COLORS.ivory} strokeWidth={1} opacity={0.8} /> {/* Core */}
          
          <Circle cx={center} cy={center} r={r - 16} fill="none" stroke={COLORS.ivory} strokeWidth={0.5} opacity={0.2} />

          {/* 16-point geometric division lines */}
          {[...Array(16)].map((_, i) => {
            const angle = (i * 22.5) * (Math.PI / 180);
            const x1 = center + (r - 16) * Math.cos(angle);
            const y1 = center + (r - 16) * Math.sin(angle);
            const isMain = i % 2 === 0;
            const innerRadius = isMain ? r * 0.4 : r * 0.6;
            const x2 = center + innerRadius * Math.cos(angle);
            const y2 = center + innerRadius * Math.sin(angle);
            return (
              <G key={i}>
                <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={COLORS.saffron} strokeWidth={3} opacity={0.2} />
                <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={COLORS.ivory} strokeWidth={0.5} opacity={0.6} />
              </G>
            );
          })}

          {/* Outer Lotus */}
          <Path d={generateSleekStar(r - 20, r * 0.65)} fill="none" stroke={COLORS.saffron} strokeWidth={4} opacity={0.15} />
          <Path d={generateSleekStar(r - 20, r * 0.65)} fill="none" stroke={COLORS.ivory} strokeWidth={1} opacity={0.5} />
        </Svg>
        
        {/* Secondary Direction Labels (Glowing Celestial Coordinates) */}
        {SECONDARY_ZONES.map((sz, i) => {
          const rad = (sz.angle - 90) * (Math.PI / 180);
          const radius = r * 0.85 - 28;
          const x = radius * Math.cos(rad);
          const y = radius * Math.sin(rad);
          return (
            <View key={i} style={[styles.secondaryLabelWrapper, { transform: [{ translateX: x }, { translateY: y }] }]}>
              <Text style={[styles.secondaryLabel, { 
                color: COLORS.ivory, 
                textShadowColor: COLORS.saffron,
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: 8,
                opacity: 0.9
              }]}>{sz.direction}</Text>
            </View>
          );
        })}
      </Animated.View>

      {/* ── Inner Parallax Layer (Bright Bioluminescence, Breathing, Delayed Rotation) ── */}
      <Animated.View style={{ position: 'absolute', width: size, height: size, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: innerRotInterpolate }, { scale: breathingScaleAnim }] }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Inner Lotus */}
          <Path d={generateSleekStar(r * 0.55, r * 0.3)} fill="none" stroke={COLORS.saffron} strokeWidth={6} opacity={0.25} />
          <Path d={generateSleekStar(r * 0.55, r * 0.3)} fill="none" stroke={COLORS.ivory} strokeWidth={1.5} opacity={0.9} />

          {/* Brahmasthan (Center Square) */}
          <Rect
            x={center - r * 0.2}
            y={center - r * 0.2}
            width={r * 0.4}
            height={r * 0.4}
            fill="none"
            stroke={COLORS.saffron}
            strokeWidth={6}
            opacity={0.3}
            transform={`rotate(45 ${center} ${center})`}
          />
          <Rect
            x={center - r * 0.2}
            y={center - r * 0.2}
            width={r * 0.4}
            height={r * 0.4}
            fill="none"
            stroke={COLORS.ivory}
            strokeWidth={1.5}
            transform={`rotate(45 ${center} ${center})`}
          />
          <Circle cx={center} cy={center} r={r * 0.05} fill={COLORS.saffron} opacity={0.8} />
          <Circle cx={center} cy={center} r={r * 0.02} fill="#FFF" />
        </Svg>
      </Animated.View>

      {/* ── Active Highlight Overlay (Ember, Breathing, Instant Rotation) ── */}
      {activeZoneData !== null && (
        <Animated.View style={{ position: 'absolute', width: size, height: size, transform: [{ rotate: rotInterpolate }, { scale: breathingScaleAnim }] }}>
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {activeZoneData.zones.map((zone: any, index: number) => {
              const angle = zone.angle;
              const isFlipped = angle > 135 && angle < 315;
              return (
                <G key={index} transform={`rotate(${angle - 90} ${center} ${center})`}>
                  <Defs>
                    <RadialGradient id={`wedgeGlow-${index}`} cx="50%" cy="50%" r="50%">
                      <Stop offset="0%" stopColor={COLORS.saffron} stopOpacity="0.8" />
                      <Stop offset="100%" stopColor={COLORS.saffron} stopOpacity="0" />
                    </RadialGradient>
                  </Defs>
                  <Path
                    d={`M ${center} ${center} L ${center + r} ${center - r * 0.4} A ${r} ${r} 0 0 1 ${center + r} ${center + r * 0.4} Z`}
                    fill={`url(#wedgeGlow-${index})`}
                  />
                  <Line x1={center} y1={center} x2={center + r - 8} y2={center} stroke={COLORS.saffron} strokeWidth={6} opacity={0.5} />
                  <Line x1={center} y1={center} x2={center + r - 8} y2={center} stroke="#FFF" strokeWidth={2} />
                  
                  <Circle cx={center + r - 8} cy={center} r={4.5} fill="#FFF" />
                  <Circle cx={center + r - 8} cy={center} r={8} fill="none" stroke={COLORS.saffron} strokeWidth={2} opacity={1} />
                  
                  <SvgText
                    x={center + r - 26}
                    y={center}
                    fill="#FFF"
                    fontSize={11}
                    fontFamily={FONTS.sans}
                    fontWeight="900"
                    letterSpacing={2}
                    textAnchor={isFlipped ? "start" : "end"}
                    alignmentBaseline="middle"
                    transform={isFlipped ? `rotate(180 ${center + r - 26} ${center})` : undefined}
                  >
                    {zone.direction.toUpperCase()}
                  </SvgText>
                </G>
              );
            })}
          </Svg>
        </Animated.View>
      )}
    </View>
  );
};

// ── Main Screen Component ──
export default function HarmonyCompassScreen() {
  const insets = useSafeAreaInsets();
  const [selectedZone, setSelectedZone] = useState<ZoneId | null>(null);
  const [heading, setHeading] = useState(0); // For live compass
  const [isCompassActive, setIsCompassActive] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Animations
  const pulseAnim = useRef(new Animated.Value(0.1)).current;
  const compassRotAnim = useRef(new Animated.Value(0)).current;
  const compassInnerRotAnim = useRef(new Animated.Value(0)).current;
  const breathingScaleAnim = useRef(new Animated.Value(1)).current;
  const lastHapticZone = useRef(-1);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Stardust Parallax
  const gyroX = useRef(new Animated.Value(0)).current;
  const gyroY = useRef(new Animated.Value(0)).current;

  // Gyroscope Setup
  useEffect(() => {
    Gyroscope.setUpdateInterval(50);
    const subscription = Gyroscope.addListener((data) => {
      Animated.spring(gyroX, { toValue: -data.y * 15, friction: 7, tension: 40, useNativeDriver: true }).start();
      Animated.spring(gyroY, { toValue: -data.x * 15, friction: 7, tension: 40, useNativeDriver: true }).start();
    });
    return () => {
      subscription.remove();
    };
  }, []);

  // 4-7-8 Breathing Rhythm (Inhale 4s, Hold 7s, Exhale 8s)
  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 4000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 7000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0.1, duration: 8000, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
        ]),
        Animated.sequence([
          Animated.timing(breathingScaleAnim, { toValue: 1.05, duration: 4000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(breathingScaleAnim, { toValue: 1.05, duration: 7000, useNativeDriver: true }),
          Animated.timing(breathingScaleAnim, { toValue: 1, duration: 8000, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
        ])
      ])
    ).start();
  }, []);

  // Compass smoothing with parallax lag and Haptic Ticking
  useEffect(() => {
    if (!isCompassActive) return;

    // Fire Haptic Tick on 16 cardinal/sub-cardinal divisions (every 22.5 degrees)
    const currentZone = Math.round(heading / 22.5);
    if (currentZone !== lastHapticZone.current) {
      if (lastHapticZone.current !== -1) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      lastHapticZone.current = currentZone;
    }

    let target = -heading;
    let prev = compassRotAnim as any;
    let currentVal = prev._value || 0;
    
    // Normalize target to be closest to current value to prevent full-circle spinning
    while (target - currentVal > 180) target -= 360;
    while (target - currentVal < -180) target += 360;

    // Instant/smooth rotation for Outer Layer
    Animated.spring(compassRotAnim, {
      toValue: target,
      friction: 12,
      tension: 40,
      useNativeDriver: true,
    }).start();

    // Slower, delayed rotation for Inner Layer (Parallax Physics)
    Animated.spring(compassInnerRotAnim, {
      toValue: target,
      friction: 18,
      tension: 10,
      useNativeDriver: true,
    }).start();
  }, [heading, isCompassActive]);

  // Calming Idle Rotation (When Compass is Off)
  useEffect(() => {
    let active = true;
    const startIdle = () => {
      if (!active) return;
      let currentOuter = (compassRotAnim as any)._value || 0;
      let currentInner = (compassInnerRotAnim as any)._value || 0;
      
      Animated.parallel([
        Animated.timing(compassRotAnim, {
          toValue: currentOuter + 360,
          duration: 120000, // 2 minutes per rotation (Deeply calming)
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(compassInnerRotAnim, {
          toValue: currentInner - 360, // Reverse parallax flow
          duration: 180000, // 3 minutes per rotation
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ]).start(({ finished }) => {
        if (finished && active) startIdle();
      });
    };

    if (!isCompassActive) {
      startIdle();
    }
    
    return () => {
      active = false;
      compassRotAnim.stopAnimation();
      compassInnerRotAnim.stopAnimation();
    };
  }, [isCompassActive]);

  // Fluid Info Card Entry Animation
  useEffect(() => {
    if (selectedZone) {
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic)
      }).start();
    }
  }, [selectedZone]);

  // Live Compass (Phase 2 feature) - Using OS Sensor Fusion for True Heading
  useEffect(() => {
    let sub: any;
    if (isCompassActive) {
      (async () => {
        // Request permissions first
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.warn('Location permission to use the true compass was denied');
          return;
        }

        // Use watchHeadingAsync for OS-calibrated sensor fusion (True North)
        sub = await Location.watchHeadingAsync((data) => {
          let h = data.trueHeading !== -1 ? data.trueHeading : data.magHeading;
          if (h >= 0) {
            setHeading(Math.round(h));
          }
        });
      })();
    }
    return () => {
      if (sub && sub.remove) sub.remove();
    };
  }, [isCompassActive]);

  const handleZoneSelect = (zoneId: ZoneId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedZone(zoneId);
    setDropdownOpen(false);
  };

  const clearSelection = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedZone(null);
  };

  const activeZoneData = selectedZone ? ZONES[selectedZone] : null;

  return (
    <View style={styles.container}>

      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: Math.max(insets.bottom, 40) }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 40) }]}>
          <Text style={styles.headerTitle}>Harmony Compass</Text>
          <Text style={styles.headerSubtitle}>Sacred Space Intelligence</Text>
        </View>

        {/* Dropdown Menu */}
        <View style={{ zIndex: 10, marginHorizontal: 32, marginBottom: 20 }}>
          <TouchableOpacity 
            activeOpacity={0.8}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setDropdownOpen(!dropdownOpen);
            }}
          >
            <LinearGradient 
              colors={['#101018', '#0B0B14']} 
              style={[styles.dropdownButton, dropdownOpen && styles.dropdownButtonActive]}
            >
              <Text style={styles.dropdownButtonText}>
                {activeZoneData ? activeZoneData.title.toUpperCase() : 'SELECT SPATIAL PROTOCOL'}
              </Text>
              <Ionicons name={dropdownOpen ? "chevron-up" : "chevron-down"} size={16} color={COLORS.saffron} />
            </LinearGradient>
          </TouchableOpacity>
          
          {dropdownOpen && (
            <View style={styles.dropdownList}>
              {Object.values(ZONES).map((z, index) => (
                <TouchableOpacity
                  key={z.id}
                  style={[styles.dropdownItem, index !== Object.values(ZONES).length - 1 && styles.dropdownItemBorder]}
                  onPress={() => handleZoneSelect(z.id)}
                >
                  <Text style={[styles.dropdownItemText, selectedZone === z.id && { color: COLORS.saffron }]} >
                    {z.title.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={styles.yantraContainer}>
          {/* Gyroscope Stardust Particles */}
          <Animated.View pointerEvents="none" style={{
            position: 'absolute', top: -30, left: -30, right: -30, bottom: -30,
            transform: [{ translateX: gyroX }, { translateY: gyroY }],
            alignItems: 'center', justifyContent: 'center'
          }}>
            <Svg width={W} height={W}>
              {Array.from({ length: 24 }).map((_, i) => {
                const angle = (i * Math.PI * 2) / 24 + (i % 2 === 0 ? 0.2 : -0.2);
                const radius = (W * 0.3) + (i % 3) * 20;
                const x = W / 2 + Math.cos(angle) * radius;
                const y = W / 2 + Math.sin(angle) * radius;
                return (
                  <Circle key={`star_${i}`} cx={x} cy={y} r={1 + (i % 2) * 1.5} fill="#FFFFFF" opacity={0.1 + (i % 4) * 0.15} />
                );
              })}
            </Svg>
          </Animated.View>

          <HarmonyCompassSVG 
            size={W * 0.85} 
            activeZoneData={activeZoneData} 
            pulseAnim={pulseAnim} 
            compassRotAnim={compassRotAnim}
            compassInnerRotAnim={compassInnerRotAnim}
            breathingScaleAnim={breathingScaleAnim}
          />
        </View>

        {/* Inline Info Card (Displays strictly below the Yantra) */}
        {activeZoneData && (
          <Animated.View style={{ 
            opacity: fadeAnim, 
            transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }] 
          }}>
            <LinearGradient colors={['#101018', '#0B0B14']} style={styles.infoCard}>
              <TouchableOpacity style={styles.closeButton} onPress={clearSelection}>
                <Ionicons name="close" size={24} color={'#3A3A4A'} />
              </TouchableOpacity>

              <Text style={styles.sheetSanskrit}>
                {activeZoneData.zones.map((z: any) => z.sanskrit).join(' / ')}
              </Text>
              <Text style={styles.sheetTitle}>
                {activeZoneData.zones.map((z: any) => z.direction).join(' / ')}
              </Text>
              
              <View style={styles.sheetDivider} />

              <Text style={styles.sheetTipTitle}>HARMONY TIP</Text>
              <Text style={styles.sheetTipText}>{activeZoneData.tip}</Text>

              <Text style={styles.sheetWhyTitle}>WHY IT WORKS</Text>
              <Text style={styles.sheetWhyText}>{activeZoneData.why}</Text>
            </LinearGradient>
          </Animated.View>
        )}

        {/* Footer Controls */}
        <View style={styles.footer}>
          <TouchableOpacity 
            style={[styles.compassToggle, isCompassActive && styles.compassToggleActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              setIsCompassActive(!isCompassActive);
            }}
          >
            <LinearGradient 
              colors={isCompassActive ? ['#1A150A', '#0B0B14'] : ['#101018', '#0B0B14']} 
              style={styles.compassToggleInner}
            >
              <Text style={[styles.compassToggleText, isCompassActive && { color: COLORS.saffron }]}>
                {isCompassActive ? 'LIVE ALIGNMENT ON' : 'ENABLE LIVE COMPASS'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
          <Text style={styles.footerNote}>
            Align your physical space with natural energetic currents.
          </Text>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontFamily: FONTS.serif,
    fontSize: 28,
    color: COLORS.ivory,
    letterSpacing: 1,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontFamily: FONTS.sans,
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.gold,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  
  // Dropdown Styles
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#1F1F2E',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
  },
  dropdownButtonActive: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderColor: '#2A2A35',
  },
  dropdownButtonText: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(237,230,214,0.7)',
    letterSpacing: 2,
  },
  dropdownList: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#0B0B14',
    borderWidth: 1,
    borderColor: '#1F1F2E',
    borderTopWidth: 0,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  dropdownItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#101018',
  },
  dropdownItemText: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(237,230,214,0.5)',
    letterSpacing: 1,
  },

  yantraContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 40,
  },
  yantraWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabelWrapper: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {
    fontFamily: FONTS.sans,
    fontSize: 9,
    color: COLORS.goldMuted,
    fontWeight: '700',
    letterSpacing: 1,
  },
  
  infoCard: {
    marginHorizontal: 20,
    marginTop: 10,
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1F1F2E',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.8,
    shadowRadius: 24,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8,
    zIndex: 10,
  },
  sheetSanskrit: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.saffron,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  sheetTitle: {
    fontFamily: FONTS.serif,
    fontSize: 32,
    color: COLORS.ivory,
    marginBottom: 20,
  },
  sheetDivider: {
    height: 1,
    backgroundColor: '#1F1F2E',
    width: '100%',
    marginBottom: 24,
  },
  sheetTipTitle: {
    fontFamily: FONTS.sans,
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(237,230,214,0.4)',
    letterSpacing: 2,
    marginBottom: 8,
  },
  sheetTipText: {
    fontFamily: FONTS.serif,
    fontSize: 16,
    color: COLORS.ivory,
    lineHeight: 24,
    marginBottom: 24,
  },
  sheetWhyTitle: {
    fontFamily: FONTS.sans,
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(237,230,214,0.3)',
    letterSpacing: 2,
    marginBottom: 8,
  },
  sheetWhyText: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: 'rgba(237,230,214,0.7)',
    lineHeight: 20,
  },

  footer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 32,
  },
  compassToggle: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1F1F2E',
    marginBottom: 16,
    overflow: 'hidden',
  },
  compassToggleInner: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  compassToggleActive: {
    borderColor: COLORS.saffron,
    shadowColor: COLORS.saffron,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  compassToggleText: {
    fontFamily: FONTS.sans,
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(237,230,214,0.5)',
    letterSpacing: 2,
  },
  footerNote: {
    fontFamily: FONTS.serif,
    fontSize: 12,
    color: 'rgba(237,230,214,0.5)',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
