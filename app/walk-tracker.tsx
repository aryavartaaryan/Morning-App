import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar,
  Alert, ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { auth } from '@/lib/firebase';
import { saveHabitLog, formatDuration, haversineKm, todayStr } from '@/lib/habitLogs';
import type { LatLng } from '@/lib/habitLogs';
import { Colors, Spacing, Radius, Font } from '@/constants/theme';

type WalkKind = 'morning' | 'evening';
type Phase = 'idle' | 'running' | 'paused' | 'done';
type Feel = 'easy' | 'good' | 'energising';

const KIND_META: Record<WalkKind, { emoji: string; title: string; window: string; color: string; tip: string }> = {
  morning: {
    emoji: '🚶', title: 'Morning Walk', window: '6:00–9:00 AM', color: '#34d399',
    tip: 'Moving in morning Vata window activates prana and wakes every cell.',
  },
  evening: {
    emoji: '🌆', title: 'Evening Walk', window: '5:00–7:00 PM', color: '#f472b6',
    tip: 'Evening walk helps pacify Vata and aids digestion after dinner.',
  },
};

const FEELS: { key: Feel; emoji: string; label: string; color: string }[] = [
  { key: 'easy',       emoji: '😌', label: 'Easy',       color: '#60a5fa' },
  { key: 'good',       emoji: '😊', label: 'Good',       color: '#10b981' },
  { key: 'energising', emoji: '🔥', label: 'Energising', color: '#f59e0b' },
];

// Step estimation: ~1300 steps per km, ~0.77 m per step
const stepsFromKm = (km: number) => Math.round(km * 1300);
const calsFromKm  = (km: number) => Math.round(km * 55); // ~55 kcal/km brisk walk

export default function WalkTracker() {
  const router = useRouter();
  const { type } = useLocalSearchParams<{ type: WalkKind }>();
  const kind: WalkKind = (type === 'evening') ? 'evening' : 'morning';
  const meta = KIND_META[kind];

  const [phase, setPhase]         = useState<Phase>('idle');
  const [elapsed, setElapsed]     = useState(0);
  const [route, setRoute]         = useState<LatLng[]>([]);
  const [distanceKm, setDistance] = useState(0);
  const [feel, setFeel]           = useState<Feel | null>(null);
  const [saving, setSaving]       = useState(false);
  const [permErr, setPermErr]     = useState(false);
  const intervalRef               = useRef<ReturnType<typeof setInterval> | null>(null);
  const locationSub               = useRef<Location.LocationSubscription | null>(null);
  const uid                       = auth.currentUser?.uid;
  useKeepAwake();

  const steps    = stepsFromKm(distanceKm);
  const calories = calsFromKm(distanceKm);

  // Request permissions on mount
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') setPermErr(true);
    })();
    return () => {
      clearInterval(intervalRef.current!);
      locationSub.current?.remove();
    };
  }, []);

  const startWalk = async () => {
    if (permErr) {
      Alert.alert('Location required', 'Please allow location access to track your walk.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setPhase('running');
    setRoute([]);
    setDistance(0);
    setElapsed(0);

    // Timer
    intervalRef.current = setInterval(() => setElapsed(e => e + 1), 1000);

    // GPS tracking every 5 seconds
    locationSub.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 5000, distanceInterval: 5 },
      (loc) => {
        const newPt: LatLng = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        setRoute(prev => {
          if (prev.length > 0) {
            const last = prev[prev.length - 1];
            const seg = haversineKm(last.lat, last.lng, newPt.lat, newPt.lng);
            setDistance(d => parseFloat((d + seg).toFixed(3)));
          }
          return [...prev, newPt];
        });
      }
    );
  };

  const pauseWalk = () => {
    Haptics.selectionAsync();
    clearInterval(intervalRef.current!);
    locationSub.current?.remove();
    setPhase('paused');
  };

  const resumeWalk = async () => {
    Haptics.selectionAsync();
    setPhase('running');
    intervalRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    locationSub.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 5000, distanceInterval: 5 },
      (loc) => {
        const newPt: LatLng = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        setRoute(prev => {
          if (prev.length > 0) {
            const last = prev[prev.length - 1];
            const seg = haversineKm(last.lat, last.lng, newPt.lat, newPt.lng);
            setDistance(d => parseFloat((d + seg).toFixed(3)));
          }
          return [...prev, newPt];
        });
      }
    );
  };

  const endWalk = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    clearInterval(intervalRef.current!);
    locationSub.current?.remove();
    setPhase('done');
  };

  const saveWalk = useCallback(async () => {
    if (!uid || !feel) return;
    setSaving(true);
    try {
      const minutes = Math.round(elapsed / 60);
      const habitId = kind === 'morning' ? 'morning_walk' : 'evening_walk';
      const habitName = kind === 'morning' ? 'Morning Walk' : 'Evening Walk';
      const status = minutes >= 20 ? 'done' : minutes > 0 ? 'partial' : 'missed';
      await saveHabitLog({
        habitId, habitName,
        userId: uid, date: todayStr(), status,
        durationMinutes: minutes,
        distanceKm: parseFloat(distanceKm.toFixed(2)),
        steps,
        routeCoordinates: route.length > 100 ? route.filter((_, i) => i % 3 === 0) : route,
        feelRating: feel,
        streakAtLog: 0,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      Alert.alert('Error', 'Could not save walk.');
    } finally {
      setSaving(false);
    }
  }, [uid, elapsed, distanceKm, steps, route, feel, kind]);

  const minutes = Math.floor(elapsed / 60);
  const secs    = elapsed % 60;

  // ── Idle ─────────────────────────────────────────────────────────────────────
  if (phase === 'idle') return (
    <LinearGradient colors={['#0A0A0F', '#0A1A12', '#0A0A0F']} style={s.full}>
      <StatusBar barStyle="light-content" />
      <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
        <Text style={s.backTxt}>← Back</Text>
      </TouchableOpacity>
      <View style={s.center}>
        <Text style={s.bigEmoji}>{meta.emoji}</Text>
        <Text style={s.heading}>{meta.title}</Text>
        <Text style={[s.sub, { color: meta.color }]}>{meta.window}</Text>
        <View style={[s.tipCard, { borderColor: meta.color + '30', backgroundColor: meta.color + '10' }]}>
          <Text style={[s.tipTxt, { color: meta.color }]}>🌿 {meta.tip}</Text>
        </View>
        {permErr && (
          <View style={s.errCard}>
            <Text style={s.errTxt}>⚠️ Location permission required for GPS tracking. Grant in Settings.</Text>
          </View>
        )}
        <View style={s.infoRow}>
          <View style={s.infoItem}><Text style={s.infoEmoji}>📍</Text><Text style={s.infoLbl}>GPS Track</Text></View>
          <View style={s.infoItem}><Text style={s.infoEmoji}>⏱</Text><Text style={s.infoLbl}>Duration</Text></View>
          <View style={s.infoItem}><Text style={s.infoEmoji}>👣</Text><Text style={s.infoLbl}>Steps</Text></View>
          <View style={s.infoItem}><Text style={s.infoEmoji}>🔥</Text><Text style={s.infoLbl}>Calories</Text></View>
        </View>
        <TouchableOpacity style={[s.startBtn, { backgroundColor: meta.color }]} onPress={startWalk}>
          <Text style={s.startTxt}>START WALK</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );

  // ── Running / Paused ────────────────────────────────────────────────────────
  if (phase === 'running' || phase === 'paused') return (
    <LinearGradient colors={['#0A0A0F', '#0A1A12', '#0A0A0F']} style={s.full}>
      <StatusBar barStyle="light-content" />
      <TouchableOpacity style={s.backBtn} onPress={() => {
        if (phase === 'running') pauseWalk();
        Alert.alert('End walk?', 'Your progress will be lost.', [
          { text: 'Stay', style: 'cancel', onPress: () => phase === 'running' ? resumeWalk() : undefined },
          { text: 'Leave', style: 'destructive', onPress: () => router.back() },
        ]);
      }}>
        <Text style={s.backTxt}>← Back</Text>
      </TouchableOpacity>

      <View style={s.center}>
        <Text style={s.phaseTitle}>{phase === 'paused' ? '⏸ Paused' : `${meta.emoji} Walking...`}</Text>

        {/* Live timer */}
        <View style={[s.timerBox, { borderColor: meta.color + '40' }]}>
          <Text style={[s.timerTxt, { color: meta.color }]}>
            {String(minutes).padStart(2, '0')}:{String(secs).padStart(2, '0')}
          </Text>
        </View>

        {/* Live stats grid */}
        <View style={s.statsGrid}>
          <View style={[s.statCard, { borderColor: meta.color + '30' }]}>
            <Text style={s.statEmoji}>📍</Text>
            <Text style={[s.statVal, { color: meta.color }]}>{distanceKm.toFixed(2)}</Text>
            <Text style={s.statUnit}>km</Text>
          </View>
          <View style={[s.statCard, { borderColor: meta.color + '30' }]}>
            <Text style={s.statEmoji}>👣</Text>
            <Text style={[s.statVal, { color: meta.color }]}>{steps.toLocaleString()}</Text>
            <Text style={s.statUnit}>steps</Text>
          </View>
          <View style={[s.statCard, { borderColor: meta.color + '30' }]}>
            <Text style={s.statEmoji}>🔥</Text>
            <Text style={[s.statVal, { color: meta.color }]}>{calories}</Text>
            <Text style={s.statUnit}>kcal</Text>
          </View>
        </View>

        {minutes >= 20 && (
          <View style={[s.milestoneBadge, { backgroundColor: meta.color + '20', borderColor: meta.color + '40' }]}>
            <Text style={[s.milestoneTxt, { color: meta.color }]}>✅ 20 min target reached!</Text>
          </View>
        )}

        <View style={s.btnRow}>
          {phase === 'running' ? (
            <TouchableOpacity style={s.pauseBtn} onPress={pauseWalk}>
              <Text style={s.pauseTxt}>⏸ PAUSE</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={s.pauseBtn} onPress={resumeWalk}>
              <Text style={s.pauseTxt}>▶ RESUME</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[s.endBtn, { backgroundColor: meta.color }]} onPress={endWalk}>
            <Text style={s.endTxt}>END WALK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
  );

  // ── Summary ──────────────────────────────────────────────────────────────────
  const isShort = minutes < 20;
  return (
    <LinearGradient colors={['#0A0A0F', '#0A1A12', '#0A0A0F']} style={s.full}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={s.summaryPad} showsVerticalScrollIndicator={false}>
        <Text style={s.doneEmoji}>{meta.emoji}</Text>
        <Text style={s.doneTitle}>Walk Complete!</Text>

        <View style={s.summaryGrid}>
          <View style={[s.summaryCard, { borderColor: meta.color + '30', backgroundColor: meta.color + '10' }]}>
            <Text style={s.summaryEmoji}>⏱</Text>
            <Text style={[s.summaryBig, { color: meta.color }]}>{formatDuration(elapsed)}</Text>
            <Text style={s.summaryLbl}>Duration</Text>
          </View>
          <View style={[s.summaryCard, { borderColor: meta.color + '30', backgroundColor: meta.color + '10' }]}>
            <Text style={s.summaryEmoji}>📍</Text>
            <Text style={[s.summaryBig, { color: meta.color }]}>{distanceKm.toFixed(2)}</Text>
            <Text style={s.summaryLbl}>km</Text>
          </View>
          <View style={[s.summaryCard, { borderColor: meta.color + '30', backgroundColor: meta.color + '10' }]}>
            <Text style={s.summaryEmoji}>👣</Text>
            <Text style={[s.summaryBig, { color: meta.color }]}>{steps.toLocaleString()}</Text>
            <Text style={s.summaryLbl}>Steps</Text>
          </View>
          <View style={[s.summaryCard, { borderColor: meta.color + '30', backgroundColor: meta.color + '10' }]}>
            <Text style={s.summaryEmoji}>🔥</Text>
            <Text style={[s.summaryBig, { color: meta.color }]}>{calories}</Text>
            <Text style={s.summaryLbl}>kcal</Text>
          </View>
        </View>

        <View style={s.statusRow}>
          {isShort
            ? <View style={s.shortBadge}><Text style={s.shortTxt}>🔶 Short walk (under 20 min)</Text></View>
            : <View style={s.perfectBadge}><Text style={s.perfectTxt}>✅ Perfect walk! (20+ min)</Text></View>
          }
        </View>

        {route.length > 0 && (
          <View style={[s.routeCard, { borderColor: meta.color + '30' }]}>
            <Text style={s.routeTitle}>🗺️ Route</Text>
            <Text style={s.routeTxt}>{route.length} GPS points tracked</Text>
            <Text style={s.routeSub}>Start → {distanceKm.toFixed(2)} km tracked</Text>
          </View>
        )}

        <Text style={s.feelQ}>How was the walk?</Text>
        <View style={s.feelRow}>
          {FEELS.map(f => (
            <TouchableOpacity
              key={f.key}
              style={[s.feelBtn, feel === f.key && { borderColor: f.color, backgroundColor: f.color + '20' }]}
              onPress={() => { Haptics.selectionAsync(); setFeel(f.key); }}
            >
              <Text style={s.feelEmoji}>{f.emoji}</Text>
              <Text style={[s.feelLabel, feel === f.key && { color: f.color }]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[s.saveBtn, { backgroundColor: meta.color }, (!feel || saving) && { opacity: 0.5 }]}
          onPress={saveWalk}
          disabled={!feel || saving}
        >
          <Text style={s.saveTxt}>{saving ? 'Saving...' : 'SAVE WALK'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.skipBtn} onPress={() => router.back()}>
          <Text style={s.skipTxt}>Skip & close</Text>
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  full: { flex: 1 },
  backBtn: { position: 'absolute', top: 56, left: Spacing.lg, zIndex: 10, paddingVertical: 6, paddingHorizontal: 10 },
  backTxt: { color: Colors.textSub, fontSize: Font.sizes.sm, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.lg },
  bigEmoji: { fontSize: 56, marginBottom: Spacing.sm },
  heading: { fontSize: Font.sizes.xxl, fontWeight: '900', color: Colors.text, marginBottom: 4 },
  sub: { fontSize: Font.sizes.sm, fontWeight: '600', marginBottom: Spacing.md },
  tipCard: { borderRadius: Radius.md, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.lg, alignSelf: 'stretch' },
  tipTxt: { fontSize: Font.sizes.xs, fontWeight: '600', lineHeight: 18, textAlign: 'center' },
  errCard: { backgroundColor: '#ef444415', borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.md, alignSelf: 'stretch' },
  errTxt: { fontSize: Font.sizes.xs, color: '#ef4444', textAlign: 'center' },
  infoRow: { flexDirection: 'row', gap: 16, marginBottom: Spacing.xl },
  infoItem: { alignItems: 'center', gap: 4 },
  infoEmoji: { fontSize: 22 },
  infoLbl: { fontSize: 10, color: Colors.textMuted, fontWeight: '600' },
  startBtn: { borderRadius: Radius.full, paddingVertical: 16, paddingHorizontal: 48, marginTop: Spacing.sm },
  startTxt: { color: '#fff', fontSize: Font.sizes.base, fontWeight: '900', letterSpacing: 1.5 },
  phaseTitle: { fontSize: Font.sizes.lg, fontWeight: '800', color: Colors.text, marginBottom: Spacing.lg },
  timerBox: { borderRadius: Radius.xl, borderWidth: 2, paddingVertical: 24, paddingHorizontal: 40, marginBottom: Spacing.xl },
  timerTxt: { fontSize: 52, fontWeight: '900' },
  statsGrid: { flexDirection: 'row', gap: 10, marginBottom: Spacing.md },
  statCard: { flex: 1, alignItems: 'center', backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1, paddingVertical: 14, gap: 2 },
  statEmoji: { fontSize: 18 },
  statVal: { fontSize: Font.sizes.lg, fontWeight: '900' },
  statUnit: { fontSize: 10, color: Colors.textMuted, fontWeight: '600' },
  milestoneBadge: { borderRadius: Radius.full, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 4, marginBottom: Spacing.md },
  milestoneTxt: { fontSize: Font.sizes.xs, fontWeight: '800' },
  btnRow: { flexDirection: 'row', gap: 12, marginTop: Spacing.sm },
  pauseBtn: { flex: 1, paddingVertical: 14, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  pauseTxt: { color: Colors.textSub, fontWeight: '800', fontSize: Font.sizes.sm },
  endBtn: { flex: 1, paddingVertical: 14, borderRadius: Radius.md, alignItems: 'center' },
  endTxt: { color: '#fff', fontWeight: '800', fontSize: Font.sizes.sm },
  summaryPad: { alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: 80, paddingBottom: 48 },
  doneEmoji: { fontSize: 60, marginBottom: Spacing.sm },
  doneTitle: { fontSize: Font.sizes.xl, fontWeight: '900', color: Colors.text, marginBottom: Spacing.lg },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: Spacing.md, width: '100%' },
  summaryCard: { width: '47%', alignItems: 'center', borderRadius: Radius.md, borderWidth: 1, paddingVertical: 16, gap: 4 },
  summaryEmoji: { fontSize: 22 },
  summaryBig: { fontSize: Font.sizes.xl, fontWeight: '900' },
  summaryLbl: { fontSize: 10, color: Colors.textMuted, fontWeight: '600' },
  statusRow: { flexDirection: 'row', marginBottom: Spacing.md },
  shortBadge: { backgroundColor: '#fb923c20', borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 4 },
  shortTxt: { fontSize: Font.sizes.xs, fontWeight: '800', color: '#fb923c' },
  perfectBadge: { backgroundColor: '#10b98120', borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 4 },
  perfectTxt: { fontSize: Font.sizes.xs, fontWeight: '800', color: '#10b981' },
  routeCard: { backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1, padding: Spacing.md, alignSelf: 'stretch', marginBottom: Spacing.lg },
  routeTitle: { fontSize: Font.sizes.sm, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  routeTxt: { fontSize: Font.sizes.xs, color: Colors.textSub },
  routeSub: { fontSize: Font.sizes.xs, color: Colors.textMuted, marginTop: 2 },
  feelQ: { fontSize: Font.sizes.base, fontWeight: '800', color: Colors.text, marginBottom: Spacing.md },
  feelRow: { flexDirection: 'row', gap: 10, marginBottom: Spacing.xl },
  feelBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card, gap: 6 },
  feelEmoji: { fontSize: 26 },
  feelLabel: { fontSize: 11, fontWeight: '700', color: Colors.textSub },
  saveBtn: { borderRadius: Radius.full, paddingVertical: 16, paddingHorizontal: 48, alignSelf: 'stretch', alignItems: 'center', marginBottom: Spacing.sm },
  saveTxt: { color: '#fff', fontSize: Font.sizes.base, fontWeight: '900', letterSpacing: 1 },
  skipBtn: { paddingVertical: 8 },
  skipTxt: { color: Colors.textMuted, fontSize: Font.sizes.sm, fontWeight: '600' },
});
