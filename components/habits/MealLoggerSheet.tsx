import React, { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  TextInput, ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, Font } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import type { MealSize, MealFeeling } from '@/lib/habitLogs';

export type MealType = 'breakfast' | 'lunch' | 'dinner';

interface Props {
  visible: boolean;
  mealType: MealType;
  onClose: () => void;
  onAnalyse?: () => void;
  onSave: (data: {
    mealDescription: string;
    mealSize: MealSize;
    postMealFeeling: MealFeeling;
    photoUri: string | null;
    isMainMeal: boolean | null;
    status: 'done' | 'late';
  }) => void;
}

const META: Record<MealType, { emoji: string; title: string; window: string; color: string; ayurNote: string }> = {
  breakfast: {
    emoji: '🌾', title: 'Breakfast Log', window: '7:00–10:00 AM', color: '#f59e0b',
    ayurNote: 'Agni rises with Kapha — eat light, warm, easy to digest.',
  },
  lunch: {
    emoji: '☀️', title: 'Lunch Log', window: '12:00–2:00 PM', color: '#fb923c',
    ayurNote: 'Pitta is strongest now — Agni is at its peak. Best time for your largest meal.',
  },
  dinner: {
    emoji: '🌙', title: 'Dinner Log', window: '6:00–7:30 PM', color: '#a78bfa',
    ayurNote: 'Keep dinner light and early. Heavy dinners create Ama overnight.',
  },
};

const SIZES: { key: MealSize; label: string; emoji: string; note: string }[] = [
  { key: 'light',  label: 'Light',  emoji: '🍽️',       note: 'Ideal for Vata & Kapha morning' },
  { key: 'medium', label: 'Medium', emoji: '🍽️🍽️',   note: 'Balanced — good for Pitta midday' },
  { key: 'heavy',  label: 'Heavy',  emoji: '🍽️🍽️🍽️', note: 'Heavy — may create Ama' },
];

const FEELINGS: { key: MealFeeling; label: string; emoji: string }[] = [
  { key: 'good',  label: 'Light & good',   emoji: '😊' },
  { key: 'okay',  label: 'Okay',           emoji: '😐' },
  { key: 'heavy', label: 'Heavy / bloated', emoji: '😫' },
];

export function MealLoggerSheet({ visible, mealType, onClose, onAnalyse, onSave }: Props) {
  const meta = META[mealType];
  const [desc, setDesc] = useState('');
  const [size, setSize] = useState<MealSize>('medium');
  const [feeling, setFeeling] = useState<MealFeeling>('good');
  const [isMain, setIsMain] = useState<boolean>(mealType === 'lunch');
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const now = new Date();
  const nowH = now.getHours();
  const isLate =
    (mealType === 'breakfast' && nowH >= 10) ||
    (mealType === 'lunch' && nowH >= 14) ||
    (mealType === 'dinner' && nowH >= 20);

  const heavyDinnerWarning = mealType === 'dinner' && size === 'heavy';

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Allow photo access to add meal photos.'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.6 });
    if (!res.canceled && res.assets[0]) setPhotoUri(res.assets[0].uri);
  };

  const handleSave = () => {
    if (!desc.trim()) { Alert.alert('Add a description', 'Briefly describe what you ate.'); return; }
    onSave({ mealDescription: desc.trim(), mealSize: size, postMealFeeling: feeling, photoUri, isMainMeal: mealType === 'lunch' ? isMain : null, status: isLate ? 'late' : 'done' });
    setDesc(''); setSize('medium'); setFeeling('good'); setIsMain(mealType === 'lunch'); setPhotoUri(null);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.sheetWrap}>
        <View style={s.sheet}>
          <View style={s.handle} />

          {/* Header */}
          <View style={s.headerRow}>
            <Text style={s.titleEmoji}>{meta.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{meta.title}</Text>
              <Text style={[s.subtitle, { color: meta.color }]}>{meta.window}</Text>
            </View>
            {isLate && (
              <View style={[s.lateBadge, { backgroundColor: '#f59e0b20', borderColor: '#f59e0b50' }]}>
                <Text style={{ color: '#f59e0b', fontSize: 10, fontWeight: '800' }}>⚠️ Late</Text>
              </View>
            )}
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* ── AyuIntel CTA ── */}
            <TouchableOpacity
              style={s.ayuCard}
              activeOpacity={0.82}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onAnalyse?.(); }}
            >
              <LinearGradient
                colors={['#7c3aed22', '#a78bfa15', '#7c3aed08']}
                style={s.ayuGrad}
              >
                <View style={s.ayuLeft}>
                  <Text style={s.ayuEmoji}>✨</Text>
                  <View>
                    <Text style={s.ayuTitle}>Analyse with AyuIntel</Text>
                    <Text style={s.ayuSub}>Photo → AI Ayurvedic analysis → Log</Text>
                  </View>
                </View>
                <View style={s.ayuBadge}>
                  <Text style={s.ayuBadgeTxt}>RECOMMENDED →</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>

            {/* ── Divider ── */}
            <View style={s.dividerRow}>
              <View style={s.dividerLine} />
              <Text style={s.dividerTxt}>or log manually</Text>
              <View style={s.dividerLine} />
            </View>

            {/* Ayurvedic tip */}
            <View style={[s.tipCard, { borderColor: meta.color + '30', backgroundColor: meta.color + '12' }]}>
              <Text style={[s.tipTxt, { color: meta.color }]}>🌿 {meta.ayurNote}</Text>
            </View>

            {/* Meal description */}
            <Text style={s.label}>What did you eat?</Text>
            <TextInput
              style={s.textInput}
              placeholder="Describe your meal..."
              placeholderTextColor={Colors.textMuted}
              value={desc}
              onChangeText={setDesc}
              multiline
              maxLength={300}
            />

            {/* Meal size */}
            <Text style={s.label}>Meal size</Text>
            <View style={s.optRow}>
              {SIZES.map(sz => {
                const warn = mealType === 'dinner' && sz.key === 'heavy';
                return (
                  <TouchableOpacity
                    key={sz.key}
                    style={[s.optBtn, size === sz.key && { borderColor: meta.color, backgroundColor: meta.color + '18' }, warn && size === sz.key && { borderColor: '#ef4444', backgroundColor: '#ef444418' }]}
                    onPress={() => { Haptics.selectionAsync(); setSize(sz.key); }}
                  >
                    <Text style={s.optEmoji}>{sz.emoji}</Text>
                    <Text style={[s.optLabel, size === sz.key && { color: warn ? '#ef4444' : meta.color }]}>{sz.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Heavy dinner nudge */}
            {heavyDinnerWarning && (
              <View style={s.nudgeCard}>
                <Text style={s.nudgeTxt}>
                  🙏 A heavy dinner makes Agni work overnight and can create Ama.{'\n'}Try keeping dinner light and early tomorrow.
                </Text>
              </View>
            )}

            {/* Post-meal feeling */}
            <Text style={s.label}>How do you feel after?</Text>
            <View style={s.feelRow}>
              {FEELINGS.map(f => (
                <TouchableOpacity
                  key={f.key}
                  style={[s.feelBtn, feeling === f.key && s.feelBtnActive]}
                  onPress={() => { Haptics.selectionAsync(); setFeeling(f.key); }}
                >
                  <Text style={s.feelEmoji}>{f.emoji}</Text>
                  <Text style={[s.feelLabel, feeling === f.key && { color: '#10b981' }]}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Main meal toggle (lunch only) */}
            {mealType === 'lunch' && (
              <>
                <Text style={s.label}>Main meal of the day?</Text>
                <View style={s.toggleRow}>
                  <TouchableOpacity
                    style={[s.toggleBtn, isMain && s.toggleBtnActive]}
                    onPress={() => { Haptics.selectionAsync(); setIsMain(true); }}
                  >
                    <Text style={[s.toggleTxt, isMain && { color: '#10b981' }]}>✅ Yes — biggest meal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.toggleBtn, !isMain && s.toggleBtnAlt]}
                    onPress={() => { Haptics.selectionAsync(); setIsMain(false); }}
                  >
                    <Text style={[s.toggleTxt, !isMain && { color: '#fb923c' }]}>No — I ate more elsewhere</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Photo */}
            <TouchableOpacity style={s.photoBtn} onPress={pickPhoto}>
              <Text style={s.photoBtnTxt}>{photoUri ? '📷 Photo added ✓' : '📷 Add photo (optional)'}</Text>
            </TouchableOpacity>

          </ScrollView>

          <View style={s.actions}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
              <Text style={s.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.saveBtn, { backgroundColor: meta.color }]} onPress={handleSave}>
              <Text style={s.saveTxt}>Save Meal Log</Text>
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
  sheet: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, paddingBottom: 36, maxHeight: '92%' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: Spacing.sm },
  titleEmoji: { fontSize: 28 },
  title: { fontSize: Font.sizes.lg, fontWeight: '900', color: Colors.text },
  subtitle: { fontSize: Font.sizes.xs, fontWeight: '600', marginTop: 2 },
  lateBadge: { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  tipCard: { borderRadius: Radius.md, borderWidth: 1, padding: Spacing.sm + 2, marginBottom: Spacing.md },
  tipTxt: { fontSize: Font.sizes.xs, fontWeight: '600', lineHeight: 18 },
  label: { fontSize: Font.sizes.sm, color: Colors.textSub, fontWeight: '700', marginBottom: Spacing.sm, marginTop: Spacing.sm },
  textInput: { backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm + 2, color: Colors.text, fontSize: Font.sizes.sm, minHeight: 72, textAlignVertical: 'top', marginBottom: Spacing.sm },
  optRow: { flexDirection: 'row', gap: 8, marginBottom: Spacing.sm },
  optBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card, gap: 4 },
  optEmoji: { fontSize: 14 },
  optLabel: { fontSize: 11, fontWeight: '700', color: Colors.textSub },
  nudgeCard: { backgroundColor: '#ef444415', borderRadius: Radius.md, borderWidth: 1, borderColor: '#ef444435', padding: Spacing.sm + 2, marginBottom: Spacing.sm },
  nudgeTxt: { fontSize: Font.sizes.xs, color: '#ef4444', lineHeight: 18 },
  feelRow: { flexDirection: 'row', gap: 8, marginBottom: Spacing.sm },
  feelBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card, gap: 4 },
  feelBtnActive: { backgroundColor: '#10b98115', borderColor: '#10b98140' },
  feelEmoji: { fontSize: 22 },
  feelLabel: { fontSize: 10, fontWeight: '700', color: Colors.textSub, textAlign: 'center' },
  toggleRow: { flexDirection: 'row', gap: 8, marginBottom: Spacing.sm },
  toggleBtn: { flex: 1, padding: 10, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card, alignItems: 'center' },
  toggleBtnActive: { borderColor: '#10b98140', backgroundColor: '#10b98115' },
  toggleBtnAlt: { borderColor: '#fb923c40', backgroundColor: '#fb923c15' },
  toggleTxt: { fontSize: 11, fontWeight: '700', color: Colors.textSub, textAlign: 'center' },
  ayuCard: { borderRadius: Radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: '#a78bfa40', marginBottom: Spacing.md },
  ayuGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md, gap: 10 },
  ayuLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  ayuEmoji: { fontSize: 28 },
  ayuTitle: { fontSize: Font.sizes.base, fontWeight: '900', color: '#c084fc' },
  ayuSub: { fontSize: Font.sizes.xs, color: '#a78bfa', marginTop: 2, fontWeight: '600' },
  ayuBadge: { backgroundColor: '#7c3aed', borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 4 },
  ayuBadgeTxt: { fontSize: 8, fontWeight: '900', color: '#fff', letterSpacing: 1 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.md },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerTxt: { fontSize: Font.sizes.xs, color: Colors.textMuted, fontWeight: '600' },
  photoBtn: { padding: Spacing.sm + 2, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed', alignItems: 'center', marginTop: Spacing.xs, marginBottom: Spacing.md },
  photoBtnTxt: { color: Colors.textSub, fontSize: Font.sizes.sm, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 10, marginTop: Spacing.xs },
  cancelBtn: { flex: 1, padding: 14, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  cancelTxt: { color: Colors.textSub, fontWeight: '700', fontSize: Font.sizes.sm },
  saveBtn: { flex: 2, padding: 14, borderRadius: Radius.md, alignItems: 'center' },
  saveTxt: { color: '#fff', fontWeight: '800', fontSize: Font.sizes.base },
});
