import React, { useRef, useEffect, useState } from 'react';
import { View, Text, Animated, StyleSheet, Platform, TouchableOpacity, LayoutAnimation, UIManager } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const VEDIC_MANTRAS = [
  {
    sanskrit: "ॐ असतो मा सद्गमय।\nतमसो मा ज्योतिर्गमय।\nमृत्योर्मा अमृतं गमय॥",
    transliteration: "Om asato ma sadgamaya\ntamaso ma jyotirgamaya\nmrityorma amritam gamaya",
    english: "Lead me from the unreal to the real. Lead me from darkness to light. Lead me from death to immortality.",
    short: "Lead me from darkness to light",
    meaning: "This profound Upanishadic prayer is a shift in consciousness — a plea to awaken from illusion into clarity, truth, and boundless awareness. Neuroscience shows that intention-setting like this activates the prefrontal cortex, enhancing focus and reducing anxiety.",
  },
  {
    sanskrit: "लोकाः समस्ताः सुखिनो भवन्तु॥",
    transliteration: "Lokah Samastah Sukhino Bhavantu",
    english: "May all beings everywhere be happy and free, and may my own life contribute in some way to that happiness.",
    short: "May all beings be happy and free",
    meaning: "A universal prayer for peace and liberation. It shifts focus from the individual ego to the collective, reminding us that true wellness is deeply interconnected with the well-being of the world. Practicing loving-kindness is clinically proven to reduce cortisol.",
  },
  {
    sanskrit: "ॐ पूर्णमदः पूर्णमिदं पूर्णात्पूर्णमुदच्यते।\nपूर्णस्य पूर्णमादाय पूर्णमेवावशिष्यते॥",
    transliteration: "Om purnamadah purnamidam\npurnat purnamudachyate\npurnasya purnamadaya\npurnamevavashishyate",
    english: "That is whole, this is whole. From the whole, the whole becomes manifest. When the whole is taken from the whole, the whole remains.",
    short: "Recognize the boundless wholeness within",
    meaning: "A beautiful mathematical and spiritual truth from the Isha Upanishad. It teaches that the universe is fundamentally abundant and complete. You are already whole — nothing you do or lose can diminish your inherent completeness.",
  },
  {
    sanskrit: "ॐ भूर्भुवः स्वः।\nतत्सवितुर्वरेण्यं\nभर्गो देवस्य धीमहि।\nधियो यो नः प्रचोदयात्॥",
    transliteration: "Om bhur bhuvah svah\ntat savitur varenyam\nbhargo devasya dhimahi\ndhiyo yo nah prachodayat",
    english: "We meditate on the spiritual effulgence of that supreme divine reality. May that illuminate our intellect.",
    short: "May divine light illuminate my intellect",
    meaning: "The Gayatri Mantra invokes the Sun's energy as the source of intellectual and spiritual awakening. Research suggests chanting its specific syllables stimulates the vagus nerve, promoting calm, clarity, and inspired action.",
  },
  {
    sanskrit: "ॐ सर्वे भवन्तु सुखिनः\nसर्वे सन्तु निरामयाः।\nसर्वे भद्राणि पश्यन्तु\nमा कश्चिद्दुःखभाग्भवेत्॥",
    transliteration: "Om sarve bhavantu sukhinah\nsarve santu niramayah\nsarve bhadrani pashyantu\nma kashchid duhkhabhag bhavet",
    english: "May all be happy, may all be free from illness. May all see what is auspicious, may no one suffer.",
    short: "May all see what is auspicious",
    meaning: "A deeply therapeutic mantra for global healing. It acts as a biological antidote to anxiety and scarcity by actively generating feelings of goodwill and deep psychological safety — elevating oxytocin, the bonding hormone.",
  }
];

function getDayOfYear(date: Date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = (date.getTime() - start.getTime()) + ((start.getTimezoneOffset() - date.getTimezoneOffset()) * 60 * 1000);
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function DailyIntentionCard() {
  const scale = useRef(new Animated.Value(0.96)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const chevronRotate = useRef(new Animated.Value(0)).current;
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(scale, { toValue: 1, duration: 1200, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 1200, useNativeDriver: true }),
    ]).start();
  }, []);

  const dayIndex = getDayOfYear(new Date()) % VEDIC_MANTRAS.length;
  const mantra = VEDIC_MANTRAS[dayIndex];

  const toggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    LayoutAnimation.configureNext({
      duration: 320,
      create: { type: 'easeInEaseOut', property: 'opacity' },
      update: { type: 'spring', springDamping: 0.75 },
    });
    Animated.timing(chevronRotate, {
      toValue: expanded ? 0 : 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
    setExpanded(prev => !prev);
  };

  const chevronDeg = chevronRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] });

  return (
    <Animated.View style={[styles.container, { transform: [{ scale }], opacity }]}>
      <BlurView intensity={40} tint="dark" style={styles.card}>
        {/* Collapsed Row */}
        <TouchableOpacity onPress={toggle} activeOpacity={0.85} style={styles.header}>
          <Text style={styles.shortText} numberOfLines={expanded ? undefined : 2}>
            "{mantra.short}"
          </Text>
          <Animated.View style={{ transform: [{ rotate: chevronDeg }], marginLeft: 10 }}>
            <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.4)" />
          </Animated.View>
        </TouchableOpacity>

        {/* Expanded Content */}
        {expanded && (
          <View style={styles.expandedContent}>
            <View style={styles.separator} />

            <Text style={styles.sanskritText}>{mantra.sanskrit}</Text>
            <Text style={styles.transText}>{mantra.transliteration}</Text>

            <View style={styles.microDivider} />

            <Text style={styles.eyebrow}>TRANSLATION</Text>
            <Text style={styles.englishText}>"{mantra.english}"</Text>

            <View style={styles.microDivider} />

            <Text style={styles.eyebrow}>THE SCIENCE & MEANING</Text>
            <Text style={styles.meaningText}>{mantra.meaning}</Text>

            <TouchableOpacity onPress={toggle} style={styles.closeRow} activeOpacity={0.7}>
              <Ionicons name="chevron-up" size={13} color="rgba(255,255,255,0.35)" />
            </TouchableOpacity>
          </View>
        )}
      </BlurView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    zIndex: 100,
    elevation: 100,
    alignItems: 'center',
    marginBottom: 8,
  },
  card: {
    width: '100%',
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shortText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    letterSpacing: 0.3,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  expandedContent: {
    marginTop: 4,
  },
  separator: {
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 12,
  },
  sanskritText: {
    fontSize: 17,
    color: '#FCD34D',
    textAlign: 'center',
    lineHeight: 28,
    fontWeight: '500',
    marginBottom: 10,
  },
  transText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    lineHeight: 18,
    letterSpacing: 0.5,
    fontStyle: 'italic',
  },
  microDivider: {
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginVertical: 12,
  },
  eyebrow: {
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 1.5,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  englishText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 22,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  meaningText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 20,
  },
  closeRow: {
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: 2,
  },
});
