import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, FlatList,
  Dimensions, StatusBar, Animated, BackHandler, Pressable
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';

import { useBgContext, BG_KEYS, BG_META, type BgKey, getTimedBgKey } from '@/lib/bgContext';
import { getBgSourceSync, getBgSource } from '@/lib/bgImages';

// ─── Utilities ────────────────────────────────────────────────────────────────
const { width, height } = Dimensions.get('window');
const GOLD = '#F5A623';
const CARD_W = (width - 48) / 3.2; // Smaller, more elegant cards for a premium slider
const CARD_H = CARD_W * 1.8;       // Taller aspect ratio for modern feel

const getCategoryOfKey = (key: string): 'morning' | 'day' | 'sunset' | 'night' => {
  if (key.includes('morning') || key.includes('predawn') || key.includes('sunrise') || key.includes('brahma')) return 'morning';
  if (key.includes('day') || key.includes('noon')) return 'day';
  if (key.includes('sunset') || key.includes('golden') || key.includes('dusk')) return 'sunset';
  return 'night';
};

const CATEGORIES = [
  { id: 'all',     label: 'All' },
  { id: 'morning', label: 'Morning' },
  { id: 'day',     label: 'Day' },
  { id: 'sunset',  label: 'Sunset' },
  { id: 'night',   label: 'Night' },
];

// ─── AsyncWallpaperImage ──────────────────────────────────────────────────────
function AsyncWallpaperImage({ bgKey }: { bgKey: string }) {
  const [imgUri, setImgUri] = React.useState<string | null>(() => getBgSourceSync(bgKey));
  React.useEffect(() => {
    let mounted = true;
    getBgSource(bgKey).then(uri => { if (mounted && uri) setImgUri(uri); });
    return () => { mounted = false; };
  }, [bgKey]);
  if (!imgUri || imgUri.length < 5)
    return <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#050505' }]} />;
  return (
    <Image
      source={{ uri: imgUri }}
      style={StyleSheet.absoluteFillObject}
      contentFit="cover"
      transition={200}
      cachePolicy="memory-disk"
    />
  );
}

// ─── WallpaperCard ────────────────────────────────────────────────────────────
const WallpaperCard = React.memo(({
  bgKey, isSelected, isActive, isSolar, onPress, cardW, cardH
}: {
  bgKey: string; isSelected: boolean; isActive: boolean; isSolar: boolean;
  onPress: () => void; cardW: number; cardH: number;
}) => {
  const selectAnim = useRef(new Animated.Value(isSelected ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(selectAnim, { toValue: isSelected ? 1 : 0, useNativeDriver: true, tension: 160, friction: 12 }).start();
  }, [isSelected]);

  const scale = selectAnim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });
  const opacity = selectAnim.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });

  return (
    <Pressable onPress={onPress} style={{ marginHorizontal: 6 }}>
      <Animated.View style={{ width: cardW, height: cardH, borderRadius: 16, transform: [{ scale }], opacity }}>
        <View style={[StyleSheet.absoluteFillObject, { borderRadius: 16, overflow: 'hidden' }]}>
          <AsyncWallpaperImage bgKey={bgKey} />
          
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.6)']}
            locations={[0.5, 1]}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />

          {/* Selection Crisp Border */}
          <Animated.View style={[
            StyleSheet.absoluteFillObject, 
            { borderRadius: 16, borderWidth: 1.5, borderColor: '#fff', opacity: selectAnim }
          ]} />

          {/* Active Checkmark */}
          {isActive && (
            <View style={CS.activeBadge}>
              <BlurView intensity={70} tint="light" style={StyleSheet.absoluteFillObject} />
              <Ionicons name="checkmark" size={10} color="#000" />
            </View>
          )}

          {/* Solar indicator */}
          {isSolar && (
            <View style={CS.solarBadge}>
              <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFillObject} />
              <Text style={{ fontSize: 10 }}>☀️</Text>
            </View>
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
});

const CS = StyleSheet.create({
  activeBadge: {
    position: 'absolute', top: 8, right: 8,
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  solarBadge: {
    position: 'absolute', top: 8, left: 8,
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function WallpaperSettings() {
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const isMounted = useRef(true);

  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { router.back(); return true; });
    return () => sub.remove();
  }, [router]));

  const { wallpaperMode, manualBgKey, setWallpaperMode, setManualBgKey, bgKey, solarTimes } = useBgContext();
  const isSolar = wallpaperMode === 'solar';
  const actualActiveBgKey = wallpaperMode === 'manual' ? manualBgKey : bgKey;

  const [activeCategory, setActiveCategory] = useState<'all' | 'morning' | 'day' | 'sunset' | 'night'>('all');
  const [previewKey, setPreviewKey]         = useState<BgKey>(actualActiveBgKey as BgKey);
  const [heroKey, setHeroKey]               = useState<BgKey>(actualActiveBgKey as BgKey);
  const [toastVisible, setToastVisible]     = useState(false);
  const [toastMsg, setToastMsg]             = useState('');
  const [dynamicTimes, setDynamicTimes]     = useState<Partial<Record<BgKey, string>>>({});

  // Animations
  const heroAnim  = useRef(new Animated.Value(1)).current;
  const applyAnim = useRef(new Animated.Value(0)).current;
  const toastAnim = useRef(new Animated.Value(0)).current;
  const panelAnim = useRef(new Animated.Value(60)).current;
  const panelOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    isMounted.current = true;
    Animated.parallel([
      Animated.spring(panelAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 14, delay: 50 }),
      Animated.timing(panelOpacity, { toValue: 1, duration: 500, useNativeDriver: true, delay: 50 }),
    ]).start();
    return () => { isMounted.current = false; };
  }, []);

  // Sync solar
  useEffect(() => {
    if (isSolar && bgKey) changePreview(bgKey as BgKey);
  }, [isSolar, bgKey]);

  // Dynamic time labels
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
      if (mm === 60) { hh += 1; mm = 0; } hh = hh % 24;
      const ap = hh >= 12 ? 'PM' : 'AM';
      const dh = hh % 12 === 0 ? 12 : hh % 12;
      const dm = mm.toString().padStart(2, '0');
      return dm === '00' ? `${dh} ${ap}` : `${dh}:${dm} ${ap}`;
    };
    const res: Partial<Record<BgKey, string>> = {};
    for (const k of BG_KEYS) { if (map[k]) res[k] = `${fmt(map[k]!.start)} – ${fmt(map[k]!.end)}`; }
    setDynamicTimes(res);
  }, [solarTimes]);

  // Apply button show/hide
  const isPreviewingActive = previewKey === actualActiveBgKey;
  useEffect(() => {
    Animated.timing(applyAnim, { 
      toValue: isPreviewingActive ? 0 : 1, 
      duration: 200, 
      useNativeDriver: true 
    }).start();
  }, [isPreviewingActive]);

  const changePreview = (newKey: BgKey) => {
    setPreviewKey(newKey); // instant image crossfade
    Animated.timing(heroAnim, { toValue: 0, duration: 110, useNativeDriver: true }).start(() => {
      setHeroKey(newKey);
      Animated.timing(heroAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    });
  };

  const showToast = (msg: string) => {
    setToastMsg(msg); setToastVisible(true);
    toastAnim.setValue(0);
    Animated.sequence([
      Animated.spring(toastAnim, { toValue: 1, useNativeDriver: true, tension: 100, friction: 10 }),
      Animated.delay(1800),
      Animated.timing(toastAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => { if (isMounted.current) setToastVisible(false); });
  };

  const handleApply = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setWallpaperMode('manual');
    setManualBgKey(previewKey);
    showToast('Wallpaper applied');
  };

  const handleToggleSolar = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isSolar) {
      setWallpaperMode('manual');
      setManualBgKey(previewKey);
      showToast('Switched to Manual');
    } else {
      setWallpaperMode('solar');
      changePreview(bgKey as BgKey);
      showToast('Auto-Solar Active');
    }
  };

  const filteredKeys = BG_KEYS.filter(k =>
    activeCategory === 'all' ? true : getCategoryOfKey(k) === activeCategory
  );

  const heroMeta = (BG_META as any)[heroKey] ?? (BG_META as any)[BG_KEYS[0]];

  const renderCard = ({ item: key }: { item: string }) => (
    <WallpaperCard
      key={key}
      bgKey={key}
      isSelected={key === previewKey}
      isActive={key === actualActiveBgKey}
      isSolar={isSolar && key === bgKey}
      onPress={() => { if (key !== previewKey) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); changePreview(key as BgKey); } }}
      cardW={CARD_W}
      cardH={CARD_H}
    />
  );

  const TOP = Math.max(insets.top + 8, 24);

  return (
    <View style={S.screen}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── Background ── */}
      <View style={StyleSheet.absoluteFillObject}>
        <AsyncWallpaperImage bgKey={previewKey} />
      </View>

      {/* ── Extreme minimalist cinematic gradient ── */}
      <LinearGradient
        colors={['rgba(0,0,0,0.55)', 'transparent', 'transparent', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.95)']}
        locations={[0, 0.2, 0.45, 0.75, 1]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      {/* ── Header ── */}
      <View style={[S.header, { top: TOP }]}>
        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
          style={S.headerIcon}
          hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
        >
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>

        {/* Set Button seamlessly integrated into Top Right */}
        <Animated.View style={{ opacity: applyAnim, pointerEvents: isPreviewingActive ? 'none' : 'auto' }}>
          <TouchableOpacity onPress={handleApply} activeOpacity={0.8} style={S.setBtn}>
            <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFillObject} />
            <Text style={S.setText}>Set</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* ── Hero Typography ── */}
      <Animated.View style={[
        S.hero, { top: TOP + 80 },
        { opacity: heroAnim, transform: [{ translateY: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }
      ]}>
        {dynamicTimes[heroKey] ? (
          <View style={S.timeChip}>
            <BlurView intensity={15} tint="dark" style={StyleSheet.absoluteFillObject} />
            <Text style={S.timeChipText}>{dynamicTimes[heroKey]}</Text>
          </View>
        ) : null}
        <Text style={S.heroName}>{heroMeta?.label ?? ''}</Text>
        {heroMeta?.sub && (
          <Text style={S.heroSub}>{heroMeta?.sub}</Text>
        )}
        {isSolar && previewKey === bgKey && (
          <View style={S.livePill}>
            <View style={S.liveDot} />
            <Text style={S.liveText}>AUTO-SOLAR</Text>
          </View>
        )}
      </Animated.View>

      {/* ── Toast ── */}
      {toastVisible && (
        <Animated.View style={[
          S.toast, { top: TOP + 40 },
          { opacity: toastAnim, transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }] }
        ]}>
          <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFillObject} />
          <Text style={S.toastText}>{toastMsg}</Text>
        </Animated.View>
      )}

      {/* ── Bottom Panel ── */}
      <Animated.View style={[
        S.panel, { paddingBottom: Math.max(insets.bottom + 8, 20) },
        { transform: [{ translateY: panelAnim }], opacity: panelOpacity }
      ]}>

        {/* Action Bar (Solar Toggle) */}
        <View style={S.actionBar}>
          <TouchableOpacity
            onPress={handleToggleSolar}
            activeOpacity={0.8}
            style={[S.solarPill, isSolar && S.solarPillOn]}
          >
            <BlurView intensity={isSolar ? 40 : 20} tint="dark" style={StyleSheet.absoluteFillObject} />
            <Ionicons name={isSolar ? "sunny" : "contrast-outline"} size={14} color={isSolar ? GOLD : 'rgba(255,255,255,0.8)'} />
            <Text style={[S.solarPillText, isSolar && S.solarPillTextOn]}>
              {isSolar ? 'Auto-Solar Active' : 'Enable Auto-Solar'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Minimal Categories */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={S.catRow}
        >
          {CATEGORIES.map(cat => {
            const on = activeCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveCategory(cat.id as any); }}
                activeOpacity={0.8}
                style={S.catItem}
              >
                <Text style={[S.catText, on && S.catTextOn]}>{cat.label.toUpperCase()}</Text>
                {on && <View style={S.catDot} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Cards */}
        <FlatList
          data={filteredKeys}
          horizontal
          keyExtractor={item => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 18 }}
          snapToInterval={CARD_W + 12}
          decelerationRate="fast"
          style={{ height: CARD_H + 8 }}
          initialNumToRender={100}
          maxToRenderPerBatch={100}
          windowSize={100}
          removeClippedSubviews={false}
          renderItem={renderCard}
        />
      </Animated.View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },

  // Header
  header: {
    position: 'absolute', left: 24, right: 24, zIndex: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerIcon: {
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  setBtn: {
    paddingHorizontal: 18, paddingVertical: 8,
    borderRadius: 20, overflow: 'hidden',
  },
  setText: {
    fontSize: 13, fontWeight: '700', color: '#111', letterSpacing: 0.3,
  },

  // Hero
  hero: {
    position: 'absolute', left: 0, right: 0, zIndex: 5,
    alignItems: 'center', paddingHorizontal: 24,
  },
  timeChip: {
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 14, overflow: 'hidden',
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.1)',
  },
  timeChipText: {
    fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.7)',
    letterSpacing: 2.5, textTransform: 'uppercase',
  },
  heroName: {
    fontSize: 48, fontWeight: '200', color: '#fff',
    letterSpacing: 0.5, textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 16,
    marginBottom: 8,
  },
  heroSub: {
    fontSize: 14, fontWeight: '300', color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.5, textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8,
  },
  livePill: {
    marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: GOLD, shadowColor: GOLD, shadowOpacity: 0.8, shadowRadius: 4 },
  liveText: { fontSize: 10, fontWeight: '700', color: GOLD, letterSpacing: 2 },

  // Toast
  toast: {
    position: 'absolute', alignSelf: 'center', zIndex: 999,
    paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: 20, overflow: 'hidden',
  },
  toastText: { fontSize: 12, fontWeight: '600', color: '#111', letterSpacing: 0.3 },

  // Bottom Panel
  panel: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10,
  },

  // Action Bar
  actionBar: {
    flexDirection: 'row', justifyContent: 'center', marginBottom: 24,
  },
  solarPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: 24, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.1)',
  },
  solarPillOn: { borderColor: `${GOLD}50` },
  solarPillText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.8)', letterSpacing: 0.5 },
  solarPillTextOn: { color: GOLD },

  // Categories
  catRow: { paddingHorizontal: 24, gap: 24, marginBottom: 20 },
  catItem: { alignItems: 'center' },
  catText: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.4)', letterSpacing: 1.5 },
  catTextOn: { color: '#fff', fontWeight: '800' },
  catDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#fff', marginTop: 4 },
});
