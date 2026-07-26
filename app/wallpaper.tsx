import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, StatusBar, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  useBgContext,
  BG_KEYS, BG_META, type BgKey, getTimedBgKey
} from '@/lib/bgContext';
import { getBgSourceSync } from '@/lib/bgImages';
import AppBackground from '@/components/AppBackground';

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
      <AppBackground />
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
            <Text style={styles.headerSubtitle}>PREMIUM THEMES</Text>
            <Text style={styles.headerTitle}>Wallpaper</Text>
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
        <BlurView intensity={20} tint="light" style={styles.segmentedControl}>
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
            <Text style={{ fontSize: 14 }}>☀️</Text>
            <Text style={[styles.segmentText, wallpaperMode === 'solar' && { color: GOLD }]}>
              Solar
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
            <Text style={{ fontSize: 14 }}>📌</Text>
            <Text style={[styles.segmentText, wallpaperMode === 'manual' && { color: PURPLE }]}>
              Pinned
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              if (wallpaperMode !== 'video') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setWallpaperMode('video');
                showToast('✨ Cinemagraph active.', 'info');
              }
            }}
            style={[styles.segmentBtn, wallpaperMode === 'video' && styles.segmentBtnActiveVideo]}
          >
            <Text style={{ fontSize: 14 }}>✨</Text>
            <Text style={[styles.segmentText, wallpaperMode === 'video' && { color: '#60a5fa' }]}>
              Video
            </Text>
          </TouchableOpacity>
        </BlurView>

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
        ) : wallpaperMode === 'video' ? (
          <View style={[styles.modeDesc, { borderColor: 'rgba(96, 165, 250, 0.25)' }]}>
            <LinearGradient
              colors={['rgba(96, 165, 250, 0.12)', 'rgba(10, 15, 30, 0.3)']}
              style={styles.modeDescGradient}
            >
              <View style={[styles.modeDescIcon, { backgroundColor: 'rgba(96, 165, 250, 0.15)' }]}>
                <Text style={{ fontSize: 20 }}>✨</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#60a5fa', marginBottom: 2 }}>
                  Calming Video Active
                </Text>
                <Text style={{ fontSize: 11, color: '#FFFFFFCC', lineHeight: 16 }}>
                  A subtle, relaxing video loop plays continuously in the background for a premium, immersive experience.
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
                
                // Get the local URI synchronously just like the sleep page does
                const rawActiveUri = getBgSourceSync(key);
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
                        resizeMode="cover"
                      />
                      <LinearGradient
                        colors={['rgba(0,0,0,0.0)', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.9)']}
                        locations={[0, 0.4, 1]}
                        style={StyleSheet.absoluteFillObject}
                      />

                      {/* Time Pill */}
                      <BlurView intensity={40} tint="dark" style={styles.timePill}>
                        <Text style={styles.timePillText}>
                          {dynamicTimes[key] || meta.time}
                        </Text>
                      </BlurView>

                      {/* Selection Status Overlay */}
                      {active && (
                        <View style={[
                          styles.activeStatusPill,
                          { backgroundColor: wallpaperMode === 'solar' ? GOLD : PURPLE }
                        ]}>
                          <Ionicons name="checkmark-sharp" size={14} color="#000" />
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
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#FFFFFF99',
    marginBottom: 2,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  toastBanner: {
    position: 'absolute',
    top: 70,
    alignSelf: 'center',
    backgroundColor: 'rgba(20, 20, 20, 0.95)',
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 999,
  },
  heroContainer: {
    height: 160,
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  heroContent: {
    alignItems: 'center',
  },
  heroTime: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 2,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  heroName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  heroSub: {
    fontSize: 13,
    color: '#FFFFFFCC',
    marginTop: 6,
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 20,
    padding: 6,
    marginHorizontal: 16,
    marginBottom: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    overflow: 'hidden',
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  segmentBtnActiveSolar: {
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
    borderColor: 'rgba(251, 191, 36, 0.4)',
  },
  segmentBtnActiveManual: {
    backgroundColor: 'rgba(167, 139, 250, 0.2)',
    borderColor: 'rgba(167, 139, 250, 0.4)',
  },
  segmentBtnActiveVideo: {
    backgroundColor: 'rgba(96, 165, 250, 0.2)',
    borderColor: 'rgba(96, 165, 250, 0.4)',
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF80',
    letterSpacing: 0.3,
  },
  modeDesc: {
    marginHorizontal: 16,
    marginBottom: 32,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
  },
  modeDescGradient: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  modeDescIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 99,
    borderWidth: StyleSheet.hairlineWidth,
  },
  categoryTabActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderColor: 'rgba(255, 255, 255, 0.4)',
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
    gap: 16,
    marginBottom: 16,
  },
  gridItem: {
    flex: 1,
    height: 220,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  timePill: {
    position: 'absolute',
    top: 12,
    left: 12,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    overflow: 'hidden',
  },
  timePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  activeStatusPill: {
    position: 'absolute',
    top: 12,
    right: 12,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activeStatusText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#000',
    letterSpacing: 0.5,
  },
  itemContent: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 16,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 3,
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  itemSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
