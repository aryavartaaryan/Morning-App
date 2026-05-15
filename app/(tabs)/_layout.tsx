import { Tabs, useRouter, usePathname } from 'expo-router';
import { Text, View, TouchableOpacity, StyleSheet, Platform, Animated, Modal, ImageBackground, StatusBar, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSoundPlayer, MAX_MIX } from '@/lib/soundPlayerContext';
import { ALL_SLEEP_SOUNDS } from '@/lib/sleepSoundsData';
import { useRef, useEffect, useState } from 'react';

const pad2 = (n: number) => String(n).padStart(2, '0');
const fmtTimer = (s: number) => `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;

const TIMER_OPTIONS = [
  { label: '21 min', secs: 21 * 60 },
  { label: '30 min', secs: 30 * 60 },
  { label: '45 min', secs: 45 * 60 },
  { label: '1 hr',   secs: 60 * 60 },
  { label: '2 hr',   secs: 120 * 60 },
];

function FullScreenPlayer() {
  const {
    playingMeta, mixedSounds, isPaused, sessionSecs,
    togglePause, stopSound, changeTimer, addToMix, removeFromMix,
    showFullPlayer, closeFullPlayer,
  } = useSoundPlayer();

  const [showMixPicker, setShowMixPicker] = useState(false);
  const [showTimerPicker, setShowTimerPicker] = useState(false);
  const [mixCat, setMixCat] = useState<string>('All');

  if (!playingMeta || !showFullPlayer) return null;

  const totalSecs = TIMER_OPTIONS.find(t => t.secs >= sessionSecs)?.secs ?? TIMER_OPTIONS[3].secs;
  const progress  = Math.max(0, Math.min(1, sessionSecs / totalSecs));
  const bgImage   = playingMeta.imageUri;
  const bgSource  = playingMeta.imageBundled ?? (bgImage ? { uri: bgImage } : undefined);

  const cats = ['All', 'Rain', 'Ocean', 'Nature', 'Sacred', 'Ambient'];
  const palette = mixCat === 'All' ? ALL_SLEEP_SOUNDS : ALL_SLEEP_SOUNDS.filter(s => s.cat === mixCat);
  const mixIds  = new Set(mixedSounds.map(s => s.id));

  return (
    <Modal visible={showFullPlayer} transparent={false} animationType="fade" statusBarTranslucent onRequestClose={closeFullPlayer}>
      <ImageBackground
        source={bgSource}
        style={FP.screen}
        imageStyle={FP.bgImage}
        resizeMode="cover"
      >
        {/* Very subtle vignette — keeps image dominant */}
        <LinearGradient
          colors={['rgba(0,0,0,0.18)', 'transparent', 'rgba(0,0,0,0.55)']}
          style={StyleSheet.absoluteFillObject}
        />
        <StatusBar hidden />

        {/* ── TOP: back chevron + sound name ── */}
        <View style={FP.topRow}>
          <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); closeFullPlayer(); }} style={FP.chevronBtn}>
            <Ionicons name="chevron-down" size={22} color="rgba(255,255,255,0.80)" />
          </TouchableOpacity>
          <Text style={FP.soundName} numberOfLines={1}>
            {mixedSounds.length > 1
              ? mixedSounds.map(s => s.emoji).join('  ')
              : playingMeta.label}
          </Text>
          <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); stopSound(true); }} style={FP.chevronBtn}>
            <Ionicons name="stop-circle-outline" size={22} color="rgba(255,255,255,0.55)" />
          </TouchableOpacity>
        </View>

        {/* ── CENTER: + add button ── */}
        <View style={FP.centerArea}>
          {mixedSounds.length > 1 && (
            <View style={FP.mixChips}>
              {mixedSounds.map(s => (
                <TouchableOpacity key={s.id} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); removeFromMix(s.id); }} style={[FP.mixChip, { borderColor: s.color + '80', backgroundColor: s.color + '20' }]}>
                  <Text style={{ fontSize: 14 }}>{s.emoji}</Text>
                  <Text style={[FP.mixChipLabel, { color: s.color }]}>{s.label}</Text>
                  <Ionicons name="close" size={11} color={s.color + 'CC'} />
                </TouchableOpacity>
              ))}
            </View>
          )}
          {mixedSounds.length < MAX_MIX && (
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowMixPicker(true); }}
              style={FP.addBtn}
              activeOpacity={0.80}
            >
              <Ionicons name="add" size={32} color="rgba(255,255,255,0.90)" />
            </TouchableOpacity>
          )}
        </View>

        {/* ── BOTTOM: controls + progress ── */}
        <View style={FP.bottomArea}>
          <View style={FP.controlRow}>
            {/* Pause / Play */}
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); togglePause(); }}
              style={FP.circleBtn}
              activeOpacity={0.80}
            >
              <Ionicons name={isPaused ? 'play' : 'pause'} size={26} color="rgba(255,255,255,0.92)" />
            </TouchableOpacity>

            {/* Timer */}
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowTimerPicker(true); }}
              style={FP.circleBtn}
              activeOpacity={0.80}
            >
              <Ionicons name="timer-outline" size={26} color="rgba(255,255,255,0.92)" />
            </TouchableOpacity>
          </View>

          {/* Thin progress bar */}
          <View style={FP.progressTrack}>
            <View style={[FP.progressFill, { width: `${progress * 100}%` as any }]} />
            <View style={[FP.progressDot, { left: `${progress * 100}%` as any }]} />
          </View>
          <Text style={FP.timeLeftTxt}>{fmtTimer(sessionSecs)}</Text>
        </View>
      </ImageBackground>

      {/* ── Mix Picker Sheet ── */}
      <Modal visible={showMixPicker} transparent animationType="slide" onRequestClose={() => setShowMixPicker(false)}>
        <View style={FP.sheetBackdrop}>
          <View style={FP.sheet}>
            <View style={FP.sheetHandle} />
            <Text style={FP.sheetTitle}>Add to Mix  <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>{mixedSounds.length}/{MAX_MIX}</Text></Text>
            {/* Category tabs */}
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {cats.map(c => (
                <TouchableOpacity key={c} onPress={() => setMixCat(c)} style={[FP.catTab, mixCat === c && FP.catTabActive]}>
                  <Text style={[FP.catTabTxt, mixCat === c && { color: '#fff' }]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {/* Sound list */}
            <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 8 }}>
                {palette.map(s => {
                  const inMix = mixIds.has(s.id);
                  return (
                    <TouchableOpacity
                      key={s.id}
                      onPress={() => {
                        if (inMix) { removeFromMix(s.id); }
                        else if (mixedSounds.length < MAX_MIX) { addToMix(s); }
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      style={[FP.soundPill, { borderColor: inMix ? s.color + 'AA' : 'rgba(255,255,255,0.12)', backgroundColor: inMix ? s.color + '22' : 'rgba(255,255,255,0.05)' }]}
                    >
                      <Text style={{ fontSize: 16 }}>{s.emoji}</Text>
                      <Text style={[FP.soundPillLabel, { color: inMix ? s.color : 'rgba(255,255,255,0.65)' }]}>{s.label}</Text>
                      {inMix && <Ionicons name="checkmark" size={12} color={s.color} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
            <TouchableOpacity onPress={() => setShowMixPicker(false)} style={FP.sheetDoneBtn}>
              <Text style={FP.sheetDoneTxt}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Timer Picker Sheet ── */}
      <Modal visible={showTimerPicker} transparent animationType="slide" onRequestClose={() => setShowTimerPicker(false)}>
        <View style={FP.sheetBackdrop}>
          <View style={FP.sheet}>
            <View style={FP.sheetHandle} />
            <Text style={FP.sheetTitle}>Sleep Timer</Text>
            {TIMER_OPTIONS.map(t => (
              <TouchableOpacity key={t.secs} onPress={() => { changeTimer(t.secs); setShowTimerPicker(false); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }} style={FP.timerRow}>
                <Text style={FP.timerLabel}>{t.label}</Text>
                {sessionSecs <= t.secs && sessionSecs > t.secs - 60 && <Ionicons name="checkmark" size={16} color="#60a5fa" />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const FP = StyleSheet.create({
  screen:         { flex: 1, backgroundColor: '#04040E' },
  bgImage:        { opacity: 1.0 },
  topRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 },
  chevronBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  soundName:      { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.2 },
  centerArea:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 },
  mixChips:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', paddingHorizontal: 24 },
  mixChip:        { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 7 },
  mixChipLabel:   { fontSize: 12, fontWeight: '700' },
  addBtn:         { width: 72, height: 72, borderRadius: 36, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.70)', backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' },
  bottomArea:     { paddingHorizontal: 40, paddingBottom: 52 },
  controlRow:     { flexDirection: 'row', justifyContent: 'center', gap: 28, marginBottom: 36 },
  circleBtn:      { width: 68, height: 68, borderRadius: 34, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.75)', backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' },
  progressTrack:  { width: '100%', height: 2, backgroundColor: 'rgba(255,255,255,0.20)', borderRadius: 1, marginBottom: 10, position: 'relative', overflow: 'visible' },
  progressFill:   { position: 'absolute', left: 0, top: 0, height: '100%', backgroundColor: 'rgba(255,255,255,0.90)', borderRadius: 1 },
  progressDot:    { position: 'absolute', top: -4, width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff', marginLeft: -5 },
  timeLeftTxt:    { textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: '600', letterSpacing: 0.5 },
  sheetBackdrop:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end' },
  sheet:          { backgroundColor: '#0D0D1C', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 44 },
  sheetHandle:    { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', alignSelf: 'center', marginBottom: 18 },
  sheetTitle:     { fontSize: 18, fontWeight: '900', color: '#fff', marginBottom: 16 },
  catTab:         { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 99, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.05)' },
  catTabActive:   { borderColor: 'rgba(255,255,255,0.60)', backgroundColor: 'rgba(255,255,255,0.15)' },
  catTabTxt:      { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.45)' },
  soundPill:      { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 22, paddingHorizontal: 12, paddingVertical: 9 },
  soundPillLabel: { fontSize: 12, fontWeight: '700' },
  timerRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  timerLabel:     { fontSize: 16, fontWeight: '700', color: '#fff' },
  sheetDoneBtn:   { marginTop: 20, backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  sheetDoneTxt:   { fontSize: 14, fontWeight: '900', color: '#fff' },
});

function GlobalPlayerBar() {
  const { playingId, isPaused, sessionSecs, playingMeta, togglePause, stopSound, openFullPlayer } = useSoundPlayer();
  const slideAnim = useRef(new Animated.Value(80)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: playingId ? 0 : 80,
      useNativeDriver: true,
      speed: 22,
      bounciness: 3,
    }).start();
  }, [!!playingId]);

  if (!playingMeta) return null;

  return (
    <Animated.View style={[GP.wrap, { transform: [{ translateY: slideAnim }] }]}>
      <LinearGradient
        colors={[playingMeta.top + 'F0', playingMeta.bot + 'F8']}
        style={GP.grad}
      >
        {/* Tap body → full-screen player */}
        <TouchableOpacity
          style={GP.bodyTap}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); openFullPlayer(); }}
          activeOpacity={0.75}
        >
          <View style={[GP.liveDot, { backgroundColor: isPaused ? '#555' : playingMeta.color }]} />
          <Text style={{ fontSize: 16 }}>{playingMeta.emoji}</Text>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[GP.name, { color: playingMeta.color }]} numberOfLines={1}>
              {playingMeta.label}
            </Text>
            <Text style={GP.sub}>
              {isPaused ? 'Paused' : fmtTimer(sessionSecs) + ' left'}{'  ·  tap to expand'}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); togglePause(); }}
          style={GP.btn}
        >
          <Ionicons name={isPaused ? 'play' : 'pause'} size={17} color={playingMeta.color} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); stopSound(true); }}
          style={[GP.btn, { marginLeft: 6, backgroundColor: '#FFFFFF0A' }]}
        >
          <Ionicons name="stop" size={15} color="#FFFFFF40" />
        </TouchableOpacity>
      </LinearGradient>
    </Animated.View>
  );
}

const GP = StyleSheet.create({
  wrap: {
    marginHorizontal: 14,
    marginBottom: 6,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    elevation: 24,
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
  },
  grad: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, marginRight: 8 },
  name:    { fontSize: 12, fontWeight: '800', letterSpacing: 0.1, fontFamily: 'Nunito_800ExtraBold' },
  sub:     { fontSize: 10, color: '#FFFFFF50', marginTop: 1 },
  btn:     { width: 34, height: 34, borderRadius: 17, backgroundColor: '#FFFFFF14', alignItems: 'center', justifyContent: 'center' },
  bodyTap: { flex: 1, flexDirection: 'row', alignItems: 'center' },
});

const TABS = [
  { name: 'index',    route: '/(tabs)',           iconOn: 'sunny'       as const, icon: 'sunny-outline'       as const, label: 'Daily',    color: '#F5820A' },
  { name: 'alarms',  route: '/(tabs)/alarms',   iconOn: 'alarm'       as const, icon: 'alarm-outline'      as const, label: 'Alarms',   color: '#f97316' },
  { name: 'sleep',   route: '/(tabs)/sleep',    iconOn: 'moon'        as const, icon: 'moon-outline'       as const, label: 'Sleep',    color: '#60a5fa' },
  { name: 'reports', route: '/(tabs)/reports',  iconOn: 'bar-chart'   as const, icon: 'bar-chart-outline'  as const, label: 'Reports',  color: '#10b981' },
  { name: 'settings',route: '/(tabs)/settings', iconOn: 'settings'    as const, icon: 'settings-outline'   as const, label: 'Settings', color: '#a78bfa' },
];

function getSleepTabLabel(h: number): string {
  if (h >= 4  && h < 9)  return 'Morning';
  if (h >= 9  && h < 14) return 'Focus';
  if (h >= 14 && h < 18) return 'Restore';
  if (h >= 18 && h < 22) return 'Wind Down';
  return 'Sleep';
}

function getTimeTabIcon(tabName: string, h: number, focused: boolean): string {
  const isDawn      = h >= 4  && h < 6;
  const isMorning   = h >= 6  && h < 10;
  const isMidday    = h >= 10 && h < 14;
  const isAfternoon = h >= 14 && h < 18;
  const isEvening   = h >= 18 && h < 22;

  if (tabName === 'index') {
    if (focused) {
      if (isMorning || isMidday) return 'sunny';
      if (isAfternoon)           return 'partly-sunny';
      if (isEvening)             return 'cloudy-night';
      if (isDawn)                return 'eye';
      return 'star';
    }
    if (isMorning || isMidday) return 'sunny-outline';
    if (isAfternoon)           return 'partly-sunny-outline';
    if (isEvening)             return 'cloudy-night-outline';
    if (isDawn)                return 'eye-outline';
    return 'star-outline';
  }

  if (tabName === 'alarms') {
    if (focused) {
      if (isDawn || isMorning) return 'alarm';
      if (isMidday)            return 'notifications';
      if (isAfternoon)         return 'notifications';
      if (isEvening)           return 'alarm';
      return 'alarm';
    }
    if (isDawn || isMorning) return 'alarm-outline';
    if (isMidday)            return 'notifications-outline';
    if (isAfternoon)         return 'notifications-outline';
    if (isEvening)           return 'alarm-outline';
    return 'alarm-outline';
  }

  if (tabName === 'sleep') {
    if (focused) {
      if (isDawn || isMorning) return 'leaf';
      if (isMidday)            return 'cafe';
      if (isAfternoon)         return 'body';
      if (isEvening)           return 'cloudy-night';
      return 'moon';
    }
    if (isDawn || isMorning) return 'leaf-outline';
    if (isMidday)            return 'cafe-outline';
    if (isAfternoon)         return 'body-outline';
    if (isEvening)           return 'cloudy-night-outline';
    return 'moon-outline';
  }

  if (tabName === 'reports') {
    if (focused) {
      if (isMorning)   return 'stats-chart';
      if (isMidday)    return 'analytics';
      if (isAfternoon) return 'trending-up';
      if (isEvening)   return 'bar-chart';
      if (isDawn)      return 'pulse';
      return 'bar-chart';
    }
    if (isMorning)   return 'stats-chart-outline';
    if (isMidday)    return 'analytics-outline';
    if (isAfternoon) return 'trending-up-outline';
    if (isEvening)   return 'bar-chart-outline';
    if (isDawn)      return 'pulse-outline';
    return 'bar-chart-outline';
  }

  if (tabName === 'settings') {
    if (focused) {
      if (isDawn || isMorning) return 'options';
      if (isEvening)           return 'moon';
      return 'settings';
    }
    if (isDawn || isMorning) return 'options-outline';
    if (isEvening)           return 'moon-outline';
    return 'settings-outline';
  }

  const map: Record<string, [string, string]> = {
    alarms:   ['alarm',     'alarm-outline'],
    reports:  ['bar-chart', 'bar-chart-outline'],
    settings: ['settings',  'settings-outline'],
  };
  const [on, off] = map[tabName] ?? ['ellipse', 'ellipse-outline'];
  return focused ? on : off;
}

function CustomTabBar() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const path = usePathname();
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'android' ? 10 : 2);
  const [hour, setHour] = useState(new Date().getHours());

  useEffect(() => {
    const t = setInterval(() => setHour(new Date().getHours()), 60_000);
    return () => clearInterval(t);
  }, []);

  return (
    <View style={[styles.wrapper, { paddingBottom: bottomPad }]}>
      <FullScreenPlayer />
      <GlobalPlayerBar />
      <View style={styles.pill}>
        {TABS.map(tab => {
          const focused = path === '/' ? tab.name === 'index' : path.endsWith(tab.name);
          return (
            <TouchableOpacity
              key={tab.name}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.navigate(tab.route as never); }}
              activeOpacity={0.7}
              style={styles.tabItem}
            >
              <View style={[styles.iconWrap, focused && { backgroundColor: '#2D4D2D22' }]}>
                <Ionicons
                  name={getTimeTabIcon(tab.name, hour, focused) as any}
                  size={23}
                  color={focused ? '#2D4D2D' : '#7A9A7A'}
                />
              </View>
              <Text style={[styles.label, { color: focused ? '#2D4D2D' : '#7A9A7A' }]}>
                {tab.name === 'sleep' ? getSleepTabLabel(hour) : tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={() => <CustomTabBar />}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="alarms" />
      <Tabs.Screen name="sleep" />
      <Tabs.Screen name="reports" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#CBD7B8',
    paddingTop: 0,
  },
  pill: {
    flexDirection: 'row',
    backgroundColor: '#CBD7B8',
    borderRadius: 0,
    paddingVertical: 8,
    paddingHorizontal: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -1 },
    elevation: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 2,
  },
  iconWrap: {
    width: 44,
    height: 32,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.1,
    textAlign: 'center',
    lineHeight: 12,
    fontFamily: 'Nunito_700Bold',
  },
});
