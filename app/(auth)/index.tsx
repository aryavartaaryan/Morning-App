import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ImageBackground,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
  Animated, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius, Font } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useGoogleAuth, GoogleAuthResult } from '@/lib/googleAuth';
import { getBgSource } from '@/lib/bgImages';

const { width, height } = Dimensions.get('window');

const FEATURES = [
  { emoji: '🔥', title: 'Streak', sub: 'Your daily fire streak' },
  { emoji: '🌿', title: 'Pranic Feed', sub: 'Vedic wisdom videos' },
  { emoji: '❤️', title: 'Health Monitor', sub: 'Body + mind tracking' },
  { emoji: '📋', title: 'Daily Log', sub: 'Log your sacred habits' },
  { emoji: '🎵', title: 'Sacred Chants', sub: 'Healing mantra library' },
  { emoji: '🤖', title: 'Bodhi AI', sub: '24/7 Sakha, companion & life manager' },
];

const TAGS = ['Streak', 'Pranic Feeds', 'Health Monitor', 'Daily Log', 'Bodhi AI', 'All In One'];

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, signUp } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [authBg, setAuthBg]   = useState<string | null>(null);
  const slideAnim = useRef(new Animated.Value(height)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => { getBgSource('auth').then(setAuthBg).catch(() => {}); }, []);

  // ── Google Sign-In handler ──────────────────────────────────────────────────
  const handleGoogleResult = (result: GoogleAuthResult) => {
    if (result.success) {
      if (result.isNewUser) {
        // New user → full onboarding (Prakriti quiz + GPS + pledge)
        router.replace('/(auth)/onboarding');
      } else {
        // Returning user → straight to home
        // AuthGuard will catch incomplete onboarding via onboardingComplete flag
        router.replace('/(tabs)');
      }
      return;
    }
    // Cancelled → do nothing (silent)
    if (result.error === 'cancelled') return;

    // Network error
    if (result.error === 'network_error') {
      Alert.alert(
        'No Internet',
        'No internet connection. Please check your connection and try again.',
        [{ text: 'OK' }],
      );
      return;
    }

    // All other errors
    Alert.alert(
      'Sign In Failed',
      'Something went wrong signing in with Google. Please try again.',
      [{ text: 'OK' }],
    );
  };

  const { promptAsync, loading: googleAuthLoading } = useGoogleAuth({ onResult: handleGoogleResult });

  // ── Email/Password handler ─────────────────────────────────────────────────
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
  }, []);

  const openForm = () => {
    setShowForm(true);
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
  };

  const closeForm = () => {
    Animated.timing(slideAnim, { toValue: height, duration: 280, useNativeDriver: true }).start(() => setShowForm(false));
  };

  const handle = async () => {
    if (!email || !password) return Alert.alert('Missing fields', 'Please fill all fields.');
    setLoading(true);
    try {
      if (mode === 'login') {
        await signIn(email, password);
      } else {
        if (!name) return Alert.alert('Missing name', 'Please enter your name.');
        await signUp(name, email, password);
        router.replace('/(auth)/onboarding');
        return;
      }
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#04020E' }}>
      <ImageBackground source={authBg ? { uri: authBg } : undefined} style={StyleSheet.absoluteFillObject} imageStyle={{ opacity: 0.28, resizeMode: 'cover' }} />
      <LinearGradient
        colors={['rgba(4,2,18,0.55)', 'rgba(4,2,18,0.72)', 'rgba(4,2,18,0.96)']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={{ flex: 1, paddingHorizontal: Spacing.lg, paddingTop: 14 }}>

            {/* ── Top badge row ── */}
            <View style={styles.topRow}>
              <View style={styles.appPill}>
                <View style={styles.pillDot} />
                <Text style={styles.pillTxt}>ONESUTRA</Text>
              </View>
              <View style={styles.eraPill}>
                <Text style={styles.eraTxt}>ANCIENT WISDOM · MODERN ERA</Text>
              </View>
            </View>

            {/* ── Hero copy ── */}
            <View style={{ marginBottom: 14 }}>
              <Text style={styles.losSub}>LIFE OPERATING SYSTEM</Text>
              <View style={styles.tagsRow}>
                {['Streak', 'Pranic Feed', 'Health', 'Bodhi AI'].map(t => (
                  <Text key={t} style={styles.heroTag}>{t} ·</Text>
                ))}
              </View>
              <Text style={[styles.brokenLine, { fontSize: 16 }]}>Social Media is Broken.</Text>
              <View style={styles.fixedRow}>
                <View style={styles.fixedLine} />
                <Text style={styles.fixedTxt}>WE FIXED IT</Text>
                <View style={styles.fixedLine} />
              </View>
              <Text style={[styles.appNameHero, { fontSize: 40, marginBottom: 6 }]}>
                <Text style={styles.appNameOne}>One</Text>
                <Text style={styles.appNameSutra}>SUTRA</Text>
              </Text>
              <Text style={[styles.appSubtitle, { fontSize: 13 }]}>
                Not an app.{' '}
                <Text style={{ color: Colors.text, fontWeight: '800' }}>A complete Life Operating System.</Text>
              </Text>
            </View>

            {/* ── Feature cards grid — 2 per row, all 6 ── */}
            <View style={{ gap: 7, marginBottom: 8 }}>
              {[0, 2, 4].map(row => (
                <View key={row} style={{ flexDirection: 'row', gap: 7 }}>
                  {FEATURES.slice(row, row + 2).map(f => (
                    <LinearGradient
                      key={f.title}
                      colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)']}
                      style={{ flex: 1, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', padding: 12, alignItems: 'center' }}
                    >
                      <Text style={{ fontSize: 24, marginBottom: 5 }}>{f.emoji}</Text>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: Colors.text, textAlign: 'center', marginBottom: 2 }}>{f.title}</Text>
                      <Text style={{ fontSize: 9, color: Colors.textMuted, textAlign: 'center', lineHeight: 12 }}>{f.sub}</Text>
                    </LinearGradient>
                  ))}
                </View>
              ))}
            </View>

          </View>

          {/* ── CTA buttons — always visible at bottom ── */}
          <View style={styles.ctaFixed}>

            {/* ── Google Sign-In button ── */}
            <TouchableOpacity
              style={[styles.googleBtn, googleAuthLoading && styles.googleBtnDisabled]}
              onPress={promptAsync}
              disabled={googleAuthLoading}
              activeOpacity={0.82}
            >
              {googleAuthLoading ? (
                <ActivityIndicator color="#4285F4" size="small" />
              ) : (
                <>
                  {/* Inline Google G colour dots — no external image needed */}
                  <View style={styles.googleIconWrap}>
                    <Text style={styles.googleIconText}>G</Text>
                  </View>
                  <Text style={styles.googleBtnTxt}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>

            {/* ── Divider ── */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerTxt}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* ── Original email/password CTAs ── */}
            <View style={styles.emailCtaRow}>
              <TouchableOpacity style={styles.ctaSecondary} onPress={() => { setMode('login'); openForm(); }} activeOpacity={0.8}>
                <Text style={styles.ctaSecondaryTxt}>Sign In</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setMode('signup'); openForm(); }} activeOpacity={0.85} style={styles.ctaPrimaryWrap}>
                <LinearGradient colors={['#D4A840', '#F5C842']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaPrimary}>
                  <Text style={styles.ctaPrimaryTxt}>Get Started ❖</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

          </View>
        </SafeAreaView>
      </Animated.View>


      {/* ── Auth form bottom sheet ── */}
      {showForm && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
          {/* Backdrop */}
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={closeForm} />
          <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.sheetHandle} />

            {/* Mode toggle */}
            <View style={styles.toggleRow}>
              {(['login', 'signup'] as const).map(m => (
                <TouchableOpacity key={m} onPress={() => setMode(m)} style={[styles.toggleBtn, mode === m && styles.toggleActive]}>
                  <Text style={[styles.toggleTxt, mode === m && styles.toggleTxtActive]}>
                    {m === 'login' ? 'Sign In' : 'Sign Up'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sheetTitle}>
              {mode === 'login' ? 'Welcome back 🙏' : 'Begin your journey ✦'}
            </Text>

            {mode === 'signup' && (
              <TextInput style={styles.input} placeholder="Your name" placeholderTextColor={Colors.textMuted}
                value={name} onChangeText={setName} autoCapitalize="words" />
            )}
            <TextInput style={styles.input} placeholder="Email address" placeholderTextColor={Colors.textMuted}
              value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            <TextInput style={styles.input} placeholder="Password" placeholderTextColor={Colors.textMuted}
              value={password} onChangeText={setPassword} secureTextEntry />

            <TouchableOpacity onPress={handle} disabled={loading} style={styles.submitWrap} activeOpacity={0.85}>
              <LinearGradient colors={['#D4A840', '#F5C842']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submitBtn}>
                {loading
                  ? <ActivityIndicator color="#0A0A0F" />
                  : <Text style={styles.submitTxt}>{mode === 'login' ? 'Enter Sanctuary ✦' : 'Create Account ✦'}</Text>
                }
              </LinearGradient>
            </TouchableOpacity>

            <Text style={styles.switchTxt}>
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <Text style={styles.switchLink} onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}>
                {mode === 'login' ? 'Sign Up' : 'Sign In'}
              </Text>
            </Text>
          </Animated.View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const GAP = 10;
const CARD_W = (width - Spacing.lg * 2 - GAP) / 2;

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: Spacing.lg, paddingTop: 16, paddingBottom: 110 },

  // Top badges
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  appPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 6 },
  pillDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#22c55e' },
  pillTxt: { fontSize: 11, fontWeight: '800', color: Colors.text, letterSpacing: 1.5 },
  eraPill: { borderWidth: 1, borderColor: 'rgba(212,168,64,0.35)', borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 5 },
  eraTxt: { fontSize: 9, fontWeight: '700', color: Colors.gold, letterSpacing: 0.8 },

  // Hero section
  heroSection: { marginBottom: 24 },
  losSub: { fontSize: 11, fontWeight: '800', color: Colors.textMuted, letterSpacing: 2, marginBottom: 6 },
  tagsRow: { flexDirection: 'row', marginBottom: 18, flexWrap: 'wrap' },
  heroTag: { fontSize: 11, color: Colors.textDim, marginRight: 2 },

  brokenLine: { fontSize: 22, fontWeight: '700', color: Colors.textMuted, textDecorationLine: 'line-through', marginBottom: 6 },
  fixedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  fixedLine: { flex: 1, height: 1, backgroundColor: Colors.gold + '60' },
  fixedTxt: { fontSize: 13, fontWeight: '900', color: Colors.gold, letterSpacing: 2 },

  appNameHero: { fontSize: 52, fontWeight: '900', letterSpacing: -2, marginBottom: 10, lineHeight: 58 },
  appNameOne: { color: Colors.text },
  appNameSutra: { color: Colors.gold },

  appSubtitle: { fontSize: 15, color: Colors.textMuted, lineHeight: 22, marginBottom: 14 },

  tagScrollWrap: { marginBottom: 4 },
  tagPill: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 5, marginRight: 7 },
  tagPillTxt: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },

  // Feature grid (2 per row)
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 18 },
  featureCard: { width: CARD_W, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 14, alignItems: 'center', marginBottom: GAP },
  featureEmoji: { fontSize: 26, marginBottom: 6 },
  featureTitle: { fontSize: 11, fontWeight: '800', color: Colors.text, textAlign: 'center', marginBottom: 3 },
  featureSub: { fontSize: 9, color: Colors.textMuted, textAlign: 'center', lineHeight: 13 },

  // Chip bar
  chipBar: { flexDirection: 'row', justifyContent: 'space-between', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 10, marginBottom: 22, backgroundColor: 'rgba(255,255,255,0.03)' },
  chipBarItem: {},
  chipBarTxt: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.3 },

  // CTA (fixed bottom bar)
  // CTA fixed bottom bar — now vertical stack
  ctaFixed: {
    flexDirection: 'column', gap: 0,
    paddingHorizontal: Spacing.lg, paddingTop: 12, paddingBottom: 24,
    backgroundColor: 'rgba(4,2,18,0.96)',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)',
  },

  // Google Sign-In button
  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 52, borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.18)',
    marginBottom: 0,
    shadowColor: '#4285F4', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.18, shadowRadius: 8,
    elevation: 2,
  },
  googleBtnDisabled: { opacity: 0.55 },
  googleIconWrap: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 10,
  },
  googleIconText: { fontSize: 14, fontWeight: '900', color: '#4285F4', lineHeight: 20 },
  googleBtnTxt: { fontSize: 15, fontWeight: '700', color: Colors.text, letterSpacing: 0.1 },

  // Divider
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  dividerTxt: { marginHorizontal: 12, fontSize: 11, color: Colors.textMuted, fontWeight: '600', letterSpacing: 0.5 },

  // Email CTA row (Sign In + Get Started)
  emailCtaRow: { flexDirection: 'row', gap: 10 },
  ctaSecondary: { flex: 1, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)', borderRadius: Radius.full, paddingVertical: 15, alignItems: 'center' },
  ctaSecondaryTxt: { color: Colors.text, fontSize: Font.sizes.base, fontWeight: '700' },
  ctaPrimaryWrap: { flex: 1.4, borderRadius: Radius.full, overflow: 'hidden' },
  ctaPrimary: { paddingVertical: 15, alignItems: 'center' },
  ctaPrimaryTxt: { color: '#0A0A0F', fontSize: Font.sizes.base, fontWeight: '900', letterSpacing: 0.3 },

  // Bottom sheet
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#111118',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: Spacing.lg, paddingBottom: 40,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
  },
  sheetHandle: { width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 2, alignSelf: 'center', marginBottom: 18 },
  sheetTitle: { fontSize: Font.sizes.base, fontWeight: '700', color: Colors.text, marginBottom: 16 },
  toggleRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: Radius.full, padding: 4, marginBottom: 16 },
  toggleBtn: { flex: 1, paddingVertical: 9, borderRadius: Radius.full, alignItems: 'center' },
  toggleActive: { backgroundColor: Colors.gold },
  toggleTxt: { fontSize: Font.sizes.sm, fontWeight: '600', color: Colors.textMuted },
  toggleTxtActive: { color: '#0A0A0F', fontWeight: '800' },
  input: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: Radius.md, padding: 14, color: Colors.text, fontSize: Font.sizes.base, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 11 },
  submitWrap: { borderRadius: Radius.full, overflow: 'hidden', marginTop: 4 },
  submitBtn: { paddingVertical: 16, alignItems: 'center' },
  submitTxt: { color: '#0A0A0F', fontSize: Font.sizes.base, fontWeight: '900', letterSpacing: 0.3 },
  switchTxt: { textAlign: 'center', marginTop: 14, fontSize: Font.sizes.sm, color: Colors.textMuted },
  switchLink: { color: Colors.gold, fontWeight: '700' },
});
