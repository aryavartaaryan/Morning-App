import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, Animated, Platform, Easing, requireNativeComponent } from 'react-native';
import { NativeEventEmitter, NativeModules } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Polyline, Defs, LinearGradient, Stop } from 'react-native-svg';
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

const accentColor = '#f43f5e';
const SCAN_W = 200;
const SCAN_H = 190;

const HEART = "M100,170 C25,125 0,80 20,48 C32,26 58,22 80,36 C88,42 95,54 100,68 C105,54 112,42 120,36 C142,22 168,26 180,48 C200,80 175,125 100,170 Z";
const INVERSE_HEART = `M-5,-5 H205 V195 H-5 Z ${HEART}`;

export default function StressScanner({ visible, onClose, onPlaySound }: any) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [scanPct, setScanPct] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [failReason, setFailReason] = useState<string|null>(null);
  const [liveHR, setLiveHR] = useState<number|null>(null);
  
  // Graph state
  const [signalData, setSignalData] = useState<number[]>([]);

  const phaseRef = useRef<Phase>('idle');
  const progListener = useRef<any>(null);
  const resListener = useRef<any>(null);
  const errListener = useRef<any>(null);

  const beatAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const go = useCallback((p: Phase) => { phaseRef.current = p; setPhase(p); }, []);

  const stopAll = useCallback(() => {
    progListener.current?.remove(); progListener.current = null;
    resListener.current?.remove(); resListener.current = null;
    errListener.current?.remove(); errListener.current = null;
    PpgScanner?.stopScan().catch(() => {});
  }, []);

  const resetAll = useCallback(() => {
    stopAll();
    setScanPct(0); setResult(null); setFailReason(null); setLiveHR(null);
    setSignalData([]);
    beatAnim.setValue(1);
  }, [stopAll]);

  useEffect(() => {
    if (visible) { resetAll(); go('idle'); Animated.timing(fadeAnim, {toValue: 1, duration: 350, useNativeDriver: true}).start(); }
    else { stopAll(); fadeAnim.setValue(0); }
  }, [visible]);

  const onProgress = useCallback((data: any) => {
    const { phase: p, progress, liveValue } = data;
    
    if (liveValue) {
      setSignalData(prev => {
        const next = [...prev, liveValue];
        if (next.length > 50) return next.slice(next.length - 50);
        return next;
      });
    }

    if (p === 'warming_up') {
      go('warming_up');
      setScanPct(progress / 100);
    } else if (p === 'measuring') {
      go('measuring');
      setScanPct(progress / 100);
    } else if (p === 'candidate') {
      go('candidate');
    } else if (p === 'waiting') {
      go('waiting');
    } else if (p === 'processing') {
      go('processing');
    }
  }, [go]);

  const onResult = useCallback((data: any) => {
    go('results');
    setLiveHR(data.heartRateBpm);
    setResult({
      emoji: '🌿',
      label: 'Scan Complete',
      subtitle: data.stressBand === 'High' ? 'High Stress Detected' : data.stressBand === 'Moderate' ? 'Moderate Stress Detected' : 'Low Stress Detected',
      color: data.stressBand === 'High' ? '#ef4444' : data.stressBand === 'Moderate' ? '#f59e0b' : '#10b981',
      score: data.stressScore,
      hrv: data.rmssd,
      advice: [
        'Take 5 deep breaths focusing on exhaling slowly.',
        'Try to relax your shoulders and jaw.',
        'Consider a 5-minute meditation session.'
      ],
      sounds: ['s1', 's2']
    });
  }, [go]);

  const onError = useCallback((data: any) => {
    if (data.code === 'E_NO_PERMISSION') {
      go('noperm');
    } else {
      setFailReason(data.message || 'Unknown error');
      go('failed');
    }
  }, [go]);

  const beginScan = useCallback(async () => {
    go('waiting');
    progListener.current = PpgEmitter.addListener('ppgProgress', onProgress);
    resListener.current = PpgEmitter.addListener('ppgResult', onResult);
    errListener.current = PpgEmitter.addListener('ppgError', onError);
    try {
      await PpgScanner.startScan();
    } catch (e: any) {
      if (e.code === 'E_NO_PERMISSION') go('noperm');
      else { setFailReason(e.message); go('failed'); }
    }
  }, [resetAll, go, onProgress, onResult, onError]);

  // Premium heartbeat animation during scan
  useEffect(() => {
    if (phase === 'warming_up' || phase === 'measuring') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(beatAnim, { toValue: 1.1, duration: 150, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(beatAnim, { toValue: 1.0, duration: 150, easing: Easing.in(Easing.ease), useNativeDriver: true }),
          Animated.delay(100),
          Animated.timing(beatAnim, { toValue: 1.05, duration: 150, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(beatAnim, { toValue: 1.0, duration: 550, easing: Easing.in(Easing.ease), useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
    Animated.spring(beatAnim, { toValue: 1, friction: 5, useNativeDriver: true }).start();
  }, [phase]);

  const handleClose = useCallback(() => { stopAll(); onClose(); }, [stopAll, onClose]);

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
        <Ionicons name="pulse" size={64} color={accentColor} />
        <Text style={S.bigTitle}>Bio-Stress Scan</Text>
        <Text style={S.desc}>Cover the back camera and flash entirely with your index finger.</Text>
      </View>
      <TouchableOpacity style={[S.startBtn, { backgroundColor: accentColor }]} onPress={beginScan}>
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
            <View style={StyleSheet.absoluteFill}>
              <PpgCameraPreview style={{ flex: 1 }} />
            </View>
          )}
          
          <Animated.View style={[S.heartMask, { transform: [{ scale: beatAnim }] }]} pointerEvents="none">
            <Svg width={SCAN_W} height={SCAN_H} viewBox="0 0 200 190">
              {/* This cuts the transparent hole exactly in the shape of the heart */}
              <Path d={INVERSE_HEART} fill="#000" fillRule="evenodd" />
              <Path d={HEART} fill="none" stroke={accentColor} strokeWidth="3" />
            </Svg>
            
            {/* Overlay Text Inside the Heart */}
            {(phase === 'warming_up' || phase === 'measuring') && (
              <View style={S.bpmOverlay}>
                <Text style={S.bpmValue}>--</Text>
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
                  <Stop offset="0" stopColor={accentColor} stopOpacity="0" />
                  <Stop offset="0.5" stopColor={accentColor} stopOpacity="1" />
                  <Stop offset="1" stopColor={accentColor} stopOpacity="0" />
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
          <View style={{ alignItems: 'center', marginBottom: 30 }}>
            <Ionicons name="finger-print-outline" size={24} color="#fff" style={{ marginBottom: 8 }} />
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
              {phase === 'candidate' ? 'Hold still...' : '👆 No finger detected'}
            </Text>
          </View>
        ) : (
          <View style={{ alignItems: 'center', marginBottom: 30 }}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
              {phase === 'warming_up' ? 'Warming Up Sensor' : 'Collecting Data'}
            </Text>
            <Text style={{ color: accentColor, fontSize: 14, fontWeight: '700', marginTop: 4 }}>
              {Math.round(scanPct * 100)}%
            </Text>
          </View>
        )}

        <View style={S.premiumCard}>
          <Text style={S.cardTitle}>
            Cover the camera with your finger until <Text style={{ color: accentColor }}>❤️</Text> turns red
          </Text>
          <View style={S.cardIllustration}>
            {/* Placeholder for hand illustration */}
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
      <ActivityIndicator size="large" color={accentColor} />
      <Text style={[S.bigTitle, { marginTop: 24 }]}>Analyzing HRV...</Text>
    </View>
  );

  const renderFailed = () => (
    <View style={[S.phase, { justifyContent: 'center', alignItems: 'center', gap: 20 }]}>
      <Ionicons name="warning-outline" size={52} color="#ef4444" />
      <Text style={S.bigTitle}>Scan Failed</Text>
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
              <Text style={S.resKey}>HRV (RMSSD)</Text>
              <Text style={S.resVal}>{result.hrv} ms</Text>
            </View>
            <View style={S.resRow}>
              <Text style={S.resKey}>Heart Rate</Text>
              <Text style={S.resVal}>{liveHR} BPM</Text>
            </View>
            <View style={[S.resRow, { borderBottomWidth: 0, marginTop: 12 }]}>
              <Text style={S.resKey}>Stress Score</Text>
              <Text style={[S.resVal, { color: result.color, fontSize: 24 }]}>{result.score}/100</Text>
            </View>
          </View>
          
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
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <Animated.View style={[S.backdrop, { opacity: fadeAnim }]} />
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

const S = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)' },
  container: { flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#111', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, height: '90%' },
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
