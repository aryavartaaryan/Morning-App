import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform, SafeAreaView, LayoutAnimation } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

export default function SoundLibraryModal({
  visible,
  onClose,
  sounds,
  playingId,
  onPlaySound,
}: {
  visible: boolean;
  onClose: () => void;
  sounds: any[];
  playingId: string | null;
  onPlaySound: (id: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setSearchQuery('');
      setExpandedCat(null);
    }
  }, [visible]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    sounds.forEach(s => {
      if (s.cat) cats.add(s.cat);
    });
    return Array.from(cats).sort();
  }, [sounds]);

  const filteredSounds = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const lowerQ = searchQuery.toLowerCase();
    return sounds
      .filter(s => (s.label?.toLowerCase() || '').includes(lowerQ) || (s.cat?.toLowerCase() || '').includes(lowerQ))
      .sort((a, b) => (a.label || '').localeCompare(b.label || ''));
  }, [searchQuery, sounds]);

  const toggleCat = (cat: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedCat(prev => prev === cat ? null : cat);
  };

  const renderCategoriesAccordion = () => (
    <View style={{ marginTop: 4 }}>
      {categories.map(cat => {
        const catSounds = sounds
          .filter(s => s.cat === cat)
          .sort((a, b) => (a.label || '').localeCompare(b.label || ''));
        const isExpanded = expandedCat === cat;
        
        return (
          <View key={cat} style={S.catSection}>
            <TouchableOpacity onPress={() => toggleCat(cat)} activeOpacity={0.7} style={S.catHeader}>
              <Text style={[S.catHeaderText, isExpanded && { color: '#FFF' }]}>{cat}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={S.catCount}>{catSounds.length}</Text>
                <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={14} color="rgba(255,255,255,0.3)" style={{ marginLeft: 6 }} />
              </View>
            </TouchableOpacity>
            
            {isExpanded && (
              <View style={S.catContent}>
                {catSounds.map((sound, idx) => {
                  const isLast = idx === catSounds.length - 1;
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
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={S.overlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={S.sheet}>
              {/* Header */}
              <View style={S.header}>
                <Text style={S.title}>Nada Library</Text>
                <TouchableOpacity onPress={onClose} style={S.closeBtn}>
                  <Ionicons name="close" size={20} color="rgba(255,255,255,0.7)" />
                </TouchableOpacity>
              </View>

              {/* Search Bar */}
              <View style={S.searchContainer}>
                <Ionicons name="search" size={16} color="rgba(255,255,255,0.4)" style={S.searchIcon} />
                <TextInput
                  style={S.searchInput}
                  placeholder="Search sounds, ragas..."
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')} style={S.clearBtn}>
                    <Ionicons name="close-circle" size={14} color="rgba(255,255,255,0.5)" />
                  </TouchableOpacity>
                )}
              </View>

              {/* List */}
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={S.scrollContent}>
                {searchQuery.trim() ? (
                  <View style={S.catSection}>
                    {filteredSounds.length > 0 ? (
                      filteredSounds.map((sound, idx) => (
                        <SoundRow 
                          key={sound.id} 
                          sound={sound} 
                          isPlaying={playingId === sound.id} 
                          onPress={() => onPlaySound(sound.id)} 
                          isLast={idx === filteredSounds.length - 1}
                        />
                      ))
                    ) : (
                      <Text style={S.emptyText}>No sounds found for "{searchQuery}"</Text>
                    )}
                  </View>
                ) : (
                  renderCategoriesAccordion()
                )}
              </ScrollView>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function SoundRow({ sound, isPlaying, onPress, isLast }: { sound: any, isPlaying: boolean, onPress: () => void, isLast?: boolean }) {
  return (
    <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }} style={[S.row, isPlaying && S.rowActive]}>
      <View style={[S.iconBox, { backgroundColor: sound.color ? sound.color + '20' : 'rgba(255,255,255,0.08)' }]}>
        <Text style={{ fontSize: 13 }}>{sound.emoji || '🎵'}</Text>
      </View>
      <View style={[S.rowBody, !isLast && S.rowBorder]}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={[S.rowTitle, isPlaying && { color: sound.color || '#FFF' }]} numberOfLines={1}>{sound.label}</Text>
          {sound.desc ? <Text style={S.rowDesc} numberOfLines={1}>{sound.desc}</Text> : null}
        </View>
        {isPlaying ? (
          <Ionicons name="stats-chart" size={12} color={sound.color || '#FFF'} />
        ) : (
          <Ionicons name="play" size={12} color="rgba(255,255,255,0.2)" />
        )}
      </View>
    </TouchableOpacity>
  );
}

const S = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { 
    flex: 1, 
    backgroundColor: '#000000', 
    borderTopLeftRadius: 24, 
    borderTopRightRadius: 24, 
    marginTop: 50, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.06)' 
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16 },
  title: { fontSize: 18, fontWeight: '700', color: '#FFF', fontFamily: 'Nunito_700Bold', letterSpacing: 0.3 },
  closeBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1C1C1E', marginHorizontal: 20, borderRadius: 10, paddingHorizontal: 12, height: 38, marginBottom: 16 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, color: '#FFF', fontSize: 14, fontFamily: 'Nunito_400Regular', height: '100%' },
  clearBtn: { padding: 4 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 60 },
  
  catSection: { marginBottom: 16, backgroundColor: '#101012', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.03)' },
  catHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 },
  catHeaderText: { fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.85)', fontFamily: 'Nunito_600SemiBold', letterSpacing: 0.2 },
  catCount: { fontSize: 12, color: 'rgba(255,255,255,0.3)', fontFamily: 'Nunito_400Regular' },
  catContent: { paddingBottom: 4 },

  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16 },
  rowActive: { backgroundColor: 'rgba(255,255,255,0.03)' },
  iconBox: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 12, paddingVertical: 10, paddingRight: 16 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.06)' },
  rowTitle: { fontSize: 14, fontWeight: '500', color: '#E5E5E5', marginBottom: 2, fontFamily: 'Nunito_500Medium' },
  rowDesc: { fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: 'Nunito_400Regular' },
  emptyText: { color: 'rgba(255,255,255,0.4)', textAlign: 'center', paddingVertical: 30, fontSize: 13, fontFamily: 'Nunito_400Regular' },
});
