import React, { useState, useEffect, useRef, useCallback, Component } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch,
  Platform, ImageBackground, Dimensions, BackHandler, Animated
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import AppBackground from '@/components/AppBackground';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { checkAndRescheduleDaily } from '@/lib/nativeAlarm';
import { store, KEYS } from '@/lib/storage';
import { AlarmSettings, DEFAULT_ALARM_SETTINGS } from '@/lib/notifications';
import { DEFAULT_MISSION_SETTINGS, MissionSettings } from '@/lib/missionAlarm';
import { checkAlarmPermission, requestAllAlarmPermissions } from '@/lib/nativeAlarm';
import {
  useBgContext,
  BG_KEYS, BG_META, type BgKey,
  getTimedBgKey,
} from '@/lib/bgContext';

const { width } = Dimensions.get('window');

// ─── Local Error Boundary ────────────────────────────────────────────────────
class SettingsErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(e: Error) { console.warn('[Settings] Render error caught by boundary:', e?.message); }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#04040A', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontSize: 22, marginBottom: 12 }}>⚙️</Text>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff', marginBottom: 8 }}>Settings couldn't load</Text>
          <TouchableOpacity onPress={() => this.setState({ hasError: false })} style={{ marginTop: 24, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 11, letterSpacing: 1.5 }}>Try Again</Text>
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
      <Text style={sec.label}>{label}</Text>
    </View>
  );
}
const sec = StyleSheet.create({
  row:   { marginHorizontal: 24, marginTop: 32, marginBottom: 12 },
  label: { fontSize: 11, letterSpacing: 2.5, color: 'rgba(255,255,255,0.4)', fontWeight: '700', textTransform: 'uppercase', fontFamily: 'Nunito_700Bold' },
});

// ─── Identity Card (About Section) ───────────────────────────────────────────
function IdentityCard() {
  return (
    <View style={idStyles.card}>
      <LinearGradient colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.01)']} style={StyleSheet.absoluteFillObject} />
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#a78bfa', opacity: 0.05 }]} />
      <View style={idStyles.content}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View>
            <Text style={idStyles.title}>NADA</Text>
            <Text style={idStyles.subtitle}>Ancient Wisdom • Modern Intelligence</Text>
          </View>
          <View style={idStyles.versionBadge}>
            <Text style={idStyles.versionText}>v1.0</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
const idStyles = StyleSheet.create({
  card: { marginHorizontal: 16, marginTop: 12, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: '#0A0A0E' },
  content: { padding: 24 },
  title: { fontSize: 24, fontWeight: '800', color: '#fff', letterSpacing: 2, fontFamily: 'Nunito_800ExtraBold', marginBottom: 6 },
  subtitle: { fontSize: 11, color: 'rgba(255,255,255,0.5)', letterSpacing: 0.5, textTransform: 'uppercase', fontFamily: 'Nunito_400Regular' },
  versionBadge: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  versionText: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.7)', letterSpacing: 1 },
});

// ─── Cinematic Wallpaper Widget ──────────────────────────────────────────────
function CinematicWallpaperWidget() {
  const router = useRouter();
  const { wallpaperMode, manualBgKey, bgKey, allBgUris, solarTimes } = useBgContext();
  const [dynamicTimes, setDynamicTimes] = useState<Partial<Record<BgKey, string>>>({});

  useEffect(() => {
    if (!solarTimes) return;
    const map: Partial<Record<BgKey, {start: number, end: number}>> = {};
    for (let m = 4 * 60; m < 28 * 60; m++) {
      const h = (m / 60) % 24;
      const key = getTimedBgKey(h, solarTimes) as BgKey;
      if (!map[key]) map[key] = { start: (m/60), end: (m/60) };
      else map[key]!.end = (m/60);
    }
    const fmt = (hr: number) => {
      let hh = Math.floor(hr);
      let mm = Math.round((hr - hh) * 60);
      if (mm === 60) { hh += 1; mm = 0; }
      hh = hh % 24;
      const ampm = hh >= 12 ? 'PM' : 'AM';
      const dispH = hh % 12 === 0 ? 12 : hh % 12;
      const dispM = mm.toString().padStart(2, '0');
      return dispM === '00' ? `${dispH} ${ampm}` : `${dispH}:${dispM} ${ampm}`;
    };
    const res: Partial<Record<BgKey, string>> = {};
    for (const k of BG_KEYS) {
      if (map[k]) res[k] = `${fmt(map[k]!.start)}–${fmt(map[k]!.end)}`;
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
      activeOpacity={0.9}
      style={wp.card}
    >
      <ImageBackground source={activeUri ? { uri: activeUri } : undefined} style={wp.previewImg}>
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.6)', '#000000']} style={StyleSheet.absoluteFillObject} />
        <View style={wp.previewContent}>
          <View style={{ flex: 1 }}>
            <View style={wp.tag}>
              <Text style={wp.tagText}>{wallpaperMode === 'solar' ? 'AUTO-SOLAR' : 'PINNED THEME'}</Text>
            </View>
            <Text style={wp.previewName}>{activeMeta.emoji} {activeMeta.label}</Text>
            <Text style={wp.previewTime}>{dynamicTimes[activeBgKey as BgKey] || activeMeta.time}</Text>
          </View>
          <View style={wp.previewBtn}>
            <Ionicons name="color-palette-outline" size={16} color="#fff" />
          </View>
        </View>
      </ImageBackground>
    </TouchableOpacity>
  );
}
const wp = StyleSheet.create({
  card: { marginHorizontal: 16, marginTop: 4, borderRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: '#06060A' },
  previewImg: { height: 180, width: '100%', justifyContent: 'flex-end' },
  previewContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', padding: 24 },
  tag: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginBottom: 8 },
  tagText: { fontSize: 8, fontWeight: '800', color: '#fff', letterSpacing: 1.5 },
  previewName: { fontSize: 24, color: '#fff', fontWeight: '800', letterSpacing: -0.5, fontFamily: 'Nunito_800ExtraBold', marginBottom: 2 },
  previewTime: { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontFamily: 'Nunito_400Regular' },
  previewBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
});

// ─── Sleek Toggle Row ────────────────────────────────────────────────────────
function SleekToggleRow({ emoji, label, sub, value, onToggle, color, last = false }: { emoji: string; label: string; sub: string; value: boolean; onToggle: () => void; color: string; last?: boolean; }) {
  return (
    <View style={tog.row}>
      <View style={[tog.iconWrap, { backgroundColor: color + '15' }]}>
        <Text style={{ fontSize: 18 }}>{emoji}</Text>
      </View>
      <View style={[tog.content, !last && tog.border]}>
        <View style={{ flex: 1, paddingRight: 16 }}>
          <Text style={tog.title}>{label}</Text>
          {sub ? <Text style={tog.sub}>{sub}</Text> : null}
        </View>
        <Switch
          value={value}
          onValueChange={onToggle}
          trackColor={{ false: 'rgba(255,255,255,0.08)', true: color }}
          thumbColor={'#ffffff'}
          ios_backgroundColor="rgba(255,255,255,0.08)"
        />
      </View>
    </View>
  );
}
const tog = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', paddingLeft: 16 },
  content: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 18, paddingRight: 16 },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.06)' },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  title:  { fontSize: 15, color: '#fff', fontWeight: '600', letterSpacing: 0.2, fontFamily: 'Nunito_600SemiBold', marginBottom: 2 },
  sub:    { fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 16, fontFamily: 'Nunito_400Regular' },
});

function GlassCard({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ marginHorizontal: 16, borderRadius: 24, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
      {children}
    </View>
  );
}

// ─── Permission Checker ───────────────────────────────────────────────────────
function PermissionsSection({ onRefresh }: { onRefresh: () => void }) {
  const [perms, setPerms]       = useState({ notifications: true, exactAlarm: true, batteryOpt: true, fullScreen: true });
  const [checking, setChecking] = useState(false);

  const check = async () => {
    try {
      setChecking(true);
      let ea = true, bo = true, fs = true;
      try { ea = await checkAlarmPermission(); } catch { ea = true; }
      try { bo = await ((require('react-native').NativeModules.AlarmModule?.isBatteryOptimizationIgnored?.() as Promise<boolean> | undefined) ?? Promise.resolve(true)); } catch { bo = true; }
      try { fs = await ((require('react-native').NativeModules.AlarmModule?.checkFullScreenIntentPermission?.() as Promise<boolean> | undefined) ?? Promise.resolve(true)); } catch { fs = true; }
      let notifStatus = 'granted';
      try { const result = await (require('expo-notifications') as typeof import('expo-notifications')).getPermissionsAsync(); notifStatus = result.status; } catch { notifStatus = 'granted'; }
      setPerms({ notifications: notifStatus === 'granted', exactAlarm: !!ea, batteryOpt: !!bo, fullScreen: !!fs });
    } catch { } finally { setChecking(false); }
  };
  useEffect(() => { check(); }, []);
  const allOk = perms.notifications && perms.exactAlarm && perms.batteryOpt && perms.fullScreen;
  const handleFix = async () => {
    setChecking(true); await requestAllAlarmPermissions(); await check(); setChecking(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <GlassCard>
      {([
        { label: 'Notifications', ok: perms.notifications },
        { label: 'Schedule Exact Alarms', ok: perms.exactAlarm },
        { label: 'Battery Optimization',  ok: perms.batteryOpt },
        { label: 'Full-Screen Intent',    ok: perms.fullScreen },
      ] as const).map((p, i, arr) => (
        <View key={p.label} style={[perm.row, i < arr.length - 1 && perm.border]}>
          <View style={[perm.dot, { backgroundColor: p.ok ? '#34C759' : '#FF3B30' }]} />
          <Text style={[perm.label, { color: p.ok ? 'rgba(255,255,255,0.4)' : '#fff', fontWeight: p.ok ? '400' : '600' }]}>{p.label}</Text>
          <Text style={{ fontSize: 11, letterSpacing: 1, fontWeight: '700', color: p.ok ? 'rgba(255,255,255,0.3)' : '#FF3B30' }}>{p.ok ? 'OK' : 'MISSING'}</Text>
        </View>
      ))}
      {!allOk && (
        <TouchableOpacity onPress={handleFix} disabled={checking} style={perm.fixBtn} activeOpacity={0.8}>
          <Text style={{ color: '#FF3B30', fontWeight: '700', fontSize: 14 }}>{checking ? 'Checking...' : 'Fix Permissions'}</Text>
        </TouchableOpacity>
      )}
    </GlassCard>
  );
}
const perm = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.06)', marginLeft: 32 },
  dot:    { width: 6, height: 6, borderRadius: 3, marginRight: 12 },
  label:  { flex: 1, fontSize: 13, letterSpacing: 0.2 },
  fixBtn: { borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.06)', paddingVertical: 16, alignItems: 'center', backgroundColor: 'rgba(255,59,48,0.05)' },
});

// ─── Main Settings Screen ────────────────────────────────────────────────────
export default function SettingsTab() {
  const router = useRouter();
  
  useFocusEffect(useCallback(() => {
    const onBackPress = () => { router.navigate('/(tabs)'); return true; };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [router]));

  const scrollRef = useRef<ScrollView>(null);
  const [settings,  setSettings]  = useState<AlarmSettings>(DEFAULT_ALARM_SETTINGS);
  const { bgUri, bgKey, accentColor } = useBgContext();

  useFocusEffect(useCallback(() => { scrollRef.current?.scrollTo({ y: 0, animated: false }); }, []));

  useEffect(() => {
    (async () => {
      const s  = await store.getJSON<AlarmSettings>(KEYS.alarmSettings);
      if (s) setSettings(s);
    })();
  }, []);

  const saveSettings = async (updated: AlarmSettings) => {
    setSettings(updated); await store.setJSON(KEYS.alarmSettings, updated);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    checkAndRescheduleDaily(true).catch(() => {});
  };

  const TOGGLES = [
    { emoji: '🌅', label: 'Sacred Solar Hours', sub: 'Sunrise, Zenith, and Sunset notifications', value: settings.sacredHourNotifs ?? false, onToggle: () => saveSettings({ ...settings, sacredHourNotifs: !(settings.sacredHourNotifs ?? false) }), color: '#fbbf24' },
    { emoji: '🧬', label: 'Circadian Alerts', sub: 'Notify when your body rhythm phase shifts', value: settings.circadianNotifs ?? false, onToggle: () => saveSettings({ ...settings, circadianNotifs: !(settings.circadianNotifs ?? false) }), color: '#a78bfa' },
  ] as const;

  return (
    <SettingsErrorBoundary>
    <View style={[S.screen, { backgroundColor: '#000' }]}>
      <AppBackground />
      <LinearGradient colors={['rgba(0,0,0,0.7)', 'rgba(0,0,0,0.95)', '#000000']} style={StyleSheet.absoluteFillObject} pointerEvents="none" />

      <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
        <View style={S.header}>
          <Text style={S.headerTitle}>Settings</Text>
        </View>
      </SafeAreaView>

      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        
        <IdentityCard />

        <SectionHeader label="Theme & Wallpaper" />
        <CinematicWallpaperWidget />

        <SectionHeader label="Notifications" />
        <GlassCard>
          {TOGGLES.map((row, i) => (
            <SleekToggleRow key={row.label} {...row} last={i === TOGGLES.length - 1} />
          ))}
        </GlassCard>

        {Platform.OS === 'android' && (
          <>
            <SectionHeader label="App Permissions" />
            <PermissionsSection onRefresh={() => {}} />
          </>
        )}
      </ScrollView>
    </View>
    </SettingsErrorBoundary>
  );
}

const S = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: '#000000' },
  header:  { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
  headerTitle: { fontSize: 32, fontWeight: '800', color: '#fff', letterSpacing: -0.5, fontFamily: 'Nunito_800ExtraBold' },
});
