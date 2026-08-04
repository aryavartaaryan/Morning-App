import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  Animated,
  TextInput,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────────────
type DisplayGroup = {
  id: string;
  title: string;
  subtitle?: string;
  themeColor: string;
  sounds: any[];
};

// ─── Playing Pulse Dots ───────────────────────────────────────────────────────
function PlayingPulse({ color }: { color: string }) {
  const a1 = useRef(new Animated.Value(0.3)).current;
  const a2 = useRef(new Animated.Value(0.6)).current;
  const a3 = useRef(new Animated.Value(1.0)).current;

  useEffect(() => {
    const pulse = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 1, duration: 380, delay, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.2, duration: 380, useNativeDriver: true }),
        ])
      );
    const a = pulse(a1, 0);
    const b = pulse(a2, 127);
    const c = pulse(a3, 254);
    a.start(); b.start(); c.start();
    return () => { a.stop(); b.stop(); c.stop(); };
  }, []);

  const bar = (v: Animated.Value) => ({
    width: 3,
    height: 13,
    borderRadius: 2,
    backgroundColor: color,
    marginHorizontal: 1.5,
    opacity: v,
  });

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 14, height: 20 }}>
      <Animated.View style={bar(a1)} />
      <Animated.View style={bar(a2)} />
      <Animated.View style={bar(a3)} />
    </View>
  );
}

// ─── Sound Row ────────────────────────────────────────────────────────────────
const SoundRow = React.memo(function SoundRow({
  sound,
  isPlaying,
  onPress,
  isLast,
}: {
  sound: any;
  isPlaying: boolean;
  onPress: () => void;
  isLast: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      activeOpacity={0.65}
      style={[S.row, isPlaying && S.rowActive]}
    >
      {/* Left edge playing indicator */}
      <View
        style={[
          S.playingBar,
          { backgroundColor: isPlaying ? sound.color || '#fff' : 'transparent' },
        ]}
      />

      <Text style={S.rowEmoji}>{sound.emoji || '🎵'}</Text>

      <View style={[S.rowBody, !isLast && S.rowDivider, isPlaying && { borderBottomColor: 'transparent' }]}>
        <View style={{ flex: 1 }}>
          <Text
            style={[S.rowTitle, isPlaying && { color: sound.color || '#FFFFFF', fontWeight: '500' }]}
            numberOfLines={1}
          >
            {sound.label}
          </Text>
          {sound.desc ? (
            <Text style={S.rowDesc} numberOfLines={1}>
              {sound.desc}
            </Text>
          ) : null}
        </View>

        {isPlaying ? (
          <PlayingPulse color={sound.color || '#fff'} />
        ) : (
          <View style={S.playBtn}>
            <Ionicons name="play" size={12} color="rgba(255,255,255,0.4)" />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
});

// ─── Horizontal Collection Pill ───────────────────────────────────────────────
const HorizontalCollectionPill = React.memo(function HorizontalCollectionPill({
  group,
  isActive,
  onPress,
}: {
  group: DisplayGroup;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      activeOpacity={0.7}
      style={[S.hPill, isActive && { borderColor: group.themeColor + 'BB', backgroundColor: group.themeColor + '18' }]}
    >
      <View
        style={[
          S.pillDot,
          { backgroundColor: isActive ? group.themeColor : 'rgba(255,255,255,0.15)' },
        ]}
      />
      <Text
        style={[S.hPillText, isActive && { color: '#fff', fontWeight: '600' }]}
      >
        {group.title}
      </Text>
    </TouchableOpacity>
  );
});

// ─── Collection Grid Card (Discovery Mode) ────────────────────────────────────
const CollectionGridCard = React.memo(function CollectionGridCard({
  group,
  onPress,
}: {
  group: DisplayGroup;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      activeOpacity={0.7}
      style={S.gridCard}
    >
      <LinearGradient
        colors={['rgba(255,255,255,0.03)', 'rgba(255,255,255,0.01)']}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={S.gridCardHeader}>
        <View style={[S.gridCardDot, { backgroundColor: group.themeColor }]} />
        <Text style={S.gridCardCount}>{group.sounds.length} sounds</Text>
      </View>
      <View style={{ marginTop: 12 }}>
        <Text style={S.gridCardTitle} numberOfLines={2}>{group.title}</Text>
        {group.subtitle ? (
          <Text style={[S.gridCardSub, { color: group.themeColor + 'CC' }]} numberOfLines={1}>{group.subtitle}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
});

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SoundLibraryModal({
  visible,
  onClose,
  sounds,
  collections,
  playingId,
  onPlaySound,
  initialCategory,
}: {
  visible: boolean;
  onClose: () => void;
  sounds: any[];
  collections?: any[];
  playingId: string | null;
  onPlaySound: (id: string) => void;
  initialCategory?: string | null;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const slideAnim = useRef(new Animated.Value(SCREEN_H)).current;
  
  // Animation for crossfading between discovery and focus modes
  const modeFade = useRef(new Animated.Value(1)).current;
  
  // Ref for horizontal scroll list to auto-scroll to active item
  const horizontalListRef = useRef<FlatList>(null);

  // Sheet open/close animation
  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        damping: 26,
        stiffness: 240,
        mass: 0.85,
        useNativeDriver: true,
      }).start();
      setActiveId(initialCategory ?? null);
      setSearchQuery('');
      modeFade.setValue(1);
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_H,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  // Smooth mode transition
  const handleSelectGroup = useCallback(
    (id: string | null) => {
      if (id === activeId) return;
      
      Animated.timing(modeFade, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }).start(() => {
        setActiveId(id);
        Animated.timing(modeFade, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }).start();
      });
    },
    [activeId, modeFade]
  );

  // Build display groups
  const displayGroups = useMemo((): DisplayGroup[] => {
    if (collections && collections.length > 0) {
      return collections.map(col => ({
        id: col.id,
        title: col.title,
        subtitle: col.subtitle,
        themeColor: col.themeColor || '#FFFFFF',
        sounds: col.soundIds
          .map((id: string) => sounds.find(s => s.id === id))
          .filter(Boolean),
      }));
    }
    const cats = new Set<string>();
    sounds.forEach(s => { if (s.cat) cats.add(s.cat); });
    return Array.from(cats).sort().map(cat => ({
      id: cat,
      title: cat,
      subtitle: undefined,
      themeColor: '#FFFFFF',
      sounds: sounds.filter(s => s.cat === cat),
    }));
  }, [collections, sounds]);

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return displayGroups;
    const q = searchQuery.toLowerCase();
    return displayGroups
      .map(g => {
        if (g.title.toLowerCase().includes(q)) return g;
        const ms = g.sounds.filter(
          (s: any) =>
            s.label?.toLowerCase().includes(q) || s.desc?.toLowerCase().includes(q)
        );
        return ms.length > 0 ? { ...g, sounds: ms } : null;
      })
      .filter(Boolean) as DisplayGroup[];
  }, [displayGroups, searchQuery]);

  const activeGroup = filteredGroups.find(g => g.id === activeId) ?? null;

  // Renderers
  const renderSoundItem = useCallback(
    ({ item, index }: { item: any; index: number }) => (
      <SoundRow
        sound={item}
        isPlaying={playingId === item.id}
        onPress={() => onPlaySound(item.id)}
        isLast={index === (activeGroup?.sounds.length ?? 0) - 1}
      />
    ),
    [playingId, onPlaySound, activeGroup?.sounds.length]
  );

  const renderHorizontalPill = useCallback(
    ({ item }: { item: DisplayGroup }) => (
      <HorizontalCollectionPill
        group={item}
        isActive={activeId === item.id}
        onPress={() => handleSelectGroup(item.id)}
      />
    ),
    [activeId, handleSelectGroup]
  );
  
  const renderGridCard = useCallback(
    ({ item }: { item: DisplayGroup }) => (
      <CollectionGridCard
        group={item}
        onPress={() => handleSelectGroup(item.id)}
      />
    ),
    [handleSelectGroup]
  );

  const keyExtractor = useCallback((item: any) => item.id, []);
  
  // Auto-scroll horizontal strip to active item
  useEffect(() => {
    if (activeId && horizontalListRef.current) {
      const idx = filteredGroups.findIndex(g => g.id === activeId);
      if (idx >= 0) {
        setTimeout(() => {
          horizontalListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
        }, 100);
      }
    }
  }, [activeId, filteredGroups]);

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={onClose}>
      {/* Backdrop */}
      <TouchableOpacity style={S.backdrop} activeOpacity={1} onPress={onClose} />

      <Animated.View style={[S.sheet, { transform: [{ translateY: slideAnim }] }]}>
        {/* Glass base */}
        <BlurView intensity={55} tint="dark" style={StyleSheet.absoluteFillObject} />
        <LinearGradient
          colors={['#0A0A0C', '#050505']}
          style={[StyleSheet.absoluteFillObject, { opacity: 0.96 }]}
        />

        <SafeAreaView style={S.safeArea}>
          {/* Handle */}
          <View style={S.handle} />

          {/* Header */}
          <View style={S.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {activeId ? (
                <TouchableOpacity onPress={() => handleSelectGroup(null)} style={S.backBtn} activeOpacity={0.7}>
                  <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.8)" />
                </TouchableOpacity>
              ) : null}
              <View>
                <Text style={S.headerTitle}>Nada Library</Text>
                <Text style={S.headerSub}>
                  {filteredGroups.length} collections · {sounds.length} sounds
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={S.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={16} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={S.searchWrap}>
            <Ionicons
              name="search"
              size={15}
              color="rgba(255,255,255,0.3)"
              style={{ marginLeft: 14, marginRight: 10 }}
            />
            <TextInput
              style={S.searchInput}
              placeholder="Search sounds & collections…"
              placeholderTextColor="rgba(255,255,255,0.25)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 10 }}>
                <Ionicons name="close-circle" size={15} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            )}
          </View>

          <View style={S.mainDivider} />

          {/* Dynamic Body */}
          <Animated.View style={[{ flex: 1 }, { opacity: modeFade }]}>
            {activeGroup ? (
              /* Focus Mode: Horizontal Strip + Sound List */
              <View style={{ flex: 1 }}>
                <View>
                  <FlatList
                    ref={horizontalListRef}
                    data={filteredGroups}
                    keyExtractor={keyExtractor}
                    renderItem={renderHorizontalPill}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={S.horizontalStripContent}
                    onScrollToIndexFailed={() => {}}
                  />
                  <View style={S.mainDivider} />
                </View>
                
                <View style={S.collectionTitleHeader}>
                   <View style={[S.largeDot, { backgroundColor: activeGroup.themeColor }]} />
                   <View style={{ flex: 1 }}>
                     <Text style={S.collectionTitleText} numberOfLines={1}>{activeGroup.title}</Text>
                     {activeGroup.subtitle ? (
                       <Text style={[S.collectionSubText, { color: activeGroup.themeColor }]} numberOfLines={1}>{activeGroup.subtitle}</Text>
                     ) : null}
                   </View>
                   <Text style={S.collectionCountText}>{activeGroup.sounds.length} sounds</Text>
                </View>

                <FlatList
                  data={activeGroup.sounds}
                  keyExtractor={keyExtractor}
                  renderItem={renderSoundItem}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={S.rightListContent}
                  initialNumToRender={20}
                  maxToRenderPerBatch={20}
                  windowSize={10}
                />
              </View>
            ) : (
              /* Discovery Mode: Wide Collection Grid */
              <FlatList
                data={filteredGroups}
                keyExtractor={keyExtractor}
                renderItem={renderGridCard}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={S.gridContent}
                numColumns={SCREEN_W > 600 ? 2 : 1}
                ListEmptyComponent={
                  <View style={S.emptyState}>
                    <View style={S.emptyIcon}>
                      <Ionicons name="musical-note" size={24} color="rgba(255,255,255,0.15)" />
                    </View>
                    <Text style={S.emptyStateTitle}>No results found</Text>
                    <Text style={S.emptyStateDesc}>Try searching for a different keyword</Text>
                  </View>
                }
              />
            )}
          </Animated.View>
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '92%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 50,
    shadowOffset: { width: 0, height: -10 },
    elevation: 30,
  },
  safeArea: {
    flex: 1,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
  },
  backBtn: {
    marginRight: 12,
    padding: 4,
    marginLeft: -4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.1,
  },
  headerSub: {
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 2,
    letterSpacing: 0.2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },

  // Search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 14,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#FFF',
    paddingVertical: 0,
  },

  // Dividers
  mainDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  // Discovery Mode Grid
  gridContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 60,
  },
  gridCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
    marginHorizontal: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  gridCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gridCardDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  gridCardCount: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    fontWeight: '500',
  },
  gridCardTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  gridCardSub: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Focus Mode Horizontal Strip
  horizontalStripContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  hPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 4,
  },
  pillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
  },
  hPillText: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.1,
  },
  
  // Focus Mode Collection Header
  collectionTitleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  largeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 14,
  },
  collectionTitleText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.1,
  },
  collectionSubText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 3,
  },
  collectionCountText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.3)',
    fontWeight: '500',
  },

  // Sound row
  rightListContent: {
    paddingBottom: 80,
    paddingTop: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    minHeight: 52,
  },
  rowActive: {
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  playingBar: {
    width: 3,
    alignSelf: 'stretch',
    borderRadius: 2,
    marginRight: 10,
    marginVertical: 10,
  },
  rowEmoji: {
    fontSize: 17,
    width: 30,
    textAlign: 'center',
    marginRight: 4,
  },
  rowBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  rowTitle: {
    fontSize: 14.5,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.1,
    marginBottom: 2,
  },
  rowDesc: {
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.35)',
  },
  playBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    marginLeft: 10,
  },

  // Empty states
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginTop: 60,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 6,
  },
  emptyStateDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.2)',
    textAlign: 'center',
  },
});
