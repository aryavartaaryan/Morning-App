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
                      <View style={S.listGrid}>
                        {catSounds.map(item => (
                          <SoundListCard 
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
                <View style={S.listGrid}>
                  {filteredSounds.map(item => (
                    <SoundListCard 
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
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim, zIndex: 100, elevation: 100, justifyContent: 'center', alignItems: 'center' }]}>
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



function SoundListCard({ 
  sound, isSelected, isPreviewing, isLoading, status, progress, onSelect, onTogglePreview 
}: { 
  sound: AlarmSoundItem, isSelected: boolean, isPreviewing: boolean, isLoading?: boolean, status?: string, progress?: number, onSelect: () => void, onTogglePreview: () => void 
}) {
  const highlightColor = sound.color || PRIMARY;
  const imageUri = SOUND_IMAGES[sound.id];

  return (
    <TouchableOpacity 
      style={[
        S.listCardWrapper,
        isSelected && { borderColor: highlightColor, backgroundColor: highlightColor + '15' }
      ]}
      onPress={onSelect}
      activeOpacity={0.8}
    >
      <View style={S.listCardThumb}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <LinearGradient colors={[highlightColor + '40', 'rgba(0,0,0,0.8)']} style={StyleSheet.absoluteFillObject} />
        )}
        <View style={S.listCardEmojiWrap}>
          <Text style={{ fontSize: 22 }}>{sound.emoji || '🎵'}</Text>
        </View>
      </View>

      <View style={S.listCardInfo}>
        <Text style={[S.listCardTitle, isSelected && { color: highlightColor }]} numberOfLines={2}>
          {sound.label}
        </Text>
        <Text style={S.listCardSub} numberOfLines={1}>
          {sound.desc || sound.cat || 'Premium Sound'}
        </Text>
      </View>

      <View style={S.listCardActions}>
        {isSelected && (
          <View style={S.listCardCheck}>
            <Feather name="check-circle" size={20} color={highlightColor} />
          </View>
        )}
        <TouchableOpacity 
          style={[S.listCardPlayBtn, isPreviewing && { backgroundColor: highlightColor + '40', borderColor: highlightColor }]}
          onPress={onTogglePreview}
          activeOpacity={0.8}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
        >
          {isLoading ? (
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: highlightColor }} />
          ) : status === 'downloading' ? (
            <Text style={{ fontSize: 9, fontFamily: 'Nunito_800ExtraBold', color: '#fff' }}>{Math.round((progress ?? 0) * 100)}%</Text>
          ) : isPreviewing ? (
            <Feather name="square" size={14} color={highlightColor} />
          ) : (
            <Feather name="play" size={16} color="rgba(255,255,255,0.9)" style={{ marginLeft: 2 }} />
          )}
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
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
  listGrid: {
    flexDirection: 'column',
    gap: 12,
  },
  listCardWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 80,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
    paddingRight: 12,
  },
  listCardThumb: {
    width: 80,
    height: 80,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  listCardEmojiWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  listCardInfo: {
    flex: 1,
    paddingLeft: 14,
    justifyContent: 'center',
  },
  listCardTitle: {
    fontSize: 15,
    fontFamily: 'Nunito_800ExtraBold',
    color: '#ffffff',
    marginBottom: 4,
    lineHeight: 18,
  },
  listCardSub: {
    fontSize: 11,
    fontFamily: 'Nunito_600SemiBold',
    color: 'rgba(255,255,255,0.5)',
  },
  listCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  listCardCheck: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  listCardPlayBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
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
