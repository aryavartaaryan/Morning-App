import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, NativeModules, Platform, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { store, KEYS } from '@/lib/storage';
import { AlarmSettings, DEFAULT_ALARM_SETTINGS, requestNotificationPermission } from '@/lib/notifications';
import { DEFAULT_MISSION_SETTINGS, MissionSettings, MISSIONS } from '@/lib/missionAlarm';
import { checkAlarmPermission, setNativeAlarmSound, requestAllAlarmPermissions } from '@/lib/nativeAlarm';
import { Colors, Font } from '@/constants/theme';

const PURPLE = '#a78bfa';

const MANTRAS = [
  { id: 'gayatri',    label: 'Gayatri Mantra',      emoji: '🌞', color: '#fbbf24', hint: 'ॐ भूर्भुवः स्वः' },
  { id: 'lalitha',    label: 'Lalitha Sahasranama', emoji: '🌺', color: '#f472b6', hint: 'ॐ ऐं ह्रीं श्रीं' },
  { id: 'shivtandav', label: 'Shiv Tandav',         emoji: '🔱', color: '#a78bfa', hint: 'ॐ नमः शिवाय' },
];

interface PermState { notifications: boolean; exactAlarm: boolean; batteryOpt: boolean; fullScreen: boolean; }

export default function SettingsTab() {
  const [settings, setSettings]           = useState<AlarmSettings>(DEFAULT_ALARM_SETTINGS);
  const [mission, setMission]             = useState<MissionSettings>(DEFAULT_MISSION_SETTINGS);
  const [permStatus, setPermStatus]       = useState<PermState>({ notifications: true, exactAlarm: true, batteryOpt: true, fullScreen: true });
  const [checkingPerms, setCheckingPerms] = useState(false);

  useEffect(() => {
    (async () => {
      const s  = await store.getJSON<AlarmSettings>(KEYS.alarmSettings);
      const ms = await store.getJSON<MissionSettings>(KEYS.missionSettings);
      if (s)  setSettings(s);
      if (ms) setMission({ ...DEFAULT_MISSION_SETTINGS, ...ms });
      if (Platform.OS === 'android') checkPerms();
    })();
  }, []);

  const checkPerms = async () => {
    try {
      const [ea, bo, fs] = await Promise.all([
        checkAlarmPermission(),
        NativeModules.AlarmModule?.isBatteryOptimizationIgnored?.().catch(() => true) ?? Promise.resolve(true),
        NativeModules.AlarmModule?.checkFullScreenIntentPermission?.().catch(() => true) ?? Promise.resolve(true),
      ]);
      const { status } = await (require('expo-notifications') as typeof import('expo-notifications')).getPermissionsAsync();
      setPermStatus({ notifications: status === 'granted', exactAlarm: !!ea, batteryOpt: !!bo, fullScreen: !!fs });
    } catch {}
  };

  const saveSettings = async (updated: AlarmSettings) => {
    setSettings(updated); await store.setJSON(KEYS.alarmSettings, updated);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  const saveMission = async (updated: MissionSettings) => {
    setMission(updated); await store.setJSON(KEYS.missionSettings, updated);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleMantraSelect = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    saveSettings({ ...settings, selectedMantraId: id });
    setNativeAlarmSound(id).catch(() => {});
  };

  const handleFixPerms = async () => {
    setCheckingPerms(true);
    await requestAllAlarmPermissions();
    await checkPerms();
    setCheckingPerms(false);
  };

  const CAMERA_MISSIONS = new Set(['sky_check', 'make_bed', 'hydrate']);

  const handleSelectMission = async (ms: typeof MISSIONS[0]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (CAMERA_MISSIONS.has(ms.id)) {
      const { status, canAskAgain } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        if (!canAskAgain) {
          Alert.alert(
            'Camera Permission Required',
            'This mission uses the camera. Please enable Camera permission for SolRize in your device Settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ],
          );
        } else {
          Alert.alert(
            'Camera Permission Required',
            'This mission requires camera access. Please allow it when prompted to select this mission.',
          );
        }
        return;
      }
    }
    saveMission({ ...mission, selectedMission: ms.id });
  };

  const handleResetStreak = () => {
    Alert.alert('Reset Streak?', 'This will reset your streak counter to 0. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: async () => { await saveMission({ ...mission, streak: 0, missionsCompleted: 0 }); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } },
    ]);
  };

  const handleResetAll = () => {
    Alert.alert('Reset All Data?', 'This will clear all alarms, settings, and streak data. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset Everything', style: 'destructive', onPress: async () => {
        await store.setJSON(KEYS.alarmSettings, DEFAULT_ALARM_SETTINGS);
        await store.setJSON(KEYS.missionSettings, DEFAULT_MISSION_SETTINGS);
        await store.setJSON(KEYS.multiAlarms, []);
        setSettings(DEFAULT_ALARM_SETTINGS); setMission(DEFAULT_MISSION_SETTINGS);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert('Done', 'All data has been reset.');
      }},
    ]);
  };

  const allPermsOk  = permStatus.notifications && permStatus.exactAlarm && permStatus.batteryOpt && permStatus.fullScreen;
  const selectedMn  = settings.selectedMantraId ?? 'gayatri';

  const TOGGLES = [
    { emoji: '🔒', label: 'Lock In Mode',    sub: "Alarm won't stop until mission is completed",   val: mission.lockInMode,        onToggle: () => saveMission({ ...mission, lockInMode: !mission.lockInMode }),                       color: '#ef4444' },
    { emoji: '🤖', label: 'Morning Brief',   sub: 'AI speaks your personalized morning brief',     val: mission.bodhiMorningBrief, onToggle: () => saveMission({ ...mission, bodhiMorningBrief: !mission.bodhiMorningBrief }),          color: PURPLE },
    { emoji: '⏰', label: 'Dawn Alert',       sub: '15-min reminder before your wake alarm',        val: settings.brahmaReminder,   onToggle: () => saveSettings({ ...settings, brahmaReminder: !settings.brahmaReminder }),             color: '#c084fc' },
    { emoji: '📅', label: 'Daily Check-in',  sub: 'Evening prompt to log your day',                val: settings.checkinReminder,  onToggle: () => saveSettings({ ...settings, checkinReminder: !settings.checkinReminder }),          color: '#34d399' },
    { emoji: '📈', label: 'Gradual Volume',  sub: 'Alarm fades in over 60 seconds (Android)',      val: mission.gradualVolume ?? false, onToggle: () => saveMission({ ...mission, gradualVolume: !(mission.gradualVolume ?? false) }), color: '#60a5fa' },
  ] as const;

  return (
    <View style={S.screen}>
      <LinearGradient colors={['#130A2E', '#0A0620', '#060610']} style={S.headerGrad}>
        <SafeAreaView edges={['top']}>
          <View style={S.headerTop}>
            <Text style={S.appName}>⚙️  Settings</Text>
            <Text style={{ fontSize: 11, color: PURPLE + '80', fontWeight: '700' }}>Morning App</Text>
          </View>
          <View style={{ paddingHorizontal: 20, paddingBottom: 14 }}>
            <Text style={S.headline}>Preferences</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

        {/* Permissions health */}
        {Platform.OS === 'android' && (
          <>
            <Text style={S.sectionLabel}>ALARM PERMISSIONS</Text>
            <View style={S.permCard}>
              {[
                { label: 'Notifications',          ok: permStatus.notifications },
                { label: 'Schedule Exact Alarms',  ok: permStatus.exactAlarm },
                { label: 'Battery Optimization',   ok: permStatus.batteryOpt },
                { label: 'Full-Screen Intent',     ok: permStatus.fullScreen },
              ].map((p, i) => (
                <View key={p.label} style={[S.permRow, i > 0 && { borderTopWidth: 1, borderTopColor: '#FFFFFF08' }]}>
                  <View style={[S.permDot, { backgroundColor: p.ok ? '#10b981' : '#ef4444' }]} />
                  <Text style={{ flex: 1, fontSize: 13, color: p.ok ? '#FFFFFF80' : '#fff', fontWeight: p.ok ? '500' : '700' }}>{p.label}</Text>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: p.ok ? '#10b981' : '#ef4444' }}>{p.ok ? 'OK' : 'MISSING'}</Text>
                </View>
              ))}
              {!allPermsOk && (
                <TouchableOpacity onPress={handleFixPerms} disabled={checkingPerms} style={S.fixBtn} activeOpacity={0.8}>
                  <Text style={{ color: '#ef4444', fontWeight: '900', fontSize: 13 }}>{checkingPerms ? 'Checking...' : '⚡ Fix Permissions'}</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}

        {/* Alarm sound */}
        <Text style={S.sectionLabel}>ALARM SOUND</Text>
        <View style={S.soundCard}>
          {MANTRAS.map((mn, i) => {
            const active = selectedMn === mn.id;
            return (
              <TouchableOpacity key={mn.id} onPress={() => handleMantraSelect(mn.id)} style={[S.soundRow, i > 0 && { borderTopWidth: 1, borderTopColor: '#FFFFFF08' }]} activeOpacity={0.75}>
                <View style={[S.soundIcon, { backgroundColor: mn.color + '18' }]}>
                  <Text style={{ fontSize: 20 }}>{mn.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[S.soundLabel, { color: active ? mn.color : '#fff' }]}>{mn.label}</Text>
                  <Text style={{ fontSize: 10, color: mn.color + '60', fontWeight: '600' }}>{mn.hint}</Text>
                </View>
                {active && <View style={[S.checkBadge, { backgroundColor: mn.color + '20', borderColor: mn.color + '50' }]}><Text style={{ fontSize: 10, color: mn.color, fontWeight: '900' }}>✓ Active</Text></View>}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Mission selection */}
        <Text style={S.sectionLabel}>DEFAULT MISSION</Text>
        <View style={S.soundCard}>
          {MISSIONS.map((ms, i) => {
            const active = mission.selectedMission === ms.id;
            return (
              <TouchableOpacity key={ms.id} onPress={() => handleSelectMission(ms)} style={[S.soundRow, i > 0 && { borderTopWidth: 1, borderTopColor: '#FFFFFF08' }]} activeOpacity={0.75}>
                <Text style={{ fontSize: 22 }}>{ms.icon}</Text>
                <View style={{ flex: 1, paddingLeft: 10 }}>
                  <Text style={[S.soundLabel, { color: active ? ms.color : '#fff' }]}>{ms.name}</Text>
                  <Text style={{ fontSize: 10, color: '#FFFFFF35' }}>{ms.tagline}</Text>
                </View>
                {active && <View style={[S.checkBadge, { backgroundColor: ms.color + '20', borderColor: ms.color + '50' }]}><Text style={{ fontSize: 10, color: ms.color, fontWeight: '900' }}>✓</Text></View>}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Toggles */}
        <Text style={S.sectionLabel}>BEHAVIOUR</Text>
        <View style={S.togglesCard}>
          {TOGGLES.map((row, i) => (
            <View key={row.label} style={[S.toggleRow, i > 0 && { borderTopWidth: 1, borderTopColor: '#FFFFFF08' }]}>
              <Text style={{ fontSize: 18 }}>{row.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={S.toggleTitle}>{row.label}</Text>
                <Text style={S.toggleSub}>{row.sub}</Text>
              </View>
              <Switch value={row.val} onValueChange={row.onToggle} trackColor={{ false: '#222', true: row.color + '80' }} thumbColor={row.val ? row.color : '#666'} />
            </View>
          ))}
        </View>

        {/* About */}
        <Text style={S.sectionLabel}>ABOUT</Text>
        <View style={S.aboutCard}>
          <Text style={{ fontSize: 11, color: '#FFFFFF50', lineHeight: 18 }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Morning App</Text>
            {'  ·  '}Version 1.0{'\n'}
            Smart alarm system with morning missions, habit alarms, weather, and sleep cycle guidance.{'\n\n'}
            Built on open-source alarm technology using Android AlarmManager, Notifee, and Open-Meteo weather API (free, no key required).
          </Text>
        </View>

        {/* Danger zone */}
        <Text style={[S.sectionLabel, { color: '#ef444430' }]}>DANGER ZONE</Text>
        <View style={S.dangerCard}>
          <TouchableOpacity onPress={handleResetStreak} style={[S.dangerBtn, { borderColor: '#f9731640' }]} activeOpacity={0.8}>
            <Text style={{ fontSize: 16 }}>🔄</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#f97316' }}>Reset Streak</Text>
              <Text style={{ fontSize: 10, color: '#FFFFFF35' }}>Clear streak counter only</Text>
            </View>
          </TouchableOpacity>
          <View style={{ height: 1, backgroundColor: '#FFFFFF08' }} />
          <TouchableOpacity onPress={handleResetAll} style={[S.dangerBtn, { borderColor: 'transparent' }]} activeOpacity={0.8}>
            <Text style={{ fontSize: 16 }}>🗑️</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#ef4444' }}>Reset All Data</Text>
              <Text style={{ fontSize: 10, color: '#FFFFFF35' }}>Clear all alarms, settings, and streak</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#060610' },
  headerGrad: { paddingBottom: 0 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 6, paddingBottom: 4 },
  appName: { fontSize: 15, fontWeight: '900', color: '#fff', letterSpacing: 0.5, fontFamily: 'Nunito_900Black' },
  headline: { fontSize: 20, fontWeight: '200', color: '#fff', letterSpacing: -0.4 },
  sectionLabel: { fontSize: 8, fontWeight: '900', color: '#FFFFFF28', letterSpacing: 1.6, marginHorizontal: 16, marginTop: 20, marginBottom: 8, fontFamily: 'Nunito_900Black' },
  permCard: { marginHorizontal: 16, borderRadius: 18, borderWidth: 1, borderColor: '#FFFFFF0A', backgroundColor: '#FFFFFF04', overflow: 'hidden' },
  permRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  permDot: { width: 8, height: 8, borderRadius: 4 },
  fixBtn: { margin: 12, backgroundColor: '#ef444410', borderWidth: 1, borderColor: '#ef444430', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  soundCard: { marginHorizontal: 16, borderRadius: 18, borderWidth: 1, borderColor: '#FFFFFF0A', backgroundColor: '#FFFFFF04', overflow: 'hidden' },
  soundRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  soundIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  soundLabel: { fontSize: 13, fontWeight: '800', fontFamily: 'Nunito_800ExtraBold' },
  checkBadge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  togglesCard: { marginHorizontal: 16, borderRadius: 18, borderWidth: 1, borderColor: '#FFFFFF0A', backgroundColor: '#FFFFFF04', overflow: 'hidden' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
  toggleTitle: { fontSize: 13, fontWeight: '800', color: '#fff', fontFamily: 'Nunito_800ExtraBold' },
  toggleSub: { fontSize: 10, color: '#FFFFFF40', marginTop: 2 },
  aboutCard: { marginHorizontal: 16, borderRadius: 16, borderWidth: 1, borderColor: '#FFFFFF08', backgroundColor: '#FFFFFF03', padding: 16 },
  dangerCard: { marginHorizontal: 16, borderRadius: 18, borderWidth: 1, borderColor: '#ef444420', backgroundColor: '#ef444405', overflow: 'hidden' },
  dangerBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
});
