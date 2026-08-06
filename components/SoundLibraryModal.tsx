import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
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

// ─── Animated Sound Row ───────────────────────────────────────────────────────
function SoundRow({
  sound,
  isPlaying,
  onPress,
  isLast,
  index,
}: {
  sound: any;
  isPlaying: boolean;
  onPress: () => void;
  isLast?: boolean;
  index: number;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(6)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        delay: index * 30,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 180,
        delay: index * 30,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <TouchableOpacity
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        activeOpacity={0.65}
        style={[S.row, isPlaying && { backgroundColor: 'rgba(255,255,255,0.04)' }]}
      >
        {/* Left: playing indicator bar */}
        <View style={[S.playingBar, { backgroundColor: isPlaying ? (sound.color || '#fff') : 'transparent' }]} />

        <Text style={S.rowEmoji}>{sound.emoji || '🎵'}</Text>

        <View style={[S.rowBody, !isLast && S.rowDivider]}>
          <View style={{ flex: 1 }}>
            <Text
              style={[S.rowTitle, isPlaying && { color: sound.color || '#FFFFFF' }]}
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
              <Ionicons name="play" size={11} color="rgba(255,255,255,0.25)" />
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Playing Pulse Dots ───────────────────────────────────────────────────────
function PlayingPulse({ color }: { color: string }) {
  const a1 = useRef(new Animated.Value(0.3)).current;
  const a2 = useRef(new Animated.Value(0.6)).current;
  const a3 = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 1, duration: 400, delay, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        ])
      );
    pulse(a1, 0).start();
    pulse(a2, 133).start();
    pulse(a3, 266).start();
  }, []);

  const barStyle = (v: Animated.Value) => ({
    width: 3,
    height: 13,
    borderRadius: 2,
    backgroundColor: color,
    marginHorizontal: 1.5,
    opacity: v,
  });

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 14, height: 20 }}>
      <Animated.View style={barStyle(a1)} />
      <Animated.View style={barStyle(a2)} />
      <Animated.View style={barStyle(a3)} />
    </View>
  );
}

// ─── Collection Pill ──────────────────────────────────────────────────────────
function CollectionPill({
  group,
  isActive,
  onPress,
  hasPlayingSound,
}: {
  group: DisplayGroup;
  isActive: boolean;
  onPress: () => void;
  hasPlayingSound: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      activeOpacity={0.7}
      style={[S.pill, isActive && { borderColor: group.themeColor + 'CC' }]}
    >
      {isActive && (
        <View
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: group.themeColor + '14', borderRadius: 12 },
          ]}
        />
      )}
      <View style={[S.pillDot, { backgroundColor: isActive ? group.themeColor : 'rgba(255,255,255,0.15)' }]} />
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
}

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

  // Open / close animation
  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        damping: 28,
        stiffness: 260,
        mass: 0.9,
        useNativeDriver: true,
      }).start();
      setActiveId(initialCategory ?? null);
      setSearchQuery('');
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_H,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

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

  // Filter sounds for search mode
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return sounds.filter(s => 
      s.label?.toLowerCase().includes(q) || s.desc?.toLowerCase().includes(q)
    );
  }, [sounds, searchQuery]);

  const activeGroup = displayGroups.find(g => g.id === activeId) ?? null;
  const isSearchMode = searchQuery.length > 0;

  const handleSelectGroup = (id: string) => {
    setActiveId(prev => prev === id ? null : id);
  };

  const handleRequestClose = () => {
    if (activeId) {
      setActiveId(null);
    } else {
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={handleRequestClose}>
      {/* Dim backdrop */}
      <TouchableOpacity
        style={S.backdrop}
        activeOpacity={1}
        onPress={handleRequestClose}
      />

      <Animated.View style={[S.sheet, { transform: [{ translateY: slideAnim }] }]}>
        {/* Deep black glass base */}
        <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFillObject} />
        <LinearGradient
          colors={['#0A0A0C', '#080808']}
          style={[StyleSheet.absoluteFillObject, { opacity: 0.96 }]}
        />

        <SafeAreaView style={{ flex: 1 }}>
          {/* ── Handle ─────────────────────────────────────────────────── */}
          <View style={S.handle} />

          {/* ── Header ─────────────────────────────────────────────────── */}
          <View style={S.header}>
            <View>
              <Text style={S.headerTitle}>Svara Library</Text>
              <Text style={S.headerSub}>
                {displayGroups.length} collections · {sounds.length} sounds
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={S.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={16} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          </View>

          {/* ── Search ──────────────────────────────────────────────────── */}
          <View style={S.searchWrap}>
            <Ionicons name="search" size={14} color="rgba(255,255,255,0.3)" style={{ marginLeft: 14, marginRight: 9 }} />
            <TextInput
              style={S.searchInput}
              placeholder="Search sounds & collections…"
              placeholderTextColor="rgba(255,255,255,0.22)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 10 }}>
                <Ionicons name="close-circle" size={14} color="rgba(255,255,255,0.3)" />
              </TouchableOpacity>
            )}
          </View>

          {/* ── Divider ─────────────────────────────────────────────────── */}
          <View style={S.divider} />

          {/* ── Single-panel drill-down layout ─────────────── */}
          <View style={{ flex: 1 }}>
            {isSearchMode ? (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingVertical: 6, paddingBottom: 60 }}
              >
                {searchResults.length === 0 && (
                  <Text style={S.emptyText}>No results</Text>
                )}
                {searchResults.map((sound: any, idx: number) => (
                  <SoundRow
                    key={sound.id}
                    sound={sound}
                    isPlaying={playingId === sound.id}
                    onPress={() => { onPlaySound(sound.id); }}
                    isLast={idx === searchResults.length - 1}
                    index={idx}
                  />
                ))}
              </ScrollView>
            ) : !activeGroup ? (
              <ScrollView
                style={{ flex: 1, paddingHorizontal: 16 }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingVertical: 10, paddingBottom: 50 }}
              >
                {displayGroups.length === 0 && (
                  <Text style={S.emptyText}>No results</Text>
                )}
                {displayGroups.map(group => (
                  <CollectionPill
                    key={group.id}
                    group={group}
                    isActive={false}
                    onPress={() => handleSelectGroup(group.id)}
                    hasPlayingSound={group.sounds.some((s: any) => s.id === playingId)}
                  />
                ))}
              </ScrollView>
            ) : (
              <View style={{ flex: 1 }}>
                {/* Collection heading with Back button */}
                <View style={[S.rightHeader, { paddingHorizontal: 16, paddingVertical: 12 }]}>
                  <TouchableOpacity 
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setActiveId(null);
                    }} 
                    style={{ marginRight: 12, paddingVertical: 4, paddingRight: 8, flexDirection: 'row', alignItems: 'center' }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.7)" />
                  </TouchableOpacity>
                  <View style={[S.rightHeaderDot, { backgroundColor: activeGroup.themeColor }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[S.rightHeaderTitle, { color: activeGroup.themeColor, fontSize: 14 }]} numberOfLines={1}>
                      {activeGroup.title}
                    </Text>
                    {activeGroup.subtitle ? (
                      <Text style={S.rightHeaderSub} numberOfLines={1}>{activeGroup.subtitle}</Text>
                    ) : null}
                  </View>
                  <Text style={S.rightHeaderCount}>{activeGroup.sounds.length}</Text>
                </View>
                <View style={S.divider} />

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingVertical: 6, paddingBottom: 60 }}
                >
                  {activeGroup.sounds.map((sound: any, idx: number) => (
                    <SoundRow
                      key={sound.id}
                      sound={sound}
                      isPlaying={playingId === sound.id}
                      onPress={() => { onPlaySound(sound.id); }}
                      isLast={idx === activeGroup.sounds.length - 1}
                      index={idx}
                    />
                  ))}
                </ScrollView>
              </View>
            )}
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
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '100%',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: -10 },
    elevation: 30,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 14,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  headerSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 2,
    letterSpacing: 0.3,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },

  // Search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 14,
    height: 38,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 11,
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
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  colDivider: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },

  // Two-column layout
  leftCol: {
    width: 142,
    paddingHorizontal: 10,
  },
  rightCol: {
    flex: 1,
    position: 'relative',
  },
  rightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rightHeaderDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 10,
  },
  rightHeaderTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  rightHeaderSub: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  rightHeaderCount: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    marginLeft: 8,
  },

  // Collection pill
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    position: 'relative',
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
    color: 'rgba(255,255,255,0.55)',
    flex: 1,
    letterSpacing: 0.1,
  },
  pillCount: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.25)',
    marginLeft: 4,
    fontWeight: '500',
  },

  // Sound row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 16,
    borderRadius: 0,
    overflow: 'hidden',
  },
  playingBar: {
    width: 2.5,
    height: '70%',
    borderRadius: 2,
    marginLeft: 10,
    marginRight: 2,
    flexShrink: 0,
    minHeight: 20,
  },
  rowEmoji: {
    fontSize: 15,
    width: 30,
    textAlign: 'center',
    marginLeft: 6,
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
    marginBottom: 2,
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
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  emptyStateTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 6,
  },
  emptyStateDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.2)',
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
    marginTop: 20,
  },
});
