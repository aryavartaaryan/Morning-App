import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, SectionList, Platform, SafeAreaView, Dimensions, TextInput, ScrollView, Animated } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

const { width: W, height: H } = Dimensions.get('window');
const PRIMARY = '#c4b5fd'; // Soft premium purple

export type AlarmSoundItem = {
  id: string;
  label: string;
  emoji: string;
  cat: string;
  color: string;
  audioUrl?: string | null;
  desc?: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  sounds: AlarmSoundItem[];
  selectedId: string;
  previewingId: string | null;
  previewLoadingId?: string | null;
  onSelectSound: (id: string) => void;
  onTogglePreview: (snd: AlarmSoundItem) => void;
  dlStatus?: Record<string, 'idle' | 'downloading' | 'downloaded'>;
  dlProgress?: Record<string, number>;
};

export default function AlarmSoundLibraryModal({
  visible,
  onClose,
  sounds,
  selectedId,
  previewingId,
  previewLoadingId,
  onSelectSound,
  onTogglePreview,
  dlStatus,
  dlProgress,
}: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const sectionListRef = useRef<SectionList>(null);

  useEffect(() => {
    if (visible) {
      setSearchQuery('');
    }
  }, [visible]);

  const sections = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const filtered = q 
      ? sounds.filter(s => s.label?.toLowerCase().includes(q) || s.cat?.toLowerCase().includes(q))
      : sounds;

    const cats = new Set<string>();
    filtered.forEach(s => { if (s.cat) cats.add(s.cat); });
    const catArray = Array.from(cats).sort();

    return catArray.map(cat => ({
      title: cat,
      data: filtered.filter(s => s.cat === cat)
    }));
  }, [sounds, searchQuery]);

  const jumpToCategory = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      sectionListRef.current?.scrollToLocation({ sectionIndex: index, itemIndex: 0, animated: true });
    } catch {}
  };

  const renderSectionHeader = ({ section }: { section: any }) => (
    <View style={S.sectionHeader}>
      <Text style={S.sectionHeaderTxt}>{section.title}</Text>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <BlurView intensity={40} tint="dark" style={S.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        
        <SafeAreaView style={S.safeArea} pointerEvents="box-none">
          <View style={S.drawer}>
            <LinearGradient colors={['rgba(12,12,16,0.98)', 'rgba(4,4,6,1)']} style={StyleSheet.absoluteFillObject} />
            <View style={S.drawerBorderTop} />
            
            <View style={S.header}>
              <View style={S.headerTopRow}>
                <Text style={S.title}>Premium Sound Library</Text>
                <TouchableOpacity onPress={onClose} style={S.closeBtn} activeOpacity={0.7}>
                  <Feather name="x" size={18} color="rgba(255,255,255,0.6)" />
                </TouchableOpacity>
              </View>
              
              <View style={S.searchContainer}>
                <Feather name="search" size={16} color="rgba(255,255,255,0.4)" style={{ marginLeft: 16, marginRight: 8 }} />
                <TextInput
                  style={S.searchInput}
                  placeholder="Search sounds, mantras..."
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 8, marginRight: 4 }}>
                    <Feather name="x-circle" size={16} color="rgba(255,255,255,0.4)" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Compact Category Pills */}
            {!searchQuery && sections.length > 0 && (
              <View style={S.categoryPillsWrapper}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.categoryPillsContent}>
                  {sections.map((sec, idx) => (
                    <TouchableOpacity key={sec.title} onPress={() => jumpToCategory(idx)} style={S.catPill}>
                      <Text style={S.catPillTxt}>{sec.title}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <SectionList
              ref={sectionListRef}
              sections={sections}
              keyExtractor={(item) => item.id}
              contentContainerStyle={S.listContent}
              renderSectionHeader={renderSectionHeader}
              stickySectionHeadersEnabled={true}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              renderItem={({ item, index, section }) => {
                const isSelected = selectedId === item.id;
                const isPreviewing = previewingId === item.id;
                const isLoading = previewLoadingId === item.id;
                const status = dlStatus?.[item.id];
                const progress = dlProgress?.[item.id];
                
                return (
                  <SoundRow 
                    sound={item} 
                    isSelected={isSelected}
                    isPreviewing={isPreviewing}
                    isLoading={isLoading}
                    status={status}
                    progress={progress}
                    onSelect={() => onSelectSound(item.id)}
                    onTogglePreview={() => onTogglePreview(item)} 
                  />
                );
              }}
              ListEmptyComponent={
                <View style={{ paddingTop: 60, alignItems: 'center' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, fontFamily: 'Nunito_400Regular' }}>No sounds found matching "{searchQuery}"</Text>
                </View>
              }
            />
          </View>
        </SafeAreaView>
      </BlurView>
    </Modal>
  );
}

function SoundRow({ 
  sound, isSelected, isPreviewing, isLoading, status, progress, onSelect, onTogglePreview 
}: { 
  sound: AlarmSoundItem, isSelected: boolean, isPreviewing: boolean, isLoading?: boolean, status?: string, progress?: number, onSelect: () => void, onTogglePreview: () => void 
}) {
  const highlightColor = sound.color || PRIMARY;

  return (
    <View style={[S.row, isSelected && { backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.1)' }]}>
      {isSelected && (
        <LinearGradient
          colors={[highlightColor + '15', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFillObject}
        />
      )}
      
      <TouchableOpacity 
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onSelect(); }} 
        style={S.rowSelectArea} 
        activeOpacity={0.7}
      >
        <View style={[S.emojiContainer, isSelected && { backgroundColor: highlightColor + '20', borderColor: highlightColor + '40' }]}>
          <Text style={{ fontSize: 18, textAlign: 'center' }}>{sound.emoji || '🎵'}</Text>
        </View>
        <View style={{ flex: 1, paddingRight: 10, paddingLeft: 14 }}>
          <Text style={[S.rowTitle, isSelected && { color: highlightColor }]} numberOfLines={1}>{sound.label}</Text>
          {isSelected ? (
            <Text style={{ fontSize: 9, fontFamily: 'Nunito_800ExtraBold', color: highlightColor, marginTop: 2, letterSpacing: 1.5 }}>SELECTED</Text>
          ) : sound.desc ? (
            <Text style={{ fontSize: 11, fontFamily: 'Nunito_400Regular', color: 'rgba(255,255,255,0.4)', marginTop: 2 }} numberOfLines={1}>{sound.desc}</Text>
          ) : null}
        </View>
      </TouchableOpacity>

      <TouchableOpacity 
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onTogglePreview(); }}
        style={[S.playBtn, isPreviewing && { backgroundColor: 'rgba(255,255,255,0.1)' }]}
        activeOpacity={0.8}
      >
        {isLoading ? (
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: highlightColor }} />
        ) : status === 'downloading' ? (
          <Text style={{ fontSize: 8, fontFamily: 'Nunito_800ExtraBold', color: highlightColor }}>{Math.round((progress ?? 0) * 100)}%</Text>
        ) : isPreviewing ? (
          <Feather name="square" size={12} color={highlightColor} />
        ) : (
          <Feather name="play" size={14} color="rgba(255,255,255,0.6)" style={{ marginLeft: 2 }} />
        )}
      </TouchableOpacity>
    </View>
  );
}

const S = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  safeArea: { flex: 1, justifyContent: 'flex-end' },
  drawer: { 
    width: '100%',
    height: H * 0.88,
    backgroundColor: '#050505',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
  },
  drawerBorderTop: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  header: { 
    paddingHorizontal: 24, 
    paddingTop: 24, 
    paddingBottom: 12,
  },
  headerTopRow: {
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 14,
  },
  title: { fontSize: 15, fontFamily: 'Nunito_800ExtraBold', color: '#ffffff', letterSpacing: 0.5 },
  closeBtn: { 
    width: 28, 
    height: 28, 
    borderRadius: 14, 
    alignItems: 'center', 
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 18,
    height: 36,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Nunito_600SemiBold',
    color: '#ffffff',
    paddingVertical: 8,
  },
  
  categoryPillsWrapper: {
    paddingVertical: 4,
    marginBottom: 8,
  },
  categoryPillsContent: {
    paddingHorizontal: 24,
    gap: 8,
  },
  catPill: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  catPillTxt: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontFamily: 'Nunito_700Bold',
    letterSpacing: 0.5,
  },

  listContent: { paddingBottom: 120, paddingHorizontal: 16 },
  
  sectionHeader: {
    paddingHorizontal: 12,
    paddingTop: 20,
    paddingBottom: 10,
    backgroundColor: 'transparent',
  },
  sectionHeaderTxt: {
    fontSize: 10,
    fontFamily: 'Nunito_800ExtraBold',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

  row: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 12,
    marginVertical: 2,
    borderRadius: 16, 
    overflow: 'hidden',
    height: 48,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  rowSelectArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
  },
  emojiContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  rowTitle: { 
    fontSize: 13, 
    fontFamily: 'Nunito_700Bold',
    color: '#ffffff', 
    letterSpacing: 0.2 
  },
  
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  }
});
