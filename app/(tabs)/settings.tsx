import React, { useState, useEffect, useRef, useCallback, Component } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch,
  Platform, ImageBackground, Dimensions,
  Animated, BackHandler
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { getTimedBgKey } from '@/lib/solar';
import { checkAndRescheduleDaily } from '@/lib/nativeAlarm';
import { store, KEYS } from '@/lib/storage';
import { AlarmSettings, DEFAULT_ALARM_SETTINGS } from '@/lib/notifications';
import { DEFAULT_MISSION_SETTINGS, MissionSettings } from '@/lib/missionAlarm';
import { checkAlarmPermission, requestAllAlarmPermissions } from '@/lib/nativeAlarm';
import {
  useBgContext,
  BG_KEYS, BG_META,
  type BgKey,
} from '@/lib/bgContext';

const PURPLE = '#a78bfa';
const GOLD   = '#fbbf24';
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ─── Local Error Boundary ────────────────────────────────────────────────────
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
          <Text style={{ fontSize: 22, marginBottom: 12 }}>⚙️</Text>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff', marginBottom: 8 }}>Settings couldn't load</Text>
          <Text style={{ fontSize: 12, letterSpacing: 0.2, color: '#FFFFFF50', textAlign: 'center', lineHeight: 18 }}>
            An unexpected error occurred.{`\n`}Please restart the app.
          </Text>
          <TouchableOpacity
            onPress={() => this.setState({ hasError: false })}
            style={{ marginTop: 24, backgroundColor: 'rgba(167,139,250,0.15)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(167,139,250,0.3)' }}
          >
            <Text style={{ color: '#a78bfa', fontWeight: '700', fontSize: 11, letterSpacing: 1.5 }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

// ─── Glass Dashboard Module ──────────────────────────────────────────────────
function DashboardModule({ children, title, icon, color = GOLD }: { children: React.ReactNode; title: string; icon: keyof typeof Ionicons.glyphMap; color?: string; }) {
  return (
    <View style={mod.container}>
      <BlurView intensity={35} tint="dark" style={mod.card}>
        <LinearGradient
          colors={[`${color}0A`, 'transparent']}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        />
        <View style={mod.header}>
          <Ionicons name={icon} size={16} color={color} style={{ marginRight: 8 }} />
          <Text style={[mod.title, { color }]}>{title}</Text>
        </View>
        <View style={mod.content}>
          {children}
        </View>
      </BlurView>
    </View>
  );
}

const mod = StyleSheet.create({
  container: { marginHorizontal: 20, marginBottom: 24, borderRadius: 28, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10 },
  card: { borderRadius: 28, overflow: 'hidden', backgroundColor: 'rgba(20,25,35,0.4)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.12)' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.06)' },
  title: { fontSize: 13, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' },
  content: { paddingBottom: 8 },
});

// ─── Custom Premium Toggle Row ───────────────────────────────────────────────
function PremiumToggleRow({ label, sub, value, onToggle, color, last = false }: { label: string; sub: string; value: boolean; onToggle: () => void; color: string; last?: boolean; }) {
  // Animated value for custom switch
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(anim, {
      toValue: value ? 1 : 0,
      useNativeDriver: false,
      bounciness: 10,
      speed: 12
    }).start();
  }, [value]);

  const bgColor = anim.interpolate({ inputRange: [0, 1], outputRange: ['rgba(255,255,255,0.1)', color] });
  const thumbLeft = anim.interpolate({ inputRange: [0, 1], outputRange: [2, 22] });

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onToggle();
      }}
      style={[ptog.row, !last && ptog.border]}
    >
      <View style={ptog.textContainer}>
        <Text style={ptog.title}>{label}</Text>
        {sub ? <Text style={ptog.sub}>{sub}</Text> : null}
      </View>
      <Animated.View style={[ptog.switchTrack, { backgroundColor: bgColor }]}>
        <Animated.View style={[ptog.switchThumb, { left: thumbLeft }]} />
      </Animated.View>
    </TouchableOpacity>
  );
}
const ptog = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, paddingHorizontal: 20 },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.06)' },
  textContainer: { flex: 1, paddingRight: 20 },
  title: { fontSize: 16, color: '#fff', fontWeight: '400', letterSpacing: 0.5 },
  sub: { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 4, lineHeight: 18, letterSpacing: 0.2 },
  switchTrack: { width: 50, height: 28, borderRadius: 14, justifyContent: 'center' },
  switchThumb: { position: 'absolute', width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 3 },
});


// ─── Hero Wallpaper Picker ───────────────────────────────────────────────────
function HeroWallpaperPicker({ scrollY }: { scrollY: Animated.Value }) {
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

  // Parallax effects
  const headerHeight = SCREEN_H * 0.45;
  const scale = scrollY.interpolate({
    inputRange: [-100, 0, headerHeight],
    outputRange: [1.3, 1, 1],
    extrapolate: 'clamp'
  });
  const translateY = scrollY.interpolate({
    inputRange: [0, headerHeight],
    outputRange: [0, headerHeight * 0.5],
    extrapolate: 'clamp'
  });

  return (
    <View style={{ height: headerHeight, width: '100%', position: 'relative' }}>
      <Animated.View style={[StyleSheet.absoluteFillObject, { transform: [{ scale }, { translateY }] }]}>
        <ImageBackground source={activeUri ? { uri: activeUri } : undefined} style={{ flex: 1, backgroundColor: '#060A18' }}>
          <LinearGradient colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.4)', '#000000']} style={StyleSheet.absoluteFillObject} locations={[0, 0.6, 1]} />
        </ImageBackground>
      </Animated.View>
      
      <SafeAreaView edges={['top']} style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
        <Text style={hwp.pageTitle}>Settings</Text>
      </SafeAreaView>

      <View style={hwp.overlayContent}>
        <View style={hwp.themeInfo}>
          <Text style={hwp.themeSub}>
            {wallpaperMode === 'solar' ? 'AUTO-SOLAR THEME' : 'PINNED THEME'} • {dynamicTimes[activeBgKey as BgKey] || activeMeta.time}
          </Text>
          <Text style={hwp.themeTitle}>{activeMeta.emoji} {activeMeta.label}</Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push('/wallpaper');
          }}
          style={hwp.editBtn}
        >
          <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFillObject} />
          <Ionicons name="color-palette" size={16} color="#fff" style={{ marginRight: 6 }} />
          <Text style={hwp.editBtnTxt}>Change Theme</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const hwp = StyleSheet.create({
  pageTitle: { fontSize: 24, fontWeight: '300', color: '#fff', letterSpacing: 2, textAlign: 'center', marginTop: 12, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 },
  overlayContent: { position: 'absolute', bottom: 32, left: 24, right: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  themeInfo: { flex: 1, paddingRight: 16 },
  themeSub: { fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '700', letterSpacing: 1.5, marginBottom: 6 },
  themeTitle: { fontSize: 28, color: '#fff', fontWeight: '300', letterSpacing: 1, textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 },
  editBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 24, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.1)' },
  editBtnTxt: { color: '#fff', fontSize: 13, fontWeight: '600', letterSpacing: 0.5 },
});


// ─── Permission Checker ───────────────────────────────────────────────────────
interface PermState { notifications: boolean; exactAlarm: boolean; batteryOpt: boolean; fullScreen: boolean; }

function PermissionsSection({ onRefresh }: { onRefresh: () => void }) {
  const [perms, setPerms]       = useState<PermState>({ notifications: true, exactAlarm: true, batteryOpt: true, fullScreen: true });
  const [checking, setChecking] = useState(false);

  const check = async () => {
    try {
      setChecking(true);
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
    } catch { /* silent */ } finally {
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

  if (allOk) return null; // Don't show in premium UI if everything is fine

  return (
    <DashboardModule title="System Permissions" icon="warning" color="#FF3B30">
      {([
        { label: 'Notifications',         ok: perms.notifications },
        { label: 'Schedule Exact Alarms', ok: perms.exactAlarm },
        { label: 'Battery Optimization',  ok: perms.batteryOpt },
        { label: 'Full-Screen Intent',    ok: perms.fullScreen },
      ] as const).map((p, i, arr) => (
        <View key={p.label} style={[perm.row, i < arr.length - 1 && perm.border]}>
          <View style={[perm.dot, { backgroundColor: p.ok ? '#34C759' : '#FF3B30' }]} />
          <Text style={[perm.label, { color: p.ok ? 'rgba(235,235,245,0.4)' : '#fff', fontWeight: p.ok ? '400' : '500' }]}>
            {p.label}
          </Text>
          {!p.ok && (
            <Text style={{ fontSize: 11, letterSpacing: 1, fontWeight: '700', color: '#FF3B30' }}>
              ACTION REQUIRED
            </Text>
          )}
        </View>
      ))}
      <TouchableOpacity onPress={handleFix} disabled={checking} style={perm.fixBtn} activeOpacity={0.8}>
        <LinearGradient colors={['rgba(255,59,48,0.15)', 'rgba(255,59,48,0.05)']} style={StyleSheet.absoluteFillObject} />
        <Text style={{ color: '#FF3B30', fontWeight: '700', fontSize: 14, letterSpacing: 1 }}>
          {checking ? 'CHECKING...' : 'RESOLVE ISSUES'}
        </Text>
      </TouchableOpacity>
    </DashboardModule>
  );
}
const perm = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.06)' },
  dot:    { width: 6, height: 6, borderRadius: 3, marginRight: 14 },
  label:  { flex: 1, fontSize: 14, letterSpacing: 0.3 },
  fixBtn: { marginTop: 8, marginHorizontal: 20, marginBottom: 20, borderRadius: 16, overflow: 'hidden', paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,59,48,0.3)' },
});


// ─── Main Settings Screen ────────────────────────────────────────────────────
export default function SettingsTab() {
  const router = useRouter();
  
  useFocusEffect(useCallback(() => {
    const onBackPress = () => {
      router.navigate('/(tabs)');
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [router]));

  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(new Animated.Value(0)).current;

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
    checkAndRescheduleDaily(true).catch(() => {});
  };

  const TOGGLES = [
    { label: 'Sacred Solar Hours', sub: 'Sunrise, Zenith, and Sunset notifications', val: settings.sacredHourNotifs ?? false, onToggle: () => saveSettings({ ...settings, sacredHourNotifs: !(settings.sacredHourNotifs ?? false) }), color: GOLD },
    { label: 'Circadian Alerts', sub: 'Notify when your body rhythm phase shifts', val: settings.circadianNotifs ?? false, onToggle: () => saveSettings({ ...settings, circadianNotifs: !(settings.circadianNotifs ?? false) }), color: PURPLE },
  ] as const;

  return (
    <SettingsErrorBoundary>
      <View style={[S.screen]}>
        
        <Animated.ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
          scrollEventThrottle={16}
        >
          {/* ── 1. Hero Parallax Wallpaper Picker ── */}
          <HeroWallpaperPicker scrollY={scrollY} />

          <View style={{ marginTop: -20, zIndex: 10 }}>
            {/* ── 2. Permissions (Android only) ── */}
            {Platform.OS === 'android' && (
              <PermissionsSection onRefresh={() => {}} />
            )}

            {/* ── 3. Notifications Dashboard Module ── */}
            <DashboardModule title="Smart Notifications" icon="notifications" color="#0A84FF">
              {TOGGLES.map((row, i) => (
                <PremiumToggleRow
                  key={row.label}
                  label={row.label}
                  sub={row.sub}
                  value={row.val}
                  onToggle={row.onToggle}
                  color={row.color}
                  last={i === TOGGLES.length - 1}
                />
              ))}
            </DashboardModule>

            {/* ── 4. About Dashboard Module ── */}
            <DashboardModule title="About Application" icon="information-circle" color={PURPLE}>
              <View style={{ padding: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontSize: 20, fontWeight: '300', color: '#fff', letterSpacing: 1 }}>Nada App</Text>
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                    <Text style={{ fontSize: 11, color: '#fff', fontWeight: '700' }}>v1.0</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 13, letterSpacing: 0.5, color: '#EBEBF599', lineHeight: 20, marginBottom: 16 }}>
                  Rise with the sun. Blend ancient Ayurvedic wisdom with modern intelligence to optimize your circadian rhythm.
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {['Solar Rhythms', 'Ayurveda', 'Vedic Science', 'Circadian'].map(tag => (
                    <View key={tag} style={S.tagPill}>
                      <Text style={S.tagTxt}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </DashboardModule>
          </View>
        </Animated.ScrollView>
      </View>
    </SettingsErrorBoundary>
  );
}

const S = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: '#000000' },
  tagPill: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.15)' },
  tagTxt:  { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.7)', letterSpacing: 0.5, textTransform: 'uppercase' },
});
