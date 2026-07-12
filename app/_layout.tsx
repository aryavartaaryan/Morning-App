'use client';
import { Component, useEffect, useRef, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, AppState, View, Animated, Dimensions, StyleSheet, Text, NativeModules, Linking, TouchableOpacity, Easing } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import {
  Nunito_300Light, Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold,
  Nunito_800ExtraBold, Nunito_900Black,
} from '@expo-google-fonts/nunito';
import { DancingScript_600SemiBold } from '@expo-google-fonts/dancing-script';
import * as SplashScreen from 'expo-splash-screen';
import { useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { store, KEYS } from '@/lib/storage';

import { ensureAllBgsCachedWithProgress, getBgSourceSync, ensureBgKey, isBgFullyCached, isSplashCached, bgWarmup, BG_URLS } from '@/lib/bgImages';
import { prefetchAllSoundImagesWithProgress, warmSoundImageMap, prefetchCriticalAlarmImages } from '@/lib/soundImagePreload';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { scheduleHabitReminders, setupNotificationChannel, NOTIFICATION_SPEECHES } from '@/lib/notifications';
import { getInitialAlarmNotification, requestAllAlarmPermissions, checkAndRescheduleDaily, syncNativeWakeAlarmSound, ALARM_NOTIF_ID } from '@/lib/nativeAlarm';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { scheduleAllNativeReminders, getInitialReminderNotification, REMINDER_DATA_TYPE } from '@/lib/nativeReminders';
import { speakBodhi } from '@/lib/speech';
import { Colors } from '@/constants/theme';
import { ensureAllMantrasDownloaded } from '@/lib/mantraDownload';
import { SoundPlayerProvider, useSoundPlayer } from '@/lib/soundPlayerContext';
import { BgProvider } from '@/lib/bgContext';
import { MoodSheet } from '@/components/MoodSheet';
import { CrashToast } from '@/components/CrashToast';
import { ScreenErrorBoundary } from '@/components/ScreenErrorBoundary';
import { installCrashToast, ToastLogger } from '@/lib/toastLogger';
import { installCrashShield } from '@/lib/crashShield';
import { LinearGradient } from 'expo-linear-gradient';
import type { MoodKey } from '@/components/MoodSheet';

// Prevent the native splash from auto-hiding, then immediately dismiss it.
// Our custom animated SplashOverlay (rendered below) is the ONLY splash the
// user sees. The native splash background matches the overlay bg (#04030F)
// so even the briefest frame is invisible.
SplashScreen.preventAutoHideAsync().then(() => {
  SplashScreen.hideAsync().catch(() => {});
}).catch(() => {});

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

const { height: SH } = Dimensions.get('window');

function SplashOverlay({ onDone, bgUri }: { onDone: () => void; bgUri?: string }) {
  // "Naad" text (starts visible to seamlessly match native splash, then fades out)
  const titleOp  = useRef(new Animated.Value(1)).current;
  const titleSc  = useRef(new Animated.Value(1)).current;
  
  // Combined Sequence Title
  const combinedOp    = useRef(new Animated.Value(0)).current;
  const combinedSc    = useRef(new Animated.Value(0.92)).current;
  const combinedTy    = useRef(new Animated.Value(15)).current;
  const combinedShimmerOp = useRef(new Animated.Value(0)).current;

  const footerOp = useRef(new Animated.Value(0)).current;
  
  const screenOp = useRef(new Animated.Value(1)).current;
  const screenSc = useRef(new Animated.Value(1.0)).current;

  // Animation sequence starts after component mounts
  useEffect(() => {
    // Initial delay to let the app settle
    const initialDelay = setTimeout(() => {
      // Fade out "Naad" gracefully
      Animated.parallel([
        Animated.timing(titleOp, { toValue: 0, duration: 900, delay: 400, useNativeDriver: true }),
        Animated.timing(titleSc, { toValue: 1.08, duration: 900, delay: 400, useNativeDriver: true }),
      ]).start();

      // Fade in combined text
      Animated.sequence([
        Animated.delay(1100), // wait for Naad to start fading
        
        Animated.parallel([
          Animated.timing(combinedOp, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(combinedTy, { toValue: 0, duration: 1200, useNativeDriver: true }), // Rise up
          Animated.spring(combinedSc, { toValue: 1, tension: 30, friction: 10, useNativeDriver: true }),
          Animated.timing(footerOp, { toValue: 1, duration: 1200, useNativeDriver: true }),
        ]),
        
        // Golden Shimmer effect
        Animated.timing(combinedShimmerOp, { toValue: 1, duration: 1200, useNativeDriver: true }),
        
        Animated.delay(1800), // Hold the screen for a bit so user can read both
        
        // Dismiss Splash
        Animated.parallel([
          Animated.timing(screenOp, { toValue: 0, duration: 900, useNativeDriver: true }),
          Animated.timing(screenSc, { toValue: 0.94, duration: 900, useNativeDriver: true }),
        ]),
      ]).start(() => onDone());
    }, 150);

    return () => clearTimeout(initialDelay);
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      style={[SS.overlay, { opacity: screenOp, transform: [{ scale: screenSc }] }]}
    >
      {/* Absolute Black Background for elegant premium look */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#04030F' }]} />
      
      {/* Center Content */}
      <View style={SS.center}>
        
        {/* The Native-Matching "Naad" Text */}
        <Animated.View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center', opacity: titleOp, transform: [{ scale: titleSc }] }}>
          <Text style={SS.arise}>Naad</Text>
          <Text style={[SS.tagline, { marginTop: 4, letterSpacing: 4 }]}>THE RESONANCE</Text>
        </Animated.View>

        {/* Combined Text Sequence */}
        <Animated.View style={[SS.subBlock, { position: 'absolute', opacity: combinedOp, transform: [{ scale: combinedSc }, { translateY: combinedTy }] }]}>
          <View style={{ gap: 28, alignItems: 'center' }}>
            <View style={{ position: 'relative', alignItems: 'center' }}>
              <Text style={[SS.newMainTitle, { fontSize: 32, lineHeight: 42 }]}>Align Your Rhythm{'\n'}with the Universe.</Text>
              <Animated.Text style={[SS.newMainTitle, StyleSheet.absoluteFillObject, { fontSize: 32, lineHeight: 42, color: '#fbbf24', opacity: combinedShimmerOp }]}>
                Align Your Rhythm{'\n'}with the Universe.
              </Animated.Text>
            </View>
            
            <View style={{ width: 40, height: 1, backgroundColor: 'rgba(255,255,255,0.2)' }} />
            
            <View style={{ position: 'relative', alignItems: 'center' }}>
              <Text style={[SS.newMainTitle, { fontSize: 32, lineHeight: 42 }]}>Resonate & Transform{'\n'}through the Naad.</Text>
              <Animated.Text style={[SS.newMainTitle, StyleSheet.absoluteFillObject, { fontSize: 32, lineHeight: 42, color: '#fbbf24', opacity: combinedShimmerOp }]}>
                Resonate & Transform{'\n'}through the Naad.
              </Animated.Text>
            </View>
          </View>
        </Animated.View>
        
      </View>
      
      {/* Footer */}
      <Animated.Text style={[SS.version, { opacity: footerOp }]}>NAAD  ·  V 1.0</Animated.Text>
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
  'Just listen the Naad sounds...',
  'नाद — The primordial sound of the universe',
  'Align your rhythm with the universe\'s wisdom',
  'A new dawn of conscious living awaits you',
];

function DownloadScreen({ progress, label, error, onRetry }: { progress: number; label: string; error?: boolean; onRetry?: () => void }) {
  const pulseAnim   = useRef(new Animated.Value(0)).current;
  const rot1        = useRef(new Animated.Value(0)).current;
  const rot2        = useRef(new Animated.Value(0)).current;
  const rot3        = useRef(new Animated.Value(0)).current;

  // Animated subtitle cycling
  const subtitleOp  = useRef(new Animated.Value(1)).current;
  const [subtitleIdx, setSubtitleIdx] = useState(0);

  const rippleAnims = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;

  useEffect(() => {
    Animated.loop(Animated.timing(rot1, { toValue: 1, duration: 15000, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(rot2, { toValue: 1, duration: 25000, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(rot3, { toValue: 1, duration: 10000, easing: Easing.linear, useNativeDriver: true })).start();

    // Pulse core glow
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    // Moonwater ripples
    rippleAnims.forEach((anim, i) => {
      Animated.sequence([
        Animated.delay(i * 1666),
        Animated.loop(Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration: 5000, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
          Animated.timing(anim, { toValue: 0, duration: 0,    useNativeDriver: true }),
        ])),
      ]).start();
    });

    // Subtitle fade-cycle
    const cycleSubtitle = () => {
      Animated.sequence([
        Animated.timing(subtitleOp, { toValue: 0, duration: 800, useNativeDriver: true }),
      ]).start(() => {
        setSubtitleIdx(i => (i + 1) % SETUP_SUBTITLES.length);
        Animated.timing(subtitleOp, { toValue: 1, duration: 800, useNativeDriver: true }).start();
      });
    };
    const interval = setInterval(cycleSubtitle, 4000);
    return () => clearInterval(interval);
  }, []);

  const pct = Math.round(Math.min(progress, 1) * 100);
  const SIZE = 280;
  const cx = SIZE / 2;

  // Radii
  const rMain = 110;
  const cMain = 2 * Math.PI * rMain;
  const offsetMain = cMain * (1 - Math.min(progress, 1));

  const rOuter = 125;
  const rInner1 = 95;
  const rInner2 = 85;

  const cyan = '#38bdf8';
  const deepCyan = '#0284c7';
  const brightCyan = '#bae6fd';

  return (
    <Animated.View pointerEvents="auto" style={DS.screen}>
      <LinearGradient colors={['#020617', '#0f172a', '#020617']} style={StyleSheet.absoluteFillObject} />

      {/* Ambient background glow */}
      <Animated.View style={{
        position: 'absolute', width: 400, height: 400, borderRadius: 200, backgroundColor: deepCyan, top: '25%', 
        opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.03, 0.12] }), 
        alignSelf: 'center', 
        transform: [{ scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.1] }) }]
      }} />

      <View style={DS.center}>
        <Text style={DS.appName}>NAAD</Text>
        <Animated.Text style={[DS.subTagline, { opacity: subtitleOp }]}>{SETUP_SUBTITLES[subtitleIdx]}</Animated.Text>

        <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center', marginBottom: 40 }}>
          
          {/* ── Layered aura — slim and elegant glow ── */}
          <Animated.View style={{ position: 'absolute', width: SIZE + 24, height: SIZE + 24, borderRadius: (SIZE + 24) / 2, backgroundColor: `rgba(56,189,248,0.06)`, transform: [{ scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }] }} />
          <Animated.View style={{ position: 'absolute', width: SIZE + 14, height: SIZE + 14, borderRadius: (SIZE + 14) / 2, backgroundColor: `rgba(56,189,248,0.14)`, transform: [{ scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }] }} />
          <Animated.View style={{ position: 'absolute', width: SIZE + 6, height: SIZE + 6, borderRadius: (SIZE + 6) / 2, backgroundColor: `rgba(56,189,248,0.24)`, transform: [{ scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }] }} />
          <View style={{ position: 'absolute', width: SIZE + 2, height: SIZE + 2, borderRadius: (SIZE + 2) / 2, backgroundColor: `rgba(56,189,248,0.14)` }} />

          {/* ── Inner zone — fluid core ── */}
          <View style={{
            position: 'absolute', width: rInner2 * 2, height: rInner2 * 2, borderRadius: rInner2,
            backgroundColor: `rgba(2,132,199,0.10)`,
            overflow: 'hidden',
          }}>
            {/* Inner fill gradient */}
            <LinearGradient
              colors={[`${cyan}18`, `${deepCyan}0C`, 'transparent', `${deepCyan}08`]}
              start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFillObject} />

            {/* ── Fluid Effect ── */}
            <Animated.View pointerEvents="none" style={{
              position: 'absolute', width: rInner2 * 3.2, height: rInner2 * 3.2,
              top: -rInner2 * 0.6, left: -rInner2 * 0.6,
              opacity: 0.35,
              transform: [{ rotate: rot1.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
            }}>
               <LinearGradient colors={[`${brightCyan}00`, `${brightCyan}60`, `${deepCyan}00`]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, borderRadius: rInner2 * 2 }} />
            </Animated.View>
            <Animated.View pointerEvents="none" style={{
              position: 'absolute', width: rInner2 * 3.2, height: rInner2 * 3.2,
              top: -rInner2 * 0.6, left: -rInner2 * 0.6,
              opacity: 0.3,
              transform: [{ rotate: rot2.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] }) }, { translateX: rInner2 * 0.2 }],
            }}>
               <LinearGradient colors={[`${deepCyan}00`, `${cyan}50`, `${brightCyan}00`]} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={{ flex: 1, borderRadius: rInner2 * 2 }} />
            </Animated.View>
            
            {/* ── Lunar breathing — gentle silver glow inhaling & exhaling ── */}
            <Animated.View pointerEvents="none" style={{
              position: 'absolute', width: rInner2 * 2, height: rInner2 * 2, borderRadius: rInner2,
              backgroundColor: `${brightCyan}10`,
              opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }),
            }} />
            
            {/* ── Moonwater ripples — 3 rings expanding from center ── */}
            {rippleAnims.map((anim, i) => {
              const scale   = anim.interpolate({ inputRange: [0, 1], outputRange: [0.06, 0.94] });
              const opacity = anim.interpolate({ inputRange: [0, 0.14, 0.55, 1], outputRange: [0, 0.20, 0.08, 0] });
              return (
                <Animated.View key={i} pointerEvents="none" style={{
                  position: 'absolute', width: rInner2 * 2, height: rInner2 * 2,
                  borderRadius: rInner2,
                  borderWidth: 1, borderColor: brightCyan,
                  top: 0, left: 0,
                  transform: [{ scale }], opacity,
                }} />
              );
            })}
            
            {/* ── Glass highlight — frosted arc at top simulating lens refraction ── */}
            <View pointerEvents="none" style={{
              position: 'absolute',
              width: rInner2 * 0.76, height: rInner2 * 0.18,
              borderRadius: rInner2 * 0.36,
              backgroundColor: 'rgba(255,255,255,0.055)',
              top: rInner2 * 0.04, left: rInner2 * 0.62,
              shadowColor: '#fff', shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.1, shadowRadius: 3,
            }}>
              <LinearGradient colors={['rgba(255,255,255,0.2)', 'transparent']} style={{ flex: 1, borderRadius: 20 }} />
            </View>
          </View>

          {/* SVG Elements */}
          <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ position: 'absolute' }}>
            <Defs>
              <SvgLinearGradient id="glow" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor={brightCyan} stopOpacity="1" />
                <Stop offset="50%" stopColor={cyan} stopOpacity="1" />
                <Stop offset="100%" stopColor={deepCyan} stopOpacity="1" />
              </SvgLinearGradient>
            </Defs>

            {/* Static thin track for main progress */}
            <Circle cx={cx} cy={cx} r={rMain} stroke="rgba(56,189,248,0.1)" strokeWidth={2} fill="none" />

            {/* Main Progress Arc */}
            <Circle
              cx={cx} cy={cx} r={rMain}
              stroke="url(#glow)"
              strokeWidth={4}
              fill="none"
              strokeDasharray={`${cMain}`}
              strokeDashoffset={`${offsetMain}`}
              strokeLinecap="round"
              rotation={-90}
              origin={`${cx}, ${cx}`}
            />
          </Svg>

          {/* Rotating Outer Ring (Dashed) */}
          <Animated.View style={{ position: 'absolute', width: SIZE, height: SIZE, transform: [{ rotate: rot1.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
            <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
              <Circle cx={cx} cy={cx} r={rOuter} stroke={deepCyan} strokeWidth={1} fill="none" strokeDasharray="4 8" opacity={0.6} />
              <Circle cx={cx} cy={cx} r={rOuter} stroke={cyan} strokeWidth={2} fill="none" strokeDasharray="1 30" opacity={0.8} />
            </Svg>
          </Animated.View>

          {/* Rotating Inner Ring 1 (Dashed opposite) */}
          <Animated.View style={{ position: 'absolute', width: SIZE, height: SIZE, transform: [{ rotate: rot2.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] }) }] }}>
            <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
              <Circle cx={cx} cy={cx} r={rInner1} stroke={cyan} strokeWidth={1.5} fill="none" strokeDasharray="15 15" opacity={0.3} />
              <Circle cx={cx} cy={cx} r={rInner1} stroke={brightCyan} strokeWidth={3} fill="none" strokeDasharray="0.5 45" opacity={0.9} strokeLinecap="round" />
            </Svg>
          </Animated.View>

          {/* Rotating Inner Ring 2 (Fast scanning ring) */}
          <Animated.View style={{ position: 'absolute', width: SIZE, height: SIZE, transform: [{ rotate: rot3.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
            <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
              <Circle cx={cx} cy={cx} r={rInner2} stroke={deepCyan} strokeWidth={1} fill="none" strokeDasharray="2 12" opacity={0.4} />
              {/* Scanning brackets */}
              <Circle cx={cx} cy={cx} r={rInner2} stroke={brightCyan} strokeWidth={1.5} fill="none" strokeDasharray="20 200" opacity={0.7} />
            </Svg>
          </Animated.View>

          {/* Percentage Text inside the ring */}
          <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <Text style={DS.pctNum}>{pct}</Text>
              <Text style={DS.pctSign}>%</Text>
            </View>
            <Text style={{ color: 'rgba(56,189,248,0.5)', fontSize: 9, fontFamily: 'Nunito_700Bold', letterSpacing: 2, marginTop: 4 }}>SYNCHRONIZING</Text>
          </View>
        </View>

        {/* Status */}
        {error ? (
          <View style={{ alignItems: 'center', height: 80 }}>
            <Text style={[DS.statusLabel, { color: '#ef4444', textTransform: 'uppercase', letterSpacing: 2 }]}>CONNECTION INTERRUPTED</Text>
            <TouchableOpacity onPress={onRetry} style={DS.retryBtn}>
              <Text style={DS.retryTxt}>RETRY CONNECTION</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ alignItems: 'center', height: 80 }}>
            <Text style={[DS.statusLabel, { textTransform: 'uppercase', letterSpacing: 1.5 }]}>{label}</Text>
            <Text style={DS.setupHint}>First-time setup · Takes about 30 sec</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const DS = StyleSheet.create({
  screen:      { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, alignItems: 'center', backgroundColor: '#020617' },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
  appName:     { fontSize: 32, fontFamily: 'Nunito_900Black', color: '#bae6fd', letterSpacing: 12, marginBottom: 12, opacity: 0.9 },
  subTagline:  { fontSize: 13, color: 'rgba(56,189,248,0.7)', fontFamily: 'DancingScript_600SemiBold', letterSpacing: 0.5, marginBottom: 48, textAlign: 'center', paddingHorizontal: 32, lineHeight: 20 },
  pctNum:      { fontSize: 56, color: '#FFFFFF', fontFamily: 'Nunito_300Light', letterSpacing: -1, textShadowColor: 'rgba(56,189,248,0.5)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 },
  pctSign:     { fontSize: 18, color: '#38bdf8', fontFamily: 'Nunito_400Regular', marginTop: 8, marginLeft: 2 },
  statusLabel: { fontSize: 11, color: '#38bdf8', fontFamily: 'Nunito_700Bold', opacity: 0.8 },
  setupHint:   { fontSize: 9, color: 'rgba(56,189,248,0.4)', fontFamily: 'Nunito_600SemiBold', letterSpacing: 1, marginTop: 10, textTransform: 'uppercase' },
  retryBtn:    { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: 'rgba(2,132,199,0.2)', borderRadius: 4, borderWidth: 1, borderColor: '#0284c7' },
  retryTxt:    { color: '#bae6fd', fontFamily: 'Nunito_700Bold', fontSize: 12, letterSpacing: 1 },
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
      scheduleAllNativeReminders().catch(() => {});
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
      setTimeout(() => requestAllAlarmPermissions().catch(() => {}), 2500);
      setTimeout(() => {
        ImagePicker.requestCameraPermissionsAsync().catch(() => {});
        ImagePicker.requestMediaLibraryPermissionsAsync().catch(() => {});
        // Request location permission for home page weather + walk distance tracking
        Location.requestForegroundPermissionsAsync().catch(() => {});
        // NOTE: Pedometer (Physical Activity) permission is NOT requested here.
        // It is requested contextually in walk.tsx when the user taps "Start Walk",
        // so the system dialog appears with clear user intent.
      }, 3500);
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
        // 30-minute window (was 5 min) — prevents auto-reopen even if the native
        // wasAlarmFired() flag is slow to clear after stopAlarmSound() or cancelAlarm().
        if (handled && Date.now() - Number(handled) < 1_800_000) {
          // Handled within last 30 minutes = just completed this cycle. Prevent crash loop.
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
      if (alarmRoutedRef.current) return; // already routed this alarm cycle
      if ((segments as string[]).includes('wake-alarm-ringing') || (segments as string[]).includes('alarm-ringing') || (segments as string[]).includes('mission')) return; // already on alarm/mission screen
      getInitialAlarmNotification().then(async (fired) => {
        if (fired && !alarmRoutedRef.current && !(segments as string[]).includes('wake-alarm-ringing') && !(segments as string[]).includes('alarm-ringing') && !(segments as string[]).includes('mission')) {
          // Guard: skip routing if alarm was already handled — prevents crash loop
          // caused by wasAlarmFired() persisting after a completed alarm cycle.
          const handled = await AsyncStorage.getItem('onesutra_alarm_handled_v1').catch(() => null);
          // 30-minute window — same as cold-start guard above.
          if (handled && Date.now() - Number(handled) < 1_800_000) {
            // Handled within last 30 minutes = just completed. Prevent crash loop.
            alarmRoutedRef.current = true;
            return;
          }
          const missionId = await AsyncStorage.getItem('onesutra_mission_active_v1').catch(() => null);
          alarmRoutedRef.current = true;
          if (missionId) {
            if (!(segments as string[]).includes('mission')) {
              console.log('[Layout] App foregrounded mid-mission → /mission');
              router.push(`/mission?id=${missionId}` as never);
            }
          } else {
            console.log('[Layout] App foregrounded from alarm (background path) → /wake-alarm-ringing');
            router.push('/wake-alarm-ringing' as never);
          }
        }
      }).catch(() => { });
    });
    return () => sub.remove();
  }, [segments]);

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
      if (alarmRoutedRef.current) return;
      if (segmentsRef.current.includes('wake-alarm-ringing') || segmentsRef.current.includes('alarm-ringing')) return;
      (async () => {
        const handled = await AsyncStorage.getItem('onesutra_alarm_handled_v1').catch(() => null);
        // 30-minute window — prevents deep-link from re-opening dismissed alarm
        if (handled && Date.now() - Number(handled) < 1_800_000) {
          alarmRoutedRef.current = true; return;
        }
        const fired = await getInitialAlarmNotification().catch(() => false);
        if (!fired || alarmRoutedRef.current) return;
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
          name: 'Naad Alarms',
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
//   'splash'      → all images cached, showing 7-second splash with bg image
//   'done'        → splash finished, full app visible
type AppPhase = 'gate' | 'downloading' | 'splash' | 'done';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Nunito_300Light, Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold,
    Nunito_800ExtraBold, Nunito_900Black,
    DancingScript_600SemiBold,
  });

  const [authReady,   setAuthReady]   = useState(false);
  const [phase,       setPhase]       = useState<AppPhase>('gate');
  const [dlProgress,  setDlProgress]  = useState(0);
  const [dlLabel,     setDlLabel]     = useState('Preparing...');
  const [dlError,     setDlError]     = useState(false);
  const [retryTrigger, setRetryTrigger] = useState(0);
  // Pre-resolve the splash bg URI synchronously so SplashOverlay can render
  // immediately during the 'gate' phase — eliminating the blank gap between
  // the native splash dismiss and the NAAD animated screen appearing.
  const [splashBgUri, setSplashBgUri] = useState<string>(() => {
    try { return getBgSourceSync('splash'); } catch { return ''; }
  });

  // Native splash is hidden immediately at module level (see top of file).
  // No additional hide call needed here.

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

    (async () => {
      try {
        // Alarm images — high priority, fire at any time
        prefetchCriticalAlarmImages().catch(() => {});
        // Pre-download CDN alarm sounds for offline native alarm playback
        ensureAllMantrasDownloaded().catch(() => {});

        // Fast disk-scan — no downloads, just file-existence checks (~10 ms)
        await bgWarmup;
        // Warm sound image map — MUST be awaited before showing any UI.
        // This populates LOCAL_URI_MAP so getLocalSoundImageUri() returns
        // the local file:// path synchronously at render time.
        // Without this await, cards render with remote URLs (may fail offline).
        await warmSoundImageMap();

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
        const [setupFlagRaw, inProgressRaw, savedProgressRaw] = await Promise.all([
          AsyncStorage.getItem(SETUP_DONE_KEY).catch(() => null),
          AsyncStorage.getItem(SETUP_INPROGRESS_KEY).catch(() => null),
          AsyncStorage.getItem(SETUP_PROGRESS_KEY).catch(() => null),
        ]);
        const setupDone       = !!setupFlagRaw;
        const setupInProgress = !!inProgressRaw;   // killed mid-download last time
        const splashOnDisk    = isSplashCached();
        // Treat as first install if never completed OR if interrupted mid-download.
        const isFirstInstall  = (!setupDone && !splashOnDisk) || setupInProgress;

        if (isFirstInstall) {
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

          setDlError(false);
          setPhase('downloading');

          const bgCount   = Object.keys(BG_URLS).length;
          const { TOTAL_SOUND_IMAGES: soundImgCount } = require('@/lib/soundImagePreload');
          const totalFiles = bgCount + soundImgCount;
          let completedFiles = 0;

          const tick = () => {
            completedFiles++;
            const p = Math.min(completedFiles / totalFiles, 1);
            
            // Only update the UI progress if it surpasses the visually restored progress
            // so we don't jump backwards to 0 while re-scanning cached files on startup
            if (p > (parseFloat(savedProgressRaw || '0') || 0) || completedFiles === totalFiles) {
              if (!cancelled) setDlProgress(p);
              // Save progress periodically to resume seamlessly
              if (completedFiles % 3 === 0 || completedFiles === totalFiles) {
                AsyncStorage.setItem(SETUP_PROGRESS_KEY, p.toString()).catch(() => {});
              }
            }
          };

          setDlLabel('Setting up...');
          // Phase 1: BG images (critical — splash depends on these)
          await ensureAllBgsCachedWithProgress(tick);

          if (!cancelled) setDlLabel('Preparing your sounds...');
          // Phase 2: Sound card + reel images (high concurrency for speed)
          await prefetchAllSoundImagesWithProgress(tick, 20);

          if (!cancelled) {
            setDlProgress(1);
            setDlLabel('Your transformation journey begins from now... Just listen Naad sounds.......✨');
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
          // After first-install setup, open the app immediately — skip splash.
          setPhase('done');
          return;
        } else {
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
          prefetchAllSoundImagesWithProgress(() => {}, 20).catch(() => {});
        }

        if (cancelled) return;

        // Use whatever splash BG is available — local path if cached, remote URL
        // as instant fallback. getBgSourceSync never hangs (synchronous lookup).
        setSplashBgUri(getBgSourceSync('splash'));
        setPhase('splash');

        // Any missing sound images: download in background after UI is shown.
        // warmSoundImageMap() already ran above — cards already have local paths.
        prefetchAllSoundImagesWithProgress(() => {}, 20).catch(() => {});

      } catch {
        if (!cancelled) {
          const SETUP_DONE_KEY = 'arise_bg_setup_done_v2';
          const SETUP_INPROGRESS_KEY = 'arise_bg_setup_inprogress_v1';
          
          AsyncStorage.getItem(SETUP_DONE_KEY).then(setupDoneRaw => {
            const setupDone = !!setupDoneRaw;
            const splashOnDisk = isSplashCached();
            
            // Check inProgress again synchronously if possible, or just assume if it's not done and not splash, we need to fail
            AsyncStorage.getItem(SETUP_INPROGRESS_KEY).then(inProgressRaw => {
              const setupInProgress = !!inProgressRaw;
              const isFirstInstall = (!setupDone && !splashOnDisk) || setupInProgress;
              
              if (isFirstInstall) {
                setDlError(true);
                setDlLabel('Connection interrupted');
              } else {
                setSplashBgUri(getBgSourceSync('splash'));
                setPhase('splash');
                prefetchAllSoundImagesWithProgress(() => {}, 20).catch(() => {});
              }
            });
          });
        }
      }
    })();

    return () => { cancelled = true; };
  }, [fontsLoaded, retryTrigger]);

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: Colors.bg }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <SafeAreaProvider>
      {/* CrashToast lives OUTSIDE AppErrorBoundary so it stays alive on crashes */}
      <CrashToast />
      <AppErrorBoundary>
      <SoundPlayerProvider>
        <BgProvider>
        <GlobalMoodLayer />
        <StatusBar style="light" />
        {/* AuthGuard is only mounted AFTER downloading completes so the home page
             never opens mid-setup. During 'downloading' phase the Stack renders
             but navigation is blocked until AuthGuard fires. */}
        {(phase === 'splash' || phase === 'done') && (
          <AuthGuard onAuthReady={() => setAuthReady(true)} />
        )}
        <BodhiNotificationListener />
        {/* NAAD animated splash — shown immediately during 'gate' AND 'splash'
             phases so there is zero blank gap after the native splash dismisses.
             key="splash" is stable across gate→splash so React never remounts
             the component (which would restart the animation from scratch). */}
        {(phase === 'gate' || phase === 'splash') && (
          <SplashOverlay key="naad-splash" onDone={() => setPhase('done')} bgUri={splashBgUri} />
        )}
        {/* Elegant download progress screen — first install only */}
        {phase === 'downloading' && (
          <>
            <DownloadScreen progress={dlProgress} label={dlLabel} error={dlError} onRetry={() => setRetryTrigger(prev => prev + 1)} />
            {/* Full-screen touch blocker: prevents user from tapping cards/reels during setup */}
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10000 }} pointerEvents="box-only" />
          </>
        )}
        <ScreenErrorBoundary name="Navigation">
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.bg }, animation: 'fade' }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="alarm-ringing" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="habit-alarm-ringing" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="soundbath-ringing" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="notification-landing" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="mission" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
          <Stack.Screen name="prakriti-quiz" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="cosmic-explore" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="cosmic-science" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="meditation-timer" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
          <Stack.Screen name="step-session" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
          <Stack.Screen name="step-analytics" options={{ animation: 'slide_from_right' }} />
        </Stack>
        </ScreenErrorBoundary>
        </BgProvider>
      </SoundPlayerProvider>
      </AppErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
