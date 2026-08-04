import React, { useCallback, useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Image, BackHandler, ImageBackground
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from "expo-router";
import {
  useBgContext,
  BG_KEYS, BG_META, type BgKey, getTimedBgKey
} from '@/lib/bgContext';
import { getBgSourceSync, getBgSource } from '@/lib/bgImages';
import AppBackground from '@/components/AppBackground';

function AsyncWallpaperImage({ bgKey }: { bgKey: string }) {
  const [imgUri, setImgUri] = React.useState<string | null>(() => getBgSourceSync(bgKey));
  
  React.useEffect(() => {
    let mounted = true;
    getBgSource(bgKey).then(uri => {
      if (mounted) setImgUri(uri);
    }).catch(() => {});
    return () => { mounted = false; };
  }, [bgKey]);

  if (!imgUri || imgUri.length < 5) return <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#06060A' }]} />;
  
  return (
    <Image source={{ uri: imgUri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
  );
}

const PURPLE = '#a78bfa';
const GOLD   = '#fbbf24';

const CATEGORIES = [
  { id: 'all', label: 'All', emoji: '✨' },
  { id: 'morning', label: 'Morning', emoji: '🌅' },
  { id: 'day', label: 'Day', emoji: '☀️' },
  { id: 'sunset', label: 'Sunset', emoji: '🌇' },
  { id: 'night', label: 'Night', emoji: '🌌' },
] as const;

const getCategoryOfKey = (key: string): 'morning' | 'day' | 'sunset' | 'night' => {
  if (['brahma', 'predawn', 'predawn_mid', 'sunrise', 'sunrise_2', 'sunrise_late', 'sunrise_late_2', 'morning_early', 'morning_early_late', 'morning', 'morning_2', 'morning_late', 'morning_late_2'].includes(key)) return 'morning';
  if (['midday_early', 'midday_early_2', 'midday_early_mid', 'midday_early_late', 'midday', 'midday_late', 'midday_late_2', 'afternoon', 'afternoon_first_late', 'afternoon_mid', 'afternoon_late', 'afternoon_late_2'].includes(key)) return 'day';
  if (['sandhya', 'sandhya_mid', 'sandhya_late', 'sandhya_late_part2', 'sandhya_late_mid', 'sandhya_late_mid_2', 'sandhya_late_2', 'sandhya_late_3', 'evening_early', 'evening_early_2', 'evening'].includes(key)) return 'sunset';
  return 'night';
};

export default function WallpaperSettings() {
  const router = useRouter();
  useFocusEffect(useCallback(() => {
    const onBackPress = () => { router.navigate('/(tabs)/settings'); return true; };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [router]));

  const { wallpaperMode, manualBgKey, setWallpaperMode, setManualBgKey, bgKey, allBgUris, solarTimes } = useBgContext();
  const [dynamicTimes, setDynamicTimes] = useState<Partial<Record<BgKey, string>>>({});
  const [activeCategory, setActiveCategory] = useState<'all' | 'morning' | 'day' | 'sunset' | 'night'>('all');
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'info' }>({ visible: false, message: '', type: 'success' });
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

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

  const showToast = (msg: string, type: 'success' | 'info' = 'success') => {
    setToast({ visible: true, message: msg, type });
    setTimeout(() => { if (isMounted.current) setToast(prev => ({ ...prev, visible: false })); }, 2500);
  };

  const activeBgKey = wallpaperMode === 'manual' ? manualBgKey : bgKey;
  const activeMeta  = BG_META[activeBgKey as BgKey] ?? BG_META.morning;
  const rawActiveUri = allBgUris[activeBgKey as BgKey];
  const activeUri   = (rawActiveUri && rawActiveUri.length > 4) ? rawActiveUri : null;

  const filteredKeys = BG_KEYS.filter(key => activeCategory === 'all' || getCategoryOfKey(key) === activeCategory);
  const gridRows: BgKey[][] = [];
  for (let i = 0; i < filteredKeys.length; i += 2) {
    gridRows.push(filteredKeys.slice(i, i + 2) as BgKey[]);
  }

  return (
    <View style={styles.screen}>
      <AppBackground />
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.9)', '#000000']} style={StyleSheet.absoluteFillObject} />

      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.navigate('/(tabs)/settings'); }} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.headerSubtitle}>PREMIUM THEMES</Text>
            <Text style={styles.headerTitle}>Wallpaper</Text>
          </View>
          <View style={{ width: 44 }} />
        </View>

        {toast.visible && (
          <View style={[styles.toastBanner, { borderColor: toast.type === 'success' ? GOLD : PURPLE }]}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff' }}>{toast.message}</Text>
          </View>
        )}
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        
        {/* Cinematic Hero */}
        <View style={styles.heroContainer}>
          <View style={styles.heroCard}>
            <ImageBackground source={activeUri ? { uri: activeUri } : undefined} style={StyleSheet.absoluteFillObject} resizeMode="cover">
              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.9)']} style={StyleSheet.absoluteFillObject} />
              <View style={styles.heroContent}>
                <View style={styles.heroTag}>
                  <Text style={styles.heroTagText}>{wallpaperMode === 'solar' ? 'AUTO-SOLAR MODE' : 'PINNED THEME'}</Text>
                </View>
                <Text style={styles.heroName}>{activeMeta.emoji} {activeMeta.label}</Text>
                <Text style={styles.heroTime}>{dynamicTimes[activeBgKey as BgKey] || activeMeta.time}</Text>
              </View>
            </ImageBackground>
          </View>
        </View>

        {/* Sleek Mode Selector */}
        <BlurView intensity={30} tint="dark" style={styles.segmentedControl}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              if (wallpaperMode !== 'solar') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setWallpaperMode('solar');
                showToast('☀️ Auto-Solar Mode activated', 'success');
              }
            }}
            style={[styles.segmentBtn, wallpaperMode === 'solar' && styles.segmentBtnActiveSolar]}
          >
            <Text style={{ fontSize: 14 }}>☀️</Text>
            <Text style={[styles.segmentText, wallpaperMode === 'solar' && { color: GOLD, fontWeight: '700' }]}>Auto-Solar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              if (wallpaperMode !== 'manual') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setWallpaperMode('manual');
                showToast('📌 Pinned Mode active', 'info');
              }
            }}
            style={[styles.segmentBtn, wallpaperMode === 'manual' && styles.segmentBtnActiveManual]}
          >
            <Text style={{ fontSize: 14 }}>📌</Text>
            <Text style={[styles.segmentText, wallpaperMode === 'manual' && { color: PURPLE, fontWeight: '700' }]}>Pinned</Text>
          </TouchableOpacity>
        </BlurView>

        {/* Dynamic Category Tabs */}
        <View style={{ marginBottom: 24 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
            {CATEGORIES.map(cat => {
              const isSelected = activeCategory === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveCategory(cat.id as any); }}
                  style={[styles.categoryTab, isSelected && styles.categoryTabActive]}
                >
                  <Text style={{ fontSize: 14 }}>{cat.emoji}</Text>
                  <Text style={{ fontSize: 12, fontWeight: isSelected ? '700' : '500', color: isSelected ? '#000' : '#FFFFFF80', letterSpacing: 0.5 }}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Innovative Cards */}
        <View style={styles.gridContainer}>
          {gridRows.map((rowKeys, rowIndex) => (
            <View key={rowIndex} style={styles.gridRow}>
              {rowKeys.map(key => {
                const meta = BG_META[key];
                const active = wallpaperMode === 'manual' ? manualBgKey === key : bgKey === key;

                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      if (wallpaperMode === 'solar') {
                        setWallpaperMode('manual');
                        setManualBgKey(key as BgKey);
                        showToast('📌 Pinned Mode activated', 'success');
                      } else {
                        setManualBgKey(key as BgKey);
                        showToast('📌 Theme pinned', 'success');
                      }
                    }}
                    activeOpacity={0.85}
                    style={[styles.gridItem, active && { borderColor: wallpaperMode === 'solar' ? GOLD : PURPLE, borderWidth: 2 }]}
                  >
                    <AsyncWallpaperImage bgKey={key} />
                    <LinearGradient colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.9)']} style={StyleSheet.absoluteFillObject} />
                    
                    <BlurView intensity={40} tint="dark" style={styles.timePill}>
                      <Text style={styles.timePillText}>{dynamicTimes[key] || meta.time}</Text>
                    </BlurView>
                    
                    {active && (
                      <View style={[styles.activeIndicator, { backgroundColor: wallpaperMode === 'solar' ? GOLD : PURPLE }]}>
                        <Ionicons name="checkmark-sharp" size={14} color="#000" />
                      </View>
                    )}

                    <View style={styles.itemContent}>
                      <Text numberOfLines={1} style={styles.itemTitle}>{meta.emoji} {meta.label}</Text>
                      <Text numberOfLines={1} style={styles.itemSub}>{meta.sub}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
              {rowKeys.length === 1 && <View style={{ flex: 1 }} />}
            </View>
          ))}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  safeArea: { zIndex: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff', letterSpacing: 1, fontFamily: 'Nunito_700Bold' },
  headerSubtitle: { fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 2, fontWeight: '800', letterSpacing: 2.5, textTransform: 'uppercase' },
  toastBanner: { position: 'absolute', top: 70, alignSelf: 'center', backgroundColor: 'rgba(10, 10, 15, 0.95)', borderRadius: 24, paddingVertical: 14, paddingHorizontal: 24, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 8, zIndex: 999 },
  
  heroContainer: { paddingHorizontal: 16, marginBottom: 24, marginTop: 8 },
  heroCard: { width: '100%', height: 260, borderRadius: 32, overflow: 'hidden', backgroundColor: '#111', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  heroContent: { flex: 1, justifyContent: 'flex-end', padding: 24, alignItems: 'center' },
  heroTag: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  heroTagText: { fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 2 },
  heroName: { fontSize: 32, fontWeight: '800', color: '#fff', textAlign: 'center', letterSpacing: 0, fontFamily: 'Nunito_800ExtraBold', marginBottom: 4 },
  heroTime: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontFamily: 'Nunito_400Regular' },
  
  segmentedControl: { flexDirection: 'row', borderRadius: 20, padding: 4, marginHorizontal: 16, marginBottom: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  segmentBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 16 },
  segmentBtnActiveSolar: { backgroundColor: 'rgba(251, 191, 36, 0.15)' },
  segmentBtnActiveManual: { backgroundColor: 'rgba(167, 139, 250, 0.15)' },
  segmentText: { fontSize: 13, fontWeight: '500', color: '#FFFFFF60', letterSpacing: 0.5, fontFamily: 'Nunito_600SemiBold' },
  
  categoryTab: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  categoryTabActive: { backgroundColor: '#fff', borderColor: '#fff' },
  
  gridContainer: { paddingHorizontal: 16 },
  gridRow: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  gridItem: { flex: 1, height: 260, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: '#0A0A0F' },
  timePill: { position: 'absolute', top: 12, left: 12, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  timePillText: { fontSize: 9, fontWeight: '700', color: '#fff', letterSpacing: 1 },
  activeIndicator: { position: 'absolute', top: 12, right: 12, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 3 },
  itemContent: { flex: 1, justifyContent: 'flex-end', padding: 16 },
  itemTitle: { fontSize: 14, fontWeight: '700', color: '#fff', marginBottom: 2, letterSpacing: 0.5, fontFamily: 'Nunito_700Bold' },
  itemSub: { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: 'Nunito_400Regular' },
});
