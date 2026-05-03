import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Easing,
  Dimensions, StatusBar,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { speakBodhi } from '@/lib/speech';
import { store, KEYS } from '@/lib/storage';
import { Colors, Radius, Font, Spacing } from '@/constants/theme';

const { width, height } = Dimensions.get('window');

// ── Per-slot screen config ─────────────────────────────────────────────────────
const SCREENS: Record<string, {
  emoji: string; period: string; color: string; gradientEnd: string;
  headline: string; subhead: string; message: string;
  ctaLabel: string; speechKey: string;
}> = {
  'morning-start': {
    emoji: '🌅', period: 'KAPHA KALA · 6 AM – 10 AM', color: '#10b981', gradientEnd: '#064e3b',
    headline: 'Morning Rituals', subhead: 'Window is now open',
    message: 'This is the Kapha hour — your body is ready to move and your Agni wants to ignite. Drink warm water, greet the sun with Surya Namaskar, and set your Sankalpa for the day ahead.',
    ctaLabel: 'Start Morning Rituals →',
    speechKey: 'morning-start',
  },
  'checkin-reminder': {
    emoji: '💭', period: 'DAILY CHECK-IN · 8 AM', color: '#f59e0b', gradientEnd: '#451a03',
    headline: 'Bodhi Awaits', subhead: 'Your Ayurvedic guidance for today',
    message: 'Bodhi has prepared your personalized Dinacharya prescription based on your dosha, current season, and recent patterns. Your Ayurvedic day starts here.',
    ctaLabel: 'Begin Daily Check-In →',
    speechKey: 'checkin-reminder',
  },
  'morning-expiry': {
    emoji: '⏳', period: 'CLOSING IN 5 MINUTES', color: '#f59e0b', gradientEnd: '#451a03',
    headline: 'Morning Window Closing', subhead: 'Log before Kapha Kala ends',
    message: 'You have 5 minutes before the morning window closes at 10 AM. Log your morning habits now to protect your streak and maintain your Ojas.',
    ctaLabel: 'Log Now — 5 min left →',
    speechKey: 'morning-expiry',
  },
  'afternoon-start': {
    emoji: '🔥', period: 'PITTA KALA · 12 PM – 2 PM', color: '#f97316', gradientEnd: '#431407',
    headline: 'Peak Agni Hour', subhead: 'Your fire is at its strongest',
    message: 'Pitta noon is here. Your digestive fire is at its absolute peak. This is the time for your main meal, bold decisions, and deep focus work. Do not waste this window.',
    ctaLabel: 'Log Afternoon Habits →',
    speechKey: 'afternoon-start',
  },
  'afternoon-expiry': {
    emoji: '⏳', period: 'CLOSING IN 5 MINUTES', color: '#f97316', gradientEnd: '#431407',
    headline: 'Pitta Window Closing', subhead: 'Energy shifts to Vata soon',
    message: 'The Pitta noon hour ends in 5 minutes. Log your afternoon habits before the energy shifts to the Vata creative window.',
    ctaLabel: 'Log Now — 5 min left →',
    speechKey: 'afternoon-expiry',
  },
  'evening-start': {
    emoji: '🪔', period: 'VATA KALA · 6 PM – 10 PM', color: '#a78bfa', gradientEnd: '#1e1b4b',
    headline: 'Evening Wind-Down', subhead: 'Protect your Ojas tonight',
    message: 'The Kapha wind-down begins. Eat light, take a gentle walk, and put your screens away. Every choice you make now determines the quality of your sleep and overnight recovery.',
    ctaLabel: 'Log Evening Habits →',
    speechKey: 'evening-start',
  },
  'evening-expiry': {
    emoji: '⏳', period: 'CLOSING IN 5 MINUTES', color: '#a78bfa', gradientEnd: '#1e1b4b',
    headline: 'Evening Window Closing', subhead: 'Last chance to log today',
    message: 'The evening wind-down window ends in 5 minutes. Log your habits and seal your Ojas before the night deepens.',
    ctaLabel: 'Log Now — 5 min left →',
    speechKey: 'evening-expiry',
  },
  'brahma-muhurta': {
    emoji: '🌑', period: 'BRAHMA MUHURTA · 4:45 AM', color: '#818cf8', gradientEnd: '#1e1b4b',
    headline: 'Sacred Hour Begins', subhead: 'The cosmos is completely silent',
    message: 'Brahma Muhurta — the most auspicious window of the entire day opens in 15 minutes. The world is asleep. Rise, set your Sankalpa, and meditate. This is the time the universe speaks.',
    ctaLabel: 'Begin Meditation →',
    speechKey: 'brahma-muhurta',
  },
};

const FALLBACK = {
  emoji: '✦', period: 'ONESUTRA', color: Colors.gold, gradientEnd: '#1c1400',
  headline: 'SolRize Reminder', subhead: 'Your Ayurvedic day needs you',
  message: 'Open the app to log your habits and stay aligned with your Dinacharya.',
  ctaLabel: 'Open SolRize →', speechKey: ''
};

export default function NotificationLandingScreen() {
  const router = useRouter();
  const { slotId } = useLocalSearchParams<{ slotId: string }>();
  const cfg = SCREENS[slotId ?? ''] ?? FALLBACK;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
    ]).start();

    // Pulse the glow orb
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.92, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    ).start();

    // Glow opacity pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 0.75, duration: 2000, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.35, duration: 2000, useNativeDriver: true }),
      ]),
    ).start();

    // Haptic welcome
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Bodhi speaks
    if (cfg.speechKey) {
      setTimeout(async () => {
        const lang = (await store.get(KEYS.language)) ?? 'en';
        const { NOTIFICATION_SPEECHES } = await import('@/lib/notifications');
        const scripts = NOTIFICATION_SPEECHES[cfg.speechKey];
        if (scripts) speakBodhi(scripts[lang] ?? scripts['en']);
      }, 900);
    }
  }, []);

  const openApp = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.replace('/(tabs)' as never);
  };

  const dismiss = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace('/(tabs)' as never);
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Background gradient */}
      <LinearGradient
        colors={[Colors.bg, cfg.gradientEnd, Colors.bg] as any}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Large radial glow behind emoji */}
      <Animated.View style={[s.glowBg, {
        backgroundColor: cfg.color + '1a',
        opacity: glowAnim,
        transform: [{ scale: pulseAnim }],
      }]} />

      <SafeAreaView style={s.safe}>
        <Animated.View style={[s.content, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>

          {/* ── Top spacer ── */}
          <View style={{ flex: 1 }} />

          {/* ── Emoji orb ── */}
          <Animated.View style={[s.emojiRing, {
            borderColor: cfg.color + '40',
            backgroundColor: cfg.color + '12',
            transform: [{ scale: pulseAnim }],
          }]}>
            <View style={[s.emojiInner, { borderColor: cfg.color + '30' }]}>
              <Text style={s.emoji}>{cfg.emoji}</Text>
            </View>
          </Animated.View>

          {/* ── Period badge ── */}
          <View style={[s.periodBadge, { backgroundColor: cfg.color + '18', borderColor: cfg.color + '45' }]}>
            <Text style={[s.periodText, { color: cfg.color }]}>{cfg.period}</Text>
          </View>

          {/* ── Headline ── */}
          <Text style={s.headline}>{cfg.headline}</Text>
          <Text style={s.subhead}>{cfg.subhead}</Text>

          {/* ── Divider ── */}
          <View style={[s.divider, { backgroundColor: cfg.color + '30' }]} />

          {/* ── Message ── */}
          <View style={[s.messageCard, { borderColor: cfg.color + '20' }]}>
            <Text style={s.message}>{cfg.message}</Text>
          </View>

          {/* ── Bottom spacer ── */}
          <View style={{ flex: 1 }} />

          {/* ── CTA ── */}
          <View style={s.actions}>
            <TouchableOpacity onPress={openApp} activeOpacity={0.85}
              style={[s.ctaBtn, { backgroundColor: cfg.color }]}>
              <Text style={s.ctaText}>{cfg.ctaLabel}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={dismiss} activeOpacity={0.7} style={s.dismissBtn}>
              <Text style={[s.dismissText, { color: cfg.color + '80' }]}>Not now</Text>
            </TouchableOpacity>
          </View>

          {/* ── Brand footer ── */}
          <Text style={s.footer}>SolRize · Rise with the sun · Dinacharya System · Ayurvedic Intelligence</Text>
          <View style={{ height: 8 }} />
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  safe: { flex: 1 },
  content: { flex: 1, alignItems: 'center', paddingHorizontal: Spacing.xl },
  glowBg: {
    position: 'absolute',
    width: width * 1.4,
    height: width * 1.4,
    borderRadius: width * 0.7,
    top: height * 0.1,
    alignSelf: 'center',
  },
  emojiRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emojiInner: {
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 58 },
  periodBadge: {
    borderRadius: 99,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginBottom: 16,
  },
  periodText: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  headline: {
    fontSize: 36,
    fontWeight: '900',
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 42,
    marginBottom: 6,
  },
  subhead: {
    fontSize: 15,
    color: Colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 24,
  },
  divider: { width: 60, height: 2, borderRadius: 1, marginBottom: 20 },
  messageCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    width: '100%',
  },
  message: {
    fontSize: Font.sizes.base,
    color: Colors.textSub,
    lineHeight: 24,
    textAlign: 'center',
  },
  actions: { width: '100%', gap: 10, marginBottom: 12 },
  ctaBtn: {
    borderRadius: Radius.full,
    paddingVertical: 17,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  ctaText: { color: '#0A0A0F', fontSize: 16, fontWeight: '900', letterSpacing: 0.3 },
  dismissBtn: { alignItems: 'center', paddingVertical: 10 },
  dismissText: { fontSize: 13, fontWeight: '600' },
  footer: {
    fontSize: 9,
    color: Colors.textDim,
    textAlign: 'center',
    letterSpacing: 0.5,
    opacity: 0.6,
  },
});
