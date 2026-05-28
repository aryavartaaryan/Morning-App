import React, { useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Animated, Dimensions, useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { store, KEYS } from '@/lib/storage';
import { Colors, Spacing, Radius, Font } from '@/constants/theme';

const LANGS = [
  { id: 'en', native: 'English', flag: '🇬🇧' },
  { id: 'hi', native: 'हिंदी', flag: '🇮🇳' },
  { id: 'sa', native: 'संस्कृतम्', flag: '🕉️' },
  { id: 'ta', native: 'தமிழ்', flag: '🌸' },
  { id: 'te', native: 'తెలుగు', flag: '🌺' },
  { id: 'kn', native: 'ಕನ್ನಡ', flag: '🎋' },
];

const FEATURES = [
  { emoji: '🌿', title: 'Dosha AI', sub: 'Real-time Ayurvedic intelligence' },
  { emoji: '🔥', title: 'Habit Engine', sub: '5,000-year habits, modern results' },
  { emoji: '🤖', title: 'Bodhi Guide', sub: 'Your sacred AI wellness companion' },
  { emoji: '🌐', title: 'Community', sub: 'Global seekers on the same path' },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const { height } = useWindowDimensions();
  const [lang, setLang] = React.useState('en');
  const pulseAnim = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.07, duration: 2200, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 2200, useNativeDriver: true }),
    ])).start();
  }, []);

  const handleBegin = async () => {
    await store.set(KEYS.language, lang);
    await store.set(KEYS.welcomeSeen, '1');
    router.replace('/(auth)');
  };

  const { width } = Dimensions.get('window');
  const CARD_W = (width - Spacing.lg * 2 - 10) / 2;
  const LANG_W = (width - Spacing.lg * 2 - 8 * 2) / 3;

  return (
    <LinearGradient colors={['#04021A', '#080428', '#0A0A0F']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingHorizontal: Spacing.lg, paddingTop: 12, paddingBottom: 16 }}>

          {/* ── Logo ── */}
          <View style={{ alignItems: 'center', marginBottom: height < 700 ? 12 : 18 }}>
            <Animated.View style={[{
              width: height < 700 ? 72 : 88, height: height < 700 ? 72 : 88,
              borderRadius: height < 700 ? 36 : 44,
              borderWidth: 1.5, borderColor: 'rgba(212,168,64,0.45)',
              backgroundColor: 'rgba(212,168,64,0.1)',
              alignItems: 'center', justifyContent: 'center',
              marginBottom: 10,
            }, { transform: [{ scale: pulseAnim }] }]}>
              <Text style={{ fontSize: height < 700 ? 34 : 42, color: Colors.gold }}>ॐ</Text>
            </Animated.View>
            <Text style={{ fontSize: height < 700 ? 28 : 34, fontWeight: '900', color: Colors.text, letterSpacing: -1 }}>Nada</Text>
            <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 3 }}>Rise with the sun · Ancient Wisdom · Modern Intelligence</Text>
          </View>

          {/* ── Feature grid ── */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: height < 700 ? 12 : 18 }}>
            {FEATURES.map(f => (
              <LinearGradient key={f.title} colors={['rgba(212,168,64,0.08)', 'rgba(212,168,64,0.02)']}
                style={{ width: CARD_W, borderRadius: Radius.lg, borderWidth: 1, borderColor: 'rgba(212,168,64,0.14)', padding: 10 }}>
                <Text style={{ fontSize: 20, marginBottom: 4 }}>{f.emoji}</Text>
                <Text style={{ fontSize: 12, fontWeight: '800', color: Colors.text, marginBottom: 2 }}>{f.title}</Text>
                <Text style={{ fontSize: 10, color: Colors.textMuted, lineHeight: 13 }}>{f.sub}</Text>
              </LinearGradient>
            ))}
          </View>

          {/* ── Language selection ── */}
          <Text style={{ fontSize: 10, fontWeight: '800', color: Colors.textMuted, textAlign: 'center', marginBottom: 10, letterSpacing: 0.5 }}>
            Choose Your Language · भाषा चुनें
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: height < 700 ? 14 : 20 }}>
            {LANGS.map(l => (
              <TouchableOpacity key={l.id} onPress={() => setLang(l.id)}
                style={{
                  width: LANG_W,
                  borderRadius: Radius.lg, borderWidth: 1,
                  borderColor: lang === l.id ? Colors.gold : Colors.border,
                  backgroundColor: lang === l.id ? 'rgba(212,168,64,0.1)' : Colors.card,
                  padding: 10, alignItems: 'center', gap: 3,
                }} activeOpacity={0.75}>
                <Text style={{ fontSize: 20 }}>{l.flag}</Text>
                <Text style={{ fontSize: 11, fontWeight: '800', color: lang === l.id ? Colors.gold : Colors.text }}>{l.native}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── CTA ── */}
          <TouchableOpacity onPress={handleBegin} activeOpacity={0.85}
            style={{ borderRadius: Radius.full, overflow: 'hidden' }}>
            <LinearGradient colors={['#D4A840', '#F5C842']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ paddingVertical: height < 700 ? 14 : 17, alignItems: 'center' }}>
              <Text style={{ color: '#0A0A0F', fontSize: 15, fontWeight: '900', letterSpacing: 0.5 }}>
                Begin Your Journey  ✦
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <Text style={{ textAlign: 'center', fontSize: 10, color: Colors.textDim, letterSpacing: 1.5, marginTop: 10 }}>
            ✦  Dosha · Karma · Dharma · Moksha  ✦
          </Text>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}
