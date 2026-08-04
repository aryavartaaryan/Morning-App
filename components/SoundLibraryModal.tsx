import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Platform, SafeAreaView, LayoutAnimation, Dimensions, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';

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
  const router = useRouter();
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (visible) {
      setExpandedCat(initialCategory ?? null);
      setSearchQuery('');
    }
  }, [visible, initialCategory]);

  const toggleCat = (cat: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedCat(prev => prev === cat ? null : cat);
  };

  // If collections are provided, use them. Otherwise, fallback to the old dynamic categories.
  const displayGroups = useMemo(() => {
    if (collections && collections.length > 0) {
      return collections.map(col => {
        const colSounds = col.soundIds.map((id: string) => sounds.find(s => s.id === id)).filter(Boolean);
        return {
          id: col.id,
          title: col.title,
          subtitle: col.subtitle,
          themeColor: col.themeColor,
          sounds: colSounds,
        };
      });
    } else {
      // Fallback
      const cats = new Set<string>();
      sounds.forEach(s => { if (s.cat) cats.add(s.cat); });
      return Array.from(cats).sort().map(cat => ({
        id: cat,
        title: cat,
        subtitle: 'Sounds',
        themeColor: '#FFFFFF',
        sounds: sounds.filter(s => s.cat === cat).sort((a, b) => (a.label || '').localeCompare(b.label || '')),
      }));
    }
  }, [collections, sounds]);

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return displayGroups;
    const q = searchQuery.toLowerCase();
    
    return displayGroups.map(group => {
      // Check if group title matches
      if (group.title.toLowerCase().includes(q) || (group.subtitle && group.subtitle.toLowerCase().includes(q))) {
        return group; // return whole group if title matches
      }
      // Filter sounds in group
      const matchedSounds = group.sounds.filter((s: any) => 
        s.label?.toLowerCase().includes(q) || 
        s.desc?.toLowerCase().includes(q)
      );
      if (matchedSounds.length > 0) {
        return { ...group, sounds: matchedSounds };
      }
      return null;
    }).filter(Boolean) as typeof displayGroups;
  }, [displayGroups, searchQuery]);

  const renderCategoriesAccordion = () => (
    <View style={{ paddingTop: 10, paddingHorizontal: 16, paddingBottom: 40 }}>
      {filteredGroups.length === 0 && searchQuery.length > 0 && (
        <Text style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 40, fontSize: 14 }}>No sounds found matching "{searchQuery}"</Text>
      )}
      {filteredGroups.map((group) => {
        const isExpanded = expandedCat === group.id || searchQuery.length > 0;
        
        return (
          <View key={group.id} style={[S.catSection, isExpanded && { backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 16 }]}>
            <TouchableOpacity onPress={() => toggleCat(group.id)} activeOpacity={0.7} style={[S.catHeader, isExpanded && S.catHeaderExpanded]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View style={[S.colorDot, { backgroundColor: group.themeColor || '#FFF' }]} />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={[S.catHeaderText, isExpanded && { color: group.themeColor || '#FFF', fontWeight: '500' }]} numberOfLines={1}>{group.title}</Text>
                  {isExpanded && group.subtitle ? (
                    <Text style={S.catSubHeaderText} numberOfLines={1}>{group.subtitle}</Text>
                  ) : null}
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[S.catCount, isExpanded && S.catCountExpanded]}>{group.sounds.length}</Text>
                <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={14} color={isExpanded ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.2)"} style={{ marginLeft: 8 }} />
              </View>
            </TouchableOpacity>
            
            {isExpanded && (
              <View style={S.catContent}>
                {group.sounds.map((sound: any, sIdx: number) => {
                  const isLast = sIdx === group.sounds.length - 1;
                  return (
                    <SoundRow 
                      key={sound.id} 
                      sound={sound} 
                      isPlaying={playingId === sound.id} 
                      onPress={() => onPlaySound(sound.id)} 
                      isLast={isLast}
                    />
                  );
                })}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <BlurView intensity={25} tint="dark" style={S.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        
        <SafeAreaView style={S.safeArea} pointerEvents="box-none">
          <View style={S.drawer}>
            <BlurView intensity={75} tint="dark" style={StyleSheet.absoluteFillObject} />
            <LinearGradient colors={['rgba(15,15,18,0.7)', 'rgba(8,8,10,0.9)']} style={StyleSheet.absoluteFillObject} />
            
            <View style={S.drawerBorderRight} />

            {/* Header */}
            <View style={S.header}>
              <View style={S.headerTopRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="library-outline" size={18} color="rgba(255,255,255,0.9)" style={{ marginRight: 8 }} />
                  <Text style={S.title}>Nada Library</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TouchableOpacity onPress={onClose} style={S.closeBtn} activeOpacity={0.7}>
                    <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" />
                  </TouchableOpacity>
                </View>
              </View>
              
              <View style={S.searchContainer}>
                <Ionicons name="search" size={15} color="rgba(255,255,255,0.4)" style={{ marginLeft: 12, marginRight: 8 }} />
                <TextInput
                  style={S.searchInput}
                  placeholder="Search collections & sounds..."
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={searchQuery}
                  onChangeText={(text) => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setSearchQuery(text);
                  }}
                  autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 8 }}>
                    <Ionicons name="close-circle" size={15} color="rgba(255,255,255,0.4)" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* List */}
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={S.scrollContent} keyboardShouldPersistTaps="handled">
              {renderCategoriesAccordion()}
            </ScrollView>
          </View>
        </SafeAreaView>
      </BlurView>
    </Modal>
  );
}

function SoundRow({ sound, isPlaying, onPress, isLast }: { sound: any, isPlaying: boolean, onPress: () => void, isLast?: boolean }) {
  return (
    <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }} style={[S.row, isPlaying && S.rowActive]} activeOpacity={0.7}>
      <Text style={{ fontSize: 15, width: 24, textAlign: 'center' }}>{sound.emoji || '🎵'}</Text>
      <View style={[S.rowBody, !isLast && S.rowBorder, isPlaying && { borderBottomColor: 'transparent' }]}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={[S.rowTitle, isPlaying && { color: sound.color || '#FFFFFF', fontWeight: '500' }]} numberOfLines={1}>{sound.label}</Text>
          {sound.desc ? <Text style={[S.rowDesc, isPlaying && { color: 'rgba(255,255,255,0.4)' }]} numberOfLines={1}>{sound.desc}</Text> : null}
        </View>
        {isPlaying ? (
          <Ionicons name="cellular" size={13} color={sound.color || '#FFFFFF'} style={{ marginRight: 16 }} />
        ) : (
          <Ionicons name="play" size={13} color="rgba(255,255,255,0.15)" style={{ marginRight: 16 }} />
        )}
      </View>
    </TouchableOpacity>
  );
}

const S = StyleSheet.create({
  overlay: { flex: 1, flexDirection: 'row' },
  safeArea: { flex: 1, flexDirection: 'row' },
  drawer: { 
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  drawerBorderRight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  header: { 
    paddingHorizontal: 20, 
    paddingTop: Platform.OS === 'android' ? 44 : 20, 
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerTopRow: {
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 16,
  },
  title: { fontSize: 16, fontWeight: '500', color: '#FFFFFF', letterSpacing: 0.3 },
  closeBtn: { 
    width: 32, 
    height: 32, 
    borderRadius: 16, 
    alignItems: 'center', 
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    height: 36,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#FFF',
    paddingVertical: 8,
    fontWeight: '400',
  },
  scrollContent: { paddingBottom: 80, paddingTop: 8 },
  
  catSection: { 
    marginBottom: 4, 
    marginHorizontal: -4,
  },
  catHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingVertical: 14, 
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  catHeaderExpanded: {
  },
  colorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  catHeaderText: { fontSize: 15, fontWeight: '400', color: 'rgba(255,255,255,0.85)', letterSpacing: 0.2 },
  catSubHeaderText: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2, letterSpacing: 0.5, textTransform: 'uppercase' },
  catCount: { fontSize: 12, color: 'rgba(255,255,255,0.3)', fontWeight: '400' },
  catCountExpanded: { color: 'rgba(255,255,255,0.6)' },
  catContent: { paddingTop: 0, paddingBottom: 10, paddingHorizontal: 4 },

  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 12, borderRadius: 10, overflow: 'hidden', marginVertical: 2 },
  rowActive: { backgroundColor: 'rgba(255,255,255,0.05)' },
  rowBody: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 12, paddingVertical: 12 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.06)' },
  rowTitle: { fontSize: 14, fontWeight: '400', color: 'rgba(255,255,255,0.75)', marginBottom: 2, letterSpacing: 0.2 },
  rowDesc: { fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: '400' },
});
