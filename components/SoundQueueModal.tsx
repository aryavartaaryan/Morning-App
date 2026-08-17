import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, FlatList, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSoundPlayer, PlayableSoundMeta } from '@/lib/soundPlayerContext';
import * as Haptics from 'expo-haptics';

export function SoundQueueModal({
  visible,
  onClose,
  onOpenLibrary,
}: {
  visible: boolean;
  onClose: () => void;
  onOpenLibrary: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { playingMeta, soundQueue, removeFromQueue, playNext } = useSoundPlayer();

  const renderQueueItem = ({ item, index }: { item: PlayableSoundMeta, index: number }) => (
    <View style={styles.queueItem}>
      <View style={[styles.queueIconWrapper, { backgroundColor: item.color + '33' }]}>
        <Ionicons name="musical-note" size={20} color={item.color} />
      </View>
      <View style={styles.queueItemText}>
        <Text style={styles.queueItemTitle} numberOfLines={1}>{item.label}</Text>
        <Text style={styles.queueItemSubtitle} numberOfLines={1}>{item.desc}</Text>
      </View>
      <TouchableOpacity 
        style={styles.removeBtn}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          removeFromQueue(item.id);
        }}
      >
        <Ionicons name="close" size={20} color="rgba(255,255,255,0.5)" />
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.container}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFillObject} />
          ) : (
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(20,20,24,0.95)' }]} />
          )}

          <View style={styles.header}>
            <Text style={styles.headerTitle}>Up Next</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="chevron-down" size={28} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {playingMeta && (
            <View style={styles.nowPlaying}>
              <Text style={styles.sectionHeader}>NOW PLAYING</Text>
              <View style={styles.queueItem}>
                <View style={[styles.queueIconWrapper, { backgroundColor: playingMeta.color + '44' }]}>
                  <Ionicons name="play" size={18} color={playingMeta.color} />
                </View>
                <View style={styles.queueItemText}>
                  <Text style={[styles.queueItemTitle, { color: playingMeta.color }]}>{playingMeta.label}</Text>
                  <Text style={styles.queueItemSubtitle}>{playingMeta.desc}</Text>
                </View>
              </View>
            </View>
          )}

          <Text style={[styles.sectionHeader, { marginTop: 24 }]}>QUEUE ({soundQueue.length})</Text>
          <FlatList
            data={soundQueue}
            keyExtractor={(item, idx) => item.id + idx}
            renderItem={renderQueueItem}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>Your queue is empty.</Text>
                <Text style={styles.emptySubtext}>Add sounds to keep the flow going seamlessly through the night.</Text>
              </View>
            }
          />

          <TouchableOpacity 
            style={styles.addBtn}
            activeOpacity={0.8}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onClose();
              setTimeout(onOpenLibrary, 300);
            }}
          >
            <Ionicons name="add" size={24} color="#000" />
            <Text style={styles.addBtnText}>Add to Queue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    height: '75%',
    backgroundColor: '#121214',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'Nunito_600SemiBold',
    letterSpacing: 0.5,
  },
  closeBtn: {
    position: 'absolute',
    right: 16,
    padding: 8,
  },
  nowPlaying: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  sectionHeader: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: '800',
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 1.5,
    marginBottom: 12,
    paddingHorizontal: 24,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  queueIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  queueItemText: {
    flex: 1,
  },
  queueItemTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Nunito_600SemiBold',
    marginBottom: 4,
  },
  queueItemSubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontFamily: 'Nunito_400Regular',
  },
  removeBtn: {
    padding: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    fontFamily: 'Nunito_600SemiBold',
    marginBottom: 8,
  },
  emptySubtext: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    fontFamily: 'Nunito_400Regular',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    marginHorizontal: 24,
    marginTop: 'auto',
    height: 56,
    borderRadius: 28,
  },
  addBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Nunito_700Bold',
    marginLeft: 8,
  },
});
