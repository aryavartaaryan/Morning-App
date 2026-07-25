import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Platform, SafeAreaView, LayoutAnimation, Dimensions, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';

const { width: W, height: H } = Dimensions.get('window');

export default function SoundLibraryModal({
  visible,
  onClose,
  sounds,
  playingId,
  onPlaySound,
  initialCategory,
}: {
  visible: boolean;
  onClose: () => void;
  sounds: any[];
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
    setExpandedCat(prev => prev === cat ? null : cat);
  };

  const filteredSounds = useMemo(() => {
    if (!searchQuery.trim()) return sounds;
    const q = searchQuery.toLowerCase();
    return sounds.filter(s => 
      s.label?.toLowerCase().includes(q) || 
      s.desc?.toLowerCase().includes(q) ||
      s.cat?.toLowerCase().includes(q)
    );
  }, [sounds, searchQuery]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    filteredSounds.forEach(s => {
      if (s.cat) cats.add(s.cat);
    });
    return Array.from(cats).sort();
  }, [filteredSounds]);

  const isExpandedView = expandedCat !== null || searchQuery.length > 0;
  
  const drawerDynamicStyle: any = {
    width: '100%',
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  };

  const renderCategoriesAccordion = () => (
    <View style={{ paddingTop: 10, paddingHorizontal: 16, paddingBottom: 40 }}>
      {categories.length === 0 && searchQuery.length > 0 && (
        <Text style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 40, fontSize: 14 }}>No sounds found matching "{searchQuery}"</Text>
      )}
      {categories.map((cat, idx) => {
        const catSounds = filteredSounds
          .filter(s => s.cat === cat)
          .sort((a, b) => (a.label || '').localeCompare(b.label || ''));
        
        const isExpanded = expandedCat === cat || searchQuery.length > 0;
        
        return (
          <View key={cat} style={[S.catSection, isExpanded && S.catSectionExpanded]}>
            <TouchableOpacity onPress={() => toggleCat(cat)} activeOpacity={0.7} style={[S.catHeader, isExpanded && S.catHeaderExpanded]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name={isExpanded ? "folder-open-outline" : "folder-outline"} size={16} color={isExpanded ? "#FFF" : "rgba(255,255,255,0.5)"} style={{ marginRight: 12 }} />
                <Text style={[S.catHeaderText, isExpanded && S.catHeaderTextExpanded]}>{cat}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[S.catCount, isExpanded && S.catCountExpanded]}>{catSounds.length}</Text>
                <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={14} color={isExpanded ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.2)"} style={{ marginLeft: 8 }} />
              </View>
            </TouchableOpacity>
            
            {isExpanded && (
              <View style={S.catContent}>
                {catSounds.map((sound, sIdx) => {
                  const isLast = sIdx === catSounds.length - 1;
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
    <Modal visible={visible} animationType="none" transparent onRequestClose={onClose}>
      <BlurView intensity={25} tint="dark" style={S.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        
        {/* Sleek Side Drawer Panel */}
        <SafeAreaView style={S.safeArea} pointerEvents="box-none">
          <View style={[S.drawer, drawerDynamicStyle]}>
            <BlurView intensity={75} tint="dark" style={StyleSheet.absoluteFillObject} />
            <LinearGradient colors={['rgba(15,15,18,0.65)', 'rgba(8,8,10,0.80)']} style={StyleSheet.absoluteFillObject} />
            
            {/* Minimalist right border */}
            <View style={S.drawerBorderRight} />

            {/* Header */}
            <View style={S.header}>
              <View style={S.headerTopRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="musical-notes-outline" size={18} color="rgba(255,255,255,0.8)" style={{ marginRight: 8 }} />
                  <Text style={S.title}>Nada Library</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onClose(); router.push('/(tabs)/settings' as never); }} style={[S.premiumBtn, { marginRight: 12 }]} activeOpacity={0.7}>
                    <Ionicons name="settings-outline" size={17} color="rgba(255,255,255,0.95)" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={onClose} style={S.closeBtn} activeOpacity={0.7}>
                    <Ionicons name="close" size={16} color="rgba(255,255,255,0.6)" />
                  </TouchableOpacity>
                </View>
              </View>
              
              <View style={S.searchContainer}>
                <Ionicons name="search" size={16} color="rgba(255,255,255,0.4)" style={{ marginLeft: 12, marginRight: 8 }} />
                <TextInput
                  style={S.searchInput}
                  placeholder="Search sounds, ragas..."
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
                    <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.4)" />
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
      {isPlaying && (
        <LinearGradient
          colors={[(sound.color || '#FFFFFF') + '15', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFillObject}
        />
      )}
      <Text style={{ fontSize: 16, width: 24, textAlign: 'center' }}>{sound.emoji || '🎵'}</Text>
      <View style={[S.rowBody, !isLast && S.rowBorder, isPlaying && { borderBottomColor: 'transparent' }]}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={[S.rowTitle, isPlaying && { color: sound.color || '#FFFFFF', fontWeight: '500' }]} numberOfLines={1}>{sound.label}</Text>
          {sound.desc ? <Text style={[S.rowDesc, isPlaying && { color: 'rgba(255,255,255,0.4)' }]} numberOfLines={1}>{sound.desc}</Text> : null}
        </View>
        {isPlaying ? (
          <Ionicons name="cellular" size={14} color={sound.color || '#FFFFFF'} style={{ marginRight: 16 }} />
        ) : (
          <Ionicons name="play" size={14} color="rgba(255,255,255,0.15)" style={{ marginRight: 16 }} />
        )}
      </View>
    </TouchableOpacity>
  );
}

const S = StyleSheet.create({
  overlay: { flex: 1, flexDirection: 'row' },
  safeArea: { flex: 1, flexDirection: 'row' },
  drawer: { 
    height: '100%',
    backgroundColor: 'transparent',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 30,
    shadowOffset: { width: 10, height: 0 },
  },
  drawerBorderRight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  header: { 
    paddingHorizontal: 20, 
    paddingTop: Platform.OS === 'android' ? 40 : 20, 
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  headerTopRow: {
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 16,
  },
  title: { fontSize: 16, fontWeight: '500', color: '#FFFFFF', letterSpacing: 0.5 },
  premiumBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  closeBtn: { 
    width: 28, 
    height: 28, 
    borderRadius: 14, 
    alignItems: 'center', 
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    height: 38,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.02)',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#FFF',
    paddingVertical: 8,
  },
  scrollContent: { paddingBottom: 60 },
  
  catSection: { 
    marginBottom: 6, 
  },
  catSectionExpanded: {
  },
  catHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingVertical: 14, 
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  catHeaderExpanded: {
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  catHeaderText: { fontSize: 14, fontWeight: '400', color: 'rgba(255,255,255,0.75)', letterSpacing: 0.2 },
  catHeaderTextExpanded: { color: '#FFFFFF', fontWeight: '500' },
  catCount: { fontSize: 12, color: 'rgba(255,255,255,0.3)', fontWeight: '500' },
  catCountExpanded: { color: 'rgba(255,255,255,0.6)' },
  catContent: { paddingTop: 2, paddingBottom: 8 },

  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 10, borderRadius: 12, overflow: 'hidden', marginVertical: 1 },
  rowActive: { backgroundColor: 'rgba(255,255,255,0.03)' },
  rowBody: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 10, paddingVertical: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.02)' },
  rowTitle: { fontSize: 14, fontWeight: '400', color: 'rgba(255,255,255,0.7)', marginBottom: 2, letterSpacing: 0.2 },
  rowDesc: { fontSize: 12, color: 'rgba(255,255,255,0.3)' },
});


