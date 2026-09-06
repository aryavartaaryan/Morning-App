import React, { useRef, useEffect, useState } from 'react';
import { View, Text, Animated, StyleSheet, Platform, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

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
    transliteration: "Om sarve bhavantu sukhinah\nsarve santu niramayah",
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
  const scale = useRef(new Animated.Value(0.96)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(scale, { toValue: 1, duration: 1200, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 1200, useNativeDriver: true }),
    ]).start();
  }, []);

  const dayIndex = getDayOfYear(new Date()) % VEDIC_MANTRAS.length;
  const mantra = VEDIC_MANTRAS[dayIndex];

  return (
    <>
      <Animated.View style={[styles.container, { transform: [{ scale }], opacity }]}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setModalVisible(true);
          }}
          style={styles.cardWrapper}
        >
          <BlurView intensity={50} tint="dark" style={styles.cardInner}>
            {/* ── Mantra Title ── */}
            <View style={styles.titleRow}>
               <View style={styles.goldDot} />
               <Text style={styles.titleText}>TODAY'S MANTRA</Text>
            </View>

            {/* ── Mantra Transliteration ── */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginBottom: 6, paddingHorizontal: 10 }}>
              {mantra.transliteration.replace(/\n/g, ' ').split(' ').map((word, i) => (
                <AnimatedWord key={i} word={word} index={i} delayOffset={300} />
              ))}
            </View>

            {/* ── English Meaning ── */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', paddingHorizontal: 10 }}>
              <Text style={[styles.englishText, { marginRight: -2 }]}>"</Text>
              {mantra.english.split(' ').map((word, i) => (
                <AnimatedMeaningWord key={i} word={word} index={i} delayOffset={300 + (mantra.transliteration.split(' ').length * 120)} />
              ))}
              <Text style={[styles.englishText, { marginLeft: -4 }]}>"</Text>
            </View>

            <View style={styles.affordanceRow}>
              <Text style={styles.affordanceText}>Tap to explore</Text>
              <Ionicons name="chevron-forward" size={10} color="rgba(255,255,255,0.45)" />
            </View>
          </BlurView>
        </TouchableOpacity>
      </Animated.View>

      {/* Full-Screen Mantra Modal */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalBg}>
          <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFillObject} />
          <LinearGradient colors={['rgba(15,23,42,0.85)', 'rgba(2,6,23,0.97)']} style={StyleSheet.absoluteFillObject} />

          <SafeAreaView style={{ flex: 1 }}>
            <View style={styles.topBar}>
              <View style={{ width: 36 }} />
              <View style={styles.centerPill}>
                <Ionicons name="sparkles" size={12} color="#FFF" />
                <Text style={styles.pillText}>VEDIC MANTRA</Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeCircleBtn}>
                <Ionicons name="close" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              <View style={styles.modalCard}>
                <Text style={styles.sanskritTextModal}>{mantra.sanskrit}</Text>
                <View style={styles.divider} />
                <Text style={styles.transTextModal}>{mantra.transliteration}</Text>
              </View>

              <View style={styles.englishCard}>
                <Text style={styles.modalCardEyebrow}>TRANSLATION</Text>
                <Text style={styles.englishTextModal}>"{mantra.english}"</Text>
              </View>

              <View style={styles.meaningCard}>
                <Text style={styles.modalCardEyebrow}>THE SCIENCE & MEANING</Text>
                <Text style={styles.meaningTextModal}>{mantra.meaning}</Text>
              </View>

              <TouchableOpacity activeOpacity={0.85} onPress={() => setModalVisible(false)} style={styles.doneButton}>
                <Text style={styles.doneButtonText}>INTERNALIZE & CLOSE</Text>
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
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
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(10,10,10,0.4)',
    alignItems: 'center', // Center everything
    // Heavy floating shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.6,
    shadowRadius: 32,
    elevation: 20,
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
