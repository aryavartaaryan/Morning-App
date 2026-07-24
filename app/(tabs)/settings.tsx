import React, { useState, useEffect, useRef, useCallback, Component } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch,
  Alert, Modal, Platform, Linking, ImageBackground, Dimensions,
  Animated, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { getSolarTimes, getSunElevation } from '@/lib/solar';
import { checkAndRescheduleDaily } from '@/lib/nativeAlarm';
import { store, KEYS } from '@/lib/storage';
import { AlarmSettings, DEFAULT_ALARM_SETTINGS } from '@/lib/notifications';
import { DEFAULT_MISSION_SETTINGS, MissionSettings } from '@/lib/missionAlarm';
import { checkAlarmPermission, requestAllAlarmPermissions } from '@/lib/nativeAlarm';
import {
  useBgContext,
  BG_KEYS, BG_META, BG_ACCENT_COLORS, BG_GRADIENT_START,
  type WallpaperMode, type BgKey,
  getTimedBgKey,
} from '@/lib/bgContext';

const PURPLE = '#a78bfa';
const GOLD   = '#fbbf24';
const GREEN  = '#34d399';
const { width, height } = Dimensions.get('window');

// ─── Local Error Boundary ────────────────────────────────────────────────────
// Prevents any render-time error in Settings from crashing the whole app.
class SettingsErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(e: Error) { console.warn('[Settings] Render error caught by boundary:', e?.message); }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#060A18', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontSize: 28, marginBottom: 12 }}>⚙️</Text>
          <Text style={{ fontSize: 15, fontWeight: '900', color: '#fff', marginBottom: 8 }}>Settings couldn't load</Text>
          <Text style={{ fontSize: 11, color: '#FFFFFF50', textAlign: 'center', lineHeight: 18 }}>
            An unexpected error occurred.{`\n`}Please restart the app.
          </Text>
          <TouchableOpacity
            onPress={() => this.setState({ hasError: false })}
            style={{ marginTop: 24, backgroundColor: 'rgba(167,139,250,0.15)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(167,139,250,0.3)' }}
          >
            <Text style={{ color: '#a78bfa', fontWeight: '700', fontSize: 13 }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

// ─── Section header ──────────────────────────────────────────────────────────
function SectionHeader({
  emoji, label, color, line = true,
}: {
  emoji: string; label: string; color: string; line?: boolean;
}) {
  return (
    <View style={sec.row}>
      <Text style={{ fontSize: 11 }}>{emoji}</Text>
      <Text style={[sec.label, { color }]}>{label}</Text>
      {line && <View style={[sec.line, { backgroundColor: color + '28' }]} />}
    </View>
  );
}
const sec = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 22, marginBottom: 10, gap: 7 },
  label: { fontSize: 9, fontWeight: '900', letterSpacing: 1.8, fontFamily: 'Nunito_900Black' },
  line:  { flex: 1, height: 1 },
});

// ─── Glass card ──────────────────────────────────────────────────────────────
function GlassCard({
  children, style, noPad = false,
}: {
  children: React.ReactNode; style?: object; noPad?: boolean;
}) {
  return (
    <View style={[glass.card, style]}>
      {children}
    </View>
  );
}
const glass = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(5,10,30,0.55)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.40,
    shadowRadius: 22,
    elevation: 14,
  },
});

// ─── Toggle row ──────────────────────────────────────────────────────────────
function ToggleRow({
  emoji, label, sub, value, onToggle, color, last = false,
}: {
  emoji: string; label: string; sub: string;
  value: boolean; onToggle: () => void;
  color: string; last?: boolean;
}) {
  return (
    <View style={[tog.row, !last && tog.border]}>
      <View style={[tog.icon, { backgroundColor: color + '18' }]}>
        <Text style={{ fontSize: 18 }}>{emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={tog.title}>{label}</Text>
        <Text style={tog.sub}>{sub}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: '#222', true: color + '80' }}
        thumbColor={value ? color : '#555'}
      />
    </View>
  );
}
const tog = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  border: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  icon:   { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  title:  { fontSize: 13, fontWeight: '800', color: '#fff', fontFamily: 'Nunito_800ExtraBold' },
  sub:    { fontSize: 10, color: '#FFFFFF40', marginTop: 2 },
});

function WallpaperPicker() {
  const router = useRouter();
  const {
    wallpaperMode, manualBgKey,
    bgKey, allBgUris, solarTimes
  } = useBgContext();

  const [dynamicTimes, setDynamicTimes] = useState<Partial<Record<BgKey, string>>>({});

  useEffect(() => {
    if (!solarTimes) return;
    const map: Partial<Record<BgKey, {start: number, end: number}>> = {};
    for (let m = 4 * 60; m < 28 * 60; m++) {
      const h = (m / 60) % 24;
      const key = getTimedBgKey(h, solarTimes) as BgKey;
      if (!map[key]) {
        map[key] = { start: (m/60), end: (m/60) };
      } else {
        map[key]!.end = (m/60);
      }
    }
    const fmt = (hr: number) => {
      let hh = Math.floor(hr);
      let mm = Math.round((hr - hh) * 60);
      if (mm === 60) { hh += 1; mm = 0; }
      hh = hh % 24;
      const ampm = hh >= 12 ? 'PM' : 'AM';
      const dispH = hh % 12 === 0 ? 12 : hh % 12;
      const dispM = mm.toString().padStart(2, '0');
      if (dispM === '00') return `${dispH} ${ampm}`;
      return `${dispH}:${dispM} ${ampm}`;
    };
    const res: Partial<Record<BgKey, string>> = {};
    for (const k of BG_KEYS) {
      if (map[k]) {
        res[k] = `${fmt(map[k]!.start)}–${fmt(map[k]!.end)}`;
      }
    }
    setDynamicTimes(res);
  }, [solarTimes]);

  const activeBgKey = wallpaperMode === 'manual' ? manualBgKey : bgKey;
  const activeMeta  = BG_META[activeBgKey as BgKey] ?? BG_META.morning;
  const rawActiveUri = allBgUris[activeBgKey as BgKey];
  const activeUri   = (rawActiveUri && rawActiveUri.length > 4) ? rawActiveUri : null;

  return (
    <TouchableOpacity
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.push('/wallpaper');
      }}
      activeOpacity={0.88}
      style={[glass.card, { marginHorizontal: 16, marginTop: 10, overflow: 'hidden' }]}
    >
      <ImageBackground
        source={activeUri ? { uri: activeUri } : undefined}
        style={wp.previewImg}
        imageStyle={{ borderRadius: 20 }}
      >
        <LinearGradient
          colors={['rgba(0,0,0,0.08)', 'rgba(0,0,0,0.65)']}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={wp.previewContent}>
          <View>
            <Text style={wp.previewTime}>{dynamicTimes[activeBgKey as BgKey] || activeMeta.time}</Text>
            <Text style={wp.previewName}>{activeMeta.emoji}  {activeMeta.label}</Text>
            <Text style={wp.previewSub}>{activeMeta.sub}</Text>
          </View>
          <View style={wp.previewBtn}>
            <Ionicons name="images-outline" size={16} color="#fff" />
            <Text style={wp.previewBtnTxt}>
              Change Wallpaper
            </Text>
          </View>
        </View>
      </ImageBackground>
    </TouchableOpacity>
  );
}

const wp = StyleSheet.create({
  modeRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
  modeIcon:  { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.06)' },
  modeTitle: { fontSize: 13, fontWeight: '800', color: '#fff', fontFamily: 'Nunito_800ExtraBold' },
  modeSub:   { fontSize: 10, color: '#FFFFFF45', marginTop: 2, lineHeight: 14 },
  radio:     { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: 'rgba(255,255,255,0.20)', alignItems: 'center', justifyContent: 'center' },
  radioDot:  { width: 10, height: 10, borderRadius: 5 },

  previewImg:     { height: 140, width: '100%' },
  previewContent: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', padding: 16 },
  previewTime:    { fontSize: 9, fontWeight: '800', color: '#FFFFFF80', letterSpacing: 1.5, marginBottom: 3 },
  previewName:    { fontSize: 17, fontWeight: '900', color: '#fff', fontFamily: 'Nunito_900Black' },
  previewSub:     { fontSize: 10, color: '#FFFFFF70', marginTop: 2 },
  previewBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  previewBtnTxt:  { fontSize: 11, fontWeight: '800', color: '#fff' },

  sheetBg:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end' },
  sheet:       { backgroundColor: '#080D1C', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '88%', borderWidth: 1, borderBottomWidth: 0, borderColor: 'rgba(255,255,255,0.12)' },
  handle:      { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', alignSelf: 'center', marginTop: 12, marginBottom: 6 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  sheetTitle:  { fontSize: 17, fontWeight: '900', color: '#fff', fontFamily: 'Nunito_900Black' },
  sheetSub:    { fontSize: 10, color: '#FFFFFF40', marginTop: 2 },
  closeBtn:    { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' },

  bgCard:        { borderRadius: 16, overflow: 'hidden' },
  bgCardImg:     { height: 100, width: '100%' },
  bgCardContent: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', padding: 12 },
  bgCardTime:    { fontSize: 8, fontWeight: '800', color: '#FFFFFF70', letterSpacing: 1.4, marginBottom: 2 },
  bgCardLabel:   { fontSize: 14, fontWeight: '900', color: '#fff', fontFamily: 'Nunito_900Black' },
  bgCardSub:     { fontSize: 9, color: '#FFFFFF65', marginTop: 1 },
  activePill:    { backgroundColor: 'rgba(255,255,255,0.20)', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  activePillTxt: { fontSize: 9, fontWeight: '900', color: '#fff', letterSpacing: 0.8 },

  solarNote:    { alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  solarNoteTxt: { fontSize: 11, color: '#FFFFFF50', textAlign: 'center', lineHeight: 16 },
});

// ─── Permission Checker ───────────────────────────────────────────────────────
interface PermState { notifications: boolean; exactAlarm: boolean; batteryOpt: boolean; fullScreen: boolean; }

function PermissionsSection({ onRefresh }: { onRefresh: () => void }) {
  const [perms, setPerms]       = useState<PermState>({ notifications: true, exactAlarm: true, batteryOpt: true, fullScreen: true });
  const [checking, setChecking] = useState(false);

  const check = async () => {
    try {
      setChecking(true);
      // Each permission check is individually guarded so one failing native
      // module cannot crash the entire check (e.g. isBatteryOptimizationIgnored
      // may throw synchronously on some Android ROMs).
      let ea = true, bo = true, fs = true;
      try { ea = await checkAlarmPermission(); } catch { ea = true; }
      try {
        bo = await (
          (require('react-native').NativeModules.AlarmModule?.isBatteryOptimizationIgnored?.() as Promise<boolean> | undefined)
          ?? Promise.resolve(true)
        );
      } catch { bo = true; }
      try {
        fs = await (
          (require('react-native').NativeModules.AlarmModule?.checkFullScreenIntentPermission?.() as Promise<boolean> | undefined)
          ?? Promise.resolve(true)
        );
      } catch { fs = true; }
      let notifStatus = 'granted';
      try {
        const result = await (require('expo-notifications') as typeof import('expo-notifications')).getPermissionsAsync();
        notifStatus = result.status;
      } catch { notifStatus = 'granted'; }
      setPerms({ notifications: notifStatus === 'granted', exactAlarm: !!ea, batteryOpt: !!bo, fullScreen: !!fs });
    } catch { /* silent — permissions UI is non-critical */ } finally {
      setChecking(false);
    }
  };



  useEffect(() => { check(); }, []);

  const allOk = perms.notifications && perms.exactAlarm && perms.batteryOpt && perms.fullScreen;

  const handleFix = async () => {
    setChecking(true);
    await requestAllAlarmPermissions();
    await check();
    setChecking(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <GlassCard>
      {([
        { label: 'Notifications',         ok: perms.notifications },
        { label: 'Schedule Exact Alarms', ok: perms.exactAlarm },
        { label: 'Battery Optimization',  ok: perms.batteryOpt },
        { label: 'Full-Screen Intent',    ok: perms.fullScreen },
      ] as const).map((p, i, arr) => (
        <View key={p.label} style={[perm.row, i < arr.length - 1 && perm.border]}>
          <View style={[perm.dot, { backgroundColor: p.ok ? '#10b981' : '#ef4444' }]} />
          <Text style={[perm.label, { color: p.ok ? '#FFFFFF60' : '#fff', fontWeight: p.ok ? '500' : '700' }]}>
            {p.label}
          </Text>
          <Text style={{ fontSize: 9, fontWeight: '800', color: p.ok ? '#10b981' : '#ef4444' }}>
            {p.ok ? 'OK' : 'MISSING'}
          </Text>
        </View>
      ))}
      {!allOk && (
        <TouchableOpacity onPress={handleFix} disabled={checking} style={perm.fixBtn} activeOpacity={0.8}>
          <Text style={{ color: '#ef4444', fontWeight: '900', fontSize: 13 }}>
            {checking ? 'Checking...' : '⚡  Fix Permissions'}
          </Text>
        </TouchableOpacity>
      )}
    </GlassCard>
  );
}
const perm = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  border: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  dot:    { width: 8, height: 8, borderRadius: 4 },
  label:  { flex: 1, fontSize: 13 },
  fixBtn: { margin: 12, backgroundColor: '#ef444412', borderWidth: 1, borderColor: '#ef444432', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
});


// ─── Main Settings Screen ────────────────────────────────────────────────────
export default function SettingsTab() {
  const scrollRef = useRef<ScrollView>(null);
  const [settings,  setSettings]  = useState<AlarmSettings>(DEFAULT_ALARM_SETTINGS);
  const [mission,   setMission]   = useState<MissionSettings>(DEFAULT_MISSION_SETTINGS);
  const { bgUri, bgKey, accentColor } = useBgContext();

  useFocusEffect(
    useCallback(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, [])
  );

  useEffect(() => {
    (async () => {
      const s  = await store.getJSON<AlarmSettings>(KEYS.alarmSettings);
      const ms = await store.getJSON<MissionSettings>(KEYS.missionSettings);
      if (s)  setSettings(s);
      if (ms) setMission({ ...DEFAULT_MISSION_SETTINGS, ...ms });
    })();
  }, []);

  const saveSettings = async (updated: AlarmSettings) => {
    setSettings(updated); await store.setJSON(KEYS.alarmSettings, updated);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    checkAndRescheduleDaily(true).catch(() => {});
  };
  const saveMission = async (updated: MissionSettings) => {
    setMission(updated); await store.setJSON(KEYS.missionSettings, updated);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };



  const TOGGLES = [
    // { emoji: '🤖', label: 'Morning Brief',  sub: 'AI speaks your personalized morning brief',   val: mission.bodhiMorningBrief,    onToggle: () => saveMission({ ...mission, bodhiMorningBrief: !mission.bodhiMorningBrief }),            color: PURPLE },
    { emoji: '🌅', label: 'Sacred Solar Hours', sub: 'Notify at Sunrise · Solar Zenith · Sunset', val: settings.sacredHourNotifs ?? false, onToggle: () => saveSettings({ ...settings, sacredHourNotifs: !(settings.sacredHourNotifs ?? false) }), color: '#f97316' },
    { emoji: '🔬', label: 'Circadian Alerts', sub: 'Notify when your body rhythm phase shifts', val: settings.circadianNotifs ?? false, onToggle: () => saveSettings({ ...settings, circadianNotifs: !(settings.circadianNotifs ?? false) }), color: '#38bdf8' },
    // { emoji: '📈', label: 'Gradual Volume', sub: 'Alarm fades in over 60 seconds (Android)',     val: mission.gradualVolume ?? false, onToggle: () => saveMission({ ...mission, gradualVolume: !(mission.gradualVolume ?? false) }),       color: '#60a5fa' },
  ] as const;

  return (
    <SettingsErrorBoundary>
    <ImageBackground
      source={bgUri ? { uri: bgUri } : undefined}
      style={S.screen}
      imageStyle={{ opacity: 1 }}
    >
      {/* Glassmorphism overlays — iOS-style dark theme for settings */}
      <LinearGradient
        colors={['rgba(0,0,0,0.92)', 'rgba(0,0,0,0.90)', 'rgba(0,0,0,0.85)']}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      <LinearGradient
        colors={[PURPLE + '18', 'transparent']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.35 }}
        pointerEvents="none"
      />
      {/* Frost glass shimmer — top band */}
      <LinearGradient
        colors={['rgba(255,255,255,0.09)', 'rgba(255,255,255,0.03)', 'transparent']}
        style={[StyleSheet.absoluteFillObject, { height: 200 }]}
        pointerEvents="none"
      />

      <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
        <View style={S.header}>
          <View style={{ flex: 1 }}>
            <Text style={S.headerCap}>YOUR APP  ·  PERSONALISATION</Text>
            <Text style={S.headerTitle}>⚙️  Settings</Text>
          </View>
          <View style={[S.versionPill]}>
            <Text style={S.versionTxt}>v1.0</Text>
          </View>
        </View>
        <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.10)' }} />
      </SafeAreaView>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120, paddingTop: 4 }}
        showsVerticalScrollIndicator={false}
      >

        {/* ── 1. Background & Wallpaper ── */}
        <SectionHeader emoji="🌅" label="BACKGROUND THEME" color="#fbbf24" />
        <WallpaperPicker />


        {/* ── 3. Behaviour Toggles ── */}
        <SectionHeader emoji="⚡" label="APP BEHAVIOUR" color="#FFFFFF50" />
        <GlassCard>
          {TOGGLES.map((row, i) => (
            <ToggleRow
              key={row.label}
              emoji={row.emoji}
              label={row.label}
              sub={row.sub}
              value={row.val}
              onToggle={row.onToggle}
              color={row.color}
              last={i === TOGGLES.length - 1}
            />
          ))}
        </GlassCard>

        {/* ── 4. Permissions (Android only) ── */}
        {Platform.OS === 'android' && (
          <>
            <SectionHeader emoji="🔐" label="APP PERMISSIONS" color="#ef444468" />
            <PermissionsSection onRefresh={() => {}} />
          </>
        )}

        {/* ── 5. About ── */}
        <SectionHeader emoji="ℹ️" label="ABOUT" color="#FFFFFF30" />
        <GlassCard>
          <View style={{ padding: 16, gap: 8 }}>
            <Text style={{ fontSize: 18, fontWeight: '900', color: GOLD, letterSpacing: -0.5 }}>
              Nada
            </Text>
            <Text style={{ fontSize: 12, color: '#FFFFFF80', lineHeight: 18, marginTop: 2 }}>
              Rise with the sun · Ancient Wisdom · Modern Intelligence
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              {['Solar Rhythms', 'Ayurveda', 'Vedic Panchang', 'Open-Meteo API', 'Android AlarmManager'].map(tag => (
                <View key={tag} style={S.tagPill}>
                  <Text style={S.tagTxt}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        </GlassCard>
      </ScrollView>

    </ImageBackground>
    </SettingsErrorBoundary>
  );
}

const S = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: '#060A18' },
  header:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 12 },
  headerCap:   { fontSize: 9, fontWeight: '900', color: '#FFFFFF45', letterSpacing: 1.8, marginBottom: 4 },
  headerTitle: { fontSize: 22, fontWeight: '200', color: '#fff', letterSpacing: -0.5 },
  versionPill: { borderWidth: 1, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5, borderColor: PURPLE + '44', backgroundColor: PURPLE + '14' },
  versionTxt:  { fontSize: 10, fontWeight: '800', color: PURPLE, letterSpacing: 0.3 },

  tagPill: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  tagTxt:  { fontSize: 9, fontWeight: '700', color: '#FFFFFF55', letterSpacing: 0.5 },
});
