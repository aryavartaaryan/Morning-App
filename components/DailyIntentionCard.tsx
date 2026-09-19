import React, { useRef, useEffect, useState } from 'react';
import { View, Text, Animated, StyleSheet, Platform, TouchableOpacity, Modal, ScrollView, Image } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useBgContext } from '@/lib/bgContext';

const VEDIC_MANTRAS = [
  {
    sanskrit: "ॐ असतो मा सद्गमय।\nतमसो मा ज्योतिर्गमय।\nमृत्योर्मा अमृतं गमय॥",
    transliteration: "Om asato ma sadgamaya\ntamaso ma jyotirgamaya",
    english: "Lead me from the unreal to the real. Lead me from darkness to light.",
    short: "Lead me from darkness to light",
    meaning: "This profound Upanishadic prayer is a shift in consciousness — a plea to awaken from illusion into clarity, truth, and boundless awareness. Neuroscience shows that intention-setting like this activates the prefrontal cortex, enhancing focus and reducing anxiety.",
  },
  {
    sanskrit: "लोकाः समस्ताः सुखिनो भवन्तु॥",
    transliteration: "Lokah Samastah Sukhino Bhavantu",
    english: "May all beings everywhere be happy and free.",
    short: "May all beings be happy and free",
    meaning: "A universal prayer for peace and liberation. It shifts focus from the individual ego to the collective, reminding us that true wellness is deeply interconnected with the well-being of the world. Practicing loving-kindness is clinically proven to reduce cortisol.",
  },
  {
    sanskrit: "ॐ पूर्णमदः पूर्णमिदं पूर्णात्पूर्णमुदच्यते।\nपूर्णस्य पूर्णमादाय पूर्णमेवावशिष्यते॥",
    transliteration: "Om purnamadah purnamidam\npurnat purnamudachyate",
    english: "That is whole, this is whole. When the whole is taken from the whole, the whole remains.",
    short: "Recognize the boundless wholeness within",
    meaning: "A beautiful mathematical and spiritual truth from the Isha Upanishad. It teaches that the universe is fundamentally abundant and complete. You are already whole — nothing you do or lose can diminish your inherent completeness.",
  },
  {
    sanskrit: "ॐ भूर्भुवः स्वः।\nतत्सवितुर्वरेण्यं\nभर्गो देवस्य धीमहि।\nधियो यो नः प्रचोदयात्॥",
    transliteration: "Om bhur bhuvah svah\ntat savitur varenyam",
    english: "May the divine light illuminate our intellect and inspire our actions.",
    short: "May divine light illuminate my intellect",
    meaning: "The Gayatri Mantra invokes the Sun's energy as the source of intellectual and spiritual awakening. Research suggests chanting its specific syllables stimulates the vagus nerve, promoting calm, clarity, and inspired action.",
  },
  {
    sanskrit: "ॐ सर्वे भवन्तु सुखिनः\nसर्वे सन्तु निरामयाः।\nसर्वे भद्राणि पश्यन्तु\nमा कश्चिद्दुःखभाग्भवेत्॥",
    transliteration: "Om sarve bhavantu sukhinah\nsarve santu niramayah\nsarve bhadrani pashyantu\nma kashchid duhkha bhagbhavet",
    english: "May all be happy, may all be free from illness. May no one suffer.",
    short: "May all see what is auspicious",
    meaning: "A deeply therapeutic mantra for global healing. It acts as a biological antidote to anxiety and scarcity by actively generating feelings of goodwill and deep psychological safety.",
  }
];

function getDayOfYear(date: Date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = (date.getTime() - start.getTime()) + ((start.getTimezoneOffset() - date.getTimezoneOffset()) * 60 * 1000);
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

interface Props {
  currentPeriod?: any;
  solarTimes?: any;
}


const AnimatedWord = ({ word, index, delayOffset }: { word: string, index: number, delayOffset: number }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 800,
      delay: delayOffset + (index * 120),
      useNativeDriver: true,
    }).start();
  }, []);
  
  return (
    <Animated.Text style={[styles.romanText, { 
      opacity: anim, 
      transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) }]
    }]}>
      {word}{' '}
    </Animated.Text>
  );
};

const AnimatedMeaningWord = ({ word, index, delayOffset }: { word: string, index: number, delayOffset: number }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 800,
      delay: delayOffset + (index * 80),
      useNativeDriver: true,
    }).start();
  }, []);
  
  return (
    <Animated.Text style={[styles.englishText, { 
      opacity: anim,
      transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) }]
    }]}>
      {word}{' '}
    </Animated.Text>
  );
};

export function DailyIntentionCard({ currentPeriod, solarTimes }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const fadeTextAnim = useRef(new Animated.Value(1)).current;
  const [step, setStep] = useState(0); // 0 = Transliteration, 1 = English
  const [modalVisible, setModalVisible] = useState(false);
  const { bgUri } = useBgContext();

  useEffect(() => {
    // Entrance fade
    Animated.timing(fadeAnim, { toValue: 1, duration: 2000, useNativeDriver: true }).start();

    // Crossfade appearance / disappearance cycler
    const interval = setInterval(() => {
      Animated.timing(fadeTextAnim, {
        toValue: 0,
        duration: 1500,
        useNativeDriver: true
      }).start(() => {
        setStep(prev => (prev === 0 ? 1 : 0));
        Animated.timing(fadeTextAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true
        }).start();
      });
    }, 7000); // 7 seconds per cycle

    return () => clearInterval(interval);
  }, []);

  const dayIndex = getDayOfYear(new Date()) % VEDIC_MANTRAS.length;
  const mantra = VEDIC_MANTRAS[dayIndex];

  return (
    <>
      <Animated.View style={[styles.container, { opacity: fadeAnim, marginBottom: -10 }]}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setModalVisible(true);
          }}
          style={{ width: '100%', paddingVertical: 10, paddingHorizontal: 28, position: 'relative', overflow: 'visible' }}
        >
            {/* The giant faint quotation mark in background */}
            <Text style={{ 
                position: 'absolute', 
                top: -15, left: 24, 
                fontSize: 120, 
                fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', 
                color: 'rgba(255,255,255,0.06)',
                zIndex: -1 
            }}>
                "
            </Text>

            {/* ── Mantra Title ── */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
               <Text style={{ color: 'rgba(255,255,255,0.5)', letterSpacing: 2, fontSize: 9, fontWeight: '700', textTransform: 'uppercase' }}>TODAY'S MANTRA</Text>
            </View>

            {/* ── Dynamic Fading Text ── */}
            <Animated.View style={{ height: 84, justifyContent: 'center', opacity: fadeTextAnim, marginBottom: 4 }}>
                <Text style={{ 
                    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', 
                    fontStyle: 'italic', 
                    fontSize: step === 0 ? 19 : 18, // Reduced Sanskrit mantra font size, kept english meaning the same
                    color: step === 0 ? '#FFF' : 'rgba(255,255,255,0.9)', 
                    textAlign: 'left', lineHeight: 28,
                    textShadowColor: 'rgba(0,0,0,0.5)',
                    textShadowOffset: { width: 0, height: 2 },
                    textShadowRadius: 8
                }}>
                    {step === 0 ? mantra.transliteration : `"${mantra.english}"`}
                </Text>
            </Animated.View>

            {/* ── CTA ── */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="arrow-forward-outline" size={14} color="rgba(255,255,255,0.6)" />
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontWeight: '600', letterSpacing: 1, fontSize: 10, textTransform: 'uppercase' }}>TAP TO EXPLORE</Text>
            </View>
        </TouchableOpacity>
      </Animated.View>

      {/* Full-Screen Mantra Modal */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          
          {/* Cinematic Background */}
          <Image 
            source={bgUri ? { uri: bgUri } : undefined} 
            style={StyleSheet.absoluteFillObject} 
            resizeMode="cover" 
          />
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.65)' }]} />
          <BlurView intensity={45} tint="dark" style={StyleSheet.absoluteFillObject} />
          <LinearGradient 
            colors={['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.95)', '#000000']} 
            locations={[0, 0.4, 0.75, 1]} 
            style={StyleSheet.absoluteFillObject} 
          />

          <SafeAreaView style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 16 }}>
              <View style={{ width: 40 }} />
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 9, fontWeight: '900', color: '#FCD34D', letterSpacing: 2.5, marginBottom: 2 }}>DAILY INTENTION</Text>
                <Text style={{ fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.6)', letterSpacing: 1, textTransform: 'uppercase' }}>VEDIC MANTRA</Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={{ width: 40, height: 40, alignItems: 'flex-end', justifyContent: 'center' }}>
                <Ionicons name="close" size={28} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            </View>

            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
              
              <View style={{ alignItems: 'center', marginBottom: 24 }}>
                <Ionicons name="rose-outline" size={32} color="rgba(252,211,77,0.3)" />
              </View>

              <Text style={{ fontSize: 28, fontWeight: '400', color: '#FFF', fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', textAlign: 'center', lineHeight: 44, letterSpacing: 0.5 }}>
                {mantra.sanskrit}
              </Text>
              
              <View style={{ height: 1, width: 40, backgroundColor: 'rgba(252,211,77,0.5)', marginVertical: 24 }} />
              
              <Text style={{ fontSize: 18, color: '#FCD34D', fontStyle: 'italic', fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', textAlign: 'center', lineHeight: 28, marginBottom: 32, letterSpacing: 0.5 }}>
                {mantra.transliteration}
              </Text>

              <BlurView intensity={45} tint="dark" style={{ paddingHorizontal: 24, paddingVertical: 18, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.03)', width: '100%' }}>
                <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.9)', textAlign: 'center', lineHeight: 24, fontWeight: '500' }}>
                  "{mantra.english}"
                </Text>
              </BlurView>
            </View>

            <View style={{ paddingHorizontal: 24, paddingBottom: 24 }}>
              
              <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 24, padding: 20, marginBottom: 36, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Ionicons name="leaf-outline" size={16} color="rgba(255,255,255,0.5)" />
                  <Text style={{ fontSize: 9, fontWeight: '800', color: 'rgba(255,255,255,0.5)', letterSpacing: 2, textTransform: 'uppercase' }}>THE SCIENCE & MEANING</Text>
                </View>
                <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 24 }}>
                  {mantra.meaning}
                </Text>
              </View>

              <TouchableOpacity 
                activeOpacity={0.8} 
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setModalVisible(false);
                }} 
                style={{
                  width: '100%', height: 50, borderRadius: 25,
                  backgroundColor: 'rgba(252,211,77,0.15)',
                  borderWidth: 1, borderColor: 'rgba(252,211,77,0.3)',
                  flexDirection: 'row', gap: 10,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Ionicons name="checkmark" size={18} color="#FCD34D" />
                <Text style={{ fontSize: 12, fontWeight: '800', color: '#FCD34D', letterSpacing: 2 }}>INTERNALIZE & CLOSE</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    zIndex: 100,
    elevation: 100,
    marginBottom: 0,
  },
  cardWrapper: {
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
  },
    cardInner: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(15,15,15,0.55)',
    alignItems: 'center', // Center everything
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  goldDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FCD34D',
  },
  titleText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FCD34D',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  romanText: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 15, lineHeight: 22,
    fontWeight: '600',
    color: '#FFFFFF',
    fontStyle: 'italic',
  },
  englishText: {
    fontSize: 11, // Smaller English font
    fontWeight: '400',
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 16,
    fontStyle: 'italic',
    
  },
  affordanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    marginTop: 8,
    opacity: 0.7,
  },
  affordanceText: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  // Modal
  modalBg: { flex: 1, backgroundColor: 'transparent' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  closeCircleBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  centerPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  pillText: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, color: '#FFF' },
  scrollContent: { paddingHorizontal: 24, paddingTop: 30, paddingBottom: 40 },
  modalCard: { alignItems: 'center', marginBottom: 24, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  sanskritTextModal: { fontSize: 24, color: '#FCD34D', textAlign: 'center', lineHeight: 36, fontWeight: '600' },
  divider: { width: 40, height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 20 },
  transTextModal: { fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 22, letterSpacing: 0.5, fontStyle: 'italic' },
  englishCard: { marginBottom: 16, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  modalCardEyebrow: { fontSize: 9, fontWeight: '900', color: 'rgba(255,255,255,0.4)', letterSpacing: 1.5, marginBottom: 12, textTransform: 'uppercase' },
  englishTextModal: { fontSize: 17, color: '#FFF', lineHeight: 26, fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontStyle: 'italic' },
  meaningCard: { marginBottom: 32, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  meaningTextModal: { fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 22 },
  doneButton: { width: '100%', paddingVertical: 16, borderRadius: 100, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  doneButtonText: { color: '#000', fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
});
