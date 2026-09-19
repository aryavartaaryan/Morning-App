import React, { useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity,
  StyleSheet, Dimensions, Platform, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import type { DoshaPeriod } from '@/lib/ayurvedicPeriods';
import type { SolarTimes } from '@/lib/solar';
import { WELLNESS, PERIOD_SANSKRIT, PERIOD_EXTENDED } from '@/lib/wellnessData';
import { Ionicons } from '@expo/vector-icons';
import { useBgContext } from '@/lib/bgContext';

const { width: W } = Dimensions.get('window');

const DOSHA_NAMES: Record<string, string> = {
  kapha: 'Kapha · Stability & Structure',
  pitta: 'Pitta · Transformation & Fire',
  vata:  'Vāta · Kinetic Velocity & Mind',
};

const WESTERN_EXPLAINER: Record<string, any> = {
  morning_kapha_early: {
    headline: 'Your Body is Grounding & Waking',
    tagline: 'Dawn Awakening · Cortisol Rising',
    what: 'Right now, as dawn light stimulates the SCN, your neurobiology transitions smoothly from sleep to wakefulness. Cortisol initiates its morning rise. Ayurveda designates this the early Kapha window.',
    whyMatters: 'Gentle movement and breathwork during this window regulate your autonomic nervous system, locking in your baseline vagal tone for the entire day.',
    analogy: 'The engine is gently warming up. Let it idle smoothly with conscious breath.',
    topFact: [
      { icon: '🧘', label: 'Vagal Tone', value: 'Highly receptive' },
      { icon: '📈', label: 'Cortisol', value: 'Morning rise' },
      { icon: '🌱', label: 'Plasticity', value: 'Open for intention' },
    ],
  },
  morning_kapha: {
    headline: 'Prime Anabolic Build Mode',
    tagline: 'Peak Anabolic Window · Physical Strength',
    what: 'During the ascending solar arc, testosterone, growth hormone, and core cellular building signals peak. Synovial fluid actively lubricates joints, and the musculoskeletal matrix is primed.',
    whyMatters: 'Strength training in this solar window stimulates significantly greater muscle protein synthesis than evening sessions. Your hormonal environment is highly anabolic.',
    analogy: 'Your biological factory is fully staffed. Build now.',
    topFact: [
      { icon: '💪', label: 'Anabolism', value: '+25% vs evening' },
      { icon: '🦴', label: 'Joint Fluid', value: 'Optimal viscosity' },
      { icon: '🛡️', label: 'Immunity', value: 'High WBC count' },
    ],
  },
  midday_pitta: {
    headline: 'Metabolic Fire Peaks with the Sun',
    tagline: 'Solar Zenith · Cognitive Acuity',
    what: 'As the sun approaches celestial zenith, gastric hydrochloric acid reaches its lowest pH. Liver detox pathways and digestive enzymes operate at maximum enzymatic efficiency.',
    whyMatters: 'Eating your primary meal during this peak solar window yields higher nutrient assimilation and prevents metabolic stagnation caused by late-night dining.',
    analogy: 'Your stomach is a roaring blast furnace. Feed it when the fire burns brightest.',
    topFact: [
      { icon: '🔥', label: 'Gastric Acid', value: 'Peak enzymatic pH' },
      { icon: '⚡', label: 'Insulin Sens.', value: '+30% vs evening' },
      { icon: '🧠', label: 'Cognition', value: 'High clarity' },
    ],
  },
  midday_pitta_late: {
    headline: 'Internal Digest Mode',
    tagline: 'Post-Zenith Realignment · Rest & Digest',
    what: 'Following peak solar noon, systemic blood flow is channeled toward the splanchnic vascular bed to digest nutrients. Core temperature undergoes a brief physiological dip.',
    whyMatters: 'Demanding intense cognitive or physical output now creates unnecessary autonomic friction. Honoring this natural biological lull allows cellular digestion to complete cleanly.',
    analogy: 'The battery is re-routing power to the digestive furnace.',
    topFact: [
      { icon: '🩸', label: 'Splanchnic', value: 'Reallocated to gut' },
      { icon: '📉', label: 'Cortisol', value: 'Natural midday dip' },
      { icon: '🧘', label: 'Autonomic', value: 'Rest & assimilation' },
    ],
  },
  afternoon_vata: {
    headline: 'Nervous System Velocity Peaks',
    tagline: 'Neuromuscular Precision · Creative Surge',
    what: 'As the sun descends, sympathetic nervous system tone rises smoothly. Motor coordination, reaction time, and lung vital capacity reach their diurnal zenith.',
    whyMatters: 'Athletic performance and fine motor coordination peak predominantly between late afternoon and dusk. This is your biological peak for movement and strategic brainstorming.',
    analogy: 'Your nervous system is a taut sail filled with brisk afternoon wind.',
    topFact: [
      { icon: '🎨', label: 'Flow', value: 'Creative peak' },
      { icon: '🏃', label: 'Athletic', value: 'Highest VO2' },
      { icon: '🫁', label: 'Lungs', value: 'Maximum volume' },
    ],
  },
  evening_kapha: {
    headline: 'Dusk Transition: Winding Down',
    tagline: 'Melatonin Synthesis · Parasympathetic Shift',
    what: 'Following sunset, the absence of short-wavelength blue light triggers the pineal gland to synthesize melatonin. Core body temperature begins its nightly drop.',
    whyMatters: 'Artificial blue screen light exposure during this twilight window suppresses melatonin synthesis by over 50%, throwing off circadian phase alignment.',
    analogy: 'The city of your cells is dimming its streetlights.',
    topFact: [
      { icon: '🌙', label: 'Melatonin', value: 'Synthesis initiates' },
      { icon: '🌡️', label: 'Core Temp', value: 'Dropping for sleep' },
      { icon: '📵', label: 'Blue Light', value: 'Max vulnerability' },
    ],
  },
  night_pitta: {
    headline: 'Nocturnal Cellular Maintenance',
    tagline: 'Growth Hormone Surge · Glymphatic Flush',
    what: 'While conscious awareness sleeps, the body activates its most aggressive repair programs. The glymphatic system clears metabolic waste from brain tissue.',
    whyMatters: 'Every hour of deep sleep before the pre-dawn hours is irreplaceable biological medicine for DNA repair and memory consolidation.',
    analogy: 'The manufacturing line is paused for deep cleaning.',
    topFact: [
      { icon: '🧬', label: 'Autophagy', value: 'Self-cleaning max' },
      { icon: '🏋️', label: 'HGH', value: 'Slow-wave surge' },
      { icon: '🧹', label: 'Glymphatic', value: 'Brain clearance' },
    ],
  },
  night_vata: {
    headline: 'Sacred Pre-Dawn Window',
    tagline: 'Subconscious Clarity · Alpha-Theta Waves',
    what: 'In the 96 minutes before solar dawn, the atmosphere is charged with stillness. EEG studies confirm spontaneous alpha and theta brainwave dominance.',
    whyMatters: 'Intentions and meditation set during this window penetrate deep into the subconscious mind with incredible efficacy.',
    analogy: 'Your mind is a pristine mountain lake before sunrise.',
    topFact: [
      { icon: '🧘', label: 'Brainwaves', value: 'Alpha-theta baseline' },
      { icon: '🌱', label: 'BDNF', value: 'Elevated plasticity' },
      { icon: '✨', label: 'Timing', value: '96 min prior dawn' },
    ],
  },
};

export default function MetabolicStoryModal({
  period,
  solarTimes,
  onClose,
}: {
  period: DoshaPeriod;
  solarTimes: SolarTimes | null;
  onClose: () => void;
}) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const totalSlides = 8;
  const { bgUri } = useBgContext();
  const insets = useSafeAreaInsets();

  const handlePress = (evt: any) => {
    const { locationX } = evt.nativeEvent;
    if (locationX < W * 0.3) {
      if (currentSlide > 0) {
        setCurrentSlide(prev => prev - 1);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } else {
      if (currentSlide < totalSlides - 1) {
        setCurrentSlide(prev => prev + 1);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onClose();
      }
    }
  };

  const baseColor = period.dosha === 'pitta' ? '#FBBF24' : period.dosha === 'vata' ? '#60A5FA' : '#4ADE80';
  const sanskrit = PERIOD_SANSKRIT[period.id];
  const explain = WESTERN_EXPLAINER[period.id] || WESTERN_EXPLAINER['morning_kapha'];
  const wellness = WELLNESS[period.id];
  const extended = PERIOD_EXTENDED[period.id] || PERIOD_EXTENDED['morning_kapha'];

  const renderSlideContent = () => {
    switch(currentSlide) {
      case 0: // The Vibe (Hero)
        return (
          <View>
            <Text style={{ fontSize: 52, fontWeight: '900', color: '#FFF', fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', letterSpacing: -1, marginBottom: 4 }}>
              {DOSHA_NAMES[period.dosha].split('·')[0].toUpperCase().trim()}
            </Text>
            {extended?.phonetic && (
              <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: '700', letterSpacing: 2, marginBottom: 4 }}>
                {extended.phonetic.toUpperCase()}
              </Text>
            )}
            <Text style={{ fontSize: 13, fontWeight: '700', color: baseColor, letterSpacing: 4, textTransform: 'uppercase', marginBottom: 32 }}>
              {sanskrit?.meaning || 'Ayurvedic Phase'}
            </Text>
            
            <Text style={{ fontSize: 36, fontWeight: '400', color: '#FFF', fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', lineHeight: 48, marginBottom: 12 }}>
              {explain.headline}
            </Text>
            <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' }}>
              {explain.tagline}
            </Text>
          </View>
        );

      case 1: // The Biology (What)
        return (
          <View>
             <Text style={{ fontSize: 10, fontWeight: '900', color: baseColor, letterSpacing: 3, marginBottom: 24 }}>THE BIOLOGY</Text>
             <Text style={{ fontSize: 24, color: 'rgba(255,255,255,0.95)', lineHeight: 36, fontWeight: '400', marginBottom: 32 }}>{explain.what}</Text>
             <View style={{ borderLeftWidth: 2, borderLeftColor: baseColor, paddingLeft: 16 }}>
               <Text style={{ fontSize: 18, color: 'rgba(255,255,255,0.9)', fontStyle: 'italic', lineHeight: 28 }}>"{explain.analogy}"</Text>
             </View>
          </View>
        );

      case 2: // Why it matters
        return (
          <View>
             <Text style={{ fontSize: 10, fontWeight: '900', color: baseColor, letterSpacing: 3, marginBottom: 24 }}>WHY IT MATTERS</Text>
             <Text style={{ fontSize: 24, color: 'rgba(255,255,255,0.95)', lineHeight: 36, fontWeight: '400' }}>{explain.whyMatters}</Text>
          </View>
        );

      case 3: // Vedic Roots (Elements & Etymology)
        return (
          <View>
             <Text style={{ fontSize: 10, fontWeight: '900', color: baseColor, letterSpacing: 3, marginBottom: 24 }}>THE VEDIC ROOTS</Text>
             
             {extended?.elementCombined && (
               <Text style={{ fontSize: 22, color: '#FFF', lineHeight: 34, fontWeight: '400', marginBottom: 36 }}>
                 {extended.elementCombined}
               </Text>
             )}
             
             <View style={{ gap: 20 }}>
               {extended?.etymParts?.map((part: any, idx: number) => (
                  <View key={idx} style={{ flexDirection: 'row', gap: 16 }}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: baseColor, width: 85 }}>{part.term}</Text>
                    <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.9)', flex: 1, lineHeight: 26 }}>{part.breakdown}</Text>
                  </View>
               ))}
             </View>
          </View>
        );

      case 4: // Classical Reference
        return (
          <View>
             <Text style={{ fontSize: 10, fontWeight: '900', color: baseColor, letterSpacing: 3, marginBottom: 32 }}>CLASSICAL WISDOM</Text>
             {extended?.classicalRef && (
               <View>
                 <Text style={{ fontSize: 32, color: '#FFF', fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontStyle: 'italic', marginBottom: 24, lineHeight: 44 }}>"{extended.classicalRef.text}"</Text>
                 <Text style={{ fontSize: 12, color: baseColor, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' }}>— {extended.classicalRef.source}</Text>
               </View>
             )}
          </View>
        );

      case 5: // Biological Markers & Sun
        return (
          <View>
             <Text style={{ fontSize: 10, fontWeight: '900', color: baseColor, letterSpacing: 3, marginBottom: 24 }}>BIOLOGICAL MARKERS</Text>
             
             {extended?.systemTags && (
               <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 32 }}>
                 {extended.systemTags.map((tag: string, idx: number) => (
                   <View key={idx} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 24, borderWidth: 1, borderColor: `${baseColor}40`, backgroundColor: `${baseColor}15` }}>
                     <Text style={{ fontSize: 11, fontWeight: '800', color: baseColor, letterSpacing: 1.5, textTransform: 'uppercase' }}>{tag}</Text>
                   </View>
                 ))}
               </View>
             )}

             <View style={{ gap: 28, marginBottom: 40 }}>
               {explain.topFact.map((fact: any, idx: number) => (
                  <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                    <Text style={{ fontSize: 40 }}>{fact.icon}</Text>
                    <View>
                      <Text style={{ fontSize: 18, fontWeight: '700', color: '#FFF', marginBottom: 4, letterSpacing: 0.5 }}>{fact.label}</Text>
                      <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.7)' }}>{fact.value}</Text>
                    </View>
                  </View>
               ))}
             </View>
             
             {extended?.sunPosition && (
               <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}>
                 <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.95)', lineHeight: 26, fontStyle: 'italic' }}>{extended.sunPosition}</Text>
               </View>
             )}
          </View>
        );

      case 6: // Systemic Impact
        return (
          <View>
             <Text style={{ fontSize: 10, fontWeight: '900', color: baseColor, letterSpacing: 3, marginBottom: 32 }}>PHYSIOLOGICAL STATE</Text>
             
             <View style={{ gap: 24 }}>
               {wellness?.bodyBullets?.map((item: any, idx: number) => (
                  <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 16 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: item.dot, marginTop: 8, shadowColor: item.dot, shadowOpacity: 0.8, shadowRadius: 6, shadowOffset: { width:0, height:0 } }} />
                    <Text style={{ fontSize: 18, color: 'rgba(255,255,255,0.95)', lineHeight: 28, flex: 1 }}>{item.text}</Text>
                  </View>
               ))}
             </View>
          </View>
        );

      case 7: // Optimal Protocols
        return (
          <View>
             <Text style={{ fontSize: 10, fontWeight: '900', color: baseColor, letterSpacing: 3, marginBottom: 24 }}>OPTIMAL PROTOCOLS</Text>
             
             <View style={{ gap: 24, marginBottom: 32 }}>
               {wellness?.doItems?.map((item: any, idx: number) => (
                  <View key={`do-${idx}`} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                    <Text style={{ fontSize: 20, marginTop: 2 }}>{item.emoji}</Text>
                    <Text style={{ fontSize: 18, color: 'rgba(255,255,255,0.95)', lineHeight: 28, flex: 1 }}>{item.text}</Text>
                  </View>
               ))}
             </View>

             <View style={{ gap: 24, marginBottom: 32 }}>
               {wellness?.avoidItems?.map((item: any, idx: number) => (
                  <View key={`avoid-${idx}`} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                    <Text style={{ fontSize: 20, marginTop: 2 }}>{item.emoji}</Text>
                    <Text style={{ fontSize: 18, color: 'rgba(255,255,255,0.95)', lineHeight: 28, flex: 1 }}>{item.text}</Text>
                  </View>
               ))}
             </View>
             
             {wellness?.naadSounds && (
               <>
                 <Text style={{ fontSize: 10, fontWeight: '900', color: baseColor, letterSpacing: 3, marginBottom: 16, marginTop: 8 }}>RESONANCE</Text>
                 <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                   {wellness.naadSounds.map((sound: string, idx: number) => (
                     <View key={idx} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)' }}>
                       <Text style={{ fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.9)' }}>{sound.replace(/_/g, ' ').toUpperCase()}</Text>
                     </View>
                   ))}
                 </View>
               </>
             )}
          </View>
        );

      default: return null;
    }
  };

  return (
    <Modal visible={true} animationType="fade" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {/* 1. Cinematic Full-Bleed Image with Heavy Darkening Overlay */}
        <Image 
          source={bgUri ? { uri: bgUri } : undefined} 
          style={StyleSheet.absoluteFillObject} 
          resizeMode="cover" 
        />
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.65)' }]} />
        
        {/* 2. Deep Editorial Dark Filter & Gradient (Ultra Premium) */}
        <BlurView intensity={45} tint="dark" style={StyleSheet.absoluteFillObject} />
        <LinearGradient 
          colors={['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.95)', '#000000']} 
          locations={[0, 0.4, 0.75, 1]} 
          style={StyleSheet.absoluteFillObject} 
        />

        {/* 3. Story Navigation Progress Bar */}
        <SafeAreaView style={StyleSheet.absoluteFillObject} edges={['top']}>
          <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingTop: 12 }}>
            {[...Array(totalSlides)].map((_, i) => (
              <View 
                key={i} 
                style={{ 
                  flex: 1, 
                  height: 2, 
                  backgroundColor: i <= currentSlide ? '#FFF' : 'rgba(255,255,255,0.2)', 
                  borderRadius: 1 
                }} 
              />
            ))}
          </View>
        </SafeAreaView>

        {/* 4. Touch Overlay (captures taps to advance stories) */}
        <TouchableOpacity 
          activeOpacity={1} 
          onPress={handlePress} 
          style={StyleSheet.absoluteFillObject} 
        />

        {/* 5. Typography Layer */}
        <SafeAreaView style={[StyleSheet.absoluteFillObject, { justifyContent: 'flex-end', paddingBottom: 60, paddingHorizontal: 32 }]} pointerEvents="none">
           {renderSlideContent()}
        </SafeAreaView>
      </View>
    </Modal>
  );
}
