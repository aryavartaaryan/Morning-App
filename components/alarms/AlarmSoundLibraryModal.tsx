import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Platform, SafeAreaView, Dimensions, TextInput, ScrollView, Animated, ImageBackground, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { SOUND_IMAGES } from '@/lib/sleepSoundsData';

const { width: W, height: H } = Dimensions.get('window');
const PRIMARY = '#c4b5fd';

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
  const [selectedCat, setSelectedCat] = useState<string>('All');
  const [confirmSound, setConfirmSound] = useState<AlarmSoundItem | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    if (visible) {
      setSearchQuery('');
      setSelectedCat('All');
      setConfirmSound(null);
    }
  }, [visible]);

  useEffect(() => {
    if (confirmSound) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [confirmSound]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    sounds.forEach(s => { if (s.cat) cats.add(s.cat); });
    return ['All', ...Array.from(cats).sort()];
  }, [sounds]);

  const filteredSounds = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let filtered = sounds;
    if (q) {
      filtered = filtered.filter(s => s.label?.toLowerCase().includes(q) || s.cat?.toLowerCase().includes(q));
    } else if (selectedCat !== 'All') {
      filtered = filtered.filter(s => s.cat === selectedCat);
    }
    return filtered;
  }, [sounds, searchQuery, selectedCat]);

  const handleAttemptSelectSound = (item: AlarmSoundItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setConfirmSound(item);
  };

  const confirmSelection = () => {
    if (confirmSound) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onSelectSound(confirmSound.id);
      setConfirmSound(null);
    }
  };

  const cancelSelection = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setConfirmSound(null);
  };

  const handleTogglePreview = (item: AlarmSoundItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onTogglePreview(item);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill}>
        <LinearGradient colors={['rgba(10,10,16,0.95)', 'rgba(2,2,4,1)']} style={StyleSheet.absoluteFillObject} />
        
        <SafeAreaView style={S.safeArea}>
          <View style={S.header}>
            <View style={S.headerTopRow}>
              <Text style={S.title}>Premium Sound Library</Text>
              <TouchableOpacity onPress={onClose} style={S.closeBtn} activeOpacity={0.7}>
                <Feather name="x" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <View style={S.searchContainer}>
              <Feather name="search" size={18} color="rgba(255,255,255,0.5)" style={{ marginLeft: 16, marginRight: 8 }} />
              <TextInput
                style={S.searchInput}
                placeholder="Search sounds, mantras..."
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 10 }}>
                  <Feather name="x-circle" size={16} color="rgba(255,255,255,0.6)" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {!searchQuery && (
            <View style={S.categoryPillsWrapper}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.categoryPillsContent}>
                {categories.map((cat) => {
                  const isActive = selectedCat === cat;
                  return (
                    <TouchableOpacity 
                      key={cat} 
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelectedCat(cat);
                      }} 
                      style={[S.catPill, isActive && S.catPillActive]}
                      activeOpacity={0.7}
                    >
                      <Text style={[S.catPillTxt, isActive && S.catPillTxtActive]}>
                        {cat === 'All' ? '✨ All' : cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          <ScrollView 
            contentContainerStyle={S.gridContent} 
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {filteredSounds.length === 0 ? (
              <View style={S.emptyState}>
                <Text style={S.emptyStateTxt}>No sounds found matching "{searchQuery}"</Text>
              </View>
            ) : (
              selectedCat === 'All' && !searchQuery ? (
                // Group by category when 'All' is selected and no search
                categories.filter(c => c !== 'All').map(cat => {
                  const catSounds = filteredSounds.filter(s => s.cat === cat);
                  if (catSounds.length === 0) return null;
                  return (
                    <View key={cat} style={{ marginBottom: 24 }}>
                      <Text style={S.categoryHeader}>{cat}</Text>
                      <View style={S.grid}>
                        {catSounds.map(item => (
                          <SoundGridCard 
                            key={item.id}
                            sound={item} 
                            isSelected={selectedId === item.id}
                            isPreviewing={previewingId === item.id}
                            isLoading={previewLoadingId === item.id}
                            status={dlStatus?.[item.id]}
                            progress={dlProgress?.[item.id]}
                            onSelect={() => handleAttemptSelectSound(item)}
                            onTogglePreview={() => handleTogglePreview(item)} 
                          />
                        ))}
                      </View>
                    </View>
                  );
                })
              ) : (
                <View style={S.grid}>
                  {filteredSounds.map(item => (
                    <SoundGridCard 
                      key={item.id}
                      sound={item} 
                      isSelected={selectedId === item.id}
                      isPreviewing={previewingId === item.id}
                      isLoading={previewLoadingId === item.id}
                      status={dlStatus?.[item.id]}
                      progress={dlProgress?.[item.id]}
                      onSelect={() => handleAttemptSelectSound(item)}
                      onTogglePreview={() => handleTogglePreview(item)} 
                    />
                  ))}
                </View>
              )
            )}
          </ScrollView>
        </SafeAreaView>

        {/* Confirmation Dialog Overlay */}
        {confirmSound && (
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim, zIndex: 100, justifyContent: 'center', alignItems: 'center' }]}>
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill}>
              <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={cancelSelection} />
            </BlurView>
            
            <View style={S.confirmBox}>
              <LinearGradient colors={['rgba(30,30,40,0.95)', 'rgba(15,15,22,0.98)']} style={StyleSheet.absoluteFillObject} />
              <View style={S.confirmIconWrap}>
                <Text style={{ fontSize: 28 }}>{confirmSound.emoji}</Text>
              </View>
              <Text style={S.confirmTitle}>Set Alarm Sound</Text>
              <Text style={S.confirmSub}>Do you want to set <Text style={{ color: '#fff', fontFamily: 'Nunito_700Bold' }}>{confirmSound.label}</Text> as your alarm sound?</Text>
              
              <View style={S.confirmActions}>
                <TouchableOpacity style={S.confirmBtnCancel} onPress={cancelSelection} activeOpacity={0.7}>
                  <Text style={S.confirmBtnCancelTxt}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[S.confirmBtnConfirm, { backgroundColor: confirmSound.color || PRIMARY }]} onPress={confirmSelection} activeOpacity={0.8}>
                  <Text style={S.confirmBtnConfirmTxt}>Yes, Set Sound</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        )}
      </BlurView>
    </Modal>
  );
}

const CARD_MARGIN = 6;
// Calculate 3 items per row with margins
const CARD_W = (W - 32 - (CARD_MARGIN * 4)) / 3;
const CARD_H = CARD_W * 1.15; // Slightly taller than square

function SoundGridCard({ 
  sound, isSelected, isPreviewing, isLoading, status, progress, onSelect, onTogglePreview 
}: { 
  sound: AlarmSoundItem, isSelected: boolean, isPreviewing: boolean, isLoading?: boolean, status?: string, progress?: number, onSelect: () => void, onTogglePreview: () => void 
}) {
  const highlightColor = sound.color || PRIMARY;
  const imageUri = SOUND_IMAGES[sound.id];

  return (
    <View style={[S.cardWrapper, isSelected && { borderColor: highlightColor, backgroundColor: highlightColor + '15' }]}>
      <TouchableOpacity 
        style={S.cardMainArea}
        onPress={onSelect}
        activeOpacity={0.8}
      >
        <View style={S.cardInner}>
          {imageUri ? (
            <View style={StyleSheet.absoluteFill}>
              <Image 
                source={{ uri: imageUri }} 
                style={StyleSheet.absoluteFill} 
                resizeMode="cover"
              />
              <LinearGradient
                colors={['rgba(0,0,0,0.0)', 'rgba(0,0,0,0.48)', 'rgba(0,0,0,0.88)']}
                style={StyleSheet.absoluteFillObject}
              />
            </View>
          ) : (
            <LinearGradient
              colors={[highlightColor + '30', 'rgba(0,0,0,0.8)']}
              style={StyleSheet.absoluteFillObject}
            />
          )}

          {isSelected && (
            <View style={S.selectedBadge}>
              <Feather name="check" size={10} color="#fff" />
            </View>
          )}

          <View style={S.cardContent}>
            <View style={S.emojiContainer}>
              <Text style={{ fontSize: 16 }}>{sound.emoji || '🎵'}</Text>
            </View>
            <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: 6 }}>
              <Text style={[S.cardTitle, isSelected && { color: highlightColor }]} numberOfLines={2}>
                {sound.label}
              </Text>
              {isSelected ? (
                <Text style={{ fontSize: 8, fontFamily: 'Nunito_800ExtraBold', color: highlightColor, marginTop: 2, letterSpacing: 1 }}>SELECTED</Text>
              ) : null}
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {/* Play/Pause Button Area positioned at the top right inside the card */}
      <TouchableOpacity 
        style={[S.playBtn, isPreviewing && { backgroundColor: highlightColor + '40', borderColor: highlightColor }]}
        onPress={onTogglePreview}
        activeOpacity={0.8}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        {isLoading ? (
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: highlightColor }} />
        ) : status === 'downloading' ? (
          <Text style={{ fontSize: 8, fontFamily: 'Nunito_800ExtraBold', color: '#fff' }}>{Math.round((progress ?? 0) * 100)}%</Text>
        ) : isPreviewing ? (
          <Feather name="square" size={10} color={highlightColor} />
        ) : (
          <Feather name="play" size={12} color="rgba(255,255,255,0.9)" style={{ marginLeft: 2 }} />
        )}
      </TouchableOpacity>
    </View>
  );
}

const S = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { 
    paddingHorizontal: 24, 
    paddingTop: 16, 
    paddingBottom: 16,
  },
  headerTopRow: {
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 20,
  },
  title: { fontSize: 20, fontFamily: 'Nunito_800ExtraBold', color: '#ffffff', letterSpacing: 0.5 },
  closeBtn: { 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    alignItems: 'center', 
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    height: 48,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Nunito_600SemiBold',
    color: '#ffffff',
    paddingVertical: 10,
  },
  categoryPillsWrapper: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    marginBottom: 8,
  },
  categoryPillsContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  catPill: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  catPillActive: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderColor: 'rgba(255,255,255,0.3)',
  },
  catPillTxt: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontFamily: 'Nunito_700Bold',
    letterSpacing: 0.5,
  },
  catPillTxtActive: {
    color: '#fff',
  },
  gridContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
    paddingTop: 16,
  },
  categoryHeader: {
    fontSize: 18,
    fontFamily: 'Nunito_800ExtraBold',
    color: '#fff',
    marginBottom: 12,
    marginLeft: CARD_MARGIN,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -CARD_MARGIN,
  },
  emptyState: {
    paddingTop: 80,
    alignItems: 'center',
  },
  emptyStateTxt: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 16,
    fontFamily: 'Nunito_400Regular',
  },
  cardWrapper: {
    width: CARD_W,
    height: CARD_H,
    margin: CARD_MARGIN,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  cardMainArea: {
    flex: 1,
  },
  cardInner: {
    flex: 1,
  },
  cardContent: {
    flex: 1,
    padding: 10,
  },
  emojiContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 4,
  },
  cardTitle: { 
    fontSize: 12, 
    fontFamily: 'Nunito_700Bold',
    color: '#ffffff', 
    lineHeight: 16,
  },
  playBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    zIndex: 10,
  },
  selectedBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },

  // Confirmation Box Styles
  confirmBox: {
    width: W * 0.82,
    borderRadius: 28,
    overflow: 'hidden',
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  confirmIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  confirmTitle: {
    fontSize: 18,
    fontFamily: 'Nunito_800ExtraBold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  confirmSub: {
    fontSize: 14,
    fontFamily: 'Nunito_400Regular',
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  confirmActions: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  confirmBtnCancel: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  confirmBtnCancelTxt: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontFamily: 'Nunito_700Bold',
  },
  confirmBtnConfirm: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnConfirmTxt: {
    color: '#000',
    fontSize: 14,
    fontFamily: 'Nunito_800ExtraBold',
  }
});
