import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput,
  Image, Alert, ActivityIndicator, BackHandler, Dimensions, Animated,
  AppState, Platform,
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
import { cancelNativeAlarm, scheduleNativeAlarm, stopNativeAlarmSound } from '@/lib/nativeAlarm';
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

// ── Camera mission (sky check / make bed / hydrate) ───────────────────────────
function CameraMission({
  missionId, color, instructions, onComplete,
}: { missionId: string; color: string; instructions: string; onComplete: () => void }) {
  const [imageB64, setImageB64] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [failMsg, setFailMsg] = useState('');

  const pickImage = async () => {
    const result = await ImagePicker.launchCameraAsync({
      base64: true, quality: 0.7, allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setImageB64(result.assets[0].base64 ?? null);
      setFailMsg('');
    }
  };

  const pickGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      base64: true, quality: 0.7, mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setImageB64(result.assets[0].base64 ?? null);
      setFailMsg('');
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
}
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

// ── Morning Mantra mission ────────────────────────────────────────────────────
function MantraMission({ color, onComplete }: { color: string; onComplete: () => void }) {
  const mantra = MANTRAS[new Date().getDay() % MANTRAS.length];
  const [taps, setTaps] = useState(0);
  const [startTime] = useState(Date.now());
  const TARGET = 11;
  const MIN_SECONDS = 33;

  const tap = () => {
    if (taps >= TARGET) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const next = taps + 1;
    setTaps(next);
    if (next >= TARGET) {
      const elapsed = (Date.now() - startTime) / 1000;
      if (elapsed < MIN_SECONDS) {
        setTimeout(() => {
          Alert.alert('Slow down 🙏', `Chant mindfully — take at least ${MIN_SECONDS} seconds. You did it in ${Math.floor(elapsed)}s. Go again.`);
          setTaps(0);
        }, 400);
      } else {
        setTimeout(() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); onComplete(); }, 600);
      }
    }
  };

  const progress = taps / TARGET;

  return (
    <ScrollView contentContainerStyle={mnt.wrap} showsVerticalScrollIndicator={false}>
      <Text style={mnt.science}>
        "Sound is medicine. Every syllable vibrates your nervous system into calm. Science backs this. Tap once per recitation."
      </Text>

      <View style={[mnt.mantraCard, { borderColor: color + '40' }]}>
        <Text style={[mnt.mantraText, { color }]}>{mantra.text}</Text>
        <Text style={mnt.meaning}>{mantra.meaning}</Text>
        <Text style={mnt.pronounce}>🔊 {mantra.pronounce}</Text>
      </View>

      {/* Bead counter */}
      <Text style={mnt.countLabel}>{taps} / {TARGET}</Text>
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
        style={[mnt.tapBtn, { backgroundColor: color + '20', borderColor: color + '60' }]}
        onPress={tap}
        activeOpacity={0.7}
        disabled={taps >= TARGET}
      >
        <Text style={[mnt.tapIcon, { color }]}>🙏</Text>
        <Text style={[mnt.tapLabel, { color }]}>Tap — I recited it</Text>
      </TouchableOpacity>

      <Text style={mnt.hint}>Minimum time: 33 seconds · 3s per recitation</Text>
    </ScrollView>
  );
}
const mnt = StyleSheet.create({
  wrap: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40, gap: 20 },
  science: { color: '#FFFFFF60', fontSize: 12, textAlign: 'center', lineHeight: 19, fontStyle: 'italic' },
  mantraCard: {
    width: '100%', borderWidth: 1, borderRadius: 20, padding: 24,
    alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF06',
  },
  mantraText: { fontSize: 22, fontWeight: '900', textAlign: 'center' },
  meaning: { color: '#FFFFFF80', fontSize: 13, textAlign: 'center' },
  pronounce: { color: '#FFFFFF50', fontSize: 11, textAlign: 'center' },
  countLabel: { fontSize: 36, fontWeight: '900', color: '#FFFFFF' },
  beadRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', width: '80%' },
  bead: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5 },
  barBg: { width: '100%', height: 4, backgroundColor: '#FFFFFF15', borderRadius: 2 },
  barFill: { height: 4, borderRadius: 2 },
  tapBtn: {
    width: '100%', borderRadius: 99, borderWidth: 1.5, paddingVertical: 18,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10,
  },
  tapIcon: { fontSize: 22 },
  tapLabel: { fontSize: 16, fontWeight: '900' },
  hint: { color: '#FFFFFF30', fontSize: 10, textAlign: 'center' },
});

// ── Gratitude Drop mission ────────────────────────────────────────────────────
function GratitudeMission({ color, onComplete }: { color: string; onComplete: () => void }) {
  const prompts = GRATITUDE_PROMPTS[new Date().getDay() % GRATITUDE_PROMPTS.length];
  const [entries, setEntries] = useState(['', '', '']);

  const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
  const allFilled = entries.every(e => wordCount(e) >= 4);

  const set = (i: number, v: string) => {
    const arr = [...entries]; arr[i] = v; setEntries(arr);
  };

  const done = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const uid = auth.currentUser?.uid;
    if (uid) {
      const date = new Date().toISOString().split('T')[0];
      addDoc(collection(db, `users/${uid}/gratitude_logs`), { entries, date, timestamp: serverTimestamp() }).catch(() => { });
    }
    onComplete();
  };

  return (
    <ScrollView contentContainerStyle={grt.wrap} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Text style={grt.science}>
        "Harvard research shows 2 minutes of gratitude rewires your brain for positivity. In Ayurveda, this is called Sattva. Same thing. Go."
      </Text>
      {[0, 1, 2].map(i => (
        <View key={i} style={grt.fieldWrap}>
          <Text style={[grt.fieldPrompt, { color }]}>{i + 1}. {prompts[i]}</Text>
          <TextInput
            style={grt.input}
            placeholder="Write at least 4 words..."
            placeholderTextColor="#FFFFFF30"
            value={entries[i]}
            onChangeText={v => set(i, v)}
            multiline
            numberOfLines={3}
          />
          <Text style={grt.wordCount}>{wordCount(entries[i])}/4 words min</Text>
        </View>
      ))}
      <TouchableOpacity
        style={[grt.doneBtn, { backgroundColor: allFilled ? color : '#FFFFFF15' }]}
        onPress={done}
        disabled={!allFilled}
        activeOpacity={0.85}
      >
        <Text style={[grt.doneTxt, { color: allFilled ? '#000' : '#FFFFFF30' }]}>
          {allFilled ? 'Done ✓  Lock it in' : 'Fill all 3 (4+ words each)'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
const grt = StyleSheet.create({
  wrap: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 60, gap: 18 },
  science: { color: '#FFFFFF55', fontSize: 12, textAlign: 'center', lineHeight: 19, fontStyle: 'italic' },
  fieldWrap: { gap: 6 },
  fieldPrompt: { fontSize: 13, fontWeight: '800' },
  input: {
    backgroundColor: '#FFFFFF0A', borderWidth: 1, borderColor: '#FFFFFF20',
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12,
    color: '#FFFFFF', fontSize: 14, lineHeight: 21,
  },
  wordCount: { color: '#FFFFFF35', fontSize: 10, textAlign: 'right' },
  doneBtn: { borderRadius: 99, paddingVertical: 18, alignItems: 'center', marginTop: 8 },
  doneTxt: { fontSize: 16, fontWeight: '900' },
});

// ── Affirmations mission ──────────────────────────────────────────────────────
function AffirmationsMission({ color, onComplete }: { color: string; onComplete: () => void }) {
  const startIdx = (new Date().getDay() * 3) % AFFIRMATIONS.length;
  const cards = [
    AFFIRMATIONS[startIdx % AFFIRMATIONS.length],
    AFFIRMATIONS[(startIdx + 1) % AFFIRMATIONS.length],
    AFFIRMATIONS[(startIdx + 2) % AFFIRMATIONS.length],
  ];
  const [current, setCurrent] = useState(0);
  const [canTap, setCanTap] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setCanTap(false); setCountdown(5);
    timerRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(timerRef.current!);
          setCanTap(true);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, [current]);

  const next = () => {
    if (!canTap) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (current >= 2) {
      const uid = auth.currentUser?.uid;
      if (uid) {
        const date = new Date().toISOString().split('T')[0];
        addDoc(collection(db, `users/${uid}/affirmation_logs`), {
          affirmations: cards.map(c => c.text), date, timestamp: serverTimestamp(),
        }).catch(() => { });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onComplete();
    } else {
      setCurrent(c => c + 1);
    }
  };

  const card = cards[current];

  return (
    <View style={aff.wrap}>
      <Text style={aff.science}>
        "Your brain doesn't know the difference between a real memory and a vivid belief. Give it something good."
      </Text>

      <View style={aff.cardProgress}>
        {[0, 1, 2].map(i => (
          <View key={i} style={[aff.dot, { backgroundColor: i <= current ? color : '#FFFFFF20', width: i === current ? 24 : 8 }]} />
        ))}
      </View>

      <View style={[aff.card, { borderColor: color + '50' }]}>
        <Text style={aff.cardNum}>{current + 1} / 3</Text>
        <Text style={[aff.affText, { color }]}>{card.text}</Text>
      </View>

      <Text style={aff.readAloud}>Read this out loud. Mean every word.</Text>

      <TouchableOpacity
        style={[aff.tapBtn, { backgroundColor: canTap ? color : '#FFFFFF15' }]}
        onPress={next}
        activeOpacity={0.85}
      >
        <Text style={[aff.tapTxt, { color: canTap ? '#000' : '#FFFFFF40' }]}>
          {canTap
            ? current < 2 ? 'I said it ✓  Next →' : 'I said it ✓  Complete'
            : `Hold for ${countdown}s...`}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
const aff = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 24, gap: 20 },
  science: { color: '#FFFFFF55', fontSize: 12, textAlign: 'center', lineHeight: 18, fontStyle: 'italic' },
  cardProgress: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { height: 8, borderRadius: 4 },
  card: {
    width: '100%', borderWidth: 1.5, borderRadius: 22, padding: 28,
    alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF06',
  },
  cardNum: { fontSize: 10, fontWeight: '900', color: '#FFFFFF30', letterSpacing: 1.5 },
  affText: { fontSize: 18, fontWeight: '800', textAlign: 'center', lineHeight: 28 },
  readAloud: { color: '#FFFFFF50', fontSize: 12, fontStyle: 'italic' },
  tapBtn: { width: '100%', borderRadius: 99, paddingVertical: 18, alignItems: 'center', marginTop: 'auto' },
  tapTxt: { fontSize: 16, fontWeight: '900' },
});

// ── Move It mission — shake-to-dismiss (20 vigorous shakes) ───────────────────
const REQUIRED_SHAKES = 20;
const SHAKE_THRESHOLD = 1.8; // net g-force above gravity
const SHAKE_COOLDOWN = 300;  // ms between counted shakes

const MOTIV = [
  'Shake your phone! Wake up! 📱',
  "You're getting there! 💪",
  'Half way! Keep shaking! 🔥',
  "Almost there! Don't stop! ⚡",
];

function MoveItMission({ color, onComplete }: { color: string; onComplete: () => void }) {
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

  useEffect(() => {
    Accelerometer.setUpdateInterval(80);
    const sub = Accelerometer.addListener(({ x, y, z }) => {
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
          sub.remove();
          setDone(true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Animated.spring(doneAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }).start();
          setTimeout(onComplete, 1600);
        }
      }
    });
    return () => sub.remove();
  }, [triggerAnim, onComplete]);

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
      <Text style={mv.sub}>Vigorous shaking = alarm dismissed</Text>

      {/* Ring + animated phone */}
      <Animated.View style={[mv.ring, {
        borderColor: ringColor + '60',
        shadowColor: ringColor,
        shadowOpacity: 0.3 + progress * 0.5,
        shadowRadius: 8 + progress * 20,
        elevation: 4 + Math.round(progress * 12),
        transform: [{ scale: ringScale }],
      }]}>
        <Animated.Text style={[mv.phone, { transform: [{ translateX: shakeAnim }] }]}>📱</Animated.Text>
        <Text style={[mv.countBig, { color: ringColor }]}>{shakeCount}</Text>
        <Text style={mv.countOf}>/ {REQUIRED_SHAKES} shakes</Text>
      </Animated.View>

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

      <Text style={mv.hint}>Hold phone firmly · Shake arm or whole body 💪</Text>
    </View>
  );

}
const mv = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 32, gap: 18 },
  doneWrap: { alignItems: 'center', gap: 16 },
  headline: { fontSize: 22, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.5, textAlign: 'center' },
  sub: { fontSize: 13, color: '#FFFFFF55', textAlign: 'center', lineHeight: 20 },
  ring: {
    width: 210, height: 210, borderRadius: 105, borderWidth: 4,
    alignItems: 'center', justifyContent: 'center', gap: 2,
    backgroundColor: '#FFFFFF06', shadowOffset: { width: 0, height: 0 },
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
  mission: ReturnType<typeof MISSIONS[0]['id']>; elapsed: number; streak: number; onDismiss: () => void;
}) {
  const m = MISSIONS.find(x => x.id === mission)!;
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
      <Text style={cmp.congrats}>You showed up. That's 90% of the battle. 🔥</Text>
      <TouchableOpacity style={[cmp.btn, { backgroundColor: m.color }]} onPress={onDismiss} activeOpacity={0.85}>
        <Text style={cmp.btnTxt}>Back to App →</Text>
      </TouchableOpacity>
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
});

// ── Root screen ────────────────────────────────────────────────────────────────
export default function MissionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const missionId = (id ?? 'gratitude_drop') as MissionId;
  const mission = MISSIONS.find(m => m.id === missionId) ?? MISSIONS[4];

  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);
  const [streak, setStreak] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const bttfNotifIdRef = useRef<string | null>(null);
  const missionCompletedRef = useRef(false);

  useEffect(() => {
    activateKeepAwakeAsync();
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    store.getJSON<MissionSettings>(KEYS.missionSettings).then(ms => {
      setStreak(ms?.streak ?? 0);
    });
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => {
      deactivateKeepAwake();
      clearInterval(timerRef.current!);
      sub.remove();
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

  // ── Mission foreground service — prevents HOME-button escape ─────────────────────
  // alarm-ringing.tsx cancelled the wake-alarm FGS when navigating here.
  // Without a new FGS, pressing HOME lets Android kill the process and the
  // background mantra audio stops — the alarm is beaten. This service keeps
  // the JVM + audio alive until the mission is actually completed.
  useEffect(() => {
    if (Platform.OS !== 'android' || done) return;
    let active = true;
    (async () => {
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
            importance: AndroidImportance.HIGH,
            category: AndroidCategory.ALARM,
            visibility: AndroidVisibility.PUBLIC,
            ongoing: true,
            autoCancel: false,
            asForegroundService: true,
            fullScreenAction: { id: 'default', launchActivity: 'default' },
            pressAction: { id: 'default', launchActivity: 'default' },
          },
        });
      } catch (e) { console.warn('[Mission] FGS start error:', e); }
    })();
    return () => {
      active = false;
      notifee.cancelNotification(MISSION_FS_ID).catch(() => {});
    };
  }, [done]);

  // ── Block HOME button during mission (mirrors alarm-ringing.tsx protection) ──
  useEffect(() => {
    if (done) return;

    const fireBttfNotif = async () => {
      if (Platform.OS !== 'android') return;
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

  const handleComplete = useCallback(async () => {
    missionCompletedRef.current = true;
    clearInterval(timerRef.current!);
    setDone(true);

    // ── 1. Clear mission guard + stop native alarm service + background mantra ─
    await AsyncStorage.removeItem('onesutra_mission_active_v1').catch(() => {});
    await stopNativeAlarmSound();
    const bg = (global as any).__missionBgSound;
    if (bg) {
      bg.stopAsync().catch(() => {});
      bg.unloadAsync().catch(() => {});
      (global as any).__missionBgSound = null;
    }

    // ── 2. Dismiss the alarm notification from the notification shade ──────
    await cancelNativeAlarm();

    // ── 3. Save streak ─────────────────────────────────────────────────────
    const ms = await store.getJSON<MissionSettings>(KEYS.missionSettings) ?? DEFAULT_MISSION_SETTINGS;
    const today = new Date().toISOString().split('T')[0];
    const wasYesterday = ms.lastCompletedDate === new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const newStreak = wasYesterday ? (ms.streak ?? 0) + 1 : 1;
    const updated: MissionSettings = { ...ms, streak: newStreak, lastCompletedDate: today };
    await store.setJSON(KEYS.missionSettings, updated);
    setStreak(newStreak);

    // ── 4. Reschedule tomorrow's alarm ─────────────────────────────────────
    // Today's alarm already fired — schedule the AlarmManager for the same
    // time tomorrow so it rings without needing the user to open the app.
    const alarmCfg = await store.getJSON<AlarmSettings>(KEYS.alarmSettings);
    if (alarmCfg?.wakeAlarm?.enabled) {
      scheduleNativeAlarm(
        alarmCfg.wakeAlarm.hour,
        alarmCfg.wakeAlarm.minute,
      ).catch(() => {});
    }

    // ── 5. Log to Firestore ────────────────────────────────────────────────
    const uid = auth.currentUser?.uid;
    if (uid) {
      addDoc(collection(db, `users/${uid}/mission_logs`), {
        missionId, elapsedSeconds: elapsed, date: today, timestamp: serverTimestamp(),
      }).catch(() => { });
    }
  }, [missionId, elapsed]);

  const handleDismiss = () => router.replace('/(tabs)' as never);

  if (done) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
        <MissionComplete mission={missionId} elapsed={elapsed} streak={streak} onDismiss={handleDismiss} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <MissionHeader
          icon={mission.icon}
          name={mission.name}
          color={mission.color}
          elapsed={elapsed}
          streak={streak}
        />

        {missionId === 'move_it' && (
          <MoveItMission color={mission.color} onComplete={handleComplete} />
        )}
        {missionId === 'sky_check' && (
          <CameraMission
            missionId="sky_check"
            color={mission.color}
            instructions="Step outside and photograph the morning sky — sunrise, clouds, golden hour, anything. Even sky through a window counts. 🌅"
            onComplete={handleComplete}
          />
        )}
        {missionId === 'make_bed' && (
          <CameraMission
            missionId="make_bed"
            color={mission.color}
            instructions={'The US Navy SEALs swear by it. Ayurveda\'s been saying it for 5000 years. A clean space = a clear mind.\n\nMake your bed. Take a photo of it done. 🛏️'}
            onComplete={handleComplete}
          />
        )}
        {missionId === 'morning_mantra' && (
          <MantraMission color={mission.color} onComplete={handleComplete} />
        )}
        {missionId === 'gratitude_drop' && (
          <GratitudeMission color={mission.color} onComplete={handleComplete} />
        )}
        {missionId === 'hydrate' && (
          <CameraMission
            missionId="hydrate"
            color={mission.color}
            instructions={"You've been fasting for 7–8 hours. Your cells are dehydrated.\n\nDrink a full glass of water. Then photograph the empty glass. 💧"}
            onComplete={handleComplete}
          />
        )}
        {missionId === 'affirmations' && (
          <AffirmationsMission color={mission.color} onComplete={handleComplete} />
        )}
      </SafeAreaView>
    </View>
  );
}
