import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Platform, SafeAreaView, LayoutAnimation, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

const { width: W } = Dimensions.get('window');

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
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
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

  const toggleCat = (cat: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedCat(prev => prev === cat ? null : cat);
  };

  const renderCategoriesAccordion = () => (
    <View style={{ marginTop: 10, paddingHorizontal: 20, paddingBottom: 40 }}>
      {categories.map((cat, idx) => {
        const catSounds = sounds
          .filter(s => s.cat === cat)
          .sort((a, b) => (a.label || '').localeCompare(b.label || ''));
        const isExpanded = expandedCat === cat;
        
        return (
          <View key={cat} style={[S.catSection, isExpanded && S.catSectionExpanded]}>
            <TouchableOpacity onPress={() => toggleCat(cat)} activeOpacity={0.7} style={[S.catHeader, isExpanded && S.catHeaderExpanded]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[S.catIconWrapper, isExpanded && S.catIconWrapperExpanded]}>
                  <Ionicons name={isExpanded ? "folder-open" : "folder-outline"} size={18} color={isExpanded ? "#FFFFFF" : "rgba(255,255,255,0.7)"} />
                </View>
                <Text style={[S.catHeaderText, isExpanded && S.catHeaderTextExpanded]}>{cat}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[S.catBadge, isExpanded && S.catBadgeExpanded]}>
                  <Text style={[S.catCount, isExpanded && S.catCountExpanded]}>{catSounds.length}</Text>
                </View>
                <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={16} color={isExpanded ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.3)"} style={{ marginLeft: 12 }} />
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
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <BlurView intensity={40} tint="dark" style={S.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <SafeAreaView style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
          <View style={S.sheet}>
            <LinearGradient colors={['#242426', '#050505']} style={StyleSheet.absoluteFillObject} />
            
            {/* Subtle light edge at the top */}
            <View style={S.sheetBorderTop} />
            
            {/* Top Highlight line for 3D effect */}
            <View style={S.sheetTopHighlight} />

            {/* Header */}
            <View style={S.header}>
              <View style={{ flex: 1 }}>
                <Text style={S.subtitle}>CURATED COLLECTION</Text>
                <Text style={S.title}>Nada Library</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={S.closeBtn} activeOpacity={0.7}>
                <Ionicons name="close" size={20} color="rgba(255,255,255,0.8)" />
              </TouchableOpacity>
            </View>

            {/* List */}
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={S.scrollContent}>
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
      <View style={[S.iconBox, { backgroundColor: sound.color ? sound.color + '15' : 'rgba(255,255,255,0.05)' }, isPlaying && { backgroundColor: sound.color ? sound.color + '30' : 'rgba(255,255,255,0.1)' }]}>
        <Text style={{ fontSize: 20 }}>{sound.emoji || '🎵'}</Text>
      </View>
      <View style={[S.rowBody, !isLast && S.rowBorder, isPlaying && { borderBottomColor: 'transparent' }]}>
        <View style={{ flex: 1, paddingRight: 16 }}>
          <Text style={[S.rowTitle, isPlaying && { color: sound.color || '#FFFFFF', fontWeight: '600' }]} numberOfLines={1}>{sound.label}</Text>
          {sound.desc ? <Text style={[S.rowDesc, isPlaying && { color: 'rgba(255,255,255,0.6)' }]} numberOfLines={1}>{sound.desc}</Text> : null}
        </View>
        {isPlaying ? (
          <View style={S.playingIndicatorBadge}>
            <Ionicons name="cellular" size={14} color={sound.color || '#FFFFFF'} />
          </View>
        ) : (
          <Ionicons name="play" size={18} color="rgba(255,255,255,0.2)" style={{ marginRight: 20 }} />
        )}
      </View>
    </TouchableOpacity>
  );
}

const S = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { 
    flex: 0.9, 
    borderTopLeftRadius: 40, 
    borderTopRightRadius: 40, 
    overflow: 'hidden',
    backgroundColor: '#000',
    shadowColor: '#000',
    shadowOpacity: 0.8,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: -10 },
  },
  sheetBorderTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  sheetTopHighlight: {
    position: 'absolute',
    top: 14,
    alignSelf: 'center',
    width: 48,
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 3,
  },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 28, 
    paddingTop: 50, 
    paddingBottom: 32,
  },
  title: { fontSize: 34, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.5, marginTop: 6 },
  subtitle: { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '700', letterSpacing: 2.5 },
  closeBtn: { 
    width: 42, 
    height: 42, 
    borderRadius: 21, 
    alignItems: 'center', 
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  scrollContent: { paddingBottom: 60 },
  
  catSection: { 
    marginBottom: 16, 
    backgroundColor: 'rgba(255,255,255,0.03)', 
    borderRadius: 28, 
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden'
  },
  catSectionExpanded: {
    backgroundColor: 'rgba(255,255,255,0.05)', 
    borderColor: 'rgba(255,255,255,0.08)',
  },
  catHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingVertical: 22, 
    paddingHorizontal: 22,
  },
  catHeaderExpanded: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    paddingBottom: 18,
  },
  catIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  catIconWrapperExpanded: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  catHeaderText: { fontSize: 19, fontWeight: '500', color: 'rgba(255,255,255,0.85)', letterSpacing: 0.3 },
  catHeaderTextExpanded: { color: '#FFFFFF', fontWeight: '600' },
  catBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  catBadgeExpanded: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  catCount: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '700' },
  catCountExpanded: { color: '#FFFFFF' },
  catContent: { paddingTop: 6, paddingBottom: 10 },

  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 22, position: 'relative', overflow: 'hidden' },
  rowActive: { },
  iconBox: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 18, paddingVertical: 18 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  rowTitle: { fontSize: 17, fontWeight: '500', color: 'rgba(255,255,255,0.9)', marginBottom: 5, letterSpacing: 0.2 },
  rowDesc: { fontSize: 14, color: 'rgba(255,255,255,0.45)' },
  
  playingIndicatorBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 20,
  }
});

