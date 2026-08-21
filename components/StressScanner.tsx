/**
 * StressScanner.tsx — v4 "Clean & Reliable"
 *
 * KEY PRINCIPLES:
 *  1. Live camera preview visible so user sees finger placement
 *  2. ZERO flickering — setState called ONLY when status truly changes
 *  3. Simple state machine: idle → waiting → scanning → paused → results / failed
 *  4. expo-file-system for JPEG size (reliable proxy for blood-volume / PPG signal)
 *  5. Torch stays ON during waiting + scanning phases
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet,
  Dimensions, Animated, Easing, Platform, ScrollView,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import Svg, { Path } from 'react-native-svg';

const { width: W } = Dimensions.get('window');

// ── Timing constants ───────────────────────────────────────────────────────
const CAPTURE_INTERVAL_MS  = 250;   // 4 fps — fast but stable
const CALIBRATION_FRAMES   = 2;     // ~500ms to build baseline
const FINGER_HOLD_MS       = 1000;  // hold 1 s → scan starts
const SCAN_DURATION_MS     = 45000;
const RESUME_TIMEOUT_S     = 10;
const FINGER_RATIO         = 0.48;  // threshold = baseline * 0.48
const FINGER_ABS_MAX       = 12000; // absolute ceiling: if baseline < this, use it directly
const MIN_PEAKS            = 15;    // reduced for robustness
const PEAK_MIN_GAP         = 2;     // 2 samples @ 250ms = 500ms → max 120 BPM

type Phase = 'idle'|'waiting'|'scanning'|'paused'|'processing'|'results'|'failed'|'noperm';
type FailReason = 'no_finger'|'no_pulse'|'signal_noisy'|'finger_removed'|null;

// ── Stress analysis ────────────────────────────────────────────────────────
type StressTier = {
  score:number; label:string; subtitle:string; color:string;
  gradient:readonly[string,string,string]; emoji:string; hrv:number;
  advice:string[]; sounds:string[]; breathTechnique:string; affirmation:string;
};
function getStressTier(rmssd:number): StressTier {
  const score = Math.round(Math.max(0,Math.min(100,
    rmssd>60?5:rmssd>50?14:rmssd>42?24:rmssd>35?35:
    rmssd>28?48:rmssd>20?60:rmssd>14?72:rmssd>8?85:95
  )));
  if(score<=20) return { score, label:'Deep Calm', subtitle:'Parasympathetic Dominance',
    color:'#34d399', gradient:['#064E3B','#065F46','#047857'] as const, emoji:'🧘', hrv:Math.round(rmssd),
    advice:['Your nervous system is in perfect recovery mode.','Ideal window for creative work or meditation.','Consider journaling to anchor this state.','Cortisol is at its daily low — protect this window.'],
    sounds:['cdn_yaman_mental','tibetan_dreams','tanpura_breath'],
    breathTechnique:'4-7-8 — Inhale 4s · Hold 7s · Exhale 8s', affirmation:'You are at peace. Your body is fully restored.' };
  if(score<=38) return { score, label:'Balanced', subtitle:'Healthy Autonomic Rhythm',
    color:'#60a5fa', gradient:['#1E3A5F','#1D4ED8','#2563EB'] as const, emoji:'⚖️', hrv:Math.round(rmssd),
    advice:['Stress response is well-regulated.','Excellent for focus and decision-making.','Stay hydrated — dehydration drops HRV.','A 10-minute walk will push this even higher.'],
    sounds:['cdn_calm_sunrise','flute_scale','sitar_calm'],
    breathTechnique:'Box Breathing — 4s in · 4s hold · 4s out · 4s hold', affirmation:'You are grounded. Your mind is clear.' };
  if(score<=55) return { score, label:'Mildly Elevated', subtitle:'Light Sympathetic Activation',
    color:'#fbbf24', gradient:['#78350F','#B45309','#D97706'] as const, emoji:'🌤️', hrv:Math.round(rmssd),
    advice:['Sympathetic system slightly elevated.','Common after screen time or coffee.','Step away from screens for 10 min.','Slow breathing restores HRV within minutes.'],
    sounds:['cdn_yaman_mental','tanpura_mystic_meditation','om_shanti'],
    breathTechnique:'Resonance Breathing — 5s in · 5s out (10 cycles)', affirmation:'You notice, and in noticing, you return to calm.' };
  if(score<=70) return { score, label:'Elevated Stress', subtitle:'Sympathetic Stress Response',
    color:'#f97316', gradient:['#7C2D12','#C2410C','#EA580C'] as const, emoji:'⚡', hrv:Math.round(rmssd),
    advice:['Cortisol and adrenaline are elevated.','Avoid high-stakes decisions right now.','Splash cold water — triggers dive reflex.','5 min of slow music reduces cortisol measurably.'],
    sounds:['om_shanti','tibetan_dreams','cdn_hansdhwani_432'],
    breathTechnique:'4-6 Breathing — Inhale 4s · Exhale 6s (vagus nerve)', affirmation:'This is temporary. Your body knows how to return.' };
  return { score, label:'High Stress', subtitle:'Autonomic Suppression Detected',
    color:'#ef4444', gradient:['#7F1D1D','#B91C1C','#DC2626'] as const, emoji:'🔴', hrv:Math.round(rmssd),
    advice:['Full fight-or-flight mode detected.','Do NOT make important decisions now.','Stop all screens — blue light amplifies cortisol.','Lie down, close your eyes, breathe for 5 min.'],
    sounds:['om_shanti','tibetan_dreams','cdn_yaman_mental'],
    breathTechnique:'Physiological Sigh — Double inhale · Long slow exhale', affirmation:'You are safe. Right now, in this moment, you are safe.' };
}

// ── Signal processing ──────────────────────────────────────────────────────
function iirLP(signal:number[], a=0.20): number[] {
  const out:number[]=[]; let p=signal[0]??0;
  for(const v of signal){const s=a*v+(1-a)*p; out.push(s); p=s;} return out;
}
function detectPeaks(sig:number[], minGap:number): number[] {
  const pk:number[]=[];
  for(let i=2;i<sig.length-2;i++){
    if(sig[i]>sig[i-1]&&sig[i]>sig[i-2]&&sig[i]>sig[i+1]&&sig[i]>sig[i+2])
      if(!pk.length||i-pk[pk.length-1]>=minGap) pk.push(i);
  } return pk;
}
function calcRMSSD(peaks:number[], fms:number): number {
  if(peaks.length<3) return 0;
  const rr=peaks.slice(1).map((p,i)=>(p-peaks[i])*fms).filter(r=>r>300&&r<2000);
  if(rr.length<2) return 0;
  const d=rr.slice(1).map((r,i)=>Math.pow(r-rr[i],2));
  return Math.sqrt(d.reduce((a,b)=>a+b)/d.length);
}
const delay=(ms:number)=>new Promise<void>(r=>setTimeout(r,ms));

// ── Sound catalog ──────────────────────────────────────────────────────────
const SOUNDS=[
  {id:'cdn_yaman_mental',label:'Raga Yaman',emoji:'🪕',color:'#a78bfa',desc:'Emotional balance — scientifically tuned'},
  {id:'tibetan_dreams',label:'Tibetan Dreams',emoji:'🧘',color:'#818cf8',desc:'Deep Himalayan soundscape — lowers cortisol'},
  {id:'tanpura_breath',label:'Tanpura Breath',emoji:'🌬️',color:'#a78bfa',desc:'Soft drone — entrains slow brainwaves'},
  {id:'cdn_calm_sunrise',label:'Calm Sunrise',emoji:'☀️',color:'#fde68a',desc:'Indian fusion for peaceful focus'},
  {id:'om_shanti',label:'Om Shanti',emoji:'🕉️',color:'#c084fc',desc:'Vedic peace chant — deeply soothing'},
  {id:'cdn_hansdhwani_432',label:'Hansdhwani 432Hz',emoji:'🎻',color:'#f59e0b',desc:'Healing resonance — removes negative energy'},
  {id:'tanpura_mystic_meditation',label:'Mystic Tanpura',emoji:'🌌',color:'#818cf8',desc:'Ethereal waves — parasympathetic activator'},
];

// ── Props ──────────────────────────────────────────────────────────────────
export interface StressScannerProps {
  visible: boolean; onClose: ()=>void;
  onPlaySound?: (id:string)=>void; accentColor?: string;
}

// ══════════════════════════════════════════════════════════════════════════
export default function StressScanner({
  visible, onClose, onPlaySound, accentColor='#34d399',
}: StressScannerProps) {

  const [permission, requestPermission] = useCameraPermissions();

  // ── UI state (changed ONLY on meaningful transitions) ──────────────────
  const [phase, setPhase]               = useState<Phase>('idle');
  const [isFingerOn, setIsFingerOn]     = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [cameraReady, setCameraReady]   = useState(false);
  const [liveHR, setLiveHR]             = useState<number|null>(null);
  const [scanPct, setScanPct]           = useState(0);          // 0-1
  const [resumeSecs, setResumeSecs]     = useState(RESUME_TIMEOUT_S);
  const [result, setResult]             = useState<StressTier|null>(null);
  const [failReason, setFailReason]     = useState<FailReason>(null);
  const [waveform, setWaveform]         = useState<number[]>([]);
  const [holdPct, setHoldPct]           = useState(0);          // 0-1 fill before scan starts

  // ── Refs — NO re-renders ───────────────────────────────────────────────
  const cameraRef         = useRef<CameraView>(null);
  const phaseRef          = useRef<Phase>('idle');
  const cameraReadyRef    = useRef(false);
  const running           = useRef(false);
  const fingerOnRef       = useRef(false);
  const fingerHoldStart   = useRef<number|null>(null);
  const baselineAvg       = useRef(0);
  const signalBuf         = useRef<number[]>([]);
  const scanStart         = useRef(0);
  const scanPctRef        = useRef(0);   // mirror of scanPct for use inside closures
  const resumeTimer       = useRef<ReturnType<typeof setInterval>|null>(null);
  const scanProgressTimer = useRef<ReturnType<typeof setInterval>|null>(null);

  // ── Animations ─────────────────────────────────────────────────────────
  const ringScale  = useRef(new Animated.Value(1)).current;
  const glowAnim   = useRef(new Animated.Value(0)).current;
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const beatAnim   = useRef(new Animated.Value(1)).current;

  // ── Heartbeat animation ────────────────────────────────────────────────
  useEffect(()=>{
    if(liveHR){
      const beatDur = 60000 / liveHR;
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(beatAnim,{toValue:1.15,duration:beatDur*0.2,useNativeDriver:true}),
        Animated.timing(beatAnim,{toValue:1.0,duration:beatDur*0.8,useNativeDriver:true})
      ]));
      loop.start();
      return ()=>loop.stop();
    }
  },[liveHR, beatAnim]);

  // ── Helpers ────────────────────────────────────────────────────────────
  const go = useCallback((p: Phase) => {
    phaseRef.current = p; setPhase(p);
  }, []);

  const stopAll = useCallback(() => {
    running.current = false;
    if(resumeTimer.current){ clearInterval(resumeTimer.current); resumeTimer.current=null; }
    if(scanProgressTimer.current){ clearInterval(scanProgressTimer.current); scanProgressTimer.current=null; }
  }, []);

  const resetAll = useCallback(() => {
    stopAll();
    signalBuf.current=[]; baselineAvg.current=0;
    fingerOnRef.current=false; fingerHoldStart.current=null;
    cameraReadyRef.current=false;
    setIsFingerOn(false); setIsCalibrating(false); setCameraReady(false);
    setLiveHR(null); setScanPct(0); setHoldPct(0);
    setResult(null); setFailReason(null); setWaveform([]);
    glowAnim.setValue(0); ringScale.setValue(1);
  }, [stopAll]);

  // ── Modal lifecycle ────────────────────────────────────────────────────
  useEffect(()=>{
    if(visible){
      resetAll(); go('idle');
      Animated.timing(fadeAnim,{toValue:1,duration:350,useNativeDriver:true}).start();
    } else {
      stopAll(); fadeAnim.setValue(0);
    }
  },[visible]);

  // ── Ring pulse during active phases ────────────────────────────────────
  useEffect(()=>{
    if(['waiting','scanning'].includes(phase)){
      const loop=Animated.loop(Animated.sequence([
        Animated.timing(ringScale,{toValue:1.06,duration:1000,easing:Easing.inOut(Easing.sin),useNativeDriver:true}),
        Animated.timing(ringScale,{toValue:1.00,duration:1000,easing:Easing.inOut(Easing.sin),useNativeDriver:true}),
      ])); loop.start(); return ()=>loop.stop();
    }
    ringScale.setValue(1);
  },[phase]);

  // ── Camera ready ───────────────────────────────────────────────────────
  const onCameraReady = useCallback(()=>{
    cameraReadyRef.current=true; setCameraReady(true);
  },[]);

  // ── Capture one frame → file size ─────────────────────────────────────
  const captureFrame = useCallback(async():Promise<number|null>=>{
    if(!cameraRef.current||!cameraReadyRef.current) return null;
    try {
      const pic = await cameraRef.current.takePictureAsync({quality:0.08,exif:false} as any);
      const uri:string|undefined = (pic as any)?.uri;
      if(!uri) return null;
      const info = await FileSystem.getInfoAsync(uri);
      FileSystem.deleteAsync(uri,{idempotent:true}).catch(()=>{});
      return info.exists?(info as any).size??null:null;
    } catch { return null; }
  },[]);

  // ── Process scan signal → result ───────────────────────────────────────
  const processScan = useCallback(()=>{
    go('processing');
    setTimeout(()=>{
      const buf=signalBuf.current;
      if(buf.length<40){setFailReason('signal_noisy');go('failed');return;}
      const filtered=iirLP(buf);
      const peaks=detectPeaks(filtered,PEAK_MIN_GAP);
      if(peaks.length<MIN_PEAKS){setFailReason('signal_noisy');go('failed');return;}
      const rmssd=calcRMSSD(peaks,CAPTURE_INTERVAL_MS);
      const rrAvg=peaks.slice(1).map((p,i)=>(p-peaks[i])*CAPTURE_INTERVAL_MS).reduce((a,b)=>a+b)/(peaks.length-1);
      const bpm=Math.round(60000/rrAvg);
      if(rmssd<=0||bpm<30||bpm>220){setFailReason('signal_noisy');go('failed');return;}
      setResult(getStressTier(rmssd)); setLiveHR(bpm); go('results');
      Animated.timing(glowAnim,{toValue:1,duration:1200,useNativeDriver:true}).start();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },2200);
  },[go]);

  // ── Start the 45s scan countdown ──────────────────────────────────────
  const beginScanning = useCallback(()=>{
    scanStart.current=Date.now();
    go('scanning');
    setHoldPct(0);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    scanProgressTimer.current=setInterval(()=>{
      const elapsed=Date.now()-scanStart.current;
      const pct=Math.min(1,elapsed/SCAN_DURATION_MS);
      scanPctRef.current=pct;   // keep ref in sync
      setScanPct(pct);
      if(elapsed>=SCAN_DURATION_MS){
        if(scanProgressTimer.current){clearInterval(scanProgressTimer.current);scanProgressTimer.current=null;}
        processScan();
      }
    },500);
  },[go,processScan]);

  // ── Pause scan (finger removed) ───────────────────────────────────────
  const pauseScan = useCallback(()=>{
    if(scanProgressTimer.current){clearInterval(scanProgressTimer.current);scanProgressTimer.current=null;}
    go('paused');
    let secs=RESUME_TIMEOUT_S; setResumeSecs(secs);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    resumeTimer.current=setInterval(()=>{
      secs--;setResumeSecs(secs);
      if(secs<=0){
        if(resumeTimer.current){clearInterval(resumeTimer.current);resumeTimer.current=null;}
        if(phaseRef.current==='paused'){
          stopAll(); setFailReason('finger_removed'); go('failed');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      }
    },1000);
  },[go,stopAll]);

  // ── Resume from paused ────────────────────────────────────────────────
  const resumeScan = useCallback(()=>{
    if(resumeTimer.current){clearInterval(resumeTimer.current);resumeTimer.current=null;}
    // Use scanPctRef (not state) to avoid stale closure bug
    scanStart.current=Date.now()-scanPctRef.current*SCAN_DURATION_MS;
    go('scanning');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scanProgressTimer.current=setInterval(()=>{
      const elapsed=Date.now()-scanStart.current;
      const pct=Math.min(1,elapsed/SCAN_DURATION_MS);
      scanPctRef.current=pct;
      setScanPct(pct);
      if(elapsed>=SCAN_DURATION_MS){
        if(scanProgressTimer.current){clearInterval(scanProgressTimer.current);scanProgressTimer.current=null;}
        processScan();
      }
    },500);
  },[go,processScan]);

  // ══ MAIN CAPTURE LOOP ═════════════════════════════════════════════════
  const captureLoop = useCallback(async()=>{
    running.current=true;

    // Poll until camera is hardware-ready (max 3 s)
    setIsCalibrating(true);
    for(let i=0; i<30 && !cameraReadyRef.current && running.current; i++){
      await delay(100);
    }
    if(!running.current) return;

    // ── Phase 1: fast 2-frame calibration (~500ms) ──
    const frames:number[]=[];
    for(let i=0; i<CALIBRATION_FRAMES && running.current; i++){
      const sz=await captureFrame();
      if(sz!==null) frames.push(sz);
      if(i<CALIBRATION_FRAMES-1) await delay(CAPTURE_INTERVAL_MS);
    }
    if(!running.current) return;

    if(frames.length>=1){
      baselineAvg.current=frames.reduce((a,b)=>a+b)/frames.length;
    } else {
      baselineAvg.current=25000; // fallback
    }
    setIsCalibrating(false);

    // ── Phase 2: main detection + PPG loop ──
    while(running.current){
      const sz_t0=Date.now();
      const sz=await captureFrame();
      if(!running.current) break;

      const cur=phaseRef.current;

      if(sz===null){
        await delay(Math.max(50, CAPTURE_INTERVAL_MS-(Date.now()-sz_t0)));
        continue;
      }

      // Smart threshold: ratio-based OR absolute floor (protects against dark rooms)
      const ratioThreshold = baselineAvg.current * FINGER_RATIO;
      const threshold = baselineAvg.current > FINGER_ABS_MAX
        ? ratioThreshold                    // well-lit room: use ratio
        : Math.min(ratioThreshold, 6000);  // dark room: hard cap at 6000 bytes
      const fingerNow = sz < threshold;

      // ── Update finger status ONLY on change ──
      if(fingerNow!==fingerOnRef.current){
        fingerOnRef.current=fingerNow;
        setIsFingerOn(fingerNow);

        if(fingerNow){
          fingerHoldStart.current=Date.now();
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } else {
          fingerHoldStart.current=null;
          setHoldPct(0);

          if(cur==='scanning'){
            pauseScan();
          } else if(cur==='waiting'){
            // reset hold bar
          }
        }
      }

      // ── Waiting: track hold duration, launch scan ──
      if(cur==='waiting' && fingerNow && fingerHoldStart.current){
        const held=Date.now()-fingerHoldStart.current;
        const hp=Math.min(1,held/FINGER_HOLD_MS);
        setHoldPct(hp);
        if(held>=FINGER_HOLD_MS){
          fingerHoldStart.current=null;
          signalBuf.current=[];
          beginScanning();
        }
      }

      // ── Scanning: collect PPG signal, update waveform & BPM ──
      if(cur==='scanning'){
        signalBuf.current.push(-sz); // invert: smaller = more red = peak
        const buf=signalBuf.current;
        if(buf.length%6===0){ // update every ~3 s
          const fl=iirLP(buf.slice(-60));
          const pk=detectPeaks(fl,PEAK_MIN_GAP);
          if(pk.length>=2){
            const rp=pk.slice(-3);
            const avgRR=rp.slice(1).map((p,i)=>(p-rp[i])*CAPTURE_INTERVAL_MS).reduce((a,b)=>a+b)/Math.max(1,rp.length-1);
            const bpm=Math.round(60000/avgRR);
            if(bpm>=40&&bpm<=200) setLiveHR(bpm);
          }
          const sl=buf.slice(-24);
          const mn=Math.min(...sl),mx=Math.max(...sl),rng=mx-mn||1;
          setWaveform(sl.map(v=>(v-mn)/rng));
        }
      }

      // ── Paused: detect finger return ──
      if(cur==='paused' && fingerNow){
        if(resumeTimer.current){clearInterval(resumeTimer.current);resumeTimer.current=null;}
        resumeScan();
      }

      await delay(Math.max(50, CAPTURE_INTERVAL_MS - (Date.now() - sz_t0)));
    }
  },[captureFrame,beginScanning,pauseScan,resumeScan]);

  // ── Begin flow ─────────────────────────────────────────────────────────
  const beginScan = useCallback(async()=>{
    if(!permission?.granted){
      const r=await requestPermission();
      if(!r.granted){go('noperm');return;}
    }
    resetAll();
    go('waiting');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    captureLoop();
  },[permission,requestPermission,resetAll,go,captureLoop]);

  const retry = useCallback(()=>{resetAll();go('idle');},[resetAll,go]);
  const handleClose = useCallback(()=>{stopAll();onClose();},[stopAll,onClose]);

  // ══ RENDER HELPERS ════════════════════════════════════════════════════

  // The heart shaped live camera — shown during waiting, scanning, paused
  const renderCamera=(showWave=false)=>{
    const torchOn=phase==='waiting'||phase==='scanning'||phase==='paused';
    return (
      <View style={{ alignItems: 'center', marginVertical: 30 }}>
        <Animated.View style={[S.camRingOuter,{transform:[{scale:ringScale}]}]}>
          <View style={S.camCircle}>
            {(phase==='waiting'||phase==='scanning'||phase==='paused')&&(
              <CameraView
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                facing="back"
                enableTorch={torchOn}
                onCameraReady={onCameraReady}
              />
            )}
            
            {/* Dark overlay during scanning to show waveform/BPM */}
            {showWave&&(
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' }]}>
                {liveHR ? (
                  <>
                    <Animated.Text style={[S.camBPM,{color: '#fff', transform:[{scale:beatAnim}]}]}>{liveHR}</Animated.Text>
                    <Text style={S.camBPMUnit}>BPM</Text>
                  </>
                ) : (
                  <>
                    <Text style={[S.camBPM,{color: '#fff'}]}>00</Text>
                    <Text style={S.camBPMUnit}>BPM</Text>
                  </>
                )}
              </View>
            )}

            {/* Paused overlay */}
            {phase==='paused'&&(
              <View style={[StyleSheet.absoluteFill,{backgroundColor:'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center'}]}>
                <Ionicons name="pause-circle" size={48} color="#f97316" />
              </View>
            )}
            
            {/* SVG Mask to create the Heart shape over the full rect */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <Svg width="100%" height="100%" viewBox="0 0 240 240">
                <Path
                  fill="#000000"
                  fillRule="evenodd"
                  d="M0 0 H240 V240 H0 V0 Z M120 215.5l-14.5-13.2C54 153.6 20 122.8 20 85C20 54.2 44.2 30 75 30c17.4 0 34.1 8.1 45 20.9C130.9 38.1 147.6 30 165 30c30.8 0 55 24.2 55 55 0 37.8-34 68.6-85.5 115.4L120 215.5z"
                />
              </Svg>
            </View>
          </View>
        </Animated.View>

        {/* Status text directly below the heart */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
          <Text style={{ fontSize: 13 }}>
            {isCalibrating ? '⚙️' : (isFingerOn ? '❤️' : '👆')}
          </Text>
          <Text style={{ fontSize: 14, fontWeight: '700', color: isFingerOn ? '#ff3b30' : '#fff' }}>
            {isCalibrating ? 'Initializing camera...' : (isFingerOn ? 'Finger detected' : 'No finger detected')}
          </Text>
        </View>
      </View>
    );
  };

  // ── IDLE ───────────────────────────────────────────────────────────────
  const renderIdle=()=>(
    <Animated.View style={[S.phase,{opacity:fadeAnim}]}>
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
          {c:'#34d399',t:'Tap "Start" — the torch turns on automatically'},
          {c:'#60a5fa',t:'Cover the back camera lens fully with your fingertip'},
          {c:'#fbbf24',t:'Hold steady for 2 seconds — scan starts automatically'},
          {c:'#c084fc',t:'Stay still · Breathe normally · Takes 45 seconds'},
        ].map((r,i)=>(
          <View key={i} style={S.instrRow}>
            <View style={[S.instrDot,{backgroundColor:r.c}]} />
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
  const renderWaiting=()=>(
    <View style={S.phase}>
      {renderCamera()}

      <View style={{ flex: 1 }} />

      {/* Instruction Card (Matching the Reference UI) */}
      <View style={S.instructionCard}>
        <Text style={S.instructionCardTxt}>
          Cover the camera with your finger until{'\n'}<Text style={{color:'#ff3b30'}}>❤️</Text> turns red
        </Text>
        <View style={S.instructionPhoneMock}>
          <View style={S.phoneLensBox}>
            <View style={S.phoneLens1} />
            <View style={S.phoneLens2} />
          </View>
          {/* A simple hand icon placed over the lens */}
          <Ionicons name="hand-right" size={60} color="#ffb088" style={{ position: 'absolute', top: 40, left: 30, transform: [{rotate: '-15deg'}] }} />
        </View>
      </View>
    </View>
  );

  // ── SCANNING ────────────────────────────────────────────────────────────
  const secsLeft=Math.ceil(SCAN_DURATION_MS/1000*(1-scanPct));
  const renderScanning=()=>(
    <View style={S.phase}>
      {renderCamera(true)}
      <View style={{ flex: 1 }} />
      <View style={S.scanBar}>
        <View style={S.scanBarLabel}>
          <Text style={S.scanBarKey}>Collecting Signal</Text>
          <Text style={[S.scanBarKey,{color:accentColor}]}>{secsLeft}s remaining</Text>
        </View>
        <View style={S.scanTrack}>
          <View style={[S.scanFill,{width:`${Math.round(scanPct*100)}%`,backgroundColor:accentColor}]} />
        </View>
      </View>
    </View>
  );

  // ── PAUSED ─────────────────────────────────────────────────────────────
  const renderPaused=()=>(
    <View style={S.phase}>
      <Text style={[S.phaseTag,{color:'#f97316cc'}]}>⚠️  SCAN PAUSED — REPLACE FINGER</Text>
      {renderCamera()}
      <View style={[S.statusBadge,{backgroundColor:'rgba(249,115,22,0.10)',borderColor:'rgba(249,115,22,0.35)'}]}>
        <View style={[S.statusDot,{backgroundColor:'#f97316'}]} />
        <Text style={[S.statusTxt,{color:'#f97316'}]}>Finger undetected — cancelling in {resumeSecs}s</Text>
      </View>
      <Text style={S.hintTxt}>Replace your finger to continue scanning{'\n'}Your progress is saved</Text>
      <TouchableOpacity style={S.cancelBtn} onPress={()=>{stopAll();setFailReason('finger_removed');go('failed');}}>
        <Text style={S.cancelTxt}>Cancel Scan</Text>
      </TouchableOpacity>
    </View>
  );

  // ── PROCESSING ─────────────────────────────────────────────────────────
  const renderProcessing=()=>(
    <View style={[S.phase,{justifyContent:'center',alignItems:'center',gap:22}]}>
      <ActivityIndicator size="large" color={accentColor} />
      <Text style={S.bigTitle}>Analyzing Signal</Text>
      <Text style={[S.bigSub,{textAlign:'center',maxWidth:W-80}]}>Calculating RR intervals · RMSSD · HRV{'\n'}Building your Bio-Stress profile…</Text>
    </View>
  );

  // ── FAILED ─────────────────────────────────────────────────────────────
  const renderFailed=()=>{
    const msgs={
      no_finger:     {icon:'👆',t:'No Finger Detected',b:'Cover the back lens completely with your fingertip so it blocks all light.'},
      no_pulse:      {icon:'❓',t:'Pulse Not Found',b:'Apply gentle but firm pressure. Ensure the lens is fully covered.'},
      signal_noisy:  {icon:'📡',t:'Signal Too Noisy',b:'Too much movement detected. Try again from a still position.'},
      finger_removed:{icon:'✋',t:'Scan Interrupted',b:'Finger left the lens too long. Scan cancelled to protect accuracy.'},
    };
    const m=failReason?msgs[failReason]:msgs.signal_noisy;
    return(
      <View style={[S.phase,{justifyContent:'center',alignItems:'center',gap:16}]}>
        <Text style={{fontSize:52}}>{m.icon}</Text>
        <Text style={S.bigTitle}>{m.t}</Text>
        <Text style={[S.hintTxt,{textAlign:'center',maxWidth:W-60}]}>{m.b}</Text>
        <View style={S.failPill}>
          <Text style={S.failTxt}>🔬 No data was fabricated. Scan rejected to protect accuracy.</Text>
        </View>
        <TouchableOpacity style={S.startBtn} onPress={retry} activeOpacity={0.85}>
          <LinearGradient colors={['#047857','#059669']} style={S.startBtnGrad}>
            <Ionicons name="refresh" size={17} color="#fff" />
            <Text style={S.startBtnTxt}>Try Again</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity style={S.cancelBtn} onPress={handleClose}><Text style={S.cancelTxt}>Close</Text></TouchableOpacity>
      </View>
    );
  };

  // ── RESULTS ────────────────────────────────────────────────────────────
  const renderResults=()=>{
    if(!result) return null;
    return(
      <ScrollView style={{flex:1}} contentContainerStyle={{paddingBottom:40}} showsVerticalScrollIndicator={false}>
        <Animated.View style={{opacity:glowAnim}}>
          <LinearGradient colors={result.gradient} start={{x:0,y:0}} end={{x:1,y:1}} style={S.scoreCard}>
            <Text style={S.scoreLabel}>BIO-STRESS INDEX</Text>
            <View style={{flexDirection:'row',alignItems:'flex-end',gap:4}}>
              <Text style={S.scoreNum}>{result.score}</Text>
              <Text style={S.scoreSlash}>/100</Text>
            </View>
            <Text style={{fontSize:36,marginVertical:8}}>{result.emoji}</Text>
            <Text style={S.scoreTier}>{result.label}</Text>
            <Text style={S.scoreSub}>{result.subtitle}</Text>
            <View style={{flexDirection:'row',gap:12,marginTop:16}}>
              <View style={[S.metaPill,{borderColor:result.color+'60'}]}>
                <Text style={[S.metaVal,{color:result.color}]}>{result.hrv} ms</Text>
                <Text style={S.metaKey}>HRV (RMSSD)</Text>
              </View>
              {liveHR&&(
                <View style={[S.metaPill,{borderColor:result.color+'60'}]}>
                  <Text style={[S.metaVal,{color:result.color}]}>{liveHR}</Text>
                  <Text style={S.metaKey}>Heart Rate BPM</Text>
                </View>
              )}
            </View>
          </LinearGradient>

          <View style={S.section}>
            <View style={S.secHdr}><View style={[S.secDot,{backgroundColor:result.color}]}/><Text style={S.secTitle}>WHAT YOUR BODY IS SAYING</Text></View>
            {result.advice.map((tip,i)=>(
              <View key={i} style={[S.advRow,{borderLeftColor:result.color+'60'}]}>
                <Text style={S.advTxt}>{tip}</Text>
              </View>
            ))}
          </View>

          <View style={[S.breathCard,{borderColor:result.color+'40'}]}>
            <Text style={[S.breathLabel,{color:result.color}]}>🫁  RECOMMENDED TECHNIQUE</Text>
            <Text style={S.breathTxt}>{result.breathTechnique}</Text>
          </View>

          <View style={S.affirmCard}><Text style={S.affirmTxt}>"{result.affirmation}"</Text></View>

          <View style={S.section}>
            <View style={S.secHdr}><View style={[S.secDot,{backgroundColor:'#c084fc'}]}/><Text style={S.secTitle}>HEALING SOUNDS FOR YOU</Text></View>
            {SOUNDS.filter(s=>result.sounds.includes(s.id)).map(snd=>(
              <TouchableOpacity key={snd.id} style={S.sndRow} activeOpacity={0.8}
                onPress={()=>{onPlaySound?.(snd.id);Haptics.selectionAsync();}}>
                <LinearGradient colors={[snd.color+'20',snd.color+'08']} start={{x:0,y:0.5}} end={{x:1,y:0.5}} style={S.sndGrad}>
                  <Text style={{fontSize:24,width:32,textAlign:'center'}}>{snd.emoji}</Text>
                  <View style={{flex:1}}>
                    <Text style={S.sndName}>{snd.label}</Text>
                    <Text style={S.sndDesc}>{snd.desc}</Text>
                  </View>
                  <View style={[S.playBtn,{backgroundColor:snd.color+'30',borderColor:snd.color+'60'}]}>
                    <Ionicons name="play" size={13} color={snd.color} />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={S.rescanBtn} onPress={retry} activeOpacity={0.85}>
            <Ionicons name="refresh" size={15} color="rgba(255,255,255,0.5)" />
            <Text style={S.rescanTxt}>Scan Again</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    );
  };

  // ── NO PERMISSION ──────────────────────────────────────────────────────
  const renderNoPerm=()=>(
    <View style={[S.phase,{justifyContent:'center',alignItems:'center',gap:20}]}>
      <Ionicons name="videocam-off" size={52} color="#ef4444" />
      <Text style={S.bigTitle}>Camera Required</Text>
      <Text style={S.hintTxt}>Enable camera access in Settings to use the stress scanner.</Text>
      <TouchableOpacity style={S.cancelBtn} onPress={handleClose}><Text style={S.cancelTxt}>Close</Text></TouchableOpacity>
    </View>
  );

  const phaseTitle={
    idle:'Measure', waiting:'Measure',
    scanning:'Measure', paused:'Paused',
    processing:'Processing', results:'Results',
    failed:'Error', noperm:'Error',
  }[phase];

  return(
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen" onRequestClose={handleClose}>
      <View style={S.backdrop}>
        <View style={S.container}>
          {/* Header */}
          <View style={S.header}>
            <TouchableOpacity onPress={handleClose} style={{flexDirection: 'row', alignItems: 'center'}}>
              <Ionicons name="chevron-back" size={24} color="#fff" />
              <Text style={S.headerTxt}>{phaseTitle}</Text>
            </TouchableOpacity>
            <View style={{flexDirection: 'row', gap: 16}}>
              <Ionicons name="notifications" size={20} color="#fff" />
              <Ionicons name="help-circle" size={22} color="#fff" />
            </View>
          </View>

          <View style={{flex:1,paddingHorizontal:20}}>
            {phase==='idle'       &&renderIdle()}
            {phase==='waiting'    &&renderWaiting()}
            {phase==='scanning'   &&renderScanning()}
            {phase==='paused'     &&renderPaused()}
            {phase==='processing' &&renderProcessing()}
            {phase==='results'    &&renderResults()}
            {phase==='failed'     &&renderFailed()}
            {phase==='noperm'     &&renderNoPerm()}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const CIRCLE=240;
const S=StyleSheet.create({
  backdrop:    {flex:1,backgroundColor:'#000000'},
  container:   {flex:1,backgroundColor:'#000000',paddingTop:Platform.OS==='ios'?58:36},
  header:      {flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16,paddingBottom:14},
  headerTxt:   {fontSize:18,fontWeight:'800',color:'#fff',marginLeft: 4},
  closeBtn:    {width:32,height:32,borderRadius:16,backgroundColor:'rgba(255,255,255,0.07)',alignItems:'center',justifyContent:'center'},
  phase:       {flex:1,paddingTop:4},

  // ── Idle
  idleIconWrap:{alignSelf:'center',marginBottom:18},
  idleIcon:    {width:90,height:90,borderRadius:45,alignItems:'center',justifyContent:'center'},
  bigTitle:    {fontSize:22,fontWeight:'800',color:'#fff',textAlign:'center',letterSpacing:0.1},
  bigSub:      {fontSize:11,fontWeight:'600',color:'rgba(255,255,255,0.35)',textAlign:'center',letterSpacing:1.8,textTransform:'uppercase',marginTop:3,marginBottom:20},
  instrBox:    {backgroundColor:'rgba(255,255,255,0.03)',borderRadius:14,borderWidth:1,borderColor:'rgba(255,255,255,0.07)',padding:16,marginBottom:12,gap:11},
  instrHdr:    {fontSize:9,fontWeight:'900',color:'rgba(255,255,255,0.3)',letterSpacing:2,marginBottom:2},
  instrRow:    {flexDirection:'row',alignItems:'flex-start',gap:10},
  instrDot:    {width:6,height:6,borderRadius:3,marginTop:5,flexShrink:0},
  instrTxt:    {flex:1,fontSize:13,color:'rgba(255,255,255,0.68)',lineHeight:18},
  sciPill:     {backgroundColor:'rgba(52,211,153,0.06)',borderRadius:10,borderWidth:1,borderColor:'rgba(52,211,153,0.15)',padding:11,marginBottom:20},
  sciTxt:      {fontSize:11,color:'rgba(255,255,255,0.4)',lineHeight:16,textAlign:'center'},
  startBtn:    {borderRadius:14,overflow:'hidden'},
  startBtnGrad:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10,paddingVertical:15},
  startBtnTxt: {fontSize:15,fontWeight:'800',color:'#fff',letterSpacing:0.1},

  // ── Camera ring
  camRingOuter:{alignSelf:'center',width:CIRCLE,height:CIRCLE,alignItems:'center',justifyContent:'center'},
  camCircle:   {width:CIRCLE,height:CIRCLE,overflow:'hidden',backgroundColor:'#0a0a0a'},
  camBPM:      {fontSize:52,fontWeight:'800',letterSpacing:-1},
  camBPMUnit:  {fontSize:16,fontWeight:'600',color:'rgba(255,255,255,0.8)'},

  instructionCard: {backgroundColor:'#1c1c1e',borderRadius:16,padding:20,marginBottom:30},
  instructionCardTxt: {fontSize:15,fontWeight:'600',color:'#fff',lineHeight:22},
  instructionPhoneMock: {alignSelf:'center',marginTop:20,width:100,height:140,backgroundColor:'#3a3a3c',borderTopLeftRadius:16,borderTopRightRadius:16,overflow:'hidden'},
  phoneLensBox: {position:'absolute',top:10,left:10,width:24,height:48,borderRadius:12,backgroundColor:'#1c1c1e',alignItems:'center',justifyContent:'center',gap:4},
  phoneLens1: {width:14,height:14,borderRadius:7,backgroundColor:'#000'},
  phoneLens2: {width:14,height:14,borderRadius:7,backgroundColor:'#000'},

  // ── Status badge
  phaseTag:    {fontSize:10,fontWeight:'900',letterSpacing:2,textAlign:'center',marginBottom:14,color:'rgba(255,255,255,0.35)'},
  statusBadge: {flexDirection:'row',alignItems:'center',gap:9,borderWidth:1,borderRadius:22,paddingHorizontal:16,paddingVertical:10,alignSelf:'stretch',marginBottom:14},
  statusDot:   {width:8,height:8,borderRadius:4,flexShrink:0},
  statusTxt:   {flex:1,fontSize:13,fontWeight:'600',lineHeight:18},
  holdBarWrap: {gap:6,marginBottom:12},
  holdTrack:   {height:3,backgroundColor:'rgba(255,255,255,0.06)',borderRadius:2,overflow:'hidden'},
  holdFill:    {height:3,borderRadius:2},
  holdLabel:   {fontSize:11,fontWeight:'700',textAlign:'center',letterSpacing:0.2},
  hintTxt:     {fontSize:12,color:'rgba(255,255,255,0.35)',textAlign:'center',lineHeight:19,marginBottom:14},
  cancelBtn:   {alignSelf:'center',paddingVertical:10,paddingHorizontal:22,borderRadius:18,backgroundColor:'rgba(255,255,255,0.04)',borderWidth:1,borderColor:'rgba(255,255,255,0.09)'},
  cancelTxt:   {fontSize:13,fontWeight:'600',color:'rgba(255,255,255,0.35)'},

  // ── Scan progress
  scanBar:     {gap:7,marginBottom:14},
  scanBarLabel:{flexDirection:'row',justifyContent:'space-between'},
  scanBarKey:  {fontSize:11,color:'rgba(255,255,255,0.35)',fontWeight:'600'},
  scanTrack:   {height:3,backgroundColor:'rgba(255,255,255,0.06)',borderRadius:2,overflow:'hidden'},
  scanFill:    {height:3,borderRadius:2},

  // ── Fail
  failPill:    {backgroundColor:'rgba(239,68,68,0.07)',borderRadius:12,borderWidth:1,borderColor:'rgba(239,68,68,0.2)',padding:13,maxWidth:W-60},
  failTxt:     {fontSize:12,color:'rgba(255,255,255,0.45)',textAlign:'center',lineHeight:18},

  // ── Results
  scoreCard:   {borderRadius:22,padding:26,alignItems:'center',marginBottom:16},
  scoreLabel:  {fontSize:9,fontWeight:'900',color:'rgba(255,255,255,0.45)',letterSpacing:2.5,marginBottom:6},
  scoreNum:    {fontSize:72,fontWeight:'900',color:'#fff',lineHeight:80},
  scoreSlash:  {fontSize:19,fontWeight:'600',color:'rgba(255,255,255,0.35)',marginBottom:10},
  scoreTier:   {fontSize:21,fontWeight:'800',color:'#fff',letterSpacing:0.2},
  scoreSub:    {fontSize:12,color:'rgba(255,255,255,0.45)',letterSpacing:0.4,marginBottom:14},
  metaPill:    {flex:1,backgroundColor:'rgba(0,0,0,0.22)',borderRadius:11,borderWidth:1,padding:11,alignItems:'center'},
  metaVal:     {fontSize:19,fontWeight:'800'},
  metaKey:     {fontSize:9,color:'rgba(255,255,255,0.35)',letterSpacing:1,marginTop:2},
  section:     {marginBottom:16},
  secHdr:      {flexDirection:'row',alignItems:'center',gap:7,marginBottom:10},
  secDot:      {width:5,height:5,borderRadius:2.5},
  secTitle:    {fontSize:9,fontWeight:'900',color:'rgba(255,255,255,0.35)',letterSpacing:2},
  advRow:      {borderLeftWidth:2,paddingLeft:13,paddingVertical:7,marginBottom:6,backgroundColor:'rgba(255,255,255,0.015)',borderRadius:4},
  advTxt:      {fontSize:13,color:'rgba(255,255,255,0.75)',lineHeight:19},
  breathCard:  {backgroundColor:'rgba(255,255,255,0.03)',borderRadius:14,borderWidth:1,padding:16,marginBottom:12},
  breathLabel: {fontSize:9,fontWeight:'900',letterSpacing:1.8,marginBottom:7},
  breathTxt:   {fontSize:14,fontWeight:'600',color:'#fff',lineHeight:21},
  affirmCard:  {backgroundColor:'rgba(255,255,255,0.02)',borderRadius:14,padding:18,marginBottom:16,alignItems:'center'},
  affirmTxt:   {fontSize:15,fontStyle:'italic',color:'rgba(255,255,255,0.5)',textAlign:'center',lineHeight:23},
  sndRow:      {borderRadius:13,overflow:'hidden',marginBottom:9},
  sndGrad:     {flexDirection:'row',alignItems:'center',padding:13,gap:11},
  sndName:     {fontSize:13,fontWeight:'700',color:'#fff',marginBottom:2},
  sndDesc:     {fontSize:11,color:'rgba(255,255,255,0.38)',lineHeight:15},
  playBtn:     {width:30,height:30,borderRadius:15,alignItems:'center',justifyContent:'center',borderWidth:1},
  rescanBtn:   {flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,paddingVertical:13,borderRadius:13,backgroundColor:'rgba(255,255,255,0.04)',borderWidth:1,borderColor:'rgba(255,255,255,0.08)',marginTop:4},
  rescanTxt:   {fontSize:13,fontWeight:'600',color:'rgba(255,255,255,0.45)'},
});
