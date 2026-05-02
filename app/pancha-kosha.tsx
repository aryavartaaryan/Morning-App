import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Spacing, Radius, Font } from '@/constants/theme';

const { width } = Dimensions.get('window');

const KOSHAS = [
  {
    id: 'annamaya', name: 'Annamaya Kosha', sanskrit: 'अन्नमय कोश', emoji: '🌾', color: '#f59e0b',
    element: 'Earth', layer: 'Physical Body',
    desc: 'The food body — the most dense sheath. Governed by what you eat, how you move, and the quality of your sleep.',
    practices: ['Wholesome Sattvic meals', 'Yoga asana', 'Adequate sleep', 'Dinacharya routines'],
    signs: ['Vitality & strength', 'Clear skin & eyes', 'Healthy digestion', 'Balanced weight'],
  },
  {
    id: 'pranamaya', name: 'Pranamaya Kosha', sanskrit: 'प्राणमय कोश', emoji: '🌬️', color: '#60a5fa',
    element: 'Air / Water', layer: 'Energy Body',
    desc: 'The vital energy body. Prana flows through 72,000 Nadis. Pranayama directly nourishes this sheath.',
    practices: ['Pranayama daily', 'Spend time in nature', 'Breathe consciously', 'Avoid energy drains'],
    signs: ['Steady energy all day', 'No unexplained fatigue', 'Vibrant aliveness', 'Emotional resilience'],
  },
  {
    id: 'manomaya', name: 'Manomaya Kosha', sanskrit: 'मनोमय कोश', emoji: '🧠', color: '#a78bfa',
    element: 'Fire', layer: 'Mental Body',
    desc: 'The mental-emotional body. Houses thoughts, feelings, and the reactive mind (Manas). Purified by Sattva.',
    practices: ['Daily meditation', 'Journaling', 'Mantra recitation', 'Satsang & good company'],
    signs: ['Emotional stability', 'Clear mind', 'Less reactivity', 'Positive thoughts'],
  },
  {
    id: 'vijnanamaya', name: 'Vijnanamaya Kosha', sanskrit: 'विज्ञानमय कोश', emoji: '🔬', color: '#34d399',
    element: 'Space / Air', layer: 'Wisdom Body',
    desc: 'The intellect and discriminative wisdom (Buddhi). Distinguishes the real from the unreal. Refined through study.',
    practices: ['Study of scriptures', 'Self-inquiry (Vichara)', 'Learning with awareness', 'Viveka — discernment'],
    signs: ['Good judgement', 'Inner clarity', 'Intuitive knowing', 'Reduced confusion'],
  },
  {
    id: 'anandamaya', name: 'Anandamaya Kosha', sanskrit: 'आनंदमय कोश', emoji: '✨', color: '#f472b6',
    element: 'Pure Consciousness', layer: 'Bliss Body',
    desc: 'The innermost sheath — the causal body. Experienced in deep sleep and Samadhi. Contains the seed of individuality.',
    practices: ['Deep meditation', 'Seva (selfless service)', 'Devotion (Bhakti)', 'Surrender to the present'],
    signs: ['Unconditional joy', 'Contentment (Santosha)', 'Deep restful sleep', 'Sense of unity'],
  },
];

export default function PanchaKoshaScreen() {
  const [expanded, setExpanded] = useState<string | null>('annamaya');

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ScreenHeader title="Pancha Kosha" subtitle="Five Sheaths of Being" showBack accent="#f472b6" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <Text style={styles.intro}>
          In Vedantic philosophy, the self is clothed in five sheaths — from the gross physical to the subtlest bliss. Understanding each helps you care for every dimension of your being.
        </Text>

        {/* Nested visual */}
        <View style={styles.nestWrap}>
          {[...KOSHAS].reverse().map((k, i) => {
            const size = 64 + i * 38;
            return (
              <View key={k.id} style={[styles.nestRing, { width: size, height: size, borderRadius: size / 2, borderColor: k.color + '50', backgroundColor: k.color + '08' }]}>
                {i === KOSHAS.length - 1 && <Text style={styles.nestCenter}>🪷</Text>}
              </View>
            );
          })}
        </View>

        {KOSHAS.map((k, i) => {
          const isOpen = expanded === k.id;
          return (
            <TouchableOpacity key={k.id} onPress={() => setExpanded(isOpen ? null : k.id)} activeOpacity={0.8}
              style={[styles.card, isOpen && { borderColor: k.color + '55' }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.iconBox, { backgroundColor: k.color + '18' }]}>
                  <Text style={styles.emoji}>{k.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <View style={[styles.layerBadge, { backgroundColor: k.color + '20', borderColor: k.color + '40' }]}>
                      <Text style={[styles.layerText, { color: k.color }]}>Layer {i + 1}</Text>
                    </View>
                  </View>
                  <Text style={[styles.koshaName, isOpen && { color: k.color }]}>{k.name}</Text>
                  <Text style={styles.sanskrit}>{k.sanskrit} · {k.layer}</Text>
                </View>
                <Text style={[styles.arrow, { color: k.color }]}>{isOpen ? '▲' : '▼'}</Text>
              </View>

              {isOpen && (
                <View style={styles.expanded}>
                  <Text style={styles.descText}>{k.desc}</Text>

                  <Text style={styles.subHead}>Nourishing Practices</Text>
                  {k.practices.map(p => (
                    <View key={p} style={styles.listRow}>
                      <View style={[styles.dot, { backgroundColor: k.color }]} />
                      <Text style={styles.listText}>{p}</Text>
                    </View>
                  ))}

                  <Text style={styles.subHead}>Signs of Vitality</Text>
                  {k.signs.map(s => (
                    <View key={s} style={styles.listRow}>
                      <View style={[styles.dot, { backgroundColor: '#10b981' }]} />
                      <Text style={styles.listText}>{s}</Text>
                    </View>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: Spacing.md },
  intro: { fontSize: Font.sizes.base, color: Colors.textSub, lineHeight: 22, marginBottom: Spacing.lg },
  nestWrap: { alignItems: 'center', justifyContent: 'center', height: 260, marginBottom: Spacing.lg },
  nestRing: { position: 'absolute', borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  nestCenter: { fontSize: 22 },
  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, marginBottom: 10, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: Spacing.md },
  iconBox: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 22 },
  nameRow: { flexDirection: 'row', gap: 6, marginBottom: 3 },
  layerBadge: { borderRadius: Radius.full, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
  layerText: { fontSize: 10, fontWeight: '800' },
  koshaName: { fontSize: Font.sizes.base, fontWeight: '800', color: Colors.text },
  sanskrit: { fontSize: Font.sizes.xs, color: Colors.textMuted, marginTop: 2 },
  arrow: { fontSize: 12 },
  expanded: { padding: Spacing.md, paddingTop: 0, borderTopWidth: 1, borderTopColor: Colors.borderSubtle },
  descText: { fontSize: Font.sizes.sm, color: Colors.textSub, lineHeight: 20, marginBottom: Spacing.sm },
  subHead: { fontSize: Font.sizes.xs, fontWeight: '800', color: Colors.textMuted, letterSpacing: 0.8, marginBottom: 6, marginTop: 4 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  listText: { fontSize: Font.sizes.sm, color: Colors.textSub },
});
