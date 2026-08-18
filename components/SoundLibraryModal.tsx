import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  TextInput,
  Dimensions,
  BackHandler,
  Pressable,
} from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: W, height: SCREEN_H } = Dimensions.get('window');
const CARD_GAP = 10;
const CARD_W = (W - 32 - CARD_GAP) / 2;
const CARD_H = CARD_W * 1.28;

type DisplayGroup = {
  id: string;
  title: string;
  subtitle?: string;
  themeColor: string;
  imageUri?: string;
  sounds: any[];
};

export function PlayingPulse({ color }: { color: string }) {
  const a1 = useRef(new Animated.Value(0.3)).current;
  const a2 = useRef(new Animated.Value(0.6)).current;
  const a3 = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const pulse = (v: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 400, delay, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.3, duration: 400, useNativeDriver: true }),
      ]));
    pulse(a1, 0).start(); pulse(a2, 133).start(); pulse(a3, 266).start();
  }, []);
  const bar = (v: Animated.Value) => ({ width: 3, height: 14, borderRadius: 2, backgroundColor: color, marginHorizontal: 1.5, opacity: v } as any);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 14, height: 20 }}>
      <Animated.View style={bar(a1)} /><Animated.View style={bar(a2)} /><Animated.View style={bar(a3)} />
    </View>
  );
}

export function SoundRow({ sound, isPlaying, onPress, isLast, index }: { sound: any; isPlaying: boolean; onPress: () => void; isLast?: boolean; index: number; }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 200, delay: Math.min(index * 25, 400), useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, delay: Math.min(index * 25, 400), useNativeDriver: true, tension: 120, friction: 10 }),
    ]).start();
  }, []);
  return (
    <Animated.View style={{ opacity, transform: [{ translateY }, { scale }] }}>
      <TouchableOpacity
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
        onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, tension: 300, friction: 10 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 300, friction: 10 }).start()}
        activeOpacity={1}
        style={[S.row, isPlaying && { backgroundColor: 'rgba(255,255,255,0.04)' }]}
      >
        <View style={[S.playingBar, { backgroundColor: isPlaying ? (sound.color || '#fff') : 'transparent' }]} />
        <Text style={S.rowEmoji}>{sound.emoji || '\uD83C\uDFB5'}</Text>
        <View style={[S.rowBody, !isLast && S.rowDivider]}>
          <View style={{ flex: 1 }}>
            <Text style={[S.rowTitle, isPlaying && { color: sound.color || '#FFFFFF' }]} numberOfLines={1}>{sound.label}</Text>
            {sound.desc ? <Text style={S.rowDesc} numberOfLines={1}>{sound.desc}</Text> : null}
          </View>
          {isPlaying ? <PlayingPulse color={sound.color || '#fff'} /> : (
            <View style={S.playBtn}><Ionicons name="play" size={11} color="rgba(255,255,255,0.25)" /></View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function CollectionRow({ group, onPress, hasPlayingSound, index }: { group: DisplayGroup; onPress: () => void; hasPlayingSound: boolean; index: number; }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 280, delay: Math.min(index * 40, 600), useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, delay: Math.min(index * 40, 600), useNativeDriver: true, tension: 100, friction: 12 }),
    ]).start();
  }, []);
  return (
    <Animated.View style={{ opacity, transform: [{ translateY }, { scale }], marginBottom: 10 }}>
      <TouchableOpacity
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
        onPressIn={() => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, tension: 300, friction: 12 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 300, friction: 12 }).start()}
        activeOpacity={1}
        style={{ width: '100%', height: 68, borderRadius: 16, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 }}
      >
        {group.imageUri ? (
          <ExpoImage source={{ uri: group.imageUri }} style={StyleSheet.absoluteFillObject} contentFit="cover" cachePolicy="memory-disk" transition={300} />
        ) : (
          <LinearGradient colors={[group.themeColor + '40', '#0A0A10']} style={StyleSheet.absoluteFillObject} />
        )}
        <LinearGradient colors={['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.85)']} start={{x: 0, y: 0}} end={{x: 1, y: 0}} style={StyleSheet.absoluteFillObject} />
        
        {/* Left side content */}
        <View style={{ flex: 1, paddingRight: 12, justifyContent: 'center' }}>
          {group.subtitle ? <Text style={{ fontSize: 9, fontWeight: '800', color: group.themeColor, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 2, opacity: 0.9 }} numberOfLines={1}>{group.subtitle}</Text> : null}
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.2 }} numberOfLines={1}>{group.title}</Text>
        </View>

        {/* Right side content */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {hasPlayingSound && (
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: group.themeColor + 'CC', paddingHorizontal: 6, paddingVertical: 4, borderRadius: 16 }}>
              <PlayingPulse color="#FFF" />
            </View>
          )}
          <View style={{ backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)' }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.7)', letterSpacing: 0.2 }}>{group.sounds.length}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
        </View>
        
        {/* Playing border */}
        {hasPlayingSound && <View style={{ ...StyleSheet.absoluteFillObject, borderRadius: 16, borderWidth: 1.5, borderColor: group.themeColor + 'AA' } as any} pointerEvents="none" />}
      </TouchableOpacity>
    </Animated.View>
  );
}

function CollectionDetailHeader({ group, onBack }: { group: DisplayGroup; onBack: () => void; }) {
  return (
    <View style={{ overflow: 'hidden' }}>
      {group.imageUri ? (
        <>
          <ExpoImage source={{ uri: group.imageUri }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" cachePolicy="memory-disk" />
          <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFillObject} />
        </>
      ) : <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: group.themeColor + '30' } as any} />}
      <LinearGradient colors={['rgba(8,8,12,0.1)', 'rgba(8,8,12,0.94)']} style={StyleSheet.absoluteFillObject} />
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 }}>
        <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onBack(); }} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, alignSelf: 'flex-start', paddingVertical: 4, paddingRight: 8 }} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.7)" />
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginLeft: 2 }}>All Collections</Text>
        </TouchableOpacity>
        {group.subtitle ? <Text style={{ fontSize: 10, fontWeight: '800', color: group.themeColor, letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 6 }}>{group.subtitle}</Text> : null}
        <Text style={{ fontSize: 22, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.2, marginBottom: 6 }}>{group.title}</Text>
        <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', letterSpacing: 0.3 }}>{group.sounds.length} sounds</Text>
      </View>
    </View>
  );
}

export default function SoundLibraryModal({ visible, onClose, sounds, collections, playingId, onPlaySound, initialCategory }: { visible: boolean; onClose: () => void; sounds: any[]; collections?: any[]; playingId: string | null; onPlaySound: (id: string) => void; initialCategory?: string | null; }) {
  const insets = useSafeAreaInsets();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const sheetAnim = useRef(new Animated.Value(SCREEN_H)).current;
  const detailAnim = useRef(new Animated.Value(50)).current;
  const detailOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setActiveId(initialCategory ?? null);
      setSearchQuery('');
      Animated.spring(sheetAnim, { toValue: 0, useNativeDriver: true, tension: 70, friction: 14 }).start();
    } else {
      Animated.timing(sheetAnim, { toValue: SCREEN_H, duration: 260, useNativeDriver: true }).start();
      setActiveId(null);
    }
  }, [visible]);

  useEffect(() => {
    if (activeId) {
      detailAnim.setValue(50); detailOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(detailAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 13 }),
        Animated.timing(detailOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [activeId]);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (activeId) { setActiveId(null); } else { onClose(); }
      return true;
    });
    return () => sub.remove();
  }, [visible, activeId, onClose]);

  const displayGroups = useMemo((): DisplayGroup[] => {
    if (collections && collections.length > 0) {
      return collections.map(col => ({
        id: col.id, title: col.title, subtitle: col.subtitle,
        themeColor: col.themeColor || '#FFFFFF', imageUri: col.imageUri,
        sounds: col.soundIds.map((id: string) => sounds.find(s => s.id === id)).filter(Boolean),
      }));
    }
    const cats = new Set<string>();
    sounds.forEach(s => { if (s.cat) cats.add(s.cat); });
    return Array.from(cats).sort().map(cat => ({ id: cat, title: cat, subtitle: undefined, themeColor: '#FFFFFF', imageUri: undefined, sounds: sounds.filter(s => s.cat === cat) }));
  }, [collections, sounds]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return sounds.filter(s => s.label?.toLowerCase().includes(q) || s.desc?.toLowerCase().includes(q));
  }, [sounds, searchQuery]);

  const activeGroup = displayGroups.find(g => g.id === activeId) ?? null;
  const isSearchMode = searchQuery.length > 0;

  if (!visible) return null;

  return (
    <View style={[StyleSheet.absoluteFillObject, { zIndex: 10000, elevation: 998 }]}>
      <TouchableOpacity style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.75)' }]} activeOpacity={1} onPress={() => { if (activeId) { setActiveId(null); } else { onClose(); } }} />
      <Animated.View style={[S.sheet, { transform: [{ translateY: sheetAnim }] }]}>
        <Pressable style={StyleSheet.absoluteFillObject} />
        <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFillObject} />
        <LinearGradient colors={['#08080C', '#06060A']} style={[StyleSheet.absoluteFillObject, { opacity: 0.97 }]} />
        <View style={{ paddingTop: insets.top > 0 ? insets.top + 4 : 16 }}>
          <View style={S.handle} />
          <View style={S.header}>
            <View style={{ flex: 1 }}>
              <Text style={S.headerTitle}>{activeGroup && !isSearchMode ? activeGroup.title : 'Svara Library'}</Text>
              <Text style={S.headerSub}>{activeGroup && !isSearchMode ? `${activeGroup.sounds.length} sounds` : `${displayGroups.length} collections \u00b7 ${sounds.length} sounds`}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={S.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={16} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>
          <View style={S.searchWrap}>
            <Ionicons name="search" size={14} color="rgba(255,255,255,0.3)" style={{ marginLeft: 14, marginRight: 9 }} />
            <TextInput style={S.searchInput} placeholder="Search sounds & collections\u2026" placeholderTextColor="rgba(255,255,255,0.22)" value={searchQuery} onChangeText={setSearchQuery} autoCorrect={false} />
            {searchQuery.length > 0 && <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 10 }}><Ionicons name="close-circle" size={14} color="rgba(255,255,255,0.3)" /></TouchableOpacity>}
          </View>
        </View>
        <View style={S.divider} />
        <View style={{ flex: 1 }}>
          {isSearchMode ? (
            <FlatList data={searchResults} keyExtractor={(item) => item.id} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 6, paddingBottom: 60 }} initialNumToRender={15} windowSize={5}
              ListEmptyComponent={() => <View style={{ alignItems: 'center', paddingTop: 48 }}><Ionicons name="search" size={32} color="rgba(255,255,255,0.12)" /><Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)', marginTop: 12 }}>No results for "{searchQuery}"</Text></View>}
              renderItem={({ item: sound, index }) => <SoundRow sound={sound} isPlaying={playingId === sound.id} onPress={() => { onPlaySound(sound.id); }} isLast={index === searchResults.length - 1} index={index} />}
            />
          ) : !activeGroup ? (
            <FlatList data={displayGroups} keyExtractor={(item) => item.id} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 60 }}
              renderItem={({ item: group, index }) => <CollectionRow group={group} onPress={() => setActiveId(group.id)} hasPlayingSound={group.sounds.some((s: any) => s.id === playingId)} index={index} />}
            />
          ) : (
            <Animated.View style={{ flex: 1, opacity: detailOpacity, transform: [{ translateY: detailAnim }] }}>
              <CollectionDetailHeader group={activeGroup} onBack={() => setActiveId(null)} />
              <View style={S.divider} />
              <FlatList data={activeGroup.sounds} keyExtractor={(item) => item.id} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 6, paddingBottom: 60 }} initialNumToRender={15} windowSize={5}
                renderItem={({ item: sound, index }) => <SoundRow sound={sound} isPlaying={playingId === sound.id} onPress={() => { onPlaySound(sound.id); }} isLast={index === activeGroup.sounds.length - 1} index={index} />}
              />
            </Animated.View>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const S = StyleSheet.create({
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '100%', overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.7, shadowRadius: 40, shadowOffset: { width: 0, height: -10 }, elevation: 30 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.12)', alignSelf: 'center', marginBottom: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 4, paddingBottom: 14 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.2 },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 2, letterSpacing: 0.3 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.1)' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 14, height: 40, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.08)' },
  searchInput: { flex: 1, fontSize: 14, color: '#FFF', paddingVertical: 0 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.08)' },
  row: { flexDirection: 'row', alignItems: 'center', paddingRight: 16, overflow: 'hidden' },
  playingBar: { width: 2.5, borderRadius: 2, marginLeft: 10, marginRight: 2, flexShrink: 0, minHeight: 22, height: '70%' },
  rowEmoji: { fontSize: 16, width: 32, textAlign: 'center', marginLeft: 6 },
  rowBody: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 13, marginLeft: 8 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.05)' },
  rowTitle: { fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.82)', letterSpacing: 0.1, marginBottom: 2 },
  rowDesc: { fontSize: 11.5, color: 'rgba(255,255,255,0.3)' },
  playBtn: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.07)' },
});
