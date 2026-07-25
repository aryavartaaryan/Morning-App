import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput,
  Image, Alert, ActivityIndicator, BackHandler, Dimensions, Animated,
  AppState, Platform, Linking, Keyboard, KeyboardAvoidingView,
  InteractionManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { store, KEYS } from '@/lib/storage';
import notifee, { AndroidImportance, AndroidCategory, AndroidVisibility } from '@notifee/react-native';
import { cancelNativeAlarm, scheduleNativeAlarm, stopNativeAlarmSound, stopAlarmVibration, setNativePickerActive, stopNativeLockTask } from '@/lib/nativeAlarm';
import { type AlarmSettings } from '@/lib/notifications';
import { auth, db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Accelerometer } from 'expo-sensors';
import {
  MISSIONS, MissionId, MissionSettings, DEFAULT_MISSION_SETTINGS,
  MANTRAS, AFFIRMATIONS, GRATITUDE_PROMPTS, MOVE_IT_OPTIONS,
} from '@/lib/missionAlarm';

const { width } = Dimensions.get('window');
const MISSION_FS_ID = 'mission-alarm-fs';
const GEMINI_KEY = 'AIzaSyANg_oPfwORFiYwvWCs53hO2NSiw96xA8k';
// Exact same model + URL as AyuIntel/Vaidya — verified working for image recognition
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`;

const VERIFY_PROMPTS: Record<string, string> = {
  sky_check:
    'You are looking at a photo. Your only job is to determine if this photo shows any outdoor sky — including clouds, sun, sunrise, sunset, moon, stars, blue sky, sky through a window, horizon, or any outdoor environment where sky is visible. Even a tiny patch of sky or outdoor light counts. Answer with ONLY the single word YES if sky is visible, or NO if it is purely indoors with no sky visible.',
  make_bed:
    'You are looking at a photo of a sleeping area. Determine if the bed has been made — sheets pulled up, pillows arranged, or at least a reasonably tidied sleeping area. A roughly made bed counts. Answer with ONLY the single word YES if the bed appears made, or NO if it is unmade.',
  hydrate:
    'You are looking at a photo. Determine if it shows a glass, cup, mug, or water bottle that appears empty or nearly empty, as if water was recently drunk from it. Answer with ONLY the single word YES if you see an empty or nearly-empty drinking vessel, or NO otherwise.',
};

const VERIFY_FAIL: Record<string, string> = {
  sky_check: 'That looks indoors! Step outside and capture the real sky 🌤️',
  make_bed: "C'mon, we can see that's not done! Straighten those sheets. 😤",
  hydrate: 'That glass still looks full! Drink up first, then take the photo. 💧',
};

// Exactly same Gemini call pattern as AyuIntel/Vaidya — proven working
async function verifyImageWithGemini(base64: string, missionId: string): Promise<boolean> {
  const prompt = VERIFY_PROMPTS[missionId];
  if (!prompt) return true;

  console.log(`[MissionVerify] Calling gemini-2.5-flash for mission: ${missionId}`);

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        role: 'user', parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64 } },
          { text: prompt },
        ]
      }],
      // Same generationConfig as Vaidya — no thinkingConfig
      generationConfig: { temperature: 0.1, maxOutputTokens: 64, responseMimeType: 'text/plain' },
    }),
  });

  const data = await res.json();
  console.log('[MissionVerify] HTTP status:', res.status);

  if (data?.error) {
    console.error('[MissionVerify] Gemini error:', JSON.stringify(data.error));
    throw new Error(data.error.message ?? 'Gemini API error');
  }

  // Read exactly like Vaidya does — parts[0].text directly, no thought filtering
  const candidate = data?.candidates?.[0];
  const finishReason: string = candidate?.finishReason ?? 'STOP';
  const rawText: string = candidate?.content?.parts?.[0]?.text ?? '';
  console.log('[MissionVerify] finishReason:', finishReason, '| answer raw:', rawText);

  const answer = rawText.trim().toUpperCase();
  return answer.includes('YES');
}

// ── Shared header ──────────────────────────────────────────────────────────────
function MissionHeader({
  icon, name, color, elapsed, streak, onBack,
}: { icon: string; name: string; color: string; elapsed: number; streak: number; onBack?: () => void }) {
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <View style={[hdr.bar, { borderBottomColor: color + '30' }]}>
      {onBack ? (
        <TouchableOpacity onPress={onBack} style={hdr.back}>
          <Text style={hdr.backTxt}>✕</Text>
        </TouchableOpacity>
      ) : <View style={{ width: 36 }} />}
      <View style={hdr.center}>
        <Text style={hdr.icon}>{icon}</Text>
        <Text style={[hdr.name, { color }]}>{name}</Text>
      </View>
      <View style={hdr.right}>
        <Text style={hdr.timer}>{pad(mins)}:{pad(secs)}</Text>
        <Text style={hdr.streak}>🔥{streak}</Text>
      </View>
    </View>
  );
}
const hdr = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: '#FFFFFF10' },
  backTxt: { color: '#FFFFFF80', fontSize: 14, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', gap: 2 },
  icon: { fontSize: 20 },
  name: { fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },
  right: { width: 60, alignItems: 'flex-end', gap: 2 },
  timer: { color: '#FFFFFF80', fontSize: 14, fontWeight: '900', fontVariant: ['tabular-nums'] },
  streak: { color: '#FFFFFF50', fontSize: 10, fontWeight: '700' },
});

// ── Self-contained timer — tick never re-renders parent or mission children ────
// elapsed lives ONLY here; parent reads elapsedRef.current at completion time.
function MissionTimer({
  color, streak, icon, name, elapsedRef,
}: {
  color: string; streak: number; icon: string; name: string;
  elapsedRef: React.MutableRefObject<number>;
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => {
      setElapsed(prev => {
        const next = prev + 1;
        elapsedRef.current = next;
        return next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [elapsedRef]);
  return <MissionHeader icon={icon} name={name} color={color} elapsed={elapsed} streak={streak} />;
}


const CameraMission = React.memo(function CameraMission({
  missionId, color, instructions, onComplete, suppressBttf,
}: { missionId: string; color: string; instructions: string; onComplete: () => void; suppressBttf?: React.MutableRefObject<boolean> }) {
  const [imageB64, setImageB64] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [failMsg, setFailMsg] = useState('');

  const pickImage = async () => {
    if (suppressBttf) suppressBttf.current = true;
    await setNativePickerActive(true);
    try {
      const { status, canAskAgain } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        if (!canAskAgain) {
          Alert.alert(
            'Camera Permission Blocked',
            'Camera access is blocked. Please go to Settings → Apps → Nada → Permissions and enable Camera.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ],
          );
        } else {
          Alert.alert('Camera Permission Required', 'Please allow camera access to complete this mission.');
        }
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        base64: true, quality: 0.7, allowsEditing: false,
      });
      if (!result.canceled && result.assets[0]) {
        setImageUri(result.assets[0].uri);
        setImageB64(result.assets[0].base64 ?? null);
        setFailMsg('');
      }
    } finally {
      await setNativePickerActive(false);
      if (suppressBttf) suppressBttf.current = false;
    }
  };

  const pickGallery = async () => {
    if (suppressBttf) suppressBttf.current = true;
    await setNativePickerActive(true);
    try {
      const { status, canAskAgain } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        if (!canAskAgain) {
          Alert.alert(
            'Gallery Permission Blocked',
            'Photo library access is blocked. Please go to Settings → Apps → Nada → Permissions and enable Storage / Photos.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ],
          );
        } else {
          Alert.alert('Gallery Permission Required', 'Please allow photo library access to complete this mission.');
        }
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        base64: true, quality: 0.7, mediaTypes: ImagePicker.MediaTypeOptions.Images,
      });
      if (!result.canceled && result.assets[0]) {
        setImageUri(result.assets[0].uri);
        setImageB64(result.assets[0].base64 ?? null);
        setFailMsg('');
      }
    } finally {
      await setNativePickerActive(false);
      if (suppressBttf) suppressBttf.current = false;
    }
  };

  const verify = async () => {
    if (!imageB64) return;
    setVerifying(true);
    setFailMsg('');
    try {
      const ok = await verifyImageWithGemini(imageB64, missionId);
      if (ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onComplete();
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setFailMsg(VERIFY_FAIL[missionId] ?? 'Try again.');
        setImageUri(null); setImageB64(null);
      }
    } catch {
      setFailMsg('Network error. Check connection and retry.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <View style={cam.wrap}>
      <Text style={cam.instruction}>{instructions}</Text>

      {imageUri ? (
        <View style={cam.previewWrap}>
          <Image source={{ uri: imageUri }} style={cam.preview} resizeMode="cover" />
          <TouchableOpacity style={cam.retake} onPress={() => { setImageUri(null); setImageB64(null); }}>
            <Text style={cam.retakeTxt}>↩ Retake</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={cam.pickerRow}>
          <TouchableOpacity style={[cam.pickBtn, { borderColor: color + '60' }]} onPress={pickImage} activeOpacity={0.8}>
            <Text style={cam.pickIcon}>📷</Text>
            <Text style={[cam.pickLabel, { color }]}>Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[cam.pickBtn, { borderColor: color + '60' }]} onPress={pickGallery} activeOpacity={0.8}>
            <Text style={cam.pickIcon}>🖼️</Text>
            <Text style={[cam.pickLabel, { color }]}>Gallery</Text>
          </TouchableOpacity>
        </View>
      )}

      {failMsg ? <Text style={cam.fail}>{failMsg}</Text> : null}

      <TouchableOpacity
        style={[cam.verifyBtn, { backgroundColor: imageB64 ? color : '#FFFFFF15' }, verifying && { opacity: 0.6 }]}
        onPress={verify}
        disabled={!imageB64 || verifying}
        activeOpacity={0.85}
      >
        {verifying
          ? <ActivityIndicator color="#000" />
          : <Text style={[cam.verifyTxt, { color: imageB64 ? '#000' : '#FFFFFF40' }]}>
            {imageB64 ? '✓ Verify with AI' : 'Take a photo first'}
          </Text>}
      </TouchableOpacity>
    </View>
  );
});
const cam = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 24, gap: 20 },
  instruction: { color: '#FFFFFF90', fontSize: 14, textAlign: 'center', lineHeight: 22 },
  pickerRow: { flexDirection: 'row', gap: 16, marginTop: 8 },
  pickBtn: {
    width: 130, height: 100, borderRadius: 18, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#FFFFFF08',
  },
  pickIcon: { fontSize: 28 },
  pickLabel: { fontSize: 13, fontWeight: '800' },
  previewWrap: { width: '100%', alignItems: 'center', gap: 10 },
  preview: { width: width - 48, height: 220, borderRadius: 18 },
  retake: { paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#FFFFFF10', borderRadius: 99 },
  retakeTxt: { color: '#FFFFFF80', fontSize: 12, fontWeight: '700' },
  fail: { color: '#f87171', fontSize: 13, textAlign: 'center', lineHeight: 20, paddingHorizontal: 16 },
  verifyBtn: { width: '100%', borderRadius: 99, paddingVertical: 17, alignItems: 'center', marginTop: 8 },
  verifyTxt: { fontSize: 16, fontWeight: '900' },
});

// ── Morning Mantra mission — Roman letters, user picks mantra ────────────────
const CHANT_OPTIONS = [
  {
    id: 'gayatri',
    icon: '🌞',
    name: 'Gayatri Mantra',
    roman: 'Om Bhur Bhuva Svaha\nTat Savitur Varenyam\nBhargo Devasya Dhimahi\nDhiyo Yo Nah Prachodayat',
    meaning: 'We meditate on the radiant glory of the Divine Sun.\nMay that sacred light illuminate our minds\nand guide our intellect toward truth and liberation.',
    badge: 'Prayer for Wisdom & Light',
  },
  {
    id: 'shivaya',
    icon: '🔱',
    name: 'Om Namah Shivaya',
    roman: 'Om Namah Shivaya\nOm Namah Shivaya\nOm Namah Shivaya',
    meaning: 'I bow to Lord Shiva — the divine consciousness\nthat dwells within all beings.\nI surrender my ego to the infinite.',
    badge: 'Mantra of Inner Surrender',
  },
];

const MantraMission = React.memo(function MantraMission({ color, onComplete }: { color: string; onComplete: () => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [taps, setTaps] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const TARGET = 11;
  const MIN_SECONDS = 33;

  const selected = CHANT_OPTIONS.find(o => o.id === selectedId);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setTaps(0);
    setStartTime(Date.now());
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const tap = () => {
    if (!selected || taps >= TARGET) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const next = taps + 1;
    setTaps(next);
    if (next >= TARGET) {
      const elapsed = ((Date.now() - (startTime ?? Date.now())) / 1000);
      if (elapsed < MIN_SECONDS) {
        setTimeout(() => {
          Alert.alert('Slow down 🙏', `Chant mindfully — take at least ${MIN_SECONDS} seconds. You did it in ${Math.floor(elapsed)}s. Go again.`);
          setTaps(0);
          setStartTime(Date.now());
        }, 400);
      } else {
        setTimeout(() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); onComplete(); }, 600);
      }
    }
  };

  const progress = selected ? taps / TARGET : 0;

  return (
    <ScrollView contentContainerStyle={mnt.wrap} showsVerticalScrollIndicator={false}>

      {/* ── Step 1: pick your mantra ── */}
      <Text style={mnt.stepLabel}>CHOOSE YOUR MANTRA</Text>
      <View style={mnt.selectorRow}>
        {CHANT_OPTIONS.map(opt => {
          const active = selectedId === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              style={[
                mnt.selectorCard,
                { borderColor: active ? color : '#FFFFFF18', backgroundColor: active ? color + '18' : '#FFFFFF06' },
              ]}
              onPress={() => handleSelect(opt.id)}
              activeOpacity={0.8}
            >
              <Text style={mnt.selectorIcon}>{opt.icon}</Text>
              <Text style={[mnt.selectorName, { color: active ? color : '#FFFFFF80' }]}>{opt.name}</Text>
              {active && <View style={[mnt.activeDot, { backgroundColor: color }]} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Step 2: mantra card (shown after selection) ── */}
      {selected ? (
        <>
          <View style={[mnt.mantraCard, { borderColor: color + '40' }]}>
            <Text style={mnt.label}>{selected.icon}  {selected.name.toUpperCase()}</Text>
            <Text style={[mnt.mantraText, { color }]}>{selected.roman}</Text>
            <View style={mnt.divider} />
            <Text style={mnt.englishText}>{selected.meaning}</Text>
            <View style={[mnt.meaningBadge, { borderColor: color + '30', backgroundColor: color + '10' }]}>
              <Text style={[mnt.meaningText, { color: color + 'CC' }]}>{selected.badge}</Text>
            </View>
          </View>

          {/* Bead counter */}
          <View style={mnt.counterRow}>
            <Text style={[mnt.countLabel, { color }]}>{taps}</Text>
            <Text style={mnt.countOf}>/ {TARGET} recitations</Text>
          </View>
          <View style={mnt.beadRow}>
            {Array.from({ length: TARGET }).map((_, i) => (
              <View
                key={i}
                style={[mnt.bead, { backgroundColor: i < taps ? color : '#FFFFFF15', borderColor: color + '50' }]}
              />
            ))}
          </View>

          {/* Progress bar */}
          <View style={mnt.barBg}>
            <View style={[mnt.barFill, { width: `${progress * 100}%`, backgroundColor: color }]} />
          </View>

          <TouchableOpacity
            style={[mnt.tapBtn, { borderColor: taps >= TARGET ? '#FFFFFF10' : color + '50', shadowColor: color }]}
            onPress={tap}
            activeOpacity={0.8}
            disabled={taps >= TARGET}
          >
            <LinearGradient colors={taps >= TARGET ? ['#FFFFFF05', '#FFFFFF02'] : [color + '20', color + '05']} start={{x:0, y:0}} end={{x:1, y:1}} style={StyleSheet.absoluteFillObject} />
            <Text style={[mnt.tapIcon, { color: taps >= TARGET ? '#FFFFFF40' : color }]}>🙏</Text>
            <Text style={[mnt.tapLabel, { color: taps >= TARGET ? '#FFFFFF40' : color }]}>Tap — I recited it</Text>
          </TouchableOpacity>

          <Text style={mnt.hint}>Minimum time: 33 seconds · 3 seconds per recitation</Text>
        </>
      ) : (
        <View style={mnt.pickHint}>
          <Text style={mnt.pickHintText}>Select a mantra above to begin chanting</Text>
        </View>
      )}
    </ScrollView>
  );
});
const mnt = StyleSheet.create({
  wrap: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 30, paddingBottom: 50, gap: 24 },
  stepLabel: { fontSize: 11, fontFamily: 'Nunito_800ExtraBold', color: '#FFFFFF50', letterSpacing: 3, textTransform: 'uppercase' },
  selectorRow: { flexDirection: 'row', gap: 16, width: '100%' },
  selectorCard: {
    flex: 1, borderWidth: 1, borderRadius: 28, paddingVertical: 24, paddingHorizontal: 12,
    alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF05',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 4,
  },
  selectorIcon: { fontSize: 36 },
  selectorName: { fontSize: 13, fontFamily: 'Nunito_700Bold', textAlign: 'center', lineHeight: 18, letterSpacing: 0.2 },
  activeDot: { width: 6, height: 6, borderRadius: 3, marginTop: 4, shadowColor: '#fff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 4 },
  label: { fontSize: 11, fontFamily: 'Nunito_800ExtraBold', color: '#FFFFFF50', letterSpacing: 3, marginBottom: 8, textTransform: 'uppercase' },
  mantraCard: {
    width: '100%', borderWidth: 1, borderRadius: 32, paddingHorizontal: 24, paddingVertical: 36,
    alignItems: 'center', gap: 16, backgroundColor: 'rgba(255,255,255,0.06)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.3, shadowRadius: 24, elevation: 8,
  },
  divider: { width: '30%', height: 1, backgroundColor: '#FFFFFF20', marginVertical: 6 },
  mantraText: { fontSize: 24, fontFamily: 'Nunito_800ExtraBold', textAlign: 'center', lineHeight: 36, letterSpacing: 0.5 },
  englishText: { fontSize: 15, color: '#FFFFFF90', textAlign: 'center', lineHeight: 26, fontStyle: 'italic', fontWeight: '400' },
  meaningBadge: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 20, paddingVertical: 10, marginTop: 8, backgroundColor: '#FFFFFF08' },
  meaningText: { fontSize: 13, fontFamily: 'Nunito_700Bold', textAlign: 'center', letterSpacing: 0.5 },
  counterRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 12 },
  countLabel: { fontSize: 64, fontWeight: '200', letterSpacing: -2 },
  countOf: { fontSize: 16, fontFamily: 'Nunito_700Bold', color: '#FFFFFF50' },
  beadRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center', width: '90%' },
  bead: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
  barBg: { width: '100%', height: 8, backgroundColor: '#FFFFFF15', borderRadius: 4, overflow: 'hidden', marginTop: 10 },
  barFill: { height: 8, borderRadius: 4 },
  tapBtn: {
    width: '100%', borderRadius: 99, borderWidth: 1, paddingVertical: 20,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 12, overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 6,
  },
  tapIcon: { fontSize: 22 },
  tapLabel: { fontSize: 16, fontFamily: 'Nunito_800ExtraBold', letterSpacing: 1, textTransform: 'uppercase' },
  hint: { color: '#FFFFFF40', fontSize: 12, textAlign: 'center', fontWeight: '500', letterSpacing: 0.2 },
  pickHint: { paddingVertical: 60, alignItems: 'center' },
  pickHintText: { color: '#FFFFFF50', fontSize: 15, fontStyle: 'italic', fontWeight: '400' },
});



// ── Gratitude Drop mission — one gratitude, minimum 3 words ──────────────────
const SINGLE_PROMPTS = [
  'What are you most grateful for right now?',
  'Name something that made you smile recently.',
  'What in your life do you take for granted but shouldn\'t?',
  'Name something about your body you are grateful for.',
  'What is a blessing you received this week?',
  'Who in your life are you most grateful for today?',
  'Name a simple pleasure that brings you joy.',
];

const GratitudeMission = React.memo(function GratitudeMission({ color, onComplete }: { color: string; onComplete: () => void }) {
  const prompt = SINGLE_PROMPTS[new Date().getDay() % SINGLE_PROMPTS.length];
  const [entry, setEntry] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const mountedRef = useRef(true);
  const submittingRef = useRef(false);

  useEffect(() => { return () => { mountedRef.current = false; }; }, []);

  // Focus keyboard on mount only — single attempt after screen animation settles.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const handle = InteractionManager.runAfterInteractions(() => {
      if (!mountedRef.current) return;
      timer = setTimeout(() => {
        if (mountedRef.current) inputRef.current?.focus();
      }, 200);
    });
    return () => {
      handle.cancel();
      if (timer) clearTimeout(timer);
    };
  }, []);

  const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
  const wc = wordCount(entry);
  const isReady = wc >= 3;

  const done = () => {
    if (submittingRef.current || !isReady) return;
    submittingRef.current = true;
    setSubmitting(true);
    // Dismiss keyboard first so the completion screen animates cleanly
    Keyboard.dismiss();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const uid = auth.currentUser?.uid;
    if (uid) {
      const date = new Date().toISOString().split('T')[0];
      addDoc(collection(db, `users/${uid}/gratitude_logs`), { entry, date, timestamp: serverTimestamp() }).catch(() => {});
    }
    // Small delay after keyboard dismiss so the animation is smooth
    setTimeout(() => { if (mountedRef.current) onComplete(); }, 150);
  };

  // On Android, windowSoftInputMode=adjustResize handles keyboard avoidance natively.
  // KeyboardAvoidingView with behavior="height" conflicts with adjustResize and can
  // prevent the keyboard from appearing. We only use it on iOS.
  const inner = (
    <ScrollView
      contentContainerStyle={grt.wrap}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="none"
    >
        {/* Header quote */}
        <Text style={grt.science}>
          “Gratitude turns what we have into enough. Harvard research shows 2 minutes rewires your brain.”
        </Text>

        {/* Single prompt card */}
        <View style={[grt.promptCard, { borderColor: color + '40' }]}>
          <Text style={grt.promptLabel}>TODAY’S REFLECTION</Text>
          <Text style={[grt.promptText, { color }]}>{prompt}</Text>
        </View>

        {/* Input — showSoftInputOnFocus forces keyboard open on Android */}
        <View style={grt.inputWrap}>
          <TextInput
            ref={inputRef}
            style={[grt.input, { borderColor: isReady ? color + '80' : '#FFFFFF30' }]}
            placeholder="Write at least 3 words..."
            placeholderTextColor="#FFFFFF40"
            value={entry}
            onChangeText={setEntry}
            multiline
            textAlignVertical="top"
            blurOnSubmit={false}
            returnKeyType="default"
            showSoftInputOnFocus
          />
          <Text style={[grt.wordCount, { color: isReady ? color : '#FFFFFF50' }]}>
            {wc} {wc === 1 ? 'word' : 'words'}{isReady ? ' ✓' : ' — need 3+'}
          </Text>
        </View>

        {/* Done button */}
        <TouchableOpacity
          style={[grt.doneBtn, { shadowColor: isReady && !submitting ? color : '#000' }]}
          onPress={done}
          disabled={!isReady || submitting}
          activeOpacity={0.85}
        >
          <LinearGradient colors={isReady && !submitting ? [color, color + 'CC'] : ['#FFFFFF15', '#FFFFFF05']} start={{x:0, y:0}} end={{x:1, y:1}} style={StyleSheet.absoluteFillObject} />
          <Text style={[grt.doneTxt, { color: isReady && !submitting ? '#000' : '#FFFFFF50' }]}>
            {submitting ? 'SAVING...' : isReady ? '✓  LOCK IT IN' : 'WRITE AT LEAST 3 WORDS'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
  );

  if (Platform.OS === 'ios') {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={90}>
        {inner}
      </KeyboardAvoidingView>
    );
  }
  return <>{inner}</>;
});
const grt = StyleSheet.create({
  wrap: { paddingHorizontal: 24, paddingTop: 30, paddingBottom: 60, gap: 28 },
  science: { color: '#FFFFFF60', fontSize: 14, textAlign: 'center', lineHeight: 24, fontWeight: '400', fontStyle: 'italic', letterSpacing: 0.3 },
  promptCard: {
    width: '100%', borderWidth: 1, borderRadius: 32, paddingHorizontal: 24, paddingVertical: 36,
    alignItems: 'center', gap: 14, backgroundColor: 'rgba(255,255,255,0.06)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 6,
  },
  promptLabel: { fontSize: 11, fontFamily: 'Nunito_800ExtraBold', color: '#FFFFFF60', letterSpacing: 3, textTransform: 'uppercase' },
  promptText: { fontSize: 21, fontFamily: 'Nunito_800ExtraBold', textAlign: 'center', lineHeight: 32, letterSpacing: 0.3 },
  inputWrap: { gap: 12, width: '100%' },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1,
    borderRadius: 24, paddingHorizontal: 24, paddingVertical: 24,
    color: '#FFFFFF', fontSize: 17, lineHeight: 28, minHeight: 140, fontWeight: '500',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10,
  },
  wordCount: { fontSize: 13, fontFamily: 'Nunito_700Bold', textAlign: 'right', letterSpacing: 0.5, paddingRight: 8 },
  doneBtn: { borderRadius: 99, paddingVertical: 22, alignItems: 'center', marginTop: 10, overflow: 'hidden', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8, width: '100%' },
  doneTxt: { fontSize: 15, fontFamily: 'Nunito_800ExtraBold', letterSpacing: 1.5 },
});

// ── Affirmations mission ──────────────────────────────────────────────────────
const AffirmationsMission = React.memo(function AffirmationsMission({ color, onComplete }: { color: string; onComplete: () => void }) {
  const startIdx = (new Date().getDay() * 3) % AFFIRMATIONS.length;
  const cards = [
    AFFIRMATIONS[startIdx % AFFIRMATIONS.length]!,
    AFFIRMATIONS[(startIdx + 1) % AFFIRMATIONS.length]!,
    AFFIRMATIONS[(startIdx + 2) % AFFIRMATIONS.length]!,
  ];
  const [current, setCurrent] = useState(0);
  const [canTap, setCanTap] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countStartRef = useRef(Date.now());
  const processingRef = useRef(false);

  useEffect(() => {
    setCanTap(false); setCountdown(5);
    countStartRef.current = Date.now();
    // BUG 4 FIX: Capture interval ID in a local const so the cleanup closure
    // always clears THIS effect's interval, not whatever timerRef.current holds
    // at the time the cleanup runs. The previous code stored the ID into the ref
    // and then called clearInterval(timerRef.current!) in cleanup — but React may
    // run the NEW effect (assigning a new ID to timerRef.current) BEFORE calling
    // the OLD cleanup, meaning the old cleanup cleared the new interval and the
    // old interval continued running indefinitely. This manifested as the
    // Affirmations countdown button becoming active earlier than 5 s on 2nd+ alarms.
    const id = setInterval(() => {
      const elapsed = (Date.now() - countStartRef.current) / 1000;
      const remaining = Math.max(0, Math.ceil(5 - elapsed));
      setCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(id);
        timerRef.current = null;
        setCanTap(true);
      }
    }, 200);
    timerRef.current = id; // keep ref updated for any external reads
    return () => clearInterval(id); // closes over local const — always the right interval
  }, [current]);

  const next = () => {
    if (!canTap || processingRef.current) return;
    processingRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (current >= 2) {
      const uid = auth.currentUser?.uid;
      if (uid) {
        const date = new Date().toISOString().split('T')[0];
        addDoc(collection(db, `users/${uid}/affirmation_logs`), {
          affirmations: cards.map(c => c?.text ?? ''), date, timestamp: serverTimestamp(),
        }).catch(() => { });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onComplete();
    } else {
      setCurrent(c => c + 1);
      setTimeout(() => { processingRef.current = false; }, 300);
    }
  };

  const card = cards[Math.min(current, 2)];

  return (
    <ScrollView
      contentContainerStyle={aff.wrap}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={aff.science}>
        “Your brain doesn’t know the difference between a real memory and a vivid belief. Give it something good.”
      </Text>

      <View style={aff.cardProgress}>
        {[0, 1, 2].map(i => (
          <View key={i} style={[aff.dot, { backgroundColor: i <= current ? color : '#FFFFFF25', width: i === current ? 32 : 10 }]} />
        ))}
      </View>

      <View style={[aff.card, { borderColor: color + '50' }]}>
        <Text style={aff.cardNum}>AFFIRMATION {current + 1} OF 3</Text>
        <Text style={[aff.affText, { color }]}>{card.text}</Text>
      </View>

      <Text style={aff.readAloud}>Read this out loud. Mean every word.</Text>

      <TouchableOpacity
        style={[aff.tapBtn, { shadowColor: canTap ? color : '#000' }]}
        onPress={next}
        activeOpacity={0.85}
      >
        <LinearGradient colors={canTap ? [color, color + 'CC'] : ['#FFFFFF15', '#FFFFFF05']} start={{x:0, y:0}} end={{x:1, y:1}} style={StyleSheet.absoluteFillObject} />
        <Text style={[aff.tapTxt, { color: canTap ? '#000' : '#FFFFFF40' }]}>
          {canTap
            ? current < 2 ? 'I SAID IT ✓  NEXT →' : 'I SAID IT ✓  COMPLETE'
            : `HOLD FOR ${countdown}S...`}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
});
const aff = StyleSheet.create({
  wrap: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 30, paddingBottom: 60, gap: 28 },
  science: { color: '#FFFFFF60', fontSize: 14, textAlign: 'center', lineHeight: 24, fontWeight: '400', fontStyle: 'italic', letterSpacing: 0.3 },
  cardProgress: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: -10 },
  dot: { height: 8, borderRadius: 4, shadowColor: '#fff', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  card: {
    width: '100%', borderWidth: 1, borderRadius: 32, paddingHorizontal: 28, paddingVertical: 46,
    alignItems: 'center', gap: 20, backgroundColor: 'rgba(255,255,255,0.06)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.3, shadowRadius: 24, elevation: 8,
  },
  cardNum: { fontSize: 11, fontFamily: 'Nunito_800ExtraBold', color: '#FFFFFF50', letterSpacing: 4, textTransform: 'uppercase' },
  affText: { fontSize: 26, fontFamily: 'Nunito_800ExtraBold', textAlign: 'center', lineHeight: 38, letterSpacing: 0.5 },
  readAloud: { color: '#FFFFFF60', fontSize: 14, fontStyle: 'italic', fontWeight: '500', marginTop: 4, letterSpacing: 0.2 },
  tapBtn: { width: '100%', borderRadius: 99, paddingVertical: 22, alignItems: 'center', overflow: 'hidden', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8, marginTop: 10 },
  tapTxt: { fontSize: 15, fontFamily: 'Nunito_800ExtraBold', letterSpacing: 1.5 },
});

// ── Move It mission — shake-to-dismiss (20 vigorous shakes) ───────────────────
const REQUIRED_SHAKES = 20;
const SHAKE_THRESHOLD = 0.9; // net g-force above gravity — medium movement works
const SHAKE_COOLDOWN = 250;  // ms between counted shakes

const MOTIV = [
  'Shake your phone! Wake up! 📱',
  "You're getting there! 💪",
  'Half way! Keep shaking! 🔥',
  "Almost there! Don't stop! ⚡",
];

const MoveItMission = React.memo(function MoveItMission({ color, onComplete }: { color: string; onComplete: () => void }) {
  const [shakeCount, setShakeCount] = useState(0);
  const [intensity, setIntensity] = useState(0);
  const [done, setDone] = useState(false);
  const countRef = useRef(0);
  const lastRef = useRef(0);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(1)).current;
  const doneAnim = useRef(new Animated.Value(0)).current;
  const progress = Math.min(shakeCount / REQUIRED_SHAKES, 1);
  const motivIdx = done ? 3 : Math.min(Math.floor(progress * 4), 3);

  const triggerAnim = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 14, duration: 35, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -14, duration: 35, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 30, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 25, useNativeDriver: true }),
    ]).start();
    Animated.sequence([
      Animated.timing(ringScale, { toValue: 1.09, duration: 90, useNativeDriver: true }),
      Animated.timing(ringScale, { toValue: 1, duration: 130, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim, ringScale]);

  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  useEffect(() => {
    let sub: ReturnType<typeof Accelerometer.addListener> | null = null;
    let mounted = true;

    Accelerometer.isAvailableAsync().then(available => {
      if (!mounted) return;
      if (!available) {
        setIntensity(0.5);
        return;
      }
      Accelerometer.setUpdateInterval(50);
      sub = Accelerometer.addListener(({ x, y, z }) => {
        const net = Math.sqrt(x * x + y * y + z * z) - 1.0;
        setIntensity(Math.max(0, Math.min(net / SHAKE_THRESHOLD, 1)));
        const now = Date.now();
        if (net > SHAKE_THRESHOLD && now - lastRef.current > SHAKE_COOLDOWN) {
          lastRef.current = now;
          const next = countRef.current + 1;
          countRef.current = next;
          setShakeCount(next);
          triggerAnim();
          Haptics.impactAsync(next % 5 === 0 ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light);
          if (next >= REQUIRED_SHAKES) {
            sub?.remove();
            setDone(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Animated.spring(doneAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }).start();
            setTimeout(() => onCompleteRef.current(), 1600);
          }
        }
      });
    });

    return () => { mounted = false; sub?.remove(); };
  }, [triggerAnim, doneAnim]);

  const ringColor = done ? '#4CD964' : color;

  if (done) {
    return (
      <View style={mv.wrap}>
        <Animated.View style={[mv.doneWrap, { transform: [{ scale: doneAnim }] }]}>
          <Text style={{ fontSize: 80 }}>🎉</Text>
          <Text style={[mv.headline, { color: '#4CD964' }]}>MISSION DONE!</Text>
          <Text style={mv.sub}>You proved you're awake.{'\n'}{shakeCount} shakes logged 🔥</Text>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={mv.wrap}>
      <Text style={mv.headline}>SHAKE YOUR PHONE!</Text>
      <Text style={mv.sub}>Shake your phone to dismiss the alarm</Text>

      {/* Ring + animated phone
           CRITICAL: shadowOpacity / shadowRadius / elevation are JS-driver-only props.
           ringScale uses useNativeDriver:true. Putting them on the same Animated.View
           causes "JS animation on native node" crash.
           Fix: outer plain View holds shadow+border, inner Animated.View holds ONLY transform. */}
      <View style={[mv.ringOuter, {
        borderColor: ringColor + '60',
        shadowColor: ringColor,
        shadowOpacity: 0.3 + progress * 0.5,
        shadowRadius: 8 + progress * 20,
        elevation: 4 + Math.round(progress * 12),
      }]}>
        <Animated.View style={[mv.ring, { transform: [{ scale: ringScale }] }]}>
          <Animated.Text style={[mv.phone, { transform: [{ translateX: shakeAnim }] }]}>📱</Animated.Text>
          <Text style={[mv.countBig, { color: ringColor }]}>{shakeCount}</Text>
          <Text style={mv.countOf}>/ {REQUIRED_SHAKES} shakes</Text>
        </Animated.View>
      </View>

      {/* Progress bar */}
      <View style={mv.barBg}>
        <View style={[mv.barFill, { width: `${progress * 100}%`, backgroundColor: ringColor }]} />
      </View>
      <Text style={[mv.pct, { color: ringColor }]}>{Math.round(progress * 100)}%</Text>

      <Text style={mv.motivate}>{MOTIV[motivIdx]}</Text>

      {/* Live intensity */}
      <View style={mv.intWrap}>
        <Text style={mv.intLabel}>LIVE INTENSITY</Text>
        <View style={mv.intBg}>
          <View style={[mv.intFill, {
            width: `${intensity * 100}%`,
            backgroundColor: intensity > 0.7 ? '#4CD964' : intensity > 0.4 ? ringColor : '#FFFFFF35',
          }]} />
        </View>
      </View>

      <Text style={mv.hint}>Hold phone firmly · Move your arm steadily 💪</Text>
    </View>
  );

});
const mv = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 32, gap: 18 },
  doneWrap: { alignItems: 'center', gap: 16 },
  headline: { fontSize: 22, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.5, textAlign: 'center' },
  sub: { fontSize: 13, color: '#FFFFFF55', textAlign: 'center', lineHeight: 20 },
  // ringOuter: plain View — holds shadow + border (JS-driver-only props).
  // ring: Animated.View — holds ONLY transform:scale (native driver safe).
  // Keeping them on separate nodes prevents the 'JS animation on native node' crash.
  ringOuter: {
    width: 210, height: 210, borderRadius: 105, borderWidth: 4,
    backgroundColor: '#FFFFFF06', shadowOffset: { width: 0, height: 0 },
    alignItems: 'center', justifyContent: 'center',
  },
  ring: {
    width: '100%', height: '100%', borderRadius: 105,
    alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  phone: { fontSize: 44, marginBottom: 2 },
  countBig: { fontSize: 52, fontWeight: '900', letterSpacing: -2, lineHeight: 54 },
  countOf: { fontSize: 13, color: '#FFFFFF50', fontWeight: '700' },
  barBg: { width: '100%', height: 8, backgroundColor: '#FFFFFF12', borderRadius: 4 },
  barFill: { height: 8, borderRadius: 4 },
  pct: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5, marginTop: -10 },
  motivate: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', textAlign: 'center', lineHeight: 22 },
  intWrap: { width: '100%', gap: 6 },
  intLabel: { fontSize: 9, fontWeight: '900', color: '#FFFFFF35', letterSpacing: 1.5 },
  intBg: { width: '100%', height: 4, backgroundColor: '#FFFFFF10', borderRadius: 2 },
  intFill: { height: 4, borderRadius: 2 },
  hint: { fontSize: 11, color: '#FFFFFF35', textAlign: 'center' },
});


// ── COMPLETE screen ────────────────────────────────────────────────────────────
function MissionComplete({ mission, elapsed, streak, onDismiss }: {
  mission: string; elapsed: number; streak: number; onDismiss: () => void;
}) {
  const m = MISSIONS.find(x => x.id === mission)!;
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(interval); setTimeout(onDismiss, 100); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [onDismiss]);

  return (
    <View style={cmp.wrap}>
      <Text style={cmp.crown}>🏆</Text>
      <Text style={[cmp.title, { color: m.color }]}>Mission Complete</Text>
      <Text style={cmp.name}>{m.name}</Text>
      <View style={cmp.stats}>
        <View style={cmp.stat}>
          <Text style={[cmp.statVal, { color: m.color }]}>{streak + 1}</Text>
          <Text style={cmp.statLabel}>Day Streak</Text>
        </View>
        <View style={cmp.divider} />
        <View style={cmp.stat}>
          <Text style={[cmp.statVal, { color: m.color }]}>{Math.floor(elapsed / 60)}m {elapsed % 60}s</Text>
          <Text style={cmp.statLabel}>Time Taken</Text>
        </View>
      </View>
      <Text style={cmp.congrats}>You showed up. That’s 90% of the battle. 🔥</Text>
      <TouchableOpacity style={[cmp.btn, { backgroundColor: m.color }]} onPress={onDismiss} activeOpacity={0.85}>
        <Text style={cmp.btnTxt}>Back to App →</Text>
      </TouchableOpacity>
      <Text style={cmp.countdownTxt}>Returning to home in {countdown}s…</Text>
    </View>
  );
}
const cmp = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 16 },
  crown: { fontSize: 72 },
  title: { fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  name: { fontSize: 16, color: '#FFFFFF80', fontWeight: '700' },
  stats: { flexDirection: 'row', alignItems: 'center', gap: 24, marginVertical: 8 },
  stat: { alignItems: 'center', gap: 4 },
  statVal: { fontSize: 28, fontWeight: '900' },
  statLabel: { color: '#FFFFFF50', fontSize: 11, fontWeight: '700' },
  divider: { width: 1, height: 40, backgroundColor: '#FFFFFF20' },
  congrats: { color: '#FFFFFF70', fontSize: 14, textAlign: 'center', lineHeight: 22, fontStyle: 'italic' },
  btn: { width: '100%', borderRadius: 99, paddingVertical: 18, alignItems: 'center', marginTop: 16 },
  btnTxt: { fontSize: 16, fontWeight: '900', color: '#000' },
  countdownTxt: { fontSize: 12, color: '#FFFFFF30', fontWeight: '600', marginTop: 4 },
});

// ── Root screen ────────────────────────────────────────────────────────────────
export default function MissionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const missionId = (id ?? 'gratitude_drop') as MissionId;
  const mission = MISSIONS.find(m => m.id === missionId) ?? MISSIONS[0]!;

  const [done, setDone] = useState(false);
  const [streak, setStreak] = useState(0);
  const appStateRef = useRef(AppState.currentState);
  const bttfNotifIdRef = useRef<string | null>(null);
  const missionCompletedRef = useRef(false);
  const pickerActiveRef = useRef(false);
  const elapsedRef = useRef(0);

  useEffect(() => {
    activateKeepAwakeAsync();
    // KEYBOARD FIX: Release lock task (screen pinning) immediately on mission mount.
    // Lock task mode blocks the Android IME (soft keyboard) system-wide — keeping it
    // active throughout the mission was preventing the keyboard from appearing in
    // Gratitude. Home/Back are still blocked by BackHandler + bttf notification.
    // stopNativeLockTask() is idempotent — safe to call even if not in lock task.
    stopNativeLockTask().catch(() => {});

    // STALE STATE FIX: The 5-minute onesutra_alarm_handled_v1 guard (set by
    // wake-alarm-ringing) is intentionally kept in AsyncStorage to prevent
    // _layout.tsx from accidentally routing back to the alarm screen if the user
    // backgrounds/foregrounds the app immediately after completing this mission.

    store.getJSON<MissionSettings>(KEYS.missionSettings).then(ms => {
      setStreak(ms?.streak ?? 0);
    });
    return () => {
      deactivateKeepAwake();
      // Stop background mantra carried over from alarm-ringing
      const bg = (global as any).__missionBgSound;
      if (bg) {
        bg.stopAsync().catch(() => { });
        bg.unloadAsync().catch(() => { });
        (global as any).__missionBgSound = null;
      }
      // Abnormal exit: clean up native alarm service and mission guard
      if (!missionCompletedRef.current) {
        AsyncStorage.removeItem('onesutra_mission_active_v1').catch(() => {});
        stopNativeAlarmSound().catch(() => {});
        cancelNativeAlarm().catch(() => {});
      }
    };
  }, []);

  // ── Block hardware back button during mission ─────────────────────────────
  useEffect(() => {
    if (done) return; // Allow back button if mission is complete
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      return true;
    });
    return () => sub.remove();
  }, [done]);

  // ── Mission foreground service — prevents HOME-button escape ─────────────────────
  // alarm-ringing.tsx cancelled the wake-alarm FGS when navigating here.
  // Without a new FGS, pressing HOME lets Android kill the process and the
  // background mantra audio stops — the alarm is beaten. This service keeps
  // the JVM + audio alive until the mission is actually completed.
  // CRITICAL: defer FGS 400ms so screen renders first before bridge blocks
  useEffect(() => {
    if (Platform.OS !== 'android' || done) return;
    let active = true;
    const fgsTimeoutId = setTimeout(async () => {
      try {
        await notifee.createChannel({
          id: 'alarm-bttf-silent',
          name: 'Alarm Return Prompt',
          importance: AndroidImportance.HIGH,
        });
        if (!active) return;
        await notifee.displayNotification({
          id: MISSION_FS_ID,
          title: '🎯 Mission In Progress — Alarm Active',
          body: 'Complete your mission to stop the alarm.',
          android: {
            channelId: 'alarm-bttf-silent',
            importance: AndroidImportance.LOW,
            category: AndroidCategory.ALARM,
            visibility: AndroidVisibility.PUBLIC,
            ongoing: true,
            autoCancel: false,
            // asForegroundService REMOVED: it starts a 2nd FGS that blocks
            // the JS bridge continuously, causing jerky typing and UI freezes.
            // The native AlarmSoundService FGS already keeps the JVM alive.
            pressAction: { id: 'default', launchActivity: 'default' },
          },
        });
      } catch (e) { console.warn('[Mission] FGS start error:', e); }
    }, 600);
    return () => {
      active = false;
      clearTimeout(fgsTimeoutId);
      notifee.cancelNotification(MISSION_FS_ID).catch(() => {});
    };
  }, [done]);

  // ── Block HOME button during mission (mirrors alarm-ringing.tsx protection) ──
  useEffect(() => {
    if (done) return;

    const fireBttfNotif = async () => {
      if (Platform.OS !== 'android') return;
      if (pickerActiveRef.current) return;
      try {
        await notifee.createChannel({
          id: 'alarm-bttf-silent',
          name: 'Alarm Return Prompt',
          importance: AndroidImportance.HIGH,
        });
        await notifee.displayNotification({
          id: 'mission-bttf',
          title: '🎯 Mission In Progress!',
          body: 'Return to complete your mission and stop the alarm.',
          android: {
            channelId: 'alarm-bttf-silent',
            importance: AndroidImportance.HIGH,
            category: AndroidCategory.ALARM,
            visibility: AndroidVisibility.PUBLIC,
            ongoing: true,
            asForegroundService: false,
            fullScreenAction: { id: 'default', launchActivity: 'default' },
            pressAction: { id: 'default', launchActivity: 'default' },
          },
        });
        bttfNotifIdRef.current = 'mission-bttf';
      } catch (e) { console.warn('[Mission] bttf notif error:', e); }
    };

    const cancelBttfNotif = () => {
      notifee.cancelNotification(bttfNotifIdRef.current ?? 'mission-bttf').catch(() => {});
      bttfNotifIdRef.current = null;
    };

    const stateSub = AppState.addEventListener('change', (nextState) => {
      if (
        !done &&
        appStateRef.current === 'active' &&
        (nextState === 'background' || nextState === 'inactive')
      ) {
        appStateRef.current = nextState;
        fireBttfNotif();
      } else if (
        !done &&
        (appStateRef.current === 'background' || appStateRef.current === 'inactive') &&
        nextState === 'active'
      ) {
        appStateRef.current = nextState;
        cancelBttfNotif();
      } else {
        appStateRef.current = nextState;
      }
    });

    return () => {
      stateSub.remove();
      cancelBttfNotif();
    };
  }, [done]);

  // ── Mission complete handler — stops ALL alarm signals with no leakage ────────
  const handleComplete = useCallback(async () => {
    if (missionCompletedRef.current) return; // guard against double-call
    missionCompletedRef.current = true;
    // Note: timer lives in MissionTimer component and stops when component unmounts

    // ── CRITICAL: Stop native alarm FIRST, BEFORE setDone or any navigation ────
    // Root cause of "app auto-opens after mission":
    // router.replace('/') causes MainActivity.onPause() during the nav transition.
    // The lifecycle watchdog fires onActivityPaused() and checks isAlarmActive().
    // If alarm_fired_pending is still true at that moment, launchApp() is called
    // and the app pops back to the alarm screen.
    //
    // stopNativeAlarmSound() calls SharedPreferences.commit() (synchronous) to
    // set alarm_fired_pending=false BEFORE any navigation or state changes happen.
    // This guarantees the watchdog sees false when the transition triggers onPause.
    await stopNativeAlarmSound().catch(() => {});
    stopNativeLockTask().catch(() => {});

    setDone(true);

    // ── 1. Stop remaining alarm signals ─────────────────────────────────────────
    // Stop JS background mantra sound transferred from alarm-ringing
    const bg = (global as any).__missionBgSound;
    if (bg) {
      try { await bg.stopAsync(); } catch { /* ignore */ }
      try { await bg.unloadAsync(); } catch { /* ignore */ }
      (global as any).__missionBgSound = null;
    }
    // ── 2. Cancel ALL notifications — prevents any app-reopen after completion ──
    await AsyncStorage.removeItem('onesutra_mission_active_v1').catch(() => {});
    await cancelNativeAlarm().catch(() => {});
    await notifee.cancelNotification(MISSION_FS_ID).catch(() => {});
    await notifee.cancelNotification('mission-bttf').catch(() => {});
    await notifee.cancelNotification('alarm-bttf').catch(() => {});
    await notifee.cancelNotification('habit-bttf').catch(() => {});
    // Safety sweep — cancel every remaining notifee notification
    await notifee.cancelAllNotifications().catch(() => {});

    // ── 3. Save streak ──────────────────────────────────────────────────────────
    const ms = await store.getJSON<MissionSettings>(KEYS.missionSettings) ?? DEFAULT_MISSION_SETTINGS;
    const today = new Date().toISOString().split('T')[0];
    const wasYesterday = ms.lastCompletedDate === new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const newStreak = wasYesterday ? (ms.streak ?? 0) + 1 : 1;
    const updated: MissionSettings = { ...ms, streak: newStreak, lastCompletedDate: today };
    await store.setJSON(KEYS.missionSettings, updated);
    setStreak(newStreak);

    // ── 4. Reschedule tomorrow's alarm ─────────────────────────────────────────
    // IMPORTANT: cancelNativeAlarm() above cancels the shared AlarmManager PendingIntent
    // (REQUEST_CODE). This ALSO wipes the alarm that AlarmBroadcastReceiver just
    // rescheduled for tomorrow — they share the same PendingIntent key.
    // We must re-schedule AFTER the cancel so tomorrow's alarm is not permanently lost.
    // This is safe: scheduleNativeAlarm() internally calls cancelNativeAlarm() first,
    // so there is exactly ONE alarm set when this block completes.
    const alarmCfg = await store.getJSON<AlarmSettings>(KEYS.alarmSettings);
    if (alarmCfg?.wakeAlarm?.enabled) {
      scheduleNativeAlarm(
        alarmCfg.wakeAlarm.hour,
        alarmCfg.wakeAlarm.minute,
        alarmCfg.wakeAlarm.days,
      ).catch(() => {});
    }

    // ── 5. Log to Firestore ─────────────────────────────────────────────────────
    const uid = auth.currentUser?.uid;
    if (uid) {
      addDoc(collection(db, `users/${uid}/mission_logs`), {
        missionId, elapsedSeconds: elapsedRef.current, date: today, timestamp: serverTimestamp(),
      }).catch(() => {});
    }
  }, [missionId]);


  const handleDismiss = () => router.replace('/(tabs)' as never);

  if (done) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
        <MissionComplete mission={missionId} elapsed={elapsedRef.current} streak={streak} onDismiss={handleDismiss} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <MissionTimer
          icon={mission.icon}
          name={mission.name}
          color={mission.color}
          streak={streak}
          elapsedRef={elapsedRef}
        />

        {missionId === 'move_it' && (
          <MoveItMission color={mission.color} onComplete={handleComplete} />
        )}
        {missionId as string === 'sky_check' && (
          <CameraMission
            missionId="sky_check"
            color={mission.color}
            instructions="Step outside and photograph the morning sky — sunrise, clouds, golden hour, anything. Even sky through a window counts. 🌅"
            onComplete={handleComplete}
            suppressBttf={pickerActiveRef}
          />
        )}
        {missionId as string === 'make_bed' && (
          <CameraMission
            missionId="make_bed"
            color={mission.color}
            instructions={'The US Navy SEALs swear by it. Ayurveda\'s been saying it for 5000 years. A clean space = a clear mind.\n\nMake your bed. Take a photo of it done. 🛏️'}
            onComplete={handleComplete}
            suppressBttf={pickerActiveRef}
          />
        )}
        {missionId === 'morning_mantra' && (
          <MantraMission color={mission.color} onComplete={handleComplete} />
        )}
        {missionId === 'gratitude_drop' && (
          <GratitudeMission color={mission.color} onComplete={handleComplete} />
        )}
        {missionId as string === 'hydrate' && (
          <CameraMission
            missionId="hydrate"
            color={mission.color}
            instructions={"You've been fasting for 7–8 hours. Your cells are dehydrated.\n\nDrink a full glass of water. Then photograph the empty glass. 💧"}
            onComplete={handleComplete}
            suppressBttf={pickerActiveRef}
          />
        )}
        {missionId === 'affirmations' && (
          <AffirmationsMission color={mission.color} onComplete={handleComplete} />
        )}
      </SafeAreaView>
    </View>
  );
}
