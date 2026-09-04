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
    transliteration: "Om asato ma sadgamaya\ntamaso ma jyotirgamaya\nmrityorma amritam gamaya",
    english: "Lead me from the unreal to the real. Lead me from darkness to light. Lead me from death to immortality.",
    short: "Lead me from darkness to light",
    meaning: "This profound Upanishadic prayer is not about physical death, but a shift in consciousness. It is a plea to awaken from the illusion of separation and ignorance, stepping into clarity, truth, and boundless awareness."
  },
  {
    sanskrit: "लोकाः समस्ताः सुखिनो भवन्तु॥",
    transliteration: "Lokah Samastah Sukhino Bhavantu",
    english: "May all beings everywhere be happy and free, and may my own life contribute in some way to that happiness.",
    short: "May all beings be happy and free",
    meaning: "A universal prayer for peace and liberation. It shifts our focus from the individual ego to the collective, reminding us that true wellness is deeply interconnected with the well-being of the world around us."
  },
  {
    sanskrit: "ॐ पूर्णमदः पूर्णमिदं पूर्णात्पूर्णमुदच्यते।\nपूर्णस्य पूर्णमादाय पूर्णमेवावशिष्यते॥",
    transliteration: "Om purnamadah purnamidam\npurnat purnamudachyate\npurnasya purnamadaya\npurnamevavashishyate",
    english: "That is whole, this is whole. From the whole, the whole becomes manifest. When the whole is taken from the whole, the whole remains.",
    short: "Recognize the boundless wholeness within",
    meaning: "A beautiful mathematical and spiritual truth from the Isha Upanishad. It teaches that the universe is fundamentally abundant and complete. You are already whole, and nothing you do or lose can diminish your inherent completeness."
  },
  {
    sanskrit: "ॐ भूर्भुवः स्वः।\nतत्सवितुर्वरेण्यं\nभर्गो देवस्य धीमहि।\nधियो यो नः प्रचोदयात्॥",
    transliteration: "Om bhur bhuvah svah\ntat savitur varenyam\nbhargo devasya dhimahi\ndhiyo yo nah prachodayat",
    english: "We meditate on the spiritual effulgence of that supreme divine reality. May that illuminate our intellect.",
    short: "May divine light illuminate my intellect",
    meaning: "The Gayatri Mantra is an invocation of the Sun's energy (Savitur) not just as a physical star, but as the source of intellectual and spiritual awakening. It is a request for clarity of mind and inspired action."
  },
  {
    sanskrit: "ॐ सर्वे भवन्तु सुखिनः\nसर्वे सन्तु निरामयाः।\nसर्वे भद्राणि पश्यन्तु\nमा कश्चिद्दुःखभाग्भवेत्॥",
    transliteration: "Om sarve bhavantu sukhinah\nsarve santu niramayah\nsarve bhadrani pashyantu\nma kashchid duhkhabhag bhavet",
    english: "May all be happy, may all be free from illness. May all see what is auspicious, may no one suffer.",
    short: "May all see what is auspicious",
    meaning: "A deeply therapeutic mantra used for global healing. It acts as an antidote to anxiety and scarcity by actively generating feelings of goodwill, compassion, and deep psychological safety."
  }
];

function getDayOfYear(date: Date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = (date.getTime() - start.getTime()) + ((start.getTimezoneOffset() - date.getTimezoneOffset()) * 60 * 1000);
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

export function DailyIntentionCard() {
  const scale = useRef(new Animated.Value(0.96)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const [modalVisible, setModalVisible] = useState(false);
  
  useEffect(() => {
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      })
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
          style={styles.transparentWhisper}
        >
          <View style={styles.homeContentCenter}>
            <Text style={styles.homeIntentionText} numberOfLines={2}>
              "{mantra.short}"
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, opacity: 0.8 }}>
              <Text style={{ fontSize: 9, fontWeight: '800', color: 'rgba(255,255,255,0.6)', letterSpacing: 1.2 }}>SEE TODAY'S MANTRA</Text>
              <Ionicons name="chevron-forward" size={10} color="rgba(255,255,255,0.6)" style={{ marginLeft: 2, marginTop: 1 }} />
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalBg}>
          <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFillObject} />
          <LinearGradient colors={['rgba(15,23,42,0.8)', 'rgba(2,6,23,0.95)']} style={StyleSheet.absoluteFillObject} />
          
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
              <View style={styles.card}>
                <Text style={styles.sanskritText}>{mantra.sanskrit}</Text>
                <View style={styles.divider} />
                <Text style={styles.transText}>{mantra.transliteration}</Text>
              </View>

              <View style={styles.englishCard}>
                <Text style={styles.cardEyebrow}>TRANSLATION</Text>
                <Text style={styles.englishText}>"{mantra.english}"</Text>
              </View>
              
              <View style={styles.meaningCard}>
                <Text style={styles.cardEyebrow}>THE SCIENCE & MEANING</Text>
                <Text style={styles.meaningText}>{mantra.meaning}</Text>
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
    alignItems: 'center',
    marginBottom: 10,
  },
  transparentWhisper: {
    paddingVertical: 10,
    paddingHorizontal: 32,
    width: 'auto',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 24,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  homeContentCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeIntentionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  modalBg: { flex: 1, backgroundColor: 'transparent' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  closeCircleBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  centerPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  pillText: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, color: '#FFF' },
  scrollContent: { paddingHorizontal: 24, paddingTop: 30, paddingBottom: 40 },
  card: { alignItems: 'center', marginBottom: 24, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  sanskritText: { fontSize: 24, color: '#FCD34D', textAlign: 'center', lineHeight: 36, fontWeight: '600' },
  divider: { width: 40, height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 20 },
  transText: { fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 22, letterSpacing: 0.5 },
  englishCard: { marginBottom: 16, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  cardEyebrow: { fontSize: 9, fontWeight: '900', color: 'rgba(255,255,255,0.4)', letterSpacing: 1.5, marginBottom: 12, textTransform: 'uppercase' },
  englishText: { fontSize: 17, color: '#FFF', lineHeight: 26, fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontStyle: 'italic' },
  meaningCard: { marginBottom: 32, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  meaningText: { fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 22 },
  doneButton: { width: '100%', paddingVertical: 16, borderRadius: 100, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  doneButtonText: { color: '#000', fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
});
