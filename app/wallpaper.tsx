import React, { useCallback, useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, StatusBar, Image, Dimensions,
  BackHandler } from "react-native";

const { width, height } = Dimensions.get('window');
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useRouter , useFocusEffect } from "expo-router";
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

  if (!imgUri || imgUri.length < 5) return <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#1e293b' }]} />;
  
  return (
    <Image
      source={{ uri: imgUri }}
      style={StyleSheet.absoluteFillObject}
      resizeMode="cover"
    />
  );
}

const PURPLE = '#c084fc'; // Brighter premium purple
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

  const filteredKeys = BG_KEYS.filter(key => {
    if (activeCategory === 'all') return true;
    return getCategoryOfKey(key) === activeCategory;
  });

  return (
    <View style={styles.screen}>
      <AppBackground />
      <StatusBar barStyle="light-content" />
      
      {/* Immersive Fade: Let the top be mostly clear to show the active wallpaper, fading to dark at the bottom */}
      <LinearGradient
        colors={['rgba(6, 10, 24, 0.2)', 'rgba(6, 10, 24, 0.85)', '#060A18']}
        locations={[0, 0.45, 0.8]}
        style={StyleSheet.absoluteFillObject}
      />

      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.navigate('/(tabs)');
            }}
            style={styles.backButton}
          >
            <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFillObject} />
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.headerSubtitle}>Personalization</Text>
            <Text style={styles.headerTitle}>Wallpapers</Text>
          </View>
          <View style={{ width: 44 }} />
        </View>

        {toast.visible && (
          <Animated.View style={[styles.toastBanner, {
            borderColor: toast.type === 'success' ? 'rgba(251, 191, 36, 0.5)' : 'rgba(192, 132, 252, 0.5)',
            shadowColor: toast.type === 'success' ? GOLD : PURPLE,
          }]}>
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12 }}>
              <Text style={{ fontSize: 16 }}>{toast.type === 'success' ? '✨' : '📌'}</Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff', letterSpacing: 0.3 }}>{toast.message}</Text>
            </View>
          </Animated.View>
        )}
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Cinematic Hero */}
        <View style={styles.heroContainer}>
          <Text style={styles.heroTime}>{dynamicTimes[activeBgKey as BgKey] || activeMeta.time}</Text>
          <Text style={styles.heroName}>{activeMeta.emoji} {activeMeta.label}</Text>
          <Text style={styles.heroSub}>{activeMeta.sub}</Text>
        </View>

        {/* Premium Mode Selector */}
        <View style={styles.modeToggleContainer}>
          <BlurView intensity={30} tint="dark" style={styles.segmentedControl}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => {
                if (wallpaperMode !== 'solar') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setWallpaperMode('solar');
                  showToast('Auto-Solar Active', 'success');
                }
              }}
              style={[styles.segmentBtn, wallpaperMode === 'solar' && styles.segmentBtnActiveSolar]}
            >
              {wallpaperMode === 'solar' && (
                 <LinearGradient colors={['rgba(251, 191, 36, 0.15)', 'transparent']} style={StyleSheet.absoluteFillObject} />
              )}
              <Text style={[styles.segmentEmoji, wallpaperMode === 'solar' && { opacity: 1 }]}>☀️</Text>
              <Text style={[styles.segmentText, wallpaperMode === 'solar' && { color: GOLD, fontWeight: '600' }]}>
                Auto-Solar
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => {
                if (wallpaperMode !== 'manual') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setWallpaperMode('manual');
                  showToast('Pinned Mode Active', 'info');
                }
              }}
              style={[styles.segmentBtn, wallpaperMode === 'manual' && styles.segmentBtnActiveManual]}
            >
               {wallpaperMode === 'manual' && (
                 <LinearGradient colors={['rgba(192, 132, 252, 0.15)', 'transparent']} style={StyleSheet.absoluteFillObject} />
              )}
              <Text style={[styles.segmentEmoji, wallpaperMode === 'manual' && { opacity: 1 }]}>📌</Text>
              <Text style={[styles.segmentText, wallpaperMode === 'manual' && { color: PURPLE, fontWeight: '600' }]}>
                Pinned
              </Text>
            </TouchableOpacity>
          </BlurView>
        </View>

        {/* Dynamic Mode Description */}
        <View style={styles.modeDescContainer}>
          <Text style={styles.modeDescText}>
            {wallpaperMode === 'solar' 
              ? `Dynamic wallpapers shifting gracefully across 40 solar states. Currently in ${activeMeta.label}.`
              : `A permanent view. Select any stunning landscape below to pin it as your timeless background.`}
          </Text>
        </View>

        {/* Fluid Categories */}
        <View style={{ marginVertical: 20 }}>
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
                  <Text style={{ fontSize: 14 }}>{cat.emoji}</Text>
                  <Text style={{
                    fontSize: 13,
                    fontWeight: isSelected ? '700' : '500',
                    color: isSelected ? '#fff' : 'rgba(255,255,255,0.5)',
                    letterSpacing: 0.5
                  }}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Cinematic Gallery */}
        <View style={{ marginTop: 10 }}>
          <Animated.FlatList
            data={filteredKeys}
            keyExtractor={item => item}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={width * 0.72 + 16}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: (width - (width * 0.72)) / 2, paddingVertical: 20 }}
            ItemSeparatorComponent={() => <View style={{ width: 16 }} />}
            renderItem={({ item: key }) => {
              const meta = BG_META[key as BgKey];
              const active = wallpaperMode === 'manual' ? manualBgKey === key : bgKey === key;
              const accentColor = wallpaperMode === 'solar' ? GOLD : PURPLE;

              return (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    if (wallpaperMode === 'solar') {
                      setWallpaperMode('manual');
                      setManualBgKey(key as BgKey);
                      showToast('Pinned Mode Activated', 'success');
                    } else {
                      setManualBgKey(key as BgKey);
                      showToast('Pinned Wallpaper Updated', 'success');
                    }
                  }}
                  style={[
                    styles.cardContainer,
                    {
                      width: width * 0.72,
                      borderColor: active ? accentColor : 'rgba(255,255,255,0.08)',
                      shadowColor: active ? accentColor : '#000',
                      shadowOpacity: active ? 0.4 : 0.2,
                      transform: [{ scale: active ? 1 : 0.96 }],
                    }
                  ]}
                >
                  <AsyncWallpaperImage bgKey={key as string} />
                  
                  <LinearGradient
                    colors={['rgba(0,0,0,0.1)', 'transparent', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.95)']}
                    locations={[0, 0.3, 0.7, 1]}
                    style={StyleSheet.absoluteFillObject}
                  />

                  {/* Top Left Time Pill */}
                  <View style={styles.cardTimePill}>
                    <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFillObject} />
                    <Text style={styles.cardTimeText}>
                      {dynamicTimes[key as BgKey] || meta.time}
                    </Text>
                  </View>

                  {/* Top Right Active Indicator */}
                  {active && (
                    <View style={[styles.cardActiveIndicator, { backgroundColor: accentColor }]}>
                       <Ionicons name="checkmark-sharp" size={12} color="#111" />
                    </View>
                  )}

                  {/* Bottom Info */}
                  <View style={styles.cardContent}>
                    <Text numberOfLines={1} style={styles.cardTitle}>
                      {meta.emoji} {meta.label}
                    </Text>
                    <Text numberOfLines={2} style={styles.cardSub}>
                      {meta.sub}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
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
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '400',
    color: '#fff',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 2,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  toastBanner: {
    position: 'absolute',
    top: 70,
    alignSelf: 'center',
    borderRadius: 99,
    overflow: 'hidden',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
    zIndex: 999,
  },
  heroContainer: {
    paddingHorizontal: 32,
    paddingTop: height * 0.1,
    paddingBottom: 40,
    alignItems: 'center',
  },
  heroTime: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 4,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  heroName: {
    fontSize: 32,
    fontWeight: '300',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 12,
    marginBottom: 8,
  },
  heroSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 20,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  modeToggleContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 99,
    padding: 6,
    width: width * 0.8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 99,
    overflow: 'hidden',
  },
  segmentBtnActiveSolar: {
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
  },
  segmentBtnActiveManual: {
    backgroundColor: 'rgba(192, 132, 252, 0.1)',
  },
  segmentEmoji: {
    fontSize: 14,
    opacity: 0.5,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.5,
  },
  modeDescContainer: {
    paddingHorizontal: 40,
    alignItems: 'center',
  },
  modeDescText: {
    textAlign: 'center',
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 18,
  },
  categoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 99,
  },
  categoryTabActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  categoryTabInactive: {
    backgroundColor: 'transparent',
  },
  cardContainer: {
    height: height * 0.55,
    borderRadius: 40,
    overflow: 'hidden',
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 16 },
    shadowRadius: 32,
    elevation: 12,
    backgroundColor: '#111',
  },
  cardTimePill: {
    position: 'absolute',
    top: 20,
    left: 20,
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 6,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  cardTimeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 1.5,
  },
  cardActiveIndicator: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  cardContent: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 24,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '400',
    color: '#fff',
    marginBottom: 8,
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  cardSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '400',
    lineHeight: 18,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
