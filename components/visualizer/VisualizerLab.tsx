// ─── Visualizer Lab ───────────────────────────────────────────────────────────
// Dev-only screen for tuning the cymatics visualizer against the checklist in
// Section 10 of the spec.
//
// Open via: long-press on the sound title in soundbath-ringing.tsx (__DEV__ only)
// OR: navigate to /visualizer-lab route in dev builds.

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ImageBackground, Dimensions, Platform,
} from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CymaticsView } from './CymaticsView';
import { PRESETS, PRESET_IDS } from './cymaticsPresets';
import { useMorphEngine } from './useMorphEngine';
import { useAudioFeatures } from './useAudioFeatures';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const DISH_SIZE = Math.min(SCREEN_W * 0.8, 320);

// Background options for contrast testing
const BACKGROUNDS: Array<{ label: string; bg: any; textColor: string }> = [
  {
    label: 'Real Image',
    bg: require('@/assets/images/new_bg.jpeg'),
    textColor: '#FFF',
  },
  { label: 'White',    bg: null, textColor: '#222' },
  { label: 'Mid Gray', bg: null, textColor: '#FFF' },
  { label: 'Black',    bg: null, textColor: '#FFF' },
];
const BG_COLORS = ['transparent', '#FFFFFF', '#888888', '#000000'];

export default function VisualizerLab() {
  // ── Fake metering ─────────────────────────────────────────────────────────
  const fakeMeteringAnim = useSharedValue(0);

  // LFO mode: sweeps metering automatically
  const [lfoMode, setLfoMode] = useState(false);
  const lfoRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lfoPhaseRef = useRef(0);

  useEffect(() => {
    if (lfoMode) {
      lfoRef.current = setInterval(() => {
        lfoPhaseRef.current += 0.05;
        fakeMeteringAnim.value = 0.5 + 0.48 * Math.sin(lfoPhaseRef.current);
      }, 50);
    } else {
      if (lfoRef.current) { clearInterval(lfoRef.current); lfoRef.current = null; }
    }
    return () => { if (lfoRef.current) clearInterval(lfoRef.current); };
  }, [lfoMode, fakeMeteringAnim]);

  // ── Sliders ───────────────────────────────────────────────────────────────
  const [energy, setEnergy]     = useState(0.5);
  const [scrim, setScrim]       = useState(0.22);
  const [quality, setQuality]   = useState<'high' | 'medium' | 'low'>('high');
  const [bgIdx, setBgIdx]       = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  // Sync manual energy slider to metering when not in LFO mode
  useEffect(() => {
    if (!lfoMode) fakeMeteringAnim.value = energy;
  }, [energy, lfoMode, fakeMeteringAnim]);

  // ── Preset forcing ────────────────────────────────────────────────────────
  const features    = useAudioFeatures(fakeMeteringAnim, isPlaying);
  const morphEngine = useMorphEngine(features, isPlaying);
  const [activePreset, setActivePreset] = useState('');

  const forcePreset = useCallback((id: string) => {
    setActivePreset(id);
    morphEngine.forcePreset(id);
  }, [morphEngine]);

  // Onset trigger
  const triggerOnset = useCallback(() => {
    // Spike the metering briefly
    fakeMeteringAnim.value = 1.0;
    setTimeout(() => { fakeMeteringAnim.value = energy; }, 150);
  }, [energy, fakeMeteringAnim]);

  // ── FPS counter ──────────────────────────────────────────────────────────
  const [fps, setFps] = useState(0);
  const fpsFrames   = useRef(0);
  const fpsLastTime = useRef(Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      const elapsed = (now - fpsLastTime.current) / 1000;
      setFps(Math.round(fpsFrames.current / elapsed));
      fpsFrames.current = 0;
      fpsLastTime.current = now;
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const onFrame = useCallback(() => { fpsFrames.current++; }, []);

  const bg = BACKGROUNDS[bgIdx];

  const Wrapper = bg.bg
    ? ({ children }: { children: React.ReactNode }) => (
        <ImageBackground source={bg.bg} style={StyleSheet.absoluteFill} resizeMode="cover">
          {children}
        </ImageBackground>
      )
    : ({ children }: { children: React.ReactNode }) => (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: BG_COLORS[bgIdx] }]}>
          {children}
        </View>
      );

  return (
    <SafeAreaView style={styles.root}>
      <Wrapper>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* ── Header ──────────────────────────────────────────────────── */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: bg.textColor }]}>🔬 Visualizer Lab</Text>
            <Text style={[styles.fps, { color: bg.textColor }]}>{fps} fps</Text>
          </View>

          {/* ── Cymatics preview ────────────────────────────────────────── */}
          <View style={styles.dishWrap}>
            <View style={[styles.dishRing, { width: DISH_SIZE, height: DISH_SIZE, borderRadius: DISH_SIZE / 2 }]}>
              <CymaticsView
                size={DISH_SIZE}
                isPlaying={isPlaying}
                meteringAnim={fakeMeteringAnim}
                quality={quality}
                scrimOpacity={scrim}
              />
            </View>
          </View>

          {/* ── Current preset label ────────────────────────────────────── */}
          <Text style={[styles.presetLabel, { color: bg.textColor }]}>
            Pattern: {activePreset || 'Auto'}
          </Text>

          {/* ── Play / Pause ─────────────────────────────────────────────── */}
          <TouchableOpacity style={styles.pill} onPress={() => setIsPlaying(p => !p)}>
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={16} color="#FFF" />
            <Text style={styles.pillText}>{isPlaying ? 'Pause' : 'Play'}</Text>
          </TouchableOpacity>

          {/* ── Background switcher ──────────────────────────────────────── */}
          <View style={styles.row}>
            {BACKGROUNDS.map((b, i) => (
              <TouchableOpacity
                key={b.label}
                style={[styles.bgBtn, bgIdx === i && styles.bgBtnActive]}
                onPress={() => setBgIdx(i)}
              >
                <Text style={styles.bgBtnText}>{b.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Quality ──────────────────────────────────────────────────── */}
          <View style={styles.row}>
            {(['high', 'medium', 'low'] as const).map(q => (
              <TouchableOpacity
                key={q}
                style={[styles.bgBtn, quality === q && styles.bgBtnActive]}
                onPress={() => setQuality(q)}
              >
                <Text style={styles.bgBtnText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── LFO toggle + Onset trigger ───────────────────────────────── */}
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.pill, lfoMode && styles.pillActive]}
              onPress={() => setLfoMode(m => !m)}
            >
              <Text style={styles.pillText}>LFO {lfoMode ? 'ON' : 'OFF'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.pill} onPress={triggerOnset}>
              <Text style={styles.pillText}>Onset ⚡</Text>
            </TouchableOpacity>
          </View>

          {/* ── Sliders ──────────────────────────────────────────────────── */}
          <LabSlider
            label="Energy"
            value={energy}
            min={0} max={1}
            disabled={lfoMode}
            onValueChange={setEnergy}
            textColor={bg.textColor}
          />
          <LabSlider
            label="Scrim opacity"
            value={scrim}
            min={0} max={0.6}
            onValueChange={setScrim}
            textColor={bg.textColor}
          />

          {/* ── Preset picker ────────────────────────────────────────────── */}
          <Text style={[styles.sectionLabel, { color: bg.textColor }]}>Presets</Text>
          <View style={styles.presetGrid}>
            <TouchableOpacity
              style={[styles.presetBtn, activePreset === '' && styles.presetBtnActive]}
              onPress={() => { setActivePreset(''); morphEngine.forcePreset(''); }}
            >
              <Text style={styles.presetBtnText}>Auto</Text>
            </TouchableOpacity>
            {PRESET_IDS.map(id => (
              <TouchableOpacity
                key={id}
                style={[styles.presetBtn, activePreset === id && styles.presetBtnActive]}
                onPress={() => forcePreset(id)}
              >
                <Text style={styles.presetBtnText}>{PRESETS[id]?.label ?? id}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Checklist reminder ──────────────────────────────────────── */}
          <View style={styles.checklist}>
            <Text style={[styles.checklistTitle, { color: bg.textColor }]}>Self-check (Section 10)</Text>
            {[
              'BEADED_RING: count ~24 lobes; ring at ~0.56R; interior transparent',
              'Rosette: ~36 spokes, r ≈ 0.05R, transparent center hole',
              'FILIGREE_24: thin glowing ridge lines; 24-fold symmetry',
              'RIPPLES_SPOKES: 3–6 dark rings near center; glow to ~0.85R',
              'White background: no gray disc outside pattern',
              'Morph: 250–500 ms, no popping',
              'Colors: periwinkle mid-tones, lavender-white highlights',
              'FPS ≥ 60 or graceful fallback',
            ].map((item, i) => (
              <Text key={i} style={[styles.checklistItem, { color: bg.textColor }]}>
                {'\u25A2'} {item}
              </Text>
            ))}
          </View>

          <View style={{ height: 60 }} />
        </ScrollView>
      </Wrapper>
    </SafeAreaView>
  );
}

// ── Small slider widget ───────────────────────────────────────────────────────
function LabSlider({
  label, value, min, max, disabled, onValueChange, textColor,
}: {
  label: string; value: number; min: number; max: number;
  disabled?: boolean; onValueChange: (v: number) => void; textColor: string;
}) {
  return (
    <View style={styles.sliderWrap}>
      <Text style={[styles.sliderLabel, { color: textColor }]}>
        {label}: <Text style={styles.sliderValue}>{value.toFixed(2)}</Text>
      </Text>
      {/* Use a native RN Slider — @react-native-community/slider if available,
          otherwise a TouchableOpacity strip fallback */}
      <View style={styles.sliderTrack}>
        <View style={[styles.sliderFill, { flex: value / (max - min) }]} />
        <TouchableOpacity
          style={styles.sliderHandle}
          onPress={() => onValueChange(Math.min(max, value + (max - min) * 0.05))}
          disabled={disabled}
        />
      </View>
      <View style={styles.sliderBtns}>
        <TouchableOpacity
          style={styles.sliderBtn}
          onPress={() => onValueChange(Math.max(min, value - (max - min) * 0.05))}
          disabled={disabled}
        >
          <Text style={styles.sliderBtnText}>−</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.sliderBtn}
          onPress={() => onValueChange(Math.min(max, value + (max - min) * 0.05))}
          disabled={disabled}
        >
          <Text style={styles.sliderBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 20, alignItems: 'center' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    width: '100%', marginBottom: 20,
  },
  title: { fontSize: 18, fontWeight: '700' },
  fps:   { fontSize: 14, fontWeight: '600', opacity: 0.8 },

  dishWrap: { alignItems: 'center', marginBottom: 16 },
  dishRing: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },

  presetLabel: { fontSize: 14, marginBottom: 12, opacity: 0.8 },

  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },

  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(115,124,191,0.35)',
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(115,124,191,0.5)',
  },
  pillActive: { backgroundColor: 'rgba(115,124,191,0.65)' },
  pillText: { color: '#FFF', fontSize: 13, fontWeight: '600' },

  bgBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  bgBtnActive: { backgroundColor: 'rgba(115,124,191,0.5)', borderColor: '#737CBF' },
  bgBtnText: { color: '#FFF', fontSize: 12 },

  sectionLabel: { fontSize: 14, fontWeight: '700', alignSelf: 'flex-start', marginBottom: 8 },

  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  presetBtn: {
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(115,124,191,0.4)',
    backgroundColor: 'rgba(115,124,191,0.15)',
  },
  presetBtnActive: { backgroundColor: 'rgba(115,124,191,0.55)', borderColor: '#737CBF' },
  presetBtnText: { color: '#CAC0F3', fontSize: 12, fontWeight: '600' },

  sliderWrap: { width: '100%', marginBottom: 16 },
  sliderLabel: { fontSize: 13, marginBottom: 6 },
  sliderValue: { fontWeight: '700' },
  sliderTrack: {
    flexDirection: 'row', height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, marginBottom: 4,
  },
  sliderFill: { backgroundColor: '#737CBF', borderRadius: 2 },
  sliderHandle: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#CAC0F3', marginTop: -4 },
  sliderBtns: { flexDirection: 'row', gap: 12 },
  sliderBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(115,124,191,0.3)',
    justifyContent: 'center', alignItems: 'center',
  },
  sliderBtnText: { color: '#FFF', fontSize: 18, fontWeight: '700' },

  checklist: {
    width: '100%', marginTop: 20,
    padding: 16, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  checklistTitle: { fontSize: 14, fontWeight: '700', marginBottom: 10 },
  checklistItem: { fontSize: 12, marginBottom: 6, opacity: 0.85, lineHeight: 18 },
});
