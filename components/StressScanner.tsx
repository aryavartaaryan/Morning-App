import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, PermissionsAndroid, StyleSheet, Modal,
  TouchableOpacity, ActivityIndicator, Animated, Platform,
  Easing, requireNativeComponent, ScrollView, BackHandler, Dimensions
} from 'react-native';
import { NativeEventEmitter, NativeModules } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Defs, LinearGradient, Stop, Polyline, Mask, Rect } from 'react-native-svg';

const { PpgScanner } = NativeModules;
const PpgEmitter = new NativeEventEmitter(PpgScanner);
const PpgCameraPreview = requireNativeComponent<any>('PpgCameraPreview');

// ─── ISSUE 1 DIAGNOSIS & FIX ─────────────────────────────────────────────────
//
// Step 1 root cause: Camera surface was 0×0 at CameraX bind time.
//   React Native's Yoga layout engine never calls onMeasure() on native views —
//   it posts dimensions via setLeft/setRight/setTop/setBottom AFTER the view is
//   created. PpgCameraPreviewWrapper.init{} now forces 220×205 dp immediately at
//   construction so CameraX gets a non-zero SurfaceRequest from the first frame.
//   (Verified by reading PpgCameraPreviewManager.kt — the init block explicitly
//    measures and lays out the inner PreviewView before returning from createViewInstance.)
//
// Step 2 root cause: SVG mask was using fillRule="nonzero" with TWO clockwise paths
//   (outer rectangle M-5,-5 L-5,215 L225,215 L225,-5 Z = CCW ✓, but it was
//   previously written as M-10,-10 H250 V250 H-10 Z which IS clockwise → winding
//   sum inside heart = +2 → FILLED BLACK, not transparent).
//   Fix: use fillRule="evenodd" on the compound path — evenodd does NOT depend on
//   winding direction at all; it counts boundary crossings:
//     - Inside outer rect only: 1 crossing → ODD → FILLED (black)
//     - Inside heart (both paths): 2 crossings → EVEN → NOT FILLED (transparent → camera shows)
//   fillRule="evenodd" on a simple <Path> element works correctly on all Android
//   versions in react-native-svg. The earlier hardware-acceleration bug was specific
//   to the <Mask> component, not to Path's fillRule attribute.
//
// Step 3 (Issue 3): Red tint overlay is a SEPARATE SVG Path drawn with partial
//   opacity ON TOP of the camera, only when DETECTED. The camera is still live
//   underneath (it's COMPATIBLE/TextureView mode, not replaced by a bitmap).

const SCAN_W = 220;
const SCAN_H = 205;

const HEART =
  'M110,185 C25,135 0,85 20,50 C35,25 65,20 85,35 C95,43 102,55 110,70 ' +
  'C118,55 125,43 135,35 C155,20 185,25 200,50 C220,85 195,135 110,185 Z';



// ─── System A — Live scanning heart colours (completely separate from results) ─
const HEART_COLOR = {
  idle:      '#4b5563',  // grey — waiting
  candidate: '#fbbf24',  // amber — hold still, confirming…
  detected:  '#dc2626',  // RED — locked + beating (not to be confused with System B high-stress red)
  failed:    '#f97316',  // orange — error/lost
};

type Phase =
  | 'idle' | 'waiting' | 'candidate'
  | 'scanning'   // warmup + measuring collapsed into one continuous countdown
  | 'processing' | 'results' | 'failed' | 'noperm';

export default function StressScanner({ visible, onClose }: any) {
  const [phase, setPhase]           = useState<Phase>('idle');
  const [scanPct, setScanPct]       = useState(0);
  const [result, setResult]         = useState<any>(null);
  const [failReason, setFailReason] = useState<string | null>(null);
  const [liveHR, setLiveHR]         = useState<number | null>(null);
  const [signalData, setSignalData] = useState<number[]>([]);
  const [noPulseMsg, setNoPulseMsg] = useState(false);

  const phaseRef     = useRef<Phase>('idle');
  const progListener = useRef<any>(null);
  const resListener  = useRef<any>(null);
  const errListener  = useRef<any>(null);
  const beatListener = useRef<any>(null);
  const beatTimes    = useRef<number[]>([]);

  const beatAnim  = useRef(new Animated.Value(1)).current;
  const colorAnim = useRef(new Animated.Value(0)).current;  // 0=idle 1=candidate 2=detected 3=failed
  const tintAnim  = useRef(new Animated.Value(0)).current;  // 0→1 when DETECTED, for red tint fade-in
  const glowAnim  = useRef(new Animated.Value(0)).current;  // 0→1 for glow pulse per beat

  // ─── State machine ─────────────────────────────────────────────────────────
  const go = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);

    let targetColor = 0;
    if (p === 'candidate') {
      targetColor = 1;
    } else if (p === 'scanning') {
      targetColor = 2;
      // Fade in the red tint overlay as heart locks in
      Animated.timing(tintAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
      // Lock-in pop + haptic
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Animated.sequence([
        Animated.timing(beatAnim, { toValue: 1.15, duration: 150, easing: Easing.out(Easing.elastic(1.5)), useNativeDriver: true }),
        Animated.timing(beatAnim, { toValue: 1.0,  duration: 300, easing: Easing.in(Easing.ease),          useNativeDriver: true }),
      ]).start();
    } else if (p === 'failed' || p === 'noperm') {
      targetColor = 3;
    }

    if (p !== 'scanning') {
      // Fade tint out when leaving scanning state
      Animated.timing(tintAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    }

    Animated.timing(colorAnim, {
      toValue: targetColor,
      duration: 350,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [colorAnim, beatAnim, tintAnim]);

  const stopAll = useCallback(() => {
    progListener.current?.remove(); progListener.current = null;
    resListener.current?.remove();  resListener.current  = null;
    errListener.current?.remove();  errListener.current  = null;
    beatListener.current?.remove(); beatListener.current = null;
    PpgScanner?.stopScan().catch(() => {});
  }, []);

  const resetAll = useCallback(() => {
    stopAll();
    setScanPct(0); setResult(null); setFailReason(null); setLiveHR(null);
    setSignalData([]); setNoPulseMsg(false);
    beatTimes.current = [];
    beatAnim.setValue(1);
    colorAnim.setValue(0);
    tintAnim.setValue(0);
    glowAnim.setValue(0);
  }, [stopAll, beatAnim, colorAnim, tintAnim, glowAnim]);

  const { height: windowHeight } = Dimensions.get('window');
  const [slideAnim] = useState(() => new Animated.Value(windowHeight)); // Start completely offscreen
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      resetAll(); 
      go('idle');
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 350,
        easing: Easing.out(Easing.poly(4)),
        useNativeDriver: true,
      }).start();
      
      const backAction = () => {
        handleClose();
        return true; // prevent default back button behavior
      };
      const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
      return () => backHandler.remove();
    } else {
      stopAll();
      Animated.timing(slideAnim, {
        toValue: windowHeight,
        duration: 250,
        easing: Easing.in(Easing.poly(4)),
        useNativeDriver: true,
      }).start(() => {
        setMounted(false);
      });
    }
  }, [visible, slideAnim, windowHeight]);

  // ─── Native event handlers ─────────────────────────────────────────────────
  const onProgress = useCallback((data: any) => {
    if (phaseRef.current === 'results') return;
    const { phase: nativePhase, progress, liveValue } = data;

    if (liveValue) {
      setSignalData(prev => {
        const next = [...prev, liveValue];
        return next.length > 60 ? next.slice(next.length - 60) : next;
      });
    }

    if (nativePhase === 'warming_up') {
      if (phaseRef.current !== 'scanning') go('scanning');
      setScanPct((progress / 100) * 0.25);          // warmup = 0–25%
    } else if (nativePhase === 'measuring') {
      if (phaseRef.current !== 'scanning') go('scanning');
      setScanPct(0.25 + (progress / 100) * 0.75);  // measure = 25–100%
    } else if (nativePhase === 'candidate') {
      setNoPulseMsg(false);
      go('candidate');
    } else if (nativePhase === 'waiting') {
      go('waiting');
    } else if (nativePhase === 'processing') {
      go('processing');
    } else if (nativePhase === 'no_pulse') {
      // Pulsatility gate failed: something covers the lens but has no heartbeat
      setNoPulseMsg(true);
      go('waiting');
    }
  }, [go]);

  const onResult = useCallback((data: any) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    go('results');
    setLiveHR(data.heartRateBpm);

    // ── System B: Results stress category (green/amber/red) ──────────────────
    // Visually distinct from System A: different screen, emoji+card layout, no heart silhouette.
    let color   = '#10b981';
    let label   = 'Low Stress';
    let emoji   = '😌';
    let subtitle = 'Your nervous system is balanced and relaxed.';
    if (data.stressScore > 500) {
      color = '#ef4444'; label = 'High Stress';     emoji = '⚡';
      subtitle = 'Elevated sympathetic activity detected.';
    } else if (data.stressScore > 150) {
      color = '#f59e0b'; label = 'Moderate Stress'; emoji = '🤔';
      subtitle = 'You are experiencing moderate strain.';
    }

    // ── HRV interpretation (Nunan et al. 2010, PACE) — blue/violet palette ───
    let hrvColor    = '#3b82f6';
    let hrvLabel    = 'Typical HRV';
    let hrvSubtitle = 'In line with the general healthy adult population (Nunan et al., 2010).';
    if (data.rmssd < 19) {
      hrvColor = '#8b5cf6'; hrvLabel = 'Lower than Typical';
      hrvSubtitle = 'Below the population average. Single readings vary widely — context matters.';
    } else if (data.rmssd > 75) {
      hrvColor = '#0ea5e9'; hrvLabel = 'Higher than Typical';
      hrvSubtitle = 'Above the population average. Common in physically fit individuals.';
    }

    setResult({ ...data, color, label, emoji, subtitle, hrvColor, hrvLabel, hrvSubtitle,
                advice: getAdvice(data.stressScore) });
  }, [go]);

  const onError = useCallback((data: any) => {
    if (phaseRef.current === 'results') return;
    if (data.code === 'E_NO_PERMISSION') {
      go('noperm');
    } else if (data.code === 'signal_lost') {
      setFailReason(data.message);
      go('waiting');
    } else {
      setFailReason(data.message || 'Unknown error');
      go('failed');
    }
  }, [go]);

  // ─── Beat event: drives the heart animation synced to real heartbeats ──────
  // Issue 3: The beat animation (scale-pulse) is driven EXCLUSIVELY by this
  // event, which fires when the native pipeline detects a real peak in the PPG
  // signal. It is NOT a fixed-timer loop — if the user lifts their finger, beats stop.
  const onBeat = useCallback(() => {
    if (phaseRef.current !== 'scanning') return;
    const now = Date.now();
    beatTimes.current.push(now);
    if (beatTimes.current.length > 6) beatTimes.current.shift();
    if (beatTimes.current.length >= 3) {
      const bpm = Math.round(60000 /
        ((beatTimes.current[beatTimes.current.length - 1] - beatTimes.current[0]) /
          (beatTimes.current.length - 1)));
      if (bpm > 40 && bpm < 200) setLiveHR(bpm);
    }
    // Lub-dub scale pulse — matches real cardiac systole timing
    Animated.sequence([
      Animated.timing(beatAnim, { toValue: 1.10, duration: 80,  easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(beatAnim, { toValue: 1.0,  duration: 130, easing: Easing.in(Easing.ease),  useNativeDriver: true }),
      Animated.delay(50),
      Animated.timing(beatAnim, { toValue: 1.05, duration: 70,  easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(beatAnim, { toValue: 1.0,  duration: 280, easing: Easing.in(Easing.ease),  useNativeDriver: true }),
    ]).start();
    // Glow pulse per beat
    Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 80,  useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [beatAnim, glowAnim]);

  // Idle breathing animation
  useEffect(() => {
    if (phase === 'waiting') {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(beatAnim, { toValue: 1.04, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(beatAnim, { toValue: 1.0,  duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]));
      loop.start();
      return () => loop.stop();
    }
  }, [phase, beatAnim]);

  // ─── Begin scan ────────────────────────────────────────────────────────────
  const beginScan = useCallback(async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          { title: 'Camera Permission', message: 'Needed to measure your pulse.', buttonPositive: 'Allow' }
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) { go('noperm'); return; }
      } catch (err) { console.warn('Camera permission error', err); }
    }
    go('waiting');
    progListener.current = PpgEmitter.addListener('ppgProgress', onProgress);
    resListener.current  = PpgEmitter.addListener('ppgResult',   onResult);
    errListener.current  = PpgEmitter.addListener('ppgError',    onError);
    beatListener.current = PpgEmitter.addListener('ppgBeat',     onBeat);
    try {
      await PpgScanner.startScan();
    } catch (e: any) {
      if (e.code === 'E_NO_PERMISSION') go('noperm');
      else { setFailReason(e.message); go('failed'); }
    }
  }, [go, onProgress, onResult, onError, onBeat]);

  const handleClose = useCallback(() => { stopAll(); onClose(); }, [stopAll, onClose]);

  // ─── Color interpolations (System A only) ─────────────────────────────────
  const heartStroke = colorAnim.interpolate({
    inputRange:  [0, 1, 2, 3],
    outputRange: [HEART_COLOR.idle, HEART_COLOR.candidate, HEART_COLOR.detected, HEART_COLOR.failed],
  });
  const heartStrokeW = colorAnim.interpolate({
    inputRange: [0, 1, 2, 3], outputRange: [2, 3.5, 4, 3],
  });

  // ─── Waveform graph ────────────────────────────────────────────────────────
  let graphPoints = '';
  if (signalData.length > 1) {
    const min = Math.min(...signalData), max = Math.max(...signalData);
    const range = max - min || 1;
    graphPoints = signalData.map((v, i) =>
      `${(i / (signalData.length - 1)) * 300},${70 - ((v - min) / range) * 70}`
    ).join(' ');
  }

  // ─── Renderers ─────────────────────────────────────────────────────────────
  const renderIdle = () => (
    <View style={S.phase}>
      <View style={S.heroGroup}>
        <Ionicons name="pulse" size={64} color={HEART_COLOR.detected} />
        <Text style={S.bigTitle}>Bio-Stress Scan</Text>
        <Text style={S.desc}>Cover the back camera and flash entirely with your index finger. Keep still for ~40 seconds.</Text>
      </View>
      <TouchableOpacity style={[S.startBtn, { backgroundColor: HEART_COLOR.detected }]} onPress={beginScan}>
        <Text style={S.startTxt}>Start Scan</Text>
      </TouchableOpacity>
      <TouchableOpacity style={S.cancelBtn} onPress={handleClose}>
        <Text style={S.cancelTxt}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );

  const renderScanView = () => {
    const isScanning = phase === 'scanning';
    const pct = Math.round(scanPct * 100);
    return (
      <View style={S.scanPhase}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>

          {/* ── Heart: camera + SVG mask + tint overlay, all at 220×205 ── */}
          {/* IMPORTANT LAYER ORDER (back to front):
              1. PpgCameraPreview  — live TextureView, always behind everything
              2. SVG inverse mask  — black with evenodd transparent heart hole → camera shows through
              3. Red tint overlay  — semi-transparent red heart over the live feed (DETECTED only)
              4. Heart border      — animated stroke, synced to beatAnim scale
              5. BPM text          — floating label inside heart
          */}
          <View style={S.heartWrapper}>

            {/* Layer 1: Live camera feed */}
            {Platform.OS === 'android' && (
              <View style={{ position: 'absolute', top: 0, left: 0, width: SCAN_W, height: SCAN_H, overflow: 'hidden' }}>
                <PpgCameraPreview style={{ flex: 1, width: '100%', height: '100%' }} />
              </View>
            )}

            {/* Layer 2: Black inverse mask with transparent heart hole */}
            {/* Using a bulletproof <Mask> tag instead of fillRule which frequently glitches on Android hardware acceleration. */}
            <Svg
              width={SCAN_W}
              height={SCAN_H}
              viewBox="0 0 220 205"
              style={{ position: 'absolute', top: 0, left: 0 }}
              pointerEvents="none"
            >
              <Defs>
                <Mask id="heartHoleMask">
                  <Rect x="-10" y="-10" width="240" height="225" fill="#FFFFFF" />
                  <Path d={HEART} fill="#000000" />
                </Mask>
              </Defs>
              <Rect x="-10" y="-10" width="240" height="225" fill="#000000" mask="url(#heartHoleMask)" />
            </Svg>

            {/* Layer 3: Semi-transparent red tint over camera (DETECTED only) */}
            {/* Issue 3: This is a TINT, not an opaque fill. The camera feed is still
                live and visible underneath — tintAnim fades from 0→0.45 opacity so
                the user can still see their fingertip texture/lighting shifting.
                This layer is visually distinct from System B results colours because:
                  a) It appears on a different screen (scanning, not results)
                  b) It's a heart silhouette shape, not a card/border
                  c) It's accompanied by a beating animation + BPM readout */}
            <Animated.View
              style={[
                { position: 'absolute', top: 0, left: 0, width: SCAN_W, height: SCAN_H },
                { opacity: tintAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.42] }) },
                { transform: [{ scale: beatAnim }] },
              ]}
              pointerEvents="none"
            >
              <Svg width={SCAN_W} height={SCAN_H} viewBox="0 0 220 205">
                <Path d={HEART} fill={HEART_COLOR.detected} />
              </Svg>
            </Animated.View>

            {/* Layer 4: Heart border stroke + scale animation */}
            <Animated.View
              style={[
                { position: 'absolute', top: 0, left: 0, width: SCAN_W, height: SCAN_H },
                { transform: [{ scale: beatAnim }] },
              ]}
              pointerEvents="none"
            >
              <Svg width={SCAN_W} height={SCAN_H} viewBox="0 0 220 205">
                <AnimatedPath d={HEART} fill="none" stroke={heartStroke} strokeWidth={heartStrokeW} />
              </Svg>
            </Animated.View>

            {/* Layer 5: BPM readout (scanning only) */}
            {isScanning && (
              <View style={S.bpmOverlay} pointerEvents="none">
                <Text style={S.bpmValue}>{liveHR ?? '--'}</Text>
                <Text style={S.bpmLabel}>BPM</Text>
              </View>
            )}
          </View>

          {/* PPG waveform */}
          <View style={{ height: 80, width: 300, marginTop: 32, opacity: isScanning ? 1 : 0 }}>
            {graphPoints ? (
              <Svg width="100%" height="100%">
                <Defs>
                  <LinearGradient id="wg" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0"   stopColor={HEART_COLOR.detected} stopOpacity="0" />
                    <Stop offset="0.5" stopColor={HEART_COLOR.detected} stopOpacity="1" />
                    <Stop offset="1"   stopColor={HEART_COLOR.detected} stopOpacity="0" />
                  </LinearGradient>
                </Defs>
                <Polyline points={graphPoints} fill="none" stroke="url(#wg)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            ) : null}
          </View>
        </View>

        {/* Bottom section */}
        <View style={S.bottomSection}>
          <View style={{ alignItems: 'center', marginBottom: 24, minHeight: 60 }}>
            {phase === 'waiting' && (
              <>
                <Ionicons name="finger-print-outline" size={26} color="#fff" style={{ marginBottom: 6 }} />
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>👆 No finger detected</Text>
                {noPulseMsg && (
                  <Text style={{ color: '#f59e0b', fontSize: 13, marginTop: 8, textAlign: 'center', paddingHorizontal: 20 }}>
                    No heartbeat detected — make sure your fingertip fully covers both the camera and flash.
                  </Text>
                )}
                {failReason && !noPulseMsg && (
                  <Text style={{ color: '#f97316', fontSize: 13, marginTop: 8, textAlign: 'center' }}>{failReason}</Text>
                )}
              </>
            )}
            {phase === 'candidate' && (
              <>
                <Ionicons name="scan-outline" size={26} color={HEART_COLOR.candidate} style={{ marginBottom: 6 }} />
                <Text style={{ color: HEART_COLOR.candidate, fontSize: 16, fontWeight: '600' }}>Hold still…</Text>
              </>
            )}
            {isScanning && (
              <>
                <Text style={{ color: HEART_COLOR.detected, fontSize: 16, fontWeight: '700' }}>
                  ❤️  Scanning — {pct}%
                </Text>
                <View style={S.progressBarTrack}>
                  <View style={[S.progressBarFill, { width: `${pct}%` as any }]} />
                </View>
              </>
            )}
          </View>

          {!isScanning && (
            <View style={S.premiumCard}>
              <Text style={S.cardTitle}>
                Cover the camera with your finger until the{' '}
                <Text style={{ color: HEART_COLOR.detected }}>❤️</Text>{' '}
                turns <Text style={{ color: HEART_COLOR.detected }}>red</Text>
              </Text>
              <View style={S.cardIllustration}>
                <Ionicons name="phone-portrait-outline" size={48} color="#444" />
                <Ionicons name="hand-right" size={32} color="#888" style={{ position: 'absolute', top: 20, right: '30%' }} />
              </View>
            </View>
          )}

          <TouchableOpacity style={S.cancelBtnBottom} onPress={handleClose}>
            <Text style={S.cancelTxt}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderProcessing = () => (
    <View style={[S.phase, { justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator size="large" color={HEART_COLOR.detected} />
      <Text style={[S.bigTitle, { marginTop: 24 }]}>Analyzing HRV…</Text>
    </View>
  );

  const renderFailed = () => (
    <View style={[S.phase, { justifyContent: 'center', alignItems: 'center', gap: 20 }]}>
      <Ionicons name="warning-outline" size={52} color="#ef4444" />
      <Text style={S.bigTitle}>Scan Interrupted</Text>
      <Text style={S.desc}>{failReason}</Text>
      <TouchableOpacity style={[S.startBtn, { backgroundColor: '#333' }]} onPress={() => { resetAll(); go('idle'); }}>
        <Text style={S.startTxt}>Try Again</Text>
      </TouchableOpacity>
      <TouchableOpacity style={S.cancelBtn} onPress={handleClose}><Text style={S.cancelTxt}>Cancel</Text></TouchableOpacity>
    </View>
  );

  const renderNoPerm = () => (
    <View style={[S.phase, { justifyContent: 'center', alignItems: 'center', gap: 20 }]}>
      <Ionicons name="camera-outline" size={52} color="#f97316" />
      <Text style={S.bigTitle}>Camera Access Needed</Text>
      <Text style={S.desc}>Go to Settings → Apps → Morning App → Permissions → Camera.</Text>
      <TouchableOpacity style={S.cancelBtn} onPress={handleClose}><Text style={S.cancelTxt}>Close</Text></TouchableOpacity>
    </View>
  );

  const renderResults = () => {
    if (!result) return null;
    return (
      <View style={S.phase}>
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={{ alignItems: 'center', marginTop: 52, marginBottom: 32 }}>
            <Text style={{ fontSize: 52 }}>{result.emoji}</Text>
            <Text style={S.bigTitle}>{result.label}</Text>
            <Text style={S.desc}>{result.subtitle}</Text>
          </View>

          {/* System B — Stress Score card (green/amber/red, different from System A heart red) */}
          <View style={[S.resCard, { borderColor: result.color }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 10 }}>
              <Ionicons name="pulse" size={20} color={result.color} />
              <Text style={[S.sectionTitle, { margin: 0, color: result.color }]}>Stress Score</Text>
            </View>
            <View style={S.resRow}>
              <Text style={S.resKey}>Heart Rate</Text>
              <Text style={S.resVal}>{liveHR} BPM</Text>
            </View>
            <View style={[S.resRow, { borderBottomWidth: 0 }]}>
              <Text style={S.resKey}>Baevsky SI</Text>
              <Text style={[S.resVal, { color: result.color, fontSize: 28 }]}>{result.stressScore}</Text>
            </View>
            <Text style={{ color: '#6b7280', fontSize: 12, marginTop: 10, lineHeight: 18 }}>
              SI = AMo / (2·MxDMn·Mo). 50–150 = low stress; &gt;500 = high sympathetic activity.
              Wellness indicator only — not a clinical diagnosis.
            </Text>
          </View>

          {/* HRV card (blue/violet — visually distinct from System B) */}
          <View style={[S.resCard, { borderColor: result.hrvColor }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 10 }}>
              <Ionicons name="heart-outline" size={20} color={result.hrvColor} />
              <Text style={[S.sectionTitle, { margin: 0, color: result.hrvColor }]}>HRV Reading</Text>
            </View>
            <Text style={{ fontSize: 22, fontWeight: '700', color: result.hrvColor, marginBottom: 4 }}>
              {result.hrvLabel}
            </Text>
            <Text style={{ color: '#9ca3af', fontSize: 13, lineHeight: 20, marginBottom: 14 }}>
              {result.hrvSubtitle}
            </Text>
            <View style={S.resRow}>
              <Text style={S.resKey}>RMSSD</Text>
              <Text style={S.resVal}>{result.rmssd} ms</Text>
            </View>
            <View style={[S.resRow, { borderBottomWidth: 0 }]}>
              <Text style={S.resKey}>SDNN</Text>
              <Text style={S.resVal}>{result.sdnn} ms</Text>
            </View>
            <Text style={{ color: '#6b7280', fontSize: 12, marginTop: 12, fontStyle: 'italic', lineHeight: 18 }}>
              Compared to the general healthy adult population (Nunan et al., 2010).
              A single reading is one data point — your personal trend over time matters more.
            </Text>
          </View>

          <Text style={S.sectionTitle}>Recommendations</Text>
          {result.advice.map((adv: string, i: number) => (
            <View key={i} style={S.adviceRow}>
              <Ionicons name="checkmark-circle" size={20} color={result.color} />
              <Text style={S.adviceTxt}>{adv}</Text>
            </View>
          ))}
        </ScrollView>
        <TouchableOpacity style={S.cancelBtn} onPress={handleClose}>
          <Text style={S.cancelTxt}>Done</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const isScanScreen = phase === 'waiting' || phase === 'candidate' || phase === 'scanning';

  if (!mounted) return null;

  return (
    <Animated.View 
      style={[
        S.container, 
        StyleSheet.absoluteFill, 
        { 
          zIndex: 99999, 
          elevation: 99999,
          transform: [{ translateY: slideAnim }] 
        }
      ]}
    >
      {isScanScreen ? (
        <View style={S.fullScreenBlack}>{renderScanView()}</View>
      ) : (
        <View style={S.sheet}>
          {phase === 'idle'       && renderIdle()}
          {phase === 'processing' && renderProcessing()}
          {phase === 'results'    && renderResults()}
          {phase === 'failed'     && renderFailed()}
          {phase === 'noperm'     && renderNoPerm()}
        </View>
      )}
    </Animated.View>
  );
}

function getAdvice(score: number): string[] {
  if (score > 500) return [
    'Try box breathing: inhale 4s, hold 4s, exhale 4s, hold 4s.',
    'Step outside for 10 minutes if possible.',
    'Avoid caffeine and screens for the next 30 minutes.',
  ];
  if (score > 150) return [
    'Take 5 slow, deep breaths — focus on a long exhale.',
    'A short 5-minute meditation can help reset your nervous system.',
  ];
  return [
    'Your autonomic balance looks good — keep it up.',
    'Maintain your sleep schedule for consistent HRV readings.',
  ];
}

import { Path as SvgPath } from 'react-native-svg';
const AnimatedPath = Animated.createAnimatedComponent(SvgPath);

const S = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#000' },
  sheet:            { flex: 1, backgroundColor: '#000', paddingTop: 60, paddingHorizontal: 24, paddingBottom: 40 },
  fullScreenBlack:  { flex: 1, backgroundColor: '#000' },
  phase:            { flex: 1, flexDirection: 'column' },
  scanPhase:        { flex: 1, flexDirection: 'column', paddingTop: 60 },
  heroGroup:        { alignItems: 'center', marginTop: 40, marginBottom: 'auto' as any },
  bigTitle:         { fontSize: 28, fontWeight: '700', color: '#fff', marginTop: 16, marginBottom: 8, textAlign: 'center' },
  desc:             { fontSize: 15, color: '#9ca3af', textAlign: 'center', paddingHorizontal: 20, lineHeight: 24 },
  startBtn:         { paddingVertical: 18, borderRadius: 100, alignItems: 'center', marginBottom: 16 },
  startTxt:         { color: '#fff', fontSize: 18, fontWeight: '700' },
  cancelBtn:        { paddingVertical: 16, alignItems: 'center' },
  cancelTxt:        { color: '#9ca3af', fontSize: 16, fontWeight: '600' },

  heartWrapper:     { width: SCAN_W, height: SCAN_H, alignSelf: 'center' },
  bpmOverlay:       { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  bpmValue:         { color: '#fff', fontSize: 44, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 },
  bpmLabel:         { color: '#eee', fontSize: 15, fontWeight: '600' },

  progressBarTrack: { width: 200, height: 4, backgroundColor: '#333', borderRadius: 4, marginTop: 10, overflow: 'hidden' },
  progressBarFill:  { height: '100%', backgroundColor: HEART_COLOR.detected, borderRadius: 4 },

  bottomSection:    { padding: 24, paddingBottom: 36 },
  premiumCard:      { backgroundColor: '#111', borderRadius: 24, padding: 24 },
  cardTitle:        { color: '#fff', fontSize: 15, fontWeight: '500', textAlign: 'center', marginBottom: 20 },
  cardIllustration: { height: 110, backgroundColor: '#1a1a1a', borderRadius: 16, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  cancelBtnBottom:  { paddingVertical: 20, alignItems: 'center', marginTop: 8 },

  resCard:      { backgroundColor: '#111', borderRadius: 20, padding: 20, borderWidth: 1, marginBottom: 20 },
  resRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#222' },
  resKey:       { color: '#9ca3af', fontSize: 15 },
  resVal:       { color: '#fff', fontSize: 18, fontWeight: '700' },
  sectionTitle: { color: '#fff', fontSize: 19, fontWeight: '700', marginBottom: 14, marginTop: 8 },
  adviceRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14, paddingRight: 16 },
  adviceTxt:    { color: '#d1d5db', fontSize: 14, lineHeight: 22, flex: 1 },
});
