import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  useBgContext,
  BG_KEYS, BG_META, type BgKey, getTimedBgKey
} from '@/lib/bgContext';

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
  if ([
    'brahma', 'predawn', 'predawn_mid', 'sunrise', 'sunrise_2', 'sunrise_late', 'sunrise_late_2',
    'morning_early', 'morning_early_late', 'morning', 'morning_2', 'morning_late', 'morning_late_2'
  ].includes(key)) {
    return 'morning';
  }
  if ([
    'midday_early', 'midday_early_2', 'midday_early_mid', 'midday_early_late',
    'midday', 'midday_late', 'midday_late_2',
    'afternoon', 'afternoon_first_late', 'afternoon_mid', 'afternoon_late', 'afternoon_late_2'
  ].includes(key)) {
    return 'day';
  }
  if ([
    'sandhya', 'sandhya_mid', 'sandhya_late', 'sandhya_late_part2', 'sandhya_late_mid', 'sandhya_late_mid_2',
    'sandhya_late_2', 'sandhya_late_3', 'evening_early', 'evening_early_2', 'evening'
  ].includes(key)) {
    return 'sunset';
  }
  return 'night';
};

export default function WallpaperSettings() {
  const router = useRouter();
  const {
    wallpaperMode, manualBgKey, setWallpaperMode, setManualBgKey,
    bgKey, allBgUris, solarTimes, bgUri
  } = useBgContext();

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

  const showToast = (msg: string, type: 'success' | 'info' = 'success') => {
    setToast({ visible: true, message: msg, type });
    setTimeout(() => {
      if (isMounted.current) {
        setToast(prev => ({ ...prev, visible: false }));
      }
    }, 2500);
  };

  const activeBgKey = wallpaperMode === 'manual' ? manualBgKey : bgKey;
  const activeMeta  = BG_META[activeBgKey as BgKey] ?? BG_META.morning;

  // Filter keys based on current category selection
  const filteredKeys = BG_KEYS.filter(key => {
    if (activeCategory === 'all') return true;
    return getCategoryOfKey(key) === activeCategory;
  });

  // Split filtered keys into rows of 2 for grid layout
  const gridRows: BgKey[][] = [];
  for (let i = 0; i < filteredKeys.length; i += 2) {
    gridRows.push(filteredKeys.slice(i, i + 2) as BgKey[]);
  }

  return (
    <View style={styles.screen}>
      <Image
        source={bgUri ? { uri: bgUri } : undefined}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        transition={500}
      />
      <StatusBar barStyle="light-content" />
      {/* Immersive glass overlay to keep UI legible over any background */}
      <LinearGradient
        colors={['rgba(0,0,0,0.6)', 'rgba(0,0,0,0.85)', '#060A18']}
        locations={[0, 0.4, 0.9]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Top Header */}
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.headerTitle}>Wallpaper</Text>
            <Text style={styles.headerSubtitle}>Premium Themes</Text>
          </View>
          <View style={{ width: 44 }} /> {/* Balance for back button */}
        </View>

        {/* Custom Toast Banner */}
        {toast.visible && (
          <View style={[styles.toastBanner, {
            borderColor: toast.type === 'success' ? 'rgba(251, 191, 36, 0.5)' : 'rgba(167, 139, 250, 0.5)',
            shadowColor: toast.type === 'success' ? GOLD : PURPLE,
          }]}>
            <Text style={{ fontSize: 14 }}>{toast.type === 'success' ? '✨' : '📌'}</Text>
            <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff' }}>{toast.message}</Text>
          </View>
        )}
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}
      >
        {/* Active Wallpaper Hero */}
        <View style={styles.heroContainer}>
          <View style={styles.heroContent}>
            <Text style={styles.heroTime}>{dynamicTimes[activeBgKey as BgKey] || activeMeta.time}</Text>
            <Text style={styles.heroName}>{activeMeta.emoji}  {activeMeta.label}</Text>
            <Text style={styles.heroSub}>{activeMeta.sub}</Text>
          </View>
        </View>

        {/* Segmented Mode Selector */}
        <View style={styles.segmentedControl}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              if (wallpaperMode !== 'solar') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setWallpaperMode('solar');
                showToast('☀️ Auto Solar Rhythm activated!', 'success');
              }
            }}
            style={[styles.segmentBtn, wallpaperMode === 'solar' && styles.segmentBtnActiveSolar]}
          >
            <Text style={{ fontSize: 16 }}>☀️</Text>
            <Text style={[styles.segmentText, wallpaperMode === 'solar' && { color: GOLD }]}>
              Auto Solar
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              if (wallpaperMode !== 'manual') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setWallpaperMode('manual');
                showToast('📌 Pinned Mode active.', 'info');
              }
            }}
            style={[styles.segmentBtn, wallpaperMode === 'manual' && styles.segmentBtnActiveManual]}
          >
            <Text style={{ fontSize: 16 }}>📌</Text>
            <Text style={[styles.segmentText, wallpaperMode === 'manual' && { color: PURPLE }]}>
              Pinned Mode
            </Text>
          </TouchableOpacity>
        </View>

        {/* Mode Description Banner */}
        {wallpaperMode === 'solar' ? (
          <View style={[styles.modeDesc, { borderColor: 'rgba(251, 191, 36, 0.25)' }]}>
            <LinearGradient
              colors={['rgba(251, 191, 36, 0.12)', 'rgba(10, 15, 30, 0.3)']}
              style={styles.modeDescGradient}
            >
              <View style={[styles.modeDescIcon, { backgroundColor: 'rgba(251, 191, 36, 0.15)' }]}>
                <Text style={{ fontSize: 20 }}>☀️</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: GOLD, marginBottom: 2 }}>
                  Circadian Solar Sync
                </Text>
                <Text style={{ fontSize: 11, color: '#FFFFFFCC', lineHeight: 16 }}>
                  Your wallpaper shifts dynamically through 40 solar states in sync with the sun's elevation. Current phase is <Text style={{fontWeight: '800', color: '#fff'}}>{activeMeta.label}</Text>.
                </Text>
              </View>
            </LinearGradient>
          </View>
        ) : (
          <View style={[styles.modeDesc, { borderColor: 'rgba(167, 139, 250, 0.25)' }]}>
            <LinearGradient
              colors={['rgba(167, 139, 250, 0.12)', 'rgba(10, 15, 30, 0.3)']}
              style={styles.modeDescGradient}
            >
              <View style={[styles.modeDescIcon, { backgroundColor: 'rgba(167, 139, 250, 0.15)' }]}>
                <Text style={{ fontSize: 20 }}>📌</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: PURPLE, marginBottom: 2 }}>
                  Pinned Wallpaper Active
                </Text>
                <Text style={{ fontSize: 11, color: '#FFFFFFCC', lineHeight: 16 }}>
                  Select any theme below to pin it as your permanent background. Tap Auto Solar anytime to re-enable dynamic transitions.
                </Text>
              </View>
            </LinearGradient>
          </View>
        )}

        {/* Category Filter Tabs */}
        <View style={{ marginBottom: 16 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
          >
            {CATEGORIES.map(cat => {
              const isSelected = activeCategory === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setActiveCategory(cat.id as any);
                  }}
                  style={[
                    styles.categoryTab,
                    isSelected ? styles.categoryTabActive : styles.categoryTabInactive
                  ]}
                >
                  <Text style={{ fontSize: 14 }}>{cat.emoji}</Text>
                  <Text style={{
                    fontSize: 13,
                    fontWeight: '800',
                    color: isSelected ? '#fff' : '#FFFFFF80'
                  }}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* 2-Column Grid */}
        <View style={styles.gridContainer}>
          {gridRows.map((rowKeys, rowIndex) => (
            <View key={rowIndex} style={styles.gridRow}>
              {rowKeys.map(key => {
                const meta = BG_META[key];
                const active = wallpaperMode === 'manual' ? manualBgKey === key : bgKey === key;
                const rawActiveUri = allBgUris[key];
                const imgUri = (rawActiveUri && rawActiveUri.length > 4) ? rawActiveUri : null;

                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      if (wallpaperMode === 'solar') {
                        setWallpaperMode('manual');
                        setManualBgKey(key as BgKey);
                        showToast('📌 Pinned Mode activated!', 'success');
                      } else {
                        setManualBgKey(key as BgKey);
                        showToast('📌 Pinned wallpaper updated!', 'success');
                      }
                    }}
                    activeOpacity={0.85}
                    style={[
                      styles.gridItem,
                      active && {
                        borderColor: wallpaperMode === 'solar' ? GOLD : PURPLE,
                        borderWidth: 2,
                      }
                    ]}
                  >
                    <View style={{ flex: 1, borderRadius: 16, overflow: 'hidden' }}>
                      <Image
                        source={imgUri ? { uri: imgUri } : undefined}
                        style={StyleSheet.absoluteFillObject}
                        contentFit="cover"
                        transition={300}
                      />
                      <LinearGradient
                        colors={['rgba(0,0,0,0.0)', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.9)']}
                        locations={[0, 0.4, 1]}
                        style={StyleSheet.absoluteFillObject}
                      />

                      {/* Time Pill */}
                      <View style={styles.timePill}>
                        <Text style={styles.timePillText}>
                          {dynamicTimes[key] || meta.time}
                        </Text>
                      </View>

                      {/* Selection Status Overlay */}
                      {active && (
                        <View style={[
                          styles.activeStatusPill,
                          { backgroundColor: wallpaperMode === 'solar' ? GOLD : PURPLE }
                        ]}>
                          <Text style={styles.activeStatusText}>
                            {wallpaperMode === 'solar' ? 'ACTIVE' : 'PINNED'}
                          </Text>
                        </View>
                      )}

                      {/* Content Overlay */}
                      <View style={styles.itemContent}>
                        <Text numberOfLines={1} style={styles.itemTitle}>
                          {meta.emoji} {meta.label}
                        </Text>
                        <Text numberOfLines={1} style={styles.itemSub}>
                          {meta.sub}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
              {/* Placeholder for odd number of items */}
              {rowKeys.length === 1 && <View style={{ flex: 1 }} />}
            </View>
          ))}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#060A18' },
  safeArea: { zIndex: 10 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#fff',
    fontFamily: 'Nunito_900Black',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#FFFFFF80',
    marginTop: 2,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  toastBanner: {
    position: 'absolute',
    top: 80,
    alignSelf: 'center',
    backgroundColor: 'rgba(10, 15, 30, 0.95)',
    borderRadius: 99,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 999,
  },
  heroContainer: {
    height: 120,
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  heroContent: {
    alignItems: 'center',
  },
  heroTime: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF90',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  heroName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    fontFamily: 'Nunito_900Black',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  heroSub: {
    fontSize: 12,
    color: '#FFFFFFCC',
    marginTop: 4,
    fontWeight: '500',
    textAlign: 'center',
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 6,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentBtnActiveSolar: {
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  segmentBtnActiveManual: {
    backgroundColor: 'rgba(167, 139, 250, 0.15)',
    borderColor: 'rgba(167, 139, 250, 0.3)',
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF80',
    letterSpacing: 0.3,
  },
  modeDesc: {
    marginHorizontal: 16,
    marginBottom: 24,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
  },
  modeDescGradient: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  modeDescIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 99,
    borderWidth: 1,
  },
  categoryTabActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  categoryTabInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  gridContainer: {
    paddingHorizontal: 16,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  gridItem: {
    flex: 1,
    height: 200,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  timePill: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  timePillText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFFEE',
    letterSpacing: 0.3,
  },
  activeStatusPill: {
    position: 'absolute',
    top: 10,
    right: 10,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  activeStatusText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 0.5,
  },
  itemContent: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 12,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 3,
    fontFamily: 'Nunito_900Black',
  },
  itemSub: {
    fontSize: 10,
    color: '#FFFFFFCC',
    fontWeight: '600',
  },
});
