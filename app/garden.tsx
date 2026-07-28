import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Path } from 'react-native-svg';
import { getBloomedSeeds, BloomedSeed } from '@/lib/seedStorage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function getSeedColors(type: string) {
  if (type === 'pebble') return { base: 'rgba(52,211,153,0.2)', solid: '#34d399', stroke: 'rgba(52,211,153,0.8)', leaf: 'rgba(52,211,153,0.6)', bloom: '#d1fae5' };
  if (type === 'epic') return { base: 'rgba(192,132,252,0.2)', solid: '#c084fc', stroke: 'rgba(192,132,252,0.8)', leaf: 'rgba(192,132,252,0.6)', bloom: '#f3e8ff' };
  if (type === 'calm') return { base: 'rgba(56,189,248,0.2)', solid: '#38bdf8', stroke: 'rgba(56,189,248,0.8)', leaf: 'rgba(56,189,248,0.6)', bloom: '#e0f2fe' };
  return { base: 'rgba(251,146,60,0.2)', solid: '#fb923c', stroke: 'rgba(251,146,60,0.8)', leaf: 'rgba(251,146,60,0.6)', bloom: '#ffedd5' };
}

function getSeedTitle(type: string) {
  if (type === 'pebble') return 'Quick Sprout';
  if (type === 'epic') return 'Epic Lotus';
  if (type === 'calm') return 'Seed of Calm';
  return 'Seed of Vitality';
}

const { width: W } = Dimensions.get('window');

function RenderSeed({ seed }: { seed: BloomedSeed }) {
  const SZ = 100;
  const colors = getSeedColors(seed.type);
  
  return (
    <View style={s.seedCard}>
      <Svg width={SZ} height={SZ} viewBox={`0 0 ${SZ} ${SZ}`}>
        <Circle cx={SZ/2} cy={SZ - 20} r={6} fill={colors.base} />
        <Circle cx={SZ/2} cy={SZ - 20} r={3} fill={colors.solid} />
        
        <Path
          d={`M${SZ/2} ${SZ - 20} Q${SZ/2 + 15} ${SZ/2} ${SZ/2} 20`}
          stroke={colors.stroke}
          strokeWidth={2}
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d={`M${SZ/2 + 5} ${SZ/2 + 10} Q${SZ/2 + 20} ${SZ/2 + 5} ${SZ/2 + 20} ${SZ/2 - 5} Q${SZ/2 + 5} ${SZ/2 - 5} ${SZ/2 + 5} ${SZ/2 + 10}`}
          fill={colors.leaf}
        />
        <Path
          d={`M${SZ/2 - 5} ${SZ/2 - 5} Q${SZ/2 - 20} ${SZ/2} ${SZ/2 - 20} ${SZ/2 - 15} Q${SZ/2 - 5} ${SZ/2 - 15} ${SZ/2 - 5} ${SZ/2 - 5}`}
          fill={colors.leaf}
        />
        
        <Circle
          cx={SZ/2} cy={20} r={10}
          fill={colors.bloom}
        />
      </Svg>
      
      <View style={s.seedInfo}>
        <Text style={s.seedTitle}>{getSeedTitle(seed.type)}</Text>
        <Text style={s.seedDate}>{new Date(seed.date).toLocaleDateString()}</Text>
      </View>
    </View>
  );
}

export default function GardenScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [seeds, setSeeds] = useState<BloomedSeed[]>([]);
  
  useEffect(() => {
    getBloomedSeeds().then(setSeeds);
  }, []);

  return (
    <View style={s.container}>
      {/* Background */}
      <LinearGradient colors={['#020617', '#0f172a']} style={StyleSheet.absoluteFillObject} />
      
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={s.title}>The Garden</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]}>
        <Text style={s.subtitle}>
          Every walk is a seed planted. Here is your permanent collection of vitality.
        </Text>

        {seeds.length === 0 ? (
          <View style={s.emptyState}>
            <Ionicons name="leaf-outline" size={48} color="rgba(255,255,255,0.2)" />
            <Text style={s.emptyText}>Your garden is empty.</Text>
            <Text style={s.emptySub}>Plant a seed on your next walk to bring it to life.</Text>
            
            <TouchableOpacity onPress={() => router.back()} style={s.startBtn}>
              <Text style={s.startBtnText}>Start Walking</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.grid}>
            {seeds.map((seed) => (
              <RenderSeed key={seed.id} seed={seed} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginBottom: 40,
    paddingHorizontal: 20,
    lineHeight: 22,
  },
  scroll: {
    paddingTop: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginBottom: 32,
    maxWidth: 240,
  },
  startBtn: {
    backgroundColor: '#38bdf8',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 24,
  },
  startBtnText: {
    color: '#020617',
    fontWeight: '700',
    fontSize: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
    gap: 16,
  },
  seedCard: {
    width: (W - 48) / 2, // 2 columns, 16px padding on sides + 16px gap
    aspectRatio: 0.8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  seedInfo: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  seedTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  seedDate: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
  },
});
