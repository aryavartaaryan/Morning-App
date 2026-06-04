import React from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, ImageBackground, StyleSheet,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { SOUND_IMAGES } from '@/lib/sleepSoundsData';
import { getLocalSoundImageUri } from '@/lib/soundImagePreload';

const LALITHA_IMG = require('../../assets/images/mata-lalitha.jpg');

const CAT_COLORS: Record<string, string> = {
  Rain: '#60a5fa', Ocean: '#38bdf8', Nature: '#34d399', Sacred: '#a78bfa',
  'Sitar & Flute': '#f59e0b', Tabla: '#f97316', Birds: '#86efac',
  Tanpura: '#c084fc', World: '#fbbf24', Mantra: '#fbbf24', Stotra: '#c4b5fd',
};

const CAT_EMOJI: Record<string, string> = {
  Rain: '🌧️', Ocean: '🌊', Nature: '🌿', Sacred: '🕉️',
  'Sitar & Flute': '�', Tabla: '🥁', Birds: '🐦',
  Tanpura: '🎵', World: '🌍', Mantra: '📿', Stotra: '🌟',
};

export type AlarmSoundItem = {
  id: string;
  label: string;
  emoji: string;
  cat: string;
  color: string;
};

type Props = {
  sounds: AlarmSoundItem[];
  cats: readonly string[];
  activeCat: string;
  onCatChange: (cat: string) => void;
  selectedId: string;
  onSelect: (id: string) => void;
  previewingId: string | null;
  onTogglePreview: (snd: AlarmSoundItem) => void;
  cardWidth: number;
  catScrollStyle?: ViewStyle;
  gridStyle?: ViewStyle;
};

export default function SoundPicker({
  sounds, cats, activeCat, onCatChange,
  selectedId, onSelect, previewingId, onTogglePreview,
  cardWidth, catScrollStyle, gridStyle,
}: Props) {
  const filteredSounds = sounds.filter(s => s.cat === activeCat);

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={catScrollStyle}
        contentContainerStyle={{ gap: 8 }}
      >
        {cats.map(cat => {
          const isCatActive = activeCat === cat;
          const color = CAT_COLORS[cat] ?? '#FFFFFF55';
          return (
            <TouchableOpacity
              key={cat}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onCatChange(cat); }}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 5,
                paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99, borderWidth: 1,
                borderColor: isCatActive ? color : '#FFFFFF15',
                backgroundColor: isCatActive ? color + '18' : 'transparent',
              }}
            >
              <Text style={{ fontSize: 11 }}>{CAT_EMOJI[cat] ?? '🎵'}</Text>
              <Text style={{ fontSize: 11, fontWeight: '800', color: isCatActive ? color : '#FFFFFF55', letterSpacing: 0.5 }}>
                {cat}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' }, gridStyle]}>
        {filteredSounds.slice(0, 6).map(snd => {
          const active = selectedId === snd.id;
          const previewing = previewingId === snd.id;
          const imgSrc = snd.id === 'lalitha'
            ? LALITHA_IMG
            : (SOUND_IMAGES[snd.id] ? { uri: getLocalSoundImageUri(SOUND_IMAGES[snd.id]) } : undefined);
          return (
            <TouchableOpacity
              key={snd.id}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onSelect(snd.id); }}
              activeOpacity={0.82}
              style={{
                width: '31%', height: 96, borderRadius: 16, overflow: 'hidden',
                borderWidth: active ? 2 : 1, borderColor: active ? snd.color : '#FFFFFF14',
              }}
            >
              <ImageBackground source={imgSrc} style={{ flex: 1 }} imageStyle={{ borderRadius: 15 }}>
                <LinearGradient
                  colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.72)']}
                  style={[StyleSheet.absoluteFillObject, { borderRadius: 15 }]}
                />
                {active && (
                  <View style={[StyleSheet.absoluteFillObject, { borderRadius: 15, backgroundColor: snd.color + '18' }]} />
                )}
                <View style={{ flex: 1, padding: 8, justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <TouchableOpacity
                      onPress={e => { e.stopPropagation?.(); onTogglePreview(snd); }}
                      style={{
                        width: 26, height: 26, borderRadius: 13,
                        backgroundColor: previewing ? snd.color + '40' : 'rgba(0,0,0,0.45)',
                        borderWidth: 1,
                        borderColor: previewing ? snd.color + '80' : 'rgba(255,255,255,0.2)',
                        alignItems: 'center', justifyContent: 'center',
                      }}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Text style={{ fontSize: 9, color: previewing ? snd.color : '#FFFFFFCC' }}>
                        {previewing ? '■' : '▶'}
                      </Text>
                    </TouchableOpacity>
                    <Text style={{ fontSize: 16 }}>{snd.emoji}</Text>
                  </View>
                  <View>
                    <Text
                      style={{ fontSize: 10, fontWeight: '800', color: active ? snd.color : '#FFFFFFEE', lineHeight: 13 }}
                      numberOfLines={2}
                    >
                      {snd.label}
                    </Text>
                    {active && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
                        <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: snd.color }} />
                        <Text style={{ fontSize: 7, color: snd.color, fontWeight: '900' }}>SELECTED</Text>
                      </View>
                    )}
                  </View>
                </View>
              </ImageBackground>
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );
}
