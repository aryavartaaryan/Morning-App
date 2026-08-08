import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated, Easing, TouchableOpacity, Dimensions, Platform, ScrollView
} from 'react-native';
import Svg, { Circle, Rect, Path, G, Defs, RadialGradient, Stop, Line, Text as SvgText } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

const { width: W, height: H } = Dimensions.get('window');

// ── Sensor imports (Optional Live Compass) ──
let Magnetometer: any = null;
try { 
  Magnetometer = require('expo-sensors').Magnetometer;
} catch (_) {}

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

// ── Vastu Zone Data ──
type ZoneId = 'deepwork' | 'wfh' | 'eat' | 'sleep';

const ZONES: Record<ZoneId, {
  id: ZoneId;
  direction: string;
  sanskrit: string;
  title: string;
  tip: string;
  why: string;
  angle: number;
}> = {
  deepwork: {
    id: 'deepwork',
    direction: 'Northeast',
    sanskrit: 'Ishaan',
    title: 'Deep Work & Focus',
    tip: 'Your Northeast corner carries the clearest energy — ideal for focused, deep work.',
    why: 'Considered the most spiritually potent zone; associated with clarity, wisdom, and calm energy.',
    angle: 45,
  },
  wfh: {
    id: 'wfh',
    direction: 'North',
    sanskrit: 'Uttar',
    title: 'Career & WFH',
    tip: 'Face North while working to align with the direction of growth and wealth.',
    why: 'Direction of wealth and career growth (governed by Kubera).',
    angle: 0,
  },
  eat: {
    id: 'eat',
    direction: 'West',
    sanskrit: 'Paschim',
    title: 'Eating & Dining',
    tip: 'Dining in the West supports stability and physical gains.',
    why: 'Supports gains and stability, perfect for the dining area.',
    angle: 270,
  },
  sleep: {
    id: 'sleep',
    direction: 'Southwest',
    sanskrit: 'Nairutya',
    title: 'Sleeping & Relaxing',
    tip: 'Place your bed in the Southwest for deep, grounded rest.',
    why: 'Heaviest, most stable direction — ideal for the master bedroom and deep rest.',
    angle: 225,
  },
};

const SECONDARY_ZONES = [
  { direction: 'E', sanskrit: 'Purva', angle: 90 },
  { direction: 'SE', sanskrit: 'Agneya', angle: 135 },
  { direction: 'S', sanskrit: 'Dakshin', angle: 180 },
  { direction: 'NW', sanskrit: 'Vayavya', angle: 315 },
];

// ── Sacred Geometry Yantra Component ──
const VastuYantraSVG = ({ size, activeZoneData, pulseAnim }: { size: number, activeZoneData: any, pulseAnim: Animated.Value }) => {
  const r = size / 2;
  const center = r;

  // Generates an 8-petaled lotus/star path
  const generateLotus = (outerR: number, innerR: number) => {
    let d = '';
    for (let i = 0; i < 8; i++) {
      const angle = (i * 45 - 90) * (Math.PI / 180);
      const nextAngle = ((i + 1) * 45 - 90) * (Math.PI / 180);
      const midAngle = ((i + 0.5) * 45 - 90) * (Math.PI / 180);

      const x1 = center + innerR * Math.cos(angle);
      const y1 = center + innerR * Math.sin(angle);
      const x2 = center + outerR * Math.cos(midAngle);
      const y2 = center + outerR * Math.sin(midAngle);
      const x3 = center + innerR * Math.cos(nextAngle);
      const y3 = center + innerR * Math.sin(nextAngle);

      if (i === 0) d += `M ${x1} ${y1} `;
      d += `Q ${x2} ${y2} ${x3} ${y3} `;
    }
    return d + 'Z';
  };

  const AnimatedSvgCircle = Animated.createAnimatedComponent(Circle);

  let isFlipped = false;
  if (activeZoneData) {
    const angle = activeZoneData.angle;
    isFlipped = angle > 135 && angle < 315; // Flip text so it remains readable
  }

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <RadialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={COLORS.gold} stopOpacity="0.15" />
            <Stop offset="100%" stopColor={COLORS.gold} stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Ambient Glow */}
        <AnimatedSvgCircle cx={center} cy={center} r={r * 0.9} fill="url(#centerGlow)" opacity={pulseAnim as any} />

        {/* Outer Rings */}
        <Circle cx={center} cy={center} r={r - 2} fill="none" stroke={COLORS.goldMuted} strokeWidth={0.5} />
        <Circle cx={center} cy={center} r={r - 12} fill="none" stroke={COLORS.gold} strokeWidth={1} />
        <Circle cx={center} cy={center} r={r - 16} fill="none" stroke={COLORS.goldMuted} strokeWidth={0.5} />

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
            <Line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={COLORS.goldFaint} strokeWidth={0.5} />
          );
        })}

        {/* Outer Lotus */}
        <Path d={generateLotus(r - 24, r * 0.55)} fill="none" stroke={COLORS.goldMuted} strokeWidth={1} />
        
        {/* Inner Lotus */}
        <Path d={generateLotus(r * 0.55, r * 0.3)} fill="none" stroke={COLORS.gold} strokeWidth={0.8} />

        {/* Brahmasthan (Center Square) */}
        <Rect
          x={center - r * 0.2}
          y={center - r * 0.2}
          width={r * 0.4}
          height={r * 0.4}
          fill="none"
          stroke={COLORS.gold}
          strokeWidth={1}
          transform={`rotate(45 ${center} ${center})`}
        />
        <Circle cx={center} cy={center} r={r * 0.05} fill={COLORS.gold} opacity={0.8} />

        {/* Active Highlight Overlay with Rotated Text */}
        {activeZoneData !== null && (
          <G transform={`rotate(${activeZoneData.angle - 90} ${center} ${center})`}>
            {/* Draw a subtle wedge for the active zone */}
            <Path
              d={`M ${center} ${center} L ${center + r} ${center - r * 0.4} A ${r} ${r} 0 0 1 ${center + r} ${center + r * 0.4} Z`}
              fill={COLORS.saffron}
              opacity={0.15}
            />
            {/* Highlight Line */}
            <Line x1={center} y1={center} x2={center + r - 12} y2={center} stroke={COLORS.saffron} strokeWidth={1.5} />
            <Circle cx={center + r - 12} cy={center} r={4} fill={COLORS.saffron} />
            
            <SvgText
              x={center + r - 24}
              y={center}
              fill={COLORS.saffron}
              fontSize={10}
              fontFamily={FONTS.sans}
              fontWeight="800"
              letterSpacing={1.5}
              textAnchor={isFlipped ? "start" : "end"}
              alignmentBaseline="middle"
              transform={isFlipped ? `rotate(180 ${center + r - 24} ${center})` : undefined}
            >
              {activeZoneData.title.toUpperCase()}
            </SvgText>
          </G>
        )}
      </Svg>
    </View>
  );
};

// ── Main Screen Component ──
export default function VastuYantraScreen() {
  const insets = useSafeAreaInsets();
  const [selectedZone, setSelectedZone] = useState<ZoneId | null>(null);
  const [heading, setHeading] = useState(0); // For live compass
  const [isCompassActive, setIsCompassActive] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Animations
  const pulseAnim = useRef(new Animated.Value(0.5)).current;
  const compassRotAnim = useRef(new Animated.Value(0)).current;

  // Breathing Glow Animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 3000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 3000, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
      ])
    ).start();
  }, []);

  // Compass smoothing with wrap-around correction
  useEffect(() => {
    let target = -heading;
    let prev = compassRotAnim as any;
    let currentVal = prev._value || 0;
    
    // Normalize target to be closest to current value to prevent full-circle spinning
    while (target - currentVal > 180) target -= 360;
    while (target - currentVal < -180) target += 360;

    Animated.spring(compassRotAnim, {
      toValue: target,
      friction: 12,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, [heading]);

  // Live Magnetometer (Phase 2 feature)
  useEffect(() => {
    let sub: any;
    if (Magnetometer && isCompassActive) {
      Magnetometer.setUpdateInterval(100);
      sub = Magnetometer.addListener((data: any) => {
        let angle = Math.atan2(data.y, data.x) * (180 / Math.PI);
        angle = angle >= 0 ? angle : angle + 360;
        angle = Math.round(angle);
        setHeading(angle);
      });
    }
    return () => {
      if (sub) sub.remove();
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
      {/* Background Texture */}
      <View style={[StyleSheet.absoluteFill, styles.bgTexture]} pointerEvents="none" />

      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: Math.max(insets.bottom, 40) }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 40) }]}>
          <Text style={styles.headerTitle}>Vastu Yantra</Text>
          <Text style={styles.headerSubtitle}>Sacred Space Intelligence</Text>
        </View>

        {/* Dropdown Menu */}
        <View style={{ zIndex: 10, marginHorizontal: 32, marginBottom: 20 }}>
          <TouchableOpacity 
            activeOpacity={0.8}
            style={[styles.dropdownButton, dropdownOpen && styles.dropdownButtonActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setDropdownOpen(!dropdownOpen);
            }}
          >
            <Text style={styles.dropdownButtonText}>
              {activeZoneData ? activeZoneData.title.toUpperCase() : 'SELECT VASTU PROTOCOL'}
            </Text>
            <Ionicons name={dropdownOpen ? "chevron-up" : "chevron-down"} size={16} color={COLORS.gold} />
          </TouchableOpacity>
          
          {dropdownOpen && (
            <View style={styles.dropdownList}>
              {Object.values(ZONES).map((z, index) => (
                <TouchableOpacity
                  key={z.id}
                  style={[styles.dropdownItem, index !== Object.values(ZONES).length - 1 && styles.dropdownItemBorder]}
                  onPress={() => handleZoneSelect(z.id)}
                >
                  <Text style={[styles.dropdownItemText, selectedZone === z.id && { color: COLORS.saffron }]}>
                    {z.title.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Yantra Area */}
        <View style={styles.yantraContainer}>
          {/* The rotating compass ring */}
          <Animated.View style={[styles.yantraWrapper, { transform: [{ rotate: compassRotAnim.interpolate({ inputRange: [-36000, 36000], outputRange: ['-36000deg', '36000deg'] }) }] }]}>
            <VastuYantraSVG 
              size={W * 0.85} 
              activeZoneData={activeZoneData} 
              pulseAnim={pulseAnim} 
            />
            
            {/* Secondary Direction Labels placed statically around the ring */}
            {SECONDARY_ZONES.map((sz, i) => {
              const rad = (sz.angle - 90) * (Math.PI / 180);
              const radius = W * 0.425 - 28;
              const x = radius * Math.cos(rad);
              const y = radius * Math.sin(rad);
              return (
                <View key={i} style={[styles.secondaryLabelWrapper, { transform: [{ translateX: x }, { translateY: y }] }]}>
                  <Text style={styles.secondaryLabel}>{sz.direction}</Text>
                </View>
              );
            })}
          </Animated.View>
        </View>

        {/* Inline Info Card (Displays strictly below the Yantra) */}
        {activeZoneData && (
          <View style={styles.infoCard}>
            <TouchableOpacity style={styles.closeButton} onPress={clearSelection}>
              <Ionicons name="close" size={24} color={COLORS.goldMuted} />
            </TouchableOpacity>

            <Text style={styles.sheetSanskrit}>{activeZoneData.sanskrit} Corner</Text>
            <Text style={styles.sheetTitle}>{activeZoneData.direction}</Text>
            
            <View style={styles.sheetDivider} />

            <Text style={styles.sheetTipTitle}>VASTU TIP</Text>
            <Text style={styles.sheetTipText}>{activeZoneData.tip}</Text>

            <Text style={styles.sheetWhyTitle}>WHY IT WORKS</Text>
            <Text style={styles.sheetWhyText}>{activeZoneData.why}</Text>
          </View>
        )}

        {/* Footer Controls */}
        <View style={styles.footer}>
          <TouchableOpacity 
            style={[styles.compassToggle, isCompassActive && styles.compassToggleActive]}
            onPress={() => setIsCompassActive(!isCompassActive)}
          >
            <Text style={[styles.compassToggleText, isCompassActive && { color: COLORS.bg }]}>
              {isCompassActive ? 'LIVE ALIGNMENT ON' : 'ENABLE LIVE COMPASS'}
            </Text>
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
  bgTexture: {
    opacity: 0.1,
    backgroundColor: 'transparent',
    borderStyle: 'dotted',
    borderWidth: 2,
    borderColor: COLORS.gold,
    borderRadius: 1,
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
    backgroundColor: 'rgba(20,20,30,0.8)',
    borderWidth: 1,
    borderColor: COLORS.goldMuted,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
  },
  dropdownButtonActive: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderColor: COLORS.gold,
  },
  dropdownButtonText: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.gold,
    letterSpacing: 1.5,
  },
  dropdownList: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: 'rgba(20,20,30,0.95)',
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderTopWidth: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  dropdownItem: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  dropdownItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surface,
  },
  dropdownItemText: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.ivory,
    letterSpacing: 1,
  },

  yantraContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
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
  
  // Inline Info Card Styles
  infoCard: {
    marginHorizontal: 20,
    marginTop: 10,
    padding: 24,
    backgroundColor: 'rgba(20, 20, 30, 0.6)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.goldFaint,
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
    backgroundColor: COLORS.goldFaint,
    width: '100%',
    marginBottom: 24,
  },
  sheetTipTitle: {
    fontFamily: FONTS.sans,
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.gold,
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
    color: COLORS.goldMuted,
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
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.gold,
    marginBottom: 16,
  },
  compassToggleActive: {
    backgroundColor: COLORS.gold,
  },
  compassToggleText: {
    fontFamily: FONTS.sans,
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.gold,
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
