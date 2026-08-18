import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Animated, Dimensions, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { PlayableSoundMeta } from '@/lib/soundPlayerContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: H } = Dimensions.get('window');

type Props = {
  visible: boolean;
  queue: PlayableSoundMeta[];
  playingId: string | null;
  onClose: () => void;
  onRemove: (index: number) => void;
  onClear: () => void;
  onPlayNow: (index: number) => void;
};

export default function SleepQueueSheet({ visible, queue, playingId, onClose, onRemove, onClear, onPlayNow }: Props) {
  const insets = useSafeAreaInsets();
  const sheetAnim = useRef(new Animated.Value(H)).current;
  const isAnimating = useRef(false);

  useEffect(() => {
    if (visible && !isAnimating.current) {
      isAnimating.current = true;
      Animated.spring(sheetAnim, {
        toValue: 0,
        useNativeDriver: true,
        stiffness: 250,
        damping: 25,
        mass: 1.2
      }).start(() => { isAnimating.current = false; });
    } else if (!visible && !isAnimating.current) {
      isAnimating.current = true;
      Animated.spring(sheetAnim, {
        toValue: H,
        useNativeDriver: true,
        stiffness: 250,
        damping: 25,
        mass: 1.2
      }).start(() => { isAnimating.current = false; });
    }
  }, [visible]);

  if (!visible && (sheetAnim as any)._value >= H * 0.99) {
    return null;
  }

  return (
    <View style={[StyleSheet.absoluteFillObject, { zIndex: 12000, elevation: 999 }]}>
      <TouchableOpacity 
        style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.6)' }]} 
        activeOpacity={1} 
        onPress={onClose} 
      />
      <Animated.View style={[S.sheet, { transform: [{ translateY: sheetAnim }] }]}>
        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFillObject} />
        <LinearGradient colors={['rgba(12, 14, 18, 0.9)', 'rgba(8, 10, 14, 0.95)']} style={StyleSheet.absoluteFillObject} />
        
        <View style={{ paddingTop: insets.top > 0 ? insets.top + 4 : 16 }}>
          <View style={S.handle} />
          <View style={S.header}>
            <View>
              <Text style={S.headerTitle}>Up Next</Text>
              <Text style={S.headerSub}>{queue.length} sounds in queue</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {queue.length > 0 && (
                <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onClear(); }} style={S.clearBtn}>
                  <Text style={S.clearTxt}>Clear</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose} style={S.closeBtn}>
                <Ionicons name="close" size={20} color="rgba(255,255,255,0.8)" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={S.divider} />

        <FlatList
          data={queue}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 100 }}>
              <Ionicons name="list" size={48} color="rgba(255,255,255,0.1)" />
              <Text style={{ marginTop: 16, fontSize: 16, fontWeight: '600', color: 'rgba(255,255,255,0.4)' }}>Queue is empty</Text>
              <Text style={{ marginTop: 8, fontSize: 13, color: 'rgba(255,255,255,0.2)', textAlign: 'center', marginHorizontal: 40 }}>
                Add sounds from the Svara library to create your custom playlist.
              </Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const isPlaying = item.id === playingId;
            return (
              <View style={[S.row, isPlaying && S.rowActive]}>
                <Text style={S.rowEmoji}>{item.emoji}</Text>
                <View style={S.rowContent}>
                  <Text style={[S.rowTitle, isPlaying && { color: item.color || '#fff' }]}>{item.label}</Text>
                  <Text style={S.rowDesc}>{item.desc}</Text>
                </View>
                <TouchableOpacity 
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPlayNow(index); }}
                  style={[S.actionBtn, isPlaying && { backgroundColor: item.color + '22', borderColor: item.color + '55' }]}
                >
                  <Ionicons name={isPlaying ? "stats-chart" : "play"} size={14} color={isPlaying ? item.color : '#fff'} />
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onRemove(index); }}
                  style={[S.actionBtn, { marginLeft: 8 }]}
                >
                  <Ionicons name="trash-outline" size={14} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>
              </View>
            );
          }}
        />
      </Animated.View>
    </View>
  );
}

const S = StyleSheet.create({
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '85%', borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.8, shadowRadius: 50, shadowOffset: { width: 0, height: -10 } },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginBottom: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingBottom: 20 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5, fontFamily: 'Nunito_800ExtraBold' },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 4, fontWeight: '600' },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  clearBtn: { paddingHorizontal: 16, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  clearTxt: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.6)' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)' },
  rowActive: { backgroundColor: 'rgba(255,255,255,0.03)' },
  rowEmoji: { fontSize: 24, marginRight: 16 },
  rowContent: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', marginBottom: 3 },
  rowDesc: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: '500' },
  actionBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }
});
