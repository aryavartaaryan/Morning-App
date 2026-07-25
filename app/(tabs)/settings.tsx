import React, { useState, useEffect, useRef, useCallback, Component } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch,
  Alert, Modal, Platform, Linking, ImageBackground, Dimensions,
  Animated, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
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
function SectionHeader({ label }: { label: string; }) {
  return (
    <View style={sec.row}>
      <Text style={sec.label}>{label.toUpperCase()}</Text>
    </View>
  );
}
const sec = StyleSheet.create({
  row:   { marginHorizontal: 32, marginTop: 28, marginBottom: 8 },
  label: { fontSize: 13, color: '#EBEBF599', fontWeight: '500', letterSpacing: 0 },
});

// ─── Glass card ──────────────────────────────────────────────────────────────
function GlassCard({ children, style }: { children: React.ReactNode; style?: object; }) {
  return (
    <BlurView intensity={60} tint="dark" style={[glass.card, style]}>
      {children}
    </BlurView>
  );
}
const glass = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(20,20,20,0.4)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.15)',
  },
});

// ─── Toggle row ──────────────────────────────────────────────────────────────
function ToggleRow({ emoji, label, sub, value, onToggle, color, last = false }: { emoji: string; label: string; sub: string; value: boolean; onToggle: () => void; color: string; last?: boolean; }) {
  return (
    <View style={[tog.row]}>
      <View style={[tog.icon, { backgroundColor: color }]}>
        <Text style={{ fontSize: 18 }}>{emoji}</Text>
      </View>
      <View style={[tog.content, !last && tog.border]}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={tog.title}>{label}</Text>
          {sub ? <Text style={tog.sub}>{sub}</Text> : null}
        </View>
        <Switch
          value={value}
          onValueChange={onToggle}
          trackColor={{ false: 'rgba(255,255,255,0.1)', true: '#34C759' }}
          thumbColor={'#ffffff'}
          ios_backgroundColor="rgba(255,255,255,0.1)"
        />
      </View>
    </View>
  );
}
const tog = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', paddingLeft: 16 },
  content: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingRight: 16 },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.15)' },
  icon:   { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  title:  { fontSize: 17, color: '#fff', fontWeight: '400' },
  sub:    { fontSize: 13, color: '#EBEBF599', marginTop: 2, lineHeight: 16 },
});

function WallpaperPicker() {
  const router = useRouter();
  const { wallpaperMode, manualBgKey, bgKey, allBgUris, solarTimes } = useBgContext();
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
      activeOpacity={0.8}
      style={wp.card}
    >
      <ImageBackground source={activeUri ? { uri: activeUri } : undefined} style={wp.previewImg}>
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={StyleSheet.absoluteFillObject} />
        <View style={wp.previewContent}>
          <View style={{ flex: 1 }}>
            <Text style={wp.previewTime}>{dynamicTimes[activeBgKey as BgKey] || activeMeta.time}</Text>
            <Text style={wp.previewName}>{activeMeta.emoji} {activeMeta.label}</Text>
          </View>
          <View style={wp.previewBtn}>
            <Text style={wp.previewBtnTxt}>Edit</Text>
          </View>
        </View>
      </ImageBackground>
    </TouchableOpacity>
  );
}

const wp = StyleSheet.create({
  card: { marginHorizontal: 16, marginTop: 4, borderRadius: 16, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: '#111' },
  previewImg: { height: 160, width: '100%', justifyContent: 'flex-end' },
  previewContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', padding: 16 },
  previewTime: { fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  previewName: { fontSize: 22, color: '#fff', fontWeight: '700' },
  previewBtn: { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  previewBtnTxt: { color: '#fff', fontSize: 13, fontWeight: '600' },
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
          <View style={[perm.dot, { backgroundColor: p.ok ? '#34C759' : '#FF3B30' }]} />
          <Text style={[perm.label, { color: p.ok ? '#EBEBF599' : '#fff', fontWeight: p.ok ? '400' : '500' }]}>
            {p.label}
          </Text>
          <Text style={{ fontSize: 13, fontWeight: '500', color: p.ok ? '#EBEBF560' : '#FF3B30' }}>
            {p.ok ? 'OK' : 'MISSING'}
          </Text>
        </View>
      ))}
      {!allOk && (
        <TouchableOpacity onPress={handleFix} disabled={checking} style={perm.fixBtn} activeOpacity={0.8}>
          <Text style={{ color: '#FF3B30', fontWeight: '500', fontSize: 16 }}>
            {checking ? 'Checking...' : 'Fix Permissions'}
          </Text>
        </TouchableOpacity>
      )}
    </GlassCard>
  );
}
const perm = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.15)', marginLeft: 34 },
  dot:    { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  label:  { flex: 1, fontSize: 15 },
  fixBtn: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.15)', paddingVertical: 14, alignItems: 'center' },
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
    { emoji: '🌅', label: 'Sacred Solar Hours', sub: 'Sunrise, Zenith, and Sunset notifications', val: settings.sacredHourNotifs ?? false, onToggle: () => saveSettings({ ...settings, sacredHourNotifs: !(settings.sacredHourNotifs ?? false) }), color: '#FF9500' },
    { emoji: '🔬', label: 'Circadian Alerts', sub: 'Notify when your body rhythm phase shifts', val: settings.circadianNotifs ?? false, onToggle: () => saveSettings({ ...settings, circadianNotifs: !(settings.circadianNotifs ?? false) }), color: '#0A84FF' },
  ] as const;

  return (
    <SettingsErrorBoundary>
    <ImageBackground
      source={bgUri ? { uri: bgUri } : undefined}
      style={S.screen}
      imageStyle={{ opacity: 1 }}
    >
      <LinearGradient
        colors={['rgba(0,0,0,0.85)', 'rgba(0,0,0,0.92)', '#000000']}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
        <View style={S.header}>
          <Text style={S.headerTitle}>Settings</Text>
        </View>
      </SafeAreaView>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >

        {/* ── 1. Background & Wallpaper ── */}
        <SectionHeader label="Theme & Wallpaper" />
        <WallpaperPicker />


        {/* ── 3. Behaviour Toggles ── */}
        <SectionHeader label="Notifications" />
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
            <SectionHeader label="App Permissions" />
            <PermissionsSection onRefresh={() => {}} />
          </>
        )}

        {/* ── 5. About ── */}
        <SectionHeader label="About" />
        <GlassCard>
          <View style={{ padding: 16, gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 20, fontWeight: '600', color: '#fff' }}>Nada</Text>
              <Text style={{ fontSize: 15, color: '#EBEBF560' }}>v1.0</Text>
            </View>
            <Text style={{ fontSize: 13, color: '#EBEBF599', lineHeight: 18 }}>
              Rise with the sun · Ancient Wisdom · Modern Intelligence
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {['Solar Rhythms', 'Ayurveda', 'Vedic Panchang', 'Native Alarms'].map(tag => (
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
  screen:  { flex: 1, backgroundColor: '#000000' },
  header:  { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  headerTitle: { fontSize: 34, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },

  tagPill: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.15)' },
  tagTxt:  { fontSize: 11, fontWeight: '500', color: '#EBEBF5', letterSpacing: 0.2 },
});
