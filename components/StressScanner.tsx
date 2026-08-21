/**
 * StressScanner.tsx — v7 "Native Camera2 + Crash Fixed"
 *
 * ROOT CAUSE FIXES:
 * 1. FATAL animation crash → scan couldn't start:
 *    The glowRing Animated.View had BOTH backgroundColor (useNativeDriver:false)
 *    AND transform.scale (useNativeDriver:true) on the SAME view. React Native
 *    forbids mixing native/non-native drivers on a single animated node.
 *    FIX: Removed heartColor entirely. All animations now use useNativeDriver:true
 *    (opacity + transform only). Heart SVG colors are controlled by React state.
 *
 * 2. No camera preview in heart:
 *    FIX: Added PpgCameraPreview native component (PpgCameraPreviewManager.kt)
 *    which attaches a CameraX PreviewView as a React Native native component.
 *    This shows live camera feed inside the circular heart area.
 *
 * 3. Scan engine: 10fps via native CameraX ImageAnalysis → zero shutter/click.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet,
  Dimensions, Animated, Easing, Platform, ScrollView,
  ActivityIndicator, NativeModules, DeviceEventEmitter,
  NativeEventSubscription, requireNativeComponent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const { PpgScanner } = NativeModules;
// Native CameraX PreviewView — live camera feed, zero shutter sound
const PpgCameraPreview = requireNativeComponent<{ style?: any }>('PpgCameraPreview');

const { width: W } = Dimensions.get('window');

// ── Constants ──────────────────────────────────────────────────────────────
const CALIBRATION_FRAMES = 30;   // 3 s @ 10fps
const FINGER_HOLD_FRAMES = 8;    // 0.8 s hold before scan starts
const SCAN_DURATION_MS   = 45000;
const RESUME_TIMEOUT_S   = 10;
const BRIGHTNESS_RATIO   = 1.35; // finger brightness > baseline × 1.35
const MIN_PEAKS          = 10;
const PEAK_MIN_GAP       = 5;    // 500ms → max 120 BPM
const CIRCLE_SIZE        = 220;  // camera preview circle diameter

// ── Types ──────────────────────────────────────────────────────────────────
type Phase = 'idle'|'waiting'|'scanning'|'paused'|'processing'|'results'|'failed'|'noperm';
type FailReason = 'signal_noisy'|'finger_removed'|null;

// ── Stress engine ──────────────────────────────────────────────────────────
type StressTier = {
  score:number; label:string; subtitle:string; color:string;
  gradient:readonly[string,string,string]; emoji:string; hrv:number;
  advice:string[]; sounds:string[]; breathTechnique:string; affirmation:string;
};
function getStressTier(rmssd:number): StressTier {
  const score = Math.round(Math.max(0,Math.min(100,
    rmssd>60?5: rmssd>50?14: rmssd>42?24: rmssd>35?35:
    rmssd>28?48: rmssd>20?60: rmssd>14?72: rmssd>8?85: 95
  )));
  if (score<=20) return { score,label:'Deep Calm',subtitle:'Parasympathetic Dominance',
    color:'#34d399',gradient:['#064E3B','#065F46','#047857'] as const,emoji:'🧘',hrv:Math.round(rmssd),
    advice:['Your nervous system is in perfect recovery mode.','Ideal window for creative work or deep meditation.','Consider journaling to anchor this calm state.','Cortisol is at its daily low — protect this window.'],
    sounds:['cdn_yaman_mental','tibetan_dreams','tanpura_breath'],
    breathTechnique:'4-7-8 — Inhale 4s · Hold 7s · Exhale 8s',affirmation:'You are at peace. Your body is fully restored.' };
  if (score<=38) return { score,label:'Balanced',subtitle:'Healthy Autonomic Rhythm',
    color:'#60a5fa',gradient:['#1E3A5F','#1D4ED8','#2563EB'] as const,emoji:'⚖️',hrv:Math.round(rmssd),
    advice:['Stress response is well-regulated.','Excellent time for focus and decision-making.','Stay hydrated — dehydration drops HRV quickly.','A 10-minute walk will push this even higher.'],
    sounds:['cdn_calm_sunrise','sitar_calm','tanpura_breath'],
    breathTechnique:'Box Breathing — 4s in · 4s hold · 4s out · 4s hold',affirmation:'You are grounded. Your mind is clear.' };
  if (score<=55) return { score,label:'Mildly Elevated',subtitle:'Light Sympathetic Activation',
    color:'#fbbf24',gradient:['#78350F','#B45309','#D97706'] as const,emoji:'🌤️',hrv:Math.round(rmssd),
    advice:['Sympathetic system slightly elevated.','Common after screen time or coffee.','Step away from screens for 10 minutes.','Slow breathing restores HRV within minutes.'],
    sounds:['cdn_yaman_mental','tanpura_mystic_meditation','om_shanti'],
    breathTechnique:'Resonance Breathing — 5s in · 5s out (10 cycles)',affirmation:'You notice the tension. That noticing is already healing.' };
  if (score<=70) return { score,label:'Elevated Stress',subtitle:'Sympathetic Stress Response',
    color:'#f97316',gradient:['#7C2D12','#C2410C','#EA580C'] as const,emoji:'⚡',hrv:Math.round(rmssd),
    advice:['Cortisol and adrenaline are elevated.','Avoid high-stakes decisions right now.','Splash cold water — triggers the dive reflex.','5 min of slow music reduces cortisol measurably.'],
    sounds:['om_shanti','tibetan_dreams','cdn_hansdhwani_432'],
    breathTechnique:'4-6 Breathing — Inhale 4s · Exhale 6s (vagus nerve reset)',affirmation:'This is temporary. Your body knows how to return.' };
  return { score,label:'High Stress',subtitle:'Autonomic Suppression Detected',
    color:'#ef4444',gradient:['#7F1D1D','#B91C1C','#DC2626'] as const,emoji:'🔴',hrv:Math.round(rmssd),
    advice:['Full fight-or-flight mode detected.','Do NOT make important decisions right now.','Stop all screens immediately.','Lie down, close your eyes, breathe slowly for 5 minutes.'],
    sounds:['om_shanti','tibetan_dreams','cdn_yaman_mental'],
    breathTechnique:'Physiological Sigh — Double inhale · Long slow exhale',affirmation:'You are safe. Right now, in this moment, you are safe.' };
}

// ── Signal processing ──────────────────────────────────────────────────────
function iirLP(signal: number[], a = 0.25): number[] {
  const out: number[] = []; let p = signal[0] ?? 0;
  for (const v of signal) { const s = a * v + (1 - a) * p; out.push(s); p = s; }
  return out;
}
function detectPeaks(sig: number[], minGap: number): number[] {
  const pk: number[] = [];
  for (let i = 2; i < sig.length - 2; i++) {
    if (sig[i]>sig[i-1] && sig[i]>sig[i-2] && sig[i]>sig[i+1] && sig[i]>sig[i+2])
      if (!pk.length || i - pk[pk.length-1] >= minGap) pk.push(i);
  }
  return pk;
}
function calcRMSSD(peakIdxs: number[], timestamps: number[]): number {
  if (peakIdxs.length < 3) return 0;
  const rr = peakIdxs.slice(1).map((p, i) => timestamps[p] - timestamps[peakIdxs[i]])
    .filter(r => r > 250 && r < 2500);
  if (rr.length < 2) return 0;
  const d = rr.slice(1).map((r, i) => Math.pow(r - rr[i], 2));
  return Math.sqrt(d.reduce((a, b) => a + b) / d.length);
}

// ── Sound catalogue ────────────────────────────────────────────────────────
const SOUNDS = [
  {id:'cdn_yaman_mental',   label:'Raga Yaman',      emoji:'🪕',color:'#a78bfa',desc:'Emotional balance — scientifically tuned'},
  {id:'tibetan_dreams',     label:'Tibetan Dreams',  emoji:'🧘',color:'#818cf8',desc:'Deep Himalayan soundscape — lowers cortisol'},
  {id:'tanpura_breath',     label:'Tanpura Breath',  emoji:'🌬️',color:'#a78bfa',desc:'Soft drone — entrains slow brainwaves'},
  {id:'cdn_calm_sunrise',   label:'Calm Sunrise',    emoji:'☀️',color:'#fde68a',desc:'Indian fusion for peaceful focus'},
  {id:'om_shanti',          label:'Om Shanti',       emoji:'🕉️',color:'#c084fc',desc:'Vedic peace chant — deeply soothing'},
  {id:'cdn_hansdhwani_432', label:'Hansdhwani 432Hz',emoji:'🎻',color:'#f59e0b',desc:'Healing resonance — removes negative energy'},
  {id:'tanpura_mystic_meditation',label:'Mystic Tanpura',emoji:'🌌',color:'#818cf8',desc:'Ethereal waves — parasympathetic activator'},
];

// ── Props ──────────────────────────────────────────────────────────────────
export interface StressScannerProps {
  visible: boolean;
  onClose: () => void;
  onPlaySound?: (id: string) => void;
  accentColor?: string;
}

// ══════════════════════════════════════════════════════════════════════════
export default function StressScanner({
  visible, onClose, onPlaySound, accentColor = '#34d399',
}: StressScannerProps) {

  // ── State ──────────────────────────────────────────────────────────────
  const [phase,        setPhase]        = useState<Phase>('idle');
  const [isFingerOn,   setIsFingerOn]   = useState(false);
  const [isCalibrating,setIsCalibrating]= useState(false);
  const [liveHR,       setLiveHR]       = useState<number|null>(null);
  const [scanPct,      setScanPct]      = useState(0);
  const [resumeSecs,   setResumeSecs]   = useState(RESUME_TIMEOUT_S);
  const [result,       setResult]       = useState<StressTier|null>(null);
  const [failReason,   setFailReason]   = useState<FailReason>(null);
  const [holdPct,      setHoldPct]      = useState(0);

  // ── Refs ───────────────────────────────────────────────────────────────
  const phaseRef       = useRef<Phase>('idle');
  const running        = useRef(false);
  const listener       = useRef<NativeEventSubscription|null>(null);
  const calibBuf       = useRef<number[]>([]);
  const baseline       = useRef(0);
  const fingerCount    = useRef(0);
  const signalBuf      = useRef<number[]>([]);
  const timestampBuf   = useRef<number[]>([]);
  const scanStart      = useRef(0);
  const scanPctRef     = useRef(0);
  const resumeTimer    = useRef<ReturnType<typeof setInterval>|null>(null);
  const progressTimer  = useRef<ReturnType<typeof setInterval>|null>(null);

  // ── Animations — ALL useNativeDriver:true (opacity + transform only) ───
  // FIX: Removed heartColor (was useNativeDriver:false mixed with native on same View → FATAL crash)
  // Now: fingerGlow drives opacity of glow circle (native), beatAnim/ringAnim drive scale (native)
  // Heart SVG colors are controlled by React state — no animation driver conflict possible.
  const fingerGlow = useRef(new Animated.Value(0)).current; // 0=no finger, 1=finger on
  const beatAnim   = useRef(new Animated.Value(1)).current; // scale pulse with HR
  const ringAnim   = useRef(new Animated.Value(0)).current; // idle ring pulse
  const glowAnim   = useRef(new Animated.Value(0)).current; // results fade-in
  const fadeAnim   = useRef(new Animated.Value(0)).current; // modal fade-in

  // Finger glow: native opacity animation
  useEffect(() => {
    Animated.timing(fingerGlow, {
      toValue: isFingerOn ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isFingerOn]);

  // Beat animation synced to live HR
  useEffect(() => {
    if (liveHR && isFingerOn) {
      const dur = 60000 / liveHR;
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(beatAnim, {toValue:1.08, duration:dur*0.2, useNativeDriver:true, easing:Easing.out(Easing.quad)}),
        Animated.timing(beatAnim, {toValue:1.0,  duration:dur*0.8, useNativeDriver:true, easing:Easing.in(Easing.quad)}),
      ]));
      loop.start();
      return () => { loop.stop(); Animated.timing(beatAnim,{toValue:1,duration:300,useNativeDriver:true}).start(); };
    } else {
      Animated.timing(beatAnim, {toValue:1, duration:400, useNativeDriver:true}).start();
    }
  }, [liveHR, isFingerOn]);

  // Idle ring pulse
  useEffect(() => {
    if (phase === 'waiting' && !isFingerOn) {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(ringAnim, {toValue:1, duration:1100, useNativeDriver:true}),
        Animated.timing(ringAnim, {toValue:0, duration:1100, useNativeDriver:true}),
      ]));
      loop.start();
      return () => loop.stop();
    }
    Animated.timing(ringAnim, {toValue:0, duration:400, useNativeDriver:true}).start();
  }, [phase, isFingerOn]);

  // ── Helpers ────────────────────────────────────────────────────────────
  const go = useCallback((p: Phase) => { phaseRef.current = p; setPhase(p); }, []);

  const stopAll = useCallback(() => {
    running.current = false;
    listener.current?.remove(); listener.current = null;
    if (resumeTimer.current)  { clearInterval(resumeTimer.current);  resumeTimer.current  = null; }
    if (progressTimer.current){ clearInterval(progressTimer.current); progressTimer.current= null; }
    PpgScanner?.stopScan().catch(() => {});
  }, []);

  const resetAll = useCallback(() => {
    stopAll();
    calibBuf.current    = [];
    signalBuf.current   = [];
    timestampBuf.current= [];
    baseline.current    = 0;
    fingerCount.current = 0;
    scanPctRef.current  = 0;
    setIsFingerOn(false); setIsCalibrating(false); setLiveHR(null);
    setScanPct(0); setHoldPct(0); setResult(null); setFailReason(null);
    // Reset all animations (all native driver compatible)
    fingerGlow.setValue(0);
    beatAnim.setValue(1);
    ringAnim.setValue(0);
    glowAnim.setValue(0);
  }, [stopAll]);

  useEffect(() => {
    if (visible) {
      resetAll(); go('idle');
      Animated.timing(fadeAnim, {toValue:1, duration:350, useNativeDriver:true}).start();
    } else {
      stopAll(); fadeAnim.setValue(0);
    }
  }, [visible]);

  // ── Scan lifecycle ─────────────────────────────────────────────────────
  const processScan = useCallback(() => {
    go('processing');
    setTimeout(() => {
      const buf = signalBuf.current, ts = timestampBuf.current;
      if (buf.length < 20) { setFailReason('signal_noisy'); go('failed'); return; }
      const fl    = iirLP(buf);
      const peaks = detectPeaks(fl, PEAK_MIN_GAP);
      if (peaks.length < MIN_PEAKS) { setFailReason('signal_noisy'); go('failed'); return; }
      const rmssd = calcRMSSD(peaks, ts);
      if (rmssd <= 0) { setFailReason('signal_noisy'); go('failed'); return; }
      const last  = peaks.slice(-5);
      const avgRR = last.slice(1).map((p, i) => ts[p] - ts[last[i]]).reduce((a,b)=>a+b) / Math.max(1, last.length-1);
      const bpm   = Math.round(60000 / avgRR);
      if (bpm < 30 || bpm > 220) { setFailReason('signal_noisy'); go('failed'); return; }
      setResult(getStressTier(rmssd));
      setLiveHR(bpm);
      go('results');
      Animated.timing(glowAnim, {toValue:1, duration:1200, useNativeDriver:true}).start();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 2000);
  }, [go]);

  const startProgress = useCallback(() => {
    if (progressTimer.current) clearInterval(progressTimer.current);
    progressTimer.current = setInterval(() => {
      const elapsed = Date.now() - scanStart.current;
      const pct = Math.min(1, elapsed / SCAN_DURATION_MS);
      scanPctRef.current = pct; setScanPct(pct);
      if (elapsed >= SCAN_DURATION_MS) {
        clearInterval(progressTimer.current!); progressTimer.current = null;
        processScan();
      }
    }, 500);
  }, [processScan]);

  const beginScanning = useCallback(() => {
    signalBuf.current    = [];
    timestampBuf.current = [];
    scanStart.current    = Date.now();
    go('scanning');
    setHoldPct(0);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    startProgress();
  }, [go, startProgress]);

  const pauseScan = useCallback(() => {
    if (progressTimer.current) { clearInterval(progressTimer.current); progressTimer.current = null; }
    go('paused');
    let secs = RESUME_TIMEOUT_S; setResumeSecs(secs);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    resumeTimer.current = setInterval(() => {
      secs--; setResumeSecs(secs);
      if (secs <= 0) {
        clearInterval(resumeTimer.current!); resumeTimer.current = null;
        if (phaseRef.current === 'paused') {
          stopAll(); setFailReason('finger_removed'); go('failed');
        }
      }
    }, 1000);
  }, [go, stopAll]);

  const resumeScan = useCallback(() => {
    if (resumeTimer.current) { clearInterval(resumeTimer.current); resumeTimer.current = null; }
    scanStart.current = Date.now() - scanPctRef.current * SCAN_DURATION_MS;
    go('scanning');
    startProgress();
  }, [go, startProgress]);

  // ══ FRAME HANDLER ═══════════════════════════════════════════════════════
  const onFrame = useCallback((data: { brightness: number; timestamp: number }) => {
    if (!running.current) return;
    const { brightness, timestamp } = data;
    const cur = phaseRef.current;

    // ── Calibration (first 30 frames = 3s) ──
    if (cur === 'waiting' && calibBuf.current.length < CALIBRATION_FRAMES) {
      calibBuf.current.push(brightness);
      if (calibBuf.current.length === CALIBRATION_FRAMES) {
        const sorted = [...calibBuf.current].sort((a, b) => a - b);
        baseline.current = sorted[Math.floor(sorted.length / 2)]; // median
        setIsCalibrating(false);
      }
      return;
    }
    if (baseline.current === 0) return; // still calibrating

    // ── Finger detection ──
    // Torch → finger over lens → red light floods sensor → brightness spikes HIGH
    const fingerNow = brightness >= baseline.current * BRIGHTNESS_RATIO;

    if (fingerNow) {
      fingerCount.current++;
      setHoldPct(Math.min(1, fingerCount.current / FINGER_HOLD_FRAMES));

      if (!isFingerOn) setIsFingerOn(true);

      // Start scan after holding for FINGER_HOLD_FRAMES
      if (cur === 'waiting' && fingerCount.current >= FINGER_HOLD_FRAMES) {
        fingerCount.current = 0;
        beginScanning();
      }

      // Resume paused scan when finger returns
      if (cur === 'paused') {
        if (resumeTimer.current) { clearInterval(resumeTimer.current); resumeTimer.current = null; }
        resumeScan();
      }

    } else {
      fingerCount.current = 0;
      if (isFingerOn) {
        setIsFingerOn(false);
        setHoldPct(0);
        if (cur === 'scanning') pauseScan();
      }
    }

    // ── PPG signal collection ──
    if (cur === 'scanning' && fingerNow) {
      signalBuf.current.push(brightness);
      timestampBuf.current.push(timestamp);

      // Live BPM update every 5 frames
      const buf = signalBuf.current;
      if (buf.length >= 10 && buf.length % 5 === 0) {
        const fl   = iirLP(buf.slice(-60));
        const pk   = detectPeaks(fl, PEAK_MIN_GAP);
        if (pk.length >= 3) {
          const ts   = timestampBuf.current.slice(-60);
          const last = pk.slice(-4);
          const rrMs = last.slice(1).map((p, i) => ts[p] - ts[last[i]]);
          const avgRR= rrMs.reduce((a, b) => a + b, 0) / rrMs.length;
          const bpm  = Math.round(60000 / avgRR);
          if (bpm >= 40 && bpm <= 200) setLiveHR(bpm);
        }
      }
    }
  }, [isFingerOn, beginScanning, pauseScan, resumeScan]);

  // ── Begin scan ─────────────────────────────────────────────────────────
  const beginScan = useCallback(async () => {
    if (!PpgScanner) { go('noperm'); return; }
    resetAll();
    go('waiting');
    setIsCalibrating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await PpgScanner.startScan();
      running.current = true;
      listener.current = DeviceEventEmitter.addListener('ppgFrame', onFrame);
    } catch {
      go('noperm');
    }
  }, [resetAll, go, onFrame]);

  const retry       = useCallback(() => { resetAll(); go('idle'); }, [resetAll, go]);
  const handleClose = useCallback(() => { stopAll(); onClose(); }, [stopAll, onClose]);

  // ══ HEART / CAMERA AREA ══════════════════════════════════════════════════
  // Layout:
  //   heartArea (container, CIRCLE_SIZE+60 × CIRCLE_SIZE+60, alignItems:center, justifyContent:center)
  //   ├── glowCircle  (absoluteFill, borderRadius, RED background, native opacity from fingerGlow)
  //   ├── pulseRing   (absoluteFill, borderRadius, native scale+opacity from ringAnim)
  //   ├── beatWrapper (Animated.View, native scale from beatAnim)
  //   │   └── cameraCircle (CIRCLE_SIZE diameter, overflow:hidden, borderRadius:CIRCLE_SIZE/2)
  //   │       ├── PpgCameraPreview (absoluteFill — live camera feed)
  //   │       └── darkOverlay (absoluteFill — slight darkening)
  //   ├── ringBorder  (absoluteFill, border, color via React state — no animation conflict)
  //   ├── bpmOverlay  (absolute center, text)
  //   └── statusRow   (below)
  //
  // KEY: glowCircle only has opacity (native OK)
  //      pulseRing only has opacity+scale (native OK)
  //      beatWrapper only has scale transform (native OK)
  //      ringBorder is a plain View — no Animated, no conflict

  const showLiveCamera = phase === 'waiting' || phase === 'scanning' || phase === 'paused';
  const secsLeft = Math.ceil(SCAN_DURATION_MS / 1000 * (1 - scanPct));

  const renderCameraArea = () => (
    <View style={S.heartOuter}>
      {/* Layer 1: Red glow — native opacity only, no transform */}
      <Animated.View style={[
        StyleSheet.absoluteFillObject,
        {
          borderRadius: (CIRCLE_SIZE + 60) / 2,
          backgroundColor: 'rgba(200, 30, 30, 1)',
          opacity: fingerGlow.interpolate({ inputRange:[0,1], outputRange:[0, 0.5] }),
        }
      ]} />

      {/* Layer 2: Idle pulse ring — native scale + opacity, no backgroundColor */}
      <Animated.View style={[
        StyleSheet.absoluteFillObject,
        {
          borderRadius: (CIRCLE_SIZE + 60) / 2,
          borderWidth: 2,
          borderColor: 'rgba(220, 50, 50, 0.7)',
          opacity:   ringAnim.interpolate({ inputRange:[0,1], outputRange:[0.7, 0] }),
          transform: [{ scale: ringAnim.interpolate({ inputRange:[0,1], outputRange:[1, 1.25] }) }],
          // No backgroundColor → safe for native driver
        }
      ]} />

      {/* Layer 3: Beat scale wrapper — native scale only */}
      <Animated.View style={{ transform:[{ scale: beatAnim }] }}>
        <View style={S.cameraCircle}>
          {/* Live camera preview — always mounted so surface provider is registered */}
          <PpgCameraPreview style={StyleSheet.absoluteFill} />
          {/* Dark overlay — hides camera until scan starts */}
          {!showLiveCamera && (
            <View style={[StyleSheet.absoluteFill, { backgroundColor:'#080000' }]} />
          )}
          {/* BPM overlay on camera */}
          {phase === 'scanning' && liveHR && (
            <View style={S.bpmOnCircle}>
              <Text style={S.bpmNum}>{liveHR}</Text>
              <Text style={S.bpmUnit}>BPM</Text>
            </View>
          )}
          {phase === 'paused' && (
            <View style={S.bpmOnCircle}>
              <Ionicons name="pause-circle" size={44} color="#f97316" />
            </View>
          )}
        </View>
      </Animated.View>

      {/* Layer 4: Ring border — plain View, instant color via React state (no animation = no conflict) */}
      <View style={[
        S.cameraRingBorder,
        { borderColor: isFingerOn ? 'rgba(220,50,50,0.9)' : 'rgba(255,255,255,0.12)' }
      ]} />
    </View>
  );

  const renderStatus = () => (
    <View style={S.statusRow}>
      <View style={[S.statusDot, {backgroundColor: isFingerOn ? '#ef4444' : '#374151'}]} />
      <Text style={[S.statusTxt, {color: isFingerOn ? '#ef4444' : '#6b7280'}]}>
        {isCalibrating ? 'Calibrating sensor…' : isFingerOn ? 'Finger detected' : 'No finger detected'}
      </Text>
    </View>
  );

  // ── IDLE ───────────────────────────────────────────────────────────────
  const renderIdle = () => (
    <Animated.View style={[S.phase, {opacity: fadeAnim}]}>
      <View style={S.idleIconWrap}>
        <LinearGradient colors={['#065F46','#047857']} style={S.idleIcon}>
          <Ionicons name="pulse" size={44} color={accentColor} />
        </LinearGradient>
      </View>
      <Text style={S.bigTitle}>Bio-Stress Scanner</Text>
      <Text style={S.bigSub}>PPG · RMSSD · HRV Analysis</Text>
      <View style={S.instrBox}>
        <Text style={S.instrHdr}>HOW TO USE</Text>
        {[
          {c:'#34d399', t:'Tap "Start" — torch turns on automatically'},
          {c:'#60a5fa', t:'Cover the back camera lens fully with your fingertip'},
          {c:'#fbbf24', t:'Hold still for 1 second — circle turns red when detected'},
          {c:'#c084fc', t:'Stay still · Breathe normally · 45 seconds'},
        ].map((r, i) => (
          <View key={i} style={S.instrRow}>
            <View style={[S.instrDot, {backgroundColor: r.c}]} />
            <Text style={S.instrTxt}>{r.t}</Text>
          </View>
        ))}
      </View>
      <View style={S.sciPill}>
        <Text style={S.sciTxt}>🔬  Same PPG + RMSSD science as Oura Ring, Welltory & Apple Watch</Text>
      </View>
      <TouchableOpacity style={S.startBtn} onPress={beginScan} activeOpacity={0.85}>
        <LinearGradient colors={['#047857','#059669','#10b981']} start={{x:0,y:0}} end={{x:1,y:1}} style={S.startBtnGrad}>
          <Ionicons name="scan" size={17} color="#fff" />
          <Text style={S.startBtnTxt}>Start Bio-Stress Scan</Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );

  // ── WAITING ────────────────────────────────────────────────────────────
  const renderWaiting = () => (
    <View style={S.phase}>
      {renderCameraArea()}
      {renderStatus()}
      <View style={{flex:1}} />
      <View style={S.instructionCard}>
        <Text style={S.instructionCardTxt}>
          Cover the camera lens until the circle turns red
        </Text>
        {isFingerOn && holdPct > 0 && (
          <View style={{marginTop:14, gap:6}}>
            <View style={S.holdTrack}>
              <View style={[S.holdFill, {width:`${Math.round(holdPct*100)}%`}]} />
            </View>
            <Text style={S.holdLabel}>Starting…</Text>
          </View>
        )}
      </View>
    </View>
  );

  // ── SCANNING ───────────────────────────────────────────────────────────
  const renderScanning = () => (
    <View style={S.phase}>
      {renderCameraArea()}
      {renderStatus()}
      <View style={{flex:1}} />
      <View style={S.scanBar}>
        <View style={S.scanBarLabel}>
          <Text style={S.scanBarKey}>Collecting Signal</Text>
          <Text style={[S.scanBarKey, {color: accentColor}]}>{secsLeft}s remaining</Text>
        </View>
        <View style={S.scanTrack}>
          <View style={[S.scanFill, {width:`${Math.round(scanPct*100)}%`, backgroundColor: accentColor}]} />
        </View>
      </View>
    </View>
  );

  // ── PAUSED ─────────────────────────────────────────────────────────────
  const renderPaused = () => (
    <View style={S.phase}>
      {renderCameraArea()}
      {renderStatus()}
      <View style={{flex:1}} />
      <View style={S.pauseBadge}>
        <Ionicons name="warning-outline" size={15} color="#f97316" />
        <Text style={S.pauseBadgeTxt}>
          Finger removed — place it back or cancel in {resumeSecs}s
        </Text>
      </View>
      <TouchableOpacity style={S.cancelBtn}
        onPress={() => { stopAll(); setFailReason('finger_removed'); go('failed'); }}>
        <Text style={S.cancelTxt}>Cancel Scan</Text>
      </TouchableOpacity>
    </View>
  );

  // ── PROCESSING ─────────────────────────────────────────────────────────
  const renderProcessing = () => (
    <View style={[S.phase, {justifyContent:'center', alignItems:'center', gap:22}]}>
      <ActivityIndicator size="large" color={accentColor} />
      <Text style={S.bigTitle}>Analyzing Signal</Text>
      <Text style={[S.bigSub, {textAlign:'center', maxWidth:W-80}]}>
        Calculating RR intervals · RMSSD · HRV{'\n'}Building your Bio-Stress profile…
      </Text>
    </View>
  );

  // ── FAILED ─────────────────────────────────────────────────────────────
  const renderFailed = () => {
    const msg = failReason === 'finger_removed'
      ? {icon:'✋', title:'Scan Interrupted', body:'Your finger left the lens too long. Please try again.'}
      : {icon:'📡', title:'Signal Too Noisy', body:'Hold very still and keep your finger firmly on the lens.'};
    return (
      <View style={[S.phase, {justifyContent:'center', alignItems:'center', gap:16}]}>
        <Text style={{fontSize:52}}>{msg.icon}</Text>
        <Text style={S.bigTitle}>{msg.title}</Text>
        <Text style={[S.hintTxt, {textAlign:'center', maxWidth:W-60}]}>{msg.body}</Text>
        <View style={S.failPill}>
          <Text style={S.failTxt}>🔬 No data fabricated. Scan rejected to maintain clinical accuracy.</Text>
        </View>
        <TouchableOpacity style={S.startBtn} onPress={retry} activeOpacity={0.85}>
          <LinearGradient colors={['#047857','#059669']} style={S.startBtnGrad}>
            <Ionicons name="refresh" size={17} color="#fff" />
            <Text style={S.startBtnTxt}>Try Again</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity style={S.cancelBtn} onPress={handleClose}>
          <Text style={S.cancelTxt}>Close</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ── NO NATIVE MODULE ───────────────────────────────────────────────────
  const renderNoPerm = () => (
    <View style={[S.phase, {justifyContent:'center', alignItems:'center', gap:20}]}>
      <Ionicons name="construct-outline" size={52} color="#f97316" />
      <Text style={S.bigTitle}>Development Build Required</Text>
      <Text style={S.hintTxt}>The stress scanner uses native CameraX APIs.{'\n'}Please run with a development build, not Expo Go.</Text>
      <TouchableOpacity style={S.cancelBtn} onPress={handleClose}>
        <Text style={S.cancelTxt}>Close</Text>
      </TouchableOpacity>
    </View>
  );

  // ── RESULTS ────────────────────────────────────────────────────────────
  const renderResults = () => {
    if (!result) return null;
    return (
      <ScrollView style={{flex:1}} contentContainerStyle={{paddingBottom:40}} showsVerticalScrollIndicator={false}>
        <Animated.View style={{opacity: glowAnim}}>
          <LinearGradient colors={result.gradient} start={{x:0,y:0}} end={{x:1,y:1}} style={S.scoreCard}>
            <Text style={S.scoreLabel}>BIO-STRESS INDEX</Text>
            <View style={{flexDirection:'row', alignItems:'flex-end', gap:4}}>
              <Text style={S.scoreNum}>{result.score}</Text>
              <Text style={S.scoreSlash}>/100</Text>
            </View>
            <Text style={{fontSize:36, marginVertical:8}}>{result.emoji}</Text>
            <Text style={S.scoreTier}>{result.label}</Text>
            <Text style={S.scoreSub}>{result.subtitle}</Text>
            <View style={{flexDirection:'row', gap:12, marginTop:16}}>
              <View style={[S.metaPill, {borderColor: result.color+'60'}]}>
                <Text style={[S.metaVal, {color: result.color}]}>{result.hrv} ms</Text>
                <Text style={S.metaKey}>HRV (RMSSD)</Text>
              </View>
              {liveHR && (
                <View style={[S.metaPill, {borderColor: result.color+'60'}]}>
                  <Text style={[S.metaVal, {color: result.color}]}>{liveHR}</Text>
                  <Text style={S.metaKey}>Heart Rate BPM</Text>
                </View>
              )}
            </View>
          </LinearGradient>

          <View style={S.section}>
            <View style={S.secHdr}>
              <View style={[S.secDot, {backgroundColor: result.color}]} />
              <Text style={S.secTitle}>WHAT YOUR BODY IS SAYING</Text>
            </View>
            {result.advice.map((tip, i) => (
              <View key={i} style={[S.advRow, {borderLeftColor: result.color+'60'}]}>
                <Text style={S.advTxt}>{tip}</Text>
              </View>
            ))}
          </View>

          <View style={[S.breathCard, {borderColor: result.color+'40'}]}>
            <Text style={[S.breathLabel, {color: result.color}]}>🫁  RECOMMENDED TECHNIQUE</Text>
            <Text style={S.breathTxt}>{result.breathTechnique}</Text>
          </View>

          <View style={S.affirmCard}>
            <Text style={S.affirmTxt}>"{result.affirmation}"</Text>
          </View>

          <View style={S.section}>
            <View style={S.secHdr}>
              <View style={[S.secDot, {backgroundColor:'#c084fc'}]} />
              <Text style={S.secTitle}>HEALING SOUNDS FOR YOU</Text>
            </View>
            {SOUNDS.filter(s => result.sounds.includes(s.id)).map(snd => (
              <TouchableOpacity key={snd.id} style={S.sndRow} activeOpacity={0.8}
                onPress={() => { onPlaySound?.(snd.id); Haptics.selectionAsync(); }}>
                <LinearGradient colors={[snd.color+'22', snd.color+'08']} start={{x:0,y:0.5}} end={{x:1,y:0.5}} style={S.sndGrad}>
                  <Text style={{fontSize:24, width:32, textAlign:'center'}}>{snd.emoji}</Text>
                  <View style={{flex:1}}>
                    <Text style={S.sndName}>{snd.label}</Text>
                    <Text style={S.sndDesc}>{snd.desc}</Text>
                  </View>
                  <View style={[S.playBtn, {backgroundColor: snd.color+'30', borderColor: snd.color+'60'}]}>
                    <Ionicons name="play" size={13} color={snd.color} />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={S.rescanBtn} onPress={retry} activeOpacity={0.85}>
            <Ionicons name="refresh" size={15} color="rgba(255,255,255,0.4)" />
            <Text style={S.rescanTxt}>Scan Again</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    );
  };

  const headerTitle = { idle:'Measure', waiting:'Measure', scanning:'Measure',
    paused:'Paused', processing:'Processing', results:'Results', failed:'Error', noperm:'Error' }[phase];

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen" onRequestClose={handleClose}>
      <View style={S.backdrop}>
        <View style={S.container}>
          <View style={S.header}>
            <TouchableOpacity onPress={handleClose} style={{flexDirection:'row', alignItems:'center'}}>
              <Ionicons name="chevron-back" size={24} color="#fff" />
              <Text style={S.headerTxt}>{headerTitle}</Text>
            </TouchableOpacity>
            <View style={{flexDirection:'row', gap:16}}>
              <Ionicons name="notifications"  size={20} color="#fff" />
              <Ionicons name="help-circle"    size={22} color="#fff" />
            </View>
          </View>

          <View style={{flex:1, paddingHorizontal:20}}>
            {phase === 'idle'        && renderIdle()}
            {phase === 'waiting'     && renderWaiting()}
            {phase === 'scanning'    && renderScanning()}
            {phase === 'paused'      && renderPaused()}
            {phase === 'processing'  && renderProcessing()}
            {phase === 'results'     && renderResults()}
            {phase === 'failed'      && renderFailed()}
            {phase === 'noperm'      && renderNoPerm()}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  backdrop:   {flex:1, backgroundColor:'#000'},
  container:  {flex:1, backgroundColor:'#000', paddingTop: Platform.OS==='ios' ? 58 : 36},
  header:     {flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:16, paddingBottom:10},
  headerTxt:  {fontSize:18, fontWeight:'800', color:'#fff', marginLeft:4},
  phase:      {flex:1, paddingTop:4},

  // ── Camera area ──
  heartOuter: {
    width:  CIRCLE_SIZE + 60,
    height: CIRCLE_SIZE + 60,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  cameraCircle: {
    width:  CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    overflow: 'hidden',
    backgroundColor: '#080000',
  },
  cameraRingBorder: {
    position: 'absolute',
    width:  CIRCLE_SIZE + 6,
    height: CIRCLE_SIZE + 6,
    borderRadius: (CIRCLE_SIZE + 6) / 2,
    borderWidth: 3,
    top: 27,
    left: 27,
  },
  bpmOnCircle: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  bpmNum: {fontSize:52, fontWeight:'900', color:'#fff', letterSpacing:-1},
  bpmUnit:{fontSize:14, fontWeight:'700', color:'rgba(255,255,255,0.8)'},

  // ── Status ──
  statusRow:  {flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, marginTop:8, marginBottom:4},
  statusDot:  {width:7, height:7, borderRadius:3.5},
  statusTxt:  {fontSize:13, fontWeight:'700'},

  // ── Idle ──
  idleIconWrap:{alignSelf:'center', marginBottom:18},
  idleIcon:   {width:90, height:90, borderRadius:45, alignItems:'center', justifyContent:'center'},
  bigTitle:   {fontSize:22, fontWeight:'800', color:'#fff', textAlign:'center'},
  bigSub:     {fontSize:11, fontWeight:'600', color:'rgba(255,255,255,0.32)', textAlign:'center', letterSpacing:1.8, textTransform:'uppercase', marginTop:3, marginBottom:20},
  instrBox:   {backgroundColor:'rgba(255,255,255,0.03)', borderRadius:14, borderWidth:1, borderColor:'rgba(255,255,255,0.07)', padding:16, marginBottom:12, gap:11},
  instrHdr:   {fontSize:9, fontWeight:'900', color:'rgba(255,255,255,0.28)', letterSpacing:2, marginBottom:2},
  instrRow:   {flexDirection:'row', alignItems:'flex-start', gap:10},
  instrDot:   {width:6, height:6, borderRadius:3, marginTop:5, flexShrink:0},
  instrTxt:   {flex:1, fontSize:13, color:'rgba(255,255,255,0.65)', lineHeight:18},
  sciPill:    {backgroundColor:'rgba(52,211,153,0.06)', borderRadius:10, borderWidth:1, borderColor:'rgba(52,211,153,0.15)', padding:11, marginBottom:20},
  sciTxt:     {fontSize:11, color:'rgba(255,255,255,0.38)', lineHeight:16, textAlign:'center'},
  startBtn:   {borderRadius:14, overflow:'hidden'},
  startBtnGrad:{flexDirection:'row', alignItems:'center', justifyContent:'center', gap:10, paddingVertical:15},
  startBtnTxt:{fontSize:15, fontWeight:'800', color:'#fff'},

  // ── Waiting ──
  instructionCard:   {backgroundColor:'#111111', borderRadius:16, padding:18, marginBottom:24},
  instructionCardTxt:{fontSize:15, fontWeight:'600', color:'rgba(255,255,255,0.8)', lineHeight:22},
  holdTrack: {height:3, backgroundColor:'rgba(255,255,255,0.08)', borderRadius:2, overflow:'hidden'},
  holdFill:  {height:3, borderRadius:2, backgroundColor:'#ef4444'},
  holdLabel: {fontSize:12, fontWeight:'700', color:'#ef4444', textAlign:'center'},

  // ── Scan bar ──
  scanBar:      {gap:7, marginBottom:24},
  scanBarLabel: {flexDirection:'row', justifyContent:'space-between'},
  scanBarKey:   {fontSize:11, color:'rgba(255,255,255,0.38)', fontWeight:'600'},
  scanTrack:    {height:3, backgroundColor:'rgba(255,255,255,0.07)', borderRadius:2, overflow:'hidden'},
  scanFill:     {height:3, borderRadius:2},

  // ── Paused ──
  pauseBadge:    {flexDirection:'row', alignItems:'center', gap:8, backgroundColor:'rgba(249,115,22,0.08)', borderRadius:20, borderWidth:1, borderColor:'rgba(249,115,22,0.25)', paddingHorizontal:14, paddingVertical:10, marginBottom:12},
  pauseBadgeTxt: {flex:1, fontSize:12, fontWeight:'600', color:'#f97316', lineHeight:17},
  hintTxt:       {fontSize:12, color:'rgba(255,255,255,0.35)', lineHeight:19},
  cancelBtn:     {alignSelf:'center', paddingVertical:10, paddingHorizontal:22, borderRadius:18, backgroundColor:'rgba(255,255,255,0.04)', borderWidth:1, borderColor:'rgba(255,255,255,0.09)', marginTop:6},
  cancelTxt:     {fontSize:13, fontWeight:'600', color:'rgba(255,255,255,0.32)'},

  // ── Failed ──
  failPill: {backgroundColor:'rgba(239,68,68,0.07)', borderRadius:12, borderWidth:1, borderColor:'rgba(239,68,68,0.2)', padding:13, maxWidth:W-60},
  failTxt:  {fontSize:12, color:'rgba(255,255,255,0.4)', textAlign:'center', lineHeight:18},

  // ── Results ──
  scoreCard: {borderRadius:22, padding:26, alignItems:'center', marginBottom:16},
  scoreLabel:{fontSize:9, fontWeight:'900', color:'rgba(255,255,255,0.45)', letterSpacing:2.5, marginBottom:6},
  scoreNum:  {fontSize:72, fontWeight:'900', color:'#fff', lineHeight:80},
  scoreSlash:{fontSize:19, fontWeight:'600', color:'rgba(255,255,255,0.35)', marginBottom:10},
  scoreTier: {fontSize:21, fontWeight:'800', color:'#fff'},
  scoreSub:  {fontSize:12, color:'rgba(255,255,255,0.45)', marginBottom:14},
  metaPill:  {flex:1, backgroundColor:'rgba(0,0,0,0.22)', borderRadius:11, borderWidth:1, padding:11, alignItems:'center'},
  metaVal:   {fontSize:19, fontWeight:'800'},
  metaKey:   {fontSize:9, color:'rgba(255,255,255,0.35)', letterSpacing:1, marginTop:2},
  section:   {marginBottom:16},
  secHdr:    {flexDirection:'row', alignItems:'center', gap:7, marginBottom:10},
  secDot:    {width:5, height:5, borderRadius:2.5},
  secTitle:  {fontSize:9, fontWeight:'900', color:'rgba(255,255,255,0.35)', letterSpacing:2},
  advRow:    {borderLeftWidth:2, paddingLeft:13, paddingVertical:7, marginBottom:6, backgroundColor:'rgba(255,255,255,0.015)', borderRadius:4},
  advTxt:    {fontSize:13, color:'rgba(255,255,255,0.75)', lineHeight:19},
  breathCard:{backgroundColor:'rgba(255,255,255,0.03)', borderRadius:14, borderWidth:1, padding:16, marginBottom:12},
  breathLabel:{fontSize:9, fontWeight:'900', letterSpacing:1.8, marginBottom:7},
  breathTxt: {fontSize:14, fontWeight:'600', color:'#fff', lineHeight:21},
  affirmCard:{backgroundColor:'rgba(255,255,255,0.02)', borderRadius:14, padding:18, marginBottom:16, alignItems:'center'},
  affirmTxt: {fontSize:15, fontStyle:'italic', color:'rgba(255,255,255,0.5)', textAlign:'center', lineHeight:23},
  sndRow:    {borderRadius:13, overflow:'hidden', marginBottom:9},
  sndGrad:   {flexDirection:'row', alignItems:'center', padding:13, gap:11},
  sndName:   {fontSize:13, fontWeight:'700', color:'#fff', marginBottom:2},
  sndDesc:   {fontSize:11, color:'rgba(255,255,255,0.38)', lineHeight:15},
  playBtn:   {width:30, height:30, borderRadius:15, alignItems:'center', justifyContent:'center', borderWidth:1},
  rescanBtn: {flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, paddingVertical:13, borderRadius:13, backgroundColor:'rgba(255,255,255,0.04)', borderWidth:1, borderColor:'rgba(255,255,255,0.08)', marginTop:4},
  rescanTxt: {fontSize:13, fontWeight:'600', color:'rgba(255,255,255,0.4)'},
});
