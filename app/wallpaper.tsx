import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, FlatList,
  Dimensions, StatusBar, Animated, BackHandler, Platform, Image, Pressable
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { useBgContext, BG_KEYS, BG_META, type BgKey, getTimedBgKey } from '@/lib/bgContext';
import { getBgSourceSync, getBgSource } from '@/lib/bgImages';

// ─── AsyncWallpaperImage ─────────────────────────────────────────────────────
function AsyncWallpaperImage({ bgKey, style }: { bgKey: string; style?: object }) {
  const [imgUri, setImgUri] = React.useState<string | null>(() => getBgSourceSync(bgKey));

  React.useEffect(() => {
    let mounted = true;
    getBgSource(bgKey).then(uri => {
      if (mounted && uri) setImgUri(uri);
    });
    return () => { mounted = false; };
  }, [bgKey]);

  if (!imgUri || imgUri.length < 5)
    return <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#0a0a0f' }, style]} />;

  return (
    <Image
      source={{ uri: imgUri }}
      style={[StyleSheet.absoluteFillObject, style]}
      resizeMode="cover"
    />
  );
}

// ─── Category helper ─────────────────────────────────────────────────────────
const getCategoryOfKey = (key: string): 'morning' | 'day' | 'sunset' | 'night' => {
  if (key.includes('morning') || key.includes('predawn') || key.includes('sunrise') || key.includes('brahma')) return 'morning';
  if (key.includes('day') || key.includes('noon')) return 'day';
  if (key.includes('sunset') || key.includes('golden') || key.includes('dusk')) return 'sunset';
  return 'night';
};

// ─── Constants ───────────────────────────────────────────────────────────────
const { width, height } = Dimensions.get('window');
const GOLD = '#F5A623';
const CARD_W = (width - 56) / 2;   // 2 cards perfectly side by side
const CARD_H = CARD_W * 1.55;       // 2:3 portrait ratio

const CATEGORIES = [
  { id: 'all', label: 'All', emoji: '✦' },
  { id: 'morning', label: 'Morning', emoji: '🌅' },
  { id: 'day', label: 'Day', emoji: '☀️' },
  { id: 'sunset', label: 'Sunset', emoji: '🌇' },
  { id: 'night', label: 'Night', emoji: '🌙' },
];

// ─── WallpaperCard sub-component (isolated to prevent full-list re-renders) ─
const WallpaperCard = React.memo(({
  bgKey, isSelected, isActive, isSolar, onPress, cardW, cardH
}: {
  bgKey: string; isSelected: boolean; isActive: boolean; isSolar: boolean;
  onPress: () => void; cardW: number; cardH: number;
}) => {
  const scale = useRef(new Animated.Value(isSelected ? 1.04 : 1)).current;
  const borderAnim = useRef(new Animated.Value(isSelected ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: isSelected ? 1.04 : 1, useNativeDriver: true, tension: 140, friction: 8 }),
      Animated.timing(borderAnim, { toValue: isSelected ? 1 : 0, duration: 200, useNativeDriver: false }),
    ]).start();
  }, [isSelected]);

  const borderColor = borderAnim.interpolate({ inputRange: [0, 1], outputRange: ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.9)'] });
  const borderWidth = borderAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 2] });

  return (
    <Pressable onPress={onPress}>
      <Animated.View style={[
        { width: cardW, height: cardH, borderRadius: 22, overflow: 'hidden' },
        { transform: [{ scale }] },
        { borderWidth, borderColor }
      ]}>
        <AsyncWallpaperImage bgKey={bgKey} />
        {/* Bottom label gradient */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.65)']}
          locations={[0.45, 1]}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />

        {/* Active wallpaper checkmark */}
        {isActive && (
          <View style={cardStyles.activeBadge}>
            <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFillObject} />
            <Ionicons name="checkmark" size={11} color="#000" />
          </View>
        )}

        {/* Solar badge */}
        {isSolar && (
          <View style={cardStyles.solarBadge}>
            <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFillObject} />
            <Text style={{ fontSize: 12 }}>☀️</Text>
          </View>
        )}

        {/* Selected indicator at bottom */}
        {isSelected && (
          <View style={cardStyles.selectedDot} />
        )}
      </Animated.View>
    </Pressable>
  );
});

const cardStyles = StyleSheet.create({
  activeBadge: {
    position: 'absolute', top: 10, right: 10,
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  solarBadge: {
    position: 'absolute', top: 10, left: 10,
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  selectedDot: {
    position: 'absolute', bottom: 10, alignSelf: 'center',
    width: 20, height: 3, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
});

// ─── Main Component ───────────────────────────────────────────────────────────
export default function WallpaperSettings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { router.back(); return true; });
    return () => sub.remove();
  }, [router]));

  const { wallpaperMode, manualBgKey, setWallpaperMode, setManualBgKey, bgKey, solarTimes } = useBgContext();

  const [activeCategory, setActiveCategory] = useState<'all' | 'morning' | 'day' | 'sunset' | 'night'>('all');
  const [layoutMode, setLayoutMode] = useState<'horizontal' | 'grid'>('horizontal');
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'success' | 'info'>('success');
  const isMounted = useRef(true);

  const actualActiveBgKey = wallpaperMode === 'manual' ? manualBgKey : bgKey;
  const [previewBgKey, setPreviewBgKey] = useState<BgKey>(actualActiveBgKey as BgKey);

  // Background crossfade
  const bgOpacity = useRef(new Animated.Value(1)).current;
  const prevBgKey = useRef<BgKey>(previewBgKey);

  // Toast animation
  const toastAnim = useRef(new Animated.Value(0)).current;

  // Apply button animation
  const applyAnim = useRef(new Animated.Value(0)).current;

  // Hero text animations
  const heroAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // Sync solar preview
  useEffect(() => {
    if (wallpaperMode === 'solar' && bgKey) {
      animatePreviewChange(bgKey as BgKey);
    }
  }, [wallpaperMode, bgKey]);

  const animatePreviewChange = (newKey: BgKey) => {
    Animated.sequence([
      Animated.timing(heroAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      prevBgKey.current = previewBgKey;
      setPreviewBgKey(newKey);
      Animated.timing(heroAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    });
  };

  // Dynamic solar time ranges
  const [dynamicTimes, setDynamicTimes] = useState<Partial<Record<BgKey, string>>>({});

  useEffect(() => {
    if (!solarTimes) return;
    const map: Partial<Record<BgKey, { start: number; end: number }>> = {};
    for (let m = 4 * 60; m < 28 * 60; m++) {
      const h = (m / 60) % 24;
      const k = getTimedBgKey(h, solarTimes) as BgKey;
      if (!map[k]) map[k] = { start: m / 60, end: m / 60 };
      else map[k]!.end = m / 60;
    }
    const fmt = (hr: number) => {
      let hh = Math.floor(hr), mm = Math.round((hr - hh) * 60);
      if (mm === 60) { hh += 1; mm = 0; }
      hh = hh % 24;
      const ampm = hh >= 12 ? 'PM' : 'AM';
      const dispH = hh % 12 === 0 ? 12 : hh % 12;
      const dispM = mm.toString().padStart(2, '0');
      return dispM === '00' ? `${dispH} ${ampm}` : `${dispH}:${dispM} ${ampm}`;
    };
    const res: Partial<Record<BgKey, string>> = {};
    for (const k of BG_KEYS) {
      if (map[k]) res[k] = `${fmt(map[k]!.start)} – ${fmt(map[k]!.end)}`;
    }
    setDynamicTimes(res);
  }, [solarTimes]);

  const showToast = (msg: string, type: 'success' | 'info') => {
    setToastMsg(msg); setToastType(type); setToastVisible(true);
    Animated.sequence([
      Animated.spring(toastAnim, { toValue: 1, useNativeDriver: true, tension: 120, friction: 8 }),
      Animated.delay(2000),
      Animated.timing(toastAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => { if (isMounted.current) setToastVisible(false); });
  };

  const filteredKeys = BG_KEYS.filter(key =>
    activeCategory === 'all' ? true : getCategoryOfKey(key) === activeCategory
  );

  const previewMeta = BG_META[previewBgKey] ?? BG_META[BG_KEYS[0]];
  const isPreviewingActive = previewBgKey === actualActiveBgKey;

  // Show/hide apply button
  useEffect(() => {
    Animated.spring(applyAnim, {
      toValue: isPreviewingActive ? 0 : 1,
      useNativeDriver: true,
      tension: 120,
      friction: 8,
    }).start();
  }, [isPreviewingActive]);

  const handleApply = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setWallpaperMode('manual');
    setManualBgKey(previewBgKey);
    showToast('✓  Wallpaper Applied', 'success');
  };

  const handleToggleSolar = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (wallpaperMode === 'solar') {
      setWallpaperMode('manual');
      setManualBgKey(previewBgKey);
      showToast('Pinned to this wallpaper', 'info');
    } else {
      setWallpaperMode('solar');
      animatePreviewChange(bgKey as BgKey);
      showToast('✦  Auto-Solar Active', 'success');
    }
  };

  const handleCardPress = (key: BgKey) => {
    if (key === previewBgKey) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    animatePreviewChange(key);
  };

  const toggleLayout = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLayoutMode(prev => prev === 'horizontal' ? 'grid' : 'horizontal');
  };

  const renderCard = ({ item: key }: { item: string }) => (
    <View style={{ marginHorizontal: 6, marginBottom: 12 }}>
      <WallpaperCard
        bgKey={key}
        isSelected={key === previewBgKey}
        isActive={key === actualActiveBgKey}
        isSolar={wallpaperMode === 'solar' && key === bgKey}
        onPress={() => handleCardPress(key as BgKey)}
        cardW={layoutMode === 'horizontal' ? CARD_W : CARD_W}
        cardH={layoutMode === 'horizontal' ? CARD_H : CARD_W * 1.3}
      />
    </View>
  );

  const isSolar = wallpaperMode === 'solar';

  return (
    <View style={S.screen}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── Full-screen wallpaper preview ── */}
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: bgOpacity }]}>
        <AsyncWallpaperImage bgKey={previewBgKey} />
      </Animated.View>

      {/* ── Cinematic gradient overlay ── */}
      <LinearGradient
        colors={['rgba(0,0,0,0.45)', 'transparent', 'transparent', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.97)']}
        locations={[0, 0.18, 0.42, 0.68, 1]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      {/* ── Header row ── */}
      <View style={[S.header, { top: Math.max(insets.top + 8, 24) }]}>
        {/* Back */}
        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
          style={S.iconBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFillObject} />
          <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.92)" />
        </TouchableOpacity>

        {/* Page title */}
        <View style={S.headerTitleWrap}>
          <Text style={S.headerTitle}>WALLPAPER</Text>
        </View>

        {/* Layout toggle */}
        <TouchableOpacity onPress={toggleLayout} style={S.iconBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFillObject} />
          <Ionicons name={layoutMode === 'horizontal' ? 'grid-outline' : 'albums-outline'} size={18} color="rgba(255,255,255,0.9)" />
        </TouchableOpacity>
      </View>

      {/* ── Hero info ── */}
      <Animated.View style={[
        S.heroBlock,
        { top: Math.max(insets.top + 8, 24) + 72 },
        { opacity: heroAnim, transform: [{ translateY: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }
      ]}>
        <Text style={S.heroTimeLabel}>{dynamicTimes[previewBgKey] || (previewMeta as any)?.time || ''}</Text>
        <Text style={S.heroName}>{(previewMeta as any)?.label ?? ''}</Text>
        {(previewMeta as any)?.sub && (
          <Text style={S.heroSub}>{(previewMeta as any)?.emoji} {(previewMeta as any)?.sub}</Text>
        )}
        {isSolar && previewBgKey === bgKey && (
          <View style={S.solarLivePill}>
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
            <Text style={{ fontSize: 10 }}>☀️</Text>
            <Text style={S.solarLiveText}>LIVE</Text>
          </View>
        )}
      </Animated.View>

      {/* ── Apply Wallpaper floating button ── */}
      <Animated.View style={[
        S.applyWrap,
        { bottom: height * 0.455 },
        {
          opacity: applyAnim,
          transform: [{ scale: applyAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
          pointerEvents: isPreviewingActive ? 'none' : 'auto',
        }
      ]}>
        <TouchableOpacity onPress={handleApply} activeOpacity={0.88} style={S.applyBtn}>
          <LinearGradient
            colors={['rgba(255,255,255,0.96)', 'rgba(240,240,240,0.94)']}
            style={StyleSheet.absoluteFillObject}
          />
          <Ionicons name="color-wand" size={17} color="#111" />
          <Text style={S.applyText}>Set as Wallpaper</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* ── Toast ── */}
      {toastVisible && (
        <Animated.View style={[
          S.toast, { top: insets.top + 72 },
          {
            opacity: toastAnim,
            transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }]
          }
        ]}>
          <BlurView intensity={55} tint="dark" style={StyleSheet.absoluteFillObject} />
          <View style={S.toastInner}>
            <Ionicons
              name={toastType === 'success' ? 'checkmark-circle' : 'information-circle'}
              size={15} color={toastType === 'success' ? '#4ade80' : 'rgba(255,255,255,0.7)'}
            />
            <Text style={S.toastText}>{toastMsg}</Text>
          </View>
        </Animated.View>
      )}

      {/* ── Bottom controls panel ── */}
      <View style={[S.panel, { paddingBottom: Math.max(insets.bottom, 18) }]}>

        {/* Auto-Solar control */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleToggleSolar}
          style={[S.solarRow, isSolar && S.solarRowActive]}
        >
          <BlurView intensity={isSolar ? 45 : 30} tint="dark" style={StyleSheet.absoluteFillObject} />
          {isSolar && (
            <LinearGradient
              colors={['rgba(245,166,35,0.14)', 'rgba(245,166,35,0.03)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
          )}
          <View style={S.solarIcon}>
            <Text style={{ fontSize: 20 }}>{isSolar ? '☀️' : '📍'}</Text>
          </View>
          <View style={S.solarText}>
            <Text style={S.solarTitle}>Auto-Solar Sync</Text>
            <Text style={S.solarDesc}>
              {isSolar ? 'Synced to your local sky' : 'Pinned to a wallpaper'}
            </Text>
          </View>
          {/* Custom switch */}
          <View style={[S.switchTrack, isSolar && S.switchTrackOn]}>
            <Animated.View style={[S.switchKnob, isSolar ? S.switchKnobOn : S.switchKnobOff]} />
          </View>
        </TouchableOpacity>

        {/* Category filter row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={S.catScroll}
          style={{ marginVertical: 16 }}
        >
          {CATEGORIES.map(cat => {
            const active = activeCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveCategory(cat.id as any); }}
                style={[S.catPill, active && S.catPillActive]}
                activeOpacity={0.8}
              >
                <Text style={[S.catText, active && S.catTextActive]}>
                  {cat.emoji}{'  '}{cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Wallpaper cards */}
        {layoutMode === 'horizontal' ? (
          <FlatList
            data={filteredKeys}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={item => item}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            snapToInterval={CARD_W + 12}
            decelerationRate="fast"
            style={{ height: CARD_H + 12 }}
            renderItem={renderCard}
          />
        ) : (
          <FlatList
            data={filteredKeys}
            numColumns={2}
            showsVerticalScrollIndicator={false}
            keyExtractor={item => item}
            contentContainerStyle={{ paddingHorizontal: 10 }}
            style={{ maxHeight: CARD_W * 1.3 * 2 + 48 }}
            renderItem={({ item: key }) => (
              <View style={{ flex: 1, marginHorizontal: 6, marginBottom: 12 }}>
                <WallpaperCard
                  bgKey={key}
                  isSelected={key === previewBgKey}
                  isActive={key === actualActiveBgKey}
                  isSolar={isSolar && key === bgKey}
                  onPress={() => handleCardPress(key as BgKey)}
                  cardW={(width - 56) / 2}
                  cardH={CARD_W * 1.3}
                />
              </View>
            )}
          />
        )}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },

  header: {
    position: 'absolute', left: 20, right: 20,
    zIndex: 20, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  headerTitleWrap: { flex: 1, alignItems: 'center' },
  headerTitle: {
    fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.55)',
    letterSpacing: 3.5,
  },

  heroBlock: {
    position: 'absolute', left: 0, right: 0,
    alignItems: 'center', paddingHorizontal: 28, zIndex: 5,
  },
  heroTimeLabel: {
    fontSize: 11, fontWeight: '500', color: 'rgba(255,255,255,0.6)',
    letterSpacing: 3, marginBottom: 10, textTransform: 'uppercase',
  },
  heroName: {
    fontSize: 36, fontWeight: '200', color: '#fff',
    letterSpacing: 0.8, textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8,
    marginBottom: 6,
  },
  heroSub: {
    fontSize: 13, fontWeight: '300', color: 'rgba(255,255,255,0.65)',
    letterSpacing: 0.5, textAlign: 'center', fontStyle: 'italic',
  },
  solarLivePill: {
    marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${GOLD}55`,
  },
  solarLiveText: {
    fontSize: 10, fontWeight: '700', color: GOLD, letterSpacing: 2,
  },

  applyWrap: {
    position: 'absolute', alignSelf: 'center', zIndex: 30,
  },
  applyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingHorizontal: 30, paddingVertical: 15,
    borderRadius: 99, overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 20, elevation: 12,
  },
  applyText: {
    fontSize: 15, fontWeight: '700', color: '#111', letterSpacing: 0.3,
  },

  toast: {
    position: 'absolute', alignSelf: 'center', zIndex: 999,
    borderRadius: 50, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  toastInner: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 18, paddingVertical: 11,
  },
  toastText: { fontSize: 13, fontWeight: '500', color: '#fff', letterSpacing: 0.3 },

  panel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    justifyContent: 'flex-end', zIndex: 10,
  },

  solarRow: {
    marginHorizontal: 20, marginBottom: 4,
    borderRadius: 18, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 14,
  },
  solarRowActive: { borderColor: `${GOLD}50` },
  solarIcon: { width: 36, alignItems: 'center' },
  solarText: { flex: 1 },
  solarTitle: { fontSize: 15, fontWeight: '600', color: '#fff', letterSpacing: 0.2 },
  solarDesc: { fontSize: 12, fontWeight: '400', color: 'rgba(255,255,255,0.45)', marginTop: 2 },

  switchTrack: {
    width: 44, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.15)',
    padding: 3, justifyContent: 'center',
  },
  switchTrackOn: { backgroundColor: GOLD },
  switchKnob: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2, shadowRadius: 2, elevation: 2,
  },
  switchKnobOff: { alignSelf: 'flex-start' },
  switchKnobOn: { alignSelf: 'flex-end' },

  catScroll: { paddingHorizontal: 20, gap: 10 },
  catPill: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  catPillActive: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    shadowColor: '#fff', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15, shadowRadius: 8,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  catText: { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.65)', letterSpacing: 0.2 },
  catTextActive: { color: '#111', fontWeight: '700' },
});
