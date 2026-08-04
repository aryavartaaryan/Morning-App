import React, { useCallback, useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, StatusBar, Image, Dimensions,
  BackHandler, FlatList
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

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_W * 0.72;
const CARD_SPACING = 20;

function AsyncWallpaperImage({ bgKey }: { bgKey: string }) {
  const [imgUri, setImgUri] = React.useState<string | null>(() => getBgSourceSync(bgKey));
  
  React.useEffect(() => {
    let mounted = true;
    getBgSource(bgKey).then(uri => {
      if (mounted) setImgUri(uri);
    }).catch(() => {});
    return () => { mounted = false; };
  }, [bgKey]);

  if (!imgUri || imgUri.length < 5) return <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#1e293b' }]} />;
  
  return (
    <Image
      source={{ uri: imgUri }}
      style={StyleSheet.absoluteFillObject}
      resizeMode="cover"
    />
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
    bgKey, allBgUris, solarTimes
  } = useBgContext();

  const [dynamicTimes, setDynamicTimes] = useState<Partial<Record<BgKey, string>>>({});
  const [activeCategory, setActiveCategory] = useState<'all' | 'morning' | 'day' | 'sunset' | 'night'>('all');
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'info' }>({ visible: false, message: '', type: 'success' });
  const isMounted = useRef(true);

  // For the animated snap carousel
  const scrollX = useRef(new Animated.Value(0)).current;

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

  const renderCarouselItem = useCallback(({ item: key, index }: { item: string, index: number }) => {
    const meta = BG_META[key as BgKey];
    const active = wallpaperMode === 'manual' ? manualBgKey === key : bgKey === key;
    
    // Parallax & Scale Animation based on scroll position
    const inputRange = [
      (index - 1) * (CARD_WIDTH + CARD_SPACING),
      index * (CARD_WIDTH + CARD_SPACING),
      (index + 1) * (CARD_WIDTH + CARD_SPACING),
    ];
    
    const scale = scrollX.interpolate({
      inputRange,
      outputRange: [0.92, 1, 0.92],
      extrapolate: 'clamp',
    });
    
    const opacity = scrollX.interpolate({
      inputRange,
      outputRange: [0.6, 1, 0.6],
      extrapolate: 'clamp',
    });

    return (
      <View style={{ width: CARD_WIDTH, marginHorizontal: CARD_SPACING / 2 }}>
        <Animated.View style={[styles.carouselCardWrap, { transform: [{ scale }], opacity }]}>
          <TouchableOpacity
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
            activeOpacity={0.9}
            style={[
              styles.carouselCard,
              active && {
                borderColor: wallpaperMode === 'solar' ? GOLD : PURPLE,
                borderWidth: 2,
              }
            ]}
          >
            <AsyncWallpaperImage bgKey={key} />
            
            {/* Cinematic Gradient overlay */}
            <LinearGradient
              colors={['rgba(0,0,0,0.0)', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.85)']}
              locations={[0, 0.5, 1]}
              style={StyleSheet.absoluteFillObject}
            />

            {/* Selection Status Overlay */}
            {active && (
              <View style={[
                styles.activeStatusPill,
                { backgroundColor: wallpaperMode === 'solar' ? GOLD : PURPLE }
              ]}>
                <Ionicons name="checkmark-sharp" size={12} color="#000" />
                <Text style={styles.activeStatusText}>
                  {wallpaperMode === 'solar' ? 'ACTIVE' : 'PINNED'}
                </Text>
              </View>
            )}

            {/* Time Pill */}
            <BlurView intensity={30} tint="dark" style={styles.timePill}>
              <Text style={styles.timePillText}>
                {dynamicTimes[key as BgKey] || meta.time}
              </Text>
            </BlurView>

            {/* Content Overlay */}
            <View style={styles.itemContent}>
              <Text numberOfLines={1} style={styles.itemTitle}>
                {meta.emoji} {meta.label}
              </Text>
              <Text numberOfLines={2} style={styles.itemSub}>
                {meta.sub}
              </Text>
            </View>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  }, [wallpaperMode, manualBgKey, bgKey, dynamicTimes, scrollX]);


  return (
    <View style={styles.screen}>
      <AppBackground />
      <StatusBar barStyle="light-content" />
      {/* Immersive glass overlay to keep UI legible over any background */}
      <LinearGradient
        colors={['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.8)', '#050810']}
        locations={[0, 0.3, 0.8]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Top Header */}
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.navigate('/(tabs)');
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
            borderColor: toast.type === 'success' ? 'rgba(251, 191, 36, 0.4)' : 'rgba(167, 139, 250, 0.4)',
            shadowColor: toast.type === 'success' ? GOLD : PURPLE,
          }]}>
            <Text style={{ fontSize: 14 }}>{toast.type === 'success' ? '✨' : '📌'}</Text>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff', marginLeft: 6 }}>{toast.message}</Text>
          </View>
        )}
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}
      >
        {/* Category Filter Tabs */}
        <View style={{ marginTop: 10, marginBottom: 20 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
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
                  <Text style={{ fontSize: 14, marginRight: 4 }}>{cat.emoji}</Text>
                  <Text style={{
                    fontSize: 13,
                    fontWeight: isSelected ? '700' : '500',
                    color: isSelected ? '#fff' : '#FFFFFF80'
                  }}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Cinematic Horizontal Carousel */}
        <View style={{ height: SCREEN_H * 0.52 }}>
          <Animated.FlatList
            data={filteredKeys}
            keyExtractor={item => item}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: (SCREEN_W - CARD_WIDTH) / 2 - (CARD_SPACING / 2)
            }}
            snapToInterval={CARD_WIDTH + CARD_SPACING}
            decelerationRate="fast"
            bounces={false}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { x: scrollX } } }],
              { useNativeDriver: true }
            )}
            scrollEventThrottle={16}
            renderItem={renderCarouselItem}
          />
        </View>

        {/* Segmented Mode Selector - Redesigned as a floating module */}
        <View style={styles.modeModuleContainer}>
          <BlurView intensity={25} tint="dark" style={styles.segmentedControl}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => {
                if (wallpaperMode !== 'solar') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setWallpaperMode('solar');
                  showToast('☀️ Auto-Solar Mode activated!', 'success');
                }
              }}
              style={[styles.segmentBtn, wallpaperMode === 'solar' && styles.segmentBtnActiveSolar]}
            >
              <Text style={{ fontSize: 16, marginRight: 6 }}>☀️</Text>
              <Text style={[styles.segmentText, wallpaperMode === 'solar' && { color: GOLD, fontWeight: '700' }]}>
                Auto-Solar
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
              <Text style={{ fontSize: 16, marginRight: 6 }}>📌</Text>
              <Text style={[styles.segmentText, wallpaperMode === 'manual' && { color: PURPLE, fontWeight: '700' }]}>
                Pinned
              </Text>
            </TouchableOpacity>
          </BlurView>
        </View>

        {/* Mode Description Banner */}
        <View style={{ paddingHorizontal: 20, marginTop: 4 }}>
          {wallpaperMode === 'solar' ? (
            <View style={[styles.modeDesc, { borderColor: 'rgba(251, 191, 36, 0.2)' }]}>
              <LinearGradient
                colors={['rgba(251, 191, 36, 0.1)', 'rgba(251, 191, 36, 0.02)']}
                style={styles.modeDescGradient}
              >
                <View style={[styles.modeDescIcon, { backgroundColor: 'rgba(251, 191, 36, 0.15)' }]}>
                  <Text style={{ fontSize: 18 }}>☀️</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: GOLD, marginBottom: 4, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                    Dynamic Auto-Solar
                  </Text>
                  <Text style={{ fontSize: 13, color: '#FFFFFFCC', lineHeight: 18 }}>
                    Wallpaper shifts seamlessly through 40 solar states matching the sun's actual elevation. Current phase is <Text style={{fontWeight: '800', color: '#fff'}}>{activeMeta.label}</Text>.
                  </Text>
                </View>
              </LinearGradient>
            </View>
          ) : (
            <View style={[styles.modeDesc, { borderColor: 'rgba(167, 139, 250, 0.2)' }]}>
              <LinearGradient
                colors={['rgba(167, 139, 250, 0.1)', 'rgba(167, 139, 250, 0.02)']}
                style={styles.modeDescGradient}
              >
                <View style={[styles.modeDescIcon, { backgroundColor: 'rgba(167, 139, 250, 0.15)' }]}>
                  <Text style={{ fontSize: 18 }}>📌</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: PURPLE, marginBottom: 4, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                    Pinned Theme Active
                  </Text>
                  <Text style={{ fontSize: 13, color: '#FFFFFFCC', lineHeight: 18 }}>
                    The selected theme is pinned permanently. Swipe through the carousel above to choose another, or tap Auto-Solar for dynamic transitions.
                  </Text>
                </View>
              </LinearGradient>
            </View>
          )}
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
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '400',
    color: '#fff',
    letterSpacing: 1.5,
  },
  headerSubtitle: {
    fontSize: 10,
    color: '#FFFFFF80',
    marginBottom: 4,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  toastBanner: {
    position: 'absolute',
    top: 70,
    alignSelf: 'center',
    backgroundColor: 'rgba(15, 15, 20, 0.95)',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 100,
  },
  
  // Category Tabs
  categoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  categoryTabActive: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(255,255,255,0.3)',
  },
  categoryTabInactive: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.08)',
  },

  // Carousel Layout
  carouselCardWrap: {
    flex: 1,
    paddingVertical: 10,
  },
  carouselCard: {
    flex: 1,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: '#111',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 16,
  },
  timePill: {
    position: 'absolute',
    top: 16,
    left: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  timePillText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  activeStatusPill: {
    position: 'absolute',
    top: 16,
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  activeStatusText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginLeft: 4,
  },
  itemContent: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
  },
  itemTitle: {
    fontSize: 24,
    fontWeight: '300',
    color: '#fff',
    marginBottom: 6,
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  itemSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 18,
  },

  // Mode Selector Module
  modeModuleContainer: {
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 16,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 24,
    padding: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 20,
  },
  segmentBtnActiveSolar: {
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  segmentBtnActiveManual: {
    backgroundColor: 'rgba(167, 139, 250, 0.15)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(167, 139, 250, 0.3)',
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.5,
  },
  
  // Mode Description
  modeDesc: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 40,
  },
  modeDescGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  modeDescIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },
});
