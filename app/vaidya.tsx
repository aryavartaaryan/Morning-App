import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Image, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { store, KEYS } from '@/lib/storage';
import { Colors, Spacing, Radius, Font } from '@/constants/theme';
import { auth, db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { speakBodhi, stopBodhi } from '@/lib/speech';
import { saveHabitLog, todayStr } from '@/lib/habitLogs';

const GEMINI_KEY = 'AIzaSyANg_oPfwORFiYwvWCs53hO2NSiw96xA8k';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`;

const HUNGER = [
  { id: 'light',    e: '🌿', t: 'Barely hungry' },
  { id: 'moderate', e: '🔥', t: 'Moderately hungry' },
  { id: 'full',     e: '⚡', t: 'Very hungry' },
  { id: 'not',      e: '🫁', t: 'Not hungry' },
];
const MEAL_TYPES = [
  { id: 'Breakfast', e: '🌅' },
  { id: 'Lunch',     e: '☀️' },
  { id: 'Dinner',    e: '🪔' },
  { id: 'Snack',     e: '🍃' },
];
const COOKING_METHODS = [
  { id: 'steamed', e: '♨️', t: 'Steamed' },
  { id: 'fried',   e: '🍳', t: 'Fried' },
  { id: 'grilled', e: '🔥', t: 'Grilled' },
  { id: 'raw',     e: '🥗', t: 'Raw' },
  { id: 'curry',   e: '🍛', t: 'Curry' },
  { id: 'baked',   e: '🫓', t: 'Baked' },
];
const FOOD_TEMPS = [
  { id: 'hot',       e: '🌡️', t: 'Hot' },
  { id: 'warm',      e: '☕',  t: 'Warm' },
  { id: 'room_temp', e: '🌀', t: 'Room Temp' },
  { id: 'cold',      e: '🧊', t: 'Cold' },
];

// ── Aahar Vigyan embedded data ──────────────────────────────────────────────
const AAHAR_RASAS = [
  { id: 'madhura', name: 'Madhura', en: 'Sweet',      emoji: '🍯', color: '#fbbf24', dosha: 'V↓ P↓ K↑', foods: ['Rice', 'Wheat', 'Milk', 'Ghee', 'Dates'],       effect: 'Nourishes all tissues, builds Ojas, calming. Excess causes Kapha accumulation.' },
  { id: 'amla',    name: 'Amla',    en: 'Sour',       emoji: '🍋', color: '#a3e635', dosha: 'V↓ P↑ K↑', foods: ['Lemon', 'Tamarind', 'Yogurt', 'Amla'],          effect: 'Stimulates digestion, improves taste, refreshes. Excess aggravates Pitta & Kapha.' },
  { id: 'lavana',  name: 'Lavana',  en: 'Salty',      emoji: '🧂', color: '#60a5fa', dosha: 'V↓ P↑ K↑', foods: ['Rock salt', 'Sea vegetables', 'Sendha namak'],   effect: 'Enhances taste, aids digestion, softens tissues. Excess increases thirst.' },
  { id: 'katu',    name: 'Katu',    en: 'Pungent',    emoji: '🌶️', color: '#f87171', dosha: 'V↑ P↑ K↓', foods: ['Ginger', 'Black pepper', 'Chili', 'Mustard'],   effect: 'Kindles Agni, clears Kapha, improves circulation. Excess aggravates Vata & Pitta.' },
  { id: 'tikta',   name: 'Tikta',   en: 'Bitter',     emoji: '🌿', color: '#34d399', dosha: 'V↑ P↓ K↓', foods: ['Neem', 'Turmeric', 'Fenugreek', 'Bitter gourd'], effect: 'Purifies blood, anti-toxic, light. Best for Pitta. Excess depletes tissues.' },
  { id: 'kashaya', name: 'Kashaya', en: 'Astringent', emoji: '🍂', color: '#a78bfa', dosha: 'V↑ P↓ K↓', foods: ['Lentils', 'Pomegranate', 'Raw banana', 'Chickpeas'], effect: 'Drying, firming, clears excess moisture. Excess causes constipation.' },
];
const AAHAR_VIRUDDHA = [
  { combo: 'Milk + Fish',              reason: 'Opposite virya — triggers Pitta, produces Ama in channels' },
  { combo: 'Honey + Hot water / food', reason: 'Heated honey becomes toxic Ama — never cook or boil honey' },
  { combo: 'Milk + Sour fruits',       reason: 'Milk curdles instantly — disrupts digestion, creates Ama' },
  { combo: 'Ghee + Honey (equal)',     reason: 'Combined equally creates toxic reaction (Charaka Samhita)' },
  { combo: 'Cold drinks with meals',   reason: 'Extinguishes Agni mid-digestion — food rots instead of transforming' },
  { combo: 'Fruit after full meal',    reason: 'Ferments with other food — bloating and Ama formation' },
];
const AAHAR_TIMING = [
  { time: '7–10 AM',   slot: 'Breakfast',    emoji: '🌅', color: '#fbbf24', advice: 'Light, warm, easily digestible — fruit, porridge, warm milk. Kapha Kala — avoid heavy foods.' },
  { time: '12–1 PM',   slot: 'Main Meal',    emoji: '☀️', color: '#fb923c', advice: 'Largest meal of the day. Pitta peaks here — digest the most complex foods. Cooked grains, vegetables, dal, ghee.' },
  { time: '6–7:30 PM', slot: 'Light Dinner', emoji: '🌆', color: '#a78bfa', advice: 'Light and early. Agni is low. Soups, khichdi, steamed vegetables. Never sleep on a full stomach.' },
];

interface DoshaDetail { effect: 'balancing'|'increasing'|'neutral'; score: number; reason: string; }
interface Rasa { name: string; label: string; present: boolean; source: string; dosha_impact: string; }
interface Guna { name: string; present: boolean; reason: string; }
interface Suggestion { action: string; item: string; reason: string; }
interface IncompatibleCombo { combo: string; concern: string; }
interface Analysis {
  identified_items: string[];
  meal_summary: string;
  confidence: 'high'|'medium'|'low';
  doshas: { vata: DoshaDetail; pitta: DoshaDetail; kapha: DoshaDetail };
  rasas: Rasa[];
  gunas: Guna[];
  virya: string; virya_reason: string;
  vipaka: string; vipaka_reason: string;
  agni_effect: 'stimulating'|'dampening'|'neutral'; agni_note: string;
  ama_risk: 'low'|'medium'|'high'; ama_note: string;
  incompatible_combos: IncompatibleCombo[];
  time_suitability: 'ideal'|'acceptable'|'avoid'; time_note: string;
  prakriti_verdict: 'beneficial'|'neutral'|'cautionary'|'avoid';
  prakriti_note: string; prakriti_short_term: string; prakriti_long_term: string;
  overall_verdict: 'good'|'caution'|'avoid'; overall_note: string;
  suggestions: Suggestion[];
}

const VERDICT_META   = { good:    { color: '#10b981', label: 'Good for you',  icon: '✓' }, caution: { color: '#fbbf24', label: 'With Caution', icon: '⚠' }, avoid: { color: '#f87171', label: 'Best Avoided', icon: '✗' } };
const PRAKRITI_META  = { beneficial: { color: '#10b981', label: 'Beneficial' }, neutral: { color: '#94a3b8', label: 'Neutral' }, cautionary: { color: '#fbbf24', label: 'Cautionary' }, avoid: { color: '#f87171', label: 'Avoid' } };
const AMA_META       = { low: { color: '#10b981' }, medium: { color: '#fbbf24' }, high: { color: '#f87171' } };
const AGNI_META      = { stimulating: { color: '#fb923c', icon: '🔥' }, dampening: { color: '#64748b', icon: '💧' }, neutral: { color: '#94a3b8', icon: '⚖️' } };
const TIME_META      = { ideal: { color: '#10b981' }, acceptable: { color: '#fbbf24' }, avoid: { color: '#f87171' } };

function normalizeOne<T extends string>(v: string | undefined, opts: T[], fallback: T): T {
  const s = (v ?? '').toLowerCase().trim();
  return opts.find(o => s === o) ?? opts.find(o => s.includes(o)) ?? fallback;
}
function normalizeAnalysis(raw: Record<string, unknown>): Analysis {
  const d = raw as unknown as Analysis;
  const no = normalizeOne;
  return {
    identified_items: Array.isArray(d.identified_items) ? d.identified_items.filter(Boolean) : [],
    meal_summary: d.meal_summary || 'Meal',
    confidence: no(d.confidence, ['high','medium','low'], 'medium'),
    doshas: {
      vata:  { effect: no(d.doshas?.vata?.effect,  ['balancing','increasing','neutral'], 'neutral'), score: Math.min(100, Math.max(0, Number(d.doshas?.vata?.score)  || 0)), reason: d.doshas?.vata?.reason  || '' },
      pitta: { effect: no(d.doshas?.pitta?.effect, ['balancing','increasing','neutral'], 'neutral'), score: Math.min(100, Math.max(0, Number(d.doshas?.pitta?.score) || 0)), reason: d.doshas?.pitta?.reason || '' },
      kapha: { effect: no(d.doshas?.kapha?.effect, ['balancing','increasing','neutral'], 'neutral'), score: Math.min(100, Math.max(0, Number(d.doshas?.kapha?.score) || 0)), reason: d.doshas?.kapha?.reason || '' },
    },
    rasas: Array.isArray(d.rasas) ? d.rasas : [],
    gunas: Array.isArray(d.gunas) ? d.gunas : [],
    virya: d.virya || '', virya_reason: d.virya_reason || '',
    vipaka: d.vipaka || '', vipaka_reason: d.vipaka_reason || '',
    agni_effect: no(d.agni_effect, ['stimulating','dampening','neutral'], 'neutral'),
    agni_note: d.agni_note || '',
    ama_risk: no(d.ama_risk, ['low','medium','high'], 'medium'),
    ama_note: d.ama_note || '',
    incompatible_combos: Array.isArray(d.incompatible_combos) ? d.incompatible_combos.filter(c => c?.combo && !['string','combo','...'].includes(c.combo.toLowerCase())) : [],
    time_suitability: no(d.time_suitability, ['ideal','acceptable','avoid'], 'acceptable'),
    time_note: d.time_note || '',
    prakriti_verdict: no(d.prakriti_verdict, ['beneficial','neutral','cautionary','avoid'], 'neutral'),
    prakriti_note: d.prakriti_note || '', prakriti_short_term: d.prakriti_short_term || '', prakriti_long_term: d.prakriti_long_term || '',
    overall_verdict: no(d.overall_verdict, ['good','caution','avoid'], 'caution'),
    overall_note: d.overall_note || '',
    suggestions: Array.isArray(d.suggestions) ? d.suggestions.filter(s => s?.item && !['string','...','item'].includes(s.item.toLowerCase())) : [],
  };
}

function getSeason() {
  const m = new Date().getMonth();
  if (m >= 2 && m <= 4) return 'Vasanta (Spring)';
  if (m >= 5 && m <= 6) return 'Grishma (Summer)';
  if (m >= 7 && m <= 8) return 'Varsha (Monsoon)';
  if (m >= 9 && m <= 10) return 'Sharada (Autumn)';
  return 'Hemanta/Shishira (Winter)';
}

function getKala() {
  const h = new Date().getHours();
  if (h >= 6 && h < 10) return 'Kapha Kala (morning)';
  if (h >= 10 && h < 14) return 'Pitta Kala (midday)';
  if (h >= 14 && h < 18) return 'Vata Kala (afternoon)';
  if (h >= 18 && h < 22) return 'Kapha Kala (evening)';
  return 'Vata Kala (night)';
}

export default function VaidyaScreen() {
  const router = useRouter();
  const { fromHabit, initMealType } = useLocalSearchParams<{ fromHabit?: string; initMealType?: string }>();

  const [activeTab, setActiveTab] = useState<'intel' | 'aahar'>('intel');
  const [aaharTab, setAaharTab] = useState<'rasa' | 'viruddha' | 'timing'>('rasa');
  const [step, setStep] = useState<'pick'|'form'|'analyzing'|'result'>('pick');
  const [mealType, setMealType] = useState(initMealType ?? 'Lunch');
  const [imageUri, setImageUri] = useState<string|null>(null);
  const [imageB64, setImageB64] = useState<string|null>(null);
  const [hunger, setHunger] = useState('moderate');
  const [cookingMethod, setCookingMethod] = useState<string|null>(null);
  const [foodTemp, setFoodTemp] = useState<string|null>(null);
  const [desc, setDesc] = useState('');
  const [analysis, setAnalysis] = useState<Analysis|null>(null);
  const [prakriti, setPrakriti] = useState('');
  const [logged, setLogged] = useState(false);
  const [expandedRasa, setExpandedRasa] = useState<string|null>(null);

  useEffect(() => {
    store.getJSON<{ prakritiAssessment?: { prakriti?: { primary?: string } } }>(KEYS.dosha).then(d => {
      setPrakriti(d?.prakritiAssessment?.prakriti?.primary ?? '');
    });
    return () => stopBodhi();
  }, []);

  const pickImage = async (camera: boolean) => {
    const perm = camera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Please allow access to continue.'); return; }
    const result = camera
      ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.7, mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setImageB64(result.assets[0].base64 ?? null);
      setStep('form');
    }
  };

  const analyze = async () => {
    if (!imageB64) { console.warn('[AyuIntel] No image selected'); return; }
    setStep('analyzing');
    console.log('[AyuIntel] Starting analysis — model: gemini-2.5-flash');
    const kala = getKala();
    try {
      const ctx = [
        `Prakriti: ${prakriti || 'unknown'}`,
        `Meal type: ${mealType}`,
        `Time/Kala: ${kala}`,
        `Season: ${getSeason()}`,
        `Hunger level: ${hunger}`,
        cookingMethod ? `Cooking method: ${cookingMethod}` : '',
        foodTemp     ? `Food temperature: ${foodTemp}` : '',
        desc         ? `User notes: "${desc}"` : '',
      ].filter(Boolean).join('. ');

      const prompt = `You are Ayu Intel, an expert Ayurvedic nutritionist AI trained on Charaka Samhita, Sushruta Samhita, Ashtanga Hridayam, Bhavaprakasha Nighantu, and Raja Nighantu.

The user has shared a photograph of their meal. Context: ${ctx}

PHASE 1 — Identify every dish, ingredients, cooking method, portion sizes, condiments from the image.
PHASE 2 — Perform complete Ayurvedic analysis: Tridosha, Shad Rasa, Vimshati Gunas, Virya, Vipaka, Agni, Ama, Viruddha Ahara, Dinacharya, Prakriti verdict.

USER PRAKRITI: ${prakriti || 'unknown'}
TIME: ${kala}

Respond ONLY with valid JSON. No markdown, no backticks. Start with { end with }.

{"identified_items":["every food item visible"],"meal_summary":"one-line name","confidence":"high|medium|low","doshas":{"vata":{"effect":"balancing|increasing|neutral","score":0,"reason":"string"},"pitta":{"effect":"balancing|increasing|neutral","score":0,"reason":"string"},"kapha":{"effect":"balancing|increasing|neutral","score":0,"reason":"string"}},"rasas":[{"name":"Madhura","label":"Sweet","present":true,"source":"ingredient","dosha_impact":"balances Vata & Pitta, increases Kapha"},{"name":"Amla","label":"Sour","present":false,"source":"","dosha_impact":"balances Vata, increases Pitta & Kapha"},{"name":"Lavana","label":"Salty","present":false,"source":"","dosha_impact":"balances Vata, increases Pitta & Kapha"},{"name":"Katu","label":"Pungent","present":false,"source":"","dosha_impact":"balances Kapha, increases Vata & Pitta"},{"name":"Tikta","label":"Bitter","present":false,"source":"","dosha_impact":"balances Pitta & Kapha, increases Vata"},{"name":"Kashaya","label":"Astringent","present":false,"source":"","dosha_impact":"balances Pitta & Kapha, increases Vata"}],"gunas":[{"name":"Guru","present":false,"reason":""},{"name":"Laghu","present":false,"reason":""},{"name":"Snigdha","present":false,"reason":""},{"name":"Ruksha","present":false,"reason":""},{"name":"Ushna","present":false,"reason":""},{"name":"Sheeta","present":false,"reason":""},{"name":"Tikshna","present":false,"reason":""},{"name":"Manda","present":false,"reason":""}],"virya":"Ushna (hot)|Sheeta (cold)","virya_reason":"string","vipaka":"Madhura|Amla|Katu","vipaka_reason":"string","agni_effect":"stimulating|dampening|neutral","agni_note":"string","ama_risk":"low|medium|high","ama_note":"string","incompatible_combos":[{"combo":"string","concern":"string"}],"time_suitability":"ideal|acceptable|avoid","time_note":"string","prakriti_verdict":"beneficial|neutral|cautionary|avoid","prakriti_note":"string","prakriti_short_term":"string","prakriti_long_term":"string","overall_verdict":"good|caution|avoid","overall_note":"string","suggestions":[{"action":"Add|Remove|Replace|Change|Pair","item":"string","reason":"string"},{"action":"string","item":"string","reason":"string"},{"action":"string","item":"string","reason":"string"}]}`;

      const res = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [
            { inlineData: { mimeType: 'image/jpeg', data: imageB64 } },
            { text: prompt },
          ]}],
          generationConfig: { temperature: 0.3, maxOutputTokens: 8192, responseMimeType: 'application/json' },
        }),
      });
      const data = await res.json();
      console.log('[AyuIntel] HTTP status:', res.status);

      if (data.error) {
        console.error('[AyuIntel] Gemini API error:', JSON.stringify(data.error));
        throw new Error(`Gemini error ${data.error.code}: ${data.error.message}`);
      }

      console.log('[AyuIntel] Candidates count:', data?.candidates?.length ?? 0);
      const candidate = data?.candidates?.[0];
      const finishReason: string = candidate?.finishReason ?? 'STOP';
      console.log('[AyuIntel] finishReason:', finishReason);
      const rawText: string = candidate?.content?.parts?.[0]?.text ?? '{}';
      console.log('[AyuIntel] Raw response (first 400 chars):', rawText.substring(0, 400));

      // Extract JSON — strip potential markdown code fences
      let jsonStr = rawText.trim();
      const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (fenceMatch) jsonStr = fenceMatch[1].trim();
      if (!jsonStr || jsonStr === '{}') throw new Error('Empty response from Gemini');

      // Repair truncated JSON if response was cut off at MAX_TOKENS
      if (finishReason === 'MAX_TOKENS' || finishReason === 'RECITATION') {
        console.warn('[AyuIntel] Response truncated — attempting JSON repair');
        // Close any open arrays and objects
        let depth = 0; let inStr = false; let escape = false;
        for (const ch of jsonStr) {
          if (escape) { escape = false; continue; }
          if (ch === '\\' && inStr) { escape = true; continue; }
          if (ch === '"') { inStr = !inStr; continue; }
          if (!inStr) { if (ch === '{' || ch === '[') depth++; else if (ch === '}' || ch === ']') depth--; }
        }
        // Trim trailing comma then close unclosed structures
        jsonStr = jsonStr.replace(/,\s*$/, '');
        for (let i = 0; i < Math.abs(depth); i++) jsonStr += depth > 0 ? '}' : ']';
      }

      const parsed: Analysis = normalizeAnalysis(JSON.parse(jsonStr));
      console.log('[AyuIntel] Analysis parsed. Verdict:', parsed.overall_verdict, '| Confidence:', parsed.confidence);

      setAnalysis(parsed);
      const existing = await store.getJSON<Record<string, unknown>>(KEYS.mealAnalysis) ?? {};
      await store.setJSON(KEYS.mealAnalysis, { ...existing, [mealType.toLowerCase()]: { analysis: parsed, imageUri, date: new Date().toDateString() } });
      setLogged(false);
      setStep('result');

      // Bodhi speaks the analysis summary
      const summary = `${parsed.meal_summary}. Overall verdict: ${parsed.overall_verdict}. ` +
        `Vata: ${parsed.doshas.vata.effect}. Pitta: ${parsed.doshas.pitta.effect}. Kapha: ${parsed.doshas.kapha.effect}. ` +
        `Agni is ${parsed.agni_effect}. Ama risk is ${parsed.ama_risk}. ${parsed.overall_note} ` +
        (parsed.suggestions.length > 0 ? `Suggestion: ${parsed.suggestions[0].item} — ${parsed.suggestions[0].reason}` : '');
      speakBodhi(summary).catch(() => {});
    } catch (e) {
      console.error('[AyuIntel] Analysis failed:', e instanceof Error ? e.message : String(e));
      Alert.alert('Analysis failed', e instanceof Error ? e.message : 'Please try again.', [{ text: 'OK', onPress: () => setStep('form') }]);
    }
  };

  const reset = () => {
    setStep('pick'); setImageUri(null); setImageB64(null);
    setDesc(''); setAnalysis(null); setLogged(false);
    setCookingMethod(null); setFoodTemp(null);
  };

  const logMeal = async () => {
    if (!analysis || logged) return;
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) { Alert.alert('Not signed in', 'Please sign in to log meals.'); return; }
      const today = todayStr();

      // 1. Save full Ayurvedic analysis to dedicated meal_analyses collection
      await addDoc(collection(db, 'meal_analyses', uid, 'entries'), {
        userId: uid, mealType,
        analysis: {
          meal_summary: analysis.meal_summary,
          confidence: analysis.confidence,
          overall_verdict: analysis.overall_verdict,
          overall_note: analysis.overall_note,
          doshas: analysis.doshas,
          rasas: analysis.rasas.filter(r => r.present),
          gunas: analysis.gunas.filter(g => g.present),
          virya: analysis.virya, virya_reason: analysis.virya_reason,
          vipaka: analysis.vipaka, vipaka_reason: analysis.vipaka_reason,
          agni_effect: analysis.agni_effect, agni_note: analysis.agni_note,
          ama_risk: analysis.ama_risk, ama_note: analysis.ama_note,
          time_suitability: analysis.time_suitability, time_note: analysis.time_note,
          prakriti_verdict: analysis.prakriti_verdict, prakriti_note: analysis.prakriti_note,
          suggestions: analysis.suggestions,
          incompatible_combos: analysis.incompatible_combos,
        },
        date: today, loggedAt: serverTimestamp(),
      });

      // 2. Log the Dinacharya habit with AyuIntel analysis data embedded
      if (fromHabit) {
        // Map display mealType → habit ID and name used in Dinacharya
        const habitId   = mealType === 'Breakfast' ? 'breakfast' : mealType === 'Lunch' ? 'lunch' : 'dinner';
        const habitName = mealType; // Breakfast / Lunch / Dinner
        const now       = new Date();
        const nowMins   = now.getHours() * 60 + now.getMinutes();
        const WINDOWS   = { breakfast: 600, lunch: 840, dinner: 1170 } as Record<string, number>;
        const status    = nowMins <= (WINDOWS[habitId] ?? 9999) ? 'done' : 'late';

        await saveHabitLog({
          habitId, habitName,
          userId: uid, date: today,
          status: status as 'done' | 'late',
          mealDescription: analysis.meal_summary,
          fromAyuIntel: true,
          ayuIntelVerdict:         analysis.overall_verdict,
          ayuIntelSummary:         analysis.overall_note,
          ayuIntelAmaRisk:         analysis.ama_risk,
          ayuIntelAgniEffect:      analysis.agni_effect,
          ayuIntelPrakritiVerdict: analysis.prakriti_verdict,
          streakAtLog: 0,
        });
      }

      setLogged(true);
      if (fromHabit) {
        Alert.alert(
          '✨ Logged via AyuIntel!',
          `${analysis.overall_verdict === 'good' ? '✅ Good meal' : analysis.overall_verdict === 'caution' ? '⚠️ Eat with caution' : '🚫 Best avoided'} · Habit logged to Dinacharya`,
          [{ text: 'Done', onPress: () => router.back() }],
        );
      }
    } catch { Alert.alert('Error', 'Could not save meal log. Please try again.'); }
  };

  const renderResult = () => {
    if (!analysis || !imageUri) return null;
    const vm = VERDICT_META[analysis.overall_verdict] ?? VERDICT_META.caution;
    return (
      <>
        {/* Overall verdict banner */}
        <LinearGradient colors={[vm.color + '22', vm.color + '08']}
          style={[styles.verdictBanner, { borderColor: vm.color + '40' }]}>
          <Image source={{ uri: imageUri }} style={styles.resultThumb} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.verdictIcon, { color: vm.color }]}>{vm.icon}  {vm.label}</Text>
            <Text style={styles.mealSummary}>{analysis.meal_summary}</Text>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
              <View style={[styles.badge, { backgroundColor: vm.color + '20', borderColor: vm.color + '50' }]}>
                <Text style={[styles.badgeTxt, { color: vm.color }]}>
                  {analysis.confidence === 'high' ? '✦ High Confidence' : analysis.confidence === 'medium' ? '◈ Medium' : '◌ Low Confidence'}
                </Text>
              </View>
              <View style={[styles.badge, { backgroundColor: '#94a3b818', borderColor: '#94a3b835' }]}>
                <Text style={[styles.badgeTxt, { color: '#94a3b8' }]}>{getKala()}</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* ── Quick Stats Row ── */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
          {[
            { label: 'Agni', value: analysis.agni_effect,      color: AGNI_META[analysis.agni_effect]?.color,          icon: AGNI_META[analysis.agni_effect]?.icon },
            { label: 'Ama',  value: `${analysis.ama_risk} risk`, color: AMA_META[analysis.ama_risk]?.color,              icon: analysis.ama_risk === 'low' ? '✓' : analysis.ama_risk === 'high' ? '⚠' : '◈' },
            { label: 'Time', value: analysis.time_suitability, color: TIME_META[analysis.time_suitability]?.color,      icon: analysis.time_suitability === 'ideal' ? '✓' : analysis.time_suitability === 'avoid' ? '✗' : '◈' },
            { label: 'Fit',  value: analysis.prakriti_verdict, color: PRAKRITI_META[analysis.prakriti_verdict]?.color,  icon: analysis.prakriti_verdict === 'beneficial' ? '✓' : analysis.prakriti_verdict === 'avoid' ? '✗' : '◈' },
          ].map(s => (
            <View key={s.label} style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 14, borderWidth: 1.5, borderColor: s.color + '40', backgroundColor: s.color + '12' }}>
              <Text style={{ fontSize: 16 }}>{s.icon}</Text>
              <Text style={{ fontSize: 9, fontWeight: '900', color: s.color, marginTop: 2, textTransform: 'uppercase' }}>{s.label}</Text>
              <Text style={{ fontSize: 8, color: s.color + 'cc', fontWeight: '700', textAlign: 'center', marginTop: 1 }}>{s.value}</Text>
            </View>
          ))}
        </View>

        {/* ── TRIDOSHA ANALYSIS ── */}
        <View style={[styles.card, { borderColor: '#a78bfa30' }]}>
          <Text style={styles.cardTitle}>⚖️ Tridosha Analysis</Text>
          {([['🌬️ Vata', analysis.doshas?.vata, '#a78bfa'], ['🔥 Pitta', analysis.doshas?.pitta, '#fb923c'], ['🌿 Kapha', analysis.doshas?.kapha, '#34d399']] as [string, DoshaDetail, string][]).map(([label, d, color]) => {
            if (!d) return null;
            const pct = Math.min(d.score, 100);
            return (
              <View key={label} style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={[styles.doshaLbl, { color }]}>{label}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={[styles.badge, { backgroundColor: color + '20', borderColor: color + '45' }]}>
                      <Text style={[styles.badgeTxt, { color }]}>{d.effect}</Text>
                    </View>
                    <Text style={{ fontSize: 11, fontWeight: '900', color }}>{pct}%</Text>
                  </View>
                </View>
                <View style={{ height: 8, borderRadius: 8, backgroundColor: color + '18', overflow: 'hidden' }}>
                  <View style={{ width: `${pct}%` as `${number}%`, height: '100%', borderRadius: 8, backgroundColor: color }} />
                </View>
                <Text style={[styles.cardBody, { marginTop: 5, fontSize: 11 }]}>{d.reason}</Text>
              </View>
            );
          })}
        </View>

        {/* ── SHAD RASA ── */}
        <View style={[styles.card, { borderColor: Colors.gold + '30' }]}>
          <Text style={styles.cardTitle}>👅 Shad Rasa — Six Tastes</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(analysis.rasas ?? []).map((r, i) => {
              const rasaColor = AAHAR_RASAS.find(ar => ar.name?.toLowerCase() === r.name?.toLowerCase())?.color ?? Colors.gold;
              return (
                <View key={i} style={{ width: '30%', flexGrow: 1, borderRadius: 14, borderWidth: 1.5,
                  borderColor: r.present ? rasaColor + '55' : Colors.border,
                  backgroundColor: r.present ? rasaColor + '14' : Colors.card + '80',
                  padding: 10, alignItems: 'center' }}>
                  <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: r.present ? rasaColor + '30' : Colors.border + '30',
                    borderWidth: r.present ? 1.5 : 0, borderColor: rasaColor, marginBottom: 4 }}>
                    <Text style={{ fontSize: 13 }}>{AAHAR_RASAS.find(ar => ar.name?.toLowerCase() === r.name?.toLowerCase())?.emoji ?? '•'}</Text>
                  </View>
                  <Text style={{ fontSize: 10, fontWeight: '900', color: r.present ? rasaColor : Colors.textMuted }}>{r.name}</Text>
                  <Text style={{ fontSize: 8, color: r.present ? rasaColor + 'aa' : Colors.textDim, marginTop: 1 }}>{r.label}</Text>
                  {r.present && !!r.source && <Text style={{ fontSize: 8, color: Colors.textMuted, marginTop: 3, textAlign: 'center' }}>{r.source}</Text>}
                  {!r.present && <Text style={{ fontSize: 8, color: Colors.textDim, marginTop: 3 }}>absent</Text>}
                </View>
              );
            })}
          </View>
        </View>

        {/* ── Identified Items ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🔍 Identified Items</Text>
          <View style={styles.tagWrap}>
            {(analysis.identified_items ?? []).map((item, i) => (
              <View key={i} style={styles.itemTag}>
                <Text style={styles.itemTagTxt}>{item}</Text>
              </View>
            ))}
          </View>
          {!!analysis.overall_note && <Text style={[styles.cardBody, { marginTop: 8 }]}>{analysis.overall_note}</Text>}
        </View>

        {/* Gunas */}
        {(analysis.gunas ?? []).some(g => g.present) && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>✦ Dominant Gunas</Text>
            <View style={styles.tagWrap}>
              {analysis.gunas.filter(g => g.present).map((g, i) => (
                <View key={i} style={[styles.itemTag, { backgroundColor: '#8b5cf615', borderColor: '#8b5cf630' }]}>
                  <Text style={[styles.itemTagTxt, { color: '#a78bfa' }]}>{g.name}</Text>
                </View>
              ))}
            </View>
            {analysis.gunas.filter(g => g.present).map((g, i) => (
              <View key={i} style={styles.gunaRow}>
                <Text style={[styles.gunaName, { color: '#a78bfa' }]}>{g.name}:</Text>
                <Text style={[styles.cardBody, { flex: 1 }]}>{g.reason}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Virya + Vipaka row */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
          <View style={[styles.card, { flex: 1, marginBottom: 0 }]}>
            <Text style={styles.cardTitle}>🌡️ Virya</Text>
            <Text style={[styles.doshaLbl, { color: (analysis.virya ?? '').includes('hot') || (analysis.virya ?? '').includes('Ushna') ? '#fb923c' : '#60a5fa', marginBottom: 4 }]}>{analysis.virya}</Text>
            <Text style={styles.cardBody}>{analysis.virya_reason}</Text>
          </View>
          <View style={[styles.card, { flex: 1, marginBottom: 0 }]}>
            <Text style={styles.cardTitle}>🔄 Vipaka</Text>
            <Text style={[styles.doshaLbl, { color: Colors.gold, marginBottom: 4 }]}>{analysis.vipaka}</Text>
            <Text style={styles.cardBody}>{analysis.vipaka_reason}</Text>
          </View>
        </View>

        {/* Agni + Ama row */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
          <View style={[styles.card, { flex: 1, marginBottom: 0 }]}>
            <Text style={styles.cardTitle}>🔥 Agni</Text>
            <View style={[styles.badge, { backgroundColor: AGNI_META[analysis.agni_effect]?.color + '20', borderColor: AGNI_META[analysis.agni_effect]?.color + '50', alignSelf: 'flex-start', marginBottom: 6 }]}>
              <Text style={[styles.badgeTxt, { color: AGNI_META[analysis.agni_effect]?.color }]}>{AGNI_META[analysis.agni_effect]?.icon} {analysis.agni_effect}</Text>
            </View>
            <Text style={styles.cardBody}>{analysis.agni_note}</Text>
          </View>
          <View style={[styles.card, { flex: 1, marginBottom: 0 }]}>
            <Text style={styles.cardTitle}>🧫 Ama Risk</Text>
            <View style={[styles.badge, { backgroundColor: AMA_META[analysis.ama_risk]?.color + '20', borderColor: AMA_META[analysis.ama_risk]?.color + '50', alignSelf: 'flex-start', marginBottom: 6 }]}>
              <Text style={[styles.badgeTxt, { color: AMA_META[analysis.ama_risk]?.color }]}>{analysis.ama_risk} risk</Text>
            </View>
            <Text style={styles.cardBody}>{analysis.ama_note}</Text>
          </View>
        </View>

        {/* Viruddha Ahara */}
        {(analysis.incompatible_combos ?? []).filter(c => c.combo).length > 0 && (
          <View style={[styles.card, { borderColor: '#f8717140' }]}>
            <Text style={[styles.cardTitle, { color: '#f87171' }]}>⚠️ Viruddha Ahara — Incompatible Combos</Text>
            {analysis.incompatible_combos.filter(c => c.combo).map((c, i) => (
              <View key={i} style={[styles.comboRow, i === analysis.incompatible_combos.length - 1 && { borderBottomWidth: 0 }]}>
                <Text style={styles.comboItem}>{c.combo}</Text>
                <Text style={styles.cardBody}>{c.concern}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Time suitability */}
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Text style={styles.cardTitle}>🕐 Time Suitability</Text>
            <View style={[styles.badge, { backgroundColor: TIME_META[analysis.time_suitability]?.color + '20', borderColor: TIME_META[analysis.time_suitability]?.color + '50' }]}>
              <Text style={[styles.badgeTxt, { color: TIME_META[analysis.time_suitability]?.color }]}>{analysis.time_suitability}</Text>
            </View>
          </View>
          <Text style={styles.cardBody}>{analysis.time_note}</Text>
        </View>

        {/* Prakriti verdict */}
        <View style={[styles.card, { borderColor: PRAKRITI_META[analysis.prakriti_verdict]?.color + '40' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Text style={styles.cardTitle}>🧬 Your Prakriti Verdict</Text>
            <View style={[styles.badge, { backgroundColor: PRAKRITI_META[analysis.prakriti_verdict]?.color + '20', borderColor: PRAKRITI_META[analysis.prakriti_verdict]?.color + '50' }]}>
              <Text style={[styles.badgeTxt, { color: PRAKRITI_META[analysis.prakriti_verdict]?.color }]}>{PRAKRITI_META[analysis.prakriti_verdict]?.label}</Text>
            </View>
          </View>
          {!!prakriti && <Text style={[styles.cardBody, { color: Colors.gold, fontWeight: '700', marginBottom: 6 }]}>{prakriti} Prakriti</Text>}
          <Text style={styles.cardBody}>{analysis.prakriti_note}</Text>
          {!!analysis.prakriti_short_term && (
            <View style={[styles.timeBlock, { borderColor: '#fbbf2435', marginTop: 10 }]}>
              <Text style={[styles.timeLbl, { color: '#fbbf24' }]}>SHORT-TERM</Text>
              <Text style={styles.cardBody}>{analysis.prakriti_short_term}</Text>
            </View>
          )}
          {!!analysis.prakriti_long_term && (
            <View style={[styles.timeBlock, { borderColor: '#f8717130', marginTop: 8 }]}>
              <Text style={[styles.timeLbl, { color: '#f87171' }]}>LONG-TERM</Text>
              <Text style={styles.cardBody}>{analysis.prakriti_long_term}</Text>
            </View>
          )}
        </View>

        {/* Suggestions */}
        {(analysis.suggestions ?? []).length > 0 && (
          <View style={[styles.card, { borderColor: Colors.gold + '30' }]}>
            <Text style={styles.cardTitle}>✦ Bodhi Recommends</Text>
            {(analysis.suggestions ?? []).map((s, i) => {
              const actionColor = s.action === 'add' ? '#10b981' : s.action === 'reduce' ? '#f87171' : s.action === 'avoid' ? '#ef4444' : '#fbbf24';
              return (
                <View key={i} style={{ flexDirection: 'row', gap: 10, paddingVertical: 10,
                  borderBottomWidth: i < (analysis.suggestions.length - 1) ? 1 : 0,
                  borderBottomColor: Colors.border + '30' }}>
                  <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8, borderWidth: 1,
                    backgroundColor: actionColor + '18', borderColor: actionColor + '50',
                    alignSelf: 'flex-start', marginTop: 2 }}>
                    <Text style={{ fontSize: 9, fontWeight: '900', color: actionColor, textTransform: 'uppercase' }}>{s.action}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: Colors.text, marginBottom: 2 }}>{s.item}</Text>
                    <Text style={styles.cardBody}>{s.reason}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <TouchableOpacity onPress={logMeal} disabled={logged}
          style={[styles.logBtn, logged && styles.logBtnDone]} activeOpacity={0.8}>
          <Text style={[styles.logBtnText, logged && { color: '#10b981' }]}>
            {logged ? '✅ Logged to Daily Progress!' : '✦ Log This Meal'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={reset} style={styles.newBtn} activeOpacity={0.8}>
          <Text style={styles.newBtnText}>Analyse Another Meal</Text>
        </TouchableOpacity>
      </>
    );
  };

  const renderAaharTab = () => (
    <>
      {/* Aahar sub-tabs */}
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: Spacing.md }}>
        {([['rasa', '👅 Shad Rasa'], ['viruddha', '⚠️ Viruddha'], ['timing', '🕐 Timing']] as const).map(([id, label]) => (
          <TouchableOpacity key={id} onPress={() => setAaharTab(id)} activeOpacity={0.8}
            style={{ flex: 1, borderRadius: Radius.full, paddingVertical: 8, alignItems: 'center', borderWidth: 1,
              backgroundColor: aaharTab === id ? Colors.gold + '20' : Colors.card,
              borderColor: aaharTab === id ? Colors.gold + '60' : Colors.border }}>
            <Text style={{ fontSize: Font.sizes.xs, fontWeight: '800', color: aaharTab === id ? Colors.gold : Colors.textMuted }}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {aaharTab === 'rasa' && (
        <>
          <Text style={[styles.cardBody, { marginBottom: Spacing.md, color: Colors.textSub }]}>
            Ayurveda recognises six tastes. Every meal should ideally contain all six — each nourishes different tissues and balances different doshas.
          </Text>
          {AAHAR_RASAS.map(r => {
            const open = expandedRasa === r.id;
            return (
              <TouchableOpacity key={r.id} onPress={() => setExpandedRasa(open ? null : r.id)} activeOpacity={0.8}
                style={[styles.card, open && { borderColor: r.color + '55' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: r.color + '20', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 20 }}>{r.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: Font.sizes.base, fontWeight: '900', color: r.color }}>{r.name} <Text style={{ color: Colors.textMuted, fontWeight: '600', fontSize: Font.sizes.sm }}>· {r.en}</Text></Text>
                    <Text style={{ fontSize: Font.sizes.xs, color: Colors.textDim, marginTop: 1 }}>{r.dosha}</Text>
                  </View>
                  <Text style={{ color: Colors.textDim }}>{open ? '▲' : '▼'}</Text>
                </View>
                {open && (
                  <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border }}>
                    <Text style={[styles.cardBody, { marginBottom: 6 }]}>{r.effect}</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                      {r.foods.map((f, i) => (
                        <View key={i} style={{ backgroundColor: r.color + '18', borderRadius: Radius.full, borderWidth: 1, borderColor: r.color + '40', paddingHorizontal: 8, paddingVertical: 3 }}>
                          <Text style={{ fontSize: Font.sizes.xs, color: r.color, fontWeight: '700' }}>{f}</Text>
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

      {aaharTab === 'viruddha' && (
        <>
          <View style={[styles.infoCard, { borderColor: '#f8717140', marginBottom: Spacing.md }]}>
            <Text style={[styles.infoTxt, { color: '#f87171' }]}>⚠️ Viruddha Ahara are incompatible food combinations that create Ama (toxins) — avoid these daily</Text>
          </View>
          {AAHAR_VIRUDDHA.map((v, i) => (
            <View key={i} style={[styles.card, { borderColor: '#f8717130' }]}>
              <Text style={{ fontSize: Font.sizes.sm, fontWeight: '800', color: '#f87171', marginBottom: 4 }}>{v.combo}</Text>
              <Text style={styles.cardBody}>{v.reason}</Text>
            </View>
          ))}
        </>
      )}

      {aaharTab === 'timing' && (
        <>
          <View style={[styles.infoCard, { marginBottom: Spacing.md }]}>
            <Text style={styles.infoTxt}>📅 Dinacharya meal timing aligns eating with your body's natural digestive fire (Agni) cycles</Text>
          </View>
          {AAHAR_TIMING.map((t, i) => (
            <View key={i} style={[styles.card, { borderColor: t.color + '40' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <Text style={{ fontSize: 28 }}>{t.emoji}</Text>
                <View>
                  <Text style={{ fontSize: Font.sizes.md, fontWeight: '900', color: t.color }}>{t.slot}</Text>
                  <Text style={{ fontSize: Font.sizes.xs, color: Colors.textDim }}>{t.time}</Text>
                </View>
              </View>
              <Text style={styles.cardBody}>{t.advice}</Text>
            </View>
          ))}
        </>
      )}
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ScreenHeader title="Ayu Intel" subtitle="Meal Analysis · Aahar Vigyan" showBack accent={Colors.gold} />

      {/* Main tab bar */}
      <View style={{ flexDirection: 'row', paddingHorizontal: Spacing.md, paddingTop: 8, paddingBottom: 4, gap: 8 }}>
        {([['intel', '🔬 Ayu Intel'], ['aahar', '🌿 Aahar Vigyan']] as const).map(([id, label]) => (
          <TouchableOpacity key={id} onPress={() => setActiveTab(id)} activeOpacity={0.8}
            style={{ flex: 1, borderRadius: Radius.full, paddingVertical: 9, alignItems: 'center', borderWidth: 1.5,
              backgroundColor: activeTab === id ? Colors.gold + '22' : Colors.card,
              borderColor: activeTab === id ? Colors.gold + '70' : Colors.border }}>
            <Text style={{ fontSize: Font.sizes.sm, fontWeight: '900', color: activeTab === id ? Colors.gold : Colors.textMuted }}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Aahar Vigyan tab */}
        {activeTab === 'aahar' && renderAaharTab()}

        {/* ── Ayu Intel tab ── */}
        {activeTab === 'intel' && fromHabit && step === 'pick' && (
          <View style={[styles.infoCard, { borderColor: '#10b98140', marginBottom: Spacing.md }]}>
            <Text style={[styles.infoTxt, { color: '#10b981', fontWeight: '800' }]}>
              📸 Logging {mealType} for Dinacharya · Photo analysis required
            </Text>
          </View>
        )}

        {/* ── PICK step ── */}
        {activeTab === 'intel' && step === 'pick' && (
          <>
            {/* Kala context banner */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.gold + '10',
              borderRadius: 14, borderWidth: 1, borderColor: Colors.gold + '25', padding: 12, marginBottom: 18 }}>
              <Text style={{ fontSize: 22 }}>🔬</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '900', color: Colors.gold }}>Ayu Intel · Meal Vision</Text>
                <Text style={{ fontSize: 10, color: Colors.textMuted, marginTop: 1 }}>{getKala()} · {getSeason()}</Text>
              </View>
              <View style={{ backgroundColor: Colors.gold + '20', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                <Text style={{ fontSize: 9, fontWeight: '900', color: Colors.gold }}>AI ACTIVE</Text>
              </View>
            </View>

            {/* Meal type — horizontal pills */}
            <Text style={{ fontSize: 9, fontWeight: '900', color: Colors.textDim, letterSpacing: 1.1, marginBottom: 8 }}>SELECT MEAL</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {MEAL_TYPES.map(m => (
                  <TouchableOpacity key={m.id} onPress={() => setMealType(m.id)} activeOpacity={0.8}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 10,
                      borderRadius: Radius.full, borderWidth: 1.5,
                      borderColor: mealType === m.id ? Colors.gold : Colors.border,
                      backgroundColor: mealType === m.id ? Colors.gold + '18' : Colors.card }}>
                    <Text style={{ fontSize: 18 }}>{m.e}</Text>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: mealType === m.id ? Colors.gold : Colors.textMuted }}>{m.id}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Large shutter-style camera button */}
            <View style={{ alignItems: 'center', marginBottom: 24 }}>
              <TouchableOpacity onPress={() => pickImage(true)} activeOpacity={0.75}>
                {/* Outer glow ring */}
                <View style={{ width: 140, height: 140, borderRadius: 70, borderWidth: 2,
                  borderColor: Colors.gold + '30', alignItems: 'center', justifyContent: 'center' }}>
                  {/* Middle ring */}
                  <View style={{ width: 118, height: 118, borderRadius: 59, borderWidth: 1.5,
                    borderColor: Colors.gold + '50', alignItems: 'center', justifyContent: 'center' }}>
                    {/* Core button */}
                    <View style={{ width: 96, height: 96, borderRadius: 48,
                      backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center',
                      shadowColor: Colors.gold, shadowOpacity: 0.5, shadowRadius: 16, elevation: 10 }}>
                      <Text style={{ fontSize: 36 }}>📷</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
              <Text style={{ fontSize: 14, fontWeight: '800', color: Colors.text, marginTop: 14 }}>Photograph your {mealType}</Text>
              <Text style={{ fontSize: 10, color: Colors.textMuted, marginTop: 3 }}>Tap the lens to open camera</Text>
            </View>

            {/* Gallery option — slim elegant */}
            <TouchableOpacity onPress={() => pickImage(false)} activeOpacity={0.8}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                paddingVertical: 13, borderRadius: 14, borderWidth: 1,
                borderColor: Colors.border, backgroundColor: Colors.card }}>
              <Text style={{ fontSize: 16 }}>🖼️</Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.textSub }}>Choose from Gallery</Text>
            </TouchableOpacity>

            {/* Sacred footer */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4, marginTop: 18, flexWrap: 'wrap' }}>
              {['Charaka Samhita', 'Ashtanga Hridayam', 'Bhavaprakasha'].map((t, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  {i > 0 && <Text style={{ fontSize: 8, color: Colors.textDim }}>·</Text>}
                  <Text style={{ fontSize: 9, color: Colors.textDim, fontWeight: '600' }}>{t}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── FORM step ── */}
        {activeTab === 'intel' && step === 'form' && imageUri && (
          <>
            {/* Compact image preview with meal badge */}
            <View style={{ marginBottom: 16, borderRadius: 18, overflow: 'hidden' }}>
              <Image source={{ uri: imageUri }} style={{ width: '100%', height: 170, borderRadius: 18 }} resizeMode="cover" />
              <View style={{ position: 'absolute', bottom: 10, left: 10,
                backgroundColor: '#000000cc', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: Colors.gold }}>{mealType} · Ready to analyse</Text>
              </View>
              <TouchableOpacity onPress={reset} style={{ position: 'absolute', top: 10, right: 10,
                backgroundColor: '#000000aa', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                <Text style={{ fontSize: 10, color: '#ffffff99', fontWeight: '700' }}>✕ Change</Text>
              </TouchableOpacity>
            </View>

            {/* Hunger */}
            <Text style={styles.sectionLbl}>Hunger Level</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
              {HUNGER.map(h => (
                <TouchableOpacity key={h.id} onPress={() => setHunger(h.id)} activeOpacity={0.8}
                  style={{ flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 12, borderWidth: 1.5,
                    borderColor: hunger === h.id ? Colors.gold + '70' : Colors.border,
                    backgroundColor: hunger === h.id ? Colors.gold + '12' : Colors.card }}>
                  <Text style={{ fontSize: 18 }}>{h.e}</Text>
                  <Text style={{ fontSize: 8, fontWeight: '800', color: hunger === h.id ? Colors.gold : Colors.textMuted, marginTop: 3, textAlign: 'center' }}>{h.t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Cooking + Temp in one row of chips */}
            <Text style={styles.sectionLbl}>Method <Text style={{ color: Colors.textDim, fontWeight: '500' }}>· optional</Text></Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {COOKING_METHODS.map(c => (
                <TouchableOpacity key={c.id} onPress={() => setCookingMethod(cookingMethod === c.id ? null : c.id)} activeOpacity={0.8}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6,
                    borderRadius: Radius.full, borderWidth: 1,
                    borderColor: cookingMethod === c.id ? Colors.gold + '70' : Colors.border,
                    backgroundColor: cookingMethod === c.id ? Colors.gold + '12' : Colors.card }}>
                  <Text style={{ fontSize: 12 }}>{c.e}</Text>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: cookingMethod === c.id ? Colors.gold : Colors.textMuted }}>{c.t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionLbl}>Temperature <Text style={{ color: Colors.textDim, fontWeight: '500' }}>· optional</Text></Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {FOOD_TEMPS.map(t => (
                <TouchableOpacity key={t.id} onPress={() => setFoodTemp(foodTemp === t.id ? null : t.id)} activeOpacity={0.8}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6,
                    borderRadius: Radius.full, borderWidth: 1,
                    borderColor: foodTemp === t.id ? Colors.gold + '70' : Colors.border,
                    backgroundColor: foodTemp === t.id ? Colors.gold + '12' : Colors.card }}>
                  <Text style={{ fontSize: 12 }}>{t.e}</Text>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: foodTemp === t.id ? Colors.gold : Colors.textMuted }}>{t.t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Description */}
            <Text style={styles.sectionLbl}>Notes <Text style={{ color: Colors.textDim, fontWeight: '500' }}>· optional</Text></Text>
            <TextInput style={styles.descInput} value={desc} onChangeText={setDesc}
              placeholder="e.g. Dal makhani with rice and raita, extra ghee..."
              placeholderTextColor={Colors.textMuted} multiline maxLength={300} />

            <TouchableOpacity onPress={analyze} style={styles.analyzeBtn} activeOpacity={0.8}>
              <Text style={styles.analyzeBtnText}>✦ Invoke Ayu Intel</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── ANALYZING step ── */}
        {activeTab === 'intel' && step === 'analyzing' && (
          <View style={styles.loadingWrap}>
            <View style={{ width: 72, height: 72, borderRadius: 36, borderWidth: 1.5, borderColor: Colors.gold + '40',
              backgroundColor: Colors.gold + '10', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
              <ActivityIndicator size="large" color={Colors.gold} />
            </View>
            <Text style={{ fontSize: 17, fontWeight: '900', color: Colors.text, marginBottom: 6 }}>Consulting the Texts</Text>
            <Text style={{ fontSize: 11, color: Colors.textMuted, textAlign: 'center', lineHeight: 18, marginBottom: 20 }}>
              {'Charaka Samhita · Ashtanga Hridayam\nBhavaprakasha · Sushruta Samhita'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[0,1,2].map(i => (
                <View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.gold, opacity: 0.4 + i * 0.3 }} />
              ))}
            </View>
          </View>
        )}

        {/* ── RESULT step ── */}
        {activeTab === 'intel' && step === 'result' && renderResult()}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 14 },
  sectionLbl: { fontSize: 10, fontWeight: '800', color: Colors.textMuted, letterSpacing: 0.8, marginBottom: 7, textTransform: 'uppercase' },
  stepTitle: { fontSize: Font.sizes.base, fontWeight: '800', color: Colors.text, marginBottom: Spacing.sm, marginTop: 4 },
  optTag: { fontSize: Font.sizes.xs, fontWeight: '500', color: Colors.textMuted },
  mealRow: { flexDirection: 'row', gap: 8, marginBottom: Spacing.lg },
  mealChip: { flex: 1, backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: 10, alignItems: 'center' },
  mealEmoji: { fontSize: 22, marginBottom: 4 },
  mealLabel: { fontSize: Font.sizes.xs, fontWeight: '700', color: Colors.textMuted },
  captureBtn: { backgroundColor: Colors.gold, borderRadius: Radius.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18, marginBottom: 10 },
  captureBtnAlt: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  captureBtnEmoji: { fontSize: 24 },
  captureBtnText: { fontSize: Font.sizes.md, fontWeight: '800', color: '#0A0A0F' },
  infoCard: { backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: 12 },
  infoTxt: { fontSize: Font.sizes.xs, color: Colors.textMuted, lineHeight: 18 },
  previewImg: { width: '100%', height: 170, borderRadius: 18, marginBottom: Spacing.md },
  hungerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.md },
  hungerChip: { flexBasis: '48%', backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  hungerEmoji: { fontSize: 18 },
  hungerText: { fontSize: Font.sizes.sm, color: Colors.textMuted, flex: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.md },
  miniChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.card, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 10, paddingVertical: 7 },
  miniChipTxt: { fontSize: Font.sizes.xs, fontWeight: '700', color: Colors.textMuted },
  descInput: { backgroundColor: Colors.card, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 11, color: Colors.text, fontSize: 13, minHeight: 64, marginBottom: 14, textAlignVertical: 'top' },
  analyzeBtn: { backgroundColor: Colors.gold, borderRadius: Radius.full, paddingVertical: 14, alignItems: 'center', marginBottom: 8 },
  analyzeBtnText: { color: '#0A0A0F', fontSize: Font.sizes.base, fontWeight: '900', letterSpacing: 0.3 },
  backBtn: { alignItems: 'center', padding: 8 },
  backBtnText: { color: Colors.textMuted, fontSize: Font.sizes.sm },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 8 },
  loadingText: { fontSize: Font.sizes.md, fontWeight: '700', color: Colors.text },
  loadingSubText: { fontSize: Font.sizes.sm, color: Colors.textMuted, textAlign: 'center' },
  // Result
  verdictBanner: { borderRadius: Radius.xl, borderWidth: 1.5, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 10 },
  resultThumb: { width: 80, height: 80, borderRadius: Radius.lg },
  verdictIcon: { fontSize: Font.sizes.md, fontWeight: '900' },
  mealSummary: { fontSize: Font.sizes.base, fontWeight: '800', color: Colors.text, lineHeight: 20 },
  card: { backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 12, marginBottom: 8 },
  cardTitle: { fontSize: 13, fontWeight: '800', color: Colors.text, marginBottom: 7 },
  cardBody: { fontSize: 11, color: Colors.textSub, lineHeight: 18 },
  badge: { borderRadius: Radius.full, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  badgeTxt: { fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  itemTag: { backgroundColor: Colors.bg, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border + '80', paddingHorizontal: 10, paddingVertical: 4 },
  itemTagTxt: { fontSize: Font.sizes.xs, color: Colors.textSub, fontWeight: '600' },
  doshaBlock: { borderWidth: 1, borderRadius: Radius.md, padding: 10, marginBottom: 8 },
  doshaBlockHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  doshaLbl: { fontSize: Font.sizes.sm, fontWeight: '800', flex: 1 },
  doshaScore: { fontSize: Font.sizes.sm, fontWeight: '900' },
  scoreTrack: { height: 4, borderRadius: 2, backgroundColor: Colors.border, overflow: 'hidden', marginBottom: 6 },
  scoreFill: { height: '100%', borderRadius: 2 },
  rasaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  rasaChip: { backgroundColor: Colors.gold + '18', borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.gold + '40', paddingHorizontal: 10, paddingVertical: 6, minWidth: '30%', alignItems: 'center' },
  rasaChipOff: { backgroundColor: Colors.bg, borderColor: Colors.border + '50', opacity: 0.4 },
  rasaName: { fontSize: Font.sizes.xs, fontWeight: '900', color: Colors.gold },
  rasaLabel: { fontSize: 9, color: Colors.gold + 'aa', marginTop: 1 },
  rasaSource: { fontSize: 9, color: Colors.textMuted, marginTop: 2, textAlign: 'center' },
  gunaRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: 4 },
  gunaName: { fontSize: Font.sizes.xs, fontWeight: '800', minWidth: 60 },
  comboRow: { marginBottom: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: Colors.border + '40' },
  comboItem: { fontSize: Font.sizes.sm, fontWeight: '700', color: '#f87171', marginBottom: 2 },
  timeBlock: { borderWidth: 1, borderRadius: Radius.md, padding: 8 },
  timeLbl: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8, marginBottom: 4 },
  suggRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingTop: 8 },
  suggAction: { backgroundColor: Colors.gold + '20', borderRadius: Radius.md, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: Colors.gold + '40' },
  suggActionTxt: { fontSize: 9, fontWeight: '900', color: Colors.gold, letterSpacing: 0.3 },
  logBtn: { backgroundColor: '#10b98118', borderRadius: Radius.full, borderWidth: 1.5, borderColor: '#10b98150', paddingVertical: 15, alignItems: 'center', marginTop: 6 },
  logBtnDone: { backgroundColor: '#10b98110', borderColor: '#10b98130' },
  logBtnText: { color: '#10b981', fontSize: Font.sizes.base, fontWeight: '900' },
  newBtn: { backgroundColor: Colors.card, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, paddingVertical: 13, alignItems: 'center', marginTop: 6 },
  newBtnText: { color: Colors.textSub, fontSize: Font.sizes.base, fontWeight: '700' },
});
