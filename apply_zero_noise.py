import re

with open('/Users/hotelnamastebharatinn/Desktop/Morning-App/app/wallpaper.tsx', 'r') as f:
    content = f.read()

# Replace the component and styles
regex = r"(export default function WallpaperSettings\(\) \{)([\s\S]*?)(\nconst styles = StyleSheet\.create\(\{[\s\S]*\}\);\n?)$"

new_func_and_styles = """export default function WallpaperSettings() {
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

  const actualActiveBgKey = wallpaperMode === 'manual' ? manualBgKey : bgKey;
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
      setPreviewBgKey(bgKey as BgKey); 
      showToast('Auto-Solar Active', 'success');
    }
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
        colors={['rgba(0,0,0,0.6)', 'transparent', 'transparent', 'rgba(0,0,0,0.85)', '#000']}
        locations={[0, 0.15, 0.5, 0.85, 1]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      {/* 3. Absolute Header (Top Left) */}
      <View style={[styles.headerAbs, { top: Math.max(insets.top, 20) }]}>
        <TouchableOpacity 
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.navigate('/(tabs)');
          }}
          style={styles.backButton}
        >
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
          <Ionicons name="chevron-back" size={24} color="rgba(255,255,255,0.9)" />
        </TouchableOpacity>
      </View>

      {/* 4. Absolute Hero Typography (Refined, Medium Sized, Elegant) */}
      <View style={[styles.centerHeroAbs, { top: Math.max(insets.top, 20) + 60 }]}>
        <Text style={styles.heroTime}>{dynamicTimes[previewBgKey] || previewMeta.time}</Text>
        <Text style={styles.heroName}>{previewMeta.label}</Text>
        <Text style={styles.heroSub}>{previewMeta.emoji} {previewMeta.sub}</Text>
      </View>

      {/* 5. Absolute Floating Apply Button (Clean Glass) */}
      {!isPreviewingActive && (
        <View style={styles.applyContainerAbs}>
          <TouchableOpacity activeOpacity={0.8} onPress={handleApply} style={styles.applyBtn}>
            <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFillObject} />
            <Ionicons name="color-wand-outline" size={18} color="#111" />
            <Text style={styles.applyText}>Apply Wallpaper</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Toast Notification */}
      {toast.visible && (
        <Animated.View style={[styles.toastBanner, { top: insets.top + 70 }]}>
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12 }}>
            <Ionicons name={toast.type === 'success' ? 'checkmark-circle-outline' : 'information-circle-outline'} size={18} color="#fff" />
            <Text style={{ fontSize: 13, fontWeight: '400', color: '#fff', letterSpacing: 0.5 }}>{toast.message}</Text>
          </View>
        </Animated.View>
      )}

      {/* 6. The UI Controls (Floating flawlessly at the bottom) */}
      <View style={[styles.controlsContainer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        
        {/* Borderless Ultra-Sleek Auto-Solar Row */}
        <View style={styles.solarRow}>
          <View style={styles.solarTextGroup}>
            <Text style={styles.solarCardTitle}>Auto-Solar Sync</Text>
            <Text style={styles.solarCardDesc}>
              {wallpaperMode === 'solar' 
                ? 'Matches your local sky'
                : 'Pinned to a specific time'}
            </Text>
          </View>
          <TouchableOpacity 
            activeOpacity={0.8}
            onPress={handleToggleSolar}
            style={[styles.customSwitchTrack, wallpaperMode === 'solar' && styles.customSwitchTrackActive]}
          >
            <View style={[styles.customSwitchKnob, wallpaperMode === 'solar' ? styles.customSwitchKnobActive : styles.customSwitchKnobInactive]} />
          </TouchableOpacity>
        </View>

        {/* Categories (Ultra minimal text dots) */}
        <View style={{ marginBottom: 20 }}>
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
        </View>

        {/* Horizontal Slider (2 items visible perfectly, frictionless) */}
        <View style={styles.carouselWrapper}>
          <FlatList
            data={filteredKeys}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={width - 24} // 2 items pagination
            decelerationRate="fast"
            keyExtractor={(item: string) => item}
            contentContainerStyle={styles.carouselScroll}
            renderItem={({ item: key }: { item: string }) => {
              const isSelected = key === previewBgKey;
              const isActive = key === actualActiveBgKey;
              const isCurrentSolar = wallpaperMode === 'solar' && key === bgKey;

              return (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setPreviewBgKey(key as BgKey);
                  }}
                  style={[
                    styles.thumbnailCard,
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
            }}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  headerAbs: {
    position: 'absolute',
    left: 20,
    zIndex: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 3,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  heroName: {
    fontSize: 28, // Medium sized, not too big
    fontWeight: '300',
    color: '#fff',
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  heroSub: {
    fontSize: 14,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 0.5,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  toastBanner: {
    position: 'absolute',
    alignSelf: 'center',
    borderRadius: 99,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 999,
  },
  applyContainerAbs: {
    position: 'absolute',
    bottom: height * 0.45, // Hover beautifully above controls
    alignSelf: 'center',
    zIndex: 20,
  },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 99,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  applyText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
    letterSpacing: 0.2,
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: height * 0.42,
    justifyContent: 'flex-end',
    zIndex: 10,
  },
  solarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    marginBottom: 24,
  },
  solarTextGroup: {
    flex: 1,
  },
  solarCardTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
    letterSpacing: 0.2,
    marginBottom: 2,
  },
  solarCardDesc: {
    fontSize: 12,
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
    paddingHorizontal: 32,
    gap: 32,
  },
  categoryTab: {
    alignItems: 'center',
    paddingBottom: 4,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.5,
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
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  carouselWrapper: {
    height: 180, // refined height for the cards
  },
  carouselScroll: {
    paddingHorizontal: 20,
  },
  thumbnailCard: {
    width: (width - 40 - 12) / 2,
    height: '100%',
    marginHorizontal: 6,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  thumbnailCardSelected: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.9)',
    transform: [{ scale: 1.02 }],
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }
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

content = re.sub(regex, "\\1\n" + new_func_and_styles, content)

with open('/Users/hotelnamastebharatinn/Desktop/Morning-App/app/wallpaper.tsx', 'w') as f:
    f.write(content)

print("Zero noise redesign applied.")
