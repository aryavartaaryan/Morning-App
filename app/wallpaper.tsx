import React, { useCallback, useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, StatusBar, Image, Dimensions, LayoutAnimation,
  BackHandler, FlatList
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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

const { width, height } = Dimensions.get('window');

function AsyncWallpaperImage({ bgKey }: { bgKey: string }) {
  const [imgUri, setImgUri] = React.useState<string | null>(() => getBgSourceSync(bgKey));
  
  React.useEffect(() => {
    let mounted = true;
    getBgSource(bgKey).then(uri => {
      if (mounted) setImgUri(uri);
    }).catch(() => {});
    return () => { mounted = false; };
  }, [bgKey]);

  if (!imgUri || imgUri.length < 5) return <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#111' }]} />;
  
  return (
    <Image
      source={{ uri: imgUri }}
      style={StyleSheet.absoluteFillObject}
      resizeMode="cover"
    />
  );
}

const PURPLE = '#c084fc'; 
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
  ].includes(key)) return 'morning';
  if ([
    'midday_early', 'midday_early_2', 'midday_early_mid', 'midday_early_late',
    'midday', 'midday_late', 'midday_late_2',
    'afternoon', 'afternoon_first_late', 'afternoon_mid', 'afternoon_late', 'afternoon_late_2'
  ].includes(key)) return 'day';
  if ([
    'sandhya', 'sandhya_mid', 'sandhya_late', 'sandhya_late_part2', 'sandhya_late_mid', 'sandhya_late_mid_2',
    'sandhya_late_2', 'sandhya_late_3', 'evening_early', 'evening_early_2', 'evening'
  ].includes(key)) return 'sunset';
  return 'night';
};

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
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'info' }>({ visible: false, message: '', type: 'success' });
  const isMounted = useRef(true);

  // Determine what is currently active
  const actualActiveBgKey = wallpaperMode === 'manual' ? manualBgKey : bgKey;
  
  // The wallpaper we are previewing (defaults to active)
  const [previewBgKey, setPreviewBgKey] = useState<BgKey>(actualActiveBgKey as BgKey);

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
      setPreviewBgKey(bgKey as BgKey); // snap preview back to what auto-solar dictates
      showToast('Auto-Solar Active', 'success');
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      
      {/* Full Screen Immersive Wallpaper */}
      <Animated.View style={StyleSheet.absoluteFillObject}>
        <AsyncWallpaperImage bgKey={previewBgKey} />
      </Animated.View>

      {/* Subtle fade at top and bottom for readability */}
      <LinearGradient
        colors={['rgba(0,0,0,0.5)', 'transparent', 'transparent', 'rgba(0,0,0,0.8)']}
        locations={[0, 0.2, 0.6, 1]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      {/* Floating Header */}
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <View style={styles.header}>
          <TouchableOpacity 
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.navigate('/(tabs)');
            }}
            style={styles.backButton}
          >
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>

          {/* Smart Mode Toggle Pill */}
          <TouchableOpacity 
            activeOpacity={0.8}
            onPress={handleToggleSolar}
            style={styles.modeTogglePill}
          >
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
            <Ionicons name={wallpaperMode === 'solar' ? 'sunny' : 'pin'} size={14} color={wallpaperMode === 'solar' ? GOLD : '#fff'} />
            <Text style={[styles.modeToggleText, { color: wallpaperMode === 'solar' ? GOLD : '#fff' }]}>
              {wallpaperMode === 'solar' ? 'Auto-Solar' : 'Pinned'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Center Typography (Name of the wallpaper) */}
        <View style={styles.centerHero}>
          <Text style={styles.heroTime}>{dynamicTimes[previewBgKey] || previewMeta.time}</Text>
          <Text style={styles.heroName}>{previewMeta.label}</Text>
          <Text style={styles.heroSub}>{previewMeta.emoji} {previewMeta.sub}</Text>
        </View>
      </SafeAreaView>

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

      {/* Floating Apply Button (Visible if previewing a different wallpaper) */}
      {!isPreviewingActive && (
        <View style={styles.applyContainer}>
          <TouchableOpacity activeOpacity={0.9} onPress={handleApply} style={styles.applyBtn}>
            <BlurView intensity={50} tint="light" style={StyleSheet.absoluteFillObject} />
            <Text style={styles.applyText}>Set Wallpaper</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* The Smart Dock */}
      <View style={[styles.dockContainer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
        
        {/* Categories */}
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
                style={styles.categoryTab}
              >
                <Text style={[styles.categoryText, isSelected && styles.categoryTextActive]}>
                  {cat.label}
                </Text>
                {isSelected && <View style={styles.categoryIndicator} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Filmstrip Carousel */}
        <View style={{ height: 90, marginTop: 12 }}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={filteredKeys}
            keyExtractor={item => item}
            contentContainerStyle={styles.filmstripScroll}
            ItemSeparatorComponent={() => <View style={{ width: 16 }} />}
            renderItem={({ item: key }) => {
              const isSelected = key === previewBgKey;
              const isActive = key === actualActiveBgKey;

              return (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setPreviewBgKey(key as BgKey);
                  }}
                  style={[
                    styles.thumbnailContainer,
                    isSelected && styles.thumbnailContainerSelected
                  ]}
                >
                  <AsyncWallpaperImage bgKey={key as string} />
                  
                  {isActive && (
                    <View style={styles.thumbnailActiveBadge}>
                      <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  headerSafeArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  modeTogglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 99,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  modeToggleText: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  centerHero: {
    marginTop: height * 0.08,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  heroTime: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 4,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  heroName: {
    fontSize: 44,
    fontWeight: '200',
    color: '#fff',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 8,
  },
  heroSub: {
    fontSize: 14,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  toastBanner: {
    position: 'absolute',
    alignSelf: 'center',
    borderRadius: 99,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.15)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    zIndex: 999,
  },
  applyContainer: {
    position: 'absolute',
    bottom: 200, 
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  applyBtn: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 99,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.5)',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  applyText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 0.5,
  },
  dockContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
    paddingTop: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  categoryScroll: {
    paddingHorizontal: 24,
    gap: 24,
  },
  categoryTab: {
    alignItems: 'center',
    paddingBottom: 4,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1,
  },
  categoryTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  categoryIndicator: {
    position: 'absolute',
    bottom: -4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#fff',
    shadowColor: '#fff',
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  filmstripScroll: {
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  thumbnailContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  thumbnailContainerSelected: {
    borderColor: '#fff',
    borderWidth: 2,
    transform: [{ scale: 1.05 }],
    shadowColor: '#fff',
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  thumbnailActiveBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.5)',
  }
});
