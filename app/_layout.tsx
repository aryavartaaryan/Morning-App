'use client';
import { Component, useEffect, useRef, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, AppState, View, Animated, Dimensions, StyleSheet, Text, NativeModules, Linking, TouchableOpacity, Easing, Image, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import {
  Nunito_300Light, Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold,
  Nunito_800ExtraBold, Nunito_900Black,
} from '@expo-google-fonts/nunito';
import { DancingScript_600SemiBold } from '@expo-google-fonts/dancing-script';
import * as SplashScreen from 'expo-splash-screen';
import { useRouter, useSegments, useRootNavigationState } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import { store, KEYS } from '@/lib/storage';

import { ensureAllBgsCachedWithProgress, getBgSourceSync, ensureBgKey, isBgFullyCached, isSplashCached, bgWarmup, BG_URLS } from '@/lib/bgImages';
import { prefetchAllSoundImagesWithProgress, warmSoundImageMap, prefetchCriticalAlarmImages } from '@/lib/soundImagePreload';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

import { scheduleHabitReminders, setupNotificationChannel, NOTIFICATION_SPEECHES } from '@/lib/notifications';
import { getInitialAlarmNotification, requestAllAlarmPermissions, checkAndRescheduleDaily, syncNativeWakeAlarmSound, ALARM_NOTIF_ID } from '@/lib/nativeAlarm';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { scheduleAllNativeReminders, getInitialReminderNotification, REMINDER_DATA_TYPE } from '@/lib/nativeReminders';
import { speakBodhi } from '@/lib/speech';
import { Colors } from '@/constants/theme';
import { ensureAllMantrasDownloaded } from '@/lib/mantraDownload';
import { Audio, Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { SoundPlayerProvider, useSoundPlayer } from '@/lib/soundPlayerContext';
import { BgProvider } from '@/lib/bgContext';
import { MoodSheet } from '@/components/MoodSheet';
import { CrashToast } from '@/components/CrashToast';
import { ScreenErrorBoundary } from '@/components/ScreenErrorBoundary';
import { installCrashToast, ToastLogger } from '@/lib/toastLogger';
import { installCrashShield } from '@/lib/crashShield';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import type { MoodKey } from '@/components/MoodSheet';
import { HeroGeometricAnimation } from '@/components/HeroGeometricAnimation';

// Prevent the native splash from auto-hiding.
// We dismiss it dynamically when leaving the 'gate' phase to avoid flashes.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Install master crash shield as early as possible (belt-and-suspenders;
// index.js already calls this first, but this ensures it even in Expo Go / web)
installCrashShield();
// Install global crash logger as early as possible (before any component mounts)
installCrashToast();

// ─── React render-tree error boundary ────────────────────────────────────────
class AppErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean; errorMsg: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMsg: error?.message ?? String(error) };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    const stack = info?.componentStack?.slice(0, 300) ?? '';
    try {
      ToastLogger.push(
        `🔴 RENDER ERROR\n${error?.message ?? String(error)}\n${stack}`,
        'crash'
      );
    } catch { /* silent — logger itself must never throw */ }
  }

  resetError = () => {
    this.setState({ hasError: false, errorMsg: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#0A0005', alignItems: 'center', justifyContent: 'center', padding: 28 }}>
          <Text style={{ fontSize: 36, marginBottom: 14 }}>💥</Text>
          <Text style={{ fontSize: 16, fontWeight: '800', color: '#ef4444', textAlign: 'center', marginBottom: 10 }}>Render Crash</Text>
          <Text style={{ fontSize: 11, color: '#FFFFFF45', textAlign: 'center', fontFamily: 'monospace', lineHeight: 18 }} selectable>
            {this.state.errorMsg}
          </Text>
          
          <TouchableOpacity 
            onPress={this.resetError}
            style={{ marginTop: 32, backgroundColor: 'rgba(239, 68, 68, 0.15)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' }}
          >
            <Text style={{ color: '#ef4444', fontWeight: '700', fontSize: 14, letterSpacing: 1 }}>RECOVER & RELOAD</Text>
          </TouchableOpacity>

          <Text style={{ fontSize: 10, color: '#FFFFFF20', marginTop: 24 }}>See toast overlay for full details</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const { height: SH, width: SW } = Dimensions.get('window');

function SplashOverlay({ onDone, bgUri }: { onDone: () => void; bgUri?: string }) {
  // "Nada" text (starts visible to seamlessly match native splash, then fades out)
  const titleOp  = useRef(new Animated.Value(1)).current;
  const titleSc  = useRef(new Animated.Value(1)).current;
  
  const footerOp = useRef(new Animated.Value(0)).current;
  const shimmerOp = useRef(new Animated.Value(0)).current;
  
  const screenOp = useRef(new Animated.Value(1)).current;
  const screenSc = useRef(new Animated.Value(1.0)).current;

  const mantraOp = useRef(new Animated.Value(0)).current;
  const mantraTy = useRef(new Animated.Value(20)).current;
  const mantraSc = useRef(new Animated.Value(0.95)).current;

  // Animation sequence starts after component mounts
  useEffect(() => {
    let mounted = true;
    // Initial delay to let the app settle
    const initialDelay = setTimeout(() => {
      Animated.timing(footerOp, { toValue: 1, duration: 600, useNativeDriver: true }).start();

      Animated.sequence([
        Animated.delay(600),
        Animated.timing(shimmerOp, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.parallel([
           Animated.timing(mantraOp, { toValue: 1, duration: 1200, useNativeDriver: true }),
           Animated.timing(mantraTy, { toValue: 0, duration: 1200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
           Animated.timing(mantraSc, { toValue: 1, duration: 1200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.delay(5000), // Hold for a full 5 seconds so the user can absorb the mantra and geometry
      ]).start(() => {
        if (!mounted) return;
        import('react-native').then(({ DeviceEventEmitter }) => {
          DeviceEventEmitter.emit('splashFadeOut');
        });
        
        // Dismiss Splash
        Animated.parallel([
          Animated.timing(titleOp, { toValue: 0, duration: 800, useNativeDriver: true }),
          Animated.timing(titleSc, { toValue: 1.05, duration: 800, useNativeDriver: true }),
          Animated.timing(screenOp, { toValue: 0, duration: 800, useNativeDriver: true }),
          Animated.timing(screenSc, { toValue: 0.94, duration: 800, useNativeDriver: true }),
        ]).start(({ finished }) => {
          if (mounted && finished) onDone();
        });
      });
    }, 150);

    return () => {
      mounted = false;
      clearTimeout(initialDelay);
    };
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      style={[SS.overlay, { opacity: screenOp, transform: [{ scale: screenSc }] }]}
    >
      {/* Background Video matching Setup Screen */}
      <View style={{ position: 'absolute', top: 0, left: 0, width: SW, height: SH, backgroundColor: '#020617' }} />
      <Video 
        source={require('../assets/videos/splash.mp4')}
        style={{ position: 'absolute', top: 0, left: 0, width: SW, height: SH, opacity: 0.85 }}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping
        isMuted
      />
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(2, 6, 23, 0.85)' }]} />
      {/* Deep cosmic vignette: radial darkening from edges */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,6,0.30)' }]} />
      
      {/* Center Content */}
      <View style={SS.center}>
        
        {/* Cosmic Nebula Glow — deep indigo radiance behind geometry */}
        <Animated.View style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          alignItems: 'center', justifyContent: 'center',
          opacity: titleOp,
        }}>
          {/* Outer nebula bloom */}
          <View style={{
            width: SW * 1.1, height: SW * 1.1,
            borderRadius: SW * 0.55,
            backgroundColor: 'rgba(30,20,90,0.32)',
            position: 'absolute',
          }} />
          {/* Inner deep core */}
          <View style={{
            width: SW * 0.65, height: SW * 0.65,
            borderRadius: SW * 0.325,
            backgroundColor: 'rgba(55,30,140,0.22)',
            position: 'absolute',
          }} />
        </Animated.View>

        {/* Cosmic Geometric Animation — grand layered universe */}
        <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', opacity: titleOp, transform: [{ scale: titleSc }] }}>
          <HeroGeometricAnimation size={SW * 0.92} variant="splash" opacity={0.55} />
        </Animated.View>

        {/* The Native-Matching "NADA" Text combined with message, styled like Setup Screen */}
        <Animated.View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center', opacity: titleOp, transform: [{ scale: titleSc }] }}>
          <Text style={{ 
            fontSize: 42, 
            fontFamily: 'Nunito_900Black', 
            color: '#bfdbfe', 
            letterSpacing: 16, 
            textShadowColor: '#60a5fa',
            textShadowRadius: 12,
            textShadowOffset: { width: 0, height: 0 },
            opacity: 0.95 
          }}>SVARA</Text>
          
          <Text style={{ 
            fontSize: 12, 
            color: '#60a5fa', 
            fontFamily: 'Nunito_800ExtraBold', 
            letterSpacing: 8, 
            marginTop: 6,
            opacity: 0.85
          }}>THE RESONANCE</Text>
          
          <View style={{ marginTop: 56, alignItems: 'center', position: 'relative' }}>
            <Text style={{ 
              fontSize: 22, 
              color: 'rgba(255,255,255,0.7)', 
              fontFamily: 'DancingScript_600SemiBold', 
              letterSpacing: 1, 
              textAlign: 'center', 
              lineHeight: 32 
            }}>
              Resonate & Transform{'\n'}through Svara.
            </Text>
            <Animated.Text style={{ 
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              fontSize: 22, 
              color: '#ffffff', 
              fontFamily: 'DancingScript_600SemiBold', 
              letterSpacing: 1, 
              textAlign: 'center', 
              lineHeight: 32,
              opacity: shimmerOp 
            }}>
              Resonate & Transform{'\n'}through Svara.
            </Animated.Text>
          </View>

          {/* Mantra with translation - Ultra Premium Layout */}
          <Animated.View style={{ marginTop: 36, opacity: mantraOp, transform: [{ translateY: mantraTy }, { scale: mantraSc }], alignItems: 'center', paddingHorizontal: 20 }}>
            {/* Devanagari Script - Large, elegant, slightly transparent anchor */}
            <Text style={{ fontSize: 20, color: 'rgba(255,255,255,0.45)', textAlign: 'center', lineHeight: 32, marginBottom: 14, fontWeight: '400', letterSpacing: 2, textShadowColor: 'rgba(255, 255, 255, 0.2)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 }}>
              असतो मा सद्गमय ।{'\n'}तमसो मा ज्योतिर्गमय ।{'\n'}मृत्योर्मा अमृतं गमय ॥
            </Text>
            
            {/* Transliteration */}
            <Text style={{ fontSize: 13, color: '#bfdbfe', fontFamily: 'Nunito_600SemiBold', textAlign: 'center', lineHeight: 22, fontStyle: 'italic', opacity: 0.95, letterSpacing: 1 }}>
              "Asato Ma Sadgamaya, Tamaso Ma Jyotir Gamaya,{'\n'}Mrityor Ma Amritam Gamaya"
            </Text>
            
            {/* Translation */}
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontFamily: 'Nunito_400Regular', textAlign: 'center', lineHeight: 18, marginTop: 12, letterSpacing: 0.8, textTransform: 'uppercase' }}>
              Lead us from the unreal to the real,{'\n'}from darkness to light, from death to immortality.
            </Text>
          </Animated.View>
        </Animated.View>
        
      </View>
      
      {/* Footer */}
      <Animated.Text style={[SS.version, { opacity: footerOp }]}>SVARA  ·  V 1.0</Animated.Text>
    </Animated.View>
  );
}

const SS = StyleSheet.create({
  overlay:    { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, backgroundColor: '#04030F', alignItems: 'center' },
  bgOverlay:  { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(4,3,15,0.42)' },
  glowOrb:    { position: 'absolute', top: SH * 0.22, alignSelf: 'center', width: 360, height: 360, borderRadius: 180, backgroundColor: '#F5820A' },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  arise:      { fontSize: 72, color: '#FFFFFF', fontFamily: 'DancingScript_600SemiBold', letterSpacing: 6 },
  subBlock:   { alignItems: 'center', gap: 14, width: '100%', paddingHorizontal: 20 },
  newMainTitle: { fontSize: 36, fontFamily: 'DancingScript_600SemiBold', color: '#FFFFFF', textAlign: 'center', lineHeight: 46 },
  tagline:    { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.45)', letterSpacing: 4, textAlign: 'center' },
  taglineSub: { fontSize: 9, fontWeight: '600', color: 'rgba(255,255,255,0.25)', letterSpacing: 2, textAlign: 'center', marginTop: -6 },
  accentLine: { width: 64, height: 1.5, backgroundColor: '#F5820A', opacity: 0.70, borderRadius: 1 },
  version:    { fontSize: 9, color: 'rgba(255,255,255,0.15)', letterSpacing: 5, fontWeight: '600', paddingBottom: 50 },
});

// ─── Download progress screen (first-install gate) ─────────────────────────

const SETUP_SUBTITLES = [
  'Your life in New Transformation journey is starting from Today',
  'Just listen the Nada sounds...',
  'नाद — The primordial sound of the universe',
  "Align your rhythm with the universe's wisdom",
  'A new dawn of conscious living awaits you',
];

function PremiumSurveyOption({ 
  label, 
  isSelected, 
  onPress,
  isMultiple = false
}: { 
  label: string; 
  isSelected: boolean; 
  onPress: () => void;
  isMultiple?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  
  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.95, useNativeDriver: true }).start();
  };
  
  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, friction: 4, tension: 40, useNativeDriver: true }).start();
  };

  const handlePress = () => {
    Haptics.selectionAsync().catch(()=>{});
    onPress();
  };

  return (
    <Animated.View style={{ transform: [{ scale }], marginRight: 10, marginBottom: 12 }}>
      <TouchableOpacity 
        activeOpacity={1} 
        onPressIn={handlePressIn} 
        onPressOut={handlePressOut} 
        onPress={handlePress}
      >
        <BlurView 
          intensity={isSelected ? 60 : 20} 
          tint={isSelected ? "light" : "dark"} 
          style={{ 
            borderRadius: 24, 
            overflow: 'hidden', 
            borderWidth: 1, 
            borderColor: isSelected ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.15)',
            backgroundColor: isSelected ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.4)',
          }}
        >
          <View style={{ paddingVertical: 12, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ 
              color: isSelected ? '#000000' : 'rgba(255,255,255,0.85)', 
              fontFamily: isSelected ? 'Nunito_800ExtraBold' : 'Nunito_600SemiBold', 
              fontSize: 15,
              letterSpacing: 0.3
            }}>
              {label}
            </Text>
          </View>
        </BlurView>
      </TouchableOpacity>
    </Animated.View>
  );
}

function OnboardingSurveyScreen({ onComplete }: { onComplete: () => void }) {
  const [q1, setQ1] = useState<string[]>([]);
  const [q2, setQ2] = useState<string | null>(null);
  const [q3, setQ3] = useState<string | null>(null);
  const [q4, setQ4] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const contentFade = useRef(new Animated.Value(1)).current;
  const contentTranslate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 1000, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, []);

  const tags1 = ['Reduce Stress', 'Regain Focus', 'Digital Detox', 'Reduce Brain Fog', 'Reconnect with Nature', 'Improve Sleep'];
  const tags2 = ['Mostly Sedentary', 'Lightly Active', 'Very Active'];
  const tags3 = ['Groggy & Tired', 'Rushed & Anxious', 'Rested but Slow', 'Energized'];
  const tags4 = ['Lack of Time', 'Inconsistent Motivation', 'High Stress', 'Poor Sleep'];

  const canContinueStep = 
    (step === 0 && q1.length > 0) ||
    (step === 1 && q3 !== null) ||
    (step === 2 && q4 !== null) ||
    (step === 3 && q2 !== null);

  const toggleQ1 = (tag: string) => {
    setQ1(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const goToStep = (newStep: number, direction: 'forward' | 'backward' = 'forward') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(()=>{});
    Animated.parallel([
      Animated.timing(contentFade, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(contentTranslate, { toValue: direction === 'forward' ? -20 : 20, duration: 250, easing: Easing.in(Easing.ease), useNativeDriver: true })
    ]).start(() => {
      setStep(newStep);
      contentTranslate.setValue(direction === 'forward' ? 20 : -20);
      Animated.parallel([
        Animated.timing(contentFade, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(contentTranslate, { toValue: 0, duration: 350, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true })
      ]).start();
    });
  };

  const handleNext = () => {
    if (step < 3) goToStep(step + 1, 'forward');
    else handleComplete();
  };

  const handleBack = () => {
    if (step > 0) goToStep(step - 1, 'backward');
  };

  const handleSelectSingle = (setter: (val: string) => void, val: string, autoAdvanceStep?: number) => {
    setter(val);
    if (autoAdvanceStep !== undefined) {
      setTimeout(() => goToStep(autoAdvanceStep, 'forward'), 450);
    }
  };

  const handleComplete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(()=>{});
    Animated.timing(fadeAnim, { toValue: 0, duration: 800, useNativeDriver: true }).start(() => {
      const target = q2 === 'Mostly Sedentary' ? '21000' : q2 === 'Lightly Active' ? '35000' : '50000';
      AsyncStorage.setItem('sc_weekly_goal', target).catch(() => {});
      AsyncStorage.setItem('sc_intentions', JSON.stringify(q1)).catch(() => {});
      onComplete();
    });
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 26, color: '#ffffff', fontFamily: 'Nunito_800ExtraBold', marginBottom: 8, letterSpacing: 0.5 }}>What brings you to Svara?</Text>
            <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', fontFamily: 'Nunito_400Regular', marginBottom: 24 }}>Select all that apply to personalize your journey.</Text>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', paddingBottom: 40 }}>
              {tags1.map(t => (
                <PremiumSurveyOption key={t} label={t} isSelected={q1.includes(t)} onPress={() => toggleQ1(t)} isMultiple={true} />
              ))}
            </ScrollView>
          </View>
        );
      case 1:
        return (
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 26, color: '#ffffff', fontFamily: 'Nunito_800ExtraBold', marginBottom: 8, letterSpacing: 0.5 }}>How do you feel upon waking?</Text>
            <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', fontFamily: 'Nunito_400Regular', marginBottom: 24 }}>Understanding your mornings helps us adapt.</Text>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', paddingBottom: 40 }}>
              {tags3.map(t => (
                <PremiumSurveyOption key={t} label={t} isSelected={q3 === t} onPress={() => handleSelectSingle(setQ3, t, 2)} />
              ))}
            </ScrollView>
          </View>
        );
      case 2:
        return (
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 26, color: '#ffffff', fontFamily: 'Nunito_800ExtraBold', marginBottom: 8, letterSpacing: 0.5 }}>Your biggest obstacle?</Text>
            <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', fontFamily: 'Nunito_400Regular', marginBottom: 24 }}>We'll help you overcome these challenges.</Text>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', paddingBottom: 40 }}>
              {tags4.map(t => (
                <PremiumSurveyOption key={t} label={t} isSelected={q4 === t} onPress={() => handleSelectSingle(setQ4, t, 3)} />
              ))}
            </ScrollView>
          </View>
        );
      case 3:
        return (
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 26, color: '#ffffff', fontFamily: 'Nunito_800ExtraBold', marginBottom: 8, letterSpacing: 0.5 }}>Your current rhythm?</Text>
            <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', fontFamily: 'Nunito_400Regular', marginBottom: 24 }}>To set an achievable wellness goal.</Text>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', paddingBottom: 40 }}>
              {tags2.map(t => (
                <PremiumSurveyOption key={t} label={t} isSelected={q2 === t} onPress={() => setQ2(t)} />
              ))}
            </ScrollView>
          </View>
        );
      default: return null;
    }
  };

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#020617', zIndex: 100, elevation: 10000, opacity: fadeAnim }]}>
      {/* Dynamic Background Image */}
      <Image source={require('../assets/images/new-hero-bg.jpeg')} style={{ position: 'absolute', top: 0, left: 0, width: SW, height: SH, opacity: 0.8 }} resizeMode="cover" />
      <LinearGradient
        colors={['rgba(2,6,23,0.3)', 'rgba(2,6,23,0.85)', '#020617']}
        style={StyleSheet.absoluteFillObject}
      />
      
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingHorizontal: 28, paddingTop: 40 }}>
          
          {/* Header & Progress Indicator */}
          <View style={{ marginBottom: 40 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <Text style={{ fontSize: 18, color: '#bfdbfe', fontFamily: 'DancingScript_600SemiBold', letterSpacing: 1 }}>Svara</Text>
              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: 'Nunito_700Bold', letterSpacing: 2 }}>{step + 1} / 4</Text>
            </View>
            <View style={{ height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
              <Animated.View style={{ 
                width: `${((step + 1) / 4) * 100}%`, 
                height: '100%', 
                backgroundColor: '#93c5fd', 
                borderRadius: 2 
              }} />
            </View>
          </View>
          
          {/* Main Content Area */}
          <Animated.View style={{ opacity: contentFade, transform: [{ translateY: contentTranslate }], flex: 1 }}>
            {renderStep()}
          </Animated.View>
          
        </View>

        {/* Footer Actions */}
        <View style={{ paddingHorizontal: 28, paddingBottom: 40, paddingTop: 10 }}>
          <BlurView intensity={30} tint="dark" style={{ borderRadius: 30, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.02)', padding: 6 }}>
              {step > 0 && (
                <TouchableOpacity 
                  onPress={handleBack}
                  activeOpacity={0.7}
                  style={{ 
                    paddingVertical: 18, 
                    paddingHorizontal: 24,
                    borderRadius: 24, 
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    marginRight: 8
                  }}>
                  <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.7)" />
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                disabled={!canContinueStep}
                onPress={handleNext}
                activeOpacity={0.8}
                style={{ 
                  flex: 1,
                  paddingVertical: 18, 
                  borderRadius: 24, 
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  backgroundColor: canContinueStep ? 'rgba(96,165,250,0.2)' : 'rgba(255,255,255,0.05)'
                }}>
                <Text style={{ 
                  color: canContinueStep ? '#ffffff' : 'rgba(255,255,255,0.3)', 
                  fontFamily: 'Nunito_800ExtraBold', 
                  fontSize: 15, 
                  letterSpacing: 1.5, 
                  textTransform: 'uppercase',
                  marginRight: canContinueStep ? 8 : 0
                }}>
                  {step === 3 ? 'Begin Journey' : 'Continue'}
                </Text>
                {canContinueStep && step < 3 && <Ionicons name="arrow-forward" size={18} color="#ffffff" />}
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      </SafeAreaView>
    </Animated.View>
  );
}


function DownloadScreen({ progress, label, error, onRetry, isFadingOut, onFadeOutComplete }: { progress: number; label: string; error?: boolean; onRetry?: () => void; isFadingOut?: boolean; onFadeOutComplete?: () => void }) {
  const pulseAnim   = useRef(new Animated.Value(0)).current;
  const screenOp    = useRef(new Animated.Value(1)).current;
  const scaleAnim   = useRef(new Animated.Value(1)).current;

  // Animated subtitle cycling
  const subtitleOp  = useRef(new Animated.Value(1)).current;
  const [subtitleIdx, setSubtitleIdx] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const soundRef2 = useRef<Audio.Sound | null>(null);

  const progressRef = useRef(progress);
  useEffect(() => { progressRef.current = progress; }, [progress]);

  const isMutedRef = useRef(isMuted);
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);

  const rippleAnims = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;
  // Continuously spinning arc to show the ring is actively downloading
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Pulse core glow (slow, deep breathing)
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 4000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 4000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    // Moonwater ripples (slower expansion)
    rippleAnims.forEach((anim, i) => {
      Animated.sequence([
        Animated.delay(i * 2500),
        Animated.loop(Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration: 8000, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
          Animated.timing(anim, { toValue: 0, duration: 0,    useNativeDriver: true }),
        ])),
      ]).start();
    });

    // Spinning arc — continuous 360° rotation, never stops during download
    Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: true })
    ).start();


    // Subtitle fade-cycle (slower fades)
    const cycleSubtitle = () => {
      Animated.sequence([
        Animated.timing(subtitleOp, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ]).start(() => {
        setSubtitleIdx(i => (i + 1) % SETUP_SUBTITLES.length);
        Animated.timing(subtitleOp, { toValue: 1, duration: 1500, useNativeDriver: true }).start();
      });
    };
    const interval = setInterval(cycleSubtitle, 6000);

    // Audio setup for "Hymn of Sun (Surya Suktam)"
    let isCancelled = false;
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    }).catch(() => {});

    Audio.Sound.createAsync(
      { uri: 'https://audio.onesutralabs.com/Tanpura.mp3' },
      { shouldPlay: true, isLooping: true, isMuted: false, volume: 0.65 }
    ).then(({ sound }) => {
      if (isCancelled) {
        sound.unloadAsync();
      } else {
        soundRef.current = sound;
        sound.setIsMutedAsync(isMutedRef.current).catch(() => {});
      }
    }).catch((e) => { console.log("Failed to load setup audio 1", e); });

    Audio.Sound.createAsync(
      { uri: 'https://audio.onesutralabs.com/om.mp3' },
      { shouldPlay: true, isLooping: true, isMuted: false, volume: 0.65 }
    ).then(({ sound }) => {
      if (isCancelled) {
        sound.unloadAsync();
      } else {
        soundRef2.current = sound;
        sound.setIsMutedAsync(isMutedRef.current).catch(() => {});
      }
    }).catch((e) => { console.log("Failed to load setup audio 2", e); });

    return () => {
      isCancelled = true;
      if (soundRef.current) soundRef.current.unloadAsync();
      if (soundRef2.current) soundRef2.current.unloadAsync();
      clearInterval(interval);
    };
  }, []); // Run only once on mount

  // Stop audio gracefully when progress hits 98%
  useEffect(() => {
    if (progress >= 0.98) {
      if (soundRef.current) {
        soundRef.current.setVolumeAsync(0).catch(() => {});
        setTimeout(() => { soundRef.current?.stopAsync().catch(() => {}); }, 600);
      }
      if (soundRef2.current) {
        soundRef2.current.setVolumeAsync(0).catch(() => {});
        setTimeout(() => { soundRef2.current?.stopAsync().catch(() => {}); }, 600);
      }
    }
  }, [progress >= 0.98]);

  // Watch for fade out trigger
  useEffect(() => {
    if (isFadingOut) {
      if (soundRef.current) soundRef.current.unloadAsync();
      if (soundRef2.current) soundRef2.current.unloadAsync();
      Animated.parallel([
        Animated.timing(screenOp, { toValue: 0, duration: 1000, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1.04, duration: 1000, easing: Easing.out(Easing.cubic), useNativeDriver: true })
      ]).start(() => {
        if (onFadeOutComplete) onFadeOutComplete();
      });
    }
  }, [isFadingOut]);

  const toggleMute = () => {
    setIsMuted(prev => {
      const next = !prev;
      if (soundRef.current) soundRef.current.setIsMutedAsync(next).catch(() => {});
      if (soundRef2.current) soundRef2.current.setIsMutedAsync(next).catch(() => {});
      return next;
    });
  };

  const SIZE = 280;
  const cx = SIZE / 2;

  // Radii
  const rMain = 110;
  const cMain = 2 * Math.PI * rMain;
  const offsetMain = cMain * (1 - Math.min(progress, 1));

  const animatedProgress = useRef(new Animated.Value(progress)).current;
  const [pct, setPct] = useState(Math.round(Math.min(progress, 1) * 100));

  useEffect(() => {
    Animated.timing(animatedProgress, {
      toValue: progress,
      // Fast 400ms — ring moves immediately as each file completes.
      // 2500ms was causing "frozen then sudden jump" visual sticking.
      duration: progress >= 1 ? 600 : 400,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true
    }).start();
  }, [progress]);

  useEffect(() => {
    const listenerId = animatedProgress.addListener(({ value }) => {
       setPct(Math.round(Math.min(value, 1) * 100));
    });
    return () => animatedProgress.removeListener(listenerId);
  }, [animatedProgress]);

  const offsetMainAnim = animatedProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [cMain, 0],
    extrapolate: 'clamp'
  });

  const rInner2 = 95; // slightly larger for glassy core

  // Spinning arc angle (0 → 360°)
  const spinDeg = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // The spinning arc occupies ~40° of the full circle circumference
  const spinArcLen = cMain * (40 / 360);
  const spinArcOffset = cMain - spinArcLen;

  // Premium Minimalist Glassy Sky Blue Colors (Matching Home Page)
  const skyBlue = '#60a5fa';
  const softSkyBlue = '#bfdbfe';
  const etherealWhite = 'rgba(255,255,255,0.8)';

  return (
    <Animated.View pointerEvents={isFadingOut ? "none" : "auto"} style={[DS.screen, { opacity: screenOp, transform: [{ scale: scaleAnim }] }]}>
      <Image source={require('../assets/images/new-hero-bg.jpeg')} style={{ position: 'absolute', top: 0, left: 0, width: SW, height: SH }} resizeMode="cover" />
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0, 0, 0, 0.68)' }]} />

      {/* ── TOP ROW: Now Playing pill + Mute button ── */}
      <View style={{
        position: 'absolute',
        top: 56,
        left: 20,
        right: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 10,
      }}>
        {/* Now Playing pill */}
        <View style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'flex-start',
          backgroundColor: 'rgba(255,255,255,0.05)',
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.08)',
          marginRight: 12,
        }}>
          <Ionicons name="musical-notes-outline" size={13} color="#93c5fd" style={{ marginRight: 10, opacity: 0.85, marginTop: 1 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'Nunito_400Regular', fontSize: 10, letterSpacing: 0.4, marginBottom: 2 }}>
              Playing <Text style={{ color: 'rgba(255,255,255,0.95)', fontFamily: 'Nunito_700Bold' }}>Nada (Cosmic Sound)</Text>
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.45)', fontFamily: 'Nunito_400Regular', fontSize: 9, lineHeight: 13 }}>
              Nada means "Sound". The universe resonates in two forms: Ahat (struck) and Anahata (unstruck). Heal and harmonize with the cosmic vibration of Nada.
            </Text>
          </View>
        </View>

        {/* Mute button */}
        <TouchableOpacity
          onPress={toggleMute}
          activeOpacity={0.7}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: isMuted ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.06)',
            borderWidth: 1,
            borderColor: isMuted ? 'rgba(96,165,250,0.4)' : 'rgba(255,255,255,0.12)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={isMuted ? "volume-mute" : "volume-medium"} size={17} color={isMuted ? "#93c5fd" : "rgba(255,255,255,0.75)"} />
        </TouchableOpacity>
      </View>

      {/* Ambient background ethereal glow */}
      <Animated.View style={{
        position: 'absolute', width: 600, height: 600, borderRadius: 300, backgroundColor: skyBlue, top: '15%', 
        opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.03, 0.08] }), 
        alignSelf: 'center', 
        transform: [{ scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.05] }) }]
      }} />

      <View style={DS.center}>
        <Text style={[DS.appName, { color: softSkyBlue, textShadowColor: skyBlue }]}>SVARA</Text>
        <View style={{ height: 60, justifyContent: 'center', marginBottom: 20 }}>
          <Animated.Text style={[DS.subTagline, { opacity: subtitleOp, marginBottom: 0, color: etherealWhite }]}>{SETUP_SUBTITLES[subtitleIdx]}</Animated.Text>
        </View>

          <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center', marginBottom: 40 }}>
          
          {/* Moonwater outward ripples */}
          {rippleAnims.map((anim, i) => (
            <Animated.View key={`rip-${i}`} style={{
              position: 'absolute', width: SIZE - 20, height: SIZE - 20, borderRadius: (SIZE - 20) / 2,
              borderWidth: 1, borderColor: skyBlue,
              opacity: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.15, 0] }),
              transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.8] }) }],
            }} />
          ))}

          {/* === 5-layer pulsing aura (exactly like hero ring) === */}
          <Animated.View style={{ position: 'absolute', width: SIZE + 72, height: SIZE + 72, borderRadius: (SIZE + 72) / 2, backgroundColor: 'rgba(96,165,250,0.025)', transform: [{ scale: pulseAnim }], top: -36, left: -36 }} />
          <Animated.View style={{ position: 'absolute', width: SIZE + 52, height: SIZE + 52, borderRadius: (SIZE + 52) / 2, backgroundColor: 'rgba(96,165,250,0.05)', transform: [{ scale: pulseAnim }], top: -26, left: -26 }} />
          <Animated.View style={{ position: 'absolute', width: SIZE + 34, height: SIZE + 34, borderRadius: (SIZE + 34) / 2, backgroundColor: 'rgba(96,165,250,0.09)', transform: [{ scale: pulseAnim }], top: -17, left: -17 }} />
          <Animated.View style={{ position: 'absolute', width: SIZE + 18, height: SIZE + 18, borderRadius: (SIZE + 18) / 2, backgroundColor: 'rgba(96,165,250,0.15)', transform: [{ scale: pulseAnim }], top: -9, left: -9 }} />
          <Animated.View style={{ position: 'absolute', width: SIZE + 6, height: SIZE + 6, borderRadius: (SIZE + 6) / 2, backgroundColor: 'rgba(96,165,250,0.24)', transform: [{ scale: pulseAnim }], top: -3, left: -3 }} />

          {/* === SVG arc — 3-layer glassy blue glow stroke (exactly like hero ring) === */}
          <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ position: 'absolute' }}>
            {/* Track */}
            <Circle cx={cx} cy={cx} r={rMain} fill="none" stroke="rgba(96,165,250,0.13)" strokeWidth={6} />
            {/* Wide outer glow stroke */}
            <AnimatedCircle
              cx={cx} cy={cx} r={rMain}
              fill="none" stroke="#93c5fd" strokeWidth={6 + 16} strokeLinecap="butt"
              strokeDasharray={String(cMain)} strokeDashoffset={offsetMainAnim}
              transform={`rotate(-90, ${cx}, ${cx})`} opacity={0.14}
            />
            {/* Mid glow stroke */}
            <AnimatedCircle
              cx={cx} cy={cx} r={rMain}
              fill="none" stroke="#7dd3fc" strokeWidth={6 + 8} strokeLinecap="butt"
              strokeDasharray={String(cMain)} strokeDashoffset={offsetMainAnim}
              transform={`rotate(-90, ${cx}, ${cx})`} opacity={0.26}
            />
            {/* Main crisp stroke */}
            <AnimatedCircle
              cx={cx} cy={cx} r={rMain}
              fill="none" stroke="#60a5fa" strokeWidth={6} strokeLinecap="butt"
              strokeDasharray={String(cMain)} strokeDashoffset={offsetMainAnim}
              transform={`rotate(-90, ${cx}, ${cx})`} opacity={0.96}
            />
            {/* Inner highlight sliver */}
            <AnimatedCircle
              cx={cx} cy={cx} r={rMain}
              fill="none" stroke="#bfdbfe" strokeWidth={3} strokeLinecap="butt"
              strokeDasharray={String(cMain)} strokeDashoffset={offsetMainAnim}
              transform={`rotate(-90, ${cx}, ${cx})`} opacity={0.40}
            />
          </Svg>

          {/* === Spinning outer activity arc — rotates continuously to signal active download === */}
          <Animated.View style={{
            position: 'absolute',
            width: SIZE + 28, height: SIZE + 28,
            top: -14, left: -14,
            transform: [{ rotate: spinDeg }],
          }}>
            <Svg width={SIZE + 28} height={SIZE + 28} viewBox={`0 0 ${SIZE + 28} ${SIZE + 28}`}>
              {/* Spinning bright arc — short 40° segment */}
              <Circle
                cx={(SIZE + 28) / 2} cy={(SIZE + 28) / 2} r={rMain + 14}
                fill="none"
                stroke="#bfdbfe"
                strokeWidth={2}
                strokeLinecap="round"
                strokeDasharray={`${spinArcLen} ${spinArcOffset}`}
                strokeDashoffset={0}
                opacity={0.7}
              />
            </Svg>
          </Animated.View>

          {/* Percentage Text inside the ring */}
          <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <Text style={[DS.pctNum, { textShadowColor: 'rgba(96,165,250,0.6)' }]}>{pct}</Text>
              <Text style={[DS.pctSign, { color: '#93c5fd' }]}>%</Text>
            </View>
            <Text style={{ color: '#60a5fa', fontSize: 11, fontFamily: 'Nunito_800ExtraBold', letterSpacing: 5, marginTop: 4, opacity: 0.95 }}>SYNCHRONIZING</Text>
          </View>
        </View>

        {/* Status — only show label, no error/retry (retries happen automatically) */}
        <View style={{ alignItems: 'center', height: 80 }}>
          <Text style={[DS.statusLabel, { textTransform: 'uppercase', letterSpacing: 1.5 }]}>{label}</Text>
          <Text style={DS.setupHint}>First-time setup · Takes about 30 sec</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const DS = StyleSheet.create({
  screen:      { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, alignItems: 'center', backgroundColor: '#020617' },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
  appName:     { fontSize: 32, fontFamily: 'Nunito_900Black', color: '#93c5fd', letterSpacing: 12, marginBottom: 12, opacity: 0.9 },
  subTagline:  { fontSize: 13, color: 'rgba(96,165,250,0.7)', fontFamily: 'DancingScript_600SemiBold', letterSpacing: 0.5, marginBottom: 48, textAlign: 'center', paddingHorizontal: 32, lineHeight: 20 },
  pctNum:      { fontSize: 56, color: '#FFFFFF', fontFamily: 'Nunito_400Regular', letterSpacing: -1, textShadowColor: 'rgba(96,165,250,0.8)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 16 },
  pctSign:     { fontSize: 18, color: '#93c5fd', fontFamily: 'Nunito_600SemiBold', marginTop: 10, marginLeft: 2 },
  statusLabel: { fontSize: 11, color: '#60a5fa', fontFamily: 'Nunito_700Bold', opacity: 0.8 },
  setupHint:   { fontSize: 9, color: 'rgba(96,165,250,0.4)', fontFamily: 'Nunito_600SemiBold', letterSpacing: 1, marginTop: 10, textTransform: 'uppercase' },
  retryBtn:    { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: 'rgba(96,165,250,0.2)', borderRadius: 4, borderWidth: 1, borderColor: '#60a5fa' },
  retryTxt:    { color: '#93c5fd', fontFamily: 'Nunito_700Bold', fontSize: 12, letterSpacing: 1 },
});

function AuthGuard({ onAuthReady }: { onAuthReady: () => void }) {
  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const signalled = useRef(false);

  useEffect(() => {
    // Wait until Expo Router's navigation container is fully mounted.
    // Without this guard, router.replace() throws the
    // "Attempted to navigate before mounting the Root Layout" crash.
    if (!navigationState?.key) return;
    if (signalled.current) return;
    signalled.current = true;
    // Init alarm permissions + notification channel silently
    try {
      setupNotificationChannel().catch(() => {});
      scheduleHabitReminders();
      // ── COLD-BOOT FIX: Defer native bridge calls ───────────────────────────
      // After a phone restart, NativeModules may not be fully initialized when
      // AuthGuard fires. Deferring by 2 seconds ensures the JS bridge is ready
      // before scheduling native reminders, preventing bridge errors that can
      // propagate through Hermes's unhandled rejection path.
      setTimeout(() => scheduleAllNativeReminders().catch(() => {}), 2000);
      checkAndRescheduleDaily().catch(() => {});
      // ── Bug 3 fix: re-sync native alarm sound path on every app open ──────────
      // The expo-asset path persisted in SharedPrefs at schedule time can go stale
      // after an APK update (asset hash changes, old file deleted). Re-syncing here
      // ensures AlarmSoundService.playAlarm() always finds a valid file path and
      // never falls back to the raw beep resource.
      store.getJSON<{ selectedMantraId?: string }>(KEYS.alarmSettings).then(cfg => {
        const soundId = cfg?.selectedMantraId;
        if (soundId) syncNativeWakeAlarmSound(soundId).catch(() => {});
      }).catch(() => {});
    } catch { /* Expo Go */ }
    // Route straight to tabs unless already there or on alarm screens.
    // ALARM DEEP-LINK RACE FIX: On a cold start (app killed) via an alarm deep link,
    // Expo Router may not have processed Linking.getInitialURL() before this guard
    // fires. If we redirect to /(tabs) first, the user sees the homepage instead of
    // the alarm screen. Fix: await the initial URL and skip the redirect when the
    // app was opened via an alarm deep link — Expo Router will navigate there itself.
    (async () => {
      const root = segments[0] as string;
      const alarmRoutes = ['(tabs)', 'wake-alarm-ringing', 'alarm-ringing', 'habit-alarm-ringing', 'mission', 'soundbath-ringing', 'sleep-ringing'];
      if (!alarmRoutes.includes(root)) {
        let shouldRedirect = true;
        try {
          const initialUrl = await Linking.getInitialURL();
          if (initialUrl && /soundbath-ringing|habit-alarm-ringing|wake-alarm-ringing|alarm-ringing|sleep-ringing/.test(initialUrl)) {
            shouldRedirect = false;
          }
        } catch { /* ignore */ }
        if (shouldRedirect) {
          router.replace('/(tabs)' as never);
        }
      }
      setTimeout(() => onAuthReady(), 80);
    })().catch(() => {
      router.replace('/(tabs)' as never);
      setTimeout(() => onAuthReady(), 80);
    });
  }, [navigationState?.key]);

  return null;
}

function BodhiNotificationListener() {
  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  // Guard: ensure we navigate to /alarm-ringing at most once per alarm cycle.
  // Multiple navigation calls re-mount the component, restarting audio playback.
  const alarmRoutedRef = useRef(false);
  // Guard: prevent double-navigation to habit/soundbath alarm screens.
  const habitAlarmRoutedRef = useRef(false);
  // Always-fresh segments ref — used inside async callbacks to avoid stale closure.
  const segmentsRef = useRef<string[]>([]);
  // BUG 3 FIX: Holds the unsubscribe function returned by notifee.onForegroundEvent()
  // so it can be properly called in the useEffect cleanup below.
  const notifeeUnsubRef = useRef<(() => void) | null>(null);
  const navReady = !!navigationState?.key;

  // BUG 1 FIX: Reset the guard only when ALL alarm-related screens are gone.
  // Previously this reset when leaving wake-alarm-ringing — but the user legitimately
  // navigates from wake-alarm-ringing → mission, so alarmRoutedRef was reset mid-alarm
  // cycle. The AppState/Linking listeners then re-routed back to wake-alarm-ringing ON
  // TOP of the mission screen, causing it to freeze on the second alarm.
  // Now: keep alarmRoutedRef=true while on mission too — only reset when the full
  // alarm cycle is complete (user is on a non-alarm, non-mission screen).
  useEffect(() => {
    const segs = segments as string[];
    if (
      !segs.includes('wake-alarm-ringing') &&
      !segs.includes('alarm-ringing') &&
      !segs.includes('mission')
    ) {
      alarmRoutedRef.current = false;
    }
  }, [segments]);

  // Keep segmentsRef current so async callbacks always read the latest route.
  useEffect(() => { segmentsRef.current = segments as string[]; }, [segments]);

  // Reset habitAlarmRoutedRef when leaving habit/soundbath alarm screens so
  // the next alarm cycle can trigger routing again.
  useEffect(() => {
    const segs = segments as string[];
    if (!segs.includes('soundbath-ringing') && !segs.includes('habit-alarm-ringing')) {
      habitAlarmRoutedRef.current = false;
    }
  }, [segments]);

  // ── When app is LAUNCHED by wake alarm (phone was sleeping/app was killed) ──
  useEffect(() => {
    if (!navReady) return;
    getInitialAlarmNotification().then(async (initial) => {
      if (initial && !alarmRoutedRef.current) {
        // Guard: if the alarm was already fully handled (mission completed), skip routing.
        // wasAlarmFired() can stay true on the native side after a completed alarm cycle
        // causing a crash loop where alarm-ringing remounts into a stopped native service.
        const handled = await AsyncStorage.getItem('onesutra_alarm_handled_v1').catch(() => null);
        // ROOT CAUSE FIX: Extended from 5 seconds to 60 seconds.
        // The app launch path (cold start) also gets this guard because the very
        // first app open after alarm dismissal can race the native flag clear.
        if (handled && Date.now() - Number(handled) < 60_000) {
          // Handled within last 60 seconds = just completed this cycle. Prevent crash loop.
          alarmRoutedRef.current = true; // suppress future routing this session
          return;
        }
        const missionId = await AsyncStorage.getItem('onesutra_mission_active_v1').catch(() => null);
        alarmRoutedRef.current = true;
        if (missionId && !(segments as string[]).includes('mission')) {
          console.log('[Layout] App launched mid-mission → routing to /mission');
          setTimeout(() => router.replace(`/mission?id=${missionId}` as never), 150);
        } else if (!missionId) {
          console.log('[Layout] App launched from alarm notification → routing to /wake-alarm-ringing');
          setTimeout(() => router.replace('/wake-alarm-ringing' as never), 150);
        }
      }
    }).catch(() => { });
  }, [navReady]);

  // ── When app resumes from BACKGROUND (not killed) and alarm fired ──────────
  // The native AlarmSoundService.launchApp() already brings the app to the
  // alarm-ringing screen on the first call. This AppState listener is a
  // belt-and-suspenders fallback; the guard prevents it from pushing a second
  // time which would re-mount the component and restart audio playback.
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active') return;
      // CRITICAL BUG FIX: Use segmentsRef.current (always-fresh) instead of
      // `segments` (stale closure captured at effect creation). When this
      // async callback fires, segments is the value from the PREVIOUS render.
      // Using the stale value means we check the wrong current route — the user
      // may already be on (tabs) (alarm stopped) but the closure still says
      // wake-alarm-ringing, or vice versa.
      const freshSegs = segmentsRef.current;
      if (freshSegs.includes('wake-alarm-ringing') || freshSegs.includes('alarm-ringing') || freshSegs.includes('mission')) return; // already on alarm/mission screen
      getInitialAlarmNotification().then(async (fired) => {
        if (!fired) return;
        // Re-check with fresh segments after async gap
        const currentSegs = segmentsRef.current;
        if (currentSegs.includes('wake-alarm-ringing') || currentSegs.includes('alarm-ringing') || currentSegs.includes('mission')) return;
        // Guard: skip routing if alarm was already handled — prevents the
        // reopen loop when music is playing or the user backgrounds/foregrounds
        // the app after stopping the alarm.
        const handled = await AsyncStorage.getItem('onesutra_alarm_handled_v1').catch(() => null);
        // ROOT CAUSE FIX: Extended from 5 seconds to 60 seconds.
        // The 5-second window was too short — music playback, audio session
        // changes, notification bar interactions, and OEM battery-saver events
        // can all trigger AppState background→active cycles LONG after the alarm
        // was dismissed. Each such cycle re-ran this handler, saw wasAlarmFired()
        // still true (native flag clears async), and re-routed to wake-alarm-ringing.
        // 60 seconds provides a safe buffer that covers all known OEM edge cases.
        if (handled && Date.now() - Number(handled) < 60_000) {
          // Handled within last 60 seconds = just completed. Prevent crash loop.
          alarmRoutedRef.current = true;
          return;
        }
        // Confirmed: genuine new alarm. Reset any stale ref so routing is never blocked.
        if (alarmRoutedRef.current) {
          console.log('[Layout] Resetting stale alarmRoutedRef for new alarm cycle (background path)');
          alarmRoutedRef.current = false;
        }
        if (alarmRoutedRef.current) return; // double-guard (concurrent call safety)
        const missionId = await AsyncStorage.getItem('onesutra_mission_active_v1').catch(() => null);
        alarmRoutedRef.current = true;
        const navSegs = segmentsRef.current;
        if (missionId) {
          if (!navSegs.includes('mission')) {
            console.log('[Layout] App foregrounded mid-mission → /mission');
            router.push(`/mission?id=${missionId}` as never);
          }
        } else {
          console.log('[Layout] App foregrounded from alarm (background path) → /wake-alarm-ringing');
          router.push('/wake-alarm-ringing' as never);
        }
      }).catch(() => { });
    });
    return () => sub.remove();
  }, []);  // No deps — segmentsRef.current always provides the latest segments inside the callback

  // ── When alarm fires while app is already in the FOREGROUND ─────────────────
  // AppState does NOT change when the app is already active, so the listener
  // above never fires in this case. AlarmSoundService.launchApp() sends the
  // deep-link URI arise://alarm-ringing via onNewIntent → React Native Linking
  // fires the 'url' event. Without this listener the alarm screen is never
  // navigated to for foreground alarms — the user sees the native overlay but
  // the JS alarm-ringing screen never mounts.
  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }: { url: string }) => {
      if (!url.includes('alarm-ringing') && !url.includes('wake-alarm-ringing')) return;
      if (segmentsRef.current.includes('wake-alarm-ringing') || segmentsRef.current.includes('alarm-ringing')) return;
      (async () => {
        const handled = await AsyncStorage.getItem('onesutra_alarm_handled_v1').catch(() => null);
        // ROOT CAUSE FIX: Extended from 5 seconds to 60 seconds — same reason
        // as the AppState handler above. Deep-links can re-fire from the
        // BTTF (back-to-the-foreground) notification tap after the alarm was
        // already stopped but the notification was slow to cancel.
        if (handled && Date.now() - Number(handled) < 60_000) {
          alarmRoutedRef.current = true; return;
        }
        const fired = await getInitialAlarmNotification().catch(() => false);
        if (!fired) return;
        // Confirmed genuine alarm deep-link — reset any stale ref and route.
        // A stale alarmRoutedRef=true from a previous cycle must NOT block the
        // alarm screen from appearing when the alarm is genuinely ringing.
        if (alarmRoutedRef.current) {
          console.log('[Layout] Resetting stale alarmRoutedRef for new alarm cycle (foreground deep-link)');
          alarmRoutedRef.current = false;
        }
        if (alarmRoutedRef.current) return; // concurrent call safety
        alarmRoutedRef.current = true;
        router.replace('/wake-alarm-ringing' as never);
      })().catch(() => {});
    });
    return () => sub.remove();
  }, []);

  // ── When app is LAUNCHED by a habit alarm fullScreenAction (app was killed) ───
  // index.js background handler writes PENDING_HABIT_KEY to AsyncStorage on
  // EventType.DELIVERED. We read + clear it here so the alarm screen opens
  // automatically even when getInitialNotification() returns null (fullScreen
  // action launches the activity without a user "tap").
  //
  // RACE-CONDITION FIX: The fullScreenAction intent launches MainActivity
  // *concurrently* with onBackgroundEvent writing to AsyncStorage. A single
  // immediate read races and loses — poll every 350 ms for up to 2.1 s so
  // we catch the key regardless of OEM scheduling jitter.
  useEffect(() => {
    if (!navReady) return;
    const PENDING_HABIT_KEY = 'onesutra_pending_habit_v1';
    let cancelled = false;

    const navigateToHabitAlarm = (raw: string) => {
      if (cancelled) return;
      AsyncStorage.removeItem(PENDING_HABIT_KEY).catch(() => {});
      try {
        const alarm = JSON.parse(raw);
        const hk  = encodeURIComponent(alarm.habitKey  ?? '');
        const he  = encodeURIComponent(alarm.habitEmoji ?? '🌿');
        const hl  = encodeURIComponent(alarm.label      ?? 'Habit Alarm');
        const at  = alarm.alarmType ?? 'habit';
        const sid = encodeURIComponent(alarm.soundId    ?? 'morning_birds');
        if (at === 'soundbath') {
          const lbl = encodeURIComponent(alarm.label ?? 'Sound Bath');
          setTimeout(() => { if (!cancelled) router.replace(`/soundbath-ringing?soundId=${sid}&label=${lbl}` as never); }, 400);
        } else {
          setTimeout(() => { if (!cancelled) router.replace(`/habit-alarm-ringing?habitKey=${hk}&habitEmoji=${he}&label=${hl}&alarmType=${at}&mantraId=${sid}` as never); }, 400);
        }
      } catch { /* ignore parse error */ }
    };

    // Poll up to 6 × 350 ms = 2.1 s — covers the race where onBackgroundEvent
    // hasn't finished writing to AsyncStorage when MainActivity is already up.
    const pollPendingHabit = async () => {
      for (let attempt = 0; attempt < 6; attempt++) {
        if (cancelled) return;
        try {
          const raw = await AsyncStorage.getItem(PENDING_HABIT_KEY);
          if (raw) { navigateToHabitAlarm(raw); return; }
        } catch { /* ignore */ }
        await new Promise<void>(resolve => setTimeout(resolve, 350));
      }
    };
    pollPendingHabit().catch(() => {});

    // Belt-and-suspenders: also check when app resumes from background
    // (covers the edge case where the app was backgrounded, not killed).
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      AsyncStorage.getItem(PENDING_HABIT_KEY).then((raw) => {
        if (raw) navigateToHabitAlarm(raw);
      }).catch(() => {});
    });

    return () => {
      cancelled = true;
      appStateSub.remove();
    };
  }, [navReady]);

  // ── When app is LAUNCHED by a soundbath alarm fullScreenAction (app was killed) ──
  // RACE-CONDITION FIX: onBackgroundEvent writes onesutra_pending_soundbath_v1
  // concurrently with MainActivity launching. A single immediate read races and
  // loses on OEM devices — poll every 350 ms for up to 2.1 s (same pattern as
  // PENDING_HABIT_KEY above) so we catch the key regardless of scheduling jitter.
  useEffect(() => {
    if (!navReady) return;
    const PENDING_SB_KEY = 'onesutra_pending_soundbath_v1';
    let cancelled = false;

    const navigateToSoundbath = (raw: string) => {
      if (cancelled) return;
      AsyncStorage.removeItem(PENDING_SB_KEY).catch(() => {});
      try {
        const alarm = JSON.parse(raw);
        const sid = encodeURIComponent(alarm.soundId ?? 'morning_birds');
        const lbl = encodeURIComponent(alarm.label ?? 'Sound Bath');
        setTimeout(() => { if (!cancelled) router.replace(`/soundbath-ringing?soundId=${sid}&label=${lbl}` as never); }, 400);
      } catch { /* ignore parse error */ }
    };

    const pollPendingSoundbath = async () => {
      for (let attempt = 0; attempt < 6; attempt++) {
        if (cancelled) return;
        try {
          const raw = await AsyncStorage.getItem(PENDING_SB_KEY);
          if (raw) { navigateToSoundbath(raw); return; }
        } catch { /* ignore */ }
        await new Promise<void>(resolve => setTimeout(resolve, 350));
      }
    };
    pollPendingSoundbath().catch(() => {});

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      AsyncStorage.getItem(PENDING_SB_KEY).then((raw) => {
        if (raw) navigateToSoundbath(raw);
      }).catch(() => {});
    });

    return () => {
      cancelled = true;
      appStateSub.remove();
    };
  }, [navReady]);

  // ── SOUNDBATH DEEP-LINK RACE FIX: native SharedPrefs fallback ────────────────
  // Problem: HabitAlarmSoundService fires the deep-link solrize://soundbath-ringing
  // via launchApp(). On a cold start or background resume, AuthGuard sometimes runs
  // before Expo Router processes the deep-link intent, sees segments[0] ≠ 'soundbath-
  // ringing', and redirects to /(tabs). pollPendingSoundbath cannot recover because
  // HabitAlarmSoundService (native AlarmManager path) NEVER writes
  // onesutra_pending_soundbath_v1 to AsyncStorage — only onBackgroundEvent (Notifee
  // path) does that.
  // Fix: read native habit_alarm_prefs SharedPreferences directly via the new
  // getActiveHabitAlarmParams() bridge method. If alarmType === 'soundbath' and we
  // are not already on the alarm screen, navigate there. Guarded by
  // habitAlarmRoutedRef to prevent double-navigation (which would restart audio).
  useEffect(() => {
    if (!navReady) return;
    let cancelled = false;

    const checkNativeSoundbathAlarm = async () => {
      if (cancelled || habitAlarmRoutedRef.current) return;
      const freshSegs = segmentsRef.current;
      if (
        freshSegs.includes('soundbath-ringing') ||
        freshSegs.includes('habit-alarm-ringing') ||
        freshSegs.includes('alarm-ringing')
      ) {
        habitAlarmRoutedRef.current = true;
        return;
      }
      try {
        const params = await (NativeModules.HabitAlarmModule as any)?.getActiveHabitAlarmParams?.();
        if (!params || cancelled || habitAlarmRoutedRef.current) return;
        const latestSegs = segmentsRef.current;
        if (
          latestSegs.includes('soundbath-ringing') ||
          latestSegs.includes('habit-alarm-ringing') ||
          latestSegs.includes('alarm-ringing')
        ) {
          habitAlarmRoutedRef.current = true;
          return;
        }
        habitAlarmRoutedRef.current = true;
        if (params.alarmType === 'soundbath') {
          const sid = encodeURIComponent(params.habitKey ?? 'morning_birds');
          const lbl = encodeURIComponent(params.habitLabel ?? 'Sound Bath');
          console.log('[Layout] Native soundbath fallback → /soundbath-ringing');
          router.replace(`/soundbath-ringing?soundId=${sid}&label=${lbl}` as never);
        }
      } catch { /* ignore */ }
    };

    checkNativeSoundbathAlarm().catch(() => {});

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      checkNativeSoundbathAlarm().catch(() => {});
    });

    return () => {
      cancelled = true;
      appStateSub.remove();
    };
  }, [navReady]);

  // ── When app is LAUNCHED by a sleep auto-start fullScreenAction (app was killed) ──
  // RACE-CONDITION FIX: same polling pattern as soundbath and PENDING_HABIT_KEY.
  useEffect(() => {
    if (!navReady) return;
    const PENDING_SLEEP_KEY = 'onesutra_pending_sleep_v1';
    let cancelled = false;

    const navigateToSleep = (raw: string) => {
      if (cancelled) return;
      AsyncStorage.removeItem(PENDING_SLEEP_KEY).catch(() => {});
      try {
        const alarm = JSON.parse(raw);
        const sid = encodeURIComponent(alarm.soundId ?? 'light_rain');
        const lbl = encodeURIComponent(alarm.label ?? 'Sleep Sound');
        setTimeout(() => { if (!cancelled) router.replace(`/sleep-ringing?soundId=${sid}&label=${lbl}` as never); }, 400);
      } catch { /* ignore parse error */ }
    };

    const pollPendingSleep = async () => {
      for (let attempt = 0; attempt < 6; attempt++) {
        if (cancelled) return;
        try {
          const raw = await AsyncStorage.getItem(PENDING_SLEEP_KEY);
          if (raw) { navigateToSleep(raw); return; }
        } catch { /* ignore */ }
        await new Promise<void>(resolve => setTimeout(resolve, 350));
      }
    };
    pollPendingSleep().catch(() => {});

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      AsyncStorage.getItem(PENDING_SLEEP_KEY).then((raw) => {
        if (raw) navigateToSleep(raw);
      }).catch(() => {});
    });

    return () => {
      cancelled = true;
      appStateSub.remove();
    };
  }, [navReady]);

  // ── When app is LAUNCHED by a notifee notification (habit alarm / evening mantra) ──
  useEffect(() => {
    if (!navReady) return;
    try {
      const notifee = require('@notifee/react-native').default;
      notifee.getInitialNotification().then((initial: any) => {
        if (!initial) return;
        const data = initial.notification?.data as Record<string, string> | undefined;
        if (data?.type === 'evening-mantra') {
          setTimeout(() => router.replace('/habit-alarm-ringing?habitKey=evening_mantra&habitEmoji=%F0%9F%94%B1&label=Shiv%20Sankalpa%20Suktam&mantraId=shiv_sankalpa_suktam' as never), 300);
        } else if (data?.type === 'soundbath-alarm') {
          const sid = encodeURIComponent(data?.soundId ?? 'morning_birds');
          const lbl = encodeURIComponent(data?.label ?? 'Sound Bath');
          setTimeout(() => router.replace(`/soundbath-ringing?soundId=${sid}&label=${lbl}` as never), 300);
        } else if (data?.type === 'sleep-autostart') {
          const sid = encodeURIComponent(data?.soundId ?? 'light_rain');
          const lbl = encodeURIComponent(data?.label ?? 'Sleep Sound');
          setTimeout(() => router.replace(`/sleep-ringing?soundId=${sid}&label=${lbl}` as never), 300);
        } else if (data?.type === 'habit-alarm') {
          const hk = encodeURIComponent(data?.habitKey ?? data?.alarmId ?? '');
          const he = encodeURIComponent(data?.habitEmoji ?? '🌿');
          const hl = encodeURIComponent(data?.label ?? 'Habit Alarm');
          const at = data?.alarmType ?? 'habit';
          const sid = encodeURIComponent(data?.soundId ?? 'morning_birds');
          if (at === 'soundbath') {
            const lbl = encodeURIComponent(data?.label ?? 'Sound Bath');
            setTimeout(() => router.replace(`/soundbath-ringing?soundId=${sid}&label=${lbl}` as never), 300);
          } else {
            setTimeout(() => router.replace(`/habit-alarm-ringing?habitKey=${hk}&habitEmoji=${he}&label=${hl}&alarmType=${at}&mantraId=${sid}` as never), 300);
          }
        }
      }).catch(() => {});
    } catch { /* ignore */ }
  }, [navReady]);

  // ── When app is LAUNCHED by a slot reminder (full-screen intent tap) ─────
  useEffect(() => {
    if (!navReady) return;
    getInitialReminderNotification().then(slotId => {
      if (slotId) {
        console.log(`[Layout] App launched from reminder → /notification-landing?slotId=${slotId}`);
        setTimeout(() => router.push(`/notification-landing?slotId=${slotId}` as never), 1400);
      }
    }).catch(() => { });
  }, [navReady]);

  useEffect(() => {
    let foregroundSub: { remove: () => void } | null = null;
    let tapSub: { remove: () => void } | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Notifications = require('expo-notifications');

      // ── Android: ensure notification channel is ready on every app open ──
      if (Platform.OS === 'android') {
        Notifications.setNotificationChannelAsync('arise-alarms', {
          name: 'Nada Alarms',
          importance: Notifications.AndroidImportance.MAX,
          sound: 'mantra_alarm.m4a',
          vibrationPattern: [0, 250, 250, 250],
          enableVibrate: true,
          showBadge: true,
          bypassDnd: true,
        }).then(() => console.log('[App] Android alarm channel ready')).catch(() => { });
      }

      // Fires when notification arrives while app is OPEN (foreground)
      foregroundSub = Notifications.addNotificationReceivedListener(async (notification: any) => {
        const speechId = notification.request.content.data?.speechId as string | undefined;
        if (!speechId) return;
        const lang = (await store.get(KEYS.language)) ?? 'en';
        const scripts = NOTIFICATION_SPEECHES[speechId];
        if (scripts) {
          const text = scripts[lang] ?? scripts['en'];
          speakBodhi(text);
        }
      });

      // Fires when user TAPS notification to open the app (background → foreground)
      tapSub = Notifications.addNotificationResponseReceivedListener(async (response: any) => {
        const data = response.notification.request.content.data ?? {};
        const speechId = data?.speechId as string | undefined;
        const type = data?.type as string | undefined;

        // Wake-up alarm tap → open Mission Alarm ringing screen
        if (type === 'wake-alarm' || speechId === 'wake-alarm') {
          // Guard: only navigate if not already on alarm-ringing screen
          if (!alarmRoutedRef.current && !segmentsRef.current.includes('alarm-ringing')) {
            alarmRoutedRef.current = true;
            setTimeout(() => router.push('/alarm-ringing' as never), 800);
          }
          return;
        }

        // Sound Bath tap → open soundbath ringing screen
        if (type === 'soundbath-alarm') {
          const sid = encodeURIComponent((data?.soundId ?? 'morning_birds') as string);
          const lbl = encodeURIComponent((data?.label ?? 'Sound Bath') as string);
          setTimeout(() => router.push(`/soundbath-ringing?soundId=${sid}&label=${lbl}` as never), 800);
          return;
        }

        // Sleep auto-start tap → open sleep ringing screen
        if (type === 'sleep-autostart') {
          const sid = encodeURIComponent((data?.soundId ?? 'light_rain') as string);
          const lbl = encodeURIComponent((data?.label ?? 'Sleep Sound') as string);
          setTimeout(() => router.push(`/sleep-ringing?soundId=${sid}&label=${lbl}` as never), 800);
          return;
        }

        // Habit alarm tap → open habit alarm ringing screen
        if (type === 'habit-alarm') {
          const habitKey = encodeURIComponent((data?.alarmId ?? '') as string);
          const habitEmoji = encodeURIComponent((data?.habitEmoji ?? '🌿') as string);
          const habitLabel = encodeURIComponent((data?.label ?? 'Habit Alarm') as string);
          const alarmType = data?.alarmType ?? 'habit';
          const mantraId = encodeURIComponent((data?.soundId ?? 'morning_birds') as string);
          if (alarmType === 'soundbath') {
            const lbl = encodeURIComponent((data?.label ?? 'Sound Bath') as string);
            setTimeout(() => router.push(`/soundbath-ringing?soundId=${mantraId}&label=${lbl}` as never), 800);
          } else {
            setTimeout(() => router.push(`/habit-alarm-ringing?habitKey=${habitKey}&habitEmoji=${habitEmoji}&label=${habitLabel}&alarmType=${alarmType}&mantraId=${mantraId}` as never), 800);
          }
          return;
        }

        // iOS expo-notification slot reminder tap → notification landing screen
        if (speechId && speechId !== 'wake-alarm') {
          setTimeout(() => router.push(`/notification-landing?slotId=${speechId}` as never), 800);
          return;
        }

        if (!speechId) return;
        setTimeout(async () => {
          const lang = (await store.get(KEYS.language)) ?? 'en';
          const scripts = NOTIFICATION_SPEECHES[speechId];
          if (scripts) {
            const text = scripts[lang] ?? scripts['en'];
            speakBodhi(text);
          }
        }, 1500);
      });

      // ── Notifee foreground event: slot reminder arrives while app is OPEN ──
      try {
        const notifee = require('@notifee/react-native').default;
        const { EventType } = require('@notifee/react-native');
        // BUG 3 FIX: Capture the unsubscribe function returned by onForegroundEvent.
        // Previously this return value was silently discarded, so the handler was
        // never removed in the useEffect cleanup. The handler is replaced (not stacked)
        // by the Notifee API, but capturing the return and calling it is the correct
        // pattern and guards against future Notifee API changes.
        const unsubNotifee = notifee.onForegroundEvent(({ type, detail }: { type: any; detail: any }) => {
          const notifId = detail?.notification?.id as string | undefined;
          const data = detail?.notification?.data as Record<string, string> | undefined;

          // Wake alarm delivered while app is in foreground (fullScreenIntent path)
          // GUARD: use alarmRoutedRef to ensure we navigate at most ONCE per alarm cycle.
          // Without this guard, multiple DELIVERED events (native service + extra wake alarms)
          // each push a new /alarm-ringing screen, causing: abnormal vibration (Haptics fires
          // on each mount), unpin popup loop (dismissAlarmOverlay re-fires each mount),
          // and the "mantra plays then selected sound" symptom (each fresh mount calls
          // preemptActiveAlarm() which stops the previous mount's audio and restarts it).
          if (type === EventType.DELIVERED && (notifId === ALARM_NOTIF_ID || (notifId?.startsWith('wake-extra-') && data?.type === 'wake-alarm'))) {
            if (alarmRoutedRef.current || segmentsRef.current.includes('alarm-ringing')) {
              console.log('[Layout] Alarm delivered in foreground — already routed, skipping duplicate push.');
              return;
            }
            console.log('[Layout] Alarm delivered in foreground → routing to /alarm-ringing');
            alarmRoutedRef.current = true;
            router.push('/alarm-ringing' as never);
            return;
          }

          // Evening mantra delivered or pressed while app is in foreground
          if ((type === EventType.DELIVERED || type === EventType.PRESS) && data?.type === 'evening-mantra') {
            router.push('/habit-alarm-ringing?habitKey=evening_mantra&habitEmoji=%F0%9F%94%B1&label=Shiv%20Sankalpa%20Suktam&mantraId=shiv_sankalpa_suktam' as never);
            return;
          }

          // Sound Bath delivered or pressed while app is in foreground
          if ((type === EventType.DELIVERED || type === EventType.PRESS) && data?.type === 'soundbath-alarm') {
            const sid = encodeURIComponent((data?.soundId ?? 'morning_birds') as string);
            const lbl = encodeURIComponent((data?.label ?? 'Sound Bath') as string);
            router.push(`/soundbath-ringing?soundId=${sid}&label=${lbl}` as never);
            return;
          }

          // Sleep auto-start delivered or pressed while app is in foreground
          if ((type === EventType.DELIVERED || type === EventType.PRESS) && data?.type === 'sleep-autostart') {
            const sid = encodeURIComponent((data?.soundId ?? 'light_rain') as string);
            const lbl = encodeURIComponent((data?.label ?? 'Sleep Sound') as string);
            router.push(`/sleep-ringing?soundId=${sid}&label=${lbl}` as never);
            return;
          }

          // Habit alarm delivered or pressed while app is in foreground
          if ((type === EventType.DELIVERED || type === EventType.PRESS) && data?.type === 'habit-alarm') {
            const habitKey = encodeURIComponent((data?.alarmId ?? '') as string);
            const habitEmoji = encodeURIComponent((data?.habitEmoji ?? '🌿') as string);
            const habitLabel = encodeURIComponent((data?.label ?? 'Habit Alarm') as string);
            const alarmType = data?.alarmType ?? 'habit';
            const mantraId = encodeURIComponent((data?.soundId ?? 'morning_birds') as string);
            if (alarmType === 'soundbath') {
              const lbl = encodeURIComponent((data?.label ?? 'Sound Bath') as string);
              router.push(`/soundbath-ringing?soundId=${mantraId}&label=${lbl}` as never);
            } else {
              router.push(`/habit-alarm-ringing?habitKey=${habitKey}&habitEmoji=${habitEmoji}&label=${habitLabel}&alarmType=${alarmType}&mantraId=${mantraId}` as never);
            }
            return;
          }

          if (data?.type !== REMINDER_DATA_TYPE) return;
          if (type === EventType.DELIVERED || type === EventType.PRESS) {
            const slotId = data?.slotId;
            if (slotId) router.push(`/notification-landing?slotId=${slotId}` as never);
          }
        });
        // Stash on a ref so the cleanup below can call it.
        if (typeof unsubNotifee === 'function') {
          notifeeUnsubRef.current = unsubNotifee;
        }
      } catch { /* ignore */ }

    } catch { /* Expo Go — notifications not supported, skip silently */ }
    // BUG 3 FIX: Also unsubscribe notifee foreground event handler on cleanup.
    const capturedNotifeeUnsub = notifeeUnsubRef.current;
    return () => {
      try { foregroundSub?.remove(); } catch { /* ignore */ }
      try { tapSub?.remove(); } catch { /* ignore */ }
      try { if (capturedNotifeeUnsub) capturedNotifeeUnsub(); } catch { /* ignore */ }
    };
  }, []);
  return null;
}

function GlobalMoodLayer() {
  const { moodPhase, preMood, confirmMood, skipMood } = useSoundPlayer();
  return (
    <MoodSheet
      visible={moodPhase !== null}
      mode={moodPhase === 'result' ? 'result' : (moodPhase ?? 'pre')}
      preMood={preMood}
      onSelect={(key: MoodKey) => confirmMood(key)}
      onSkip={() => skipMood()}
    />
  );
}

// Phase values:
//   'gate'        → fonts loaded, running warm/cache checks (shows dark cover)
//   'downloading' → images missing, showing download progress screen
//   'splash'      → all images cached, showing 5-second splash with bg image
//   'done'        → splash finished, full app visible
type AppPhase = 'gate' | 'downloading' | 'downloading_done' | 'splash' | 'done';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Nunito_300Light, Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold,
    Nunito_800ExtraBold, Nunito_900Black,
    DancingScript_600SemiBold,
  });

  const [authReady,   setAuthReady]   = useState(false);
  const [phase,       setPhase]       = useState<AppPhase>('gate');
  const [showSurvey,  setShowSurvey]  = useState(false);
  const [surveyFinishedSignal, setSurveyFinishedSignal] = useState(0);
  const [dlProgress,  setDlProgress]  = useState(0);
  const [dlLabel,     setDlLabel]     = useState('Preparing...');
  const [dlError,     setDlError]     = useState(false);
  const [retryTrigger, setRetryTrigger] = useState(0);
  // Pre-resolve the splash bg URI synchronously so SplashOverlay can render
  // immediately during the 'gate' phase — eliminating the blank gap between
  // the native splash dismiss and the NADA animated screen appearing.
  const [splashBgUri, setSplashBgUri] = useState<string>(() => {
    try { return getBgSourceSync('splash'); } catch { return ''; }
  });

  // Hide the native splash only when we know what phase we are in.
  // This prevents the fraction-of-a-second flash on first install.
  useEffect(() => {
    if (phase !== 'gate' || showSurvey) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [phase, showSurvey]);

  // ── Download gate: runs once fonts are loaded ─────────────────────────────
  // STRATEGY:
  //   • Gate ONLY on BG images (16 images, ~5–15 MB total on first install)
  //   • Sound card images (50+ images) are NOT a gate — they download silently
  //     after the splash screen so the user never waits for them on first open.
  //   • Solar positions, Ayurvedic periods etc. are pure JS computation — instant.
  //   • On subsequent opens all BGs are already cached → gate resolves in <50 ms.
  useEffect(() => {
    if (!fontsLoaded) return;
    let cancelled = false;
    // NetInfo auto-retry removed to prevent infinite restart loops on flaky connections.
    // The user can now use the explicit 'Tap to Retry' button if a download fails.

    (async () => {
      try {
        // Alarm images — high priority, fire at any time
        prefetchCriticalAlarmImages().catch(() => {});
        // Pre-download CDN alarm sounds for offline native alarm playback
        ensureAllMantrasDownloaded().catch(() => {});

        // Fast disk-scan — no downloads, just file-existence checks (~10 ms)
        // ── COLD-BOOT FIX: Wrap bgWarmup with a 3-second absolute timeout ────
        // bgWarmup runs warmBgLocalMap() at module load time. On a fresh cold
        // boot, the filesystem may still be initializing. bgWarmup itself now
        // has a 4s outer race (in bgImages.ts), but we add a 3s belt-and-
        // suspenders guard here to prevent this await from ever blocking the
        // startup gate and causing an ANR.
        await Promise.race([
          bgWarmup,
          new Promise<void>(resolve => setTimeout(resolve, 3000)),
        ]).catch(() => {});
        // ── FIRST-INSTALL GATE ────────────────────────────────────────────
        // Use a persistent AsyncStorage flag as the primary check.
        // isSplashCached() reads an in-memory map (BG_LOCAL_MAP) that resets
        // every cold start — on some Android devices FileSystem.getInfoAsync
        // can return exists:false even for files that ARE on disk, causing the
        // download screen to appear on every open. The AsyncStorage flag is set
        // once after the first successful download and survives app restarts.
        //
        // SETUP RESUMPTION FIX:
        // If the user kills the app mid-setup, SETUP_DONE_KEY is never written.
        // We use a separate INPROGRESS flag written at the START of download
        // and cleared only on success. If it exists at next open, we force the
        // download gate again — preventing permanently-missing reel images.
        const SETUP_DONE_KEY       = 'arise_bg_setup_done_v2';
        const SETUP_INPROGRESS_KEY = 'arise_bg_setup_inprogress_v1';
        const SETUP_PROGRESS_KEY   = 'arise_bg_setup_progress_val';
        const SETUP_SURVEY_DONE    = 'arise_survey_done_v1';
        
        const [setupFlagRaw, inProgressRaw, savedProgressRaw, surveyDoneRaw] = await Promise.all([
          AsyncStorage.getItem(SETUP_DONE_KEY).catch(() => null),
          AsyncStorage.getItem(SETUP_INPROGRESS_KEY).catch(() => null),
          AsyncStorage.getItem(SETUP_PROGRESS_KEY).catch(() => null),
          AsyncStorage.getItem(SETUP_SURVEY_DONE).catch(() => null),
        ]);
        
        const setupDone       = !!setupFlagRaw;
        const setupInProgress = !!inProgressRaw;   // killed mid-download last time
        const surveyDone      = !!surveyDoneRaw;
        
        // Treat as first install if never completed, interrupted mid-download, or missing required files.
        const isFirstInstall  = setupInProgress || (!setupDone && !isBgFullyCached());

        if (isFirstInstall) {
          if (!surveyDone) {
            setShowSurvey(true);
            return; // Do not start background download yet
          }
          // First install (or interrupted resume): gate on BG images + sound
          // card images together. Both run with high concurrency for speed.
          // After this, every sound card and every reel has its image ready.
          if (cancelled) return;

          // ── Mark setup as IN-PROGRESS before any downloads begin ──────
          // This flag survives app-kill. On next open, if it still exists
          // (i.e. we never reached the success block below), the download
          // gate will re-run instead of silently skipping.
          await AsyncStorage.setItem(SETUP_INPROGRESS_KEY, '1').catch(() => {});

          if (savedProgressRaw) {
            setDlProgress(parseFloat(savedProgressRaw) || 0);
          }

          setPhase('downloading');

          const bgCount   = Object.keys(BG_URLS).length;
          const { TOTAL_SOUND_IMAGES: soundImgCount } = require('@/lib/soundImagePreload');
          const totalFiles = bgCount + soundImgCount;

          // maxP: tracks the highest progress ever shown so it never goes backwards
          let maxP = parseFloat(savedProgressRaw || '0') || 0;
          // absolute counts — set from each phase's callback (not accumulated)
          let bgDoneCount    = 0;
          let soundDoneCount = 0;

          const updateProgress = () => {
            const raw = (bgDoneCount + soundDoneCount) / totalFiles;
            const p   = Math.min(raw, 1);
            if (p > maxP) {
              maxP = p;
              if (!cancelled) setDlProgress(maxP);
              // Persist every 5 files so setup can resume where it left off
              if ((bgDoneCount + soundDoneCount) % 5 === 0) {
                AsyncStorage.setItem(SETUP_PROGRESS_KEY, maxP.toString()).catch(() => {});
              }
            }
          };

          setDlLabel('Preparing the app for you. Listen to the Nada sound till then and calm down...');

          // Phase 1: BG images (includes its own internal retry pass for any failures)
          // bgImages.ts now continues ALL images even on network errors, so we
          // never need to loop here. Only rethrows if ALL images failed (offline).
          try {
            await ensureAllBgsCachedWithProgress((done) => {
              bgDoneCount = done;
              updateProgress();
            }, 12);
          } catch {
            // Truly offline — wait and auto-retry silently
            if (!cancelled) setDlLabel('Reconnecting...');
            await new Promise(r => setTimeout(r, 3000));
            try {
              bgDoneCount = 0; // reset for clean progress tracking on retry
              await ensureAllBgsCachedWithProgress((done) => {
                bgDoneCount = done;
                updateProgress();
              }, 12);
            } catch {
              // Still failed — proceed anyway, background re-download will fill gaps
              console.warn('[Setup] BG images still incomplete after retry, proceeding.');
            }
          }

          if (!cancelled) setDlLabel('Preparing your sounds...');

          // Phase 2: Sound card + reel images (also handles its own internal retry)
          try {
            await prefetchAllSoundImagesWithProgress((done) => {
              soundDoneCount = done;
              updateProgress();
            }, 8);
          } catch (e) {
            console.warn('[Setup] Sound images error (non-critical):', e);
          }


          if (!cancelled) {
            setDlProgress(1);
            setDlLabel('Finalizing...');
            // Wait a beat so the progress ring hits 100% visually
            await new Promise(r => setTimeout(r, 400));
          }

          if (!cancelled) {
            setDlLabel('Your transformation journey begins from now... Just listen Nada sounds.......✨');
            // Pause so ring fills to 100% and user sees completion before app opens.
            await new Promise(r => setTimeout(r, 1400));
          }

          // ── Both phases done — mark setup complete and clear in-progress ──
          await Promise.all([
            AsyncStorage.setItem(SETUP_DONE_KEY, '1').catch(() => {}),
            AsyncStorage.removeItem(SETUP_INPROGRESS_KEY).catch(() => {}),
            AsyncStorage.removeItem(SETUP_PROGRESS_KEY).catch(() => {}),
          ]);

          if (cancelled) return;

          // Background retry just in case any downloads failed during setup
          // due to flaky network. This ensures no background image is left out.
          if (!isBgFullyCached()) {
            ensureAllBgsCachedWithProgress(() => {}).catch(() => {});
          }

          // Trigger smooth fade out before revealing the app.
          // After fade completes, onFadeOutComplete sets phase to 'splash' so
          // the user gets the premium video splash screen on first launch too.
          setPhase('downloading_done');
          return;
        } else {
          // Warm sound image map — MUST be awaited before showing any UI.
          // This populates LOCAL_URI_MAP so getLocalSoundImageUri() returns
          // the local file:// path synchronously at render time.
          // Without this await, cards render with remote URLs (may fail offline).
          // ── COLD-BOOT FIX: Absolute 5-second timeout ──────────────────────────
          // warmSoundImageMap() does 50+ FileSystem.getInfoAsync calls in parallel.
          // On first cold boot after phone restart the Android filesystem/JNI
          // bridge can hang. A 5s absolute timeout ensures the startup gate always
          // advances even if the filesystem isn't fully ready yet. On subsequent
          // opens all cache hits are in-memory and the timeout never fires.
          await Promise.race([
            warmSoundImageMap(),
            new Promise<void>(resolve => setTimeout(resolve, 5000)),
          ]).catch(() => {});
          
          if (cancelled) return;
          
          // Subsequent opens — ensure the flag is set (handles upgrade from
          // older builds that had no flag but already had images on disk).
          if (!setupDone) AsyncStorage.setItem(SETUP_DONE_KEY, '1').catch(() => {});
          // Re-download any BG images that are missing silently in the background.
          if (!isBgFullyCached()) {
            ensureAllBgsCachedWithProgress(() => {}).catch(() => {});
          }
          // Sound images: warmSoundImageMap() already ran above and LOCAL_URI_MAP
          // is now populated. Kick off any missing downloads silently in the background.
          // Do NOT race this with rendering — warmSoundImageMap already ensures
          // every card gets a local path synchronously.
          prefetchAllSoundImagesWithProgress(() => {}, 8).catch(() => {});
        }

        if (cancelled) return;

        // Use whatever splash BG is available — local path if cached, remote URL
        // as instant fallback. getBgSourceSync never hangs (synchronous lookup).
        setSplashBgUri(getBgSourceSync('splash'));
        setPhase('splash');

        // Any missing sound images: download in background after UI is shown.
        // warmSoundImageMap() already ran above — cards already have local paths.
        prefetchAllSoundImagesWithProgress(() => {}, 8).catch(() => {});

      } catch {
        if (!cancelled) {
          const SETUP_DONE_KEY = 'arise_bg_setup_done_v2';
          const SETUP_INPROGRESS_KEY = 'arise_bg_setup_inprogress_v1';
          
          AsyncStorage.getItem(SETUP_DONE_KEY).then(setupDoneRaw => {
            const setupDone = !!setupDoneRaw;
            // Check inProgress again synchronously if possible, or just assume if it's not done and not splash, we need to fail
            AsyncStorage.getItem(SETUP_INPROGRESS_KEY).then(inProgressRaw => {
              const setupInProgress = !!inProgressRaw;
              const isFirstInstall = setupInProgress || (!setupDone && !isBgFullyCached());
              
              if (isFirstInstall) {
                setDlError(true);
                setDlLabel('Connection interrupted');
              } else {
                setSplashBgUri(getBgSourceSync('splash'));
                setPhase('splash');
                prefetchAllSoundImagesWithProgress(() => {}, 8).catch(() => {});
              }
            });
          });
        }
      }
    })();

    return () => { cancelled = true; };
  }, [fontsLoaded, retryTrigger, surveyFinishedSignal]);

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: Colors.bg }} />;

  // ── SETUP GATE & MAIN APP ──
  // We use a single root GestureHandlerRootView to prevent white flashes when switching phases.
  // The Stack is only mounted when phase is 'splash' or 'done' or 'downloading_done'.
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <SafeAreaProvider>
        <CrashToast />
        <StatusBar style="light" />

        {/* App stack — ALWAYS mounted so the home page renders behind the setup
            screen. When DownloadScreen fades out the home page is already fully
            painted underneath → zero blank/white gap. */}
        <AppErrorBoundary>
          <SoundPlayerProvider>
            <BgProvider>
              <GlobalMoodLayer />
              {phase !== 'gate' && (
                <AuthGuard onAuthReady={() => setAuthReady(true)} />
              )}
              <BodhiNotificationListener />

              {/* NADA animated splash (normal startup and after downloading) */}
              {(phase === 'splash' || phase === 'downloading_done') && (
                <SplashOverlay 
                  key="naad-splash" 
                  onDone={() => {
                    setPhase('done');
                  }} 
                  bgUri={splashBgUri} 
                />
              )}

              <ScreenErrorBoundary name="Navigation">
                <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.bg }, animation: 'fade' }}>
                  <Stack.Screen name="index" options={{ animation: 'none' }} />
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="alarm-ringing" options={{ animation: 'fade', gestureEnabled: false }} />
                  <Stack.Screen name="habit-alarm-ringing" options={{ animation: 'fade', gestureEnabled: false }} />
                  <Stack.Screen name="soundbath-ringing" options={{ animation: 'fade', gestureEnabled: false }} />
                  <Stack.Screen name="notification-landing" options={{ animation: 'fade', gestureEnabled: false }} />
                  <Stack.Screen name="mission" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
                  <Stack.Screen name="prakriti-quiz" options={{ animation: 'fade' }} />
                  <Stack.Screen name="cosmic-explore" options={{ animation: 'fade' }} />
                  <Stack.Screen name="cosmic-science" options={{ animation: 'fade' }} />
                  <Stack.Screen name="meditation-timer" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
                  <Stack.Screen name="step-session" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
                  <Stack.Screen name="step-analytics" options={{ animation: 'fade' }} />
                </Stack>
              </ScreenErrorBoundary>
            </BgProvider>
          </SoundPlayerProvider>
        </AppErrorBoundary>

        {/* ── SETUP OVERLAY — sits on top of the already-mounted Stack ── */}

        {/* downloading / downloading_done: first-install setup ring */}
        {(phase === 'downloading' || phase === 'downloading_done') && !showSurvey && (
          <>
            <DownloadScreen
              progress={dlProgress}
              label={dlLabel}
              isFadingOut={phase === 'downloading_done'}
              onFadeOutComplete={async () => {
                setPhase('splash');
              }}
            />
            {/* Touch blocker — prevents taps reaching the home page during setup but sits behind DownloadScreen */}
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9998 }} pointerEvents="box-only" />
          </>
        )}

        {/* Survey screen (Blocks download until finished) */}
        {showSurvey && (
          <OnboardingSurveyScreen onComplete={() => {
             AsyncStorage.setItem('arise_survey_done_v1', '1').catch(() => {});
             setShowSurvey(false);
             setSurveyFinishedSignal(prev => prev + 1);
          }} />
        )}

      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
