import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, PermissionsAndroid, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, Animated, Platform, Easing, requireNativeComponent } from 'react-native';
import { NativeEventEmitter, NativeModules } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Polyline, Defs, LinearGradient, Stop, Mask, Rect } from 'react-native-svg';
import { ScrollView } from 'react-native-gesture-handler';

const { PpgScanner } = NativeModules;
const PpgEmitter = new NativeEventEmitter(PpgScanner);
const PpgCameraPreview = requireNativeComponent<any>('PpgCameraPreview');

const SOUNDS = [
  {id:'cdn_yaman_mental',          label:'Raga Yaman',       emoji:'🪕',color:'#a78bfa',desc:'Emotional balance — scientifically tuned'},
  {id:'tibetan_dreams',            label:'Tibetan Dreams',   emoji:'🧘',color:'#818cf8',desc:'Deep Himalayan soundscape — lowers cortisol'},
  {id:'tanpura_breath',            label:'Tanpura Breath',   emoji:'🌬️',color:'#a78bfa',desc:'Soft drone — entrains slow brainwaves'},
  {id:'cdn_calm_sunrise',          label:'Calm Sunrise',     emoji:'☀️',color:'#fde68a',desc:'Indian fusion for peaceful focus'},
  {id:'om_shanti',                 label:'Om Shanti',        emoji:'🕉️',color:'#c084fc',desc:'Vedic peace chant — deeply soothing'},
];

type Phase = 'idle' | 'waiting' | 'candidate' | 'warming_up' | 'measuring' | 'processing' | 'results' | 'failed' | 'noperm';

const SCAN_W = 220;
const SCAN_H = 205;

const HEART = "M110,185 C25,135 0,85 20,50 C35,25 65,20 85,35 C95,43 102,55 110,70 C118,55 125,43 135,35 C155,20 185,25 200,50 C220,85 195,135 110,185 Z";
const INVERSE_HEART = `M-5,-5 H225 V215 H-5 Z ${HEART}`;

export default function StressScanner({ visible, onClose, onPlaySound }: any) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [scanPct, setScanPct] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [failReason, setFailReason] = useState<string|null>(null);
  const [liveHR, setLiveHR] = useState<number|null>(null);
  
  const [signalData, setSignalData] = useState<number[]>([]);
  
  // Track beat timestamps for live BPM
  const beatTimes = useRef<number[]>([]);

  const phaseRef = useRef<Phase>('idle');
  const progListener = useRef<any>(null);
  const resListener = useRef<any>(null);
  const errListener = useRef<any>(null);
  const beatListener = useRef<any>(null);

  const beatAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  // State-driven color animations
  const colorAnim = useRef(new Animated.Value(0)).current; // 0 = neutral, 1 = amber, 2 = green, 3 = red

  const go = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
    
    // Animate color based on state
    let target = 0;
    if (p === 'candidate') target = 1;
    else if (p === 'warming_up' || p === 'measuring') {
      if (phaseRef.current !== 'warming_up' && phaseRef.current !== 'measuring') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Animated.sequence([
          Animated.timing(beatAnim, { toValue: 1.15, duration: 150, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(beatAnim, { toValue: 1.0, duration: 250, easing: Easing.in(Easing.ease), useNativeDriver: true })
        ]).start();
      }
      target = 2;
      if (phaseRef.current !== 'warming_up' && phaseRef.current !== 'measuring') {
        // Haptic tap on successful placement
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Pop animation
        Animated.sequence([
          Animated.timing(beatAnim, { toValue: 1.05, duration: 150, useNativeDriver: true }),
          Animated.timing(beatAnim, { toValue: 1, duration: 150, useNativeDriver: true })
        ]).start();
      }
    }
    else if (p === 'failed' || p === 'noperm') target = 3;
    
    Animated.timing(colorAnim, {
      toValue: target,
      duration: 300,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false
    }).start();

  }, [colorAnim, beatAnim]);

  const stopAll = useCallback(() => {
    progListener.current?.remove(); progListener.current = null;
    resListener.current?.remove(); resListener.current = null;
    errListener.current?.remove(); errListener.current = null;
    beatListener.current?.remove(); beatListener.current = null;
    PpgScanner?.stopScan().catch(() => {});
  }, []);

  const resetAll = useCallback(() => {
    stopAll();
    setScanPct(0); setResult(null); setFailReason(null); setLiveHR(null);
    setSignalData([]);
    beatAnim.setValue(1);
    colorAnim.setValue(0);
  }, [stopAll, colorAnim, beatAnim]);

  useEffect(() => {
    if (visible) { resetAll(); go('idle'); Animated.timing(fadeAnim, {toValue: 1, duration: 350, useNativeDriver: true}).start(); }
    else { stopAll(); fadeAnim.setValue(0); }
  }, [visible]);

  const onProgress = useCallback((data: any) => {
    if (phaseRef.current === 'results') return;
    const { phase: p, progress, liveValue } = data;
    
    if (liveValue) {
      setSignalData(prev => {
        const next = [...prev, liveValue];
        if (next.length > 50) return next.slice(next.length - 50);
        return next;
      });
    }

    if (p === 'warming_up' || p === 'measuring') {
      go(p);
      setScanPct(progress / 100);
    } else if (p === 'candidate' || p === 'waiting' || p === 'processing') {
      go(p);
    }
  }, [go]);

  const onResult = useCallback((data: any) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    go('results');
    setLiveHR(data.heartRateBpm);
    
    let color = '#10b981';
    let label = 'Low Stress';
    let emoji = '😌';
    let subtitle = 'Your nervous system is balanced and relaxed.';
    
    if (data.stressScore > 500) {
      color = '#ef4444'; label = 'High Stress'; emoji = '⚡';
      subtitle = 'Elevated sympathetic activity detected.';
    } else if (data.stressScore > 150) {
      color = '#f59e0b'; label = 'Moderate Stress'; emoji = '🤔';
      subtitle = 'You are experiencing moderate strain.';
    }

    let hrvColor = '#3b82f6';
    let hrvLabel = 'Typical / Normal';
    let hrvSubtitle = 'In line with the general healthy adult average.';
    
    if (data.rmssd < 19) {
      hrvColor = '#8b5cf6';
      hrvLabel = 'Lower than typical';
      hrvSubtitle = 'Lower parasympathetic activity than the general adult average.';
    } else if (data.rmssd > 75) {
      hrvColor = '#0ea5e9';
      hrvLabel = 'Higher than typical';
      hrvSubtitle = 'Generally favorable, often seen in fit individuals.';
    }
    
    setResult({
      ...data, color, label, emoji, subtitle,
      hrvColor, hrvLabel, hrvSubtitle,
      advice: [
        'Take 5 deep breaths focusing on exhaling slowly.',
        'Consider a short meditation session.'
      ]
    });
  }, [go]);

  const onError = useCallback((data: any) => { if (phaseRef.current === 'results') return;
    if (data.code === 'E_NO_PERMISSION') {
      go('noperm');
    } else if (data.code === 'signal_lost') {
      // Signal lost mid-scan
      setFailReason(data.message);
      go('waiting'); // go back to waiting, but we could show a toast. For now, waiting clears it, let's keep it simple.
    } else {
      setFailReason(data.message || 'Unknown error');
      go('failed');
    }
  }, [go]);

  const onBeat = useCallback(() => {
    if (phaseRef.current === 'warming_up' || phaseRef.current === 'measuring') {
      const now = Date.now();
      beatTimes.current.push(now);
      if (beatTimes.current.length > 5) beatTimes.current.shift();
      if (beatTimes.current.length >= 3) {
        const first = beatTimes.current[0];
        const last = beatTimes.current[beatTimes.current.length - 1];
        const avgInterval = (last - first) / (beatTimes.current.length - 1);
        const bpm = Math.round(60000 / avgInterval);
        if (bpm > 40 && bpm < 200) setLiveHR(bpm);
      }
      
      Animated.sequence([
        Animated.timing(beatAnim, { toValue: 1.08, duration: 100, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(beatAnim, { toValue: 1.0, duration: 100, easing: Easing.in(Easing.ease), useNativeDriver: true }),
        Animated.delay(50),
        Animated.timing(beatAnim, { toValue: 1.04, duration: 100, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(beatAnim, { toValue: 1.0, duration: 300, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      ]).start();
    }
  }, [beatAnim]);

  const beginScan = useCallback(async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          go('noperm');
          return;
        }
      } catch (err) {
        console.warn(err);
      }
    }
    go('waiting');
    progListener.current = PpgEmitter.addListener('ppgProgress', onProgress);
    resListener.current = PpgEmitter.addListener('ppgResult', onResult);
    errListener.current = PpgEmitter.addListener('ppgError', onError);
    beatListener.current = PpgEmitter.addListener('ppgBeat', onBeat);
    try {
      await PpgScanner.startScan();
    } catch (e: any) {
      if (e.code === 'E_NO_PERMISSION') go('noperm');
      else { setFailReason(e.message); go('failed'); }
    }
  }, [resetAll, go, onProgress, onResult, onError, onBeat]);

  // Idle breathing animation when in NOT_DETECTED
  useEffect(() => {
    if (phase === 'waiting') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(beatAnim, { toValue: 1.03, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(beatAnim, { toValue: 1.0, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
    // Note: We don't force it to 1 here because the per-beat animation might be running in measuring state.
  }, [phase, beatAnim]);

  const handleClose = useCallback(() => { stopAll(); onClose(); }, [stopAll, onClose]);

  // Color interpolation
  const strokeColor = colorAnim.interpolate({
    inputRange: [0, 1, 2, 3],
    outputRange: ['#4b5563', '#fbbf24', '#10b981', '#ef4444']
  });
  
  const strokeWidth = colorAnim.interpolate({
    inputRange: [0, 1, 2, 3],
    outputRange: [2, 4, 4, 3]
  });

  // Construct graph path
  let points = '';
  if (signalData.length > 0) {
    const min = Math.min(...signalData);
    const max = Math.max(...signalData);
    const range = max - min || 1;
    const w = 300;
    const h = 80;
    points = signalData.map((val, i) => {
      const x = (i / 49) * w;
      const y = h - ((val - min) / range) * h;
      return `${x},${y}`;
    }).join(' ');
  }

  const renderIdle = () => (
    <View style={S.phase}>
      <View style={S.heroGroup}>
        <Ionicons name="pulse" size={64} color="#f43f5e" />
        <Text style={S.bigTitle}>Bio-Stress Scan</Text>
        <Text style={S.desc}>Cover the back camera and flash entirely with your index finger.</Text>
      </View>
      <TouchableOpacity style={[S.startBtn, { backgroundColor: '#f43f5e' }]} onPress={beginScan}>
        <Text style={S.startTxt}>Start Scan</Text>
      </TouchableOpacity>
      <TouchableOpacity style={S.cancelBtn} onPress={handleClose}><Text style={S.cancelTxt}>Cancel</Text></TouchableOpacity>
    </View>
  );

  const renderScanView = () => (
    <View style={S.scanPhase}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        
        {/* The Heart Camera View */}
        <View style={S.heartWrapper}>
          {Platform.OS === 'android' && (
            <View style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
              <PpgCameraPreview style={{ width: '100%', height: '100%' }} />
            </View>
          )}
          
          <Animated.View style={[S.heartMask, { transform: [{ scale: beatAnim }] }]} pointerEvents="none">
            <Svg width={SCAN_W} height={SCAN_H} viewBox="0 0 220 205">
              <Path 
                d={`M-10,-10 L-10,250 L250,250 L250,-10 Z ${HEART}`} 
                fill="#000" 
                fillRule="nonzero" 
              />
              <AnimatedPath d={HEART} fill="none" stroke={strokeColor} strokeWidth={strokeWidth} />
            </Svg>
            
            {/* Overlay Text Inside the Heart */}
            {(phase === 'warming_up' || phase === 'measuring') && (
              <View style={S.bpmOverlay}>
                <Text style={S.bpmValue}>{liveHR || '--'}</Text>
                <Text style={S.bpmLabel}>BPM</Text>
              </View>
            )}
          </Animated.View>
        </View>

        {/* Live Graph beneath the heart */}
        <View style={{ height: 80, width: 300, marginTop: 40, opacity: (phase === 'warming_up' || phase === 'measuring') ? 1 : 0 }}>
          {points ? (
            <Svg width="100%" height="100%">
              <Defs>
                <LinearGradient id="grad" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor="#10b981" stopOpacity="0" />
                  <Stop offset="0.5" stopColor="#10b981" stopOpacity="1" />
                  <Stop offset="1" stopColor="#10b981" stopOpacity="0" />
                </LinearGradient>
              </Defs>
              <Polyline points={points} fill="none" stroke="url(#grad)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          ) : null}
        </View>

      </View>
      
      {/* Bottom Status & Instruction Card */}
      <View style={S.bottomSection}>
        {phase === 'waiting' || phase === 'candidate' ? (
          <View style={{ alignItems: 'center', marginBottom: 30, minHeight: 60 }}>
            <Ionicons name={phase === 'candidate' ? 'scan-outline' : 'finger-print-outline'} size={24} color={phase === 'candidate' ? '#fbbf24' : '#fff'} style={{ marginBottom: 8 }} />
            <Text style={{ color: phase === 'candidate' ? '#fbbf24' : '#fff', fontSize: 16, fontWeight: '600' }}>
              {phase === 'candidate' ? 'Hold still...' : '👆 No finger detected'}
            </Text>
            {failReason && phase === 'waiting' && (
              <Text style={{ color: '#ef4444', fontSize: 14, marginTop: 8 }}>{failReason}</Text>
            )}
          </View>
        ) : (
          <View style={{ alignItems: 'center', marginBottom: 30, minHeight: 60 }}>
            <Text style={{ color: '#10b981', fontSize: 16, fontWeight: '600' }}>
              {phase === 'warming_up' ? 'Warming Up Sensor' : 'Collecting Data'}
            </Text>
            <Text style={{ color: '#10b981', fontSize: 14, fontWeight: '700', marginTop: 4 }}>
              {Math.round(scanPct * 100)}%
            </Text>
          </View>
        )}

        <View style={S.premiumCard}>
          <Text style={S.cardTitle}>
            Cover the camera with your finger until <Text style={{ color: '#10b981' }}>❤️</Text> turns green
          </Text>
          <View style={S.cardIllustration}>
            <Ionicons name="phone-portrait-outline" size={48} color="#444" />
            <Ionicons name="hand-right" size={32} color="#888" style={{ position: 'absolute', top: 20, right: '30%' }} />
          </View>
        </View>
        
        <TouchableOpacity style={S.cancelBtnBottom} onPress={handleClose}>
          <Text style={S.cancelTxt}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderProcessing = () => (
    <View style={[S.phase, { justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator size="large" color="#10b981" />
      <Text style={[S.bigTitle, { marginTop: 24 }]}>Analyzing HRV...</Text>
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
      <Text style={S.desc}>Native camera permission is required to measure pulse.</Text>
      <TouchableOpacity style={S.cancelBtn} onPress={handleClose}><Text style={S.cancelTxt}>Close</Text></TouchableOpacity>
    </View>
  );

  const renderResults = () => {
    if (!result) return null;
    return (
      <View style={S.phase}>
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <View style={{ alignItems: 'center', marginTop: 60, marginBottom: 40 }}>
            <Text style={{ fontSize: 48 }}>{result.emoji}</Text>
            <Text style={S.bigTitle}>{result.label}</Text>
            <Text style={S.desc}>{result.subtitle}</Text>
          </View>
          
          <View style={[S.resCard, { borderColor: result.color }]}>
            <View style={S.resRow}>
              <Text style={S.resKey}>Heart Rate</Text>
              <Text style={S.resVal}>{liveHR} BPM</Text>
            </View>
            <View style={[S.resRow, { borderBottomWidth: 0, marginTop: 12 }]}>
              <Text style={S.resKey}>Baevsky Stress Index</Text>
              <Text style={[S.resVal, { color: result.color, fontSize: 24 }]}>{result.stressScore}</Text>
            </View>
          </View>

          <Text style={S.sectionTitle}>Heart Rate Variability (HRV)</Text>
          <View style={[S.resCard, { borderColor: result.hrvColor, backgroundColor: '#161b22' }]}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: result.hrvColor, marginBottom: 4 }}>{result.hrvLabel}</Text>
            
            <View style={S.resRow}>
              <Text style={S.resKey}>RMSSD (Short-term)</Text>
              <Text style={S.resVal}>{result.rmssd} ms</Text>
            </View>
            <View style={[S.resRow, { borderBottomWidth: 0 }]}>
              <Text style={S.resKey}>SDNN (Overall)</Text>
              <Text style={S.resVal}>{result.sdnn} ms</Text>
            </View>
            
            <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#333' }}>
              <Text style={{ color: '#9ca3af', fontSize: 13, lineHeight: 20 }}>
                {result.hrvSubtitle} 
              </Text>
              <Text style={{ color: '#6b7280', fontSize: 13, lineHeight: 20, marginTop: 8, fontStyle: 'italic' }}>
                Note: This compares to the general population (Nunan et al.). A single reading is just one data point. Tracking your personal trend over time is far more meaningful.
              </Text>
            </View>
          </View>
          
          <Text style={S.sectionTitle}>What does this mean?</Text>
          <Text style={{ color: '#9ca3af', fontSize: 14, lineHeight: 22, marginBottom: 16 }}>
            The Baevsky Stress Index (SI) is a clinical measure of autonomic nervous system balance based on your Heart Rate Variability. 
            Scores between 50-150 indicate low stress and good recovery. Scores above 500 indicate high sympathetic activity (elevated stress).
            This is a general wellness indicator, not a diagnostic value.
          </Text>
          
          <Text style={S.sectionTitle}>Recommendations</Text>
          {result.advice.map((adv: any, i: number) => (
            <View key={i} style={S.adviceRow}>
              <Ionicons name="checkmark-circle" size={20} color={result.color} />
              <Text style={S.adviceTxt}>{adv}</Text>
            </View>
          ))}
        </ScrollView>
        <TouchableOpacity style={S.cancelBtn} onPress={handleClose}><Text style={S.cancelTxt}>Done</Text></TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={handleClose}>
      
      <View style={S.container}>
        {phase === 'idle' || phase === 'processing' || phase === 'failed' || phase === 'noperm' || phase === 'results' ? (
          <View style={S.sheet}>
            {phase === 'idle' && renderIdle()}
            {phase === 'processing' && renderProcessing()}
            {phase === 'results' && renderResults()}
            {phase === 'failed' && renderFailed()}
            {phase === 'noperm' && renderNoPerm()}
          </View>
        ) : (
          <View style={S.fullScreenBlack}>
            {renderScanView()}
          </View>
        )}
      </View>
    </Modal>
  );
}

const AnimatedPath = Animated.createAnimatedComponent(Path);

const S = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)' },
  container: { flex: 1, backgroundColor: '#000' },
  sheet: { flex: 1, backgroundColor: '#000', paddingTop: 60, paddingHorizontal: 24, paddingBottom: 40 },
  fullScreenBlack: { flex: 1, backgroundColor: '#000', width: '100%' },
  phase: { flex: 1, display: 'flex', flexDirection: 'column' },
  scanPhase: { flex: 1, display: 'flex', flexDirection: 'column', paddingTop: 80 },
  heroGroup: { alignItems: 'center', marginTop: 40, marginBottom: 'auto' },
  bigTitle: { fontSize: 28, fontWeight: '700', color: '#fff', marginTop: 16, marginBottom: 8, textAlign: 'center' },
  desc: { fontSize: 16, color: '#9ca3af', textAlign: 'center', paddingHorizontal: 20, lineHeight: 24 },
  startBtn: { paddingVertical: 18, borderRadius: 100, alignItems: 'center', marginBottom: 16 },
  startTxt: { color: '#000', fontSize: 18, fontWeight: '700' },
  cancelBtn: { paddingVertical: 16, alignItems: 'center' },
  cancelTxt: { color: '#9ca3af', fontSize: 16, fontWeight: '600' },
  
  // Heart UI
  heartWrapper: { width: SCAN_W, height: SCAN_H, alignSelf: 'center', overflow: 'hidden' },
  heartMask: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  bpmOverlay: { position: 'absolute', justifyContent: 'center', alignItems: 'center' },
  bpmValue: { color: '#fff', fontSize: 42, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
  bpmLabel: { color: '#ddd', fontSize: 16, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },

  // Bottom Section
  bottomSection: { padding: 24, paddingBottom: 40 },
  premiumCard: { backgroundColor: '#111', borderRadius: 24, padding: 24 },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '500', textAlign: 'center', marginBottom: 24 },
  cardIllustration: { height: 120, backgroundColor: '#1a1a1a', borderRadius: 16, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  cancelBtnBottom: { paddingVertical: 20, alignItems: 'center', marginTop: 10 },
  
  resCard: { backgroundColor: '#111', borderRadius: 20, padding: 20, borderWidth: 1, marginBottom: 30 },
  resRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#222' },
  resKey: { color: '#9ca3af', fontSize: 16 },
  resVal: { color: '#fff', fontSize: 18, fontWeight: '700' },
  sectionTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 16, marginTop: 10 },
  adviceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16, paddingRight: 20 },
  adviceTxt: { color: '#d1d5db', fontSize: 15, lineHeight: 22, flex: 1 }
});
