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
  'Sitar & Flute': '🎸', Tabla: '🥁', Birds: '🐦',
  Tanpura: '🎵', World: '🌍', Mantra: '📿', Stotra: '🌟',
};

export type AlarmSoundItem = {
  id: string;
  label: string;
  emoji: string;
  cat: string;
  color: string;
  audioUrl?: string | null;
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
  dlStatus?: Record<string, 'idle' | 'downloading' | 'downloaded'>;
  dlProgress?: Record<string, number>;
  previewLoadingId?: string | null;
};

const CARD_W = 106;
const CARD_H = 108;

export default function SoundPicker({
  sounds, cats,
  selectedId, onSelect, previewingId, onTogglePreview,
  catScrollStyle, dlStatus, dlProgress, previewLoadingId,
}: Props) {
  const pH = (catScrollStyle as any)?.paddingHorizontal ?? 20;

  return (
    <View style={{ paddingBottom: 8 }}>
      {cats.map(cat => {
        const catSounds = sounds.filter(s => s.cat === cat);
        if (catSounds.length === 0) return null;
        const color = CAT_COLORS[cat] ?? '#FFFFFF55';
        const emoji = CAT_EMOJI[cat] ?? '🎵';
        const hasPlayingInCat = previewingId != null && catSounds.some(s => s.id === previewingId);
        return (
          <View key={cat} style={{ marginBottom: 18 }}>
            {/* Section header */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              paddingHorizontal: pH, marginBottom: 10,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <View style={{
                  width: 28, height: 28, borderRadius: 8,
                  backgroundColor: color + '18', borderWidth: 1, borderColor: color + '40',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ fontSize: 14 }}>{emoji}</Text>
                </View>
                <Text style={{ fontSize: 12, fontWeight: '900', color: color, letterSpacing: 0.8 }}>
                  {cat.toUpperCase()}
                </Text>
                <Text style={{ fontSize: 9, color: '#FFFFFF30', fontWeight: '700', letterSpacing: 0.5 }}>
                  {catSounds.length}
                </Text>
              </View>
              {hasPlayingInCat && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#10b981' }} />
                  <Text style={{ fontSize: 7, color: '#10b981', fontWeight: '900', letterSpacing: 0.5 }}>NOW PLAYING</Text>
                </View>
              )}
            </View>

            {/* Horizontal row of sound cards */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: pH, gap: 8 }}
            >
              {catSounds.map(snd => {
                const active = selectedId === snd.id;
                const previewing = previewingId === snd.id;
                const loadingPreview = previewLoadingId === snd.id;
                const imgSrc = snd.id === 'lalitha'
                  ? LALITHA_IMG
                  : (SOUND_IMAGES[snd.id] ? { uri: getLocalSoundImageUri(SOUND_IMAGES[snd.id]) } : undefined);
                return (
                  <TouchableOpacity
                    key={snd.id}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onSelect(snd.id); }}
                    activeOpacity={0.82}
                    style={{
                      width: CARD_W, height: CARD_H, borderRadius: 16, overflow: 'hidden',
                      borderWidth: active ? 2 : 1,
                      borderColor: active ? snd.color : previewing ? '#10b98155' : '#FFFFFF14',
                    }}
                  >
                    <ImageBackground source={imgSrc} style={{ flex: 1 }} imageStyle={{ borderRadius: 15 }}>
                      {!imgSrc && <View style={[StyleSheet.absoluteFillObject, { borderRadius: 15, backgroundColor: '#0E0C18' }]} />}
                      <LinearGradient
                        colors={['rgba(0,0,0,0.02)', 'rgba(0,0,0,0.80)']}
                        style={[StyleSheet.absoluteFillObject, { borderRadius: 15 }]}
                      />
                      {active && (
                        <View style={[StyleSheet.absoluteFillObject, { borderRadius: 15, backgroundColor: snd.color + '22' }]} />
                      )}
                      {previewing && (
                        <View style={[StyleSheet.absoluteFillObject, { borderRadius: 15, backgroundColor: '#10b98112' }]} />
                      )}
                      <View style={{ flex: 1, padding: 8, justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <TouchableOpacity
                            onPress={e => { e.stopPropagation?.(); onTogglePreview(snd); }}
                            style={{
                              width: 26, height: 26, borderRadius: 13,
                              backgroundColor: loadingPreview ? '#fbbf2440' : previewing ? '#10b98140' : 'rgba(0,0,0,0.55)',
                              borderWidth: 1,
                              borderColor: loadingPreview ? '#fbbf2480' : previewing ? '#10b98180' : 'rgba(255,255,255,0.18)',
                              alignItems: 'center', justifyContent: 'center',
                            }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Text style={{ fontSize: loadingPreview ? 7 : 8, color: loadingPreview ? '#fbbf24' : previewing ? '#10b981' : '#FFFFFFCC' }}>
                              {loadingPreview ? '…' : previewing ? '■' : '▶'}
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
                          {loadingPreview ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 }}>
                              <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#fbbf24' }} />
                              <Text style={{ fontSize: 7, color: '#fbbf24', fontWeight: '900', letterSpacing: 0.3 }}>LOADING…</Text>
                            </View>
                          ) : dlStatus?.[snd.id] === 'downloading' ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 }}>
                              <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#fbbf24' }} />
                              <Text style={{ fontSize: 7, color: '#fbbf24', fontWeight: '900', letterSpacing: 0.3 }}>
                                {dlProgress?.[snd.id] != null ? `DL ${Math.round((dlProgress[snd.id] ?? 0) * 100)}%` : 'LOADING…'}
                              </Text>
                            </View>
                          ) : active ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 }}>
                              <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: snd.color }} />
                              <Text style={{ fontSize: 7, color: snd.color, fontWeight: '900', letterSpacing: 0.3 }}>SELECTED</Text>
                            </View>
                          ) : previewing ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 }}>
                              <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#10b981' }} />
                              <Text style={{ fontSize: 7, color: '#10b981', fontWeight: '900', letterSpacing: 0.3 }}>PLAYING</Text>
                            </View>
                          ) : null
                          }
                        </View>
                      </View>
                    </ImageBackground>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        );
      })}
    </View>
  );
}
