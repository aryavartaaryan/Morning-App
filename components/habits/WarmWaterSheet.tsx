import React, { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, Font } from '@/constants/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (data: { glasses: number; temp: 'warm' | 'hot'; notes: string }) => void;
}

const QUICK_OPTS = [1, 2, 3, 4];
const TEMPS = [
  { key: 'warm' as const, label: '🌡️ Warm', note: 'Best for Vata & Kapha' },
  { key: 'hot'  as const, label: '🔥 Hot',  note: 'Cuts Ama effectively' },
];

export function WarmWaterSheet({ visible, onClose, onSave }: Props) {
  const [glasses, setGlasses] = useState(2);
  const [temp, setTemp] = useState<'warm' | 'hot'>('warm');
  const [notes, setNotes] = useState('');

  const pick = (g: number) => {
    Haptics.selectionAsync();
    setGlasses(g);
  };

  const handleSave = () => {
    onSave({ glasses, temp, notes });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.sheetWrap}>
        <View style={s.sheet}>
          <View style={s.handle} />
          <Text style={s.title}>💧 Morning Hydration Log</Text>
          <Text style={s.subtitle}>6:00–7:30 AM · Flushes overnight Ama</Text>

          {/* Quick pick */}
          <Text style={s.sectionLabel}>How many glasses?</Text>
          <View style={s.quickRow}>
            {QUICK_OPTS.map(g => (
              <TouchableOpacity
                key={g}
                style={[s.glassBtn, glasses === g && s.glassBtnActive]}
                onPress={() => pick(g)}
              >
                <Text style={[s.glassEmoji]}>🥛</Text>
                <Text style={[s.glassNum, glasses === g && s.glassNumActive]}>{g}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Temperature */}
          <Text style={s.sectionLabel}>Temperature preference</Text>
          <View style={s.tempRow}>
            {TEMPS.map(t => (
              <TouchableOpacity
                key={t.key}
                style={[s.tempBtn, temp === t.key && s.tempBtnActive]}
                onPress={() => { Haptics.selectionAsync(); setTemp(t.key); }}
              >
                <Text style={s.tempLabel}>{t.label}</Text>
                <Text style={s.tempNote}>{t.note}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Summary */}
          <View style={s.summaryCard}>
            <Text style={s.summaryTxt}>
              💧 {glasses} glass{glasses > 1 ? 'es' : ''} of {temp} water
            </Text>
            <Text style={s.summaryNote}>
              {glasses >= 2 ? '✅ Great — ideal morning flush!' : 'Try to drink 2+ glasses for best results'}
            </Text>
          </View>

          {/* Optional note */}
          <TextInput
            style={s.notesInput}
            placeholder="Add a note (optional)..."
            placeholderTextColor={Colors.textMuted}
            value={notes}
            onChangeText={setNotes}
            maxLength={120}
          />

          <View style={s.actions}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
              <Text style={s.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.saveBtn} onPress={handleSave}>
              <Text style={s.saveTxt}>Log {glasses} Glass{glasses > 1 ? 'es' : ''}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#00000060' },
  sheetWrap: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  sheet: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, paddingBottom: 36 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.md },
  title: { fontSize: Font.sizes.lg, fontWeight: '900', color: Colors.text, marginBottom: 2 },
  subtitle: { fontSize: Font.sizes.xs, color: '#60a5fa', fontWeight: '600', marginBottom: Spacing.lg },
  sectionLabel: { fontSize: Font.sizes.sm, color: Colors.textSub, fontWeight: '700', marginBottom: Spacing.sm },
  quickRow: { flexDirection: 'row', gap: 10, marginBottom: Spacing.lg },
  glassBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: Radius.md, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, gap: 4 },
  glassBtnActive: { backgroundColor: '#60a5fa20', borderColor: '#60a5fa' },
  glassEmoji: { fontSize: 22 },
  glassNum: { fontSize: Font.sizes.lg, fontWeight: '900', color: Colors.textSub },
  glassNumActive: { color: '#60a5fa' },
  tempRow: { flexDirection: 'row', gap: 10, marginBottom: Spacing.lg },
  tempBtn: { flex: 1, paddingVertical: 12, paddingHorizontal: 10, borderRadius: Radius.md, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  tempBtnActive: { backgroundColor: '#60a5fa20', borderColor: '#60a5fa' },
  tempLabel: { fontSize: Font.sizes.sm, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  tempNote: { fontSize: 10, color: Colors.textMuted },
  summaryCard: { backgroundColor: '#60a5fa12', borderRadius: Radius.md, borderWidth: 1, borderColor: '#60a5fa30', padding: Spacing.md, marginBottom: Spacing.md },
  summaryTxt: { fontSize: Font.sizes.base, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  summaryNote: { fontSize: Font.sizes.xs, color: Colors.textSub },
  notesInput: { backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm + 2, color: Colors.text, fontSize: Font.sizes.sm, marginBottom: Spacing.md },
  actions: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  cancelTxt: { color: Colors.textSub, fontWeight: '700', fontSize: Font.sizes.sm },
  saveBtn: { flex: 2, padding: 14, borderRadius: Radius.md, backgroundColor: '#60a5fa', alignItems: 'center' },
  saveTxt: { color: '#fff', fontWeight: '800', fontSize: Font.sizes.base },
});
