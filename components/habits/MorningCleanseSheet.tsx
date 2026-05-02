import React, { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, Font } from '@/constants/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (data: { items: string[]; count: number; status: 'done' | 'partial' | 'missed' }) => void;
}

const ITEMS = [
  { key: 'tongue_scraping', emoji: '👅', label: 'Tongue Scraping',         sub: 'Jihwa Prakshalana' },
  { key: 'oil_pulling',     emoji: '🫙', label: 'Oil Pulling',              sub: 'Gandusha' },
  { key: 'face_wash',       emoji: '💦', label: 'Face Wash',                sub: 'Mukha Prakshalana' },
  { key: 'brushing',        emoji: '🪥', label: 'Dant Manjan / Brushing',   sub: 'Oral hygiene' },
  { key: 'bath',            emoji: '🚿', label: 'Bath / Shower',             sub: 'Abhyanga + bath' },
];

function getStatus(count: number): { label: string; badge: string; color: string } {
  if (count >= 4) return { label: 'Perfect cleanse! 🌸', badge: '✅ Perfect', color: '#10b981' };
  if (count >= 2) return { label: 'Partial cleanse — good start!', badge: '🔶 Partial', color: '#fb923c' };
  return { label: 'Almost nothing — try again tomorrow', badge: '✗ Missed', color: '#ef4444' };
}

export function MorningCleanseSheet({ visible, onClose, onSave }: Props) {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    Haptics.selectionAsync();
    setChecked(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const count = checked.size;
  const info = getStatus(count);

  const handleSave = () => {
    const items = Array.from(checked);
    const status = count >= 4 ? 'done' : count >= 2 ? 'partial' : 'missed';
    onSave({ items, count, status });
    setChecked(new Set());
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.sheetWrap}>
        <View style={s.sheet}>
          <View style={s.handle} />
          <Text style={s.title}>🌸 Morning Cleanse</Text>
          <Text style={s.subtitle}>6:00–8:00 AM · Purify body and channels</Text>

          {ITEMS.map(item => {
            const active = checked.has(item.key);
            return (
              <TouchableOpacity
                key={item.key}
                style={[s.row, active && s.rowActive]}
                onPress={() => toggle(item.key)}
                activeOpacity={0.75}
              >
                <View style={[s.checkbox, active && s.checkboxActive]}>
                  {active && <Text style={s.checkmark}>✓</Text>}
                </View>
                <Text style={s.itemEmoji}>{item.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[s.itemLabel, active && s.itemLabelActive]}>{item.label}</Text>
                  <Text style={s.itemSub}>{item.sub}</Text>
                </View>
                {active && (
                  <View style={[s.badge, { backgroundColor: '#10b98120', borderColor: '#10b98140' }]}>
                    <Text style={{ color: '#10b981', fontSize: 10, fontWeight: '800' }}>Done</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}

          {/* Progress indicator */}
          <View style={s.progressRow}>
            <View style={s.progressTrack}>
              <View style={[s.progressFill, { width: `${(count / 5) * 100}%` as `${number}%`, backgroundColor: info.color }]} />
            </View>
            <Text style={[s.progressTxt, { color: info.color }]}>{count}/5</Text>
          </View>

          {/* Status */}
          <View style={[s.statusCard, { backgroundColor: info.color + '18', borderColor: info.color + '35' }]}>
            <View style={[s.statusBadge, { backgroundColor: info.color + '22' }]}>
              <Text style={[s.statusBadgeTxt, { color: info.color }]}>{info.badge}</Text>
            </View>
            <Text style={s.statusNote}>{info.label}</Text>
          </View>

          <View style={s.actions}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
              <Text style={s.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.saveBtn, { backgroundColor: info.color }]} onPress={handleSave}>
              <Text style={s.saveTxt}>Done — {count}/5 completed</Text>
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
  subtitle: { fontSize: Font.sizes.xs, color: '#38bdf8', fontWeight: '600', marginBottom: Spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm + 4, marginBottom: 8 },
  rowActive: { backgroundColor: '#10b98112', borderColor: '#10b98135' },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: '#10b981', borderColor: '#10b981' },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '900' },
  itemEmoji: { fontSize: 20 },
  itemLabel: { fontSize: Font.sizes.sm, fontWeight: '700', color: Colors.text },
  itemLabelActive: { color: '#10b981' },
  itemSub: { fontSize: 10, color: Colors.textMuted, marginTop: 1 },
  badge: { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: Spacing.sm },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: Colors.card, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  progressTxt: { fontSize: Font.sizes.sm, fontWeight: '900', minWidth: 28 },
  statusCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: Radius.md, borderWidth: 1, padding: Spacing.sm + 2, marginBottom: Spacing.md },
  statusBadge: { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  statusBadgeTxt: { fontSize: 10, fontWeight: '800' },
  statusNote: { fontSize: Font.sizes.xs, color: Colors.textSub, flex: 1 },
  actions: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  cancelTxt: { color: Colors.textSub, fontWeight: '700', fontSize: Font.sizes.sm },
  saveBtn: { flex: 2, padding: 14, borderRadius: Radius.md, alignItems: 'center' },
  saveTxt: { color: '#fff', fontWeight: '800', fontSize: Font.sizes.base },
});
