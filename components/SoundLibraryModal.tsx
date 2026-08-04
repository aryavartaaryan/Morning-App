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

const { height: SCREEN_H } = Dimensions.get('window');

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
            <Ionicons name="play" size={11} color="rgba(255,255,255,0.22)" />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
});

// ─── Collection Pill ──────────────────────────────────────────────────────────
const CollectionPill = React.memo(function CollectionPill({
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
      style={[S.pill, isActive && { borderColor: group.themeColor + 'BB' }]}
    >
      {isActive && (
        <View
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: group.themeColor + '18', borderRadius: 11 },
          ]}
        />
      )}
      <View
        style={[
          S.pillDot,
          { backgroundColor: isActive ? group.themeColor : 'rgba(255,255,255,0.12)' },
        ]}
      />
      <Text
        style={[S.pillText, isActive && { color: '#fff', fontWeight: '600' }]}
        numberOfLines={1}
      >
        {group.title}
      </Text>
      <Text style={[S.pillCount, isActive && { color: group.themeColor }]}>
        {group.sounds.length}
      </Text>
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
  const rightPanelFade = useRef(new Animated.Value(1)).current;

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
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_H,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  // Crossfade right panel when switching collections
  const handleSelectGroup = useCallback(
    (id: string) => {
      if (id === activeId) { setActiveId(null); return; }
      // Instant fade out → swap → fade in
      Animated.timing(rightPanelFade, {
        toValue: 0,
        duration: 80,
        useNativeDriver: true,
      }).start(() => {
        setActiveId(id);
        Animated.timing(rightPanelFade, {
          toValue: 1,
          duration: 140,
          useNativeDriver: true,
        }).start();
      });
    },
    [activeId, rightPanelFade]
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

  // FlatList renderers — stable callbacks for perf
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

  const renderPillItem = useCallback(
    ({ item }: { item: DisplayGroup }) => (
      <CollectionPill
        group={item}
        isActive={activeId === item.id}
        onPress={() => handleSelectGroup(item.id)}
      />
    ),
    [activeId, handleSelectGroup]
  );

  const keyExtractor = useCallback((item: any) => item.id, []);

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={onClose}>
      {/* Backdrop */}
      <TouchableOpacity style={S.backdrop} activeOpacity={1} onPress={onClose} />

      <Animated.View style={[S.sheet, { transform: [{ translateY: slideAnim }] }]}>
        {/* Glass base */}
        <BlurView intensity={55} tint="dark" style={StyleSheet.absoluteFillObject} />
        <LinearGradient
          colors={['#0C0C0E', '#080809']}
          style={[StyleSheet.absoluteFillObject, { opacity: 0.97 }]}
        />

        <SafeAreaView style={S.safeArea}>
          {/* Handle */}
          <View style={S.handle} />

          {/* Header */}
          <View style={S.header}>
            <View>
              <Text style={S.headerTitle}>Nada Library</Text>
              <Text style={S.headerSub}>
                {filteredGroups.length} collections · {sounds.length} sounds
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={S.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={15} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={S.searchWrap}>
            <Ionicons
              name="search"
              size={14}
              color="rgba(255,255,255,0.3)"
              style={{ marginLeft: 13, marginRight: 9 }}
            />
            <TextInput
              style={S.searchInput}
              placeholder="Search sounds & collections…"
              placeholderTextColor="rgba(255,255,255,0.2)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 10 }}>
                <Ionicons name="close-circle" size={14} color="rgba(255,255,255,0.3)" />
              </TouchableOpacity>
            )}
          </View>

          <View style={S.mainDivider} />

          {/* ── Two-panel body ────────────────────────────────────────────── */}
          <View style={S.body}>

            {/* LEFT: collection list */}
            <View style={S.leftCol}>
              <FlatList
                data={filteredGroups}
                keyExtractor={keyExtractor}
                renderItem={renderPillItem}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={S.leftListContent}
                ListEmptyComponent={
                  <Text style={S.emptyText}>No results</Text>
                }
              />
            </View>

            {/* Separator */}
            <View style={S.colSep} />

            {/* RIGHT: sounds for selected collection */}
            <View style={S.rightCol}>
              {activeGroup ? (
                <Animated.View style={[{ flex: 1 }, { opacity: rightPanelFade }]}>
                  {/* Collection heading */}
                  <View style={S.rightHeader}>
                    <View
                      style={[S.rightHeaderDot, { backgroundColor: activeGroup.themeColor }]}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[S.rightHeaderTitle, { color: activeGroup.themeColor }]}
                        numberOfLines={1}
                      >
                        {activeGroup.title}
                      </Text>
                      {activeGroup.subtitle ? (
                        <Text style={S.rightHeaderSub} numberOfLines={1}>
                          {activeGroup.subtitle}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={S.rightHeaderCount}>{activeGroup.sounds.length}</Text>
                  </View>

                  <View style={S.mainDivider} />

                  {/* Sound list — FlatList so it scrolls independently and always renders */}
                  <FlatList
                    data={activeGroup.sounds}
                    keyExtractor={keyExtractor}
                    renderItem={renderSoundItem}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={S.rightListContent}
                    initialNumToRender={20}
                    maxToRenderPerBatch={20}
                    windowSize={10}
                    removeClippedSubviews={false}
                  />
                </Animated.View>
              ) : (
                /* Empty state */
                <View style={S.emptyState}>
                  <View style={S.emptyIcon}>
                    <Ionicons name="musical-note" size={20} color="rgba(255,255,255,0.15)" />
                  </View>
                  <Text style={S.emptyStateTitle}>Select a collection</Text>
                  <Text style={S.emptyStateDesc}>
                    Tap any collection on the left
                  </Text>
                </View>
              )}
            </View>

          </View>
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.70)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '90%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: -8 },
    elevation: 28,
  },
  safeArea: {
    flex: 1,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
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
    paddingTop: 14,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  headerSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.28)',
    marginTop: 2,
    letterSpacing: 0.3,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },

  // Search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 13,
    height: 37,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#FFF',
    paddingVertical: 0,
  },

  // Dividers
  mainDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  colSep: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },

  // Body
  body: {
    flex: 1,
    flexDirection: 'row',
  },

  // Left column
  leftCol: {
    width: 148,
  },
  leftListContent: {
    paddingHorizontal: 8,
    paddingVertical: 10,
    paddingBottom: 50,
  },

  // Right column — MUST be flex: 1 so FlatList can size itself
  rightCol: {
    flex: 1,
  },
  rightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  rightHeaderDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 9,
    flexShrink: 0,
  },
  rightHeaderTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  rightHeaderSub: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.32)',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  rightHeaderCount: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.28)',
    marginLeft: 6,
  },
  rightListContent: {
    paddingBottom: 60,
  },

  // Collection pill
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.055)',
    overflow: 'hidden',
  },
  pillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
    flexShrink: 0,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.5)',
    flex: 1,
    letterSpacing: 0.1,
  },
  pillCount: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.22)',
    fontWeight: '500',
    marginLeft: 4,
  },

  // Sound row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 14,
    minHeight: 48,
  },
  rowActive: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  playingBar: {
    width: 2.5,
    alignSelf: 'stretch',
    borderRadius: 2,
    marginLeft: 8,
    marginRight: 3,
    marginVertical: 8,
    flexShrink: 0,
  },
  rowEmoji: {
    fontSize: 15,
    width: 30,
    textAlign: 'center',
    marginLeft: 4,
  },
  rowBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    marginLeft: 8,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  rowTitle: {
    fontSize: 13.5,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.78)',
    letterSpacing: 0.1,
    marginBottom: 1,
  },
  rowDesc: {
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.3)',
  },
  playBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },

  // Empty states
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  emptyStateTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.35)',
    marginBottom: 5,
  },
  emptyStateDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.18)',
    textAlign: 'center',
    lineHeight: 17,
  },
  emptyText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.28)',
    textAlign: 'center',
    marginTop: 20,
  },
});
