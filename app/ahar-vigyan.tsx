import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Spacing, Radius, Font } from '@/constants/theme';

const RASAS = [
  { id: 'madhura', name: 'Madhura', en: 'Sweet', emoji: '🍯', color: '#fbbf24', dosha: 'V↓ P↓ K↑', foods: ['Rice', 'Wheat', 'Milk', 'Ghee', 'Dates', 'Honey'], effect: 'Nourishes all tissues, builds Ojas, calming. Excess causes Kapha accumulation.' },
  { id: 'amla',    name: 'Amla',    en: 'Sour',  emoji: '🍋', color: '#a3e635', dosha: 'V↓ P↑ K↑', foods: ['Lemon', 'Tamarind', 'Yogurt', 'Vinegar', 'Amla berry'], effect: 'Stimulates digestion, improves taste, refreshes. Excess aggravates Pitta and Kapha.' },
  { id: 'lavana',  name: 'Lavana',  en: 'Salty', emoji: '🧂', color: '#60a5fa', dosha: 'V↓ P↑ K↑', foods: ['Rock salt', 'Sea vegetables', 'Sendha namak'], effect: 'Enhances taste, aids digestion, softens tissues. Excess increases Pitta and Kapha, thirst.' },
  { id: 'katu',    name: 'Katu',    en: 'Pungent',emoji: '🌶️', color: '#f87171', dosha: 'V↑ P↑ K↓', foods: ['Ginger', 'Black pepper', 'Chili', 'Mustard', 'Garlic'], effect: 'Kindles Agni, clears Kapha, improves circulation. Excess aggravates Vata and Pitta.' },
  { id: 'tikta',   name: 'Tikta',   en: 'Bitter',emoji: '🌿', color: '#34d399', dosha: 'V↑ P↓ K↓', foods: ['Neem', 'Turmeric', 'Fenugreek', 'Bitter gourd', 'Leafy greens'], effect: 'Purifies blood, anti-toxic, light. Best for Pitta. Excess depletes all tissues.' },
  { id: 'kashaya', name: 'Kashaya', en: 'Astringent',emoji: '🍂', color: '#a78bfa', dosha: 'V↑ P↓ K↓', foods: ['Lentils', 'Pomegranate', 'Raw banana', 'Turmeric', 'Chickpeas'], effect: 'Drying, firming, clears excess moisture. Excess causes constipation and Vata imbalance.' },
];

const VIRUDDHA = [
  { combo: 'Milk + Fish', reason: 'Opposite virya — both trigger Pitta and produce Ama (toxins) in channels' },
  { combo: 'Honey + Hot water/food', reason: 'Heated honey becomes toxic (Ama) — never cook or boil honey' },
  { combo: 'Milk + Sour fruits', reason: 'Milk curdles immediately — disrupts digestion and creates Ama' },
  { combo: 'Ghee + Honey (equal parts)', reason: 'Combined in equal quantities creates a toxic reaction (Charaka Samhita)' },
  { combo: 'Cold drinks with meals', reason: 'Extinguishes Agni mid-digestion — food rots instead of transforming' },
  { combo: 'Fruit after a full meal', reason: 'Ferments with other food — bloating and Ama formation' },
  { combo: 'Nightshades + Dairy', reason: 'Incompatible properties — aggravates Pitta and Kapha together' },
];

const TIMING = [
  { time: '7–10 AM', slot: 'Breakfast', kapha: true, emoji: '🌅', color: '#fbbf24', advice: 'Light, warm, easily digestible — fruit, porridge, or warm milk. Kapha Kala — avoid heavy foods.' },
  { time: '12–1 PM', slot: 'Main Meal', kapha: false, emoji: '☀️', color: '#fb923c', advice: 'Largest meal of the day. Pitta is at peak — digest the most complex foods here. Cooked grains, vegetables, dal, ghee.' },
  { time: '6–7:30 PM', slot: 'Light Dinner', kapha: false, emoji: '🌆', color: '#a78bfa', advice: 'Light and early. Agni is low. Soups, steamed vegetables, khichdi. Never sleep on a full stomach.' },
];

export default function AharVigyanScreen() {
  const [tab, setTab] = useState<'rasa' | 'viruddha' | 'timing'>('rasa');
  const [expandedRasa, setExpandedRasa] = useState<string | null>(null);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ScreenHeader title="Ahar Vigyan" subtitle="The Science of Ayurvedic Food" showBack accent="#34d399" />

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {([['rasa', 'Shad Rasa'], ['viruddha', 'Viruddha'], ['timing', 'Timing']] as const).map(([id, label]) => (
          <TouchableOpacity key={id} onPress={() => setTab(id)} style={[styles.tab, tab === id && styles.tabActive]}>
            <Text style={[styles.tabText, tab === id && styles.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {tab === 'rasa' && (
          <>
            <Text style={styles.intro}>Ayurveda recognises six tastes (Shad Rasa). Every meal should ideally contain all six — each nourishes different tissues and balances different doshas.</Text>
            {RASAS.map(r => {
              const open = expandedRasa === r.id;
              return (
                <TouchableOpacity key={r.id} onPress={() => setExpandedRasa(open ? null : r.id)} activeOpacity={0.8}
                  style={[styles.rasaCard, open && { borderColor: r.color + '55' }]}>
                  <View style={styles.rasaHeader}>
                    <View style={[styles.rasaIcon, { backgroundColor: r.color + '18' }]}>
                      <Text style={styles.rasaEmoji}>{r.emoji}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.rasaNameRow}>
                        <Text style={[styles.rasaName, { color: r.color }]}>{r.name}</Text>
                        <Text style={styles.rasaEn}>{r.en}</Text>
                      </View>
                      <View style={[styles.doshaBadge, { backgroundColor: r.color + '18', borderColor: r.color + '30' }]}>
                        <Text style={[styles.doshaText, { color: r.color }]}>{r.dosha}</Text>
                      </View>
                    </View>
                    <Text style={styles.chevron}>{open ? '▲' : '▼'}</Text>
                  </View>
                  {open && (
                    <View style={styles.rasaExpanded}>
                      <Text style={styles.rasaDesc}>{r.effect}</Text>
                      <Text style={styles.foodsLabel}>Key Foods</Text>
                      <View style={styles.foodsRow}>
                        {r.foods.map(f => (
                          <View key={f} style={[styles.foodChip, { backgroundColor: r.color + '14', borderColor: r.color + '30' }]}>
                            <Text style={[styles.foodText, { color: r.color }]}>{f}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {tab === 'viruddha' && (
          <>
            <Text style={styles.intro}>Viruddha Ahara — incompatible food combinations. These create Ama (undigested toxins) and are considered a root cause of disease in classical Ayurveda.</Text>
            {VIRUDDHA.map((v, i) => (
              <View key={i} style={styles.viruddhaCard}>
                <View style={styles.viruddhaLeft}>
                  <Text style={styles.viruddhaNo}>✕</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.viruddhaCombo}>{v.combo}</Text>
                  <Text style={styles.viruddhaReason}>{v.reason}</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {tab === 'timing' && (
          <>
            <Text style={styles.intro}>Kala (time) is the most important determinant of meal quality in Ayurveda — even the best food eaten at the wrong time becomes Ama.</Text>
            {TIMING.map(t => (
              <View key={t.slot} style={[styles.timingCard, { borderColor: t.color + '35' }]}>
                <LinearGradientBg color={t.color}>
                  <View style={styles.timingHeader}>
                    <Text style={styles.timingEmoji}>{t.emoji}</Text>
                    <View>
                      <Text style={[styles.timingSlot, { color: t.color }]}>{t.slot}</Text>
                      <Text style={styles.timingTime}>{t.time}</Text>
                    </View>
                  </View>
                  <Text style={styles.timingAdvice}>{t.advice}</Text>
                </LinearGradientBg>
              </View>
            ))}
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

function LinearGradientBg({ color, children }: { color: string; children: React.ReactNode }) {
  return <View style={{ backgroundColor: color + '0a', padding: Spacing.md, borderRadius: Radius.lg - 2 }}>{children}</View>;
}

const styles = StyleSheet.create({
  tabBar: { flexDirection: 'row', paddingHorizontal: Spacing.md, paddingVertical: 8, gap: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab: { flex: 1, paddingVertical: 8, borderRadius: Radius.full, alignItems: 'center', backgroundColor: Colors.card },
  tabActive: { backgroundColor: '#34d39920', borderWidth: 1, borderColor: '#34d39950' },
  tabText: { fontSize: Font.sizes.sm, fontWeight: '600', color: Colors.textMuted },
  tabTextActive: { color: '#34d399', fontWeight: '800' },
  scroll: { padding: Spacing.md },
  intro: { fontSize: Font.sizes.base, color: Colors.textSub, lineHeight: 22, marginBottom: Spacing.lg },
  rasaCard: { backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, marginBottom: 10, overflow: 'hidden' },
  rasaHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: Spacing.md },
  rasaIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rasaEmoji: { fontSize: 22 },
  rasaNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  rasaName: { fontSize: Font.sizes.md, fontWeight: '900' },
  rasaEn: { fontSize: Font.sizes.sm, color: Colors.textMuted },
  doshaBadge: { borderRadius: Radius.full, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  doshaText: { fontSize: 10, fontWeight: '800' },
  chevron: { fontSize: 11, color: Colors.textMuted },
  rasaExpanded: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.borderSubtle, paddingTop: 10 },
  rasaDesc: { fontSize: Font.sizes.sm, color: Colors.textSub, lineHeight: 19, marginBottom: 8 },
  foodsLabel: { fontSize: Font.sizes.xs, fontWeight: '800', color: Colors.textMuted, letterSpacing: 0.8, marginBottom: 6 },
  foodsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  foodChip: { borderRadius: Radius.full, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  foodText: { fontSize: Font.sizes.xs, fontWeight: '600' },
  viruddhaCard: { flexDirection: 'row', gap: 12, backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: '#ef444430', padding: Spacing.md, marginBottom: 10 },
  viruddhaLeft: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#ef444420', alignItems: 'center', justifyContent: 'center' },
  viruddhaNo: { color: '#ef4444', fontSize: 14, fontWeight: '900' },
  viruddhaCombo: { fontSize: Font.sizes.base, fontWeight: '700', color: Colors.text, marginBottom: 3 },
  viruddhaReason: { fontSize: Font.sizes.sm, color: Colors.textMuted, lineHeight: 18 },
  timingCard: { borderRadius: Radius.lg, borderWidth: 1, marginBottom: 12, overflow: 'hidden' },
  timingHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  timingEmoji: { fontSize: 28 },
  timingSlot: { fontSize: Font.sizes.md, fontWeight: '900' },
  timingTime: { fontSize: Font.sizes.sm, color: Colors.textMuted },
  timingAdvice: { fontSize: Font.sizes.sm, color: Colors.textSub, lineHeight: 20 },
});
