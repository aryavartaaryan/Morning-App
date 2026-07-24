import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ImageBackground, Dimensions, Animated, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { speakBodhi, stopBodhi } from '@/lib/speech';
import { store, KEYS } from '@/lib/storage';
import { Colors, Spacing, Radius, Font } from '@/constants/theme';
import { getBgSource } from '@/lib/bgImages';

const { width } = Dimensions.get('window');

const LANGUAGES = [
  { code: 'en', flag: '🇬🇧', name: 'English',  native: 'English',   available: true  },
  { code: 'hi', flag: '🇮🇳', name: 'Hindi',    native: 'हिन्दी',    available: true  },
  { code: 'de', flag: '🇩🇪', name: 'German',   native: 'Deutsch',   available: false },
  { code: 'fr', flag: '🇫🇷', name: 'French',   native: 'Français',  available: false },
  { code: 'ja', flag: '🇯🇵', name: 'Japanese', native: '日本語',     available: false },
] as const;

type LangCode = typeof LANGUAGES[number]['code'];

const BODHI_INTRO_EN = `Welcome to OneSUTRA — India's living Ayurvedic intelligence. I am Bodhi, your personal guide through the ancient science of life. I will read your Prakriti, walk you through your daily rhythms, and speak with you in the language of your soul. Before we begin this journey together — please choose the language you feel most at home in.`;
const BODHI_INTRO_HI = `OneSUTRA में आपका स्वागत है — भारत की जीवित आयुर्वेदिक बुद्धिमत्ता। मैं बोधि हूँ, जीवन के इस प्राचीन विज्ञान में आपका मार्गदर्शक। मैं आपकी प्रकृति जानूँगा, आपकी दिनचर्या के साथ चलूँगा, और आपसे आपकी भाषा में बात करूँगा। इस यात्रा से पहले — वो भाषा चुनें जिसमें आप सबसे सहज हों।`;

const BODHI_GREET: Record<string, string> = {
  en: BODHI_INTRO_EN,
  hi: BODHI_INTRO_HI,
};

export default function LanguageScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<LangCode | null>(null);
  const [authBg, setAuthBg]      = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const orbPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => { getBgSource('auth').then(setAuthBg).catch(() => {}); }, []);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }).start();
    // Bodhi orb gentle pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(orbPulse, { toValue: 1.08, duration: 1800, useNativeDriver: false }),
        Animated.timing(orbPulse, { toValue: 1, duration: 1800, useNativeDriver: false }),
      ])
    ).start();
    // Greet in English by default — 1500ms gives Gemini Live time to stabilise on fresh app start
    setTimeout(() => speakBodhi(BODHI_GREET.en), 1500);
  }, []);

  const handleSelect = async (lang: typeof LANGUAGES[number]) => {
    if (!lang.available) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelected(lang.code);
    stopBodhi();
    speakBodhi(BODHI_GREET[lang.code] ?? BODHI_GREET.en);
  };

  const handleContinue = async () => {
    if (!selected) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await store.set(KEYS.language, selected);
    router.replace('/(auth)/onboarding');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#04020E' }}>
      <ImageBackground
        source={authBg ? { uri: authBg } : undefined}
        style={StyleSheet.absoluteFillObject}
        imageStyle={{ opacity: 0.18, resizeMode: 'cover' }}
      />
      <LinearGradient
        colors={['rgba(4,2,18,0.55)', 'rgba(4,2,18,0.82)', 'rgba(4,2,18,0.99)']}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <SafeAreaView style={{ flex: 1 }}>
        <Animated.View style={[{ flex: 1, opacity: fadeAnim }]}>
          <ScrollView
            contentContainerStyle={styles.root}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >

          {/* Bodhi Orb */}
          <Animated.View style={{ transform: [{ scale: orbPulse }] }}>
            <LinearGradient colors={['rgba(245,196,66,0.3)', 'rgba(245,196,66,0.1)']} style={styles.orb}>
              <Text style={styles.orbEmoji}>❆</Text>
            </LinearGradient>
          </Animated.View>

          <Text style={styles.title}>Choose Your Language</Text>
          <Text style={styles.sub}>Bodhi will speak in the language{'\n'}you choose, everywhere in the app.</Text>

          {/* Language Cards */}
          <View style={styles.list}>
            {LANGUAGES.map(lang => {
              const isSelected = selected === lang.code;
              return (
                <TouchableOpacity
                  key={lang.code}
                  onPress={() => handleSelect(lang)}
                  activeOpacity={lang.available ? 0.78 : 1}
                  style={[
                    styles.card,
                    isSelected && { borderColor: Colors.gold, backgroundColor: 'rgba(245,196,66,0.1)' },
                    !lang.available && { opacity: 0.38 },
                  ]}
                >
                  <Text style={styles.flag}>{lang.flag}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.langName, isSelected && { color: Colors.gold }]}>{lang.name}</Text>
                    <Text style={styles.langNative}>{lang.native}</Text>
                  </View>

                  {lang.available ? (
                    isSelected
                      ? <View style={styles.checkCircle}><Text style={styles.checkTxt}>✓</Text></View>
                      : <Text style={styles.arrow}>›</Text>
                  ) : (
                    <View style={styles.soonPill}>
                      <Text style={styles.soonTxt}>🔜 Soon</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Note */}
          <Text style={styles.note}>
            🌐 More languages coming soon — German, French & Japanese are on their way.
          </Text>

          {/* Continue */}
          <TouchableOpacity
            onPress={handleContinue}
            disabled={!selected}
            style={[styles.continueWrap, !selected && { opacity: 0.3 }]}
            activeOpacity={0.85}
          >
            <LinearGradient colors={['#D4A840', '#F5C842']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.continueBtn}>
              <Text style={styles.continueTxt}>Continue ›</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={{ height: 24 }} />
          </ScrollView>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexGrow: 1, paddingHorizontal: Spacing.lg, paddingTop: 20, paddingBottom: 16, alignItems: 'center', gap: 0 },
  orb: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  orbEmoji: { fontSize: 28, color: Colors.gold },
  title: { fontSize: 24, fontWeight: '900', color: Colors.text, textAlign: 'center', marginBottom: 6 },
  sub: { fontSize: Font.sizes.xs, color: Colors.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  list: { width: '100%', gap: 8, marginBottom: 10 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 13, borderRadius: Radius.xl,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  flag: { fontSize: 28 },
  langName: { fontSize: Font.sizes.base, fontWeight: '800', color: Colors.text, marginBottom: 2 },
  langNative: { fontSize: Font.sizes.xs, color: Colors.textMuted, fontWeight: '600' },
  checkCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center' },
  checkTxt: { fontSize: 14, fontWeight: '900', color: '#0A0A0F' },
  arrow: { fontSize: 22, color: 'rgba(255,255,255,0.28)' },
  soonPill: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', borderRadius: Radius.full, paddingHorizontal: 9, paddingVertical: 4 },
  soonTxt: { fontSize: 9, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.4 },
  note: { fontSize: 9, color: Colors.textDim, textAlign: 'center', lineHeight: 15, marginBottom: 16, paddingHorizontal: 10 },
  continueWrap: { width: '100%', borderRadius: Radius.full, overflow: 'hidden' },
  continueBtn: { paddingVertical: 15, alignItems: 'center' },
  continueTxt: { color: '#0A0A0F', fontSize: Font.sizes.base, fontWeight: '900', letterSpacing: 0.3 },
});
