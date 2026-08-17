import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  FlatList, Animated, TextInput, Dimensions, BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';

const { height: SCREEN_H } = Dimensions.get('window');

type DisplayGroup = {
  id: string; title: string; subtitle?: string;
  themeColor: string; sounds: any[];
};

// ── Playing Pulse Bars ────────────────────────────────────────────────────────
export function PlayingPulse({ color }: { color: string }) {
  const a1 = useRef(new Animated.Value(0.3)).current;
  const a2 = useRef(new Animated.Value(0.6)).current;
  const a3 = useRef(new Animated.Value(1.0)).current;
  useEffect(() => {
    const pulse = (v: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.timing(v, { toValue: 1,    duration: 380, delay, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.25, duration: 380,        useNativeDriver: true }),
      ]));
    pulse(a1, 0).start(); pulse(a2, 125).start(); pulse(a3, 250).start();
  }, []);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', height: 20, gap: 2.5 }}>
      {[a1, a2, a3].map((v, i) => (
        <Animated.View key={i} style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: color, opacity: v }} />
      ))}
    </View>
  );
}

// ── Animated Sound Row ────────────────────────────────────────────────────────
export function SoundRow({ sound, isPlaying, onPress, onAddQueue, isLast, index }: {
  sound: any; isPlaying: boolean; onPress: () => void;
  onAddQueue?: () => void; isLast?: boolean; index: number;
}) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 220, delay: index * 22, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 220, delay: index * 22, useNativeDriver: true }),
    ]).start();
  }, []);
  const accentColor = sound.color || '#a78bfa';
  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <TouchableOpacity
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
        activeOpacity={0.6}
        style={[SR.row, isPlaying && { backgroundColor: accentColor + '12' }]}
      >
        <View style={[SR.accentBar, {
          backgroundColor: isPlaying ? accentColor : 'transparent',
          ...(isPlaying ? { shadowColor: accentColor, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 8 } : {}),
        }]} />
        <Text style={SR.emoji}>{sound.emoji || '🎵'}</Text>
        <View style={[SR.body, !isLast && SR.bodyDivider]}>
          <View style={{ flex: 1 }}>
            <Text style={[SR.title, isPlaying && { color: accentColor, fontWeight: '600' }]} numberOfLines={1}>
              {sound.label}
            </Text>
            {sound.desc ? <Text style={SR.desc} numberOfLines={1}>{sound.desc}</Text> : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            {onAddQueue && (
              <TouchableOpacity
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onAddQueue(); }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="add" size={20} color="rgba(255,255,255,0.35)" />
              </TouchableOpacity>
            )}
            {isPlaying ? <PlayingPulse color={accentColor} /> : (
              <View style={SR.playBtn}>
                <Ionicons name="play" size={10} color="rgba(255,255,255,0.22)" style={{ marginLeft: 1 }} />
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Collection Card (premium dark glass) ──────────────────────────────────────
function CollectionCard({ group, index, playingId, onPress }: {
  group: DisplayGroup; index: number; playingId: string | null; onPress: () => void;
}) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;
  const hasPlaying = group.sounds.some((s: any) => s.id === playingId);
  const color      = group.themeColor;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 320, delay: index * 45, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 320, delay: index * 45, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={[CC.wrapper, { opacity, transform: [{ translateY }] }]}>
      <TouchableOpacity
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onPress(); }}
        activeOpacity={0.65} style={CC.card}
      >
        {/* Left accent bar with glow */}
        <View style={[CC.accentBar, {
          backgroundColor: color,
          shadowColor: color, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 6,
        }]} />
        {/* Ambient glow if playing */}
        {hasPlaying && (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: color + '0C', borderRadius: 14 }]} />
        )}
        {/* Color swatch dot */}
        <View style={[CC.swatch, { backgroundColor: color + '28', borderColor: color + '50' }]}>
          <View style={[CC.swatchDot, { backgroundColor: color }]} />
        </View>
        {/* Labels */}
        <View style={{ flex: 1 }}>
          <Text style={CC.title} numberOfLines={1}>{group.title}</Text>
          {group.subtitle
            ? <Text style={CC.subtitle} numberOfLines={1}>{group.subtitle}</Text>
            : null}
        </View>
        {/* Right: playing pulse + count chip + chevron */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {hasPlaying && (
            <View style={[CC.playingChip, { borderColor: color + '60', backgroundColor: color + '18' }]}>
              <PlayingPulse color={color} />
            </View>
          )}
          <View style={[CC.countChip, { borderColor: color + '30' }]}>
            <Text style={[CC.countText, { color }]}>{group.sounds.length}</Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.28)" />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export default function SoundLibraryModal({
  visible, onClose, sounds, collections, playingId, onPlaySound, onAddQueue, initialCategory,
}: {
  visible: boolean; onClose: () => void; sounds: any[]; collections?: any[];
  playingId: string | null; onPlaySound: (id: string) => void;
  onAddQueue?: (id: string) => void; initialCategory?: string | null;
}) {
  const insets = useSafeAreaInsets();
  const [activeId, setActiveId]       = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const slideAnim  = useRef(new Animated.Value(SCREEN_H)).current;
  const backdropOp = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setActiveId(initialCategory ?? null);
      setSearchQuery('');
      Animated.parallel([
        Animated.spring(slideAnim,  { toValue: 0, damping: 22, stiffness: 260, useNativeDriver: true }),
        Animated.timing(backdropOp, { toValue: 1, duration: 260, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim,  { toValue: SCREEN_H, duration: 280, useNativeDriver: true }),
        Animated.timing(backdropOp, { toValue: 0,         duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (activeId) setActiveId(null); else onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, activeId, onClose]);

  const displayGroups = useMemo((): DisplayGroup[] => {
    if (collections && collections.length > 0) {
      return collections.map(col => ({
        id: col.id, title: col.title, subtitle: col.subtitle,
        themeColor: col.themeColor || '#a78bfa',
        sounds: col.soundIds.map((id: string) => sounds.find(s => s.id === id)).filter(Boolean),
      }));
    }
    const cats = new Set<string>();
    sounds.forEach(s => { if (s.cat) cats.add(s.cat); });
    return Array.from(cats).sort().map(cat => ({
      id: cat, title: cat, subtitle: undefined, themeColor: '#a78bfa',
      sounds: sounds.filter(s => s.cat === cat),
    }));
  }, [collections, sounds]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return sounds.filter(s =>
      s.label?.toLowerCase().includes(q) || s.desc?.toLowerCase().includes(q)
    );
  }, [sounds, searchQuery]);

  const activeGroup  = displayGroups.find(g => g.id === activeId) ?? null;
  const isSearchMode = searchQuery.length > 0;

  return (
    // Native Modal = background scroll completely blocked (bug fix)
    <Modal
      visible={visible} transparent animationType="none" statusBarTranslucent
      onRequestClose={() => { if (activeId) setActiveId(null); else onClose(); }}
    >
      <View style={M.root}>
        {/* Dim backdrop */}
        <Animated.View style={[M.backdrop, { opacity: backdropOp }]}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />
        </Animated.View>

        {/* Sheet */}
        <Animated.View style={[M.sheet, { transform: [{ translateY: slideAnim }], paddingBottom: insets.bottom }]}>
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(6,6,10,0.92)' }]} />

          {/* Drag handle */}
          <View style={M.handle} />

          {/* ── Header ────────────────────────────────────────────── */}
          <View style={[M.header, { paddingTop: insets.top > 0 ? 8 : 16 }]}>
            {activeGroup ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <TouchableOpacity
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveId(null); }}
                  style={M.backBtn} activeOpacity={0.7}
                >
                  <Ionicons name="chevron-back" size={18} color="rgba(255,255,255,0.8)" />
                </TouchableOpacity>
                <View style={[M.accentDot, {
                  backgroundColor: activeGroup.themeColor,
                  shadowColor: activeGroup.themeColor, shadowOpacity: 0.9,
                  shadowRadius: 6, shadowOffset: { width: 0, height: 0 },
                }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[M.headerTitle, { color: activeGroup.themeColor }]} numberOfLines={1}>
                    {activeGroup.title}
                  </Text>
                  <Text style={M.headerSub}>
                    {activeGroup.subtitle || `${activeGroup.sounds.length} sounds`}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={{ flex: 1 }}>
                <Text style={M.headerTitle}>Sound Library</Text>
                <Text style={M.headerSub}>
                  {displayGroups.length} collections · {sounds.length} sounds
                </Text>
              </View>
            )}
            <TouchableOpacity onPress={onClose} style={M.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={15} color="rgba(255,255,255,0.55)" />
            </TouchableOpacity>
          </View>

          {/* ── Search (root only) ────────────────────────────────── */}
          {!activeGroup && (
            <View style={M.searchWrap}>
              <Ionicons name="search" size={14} color="rgba(255,255,255,0.28)" style={{ marginRight: 9 }} />
              <TextInput
                style={M.searchInput}
                placeholder="Search sounds & collections…"
                placeholderTextColor="rgba(255,255,255,0.20)"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCorrect={false}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 8 }}>
                  <Ionicons name="close-circle" size={15} color="rgba(255,255,255,0.28)" />
                </TouchableOpacity>
              )}
            </View>
          )}

          <View style={M.divider} />

          {/* ── Content ───────────────────────────────────────────── */}
          <View style={{ flex: 1 }}>
            {isSearchMode ? (
              <FlatList
                data={searchResults} keyExtractor={item => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingVertical: 6, paddingBottom: 60 }}
                initialNumToRender={20}
                ListEmptyComponent={() => <Text style={M.emptyText}>No results for "{searchQuery}"</Text>}
                renderItem={({ item: sound, index }) => (
                  <SoundRow
                    sound={sound} isPlaying={playingId === sound.id}
                    onPress={() => onPlaySound(sound.id)}
                    onAddQueue={onAddQueue ? () => onAddQueue(sound.id) : undefined}
                    isLast={index === searchResults.length - 1} index={index}
                  />
                )}
              />
            ) : !activeGroup ? (
              <FlatList
                data={displayGroups} keyExtractor={item => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 60 }}
                initialNumToRender={12}
                ListEmptyComponent={() => <Text style={M.emptyText}>No collections</Text>}
                renderItem={({ item: group, index }) => (
                  <CollectionCard
                    group={group} index={index} playingId={playingId}
                    onPress={() => setActiveId(group.id)}
                  />
                )}
              />
            ) : (
              <FlatList
                data={activeGroup.sounds} keyExtractor={item => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingVertical: 6, paddingBottom: 60 }}
                initialNumToRender={20}
                renderItem={({ item: sound, index }) => (
                  <SoundRow
                    sound={sound} isPlaying={playingId === sound.id}
                    onPress={() => onPlaySound(sound.id)}
                    onAddQueue={onAddQueue ? () => onAddQueue(sound.id) : undefined}
                    isLast={index === activeGroup.sounds.length - 1} index={index}
                  />
                )}
              />
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const M = StyleSheet.create({
  root:    { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.78)' },
  sheet: {
    height: SCREEN_H * 0.92,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.7, shadowRadius: 50,
    shadowOffset: { width: 0, height: -12 }, elevation: 30,
  },
  handle: {
    width: 38, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 14, gap: 10 },
  backBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  accentDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.15 },
  headerSub:   { fontSize: 12, color: 'rgba(255,255,255,0.32)', marginTop: 2, letterSpacing: 0.3 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center', justifyContent: 'center',
  },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 14, height: 42,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 13, borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 14,
  },
  searchInput: { flex: 1, fontSize: 14.5, color: '#FFF', paddingVertical: 0, letterSpacing: 0.1 },
  divider:    { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.07)' },
  emptyText:  { fontSize: 14, color: 'rgba(255,255,255,0.28)', textAlign: 'center', marginTop: 40, letterSpacing: 0.2 },
});

const CC = StyleSheet.create({
  wrapper: { marginBottom: 8 },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14, borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 14, paddingRight: 16,
    overflow: 'hidden', gap: 12,
  },
  accentBar: { width: 3, height: '100%', borderRadius: 2, position: 'absolute', left: 0, top: 0, bottom: 0 },
  swatch:    { width: 42, height: 42, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginLeft: 14, flexShrink: 0 },
  swatchDot: { width: 14, height: 14, borderRadius: 7 },
  title:     { fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.92)', letterSpacing: 0.1 },
  subtitle:  { fontSize: 11.5, color: 'rgba(255,255,255,0.35)', marginTop: 3, letterSpacing: 0.4, textTransform: 'uppercase' },
  playingChip:  { borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  countChip:    { borderWidth: StyleSheet.hairlineWidth, borderRadius: 7, paddingHorizontal: 9, paddingVertical: 3, minWidth: 28, alignItems: 'center' },
  countText:    { fontSize: 11.5, fontWeight: '600', letterSpacing: 0.2 },
});

const SR = StyleSheet.create({
  row:         { flexDirection: 'row', alignItems: 'center', paddingRight: 16, minHeight: 58, overflow: 'hidden' },
  accentBar:   { width: 3, height: 36, borderRadius: 2, marginLeft: 0, marginRight: 4, flexShrink: 0 },
  emoji:       { fontSize: 16, width: 34, textAlign: 'center', marginLeft: 4 },
  body:        { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 15, marginLeft: 8 },
  bodyDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.06)' },
  title:       { fontSize: 14, fontWeight: '400', color: 'rgba(255,255,255,0.82)', letterSpacing: 0.1, marginBottom: 2 },
  desc:        { fontSize: 11.5, color: 'rgba(255,255,255,0.28)', letterSpacing: 0.1 },
  playBtn:     { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.08)' },
});
