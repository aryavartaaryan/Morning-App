import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch,
  Alert, Modal, Platform, Linking, ImageBackground, Dimensions,
  Animated, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { store, KEYS } from '@/lib/storage';
import { AlarmSettings, DEFAULT_ALARM_SETTINGS } from '@/lib/notifications';
import { DEFAULT_MISSION_SETTINGS, MissionSettings } from '@/lib/missionAlarm';
import { checkAlarmPermission, requestAllAlarmPermissions } from '@/lib/nativeAlarm';
import {
  useBgContext,
  BG_KEYS, BG_META, BG_ACCENT_COLORS, BG_GRADIENT_START,
  type WallpaperMode, type BgKey,
} from '@/lib/bgContext';

const PURPLE = '#a78bfa';
const GOLD   = '#fbbf24';
const GREEN  = '#34d399';
const { width, height } = Dimensions.get('window');

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
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(5,10,30,0.70)',
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

// ─── Wallpaper Picker ─────────────────────────────────────────────────────────
function WallpaperPicker() {
  const {
    wallpaperMode, manualBgKey, setWallpaperMode, setManualBgKey,
    bgKey, allBgUris,
  } = useBgContext();

  const [showPicker, setShowPicker] = useState(false);
  const sheetY = useRef(new Animated.Value(height)).current;

  const openPicker = () => {
    setShowPicker(true);
    Animated.spring(sheetY, { toValue: 0, useNativeDriver: true, speed: 16, bounciness: 4 }).start();
  };
  const closePicker = () => {
    Animated.spring(sheetY, { toValue: height, useNativeDriver: true, speed: 18, bounciness: 0 })
      .start(() => setShowPicker(false));
  };

  const activeBgKey = wallpaperMode === 'manual' ? manualBgKey : bgKey;
  const activeMeta  = BG_META[activeBgKey as BgKey] ?? BG_META.morning;

  return (
    <>
      {/* ── Mode Switcher ── */}
      <GlassCard>
        {/* Solar Mode */}
        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setWallpaperMode('solar'); }}
          activeOpacity={0.85}
          style={[wp.modeRow, { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' }]}
        >
          <View style={[wp.modeIcon, wallpaperMode === 'solar' && { backgroundColor: GOLD + '25', borderColor: GOLD + '50' }]}>
            <Text style={{ fontSize: 20 }}>☀️</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={wp.modeTitle}>Solar Time Mode</Text>
            <Text style={wp.modeSub}>Background shifts automatically with sun — Brahma Muhurta to night sky</Text>
          </View>
          <View style={[wp.radio, wallpaperMode === 'solar' && { borderColor: GOLD, backgroundColor: GOLD + '30' }]}>
            {wallpaperMode === 'solar' && <View style={[wp.radioDot, { backgroundColor: GOLD }]} />}
          </View>
        </TouchableOpacity>

        {/* Manual Mode */}
        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setWallpaperMode('manual'); }}
          activeOpacity={0.85}
          style={wp.modeRow}
        >
          <View style={[wp.modeIcon, wallpaperMode === 'manual' && { backgroundColor: PURPLE + '25', borderColor: PURPLE + '50' }]}>
            <Text style={{ fontSize: 20 }}>🖼️</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={wp.modeTitle}>Fixed Wallpaper Mode</Text>
            <Text style={wp.modeSub}>Pin a specific background for all pages — same vibe all day</Text>
          </View>
          <View style={[wp.radio, wallpaperMode === 'manual' && { borderColor: PURPLE, backgroundColor: PURPLE + '30' }]}>
            {wallpaperMode === 'manual' && <View style={[wp.radioDot, { backgroundColor: PURPLE }]} />}
          </View>
        </TouchableOpacity>
      </GlassCard>

      {/* ── Current Wallpaper Preview ── */}
      <TouchableOpacity
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); openPicker(); }}
        activeOpacity={0.88}
        style={[glass.card, { marginHorizontal: 16, marginTop: 10, overflow: 'hidden' }]}
      >
        <ImageBackground
          source={allBgUris[activeBgKey as BgKey] ? { uri: allBgUris[activeBgKey as BgKey] } : undefined}
          style={wp.previewImg}
          imageStyle={{ borderRadius: 20 }}
        >
          <LinearGradient
            colors={['rgba(0,0,0,0.08)', 'rgba(0,0,0,0.65)']}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={wp.previewContent}>
            <View>
              <Text style={wp.previewTime}>{activeMeta.time}</Text>
              <Text style={wp.previewName}>{activeMeta.emoji}  {activeMeta.label}</Text>
              <Text style={wp.previewSub}>{activeMeta.sub}</Text>
            </View>
            <View style={wp.previewBtn}>
              <Ionicons name="images-outline" size={16} color="#fff" />
              <Text style={wp.previewBtnTxt}>
                {wallpaperMode === 'manual' ? 'Change Wallpaper' : 'View All Scenes'}
              </Text>
            </View>
          </View>
        </ImageBackground>
      </TouchableOpacity>

      {/* ── Wallpaper Picker Sheet ── */}
      <Modal visible={showPicker} transparent animationType="none" onRequestClose={closePicker}>
        <View style={wp.sheetBg}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={closePicker} activeOpacity={1} />
          <Animated.View style={[wp.sheet, { transform: [{ translateY: sheetY }] }]}>
            <View style={wp.handle} />
            <View style={wp.sheetHeader}>
              <View>
                <Text style={wp.sheetTitle}>
                  {wallpaperMode === 'manual' ? '🖼️  Choose Your Wallpaper' : '☀️  Solar Scenes'}
                </Text>
                <Text style={wp.sheetSub}>
                  {wallpaperMode === 'manual'
                    ? 'Select a fixed background for all pages'
                    : 'These images shift automatically with solar time'}
                </Text>
              </View>
              <TouchableOpacity onPress={closePicker} style={wp.closeBtn}>
                <Text style={{ color: '#FFFFFF55', fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48, gap: 10 }}
            >
              {BG_KEYS.map((key) => {
                const meta   = BG_META[key];
                const uri    = allBgUris[key];
                const active = wallpaperMode === 'manual' ? manualBgKey === key : bgKey === key;
                const accent = BG_ACCENT_COLORS[key] ?? '#111';

                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      if (wallpaperMode === 'manual') {
                        setManualBgKey(key as BgKey);
                      }
                    }}
                    activeOpacity={0.88}
                    style={[
                      wp.bgCard,
                      { borderColor: active ? '#fff' : 'rgba(255,255,255,0.10)', borderWidth: active ? 2 : 1 },
                    ]}
                  >
                    <ImageBackground
                      source={uri ? { uri } : undefined}
                      style={wp.bgCardImg}
                      imageStyle={{ borderRadius: 16 }}
                    >
                      <LinearGradient
                        colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.70)']}
                        style={StyleSheet.absoluteFillObject}
                      />
                      {active && (
                        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16 }]} />
                      )}
                      <View style={wp.bgCardContent}>
                        <View>
                          <Text style={wp.bgCardTime}>{meta.time}</Text>
                          <Text style={wp.bgCardLabel}>{meta.emoji}  {meta.label}</Text>
                          <Text style={wp.bgCardSub}>{meta.sub}</Text>
                        </View>
                        {active && (
                          <View style={wp.activePill}>
                            <Text style={wp.activePillTxt}>
                              {wallpaperMode === 'manual' ? '✓  PINNED' : '◉  NOW SHOWING'}
                            </Text>
                          </View>
                        )}
                      </View>
                    </ImageBackground>
                  </TouchableOpacity>
                );
              })}

              {wallpaperMode === 'manual' && (
                <View style={wp.solarNote}>
                  <Text style={{ fontSize: 13, marginBottom: 6 }}>💡</Text>
                  <Text style={wp.solarNoteTxt}>
                    Select a wallpaper to use it across all pages
                  </Text>
                </View>
              )}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </>
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
      const [ea, bo, fs] = await Promise.all([
        checkAlarmPermission(),
        (require('react-native').NativeModules.AlarmModule?.isBatteryOptimizationIgnored?.().catch(() => true)) ?? Promise.resolve(true),
        (require('react-native').NativeModules.AlarmModule?.checkFullScreenIntentPermission?.().catch(() => true)) ?? Promise.resolve(true),
      ]);
      const { status } = await (require('expo-notifications') as typeof import('expo-notifications')).getPermissionsAsync();
      setPerms({ notifications: status === 'granted', exactAlarm: !!ea, batteryOpt: !!bo, fullScreen: !!fs });
    } catch {}
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
  const [settings,  setSettings]  = useState<AlarmSettings>(DEFAULT_ALARM_SETTINGS);
  const [mission,   setMission]   = useState<MissionSettings>(DEFAULT_MISSION_SETTINGS);
  const { bgUri, bgKey, accentColor } = useBgContext();


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
  };
  const saveMission = async (updated: MissionSettings) => {
    setMission(updated); await store.setJSON(KEYS.missionSettings, updated);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };


  const handleResetStreak = () => {
    Alert.alert('Reset Streak?', 'This will reset your streak counter to 0. Cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: async () => {
        await saveMission({ ...mission, streak: 0, missionsCompleted: 0 });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }},
    ]);
  };

  const handleResetAll = () => {
    Alert.alert('Reset All Data?', 'This will clear all alarms, settings, and streak data. Cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset Everything', style: 'destructive', onPress: async () => {
        await store.setJSON(KEYS.alarmSettings, DEFAULT_ALARM_SETTINGS);
        await store.setJSON(KEYS.missionSettings, DEFAULT_MISSION_SETTINGS);
        await store.setJSON(KEYS.multiAlarms, []);
        setSettings(DEFAULT_ALARM_SETTINGS);
        setMission(DEFAULT_MISSION_SETTINGS);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert('Done', 'All data has been reset.');
      }},
    ]);
  };


  const TOGGLES = [
    { emoji: '🔒', label: 'Lock In Mode',   sub: "Alarm won't stop until mission is completed", val: mission.lockInMode,            onToggle: () => saveMission({ ...mission, lockInMode: !mission.lockInMode }),                         color: '#ef4444' },
    { emoji: '🤖', label: 'Morning Brief',  sub: 'AI speaks your personalized morning brief',   val: mission.bodhiMorningBrief,    onToggle: () => saveMission({ ...mission, bodhiMorningBrief: !mission.bodhiMorningBrief }),            color: PURPLE },
    { emoji: '⏰', label: 'Dawn Alert',      sub: '15-min reminder before your wake alarm',      val: settings.brahmaReminder,      onToggle: () => saveSettings({ ...settings, brahmaReminder: !settings.brahmaReminder }),               color: '#c084fc' },
    { emoji: '📅', label: 'Daily Check-in', sub: 'Evening prompt to log your day',               val: settings.checkinReminder,     onToggle: () => saveSettings({ ...settings, checkinReminder: !settings.checkinReminder }),            color: GREEN },
    { emoji: '📈', label: 'Gradual Volume', sub: 'Alarm fades in over 60 seconds (Android)',     val: mission.gradualVolume ?? false, onToggle: () => saveMission({ ...mission, gradualVolume: !(mission.gradualVolume ?? false) }),       color: '#60a5fa' },
  ] as const;

  return (
    <ImageBackground
      source={bgUri ? { uri: bgUri } : undefined}
      style={S.screen}
      imageStyle={{ opacity: 1 }}
    >
      {/* Glassmorphism overlays — iOS-style dark theme for settings */}
      <LinearGradient
        colors={['rgba(0,0,0,0.68)', 'rgba(0,0,0,0.52)', 'rgba(0,0,0,0.35)']}
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
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120, paddingTop: 4 }}
        showsVerticalScrollIndicator={false}
      >

        {/* ── 1. Background & Wallpaper ── */}
        <SectionHeader emoji="🌅" label="BACKGROUND THEME" color="#fbbf24" />
        <WallpaperPicker />


        {/* ── 3. Behaviour Toggles ── */}
        <SectionHeader emoji="⚡" label="ALARM BEHAVIOUR" color="#FFFFFF50" />
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
            <SectionHeader emoji="🔐" label="ALARM PERMISSIONS" color="#ef444468" />
            <PermissionsSection onRefresh={() => {}} />
          </>
        )}

        {/* ── 5. About ── */}
        <SectionHeader emoji="ℹ️" label="ABOUT" color="#FFFFFF30" />
        <GlassCard>
          <View style={{ padding: 16, gap: 8 }}>
            <Text style={{ fontSize: 14, fontWeight: '900', color: '#fff', fontFamily: 'Nunito_900Black' }}>
              🌅  Morning App
            </Text>
            <Text style={{ fontSize: 11, color: '#FFFFFF50', lineHeight: 18 }}>
              Version 1.0  ·  Built with Ayurvedic wisdom{'\n'}
              Smart solar alarms · Habit missions · Nāda sleep sounds · Step tracker · AI wellness guidance.
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

        {/* ── 6. Danger Zone ── */}
        <SectionHeader emoji="⚠️" label="DANGER ZONE" color="#ef444440" />
        <GlassCard style={{ borderColor: 'rgba(239,68,68,0.20)' }}>
          <TouchableOpacity onPress={handleResetStreak} activeOpacity={0.8} style={S.dangerBtn}>
            <View style={[S.dangerIcon, { backgroundColor: '#f9731618' }]}>
              <Text style={{ fontSize: 18 }}>🔄</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#f97316' }}>Reset Streak</Text>
              <Text style={{ fontSize: 10, color: '#FFFFFF35', marginTop: 1 }}>Clear streak counter only</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#f9731650" />
          </TouchableOpacity>
          <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.07)' }} />
          <TouchableOpacity onPress={handleResetAll} activeOpacity={0.8} style={S.dangerBtn}>
            <View style={[S.dangerIcon, { backgroundColor: '#ef444418' }]}>
              <Text style={{ fontSize: 18 }}>🗑️</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#ef4444' }}>Reset All Data</Text>
              <Text style={{ fontSize: 10, color: '#FFFFFF35', marginTop: 1 }}>Clear all alarms, settings & streak</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#ef444450" />
          </TouchableOpacity>
        </GlassCard>

      </ScrollView>

    </ImageBackground>
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

  dangerBtn:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
  dangerIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
});
