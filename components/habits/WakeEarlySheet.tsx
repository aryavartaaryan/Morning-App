import React, { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, Font } from '@/constants/theme';
import { calcSleepDuration, fmtHHMM } from '@/lib/habitLogs';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (data: {
    wakeH: number; wakeM: number;
    sleepH: number; sleepM: number;
    durationHours: number;
  }) => void;
}

function TimePicker({
  label, hour, minute,
  onHourChange, onMinuteChange,
}: {
  label: string;
  hour: number; minute: number;
  onHourChange: (h: number) => void;
  onMinuteChange: (m: number) => void;
}) {
  const adj = (val: number, delta: number, max: number) =>
    (val + delta + max) % max;

  const bump = () => Haptics.selectionAsync();

  return (
    <View style={tp.wrap}>
      <Text style={tp.label}>{label}</Text>
      <View style={tp.row}>
        {/* Hour */}
        <View style={tp.col}>
          <TouchableOpacity style={tp.btn} onPress={() => { bump(); onHourChange(adj(hour, 1, 24)); }}>
            <Text style={tp.arrow}>▲</Text>
          </TouchableOpacity>
          <View style={tp.val}><Text style={tp.valTxt}>{String(hour > 12 ? hour - 12 : hour === 0 ? 12 : hour).padStart(2, '0')}</Text></View>
          <TouchableOpacity style={tp.btn} onPress={() => { bump(); onHourChange(adj(hour, -1, 24)); }}>
            <Text style={tp.arrow}>▼</Text>
          </TouchableOpacity>
        </View>

        <Text style={tp.colon}>:</Text>

        {/* Minute */}
        <View style={tp.col}>
          <TouchableOpacity style={tp.btn} onPress={() => { bump(); onMinuteChange(adj(minute, 5, 60)); }}>
            <Text style={tp.arrow}>▲</Text>
          </TouchableOpacity>
          <View style={tp.val}><Text style={tp.valTxt}>{String(minute).padStart(2, '0')}</Text></View>
          <TouchableOpacity style={tp.btn} onPress={() => { bump(); onMinuteChange(adj(minute, -5, 60)); }}>
            <Text style={tp.arrow}>▼</Text>
          </TouchableOpacity>
        </View>

        {/* AM/PM */}
        <TouchableOpacity style={tp.ampm} onPress={() => { bump(); onHourChange(hour < 12 ? hour + 12 : hour - 12); }}>
          <Text style={tp.ampmTxt}>{hour < 12 ? 'AM' : 'PM'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function WakeEarlySheet({ visible, onClose, onSave }: Props) {
  const now = new Date();
  const [wakeH, setWakeH] = useState(now.getHours());
  const [wakeM, setWakeM] = useState(Math.floor(now.getMinutes() / 5) * 5);
  const [sleepH, setSleepH] = useState(22);
  const [sleepM, setSleepM] = useState(0);

  const dur = calcSleepDuration(sleepH, sleepM, wakeH, wakeM);

  const durEmoji = dur >= 7 ? '😊' : dur >= 6 ? '😴' : '⚠️';
  const durNote = dur >= 8 ? 'Well rested — excellent Ojas!' :
    dur >= 7 ? 'Good sleep — Vata is balanced.' :
    dur >= 6 ? 'Adequate rest — aim for 7+ hours.' :
    'Short sleep — be gentle today 🙏';

  const handleSave = () => {
    onSave({ wakeH, wakeM, sleepH, sleepM, durationHours: dur });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.sheetWrap}>
        <View style={s.sheet}>
          <View style={s.handle} />
          <Text style={s.title}>🌙 Wake Early Log</Text>
          <Text style={s.subtitle}>Brahma Muhurta · 3:30–6:00 AM</Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            <TimePicker
              label="⏰ What time did you wake up?"
              hour={wakeH} minute={wakeM}
              onHourChange={setWakeH} onMinuteChange={setWakeM}
            />
            <TimePicker
              label="🌙 What time did you sleep last night?"
              hour={sleepH} minute={sleepM}
              onHourChange={setSleepH} onMinuteChange={setSleepM}
            />

            <View style={s.durationCard}>
              <Text style={s.durEmoji}>{durEmoji}</Text>
              <View>
                <Text style={s.durText}>You slept <Text style={s.durBold}>{dur} hours</Text></Text>
                <Text style={s.durNote}>{durNote}</Text>
              </View>
            </View>

            <View style={s.infoRow}>
              <Text style={s.infoTxt}>
                Woke at {fmtHHMM(wakeH, wakeM)} · Slept at {fmtHHMM(sleepH, sleepM)}
              </Text>
              {wakeH < 6 || (wakeH === 5 && wakeM <= 59) ? (
                <View style={[s.badge, { backgroundColor: '#10b98120' }]}>
                  <Text style={[s.badgeTxt, { color: '#10b981' }]}>✅ Brahma Muhurta</Text>
                </View>
              ) : (
                <View style={[s.badge, { backgroundColor: '#f59e0b20' }]}>
                  <Text style={[s.badgeTxt, { color: '#f59e0b' }]}>⏰ After 6 AM</Text>
                </View>
              )}
            </View>
          </ScrollView>

          <View style={s.actions}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
              <Text style={s.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.saveBtn} onPress={handleSave}>
              <Text style={s.saveTxt}>Save Log</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const tp = StyleSheet.create({
  wrap: { marginBottom: Spacing.lg },
  label: { fontSize: Font.sizes.sm, color: Colors.textSub, fontWeight: '600', marginBottom: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  col: { alignItems: 'center', gap: 4 },
  btn: { width: 44, height: 34, borderRadius: Radius.sm, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  arrow: { color: Colors.textSub, fontSize: 12 },
  val: { width: 60, height: 50, backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1, borderColor: '#a78bfa40', alignItems: 'center', justifyContent: 'center' },
  valTxt: { fontSize: 26, fontWeight: '800', color: '#a78bfa' },
  colon: { fontSize: 26, fontWeight: '800', color: Colors.textSub, marginBottom: 4 },
  ampm: { backgroundColor: '#a78bfa20', borderRadius: Radius.sm, borderWidth: 1, borderColor: '#a78bfa40', paddingHorizontal: 10, paddingVertical: 8, marginLeft: 4 },
  ampmTxt: { color: '#a78bfa', fontSize: Font.sizes.sm, fontWeight: '800' },
});

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#00000060' },
  sheetWrap: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  sheet: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, paddingBottom: 36, maxHeight: '90%' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.md },
  title: { fontSize: Font.sizes.lg, fontWeight: '900', color: Colors.text, marginBottom: 2 },
  subtitle: { fontSize: Font.sizes.xs, color: '#a78bfa', fontWeight: '600', marginBottom: Spacing.lg },
  durationCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#a78bfa15', borderRadius: Radius.md, borderWidth: 1, borderColor: '#a78bfa30', padding: Spacing.md, marginBottom: Spacing.md },
  durEmoji: { fontSize: 28 },
  durText: { fontSize: Font.sizes.base, color: Colors.text, fontWeight: '600' },
  durBold: { color: '#a78bfa', fontWeight: '900' },
  durNote: { fontSize: Font.sizes.xs, color: Colors.textSub, marginTop: 2 },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  infoTxt: { fontSize: Font.sizes.xs, color: Colors.textMuted },
  badge: { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  badgeTxt: { fontSize: 10, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 10, marginTop: Spacing.sm },
  cancelBtn: { flex: 1, padding: 14, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  cancelTxt: { color: Colors.textSub, fontWeight: '700', fontSize: Font.sizes.sm },
  saveBtn: { flex: 2, padding: 14, borderRadius: Radius.md, backgroundColor: '#a78bfa', alignItems: 'center' },
  saveTxt: { color: '#fff', fontWeight: '800', fontSize: Font.sizes.base },
});
