import os

content = """import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, FlatList, Dimensions, StatusBar, Animated, BackHandler, LayoutAnimation, Platform } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { useBgContext } from './_layout';
import { BG_KEYS, BG_META, BgKey, getCategoryOfKey, getTimedBgKey } from '../lib/bgImages';
import { AsyncWallpaperImage } from '../components/AsyncWallpaperImage';

const { width, height } = Dimensions.get('window');
const GOLD = '#F59E0B';

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'morning', label: 'Morning' },
  { id: 'day', label: 'Day' },
  { id: 'sunset', label: 'Sunset' },
  { id: 'night', label: 'Night' },
];

export default function WallpaperSettings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  useFocusEffect(useCallback(() => {
    const onBackPress = () => {
      router.navigate('/(tabs)');
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [router]));

  const {
    wallpaperMode, manualBgKey, setWallpaperMode, setManualBgKey,
    bgKey, solarTimes
  } = useBgContext();

  const [activeCategory, setActiveCategory] = useState<'all' | 'morning' | 'day' | 'sunset' | 'night'>('all');
  const [layoutMode, setLayoutMode] = useState<'horizontal' | 'grid'>('horizontal');
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'info' }>({ visible: false, message: '', type: 'success' });
  const isMounted = useRef(true);

  const actualActiveBgKey = wallpaperMode === 'manual' ? manualBgKey : bgKey;
  const [previewBgKey, setPreviewBgKey] = useState<BgKey>(actualActiveBgKey as BgKey);

  // Sync preview with bgKey when in solar mode
  useEffect(() => {
    if (wallpaperMode === 'solar' && bgKey) {
      setPreviewBgKey(bgKey as BgKey);
    }
  }, [wallpaperMode, bgKey]);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const [dynamicTimes, setDynamicTimes] = useState<Partial<Record<BgKey, string>>>({});
  
  useEffect(() => {
    if (!solarTimes) return;
    const map: Partial<Record<BgKey, {start: number, end: number}>> = {};
    for (let m = 4 * 60; m < 28 * 60; m++) {
      const h = (m / 60) % 24;
      const k = getTimedBgKey(h, solarTimes) as BgKey;
      if (!map[k]) {
        map[k] = { start: (m/60), end: (m/60) };
      } else {
        map[k]!.end = (m/60);
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

  const filteredKeys = BG_KEYS.filter(key => {
    if (activeCategory === 'all') return true;
    return getCategoryOfKey(key) === activeCategory;
  });

  const previewMeta = BG_META[previewBgKey] ?? BG_META.morning;
  const isPreviewingActive = previewBgKey === actualActiveBgKey;

  const handleApply = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setWallpaperMode('manual');
    setManualBgKey(previewBgKey);
    showToast('Wallpaper Applied', 'success');
  };

  const handleToggleSolar = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (wallpaperMode === 'solar') {
      setWallpaperMode('manual');
      setManualBgKey(previewBgKey);
      showToast('Pinned Mode Active', 'info');
    } else {
      setWallpaperMode('solar');
      setPreviewBgKey(bgKey as BgKey); 
      showToast('Auto-Solar Active', 'success');
    }
  };

  const toggleLayout = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setLayoutMode(prev => prev === 'horizontal' ? 'grid' : 'horizontal');
  };

  const renderThumbnail = ({ item: key }: { item: string }) => {
    const isSelected = key === previewBgKey;
    const isActive = key === actualActiveBgKey;
    const isCurrentSolar = wallpaperMode === 'solar' && key === bgKey;
    const isGrid = layoutMode === 'grid';

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setPreviewBgKey(key as BgKey);
        }}
        style={[
          isGrid ? styles.gridCard : styles.thumbnailCard,
          isSelected && styles.thumbnailCardSelected
        ]}
      >
        <AsyncWallpaperImage bgKey={key as string} />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.5)']}
          locations={[0.5, 1]}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        
        {isActive && (
          <View style={styles.thumbnailActiveBadge}>
            <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFillObject} />
            <Ionicons name="checkmark" size={12} color="#fff" />
          </View>
        )}
        {isCurrentSolar && (
          <View style={styles.thumbnailSolarBadge}>
            <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFillObject} />
            <Ionicons name="sunny" size={14} color={GOLD} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      
      {/* 1. Immersive Full-Screen Wallpaper */}
      <Animated.View style={StyleSheet.absoluteFillObject}>
        <AsyncWallpaperImage bgKey={previewBgKey} />
      </Animated.View>

      {/* 2. Soft Vignette / Gradient Overlays (Zero Noise, No Hard Blocks) */}
      <LinearGradient
        colors={['rgba(0,0,0,0.5)', 'transparent', 'transparent', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.95)']}
        locations={[0, 0.2, 0.4, 0.7, 1]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      {/* 3. Absolute Header (Top Left & Right) */}
      <View style={[styles.headerAbs, { top: Math.max(insets.top, 20) }]}>
        <TouchableOpacity 
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.navigate('/(tabs)');
          }}
          style={styles.backButton}
        >
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
          <Ionicons name="chevron-back" size={24} color="rgba(255,255,255,0.9)" />
        </TouchableOpacity>

        <TouchableOpacity 
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          onPress={toggleLayout}
          style={styles.layoutToggleBtn}
        >
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
          <Ionicons name={layoutMode === 'horizontal' ? "grid" : "albums"} size={20} color="rgba(255,255,255,0.9)" />
        </TouchableOpacity>
      </View>

      {/* 4. Absolute Hero Typography (Refined, Premium Size, No Muddy Shadows) */}
      <View style={[styles.centerHeroAbs, { top: Math.max(insets.top, 20) + 70 }]}>
        <Text style={styles.heroTime}>{dynamicTimes[previewBgKey] || previewMeta.time}</Text>
        <Text style={styles.heroName}>{previewMeta.label}</Text>
        <Text style={styles.heroSub}>{previewMeta.emoji} {previewMeta.sub}</Text>
      </View>

      {/* 5. Absolute Floating Apply Button (Clean Glass) */}
      {!isPreviewingActive && (
        <View style={styles.applyContainerAbs}>
          <TouchableOpacity activeOpacity={0.8} onPress={handleApply} style={styles.applyBtn}>
            <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFillObject} />
            <Ionicons name="color-wand" size={18} color="#111" />
            <Text style={styles.applyText}>Apply Wallpaper</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Toast Notification */}
      {toast.visible && (
        <Animated.View style={[styles.toastBanner, { top: insets.top + 70 }]}>
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12 }}>
            <Ionicons name={toast.type === 'success' ? 'checkmark-circle' : 'information-circle'} size={18} color="#fff" />
            <Text style={{ fontSize: 13, fontWeight: '500', color: '#fff', letterSpacing: 0.5 }}>{toast.message}</Text>
          </View>
        </Animated.View>
      )}

      {/* 6. The UI Controls (Floating flawlessly at the bottom) */}
      <View style={[styles.controlsContainer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        
        {/* Premium Glassmorphic Auto-Solar Pill */}
        <TouchableOpacity 
          activeOpacity={0.9} 
          onPress={handleToggleSolar}
          style={[styles.solarPill, wallpaperMode === 'solar' && styles.solarPillActive]}
        >
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
          {wallpaperMode === 'solar' && (
            <LinearGradient
              colors={['rgba(251, 191, 36, 0.1)', 'transparent']}
              style={StyleSheet.absoluteFillObject}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
          )}
          <View style={styles.solarPillContent}>
            <Ionicons name={wallpaperMode === 'solar' ? "sunny" : "time-outline"} size={20} color={wallpaperMode === 'solar' ? GOLD : "rgba(255,255,255,0.7)"} />
            <View style={styles.solarTextGroup}>
              <Text style={styles.solarCardTitle}>Auto-Solar Sync</Text>
              <Text style={styles.solarCardDesc}>
                {wallpaperMode === 'solar' ? 'Matches your local sky' : 'Pinned to specific time'}
              </Text>
            </View>
            <View style={[styles.customSwitchTrack, wallpaperMode === 'solar' && styles.customSwitchTrackActive]}>
              <View style={[styles.customSwitchKnob, wallpaperMode === 'solar' ? styles.customSwitchKnobActive : styles.customSwitchKnobInactive]} />
            </View>
          </View>
        </TouchableOpacity>

        {/* Categories (Premium Frosted Pills) */}
        <View style={{ marginBottom: 24 }}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScroll}
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
                  style={[styles.categoryPill, isSelected && styles.categoryPillActive]}
                >
                  <Text style={[styles.categoryText, isSelected && styles.categoryTextActive]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Thumbnails (Horizontal Slider OR 2x2 Grid) */}
        {layoutMode === 'horizontal' ? (
          <View style={styles.carouselWrapper}>
            <FlatList
              data={filteredKeys}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={142} // card width (130) + margin (12)
              decelerationRate="fast"
              keyExtractor={(item: string) => item}
              contentContainerStyle={styles.carouselScroll}
              renderItem={renderThumbnail}
            />
          </View>
        ) : (
          <View style={styles.gridWrapper}>
            <FlatList
              data={filteredKeys}
              numColumns={2}
              showsVerticalScrollIndicator={false}
              keyExtractor={(item: string) => item}
              contentContainerStyle={styles.gridScroll}
              columnWrapperStyle={styles.gridColumnWrapper}
              renderItem={renderThumbnail}
            />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  headerAbs: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  layoutToggleBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  centerHeroAbs: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 32,
    zIndex: 5,
  },
  heroTime: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 4,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  heroName: {
    fontSize: 34,
    fontWeight: '300',
    color: '#fff',
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroSub: {
    fontSize: 14,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.5,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  toastBanner: {
    position: 'absolute',
    alignSelf: 'center',
    borderRadius: 99,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.15)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 999,
  },
  applyContainerAbs: {
    position: 'absolute',
    bottom: height * 0.45,
    alignSelf: 'center',
    zIndex: 20,
  },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 99,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  applyText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
    letterSpacing: 0.2,
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: height * 0.48, // slightly taller to accommodate grid
    justifyContent: 'flex-end',
    zIndex: 10,
  },
  solarPill: {
    marginHorizontal: 24,
    marginBottom: 24,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  solarPillActive: {
    borderColor: 'rgba(251, 191, 36, 0.4)',
  },
  solarPillContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 16,
  },
  solarTextGroup: {
    flex: 1,
  },
  solarCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 0.2,
    marginBottom: 2,
  },
  solarCardDesc: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.5)',
  },
  customSwitchTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    padding: 2,
    justifyContent: 'center',
  },
  customSwitchTrackActive: {
    backgroundColor: GOLD,
  },
  customSwitchKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  customSwitchKnobInactive: {
    alignSelf: 'flex-start',
  },
  customSwitchKnobActive: {
    alignSelf: 'flex-end',
  },
  categoryScroll: {
    paddingHorizontal: 24,
    gap: 12,
  },
  categoryPill: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  categoryPillActive: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderColor: '#fff',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.3,
  },
  categoryTextActive: {
    color: '#000',
    fontWeight: '600',
  },
  carouselWrapper: {
    height: 190, 
  },
  carouselScroll: {
    paddingHorizontal: 20,
  },
  thumbnailCard: {
    width: 130, // Much smaller, elegant dimensions
    height: 190,
    marginHorizontal: 6,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  thumbnailCardSelected: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.95)',
    transform: [{ scale: 1.02 }],
    shadowColor: '#fff',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 }
  },
  gridWrapper: {
    flex: 1, 
    maxHeight: 250, // cap height so it doesn't take over screen
  },
  gridScroll: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  gridColumnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  gridCard: {
    width: (width - 48 - 12) / 2, // 2 columns exactly
    height: 200,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  thumbnailActiveBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  thumbnailSolarBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(251, 191, 36, 0.4)',
  }
});
"""

with open('/Users/hotelnamastebharatinn/Desktop/Morning-App/app/wallpaper.tsx', 'w') as f:
    f.write(content)
print("done")
