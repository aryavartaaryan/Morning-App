import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, SectionList, Platform, SafeAreaView, Dimensions, TextInput, ScrollView, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

const { width: W, height: H } = Dimensions.get('window');
const SKY_BLUE = '#0ea5e9'; // Sci-fi calming sky blue

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

  const renderSectionHeader = ({ section }: { section: { title: string } }) => (
    <View style={S.sectionHeader}>
      <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFillObject} />
      <Text style={S.sectionHeaderTxt}>{section.title}</Text>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <BlurView intensity={70} tint="dark" style={S.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        
        <SafeAreaView style={S.safeArea} pointerEvents="box-none">
          <View style={S.drawer}>
            <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFillObject} />
            {/* Deep Sky-Blue Sci-Fi Gradient */}
            <LinearGradient colors={['rgba(4,16,35,0.85)', 'rgba(2,8,20,0.95)']} style={StyleSheet.absoluteFillObject} />
            
            <View style={S.header}>
              <View style={S.headerTopRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={S.title}>Soundscapes</Text>
                </View>
                <TouchableOpacity onPress={onClose} style={S.closeBtn} activeOpacity={0.7}>
                  <Ionicons name="close" size={20} color={SKY_BLUE} />
                </TouchableOpacity>
              </View>
              
              <View style={S.searchContainer}>
                <Ionicons name="search" size={18} color={SKY_BLUE + '80'} style={{ marginLeft: 16, marginRight: 8 }} />
                <TextInput
                  style={S.searchInput}
                  placeholder="Search sounds, mantras..."
                  placeholderTextColor="rgba(14,165,233,0.4)"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 8, marginRight: 4 }}>
                    <Ionicons name="close-circle" size={18} color={SKY_BLUE + '80'} />
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
                  <Text style={{ color: SKY_BLUE + '80', fontSize: 15 }}>No sounds found matching "{searchQuery}"</Text>
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
  const pulseAnim = useRef(new Animated.Value(0.1)).current;

  useEffect(() => {
    if (isSelected || isPreviewing) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0.2, duration: 1500, useNativeDriver: true })
        ])
      ).start();
    } else {
      pulseAnim.setValue(0);
      pulseAnim.stopAnimation();
    }
  }, [isSelected, isPreviewing]);

  return (
    <View style={[S.row, (isSelected || isPreviewing) && S.rowSelected]}>
      {/* Sci-Fi Pulsing Glow */}
      {(isSelected || isPreviewing) && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: pulseAnim }]}>
          <LinearGradient
            colors={[SKY_BLUE + '30', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>
      )}
      
      {/* Tapping the main body selects the sound */}
      <TouchableOpacity 
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onSelect(); }} 
        style={S.rowSelectArea} 
        activeOpacity={0.7}
      >
        <View style={[S.emojiContainer, (isSelected || isPreviewing) && { backgroundColor: SKY_BLUE + '20', borderWidth: 1, borderColor: SKY_BLUE + '40' }]}>
          <Text style={{ fontSize: 18, textAlign: 'center' }}>{sound.emoji || '🎵'}</Text>
        </View>
        <View style={{ flex: 1, paddingRight: 10, paddingLeft: 12 }}>
          <Text style={[S.rowTitle, isSelected && { color: SKY_BLUE }]} numberOfLines={1}>{sound.label}</Text>
          {isSelected ? (
            <Text style={{ fontSize: 10, fontFamily: 'Nunito_800ExtraBold', color: SKY_BLUE, marginTop: 1, letterSpacing: 1 }}>SELECTED</Text>
          ) : sound.desc ? (
            <Text style={{ fontSize: 11, fontFamily: 'Nunito_400Regular', color: 'rgba(14,165,233,0.5)', marginTop: 1 }} numberOfLines={1}>{sound.desc}</Text>
          ) : null}
        </View>
      </TouchableOpacity>

      {/* Tapping the play/pause button specifically toggles preview */}
      <TouchableOpacity 
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onTogglePreview(); }}
        style={[S.playBtn, isPreviewing && { backgroundColor: SKY_BLUE, borderWidth: 0 }]}
        activeOpacity={0.8}
      >
        {isLoading ? (
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: isPreviewing ? '#020617' : SKY_BLUE }} />
        ) : status === 'downloading' ? (
          <Text style={{ fontSize: 8, fontFamily: 'Nunito_800ExtraBold', color: isPreviewing ? '#020617' : SKY_BLUE }}>{Math.round((progress ?? 0) * 100)}%</Text>
        ) : isPreviewing ? (
          <Ionicons name="pause" size={14} color="#041023" />
        ) : (
          <Ionicons name="play" size={14} color={SKY_BLUE} style={{ marginLeft: 2 }} />
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
    height: H * 0.85,
    backgroundColor: 'transparent',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  header: { 
    paddingHorizontal: 20, 
    paddingTop: 24, 
    paddingBottom: 12,
  },
  headerTopRow: {
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 16,
  },
  title: { fontSize: 22, fontFamily: 'Nunito_800ExtraBold', color: SKY_BLUE, letterSpacing: 0, textShadowColor: SKY_BLUE + '40', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 },
  closeBtn: { 
    width: 32, 
    height: 32, 
    borderRadius: 16, 
    alignItems: 'center', 
    justifyContent: 'center',
    backgroundColor: SKY_BLUE + '15',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,5,15,0.4)',
    borderRadius: 12,
    height: 42,
    borderWidth: 1,
    borderColor: SKY_BLUE + '20',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Nunito_600SemiBold',
    color: SKY_BLUE,
    paddingVertical: 8,
  },
  
  categoryPillsWrapper: {
    paddingVertical: 4,
    marginBottom: 6,
  },
  categoryPillsContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  catPill: {
    backgroundColor: SKY_BLUE + '10',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: SKY_BLUE + '20',
  },
  catPillTxt: {
    color: SKY_BLUE,
    fontSize: 12,
    fontFamily: 'Nunito_700Bold',
  },

  listContent: { paddingBottom: 100, paddingHorizontal: 12 },
  
  sectionHeader: {
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionHeaderTxt: {
    fontSize: 12,
    fontFamily: 'Nunito_800ExtraBold',
    color: SKY_BLUE + 'AA',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },

  row: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 10,
    marginVertical: 2,
    borderRadius: 16, 
    overflow: 'hidden',
    height: 60,
  },
  rowSelected: { 
    backgroundColor: 'rgba(14,165,233,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(14,165,233,0.15)',
  },
  rowSelectArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
  },
  emojiContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,5,15,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { 
    fontSize: 15, 
    fontFamily: 'Nunito_700Bold',
    color: '#E0F2FE', 
    letterSpacing: 0.2 
  },
  
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,5,15,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: SKY_BLUE + '30',
  }
});
