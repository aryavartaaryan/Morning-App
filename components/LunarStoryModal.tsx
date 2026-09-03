import React from 'react';
import {
  View, Text, Modal, TouchableOpacity,
  StyleSheet, Dimensions, ScrollView,
  StatusBar, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle as SvgCircle, Path as SvgPath } from 'react-native-svg';
import { getPanchangData } from '@/lib/cosmicData';

const { width: W, height: H } = Dimensions.get('window');

export function MoonSVG({ tithiNum, size = 40 }: { tithiNum: number; size?: number }) {
  const r = size / 2;
  const isWaxing  = tithiNum <= 15;
  const isPurnima = tithiNum === 15;
  const isAmavasya = tithiNum === 0 || tithiNum === 30;
  const rawIllum  = isPurnima ? 1 : isAmavasya ? 0
    : isWaxing ? tithiNum / 15
    : 1 - (tithiNum - 15) / 15;

  const moonFill = '#fef3c7';
  const darkFill = '#0c0c1a';

  if (rawIllum < 0.02) {
    return (
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <SvgCircle cx={r} cy={r} r={r - 0.5} fill={darkFill} stroke="#2d2d4e" strokeWidth={0.8} />
      </Svg>
    );
  }
  if (rawIllum > 0.98) {
    return (
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <SvgCircle cx={r} cy={r} r={r - 0.5} fill={moonFill} />
      </Svg>
    );
  }

  const rx = Math.max(0.5, r * Math.abs(Math.cos(Math.PI * rawIllum)));
  const outerSweep      = isWaxing ? 1 : 0;
  const terminatorSweep = (isWaxing === (rawIllum >= 0.5)) ? 1 : 0;
  const c = r;
  const s = size;
  const pathD = `M ${c} 0 A ${r} ${r} 0 1 ${outerSweep} ${c} ${s} A ${rx} ${r} 0 0 ${terminatorSweep} ${c} 0 Z`;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <SvgCircle cx={r} cy={r} r={r - 0.5} fill={darkFill} />
      <SvgPath d={pathD} fill={moonFill} />
    </Svg>
  );
}


const LUNAR_SCIENCE: Record<string, { headline: string; tagline: string; what: string; why: string; protocols: string[] }> = {
  waxing: {
    headline: 'Anabolic Expansion Phase',
    tagline: 'Building Energy · Fluid Retention · Structural Growth',
    what: 'As lunar illumination increases, gravitational pull on Earth’s water shifts. Scientifically, human bodies (which are ~60% water) experience subtle shifts in fluid dynamics. Ayurveda identifies this as the Kapha (building) phase.',
    why: 'During the Waxing phase, your body absorbs nutrients more efficiently. Synovial fluid viscosity increases, making this the optimal window for strength training, hyper-hydration, and absorbing fat-soluble vitamins.',
    protocols: ['Prioritize strength training and hypertrophy', 'Consume nutrient-dense, easily absorbable meals', 'Expect slightly higher water retention and weight'],
  },
  waning: {
    headline: 'Catabolic Release Phase',
    tagline: 'Cellular Detoxification · Fluid Release · Pruning',
    what: 'As the moon wanes toward darkness, gravitational tension decreases. This mirrors a catabolic (breakdown) state in human biology. Ayurveda identifies this as the Pitta/Vata phase of elimination and cleansing.',
    why: 'Your lymphatic system clears metabolic waste more effectively during this phase. It is the biological window for detoxing, fasting, shedding water weight, and engaging in high-intensity cardiovascular pruning.',
    protocols: ['Prioritize cardio, sweating, and lymphatic drainage', 'Great window for intermittent fasting', 'Focus on releasing habits, clutter, and mental loops'],
  },
  full: {
    headline: 'Peak Neurological Illumination',
    tagline: 'High Parasympathetic Tension · Vivid Dreams · Social Energy',
    what: 'At 100% illumination, human neurochemistry responds to the highest nighttime lux levels. Historically, this suppressed melatonin and increased nighttime alertness (the "Lunar Effect").',
    why: 'You may experience heightened mental friction, intense dreams, or restless energy. This is a time of peak expression, maximum extroversion, but also requires conscious nervous system grounding to ensure deep sleep.',
    protocols: ['Implement strict sleep hygiene and blackout curtains', 'Channel excess energy into creative or social outputs', 'Avoid high-caffeine intake after 1 PM'],
  },
  new: {
    headline: 'Deep Neural Reset',
    tagline: 'Maximum Melatonin Synthesis · Introversion · Baseline',
    what: 'At 0% illumination, the absence of nighttime light signals the pineal gland for maximum melatonin production. This is the physiological "winter" of the month.',
    why: 'Your nervous system craves darkness, introversion, and deep rest. It is the biological baseline. Autophagy (cellular cleanup) is highly efficient here. Start new protocols now as the body rebuilds from ground zero.',
    protocols: ['Prioritize 8+ hours of deep, uninterrupted sleep', 'Set new intentions and biological protocols', 'Lean into meditation, journaling, and introversion'],
  },
};

export function LunarStoryModal({ visible, onClose, hMoon }: { visible: boolean, onClose: () => void, hMoon: any }) {
  const hP = getPanchangData();
  const dayNum = hP.tithiInPaksha;
  const isWaxing = hP.paksha === 'Shukla';
  let phaseKey = isWaxing ? 'waxing' : 'waning';
  if (dayNum === 15) {
    phaseKey = isWaxing ? 'full' : 'new';
  }
  
  const content = LUNAR_SCIENCE[phaseKey];
  let phaseText = '';
  if (dayNum === 15) phaseText = isWaxing ? 'Full Moon' : 'New Moon';
  else if (dayNum >= 1 && dayNum <= 6) phaseText = isWaxing ? 'Waxing Crescent' : 'Waning Gibbous';
  else if (dayNum >= 7 && dayNum <= 8) phaseText = isWaxing ? 'First Quarter' : 'Third Quarter';
  else phaseText = isWaxing ? 'Waxing Gibbous' : 'Waning Crescent';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={S.container}>
        <StatusBar hidden />
        <LinearGradient colors={['#0f172a', '#020617']} style={StyleSheet.absoluteFillObject} />
        
        <SafeAreaView style={{ flex: 1 }}>
          <View style={S.topBar}>
            <View style={{ width: 36 }} />
            <View style={S.centerPill}>
              <MoonSVG tithiNum={hMoon.tithiNum} size={14} />
              <Text style={S.pillText}>{phaseText.toUpperCase()}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={S.closeCircleBtn}>
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={S.scrollContent}>
            <View style={{ alignItems: 'center', marginBottom: 32, marginTop: 10 }}>
              <View style={S.moonGlow}>
                <MoonSVG tithiNum={hMoon.tithiNum} size={140} />
              </View>
              <Text style={S.heroHeadline}>{content.headline}</Text>
              <Text style={S.heroTagline}>{content.tagline}</Text>
              
              <View style={S.lunarDayPill}>
                <Text style={S.lunarDayText}>LUNAR DAY {dayNum}</Text>
              </View>
            </View>

            <View style={S.card}>
              <Text style={S.cardEyebrow}>THE SCIENCE</Text>
              <Text style={S.bodyParagraph}>{content.what}</Text>
              
              <View style={S.whyMattersBox}>
                <Text style={S.boxEyebrow}>PHYSIOLOGICAL IMPACT</Text>
                <Text style={S.whyMattersText}>{content.why}</Text>
              </View>
            </View>

            <View style={S.card}>
              <Text style={S.cardEyebrow}>BIOLOGICAL PROTOCOLS</Text>
              <View style={{ gap: 12, marginTop: 12 }}>
                {content.protocols.map((proto, idx) => (
                  <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                    <Ionicons name="checkmark-circle" size={18} color="#e2e8f0" />
                    <Text style={S.protocolText}>{proto}</Text>
                  </View>
                ))}
              </View>
            </View>

            <TouchableOpacity activeOpacity={0.85} onPress={onClose} style={S.doneButton}>
              <Text style={S.doneButtonText}>SYNCHRONIZE & CLOSE</Text>
            </TouchableOpacity>
            
            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  closeCircleBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  centerPill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  pillText: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, color: '#FFF' },
  scrollContent: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },
  moonGlow: { shadowColor: '#FFF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 60, marginBottom: 24 },
  heroHeadline: { fontSize: 26, fontWeight: '400', color: '#FFFFFF', lineHeight: 32, fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', marginBottom: 8, textAlign: 'center' },
  heroTagline: { fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: '600', letterSpacing: 0.5, textAlign: 'center', marginBottom: 20 },
  lunarDayPill: { paddingHorizontal: 16, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  lunarDayText: { fontSize: 10, fontWeight: '800', color: '#FFF', letterSpacing: 2 },
  card: { borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 24, marginBottom: 16 },
  cardEyebrow: { fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.4)', letterSpacing: 1.5, marginBottom: 12 },
  bodyParagraph: { fontSize: 14, color: 'rgba(255,255,255,0.8)', lineHeight: 22, fontWeight: '400' },
  whyMattersBox: { borderLeftWidth: 3, borderLeftColor: '#FFF', paddingLeft: 14, marginVertical: 16 },
  boxEyebrow: { fontSize: 9.5, fontWeight: '900', letterSpacing: 1.2, marginBottom: 4, color: '#FFF' },
  whyMattersText: { fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 20, fontWeight: '500' },
  protocolText: { fontSize: 14, color: 'rgba(255,255,255,0.9)', lineHeight: 20, flex: 1 },
  doneButton: { width: '100%', paddingVertical: 16, borderRadius: 100, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  doneButtonText: { color: '#000', fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
});
